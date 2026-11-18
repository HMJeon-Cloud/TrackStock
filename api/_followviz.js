/* v14.30 실적 팔로업 '그림 자료' 계산 — 전부 코드 계산(AI가 쓴 숫자 없음)
   입력: 다듬은 분기 재무표(cleanFin) · 일별 종가(hist) · 벤치마크(bench)
   출력 V: 화면과 슬라이드가 그대로 그리는 배열들
     gauge  배수의 3년 위치(월말 기준) — TTM PER · 선행 PER · P/S · PBR · FCF 수익률 · PEG
     band   밸류 밴드 — 과거 배수(최저 · −1σ · 평균 · +1σ · 최고) × 그때의 이익(순자산)
     pe     주가 vs TTM EPS, TTM PER 흐름
     stack  부문별 매출(분기) · margin 이익률 · inv 재고/회수일 · tiles 작은 추이 8칸
     bridge 영업이익 다리(전년 동기 → 이번 분기) · flow 이번 분기 손익 흐름 · rank 전년 대비 증가율 순위
     rel    벤치마크 대비 월 초과수익 · 상관 · 베타 · sens 민감도
   api 함수 파일이 아니다(밑줄 파일). */
const r1 = (v, d) => (v == null || !isFinite(v) ? null : +v.toFixed(d == null ? 1 : d));
const sum = (a) => a.reduce((s, v) => s + v, 0), mean = (a) => (a.length ? sum(a) / a.length : null);
const sd = (a) => { if (a.length < 3) return null; const m = mean(a); return Math.sqrt(sum(a.map((v) => (v - m) ** 2)) / (a.length - 1)); };
const pct = (a, b) => (a != null && b != null && b > 0 ? (a / b - 1) * 100 : null);
const ttm = (a, i) => { if (!a || i < 3) return null; let s = 0; for (let k = i - 3; k <= i; k++) { if (a[k] == null) return null; s += a[k]; } return s; };
const qParse = (s) => { s = String(s || ""); let m = s.match(/Q([1-4])\D{0,4}(\d{4})/i) || s.match(/(\d{4})\D{0,4}Q([1-4])/i); if (m) return /^Q/i.test(m[0]) ? { qn: +m[1], fy: +m[2] } : { qn: +m[2], fy: +m[1] }; m = s.match(/FY\s?'?(\d{2})\D{0,3}Q([1-4])/i) || s.match(/Q([1-4])\D{0,3}FY\s?'?(\d{2})/i); if (m) return /^FY/i.test(m[0]) ? { fy: 2000 + +m[1], qn: +m[2] } : { qn: +m[1], fy: 2000 + +m[2] }; m = s.match(/([1-4])Q\s?'?(\d{2})\b/i); if (m) return { qn: +m[1], fy: 2000 + +m[2] }; return null; };
const fyOf = (s) => { const m = String(s || "").match(/(\d{4})/) || String(s || "").match(/(\d{2})\b/); return m ? (m[1].length === 2 ? 2000 + +m[1] : +m[1]) : null; };
export const qShort = (s) => { const p = qParse(s); return p ? String(p.fy).slice(2) + "Q" + p.qn : String(s || "").slice(0, 7); };

/* 월말 종가(마지막 달은 가장 최근 종가) */
function monthEnds(hist, n) {
  if (!hist || !Array.isArray(hist.c) || !Array.isArray(hist.t)) return [];
  const out = []; let cur = "";
  for (let i = 0; i < hist.c.length; i++) { if (hist.c[i] == null) continue; const m = new Date(hist.t[i] * 1000).toISOString().slice(0, 7); if (m === cur) { out[out.length - 1].p = hist.c[i]; out[out.length - 1].ts = hist.t[i]; } else { out.push({ m, p: hist.c[i], ts: hist.t[i] }); cur = m; } }
  return out.slice(-(n || 37));
}
const zone = (cur, hs, lowGood) => {   // hs: 지금을 뺀 과거 값
  if (cur == null || hs.length < 6) return null; const lo = Math.min(...hs), hi = Math.max(...hs), below = hs.filter((v) => v < cur).length / hs.length * 100;
  const cheapSide = lowGood ? below <= 30 : below >= 70, dearSide = lowGood ? below >= 70 : below <= 30;
  const pos = cur < lo ? "3년 최저 아래" : cur > hi ? "3년 최고 위" : (below <= 50 ? "하위 " + Math.max(1, Math.round(below)) + "%" : "상위 " + Math.max(1, Math.round(100 - below)) + "%");
  return { lo: r1(lo, 2), hi: r1(hi, 2), avg: r1(mean(hs), 2), pct: Math.round(below), pos, side: cheapSide ? "cheap" : dearSide ? "dear" : "mid" };
};

export function vizFacts(fin, hist, bench, benchName) {
  const V = { ok: false }; if (!fin || !fin.rows || !fin.rows.revenue) return V;
  const R = fin.rows, q = fin.q, n = q.length, i0 = n - 1, U = fin.unit || "", mU = /십억|B/i.test(U) ? 1e9 : /천|K/i.test(U) ? 1e3 : 1e6, qs = q.map(qShort);
  const A = (k) => R[k] || null, at = (k, i) => (R[k] && i >= 0 ? R[k][i] : null), T = (k) => (R[k] ? q.map((_, i) => ttm(R[k], i)) : null);
  const epsT = T("eps"), revT = T("revenue"), fcfT = T("fcf"), oiT = T("opinc"), niT = T("netinc");
  const ratio = (a, b) => (R[a] && R[b] ? q.map((_, i) => (R[a][i] != null && R[b][i] ? (R[a][i] / R[b][i]) * 100 : null)) : null);
  const yoy = (a) => (a ? a.map((v, i) => (i >= 4 ? pct(v, a[i - 4]) : null)) : null);
  V.q = qs; V.unit = U; V.cur = fin.cur || "$"; V.ok = true;

  /* ---------- 부문별 매출 ---------- */
  const SG = fin.seg && typeof fin.seg === "object" ? Object.keys(fin.seg).map((k) => ({ n: k, a: fin.seg[k] })).filter((s) => Array.isArray(s.a) && s.a.length === n && s.a.filter((v) => v != null).length >= 4) : [];
  if (SG.length >= 2) { const lastTot = sum(SG.map((s) => s.a[i0] || 0)), okSum = R.revenue[i0] ? Math.abs(lastTot / R.revenue[i0] - 1) < 0.06 : false;
    const top = SG.slice().sort((a, b) => (b.a[i0] || 0) - (a.a[i0] || 0)).slice(0, 5);
    V.stack = { segs: top.map((s) => ({ n: s.n, a: s.a.map((v) => r1(v, 0)), y: r1(pct(s.a[i0], s.a[i0 - 4]), 0), share: R.revenue[i0] && s.a[i0] != null ? r1((s.a[i0] / R.revenue[i0]) * 100) : null })), total: R.revenue.map((v) => r1(v, 0)), sumOk: okSum };
    const first = top[0].a.findIndex((v) => v != null); if (first >= 0 && R.revenue[first]) V.stack.share0 = r1((top[0].a[first] / R.revenue[first]) * 100, 0), V.stack.q0 = qs[first]; }

  /* ---------- 이익률 · 비용 ---------- */
  const gm = ratio("gross", "revenue"), opm = ratio("opinc", "revenue"), opexA = R.opex || (R.rd && R.sga ? q.map((_, i) => (R.rd[i] != null && R.sga[i] != null ? R.rd[i] + R.sga[i] : null)) : null), opr = opexA ? q.map((_, i) => (opexA[i] != null && R.revenue[i] ? (opexA[i] / R.revenue[i]) * 100 : null)) : null;
  if (gm || opm) V.margin = { gm: gm && gm.map((v) => r1(v)), opm: opm && opm.map((v) => r1(v)), opr: opr && opr.map((v) => r1(v)), rev: R.revenue.map((v) => r1(v, 0)), cogs: A("cogs") && R.cogs.map((v) => r1(v, 0)), opex: opexA && opexA.map((v) => r1(v, 0)), opinc: A("opinc") && R.opinc.map((v) => r1(v, 0)) };
  const dio = R.inventory && R.cogs ? q.map((_, i) => (R.inventory[i] != null && R.cogs[i] ? (R.inventory[i] / R.cogs[i]) * 91 : null)) : null, dso = R.ar ? q.map((_, i) => (R.ar[i] != null && R.revenue[i] ? (R.ar[i] / R.revenue[i]) * 91 : null)) : null;
  if (dio || dso) V.inv = { inv: A("inventory") && R.inventory.map((v) => r1(v, 0)), dio: dio && dio.map((v) => r1(v, 0)), ar: A("ar") && R.ar.map((v) => r1(v, 0)), dso: dso && dso.map((v) => r1(v, 0)) };

  /* ---------- 작은 추이 8칸 ---------- */
  V.tiles = []; const tile = (nm, a, kind, d) => { if (V.tiles.length >= 8 || !a || a.filter((v) => v != null).length < 5) return; const f = a.findIndex((v) => v != null); const y = kind === "pp" ? (a[i0] != null && a[i0 - 4] != null ? a[i0] - a[i0 - 4] : null) : pct(a[i0], a[i0 - 4]); V.tiles.push({ n: nm, a: a.map((v) => r1(v, d == null ? 0 : d)), y: r1(y, kind === "pp" ? 1 : 0), kind: kind || "pct", f0: qs[f], d: d == null ? 0 : d }); };
  if (V.stack) V.stack.segs.slice(0, 3).forEach((s) => tile(s.n, s.a)); else tile("매출", R.revenue);
  tile("총이익률", gm, "pp", 1); tile("영업이익", A("opinc")); tile("연구개발비", A("rd")); tile("재고", A("inventory"), "cost"); tile("희석 EPS", A("eps"), "pct", 2); tile("남는 현금(FCF)", A("fcf")); tile("매출채권", A("ar"), "cost");

  /* ---------- 전년 대비 증가율 순위 ---------- */
  V.rank = []; const rk = (nm, a, cost) => { const y = a ? pct(a[i0], a[i0 - 4]) : null; if (y != null && Math.abs(y) < 2000) V.rank.push({ n: nm, y: r1(y, 0), cost: cost ? 1 : 0 }); };
  if (V.stack) V.stack.segs.forEach((s) => rk(s.n, s.a)); rk("총매출", R.revenue); rk("영업이익", A("opinc")); rk("순이익", A("netinc")); rk("희석 EPS", A("eps")); rk("매출원가", A("cogs"), 1); rk("연구개발비", A("rd"), 1); rk("판매 · 관리비", A("sga"), 1); rk("재고", A("inventory"), 1); rk("매출채권", A("ar"), 1);
  V.rank.sort((a, b) => b.y - a.y); if (V.rank.length < 4) delete V.rank;

  /* ---------- 영업이익 다리 (전년 동기 → 이번 분기) ---------- */
  if (i0 >= 4 && at("opinc", i0) != null && at("opinc", i0 - 4) != null) { const steps = [], dv = (k) => (at(k, i0) != null && at(k, i0 - 4) != null ? at(k, i0) - at(k, i0 - 4) : null);
    if (V.stack && V.stack.sumOk) { const segs = V.stack.segs.slice(0, 2); let used = 0; segs.forEach((s) => { const d = s.a[i0] != null && s.a[i0 - 4] != null ? s.a[i0] - s.a[i0 - 4] : null; if (d != null) { steps.push({ n: s.n + " 매출", v: d }); used += d; } }); const rest = dv("revenue") - used; if (Math.abs(rest) > Math.abs(dv("revenue")) * 0.01) steps.push({ n: "그 밖의 매출", v: rest }); }
    else if (dv("revenue") != null) steps.push({ n: "매출 증가", v: dv("revenue") });
    [["cogs", "매출원가"], ["rd", "연구개발비"], ["sga", "판매 · 관리비"]].forEach(([k, nm]) => { const d = dv(k); if (d != null) steps.push({ n: nm, v: -d }); });
    const from = at("opinc", i0 - 4), to = at("opinc", i0), gap = to - from - sum(steps.map((s) => s.v)); if (Math.abs(gap) > Math.abs(to) * 0.01) steps.push({ n: "기타", v: gap });
    if (steps.length >= 2) V.bridge = { from: r1(from, 0), to: r1(to, 0), q0: qs[i0 - 4], q1: qs[i0], steps: steps.map((s) => ({ n: s.n, v: r1(s.v, 0) })) }; }

  /* ---------- 이번 분기 손익 흐름 ---------- */
  if (at("gross", i0) != null && at("opinc", i0) != null) { const rv = R.revenue[i0], p = (v) => (v != null && rv ? r1((v / rv) * 100) : null), pv = (k) => (i0 >= 4 && at(k, i0 - 4) != null && R.revenue[i0 - 4] ? (at(k, i0 - 4) / R.revenue[i0 - 4]) * 100 : null), it = (k, nm, cost) => (at(k, i0) == null ? null : { k, n: nm, v: r1(at(k, i0), 0), share: p(at(k, i0)), y: r1(pct(at(k, i0), at(k, i0 - 4)), 0), dpp: pv(k) != null ? r1(p(at(k, i0)) - pv(k)) : null, cost: cost ? 1 : 0 });
    V.flow = { q: qs[i0], items: [it("revenue", "매출"), it("cogs", "매출원가", 1), it("gross", "매출총이익"), it("rd", "연구개발비", 1), it("sga", "판매 · 관리비", 1), it("opinc", "영업이익"), it("netinc", "순이익")].filter(Boolean) }; }

  /* ---------- 월말 기준 배수 ---------- */
  const ME = monthEnds(hist, 37), sh = (i) => at("shares", i) || at("shares", i0), bps = R.equity && R.shares ? q.map((_, i) => (R.equity[i] != null && sh(i) ? (R.equity[i] * mU) / (sh(i) * 1e6) : null)) : null;
  /* 선행 EPS = 그 분기 뒤 4개 분기의 실제 EPS. 아직 발표 전인 분기는 회계연도 예상 EPS에서 이미 나온 분기를 빼고 고르게 나눈다 */
  let fwd = null, fwdNote = ""; const P = q.map(qParse);
  if (R.eps && P[i0]) { const estBy = {}; if (fin.est && fin.est.fy && fin.est.eps) fin.est.fy.forEach((f, k) => { const y = fyOf(f); if (y && fin.est.eps[k] > 0) estBy[y] = fin.est.eps[k]; });
    const known = {}; P.forEach((p, i) => { if (p && R.eps[i] != null) known[p.fy + "-" + p.qn] = R.eps[i]; });
    const epsOf = (fy, qn) => { const k = fy + "-" + qn; if (known[k] != null) return { v: known[k], est: 0 }; if (estBy[fy] == null) return null; let s = 0, c = 0; for (let x = 1; x <= 4; x++) if (known[fy + "-" + x] != null) { s += known[fy + "-" + x]; c++; } const rem = estBy[fy] - s; return c < 4 && rem > 0 ? { v: rem / (4 - c), est: 1 } : null; };
    let usedEst = 0; fwd = P.map((p) => { if (!p) return null; let s = 0, fy = p.fy, qn = p.qn; for (let k = 0; k < 4; k++) { qn++; if (qn > 4) { qn = 1; fy++; } const e = epsOf(fy, qn); if (!e) return null; s += e.v; if (e.est) usedEst = 1; } return s > 0 ? s : null; });
    if (fwd.filter((v) => v != null).length < 5 || fwd[i0] == null) fwd = null; else if (usedEst) fwdNote = "선행 EPS = 그 시점 이후 4개 분기의 실제 EPS(발표 전 분기는 회계연도 예상을 고르게 나눈 어림)";
    /* 예상(조정 EPS)과 표(GAAP EPS)의 기준이 다르면 어긋난다 — 사이트의 선행 PER와 20% 넘게 다르면 쓰지 않는다 */
    if (fwd && ME.length && fin.stats && fin.stats.fpe > 0) { const mine = ME[ME.length - 1].p / fwd[i0]; if (Math.abs(mine / fin.stats.fpe - 1) > 0.2) { fwd = null; fwdNote = "선행 PER 흐름은 그리지 않았어요 — 예상 EPS(조정)와 재무표 EPS(GAAP)의 기준이 달라 어긋나요"; } } }
  V.fwdNote = fwdNote;
  if (ME.length >= 13 && fin.end && fin.end.length === n) {
    const endTs = fin.end.map((e) => Date.parse(e + "T00:00:00Z") / 1000), qAt = (ts, isLast) => { let i = -1; for (let k = 0; k < n; k++) if (endTs[k] + (isLast ? 0 : 25 * 86400) <= ts) i = k; return i; };
    const M = ME.map((m, k) => { const i = qAt(m.ts, k === ME.length - 1), o = { m: m.m, p: r1(m.p, 2), i }; if (i < 0) return o; const s = sh(i);
      if (epsT && epsT[i] > 0) { o.eT = r1(epsT[i], 2); o.peT = m.p / epsT[i]; } if (fwd && fwd[i] > 0) { o.eF = r1(fwd[i], 2); o.peF = m.p / fwd[i]; }
      if (revT && revT[i] && s) o.ps = (m.p * s * 1e6) / (revT[i] * mU); if (bps && bps[i] > 0) { o.b = r1(bps[i], 2); o.pb = m.p / bps[i]; } if (fcfT && fcfT[i] != null && s) o.fy = ((fcfT[i] * mU) / (m.p * s * 1e6)) * 100; return o; });
    const now = M[M.length - 1], G = [], gauge = (key, label, unit, lowGood, d) => { const hs = M.slice(0, -1).map((x) => x[key]).filter((v) => v != null && isFinite(v)); const z = zone(now[key], hs, lowGood); if (!z) return; G.push(Object.assign({ key, k: label, v: r1(now[key], d == null ? 1 : d), unit, lowGood: lowGood ? 1 : 0, n: hs.length }, z)); };
    gauge("peF", "선행 PER(앞으로 12개월)", "배", true); gauge("peT", "TTM PER", "배", true); gauge("pb", "PBR", "배", true); gauge("ps", "P/S 매출 대비", "배", true); gauge("fy", "FCF 수익률", "%", false, 2);
    /* PEG = 선행 PER ÷ 이익 성장률(선행 EPS ÷ TTM EPS − 1) */
    M.forEach((x) => { if (x.peF && x.eF && x.eT > 0 && x.eF > x.eT) x.peg = x.peF / ((x.eF / x.eT - 1) * 100); }); gauge("peg", "PEG 성장 감안", "배", true, 2);
    if (G.length) { V.gauge = G; V.asOf = { m: now.m, p: now.p, q: qs[now.i] || "" };
      const main = G.find((g) => g.key === "peF") || G.find((g) => g.key === "peT"); if (main) { const base = main.key === "peF" ? now.eF : now.eT; V.fair = { k: main.k, avg: main.avg, px: r1(main.avg * base, 2), gap: r1(pct(main.avg * base, now.p), 0), eps: base }; } }
    /* 밸류 밴드: 배수 5줄 × 그때의 이익(순자산) */
    V.band = []; const band = (key, baseKey, label, sub) => { const pts = M.filter((x) => x[key] != null && x[baseKey] != null); if (pts.length < 12) return; const hs = pts.map((x) => x[key]), m = mean(hs), s = sd(hs) || 0, mults = [Math.min(...hs), Math.max(Math.min(...hs), m - s), m, Math.min(Math.max(...hs), m + s), Math.max(...hs)]; V.band.push({ key, k: label, sub, m: pts.map((x) => x.m), p: pts.map((x) => x.p), base: pts.map((x) => x[baseKey]), mults: mults.map((v) => r1(v, 1)) }); };
    band("peF", "eF", "선행 PER 밴드", "주가 vs 선행 EPS × 배수"); band("peT", "eT", "TTM PER 밴드", "주가 vs 최근 1년 EPS × 배수"); band("pb", "b", "PBR 밴드", "주가 vs 주당 순자산 × 배수"); { const bF = V.band.find((b) => b.key === "peF"), bT = V.band.find((b) => b.key === "peT"), bB = V.band.find((b) => b.key === "pb"); V.band = [bF || bT, bF ? (bB || bT) : bB].filter(Boolean); } if (!V.band.length) delete V.band;
    /* 주가 vs TTM EPS · PER 흐름 (최근 24개월) */
    const L = M.slice(-24).filter((x) => x.eT != null); if (L.length >= 10) { const pes = L.map((x) => x.peT), mx = Math.max(...pes), mn = Math.min(...pes); V.pe = { m: L.map((x) => x.m), p: L.map((x) => x.p), e: L.map((x) => x.eT), pe: pes.map((v) => r1(v)), hi: r1(mx), hiM: L[pes.indexOf(mx)].m, lo: r1(mn), loM: L[pes.indexOf(mn)].m, e0: L[0].eT, e1: L[L.length - 1].eT, fpe: now.peF ? r1(now.peF) : (fin.stats && fin.stats.fpe > 0 ? fin.stats.fpe : null) }; }
    /* 민감도 — 매출 1% · 총이익률 1%p · 배수 1배가 주당이익(주가)에 주는 영향. 배수 고정 가정 */
    const s0 = sh(i0); if (revT && revT[i0] && epsT && epsT[i0] > 0 && s0 && oiT && oiT[i0] != null && niT && niT[i0] != null && oiT[i0] > 0) { const conv = Math.min(1, Math.max(0.5, niT[i0] / oiT[i0])); let inc = i0 >= 7 && oiT[i0 - 4] != null && revT[i0 - 4] && revT[i0] !== revT[i0 - 4] ? (oiT[i0] - oiT[i0 - 4]) / (revT[i0] - revT[i0 - 4]) : oiT[i0] / revT[i0]; inc = Math.min(0.95, Math.max(0.05, inc));
      const per = (dOI) => (dOI * conv * mU) / (s0 * 1e6), e1 = per(revT[i0] * 0.01 * inc), e2 = per(revT[i0] * 0.01), qRev = R.revenue[i0], e3 = per(qRev * 0.1 * 4 * inc);
      V.sens = { eps: r1(epsT[i0], 2), pe: now.peT ? r1(now.peT) : null, inc: r1(inc * 100, 0), conv: r1(conv * 100, 0), items: [
        { n: "매출 ±1%", de: r1(e1, 2), dp: r1((e1 / epsT[i0]) * 100), s: "늘어난 매출의 " + Math.round(inc * 100) + "%가 영업이익으로 남는다고 볼 때(최근 1년 실제 비율)" },
        { n: "총이익률 ±1%p", de: r1(e2, 2), dp: r1((e2 / epsT[i0]) * 100), s: "최근 1년 매출 기준" },
        { n: "분기 매출 ±10%가 1년 이어질 때", de: r1(e3, 2), dp: r1((e3 / epsT[i0]) * 100), s: "분기 매출 " + Math.round(qRev * 0.1).toLocaleString("en-US") + " " + U + " 차이" }].concat(now.peT ? [{ n: "배수(TTM PER) ±1배", de: 0, dp: r1(100 / now.peT), s: "이익은 그대로, 몸값만 움직일 때" }] : []) }; }
  }

  /* ---------- 벤치마크 대비 (월 수익률) ---------- */
  const MB = monthEnds(bench, 37); if (ME.length >= 14 && MB.length >= 14) { const bm = {}; MB.forEach((x) => { bm[x.m] = x.p; }); const rows = [];
    for (let k = 1; k < ME.length; k++) { const a = ME[k], b = ME[k - 1]; if (bm[a.m] && bm[b.m]) rows.push({ m: a.m, s: (a.p / b.p - 1) * 100, b: (bm[a.m] / bm[b.m] - 1) * 100 }); }
    const stat = (rs) => { if (rs.length < 8) return null; const mx = mean(rs.map((r) => r.b)), my = mean(rs.map((r) => r.s)); let sxy = 0, sxx = 0, syy = 0; rs.forEach((r) => { sxy += (r.b - mx) * (r.s - my); sxx += (r.b - mx) ** 2; syy += (r.s - my) ** 2; }); return sxx > 0 && syy > 0 ? { corr: r1(sxy / Math.sqrt(sxx * syy), 2), beta: r1(sxy / sxx, 2) } : null; };
    if (rows.length >= 12) { const ex = rows.slice(-22), i0m = ME.findIndex((x) => bm[x.m]), base = ME[i0m], idx = ME.slice(i0m).filter((x) => bm[x.m]);
      const hiS = Math.max(...idx.map((x) => x.p)), hiB = Math.max(...idx.map((x) => bm[x.m])), lastM = idx[idx.length - 1];
      V.rel = { bench: benchName || "", m: ex.map((r) => r.m), ex: ex.map((r) => r1(r.s - r.b, 0)), win: ex.filter((r) => r.s > r.b).length, n: ex.length, all: stat(rows), y1: stat(rows.slice(-12)),
        im: idx.map((x) => x.m), is: idx.map((x) => r1((x.p / base.p) * 100, 0)), ib: idx.map((x) => r1((bm[x.m] / bm[base.m]) * 100, 0)), gapS: r1(pct(lastM.p, hiS), 0), gapB: r1(pct(bm[lastM.m], hiB), 0) }; } }
  return V;
}

/* ---------- 가이던스 이력: AI가 옮긴 가이던스 숫자 + 재무표의 실제 매출 → 초과율은 코드 계산 ---------- */
export function guideFacts(list, fin) {
  if (!Array.isArray(list)) return null; const num = (v) => { if (v == null || v === "") return null; const x = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isFinite(x) ? x : null; };
  const actBy = {}; if (fin && fin.q) fin.q.forEach((s, i) => { const p = qParse(s); if (p && fin.rows.revenue[i] != null) actBy[p.fy + "-" + p.qn] = fin.rows.revenue[i]; });
  /* 단위 맞추기: 가이던스가 십억으로 왔는데 재무표가 백만이면 1000배 차이가 난다 — 실제 값이 있는 줄에서 배율을 정해 모든 줄에 같이 쓴다 */
  let scale = 1; { const votes = list.map((g) => { if (!g) return 0; const p = qParse(g.q), a = p ? actBy[p.fy + "-" + p.qn] : null, m = num(g.mid) != null ? num(g.mid) : num(g.lo) != null && num(g.hi) != null ? (num(g.lo) + num(g.hi)) / 2 : null; if (!(a > 0) || !(m > 0)) return 0; const r = a / m; return r > 500 && r < 2000 ? 1000 : r > 0.5 && r < 2 ? 1 : 0; }).filter(Boolean); if (votes.length && votes.filter((v) => v === 1000).length > votes.length / 2) scale = 1000; }
  const rows = list.map((g) => { if (!g) return null; const p = qParse(g.q); let lo = num(g.lo), hi = num(g.hi), mid = num(g.mid); if (mid == null && lo != null && hi != null) mid = (lo + hi) / 2; if (mid == null || !(mid > 0)) return null; mid *= scale; if (lo != null) lo *= scale; if (hi != null) hi *= scale; let act = p && actBy[p.fy + "-" + p.qn] != null ? actBy[p.fy + "-" + p.qn] : (num(g.act) != null ? num(g.act) * scale : null);
    const beat = act != null ? (act / mid - 1) * 100 : null; if (beat != null && Math.abs(beat) > 60) return null;
    return { q: p ? String(p.fy).slice(2) + "Q" + p.qn : String(g.q || "").slice(0, 8), mid: r1(mid, 0), lo: r1(lo, 0), hi: r1(hi, 0), act: r1(act, 0), beat: r1(beat), gmG: num(g.gmGuide), gmA: num(g.gmAct) }; }).filter(Boolean);
  if (rows.length < 3) return null; const done = rows.filter((r) => r.beat != null);
  return { rows: rows.slice(-14), n: done.length, win: done.filter((r) => r.beat > 0).length, avg: r1(mean(done.map((r) => r.beat))), last: done.length ? done[done.length - 1].beat : null, max: done.length ? r1(Math.max(...done.map((r) => r.beat))) : null };
}
