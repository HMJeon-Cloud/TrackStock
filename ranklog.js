/* ============================================================
   v15.00 실전 기록 (ranklog.js) — "오늘 매긴 점수가 그 뒤 실제로 맞았나"
   점수 검증(rankbt.js)은 과거를 되돌려 보는 것이라 한계가 있다:
     · 지금 남아 있는 종목만 본다  · 기업 정보(ROE · PER …)는 과거 값을 몰라 검증하지 못한다  · 기준을 과거를 보고 고쳤을 수 있다
   실전 기록은 그 한계가 없는 유일한 검증이다 — 순위를 계산할 때마다 그날의 점수를 그대로 남겨 두고,
   시간이 지난 뒤 실제 수익과 맞춰 본다(기업 정보 · 매크로 · 새 전문가 기법 항목까지 전부).
   방법
     1) 전 종목 점수 계산이 끝나면 그 주(週)의 첫 계산을 기록한다 — 한 주에 하나, 고치지 않는다
        서버 보관: 공용 저장소 cfg:rklog:<연-주>  (기기 사이 공유 · 800일)   이 기기: 목록만(sm.rank.logidx)
     2) 다음 계산 때 종목마다 '기록한 날 → 오늘' 수익을 같은 시세 줄에서 구한다(액면분할이 있어도 어긋나지 않게)
     3) 기록끼리의 수익 = (1 + 기록A→오늘) ÷ (1 + 기록B→오늘) − 1  → 1 · 3 · 6 · 12개월 뒤 성적
     4) 애널리스트 추정치(목표가 평균 · 다음 회계연도 영업이익/EPS 추정)도 같이 남긴다 — 지나간 추정치는 나중에 다시 받을 수 없어서
        몇 주 쌓이면 '추정치가 오른 종목 · 내린 종목'을 보여 준다(전문가들이 가장 무겁게 보는 것 가운데 하나인 '추정치 변화')
   새 api 함수 없음(기존 공용 저장소 사용). 과거 통계이며 매수 권유가 아니다.
   ============================================================ */
