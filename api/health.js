'use strict';

/**
 * GET /api/health
 * 앱이 "AI 서버가 있나?"를 확인하는 엔드포인트.
 * { ok:true, tts:false, save:false } 를 돌려주면 앱이 카메라 버튼을 켠다.
 */
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  res.status(200).json({ ok: true, tts: false, save: false });
};
