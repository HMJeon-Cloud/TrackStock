/* ============================================================
   릴스 (v9.4) — 리스트형 정보 릴스: 표지 + 리스트(1~2장) + 마무리(프로필 안내), 1080×1920 검정·금색
   두 종류
   · 데이터 릴스: 실제 일봉(최대 30년)으로 그날 다시 계산 — 숫자가 바뀌면 문장도 바뀐다
   · 상식 릴스: 바뀌지 않는 규칙·계산 위주(세율 등 바뀔 수 있는 건 기준을 같이 적음)
   원칙: 종목 추천·방향 예측 없음 · 지어낸 통계("90%가…") 없음 · 이모지 없음
   ============================================================ */
var REEL = { W: 1080, H: 1920, P: 84, TOP: 260, BOT: 1560 };   // 위 260 / 아래 360은 인스타 UI가 덮는 구역
var REEL_C = { bg: "#0b0b0d", bg2: "#17161a", gold: "#c9a24f", gold2: "#f1d48a", txt: "#ffffff", txt2: "#b9b3a8", dim: "#6f6a62", up: "#ff5a4f", down: "#5b9cff" };
var REEL_HIST = ["SPY", "QQQ", "TQQQ", "SOXX", "SOXL", "BTC-USD", "^KS11", "GLD", "005930.KS", "NVDA", "AAPL", "TSLA", "000660.KS", "TLT"];

function rxRows(sym) { var r = (typeof nbHist !== "undefined" && nbHist[sym]) || []; return r.filter(function (x) { return x && x.c > 0 && isFinite(x.c); }); }
function rxYears(r) { return r.length > 1 ? (r[r.length - 1].t - r[0].t) / (365.25 * 86400e3) : 0; }
function rxMdd(r) { var pk = -Infinity, m = 0; r.forEach(function (x) { if (x.c > pk) pk = x.c; var d = x.c / pk - 1; if (d < m) m = d; }); return m; }
function rxUnder(r) { var pk = -Infinity, pkT = 0, best = 0; r.forEach(function (x) { if (x.c >= pk) { pk = x.c; pkT = x.t; } else best = Math.max(best, x.t - pkT); }); return Math.round(best / 86400e3); }
function rxFrom(r, t) { return r.filter(function (x) { return x.t >= t; }); }
function rxPct(x, d) { return cPct(x, d == null ? 0 : d); }
function rxWon(v) { return cMan(v); }
function rxMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function rxYmd(t) { var d = new Date(t + 9 * 3600e3); return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1); }
function rxDur(days) { return days >= 730 ? (days / 365.25).toFixed(1) + "년" : days >= 60 ? Math.round(days / 30.4) + "개월" : days + "일"; }

