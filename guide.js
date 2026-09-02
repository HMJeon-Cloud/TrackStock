"use strict";
/* ============================================================
   StockMind — "어떻게 투자하면 될까?" 안내 탭
   투자 접근법을 나열하고, 선택하면 원리·이 앱에서 볼 데이터·함정을
   설명한 뒤 해당 표/차트로 바로 이동하는 버튼을 제공한다.
   ============================================================ */

/* ---------- 이동 도우미 ----------
   spec: { tab, sub, id, needSymbol }
   - 개별 종목 화면인데 아직 조회한 종목이 없으면 접근법의 예시 종목을 자동 조회한 뒤 이동한다.
   - 장바구니/시뮬레이터 화면인데 장바구니가 비었으면 예시 장바구니를 채우고 실행한 뒤 이동한다.
   예시 종목은 표 읽는 법을 익히기 위한 것이며 추천이 아니다. */
/* 대상까지 스크롤하고 잠시 강조한다.
   <table>은 그림자가 잘 보이지 않으므로 감싸는 .tableWrap 또는 카드에 테두리를 준다.
   아직 그려지지 않았으면(숨김 상태) 잠깐씩 기다리며 최대 6초까지 재시도한다. */
function guideScrollTo(id, tries) {
  if (!id) return;
  tries = tries || 0;
  setTimeout(function () {
    var el = $(id);
    if (!el || el.offsetParent === null) {
      if (tries < 20) guideScrollTo(id, tries + 1);
      return;
    }
    var box = el;
    if (el.tagName === "TABLE" || el.tagName === "CANVAS") {
      box = el.closest(".tableWrap") || el.closest(".card") || el;
    }
    var top = box.getBoundingClientRect().top + window.scrollY - ($("topbar").offsetHeight + 12);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    box.style.transition = "box-shadow .3s";
    box.style.borderRadius = box.style.borderRadius || "8px";
    box.style.boxShadow = "0 0 0 2px var(--accent)";
    setTimeout(function () { box.style.boxShadow = ""; }, 2200);
  }, tries === 0 ? 120 : 300);
}

function guideExampleNote(symbolLabel) {
  return "예시로 <b>" + symbolLabel + "</b>을(를) 자동 조회했습니다. 표 읽는 연습용이며 추천이 아닙니다. " +
    "검색창에서 원하는 종목으로 바꿔 보세요.";
}

function guideGo(spec, method) {
  var needSymbol = spec.needSymbol !== false && spec.tab === "single";

  /* 개별 종목 화면 + 종목 없음 → 예시 종목 자동 조회 */
  if (needSymbol && (!state.rows || !state.rows.length)) {
    var ex = (method && method.example) || "SPY";
    navTo("single", spec.sub || "analysis", { fromGuide: true });
    $("searchInput").value = ex;
    if (spec.sub === "insight") $("rangeSel").value = "20y"; // 인사이트 통계는 긴 기간이 필요
    state.onLoaded = function () {
      if (spec.sub === "insight" && typeof renderInsight === "function") renderInsight();
      setStatus(guideExampleNote(cmpLabel(ex)));
      guideScrollTo(spec.id);
    };
    loadSymbol(ex);
    return;
  }

  /* 장바구니/시뮬레이터 화면 + 장바구니 비어 있음 → 예시 장바구니 */
  if ((spec.tab === "compare" || spec.tab === "sim") && !cmpState.cart.length && method && method.exampleCart) {
    var items = method.exampleCart;
    cmpState.cart = items.map(function (a) { return a[0]; });
    items.forEach(function (a) { simState.weights[a[0]] = a[1]; });
    renderChips();
    navTo(spec.tab, spec.sub, { fromGuide: true });
    var labels = items.map(function (a) { return cmpLabel(a[0]); }).join(", ");
    var note = "예시 장바구니(" + labels + ")를 채우고 실행했습니다. 연습용이며 추천이 아닙니다.";
    if (spec.tab === "sim") {
      syncSimAssets();
      setSimStatus("예시 장바구니를 불러오는 중...");
      simState.onDone = function () { setSimStatus(note); guideScrollTo(spec.id); };
      setTimeout(function () { $("simRun").click(); }, 100);
    } else {
      setCmpStatus("예시 장바구니를 불러오는 중...");
      cmpState.onDone = function () { setCmpStatus(note); guideScrollTo(spec.id); };
      setTimeout(function () { $("cmpRun").click(); }, 100);
    }
    return;
  }

  navTo(spec.tab, spec.sub, { fromGuide: true });

  // 장바구니는 있는데 아직 비교/시뮬을 실행하지 않아 표가 비어 있으면 자동 실행
  if (spec.tab === "compare" && cmpState.cart.length >= 1 && $("cmpBody").classList.contains("hidden")) {
    cmpState.onDone = function () { guideScrollTo(spec.id); };
    setTimeout(function () { $("cmpRun").click(); }, 100);
    return;
  }
  if (spec.tab === "sim" && cmpState.cart.length >= 1 && $("simBody").classList.contains("hidden")) {
    syncSimAssets();
    simState.onDone = function () { guideScrollTo(spec.id); };
    setTimeout(function () { $("simRun").click(); }, 100);
    return;
  }
  guideScrollTo(spec.id);
}

/* 프리셋 포트폴리오를 장바구니·시뮬레이터에 적재하고 실행 */
function guideLoadPortfolio(assets) {
  cmpState.cart = assets.map(function (a) { return a[0]; });
  assets.forEach(function (a) { simState.weights[a[0]] = a[1]; });
  renderChips();
  navTo("sim", null, { fromGuide: true });
  syncSimAssets();
  simState.onDone = function () { guideScrollTo("simBadges"); };
  setTimeout(function () { $("simRun").click(); }, 100);
}

