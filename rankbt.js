/* ============================================================
   v13.50 점수 검증 (rankbt.js) — "과거에 이 점수가 높았던 종목이 그 뒤 정말 더 올랐나"
   방법 (되돌려 보기 · 백테스트)
     1) 과거 시점을 잡는다: 최근 13년의 6월 말 · 12월 말 (1년 뒤 결과가 있는 시점까지)
     2) 그 시점까지의 시세만 남기고(그 뒤는 가린다) 지금과 똑같은 방법으로 항목 점수를 매긴다
        — 기업 정보(ROE 등)와 매크로는 그때 값을 알 수 없어 뺀다 (지금 값을 쓰면 미래를 미리 본 셈이 된다)
     3) 그 시점에서 252거래일(1년) 뒤 수익률을 붙인다
     4) 시점마다 점수 순으로 줄 세워: 5등분 평균 수익, 순위상관(점수 순위와 수익 순위가 얼마나 같이 가나), 상위 10개 성적
   한계: 지금 목록에 남아 있는 종목만 본다(사라진 종목이 빠져 실제보다 좋게 나온다), 시점들이 서로 겹친다,
         기준 숫자는 과거를 보고 맞춘 것이 아니라 사람이 정한 값이다(그래서 과하게 맞춘 결과는 아니다).
   새 api 함수 없음 · 서버 호출은 종목 시세 받기뿐(순위 계산과 같은 주소라 30분 안에는 다시 받지 않는다).
   ============================================================ */
