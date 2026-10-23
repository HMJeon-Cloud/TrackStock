// v12.39 Claude API 작업들 — /api/channel?op=claude (POST, 운영자 전용). 새 서버 함수 없음.
//   task: analyst(애널리스트 끝까지 분석) · inspect(검사관 재검토) · check(발행 전 검수) · why(핵심 이슈 '왜') · plan(오늘 편성 + 주간 기획)
//   공통 규칙: 앱 숫자가 근거, 지어내지 않기, 웹에서 보완한 사실은 출처와 함께. 권유·목표가·과장 금지.
//   비용 보호: 하루 상한 CLAUDE_DAILY_MAX(기본 60, 작업 1회 = 1) · 작업별 출력 토큰·웹 검색 횟수 상한
//   모델: ANTHROPIC_MODEL(기본 claude-sonnet-5-5) = 깊은 작업 / ANTHROPIC_FAST_MODEL(기본 claude-haiku-5-5) = 검수·요약
import { redisConf, redisCmd } from "./_redis.js";

const BASE = `너는 한국 투자 데이터 계정 '우상향연구소(@uphill.lab)'와 분석 앱 StockMind의 수석 리서처다. 독자는 한국 개인투자자 초보.
공통 규칙: (1) 앱(StockMind)이 준 숫자가 1순위 근거 — 그대로 인용하고 지어내지 않는다. (2) 웹에서 찾은 사실은 날짜·출처를 붙이고, 확실하지 않으면 쓰지 않는다. (3) 매수·매도 권유, 목표가 제시, 수익 보장, 과장 금지. 판단은 '근거와 조건'으로 말한다. (4) 오늘 날짜 기준으로 최신 상황을 우선한다.`;

