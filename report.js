/* ============================================================
   리포트 (v11.7) — 운영자 전용 '인사이트' 페이지
   데이터를 보여주는 게 아니라 결론을 말한다: "어떤 상황인가 → 과거엔 어땠나 → 그래서 어떻게 보나(의견) → 앞으로(시나리오) → 무엇을 보면 생각을 바꿀까"
   참고한 틀: 증권사 리서치 노트(Exhibit 01…N → Conclusion) · 스레드 연재(1. 2. 3. … 번호 글)
   ① 질문 고르기: 종목 / 시장 / 매크로 / 시점 (오늘 데이터로 질문 후보를 자동 제안)
   ② 증거(Exhibit): 앱 데이터로 계산 — 낙폭·과거 비교·회복 기간·조건부 1년 뒤·밸류에이션·계절성·매크로
   ③ 해석 · 의견 · 시나리오(과거 빈도 기반 확률) · 바꿀 조건 · 행동안 — 규칙 문장 (AI 켜면 AI가 다시 씀, 숫자는 그대로)
   ④ 카드 덱(Exhibit 카드) · 스레드 연재 글 · 저장
   ⑤ 회상·검증: 저장한 리포트를 다시 열면 '그때 우리는 이렇게 봤다 → 실제로는' 자동 채점
   저장: localStorage sm.reports (운영자 브라우저)
   원칙: 이 페이지는 의견을 말한다. 다만 모든 숫자는 계산값이고, 의견·시나리오는 '과거 빈도'를 근거로 쓰며 그렇게 표시한다.
   ============================================================ */
var RP = { tab: "today", q: null, cur: null, loading: false, hist: {}, fund: {}, ai: null, saved: [], today: null };
(function () { try { RP.saved = JSON.parse(localStorage.getItem("sm.reports") || "[]"); } catch (e) { RP.saved = []; } })();
function rpSave() { try { localStorage.setItem("sm.reports", JSON.stringify(RP.saved.slice(0, 200))); } catch (e) {} }
var RP_DAY = 86400e3;
function rpEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s); }
function rpPct(x, d) { return x == null || !isFinite(x) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function rpNum(v, d) { return v == null || !isFinite(v) ? "-" : (+v).toLocaleString("ko-KR", { maximumFractionDigits: d == null ? 0 : d }); }
function rpMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function rpAvg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
function rpD(t) { var d = new Date(t + 9 * 3600e3); return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCDate(); }
function rpYm(t) { var d = new Date(t + 9 * 3600e3); return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1); }
function rpIdx(rows, t) { var lo = 0, hi = rows.length; while (lo < hi) { var m = (lo + hi) >> 1; if (rows[m].t < t) lo = m + 1; else hi = m; } return lo; }
function rpName(sym) { if (typeof BRIEF_KO !== "undefined" && BRIEF_KO[sym]) return String(BRIEF_KO[sym]).replace(/\s*\(.*?\)\s*/g, "").trim(); if (typeof nbName === "function") return nbName(sym); return sym; }
function rpIsKrw(sym) { return /\.(KS|KQ)$/.test(sym) || /^\^K/.test(sym); }
function rpPrice(sym, v) { return v == null ? "-" : rpIsKrw(sym) ? Math.round(v).toLocaleString("ko-KR") + "원" : /^\^/.test(sym) ? v.toFixed(0) : "$" + v.toFixed(2); }
function rpMonths(d) { return d == null ? "-" : d < 45 ? d + "일" : d < 700 ? (d / 30.4).toFixed(1).replace(/\.0$/, "") + "개월" : (d / 365.25).toFixed(1) + "년"; }
function rpRows(sym) { return (RP.hist[sym] || []).filter(function (r) { return r && r.c > 0; }); }
function rpLoad(syms) {
  return Promise.all(syms.map(function (s) { if (RP.hist[s]) return null; return getChartData(s, "max").then(function (p) { RP.hist[s] = (p && p.rows) || []; }).catch(function () { RP.hist[s] = []; }); }));
}
function rpFund(sym) {
  if (RP.fund[sym]) return Promise.resolve(RP.fund[sym]);
  if (/^\^|-USD$|=X$/.test(sym)) return Promise.resolve(null);
  return fetch("/api/fund?symbol=" + encodeURIComponent(sym)).then(function (r) { return r.json(); }).then(function (d) { RP.fund[sym] = d && d.ok ? d : null; return RP.fund[sym]; }).catch(function () { return null; });
}
function rpV(o, k) { if (!o) return null; var v = o[k]; if (v && typeof v === "object") v = v.value; return typeof kNum === "function" ? kNum(v) : parseFloat(String(v).replace(/,/g, "")); }

/* ============================================================ 계산 모듈 ============================================================ */
/* 낙폭 사례: -th 이상 빠진 구간들 (고점·저점·회복) */
function rpEpisodes(rows, th) {
  var eps = [], pk = 0, tr = 0, dd = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i].c >= rows[pk].c) { if (dd <= -th) eps.push({ pk: pk, tr: tr, rc: i, dd: dd }); pk = i; tr = i; dd = 0; }
    else { var cur = rows[i].c / rows[pk].c - 1; if (cur < dd) { dd = cur; tr = i; } }
  }
  if (dd <= -th) eps.push({ pk: pk, tr: tr, rc: null, dd: dd });
  return eps.map(function (e) { return { peakT: rows[e.pk].t, troughT: rows[e.tr].t, recT: e.rc != null ? rows[e.rc].t : null, dd: e.dd, fallDays: Math.round((rows[e.tr].t - rows[e.pk].t) / RP_DAY), recDays: e.rc != null ? Math.round((rows[e.rc].t - rows[e.tr].t) / RP_DAY) : null, totalDays: e.rc != null ? Math.round((rows[e.rc].t - rows[e.pk].t) / RP_DAY) : null, open: e.rc == null }; });
}
/* 연도별 최대 낙폭 (그해 안에서 고점→저점) */
function rpYearMdd(rows) {
  var by = {}; rows.forEach(function (r) { var y = new Date(r.t + 9 * 3600e3).getUTCFullYear(); (by[y] = by[y] || []).push(r); });
  return Object.keys(by).map(Number).sort().map(function (y) { var L = by[y], pk = -Infinity, m = 0; L.forEach(function (r) { if (r.c > pk) pk = r.c; var d = r.c / pk - 1; if (d < m) m = d; }); return { y: y, mdd: m, n: L.length }; }).filter(function (x) { return x.n > 100; });
}
/* 지금과 비슷한 낙폭(현재의 80% 이상)에 처음 닿은 날 → 3·6·12개월 뒤 */
function rpSimilar(rows, curDd) {
  var th = Math.min(-0.1, curDd * 0.8), out = [], pk = 0, dd = 0, armed = true;
  for (var i = 1; i < rows.length - 1; i++) {
    if (rows[i].c >= rows[pk].c) { pk = i; dd = 0; armed = true; continue; }
    var d = rows[i].c / rows[pk].c - 1;
    if (armed && d <= th) { armed = false; var f = {}; [[63, "m3"], [126, "m6"], [252, "y1"]].forEach(function (h) { var j = i + h[0]; f[h[1]] = j < rows.length ? rows[j].c / rows[i].c - 1 : null; }); out.push({ t: rows[i].t, dd: d, f: f }); }
    if (d < dd) dd = d;
  }
  var last = rows.length - 1, cur = out.filter(function (x) { return last - rpIdx(rows, x.t) > 20 || x.f.m3 != null; });
  var y = cur.map(function (x) { return x.f.y1; }).filter(function (v) { return v != null; });
  return { list: cur, th: th, n: y.length, up: y.filter(function (v) { return v > 0; }).length, med: rpMed(y), min: y.length ? Math.min.apply(null, y) : null, max: y.length ? Math.max.apply(null, y) : null, m3: rpMed(cur.map(function (x) { return x.f.m3; }).filter(function (v) { return v != null; })), m6: rpMed(cur.map(function (x) { return x.f.m6; }).filter(function (v) { return v != null; })) };
}
/* 기술: RSI14 · 볼린저(20,2) · 이동평균 */
function rpTech(rows) {
  var n = rows.length; if (n < 60) return null; var c = rows.map(function (r) { return r.c; });
  var g = 0, l = 0; for (var i = n - 14; i < n; i++) { var d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; } var rsi = l === 0 ? 100 : 100 - 100 / (1 + (g / 14) / (l / 14));
  var s20 = c.slice(-20), ma20 = rpAvg(s20), sd = Math.sqrt(rpAvg(s20.map(function (x) { return (x - ma20) * (x - ma20); }))), lo = ma20 - 2 * sd, hi = ma20 + 2 * sd;
  var ma60 = rpAvg(c.slice(-60)), ma200 = n >= 200 ? rpAvg(c.slice(-200)) : null;
  var rs = []; for (i = Math.max(1, n - 250); i < n; i++) rs.push(Math.abs(c[i] / c[i - 1] - 1)); var vol = rpAvg(rs);
  return { rsi: rsi, ma20: ma20, ma60: ma60, ma200: ma200, bLo: lo, bHi: hi, bPos: hi > lo ? (c[n - 1] - lo) / (hi - lo) : null, last: c[n - 1], dayVol: vol, chg1: c[n - 1] / c[n - 2] - 1, chg20: c[n - 1] / c[n - 21] - 1, chg60: c[n - 1] / c[n - 61] - 1, chg250: n > 251 ? c[n - 1] / c[n - 251] - 1 : null };
}
/* 계절성: 이번 달 · 다음 달 */
function rpSeason(rows, mon) {
  var by = {}; rows.forEach(function (r) { var d = new Date(r.t + 9 * 3600e3); if (d.getUTCMonth() !== mon) return; var y = d.getUTCFullYear(); if (!by[y]) by[y] = { f: r, l: r }; by[y].l = r; });
  var out = []; Object.keys(by).map(Number).sort().forEach(function (y) { var i = rpIdx(rows, by[y].f.t) - 1; if (i < 0) return; var now = new Date(Date.now() + 9 * 3600e3); if (y === now.getUTCFullYear() && now.getUTCMonth() === mon) return; out.push({ y: y, v: by[y].l.c / rows[i].c - 1 }); });
  var v = out.map(function (x) { return x.v; }); return { n: v.length, med: rpMed(v), up: v.filter(function (x) { return x > 0; }).length, worst: out.length ? out.slice().sort(function (a, b) { return a.v - b.v; })[0] : null, best: out.length ? out.slice().sort(function (a, b) { return b.v - a.v; })[0] : null };
}
/* 고점 회복 필요 수익률 */
function rpNeed(dd) { return 1 / (1 + dd) - 1; }

/* ============================================================ 질문 유형별 리포트 ============================================================ */
/* 리포트 구조: { kind, title, sym, asOf, price, situation:[문장], exhibits:[{no, title, sub, kind, data, read, big}], scen:[{name,p,range,txt}], view:{stance, txt, plan[]}, watch:[], src, numbers:{} } */

