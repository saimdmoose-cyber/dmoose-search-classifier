/**
 * Claude API utility — works in both dev and production.
 * Uses direct Anthropic API with browser access header (no proxy needed).
 * API key can come from .env OR from user input in the UI.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Runtime API key — can be set from .env or UI
let runtimeApiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

export function setApiKey(key) {
  runtimeApiKey = (key || '').trim();
}

export function getApiKey() {
  return runtimeApiKey;
}

export function hasApiKey() {
  return !!runtimeApiKey && runtimeApiKey !== 'your_api_key_here' && runtimeApiKey.length > 10;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function classifyWithClaude(searchTerms, productInfo, onProgress) {
  if (!hasApiKey()) {
    const results = new Map();
    for (const term of searchTerms) {
      results.set(term, {
        aiRelevant: false,
        aiReason: 'AI layer skipped — no API key configured',
      });
    }
    if (onProgress) onProgress(searchTerms.length, searchTerms.length);
    return results;
  }

  const batches = chunkArray(searchTerms, 50);
  const results = new Map();
  let processed = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const termList = batch
      .map((t, i) => `${i + 1}. "${t}"`)
      .join('\n');

    const prompt = `You are an Amazon PPC search term classifier. Given the product below, classify each search term as RELEVANT or IRRELEVANT.

PRODUCT:
${productInfo}

SEARCH TERMS:
${termList}

For each term, respond with EXACTLY this format (one per line):
[number]. [RELEVANT|IRRELEVANT] - [one short reason, max 10 words]

Example:
1. RELEVANT - matches product category exactly
2. IRRELEVANT - completely unrelated product type

Respond ONLY with the numbered list, nothing else.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per batch

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': runtimeApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          errMsg = errBody?.error?.message || errBody?.message || JSON.stringify(errBody);
        } catch {
          errMsg = await response.text().catch(() => errMsg);
        }

        if (response.status === 401) {
          throw new Error('Invalid API key. Check your Anthropic API key.');
        } else if (response.status === 429) {
          throw new Error('Rate limited. Wait a moment and try again.');
        } else {
          throw new Error(`Claude API error: ${errMsg}`);
        }
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const match = line.match(/^(\d+)\.\s*(RELEVANT|IRRELEVANT)\s*[-—]\s*(.+)/i);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          if (idx >= 0 && idx < batch.length) {
            results.set(batch[idx], {
              aiRelevant: match[2].toUpperCase() === 'RELEVANT',
              aiReason: match[3].trim(),
            });
          }
        }
      }

      // Fill in any terms that didn't get parsed
      for (const term of batch) {
        if (!results.has(term)) {
          results.set(term, {
            aiRelevant: false,
            aiReason: 'Could not classify (AI response parse error)',
          });
        }
      }
    } catch (err) {
      const errMsg = err.name === 'AbortError'
        ? 'Request timed out (30s). Try with fewer terms.'
        : err.message;

      for (const term of batch) {
        if (!results.has(term)) {
          results.set(term, {
            aiRelevant: false,
            aiReason: `AI error: ${errMsg}`,
          });
        }
      }
    }

    processed += batch.length;
    if (onProgress) {
      onProgress(processed, searchTerms.length);
    }
  }

  return results;
}