const TASKS = {
  analyst: {
    tier: "main", web: 6, max: 16000, timeout: 280000,
    system: BASE + `
이번 작업: 증권사 리서치 팀장처럼 '끝까지' 분석한다. 허술한 요약은 실패다. 반드시:
- 분석을 시작하기 전에 세운 '출발 가설'과 그걸 검증하려고 무엇을 봤는지, 어떤 근거에 무게를 뒀고 어디서 생각이 바뀌었는지를 투명하게 쓴다(=어떤 방향·생각으로 이 결론이 나왔는지).
- 앱 데이터의 빈칸(데이터 없음)은 웹 검색으로 최신 공시·실적·뉴스를 찾아 보완하고 출처를 단다. 찾지 못하면 '확인 못 함'이라고 쓴다.
- 숫자 하나하나를 '그래서 무슨 뜻인가'로 해석한다(업종 평균·과거 자기 수준·경쟁사와 비교).
- 가장 강한 반론 3개를 찾아 정면으로 답하고, 반론이 더 강하면 결론을 바꾼다.
- 실패 시나리오(6개월 뒤 -30%라면 원인 3개·조기 경고 신호)와 '생각을 바꿀 조건' 3개를 숫자·사건으로 딱 잘라 쓴다.
- 결론은 행동 수준(검토·관망·분할·비중 조절 등)과 그 조건으로 말한다. 단정적 권유는 하지 않는다.
- 서술형 첫 문단은 【사고 과정】, 마지막 바로 앞 문단은 【실패 시나리오】로 쓴다.
사용자 메시지의 '답변 형식'(## 서술형 / ## 카드형)을 정확히 지킨다. 형식 외 머리말·인사 금지.`
  },
  inspect: {
    tier: "main", web: 2, max: 10000, timeout: 240000,
    system: BASE + `
이번 작업: 방금 나온 분석을 검사관으로서 재검토한다. 숫자·날짜·단위·증감률을 다시 계산하고, [앱 데이터]와 다르거나 출처 없는 숫자를 찾고, 논리 비약·과장을 찾는다.
출력 형식(그대로):
## 검토 결과
(고친 것이 없으면 '확인된 수정 사항 없음' 한 줄. 있으면 '원래 → 수정 → 근거' 줄 목록)
## 카드형
(수정을 반영한 카드형 블록 전체를 원래 형식 그대로 다시 — 제목·한 줄·항목·종합·반론·보완·리스크·확인할 것·출처)`
  },
  check: {
    tier: "fast", web: 0, max: 2500, timeout: 90000,
    system: BASE + `
이번 작업: SNS 업로드 직전 검수. [카드 글자]와 [캡션]을 비교해 다음을 찾는다: 카드와 캡션의 숫자 불일치, 부호·단위 오류, 날짜 불일치, 매수·매도 권유로 읽히는 문장, 과장·단정, 맞춤법·오탈자, 해시태그 문제, 500자 초과(스레드).
출력: JSON 하나만 {"ok":true|false,"summary":"한 줄","issues":[{"where":"카드|인스타|스레드|답글1|답글2","level":"고침|권장","problem":"무엇이 문제","fix":"이렇게 고치기"}]}`
  },
  why: {
    tier: "main", web: 5, max: 4000, timeout: 200000,
    system: BASE + `
이번 작업: 오늘 시장의 '핵심 이슈' 목록마다 '왜 그렇게 움직였는지'를 한 줄로 찾는다. 주어진 [후보 기사]를 먼저 보고, 부족하면 웹 검색한다. 확실한 이유가 없으면 why를 빈 문자열로 둔다(추측 금지).
출력: JSON 하나만 {"items":[{"i":번호,"why":"이유 한 줄(60자 이하)","src":"출처 이름","url":"출처 주소 또는 빈칸","conf":"상|중|하"}],"note":"전체 흐름 한 줄"}`
  },
  report: {
    tier: "main", web: 4, max: 7000, timeout: 240000,
    system: BASE + `
이번 작업: 앱이 계산한 리포트(질문·상황·Exhibit 증거·시나리오 빈도·규칙 의견·기사)를 증권사 리서치 노트처럼 다시 쓴다. 숫자는 근거 줄 그대로만.
- 숫자 뒤의 속사정(왜 이렇게 됐나)은 근거 줄의 기사와, 필요하면 웹 검색(최근 2주)으로 보강하고 언론사·날짜를 붙인다.
- 규칙 의견(stance)이 근거와 맞지 않으면 그대로 따르지 말고 왜 다르게 보는지 thinking에 밝힌다.
- thinking = 이 결론이 나온 생각의 흐름(출발 가설 → 무게를 둔 증거 → 반대 근거와 답 → 생각이 바뀐/굳어진 지점) 4~6문장.
출력: JSON 하나만 {"headline":"24자 이하","situation":"2~3문장","thinking":"…","narrative":"4~5문단(빈 줄로 구분): 한 줄로 → 숫자가 말하는 것 → 숫자 뒤의 속사정 → 양쪽 의견을 겹쳐 보면 → 그래서","interpretation":["Exhibit마다 한 줄(60자 이하)"],"opinion":"3~4문장, 행동 표현(검토·관망·나눠서)","forecast":{"회복":"","횡보":"","추가 하락":""},"plan":["행동안 3~4개"],"watch":["생각을 바꿀 조건 3~4개(숫자·사건)"],"added":["웹에서 보완한 사실 — 출처"]}`
  },
  retro: {
    tier: "main", web: 0, max: 6000, timeout: 200000,
    system: BASE + `
이번 작업: 우리가 저장한 과거 분석들과 그 뒤 실제 결과(가격 변화·적중 여부)를 읽고 '우리가 자주 틀리는 패턴'을 찾는다. 표본이 적으면 그렇다고 말하고 과잉 일반화하지 않는다.
- 패턴마다 근거가 된 기록(종목·날짜·판정→결과)을 짧게 인용하고, 다음 분석에서 바꿀 규칙을 한 문장으로 제안한다.
- 잘 맞은 패턴도 찾는다(계속 지킬 것).
출력: JSON 하나만 {"summary":"한 줄","stats":"표본·적중 요약 한 줄","miss":[{"pattern":"자주 틀린 패턴","evidence":"근거 기록","fix":"바꿀 규칙"}],"keep":[{"pattern":"잘 맞은 패턴","evidence":""}],"rules":["다음 분석 프롬프트에 넣을 주의 문장(40자 이하) 3~6개"]}`
  },
  anomaly: {
    tier: "main", web: 4, max: 3000, timeout: 180000,
    system: BASE + `
이번 작업: 데이터 점검에서 걸린 종목(마지막 날짜가 늦음·하루 급변)의 원인을 확인한다. 후보: 그 시장 휴장, 액면분할·병합, 상장폐지·거래정지, 심볼 변경, 데이터 제공처(야후) 지연·오류, 실제 급변(실적·이벤트). 웹으로 확인하고 확실하지 않으면 '확인 못 함'.
출력: JSON 하나만 {"items":[{"sym":"","cause":"원인 한 줄","kind":"휴장|분할|상장폐지|거래정지|심볼변경|야후지연|실제급변|확인못함","action":"운영자가 할 일 한 줄(예: 기다리면 됨·과거 데이터 다시 받기·목록에서 빼기)","src":"출처 이름","url":"","conf":"상|중|하"}],"note":"전체 한 줄"}`
  },
  review: {
    tier: "main", web: 3, max: 8000, timeout: 240000,
    system: BASE + `
이번 작업: 사용자 메시지에 적힌 검토 지시(팩트체크·검사관·실패 시나리오·아침 브리핑 등)를 그대로 수행한다. 사용자가 정한 출력 형식(## 서술형 / ## 카드형 등)을 정확히 지킨다. 웹에서 확인한 사실은 출처·날짜를 붙인다.`
  },
  plan: {
    tier: "main", web: 4, max: 6000, timeout: 240000,
    system: BASE + `
이번 작업: 오늘 계정에 올릴 카드와 볼 리포트를 편성한다. 목표 = 노출(저장·공유·댓글·팔로우). 앱이 준 [주제 후보](ctx·점수·선정 이유), [리포트 후보], [오늘 이슈], [오늘 기사]를 보고, 필요하면 웹 검색으로 오늘 한국·미국 시장의 화제를 확인한다.
- 오늘 화제와 연결되는 주제를 우선, 같은 이야기를 여러 장으로 반복하지 않는다. 화제가 많으면 10개를 넘겨도 된다(최대 16).
- 각 선택에 '왜 오늘'과 첫 줄 훅(30자 이하)을 붙인다. 순서는 올리기 좋은 순서(아침·점심·저녁 흐름).
- 앱 후보에 없지만 오늘 꼭 다룰 화제가 있으면 extra에 아이디어와 필요한 데이터로 적는다(앱에 없는 숫자는 만들지 말 것).
- 이번 주 남은 요일의 연재 기획(week)도 3~5개.
출력: JSON 하나만 {"summary":"오늘 시장 한 줄","picks":[{"ctx":"주제 ctx 그대로","why":"왜 오늘","hook":"첫 줄","slot":"아침|점심|저녁"}],"reports":[{"id":"리포트 후보 id 그대로","why":"왜"}],"extra":[{"title":"","idea":"","data":""}],"week":[{"day":"요일","title":"","hook":"","ctx":"있으면 ctx"}]}`
  }
};

