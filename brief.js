/* ============================================================
   '오늘' 탭 — 금일/금주 브리핑 (v5.4)
   전 종목 최근 시세(recent) + 뉴스 헤드라인으로 규칙에 따라 자동 정리한다.
   사람이 고른 추천이 아니라 "숫자 기준으로 걸러낸 참고 목록"이며, 모든 항목에 이유(숫자)를 붙인다.

   구성
     1. 시장 온도계   — 오른 종목 비율, 20일 평균선 위 비율, 대표 지수·환율·금·코인
     2. 테마 흐름     — 미리 묶어 둔 테마별 평균 등락과 그 안에서 가장 센 종목
     3. 이슈          — 급등·급락 TOP + 그 종목 기사 제목(이유 후보) + 뉴스 키워드 순위
     4. 참고 종목     — 떠오르는 / 세일 중 반등 / 조용한 우상향 / 과열 주의 / 과하게 눌린
     5. 오늘의 숫자·역사 속 이번 주
   계산 함수(briefCompute 등)는 DOM을 쓰지 않아 단위 테스트가 가능하다.
   ============================================================ */

/* ---------- 테마 묶음 (티커 목록 기준, 없는 종목은 자동 제외) ---------- */
var BRIEF_THEMES = [
  ["반도체", ["005930.KS", "000660.KS", "042700.KS", "NVDA", "AMD", "INTC", "MU", "TSM", "ASML", "QCOM", "AVGO", "ARM", "MRVL", "LRCX", "AMAT", "KLAC", "ADI", "NXPI", "TXN", "SOXX", "SMH", "SMCI", "058470.KQ"]],
  ["AI·빅테크", ["AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "PLTR", "NFLX", "ORCL", "CRM", "ADBE", "NOW", "PANW", "CRWD", "SNOW", "IBM", "CSCO", "035420.KS", "035720.KS"]],
  ["2차전지", ["373220.KS", "051910.KS", "006400.KS", "003670.KS", "247540.KQ", "086520.KQ", "009830.KS"]],
  ["바이오·헬스", ["207940.KS", "068270.KS", "000100.KS", "196170.KQ", "028300.KQ", "068760.KQ", "096530.KQ", "LLY", "JNJ", "UNH", "PFE", "MRK", "ABBV", "ABT", "TMO", "AMGN", "NVO", "VRTX", "REGN", "ISRG", "GEHC"]],
  ["자동차", ["005380.KS", "000270.KS", "012330.KS", "086280.KS", "TSLA", "F", "GM", "RIVN"]],
  ["조선·방산·기계", ["012450.KS", "079550.KS", "047810.KS", "064350.KS", "042660.KS", "009540.KS", "329180.KS", "010140.KS", "034020.KS", "241560.KS", "LMT", "RTX", "NOC", "GD", "GE", "GEV", "CAT", "DE", "HON", "BA", "ETN", "EMR"]],
  ["금융", ["105560.KS", "055550.KS", "086790.KS", "316140.KS", "138040.KS", "032830.KS", "323410.KS", "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP", "MA", "V", "SCHW", "CB", "BRK-B", "SPGI", "PYPL", "COIN"]],
  ["에너지·소재", ["096770.KS", "010950.KS", "078930.KS", "011170.KS", "010060.KS", "005490.KS", "010130.KS", "015760.KS", "XOM", "CVX", "COP", "SHEL", "BP", "SLB", "OXY", "LIN", "FCX", "NEM", "NEE", "DUK", "SO"]],
  ["소비재·유통", ["090430.KS", "051900.KS", "097950.KS", "033780.KS", "066570.KS", "KO", "PEP", "PG", "WMT", "COST", "HD", "LOW", "TGT", "MCD", "SBUX", "NKE", "DIS", "MO", "PM", "MDLZ", "CL", "BKNG", "UBER", "ABNB", "SHOP", "SPOT"]],
  ["엔터·게임", ["352820.KS", "036570.KS", "251270.KS", "259960.KS", "263750.KQ", "293490.KQ", "035900.KQ", "041510.KQ", "122870.KQ"]],
  ["운송·통신", ["003490.KS", "011200.KS", "017670.KS", "030200.KS", "UNP", "T", "VZ", "CMCSA"]],
  ["지수·대표 ETF", ["^KS11", "^KQ11", "^GSPC", "^IXIC", "^NDX", "^DJI", "^N225", "^HSI", "SPY", "VOO", "QQQ", "VTI", "SCHD", "JEPI", "069500.KS", "360750.KS", "133690.KS"]],
  ["채권", ["TLT", "IEF", "SHY", "LQD"]],
  ["금·원자재", ["GLD", "GC=F", "SLV", "DBC", "USO", "132030.KS"]],
  ["코인·관련주", ["BTC-USD", "ETH-USD", "MSTR", "COIN"]]
];
/* 참고 종목에서 빼는 것: 레버리지·인버스·변동성지수·환율 (숫자 기준이 왜곡된다) */
var BRIEF_EXCLUDE = /^(TQQQ|SOXL|122630\.KS|114800\.KS|\^VIX|DX-Y\.NYB|KRW=X|JPYKRW=X|EURKRW=X)$/;
/* 인기 종목 기본 목록 — 실제로는 이 앱에서 최근 2주간 많이 조회·관심 담은 순위(/api/snap?popular=1)로 매일 바뀐다.
   조회 데이터가 아직 적을 때(합계 30 미만)만 이 목록을 쓴다. */
var BRIEF_POPULAR = ["005930.KS", "000660.KS", "SPY", "QQQ", "NVDA", "TSLA", "AAPL", "PLTR", "BTC-USD", "ETH-USD", "XRP-USD", "GLD", "^KS11", "KRW=X"];
var BRIEF_MAX = { movers: 15, picks: 12, turnover: 10 };
/* 시장 구분 — 전체 / 국내 / 미국 / 코인 */
var BRIEF_MKT = { all: "전체", kr: "국내", us: "미국", coin: "코인" };
function briefMkt(sym) {
  if (/\.K[SQ]$|^\^KS|^\^KQ/.test(sym)) return "kr";
  if (/-USD$/.test(sym)) return "coin";
  if (/=X$|=F$|^\^(N225|HSI)$/.test(sym)) return "etc";
  return "us";
}
var BRIEF_INDEX_BY_MKT = {
  kr: [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["KRW=X", "달러/원"], ["005930.KS", "삼성전자"], ["000660.KS", "SK하이닉스"]],
  us: [["^GSPC", "S&P500"], ["^IXIC", "나스닥"], ["^DJI", "다우"], ["^VIX", "공포지수"], ["TLT", "미국 장기채"], ["GLD", "금"]],
  coin: [["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"], ["XRP-USD", "리플"], ["SOL-USD", "솔라나"], ["BNB-USD", "바이낸스코인"], ["DOGE-USD", "도지코인"], ["ADA-USD", "에이다"], ["TRX-USD", "트론"], ["LINK-USD", "체인링크"], ["KRW=X", "달러/원"]]
};
var BRIEF_INDEX_ROW = [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["^GSPC", "S&P500"], ["^IXIC", "나스닥"], ["KRW=X", "달러/원"], ["GLD", "금"], ["BTC-USD", "비트코인"], ["^VIX", "공포지수"]];

/* ---------- 순수 계산 ---------- */
/* 달력 구간 (v8.4): BRIEF_WIN = { from: ms, to: ms }가 설정돼 있으면 '구간 시작 전 마지막 종가 → 구간 안 마지막 종가'로 등락을 계산한다.
   (한 주 정리 = 월~일, 한 달 정리 = 1일~말일처럼 달력 기준이 필요한 정기 세트용. 평소엔 null → 최근 N거래일) */
var BRIEF_WIN = null;
function briefStats(sym, d, mode) {
  var c = d.c || [], v = d.v || [], n = c.length;
  if (n < 22 || c[n - 1] == null) return null;
  var last = c[n - 1], start = null, winFrom = null, winTo = null;
  var back = mode === "week" ? 5 : mode === "month" ? 21 : 1;
  if (BRIEF_WIN && d.t) {
    var iN = -1, i0 = -1;
    for (var k = n - 1; k >= 0; k--) { if (c[k] == null) continue; if (iN < 0 && d.t[k] * 1000 <= BRIEF_WIN.to) iN = k; if (d.t[k] * 1000 < BRIEF_WIN.from) { i0 = k; break; } }
    if (iN < 0 || i0 < 0 || iN <= i0) return null;
    last = c[iN]; start = c[i0]; back = iN - i0; winFrom = d.t[i0 + 1] * 1000; winTo = d.t[iN] * 1000;
    var ret = last / start - 1;
  } else {
    if (n - 1 - back < 0) return null;
    start = c[n - 1 - back];
    var ret = last / start - 1;
  }
  var iL = BRIEF_WIN && typeof iN === "number" && iN >= 0 ? iN : n - 1;
  var ret1 = last / c[iL - 1] - 1, ret5 = iL > 5 ? last / c[iL - 5] - 1 : null;
  // v8.9: 스냅샷이 1년치(약 250거래일)로 늘어 '최근 90일' 계산은 마지막 64거래일로, 52주 고·저가는 자체 데이터로 센다 (야후 meta는 보조)
  var iL0 = BRIEF_WIN && typeof iN === "number" && iN >= 0 ? iN : n - 1, i90 = Math.max(0, iL0 - 63), i250 = Math.max(0, iL0 - 249);
  if (iL0 < 21) return null;
  var m1 = last / c[Math.max(0, iL0 - 21)] - 1, m3 = last / c[i90] - 1, y1 = iL0 - 250 >= 0 ? last / c[iL0 - 250] - 1 : null;
  var ma20 = 0; for (var i = iL0 - 19; i <= iL0; i++) ma20 += c[i]; ma20 /= 20;
  var ma5 = 0; for (i = iL0 - 4; i <= iL0; i++) ma5 += c[i]; ma5 /= 5;
  var ma50 = null, ma200 = null;
  if (iL0 >= 49) { ma50 = 0; for (i = iL0 - 49; i <= iL0; i++) ma50 += c[i]; ma50 /= 50; }
  if (iL0 >= 199) { ma200 = 0; for (i = iL0 - 199; i <= iL0; i++) ma200 += c[i]; ma200 /= 200; }
  var hi90 = -Infinity, hi250 = -Infinity, lo250 = Infinity, hiPrev = -Infinity, loPrev = Infinity;
  for (i = i250; i <= iL0; i++) { var cv = c[i]; if (cv == null) continue; if (i >= i90 && cv > hi90) hi90 = cv; if (cv > hi250) hi250 = cv; if (cv < lo250) lo250 = cv; if (i < iL0) { if (cv > hiPrev) hiPrev = cv; if (cv < loPrev) loPrev = cv; } }
  var longEnough = iL0 - i250 >= 200;   // 1년치가 있을 때만 '52주'라고 부른다
  var hi = longEnough ? hi250 : (d.meta && d.meta.fiftyTwoWeekHigh > 0 ? Math.max(d.meta.fiftyTwoWeekHigh, hi90) : hi90);
  var vsHi = hi > 0 ? Math.min(0, last / hi - 1) : null;
  if (vsHi != null && vsHi < -0.95) vsHi = null;                        // 액면분할 미반영 등으로 의심되면 쓰지 않음
  var vsLo = longEnough && lo250 > 0 ? last / lo250 - 1 : null;
  var newHigh = longEnough && last >= hiPrev, newLow = longEnough && last <= loPrev;   // 52주 종가 신고가 / 신저가 (오늘 종가가 지난 1년 중 최고/최저)
  var vs90 = last / hi90 - 1;
  var rsi = typeof rsiWilder === "function" ? rsiWilder(c, 14) : null;
  var v5 = 0, v20 = 0;
  for (i = n - 5; i < n; i++) v5 += v[i] || 0;
  for (i = Math.max(0, n - 25); i < n - 5; i++) v20 += v[i] || 0;
  v5 /= 5; v20 /= Math.max(1, Math.min(20, n - 5));
  // 거래대금(마지막 날): 코인은 야후 거래량이 이미 달러 금액, 주식은 종가×주식수
  var amtLast = /-USD$/.test(sym) ? (v[n - 1] || 0) : (v[n - 1] || 0) * last;
  var amtAvg = /-USD$/.test(sym) ? v20 : v20 * ma20;
  // 일간 수익률 변동성(90일) — 조용한 우상향 판단
  var rs = [], mean = 0;
  for (i = Math.max(1, i90); i <= iL0; i++) { var r = c[i] / c[i - 1] - 1; rs.push(r); mean += r; }
  mean /= rs.length;
  var sd = 0; for (i = 0; i < rs.length; i++) sd += (rs[i] - mean) * (rs[i] - mean);
  sd = Math.sqrt(sd / Math.max(1, rs.length - 1));
  // 이번 변동이 최근 90일 중 몇 번째로 큰가 (백분위)
  var absR = Math.abs(ret1), bigger = 0;
  for (i = 0; i < rs.length; i++) if (Math.abs(rs[i]) > absR) bigger++;
  // 오늘 20일선을 넘었나 (어제는 아래, 오늘은 위)
  var ma20y = (ma20 * 20 - c[n - 1] + c[n - 21]) / 20;
  var crossUp = c[n - 2] < ma20y && last >= ma20;
  return {
    sym: sym, name: (d.meta && (d.meta.shortName || d.meta.longName)) || sym, cur: (d.meta && d.meta.currency) || "",
    last: last, ret: ret, ret1: ret1, ret5: ret5, m1: m1, m3: m3, ma20: ma20, ma5: ma5, vsMa20: last / ma20 - 1,
    vsHi: vsHi, vs90: vs90, vsLo: vsLo, hi250: longEnough ? hi250 : null, lo250: longEnough ? lo250 : null, newHigh: newHigh, newLow: newLow, longEnough: longEnough, y1: y1,
    ma50: ma50, ma200: ma200, above50: ma50 != null ? last >= ma50 : null, above200: ma200 != null ? last >= ma200 : null,
    rsi: rsi, volX: v20 > 0 ? v5 / v20 : null, sd: sd, above20: last >= ma20,
    pctRank: rs.length ? 1 - bigger / rs.length : null, crossUp: crossUp,
    amt: amtLast, amtX: amtAvg > 0 ? amtLast / amtAvg : null,
    lastT: d.t && d.t.length ? d.t[d.t.length - 1] * 1000 : null,
    start: start, winDays: back, winFrom: winFrom, winTo: winTo,
    bestDay: null
  };
}

var BRIEF_KO = {};
if (typeof TICKER_DICT !== "undefined") TICKER_DICT.forEach(function (t) { BRIEF_KO[t[0]] = t[1]; });
function briefName(s) { var n = BRIEF_KO[s.sym] || s.name || s.sym; return String(n).replace(/\s*\(.*?\)\s*/g, "").trim() || s.sym; }
function briefPct(x, digits) { if (x == null || !isFinite(x)) return "-"; var d = digits == null ? 1 : digits; return (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%"; }

/* ---------- 데이터 점검 ----------
   ① 오래된 데이터: 같은 시장의 최신 기준일보다 4일 넘게 뒤처진 종목(수집 실패로 지난 값이 남은 것) → 순위에서 뺌
   ② 비정상 급변: 하루 ±40% 넘는 움직임(코인 제외 ±40%, 코인 ±60%) → 오류 가능성이 커 순위에서 뺌
   ③ 같은 회사 중복: GOOG/GOOGL, BRK-A/BRK-B, 삼성전자/삼성전자우, 같은 지수 ETF(SPY/VOO) → 하나만 순위에 */
var BRIEF_DUP = { GOOG: "GOOGL", "BRK-A": "BRK-B", "005935.KS": "005930.KS", VOO: "SPY", "GC=F": "GLD" };
function briefQuality(rows) {
  var mk = function (s) { return /\.K[SQ]$|^\^KS|^\^KQ/.test(s.sym) ? "kr" : /-USD$/.test(s.sym) ? "coin" : /=X$|=F$/.test(s.sym) ? "fx" : "us"; };
  var newest = {};
  rows.forEach(function (s) { var k = mk(s); if (s.lastT && (!newest[k] || s.lastT > newest[k])) newest[k] = s.lastT; });
  var stale = [], spike = [], bad = {};
  rows.forEach(function (s) {
    var k = mk(s);
    if (s.lastT && newest[k] && newest[k] - s.lastT > 4 * 86400000) { stale.push(s); bad[s.sym] = "stale"; }
    var lim = k === "coin" ? 0.6 : 0.4;
    if (Math.abs(s.ret1) > lim) { spike.push(s); bad[s.sym] = "spike"; }
  });
  return { stale: stale, spike: spike, bad: bad, total: rows.length };
}

function briefCompute(recent, opts) {
  opts = opts || {};
  var mode = opts.mode === "week" ? "week" : opts.mode === "month" ? "month" : "day";
  var market = BRIEF_MKT[opts.market] && opts.market !== "all" ? opts.market : "all";
  function inMkt(sym) { return market === "all" || briefMkt(sym) === market; }
  var now = opts.now ? new Date(opts.now) : new Date();
  var rows = [], bySym = {}, asOf = 0;
  Object.keys(recent.symbols || {}).forEach(function (sym) {
    var s = briefStats(sym, recent.symbols[sym], mode);
    if (!s) return;
    rows.push(s); bySym[sym] = s;
    if (s.lastT && s.lastT > asOf) asOf = s.lastT;
  });
  var quality = briefQuality(rows);
  var stocks = rows.filter(function (s) { return !BRIEF_EXCLUDE.test(s.sym) && !quality.bad[s.sym] && !BRIEF_DUP[s.sym] && inMkt(s.sym); });
  var label = mode === "week" ? "이번 주" : mode === "month" ? "이번 달" : "오늘";

  /* 1. 온도계 */
  var up = 0, above = 0;
  var a50 = 0, n50 = 0, a200 = 0, n200 = 0, nh = [], nl = [], nearH = [], nearL = [];
  stocks.forEach(function (s) { if (s.ret > 0) up++; if (s.above20) above++; if (s.above50 != null) { n50++; if (s.above50) a50++; } if (s.above200 != null) { n200++; if (s.above200) a200++; }
    if (s.newHigh) nh.push(s); else if (s.vsHi != null && s.longEnough && s.vsHi >= -0.03) nearH.push(s);
    if (s.newLow) nl.push(s); else if (s.vsLo != null && s.vsLo <= 0.03) nearL.push(s); });
  var byAmt = function (a, b) { return (b.amt || 0) - (a.amt || 0); }; nh.sort(byAmt); nl.sort(byAmt); nearH.sort(byAmt); nearL.sort(byAmt);
  var temp = { total: stocks.length, up: up, upPct: stocks.length ? up / stocks.length : 0, above20: above, abovePct: stocks.length ? above / stocks.length : 0,
    above50: a50, n50: n50, above50Pct: n50 ? a50 / n50 : null, above200: a200, n200: n200, above200Pct: n200 ? a200 / n200 : null,
    newHigh: nh, newLow: nl, nearHigh: nearH, nearLow: nearL };
  temp.word = temp.upPct >= 0.65 ? "훈풍" : temp.upPct >= 0.5 ? "미지근" : temp.upPct >= 0.35 ? "쌀쌀" : "한파";
  temp.desc = temp.upPct >= 0.65 ? "대부분이 올랐어요. 이런 날엔 '나만 못 번 것 같은' 조급함을 조심하세요."
    : temp.upPct >= 0.5 ? "오른 종목과 내린 종목이 반반이에요. 종목별 이유가 갈리는 장이에요."
    : temp.upPct >= 0.35 ? "내린 종목이 더 많아요. 개별 악재보다 시장 전체 분위기일 가능성이 커요."
    : "거의 다 내렸어요. 이런 날은 내 종목만의 문제가 아니에요. 과거 기록을 보고 판단하세요.";
  var indexRow = (BRIEF_INDEX_BY_MKT[market] || BRIEF_INDEX_ROW).map(function (p) { var s = bySym[p[0]]; return s ? { sym: p[0], name: p[1], ret: s.ret, last: s.last } : null; }).filter(Boolean);

  /* 2. 테마 흐름 */
  var themes = BRIEF_THEMES.map(function (t) {
    var list = t[1].map(function (sym) { return quality.bad[sym] || BRIEF_DUP[sym] || !inMkt(sym) ? null : bySym[sym]; }).filter(Boolean);   // 점검 제외·중복 종목은 업종 평균에서도 뺀다
    if (list.length < 2) return null;
    var avg = 0; list.forEach(function (s) { avg += s.ret; }); avg /= list.length;
    var best = list.slice().sort(function (a, b) { return b.ret - a.ret; })[0];
    var worst = list.slice().sort(function (a, b) { return a.ret - b.ret; })[0];
    var upN = list.filter(function (s) { return s.ret > 0; }).length;
    return { name: t[0], ret: avg, n: list.length, up: upN, best: best, worst: worst };
  }).filter(Boolean).sort(function (a, b) { return b.ret - a.ret; });

  /* 3. 급등·급락 */
  var sorted = stocks.slice().sort(function (a, b) { return b.ret - a.ret; });
  // 급등은 오른 것만, 급락은 내린 것만 (코인처럼 종목 수가 적을 때 같은 종목이 양쪽에 나오지 않게)
  var movers = { up: sorted.filter(function (s) { return s.ret > 0; }).slice(0, BRIEF_MAX.movers),
                 down: sorted.filter(function (s) { return s.ret < 0; }).slice(-BRIEF_MAX.movers).reverse() };
  // 시장별 기준일 (한국·미국은 마감 시각이 달라 하루 차이 날 수 있다)
  var asOfKr = 0, asOfUs = 0;
  rows.forEach(function (s) {
    if (!s.lastT) return;
    if (/\.K[SQ]$|^\^KS|^\^KQ/.test(s.sym)) { if (s.lastT > asOfKr) asOfKr = s.lastT; }
    else if (!/-USD$|=X$|=F$|^\^(N225|HSI|VIX)$/.test(s.sym) && s.lastT > asOfUs) asOfUs = s.lastT;   // 코인·환율은 주말에도 움직여 기준일이 앞서 보이므로 뺀다
  });

  /* 4. 참고 종목 (규칙) */
  function take(list, n) { return list.slice(0, n); }
  var rising = take(stocks.filter(function (s) { return s.ret5 != null && s.ret5 > 0.03 && s.above20 && (s.volX == null || s.volX >= 1.0); })
    .sort(function (a, b) { return (b.ret5 + (b.volX ? Math.min(b.volX, 3) * 0.01 : 0)) - (a.ret5 + (a.volX ? Math.min(a.volX, 3) * 0.01 : 0)); }), BRIEF_MAX.picks);
  var sale = take(stocks.filter(function (s) { return s.vsHi != null && s.vsHi <= -0.15 && s.ret5 != null && s.ret5 > 0 && s.last > s.ma5; })
    .sort(function (a, b) { return a.vsHi - b.vsHi; }), BRIEF_MAX.picks);
  var steady = take(stocks.filter(function (s) { return s.m3 > 0.05 && s.above20 && s.sd > 0; })
    .sort(function (a, b) { return a.sd - b.sd; }), BRIEF_MAX.picks);
  var hot = take(stocks.filter(function (s) { return s.vsMa20 >= 0.12 || (s.rsi != null && s.rsi >= 75); })
    .sort(function (a, b) { return b.vsMa20 - a.vsMa20; }), BRIEF_MAX.picks);
  var cold = take(stocks.filter(function (s) { return (s.rsi != null && s.rsi <= 30) || s.vsMa20 <= -0.12; })
    .sort(function (a, b) { return a.vsMa20 - b.vsMa20; }), BRIEF_MAX.picks);
  var crossed = take(stocks.filter(function (s) { return s.crossUp; }).sort(function (a, b) { return b.ret1 - a.ret1; }), BRIEF_MAX.picks);

  function why(kind, s) {
    var nm = briefName(s);
    if (kind === "rising") return "최근 5일 " + briefPct(s.ret5) + " · 20일 평균선 위" + (s.volX ? " · 거래량 평소의 " + s.volX.toFixed(1) + "배" : "") + (s.vsHi != null ? " · 52주 최고 대비 " + briefPct(s.vsHi) : "");
    if (kind === "sale") return "52주 최고보다 " + briefPct(s.vsHi) + " 아래인데 최근 5일 " + briefPct(s.ret5) + " · 5일 평균선 위로 올라옴";
    if (kind === "steady") return "3개월 " + briefPct(s.m3) + " · 하루 변동 평균 " + (s.sd * 100).toFixed(1) + "%로 잔잔함 · 20일 평균선 위";
    if (kind === "hot") return "20일 평균보다 " + briefPct(s.vsMa20) + " 위" + (s.rsi != null ? " · RSI " + s.rsi.toFixed(0) : "") + " — 단기 과열 구간, 추격 매수 주의";
    if (kind === "cold") return "20일 평균보다 " + briefPct(s.vsMa20) + (s.rsi != null ? " · RSI " + s.rsi.toFixed(0) : "") + " — 과하게 눌림. 왜 눌렸는지(종목 탭 '하락·회복') 먼저 확인";
    if (kind === "crossed") return "오늘 20일 평균선을 위로 넘음 (" + briefPct(s.ret1) + ") — 추세 전환 후보. 하루로는 확정 아님";
    return nm;
  }
  var picks = [
    { id: "rising", icon: "🚀", title: "떠오르는", sub: "최근 5일 강한 흐름 + 20일선 위 + 거래량", items: rising },
    { id: "sale", icon: "🛒", title: "세일 중 반등", sub: "52주 최고보다 15% 이상 싼데 이번 주 오른 것", items: sale },
    { id: "steady", icon: "🧘", title: "조용한 우상향", sub: "3개월 +5% 이상인데 하루 변동이 작은 것", items: steady },
    { id: "crossed", icon: "🔁", title: "추세 전환 후보", sub: "오늘 20일 평균선을 위로 넘은 것", items: crossed },
    { id: "hot", icon: "🌡️", title: "과열 주의", sub: "20일 평균보다 12% 이상 위 또는 RSI 75 이상", items: hot },
    { id: "cold", icon: "🧊", title: "과하게 눌린", sub: "RSI 30 이하 또는 20일 평균보다 12% 이상 아래", items: cold }
  ].map(function (p) { p.items = p.items.map(function (s) { return { s: s, why: why(p.id, s) }; }); return p; });

  /* 4-b. 인기 종목 + 거래대금 순위 */
  var fx = bySym["KRW=X"] ? bySym["KRW=X"].last : 1400;
  function amtKrw(s) { return s.amt * (/\.K[SQ]$/.test(s.sym) || s.cur === "KRW" ? 1 : fx); }
  var withAmt = rows.filter(function (s) { return s.amt > 0 && !/^\^|=X$|=F$/.test(s.sym) && !BRIEF_EXCLUDE.test(s.sym) && !quality.bad[s.sym] && !BRIEF_DUP[s.sym]; });
  var turnover = {
    kr: withAmt.filter(function (s) { return /\.K[SQ]$/.test(s.sym); }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, BRIEF_MAX.turnover),
    us: withAmt.filter(function (s) { return !/\.K[SQ]$|-USD$/.test(s.sym); }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, BRIEF_MAX.turnover),
    coin: withAmt.filter(function (s) { return /-USD$/.test(s.sym); }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, BRIEF_MAX.turnover)
  };
  var hotVol = withAmt.filter(function (s) { return s.amtX != null && s.amtX >= 1.8 && inMkt(s.sym); }).sort(function (a, b) { return b.amtX - a.amtX; }).slice(0, BRIEF_MAX.turnover);
  var popSrc = "default", popScore = {};
  var ranked = (opts.popular || []).filter(function (p) { return bySym[p.s] && !BRIEF_EXCLUDE.test(p.s) && !quality.bad[p.s]; });
  var popTotal = ranked.reduce(function (a, p) { return a + p.score; }, 0);
  var popular;
  if (popTotal >= 30 && ranked.length >= 6) {
    popSrc = "ranked";
    ranked.forEach(function (p, i) { popScore[p.s] = { score: p.score, rank: i + 1 }; });
    popular = ranked.slice(0, 14).map(function (p) { return bySym[p.s]; });
    // 순위 밖이라도 대표 지수·환율은 맨 뒤에 붙여 준다
    ["^KS11", "KRW=X"].forEach(function (sym) { if (bySym[sym] && popular.indexOf(bySym[sym]) < 0 && popular.length < 16) popular.push(bySym[sym]); });
  } else {
    // 조회 기록이 아직 적으면 거래대금(종가×거래량) 기준으로 매일 자동 구성:
    // 한국 5 + 미국 5 + 코인 2 + 거래대금이 평소보다 급증한 것 2 → 고정 목록이 아니라 그날 시장이 정한다
    popSrc = "turnover";
    var seen = {};
    function pushAll(list, n) { list.slice(0, n).forEach(function (s) { if (!seen[s.sym]) { seen[s.sym] = 1; popular.push(s); } }); }
    popular = [];
    pushAll(turnover.kr, 5); pushAll(turnover.us, 5); pushAll(turnover.coin, 2); pushAll(hotVol, 2);
    if (popular.length < 6) popular = BRIEF_POPULAR.map(function (sym) { return bySym[sym]; }).filter(Boolean);
    ["^KS11", "KRW=X"].forEach(function (sym) { if (bySym[sym] && !seen[sym]) popular.push(bySym[sym]); });
  }

  // 시장을 고르면 인기 종목도 그 시장 것만 (부족하면 그 시장 거래대금 상위로 채움)
  if (market !== "all") {
    popular = popular.filter(function (s) { return s && briefMkt(s.sym) === market; });
    (turnover[market] || []).forEach(function (s) { if (popular.length < 10 && popular.indexOf(s) < 0) popular.push(s); });
  }

  /* 5. 오늘의 숫자 */
  var saleN = stocks.filter(function (s) { return s.vsHi != null && s.vsHi <= -0.2; }).length;
  var athN = stocks.filter(function (s) { return s.vsHi != null && s.vsHi >= -0.02; }).length;
  var bigMove = stocks.filter(function (s) { return s.pctRank != null && s.pctRank >= 0.98 && Math.abs(s.ret1) >= 0.03; })
    .sort(function (a, b) { return Math.abs(b.ret1) - Math.abs(a.ret1); })[0];
  var vix = bySym["^VIX"];
  var saleList = stocks.filter(function (s) { return s.vsHi != null && s.vsHi <= -0.2; }).sort(function (a, b) { return a.vsHi - b.vsHi; });
  var athList = stocks.filter(function (s) { return s.vsHi != null && s.vsHi >= -0.02; }).sort(function (a, b) { return b.vsHi - a.vsHi; });
  var aboveList = stocks.filter(function (s) { return s.above20; }).sort(function (a, b) { return b.vsMa20 - a.vsMa20; });
  var belowList = stocks.filter(function (s) { return !s.above20; }).sort(function (a, b) { return a.vsMa20 - b.vsMa20; });
  var numbers = [
    { v: saleN + "개", l: "52주 최고 대비 -20% 이상 '세일 중'", n: stocks.length + "개 중", list: saleList, col: "52주 최고 대비", key: "vsHi", title: "세일 중인 종목 (52주 최고 대비 -20% 이상)" },
    { v: athN + "개", l: "52주 최고가 근처(-2% 이내)", n: "신고가 부근", list: athList, col: "52주 최고 대비", key: "vsHi", title: "신고가 부근 종목 (52주 최고 대비 -2% 이내)" },
    { v: Math.round(temp.abovePct * 100) + "%", l: "20일 평균선 위에 있는 종목 비율", n: temp.abovePct >= 0.6 ? "상승 추세 우세" : temp.abovePct <= 0.4 ? "하락 추세 우세" : "혼조",
      list: aboveList, col: "20일 평균 대비", key: "vsMa20", title: "20일 평균선 위 " + aboveList.length + "개 · 아래 " + belowList.length + "개", list2: belowList, title2: "20일 평균선 아래" }
  ];
  if (vix && (market === "all" || market === "us")) numbers.push({ v: vix.last.toFixed(1), l: "VIX 공포지수", n: vix.last >= 30 ? "공포 구간 — 과거엔 이런 때가 저점 근처였던 적이 많음" : vix.last >= 20 ? "불안 구간" : "평온 구간 — 방심하기 쉬운 때", sym: "^VIX" });
  if (bigMove) numbers.push({ v: briefPct(bigMove.ret1), l: briefName(bigMove) + " — 최근 90일 중 가장 큰 하루 변동", n: "상위 2% 안", sym: bigMove.sym });

  /* 6. 역사 속 이맘때 (±14일, 연도 무관) */
  var hist = [];
  if (typeof EVENTS !== "undefined") {
    var md = now.getMonth() * 31 + now.getDate();
    EVENTS.forEach(function (e) {
      var d = new Date(e.ts), emd = d.getMonth() * 31 + d.getDate();
      var diff = Math.abs(emd - md); if (diff > 186) diff = 372 - diff;
      if (diff <= 14 && d.getFullYear() < now.getFullYear()) hist.push({ date: e.date, name: e.name, type: e.type, years: now.getFullYear() - d.getFullYear() });
    });
  }
  return { quality: quality, mode: mode, market: market, mktName: BRIEF_MKT[market], label: label, asOf: asOf, asOfKr: asOfKr, asOfUs: asOfUs, fx: fx, popular: popular, popSrc: popSrc, popScore: popScore, popTotal: popTotal, turnover: turnover, hotVol: hotVol, amtKrw: amtKrw, temp: temp, indexRow: indexRow, themes: themes, movers: movers, picks: picks, numbers: numbers, history: hist, count: stocks.length, generated: recent.generated || "" };
}

/* 뉴스 제목 묶음 → 키워드 순위 (NEWS_TAGS 재사용) */
function briefKeywords(items) {
  var tags = typeof NEWS_TAGS !== "undefined" ? NEWS_TAGS : [];
  var seen = {}, out = [];
  tags.forEach(function (t) {
    var hits = [];
    items.forEach(function (it) { if (t[1].test(it.title) && !seen[it.title]) hits.push(it); });
    if (hits.length) out.push({ tag: t[0], n: hits.length, items: hits.slice(0, 2) });
  });
  return out.sort(function (a, b) { return b.n - a.n; });
}

/* ================= UI ================= */
var briefState = { mode: "day", market: (function () { try { return localStorage.getItem("sm.briefMkt") || "all"; } catch (e) { return "all"; } })(), recent: null, result: null, newsAt: 0, open: {} };
var BRIEF_SHOW = { movers: 5, picks: 4, turnover: 5, hotVol: 5 };

/* 더보기/접기: 목록 HTML 조각들을 받아 앞 n개만 보이고 나머지는 버튼으로 편다 */
function briefCollapsible(key, parts, n, unit) {
  if (parts.length <= n) return parts.join("");
  var open = !!briefState.open[key];
  var html = parts.slice(0, open ? parts.length : n).join("");
  html += '<button class="briefMore" data-more="' + key + '">' + (open ? "접기 ▲" : "더보기 ▼ (+" + (parts.length - n) + (unit || "개") + ")") + '</button>';
  return html;
}
function briefFmtAmt(krw) {
  if (krw >= 1e12) return (krw / 1e12).toFixed(1) + "조원";
  if (krw >= 1e8) return Math.round(krw / 1e8).toLocaleString() + "억원";
  return Math.round(krw / 1e4).toLocaleString() + "만원";
}

function briefFmtDate(ms) { if (!ms) return ""; var d = new Date(ms + 9 * 3600 * 1000); return d.getUTCFullYear() + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCDate()).padStart(2, "0"); }   // 한국 시간 기준
function briefColor(x) { return x > 0 ? "var(--up)" : x < 0 ? "var(--down)" : "var(--sub)"; }
function briefSymLink(s) {
  return '<button class="linkBtn briefSym" data-sym="' + s.sym + '" title="종목 탭에서 보기">' + escapeHtml(briefName(s)) + '</button>';
}
function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* 숫자 카드 → 해당 종목 전체 목록 팝업 */
function openBriefList(n, R) {
  var box = document.createElement("div");
  function rows(list, key, col) {
    if (!list.length) return '<div class="briefDim" style="padding:8px 0">해당 종목이 없어요.</div>';
    return '<div class="briefRowHead"><span></span><span>종목</span><span>' + col + '</span><span>' + R.label + ' 등락</span></div>' +
      list.map(function (s, i) {
        return '<div class="briefRow"><span class="rk">' + (i + 1) + '</span><span class="nm">' + briefSymLink(s) + '</span>' +
          '<span class="mt"><b>' + briefPct(s[key]) + '</b></span><span class="rt" style="color:' + briefColor(s.ret) + '">' + briefPct(s.ret) + '</span></div>';
      }).join("");
  }
  box.innerHTML = '<div class="briefDim" style="margin-bottom:8px">' + escapeHtml(n.title) + ' · ' + n.list.length + '개 · 종목 이름을 누르면 차트로 이동해요</div>' +
    rows(n.list, n.key, n.col) +
    (n.list2 ? '<h3 style="margin-top:18px">' + escapeHtml(n.title2) + ' <small>' + n.list2.length + '개</small></h3>' + rows(n.list2, n.key, n.col) : "");
  Array.prototype.forEach.call(box.querySelectorAll(".briefSym"), function (b) {
    b.onclick = function () {
      infoModal.close();
      $("searchInput").value = b.getAttribute("data-sym");
      navTo("single", "chart");
      if (typeof load === "function") load();
    };
  });
  infoModal.open(n.v + " — " + n.l, box);
}


/* ---------- 한눈에 보는 판 (v8.9) ---------- */
function briefDateLine(R) {
  var us = R.asOfUs ? new Date(R.asOfUs + 9 * 3600e3).toISOString().slice(0, 10) : "", kr = R.asOfKr ? new Date(R.asOfKr + 9 * 3600e3).toISOString().slice(0, 10) : "", today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  return (R.market === "kr" ? "한국 거래일 " + kr : R.market === "us" ? "미국 거래일 " + us : "미국 " + us + " · 한국 " + kr) + " · 발행 " + today;
}
function briefBarHtml(label, sub, pct, refPct, refLabel) {
  var p = Math.round(pct * 1000) / 10;
  return '<div class="fdBar"><div class="fdBarTop"><div><b>' + label + '</b><small>' + sub + '</small></div><div class="fdVal">' + p.toFixed(1) + '%</div></div>' +
    '<div class="fdTrack"><div class="fdFill" style="width:' + Math.min(100, p) + '%"></div>' + (refPct != null ? '<div class="fdRef" style="left:' + refPct + '%"><span>' + refLabel + '</span></div>' : '') + '</div></div>';
}
function briefHealthFinding(t) {
  var p = t.abovePct, s = Math.round(p * 1000) / 10;
  if (t.n200 && t.above200Pct != null) {
    var l = Math.round(t.above200Pct * 1000) / 10;
    if (p >= 0.6 && t.above200Pct >= 0.6) return "단기·장기 추세 모두 <b>절반을 넘습니다</b> — 20일선 위 " + s + "% · 200일선 위 " + l + "%";
    if (p < 0.4 && t.above200Pct >= 0.5) return "장기 추세는 살아 있는데(200일선 위 " + l + "%) <b>단기는 눌렸습니다</b> — 20일선 위 " + s + "%";
    if (p >= 0.5 && t.above200Pct < 0.4) return "단기 반등은 넓지만(20일선 위 " + s + "%) <b>장기 추세는 아직 아래</b> — 200일선 위 " + l + "%";
  }
  return "20일선 위 종목은 <b>" + s + "%</b>로 " + (p >= 0.5 ? "절반을 넘습니다" : "절반에 못 미칩니다");
}
function briefRenderHealth(R) {
  var t = R.temp, box = $("briefHealth"), hl = $("briefHiLo"); if (!box || !t) return;
  var h = '<div class="fdHead"><span class="fdNo">02 · 시장 체력</span><span class="fdDate">' + briefDateLine(R) + '</span></div>' +
    '<div class="fdTitle">' + briefHealthFinding(t) + '</div>' +
    '<div class="fdDef">여기서 \'추세 위\'는 주가가 20일·50일·200일 이동평균선 위에 있다는 뜻이에요. 비율이 높을수록 많은 종목이 같이 오르고 있다는 뜻이고, 지수만 오르고 비율이 낮으면 몇 개 큰 종목의 날이에요.</div>' +
    briefBarHtml("20일선 위", "단기 추세", t.abovePct, 50, "절반 50%") +
    (t.n50 ? briefBarHtml("50일선 위", "중기 추세", t.above50Pct, 50, "절반 50%") : "") +
    (t.n200 ? briefBarHtml("200일선 위", "장기 추세", t.above200Pct, 50, "절반 50%") : '<div class="briefDim" style="font-size:12px">200일선은 1년치 데이터가 쌓인 뒤(수집 후 다음 날) 표시돼요.</div>') +
    '<div class="fdHow"><b>읽는 법</b> — 20·50·200일 평균 가격보다 위에 있는 종목의 비율이에요(' + t.total + '개 집계). 50% 선은 종목의 절반을 나타내는 비교선이며 매수·매도 기준이 아니에요. 막대는 시장 참여 정도일 뿐 신호가 아니에요.</div>';
  box.innerHTML = h;
  if (!hl) return;
  if (!t.n200) { hl.innerHTML = '<div class="fdHead"><span class="fdNo">06 · 신고가·신저가</span><span class="fdDate">' + briefDateLine(R) + '</span></div><div class="briefDim" style="font-size:12px">52주 신고가·신저가는 1년치 데이터가 쌓인 뒤 표시돼요.</div>'; return; }
  var nh = t.newHigh.length, nl = t.newLow.length;
  var find = nh === 0 && nl === 0 ? "오늘 52주 신고가·신저가 종목이 <b>없습니다</b>" : nh >= nl ? "신고가 종목이 신저가 종목보다 <b>" + (nl ? (nh / nl).toFixed(1) + "배 많아요" : nh + "개 많아요") + "</b>" : "신저가 종목이 신고가 종목보다 <b>" + (nh ? (nl / nh).toFixed(1) + "배 많아요" : nl + "개 많아요") + "</b>";
  var tot = Math.max(1, nh + nl), p = nh + nl ? Math.round(nh / tot * 100) : 50;
  function col(list, near, hi) { return list.slice(0, 5).map(function (s) { var ref = hi ? s.hi250 : s.lo250, d = ref ? s.last / ref - 1 : null; return '<div class="hlRow"><b>' + escapeHtml(briefName(s)) + '</b><span>' + briefPriceTxt(s.sym, s.last) + (near && d != null ? ' · 1년 ' + (hi ? '최고' : '최저') + '比 ' + briefPct(d) : '') + ' · 오늘 ' + briefPct(s.ret1) + ' · ' + briefAmtTxt(s) + '</span></div>'; }).join("") || '<div class="briefDim" style="font-size:12px">해당 없음</div>'; }
  var hiList = nh ? t.newHigh : t.nearHigh, loList = nl ? t.newLow : t.nearLow;
  hl.innerHTML = '<div class="fdHead"><span class="fdNo">06 · 신고가·신저가</span><span class="fdDate">' + briefDateLine(R) + '</span></div>' +
    '<div class="fdTitle">' + find + '</div>' +
    '<div class="fdDef">52주 종가 기준 · 오늘 종가가 지난 1년 종가 중 최고/최저인 종목을 세요.</div>' +
    '<div class="hlScale"><div class="hn up">' + nh + '<small>▲ 신고가</small></div><div class="hlBar" style="--p:' + p + '%"></div><div class="hn down" style="text-align:right">' + nl + '<small>▼ 신저가</small></div></div>' +
    '<div class="hlNear">근접(3% 이내) — 신고가 ' + t.nearHigh.length + '개 · 신저가 ' + t.nearLow.length + '개' + (!nh && t.nearHigh.length ? ' · 왼쪽 목록은 신고가 <b>근접</b> 종목' : '') + (!nl && t.nearLow.length ? ' · 오른쪽 목록은 신저가 <b>근접</b> 종목' : '') + '</div>' +
    '<div class="hlCols"><div class="hlCol up"><h5>▲ ' + (nh ? '신고가' : '신고가 근접') + ' · 거래대금 순</h5>' + col(hiList, !nh, true) + '</div>' +
    '<div class="hlCol down"><h5>▼ ' + (nl ? '신저가' : '신저가 근접') + ' · 거래대금 순</h5>' + col(loList, !nl, false) + '</div></div>' +
    '<div class="fdHow"><b>읽는 법</b> — 신고가가 많다고 "비싸다"가 아니고, 신저가가 많다고 "싸다"가 아니에요. 어느 쪽이 넓게 늘어나는지를 봐요.</div>';
}
function briefPriceTxt(sym, v) { return typeof cPrice === "function" ? cPrice(sym, v) : String(v); }
function briefAmtTxt(s) { var a = s.amt || 0; if (!a) return "-"; if (/\.K[SQ]$/.test(s.sym)) return a >= 1e12 ? (a / 1e12).toFixed(2) + "조" : (a / 1e8).toFixed(0) + "억"; return a >= 1e9 ? "$" + (a / 1e9).toFixed(2) + "B" : "$" + (a / 1e6).toFixed(0) + "M"; }

function renderBrief() {
  var R = briefState.result, box = $("briefBody");
  if (!R || !box) return;
  if (typeof issuesForBrief === "function") try { issuesForBrief(); } catch (e) { console.warn(e); }
  if (typeof pubBriefLine === "function") try { pubBriefLine(); } catch (e) { console.warn(e); }
  var L = R.label;
  var qn = R.quality ? R.quality.stale.length + R.quality.spike.length : 0;
  $("briefAsOf").textContent = "종가 기준 — " + (R.market === "kr" ? "한국 " + briefFmtDate(R.asOfKr) : R.market === "us" ? "미국 " + briefFmtDate(R.asOfUs) : R.market === "coin" ? "코인은 24시간 거래 · 매일 오전 9시(한국) 기준" : "한국 " + briefFmtDate(R.asOfKr) + " · 미국 " + briefFmtDate(R.asOfUs)) +
    " · " + (R.market !== "all" ? R.mktName + " " : "") + R.count + "개 자산" + (qn ? " (데이터 확인 필요 " + qn + "개 제외)" : "");
  var ML = R.market !== "all" ? R.mktName + " " : "";

  /* ① 한눈에 — KPI 띠 + 온도 한 줄 + 지표 칩 (v9.1) */
  var t = R.temp;
  if ($("briefKpi")) {
    var vixN = (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0], nh = (t.newHigh || []).length, nl = (t.newLow || []).length;
    var idx0 = R.indexRow[0];
    $("briefKpi").innerHTML = [
      { l: "오른 종목", v: Math.round(t.upPct * 100) + "%", s: t.up + "/" + t.total, p: t.upPct, cls: t.upPct >= 0.5 ? "up" : "down" },
      { l: "20일선 위", v: Math.round(t.abovePct * 100) + "%", s: "추세", p: t.abovePct, cls: t.abovePct >= 0.5 ? "up" : "down" },
      { l: "신고가 : 신저가", v: t.n200 ? nh + " : " + nl : "–", s: t.n200 ? "52주" : "1년치 후", p: t.n200 ? nh / Math.max(1, nh + nl) : 0, cls: nh > nl ? "up" : nl > nh ? "down" : "" },
      { l: vixN ? "공포지수" : (idx0 ? idx0.name : "지수"), v: vixN ? vixN.v : (idx0 ? briefPct(idx0.ret) : "–"), s: vixN ? (parseFloat(vixN.v) >= 25 ? "공포" : parseFloat(vixN.v) >= 20 ? "불안" : "평온") : "", p: vixN ? Math.min(1, parseFloat(vixN.v) / 40) : 0.5, cls: vixN ? (parseFloat(vixN.v) >= 25 ? "down" : "") : (idx0 && idx0.ret < 0 ? "down" : "up") }
    ].map(function (k) { return '<div class="kpi ' + k.cls + '"><div class="kl">' + k.l + '</div><div class="kv">' + k.v + '<small>' + k.s + '</small></div><div class="kb"><i style="width:' + Math.round(k.p * 100) + '%"></i></div></div>'; }).join("");
  }
  if ($("briefTempBox")) $("briefTempBox").innerHTML = '<div class="briefTemp">' +
    '<div class="briefTempMain"><div class="briefTempWord">' + L + ' ' + ML + '시장은 <b>' + t.word + '</b></div>' +
    '<div class="briefTempBar"><div style="width:' + Math.round(t.upPct * 100) + '%"></div></div>' +
    '<div class="briefTempDesc">' + t.desc + '</div></div>' +
    '<div class="briefIdxRow">' + R.indexRow.map(function (x) {
      return '<div class="briefIdx"><span>' + x.name + '</span><b style="color:' + briefColor(x.ret) + '">' + briefPct(x.ret) + '</b></div>';
    }).join("") + '</div></div>';

  /* ①-2 시장 체력 · 신고가·신저가 (v8.9 — 한눈에 보는 판) */
  try { briefRenderHealth(R); } catch (e) { console.warn(e); }

  /* ② 테마 — 상위·하위 위주, 나머지는 더보기 */
  var maxAbs = Math.max(0.005, Math.max.apply(null, R.themes.map(function (x) { return Math.abs(x.ret); })));
  var themeRows = R.themes.map(function (th, i) {
    var w = Math.round(Math.abs(th.ret) / maxAbs * 100);
    return '<div class="briefTheme">' +
      '<div class="briefThemeName">' + (i === 0 ? "🔥 " : i === R.themes.length - 1 ? "🧊 " : "") + th.name + ' <small>' + th.up + '/' + th.n + '</small></div>' +
      '<div class="briefThemeBar"><div class="' + (th.ret >= 0 ? "up" : "down") + '" style="width:' + w + '%"></div></div>' +
      '<div class="briefThemeRet" style="color:' + briefColor(th.ret) + '">' + briefPct(th.ret) + '</div>' +
      '<div class="briefThemeBest">' + briefSymLink(th.best) + ' <span style="color:' + briefColor(th.best.ret) + '">' + briefPct(th.best.ret) + '</span></div>' +
      '</div>';
  });
  $("briefThemes").innerHTML = briefCollapsible("themes", themeRows, 6, "개 업종");

  /* ③ 급등·급락 — 종목당 한 줄 + 기사 1줄 */
  function moverRows(list, kind) {
    return briefCollapsible("mv-" + kind, list.map(function (s, i) {
      var meta = [];
      if (s.vsHi != null) meta.push("52주 고점比 " + briefPct(s.vsHi, 0));
      if (s.amtX != null && s.amtX >= 1.5) meta.push("거래대금 " + s.amtX.toFixed(1) + "배");
      return '<div class="briefMover" data-sym="' + s.sym + '">' +
        '<div class="briefMoverHead">' + briefSymLink(s) + '<b style="color:' + briefColor(s.ret) + '">' + briefPct(s.ret) + '</b></div>' +
        (meta.length ? '<div class="briefMoverMeta">' + meta.join(" · ") + '</div>' : '') +
        '<div class="briefMoverNews" data-news="' + s.sym + '">' + (i < 3 ? '<span class="briefDim">기사 찾는 중…</span>' : '') + '</div>' +
        '</div>';
    }), BRIEF_SHOW.movers, "개");
  }
  $("briefUp").innerHTML = moverRows(R.movers.up, "up");
  $("briefDown").innerHTML = moverRows(R.movers.down, "down");

  /* ④ 돈이 몰린 곳 — 인기 / 한국 / 미국 / 코인 / 급증을 탭 하나로 */
  var mt = briefState.moneyTab || "pop";
  if (R.market !== "all" && ["kr", "us", "coin"].indexOf(mt) >= 0 && mt !== R.market) mt = "pop";
  Array.prototype.forEach.call(document.querySelectorAll("#briefMoneyTabs [data-mt]"), function (b) {
    var k = b.getAttribute("data-mt");
    b.style.display = (R.market === "all" || ["pop", "hot"].indexOf(k) >= 0 || k === R.market) ? "" : "none";
    b.classList.toggle("active", k === mt);
    b.onclick = function () { briefState.moneyTab = k; renderBrief(); };
  });
  function rowHead(mid) { return '<div class="briefRowHead"><span></span><span>종목</span><span>' + mid + '</span><span>등락</span></div>'; }
  function row(s, i, mid) {
    return '<div class="briefRow"><span class="rk">' + (i + 1) + '</span><span class="nm">' + briefSymLink(s) + '</span><span class="mt">' + mid + '</span>' +
      '<span class="rt" style="color:' + briefColor(s.ret) + '">' + briefPct(s.ret) + '</span></div>';
  }
  function heat(s) { return s.amtX == null ? "" : '<span class="' + (s.amtX >= 1.5 ? "heat" : "") + '">' + (s.amtX >= 1.5 ? "🔥" : "") + s.amtX.toFixed(1) + '배</span>'; }
  var moneyHtml = "", note = "";
  if (mt === "pop") {
    var pop = R.popular.filter(function (s) { return !/^\^|=X$/.test(s.sym); });
    moneyHtml = rowHead("52주 고점比 · 평소比") + briefCollapsible("pop", pop.map(function (s, i) {
      return row(s, i, (s.vsHi != null ? '<b>' + briefPct(s.vsHi, 0) + '</b>' : '') + (s.amtX != null && !/^\^|=X$|=F$/.test(s.sym) ? ' · ' + heat(s) : ''));
    }), 8, "개");
    note = R.popSrc === "ranked" ? "이 앱에서 최근 2주간 많이 조회·관심 담은 순서 (지난 주는 절반 가중치)" : "오늘 거래대금이 가장 큰 종목들 (한국 5 · 미국 5 · 코인 2 · 급증 2) — 조회 기록이 쌓이면 '많이 본 순서'로 바뀌어요";
  } else if (mt === "hot") {
    moneyHtml = R.hotVol.length ? rowHead("평소比 · 거래대금") + briefCollapsible("hv", R.hotVol.map(function (s, i) { return row(s, i, heat(s) + ' · <b>' + briefFmtAmt(R.amtKrw(s)) + '</b>'); }), BRIEF_SHOW.hotVol, "개")
      : '<div class="briefDim">' + L + '은 평소보다 유난히 많이 거래된 종목이 없어요.</div>';
    note = "거래대금이 최근 20일 평균의 1.8배 이상인 종목";
  } else {
    var list = R.turnover[mt] || [];
    moneyHtml = list.length ? rowHead("거래대금 · 평소比") + briefCollapsible("to-" + mt, list.map(function (s, i) { return row(s, i, '<b>' + briefFmtAmt(R.amtKrw(s)) + '</b> · ' + heat(s)); }), BRIEF_SHOW.turnover, "개") : '<div class="briefDim">데이터 없음</div>';
    note = "거래대금 = 종가 × 거래량 (코인은 24시간 거래액), 달러는 " + Math.round(R.fx).toLocaleString() + "원으로 환산";
  }
  $("briefMoney").innerHTML = moneyHtml;
  $("briefToNote").textContent = note;

  /* ⑤ 참고 종목 — 6칸을 탭으로 (한 번에 한 칸) */
  var pk = briefState.pickTab || R.picks[0].id;
  if (!R.picks.some(function (p) { return p.id === pk; })) pk = R.picks[0].id;
  $("briefPickTabs").innerHTML = R.picks.map(function (p) {
    return '<button data-pk="' + p.id + '"' + (p.id === pk ? ' class="active"' : '') + '>' + p.icon + ' ' + p.title + ' <small>' + p.items.length + '</small></button>';
  }).join("");
  Array.prototype.forEach.call($("briefPickTabs").querySelectorAll("[data-pk]"), function (b) { b.onclick = function () { briefState.pickTab = b.getAttribute("data-pk"); renderBrief(); }; });
  var P = R.picks.filter(function (p) { return p.id === pk; })[0];
  $("briefPicks").innerHTML = '<div class="briefPickIntro">' + P.sub + '</div>' +
    (P.items.length ? briefCollapsible("pk-" + P.id, P.items.map(function (it) {
      return '<div class="briefPickItem"><div class="briefPickName">' + briefSymLink(it.s) +
        '<span style="color:' + briefColor(it.s.ret) + '">' + briefPct(it.s.ret) + '</span>' +
        '<button class="chip briefWatch" data-sym="' + it.s.sym + '" data-name="' + escapeHtml(it.s.name) + '">☆ 관심</button></div>' +
        '<div class="briefPickWhy">' + escapeHtml(it.why) + '</div></div>';
    }), 5, "개") : '<div class="briefDim" style="padding:8px 0">' + L + '은 조건에 맞는 종목이 없어요.</div>');

  /* ⑥ 숫자 + 역사 속 이맘때(한 줄) */
  $("briefNumbers").innerHTML = R.numbers.map(function (n, i) {
    var hint = n.list ? "종목 보기 ›" : n.sym ? "차트 보기 ›" : "";
    return '<div class="briefNum' + (hint ? " briefNumBtn" : "") + '" data-num="' + i + '"><b>' + n.v + '</b><span>' + escapeHtml(n.l) + '</span><small>' + escapeHtml(n.n) + '</small>' +
      (hint ? '<em>' + hint + '</em>' : '') + '</div>';
  }).join("");
  Array.prototype.forEach.call($("briefNumbers").querySelectorAll(".briefNumBtn"), function (el) {
    el.onclick = function () {
      var n = R.numbers[+el.getAttribute("data-num")];
      if (n.sym) { $("searchInput").value = n.sym; navTo("single", "chart"); if (typeof load === "function") load(); return; }
      openBriefList(n, R);
    };
  });
  var hist = R.history;
  $("briefHistory").innerHTML = hist.length ? '<span class="briefDim">📅 이맘때 있었던 일 —</span>' + hist.map(function (e) {
    var col = (typeof EVENT_TYPES !== "undefined" && EVENT_TYPES[e.type]) || "#8b95a1";
    return '<span class="briefHist"><span class="evtTag" style="color:' + col + ';border-color:' + col + '">' + e.type + '</span><b>' + escapeHtml(e.name) + '</b><span class="briefDim">' + e.years + '년 전</span></span>';
  }).join("") : '';

  Array.prototype.forEach.call(box.querySelectorAll(".briefMore"), function (b) {
    b.onclick = function () {
      var k = b.getAttribute("data-more");
      briefState.open[k] = !briefState.open[k];
      var y = b.getBoundingClientRect().top + window.scrollY;
      renderBrief();
      if (!briefState.open[k]) window.scrollTo({ top: Math.max(0, y - 300) });
    };
  });

  /* 클릭 연결 */
  Array.prototype.forEach.call(box.querySelectorAll(".briefSym"), function (b) {
    b.onclick = function () {
      $("searchInput").value = b.getAttribute("data-sym");
      if (typeof navTo === "function") navTo("single", "chart"); else switchTab("single", "chart");
      if (typeof load === "function") load();
    };
  });
  Array.prototype.forEach.call(box.querySelectorAll(".briefWatch"), function (b) {
    b.onclick = function () {
      if (typeof toggleWatch === "function") { toggleWatch(b.getAttribute("data-sym"), b.getAttribute("data-name")); b.textContent = "★ 담김"; b.disabled = true; }
    };
  });
  loadBriefNews(R);
}

/* 급등락 종목 기사(종목당 1줄) + 시장 키워드 칩 (모두 서버 캐시 10분) */
function loadBriefNews(R) {
  if (typeof fetchNews !== "function") return;
  var movers = R.movers.up.slice(0, 3).concat(R.movers.down.slice(0, 3)), seen = {};
  movers.forEach(function (s) {
    fetchNews({ type: "stock", q: briefName(s), size: 3 }).then(function (items) {
      var el = document.querySelector('#briefBody [data-news="' + s.sym + '"]');
      if (!el) return;
      var it = items.filter(function (x) { return !seen[x.title]; })[0];   // 다른 종목에 이미 쓴 기사는 건너뛴다
      if (!it) { el.innerHTML = '<span class="briefDim">관련 기사 없음 — 시장 전체 흐름일 가능성</span>'; return; }
      seen[it.title] = 1;
      el.innerHTML = '<a class="briefNewsLink" href="' + it.url + '" target="_blank" rel="noopener">📰 ' + escapeHtml(it.title) + '</a>';
    });
  });
  var cats = typeof MARKET_CATS !== "undefined" ? MARKET_CATS : [];
  Promise.all(cats.map(function (c) { return fetchNews(c.p); })).then(function (lists) {
    var all = [], seen2 = {};
    lists.forEach(function (l) { l.forEach(function (it) { if (!seen2[it.title]) { seen2[it.title] = 1; all.push(it); } }); });
    var kw = briefKeywords(all).filter(function (k) { return k.n >= 2; });
    var el = $("briefKeywords");
    if (!el) return;
    if (!kw.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<span>뉴스 키워드</span>' + kw.slice(0, 6).map(function (k, i) {
      return '<a class="briefKwChip' + (i === 0 ? " hot" : "") + '" href="' + k.items[0].url + '" target="_blank" rel="noopener" title="' + escapeHtml(k.items[0].title) + '">' + (i === 0 ? "🔥 " : "") + k.tag + ' <b>' + k.n + '</b></a>';
    }).join("") + '<span class="briefDim">기사 ' + all.length + '건 제목 기준 · 누르면 대표 기사</span>';
  });
}

function loadBrief(force) {
  var st = $("briefStatus");
  if (briefState.result && !force) { renderBrief(); return; }
  st.textContent = "전 종목 데이터 정리 중… (한 번만 받아요)";
  $("briefBody").classList.add("hidden");
  var popP = fetch("/api/snap?popular=1").then(function (r) { return r.json(); }).then(function (j) { return (j && j.items) || []; }).catch(function () { return []; });
  Promise.all([dataReady().then(function () { return briefState.recent || fetchRecent(); }), popP]).then(function (arr) {
    var recent = arr[0];
    briefState.popular = arr[1];
    if (!recent || !recent.symbols) {
      st.innerHTML = "아직 정리할 데이터가 없어요. 매일 아침 자동 수집이 끝나면 여기에 브리핑이 나와요.";
      return;
    }
    briefState.recent = recent;
    briefState.result = briefCompute(recent, { mode: briefState.mode, market: briefState.market, popular: briefState.popular });
    st.textContent = "";
    $("briefBody").classList.remove("hidden");
    renderBrief();
  }).catch(function (e) {
    st.textContent = "데이터를 불러오지 못했어요. 잠시 후 새로고침해 주세요.";
  });
}

function switchBriefMode(mode, fromHistory) {
  if (!fromHistory && mode !== briefState.mode && typeof pushPaneState === "function") pushPaneState({ bm: mode });
  briefState.mode = mode;
  Array.prototype.forEach.call(document.querySelectorAll("#briefModeTabs [data-bm]"), function (b) {
    b.classList.toggle("active", b.getAttribute("data-bm") === mode);
  });
  if (briefState.recent) { briefState.result = briefCompute(briefState.recent, { mode: mode, market: briefState.market, popular: briefState.popular }); renderBrief(); }
  else loadBrief(true);
}
/* 시장 선택: 전체 / 국내 / 미국 / 코인 — 화면과 카드에 함께 적용, 다음 접속 때도 기억 */
function switchBriefMarket(m, fromHistory) {
  if (!BRIEF_MKT[m]) m = "all";
  if (!fromHistory && m !== briefState.market && typeof pushPaneState === "function") pushPaneState({ bk: m });
  briefState.market = m;
  try { localStorage.setItem("sm.briefMkt", m); } catch (e) {}
  Array.prototype.forEach.call(document.querySelectorAll("#briefMktTabs [data-bk]"), function (b) { b.classList.toggle("active", b.getAttribute("data-bk") === m); });
  if (briefState.recent) { briefState.result = briefCompute(briefState.recent, { mode: briefState.mode, market: m, popular: briefState.popular }); renderBrief(); }
}
Array.prototype.forEach.call(document.querySelectorAll("#briefMktTabs [data-bk]"), function (b) {
  b.classList.toggle("active", b.getAttribute("data-bk") === briefState.market);
  b.onclick = function () { switchBriefMarket(b.getAttribute("data-bk")); };
});
Array.prototype.forEach.call(document.querySelectorAll("#briefModeTabs [data-bm]"), function (b) {
  b.onclick = function () { switchBriefMode(b.getAttribute("data-bm")); };
});