/* ---------- 접근법 정의 ---------- */
var GUIDE_METHODS = [
  {
    id: "mdd",
    example: "SPY",
    exampleCart: [["SPY", 50], ["TLT", 30], ["GLD", 20]],
    icon: "📉",
    title: "낙폭(MDD) 기준 투자",
    tag: "하락을 기회로 · 이 앱의 본래 목적",
    who: "좋은 자산을 오래 들고 가고 싶은데 하락장이 올 때마다 팔고 싶어지는 사람. 폭락 때 '지금 사도 되나'를 데이터로 판단하고 싶은 사람.",
    idea: "모든 자산은 주기적으로 고점 대비 크게 떨어집니다. 그 <b>하락의 깊이와 빈도, 회복 시간</b>을 과거에서 미리 알아두면, 실제 하락이 왔을 때 '역대 몇 번째 크기인지'를 알 수 있어 공포에 팔지 않게 됩니다. 반대로 역대급 낙폭 구간은 장기적으로 <b>분할 매수 기회</b>였던 경우가 많습니다.",
    steps: [
      { t: "연도별 최고가·최저가와 연간수익을 봅니다", d: "해마다 연초 대비 얼마나 올랐다 내렸다를 반복했는지 감각을 잡습니다. 최저가 옆 %가 '그 해에 이만큼 빠진 순간이 있었다'입니다.", go: { tab: "single", sub: "analysis", id: "yearCard" }, label: "연도별 핵심 지표" },
      { t: "고점 대비 하락 표에서 낙폭의 크기·기간·회복일을 봅니다", d: "-30%가 몇 번, 회복까지 평균 며칠 걸렸는지. 진행 중인 하락은 ▼하락중/△반등중/▲회복임박 상태를 봅니다.", go: { tab: "single", sub: "analysis", id: "ddCard" }, label: "Drawdown 표" },
      { t: "저점 대비 상승 표로 바닥 이후 반등의 크기를 봅니다", d: "낙폭 표와 짝입니다. 깊게 빠진 뒤 얼마나 올랐는지가 '버틴 대가'입니다.", go: { tab: "single", sub: "analysis", id: "rallyCard" }, label: "Rally 표" },
      { t: "인사이트에서 현재 위치를 확인합니다", d: "전고점 대비 %, 역대 낙폭 순위, 10%+ 하락 회복 확률과 회복 소요일 중앙값 — 지금이 어떤 시점인지 한 줄로 나옵니다.", go: { tab: "single", sub: "insight", id: "insPosBadges" }, label: "현재 위치" },
      { t: "내 평단가를 넣고 최악 시나리오를 미리 봅니다", d: "과거 최악 낙폭이 재현되면 내 계좌가 어디까지 가는지. 그 숫자를 견딜 수 있어야 이 방법이 맞는 사람입니다.", go: { tab: "single", sub: "analysis", id: "avgCard" }, label: "평단가 시나리오" }
    ],
    rule: "예시 규칙: 역대 낙폭 순위 상위 30% 안에 들어오는 하락이 오면 정해둔 금액의 1/3씩 세 번에 나눠 삽니다. 낙폭이 -20%, -30%, -40%를 지날 때마다 한 번씩. 회복 소요일 중앙값만큼은 기다릴 각오를 합니다.",
    trap: "지수·우량 ETF에서 통하는 방법입니다. 개별 종목은 <b>영영 회복 못 하는 경우</b>가 있어(생존 편향) 같은 규칙을 적용하면 안 됩니다. 인사이트 하단의 경고를 꼭 읽으세요."
  },
  {
    id: "longterm",
    example: "SPY",
    exampleCart: [["SPY", 60], ["TLT", 40]],
    icon: "⏳",
    title: "장기 보유 · 적립식 투자",
    tag: "시간을 내 편으로",
    who: "매매 타이밍을 잡을 자신이 없는 사람. 월급에서 일정액을 꾸준히 넣고 신경을 끄고 싶은 사람.",
    idea: "언제 샀느냐보다 <b>얼마나 오래 들고 있었느냐</b>가 결과를 가르는 자산이 있습니다. 보유 기간이 길수록 손실로 끝날 확률이 줄어드는지를 과거 전 구간에서 확인하고, 매월 나눠 사면 평균 매수가가 자동으로 낮아지는 효과(적립식)를 검증합니다.",
    steps: [
      { t: "보유기간별 손실 확률 표를 봅니다", d: "1년·3년·5년·10년 보유 시 손실로 끝난 비율. 아래로 갈수록 0%에 가까워지는 자산이 이 방법에 맞습니다. 줄지 않는 자산도 있습니다.", go: { tab: "single", sub: "insight", id: "insHolding" }, label: "보유기간별 손실 확률" },
      { t: "'가장 많이 오른 며칠을 놓쳤다면' 표를 봅니다", d: "시장을 들락거리면 급등일을 놓쳐 수익이 어떻게 무너지는지. 단, 반대 계산도 함께 보고 균형 있게 판단하세요.", go: { tab: "single", sub: "insight", id: "insTopDays" }, label: "급등일 제외 분석" },
      { t: "장바구니 비교에서 거치식 vs 적립식을 비교합니다", d: "투자 방식을 '적립식'으로 바꾸고 최악의 타이밍(고점) 프리셋으로 시작해 보세요. 고점에 시작해도 적립식이면 결과가 어떻게 달라지는지 보입니다.", go: { tab: "compare", id: "compareCard", needSymbol: false }, label: "장바구니 비교" },
      { t: "시뮬레이터에 매월 추가금을 넣고 돌립니다", d: "초기 투자금 + 매월 추가금으로 실제 내 월급 계획을 그대로 넣어 10년 뒤를 봅니다.", go: { tab: "sim", id: "simCard", needSymbol: false }, label: "시뮬레이터" }
    ],
    rule: "예시 규칙: 손실 확률이 5년 보유에서 10% 아래로 떨어지는 자산만 고릅니다. 매월 같은 날 같은 금액을 사고, 낙폭 -20% 이상이면 그 달만 2배로 삽니다. 팔 때는 '목표 금액'이나 '필요한 시점'으로만 정합니다.",
    trap: "이 통계는 조회 기간 안에서만 계산됩니다. 상승장만 들어간 10년으로 보면 손실 확률이 실제보다 낮게 나옵니다. <b>기간을 '전체'로</b> 바꿔 다시 보고, 니케이225 같은 반례도 조회해 보세요."
  },
  {
    id: "portfolio",
    example: "SPY",
    exampleCart: [["SPY", 60], ["TLT", 40]],
    icon: "🧺",
    title: "자산배분 포트폴리오",
    tag: "떨어질 때 다른 게 받쳐주게",
    who: "한 종목의 -50%를 견딜 자신이 없는 사람. 수익률보다 '밤에 잠을 잘 자는 것'이 중요한 사람.",
    idea: "서로 <b>다르게 움직이는 자산</b>을 섞으면 전체 계좌의 낙폭이 줄어듭니다. 주식이 빠질 때 국채·금이 버텨 준 역사가 있고, 이를 상관계수로 확인합니다. 정해진 비율로 나눠 사고, 비율이 틀어지면 되돌리는 것(리밸런싱)이 전부입니다.",
    presets: [
      { name: "클래식 60/40", desc: "주식 60 · 장기채 40. 가장 오래 검증된 기본형", assets: [["SPY", 60], ["TLT", 40]] },
      { name: "성장형 70/30", desc: "주식 비중을 올린 공격형. 낙폭도 커짐", assets: [["SPY", 70], ["TLT", 30]] },
      { name: "영구 포트폴리오", desc: "주식·장기채·금·단기채 25%씩. 어떤 국면에서도 하나는 버팀", assets: [["SPY", 25], ["TLT", 25], ["GLD", 25], ["SHY", 25]] },
      { name: "올웨더(간이형)", desc: "주식30 · 장기채40 · 중기채15 · 금8 · 원자재7", assets: [["SPY", 30], ["TLT", 40], ["IEF", 15], ["GLD", 8], ["DBC", 7]] },
      { name: "한국형 3분법", desc: "코스피200 40 · 미국주식 30 · 금 30 (전부 국내 상장 ETF)", assets: [["069500.KS", 40], ["360750.KS", 30], ["132030.KS", 30]] }
    ],
    steps: [
      { t: "위 프리셋 하나를 눌러 시뮬레이터로 보냅니다", d: "장바구니가 채워지고 시뮬레이션이 바로 실행됩니다. 최대낙폭이 단일 자산 100%보다 얼마나 얕은지 먼저 보세요.", go: null },
      { t: "장바구니 비교의 상관계수 행렬을 읽습니다", d: "1에 가까우면 같이 움직임(분산 효과 없음), 0 근처면 따로 움직임, 음수면 반대로 움직임(최고의 짝). 주식-장기채가 대체로 0~-0.3, 주식-금 0 근처, 주식-나스닥 0.9 이상입니다.", go: { tab: "compare", id: "cmpCorr", needSymbol: false }, label: "상관계수 행렬" },
      { t: "사건별 성과 표로 위기 때 무엇이 버텼는지 봅니다", d: "코로나·2022 금리인상기에 각 자산이 어떻게 반응했는지. 위기 때 플러스인 자산이 진짜 헷지입니다.", go: { tab: "compare", id: "cmpCrisis", needSymbol: false }, label: "사건별 성과" },
      { t: "시뮬레이터에서 비중과 리밸런싱 주기를 바꿔 봅니다", d: "리밸런싱 효과(금액)와 낙폭 개선(%p)이 배지에 나옵니다. 리밸런싱은 수익보다 안정성을 사는 행위임을 확인하세요.", go: { tab: "sim", id: "simCard", needSymbol: false }, label: "시뮬레이터" }
    ],
    rule: "예시 규칙: 내가 견딜 수 있는 최대낙폭을 먼저 정합니다(예: -20%). 프리셋 중 그 안에 들어오면서 CAGR이 가장 높은 것을 고르고, 연 1회 같은 날 리밸런싱합니다. 자산은 3~5개면 충분하고, 서로 상관계수 0.5 이하인 것끼리 묶습니다.",
    trap: "2022년처럼 주식과 채권이 <b>함께</b> 떨어지는 해도 있습니다. 상관계수는 고정값이 아니라 국면마다 바뀝니다. 그리고 리밸런싱은 실제로는 세금·수수료가 붙어 시뮬레이터보다 이득이 작습니다."
  },
  {
    id: "trend",
    example: "QQQ",
    exampleCart: [["QQQ", 50], ["SPY", 50]],
    icon: "📈",
    title: "추세 추종 (이동평균선)",
    tag: "오르는 것을 타고, 꺾이면 내린다",
    who: "큰 하락장을 아예 피하고 싶은 사람. 자주 사고파는 것을 감수할 수 있는 사람.",
    idea: "주가가 <b>장기 이동평균선(240일선) 위</b>에 있으면 상승 추세, 아래면 하락 추세로 봅니다. 위에 있을 때만 들고, 아래로 내려오면 팝니다. 큰 폭락은 대부분 240일선 아래에서 일어나므로 이를 피하는 것이 목표입니다. 대신 잦은 거짓 신호로 자잘한 손실이 쌓입니다.",
    steps: [
      { t: "차트에 이동평균선을 켜고 현재가와 240일선 위치를 봅니다", d: "20일(파랑)·60일(초록)·240일(보라). 주가 > 20일선 > 60일선 > 240일선 순으로 위에서 아래로 놓이면(정배열) 강한 상승 추세, 그 반대(역배열)면 하락 추세입니다.", go: { tab: "single", sub: "analysis", id: "chartCard" }, label: "메인 차트 (이동평균선 체크)" },
      { t: "전문가 지표에서 240일선 이격도를 확인합니다", d: "이격이 +20% 넘으면 과열(평균으로 되돌아올 힘), -20% 아래면 과매도. 추세 안에서 진입 시점을 고를 때 씁니다.", go: { tab: "single", sub: "analysis", id: "metricsCard" }, label: "전문가 지표" },
      { t: "52주 최고·최저 대비 위치를 봅니다", d: "52주 신고가 부근에서 이동평균이 정배열(주가가 모든 평균선 위)이면 전형적인 추세 추종 진입 구간입니다.", go: { tab: "single", sub: "analysis", id: "metricsCard" }, label: "52주 위치" },
      { t: "낙폭 표에서 추세가 꺾인 뒤 얼마나 더 빠졌는지 봅니다", d: "이 방법이 통했는지는 '240일선 이탈 후 추가 하락폭'으로 판단합니다. 큰 낙폭 대부분이 이탈 후에 나왔다면 유효한 자산입니다.", go: { tab: "single", sub: "analysis", id: "ddCard" }, label: "Drawdown 표" }
    ],
    rule: "예시 규칙: 월말 종가가 240일선 위면 보유, 아래면 전량 현금(또는 단기채). 월 1회만 확인해 잦은 신호를 걸러냅니다. 신호가 틀려 손실이 나도 규칙을 바꾸지 않습니다.",
    trap: "옆으로 기는 장(횡보장)에서는 신호가 켜졌다 꺼졌다를 반복해 <b>샀다 팔았다 하며 잔손실이 쌓입니다</b>(이를 휩소라 부릅니다). 2년에 한 번꼴로 오는 진짜 폭락을 피한 이익으로 그 손실을 메우는 구조라, 몇 년은 지수보다 못할 각오가 필요합니다. 세금·수수료도 큽니다."
  },
  {
    id: "meanrev",
    example: "005930.KS",
    exampleCart: [["005930.KS", 50], ["^KS11", 50]],
    icon: "🌡️",
    title: "과열·침체 역이용 (RSI · 지지/저항 · 캔들)",
    tag: "쏠림이 심할 때 반대로",
    who: "단기 매매에 관심 있는 사람. 단, 초보자는 '언제 사지 않을지' 판단에만 쓰는 것을 권합니다.",
    idea: "시장은 가끔 한쪽으로 지나치게 쏠립니다. RSI 30 아래(침체)·지지선·긴 아래꼬리 캔들이 <b>동시에</b> 나타나면 단기 반등 확률이 높고, RSI 70 위·저항선·긴 윗꼬리가 겹치면 단기 조정 확률이 높습니다. 핵심은 <b>겹칠 때만</b> 신호로 보는 것입니다.",
    steps: [
      { t: "전문가 지표에서 RSI(14)를 봅니다", d: "70 이상 과열, 30 이하 침체. 강한 추세에서는 70 위에 몇 달 머물기도 하니 단독으로 쓰지 마세요.", go: { tab: "single", sub: "analysis", id: "metricsCard" }, label: "RSI" },
      { t: "지지·저항선 표와 차트 오버레이를 봅니다", d: "현재가가 지지선 바로 위인지, 저항선 바로 아래인지. 터치 횟수 2회 이상인 선만 의미 있습니다.", go: { tab: "single", sub: "analysis", id: "techCard" }, label: "지지/저항선" },
      { t: "캔들 차트에서 최근 5일 모양을 봅니다", d: "지지선에서 망치형(긴 아래꼬리) + 거래량 증가면 매수세 유입, 저항선에서 유성형(긴 윗꼬리)이면 매도 압력.", go: { tab: "single", sub: "analysis", id: "candleCard" }, label: "캔들 차트" },
      { t: "급등·급락 군집 분석으로 변동성 국면인지 확인합니다", d: "최고 상승일과 최악 하락일이 며칠 간격으로 붙어 있는 시기는 예측이 거의 불가능합니다. 이때는 매매를 쉬는 것도 방법입니다.", go: { tab: "single", sub: "insight", id: "insWorstList" }, label: "급등·급락 군집" }
    ],
    rule: "초보자 예시 규칙(매수 억제용): RSI 70 이상이거나 저항선 3% 안에 있으면 그 주에는 사지 않습니다. 매수는 RSI 40 아래 + 지지선 5% 안 + 아래꼬리 캔들, 세 조건이 같은 날 겹칠 때만.",
    trap: "이 방법으로 <b>돈을 버는 것</b>과 <b>잃지 않는 것</b>은 다릅니다. 떨어지는 칼을 잡는 것이 가장 흔한 실패이고, RSI 30 아래에서 계속 더 빠지는 일은 매우 흔합니다. 손절선을 지지선 아래 2~3%에 두고 반드시 지켜야 합니다."
  },
  {
    id: "riskadj",
    example: "SPY",
    exampleCart: [["SPY", 25], ["QQQ", 25], ["TLT", 25], ["GLD", 25]],
    icon: "⚖️",
    title: "위험조정 수익 비교 (샤프 · 소르티노)",
    tag: "같은 수익이면 덜 흔들리는 것을",
    who: "ETF·펀드·자산군을 비교해 고르려는 사람. '수익률 1위'에 끌리는 습관을 고치고 싶은 사람.",
    idea: "수익률만 보면 가장 많이 오른 것이 항상 이깁니다. 하지만 그 과정에서 <b>얼마나 흔들렸는지</b>를 나누면 순위가 뒤집힙니다. 샤프 비율(전체 변동성 대비)과 소르티노(하락 변동성 대비)로 '효율'을 비교하면, 실제로 끝까지 들고 갈 수 있는 자산이 드러납니다.",
    steps: [
      { t: "전문가 지표에서 샤프·소르티노를 확인합니다", d: "1 이상 우수, 0.5~1 양호, 0 미만은 예금보다 못한 장사. 무위험 수익률은 현재 예금금리를 넣으세요.", go: { tab: "single", sub: "analysis", id: "metricsCard" }, label: "전문가 지표" },
      { t: "장바구니에 후보를 담고 자산별 요약 표를 비교합니다", d: "총수익·CAGR·최대낙폭·연변동성이 한 표에 나옵니다. CAGR ÷ 최대낙폭(칼마 비율: 고통 1%당 얻은 연수익)을 머릿속으로 계산해 보세요. 예: CAGR 12%, 낙폭 30%면 0.4.", go: { tab: "compare", id: "cmpSummary", needSymbol: false }, label: "자산별 요약" },
      { t: "시뮬레이터 전략 비교 표를 봅니다", d: "각 자산 100%와 섞은 포트폴리오의 수익·낙폭·변동성을 나란히. 수익 1위가 낙폭도 1위인 것을 확인하세요.", go: { tab: "sim", id: "simCompare", needSymbol: false }, label: "전략 비교" }
    ],
    rule: "예시 규칙: 후보 중 최대낙폭이 내 한계 안에 드는 것만 남기고, 그중 샤프 비율이 가장 높은 것을 고릅니다. 수익률은 마지막에 봅니다.",
    trap: "샤프 비율은 <b>조회 기간에 따라 크게 바뀝니다.</b> 상승장 10년만 보면 모든 자산이 우수해 보입니다. 기간을 전체로 바꿔 위기가 포함된 상태에서 비교하세요."
  },
  {
    id: "value",
    example: "005930.KS",
    exampleCart: [["005930.KS", 50], ["069500.KS", 50]],
    icon: "🏢",
    title: "가치 투자 (PER · PBR · ROE)",
    tag: "가격이 아니라 회사를 산다",
    who: "개별 기업에 투자하려는 사람. 차트보다 '이 회사가 장사를 잘하나'가 궁금한 사람.",
    idea: "좋은 회사(ROE 높음, 부채 적음, 이익 증가)를 <b>싼 값(업종 대비 낮은 PER·PBR)</b>에 사서 시장이 가치를 알아줄 때까지 기다립니다. 이 앱의 가격 분석은 '얼마나 흔들렸나'를, 기업 정보 카드는 '그럴 만한 회사인가'를 보여줍니다. 둘을 교차해야 합니다.",
    steps: [
      { t: "기업 정보 카드에서 ROE와 부채비율을 봅니다", d: "ROE 15% 이상이 우수, 단 부채비율 200% 넘으면 빚으로 만든 ROE일 수 있습니다. 해외 종목은 부채비율이 제공되지 않으니 ROA(총자산이익률)로 대신 가늠하세요.", go: { tab: "single", sub: "analysis", id: "fundCard" }, label: "기업 정보" },
      { t: "PER·PBR을 업종 평균과 비교합니다", d: "배지에 업종 대비 판정이 뜹니다. 추정 PER(내년 이익 전망)이 현재 PER보다 낮으면 이익이 늘어난다는 뜻입니다.", go: { tab: "single", sub: "analysis", id: "fundMetrics" }, label: "투자지표" },
      { t: "실적 추이에서 매출·영업이익이 늘고 있는지 봅니다", d: "분기/연간 토글. 전망치(노란색)까지 우상향인지, 영업이익률이 유지되는지.", go: { tab: "single", sub: "analysis", id: "fundFinance" }, label: "실적 추이" },
      { t: "낙폭 표로 '좋은 회사도 이만큼 흔들렸다'를 확인합니다", d: "좋은 회사와 좋은 주식은 다릅니다. ROE 20% 회사도 -50%를 겪습니다. 그 낙폭을 견딜 수 있는지가 마지막 관문입니다.", go: { tab: "single", sub: "analysis", id: "ddCard" }, label: "Drawdown 표" }
    ],
    rule: "예시 규칙: ROE 12% 이상 · 부채비율 100% 이하 · 3년 연속 매출 증가 · PER이 업종 평균의 80% 이하. 네 조건을 모두 만족할 때만 관심 목록에 넣고, 낙폭 -20% 이상일 때 분할 매수합니다.",
    trap: "<b>저PER 트랩:</b> 이익이 곧 줄어들 회사는 PER이 낮아 보입니다. <b>PBR 1 미만</b>은 대개 '그 자산으로 돈을 못 번다'는 평가입니다. 업종 PER 비교는 국내 종목만 제공되므로, 해외 종목은 같은 업종 경쟁사를 직접 조회해 비교하세요."
  },
  {
    id: "hedge",
    example: "SPY",
    exampleCart: [["SPY", 40], ["TLT", 20], ["GLD", 20], ["KRW=X", 20]],
    icon: "🛡️",
    title: "헷지 자산 찾기",
    tag: "내 종목이 무너질 때 무엇이 버텼나",
    who: "이미 주력 종목이 있고, 거기에 무엇을 더하면 계좌가 덜 흔들릴지 찾는 사람.",
    idea: "주력 자산이 크게 빠진 <b>바로 그 구간</b>에서 플러스였거나 덜 빠진 자산이 진짜 헷지입니다. 평상시 상관계수보다 위기 때 실제 성과가 더 중요합니다.",
    steps: [
      { t: "주력 종목을 분석하고 🛒로 장바구니에 담습니다", d: "그 다음 금·장기채·달러·단기채 등 후보를 검색창으로 함께 담습니다.", go: { tab: "single", sub: "analysis", id: "searchCard", needSymbol: false }, label: "종목 분석·담기" },
      { t: "사건별 성과 표에서 주력이 빠진 구간의 후보 성과를 봅니다", d: "행을 클릭하면 그 구간만 확대됩니다. 주력이 -30%일 때 +인 자산이 있는지.", go: { tab: "compare", id: "cmpCrisis", needSymbol: false }, label: "사건별 성과" },
      { t: "상관계수 행렬에서 주력과 음수~0인 자산을 고릅니다", d: "음수면 최고의 짝, 0 근처면 따로 움직임, 0.7 이상이면 헷지가 아닙니다.", go: { tab: "compare", id: "cmpCorr", needSymbol: false }, label: "상관계수 행렬" },
      { t: "시뮬레이터로 주력 70 + 헷지 30 등을 돌려 낙폭 개선을 확인합니다", d: "최악 하락 구간 표에서 헷지가 실제로 얼마나 막아줬는지 숫자로 나옵니다.", go: { tab: "sim", id: "simWorst", needSymbol: false }, label: "최악 하락 구간" }
    ],
    rule: "예시 규칙: 주력 자산의 역대 낙폭 상위 3개 구간 모두에서 플러스이거나 -5% 이내였던 자산만 헷지 후보. 그중 장기 CAGR이 0 이상인 것을 20~30% 섞습니다.",
    trap: "헷지 비중을 늘리면 하락은 얕아지지만 <b>상승도 느려집니다.</b> 이 맞교환이 배분의 본질입니다. 유동성 위기 초기(2020년 3월)에는 금·채권도 함께 팔리는 며칠이 있습니다."
  },
  {
    id: "dividend",
    example: "005930.KS",
    exampleCart: [["SCHD", 40], ["SPY", 40], ["069500.KS", 20]],
    icon: "💰",
    title: "배당 투자",
    tag: "팔지 않고 현금흐름을",
    who: "주가 등락에 흔들리지 않을 명분이 필요한 사람. 은퇴 후 생활비나 재투자 재원을 만들려는 사람.",
    idea: "주가가 빠져도 배당은 들어옵니다. 배당이 있으면 <b>하락장에 팔지 않을 이유</b>가 생기고, 그 배당을 재투자하면 저가 매수가 자동으로 됩니다. 배당수익률과 배당의 지속 가능성(이익 대비 배당 비율)이 핵심입니다.",
    steps: [
      { t: "기업 정보에서 배당수익률과 주당배당금을 봅니다", d: "실적 표의 '시가배당률·배당성향'도 함께. 배당성향이 80%를 넘으면 배당이 줄어들 위험이 있습니다. 기업 정보는 국내·해외 모두 제공되며, 해외는 ROE가 EPS÷BPS 추정치로 표시됩니다.", go: { tab: "single", sub: "analysis", id: "fundCard" }, label: "기업 정보" },
      { t: "낙폭 표로 배당주도 얼마나 빠지는지 확인합니다", d: "배당주라고 안 빠지지 않습니다. 배당 3%를 받으려다 -30%를 견뎌야 할 수 있습니다.", go: { tab: "single", sub: "analysis", id: "ddCard" }, label: "Drawdown 표" },
      { t: "SCHD 같은 배당 ETF를 검색해 비교합니다", d: "개별 배당주보다 ETF가 배당 삭감 위험을 분산합니다. 장바구니에 담아 SPY와 낙폭·변동성을 비교해 보세요.", go: { tab: "compare", id: "compareCard", needSymbol: false }, label: "장바구니 비교" }
    ],
    rule: "예시 규칙: 배당수익률 3% 이상 · 배당성향 60% 이하 · 5년 연속 배당 유지. 차트의 <b>배당 재투자 반영</b>을 켜면 배당까지 포함한 총수익으로 낙폭·수익률이 다시 계산되니, 배당주는 반드시 켜고 비교하세요.",
    trap: "<b>배당수익률이 갑자기 높아진 종목은 주가가 폭락한 것</b>일 수 있습니다(배당 함정). 배당수익률 8% 이상은 의심부터 하세요. 배당은 회사가 언제든 줄이거나 없앨 수 있으며, 배당락일에 주가는 배당금만큼 떨어집니다."
  }
];