/* ① 종목: "X, 기회인가 위기인가" */
function rpStock(sym) {
  var rows = rpRows(sym); if (rows.length < 300) return null;
  var n = rows.length, last = rows[n - 1].c, name = rpName(sym), F = RP.fund[sym], info = F && F.info || {};
  var pk = -Infinity, pkT = 0; rows.forEach(function (r) { if (r.c >= pk) { pk = r.c; pkT = r.t; } }); var cur = Math.max(-0.95, last / pk - 1), sincePk = Math.round((rows[n - 1].t - pkT) / RP_DAY);
  var y10 = rows.filter(function (r) { return r.t >= rows[n - 1].t - 10 * 365.25 * RP_DAY; });
  var ym = rpYearMdd(y10), avgMdd = rpAvg(ym.map(function (x) { return x.mdd; })), deeperYears = ym.filter(function (x) { return x.mdd <= cur; }).length;
  var eps = rpEpisodes(rows, 0.3), closed = eps.filter(function (e) { return !e.open; }), worst = eps.slice().sort(function (a, b) { return a.dd - b.dd; })[0];
  var sim = rpSimilar(rows, cur), tech = rpTech(rows), mon = new Date(Date.now() + 9 * 3600e3).getUTCMonth(), ss = rpSeason(rows, mon);
  var per = rpV(info, "per"), cper = rpV(info, "cnsPer"), eps0 = rpV(info, "eps"), ceps = rpV(info, "cnsEps"), pbr = rpV(info, "pbr"), tgt = F && F.consensus ? rpV(F.consensus, "priceTargetMean") || rpV(F.consensus, "targetPrice") : null;
  var fwdPer = ceps && ceps > 0 ? last / ceps : null;
  if (fwdPer != null && (fwdPer < 1 || fwdPer > 500)) fwdPer = null; if (per != null && (per <= 0 || per > 1000)) per = null; if (tgt != null && (tgt / last > 5 || tgt / last < 0.2)) tgt = null;   // 통화·단위가 안 맞는 값은 버린다
  var ex = [], k = 0;
  // Exhibit 1 낙폭 vs 평소
  ex.push({ no: ++k, title: name + ", 평소보다 얼마나 더 빠졌나", sub: "최근 10년 연도별 최대 낙폭 평균 vs 지금 고점 대비", kind: "bars", data: [{ l: "10년 평균 MDD", v: avgMdd, color: NB_C.grey }, { l: "지금 고점 대비", v: cur, color: NB_C.up }], big: rpPct(cur, 1), read: cur <= avgMdd * 1.5 ? "지금 낙폭은 평소 해의 " + (cur / avgMdd).toFixed(1) + "배. 평범한 조정이 아니라 큰 하락 구간이다." : cur <= avgMdd ? "평소 해보다 깊지만 1.5배 안. 흔히 오는 조정의 깊은 쪽이다." : "평소 해의 최대 낙폭보다 얕다. 아직 '많이 빠졌다'고 하긴 이르다." });
  // Exhibit 2 10년 중 몇 번
  ex.push({ no: ++k, title: "최근 10년, 이만큼 빠진 해는", sub: "연도별 최대 낙폭 · 지금보다 깊었던 해 " + deeperYears + "번", kind: "bars", data: ym.slice(-10).map(function (x) { return { l: String(x.y).slice(2) + "년", v: x.mdd, color: x.mdd <= cur ? NB_C.up : NB_C.navy, txt: rpPct(x.mdd, 0) }; }), big: deeperYears + "/" + ym.length, read: deeperYears === 0 ? "10년 중 처음 보는 깊이다. 드문 일은 기회이기도, 구조가 바뀐 신호이기도 하다." : deeperYears <= 2 ? "10년 중 " + deeperYears + "번뿐인 깊이. 역사적으로 드문 구간이다." : "10년 중 " + deeperYears + "번 있었던 깊이. 몇 년에 한 번 오는 수준이다." });
  // Exhibit 3 과매도
  if (tech) ex.push({ no: ++k, title: "과매도 신호는 들어왔나", sub: "RSI14 (30 아래 = 과매도) · 볼린저 밴드 안 위치 (0 = 하단)", kind: "tiles", data: [{ v: tech.rsi.toFixed(1), l: "RSI14", color: tech.rsi < 30 ? NB_C.up : tech.rsi > 70 ? NB_C.down : NB_C.navy }, { v: tech.bPos == null ? "-" : Math.round(tech.bPos * 100) + "%", l: "볼린저 위치(하단 0 · 상단 100)", color: NB_C.navy }, { v: rpPrice(sym, tech.bLo), l: "볼린저 하단", color: NB_C.sub }], big: tech.rsi.toFixed(0), read: tech.rsi < 30 ? "RSI " + tech.rsi.toFixed(0) + " — 매도가 강하게 몰린 상태. 단기 반등이 나오기 쉬운 자리지만, 추세 전환과는 다르다." : tech.rsi > 70 ? "RSI " + tech.rsi.toFixed(0) + " — 과열. 쫓아 사기엔 늦은 자리." : "RSI " + tech.rsi.toFixed(0) + " — 과매도도 과열도 아니다. 기술 신호만으로는 판단이 안 선다." });
  // Exhibit 4 전고점까지
  ex.push({ no: ++k, title: "전고점으로 돌아가려면", sub: "고점 " + rpPrice(sym, pk) + " (" + rpYm(pkT) + ") · 지금 " + rpPrice(sym, last), kind: "tiles", data: [{ v: rpPct(rpNeed(cur), 0), l: "필요한 상승률", color: NB_C.up }, { v: rpMonths(sincePk), l: "고점 이후 지난 시간", color: NB_C.navy }, { v: closed.length ? rpMonths(rpMed(closed.map(function (e) { return e.recDays; }))) : "-", l: "과거 -30% 뒤 저점→전고점 중앙값", color: NB_C.teal }], big: rpPct(rpNeed(cur), 0), read: "고점 회복엔 +" + Math.round(rpNeed(cur) * 100) + "%가 필요하다. " + (closed.length ? "과거 -30% 넘게 빠진 뒤 전고점을 되찾은 " + closed.length + "번은 저점에서 전고점까지 중앙값 " + rpMonths(rpMed(closed.map(function (e) { return e.recDays; }))) + "가 걸렸다." : eps.length ? "과거 -30% 넘게 빠진 " + eps.length + "번은 아직 전고점을 되찾지 못했다." : "과거에 -30% 넘게 빠진 적은 없었다.") });
  // Exhibit 5 과거 사례
  if (eps.length) ex.push({ no: ++k, title: "-30% 이상 빠졌던 과거 " + eps.length + "번", sub: "고점 → 저점 깊이 · 고점부터 회복까지 (진행 중은 '아직')", kind: "rows", data: eps.slice(-6).reverse().map(function (e) { return [rpYm(e.peakT) + " 고점", "저점 " + rpPct(e.dd, 0) + (e.open ? " · 진행 중" : ""), e.totalDays != null ? rpMonths(e.totalDays) : "아직", e.open ? NB_C.sub : NB_C.navy, "하락 " + rpMonths(e.fallDays) + (e.recDays != null ? " · 회복 " + rpMonths(e.recDays) : "")]; }), big: worst ? rpPct(worst.dd, 0) : "-", read: "최악은 " + (worst ? rpYm(worst.peakT) + " 고점 뒤 " + rpPct(worst.dd, 0) : "-") + ". " + (closed.length ? "고점부터 완전 회복까지는 중앙값 " + rpMonths(rpMed(closed.map(function (e) { return e.totalDays; }))) + ", 가장 길었던 때 " + rpMonths(Math.max.apply(null, closed.map(function (e) { return e.totalDays; }))) + "." : "아직 전고점을 되찾은 사례가 없다 — 회복을 전제로 사면 안 된다.") });
  // Exhibit 6 비슷한 낙폭에서 샀다면
  if (sim.n >= 2) ex.push({ no: ++k, title: "지금만큼 빠진 날 샀다면, 1년 뒤", sub: "고점 대비 " + rpPct(sim.th, 0) + "에 처음 닿은 날 " + sim.list.length + "번 · 3·6·12개월 뒤", kind: "bars", data: [{ l: "3개월", v: sim.m3, color: NB_C.navy }, { l: "6개월", v: sim.m6, color: NB_C.navy }, { l: "1년 (중앙값)", v: sim.med, color: NB_C.up }, { l: "1년 최악", v: sim.min, color: NB_C.down }, { l: "1년 최고", v: sim.max, color: NB_C.gold2 }], big: sim.up + "/" + sim.n, read: "1년 뒤 오른 건 " + sim.n + "번 중 " + sim.up + "번, 중앙값 " + rpPct(sim.med, 0) + ". 최악은 " + rpPct(sim.min, 0) + " — 바닥이 아닐 수도 있다는 뜻이다." });
  // Exhibit 7 밸류에이션
  if (per || fwdPer || pbr) ex.push({ no: ++k, title: "주가 배수로 보면", sub: "PER = 주가 ÷ 주당순이익 · 올해 예상 이익 기준이 핵심", kind: "tiles", data: [{ v: per ? per.toFixed(1) + "배" : "-", l: "PER (최근 실적)", color: NB_C.navy }, { v: fwdPer ? fwdPer.toFixed(1) + "배" : cper ? cper.toFixed(1) + "배" : "-", l: "PER (올해 예상)", color: NB_C.up }, { v: pbr ? pbr.toFixed(2) + "배" : "-", l: "PBR", color: NB_C.teal }], big: fwdPer ? fwdPer.toFixed(1) + "배" : per ? per.toFixed(1) + "배" : "-", read: fwdPer && per && fwdPer < per * 0.6 ? "최근 실적 기준 " + per.toFixed(1) + "배 → 올해 예상 기준 " + fwdPer.toFixed(1) + "배. 이익 전망이 유지된다면 지금 가격은 싸다. 전망이 깎이면 이 숫자는 의미가 없다." : pbr && pbr < 1 ? "PBR " + pbr.toFixed(2) + "배 — 장부가보다 싸다. 다만 싼 데는 이유가 있을 수 있다." : "배수만으로는 싸다고 말하기 어렵다. 이익 방향을 같이 봐야 한다." });
  if (tgt) ex.push({ no: ++k, title: "증권사 목표주가와의 거리", sub: "목표주가 평균(네이버 컨센서스) · 참고용 — 목표가는 자주 내려온다", kind: "tiles", data: [{ v: rpPrice(sym, tgt), l: "목표주가 평균", color: NB_C.navy }, { v: rpPrice(sym, last), l: "지금", color: NB_C.sub }, { v: rpPct(tgt / last - 1, 0), l: "차이", color: tgt > last ? NB_C.up : NB_C.down }], big: rpPct(tgt / last - 1, 0), read: tgt / last - 1 > 0.3 ? "목표가까지 " + rpPct(tgt / last - 1, 0) + ". 증권사 눈높이가 아직 안 내려왔거나, 시장이 지나치게 비관적이거나 둘 중 하나다." : "목표가와 가까워 증권사 쪽 상승 여력은 크지 않다." });
  // Exhibit 계절
  if (ss.n >= 8) ex.push({ no: ++k, title: (mon + 1) + "월은 과거에 어땠나", sub: name + " · " + ss.n + "년 · 달 수익률", kind: "tiles", data: [{ v: rpPct(ss.med, 1), l: (mon + 1) + "월 중앙값", color: ss.med >= 0 ? NB_C.up : NB_C.down }, { v: ss.up + "/" + ss.n, l: "오른 해", color: NB_C.navy }, { v: ss.worst ? ss.worst.y + "년 " + rpPct(ss.worst.v, 0) : "-", l: "최악의 " + (mon + 1) + "월", color: NB_C.sub }], big: ss.up + "/" + ss.n, read: "계절성은 참고일 뿐이다. " + (mon + 1) + "월에 오른 해가 " + ss.up + "/" + ss.n + "이라도 올해를 말해주진 않는다." });
  // 시나리오 (과거 빈도)
  var scen = [];
  if (sim.n >= 2) {
    var y1 = sim.list.map(function (x) { return x.f.y1; }).filter(function (v) { return v != null; }), nUp20 = y1.filter(function (v) { return v >= 0.2; }).length, nMid = y1.filter(function (v) { return v > -0.1 && v < 0.2; }).length, nDn = y1.filter(function (v) { return v <= -0.1; }).length;
    scen = [{ name: "회복", p: nUp20 / sim.n, range: "1년 뒤 +20% 이상", txt: "이익 전망이 유지되고 수급이 돌아오면. 과거 비슷한 낙폭 " + sim.n + "번 중 " + nUp20 + "번." }, { name: "횡보", p: nMid / sim.n, range: "-10% ~ +20%", txt: "바닥은 다졌지만 회복이 더딘 경우. " + nMid + "번." }, { name: "추가 하락", p: nDn / sim.n, range: "-10% 이하", txt: "이익이 더 깎이거나 시장 전체가 흔들리면. " + nDn + "번 — 최악 " + rpPct(sim.min, 0) + "." }];
  }
  // 의견
  var score = 0, why = [];
  if (cur <= avgMdd * 1.5) { score += 2; why.push("평소보다 깊은 낙폭(" + (cur / avgMdd).toFixed(1) + "배)"); } else if (cur <= avgMdd) { score += 1; why.push("평소 수준의 낙폭"); } else why.push("낙폭이 아직 얕음");
  if (tech && tech.rsi < 30) { score += 1; why.push("과매도(RSI " + tech.rsi.toFixed(0) + ")"); } else if (tech && tech.rsi > 70) { score -= 1; why.push("과열(RSI " + tech.rsi.toFixed(0) + ")"); }
  if (sim.n >= 3) { if (sim.up / sim.n >= 0.7) { score += 1; why.push("비슷한 낙폭 뒤 1년 상승 " + sim.up + "/" + sim.n); } else if (sim.up / sim.n < 0.5) { score -= 1; why.push("비슷한 낙폭 뒤 1년 상승이 절반 미만"); } }
  if (fwdPer && per && fwdPer < per * 0.6) { score += 1; why.push("예상 PER " + fwdPer.toFixed(1) + "배로 낮아짐"); }
  if (tech && tech.ma200 && last < tech.ma200 && tech.chg20 < 0) why.push("아직 200일선 아래 · 20일 하락 중");
  var stance = score >= 3 ? "검토 구간" : score >= 1 ? "관심 · 분할" : "관망";
  var view = { stance: stance, score: score, txt: stance === "검토 구간" ? nbJosa(name, "은/는") + " 지금 충분히 매력적인 검토 구간이다. 많이 떨어졌다고 무조건 싼 건 아니지만, 낙폭·과거 사례·배수가 같은 방향을 가리킨다. 금액을 정해 나눠서 대응하면 된다." : stance === "관심 · 분할" ? nbJosa(name, "은/는") + " 관심 종목에 올려 둘 구간이다. 일부 신호는 좋지만 확인이 더 필요하다. 사더라도 작게, 나눠서." : nbJosa(name, "은/는") + " 아직 서두를 이유가 없다. 낙폭이 얕거나 신호가 엇갈린다. 조건이 맞을 때까지 기다린다.", why: why,
    plan: stance === "관망" ? ["살 금액의 상한을 먼저 정한다(계좌의 5~10%)", "고점 대비 " + rpPct(Math.min(cur - 0.1, avgMdd * 1.5), 0) + " 또는 RSI 30 아래에서 1차", "이익 전망(예상 EPS)이 더 깎이는지 매달 확인"] : ["살 금액의 상한을 먼저 정한다(계좌의 5~10%)", "지금 1/3 · 추가 -10%에 1/3 · 20일선 회복 확인 뒤 1/3", "예상 이익이 깎이면 계획을 멈춘다 — 가격이 아니라 이익이 기준"] };
  var watch = ["올해 예상 EPS" + (ceps ? "(지금 " + rpNum(ceps) + ")" : "") + "가 내려가는가", "20일선(" + rpPrice(sym, tech && tech.ma20) + ") 위로 돌아오는가", "RSI가 30 아래에서 올라오는가", "시장 전체(지수)가 같이 빠지는가 — 종목 문제인지 시장 문제인지"];
  return { kind: "stock", id: "stock:" + sym, title: name + ", 기회인가 위기인가", sym: sym, name: name, asOf: rpD(rows[n - 1].t), price: last, situation: [name + " " + rpPrice(sym, last) + " — 고점(" + rpYm(pkT) + " " + rpPrice(sym, pk) + ") 대비 " + rpPct(cur, 1) + ".", "최근 10년 평균 최대 낙폭 " + rpPct(avgMdd, 1) + "의 " + (cur / avgMdd).toFixed(1) + "배 깊이.", tech ? "RSI " + tech.rsi.toFixed(0) + " · 20일 " + rpPct(tech.chg20, 1) + " · 1년 " + rpPct(tech.chg250, 1) : ""].filter(Boolean), exhibits: ex, scen: scen, view: view, watch: watch, src: "야후 파이낸스 종가(" + rpD(rows[n - 1].t) + ") · 네이버 증권 투자지표 · StockMind 계산", numbers: { cur: cur, avgMdd: avgMdd, rsi: tech && tech.rsi, simUp: sim.up, simN: sim.n, simMed: sim.med, simMin: sim.min, fwdPer: fwdPer, per: per, ma20: tech && tech.ma20, ma200: tech && tech.ma200 }, thr: { up: 0.2, dn: -0.1 } };
}

