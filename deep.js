/* ============================================================
   연구노트 심화 (v9.9) — 기존 덱 뒤에 '조건부 통계' 카드를 덧붙인다.
   전부 25년치 일봉에서 직접 계산 · 같은 문장 틀을 피하려고 결론 문장은 숫자에 따라 다르게 조립한다.
   ① 국면 덱  : 조건이 맞았던 모든 날의 6개월·1년 뒤 자산별 승률·중앙값 → 자산 순위 → "데이터 기준 제안"
                 + 지금과 가장 닮은 날 5개(특징 거리) → 그 뒤 1년
   ② 낙폭 덱  : 지금 낙폭 ±5%p 구간에서 샀던 모든 날의 3·6·12개월 뒤 결과(승률·중앙값·최악)
                 + 지금 자리에서 '한 번에 vs 3번 나눠' 샀을 때 1년 뒤
   ③ 적립 덱  : 시작 시점을 달마다 바꾼 10년 적립 결과 분포(최악·중앙·최고·플러스 비율)
                 + 정액 적립 vs 200일선 아래서 2배 적립
   ============================================================ */
var DP_SYMS = ["SPY", "QQQ", "^KS11", "TLT", "GLD", "BTC-USD", "^VIX", "USO", "KRW=X", "SCHD"];
var DP_NM = { SPY: "S&P500", QQQ: "나스닥100", "^KS11": "코스피", TLT: "장기채", GLD: "금", "BTC-USD": "비트코인", SCHD: "배당주", USO: "원유", "KRW=X": "달러/원", "^VIX": "VIX" };
var DP_TRADE = { SPY: "SPY(또는 TIGER 미국S&P500)", QQQ: "QQQ(또는 TIGER 미국나스닥100)", "^KS11": "KODEX 200", TLT: "TLT(또는 KODEX 미국채30년)", GLD: "GLD(또는 KODEX 골드선물)", "BTC-USD": "비트코인 현물", SCHD: "SCHD(또는 TIGER 미국배당다우존스)" };
function dpRows(sym) { return (typeof nbHist !== "undefined" && nbHist[sym]) || []; }
function dpAt(rows, t) { var lo = 0, hi = rows.length - 1; if (hi < 0) return -1; while (lo < hi) { var m = (lo + hi + 1) >> 1; if (rows[m].t <= t) lo = m; else hi = m - 1; } return rows[lo].t <= t ? lo : -1; }
function dpFwd(rows, i, days) { var j = i + days; return j < rows.length ? rows[j].c / rows[i].c - 1 : null; }
function dpMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function dpWin(a) { return a.length ? a.filter(function (x) { return x > 0; }).length / a.length : null; }
function dpDd(rows) { var pk = -Infinity, out = []; rows.forEach(function (r) { if (r.c > pk) pk = r.c; out.push(r.c / pk - 1); }); return out; }
function dpMa(rows, n) { var out = [], s = 0; for (var i = 0; i < rows.length; i++) { s += rows[i].c; if (i >= n) s -= rows[i - n].c; out.push(i >= n - 1 ? s / n : null); } return out; }
function dpRet(rows, i, back) { return i >= back ? rows[i].c / rows[i - back].c - 1 : null; }
function dpDate(t) { var d = new Date(t + 9 * 3600e3); return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCDate(); }
function dpYm(t) { var d = new Date(t + 9 * 3600e3); return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1); }
function dpPct(x, d) { return x == null ? "-" : cPct(x, d == null ? 0 : d); }
/* 겹치는 날을 '사건'으로 묶기 — 연속된 조건 충족일은 60일 간격으로 하나만 센다 (한 번의 하락장이 100번으로 세지지 않게) */
function dpSample(idx, rows, gapDays) { var out = [], last = -Infinity; idx.forEach(function (i) { if (rows[i].t - last >= (gapDays || 60) * 86400e3) { out.push(i); last = rows[i].t; } }); return out; }
/* 마스터(SPY) 날짜 기준으로 다른 자산의 특징을 맞춘다 */
var DP_FEAT = null;
function dpFeat() {
  var spy = dpRows("SPY"); if (spy.length < 1500) return null;
  if (DP_FEAT && DP_FEAT.spy === spy) return DP_FEAT;
  var S = { spy: spy, dd: dpDd(spy), ma200: dpMa(spy, 200), tlt: dpRows("TLT"), vix: dpRows("^VIX"), uso: dpRows("USO"), krw: dpRows("KRW=X") };
  S.f = spy.map(function (r, i) {
    var it = dpAt(S.tlt, r.t), iv = dpAt(S.vix, r.t), io = dpAt(S.uso, r.t), ik = dpAt(S.krw, r.t);
    return { i: i, t: r.t, dd: S.dd[i], above200: S.ma200[i] != null ? r.c >= S.ma200[i] : null, m1: dpRet(spy, i, 21),
      tlt1: it > 20 ? dpRet(S.tlt, it, 21) : null, vix: iv >= 0 ? S.vix[iv].c : null, uso1: io > 20 ? dpRet(S.uso, io, 21) : null, krw1: ik > 20 ? dpRet(S.krw, ik, 21) : null };
  });
  DP_FEAT = S; return S;
}
var DP_COND = {
  rateUp: { t: "장기채 1개월 -3% 이하 (금리 급등)", f: function (x) { return x.tlt1 != null && x.tlt1 <= -0.03; } },
  rateDown: { t: "장기채 1개월 +3% 이상 (금리 하락 전환)", f: function (x) { return x.tlt1 != null && x.tlt1 >= 0.03; } },
  panic: { t: "VIX 25 이상 + S&P500 고점 대비 -10%", f: function (x) { return x.vix != null && x.vix >= 25 && x.dd <= -0.1; } },
  oilUp: { t: "원유 1개월 +10% 이상", f: function (x) { return x.uso1 != null && x.uso1 >= 0.1; } },
  dollarUp: { t: "달러/원 1개월 +2% 이상 (달러 강세)", f: function (x) { return x.krw1 != null && x.krw1 >= 0.02; } }
};
/* 조건이 맞았던 날들 → 자산별 6개월·1년 뒤 */
function dpCondStats(id) {
  var S = dpFeat(), C = DP_COND[id]; if (!S || !C) return null;
  var hit = S.f.filter(C.f).map(function (x) { return x.i; }), ev = dpSample(hit, S.spy, 60);
  if (ev.length < 4) return { n: ev.length, assets: [] };
  var assets = ["SPY", "QQQ", "^KS11", "TLT", "GLD", "SCHD", "BTC-USD"].map(function (sym) {
    var rows = dpRows(sym); if (rows.length < 500) return null;
    var r6 = [], r12 = [];
    ev.forEach(function (i) { var j = dpAt(rows, S.spy[i].t); if (j < 0) return; var a = dpFwd(rows, j, 126), b = dpFwd(rows, j, 252); if (a != null) r6.push(a); if (b != null) r12.push(b); });
    if (r12.length < 4) return null;
    return { sym: sym, name: DP_NM[sym], n: r12.length, w6: dpWin(r6), m6: dpMed(r6), w12: dpWin(r12), m12: dpMed(r12), worst12: Math.min.apply(null, r12), best12: Math.max.apply(null, r12) };
  }).filter(Boolean).sort(function (a, b) { return (b.m12 * 0.6 + b.w12 * 0.4) - (a.m12 * 0.6 + a.w12 * 0.4); });
  var years = (S.spy[S.spy.length - 1].t - S.spy[0].t) / (365.25 * 86400e3);
  return { n: ev.length, years: Math.round(years), assets: assets, cond: C.t, last: ev.length ? dpDate(S.spy[ev[ev.length - 1]].t) : "", nowHit: C.f(S.f[S.f.length - 1]) };
}
/* 지금과 가장 닮은 날 — 특징 거리 */
function dpNearest(k) {
  var S = dpFeat(); if (!S) return null;
  var now = S.f[S.f.length - 1], keys = ["dd", "m1", "tlt1", "vix", "uso1", "krw1"], scale = { dd: 0.1, m1: 0.05, tlt1: 0.04, vix: 8, uso1: 0.1, krw1: 0.03 };
  var cand = S.f.filter(function (x) { return x.i < S.f.length - 300 && keys.every(function (kk) { return x[kk] != null && now[kk] != null; }); });
  cand.forEach(function (x) { var d = 0; keys.forEach(function (kk) { var z = (x[kk] - now[kk]) / scale[kk]; d += z * z; }); x.dist = Math.sqrt(d); });
  cand.sort(function (a, b) { return a.dist - b.dist; });
  var pick = []; cand.some(function (x) { if (pick.every(function (p) { return Math.abs(p.t - x.t) >= 120 * 86400e3; })) pick.push(x); return pick.length >= (k || 5); });
  return { now: now, list: pick.map(function (x) { var q = dpRows("QQQ"), g = dpRows("GLD"), tl = dpRows("TLT"); var jq = dpAt(q, x.t), jg = dpAt(g, x.t), jt = dpAt(tl, x.t); return { date: dpDate(x.t), dd: x.dd, vix: x.vix, spy12: dpFwd(S.spy, x.i, 252), qqq12: jq >= 0 ? dpFwd(q, jq, 252) : null, gld12: jg >= 0 ? dpFwd(g, jg, 252) : null, tlt12: jt >= 0 ? dpFwd(tl, jt, 252) : null }; }) };
}
/* 지금 낙폭 구간에서 샀던 날들 */
function dpDipBuy(sym) {
  var rows = dpRows(sym); if (rows.length < 1000) return null;
  var dd = dpDd(rows), cur = dd[dd.length - 1], lo = cur - 0.05, hi = Math.min(-0.03, cur + 0.05);
  var idx = []; for (var i = 0; i < rows.length - 252; i++) if (dd[i] >= lo && dd[i] <= hi) idx.push(i);
  var ev = dpSample(idx, rows, 30); if (ev.length < 5) return { sym: sym, name: DP_NM[sym] || sym, cur: cur, n: ev.length };
  function stats(days) { var a = ev.map(function (i) { return dpFwd(rows, i, days); }).filter(function (x) { return x != null; }); return { w: dpWin(a), m: dpMed(a), worst: Math.min.apply(null, a), best: Math.max.apply(null, a), n: a.length }; }
  // 한 번에 vs 3번 나눠(0·21·42일) — 1년 뒤 같은 날 기준
  var lump = [], split = [];
  ev.forEach(function (i) { if (i + 294 >= rows.length) return; var end = rows[i + 294].c; lump.push(end / rows[i].c - 1); split.push((end / rows[i].c + end / rows[i + 21].c + end / rows[i + 42].c) / 3 - 1); });
  return { sym: sym, name: DP_NM[sym] || sym, cur: cur, n: ev.length, r3: stats(63), r6: stats(126), r12: stats(252), lump: dpMed(lump), split: dpMed(split), lumpWorst: lump.length ? Math.min.apply(null, lump) : null, splitWorst: split.length ? Math.min.apply(null, split) : null, years: Math.round((rows[rows.length - 1].t - rows[0].t) / (365.25 * 86400e3)) };
}
/* 시작 시점별 10년 적립 분포 + 정액 vs 200일선 아래 2배 */
function dpDcaDist(sym, years) {
  var rows = dpRows(sym); if (rows.length < 3000) return null;
  var months = [], seen = {}; rows.forEach(function (r, i) { var d = new Date(r.t), k = d.getUTCFullYear() * 12 + d.getUTCMonth(); if (!seen[k]) { seen[k] = 1; months.push({ i: i, c: r.c, k: k }); } });
  var ma200 = dpMa(rows, 200), N = years * 12, res = [], flat = [], boost = [];
  for (var s = 0; s + N < months.length; s++) {
    var sh = 0, inv = 0, sh2 = 0, inv2 = 0;
    for (var m = s; m < s + N; m++) { var b = months[m], w = ma200[b.i] != null && b.c < ma200[b.i] ? 2 : 1; sh += 1 / b.c; inv += 1; sh2 += w / b.c; inv2 += w; }
    var end = months[s + N].c; res.push({ k: months[s].k, mult: sh * end / inv }); flat.push(sh * end / inv); boost.push(sh2 * end / inv2);
  }
  if (res.length < 24) return null;
  res.sort(function (a, b) { return a.mult - b.mult; });
  var worst = res[0], best = res[res.length - 1], med = res[res.length >> 1];
  function ym(k) { return Math.floor(k / 12) + "." + (k % 12 + 1); }
  return { sym: sym, name: DP_NM[sym] || sym, n: res.length, worst: worst.mult, worstFrom: ym(worst.k), best: best.mult, bestFrom: ym(best.k), med: med.mult, plus: res.filter(function (x) { return x.mult > 1; }).length / res.length, flat: dpMed(flat), boost: dpMed(boost), flatWorst: Math.min.apply(null, flat), boostWorst: Math.min.apply(null, boost) };
}

