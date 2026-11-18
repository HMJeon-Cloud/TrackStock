// v13.90 실적 팔로업 — 숫자 계산기 (AI가 아니라 코드가 계산한다)
//   입력: ① 분기 재무표(fin) — 1단계에서 재무 사이트의 분기 표를 그대로 옮겨 적은 JSON  ② 앱의 일별 종가(가격)  ③ 네이버 증권 재무표(있으면)
//   출력: 계산값(전년 대비 · 전분기 대비 · 이익률 · 재고일수 · 채권 회수일 · 남는 현금 · TTM EPS · PER/PS의 3년 위치 · 고점 대비 · 12개월 최대 낙폭 · 베타)
//         + 리포트에 그대로 들어가는 표 · 차트 + 글 쓰는 단계에 주는 '계산표' 글
//   옮겨 적은 숫자는 서로 맞는지 확인한다(매출 − 원가 = 총이익 등). 안 맞으면 표에 표시하고 그 항목 계산은 하지 않는다.
const num = (v) => { if (v == null || v === "") return null; if (typeof v === "number") return isFinite(v) ? v : null; const s = String(v).replace(/[,$%배x\s]/g, "").replace(/^\((.*)\)$/, "-$1"); if (!s || s === "-" || /^(n\/?a|미확인|null)$/i.test(s)) return null; const n = parseFloat(s); return isFinite(n) ? n : null; };
const pct = (a, b) => (a == null || b == null || b === 0 ? null : (a / Math.abs(b) - (b < 0 ? -1 : 1)) * 100);
const r1 = (v, d) => (v == null || !isFinite(v) ? null : +v.toFixed(d == null ? 1 : d));
const fmtN = (v, d) => (v == null ? "미확인" : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : (+v.toFixed(d == null ? (Math.abs(v) < 10 ? 2 : 1) : d)).toString());
const fmtP = (v, d) => (v == null ? "미확인" : (v > 0 ? "+" : "") + v.toFixed(d == null ? (Math.abs(v) < 10 ? 1 : 0) : d) + "%");
const ROWS = ["revenue", "cogs", "gross", "rd", "sga", "opex", "opinc", "netinc", "eps", "shares", "ar", "inventory", "cash", "debt", "equity", "cfo", "capex", "fcf", "sbc"];
const NAME = { revenue: "매출", cogs: "매출원가", gross: "매출총이익", rd: "연구개발비", sga: "판매 · 관리비", opex: "영업비용", opinc: "영업이익", netinc: "순이익", eps: "희석 EPS", shares: "희석 주식 수", ar: "매출채권", inventory: "재고", cash: "현금 · 단기투자", debt: "차입금", equity: "자본총계", cfo: "영업현금흐름", capex: "설비투자", fcf: "남는 현금(FCF)", sbc: "주식 보상" };