/* ---------- 데이터 릴스 ---------- */
var REEL_DATA = {
  loss: function () {   // 계산만 — 데이터 불필요
    var L = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    return { hook: ["[[-50%]]를 맞으면", "+50%로는 못 돌아와요"], lead: "손실과 회복은 같은 크기가 아니에요. 잃은 만큼이 아니라, 줄어든 돈에서 다시 올라가야 하거든요.",
      items: L.map(function (x) { var need = 1 / (1 - x) - 1; return ["-" + Math.round(x * 100) + "% 손실", "본전까지 +" + (need >= 1 ? Math.round(need * 100) : (need * 100).toFixed(1)) + "% 필요"]; }),
      insight: "-10%는 +11%면 되지만, -50%부터는 두 배가 필요해요. 크게 잃지 않는 것이 수익률을 올리는 것보다 먼저인 이유예요.", src: "단순 계산 (1 ÷ (1 - 손실률) - 1)", tags: ["손실회복", "주식초보", "투자공부"] };
  },
  lev: function () {
    var q = rxRows("QQQ"), t3 = rxRows("TQQQ"), s1 = rxRows("SOXX"), s3 = rxRows("SOXL"); if (t3.length < 750 || q.length < 750) return null;
    var q2 = rxFrom(q, t3[0].t), y = rxYears(t3), rq = q2[q2.length - 1].c / q2[0].c - 1, r3 = t3[t3.length - 1].c / t3[0].c - 1;
    var dq = rxMdd(q2), d3 = rxMdd(t3), uq = rxUnder(q2), u3 = rxUnder(t3);
    function bad(r) { var n = 0; for (var i = 1; i < r.length; i++) if (r[i].c / r[i - 1].c - 1 <= -0.1) n++; return n; }
    var it = [
      ["하루 -10% 넘게 빠진 날", "QQQ " + bad(q2) + "일 · TQQQ " + bad(t3) + "일"],
      ["최대 낙폭", "QQQ " + rxPct(dq) + " · TQQQ " + rxPct(d3)],
      ["전고점 회복까지 가장 오래", "QQQ " + rxDur(uq) + " · TQQQ " + rxDur(u3)],
      ["상장 후 누적 (" + rxYmd(t3[0].t) + "~)", "QQQ " + rxPct(rq) + " · TQQQ " + rxPct(r3)],
      ["+10% 다음 날 -10%", "1배 -1% · 3배(+30%, -30%) -9%"],
      ["10일 동안 ±5% 반복", "1배 약 -1% · 3배 약 -11%"],
      ["3배의 정확한 뜻", "'하루' 수익률의 3배 — 기간 수익률의 3배가 아니에요"]
    ];
    if (s1.length > 750 && s3.length > 750) { var s1b = rxFrom(s1, s3[0].t); it.splice(2, 0, ["반도체 3배 최대 낙폭", "SOXX " + rxPct(rxMdd(s1b)) + " · SOXL " + rxPct(rxMdd(s3))]); }
    return { hook: ["3배 ETF가", "[[3배]]를 못 버는 이유"], lead: "레버리지 ETF는 '하루' 수익률의 3배를 따라가요. 그래서 오래 들고 있으면 계산이 달라져요.",
      items: it, insight: r3 > rq * 3 ? "상승이 길었던 구간에선 3배보다 더 벌었지만, 그 대가로 " + rxPct(d3) + "까지 빠지는 구간을 견뎌야 했어요. 수익보다 낙폭을 먼저 보세요." : "누적 수익은 3배에 못 미쳤고, 낙폭은 훨씬 깊었어요. 횡보와 급락이 섞이면 3배가 오히려 녹아요.",
      src: "Yahoo Finance 일봉 종가 · 상장일~최근 · 배당 제외", tags: ["레버리지ETF", "TQQQ", "미국주식"] };
  },
  dips: function () {
    var r = rxRows("SPY"); if (r.length < 2500) return null;
    var y = rxYears(r), eps = drawdownEpisodes(r, 0.10);
    var a = eps.filter(function (e) { return e.dd > -0.2; }), b = eps.filter(function (e) { return e.dd <= -0.2 && e.dd > -0.3; }), c = eps.filter(function (e) { return e.dd <= -0.3; });
    var rec = a.filter(function (e) { return e.recoverI != null; }).map(function (e) { return (r[e.recoverI].t - r[e.peakI].t) / 86400e3; });
    var recB = eps.filter(function (e) { return e.dd <= -0.2 && e.recoverI != null; }).map(function (e) { return (r[e.recoverI].t - r[e.peakI].t) / 86400e3; });
    var pk = Math.max.apply(null, r.map(function (x) { return x.c; })), cur = r[r.length - 1].c / pk - 1;
    var yrs = {}; eps.forEach(function (e) { yrs[new Date(r[e.troughI].t).getUTCFullYear()] = 1; });
    var it = [
      ["-10% 이상 하락", eps.length + "번 — 평균 " + (y / Math.max(1, eps.length)).toFixed(1) + "년에 한 번"],
      ["그중 -10~-20%에서 멈춤", a.length + "번"],
      ["-20~-30%까지", b.length + "번"],
      ["-30%보다 깊게", c.length + "번"],
      ["-10~-20%의 회복 기간", rec.length ? "보통 " + rxDur(Math.round(rxMed(rec))) + " (고점→고점)" : "-"],
      ["-20%보다 깊었을 때", recB.length ? "보통 " + rxDur(Math.round(rxMed(recB))) : "아직 회복 중"],
      ["가장 오래 걸린 회복", rxDur(rxUnder(r))],
      ["지금 고점 대비", rxPct(cur, 1)]
    ];
    return { hook: ["S&P500 [[-10%]] 하락,", "생각보다 자주 왔어요"], lead: rxYmd(r[0].t) + "부터 " + Math.round(y) + "년치 S&P500(SPY) 종가로 세어 봤어요.",
      items: it, insight: (a.length > b.length + c.length ? "대부분은 -20% 전에 멈췄고 비교적 빨리 회복했어요. 다만 깊은 하락은 훨씬 오래 걸렸어요." : "-20%보다 깊어진 경우도 적지 않았고, 그때는 회복이 훨씬 오래 걸렸어요.") + " 하락의 깊이는 미리 알 수 없어서, 기다릴 수 있는 돈인지가 먼저예요.",
      src: "Yahoo Finance SPY 일봉 종가 · " + rxYmd(r[0].t) + "~ · 배당 제외", tags: ["SP500", "미국주식", "하락장"] };
  },
  best10: function () {
    var r0 = rxRows("SPY"); if (r0.length < 2500) return null;
    var r = rxFrom(r0, r0[r0.length - 1].t - 20 * 365.25 * 86400e3), rets = [];
    for (var i = 1; i < r.length; i++) rets.push({ r: r[i].c / r[i - 1].c - 1, t: r[i].t });
    var all = rets.reduce(function (a, x) { return a * (1 + x.r); }, 1), sorted = rets.slice().sort(function (a, b) { return b.r - a.r; });
    function miss(n) { return sorted.slice(0, n).reduce(function (a, x) { return a / (1 + x.r); }, all); }
    var worst = rets.slice().sort(function (a, b) { return a.r - b.r; }).slice(0, 20), near = sorted.slice(0, 10).filter(function (b) { return worst.some(function (w) { return Math.abs(w.t - b.t) <= 30 * 86400e3; }); }).length;
    var base = 10000000, yr = Math.round(rxYears(r));
    var it = [
      [yr + "년 내내 들고 있었다면", rxWon(base * all)],
      ["가장 좋은 10일만 놓쳤다면", rxWon(base * miss(10))],
      ["가장 좋은 20일을 놓쳤다면", rxWon(base * miss(20))],
      ["가장 좋은 30일을 놓쳤다면", rxWon(base * miss(30))],
      ["전체 거래일", rets.length.toLocaleString() + "일 중 10일 = " + (10 / rets.length * 100).toFixed(2) + "%"],
      ["가장 좋았던 하루", rxPct(sorted[0].r, 1) + " (" + rxYmd(sorted[0].t) + ")"],
      ["좋은 10일 중 최악의 날 근처(30일 안)", near + "일"]
    ];
    return { hook: ["[[딱 10일]] 놓쳤을 뿐인데", yr + "년 수익이 이렇게 달라져요"], lead: "S&P500(SPY)에 1,000만원을 넣고 " + yr + "년 동안 가만히 있었다면. 그리고 가장 좋았던 며칠만 빠져 있었다면.",
      items: it, insight: near >= 5 ? "가장 좋은 10일 중 " + near + "일이 가장 나쁜 날 30일 안에 있었어요. 무서워서 잠깐 나와 있던 사이에 놓치기 쉬운 이유예요." : "전체 거래일의 " + (10 / rets.length * 100).toFixed(2) + "%뿐인 10일이 빠지자 결과가 " + Math.round((1 - miss(10) / all) * 100) + "% 줄었어요. 좋은 날은 미리 알 수 없어서, 자리를 지키는 것 자체가 전략이 돼요.",
      src: "Yahoo Finance SPY 일봉 종가 · 최근 " + yr + "년 · 배당·환율·세금 제외", tags: ["장기투자", "SP500", "적립식"] };
  },
  btcMonth: function () {
    var r = rxRows("BTC-USD"); if (r.length < 1500) return null;
    var byYM = {}; r.forEach(function (x) { var d = new Date(x.t); byYM[d.getUTCFullYear() * 100 + d.getUTCMonth() + 1] = x.c; });
    var now = new Date(), curYM = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1, M = [];
    for (var m = 1; m <= 12; m++) {
      var rs = [];
      Object.keys(byYM).forEach(function (k) { k = +k; if (k % 100 !== m || k >= curYM) return; var y = Math.floor(k / 100), pv = m === 1 ? (y - 1) * 100 + 12 : y * 100 + m - 1; if (byYM[pv]) rs.push(byYM[k] / byYM[pv] - 1); });
      if (rs.length >= 5) M.push({ m: m, avg: rs.reduce(function (a, x) { return a + x; }, 0) / rs.length, med: rxMed(rs), up: rs.filter(function (x) { return x > 0; }).length, n: rs.length });
    }
    if (M.length < 12) return null;
    var S = M.slice().sort(function (a, b) { return b.med - a.med; });
    return { hook: ["비트코인, [[" + S[0].m + "월]]에 가장 강했고", S[11].m + "월에 가장 약했어요"], lead: "비트코인 " + new Date(r[0].t).getUTCFullYear() + "년부터 월별 수익률을 달력 달로 묶었어요. 한 해만 튀는 걸 막으려고 '보통(중앙값)'으로 줄 세웠어요.",
      items: S.map(function (x, i) { return [(i + 1) + "위 " + x.m + "월", "보통 " + rxPct(x.med, 1) + " · 오른 해 " + x.up + "/" + x.n]; }),
      insight: "같은 달이라도 해마다 결과가 크게 달랐어요. 계절성은 '그랬던 적이 많다'일 뿐 약속이 아니에요.",
      src: "Yahoo Finance BTC-USD 월말 종가 · 미국 달러 기준", tags: ["비트코인", "코인", "가상자산"] };
  },
  yearAgo: function () {
    var L = [["SPY", "S&P500"], ["QQQ", "나스닥100"], ["^KS11", "코스피"], ["005930.KS", "삼성전자"], ["000660.KS", "SK하이닉스"], ["NVDA", "엔비디아"], ["AAPL", "애플"], ["TSLA", "테슬라"], ["GLD", "금"], ["TLT", "미국 장기채"], ["BTC-USD", "비트코인"]];
    var out = L.map(function (a) { var r = rxRows(a[0]); if (r.length < 300) return null; var last = r[r.length - 1], t0 = last.t - 365 * 86400e3, k = cAt(r, t0); if (k < 0 || Math.abs(r[k].t - t0) > 7 * 86400e3) return null; return { n: a[1], v: 1000000 * last.c / r[k].c, ret: last.c / r[k].c - 1 }; }).filter(Boolean).sort(function (a, b) { return b.v - a.v; });
    if (out.length < 6) return null;
    var best = out[0], worst = out[out.length - 1];
    return { hook: ["1년 전 [[100만원]],", "지금 얼마가 됐을까?"], lead: "딱 1년 전 같은 날 100만원씩 넣었다면. 결과를 큰 순서로 줄 세웠어요.",
      items: out.map(function (x) { return [x.n, rxWon(x.v) + " (" + rxPct(x.ret) + ")"]; }),
      insight: "1등 " + best.n + "와 꼴찌 " + worst.n + "의 차이가 " + rxWon(best.v - worst.v) + "예요. 지난 1년의 1등이 다음 1년에도 1등이라는 보장은 없어요.",
      src: "Yahoo Finance 일봉 종가 · 자산 자체 가격 기준(환율·배당·세금 제외)", tags: ["재테크", "주식초보", "미국주식"] };
  },
  dca: function () {
    var L = [["SPY", "S&P500"], ["QQQ", "나스닥100"], ["^KS11", "코스피"], ["GLD", "금"], ["005930.KS", "삼성전자"], ["TLT", "미국 장기채"], ["BTC-USD", "비트코인"]];
    var out = L.map(function (a) {
      var r = rxRows(a[0]); if (r.length < 2000) return null;
      var last = r[r.length - 1], ld = new Date(last.t), months = [], seen = {};
      r.forEach(function (x) { var d = new Date(x.t), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (!seen[k]) { seen[k] = 1; months.push({ k: k, c: x.c }); } });
      var endK = ld.getUTCFullYear() * 12 + ld.getUTCMonth(), buys = months.filter(function (m) { return m.k > endK - 120 && m.k <= endK; });
      if (buys.length < 115) return null;
      var sh = buys.reduce(function (s, m) { return s + 100000 / m.c; }, 0), inv = buys.length * 100000;
      return { n: a[1], inv: inv, v: sh * last.c, ret: sh * last.c / inv - 1 };
    }).filter(Boolean).sort(function (a, b) { return b.v - a.v; });
    if (out.length < 4) return null;
    return { hook: ["매달 [[10만원]]씩 10년,", "어디에 넣었으면 얼마일까?"], lead: "매달 첫 거래일에 10만원씩 120번, 넣은 돈은 모두 " + rxWon(out[0].inv) + "이에요.",
      items: out.map(function (x) { return [x.n, rxWon(x.v) + " (" + rxPct(x.ret) + ")"]; }),
      insight: "같은 1,200만원이라도 어디에 넣었느냐에 따라 결과가 " + (out[0].v / out[out.length - 1].v >= 2 ? "몇 배씩" : "크게") + " 갈렸어요. 나눠 사면 시점 운은 줄지만, 무엇을 사느냐의 차이는 줄지 않아요.",
      src: "Yahoo Finance 월 첫 거래일 종가 · 가격 기준(환율·배당·세금·수수료 제외)", tags: ["적립식", "재테크", "ETF"] };
  }
};