/* ---------- 나에게 맞는 방법 찾기 (읽는 순서 안내) ----------
   답에 따라 "먼저 읽어볼 방법"에 표시를 붙인다. 추천이 아니라 읽는 순서다. */
var FINDER_Q = [
  { id: "dd", q: "내 계좌가 얼마까지 떨어져도 팔지 않고 버틸 수 있나요?",
    opts: [["-10% 정도", "low"], ["-20~30%", "mid"], ["-50%도 견딤", "high"]] },
  { id: "horizon", q: "이 돈은 언제 쓸 돈인가요?",
    opts: [["3년 안", "short"], ["3~10년", "mid"], ["10년 이상·노후", "long"]] },
  { id: "time", q: "투자에 쓸 수 있는 시간은?",
    opts: [["거의 없음, 자동으로", "none"], ["한 달에 한 번 점검", "monthly"], ["매일 볼 수 있음", "daily"]] },
  { id: "what", q: "무엇에 관심이 있나요?",
    opts: [["개별 회사", "stock"], ["ETF·지수", "etf"], ["아직 모름", "unknown"]] }
];
var finderAns = {};

/* 각 답이 어떤 방법에 점수를 주는지 */
function finderScore() {
  var s = {};
  GUIDE_METHODS.forEach(function (m) { s[m.id] = 0; });
  var a = finderAns;
  if (a.dd === "low") { s.portfolio += 3; s.hedge += 2; s.riskadj += 2; s.trend += 1; }
  if (a.dd === "mid") { s.portfolio += 2; s.longterm += 2; s.mdd += 1; s.dividend += 1; }
  if (a.dd === "high") { s.mdd += 3; s.longterm += 2; s.value += 1; }
  if (a.horizon === "short") { s.portfolio += 2; s.riskadj += 2; s.hedge += 1; }
  if (a.horizon === "mid") { s.longterm += 2; s.portfolio += 1; s.mdd += 1; }
  if (a.horizon === "long") { s.longterm += 3; s.mdd += 2; s.dividend += 2; s.value += 1; }
  if (a.time === "none") { s.longterm += 3; s.portfolio += 2; s.dividend += 1; }
  if (a.time === "monthly") { s.trend += 2; s.portfolio += 1; s.mdd += 1; s.riskadj += 1; }
  if (a.time === "daily") { s.meanrev += 2; s.trend += 1; s.value += 1; }
  if (a.what === "stock") { s.value += 3; s.mdd += 1; s.dividend += 1; }
  if (a.what === "etf") { s.portfolio += 2; s.longterm += 2; s.riskadj += 1; }
  if (a.what === "unknown") { s.longterm += 1; s.portfolio += 1; s.mdd += 1; }
  return s;
}