/* ---------- 문장 조립 (틀이 매번 같지 않게) ---------- */
function dpVerdict(a) {   // 자산 1개의 1년 승률·중앙값 → 한 단어
  if (a.w12 >= 0.8 && a.m12 >= 0.1) return "강했다"; if (a.w12 >= 0.65) return "대체로 올랐다"; if (a.w12 >= 0.5) return "반반이었다"; if (a.w12 >= 0.35) return "자주 밀렸다"; return "약했다";
}
function dpProposal(st) {   // 데이터 기준 제안 (명시적) — 승률·중앙값 상위 3 + 하위 1
  var A = st.assets; if (A.length < 3) return null;
  var top = A.slice(0, 3), bot = A[A.length - 1];
  var strong = top.filter(function (a) { return a.w12 >= 0.65 && a.m12 >= 0.05; });
  var line1 = strong.length ? "1년 승률 상위: " + strong.map(function (a) { return a.name + " " + Math.round(a.w12 * 100) + "%"; }).join(" · ") : "어느 자산도 1년 승률 65%를 넘지 못했다";
  var line2 = bot.w12 < 0.5 ? bot.name + "은 " + Math.round((1 - bot.w12) * 100) + "%의 사례에서 1년 뒤 마이너스였다" : "꼴찌 " + bot.name + "조차 승률 " + Math.round(bot.w12 * 100) + "% — 전체적으로 나쁘지 않은 자리였다";
  var tilt = strong.length ? "신규 자금은 " + strong.slice(0, 2).map(function (a) { return DP_TRADE[a.sym] || a.name; }).join(", ") + " 쪽으로, " + (bot.w12 < 0.5 ? bot.name + "은 추가 매수를 미루는 편이" : "비중은 유지하는 편이") + " 데이터와 맞는다" : "데이터는 '한쪽으로 기울이지 말라'고 말한다 — 균형 구성 유지가 맞는다";
  return { line1: line1, line2: line2, tilt: tilt, strong: strong, bot: bot };
}

