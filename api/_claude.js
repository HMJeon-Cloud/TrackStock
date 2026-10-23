// v12.39 Claude API 작업들 — /api/channel?op=claude (POST, 운영자 전용). 새 서버 함수 없음.
//   task: daily(오늘 브리핑+편성+리포트 선정 — 하루 한 번) · analyst(애널리스트 끝까지 분석) · inspect(검사관 재검토) · check(발행 전 검수) · report(리포트 서술) · anomaly · retro · review
//   brief · why · plan · rpick 은 v12.46부터 daily 하나로 합쳐졌고(같은 기사를 세 번 읽던 낭비), 옛 화면 호환용으로만 남겨 둔다
//   공통 규칙: 앱 숫자가 근거, 지어내지 않기, 웹에서 보완한 사실은 출처와 함께. 권유·목표가·과장 금지.
//   비용 보호: 하루 상한 CLAUDE_DAILY_MAX(기본 60, 작업 1회 = 1) · 작업별 출력 토큰·웹 검색 횟수 상한
//   모델: ANTHROPIC_MODEL(기본 claude-sonnet-5-5) = 깊은 작업 / ANTHROPIC_FAST_MODEL(기본 claude-haiku-5-5) = 검수·요약
import { redisConf, redisCmd, setJsonGz, getJsonGzText } from "./_redis.js";

