/* ============================================================
   v13.30 낙폭 · 단계 분석 (dd.js)
   HM의 'SOXL 25년 History' 자료의 방식을 모든 종목 · ETF · 레버리지에 적용한다.
   ① 하락 사건: 52주 고점(최근 252거래일 종가 최고)에서 -10% 이상 빠지면 시작, 52주 신고가로 돌아오면 끝
                사상최고가 기준 사건도 같이 센다
   ② 도달 분포: 사건 가운데 -20% ~ -90%까지 간 비율, 백분위(중앙값 · 하위 25 · 10 · 5%)
   ③ 진입 분석: -N%에 처음 닿은 날 종가에 샀다면 — 그 뒤 추가 하락, 1년(252거래일) 뒤
   ④ 연초 대비: 해마다 전년 마지막 종가 대비 가장 낮았던 값, 그해 연말, 다음 해
   ⑤ 단계 매수 구간: 이 종목 자신의 분포 백분위로 5단계 + 성향별 비율을 과거 사건에 그대로 넣어 본 결과
   ⑥ 레버리지 역산: 상장 전 구간은 기초 ETF 일간수익률 × 배수 − 비용으로 만들고, 실제 구간과 맞춰 검산
   ⑦ 사건의 배경: 앱의 주요 이벤트 목록(EVENTS) + 하락 모양(급락형 / 장기 하락형) + 200주선 이탈 여부
   모든 계산은 종가 기준. 과거 통계이며 매수 권유가 아니다.
   ============================================================ */
var DD = { memo: {}, busy: {}, slide: 0 };
var DD_LEV = { SOXL: ["SOXX", 3], TQQQ: ["QQQ", 3], UPRO: ["SPY", 3], SPXL: ["SPY", 3], TECL: ["XLK", 3], QLD: ["QQQ", 2], SSO: ["SPY", 2] };
var DD_RATE_K = 1.155;            /* 빌린 돈 1배당 기준금리에 곱하는 값 (자료의 3배 상품 2.31 ÷ 2) */
var DD_TH = [-0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9];
var DD_PROF = [
  { id: "safe", n: "안정", w: [5, 10, 15, 30, 40], d: "얕은 자리에서는 조금만, 깊은 자리에 대부분을 남겨 둬요" },
  { id: "mid", n: "균형", w: [10, 15, 20, 25, 30], d: "단계가 깊어질수록 조금씩 더 (보내주신 자료의 비율)" },
  { id: "agg", n: "공격", w: [30, 25, 20, 15, 10], d: "초반에 많이 — 얕게 끝나는 하락에서도 많이 사 둬요" }
];
function ddEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function ddPct(v, d) { return v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(d == null ? 1 : d) + "%"; }
function ddYmd(t) { var d = new Date(t); return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2); }
function ddYm(t) { return ddYmd(t).slice(0, 7); }
function ddYear(t) { return new Date(t).getUTCFullYear(); }
function ddMed(a) { a = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
/* 정렬된 배열의 q 분위(0~1), 선형 보간 */
function ddQ(sorted, q) { var n = sorted.length; if (!n) return null; if (n === 1) return sorted[0]; var p = q * (n - 1), i = Math.floor(p), f = p - i; return i + 1 < n ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i]; }
function ddName(s) { return typeof nbName === "function" ? nbName(s) : s; }
function ddPx(sym, v) { return typeof egPx === "function" ? egPx(sym, v) : (v == null ? "-" : String(Math.round(v * 100) / 100)); }

/* ---------- 기준금리(미국, %) : 바뀐 날만 들어 있는 계단 자료 ---------- */
function ddRateFn() {
  var s = typeof MAC !== "undefined" && MAC.doc && MAC.doc.series && MAC.doc.series.fed, a = (s && (s.d || s.rows)) || [], pts = [];
  for (var i = 0; i < a.length; i++) { var k = String(a[i][0]).replace(/-/g, ""), v = +a[i][1]; if (k.length >= 8 && isFinite(v)) pts.push([Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)), v]); }
  pts.sort(function (x, y) { return x[0] - y[0]; });
  var fn = function (t) { if (!pts.length || t < pts[0][0]) return null; var lo = 0, hi = pts.length - 1; while (lo < hi) { var m = (lo + hi + 1) >> 1; if (pts[m][0] <= t) lo = m; else hi = m - 1; } return pts[lo][1]; };
  fn.from = pts.length ? pts[0][0] : null; fn.n = pts.length; return fn;
}

/* ---------- 한 해 안에서의 최대 낙폭(연중 MDD) ---------- */
function ddYearMdd(rows) {
  var out = {}, y0 = null, pk = 0, md = 0;
  for (var i = 0; i < rows.length; i++) { var y = ddYear(rows[i].t); if (y !== y0) { if (y0 != null) out[y0] = md; y0 = y; pk = rows[i].c; md = 0; } if (rows[i].c > pk) pk = rows[i].c; var d = rows[i].c / pk - 1; if (d < md) md = d; }
  if (y0 != null) out[y0] = md; return out;
}