/* ---------- 카드 (그리기는 미뤄 둔다: 덱이 관찰 번호·쪽번호를 이어서 넘겨줌) ---------- */
/* dpPlan(kind,id) → [{name, draw:function(c,n,pg,total)}] · 덱은 total에 length를 더하고, 마무리 직전에 차례로 그린다 */
function dpPlan(kind, id) {
  try {
    if (kind === "scene") return dpScenePlan(id);
    if (kind === "drawdown") return dpDrawdownPlan();
    if (kind === "dca") return dpDcaPlan();
  } catch (e) { console.warn("deep", e); }
  return [];
}
function dpDraw(out, plans, n, pg, total) {   // 덱이 마무리 직전에 호출
  plans.forEach(function (p) { var c = nbNew(); n++; pg++; p.draw(c, n, pg, total); out.push({ name: p.name, cv: c.cv }); });
  return { n: n, pg: pg };
}
function dpWinCol(w) { return w >= 0.65 ? NB_C.up : w < 0.5 ? NB_C.down : NB_C.navy; }
function dpScenePlan(id) {
  var st = dpCondStats(id), out = [];
  if (st && st.assets.length >= 3) {
    var A = st.assets, best = A[0], worst = A[A.length - 1];
    out.push({ name: "조건부승률", draw: function (c, n, pg, total) {
      nbTop(c, n, ["조건이 맞았던 [[" + st.n + "번]]의 과거,", "1년 뒤 가장 자주 오른 건 [[" + best.name + "]] (" + Math.round(best.w12 * 100) + "%).", "", nbJosa(worst.name, "은/는") + " " + Math.round(worst.w12 * 100) + "%에서 그쳤다 — " + dpVerdict(worst) + "."], pg, total);
      nbBody(c, "조건부 통계 — " + st.cond, st.years + "년치 일봉 · 조건 충족일을 60일 간격으로 묶어 " + st.n + "번 · 1년 뒤 승률(플러스 비율)·중앙값" + (st.nowHit ? " · 지금 조건 충족" : " · 지금은 조건 밖"));
      nbRows(c, A.map(function (a) { return ["6개월 " + Math.round(a.w6 * 100) + "% · " + dpPct(a.m6), a.name, Math.round(a.w12 * 100) + "% · " + dpPct(a.m12), dpWinCol(a.w12)]; }), 300);
      nbFoot(c, "왼쪽 6개월 승률·중앙값 / 오른쪽 1년 · 과거 통계이며 미래를 보장하지 않음");
    } });
    var pr = dpProposal(st);
    if (pr) out.push({ name: "데이터제안", draw: function (c, n, pg, total) {
      nbTop(c, n, ["데이터가 말하는 제안:", "[[" + (pr.strong.length ? pr.strong.slice(0, 2).map(function (a) { return a.name; }).join(" · ") : "균형 유지") + "]]", "", pr.tilt], pg, total);
      nbBody(c, "이 국면에서 데이터와 맞는 선택", "승률 65% 이상 + 중앙값 +5% 이상인 자산만 '강했다'로 분류 · 최악 사례도 같이 본다");
      nbTable(c, A.slice(0, 4).map(function (a) { return [a.name + " · " + st.n + "번", "1년 승률 " + Math.round(a.w12 * 100) + "% · 중앙값 " + dpPct(a.m12) + " · 최악 " + dpPct(a.worst12) + " · 최고 " + dpPct(a.best12), dpVerdict(a), a.w12 >= 0.65 ? NB_C.up : a.w12 < 0.5 ? NB_C.down : NB_C.gold2]; }));
      nbGoldLine(c, pr.line1, pr.line2);
      nbFoot(c, "데이터 기준 제안 · 1위도 최악 사례 " + dpPct(best.worst12) + "가 있었다 · 투자 판단과 책임은 본인에게");
    } });
  }
  var nr = dpNearest(5);
  if (nr && nr.list.length >= 3) {
    var L = nr.list, up = L.filter(function (x) { return x.spy12 != null && x.spy12 > 0; }).length, m = dpMed(L.map(function (x) { return x.spy12; }).filter(function (x) { return x != null; }));
    out.push({ name: "닮은날", draw: function (c, n, pg, total) {
      nbTop(c, n, ["지금과 가장 닮은 날 [[" + L.length + "개]]를 찾았다.", "그 뒤 1년, S&P500은 " + up + "번 올랐고 중앙값 [[" + dpPct(m) + "]].", "", "낙폭·한 달 추세·금리·VIX·유가·달러 여섯 가지가 가장 비슷했던 날들."], pg, total);
      nbBody(c, "지금과 닮은 과거 — 특징 거리 상위 " + L.length, "고점比 " + dpPct(nr.now.dd) + " · VIX " + (nr.now.vix != null ? nr.now.vix.toFixed(0) : "-") + " · 장기채 1개월 " + dpPct(nr.now.tlt1) + " · 달러 1개월 " + dpPct(nr.now.krw1) + " 와 가까운 순");
      nbTable(c, L.map(function (x) { var parts = [["S&P500", x.spy12], ["나스닥", x.qqq12], ["금", x.gld12], ["장기채", x.tlt12]].filter(function (q) { return q[1] != null; }).map(function (q) { return q[0] + " " + dpPct(q[1]); }); return [x.date + " · VIX " + (x.vix != null ? x.vix.toFixed(0) : "-"), "고점比 " + dpPct(x.dd) + " → 1년 뒤 " + parts.join(" · "), dpPct(x.spy12), x.spy12 > 0 ? NB_C.up : NB_C.down]; }));
      nbFoot(c, "닮았다 ≠ 같다 · 과거 사례 " + L.length + "개는 통계로 보기엔 적은 수");
    } });
  }
  return out;
}
function dpDrawdownPlan() {
  var out = [], R = ["SPY", "QQQ", "^KS11", "GLD", "BTC-USD"].map(dpDipBuy).filter(function (x) { return x && x.r12; });
  if (!R.length) return out;
  var lead = R.filter(function (x) { return x.cur <= -0.05; })[0] || R[0];
  out.push({ name: "이자리에서샀다면", draw: function (c, n, pg, total) {
    nbTop(c, n, ["[[" + lead.name + "]]" + nbJosa(lead.name, "이/가").slice(lead.name.length) + " 지금처럼 " + dpPct(lead.cur) + " 빠져 있던 날 " + lead.n + "번,", "1년 뒤엔 [[" + Math.round(lead.r12.w * 100) + "%]]가 플러스, 중앙값 [[" + dpPct(lead.r12.m) + "]].", "", lead.r12.worst < -0.2 ? "최악은 " + dpPct(lead.r12.worst) + " — 바닥인 줄 알았는데 더 내려간 경우도 있었다." : "최악도 " + dpPct(lead.r12.worst) + " — 이 깊이에선 크게 더 빠진 적이 드물었다."], pg, total);
    nbBody(c, "지금 낙폭(±5%p)에서 샀다면 — 3·6·12개월 뒤", lead.years + "년치 · 비슷한 낙폭이던 날을 30일 간격으로 묶음 · 승률(플러스 비율) · 중앙값");
    nbRows(c, R.map(function (x) { return ["3개월 " + Math.round(x.r3.w * 100) + "% " + dpPct(x.r3.m) + " · 6개월 " + Math.round(x.r6.w * 100) + "% " + dpPct(x.r6.m), x.name + " (지금 " + dpPct(x.cur) + ")", Math.round(x.r12.w * 100) + "% · " + dpPct(x.r12.m), x.r12.w >= 0.7 ? NB_C.up : x.r12.w < 0.5 ? NB_C.down : NB_C.navy]; }), 420);
    nbFoot(c, "오른쪽 = 1년 뒤 승률 · 중앙값 · 낙폭이 거의 없는 자산은 '고점 근처'의 통계");
  } });
  var sp = R.filter(function (x) { return x.lump != null && x.split != null; });
  if (sp.length) {
    var L = sp.filter(function (x) { return x.cur <= -0.05; })[0] || sp[0], better = L.split > L.lump, two = [L].concat(sp.filter(function (x) { return x !== L; }).slice(0, 1));
    out.push({ name: "한번에vs나눠", draw: function (c, n, pg, total) {
      nbTop(c, n, ["이 자리에서 [[한 번에]] 샀다면 1년 뒤 " + dpPct(L.lump) + ",", "[[3번 나눠]] 샀다면 " + dpPct(L.split) + ".", "", better ? "나눠 사는 쪽이 중앙값도, 최악(" + dpPct(L.splitWorst) + " vs " + dpPct(L.lumpWorst) + ")도 나았다." : "한 번에 사는 쪽이 중앙값은 높았지만 최악은 " + dpPct(L.lumpWorst) + "로 더 깊었다."], pg, total);
      nbBody(c, "한 번에 vs 3번 나눠 (0·1·2개월) — 1년 뒤 중앙값", L.name + " 기준 · 같은 날 시작 · 나눠 사기는 3분의 1씩 · 괄호는 최악의 사례");
      nbBars(c, two.map(function (x) { return [{ l: x.name + " 한 번에", v: x.lump, color: NB_C.grey, txt: dpPct(x.lump) + " (" + dpPct(x.lumpWorst) + ")" }, { l: x.name + " 나눠", v: x.split, color: x.split >= x.lump ? NB_C.up : NB_C.navy, txt: dpPct(x.split) + " (" + dpPct(x.splitWorst) + ")" }]; }).reduce(function (a, b) { return a.concat(b); }, []));
      nbGoldLine(c, better ? "제안: 지금 자리에선 3회 분할이 데이터와 맞는다" : "제안: 더 빠질 여지를 두고도 한 번에 사는 쪽이 유리했다", "낙폭이 깊어질수록 '나눠'의 이점이 커지고, 반등이 빠를수록 '한 번에'가 유리했다");
      nbFoot(c, "데이터 기준 제안 · 수수료·세금 제외 · 투자 판단과 책임은 본인에게");
    } });
  }
  return out;
}
function dpDcaPlan() {
  var out = [], D = ["SPY", "QQQ", "^KS11", "GLD"].map(function (s) { return dpDcaDist(s, 10); }).filter(Boolean);
  if (!D.length) return out;
  var S = D[0];
  out.push({ name: "시작시점분포", draw: function (c, n, pg, total) {
    nbTop(c, n, ["10년 적립을 [[" + S.n + "가지 시작 시점]]으로 돌려 봤다.", "최악 " + S.worstFrom + " 시작 " + S.worst.toFixed(2) + "배, 최고 " + S.bestFrom + " 시작 [[" + S.best.toFixed(2) + "배]].", "", Math.round(S.plus * 100) + "%의 시작 시점에서 넣은 돈보다 많았다."], pg, total);
    nbBody(c, "언제 시작했느냐에 따라 10년 적립 결과는", "시작 달을 한 달씩 옮겨 " + S.n + "번 · 오른쪽 = 중앙값 배수 · 플러스 비율 · 배당·환율 제외");
    nbRows(c, D.map(function (x) { return ["최악 " + x.worst.toFixed(2) + "배(" + x.worstFrom + ") · 최고 " + x.best.toFixed(2) + "배(" + x.bestFrom + ")", x.name, x.med.toFixed(1) + "배 · " + Math.round(x.plus * 100) + "%", x.plus >= 0.9 ? NB_C.up : x.plus < 0.6 ? NB_C.down : NB_C.navy]; }), 470);
    nbFoot(c, "최악의 시작 시점도 결과가 이만큼 — 시점보다 기간이 결과를 정했다");
  } });
  var B = D.filter(function (x) { return x.boost != null; }), bb = B[0];
  if (bb) {
    var gain = bb.boost - bb.flat;
    out.push({ name: "정액vs2배", draw: function (c, n, pg, total) {
      nbTop(c, n, ["200일선 아래일 땐 [[2배]]로 샀다면,", "10년 뒤 " + bb.flat.toFixed(2) + "배 → [[" + bb.boost.toFixed(2) + "배]].", "", gain > 0.05 ? "싼 구간에 더 넣는 규칙 하나가 결과를 바꿨다." : gain > 0 ? "차이는 작았다 — 규칙보다 꾸준함이 컸다." : "오히려 손해였다 — 하락이 길면 2배 적립이 더 깊이 들어간다."], pg, total);
      nbBody(c, "정액 적립 vs 200일선 아래 2배 적립 — 10년 중앙값", bb.name + " 기준 · 시작 시점 " + bb.n + "가지의 중앙값 · 넣은 돈 대비 배수 · 괄호는 최악 시작 시점");
      nbBars(c, B.slice(0, 2).map(function (x) { return [{ l: x.name + " 정액", v: x.flat - 1, color: NB_C.grey, txt: x.flat.toFixed(1) + "배 (" + x.flatWorst.toFixed(1) + ")" }, { l: x.name + " 2배 규칙", v: x.boost - 1, color: x.boost >= x.flat ? NB_C.up : NB_C.navy, txt: x.boost.toFixed(1) + "배 (" + x.boostWorst.toFixed(1) + ")" }]; }).reduce(function (a, b) { return a.concat(b); }, []));
      nbGoldLine(c, gain > 0 ? "제안: 200일선 아래 달엔 적립액을 늘리는 규칙을 둘 만하다" : "제안: 규칙을 복잡하게 하지 말고 정액을 지키는 편이 낫다", "막대는 '넣은 돈 대비 수익'(배수-1) · 규칙은 미리 정해 두고 기계적으로");
      nbFoot(c, "데이터 기준 제안 · 수수료·세금·환율 제외 · 투자 판단과 책임은 본인에게");
    } });
  }
  return out;
}
