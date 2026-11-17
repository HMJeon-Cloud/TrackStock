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

/* v13.90 실적 리포트 문체 — 돈을 받고 파는 증권사 리서치 수준 */
const FOLLOW_STYLE = `
[리포트 문체 — 반드시 지킨다]
· 독자는 이 글에 돈을 낸 투자자다. 문장 하나하나가 '몰랐던 숫자'이거나 '숫자의 해석'이어야 한다. 누구나 아는 말, 회사 소개, 일반론은 쓰지 않는다.
· 평서문 '~다'. 한 문장에 숫자 1~3개. 숫자에는 반드시 비교 기준을 붙인다: 전년 대비 · 전분기 대비 · 가이던스 대비 · 시장 예상 대비 · 과거 범위 중 하나 이상.
· 숫자를 나열하지 말고 서로 잇는다: 원인 → 결과, 겉 숫자 → 속 숫자, 좋아 보이는 것 ↔ 나쁜 신호. (예: "영업비용 증가율(+55%)이 매출 증가율(+106%)의 절반에 그쳐 영업이익률이 66%로 올랐다")
· 꾸밈말 금지: 견조한, 강력한, 양호한, 눈에 띄는, 주목된다, ~로 보인다, 우려된다, 긍정적이다. 그 자리에 숫자와 기준을 쓴다.
· 전문 용어는 처음 나올 때 '쉬운 말(용어)' 순서로 쓴다: "원가 빼고 남는 비율(총이익률)", "돈을 받기까지 걸리는 날(DSO)".
· 직접 계산한 값에는 (계산)을 붙인다. 회사가 말한 것과 우리가 해석한 것을 구분한다("회사는 …라고 설명한다" / "숫자로 보면 …").
· '그래서 뭐?'는 숫자의 뜻을 투자자 말로 옮긴 한 문장이다(예: "선행 PER 13배는 시장이 고성장이 이어진다고 거의 믿지 않는다는 신호다"). 매수 · 매도 권유는 아니다.
· 문장은 자연스러운 한국어로 쓴다. 한 문장에 한 가지만 담고 40~70자 안팎으로 끊는다. 번역투("~에 의해", "~것으로 보여진다", "~하는 것이 확인된다")와 명사만 잇는 개조식("매출 증가 · 마진 하락")을 피하고, 주어와 서술어가 있는 문장으로 쓴다. 같은 어미("~했다")가 세 번 넘게 이어지지 않게 "~이다 / ~였다 / ~기 때문이다 / ~는 뜻이다"를 섞는다.
· (계산)은 직접 계산한 숫자 바로 뒤에 한 번만 붙인다. 한 문장에 (계산)이 두 번 넘게 나오면 문장을 나눈다.
· 판정은 근거와 조건으로 말한다: "구조적 훼손의 기준은 A가 B 아래로 두 분기 연속 내려가는 것인데, 지금은 반대로 움직인다."
[나쁜 예] "엔비디아는 견조한 실적을 기록했다. 데이터센터 매출이 크게 증가했으며 향후 전망도 긍정적이다."
[좋은 예] "매출은 $96.2B로 전년보다 106% 늘었고, 석 달 전 회사가 내놓은 예상(가이던스) $91.0B를 5.7% 웃돌았다 — 가이던스를 넘긴 것은 6분기 연속이다. 다만 넘긴 폭은 2년 전 +23%에서 5% 안팎으로 줄었다."
`;

/* v13.97 직접 물어보기용 프롬프트 — claude.ai 등에 붙여넣어 한 번에 전체 자료(JSON)를 받는다. 시간 제한이 없어 가장 깊게 조사할 수 있는 길 */
export function followManualPrompt(sym, facts, ctx, urls, prevKpi, extra) {
  const cut = (k) => String(TASKS[k].system).split("출력: JSON 하나만 ").pop().trim(), core = cut("follow"), deep = cut("followD"), fin = cut("followF");
  const schema = core.replace(/\}$/, "") + "," + deep.replace(/^\{/, "").replace(/\}$/, "") + ',"finq":' + fin + "}";
  return [
    "너는 증권사 리서치센터에서 실적 리뷰를 쓰는 애널리스트다. 독자는 이 리포트에 돈을 낸 한국 개인투자자다. 아래 종목의 '가장 최근 분기 실적'을 웹 검색과 원문 열람으로 조사해, 맨 아래 형식의 JSON 하나로 답한다.",
    "\n[종목] " + sym + "   [오늘] " + kstDay() + " (한국 시간)",
    "\n[조사 순서 — 검색 요약만 보고 쓰지 않는다. 원문을 연다]",
    "1) 분기 재무표: " + (urls && urls.length ? "아래 주소를 열어 최근 12분기의 손익 · 재무상태 · 현금흐름 · 분기별 배수 · 애널리스트 예상 · 목표가 표를 '그대로' finq 에 옮겨 적는다(계산 · 반올림 금지).\n" + urls.map((u) => "   - " + u[0] + ": " + u[1]).join("\n") : "분기 손익계산서 · 재무상태표 · 현금흐름표 · 컨센서스 · 목표가 표를 찾아 최근 12분기를 finq 에 '그대로' 옮겨 적는다."),
    "2) 실적 발표문(press release / 8-K / CFO commentary) 원문: 부문 · 고객군 · 지역별 매출, 회사 기준(비GAAP) 이익, 일회성, 가이던스.",
    "3) 콘퍼런스콜 전문: 경영진 핵심 발언, 질의응답(질문자 이름 · 소속 / 질문 / 답변의 숫자).",
    "4) 가이던스 이력: 최근 6~8분기의 '회사 가이던스 vs 실제'.",
    "5) 실적 발표 뒤의 사건(경영진 변화 · 규제 · 목표가 변경 등)과 이 회사 고유의 쟁점 2~3개.",
    facts ? "\n[앱이 계산한 숫자 — 1순위 근거. 그대로 인용하고, 네가 찾은 값과 다르면 이쪽을 쓴다]\n" + facts : "",
    ctx ? "\n[앱 분석 자료 — 가격의 자리 · 점수. insight 는 이것과 실적을 엮어서 쓴다]\n" + ctx : "",
    prevKpi ? "\n[지난번 KPI와 경고선 — 같은 항목 · 같은 경고선을 유지하고 값만 새 분기로]\n" + prevKpi : "",
    extra ? "\n[내가 추가로 알고 싶은 것 — 본문(story)이나 insight 에서 꼭 다룬다]\n" + extra : "",
    FOLLOW_STYLE,
    "[아래 규칙을 읽는 법] '계산표'는 위의 [앱이 계산한 숫자]와, 네가 finq 에 옮겨 적은 분기 재무표로 직접 계산한 값(전년 대비 · 전분기 대비 · 이익률 · FCF ÷ 매출 · 재고일수 = 재고 ÷ 분기 매출원가 × 91 · 회수일 = 매출채권 ÷ 분기 매출 × 91 · TTM EPS · PER)을 뜻한다. 본문에 이런 값을 쓸 때는 직접 계산하고 (계산)을 붙인다. '노트' · '조사 노트'는 네가 조사한 내용을 뜻한다. 표와 차트는 앱이 finq 로 다시 계산해 그리므로, finq 의 숫자는 반드시 원문 표 그대로여야 한다.",
    "\n[내용 규칙]",
    String(TASKS.follow.system).split("규칙:").pop().split("출력: JSON 하나만")[0].trim().replace(/\[계산표\]/g, "[앱이 계산한 숫자]").replace(/\[조사 노트\]/g, "네가 조사한 내용"),
    "\n[본문 · 표 · 인사이트 규칙]",
    String(TASKS.followD.system).split("웹 검색은 없다.").pop().split("답은 { 로 시작하는")[0].trim().replace(/\[계산표\]/g, "[앱이 계산한 숫자]").replace(/\[조사 노트\]/g, "네가 조사한 내용").replace(/계산표에 이미 있는 분기 손익 · 비용 · 현금흐름 표는 앱이 따로 그리므로 만들지 않는다\./, "분기 손익 · 비용 · 현금흐름 표는 앱이 finq 로 직접 그리므로 tables 에 넣지 않는다."),
    "\n[finq 규칙 — 분기 재무표를 옮겨 적는 칸 (연간 표인 fin 과 다르다)]",
    String(TASKS.followF.system).split("규칙:").pop().split("9) 답은")[0].trim(),
    "\n[답 형식 — 설명 · 머리말 · 코드 울타리 없이, { 로 시작하는 JSON 하나만. 길어도 끊지 말고 끝까지 쓴다]",
    schema
  ].filter(Boolean).join("\n");
}