/* fin 다듬기 — 분기는 옛것 → 최근 순서로 맞추고 숫자로 바꾼다 */
export function cleanFin(fin) {
  if (!fin || typeof fin !== "object" || !Array.isArray(fin.q) || fin.q.length < 4) return null;
  let q = fin.q.map((x) => String(x).slice(0, 12)), rows = {}, end = Array.isArray(fin.end) ? fin.end.map((x) => String(x).slice(0, 10)) : [];
  const src = fin.rows && typeof fin.rows === "object" ? fin.rows : {};
  ROWS.forEach((k) => { const a = src[k]; if (Array.isArray(a) && a.length === q.length) { const v = a.map(num); if (v.filter((x) => x != null).length >= Math.min(4, q.length)) rows[k] = v; } });
  if (!rows.revenue) return null;
  /* v14.11 빈칸 메우기 — 다른 행으로 정확히 계산되는 값만 채운다(매출 = 원가 + 총이익, EPS = 순이익 ÷ 희석 주식 수, FCF = 영업현금 − 설비투자). 채운 칸은 filled에 적어 표 아래에 밝힌다 */
  const filled = [], blank = () => q.map(() => null), mU = /십억|B/i.test(String(fin.unit || "")) ? 1e9 : /천|K/i.test(String(fin.unit || "")) ? 1e3 : 1e6;
  const fill = (k, f, nm) => { let n = 0; const a = rows[k] || blank(); q.forEach((_, i) => { if (a[i] == null) { const v = f(i); if (v != null && isFinite(v)) { a[i] = v; n++; filled.push(nm + " " + q[i]); } } }); if (n || rows[k]) rows[k] = a; };
  const g = (k, i) => (rows[k] ? rows[k][i] : null);
  if (rows.cogs || rows.gross) { fill("gross", (i) => (g("revenue", i) != null && g("cogs", i) != null ? +(g("revenue", i) - g("cogs", i)).toFixed(1) : null), "매출총이익"); fill("cogs", (i) => (g("revenue", i) != null && g("gross", i) != null ? +(g("revenue", i) - g("gross", i)).toFixed(1) : null), "매출원가"); }
  if (rows.eps && rows.netinc && rows.shares) fill("eps", (i) => { if (g("netinc", i) == null || !(g("shares", i) > 0)) return null; const v = (g("netinc", i) * mU) / (g("shares", i) * 1e6); return Math.abs(v) < 1000 ? +v.toFixed(2) : null; }, "희석 EPS");
  if (rows.fcf && rows.cfo && rows.capex) fill("fcf", (i) => (g("cfo", i) != null && g("capex", i) != null ? +(g("cfo", i) - Math.abs(g("capex", i))).toFixed(1) : null), "FCF");
  /* 최근 → 옛것 순서로 왔으면 뒤집는다: 분기 끝 날짜로, 없으면 매출이 대체로 커지는 방향으로 */
  let rev = false; if (end.length === q.length && end[0] && end[end.length - 1]) rev = end[0] > end[end.length - 1]; else if (fin.order === "desc") rev = true;
  if (rev) { q = q.reverse(); end = end.reverse(); Object.keys(rows).forEach((k) => rows[k].reverse()); }
  const val = {}; const vs = fin.val && typeof fin.val === "object" ? fin.val : {};
  ["pe", "ps", "pfcf", "pb", "evs"].forEach((k) => { const a = vs[k]; if (Array.isArray(a) && a.length === q.length) { const v = a.map(num); if (rev) v.reverse(); if (v.filter((x) => x != null && x > 0).length >= 4) val[k] = v.map((x) => (x != null && x > 0 ? x : null)); } });
  const e = fin.est && typeof fin.est === "object" ? fin.est : {}, est = {}; ["fy", "revenue", "eps"].forEach((k) => { if (Array.isArray(e[k])) est[k] = k === "fy" ? e[k].map(String) : e[k].map(num); });
  /* v14.30 부문별 매출(분기) — 이름: 배열. 길이가 q와 같은 것만 */
  const seg = {}; if (fin.seg && typeof fin.seg === "object" && !Array.isArray(fin.seg)) Object.keys(fin.seg).slice(0, 8).forEach((k) => { const a = fin.seg[k]; if (Array.isArray(a) && a.length === q.length) { const v = a.map(num); if (rev) v.reverse(); if (v.filter((x) => x != null).length >= 4) seg[String(k).slice(0, 30)] = v; } });
  const tg = fin.targets && typeof fin.targets === "object" ? fin.targets : {};
  return { unit: String(fin.unit || "백만 달러").slice(0, 20), cur: String(fin.cur || "$").slice(0, 4), q, end: end.length === q.length ? end : [], rows, val, est: est.fy && est.fy.length ? est : null,
    targets: { avg: num(tg.avg), hi: num(tg.hi), lo: num(tg.lo), n: num(tg.n), asOf: String(tg.asOf || "").slice(0, 10), list: (Array.isArray(tg.list) ? tg.list : []).map((t) => ({ n: String((t && t.n) || "").slice(0, 40), px: num(t && t.px), note: String((t && t.note) || "").slice(0, 60) })).filter((t) => t.n && t.px > 0).slice(0, 14) },
    rating: fin.rating && typeof fin.rating === "object" ? { buy: num(fin.rating.buy), hold: num(fin.rating.hold), sell: num(fin.rating.sell), label: String(fin.rating.label || "").slice(0, 30) } : null,
    stats: fin.stats && typeof fin.stats === "object" ? { mcap: num(fin.stats.mcap), fpe: num(fin.stats.fpe), peg: num(fin.stats.peg), beta: num(fin.stats.beta) } : {},
    filled, seg: Object.keys(seg).length >= 2 ? seg : null,
    src: (Array.isArray(fin.src) ? fin.src : []).map((x) => String(x).slice(0, 80)).slice(0, 6), miss: (Array.isArray(fin.miss) ? fin.miss : []).map((x) => String(x).slice(0, 80)).slice(0, 8) };
}