/* ② 시장: "지금 코스피 / S&P500 사도 되나" */
function rpMarket(sym) {
  var rows = rpRows(sym); if (rows.length < 500) return null;
  var n = rows.length, last = rows[n - 1].c, name = rpName(sym), R = typeof briefState !== "undefined" && briefState.result, tech = rpTech(rows);
  var pk = -Infinity, pkT = 0; rows.forEach(function (r) { if (r.c >= pk) { pk = r.c; pkT = r.t; } }); var cur = last / pk - 1;
  var vix = typeof nbStat === "function" ? nbStat("^VIX") : null, now = typeof nbNow === "function" ? nbNow() : { match: {}, why: [] };
  var eps = rpEpisodes(rows, 0.1), sim = rpSimilar(rows, Math.min(cur, -0.1)), mon = new Date(Date.now() + 9 * 3600e3).getUTCMonth(), ss = rpSeason(rows, mon), ym = rpYearMdd(rows.slice(-2600));
  var ex = [], k = 0, temp = R && R.temp;
  ex.push({ no: ++k, title: name + " 지금 위치", sub: "고점 대비 · 20일선 · 200일선", kind: "tiles", data: [{ v: rpPct(cur, 1), l: "고점(" + rpYm(pkT) + ") 대비", color: cur < -0.1 ? NB_C.up : NB_C.navy }, { v: tech ? rpPct(last / tech.ma20 - 1, 1) : "-", l: "20일선 대비", color: NB_C.navy }, { v: tech && tech.ma200 ? rpPct(last / tech.ma200 - 1, 1) : "-", l: "200일선 대비", color: NB_C.navy }], big: rpPct(cur, 0), read: cur > -0.03 ? "고점 근처. 시장은 강하다. 문제는 '비싸냐'가 아니라 '쫓아가도 되냐'다." : cur > -0.1 ? "고점에서 " + rpPct(cur, 0) + " — 흔한 조정 범위. 1년에 몇 번씩 오는 수준이다." : cur > -0.2 ? "조정 구간(-10% 이상). 과거엔 이 구간이 분할 매수의 시작점인 경우가 많았다." : "약세장 구간(-20% 이상). 공포가 크지만 과거 1년 뒤 수익률은 이 구간에서 가장 좋았다." });
  if (temp) ex.push({ no: ++k, title: "시장의 폭 — 오르는 종목이 얼마나 되나", sub: "오른 종목 비율 · 20일선 위 비율 · 52주 신고가/신저가", kind: "tiles", data: [{ v: Math.round(temp.upPct * 100) + "%", l: "오른 종목 비율", color: temp.upPct >= 0.5 ? NB_C.up : NB_C.down }, { v: Math.round(temp.abovePct * 100) + "%", l: "20일선 위 비율", color: temp.abovePct >= 0.5 ? NB_C.up : NB_C.down }, { v: (R.stocks || []).filter(function (s) { return s.newHigh; }).length + " : " + (R.stocks || []).filter(function (s) { return s.newLow; }).length, l: "신고가 : 신저가", color: NB_C.navy }], big: Math.round(temp.abovePct * 100) + "%", read: temp.abovePct >= 0.6 ? "종목 대부분이 20일선 위 — 상승이 넓게 퍼져 있다. 지수만 오르는 장이 아니다." : temp.abovePct <= 0.3 ? "20일선 위 종목이 " + Math.round(temp.abovePct * 100) + "%뿐 — 대부분 하락 추세. 지수가 버텨도 내 종목은 빠지는 장이다." : "절반 안팎 — 방향이 정해지지 않았다." });
  ex.push({ no: ++k, title: "공포는 어느 정도인가", sub: "VIX(공포지수) · 20 아래 평온 · 30 넘으면 공포", kind: "tiles", data: [{ v: vix ? vix.last.toFixed(1) : "-", l: "VIX", color: vix && vix.last >= 25 ? NB_C.up : NB_C.navy }, { v: tech ? (tech.dayVol * 100).toFixed(2) + "%" : "-", l: name + " 하루 평균 변동(1년)", color: NB_C.sub }, { v: tech ? rpPct(tech.chg20, 1) : "-", l: "20일 등락", color: NB_C.navy }], big: vix ? vix.last.toFixed(0) : "-", read: vix && vix.last >= 30 ? "VIX " + vix.last.toFixed(0) + " — 공포 구간. 과거엔 이 구간이 저점 근처인 경우가 많았지만, 바닥은 지나야 안다." : vix && vix.last >= 20 ? "VIX " + vix.last.toFixed(0) + " — 불안. 급락 뒤 되돌림이 자주 섞인다." : "VIX " + (vix ? vix.last.toFixed(0) : "-") + " — 평온. 평온할 때는 사건 하나에 크게 흔들릴 수 있다." });
  if (eps.length) ex.push({ no: ++k, title: "-10% 조정은 얼마나 자주, 얼마 만에 회복했나", sub: name + " · -10% 이상 하락 " + eps.length + "번 · 고점부터 회복까지", kind: "rows", data: eps.slice(-7).reverse().map(function (e) { return [rpYm(e.peakT), "저점 " + rpPct(e.dd, 0) + (e.open ? " · 진행 중" : ""), e.totalDays != null ? rpMonths(e.totalDays) : "아직", e.open ? NB_C.sub : NB_C.navy]; }), big: eps.length + "번", read: (function () { var yrs = Math.max(1, (rows[n - 1].t - rows[0].t) / (365.25 * RP_DAY)), per = eps.length / yrs, cl = eps.filter(function (e) { return !e.open; }); return "-10% 조정은 " + (per >= 1 ? "1년에 약 " + per.toFixed(1) + "번" : "약 " + (1 / per).toFixed(1) + "년에 한 번") + ". " + (cl.length ? "고점부터 회복까지 중앙값 " + rpMonths(rpMed(cl.map(function (e) { return e.totalDays; }))) + ". " : "") + "조정은 예외가 아니라 일상이다."; })() });
  if (sim.n >= 3) ex.push({ no: ++k, title: "지금 위치에서 샀다면 1년 뒤", sub: "고점 대비 " + rpPct(sim.th, 0) + "에 처음 닿은 날 " + sim.list.length + "번", kind: "bars", data: [{ l: "3개월", v: sim.m3, color: NB_C.navy }, { l: "6개월", v: sim.m6, color: NB_C.navy }, { l: "1년 중앙값", v: sim.med, color: NB_C.up }, { l: "1년 최악", v: sim.min, color: NB_C.down }], big: sim.up + "/" + sim.n, read: "1년 뒤 오른 건 " + sim.up + "/" + sim.n + ", 중앙값 " + rpPct(sim.med, 0) + ". 지수는 종목과 달리 '0'이 되지 않아 기다릴 수 있다면 확률이 유리했다." });
  if (now.why && now.why.length) ex.push({ no: ++k, title: "지금 시장 신호", sub: "장기채 · VIX · 고점 대비 · 유가 · 달러로 본 국면", kind: "rows", data: now.why.map(function (w) { var p = w.split("→"); return ["신호", (p[0] || "").trim(), (p[1] || "").trim(), NB_C.up]; }), big: now.why.length + "개", read: "국면 신호 " + now.why.length + "개. 신호가 겹칠수록 과거 사례와 비교할 가치가 커진다." });
  if (typeof macReady === "function" && macReady()) { var on = macroCompute().filter(function (r) { return r.now.on && r.st.ks[2].n >= 2; }); if (on.length) ex.push({ no: ++k, title: "지금 해당하는 매크로 조건과 그 뒤 1년", sub: "환율·금리 조건 · 과거 조건이 나온 뒤 코스피 1년 중앙값(오른 횟수)", kind: "rows", data: on.map(function (r) { var s = r.st.ks[2]; return [r.c.short, r.now.txt.replace(/^지금 /, ""), rpPct(s.med, 0) + " (" + s.win + "/" + s.n + ")", s.med >= 0 ? NB_C.up : NB_C.down]; }), big: on.length + "개", read: "조건이 맞을 때 코스피 1년 뒤는 " + on.map(function (r) { return r.c.short + " " + rpPct(r.st.ks[2].med, 0); }).join(", ") + ". 사례가 적어 방향 참고만." }); }
  if (ss.n >= 10) ex.push({ no: ++k, title: (mon + 1) + "월의 과거 성적", sub: name + " · " + ss.n + "년", kind: "tiles", data: [{ v: rpPct(ss.med, 1), l: (mon + 1) + "월 중앙값", color: ss.med >= 0 ? NB_C.up : NB_C.down }, { v: ss.up + "/" + ss.n, l: "오른 해", color: NB_C.navy }, { v: ss.worst ? ss.worst.y + " " + rpPct(ss.worst.v, 0) : "-", l: "최악의 해", color: NB_C.sub }], big: ss.up + "/" + ss.n, read: "계절성은 '사는 신호'가 아니라 '추가 매수 시점을 정하는 기준'으로만 쓴다." });
  var y1 = sim.list.map(function (x) { return x.f.y1; }).filter(function (v) { return v != null; }), nUp = y1.filter(function (v) { return v >= 0.1; }).length, nMid = y1.filter(function (v) { return v > -0.1 && v < 0.1; }).length, nDn = y1.filter(function (v) { return v <= -0.1; }).length;
  var scen = sim.n >= 3 ? [{ name: "회복·상승", p: nUp / sim.n, range: "1년 뒤 +10% 이상", txt: "조정이 끝나고 추세가 돌아오는 경우. " + nUp + "/" + sim.n + "." }, { name: "횡보", p: nMid / sim.n, range: "-10% ~ +10%", txt: "방향 없이 긴 조정. " + nMid + "/" + sim.n + "." }, { name: "추가 하락", p: nDn / sim.n, range: "-10% 이하", txt: "경기 침체·신용 사건이 겹치는 경우. " + nDn + "/" + sim.n + " — 최악 " + rpPct(sim.min, 0) + "." }] : [];
  var score = 0, why = [];
  if (cur <= -0.2) { score += 2; why.push("약세장 구간"); } else if (cur <= -0.1) { score += 1; why.push("조정 구간"); } else why.push("고점 근처");
  if (vix && vix.last >= 30) { score += 1; why.push("VIX 공포 구간"); }
  if (temp && temp.abovePct <= 0.3) { score += 1; why.push("20일선 위 종목 30% 이하(바닥권 폭)"); } else if (temp && temp.abovePct >= 0.7) { score -= 1; why.push("20일선 위 70% 이상(과열 폭)"); }
  if (sim.n >= 3 && sim.up / sim.n >= 0.7) { score += 1; why.push("비슷한 위치에서 1년 상승 " + sim.up + "/" + sim.n); }
  var stance = score >= 3 ? "분할 매수 구간" : score >= 1 ? "정액 적립 유지 · 추가는 조금" : "서두를 이유 없음";
  return { kind: "market", id: "market:" + sym, title: "지금 " + name + ", 사도 되나", sym: sym, name: name, asOf: rpD(rows[n - 1].t), price: last, situation: [name + " " + rpPrice(sym, last) + " · 고점 대비 " + rpPct(cur, 1) + " · 20일 " + rpPct(tech && tech.chg20, 1), vix ? "VIX " + vix.last.toFixed(1) + (temp ? " · 오른 종목 " + Math.round(temp.upPct * 100) + "%" : "") : "", now.why.length ? "신호: " + now.why.join(" / ") : ""].filter(Boolean), exhibits: ex, scen: scen,
    view: { stance: stance, score: score, why: why, txt: stance === "분할 매수 구간" ? "지금은 과거 통계가 가장 유리했던 구간이다. 바닥은 못 맞히지만, 지수는 사라지지 않는다. 금액을 정해 3번에 나눠 들어간다." : stance === "서두를 이유 없음" ? "고점 근처이고 폭도 과열에 가깝다. 지금 더 넣기보다 적립을 유지하고 조정을 기다린다. 못 사면 못 산 대로 괜찮다." : "조정이 시작됐지만 공포는 아직 크지 않다. 적립은 그대로, 추가 매수는 -10% 단위로 조금씩.", plan: ["적립식은 멈추지 않는다 — 이 결론과 상관없이", stance === "분할 매수 구간" ? "여유 자금을 3번에 나눠 지금·-5%·-10%에서" : "여유 자금은 고점 대비 -10% · -20%에서 나눠 넣을 계획만 세워 둔다", "레버리지·빚은 쓰지 않는다 — 조정은 길어질 수 있다"] },
    watch: ["20일선 위 종목 비율이 30% 아래로 내려가는가(투매)", "VIX 30 이상에서 꺾이는가", "고점 대비 -10% · -20% 선", "환율·금리 조건(매크로 탭)이 새로 나오는가"], src: "야후 파이낸스 종가(" + rpD(rows[n - 1].t) + ") · StockMind 계산", numbers: { cur: cur, vix: vix && vix.last, above: temp && temp.abovePct, simUp: sim.up, simN: sim.n, simMed: sim.med }, thr: { up: 0.1, dn: -0.1 } };
}