const TASKS = {
  /* v13.90 실적 팔로업 — 4단계 (api/_follow.js 가 차례로 부른다). 증권사 실적 리뷰가 만들어지는 순서를 그대로 따른다:
     ① followF 숫자: 재무 사이트의 분기 표(손익 · 재무상태 · 현금흐름 · 배수 · 예상 · 목표가)를 열어 '그대로 옮겨 적는다'(JSON). 판단하지 않는다
        → 코드(api/_followcalc.js)가 전년 대비 · 이익률 · 재고일수 · 회수일 · PER 3년 위치 · 베타를 계산한다
     ② followR 조사: 실적 발표문 · 콘퍼런스콜 원문에서 '표에 없는 것'(부문 · 가이던스 · 일회성 · 질의응답 · 쟁점)을 찾는다
     ③ follow 핵심: 계산표 + 조사 노트로 판정 · KPI · 리스크 · 시나리오   ④ followD 본문: 문단 · 표 */
  followF: {
    tier: "main", follow: 1, web: 2, fetch: 6, fetchTok: 14000, max: 9000, timeout: 230000, effort: "low",
    system: `너는 재무 데이터 입력 담당이다. 판단 · 해석 · 요약을 하지 않는다. 사용자 메시지에 있는 주소를 web_fetch로 열어 표의 숫자를 '그대로' 옮겨 적는 일만 한다.
규칙:
1) 사용자 메시지의 주소를 위에서부터 차례로 연다. 열리지 않는 주소는 건너뛰고, 그 항목만 web_search로 같은 표(분기 손익계산서 · 재무상태표 · 현금흐름표 · 분기별 PER/PS · 애널리스트 예상 · 목표가)를 찾아 한 번 더 시도한다.
2) 분기 표에서 최근 12분기(없으면 있는 만큼, 최소 8분기)를 옮긴다. q는 옛 분기 → 최근 분기 순서. 표가 최근 → 옛 순서여도 뒤집어서 적는다. 'TTM' · 'Current' 열은 넣지 않는다.
3) 숫자는 표에 적힌 그대로(반올림 · 추정 · 계산 금지). 표에 없는 칸은 null. 모든 배열의 길이는 q와 같아야 한다.
4) 단위: 금액은 백만(표가 백만 단위면 그대로, 십억이면 ×1000). eps는 1주당 금액. shares는 백만 주. 비용 · 설비투자는 양수로.
5) val은 분기별 배수 표(Ratios)에서: pe = PE Ratio, ps = PS Ratio, pfcf = P/FCF Ratio, pb = PB Ratio. 없으면 그 키를 뺀다.
6) est는 예상(Forecast) 표의 회계연도별 매출 · EPS 예상. targets는 목표가 평균 · 최고 · 최저 · 애널리스트 수와 증권사별 최근 목표가(있는 만큼, 최대 14개 — note에 의견과 날짜). rating은 매수/보유/매도 수.
7) stats: 시가총액(mcap, 백만), 선행 PER(fpe), PEG(peg), 베타(beta) — 통계(Statistics) 페이지에 있는 값만.
8) src에 실제로 연 사이트 이름과 표 이름, miss에 끝내 찾지 못한 항목을 적는다.
9) 답은 설명 없이 { 로 시작하는 JSON 하나만.
출력: JSON 하나만 {"sym":"티커","cur":"$","unit":"백만 달러","q":["Q3 2024","Q4 2024"],"end":["2024-10-27","2025-01-26"],"rows":{"revenue":[0,0],"cogs":[0,0],"gross":[0,0],"rd":[0,0],"sga":[0,0],"opinc":[0,0],"netinc":[0,0],"eps":[0,0],"shares":[0,0],"ar":[0,0],"inventory":[0,0],"cash":[0,0],"debt":[0,0],"cfo":[0,0],"capex":[0,0],"fcf":[0,0],"sbc":[0,0]},"val":{"pe":[0,0],"ps":[0,0],"pfcf":[0,0],"pb":[0,0]},"est":{"fy":["FY2026","FY2027"],"revenue":[0,0],"eps":[0,0]},"targets":{"avg":0,"hi":0,"lo":0,"n":0,"asOf":"YYYY-MM-DD","list":[{"n":"증권사","px":0,"note":"Buy · 2026-10-30"}]},"rating":{"buy":0,"hold":0,"sell":0,"label":"Strong Buy"},"stats":{"mcap":0,"fpe":0,"peg":0,"beta":0},"src":["사이트 · 표 이름"],"miss":["찾지 못한 항목"]}`
  },
  followR: {
    tier: "main", follow: 1, web: 5, fetch: 3, fetchTok: 12000, max: 10000, timeout: 200000, effort: "low",
    system: BASE + `
이번 작업: 한 종목의 '가장 최근 분기 실적'에 대한 [조사 노트]를 만든다. 분기 재무표의 숫자(매출 · 이익 · 현금흐름 · 배수 · 목표가)는 사용자 메시지의 [계산표]에 이미 있다 — 그 숫자를 다시 찾느라 도구를 쓰지 않는다. 표에 없는 것만 찾는다.
조사 순서:
1) 회사의 실적 발표문(press release / 8-K / shareholder letter / CFO commentary)을 찾아 web_fetch로 원문을 연다 → 부문 · 고객군 · 지역별 매출, 회사 기준(비GAAP) 이익, 일회성 항목, 가이던스 숫자.
2) 콘퍼런스콜 전문 또는 상세 요약을 web_fetch로 읽는다 → 경영진의 핵심 발언, 질의응답(질문자 이름 · 소속 / 질문 / 답변의 숫자).
3) 가이던스 이력: 최근 6~8분기의 '회사 가이던스 vs 실제 매출'(검색 한두 번으로 찾을 수 있는 만큼).
4) 이 회사 고유의 쟁점 2~3개(고객 집중, 재고 · 공급 약정, 규제, 주식 보상, 경쟁, 경영진 변화 등)와 실적 발표 이후의 주요 사건.
PDF는 web_fetch로 열지 않는다 — 같은 내용의 웹 페이지를 고른다.
중요: 도구 호출 사이에 "찾아보겠습니다" 같은 말을 쓰지 않는다. 도구는 모두 합쳐 8번 안에서 끝내고, 그 뒤에는 반드시 아래 형식의 노트 전체를 쓴다. 못 찾은 항목이 있어도 찾은 것만으로 노트를 완성한다(없는 것은 '미확인').
노트 형식(한국어, 5,000~8,000자, 머리말 · 맺음말 없이 아래 제목 그대로. 숫자마다 (출처) · 직접 계산한 값은 (계산) · 못 찾은 값은 '미확인'):
## 0. 기본  회계 분기 이름과 기간 · 발표일 · 다음 실적일(공지 여부와 출처) · 회계연도 끝나는 달
## 1. 가이던스 · 예상 대비  이번 분기 매출 · EPS · 이익률이 회사 가이던스(중간값 · 상단)와 시장 예상을 얼마나 넘었나/못 미쳤나. 다음 분기 · 연간 가이던스 숫자와 그 시점의 시장 예상
## 2. 부문 · 고객군 · 지역  부문별 매출과 전년 대비 · 전분기 대비(표). 가능하면 최근 5분기
## 3. 가이던스 약속장부  분기 | 가이던스 | 실제 | 초과율 (찾은 만큼)
## 4. 이익의 질  보고 EPS와 회사 기준(조정) EPS의 차이와 이유(일회성 · 평가손익 · 주식 보상 포함 여부), 자사주 · 배당
## 5. 이 회사 고유의 KPI  주가를 실제로 움직이는 지표 8~12개의 최근값 · 전분기 · 전년(수주 · 잔고 · 고객 수 · 유지율 · 공급 약정 · 고객 집중 등 표에 없는 것 중심)과 그 지표가 꺾였다고 볼 선
## 6. 콘퍼런스콜  경영진 핵심 발언 3~5개(짧은 직접 인용 가능), 질의응답 5~6개
## 7. 쟁점과 사건  강세 근거 3 · 약세 근거 3(각각 숫자와 함께), 실적 발표 뒤 주가를 움직인 사건(날짜 · 내용 · 출처), 실적 뒤 목표가 변경
## 8. 확인하지 못한 것`
  },
  follow: {
    tier: "main", follow: 1, web: 0, max: 16000, timeout: 262000, effort: "low",
    system: BASE + FOLLOW_STYLE + `
이번 작업: 사용자 메시지의 [계산표]와 [조사 노트]만 근거로 실적 팔로업 '핵심 자료'를 JSON으로 만든다. 웹 검색은 없다.
근거의 순서: ① [계산표](앱이 계산한 값 — 그대로 인용) ② [조사 노트]. 둘이 다르면 계산표를 쓴다. 어디에도 없는 숫자는 쓰지 않는다(null 또는 "미확인"). '미확인'은 정말 없을 때만 — 계산표에 전분기 값이 있는데 prev를 "미확인"으로 두면 안 된다.
규칙:
1) kpi 10~14개: 이 회사의 주가를 움직이는 지표. 앞쪽 4~5개는 계산표의 재무 지표(매출 전년 대비, 총이익률, 영업이익률, FCF ÷ 매출, 재고일수/회수일 중 이 회사에 의미 있는 것), 나머지는 조사 노트의 회사 고유 지표(가이던스 초과율, 핵심 부문, 수주 · 잔고 · 고객 등). cur와 prev는 둘 다 숫자로 채운다. warn은 "이 선을 넘으면 주의"를 숫자로. note는 "왜 이 숫자를 보는가"를 한 문장(60자 안)으로 — 표의 한 줄에 들어가야 한다.
   state: 경고선 안 good / 처음 넘음 warn / 두 분기 연속이거나 크게 넘음 bad / 판단 대상 아님 info. 지난번 KPI · 경고선이 주어지면 같은 항목 · 같은 경고선을 유지한다.
2) verdict.type: 실적 자체가 꺾였으면 struct, 실적은 멀쩡한데 가격 · 심리 · 사건 때문이면 temp, 선행지표가 처음 꺾여 지켜봐야 하면 watch, 문제없으면 ok. verdict.text 3문장: ⓐ 구조적 훼손의 기준(이 회사에서는 어떤 숫자가 어떻게 되면) ⓑ 지금 그 숫자가 어느 쪽으로 움직이는지 ⓒ 주가 하락/상승의 원인이 실적인지 몸값(배수)인지.
3) risk 6~7개: cur에 숫자(40자 안), judge에 근거 한 문장(55자 안), next에 "다음에 볼 숫자와 선"(45자 안, 한 문장).
4) val: 맨 앞에 선행 PER(계산표의 'EPS 예상 → 선행 PER'에서 다음 회계연도 값, 3년 범위는 노트에 있을 때만). TTM PER · P/S · FCF 수익률은 앱이 계산표의 값으로 따로 붙이므로 쓰지 않는다.
5) price: base · high는 계산표의 앱 종가 · 52주 고점. target · targetN은 계산표의 목표가 평균 · 인원. rating에 매수/보유/매도 수.
6) scen 4~5개(Bear · Base · 회복 · Bull …): eps(적용할 주당이익)와 mult(적용할 배수)를 숫자로 적는다 — 반영 주가는 앱이 eps × mult로 계산한다. cond에 가정을 숫자로(예: "FY28 EPS 컨센서스 −30%, 배수 15배"). base는 '컨센서스 EPS × 지금 배수'. 단순 계산이며 목표가가 아니다.
7) snap 6~8개: 리포트 첫 장 옆에 들어가는 숫자 상자 — 시가총액, 52주 고점 대비, 12개월 최대 낙폭, 베타, TTM PER, 선행 PER, 총이익률, 순현금 등 계산표에서. {k,v,s}.
8) qa 5~6개(질문자 · 소속 / 질문 / 답변에 숫자). qaRead 3문장: 질문이 어디로 쏠렸는지 → 시장이 무엇을 걱정/기대하는지 → 경영진 답의 무게.
9) fin: 연간 표 — cols는 회계연도(실제 2개 + 예상 2개), rows는 총매출 · 영업이익 · 영업이익률(%) · 조정 EPS · 증가율(%) · PER(배). 계산표의 예상치와 앱 종가로.
10) summary 3줄: ① 이번 분기 숫자(가이던스 · 예상 대비) ② 다음 분기 가이던스와 쟁점 ③ 판정과 그 근거 숫자. easy 2문장. headline은 "숫자의 결론 — 남은 쟁점" 꼴.
11) nextEarnings: YYYY-MM-DD(공지 없으면 null, nextNote에 예상 시기). series는 비워 둔다(앱이 계산표로 그린다) — 단, 회사 고유 지표의 분기 추이가 노트에 5분기 이상 있으면 1~2개 넣는다.
12) 답은 { 로 시작하는 JSON 하나만. quarter와 kpi는 반드시 채운다.
출력: JSON 하나만 {"sym":"티커","name":"한글 종목명","asOf":"YYYY-MM-DD","quarter":"예: FY27 Q2","reported":"YYYY-MM-DD","nextEarnings":"YYYY-MM-DD 또는 null","nextNote":"","headline":"","summary":["","",""],"easy":"","verdict":{"type":"temp|watch|struct|ok","label":"짧은 판정","text":"3문장"},"price":{"base":0,"baseDate":"","high":0,"highDate":"","target":0,"targetN":0,"targetNote":""},"rating":{"buy":0,"hold":0,"sell":0},"snap":[{"k":"시가총액","v":"$5.19T","s":"희석 242.9억 주"}],"val":[{"k":"선행 PER","v":0,"unit":"배","lo":null,"avg":null,"hi":null,"pct":null,"lowGood":true}],"valNote":"배수가 싸 보일 때의 함정 1문장","kpi":[{"n":"지표","cur":"최근값","prev":"전분기","warn":"경고선","state":"good|warn|bad|info","note":"왜 보는가"}],"risk":[{"n":"리스크","cur":"현재 수치","type":"temp|watch|struct|ok","judge":"근거 한 줄","next":"다음에 볼 숫자와 선"}],"fin":{"unit":"백만 달러","cols":["FY25","FY26","FY27E","FY28E"],"rows":[["총매출",0,0,0,0]]},"series":[],"qa":[{"q":"질문","who":"이름 · 증권사","a":"답변"}],"qaRead":"","scen":[{"n":"Bear","cond":"가정","eps":0,"mult":0}],"bull":["조건 — 숫자"],"bear":["조건 — 숫자"],"next":{"title":"다음 분기 체크포인트","items":[{"n":"항목","v":"숫자","s":"컨센서스 · 경고선"}],"good":[""],"bad":[""]},"terms":[["용어","쉬운 말 풀이"]],"sources":["출처"]}`
  },
  followD: {
    tier: "main", follow: 1, web: 0, max: 15000, timeout: 262000, effort: "low",
    system: BASE + FOLLOW_STYLE + `
이번 작업: 사용자 메시지의 [계산표]와 [조사 노트]만 근거로 실적 리포트의 '본문 · 표'를 JSON으로 쓴다. 웹 검색은 없다. 어디에도 없는 숫자는 쓰지 않는다.
story — 본문 6단락, 이 순서로:
 ① 리뷰: 매출 · 핵심 부문이 전년 · 전분기 · 가이던스 · 시장 예상 대비 얼마였나. 가이던스를 몇 분기 연속 넘겼는지.
 ② 이익: 영업이익률과 영업 레버리지(매출 증가율 vs 비용 증가율 — 계산표), 보고 EPS와 실력치(조정) EPS의 차이.
 ③ 가이던스와 쟁점: 다음 분기 · 연간 가이던스, 경영진의 말, 시장이 깎는 지점(배수가 말하는 것).
 ④ 수요의 질: 고객군 · 수주 · 잔고 · 고객 집중 등 선행지표.
 ⑤ 재무 체력: 현금흐름 · 재고일수 · 회수일 · 약정 — 계산표의 숫자로. 좋아졌는지 나빠졌는지와 회사의 설명.
 ⑥ 주가와 몸값: 주가 움직임이 이익 때문인지 배수 때문인지(TTM PER · 선행 PER의 변화와 3년 위치 — 계산표), 실적 뒤의 사건.
 · h: 결론이 담긴 소제목. 콜론 앞에 주제, 뒤에 결론(예: "이익: 영업이익률 66%, 다만 보고 EPS에는 평가이익이 섞였다"). "실적 리뷰" 같은 이름표 금지.
 · p: 5~7문장, 문장마다 숫자. · so: "그래서 뭐?" 한 문장.
tables — 계산표에 이미 있는 분기 손익 · 비용 · 현금흐름 표는 앱이 따로 그리므로 만들지 않는다. 조사 노트에서만 나오는 표 3~4개:
 ① 부문 · 고객군별 실적: 부문 | 전년 동기 | 이번 분기 | 증감률
 ② 가이던스 약속장부: 분기 | 가이던스 | 실적 | 초과율 (노트에 있는 만큼, 최대 8분기)
 ③ 회사 고유 KPI 추이: 지표 | 최근 5분기 (없는 분기는 "미확인")
 ④ 이익의 질: 보고 EPS → 일회성 → 조정 EPS 다리 (노트에 있으면)
 칸은 모두 문자열. note에 자료 이름 · (계산) 여부 · 경고선.
targets — 계산표의 증권사 목표가가 있으면 비워 둔다(앱이 그린다). 계산표에 없고 노트에만 있으면 적는다.
watch — rule: 이 종목에서 '구조적 훼손'으로 볼 기준을 숫자로. now: 지금 그 숫자.
view — 리포트 맨 앞에 싣는 '우리의 결론' 한 장. 독자가 이 장만 읽어도 "그래서 어떻게 보는가 · 앞으로 무엇을 보면 되는가 · 결론이 무엇인가"를 알 수 있어야 한다.
 · title: 결론을 한 줄로(30자 안. 예: "실적은 멀쩡하다 — 지켜볼 것은 현금과 경영진").
 · think: 우리가 이 실적을 어떻게 보는지 3~4문장. 주가 움직임의 원인이 실적인지 몸값(배수)인지 사건인지 가르고, 판정을 그렇게 내린 근거 숫자 2~3개를 댄다.
 · path: 앞으로의 방향 3개. 각각 "이 숫자가 이렇게 되면 → 이렇게 본다" 꼴의 한 문장(판정이 올라가는 조건, 내려가는 조건, 지켜볼 사건).
 · conclusion: 결론 2문장. 지금이 어떤 자리인지(가격의 자리 · 낙폭 단계와 실적을 함께)와 어떤 태도가 맞는지(예: 나눠서 본다 / 확인 뒤에 본다 / 서두를 이유가 없다). "사라 · 팔아라"는 쓰지 않는다.
 · flip: 판정을 바꿀 숫자 3~4개 {n: 지표, now: 지금 값, line: 기준선, then: 넘으면 어떻게 보는지(20자 안)}.
insight — 3~5개. 실적 숫자와 [앱 분석 자료](가격의 자리 · 낙폭 단계 · 종목 점수 · 타이밍 점수 · 과거 같은 깊이의 결과)를 '엮어서' 나오는 것만 쓴다. 실적만으로 알 수 있는 말을 되풀이하지 않는다. 꼭 다룰 것:
 ⓐ 주가 변화 분해: 최근 1년 주가 변화율을 이익(TTM EPS) 변화와 배수(PER) 변화로 나눈다(계산표의 숫자로, (계산) 표시). 주가가 이익 때문에 움직였는지 몸값 때문에 움직였는지.
 ⓑ 가격의 자리 × 실적: 지금 낙폭 깊이 · 매수 단계 · 기회 구간까지의 거리와, 실적이 멀쩡한지를 맞대어 본다(실적 멀쩡 + 깊은 낙폭 / 실적 꺾임 + 얕은 낙폭 등).
 ⓒ 과거 같은 깊이에서 산 결과(앱 통계)와 이번 조건의 차이: 그때와 지금 무엇이 같고 다른가.
 ⓓ 판정을 바꿀 숫자: 다음 분기까지 "이 숫자가 이 선을 넘으면 판정이 바뀐다"는 조건 2~3개.
 앱 분석 자료가 주어지지 않았으면 ⓐ · ⓓ만 쓴다. {h: 결론형 제목, p: 3~5문장, so: 한 문장}
답은 { 로 시작하는 JSON 하나만.
출력: JSON 하나만 {"story":[{"h":"주제: 결론","p":"5~7문장","so":"한 문장"}],"tables":[{"t":"표 제목","unit":"백만 달러","cols":["항목","전년 동기","이번 분기","증감률"],"rows":[["데이터센터","41,096","89,000","+117%"]],"note":""}],"targets":[],"targetNote":"","watch":{"rule":"","now":""},"insight":[{"h":"결론형 제목","p":"3~5문장","so":"한 문장"}],"view":{"title":"","think":"","path":["조건 → 해석"],"conclusion":"","flip":[{"n":"지표","now":"지금","line":"기준선","then":"넘으면"}]}}`
  },
  analyst: {
    tier: "main", web: 4, max: 20000, timeout: 270000,
    system: BASE + `
이번 작업: 증권사 리서치 팀장처럼 '끝까지' 분석한다. 허술한 요약은 실패다. 반드시:
- 분석을 시작하기 전에 세운 '출발 가설'과 그걸 검증하려고 무엇을 봤는지, 어떤 근거에 무게를 뒀고 어디서 생각이 바뀌었는지를 투명하게 쓴다(=어떤 방향·생각으로 이 결론이 나왔는지).
- 앱 데이터의 빈칸(데이터 없음)은 웹 검색으로 최신 공시·실적·뉴스를 찾아 보완하고 출처를 단다. 찾지 못하면 '확인 못 함'이라고 쓴다.
- 숫자 하나하나를 '그래서 무슨 뜻인가'로 해석한다(업종 평균·과거 자기 수준·경쟁사와 비교).
- 가장 강한 반론 3개를 찾아 정면으로 답하고, 반론이 더 강하면 결론을 바꾼다.
- 실패 시나리오(6개월 뒤 -30%라면 원인 3개·조기 경고 신호)와 '생각을 바꿀 조건' 3개를 숫자·사건으로 딱 잘라 쓴다.
- 결론은 행동 수준(검토·관망·분할·비중 조절 등)과 그 조건으로 말한다. 단정적 권유는 하지 않는다.
- 서술형 첫 문단은 【사고 과정】, 마지막 바로 앞 문단은 【실패 시나리오】로 쓴다.
사용자 메시지의 '답변 형식'(## 서술형 / ## 카드형)을 정확히 지킨다. 형식 외 머리말·인사 금지.
길이(v12.66): 서울 서버 시간 한도(5분) 안에 끝나야 한다. 틀이 하나면 서술형 3,000자, 여러 틀(풀세트·6틀)이면 틀마다 핵심 3~4문단 + 종합으로 전체 서술형 7,000자 이내. 웹 검색은 빈칸을 메울 때만(최대 4회). 반드시 '## 서술형'으로 시작하고 '## 카드형' 블록으로 끝낸다 — 길어질 것 같으면 서술을 줄이고 카드형은 꼭 쓴다.`
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
    tier: "main", web: 6, max: 24000, timeout: 250000,
    system: BASE + `
이번 작업: 운영자의 '오늘 아침 한 번' 작업이다. 앱이 준 시장 숫자·핵심 이슈·급등락·거래대금·신호·매크로·일정과 [후보 기사], 필요하면 웹 검색(최대 6회 — 오늘 가장 큰 재료 위주로, 종목별로 낭비하지 말 것)으로 다음 여섯 가지를 한 번에 만든다. 하나의 사실 조사를 여섯 결과가 공유하므로, 같은 사건을 서로 다르게 설명하지 않는다.
1) story: 세 시장을 아우르는 오늘 해설 3줄(각 70자 이하) — 첫 줄은 결론, 줄마다 앱 숫자 최소 하나. bymk: 국내·미국·코인 각각 2줄(그 시장의 지수·업종·급등락만으로, 각 70자 이하).
2) issues: 핵심 이슈마다 왜(누가·무엇을·언제가 드러나는 구체 사건 — 확실하지 않으면 빈칸)·그래서(초보의 계좌 관점)·볼 것(날짜 있는 일정이나 확인할 숫자).
3) movers: 급등·급락·거래대금 급증 종목마다 이유 한 줄(50자 이하, 확실하지 않으면 빈칸). 같은 업종이 함께 움직였으면 업종 이유로.
4) tomorrow: 다음 거래일에 볼 것 4~5개 — [다가오는 일정]과 오늘 이슈를 연결해 '무엇을·언제·왜'. 항목마다 mk(kr|us|coin|all)로 어느 시장 일인지 표시.
5) plan: 오늘 계정에 올릴 카드 편성 — 목표는 노출(저장·공유·댓글·팔로우). [주제 후보]에서 오늘 화제와 연결되는 것을 우선, 같은 이야기를 여러 장 반복하지 않는다. 화제가 많으면 10개를 넘겨도 된다(최대 16). 각 선택에 ctx(후보의 ctx를 글자 그대로 복사)·title(후보 제목 그대로)·mk(그 카드가 다루는 시장 kr|us|coin|all)·왜 오늘·첫 줄 훅(30자 이하)·slot(아침|점심|저녁). 세 시장이 고루 들어가게. 앱 후보에 없지만 꼭 다룰 화제는 extra에(앱에 없는 숫자는 만들지 말 것). 이번 주 남은 요일의 연재 기획 week 3~5개.
길이: why·so·next·movers.why 는 각 70자 이하, 문장 하나씩. 전체 답이 길어져 끊기면 실패이므로 짧게.\n6) reports: 운영자가 오늘 열어 볼 리포트 3~6개 — [리포트 후보]의 id를 그대로. 후보에 없는 종목이 오늘 화제면 kind:"stock"과 정확한 회사명·티커(미국은 영문 티커, 한국은 6자리 코드). 같은 이야기를 겹치게 고르지 않는다.
7) news: '오늘의 주요 뉴스' 카드용 — [후보 기사]와 웹에서 오늘 시장에 영향이 큰 기사 정확히 12개(화제가 많은 날은 정확히 16개 — 카드가 3×4 / 4×4 격자라 개수가 맞아야 함). 각 {cat:"반도체|정책|금리|환율|실적|수급|부동산|코인|해외|산업 중 하나(4자 이내)", title:"기사 핵심 한 줄(28자 이하, 숫자 포함)", pts:["요점 3개, 각 26자 이하"], press:"언론사", url:""}. 같은 사건은 하나로. 마지막에 points: 오늘의 핵심 포인트 5개 {t:"8자 이내 제목", d:"28자 이하 설명"}.
8) sectors: 오늘 국내 주도 업종·테마 3~6개 — [국내 급등 상위]가 있으면 거기서 묶고, 각 {name:"업종·테마(6자 이내)", why:"오늘 오른 이유 한 줄(40자 이하, 사건·날짜)", names:["대표 종목 이름 3~5개(후보 목록의 이름 그대로)"]}. 이유를 모르면 why는 빈칸.
출력: JSON 하나만 {"story":["","",""],"bymk":{"kr":["",""],"us":["",""],"coin":["",""]},"note":"오늘 흐름 한 줄","issues":[{"i":번호,"why":"","so":"","next":"","src":"","url":"","conf":"상|중|하"}],"movers":[{"sym":"티커 그대로","why":"","src":"","url":"","conf":""}],"tomorrow":[{"what":"","when":"","why":"","mk":"kr|us|coin|all"}],"plan":{"summary":"오늘 시장 한 줄","picks":[{"ctx":"","title":"","mk":"kr|us|coin|all","why":"","hook":"","slot":"아침|점심|저녁"}],"extra":[{"title":"","idea":"","data":""}],"week":[{"day":"요일","title":"","hook":"","ctx":""}]},"reports":[{"id":"","kind":"stock|market|macro|timing","name":"","ticker":"","why":""}],"news":[{"cat":"","title":"","pts":["","",""],"press":"","url":""}],"points":[{"t":"","d":""}],"sectors":[{"name":"","why":"","names":[""]}]}`
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
/* v12.51 JSON 꺼내기 — 코드 블록·앞뒤 설명을 견디고, 답이 중간에 끊겼으면(max_tokens) 마지막으로 완성된 값까지 살려서 괄호를 닫는다.
   (예전엔 끊긴 답에서 안쪽의 작은 객체 하나만 건져 '내용 없음'이 되던 버그) */
function tryParse(t) { try { return JSON.parse(t); } catch (e) { try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1").replace(/[\u201c\u201d]/g, '"')); } catch (e2) { return null; } } }
function closeJson(t) {
  // 문자열 밖에서 괄호 깊이를 세고, 끝의 미완성 토큰을 잘라낸 뒤 닫는 괄호를 붙인다
  const stack = []; let inStr = false, esc = false, lastSafe = -1;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') { inStr = false; lastSafe = i; } continue; }
    if (c === '"') inStr = true; else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]"); else if (c === "}" || c === "]") { stack.pop(); lastSafe = i; } else if (c === ",") lastSafe = i - 1;
  }
  if (!stack.length && !inStr) return t;
  let cut = t.slice(0, lastSafe + 1).replace(/,\s*$/, "");
  // 끝이 "키" 로 끝나면(값이 없음) 키를 떼고, "키": 로 끝나면 빈 값을 붙인다
  const m = cut.match(/(,|\{)\s*"[^"]*"\s*$/); if (m) cut = cut.slice(0, cut.length - m[0].length) + (m[1] === "{" ? "{" : "");
  cut = cut.replace(/:\s*$/, ': ""').replace(/,\s*$/, "");
  const st2 = []; let s2 = false, e2 = false;
  for (let i = 0; i < cut.length; i++) { const c = cut[i]; if (s2) { if (e2) e2 = false; else if (c === "\\") e2 = true; else if (c === '"') s2 = false; continue; } if (c === '"') s2 = true; else if (c === "{" || c === "[") st2.push(c === "{" ? "}" : "]"); else if (c === "}" || c === "]") st2.pop(); }
  return cut + st2.reverse().join("");
}
function pickJson(text) {
  text = String(text || "").replace(/```(?:json)?/gi, "");
  const a = text.indexOf("{"); if (a < 0) return null;
  const body = text.slice(a), b = body.lastIndexOf("}");
  let o = b > 0 ? tryParse(body.slice(0, b + 1)) : null; if (o && typeof o === "object") return o;
  o = tryParse(closeJson(body)); if (o && typeof o === "object") { o._truncated = true; return o; }
  // 그래도 안 되면 뒤에서부터 조금씩 잘라 가며(최대 12번) 닫아 본다
  let t = body; for (let k = 0; k < 12 && t.length > 50; k++) { const cutAt = Math.max(t.lastIndexOf(","), t.lastIndexOf("}"), t.lastIndexOf("]")); if (cutAt <= 0) break; t = t.slice(0, cutAt); o = tryParse(closeJson(t)); if (o && typeof o === "object" && Object.keys(o).length) { o._truncated = true; return o; } }
  return null;
}
/* v13.72 글 안의 '짝이 맞는 { … }' 덩어리를 모두 찾아 읽히는 것만 돌려준다(큰 것부터) */
function pickJsonAll(text) {
  text = String(text || "").replace(/```(?:json)?/gi, ""); const out = []; let i = 0;
  while (i < text.length && out.length < 20) {
    const a = text.indexOf("{", i); if (a < 0) break; let d = 0, q = false, e = false, b = -1;
    for (let k = a; k < text.length; k++) { const c = text[k]; if (q) { if (e) e = false; else if (c === "\\") e = true; else if (c === '"') q = false; } else if (c === '"') q = true; else if (c === "{") d++; else if (c === "}") { d--; if (!d) { b = k; break; } } }
    if (b < 0) { i = a + 1; continue; }
    const o = tryParse(text.slice(a, b + 1)); if (o && typeof o === "object") { out.push({ o, n: b - a }); i = b + 1; } else i = a + 1;
  }
  return out.sort((x, y) => y.n - x.n).map((x) => x.o);
}
const API = "https://api.anthropic.com/v1/messages";
/* v12.51 생각(thinking) 블록이 출력 토큰을 크게 먹는 것이 확인됨(한 번에 thinking×3 · 29k 토큰). JSON 작업은 생각 없이 바로 쓰게 한다.
   모델이 이 설정을 모르면(400) 설정 없이 다시 보내고, 그 뒤로는 붙이지 않는다 */
let THINK_OFF_OK = process.env.CLAUDE_THINK_OFF !== "0";
/* v13.98 생각을 끌 수 없는 모델(thinking: disabled 를 400으로 거절 — 문서상 Opus 5.5 등)에서는 생각이 출력 한도(max_tokens)를 먼저 써 버려
   글이 한 글자도 안 나오고 stop: max_tokens 로 끝났다(실적 팔로업 2/4 · 4/4 실패의 원인). 그런 모델에는
   ① 출력 한도에 생각 몫(CLAUDE_THINK_ROOM, 기본 8000)을 더 얹고 ② 생각을 줄이라는 신호(output_config.effort)를 같이 보낸다.
   effort 는 작업이 _effort 로 정한 값(없으면 보내지 않음). 모델이 effort 를 모르면(400) 빼고 다시 보낸다. 모델별로 기억한다 */
const NO_OFF = {}, NO_EFFORT = {};
async function callClaude(key, payload, ms, allowThinkOff) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), Math.max(5000, ms));
  const eff = payload._effort, base = Object.assign({}, payload); delete base._effort; const m = base.model;
  const send = async (p) => { const r = await fetch(API, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(p) }); const j = await r.json().catch(() => null); return { r, j }; };
  const emsg = (o) => String((o.j && o.j.error && o.j.error.message) || "");
  const roomy = () => { const q = Object.assign({}, base, { max_tokens: Math.min(+(process.env.CLAUDE_MAX_OUT || 32000), (base.max_tokens || 4000) + +(process.env.CLAUDE_THINK_ROOM || 8000)) }); if (eff && !NO_EFFORT[m]) q.output_config = Object.assign({}, base.output_config, { effort: eff }); return q; };
  try {
    if (allowThinkOff && THINK_OFF_OK && !NO_OFF[m]) {
      const out = await send(Object.assign({ thinking: { type: "disabled" } }, base));
      if (!(out.r.status === 400 && /thinking/i.test(emsg(out)))) return out;
      NO_OFF[m] = 1;
    }
    if (!allowThinkOff || (!NO_OFF[m] && !THINK_OFF_OK && !eff)) return await send(base);
    let out = await send(roomy());
    if (out.r.status === 400 && /effort|output_config/i.test(emsg(out))) { NO_EFFORT[m] = 1; out = await send(roomy()); }
    return out;
  } finally { clearTimeout(tm); }
}