/* ---------- 분석에 쓰는 시세: 레버리지는 상장 전을 역산해 앞에 붙인다 ---------- */
function ddSeries(sym, hist, rateFn) {
  hist = hist || (typeof nbHist !== "undefined" ? nbHist : {});
  var act = (hist[sym] || []).filter(function (r) { return r && r.c > 0 && r.t > 0; }).map(function (r) { return { t: r.t, c: r.c }; });
  var out = { sym: sym, rows: act, synth: null }; if (act.length < 2) return out;
  var L = DD_LEV[sym]; if (!L) return out;
  var und = (hist[L[0]] || []).filter(function (r) { return r && r.c > 0 && r.t > 0; }); out.under = L[0]; out.lev = L[1];
  if (und.length < 300) { out.synthWhy = "기초 ETF(" + L[0] + ") 시세를 못 받았어요"; return out; }
  rateFn = rateFn || ddRateFn();
  var key = function (t) { return ddYmd(t); }, uRet = {}, uIdx = {}, i;
  for (i = 1; i < und.length; i++) { uRet[key(und[i].t)] = und[i].c / und[i - 1].c - 1; uIdx[key(und[i].t)] = i; }
  /* 겹치는 구간에서 고정 비용(연)을 맞춘다: 평균( 배수×기초수익률 − 금리비용 − 실제수익률 ) × 252 */
  var lev = L[1], borrow = (lev - 1) * DD_RATE_K, diff = [], xs = [], ys = [], noRate = 0;
  for (i = 1; i < act.length; i++) {
    var k = key(act[i].t), kp = key(act[i - 1].t), ui = uIdx[k]; if (ui == null || key(und[ui - 1].t) !== kp) continue;
    var rt = rateFn(act[i].t); if (rt == null) { rt = 0; noRate++; }
    var g = lev * uRet[k] - rt / 100 * borrow / 252, ra = act[i].c / act[i - 1].c - 1; if (Math.abs(ra) > 0.9) continue;
    diff.push(g - ra); xs.push(g); ys.push(ra);
  }
  if (diff.length < 250) { out.synthWhy = "실제 구간과 겹치는 날이 너무 적어요 (" + diff.length + "일)"; return out; }
  var fee = diff.reduce(function (a, b) { return a + b; }, 0) / diff.length * 252; fee = Math.max(-0.05, Math.min(0.1, fee));
  var mx = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length, my = ys.reduce(function (a, b) { return a + b; }, 0) / ys.length, sxy = 0, sxx = 0, syy = 0;
  for (i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
  var corr = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  var sRet = function (t, k) { var rt = rateFn(t); if (rt == null) rt = 0; return Math.max(-0.98, lev * uRet[k] - (fee + rt / 100 * borrow) / 252); };
  /* 검산: 실제 구간 전체를 역산값으로 다시 만들어 연중 MDD를 비교 */
  var chk = [{ t: act[0].t, c: act[0].c }];
  for (i = 1; i < act.length; i++) { var k2 = key(act[i].t), r2 = uRet[k2] != null ? sRet(act[i].t, k2) : act[i].c / act[i - 1].c - 1; chk.push({ t: act[i].t, c: chk[i - 1].c * (1 + r2) }); }
  var ya = ddYearMdd(act), ys2 = ddYearMdd(chk), yrs = Object.keys(ya).map(function (y) { return { y: +y, act: ya[y], syn: ys2[y], err: Math.abs(ya[y] - ys2[y]) }; }), maxErr = yrs.reduce(function (a, x) { return Math.max(a, x.err); }, 0);
  yrs.sort(function (a, b) { return a.act - b.act; });
  /* 상장 전 구간을 거꾸로 이어 붙인다 */
  var first = act[0], fi = uIdx[key(first.t)], pre = [];
  if (fi == null) { for (i = 1; i < und.length; i++) if (und[i].t >= first.t) { fi = i; break; } }
  if (fi != null && fi > 250) {
    var px = first.c;
    for (i = fi; i >= 1; i--) { var kk = key(und[i].t); px = px / (1 + sRet(und[i].t, kk)); pre.push({ t: und[i - 1].t, c: px, s: 1 }); }
    pre.reverse(); out.rows = pre.concat(act);
    out.synth = { under: L[0], lev: lev, fee: fee, borrow: borrow, corr: corr, n: diff.length, maxErr: maxErr, years: yrs.slice(0, 4).sort(function (a, b) { return a.y - b.y; }), from: pre[0].t, to: first.t, days: pre.length, noRate: noRate > diff.length * 0.2 || !rateFn.n };
  } else out.synthWhy = "기초 ETF 기록이 상장일보다 충분히 길지 않아요";
  return out;
}

/* ---------- 하락 사건 뽑기 ---------- */
function ddEvents(rows, basis) {
  var n = rows.length, W = 252, dd = new Array(n), hiIdx = new Array(n), dq = [], i, ath = -1, athI = 0;
  for (i = 0; i < n; i++) {
    if (basis === "ath") { if (rows[i].c >= ath) { ath = rows[i].c; athI = i; } hiIdx[i] = athI; }
    else { while (dq.length && rows[dq[dq.length - 1]].c <= rows[i].c) dq.pop(); dq.push(i); while (dq[0] <= i - W) dq.shift(); hiIdx[i] = dq[0]; }
    dd[i] = rows[i].c / rows[hiIdx[i]].c - 1;
  }
  var evs = [], cur = null;
  for (i = 0; i < n; i++) {
    if (!cur) { if (dd[i] <= -0.10) cur = { i0: i, ip: hiIdx[i], it: i, depth: dd[i], lo: rows[i].c, il: i }; }
    else {
      if (dd[i] >= -1e-12) { cur.i1 = i; evs.push(cur); cur = null; continue; }
      if (dd[i] < cur.depth) { cur.depth = dd[i]; cur.it = i; }
      if (rows[i].c < cur.lo) { cur.lo = rows[i].c; cur.il = i; }
    }
  }
  if (cur) { cur.open = 1; cur.i1 = null; evs.push(cur); }
  return { dd: dd, hiIdx: hiIdx, evs: evs };
}
function ddReach(evs) {
  var n = evs.length, dep = evs.map(function (e) { return e.depth; }).sort(function (a, b) { return a - b; });
  return { n: n, th: DD_TH.map(function (th) { var c = evs.filter(function (e) { return e.depth <= th + 1e-9; }).length; return { th: th, c: c, p: n ? c / n : null }; }),
    med: ddQ(dep, 0.5), p25: ddQ(dep, 0.25), p10: ddQ(dep, 0.10), p05: ddQ(dep, 0.05), worst: dep[0], sorted: dep };
}
/* -N%에 처음 닿은 날 종가에 샀다면 */
function ddEntryOne(rows, E, e, th) {
  if (e.depth > th + 1e-9) return null; var end = e.i1 != null ? e.i1 : rows.length - 1, j = -1, i;
  for (i = e.i0; i <= end; i++) if (E.dd[i] <= th + 1e-9) { j = i; break; }
  if (j < 0) return null; var lo = rows[j].c, li = j; for (i = j; i <= end; i++) if (rows[i].c < lo) { lo = rows[i].c; li = i; }
  var f = function (d) { return j + d < rows.length ? rows[j + d].c / rows[j].c - 1 : null; }, back = li === j ? 0 : null;
  if (back == null) for (i = li + 1; i < rows.length; i++) if (rows[i].c >= rows[j].c) { back = Math.round((rows[i].t - rows[j].t) / 86400e3); break; }
  /* 산 뒤 1년(252거래일) 안에서: 가장 낮았던 값 · 가장 높았던 값 · 큰 급락 횟수(고점에서 thr 이상 내려온 횟수) · 하루 최대 등락 */
  var thr = DD.swing || 0.25, c0 = rows[j].c, eY = Math.min(rows.length - 1, j + 252), lo1 = c0, lo1i = j, hi1 = c0, hi1i = j, drops = 0, pk = c0, tr = c0, inD = false, mdn = 0, mup = 0, cal = function (k) { return Math.round((rows[k].t - rows[j].t) / 86400e3); };
  for (i = j + 1; i <= eY; i++) { var c = rows[i].c, d1 = c / rows[i - 1].c - 1; if (d1 < mdn) mdn = d1; if (d1 > mup) mup = d1; if (c < lo1) { lo1 = c; lo1i = i; } if (c > hi1) { hi1 = c; hi1i = i; }
    if (!inD) { if (c > pk) pk = c; else if (c / pk - 1 <= -thr) { drops++; inD = true; tr = c; } } else { if (c < tr) tr = c; else if (c / tr - 1 >= thr) { inD = false; pk = c; } } }
  var y1 = { lo: lo1 / c0 - 1, loD: cal(lo1i), hi: hi1 / c0 - 1, hiD: cal(hi1i), drops: drops, mdn: mdn, mup: mup, thr: thr, full: j + 252 < rows.length };
  return { j: j, t: rows[j].t, c: rows[j].c, y1: y1, more: lo / rows[j].c - 1, lowT: rows[li].t, r6: f(126), r1: f(252), r2: f(504), r3: f(756), back: back, open: !!e.open, pk: rows[e.ip].t };
}
function ddEntry(rows, E, ths) {
  return (ths || DD_TH).map(function (th) {
    var hits = E.evs.map(function (e) { return ddEntryOne(rows, E, e, th); }).filter(Boolean), r1 = hits.map(function (h) { return h.r1; }).filter(function (v) { return v != null; });
    var wh = null, bh = null; hits.forEach(function (h) { if (h.r1 == null) return; if (!wh || h.r1 < wh.r1) wh = h; if (!bh || h.r1 > bh.r1) bh = h; });
    return { th: th, n: hits.length, more: ddMed(hits.map(function (h) { return h.more; })), r1: ddMed(r1), mean: r1.length ? r1.reduce(function (a, b) { return a + b; }, 0) / r1.length : null, worstT: wh ? wh.pk : null, bestT: bh ? bh.pk : null, n1: r1.length, pos: r1.length ? r1.filter(function (v) { return v > 0; }).length / r1.length : null, worst: r1.length ? Math.min.apply(null, r1) : null, best: r1.length ? Math.max.apply(null, r1) : null };
  }).filter(function (x) { return x.n > 0; });
}

/* ---------- 드문 기회 구간: 그 깊이에 닿은 사건들을 기간별로 ---------- */
var DD_HZ = [["r6", "6개월 후"], ["r1", "1년 후"], ["r2", "2년 후"], ["r3", "3년 후"]];
function ddStat(a) { a = a.filter(function (v) { return v != null && isFinite(v); }); if (!a.length) return { n: 0 }; return { n: a.length, med: ddMed(a), mean: a.reduce(function (x, y) { return x + y; }, 0) / a.length, pos: a.filter(function (v) { return v > 0; }).length, worst: Math.min.apply(null, a), best: Math.max.apply(null, a) }; }
function ddOpp(rows, E, th) {
  var hits = []; E.evs.forEach(function (e) { var h = ddEntryOne(rows, E, e, th); if (h) { h.depth = e.depth; h.ctx = ddContext(rows, e); hits.push(h); } });
  var st = {}; DD_HZ.forEach(function (z) { st[z[0]] = ddStat(hits.map(function (h) { return h[z[0]]; })); });
  var bk = hits.filter(function (h) { return !h.open || h.back != null; }).map(function (h) { return h.back; });
  var win = hits.filter(function (h) { return h.r1 != null && h.r1 > 0; });
  return { th: th, hits: hits, n: hits.length, st: st, lo1: ddStat(hits.map(function (h) { return h.y1.lo; })), hi1: ddStat(hits.filter(function (h) { return h.y1.full; }).map(function (h) { return h.y1.hi; })), drops: ddStat(hits.filter(function (h) { return h.y1.full; }).map(function (h) { return h.y1.drops; })), winLo: ddStat(win.map(function (h) { return h.y1.lo; })), winDrops: ddStat(win.map(function (h) { return h.y1.drops; })), thr: DD.swing || 0.25, more: ddStat(hits.map(function (h) { return h.more; })), back: ddMed(bk), notBack: hits.filter(function (h) { return h.back == null && !h.open; }).length,
    fail: hits.filter(function (h) { return h.r1 != null && h.r1 < 0; }), win: hits.filter(function (h) { return h.r1 != null && h.r1 > 0; }) };
}

/* ---------- 연초 대비 ---------- */
function ddYtd(rows) {
  var by = {}, order = [], i;
  for (i = 0; i < rows.length; i++) { var y = ddYear(rows[i].t); if (!by[y]) { by[y] = { y: y, a: i, b: i }; order.push(y); } by[y].b = i; }
  var mdd = ddYearMdd(rows), lastY = order[order.length - 1], yrs = [];
  order.forEach(function (y, k) {
    if (k === 0) return; var p = by[order[k - 1]], Y = by[y], base = rows[p.b].c, lo = Infinity, li = Y.a;
    for (var j = Y.a; j <= Y.b; j++) if (rows[j].c < lo) { lo = rows[j].c; li = j; }
    yrs.push({ y: y, base: base, low: lo / base - 1, lowT: rows[li].t, end: rows[Y.b].c / base - 1, mdd: mdd[y], cur: y === lastY, firstPartial: k === 1 && (ddYmd(rows[p.a].t).slice(5) > "01-15") });
  });
  var done = yrs.filter(function (x) { return !x.cur; }), th = [-0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8];
  var tab = th.map(function (t) { var hit = done.filter(function (x) { return x.low <= t + 1e-9; }); return { th: t, c: hit.length, p: done.length ? hit.length / done.length : null, pos: hit.filter(function (x) { return x.end > 0; }).length }; });
  var avg = function (a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; };
  /* 가장 깊이 빠졌던 해 3개와 그 다음 해 */
  var deep = done.slice().sort(function (a, b) { return a.low - b.low; }).slice(0, 3).map(function (x) { var nx = yrs.filter(function (z) { return z.y === x.y + 1; })[0]; return { y: x.y, low: x.low, end: x.end, next: nx && !nx.cur ? nx.end : null, nextCur: nx && nx.cur ? nx.end : null }; });
  return { yrs: yrs, done: done.length, tab: tab, avgLow: avg(done.map(function (x) { return x.low; })), avgMdd: avg(done.map(function (x) { return x.mdd; })), cur: yrs.filter(function (x) { return x.cur; })[0] || null, deep: deep, from: done.length ? done[0].y : null, to: done.length ? done[done.length - 1].y : null };
}

/* ---------- 200주선 (주봉 종가 200개 평균, 그 주가 끝난 뒤부터 적용) ---------- */
function ddW200(rows) {
  var wk = [], i, wkOf = function (t) { return Math.floor((t / 86400e3 + 3) / 7); }, map = new Array(rows.length);
  for (i = 0; i < rows.length; i++) { var w = wkOf(rows[i].t); if (!wk.length || wk[wk.length - 1].w !== w) wk.push({ w: w, c: rows[i].c }); else wk[wk.length - 1].c = rows[i].c; map[i] = wk.length - 1; }
  var ma = new Array(wk.length), s = 0; for (i = 0; i < wk.length; i++) { s += wk[i].c; if (i >= 200) s -= wk[i - 200].c; ma[i] = i >= 199 ? s / 200 : null; }
  return rows.map(function (r, k) { var p = map[k] - 1; return p >= 0 ? ma[p] : null; });
}

/* ---------- 사건의 배경: 앱 이벤트 목록 + 모양 ---------- */
function ddContext(rows, e) {
  var t0 = rows[e.ip].t, t1 = rows[e.it].t, days = Math.round((t1 - t0) / 86400e3), names = [];
  try { (typeof EVENTS !== "undefined" ? EVENTS : []).forEach(function (ev) { if (ev.ts >= t0 - 45 * 86400e3 && ev.ts <= t1 + 15 * 86400e3) names.push(ev); }); } catch (x) {}
  var bad = names.filter(function (ev) { return ev.type !== "회복"; });
  var shape = days <= 100 ? "급락형" : days >= 365 ? "장기 하락형" : "중간";
  return { days: days, shape: shape, names: bad.map(function (ev) { return ev.name; }), types: bad.map(function (ev) { return ev.type; }), rec: e.i1 != null ? Math.round((rows[e.i1].t - t1) / 86400e3) : null };
}

/* ---------- 단계 매수 구간 ---------- */
function ddStages(reach) {
  var qs = [0.5, 0.25, 0.15, 0.10, 0.05], st = [], prev = 0;
  qs.forEach(function (q, k) {
    var d = ddQ(reach.sorted, q); if (d == null) return; d = Math.round(d * 100) / 100; if (d > -0.10) d = -0.10;
    if (d > prev - 0.03) d = Math.round((prev - 0.03) * 100) / 100; if (d < -0.97) d = -0.97; prev = d;
    var c = reach.sorted.filter(function (x) { return x <= d + 1e-9; }).length; st.push({ k: k + 1, d: d, q: q, c: c, p: reach.n ? c / reach.n : null });
  });
  return st;
}
/* 성향별 비율을 과거 사건에 그대로 넣어 본 결과 (예산 1 = 이 종목에 쓰기로 한 돈 전체) */
function ddBacktest(rows, E, stages, weights) {
  var res = [];
  E.evs.forEach(function (e) {
    var end = e.i1 != null ? e.i1 : rows.length - 1, buys = [], si = 0, i;
    for (i = e.i0; i <= end && si < stages.length; i++) while (si < stages.length && E.dd[i] <= stages[si].d + 1e-9) { buys.push({ i: i, c: rows[i].c, w: weights[si] / 100 }); si++; }
    if (!buys.length) return;
    var inv = buys.reduce(function (a, b) { return a + b.w; }, 0), worst = 0, last = buys[buys.length - 1].i, val = function (idx) { var v = 0; buys.forEach(function (b) { if (b.i <= idx) v += b.w * (rows[idx].c / b.c - 1); }); return v; };
    for (i = buys[0].i; i <= end; i++) { var v = val(i); if (v < worst) worst = v; }
    var j1 = last + 252, r1 = j1 < rows.length ? val(j1) : null, j3 = last + 756, r3 = j3 < rows.length ? val(j3) : null;
    res.push({ e: e, inv: inv, n: buys.length, worst: worst, r1: r1, r3: r3, r1inv: r1 != null ? r1 / inv : null, open: !!e.open });
  });
  var out = ddBtAgg(res, stages.length); out.rows = res; return out;
}
function ddBtAgg(res, nSt) {
  var r1 = res.map(function (x) { return x.r1; }).filter(function (v) { return v != null; }), r3 = res.map(function (x) { return x.r3; }).filter(function (v) { return v != null; });
  return { n: res.length, inv: res.length ? res.reduce(function (a, x) { return a + x.inv; }, 0) / res.length : null, full: res.filter(function (x) { return x.n === nSt; }).length,
    worstMed: ddMed(res.map(function (x) { return x.worst; })), worst: res.length ? Math.min.apply(null, res.map(function (x) { return x.worst; })) : null,
    r1Med: ddMed(r1), r1Mean: r1.length ? r1.reduce(function (a, b) { return a + b; }, 0) / r1.length : null, r1Worst: r1.length ? Math.min.apply(null, r1) : null, r1Best: r1.length ? Math.max.apply(null, r1) : null, pos: r1.length ? r1.filter(function (v) { return v > 0; }).length / r1.length : null, posN: r1.filter(function (v) { return v > 0; }).length, n1: r1.length,
    r3Med: ddMed(r3), r3Worst: r3.length ? Math.min.apply(null, r3) : null, pos3N: r3.filter(function (v) { return v > 0; }).length, n3: r3.length };
}

/* ---------- 전체 묶음 ---------- */
function ddAnalyze(sym, hist, rateFn) {
  var S = ddSeries(sym, hist, rateFn), rows = S.rows; if (!rows || rows.length < 300) return null;
  var E = ddEvents(rows, "52w"), A = ddEvents(S.synth ? rows.filter(function (r) { return !r.s; }) : rows, "ath"), R = ddReach(E.evs), RA = ddReach(A.evs);
  if (!E.evs.length) return { sym: sym, S: S, rows: rows, E: E, none: 1, last: rows[rows.length - 1] };
  var stages = ddStages(R), last = rows[rows.length - 1], n = rows.length, cur = E.dd[n - 1], open = E.evs[E.evs.length - 1].open ? E.evs[E.evs.length - 1] : null;
  var aRows = S.synth ? rows.filter(function (r) { return !r.s; }) : rows, curAth = A.dd[aRows.length - 1];
  DD.swing = DD_LEV[sym] || /-USD$/.test(sym) || (typeof egLev === "function" && egLev(sym)) ? 0.25 : 0.15;
  var ent = ddEntry(rows, E), Y = ddYtd(rows), w200 = ddW200(rows);
  /* 꼬리 사건: 4단계(하위 10%) 근처까지 간 것 — 5%p 단위로 맞춘 기준 */
  var tailTh = -0.2; R.th.forEach(function (x) { if (x.c >= 3 && x.p >= 0.08) tailTh = x.th; });
  var tail = E.evs.filter(function (e) { return e.depth <= tailTh + 1e-9; }); if (tail.length < 3) { tail = E.evs.slice().sort(function (a, b) { return a.depth - b.depth; }).slice(0, Math.min(5, E.evs.length)).sort(function (a, b) { return a.i0 - b.i0; }); }
  tail = tail.map(function (e) { var h = ddEntryOne(rows, E, e, Math.max(tailTh, e.depth)), c = ddContext(rows, e), brk = false; for (var i = e.i0; i <= (e.i1 != null ? e.i1 : n - 1); i++) if (w200[i] != null && rows[i].c < w200[i]) { brk = true; break; } return { e: e, pk: rows[e.ip].t, tr: rows[e.it].t, depth: e.depth, hit: h, ctx: c, brk: brk, open: !!e.open }; });
  /* 200주선을 깬 사건과 안 깬 사건 */
  var grp = { brk: [], ok: [] };
  E.evs.forEach(function (e) { if (e.depth > -0.2) return; var end = e.i1 != null ? e.i1 : n - 1, b = false, known = false; for (var i = e.i0; i <= end; i++) if (w200[i] != null) { known = true; if (rows[i].c < w200[i]) { b = true; break; } } if (!known) return; (b ? grp.brk : grp.ok).push(e); });
  var gs = function (a) { return { n: a.length, depth: ddMed(a.map(function (e) { return e.depth; })), worst: a.length ? Math.min.apply(null, a.map(function (e) { return e.depth; })) : null, days: ddMed(a.filter(function (e) { return e.i1 != null; }).map(function (e) { return Math.round((rows[e.i1].t - rows[e.ip].t) / 86400e3); })) }; };
  var opp = ddOpp(rows, E, tailTh);
  var prof = DD_PROF.map(function (p) { var b = ddBacktest(rows, E, stages, p.w); b.id = p.id; b.name = p.n; b.w = p.w; b.desc = p.d;
    b.opp = ddBtAgg(b.rows.filter(function (x) { return x.e.depth <= tailTh + 1e-9; }), stages.length); b.rest = ddBtAgg(b.rows.filter(function (x) { return x.e.depth > tailTh + 1e-9; }), stages.length); return b; });
  /* 비교용: 기회 구간에 닿았을 때만 한 번에 다 샀다면 */
  var lump = { n: opp.n, inv: 1, worstMed: opp.more.med, worst: opp.more.worst, r1Med: opp.st.r1.med, r1Mean: opp.st.r1.mean, r1Worst: opp.st.r1.worst, r1Best: opp.st.r1.best, posN: opp.st.r1.pos || 0, n1: opp.st.r1.n, r3Med: opp.st.r3.med, r3Worst: opp.st.r3.worst, pos3N: opp.st.r3.pos || 0, n3: opp.st.r3.n };
  /* 지금 깊이까지 간 사건 비율 · 지금 단계 */
  var deepNow = open ? open.depth : cur, share = R.n ? R.sorted.filter(function (x) { return x <= deepNow + 1e-9; }).length / R.n : null;
  var stNow = 0, stMax = 0; stages.forEach(function (s) { if (cur <= s.d + 1e-9) stNow = s.k; if (open && open.depth <= s.d + 1e-9) stMax = s.k; });
  return { sym: sym, name: ddName(sym), S: S, rows: rows, E: E, A: A, R: R, RA: RA, stages: stages, ent: ent, Y: Y, tail: tail, tailTh: tailTh, opp: opp, lump: lump, inOpp: !!(open && open.depth <= tailTh + 1e-9), grp: { brk: gs(grp.brk), ok: gs(grp.ok) }, prof: prof,
    last: last, cur: cur, curAth: curAth, open: open, openPk: open ? rows[open.ip] : rows[E.hiIdx[n - 1]], deepNow: deepNow, share: share, stNow: stNow, stMax: stMax, w200: w200[n - 1], from: rows[0].t, yrs: (last.t - rows[0].t) / (365.25 * 86400e3), ctxNow: open ? ddContext(rows, open) : null };
}
function ddGet(sym) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || !rows.length) return null;
  var L = DD_LEV[sym], u = L && nbHist[L[0]], key = sym + ":" + rows.length + ":" + rows[rows.length - 1].t + ":" + (u ? u.length : 0) + ":" + ((typeof MAC !== "undefined" && MAC.doc) ? 1 : 0);
  if (DD.memo[key] === undefined) { try { DD.memo[key] = ddAnalyze(sym); } catch (e) { console.warn("dd", e); DD.memo[key] = null; } }
  return DD.memo[key];
}
function ddEnsure(sym) {
  var L = DD_LEV[sym], list = [sym].concat(L ? [L[0]] : []);
  var p1 = typeof nbLoad === "function" ? nbLoad(list) : Promise.resolve(), p2 = L && typeof macroEnsure === "function" ? macroEnsure().catch(function () {}) : Promise.resolve();
  return Promise.all([p1, p2]).then(function () { return ddGet(sym); });
}

/* ============================================================
   화면 · 슬라이드
   ============================================================ */