var RB = { obs: null, run: false, done: 0, total: 0, dates: null, saved: null };
var RB_SKIP = { roe: 1, margin: 1, revg: 1, opg: 1, per: 1, vix: 1, fed: 1, us10: 1, krw: 1 };
function rbDates() { var now = Date.now(), y = new Date(now).getUTCFullYear(), a = []; for (var k = y - 13; k <= y; k++) { a.push(Date.UTC(k, 5, 30, 23)); a.push(Date.UTC(k, 11, 31, 23)); } return a.filter(function (t) { return t <= now - 372 * 86400e3; }); }
function rbIdx(rows, T) { var lo = 0, hi = rows.length - 1, r = -1; while (lo <= hi) { var m = (lo + hi) >> 1; if (rows[m].t <= T) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
function rbSpear(x, y) {
  var n = x.length; if (n < 8) return null;
  var rk = function (a) { var o = a.map(function (v, i) { return [v, i]; }).sort(function (p, q) { return p[0] - q[0]; }), r = new Array(n), i = 0; while (i < n) { var j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; var avg = (i + j) / 2 + 1; for (var k = i; k <= j; k++) r[o[k][1]] = avg; i = j + 1; } return r; };
  var a = rk(x), b = rk(y), ma = (n + 1) / 2, sxy = 0, sxx = 0, syy = 0; for (var i = 0; i < n; i++) { sxy += (a[i] - ma) * (b[i] - ma); sxx += (a[i] - ma) * (a[i] - ma); syy += (b[i] - ma) * (b[i] - ma); }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
function rbMean(a) { a = a.filter(function (v) { return v != null && isFinite(v); }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
function rbMed(a) { return typeof ddMed === "function" ? ddMed(a) : null; }

/* ---------- 과거 시점마다 점수 매기기 ---------- */
function rbRun(onTick) {
  if (RB.run) return Promise.resolve(RB.obs);
  var list = egScanList().filter(function (s) { return !DD_LEV[s] && !(typeof egLev === "function" && egLev(s)); }), dates = rbDates(), obs = [], had = {}, idx = 0;
  Object.keys(nbHist).forEach(function (k) { had[k] = 1; }); RB.run = true; RB.done = 0; RB.total = list.length; RB.dates = dates;
  var wipe = function (sym) { try { Object.keys(EG.memo).forEach(function (k) { if (k.indexOf(":" + sym + ":") > 0 || k.indexOf(sym + ":") === 0) delete EG.memo[k]; }); Object.keys(DD.memo).forEach(function (k) { if (k.indexOf(sym + ":") === 0) delete DD.memo[k]; }); Object.keys(EG).forEach(function (k) { if (/^(sm|sd|sw|w|rw|cd|cr):/.test(k) && k.indexOf(sym) >= 0) delete EG[k]; }); } catch (e) {} };
  var one = function () {
    if (idx >= list.length) return Promise.resolve(); var sym = list[idx++];
    return nbLoad([sym]).catch(function () {}).then(function () {
      var full = nbHist[sym]; if (!full || full.length < 1260 + 252 + 5) return;
      var fSave = typeof CORE !== "undefined" ? CORE.fund[sym] : undefined, hadF = typeof CORE !== "undefined" && (sym in CORE.fund);
      try {
        if (typeof CORE !== "undefined") delete CORE.fund[sym];
        for (var k = 0; k < dates.length; k++) {
          var i = rbIdx(full, dates[k]); if (i < 1260 || i + 252 >= full.length) continue;
          if (dates[k] - full[i].t > 12 * 86400e3) continue;                // 그 무렵 거래가 없던 종목
          nbHist[sym] = full.slice(0, i + 1); wipe(sym);
          var R = null; try { R = rkScore(sym); } catch (e) {}
          if (!R) continue; var m = {}; Object.keys(R.map).forEach(function (key) { if (!RB_SKIP[key]) m[key] = R.map[key]; });
          obs.push({ s: sym, d: k, i: m, u: rkAbove200(sym), f: full[i + 252].c / full[i].c - 1 });
        }
      } finally { nbHist[sym] = full; wipe(sym); if (typeof CORE !== "undefined") { if (hadF) CORE.fund[sym] = fSave; else delete CORE.fund[sym]; } if (!had[sym]) delete nbHist[sym]; }
    }).then(function () { RB.done++; if (onTick) onTick(); return new Promise(function (ok) { setTimeout(ok, 0); }); }).then(one);
  };
  return Promise.all([one(), one(), one()]).then(function () { RB.obs = obs; RB.run = false; RB.at = Date.now(); rbSave(); rbSaveObs(); return obs; }).catch(function (e) { RB.run = false; throw e; });
}

/* ---------- 집계 ---------- */
/* opt: { off: 항목 제외표, W: 비중, keep(d): 쓸 시점 } — 없으면 지금 화면 설정 */
function rbAgg(obs, fit, dates, opt) {
  opt = opt || {}; var W = opt.W || rkW(), byD = {}, per = [], pool = [], gIC = [[], [], [], []], bySym = {};
  obs.forEach(function (o) { if (opt.keep && !opt.keep(o.d)) return; (byD[o.d] = byD[o.d] || []).push(o); });
  Object.keys(byD).sort(function (a, b) { return a - b; }).forEach(function (d) {
    var a = byD[d]; if (a.length < 25) return;
    var M = rkMoods(a), all = { up: 0, n: 0 }; a.forEach(function (o) { if (o.u != null) { all.n++; all.up += o.u; } });
    var rows = a.map(function (o) { var PT = rkPT(o.i, false, W, opt.off, opt.role), gs = rkGsOf(o.i, false, null, rkRoleOff("any", opt.off, opt.role)).gs; return { t: PT.p, tm: PT.t, gs: gs, f: o.f, v: rkVerdict(PT.p, PT.t)[0], b: PT.p, s: o.s }; }).filter(function (r) { return r.t != null; });
    if (rows.length < 25) return; rows.sort(function (x, y) { return y.t - x.t; });
    var n = rows.length, q = [], uni = rbMean(rows.map(function (r) { return r.f; })), uniMed = rbMed(rows.map(function (r) { return r.f; }));
    for (var k = 0; k < 5; k++) { var part = rows.slice(Math.round(n * k / 5), Math.round(n * (k + 1) / 5)).map(function (r) { return r.f; }); q.push({ mean: rbMean(part), med: rbMed(part), pos: part.filter(function (v) { return v > 0; }).length / part.length }); }
    var top10 = rows.slice(0, 10).map(function (r) { return r.f; }), strong = rows.filter(function (r) { return r.b >= 60; }).slice(0, 10).map(function (r) { return r.f; });
    for (var g = 0; g < 4; g++) { var rr = rows.filter(function (r) { return r.gs[g] != null; }); gIC[g].push(rbSpear(rr.map(function (r) { return r.gs[g]; }), rr.map(function (r) { return r.f; }))); }
    rows.forEach(function (r, k2) { r.ex = r.f - uniMed; r.pr = k2 / n; r.v = rkVerdict(r.t, r.tm, r.pr)[0]; });   // 같은 시점 중앙값 대비 · 종목 점수 순위(0 = 가장 높음)
    var tr2 = rows.filter(function (r) { return r.tm != null; });
    per.push({ d: +d, t: dates ? dates[d] : null, n: n, uni: uni, uniMed: uniMed, q: q, tic: rbSpear(tr2.map(function (r) { return r.tm; }), tr2.map(function (r) { return r.f; })), ic: rbSpear(rows.map(function (r) { return r.t; }), rows.map(function (r) { return r.f; })), top10: rbMean(top10), top10Med: rbMed(top10), strong10: strong.length >= 5 ? rbMean(strong) : null, mood: rkMoodOf(all.up, all.n), up: all.n ? all.up / all.n : null });
    rows.forEach(function (r) { pool.push(r); (bySym[r.s] = bySym[r.s] || []).push(r); });
  });
  if (!per.length) return null;
  var ics = per.map(function (p) { return p.ic; }).filter(function (v) { return v != null; }), share = function (f) { return per.filter(f).length / per.length; };
  var Q = [0, 1, 2, 3, 4].map(function (k) { return { mean: rbMean(per.map(function (p) { return p.q[k].mean; })), med: rbMean(per.map(function (p) { return p.q[k].med; })), pos: rbMean(per.map(function (p) { return p.q[k].pos; })) }; });
  var band = [[80, 101, "80 이상"], [68, 80, "68~79"], [55, 68, "55~67"], [42, 55, "42~54"], [0, 42, "42 미만"]].map(function (b) { var a = pool.filter(function (r) { return r.tm != null && r.tm >= b[0] && r.tm < b[1]; }).map(function (r) { return r.f; }); return { n: b[2], c: a.length, med: rbMed(a), mean: rbMean(a), pos: a.length ? a.filter(function (v) { return v > 0; }).length / a.length : null }; });
  var vs = {}; pool.forEach(function (r) { (vs[r.v] = vs[r.v] || []).push(r.f); });
  var verd = Object.keys(vs).map(function (k) { var a = vs[k]; return { n: k, c: a.length, med: rbMed(a), mean: rbMean(a), pos: a.filter(function (v) { return v > 0; }).length / a.length }; }).sort(function (x, y) { return (y.med || 0) - (x.med || 0); });
  var byMood = ["up", "mid", "down"].map(function (m) { var a = per.filter(function (p) { return p.mood === m; }); return { m: m, c: a.length, ic: rbMean(a.map(function (p) { return p.ic; })), ex: rbMean(a.map(function (p) { return p.q[0].mean - p.uni; })), uni: rbMean(a.map(function (p) { return p.uni; })) }; });
  /* '언제'의 힘: 같은 종목 안에서, 점수가 높았던 시점의 1년 뒤가 그 종목의 다른 시점보다 좋았나 (8개 시점 이상인 종목만) */
  var wAll = [], wP = [], wG = [[], [], [], []];
  Object.keys(bySym).forEach(function (k) { var a = bySym[k]; if (a.length < 8) return; var f = a.map(function (r) { return r.f; }); wP.push(rbSpear(a.map(function (r) { return r.t; }), f)); var at = a.filter(function (r) { return r.tm != null; }); if (at.length >= 8) wAll.push(rbSpear(at.map(function (r) { return r.tm; }), at.map(function (r) { return r.f; }))); for (var g = 0; g < 4; g++) { var rr = a.filter(function (r) { return r.gs[g] != null; }); if (rr.length >= 8) wG[g].push(rbSpear(rr.map(function (r) { return r.gs[g]; }), rr.map(function (r) { return r.f; }))); } });
  var wst = function (a) { var v = a.filter(function (x) { return x != null; }); return { ic: rbMean(v), pos: v.length ? v.filter(function (x) { return x > 0; }).length / v.length : null, n: v.length }; };
  /* 두 점수의 조합: 종목 점수는 그 시점의 순위로(상위 30% / 가운데 / 하위 30%), 타이밍 점수는 판정과 같은 선(68 이상 / 52~67 / 52 미만)으로 */
  var mat = [["상위 30%", function (r) { return r.pr < 0.3; }], ["가운데 40%", function (r) { return r.pr >= 0.3 && r.pr < 0.7; }], ["하위 30%", function (r) { return r.pr >= 0.7; }]].map(function (P) {
    return { n: P[0], c: [["68 이상", function (r) { return r.tm >= 68; }], ["52~67", function (r) { return r.tm >= 52 && r.tm < 68; }], ["52 미만", function (r) { return r.tm < 52; }]].map(function (T) { var a = pool.filter(function (r) { return r.tm != null && P[1](r) && T[1](r); }); return { n: T[0], c: a.length, med: rbMed(a.map(function (r) { return r.f; })), ex: rbMed(a.map(function (r) { return r.ex; })), pos: a.length ? a.filter(function (r) { return r.f > 0; }).length / a.length : null }; }) }; });
  var tics = per.map(function (p) { return p.tic; }).filter(function (v) { return v != null; });
  var out = { mat: mat, tic: rbMean(tics), wP: wst(wP), wic: wst(wAll), wG: wG.map(wst), fit: !!fit, nDates: per.length, nObs: pool.length, from: per[0].t, to: per[per.length - 1].t, ic: rbMean(ics), icPos: ics.length ? ics.filter(function (v) { return v > 0; }).length / ics.length : null,
    Q: Q, spread: Q[0].mean - Q[4].mean, spreadMed: Q[0].med - Q[4].med, topWin: share(function (p) { return p.q[0].mean > p.uni; }), topWinMed: share(function (p) { return p.q[0].med > p.uniMed; }), uni: rbMean(per.map(function (p) { return p.uni; })), uniMed: rbMean(per.map(function (p) { return p.uniMed; })),
    top10: rbMean(per.map(function (p) { return p.top10; })), top10Win: share(function (p) { return p.top10 > p.uni; }), strong10: rbMean(per.map(function (p) { return p.strong10; })), strong10Win: (function () { var a = per.filter(function (p) { return p.strong10 != null; }); return a.length ? a.filter(function (p) { return p.strong10 > p.uni; }).length / a.length : null; })(),
    gIC: gIC.map(function (a) { var v = a.filter(function (x) { return x != null; }); return { ic: rbMean(v), pos: v.length ? v.filter(function (x) { return x > 0; }).length / v.length : null }; }), band: band, verd: verd, byMood: byMood,
    per: per.map(function (p) { return { t: p.t, n: p.n, ic: p.ic, top: p.q[0].mean, bot: p.q[4].mean, uni: p.uni, mood: p.mood }; }) };
  out.verdict = rbVerdict(out); return out;
}
function rbVerdict(a) {
  if (a.ic == null || a.nDates < 8) return ["판정하기엔 시점이 부족해요", "검증에 쓸 수 있는 시점이 " + a.nDates + "개뿐이에요. 종목들의 과거 시세가 더 길게 쌓여야 판단할 수 있어요 — 아래 숫자는 참고만 하세요.", "mid"];
  var pk = a.ic >= 0.05 && a.icPos >= 0.6 ? 2 : a.ic >= 0.03 && a.icPos >= 0.55 ? 1 : a.ic <= -0.02 ? -1 : 0, w = a.wic || {}, tm = w.ic >= 0.1 && w.pos >= 0.65 ? 2 : w.ic >= 0.04 && w.pos >= 0.55 ? 1 : w.ic <= -0.04 ? -1 : 0;
  var P = ["종목 점수는 거꾸로 갔어요", "종목 점수는 구분하는 힘이 없었어요", "종목 점수는 약하게 맞았어요", "종목 점수는 맞았어요"][pk + 1], T = ["타이밍 점수는 거꾸로 갔어요", "타이밍 점수는 힘이 없었어요", "타이밍 점수는 약하게 맞았어요", "타이밍 점수는 맞았어요"][tm + 1];
  var txt = "무엇을(같은 시점의 종목끼리): 종목 점수 순위상관 " + (a.ic >= 0 ? "+" : "") + a.ic.toFixed(3) + ", 맞은 시점 " + Math.round(a.icPos * 100) + "%. 언제(같은 종목의 시점끼리): 타이밍 점수 순위상관 " + (w.ic == null ? "–" : (w.ic >= 0 ? "+" : "") + w.ic.toFixed(3)) + ", 맞은 종목 " + (w.pos == null ? "–" : Math.round(w.pos * 100) + "%") + ". 순위상관은 +0.05면 쓸 만한 수준이고, 맞아도 약한 신호예요 — 점수 하나로 사고팔기보다 후보를 좁히고 나눠 사는 기준으로 쓰세요.";
  return [P + " · " + T, txt, pk >= 1 && tm >= 1 ? "up" : pk < 0 || tm < 0 ? "down" : "mid"];
}
/* 시점별 항목 점수를 이 기기에 보관 — 항목 · 비중을 바꿔 볼 때 5분짜리 검증을 다시 돌리지 않아도 되게 */
function rbSaveObs() { try { var keys = RK_I.map(function (I) { return I[0]; }).filter(function (k) { return !RB_SKIP[k]; }); localStorage.setItem("sm.rank.btobs", JSON.stringify({ at: RB.at, dates: RB.dates, keys: keys, rows: RB.obs.map(function (o) { return [o.s, o.d, o.u == null ? -1 : o.u, Math.round(o.f * 1e4) / 1e4, keys.map(function (k) { return o.i[k] == null ? -1 : o.i[k]; })]; }) })); } catch (e) { try { localStorage.removeItem("sm.rank.btobs"); } catch (x) {} } }
function rbLoadObs() { if (RB.obs || RB._tried) return; RB._tried = 1; try { var v = JSON.parse(localStorage.getItem("sm.rank.btobs") || "null"); if (!v || !v.rows || !v.keys) return; RB.obs = v.rows.map(function (r) { var m = {}; v.keys.forEach(function (k, j) { if (r[4][j] >= 0) m[k] = r[4][j]; }); return { s: r[0], d: r[1], u: r[2] < 0 ? null : r[2], f: r[3], i: m }; }); RB.dates = v.dates; RB.at = v.at; } catch (e) {} }

/* ---------- 항목 하나하나가 맞았나 ---------- */
function rbDateList(obs) { var c = {}; obs.forEach(function (o) { c[o.d] = (c[o.d] || 0) + 1; }); return Object.keys(c).map(Number).filter(function (d) { return c[d] >= 25; }).sort(function (a, b) { return a - b; }); }
function rbItems(obs, keep, minW) {
  var D = rbDateList(obs).filter(function (d) { return !keep || keep(d); }), byD = {}, bySym = {}; obs.forEach(function (o) { if (D.indexOf(o.d) < 0) return; (byD[o.d] = byD[o.d] || []).push(o); (bySym[o.s] = bySym[o.s] || []).push(o); });
  var half = D[Math.floor(D.length / 2)];
  return RK_I.filter(function (I) { return !RB_SKIP[I[0]]; }).map(function (I) {
    var k = I[0], ics = [], a1 = [], a2 = [];
    D.forEach(function (d) { var a = byD[d].filter(function (o) { return o.i[k] != null; }); if (a.length < 20) return; var ic = rbSpear(a.map(function (o) { return o.i[k]; }), a.map(function (o) { return o.f; })); if (ic == null) return; ics.push(ic); (d < half ? a1 : a2).push(ic); });
    var w = []; Object.keys(bySym).forEach(function (s) { var a = bySym[s].filter(function (o) { return o.i[k] != null; }); if (a.length >= (minW || 8)) { var x = rbSpear(a.map(function (o) { return o.i[k]; }), a.map(function (o) { return o.f; })); if (x != null) w.push(x); } });
    return { k: k, g: I[1], n: I[2], ic: rbMean(ics), pos: ics.length ? ics.filter(function (v) { return v > 0; }).length / ics.length : null, nd: ics.length, ic1: rbMean(a1), ic2: rbMean(a2), wic: rbMean(w), wpos: w.length ? w.filter(function (v) { return v > 0; }).length / w.length : null, wn: w.length };
  });
}
/* ---------- 데이터가 제안하는 구성: 앞 절반 시점으로 정하고, 뒤 절반 시점으로 확인 ---------- */
function rbSuggest(obs, dates) {
  var D = rbDateList(obs); if (D.length < 12) return null; var cut = D[Math.floor(D.length / 2)], tr = function (d) { return d < cut; }, te = function (d) { return d >= cut; };
  var it = rbItems(obs, tr, 6), pick = [], time = [];
  it.forEach(function (x) { var p = x.nd >= 5 && x.ic != null && x.ic >= 0.02 && x.pos >= 0.55, t = x.wn >= 20 && x.wic != null && x.wic >= 0.05 && x.wpos >= 0.6; if (p && t) { if (x.ic / 0.03 >= x.wic / 0.1) t = false; else p = false; } if (p) pick.push(x.k); else if (t) time.push(x.k); });
  if (!pick.length || !time.length) return { none: 1, cut: dates ? dates[cut] : null };
  /* 검증할 수 없는 항목(기업 정보 · 매크로)은 기본 역할 그대로 */
  var role = { pick: pick.concat(RK_ROLE_DEF.pick.filter(function (k) { return RB_SKIP[k]; })), time: time.concat(RK_ROLE_DEF.time.filter(function (k) { return RB_SKIP[k]; })) };
  return { role: role, pick: pick, time: time, cut: dates ? dates[cut] : null, nTr: D.filter(tr).length, nTe: D.filter(te).length,
    curTr: rbAgg(obs, false, dates, { keep: tr }), curTe: rbAgg(obs, false, dates, { keep: te }), sugTr: rbAgg(obs, false, dates, { role: role, keep: tr }), sugTe: rbAgg(obs, false, dates, { role: role, keep: te }) };
}
/* ---------- 풀이: 항목 하나하나를 말로 ---------- */
function rbRead(x) {
  var c = RK_CRIT[x.k] || ["", ""], ro = rkRoleOf(x.k), sg = function (v) { return (v >= 0 ? "+" : "") + v.toFixed(3); }, pc = function (v) { return Math.round(v * 100) + "%"; };
  var a = x.ic == null ? "같은 날 종목끼리 견줄 만큼 자료가 모이지 않았어요." : "같은 날 종목끼리 견주면 순위상관 " + sg(x.ic) + ", " + x.nd + "개 시점 가운데 " + pc(x.pos) + "에서 방향이 맞았어요 — 종목을 고르는 데 " + (x.ic >= 0.03 && x.pos >= 0.55 ? "도움이 됐어요." : x.ic <= -0.03 && x.pos <= 0.45 ? "오히려 방해가 됐어요(점수가 높은 종목이 덜 올랐어요)." : "뚜렷한 힘이 없었어요.");
  var b = x.wic == null ? "같은 종목의 시점끼리 견줄 만큼 자료가 모이지 않았어요." : "같은 종목의 시점끼리 견주면 순위상관 " + sg(x.wic) + ", " + x.wn + "종목 가운데 " + pc(x.wpos) + "에서 방향이 맞았어요 — 살 시기를 고르는 데 " + (x.wic >= 0.05 && x.wpos >= 0.6 ? "도움이 됐어요." : x.wic <= -0.05 && x.wpos <= 0.4 ? "오히려 방해가 됐어요(점수가 높았던 때 사면 결과가 나빴어요)." : "뚜렷한 힘이 없었어요.");
  var st = x.ic1 != null && x.ic2 != null ? (x.ic1 > 0 && x.ic2 > 0 ? "앞 절반(" + x.ic1.toFixed(2) + ")과 뒤 절반(" + x.ic2.toFixed(2) + ") 모두 플러스라 우연일 가능성은 낮아요." : x.ic1 < 0 && x.ic2 < 0 ? "앞 절반과 뒤 절반 모두 마이너스였어요." : "앞 절반(" + x.ic1.toFixed(2) + ")과 뒤 절반(" + x.ic2.toFixed(2) + ")의 방향이 달라요 — 한쪽 기간에만 맞았을 수 있어 다음 검증에서 다시 봐야 해요.") : x.ic1 == null && x.ic2 != null ? "앞 절반에는 사례가 없고 뒤 절반에만 있어요 — 사례가 적어 숫자를 그대로 믿기 어려워요." : "";
  var why = ro === "pick" ? (x.ic != null && x.ic >= 0.03 && x.pos >= 0.55 ? "그래서 종목 점수에 넣었어요." : x.ic != null && x.ic > 0 ? "힘은 약하지만 방향이 맞아 종목 점수에 넣었어요." : "성격상 종목 항목으로 뒀지만 이번 검증에서는 근거가 약해요.")
    : ro === "time" ? (x.wic != null && x.wic >= 0.05 && x.wpos >= 0.6 ? "그래서 타이밍 점수에 넣었어요." : x.wic == null ? "사례가 적어 검증은 못 했지만, 드문 깊이를 나타내는 항목이라 타이밍 점수에 뒀어요." : "힘은 약하지만 타이밍 점수에 뒀어요.")
    : "어느 쪽에도 꾸준히 맞지 않아 점수에는 넣지 않고, 종목 상세 화면에서 값만 참고로 보여 줘요.";
  return { what: c[1], how: c[0], a: a, b: b, st: st, why: why, ro: ro };
}
var RB_TERMS = [
  ["무엇을 (종목끼리)", "\"오늘 어떤 종목을 고를까\"에 대한 답이에요. 같은 날짜에 있던 종목들을 그 항목 점수가 높은 순으로 줄 세우고, 1년 뒤 실제로 많이 오른 순서와 얼마나 같았는지를 봐요. 이 값이 플러스면 점수가 높았던 종목이 더 올랐다는 뜻이에요."],
  ["언제 (시점끼리)", "\"이 종목을 언제 살까\"에 대한 답이에요. 한 종목만 놓고, 그 종목의 여러 시점(2013년 6월, 12월 …)을 항목 점수가 높았던 순으로 줄 세워 그 뒤 1년 수익 순서와 견줘요. 종목마다 따로 계산해 평균을 낸 값이에요. 플러스면 그 종목 안에서 점수가 높았던 때 산 쪽이 결과가 좋았다는 뜻이에요."],
  ["순위상관", "두 가지 순서가 얼마나 같은지를 -1에서 +1 사이 숫자로 나타낸 값이에요. +1이면 순서가 완전히 같고, 0이면 아무 관계가 없고, -1이면 정반대예요. 주식 점수에서는 +0.05만 돼도 쓸 만하고 +0.1이면 강한 편이에요. 숫자가 작아 보여도 수백 종목에 걸쳐 꾸준하면 의미가 있어요."],
  ["맞은 시점", "\"무엇을\" 쪽 숫자예요. 검증한 시점(6개월 간격) 가운데 그 시점의 순위상관이 플러스였던 비율이에요. 50%면 동전 던지기와 같고, 60%를 넘으면 꾸준한 편이에요."],
  ["앞 절반 · 뒤 절반", "검증 시점을 시간 순으로 반으로 나눠 따로 계산한 순위상관이에요. 두 숫자의 부호가 같으면 한때의 우연이 아닐 가능성이 높고, 부호가 다르면 특정 시기에만 맞았을 수 있어요."],
  ["맞은 종목", "\"언제\" 쪽 숫자예요. 종목마다 계산한 순위상관이 플러스였던 종목의 비율이에요(8개 시점 이상 자료가 있는 종목만). 80%라면 열 종목 중 여덟 종목에서 그 항목이 살 시기를 맞혔다는 뜻이에요."],
  ["도움 · 무관 · 방해", "\"무엇을\"은 순위상관 +0.03 이상이고 맞은 시점 55% 이상이면 도움, -0.03 이하이고 45% 이하면 방해, 그 사이는 무관이에요. \"언제\"는 +0.05 이상이고 맞은 종목 60% 이상이면 도움, -0.05 이하이고 40% 이하면 방해예요. 방해는 그 항목 점수가 높을수록 결과가 나빴다는 뜻이라, 그쪽 점수에 넣으면 안 돼요."],
  ["지금 쓰임", "그 항목이 지금 어느 점수에 들어가는지예요. 종목 = 종목 점수(순위를 매기는 점수)에 들어가요. 타이밍 = 타이밍 점수(지금 살 때인지 보는 점수)에 들어가요. 참고 = 어느 점수에도 넣지 않고 종목 상세 화면에서 값만 보여 줘요. 제외 = 직접 꺼 둔 항목이에요."],
  ["종목 점수", "\"무엇을\"에 도움이 된 항목만 모아 낸 점수예요. 종목 순위는 이 점수로 매겨요. 같은 날 다른 종목과 견주는 용도라, 한 종목의 점수가 시간이 지나며 오르내리는 것은 큰 의미가 없어요."],
  ["타이밍 점수", "\"언제\"에 도움이 된 항목만 모아 낸 점수예요. 한 종목의 평소와 지금을 견주는 용도예요. 그래서 서로 다른 종목의 타이밍 점수를 견줘 \"더 높은 쪽을 산다\"는 식으로 쓰면 안 돼요 — 실제로 타이밍 점수로 종목을 줄 세우면 결과가 거꾸로 나왔어요."],
  ["상위 20% · 5등분", "그 시점의 종목을 종목 점수 순으로 다섯 묶음으로 나눈 거예요. 상위 20%가 하위 20%보다 1년 뒤 수익이 높으면 점수가 제 역할을 한 거예요."],
  ["평균과 중앙값", "평균은 크게 오른 몇 종목(특히 코인)에 끌려가요. 중앙값은 한가운데 종목의 수익이라 \"보통 어땠나\"를 더 잘 보여 줘요. 둘이 다르게 나오면 중앙값과 플러스 비율을 믿는 편이 안전해요."],
  ["같은 시점 대비 (%p)", "그 종목의 1년 뒤 수익에서 같은 날 전체 종목의 중앙값을 뺀 값이에요. 시장 전체가 오른 효과를 빼고 \"다른 종목보다 얼마나 더\"를 보려는 거예요. %p는 퍼센트끼리의 차이를 뜻해요."]
];
function rbSig() { var R = rkRole(); return JSON.stringify([Object.keys(rkOff()).sort(), rkW(), R.pick.slice().sort(), R.time.slice().sort(), 2]); }
function rbCur() { rbLoadObs(); if (!RB.obs) return null; var sig = rbSig(); if (RB._c && RB._sig === sig && RB._at === RB.at) return RB._c; RB._c = { fit: rbAgg(RB.obs, true, RB.dates), flat: rbAgg(RB.obs, false, RB.dates), items: rbItems(RB.obs), sug: rbSuggest(RB.obs, RB.dates) }; RB._sig = sig; RB._at = RB.at; return RB._c; }
function rbSave() { try { var c = rbCur(); if (!c || !c.fit) return; localStorage.setItem("sm.rank.bt", JSON.stringify({ at: RB.at, sig: rbSig(), fit: c.fit, flat: c.flat })); } catch (e) {} }
function rbLoadSaved() { if (RB.saved !== null) return RB.saved; var v = false; try { v = JSON.parse(localStorage.getItem("sm.rank.bt") || "false"); } catch (e) {} return (RB.saved = v || false); }

/* ---------- 화면 ---------- */
function rbP(v, d) { return typeof ddPct === "function" ? ddPct(v, d == null ? 1 : d) : String(v); }
function rbHtml() {
  var cur = rbCur(), saved = !cur ? rbLoadSaved() : null, C = cur || (saved ? { fit: saved.fit, flat: saved.flat } : null), stale = !cur && saved && saved.sig !== rbSig(), h = '';
  h += '<details class="egBox rkHow rbBox"' + (RB.open || RB.run ? " open" : "") + '><summary>점수 검증 — 과거에 이 점수가 높았던 종목이 정말 더 올랐나' + (C && C.fit && (C.flat || C.fit).verdict ? ' <em>' + rkEsc((C.flat || C.fit).verdict[0]) + '</em>' : ' <em>아직 검증 전</em>') + '</summary>';
  h += '<div class="rbTop"><div class="briefDim">최근 13년의 6월 말 · 12월 말마다, 그 시점까지의 시세만 가지고 지금과 같은 방법으로 점수를 매긴 뒤 1년 뒤 수익과 맞춰 봐요. 기업 정보 · 매크로는 그때 값을 알 수 없어 빼고, 레버리지 상품도 빼요. 종목 시세를 다시 받으므로 3~8분쯤 걸려요(화면이 잠깐씩 멈출 수 있어요).</div><div class="rkTopR">' + (RB.run ? '<span class="rkProg">검증 중 ' + RB.done + ' / ' + RB.total + '</span>' : '') + '<button class="primary" data-rbrun' + (RB.run ? " disabled" : "") + '>' + (C ? "다시 검증" : "검증 실행") + '</button></div></div>';
  if (!C || !C.fit) return h + '</details>';
  var A = C.flat || C.fit, B = null, ym = function (t) { return t ? new Date(t).toISOString().slice(0, 7) : "?"; };
  if (!A) return h + '<div class="briefDim">집계할 만큼 자료가 모이지 않았어요.</div></details>';
  if (stale) h += '<div class="ddWarn"><b>항목 · 비중 · 잣대가 그때와 달라요</b> 아래는 예전 설정으로 검증한 결과예요. 지금 설정으로 보려면 "다시 검증"을 누르세요.</div>';
  h += '<div class="rbV ' + A.verdict[2] + '"><b>' + rkEsc(A.verdict[0]) + '</b><span>' + rkEsc(A.verdict[1]) + '</span></div>';
  var notes = [];
  if (cur && cur.sug && !cur.sug.none && cur.sug.sugTe) notes.push("<b>더 엄격한 확인</b> 위 숫자는 전체 기간을 보고 항목의 역할을 정한 뒤 같은 기간으로 잰 값이라 조금 후하게 나와요. 앞 절반만 보고 역할을 정해 뒤 절반(" + cur.sug.nTe + "개 시점)에 넣어 본 값은 종목 점수 " + ((cur.sug.sugTe.ic >= 0 ? "+" : "") + cur.sug.sugTe.ic.toFixed(3)) + " · 타이밍 점수 " + ((cur.sug.sugTe.wic.ic >= 0 ? "+" : "") + cur.sug.sugTe.wic.ic.toFixed(3)) + "예요. 이 숫자가 보지 않은 기간에서의 실력에 더 가까워요.");
  if (A.top10Win != null && A.top10Win < 0.5) notes.push("<b>상위 10개만 사는 방식은 통하지 않았어요</b> 시점마다 종목 점수 상위 10개의 1년 뒤 평균은 " + rbP(A.top10) + "로 전체 평균 " + rbP(A.uni) + "와 비슷했고, 전체를 이긴 시점은 " + Math.round(A.top10Win * 100) + "%뿐이에요. 점수 차이가 작은 맨 위 몇 개를 고르는 데는 힘이 없어요 — 상위 30% 안에서 후보를 넓게 잡고, 그 안에서 타이밍 점수가 높은 종목을 보는 쪽이 검증 결과와 맞아요.");
  if (A.spread != null && A.spreadMed != null && A.spreadMed - A.spread > 0.04) notes.push("<b>평균과 중앙값이 달라요</b> 상위 20%와 하위 20%의 차이가 평균으로는 " + rbP(A.spread, 1) + "p인데 중앙값으로는 " + rbP(A.spreadMed, 1) + "p예요. 종목 점수가 낮은 쪽에 크게 튄 종목이 몇 개 섞여 평균을 끌어올렸기 때문이에요. 점수가 높은 쪽은 \"대박\"보다 \"덜 실패하는\" 쪽에 강해요.");
  if (A.band && A.band[0].c && A.band[4].c && A.band[0].med != null && A.band[4].med != null && Math.abs(A.band[0].med - A.band[4].med) < 0.03) notes.push("<b>타이밍 점수는 종목끼리 견주는 점수가 아니에요</b> 모든 종목을 합쳐 타이밍 점수대별로 보면 1년 뒤 중앙값이 거의 같아요(80 이상 " + rbP(A.band[0].med) + " · 42 미만 " + rbP(A.band[4].med) + "). 타이밍 점수는 한 종목 안에서 \"평소보다 싼가\"를 볼 때만 힘이 있어요.");
  if (notes.length) h += '<div class="rbNotes">' + notes.map(function (t) { return '<p>' + t + '</p>'; }).join("") + '</div>';
  h += '<div class="ddKs"><div class="ddK"><b>' + (A.ic == null ? "–" : (A.ic >= 0 ? "+" : "") + A.ic.toFixed(3)) + '</b><span>종목 점수 순위상관</span><small>같은 시점의 종목끼리: 종목 점수 순위와 1년 뒤 수익 순위가 같이 간 정도. 0 = 무관, +0.05 이상이면 쓸 만한 편</small></div><div class="ddK"><b>' + Math.round(A.icPos * 100) + '%</b><span>방향이 맞은 시점</span><small>' + A.nDates + '개 시점 중 순위상관이 플러스였던 비율</small></div><div class="ddK"><b>' + rbP(A.spread, 1) + 'p</b><span>상위 20% − 하위 20%</span><small>1년 뒤 평균 수익 차이 (중앙값 기준 ' + rbP(A.spreadMed, 1) + 'p)</small></div><div class="ddK"><b>' + Math.round(A.topWin * 100) + '%</b><span>상위 20%가 전체 평균을 이긴 시점</span><small>중앙값끼리 비교하면 ' + Math.round(A.topWinMed * 100) + '%</small></div></div>';
  var sg = function (v, d) { return v == null ? "–" : (v >= 0 ? "+" : "") + v.toFixed(d == null ? 3 : d); }, pc = function (v) { return v == null ? "–" : Math.round(v * 100) + "%"; };
  if (A.wic && A.wic.n) { var wOk = A.wic.ic >= 0.1 && A.wic.pos >= 0.65, pOk = A.ic >= 0.05 && A.icPos >= 0.6;
    h += '<div class="rbQ"><div class="' + (pOk ? "up" : "") + '"><small>질문 1 · 무엇을 살까 — 종목 점수</small><b>같은 시점의 종목끼리 견주면</b><p>순위상관 ' + sg(A.ic) + ' · 방향이 맞은 시점 ' + pc(A.icPos) + ' · 상위 20%가 중앙값으로 이긴 시점 ' + pc(A.topWinMed) + ' — ' + (pOk ? "종목 점수가 높은 종목이 1년 뒤 더 올랐어요." : A.ic >= 0.03 ? "방향은 맞지만 약해요 — 낮은 점수를 피하는 용도에 가까워요." : A.ic <= -0.02 ? "종목 점수가 높은 종목이 덜 올랐어요." : "순위로는 구분이 안 됐어요.") + (A.tic != null ? ' <span class="briefDim">(참고: 타이밍 점수로 종목을 줄 세우면 ' + sg(A.tic) + ' — 많이 빠진 순서로 고르면 안 되는 이유)</span>' : '') + '</p></div><div class="' + (wOk ? "up" : "") + '"><small>질문 2 · 언제 살까 — 타이밍 점수</small><b>같은 종목의 시점끼리 견주면</b><p>순위상관 ' + sg(A.wic.ic) + ' · 방향이 맞은 종목 ' + pc(A.wic.pos) + ' (' + A.wic.n + '종목) — ' + (wOk ? "한 종목 안에서는 타이밍 점수가 높았던 때 산 쪽이 1년 뒤가 더 좋았어요." : A.wic.ic >= 0.04 ? "타이밍 점수가 높았던 때가 조금 더 좋았어요." : "시기를 고르는 힘은 뚜렷하지 않았어요.") + (A.wP && A.wP.ic != null ? ' <span class="briefDim">(참고: 종목 점수로 시기를 고르면 ' + sg(A.wP.ic) + ')</span>' : '') + '</p></div></div>'; }
  if (A.mat) h += '<div class="ddSub">두 점수를 같이 봤을 때 — 1년 뒤 중앙값 <small style="font-weight:400;color:#8a92a3">· 괄호 = 같은 시점 전체 중앙값보다 얼마나 더 · 건수</small></div><div class="dxWrap"><table class="dgT rbMat"><thead><tr><th>종목 점수 ↓ · 타이밍 점수 →</th>' + A.mat[0].c.map(function (c) { return '<th>타이밍 ' + c.n + '</th>'; }).join("") + '</tr></thead><tbody>' + A.mat.map(function (r, k) { return '<tr><td><b>종목 ' + r.n + '</b></td>' + r.c.map(function (c, q) { return '<td' + (k === 0 && q === 0 ? ' class="rbHi"' : '') + '>' + (c.c >= 15 ? '<b>' + rbP(c.med) + '</b> <small>(' + rbP(c.ex, 1) + 'p · ' + c.c.toLocaleString() + '건 · 플러스 ' + Math.round(c.pos * 100) + '%)</small>' : '<span class="briefDim">사례 ' + c.c + '건 — 부족</span>') + '</td>'; }).join("") + '</tr>'; }).join("") + '</tbody></table></div><div class="ddMini"><b>읽는 법</b> 왼쪽 위(종목 점수 상위 30% + 타이밍 68 이상)가 "좋은 종목이 싸진 자리"예요. 오른쪽으로 갈수록(타이밍이 낮을수록), 아래로 갈수록(종목 점수가 낮을수록) 숫자가 작아지면 두 점수가 제 역할을 한 거예요. 괄호 안의 "같은 시점 대비"가 시장 전체가 오른 효과를 뺀 값이에요.</div>';
  h += '<div class="briefDim" style="margin:-4px 0 8px">검증 범위: ' + ym(A.from) + ' ~ ' + ym(A.to) + ' · ' + A.nDates + '개 시점 · 종목×시점 ' + A.nObs.toLocaleString() + '건 · ' + (A.fit ? "분위기에 맞는 잣대" : "고른 항목 그대로") + '</div>';
  h += '<div class="ddSub">종목 점수 순으로 5등분했을 때 1년 뒤</div><div class="dxWrap"><table class="dgT"><thead><tr><th>구간</th><th>평균 수익</th><th>중앙값</th><th>플러스 비율</th></tr></thead><tbody>' + A.Q.map(function (q, k) { return '<tr' + (k === 0 ? ' class="ddNow"' : '') + '><td><b>' + ["상위 20% (종목 점수 가장 높음)", "20~40%", "40~60%", "60~80%", "하위 20% (종목 점수 가장 낮음)"][k] + '</b></td><td>' + rbP(q.mean) + '</td><td>' + rbP(q.med) + '</td><td>' + Math.round(q.pos * 100) + '%</td></tr>'; }).join("") + '<tr class="ddSumR"><td><b>전체 평균</b></td><td>' + rbP(A.uni) + '</td><td>' + rbP(A.uniMed) + '</td><td></td></tr></tbody></table></div>';
  h += '<div class="ddMini"><b>상위 10개만 샀다면</b> 시점마다 종목 점수 상위 10개의 1년 뒤 평균 ' + rbP(A.top10) + ' (전체 평균 ' + rbP(A.uni) + ') · 전체를 이긴 시점 ' + Math.round(A.top10Win * 100) + '%' + (A.strong10 != null ?  ' / 종목 점수 60점 이상 중 상위 10개: ' + rbP(A.strong10) + ' · 이긴 시점 ' + Math.round(A.strong10Win * 100) + '%' : '') + '</div>';
  h += '<div class="rbTwo"><div><div class="ddSub">묶음별로 따로 보면 <small style="font-weight:400;color:#8a92a3">· 묶음 안에 종목 · 타이밍 항목이 섞여 있어 참고용</small></div><div class="dxWrap"><table class="dgT"><thead><tr><th>묶음</th><th>순위상관</th><th>방향이 맞은 시점</th></tr></thead><tbody>' + A.gIC.map(function (g, i) { return '<tr><td><b>' + RK_G[i].no + ' ' + RK_G[i].n + '</b></td><td>' + (g.ic == null ? "–" : (g.ic >= 0 ? "+" : "") + g.ic.toFixed(3)) + '</td><td>' + (g.pos == null ? "–" : Math.round(g.pos * 100) + "%") + '</td></tr>'; }).join("") + '</tbody></table></div></div>' +
    '<div><div class="ddSub">그 시점의 시장 분위기별</div><div class="dxWrap"><table class="dgT"><thead><tr><th>분위기</th><th>시점 수</th><th>순위상관</th><th>상위 20%의 초과 수익</th><th>전체 평균</th></tr></thead><tbody>' + A.byMood.map(function (m) { return '<tr><td><b>' + RK_MOODN[m.m] + '</b></td><td>' + m.c + '</td><td>' + (m.ic == null ? "–" : (m.ic >= 0 ? "+" : "") + m.ic.toFixed(3)) + '</td><td>' + (m.ex == null ? "–" : rbP(m.ex) + "p") + '</td><td>' + (m.uni == null ? "–" : rbP(m.uni)) + '</td></tr>'; }).join("") + '</tbody></table></div></div></div>';
  h += '<div class="rbTwo"><div><div class="ddSub">타이밍 점수대별 (모든 시점을 합쳐서)</div><div class="dxWrap"><table class="dgT"><thead><tr><th>타이밍 점수</th><th>건수</th><th>1년 뒤 중앙값</th><th>플러스 비율</th></tr></thead><tbody>' + A.band.map(function (b) { return '<tr><td><b>' + b.n + '</b></td><td>' + b.c.toLocaleString() + '</td><td>' + (b.c ? rbP(b.med) : "–") + '</td><td>' + (b.c ? Math.round(b.pos * 100) + "%" : "–") + '</td></tr>'; }).join("") + '</tbody></table></div></div>' +
    '<div><div class="ddSub">한 줄 판정별 (모든 시점을 합쳐서)</div><div class="dxWrap"><table class="dgT"><thead><tr><th>판정</th><th>건수</th><th>1년 뒤 중앙값</th><th>플러스 비율</th></tr></thead><tbody>' + A.verd.map(function (b) { return '<tr><td><b>' + rkEsc(b.n) + '</b></td><td>' + b.c.toLocaleString() + '</td><td>' + rbP(b.med) + '</td><td>' + Math.round(b.pos * 100) + '%</td></tr>'; }).join("") + '</tbody></table></div></div></div>';
  if (cur && cur.items) { var mark = function (x) { return x.ic == null ? ["–", ""] : x.ic >= 0.03 && x.pos >= 0.55 ? ["도움", "up"] : x.ic <= -0.03 && x.pos <= 0.45 ? ["방해", "down"] : ["무관", ""]; }, offN = rkOff();
    h += '<div class="ddSub">항목 하나하나 — 그 항목 점수만으로 줄 세웠을 때</div><div class="dxWrap"><table class="dgT rbIt"><thead><tr><th>항목</th><th>무엇을 (종목끼리)</th><th>맞은 시점</th><th>앞 절반</th><th>뒤 절반</th><th>언제 (시점끼리)</th><th>맞은 종목</th><th>무엇을</th><th>언제</th><th>지금 쓰임</th></tr></thead><tbody>' + cur.items.slice().sort(function (a, b) { return a.g - b.g || (b.ic || -9) - (a.ic || -9); }).map(function (x) { var m = mark(x); return '<tr><td><b>' + RK_G[x.g].no + ' ' + rkEsc(x.n) + '</b></td><td>' + sg(x.ic) + '</td><td>' + pc(x.pos) + '</td><td>' + sg(x.ic1, 2) + '</td><td>' + sg(x.ic2, 2) + '</td><td>' + sg(x.wic) + '</td><td>' + pc(x.wpos) + '</td><td><span class="rbM ' + m[1] + '">' + m[0] + '</span></td><td>' + (function (w) { return '<span class="rbM ' + w[1] + '">' + w[0] + '</span>'; })(x.wic == null ? ["–", ""] : x.wic >= 0.05 && x.wpos >= 0.6 ? ["도움", "up"] : x.wic <= -0.05 && x.wpos <= 0.4 ? ["방해", "down"] : ["무관", ""]) + '</td><td>' + (offN[x.k] ? "제외" : rkRoleOf(x.k) === "pick" ? '<span class="rkRo p">종목</span>' : rkRoleOf(x.k) === "time" ? '<span class="rkRo t">타이밍</span>' : "참고") + '</td></tr>'; }).join("") + '</tbody></table></div><div class="ddMini"><b>읽는 법</b> "무엇을" = 같은 시점의 종목끼리 견줬을 때 이 항목 점수가 높은 종목이 1년 뒤 더 올랐나. "언제" = 같은 종목 안에서 이 항목 점수가 높았던 시점이 더 좋았나. "무엇을" 판정: +0.03 이상 · 맞은 시점 55% 이상이면 도움, -0.03 이하 · 45% 이하면 방해. "언제" 판정: +0.05 이상 · 맞은 종목 60% 이상이면 도움. "무엇을"에 도움인 항목은 종목 점수에, "언제"에 도움인 항목은 타이밍 점수에 넣는 게 맞아요 — 한 항목이 양쪽에 반대로 가는 경우가 많아요. 앞 절반과 뒤 절반의 부호가 다르면 운일 가능성이 커요.</div>';
    h += '<details class="rbEx"' + (RB.exOpen ? " open" : "") + '><summary>항목별 풀이 — 항목마다 무엇을 재고, 검증에서 어땠고, 그래서 어디에 쓰는지</summary><div class="rbExL">' + cur.items.slice().sort(function (a, b) { return a.g - b.g; }).map(function (x) { var r = rbRead(x); return '<div><div class="h"><b>' + RK_G[x.g].no + ' ' + rkEsc(x.n) + '</b>' + (r.ro === "pick" ? '<span class="rkRo p">종목</span>' : r.ro === "time" ? '<span class="rkRo t">타이밍</span>' : '<span class="rkRo">참고</span>') + '</div><dl><dt>무엇을 재나</dt><dd>' + rkEsc(r.what) + (r.how ? ' <small>(점수 기준: ' + rkEsc(r.how) + ')</small>' : '') + '</dd><dt>무엇을</dt><dd>' + rkEsc(r.a) + (r.st ? ' ' + rkEsc(r.st) : '') + '</dd><dt>언제</dt><dd>' + rkEsc(r.b) + '</dd><dt>지금 쓰임</dt><dd><b>' + rkEsc(r.why) + '</b></dd></dl></div>'; }).join("") + '</div></details>'; }
  h += '<details class="rbEx"' + (RB.tmOpen ? " open" : "") + '><summary>용어 풀이 — 이 화면에 나오는 말 ' + RB_TERMS.length + '가지</summary><dl class="rbTm">' + RB_TERMS.map(function (t) { return '<dt>' + rkEsc(t[0]) + '</dt><dd>' + rkEsc(t[1]) + '</dd>'; }).join("") + '</dl></details>';

  if (cur && cur.sug) { var S2 = cur.sug, ymc = function (t) { return t ? new Date(t).toISOString().slice(0, 7) : "?"; }, nmK = function (k) { var I = RK_I.filter(function (x) { return x[0] === k; })[0]; return I ? RK_G[I[1]].no + " " + I[2] : k; };
    if (S2.none) h += '<div class="ddMini"><b>데이터가 제안하는 역할 나누기</b> 앞 절반 시점(~' + ymc(S2.cut) + ')만으로는 종목 항목과 타이밍 항목을 가를 만큼 꾸준한 항목이 없었어요. 기본 구성을 그대로 쓰세요.</div>';
    else { var line = function (nm, a) { return '<tr><td><b>' + nm + '</b></td><td>' + sg(a.ic) + '</td><td>' + pc(a.icPos) + '</td><td>' + pc(a.topWinMed) + '</td><td>' + sg(a.wic.ic) + '</td><td>' + pc(a.wic.pos) + '</td></tr>'; }, okP = S2.sugTe && S2.sugTe.ic >= 0.03, okT = S2.sugTe && S2.sugTe.wic.ic >= 0.05, better = S2.sugTe && S2.curTe && (S2.sugTe.ic > S2.curTe.ic + 0.01 || S2.sugTe.wic.ic > S2.curTe.wic.ic + 0.02) && S2.sugTe.ic >= S2.curTe.ic - 0.01 && S2.sugTe.wic.ic >= S2.curTe.wic.ic - 0.02;
      h += '<div class="ddSub">데이터가 제안하는 역할 나누기 — 앞 절반으로 정하고 뒤 절반으로 확인</div><div class="rbSug"><div class="briefDim">' + ymc(S2.cut) + ' 이전 ' + S2.nTr + '개 시점에서 "무엇을"에 꾸준히 맞은 항목은 종목 점수에, "언제"에 꾸준히 맞은 항목은 타이밍 점수에 넣고, 어느 쪽에도 맞지 않은 항목은 뺐어요. 그 구성을 ' + ymc(S2.cut) + ' 이후 ' + S2.nTe + '개 시점(정할 때 보지 않은 기간)에 넣어 본 결과가 "확인 기간"이에요. 기업 정보 · 매크로는 검증할 수 없어 기본 역할 그대로 둬요. 묶음 비중은 바꾸지 않아요.</div>' +
        '<div class="rbSugC"><b>종목 항목 ' + S2.pick.length + '개</b> ' + S2.pick.map(nmK).join(" · ") + '<br><b>타이밍 항목 ' + S2.time.length + '개</b> ' + S2.time.map(nmK).join(" · ") + '</div>' +
        '<div class="dxWrap"><table class="dgT"><thead><tr><th>구성 · 기간</th><th>종목 점수 순위상관</th><th>맞은 시점</th><th>상위 20%가 이긴 시점(중앙값)</th><th>타이밍 점수 순위상관</th><th>맞은 종목</th></tr></thead><tbody>' + (S2.curTr ? line("지금 구성 · 정한 기간", S2.curTr) : "") + (S2.sugTr ? line("제안 구성 · 정한 기간", S2.sugTr) : "") + (S2.curTe ? line("지금 구성 · 확인 기간", S2.curTe) : "") + (S2.sugTe ? '<tr class="ddNow">' + line("제안 구성 · 확인 기간", S2.sugTe).slice(4) : "") + '</tbody></table></div>' +
        '<div class="rbV ' + (better && okP && okT ? "up" : "") + '" style="margin-top:8px"><b>' + (better && okP && okT ? "확인 기간에서도 나아졌어요" : better ? "조금 나아졌지만 아직 약해요" : "지금 구성보다 낫지 않았어요") + '</b><span>' + (better && okP && okT ? "정할 때 보지 않은 기간에서도 두 점수 모두 지금 구성 이상이었어요. 적용해 볼 만해요 — 다만 확인 기간이 " + S2.nTe + "개 시점뿐이라 확신할 정도는 아니에요." : better ? "한쪽은 좋아졌지만 기준(종목 +0.03 · 타이밍 +0.05)에는 못 미쳐요." : "지금 구성이 확인 기간에서 같거나 더 나았어요. 그대로 두는 편이 맞아요 — 앞 기간에만 맞춘 구성은 뒤에서 무너지기 쉬워요.") + '</span></div>' +
        '<div style="margin-top:8px"><button class="' + (better && okP && okT ? "primary" : "ghost") + '" data-rbapply>이 구성 적용</button> <button class="ghost" data-rbreset>기본 구성으로 되돌리기</button></div></div>'; } }
  if (B) h += '<div class="ddMini"><b>잣대 비교</b> ' + (A.fit ? "분위기에 맞는 잣대" : "고른 항목 그대로") + ': 순위상관 ' + (A.ic >= 0 ? "+" : "") + A.ic.toFixed(3) + ' · 상위−하위 ' + rbP(A.spread, 1) + 'p / ' + (B.fit ? "분위기에 맞는 잣대" : "고른 항목 그대로") + ': 순위상관 ' + (B.ic >= 0 ? "+" : "") + B.ic.toFixed(3) + ' · 상위−하위 ' + rbP(B.spread, 1) + 'p — ' + (Math.abs(A.ic - B.ic) < 0.01 ? "두 잣대의 차이는 거의 없었어요." : (A.ic > B.ic) === A.fit ? "분위기에 맞춘 쪽이 과거에는 더 잘 맞았어요." : "분위기에 맞추지 않은 쪽이 과거에는 더 잘 맞았어요.") + '</div>';
  h += '<details class="rbPer"><summary>시점별 결과 ' + A.per.length + '개</summary><div class="dxWrap"><table class="dgT"><thead><tr><th>시점</th><th>분위기</th><th>종목 수</th><th>순위상관</th><th>상위 20%</th><th>하위 20%</th><th>전체 평균</th></tr></thead><tbody>' + A.per.map(function (p) { return '<tr><td>' + ym(p.t) + '</td><td>' + RK_MOODN[p.mood] + '</td><td>' + p.n + '</td><td>' + (p.ic == null ? "–" : (p.ic >= 0 ? "+" : "") + p.ic.toFixed(2)) + '</td><td>' + rbP(p.top) + '</td><td>' + rbP(p.bot) + '</td><td>' + rbP(p.uni) + '</td></tr>'; }).join("") + '</tbody></table></div></details>';
  h += '<div class="ddMini"><b>이 검증이 말해 주지 못하는 것</b> ① 지금 목록에 남아 있는 종목만 봤어요 — 상장폐지되거나 목록에서 빠진 종목이 없어서 전체 수익이 실제보다 좋게 나와요. ② 기업 정보(ROE · 성장 · PER)와 매크로는 빠졌어요 — 실제 순위는 이 항목들까지 쓰므로 결과가 다를 수 있어요. ③ 시점이 6개월 간격이라 1년 수익 구간이 서로 겹쳐요 — 독립된 시점은 표에 보이는 수의 절반쯤이에요. ④ 평균은 크게 오른 몇 종목(특히 코인)에 끌려가요 — 중앙값과 플러스 비율을 같이 보세요. ⑤ 과거에 맞았다고 앞으로도 맞는 것은 아니에요. 항목이나 비중을 여러 번 바꿔 가며 가장 잘 맞는 조합을 고르면, 그 조합은 과거에만 맞는 조합일 수 있어요.</div>';
  return h + '</details>';
}
function rbBind(el) {
  var box = el.querySelector(".rbBox"); if (!box) return; box.addEventListener("toggle", function () { RB.open = box.open ? 1 : 0; }); Array.prototype.forEach.call(box.querySelectorAll(".rbEx"), function (d, i) { d.addEventListener("toggle", function (e) { e.stopPropagation(); RB[i === 0 && box.querySelectorAll(".rbEx").length > 1 ? "exOpen" : "tmOpen"] = d.open ? 1 : 0; }); });
  var ap = box.querySelector("[data-rbapply]"); if (ap) ap.onclick = function () { var c = rbCur(); if (!c || !c.sug || c.sug.none) return; rkRoleSave(c.sug.role); RK.live = {}; RB.open = 1; if (typeof toast === "function") toast("제안 구성을 적용했어요 — 순위가 다시 매겨졌어요"); renderRank(); };
  var rs = box.querySelector("[data-rbreset]"); if (rs) rs.onclick = function () { try { localStorage.removeItem("sm.rank.off2"); localStorage.removeItem("sm.rank.w"); } catch (e) {} RK._off = null; rkRoleSave(null); RK.live = {}; RB.open = 1; renderRank(); };
  var b = box.querySelector("[data-rbrun]"); if (b) b.onclick = function () { RB.open = 1; var re = function () { if (typeof currentTab !== "undefined" && currentTab === "rank") renderRank(); };
    rbRun(function () { var p = document.querySelector("#rankBody .rbBox .rkProg"); if (p) p.textContent = "검증 중 " + RB.done + " / " + RB.total; }).then(re, function (e) { console.warn("rb", e); if (typeof toast === "function") toast("검증 중 문제가 생겼어요"); re(); }); re(); };
}
(function () {
  if (typeof document === "undefined") return; var st = document.createElement("style"); st.id = "rbCss";
  st.textContent = ".rbTop{display:flex;gap:14px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin:10px 0}.rbTop>.briefDim{flex:1;min-width:260px;line-height:1.55}.rbNotes{border:1px solid #e9dfc4;background:#fdfaf1;border-radius:10px;padding:4px 14px;margin:0 0 12px}.rbNotes p{margin:10px 0;font-size:13px;line-height:1.7}.rbEx{margin:10px 0;border:1px solid #e6e9ef;border-radius:10px;padding:10px 14px;background:#fff}.rbEx>summary{cursor:pointer;font-weight:800;font-size:13.5px}.rbExL{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.rbExL>div{border:1px solid #eceff4;border-radius:10px;padding:10px 12px;background:#fbfcfd}.rbExL .h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}.rbExL .h b{font-size:13.5px}.rbEx dl{margin:0;display:grid;grid-template-columns:78px minmax(0,1fr);gap:5px 10px;font-size:12.5px;line-height:1.65}.rbEx dt{color:#8a92a3;font-weight:700}.rbEx dd{margin:0;color:#2b3240}.rbEx dd small{color:#9aa3b2}.rbTm{margin-top:10px!important;grid-template-columns:150px minmax(0,1fr)!important;gap:9px 14px!important;font-size:13px!important}.rbTm dt{color:#141414!important}@media(max-width:820px){.rbExL{grid-template-columns:minmax(0,1fr)}.rbTm{grid-template-columns:minmax(0,1fr)!important;gap:2px 0!important}.rbTm dd{margin-bottom:8px}}[data-theme=dark] .rbEx,[data-theme=dark] .rbExL>div{background:#161b24;border-color:#263041}[data-theme=dark] .rbEx dd{color:#c8d0dc}[data-theme=dark] .rbTm dt{color:#fff!important}[data-theme=dark] .rbNotes{background:#2a2414;border-color:#4a3f1f}.rbMat td{white-space:nowrap}.rbMat td b{font-size:15px}.rbMat td.rbHi{background:#fbf6ea;box-shadow:inset 3px 0 0 #c9a24b}[data-theme=dark] .rbMat td.rbHi{background:#2a2414}.rbV{border-radius:10px;padding:11px 14px;margin:6px 0 10px;background:#eef1f5;border-left:5px solid #8a92a3}.rbV b{display:block;font-size:16px;margin-bottom:2px}.rbV span{font-size:13px;line-height:1.55}.rbV.up{background:#e3f4e6;border-left-color:#178a47}.rbV.down{background:#fde7e7;border-left-color:#d64545}.rbTwo{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rbQ{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 10px}.rbQ>div{background:#f6f8fb;border-radius:10px;padding:10px 14px;border-top:3px solid #8a92a3}.rbQ>div.up{border-top-color:#178a47;background:#e9f6ec}.rbQ small{font-size:11.5px;font-weight:800;color:#5b6474}.rbQ b{display:block;font-size:14.5px;margin:2px 0 3px}.rbQ p{margin:0;font-size:12.5px;line-height:1.55}.rbM{display:inline-block;font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 7px;background:#eef1f5;color:#5b6474}.rbM.up{background:#178a47;color:#fff}.rbM.down{background:#e5484d;color:#fff}.rbSug{background:#f6f8fb;border-radius:10px;padding:12px 14px}.rbSugC{font-size:12.5px;line-height:1.7;margin:8px 0;background:#fff;border-radius:8px;padding:8px 12px}.rbSug .briefDim{line-height:1.55}.rbPer{margin-top:10px}.rbPer summary{cursor:pointer;font-size:13px;font-weight:700}.rbBox .dgT td,.rbBox .dgT th{white-space:nowrap}.rbBox .ddK small{line-height:1.4}" +
    "@media(max-width:820px){.rbTwo,.rbQ{grid-template-columns:minmax(0,1fr)}}[data-theme=dark] .rbQ>div,[data-theme=dark] .rbSug{background:#1e2533}[data-theme=dark] .rbQ>div.up{background:#173524}[data-theme=dark] .rbSugC{background:#161b24}@media(max-width:720px){.rbBox .dgT td,.rbBox .dgT th{white-space:normal}}[data-theme=dark] .rbV{background:#232a36}[data-theme=dark] .rbV.up{background:#173524}[data-theme=dark] .rbV.down{background:#3a1c1c}";
  document.head.appendChild(st);
})();
if (typeof module !== "undefined") module.exports = { rbSpear: rbSpear, rbIdx: rbIdx };