/* 실제 작업 — 결과 객체를 돌려준다(응답은 claudeHandler 가). used 는 미리 세어 둔 오늘 횟수 */
export async function runClaude(body, key, used) {
  const T = TASKS[body.task];
  /* v14.00 실적 팔로업(받아오기)은 전용 모델을 쓴다 — FOLLOW_MODEL, 없으면 Opus 5.5. 글 작성 등 다른 작업은 그대로 ANTHROPIC_MODEL.
     전용 모델을 이 계정에서 쓸 수 없으면(404 · 모델 오류) 기본 모델로 한 번 더 보낸다 */
  const baseModel = T.tier === "fast" ? (process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5") : (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  let model = T.follow ? (process.env.FOLLOW_MODEL || "claude-opus-5-5") : baseModel, modelFell = null;
  const max = +(process.env.CLAUDE_DAILY_MAX || 60), web = T.web && process.env.COPY_WEB !== "0" && body.web !== false;
  const payload = { model, max_tokens: T.max, _effort: T.effort || undefined, system: T.system, messages: [{ role: "user", content: "오늘: " + kstDay() + " (한국 시간)\n\n" + clip(body.input, 60000) }] };
  if (web) payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: T.web, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }];
  /* v13.80 원문 읽기(web_fetch) — 검색에서 나온 주소의 본문을 읽는다. 추가 요금 없이 읽은 만큼 입력 토큰. 긴 글은 FOLLOW_FETCH_TOKENS(기본 25000)에서 자른다. API가 이 도구를 거절하면 빼고 다시 보낸다 */
  if (web && T.fetch && process.env.COPY_FETCH !== "0") payload.tools.push({ type: "web_fetch_20250910", name: "web_fetch", max_uses: T.fetch, max_content_tokens: +(process.env.FOLLOW_FETCH_TOKENS || T.fetchTok || 14000) });
  /* v12.45 안정화: ① 웹 검색이 길어져 API가 'pause_turn'으로 잠깐 멈추면 이어서 다시 요청(최대 3번) ② JSON이 깨지면 빠른 모델로 형식만 고치는 한 번 더(내용은 그대로) ③ 실패하면 이유(stop)를 같이 알려 준다
     Vercel 함수 한도 300초 안에서 남은 시간을 나눠 쓴다 */
  const t0 = Date.now(), left = () => Math.min(290000, +body.budgetMs || 290000) - (Date.now() - t0);   // v13.70 budgetMs: 한 실행에서 여러 번 부를 때 남은 시간만큼만
  try {
    let blocks = [], j = null, r = null, turns = 0, nofetch = false, bumped = false, usage = { input_tokens: 0, output_tokens: 0 };
    for (;;) {
      ({ r, j } = await callClaude(key, payload, Math.min(T.timeout, left() - (body.json ? 40000 : 5000)), true));   // v12.66 생각(thinking) 블록이 출력 한도를 먹지 않게 모든 작업에서 끔(모델이 거부하면 자동으로 설정 없이)
      if (r.status === 400 && payload.tools && payload.tools.some((t) => t.name === "web_fetch") && /web_fetch|tool/i.test(String(j && j.error && j.error.message || ""))) { payload.tools = payload.tools.filter((t) => t.name !== "web_fetch"); nofetch = true; continue; }
      if (T.follow && !modelFell && model !== baseModel && (r.status === 404 || (r.status === 400 && /model/i.test(String(j && j.error && j.error.message || ""))) || r.status === 403)) { modelFell = model + " 사용 불가(" + r.status + ") → " + baseModel; model = baseModel; payload.model = baseModel; continue; }
      if (!r.ok || !j) return { ok: false, reason: "API_" + r.status, msg: clip(j && j.error && j.error.message, 240) || ("Claude API 오류 " + r.status) };
      blocks = blocks.concat(j.content || []); if (j.usage) { usage.input_tokens += j.usage.input_tokens || 0; usage.output_tokens += j.usage.output_tokens || 0; }
      /* 글 없이 생각만 하다 출력 한도에 걸린 경우 — 한도를 키워 한 번 더(도구 결과가 없을 때만: 검색을 다시 하지 않게) */
      if (j.stop_reason === "max_tokens" && !bumped && left() > 80000 && !blocks.some((b) => b.type === "text" && b.text.trim()) && !blocks.some((b) => /tool/.test(b.type))) { bumped = true; blocks = []; payload.max_tokens = Math.min(+(process.env.CLAUDE_MAX_OUT || 32000), payload.max_tokens * 2); continue; }
      if (j.stop_reason === "pause_turn" && turns < 3 && left() > 60000) { turns++; payload.messages = payload.messages.concat([{ role: "assistant", content: j.content }]); continue; }
      break;
    }
    /* v12.67 거절(stop_reason "refusal", 출력 0) — 안전 분류기가 요청 시작부터 막은 경우. 같은 내용을 '교육·정보 목적의 데이터 정리'로 밝히고
       ① 같은 모델 · 웹 검색 없이 · 생각 설정 기본값으로 한 번 ② 그래도 거절이면 다른 모델(ANTHROPIC_FALLBACK_MODEL, 없으면 빠른 모델)로 한 번 */
    let retry = null;
    if (j && j.stop_reason === "refusal" && !blocks.some((b) => b.type === "text" && b.text.trim()) && left() > 40000) {
      const frame = "[운영자 메모] 아래는 개인 학습·콘텐츠 제작용 데이터 정리 요청이에요. 특정인에게 매수·매도를 권유하거나 수익을 보장하는 글이 아니고, 공개 데이터의 해석과 그 근거·한계를 정리하는 일이에요. 같은 형식으로 답해 주세요.\n\n";
      const msgs = [{ role: "user", content: frame + payload.messages[0].content }];
      const tries = [{ model, tag: "같은 모델·웹 없이" }, { model: process.env.ANTHROPIC_FALLBACK_MODEL || process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5", tag: "대체 모델" }];
      for (const tr of tries) {
        if (left() < 40000) break;
        const rr = await callClaude(key, { model: tr.model, max_tokens: T.max, system: T.system, messages: msgs }, Math.min(T.timeout, left() - 5000), false).catch(() => null);
        if (!rr || !rr.r.ok || !rr.j) continue;
        if (rr.j.usage) { usage.input_tokens += rr.j.usage.input_tokens || 0; usage.output_tokens += rr.j.usage.output_tokens || 0; }
        if (rr.j.stop_reason !== "refusal" && (rr.j.content || []).some((b) => b.type === "text" && b.text.trim())) { blocks = rr.j.content; j = rr.j; retry = "거절 → " + tr.tag + "(" + tr.model + ")"; break; }
        retry = "거절 → " + tr.tag + "도 거절";
      }
    }
    /* v12.48 글 없이 끝난 경우(검색만 하다 max_tokens 등) — 지금까지 모은 검색 결과를 그대로 이어 붙이고 "이제 결과만 써라"고 한 번 더(도구 없이). 그래도 안 되면 웹 없이 앱 숫자만으로 새로 */
    let finish = null, textNow = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const firstStop = j && j.stop_reason, tooShort = !!(+body.minText && textNow.length < +body.minText);
    if (tooShort) blocks = blocks.filter((b) => b.type !== "text");   // 도구 사이의 머리말만 있는 경우 — 머리말은 버리고 읽은 자료만 남겨 다시 쓰게 한다
    if ((!textNow || tooShort) && left() > 45000) {
      const ask = { role: "user", content: body.finishAsk || "검색은 여기까지. 지금까지 읽은 자료와 앱 숫자로 바로 결과를 써 줘. 다른 말 없이 " + (body.json ? "JSON 하나만." : body.task === "analyst" ? "'## 서술형'으로 시작해 '## 카드형' 블록까지, 처음 요청한 답변 형식 그대로." : "결과만.") };
      let f1 = null;
      if (blocks.length) { try { f1 = await callClaude(key, { model, max_tokens: T.max, _effort: T.effort || undefined, system: T.system, messages: payload.messages.concat([{ role: "assistant", content: blocks.filter((b) => b.type !== "thinking" && b.type !== "redacted_thinking") }, ask]) }, Math.min(T.timeout, left() - 30000), true); } catch (e) { f1 = null; } }
      if (tooShort && !blocks.length) { try { f1 = await callClaude(key, { model, max_tokens: T.max, _effort: T.effort || undefined, system: T.system, messages: [payload.messages[0], { role: "assistant", content: "(자료를 충분히 찾지 못했다)" }, ask] }, Math.min(T.timeout, left() - 10000), true); } catch (e) { f1 = null; } }
      if (!tooShort && !(f1 && f1.r.ok && f1.j && (f1.j.content || []).some((b) => b.type === "text" && b.text.trim())) && left() > 45000) { try { f1 = await callClaude(key, { model, max_tokens: T.max, _effort: T.effort || undefined, system: T.system, messages: [payload.messages[0], { role: "user", content: "(웹 검색 없이) 위 앱 숫자와 후보 기사만으로 바로 결과를 써 줘. 다른 말 없이 " + (body.json ? "JSON 하나만." : "결과만.") }] }, Math.min(T.timeout, left() - 5000), true); } catch (e) { f1 = null; } }
      if (f1 && f1.r.ok && f1.j) { finish = f1.j.stop_reason || "finish"; blocks = blocks.concat(f1.j.content || []); if (f1.j.usage) { usage.input_tokens += f1.j.usage.input_tokens || 0; usage.output_tokens += f1.j.usage.output_tokens || 0; } }
    }
    const texts = blocks.filter((b) => b.type === "text").map((b) => b.text), text = texts.join("");
    const kinds = {}; blocks.forEach((b) => { kinds[b.type] = (kinds[b.type] || 0) + 1; });
    const src = [], seen = {};
    blocks.forEach((b) => { (b.citations || []).forEach((c) => { if (c.url && !seen[c.url]) { seen[c.url] = 1; src.push({ t: clip(c.title, 90), u: c.url }); } }); });
    const searches = blocks.filter((b) => b.type === "server_tool_use").map((b) => b.input && b.input.query).filter(Boolean);
    const fetched = blocks.filter((b) => b.type === "server_tool_use" && b.name === "web_fetch").map((b) => b.input && b.input.url).filter(Boolean);
    fetched.forEach((u) => { if (!seen[u]) { seen[u] = 1; src.push({ t: clip(u.replace(/^https?:\/\/(www\.)?/, ""), 70), u }); } });
    const out = { ok: true, task: body.task, model: (j && j.model) || model, text, sources: src.slice(0, 12), searches, fetched, nofetch, firstStop, tooShort, modelFell, used, max, stop: j.stop_reason, finish, turns, usage, blocks: kinds, retry };
    if (body.json) {
      out.data = pickJson(text); if (out.data && out.data._truncated) { out.truncated = true; delete out.data._truncated; }
      if (!out.data) { const all = pickJsonAll(text); if (all[0] && Object.keys(all[0]).length) out.data = all[0]; }   // 머리말의 { 때문에 못 읽은 경우
      /* v13.72 꼭 있어야 하는 칸(body.need)이 없으면 읽지 못한 것으로 보고 아래 '형식만 고치기'로 넘긴다. 한 겹 싸여 온 답({"data":{…}})은 벗긴다 */
      const need = Array.isArray(body.need) ? body.need : null, has = (o) => o && typeof o === "object" && need.every((k) => String(k).split("|").some((a) => o[a] != null && o[a] !== ""));
      if (need && out.data && !has(out.data)) {
        const inner = Object.keys(out.data).map((k) => out.data[k]).filter((v) => v && typeof v === "object" && !Array.isArray(v) && has(v))[0];
        const other = inner ? null : pickJsonAll(text).map((o) => (has(o) ? o : Object.keys(o).map((k) => o[k]).filter((v) => v && typeof v === "object" && !Array.isArray(v) && has(v))[0])).filter(Boolean)[0];   // 머리말에 { 가 섞였거나 JSON이 여러 개일 때
        if (inner || other) out.data = inner || other; else { out.gotKeys = Object.keys(out.data).slice(0, 14); out.data = null; }
      }
      if (!out.data && left() > 25000) {   // 형식만 고치기 — 빠른 모델 · 웹 없음 · 횟수에 안 셈
        const schema = String(T.system).split("출력:").pop().trim();
        const fix = await callClaude(key, { model: process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5", max_tokens: Math.max(4000, T.max), system: "너는 JSON 정리기다. 아래 [원문]에 담긴 내용을 [형식]에 맞는 올바른 JSON 하나로만 출력한다. 내용·숫자·출처는 한 글자도 바꾸거나 더하지 않는다. 문자열 안의 큰따옴표는 ‘ ’로 바꾼다. 원문이 중간에 끊겼으면 있는 내용만 담고, 없는 칸은 빈 문자열·빈 배열로 둔다. JSON 외의 말 금지.", messages: [{ role: "user", content: "[형식]\n" + schema + "\n\n[원문]\n" + clip(text, 40000) }] }, left() - 3000).catch(() => null);
        const ft = fix && fix.j && (fix.j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
        out.data = ft ? pickJson(ft) : null; if (out.data && need && !has(out.data)) { out.gotKeys = Object.keys(out.data).slice(0, 14); out.data = null; } if (out.data) { out.repaired = true; delete out.data._truncated; }
      }
      if (!out.data) { out.ok = false; out.reason = "PARSE"; out.msg = "AI 응답을 읽지 못했어요" + (j.stop_reason === "max_tokens" ? " — 답이 너무 길어 중간에 끊겼어요(다시 시도하면 대개 됩니다)" : j.stop_reason === "pause_turn" ? " — 웹 검색이 길어져 답을 끝내지 못했어요" : !text.trim() ? " — 답 본문이 비어 있어요(웹 검색만 하고 끝남 · 블록: " + Object.keys(kinds).map((k) => k + "×" + kinds[k]).join(", ") + ")" : " — 형식이 깨졌어요") + " [stop: " + j.stop_reason + (finish ? " → 마무리 " + finish : "") + " · 블록: " + Object.keys(kinds).map((k) => k + "×" + kinds[k]).join(", ") + " · 출력 토큰 " + usage.output_tokens + (out.gotKeys ? " · 받은 칸: " + (out.gotKeys.join(",") || "없음") : "") + "]"; out.text = clip(text, 600); }
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
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body) return res.status(400).json({ ok: false, reason: "본문 필요" });
  // v12.70 수동 모드: 운영자가 claude.ai에 직접 붙여넣을 수 있게 작업 지시문만 돌려준다 (API 키 불필요 · 운영자 토큰은 channel.js에서 확인)
  if (body.prompt) { const T = TASKS[body.task]; if (!T) return res.status(200).json({ ok: false, reason: "NO_TASK" }); return res.status(200).json({ ok: true, task: body.task, system: T.system, web: T.web || 0, max: T.max || 0 }); }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" });
  const rc = redisConf();
  // v12.50 오늘 브리핑 하루치 — 어느 기기에서 열어도 같은 결과 (3일 보관). 결과를 받은 쪽이 저장(PUT)하고, 다른 기기는 불러온다(GET)
  if (body.today) {
    if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
    const k = "sm:daily:" + kstDay();
    if (body.put && typeof body.put === "object") { try { await setJsonGz(rc, k, Object.assign({ at: Date.now() }, body.put), 3 * 86400); } catch (e) { return res.status(200).json({ ok: false, reason: "SAVE" }); } return res.status(200).json({ ok: true, saved: true }); }
    try { const t = await getJsonGzText(rc, k); return res.status(200).json(t ? Object.assign({ ok: true }, JSON.parse(t)) : { ok: false, reason: "NONE" }); } catch (e) { return res.status(200).json({ ok: false, reason: "READ" }); }
  }
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