/* 가격 통계 — 앱이 가진 일별 종가(c)와 날짜(t, 초) */
export function priceStats(hist, bench) {
  if (!hist || !Array.isArray(hist.c) || hist.c.length < 60) return null;
  const c = hist.c, t = hist.t || [], n = c.length, last = c[n - 1], d = (i) => (t[i] ? new Date(t[i] * 1000).toISOString().slice(0, 10) : "");
  let hi = 0, hiI = n - 1, lo = Infinity, loI = n - 1; for (let i = Math.max(0, n - 252); i < n; i++) { if (c[i] > hi) { hi = c[i]; hiI = i; } if (c[i] < lo) { lo = c[i]; loI = i; } }
  let pk = 0, mdd = 0, mddFrom = "", mddTo = "", pkI = 0; for (let i = Math.max(0, n - 252); i < n; i++) { if (c[i] > pk) { pk = c[i]; pkI = i; } const dd = c[i] / pk - 1; if (dd < mdd) { mdd = dd; mddFrom = d(pkI); mddTo = d(i); } }
  const ret = (k) => (n > k ? (last / c[n - 1 - k] - 1) * 100 : null);
  const out = { px: last, date: d(n - 1), hi, hiDate: d(hiI), lo, loDate: d(loI), gap: (last / hi - 1) * 100, mdd: mdd * 100, mddFrom, mddTo, r1m: ret(21), r3m: ret(63), r6m: ret(126), r1y: ret(252), r3y: ret(756) };
  /* 벤치마크 대비 베타 · 상관 (최근 1년 일간 수익률, 날짜를 맞춰서) */
  if (bench && Array.isArray(bench.c) && bench.t && t.length) {
    const bm = {}; bench.t.forEach((x, i) => { bm[Math.floor(x / 86400)] = bench.c[i]; }); const xs = [], ys = [];
    for (let i = Math.max(1, n - 252); i < n; i++) { const a = bm[Math.floor(t[i] / 86400)], b = bm[Math.floor(t[i - 1] / 86400)]; if (a && b && c[i - 1]) { xs.push(a / b - 1); ys.push(c[i] / c[i - 1] - 1); } }
    if (xs.length > 120) { const m = (a) => a.reduce((s, v) => s + v, 0) / a.length, mx = m(xs), my = m(ys); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } if (sxx > 0 && syy > 0) { out.beta = sxy / sxx; out.corr = sxy / Math.sqrt(sxx * syy); out.bench = bench.sym || ""; } }
  }
  /* 분기 끝 날짜의 종가 — 배수의 과거 위치를 직접 계산할 때 쓴다 */
  out.at = (ymd) => { if (!ymd || !t.length) return null; const ts = Date.parse(ymd + "T23:59:59Z") / 1000; let i = n - 1; while (i >= 0 && t[i] > ts) i--; return i >= 0 && ts - t[i] < 12 * 86400 ? c[i] : null; };
  return out;
}
const ttm = (a, i) => { if (i < 3) return null; let s = 0; for (let k = i - 3; k <= i; k++) { if (a[k] == null) return null; s += a[k]; } return s; };
function range(arr, cur) { const v = arr.filter((x) => x != null && x > 0 && isFinite(x)); if (v.length < 6) return null; const lo = Math.min(...v, cur != null ? cur : Infinity), hi = Math.max(...v, cur != null ? cur : -Infinity), avg = v.reduce((s, x) => s + x, 0) / v.length; return { lo, hi, avg, n: v.length, pct: cur != null ? (v.filter((x) => x < cur).length / v.length) * 100 : null }; }