/* ---------- 상식 릴스 (규칙·계산 위주) ---------- */
var REEL_FIX = [
  { id: "mistake", t: "주식 초보의 흔한 실수 10", hook: ["주식 초보라면", "[[한 번은]] 하는 실수 10가지"], lead: "누구나 처음엔 해요. 다만 알고 하면 비용이 확 줄어요.",
    items: [["뉴스 보고 다음 날 사기", "기사가 나왔을 땐 이미 가격에 반영된 경우가 많아요"], ["이유 확인 전 물타기", "왜 빠졌는지 모른 채 평단만 낮추면 비중만 커져요"], ["한 종목에 전부", "한 회사의 악재가 내 계좌 전체의 악재가 돼요"], ["생활비로 투자", "급할 때 손실 중인 걸 팔게 돼요"], ["수익률만 보고 레버리지", "3배 ETF는 '하루'의 3배라 오래 들면 계산이 달라져요"], ["남의 종목 그대로 따라 사기", "언제 팔지는 아무도 알려주지 않아요"], ["팔 기준 없이 사기", "기준이 없으면 '버티기'가 전략이 돼요"], ["하루 열 번 계좌 확인", "자주 볼수록 감정적으로 사고팔기 쉬워요"], ["세금 계산 안 하기", "해외주식 양도차익은 연 250만원 넘는 부분에 22%"], ["배당만 보고 사기", "배당락일엔 보통 배당만큼 주가가 내려가요"]],
    insight: "실수는 대부분 '급하게'에서 시작해요. 사기 전에 왜 사는지, 언제 팔지 한 줄씩 적어 두는 것만으로도 절반은 막혀요.", src: "세율: 국세청 해외주식 양도소득세(기본공제 250만원·지방세 포함 22%) · 바뀔 수 있어 확인 필요", tags: ["주식초보", "투자공부", "재테크"] },
  { id: "bear", t: "하락장 금지 7", hook: ["하락장에서 계좌를", "[[지키는]] 7가지 금지"], lead: "하락장에서 계좌를 망가뜨리는 건 하락 그 자체보다 그때의 행동인 경우가 많았어요.",
    items: [["빚(신용·미수) 늘리기", "담보가 부족해지면 반대매매로 강제로 팔려요"], ["한 번에 전부 팔기", "가장 좋은 날은 가장 나쁜 날 근처에 몰려 있었어요"], ["레버리지로 만회하기", "-50%는 +100%가 필요해요. 3배로 서두르면 더 깊어져요"], ["리딩방·단톡방 따라 하기", "'확정 수익'을 말하는 곳은 피하세요"], ["하루에 다 사기", "바닥은 지나고 나서야 보여요. 나눠서 사요"], ["매시간 계좌 보기", "보는 횟수만큼 마음이 흔들려요"], ["생활비 끌어오기", "기다릴 수 없는 돈은 결국 바닥에서 팔게 돼요"]],
    insight: "하락장의 목표는 '최대한 벌기'가 아니라 '살아남기'예요. 버틸 수 있는 구조를 먼저 만들어 두세요.", src: "일반 투자 상식 · 투자 권유 아님", tags: ["하락장", "주식초보", "투자공부"] },
  { id: "usstart", t: "미국 주식 시작 전 8", hook: ["미국 주식 시작 전", "[[모르면 손해]] 보는 8가지"], lead: "한국 주식이랑 같은 줄 알았다가 놀라는 것들만 모았어요.",
    items: [["정규장은 한국의 밤", "서머타임 22:30~05:00 · 겨울 23:30~06:00"], ["상한가·하한가가 없어요", "하루 수십 % 움직이기도 해요 (급변 시 일시 정지는 있어요)"], ["양도세는 따로", "연 250만원 공제 후 넘는 부분 22% (지방세 포함)"], ["배당은 15% 떼고 들어와요", "미국 현지 원천징수"], ["환율도 수익률", "주가가 그대로여도 원화 손익이 바뀌어요"], ["1주가 비싸면 소수점", "여러 증권사에서 0.01주 단위 매수를 지원해요"], ["프리·애프터마켓", "거래가 적어 가격이 크게 튈 수 있어요"], ["환전 수수료 확인", "증권사마다 환율 우대가 달라요"]],
    insight: "수익률을 볼 때는 '달러 기준'인지 '원화 기준'인지 먼저 확인하세요. 환율 하나로 결과가 뒤집히기도 해요.", src: "거래시간: NYSE·나스닥 · 세율: 국세청 · 바뀔 수 있어 확인 필요", tags: ["미국주식", "해외주식", "주식초보"] },
  { id: "words", t: "주식 앱 단어 10", hook: ["주식 앱 켜기 전", "[[꼭 알아야 할]] 단어 10개"], lead: "주문 버튼 누르기 전에 이것만 알면 실수가 줄어요.",
    items: [["예수금", "주문에 쓸 수 있는 현금 (판 돈은 2영업일 뒤 출금)"], ["지정가 · 시장가", "원하는 가격에 걸기 · 지금 바로 체결"], ["호가", "사고팔려고 걸어 둔 가격들의 줄"], ["평단가", "내가 산 가격의 평균"], ["상한가 · 하한가", "국내 주식 하루 최대 ±30%"], ["VI (변동성완화장치)", "가격이 갑자기 튀면 2분간 단일가 매매"], ["배당락일", "이날부터 사면 이번 배당은 못 받아요"], ["시간외 단일가", "16:00~18:00, 10분마다 한 번씩 체결"], ["미수", "돈이 모자라도 사지지만, 결제일(2영업일 뒤)까지 못 채우면 반대매매"], ["대체거래소(넥스트레이드)", "일부 종목은 오전 8시~오후 8시에도 거래"]],
    insight: "모르는 단어가 보이면 주문 전에 한 번만 눌러 보세요. 대부분의 앱이 설명을 붙여 두었어요.", src: "한국거래소·넥스트레이드 공시 기준 · 바뀔 수 있어 확인 필요", tags: ["주식초보", "주식용어", "국내주식"] },
  { id: "coinstart", t: "코인 송금·거래 전 8", hook: ["코인 처음이라면", "[[송금 전]] 이것부터 확인"], lead: "코인은 한 번 잘못 보내면 되돌리기 어려워요. 처음에 꼭 확인할 것만 모았어요.",
    items: [["24시간 365일 열려 있어요", "일봉 기준 시각은 거래소마다 달라요"], ["상한가·하한가가 없어요", "하루 수십 %도 움직여요"], ["네트워크 먼저 확인", "주소가 맞아도 네트워크가 다르면 복구가 어려워요"], ["소액으로 먼저 보내기", "큰 금액 전에 한 번 테스트"], ["트래블룰", "100만원 이상 보낼 땐 받는 사람 정보가 필요해요"], ["김치 프리미엄", "국내 가격이 해외보다 비쌀 때가 있어요"], ["유의 종목 지정", "지정되면 상장폐지(거래 지원 종료)로 이어지기도 해요"], ["세금 시행 시기", "가상자산 과세는 시행이 미뤄져 왔어요. 최신 공지 확인"]],
    insight: "코인의 위험은 가격만이 아니에요. 송금·보관·거래소 규정처럼 '실수로 잃는 돈'부터 막으세요.", src: "특정금융정보법(트래블룰) · 거래소 공지 · 바뀔 수 있어 확인 필요", tags: ["코인", "비트코인", "가상자산"] },
  { id: "div", t: "배당 투자 전 7", hook: ["배당 받으려고 샀는데", "[[주가가 빠진]] 이유"], lead: "배당은 공짜 돈이 아니에요. 받기 전에 알아야 할 7가지.",
    items: [["배당락", "배당 기준일이 지나면 보통 배당만큼 주가가 내려가요"], ["기준일에 들고 있어야", "국내는 결제가 2영업일 뒤라 그 전에 사야 해요"], ["배당소득세 15.4%", "국내 배당은 떼고 들어와요"], ["연 2,000만원 넘으면", "이자·배당 합쳐 금융소득종합과세 대상"], ["배당수익률의 착시", "주가가 떨어져도 수익률 숫자는 올라가요"], ["배당은 줄 수도 있어요", "실적이 나빠지면 배당을 줄이거나 멈춰요"], ["미국 배당은 15%", "현지에서 원천징수돼요"]],
    insight: "배당수익률이 갑자기 높아 보이면, 배당이 늘어서인지 주가가 빠져서인지부터 확인하세요.", src: "국세청 · 한국거래소 기준 · 바뀔 수 있어 확인 필요", tags: ["배당주", "배당투자", "재테크"] },
  { id: "numbers", t: "돈 모을 때 숫자 7", hook: ["돈 모으는 사람들이", "[[외우고 있는]] 숫자 7개"], lead: "계산기 없이도 바로 쓰는 숫자들이에요.",
    items: [["72의 법칙", "72 ÷ 연 수익률 = 돈이 두 배 되는 해 수"], ["연 7%", "약 10년이면 두 배"], ["물가 연 3%", "24년 뒤 돈의 가치는 절반"], ["-50%", "본전까지 +100%가 필요"], ["수수료 연 1%", "30년이면 최종 금액의 약 25%가 사라져요 (연 7% 가정)"], ["예금자보호 1억원", "금융회사 한 곳당 원금+이자 합계"], ["비상금 3~6개월", "생활비 기준, 투자 전에 먼저"]],
    insight: "작은 숫자도 시간이 곱해지면 커져요. 수익률만큼 비용과 물가를 같이 보세요.", src: "단순 계산 · 예금보험공사(2025.9.1부터 1억원) · 비상금은 일반적 권고", tags: ["재테크", "돈모으기", "복리"] }
];