function renderFinder() {
  var box = $("finderBox");
  var html = "";
  FINDER_Q.forEach(function (q) {
    html += '<div class="fq"><div class="fqT">' + q.q + "</div><div class='row'>";
    q.opts.forEach(function (o) {
      html += '<button class="chip' + (finderAns[q.id] === o[1] ? " active" : "") + '" data-q="' + q.id + '" data-v="' + o[1] + '">' + o[0] + "</button>";
    });
    html += "</div></div>";
  });
  box.innerHTML = html;
  Array.prototype.forEach.call(box.querySelectorAll("[data-q]"), function (b) {
    b.onclick = function () {
      finderAns[b.getAttribute("data-q")] = b.getAttribute("data-v");
      renderFinder();
      renderFinderResult();
    };
  });
}

function renderFinderResult() {
  var box = $("finderResult");
  var answered = FINDER_Q.filter(function (q) { return finderAns[q.id]; }).length;
  if (answered < FINDER_Q.length) {
    box.innerHTML = '<small style="color:var(--sub)">' + answered + "/" + FINDER_Q.length + " 답변 — 모두 고르면 먼저 읽어볼 방법을 표시합니다.</small>";
    Array.prototype.forEach.call(document.querySelectorAll(".guideItem .gFirst"), function (el) { el.remove(); });
    return;
  }
  var s = finderScore();
  var ranked = GUIDE_METHODS.slice().sort(function (a, b) { return s[b.id] - s[a.id]; }).slice(0, 3);
  box.innerHTML = '<div class="gRule" style="margin-top:8px"><b>먼저 읽어볼 방법 (답변 기준 읽는 순서)</b>' +
    "<ol style='margin:6px 0 0 18px;padding:0'>" +
    ranked.map(function (m) { return "<li><a href='#' data-go='" + m.id + "'>" + m.icon + " " + m.title + "</a> <small style='color:var(--sub)'>" + m.tag + "</small></li>"; }).join("") +
    "</ol><small style='color:var(--sub)'>이것은 <b>읽는 순서</b>이지 이 방법이 당신에게 맞다는 판단이 아닙니다. 답을 바꿔 보며 순서가 어떻게 달라지는지 보세요.</small></div>";
  Array.prototype.forEach.call(box.querySelectorAll("[data-go]"), function (a) {
    a.onclick = function (e) { e.preventDefault(); showGuide(a.getAttribute("data-go")); };
  });
  // 목록 항목에 표시
  Array.prototype.forEach.call(document.querySelectorAll(".guideItem"), function (b) {
    var old = b.querySelector(".gFirst"); if (old) old.remove();
    var idx = ranked.findIndex(function (m) { return m.id === b.getAttribute("data-m"); });
    if (idx >= 0) {
      var tag = document.createElement("span");
      tag.className = "gFirst"; tag.textContent = (idx + 1) + "순위";
      b.appendChild(tag);
    }
  });
}

