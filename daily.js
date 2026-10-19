/* ============================================================================================
   StockMind v12.8 — 오늘 시장 데일리 9장 (dl*)
   참고한 형식: 카드마다 ① 결론 문장(큰 제목) ② 한 줄 설명 ③ 큰 숫자·막대 ④ 읽는 법 ⑤ 표본 수·방법·출처·'신호 아님' 각주.
   시인성 원칙: 숫자는 크게, 음수는 빗금, 50% 같은 비교선은 점선, 상위·하위 3개는 굵게. 앱이 원인을 추론하지 않는다(해설 장은 기사 제목 그대로).
   데이터: briefState.result(오늘 전 종목 집계) + nbHist(지수·ETF 긴 역사) · 과금 없음.
   ============================================================================================ */
var DL = { W: 1080, H: 1350, P: 64 };
var DL_C = { paper: "#fbf8f1", ink: "#14161c", sub: "#6b7280", line: "#e4dfd3", tile: "#eeeae1", lime: "#e6c57a", gold: "#c9a24f", green: "#d9342b", red: "#2f6fd6", amber: "#b8771a", navy: "#1f2a44", blue: "#5b9bb5", white: "#ffffff", dark: "#14161c" };
/* 우상향연구소 양식: 위 검정 띠(로고 · 금색 라벨) · 종이 본문 · 아래 검정 바닥(@uphill.lab). 색: 빨강 = 상승 · 파랑 = 하락 (앱과 같은 한국식) · 금색 = 강조 */
function dlPct(x, d) { return x == null || !isFinite(x) ? "-" : (x >= 0 ? "▲" : "▼") + Math.abs(x * 100).toFixed(d == null ? 2 : d) + "%"; }
function dlCol(x) { return x > 0 ? DL_C.green : x < 0 ? DL_C.red : DL_C.sub; }
function dlD(ms) { if (!ms) return "-"; var d = new Date(ms + 9 * 3600e3); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
function dlHatch(g, color) {   // 빗금 패턴 (음수)
  var p = document.createElement("canvas"); p.width = p.height = 14; var q = p.getContext("2d"); q.fillStyle = color; q.fillRect(0, 0, 14, 14); q.strokeStyle = "rgba(255,255,255,0.35)"; q.lineWidth = 4; q.beginPath(); q.moveTo(-4, 14); q.lineTo(14, -4); q.moveTo(0, 28); q.lineTo(28, 0); q.stroke();
  return g.createPattern(p, "repeat");
}
function dlNew(no, title, R) {
  var cv = document.createElement("canvas"); cv.width = DL.W; cv.height = DL.H; var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = DL_C.paper; g.fillRect(0, 0, DL.W, DL.H);
  // 위 검정 띠: 로고 + 금색 라벨 (연구노트와 같은 머리)
  g.fillStyle = DL_C.ink; g.fillRect(0, 0, DL.W, 72); g.fillStyle = DL_C.lime; g.fillRect(0, 72, DL.W, 3);
  if (typeof cLogo === "function") cLogo(g, DL.P, 0);
  var tag = "🗞️ 오늘 시장 데일리", tw = cW(g, tag, 20, 800) + 32; cRound(g, DL.W - DL.P - tw, 17, tw, 38, 19, null); g.strokeStyle = DL_C.lime; g.lineWidth = 2; g.stroke(); cText(g, tag, DL.W - DL.P - tw / 2, 43, 20, 800, DL_C.lime, "center");
  // 장 번호 · 제목 (금색) + 날짜
  cText(g, "관찰 " + String(no).padStart(2, "0") + " · " + title, DL.P, 122, 24, 900, DL_C.gold);
  var mk = R && R.market, U = dlUni(R), asOf = U && U.asOf ? U.asOf : mk === "kr" ? R.asOfKr : mk === "us" ? R.asOfUs : (R && (R.asOfUs || R.asOfKr)), lab = mk === "kr" ? "한국 거래일" : mk === "us" ? "미국 거래일" : "기준일";
  cText(g, lab + " " + dlD(asOf) + " · 발행 " + dlD(Date.now()), DL.W - DL.P, 122, 20, 600, DL_C.sub, "right");
  return { cv: cv, g: g, y: 150 };
}
function dlHead(c, big, sub) {
  var g = c.g, W = DL.W - DL.P * 2, fs = 58; while (fs > 40 && cWrapCount(g, big, W, fs, 900) > 2) fs -= 2;
  var n = cWrapCount(g, big, W, fs, 900); cWrap(g, big, DL.P, c.y + fs, W, fs, 900, DL_C.ink, fs * 1.22, 2); c.y += n * fs * 1.22 + 10;
  if (typeof cUphill === "function") cUphill(g, DL.P, c.y + 26, W); c.y += 26;
  if (sub) { var m = cWrapCount(g, sub, W, 28, 500); cWrap(g, sub, DL.P, c.y + 30, W, 28, 500, "#3b4256", 40, 2); c.y += Math.min(2, m) * 40 + 24; }
  c.y += 10;
}
function dlFoot(c, method, src) {
  var g = c.g, W = DL.W - DL.P * 2, F = 64, y0 = DL.H - F, y = y0 - 112;
  g.strokeStyle = DL_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(DL.P, y); g.lineTo(DL.P + W, y); g.stroke();
  cWrap(g, method, DL.P, y + 28, W, 18, 500, DL_C.sub, 26, 3);
  g.fillStyle = DL_C.ink; g.fillRect(0, y0, DL.W, F); g.fillStyle = DL_C.lime; g.fillRect(0, y0, DL.W, 3);
  var bw = cW(g, "@uphill.lab", 22, 900);
  cText(g, cFit(g, src + " · 투자 권유 아님", DL.W - DL.P * 2 - bw - 70, 16, 600), DL.P, y0 + 27, 16, 600, "#a9a291");
  cText(g, "다음 장 →", DL.P, y0 + 52, 17, 800, DL_C.lime);
  if (typeof cMark === "function") cMark(g, DL.W - DL.P, y0 + F / 2 + 9);
}
function dlNote(c, text) {   // '읽는 법' 상자
  var g = c.g, W = DL.W - DL.P * 2, fs = 26, n = cWrapCount(g, text, W - 56, fs, 500), h = n * 38 + 44;
  cRound(g, DL.P, c.y, W, h, 12, DL_C.tile); g.fillStyle = DL_C.gold; g.fillRect(DL.P, c.y + 6, 8, h - 12); cWrap(g, text, DL.P + 32, c.y + 22 + fs, W - 60, fs, 500, "#3b4256", 38, 4); c.y += h + 16;
}
function dlBanner(c, lines) {   // 짙은 결론 띠
  var g = c.g, W = DL.W - DL.P * 2, h = 56 + lines.length * 44; cRound(g, DL.P, c.y, W, h, 14, DL_C.dark);
  lines.forEach(function (l, i) { cRich(g, l, DL.P + 28, c.y + 54 + i * 44, 30, 800, DL_C.white, DL_C.lime); }); c.y += h + 18;
}

/* ---------- 데이터 ---------- */
/* v12.9 전체 시장 유니버스(S&P 500 · 코스피 200) — 크론이 만든 요약(/api/snap?universe=us|kr). 없으면 앱 관심 종목으로 */
var DL_UNI = {};
function dlUniLoad(mkt) {
  if (mkt !== "us" && mkt !== "kr") return Promise.resolve(null);
  var c = DL_UNI[mkt]; if (c && c.at && Date.now() - c.at < 30 * 60e3) return Promise.resolve(c.doc);
  return fetch("/api/snap?universe=" + mkt).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { var doc = d && d.rows && d.rows.length >= 50 ? d : null; DL_UNI[mkt] = { at: Date.now(), doc: doc }; return doc; }).catch(function () { DL_UNI[mkt] = { at: Date.now(), doc: null }; return null; });
}
function dlUni(R) { var c = DL_UNI[R && R.market]; return c && c.doc ? c.doc : null; }
function dlUniStocks(U) { return U.rows.filter(function (r) { return r && isFinite(r.r1) && r.c > 0; }).map(function (r) { return { sym: r.s, name: r.n || r.s, sec: r.sec || "", last: r.c, ret1: r.r1, ret: r.r1, m1: r.m1, above20: r.a20, above50: r.a50, above200: r.a200, newHigh: !!r.nh, newLow: !!r.nl, vsHi: r.vh, vsLo: r.vl, hi250: r.hi, lo250: r.lo, longEnough: r.hi != null, amt: r.amt, amtX: r.ax, stale: !!r.stale, uni: true }; }); }
function dlUniName(U) { return U.mkt === "us" ? "S&P 500 구성 " + U.n + "종목" : "코스피 시가총액 상위 " + U.n + "종목"; }
function dlUniNote(R) { var U = dlUni(R); if (!U) return "앱 관심 종목 집계(전체 시장이 아님)"; var st = U.rows.filter(function (r) { return r.stale; }).length; return dlUniName(U) + " 집계(" + (U.mkt === "us" ? "위키피디아 구성표" : "네이버 시가총액 순") + ")" + (st ? " · " + st + "종목은 전일 값" : "") + " · 현재 구성 종목의 과거 단면(생존 편향 가능)"; }
function dlStocks(R) { var U = dlUni(R); if (U) return dlUniStocks(U); return (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$|-USD$/.test(s.sym) && isFinite(s.ret1); }); }
/* 거래대금은 통화가 같은 묶음 안에서만 비교한다 (국내 원 · 해외 달러) */
function dlAmtGroup(R) { var S = dlStocks(R).filter(function (s) { return s.amt > 0; }), kr = S.filter(function (s) { return /\.K[SQ]$/.test(s.sym); }), us = S.filter(function (s) { return !/\.K[SQ]$/.test(s.sym); }); var useKr = R.market === "kr" || (R.market !== "us" && kr.length >= us.length); if (dlUni(R)) { useKr = dlUni(R).mkt === "kr"; } return { list: useKr ? kr : us, kr: useKr, label: useKr ? "국내 " : "해외 " }; }
function dlAmtT(v, kr) { return kr ? Math.round(v / 1e8).toLocaleString("ko-KR") + "억원" : "$" + (v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : (v / 1e6).toFixed(1) + "M"); }
function dlThemes(R) {
  var U = dlUni(R);
  if (U && U.mkt === "us") { var by = {}; dlUniStocks(U).forEach(function (s) { if (!s.sec) return; var o = by[s.sec] = by[s.sec] || { name: dlSecKo(s.sec), ret: 0, n: 0, up: 0 }; o.ret += s.ret1; o.n++; if (s.ret1 > 0) o.up++; }); return Object.keys(by).map(function (k) { var o = by[k]; o.ret /= o.n; return o; }).filter(function (o) { return o.n >= 2; }).sort(function (a, b) { return b.ret - a.ret; }); }
  if (U && U.mkt === "kr") { var map = {}; (typeof BRIEF_THEMES !== "undefined" ? BRIEF_THEMES : []).forEach(function (t) { t[1].forEach(function (sym) { map[sym] = map[sym] || t[0]; }); }); var by2 = {}; dlUniStocks(U).forEach(function (s) { var k = map[s.sym]; if (!k) return; var o = by2[k] = by2[k] || { name: k, ret: 0, n: 0, up: 0 }; o.ret += s.ret1; o.n++; if (s.ret1 > 0) o.up++; }); var L = Object.keys(by2).map(function (k) { var o = by2[k]; o.ret /= o.n; return o; }).filter(function (o) { return o.n >= 2; }).sort(function (a, b) { return b.ret - a.ret; }); if (L.length >= 4) return L; }
  return (R.themes || []).filter(function (t) { return t && isFinite(t.ret) && t.n >= 2; });
}
var DL_SEC = { "Information Technology": "정보기술", "Health Care": "헬스케어", "Financials": "금융", "Consumer Discretionary": "경기소비재", "Communication Services": "커뮤니케이션", "Industrials": "산업재", "Consumer Staples": "필수소비재", "Energy": "에너지", "Utilities": "유틸리티", "Real Estate": "부동산", "Materials": "소재" };
function dlSecKo(s) { return DL_SEC[s] || s; }
function dlIdx(R) {
  var want = R.market === "us" ? [["^DJI", "다우"], ["^GSPC", "S&P 500"], ["^IXIC", "나스닥"]] : R.market === "kr" ? [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["KRW=X", "달러/원"]] : R.market === "coin" ? [["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"], ["SOL-USD", "솔라나"]] : [["^KS11", "코스피"], ["^GSPC", "S&P 500"], ["^IXIC", "나스닥"]];
  var by = {}; (R.stocks || []).forEach(function (s) { by[s.sym] = s; }); (R.indexRow || []).forEach(function (x) { by[x.sym] = by[x.sym] || x; });
  return want.map(function (w) { var s = by[w[0]]; return s ? { sym: w[0], name: w[1], ret: s.ret1 != null ? s.ret1 : s.ret, last: s.last } : null; }).filter(Boolean);
}
function dlRets(sym, n) { var r = typeof nbRecent === "function" ? nbRecent() : null, d = r && r.symbols[sym]; if (!d || !d.c) return null; var c = d.c.filter(function (x) { return x > 0; }); if (c.length < n + 1) return null; var out = []; for (var i = c.length - n; i < c.length; i++) out.push(c[i] / c[i - 1] - 1); return out; }
function dlCorr(a, b) { if (!a || !b) return null; var n = Math.min(a.length, b.length); a = a.slice(-n); b = b.slice(-n); var ma = 0, mb = 0; for (var i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; var sab = 0, sa = 0, sb = 0; for (i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) * (a[i] - ma); sb += (b[i] - mb) * (b[i] - mb); } return sa && sb ? sab / Math.sqrt(sa * sb) : null; }
function dlRows(sym) { return typeof hubRows === "function" ? hubRows(sym) : []; }
function dlRetsHist(sym, n) { var r = dlRows(sym); if (r.length < n + 1) return null; var out = []; for (var i = r.length - n; i < r.length; i++) out.push(r[i].c / r[i - 1].c - 1); return out; }
function dlYearStats(sym) {   // 연초 대비 · 연도별 (연초 대비 최고/최저) 평균 — 수정주가(배당·분할 반영) 기준 · 상장 첫해 60거래일 미만 제외 · 올해 제외
  var r = dlRows(sym); if (r.length < 120) return null; var A = function (x) { return x.a > 0 ? x.a : x.c; }, by = {}; r.forEach(function (x) { var y = new Date(x.t + 9 * 3600e3).getUTCFullYear(); (by[y] = by[y] || []).push(x); });
  var ys = Object.keys(by).map(Number).sort(), cur = new Date(Date.now() + 9 * 3600e3).getUTCFullYear(), ups = [], dns = [];
  ys.forEach(function (y) { var L = by[y]; if (y >= cur || L.length < 60) return; var f = A(L[0]), hi = -Infinity, lo = Infinity; L.forEach(function (x) { hi = Math.max(hi, A(x)); lo = Math.min(lo, A(x)); }); ups.push(hi / f - 1); dns.push(lo / f - 1); });
  var C = by[cur], ytd = C && C.length ? A(C[C.length - 1]) / A(C[0]) - 1 : null, d1 = r.length > 1 ? A(r[r.length - 1]) / A(r[r.length - 2]) - 1 : null;
  return { ytd: ytd, up: ups.length ? rpAvg(ups) : null, dn: dns.length ? rpAvg(dns) : null, years: ups.length, d1: d1, lastT: r[r.length - 1].t };
}
/* 성적표 자산 목록 (시장별) — 긴 역사는 dlPrep 에서 미리 받는다 */
var DL_SCORE = {
  us: [["주식·지수", [["SPY", "S&P 500"], ["QQQ", "나스닥100"], ["NVDA", "엔비디아"], ["AAPL", "애플"], ["GOOGL", "구글"], ["MSFT", "마이크로소프트"], ["AMZN", "아마존"], ["META", "메타"], ["AVGO", "브로드컴"], ["PLTR", "팔란티어"], ["TSLA", "테슬라"], ["HOOD", "로빈후드"]]], ["채권·원자재", [["TLT", "미국 장기채"], ["IEF", "미국 중기채"], ["GLD", "금"], ["SLV", "은"], ["PDBC", "원자재"]]], ["코인", [["BTC-USD", "비트코인"]]]],
  kr: [["주식·지수", [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["005930.KS", "삼성전자"], ["000660.KS", "SK하이닉스"], ["373220.KS", "LG에너지솔루션"], ["005380.KS", "현대차"], ["000270.KS", "기아"], ["035420.KS", "NAVER"], ["068270.KS", "셀트리온"], ["105560.KS", "KB금융"], ["012450.KS", "한화에어로스페이스"]]], ["해외·채권·귀금속", [["SPY", "S&P 500"], ["TLT", "미국 장기채"], ["GLD", "금"], ["KRW=X", "달러/원"]]], ["코인", [["BTC-USD", "비트코인"]]]],
  coin: [["코인", [["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"], ["SOL-USD", "솔라나"], ["XRP-USD", "리플"]]], ["비교", [["SPY", "S&P 500"], ["QQQ", "나스닥100"], ["GLD", "금"]]]]
};
DL_SCORE.all = DL_SCORE.kr;
function dlScoreSyms(R) { var out = []; (DL_SCORE[R && R.market] || DL_SCORE.us).forEach(function (g) { g[1].forEach(function (w) { out.push(w[0]); }); }); return out; }