/* ③ 매크로: "환율 1,400원인데 미국 주식 사야 하나" 등 — 매크로 탭의 조건을 리포트로 */
function rpMacro(condId) {
  if (typeof macReady !== "function" || !macReady()) return null;
  var r = macRes(condId); if (!r) return null; var c = r.c, st = r.st, bk = macBase("ks", 365), bs = macBase("spk", 365), K = macKpis(), ex = [], k = 0;
  ex.push({ no: ++k, title: "지금 매크로 숫자", sub: "한국은행 ECOS · 미국 FRED", kind: "tiles", data: K.filter(function (x) { return ["krw", "bok", "fed"].indexOf(x.id) >= 0; }).map(function (x) { return { v: x.v, l: x.l + " · " + x.sub, color: NB_C.navy }; }), big: r.now.big || "", read: r.now.txt + (r.now.on ? " — 조건에 해당한다." : " — 아직 조건 밖이다.") });
  ex.push({ no: ++k, title: c.tag + " — 과거 " + r.ev.length + "번", sub: (r.from ? new Date(r.from).getUTCFullYear() + "년 이후 · " : "") + "조건이 처음 나온 날과 그 뒤 1년 코스피", kind: "rows", data: r.ev.slice(-7).reverse().map(function (e) { var v = e.f.ks[2]; return [macD(e.t, true), c.type === "turn" ? macFmt(c.s, e.prev) + " → " + macFmt(c.s, e.v) : c.type === "chg" ? "한 달 " + macPct(e.chg) : macFmt(c.s, e.v), typeof v === "number" ? rpPct(v, 0) : v === "wait" ? "진행 중" : "-", typeof v === "number" ? (v >= 0 ? NB_C.up : NB_C.down) : NB_C.sub]; }), big: st.ks[2].win + "/" + st.ks[2].n, read: "1년 뒤 코스피가 오른 건 " + st.ks[2].n + "번 중 " + st.ks[2].win + "번, 중앙값 " + rpPct(st.ks[2].med, 0) + (bk ? " (아무 날 " + rpPct(bk.med, 0) + ")" : "") + "." });
  ex.push({ no: ++k, title: "같은 날 샀다면 자산별 1년 뒤", sub: "중앙값 · S&P500(원화) = 달러 수익 × 환율", kind: "bars", data: MAC_ASSETS.map(function (a) { var s = st[a[0]][2]; return s.n ? { l: a[1].replace("원/달러 ", ""), v: s.med, color: a[0] === "fx" ? NB_C.gold2 : s.med >= 0 ? NB_C.up : NB_C.down } : null; }).filter(Boolean), big: rpPct(st.spk[2].med, 0), read: st.spk[2].n ? "미국 주식(원화)은 1년 뒤 중앙값 " + rpPct(st.spk[2].med, 0) + (bs ? " (아무 날 " + rpPct(bs.med, 0) + ")" : "") + ". 환율은 1년 뒤 " + rpPct(st.fx[2].med, 0) + " — " + (st.fx[2].med < 0 ? "대체로 다시 내려와 원화 수익을 깎았다." : "더 오른 쪽이 많았다.") : "표본이 부족하다." });
  var ks = st.ks[2], y1 = r.ev.map(function (e) { return e.f.ks[2]; }).filter(function (v) { return typeof v === "number"; }), nUp = y1.filter(function (v) { return v >= 0.1; }).length, nMid = y1.filter(function (v) { return v > -0.1 && v < 0.1; }).length, nDn = y1.filter(function (v) { return v <= -0.1; }).length;
  var scen = ks.n >= 2 ? [{ name: "코스피 회복", p: nUp / ks.n, range: "1년 뒤 +10% 이상", txt: nUp + "/" + ks.n }, { name: "횡보", p: nMid / ks.n, range: "-10% ~ +10%", txt: nMid + "/" + ks.n }, { name: "추가 하락", p: nDn / ks.n, range: "-10% 이하", txt: nDn + "/" + ks.n }] : [];
  var good = ks.n >= 3 && bk && ks.med > bk.med + 0.03, bad = ks.n >= 3 && bk && ks.med < bk.med - 0.03;
  var stance = !r.now.on ? "조건 밖 · 대기" : good ? "역발상 매수 검토" : bad ? "방어 · 미국 비중 점검" : "중립";
  return { kind: "macro", id: "macro:" + condId, title: c.tag + ", 그래서 어떻게 보나", sym: null, name: c.tag, asOf: cDate(Date.now()), price: null, situation: [r.now.txt, c.mean, "과거 " + r.ev.length + "번 · 1년 뒤 코스피 상승 " + ks.win + "/" + ks.n], exhibits: ex, scen: scen,
    view: { stance: stance, score: good ? 3 : bad ? 0 : 1, why: [ks.n ? "코스피 1년 중앙값 " + rpPct(ks.med, 0) + (bk ? " vs 평소 " + rpPct(bk.med, 0) : "") : "표본 부족", st.spk[2].n ? "미국(원화) 1년 중앙값 " + rpPct(st.spk[2].med, 0) : ""].filter(Boolean), txt: !r.now.on ? "지금은 이 조건에 해당하지 않는다. 조건이 나오면 다시 본다." : good ? c.short + " 뉴스는 무섭게 들리지만, 과거 이 조건 뒤 1년 코스피는 평소보다 좋았다. 공포 헤드라인은 역발상의 재료였다. 다만 사례가 " + ks.n + "번뿐이다." : bad ? "이 조건 뒤 1년은 평소보다 나빴다. 새로 사기보다 비중과 환율 노출을 점검할 때다." : "이 조건만으로 방향을 말하긴 어렵다. 평소와 비슷했다.", plan: c.s === "krw" ? ["미국 주식은 환율이 높을 때 몰아 사지 않는다 — 환율 1,400원 위에서는 나눠서", "원화 자산(코스피)과 달러 자산을 같이 들고 환율 변동을 서로 상쇄", "환헤지(H) 상품은 환율 영향을 줄이지만 비용이 있다"] : ["금리 방향은 몇 달 뒤에야 주가에 반영된다 — 서두르지 않는다", "장기채 ETF는 금리 인하 '시작'보다 '장기금리 하락'을 확인하고", "조건이 겹칠 때(환율+금리) 과거 사례를 다시 본다"] },
    watch: ["다음 금리 결정(한은·연준)", "환율 1,400원 · 1,300원 선", "미 10년 금리 4.5% 선", "코스피 20일선 위 종목 비율"], src: "한국은행 ECOS · 미국 FRED · 야후 종가 · StockMind 계산", numbers: { ksUp: ks.win, ksN: ks.n, ksMed: ks.med, now: r.now.v }, thr: { up: 0.1, dn: -0.1 } };
}

/* ④ 시점: "이번 달, 사야 하나 (계절성 · 최악의 날 · 적립)" */
function rpTiming() {
  var mon = new Date(Date.now() + 9 * 3600e3).getUTCMonth(), M = (mon + 1) + "월", N = ((mon + 1) % 12 + 1) + "월", sp = rpRows("SPY"), ks = rpRows("^KS11"); if (sp.length < 2000 || ks.length < 2000) return null;
  var a = rpSeason(sp, mon), b = rpSeason(ks, mon), a2 = rpSeason(sp, (mon + 1) % 12), b2 = rpSeason(ks, (mon + 1) % 12), all = [], ex = [], k = 0;
  for (var m = 0; m < 12; m++) all.push({ m: m, s: rpSeason(sp, m) });
  var rank = all.slice().sort(function (p, q) { return q.s.med - p.s.med; }).map(function (x) { return x.m; }).indexOf(mon) + 1;
  ex.push({ no: ++k, title: M + "의 과거 성적", sub: "S&P500 · 코스피 · 달 수익률 중앙값 · 오른 해", kind: "tiles", data: [{ v: rpPct(a.med, 1), l: "S&P500 " + M + " 중앙값 · 오른 해 " + a.up + "/" + a.n, color: a.med >= 0 ? NB_C.up : NB_C.down }, { v: rpPct(b.med, 1), l: "코스피 " + M + " 중앙값 · 오른 해 " + b.up + "/" + b.n, color: b.med >= 0 ? NB_C.up : NB_C.down }, { v: rank + "위/12", l: "S&P500 12개 달 중 " + M + " 순위", color: NB_C.navy }], big: rank + "위", read: rank <= 4 ? M + "은 역사적으로 좋은 달 쪽이다(12개 달 중 " + rank + "위)." : rank >= 9 ? M + "은 역사적으로 약한 달이다(" + rank + "위). 다만 '약한 달'도 오른 해가 " + a.up + "/" + a.n + "이다." : M + "은 평범한 달이다(" + rank + "위)." });
  ex.push({ no: ++k, title: "달별 S&P500 중앙값", sub: "1993년 이후 · 달마다 수익률의 가운데 값", kind: "bars", data: all.map(function (x) { return { l: (x.m + 1) + "월", v: x.s.med, color: x.m === mon ? NB_C.gold2 : x.s.med >= 0 ? NB_C.navy : NB_C.down, txt: rpPct(x.s.med, 1) }; }), big: M, read: "11~4월이 5~10월보다 좋았다는 오래된 통계가 있다. 그러나 '팔아야 할 달'은 없었다 — 어느 달도 오른 해가 절반 아래로 떨어지지 않았다." });
  ex.push({ no: ++k, title: "다음 달 " + N + "은", sub: "S&P500 · 코스피", kind: "tiles", data: [{ v: rpPct(a2.med, 1), l: "S&P500 " + N + " 중앙값 · " + a2.up + "/" + a2.n, color: a2.med >= 0 ? NB_C.up : NB_C.down }, { v: rpPct(b2.med, 1), l: "코스피 " + N + " 중앙값 · " + b2.up + "/" + b2.n, color: b2.med >= 0 ? NB_C.up : NB_C.down }, { v: a.worst ? a.worst.y + " " + rpPct(a.worst.v, 0) : "-", l: "최악의 " + M + " (S&P500)", color: NB_C.sub }], big: rpPct(a2.med, 1), read: "다음 달이 더 좋다면 지금 사는 게 낫고, 다음 달이 약하다면 나눠서 사면 된다. 어느 쪽이든 '안 사는' 선택지는 통계상 가장 나빴다." });
  var worst = (function () { var L = []; for (var i = 1; i < sp.length; i++) L.push({ t: sp[i].t, v: sp[i].c / sp[i - 1].c - 1, i: i }); L.sort(function (p, q) { return p.v - q.v; }); var pick = []; L.forEach(function (x) { if (pick.length >= 5) return; if (pick.some(function (u) { return Math.abs(u.t - x.t) < 20 * RP_DAY; })) return; var j = x.i + 252; x.y1 = j < sp.length ? sp[j].c / sp[x.i].c - 1 : null; pick.push(x); }); return pick; })();
  ex.push({ no: ++k, title: "최악의 하루 5번, 1년 뒤", sub: "S&P500 · 하루 낙폭 TOP5 · 그날 종가에 샀다면", kind: "rows", data: worst.map(function (x) { return [rpD(x.t), "그날 " + rpPct(x.v, 1), x.y1 == null ? "진행 중" : "1년 뒤 " + rpPct(x.y1, 0), x.y1 == null ? NB_C.sub : x.y1 >= 0 ? NB_C.up : NB_C.down]; }), big: worst.filter(function (x) { return x.y1 > 0; }).length + "/" + worst.filter(function (x) { return x.y1 != null; }).length, read: "최악의 날 뒤 1년은 대부분 올랐다. 시점을 맞히려는 노력보다 '그날 팔지 않는 것'이 수익을 결정했다." });
  var stance = rank <= 4 ? "지금 사도 된다 · 나눠서" : rank >= 9 ? "나눠서 · 다음 달까지" : "평소대로 적립";
  return { kind: "timing", id: "timing:" + (mon + 1), title: M + ", 지금 사야 하나", sym: "SPY", name: "S&P500", asOf: cDate(Date.now()), price: sp[sp.length - 1].c, situation: [M + " S&P500 중앙값 " + rpPct(a.med, 1) + " · 오른 해 " + a.up + "/" + a.n + " · 12개 달 중 " + rank + "위", "코스피 " + M + " 중앙값 " + rpPct(b.med, 1) + " · 오른 해 " + b.up + "/" + b.n, "다음 달 " + N + " S&P500 중앙값 " + rpPct(a2.med, 1)], exhibits: ex, scen: [{ name: "이번 달 상승", p: a.up / Math.max(1, a.n), range: M + " S&P500 +", txt: a.up + "/" + a.n }, { name: "이번 달 하락", p: 1 - a.up / Math.max(1, a.n), range: M + " S&P500 -", txt: (a.n - a.up) + "/" + a.n + " · 최악 " + (a.worst ? rpPct(a.worst.v, 0) : "-") }],
    view: { stance: stance, score: rank <= 4 ? 3 : rank >= 9 ? 1 : 2, why: [M + " 순위 " + rank + "/12", "오른 해 " + a.up + "/" + a.n], txt: rank <= 4 ? M + "은 역사적으로 좋은 달이다. 계절성 때문에 사는 건 아니지만, 미룰 이유도 없다. 세 번에 나눠 이번 달 안에 채운다." : rank >= 9 ? M + "은 약한 달이다. 그래도 팔 이유는 아니다. 사려던 돈을 이번 달과 다음 달로 나눈다." : "계절성은 중립이다. 평소 적립 리듬을 그대로 간다.", plan: ["살 돈을 3등분해 이번 달 초·중·말에", "급락한 날은 미루지 말고 그날 산다 — 최악의 날 뒤 1년은 대부분 올랐다", "계절성으로 파는 결정은 하지 않는다"] },
    watch: ["월말 지수가 20일선 위인가", "VIX가 30을 넘는 날(추가 매수일)", "다음 달 일정(FOMC·실적)"], src: "야후 파이낸스 종가 · 달력 달 기준 · StockMind 계산", numbers: { rank: rank, up: a.up, n: a.n, med: a.med }, thr: { up: 0.03, dn: -0.03 } };
}

