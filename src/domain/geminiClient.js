const MAX_GEMINI_SLOTS = 5;
let roundRobinCursor = 0;

function collectGeminiKeySlots(env = process.env, clientKeys = []) {
  const seen = new Set();
  const slots = [];

  const pushKey = (rawKey, sourceLabel) => {
    const k = String(rawKey || '').trim();
    if (!k || k.length < 10 || seen.has(k) || slots.length >= MAX_GEMINI_SLOTS) return;
    seen.add(k);
    slots.push({ slot: slots.length + 1, key: k, source: sourceLabel });
  };

  if (Array.isArray(clientKeys)) {
    clientKeys.slice(0, MAX_GEMINI_SLOTS).forEach((k, idx) => pushKey(k, `client_slot_${idx + 1}`));
  }
  for (let i = 1; i <= MAX_GEMINI_SLOTS; i++) {
    pushKey(env[`GEMINI_API_KEY_${i}`], `env_slot_${i}`);
  }
  pushKey(env.GEMINI_API_KEY, 'env_default');

  return {
    maxSlots: MAX_GEMINI_SLOTS,
    totalConfigured: slots.length,
    slots
  };
}

async function spinArticleWithGeminiPool({
  rawArticle,
  topic = 'Layanan Profesional',
  detectedLanguage = 'id',
  clientKeys = [],
  fetchImpl = globalThis.fetch
}) {
  const pool = collectGeminiKeySlots(process.env, clientKeys);
  if (!pool.totalConfigured || typeof fetchImpl !== 'function') {
    return {
      ok: false,
      usedSlot: null,
      totalConfigured: pool.totalConfigured,
      reason: pool.totalConfigured ? 'FETCH_UNAVAILABLE' : 'NO_GEMINI_KEYS_CONFIGURED',
      attempts: []
    };
  }

  const text = String(rawArticle || '').trim();
  if (!text) {
    return { ok: false, usedSlot: null, totalConfigured: pool.totalConfigured, reason: 'EMPTY_ARTICLE', attempts: [] };
  }

  const langHint =
    detectedLanguage === 'en'
      ? 'English'
      : detectedLanguage === 'mixed'
        ? 'Indonesian and English (keep each sentence in its original language)'
        : 'Indonesian';

  const prompt = [
    `You are an SEO Spintax expert. Convert the following article about "${topic}" into rich 2-level nested spintax using {option1|option2|option3} syntax in ${langHint}.`,
    'Rules:',
    '1. Preserve all facts, numbers, and any {{placeholder}} tokens intact.',
    '2. Spin both sentence structures and key phrases/synonyms naturally so generated articles stay unique.',
    '3. Output ONLY the spinned article text without markdown code fences or explanations.',
    '',
    'Article:',
    text
  ].join('\n');

  const startIdx = roundRobinCursor % pool.slots.length;
  roundRobinCursor = (roundRobinCursor + 1) % MAX_GEMINI_SLOTS;
  const deadline = Date.now() + 6500;

  const attempts = [];
  for (let offset = 0; offset < pool.slots.length; offset++) {
    if (Date.now() >= deadline) break;
    const slotObj = pool.slots[(startIdx + offset) % pool.slots.length];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(slotObj.key)}`;
      const resp = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        }),
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
      });

      if (!resp.ok) {
        attempts.push({ slot: slotObj.slot, status: resp.status, ok: false });
        continue;
      }

      const data = await resp.json();
      let candidateText =
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        Array.isArray(data.candidates[0].content.parts)
          ? data.candidates[0].content.parts.map((p) => p.text || '').join('').trim()
          : '';
      candidateText = candidateText.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/m, '').trim();

      if (candidateText && candidateText.includes('{') && candidateText.includes('|')) {
        attempts.push({ slot: slotObj.slot, status: 200, ok: true });
        return {
          ok: true,
          usedSlot: slotObj.slot,
          source: slotObj.source,
          model: 'gemini-2.5-flash',
          totalConfigured: pool.totalConfigured,
          spunArticleBody: candidateText,
          attempts
        };
      }
      attempts.push({ slot: slotObj.slot, status: 200, ok: false, reason: 'INVALID_SPINTAX_OUTPUT' });
    } catch (err) {
      attempts.push({ slot: slotObj.slot, status: 0, ok: false, reason: err.name || 'NETWORK_ERROR' });
    }
  }

  return {
    ok: false,
    usedSlot: null,
    totalConfigured: pool.totalConfigured,
    reason: 'ALL_SLOTS_FAILED_OR_RATE_LIMITED',
    attempts
  };
}

module.exports = {
  MAX_GEMINI_SLOTS,
  collectGeminiKeySlots,
  spinArticleWithGeminiPool
};