function kstDay() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) : s; }
function pickJson(text) { const a = text.indexOf("{"), b = text.lastIndexOf("}"); if (a < 0 || b <= a) return null; try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { return null; } }

export async function claudeHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" });
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const T = body && TASKS[body.task];
  if (!T || !body.input) return res.status(400).json({ ok: false, reason: "task·input 필요" });
  const model = T.tier === "fast" ? (process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5") : (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  const max = +(process.env.CLAUDE_DAILY_MAX || 60), web = T.web && process.env.COPY_WEB !== "0" && body.web !== false;
  const rc = redisConf(), dayKey = "sm:claude:" + kstDay(); let used = 0;
  if (rc) { try { used = +(await redisCmd(rc, ["INCR", dayKey])) || 0; if (used === 1) await redisCmd(rc, ["EXPIRE", dayKey, String(3 * 86400)]); } catch (e) {} }
  if (used > max) return res.status(200).json({ ok: false, reason: "DAILY_MAX", msg: "오늘 Claude 작업 횟수(" + max + "회)를 다 썼어요 — CLAUDE_DAILY_MAX로 늘릴 수 있어요" });
  const payload = { model, max_tokens: T.max, system: T.system, messages: [{ role: "user", content: "오늘: " + kstDay() + " (한국 시간)\n\n" + clip(body.input, 60000) }] };
  if (web) payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: T.web, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }];
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), T.timeout);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return res.status(200).json({ ok: false, reason: "API_" + r.status, msg: clip(j && j.error && j.error.message, 240) });
    const blocks = j.content || [], text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
    const src = [], seen = {};
    blocks.forEach((b) => { (b.citations || []).forEach((c) => { if (c.url && !seen[c.url]) { seen[c.url] = 1; src.push({ t: clip(c.title, 90), u: c.url }); } }); });
    const searches = blocks.filter((b) => b.type === "server_tool_use").map((b) => b.input && b.input.query).filter(Boolean);
    const out = { ok: true, task: body.task, model, text, sources: src.slice(0, 12), searches, used, max, stop: j.stop_reason, usage: j.usage || null };
    if (body.json) { out.data = pickJson(text); if (!out.data) { out.ok = false; out.reason = "PARSE"; out.msg = "AI 응답을 읽지 못했어요"; out.text = clip(text, 600); } }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ ok: false, reason: e.name === "AbortError" ? "TIMEOUT" : "ERROR", msg: e.name === "AbortError" ? "시간이 너무 걸려 멈췄어요 — 범위를 줄이거나(이 틀만) 다시 시도해 주세요" : clip(e.message, 160) });
  } finally { clearTimeout(tm); }
}
