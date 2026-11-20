# 말모이 도감 서버리스 API (Vercel)

앱(`index.html`)이 `window.claude` 없이(외부 웹사이트로 열렸을 때) 진짜 카메라 AI 인식을 쓰기 위해 호출하는 엔드포인트입니다.

| 엔드포인트 | 메서드 | 요청 | 응답 |
| --- | --- | --- | --- |
| `/api/health` | GET | – | `{ "ok": true, "tts": false, "save": false }` |
| `/api/recognize` | POST | `{ image, level, age }` | `{ seen, word, alt, emoji, confidence }` |
| `/api/verify` | POST | `{ image, name, word }` | `{ match, seen }` |

- `image`는 `data:image/jpeg;base64,` 접두어가 있어도 되고 없어도 됩니다(앱은 접두어 없이 보냅니다).
- 사진은 Gemini에 한 번 보내 낱말을 알아보는 데만 쓰고, 서버에도 저장하지 않습니다(`save:false`).
- 필요한 환경변수: `GEMINI_API_KEY` (필수), `GEMINI_MODEL` (선택, 기본 `gemini-3.5-flash-lite`).
- 키는 절대 저장소에 커밋하지 마세요. Vercel 프로젝트 → Settings → Environment Variables에만 넣습니다.
- 2026-11 기준 `gemini-2.5-flash`는 신규 사용자에게 404로 막혀 있어, `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3-flash-preview` 순으로 자동 재시도합니다.
