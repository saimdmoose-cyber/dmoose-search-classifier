import { classifyWithClaude, hasApiKey } from './claudeApi';

/**
 * Extract individual keywords from user's target keywords text.
 * Splits on commas, newlines, and common separators.
 */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .split(/[,\n;|]+/)
    .map(k => k.trim())
    .filter(k => k.length > 1);
}

/**
 * Extract individual meaningful words from the product info for fuzzy matching.
 * Filters out common stop words.
 */
function extractProductWords(text) {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'same', 'than', 'too', 'very',
    'just', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
    'with', 'about', 'against', 'between', 'through', 'during', 'before',
    'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
    'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it',
    'its', 'they', 'them', 'their', 'title', 'bullets', 'keywords',
    'example', 'product', 'description', 'feature', 'features',
  ]);

  const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
  return [...new Set(words.filter(w => !stopWords.has(w)))];
}

/**
 * Layer 1: Keyword Match (EXACT)
 * If the search term contains any multi-word phrase from the target keywords, mark relevant.
 */
function keywordMatch(searchTerm, keywords) {
  const termLower = searchTerm.toLowerCase();
  for (const kw of keywords) {
    const kwWords = kw.split(/\s+/).filter(w => w.length > 1);
    if (kwWords.length === 0) continue;
    const allMatch = kwWords.every(word => termLower.includes(word));
    if (allMatch) {
      return { matched: true, keyword: kw };
    }
  }
  return { matched: false, keyword: null };
}

/**
 * Layer 1b: Fuzzy/Partial Keyword Match (SEMI-RELEVANT detection)
 * Checks how many product-related words appear in the search term.
 * Returns a relevance score 0-1.
 */
function fuzzyProductMatch(searchTerm, productWords) {
  const termWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (termWords.length === 0 || productWords.length === 0) return { score: 0, matchedWords: [] };

  const matchedWords = [];
  for (const tw of termWords) {
    for (const pw of productWords) {
      // Exact word match or stem match (e.g., "strap" matches "straps")
      if (tw === pw || pw.startsWith(tw) || tw.startsWith(pw)) {
        matchedWords.push(tw);
        break;
      }
    }
  }

  const score = termWords.length > 0 ? matchedWords.length / termWords.length : 0;
  return { score, matchedWords };
}

/**
 * Layer 2: Zero Sales Filter
 */
function zeroSalesFilter(row) {
  return row.orders === 0;
}

/**
 * Layer 3: ACOS Filter
 */
function acosFilter(row, threshold) {
  return row.acos > 0 && row.acos > threshold;
}

/**
 * Main classification engine.
 * Applies all 4 layers in order and returns classified results.
 *
 * BUCKETS:
 *   relevant   — keyword match + has orders + ACOS OK
 *   wasting    — relevant but zero orders or high ACOS
 *   semi       — partially related (fuzzy match or AI semi-relevant), zero orders
 *   irrelevant — no relation at all, zero orders (negative candidates)
 */
