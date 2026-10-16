/* ============================================================
   매크로 (v11.4) — 관심 탭 '매크로'
   ① 지금 숫자: 원/달러 환율 · 한국 기준금리 · 미국 기준금리 · 한미 금리차 · 미 10년 금리 · 미 M2 전년比
   ② 조건별 과거: '환율 1,400원 돌파' 같은 조건이 처음 나온 날 → 다음 거래일에 샀다면 3개월·6개월·1년 뒤
      코스피 · S&P500(달러) · S&P500(원화 환산) · 환율 — 사례별 숫자 + 중앙값 · 오른 횟수 · 평소(아무 날)와 비교
   ③ 카드(운영자): 연구노트(HISTORY) 덱과 같은 틀 — 표지 · 지금 숫자 · 과거 사례 · 기간별 · 자산별 · 조건표 · 읽는 법 · 마무리 + 업로드 글
   데이터: /api/snap?macro=1 (한국은행 ECOS · 미국 FRED, 아침 수집 크론이 하루 한 번) + 기존 /api/snap?symbol= 종가
   ============================================================ */
var MAC = { doc: null, loading: null, pxP: null, px: {}, res: null, cond: null, asset: "ks" };
(function () { try { var j = JSON.parse(localStorage.getItem("sm.macro") || "null"); if (j) { MAC.cond = j.cond || null; MAC.asset = j.asset || "ks"; } } catch (e) {} })();
function macSave() { try { localStorage.setItem("sm.macro", JSON.stringify({ cond: MAC.cond, asset: MAC.asset })); } catch (e) {} }

var MAC_DAY = 864e5;
var MAC_ASSETS = [["ks", "코스피"], ["sp", "S&P500 (달러)"], ["spk", "S&P500 (원화)"], ["fx", "원/달러 환율"]];
var MAC_H = [[91, "3개월"], [182, "6개월"], [365, "1년"]];
/* 조건 — 'on'이 처음 참이 된 날(앞의 gap일 동안은 한 번도 참이 아니었던 날)을 사례로 센다 */
var MAC_COND = [
  { id: "krw1400", icon: "💵", tag: "환율 1,400원 돌파", short: "환율 1,400원", s: "krw", type: "lv", lv: 1400, dir: 1, gap: 180, mean: "원화 가치가 크게 떨어졌다는 뜻 — 외국인 자금이 빠지거나 위기 때 자주 나왔어요." },
  { id: "krw1300", icon: "💵", tag: "환율 1,300원 돌파", short: "환율 1,300원", s: "krw", type: "lv", lv: 1300, dir: 1, gap: 180, mean: "2010년대엔 '고환율'로 불리던 선. 1,400원보다 자주 나와 사례가 많아요." },
  { id: "krwJump", icon: "📈", tag: "환율 한 달 +3% 급등", short: "환율 급등", s: "krw", type: "chg", win: 30, th: 0.03, gap: 120, mean: "한 달 사이 원화가 빠르게 약해진 때 — 수준보다 '속도'를 봐요." },
  { id: "bokCut", icon: "🇰🇷", tag: "한국 기준금리 인하 시작", short: "한은 인하 시작", s: "bok", type: "turn", dir: -1, gap: 365, mean: "인상·동결 뒤 첫 인하. 경기를 받치려 돈의 값을 낮추기 시작한 때예요." },
  { id: "bokHike", icon: "🇰🇷", tag: "한국 기준금리 인상 시작", short: "한은 인상 시작", s: "bok", type: "turn", dir: 1, gap: 365, mean: "인하·동결 뒤 첫 인상. 물가·환율을 잡으려 돈의 값을 올리기 시작한 때예요." },
  { id: "fedCut", icon: "🇺🇸", tag: "미국 기준금리 인하 시작", short: "연준 인하 시작", s: "fed", type: "turn", dir: -1, gap: 365, mean: "연준의 첫 인하. 위기 대응 인하와 '보험성' 인하가 섞여 있어요." },
  { id: "fedHike", icon: "🇺🇸", tag: "미국 기준금리 인상 시작", short: "연준 인상 시작", s: "fed", type: "turn", dir: 1, gap: 365, mean: "연준의 첫 인상. 달러 금리가 오르면 신흥국 돈이 빠질 수 있어요." },
  { id: "us10y45", icon: "🏦", tag: "미 10년 금리 4.5% 돌파", short: "미 10년물 4.5%", s: "us10y", type: "lv", lv: 4.5, dir: 1, gap: 365, mean: "주식의 '경쟁 상대'인 안전한 채권 이자가 높아진 때예요." },
  { id: "inv", icon: "🔁", tag: "한미 금리 역전 (미국 > 한국)", short: "한미 금리 역전", s: "gap", type: "gap", gap: 365, mean: "미국 기준금리가 한국보다 높아진 때 — 원화 약세 압력으로 자주 이야기돼요." },
  { id: "m2neg", icon: "💧", tag: "미 M2 전년比 감소", short: "M2 감소", s: "m2", type: "yoy", th: 0, dir: -1, gap: 365, mean: "시중에 풀린 돈(M2)이 1년 전보다 줄어든 때. 아주 드물어요." },
  { id: "m2hot", icon: "💧", tag: "미 M2 전년比 +10% 이상", short: "M2 급증", s: "m2", type: "yoy", th: 0.1, dir: 1, gap: 365, mean: "돈이 크게 풀린 때(위기 대응 등). 자산 가격이 같이 오르는 경우가 많았어요." }
];

function macEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function macPct(x, d) { return x == null || !isFinite(x) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function macT(ymd) { ymd = String(ymd); return Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)); }
function macYmd(t) { return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
function macD(t, full) { var d = new Date(t); return full === false ? (d.getUTCMonth() + 1) + "." + d.getUTCDate() : d.getUTCFullYear() + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + (full ? "." + String(d.getUTCDate()).padStart(2, "0") : ""); }
function macMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function macIdx(T, t) { var lo = 0, hi = T.length; while (lo < hi) { var m = (lo + hi) >> 1; if (T[m] < t) lo = m + 1; else hi = m; } return lo; }   // t 이상인 첫 위치
function macAt(S, t) { if (!S || !S.t.length) return null; var i = macIdx(S.t, t + 1) - 1; return i >= 0 ? S.v[i] : null; }   // t 시점에 알려진 마지막 값
function macFmt(id, v) { if (v == null || !isFinite(v)) return "-"; if (id === "krw") return Math.round(v).toLocaleString("ko-KR") + "원"; if (id === "m2y") return macPct(v); if (id === "gap") return (v > 0 ? "+" : "") + v.toFixed(2) + "%p"; return v.toFixed(2) + "%"; }

/* ---------- 데이터 ---------- */
function macroEnsure(fresh) {
  if (MAC.doc && !fresh) return Promise.resolve(MAC.doc);
  if (MAC.loading) return MAC.loading;
  MAC.loading = fetch("/api/snap?macro=1" + (fresh ? "&fresh=" + Date.now() : "")).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    .then(function (d) { MAC.doc = d && d.series ? d : { series: {}, none: true }; MAC.loading = null; MAC.res = null; return MAC.doc; });
  return MAC.loading;
}
function macSer(id) {
  var s = MAC.doc && MAC.doc.series && MAC.doc.series[id]; if (!s || !s.d || !s.d.length) return null;
  if (!s._S) s._S = { t: s.d.map(function (r) { return macT(r[0]); }), v: s.d.map(function (r) { return r[1]; }), f: s.f, n: s.n, at: s.at };
  return s._S;
}
/* 한미 금리차(미국 - 한국): 환율이 있는 날마다 */
function macGapSer() {
  var cal = macSer("krw") || macSer("us10y"), a = macSer("fed"), b = macSer("bok"); if (!cal || !a || !b) return null;
  var t = [], v = []; cal.t.forEach(function (x) { if (x < b.t[0]) return; var p = macAt(a, x), q = macAt(b, x); if (p != null && q != null) { t.push(x); v.push(+(p - q).toFixed(2)); } });
  return t.length ? { t: t, v: v, f: "D" } : null;
}
/* 미 M2 전년 대비 (월별 → 발표 시차 약 45일 뒤에 안 것으로) */
function macM2y() {
  var m = macSer("m2"); if (!m || m.t.length < 14) return null; var t = [], v = [];
  for (var i = 12; i < m.t.length; i++) { t.push(m.t[i] + 45 * MAC_DAY); v.push(m.v[i] / m.v[i - 12] - 1); }
  return { t: t, v: v, f: "M" };
}
function macPxLoad() {
  if (MAC.pxP) return MAC.pxP;
  var L = [["ks", "^KS11"], ["sp", "SPY"]];
  MAC.pxP = Promise.all(L.map(function (p) { return (typeof getChartData === "function" ? getChartData(p[1], "max") : Promise.reject()).then(function (d) { MAC.px[p[0]] = ((d && d.rows) || []).filter(function (r) { return r.c > 0; }); }).catch(function () { MAC.px[p[0]] = []; }); }))
    .then(function () { MAC.res = null; return MAC.px; });
  return MAC.pxP;
}
/* 자산 줄(시간·값): 코스피 · S&P500 · S&P500×환율 · 환율 */
function macAsset(k) {
  if (MAC["_a" + k]) return MAC["_a" + k];
  var out = null, krw = macSer("krw");
  if (k === "ks" || k === "sp") { var R = MAC.px[k] || []; out = { t: R.map(function (r) { return r.t; }), v: R.map(function (r) { return r.c; }) }; }
  if (k === "spk" && krw) { var S = MAC.px.sp || [], t = [], v = []; S.forEach(function (r) { var f = macAt(krw, r.t); if (f) { t.push(r.t); v.push(r.c * f); } }); out = { t: t, v: v }; }
  if (k === "fx" && krw) out = { t: krw.t, v: krw.v };
  if (out && out.t.length) MAC["_a" + k] = out;
  return out && out.t.length ? out : null;
}
/* 사례 날 e에 '다음 거래일' 종가로 샀다면 h일 뒤 (null = 그 시기 가격 없음, "wait" = 아직 기간이 안 지남) */
function macFwd(A, e, h) {
  if (!A) return null; var i0 = macIdx(A.t, e + MAC_DAY); if (i0 >= A.t.length || A.t[i0] - e > 10 * MAC_DAY) return null;
  var want = A.t[i0] + h * MAC_DAY, i1 = macIdx(A.t, want); if (i1 >= A.t.length) return "wait";
  return A.v[i1] / A.v[i0] - 1;
}
/* 평소: 아무 날이나 샀을 때 h일 뒤 (5일 간격 표본) */
function macBase(k, h) {
  var key = "_b" + k + h; if (MAC[key] !== undefined) return MAC[key];
  var A = macAsset(k), vals = []; if (A) { for (var i = 0; i < A.t.length; i += 5) { var j = macIdx(A.t, A.t[i] + h * MAC_DAY); if (j >= A.t.length) break; vals.push(A.v[j] / A.v[i] - 1); } }
  return (MAC[key] = vals.length >= 50 ? { med: macMed(vals), win: vals.filter(function (x) { return x > 0; }).length / vals.length, n: vals.length, from: A.t[0] } : null);
}

/* ---------- 조건 → 사례 날짜 ---------- */
function macSerOf(c) { return c.s === "gap" ? macGapSer() : c.s === "m2" ? macM2y() : macSer(c.s); }
function macEvents(c) {
  var S = macSerOf(c); if (!S) return { S: null, ev: [] };
  var ev = [], lastOn = null, warm = S.t[0] + c.gap * MAC_DAY;   // 자료 시작 직후는 '처음 참'인지 알 수 없어 뺀다
  if (c.type === "turn") {   // 계단: 직전 변경이 반대 방향이거나 gap일 넘게 변화가 없었던 뒤의 첫 변경
    for (var i = 1; i < S.t.length; i++) { var d = S.v[i] - S.v[i - 1]; if (!d) continue; var dir = d > 0 ? 1 : -1;
      if (dir === c.dir) { var pd = i >= 2 ? (S.v[i - 1] - S.v[i - 2] > 0 ? 1 : -1) : 0; if ((i >= 2 && pd !== dir) || (S.t[i] - S.t[i - 1] > c.gap * MAC_DAY && S.t[i] >= warm)) ev.push({ t: S.t[i], v: S.v[i], prev: S.v[i - 1] }); } }
    return { S: S, ev: ev };
  }
  for (var k = 0; k < S.t.length; k++) {
    var on = false, x = S.v[k];
    if (c.type === "lv") on = c.dir > 0 ? x >= c.lv : x <= c.lv;
    else if (c.type === "gap") on = x > 0;
    else if (c.type === "yoy") on = c.dir > 0 ? x >= c.th : x < c.th;
    else if (c.type === "chg") { var j = macIdx(S.t, S.t[k] - c.win * MAC_DAY); if (j < k && S.t[k] - S.t[j] >= (c.win - 5) * MAC_DAY) { x = S.v[k] / S.v[j] - 1; on = x >= c.th; } }
    if (on) { if (S.t[k] >= warm && (lastOn == null || S.t[k] - lastOn > c.gap * MAC_DAY)) ev.push({ t: S.t[k], v: c.type === "chg" ? S.v[k] : x, chg: c.type === "chg" ? x : null }); lastOn = S.t[k]; }
  }
  return { S: S, ev: ev };
}
/* 지금 상태 */
function macNow(c, S, ev) {
  if (!S || !S.t.length) return { on: false, txt: "데이터 없음" };
  var n = S.t.length, x = S.v[n - 1], last = ev[ev.length - 1];
  if (c.type === "lv") { var on = c.dir > 0 ? x >= c.lv : x <= c.lv; return { on: on, v: x, big: macFmt(c.s, x), txt: "지금 " + macFmt(c.s, x) + (on ? " · 기준선 위" : " · 기준까지 " + macPct(c.lv / x - 1)) }; }
  if (c.type === "gap") return { on: x > 0, v: x, big: "한미 금리차 " + macFmt("gap", x), txt: "지금 금리차 " + macFmt("gap", x) + (x > 0 ? " · 역전 중" : "") };
  if (c.type === "yoy") return { on: c.dir > 0 ? x >= c.th : x < c.th, v: x, big: "M2 전년比 " + macPct(x), txt: "지금 M2 전년比 " + macPct(x) };
  if (c.type === "chg") { var j = macIdx(S.t, S.t[n - 1] - c.win * MAC_DAY), g = S.v[n - 1] / S.v[j] - 1; return { on: g >= c.th, v: g, big: "환율 한 달 " + macPct(g), txt: "최근 한 달 " + macPct(g) + " · 지금 " + macFmt(c.s, x) }; }
  if (c.type === "turn") { var ld = null; for (var i = n - 1; i > 0; i--) if (S.v[i] !== S.v[i - 1]) { ld = { t: S.t[i], dir: S.v[i] > S.v[i - 1] ? 1 : -1 }; break; }
    return { on: !!(ld && ld.dir === c.dir && Date.now() - ld.t < 365 * MAC_DAY), v: x, big: (c.s === "bok" ? "한국 기준금리 " : "미국 기준금리 ") + macFmt(c.s, x), txt: "지금 " + macFmt(c.s, x) + (ld ? " · 마지막 " + (ld.dir > 0 ? "인상" : "인하") + " " + macD(ld.t) : "") }; }
  return { on: false, txt: "" };
}
/* 전체 계산 (조건 × 자산 × 기간) */
function macroCompute() {
  if (MAC.res) return MAC.res;
  var res = MAC_COND.map(function (c) {
    var E = macEvents(c), now = macNow(c, E.S, E.ev), st = {};
    var evs = E.ev.map(function (e) { var f = {}; MAC_ASSETS.forEach(function (a) { var A = macAsset(a[0]); f[a[0]] = MAC_H.map(function (h) { return macFwd(A, e.t, h[0]); }); }); return Object.assign({ f: f }, e); });
    MAC_ASSETS.forEach(function (a) { st[a[0]] = MAC_H.map(function (h, hi) { var v = evs.map(function (e) { return e.f[a[0]][hi]; }).filter(function (x) { return typeof x === "number"; }); return { n: v.length, med: macMed(v), win: v.filter(function (x) { return x > 0; }).length, min: v.length ? Math.min.apply(null, v) : null, max: v.length ? Math.max.apply(null, v) : null, wait: evs.filter(function (e) { return e.f[a[0]][hi] === "wait"; }).length }; }); });
    return { c: c, S: E.S, ev: evs, now: now, st: st, from: E.S ? E.S.t[0] : null };
  });
  MAC.res = res; return res;
}
function macRes(id) { var R = macroCompute(); return R.filter(function (r) { return r.c.id === id; })[0] || R[0]; }
function macReady() { return !!(MAC.doc && !MAC.doc.none && macSer("krw") && MAC.px.ks && MAC.px.ks.length); }

/* ---------- 지금 숫자 (KPI) ---------- */
function macKpis() {
  var out = [];
  function add(id, l, S, fmt, sub) { if (!S || !S.t.length) return; var n = S.t.length, x = S.v[n - 1], j = macIdx(S.t, S.t[n - 1] - 365 * MAC_DAY); out.push({ id: id, l: l, v: fmt(x), sub: sub ? sub(S, x, j) : "", S: S, at: S.t[n - 1] }); }
  add("krw", "원/달러 환율", macSer("krw"), function (x) { return macFmt("krw", x); }, function (S, x) { var n = S.t.length, j = macIdx(S.t, S.t[n - 1] - 30 * MAC_DAY); return "한 달 " + macPct(x / S.v[j] - 1); });
  add("bok", "한국 기준금리", macSer("bok"), function (x) { return macFmt("bok", x); }, function (S) { return "변경 " + macD(S.t[S.t.length - 1]); });
  add("fed", "미국 기준금리(상단)", macSer("fed"), function (x) { return macFmt("fed", x); }, function (S) { return "변경 " + macD(S.t[S.t.length - 1]); });
  add("gap", "한미 금리차(미-한)", macGapSer(), function (x) { return macFmt("gap", x); }, function (S, x) { return x > 0 ? "미국이 더 높음" : "한국이 더 높음"; });
  add("us10y", "미 10년 금리", macSer("us10y"), function (x) { return macFmt("us10y", x); }, function (S, x, j) { return "1년 전 " + macFmt("us10y", S.v[j]); });
  add("m2y", "미 M2 전년比", macM2y(), function (x) { return macPct(x); }, function (S) { return macD(S.t[S.t.length - 1] - 45 * MAC_DAY) + " 기준"; });
  return out;
}
function macSpark(S, days) {
  var t0 = S.t[S.t.length - 1] - days * MAC_DAY, i0 = macIdx(S.t, t0), T = S.t.slice(i0), V = S.v.slice(i0); if (T.length < 2) return "";
  var step = Math.max(1, Math.floor(T.length / 120)), W = 120, H = 30, mn = Math.min.apply(null, V), mx = Math.max.apply(null, V), r = mx - mn || 1, p = [];
  for (var i = 0; i < T.length; i += step) p.push(((T[i] - T[0]) / (T[T.length - 1] - T[0]) * W).toFixed(1) + "," + (H - 2 - (V[i] - mn) / r * (H - 4)).toFixed(1));
  p.push(W + "," + (H - 2 - (V[V.length - 1] - mn) / r * (H - 4)).toFixed(1));
  return '<svg class="macSpark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + p.join(" ") + '"/></svg>';
}

/* ============================================================ 화면 ============================================================ */
function renderMacro() {
  var box = document.getElementById("macroBody"); if (!box) return;
  if (!MAC.doc) { box.innerHTML = '<div class="dvEmpty">매크로 지표를 불러오는 중…</div>'; macroEnsure().then(renderMacro); return; }
  if (MAC.doc.none || !macSer("krw") && !macSer("us10y")) { box.innerHTML = '<div class="dvEmpty">아직 수집된 매크로 지표가 없어요. 매일 아침 수집이 돌면 한국은행(ECOS)·미국 FRED에서 환율·금리·M2를 받아 와요.</div>'; return; }
  var K = macKpis();
  var h = '<div class="macKpis">' + K.map(function (k) { return '<div class="kpi macK"><div class="kl">' + k.l + '</div><div class="kv">' + k.v + '</div><div class="kl macKs">' + macEsc(k.sub) + '</div>' + macSpark(k.S, 365 * 3) + '</div>'; }).join("") + '</div>';
  h += '<div class="briefDim macAsOf">3년 흐름 · 환율 ' + (macSer("krw") ? macD(macSer("krw").t[macSer("krw").t.length - 1], true) : "-") + ' 기준 · 출처 한국은행 ECOS · 미국 FRED</div>';
  if (!MAC.px.ks) { h += '<div class="dvEmpty sm">과거 주가를 불러오는 중…</div>'; box.innerHTML = h; macPxLoad().then(renderMacro); return; }
  var R = macroCompute(), sel = macRes(MAC.cond || (R.filter(function (r) { return r.now.on && r.st.ks[2].n >= 2; })[0] || R[0]).c.id);
  MAC.cond = sel.c.id;
  h += '<div class="mkStep"><b>1</b>조건 고르기 <small class="briefDim">● = 지금 해당</small></div><div class="pills macConds">' + R.map(function (r) { return '<button data-macc="' + r.c.id + '" class="' + (r.c.id === sel.c.id ? "active" : "") + '">' + (r.now.on ? '<i class="macOn">●</i>' : '') + macEsc(r.c.short) + '<small>' + r.ev.length + '번</small></button>'; }).join("") + '</div>';
  h += macDetail(sel);
  h += '<div class="mkStep"><b>3</b>조건별 한눈에 <small class="briefDim">사례가 나온 다음 거래일에 샀다면 1년 뒤 · 중앙값 (오른 횟수)</small></div>' + macOverview(R);
  h += '<details class="howto"><summary>읽는 법 · 한계</summary><div class="body"><ul><li><b>사례</b> — 조건이 처음 참이 된 날만 셌어요. 한 번 넘은 뒤 그 근처에서 오르내린 날은 같은 사례로 봤어요(조건마다 120~365일 간격).</li><li><b>계산</b> — 사례가 나온 <b>다음 거래일 종가</b>에 샀다고 보고 3개월·6개월·1년 뒤 종가와 비교했어요. 미 M2는 발표가 늦어 45일 뒤에 안 것으로 쳤어요.</li><li><b>평소</b> — 아무 날이나 샀을 때(5일 간격 전체)의 같은 기간 중앙값이에요. 조건 결과가 평소와 비슷하면 그 조건은 별 정보가 없었다는 뜻이에요.</li><li><b>S&P500 (원화)</b> — 달러 가격 × 그날 환율. 환율이 오른 뒤 미국 주식을 샀다면 환율이 다시 내리면서 깎인 몫까지 들어 있어요.</li><li>사례가 몇 번뿐이라 한두 번만 달라도 숫자가 크게 바뀌어요. 과거 결과이며 예측이 아니에요. 주가는 앱에 저장된 기간(최대 약 25년)만 계산돼요.</li></ul></div></details>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-macc]"), function (b) { b.onclick = function () { MAC.cond = b.getAttribute("data-macc"); macSave(); renderMacro(); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-maca]"), function (b) { b.onclick = function () { MAC.asset = b.getAttribute("data-maca"); macSave(); renderMacro(); }; });
}
function macCell(v, wait) { return typeof v === "number" ? '<td class="' + (v > 0 ? "pos" : v < 0 ? "neg" : "") + '">' + macPct(v, 0) + '</td>' : '<td class="briefDim">' + (v === "wait" ? "진행 중" : "-") + '</td>'; }
function macDetail(r) {
  var c = r.c, a = MAC.asset, an = MAC_ASSETS.filter(function (x) { return x[0] === a; })[0][1], st = r.st[a], y1 = st[2], base = macBase(a, 365);
  var h = '<div class="macSel"><div class="macSelH"><b>' + c.icon + ' ' + macEsc(c.tag) + '</b>' + (r.now.on ? '<span class="dsTag ipo-now">지금 해당</span>' : '') + '</div><div class="macSelM">' + macEsc(c.mean) + '</div><div class="macSelN">' + macEsc(r.now.txt) + '</div></div>';
  h += '<div class="mkStep"><b>2</b>그 뒤 어떻게 됐나 <small class="briefDim">' + (r.from ? macD(r.from) + "부터 " : "") + r.ev.length + '번</small></div><div class="pills dvPills macAssets">' + MAC_ASSETS.map(function (x) { return '<button data-maca="' + x[0] + '" class="' + (x[0] === a ? "active" : "") + '">' + x[1] + '</button>'; }).join("") + '</div>';
  if (!r.ev.length) return h + '<div class="dvEmpty sm">이 기간에 해당하는 사례가 없어요.</div>';
  h += '<div class="kpiStrip">' + MAC_H.map(function (hh, i) { var s = st[i]; return '<div class="kpi"><div class="kl">' + hh[1] + ' 뒤 중앙값</div><div class="kv ' + (s.med > 0 ? "pos" : s.med < 0 ? "neg" : "") + '">' + macPct(s.med, 0) + '</div><div class="kl" style="margin-top:2px">' + (s.n ? s.n + "번 중 " + s.win + "번 상승" : "표본 없음") + '</div></div>'; }).join("") +
    '<div class="kpi"><div class="kl">평소 1년 뒤</div><div class="kv">' + macPct(base && base.med, 0) + '</div><div class="kl" style="margin-top:2px">' + (base ? "아무 날 · 상승 " + Math.round(base.win * 100) + "%" : "-") + '</div></div></div>';
  h += '<div class="tableWrap"><table class="dvTable macT"><thead><tr><th class="l">사례</th><th>그때 값</th>' + MAC_H.map(function (x) { return "<th>" + x[1] + "</th>"; }).join("") + '</tr></thead><tbody>' + r.ev.slice().reverse().map(function (e) {
    var val = c.type === "turn" ? macFmt(c.s, e.prev) + "→" + macFmt(c.s, e.v) : c.type === "chg" ? macPct(e.chg) + " · " + macFmt("krw", e.v) : c.type === "yoy" ? macPct(e.v) : macFmt(c.s, e.v);
    return '<tr><td class="l"><span class="dsD">' + macD(e.t, true) + '</span></td><td>' + val + '</td>' + e.f[a].map(function (v) { return macCell(v); }).join("") + '</tr>';
  }).join("") + '</tbody></table></div>';
  h += '<p class="mentalNote"><b>한 줄</b> ' + macEsc(macLine(r, a)) + '</p>';
  return h;
}
function macLine(r, a) {
  var s = r.st[a || "ks"][2], b = macBase(a || "ks", 365), an = { ks: "코스피", sp: "S&P500(달러)", spk: "S&P500(원화)", fx: "환율" }[a || "ks"];
  if (!s.n) return r.c.tag + " 뒤 1년이 지난 사례가 아직 없어요.";
  return r.c.tag + " " + s.n + "번 중 1년 뒤 " + an + (a === "fx" ? "이 오른(원화 약세) 건 " : "가 오른 건 ") + s.win + "번, 중앙값 " + macPct(s.med, 0) + (b ? " (평소 " + macPct(b.med, 0) + ")" : "") + ". " + (s.n < 5 ? "사례가 적어 참고만 해 주세요." : s.min != null ? "가장 나빴던 때 " + macPct(s.min, 0) + ", 가장 좋았던 때 " + macPct(s.max, 0) + "." : "");
}
function macOverview(R) {
  var bk = macBase("ks", 365), bs = macBase("spk", 365);
  return '<div class="tableWrap"><table class="dvTable macT"><thead><tr><th class="l">조건</th><th>사례</th><th>코스피 1년</th><th>S&P500(원화) 1년</th><th>지금</th></tr></thead><tbody>' +
    '<tr class="macBaseRow"><td class="l">평소 (아무 날)</td><td>-</td><td>' + macPct(bk && bk.med, 0) + (bk ? ' <small>' + Math.round(bk.win * 100) + '%</small>' : '') + '</td><td>' + macPct(bs && bs.med, 0) + (bs ? ' <small>' + Math.round(bs.win * 100) + '%</small>' : '') + '</td><td></td></tr>' +
    R.map(function (r) { var a = r.st.ks[2], b = r.st.spk[2]; function c(s) { return s.n ? '<td class="' + (s.med > 0 ? "pos" : "neg") + '">' + macPct(s.med, 0) + ' <small>' + s.win + '/' + s.n + '</small></td>' : '<td class="briefDim">-</td>'; }
      return '<tr><td class="l"><button class="linkBtn" data-macc="' + r.c.id + '">' + macEsc(r.c.tag) + '</button></td><td>' + r.ev.length + '번</td>' + c(a) + c(b) + '<td>' + (r.now.on ? '<span class="dsTag ipo-now">해당</span>' : '') + '</td></tr>'; }).join("") + '</tbody></table></div>';
}

/* ---------- 운영자: 지금 수집 ---------- */
function macroRunCollect() {
  var tok = ""; try { tok = (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) {}
  var msg = document.querySelector("#wp-macro .dsRunMsg"), btn = document.querySelector("#wp-macro [data-macro-run]"), t0 = Date.now();
  function say(t, errs) { if (msg) msg.innerHTML = macEsc(t) + (errs && errs.length ? '<details class="dsErr" open><summary>오류 ' + errs.length + '건</summary><ul>' + errs.map(function (x) { return "<li>" + macEsc(x) + "</li>"; }).join("") + '</ul></details>' : ''); }
  if (!tok) { say("운영자 토큰이 없어요."); return; }
  if (btn) btn.disabled = true; say("매크로 지표 받는 중… (처음엔 1995년부터라 20~40초)");
  fetch("/api/channel?op=disc&run=1&part=macro&force=1", { headers: { "x-owner": tok }, cache: "no-store" }).then(function (r) { return r.json().catch(function () { return { ok: false, reason: "HTTP_" + r.status }; }); }).then(function (j) {
    var d = j.macro || {}, got = d.got || {}, errs = (d.errors || []).slice(); if (!j.ok) errs.push(j.reason || "실패"); if (d.error) errs.push(d.error);
    say("완료 · " + Object.keys(got).map(function (k) { return k + " " + got[k] + "줄"; }).join(" · ") + " · " + Math.round((Date.now() - t0) / 1000) + "초", errs);
    MAC.doc = null; MAC.res = null; ["ks", "sp", "spk", "fx"].forEach(function (k) { delete MAC["_a" + k]; }); Object.keys(MAC).forEach(function (k) { if (/^_b/.test(k)) delete MAC[k]; });
    return macroEnsure(true).then(renderMacro);
  }).catch(function (e) { say("요청 실패: " + (e && e.message || e)); }).then(function () { if (btn) btn.disabled = false; });
}
document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-macro-run]"); if (b && !(typeof isOwner === "function" && !isOwner())) macroRunCollect(); });

/* ============================================================ 카드 (운영자) — 연구노트(HISTORY) 틀 ============================================================ */
function macAssetName(k) { return { ks: "코스피", sp: "S&P500(달러)", spk: "S&P500(원화)", fx: "원/달러 환율" }[k]; }
function macDeck(id) {
  if (id === "all") return macDeckAll();
  var r = macRes(id), c = r.c, out = [], st = r.st.ks, y1 = st[2], bk = macBase("ks", 365), total = 7, pg = 0, n = 0, cv;
  var first = r.from ? new Date(r.from).getUTCFullYear() : 1995;
  // 표지
  pg++; out.push({ name: "표지", cv: nbCover(r.now.on ? "지금 매크로가 보내는 신호" : "환율·금리가 이럴 때", ["[[" + c.short + "]]" + (c.type === "lv" || c.type === "chg" ? "을 넘으면" : "이 오면"), "1년 뒤 코스피는?"], first + "년 이후 " + c.tag + " " + r.ev.length + "번. 그때마다 코스피·미국 주식·환율이 어떻게 됐는지 실제 숫자로 세어 봤어요.", cDate(Date.now()) + " 기준 · 한국은행 ECOS · 미국 FRED · 야후 종가 · 투자 권유 아님") });
  // 관찰 01 지금 숫자
  cv = nbNew(); pg++; n++;
  var K = macKpis(), pick = /us10y|fed|m2/.test(c.s) ? ["us10y", "fed", "m2y"] : c.s === "gap" ? ["fed", "bok", "krw"] : ["krw", "bok", "fed"], tiles = pick.map(function (k) { return K.filter(function (x) { return x.id === k; })[0]; }).filter(Boolean);
  nbTop(cv, n, ["지금 [[" + (r.now.big || "-") + "]]", r.now.on ? "조건에 [[해당]]한다." : "아직 조건 밖이지만, 미리 알아 둔다.", "", c.type === "turn" ? r.now.txt.replace(/^지금 [^·]+· /, "") : c.mean.split(" — ")[0] + "."], pg, total);
  nbBody(cv, "지금 매크로 숫자", cDate(Date.now()) + " 기준 · 한국은행 ECOS · 미국 FRED");
  nbTiles(cv, tiles.map(function (k) { return { v: k.v, l: k.l, color: NB_C.navy }; }));
  nbGoldLine(cv, "기준: " + c.tag, tiles.map(function (k) { return k.l.replace(/\(.*\)/, "") + " " + k.sub; }).join(" · "));
  nbFoot(cv, "한국은행 ECOS · 미국 FRED · 과거 자료이며 투자 권유 아님"); out.push({ name: "지금숫자", cv: cv.cv });
  // 관찰 02 과거 사례
  cv = nbNew(); pg++; n++;
  var last = r.ev[r.ev.length - 1];
  nbTop(cv, n, [first + "년 이후 [[" + r.ev.length + "번]].", last ? "마지막은 " + macD(last.t) + "." : "", "", y1.n ? "그 뒤 1년 코스피는 " + y1.n + "번 중 [[" + y1.win + "번]] 올랐다." : "1년이 지난 사례는 아직 없다."], pg, total);
  nbBody(cv, c.tag + " — 그날과 1년 뒤", "조건이 처음 나온 날 · 그때 값 → 다음 거래일에 샀다면 1년 뒤 코스피");
  nbRows(cv, r.ev.slice(-8).reverse().map(function (e) { var v = e.f.ks[2], val = c.type === "turn" ? macFmt(c.s, e.prev) + " → " + macFmt(c.s, e.v) : c.type === "chg" ? "한 달 " + macPct(e.chg) : c.type === "yoy" ? "전년比 " + macPct(e.v) : macFmt(c.s, e.v); return [macD(e.t, true), val, typeof v === "number" ? cPct(v, 0) : v === "wait" ? "진행 중" : "-", typeof v === "number" ? (v >= 0 ? NB_C.up : NB_C.down) : NB_C.sub]; }), 250);
  nbFoot(cv); out.push({ name: "과거사례", cv: cv.cv });
  // 관찰 03 기간별 (코스피)
  cv = nbNew(); pg++; n++;
  nbTop(cv, n, ["코스피 1년 뒤 중앙값 [[" + cPct(y1.med, 0) + "]]", "아무 날이나 샀을 때는 " + cPct(bk && bk.med, 0) + ".", "", y1.med != null && bk ? (y1.med > bk.med + 0.03 ? "평소보다 좋았던 쪽이다." : y1.med < bk.med - 0.03 ? "평소보다 나빴던 쪽이다." : "평소와 큰 차이가 없었다.") : ""], pg, total);
  nbBody(cv, "기간별로 보면 — 코스피", "중앙값 · 괄호 = 오른 횟수/1년이 지난 사례 · 마지막 막대 = 평소(아무 날) 1년");
  nbBars(cv, MAC_H.map(function (h, i) { return { l: h[1] + " (" + st[i].win + "/" + st[i].n + ")", v: st[i].med, color: NB_C.navy }; }).concat(bk ? [{ l: "평소 1년", v: bk.med, color: NB_C.grey }] : []));
  nbFoot(cv); out.push({ name: "기간별", cv: cv.cv });
  // 관찰 04 자산별 1년
  cv = nbNew(); pg++; n++;
  var as = MAC_ASSETS.map(function (a) { return { k: a[0], s: r.st[a[0]][2] }; }).filter(function (x) { return x.s.n; }), best = as.filter(function (x) { return x.k !== "fx"; }).sort(function (a, b) { return b.s.med - a.s.med; })[0], fx = r.st.fx[2];
  nbTop(cv, n, ["같은 날 샀다면 1년 뒤,", best ? "가장 나았던 건 [[" + macAssetName(best.k) + " " + cPct(best.s.med, 0) + "]]" : "", "", fx.n ? "환율은 1년 뒤 중앙값 " + cPct(fx.med, 0) + (fx.med < 0 ? " — 대체로 다시 내려왔다." : " — 더 오른 쪽이 많았다.") : ""], pg, total);
  nbBody(cv, "자산별 1년 뒤 — 중앙값", "S&P500(원화) = 달러 수익 × 환율 변화 · 환율 막대가 +면 원화가 더 약해진 것");
  nbBars(cv, as.map(function (x, i) { return { l: macAssetName(x.k).replace("원/달러 ", ""), v: x.s.med, color: x.k === "fx" ? NB_C.gold2 : x.s.med >= 0 ? NB_C.up : NB_C.down }; }));
  nbFoot(cv); out.push({ name: "자산별", cv: cv.cv });
  // 관찰 05 조건표
  cv = nbNew(); pg++; n++; macTableCard(cv, n, pg, total); out.push({ name: "조건표", cv: cv.cv });
  // 관찰 06 읽는 법
  cv = nbNew(); pg++; n++;
  nbTop(cv, n, ["숫자보다 먼저", "[[표본 수]]를 본다.", "", c.tag + " 사례는 " + r.ev.length + "번뿐이다."], pg, total);
  nbBody(cv, "이 덱을 읽는 법", "조건 매매 규칙이 아니라 '그때 이랬다'는 기록이에요");
  nbTable(cv, [["사례", "조건이 처음 나온 날만 셌다 · 근처에서 오르내린 날은 같은 사례", "기준"], ["계산", "다음 거래일 종가에 샀다고 보고 3·6·12개월 뒤와 비교", "종가"], ["평소", "아무 날이나 샀을 때의 같은 기간 중앙값과 나란히", "비교"], ["원화", "S&P500(원화) = 달러 가격 × 그날 환율", "환율"], ["한계", "사례 몇 번만 달라도 숫자가 바뀐다 · 예측이 아니다", "주의"]]);
  nbFoot(cv); out.push({ name: "읽는법", cv: cv.cv });
  pg++; out.push({ name: "마무리", cv: nbClose(c.short + (c.type === "turn" || c.type === "gap" ? ", " : " 넘으면, ") + "여러분은 사는 쪽인가요 기다리는 쪽인가요?", ["저장해 두고, 다음에 조건이", "다시 나올 때 꺼내 보세요."]) });
  return out;
}
function macTableCard(cv, n, pg, total) {
  var R = macroCompute().filter(function (r) { return r.st.ks[2].n >= 2; }).sort(function (a, b) { return b.st.ks[2].med - a.st.ks[2].med; }), bk = macBase("ks", 365), top = R[0], low = R[R.length - 1];
  nbTop(cv, n, ["환율·금리 조건 " + R.length + "개 중", top ? "코스피 1년 뒤가 가장 좋았던 건 [[" + top.c.short + "]]" : "", "", low ? "가장 나빴던 건 " + low.c.short + " " + cPct(low.st.ks[2].med, 0) + "." : ""], pg, total);
  nbBody(cv, "조건별 코스피 1년 뒤 — 중앙값", "왼쪽 = 사례 수 · 오른 횟수 · 평소(아무 날) " + cPct(bk && bk.med, 0));
  nbRows(cv, R.slice(0, 9).map(function (r) { var s = r.st.ks[2]; return [s.n + "번 중 " + s.win + "번 ↑" + (r.now.on ? " · 지금" : ""), r.c.tag, cPct(s.med, 0), s.med >= 0 ? NB_C.up : NB_C.down]; }), 250);
  nbFoot(cv);
}
function macDeckAll() {
  var out = [], R = macroCompute(), on = R.filter(function (r) { return r.now.on; }), cv;
  out.push({ name: "표지", cv: nbCover("환율·금리 조건표", ["환율·금리가 [[이럴 때]]", "1년 뒤 코스피는?"], R.length + "가지 조건을 1995년 이후 실제 숫자로 세어 봤어요." + (on.length ? " 지금 해당하는 건 " + on.map(function (r) { return r.c.short; }).join(" · ") + "." : ""), cDate(Date.now()) + " 기준 · 한국은행 ECOS · 미국 FRED · 야후 종가 · 투자 권유 아님") });
  cv = nbNew(); macTableCard(cv, 1, 2, 3); out.push({ name: "조건표", cv: cv.cv });
  out.push({ name: "마무리", cv: nbClose("이 중에 지금 가장 신경 쓰이는 조건은 뭔가요?", ["저장해 두고, 조건이", "바뀔 때 다시 꺼내 보세요."]) });
  return out;
}
function macDeckList() {
  if (!MAC.doc || MAC.doc.none) return [];
  var R = MAC.px.ks ? macroCompute() : MAC_COND.map(function (c) { return { c: c, ev: [], now: {} }; });
  return [{ id: "all", t: "📊 환율·금리 조건표 한 장", d: "조건 " + MAC_COND.length + "개 × 코스피 1년 뒤 중앙값 · 지금 해당 표시", now: false }].concat(R.map(function (r) { return { id: r.c.id, t: r.c.icon + " " + r.c.tag + " → 1년 뒤", d: (r.ev.length ? "과거 " + r.ev.length + "번 · " : "") + "지금 숫자 · 사례 · 기간별 · 자산별 · 조건표 · 읽는 법", now: !!r.now.on }; }));
}
function macroDeckOpen(id) {
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return macroEnsure(); }).then(macPxLoad).then(function () {
    if (!macReady()) { alert("매크로 지표나 코스피 과거 주가가 아직 없어요. 매크로 탭에서 '지금 수집'을 먼저 눌러 주세요."); return null; }
    CARD_TXT = ""; try { macDeck(id); } catch (e) { console.warn(e); }
    if (!document.fonts || !document.fonts.load) return true;
    var txt = CARD_TXT.replace(/\s+/g, ""); return Promise.all([500, 600, 700, 800, 900].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })).then(function () { return true; });
  }).then(function (go) {
    if (!go) return;
    var list = macDeck(id), r = id === "all" ? null : macRes(id), day = typeof pubToday === "function" ? pubToday().replace(/-/g, "") : "", box = document.createElement("div"), slug = r ? r.c.short.replace(/[^가-힣A-Za-z0-9.]/g, "") : "조건표";
    box.innerHTML = '<div class="briefDim" style="margin-bottom:8px">위 검정 = 결론 먼저, 아래 밝은 패널 = 근거. "과거엔 이랬다 · 지금 위치"까지만 담고 예측 문장은 넣지 않았어요.</div><div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button></div>' + (typeof thrPanelHtml === "function" ? thrPanelHtml("재테크") : "") + '<div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    list.forEach(function (it, i) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_매크로_" + slug + "_" + day + "_" + (i + 1) + "_" + it.name + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + ". " + it.name + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
    box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
    if (typeof thrBind === "function") try { thrBind(box, thrMacro(id, list.map(function (x) { return x.name; }))); } catch (e) { console.warn(e); }
    infoModal.open("📓 매크로 · " + (r ? r.c.tag : "조건표") + " · " + list.length + "장", box);
  });
}
/* 오늘 올릴 카드: 지금 새로 해당한 조건(최근 사례 30일 안)이 있을 때 */
function macroPlanHints() {
  if (!MAC.doc || MAC.doc.none || !MAC.px.ks) return [];
  var R = macroCompute().filter(function (r) { var l = r.ev[r.ev.length - 1]; return r.now.on && l && Date.now() - l.t < 30 * MAC_DAY; });
  return R.slice(0, 2).map(function (r) { return { id: "macro:" + r.c.id, pick: r.c.id, t: r.c.icon + " 매크로 — " + r.c.tag + " (지금 해당)", d: "조건이 새로 나온 직후가 '그 뒤 1년 어땠나'가 가장 많이 읽히는 때", kind: "macro" }; });
}