const BASE = `너는 한국 투자 데이터 계정 '우상향연구소(@uphill.lab)'와 분석 앱 StockMind의 수석 리서처다. 독자는 한국 개인투자자 초보.
공통 규칙: (1) 앱(StockMind)이 준 숫자가 1순위 근거 — 그대로 인용하고 지어내지 않는다. (2) 웹에서 찾은 사실은 날짜·출처를 붙이고, 확실하지 않으면 쓰지 않는다. (3) 매수·매도 권유, 목표가 제시, 수익 보장, 과장 금지. 판단은 '근거와 조건'으로 말한다. (4) 오늘 날짜 기준으로 최신 상황을 우선한다.
글 품질 기준(v12.43): (5) 문장마다 '무엇이(사건·발표·수치) → 얼마나(앱 숫자) → 그래서(의미)' 중 최소 둘이 들어가야 한다. (6) 근거 없는 상투어 금지 — '투자심리 개선/위축', '불확실성 확대', '관망세', '차익실현 매물', '기대감 유입', '수급 개선'은 그 말을 뒷받침하는 구체 사건·숫자를 같은 문장에 쓸 때만 허용. (7) 숫자는 앱이 준 표기 그대로(소수점·부호·단위·% 와 %p 구분). 웹에서 가져온 숫자는 같은 문장에 출처 이름을 붙인다. (8) 확신 표시 conf: 상 = 공식 발표·공시 또는 서로 다른 출처 2곳 이상 / 중 = 믿을 만한 언론 1곳 / 하 = 정황상 추정. '하'는 되도록 빈칸으로 둔다. (10) JSON으로 답하라는 작업이면: 검색이 끝난 뒤 마지막에 JSON 하나만 쓰고 앞뒤에 설명·코드 블록을 붙이지 않는다. 문자열 안에서는 큰따옴표 대신 ‘ ’를 쓰고 줄바꿈을 넣지 않는다. 각 문장은 짧게 — 길이 제한을 지켜 답이 끊기지 않게 한다. (9) 출력 전에 스스로 점검: 숫자가 입력과 같은가, 날짜가 오늘 기준 맞는가(어제·지난주 일을 오늘 일로 쓰지 않았는가), 권유로 읽히는 문장이 없는가 — 틀린 게 있으면 고친 뒤 출력한다.`;

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
    tier: "main", web: 5, max: 8000, timeout: 200000,
    system: BASE + `
이번 작업: 오늘 시장의 '핵심 이슈' 목록을 초보도 이해하게 강화한다. 이슈마다 세 가지: 왜(원인 — 주어진 [후보 기사]를 먼저, 부족하면 웹 검색. '누가·무엇을·언제'가 드러나는 구체 사건), 그래서(초보에게 무슨 의미인지 — 내 계좌·시장 전체에 주는 뜻), 볼 것(다음에 확인할 숫자·일정 하나). 확실한 원인이 없으면 why는 빈칸(추측 금지), so·next는 숫자로 말할 수 있는 것만.
출력: JSON 하나만 {"items":[{"i":번호,"why":"원인 한 줄(60자 이하)","so":"그래서 한 줄(60자 이하)","next":"볼 것 한 줄(40자 이하)","src":"출처 이름","url":"출처 주소 또는 빈칸","conf":"상|중|하"}],"note":"오늘 이슈 전체를 관통하는 흐름 한 줄"}`
  },
  brief: {
    tier: "main", web: 5, max: 10000, timeout: 230000,
    system: BASE + `
이번 작업: '오늘의 브리핑' 화면을 사람이 읽는 해설로 완성한다. 앱 숫자(지수·오른 종목 비율·업종·급등락·이슈)와 [후보 기사], 필요하면 웹 검색으로:
1) story: 오늘 시장 해설 3줄(각 70자 이하) — 지수 → 업종 → 급등락을 하나의 이야기로 묶고 '왜'를 출처와 함께. 첫 줄은 결론, 줄마다 앱 숫자를 최소 하나 넣는다. 세 줄이 같은 말을 반복하면 실패.
2) issues: 핵심 이슈마다 왜·그래서·볼 것(확실하지 않으면 why 빈칸). why는 '누가·무엇을·언제' 가 드러나는 구체 사건으로(예: 'OO 3분기 실적 발표(10/22) — 영업이익 시장 예상 상회'), so는 초보의 계좌 관점, next는 날짜가 있는 일정이나 확인할 숫자.
3) movers: 급등·급락 종목마다 이유 한 줄(50자 이하, 확실하지 않으면 빈칸, 추측 금지). 같은 업종이 함께 움직였으면 그 업종 이유를 쓴다.
4) tomorrow: 내일(다음 거래일) 볼 것 3개 — [다가오는 일정]과 오늘 이슈를 연결해서 '무엇을, 언제, 왜'.
출력: JSON 하나만 {"story":["","",""],"issues":[{"i":번호,"why":"","so":"","next":"","src":"","url":"","conf":"상|중|하"}],"movers":[{"sym":"티커 그대로","why":"","src":"","url":"","conf":""}],"tomorrow":[{"what":"","when":"","why":""}],"note":"흐름 한 줄"}`
  },
  /* v12.46 하루 한 번 — 오늘 브리핑 + 편성 + 리포트 선정을 한 호출로 (brief·why·plan·rpick 를 대체. 같은 기사·이슈를 세 번 읽던 낭비 제거) */
  daily: {
    tier: "main", web: 6, max: 14000, timeout: 250000,
    system: BASE + `
이번 작업: 운영자의 '오늘 아침 한 번' 작업이다. 앱이 준 시장 숫자·핵심 이슈·급등락·거래대금·신호·매크로·일정과 [후보 기사], 필요하면 웹 검색(최대 6회 — 오늘 가장 큰 재료 위주로, 종목별로 낭비하지 말 것)으로 다음 여섯 가지를 한 번에 만든다. 하나의 사실 조사를 여섯 결과가 공유하므로, 같은 사건을 서로 다르게 설명하지 않는다.
1) story: 오늘 시장 해설 3줄(각 70자 이하) — 지수 → 업종 → 급등락을 하나의 이야기로. 첫 줄은 결론, 줄마다 앱 숫자 최소 하나, 세 줄이 같은 말이면 실패.
2) issues: 핵심 이슈마다 왜(누가·무엇을·언제가 드러나는 구체 사건 — 확실하지 않으면 빈칸)·그래서(초보의 계좌 관점)·볼 것(날짜 있는 일정이나 확인할 숫자).
3) movers: 급등·급락·거래대금 급증 종목마다 이유 한 줄(50자 이하, 확실하지 않으면 빈칸). 같은 업종이 함께 움직였으면 업종 이유로.
4) tomorrow: 다음 거래일에 볼 것 3개 — [다가오는 일정]과 오늘 이슈를 연결해 '무엇을·언제·왜'.
5) plan: 오늘 계정에 올릴 카드 편성 — 목표는 노출(저장·공유·댓글·팔로우). [주제 후보]에서 오늘 화제와 연결되는 것을 우선, 같은 이야기를 여러 장 반복하지 않는다. 화제가 많으면 10개를 넘겨도 된다(최대 16). 각 선택에 ctx(후보의 ctx를 글자 그대로 복사)·title(후보 제목 그대로)·왜 오늘·첫 줄 훅(30자 이하)·slot(아침|점심|저녁). 앱 후보에 없지만 꼭 다룰 화제는 extra에(앱에 없는 숫자는 만들지 말 것). 이번 주 남은 요일의 연재 기획 week 3~5개.
6) reports: 운영자가 오늘 열어 볼 리포트 3~6개 — [리포트 후보]의 id를 그대로. 후보에 없는 종목이 오늘 화제면 kind:"stock"과 정확한 회사명·티커(미국은 영문 티커, 한국은 6자리 코드). 같은 이야기를 겹치게 고르지 않는다.
출력: JSON 하나만 {"story":["","",""],"note":"오늘 흐름 한 줄","issues":[{"i":번호,"why":"","so":"","next":"","src":"","url":"","conf":"상|중|하"}],"movers":[{"sym":"티커 그대로","why":"","src":"","url":"","conf":""}],"tomorrow":[{"what":"","when":"","why":""}],"plan":{"summary":"오늘 시장 한 줄","picks":[{"ctx":"","title":"","why":"","hook":"","slot":"아침|점심|저녁"}],"extra":[{"title":"","idea":"","data":""}],"week":[{"day":"요일","title":"","hook":"","ctx":""}]},"reports":[{"id":"","kind":"stock|market|macro|timing","name":"","ticker":"","why":""}]}`
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
  rpick: {
    tier: "main", web: 3, max: 3000, timeout: 180000,
    system: BASE + `
이번 작업: 운영자가 오늘 열어 볼 '리포트' 3~6개를 고른다. 리포트 종류: stock(종목 하나 — 기회인가 위기인가), market(지수 — 지금 사도 되나), macro(금리·환율 등 조건 — 그래서 어떻게 보나), timing(이번 달 — 지금 사야 하나).
- [오늘 이슈]·[오늘 기사]·필요하면 웹 검색으로 오늘 한국·미국 투자자가 가장 궁금해할 질문을 찾고, 그에 맞는 리포트를 고른다.
- [리포트 후보]에 있으면 그 id를 그대로 쓴다. 후보에 없는 종목이 오늘 화제면 kind:"stock"과 정확한 회사명·티커(미국은 영문 티커, 한국은 6자리 코드)를 적는다.
- 같은 이야기를 겹치게 고르지 않는다. 각 선택에 '왜 오늘'을 한 줄로.
출력: JSON 하나만 {"summary":"오늘 투자자가 궁금한 것 한 줄","picks":[{"id":"후보 id(있으면)","kind":"stock|market|macro|timing","name":"회사명(후보 밖 종목일 때)","ticker":"티커(후보 밖 종목일 때)","why":"왜 오늘 한 줄"}]}`
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
/* v12.45 JSON 꺼내기 — 코드 블록(```json)·앞뒤 설명·여러 '{' 후보를 견딘다. 마지막(가장 완성된) 객체부터 시도 */
function pickJson(text) {
  text = String(text || "").replace(/```(?:json)?/gi, "");
  const tryParse = (t) => { try { return JSON.parse(t); } catch (e) { try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1").replace(/[\u201c\u201d]/g, '"')); } catch (e2) { return null; } } };
  const b = text.lastIndexOf("}"); if (b < 0) return null;
  const starts = []; for (let i = text.indexOf("{"); i >= 0 && i < b; i = text.indexOf("{", i + 1)) starts.push(i);
  for (const a of starts.slice(0, 40)) { const o = tryParse(text.slice(a, b + 1)); if (o && typeof o === "object") return o; }
  return null;
}
const API = "https://api.anthropic.com/v1/messages";
async function callClaude(key, payload, ms) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), Math.max(5000, ms));
  try { const r = await fetch(API, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(payload) }); const j = await r.json().catch(() => null); return { r, j }; }
  finally { clearTimeout(tm); }
}

/* 실제 작업 — 결과 객체를 돌려준다(응답은 claudeHandler 가). used 는 미리 세어 둔 오늘 횟수 */
async function runClaude(body, key, used) {
  const T = TASKS[body.task];
  const model = T.tier === "fast" ? (process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5") : (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  const max = +(process.env.CLAUDE_DAILY_MAX || 60), web = T.web && process.env.COPY_WEB !== "0" && body.web !== false;
  const payload = { model, max_tokens: T.max, system: T.system, messages: [{ role: "user", content: "오늘: " + kstDay() + " (한국 시간)\n\n" + clip(body.input, 60000) }] };
  if (web) payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: T.web, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }];
  /* v12.45 안정화: ① 웹 검색이 길어져 API가 'pause_turn'으로 잠깐 멈추면 이어서 다시 요청(최대 3번) ② JSON이 깨지면 빠른 모델로 형식만 고치는 한 번 더(내용은 그대로) ③ 실패하면 이유(stop)를 같이 알려 준다
     Vercel 함수 한도 300초 안에서 남은 시간을 나눠 쓴다 */
  const t0 = Date.now(), left = () => 290000 - (Date.now() - t0);
  try {
    let blocks = [], j = null, r = null, turns = 0, usage = { input_tokens: 0, output_tokens: 0 };
    for (;;) {
      ({ r, j } = await callClaude(key, payload, Math.min(T.timeout, left() - (body.json ? 40000 : 5000))));
      if (!r.ok || !j) return { ok: false, reason: "API_" + r.status, msg: clip(j && j.error && j.error.message, 240) || ("Claude API 오류 " + r.status) };
      blocks = blocks.concat(j.content || []); if (j.usage) { usage.input_tokens += j.usage.input_tokens || 0; usage.output_tokens += j.usage.output_tokens || 0; }
      if (j.stop_reason === "pause_turn" && turns < 3 && left() > 60000) { turns++; payload.messages = payload.messages.concat([{ role: "assistant", content: j.content }]); continue; }
      break;
    }
    /* v12.48 글 없이 끝난 경우(검색만 하다 max_tokens 등) — 지금까지 모은 검색 결과를 그대로 이어 붙이고 "이제 결과만 써라"고 한 번 더(도구 없이). 그래도 안 되면 웹 없이 앱 숫자만으로 새로 */
    let finish = null, textNow = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (!textNow && left() > 45000) {
      const ask = { role: "user", content: "검색은 여기까지. 지금까지 읽은 자료와 앱 숫자로 바로 결과를 써 줘. 다른 말 없이 " + (body.json ? "JSON 하나만." : "결과만.") };
      let f1 = null;
      if (blocks.length) { try { f1 = await callClaude(key, { model, max_tokens: T.max, system: T.system, messages: payload.messages.concat([{ role: "assistant", content: blocks }, ask]) }, Math.min(T.timeout, left() - 30000)); } catch (e) { f1 = null; } }
      if (!(f1 && f1.r.ok && f1.j && (f1.j.content || []).some((b) => b.type === "text" && b.text.trim())) && left() > 45000) { try { f1 = await callClaude(key, { model, max_tokens: T.max, system: T.system, messages: [payload.messages[0], { role: "user", content: "(웹 검색 없이) 위 앱 숫자와 후보 기사만으로 바로 결과를 써 줘. 다른 말 없이 " + (body.json ? "JSON 하나만." : "결과만.") }] }, Math.min(T.timeout, left() - 5000)); } catch (e) { f1 = null; } }
      if (f1 && f1.r.ok && f1.j) { finish = f1.j.stop_reason || "finish"; blocks = blocks.concat(f1.j.content || []); if (f1.j.usage) { usage.input_tokens += f1.j.usage.input_tokens || 0; usage.output_tokens += f1.j.usage.output_tokens || 0; } }
    }
    const texts = blocks.filter((b) => b.type === "text").map((b) => b.text), text = texts.join("");
    const kinds = {}; blocks.forEach((b) => { kinds[b.type] = (kinds[b.type] || 0) + 1; });
    const src = [], seen = {};
    blocks.forEach((b) => { (b.citations || []).forEach((c) => { if (c.url && !seen[c.url]) { seen[c.url] = 1; src.push({ t: clip(c.title, 90), u: c.url }); } }); });
    const searches = blocks.filter((b) => b.type === "server_tool_use").map((b) => b.input && b.input.query).filter(Boolean);
    const out = { ok: true, task: body.task, model, text, sources: src.slice(0, 12), searches, used, max, stop: j.stop_reason, finish, turns, usage, blocks: kinds };
    if (body.json) {
      out.data = pickJson(text);
      if (!out.data && left() > 25000) {   // 형식만 고치기 — 빠른 모델 · 웹 없음 · 횟수에 안 셈
        const schema = String(T.system).split("출력:").pop().trim();
        const fix = await callClaude(key, { model: process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5", max_tokens: Math.max(4000, T.max), system: "너는 JSON 정리기다. 아래 [원문]에 담긴 내용을 [형식]에 맞는 올바른 JSON 하나로만 출력한다. 내용·숫자·출처는 한 글자도 바꾸거나 더하지 않는다. 문자열 안의 큰따옴표는 ‘ ’로 바꾼다. 원문이 중간에 끊겼으면 있는 내용만 담고, 없는 칸은 빈 문자열·빈 배열로 둔다. JSON 외의 말 금지.", messages: [{ role: "user", content: "[형식]\n" + schema + "\n\n[원문]\n" + clip(text, 40000) }] }, left() - 3000).catch(() => null);
        const ft = fix && fix.j && (fix.j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
        out.data = ft ? pickJson(ft) : null; if (out.data) out.repaired = true;
      }
      if (!out.data) { out.ok = false; out.reason = "PARSE"; out.msg = "AI 응답을 읽지 못했어요" + (j.stop_reason === "max_tokens" ? " — 답이 너무 길어 중간에 끊겼어요(다시 시도하면 대개 됩니다)" : j.stop_reason === "pause_turn" ? " — 웹 검색이 길어져 답을 끝내지 못했어요" : !text.trim() ? " — 답 본문이 비어 있어요(웹 검색만 하고 끝남 · 블록: " + Object.keys(kinds).map((k) => k + "×" + kinds[k]).join(", ") + ")" : " — 형식이 깨졌어요") + " [stop: " + j.stop_reason + (finish ? " → 마무리 " + finish : "") + " · 블록: " + Object.keys(kinds).map((k) => k + "×" + kinds[k]).join(", ") + " · 출력 토큰 " + usage.output_tokens + "]"; out.text = clip(text, 600); }
    }
    return out;
  } catch (e) {
    return ({ ok: false, reason: e.name === "AbortError" ? "TIMEOUT" : "ERROR", msg: e.name === "AbortError" ? "시간이 너무 걸려 멈췄어요 — 잠시 뒤 다시 시도해 주세요" : clip(e.message, 160) });
  }
}

/* ============================================================ v12.49 긴 작업은 '시작 → 백그라운드 실행 → 결과 조회' 로
   휴대폰·모바일망에서 2~3분짜리 HTTP 한 통을 열어 두면 중간에 끊긴다(Failed to fetch). 그래서
   ① POST {task,input} → 즉시 {ok:true, job:ID} 로 답하고 Vercel waitUntil 로 뒤에서 계속 돌린다(함수 한도 300초 안).
   ② 클라이언트가 POST {job:ID} 로 몇 초마다 물어보면 Redis 에 적힌 상태/결과를 돌려준다(연결은 매번 짧다).
   waitUntil 이나 Redis 가 없으면 예전처럼 한 통으로 처리한다.
   ============================================================ */
async function jobGet(rc, id) { try { const t = await getJsonGzText(rc, "sm:job:" + id); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
async function jobSet(rc, id, obj) { try { await setJsonGz(rc, "sm:job:" + id, obj, 1800); } catch (e) {} }
export async function claudeHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" });
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body) return res.status(400).json({ ok: false, reason: "본문 필요" });
  const rc = redisConf();
  // 결과 조회
  if (body.job) {
    if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
    const J = await jobGet(rc, String(body.job).slice(0, 40));
    if (!J) return res.status(200).json({ ok: false, reason: "NO_JOB", msg: "작업을 찾지 못했어요(만료)" });
    return res.status(200).json(J.st === "done" ? Object.assign({ job: body.job }, J.out) : { ok: true, pending: true, job: body.job, st: J.st, at: J.at, task: J.task, sec: Math.round((Date.now() - J.at) / 1000) });
  }
  const T = TASKS[body.task];
  if (!T || !body.input) return res.status(400).json({ ok: false, reason: "task·input 필요" });
  // 하루 상한
  const max = +(process.env.CLAUDE_DAILY_MAX || 60), dayKey = "sm:claude:" + kstDay(); let used = 0;
  if (rc) { try { used = +(await redisCmd(rc, ["INCR", dayKey])) || 0; if (used === 1) await redisCmd(rc, ["EXPIRE", dayKey, String(3 * 86400)]); } catch (e) {} }
  if (used > max) return res.status(200).json({ ok: false, reason: "DAILY_MAX", msg: "오늘 Claude 작업 횟수(" + max + "회)를 다 썼어요 — CLAUDE_DAILY_MAX로 늘릴 수 있어요" });
  // 백그라운드 실행이 가능하면 작업 번호만 바로 돌려준다
  let waitUntil = null; try { const m = await import("@vercel/functions"); waitUntil = m && m.waitUntil; } catch (e) { waitUntil = null; }
  if (rc && typeof waitUntil === "function" && body.sync !== true) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await jobSet(rc, id, { st: "run", at: Date.now(), task: body.task });
    waitUntil((async () => {
      let out; try { out = await runClaude(body, key, used); } catch (e) { out = { ok: false, reason: "ERROR", msg: clip(e.message, 200) }; }
      await jobSet(rc, id, { st: "done", at: Date.now(), task: body.task, out });
    })());
    return res.status(200).json({ ok: true, job: id, pending: true, task: body.task });
  }
  const out = await runClaude(body, key, used);
  return res.status(200).json(out);
}