/* 계산 본체 */
export function calcFacts(fin, px, naver) {
  const F = { ok: false, warn: [], tables: [], series: [], val: [], kv: {}, text: "" }, L = [];
  if (px) { F.px = { px: px.px, date: px.date, hi: px.hi, hiDate: px.hiDate, lo: px.lo, loDate: px.loDate, gap: r1(px.gap), mdd: r1(px.mdd), mddFrom: px.mddFrom, mddTo: px.mddTo, r1m: r1(px.r1m), r3m: r1(px.r3m), r6m: r1(px.r6m), r1y: r1(px.r1y), r3y: r1(px.r3y), beta: r1(px.beta, 2), corr: r1(px.corr, 2), bench: px.bench || "" };
    L.push("■ 가격 (앱 일별 종가, 코드 계산)", "종가 " + fmtN(px.px, 2) + " (" + px.date + ") · 52주 고점(종가) " + fmtN(px.hi, 2) + " (" + px.hiDate + ") 대비 " + fmtP(px.gap, 1) + " · 52주 저점 " + fmtN(px.lo, 2) + " (" + px.loDate + ")", "최근 12개월 최대 낙폭 " + fmtP(px.mdd, 1) + (px.mddFrom ? " (" + px.mddFrom + " → " + px.mddTo + ")" : "") + " · 수익률 1개월 " + fmtP(px.r1m) + " / 3개월 " + fmtP(px.r3m) + " / 6개월 " + fmtP(px.r6m) + " / 1년 " + fmtP(px.r1y) + (px.beta != null ? " · " + (px.bench || "시장") + " 대비 베타 " + px.beta.toFixed(2) + " · 상관계수 " + px.corr.toFixed(2) + " (최근 1년 일간)" : "")); }
  if (!fin) { if (naver) L.push("", naver); F.text = L.join("\n"); return F; }
  const R = fin.rows, q = fin.q, n = q.length, i0 = n - 1, U = fin.unit, has = (k) => !!R[k];
  /* 옮겨 적은 숫자끼리 맞는지 확인 */
  if (has("cogs") && has("gross")) { let bad = 0; for (let i = 0; i < n; i++) if (R.revenue[i] != null && R.cogs[i] != null && R.gross[i] != null && Math.abs(R.revenue[i] - R.cogs[i] - R.gross[i]) > Math.abs(R.revenue[i]) * 0.012) bad++; if (bad) { F.warn.push("매출 − 원가 ≠ 총이익인 분기 " + bad + "개 — 총이익률은 사이트 표의 총이익으로 계산"); } }
  else if (has("cogs") && !has("gross")) R.gross = R.revenue.map((v, i) => (v != null && R.cogs[i] != null ? v - R.cogs[i] : null));
  if (!has("fcf") && has("cfo") && has("capex")) R.fcf = R.cfo.map((v, i) => (v != null && R.capex[i] != null ? v - Math.abs(R.capex[i]) : null));
  if (!has("opex") && has("gross") && has("opinc")) R.opex = R.gross.map((v, i) => (v != null && R.opinc[i] != null ? v - R.opinc[i] : null));
  const D = {};   // 파생 지표
  const ratio = (a, b, m) => (R[a] && R[b] ? R[a].map((v, i) => (v != null && R[b][i] ? (v / R[b][i]) * (m || 100) : null)) : null);
  D.gm = ratio("gross", "revenue"); D.opm = ratio("opinc", "revenue"); D.npm = ratio("netinc", "revenue"); D.fcfm = ratio("fcf", "revenue"); D.sbcr = ratio("sbc", "revenue"); D.opexr = ratio("opex", "revenue");
  D.dso = ratio("ar", "revenue", 91); D.dio = ratio("inventory", "cogs", 91);
  const yoy = (a) => (a ? a.map((v, i) => (i >= 4 ? pct(v, a[i - 4]) : null)) : null), qoq = (a) => (a ? a.map((v, i) => (i >= 1 ? pct(v, a[i - 1]) : null)) : null);
  D.revY = yoy(R.revenue); D.revQ = qoq(R.revenue); D.opY = yoy(R.opinc); D.niY = yoy(R.netinc); D.epsY = yoy(R.eps); D.opexY = yoy(R.opex); D.cogsY = yoy(R.cogs); D.fcfY = yoy(R.fcf); D.invY = yoy(R.inventory); D.arY = yoy(R.ar);
  const epsT = R.eps ? R.eps.map((_, i) => ttm(R.eps, i)) : null, revT = R.revenue.map((_, i) => ttm(R.revenue, i)), fcfT = R.fcf ? R.fcf.map((_, i) => ttm(R.fcf, i)) : null, niT = R.netinc ? R.netinc.map((_, i) => ttm(R.netinc, i)) : null;
  F.ok = true; F.q = q; F.unit = U; const last = (a) => (a ? a[i0] : null), prev = (a) => (a ? a[i0 - 1] : null), ya = (a) => (a && i0 >= 4 ? a[i0 - 4] : null);
  const K = F.kv; K.quarter = q[i0]; K.rev = last(R.revenue); K.revY = r1(last(D.revY)); K.revQ = r1(last(D.revQ)); K.gm = r1(last(D.gm)); K.opm = r1(last(D.opm)); K.npm = r1(last(D.npm)); K.eps = last(R.eps); K.epsY = r1(last(D.epsY)); K.epsTtm = r1(last(epsT), 2); K.fcf = last(R.fcf); K.fcfm = r1(last(D.fcfm)); K.dso = r1(last(D.dso), 0); K.dio = r1(last(D.dio), 0); K.sbcr = r1(last(D.sbcr));
  K.netCash = last(R.cash) != null ? last(R.cash) - (last(R.debt) || 0) : null;
  /* 영업 레버리지: 매출 증가율 vs 영업비용 증가율 */
  K.lev = last(D.revY) != null && last(D.opexY) != null ? r1(last(D.revY) - last(D.opexY)) : null;
  /* 시가총액 · 배수 — 가격은 앱, 이익은 옮겨 적은 표 */
  const sh = last(R.shares); const mult = /십억|B/i.test(U) ? 1e9 : /천|K/i.test(U) ? 1e3 : 1e6;   // shares 는 백만 주로 받는다
  if (px && sh) { K.mcap = px.px * sh * 1e6; K.pe = K.epsTtm > 0 ? r1(px.px / K.epsTtm) : null; K.ps = last(revT) ? r1((px.px * sh * 1e6) / (last(revT) * mult)) : null; K.fcfy = last(fcfT) ? r1(((last(fcfT) * mult) / (px.px * sh * 1e6)) * 100, 2) : null; }
  else if (px && K.epsTtm > 0) K.pe = r1(px.px / K.epsTtm);
  /* 배수의 3년 위치: ① 사이트의 분기별 배수 표가 있으면 그것으로  ② 없으면 분기 끝 종가 ÷ 그때의 TTM EPS로 직접 계산 */
  const hist = (key, selfArr) => { let a = fin.val[key]; let how = "사이트 분기 표"; if (!a && selfArr) { a = selfArr; how = "분기 끝 종가로 계산"; } if (!a) return null; return { a: a.slice(-12), how }; };
  const selfPe = px && px.at && epsT && fin.end.length ? fin.end.map((e, i) => { const p = px.at(e); return p && epsT[i] > 0 ? p / epsT[i] : null; }) : null;
  const selfPs = px && px.at && sh && fin.end.length ? fin.end.map((e, i) => { const p = px.at(e), s = R.shares[i] || sh; return p && revT[i] ? (p * s * 1e6) / (revT[i] * mult) : null; }) : null;
  const addVal = (k, label, cur, h, lowGood) => { if (cur == null || !h) return; const rg = range(h.a, cur); F.val.push({ k: label, v: r1(cur), unit: k === "fcfy" ? "%" : "배", lo: rg ? r1(rg.lo) : null, avg: rg ? r1(rg.avg) : null, hi: rg ? r1(rg.hi) : null, pct: rg && rg.pct != null ? Math.round(rg.pct) : null, lowGood, calc: 1, how: h.how + (rg ? " · " + rg.n + "분기" : "") }); };
  addVal("pe", "TTM PER", K.pe, hist("pe", selfPe), true); addVal("ps", "P/S (매출 대비)", K.ps, hist("ps", selfPs), true);
  if (K.fcfy != null && fin.val.pfcf) addVal("fcfy", "FCF 수익률", K.fcfy, { a: fin.val.pfcf.map((x) => (x ? 100 / x : null)).slice(-12), how: "사이트 분기 표" }, false);
  const vPe = F.val.find((v) => v.k === "TTM PER"); if (vPe && vPe.avg && K.epsTtm > 0) K.peAvgPx = r1(vPe.avg * K.epsTtm, 2);
  /* ---------- v14.10 실적 품질 점검 · 주가 변화 분해 (전부 코드 계산 — 숫자 뒤에 숨은 것을 본다) ---------- */
  F.checks = []; const CK = (nn, v, t, state) => F.checks.push({ n: nn, v, t, state });
  const fT = last(fcfT), nT = last(niT);
  if (fT != null && nT != null && nT > 0) { const c = (fT / nT) * 100; CK("이익의 현금 전환", Math.round(c) + "%", "최근 4분기 FCF ÷ 순이익 — " + (c >= 90 ? "번 이익이 거의 다 현금으로 들어왔어요" : c >= 60 ? "이익의 일부가 아직 현금으로 안 들어왔어요" : "이익에 비해 들어온 현금이 적어요"), c >= 90 ? "good" : c >= 60 ? "warn" : "bad"); }
  if (last(D.arY) != null && last(D.revY) != null) { const g = last(D.arY) - last(D.revY); CK("외상(매출채권) 증가", fmtP(last(D.arY)), "매출 " + fmtP(last(D.revY)) + "와 비교 — " + (g > 25 ? "외상이 매출보다 훨씬 빨리 늘었어요" : g > 10 ? "외상이 매출보다 빨리 늘었어요" : "매출과 비슷하거나 느리게 늘었어요"), g > 25 ? "bad" : g > 10 ? "warn" : "good"); }
  if (last(D.invY) != null && last(D.cogsY) != null) { const g = last(D.invY) - last(D.cogsY); CK("재고 증가", fmtP(last(D.invY)), "매출원가 " + fmtP(last(D.cogsY)) + "와 비교 — " + (g > 25 ? "재고가 팔리는 속도보다 훨씬 빨리 쌓였어요" : g > 10 ? "재고가 조금 빨리 쌓였어요" : "팔리는 속도와 비슷해요"), g > 25 ? "bad" : g > 10 ? "warn" : "good"); }
  if (K.lev != null) CK("영업 레버리지", fmtP(K.lev) + "p", "매출 증가율 − 영업비용 증가율 — " + (K.lev > 0 ? "매출이 비용보다 빨리 늘어 이익률이 넓어지는 구조예요" : K.lev > -5 ? "비용이 매출과 비슷하게 늘었어요" : "비용이 매출보다 빨리 늘었어요"), K.lev > 0 ? "good" : K.lev > -5 ? "warn" : "bad");
  if (last(D.gm) != null && ya(D.gm) != null) { const g = last(D.gm) - ya(D.gm); CK("총이익률 방향", (g > 0 ? "+" : "") + g.toFixed(1) + "%p", "1년 전 " + ya(D.gm).toFixed(1) + "% → 지금 " + last(D.gm).toFixed(1) + "% — " + (g >= -0.5 ? "가격 결정력이 유지됐어요" : g >= -2 ? "조금 내려왔어요" : "뚜렷하게 내려왔어요"), g >= -0.5 ? "good" : g >= -2 ? "warn" : "bad"); }
  if (K.sbcr != null) { const shY = R.shares && i0 >= 4 ? pct(R.shares[i0], R.shares[i0 - 4]) : null; CK("주식 보상 · 희석", K.sbcr + "%", "주식 보상 ÷ 매출" + (shY != null ? " · 주식 수 1년 " + fmtP(shY, 1) : "") + " — " + (K.sbcr < 5 && !(shY > 2) ? "주주 몫이 묽어지는 정도가 작아요" : K.sbcr < 15 ? "주주 몫이 조금씩 묽어지고 있어요" : "보상 비중이 커서 실제 이익은 더 작게 봐야 해요"), K.sbcr < 5 && !(shY > 2) ? "good" : K.sbcr < 15 ? "warn" : "bad"); }
  if (K.netCash != null) { const yrs = K.netCash < 0 && fT > 0 ? -K.netCash / fT : null; CK("재무 체력", K.netCash >= 0 ? "순현금" : "순차입", (K.netCash >= 0 ? "현금이 빚보다 " + fmtN(K.netCash) + " " + U + " 많아요" : "빚이 현금보다 " + fmtN(-K.netCash) + " " + U + " 많아요" + (yrs != null ? " — 지금 FCF로 " + yrs.toFixed(1) + "년 치" : "")), K.netCash >= 0 ? "good" : yrs != null && yrs <= 3 ? "warn" : "bad"); }
  F.decomp = null;
  if (px && px.at && epsT && fin.end.length === n && i0 >= 7 && epsT[i0] > 0 && epsT[i0 - 4] > 0) { const p1 = px.at(fin.end[i0]), p0 = px.at(fin.end[i0 - 4]);
    if (p1 && p0) { const pe1 = p1 / epsT[i0], pe0 = p0 / epsT[i0 - 4], dp = (p1 / p0 - 1) * 100, de = (epsT[i0] / epsT[i0 - 4] - 1) * 100, dm = (pe1 / pe0 - 1) * 100;
      const read = de > 0 && dm < 0 ? "이익은 늘었는데 몸값(배수)은 내려왔어요. 주가보다 이익이 더 빨리 자란 구간이에요." : de > 0 && dm >= 0 ? (de >= dm ? "주가 변화의 더 큰 부분이 이익 증가에서 왔어요." : "이익도 늘었지만 몸값(배수)이 더 많이 올랐어요. 기대가 먼저 반영된 구간이에요.") : de <= 0 && dm > 0 ? "이익은 줄었는데 몸값(배수)이 올랐어요. 주가가 기대만으로 버틴 구간이에요." : "이익과 몸값(배수)이 함께 내려왔어요.";
      F.decomp = { from: q[i0 - 4], to: q[i0], px: r1(dp), eps: r1(de), mult: r1(dm), pe0: r1(pe0), pe1: r1(pe1), read }; } }
  /* ---------- 표 ---------- */
  if (fin.filled && fin.filled.length) F.fillNote = "빈칸 " + fin.filled.length + "곳은 다른 행으로 계산해 채웠어요: " + fin.filled.slice(0, 6).join(", ") + (fin.filled.length > 6 ? " 외" : "");
  const m8 = Math.min(8, n), idx = Array.from({ length: m8 }, (_, k) => n - m8 + k), cols8 = ["항목"].concat(idx.map((i) => q[i]));
  const row = (label, a, f) => [label].concat(idx.map((i) => (a ? f(a[i]) : "미확인")));
  const T1 = [row("매출", R.revenue, fmtN), row("  전년 대비", D.revY, fmtP), row("  전분기 대비", D.revQ, fmtP)];
  if (D.gm) T1.push(row("매출총이익률", D.gm, (v) => (v == null ? "미확인" : v.toFixed(1) + "%")));
  if (R.opinc) T1.push(row("영업이익", R.opinc, fmtN), row("  영업이익률", D.opm, (v) => (v == null ? "미확인" : v.toFixed(1) + "%")), row("  전년 대비", D.opY, fmtP));
  if (R.netinc) T1.push(row("순이익", R.netinc, fmtN));
  if (R.eps) T1.push(row("희석 EPS (" + fin.cur + ")", R.eps, (v) => fmtN(v, 2)), row("  전년 대비", D.epsY, fmtP));
  F.tables.push({ t: "분기 손익 흐름 (최근 " + m8 + "분기)", unit: U, cols: cols8, rows: T1, note: "자료: " + (fin.src[0] || "분기 재무표") + " · 증감률 · 이익률은 앱 계산" + (F.warn.length ? " · " + F.warn[0] : "") + (F.fillNote ? " · " + F.fillNote : ""), calc: 1 });
  if (R.cogs || R.rd || R.sga) { const T2 = []; const cr = (label, k) => { if (R[k]) T2.push(row(label, R[k], fmtN), row("  매출 대비", ratio(k, "revenue"), (v) => (v == null ? "미확인" : v.toFixed(1) + "%"))); }; cr("매출원가", "cogs"); cr("연구개발비", "rd"); cr("판매 · 관리비", "sga"); if (R.sbc) cr("주식 보상", "sbc");
    F.tables.push({ t: "비용 구조 — 매출 대비 비중", unit: U, cols: cols8, rows: T2, note: "매출이 늘 때 비용 비중이 내려가면 규모의 효과(영업 레버리지)가 나는 것" + (K.lev != null ? " · 최근 분기 매출 증가율 − 영업비용 증가율 = " + fmtP(K.lev) + "p" : ""), calc: 1 }); }
  if (R.fcf || R.ar || R.inventory || R.cash) { const T3 = []; if (R.cfo) T3.push(row("영업현금흐름", R.cfo, fmtN)); if (R.fcf) T3.push(row("남는 현금(FCF)", R.fcf, fmtN), row("  FCF ÷ 매출", D.fcfm, (v) => (v == null ? "미확인" : v.toFixed(0) + "%"))); if (R.ar) T3.push(row("매출채권", R.ar, fmtN), row("  회수일(DSO)", D.dso, (v) => (v == null ? "미확인" : Math.round(v) + "일"))); if (R.inventory) T3.push(row("재고", R.inventory, fmtN)); if (D.dio) T3.push(row("  재고일수", D.dio, (v) => (v == null ? "미확인" : Math.round(v) + "일"))); if (R.cash) T3.push(row("현금 · 단기투자", R.cash, fmtN)); if (R.debt) T3.push(row("차입금", R.debt, fmtN));
    F.tables.push({ t: "현금과 재무 체력", unit: U, cols: cols8, rows: T3, note: "회수일(DSO) = 매출채권 ÷ 분기 매출 × 91 · 재고일수 = 재고 ÷ 분기 매출원가 × 91 (앱 계산) · 분기 현금흐름은 사이트의 분기 표 기준", calc: 1 }); }
  /* ---------- 차트 ---------- */
  const m12 = Math.min(12, n), ix = Array.from({ length: m12 }, (_, k) => n - m12 + k), pick = (a) => { let k = 0; while (k < ix.length && a[ix[k]] == null) k++; return ix.slice(k); },   // 앞쪽의 빈 분기는 그리지 않는다(0으로 보이지 않게)
    mk = (nm, unit, a, d) => { const jx = pick(a); return { n: nm, unit, x: jx.map((i) => q[i]), y: jx.map((i) => (a[i] == null ? 0 : +a[i].toFixed(d == null ? 1 : d))), calc: 1 }; },
    S = (nm, unit, a, d) => { if (a && ix.filter((i) => a[i] != null).length >= 4) F.series.push(mk(nm, unit, a, d)); };
  S("분기 매출", U, R.revenue, 0); S("영업이익률", "%", D.opm); S("매출 전년 대비", "%", D.revY); if (R.fcf) S("남는 현금(FCF)", U, R.fcf, 0); else S("매출총이익률", "%", D.gm);
  F.extra = []; const X = (nm, unit, a, d) => { if (a && ix.filter((i) => a[i] != null).length >= 4) F.extra.push(mk(nm, unit, a, d)); };
  X("매출총이익률", "%", D.gm); X("재고일수", "일", D.dio, 0); X("매출채권 회수일(DSO)", "일", D.dso, 0); X("희석 EPS", fin.cur, R.eps, 2);
  /* ---------- 글 쓰는 단계에 주는 계산표 ---------- */
  const line = (label, a, f, k) => label + " | " + ix.slice(-(k || 8)).map((i) => (a ? f(a[i]) : "미확인")).join(" | ");
  L.push("", "■ 분기 재무 (" + U + " · 출처: " + (fin.src.join(", ") || "분기 재무표") + " · 아래 증감률 · 비율 · 일수는 코드 계산)", "분기 | " + ix.slice(-8).map((i) => q[i]).join(" | "));
  ROWS.forEach((k) => { if (R[k]) L.push(line(NAME[k], R[k], (v) => fmtN(v, k === "eps" ? 2 : undefined))); });
  L.push(line("매출 전년 대비", D.revY, fmtP), line("매출 전분기 대비", D.revQ, fmtP));
  [["매출총이익률", D.gm], ["영업이익률", D.opm], ["순이익률", D.npm], ["FCF ÷ 매출", D.fcfm], ["주식 보상 ÷ 매출", D.sbcr], ["영업비용 ÷ 매출", D.opexr]].forEach((x) => { if (x[1]) L.push(line(x[0], x[1], (v) => (v == null ? "미확인" : v.toFixed(1) + "%"))); });
  [["영업이익 전년 대비", D.opY], ["EPS 전년 대비", D.epsY], ["영업비용 전년 대비", D.opexY], ["매출원가 전년 대비", D.cogsY], ["재고 전년 대비", D.invY], ["매출채권 전년 대비", D.arY]].forEach((x) => { if (x[1]) L.push(line(x[0], x[1], fmtP)); });
  if (D.dso) L.push(line("매출채권 회수일(DSO, 일)", D.dso, (v) => (v == null ? "미확인" : String(Math.round(v))))); if (D.dio) L.push(line("재고일수(일)", D.dio, (v) => (v == null ? "미확인" : String(Math.round(v)))));
  L.push("", "■ 최근 분기 " + q[i0] + " 한눈에 (코드 계산)", "매출 " + fmtN(K.rev) + " (전년 대비 " + fmtP(K.revY) + ", 전분기 대비 " + fmtP(K.revQ) + ") · 총이익률 " + (K.gm ?? "미확인") + "% (전분기 " + (r1(prev(D.gm)) ?? "미확인") + "%, 1년 전 " + (r1(ya(D.gm)) ?? "미확인") + "%) · 영업이익률 " + (K.opm ?? "미확인") + "% (1년 전 " + (r1(ya(D.opm)) ?? "미확인") + "%)",
    "희석 EPS " + fmtN(K.eps, 2) + " (전년 대비 " + fmtP(K.epsY) + ") · 최근 4분기 합(TTM) EPS " + (K.epsTtm ?? "미확인") + (K.lev != null ? " · 매출 증가율 − 영업비용 증가율 = " + fmtP(K.lev) + "p (플러스면 영업 레버리지)" : ""),
    (K.fcf != null ? "FCF " + fmtN(K.fcf) + " (매출의 " + K.fcfm + "%, 전분기 " + fmtN(prev(R.fcf)) + ")" : "FCF 미확인") + (K.dso != null ? " · DSO " + K.dso + "일 (전분기 " + (prev(D.dso) != null ? r1(prev(D.dso), 0) + "일" : "미확인") + ")" : "") + (K.dio != null ? " · 재고일수 " + K.dio + "일 (전분기 " + (prev(D.dio) != null ? r1(prev(D.dio), 0) + "일" : "미확인") + ")" : "") + (K.netCash != null ? " · 순현금 " + fmtN(K.netCash) : ""));
  if (px) L.push("", "■ 밸류에이션 (가격은 앱 종가 " + fmtN(px.px, 2) + ", 코드 계산)", (K.mcap ? "시가총액 약 " + fmtN(K.mcap / 1e9, 1) + "십억 " + (fin.cur === "$" ? "달러" : "") + " · " : "") + (K.pe != null ? "TTM PER " + K.pe + "배" : "TTM PER 미확인") + (K.ps != null ? " · P/S " + K.ps + "배" : "") + (K.fcfy != null ? " · FCF 수익률 " + K.fcfy + "%" : ""));
  F.val.forEach((v) => L.push(v.k + ": 지금 " + v.v + v.unit + (v.lo != null ? " · 최근 " + v.how.replace(/.*· /, "") + " 범위 " + v.lo + "~" + v.hi + ", 평균 " + v.avg + " · " + "낮은 쪽에서 " + v.pct + "% 자리" + (v.lowGood ? "(낮을수록 쌈)" : "(높을수록 쌈)") : " · 과거 범위 미확인") + " (" + v.how + ")"));
  if (K.peAvgPx) L.push("TTM PER이 평균 배수로 돌아가면 주가 " + fmtN(K.peAvgPx, 2) + " (지금 대비 " + fmtP((K.peAvgPx / px.px - 1) * 100) + ") — 단순 계산이며 목표가가 아님");
  if (F.checks.length) L.push("", "■ 실적 품질 점검 (코드 계산 — 본문 · 리스크 · 인사이트의 근거로 쓸 것)", ...F.checks.map((c) => c.n + ": " + c.v + " — " + c.t + " [" + (c.state === "good" ? "양호" : c.state === "warn" ? "주의" : "경고") + "]"));
  if (F.decomp) L.push("", "■ 주가 변화 분해 (" + F.decomp.from + " 분기 말 → " + F.decomp.to + " 분기 말, 코드 계산)", "주가 " + fmtP(F.decomp.px) + " = TTM EPS " + fmtP(F.decomp.eps) + " × TTM PER " + fmtP(F.decomp.mult) + " (" + F.decomp.pe0 + "배 → " + F.decomp.pe1 + "배) — " + F.decomp.read);
  if (fin.est) L.push("", "■ 시장 예상(컨센서스) — " + (fin.src[1] || fin.src[0] || "사이트"), "회계연도 | " + fin.est.fy.join(" | "), fin.est.revenue ? "매출 예상 | " + fin.est.revenue.map((v) => fmtN(v)).join(" | ") : "", fin.est.eps ? "EPS 예상 | " + fin.est.eps.map((v) => fmtN(v, 2)).join(" | ") + (px ? "  → 선행 PER " + fin.est.eps.map((v) => (v > 0 ? (px.px / v).toFixed(1) + "배" : "–")).join(" | ") + " (앱 종가 기준 계산)" : "") : "");
  if (fin.targets.avg || fin.targets.list.length) L.push("", "■ 증권사 목표가" + (fin.targets.asOf ? " (" + fin.targets.asOf + ")" : ""), (fin.targets.avg ? "평균 " + fmtN(fin.targets.avg, 2) + (px ? " (앱 종가 대비 " + fmtP((fin.targets.avg / px.px - 1) * 100) + ")" : "") : "") + (fin.targets.n ? " · " + fin.targets.n + "명" : "") + (fin.targets.hi ? " · 최고 " + fin.targets.hi + " / 최저 " + fin.targets.lo : "") + (fin.rating ? " · 의견 매수 " + (fin.rating.buy ?? "?") + " / 보유 " + (fin.rating.hold ?? "?") + " / 매도 " + (fin.rating.sell ?? "?") : ""), fin.targets.list.map((t) => t.n + " " + t.px + (t.note ? "(" + t.note + ")" : "")).join(" · "));
  if (fin.miss.length) L.push("", "■ 1단계에서 찾지 못한 것: " + fin.miss.join(" · "));
  if (F.warn.length) L.push("", "■ 주의: " + F.warn.join(" · "));
  if (naver) L.push("", naver);
  F.text = L.filter((x) => x !== "").join("\n").replace(/\n■/g, "\n\n■");
  return F;
}