/* ---------- 용어 사전 (초보자용, 한 줄 정의) ---------- */
var GLOSSARY = [
  ["종가 · 시가 · 고가 · 저가", "하루 거래에서 마지막 가격·첫 가격·가장 높았던 가격·가장 낮았던 가격. 차트와 표는 대부분 종가 기준입니다."],
  ["전고점", "지금까지 중 가장 높았던 가격. '전고점 대비 -20%'는 최고점에서 20% 떨어져 있다는 뜻."],
  ["낙폭 · 최대낙폭(MDD)", "고점에서 저점까지 떨어진 폭. 최대낙폭은 그중 가장 깊었던 것. 이 앱에서 가장 중요한 숫자."],
  ["회복", "떨어졌던 가격이 다시 전고점을 넘는 것. '회복까지 300일'은 그만큼 기다려야 본전이었다는 뜻."],
  ["CAGR(연평균 수익률)", "총수익을 '1년에 몇 %씩 복리로 불었나'로 환산한 값. 기간이 다른 투자를 비교할 때 씁니다."],
  ["변동성", "가격이 얼마나 출렁이는지. 높을수록 하루하루 등락이 큽니다. 위험의 크기로 씁니다."],
  ["거치식 · 적립식", "거치식은 한 번에 넣기, 적립식은 매달 나눠 넣기. 적립식은 평균 매수가가 자동으로 분산됩니다."],
  ["리밸런싱", "비율이 틀어지면(주식이 올라 70%가 됐다면) 팔고 사서 원래 비율(60%)로 되돌리는 것."],
  ["상관계수", "두 자산이 같이 움직이는 정도. 1이면 똑같이, 0이면 무관하게, -1이면 반대로. 분산 효과는 0 이하일 때 큽니다."],
  ["헷지", "내 주력 자산이 떨어질 때 오르거나 버티는 자산을 함께 들고 있는 것. 보험과 비슷합니다."],
  ["ETF", "여러 종목을 묶어 하나처럼 사고파는 상품. S&P500 ETF를 사면 미국 대형주 500개를 한 번에 사는 셈."],
  ["지수", "시장 전체의 평균 점수. 코스피·S&P500·나스닥100 등. 지수 자체는 살 수 없고 ETF로 삽니다."],
  ["티커", "종목의 영문 약자. 삼성전자는 005930, 엔비디아는 NVDA. 검색창에 한글로 쳐도 됩니다."],
  ["원화 환산", "달러로 거래되는 자산을 그날 환율로 원화로 바꿔 보는 것. 환율 변동까지 포함한 '내 계좌' 기준."],
  ["컨센서스", "증권사 애널리스트들의 평균 전망(목표주가·이익 추정). 자주 빗나갑니다."],
  ["배당 · 배당락", "회사가 이익 일부를 주주에게 현금으로 주는 것. 배당락일에는 주가가 배당금만큼 떨어집니다."],
  ["총수익", "가격 상승 + 배당을 합친 수익. 배당주는 가격만 보면 실제보다 나빠 보입니다."],
  ["손절", "정해둔 손실선에서 파는 것. 더 큰 손실을 막는 안전장치이며, 지지선 살짝 아래에 두는 게 관례."],
  ["분할 매수", "한 번에 다 사지 않고 여러 번 나눠 사는 것. 바닥을 맞힐 수 없다는 전제에서 나온 방법."],
  ["생존 편향", "살아남은 종목만 데이터에 남아 결과가 실제보다 좋아 보이는 착시. 상장폐지된 종목은 통계에 없습니다."]
];
function renderGlossary() {
  var box = $("glossary");
  box.innerHTML = GLOSSARY.map(function (g) {
    return "<div class='glItem'><b>" + g[0] + "</b><span>" + g[1] + "</span></div>";
  }).join("");
}