/* ============================================================ 전문가 · 증권사 의견 (대립 구조) ============================================================ */
/* 네이버 뉴스 검색(공식 API)으로 '목표주가·투자의견·전망' 기사를 모아 제목 키워드로 상승/하락 근거를 나눈다 — 원문은 링크로 */
var RP_BULL = /(상향|목표가↑|목표주가 (올|상향|높)|매수 (의견|추천|유지)|저가 매수|저평가|반등|회복|호조|사상 최대|기대|수혜|긍정|호재|최선호|톱픽|탑픽|비중 확대|강세|낙관|돌파|신고가)/;
var RP_BEAR = /(하향|목표가↓|목표주가 (내|하향|낮)|매도 (의견|추천)|중립|비관|우려|악화|부진|리스크|둔화|적자|감익|하락|약세|경고|과열|고점|거품|버블|조정|차익실현|불확실)/;
function rpExpertFetch(rp) {
  if (typeof fetchNews !== "function") return Promise.resolve(null);
  var name = rp.kind === "stock" ? rp.name : rp.kind === "market" ? (rp.sym === "^KS11" ? "코스피" : rp.sym === "SPY" ? "S&P500 미국 증시" : "나스닥") : rp.kind === "macro" ? rp.name : "증시 전망";
  var qs = rp.kind === "stock" ? [name + " 목표주가 투자의견", name + " 증권사 전망"] : rp.kind === "market" ? [name + " 전망 증권사", name + " 애널리스트 하락 상승"] : [name + " 전망 전문가", name + " 영향 증시"];
  return Promise.all(qs.map(function (q) { return fetchNews({ type: "raw", q: q, size: 15 }).catch(function () { return []; }); })).then(function (lists) {
    var seen = {}, items = [];
    lists.forEach(function (L) { (L || []).forEach(function (it) { var t = cNewsClean(it.title || ""); var key = t.slice(0, 20); if (!t || seen[key]) return; seen[key] = 1; items.push({ t: t, press: it.press || "", time: it.time || "", url: it.url || "", desc: cNewsClean(it.desc || "") }); }); });
    var bull = [], bear = [], mixed = [];
    items.forEach(function (x) { var b = RP_BULL.test(x.t + " " + x.desc.slice(0, 80)), r = RP_BEAR.test(x.t + " " + x.desc.slice(0, 80)); if (b && !r) bull.push(x); else if (r && !b) bear.push(x); else if (b && r) mixed.push(x); });
    var tp = []; items.forEach(function (x) { var m = (x.t + " " + x.desc).match(/목표(?:주)?가[^\d]{0,14}(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(만\s*원|원|달러|\$)/); if (m) { var v = parseFloat(m[1].replace(/,/g, "")); if (/만/.test(m[2])) v *= 1e4; if (v > 0) tp.push(v); } });
    return { n: items.length, bull: bull.slice(0, 6), bear: bear.slice(0, 6), mixed: mixed.slice(0, 4), tp: tp.length ? { n: tp.length, med: rpMed(tp), lo: Math.min.apply(null, tp), hi: Math.max.apply(null, tp) } : null, src: "네이버 뉴스 검색 · 최근 기사 " + items.length + "건", at: new Date().toISOString() };
  });
}
function rpExpertHtml(E) {
  var tot = E.bull.length + E.bear.length, bp = tot ? Math.round(E.bull.length / tot * 100) : 50;
  function li(x, cls) { return '<li class="' + cls + '"><a href="' + rpEsc(x.url) + '" target="_blank" rel="noopener">' + rpEsc(x.t) + '</a><small>' + rpEsc(x.press) + (x.time ? " · " + rpEsc(String(x.time).slice(0, 10)) : "") + '</small></li>'; }
  var h = '<div class="mkStep"><b>E</b>전문가 · 증권사는 어떻게 보나 <small class="briefDim">' + rpEsc(E.src) + ' · 제목 키워드로 자동 분류</small></div>';
  h += '<div class="rpDebate"><div class="rpDbBar"><i style="width:' + bp + '%"></i></div><div class="rpDbH"><span class="pos">▲ 상승 근거 ' + E.bull.length + '</span><span class="neg">▼ 하락 근거 ' + E.bear.length + '</span></div>';
  h += '<div class="rpDbCols"><ul>' + (E.bull.length ? E.bull.map(function (x) { return li(x, "b"); }).join("") : '<li class="briefDim">상승 쪽 기사가 없어요</li>') + '</ul><ul>' + (E.bear.length ? E.bear.map(function (x) { return li(x, "r"); }).join("") : '<li class="briefDim">하락 쪽 기사가 없어요</li>') + '</ul></div>';
  if (E.tp) h += '<div class="rpDbTp">기사에 나온 목표주가 ' + E.tp.n + '건 · 중앙값 <b>' + rpNum(E.tp.med) + '원</b> (' + rpNum(E.tp.lo) + ' ~ ' + rpNum(E.tp.hi) + '원)</div>';
  h += '<div class="rpDbQ">' + (tot < 2 ? "의견을 나눌 만큼 기사가 모이지 않았어요." : bp >= 70 ? "전문가 의견은 상승 쪽으로 기울어 있어요. 다들 같은 쪽을 볼 때가 오히려 조심할 때이기도 해요 — 하락 근거 " + E.bear.length + "개를 먼저 읽어 보세요." : bp <= 30 ? "전문가 의견은 하락 쪽이 많아요. 비관이 가장 짙을 때가 저점이었던 적이 많지만, 근거가 '이익 감소'라면 가볍게 볼 수 없어요." : "상승과 하락 근거가 팽팽해요. 이럴 땐 '어느 쪽이 맞나'보다 '내가 틀리면 얼마를 잃나'로 비중을 정하는 게 나아요.") + '<br><b>여러분은 어느 쪽인가요?</b></div></div>';
  return h;
}

/* ============================================================ 종합 해석 (사람이 읽는 글) ============================================================ */
/* 숫자(Exhibit) · 기사·전문가 의견 · 규칙 의견을 한 편의 글로 엮는다 — 문장마다 근거 표시 [E3] · (언론사 날짜)
   구조: 한 줄로 → 숫자가 말하는 것 → 숫자 뒤의 속사정(기사·의견) → 양쪽 의견을 겹쳐 보면 → 그래서(단기·장기·행동·바꿀 조건) */
function rpRef(n) { return "[E" + n + "]"; }
function rpNarrative(rp) {
  var N = rp.numbers || {}, ex = rp.exhibits, E = rp.exp, hz = rp.hz, V = rp.view, k = rp.kind, name = rp.name, S = {};
  function exBy(re) { return ex.filter(function (e) { return re.test(e.title); })[0]; }
  function tag(e) { return e ? " " + rpRef(e.no) : ""; }
  function art(x) { return " (" + (x.press || "기사") + (x.time ? " " + String(x.time).slice(0, 10).replace(/-/g, ".") : "") + ")"; }
  var up = N.cur != null ? N.cur : null, e1 = exBy(/평소보다|지금 위치/), e2 = exBy(/10년, 이만큼|시장의 폭/), e3 = exBy(/과매도|공포/), e4 = exBy(/전고점|조정은 얼마나/), e5 = exBy(/샀다면/), e6 = exBy(/배수로|매크로 조건/), e7 = exBy(/목표주가|월의 과거|월은 과거/);
  // ① 한 줄로
  S.one = V.stance + " — " + V.txt.split(/(?<=\.)\s/)[0] + (hz ? " 짧게는 '" + hz.s.stance.replace(/^단기[:\s]*/, "") + "', 길게는 '" + hz.l.stance.replace(/^장기[:\s]*/, "") + "'." : "");
  // ② 숫자가 말하는 것
  var P2 = [];
  if (k === "stock" || k === "market") {
    if (e1) P2.push(nbJosa(name, "은/는") + " 고점 대비 " + rpPct(up, 1) + "" + tag(e1) + (N.avgMdd != null ? ". 최근 10년 평소 해의 최대 낙폭이 " + rpPct(N.avgMdd, 1) + "이니 그 " + (up / N.avgMdd).toFixed(1) + "배 깊이다" : "") + ".");
    if (e2) P2.push(e2.read.replace(/\s+/g, " ") + tag(e2));
    if (e3) P2.push(e3.read.split(/(?<=\.)\s/)[0] + tag(e3));
    if (e5 && N.simN) P2.push("과거 지금과 비슷하게 빠졌던 " + N.simN + "번 중 1년 뒤 오른 건 " + N.simUp + "번, 중앙값 " + rpPct(N.simMed, 0) + (N.simMin != null ? ", 최악 " + rpPct(N.simMin, 0) : "") + tag(e5) + ". 확률은 유리하지만 '바닥'이라는 뜻은 아니다.");
    if (e4) P2.push(e4.read.split(/(?<=\.)\s/)[0] + tag(e4));
    if (e6 && N.fwdPer) P2.push("배수로는 올해 예상 PER " + N.fwdPer.toFixed(1) + "배" + (N.per ? "(최근 실적 " + N.per.toFixed(1) + "배)" : "") + tag(e6) + " — 이익 전망이 지켜지느냐가 이 숫자의 생명이다.");
    else if (e6) P2.push(e6.read.split(/(?<=\.)\s/)[0] + tag(e6));
  } else if (k === "macro") { ex.slice(0, 3).forEach(function (e) { P2.push(e.read.split(/(?<=\.)\s/)[0] + tag(e)); }); }
  else { ex.slice(0, 3).forEach(function (e) { P2.push(e.read.split(/(?<=\.)\s/)[0] + tag(e)); }); }
  S.numbers = P2.join(" ");
  // ③ 숫자 뒤의 속사정 — 기사·의견
  var P3 = [];
  if (E && E.n) {
    var all = E.bull.concat(E.bear).concat(E.mixed || []);
    if (E.tp && k === "stock") { var r = rp.price ? E.tp.med / rp.price : 0; P3.push("증권사 목표주가는 기사 " + E.tp.n + "건 기준 중앙값 " + rpNum(E.tp.med) + "원(" + rpNum(E.tp.lo) + "~" + rpNum(E.tp.hi) + "원)" + (r >= 0.2 && r <= 5 ? "으로 지금보다 " + rpPct(r - 1, 0) : "") + "."); }
    if (E.bull.length) P3.push("오르는 쪽 근거로는 " + E.bull.slice(0, 2).map(function (x) { return "'" + x.t + "'" + art(x); }).join(", ") + " 등이 있다.");
    if (E.bear.length) P3.push("반대로 " + E.bear.slice(0, 2).map(function (x) { return "'" + x.t + "'" + art(x); }).join(", ") + "처럼 조심하라는 목소리도 있다.");
    if (!E.bull.length && !E.bear.length) P3.push("최근 기사 " + E.n + "건에서 뚜렷한 상승·하락 근거는 찾지 못했다 — 시장의 관심 자체가 식어 있다는 뜻일 수 있다.");
  } else P3.push("기사·전문가 의견은 아직 모으지 못했다(기사 수집 전). 숫자만으로 판단한다.");
  S.story = P3.join(" ");
  // ④ 양쪽 의견을 겹쳐 보면
  var P4 = [];
  if (E && E.bull.length + E.bear.length >= 2) {
    var tot = E.bull.length + E.bear.length, bp = E.bull.length / tot;
    P4.push("전문가 의견은 상승 " + E.bull.length + " 대 하락 " + E.bear.length + ". " + (bp >= 0.7 ? "한쪽으로 쏠려 있다." : bp <= 0.3 ? "비관이 짙다." : "팽팽하다."));
    var agree = (bp >= 0.6 && V.score >= 2) || (bp <= 0.4 && V.score <= 0);
    P4.push(agree ? "숫자 쪽 결론(" + V.stance + ")과 같은 방향이다. 다만 모두가 같은 쪽을 볼 때는 '이미 가격에 들어 있나'를 의심해야 한다." : "숫자 쪽 결론(" + V.stance + ")과는 결이 다르다. 숫자는 과거 빈도를, 기사는 지금의 재료를 본다 — 둘이 갈릴 때 결과를 정한 건 대개 '이익이 실제로 어떻게 나오느냐'였다.");
    if (E.bear.length) P4.push("하락 쪽이 말하는 위험(" + E.bear[0].t.slice(0, 30) + ")이 현실이 되면 숫자 쪽 시나리오 중 '추가 하락'" + (rp.scen && rp.scen[2] && rp.scen[2].p > 0 ? "(과거 빈도 " + Math.round(rp.scen[2].p * 100) + "%)" : "(과거엔 드물었던 경우)") + "이 그 경우다.");
  } else P4.push("의견을 겹쳐 볼 만큼 기사가 모이지 않아, 이번엔 숫자 쪽 결론을 그대로 쓴다.");
  S.both = P4.join(" ");
  // ⑤ 그래서
  var P5 = [];
  if (rp.scen && rp.scen.length) P5.push("기준 시나리오는 " + rp.scen.slice().sort(function (a, b) { return b.p - a.p; })[0].name + "(" + Math.round(rp.scen.slice().sort(function (a, b) { return b.p - a.p; })[0].p * 100) + "%, 과거 빈도).");
  if (hz) { var h1 = hz.s.txt.split(/(?<=\.)\s/)[0].replace(/^(짧게|단기로) 보면 /, ""), h2 = hz.l.txt.split(/(?<=\.)\s/)[0].replace(/^(길게|장기로) 보면 /, ""); P5.push("짧게 보면 " + h1 + " 길게 보면 " + h2); }
  P5.push("행동은 " + V.plan.map(function (x, i) { return (i + 1) + ") " + x; }).join(" ") + ".");
  P5.push("생각을 바꿀 신호는 " + rp.watch.slice(0, 2).join(", ") + ".");
  S.so = P5.join(" ");
  S.srcs = ex.map(function (e) { return { id: rpRef(e.no), t: e.title }; });
  S.arts = E ? E.bull.concat(E.bear).slice(0, 8).map(function (x) { return { t: x.t, press: x.press, time: String(x.time || "").slice(0, 10), url: x.url }; }) : [];
  return S;
}
function rpNarrativeHtml(S, rp) {
  function fmt(t) { return rpEsc(t).replace(/\[E(\d+)\]/g, function (m, n) { return '<a class="rpRefTag" href="#rpEx' + n + '" title="Exhibit ' + n + '">E' + n + '</a>'; }).replace(/\(([^()]{2,14}) (\d{4}\.\d{1,2}\.\d{1,2})\)/g, '<span class="rpSrcTag">$1 $2</span>'); }
  var sec = function (h, t) { return '<div class="rpNarS"><div class="rpNarH">' + h + '</div><p>' + fmt(t) + '</p></div>'; };
  return '<div class="rpNar"><div class="rpNarT">종합 해석 <small>숫자(앱 계산) + 기사·전문가 의견 + 규칙 의견을 한 편으로 · 문장마다 근거 표시</small></div>' + sec("한 줄로", S.one) + sec("숫자가 말하는 것", S.numbers) + sec("숫자 뒤의 속사정", S.story) + sec("양쪽 의견을 겹쳐 보면", S.both) + sec("그래서", S.so) +
    '<div class="rpNarSrc">근거 ' + S.srcs.map(function (x) { return '<a href="#rpEx' + x.id.replace(/\D/g, "") + '">' + x.id + ' ' + rpEsc(x.t) + '</a>'; }).join(" · ") + (S.arts.length ? '<br>출처 ' + S.arts.map(function (a) { return '<a href="' + rpEsc(a.url) + '" target="_blank" rel="noopener">' + rpEsc(a.press) + ' ' + rpEsc(a.time) + '</a>'; }).join(" · ") : '') + '</div></div>';
}

/* ============================================================ 단기 · 장기 해석 ============================================================ */
/* 단기(1~3개월): 과매도·20일선·변동성·3개월 분포 / 장기(1~3년): 낙폭 깊이·밸류·장기 승률·구조 */
function rpHorizon(rp) {
  var N = rp.numbers || {}, k = rp.kind, S = { label: "단기 (1~3개월)", stance: "", txt: "", pts: [] }, L = { label: "장기 (1~3년)", stance: "", txt: "", pts: [] };
  if (k === "stock" || k === "market") {
    var rows = rpRows(rp.sym), tech = rows.length ? rpTech(rows) : null, sim = rows.length ? rpSimilar(rows, Math.min(N.cur || -0.1, -0.1)) : null;
    var sS = 0;
    if (tech) { if (tech.rsi < 30) { sS += 2; S.pts.push("RSI " + tech.rsi.toFixed(0) + " — 과매도, 되돌림(반등)이 자주 나오는 자리"); } else if (tech.rsi > 70) { sS -= 2; S.pts.push("RSI " + tech.rsi.toFixed(0) + " — 과열, 단기 쉬어갈 가능성"); } else S.pts.push("RSI " + tech.rsi.toFixed(0) + " — 중립");
      if (tech.last > tech.ma20) { sS += 1; S.pts.push("20일선 위 — 단기 추세는 살아 있음"); } else { sS -= 1; S.pts.push("20일선 아래(" + rpPct(tech.last / tech.ma20 - 1, 1) + ") — 단기 추세 약함, 20일선 회복이 첫 확인 신호"); }
      S.pts.push("하루 평균 변동 " + (tech.dayVol * 100).toFixed(1) + "% — 한 달이면 ±" + Math.round(tech.dayVol * 100 * 4.5) + "% 정도는 '평소'"); }
    if (sim && sim.m3 != null) { S.pts.push("비슷한 낙폭 뒤 3개월 중앙값 " + rpPct(sim.m3, 0) + " · 6개월 " + rpPct(sim.m6, 0)); if (sim.m3 > 0.03) sS += 1; }
    S.stance = sS >= 2 ? "단기 반등 가능성 우세" : sS <= -2 ? "단기 약세 · 쫓지 않기" : "단기 방향 불명확";
    S.txt = sS >= 2 ? "짧게 보면 되돌림이 나올 자리다. 다만 반등을 노린 매매는 손절 기준이 있어야 한다 — 20일선 아래로 다시 밀리면 접는다." : sS <= -2 ? "짧게는 불리하다. 지금 들어가면 몇 주 동안 평가손을 볼 확률이 높다. 급할 이유가 없다." : "짧게는 동전 던지기에 가깝다. 단기 수익을 기대하고 들어갈 자리는 아니고, 분할의 '첫 번째 몫'으로만.";
    var lS = 0;
    if (N.cur != null && N.avgMdd != null) { if (N.cur <= N.avgMdd * 1.5) { lS += 2; L.pts.push("평소 해 최대 낙폭의 " + (N.cur / N.avgMdd).toFixed(1) + "배 — 길게 보면 드문 가격"); } else if (N.cur <= -0.2) { lS += 1; L.pts.push("고점 대비 " + rpPct(N.cur, 0) + " — 길게 보면 나쁘지 않은 출발점"); } else L.pts.push("고점 근처 — 길게 봐도 '싸다'고는 못 함"); }
    else if (N.cur != null) { if (N.cur <= -0.2) { lS += 2; L.pts.push("약세장 구간 — 지수의 장기 승률이 가장 높았던 구간"); } else if (N.cur <= -0.1) { lS += 1; L.pts.push("조정 구간"); } else L.pts.push("고점 근처"); }
    if (N.simN >= 3) { L.pts.push("비슷한 위치에서 1년 뒤 상승 " + N.simUp + "/" + N.simN + " · 중앙값 " + rpPct(N.simMed, 0)); if (N.simUp / N.simN >= 0.7) lS += 1; else if (N.simUp / N.simN < 0.5) lS -= 1; }
    if (N.fwdPer) { L.pts.push("올해 예상 PER " + N.fwdPer.toFixed(1) + "배" + (N.per ? " (최근 실적 " + N.per.toFixed(1) + "배)" : "")); if (N.per && N.fwdPer < N.per * 0.6) lS += 1; }
    if (k === "market") { L.pts.push("지수는 종목과 달리 0이 되지 않는다 — 시간을 아군으로 쓸 수 있는 자산"); lS += 1; }
    if (k === "stock" && tech && tech.ma200 && tech.last < tech.ma200) L.pts.push("200일선 아래 — 장기 추세는 아직 꺾인 상태, 돌아서는 데 몇 달");
    L.stance = lS >= 3 ? "장기 매력 높음" : lS >= 1 ? "장기 보통 · 나눠서" : "장기 근거 부족";
    L.txt = lS >= 3 ? "길게 보면 지금은 좋은 출발점이다. 1~3년을 보고 금액을 정해 나눠 담으면 단기 흔들림은 비용이 아니라 기회가 된다." + (k === "stock" ? " 단, 종목은 이익이 깎이면 이야기가 달라진다 — 분기마다 예상 EPS를 확인한다." : "") : lS >= 1 ? "길게 보면 나쁘지 않지만 특별히 싸지도 않다. 정액 적립을 유지하고, 큰 추가 매수는 더 빠질 때로 미룬다." : "길게 봐도 지금 서둘러 살 근거가 약하다. 오르면 못 산 것이고, 그래도 괜찮다 — 다음 기회는 늘 온다.";
  } else if (k === "macro") {
    S.stance = "단기: 헤드라인 변동"; S.txt = "매크로 조건은 발표 직후 며칠 흔들리고 지나간다. 단기 대응은 하지 않는 게 낫다."; S.pts = ["발표·돌파 당일 변동은 보통 1~2주 안에 되돌아옴", "환율·금리는 주가보다 느리게 움직인다"];
    L.stance = N.ksN >= 3 && N.ksMed != null ? (N.ksMed >= 0.05 ? "장기: 평소보다 좋았음" : N.ksMed <= -0.05 ? "장기: 평소보다 나빴음" : "장기: 평소와 비슷") : "장기: 표본 부족"; L.txt = N.ksN ? "이 조건 뒤 1년 코스피 중앙값 " + rpPct(N.ksMed, 0) + " (" + N.ksUp + "/" + N.ksN + "). 금리·환율은 6~12개월 뒤 실적과 수급에 반영된다." : "사례가 적어 장기 결론을 내기 어렵다."; L.pts = ["금리 인하 '시작'과 '장기금리 하락'은 다르다", "환율은 1년 뒤 대체로 되돌아오는 경향"];
  } else if (k === "timing") {
    S.stance = N.rank <= 4 ? "단기: 유리한 달" : N.rank >= 9 ? "단기: 약한 달" : "단기: 중립"; S.txt = "이번 달 오른 해 " + N.up + "/" + N.n + " · 중앙값 " + rpPct(N.med, 1) + ". 한 달 결과는 계절성보다 그달의 사건이 정한다."; S.pts = ["계절성은 추가 매수 '시점' 참고용", "급락일엔 계절과 상관없이 산다"];
    L.stance = "장기: 시점보다 기간"; L.txt = "10년 단위로 보면 어느 달에 샀는지는 결과에 거의 영향이 없었다. 몇 년을 들고 있었는지가 결정했다."; L.pts = ["최악의 날 뒤 1년은 대부분 상승", "가장 좋은 10일을 놓치면 수익의 절반이 사라진다"];
  }
  return { s: S, l: L };
}

/* ============================================================ 질문 후보 (오늘 데이터로 자동) ============================================================ */
function rpQuestions() {
  var Q = [], R = typeof briefState !== "undefined" && briefState.result, S = R ? (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym); }) : [];
  var deep = S.filter(function (s) { return s.vsHi != null && s.vsHi <= -0.3 && s.longEnough; }).sort(function (a, b) { return a.vsHi - b.vsHi; }).slice(0, 4);
  var pop = R && R.popular ? R.popular.slice(0, 3) : [];
  pop.concat(deep).forEach(function (s) { if (Q.some(function (q) { return q.id === "stock:" + s.sym; })) return; Q.push({ id: "stock:" + s.sym, kind: "stock", sym: s.sym, t: rpName(s.sym) + ", 기회인가 위기인가", d: "고점 대비 " + rpPct(s.vsHi, 0) + " · 1개월 " + rpPct(s.m1, 0) + (pop.indexOf(s) >= 0 ? " · 지금 인기" : " · 크게 빠짐"), why: pop.indexOf(s) >= 0 ? "지금 사람들이 가장 많이 찾는 종목" : "고점 대비 30% 넘게 빠져 '사도 되나' 질문이 나오는 종목" }); });
  [["^KS11", "코스피"], ["SPY", "S&P500"], ["QQQ", "나스닥100"]].forEach(function (m) { var st = typeof nbStat === "function" ? nbStat(m[0]) : null; Q.push({ id: "market:" + m[0], kind: "market", sym: m[0], t: "지금 " + m[1] + ", 사도 되나", d: st ? "고점 대비 " + rpPct(st.vsHi, 0) + " · 20일 " + rpPct(st.m1, 0) : "", why: st && st.vsHi <= -0.1 ? "조정 구간 — '지금 사도 되나'가 가장 많이 나오는 때" : "시장 전체의 위치를 먼저 정리" }); });
  if (typeof macReady === "function" && macReady()) macroCompute().filter(function (r) { return r.now.on; }).slice(0, 3).forEach(function (r) { Q.push({ id: "macro:" + r.c.id, kind: "macro", arg: r.c.id, t: r.c.tag + ", 그래서 어떻게 보나", d: r.now.txt, why: "지금 해당하는 매크로 조건" }); });
  var mon = new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1; Q.push({ id: "timing:" + mon, kind: "timing", t: mon + "월, 지금 사야 하나", d: "계절성 · 최악의 날 · 적립", why: "매달 초 반복되는 질문" });
  return Q;
}
function rpBuild(q) {
  var need = q.kind === "stock" ? [q.sym] : q.kind === "market" ? [q.sym, "^VIX"] : q.kind === "timing" ? ["SPY", "^KS11"] : [];
  var p = rpLoad(need).then(function () { return q.kind === "stock" ? rpFund(q.sym) : null; }).then(function () { return q.kind === "macro" && typeof macroEnsure === "function" ? macroEnsure().then(function (d) { return d && !d.none ? macPxLoad() : null; }) : null; });
  return p.then(function () { var rp = q.kind === "stock" ? rpStock(q.sym) : q.kind === "market" ? rpMarket(q.sym) : q.kind === "macro" ? rpMacro(q.arg) : rpTiming(); if (!rp) throw new Error("이 질문에 필요한 데이터가 부족해요(과거 주가가 짧거나 아직 안 받음)"); rp.made = new Date().toISOString(); try { rp.hz = rpHorizon(rp); } catch (e) { rp.hz = null; } return rp; });
}

