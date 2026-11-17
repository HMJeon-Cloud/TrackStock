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
  return Promise.all([one(), one(), one()]).then(function () { RB.obs = obs; RB.run = false; RB.at = Date.now(); rbSave(); return obs; }).catch(function (e) { RB.run = false; throw e; });
}

/* ---------- 집계 ---------- */
function rbAgg(obs, fit, dates) {
  var W = rkW(), byD = {}, per = [], pool = [], gIC = [[], [], [], []];
  obs.forEach(function (o) { (byD[o.d] = byD[o.d] || []).push(o); });
  Object.keys(byD).sort(function (a, b) { return a - b; }).forEach(function (d) {
    var a = byD[d]; if (a.length < 25) return;
    var M = rkMoods(a), all = { up: 0, n: 0 }; a.forEach(function (o) { if (o.u != null) { all.n++; all.up += o.u; } });
    var rows = a.map(function (o) { var md = fit ? M.of(o.s).mood : null, gs = rkGsOf(o.i, false, md).gs, t = rkTotal(gs, W), b = rkBodyOf(gs), sp = rkSpotOf(gs); return { t: t, gs: gs, f: o.f, v: rkVerdict(b, sp)[0], b: b }; }).filter(function (r) { return r.t != null; });
    if (rows.length < 25) return; rows.sort(function (x, y) { return y.t - x.t; });
    var n = rows.length, q = [], uni = rbMean(rows.map(function (r) { return r.f; })), uniMed = rbMed(rows.map(function (r) { return r.f; }));
    for (var k = 0; k < 5; k++) { var part = rows.slice(Math.round(n * k / 5), Math.round(n * (k + 1) / 5)).map(function (r) { return r.f; }); q.push({ mean: rbMean(part), med: rbMed(part), pos: part.filter(function (v) { return v > 0; }).length / part.length }); }
    var top10 = rows.slice(0, 10).map(function (r) { return r.f; }), strong = rows.filter(function (r) { return r.b >= 60; }).slice(0, 10).map(function (r) { return r.f; });
    for (var g = 0; g < 4; g++) { var rr = rows.filter(function (r) { return r.gs[g] != null; }); gIC[g].push(rbSpear(rr.map(function (r) { return r.gs[g]; }), rr.map(function (r) { return r.f; }))); }
    per.push({ d: +d, t: dates ? dates[d] : null, n: n, uni: uni, uniMed: uniMed, q: q, ic: rbSpear(rows.map(function (r) { return r.t; }), rows.map(function (r) { return r.f; })), top10: rbMean(top10), top10Med: rbMed(top10), strong10: strong.length >= 5 ? rbMean(strong) : null, mood: rkMoodOf(all.up, all.n), up: all.n ? all.up / all.n : null });
    rows.forEach(function (r) { pool.push(r); });
  });
  if (!per.length) return null;
  var ics = per.map(function (p) { return p.ic; }).filter(function (v) { return v != null; }), share = function (f) { return per.filter(f).length / per.length; };
  var Q = [0, 1, 2, 3, 4].map(function (k) { return { mean: rbMean(per.map(function (p) { return p.q[k].mean; })), med: rbMean(per.map(function (p) { return p.q[k].med; })), pos: rbMean(per.map(function (p) { return p.q[k].pos; })) }; });
  var band = [[80, 101, "80 이상"], [68, 80, "68~79"], [55, 68, "55~67"], [42, 55, "42~54"], [0, 42, "42 미만"]].map(function (b) { var a = pool.filter(function (r) { return r.t >= b[0] && r.t < b[1]; }).map(function (r) { return r.f; }); return { n: b[2], c: a.length, med: rbMed(a), mean: rbMean(a), pos: a.length ? a.filter(function (v) { return v > 0; }).length / a.length : null }; });
  var vs = {}; pool.forEach(function (r) { (vs[r.v] = vs[r.v] || []).push(r.f); });
  var verd = Object.keys(vs).map(function (k) { var a = vs[k]; return { n: k, c: a.length, med: rbMed(a), mean: rbMean(a), pos: a.filter(function (v) { return v > 0; }).length / a.length }; }).sort(function (x, y) { return (y.med || 0) - (x.med || 0); });
  var byMood = ["up", "mid", "down"].map(function (m) { var a = per.filter(function (p) { return p.mood === m; }); return { m: m, c: a.length, ic: rbMean(a.map(function (p) { return p.ic; })), ex: rbMean(a.map(function (p) { return p.q[0].mean - p.uni; })), uni: rbMean(a.map(function (p) { return p.uni; })) }; });
  var out = { fit: !!fit, nDates: per.length, nObs: pool.length, from: per[0].t, to: per[per.length - 1].t, ic: rbMean(ics), icPos: ics.length ? ics.filter(function (v) { return v > 0; }).length / ics.length : null,
    Q: Q, spread: Q[0].mean - Q[4].mean, spreadMed: Q[0].med - Q[4].med, topWin: share(function (p) { return p.q[0].mean > p.uni; }), topWinMed: share(function (p) { return p.q[0].med > p.uniMed; }), uni: rbMean(per.map(function (p) { return p.uni; })), uniMed: rbMean(per.map(function (p) { return p.uniMed; })),
    top10: rbMean(per.map(function (p) { return p.top10; })), top10Win: share(function (p) { return p.top10 > p.uni; }), strong10: rbMean(per.map(function (p) { return p.strong10; })), strong10Win: (function () { var a = per.filter(function (p) { return p.strong10 != null; }); return a.length ? a.filter(function (p) { return p.strong10 > p.uni; }).length / a.length : null; })(),
    gIC: gIC.map(function (a) { var v = a.filter(function (x) { return x != null; }); return { ic: rbMean(v), pos: v.length ? v.filter(function (x) { return x > 0; }).length / v.length : null }; }), band: band, verd: verd, byMood: byMood,
    per: per.map(function (p) { return { t: p.t, n: p.n, ic: p.ic, top: p.q[0].mean, bot: p.q[4].mean, uni: p.uni, mood: p.mood }; }) };
  out.verdict = rbVerdict(out); return out;
}
function rbVerdict(a) {
  if (a.ic == null || a.nDates < 8) return ["판정하기엔 시점이 부족해요", "검증에 쓸 수 있는 시점이 " + a.nDates + "개뿐이에요. 종목들의 과거 시세가 더 길게 쌓여야 판단할 수 있어요 — 아래 숫자는 참고만 하세요.", "mid"];
  if (a.ic >= 0.05 && a.icPos >= 0.6 && a.topWin >= 0.6) return ["과거 기준으로는 쓸 만했어요", "점수가 높았던 종목이 1년 뒤 더 오른 경우가 시점의 " + Math.round(a.icPos * 100) + "%였고, 상위 20%가 전체 평균을 이긴 시점이 " + Math.round(a.topWin * 100) + "%예요. 종목 고르기 점수로는 의미 있는 수준이에요.", "up"];
  if (a.ic >= 0.02 && (a.icPos >= 0.55 || a.topWin >= 0.55)) return ["약하게 맞았어요 — 참고 수준", "방향은 맞는 편이지만 힘이 약해요. 점수 하나로 고르기보다 걸러내는 용도(낮은 점수 피하기)에 가까워요.", "mid"];
  if (a.ic <= -0.02) return ["반대로 갔어요", "점수가 높았던 종목이 오히려 덜 올랐어요. 지금 항목 구성 · 비중으로는 순위를 믿으면 안 돼요.", "down"];
  return ["맞았다고 보기 어려워요", "점수 순위와 1년 뒤 수익 순위가 거의 상관이 없었어요 — 동전 던지기와 비슷해요. 항목 구성을 바꿔 다시 확인해 보세요.", "mid"];
}
function rbSig() { return JSON.stringify([Object.keys(rkOff()).sort(), rkW(), rkFitOn() ? 1 : 0]); }
function rbCur() { if (!RB.obs) return null; var sig = rbSig(); if (RB._c && RB._sig === sig && RB._at === RB.at) return RB._c; RB._c = { fit: rbAgg(RB.obs, true, RB.dates), flat: rbAgg(RB.obs, false, RB.dates) }; RB._sig = sig; RB._at = RB.at; return RB._c; }
function rbSave() { try { var c = rbCur(); if (!c || !c.fit) return; localStorage.setItem("sm.rank.bt", JSON.stringify({ at: RB.at, sig: rbSig(), fit: c.fit, flat: c.flat })); } catch (e) {} }
function rbLoadSaved() { if (RB.saved !== null) return RB.saved; var v = false; try { v = JSON.parse(localStorage.getItem("sm.rank.bt") || "false"); } catch (e) {} return (RB.saved = v || false); }

