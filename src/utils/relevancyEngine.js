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
 * Layer 1b: Fuzzy/Partial Keyword Match
 * Checks how many product-related words appear in the search term.
 * Returns a relevance score 0-1 (0% to 100%).
 *
 * CLASSIFICATION THRESHOLDS:
 *   >= 70% match  => RELEVANT (goes to Relevant or Wasting depending on orders)
 *   <  70% match  => IRRELEVANT (negative candidate)
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
 * NEW CLASSIFICATION LOGIC (3 buckets only):
 *
 *   relevant   - keyword match (exact or >=70% fuzzy) AND has orders (ACOS OK)
 *                OR has orders with high ACOS but still relevant
 *   wasting    - keyword match (exact or >=70% fuzzy) BUT zero orders
 *                OR relevant with orders but ACOS exceeded threshold
 *   irrelevant - <70% fuzzy match = no meaningful relation (negative candidates)
 *
 * RELEVANCY THRESHOLD: 70%
 *   >= 70% word match from product keywords  =>  considered RELEVANT
 *   <  70% word match                        =>  considered IRRELEVANT
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

  const RELEVANCY_THRESHOLD = 0.70; // 70% match = relevant

  // === LAYER 1: Keyword Match ===
  if (onLayerUpdate) onLayerUpdate('Layer 1: Keyword Match - scanning target keywords...');

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
  if (onLayerUpdate) onLayerUpdate('Layer 2: Zero Sales Filter - flagging zero-order terms...');

  const zeroSalesResults = keywordResults.map(row => ({
    ...row,
    hasZeroSales: zeroSalesFilter(row),
  }));

  // === LAYER 3: ACOS Filter ===
  if (onLayerUpdate) onLayerUpdate('Layer 3: ACOS Filter - checking ACOS thresholds...');

  const acosResults = zeroSalesResults.map(row => ({
    ...row,
    acosExceeded: acosFilter(row, acosThreshold),
  }));

  // === LAYER 4: AI Classification ===
  const apiAvailable = hasApiKey();
  if (apiAvailable) {
    if (onLayerUpdate) onLayerUpdate('Layer 4: AI Classification - sending to Claude API...');
  } else {
    if (onLayerUpdate) onLayerUpdate('Layer 4: AI Classification - skipped (no API key). Using fuzzy matching.');
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
    const hasOrders = row.orders > 0;
    const matchPct = Math.round(row.fuzzyScore * 100);

    // Determine relevancy: exact keyword match OR AI says relevant OR >= 70% fuzzy match
    const isExactMatch = row.keywordRelevant;
    const isHighFuzzy = row.fuzzyScore >= RELEVANCY_THRESHOLD;
    const isRelevant = isExactMatch || isAiRelevant || isHighFuzzy;

    // Build match info string for reasons
    const matchedWordsStr = row.fuzzyWords.length > 0
      ? `"${row.fuzzyWords.join('", "')}"`
      : '';

    if (isRelevant && hasOrders && !row.acosExceeded) {
      // ✅ RELEVANT + CONVERTING: relevant + has orders + ACOS OK
      bucket = 'relevant';
      if (isExactMatch) {
        reason = `Keyword match: "${row.matchedKeyword}" | Orders: ${row.orders}`;
      } else if (isAiRelevant) {
        reason = `AI: ${aiReason} | Orders: ${row.orders}`;
      } else {
        reason = `Partial match: ${matchedWordsStr} (${matchPct}%) | Orders: ${row.orders}`;
      }

    } else if (isRelevant && hasOrders && row.acosExceeded) {
      // ⚠️ WASTING: relevant + has orders but ACOS too high
      bucket = 'wasting';
      if (isExactMatch) {
        reason = `Keyword: "${row.matchedKeyword}" | ACOS ${row.acos.toFixed(1)}% > ${acosThreshold}% | Orders: ${row.orders}`;
      } else if (isAiRelevant) {
        reason = `AI: ${aiReason} | ACOS ${row.acos.toFixed(1)}% > ${acosThreshold}%`;
      } else {
        reason = `Partial match: ${matchedWordsStr} (${matchPct}%) | ACOS ${row.acos.toFixed(1)}% > ${acosThreshold}%`;
      }

    } else if (isRelevant && !hasOrders) {
      // ⚠️ WASTING: relevant (>=70% or exact keyword) but ZERO orders
      bucket = 'wasting';
      if (isExactMatch) {
        reason = `Keyword: "${row.matchedKeyword}" | Zero orders - review manually`;
      } else if (isAiRelevant) {
        reason = `AI: ${aiReason} | Zero orders - review manually`;
      } else {
        reason = `Partial match: ${matchedWordsStr} (${matchPct}%) | Zero orders - review manually`;
      }

    } else {
      // ❌ IRRELEVANT: <70% match = not related to product (negative candidate)
      bucket = 'irrelevant';
      if (aiReason && !aiReason.includes('skipped') && !aiReason.includes('error')) {
        reason = `AI: ${aiReason}`;
      } else if (row.fuzzyWords.length > 0) {
        reason = `Low match: ${matchedWordsStr} (${matchPct}%) | Below 70% threshold - negative candidate`;
      } else {
        reason = 'No keyword match (0%) - negative candidate';
      }
    }

    results.push({
      ...row,
      bucket,
      reason,
      aiRelevant: isAiRelevant,
      aiReason,
      matchPct,
    });
  }

  return results;
}