/* ============================================================ 회상 · 검증 ============================================================ */
function rpVerify(saved) {
  var sym = saved.sym; if (!sym || saved.price == null) return Promise.resolve(null);
  return rpLoad([sym]).then(function () {
    var rows = rpRows(sym); if (!rows.length) return null; var last = rows[rows.length - 1], since = last.c / saved.price - 1, days = Math.round((last.t - Date.parse(saved.made)) / RP_DAY);
    var t = saved.thr || { up: 0.1, dn: -0.1 }, playing = since >= t.up ? "회복·상승" : since <= t.dn ? "추가 하락" : "횡보";
    var st = saved.view && saved.view.stance || "", bullish = /검토|매수|사도|역발상|관심/.test(st), bearish = /관망|서두를|방어/.test(st), neutral = !bullish && !bearish;
    var hit = days < 20 ? null : bullish ? since > 0.03 : bearish ? since < 0.03 : Math.abs(since) < 0.1;
    var lo = Infinity, hi = -Infinity; rows.slice(rpIdx(rows, Date.parse(saved.made))).forEach(function (r) { lo = Math.min(lo, r.c); hi = Math.max(hi, r.c); });
    return { since: since, days: days, last: last.c, playing: playing, hit: hit, neutral: neutral, lo: lo / saved.price - 1, hi: hi / saved.price - 1 };
  });
}

/* ============================================================ 글: 스레드 연재 · 캡션 ============================================================ */
function rpThreadSeries(rp) {
  var L = [], n = 0, NR = null; try { NR = rpNarrative(rp); } catch (e) {}
  var plain = function (t) { return String(t || "").replace(/\s?\[E\d+\]/g, ""); };
  L.push(rp.title + "\n\n" + (NR ? plain(NR.one) : rp.situation.join("\n")) + "\n\n아래에 번호로 이어 씁니다.");
  if (NR) { L.push((++n) + ". 숫자가 말하는 것\n" + plain(NR.numbers)); L.push((++n) + ". 숫자 뒤의 속사정\n" + plain(NR.story)); L.push((++n) + ". 양쪽 의견을 겹쳐 보면\n" + plain(NR.both)); L.push((++n) + ". 그래서\n" + plain(NR.so)); L.push((++n) + ". 아래는 근거 하나씩."); }
  rp.exhibits.forEach(function (e) { L.push((++n) + ". " + e.title + "\n" + e.read.replace(/\s+/g, " ")); });
  if (rp.scen.length) L.push((++n) + ". 앞으로 1년, 과거 빈도로 보면\n" + rp.scen.map(function (s) { return s.name + " " + Math.round(s.p * 100) + "% (" + s.range + ")"; }).join("\n"));
  if (rp.hz) { L.push((++n) + ". 짧게 보면 — " + rp.hz.s.stance + "\n" + rp.hz.s.txt); L.push((++n) + ". 길게 보면 — " + rp.hz.l.stance + "\n" + rp.hz.l.txt); }
  if (rp.exp && rp.exp.bull.length + rp.exp.bear.length >= 2) L.push((++n) + ". 전문가들은 — 상승 " + rp.exp.bull.length + " vs 하락 " + rp.exp.bear.length + "\n" + rp.exp.bull.slice(0, 2).map(function (x) { return "▲ " + x.t; }).concat(rp.exp.bear.slice(0, 2).map(function (x) { return "▼ " + x.t; })).join("\n"));
  L.push((++n) + ". 내 생각 — " + rp.view.stance + "\n" + rp.view.txt);
  L.push((++n) + ". 그래서\n" + rp.view.plan.map(function (p, i) { return "· " + p; }).join("\n"));
  L.push((++n) + ". 생각을 바꿀 조건\n" + rp.watch.map(function (w) { return "· " + w; }).join("\n") + "\n\n(" + rp.src + " · 개인 의견이며 투자 권유 아님)");
  return L.map(function (t) { return t.length > 500 ? t.slice(0, 495) + "…" : t; });
}
function rpCaption(rp) {
  var NR = null; try { NR = rpNarrative(rp); } catch (e) {}
  var plain = function (t) { return String(t || "").replace(/\s?\[E\d+\]/g, ""); };
  var L = [rp.title, ""].concat(NR ? [plain(NR.one), "", plain(NR.numbers), "", plain(NR.story), "", plain(NR.both), "", plain(NR.so), ""] : rp.situation.map(function (s) { return "· " + s; }).concat([""]), rp.exhibits.slice(0, 5).map(function (e) { return "Exhibit " + String(e.no).padStart(2, "0") + " " + e.title + " → " + e.big; }), ["", "내 생각: " + rp.view.stance + ". " + rp.view.txt, "", "바꿀 조건: " + rp.watch.slice(0, 2).join(" · "), "", "※ " + rp.src + " · 개인 의견이며 투자 권유 아님", "", "#우상향연구소 #" + String(rp.name).replace(/\s/g, "") + " #투자분석 #주식공부 #재테크"]);
  return L.join("\n");
}

/* ============================================================ AI 서술 (선택) ============================================================ */
function rpAiLines(rp) {
  var L = [], id = 0; function add(t) { L.push({ id: "F" + (++id), text: t }); }
  rp.situation.forEach(add); rp.exhibits.forEach(function (e) { add("Exhibit " + e.no + " " + e.title + " · " + e.sub); add("핵심값 " + e.big); add(e.read); (e.kind === "rows" ? e.data.map(function (r) { return r.slice(0, 3).join(" · "); }) : e.kind === "tiles" ? e.data.map(function (t) { return t.l + " " + t.v; }) : e.data.map(function (b) { return b.l + " " + (b.txt || rpPct(b.v, 1)); })).forEach(add); });
  if (rp.exp) { rp.exp.bull.forEach(function (x) { add("상승 근거 기사: " + x.t + " (" + x.press + ")"); }); rp.exp.bear.forEach(function (x) { add("하락 근거 기사: " + x.t + " (" + x.press + ")"); }); if (rp.exp.tp) add("기사 목표주가 중앙값 " + rpNum(rp.exp.tp.med) + "원 (" + rp.exp.tp.n + "건)"); }
  if (rp.hz) { add("단기 해석: " + rp.hz.s.stance + " — " + rp.hz.s.txt); add("장기 해석: " + rp.hz.l.stance + " — " + rp.hz.l.txt); }
  rp.scen.forEach(function (s) { add("시나리오 " + s.name + " " + Math.round(s.p * 100) + "% " + s.range + " " + s.txt); }); add("규칙 의견: " + rp.view.stance + " — " + rp.view.txt); rp.view.why.forEach(function (w) { add("근거 " + w); });
  return L;
}
function rpAiWrite(rp) {
  return fetch("/api/channel?op=ai", { method: "POST", headers: { "x-owner": typeof ocTok === "function" ? ocTok() : "", "Content-Type": "application/json" }, body: JSON.stringify({ mode: "insight", title: rp.title, lines: rpAiLines(rp), stance: rp.view.stance, draft: (function () { try { var N = rpNarrative(rp); return [N.one, N.numbers, N.story, N.both, N.so].join("\n\n"); } catch (e) { return ""; } })() }) }).then(function (r) { return r.json(); });
}