/* 목록 (화면용) */
var REEL_LIST = [
  { id: "loss", g: "데이터", t: "손실 회복표 (-50%면 +100%)", d: "계산만으로 만드는 저장각 릴스" },
  { id: "best10", g: "데이터", t: "가장 좋은 10일을 놓쳤다면", d: "S&P500 20년 일봉" },
  { id: "dips", g: "데이터", t: "-10% 하락은 얼마나 자주?", d: "S&P500 30년 하락·회복" },
  { id: "lev", g: "데이터", t: "3배 ETF가 3배를 못 버는 이유", d: "QQQ·TQQQ·SOXX·SOXL 상장 후 전체" },
  { id: "yearAgo", g: "데이터", t: "1년 전 100만원, 지금은?", d: "주식·지수·금·채권·코인 11개" },
  { id: "dca", g: "데이터", t: "매달 10만원씩 10년", d: "S&P500·나스닥·코스피·금 등 7개" },
  { id: "btcMonth", g: "데이터", t: "비트코인 월별 성적표", d: "달력 달별 중앙값·오른 해" }
].concat(REEL_FIX.map(function (r) { return { id: r.id, g: "상식", t: r.t, d: r.lead }; }));

function reelGet(id) {
  var f = REEL_FIX.filter(function (r) { return r.id === id; })[0]; if (f) return Object.assign({ id: id, kind: "fix" }, f);
  var fn = REEL_DATA[id]; if (!fn) return null;
  var r = null; try { r = fn(); } catch (e) { console.warn(e); }
  return r ? Object.assign({ id: id, kind: "data", t: (REEL_LIST.filter(function (x) { return x.id === id; })[0] || {}).t }, r) : null;
}
function reelToday() { var seed = Math.floor((Date.now() + 9 * 3600e3) / 86400e3); return REEL_LIST[seed % REEL_LIST.length].id; }