/* ---------- 화면 ---------- */
function rbP(v, d) { return typeof ddPct === "function" ? ddPct(v, d == null ? 1 : d) : String(v); }
function rbHtml() {
  var cur = rbCur(), saved = !cur ? rbLoadSaved() : null, C = cur || (saved ? { fit: saved.fit, flat: saved.flat } : null), stale = !cur && saved && saved.sig !== rbSig(), h = '';
  h += '<details class="egBox rkHow rbBox"' + (RB.open || RB.run ? " open" : "") + '><summary>점수 검증 — 과거에 이 점수가 높았던 종목이 정말 더 올랐나' + (C && C.fit ? ' <em>' + rkEsc(C[rkFitOn() ? "fit" : "flat"].verdict[0]) + '</em>' : ' <em>아직 검증 전</em>') + '</summary>';
  h += '<div class="rbTop"><div class="briefDim">최근 13년의 6월 말 · 12월 말마다, 그 시점까지의 시세만 가지고 지금과 같은 방법으로 점수를 매긴 뒤 1년 뒤 수익과 맞춰 봐요. 기업 정보 · 매크로는 그때 값을 알 수 없어 빼고, 레버리지 상품도 빼요. 종목 시세를 다시 받으므로 3~8분쯤 걸려요(화면이 잠깐씩 멈출 수 있어요).</div><div class="rkTopR">' + (RB.run ? '<span class="rkProg">검증 중 ' + RB.done + ' / ' + RB.total + '</span>' : '') + '<button class="primary" data-rbrun' + (RB.run ? " disabled" : "") + '>' + (C ? "다시 검증" : "검증 실행") + '</button></div></div>';
  if (!C || !C.fit) return h + '</details>';
  var A = C[rkFitOn() ? "fit" : "flat"], B = C[rkFitOn() ? "flat" : "fit"], ym = function (t) { return t ? new Date(t).toISOString().slice(0, 7) : "?"; };
  if (!A) return h + '<div class="briefDim">집계할 만큼 자료가 모이지 않았어요.</div></details>';
  if (stale) h += '<div class="ddWarn"><b>항목 · 비중 · 잣대가 그때와 달라요</b> 아래는 예전 설정으로 검증한 결과예요. 지금 설정으로 보려면 "다시 검증"을 누르세요.</div>';
  h += '<div class="rbV ' + A.verdict[2] + '"><b>' + rkEsc(A.verdict[0]) + '</b><span>' + rkEsc(A.verdict[1]) + '</span></div>';
  h += '<div class="ddKs"><div class="ddK"><b>' + (A.ic == null ? "–" : (A.ic >= 0 ? "+" : "") + A.ic.toFixed(3)) + '</b><span>순위상관 평균</span><small>점수 순위와 1년 뒤 수익 순위가 같이 간 정도. 0 = 무관, +0.05 이상이면 쓸 만한 편</small></div><div class="ddK"><b>' + Math.round(A.icPos * 100) + '%</b><span>방향이 맞은 시점</span><small>' + A.nDates + '개 시점 중 순위상관이 플러스였던 비율</small></div><div class="ddK"><b>' + rbP(A.spread, 1) + 'p</b><span>상위 20% − 하위 20%</span><small>1년 뒤 평균 수익 차이 (중앙값 기준 ' + rbP(A.spreadMed, 1) + 'p)</small></div><div class="ddK"><b>' + Math.round(A.topWin * 100) + '%</b><span>상위 20%가 전체 평균을 이긴 시점</span><small>중앙값끼리 비교하면 ' + Math.round(A.topWinMed * 100) + '%</small></div></div>';
  h += '<div class="briefDim" style="margin:-4px 0 8px">검증 범위: ' + ym(A.from) + ' ~ ' + ym(A.to) + ' · ' + A.nDates + '개 시점 · 종목×시점 ' + A.nObs.toLocaleString() + '건 · ' + (A.fit ? "분위기에 맞는 잣대" : "고른 항목 그대로") + '</div>';
  h += '<div class="ddSub">점수 순으로 5등분했을 때 1년 뒤</div><div class="dxWrap"><table class="dgT"><thead><tr><th>구간</th><th>평균 수익</th><th>중앙값</th><th>플러스 비율</th></tr></thead><tbody>' + A.Q.map(function (q, k) { return '<tr' + (k === 0 ? ' class="ddNow"' : '') + '><td><b>' + ["상위 20% (점수 가장 높음)", "20~40%", "40~60%", "60~80%", "하위 20% (점수 가장 낮음)"][k] + '</b></td><td>' + rbP(q.mean) + '</td><td>' + rbP(q.med) + '</td><td>' + Math.round(q.pos * 100) + '%</td></tr>'; }).join("") + '<tr class="ddSumR"><td><b>전체 평균</b></td><td>' + rbP(A.uni) + '</td><td>' + rbP(A.uniMed) + '</td><td></td></tr></tbody></table></div>';
  h += '<div class="ddMini"><b>상위 10개만 샀다면</b> 시점마다 점수 상위 10개의 1년 뒤 평균 ' + rbP(A.top10) + ' (전체 평균 ' + rbP(A.uni) + ') · 전체를 이긴 시점 ' + Math.round(A.top10Win * 100) + '%' + (A.strong10 != null ? ' / 체력 60점 이상 중 상위 10개: ' + rbP(A.strong10) + ' · 이긴 시점 ' + Math.round(A.strong10Win * 100) + '%' : '') + '</div>';
  h += '<div class="rbTwo"><div><div class="ddSub">묶음별로 따로 보면</div><div class="dxWrap"><table class="dgT"><thead><tr><th>묶음</th><th>순위상관</th><th>방향이 맞은 시점</th></tr></thead><tbody>' + A.gIC.map(function (g, i) { return '<tr><td><b>' + RK_G[i].no + ' ' + RK_G[i].n + '</b></td><td>' + (g.ic == null ? "–" : (g.ic >= 0 ? "+" : "") + g.ic.toFixed(3)) + '</td><td>' + (g.pos == null ? "–" : Math.round(g.pos * 100) + "%") + '</td></tr>'; }).join("") + '</tbody></table></div></div>' +
    '<div><div class="ddSub">그 시점의 시장 분위기별</div><div class="dxWrap"><table class="dgT"><thead><tr><th>분위기</th><th>시점 수</th><th>순위상관</th><th>상위 20%의 초과 수익</th><th>전체 평균</th></tr></thead><tbody>' + A.byMood.map(function (m) { return '<tr><td><b>' + RK_MOODN[m.m] + '</b></td><td>' + m.c + '</td><td>' + (m.ic == null ? "–" : (m.ic >= 0 ? "+" : "") + m.ic.toFixed(3)) + '</td><td>' + (m.ex == null ? "–" : rbP(m.ex) + "p") + '</td><td>' + (m.uni == null ? "–" : rbP(m.uni)) + '</td></tr>'; }).join("") + '</tbody></table></div></div></div>';
  h += '<div class="rbTwo"><div><div class="ddSub">점수대별 (모든 시점을 합쳐서)</div><div class="dxWrap"><table class="dgT"><thead><tr><th>최종 점수</th><th>건수</th><th>1년 뒤 중앙값</th><th>플러스 비율</th></tr></thead><tbody>' + A.band.map(function (b) { return '<tr><td><b>' + b.n + '</b></td><td>' + b.c.toLocaleString() + '</td><td>' + (b.c ? rbP(b.med) : "–") + '</td><td>' + (b.c ? Math.round(b.pos * 100) + "%" : "–") + '</td></tr>'; }).join("") + '</tbody></table></div></div>' +
    '<div><div class="ddSub">한 줄 판정별 (모든 시점을 합쳐서)</div><div class="dxWrap"><table class="dgT"><thead><tr><th>판정</th><th>건수</th><th>1년 뒤 중앙값</th><th>플러스 비율</th></tr></thead><tbody>' + A.verd.map(function (b) { return '<tr><td><b>' + rkEsc(b.n) + '</b></td><td>' + b.c.toLocaleString() + '</td><td>' + rbP(b.med) + '</td><td>' + Math.round(b.pos * 100) + '%</td></tr>'; }).join("") + '</tbody></table></div></div></div>';
  if (B) h += '<div class="ddMini"><b>잣대 비교</b> ' + (A.fit ? "분위기에 맞는 잣대" : "고른 항목 그대로") + ': 순위상관 ' + (A.ic >= 0 ? "+" : "") + A.ic.toFixed(3) + ' · 상위−하위 ' + rbP(A.spread, 1) + 'p / ' + (B.fit ? "분위기에 맞는 잣대" : "고른 항목 그대로") + ': 순위상관 ' + (B.ic >= 0 ? "+" : "") + B.ic.toFixed(3) + ' · 상위−하위 ' + rbP(B.spread, 1) + 'p — ' + (Math.abs(A.ic - B.ic) < 0.01 ? "두 잣대의 차이는 거의 없었어요." : (A.ic > B.ic) === A.fit ? "분위기에 맞춘 쪽이 과거에는 더 잘 맞았어요." : "분위기에 맞추지 않은 쪽이 과거에는 더 잘 맞았어요.") + '</div>';
  h += '<details class="rbPer"><summary>시점별 결과 ' + A.per.length + '개</summary><div class="dxWrap"><table class="dgT"><thead><tr><th>시점</th><th>분위기</th><th>종목 수</th><th>순위상관</th><th>상위 20%</th><th>하위 20%</th><th>전체 평균</th></tr></thead><tbody>' + A.per.map(function (p) { return '<tr><td>' + ym(p.t) + '</td><td>' + RK_MOODN[p.mood] + '</td><td>' + p.n + '</td><td>' + (p.ic == null ? "–" : (p.ic >= 0 ? "+" : "") + p.ic.toFixed(2)) + '</td><td>' + rbP(p.top) + '</td><td>' + rbP(p.bot) + '</td><td>' + rbP(p.uni) + '</td></tr>'; }).join("") + '</tbody></table></div></details>';
  h += '<div class="ddMini"><b>이 검증이 말해 주지 못하는 것</b> ① 지금 목록에 남아 있는 종목만 봤어요 — 상장폐지되거나 목록에서 빠진 종목이 없어서 전체 수익이 실제보다 좋게 나와요. ② 기업 정보(ROE · 성장 · PER)와 매크로는 빠졌어요 — 실제 순위는 이 항목들까지 쓰므로 결과가 다를 수 있어요. ③ 시점이 6개월 간격이라 1년 수익 구간이 서로 겹쳐요 — 독립된 시점은 표에 보이는 수의 절반쯤이에요. ④ 평균은 크게 오른 몇 종목(특히 코인)에 끌려가요 — 중앙값과 플러스 비율을 같이 보세요. ⑤ 과거에 맞았다고 앞으로도 맞는 것은 아니에요. 항목이나 비중을 여러 번 바꿔 가며 가장 잘 맞는 조합을 고르면, 그 조합은 과거에만 맞는 조합일 수 있어요.</div>';
  return h + '</details>';
}
function rbBind(el) {
  var box = el.querySelector(".rbBox"); if (!box) return; box.addEventListener("toggle", function () { RB.open = box.open ? 1 : 0; });
  var b = box.querySelector("[data-rbrun]"); if (b) b.onclick = function () { RB.open = 1; var re = function () { if (typeof currentTab !== "undefined" && currentTab === "rank") renderRank(); };
    rbRun(function () { var p = document.querySelector("#rankBody .rbBox .rkProg"); if (p) p.textContent = "검증 중 " + RB.done + " / " + RB.total; }).then(re, function (e) { console.warn("rb", e); if (typeof toast === "function") toast("검증 중 문제가 생겼어요"); re(); }); re(); };
}
(function () {
  if (typeof document === "undefined") return; var st = document.createElement("style"); st.id = "rbCss";
  st.textContent = ".rbTop{display:flex;gap:14px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin:10px 0}.rbTop>.briefDim{flex:1;min-width:260px;line-height:1.55}.rbV{border-radius:10px;padding:11px 14px;margin:6px 0 10px;background:#eef1f5;border-left:5px solid #8a92a3}.rbV b{display:block;font-size:16px;margin-bottom:2px}.rbV span{font-size:13px;line-height:1.55}.rbV.up{background:#e3f4e6;border-left-color:#178a47}.rbV.down{background:#fde7e7;border-left-color:#d64545}.rbTwo{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rbPer{margin-top:10px}.rbPer summary{cursor:pointer;font-size:13px;font-weight:700}.rbBox .dgT td,.rbBox .dgT th{white-space:nowrap}.rbBox .ddK small{line-height:1.4}" +
    "@media(max-width:820px){.rbTwo{grid-template-columns:minmax(0,1fr)}}@media(max-width:720px){.rbBox .dgT td,.rbBox .dgT th{white-space:normal}}[data-theme=dark] .rbV{background:#232a36}[data-theme=dark] .rbV.up{background:#173524}[data-theme=dark] .rbV.down{background:#3a1c1c}";
  document.head.appendChild(st);
})();
if (typeof module !== "undefined") module.exports = { rbSpear: rbSpear, rbIdx: rbIdx };