/* ============================================================ 카드 덱 (Exhibit 카드) ============================================================ */
function rpDeck(rp) {
  var NR = null; try { NR = rpNarrative(rp); } catch (e) {}
  var plain = function (t) { return String(t || "").replace(/\s?\[E\d+\]/g, "").replace(/\s?\([^()]{2,14} \d{4}\.\d{1,2}\.\d{1,2}\)/g, ""); };
  var pages = (NR ? [{ name: "종합", top: ["한 줄로:", "[[" + rp.view.stance + "]]", "", plain(NR.one).split(/(?<=\.)\s/)[1] || ""], title: "종합 해석", sub: "숫자 · 기사 · 의견을 한 편으로 (근거는 다음 장부터)", kind: "text", data: { paras: [plain(NR.numbers), plain(NR.story), plain(NR.both)], after: ["그래서", (function (t) { var o = ""; t.split(/(?<=\.)\s/).some(function (x) { if ((o + x).length > 110) return true; o += (o ? " " : "") + x; }); return o || t.slice(0, 110); })(plain(NR.so))] } }] : []).concat(rp.exhibits.map(function (e) { return { name: "Exhibit" + e.no, top: [e.title.indexOf(",") > 0 ? e.title.split(",")[0] + "," : e.title, "[[" + e.big + "]]", "", e.read.split(/(?<=\.)\s/)[0]], title: "Exhibit " + String(e.no).padStart(2, "0") + " · " + e.title, sub: e.sub, kind: e.kind, data: e.kind === "tiles" ? { tiles: e.data } : e.data, note: e.read, foot: rp.src + " · 투자 권유 아님" }; }));
  if (rp.scen.length) pages.push({ name: "시나리오", top: ["앞으로 1년, 과거 빈도로 보면", "[[" + rp.scen[0].name + " " + Math.round(rp.scen[0].p * 100) + "%]]"], title: "시나리오 — 과거 비슷한 상황의 결과 분포", sub: "확률 = 과거 사례 빈도 · 예측이 아니라 참고", kind: "rows", data: rp.scen.map(function (s) { return [Math.round(s.p * 100) + "%", s.name + " · " + s.range, s.txt.split(".")[0], s.name.indexOf("하락") >= 0 ? NB_C.down : NB_C.up]; }), leftW: 110 });
  if (rp.hz) pages.push({ name: "단기장기", top: ["짧게 보면 [[" + rp.hz.s.stance + "]]", "길게 보면 [[" + rp.hz.l.stance + "]]"], title: "단기 · 장기 해석", sub: "단기 = 1~3개월 · 장기 = 1~3년 · 같은 숫자를 다른 시간으로", kind: "rows", data: rp.hz.s.pts.slice(0, 3).map(function (x) { return ["단기", x, "", NB_C.navy]; }).concat(rp.hz.l.pts.slice(0, 3).map(function (x) { return ["장기", x, "", NB_C.up]; })), leftW: 90 });
  if (rp.exp && rp.exp.bull.length + rp.exp.bear.length >= 2) pages.push({ name: "전문가", top: ["전문가 의견은", "[[상승 " + rp.exp.bull.length + " vs 하락 " + rp.exp.bear.length + "]]"], title: "전문가·증권사 의견 — 대립 구조", sub: "최근 기사 제목에서 상승·하락 근거를 나눠 모음 · " + rp.exp.src, kind: "rows", data: rp.exp.bull.slice(0, 4).map(function (x) { return ["▲ 상승", x.t, x.press || "", NB_C.up]; }).concat(rp.exp.bear.slice(0, 4).map(function (x) { return ["▼ 하락", x.t, x.press || "", NB_C.down]; })), leftW: 100 });
  pages.push({ name: "내생각", top: ["내 생각:", "[[" + rp.view.stance + "]]", "", rp.view.txt.split(/(?<=\.)\s/)[0]], title: "결론과 행동안", sub: "근거: " + rp.view.why.join(" · "), kind: "text", data: { paras: [rp.view.txt].concat(rp.view.plan.map(function (p) { return "· " + p; })), after: ["생각을 바꿀 조건", rp.watch.slice(0, 2).join(" · ")] } });
  return hubDraw({ small: rp.asOf + " 기준 · 리포트", hook: rp.title.split(", ").length > 1 ? [rp.title.split(", ")[0] + ",", "[[" + rp.title.split(", ").slice(1).join(", ") + "]]"] : [rp.title], lead: rp.situation.join(" "), meta: rp.src + " · 개인 의견이며 투자 권유 아님", pages: pages, close: ["여러분은 어떻게 보시나요?", ["저장해 두고 3개월 뒤", "이 리포트의 결론을 다시 채점해 보세요."]], foot: rp.src + " · 투자 권유 아님" });
}

