// routes/ai-complete.js
// CommonJS-compatible route that dynamically imports the ESM-only @google/genai SDK
// so you don't need to convert your whole project to ESM.

require('dotenv').config(); // optional local .env (make sure .env is gitignored)

const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
router.use(express.json({ limit: '64kb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
});
router.use(limiter);

// Credentials
const GEMINI_API_KEY ='AIzaSyAO_2lmTX3vFqC7cBe3kwbFdrBr0ym4Vwc';
const GOOGLE_ADC = process.env.GOOGLE_APPLICATION_CREDENTIALS || null;

// SDK holders (will be set after dynamic import)
let GoogleGenAI = null;
let aiClient = null;
let sdkInitError = null;
let sdkInitialized = false;

// Async init: dynamic import the ESM SDK and initialize the client
(async () => {
  try {
    const genaiModule = await import('@google/genai');
    GoogleGenAI = genaiModule.GoogleGenAI;

    if (GEMINI_API_KEY) {
      aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      console.log('[ai-complete] Initialized GoogleGenAI with GEMINI_API_KEY');
    } else {
      aiClient = new GoogleGenAI();
      console.log('[ai-complete] Initialized GoogleGenAI via ADC (if configured)');
    }
    sdkInitialized = true;
  } catch (err) {
    sdkInitError = err;
    console.error('[ai-complete] Failed to import/init @google/genai SDK:', err && (err.stack || err.message || err));
    // keep sdkInitialized false; route will respond with error or fallback until fixed
  }
})();

// helper: prompt builder
// ⭐️ CHANGED: Updated prompt for better "ghost text" style completions
function buildPrompt({ language, prefix, suffix, filename }) {
  return `You are a code completion assistant. Provide ONLY the text that should be inserted at the cursor.

Return a JSON array with objects containing:
- "label": short title
- "insertText": exact code to insert
- "documentation": brief explanation

Language: ${language}
File: ${filename}

Code before cursor:
${prefix.slice(-1000)}

Code after cursor:
${suffix.slice(0, 500)}

Provide only valid JSON:`;
}

// ----- robust parsing helpers -----
function tryParseJsonArray(text) {
  if (!text || typeof text !== 'string') return null;

  // 1) direct parse
  try {
    const p = JSON.parse(text);
    if (Array.isArray(p)) return p;
  } catch (e) {}

  // 2) strip triple-backtick fenced blocks (```json ... ``` or ``` ... ```)
  const strippedFence = text.replace(/```(?:json)?\n?([\s\S]*?)```/gi, '$1').trim();

  // 3) try parse stripped text
  try {
    const p2 = JSON.parse(strippedFence);
    if (Array.isArray(p2)) return p2;
  } catch (e) {}

  // 4) extract first JSON array-looking substring like "[ ... ]"
  const first = strippedFence.indexOf('[');
  const last = strippedFence.lastIndexOf(']');
  if (first >= 0 && last > first) {
    const sub = strippedFence.slice(first, last + 1);
    try {
      const p3 = JSON.parse(sub);
      if (Array.isArray(p3)) return p3;
    } catch (e) {}
  }

  // 5) handle double-encoded strings: if the model returned a JSON string containing JSON
  try {
    const unescaped = JSON.parse(text);
    if (typeof unescaped === 'string' && unescaped !== text) {
      return tryParseJsonArray(unescaped);
    }
  } catch (e) {}

  return null;
}

// route
router.post('/', async (req, res) => {
  try {
    console.log('[ai-complete] incoming POST, sdkInitialized=', sdkInitialized, 'sdkInitError=', !!sdkInitError);
    console.log('[ai-complete] request body keys:', Object.keys(req.body || {}), 'prefixLen=', (req.body?.prefix || '').length);

    // If the SDK previously failed init, surface error
    if (sdkInitError) {
      console.error('[ai-complete] SDK initialization previously failed:', sdkInitError);
      return res.status(500).json({ error: 'ai_sdk_init_failed', message: String(sdkInitError.message || sdkInitError) });
    }

    // If SDK still initializing, provide a friendly dev fallback (so client can be tested).
    // In production you might prefer to return 503 to force retry.
    if (!sdkInitialized || !aiClient) {
      console.warn('[ai-complete] SDK not initialized; returning dev fallback suggestion');
      return res.json({
        suggestions: [
          {
            label: 'dev: console.log',
            insertText: "console.log('dev fallback');",
            documentation: 'Dev fallback from server while SDK unavailable',
            detail: 'dev-fallback'
          }
        ]
      });
    }

    const { language = 'plaintext', prefix = '', suffix = '', filename = 'file' } = req.body || {};
    if (typeof prefix !== 'string') return res.status(400).json({ error: 'prefix required' });

    const prompt = buildPrompt({ language, prefix, suffix, filename });

    // call the model (gemini-2.5-flash)
    const resp = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      temperature: 0.15,
      maxOutputTokens: 256,
    });

    // Extract raw text defensively (SDK shapes may vary)
    let raw = '';
    try {
      if (typeof resp === 'string') {
        raw = resp;
      } else if (resp && typeof resp.text === 'string') {
        raw = resp.text;
      } else if (resp && resp.output) {
        raw = typeof resp.output === 'string' ? resp.output : JSON.stringify(resp.output);
      } else {
        raw = JSON.stringify(resp || '');
      }
    } catch (e) {
      raw = String(resp || '');
    }

    // ----- robust parsing of model output into suggestions -----
    let suggestions = [];
    const parsedArray = tryParseJsonArray(raw);

    if (Array.isArray(parsedArray)) {
      suggestions = parsedArray
        .filter(s => s && typeof s.insertText === 'string') // Ensure suggestion is valid
        .map(s => ({
          label: String(s.label || 'suggestion').slice(0, 200),
          insertText: String(s.insertText).slice(0, 5000),
          documentation: String(s.documentation || '').slice(0, 1000),
        }))
        .slice(0, 4);
    } else {
      console.warn('[ai-complete] Failed to parse JSON array from model response. Raw:', raw);
      // Return empty array to prevent sending garbled text to the client
    }

    return res.json({ suggestions });
  } catch (err) {
    console.error('[ai-complete] Error handling request:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

module.exports = router