/* ---------- 렌더링 ---------- */
var guideState = { current: null };

/* 상세를 닫고 목록으로 (뒤로가기 버튼·브라우저 뒤로가기 공용) */
function closeGuide(fromHistory) {
  $("guideList").classList.remove("collapsed");
  $("guideDetail").classList.add("hidden");
  guideState.current = null;
  Array.prototype.forEach.call(document.querySelectorAll(".guideItem"), function (b) { b.classList.remove("active"); });
  if (!fromHistory) {
    var top = $("guideCard").getBoundingClientRect().top + window.scrollY - ($("topbar").offsetHeight + 8);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }
}

function renderGuideList() {
  var box = $("guideList");
  box.innerHTML = GUIDE_METHODS.map(function (m) {
    return '<button class="guideItem" data-m="' + m.id + '">' +
      '<span class="gi">' + m.icon + "</span>" +
      '<span class="gt">' + m.title + '<small>' + m.tag + "</small></span></button>";
  }).join("");
  Array.prototype.forEach.call(box.querySelectorAll("[data-m]"), function (b) {
    b.onclick = function () { showGuide(b.getAttribute("data-m")); };
  });
}

function showGuide(id, fromHistory) {
  var m = null;
  for (var i = 0; i < GUIDE_METHODS.length; i++) if (GUIDE_METHODS[i].id === id) m = GUIDE_METHODS[i];
  if (!m) return;
  if (!fromHistory && guideState.current !== id) {
    // 떠나는 화면(목록 또는 다른 항목)을 저장하고 새 항목을 히스토리에 쌓는다 → 뒤로가기로 돌아올 수 있다
    history.replaceState(viewState(), "");
    history.pushState({ tab: "guide", sub: currentSub, y: 0, guide: id }, "");
  }
  guideState.current = id;
  Array.prototype.forEach.call(document.querySelectorAll(".guideItem"), function (b) {
    b.classList.toggle("active", b.getAttribute("data-m") === id);
  });

  var html = '<h2>' + m.icon + " " + m.title + " <small>" + m.tag + "</small></h2>";
  html += '<div class="gSec"><b>누구에게 맞나</b><p>' + m.who + "</p></div>";
  html += '<div class="gSec"><b>핵심 아이디어</b><p>' + m.idea + "</p></div>";

  if (m.presets) {
    html += '<div class="gSec"><b>바로 써 볼 수 있는 예시 포트폴리오</b><div class="gPresets">';
    m.presets.forEach(function (p, i) {
      html += '<button class="gPreset" data-p="' + i + '"><b>' + p.name + "</b><small>" + p.desc + "</small>" +
        '<span class="gAssets">' + p.assets.map(function (a) { return cmpLabel(a[0]) + " " + a[1] + "%"; }).join(" · ") + "</span></button>";
    });
    html += '</div><small style="color:var(--sub)">누르면 장바구니가 채워지고 시뮬레이터가 바로 실행됩니다. 비중은 시뮬레이터에서 자유롭게 바꿀 수 있습니다.</small></div>';
  }

  html += '<div class="gSec"><b>이 앱에서 이렇게 봅니다</b><ol class="gSteps">';
  m.steps.forEach(function (s, i) {
    html += "<li><div class='gStepT'>" + s.t + "</div><div class='gStepD'>" + s.d + "</div>" +
      (s.go ? '<button class="chip gGo" data-s="' + i + '">→ ' + s.label + " 보러 가기</button>" +
        (s.go.tab === "single" && s.go.needSymbol !== false && !(state.rows && state.rows.length)
          ? '<small style="color:var(--sub);margin-left:6px">예시 ' + cmpLabel(m.example) + " 자동 조회</small>" : "")
        : "") + "</li>";
  });
  html += "</ol></div>";
  html += '<div class="gSec gRule"><b>규칙으로 만든다면 (가상의 예시 · 실제 적용 전 반드시 본인 상황에 맞게 조정)</b><p>' + m.rule + "</p></div>";
  html += '<div class="gSec gTrap"><b>함정 · 반드시 알아둘 것</b><p>' + m.trap + "</p></div>";

  var panel = $("guideDetail");
  panel.innerHTML =
    '<button class="chip gBackToList" id="guideBack">← 투자 방법 목록으로</button>' +
    '<div class="gDisclaimer">⚠ 아래 내용은 <b>투자 추천이 아닙니다.</b> 예시 종목·비중·규칙은 표 읽는 연습용이며, ' +
    "이 방식이 당신에게 맞는지는 이 앱이 판단할 수 없습니다.</div>" + html;
  panel.classList.remove("hidden");
  // 모바일에서는 목록과 상세가 위아래로 쌓여 겹쳐 보이므로, 상세를 볼 때 목록을 접는다
  if (window.innerWidth <= 640) $("guideList").classList.add("collapsed");
  $("guideBack").onclick = function () {
    // 브라우저 뒤로가기와 같은 동작이 되도록 히스토리를 한 칸 되돌린다
    if (history.state && history.state.guide) history.back();
    else closeGuide(false);
  };
  // 도입부의 면책 안내는 항목을 골라도 계속 보이게 유지한다

  Array.prototype.forEach.call(panel.querySelectorAll(".gGo"), function (b) {
    b.onclick = function () { guideGo(m.steps[+b.getAttribute("data-s")].go, m); };
  });
  Array.prototype.forEach.call(panel.querySelectorAll(".gPreset"), function (b) {
    b.onclick = function () { guideLoadPortfolio(m.presets[+b.getAttribute("data-p")].assets); };
  });

  if (window.innerWidth <= 900) {
    setTimeout(function () {
      var top = panel.getBoundingClientRect().top + window.scrollY - ($("topbar").offsetHeight + 12);
      window.scrollTo({ top: top, behavior: "smooth" });
    }, 50);
  }
}

renderGuideList();
renderFinder();
renderFinderResult();
renderGlossary();