/* 네이버 증권 재무표(/api/fund 응답)를 글로 — 행 이름을 가정하지 않고 있는 그대로 옮긴다 */
export function naverText(d) {
  if (!d || !d.ok) return ""; const L = [], I = d.info || {}, g = (k) => (I[k] && I[k].value != null ? String(I[k].value) : null);
  const info = [["per", "PER"], ["cnsPer", "예상 PER"], ["eps", "EPS"], ["cnsEps", "예상 EPS"], ["pbr", "PBR"], ["roe", "ROE"], ["marketValue", "시가총액"], ["dividendYieldRatio", "배당수익률"], ["highPriceOf52Weeks", "52주 최고"], ["lowPriceOf52Weeks", "52주 최저"]].map((x) => (g(x[0]) ? x[1] + " " + g(x[0]) : "")).filter(Boolean);
  if (info.length) L.push("지표: " + info.join(" · "));
  ["quarter", "annual"].forEach((p) => { const f = d.finance && d.finance[p]; if (!f || !f.periods || !f.rows || !f.rows.length) return; const ps = f.periods.slice(-7);
    L.push((p === "quarter" ? "분기" : "연간") + " | " + ps.map((x) => x.title + (x.forecast ? "(예상)" : "")).join(" | ")); f.rows.slice(0, 16).forEach((r) => { const v = ps.map((x) => (r.values[x.key] == null ? "–" : String(r.values[x.key]))); if (v.some((x) => x !== "–")) L.push(r.title + " | " + v.join(" | ")); }); });
  const c = d.consensus; if (c && typeof c === "object") { const t = c.priceTargetMean || c.targetPrice || c.priceTarget, r = c.recommMean || c.recommendation; if (t || r) L.push("컨센서스: " + (t ? "목표가 평균 " + t : "") + (r ? " · 투자의견 점수 " + r : "")); }
  return L.length ? "■ 네이버 증권 재무표 (참고 — 위 분기 재무와 다르면 위쪽이 우선)\n" + L.join("\n") : "";
}