export async function classifySearchTerms({
  rows,
  productInfo,
  acosThreshold = 40,
  spendThreshold = 3,
  onLayerUpdate,
  onProgress,
}) {
  const keywords = extractKeywords(productInfo);
  const productWords = extractProductWords(productInfo);
  const results = [];

  // === LAYER 1: Keyword Match ===
  if (onLayerUpdate) onLayerUpdate('Layer 1: Keyword Match — scanning target keywords...');

  const keywordResults = rows.map(row => {
    const match = keywordMatch(row.searchTerm, keywords);
    const fuzzy = fuzzyProductMatch(row.searchTerm, productWords);
    return {
      ...row,
      keywordRelevant: match.matched,
      matchedKeyword: match.keyword,
      fuzzyScore: fuzzy.score,
      fuzzyWords: fuzzy.matchedWords,
    };
  });

  // === LAYER 2: Zero Sales Filter ===
  if (onLayerUpdate) onLayerUpdate('Layer 2: Zero Sales Filter — flagging zero-order terms...');

  const zeroSalesResults = keywordResults.map(row => ({
    ...row,
    hasZeroSales: zeroSalesFilter(row),
  }));

  // === LAYER 3: ACOS Filter ===
  if (onLayerUpdate) onLayerUpdate('Layer 3: ACOS Filter — checking ACOS thresholds...');

  const acosResults = zeroSalesResults.map(row => ({
    ...row,
    acosExceeded: acosFilter(row, acosThreshold),
  }));

  // === LAYER 4: AI Classification ===
  const apiAvailable = hasApiKey();
  if (apiAvailable) {
    if (onLayerUpdate) onLayerUpdate('Layer 4: AI Classification — sending to Claude API...');
  } else {
    if (onLayerUpdate) onLayerUpdate('Layer 4: AI Classification — skipped (no API key). Using fuzzy matching for semi-relevant detection.');
  }

  // Only send terms that weren't matched by keywords to Claude for classification
  const unknownTerms = acosResults
    .filter(row => !row.keywordRelevant)
    .map(row => row.searchTerm);

  const uniqueUnknowns = [...new Set(unknownTerms)];

  let aiResults = new Map();
  if (uniqueUnknowns.length > 0) {
    aiResults = await classifyWithClaude(uniqueUnknowns, productInfo, onProgress);
  }

  // === FINAL CLASSIFICATION ===
  if (onLayerUpdate) onLayerUpdate('Finalizing classification...');

  for (const row of acosResults) {
    let bucket, reason;

    const aiResult = aiResults.get(row.searchTerm);
    const isAiRelevant = aiResult?.aiRelevant ?? false;
    const aiReason = aiResult?.aiReason ?? '';
    const isRelevant = row.keywordRelevant || isAiRelevant;
    const hasOrders = row.orders > 0;

    // Semi-relevant: fuzzy score >= 0.3 means at least some product words match
    const isSemiRelevant = !isRelevant && row.fuzzyScore >= 0.3;

    if (hasOrders && !row.acosExceeded) {
      // HAS ORDERS + ACOS OK → RELEVANT + CONVERTING
      bucket = 'relevant';
      if (row.keywordRelevant) {
        reason = `Keyword match: "${row.matchedKeyword}" | Orders: ${row.orders}`;
      } else if (isAiRelevant) {
        reason = `AI: ${aiReason} | Orders: ${row.orders}`;
      } else {
        reason = `Converting (${row.orders} orders) — kept as relevant`;
      }
    } else if (hasOrders && row.acosExceeded) {
      // HAS ORDERS BUT HIGH ACOS → WASTING
      bucket = 'wasting';
      const reasons = [];
      if (row.keywordRelevant) reasons.push(`Keyword: "${row.matchedKeyword}"`);
      else if (isAiRelevant) reasons.push(`AI: ${aiReason}`);
      else reasons.push(`Converting (${row.orders} orders)`);
      reasons.push(`ACOS ${row.acos.toFixed(1)}% > ${acosThreshold}%`);
      reason = reasons.join(' | ');
    } else if (isRelevant && row.hasZeroSales) {
      // RELEVANT BY KEYWORD/AI BUT ZERO ORDERS → WASTING
      bucket = 'wasting';
      const reasons = [];
      if (row.keywordRelevant) reasons.push(`Keyword: "${row.matchedKeyword}"`);
      else reasons.push(`AI: ${aiReason}`);
      if (row.spend >= spendThreshold) reasons.push(`Zero orders, $${row.spend.toFixed(2)} spent`);
      else reasons.push('Zero orders');
      reason = reasons.join(' | ');
    } else if (isSemiRelevant && row.hasZeroSales) {
      // PARTIALLY RELATED + ZERO ORDERS → SEMI-RELEVANT
      bucket = 'semi';
      const matchInfo = row.fuzzyWords.length > 0
        ? `Partial match: "${row.fuzzyWords.join('", "')}" (${Math.round(row.fuzzyScore * 100)}%)`
        : `Fuzzy score: ${Math.round(row.fuzzyScore * 100)}%`;
      reason = aiReason && !aiReason.includes('skipped') && !aiReason.includes('error')
        ? `AI: ${aiReason} | ${matchInfo}`
        : `${matchInfo} | Zero orders — review manually`;
    } else if (!isRelevant && row.hasZeroSales) {
      // NOT RELEVANT + ZERO ORDERS → IRRELEVANT (negative candidate)
      bucket = 'irrelevant';
      reason = aiReason && !aiReason.includes('skipped') && !aiReason.includes('error')
        ? `AI: ${aiReason}`
        : 'No keyword match, zero orders — negative candidate';
    } else if (isRelevant) {
      // RELEVANT (catch-all for edge cases)
      bucket = 'relevant';
      reason = row.keywordRelevant
        ? `Keyword match: "${row.matchedKeyword}"`
        : `AI: ${aiReason}`;
    } else {
      // Fallback
      bucket = 'irrelevant';
      reason = aiReason && !aiReason.includes('skipped') && !aiReason.includes('error')
        ? `AI: ${aiReason}`
        : 'No keyword match — negative candidate';
    }

    results.push({
      ...row,
      bucket,
      reason,
      aiRelevant: isAiRelevant,
      aiReason,
    });
  }

  return results;
}
