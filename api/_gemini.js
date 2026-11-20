'use strict';

/**
 * Gemini 호출 공통 모듈 (api/_gemini.js 처럼 밑줄로 시작하면 Vercel이 함수로 배포하지 않는다).
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

// 2026-11 기준: gemini-2.5-flash는 신규 사용자에게 404로 막혀 있고,
// 3.8-flash / 3.5-flash 는 응답이 몰릴 때가 많다. 가볍고 빠른 flash-lite를 먼저 쓴다.
const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview'
];

function models() {
  const override = (process.env.GEMINI_MODEL || '').trim();
  const list = override ? [override].concat(DEFAULT_MODELS) : DEFAULT_MODELS.slice();
  return list.filter(function (m, i) { return m && list.indexOf(m) === i; });
}

function apiKey() {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  return key;
}

function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch (e) { return {}; }
  }
  return b;
}

function cleanPhoto(image) {
  if (typeof image !== 'string' || !image) return null;
  let mime = 'image/jpeg';
  let data = image;
  const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(image.trim());
  if (m) { mime = m[1]; data = m[2]; }
  data = data.replace(/\s+/g, '');
  if (data.length < 64) return null;
  return { mimeType: mime, data: data };
}

function oneLine(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function parseJson(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) { /* 아래에서 한 번 더 시도 */ }
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s > -1 && e > s) {
    try { return JSON.parse(t.slice(s, e + 1)); } catch (e2) { /* 실패 */ }
  }
  return null;
}

/**
 * 모델을 차례로 시도한다. 404(모델 없음) / 429 / 5xx / 타임아웃이면 다음 모델로 넘어간다.
 * 성공하면 모델이 만든 JSON(object)을, 전부 실패하면 { error: 'rate_limited' | 'upstream' } 를 돌려준다.
 */
async function generate({ parts, schema, timeoutMs, temperature }) {
  const key = apiKey();
  if (!key) return { error: 'no_key' };

  const deadline = Date.now() + (timeoutMs || 8000);
  let lastStatus = 0;
  let sawRateLimit = false;

  for (const model of models()) {
    const budget = Math.min(deadline - Date.now(), timeoutMs || 8000);
    if (budget < 800) break;

    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, budget);
    try {
      const body = {
        contents: [{ role: 'user', parts: parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: typeof temperature === 'number' ? temperature : 0.2
        }
      };
      // thinkingConfig(thinkingBudget:0)는 이 모델들에서 400 INVALID_ARGUMENT가 나므로 넣지 않는다.
      const r = await fetch(API_ROOT + '/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      lastStatus = r.status;
      const text = await r.text();
      if (!r.ok) {
        if (r.status === 429) sawRateLimit = true;
        console.log('[gemini] ' + model + ' http ' + r.status + ' ' + text.slice(0, 300));
        continue;
      }
      let payload;
      try { payload = JSON.parse(text); } catch (e) { console.log('[gemini] bad json envelope'); continue; }
      const cand = payload && payload.candidates && payload.candidates[0];
      const out = cand && cand.content && cand.content.parts &&
        cand.content.parts.map(function (p) { return p.text || ''; }).join('');
      const obj = parseJson(out);
      if (!obj) {
        console.log('[gemini] ' + model + ' unparseable: ' + String(out).slice(0, 300));
        continue;
      }
      return { data: obj, model: model };
    } catch (err) {
      lastStatus = lastStatus || 0;
      console.log('[gemini] ' + model + ' failed: ' + (err && err.message));
    } finally {
      clearTimeout(timer);
    }
  }

  return { error: sawRateLimit || lastStatus === 429 ? 'rate_limited' : 'upstream' };
}

function sendError(res, error, note) {
  if (error === 'no_key') {
    res.status(500).json({ error: 'no_key', message: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
    return;
  }
  if (error === 'rate_limited') {
    res.setHeader('Retry-After', '20');
    res.status(429).json({ error: 'rate_limited' });
    return;
  }
  res.status(502).json({ error: 'upstream', message: note || 'AI 응답을 받지 못했습니다.' });
}

module.exports = { generate, readBody, cleanPhoto, oneLine, sendError, apiKey };