/* ---------- 이미지 (1080×1920) ---------- */
function rNew() {
  var cv = document.createElement("canvas"); cv.width = REEL.W; cv.height = REEL.H; var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  if (typeof OC_LAYER !== "undefined" && OC_LAYER === "text") return { cv: cv, g: g };   // 글만(투명 배경) 레이어
  var bg = g.createLinearGradient(0, 0, 0, REEL.H); bg.addColorStop(0, REEL_C.bg2); bg.addColorStop(0.55, REEL_C.bg); bg.addColorStop(1, "#000"); g.fillStyle = bg; g.fillRect(0, 0, REEL.W, REEL.H);
  var gl = g.createRadialGradient(REEL.W * 0.85, REEL.H * 0.18, 20, REEL.W * 0.85, REEL.H * 0.18, 760); gl.addColorStop(0, "rgba(201,162,79,0.30)"); gl.addColorStop(1, "rgba(201,162,79,0)"); g.fillStyle = gl; g.fillRect(0, 0, REEL.W, REEL.H);
  // 우상향 곡선 (브랜드 시그니처)
  g.strokeStyle = "rgba(241,212,138,0.55)"; g.lineWidth = 4; g.lineCap = "round";
  g.beginPath(); g.moveTo(-20, REEL.H * 0.92); g.bezierCurveTo(REEL.W * 0.35, REEL.H * 0.86, REEL.W * 0.55, REEL.H * 0.62, REEL.W + 20, REEL.H * 0.5); g.stroke();
  g.strokeStyle = "rgba(201,162,79,0.22)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-20, REEL.H * 0.96); g.bezierCurveTo(REEL.W * 0.4, REEL.H * 0.9, REEL.W * 0.6, REEL.H * 0.7, REEL.W + 20, REEL.H * 0.6); g.stroke();
  return { cv: cv, g: g };
}
function rBrand(g, y) {
  g.strokeStyle = REEL_C.gold2; g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round"; var x = REEL.P;
  g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 26, y - 20); g.moveTo(x + 12, y - 20); g.lineTo(x + 26, y - 20); g.lineTo(x + 26, y - 6); g.stroke();
  cText(g, "UPHILL.LAB · 우상향연구소", x + 42, y, 28, 700, REEL_C.gold2);
}
/* 단어(띄어쓰기) 단위 줄바꿈 — 한 단어가 너무 길 때만 글자 단위로 자른다 */
function rWrap(g, s, x, y, maxW, size, weight, color, lh, maxLines, align) {
  cFont(g, size, weight); var words = String(s).split(" "), lines = [], line = "";
  words.forEach(function (w) { var t = line ? line + " " + w : w; if (g.measureText(t).width <= maxW) { line = t; return; } if (line) lines.push(line); line = w; while (g.measureText(line).width > maxW && line.length > 1) { var k = line.length; while (k > 1 && g.measureText(line.slice(0, k)).width > maxW) k--; lines.push(line.slice(0, k)); line = line.slice(k); } });
  if (line) lines.push(line);
  if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, "…"); }
  lines.forEach(function (l, k) { cText(g, l, x, y + k * (lh || size * 1.45), size, weight, color, align); });
  return y + lines.length * (lh || size * 1.45);
}
function rWrapN(g, s, maxW, size, weight) { cFont(g, size, weight); var n = 1, line = ""; String(s).split(" ").forEach(function (w) { var t = line ? line + " " + w : w; if (g.measureText(t).width <= maxW) line = t; else { n++; line = w; } }); return n; }
function rRich(g, s, x, y, size, color, hi, align) {
  var plain = cPlain(s), w = cW(g, plain, size, 900), cx = align === "center" ? x - w / 2 : x;
  String(s).split(/\[\[|\]\]/).forEach(function (p, i) { if (!p) return; cText(g, p, cx, y, size, 900, i % 2 ? hi : color); cx += cW(g, p, size, 900); });
}
function rFitSize(g, lines, maxW, top) { var s = top; while (s > 54 && lines.some(function (l) { return cW(g, cPlain(l), s, 900) > maxW; })) s -= 2; return s; }
function reelCover(r) {
  var c = rNew(), g = c.g, P = REEL.P, W = REEL.W - P * 2, n = r.items.length;
  rBrand(g, REEL.TOP + 40);
  // 큰 숫자 배경 (항목 수)
  g.save(); g.globalAlpha = 0.08; cText(g, String(n), REEL.W - P + 30, REEL.BOT - 90, 560, 900, REEL_C.gold2, "right"); g.restore();
  var tag = r.kind === "data" ? "실제 데이터로 계산" : "저장해 두면 쓸모 있는 정보"; cRound(g, P, REEL.TOP + 120, cW(g, tag, 30, 800) + 48, 58, 29, "rgba(201,162,79,0.18)"); cText(g, tag, P + 24, REEL.TOP + 160, 30, 800, REEL_C.gold2);
  var size = rFitSize(g, r.hook, W, 120), y = 720;
  r.hook.forEach(function (l, i) { rRich(g, l, P, y + i * size * 1.28, size, REEL_C.txt, REEL_C.gold2); });
  y += r.hook.length * size * 1.28 + 30;
  g.fillStyle = REEL_C.gold; g.fillRect(P, y, 120, 8);
  rWrap(g, r.lead, P, y + 80, W, 38, 500, REEL_C.txt2, 56, 3);
  cText(g, "끝까지 보고 저장하기", P, REEL.BOT - 20, 34, 800, REEL_C.gold2);
  cText(g, n + "가지 →", REEL.W - P, REEL.BOT - 20, 34, 800, REEL_C.txt, "right");
  return c.cv;
}
function reelList(r, from, to, page, pages) {
  var c = rNew(), g = c.g, P = REEL.P, W = REEL.W - P * 2, items = r.items.slice(from, to);
  rBrand(g, REEL.TOP + 10);
  if (pages > 1) cText(g, page + " / " + pages, REEL.W - P, REEL.TOP + 10, 28, 700, REEL_C.dim, "right");
  var tsize = rFitSize(g, [r.t || cPlain(r.hook.join(" "))], W, 60); cText(g, r.t || cPlain(r.hook.join(" ")), P, REEL.TOP + 110, tsize, 900, REEL_C.txt);
  g.fillStyle = REEL_C.gold; g.fillRect(P, REEL.TOP + 140, 90, 6);
  var top = REEL.TOP + 200, h = Math.min(190, Math.floor((REEL.BOT - 40 - top) / items.length)), hs = Math.min(50, Math.max(38, h * 0.29)), ds = Math.min(34, Math.max(27, h * 0.2));
  items.forEach(function (it, i) {
    var y = top + i * h, num = from + i + 1;
    cRound(g, P, y + 8, W, h - 18, 22, i % 2 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.07)");
    cText(g, String(num).padStart(2, "0"), P + 30, y + 8 + (h - 18) / 2 + hs * 0.36, Math.round(hs * 1.25), 900, REEL_C.gold2);
    var x = P + 30 + cW(g, "00", Math.round(hs * 1.25), 900) + 28, mw = REEL.P + W - 28 - x;
    var dat = r.kind === "data", dc = dat ? (/\(-|^-/.test(it[1]) ? REEL_C.down : REEL_C.gold2) : REEL_C.txt2, dsz = dat ? ds + 4 : ds, dw = dat ? 800 : 600;
    var nl = Math.min(2, rWrapN(g, it[1], mw, dsz, dw)), blk = hs * 0.78 + 14 + nl * dsz * 1.3, hy = y + 8 + (h - 18 - blk) / 2 + hs * 0.78;
    cText(g, cFit(g, it[0], mw, hs, 800), x, hy, hs, 800, REEL_C.txt);
    rWrap(g, it[1], x, hy + 14 + dsz * 1.0, mw, dsz, dw, dc, dsz * 1.3, 2);
  });
  rWrap(g, "기준: " + r.src, P, REEL.BOT + 60, W, 22, 500, REEL_C.dim, 30, 2);
  return c.cv;
}
function reelEnd(r) {
  var c = rNew(), g = c.g, P = REEL.P, W = REEL.W - P * 2;
  rBrand(g, REEL.TOP + 40);
  cText(g, "숫자가 말하는 것", P, 640, 40, 800, REEL_C.gold2);
  var y = rWrap(g, r.insight, P, 730, W, 54, 800, REEL_C.txt, 80, 6);
  g.fillStyle = REEL_C.gold; g.fillRect(P, y + 30, W, 2);
  cText(g, "매일 아침, 어제 시장을", P, y + 150, 50, 800, REEL_C.txt);
  cText(g, "숫자로 정리해 올려요", P, y + 220, 50, 800, REEL_C.txt);
  cText(g, "@uphill.lab", P, y + 340, 96, 900, REEL_C.gold2);
  cText(g, "프로필에서 오늘 정리 보기 →", P, y + 410, 36, 700, REEL_C.txt2);
  return c.cv;
}
function reelImages(r) {
  CARD_TXT = ""; var out = [{ name: "표지", cv: reelCover(r) }], n = r.items.length, per = n > 8 ? Math.ceil(n / 2) : n, pages = Math.ceil(n / per);
  for (var p = 0; p < pages; p++) out.push({ name: "리스트" + (pages > 1 ? p + 1 : ""), cv: reelList(r, p * per, Math.min(n, (p + 1) * per), p + 1, pages) });
  out.push({ name: "마무리", cv: reelEnd(r) });
  return out;
}

/* ---------- 글: 캡션 · 화면 자막 · 고정 댓글 ---------- */
function reelTexts(r) {
  var hook = cPlain(r.hook.join(" ")), n = r.items.length;
  var cap = cPlain(r.hook[0]) + "\n" + cPlain(r.hook[1]) + "\n\n" + r.lead + "\n\n" +
    r.items.map(function (it, i) { return (i + 1) + ". " + it[0] + " — " + it[1]; }).join("\n") + "\n\n" + r.insight +
    "\n\n저장해 두고 필요할 때 꺼내 보세요.\n매일 아침 어제 시장을 숫자로 정리해 올려요. 프로필 @uphill.lab 에서 확인하세요.\n\n※ 기준: " + r.src + ". 투자 권유 아님." +
    "\n\n" + ["우상향연구소"].concat(r.tags || []).slice(0, 5).map(function (t) { return "#" + String(t).replace(/[^0-9A-Za-z가-힣_]/g, ""); }).join(" ");
  if (cap.length > 2200) cap = cap.slice(0, 2190) + "…";
  var sec = 0, step = n > 8 ? 1.2 : 1.6, sc = [];
  sc.push("[0.0~2.0초 · 표지] " + hook + "  (첫 1초 안에 글자가 다 보이게, 줌인)");
  sec = 2; sc.push("[2.0~3.0초] " + n + "가지, 끝까지 보세요");
  sec = 3; r.items.forEach(function (it, i) { sc.push("[" + sec.toFixed(1) + "~" + (sec + step).toFixed(1) + "초] " + (i + 1) + ". " + it[0] + " → " + it[1]); sec += step; });
  sc.push("[" + sec.toFixed(1) + "~" + (sec + 2.5).toFixed(1) + "초 · 마무리] " + r.insight.split(". ")[0].replace(/\.$/, "") + "."); sec += 2.5;
  sc.push("[" + sec.toFixed(1) + "~" + (sec + 1.5).toFixed(1) + "초] 매일 아침 숫자 정리 @uphill.lab");
  var script = sc.join("\n") + "\n\n편집 팁: 항목마다 컷 전환 + 효과음 1번 · 빠른 비트(120BPM 이상) · 총 " + Math.round(sec + 1.5) + "초 내외 · 리스트 이미지를 1장으로 길게 보여주고 항목마다 확대해도 좋아요";
  var pin = ["저장해 두고 필요할 때 꺼내 보세요. 다음에 궁금한 주제를 댓글로 남겨 주시면 숫자로 정리해 올릴게요.", n + "개 중 몇 개나 알고 계셨나요? 댓글로 알려 주세요.", "더 자세한 숫자는 프로필의 매일 정리에서 볼 수 있어요."][Math.floor(Date.now() / 86400e3) % 3];
  return { cap: cap, script: script, pin: pin, cover: hook };
}

/* ---------- 열기 ---------- */
function reelOpen(id) {
  var btn = document.querySelector('[data-reel="' + id + '"]'), old = btn ? btn.textContent : ""; if (btn) btn.textContent = "만드는 중…";
  var need = REEL_DATA[id] && id !== "loss";
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return need && typeof nbLoad === "function" ? nbLoad(REEL_HIST) : null; }).then(function () {
    var r = reelGet(id);
    if (!r) { if (btn) btn.textContent = old; alert("이 릴스에 필요한 과거 데이터가 아직 준비되지 않았어요. 잠시 뒤 다시 눌러 주세요."); return; }
    if (typeof PUB_BANNED !== "undefined" && PUB_BANNED.test(reelTexts(r).cap)) console.warn("릴스 금칙어 확인 필요");
    reelImages(r);
    var txt = CARD_TXT.replace(/\s+/g, "");
    var fl = document.fonts && document.fonts.load ? Promise.all([500, 600, 700, 800, 900].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })) : Promise.resolve();
    return fl.then(function () {
      if (btn) btn.textContent = old;
      var list = reelImages(r), T = reelTexts(r), day = pubToday().replace(/-/g, ""), box = document.createElement("div");
      box.innerHTML = '<div class="thrPanel"><div class="thrHead"><b>릴스 글</b><small>표지 문구: <b>' + escapeHtml(T.cover) + '</b></small></div>' +
        '<div class="thrGrid"><div><div class="thrLbl">인스타 캡션 <span class="briefDim">' + T.cap.length + ' / 2,200자</span></div><textarea class="thrText rlCap" spellcheck="false"></textarea><button class="primary" data-c="cap">캡션 복사</button></div>' +
        '<div><div class="thrLbl">화면 자막 · 편집 순서</div><textarea class="thrText rlScr" spellcheck="false"></textarea><button class="primary" data-c="scr">자막 복사</button></div></div>' +
        '<div class="thrLbl" style="margin-top:8px">고정 댓글</div><textarea class="thrText rlPin" style="min-height:70px" spellcheck="false"></textarea><button class="primary" data-c="pin" style="width:100%">고정 댓글 복사</button></div>' +
        '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 이미지 전부 저장</button><span class="briefDim">1080×1920 · 9:16 · 위아래는 인스타 화면에 가려지지 않게 비워 뒀어요</span></div><div class="cardsWrap reelWrap"></div>';
      box.querySelector(".rlCap").value = T.cap; box.querySelector(".rlScr").value = T.script; box.querySelector(".rlPin").value = T.pin;
      Array.prototype.forEach.call(box.querySelectorAll("[data-c]"), function (b) { b.onclick = function () { var k = b.getAttribute("data-c"); chCopy(box.querySelector(k === "cap" ? ".rlCap" : k === "scr" ? ".rlScr" : ".rlPin").value, b); }; });
      var wrap = box.querySelector(".cardsWrap");
      list.forEach(function (it, i) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_릴스_" + id + "_" + day + "_" + (i + 1) + "_" + it.name + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + '. ' + it.name + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
      box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
      infoModal.open("릴스 · " + (r.t || T.cover), box);
    });
  });
}
function reelTabHtml() {
  var td = reelToday(), h = '<div class="briefDim" style="margin-bottom:8px">리스트형 정보 릴스 — 표지 · 리스트 · 마무리(프로필 안내) 이미지 + 인스타 캡션 + 화면 자막 + 고정 댓글이 같이 나와요. 데이터 릴스는 만들 때마다 최신 종가로 다시 계산돼요.</div>';
  ["데이터", "상식"].forEach(function (gname) {
    h += '<h4 class="chSub">' + (gname === "데이터" ? "데이터 릴스 (실제 종가로 계산)" : "상식 릴스 (저장각 리스트)") + '</h4><div class="perCal">' + REEL_LIST.filter(function (x) { return x.g === gname; }).map(function (x) {
      return '<div class="perRow' + (x.id === td ? ' now' : '') + '"><div class="perBody"><b>' + escapeHtml(x.t) + (x.id === td ? ' <span style="color:var(--gold,#c9a24f)">← 오늘</span>' : '') + '</b><small>' + escapeHtml(x.d) + '</small></div><div class="row" style="gap:4px;flex:0 0 auto"><button class="chip" data-reel="' + x.id + '">🎬 만들기</button>' + (typeof aiBtn === "function" ? aiBtn("reel:" + x.id) : "") + '</div></div>'; }).join("") + '</div>';
  });
  return h + '<div class="briefDim" style="margin-top:8px">세율·제도 숫자가 들어간 상식 릴스는 올리기 전 기준(캡션 맨 아래)을 한 번 확인하세요. 데이터 릴스는 환율·배당·세금을 뺀 가격 기준이에요.</div>';
}