/* ============================================================ 화면 ============================================================ */
function renderReport() {
  var box = document.getElementById("rpBody"); if (!box) return;
  if (!(typeof isOwner === "function" && isOwner())) { box.innerHTML = '<div class="dvEmpty">운영자 전용 페이지예요.</div>'; return; }
  if (typeof briefState !== "undefined" && !briefState.result && typeof loadBrief === "function" && !RP.warm) { RP.warm = true; try { loadBrief(false); } catch (e) {} setTimeout(renderReport, 2500); }
  if (typeof macroEnsure === "function" && !RP.macroWarm) { RP.macroWarm = true; macroEnsure().then(function (d) { return d && !d.none ? macPxLoad() : null; }).then(function () { if (currentTab === "report" && RP.tab === "new" && !RP.cur) renderReport(); }); }
  var h = '<div class="mkTabs rpTabs">' + [["today", "오늘의 리포트"], ["new", "질문 고르기"], ["saved", "회상 · 검증 (" + RP.saved.length + ")"]].map(function (t) { return '<button data-rpt="' + t[0] + '" class="' + (RP.tab === t[0] ? "on" : "") + '">' + t[1] + '</button>'; }).join("") + '</div><div id="rpPane"></div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-rpt]"), function (b) { b.onclick = function () { RP.tab = b.getAttribute("data-rpt"); renderReport(); }; });
  var pane = document.getElementById("rpPane");
  if (RP.tab === "saved") rpSavedRender(pane); else if (RP.cur) rpShow(pane, RP.cur); else if (RP.tab === "today") rpTodayRender(pane); else rpPick(pane);
}
function rpPick(pane) {
  var Q = rpQuestions();
  var h = '<div class="briefDim" style="margin-bottom:8px">질문을 고르면 앱 데이터로 증거(Exhibit)를 계산하고, 해석 · 의견 · 시나리오 · 행동안 · 바꿀 조건까지 한 번에 써요. 숫자는 계산값, 의견은 과거 빈도 기준이에요.</div>';
  h += '<div class="rpAsk"><input id="rpSym" placeholder="종목 검색해서 질문 만들기 (예: 삼성전자, NVDA)"><div class="hResults" id="rpSymRes"></div></div>';
  h += '<div class="hubList">' + Q.map(function (q) { return '<div class="hubItem"><div class="hubMain"><b>' + rpEsc(q.t) + '</b><small>' + rpEsc(q.d) + '</small><div class="hubWhy"><span>왜 지금</span>' + rpEsc(q.why) + '</div><div class="hubActs"><button class="chip" data-rpq="' + q.id + '" data-kind="' + q.kind + '" data-sym="' + (q.sym || "") + '" data-arg="' + (q.arg || "") + '">리포트 만들기</button></div></div></div>'; }).join("") + '</div>';
  pane.innerHTML = h;
  Array.prototype.forEach.call(pane.querySelectorAll("[data-rpq]"), function (b) { b.onclick = function () { rpGo({ id: b.getAttribute("data-rpq"), kind: b.getAttribute("data-kind"), sym: b.getAttribute("data-sym") || null, arg: b.getAttribute("data-arg") || null }, b); }; });
  var inp = document.getElementById("rpSym"), res = document.getElementById("rpSymRes");
  inp.addEventListener("input", function () { var hits = typeof searchDict === "function" ? searchDict(TICKER_DICT, inp.value).slice(0, 6) : []; if (!inp.value.trim() || !hits.length) { res.style.display = "none"; return; } res.innerHTML = hits.map(function (x) { return '<div class="hRes" data-s="' + x.symbol + '"><b>' + rpEsc(x.name) + '</b> <small>' + x.symbol + '</small></div>'; }).join(""); res.style.display = "block"; Array.prototype.forEach.call(res.querySelectorAll("[data-s]"), function (d) { d.onmousedown = function (e) { e.preventDefault(); var s = d.getAttribute("data-s"); res.style.display = "none"; inp.value = ""; rpGo({ id: (/^\^/.test(s) ? "market:" : "stock:") + s, kind: /^\^/.test(s) ? "market" : "stock", sym: s }, null); }; }); });
  inp.addEventListener("blur", function () { setTimeout(function () { res.style.display = "none"; }, 150); });
}
function rpGo(q, btn) {
  var old = btn ? btn.textContent : ""; if (btn) { btn.textContent = "계산 중…"; btn.disabled = true; }
  RP.ai = null;
  rpBuild(q).then(function (rp) { RP.cur = rp; RP.tab = "new"; renderReport(); window.scrollTo({ top: 0, behavior: "smooth" }); rpExpertFetch(rp).then(function (E) { if (E && RP.cur === rp) { rp.exp = E; renderReport(); } }).catch(function () {}); }).catch(function (e) { alert("리포트를 만들지 못했어요: " + e.message); if (btn) { btn.textContent = old; btn.disabled = false; } });
}
function rpBar(v, max) { var w = Math.min(100, Math.abs(v) / (max || 1) * 100); return '<span class="rpBarW"><i class="' + (v >= 0 ? "up" : "dn") + '" style="width:' + w.toFixed(1) + '%"></i></span>'; }
function rpExhibitHtml(e) {
  var body = "";
  if (e.kind === "tiles") body = '<div class="rpTiles">' + e.data.map(function (t) { return '<div class="rpTile"><b>' + rpEsc(t.v) + '</b><small>' + rpEsc(t.l) + '</small></div>'; }).join("") + '</div>';
  else if (e.kind === "bars") { var mx = Math.max.apply(null, e.data.map(function (b) { return Math.abs(b.v || 0); }).concat([0.01])); body = '<div class="rpBars">' + e.data.map(function (b) { return '<div class="rpBarR"><span>' + rpEsc(b.l) + '</span>' + rpBar(b.v || 0, mx) + '<b class="' + ((b.v || 0) >= 0 ? "pos" : "neg") + '">' + rpEsc(b.txt || rpPct(b.v, 1)) + '</b></div>'; }).join("") + '</div>'; }
  else if (e.kind === "rows") body = '<div class="rpRows">' + e.data.map(function (r) { return '<div class="rpRow"><span class="rpL">' + rpEsc(r[0]) + '</span><span class="rpM">' + rpEsc(r[1]) + (r[4] ? '<small>' + rpEsc(r[4]) + '</small>' : '') + '</span><b style="color:' + (r[3] || "inherit") + '">' + rpEsc(r[2]) + '</b></div>'; }).join("") + '</div>';
  return '<div class="rpEx" id="rpEx' + e.no + '"><div class="rpExH"><span class="rpExNo">Exhibit ' + String(e.no).padStart(2, "0") + '</span><b>' + rpEsc(e.title) + '</b><small>' + rpEsc(e.sub) + '</small></div>' + body + '<div class="rpRead">' + rpEsc(e.read) + '</div></div>';
}
function rpShow(pane, rp) {
  var ai = RP.ai, V = ai && ai.ok ? ai.out : null;
  var h = '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><button class="chip" data-rpa="back">‹ 다른 질문</button><button class="chip" data-rpa="save">💾 저장(검증용)</button><button class="chip" data-rpa="deck">🃏 Exhibit 카드 덱</button><button class="chip" data-rpa="thread">🧵 스레드 연재 글</button><button class="chip aiBtn" data-rpa="ai">' + (V ? "✨ AI 서술 다시" : "✨ AI가 다시 쓰기") + '</button></div>';
  h += '<div class="rpHead"><div class="rpKicker">' + rpEsc(rp.asOf) + ' 기준 · ' + ({ stock: "종목", market: "시장", macro: "매크로", timing: "시점" })[rp.kind] + ' 리포트</div><h3>' + rpEsc(V && V.headline || rp.title) + '</h3><div class="rpSit">' + (V && V.situation ? rpEsc(V.situation) : rp.situation.map(function (s) { return '<div>· ' + rpEsc(s) + '</div>'; }).join("")) + '</div></div>';
  var NR = null; try { NR = rpNarrative(rp); } catch (e) { console.warn(e); }
  if (V && V.narrative) h += '<div class="rpNar"><div class="rpNarT">종합 해석 <small>AI 서술 · 숫자는 근거 줄 그대로</small></div>' + V.narrative.split(/\n{2,}/).map(function (p) { return '<div class="rpNarS"><p>' + rpEsc(p) + '</p></div>'; }).join("") + '</div>';
  else if (NR) h += rpNarrativeHtml(NR, rp);
  h += '<div class="rpStance ' + (rp.view.score >= 3 ? "good" : rp.view.score >= 1 ? "mid" : "low") + '"><div class="rpStL">내 생각</div><div><b>' + rpEsc(rp.view.stance) + '</b><div class="rpStT">' + rpEsc(V && V.opinion || rp.view.txt) + '</div><div class="rpWhy">근거: ' + rpEsc(rp.view.why.join(" · ")) + '</div></div></div>';
  if (rp.hz) h += '<div class="rpHz">' + [rp.hz.s, rp.hz.l].map(function (z) { return '<div class="rpHzC"><div class="rpHzL">' + rpEsc(z.label) + '</div><b>' + rpEsc(z.stance) + '</b><div class="rpHzT">' + rpEsc(z.txt) + '</div><ul>' + z.pts.map(function (x) { return '<li>' + rpEsc(x) + '</li>'; }).join("") + '</ul></div>'; }).join("") + '</div>';
  if (rp.exp) h += rpExpertHtml(rp.exp);
  h += '<div class="mkStep"><b>1</b>증거 <small class="briefDim">Exhibit ' + rp.exhibits.length + '개 · 모두 앱 데이터 계산값</small></div>' + rp.exhibits.map(rpExhibitHtml).join("");
  if (V && V.interpretation && V.interpretation.length) h += '<div class="rpAiBox"><b>AI 해석</b><ul>' + V.interpretation.map(function (x) { return '<li>' + rpEsc(x) + '</li>'; }).join("") + '</ul></div>';
  if (rp.scen.length) h += '<div class="mkStep"><b>2</b>앞으로 1년 <small class="briefDim">과거 비슷한 상황의 결과 분포 — 예측이 아니라 빈도</small></div><div class="rpScen">' + rp.scen.map(function (s) { return '<div class="rpScR"><span class="rpScP">' + Math.round(s.p * 100) + '%</span><div><b>' + rpEsc(s.name) + ' <small>' + rpEsc(s.range) + '</small></b><div class="briefDim">' + rpEsc(V && V.forecast && V.forecast[s.name] || s.txt) + '</div></div><span class="rpScBar"><i style="width:' + Math.round(s.p * 100) + '%"></i></span></div>'; }).join("") + '</div>';
  h += '<div class="mkStep"><b>3</b>그래서 어떻게</div><ol class="rpPlan">' + (V && V.plan && V.plan.length ? V.plan : rp.view.plan).map(function (p) { return '<li>' + rpEsc(p) + '</li>'; }).join("") + '</ol>';
  h += '<div class="mkStep"><b>4</b>생각을 바꿀 조건 <small class="briefDim">이게 바뀌면 결론도 바꾼다</small></div><ul class="rpWatch">' + (V && V.watch && V.watch.length ? V.watch : rp.watch).map(function (w) { return '<li>' + rpEsc(w) + '</li>'; }).join("") + '</ul>';
  if (ai && !ai.ok) h += '<div class="dvWarn" style="font-size:12px">AI 서술 실패: ' + rpEsc((typeof OC_REASON !== "undefined" && OC_REASON[ai.reason]) || ai.reason || "") + ' — 규칙 문장으로 보여줘요</div>';
  h += '<p class="mentalNote">' + rpEsc(rp.src) + ' · 이 페이지의 의견은 운영자의 판단 재료이며 투자 권유가 아니에요. 시나리오 확률은 과거 사례 빈도예요.</p>';
  pane.innerHTML = h;
  Array.prototype.forEach.call(pane.querySelectorAll("[data-rpa]"), function (b) { b.onclick = function () { rpAction(b.getAttribute("data-rpa"), b); }; });
}
function rpAction(a, btn) {
  var rp = RP.cur; if (!rp) return;
  if (a === "back") { RP.cur = null; renderReport(); return; }
  if (a === "save") { var rec = { id: rp.id + ":" + rp.made.slice(0, 10), made: rp.made, kind: rp.kind, sym: rp.sym, name: rp.name, title: rp.title, asOf: rp.asOf, price: rp.price, view: { stance: rp.view.stance, txt: rp.view.txt, score: rp.view.score }, scen: rp.scen.map(function (s) { return { name: s.name, p: s.p, range: s.range }; }), numbers: rp.numbers, thr: rp.thr, ex: rp.exhibits.map(function (e) { return { no: e.no, title: e.title, big: e.big }; }) }; RP.saved = RP.saved.filter(function (x) { return x.id !== rec.id; }); RP.saved.unshift(rec); rpSave(); btn.textContent = "저장됨 ✓"; return; }
  if (a === "thread") { var T = rpThreadSeries(rp), box = document.createElement("div"); box.innerHTML = '<div class="briefDim" style="margin-bottom:8px">본문 1개 + 번호 답글 — 참고한 연재 형식(1. 2. 3. …). 한 칸씩 복사해서 답글로 이어 올리세요.</div>' + T.map(function (t, i) { return '<div class="thrPart"><div class="thrLbl"><b>' + (i ? "답글 " + i : "본문") + '</b><span class="thrCnt">' + t.length + ' / 500자</span><button class="chip thrCopy">복사</button></div><textarea class="thrText" spellcheck="false">' + rpEsc(t) + '</textarea></div>'; }).join("") + '<div class="thrPart"><div class="thrLbl"><b>인스타 캡션</b><button class="chip thrCopy">복사</button></div><textarea class="thrText" spellcheck="false">' + rpEsc(rpCaption(rp)) + '</textarea></div>'; Array.prototype.forEach.call(box.querySelectorAll(".thrCopy"), function (b) { b.onclick = function () { chCopy(b.parentNode.nextSibling.value, b); }; }); infoModal.open("스레드 연재 · " + rp.title, box); return; }
  if (a === "deck") { var old = btn.textContent; btn.textContent = "만드는 중…"; hubFonts(function () { return rpDeck(rp); }).then(function (list) { btn.textContent = old; hubShow(rp.title, list, { note: "Exhibit 카드 덱 — 표지 · 증거 " + rp.exhibits.length + "장 · 시나리오 · 내 생각 · 마무리. 카드에는 숫자와 해석을, 의견은 '내 생각' 장에만.", thr: [] }); }).catch(function (e) { btn.textContent = old; alert("덱을 만들지 못했어요: " + e.message); }); return; }
  if (a === "ai") { var o2 = btn.textContent; btn.textContent = "AI 쓰는 중…"; btn.disabled = true; rpAiWrite(rp).then(function (j) { RP.ai = j; renderReport(); }).catch(function (e) { RP.ai = { ok: false, reason: e.message }; renderReport(); }); return; }
}
/* 오늘의 리포트 — 시장 상황으로 질문을 자동 고르고(점수), 하루 한 번 계산 · 상황이 바뀌면 다음 날 자동으로 다른 리포트 */
function rpTodayPicks() {
  var Q = rpQuestions(), R = typeof briefState !== "undefined" && briefState.result, now = typeof nbNow === "function" ? nbNow() : { match: {}, why: [] };
  var vix = R && (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0], v = vix ? parseFloat(vix.v) : 0, ks = typeof nbStat === "function" ? nbStat("^KS11") : null, sp = typeof nbStat === "function" ? nbStat("SPY") : null, dd = new Date(Date.now() + 9 * 3600e3).getUTCDate();
  Q.forEach(function (q) {
    var s = 1, why = [];
    if (q.kind === "market") { var st = q.sym === "^KS11" ? ks : sp; if (st && st.vsHi <= -0.2) { s += 4; why.push("약세장 구간(" + rpPct(st.vsHi, 0) + ")"); } else if (st && st.vsHi <= -0.1) { s += 3; why.push("조정 구간(" + rpPct(st.vsHi, 0) + ")"); } else if (st && st.vsHi >= -0.02) { s += 1; why.push("고점 근처 — '쫓아가도 되나'"); } if (v >= 25) { s += 2; why.push("VIX " + v.toFixed(0)); } if (q.sym === "^KS11") s += 0.5; }
    if (q.kind === "stock") { s += /지금 인기/.test(q.d) ? 2 : 1; if (/크게 빠짐/.test(q.d)) { s += 2; why.push("고점 대비 30% 이상 하락"); } else why.push("지금 가장 많이 찾는 종목"); }
    if (q.kind === "macro") { s += 3; why.push("지금 해당하는 매크로 조건"); }
    if (q.kind === "timing") { s += dd <= 5 ? 3 : dd >= 26 ? 2 : 0; why.push(dd <= 5 ? "월초" : dd >= 26 ? "월말 — 다음 달 미리보기" : "월중"); }
    if (now.why.length && (q.kind === "market" || q.kind === "macro")) { s += 1; why.push("국면 신호 " + now.why.length + "개"); }
    q.score = s; q.pickWhy = why.join(" · ") || q.why;
  });
  var out = [], kinds = {}; Q.sort(function (a, b) { return b.score - a.score; }).forEach(function (q) { if (out.length >= 4) return; kinds[q.kind] = (kinds[q.kind] || 0) + 1; if (kinds[q.kind] > 2) return; out.push(q); });
  return out;
}
function rpTodayRender(pane) {
  var day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), R = typeof briefState !== "undefined" && briefState.result;
  if (!R) { pane.innerHTML = '<div class="dvEmpty sm">시장 데이터를 불러오는 중… 잠시 뒤 다시 열어 주세요.</div>'; return; }
  var picks = rpTodayPicks(), ready = RP.today && RP.today.day === day && RP.today.list.length;
  var h = '<div class="briefDim" style="margin-bottom:8px">오늘 시장 신호(고점 대비 · VIX · 매크로 조건 · 인기 종목 · 월초/월말)로 질문 ' + picks.length + '개를 자동으로 골랐어요. 내일 시장이 바뀌면 질문도 바뀌어요.</div>';
  h += '<div class="hubList">' + picks.map(function (q, i) { var r = ready ? RP.today.list[i] : null; return '<div class="hubItem"><div class="hubRank">' + (i + 1) + '</div><div class="hubMain"><b>' + rpEsc(q.t) + '</b><small>' + rpEsc(q.d) + '</small><div class="hubWhy"><span>왜 오늘</span>' + rpEsc(q.pickWhy) + '</div>' + (r ? '<div class="rpTdV ' + (r.view.score >= 3 ? "good" : r.view.score >= 1 ? "mid" : "low") + '"><b>' + rpEsc(r.view.stance) + '</b>' + (r.hz ? ' · 단기 ' + rpEsc(r.hz.s.stance) + ' · 장기 ' + rpEsc(r.hz.l.stance) : '') + '<div>' + rpEsc(r.view.txt) + '</div></div>' : '') + '<div class="hubActs"><button class="chip" data-rpq="' + q.id + '" data-kind="' + q.kind + '" data-sym="' + (q.sym || "") + '" data-arg="' + (q.arg || "") + '">' + (r ? "자세히 보기" : "리포트 만들기") + '</button></div></div></div>'; }).join("") + '</div>';
  if (!ready) h += '<div class="row" style="gap:8px;margin-top:6px"><button class="primary" id="rpTodayAll">오늘의 리포트 ' + picks.length + '개 한 번에 계산</button><span class="briefDim">종목 과거 주가·투자지표를 받아 10~30초 걸려요</span></div>';
  pane.innerHTML = h;
  Array.prototype.forEach.call(pane.querySelectorAll("[data-rpq]"), function (b) { b.onclick = function () { rpGo({ id: b.getAttribute("data-rpq"), kind: b.getAttribute("data-kind"), sym: b.getAttribute("data-sym") || null, arg: b.getAttribute("data-arg") || null }, b); }; });
  var all = document.getElementById("rpTodayAll"); if (all) all.onclick = function () { all.disabled = true; all.textContent = "계산 중…"; Promise.all(picks.map(function (q) { return rpBuild(q).catch(function () { return null; }); })).then(function (L) { RP.today = { day: day, list: L.map(function (r, i) { return r || { view: { stance: "데이터 부족", txt: "", score: 0 } }; }) }; renderReport(); }); };
}
/* 회상 · 검증 */
function rpSavedRender(pane) {
  if (!RP.saved.length) { pane.innerHTML = '<div class="dvEmpty sm">저장한 리포트가 없어요. 리포트를 만들고 💾 저장을 누르면 여기에 쌓이고, 시간이 지난 뒤 자동으로 채점돼요.</div>'; return; }
  pane.innerHTML = '<div class="briefDim" style="margin-bottom:8px">그때 우리는 이렇게 봤다 → 실제로는. 20일이 지나야 채점하고, "검토·매수" 의견은 +3% 위면 적중, "관망" 의견은 +3% 아래면 적중으로 봐요.</div><div class="hubList" id="rpSavedList">' + RP.saved.map(function (s, i) { return '<div class="hubItem" data-i="' + i + '"><div class="hubMain"><b>' + rpEsc(s.title) + '</b><small>' + rpEsc(s.made.slice(0, 10)) + ' · 그때 ' + (s.price != null ? rpPrice(s.sym, s.price) : "-") + ' · <b>' + rpEsc(s.view.stance) + '</b></small><div class="rpVer briefDim">채점 중…</div><div class="hubActs"><button class="chip" data-rpopen="' + i + '">다시 열기</button><button class="chip" data-rpdel="' + i + '">삭제</button></div></div></div>'; }).join("") + '</div>';
  var score = { hit: 0, miss: 0 };
  RP.saved.forEach(function (s, i) { var el = pane.querySelector('[data-i="' + i + '"] .rpVer'); rpVerify(s).then(function (v) { if (!v) { el.textContent = s.sym ? "가격 데이터 없음" : "가격 추적 대상이 아닌 리포트(매크로)"; return; } if (v.hit === true) score.hit++; if (v.hit === false) score.miss++; el.innerHTML = '<b>' + v.days + '일 뒤</b> ' + rpPrice(s.sym, v.last) + ' (<b class="' + (v.since >= 0 ? "pos" : "neg") + '">' + rpPct(v.since, 1) + '</b>) · 그 사이 최저 ' + rpPct(v.lo, 0) + ' 최고 ' + rpPct(v.hi, 0) + ' · 흘러가는 시나리오 <b>' + v.playing + '</b>' + (v.hit == null ? ' · 채점은 20일 뒤' : v.hit ? ' · <span class="rbOk">적중 ✓</span>' : ' · <span class="rbNo">빗나감 ✗</span>') + (v.neutral ? ' <small>(중립 의견은 ±10% 안이면 적중)</small>' : '') + (s.scen && s.scen.length ? '<div class="briefDim">그때 시나리오: ' + s.scen.map(function (z) { return z.name + " " + Math.round(z.p * 100) + "%"; }).join(" · ") + '</div>' : ''); var sc = document.getElementById("rpScore"); if (sc) sc.textContent = "적중 " + score.hit + " · 빗나감 " + score.miss; }); });
  pane.insertAdjacentHTML("afterbegin", '<div class="kpiStrip"><div class="kpi"><div class="kl">저장한 리포트</div><div class="kv">' + RP.saved.length + '<small>개</small></div></div><div class="kpi"><div class="kl">채점 결과</div><div class="kv" id="rpScore" style="font-size:16px">계산 중</div></div></div>');
  Array.prototype.forEach.call(pane.querySelectorAll("[data-rpopen]"), function (b) { b.onclick = function () { var s = RP.saved[+b.getAttribute("data-rpopen")]; rpGo({ id: s.id.split(":").slice(0, 2).join(":"), kind: s.kind, sym: s.sym, arg: s.kind === "macro" ? s.id.split(":")[1] : null }, b); }; });
  Array.prototype.forEach.call(pane.querySelectorAll("[data-rpdel]"), function (b) { b.onclick = function () { if (!confirm("이 리포트 기록을 지울까요?")) return; RP.saved.splice(+b.getAttribute("data-rpdel"), 1); rpSave(); renderReport(); }; });
}
