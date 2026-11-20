'use strict';

/**
 * POST /api/verify
 * body: { image: <base64 JPEG>, name: '양말', word: '양말' }
 * 응답: { match: true|false, seen: '사진 속 주된 물건' }
 *
 * 아이가 집에서 같은 물건을 찾아 찍었을 때, 정말 그 물건이 사진에 있는지만 본다.
 */
const { generate, readBody, cleanPhoto, oneLine, sendError } = require('./_gemini');

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    match: { type: 'BOOLEAN' },
    seen: { type: 'STRING' }
  },
  required: ['match', 'seen']
};

function safeLabel(v) {
  return oneLine(v, 24).replace(/["'`\\]/g, '');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = readBody(req);
  const photo = cleanPhoto(body.image);
  if (!photo) {
    res.status(400).json({ error: 'bad_image' });
    return;
  }
  if (photo.data.length > 6000000) {
    res.status(413).json({ error: 'image_too_large' });
    return;
  }

  const name = safeLabel(body.name) || '물건';
  const word = safeLabel(body.word) || name;
  const prompt = '이 사진에 "' + name + '"(' + word + ')이(가) 있어? 장난감이나 그림이어도 괜찮아. ' +
    '사진 속에 그 물건이 조금이라도 알아볼 수 있게 있으면 match를 true로 해. 다른 물건이거나 알아볼 수 없으면 false로 해. ' +
    'JSON만 답해: {"match":true 또는 false,"seen":"사진 속 주된 물건의 한국어 이름"}';

  const r = await generate({
    parts: [{ text: prompt }, { inline_data: photo }],
    schema: SCHEMA,
    timeoutMs: 9000,
    temperature: 0
  });
  if (r.error) {
    sendError(res, r.error);
    return;
  }

  const d = r.data || {};
  res.status(200).json({ match: d.match === true, seen: oneLine(d.seen, 60), model: r.model });
};