/* ============================================================ 카드 ============================================================ */
function dlCard1(R) {
  var S = dlStocks(R), idx = dlIdx(R), up = S.filter(function (s) { return s.ret1 > 0; }).length, dn = S.filter(function (s) { return s.ret1 < 0; }).length, n = up + dn, eq = S.length ? rpAvg(S.map(function (s) { return s.ret1; })) : null, T = dlThemes(R), tUp = T.filter(function (t) { return t.ret > 0; }).length;
  var main = idx[R.market === "us" ? 1 : 0] || idx[0], c = dlNew(1, "오늘 시장 한눈에", R), g = c.g, W = DL.W - DL.P * 2;
  var mixed = n && Math.abs(up / n - 0.5) < 0.1, big = main ? nbJosa(main.name, "은/는") + (main.ret >= 0 ? " 올랐고 " : " 내렸고 ") + (mixed ? "종목별 흐름은 엇갈렸습니다" : up > dn ? "오른 종목이 더 많았습니다" : "내린 종목이 더 많았습니다") : "오늘 시장 한눈에";
  dlHead(c, big, (main ? nbJosa(main.name, "이/가") + " " + Math.abs(main.ret * 100).toFixed(2) + "% " + (main.ret >= 0 ? "올랐고" : "내렸고") + " " : "") + "동일가중 수익률은 " + dlPct(eq) + ", " + T.length + "개 업종 중 " + (T.length - tUp) + "개가 하락했습니다");
  var tw = (W - 32) / 3; idx.forEach(function (x, i) { var X = DL.P + i * (tw + 16); cRound(g, X, c.y, tw, 180, 14, DL_C.tile); cText(g, x.name, X + 22, c.y + 46, 28, 800, DL_C.ink); cText(g, x.sym.replace(/^\^/, "") + (/^\^/.test(x.sym) ? " · 지수" : ""), X + 22, c.y + 78, 20, 600, DL_C.sub); var vs = 64; while (vs > 40 && cW(g, dlPct(x.ret), vs, 900) > tw - 40) vs -= 2; cText(g, dlPct(x.ret), X + 22, c.y + 150, vs, 900, dlCol(x.ret)); }); c.y += 212;
  cText(g, "▲ 상승 " + up + "종목", DL.P, c.y + 28, 28, 800, DL_C.ink); cText(g, "하락 " + dn + "종목 ▼", DL.P + W, c.y + 28, 28, 800, DL_C.ink, "right"); c.y += 48;
  var uw = n ? W * up / n : W / 2; cRound(g, DL.P, c.y, W, 130, 10, DL_C.red); g.save(); g.fillStyle = dlHatch(g, DL_C.red); cRound(g, DL.P, c.y, W, 130, 10, null); g.clip(); g.fillRect(DL.P, c.y, W, 130); g.restore(); g.fillStyle = DL_C.green; g.fillRect(DL.P, c.y, uw, 130);
  var upT = n ? (up / n * 100).toFixed(1) + "%" : "-", dnT = n ? (dn / n * 100).toFixed(1) + "%" : "-", bigUp = up >= dn; cText(g, upT, DL.P + uw / 2, c.y + 80, bigUp ? 64 : 48, 900, DL_C.white, "center"); cText(g, "상승", DL.P + uw / 2, c.y + 112, 22, 700, DL_C.white, "center"); cText(g, dnT, DL.P + uw + (W - uw) / 2, c.y + 80, bigUp ? 48 : 64, 900, DL_C.white, "center"); cText(g, "하락", DL.P + uw + (W - uw) / 2, c.y + 112, 22, 700, DL_C.white, "center"); c.y += 150;
  var hw = (W - 16) / 2; cRound(g, DL.P, c.y, hw, 96, 12, DL_C.white, DL_C.line); cText(g, "종목 평균 (동일가중)", DL.P + 22, c.y + 38, 22, 600, DL_C.sub); cText(g, dlPct(eq), DL.P + 22, c.y + 78, 32, 900, dlCol(eq)); cRound(g, DL.P + hw + 16, c.y, hw, 96, 12, DL_C.white, DL_C.line); cText(g, "업종 " + T.length + "개", DL.P + hw + 38, c.y + 38, 22, 600, DL_C.sub); cText(g, "상승 " + tUp + " · 하락 " + (T.length - tUp), DL.P + hw + 38, c.y + 78, 32, 900, DL_C.ink); c.y += 116;
  if (main) dlBanner(c, [main.name + " [[" + dlPct(main.ret) + "]] ↔ 종목 [[상승 " + up + " · 하락 " + dn + "]]", nbJosa(main.name, "이/가") + (main.ret >= 0 ? " 오르고 " : " 내리고 ") + (up > dn ? "오른 종목도 더 많았습니다" : dn > up ? "내린 종목도 더 많았습니다" : "종목은 반반이었습니다")]);
  dlFoot(c, "수익률 유효 " + S.length + "종목 · 보합 " + (S.length - n) + " · 지수 칸은 지수 또는 추종 ETF 1일 수익률 · " + dlUniNote(R) + " · 동일가중 = 종목마다 같은 비중", "지수·종목: 야후 파이낸스 종가 · StockMind 자동 집계 · 매수·매도 신호가 아닙니다");
  return c.cv;
}
function dlCard2(R) {
  var S = dlStocks(R), rows = [["20일선 위", "단기 추세", S.filter(function (s) { return s.above20 != null; }), function (s) { return s.above20; }], ["50일선 위", "중기 추세", S.filter(function (s) { return s.above50 != null; }), function (s) { return s.above50; }], ["200일선 위", "장기 추세", S.filter(function (s) { return s.above200 != null; }), function (s) { return s.above200; }]];
  var pct = rows.map(function (r) { return r[2].length >= 10 ? r[2].filter(r[3]).length / r[2].length : null; }), c = dlNew(2, "시장 체력", R), g = c.g, W = DL.W - DL.P * 2;
  var lead = pct[0] != null ? "20일선 위 종목이 " + (pct[0] * 100).toFixed(1) + "%로 절반을 " + (pct[0] >= 0.5 ? "넘었습니다" : "밑돌았습니다") : "이동평균선 위 종목 비율";
  dlHead(c, lead, "여기서 「상승 흐름」은 주가가 20일 또는 50일 이동평균선 위에 있다는 뜻입니다.");
  c.y += 20;
  rows.forEach(function (r, i) { var p = pct[i]; cText(g, r[0], DL.P, c.y + 30, 32, 800, DL_C.ink); cText(g, r[1], DL.P + cW(g, r[0], 32, 800) + 14, c.y + 30, 22, 600, DL_C.sub); var col = p == null ? DL_C.sub : p < 0.25 ? DL_C.red : p < 0.5 ? DL_C.gold : DL_C.green; cText(g, p == null ? "자료 부족" : (p * 100).toFixed(1) + "%", DL.P + W, c.y + 36, p == null ? 30 : 60, 900, col, "right"); c.y += 60; cRound(g, DL.P, c.y, W, 56, 8, DL_C.tile); if (p != null) { cRound(g, DL.P, c.y, Math.max(8, W * p), 56, 8, col); } g.save(); g.setLineDash([8, 6]); g.strokeStyle = DL_C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(DL.P + W / 2, c.y - 8); g.lineTo(DL.P + W / 2, c.y + 64); g.stroke(); g.restore(); cText(g, "절반 50%", DL.P + W / 2 + 10, c.y + 36, 20, 800, DL_C.ink); c.y += 100; });
  dlNote(c, "읽는 법 — 20·50·200일 평균 가격보다 위에 있는 종목의 비율입니다. 50% 선은 종목의 절반을 나타내는 비교선이며 매수·매도 기준이 아닙니다. 막대 색은 시장 참여 정도일 뿐 매수·매도 신호가 아닙니다.");
  dlFoot(c, "20일선 유효 " + rows[0][2].length + "종목 · 50일선 유효 " + rows[1][2].length + "종목 · 200일선 유효 " + rows[2][2].length + "종목 (전체 " + S.length + ") · 막대 색: 25% 미만 파랑 · 50% 미만 금색 · 50% 이상 빨강(앱과 같은 한국식 색) · " + dlUniNote(R), "종목: 야후 파이낸스 종가 · 수정주가 기준");
  return c.cv;
}
function dlDiverge(c, items, fmt, opt) {   // 가로 가운데 0 기준 막대 (음수 빗금) · 상위·하위 3 굵게
  var g = c.g, W = DL.W - DL.P * 2, n = items.length, rowH = Math.min(62, Math.floor((opt.maxH || 640) / n)), labW = opt.labW || 300, valW = 150, mid = DL.P + labW + (W - labW - valW) / 2, half = (W - labW - valW) / 2 - 10, mx = Math.max.apply(null, items.map(function (x) { return Math.abs(x.v); })) || 1e-6;
  cText(g, "▼ 하락 · 상승 ▲", DL.P, c.y + 18, 22, 700, DL_C.sub); cText(g, "0", mid, c.y + 18, 22, 700, DL_C.sub, "center"); c.y += 36;
  g.fillStyle = DL_C.ink; g.fillRect(mid - 2, c.y - 6, 4, rowH * n + 12);
  var hp = dlHatch(g, opt.negColor || DL_C.red);
  items.forEach(function (it, i) { var y = c.y + i * rowH, bold = i < 3 || i >= n - 3, w = Math.max(4, Math.abs(it.v) / mx * half), col = it.v >= 0 ? (opt.posColor || DL_C.green) : (opt.negColor || DL_C.red); cText(g, cFit(g, it.l, labW - 16, 27, bold ? 900 : 600), DL.P, y + rowH / 2 + 9, 27, bold ? 900 : 600, DL_C.ink); if (it.v >= 0) { g.fillStyle = col; g.fillRect(mid + 2, y + 8, w, rowH - 16); } else { g.fillStyle = hp; g.fillRect(mid - 2 - w, y + 8, w, rowH - 16); } cText(g, fmt(it.v), DL.P + W, y + rowH / 2 + 9, 27, bold ? 900 : 700, bold ? col : DL_C.sub, "right"); });
  c.y += rowH * n + 20;
}
function dlCard3(R) {
  var T = dlThemes(R).slice().sort(function (a, b) { return b.ret - a.ret; }), up = T.filter(function (t) { return t.ret > 0; }).length, c = dlNew(3, "업종 성과", R);
  if (!T.length) return null;
  dlHead(c, T.length + "개 업종 중 " + up + "개 상승 · " + (T.length - up) + "개 하락했습니다", "업종 평균 1일 수익률 · 가장 강한 " + T[0].name + " " + dlPct(T[0].ret) + " · 가장 약한 " + T[T.length - 1].name + " " + dlPct(T[T.length - 1].ret));
  dlDiverge(c, T.slice(0, 14).map(function (t) { return { l: t.name + " (" + t.n + ")", v: t.ret }; }), function (v) { return dlPct(v); }, { maxH: 700, labW: 330 });
  dlFoot(c, "업종 = " + (dlUni(R) && dlUni(R).mkt === "us" ? "GICS 11개 섹터(위키피디아 구성표)" : "앱의 테마 분류") + "(괄호 안은 종목 수) · 업종 평균 = 소속 종목 1일 수익률의 동일가중 평균 · 굵은 줄 = 상위 3 · 하위 3 · 업종 ETF가 아닌 종목 묶음이라 섹터 지수와 다를 수 있음 · " + dlUniNote(R), "종목: 야후 파이낸스 종가 · StockMind 자동 집계");
  return c.cv;
}
function dlCard4(R) {
  var G = dlAmtGroup(R), S = G.list, tot = S.reduce(function (a, s) { return a + s.amt; }, 0); if (!tot || S.length < 8) return null;
  var top = S.slice().sort(function (a, b) { return b.amt - a.amt; }).slice(0, 10), c = dlNew(4, "거래 집중 종목", R), g = c.g, W = DL.W - DL.P * 2, nm = function (s) { return s.uni ? (/\.K[SQ]$/.test(s.sym) ? s.name : s.sym) : /\.K[SQ]$/.test(s.sym) && typeof briefName === "function" ? briefName(s) : s.sym; };
  var sh = top[0].amt / tot; dlHead(c, nm(top[0]) + " 거래대금이 집계 가능 " + G.label + S.length + "종목 전체의 " + (sh * 100).toFixed(1) + "%를 차지했습니다", "막대 길이 = 집계 가능 " + G.label + S.length + "종목 거래대금 합계(" + dlAmtT(tot, G.kr) + ") 중 점유율 · 거래대금은 방향 없는 거래 규모입니다");
  cText(g, "순위  종목", DL.P, c.y + 20, 22, 700, DL_C.sub); cText(g, "거래대금 점유율", DL.P + 220, c.y + 20, 22, 700, DL_C.sub); cText(g, "1일", DL.P + W - 190, c.y + 20, 22, 700, DL_C.sub, "right"); cText(g, "평소 대비", DL.P + W, c.y + 20, 22, 700, DL_C.sub, "right"); c.y += 40;
  var rowH = 62, mx = top[0].amt / tot;
  top.forEach(function (s, i) { var y = c.y + i * rowH, p = s.amt / tot; if (i < 3) { cRound(g, DL.P - 10, y + 4, W + 20, rowH - 8, 8, DL_C.tile); } cText(g, String(i + 1), DL.P + 4, y + 42, 26, 800, DL_C.sub); cText(g, cFit(g, nm(s), 150, 28, 900), DL.P + 48, y + 42, 28, 900, DL_C.ink); var bw = Math.max(6, p / mx * 360); g.fillStyle = i < 3 ? DL_C.ink : "#8a8577"; g.fillRect(DL.P + 220, y + 16, bw, rowH - 32); cText(g, (p * 100).toFixed(2) + "%", DL.P + 220 + bw + 12, y + 42, 22, 700, DL_C.sub); cText(g, dlPct(s.ret1), DL.P + W - 190, y + 42, 28, 800, dlCol(s.ret1), "right"); var x = s.amtX; cText(g, x != null ? x.toFixed(2) + "배" : "-", DL.P + W, y + 42, 28, x >= 1.5 ? 900 : 600, x >= 1.5 ? DL_C.ink : "#3b4256", "right"); });
  c.y += rowH * top.length + 10;
  dlFoot(c, "거래대금 = 종가 × 거래량 · 평소 대비 = 당일 ÷ 직전 20거래일 평균(1.5배 이상 굵게) · 거래대금이 크다는 사실만으로 매수세·자금 유입을 의미하지 않습니다 · " + dlUniNote(R), "종목: 야후 파이낸스 종가·거래량 · 수정주가 기준");
  return c.cv;
}
function dlCard5(R) {
  var G = dlAmtGroup(R), S = G.list.filter(function (s) { return s.amtX > 0; }), tot = S.reduce(function (a, s) { return a + s.amt; }, 0), totT = S.reduce(function (a, s) { return a + s.amt / s.amtX; }, 0); if (!tot || !totT || S.length < 8) return null;
  var byT = {}; (typeof BRIEF_THEMES !== "undefined" ? BRIEF_THEMES : []).forEach(function (t) { t[1].forEach(function (sym) { byT[sym] = byT[sym] || t[0]; }); });
  var agg = {}; S.forEach(function (s) { var k = s.sec ? dlSecKo(s.sec) : (byT[s.sym] || "기타"); agg[k] = agg[k] || { n: k, a: 0, t: 0 }; agg[k].a += s.amt; agg[k].t += s.amt / s.amtX; });
  var L = Object.keys(agg).map(function (k) { return { n: k, sh: agg[k].a / tot, ty: agg[k].t / totT }; }).filter(function (x) { return x.n !== "기타"; }).sort(function (a, b) { return b.sh - a.sh; }); if (L.length < 4) return null;
  var c = dlNew(5, "업종 거래활동", R), g = c.g, W = DL.W - DL.P * 2, top = L[0], d0 = (top.sh - top.ty) * 100;
  dlHead(c, nbJosa(top.n, "이/가") + " 거래대금의 " + Math.round(top.sh * 100) + "%를 차지했" + (Math.abs(d0) >= 0.3 ? "지만 평소보다 " + Math.abs(d0).toFixed(1) + "%p " + (d0 > 0 ? "높았습니다" : "낮았습니다") : "습니다"), "거래대금 비중은 가장 컸" + (Math.abs(d0) >= 0.3 ? "지만, 직전 20일의 평소 비중보다는 " + Math.abs(d0).toFixed(1) + "%p " + (d0 > 0 ? "높았습니다" : "낮았습니다") : "고, 평소 비중과 비슷했습니다"));
  cText(g, "오늘 거래대금 점유율", DL.P, c.y + 24, 26, 800, DL_C.ink); cText(g, "집계 가능 종목 합계 = 100%", DL.P + 270, c.y + 24, 20, 600, DL_C.sub); c.y += 40;
  var x = DL.P, shades = ["#14161c", "#3a3426", "#6b5a2e", "#9a7f3e", "#b8913f", "#c9a24f", "#d8bd7e", "#e6d3a3", "#efe3c3", "#f4ecd8", "#f8f3e6"]; cRound(g, DL.P, c.y, W, 90, 12, DL_C.white, DL_C.line); L.forEach(function (t, i) { var w = W * t.sh; g.fillStyle = shades[Math.min(i, shades.length - 1)]; g.fillRect(x, c.y, w, 90); if (i === 0) { var lab = t.n + " " + Math.round(t.sh * 100) + "%", fs0 = 30; while (fs0 > 18 && cW(g, lab, fs0, 900) > w - 20) fs0 -= 2; if (cW(g, lab, fs0, 900) <= w - 20) cText(g, lab, x + w / 2, c.y + 45 + fs0 * 0.36, fs0, 900, DL_C.lime, "center"); } x += w; }); c.y += 106;
  cWrap(g, "점유율: " + L.slice(0, 4).map(function (t) { return t.n + " " + (t.sh * 100).toFixed(1) + "%"; }).join(" · ") + " · 나머지 " + (L.length - 4) + "개 " + (L.slice(4).reduce(function (a, t) { return a + t.sh; }, 0) * 100).toFixed(1) + "%", DL.P, c.y + 22, W, 22, 600, "#3b4256", 30, 2); c.y += 70;
  cText(g, "평소 대비 점유율 변화", DL.P, c.y + 24, 26, 800, DL_C.ink); cText(g, "직전 20거래일 평균과의 차이(%p)", DL.P + 270, c.y + 24, 20, 600, DL_C.sub); c.y += 36;
  var D = L.map(function (t) { return { l: t.n, v: (t.sh - t.ty) * 100 }; }).sort(function (a, b) { return b.v - a.v; });
  dlDiverge(c, D.slice(0, 11), function (v) { return (v >= 0 ? "▲" : "▼") + Math.abs(v).toFixed(2) + "%p"; }, { maxH: 440, labW: 330, posColor: DL_C.gold, negColor: "#8a8577" });
  dlFoot(c, "거래 점유율 변화이며 자금 유입·이탈 방향이 아닙니다 · 점유율 분모 = 집계 가능 " + S.length + "종목 거래대금 합계 · 평소 = 종목별 직전 20일 거래대금 중앙값의 합 · 업종은 " + (dlUni(R) && dlUni(R).mkt === "us" ? "GICS 섹터" : "앱 테마 분류") + " · " + dlUniNote(R), "종목: 야후 파이낸스 종가·거래량 · 수정주가 기준");
  return c.cv;
}
function dlCard6(R) {
  var S = dlStocks(R).filter(function (s) { return s.longEnough; }), hi = S.filter(function (s) { return s.newHigh; }), lo = S.filter(function (s) { return s.newLow; }), nearHi = S.filter(function (s) { return !s.newHigh && s.vsHi != null && s.vsHi >= -0.03; }).length, nearLo = S.filter(function (s) { return !s.newLow && s.vsLo != null && s.vsLo <= 0.03; }).length;
  if (S.length < 20) return null; var c = dlNew(6, "신고가·신저가", R), g = c.g, W = DL.W - DL.P * 2, nm = function (s) { return s.uni ? (/\.K[SQ]$/.test(s.sym) ? s.name : s.sym) : /\.K[SQ]$/.test(s.sym) && typeof briefName === "function" ? briefName(s) : s.sym; };
  var big = hi.length && lo.length ? "신고가 종목이 신저가 종목보다 " + (hi.length >= lo.length ? (hi.length / lo.length).toFixed(1) + "배 많았습니다" : (lo.length / hi.length).toFixed(1) + "배 적었습니다") : hi.length ? "신저가 없이 신고가 " + hi.length + "종목이 나왔습니다" : lo.length ? "신고가 없이 신저가 " + lo.length + "종목이 나왔습니다" : "52주 신고가·신저가가 없는 조용한 날이었습니다";
  dlHead(c, big, "52주 종가 기준 신고가 " + hi.length + "종목, 신저가 " + lo.length + "종목. 신고가 근처(3% 이내) " + nearHi + "개 · 신저가 근처 " + nearLo + "개입니다.");
  var hw = (W - 20) / 2; cRound(g, DL.P, c.y, hw, 250, 14, "#f6e3e1", DL_C.ink); cText(g, "▲ 52주 종가 신고가", DL.P + 24, c.y + 46, 26, 800, DL_C.ink); cText(g, String(hi.length), DL.P + 24, c.y + 170, 110, 900, DL_C.green); cText(g, "신고가 근접(3% 이내) " + nearHi, DL.P + 24, c.y + 222, 24, 700, DL_C.ink);
  g.save(); cRound(g, DL.P + hw + 20, c.y, hw, 250, 14, "#e1eaf6", DL_C.ink); g.clip(); g.fillStyle = dlHatch(g, "#e1eaf6"); g.fillRect(DL.P + hw + 20, c.y, hw, 250); g.restore(); cRound(g, DL.P + hw + 20, c.y, hw, 250, 14, null, DL_C.ink); cText(g, "▼ 52주 종가 신저가", DL.P + hw + 44, c.y + 46, 26, 800, DL_C.ink); cText(g, String(lo.length), DL.P + hw + 44, c.y + 170, 110, 900, DL_C.red); cText(g, "신저가 근접(3% 이내) " + nearLo, DL.P + hw + 44, c.y + 222, 24, 700, DL_C.ink); c.y += 270;
  var t = hi.length + lo.length; cRound(g, DL.P, c.y, W, 26, 8, DL_C.tile, DL_C.ink); if (t) { g.fillStyle = DL_C.green; g.fillRect(DL.P + 2, c.y + 2, (W - 4) * hi.length / t, 22); g.fillStyle = dlHatch(g, DL_C.red); g.fillRect(DL.P + 2 + (W - 4) * hi.length / t, c.y + 2, (W - 4) * lo.length / t, 22); } c.y += 46;
  var byAmt = function (a, b) { return (b.amt || 0) - (a.amt || 0); }, H5 = hi.slice().sort(byAmt).slice(0, 5), L5 = lo.slice().sort(byAmt).slice(0, 5), amtT = function (s) { return dlAmtT(s.amt || 0, /\.K[SQ]$/.test(s.sym)).replace("원", ""); }, px = function (v, s) { return /\.K[SQ]$/.test(s.sym) ? Math.round(v).toLocaleString("ko-KR") : v.toFixed(2); };
  function col(X, title, L, k) { cText(g, title, X, c.y + 24, 24, 800, DL_C.ink); g.fillStyle = DL_C.ink; g.fillRect(X, c.y + 36, hw, 2); cWrap(g, "종목 · 오늘 종가 / 직전 250일 " + (k === "hi" ? "최고가" : "최저가") + " · 거래대금", X, c.y + 64, hw, 19, 600, DL_C.sub, 24, 2); var y = c.y + 110; if (!L.length) cText(g, "해당 없음", X, y + 20, 22, 600, DL_C.sub); L.forEach(function (s, i) { var rt = px(s.last, s) + " / " + px(k === "hi" ? s.hi250 : s.lo250, s) + " · " + amtT(s), rf = 20; while (rf > 14 && cW(g, rt, rf, 700) > hw * 0.62) rf -= 1; var rw = cW(g, rt, rf, 700); cText(g, cFit(g, (i + 1) + ". " + nm(s), hw - rw - 16, 24, 900), X, y + 24, 24, 900, DL_C.ink); cText(g, rt, X + hw, y + 24, rf, 700, "#3b4256", "right"); g.strokeStyle = DL_C.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X, y + 40); g.lineTo(X + hw, y + 40); g.stroke(); y += 56; }); }
  col(DL.P, "▲ 신고가 주요 5 · 거래대금 순", H5, "hi"); col(DL.P + hw + 20, "▼ 신저가 주요 5 · 거래대금 순", L5, "lo");
  dlFoot(c, "종목 · 종가 / 직전 250거래일(당일 제외) 최고·최저 · 거래대금 · 52주 표본 유효 " + S.length + "종목 · " + dlUniNote(R) + " · 신고가·신저가는 매수·매도 신호가 아닙니다", "종목: 야후 파이낸스 종가 · 수정주가 기준");
  return c.cv;
}
function dlCard7(R) {
  var want = R.market === "kr" ? [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["KRW=X", "달러/원"], ["TLT", "미국 장기채"], ["GLD", "금"], ["BTC-USD", "비트코인"]] : [["SPY", "S&P 500"], ["QQQ", "나스닥100"], ["^KS11", "코스피"], ["TLT", "미국 장기채"], ["IEF", "미국 중기채"], ["GLD", "금"]];
  var by = {}; (R.stocks || []).forEach(function (s) { by[s.sym] = s; }); var L = want.map(function (w) { var s = by[w[0]]; return s ? { sym: w[0], name: w[1], v: s.ret1 } : null; }).filter(Boolean); if (L.length < 4) return null;
  var up = L.filter(function (x) { return x.v > 0; }).length, c = dlNew(7, "자산군 움직임", R), g = c.g, W = DL.W - DL.P * 2;
  dlHead(c, "자산 " + L.length + "종 중 " + up + "개 상승 · " + (L.length - up) + "개 하락했습니다", L.length + "종 · 상승 " + up + " · 하락 " + (L.length - up) + " · 1일 수익률");
  dlDiverge(c, L.map(function (x) { return { l: x.name + "  " + x.sym.replace(/^\^/, ""), v: x.v }; }), function (v) { return dlPct(v); }, { maxH: 330, labW: 330 });
  var pairs = R.market === "kr" ? [["^KS11", "KRW=X", "코스피 ↔ 달러/원"], ["^KS11", "GLD", "코스피 ↔ 금"], ["^KS11", "BTC-USD", "코스피 ↔ 비트코인"]] : [["SPY", "TLT", "S&P 500 ↔ 미국 장기채"], ["SPY", "GLD", "S&P 500 ↔ 금"], ["QQQ", "^KS11", "나스닥100 ↔ 코스피"]];
  cText(g, "함께 움직였나", DL.P, c.y + 26, 28, 800, DL_C.ink); cText(g, "일간 수익률 상관계수 · 진할수록 관계가 강함", DL.P + 200, c.y + 26, 20, 600, DL_C.sub); c.y += 44;
  var cols = [["20일", 20], ["60일 · 대표", 60], ["120일", 120]], cx = DL.P + 400, cw = (W - 400) / 3; cText(g, "짝", DL.P, c.y + 22, 22, 700, DL_C.sub); cols.forEach(function (k, i) { cText(g, k[0], cx + cw * i + cw / 2, c.y + 22, 22, i === 1 ? 900 : 700, i === 1 ? DL_C.ink : DL_C.sub, "center"); }); c.y += 36;
  var any = false; pairs.forEach(function (p) { var vals = cols.map(function (k) { var a = k[1] <= 60 ? dlRets(p[0], k[1]) || dlRetsHist(p[0], k[1]) : dlRetsHist(p[0], k[1]), b = k[1] <= 60 ? dlRets(p[1], k[1]) || dlRetsHist(p[1], k[1]) : dlRetsHist(p[1], k[1]); return dlCorr(a, b); }); if (vals.every(function (v) { return v == null; })) return; any = true; cText(g, cFit(g, p[2], 380, 26, 800), DL.P, c.y + 44, 26, 800, DL_C.ink); vals.forEach(function (v, i) { var X = cx + cw * i; var bg = v == null ? DL_C.tile : Math.abs(v) >= 0.6 ? "#14161c" : Math.abs(v) >= 0.3 ? "#d8bd7e" : "#eeeae1"; g.fillStyle = bg; g.fillRect(X + 2, c.y + 4, cw - 4, 62); if (i === 1) { g.strokeStyle = DL_C.lime; g.lineWidth = 4; g.strokeRect(X + 2, c.y + 4, cw - 4, 62); } cText(g, v == null ? "-" : v.toFixed(2), X + cw / 2, c.y + 46, 28, 900, Math.abs(v || 0) >= 0.6 ? DL_C.lime : DL_C.ink, "center"); }); c.y += 70; });
  if (!any) cText(g, "상관계수를 계산할 자료가 아직 없어요", DL.P, c.y + 30, 22, 600, DL_C.sub);
  c.y += 14; [["#eeeae1", "0.3 미만"], ["#d8bd7e", "0.3~0.6"], ["#14161c", "0.6 이상"]].forEach(function (k, i) { g.fillStyle = k[0]; g.fillRect(DL.P + i * 170, c.y + 6, 26, 22); cText(g, k[1], DL.P + i * 170 + 34, c.y + 24, 20, 600, DL_C.ink); }); c.y += 40; cText(g, "+1에 가까울수록 같은 방향 · 0은 관계 약함 · -1에 가까울수록 반대 방향", DL.P, c.y + 22, 20, 600, "#3b4256");
  dlFoot(c, "ETF·지수 1일 수익률(수정주가) · 상관계수 = 공통 거래일 일간 수익률의 피어슨 계수 · 120일은 긴 역사가 있는 자산만 · 과거 동행 정도이며 인과관계나 미래 예측이 아닙니다", "지수·ETF: 야후 파이낸스 · 수정주가 기준");
  return c.cv;
}
function dlCard8(R) {
  var groups = DL_SCORE[R.market] || DL_SCORE.us;
  var by = {}; (R.stocks || []).forEach(function (s) { by[s.sym] = s; }); var rows = [], upN = 0, tot = 0, best = null, worst = null;
  groups.forEach(function (gp) { var L = gp[1].map(function (w) { var st = dlYearStats(w[0]), s = by[w[0]]; if (!st && !s) return null; var r = { sym: w[0], name: w[1], d1: s && s.ret1 != null ? s.ret1 : st ? st.d1 : null, ytd: st ? st.ytd : null, up: st ? st.up : null, dn: st ? st.dn : null, years: st ? st.years : 0 }; if (r.ytd != null) { tot++; if (r.ytd > 0) upN++; if (!best || r.ytd > best.ytd) best = r; if (!worst || r.ytd < worst.ytd) worst = r; } return r; }).filter(Boolean); if (L.length) rows.push({ g: gp[0], L: L }); });
  if (!tot) return null; var c = dlNew(8, "주요 자산 성적표", R), g = c.g, W = DL.W - DL.P * 2;
  dlHead(c, tot + "개 자산 중 " + upN + "개 연초 대비 상승", "연초 대비 최고 " + best.name + " " + dlPct(best.ytd) + " · 최저 " + worst.name + " " + dlPct(worst.ytd));
  var X = [DL.P, DL.P + 440, DL.P + 610, DL.P + 790, DL.P + W]; cText(g, "자산 · 표본", X[0], c.y + 20, 20, 700, DL_C.sub); cText(g, "전일 대비", X[1], c.y + 20, 20, 700, DL_C.sub, "right"); cText(g, "연초 대비", X[2], c.y + 20, 20, 700, DL_C.sub, "right"); cText(g, "평균 상승폭", X[3], c.y + 20, 20, 700, DL_C.sub, "right"); cText(g, "평균 낙폭", X[4], c.y + 20, 20, 700, DL_C.sub, "right"); c.y += 30; g.fillStyle = DL_C.ink; g.fillRect(DL.P, c.y, W, 2); c.y += 4;
  var nAll = rows.reduce(function (a, gp) { return a + gp.L.length; }, 0), gH = 32, bottom = DL.H - 64 - 112 - 6, rowH = Math.max(34, Math.min(50, Math.floor((bottom - c.y - rows.length * gH) / Math.max(1, nAll)))), fs = rowH >= 44 ? 27 : rowH >= 38 ? 24 : 22, fs2 = rowH >= 44 ? 24 : 21, ty = Math.round(rowH * 0.72);
  rows.forEach(function (gp) { cRound(g, DL.P, c.y + 3, W, gH - 6, 6, DL_C.tile); cText(g, gp.g, DL.P + 10, c.y + gH - 10, 19, 800, DL_C.ink); c.y += gH; gp.L.forEach(function (r) { cText(g, r.name, X[0], c.y + ty, fs, 800, DL_C.ink); cText(g, r.sym.replace(/^\^/, "") + (r.years ? " · " + r.years + "년" : ""), X[0] + cW(g, r.name, fs, 800) + 10, c.y + ty, 18, 600, DL_C.sub); cText(g, dlPct(r.d1), X[1], c.y + ty, fs, 800, dlCol(r.d1), "right"); cText(g, dlPct(r.ytd), X[2], c.y + ty, fs, 900, dlCol(r.ytd), "right"); cText(g, r.up != null ? "+" + (r.up * 100).toFixed(1) + "%" : "-", X[3], c.y + ty, fs2, 600, "#3b4256", "right"); cText(g, r.dn != null ? (r.dn * 100).toFixed(1) + "%" : "-", X[4], c.y + ty, fs2, 600, "#3b4256", "right"); g.strokeStyle = DL_C.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(DL.P, c.y + rowH); g.lineTo(DL.P + W, c.y + rowH); g.stroke(); c.y += rowH; }); });
  dlFoot(c, "연초 대비 = 올해 첫 거래일 수정종가 대비 · 평균 상승폭·낙폭 = 각 연도 첫 거래일 수정종가 대비 그해 최고·최저 수정종가 수익률의 평균 · 상장 첫해 거래일 60일 미만이면 그해 제외 · 올해는 평균에서 제외 · 과거 통계이며 매수·매도 신호가 아닙니다", "지수·ETF·종목: 야후 파이낸스 · 수정주가(배당·분할 반영) 기준");
  return c.cv;
}
function dlCard9(R) {
  var items = typeof hubNewsItems === "function" ? hubNewsItems().slice(0, 5) : []; if (!items.length) return null;
  var c = dlNew(9, "시장 해설", R), g = c.g, W = DL.W - DL.P * 2;
  dlHead(c, "오늘 기사가 말한 것", "기사 제목과 요약을 그대로 옮겼습니다 · " + items.length + "건 · 앱이 원인을 추론하지 않습니다");
  items.forEach(function (x, i) { var t = (i + 1) + ". " + x.t, n = cWrapCount(g, t, W, 28, 800); cWrap(g, t, DL.P, c.y + 30, W, 28, 800, DL_C.ink, 38, 2); c.y += Math.min(2, n) * 38 + 6; var d = (x.desc || "").split(/(?<=[다요]\.)\s+/)[0] || ""; if (d) { var m = cWrapCount(g, d, W, 23, 500); cWrap(g, d, DL.P, c.y + 24, W, 23, 500, "#3b4256", 32, 3); c.y += Math.min(3, m) * 32 + 4; } cText(g, (x.it && x.it.press ? x.it.press : "") + (x.it && x.it.time ? " · " + String(x.it.time).slice(0, 10) : ""), DL.P, c.y + 22, 19, 600, DL_C.sub); c.y += 44; if (c.y > DL.H - 220) return; });
  dlFoot(c, "기사 제목·요약을 문장 그대로 옮겼습니다(수정·요약 없음) · 해설과 인과 설명은 언론사 판단이며 앱이 원인을 추론하지 않습니다 · 투자 권유가 아닙니다", "기사: 네이버 뉴스 검색 · 원문은 각 언론사");
  return c.cv;
}
function dlPrep(R) { return Promise.all([dlUniLoad(R && R.market), typeof hubLoad === "function" ? hubLoad(dlScoreSyms(R).concat(["IEF", "^KQ11", "ETH-USD"])) : Promise.resolve()]); }
/* 기존 화면(오늘 탭)과 같은 숫자를 쓰도록 — 유니버스 요약 → temp 모양 */
function dlUniTemp(U) {
  var S = dlUniStocks(U), up = 0, above = 0, n50 = 0, a50 = 0, n200 = 0, a200 = 0, nh = [], nl = [], nearH = [], nearL = [];
  S.forEach(function (s) { if (s.ret1 > 0) up++; if (s.above20) above++; if (s.above50 != null) { n50++; if (s.above50) a50++; } if (s.above200 != null) { n200++; if (s.above200) a200++; } if (s.newHigh) nh.push(s); else if (s.vsHi != null && s.longEnough && s.vsHi >= -0.03) nearH.push(s); if (s.newLow) nl.push(s); else if (s.vsLo != null && s.longEnough && s.vsLo <= 0.03) nearL.push(s); });
  var byAmt = function (a, b) { return (b.amt || 0) - (a.amt || 0); }; nh.sort(byAmt); nl.sort(byAmt); nearH.sort(byAmt); nearL.sort(byAmt);
  var t = { total: S.length, up: up, upPct: S.length ? up / S.length : 0, above20: above, abovePct: S.length ? above / S.length : 0, above50: a50, n50: n50, above50Pct: n50 ? a50 / n50 : null, above200: a200, n200: n200, above200Pct: n200 ? a200 / n200 : null, newHigh: nh, newLow: nl, nearHigh: nearH, nearLow: nearL, uni: dlUniName(U), asOf: U.asOf };
  t.word = t.upPct >= 0.65 ? "훈풍" : t.upPct >= 0.5 ? "미지근" : t.upPct >= 0.35 ? "쌀쌀" : "한파";
  t.desc = t.upPct >= 0.65 ? "대부분이 올랐어요. 이런 날엔 '나만 못 번 것 같은' 조급함을 조심하세요." : t.upPct >= 0.5 ? "오른 종목과 내린 종목이 반반이에요. 종목별 이유가 갈리는 장이에요." : t.upPct >= 0.35 ? "내린 종목이 더 많아요. 개별 악재보다 시장 전체 분위기일 가능성이 커요." : "거의 다 내렸어요. 이런 날은 내 종목만의 문제가 아니에요. 과거 기록을 보고 판단하세요.";
  return t;
}
function dlDeck() {
  var R = typeof hubR === "function" ? hubR() : null; if (!R) return [];
  var list = [], defs = [["오늘시장", dlCard1], ["시장체력", dlCard2], ["업종성과", dlCard3], ["거래집중", dlCard4], ["업종거래", dlCard5], ["신고신저", dlCard6], ["자산군", dlCard7], ["성적표", dlCard8], ["시장해설", dlCard9]];
  defs.forEach(function (d) { var cv = null; try { cv = d[1](R); } catch (e) { console.warn("daily " + d[0], e); } if (cv) list.push({ name: d[0], cv: cv }); });
  return list;
}