function ddPrefs() { var o = {}; try { o = JSON.parse(localStorage.getItem("sm.dd") || "{}") || {}; } catch (e) {} return { prof: o.prof || "mid", loss: o.loss > 0 ? +o.loss : 10, brand: o.brand != null && o.brand !== "겨울잠 리서치" ? String(o.brand) : "우상향연구소" }; }
function ddSave(k, v) { var o = ddPrefs(); o[k] = v; try { localStorage.setItem("sm.dd", JSON.stringify(o)); } catch (e) {} }
/* 낙폭 곡선 (52주 고점 대비) */
function ddSvgDD(A, W, H, o) {
  o = o || {}; var rows = A.rows, dd = A.E.dd, n = rows.length, L = 46, R = 8, T = o.top || 26, B = 22, w = W - L - R, h = H - T - B, B2 = Math.min(900, n), per = n / B2, pts = [], i;
  var lo = Math.min(-0.2, Math.floor(Math.min.apply(null, A.R.sorted.concat([A.cur])) * 10 - 0.001) / 10), X = function (k) { return L + (k / (n - 1)) * w; }, Yv = function (v) { return T + (v / lo) * h; };
  for (i = 0; i < B2; i++) { var a = Math.floor(i * per), b = Math.min(n, Math.floor((i + 1) * per) || a + 1), m = 0, mi = a; for (var j = a; j < b; j++) if (dd[j] <= m) { m = dd[j]; mi = j; } pts.push(X(mi).toFixed(1) + "," + Yv(m).toFixed(1)); }
  var fg = o.fg || "#0f2240", sub = o.sub || "#6b7686", g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ddSvg" role="img" aria-label="52주 고점 대비 낙폭">';
  if (o.bare) { var bp = []; for (i = 0; i < pts.length; i++) bp.push(pts[i]); return g + '<polygon points="' + L + ',' + Yv(0) + ' ' + bp.join(" ") + ' ' + (W - R) + ',' + Yv(0) + '" fill="' + (o.fill || fg) + '" fill-opacity="' + (o.fillOp || .14) + '"/><polyline points="' + bp.join(" ") + '" fill="none" stroke="' + fg + '" stroke-width="1.6"/></svg>'; }
  for (var v = 0; v >= lo - 1e-9; v -= 0.2) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Yv(v) + '" y2="' + Yv(v) + '" stroke="' + sub + '" stroke-opacity=".18"/><text x="' + (L - 6) + '" y="' + (Yv(v) + 4) + '" text-anchor="end" font-size="11" fill="' + sub + '">' + Math.round(v * 100) + '%</text>';
  var y0 = ddYear(rows[0].t), y1 = ddYear(rows[n - 1].t), step = Math.max(1, Math.ceil((y1 - y0) / 8)), seen = {};
  for (i = 0; i < n; i++) { var y = ddYear(rows[i].t); if (!seen[y]) { seen[y] = 1; if ((y - y0) % step === 0 && i > 0) g += '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="' + sub + '">' + y + '</text>'; } }
  g += '<polygon points="' + L + ',' + Yv(0) + ' ' + pts.join(" ") + ' ' + (W - R) + ',' + Yv(0) + '" fill="' + (o.fill || fg) + '" fill-opacity="' + (o.fillOp || .14) + '"/><polyline points="' + pts.join(" ") + '" fill="none" stroke="' + fg + '" stroke-width="1.2"/>';
  if (A.S.synth) { var sx = X(A.S.synth.days); g += '<line x1="' + sx + '" x2="' + sx + '" y1="' + T + '" y2="' + (T + h) + '" stroke="' + sub + '" stroke-dasharray="3 3"/><text x="' + (sx - 5) + '" y="' + (T + h - 5) + '" text-anchor="end" font-size="10.5" fill="' + sub + '">← 역산 | 실제 →</text>'; }
  var line = o.line != null ? o.line : (A.stages[3] ? A.stages[3].d : null);
  if (line != null && line >= lo) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Yv(line) + '" y2="' + Yv(line) + '" stroke="' + (o.lineCol || "#d6453d") + '" stroke-width="1.6"/><text x="' + (L + 6) + '" y="' + (Yv(line) - 5) + '" font-size="11" font-weight="700" fill="' + (o.hi || "#b9600f") + '">' + Math.round(line * 100) + '%' + (o.lineLab != null ? o.lineLab : " (4단계)") + '</text>';
  /* 깊은 사건에 이름표 — 글자 폭을 어림해 겹치면 연도만, 그래도 겹치면 생략 (진행 중 · 깊은 순으로 먼저 자리 잡음) */
  var est = function (t) { var w = 0; for (var q = 0; q < t.length; q++) w += /[ㄱ-힝]/.test(t[q]) ? 10.8 : 6.2; return w + 6; }, placed = [], free = function (a, b) { return placed.every(function (p) { return b < p[0] - 6 || a > p[1] + 6; }); };
  A.tail.slice().sort(function (a, b) { return (b.open ? 1 : 0) - (a.open ? 1 : 0) || a.depth - b.depth; }).slice(0, 8).forEach(function (t) {
    var x = X(t.e.it), yy = "’" + String(ddYear(t.tr)).slice(2), nm = t.open ? "현재" : "", pct = Math.round(t.depth * 100) + "%";
    if (!t.open && t.ctx.names.length) { nm = t.ctx.names.slice().sort(function (a, b) { return a.length - b.length; })[0]; if (nm.length > 9) nm = nm.slice(0, 8) + "…"; }
    var tries = nm ? [yy + " " + nm, yy] : [yy], done = false;
    tries.forEach(function (txt) { if (done) return; var w = Math.max(est(txt), est(pct)), cx = Math.min(W - R - w / 2, Math.max(L + w / 2, x)); if (!free(cx - w / 2, cx + w / 2)) return; done = true; placed.push([cx - w / 2, cx + w / 2]);
      g += '<text x="' + cx.toFixed(1) + '" y="11" text-anchor="middle" font-size="10.5" font-weight="700" fill="' + fg + '">' + ddEsc(txt) + '</text><text x="' + cx.toFixed(1) + '" y="23" text-anchor="middle" font-size="10.5" fill="' + (o.hi || "#b9600f") + '">' + pct + '</text>'; });
  });
  return g + '</svg>';
}
/* 도달 분포 막대 */
function ddSvgReach(A, W, H, o) {
  o = o || {}; var th = A.R.th, ra = A.RA.th, rowH = (H - 6) / th.length, L = 48, fg = o.fg || "#0f2240", sub = o.sub || "#6b7686", g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ddSvg" role="img" aria-label="도달 분포">';
  th.forEach(function (t, k) { var y = 3 + k * rowH, bw = (W - L - 58), bh = Math.max(5, rowH * 0.3), p = t.p || 0, q = (ra[k] && ra[k].p) || 0;
    g += '<text x="' + (L - 8) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end" font-size="12.5" font-weight="700" fill="' + fg + '">' + Math.round(t.th * 100) + '%</text>' +
      '<rect x="' + L + '" y="' + (y + rowH / 2 - bh - 1) + '" width="' + Math.max(1, bw * p) + '" height="' + bh + '" fill="' + fg + '"/><text x="' + (L + bw * p + 6) + '" y="' + (y + rowH / 2 - 2) + '" font-size="11" font-weight="700" fill="' + fg + '">' + (p * 100).toFixed(1) + '%</text>' +
      (A.RA.n ? '<rect x="' + L + '" y="' + (y + rowH / 2 + 1) + '" width="' + Math.max(1, bw * q) + '" height="' + bh + '" fill="' + (o.c2 || "#a9bfe0") + '"/><text x="' + (L + bw * q + 6) + '" y="' + (y + rowH / 2 + bh + 1) + '" font-size="10.5" fill="' + sub + '">' + (q * 100).toFixed(1) + '%</text>' : ''); });
  return g + '</svg>';
}
/* 연도별 연초 대비 최저 */
function ddSvgYtd(A, W, H, o) {
  o = o || {}; var ys = A.Y.yrs, n = ys.length, L = 44, T = 8, B = 22, w = W - L - 6, h = H - T - B, lo = Math.min(-0.2, Math.floor(Math.min.apply(null, ys.map(function (y) { return y.low; })) * 10 - 0.001) / 10), fg = o.fg || "#0f2240", sub = o.sub || "#6b7686", bw = w / n, g = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ddSvg" role="img" aria-label="연도별 연초 대비 최저">';
  for (var v = 0; v >= lo - 1e-9; v -= 0.2) g += '<line x1="' + L + '" x2="' + (W - 6) + '" y1="' + (T + v / lo * h) + '" y2="' + (T + v / lo * h) + '" stroke="' + sub + '" stroke-opacity=".18"/><text x="' + (L - 6) + '" y="' + (T + v / lo * h + 4) + '" text-anchor="end" font-size="11" fill="' + sub + '">' + Math.round(v * 100) + '%</text>';
  var step = Math.max(1, Math.ceil(n / 13));
  ys.forEach(function (y, k) { var hh = Math.max(0, Math.min(0, y.low) / lo * h), x = L + k * bw; g += '<rect x="' + (x + bw * 0.14) + '" y="' + T + '" width="' + (bw * 0.72) + '" height="' + hh + '" fill="' + (y.cur ? (o.cNow || "#d9822b") : y.low <= -0.5 ? fg : (o.c2 || "#a9bfe0")) + '"><title>' + y.y + '년 ' + ddPct(y.low) + '</title></rect>' + (k % step === 0 || y.cur ? '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10.5" fill="' + sub + '">’' + String(y.y).slice(2) + '</text>' : ''); });
  return g + '</svg>';
}
function ddPeriod(pk, tr, open) { return ddYm(pk) + " → " + (open ? "진행 중" : ddYm(tr)); }
function ddBg(t) { return t.open && !t.ctx.names.length ? "–" : (t.ctx.names.length ? t.ctx.names.slice(0, 2).join(" · ") : "목록에 해당 이벤트 없음"); }
/* 한 줄 결론들 */
function ddRange(hs) { var a = hs.map(function (h) { return h.r1; }), lo = Math.min.apply(null, a), hi = Math.max.apply(null, a); return a.length > 1 ? ddPct(lo, 0) + " ~ " + ddPct(hi, 0) : ddPct(lo, 0); }
function ddYrs(hs) { return hs.map(function (h) { return ddYear(h.pk); }).join(" · "); }
function ddPoints(A) {
  var R = A.R, p = [], O = A.opp, th = ddPct(A.tailTh, 0), s1 = O.st.r1, s3 = O.st.r3;
  p.push(th + "에 닿은 하락은 " + A.yrs.toFixed(0) + "년간 " + O.n + "번 (전체 " + R.n + "건의 " + Math.round(O.n / R.n * 100) + "%) — 절반은 " + ddPct(R.med, 0) + "에서 멈추는 종목이에요");
  if (s1.n) p.push(th + "에 처음 닿은 날 샀다면 1년 뒤: " + s1.n + "번 중 " + s1.pos + "번 플러스" + (O.win.length ? " (" + ddRange(O.win) + ")" : "") + (O.fail.length ? ", " + O.fail.length + "번 마이너스 (" + ddYrs(O.fail) + "년 고점 · " + O.fail.map(function (h) { return ddPct(h.r1, 0); }).join(" · ") + ")" : ""));
  var hd = ddHold(A); if (hd[0]) p.push(hd[0]); else if (O.lo1.n) p.push("닿은 뒤에도 더 빠졌어요 — 산 뒤 1년 안 최저 중앙값 " + ddPct(O.lo1.med, 0) + ", 최악 " + ddPct(O.lo1.worst, 0));
  var t5 = R.th.filter(function (x) { return x.th === -0.5; })[0], t6 = R.th.filter(function (x) { return x.th === -0.6; })[0];
  if (t5 && t5.c >= 3 && t6 && t5.c === t6.c) p.push("-50%를 넘긴 하락 " + t5.c + "건은 예외 없이 -60% 이상까지 갔어요");
  if (A.grp.brk.n && A.grp.ok.n) p.push("200주선을 깬 사건(" + A.grp.brk.n + "건)의 최대 낙폭 중앙값 " + ddPct(A.grp.brk.depth, 0) + " vs 안 깬 사건(" + A.grp.ok.n + "건) " + ddPct(A.grp.ok.depth, 0));
  return p;
}
function ddNm(A) { return /[가-힣]/.test(A.name) && !/\(/.test(A.name) && !DD_LEV[A.sym] ? A.name : A.sym.replace(/\.K[SQ]$/, ""); }
function ddHead(A) {
  var sh = A.share, nm = ddNm(A);
  if (!A.open) return nm + " · 지금은 52주 고점 근처입니다 (하락 사건 아님)";
  if (A.inOpp) return nm + " · 지금은 드문 기회 구간(" + ddPct(A.tailTh, 0) + " 이하) — " + A.yrs.toFixed(0) + "년간 " + A.opp.n + "번째입니다";
  if (A.cur > A.tailTh) { var gap = (1 + A.tailTh) / (1 + A.cur) - 1; if (sh != null && sh <= 0.5) return nm + " · 깊은 쪽 " + Math.max(1, Math.round(sh * 100)) + "% 구간 — 기회 구간(" + ddPct(A.tailTh, 0) + ")까지는 " + ddPct(gap, 0) + " 더 남았습니다"; }
  if (sh != null && sh <= 0.5) return nm + " · 이번 하락은 " + A.yrs.toFixed(0) + "년 역사에서 깊은 쪽 " + Math.max(1, Math.round(sh * 100)) + "% 구간입니다";
  return nm + " · 이번 하락(" + ddPct(A.deepNow, 0) + ")은 흔한 깊이입니다 — 사건의 " + Math.round((sh || 0) * 100) + "%가 여기까지 왔습니다";
}
function ddKpis(A) {
  var y = A.Y.cur, k = [];
  k.push({ v: ddPct(A.cur), l: "52주 고점 대비", s: "고점 " + ddYmd(A.openPk.t) + " · " + ddPx(A.sym, A.openPk.c) + (A.open && A.open.depth < A.cur - 0.005 ? " · 이번 최저 " + ddPct(A.open.depth) : "") });
  if (A.open) k.push({ v: A.share == null ? "–" : (A.share * 100).toFixed(1) + "%", l: "이번 깊이(" + ddPct(A.deepNow, 0) + ")까지 간 사건", s: A.R.n + "건 중 " + Math.round((A.share || 0) * A.R.n) + "건" });
  else k.push({ v: A.R.n + "건", l: "지금까지의 하락 사건", s: "중앙값 " + ddPct(A.R.med, 0) + " · 가장 깊었던 것 " + ddPct(A.R.worst, 0) });
  k.push({ v: y ? ddPct(y.end) : "–", l: "연초 대비", s: y ? "연중 최저 " + ddPct(y.low) + " · " + ddYmd(y.lowT).slice(5) : "" });
  k.push({ v: A.stNow ? A.stNow + "단계" : "해당 없음", l: "지금 매수 단계", s: A.stMax > A.stNow ? "이번 하락에서 " + A.stMax + "단계까지 닿았음" : A.stages[A.stNow] ? "다음 " + (A.stNow + 1) + "단계 " + ddPct(A.stages[A.stNow].d, 0) : "가장 깊은 단계" });
  return k;
}
function ddConflict(A) { var y = A.Y.cur; if (!y) return null; if (A.cur <= -0.2 && y.end > 0) return "전고점 대비로는 " + ddPct(A.cur, 0) + "인데 연초 대비로는 " + ddPct(y.end, 0) + "예요 — 올해 크게 오른 뒤 빠진 경우라 연초 기준만 보면 매수 단계가 열리지 않아요. 전고점 기준을 같이 봐야 해요."; if (A.cur > -0.1 && y.end <= -0.15) return "연초 대비로는 " + ddPct(y.end, 0) + "인데 52주 고점 대비로는 " + ddPct(A.cur, 0) + "예요 — 작년 말이 높았던 경우예요."; return null; }
function ddCap(A, pr, loss) { var one = A.R.worst ? loss / 100 / Math.abs(A.R.worst) : null, st = pr && pr.worst ? loss / 100 / Math.abs(pr.worst) : null; return { one: one, st: st }; }

function ddBackTxt(h) { if (h.back == null) return h.open ? "진행 중" : "아직 못 함"; if (h.back === 0) return "바로"; return h.back < 60 ? h.back + "일" : h.back < 730 ? Math.round(h.back / 30.4) + "개월" : (h.back / 365.25).toFixed(1) + "년"; }
function ddDays(d) { return d == null ? "" : d === 0 ? "당일" : d < 60 ? d + "일 뒤" : Math.round(d / 30.4) + "개월 뒤"; }
/* 칸: 0 고점 · 1 닿은 날 · 2 닿은 가격 · 3 산 뒤 1년 안 최저 · 4 1년 안 최고 · 5 큰 급락 횟수 · 6 하루 최대 등락 · 7 6개월 후 · 8 1년 후 · 9 본전 회복 · 10 배경 */
function ddOppRows(A, sg) {
  var O = A.opp, c = function (v) { return v == null ? "–" : sg(v); }, sm = function (t) { return t ? ' <small>' + t + '</small>' : ''; };
  var rows = O.hits.map(function (h) { var y = h.y1; return { now: h.open, cells: [ddYm(h.pk), ddYmd(h.t), ddPx(A.sym, h.c), sg(y.lo) + sm(ddDays(y.loD)) + (h.open ? sm("진행 중") : ""), y.hi > 0 ? sg(y.hi) + sm(ddDays(y.hiD)) : "–", y.drops + "번", ddPct(y.mdn, 0) + " / " + ddPct(y.mup, 0), c(h.r6), c(h.r1), ddBackTxt(h), ddEsc(h.ctx.names.slice(0, 2).join(" · ") || "–")] }; });
  var st = function (lab, f) { return { sum: 1, cells: [lab, "", "", f(O.lo1), f(O.hi1), "", "", f(O.st.r6), f(O.st.r1), "", ""] }; };
  var medRow = st("중앙값", function (x) { return x.n ? sg(x.med) : "–"; }); medRow.cells[5] = O.drops.n ? O.drops.med + "번" : "–"; medRow.cells[9] = O.back != null ? ddBackTxt({ back: Math.round(O.back) }) : ""; rows.push(medRow);
  rows.push({ sum: 1, cells: ["플러스였던 횟수", "", "", "", "", "", "", O.st.r6.n ? O.st.r6.pos + " / " + O.st.r6.n : "–", O.st.r1.n ? O.st.r1.pos + " / " + O.st.r1.n : "–", "", ""] });
  return rows;
}
/* 버티는 힘: 플러스로 끝난 사건도 산 뒤 얼마나 흔들렸는지 */
function ddHold(A) {
  var O = A.opp, a = "", b = "", thr = Math.round(O.thr * 100);
  if (O.win.length) a = "1년 뒤 플러스였던 " + O.win.length + "번도 산 뒤 최대 " + ddPct(O.winLo.worst, 0) + "까지 더 빠졌고(중앙값 " + ddPct(O.winLo.med, 0) + "), 1년 안에 -" + thr + "% 넘는 급락을 " + (O.winDrops.best === O.winDrops.worst ? O.winDrops.best : O.winDrops.worst + "~" + O.winDrops.best) + "번 겪었습니다. 그래도 1년 뒤 " + ddRange(O.win) + ".";
  if (O.fail.length) b = "버텨도 안 됐던 " + O.fail.length + "번(" + ddYrs(O.fail) + "년 고점)은 산 뒤 " + O.fail.map(function (h) { return ddPct(h.y1.lo, 0); }).join(" · ") + "까지 더 빠졌습니다 — 그래서 한 종목에 넣는 돈의 상한이 버티는 힘의 전제입니다.";
  return [a, b];
}
function ddOppRead(A) {
  var O = A.opp, t = []; if (!O.n) return "";
  t.push("닿은 날이 바닥은 아니에요 — \"산 뒤 1년 안 최저\"가 산 뒤에 더 견뎌야 했던 깊이, \"큰 급락 횟수\"는 1년 안에 고점에서 -" + Math.round(O.thr * 100) + "% 넘게 다시 내려온 횟수예요.");
  if (O.fail.length) t.push("1년 뒤 마이너스였던 " + O.fail.length + "번(" + ddYrs(O.fail) + "년 고점)은 " + O.fail.map(function (h) { return h.ctx.names.length ? h.ctx.names[0] : h.ctx.shape; }).join(", ") + " 때였어요. 같은 깊이라도 배경에 따라 결과가 갈렸어요.");
  t.push("평균은 큰 값 하나에 끌려가요. 중앙값 · 플러스 횟수와 같이 보세요. 표본이 " + O.n + "번뿐이라 확률이 아니라 사례로 읽어야 해요.");
  return t.join(" ");
}
function ddEntRead(A) {
  var ws = {}, t = []; A.ent.forEach(function (x) { if (x.worstT != null) ws[ddYear(x.worstT)] = (ws[ddYear(x.worstT)] || 0) + 1; });
  var top = Object.keys(ws).sort(function (a, b) { return ws[b] - ws[a]; }).slice(0, 2);
  if (top.length) t.push("\"1년 후 최악\"이 깊이와 상관없이 비슷한 건 같은 사건(" + top.join(" · ") + "년 고점에서 시작한 하락) 때문이에요 — 그 하락은 어느 깊이에서 사도 1년 뒤 크게 마이너스였어요.");
  var few = A.ent.filter(function (x) { return x.n1 < 3; }); if (few.length) t.push(few.map(function (x) { return Math.round(x.th * 100) + "%"; }).join(" · ") + " 줄은 1년 뒤를 볼 수 있는 사건이 3건 미만이라 참고만 하세요.");
  t.push("색칠한 줄이 드문 기회 구간(" + ddPct(A.tailTh, 0) + ")이에요.");
  return t.join(" ");
}
function ddHtml(sym) {
  var A = ddGet(sym); if (!A) return '<div class="briefDim">낙폭 분석을 할 만큼 시세가 길지 않아요 (300거래일 이상 필요).</div>';
  if (A.none) return '<div class="briefDim">기록 기간 동안 52주 고점에서 -10% 넘게 빠진 적이 없어요.</div>';
  var P = ddPrefs(), pr = A.prof.filter(function (x) { return x.id === P.prof; })[0] || A.prof[1], cap = ddCap(A, pr, P.loss), k = ddKpis(A), cf = ddConflict(A), h = '';
  h += '<div class="egBox ddBox"><div class="ddTop"><div><div class="ddHd">' + ddEsc(ddHead(A)) + '</div><div class="briefDim">' + ddYmd(A.from) + ' ~ ' + ddYmd(A.last.t) + ' · ' + A.yrs.toFixed(1) + '년 · 종가 기준' + (A.S.synth ? ' · 앞 ' + (A.S.synth.days / 252).toFixed(1) + '년은 ' + A.S.synth.under + '×' + A.S.synth.lev + ' 역산' : '') + '</div></div><button class="primary" data-dddeck>슬라이드 자료 보기</button></div>';
  h += '<div class="ddKs">' + k.map(function (x, i) { return '<div class="ddK' + (i === 0 && A.cur <= -0.2 ? " dn" : "") + '"><b>' + ddEsc(x.v) + '</b><span>' + ddEsc(x.l) + '</span><small>' + ddEsc(x.s) + '</small></div>'; }).join("") + '</div>';
  if (cf) h += '<div class="ddWarn"><b>두 기준이 다르게 말해요</b> ' + ddEsc(cf) + '</div>';
  try { var V = typeof egVerify === "function" ? egVerify(sym) : null; if (V && V.level === "bad") h += '<div class="ddWarn"><b>자료 검증 실패 ' + V.bad + '건</b> 시세에 문제가 있을 수 있어요(검증 탭 참고). 아래 숫자는 그대로 보여 드리니 흐름 참고용으로 보세요.</div>'; } catch (e) {}
  if (A.R.n < 10) h += '<div class="ddWarn"><b>사건이 ' + A.R.n + '건뿐이에요</b> 백분위와 단계는 거친 값이에요. 참고만 하세요.</div>';
  h += '<ol class="ddPts">' + ddPoints(A).map(function (p) { return '<li>' + ddEsc(p) + '</li>'; }).join("") + '</ol></div>';
  var O = A.opp, sgH = function (v) { return '<b class="' + (v > 0 ? "ddUp" : v < 0 ? "ddDn" : "") + '">' + ddPct(v) + '</b>'; };
  if (O.n) { var gapO = A.cur > A.tailTh ? (1 + A.tailTh) / (1 + A.cur) - 1 : null, hitNow = O.hits.filter(function (x) { return x.open; })[0];
    h += '<div class="egBox ddBox ddOpp"><div class="egH">드문 기회 구간 — 52주 고점 대비 ' + ddPct(A.tailTh, 0) + ' 이하 · ' + A.yrs.toFixed(0) + '년간 ' + O.n + '번 <small>사건의 약 10%만 닿은 깊이를 10%p 단위로 잡았어요. 그 깊이에 처음 닿은 날 종가에 샀다고 보고 그 뒤를 기간별로 따라갔어요. 1년 = 252거래일.</small></div>' +
      '<div class="ddWarn ddNowL"><b>지금</b> ' + (hitNow ? ddYmd(hitNow.t) + '에 ' + ddPct(A.tailTh, 0) + '에 닿았어요 (' + ddPx(A.sym, hitNow.c) + '). 그 뒤 가장 낮았던 값은 닿은 가격 대비 ' + ddPct(hitNow.more) + ', 지금은 52주 고점 대비 ' + ddPct(A.cur) + '.' : gapO != null ? '52주 고점 대비 ' + ddPct(A.cur) + ' — 기회 구간 가격(' + ddPx(A.sym, A.openPk.c * (1 + A.tailTh)) + ')까지 ' + ddPct(gapO, 0) + ' 남았어요.' : '기회 구간 안이에요.') + '</div>' +
      '<div class="ddKs"><div class="ddK"><b>' + (O.st.r1.n ? O.st.r1.pos + " / " + O.st.r1.n + "번" : "–") + '</b><span>1년 후 플러스</span><small>' + (O.win.length ? "플러스일 때 " + ddRange(O.win) : "") + '</small></div><div class="ddK"><b>' + ddPct(O.st.r1.med, 0) + '</b><span>1년 후 중앙값</span><small>평균 ' + ddPct(O.st.r1.mean, 0) + ' · 최악 ' + ddPct(O.st.r1.worst, 0) + '</small></div><div class="ddK"><b>' + ddPct(O.lo1.med, 0) + '</b><span>산 뒤 1년 안 최저 (중앙값)</span><small>최악 ' + ddPct(O.lo1.worst, 0) + '</small></div><div class="ddK"><b>' + (O.hi1.n ? ddPct(O.hi1.med, 0) : "–") + '</b><span>산 뒤 1년 안 최고 (중앙값)</span><small>' + (O.drops.n ? "-" + Math.round(O.thr * 100) + "% 넘는 급락 중앙값 " + O.drops.med + "번" : "") + '</small></div></div>' +
      '<div class="dxWrap"><table class="dgT"><thead><tr><th>고점</th><th>' + ddPct(A.tailTh, 0) + ' 닿은 날</th><th>닿은 가격</th><th>산 뒤 1년 안 최저</th><th>1년 안 최고</th><th>-' + Math.round(O.thr * 100) + '% 넘는 급락</th><th>하루 최대 하락 / 상승</th><th>6개월 후</th><th>1년 후</th><th>본전 회복까지</th><th>배경 (앱 이벤트)</th></tr></thead><tbody>' + ddOppRows(A, sgH).map(function (r) { return '<tr class="' + (r.now ? "ddNow" : r.sum ? "ddSumR" : "") + '">' + r.cells.map(function (c, i) { return '<td>' + (r.sum && i === 0 ? '<b>' + c + '</b>' : c) + '</td>'; }).join("") + '</tr>'; }).join("") + '</tbody></table></div>' +
      (ddHold(A)[0] || ddHold(A)[1] ? '<div class="ddHold"><b>버티는 힘</b>' + ddHold(A).filter(Boolean).map(function (x) { return '<p>' + ddEsc(x) + '</p>'; }).join("") + '</div>' : '') +
      '<div class="ddMini"><b>읽는 법</b> ' + ddEsc(ddOppRead(A)) + '</div></div>'; }
  if (A.S.synth) { var sy = A.S.synth;
    h += '<div class="egBox ddBox"><div class="egH">상장 전 ' + (sy.days / 252).toFixed(1) + '년은 ' + sy.under + ' 일간수익률로 역산했어요 <small>' + sy.under + ' 일간수익률 × ' + sy.lev + ' − 하루 비용. 비용 = 연 ' + (sy.fee * 100).toFixed(2) + '%(실제 구간에 맞춰 추정 · 배당 효과 포함) + 미국 기준금리 × ' + sy.borrow.toFixed(2) + '. ' + ddYmd(sy.to) + '부터는 실제 시세예요. ' + sy.under + ' 기록은 ' + ddYmd(sy.from) + '부터 있어요.' + (sy.noRate ? ' 기준금리 자료가 없는 구간은 금리 0으로 계산했어요.' : '') + '</small></div>' +
      '<div class="ddSyn"><div class="ddK"><b>' + (sy.corr == null ? "–" : sy.corr.toFixed(3)) + '</b><span>일간수익률 상관계수</span><small>겹치는 ' + sy.n + '일</small></div><div class="ddK"><b>' + (sy.maxErr * 100).toFixed(1) + '%p</b><span>연중 MDD 최대 오차</span><small>실제 구간을 역산으로 다시 만들어 비교</small></div>' +
      '<div class="dxWrap"><table class="dgT"><thead><tr><th>연중 MDD</th><th>실제</th><th>역산</th><th>오차</th></tr></thead><tbody>' + sy.years.map(function (y) { return '<tr><td>' + y.y + '</td><td>' + ddPct(y.act) + '</td><td>' + ddPct(y.syn) + '</td><td>' + (y.err * 100).toFixed(1) + '%p</td></tr>'; }).join("") + '</tbody></table></div></div></div>'; }
  else if (A.S.synthWhy) h += '<div class="ddWarn"><b>역산 없이 실제 시세만 썼어요</b> ' + ddEsc(A.S.synthWhy) + '</div>';
  h += '<div class="egBox ddBox"><div class="egH">52주 고점 대비 낙폭 <small>최근 252거래일 종가 최고점에서 얼마나 내려와 있었는지. 빨간 선은 4단계(사건의 10%만 닿은 깊이).</small></div>' + ddSvgDD(A, 920, 300) + '</div>';
  h += '<div class="egBox ddBox"><div class="egH">어디까지 빠졌나 — 도달 분포 <small>남색 = 52주 고점 기준 ' + A.R.n + '건' + (A.RA.n ? ' · 하늘색 = 사상최고가 기준 ' + A.RA.n + '건' + (A.S.synth ? '(실제 시세만)' : '') : '') + '</small></div><div class="ddTwo"><div>' + ddSvgReach(A, 560, 300) + '</div><div class="ddSide"><b>분포 백분위 (52주 기준)</b>' +
    [["중앙값", A.R.med], ["하위 25%", A.R.p25], ["하위 10%", A.R.p10], ["하위 5%", A.R.p05], ["가장 깊었던 것", A.R.worst]].map(function (x) { return '<div><span>' + x[0] + '</span><em>' + ddPct(x[1], 0) + '</em></div>'; }).join("") + '</div></div></div>';
  h += '<div class="egBox ddBox"><div class="egH">' + Math.round(A.tailTh * 100) + '%보다 깊었던 ' + A.tail.length + '번 — 배경과 그 뒤 <small>배경은 앱의 주요 이벤트 목록에서 그 기간에 있던 것. 모양: 고점→저점 100일 이하 = 급락형, 1년 이상 = 장기 하락형. 1년 후 = 그 깊이에 처음 닿은 날 종가에서 252거래일 뒤.</small></div><div class="dxWrap"><table class="dgT"><thead><tr><th>하락 구간</th><th>최대 낙폭</th><th>고점→저점</th><th>' + Math.round(A.tailTh * 100) + '% 닿은 날</th><th>그 뒤 추가 하락</th><th>1년 후</th><th>200주선</th><th>모양</th><th>배경 (앱 이벤트)</th></tr></thead><tbody>' +
    A.tail.map(function (t) { return '<tr' + (t.open ? ' class="ddNow"' : '') + '><td>' + ddPeriod(t.pk, t.tr, t.open) + '</td><td><b>' + ddPct(t.depth) + '</b></td><td>' + t.ctx.days + '일</td><td>' + (t.hit ? ddYmd(t.hit.t) : "–") + '</td><td>' + (t.hit && !t.open ? ddPct(t.hit.more) : t.hit ? ddPct(t.hit.more) + " (진행 중)" : "–") + '</td><td>' + (t.hit && t.hit.r1 != null ? '<b class="' + (t.hit.r1 > 0 ? "ddUp" : "ddDn") + '">' + ddPct(t.hit.r1) + '</b>' : "–") + '</td><td>' + (t.brk ? "이탈" : "지킴") + '</td><td>' + (t.open ? "판단 대기" : t.ctx.shape) + '</td><td>' + ddEsc(ddBg(t)) + '</td></tr>'; }).join("") + '</tbody></table></div>' +
    (A.grp.brk.n || A.grp.ok.n ? '<div class="ddMini"><b>200주선을 깼는가로 나누면</b> (-20% 넘게 빠진 사건) — 깬 사건 ' + A.grp.brk.n + '건: 최대 낙폭 중앙값 ' + ddPct(A.grp.brk.depth, 0) + ', 고점 회복까지 중앙값 ' + (A.grp.brk.days == null ? "–" : A.grp.brk.days + "일") + ' / 안 깬 사건 ' + A.grp.ok.n + '건: ' + ddPct(A.grp.ok.depth, 0) + ', ' + (A.grp.ok.days == null ? "–" : A.grp.ok.days + "일") + '</div>' : '') + '</div>';
  h += '<div class="egBox ddBox"><div class="egH">깊이별 비교 — 얕게 샀을 때와 깊게 샀을 때 <small>52주 고점 대비 -N%에 처음 닿은 날 종가에 샀을 때. 1년 = 252거래일. 같은 사건이 여러 줄에 들어가요(-80%까지 간 사건은 -20% 줄에도 있어요).</small></div><div class="dxWrap"><table class="dgT"><thead><tr><th>처음 닿은 깊이</th><th>사건 수</th><th>그 뒤 추가 하락 (중앙값)</th><th>1년 후 중앙값</th><th>1년 후 평균</th><th>1년 후 플러스</th><th>1년 후 최악 (고점 연도)</th><th>1년 후 최고 (고점 연도)</th></tr></thead><tbody>' +
    A.ent.map(function (x) { return '<tr' + (Math.abs(x.th - A.tailTh) < 1e-9 ? ' class="ddNow"' : '') + '><td><b>' + Math.round(x.th * 100) + '%</b></td><td>' + x.n + '</td><td>' + ddPct(x.more) + '</td><td>' + sgH(x.r1) + '</td><td>' + ddPct(x.mean) + '</td><td>' + (x.pos == null ? "–" : Math.round(x.pos * x.n1) + " / " + x.n1) + '</td><td>' + ddPct(x.worst) + (x.worstT != null ? ' (' + ddYear(x.worstT) + ')' : '') + '</td><td>' + ddPct(x.best) + (x.bestT != null ? ' (' + ddYear(x.bestT) + ')' : '') + '</td></tr>'; }).join("") + '</tbody></table></div><div class="ddMini"><b>읽는 법</b> ' + ddEsc(ddEntRead(A)) + '</div></div>';
  var Y = A.Y;
  h += '<div class="egBox ddBox"><div class="egH">연초 대비 — 해마다 어디까지 빠졌나 <small>막대 = 그해 가장 낮았던 종가 ÷ 전년 마지막 종가 − 1. 남색 = -50% 이하, 주황 = 올해(진행 중). 표본 ' + (Y.from || "") + '~' + (Y.to || "") + ' ' + Y.done + '개 해.</small></div>' + ddSvgYtd(A, 920, 220) +
    '<div class="ddTwo"><div class="dxWrap"><table class="dgT"><thead><tr><th>연초 대비</th><th>도달한 해</th><th>확률</th><th>그해 연말 플러스</th></tr></thead><tbody>' + Y.tab.filter(function (x) { return x.c > 0; }).map(function (x) { return '<tr><td><b>' + Math.round(x.th * 100) + '%</b></td><td>' + x.c + '년</td><td>' + (x.p * 100).toFixed(1) + '%</td><td>' + x.pos + ' / ' + x.c + '</td></tr>'; }).join("") + '</tbody></table></div>' +
    '<div class="ddSide"><b>가장 깊었던 해와 다음 해</b>' + Y.deep.map(function (d) { return '<div><span>' + d.y + ' (' + ddPct(d.low, 0) + ') → ' + (d.y + 1) + '</span><em class="' + ((d.next != null ? d.next : d.nextCur) > 0 ? "ddUp" : "") + '">' + (d.next != null ? ddPct(d.next) : d.nextCur != null ? ddPct(d.nextCur) + " (진행 중)" : "–") + '</em></div>'; }).join("") + '<b style="margin-top:10px">해마다 평균</b><div><span>연초 대비 최저</span><em>' + ddPct(Y.avgLow) + '</em></div><div><span>연중 MDD</span><em>' + ddPct(Y.avgMdd) + '</em></div></div></div></div>';
  h += '<div class="egBox ddBox"><div class="egH">분포 백분위로 나눈 5단계 매수 구간 <small>이 종목 자신의 하락 사건 분포로 정한 깊이예요. 사건 도달 확률 = 과거 사건 중 그 깊이까지 간 비율. 비율은 고른 성향의 값이에요.</small></div>' +
    '<div class="ddProfSel">' + A.prof.map(function (x) { return '<button data-ddprof="' + x.id + '" class="' + (x.id === pr.id ? "on" : "") + '"><b>' + x.name + '</b><span>' + x.w.join(" · ") + '</span></button>'; }).join("") + '</div><div class="briefDim" style="margin:4px 0 8px">' + ddEsc(pr.desc) + '</div>' +
    '<div class="dxWrap"><table class="dgT"><thead><tr><th>단계</th><th>52주 고점 대비</th><th>그때 가격 (지금 고점 기준)</th><th>사건 도달 확률</th><th>비율 (' + pr.name + ')</th><th>상태</th></tr></thead><tbody>' + A.stages.map(function (s, i) { var passed = A.stMax >= s.k, now = A.stNow === s.k; return '<tr' + (now ? ' class="ddNow"' : '') + '><td><b>' + s.k + '단계</b></td><td>' + ddPct(s.d, 0) + '</td><td>' + ddPx(A.sym, A.openPk.c * (1 + s.d)) + '</td><td>' + Math.round(s.p * 100) + '% (' + s.c + '건)</td><td>' + pr.w[i] + '%</td><td>' + (now ? "지금 여기" : passed ? (A.cur <= s.d ? "통과" : "닿았다가 올라옴") : "대기") + '</td></tr>'; }).join("") + '</tbody></table></div>' +
    '<div class="ddMini"><b>현재 위치</b> 52주 고점 대비 ' + ddPct(A.cur) + ' → ' + (A.stNow ? A.stNow + "단계 구간" + (A.stages[A.stNow] ? ", 다음 " + (A.stNow + 1) + "단계는 " + ddPct(A.stages[A.stNow].d, 0) + " (" + ddPx(A.sym, A.openPk.c * (1 + A.stages[A.stNow].d)) + ")" : "") : "아직 1단계(" + ddPct(A.stages[0].d, 0) + ")에 닿지 않았어요") + '</div></div>';
  var pRow = function (nm, w, g, on, full) { return '<tr' + (on ? ' class="ddNow"' : '') + '><td><b>' + nm + '</b></td><td>' + w + '</td><td>' + (g.inv == null ? "–" : Math.round(g.inv * 100) + "%") + '</td><td>' + ddPct(g.worstMed) + ' / <b class="ddDn">' + ddPct(g.worst) + '</b></td><td>' + sgH(g.r1Med) + '</td>' + (full ? '<td>' + ddPct(g.r1Mean) + '</td>' : '') + '<td>' + ddPct(g.r1Worst) + '</td><td>' + (g.n1 ? g.posN + " / " + g.n1 : "–") + '</td>' + (full ? '<td>' + (g.n3 ? sgH(g.r3Med) : "–") + '</td><td>' + (g.n3 ? g.pos3N + " / " + g.n3 : "–") + '</td>' : '') + '</tr>'; };
  h += '<div class="egBox ddBox"><div class="egH">성향별 비율을 과거 사건에 넣어 보면 <small>이 종목에 쓰기로 한 돈을 100으로 두고, 각 단계에 처음 닿은 날 종가에 그 비율만큼 샀다고 가정. 손익은 모두 "쓰기로 한 돈 전체" 대비예요(안 쓴 돈은 현금). 1년 후 · 3년 후는 마지막 매수일 기준. 과거 결과이며 앞으로를 보장하지 않아요.</small></div>' +
    (A.opp.n ? '<div class="ddSub">드문 기회 구간(' + ddPct(A.tailTh, 0) + ')까지 간 ' + A.opp.n + '번에서</div><div class="dxWrap"><table class="dgT"><thead><tr><th>방법</th><th>단계별 비율</th><th>평균 투입</th><th>가장 아팠던 순간 (중앙값 / 최악)</th><th>1년 후 중앙값</th><th>1년 후 평균</th><th>1년 후 최악</th><th>1년 후 플러스</th><th>3년 후 중앙값</th><th>3년 후 플러스</th></tr></thead><tbody>' + A.prof.map(function (x) { return pRow(x.name, x.w.join(" · "), x.opp, x.id === pr.id, 1); }).join("") + pRow(ddPct(A.tailTh, 0) + "에서만 한 번에", "100", A.lump, 0, 1) + '</tbody></table></div>' : '') +
    '<div class="ddSub">' + (A.opp.n ? '그보다 얕게 끝난 ' + A.prof[0].rest.n + '번에서 (평소 하락)' : '모든 사건') + '</div><div class="dxWrap"><table class="dgT"><thead><tr><th>방법</th><th>단계별 비율</th><th>평균 투입</th><th>가장 아팠던 순간 (중앙값 / 최악)</th><th>1년 후 중앙값</th><th>1년 후 최악</th><th>1년 후 플러스</th></tr></thead><tbody>' + A.prof.map(function (x) { return pRow(x.name, x.w.join(" · "), A.opp.n ? x.rest : x, x.id === pr.id, 0); }).join("") + '</tbody></table></div>' +
    '<div class="ddMini"><b>읽는 법</b> 평소 하락에서는 얕은 단계에서 조금 사고 끝나므로 숫자가 작아요. 차이는 드문 기회까지 간 사건에서 나요 — 초반에 많이 사 둘수록 깊은 하락에서 아픈 순간이 커지고, 깊은 단계에 많이 남겨 둘수록 평소에는 거의 못 사요. "' + ddPct(A.tailTh, 0) + '에서만 한 번에"는 그 깊이까지 기다렸다가 전부 산 경우예요.</div>' +
    '<div class="ddCap"><label>계좌 전체에서 이 종목으로 잃어도 되는 한도 <input type="number" min="1" max="50" step="1" value="' + P.loss + '" data-ddloss> %</label><div><span>한 번에 다 샀다면 (과거 최대 낙폭 ' + ddPct(A.R.worst, 0) + ' 가정)</span><em>비중 ' + (cap.one == null ? "–" : Math.min(100, cap.one * 100).toFixed(0) + "% 이하") + '</em></div><div><span>' + pr.name + ' 비율로 나눠 샀다면 (과거 최악 ' + ddPct(pr.worst, 0) + ' 가정)</span><em>비중 ' + (cap.st == null ? "–" : Math.min(100, cap.st * 100).toFixed(0) + "% 이하") + '</em></div>' + ddMine(A) + '</div>' +
    '<div class="briefDim" style="margin-top:8px">과거 최악보다 더 나쁜 일은 언제든 생길 수 있어요. 해외주식 양도차익은 연 250만 원 공제 후 22% 과세 — 위 수익률은 모두 세전이에요. 매수 권유가 아닌 참고 자료예요.</div></div>';
  return h;
}
function ddMine(A) { try { var P = typeof egPortfolio === "function" ? egPortfolio() : null, m = P && P.pos && P.pos.filter(function (x) { return x.sym === A.sym; })[0]; return m ? '<div><span>지금 내 계좌에서 이 종목 비중</span><em>' + (m.w * 100).toFixed(1) + '%</em></div>' : ''; } catch (e) { return ''; } }

/* ---------- 슬라이드 ---------- */
var UH = { ink: "#141414", paper: "#fbf8f1", gold: "#c9a24f", gold2: "#e6c57a", warm: "#8a6a1f", line: "#e6e1d6", sub: "#5b6474", up: "#d9342b", dn: "#2f6fd6", soft: "#f3efe6" };
function uhMark(sz) { return '<svg class="uhMark" width="' + sz + '" height="' + sz + '" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#e6c57a"/><path d="M28 72 L72 28 M44 28 H72 V56" fill="none" stroke="#14161c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function uhLine() { return '<svg class="uhLine" viewBox="0 0 1152 44" preserveAspectRatio="none"><path d="M0 42 H1152" stroke="#e6e1d6" stroke-width="2" fill="none"/><path d="M0 42 H1002 L1034 32 L1056 38 L1090 20 L1108 26 L1146 2 M1130 2 H1146 L1144 18" stroke="#b8913f" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function uhSg(v, txt) { return v == null || !isFinite(v) ? '<span>' + (txt || "–") + '</span>' : '<span class="' + (v > 0 ? "up" : v < 0 ? "dn" : "") + '">' + (txt || ddPct(v)) + '</span>'; }
function ddSlides(A) {
  var P = ddPrefs(), pr = A.prof.filter(function (x) { return x.id === P.prof; })[0] || A.prof[1], cap = ddCap(A, pr, P.loss), Y = A.Y, S = [], nm = ddNm(A), sns = typeof CARD_SNS !== "undefined" ? CARD_SNS : "@uphill.lab", own = P.brand === "우상향연구소";
  var foot = (A.S.synth ? A.S.synth.under + " · " + A.sym + " 일별 종가 (~" + ddYmd(A.last.t) + "), " + ddYm(A.S.synth.to) + " 이전은 " + A.S.synth.under + "×" + A.S.synth.lev + " 역산" : A.sym + " 일별 종가 (~" + ddYmd(A.last.t) + ")") + " · " + P.brand + " 리서치";
  var band = function () { return '<header class="uhBand">' + uhMark(30) + '<b>' + ddEsc(P.brand) + '</b>' + (own ? '<em>UPHILL.LAB</em>' : '') + '<span>' + ddEsc(nm) + ' · 낙폭 리서치</span><i></i></header>'; };
  var T = function (kick, title, body, cls) { S.push('<section class="ddS ' + (cls || "") + '">' + band() + '<div class="uhHead"><small>' + kick + '</small><h2>' + title + '</h2>' + uhLine() + '</div><div class="ddSB">' + body + '</div><footer><span>' + ddEsc(foot) + '</span><b>' + (own ? ddEsc(sns) : "") + '</b></footer></section>'); };
  var tbl = function (hd, rows, hi) { return '<table class="uhT"><thead><tr>' + hd.map(function (x) { return '<th>' + x + '</th>'; }).join("") + '</tr></thead><tbody>' + rows.map(function (r, i) { return '<tr class="' + (hi && hi(i) ? "hi" : "") + '">' + r.map(function (c) { return '<td>' + c + '</td>'; }).join("") + '</tr>'; }).join("") + '</tbody></table>'; };
  var side = function (ttl, kv, note) { return '<aside class="uhSide"><b>' + ttl + '</b>' + kv.map(function (x) { return x.length === 1 ? '<b class="sub">' + x[0] + '</b>' : '<div><span>' + x[0] + '</span><em>' + x[1] + '</em></div>'; }).join("") + (note ? '<p>' + ddEsc(note) + '</p>' : '') + '</aside>'; };
  var col = { fg: UH.ink, sub: UH.sub, fill: UH.gold, fillOp: .28, lineCol: UH.up, hi: UH.warm, c2: "#d9cfb8", cNow: UH.gold, line: A.tailTh, lineLab: "" }, k = ddKpis(A), pts = ddPoints(A), hl = function (t) { return ddEsc(t).replace(/([+\-]\d[\d.,]*%)/g, '<mark>$1</mark>'); };
  /* 1 표지 */
  S.push('<section class="ddS uhCover"><div class="uhCv">' + ddSvgDD(A, 1280, 250, { bare: 1, fg: UH.gold, fill: UH.gold, fillOp: .16 }) + '</div><div class="uhCvTop">' + uhMark(46) + '<b>' + ddEsc(P.brand) + '</b>' + (own ? '<em>UPHILL.LAB</em>' : '') + '</div><small class="uhCvK">DRAWDOWN RESEARCH' + (A.S.lev ? ' · 레버리지 ETF' : '') + '</small><h1>' + ddEsc(nm) + '</h1><p>' + Math.round(A.yrs) + '년 낙폭의 역사와 매수 단계</p><span class="uhCvN">' + ddEsc(A.name) + (A.S.synth ? ' — 상장 전은 ' + A.S.synth.under + '×' + A.S.synth.lev + ' 역산' : '') + '</span><div class="uhCvM"><div><small>기준일</small><b>' + ddYmd(A.last.t) + '</b></div><div><small>분석 기간</small><b>' + ddYmd(A.from) + ' ~</b></div><div><small>하락 사건</small><b>' + A.R.n + '건</b></div><div><small>성격</small><b>참고용 · 매수 권유 아님</b></div></div></section>');
  /* 2 한 장 요약 */
  var lad = '<div class="uhMini">' + A.stages.map(function (s) { return '<div class="' + (A.stNow === s.k ? "now" : A.stMax >= s.k ? "was" : "") + '"><small>' + s.k + '단계</small><b>' + ddPct(s.d, 0) + '</b></div>'; }).join("") + '</div>';
  T("한 장 요약", ddEsc(ddHead(A)), '<div class="uhSum"><div class="uhNow"><small>지금 · 52주 고점 대비</small><b class="' + (A.cur < -0.005 ? "dn" : "") + '">' + ddPct(A.cur) + '</b><span>' + ddEsc(k[0].s) + '</span>' + k.slice(1).map(function (x) { return '<div><span>' + ddEsc(x.l) + '</span><em>' + ddEsc(x.v) + '</em><small>' + ddEsc(x.s) + '</small></div>'; }).join("") + '</div><div class="uhFind">' + pts.slice(0, 3).map(function (p, i) { return '<div><i>' + (i + 1) + '</i><p>' + hl(p) + '</p></div>'; }).join("") + '<div class="uhLadWrap"><small>매수 단계 — 이 종목 자신의 분포로 나눈 깊이</small>' + lad + '</div></div></div>');
  /* 3 계산 방법 (레버리지 역산) */
  if (A.S.synth) { var sy = A.S.synth;
    T("계산 방법", "상장 전 " + (sy.days / 252).toFixed(0) + "년은 " + sy.under + " 일간수익률로 되살렸습니다", '<div class="uhEq"><div><small>기초 ETF</small><b>' + sy.under + ' 일간수익률</b><span>' + ddYmd(sy.from) + ' ~ ' + ddYmd(sy.to) + '</span></div><i>×</i><div class="n"><b>' + sy.lev + '</b></div><i>−</i><div><small>하루 비용</small><b>연 ' + (sy.fee * 100).toFixed(2) + '% + 기준금리 × ' + sy.borrow.toFixed(2) + '</b><span>실제 구간의 괴리로 추정</span></div><i>→</i><div class="on"><small>이어 붙이기</small><b>실제 ' + A.sym + '</b><span>' + ddYmd(sy.to) + '부터 실제 시세</span></div></div><div class="uhRow"><div class="uhBig"><div><b>' + (sy.corr == null ? "–" : sy.corr.toFixed(3)) + '</b><span>일간수익률 상관계수</span></div><div><b>' + (sy.maxErr * 100).toFixed(1) + '<u>%p</u></b><span>연중 MDD 최대 오차</span></div></div><div style="flex:1"><div class="uhCap">검산 — 실제 구간을 역산으로 다시 만들어 연중 MDD를 비교 (가장 깊었던 4개 해)</div>' + tbl(["연도", "실제", "역산", "오차"], sy.years.map(function (y) { return [y.y, ddPct(y.act), ddPct(y.syn), (y.err * 100).toFixed(1) + "%p"]; })) + '</div></div>'); }
  /* 4 낙폭의 역사 */
  var nTail = A.R.sorted.filter(function (x) { return x <= A.tailTh + 1e-9; }).length;
  T("낙폭의 역사", "52주 고점 대비 <mark>" + ddPct(A.tailTh, 0) + "</mark>를 넘긴 하락은 " + Math.round(A.yrs) + "년간 <mark>" + nTail + "번</mark>", '<div class="uhCard">' + ddSvgDD(A, 1110, 400, col) + '</div><p class="uhN">금색 면 = 52주 고점에서 내려와 있던 깊이 · 빨간 선 = ' + ddPct(A.tailTh, 0) + (A.S.synth ? ' · 점선 왼쪽은 역산 구간' : '') + '</p>');
  /* 5 분포 */
  T("어디까지 빠졌나", "절반은 <mark>" + ddPct(A.R.med, 0) + "</mark>에서 멈췄고, 10건 중 1건만 <mark>" + ddPct(A.R.p10, 0) + "</mark>보다 깊었습니다", '<div class="uhRow"><div class="uhCard" style="flex:1.75"><div class="uhLg"><i style="background:' + UH.ink + '"></i>52주 고점 기준 · ' + A.R.n + '건' + (A.RA.n ? '<i style="background:#d9cfb8"></i>사상최고가 기준 · ' + A.RA.n + '건' : '') + '</div>' + ddSvgReach(A, 680, 350, col) + '</div>' + side("분포 눈금 (52주 기준)", [["중앙값", ddPct(A.R.med, 0)], ["깊은 쪽 25%", ddPct(A.R.p25, 0)], ["깊은 쪽 10%", ddPct(A.R.p10, 0)], ["깊은 쪽 5%", ddPct(A.R.p05, 0)], ["가장 깊었던 것", ddPct(A.R.worst, 0)]], pts[1] && /예외 없이/.test(pts[1]) ? pts[1] : "") + '</div>');
  /* 6 깊었던 하락들 */
  var tl = A.tail.slice(-8);
  T("깊었던 하락들", "<mark>" + ddPct(A.tailTh, 0) + "</mark>에 닿은 " + A.tail.length + "번 — 모양과 배경이 결과를 갈랐습니다", tbl(["하락 구간 (고점 → 저점)", "최대 낙폭", ddPct(A.tailTh, 0) + " 닿은 날", "그 뒤 추가 하락", "1년 후", "200주선", "모양", "배경"], tl.map(function (t) { return [ddPeriod(t.pk, t.tr, t.open), '<span class="dn">' + ddPct(t.depth) + '</span>', t.hit ? ddYmd(t.hit.t) : "–", t.hit && !t.open ? ddPct(t.hit.more) : "—", t.hit && t.hit.r1 != null ? uhSg(t.hit.r1) : "—", t.brk ? "이탈" : "지킴", t.open ? "판단 대기" : t.ctx.shape, ddEsc(t.open && !t.ctx.names.length ? "—" : t.ctx.names.slice(0, 2).join(" · ") || "—")]; }), function (i) { return tl[i].open; }) + '<p class="uhN">1년 후 = ' + ddPct(A.tailTh, 0) + '에 처음 닿은 날 종가에서 252거래일 뒤 · 급락형 = 고점→저점 100일 이하, 장기 하락형 = 1년 이상 · 배경은 앱의 주요 이벤트 목록</p>');
  /* 7 기회 구간에서 샀다면 — 산 뒤 1년 */
  var O = A.opp, orows = ddOppRows(A, uhSg), hold = ddHold(A);
  if (O.n) T("기회 구간에서 샀다면", "<mark>" + ddPct(A.tailTh, 0) + "</mark>에 닿은 날 샀다면 — 1년 뒤 " + (O.st.r1.n ? O.st.r1.n + "번 중 <mark>" + O.st.r1.pos + "번</mark> 플러스" : "아직 결과 없음"), tbl(["고점", "닿은 날", "산 뒤 1년 안 최저", "1년 안 최고", "-" + Math.round(O.thr * 100) + "% 넘는 급락", "하루 최대 하락 / 상승", "6개월 후", "1년 후", "본전 회복"], orows.map(function (r) { var c = r.cells; return [r.sum ? '<b>' + c[0] + '</b>' : c[0], c[1], c[3], c[4], c[5], c[6], c[7], c[8], c[9]]; }), function (i) { return orows[i].now; }).replace(/<tr class="">((?:(?!<\/tr>).)*<b>(?:중앙값|플러스였던 횟수)<\/b>)/g, '<tr class="sum">$1') + (hold[0] || hold[1] ? '<div class="uhHold"><i>버티는 힘</i><div>' + hold.filter(Boolean).map(function (x) { return '<p>' + hl(x) + '</p>'; }).join("") + '</div></div>' : '') + '<p class="uhN">' + ddPct(A.tailTh, 0) + '에 처음 닿은 날 종가에 샀다고 가정 · 최저 · 최고 · 급락 횟수는 산 뒤 252거래일 안 · 표본 ' + O.n + '번 — 확률이 아니라 사례로 읽어 주세요</p>', "uhTight");
  /* 8 깊이별 비교 */
  var e0 = A.ent[0], eO = A.ent.filter(function (x) { return Math.abs(x.th - A.tailTh) < 1e-9; })[0] || A.ent[A.ent.length - 1];
  T("깊이별 비교", eO && e0 && eO.r1 != null && e0.r1 != null && eO.r1 > e0.r1 && eO.r1 > 0 ? "얕게 사면 <mark>" + ddPct(e0.r1, 0) + "</mark>, 기회 구간에서 사면 <mark>" + ddPct(eO.r1, 0) + "</mark> (1년 뒤 중앙값)" : "깊이별 — 처음 닿은 날 샀을 때의 1년 뒤", '<div class="uhRow"><div style="flex:2.1">' + tbl(["처음 닿은 깊이", "사건 수", "추가 하락 (중앙값)", "1년 후 중앙값", "1년 후 평균", "플러스", "1년 후 최악 (고점 연도)"], A.ent.map(function (x) { return [Math.round(x.th * 100) + "%", x.n, ddPct(x.more), uhSg(x.r1), ddPct(x.mean), x.pos == null ? "–" : Math.round(x.pos * x.n1) + " / " + x.n1, ddPct(x.worst) + (x.worstT != null ? " (" + ddYear(x.worstT) + ")" : "")]; }), function (i) { return Math.abs(A.ent[i].th - A.tailTh) < 1e-9; }) + '</div><aside class="uhSide"><b>읽는 법</b><p style="margin-top:6px">' + ddEsc(ddEntRead(A)) + '</p></aside></div>');
  /* 8 · 9 연초 대비 */
  T("해마다", ddEsc(nm) + " · 해마다 평균 연초 대비 <mark>" + ddPct(Y.avgLow) + "</mark>까지 빠졌습니다", '<div class="uhCard">' + ddSvgYtd(A, 1110, 370, col) + '</div><p class="uhN">막대 = 그해 가장 낮았던 종가 ÷ 전년 마지막 종가 − 1 · 검정 = -50% 이하 · 금색 = 올해(진행 중)</p>');
  var dp = Y.deep.filter(function (d) { return d.next != null; });
  T("연초 대비", dp.length ? "가장 깊이 빠진 해의 다음 해 — " + dp.map(function (d) { return '<mark>' + ddPct(d.next, 0) + '</mark>'; }).join(" · ") : "연초 대비 도달 확률", '<div class="uhRow"><div style="flex:1.9">' + tbl(["연초 대비", "닿은 해", "확률", "그해 연말 플러스"], Y.tab.filter(function (x) { return x.c > 0; }).map(function (x) { return [Math.round(x.th * 100) + "%", x.c + "년", (x.p * 100).toFixed(1) + "%", x.pos + " / " + x.c]; })) + '<p class="uhN">표본 ' + Y.from + '~' + Y.to + '년 ' + Y.done + '개 해 · 올해는 진행 중이라 제외</p></div>' + side("가장 깊었던 해 → 다음 해", Y.deep.map(function (d) { return [d.y + " (" + ddPct(d.low, 0) + ") → " + (d.y + 1), d.next != null ? uhSg(d.next) : d.nextCur != null ? ddPct(d.nextCur) + " (진행)" : "–"]; }).concat([["해마다 평균"], ["연초 대비 최저", ddPct(Y.avgLow)], ["연중 MDD", ddPct(Y.avgMdd)]])) + '</div>');
  /* 10 두 기준 */
  var cf = ddConflict(A);
  if (Y.cur) S.push('<section class="ddS uhBlack">' + band() + '<small class="uhCvK">' + ddYear(A.last.t) + ' · ' + (cf ? "두 기준이 다르게 말할 때" : "두 기준으로 본 지금") + '</small><div class="uhDuo"><div><b>' + ddPct(A.cur) + '</b><span>52주 고점 대비 · ' + (A.stNow ? A.stNow + "단계" : "단계 밖") + '</span></div><u>vs</u><div class="g"><b>' + ddPct(Y.cur.end) + '</b><span>연초 대비 · 연중 최저 ' + ddPct(Y.cur.low) + '</span></div></div><p class="uhPath">연초 ' + ddPx(A.sym, Y.cur.base) + ' <i>→</i> 고점 ' + ddYmd(A.openPk.t).slice(5) + ' ' + ddPx(A.sym, A.openPk.c) + ' <i>→</i> 지금 ' + ddPx(A.sym, A.last.c) + '</p><p class="uhSm">' + ddEsc(cf || "두 기준이 같은 방향을 가리키고 있습니다.") + '</p><footer><span>' + ddEsc(foot) + '</span><b>' + (own ? ddEsc(sns) : "") + '</b></footer></section>');
  /* 11 단계 */
  T("매수 단계", "내려갈수록 드물어지는 5개의 계단 <em>(참고)</em>", '<div class="uhStairs">' + A.stages.map(function (s, i) { var now = A.stNow === s.k, was = A.stMax >= s.k; return '<div class="' + (now ? "now" : was ? "was" : "") + '" style="margin-top:' + (i * 26) + 'px"><small>' + s.k + '단계' + (now ? ' · 지금 여기' : was ? ' · 닿았음' : '') + '</small><b>' + ddPct(s.d, 0) + '</b><span>' + ddPx(A.sym, A.openPk.c * (1 + s.d)) + '</span><dl><dt>여기까지 온 사건</dt><dd>' + Math.round(s.p * 100) + '%</dd><dt>비율 · ' + pr.name + '</dt><dd>' + pr.w[i] + '%</dd></dl><u><i style="width:' + Math.min(100, pr.w[i] * 2.5) + '%"></i></u></div>'; }).join("") + '</div><div class="uhBar"><i>현재 위치</i>52주 고점 대비 ' + ddPct(A.cur) + ' → ' + (A.stNow ? A.stNow + "단계 구간" + (A.stages[A.stNow] ? " · 다음 " + (A.stNow + 1) + "단계는 " + ddPct(A.stages[A.stNow].d, 0) : "") : "1단계(" + ddPct(A.stages[0].d, 0) + ") 전") + (Y.cur ? " · 연초 대비 " + ddPct(Y.cur.end) : "") + '</div><p class="uhN">단계 = 과거 하락 사건의 최대 낙폭 분포에서 50 · 25 · 15 · 10 · 5% 지점. 가격은 지금 52주 고점 기준. 비율은 가정값입니다.</p>');
  /* 배경과 결과: 기회 구간까지 간 사건을 그때의 이벤트와 묶어 1년 뒤로 나눈다 */
  var evs = A.tail.filter(function (t) { return t.depth <= A.tailTh + 1e-9 && t.hit; }), tyC = typeof EVENT_TYPES !== "undefined" ? EVENT_TYPES : {};
  var evCard = function (t) { var seen = {}, chips = t.ctx.types.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }).map(function (x) { return '<u style="background:' + (tyC[x] || "#8a92a3") + '">' + ddEsc(x) + '</u>'; }).join("");
    return '<div class="uhEv' + (t.open ? " now" : "") + '"><div class="y">’' + String(ddYear(t.hit.t)).slice(2) + '</div><div class="m"><b>' + ddEsc(t.ctx.names.slice(0, 3).join(" · ") || (t.open ? "배경 미입력" : "목록에 해당 이벤트 없음")) + '</b>' + chips + '<small>고점 ' + ddYm(t.pk) + ' → 최대 ' + ddPct(t.depth, 0) + ' · ' + (t.open ? "진행 중" : t.ctx.shape + " (고점→저점 " + t.ctx.days + "일)") + ' · 200주선 ' + (t.brk ? "이탈" : "지킴") + ' · 산 뒤 최저 ' + ddPct(t.hit.y1.lo, 0) + '</small></div><em class="' + (t.hit.r1 == null ? "" : t.hit.r1 > 0 ? "up" : "dn") + '">' + (t.hit.r1 == null ? "?" : ddPct(t.hit.r1, 0)) + '<small>1년 후</small></em></div>'; };
  var wn = evs.filter(function (t) { return t.hit.r1 != null && t.hit.r1 > 0; }), fl = evs.filter(function (t) { return t.hit.r1 != null && t.hit.r1 <= 0; }), pend = evs.filter(function (t) { return t.hit.r1 == null; });
  var md = function (a) { var v = ddMed(a.map(function (t) { return t.ctx.days; })); return v == null ? null : Math.round(v); }, tally = function (a) { var m = {}; a.forEach(function (t) { var sn = {}; t.ctx.types.forEach(function (x) { if (!sn[x]) { sn[x] = 1; m[x] = (m[x] || 0) + 1; } }); }); return Object.keys(m).sort(function (x, y) { return m[y] - m[x]; }).map(function (x) { return x + " " + m[x]; }).join(" · "); };
  var ins = []; if (wn.length && fl.length) { ins.push("고점→저점 중앙값: 플러스였던 사건 " + md(wn) + "일 vs 마이너스였던 사건 " + md(fl) + "일"); var bw = wn.filter(function (t) { return t.brk; }).length, bf = fl.filter(function (t) { return t.brk; }).length; ins.push("200주선 이탈: 플러스 " + bw + " / " + wn.length + " · 마이너스 " + bf + " / " + fl.length); if (tally(fl)) ins.push("마이너스였던 사건의 배경 유형: " + tally(fl)); }
  if (evs.length) T("배경과 결과", "<mark>" + ddPct(A.tailTh, 0) + "</mark> 이하 " + evs.length + "번 — 그때 무슨 일이 있었고, 1년 뒤 어땠나", '<div class="uhEvG"><div><div class="uhEvH up">1년 뒤 플러스 · ' + wn.length + '번</div>' + (wn.map(evCard).join("") || '<p class="uhN">없음</p>') + '</div><div><div class="uhEvH dn">1년 뒤 마이너스 · ' + fl.length + '번</div>' + (fl.map(evCard).join("") || '<p class="uhN">없음</p>') + (pend.length ? '<div class="uhEvH">아직 1년이 안 지남 · ' + pend.length + '번</div>' + pend.map(evCard).join("") : '') + '</div></div>' + (ins.length ? '<div class="uhBar"><i>차이</i>' + ins.map(ddEsc).join("　|　") + '</div>' : '') + '<p class="uhN">1년 후 = ' + ddPct(A.tailTh, 0) + '에 처음 닿은 날 종가에서 252거래일 뒤 · 배경은 앱의 주요 이벤트 목록(고점 45일 전 ~ 저점 15일 뒤) · 사례가 적어 원인으로 단정할 수 없습니다</p>', "uhTight");
  /* 13 정의 */
  T("정의와 데이터", "이 자료는 이렇게 계산했습니다", '<div class="uhDef"><div><b>52주 고점 기준 사건</b><span>최근 252거래일 종가 최고에서 -10% 이상 하락하면 시작, 52주 신고가로 돌아오면 끝. ' + A.R.n + '건</span></div><div><b>사상최고가 기준 사건</b><span>최고가에서 -10% 이상 하락 → 최고가 회복 시 끝. ' + A.RA.n + '건' + (A.S.synth ? " (실제 시세만)" : "") + '</span></div><div><b>연초 대비</b><span>그해 최저 종가 ÷ 전년 마지막 거래일 종가 − 1. ' + Y.done + '개 해</span></div><div><b>연중 MDD</b><span>그해 안에서 고점 대비 최대 낙폭</span></div><div><b>진입 후 성과</b><span>52주 고점 대비 N%에 처음 닿은 날 종가에 매수, 1년 = 252거래일</span></div><div><b>매수 단계</b><span>사건 최대 낙폭 분포의 50 · 25 · 15 · 10 · 5% 지점</span></div></div><p class="uhN">과거 데이터 분석이며 미래 수익을 보장하지 않습니다.' + (A.S.lev ? " 레버리지 ETF는 원금 대부분을 잃을 수 있습니다." : "") + ' 배당을 뺀 종가 기준입니다. 해외주식 양도차익은 연 250만 원 공제 후 22% 과세 — 모든 수익률은 세전입니다. 매수 권유가 아닌 참고 자료입니다.</p>');
  return S;
}
/* custom = { name, title, tag, make() } 를 주면 다른 자료(종목 리포트 등)도 같은 틀로 연다 */
function ddDeck(sym, custom) {
  var A = custom ? { name: custom.name, sym: sym } : ddGet(sym); if (!A || A.none) return; var old = document.getElementById("ddDeck"); if (old) old.remove();
  var S = custom ? custom.make() : ddSlides(A), P = ddPrefs(), el = document.createElement("div"); el.id = "ddDeck"; DD.slide = 0;
  el.innerHTML = '<div class="ddBarTop"><b>' + ddEsc(A.name) + ' · ' + (custom ? ddEsc(custom.title) : '낙폭 분석 자료') + '</b><span class="ddPg"></span><span style="flex:1"></span><label>표지 이름 <input type="text" value="' + ddEsc(P.brand) + '" maxlength="24" data-ddbrand></label><button data-ddprev>‹ 이전</button><button data-ddnext>다음 ›</button><button data-ddpng>이 장 이미지 저장</button><button data-ddpdf>PDF로 저장 (인쇄)</button><button data-ddclose>닫기</button></div><div class="ddStage"><div class="ddScale">' + S.map(function (s, i) { return s.replace("<i></i></header>", "<i>" + ("0" + (i + 1)).slice(-2) + " / " + S.length + "</i></header>"); }).join("") + '</div></div>';
  document.body.appendChild(el); document.documentElement.classList.add("ddOpen");
  var all = el.querySelectorAll(".ddS"), fit = function () { var st = el.querySelector(".ddStage"), sc = Math.min((st.clientWidth - 16) / 1280, (st.clientHeight - 16) / 720); el.querySelector(".ddScale").style.transform = "scale(" + sc + ")"; el.querySelector(".ddScale").style.marginLeft = Math.max(0, (st.clientWidth - 1280 * sc) / 2) + "px"; el.querySelector(".ddScale").style.marginTop = Math.max(0, (st.clientHeight - 720 * sc) / 2) + "px"; };
  var go = function (i) { DD.slide = Math.max(0, Math.min(all.length - 1, i)); Array.prototype.forEach.call(all, function (s, k) { s.classList.toggle("cur", k === DD.slide); }); el.querySelector(".ddPg").textContent = (DD.slide + 1) + " / " + all.length; };
  var close = function () { el.remove(); document.documentElement.classList.remove("ddOpen"); window.removeEventListener("resize", fit); document.removeEventListener("keydown", key); };
  var key = function (e) { if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === "ArrowRight" || e.key === " ") go(DD.slide + 1); else if (e.key === "ArrowLeft") go(DD.slide - 1); else if (e.key === "Escape") close(); };
  el.querySelector("[data-ddprev]").onclick = function () { go(DD.slide - 1); }; el.querySelector("[data-ddnext]").onclick = function () { go(DD.slide + 1); }; el.querySelector("[data-ddclose]").onclick = close;
  el.querySelector(".ddStage").onclick = function (e) { var r = this.getBoundingClientRect(); go(DD.slide + (e.clientX - r.left > r.width / 2 ? 1 : -1)); };
  el.querySelector("[data-ddpdf]").onclick = function () { window.print(); };
  el.querySelector("[data-ddbrand]").onchange = function () { ddSave("brand", this.value.trim()); var i = DD.slide; ddDeck(sym, custom); var d = document.getElementById("ddDeck"); if (d) { DD.slide = i; var a2 = d.querySelectorAll(".ddS"); Array.prototype.forEach.call(a2, function (s, k) { s.classList.toggle("cur", k === i); }); d.querySelector(".ddPg").textContent = (i + 1) + " / " + a2.length; } };
  el.querySelector("[data-ddpng]").onclick = function () { var btn = this, cur = all[DD.slide]; btn.disabled = true; btn.textContent = "만드는 중…";
    ddH2c().then(function () { var box = document.createElement("div"); box.style.cssText = "position:fixed;left:-99999px;top:0;width:1280px;height:720px"; var cl = cur.cloneNode(true); cl.classList.add("cur"); cl.style.position = "static"; box.className = "ddScale"; box.appendChild(cl); document.body.appendChild(box);
      return window.html2canvas(cl, { scale: 2, backgroundColor: null, width: 1280, height: 720, logging: false }).then(function (cv) { box.remove(); var a = document.createElement("a"); a.download = "uphill_" + A.sym.replace(/[^A-Za-z0-9]/g, "") + (custom ? "_" + custom.tag + "_" : "_낙폭리서치_") + ("0" + (DD.slide + 1)).slice(-2) + ".png"; a.href = cv.toDataURL("image/png"); a.click(); }, function (e) { box.remove(); throw e; }); })
      .catch(function (e) { console.warn("dd png", e); if (typeof toast === "function") toast("이미지를 만들지 못했어요 — PDF 저장을 써 주세요"); }).then(function () { btn.disabled = false; btn.textContent = "이 장 이미지 저장"; }); };
  window.addEventListener("resize", fit); document.addEventListener("keydown", key); fit(); go(0);
  if (custom && typeof custom.after === "function") { try { custom.after(el); } catch (e) { console.warn("deck after", e); } }   // v13.99 넘치는 장을 줄여 맞추는 등 뒤처리
}
function ddH2c() { if (window.html2canvas) return Promise.resolve(); if (DD.h2c) return DD.h2c; DD.h2c = new Promise(function (ok, no) { var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"; s.onload = ok; s.onerror = function () { DD.h2c = null; no(new Error("h2c")); }; document.head.appendChild(s); }); return DD.h2c; }

/* ---------- 분석 화면에 '낙폭 · 단계' 탭 붙이기 ---------- */
function ddBind(pane, sym) {
  var re = function () { pane.innerHTML = ddHtml(sym); ddBind(pane, sym); };
  Array.prototype.forEach.call(pane.querySelectorAll("[data-ddprof]"), function (b) { b.onclick = function () { ddSave("prof", b.getAttribute("data-ddprof")); re(); }; });
  var li = pane.querySelector("[data-ddloss]"); if (li) li.onchange = function () { var v = Math.max(1, Math.min(50, +li.value || 10)); ddSave("loss", v); re(); };
  var dk = pane.querySelector("[data-dddeck]"); if (dk) dk.onclick = function () { ddDeck(sym); };
}
function ddMount(root) {
  try {
    if (typeof AN === "undefined" || !AN.sym) return; var sym = AN.sym, wrap = root && root.querySelector ? root.querySelector(".egTabs") : null; if (!wrap || wrap.querySelector('[data-egtab="dd"]')) return;
    var bar = wrap.querySelector(".egTabBar"), after = bar.querySelector('[data-egtab="hist"]'), btn = document.createElement("button"); btn.setAttribute("data-egtab", "dd"); btn.textContent = "낙폭 · 단계";
    if (after && after.nextSibling) bar.insertBefore(btn, after.nextSibling); else bar.appendChild(btn);
    var pane = document.createElement("div"); pane.className = "egPane"; pane.setAttribute("data-egpane", "dd"); pane.hidden = true; pane.innerHTML = '<div class="briefDim">낙폭 분석을 계산하는 중…</div>'; wrap.appendChild(pane);
    var show = function () { if (typeof EG !== "undefined") EG.anTab = "dd"; Array.prototype.forEach.call(wrap.querySelectorAll(".egTabBar button"), function (b) { b.classList.toggle("on", b === btn); }); Array.prototype.forEach.call(wrap.querySelectorAll(".egPane"), function (p) { p.hidden = p !== pane; }); };
    var fill = function () { if (pane._f) return; pane._f = 1; ddEnsure(sym).then(function () { if (!pane.isConnected) return; pane.innerHTML = ddHtml(sym); ddBind(pane, sym); }).catch(function (e) { console.warn("dd", e); pane.innerHTML = '<div class="briefDim">낙폭 분석을 계산하지 못했어요.</div>'; }); };
    btn.onclick = function () { show(); fill(); };
    if (typeof EG !== "undefined" && EG.anTab === "dd") { show(); fill(); }
  } catch (e) { console.warn("dd mount", e); }
}
(function () {
  if (typeof document === "undefined") return;
  if (typeof anxSections === "function") { var s0 = anxSections; anxSections = function (root) { var r = s0.apply(this, arguments); ddMount(root); return r; }; }
  var st = document.createElement("style"); st.id = "ddCss"; st.textContent = [
    ".ddBox{margin-bottom:12px}.ddTop{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.ddHd{font-size:18px;font-weight:900;line-height:1.35;color:#0f2240}.ddKs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.ddK{background:#f6f8fb;border-radius:12px;padding:11px 13px;border-top:3px solid #0f2240;min-width:0}.ddK b{display:block;font-size:24px;font-weight:900;line-height:1.15;color:#0f2240}.ddK.dn b{color:#1f5fbf}.ddK span{display:block;font-size:12.5px;font-weight:700;margin-top:3px}.ddK small{display:block;font-size:11.5px;color:#6b7686;line-height:1.4;margin-top:1px}",
    ".ddWarn{background:#fff6e8;border-left:4px solid #b9600f;border-radius:8px;padding:9px 12px;font-size:13px;line-height:1.55;margin:8px 0}.ddWarn b{display:block;color:#8a4a0c}.ddPts{margin:10px 0 0;padding:0;list-style:none;counter-reset:dp}.ddPts li{counter-increment:dp;border-top:1px solid #e6eaf0;padding:9px 0 9px 34px;position:relative;font-size:13.5px;font-weight:600;line-height:1.5}.ddPts li::before{content:'0' counter(dp);position:absolute;left:0;top:9px;color:#b9600f;font-weight:900}",
    ".ddSvg{display:block;width:100%;height:auto}.ddTwo{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:14px;align-items:start;margin-top:8px}.ddSide{background:#f6f8fb;border-top:3px solid #c97b2e;border-radius:0 0 10px 10px;padding:12px 14px}.ddSide>b{display:block;font-size:13px;margin-bottom:4px}.ddSide>div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #e3e7ee;padding:7px 0;font-size:13px}.ddSide em{font-style:normal;font-weight:800;font-size:15px}.ddUp{color:#d9342b!important}.ddDn{color:#1f5fbf!important}",
    ".ddSyn{display:grid;grid-template-columns:170px 170px minmax(0,1fr);gap:10px;align-items:start;margin-top:8px}.ddMini{font-size:12.5px;line-height:1.6;background:#f6f8fb;border-radius:8px;padding:8px 12px;margin-top:8px}tr.ddNow td{background:#fdebd8!important}tr.ddSumR td{background:#f3f5f8!important;font-weight:700}.ddHold{background:#141414;color:#fff;border-radius:10px;padding:11px 14px;margin-top:8px}.ddHold b{color:#e6c57a;font-size:13px}.ddHold p{margin:4px 0 0;font-size:13.5px;line-height:1.55}.ddBox .dgT td small{color:#8a92a3;font-size:11px}.ddSub{font-size:13.5px;font-weight:800;margin:12px 0 6px;color:#0f2240}.ddNowL{background:#eef4ff;border-left-color:#3182f6}.ddNowL b{display:inline;color:#1a56c4;margin-right:6px}[data-theme=dark] tr.ddSumR td{background:#1e2533!important}[data-theme=dark] .ddSub{color:#dde}[data-theme=dark] .ddNowL{background:#16233a}.ddBox .dgT td,.ddBox .dgT th{white-space:nowrap}.ddBox .dgT td:last-child{white-space:normal}",
    ".ddProfSel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0 2px}.ddProfSel button{font:inherit;border:1px solid #dfe4ec;background:#fff;border-radius:8px;padding:8px 10px;text-align:left;cursor:pointer}.ddProfSel button b{display:block;font-size:13.5px}.ddProfSel button span{font-size:11.5px;color:#6b7686}.ddProfSel button.on{border-color:#3182f6;background:#eaf2ff}.ddCap{margin-top:10px;background:#f6f8fb;border-radius:10px;padding:10px 14px}.ddCap label{display:block;font-size:13px;font-weight:700;margin-bottom:4px}.ddCap input{width:64px;font:inherit;padding:4px 6px;border:1px solid #cfd6e0;border-radius:6px;text-align:right}.ddCap>div{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #e3e7ee;padding:7px 0;font-size:13px}.ddCap em{font-style:normal;font-weight:800;white-space:nowrap}",
    "@media(max-width:720px){.ddKs{grid-template-columns:repeat(2,minmax(0,1fr))}.ddK b{font-size:20px}.ddTwo,.ddSyn{grid-template-columns:minmax(0,1fr)}.ddBox .dgT td,.ddBox .dgT th{white-space:normal}.ddCap>div{flex-direction:column;gap:2px}.ddProfSel button span{display:block}}",
    "[data-theme=dark] .ddHd,[data-theme=dark] .ddK b{color:#e8ecf3}[data-theme=dark] .ddK,[data-theme=dark] .ddSide,[data-theme=dark] .ddMini,[data-theme=dark] .ddCap{background:#1e2533}[data-theme=dark] .ddSvg{filter:invert(.92) hue-rotate(180deg)}[data-theme=dark] tr.ddNow td{background:#3a2a16!important}[data-theme=dark] .ddWarn{background:#2a2114}[data-theme=dark] .ddWarn b{color:#e6a35c}[data-theme=dark] .ddProfSel button{background:#161b24;border-color:#263041;color:#dde}[data-theme=dark] .ddProfSel button.on{background:#1c2b45}",
    /* 슬라이드 */
    "html.ddOpen{overflow:hidden}#ddDeck{position:fixed;inset:0;z-index:9000;background:#1a1d24;display:flex;flex-direction:column;font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}.ddBarTop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px;background:#0d1017;color:#dfe4ec;font-size:13px}.ddBarTop button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid #39414f;background:#1c212b;color:#fff;border-radius:8px;padding:6px 11px;cursor:pointer}.ddBarTop input{font:inherit;font-size:12.5px;width:120px;padding:5px 7px;border-radius:6px;border:1px solid #39414f;background:#1c212b;color:#fff}.ddPg{color:#9aa4b5}.ddStage{flex:1;position:relative;overflow:hidden;cursor:pointer}.ddScale{width:1280px;height:720px;transform-origin:0 0;position:relative}",
    ".ddS{position:absolute;inset:0;width:1280px;height:720px;box-sizing:border-box;background:#fbf8f1;color:#141414;padding:0 64px;display:none;overflow:hidden;font-size:17px;line-height:1.45;word-break:keep-all}.ddS.cur{display:block}.ddS .up{color:#d9342b}.ddS .dn{color:#2f6fd6}.ddS mark{background:none;color:#8a6a1f}",
    ".uhBand{margin:0 -64px;height:54px;background:#141414;color:#fff;display:flex;align-items:center;gap:12px;padding:0 64px;border-bottom:3px solid #c9a24f}.uhBand b{font-size:19px;font-weight:900}.uhBand em{font-style:normal;font-size:12px;letter-spacing:3px;color:#e6c57a;font-weight:700}.uhBand span{margin-left:auto;font-size:14px;color:#c9d0de;font-weight:600}.uhBand i{font-style:normal;font-size:14px;font-weight:800;color:#e6c57a;margin-left:18px}",
    ".uhHead{position:relative;padding:26px 0 16px}.uhHead small{display:inline-block;font-size:13.5px;font-weight:800;color:#8a6a1f;background:rgba(201,162,79,.16);border-radius:6px;padding:3px 10px}.uhHead h2{font-size:33px;font-weight:900;line-height:1.25;margin:9px 190px 0 0;letter-spacing:-.5px}.uhHead h2 em{font-style:normal;font-size:20px;color:#8a92a3;font-weight:700}.uhLine{position:absolute;left:0;right:0;bottom:0;width:100%;height:44px;pointer-events:none}.ddSB{margin-top:20px}",
    ".ddS footer{position:absolute;left:64px;right:64px;bottom:22px;display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#8a92a3}.ddS footer b{color:#141414;font-weight:800}",
    ".uhCard{background:#fff;border:1px solid #e6e1d6;border-radius:14px;padding:16px 18px}.uhN{font-size:13.5px;color:#5b6474;font-weight:600;margin:10px 0 0}.uhRow{display:flex;gap:28px;align-items:flex-start}.uhCap{font-size:13.5px;font-weight:700;color:#5b6474;margin-bottom:6px}.uhLg{font-size:13.5px;font-weight:700;color:#5b6474;margin-bottom:6px}.uhLg i{display:inline-block;width:16px;height:10px;border-radius:2px;margin:0 7px 0 0;vertical-align:middle}.uhLg i:nth-of-type(2){margin-left:18px}",
    ".uhT{width:100%;border-collapse:collapse;font-size:16.5px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6e1d6}.uhT th{background:#141414;color:#fff;text-align:right;padding:9px 12px;font-weight:700;font-size:14px}.uhT td{text-align:right;padding:8px 12px;border-top:1px solid #efeadf;font-weight:700}.uhT th:first-child,.uhT td:first-child{text-align:left}.uhT tr.hi td{background:rgba(201,162,79,.2)}.uhT tr.sum td{background:#f3efe6;border-top:1px solid #d9cfb8}.uhTight .uhHead{padding:20px 0 14px}.uhTight .ddSB{margin-top:14px}.uhTight .uhT{font-size:15px}.uhTight .uhT td{padding:6px 10px}.uhTight .uhT th{padding:7px 10px;font-size:13px}.uhT td small{font-size:11.5px;color:#8a92a3;font-weight:600}.uhT td small+small{margin-left:4px}.uhHold{display:flex;gap:16px;align-items:flex-start;background:#141414;color:#fff;border-radius:12px;padding:11px 18px;margin-top:12px}.uhHold i{font-style:normal;color:#e6c57a;font-size:14px;font-weight:800;white-space:nowrap;padding-top:2px}.uhHold p{margin:0 0 3px;font-size:15px;font-weight:700;line-height:1.45}.uhHold mark{color:#e6c57a}.uhEvG{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}.uhEvH{font-size:14px;font-weight:900;margin:0 0 6px;color:#5b6474}.uhEvH.up{color:#d9342b}.uhEvH.dn{color:#2f6fd6}.uhEv+.uhEvH{margin-top:12px}.uhEv{display:grid;grid-template-columns:50px 1fr auto;gap:10px;align-items:center;background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:8px 14px;margin-bottom:6px}.uhEv.now{background:#f3efe6;border-color:#c9a24f}.uhEv .y{font-size:24px;font-weight:900;color:#8a6a1f}.uhEv .m b{font-size:15.5px;font-weight:800;margin-right:6px}.uhEv .m u{text-decoration:none;display:inline-block;color:#fff;font-size:11px;font-weight:800;border-radius:5px;padding:1px 6px;margin-right:4px;vertical-align:1px}.uhEv .m small{display:block;font-size:12.5px;color:#5b6474;font-weight:600;margin-top:1px}.uhEv em{font-style:normal;font-size:26px;font-weight:900;text-align:right;line-height:1.05;white-space:nowrap}.uhEv em small{display:block;font-size:11px;color:#8a92a3;font-weight:700}.uhEvG+.uhBar{font-size:14.5px;padding:10px 16px;margin-top:10px}.uhProf dt.mut,.uhProf dd.mut{color:#8a92a3;font-size:13px;font-weight:600}.uhT td:last-child:not(:nth-child(-n+6)){text-align:left;font-size:14.5px;font-weight:600}",
    ".uhSide{flex:1;background:#fff;border:1px solid #e6e1d6;border-top:4px solid #c9a24f;border-radius:12px;padding:16px 20px;min-width:0}.uhSide>b{display:block;font-size:15px;margin-bottom:2px}.uhSide>b.sub{margin-top:14px}.uhSide>div{display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:1px solid #efeadf;padding:9px 0;font-size:15.5px;font-weight:600;color:#5b6474}.uhSide em{font-style:normal;font-weight:900;font-size:21px;color:#141414;white-space:nowrap}.uhSide em span{font:inherit}.uhSide p{font-size:14.5px;color:#5b6474;font-weight:600;margin:12px 0 0}",
    ".uhDark{flex:1;background:#141414;color:#fff;border-radius:14px;padding:20px 22px;min-width:0}.uhDark small{font-size:13.5px;color:#e6c57a;font-weight:800}.uhDark div{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #333;padding:12px 0}.uhDark span{font-size:15.5px;color:#c9d0de;font-weight:600}.uhDark b{font-size:30px;font-weight:900}.uhDark b.g{color:#e6c57a}.uhDark p{font-size:14.5px;color:#c9d0de;margin:14px 0 0;font-weight:600}",
    /* 표지 */
    ".uhCover,.uhBlack{background:#141414;color:#fff}.uhCover{padding:56px 76px}.uhCv{position:absolute;left:0;right:0;bottom:92px;opacity:.9}.uhCv svg{display:block;width:100%}.uhCvTop{display:flex;align-items:center;gap:14px;position:relative}.uhCvTop b{font-size:27px;font-weight:900}.uhCvTop em{font-style:normal;font-size:14px;letter-spacing:4px;color:#e6c57a;font-weight:700}.uhCvK{display:block;font-size:15px;letter-spacing:4px;font-weight:800;color:#e6c57a;margin-top:78px;position:relative}.uhCover h1{font-size:128px;font-weight:900;line-height:1;margin:10px 0 12px;letter-spacing:-3px;position:relative}.uhCover p{font-size:34px;font-weight:800;margin:0;position:relative}.uhCvN{display:block;font-size:17px;color:#c9d0de;font-weight:600;margin-top:10px;position:relative}.uhCvM{position:absolute;left:0;right:0;bottom:0;height:92px;background:#1d1d1d;border-top:3px solid #c9a24f;display:grid;grid-template-columns:repeat(4,1fr);padding:0 76px;align-items:center}.uhCvM small{display:block;font-size:12.5px;color:#8a92a3;font-weight:700}.uhCvM b{font-size:18px;font-weight:800}",
    /* 요약 */
    ".uhSum{display:grid;grid-template-columns:372px 1fr;gap:26px}.uhNow{background:#141414;color:#fff;border-radius:16px;padding:22px 24px}.uhNow>small{font-size:13.5px;color:#e6c57a;font-weight:800}.uhNow>b{display:block;font-size:76px;font-weight:900;line-height:1.1;letter-spacing:-2px}.uhNow>b.dn{color:#8fb6ff}.uhNow>span{display:block;font-size:13px;color:#c9d0de;margin-bottom:10px}.uhNow>div{border-top:1px solid #333;padding:9px 0 7px;display:grid;grid-template-columns:1fr auto;column-gap:10px}.uhNow>div span{font-size:14px;color:#c9d0de;font-weight:600}.uhNow>div em{font-style:normal;font-size:21px;font-weight:900;color:#e6c57a;white-space:nowrap}.uhNow>div small{grid-column:1/-1;font-size:12px;color:#8a92a3}",
    ".uhFind>div:not(.uhLadWrap){display:grid;grid-template-columns:46px 1fr;align-items:start;border-bottom:1px solid #e6e1d6;padding:11px 0}.uhFind i{font-style:normal;font-size:34px;font-weight:900;color:#c9a24f;line-height:1}.uhFind p{margin:0;font-size:18.5px;font-weight:700;line-height:1.45}.uhLadWrap{margin-top:16px}.uhLadWrap>small{font-size:13px;font-weight:700;color:#5b6474}.uhMini{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:6px}.uhMini>div{background:#fff;border:1px solid #e6e1d6;border-radius:10px;padding:7px 10px}.uhMini small{display:block;font-size:12px;color:#8a92a3;font-weight:700}.uhMini b{font-size:20px;font-weight:900}.uhMini .was{background:#f3efe6}.uhMini .now{background:#141414;border-color:#141414;color:#fff}.uhMini .now small{color:#e6c57a}",
    /* 계산식 */
    ".uhEq{display:flex;align-items:stretch;gap:12px;margin-bottom:24px}.uhEq>div{flex:1;background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:14px 16px}.uhEq>div.n{flex:none;width:70px;display:flex;align-items:center;justify-content:center}.uhEq>div.n b{font-size:40px;margin:0}.uhEq>div.on{background:#141414;color:#fff;border-color:#141414}.uhEq>div.on small{color:#e6c57a}.uhEq>div.on span{color:#c9d0de}.uhEq small{display:block;font-size:12.5px;font-weight:800;color:#8a6a1f}.uhEq b{display:block;font-size:19px;font-weight:900;margin:3px 0 4px}.uhEq span{font-size:13.5px;color:#5b6474;font-weight:600}.uhEq>i{font-style:normal;font-size:30px;font-weight:900;color:#c9a24f;align-self:center}.uhBig{width:250px;flex:none;display:grid;gap:14px}.uhBig b{display:block;font-size:50px;font-weight:900;line-height:1.1;letter-spacing:-1px}.uhBig u{text-decoration:none;font-size:24px}.uhBig span{font-size:15px;font-weight:700;color:#5b6474}",
    /* 두 기준 */
    ".uhBlack .uhCvK{margin-top:70px}.uhDuo{display:flex;align-items:flex-end;gap:40px;margin-top:14px}.uhDuo b{display:block;font-size:112px;font-weight:900;line-height:1.05;letter-spacing:-3px}.uhDuo span{font-size:18px;font-weight:700;color:#c9d0de}.uhDuo .g b{color:#e6c57a}.uhDuo u{text-decoration:none;font-size:22px;font-weight:800;color:#8a92a3;padding-bottom:46px}.uhPath{font-size:23px;font-weight:800;margin:40px 0 8px}.uhPath i{font-style:normal;color:#c9a24f;margin:0 6px}.uhSm{font-size:17px;color:#c9d0de;font-weight:600;max-width:1020px;margin:0}.uhBlack footer b{color:#e6c57a}.uhBlack footer span{color:#8a92a3}",
    /* 계단 */
    ".uhStairs{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:start}.uhStairs>div{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:12px 14px 14px}.uhStairs small{display:block;font-size:12.5px;font-weight:800;color:#8a6a1f}.uhStairs b{display:block;font-size:38px;font-weight:900;line-height:1.15;letter-spacing:-1px}.uhStairs span{font-size:14px;color:#5b6474;font-weight:700}.uhStairs dl{margin:8px 0 6px;display:grid;grid-template-columns:1fr auto;row-gap:2px;font-size:13.5px}.uhStairs dt{color:#5b6474;font-weight:600}.uhStairs dd{margin:0;font-weight:900}.uhStairs u{display:block;height:6px;background:#efeadf;border-radius:3px;text-decoration:none}.uhStairs u i{display:block;height:6px;border-radius:3px;background:#c9a24f}.uhStairs .was{background:#f3efe6}.uhStairs .now{background:#141414;color:#fff;border-color:#141414}.uhStairs .now small{color:#e6c57a}.uhStairs .now span,.uhStairs .now dt{color:#c9d0de}.uhStairs .now u{background:#333}",
    ".uhBar{background:#141414;color:#fff;font-size:17.5px;font-weight:800;padding:12px 20px;margin-top:16px;border-radius:10px}.uhBar i{font-style:normal;color:#e6c57a;font-size:14px;margin-right:16px}",
    /* 성향 */
    ".uhProf{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.uhProf>div{background:#fff;border:1px solid #e6e1d6;border-radius:14px;padding:16px 18px}.uhProf>div.on{border:2px solid #c9a24f;box-shadow:0 0 0 4px rgba(201,162,79,.16)}.uhProf .h{display:flex;justify-content:space-between;align-items:flex-end;height:42px}.uhProf .h b{font-size:27px;font-weight:900}.uhProf .bars{display:flex;gap:4px;align-items:flex-end}.uhProf .bars i{display:block;width:13px;background:#141414;border-radius:2px 2px 0 0}.uhProf>div.on .bars i{background:#c9a24f}.uhProf small{display:block;font-size:13px;color:#5b6474;font-weight:600;margin:4px 0 6px;min-height:36px}.uhProf dl{margin:0;display:grid;grid-template-columns:1fr auto;font-size:14.5px}.uhProf dt{color:#5b6474;font-weight:600;border-top:1px solid #efeadf;padding:5px 0;font-size:13.5px}.uhProf dd{margin:0;font-weight:900;font-size:16px;border-top:1px solid #efeadf;padding:4px 0;text-align:right}.uhProf>div{padding:12px 16px!important}.uhProf+.uhBar{margin-top:10px;font-size:15.5px;padding:9px 16px}.uhBar+.uhNotes,.uhProf+.uhNotes{margin-top:10px}.uhBar+.uhNotes b,.uhProf+.uhNotes b{font-size:14px}.uhProf dd span{font:inherit}",
    ".uhNotes{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;margin-top:16px}.uhNotes>div{border-left:4px solid #c9a24f;padding:1px 0 1px 14px}.uhNotes small{display:block;font-size:13px;font-weight:800;color:#8a6a1f}.uhNotes b{font-size:15.5px}.uhDef{display:grid;grid-template-columns:1fr 1fr;gap:0 36px}.uhDef>div{border-top:1px solid #e6e1d6;padding:11px 0}.uhDef b{display:block;font-size:17px}.uhDef span{font-size:15.5px;color:#5b6474;font-weight:600}",
    "@media(max-width:720px){.ddBarTop label{display:none}.ddBarTop b{width:100%}}",
    "@media print{@page{size:1280px 720px;margin:0}html.ddOpen body>*:not(#ddDeck){display:none!important}html.ddOpen,html.ddOpen body{overflow:visible!important;height:auto!important;background:#fff!important}html.ddOpen body{padding:0!important;margin:0!important;min-height:0!important}#ddDeck{position:static!important;display:block!important;background:none!important;height:auto!important;min-height:0!important}.ddStage{display:block!important;height:auto!important;flex:none!important}.ddBarTop{display:none!important}.ddStage{overflow:visible!important}.ddScale{transform:none!important;margin:0!important;height:auto!important}.ddS:last-child{page-break-after:auto!important;break-after:auto!important}.ddS{display:block!important;position:relative!important;page-break-after:always;break-after:page;-webkit-print-color-adjust:exact;print-color-adjust:exact}}"
  ].join("");
  document.head.appendChild(st);
})();
if (typeof module !== "undefined") module.exports = { ddSeries: ddSeries, ddEvents: ddEvents, ddReach: ddReach, ddEntry: ddEntry, ddYtd: ddYtd, ddStages: ddStages, ddBacktest: ddBacktest, ddAnalyze: ddAnalyze, ddQ: ddQ, ddMed: ddMed, ddW200: ddW200, DD_PROF: DD_PROF };