/* ---------- 업로드 글 (v11.0 스레드 공식) ---------- */
function thrMacro(id, names) {
  if (typeof thrCompose !== "function") return [];
  var out = [], R = macroCompute(), bk = macBase("ks", 365);
  function add(label, hook, base) { var c = thrCompose(Object.assign({}, base, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  var common = { cardList: (names || []).map(function (n, i) { return (i + 1) + " " + n; }), tags: ["우상향연구소", "환율", "금리", "코스피", "재테크"], foot: "한국은행 ECOS · 미국 FRED · 야후 종가 · 과거 자료이며 투자 권유 아님", thFoot: "ECOS·FRED·종가 · 투자 권유 아님", sort: false };
  if (id === "all") {
    var T = R.filter(function (r) { return r.st.ks[2].n >= 2; }).sort(function (a, b) { return b.st.ks[2].med - a.st.ks[2].med; }), data = T.slice(0, 6).map(function (r) { var s = r.st.ks[2]; return r.c.short + " → 코스피 1년 " + cPct(s.med, 0) + " (" + s.win + "/" + s.n + ")"; });
    var base = Object.assign({}, common, { summary: data, data: data, insights: [bk ? "아무 날이나 샀을 때 코스피 1년 뒤 중앙값은 " + cPct(bk.med, 0) + "이었어요." : ""].filter(Boolean), question: "환율·금리 중 어떤 숫자를 제일 먼저 보시나요?", limit: ["한계도 적어둘게요.", "조건마다 사례가 몇 번뿐이에요. 한두 번만 달라도 순위가 바뀝니다.", "조건이 겹친 시기(예: 환율 급등과 금리 인상)도 따로 떼지 않았어요."], reply: "이 표에서 제일 의외였던 조건은요?" });
    add("초보 질문형", "환율이 오르면, 금리가 내리면\n1년 뒤 코스피는 어땠을까요?", Object.assign({}, base, { ask: R.length + "가지 조건을 실제 숫자로 세어 봤어요." }));
    if (T.length) add("숫자 한 방형", cPct(T[0].st.ks[2].med, 0) + ".\n" + T[0].c.tag + " 뒤 1년, 코스피 중앙값이에요.", Object.assign({}, base, { ask: "가장 나빴던 조건은 뭐였을까요?" }));
    return thrSafe(out);
  }
  var r = macRes(id), c = r.c, s = r.st.ks[2], fx = r.st.fx[2], spk = r.st.spk[2];
  var rows = r.ev.slice(-5).reverse().map(function (e) { var v = e.f.ks[2]; return macD(e.t) + " " + (c.type === "turn" ? (c.dir > 0 ? "인상" : "인하") + " " + macFmt(c.s, e.v) : c.type === "chg" ? "한 달 " + macPct(e.chg, 0) : c.type === "yoy" ? "전년比 " + macPct(e.v, 0) : macFmt(c.s, e.v)) + " → 코스피 1년 " + (typeof v === "number" ? cPct(v, 0) : v === "wait" ? "진행 중" : "-"); });
  var base2 = Object.assign({}, common, { summary: rows, data: rows, insights: [s.n ? s.n + "번 중 " + s.win + "번 올랐고, 중앙값은 " + cPct(s.med, 0) + (bk ? "(아무 날이나 샀을 때 " + cPct(bk.med, 0) + ")" : "") + "이었어요." : "", spk.n ? "같은 날 미국 주식(원화 기준)은 1년 뒤 중앙값 " + cPct(spk.med, 0) + "." : "", fx.n && c.s === "krw" ? "환율은 1년 뒤 중앙값 " + cPct(fx.med, 0) + " — " + (fx.med < 0 ? "대체로 다시 내려왔어요." : "더 오른 쪽이 많았어요.") : ""].filter(Boolean),
    question: c.short + " 뉴스가 나오면 어떻게 하시나요?", limit: ["한계도 적어둘게요.", "사례가 " + r.ev.length + "번뿐이라 한두 번만 달라도 결과가 바뀝니다.", "그때마다 배경(위기·경기·물가)이 달랐어요. 같은 숫자라도 이유가 다르면 결과도 달랐습니다."], reply: "다음에 이 조건이 오면 사시겠어요, 기다리시겠어요?" });
  add("초보 질문형", c.short + (c.type === "lv" || c.type === "chg" ? " 넘으면" : " 오면") + ",\n1년 뒤 코스피는 어땠을까요?", Object.assign({}, base2, { ask: (r.from ? new Date(r.from).getUTCFullYear() + "년 이후 " : "") + r.ev.length + "번을 실제 숫자로 세어 봤어요." }));
  if (s.n) add("숫자 한 방형", s.win + " / " + s.n + ".\n" + c.tag + " 뒤 1년, 코스피가 오른 횟수예요.", Object.assign({}, base2, { ask: "중앙값은 평소와 비교하면 어땠을까요?" }));
  add("반전형", c.short + ", 무조건 나쁜 신호일까요?\n과거 " + r.ev.length + "번은 이랬어요.", Object.assign({}, base2, { ask: "그날 샀다면 1년 뒤 숫자예요." }));
  return thrSafe(out);
}