var RL = { idx: null, snaps: null, fw: null, loading: false, open: 0, err: "" };
var RL_H = [[30, "1개월"], [91, "3개월"], [182, "6개월"], [365, "1년"]];
function rlWeek(t) { var d = new Date(t + 9 * 3600e3), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); var y = d.getUTCFullYear(), w1 = new Date(Date.UTC(y, 0, 4)); return y + "-W" + String(1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7)).padStart(2, "0"); }
function rlIdx() { if (RL.idx) return RL.idx; var a = []; try { a = JSON.parse(localStorage.getItem("sm.rank.logidx") || "[]") || []; } catch (e) {} RL.idx = a.filter(function (x) { return x && x.wk && x.at; }).sort(function (p, q) { return p.at - q.at; }); return RL.idx; }
function rlIdxSave() { try { localStorage.setItem("sm.rank.logidx", JSON.stringify(RL.idx || [])); } catch (e) {} }
function rlFw() { if (RL.fw) return RL.fw; var v = null; try { v = JSON.parse(localStorage.getItem("sm.rank.fw") || "null"); } catch (e) {} RL.fw = v && v.by ? v : { at: 0, by: {} }; return RL.fw; }
function rlFwSave() { try { localStorage.setItem("sm.rank.fw", JSON.stringify(RL.fw)); } catch (e) { try { localStorage.removeItem("sm.rank.fw"); } catch (x) {} } }
/* 기록 목록(작은 문서)을 서버와 맞춘다 — 다른 기기에서 남긴 기록도 알 수 있게. 순위 계산을 시작할 때 한 번 */
function rlIdxMerge(a) { var I = rlIdx(), by = {}; I.forEach(function (x) { by[x.wk] = x; }); (a || []).forEach(function (x) { if (x && x.wk && x.at && !by[x.wk]) by[x.wk] = { wk: x.wk, at: x.at, day: x.day, n: x.n, lite: x.lite ? 1 : 0 }; }); RL.idx = Object.keys(by).map(function (k) { return by[k]; }).sort(function (p, q) { return p.at - q.at; }); rlIdxSave(); return RL.idx; }
function rlBeforeRun() { RL.fwNew = null; if (typeof smKvGet !== "function") return Promise.resolve(); return smKvGet("cfg:rklogidx").then(function (v) { if (v && Array.isArray(v.list)) rlIdxMerge(v.list); }).catch(function () {}); }
/* 순위 계산 중: 이 종목의 '기록한 날 → 오늘' 수익을 기록마다 구해 둔다 (rank.js rkRun이 종목마다 부른다) */
function rlTrail(sym) {
  var I = rlIdx(); if (!I.length) return; var rows = typeof nbHist !== "undefined" ? nbHist[sym] : null; if (!rows || rows.length < 5) return;
  var F = RL.fwNew || (RL.fwNew = { at: Date.now(), by: {} }), n = rows.length, last = rows[n - 1];
  I.forEach(function (x) { var lo = 0, hi = n - 1, r = -1, T = x.at + 0.2 * 864e5; while (lo <= hi) { var m = (lo + hi) >> 1; if (rows[m].t <= T) { r = m; lo = m + 1; } else hi = m - 1; }
    if (r < 0 || T - rows[r].t > 6 * 864e5 || !(rows[r].c > 0)) return; (F.by[x.wk] = F.by[x.wk] || {})[sym] = Math.round((last.c / rows[r].c - 1) * 1e4) / 1e4; });
}
/* 순위 계산 끝: 수익 표를 저장하고, 이번 주 기록이 없으면 남긴다 */
function rlAfterRun(res) {
  try { if (RL.fwNew) { RL.fw = RL.fwNew; RL.fwNew = null; rlFwSave(); } } catch (e) {}
  if (!res || !res.rows || res.rows.length < 20 || typeof smKvPut !== "function") return Promise.resolve(false);
  var wk = rlWeek(res.at), I = rlIdx(); if (I.some(function (x) { return x.wk === wk; })) return Promise.resolve(false);
  var keys = RK_I.map(function (k) { return k[0]; }), W = rkW(), Ro = rkRole();
  var rows = res.rows.map(function (r) { var PT = rkPT(r.i, r.lev, W); return [r.s, r.px, PT.p == null ? -1 : PT.p, PT.t == null ? -1 : PT.t, r.lev ? 1 : 0, r.k ? 1 : 0].concat(keys.map(function (k) { return r.i[k] == null ? -1 : r.i[k]; })); });
  var cns = {}; res.rows.forEach(function (r) { if (!r.k) return; var F = typeof CORE !== "undefined" && CORE.fund ? CORE.fund[r.s] : null; if (!F || (F.tp == null && F.fwdOp == null && F.fwdEps == null)) return; cns[r.s] = [F.tp == null ? null : F.tp, F.fwdOp == null ? null : F.fwdOp, F.fwdEps == null ? null : F.fwdEps, F.fwdY || ""]; });
  var snap = { v: 1, wk: wk, day: res.day, at: res.at, keys: keys, role: { pick: Ro.pick, time: Ro.time }, W: W, rows: rows, cns: cns };
  if (JSON.stringify(snap).length > 58000) { snap.keys = []; snap.rows = rows.map(function (r) { return r.slice(0, 6); }); snap.lite = 1; }   // 공용 저장소 한도(60KB)를 넘으면 항목 점수는 빼고 종목 · 타이밍 점수만
  var key = "cfg:rklog:" + wk, done = function (x) { rlIdxMerge([x]); if (typeof smKvPut === "function") smKvPut("cfg:rklogidx", { list: rlIdx() }, 800 * 86400); };
  /* 다른 기기가 이번 주 기록을 이미 남겼으면 덮어쓰지 않는다 — '한 주에 하나 · 고치지 않음' */
  return (typeof smKvGet === "function" ? smKvGet(key) : Promise.resolve(null)).then(function (old) {
    if (old && old.wk === wk && old.at) { done({ wk: wk, at: old.at, day: old.day, n: (old.rows || []).length, lite: old.lite ? 1 : 0 }); return false; }
    return smKvPut(key, snap, 800 * 86400).then(function (ok) { if (!ok) { RL.err = "이번 주 기록을 서버에 남기지 못했어요 — 운영자 로그인과 저장소(Redis) 상태를 확인해 주세요. 다음 계산 때 다시 시도해요."; return false; }
      RL.err = ""; done({ wk: wk, at: res.at, day: res.day, n: rows.length, lite: snap.lite ? 1 : 0 }); if (RL.snaps) RL.snaps.push(snap); return true; }); }).catch(function () { RL.err = "이번 주 기록을 서버에 남기지 못했어요(서버에 닿지 못함)"; return false; });
}
/* 서버의 기록을 모두 불러온다 (화면에서 열 때 한 번) */
function rlLoad(force) {
  if (RL.snaps && !force) return Promise.resolve(RL.snaps); if (typeof smKvList !== "function") return Promise.resolve([]);
  /* 한 번에 받는 양을 줄이려고 연도별로 나눠 받는다(한 해 최대 53개) */
  var yNow = new Date(Date.now() + 9 * 3600e3).getUTCFullYear(), ys = {}; [yNow, yNow - 1, yNow - 2].forEach(function (y) { ys[y] = 1; }); rlIdx().forEach(function (x) { ys[String(x.wk).slice(0, 4)] = 1; });
  var Y = Object.keys(ys).sort(), all = [], i = 0, next = function () { if (i >= Y.length) return Promise.resolve(); return smKvList("cfg:rklog:" + Y[i++] + "-").then(function (items) { all = all.concat(items || []); return next(); }); };
  RL.loading = true; RL.loadErr = "";
  return next().then(function () { RL.loading = false;
    var S = all.map(function (x) { return x && x.v; }).filter(function (v) { return v && v.wk && v.at && Array.isArray(v.rows); }).sort(function (a, b) { return a.at - b.at; });
    if (!S.length && rlIdx().length) RL.loadErr = "이 기기에는 기록 " + rlIdx().length + "개가 적혀 있는데 서버에서 하나도 받지 못했어요 — 잠시 뒤 다시 불러와 주세요.";
    RL.snaps = S; if (S.length) rlIdxMerge(S.map(function (v) { return { wk: v.wk, at: v.at, day: v.day, n: v.rows.length, lite: v.lite ? 1 : 0 }; })); return S; }).catch(function () { RL.loading = false; RL.loadErr = "서버에서 기록을 불러오지 못했어요."; RL.snaps = RL.snaps || []; return RL.snaps; });
}
function rlSpear(x, y) { return typeof rbSpear === "function" ? rbSpear(x, y) : null; }
function rlMed(a) { a = a.filter(function (v) { return v != null && isFinite(v); }).sort(function (p, q) { return p - q; }); if (!a.length) return null; var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function rlMean(a) { a = a.filter(function (v) { return v != null && isFinite(v); }); return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null; }
/* 기록 A에서 h일 뒤의 수익(종목별) — 끝점은 h일에 가장 가까운 기록(±25%) 또는 '오늘' */
function rlPair(S, k, h, now) {
  var F = rlFw(), A = S[k], fa = F.by[A.wk]; if (!fa) return null; var want = A.at + h * 864e5, tol = Math.max(10, h * 0.25) * 864e5, best = null;
  for (var j = k + 1; j < S.length; j++) { var d = Math.abs(S[j].at - want); if (d <= tol && F.by[S[j].wk] && (!best || d < best.d)) best = { d: d, j: j }; }
  var dn = Math.abs((F.at || now) - want); if (F.at && dn <= tol && (!best || dn < best.d)) best = { d: dn, j: -1 };
  if (!best) return null; var fb = best.j >= 0 ? F.by[S[best.j].wk] : null, out = {};
  Object.keys(fa).forEach(function (s) { if (fb) { if (fb[s] != null && 1 + fb[s] > 0) out[s] = (1 + fa[s]) / (1 + fb[s]) - 1; } else out[s] = fa[s]; });
  return { ret: out, days: Math.round(((best.j >= 0 ? S[best.j].at : F.at) - A.at) / 864e5), end: best.j >= 0 ? S[best.j].day : "오늘" };
}
/* 한 기록 · 한 기간의 성적 */
function rlEvalOne(A, P) {
  var rows = A.rows.filter(function (r) { return !r[4] && P.ret[r[0]] != null; }), sc = rows.filter(function (r) { return r[2] >= 0; }); if (sc.length < 20) return null;
  var f = function (r) { return P.ret[r[0]]; }, by = sc.slice().sort(function (a, b) { return b[2] - a[2]; }), q = Math.max(3, Math.floor(by.length / 5));
  var o = { wk: A.wk, day: A.day, n: sc.length, days: P.days, end: P.end, ic: rlSpear(sc.map(function (r) { return r[2]; }), sc.map(f)), uni: rlMed(rows.map(f)), top: rlMed(by.slice(0, q).map(f)), bot: rlMed(by.slice(-q).map(f)), top10: rlMean(by.slice(0, 10).map(f)), uniMean: rlMean(rows.map(f)), items: {} };
  /* 좋은 종목(상위 30%) 가운데 타이밍 68 이상 vs 나머지 */
  var good = by.slice(0, Math.max(5, Math.floor(by.length * 0.3))), hi = good.filter(function (r) { return r[3] >= 68; }), lo = good.filter(function (r) { return r[3] >= 0 && r[3] < 68; }); o.goodHi = hi.length >= 3 ? rlMed(hi.map(f)) : null; o.goodLo = lo.length >= 3 ? rlMed(lo.map(f)) : null; o.nHi = hi.length;
  (A.keys || []).forEach(function (k, i) { var a = rows.filter(function (r) { return r[6 + i] >= 0; }); if (a.length >= 20) { var ic = rlSpear(a.map(function (r) { return r[6 + i]; }), a.map(f)); if (ic != null) o.items[k] = ic; } });
  return o;
}
/* 전체 집계 */
function rlAgg() {
  var S = RL.snaps || [], F = rlFw(), now = Date.now(), out = { n: S.length, first: S.length ? S[0] : null, H: [], items: null, tim: null, haveFw: Object.keys(F.by).length };
  RL_H.forEach(function (H) {
    var per = []; S.forEach(function (A, k) { var P = rlPair(S, k, H[0], now); if (!P) return; var e = rlEvalOne(A, P); if (e) per.push(e); });
    var ics = per.map(function (p) { return p.ic; }).filter(function (v) { return v != null; });
    out.H.push({ h: H[0], nm: H[1], per: per, n: per.length, ic: rlMean(ics), pos: ics.length ? ics.filter(function (v) { return v > 0; }).length / ics.length : null, spread: rlMean(per.map(function (p) { return p.top != null && p.bot != null ? p.top - p.bot : null; })), topEx: rlMean(per.map(function (p) { return p.top != null && p.uni != null ? p.top - p.uni : null; })), top10Ex: rlMean(per.map(function (p) { return p.top10 != null && p.uniMean != null ? p.top10 - p.uniMean : null; })), hiEx: rlMean(per.map(function (p) { return p.goodHi != null && p.goodLo != null ? p.goodHi - p.goodLo : null; })) });
  });
  /* 항목별 — 기록이 가장 많이 모인 기간으로 */
  var best = out.H.filter(function (x) { return x.n >= 1; }).sort(function (a, b) { return (b.n >= 3 ? 1 : 0) - (a.n >= 3 ? 1 : 0) || b.h - a.h; })[0];
  if (best) { var acc = {}; best.per.forEach(function (p) { Object.keys(p.items).forEach(function (k) { (acc[k] = acc[k] || []).push(p.items[k]); }); });
    out.items = { h: best.nm, n: best.n, list: RK_I.map(function (I) { var a = acc[I[0]] || []; return { k: I[0], g: I[1], nm: I[2], ic: rlMean(a), pos: a.length ? a.filter(function (v) { return v > 0; }).length / a.length : null, n: a.length }; }) }; }
  /* 타이밍 점수 — 같은 종목의 기록끼리(3개월 뒤 수익) */
  var H3 = out.H[1]; if (H3 && H3.n >= 6) { var bySym = {}; S.forEach(function (A, k) { var P = rlPair(S, k, 91, now); if (!P) return; A.rows.forEach(function (r) { if (r[4] || r[3] < 0 || P.ret[r[0]] == null) return; (bySym[r[0]] = bySym[r[0]] || []).push([r[3], P.ret[r[0]]]); }); });
    var w = []; Object.keys(bySym).forEach(function (s) { var a = bySym[s]; if (a.length >= 8) { var x = rlSpear(a.map(function (v) { return v[0]; }), a.map(function (v) { return v[1]; })); if (x != null) w.push(x); } });
    if (w.length >= 10) out.tim = { ic: rlMean(w), pos: w.filter(function (v) { return v > 0; }).length / w.length, n: w.length }; }
  return out;
}
/* 추정치 변화 — 가장 최근 기록과 약 4주 전 기록(2~10주 사이에서 4주에 가장 가까운 것)을 견준다. 액면분할이 의심되면(수정 주가 수익과 기록된 가격의 변화가 크게 다름) 목표가 · EPS는 뺀다 */
function rlRev() {
  var S = (RL.snaps || []).filter(function (x) { return x.cns && Object.keys(x.cns).length; }); if (S.length < 2) return { n: S.length };
  var L = S[S.length - 1], B = null; for (var i = S.length - 2; i >= 0; i--) { var d = (L.at - S[i].at) / 864e5; if (d < 14) continue; if (d > 70) break; if (!B || Math.abs(d - 28) < Math.abs((L.at - B.at) / 864e5 - 28)) B = S[i]; }
  if (!B) return { n: S.length, wait: 1 };
  var F = rlFw(), fa = F.by[B.wk] || {}, fb = F.by[L.wk] || null, px = function (A) { var o = {}; A.rows.forEach(function (r) { o[r[0]] = r[1]; }); return o; }, pL = px(L), pB = px(B), out = [];
  Object.keys(L.cns).forEach(function (s) { var a = L.cns[s], b = B.cns[s]; if (!b) return;
    var adj = fa[s] != null ? (fb && fb[s] != null ? (1 + fa[s]) / (1 + fb[s]) : 1 + fa[s]) : null, raw = pL[s] > 0 && pB[s] > 0 ? pL[s] / pB[s] : null, split = adj != null && raw != null && Math.abs(adj / raw - 1) > 0.25;
    var same = a[3] && a[3] === b[3], tp = !split && a[0] > 0 && b[0] > 0 ? a[0] / b[0] - 1 : null, op = same && a[1] != null && b[1] != null && b[1] > 0 ? a[1] / b[1] - 1 : null, eps = !split && same && a[2] != null && b[2] != null && b[2] > 0 ? a[2] / b[2] - 1 : null;
    var v = [tp, op, eps].filter(function (x) { return x != null && isFinite(x); }); if (!v.length) return; out.push({ s: s, tp: tp, op: op, eps: eps, y: a[3], split: split, sc: v.reduce(function (p, q) { return p + q; }, 0) / v.length }); });
  return { n: S.length, L: L, B: B, days: Math.round((L.at - B.at) / 864e5), total: out.length, up: out.filter(function (x) { return x.sc > 0.005; }).sort(function (p, q) { return q.sc - p.sc; }).slice(0, 8), dn: out.filter(function (x) { return x.sc < -0.005; }).sort(function (p, q) { return p.sc - q.sc; }).slice(0, 8) };
}
function rlRevHtml() {
  var R = rlRev(), P = function (v) { return v == null ? "–" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%"; }, nm = function (s) { return rkEsc(typeof nbName === "function" ? nbName(s) : s); };
  var h = '<div class="ddSub">애널리스트 추정치 변화 <small style="font-weight:400;color:var(--t-8a92a3,#8a92a3)">· 목표가 평균 · 다음 회계연도 영업이익/EPS 추정 — 기록에 같이 남겨 둔 값</small></div>';
  /* 받은 양을 그대로 보여 준다 — 못 받았으면 못 받았다고 */
  var SS = RL.snaps || [], last = SS[SS.length - 1], cc = last && last.cns ? Object.keys(last.cns) : [], nSt = last ? last.rows.filter(function (r) { return r[5]; }).length : 0, nTp = cc.filter(function (k) { return last.cns[k][0] != null; }).length, nOp = cc.filter(function (k) { return last.cns[k][1] != null; }).length;
  if (last) h += '<div class="' + (nSt >= 10 && !cc.length ? "ddWarn" : "briefDim") + '" style="margin:0 0 6px">가장 최근 기록(' + rkEsc(last.day) + ')의 주식 ' + nSt + '종목 가운데 목표가 ' + nTp + '종목 · 이익 추정 ' + nOp + '종목을 받았어요.' + (nSt >= 10 && !cc.length ? ' <b>하나도 받지 못했어요</b> — 네이버 증권의 응답 모양이 예상과 다를 수 있어요. 이 줄을 알려 주시면 고칠게요.' : nSt >= 10 && nOp < nSt * 0.3 ? ' 이익 추정은 증권사가 다루는 종목에만 있어요(주로 국내 대형주).' : '') + '</div>';
  if (!R.L) return h + '<div class="ddMini">' + (R.n ? "추정치가 담긴 기록이 " + R.n + "개예요. " : "") + (R.wait ? "가장 최근 기록과 2주 넘게 떨어진 기록이 아직 없어요 — " : "") + '추정치가 담긴 기록이 2주 넘는 간격으로 2개 이상 모이면 \'추정치가 오른 종목 · 내린 종목\'이 나와요. 전문가들은 "싸다"보다 "추정치가 오르는 중인가"를 더 무겁게 보는 경우가 많은데, 지나간 추정치는 나중에 다시 받을 수 없어서 지금부터 쌓아요.</div>';
  var row = function (x) { return '<tr><td><b>' + nm(x.s) + '</b> <small style="color:var(--t-8a92a3,#8a92a3)">' + rkEsc(x.s) + '</small></td><td class="' + (x.tp > 0 ? "pos" : x.tp < 0 ? "neg" : "") + '">' + P(x.tp) + '</td><td class="' + (x.op > 0 ? "pos" : x.op < 0 ? "neg" : "") + '">' + P(x.op) + '</td><td class="' + (x.eps > 0 ? "pos" : x.eps < 0 ? "neg" : "") + '">' + P(x.eps) + '</td><td>' + rkEsc(x.y || "–") + (x.split ? ' <small style="color:#c9772b">분할 의심 — 목표가 · EPS 제외</small>' : '') + '</td></tr>'; }, tb = function (t, a) { return '<div><div class="ddSub" style="margin-top:6px">' + t + '</div><div class="dxWrap"><table class="dgT"><thead><tr><th>종목</th><th>목표가 평균</th><th>영업이익 추정</th><th>EPS 추정</th><th>추정 연도</th></tr></thead><tbody>' + (a.length ? a.map(row).join("") : '<tr><td colspan="5" class="briefDim">없음</td></tr>') + '</tbody></table></div></div>'; };
  return h + '<div class="briefDim" style="margin:0 0 6px">' + rkEsc(R.B.day) + ' → ' + rkEsc(R.L.day) + ' (' + R.days + '일) · 견줄 수 있는 종목 ' + R.total + '개</div><div class="rbTwo">' + tb("추정치가 오른 종목", R.up) + tb("추정치가 내린 종목", R.dn) + '</div><div class="ddMini"><b>읽는 법</b> 추정치는 네이버 증권에 나오는 증권사 평균(컨센서스)이에요. 추정치가 오르는데 주가가 덜 오른 종목은 전문가들이 가장 먼저 들여다보는 후보이고, 추정치가 내리는데 싸 보이는 종목은 "싼 데는 이유가 있다"의 전형이에요. 기업 정보를 7일까지 보관해 다시 쓰므로 실제 변경일과 며칠 어긋날 수 있고, 추정 연도가 바뀐 종목(회계연도가 넘어감)의 이익 추정은 견주지 않았어요. 이 변화가 그 뒤 수익을 맞혔는지는 기록이 더 쌓이면 따로 검증할 수 있어요.</div>';
}
function rlHtml() {
  if (typeof rkLoad !== "function") return ""; var I = rlIdx(), R = rkLoad(), wkNow = rlWeek(Date.now()), has = I.some(function (x) { return x.wk === wkNow; }), P = function (v, d) { return typeof ddPct === "function" ? ddPct(v, d == null ? 1 : d) : String(v); }, sg = function (v, d) { return v == null ? "–" : (v >= 0 ? "+" : "") + v.toFixed(d == null ? 3 : d); };
  var first = I[0], age = first ? Math.round((Date.now() - first.at) / 864e5) : 0;
  var h = '<details class="egBox rkHow rlBox"' + (RL.open ? " open" : "") + '><summary>실전 기록 — 오늘 매긴 점수가 그 뒤 실제로 맞았나 <em>' + (I.length ? I.length + '주 기록 · ' + age + '일째' : "아직 기록 전") + '</em></summary>';
  h += '<div class="rbTop"><div class="briefDim">점수 검증은 과거를 되돌려 본 것이라, 기업 정보(ROE · PER …)는 검증하지 못했고 지금 남아 있는 종목만 봤어요. 실전 기록은 그 한계가 없어요 — "전 종목 점수 계산"을 할 때마다 그 주의 첫 점수를 그대로 남기고(한 주에 하나 · 고치지 않음), 1 · 3 · 6 · 12개월 뒤 실제 수익과 맞춰 봐요. 전문가들이 전략을 믿기 전에 꼭 거치는 "보지 않은 기간에서의 확인"이에요.</div><div class="rkTopR"><button class="ghost" data-rlload' + (RL.loading ? " disabled" : "") + '>' + (RL.loading ? "불러오는 중…" : RL.snaps ? "다시 불러오기" : "기록 불러와 성적 보기") + '</button></div></div>';
  h += '<div class="ddKs"><div class="ddK"><b>' + I.length + '</b><span>쌓인 기록(주)</span><small>' + (first ? "첫 기록 " + first.day : "순위를 계산하면 첫 기록이 남아요") + '</small></div><div class="ddK"><b>' + (has ? "남김" : R && rlWeek(R.at) === wkNow ? "남기는 중" : "아직") + '</b><span>이번 주 기록</span><small>' + (has ? "이번 주는 이미 남겼어요 — 다음 주 계산 때 새 기록이 생겨요" : "\"전 종목 점수 계산\"을 누르면 남아요") + '</small></div><div class="ddK"><b>' + (age >= 30 ? "가능" : "대기") + '</b><span>첫 성적(1개월 뒤)</span><small>' + (age >= 30 ? "1개월 넘은 기록이 있어요" : first ? "약 " + (30 - age) + "일 뒤부터 나와요" : "기록이 생긴 뒤 한 달") + '</small></div></div>';
  if (RL.err) h += '<div class="ddWarn"><b>기록 실패</b> ' + rkEsc(RL.err) + '</div>';
  if (!RL.snaps) return h + '<div class="ddMini"><b>이렇게 쓰세요</b> 주 1회쯤 "전 종목 점수 계산"을 눌러 두면 기록이 쌓여요. 한 달 뒤부터 "기록 불러와 성적 보기"로 종목 점수 · 타이밍 점수 · 항목 하나하나가 실제로 맞았는지 볼 수 있어요. 기록이 적을 때의 숫자는 우연일 수 있으니, 3개월 기록 6개 이상부터 판단 근거로 쓰세요.</div></details>';
  var A = rlAgg();
  if (RL.loadErr) h += '<div class="ddWarn"><b>불러오기 실패</b> ' + rkEsc(RL.loadErr) + '</div>';
  if (!A.n) return h + '<div class="briefDim">' + (RL.loadErr ? "" : "서버에 남은 기록이 없어요.") + '</div></details>';
  if (!A.haveFw) h += '<div class="ddWarn"><b>수익을 계산하려면 "다시 계산"이 필요해요</b> 기록한 날부터 오늘까지의 수익은 순위를 계산할 때 종목 시세에서 같이 구해요(액면분할이 있어도 어긋나지 않게). 이 기기에서 한 번 계산해 주세요.</div>';
  var any = A.H.some(function (x) { return x.n; });
  if (any) {
    h += '<div class="ddSub">기간별 성적 <small style="font-weight:400;color:var(--t-8a92a3,#8a92a3)">· 종목 점수가 높았던 종목이 그 뒤 더 올랐나</small></div><div class="dxWrap"><table class="dgT"><thead><tr><th>기록 뒤</th><th>기록 수</th><th>종목 점수 순위상관</th><th>방향이 맞은 기록</th><th>상위 20% − 하위 20%</th><th>상위 20% − 전체</th><th>상위 10개 − 전체 평균</th><th>좋은 종목 중 타이밍 68↑ − 나머지</th></tr></thead><tbody>' + A.H.map(function (x) { return '<tr><td><b>' + x.nm + '</b></td><td>' + x.n + '</td><td>' + (x.n ? sg(x.ic) : "–") + '</td><td>' + (x.pos == null ? "–" : Math.round(x.pos * 100) + "%") + '</td><td>' + (x.spread == null ? "–" : P(x.spread) + "p") + '</td><td>' + (x.topEx == null ? "–" : P(x.topEx) + "p") + '</td><td>' + (x.top10Ex == null ? "–" : P(x.top10Ex) + "p") + '</td><td>' + (x.hiEx == null ? "–" : P(x.hiEx) + "p") + '</td></tr>'; }).join("") + '</tbody></table></div>';
    var mx = A.H.filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; })[0];
    h += '<div class="rbV ' + (mx.n >= 6 && mx.ic >= 0.05 && mx.pos >= 0.6 ? "up" : mx.n >= 6 && mx.ic <= -0.03 ? "down" : "") + '"><b>' + (mx.n < 6 ? "아직 판단하기 이른 단계" : mx.ic >= 0.05 && mx.pos >= 0.6 ? "실전에서도 맞고 있어요" : mx.ic <= -0.03 ? "실전에서는 거꾸로 가고 있어요" : "실전에서는 뚜렷하지 않아요") + '</b><span>' + (mx.n < 6 ? mx.nm + " 뒤 성적이 나온 기록이 " + mx.n + "개뿐이에요. 6개가 모이기 전의 숫자는 한두 번의 시장 흐름에 좌우돼요 — 방향만 참고하세요." : mx.nm + " 뒤 기준, 기록 " + mx.n + "개 가운데 " + Math.round(mx.pos * 100) + "%에서 종목 점수의 방향이 맞았고 순위상관 평균은 " + sg(mx.ic) + "예요. 기록 기간이 서로 겹쳐서 독립된 확인은 이보다 적어요.") + '</span></div>';
    if (A.tim) h += '<div class="ddMini"><b>타이밍 점수(같은 종목의 기록끼리 · 3개월 뒤)</b> 순위상관 ' + sg(A.tim.ic) + ' · 방향이 맞은 종목 ' + Math.round(A.tim.pos * 100) + '% (' + A.tim.n + '종목) — ' + (A.tim.ic >= 0.05 && A.tim.pos >= 0.6 ? "한 종목 안에서 타이밍 점수가 높았던 주에 산 쪽이 더 좋았어요." : "아직 뚜렷하지 않아요.") + '</div>';
    if (A.items && A.items.list.some(function (x) { return x.n; })) {
      h += '<div class="ddSub">항목 하나하나 — 실전에서 <small style="font-weight:400;color:var(--t-8a92a3,#8a92a3)">· ' + A.items.h + ' 뒤 · 기록 ' + A.items.n + '개' + (A.items.n < 6 ? "(적어서 우연일 수 있어요)" : "") + ' · 같은 날 종목끼리 견준 순위상관 · 과거 검증에서 못 본 기업 정보(④)도 여기서는 보여요</small></div><div class="dxWrap"><table class="dgT rbIt"><thead><tr><th>항목</th><th>순위상관(평균)</th><th>방향이 맞은 기록</th><th>기록 수</th><th>지금 쓰임</th></tr></thead><tbody>' + A.items.list.filter(function (x) { return x.n; }).sort(function (a, b) { return a.g - b.g || (b.ic || -9) - (a.ic || -9); }).map(function (x) { var ro = rkRoleOf(x.k); return '<tr><td><b>' + RK_G[x.g].no + ' ' + rkEsc(x.nm) + '</b></td><td>' + sg(x.ic) + '</td><td>' + (x.pos == null ? "–" : Math.round(x.pos * 100) + "%") + '</td><td>' + x.n + '</td><td>' + (ro === "pick" ? '<span class="rkRo p">종목</span>' : ro === "time" ? '<span class="rkRo t">타이밍</span>' : '<span class="rkRo' + (typeof rkRefLabel === "function" && rkRefLabel(x.k) === "검증 전" ? " n" : "") + '">' + (typeof rkRefLabel === "function" ? rkRefLabel(x.k) : "참고") + '</span>') + '</td></tr>'; }).join("") + '</tbody></table></div><div class="ddMini"><b>읽는 법</b> 타이밍 항목(낙폭 · 200주선 …)과 매크로는 같은 날 종목끼리 견주는 이 표에서 마이너스나 빈칸이 정상이에요 — "무엇을"이 아니라 "언제"에 쓰는 항목이라서요. 여기서는 종목 항목과 검증 전 항목이 플러스인지를 봐요.</div>';
    }
    var open = A.H.filter(function (x) { return x.n; })[0];
    if (open) h += '<details class="rbPer"><summary>기록별 결과 (' + open.nm + ' 뒤 · ' + open.per.length + '개)</summary><div class="dxWrap"><table class="dgT"><thead><tr><th>기록한 날</th><th>끝점</th><th>실제 간격</th><th>종목 수</th><th>순위상관</th><th>상위 20%</th><th>하위 20%</th><th>전체 중앙값</th></tr></thead><tbody>' + open.per.map(function (p) { return '<tr><td>' + rkEsc(p.day) + '</td><td>' + rkEsc(p.end) + '</td><td>' + p.days + '일</td><td>' + p.n + '</td><td>' + sg(p.ic, 2) + '</td><td>' + P(p.top) + '</td><td>' + P(p.bot) + '</td><td>' + P(p.uni) + '</td></tr>'; }).join("") + '</tbody></table></div></details>';
  } else h += '<div class="ddMini"><b>아직 성적을 낼 기록이 없어요</b> 가장 오래된 기록이 ' + age + '일 전이에요. 1개월(±1주)이 지난 기록이 생기면 첫 성적이 나와요.</div>';
  try { h += rlRevHtml(); } catch (e) { if (typeof console !== "undefined") console.warn("rl rev", e); }
  h += '<div class="ddMini"><b>이 기록이 말해 주지 못하는 것</b> ① 기록이 적은 동안에는 그 기간의 시장 흐름(예: 기술주만 오른 석 달)이 결과를 좌우해요. ② 기록 간격이 주 단위라 "1개월 뒤"는 실제로 3~5주 사이예요(표의 "실제 간격"). ③ 기간이 서로 겹쳐서 기록 12개가 독립된 확인 12번은 아니에요. ④ 항목 · 비중 · 역할을 바꾸면 그 뒤 기록부터 바뀐 점수가 남아요 — 옛 기록은 그때의 점수 그대로예요(그래서 정직한 기록이에요). 종가 기준이며 배당은 넣지 않았어요.</div>';
  return h + '</details>';
}
function rlBind(el) {
  var box = el.querySelector(".rlBox"); if (!box) return; box.addEventListener("toggle", function () { RL.open = box.open ? 1 : 0; });
  var b = box.querySelector("[data-rlload]"); if (b) b.onclick = function () { RL.open = 1; RL.loading = true; if (typeof renderRank === "function") renderRank(); rlLoad(true).then(function () { if (typeof currentTab === "undefined" || currentTab === "rank") renderRank(); }); };
}
if (typeof module !== "undefined") module.exports = { rlWeek: rlWeek };
