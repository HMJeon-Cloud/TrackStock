/* ============================================================
   v12.91 인사이트 엔진 — 카드 · 리포트 · 분석 · 본질/변수가 함께 쓰는 '예측 · 대응 · 방향' 재료
   ① 닮은 과거: 지금과 같은 자리(고점 대비 · 최근 3개월 · 200일선 위/아래)였던 과거 날들을 찾아 그 뒤 1·3·6·12개월 결과를 센다
   ② 내 자산 점검: 보유 비중 · 쏠림 · 외화 비중 + 과거 위기 구간이 다시 오면 얼마나 빠지는지(비중 × 그때 낙폭)
   ③ 프롬프트 보강: 과거 사례 · 새 정책/이슈 · 3개월 시나리오(확률) · 로드맵 · 지키기/키우기 규칙을 같은 모양(JSON)으로 받는다
   ④ 화면 · 카드: 위 답을 세 화면(분석 · 리포트 · 본질/변수)에서 같은 모양으로 보여 주고 카드 묶음으로 만든다
   원칙: 표본이 5번 미만이면 숨긴다(틀릴 수 있는 숫자는 안 보여 준다) · 과거 빈도는 보장이 아니라는 문구를 항상 붙인다
   ============================================================ */
var EG = { memo: {}, port: null, portAt: 0 };
function egEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
function egPct(v, d) { return v == null || !isFinite(v) ? "-" : (v > 0 ? "+" : "") + (v * 100).toFixed(d == null ? 0 : d) + "%"; }
function egName(s) { return typeof nbName === "function" ? nbName(s) : s; }
function egYm(t) { var d = new Date(t); return d.getUTCFullYear() + "." + ("0" + (d.getUTCMonth() + 1)).slice(-2); }
function egMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
var EG_DAY = 86400e3;

/* ---------- ① 닮은 과거 ---------- */
/* 날마다: 지난 1년 고점 대비(dd) · 3개월 수익(r3) · 200거래일 평균 대비(v200) — 창은 '날짜' 기준이라 주식(연 250일)과 코인(연 365일)에 똑같이 맞는다 */
function egPrep(rows) {
  var n = rows.length, dd = new Array(n), r3 = new Array(n), v200 = new Array(n), dq = [], qh = 0, j3 = 0, jm = 0, sum = 0;
  var perY = n / Math.max(1, (rows[n - 1].t - rows[0].t) / (365.25 * EG_DAY)), maDays = 200 / perY * 365.25;   // 200거래일이 달력으로 며칠인지
  for (var i = 0; i < n; i++) {
    var t = rows[i].t, c = rows[i].c;
    while (dq.length > qh && rows[dq[dq.length - 1]].c <= c) dq.pop(); dq.push(i);
    while (rows[dq[qh]].t < t - 365 * EG_DAY) qh++;
    if (qh > 2000) { dq = dq.slice(qh); qh = 0; }
    sum += c; while (rows[jm].t < t - maDays * EG_DAY) { sum -= rows[jm].c; jm++; }
    while (rows[j3].t < t - 91 * EG_DAY) j3++;
    var ok = t - rows[0].t >= 365 * EG_DAY;
    dd[i] = ok ? c / rows[dq[qh]].c - 1 : null; r3[i] = ok && j3 > 0 ? c / rows[j3].c - 1 : null; v200[i] = ok ? c / (sum / (i - jm + 1)) - 1 : null;
  }
  return { dd: dd, r3: r3, v200: v200 };
}
var EG_H = [["1개월", 30], ["3개월", 91], ["6개월", 182], ["1년", 365]];
function egAnalog(sym) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || rows.length < 750) return null;
  var n = rows.length, last = rows[n - 1], key = sym + ":" + last.t + ":" + n; if (EG.memo[key] !== undefined) return EG.memo[key];
  var P = egPrep(rows), d0 = P.dd[n - 1], r0 = P.r3[n - 1], v0 = P.v200[n - 1]; if (d0 == null || r0 == null || v0 == null) return (EG.memo[key] = null);
  var pick = function (m) {
    var eps = [], lastT = -Infinity, td = Math.max(0.03, Math.abs(d0) * 0.3) * m, tr = Math.max(0.05, Math.abs(r0) * 0.5) * m;
    for (var i = 0; i < n; i++) {
      if (P.dd[i] == null || rows[i].t > last.t - 60 * EG_DAY) continue;
      if (Math.abs(P.dd[i] - d0) > td || Math.abs(P.r3[i] - r0) > tr || (P.v200[i] >= 0) !== (v0 >= 0)) continue;
      if (rows[i].t - lastT < 45 * EG_DAY) continue;   // 같은 구간을 여러 번 세지 않는다
      eps.push(i); lastT = rows[i].t;
    }
    return eps;
  };
  var eps = pick(1), wide = false; if (eps.length < 6) { var e2 = pick(1.6); if (e2.length > eps.length) { eps = e2; wide = true; } }
  var state = { dd: d0, r3: r0, v200: v0 }, out = { sym: sym, name: egName(sym), state: state, n: eps.length, wide: wide, asOf: last.t, years: Math.round((last.t - rows[0].t) / (365.25 * EG_DAY)), from: egYm(rows[0].t) };
  if (eps.length < 5) { out.thin = true; return (EG.memo[key] = out); }
  var fwd = function (i, days) { var tt = rows[i].t + days * EG_DAY; if (tt > last.t) return null; var j = i; while (j < n - 1 && rows[j].t < tt) j++; return rows[j].c / rows[i].c - 1; };
  var stat = function (a) { if (a.length < 5) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return { n: a.length, win: a.filter(function (x) { return x > 0; }).length / a.length, med: egMed(a), worst: s[0], best: s[s.length - 1] }; };
  /* 비교 기준: 같은 자산을 '아무 날'에 샀을 때 (같은 기간 전체, 5거래일 간격) */
  out.h = EG_H.map(function (H) {
    var a = [], b = []; eps.forEach(function (i) { var r = fwd(i, H[1]); if (r != null) a.push(r); });
    for (var i = 0; i < n; i += 5) { if (P.dd[i] == null) continue; var r = fwd(i, H[1]); if (r != null) b.push(r); }
    var S = stat(a), B = stat(b); return S ? { l: H[0], n: S.n, win: S.win, med: S.med, worst: S.worst, best: S.best, baseWin: B ? B.win : null, baseMed: B ? B.med : null } : null;
  }).filter(Boolean);
  if (!out.h.length) { out.thin = true; return (EG.memo[key] = out); }
  /* 그 자리에서 산 뒤 1년 안에 가장 깊게 빠졌던 폭 — '더 빠질 수 있는 만큼'을 미리 안다 */
  var dips = []; eps.forEach(function (i) { if (rows[i].t + 365 * EG_DAY > last.t) return; var lo = rows[i].c, tt = rows[i].t + 365 * EG_DAY; for (var j = i; j < n && rows[j].t <= tt; j++) if (rows[j].c < lo) lo = rows[j].c; dips.push(lo / rows[i].c - 1); });
  if (dips.length >= 5) out.dip = { n: dips.length, med: egMed(dips), worst: Math.min.apply(null, dips) };
  out.eps = eps.map(function (i) { return { t: rows[i].t, ym: egYm(rows[i].t), r3: fwd(i, 91), r12: fwd(i, 365) }; });
  return (EG.memo[key] = out);
}
function egStateTxt(s) { return "1년 고점 대비 " + egPct(s.dd) + " · 최근 3개월 " + egPct(s.r3) + " · 200일선 " + (s.v200 >= 0 ? "위" : "아래") + " " + egPct(s.v200); }
/* 프롬프트용 한 줄 */
function egLine(sym) {
  var A = egAnalog(sym); if (!A) return null;
  if (A.thin) return "- " + A.name + " | 지금 자리: " + egStateTxt(A.state) + " | 닮은 과거 " + A.n + "번뿐 — 표본이 적어 통계를 내지 않음";
  return "- " + A.name + " | 지금 자리: " + egStateTxt(A.state) + " | 닮은 과거 " + A.n + "번(" + A.from + "~, " + A.years + "년치" + (A.wide ? ", 조건을 넓혀 찾음" : "") + ") | " +
    A.h.map(function (h) { return h.l + " 뒤 플러스 " + Math.round(h.win * 100) + "%·중앙 " + egPct(h.med) + "·최악 " + egPct(h.worst) + "·최고 " + egPct(h.best) + (h.baseWin != null ? " (아무 날: " + Math.round(h.baseWin * 100) + "%·" + egPct(h.baseMed) + ")" : ""); }).join(" / ") +
    (A.dip ? " | 그 자리에서 산 뒤 1년 안 최대 추가 하락: 보통 " + egPct(A.dip.med) + " · 최악 " + egPct(A.dip.worst) : "") +
    " | 사례: " + A.eps.slice(-5).map(function (e) { return e.ym + (e.r12 != null ? "→1년 " + egPct(e.r12) : "→진행 중"); }).join(", ");
}
function egMarketSyms() { return ["^KS11", "^GSPC", "^IXIC", "BTC-USD"].filter(function (s) { return typeof TICKER_NAME === "undefined" || true; }); }
function egIndexOf(sym) { return /\.K[SQ]$|^\^K[SQ]/.test(sym || "") ? "^KS11" : /-USD$/.test(sym || "") ? "BTC-USD" : "^GSPC"; }
function egEnsure(syms) { syms = (syms || []).filter(Boolean); return typeof nbLoad === "function" ? nbLoad(syms).catch(function () {}) : Promise.resolve(); }
function egLines(syms) { return syms.map(egLine).filter(Boolean); }

/* ---------- ② 내 자산 점검 ---------- */
var EG_CRISIS = [["2008 금융위기", Date.UTC(2007, 9, 1), Date.UTC(2009, 2, 31)], ["2020 코로나", Date.UTC(2020, 1, 1), Date.UTC(2020, 3, 30)], ["2022 긴축", Date.UTC(2021, 10, 1), Date.UTC(2022, 11, 31)]];
function egClass(s) { return /-USD$/.test(s) ? "코인" : /\.K[SQ]$|^\^K[SQ]/.test(s) ? "국내" : "해외"; }
function egWindowDd(rows, a, b) {   // 그 구간 안에서 고점 → 저점
  var pk = null, worst = 0, seen = 0; for (var i = 0; i < rows.length; i++) { var r = rows[i]; if (r.t < a) continue; if (r.t > b) break; seen++; if (pk == null || r.c > pk) pk = r.c; var d = r.c / pk - 1; if (d < worst) worst = d; }
  return seen >= 20 && rows.length && rows[0].t <= a + 30 * EG_DAY ? worst : null;   // 구간 시작 전부터 자료가 있어야 인정
}
function egPortfolio() {
  var H; try { H = typeof loadHoldings === "function" ? loadHoldings() : null; } catch (e) { H = null; }
  var lots = (H && H.lots) || [], by = {}; lots.forEach(function (L) { (by[L.s] = by[L.s] || []).push(L); });
  var fxRows = typeof nbHist !== "undefined" && nbHist["KRW=X"], fx = fxRows && fxRows.length ? fxRows[fxRows.length - 1].c : null, pos = [], miss = [];
  Object.keys(by).forEach(function (s) {
    var p = typeof positionFromLots === "function" ? positionFromLots(by[s]) : null; if (!p || !(p.qty > 0)) return;
    var rows = nbHist[s], px = rows && rows.length ? rows[rows.length - 1].c : null, krw = typeof isKrwSymbol === "function" ? isKrwSymbol(s) : /\.K[SQ]$/.test(s);
    if (px == null || (!krw && !fx)) { miss.push(egName(s)); return; }
    pos.push({ sym: s, name: egName(s), cls: egClass(s), krw: krw, val: p.qty * px * (krw ? 1 : fx), cost: p.costK, rows: rows });
  });
  if (!pos.length) return { n: 0, miss: miss };
  var tot = pos.reduce(function (a, x) { return a + x.val; }, 0); pos.forEach(function (x) { x.w = x.val / tot; x.pl = x.cost > 0 ? x.val / x.cost - 1 : null; }); pos.sort(function (a, b) { return b.w - a.w; });
  var cls = {}; pos.forEach(function (x) { cls[x.cls] = (cls[x.cls] || 0) + x.w; });
  var stress = EG_CRISIS.map(function (C) { var cov = 0, loss = 0, parts = []; pos.forEach(function (x) { var d = egWindowDd(x.rows, C[1], C[2]); if (d == null) return; cov += x.w; loss += x.w * d; parts.push({ name: x.name, d: d, w: x.w }); }); return cov >= 0.7 ? { name: C[0], cov: cov, loss: loss / cov, worst: parts.sort(function (a, b) { return a.d * a.w - b.d * b.w; })[0] } : { name: C[0], cov: cov, thin: true }; });
  var flags = [];
  if (pos[0].w >= 0.4) flags.push({ lv: "bad", t: pos[0].name + " 한 종목이 " + Math.round(pos[0].w * 100) + "% — 이 종목 하나가 -30%면 전체가 " + egPct(-0.3 * pos[0].w) });
  else if (pos[0].w >= 0.25) flags.push({ lv: "mid", t: pos[0].name + " 비중 " + Math.round(pos[0].w * 100) + "% — 한 종목 25% 이상은 쏠림 주의" });
  var top3 = pos.slice(0, 3).reduce(function (a, x) { return a + x.w; }, 0); if (pos.length >= 5 && top3 >= 0.7) flags.push({ lv: "mid", t: "상위 3종목이 " + Math.round(top3 * 100) + "% — 나머지는 분산 효과가 작음" });
  if ((cls["코인"] || 0) >= 0.3) flags.push({ lv: "mid", t: "코인 비중 " + Math.round(cls["코인"] * 100) + "% — 코인은 -50% 넘는 하락이 여러 번 있었음" });
  var fxW = pos.filter(function (x) { return !x.krw; }).reduce(function (a, x) { return a + x.w; }, 0);
  if (pos.length < 4) flags.push({ lv: "mid", t: "보유 " + pos.length + "종목 — 종목 수가 적어 한 종목의 영향이 큼" });
  if (!flags.length) flags.push({ lv: "good", t: "한 종목 쏠림 없음 — 가장 큰 비중 " + Math.round(pos[0].w * 100) + "%" });
  return { n: pos.length, pos: pos, cls: cls, fxW: fxW, fx: fx, top3: top3, stress: stress, flags: flags, miss: miss };
}
function egPortSyms() { var s = {}; try { (loadHoldings().lots || []).forEach(function (L) { s[L.s] = 1; }); } catch (e) {} var a = Object.keys(s); if (a.some(function (x) { return !/\.K[SQ]$/.test(x); })) a.push("KRW=X"); return a; }
/* 프롬프트용 — 금액은 넣지 않고 비중(%)만 */
function egPortLines() {
  var P = egPortfolio(); if (!P || !P.n) return ["- 보유 자산을 입력하지 않음 → '내 자산' 조언은 일반 원칙(분산 · 현금 · 적립)으로만 쓴다"];
  var L = ["- 보유 " + P.n + "종목 (금액은 비공개, 비중만) · 국내 " + Math.round((P.cls["국내"] || 0) * 100) + "% / 해외 " + Math.round((P.cls["해외"] || 0) * 100) + "% / 코인 " + Math.round((P.cls["코인"] || 0) * 100) + "% · 달러 등 외화 자산 " + Math.round(P.fxW * 100) + "%"];
  L.push("- 비중 순: " + P.pos.slice(0, 10).map(function (x) { return x.name + " " + Math.round(x.w * 100) + "%" + (x.pl != null ? "(평가 " + egPct(x.pl) + ")" : ""); }).join(", "));
  P.stress.forEach(function (s) { if (!s.thin) L.push("- " + s.name + " 구간이 지금 비중으로 다시 오면: 전체 " + egPct(s.loss) + " (그때 자료가 있는 자산 " + Math.round(s.cov * 100) + "% 기준 · 원화 환산 전 각 자산 낙폭 × 비중" + (s.worst ? " · 가장 크게 끌어내린 것 " + s.worst.name + " " + egPct(s.worst.d) : "") + ")"); });
  P.flags.forEach(function (f) { L.push("- 점검: " + f.t); });
  if (P.miss.length) L.push("- 시세를 못 읽어 뺀 종목: " + P.miss.join(", "));
  return L;
}

/* ---------- ③ 프롬프트 보강 (세 화면 공통 모양) ---------- */
var EG_SCHEMA = [
  '"edge": {',
  '  "history": [ { "case": "닮은 과거(연.월 · 무슨 일이었나)", "same": "지금과 같은 점", "diff": "지금과 다른 점", "after": "그 뒤 3개월·1년 실제 흐름(숫자)", "lesson": "거기서 배울 대응 한 줄" } ],   // 2~3개. [과거 닮은 자리]의 사례 연월 · 숫자가 1순위, 사건 설명만 웹으로 보탠다',
  '  "policy": [ { "what": "새 정책 · 이슈(날짜 · 출처)", "path": "영향 경로: 무엇 → 무엇 → 가격", "win": "수혜", "lose": "피해", "when": "영향이 나타날 시점", "do": "조건부 대응" } ],   // 최근 4주 안, 2~4개. 확인 못 한 것은 쓰지 않는다',
  '  "paths": [ { "name": "기본 | 좋은 쪽 | 나쁜 쪽", "p": 0~100, "what": "3개월 흐름 한 줄", "range": "예상 범위(숫자)", "sign": "이 길로 가는 신호", "do": "그때 할 일" } ],   // 3개, p 합 100. 출발점은 [과거 닮은 자리]의 3개월 빈도 — 다르게 잡으면 이유를 sign에',
  '  "roadmap": { "now": "이번 달 할 일", "q": "3개월 안", "y1": "1년", "y3": "3년 방향" },',
  '  "protect": ["자산을 지키는 규칙 3개 — 숫자로(손실 한도 · 현금 비중 · 한 종목 상한 등)"],',
  '  "grow": ["자산을 키우는 규칙 3개 — 숫자로(적립 · 리밸런싱 · 추가 매수 조건 등)"],',
  '  "mine": "내 자산([내 자산] 줄)에 그대로 적용하면 — 3문장. 쏠림 · 위기 재현 숫자를 인용"',
  '}'
];
var EG_RULES = [
  "", "=== 예측 · 대응 · 방향 (edge) — 이 부분이 가장 중요하다 ===",
  "목적은 독자의 자산을 지키고 키우는 것이다. 맞히는 예측이 아니라 '범위와 확률, 그리고 그때 할 일'을 준다.",
  "- 과거: 아래 [과거 닮은 자리]는 앱이 실제 일봉으로 센 것이다. 승률 · 중앙값 · 최악을 그대로 인용하고, '아무 날' 값과 비교해 지금 자리가 유리한지 불리한지 말한다. 표본 수(n번)를 꼭 적는다. 과거 빈도는 보장이 아니다.",
  "- 정책 · 이슈: 최근 4주의 새 정책 · 규제 · 실적 · 지정학 이슈를 웹에서 찾아 '영향 경로'로 푼다. 날짜와 출처가 없으면 쓰지 않는다.",
  "- 대응: 모든 행동은 '조건(숫자) → 행동(비중 · 분할 횟수 · 기간)'으로 쓴다. 매수 · 매도 권유나 목표가는 쓰지 않는다.",
  "- 방향: 이번 달 → 3개월 → 1년 → 3년 순서로, 뒤로 갈수록 본질(이익 · 성장) 중심으로.",
  "기존 JSON의 맨 끝(마지막 } 바로 앞)에 아래 edge 키를 추가한다:"
];
function egBlock(syms, withPort) {
  var L = egLines(syms), out = [""];
  out.push("[과거 닮은 자리 — 앱 계산] 지금과 고점 대비 · 3개월 수익 · 200일선 위치가 비슷했던 과거 날(구간마다 한 번)과 그 뒤 결과");
  if (L.length) out = out.concat(L); else out.push("- 장기 일봉이 없어 계산하지 못함 → history는 웹에서 찾은 사례만, 숫자는 출처와 함께");
  if (withPort !== false) { out.push("", "[내 자산]"); out = out.concat(egPortLines()); }
  return out.concat(EG_RULES, EG_SCHEMA).join("\n");
}
function egNorm(E) {
  if (!E || typeof E !== "object") return null; var arr = function (x) { return Array.isArray(x) ? x.filter(Boolean) : x ? [x] : []; };
  var o = { history: arr(E.history).filter(function (x) { return x && (x.case || x.after); }), policy: arr(E.policy).filter(function (x) { return x && x.what; }), paths: arr(E.paths).filter(function (x) { return x && (x.name || x.what); }), roadmap: E.roadmap && typeof E.roadmap === "object" ? E.roadmap : null, protect: arr(E.protect), grow: arr(E.grow), mine: typeof E.mine === "string" ? E.mine : "" };
  o.paths.forEach(function (p) { var v = parseFloat(p.p); p.p = isFinite(v) ? Math.max(0, Math.min(100, v)) : null; });
  return o.history.length || o.policy.length || o.paths.length || o.roadmap || o.protect.length || o.grow.length ? o : null;
}

/* ---------- ④ 화면 ---------- */
function egAnalogHtml(syms, title) {
  var As = syms.map(egAnalog).filter(Boolean); if (!As.length) return "";
  var h = '<div class="egBox"><div class="egH">' + egEsc(title || "닮은 과거 — 지금 같은 자리 뒤에는") + ' <small>고점 대비 · 3개월 수익 · 200일선 위치가 비슷했던 날을 찾아 그 뒤를 셌어요 · 과거 빈도일 뿐 보장은 아니에요</small></div>';
  As.forEach(function (A) {
    h += '<div class="egA"><div class="egAH"><b>' + egEsc(A.name) + '</b><span>' + egEsc(egStateTxt(A.state)) + '</span>' + (A.thin ? '<em class="egThin">닮은 과거 ' + A.n + '번 — 표본이 적어 숨김</em>' : '<em>닮은 과거 ' + A.n + '번 · ' + A.years + '년치' + (A.wide ? ' · 조건 넓힘' : '') + '</em>') + '</div>';
    if (!A.thin) {
      h += '<div class="egGrid">' + A.h.map(function (x) { var edge = x.baseWin != null ? x.win - x.baseWin : null; return '<div class="egCell"><small>' + x.l + ' 뒤</small><b class="' + (x.win >= 0.6 ? "up" : x.win < 0.45 ? "dn" : "") + '">' + Math.round(x.win * 100) + '%</b><i>플러스였던 비율 · ' + x.n + '번</i><div class="egBar"><u style="width:' + Math.round(x.win * 100) + '%"></u>' + (x.baseWin != null ? '<s style="left:' + Math.round(x.baseWin * 100) + '%" title="아무 날 샀을 때"></s>' : '') + '</div><div class="egR">보통 <b>' + egPct(x.med) + '</b> · 최악 ' + egPct(x.worst) + ' · 최고 ' + egPct(x.best) + '</div>' + (edge != null ? '<div class="egE ' + (edge >= 0.05 ? "up" : edge <= -0.05 ? "dn" : "") + '">아무 날보다 ' + (edge >= 0 ? "+" : "") + Math.round(edge * 100) + '%p</div>' : '') + '</div>'; }).join("") + '</div>';
      h += '<div class="egNote">' + (A.dip ? '<b>더 빠질 수 있는 만큼</b> — 이런 자리에서 산 뒤 1년 안에 보통 ' + egPct(A.dip.med) + ', 최악 ' + egPct(A.dip.worst) + '까지 내려간 적이 있어요. 이 폭을 견딜 수 있는 금액만, 나눠서. ' : '') + '<span class="egEps">사례: ' + A.eps.slice(-6).map(function (e) { return e.ym + (e.r12 != null ? ' → 1년 ' + egPct(e.r12) : ' → 진행 중'); }).join(' · ') + '</span></div>';
    }
    h += '</div>';
  });
  return h + '</div>';
}
function egPortHtml() {
  var P = egPortfolio(); if (!P) return "";
  if (!P.n) return '<div class="egBox"><div class="egH">내 자산 방어 점검</div><div class="briefDim">보유 종목을 입력하면 비중 · 쏠림 · 과거 위기 재현 숫자가 나와요. <button class="chip" onclick="navTo(\'sim\')">내 자산 입력하러 가기</button></div></div>';
  var h = '<div class="egBox"><div class="egH">내 자산 방어 점검 <small>금액은 이 기기에만 있고, 프롬프트에는 비중(%)만 들어가요</small></div>';
  h += '<div class="egW">' + P.pos.slice(0, 8).map(function (x) { return '<div class="egWRow"><span>' + egEsc(x.name) + '</span><div class="egBar"><u style="width:' + Math.max(2, Math.round(x.w * 100)) + '%"></u></div><b>' + Math.round(x.w * 100) + '%</b></div>'; }).join("") + (P.pos.length > 8 ? '<div class="briefDim">외 ' + (P.pos.length - 8) + '종목</div>' : '') + '</div>';
  h += '<div class="egChips"><span>국내 ' + Math.round((P.cls["국내"] || 0) * 100) + '%</span><span>해외 ' + Math.round((P.cls["해외"] || 0) * 100) + '%</span><span>코인 ' + Math.round((P.cls["코인"] || 0) * 100) + '%</span><span>외화 자산 ' + Math.round(P.fxW * 100) + '%</span></div>';
  h += '<div class="egFlags">' + P.flags.map(function (f) { return '<div class="' + f.lv + '">' + egEsc(f.t) + '</div>'; }).join("") + '</div>';
  var st = P.stress.filter(function (s) { return !s.thin; });
  if (st.length) h += '<div class="egGrid">' + st.map(function (s) { return '<div class="egCell"><small>' + egEsc(s.name) + '이 다시 오면</small><b class="dn">' + egPct(s.loss) + '</b><i>지금 비중 그대로일 때 · 자료 있는 자산 ' + Math.round(s.cov * 100) + '%</i>' + (s.worst ? '<div class="egR">가장 크게 끌어내린 것: ' + egEsc(s.worst.name) + ' ' + egPct(s.worst.d) + '</div>' : '') + '</div>'; }).join("") + '</div><div class="egNote">각 자산이 그 구간에서 빠진 폭에 지금 비중을 곱해 더한 값이에요(각 자산의 통화 기준, 환율 변화는 빼고 계산). 이 숫자를 보고도 잠을 잘 수 있는 비중인지가 기준이에요.</div>';
  else h += '<div class="egNote">보유 종목의 과거 자료가 위기 구간을 덮지 못해 재현 숫자는 숨겼어요.</div>';
  if (P.miss.length) h += '<div class="briefDim">시세를 못 읽어 뺀 종목: ' + egEsc(P.miss.join(", ")) + '</div>';
  return h + '</div>';
}
function egExtraHtml(E, opt) {
  E = egNorm(E); if (!E) return "";
  var li = function (a) { return a.map(function (x) { return '<li>' + egEsc(typeof x === "string" ? x : JSON.stringify(x)) + '</li>'; }).join(""); }, h = '<div class="egX">';
  if (E.paths.length) h += '<div class="anxH">앞으로 3개월 — 세 갈래 길</div><div class="egPaths">' + E.paths.slice(0, 3).map(function (p) { var c = /나쁜|비관|하락/.test(p.name || "") ? "dn" : /좋은|낙관|상승/.test(p.name || "") ? "up" : ""; return '<div class="egPath ' + c + '"><div class="egPH"><b>' + egEsc(p.name || "") + '</b>' + (p.p != null ? '<em>' + Math.round(p.p) + '%</em>' : '') + '</div>' + (p.p != null ? '<div class="egBar"><u style="width:' + Math.round(p.p) + '%"></u></div>' : '') + '<div class="egPW">' + egEsc(p.what || "") + '</div>' + (p.range ? '<div class="coreL"><small>범위</small>' + egEsc(p.range) + '</div>' : '') + (p.sign ? '<div class="coreL"><small>신호</small>' + egEsc(p.sign) + '</div>' : '') + (p.do ? '<div class="coreL act"><small>할 일</small>' + egEsc(p.do) + '</div>' : '') + '</div>'; }).join("") + '</div>';
  if (E.history.length) h += '<div class="anxH">과거에서 배우기 — 닮은 사례</div><div class="egHist">' + E.history.slice(0, 3).map(function (x) { return '<div class="egHi"><b>' + egEsc(x.case || "") + '</b><div class="egTwo"><div><small>같은 점</small>' + egEsc(x.same || "-") + '</div><div><small>다른 점</small>' + egEsc(x.diff || "-") + '</div></div>' + (x.after ? '<div class="coreL"><small>그 뒤</small>' + egEsc(x.after) + '</div>' : '') + (x.lesson ? '<div class="coreL act"><small>배울 점</small>' + egEsc(x.lesson) + '</div>' : '') + '</div>'; }).join("") + '</div>';
  if (E.policy.length) h += '<div class="anxH">새 정책 · 이슈 — 영향과 대응</div><div class="egHist">' + E.policy.slice(0, 4).map(function (x) { return '<div class="egHi"><b>' + egEsc(x.what || "") + '</b>' + (x.path ? '<div class="egPathLine">' + egEsc(x.path).replace(/\s*(→|->)\s*/g, ' <i>→</i> ') + '</div>' : '') + '<div class="egTwo"><div class="up"><small>수혜</small>' + egEsc(x.win || "-") + '</div><div class="dn"><small>피해</small>' + egEsc(x.lose || "-") + '</div></div>' + (x.when ? '<div class="coreL"><small>시점</small>' + egEsc(x.when) + '</div>' : '') + (x.do ? '<div class="coreL act"><small>대응</small>' + egEsc(x.do) + '</div>' : '') + '</div>'; }).join("") + '</div>';
  var R = E.roadmap; if (R && (R.now || R.q || R.y1 || R.y3)) h += '<div class="anxH">방향 — 지금부터 3년</div><div class="egRoad">' + [["이번 달", R.now], ["3개월", R.q], ["1년", R.y1], ["3년", R.y3]].filter(function (x) { return x[1]; }).map(function (x) { return '<div><small>' + x[0] + '</small>' + egEsc(x[1]) + '</div>'; }).join("") + '</div>';
  if (E.protect.length || E.grow.length) h += '<div class="anxH">지키는 규칙 · 키우는 규칙</div><div class="anxTwo"><ul class="anxBear egProt">' + li(E.protect) + '</ul><ul class="anxBull">' + li(E.grow) + '</ul></div>';
  if (E.mine) h += '<div class="egMine"><small>내 자산에 적용하면</small>' + egEsc(E.mine) + '</div>';
  if (!(opt && opt.noDeck)) h += '<div class="anActs" style="margin-top:10px"><button class="primary" data-egdeck>🃏 예측 · 대응 카드 만들기</button><span class="briefDim">과거 사례 · 정책 · 세 갈래 길 · 방향 · 규칙을 카드로</span></div>';
  return h + '</div>';
}
/* 예측 · 대응 카드 묶음 */
function egDeck(name, E, meta) {
  E = egNorm(E); if (!E || typeof hubDraw !== "function") return null; var pages = [], cut = function (s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  if (E.paths.length) { var top = E.paths.slice().sort(function (a, b) { return (b.p || 0) - (a.p || 0); })[0]; pages.push({ name: "세갈래", top: ["앞으로 3개월,", "[[" + cut(top.name || "기본", 8) + (top.p != null ? " " + Math.round(top.p) + "%" : "") + "]]"], title: "앞으로 3개월 — 세 갈래 길", sub: "확률은 과거 빈도에서 출발한 추정 · 보장 아님", kind: "rows", data: E.paths.slice(0, 3).map(function (p) { var c = /나쁜|비관|하락/.test(p.name || "") ? NB_C.down : /좋은|낙관|상승/.test(p.name || "") ? NB_C.up : NB_C.navy; return [cut(p.name, 6), (p.what || "") + (p.do ? " → " + p.do : ""), p.p != null ? Math.round(p.p) + "%" : "", c, p.range || ""]; }), leftW: 130 }); }
  if (E.history.length) pages.push({ name: "과거", top: ["비슷한 적이", "[[" + E.history.length + "번 있었다]]"], title: "과거에서 배우기", sub: "같은 점 · 다른 점 · 그 뒤", kind: "text", data: { paras: [].concat.apply([], E.history.slice(0, 3).map(function (x) { return ["■ " + (x.case || ""), (x.after ? "그 뒤: " + x.after : "") + (x.lesson ? " — " + x.lesson : "")]; })).filter(Boolean).slice(0, 6), after: E.history[0].diff ? ["이번에 다른 점", E.history.slice(0, 2).map(function (x) { return x.diff; }).filter(Boolean).join(" · ")] : null } });
  if (E.policy.length) pages.push({ name: "정책", top: ["새 정책 · 이슈", "[[" + E.policy.length + "가지]]"], title: "새 정책 · 이슈 — 영향과 대응", sub: "무엇이 → 어디로 → 그래서", kind: "rows", data: E.policy.slice(0, 4).map(function (x) { return ["이슈", cut(x.what, 60) + (x.do ? " → " + x.do : ""), "", NB_C.navy, x.path || ""]; }), leftW: 90 });
  var R = E.roadmap; if (R && (R.now || R.q || R.y1 || R.y3)) pages.push({ name: "방향", top: ["지금부터 3년,", "[[이렇게 간다]]"], title: "방향 — 지금부터 3년", sub: "가까울수록 변수 · 멀수록 본질", kind: "rows", data: [["이번 달", R.now], ["3개월", R.q], ["1년", R.y1], ["3년", R.y3]].filter(function (x) { return x[1]; }).map(function (x) { return [x[0], x[1], "", NB_C.navy]; }), leftW: 130 });
  if (E.protect.length || E.grow.length) pages.push({ name: "규칙", top: ["지키는 규칙 " + E.protect.length, "[[키우는 규칙 " + E.grow.length + "]]"], title: "지키는 규칙 · 키우는 규칙", sub: "숫자로 정해 두면 흔들리지 않는다", kind: "rows", data: E.protect.slice(0, 3).map(function (x) { return ["지키기", x, "", NB_C.down]; }).concat(E.grow.slice(0, 3).map(function (x) { return ["키우기", x, "", NB_C.up]; })), leftW: 120 });
  if (!pages.length) return null;
  return hubDraw({ small: (typeof smKstDay === "function" ? smKstDay().slice(5).replace("-", ".") : "") + " · 예측 · 대응", hook: [name + ",", "[[앞으로 어떻게 할까]]"], lead: pages.map(function (p) { return p.title; }).slice(0, 6), meta: meta || "과거 일봉 통계(앱) + 최근 정책 · 기사(출처 표기) · 개인 분석이며 투자 권유 아님", pages: pages, close: ["여러분의 규칙은 무엇인가요?", ["예측은 틀릴 수 있어도", "규칙은 지킬 수 있어요."]], foot: "StockMind 예측 · 대응 · 투자 권유 아님" });
}
function egBindDeck(root, name, E, ctx) {
  var b = root && root.querySelector("[data-egdeck]"); if (!b) return;
  b.onclick = function () { var go = function () { var list = egDeck(name, E); if (!list) return typeof smToast === "function" && smToast("카드로 만들 내용이 없어요", "bad"); hubShow(name + " · 예측 · 대응", list, { ctx: ctx || "edge", modal: true, note: "답변의 edge 항목으로 만든 카드 — 확률 · 범위는 추정이에요" }); }; (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go); };
}

/* ---------- 앱 숫자만으로 만드는 카드: 닮은 과거 ---------- */
function egAnalogDeck() {
  var mk = typeof deckMk === "function" ? deckMk() : "all", syms = mk === "kr" ? ["^KS11", "^KQ11"] : mk === "us" ? ["^GSPC", "^IXIC"] : mk === "coin" ? ["BTC-USD", "ETH-USD"] : ["^KS11", "^GSPC", "BTC-USD"];
  var As = syms.map(egAnalog).filter(function (A) { return A && !A.thin; }); if (!As.length) return null;
  var A0 = As[0], h12 = function (A) { return A.h.filter(function (x) { return x.l === "1년"; })[0] || A.h[A.h.length - 1]; }, x0 = h12(A0);
  var pages = As.map(function (A) {
    var x = h12(A), h3 = A.h.filter(function (y) { return y.l === "3개월"; })[0];
    return { name: A.name, top: [A.name + ", 지금 같은 자리 뒤", "[[" + x.l + " 플러스 " + Math.round(x.win * 100) + "%]]"], title: A.name + " — 닮은 과거 " + A.n + "번", sub: egStateTxt(A.state), kind: "tiles",
      data: { tiles: A.h.slice(0, 4).map(function (y) { return { v: Math.round(y.win * 100) + "%", l: y.l + " 뒤 플러스 · 보통 " + egPct(y.med), color: y.win >= 0.6 ? NB_C.up : y.win < 0.45 ? NB_C.down : NB_C.navy }; }),
        rows: (function () { var done = A.eps.filter(function (e) { return e.r12 != null; }).slice(-4), open = A.eps.filter(function (e) { return e.r12 == null; }).slice(-1); return done.concat(open); })().map(function (e) { return [e.ym, "그때도 " + (A.state.v200 >= 0 ? "200일선 위" : "200일선 아래") + " · 고점 대비 비슷", e.r12 != null ? "1년 " + egPct(e.r12) : "진행 중", e.r12 == null ? NB_C.navy : e.r12 >= 0 ? NB_C.up : NB_C.down, e.r3 != null ? "3개월 " + egPct(e.r3) : ""]; }) },
      leftW: 150, note: (x.baseWin != null ? "아무 날 샀을 때 " + x.l + " 플러스 " + Math.round(x.baseWin * 100) + "% → 지금 자리는 " + (x.win - x.baseWin >= 0.05 ? "과거 기준 유리했던 자리" : x.win - x.baseWin <= -0.05 ? "과거 기준 불리했던 자리" : "평균과 비슷한 자리") + ". " : "") + (A.dip ? "단, 1년 안에 보통 " + egPct(A.dip.med) + "(최악 " + egPct(A.dip.worst) + ")까지 더 내려간 적이 있어요." : "") + (h3 ? "" : "") };
  });
  return hubDraw({ small: (typeof cDate === "function" ? cDate(A0.asOf) : "") + " · 닮은 과거", hook: ["지금 같은 자리,", "[[과거엔 그 뒤 어땠나]]"], lead: As.map(function (A) { var x = h12(A); return A.name + " · 닮은 과거 " + A.n + "번 · " + x.l + " 뒤 플러스 " + Math.round(x.win * 100) + "%"; }), meta: "기준: 1년 고점 대비 · 3개월 수익 · 200일선 위치가 비슷한 날(구간당 한 번) · 과거 빈도이며 보장 아님", pages: pages, close: ["과거가 반복되진 않지만,", ["확률을 알면", "덜 흔들려요."]], foot: "StockMind · 일봉 " + A0.years + "년치 직접 계산 · 투자 권유 아님" });
}
(function () {
  if (typeof storyDecks !== "function") return;
  var KEY = "analog", T = "🔁 닮은 과거 — 지금 같은 자리 뒤에는", D = "고른 시장의 지수(국내 코스피·코스닥 / 미국 S&P500·나스닥 / 코인 / 전체)를 과거 25년 일봉에서 찾아 1·3·6·12개월 뒤 플러스 비율 · 보통 · 최악";
  var need = function () { return ["^KS11", "^KQ11", "^GSPC", "^IXIC", "BTC-USD", "ETH-USD"]; };
  var d0 = storyDecks; storyDecks = function () { var out = d0.apply(this, arguments); out.splice(Math.min(out.length, 3), 0, { key: KEY, t: T, d: D, now: true, ready: true, group: "오늘 시장" }); return out; };
  var r0 = storyReady; storyReady = function (kind) { return kind === KEY ? true : r0.apply(this, arguments); };
  var p0 = storyPrepare; storyPrepare = function (key) { return key === KEY ? egEnsure(need()) : p0.apply(this, arguments); };
  var c0 = storyCards; storyCards = function (key) { return key === KEY ? egAnalogDeck() : c0.apply(this, arguments); };
  if (typeof hubTitleOf === "function") { var t0 = hubTitleOf; hubTitleOf = function (ctx) { return ctx === "story:" + KEY ? T.replace(/^\S+\s/, "") : t0.apply(this, arguments); }; }
})();

/* ---------- 분석(6틀) ---------- */
(function () {
  if (typeof anxBuildPrompt !== "function") return;
  var b0 = anxBuildPrompt; anxBuildPrompt = function () {
    var sym = typeof AN !== "undefined" ? AN.sym : null, idx = egIndexOf(sym), syms = [sym, idx].filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    return egEnsure(syms.concat(egPortSyms())).then(function () { return b0(); }).then(function (t) { return t + "\n" + egBlock(syms, true) + "\n(edge는 '## 요약 JSON' 의 JSON 안에 넣는다.)"; });
  };
  var d0 = anxDashHtml; anxDashHtml = function (it, J) { var h = d0.apply(this, arguments); try { if (J && J.edge) h += egExtraHtml(J.edge); } catch (e) { console.warn("eg", e); } return h; };
  var s0 = anxSections; anxSections = function (root) {
    var r = s0.apply(this, arguments);
    try {
      var sym = AN.sym, secs = root.querySelectorAll(".anSec");
      if (sym && secs[1] && !secs[1].querySelector(".egBox")) { var syms = [sym, egIndexOf(sym)].filter(function (s, i, a) { return a.indexOf(s) === i; }); var ready = syms.every(function (s) { return nbHist[s]; }); if (ready) secs[1].insertAdjacentHTML("beforeend", egAnalogHtml(syms, "닮은 과거 — " + egName(sym) + "와 시장")); else if (!EG["w:" + sym]) { EG["w:" + sym] = 1; egEnsure(syms).then(function () { if (currentTab === "analyst" && AN.sym === sym) renderAnalyst(); }); } }
      var ans = typeof anAnsLoad === "function" ? anAnsLoad() : [], mine = ans.filter(function (a) { return a.sym === sym; }), cur = mine.filter(function (a) { return a.id === AN.ansId; })[0] || mine.filter(function (a) { return a.scope === "all"; })[0] || mine[0];
      var J = cur && cur.text ? anxSumParse(cur.text) : null; if (J && J.edge) egBindDeck(root, cur.name || egName(sym), J.edge, "edge:" + sym);
    } catch (e) { console.warn("eg", e); }
    return r;
  };
})();

/* ---------- 리포트 ---------- */
(function () {
  if (typeof rpxPrompt !== "function") return;
  var syms = function (rp) { var s = rp && rp.sym, a = s ? [s, egIndexOf(s)] : rp && /S&P|미국|나스닥/.test(rp.title || "") ? ["^GSPC", "^IXIC"] : rp && /코인|비트/.test(rp.title || "") ? ["BTC-USD"] : ["^KS11", "^GSPC"]; return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); };
  var p0 = rpxPrompt; rpxPrompt = function (rp) { var t = p0.apply(this, arguments); try { t += "\n" + egBlock(syms(rp), true) + "\n(edge는 위 json 블록 안, 마지막 키로 넣는다. forecast의 세 시나리오와 edge.paths는 서로 모순되지 않게.)"; } catch (e) { console.warn("eg", e); } return t; };
  var o0 = rpxOpen; rpxOpen = function (rp) { var a = arguments, self = this; egEnsure(syms(rp).concat(egPortSyms())).then(function () { o0.apply(self, a); }); };
  if (typeof renderReport === "function") {
    var r0 = renderReport; renderReport = function () {
      var r = r0.apply(this, arguments);
      try {
        var pane = document.getElementById("rpPane"), rp = typeof RP !== "undefined" && RP.cur; if (!pane || !rp || RP.tab === "saved") return r;
        var S = syms(rp), ready = S.every(function (s) { return nbHist[s]; }), h = "";
        if (ready) h += egAnalogHtml(S, "닮은 과거 — 이 질문의 자산이 지금 같은 자리였을 때"); else if (!EG["rw:" + S.join()]) { EG["rw:" + S.join()] = 1; egEnsure(S).then(function () { if (currentTab === "report" && RP.cur === rp) renderReport(); }); }
        var E = RP.ai && RP.ai.out && RP.ai.out.edge; if (E) h += egExtraHtml(E);
        if (h) { var d = document.createElement("div"); d.className = "egRp"; d.innerHTML = h; pane.appendChild(d); if (E) egBindDeck(d, rp.name || rp.title || "리포트", E, "edge:report"); }
      } catch (e) { console.warn("eg", e); }
      return r;
    };
  }
})();

/* ---------- 본질 · 변수 ---------- */
(function () {
  if (typeof corePrompt !== "function") return;
  var IDX = ["^KS11", "^GSPC", "^IXIC", "BTC-USD"];
  var p0 = corePrompt; corePrompt = function () { var t = p0.apply(this, arguments); try { var mine = []; try { (loadHoldings().lots || []).forEach(function (L) { if (mine.indexOf(L.s) < 0 && mine.length < 6) mine.push(L.s); }); } catch (e) {} t += "\n" + egBlock(IDX.concat(mine.filter(function (s) { return IDX.indexOf(s) < 0; })), true) + "\n(edge는 위 json의 최상위, sources 뒤에 넣는다. scenarios · outlook과 모순되지 않게.)"; } catch (e) { console.warn("eg", e); } return t; };
  var a0 = coreAnsHtml; coreAnsHtml = function () { var h = a0.apply(this, arguments); try { var J = CORE.ans && CORE.ans.j; if (J && J.edge) h += egExtraHtml(J.edge); } catch (e) { console.warn("eg", e); } return h; };
  var r0 = renderCore; renderCore = function () {
    var r = r0.apply(this, arguments);
    try {
      var box = document.getElementById("coreBody"); if (!box || !CORE.ess) return r;
      if (!EG.coreWarm) { EG.coreWarm = 1; egEnsure(IDX.concat(egPortSyms())).then(function () { EG.coreReady = 1; if (currentTab === "core") renderCore(); }); }
      if (EG.coreReady && !box.querySelector(".egCore")) {
        var secs = box.querySelectorAll("section.anSec"), d = document.createElement("section"); d.className = "anSec egCore";
        d.innerHTML = '<div class="mkStep"><b>+</b> 예측과 방어 <small class="briefDim">과거가 말해 주는 확률 · 내 자산이 버틸 수 있는지</small></div><p class="corePlain">쉽게 말하면 — <b>"지금 같은 때에 사서 들고 있었다면 어땠나"</b>와 <b>"큰 하락이 다시 오면 내 자산은 얼마나 빠지나"</b>를 미리 보는 칸이에요. 예측을 맞히려는 게 아니라, 최악을 미리 알고 버틸 수 있는 비중을 정하려는 거예요. 아래 숫자는 ③ 프롬프트에 같이 들어가 Claude가 과거 사례 · 정책 영향 · 3개월 세 갈래 길 · 3년 방향을 써 줘요.</p>' + egAnalogHtml(IDX, "닮은 과거 — 주요 지수가 지금 같은 자리였을 때") + egPortHtml();
        if (secs.length >= 2) secs[1].parentNode.insertBefore(d, secs[1].nextSibling); else box.appendChild(d);
      }
      var J = CORE.ans && CORE.ans.j; if (J && J.edge) egBindDeck(box, "본질 · 변수", J.edge, "edge:core");
    } catch (e) { console.warn("eg", e); }
    return r;
  };
})();

(function () { var st = document.createElement("style"); st.id = "egCss"; st.textContent = [
".egBox{border:1px solid var(--admLine,#e3e7ee);border-radius:14px;padding:14px 16px;margin:12px 0;background:var(--admCard,#fff)}.egH{font-weight:800;font-size:14.5px;margin-bottom:8px}.egH small{display:block;font-weight:500;font-size:12px;color:#6b7686;margin-top:2px}",
".egA{border-top:1px solid #eef1f5;padding:10px 0}.egA:first-of-type{border-top:0}.egAH{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px}.egAH b{font-size:14px}.egAH span{font-size:12.5px;color:#556}.egAH em{font-style:normal;font-size:11.5px;color:#6b7686;margin-left:auto}.egAH em.egThin{color:#b9600f}",
".egGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.egCell{background:#f6f8fb;border-radius:10px;padding:9px 10px}.egCell small{font-size:11.5px;color:#6b7686;font-weight:700}.egCell>b{display:block;font-size:24px;font-weight:900;line-height:1.15;color:#1f3a68}.egCell>b.up{color:#c0392b}.egCell>b.dn{color:#1f5fbf}.egCell>i{font-style:normal;font-size:11px;color:#8a93a3}",
".egBar{position:relative;height:6px;border-radius:3px;background:#e3e8f0;margin:6px 0}.egBar u{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#3182f6}.egBar s{position:absolute;top:-3px;bottom:-3px;width:2px;background:#111}.egR{font-size:12px;color:#445}.egE{font-size:11.5px;font-weight:700;color:#6b7686;margin-top:2px}.egE.up{color:#c0392b}.egE.dn{color:#1f5fbf}",
".egNote{font-size:12.5px;line-height:1.55;color:#445;background:#fbf7ee;border-radius:10px;padding:8px 10px;margin-top:8px}.egEps{display:block;color:#6b7686;font-size:11.5px;margin-top:3px}",
".egW{display:grid;gap:5px;margin:4px 0 8px}.egWRow{display:grid;grid-template-columns:minmax(90px,150px) 1fr 44px;gap:8px;align-items:center;font-size:12.5px}.egWRow .egBar{margin:0}.egWRow b{text-align:right}.egChips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.egChips span{font-size:12px;background:#eef2f8;border-radius:999px;padding:3px 10px}",
".egFlags{display:grid;gap:5px;margin-bottom:8px}.egFlags>div{font-size:12.5px;border-radius:8px;padding:6px 10px;background:#eef8f2;border-left:4px solid #1d7f55}.egFlags>div.mid{background:#fff6e8;border-color:#b9600f}.egFlags>div.bad{background:#fcefef;border-color:#c03b3b}",
".egX{margin-top:6px}.egPaths{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.egPath{background:#f4f6fb;border-radius:12px;padding:10px 12px;border-top:4px solid #8090b0}.egPath.up{border-color:#c0392b}.egPath.dn{border-color:#1f5fbf}.egPH{display:flex;justify-content:space-between;align-items:baseline}.egPH em{font-style:normal;font-size:20px;font-weight:900}.egPW{font-size:13px;line-height:1.5;margin:4px 0}",
".egHist{display:grid;gap:8px}.egHi{background:#f7f8fb;border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.5}.egHi>b{font-size:13.5px}.egTwo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0}.egTwo>div{background:#fff;border-radius:8px;padding:6px 8px}.egTwo small,.egRoad small,.egMine small{display:block;font-weight:700;font-size:11px;color:#6b7686}.egTwo .up small{color:#c0392b}.egTwo .dn small{color:#1f5fbf}.egPathLine{font-size:12.5px;margin:4px 0}.egPathLine i{font-style:normal;color:#3182f6;font-weight:900}",
".egRoad{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.egRoad>div{background:#eef2fa;border-radius:10px;padding:8px 10px;font-size:12.5px;line-height:1.5;border-left:3px solid #3182f6}.egMine{background:#fbf7ee;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.55;margin-top:10px}.egProt{background:#eef2fa!important}.egRp{margin-top:14px}",
"@media(max-width:560px){.egTwo{grid-template-columns:1fr}.egAH em{margin-left:0}}",
"[data-theme=dark] .egBox{background:#161b24;border-color:#263041}[data-theme=dark] .egCell,[data-theme=dark] .egPath,[data-theme=dark] .egHi,[data-theme=dark] .egRoad>div,[data-theme=dark] .egNote,[data-theme=dark] .egMine{background:#1e2533;color:#dde}[data-theme=dark] .egTwo>div{background:#161b24}[data-theme=dark] .egCell>b{color:#9db8ff}"
].join(""); document.head.appendChild(st); })();

/* ============================================================
   v12.94 장기 평균선 이탈 사례 — "200주선(주봉 200) 아래로 내려온 적이 몇 번이었고, 그 뒤 어떻게 됐나"
   · 이탈 = 평균선 위에 8주 이상 있다가 주봉 종가가 선 아래로 내려온 주 (하루 이틀 스친 것은 세지 않는다)
   · 끝 = 다시 선 위에서 4주 연속 마감
   · 사례마다: 이탈 시점 · 선 아래 머문 기간 · 이탈한 가격에서 더 빠진 폭(최저) · 이탈 시점에 샀다면 1·2·3년 뒤
   · 사례가 5번 미만이면 '확률'이 아니라 '사례 목록'으로만 보여 준다. 레버리지 상품은 따로 경고한다.
   ============================================================ */
function egWeekly(rows) { var out = [], k0 = null; for (var i = 0; i < rows.length; i++) { var k = Math.floor((rows[i].t / EG_DAY + 3) / 7); if (k === k0) out[out.length - 1] = rows[i]; else { out.push(rows[i]); k0 = k; } } return out; }
function egLev(sym) { var n = egName(sym) || ""; return /[23]배|레버리지|인버스|곱버스/.test(n) || /^(SOXL|SOXS|TQQQ|SQQQ|UPRO|SPXL|SPXS|TECL|FNGU|LABU|TNA|NVDL|TSLL|SSO|QLD)$/.test(sym); }
function egMaBreak(sym, mode) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || rows.length < 400) return null; mode = mode || "w200";
  var key = "mb:" + mode + ":" + sym + ":" + rows[rows.length - 1].t + ":" + rows.length; if (EG.memo[key] !== undefined) return EG.memo[key];
  var wk = mode === "w200", S = wk ? egWeekly(rows) : rows, LEN = 200, ARM = wk ? 8 : 40, END = wk ? 4 : 20, n = S.length; if (n < LEN + 20) return (EG.memo[key] = null);
  var ma = new Array(n), sum = 0; for (var i = 0; i < n; i++) { sum += S[i].c; if (i >= LEN) sum -= S[i - LEN].c; ma[i] = i >= LEN - 1 ? sum / LEN : null; }
  var last = rows[rows.length - 1], fwd = function (t0, c0, days) { var tt = t0 + days * EG_DAY; if (tt > last.t) return null; var lo = 0, hi = rows.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (rows[m].t < tt) lo = m + 1; else hi = m; } return rows[lo].c / c0 - 1; };
  var eps = [], above = 0, cur = null, back = 0;
  for (i = LEN - 1; i < n; i++) {
    var b = S[i].c < ma[i];
    if (!cur) { if (b && above >= ARM) { cur = { i0: i, t0: S[i].t, c0: S[i].c, lowC: S[i].c, lowT: S[i].t, gap: S[i].c / ma[i] - 1 }; back = 0; } above = b ? 0 : above + 1; }
    else {
      if (S[i].c < cur.lowC) { cur.lowC = S[i].c; cur.lowT = S[i].t; } var g = S[i].c / ma[i] - 1; if (g < cur.gap) cur.gap = g;
      if (!b) { back++; if (back >= END) { cur.t1 = S[i - END + 1].t; eps.push(cur); cur = null; above = END; } } else back = 0;
    }
  }
  if (cur) { cur.open = true; eps.push(cur); }
  eps.forEach(function (e) { e.ym = egYm(e.t0); e.drop = e.lowC / e.c0 - 1; e.days = Math.round(((e.t1 || last.t) - e.t0) / EG_DAY); e.r1 = fwd(e.t0, e.c0, 365); e.r2 = fwd(e.t0, e.c0, 730); e.r3 = fwd(e.t0, e.c0, 1095);
    /* v12.95 일봉으로 다시 본다: ① 선 아래 있는 동안의 최저(주봉 종가보다 정확) ② 이탈 뒤 3년 안(아직 3년이 안 됐으면 지금까지)의 최고점 · 최저점 ③ 그 기간 하루 최대 상승 · 하락 — 모두 종가 기준 */
    var tEnd = Math.min(last.t, e.t0 + 1095 * EG_DAY), tBelow = e.t1 || last.t, lo = 0, hi = rows.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (rows[m].t < e.t0) lo = m + 1; else hi = m; }
    var mx = { c: e.c0, t: e.t0 }, mn = { c: e.c0, t: e.t0 }, up = null, dn = null, bl = { c: e.c0, t: e.t0 };
    for (var j = lo + 1; j < rows.length && rows[j].t <= tEnd; j++) { var r = rows[j], d = r.c / rows[j - 1].c - 1; if (r.c > mx.c) mx = r; if (r.c < mn.c) mn = r; if (r.t <= tBelow && r.c < bl.c) bl = r; if (isFinite(d)) { if (!up || d > up.v) up = { v: d, t: r.t }; if (!dn || d < dn.v) dn = { v: d, t: r.t }; } }
    e.lowC = bl.c; e.lowT = bl.t; e.drop = bl.c / e.c0 - 1; e.lowYm = egYm(e.lowT);
    e.hi = { v: mx.c / e.c0 - 1, ym: egYm(mx.t) }; e.lo = { v: mn.c / e.c0 - 1, ym: egYm(mn.t) }; e.dUp = up && { v: up.v, d: new Date(up.t).toISOString().slice(2, 10).replace(/-/g, ".") }; e.dDn = dn && { v: dn.v, d: new Date(dn.t).toISOString().slice(2, 10).replace(/-/g, ".") }; e.full3 = last.t >= e.t0 + 1095 * EG_DAY; });
  var gapNow = ma[n - 1] ? S[n - 1].c / ma[n - 1] - 1 : null, done = eps.filter(function (e) { return !e.open; }), open = eps.filter(function (e) { return e.open; })[0] || null;
  return (EG.memo[key] = { sym: sym, name: egName(sym), mode: mode, label: wk ? "200주선" : "200일선", from: egYm(S[LEN - 1].t), years: Math.round((last.t - S[LEN - 1].t) / (365.25 * EG_DAY) * 10) / 10, eps: eps, done: done, open: open, below: gapNow != null && gapNow < 0, gapNow: gapNow, lev: egLev(sym) });
}
function egDur(d) { return d < 7 ? "1주 미만" : d >= 60 ? Math.round(d / 30.4) + "개월" : Math.round(d / 7) + "주"; }
function egMaLine(sym, mode) {
  var M = egMaBreak(sym, mode); if (!M) return null;
  var head = "- " + M.name + " · " + M.label + " (" + M.from + "부터 " + M.years + "년치 관찰" + (M.lev ? " · 레버리지 상품" : "") + "): 지금 선 " + (M.below ? "아래" : "위") + " " + egPct(M.gapNow) + " | 과거 이탈 " + M.done.length + "번" + (M.open ? " + 이번(" + (M.below ? "진행 중" : "선 위로 복귀 확인 중") + ", " + M.open.ym + " 이탈 · " + egDur(M.open.days) + "째 · 이탈가 대비 최저 " + egPct(M.open.lo.v) + " · 최고 " + egPct(M.open.hi.v) + (M.open.dUp ? " · 하루 최대 " + egPct(M.open.dUp.v, 1) + "/" + egPct(M.open.dDn.v, 1) : "") + ")" : "");
  if (!M.done.length) return head + " | 끝난 사례 없음";
  return head + " | " + M.done.slice(-6).map(function (e) { return e.ym + " 이탈→" + egDur(e.days) + " 머묾·이탈가에서 최저 " + egPct(e.drop) + "(" + e.lowYm + ")·1년 뒤 " + egPct(e.r1) + "·2년 뒤 " + egPct(e.r2) + "·3년 뒤 " + egPct(e.r3) + "·3년 안 최저 " + egPct(e.lo.v) + "(" + e.lo.ym + ")·최고 " + egPct(e.hi.v) + "(" + e.hi.ym + ")" + (e.dUp ? "·하루 최대 " + egPct(e.dUp.v, 1) + "/" + egPct(e.dDn.v, 1) : ""); }).join(" / ") + (M.done.length < 5 ? " | ※ 사례 " + M.done.length + "번뿐 — 확률로 말하지 말 것" : "");
}
function egMaHtml(syms, title) {
  var Ms = []; syms.forEach(function (s) { var w = egMaBreak(s, "w200"); if (w) Ms.push(w); });
  if (!Ms.length) return "";
  var h = '<div class="egBox"><div class="egH">' + egEsc(title || "장기 평균선(200주선) 이탈 사례") + ' <small>주봉 종가가 200주 평균 아래로 내려온 때와 그 뒤 — 선 위에 8주 이상 있다가 내려온 것만 세고, 다시 4주 연속 선 위면 끝난 것으로 봐요</small></div>';
  Ms.forEach(function (M) {
    var st = M.open ? (M.below ? '<em class="egThin">지금 선 아래 ' + egPct(M.gapNow) + ' · ' + M.open.ym + ' 이탈 · ' + egDur(M.open.days) + '째</em>' : '<em class="egThin">' + M.open.ym + ' 이탈 뒤 지금은 선 위 ' + egPct(M.gapNow) + ' — 4주 연속 선 위면 끝난 것으로 봐요</em>') : '<em>지금 선 ' + (M.below ? "아래" : "위") + ' ' + egPct(M.gapNow) + '</em>';
    h += '<div class="egA"><div class="egAH"><b>' + egEsc(M.name) + '</b><span>' + M.from + '부터 ' + M.years + '년치 · 과거 이탈 ' + M.done.length + '번' + (M.open ? ' + 이번' : '') + '</span>' + st + '</div>';
    if (M.eps.length) {
      var cc = function (v) { return v == null ? '<span class="briefDim">아직</span>' : '<b class="' + (v >= 0 ? "up" : "dn") + '">' + egPct(v) + '</b>'; }, ex = function (o, d1) { return o ? '<b class="' + (o.v >= 0 ? "up" : "dn") + '">' + egPct(o.v, d1 ? 1 : 0) + '</b><small>' + (o.ym || o.d) + '</small>' : '-'; };
      h += '<div class="dxWrap"><table class="dgT egMaT"><thead><tr><th>이탈 시점</th><th>선 아래<br>머문 기간</th><th>1년 뒤</th><th>2년 뒤</th><th>3년 뒤</th><th>이후 최저점<br><small>3년 안 · 이탈가 대비</small></th><th>이후 최고점<br><small>3년 안 · 이탈가 대비</small></th><th>하루 최대 상승</th><th>하루 최대 하락</th></tr></thead><tbody>' + M.eps.map(function (e) { var part = e.full3 ? '' : ' <small>지금까지</small>'; return '<tr' + (e.open ? ' class="egNow"' : '') + '><td><b>' + e.ym + '</b>' + (e.open ? ' <small>이번 · ' + (M.below ? "진행 중" : "복귀 확인 중") + '</small>' : '') + '</td><td>' + egDur(e.days) + (e.open ? '째' : '') + '</td><td>' + cc(e.r1) + '</td><td>' + cc(e.r2) + '</td><td>' + cc(e.r3) + '</td><td>' + ex(e.lo) + part + '</td><td>' + ex(e.hi) + part + '</td><td>' + ex(e.dUp, 1) + '</td><td>' + ex(e.dDn, 1) + '</td></tr>'; }).join("") + '</tbody></table></div>';
      var note = [];
      if (M.done.length) { var wd = Math.min.apply(null, M.done.map(function (e) { return e.drop; })), ld = Math.max.apply(null, M.done.map(function (e) { return e.days; })); var wl = Math.min.apply(null, M.done.map(function (e) { return e.lo.v; })), deeper = M.done.filter(function (e) { return e.lo.v <= -0.05; }).length, wdn = Math.min.apply(null, M.done.map(function (e) { return e.dDn ? e.dDn.v : 0; }));
        note.push('<b>읽는 법</b> — 모든 숫자는 "선을 깨고 내려온 그 주 종가에 샀다면" 기준이고 종가로 계산했어요(장중 고가·저가는 더 클 수 있어요). 이후 최저점 · 최고점 · 하루 최대 변동은 이탈 뒤 3년 안에서 찾았어요. 과거 ' + M.done.length + '번 중 ' + deeper + '번은 이탈가보다 5% 넘게 더 내려갔고, 가장 깊었을 때 ' + egPct(wl) + ', 선 아래 가장 오래 머문 기간은 ' + egDur(ld) + ', 하루에 가장 크게 빠진 날은 ' + egPct(wdn, 1) + '였어요.'); }
      if (M.done.length < 5) note.push('<b>사례가 ' + M.done.length + '번뿐</b>이라 "확률"이 아니라 "이런 적이 있었다"로만 봐야 해요. 관찰 기간(' + M.from + '~, ' + M.years + '년)에 없던 종류의 긴 약세장은 이 표에 들어 있지 않아요.');
      if (M.lev) note.push('<b>레버리지 상품 주의</b> — 하루 수익률의 2~3배를 따라가서, 지수가 오르내리며 제자리로 돌아와도 원금은 줄어요(변동성 손실). 기초 지수가 하루 -33%면 3배 상품은 원금 대부분을 잃을 수 있고, 과거에 회복했다는 사실이 다음에도 회복한다는 뜻은 아니에요. 한 번에 사기보다 "더 빠질 수 있는 폭"을 견딜 금액만 나눠서 보는 근거로 쓰세요.');
      h += '<div class="egNote">' + note.join('<br>') + '</div>';
    } else h += '<div class="briefDim">이 기간에 200주선 아래로 내려온 적이 없어요.</div>';
    h += '</div>';
  });
  return h + '</div>';
}
/* 프롬프트 · 화면에 끼워 넣기 */
(function () {
  var b0 = egBlock; egBlock = function (syms, withPort) {
    var t = b0.apply(this, arguments), L = []; (syms || []).forEach(function (s) { var a = egMaLine(s, "w200"), d = egMaLine(s, "d200"); if (a) L.push(a); if (d) L.push(d); });
    var add = ["", "[장기 평균선 이탈 사례 — 앱 계산] 평균선 위에 오래 있다가 종가가 선 아래로 내려온 때(200주선 = 주봉 200개 평균, 200일선 = 일봉 200개 평균)와 그 뒤. 수익률은 '이탈한 그때 샀다면' 기준"];
    add = add.concat(L.length ? L : ["- 계산할 만큼 긴 일봉이 없음"]);
    add.push("→ edge.history에 이 사례를 반드시 쓴다: 이탈 뒤 '더 빠진 폭'과 '선 아래 머문 기간'을 먼저, 그다음 1~3년 뒤 결과. 사례 5번 미만이면 확률·승률이라는 말을 쓰지 않는다. 레버리지 상품이면 기초 지수의 같은 시점과 비교하고 변동성 손실 · 상장 이후 기간이 짧다는 점(큰 약세장을 겪지 않았을 수 있음)을 꼭 쓴다. edge.protect에는 '이탈가에서 과거 최대 추가 하락'을 견디는 분할 계획(횟수·간격·한도)을 숫자로.");
    var mark = "\n=== 예측 · 대응 · 방향 (edge)"; var i = t.indexOf(mark); return i >= 0 ? t.slice(0, i) + "\n" + add.join("\n") + t.slice(i) : t + "\n" + add.join("\n");
  };
  var a0 = egAnalogHtml; egAnalogHtml = function (syms) { var h = a0.apply(this, arguments); try { h += egMaHtml(syms); } catch (e) { console.warn("eg", e); } return h; };
  var st = document.createElement("style"); st.textContent = ".egMaT td,.egMaT th{text-align:center;font-size:12.5px;padding:7px 8px}.egMaT td:first-child,.egMaT th:first-child{text-align:left}.egMaT b.up{color:#c0392b}.egMaT b.dn{color:#1f5fbf}.egMaT small{color:#6b7686;font-size:11px;display:block;font-weight:500}.egMaT td:first-child small{display:inline}.egMaT th{line-height:1.3}.egMaT tr.egNow td{background:#fff6e8}[data-theme=dark] .egMaT tr.egNow td{background:#2a2114}"; document.head.appendChild(st);
})();

/* ============================================================
   v12.96 종합 평가표 — 여러 기법의 결과를 한 표로, 점수와 해석까지
   두 축으로 본다:  체력(오래 살아남고 위기마다 회복했나 · 돈을 버는 회사인가)  ×  자리(지금 가격이 그 자산의 과거에 비해 싼가 · 흐름은 어떤가)
   · 체력 = 회복력(60%) + 기업 정보(40%)     — 기업 정보가 없는 자산(ETF · 지수 · 코인)은 회복력만
   · 자리 = MDD(30%) + 장기 평균선(25%) + 기술 지표(25%) + 닮은 과거(10%) + 매크로(10%)
   · 종합 = 체력 55% + 자리 45%   (오래 살아남아 같은 방향으로 회복해 온 기록을 더 무겁게)
   항목마다 실제 숫자 · 점수 · 한 줄 해석을 붙인다. 계산할 수 없는 항목은 빼고 남은 것으로만 점수를 낸다(빈칸을 0점으로 치지 않는다).
   점수는 과거 기록과 지금 자리를 정리한 것이지 미래 수익의 약속이 아니다.
   ============================================================ */
function egStep(v, steps, lowBest) { if (v == null || !isFinite(v)) return null; for (var i = 0; i < steps.length; i++) { if (lowBest ? v <= steps[i][0] : v >= steps[i][0]) return steps[i][1]; } return steps[steps.length - 1][1]; }
function egScore(sym) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || rows.length < 260) return null;
  var n = rows.length, last = rows[n - 1], yrsAll = (last.t - rows[0].t) / (365.25 * EG_DAY), key = "sc:" + sym + ":" + last.t + ":" + n + ":" + (typeof CORE !== "undefined" && CORE.fund && CORE.fund[sym] ? 1 : 0) + ":" + (typeof MAC !== "undefined" && MAC.doc && !MAC.doc.none ? 1 : 0);
  if (EG.memo[key] !== undefined) return EG.memo[key];
  var lev = egLev(sym), coin = /-USD$/.test(sym), cats = [], it = function (name, val, pts, txt) { return pts === "info" ? { n: name, v: val, p: null, t: txt } : pts == null ? null : { n: name, v: val, p: Math.round(pts), t: txt }; };   // "info" = 점수 없이 참고로만
  var cat = function (id, name, axis, w, items, note) { items = items.filter(Boolean); var sc = items.filter(function (x) { return x.p != null; }); if (!sc.length) return; var s = sc.reduce(function (a, x) { return a + x.p; }, 0) / sc.length; cats.push({ id: id, name: name, axis: axis, w: w, score: Math.round(s), items: items, note: note || "" }); };
  /* --- 낙폭 기록 (종가 기준) --- */
  var pk = -Infinity, pkT = 0, ddArr = new Array(n), worst = 0, worstT = 0, worstC = null, worstPk = null, worstPkT = 0; for (var i = 0; i < n; i++) { if (rows[i].c > pk) { pk = rows[i].c; pkT = rows[i].t; } ddArr[i] = rows[i].c / pk - 1; if (ddArr[i] < worst) { worst = ddArr[i]; worstT = rows[i].t; worstC = rows[i].c; worstPk = pk; worstPkT = pkT; } }
  var px = function (v) { return egPx(sym, v); }, needUp = last.c > 0 ? pk / last.c - 1 : null;
  var cur = ddArr[n - 1], eps = drawdownEpisodes(rows, 0.2), closed = eps.filter(function (e) { return e.recoverI != null; }), openEp = eps.filter(function (e) { return e.recoverI == null; })[0] || null;
  var recs = closed.map(function (e) { return (rows[e.recoverI].t - rows[e.peakI].t) / (365.25 * EG_DAY); }).sort(function (a, b) { return a - b; }), recMed = recs.length ? egMed(recs) : null, recMax = recs.length ? recs[recs.length - 1] : null;
  var cagr = yrsAll >= 3 ? Math.pow(last.c / rows[0].c, 1 / yrsAll) - 1 : null, f3 = egFwdAll(rows, 3 * 365), f1 = egFwdAll(rows, 365);   // v12.98 전 기간으로(전엔 최근 10년만 세면서 그렇게 적지 않았음)
  /* ① 회복력 */
  var rate = eps.length ? closed.length / eps.length : null;
  cat("res", "회복력 — 오래 살아남고 위기마다 돌아왔나", "body", 0.6, [
    it("관찰 기간", yrsAll.toFixed(1) + "년", egStep(yrsAll, [[20, 100], [12, 85], [7, 65], [4, 45], [0, 25]]), yrsAll >= 20 ? "20년 넘는 기록 — 여러 번의 위기를 거친 자료예요" : yrsAll >= 12 ? "10년 넘는 기록 — 큰 위기를 한두 번은 겪었어요" : yrsAll >= 7 ? "기록이 길지 않아요 — 겪어 보지 않은 종류의 약세장이 있을 수 있어요" : "기록이 짧아 '살아남았다'고 말하기 일러요"),
    it("큰 하락(-20% 이상) 뒤 회복", eps.length ? closed.length + " / " + eps.length + "번 회복" + (openEp ? " (지금 1번 진행 중)" : "") : "큰 하락 없음", eps.length ? 35 + 65 * (closed.length / eps.length) * Math.min(1, closed.length / 3) : 55, !eps.length ? "큰 하락을 겪은 적이 없어 회복력은 아직 확인되지 않았어요" : closed.length === eps.length ? "큰 하락 " + eps.length + "번을 모두 전고점까지 회복했어요" : openEp && closed.length === eps.length - 1 ? "끝난 하락 " + closed.length + "번은 모두 회복했고, 지금 한 번이 진행 중이에요(" + egPct(openEp.dd) + ")" : "회복하지 못한 하락이 있어요"),
    it("전고점 회복까지 (보통 · 가장 길게)", recMed != null ? (recMed < 1 ? Math.round(recMed * 12) + "개월" : recMed.toFixed(1) + "년") + " · " + (recMax < 1 ? Math.round(recMax * 12) + "개월" : recMax.toFixed(1) + "년") : "-", egStep(recMed, [[1, 100], [2, 80], [4, 55], [99, 30]], true), recMed == null ? "" : recMax >= 5 ? "가장 길 때는 " + recMax.toFixed(1) + "년이 걸렸어요 — 그만큼 기다릴 수 있는 돈이어야 해요" : "회복이 비교적 빨랐어요 — 가장 길 때 " + (recMax < 1 ? Math.round(recMax * 12) + "개월" : recMax.toFixed(1) + "년")),
    it("전 기간 연평균 수익", cagr != null ? egPct(cagr, 1) : "-", egStep(cagr, [[0.12, 100], [0.08, 85], [0.05, 68], [0.02, 50], [0, 35], [-9, 12]]), cagr == null ? "" : cagr >= 0.08 ? "길게 보면 뚜렷한 우상향이에요" : cagr >= 0.02 ? "길게 보면 완만한 우상향이에요" : cagr >= 0 ? "길게 봐도 거의 제자리예요" : "길게 보면 내려왔어요 — 우상향 자산이 아니에요"),
    it("아무 날 사서 3년 뒤 플러스였던 비율 (전 기간)", f3 ? Math.round(f3.win * 100) + "% (" + f3.n + "번 · 최악 " + egPct(f3.worst) + ")" : "-", f3 ? f3.win * 100 : null, !f3 ? "" : f3.win >= 0.85 ? "언제 샀어도 3년 들고 있으면 대부분 플러스였어요" : f3.win >= 0.65 ? "3년을 들고 있어도 3번 중 1번쯤은 손실이었어요" : "3년 보유로도 손실이 잦았어요 — 사는 시점이 중요했던 자산이에요")
  ], lev ? "레버리지 상품이라 회복력 점수를 최대 60점으로 눌렀어요 — 지수는 회복해도 이 상품은 원금이 줄 수 있고(변동성 손실), 하루 급락에 구조적으로 약해요." : coin ? "코인은 이익이 없는 자산이라 '기업 정보' 없이 회복력만으로 체력을 봐요. 기록도 주식보다 짧아요." : "");
  if (lev && cats.length && cats[cats.length - 1].id === "res") cats[cats.length - 1].score = Math.min(60, cats[cats.length - 1].score);
  /* ② 기업 정보 */
  var F = typeof CORE !== "undefined" && CORE.fund ? CORE.fund[sym] : null;
  if (F && !lev) cat("fund", "기업 정보 — 돈을 벌고, 늘리고 있나", "body", 0.4, [
    it("ROE (자기자본으로 버는 힘)", F.roe != null ? F.roe.toFixed(1) + "%" : "-", egStep(F.roe, [[20, 100], [15, 90], [10, 75], [5, 55], [0.01, 35], [-999, 10]]), F.roe == null ? "" : F.roe >= 15 ? "자본 대비 이익이 높아요 — 우량 기업의 기준(15%)을 넘어요" : F.roe >= 8 ? "평균적인 수익성이에요" : F.roe > 0 ? "수익성이 낮아요" : "적자예요"),
    it("영업이익률", F.margin != null ? (F.margin * 100).toFixed(1) + "%" : "-", egStep(F.margin, [[0.25, 100], [0.15, 88], [0.08, 70], [0.03, 50], [0.0001, 35], [-9, 10]]), F.margin == null ? "" : F.margin >= 0.15 ? "가격 결정력이 있는 사업이에요" : F.margin >= 0.05 ? "보통 수준의 마진이에요" : F.margin > 0 ? "마진이 얇아 경기 · 원가에 민감해요" : "영업 적자예요"),
    it("매출 성장 (최근 3개 연도 연평균)", F.revG != null ? egPct(F.revG, 1) : "-", egStep(F.revG, [[0.15, 100], [0.08, 85], [0.03, 65], [0, 50], [-0.05, 35], [-9, 15]]), F.revG == null ? "" : F.revG >= 0.08 ? "매출이 꾸준히 커지고 있어요" : F.revG >= 0 ? "매출이 정체에 가까워요" : "매출이 줄고 있어요"),
    it("영업이익 성장 (최근 3개 연도 연평균)", F.opG != null ? egPct(F.opG, 1) : "-", egStep(F.opG, [[0.15, 100], [0.08, 85], [0.03, 65], [0, 50], [-0.1, 30], [-9, 12]]), F.opG == null ? "" : F.opG >= 0.08 ? "이익이 늘고 있어요 — 주가가 길게 오르는 근거예요" : F.opG >= 0 ? "이익이 제자리예요" : "이익이 줄고 있어요 — 주가 회복의 근거가 약해요"),
    it("PER (이익 대비 가격)", F.per != null ? F.per.toFixed(1) + "배" : "-", F.per == null ? null : F.per <= 0 ? 15 : egStep(F.per, [[10, 85], [18, 75], [28, 60], [45, 42], [9999, 25]], true), F.per == null ? "" : F.per <= 0 ? "적자라 PER을 쓸 수 없어요" : F.per <= 12 ? "이익에 비해 가격이 낮아요 — 이익이 줄 것으로 보는 건 아닌지 확인" : F.per <= 28 ? "시장 평균 근처의 가격이에요" : "성장 기대가 가격에 많이 들어 있어요 — 기대에 못 미치면 크게 빠질 수 있어요")
  ], F.lastY ? "확정 실적 기준 연도: " + F.lastY + " · 출처 네이버 증권" : "");
  /* ③ MDD */
  var deeper = 0, cnt = 0; for (i = 0; i < n; i += 3) { cnt++; if (ddArr[i] < cur) deeper++; } var pct = cnt ? deeper / cnt : null;   // 지금보다 더 깊이 빠져 있던 날의 비율
  var byY = {}, ys = []; for (i = 0; i < n; i++) { var y = new Date(rows[i].t).getUTCFullYear(); if (!byY[y]) { byY[y] = { pk: rows[i].c, w: 0 }; ys.push(y); } var B = byY[y]; if (rows[i].c > B.pk) B.pk = rows[i].c; if (rows[i].c / B.pk - 1 < B.w) B.w = rows[i].c / B.pk - 1; }
  var yAvg = ys.length >= 4 ? ys.slice(0, -1).reduce(function (a, y) { return a + byY[y].w; }, 0) / (ys.length - 1) : null, ratio = worst < 0 ? cur / worst : null;
  cat("mdd", "MDD — 지금 낙폭이 이 자산의 역사에서 어느 정도인가", "spot", 0.3, [
    it("지금 고점 대비", cur > -0.005 ? "0% (최고가 " + px(pk) + ")" : egPct(cur) + " · 고점 " + px(pk) + "(" + egYm(pkT) + ") → 지금 " + px(last.c), egStep(-cur, [[0.5, 95], [0.35, 88], [0.2, 75], [0.1, 60], [0.03, 45], [0, 32]]), cur > -0.03 ? "사상 최고가 근처예요 — 싸게 사는 자리는 아니에요" : cur > -0.1 ? "고점에서 조금 내려온 정도예요" : cur > -0.2 ? "조정 구간이에요(-10~-20%)" : "큰 하락 구간이에요 — 체력이 좋은 자산이라면 과거엔 기회였던 깊이예요"),
    it("역대 최대 낙폭", egPct(worst) + " · " + px(worstPk) + "(" + egYm(worstPkT) + ") → " + px(worstC) + "(" + egYm(worstT) + ")" + (ratio != null ? " · 지금은 그 깊이의 " + Math.round(ratio * 100) + "%" : ""), ratio == null ? null : 30 + 65 * Math.min(1, ratio), ratio == null ? "" : ratio >= 0.8 ? "역대 최악에 가까운 깊이예요" : ratio >= 0.4 ? "역대 최악의 절반 안팎까지 내려왔어요 — 최악까지는 " + egPct((1 + worst) / (1 + cur) - 1) + " 더 빠질 여지가 있었어요" : "역대 최악과는 거리가 멀어요 — 같은 일이 오면 지금 가격에서 " + egPct((1 + worst) / (1 + cur) - 1) + "까지 내려갈 수 있다는 뜻이기도 해요"),
    cur <= -0.03 && needUp != null ? it("전고점까지 필요한 상승", egPct(needUp) + " (" + px(last.c) + " → " + px(pk) + ")", "info", needUp >= 1 ? "원금을 되찾으려면 지금 가격이 " + (1 + needUp).toFixed(1) + "배가 돼야 해요 — 빠진 폭보다 회복에 필요한 폭이 훨씬 커요(-50%면 +100%)" : "고점까지 " + egPct(needUp) + " 올라야 해요 — 과거 회복 기간(회복력 줄)과 함께 보세요") : null,
    it("지금보다 더 깊이 빠져 있던 날", pct != null ? "전체의 " + Math.round(pct * 100) + "%" : "-", pct == null ? null : 30 + 65 * (1 - pct), pct == null ? "" : pct <= 0.1 ? "과거 열흘 중 아흐레는 지금보다 고점에 가까웠어요 — 드문 깊이예요" : pct <= 0.4 ? "지금 정도의 낙폭은 가끔 있던 수준이에요" : "지금 정도의 낙폭은 흔했어요 — 이 자산에서는 평소 모습이에요"),
    it("한 해 최대 낙폭 평균", yAvg != null ? egPct(yAvg) + " (" + (ys.length - 1) + "년 평균)" : "-", yAvg == null ? null : egStep(-yAvg, [[0.5, 25], [0.35, 40], [0.22, 58], [0.13, 75], [0, 90]]), yAvg == null ? "" : "해마다 이 정도는 빠졌어요 — " + (cur < yAvg ? "지금은 평년보다 깊은 하락이에요" : "지금 낙폭은 평년 범위 안이에요"))
  ]);
  /* ④ 장기 평균선 */
  var W = egMaBreak(sym, "w200"), D = egMaBreak(sym, "d200"), wDone = W ? W.done : [], w1 = wDone.filter(function (e) { return e.r1 != null; }), w1p = w1.filter(function (e) { return e.r1 > 0; }).length, wLo = wDone.length ? Math.min.apply(null, wDone.map(function (e) { return e.lo.v; })) : null;
  var d1 = D ? D.done.filter(function (e) { return e.r1 != null; }) : [], d1p = d1.filter(function (e) { return e.r1 > 0; }).length;
  cat("ma", "장기 평균선 — 4년 평균 가격(200주선)과 견주면", "spot", 0.25, [
    W ? it("200주선 대비", egPct(W.gapNow), egStep(W.gapNow, [[-0.2, 95], [0, 86], [0.15, 68], [0.4, 50], [0.8, 36], [99, 24]], true), W.gapNow < 0 ? "4년 평균 가격보다 싸요 — 이 자산에서 " + (wDone.length + (W.open ? 1 : 0)) + "번째로 온 자리예요" : W.gapNow < 0.15 ? "4년 평균 가격 근처예요" : W.gapNow < 0.8 ? "4년 평균보다 꽤 위예요" : "4년 평균에서 아주 멀리 올라와 있어요 — 과열 구간에서 자주 보이는 거리예요") : null,
    W && w1.length ? it("200주선 이탈 뒤 1년 (과거)", w1p + " / " + w1.length + "번 플러스", 35 + 60 * (w1p / w1.length) * Math.min(1, w1.length / 4), (w1.length < 5 ? "사례 " + w1.length + "번뿐 — 확률이 아니라 기록으로만. " : "") + (wLo != null ? "이탈 뒤 3년 안 가장 깊었던 추가 하락 " + egPct(wLo) : "")) : null,
    D && d1.length >= 3 ? it("200일선 이탈 뒤 1년 (과거)", d1p + " / " + d1.length + "번 플러스", 35 + 60 * (d1p / d1.length), "200일선은 더 자주 깨져서 사례가 많아요 — " + (d1p / d1.length >= 0.7 ? "깨진 뒤에도 1년 뒤엔 대체로 회복했어요" : "깨진 뒤 1년 안에 회복하지 못한 적이 적지 않아요")) : null
  ]);
  /* ⑤ 기술 지표 */
  var c = rows.map(function (r) { return r.c; }), rsi = typeof rsiWilder === "function" && n > 30 ? rsiWilder(c.slice(-300), 14) : null, avg = function (k) { if (n < k) return null; var s = 0; for (var q = n - k; q < n; q++) s += c[q]; return s / k; }, m20 = avg(20), m60 = avg(60), m200 = avg(200);
  var at = function (days) { var tt = last.t - days * EG_DAY, j = n - 1; while (j > 0 && rows[j].t > tt) j--; return rows[j].c; }, r12 = yrsAll >= 1 ? last.c / at(365) - 1 : null, r3 = last.c / at(91) - 1;
  var i1 = n - 1; while (i1 > 0 && rows[i1 - 1].t >= last.t - 365 * EG_DAY) i1--; var rs = []; for (var q2 = Math.max(1, i1); q2 < n; q2++) rs.push(c[q2] / c[q2 - 1] - 1); var mu = rs.reduce(function (a, b) { return a + b; }, 0) / (rs.length || 1), vol = rs.length > 100 ? Math.sqrt(rs.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / rs.length) * Math.sqrt(rs.length) : null;
  var arr = m20 && m60 && m200 ? (m20 > m60 && m60 > m200 ? "정배열" : m20 < m60 && m60 < m200 ? "역배열" : "혼조") : null;
  cat("tech", "기술 지표 — 지금 흐름과 과열 · 침체", "spot", 0.25, [
    it("RSI(14일)", rsi != null ? rsi.toFixed(0) : "-", egStep(rsi, [[30, 85], [45, 70], [60, 60], [70, 48], [101, 30]], true), rsi == null ? "" : rsi <= 30 ? "침체 구간(30 이하) — 단기로 많이 팔린 상태예요" : rsi >= 70 ? "과열 구간(70 이상) — 단기로 많이 오른 상태예요" : "중립 구간이에요"),
    it("이동평균 배열 (20 · 60 · 200일)", arr || "-", arr === "정배열" ? 78 : arr === "역배열" ? 38 : arr ? 55 : null, arr === "정배열" ? "짧은 선이 긴 선 위 — 오르는 흐름이 이어지고 있어요" : arr === "역배열" ? "짧은 선이 긴 선 아래 — 내리는 흐름이에요. 반등이 선에 막히기 쉬워요" : arr ? "선들이 엉켜 있어요 — 방향이 정해지지 않았어요" : ""),
    it("최근 3개월 · 1년 수익", egPct(r3) + " · " + egPct(r12), r12 == null ? null : egStep(r12, [[0.3, 80], [0.1, 70], [0, 58], [-0.2, 45], [-9, 32]]), r12 == null ? "" : r12 >= 0.1 ? "1년 흐름이 좋아요(모멘텀)" : r12 >= -0.2 ? "1년 흐름은 밋밋해요" : "1년 흐름이 나빠요 — 싸졌지만 떨어지는 중일 수 있어요"),
    it("1년 변동성 (연)", vol != null ? Math.round(vol * 100) + "%" : "-", egStep(vol, [[0.18, 88], [0.3, 70], [0.5, 50], [0.8, 32], [99, 18]], true), vol == null ? "" : vol <= 0.2 ? "움직임이 차분해요 — 지수 수준" : vol <= 0.4 ? "개별 주식 수준의 흔들림이에요" : "흔들림이 매우 커요 — 하루 ±" + Math.round(vol / Math.sqrt(252) * 200) + "% 움직임이 드물지 않아요. 비중을 작게")
  ]);
  /* ⑥ 닮은 과거 */
  var A = egAnalog(sym), h1 = A && !A.thin ? A.h.filter(function (x) { return x.l === "1년"; })[0] : null;
  if (h1) cat("ana", "닮은 과거 — 지금 같은 자리 뒤 1년", "spot", 0.1, [it("1년 뒤 플러스였던 비율", Math.round(h1.win * 100) + "% (" + h1.n + "번 · 보통 " + egPct(h1.med) + " · 최악 " + egPct(h1.worst) + ")", h1.win * 100, h1.baseWin != null ? (h1.win - h1.baseWin >= 0.05 ? "아무 날(" + Math.round(h1.baseWin * 100) + "%)보다 좋았던 자리예요" : h1.win - h1.baseWin <= -0.05 ? "아무 날(" + Math.round(h1.baseWin * 100) + "%)보다 나빴던 자리예요" : "아무 날(" + Math.round(h1.baseWin * 100) + "%)과 비슷했어요") : "")]);
  /* ⑦ 매크로 */
  var mi = [], vx = nbHist["^VIX"], vixN = vx && vx.length ? vx[vx.length - 1].c : null;
  if (vixN != null) mi.push(it("공포지수(VIX)", vixN.toFixed(1), vixN >= 30 ? 62 : vixN >= 20 ? 50 : 60, vixN >= 30 ? "공포 구간 — 흔들림이 크지만, 과거엔 나눠 사기 시작한 사람이 유리했던 구간이에요" : vixN >= 20 ? "불안 구간 — 변동이 커지는 중이에요" : "평온 구간 — 시장이 위험을 낮게 보고 있어요"));
  try { var fed = typeof macSer === "function" ? macSer("fed") : null; if (fed && fed.v.length >= 2) { var dlt = fed.v[fed.v.length - 1] - fed.v[fed.v.length - 2]; mi.push(it("미국 기준금리 방향", fed.v[fed.v.length - 1].toFixed(2) + "% (마지막 변경 " + (dlt < 0 ? "인하" : dlt > 0 ? "인상" : "동결") + ")", dlt < 0 ? 70 : dlt > 0 ? 40 : 55, dlt < 0 ? "금리를 내리는 중 — 주식에는 대체로 우호적이었어요(경기 침체로 내리는 경우는 예외)" : dlt > 0 ? "금리를 올리는 중 — 성장주 · 레버리지에 부담이에요" : "")); }
    var t10 = typeof macSer === "function" ? macSer("us10y") : null; if (t10 && t10.v.length > 260) { var nowY = t10.v[t10.v.length - 1], agoY = typeof macAt === "function" ? macAt(t10, t10.t[t10.t.length - 1] - 365 * EG_DAY) : null; if (agoY != null) mi.push(it("미 10년 금리 (1년 변화)", nowY.toFixed(2) + "% (" + (nowY - agoY >= 0 ? "+" : "") + (nowY - agoY).toFixed(2) + "%p)", nowY - agoY <= -0.3 ? 68 : nowY - agoY >= 0.5 ? 40 : 55, nowY - agoY <= -0.3 ? "장기 금리가 내려왔어요 — 주식 가격에 우호적" : nowY - agoY >= 0.5 ? "장기 금리가 올랐어요 — 비싼 주식에 부담" : "장기 금리는 1년 전과 비슷해요")); }
    var kr = !/\.K[SQ]$|^\^K/.test(sym) && typeof macSer === "function" ? macSer("krw") : null; if (kr && kr.v.length > 260) { var k0 = kr.v[kr.v.length - 1], s1 = 0, c1 = 0; for (var z = kr.v.length - 1; z >= 0 && kr.t[z] >= kr.t[kr.t.length - 1] - 365 * EG_DAY; z--) { s1 += kr.v[z]; c1++; } var ka = s1 / c1, kg = k0 / ka - 1; mi.push(it("원/달러 (1년 평균 대비)", Math.round(k0).toLocaleString() + "원 (" + egPct(kg, 1) + ")", kg >= 0.05 ? 40 : kg <= -0.05 ? 68 : 55, kg >= 0.05 ? "환율이 1년 평균보다 높아요 — 지금 달러 자산을 사면 환율이 내려올 때 수익이 깎여요" : kg <= -0.05 ? "환율이 1년 평균보다 낮아요 — 달러 자산을 사기에 환율 부담이 적어요" : "환율은 1년 평균 근처예요")); }
  } catch (e) {}
  cat("mac", "매크로 — 지금 바깥 환경", "spot", 0.1, mi, "매크로는 미리 맞히기 어려운 변수라 비중을 가장 작게(자리 점수의 10%) 뒀어요.");
  /* --- 합산 --- */
  var axis = function (a) { var cs = cats.filter(function (x) { return x.axis === a; }), w = cs.reduce(function (s, x) { return s + x.w; }, 0); return w ? Math.round(cs.reduce(function (s, x) { return s + x.score * x.w; }, 0) / w) : null; };
  var body = axis("body"), spot = axis("spot"); if (body == null || spot == null) return (EG.memo[key] = null);
  var total = Math.round(body * 0.55 + spot * 0.45), grade = total >= 80 ? "매우 좋음" : total >= 68 ? "좋음" : total >= 55 ? "보통" : total >= 42 ? "주의" : "나쁨";
  /* 한 줄 판정은 '체력'과 '싼 정도(MDD + 장기 평균선)'로 정하고, 흐름(기술 지표)은 덧붙인다 — 흐름이 좋아 자리 점수가 높은 것을 '싸다'고 읽지 않게 */
  var byId = {}; cats.forEach(function (x) { byId[x.id] = x; });
  var cheap = byId.mdd && byId.ma ? Math.round((byId.mdd.score * 0.3 + byId.ma.score * 0.25) / 0.55) : byId.mdd ? byId.mdd.score : spot, flow = byId.tech ? byId.tech.score : null;
  var read = body >= 65 && cheap >= 62 ? ["튼튼한 자산이 싸진 자리", "오래 살아남아 회복해 온 기록이 있고, 지금 가격은 그 자산의 과거에 비해 낮은 편이에요. 과거 기록으로는 나눠서 모으기 좋았던 구간이에요. 다만 '더 빠질 수 있는 폭'(MDD 줄)을 견딜 금액만요."]
    : body >= 65 ? ["튼튼하지만 싸지는 않은 자리", "체력은 검증됐지만 가격이 과거에 비해 싼 편은 아니에요. 정해 둔 적립은 이어 가되, 큰 금액은 낙폭이 깊어질 때를 기다리는 쪽이 과거엔 유리했어요."]
    : cheap >= 62 ? ["싸 보이지만 체력 확인이 필요한 자리", "가격은 많이 내려왔는데 회복력이나 이익 기록이 약해요. 싼 데에는 이유가 있을 수 있어요 — 왜 빠졌는지, 이익이 돌아올 근거가 있는지부터 확인하세요."]
    : ["서두를 이유가 없는 자리", "체력도 가격도 뚜렷한 강점이 없어요. 기다리며 지켜봐도 늦지 않아요."];
  if (flow != null) read[1] += flow >= 68 ? " 흐름(기술 지표 " + flow + "점)은 오르는 쪽이에요." : flow <= 48 ? " 흐름(기술 지표 " + flow + "점)은 아직 내리는 쪽이라, 한 번에 사기보다 나눠서 보는 편이 맞아요." : " 흐름(기술 지표 " + flow + "점)은 뚜렷한 방향이 없어요.";
  var top = cats.slice().sort(function (a, b) { return b.score - a.score; }), strong = top.slice(0, 2).map(function (x) { return x.name.split(" — ")[0] + " " + x.score; }), weak = top.slice(-2).reverse().map(function (x) { return x.name.split(" — ")[0] + " " + x.score; });
  return (EG.memo[key] = { sym: sym, name: egName(sym), total: total, grade: grade, body: body, spot: spot, cheap: cheap, cats: cats, read: read, strong: strong, weak: weak, lev: lev, hasFund: cats.some(function (x) { return x.id === "fund"; }), asOf: last.t, worst: worst, cur: cur, raw: { pk: pk, pkT: pkT, lastC: last.c, worstC: worstC, worstPk: worstPk, worstT: worstT, worstPkT: worstPkT, needUp: needUp, yrs: yrsAll, eps: eps.length, closed: closed.length, openDd: openEp ? openEp.dd : null, recMed: recMed, recMax: recMax, cagr: cagr, f3: f3, pct: pct, yAvg: yAvg, wGap: W ? W.gapNow : null, wN: wDone.length, wOpen: !!(W && W.open), wLo: wLo, w1: w1.length, w1p: w1p, vol: vol, rsi: rsi, arr: arr } });
}
function egScoreLines(sym) {
  var S = egScore(sym); if (!S) return [];
  var L = ["- " + S.name + " 종합 " + S.total + "점(" + S.grade + ") = 체력 " + S.body + " × 55% + 자리 " + S.spot + " × 45% (자리 중 '싼 정도' " + S.cheap + ") → 「" + S.read[0] + "」" + (S.hasFund ? "" : " (기업 정보 없음 — 체력은 회복력만)") + (S.lev ? " · 레버리지 상품(회복력 60점 상한)" : "")];
  S.cats.forEach(function (c) { L.push("  · " + c.name.split(" — ")[0] + " " + c.score + "점: " + c.items.map(function (x) { return x.n + " " + x.v + (x.p != null ? "(" + x.p + ")" : "(참고)"); }).join(" / ")); });
  return L;
}
function egScoreHtml(sym) {
  var S = egScore(sym); if (!S) return "";
  var col = function (p) { return p >= 68 ? "#1d7f55" : p >= 55 ? "#3182f6" : p >= 42 ? "#b9600f" : "#c03b3b"; }, bar = function (p) { return '<div class="egBar"><u style="width:' + p + '%;background:' + col(p) + '"></u></div>'; };
  var h = '<div class="egBox egSc"><div class="egH">종합 평가표 — ' + egEsc(S.name) + ' <small>여러 기법의 결과를 한 표로 · 체력(오래 살아남고 회복했나, 돈을 버나) × 자리(지금 가격이 과거에 비해 싼가, 흐름은) · ' + (typeof cDate === "function" ? cDate(S.asOf) : "") + ' 종가 기준</small></div>';
  h += '<div class="egScTop"><div class="egScTot" style="border-color:' + col(S.total) + '"><b style="color:' + col(S.total) + '">' + S.total + '</b><span>종합 · ' + S.grade + '</span></div><div class="egScAx"><div><small>체력 <i>55%</i></small><b>' + S.body + '</b>' + bar(S.body) + '</div><div><small>자리 <i>45%</i></small><b>' + S.spot + '</b>' + bar(S.spot) + '</div></div><div class="egScRead"><b>' + egEsc(S.read[0]) + '</b><p>' + egEsc(S.read[1]) + '</p><small>강한 곳: ' + egEsc(S.strong.join(" · ")) + ' / 약한 곳: ' + egEsc(S.weak.join(" · ")) + '</small></div></div>';
  h += S.cats.map(function (c, i) { return '<details class="egScCat"' + (i < 1 ? " open" : "") + '><summary><span class="egScAxTag ' + c.axis + '">' + (c.axis === "body" ? "체력" : "자리") + '</span><b>' + egEsc(c.name) + '</b><em style="color:' + col(c.score) + '">' + c.score + '</em>' + bar(c.score) + '</summary><table class="dgT egScT"><thead><tr><th>기법 · 지표</th><th>지금 값</th><th>점수</th><th>해석</th></tr></thead><tbody>' + c.items.map(function (x) { return '<tr><td><b>' + egEsc(x.n) + '</b></td><td>' + egEsc(x.v) + '</td><td>' + (x.p != null ? '<b style="color:' + col(x.p) + '">' + x.p + '</b>' : '<span class="briefDim">참고</span>') + '</td><td>' + egEsc(x.t) + '</td></tr>'; }).join("") + '</tbody></table>' + (c.note ? '<div class="egNote">' + egEsc(c.note) + '</div>' : '') + '</details>'; }).join("");
  h += '<div class="egNote"><b>점수 읽는 법</b> — 68점 이상 좋음 · 55~67 보통 · 42~54 주의 · 그 아래 나쁨. 체력 점수는 "오래 살아남아 같은 방향으로 회복해 왔는가"를, 자리 점수는 "지금이 그 자산의 과거에 비해 싼 자리인가"를 봐요. 자리 점수는 싸질수록 올라가므로, <b>체력이 낮은데 자리만 높은 경우</b>는 좋은 신호가 아니에요. 계산할 수 없는 항목은 빼고 남은 것으로 점수를 냈고' + (S.hasFund ? '' : ', 이 자산은 기업 정보가 없어 체력을 회복력만으로 봤어요') + '. 과거 기록을 정리한 점수이며 앞으로의 수익을 약속하지 않아요 — 그 시기의 정책 · 금리 · 국제 정세는 ③ 프롬프트로 Claude에게 물어 함께 보세요.</div>';
  return h + '</div>';
}
(function () {
  /* 프롬프트: 평가표를 넘기고, Claude가 동의/이견과 그 시대 배경을 쓰게 한다 */
  var b0 = egBlock; egBlock = function (syms, withPort) {
    var t = b0.apply(this, arguments), L = []; (syms || []).slice(0, 4).forEach(function (s) { L = L.concat(egScoreLines(s)); });
    if (!L.length) return t;
    var add = ["", "[앱 종합 평가표 — 여러 기법을 점수로] 체력(회복력 · 기업 정보) 55% + 자리(MDD · 장기 평균선 · 기술 지표 · 닮은 과거 · 매크로) 45%. 괄호 안은 항목 점수(0~100). 자리 점수는 그 자산의 과거에 비해 쌀수록 높다."].concat(L);
    add.push("→ edge 안에 \"review\" 키를 추가한다: { \"agree\": \"평가표에서 동의하는 점 2가지(숫자 인용)\", \"differ\": \"다르게 보는 점 — 점수가 놓친 것(사업 구조 변화 · 일회성 이익 · 규제 · 경쟁 등) 2가지\", \"era\": \"과거 큰 하락 2~3번이 각각 어떤 배경(정책 · 금리 · 국제 정세 · 당시 분위기)에서 왔고 무엇이 회복을 만들었는지, 지금과 같은 점 · 다른 점\", \"score\": 앱 점수를 그대로 쓰거나 고친 0~100 정수, \"why\": \"고쳤다면 이유 한 줄\" }. '오래 살아남아 위기마다 회복한 기록'은 강점으로 인정하되, 그 회복을 만든 조건이 지금도 있는지를 꼭 따진다.");
    var mark = "\n=== 예측 · 대응 · 방향 (edge)", i = t.indexOf(mark); return i >= 0 ? t.slice(0, i) + "\n" + add.join("\n") + t.slice(i) : t + "\n" + add.join("\n");
  };
  var n0 = egNorm; egNorm = function (E) { var o = n0.apply(this, arguments), R = E && E.review; if (R && typeof R === "object" && (R.agree || R.differ || R.era)) { o = o || { history: [], policy: [], paths: [], roadmap: null, protect: [], grow: [], mine: "" }; var sc = parseFloat(R.score); o.review = { agree: R.agree || "", differ: R.differ || "", era: R.era || "", score: isFinite(sc) ? Math.max(0, Math.min(100, Math.round(sc))) : null, why: R.why || "" }; } return o; };
  var x0 = egExtraHtml; egExtraHtml = function (E, opt) {
    var h = x0.apply(this, arguments), N = egNorm(E), R = N && N.review; if (!R) return h;
    var add = '<div class="anxH">평가표에 대한 Claude 의견</div><div class="egHi">' + (R.score != null ? '<div class="egPH"><b>Claude가 본 점수</b><em>' + R.score + '</em></div>' + (R.why ? '<div class="coreL"><small>이유</small>' + egEsc(R.why) + '</div>' : '') : '') + '<div class="egTwo"><div class="up"><small>동의하는 점</small>' + egEsc(R.agree || "-") + '</div><div class="dn"><small>다르게 보는 점</small>' + egEsc(R.differ || "-") + '</div></div>' + (R.era ? '<div class="coreL"><small>그때의 배경</small>' + egEsc(R.era) + '</div>' : '') + '</div>';
    return h ? h.replace('<div class="egX">', '<div class="egX">' + add) : '<div class="egX">' + add + '</div>';
  };
  /* 분석 화면: ② 아래 첫머리에 평가표 */
  if (typeof anxSections === "function") { var s0 = anxSections; anxSections = function (root) {
    var r = s0.apply(this, arguments);
    try { var sym = AN.sym, secs = root.querySelectorAll(".anSec"); if (sym && secs[1] && !secs[1].querySelector(".egSc")) {
      var need = [sym, "^VIX"], ok = need.every(function (s) { return nbHist[s]; }), done = EG["sd:" + sym];
      if (ok && done) { var hh = egScoreHtml(sym); if (hh) { var first = secs[1].querySelector(".egBox"); if (first) first.insertAdjacentHTML("beforebegin", hh); else secs[1].insertAdjacentHTML("beforeend", hh); } }
      else if (!EG["sw:" + sym]) { EG["sw:" + sym] = 1; Promise.all([egEnsure(need), typeof coreFund === "function" ? coreFund(sym).catch(function () {}) : null, typeof macroEnsure === "function" ? macroEnsure().catch(function () {}) : null]).then(function () { EG["sd:" + sym] = 1; if (typeof CORE !== "undefined" && CORE.fund && CORE.fund[sym] === undefined) CORE.fund[sym] = null; if (currentTab === "analyst" && AN.sym === sym) renderAnalyst(); }); }
    } } catch (e) { console.warn("eg", e); }
    return r;
  }; }
  /* 분석 프롬프트를 만들기 전에 기업 정보 · 매크로도 받아 둔다 */
  if (typeof anxBuildPrompt === "function") { var p0 = anxBuildPrompt; anxBuildPrompt = function () { var sym = typeof AN !== "undefined" ? AN.sym : null, self = this, a = arguments; return Promise.all([egEnsure([sym, "^VIX"]), sym && typeof coreFund === "function" ? coreFund(sym).catch(function () {}) : null, typeof macroEnsure === "function" ? macroEnsure().catch(function () {}) : null]).then(function () { return p0.apply(self, a); }); }; }
  var st = document.createElement("style"); st.textContent = [
    ".egScTop{display:grid;grid-template-columns:130px minmax(180px,240px) 1fr;gap:14px;align-items:center;margin:6px 0 12px}.egScTot{border:5px solid #3182f6;border-radius:50%;width:118px;height:118px;display:flex;flex-direction:column;align-items:center;justify-content:center}.egScTot b{font-size:40px;font-weight:900;line-height:1}.egScTot span{font-size:11.5px;color:#556;margin-top:3px}",
    ".egScAx>div{display:grid;grid-template-columns:70px 34px 1fr;gap:8px;align-items:center;margin:6px 0}.egScAx small{font-weight:800;font-size:12.5px}.egScAx small i{font-style:normal;color:#8a93a3;font-weight:500;font-size:11px}.egScAx b{font-size:17px;font-weight:900;text-align:right}.egScAx .egBar{margin:0;height:8px}",
    ".egScRead{background:#f6f8fb;border-radius:12px;padding:10px 14px}.egScRead b{font-size:15px}.egScRead p{margin:4px 0;font-size:13px;line-height:1.55}.egScRead small{color:#6b7686;font-size:11.5px}",
    ".egScCat{border-top:1px solid #eef1f5;padding:8px 0}.egScCat summary{display:grid;grid-template-columns:44px 1fr 34px 120px;gap:10px;align-items:center;cursor:pointer;list-style:none;font-size:13.5px}.egScCat summary::-webkit-details-marker{display:none}.egScCat summary em{font-style:normal;font-weight:900;font-size:17px;text-align:right}.egScCat summary .egBar{margin:0;height:7px}",
    ".egScAxTag{font-size:11px;font-weight:800;border-radius:6px;padding:2px 0;text-align:center;background:#e8f0fe;color:#1f5fbf}.egScAxTag.body{background:#e7f5ee;color:#1d7f55}.egScT{margin-top:8px;table-layout:fixed;width:100%}.egScT th:nth-child(1){width:27%}.egScT th:nth-child(2){width:25%}.egScT th:nth-child(4){width:auto}.egScT td,.egScT th{font-size:12.5px;padding:7px 8px;vertical-align:top;line-height:1.5}.egScT td:nth-child(3),.egScT th:nth-child(3){text-align:center;width:44px}",
    "@media(max-width:720px){.egScTop{grid-template-columns:1fr}.egScTot{margin:0 auto}.egScCat summary{grid-template-columns:40px 1fr 30px}.egScCat summary .egBar{display:none}.egScT td:nth-child(2){white-space:normal}}",
    "[data-theme=dark] .egScRead{background:#1e2533;color:#dde}[data-theme=dark] .egScCat{border-color:#263041}[data-theme=dark] .egScTot span{color:#aab}"
  ].join(""); document.head.appendChild(st);
})();

/* ============================================================
   v12.97 ① 이탈 사례 · MDD에 가격(단가)과 1년 상세  ② 깊이 읽기  ③ 전 종목 매일 스캔  ④ 신규 상장 점검표
   ============================================================ */
function egPx(sym, v) { if (v == null || !isFinite(v)) return "-"; var krw = /\.K[SQ]$|^\^K/.test(sym || ""); if (/^\^/.test(sym || "")) return v.toLocaleString(undefined, { maximumFractionDigits: v < 1000 ? 2 : 0 }); return krw ? Math.round(v).toLocaleString() + "원" : "$" + (v >= 1000 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(2) : v.toFixed(v >= 1 ? 2 : 4)); }
function egSwingThr(sym) { return egLev(sym) || /-USD$/.test(sym) ? 0.25 : 0.15; }
/* 이탈 뒤 1년: 최고(상승폭 · 가격 · 때) · 최저(하락폭 · 가격 · 때) · 큰 오르내림 횟수(직전 꺾인 곳에서 thr 이상 움직인 횟수) */
function egMaY1(M) {
  if (!M || M._y1) return M; var rows = nbHist[M.sym]; if (!rows) return M; var last = rows[rows.length - 1], thr = egSwingThr(M.sym);
  M.eps.forEach(function (e) {
    var lo = 0, hi = rows.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (rows[m].t < e.t0) lo = m + 1; else hi = m; }
    var tEnd = Math.min(last.t, e.t0 + 365 * EG_DAY), mx = rows[lo], mn = rows[lo], piv = rows[lo].c, dir = 0, ups = 0, dns = 0, ext = rows[lo].c;
    for (var j = lo + 1; j < rows.length && rows[j].t <= tEnd; j++) {
      var r = rows[j]; if (r.c > mx.c) mx = r; if (r.c < mn.c) mn = r;
      if (dir >= 0 && r.c > ext) ext = r.c; if (dir <= 0 && r.c < ext) ext = r.c;
      if (dir === 0) { if (r.c / piv - 1 >= thr) { dir = 1; ups++; ext = r.c; } else if (r.c / piv - 1 <= -thr) { dir = -1; dns++; ext = r.c; } }
      else if (dir === 1 && r.c / ext - 1 <= -thr) { dir = -1; dns++; piv = ext; ext = r.c; }
      else if (dir === -1 && r.c / ext - 1 >= thr) { dir = 1; ups++; piv = ext; ext = r.c; }
    }
    e.y1 = { full: last.t >= e.t0 + 365 * EG_DAY, hi: { v: mx.c / e.c0 - 1, c: mx.c, ym: egYm(mx.t) }, lo: { v: mn.c / e.c0 - 1, c: mn.c, ym: egYm(mn.t) }, ups: ups, dns: dns, thr: thr, loFirst: mn.t < mx.t };
    e.nowV = last.c / e.c0 - 1;
  });
  M.lastC = last.c; M._y1 = 1; return M;
}
egMaHtml = function (syms, title) {
  var Ms = []; (syms || []).forEach(function (s) { var w = egMaY1(egMaBreak(s, "w200")); if (w) Ms.push(w); });
  if (!Ms.length) return "";
  var cc = function (v) { return v == null ? '<span class="briefDim">아직</span>' : '<b class="' + (v >= 0 ? "up" : "dn") + '">' + egPct(v) + '</b>'; };
  var h = '<div class="egBox"><div class="egH">' + egEsc(title || "장기 평균선(200주선) 이탈 사례") + ' <small>주봉 종가가 200주 평균(약 4년 평균 가격) 아래로 내려온 때와 그 뒤 — 선 위에 8주 이상 있다가 내려온 것만 세고, 다시 4주 연속 선 위면 끝난 것으로 봐요 · 모든 수익률은 "이탈한 그 주 종가(이탈가)에 샀다면" 기준 · 분할 반영 종가</small></div>';
  Ms.forEach(function (M) {
    var px = function (v) { return egPx(M.sym, v); };
    var st = M.open ? (M.below ? '<em class="egThin">지금 선 아래 ' + egPct(M.gapNow) + ' · ' + M.open.ym + ' 이탈 · ' + egDur(M.open.days) + '째</em>' : '<em class="egThin">' + M.open.ym + ' 이탈 뒤 지금은 선 위 ' + egPct(M.gapNow) + ' — 4주 연속 선 위면 끝난 것으로 봐요</em>') : '<em>지금 선 ' + (M.below ? "아래" : "위") + ' ' + egPct(M.gapNow) + '</em>';
    h += '<div class="egA"><div class="egAH"><b>' + egEsc(M.name) + '</b><span>' + M.from + '부터 ' + M.years + '년치 · 과거 이탈 ' + M.done.length + '번' + (M.open ? ' + 이번' : '') + ' · 지금 ' + px(M.lastC) + '</span>' + st + '</div>';
    if (!M.eps.length) { h += '<div class="briefDim">이 기간에 200주선 아래로 내려온 적이 없어요.</div></div>'; return; }
    h += '<div class="egEpL">' + M.eps.map(function (e) {
      var y = e.y1 || {}, part = y.full ? "" : " (지금까지)";
      return '<div class="egEp' + (e.open ? " now" : "") + '"><div class="egEpH"><b>' + e.ym + ' 이탈</b><span>이탈가 ' + px(e.c0) + '</span><span>선 아래 ' + egDur(e.days) + (e.open ? '째' : '') + '</span>' + (e.open ? '<i>이번 · ' + (M.below ? "진행 중" : "복귀 확인 중") + '</i>' : '') + '<em>지금 ' + px(M.lastC) + ' ' + cc(e.nowV) + '</em></div>' +
        '<div class="egEpG"><div><small>1년 뒤</small>' + cc(e.r1) + '</div><div><small>2년 뒤</small>' + cc(e.r2) + '</div><div><small>3년 뒤</small>' + cc(e.r3) + '</div>' +
        '<div class="w"><small>1년 안 최저' + part + '</small><b class="dn">' + egPct(y.lo ? y.lo.v : null) + '</b> <span>' + (y.lo ? px(y.lo.c) + ' · ' + y.lo.ym : '') + '</span></div>' +
        '<div class="w"><small>1년 안 최고' + part + '</small><b class="up">' + egPct(y.hi ? y.hi.v : null) + '</b> <span>' + (y.hi ? px(y.hi.c) + ' · ' + y.hi.ym : '') + '</span></div>' +
        '<div class="w"><small>큰 오르내림 (±' + Math.round((y.thr || 0.15) * 100) + '% 이상)</small><b>' + ((y.ups || 0) + (y.dns || 0)) + '번</b> <span>상승 ' + (y.ups || 0) + ' · 하락 ' + (y.dns || 0) + '</span></div>' +
        '<div class="w"><small>3년 안 최저 · 최고</small><b class="dn">' + egPct(e.lo.v) + '</b> · <b class="up">' + egPct(e.hi.v) + '</b> <span>' + e.lo.ym + ' · ' + e.hi.ym + '</span></div>' +
        '<div class="w"><small>하루 최대 상승 · 하락</small>' + (e.dUp ? '<b class="up">' + egPct(e.dUp.v, 1) + '</b> · <b class="dn">' + egPct(e.dDn.v, 1) + '</b> <span>' + e.dUp.d + ' · ' + e.dDn.d + '</span>' : '-') + '</div></div>' +
        '<div class="egEpT">' + egEsc(egEpRead(M, e)) + '</div></div>';
    }).join("") + '</div>';
    var note = [], D = M.done;
    if (D.length) {
      var deep = D.filter(function (e) { return e.y1 && e.y1.lo.v <= -0.1; }).length, loFirst = D.filter(function (e) { return e.y1 && e.y1.loFirst && e.y1.lo.v <= -0.05; }).length, wl = Math.min.apply(null, D.map(function (e) { return e.y1 ? e.y1.lo.v : 0; })), ld = Math.max.apply(null, D.map(function (e) { return e.days; })), w1 = D.filter(function (e) { return e.r1 != null; }), p1 = w1.filter(function (e) { return e.r1 > 0; }).length, sw = Math.round(D.reduce(function (a, e) { return a + (e.y1 ? e.y1.ups + e.y1.dns : 0); }, 0) / D.length);
      note.push('<b>깊이 읽기</b> — 과거 ' + D.length + '번 중 1년 뒤 플러스는 ' + p1 + '/' + w1.length + '번이었어요. 그런데 결과만 보면 놓치는 게 있어요. ① <b>이탈가가 바닥이 아니었어요</b>: ' + deep + '번은 1년 안에 이탈가보다 10% 넘게 더 내려갔고(가장 깊게 ' + egPct(wl) + '), ' + loFirst + '번은 최저점이 최고점보다 먼저 왔어요 — 사자마자 손실을 보고 버틴 뒤에야 올랐다는 뜻이에요. ② <b>가는 길이 험했어요</b>: 1년 동안 큰 오르내림이 평균 ' + sw + '번 있었어요. 중간에 팔고 싶어지는 순간이 그만큼 있었다는 거예요. ③ <b>기간은 예측이 안 돼요</b>: 선 아래 머문 기간이 가장 길 때 ' + egDur(ld) + '였어요. 그래서 이 신호는 "지금 한 번에"가 아니라 "여기서부터 ' + egPct(wl) + '까지 내려가도 계속 살 수 있게 몇 번에 나눌까"를 정하는 데 쓰는 게 맞아요.');
      if (D.length < 5) note.push('<b>사례가 ' + D.length + '번뿐</b>이라 확률이 아니라 기록으로만 봐야 해요. 관찰 기간(' + M.from + '~, ' + M.years + '년)에 없던 종류의 긴 약세장은 이 표에 들어 있지 않아요.');
    }
    if (M.lev) note.push('<b>레버리지 상품 주의</b> — 하루 수익률의 2~3배를 따라가서, 지수가 오르내리며 제자리로 돌아와도 원금은 줄어요(변동성 손실). 위 "큰 오르내림" 횟수가 많을수록 이 손실이 커져요. 과거에 회복했다는 사실이 다음에도 회복한다는 뜻은 아니에요.');
    if (note.length) h += '<div class="egNote">' + note.join('<br>') + '</div>';
    h += '</div>';
  });
  return h + '</div>';
};
function egEpRead(M, e) {
  var y = e.y1; if (!y) return ""; var t = [];
  if (e.open && !y.full) { t.push("이번 이탈은 아직 " + egDur(e.days) + "째예요. 지금까지 이탈가 대비 최저 " + egPct(y.lo.v) + ", 최고 " + egPct(y.hi.v) + "."); return t.join(" "); }
  if (y.lo.v <= -0.1) t.push((y.loFirst ? "먼저 " : "") + egPct(y.lo.v) + "(" + egPx(M.sym, y.lo.c) + ")까지 더 내려간 뒤"); else t.push("이탈가 근처가 거의 바닥이었고");
  t.push(e.r1 == null ? "아직 1년이 안 됐어요." : e.r1 >= 0 ? "1년 뒤 " + egPct(e.r1) + "로 끝났어요." : "1년 뒤에도 " + egPct(e.r1) + "로 손실이었어요.");
  if (e.r1 != null && e.r1 < 0 && e.r3 != null) t.push(e.r3 >= 0 ? "3년을 기다려야 플러스(" + egPct(e.r3) + ")가 됐어요." : "3년 뒤에도 " + egPct(e.r3) + " — 이탈이 긴 하락의 시작이었던 경우예요.");
  if (y.ups + y.dns >= 6) t.push("그 1년 동안 ±" + Math.round(y.thr * 100) + "% 넘는 오르내림이 " + (y.ups + y.dns) + "번 — 버티기 쉽지 않은 길이었어요.");
  return t.join(" ");
}
/* 프롬프트 줄에도 1년 상세(가격 포함)를 덧붙인다 */
(function () {
  var l0 = egMaLine; egMaLine = function (sym, mode) {
    var t = l0.apply(this, arguments); if (!t || mode !== "w200") return t; var M = egMaY1(egMaBreak(sym, "w200")); if (!M || !M.eps.length) return t;
    return t + "\n  · 1년 상세(이탈가 기준 · 분할 반영 종가): " + M.eps.slice(-6).map(function (e) { var y = e.y1; return e.ym + " 이탈가 " + egPx(sym, e.c0) + " → 1년 안 최저 " + egPct(y.lo.v) + "(" + egPx(sym, y.lo.c) + ", " + y.lo.ym + ") · 최고 " + egPct(y.hi.v) + "(" + egPx(sym, y.hi.c) + ", " + y.hi.ym + ") · ±" + Math.round(y.thr * 100) + "% 오르내림 " + (y.ups + y.dns) + "번" + (y.full ? "" : " (진행 중)") + " · 지금 " + egPx(sym, M.lastC) + "(" + egPct(e.nowV) + ")"; }).join(" / ");
  };
  /* 평가표 아래 '깊이 읽기' */
  var h0 = egScoreHtml; egScoreHtml = function (sym) {
    var h = h0.apply(this, arguments), S = egScore(sym); if (!h || !S || !S.raw) return h; var R = S.raw, px = function (v) { return egPx(sym, v); }, P = [];
    P.push('<b>회복력</b> — ' + R.yrs.toFixed(1) + '년 동안 -20% 넘는 큰 하락이 ' + R.eps + '번 있었고 그중 ' + R.closed + '번을 전고점까지 되돌렸어요' + (R.openDd != null ? '(지금 ' + egPct(R.openDd) + ' 하락이 진행 중)' : '') + '.' + (R.recMed != null ? ' 고점에서 다시 고점까지 보통 ' + (R.recMed < 1 ? Math.round(R.recMed * 12) + '개월' : R.recMed.toFixed(1) + '년') + ', 가장 길 때 ' + (R.recMax < 1 ? Math.round(R.recMax * 12) + '개월' : R.recMax.toFixed(1) + '년') + '이 걸렸어요.' : '') + ' 여러 번 같은 방향으로 회복했다는 건 그 자산을 사는 사람과 돈을 버는 구조가 위기 때마다 살아 있었다는 뜻이에요. 다만 점수가 말해 주지 못하는 것이 하나 있어요 — <b>그때 회복을 만든 것</b>(금리 인하, 정부 지원, 새 수요)이 다음에도 있을지는 숫자에 없어요. 그래서 ③ 프롬프트에서 Claude에게 과거 하락마다의 배경을 따로 쓰게 했어요.');
    P.push('<b>MDD</b> — 역대 최악은 ' + px(R.worstPk) + '(' + egYm(R.worstPkT) + ')에서 ' + px(R.worstC) + '(' + egYm(R.worstT) + ')까지 ' + egPct(S.worst) + '였어요. 지금은 고점 ' + px(R.pk) + ' 대비 ' + egPct(S.cur) + '(' + px(R.lastC) + ')예요.' + (S.cur < -0.03 ? ' 같은 최악이 지금 다시 온다면 ' + px(R.pk * (1 + S.worst)) + ' 근처까지, 즉 지금 가격에서 ' + egPct((1 + S.worst) / (1 + S.cur) - 1) + ' 더 내려갈 수 있었다는 계산이에요.' : ' 고점 근처라 같은 최악이 오면 지금 가격에서 ' + egPct(S.worst) + '(' + px(R.lastC * (1 + S.worst)) + ' 근처)까지 내려갈 수 있다는 뜻이에요.') + ' MDD는 "싸다"의 근거이면서 동시에 "얼마나 더 아플 수 있나"의 근거예요. 그래서 사기 전에 정할 것은 가격이 아니라 <b>이 폭을 견딜 수 있는 금액</b>이에요.' + (R.needUp != null && R.needUp >= 0.3 ? ' 그리고 빠진 폭과 회복에 필요한 폭은 달라요 — 지금은 ' + egPct(R.needUp) + ' 올라야 전고점이에요.' : ''));
    if (R.wGap != null) P.push('<b>장기 평균선</b> — 200주선은 지난 4년 동안 이 자산을 산 사람들의 평균 가격쯤이에요. 지금은 그 선 ' + (R.wGap < 0 ? '아래 ' : '위 ') + egPct(R.wGap) + '예요. ' + (R.wGap < 0 ? '선 아래라는 건 4년 동안 산 사람 대부분이 손실 구간이라는 뜻이라, 공포가 크고 그래서 싸요. ' : R.wGap > 0.8 ? '선에서 이만큼 멀어진 건 최근에 급하게 올랐다는 뜻이에요. 좋은 자산도 이런 거리에서 사면 한동안 제자리일 수 있어요. ' : '') + (R.wN ? '과거 이탈 ' + R.wN + '번의 상세(이탈가 · 1년 안 최저/최고 가격 · 오르내림 횟수)는 아래 "장기 평균선 이탈 사례"에 있어요.' : '이 자산은 관찰 기간에 200주선을 깬 적이 없어요 — 깨진다면 처음 보는 일이라 과거 기록으로 판단할 수 없어요.'));
    P.push('<b>기술 지표 · 매크로를 어떻게 쓸까</b> — 이 둘은 "무엇을 살까"가 아니라 "언제 · 얼마나 빨리"를 정하는 재료예요. 체력이 좋고 싼데 흐름이 역배열이면 아직 떨어지는 칼일 수 있으니 분할 간격을 넓히고, 정배열로 돌아서면 간격을 좁히는 식이에요. 매크로는 미리 맞히기 어려워 점수 비중을 가장 작게 뒀어요.');
    var box = '<details class="egDeep" open><summary>깊이 읽기 — 숫자가 말하는 것과 말하지 못하는 것</summary>' + P.map(function (x) { return '<p>' + x + '</p>'; }).join("") + '</details>';
    var k = h.lastIndexOf('<div class="egNote"><b>점수 읽는 법</b>'); return k >= 0 ? h.slice(0, k) + box + h.slice(k) : h + box;
  };
})();

/* ---------- ③ 전 종목 매일 스캔 ---------- */
var EGS = { run: false, done: 0, total: 0, res: null, flt: "good", mk: "all" };
function egScanList() { var out = [], seen = {}; (typeof TICKER_DICT !== "undefined" ? TICKER_DICT : []).forEach(function (r) { var s = r[0]; if (seen[s] || /^\^|=X$|=F$|^DX-Y/.test(s)) return; seen[s] = 1; out.push(s); }); return out; }
function egScanLoad() { if (EGS.res) return EGS.res; try { var v = JSON.parse(localStorage.getItem("sm.scan") || "null"); if (v && v.day && v.rows) EGS.res = v; } catch (e) {} return EGS.res; }
function egScanRow(sym) {
  var S = egScore(sym); if (!S) return null; var by = {}; S.cats.forEach(function (c) { by[c.id] = c.score; });
  return { s: sym, n: S.name, t: S.total, b: S.body, sp: S.spot, ch: S.cheap, tech: by.tech != null ? by.tech : null, mdd: by.mdd, ma: by.ma, cur: S.cur, worst: S.worst, wGap: S.raw.wGap, wOpen: S.raw.wOpen, yrs: Math.round(S.raw.yrs * 10) / 10, cagr: S.raw.cagr, rec: S.raw.closed + "/" + S.raw.eps, lev: S.lev ? 1 : 0, px: S.raw.lastC, read: S.read[0], f: S.hasFund ? 1 : 0 };
}
function egScanRun(onTick) {
  if (EGS.run) return Promise.resolve(EGS.res); var list = egScanList(), rows = [], had = {}, idx = 0; EGS.run = true; EGS.done = 0; EGS.total = list.length; Object.keys(nbHist).forEach(function (k) { had[k] = 1; });
  var vix = egEnsure(["^VIX"]), mac = typeof macroEnsure === "function" ? macroEnsure().catch(function () {}) : null;
  var one = function () {
    if (idx >= list.length) return Promise.resolve(); var sym = list[idx++];
    return egEnsure([sym]).then(function () { return typeof egSeamLoad === "function" ? egSeamLoad(sym) : null; }).then(function () { try { var r = egScanRow(sym); if (r) rows.push(r); } catch (e) {} if (!had[sym]) { delete nbHist[sym]; Object.keys(EG.memo).forEach(function (k) { if (k.indexOf(":" + sym + ":") > 0 || k.indexOf(sym + ":") === 0) delete EG.memo[k]; }); } EGS.done++; if (onTick) onTick(); }).then(one);
  };
  return Promise.all([vix, mac]).then(function () { var ws = []; for (var i = 0; i < 5; i++) ws.push(one()); return Promise.all(ws); }).then(function () {
    /* 2단계: 체력 · 싼 정도가 좋은 주식 상위 40개만 기업 정보를 받아 다시 계산 (네이버 호출을 아끼려고) */
    var cand = rows.filter(function (r) { return !r.lev && typeof coreIsStock === "function" && coreIsStock(r.s); }).sort(function (a, b) { return b.t - a.t; }).slice(0, 40), j = 0;
    var two = function () { if (j >= cand.length) return Promise.resolve(); var r = cand[j++]; return Promise.all([egEnsure([r.s]), coreFund(r.s).catch(function () {})]).then(function () { try { var x = egScanRow(r.s); if (x) Object.assign(r, x); } catch (e) {} if (!had[r.s]) delete nbHist[r.s]; if (onTick) onTick(); }).then(two); };
    return Promise.all([two(), two(), two()]);
  }).then(function () {
    rows.sort(function (a, b) { return b.t - a.t; }); EGS.res = { day: typeof smKstDay === "function" ? smKstDay() : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), at: Date.now(), rows: rows }; EGS.run = false;
    try { localStorage.setItem("sm.scan", JSON.stringify(EGS.res)); } catch (e) {} if (typeof smKvPut === "function") { try { smKvPut("cfg:scan", { day: EGS.res.day, at: EGS.res.at, rows: rows.slice(0, 120) }); } catch (e) {} }
    return EGS.res;
  }).catch(function (e) { EGS.run = false; throw e; });
}
function egScanFilter(rows) {
  var mk = EGS.mk, f = EGS.flt; rows = rows.filter(function (r) { return mk === "all" || (mk === "kr" ? /\.K[SQ]$/.test(r.s) : mk === "coin" ? /-USD$/.test(r.s) : !/\.K[SQ]$|-USD$/.test(r.s)); });
  if (f === "good") rows = rows.filter(function (r) { return r.b >= 65 && r.ch >= 62 && !r.lev; });
  else if (f === "ma") rows = rows.filter(function (r) { return r.wGap != null && r.wGap <= 0.05 && r.b >= 55; }).sort(function (a, b) { return a.wGap - b.wGap; });
  else if (f === "dd") rows = rows.filter(function (r) { return r.cur <= -0.2 && r.b >= 60; }).sort(function (a, b) { return a.cur - b.cur; });
  else if (f === "strong") rows = rows.filter(function (r) { return r.b >= 75 && (r.tech || 0) >= 65; });
  else if (f === "lev") rows = rows.filter(function (r) { return r.lev; });
  return rows;
}
function egScanHtml() {
  var R = egScanLoad(), today = typeof smKstDay === "function" ? smKstDay() : "", col = function (p) { return p == null ? "#8a93a3" : p >= 68 ? "#1d7f55" : p >= 55 ? "#3182f6" : p >= 42 ? "#b9600f" : "#c03b3b"; };
  var FL = [["good", "튼튼한데 싸진 것"], ["ma", "200주선 아래 · 근처"], ["dd", "-20% 넘게 빠진 튼튼한 것"], ["strong", "튼튼하고 오르는 중"], ["all", "전체 순위"], ["lev", "레버리지"]], MK = [["all", "전체"], ["kr", "국내"], ["us", "해외"], ["coin", "코인"]];
  var h = '<div class="egBox egScan"><div class="egH">오늘의 후보 — 전 종목 스캔 <small>앱에 있는 종목 전체(지수 · 환율 제외)를 25년 일봉으로 계산해 회복력 · MDD · 장기 평균선 · 기술 지표 점수를 매겨요. 상위 40개 주식은 기업 정보까지 넣어 다시 계산해요. 매수 추천이 아니라 "먼저 들여다볼 순서"예요.</small></div>';
  h += '<div class="anActs"><button class="primary" data-egscan' + (EGS.run ? " disabled" : "") + '>' + (EGS.run ? "스캔 중 " + EGS.done + " / " + EGS.total : R && R.day === today ? "🔄 다시 스캔" : "🔎 오늘 스캔 시작 (1~3분)") + '</button><span class="briefDim">' + (R ? "마지막 스캔 " + R.day + " · " + R.rows.length + "종목" + (R.day !== today ? " — 오늘 데이터로 다시 스캔하세요" : "") : "아직 스캔한 적이 없어요 · 아침 수집(07:00) 뒤 하루 한 번이면 충분해요") + '</span></div>';
  if (EGS.run) h += '<div class="egBar" style="height:8px"><u style="width:' + (EGS.total ? Math.round(EGS.done / EGS.total * 100) : 0) + '%"></u></div>';
  if (R && R.rows.length) {
    var rows = egScanFilter(R.rows.slice());
    h += '<div class="egChips">' + FL.map(function (f) { return '<button class="chip' + (EGS.flt === f[0] ? " on" : "") + '" data-egflt="' + f[0] + '">' + f[1] + '</button>'; }).join("") + '<div style="flex:1"></div>' + MK.map(function (m) { return '<button class="chip' + (EGS.mk === m[0] ? " on" : "") + '" data-egmk="' + m[0] + '">' + m[1] + '</button>'; }).join("") + '</div>';
    h += rows.length ? '<div class="dxWrap egScanW"><table class="dgT egScanT"><thead><tr><th>#</th><th>종목</th><th>종합</th><th>체력</th><th>싼 정도</th><th>흐름</th><th>지금 낙폭<br><small>역대 최대</small></th><th>200주선 대비</th><th>큰 하락 회복</th><th>기록</th><th>한 줄 판정</th></tr></thead><tbody>' + rows.slice(0, 60).map(function (r, i) {
      var sc = function (p) { return '<b style="color:' + col(p) + '">' + (p == null ? "-" : p) + '</b>'; };
      return '<tr data-ansym2="' + egEsc(r.s) + '"><td>' + (i + 1) + '</td><td class="dgName"><b>' + egEsc(r.n) + '</b>' + (r.lev ? ' <small class="dgNo">레버리지</small>' : '') + (r.q === "bad" ? ' <small class="dgNo" title="' + egEsc(r.qw || "") + '">검증 실패</small>' : r.q === "warn" ? ' <small style="color:#b9600f">검증 주의</small>' : '') + (r.f ? '' : ' <small class="briefDim" title="기업 정보 없이 회복력만으로 체력을 봤어요">회복력만</small>') + '<br><small>' + egEsc(r.s) + ' · ' + egPx(r.s, r.px) + '</small></td><td>' + sc(r.t) + '</td><td>' + sc(r.b) + '</td><td>' + sc(r.ch) + '</td><td>' + sc(r.tech) + '</td><td><b class="dn">' + egPct(r.cur) + '</b><br><small>' + egPct(r.worst) + '</small></td><td>' + (r.wGap == null ? '-' : '<b class="' + (r.wGap < 0 ? "dn" : "") + '">' + egPct(r.wGap) + '</b>' + (r.wOpen ? '<br><small>이탈 중</small>' : '')) + '</td><td>' + r.rec + '번</td><td>' + r.yrs + '년' + (r.cagr != null ? '<br><small>연 ' + egPct(r.cagr, 1) + '</small>' : '') + '</td><td class="egScanR">' + egEsc(r.read) + '</td></tr>';
    }).join("") + '</tbody></table></div><div class="briefDim" style="margin-top:6px">줄을 누르면 그 종목의 평가표 · 이탈 사례 · 프롬프트로 넘어가요. ' + (rows.length > 60 ? "상위 60개만 보여요. " : "") + '기록 3년 미만 종목은 점수 대신 아래 "신규 상장 점검표"로 봐요.</div>' : '<div class="briefDim" style="padding:10px 0">이 조건에 맞는 종목이 오늘은 없어요. 다른 조건을 눌러 보세요.</div>';
    h += '<div class="egNote"><b>이 목록을 쓰는 법</b> — 「튼튼한데 싸진 것」은 체력 65점 이상이면서 MDD · 장기 평균선으로 본 "싼 정도"가 62점 이상인 종목이에요. 여기 올랐다고 사는 게 아니라, ① 줄을 눌러 왜 빠졌는지(평가표 · 이탈 사례) 보고 ② 프롬프트로 Claude에게 배경과 반론을 묻고 ③ 견딜 수 있는 금액과 분할 계획을 정하는 순서예요. 싸진 데에는 늘 이유가 있어요 — 그 이유가 "일시적"인지 "구조적"인지가 판단의 전부예요.</div>';
  }
  return h + '</div>';
}

/* ---------- ④ 신규 상장 점검표 (기록 3년 미만) ---------- */
function egNew(sym) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || rows.length < 5) return null; var n = rows.length, first = rows[0], last = rows[n - 1], days = (last.t - first.t) / EG_DAY; if (days >= 3 * 365.25) return null;
  var hi = first, lo = first, up = null, dn = null; for (var i = 1; i < n; i++) { var r = rows[i], d = r.c / rows[i - 1].c - 1; if (r.c > hi.c) hi = r; if (r.c < lo.c) lo = r; if (!up || d > up.v) up = { v: d, t: r.t }; if (!dn || d < dn.v) dn = { v: d, t: r.t }; }
  var rs = []; for (i = 1; i < n; i++) rs.push(rows[i].c / rows[i - 1].c - 1); var mu = rs.reduce(function (a, b) { return a + b; }, 0) / (rs.length || 1), per = n / Math.max(0.05, days / 365.25), vol = rs.length >= 20 ? Math.sqrt(rs.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / rs.length) * Math.sqrt(Math.min(per, 365)) : null;
  var vFirst = null, vLast = null; if (rows[0].v != null && n >= 40) { var a = 0, b = 0; for (i = 0; i < 20; i++) { a += rows[i].v || 0; b += rows[n - 1 - i].v || 0; } if (a > 0) { vFirst = a / 20; vLast = b / 20; } }
  var d1 = function (k) { return new Date(first.t + k * EG_DAY).toISOString().slice(0, 10); }, passed = function (k) { return days >= k; };
  var F = typeof CORE !== "undefined" && CORE.fund ? CORE.fund[sym] : null;
  return { sym: sym, name: egName(sym), days: Math.round(days), first: first, last: last, hi: hi, lo: lo, fromFirst: last.c / first.c - 1, fromHi: last.c / hi.c - 1, fromLo: last.c / lo.c - 1, up: up, dn: dn, vol: vol, volRatio: vFirst ? vLast / vFirst : null, lock: [[90, d1(90), passed(90)], [180, d1(180), passed(180)], [365, d1(365), passed(365)]], F: F };
}
function egNewChecks(N) {
  var C = [], px = function (v) { return egPx(N.sym, v); }, mo = Math.round(N.days / 30.4), lv = function (ok) { return ok === true ? "good" : ok === false ? "bad" : "mid"; };
  C.push({ k: "기록 길이", v: mo + "개월 (" + new Date(N.first.t).toISOString().slice(0, 10) + " 첫 거래)", lv: N.days >= 365 ? "mid" : "bad", t: N.days < 180 ? "반년이 안 됐어요. 가격이 아직 '기대'로만 움직이는 시기라 실적 발표를 한두 번 지나야 제값이 잡혀요." : N.days < 365 ? "1년이 안 됐어요. 큰 하락을 한 번도 겪지 않았다면 회복력은 아직 모르는 거예요." : "1년은 넘었지만 긴 약세장을 겪은 기록은 없어요. 장기 점수(회복력 · 200주선)는 아직 쓸 수 없어요." });
  C.push({ k: "첫 거래일 종가 대비", v: egPct(N.fromFirst) + " (" + px(N.first.c) + " → " + px(N.last.c) + ")", lv: lv(N.fromFirst >= 0), t: (N.fromFirst >= 0 ? "상장 첫날에 산 사람이 이익 구간이에요." : "상장 첫날에 산 사람이 손실 구간이에요 — 위에 팔고 싶은 물량이 쌓여 있어요.") + " 공모가는 앱이 알지 못해요 — 공모가 대비는 프롬프트로 Claude에게 확인하세요." });
  C.push({ k: "상장 후 최고가 대비", v: egPct(N.fromHi) + " (최고 " + px(N.hi.c) + ", " + egYm(N.hi.t) + ")", lv: N.fromHi > -0.2 ? "mid" : N.fromHi > -0.5 ? "mid" : "bad", t: N.fromHi > -0.1 ? "최고가 근처예요. 신규 상장주는 초기 열기가 식으며 한 번 크게 빠지는 경우가 흔해서, 그 조정을 아직 안 거쳤다면 서두를 이유가 적어요." : N.fromHi > -0.5 ? "초기 열기에서 조정을 받는 중이에요. 락업 해제와 실적 발표 전후로 한 번 더 흔들릴 수 있어요." : "최고가에서 절반 넘게 빠졌어요. 열기는 빠졌지만, 사업이 기대에 못 미쳐서인지 물량 때문인지 구분해야 해요." });
  C.push({ k: "상장 후 최저가 대비", v: egPct(N.fromLo) + " (최저 " + px(N.lo.c) + ", " + egYm(N.lo.t) + ")", lv: "mid", t: N.lo.t > N.hi.t ? "최저가가 최고가보다 나중이에요 — 고점 뒤 내려온 흐름이에요." : "최저가가 먼저였고 그 뒤 올라왔어요 — 바닥을 한 번 확인한 모양이에요." });
  if (N.vol != null) C.push({ k: "변동성 (연) · 하루 최대", v: Math.round(N.vol * 100) + "% · " + egPct(N.up.v, 1) + " / " + egPct(N.dn.v, 1), lv: N.vol <= 0.45 ? "good" : N.vol <= 0.8 ? "mid" : "bad", t: N.vol > 0.8 ? "흔들림이 아주 커요. 비중을 작게, 한 번에 사지 않는 게 기본이에요." : N.vol > 0.45 ? "개별 성장주 수준의 흔들림이에요." : "신규 상장주치고는 차분한 편이에요." });
  if (N.volRatio != null) C.push({ k: "거래량 (처음 20일 → 최근 20일)", v: "×" + N.volRatio.toFixed(2), lv: N.volRatio >= 0.5 ? "mid" : "mid", t: N.volRatio < 0.3 ? "초기보다 거래가 크게 줄었어요 — 관심이 빠진 상태라 작은 물량에도 가격이 크게 움직일 수 있어요." : N.volRatio > 1.2 ? "거래가 오히려 늘었어요 — 새로 들어오는 돈이 있다는 뜻이에요." : N.volRatio >= 0.7 ? "초기와 비슷한 거래가 이어지고 있어요." : "초기 열기가 식은 보통의 모습이에요." });
  var nx = N.lock.filter(function (l) { return !l[2]; })[0];
  C.push({ k: "보호예수(락업) 해제 — 통상 일정", v: N.lock.map(function (l) { return l[0] + "일 " + l[1].slice(2) + (l[2] ? " 지남" : ""); }).join(" · "), lv: nx && (Date.parse(nx[1]) - Date.now()) / EG_DAY <= 45 ? "bad" : "mid", t: (nx ? "다음 통상 해제 시점은 " + nx[1] + "(상장 " + nx[0] + "일)예요. " : "통상 해제 시점은 모두 지났어요. ") + "임직원 · 초기 투자자 물량이 풀리는 날 전후로 주가가 눌리는 일이 잦아요. 실제 날짜와 물량은 회사마다 달라서 증권신고서(S-1 · 투자설명서)에서 꼭 확인해야 해요 — 여기 날짜는 흔한 관행(90 · 180 · 365일)일 뿐이에요." });
  var F = N.F;
  if (F) {
    if (F.opNeg != null) C.push({ k: "영업이익", v: F.opNeg ? "적자" : "흑자" + (F.margin != null ? " (이익률 " + (F.margin * 100).toFixed(1) + "%)" : ""), lv: lv(!F.opNeg), t: F.opNeg ? "아직 돈을 벌지 못해요. 이 경우 볼 것은 '현금이 몇 년 버티나'와 '매출이 얼마나 빨리 크나'예요." : "이미 돈을 버는 회사예요. 성장 기대가 꺾여도 버틸 바닥이 있어요." });
    if (F.revG != null) C.push({ k: "매출 성장 (연)", v: egPct(F.revG, 1), lv: F.revG >= 0.2 ? "good" : F.revG >= 0.05 ? "mid" : "bad", t: F.revG >= 0.2 ? "매출이 빠르게 커요 — 신규 상장주의 높은 가격을 설명해 주는 유일한 근거예요." : "성장이 빠르지 않아요. 신규 상장 프리미엄을 줄 이유가 약해요." });
    if (F.per != null) C.push({ k: "PER", v: F.per > 0 ? F.per.toFixed(0) + "배" : "적자", lv: F.per > 0 && F.per <= 40 ? "mid" : "bad", t: F.per > 60 ? "이익에 비해 가격이 매우 높아요. 성장이 조금만 느려져도 크게 빠질 수 있어요." : F.per > 0 ? "이익이 가격을 어느 정도 받치고 있어요." : "이익이 없어 PER을 쓸 수 없어요 — 매출 대비 가격(PSR)으로 비교해야 해요." });
  } else C.push({ k: "기업 정보", v: "앱에 없음", lv: "mid", t: "상장한 지 얼마 안 돼 재무 자료가 아직 없거나 앱이 읽지 못했어요. 매출 · 이익 · 현금은 프롬프트로 Claude에게 증권신고서와 첫 실적을 찾게 하세요." });
  return C;
}
function egNewHtml(sym) {
  var N = egNew(sym); if (!N) return ""; var C = egNewChecks(N), g = C.filter(function (c) { return c.lv === "good"; }).length, b = C.filter(function (c) { return c.lv === "bad"; }).length;
  var h = '<div class="egBox egNewB"><div class="egH">신규 상장 점검표 — ' + egEsc(N.name) + ' <small>거래 기록이 3년이 안 돼 회복력 · MDD · 200주선 같은 장기 기법을 쓸 수 없어요. 그래서 점수 대신 "지금 확인할 수 있는 것"과 "아직 알 수 없는 것"을 나눠 봐요</small></div>';
  h += '<div class="dxSum ' + (b >= 3 ? "warn" : "ok") + '">확인된 항목 ' + C.length + '개 중 좋음 <b>' + g + '</b> · 주의 <b>' + b + '</b> — 종합 점수는 내지 않아요. 살아남은 기록이 없는 자산에 점수를 붙이면 근거 없는 확신이 되기 때문이에요.</div>';
  h += '<div class="dxWrap"><table class="dgT egScT"><thead><tr><th>확인할 것</th><th>지금 값</th><th>상태</th><th>해석</th></tr></thead><tbody>' + C.map(function (c) { return '<tr><td><b>' + egEsc(c.k) + '</b></td><td>' + egEsc(c.v) + '</td><td><span class="dhBadge ' + (c.lv === "good" ? "ok" : c.lv === "bad" ? "warn" : "") + '">' + (c.lv === "good" ? "좋음" : c.lv === "bad" ? "주의" : "참고") + '</span></td><td>' + egEsc(c.t) + '</td></tr>'; }).join("") + '</tbody></table></div>';
  h += '<div class="egNote"><b>오래된 기업과 다르게 봐야 하는 이유</b> — 오래 살아남은 자산은 "위기 때 어떻게 됐나"를 기록으로 볼 수 있지만, 신규 상장주는 그 기록이 없어요. 대신 볼 것은 네 가지예요. ① <b>가격이 무엇을 미리 반영했나</b>(공모가 · 매출 대비 가격을 비슷한 상장사와 비교) ② <b>팔 물량이 언제 얼마나 나오나</b>(락업 해제 · 추가 발행) ③ <b>돈을 벌고 있나, 아니면 현금이 몇 년 버티나</b> ④ <b>상장 뒤 실적 발표를 몇 번 통과했나</b>(약속한 숫자를 지켰는지). 그리고 가장 실용적인 규칙은 <b>시간을 내 편으로 두는 것</b>이에요 — 락업이 풀리고 실적을 서너 번 본 뒤에 사도 좋은 회사는 늦지 않고, 나쁜 회사는 그사이에 걸러져요. 비중은 "전부 잃어도 계획이 흔들리지 않는 만큼"만요.<br><b>아직 알 수 없는 것</b> — 큰 약세장에서의 낙폭과 회복 속도, 경기 침체 때의 매출, 경영진이 어려울 때 주주를 어떻게 대하는지. 이건 시간이 지나야만 알 수 있어요.</div>';
  return h + '</div>';
}
function egNewLines(sym) {
  var N = egNew(sym); if (!N) return []; var C = egNewChecks(N);
  return ["", "[신규 상장 점검표 — 앱 계산] " + N.name + " 은(는) 거래 기록 " + Math.round(N.days / 30.4) + "개월이라 장기 기법(회복력 · MDD · 200주선)을 쓸 수 없음. 앱이 확인한 것:"].concat(C.map(function (c) { return "- " + c.k + ": " + c.v + " [" + (c.lv === "good" ? "좋음" : c.lv === "bad" ? "주의" : "참고") + "]"; })).concat([
    "→ 신규 상장 종목이므로 아래를 웹에서 찾아 edge 안에 \"newco\" 키로 추가한다(출처 · 날짜 필수, 못 찾으면 '확인 못 함'):",
    "  { \"ipo\": \"상장일 · 공모가 · 공모 규모 · 첫날 종가 · 지금 공모가 대비\", \"valuation\": \"시가총액 · 매출 대비 가격(PSR) · 비슷한 상장사 2~3곳과 비교\", \"lockup\": \"보호예수 해제 날짜와 물량(전체 주식의 몇 %) · 추가 발행 · 전환사채\", \"cash\": \"영업현금흐름 · 보유 현금 · 지금 속도로 몇 년 버티나\", \"earnings\": \"상장 뒤 실적 발표 횟수와 가이던스 대비 결과\", \"control\": \"지배구조 — 차등의결권 · 창업자 지분 · 대주주 매도 계획\", \"customers\": \"매출이 소수 고객 · 정부 계약에 쏠려 있는지\", \"analogs\": \"비슷한 과거 대형 상장 2~3건이 상장 뒤 1년 · 3년에 어떻게 됐는지(숫자)\", \"wait\": \"지금 사는 것과 락업 해제 · 실적 n번 뒤에 사는 것의 차이 — 기다릴 때 잃는 것과 얻는 것\", \"rule\": \"비중 상한과 분할 규칙(숫자)\" }",
    "  상장 초기 주가는 기대와 수급으로 움직인다는 점, 살아남은 기록이 없다는 점을 전제로 쓴다. 점수를 매기지 않는다."]);
}
(function () {
  /* 프롬프트 · 답 화면에 신규 상장 항목 */
  var b0 = egBlock; egBlock = function (syms, withPort) { var t = b0.apply(this, arguments), L = []; (syms || []).slice(0, 3).forEach(function (s) { L = L.concat(egNewLines(s)); }); if (!L.length) return t; var mark = "\n=== 예측 · 대응 · 방향 (edge)", i = t.indexOf(mark); return i >= 0 ? t.slice(0, i) + "\n" + L.join("\n") + t.slice(i) : t + "\n" + L.join("\n"); };
  var NK = [["ipo", "상장 · 공모가"], ["valuation", "가격 수준"], ["lockup", "풀릴 물량"], ["cash", "현금 · 버틸 기간"], ["earnings", "상장 뒤 실적"], ["control", "지배구조"], ["customers", "매출 쏠림"], ["analogs", "비슷한 과거 상장"], ["wait", "기다림의 득실"], ["rule", "비중 · 분할 규칙"]];
  var n0 = egNorm; egNorm = function (E) { var o = n0.apply(this, arguments), R = E && E.newco; if (R && typeof R === "object" && NK.some(function (k) { return R[k[0]]; })) { o = o || { history: [], policy: [], paths: [], roadmap: null, protect: [], grow: [], mine: "" }; o.newco = R; } return o; };
  var x0 = egExtraHtml; egExtraHtml = function (E, opt) { var h = x0.apply(this, arguments), N = egNorm(E), R = N && N.newco; if (!R) return h; var add = '<div class="anxH">신규 상장 — Claude가 찾은 것</div><div class="egRoad egNewR">' + NK.filter(function (k) { return R[k[0]]; }).map(function (k) { return '<div><small>' + k[1] + '</small>' + egEsc(typeof R[k[0]] === "string" ? R[k[0]] : JSON.stringify(R[k[0]])) + '</div>'; }).join("") + '</div>'; return h ? h.replace('<div class="egX">', '<div class="egX">' + add) : '<div class="egX">' + add + '</div>'; };
  /* 분석 화면: ① 맨 위에 스캔 · ② 에 신규 상장 점검표 */
  if (typeof anxSections === "function") { var s0 = anxSections; anxSections = function (root) {
    var r = s0.apply(this, arguments);
    try {
      var secs = root.querySelectorAll(".anSec"), sym = AN.sym;
      if (secs[0] && !secs[0].querySelector(".egScan")) { secs[0].insertAdjacentHTML("beforeend", egScanHtml()); egScanBind(root); }
      if (sym && secs[1] && nbHist[sym] && EG["sd:" + sym] && !secs[1].querySelector(".egNewB")) { var hh = egNewHtml(sym); if (hh) { var first = secs[1].querySelector(".egBox"); if (first) first.insertAdjacentHTML("beforebegin", hh); else secs[1].insertAdjacentHTML("beforeend", hh); } }
    } catch (e) { console.warn("eg", e); }
    return r;
  }; }
  var st = document.createElement("style"); st.textContent = [
    ".egEpL{display:grid;gap:8px}.egEp{border:1px solid #e6eaf0;border-radius:12px;padding:10px 12px;background:#fff}.egEp.now{background:#fff8ec;border-color:#f0d9b0}.egEpH{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:12.5px;color:#556}.egEpH>b{font-size:14.5px;color:#111}.egEpH i{font-style:normal;font-size:11px;font-weight:700;color:#b9600f;background:#fdebd0;border-radius:6px;padding:1px 6px}.egEpH em{font-style:normal;margin-left:auto}",
    ".egEpG{display:grid;grid-template-columns:repeat(3,minmax(70px,90px)) repeat(5,minmax(120px,1fr));gap:6px;margin:8px 0 6px}.egEpG>div{background:#f6f8fb;border-radius:8px;padding:6px 8px;font-size:12.5px;line-height:1.4}.egEpG small{display:block;font-size:10.5px;color:#6b7686;font-weight:700}.egEpG span{display:block;font-size:11px;color:#6b7686}.egEpG b.up,.egEpH b.up{color:#c0392b}.egEpG b.dn,.egEpH b.dn{color:#1f5fbf}.egEpT{font-size:12.5px;line-height:1.55;color:#334}",
    "@media(max-width:1100px){.egEpG{grid-template-columns:repeat(3,1fr)}.egEpG .w{grid-column:span 1}}@media(max-width:560px){.egEpG{grid-template-columns:repeat(2,1fr)}.egEpH em{margin-left:0}}",
    ".egDeep{background:#f6f8fb;border-radius:12px;padding:10px 14px;margin:10px 0}.egDeep summary{font-weight:800;font-size:13.5px;cursor:pointer}.egDeep p{margin:8px 0 0;font-size:13px;line-height:1.65}",
    ".egScanT td,.egScanT th{font-size:12.5px;padding:7px 8px;text-align:center;line-height:1.35}.egScanT td:nth-child(2),.egScanT th:nth-child(2),.egScanT td.egScanR{text-align:left}.egScanT tbody tr{cursor:pointer}.egScanT tbody tr:hover td{background:#f3f7ff}.egScanT small{color:#6b7686;font-size:11px}.egScanT b.dn{color:#1f5fbf}.egScanW{max-height:560px;overflow:auto}.egScanR{font-size:12px;color:#445;min-width:150px}.egScan .chip.on{background:#3182f6;color:#fff;border-color:#3182f6}.egNewR{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}",
    "[data-theme=dark] .egEp{background:#161b24;border-color:#263041}[data-theme=dark] .egEp.now{background:#2a2114}[data-theme=dark] .egEpG>div,[data-theme=dark] .egDeep{background:#1e2533;color:#dde}[data-theme=dark] .egEpH>b{color:#eee}[data-theme=dark] .egEpT{color:#ccd}[data-theme=dark] .egScanT tbody tr:hover td{background:#1c2636}"
  ].join(""); document.head.appendChild(st);
})();
function egScanBind(root) {
  var redraw = function () { var b = root.querySelector(".egScan"); if (b) { b.outerHTML = egScanHtml(); egScanBind(root); } };
  var go = root.querySelector("[data-egscan]"); if (go) go.onclick = function () { if (EGS.run) return; var lastDraw = 0; egScanRun(function () { if (Date.now() - lastDraw > 700) { lastDraw = Date.now(); redraw(); } }).then(function () { redraw(); if (typeof smToast === "function") smToast("스캔 완료 — " + EGS.res.rows.length + "종목"); }).catch(function (e) { redraw(); if (typeof smToast === "function") smToast("스캔 실패: " + (e && e.message || e), "bad"); }); redraw(); };
  Array.prototype.forEach.call(root.querySelectorAll("[data-egflt]"), function (b) { b.onclick = function () { EGS.flt = b.getAttribute("data-egflt"); redraw(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-egmk]"), function (b) { b.onclick = function () { EGS.mk = b.getAttribute("data-egmk"); redraw(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-ansym2]"), function (tr) { tr.onclick = function () { AN.sym = tr.getAttribute("data-ansym2"); AN.ansId = null; if (typeof anRun === "function") anRun(); else renderAnalyst(); window.scrollTo(0, 0); }; });
  if (!EGS.kv && !EGS.res && typeof smKvGet === "function") { EGS.kv = 1; smKvGet("cfg:scan").then(function (v) { if (v && v.rows && !EGS.res) { EGS.res = v; redraw(); } }); }
}

/* v12.97 분석 종목 검색 — 앱 사전에 없는 종목(막 상장한 회사 등)도 야후 검색으로 찾아 고를 수 있게 */
(function () {
  if (typeof anxSections !== "function") return; EG.names = EG.names || {};
  var n0 = egName; egName = function (s) { var v = n0.apply(this, arguments); return (!v || v === s) && EG.names[s] ? EG.names[s] : v; };
  var s0 = anxSections; anxSections = function (root) {
    var r = s0.apply(this, arguments);
    try {
      var inp = document.getElementById("anSym"), res = document.getElementById("anSymRes"); if (!inp || !res || inp._egq) return r; inp._egq = 1; var tm = null, seq = 0;
      inp.setAttribute("placeholder", (inp.getAttribute("placeholder") || "종목 검색") + " · 사전에 없으면 티커/영문명");
      inp.addEventListener("input", function () {
        clearTimeout(tm); var q = inp.value.trim(); if (q.length < 2) return; var my = ++seq;
        tm = setTimeout(function () {
          fetch("/api/search?q=" + encodeURIComponent(q)).then(function (x) { return x.json(); }).then(function (d) {
            if (my !== seq || inp.value.trim() !== q) return; var have = {}; Array.prototype.forEach.call(res.querySelectorAll("[data-s]"), function (e) { have[e.getAttribute("data-s")] = 1; });
            var ex = (d.quotes || []).filter(function (it) { return it.symbol && !have[it.symbol] && !/^\^|=X$|=F$/.test(it.symbol) && /EQUITY|ETF|CRYPTOCURRENCY/i.test(it.type || "EQUITY"); }).slice(0, 5); if (!ex.length) return;
            res.insertAdjacentHTML("beforeend", '<div class="briefDim" style="padding:4px 10px;font-size:11px">사전에 없는 종목 (야후 검색) — 신규 상장은 점수 대신 점검표로 봐요</div>' + ex.map(function (it) { return '<div class="hRes" data-s="' + egEsc(it.symbol) + '" data-n="' + egEsc(it.name || it.symbol) + '"><b>' + egEsc(it.name || it.symbol) + '</b> <small>' + egEsc(it.symbol) + (it.exch ? ' · ' + egEsc(it.exch) : '') + '</small></div>'; }).join(""));
            res.style.display = "block";
            Array.prototype.forEach.call(res.querySelectorAll("[data-n]"), function (el) { el.onmousedown = function (e) { e.preventDefault(); var s = el.getAttribute("data-s"); EG.names[s] = el.getAttribute("data-n"); res.style.display = "none"; inp.value = ""; AN.sym = s; AN.ansId = null; if (typeof anRun === "function") anRun(); }; });
          }).catch(function () {});
        }, 350);
      });
    } catch (e) { console.warn("eg", e); }
    return r;
  };
  var st = document.createElement("style"); st.textContent = ".egNewB .egScT th:nth-child(3){width:64px}.egNewB .dhBadge{white-space:nowrap}"; document.head.appendChild(st);
})();

/* 아무 날(5거래일 간격) 사서 days 뒤 — 전 기간 */
function egFwdAll(rows, days) {
  var n = rows.length, out = [], j = 0; for (var i = 0; i < n; i += 5) { var tt = rows[i].t + days * EG_DAY; if (tt > rows[n - 1].t) break; if (j < i) j = i; while (j < n - 1 && rows[j].t < tt) j++; out.push(rows[j].c / rows[i].c - 1); }
  if (out.length < 30) return null; var s = out.slice().sort(function (a, b) { return a - b; });
  return { n: out.length, win: out.filter(function (x) { return x > 0; }).length / out.length, med: s[Math.floor(s.length / 2)], worst: s[0], best: s[s.length - 1] };
}

/* ============================================================
   v12.98 데이터 검증 — 분석에 쓰는 숫자를 세 방향으로 확인한다
   ① 자료 자체: 최신인가 · 날짜가 빠지거나 겹치지 않았나 · 0/빈 값 · 하루 급변(분할 미반영 의심) · 같은 값 반복 · 한 해 봉 수 · 종가가 고가~저가 안인가
   ② 다른 출처와 대조: 과거 파일 vs 아침 수집 스냅샷(같은 날 종가) · 기업 정보(PER × EPS vs 주가, 영업이익률 vs 영업이익/매출, 실적 연도)
   ③ 계산 검산: 같은 값을 다른 방법으로 다시 계산해 맞는지(최대 낙폭 · 200주선 · 이탈 사례 수익률 · 점수 합산)
   결과: 통과 / 주의 / 실패. v12.99: '실패'가 있어도 값은 그대로 보여 주고, 무엇이 실패했는지를 평가표 맨 위와 스캔 줄에 알린다(판단은 사용자가).
   ============================================================ */
function egVerify(sym) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || !rows.length) return null;
  var n = rows.length, last = rows[n - 1], rec = EG.seam && EG.seam[sym] ? 1 : 0, F = typeof CORE !== "undefined" && CORE.fund ? CORE.fund[sym] : null;
  var key = "vf:" + sym + ":" + last.t + ":" + n + ":" + (rec ? 1 : 0) + ":" + (F ? 1 : 0); if (EG.memo[key] !== undefined) return EG.memo[key];
  var coin = /-USD$/.test(sym), kr = /\.K[SQ]$|^\^K/.test(sym), lev = egLev(sym), C = [], ymd = function (t) { return new Date(t + (kr || coin ? 9 : -5) * 3600e3).toISOString().slice(0, 10); }, px = function (v) { return egPx(sym, v); };
  var add = function (g, k, lv, v, t) { C.push({ g: g, k: k, lv: lv, v: v, t: t }); };
  /* ① 자료 자체 */
  var lastD = ymd(last.t), exp = coin ? null : typeof dxExpected === "function" ? dxExpected(kr ? "kr" : "us") : null, lag = coin ? Math.floor((Date.now() - last.t) / EG_DAY) : exp ? Math.max(0, Math.round((Date.parse(exp) - Date.parse(lastD)) / EG_DAY)) : 0;
  add("자료", "최신성", coin ? (lag <= 2 ? "ok" : lag <= 5 ? "warn" : "bad") : lag <= 0 ? "ok" : lag <= 4 ? "warn" : "bad", "마지막 봉 " + lastD + (exp ? " · 있어야 할 날 " + exp : ""), lag <= 0 || (coin && lag <= 2) ? "가장 최근 거래일까지 들어 있어요." : "최근 " + lag + "일치가 비어 있어요 — 지금 가격 · 낙폭 · 평균선 위치가 실제와 다를 수 있어요. 데이터 센터에서 아침 수집을 확인하세요.");
  var dup = 0, back = 0, bad0 = 0, maxGap = 0, gapAt = 0, jumps = [], flat = 0, flatMax = 0, flatAt = 0, hlBad = 0, hlN = 0, adjBreak = [];
  for (var i = 0; i < n; i++) {
    var r = rows[i]; if (!(r.c > 0) || !isFinite(r.c)) bad0++;
    if (i) { var p = rows[i - 1], dt = r.t - p.t; if (dt === 0) dup++; else if (dt < 0) back++; var gd = dt / EG_DAY; if (gd > maxGap) { maxGap = gd; gapAt = p.t; }
      if (p.c > 0 && r.c > 0) { var ch = r.c / p.c - 1; if (Math.abs(ch) > (coin || lev ? 0.6 : 0.4)) jumps.push({ t: r.t, v: ch }); if (r.c === p.c) { flat++; if (flat > flatMax) { flatMax = flat; flatAt = r.t; } } else flat = 0;
        if (r.a > 0 && p.a > 0) { var k1 = (r.a / r.c) / (p.a / p.c); if (k1 > 1.35 || k1 < 0.74) adjBreak.push({ t: r.t, v: k1 }); } } }
    if (i >= n - 500 && r.h != null && r.l != null && r.h > 0) { hlN++; if (r.c > r.h * 1.005 || r.c < r.l * 0.995 || r.l > r.h) hlBad++; }
  }
  add("자료", "날짜 순서 · 중복", dup || back ? "bad" : "ok", dup || back ? "겹친 날 " + dup + " · 거꾸로 된 날 " + back : n.toLocaleString() + "개 봉 모두 순서대로", dup || back ? "같은 날이 두 번 들어가거나 순서가 뒤집혔어요 — 수익률 · 평균선 계산이 틀어져요." : "날짜가 겹치거나 뒤집힌 곳이 없어요.");
  add("자료", "빈 값 · 0 이하 값", bad0 ? "bad" : "ok", bad0 ? bad0 + "개" : "없음", bad0 ? "가격이 비었거나 0인 날이 있어요 — 낙폭이 -100%처럼 계산될 수 있어요." : "모든 날에 정상 가격이 있어요.");
  var gapLim = coin ? 4 : 12; add("자료", "가장 긴 빈 구간", maxGap > gapLim * 2.5 ? "bad" : maxGap > gapLim ? "warn" : "ok", Math.round(maxGap) + "일 (" + ymd(gapAt) + " 뒤)", maxGap > gapLim ? "거래가 없는 날이 길게 이어졌어요(거래 정지 · 자료 누락 가능). 이 구간을 지나는 수익률 · 이동평균은 실제와 다를 수 있어요." : "연휴 수준을 넘는 빈 구간이 없어요.");
  var jl = jumps.slice(-4).map(function (j) { return ymd(j.t) + " " + egPct(j.v); }).join(", ");
  var splitLike = function (v) { var k = 1 + v; return [2, 3, 4, 5, 10, 20, 0.5, 1 / 3, 0.25, 0.2, 0.1, 0.05].some(function (x) { return Math.abs(k / x - 1) < 0.04; }); }, jBad = jumps.some(function (j) { return last.t - j.t < 3 * 365 * EG_DAY && splitLike(j.v); });
  add("자료", "하루 급변 (±" + (coin || lev ? 60 : 40) + "% 초과)", jumps.length ? (jBad ? "bad" : "warn") : "ok", jumps.length ? jumps.length + "번: " + jl : "없음", jumps.length ? "하루에 이만큼 움직이는 일은 드물어요 — 액면분할 · 병합이 반영되지 않았거나 잘못된 값일 수 있어요. 이 날짜를 지나는 낙폭 · 수익률은 믿기 어려워요." + (jBad ? " 최근 3년 안에 분할 비율(2·3·5·10배 등)과 딱 맞는 급변이 있어요 — 그 날짜 앞뒤의 가격 기준이 다를 수 있어요." : " 분할 비율과 맞지 않아 실제 급등락일 수 있어요 — 그날 뉴스를 확인하세요.") : "분할 미반영으로 보이는 급변이 없어요.");
  if (adjBreak.length) add("자료", "수정주가 비율이 끊긴 날", "warn", adjBreak.length + "번: " + adjBreak.slice(-3).map(function (j) { return ymd(j.t); }).join(", "), "배당 · 분할 반영 비율이 하루 사이 크게 바뀌었어요 — 큰 특별배당이나 분할 처리 차이일 수 있어요. 앱은 분할 반영 종가(배당 제외)를 쓰므로 배당이 큰 종목은 장기 수익이 실제(배당 재투자)보다 낮게 나와요.");
  add("자료", "같은 종가가 이어진 날", flatMax >= 10 ? "bad" : flatMax >= 5 ? "warn" : "ok", flatMax ? flatMax + "일 연속 (" + ymd(flatAt) + "까지)" : "없음", flatMax >= 5 ? "값이 그대로 복사된 것처럼 보이는 구간이 있어요(거래 정지 또는 자료 채움). 변동성 · RSI가 실제보다 낮게 나올 수 있어요." : "값이 복사된 흔적이 없어요.");
  var i3 = 0; while (i3 < n - 1 && rows[i3].t < last.t - 3 * 365.25 * EG_DAY) i3++; var yrs3 = (last.t - rows[i3].t) / (365.25 * EG_DAY), per = yrs3 > 0.5 ? (n - i3) / yrs3 : null, perOk = per == null ? null : coin ? per >= 350 && per <= 368 : per >= 232 && per <= 262;
  if (per != null) add("자료", "한 해 봉 수 (최근 3년)", perOk ? "ok" : "warn", Math.round(per) + "개 / 년 (정상 " + (coin ? "약 365" : "약 245~252") + ")", perOk ? "거래일 수가 정상 범위예요." : "한 해 봉 수가 평소와 달라요 — 빠진 날이 있거나 겹친 날이 있을 수 있어요.");
  if (hlN >= 50) add("자료", "종가가 고가~저가 범위 안", hlBad > hlN * 0.02 ? "warn" : "ok", hlBad + " / " + hlN + "일 벗어남", hlBad > hlN * 0.02 ? "종가가 그날 고가 · 저가 밖에 있는 날이 있어요 — 조정 비율이 종가와 고저에 다르게 적용됐을 수 있어요(종가 기준 계산에는 영향 없음)." : "종가 · 고가 · 저가가 서로 맞아요.");
  /* ② 다른 출처와 대조 */
  /* 과거 파일(25년, 며칠에 한 번 새로 받음)과 아침 스냅샷(최근 400일, 매일)은 따로 받은 자료다. 화면에서는 겹치는 구간을 스냅샷으로 덮어 쓰므로,
     덮이기 전의 과거 파일 원본을 다시 읽어 같은 날 종가를 견준다(egSeamLoad). 분할이 한쪽에만 반영됐으면 여기서 드러난다. */
  var SE = EG.seam && EG.seam[sym];
  if (SE && SE.n) add("대조", "과거 파일 vs 아침 수집 스냅샷 (따로 받은 두 자료)", SE.big >= 3 ? "bad" : Math.abs(SE.max) > 0.004 ? "warn" : "ok", "같은 날 " + SE.n + "일 비교 · 최대 차이 " + egPct(SE.max, 2) + (SE.maxD ? " (" + SE.maxD + ")" : "") + " · 2% 넘게 다른 날 " + SE.big + "일 · 과거 파일 " + SE.histLast + "까지", Math.abs(SE.max) > 0.004 ? "따로 받은 두 자료의 같은 날 종가가 달라요 — 한쪽에만 분할 · 정정이 반영됐을 수 있어요. 이 경우 오래된 구간과 최근 구간의 가격 기준이 달라 낙폭 · 평균선이 틀어져요. 데이터 센터의 '과거 데이터 전체 점검'으로 다시 받으세요." : "서로 다른 날 따로 받은 두 자료의 종가가 일치해요.");
  else add("대조", "과거 파일 vs 아침 수집 스냅샷 (따로 받은 두 자료)", "na", SE ? SE.why : "대조 중", SE ? (SE.why === "스냅샷에 없는 종목" ? "대표 목록 밖 종목이라 두 번째 자료가 없어요 — 실시간 조회 한 곳의 값만으로 계산했어요. 프롬프트의 Claude 교차 검증을 꼭 보세요." : "두 자료가 겹치는 날이 없어 대조하지 못했어요.") : "두 번째 자료를 읽는 중이에요.");
  if (F) {
    if (F.per > 0 && F.eps > 0) { var imp = F.per * F.eps, dv = imp / last.c - 1; add("대조", "PER × EPS vs 주가", Math.abs(dv) > 0.35 ? "warn" : "ok", px(imp) + " vs " + px(last.c) + " (" + egPct(dv) + ")", Math.abs(dv) > 0.35 ? "네이버의 PER · EPS로 거꾸로 계산한 주가가 앱 종가와 많이 달라요 — PER과 EPS의 기준(최근 4분기 / 연간 / 예상)이 다르거나 분할 전 값일 수 있어요. PER 점수는 참고로만 보세요." : "PER · EPS와 주가가 서로 맞아요."); }
    if (F.rev && F.op && F.rev.length && F.op.length && F.margin != null) { var rv = F.rev[F.rev.length - 1], op = F.op[F.op.length - 1]; if (rv[0] === op[0] && rv[1] > 0) { var mg = op[1] / rv[1], md = Math.abs(mg - F.margin); add("대조", "영업이익률 vs 영업이익 ÷ 매출", md > 0.02 ? "warn" : "ok", (F.margin * 100).toFixed(1) + "% vs " + (mg * 100).toFixed(1) + "% (" + rv[0] + ")", md > 0.02 ? "표의 영업이익률과 직접 나눈 값이 달라요 — 연도나 단위가 섞였을 수 있어요." : "이익률이 매출 · 영업이익과 맞아요."); } }
    var ly = parseInt(String(F.lastY || "").replace(/\D/g, "").slice(0, 4), 10), ty = new Date(Date.now() + 9 * 3600e3).getUTCFullYear(); if (ly) add("대조", "실적 기준 연도", ty - ly <= 1 ? "ok" : ty - ly === 2 ? "warn" : "bad", ly + "년 (지금 " + ty + "년)", ty - ly <= 1 ? "가장 최근 확정 실적이에요." : "실적이 " + (ty - ly) + "년 전 것이에요 — 성장률 · 이익률 점수가 지금 상황과 다를 수 있어요.");
  }
  /* ③ 계산 검산 — 같은 값을 다른 방법으로 */
  try {
    var S = egScore(sym);
    if (S) {
      var mn = Infinity, w2 = 0; for (i = n - 1; i >= 0; i--) { if (rows[i].c < mn) mn = rows[i].c; var d2 = mn / rows[i].c - 1; if (d2 < w2) w2 = d2; }
      add("검산", "역대 최대 낙폭 (앞→뒤 vs 뒤→앞)", Math.abs(w2 - S.worst) < 1e-9 ? "ok" : "bad", egPct(S.worst, 2) + " vs " + egPct(w2, 2), Math.abs(w2 - S.worst) < 1e-9 ? "두 가지 방법으로 계산한 값이 같아요." : "계산 방법에 따라 값이 달라요 — 앱 계산 오류예요. 알려 주세요.");
      var sum = Math.round(S.body * 0.55 + S.spot * 0.45); add("검산", "점수 합산", sum === S.total ? "ok" : "bad", "체력 " + S.body + " × 0.55 + 자리 " + S.spot + " × 0.45 = " + sum, sum === S.total ? "항목 점수에서 종합까지 다시 더해 맞는지 확인했어요." : "합산이 맞지 않아요 — 앱 계산 오류예요.");
    }
    var M = egMaY1(egMaBreak(sym, "w200"));
    if (M) {
      var W = egWeekly(rows), sm = 0, cnt = 0; for (i = W.length - 200; i < W.length; i++) { if (i >= 0) { sm += W[i].c; cnt++; } } var g2 = cnt === 200 ? W[W.length - 1].c / (sm / 200) - 1 : null;
      if (g2 != null) add("검산", "200주선 대비 (누적합 vs 직접 평균)", Math.abs(g2 - M.gapNow) < 1e-6 ? "ok" : "bad", egPct(M.gapNow, 2) + " vs " + egPct(g2, 2), Math.abs(g2 - M.gapNow) < 1e-6 ? "200주 평균을 처음부터 다시 더해도 같은 값이에요." : "평균선 값이 맞지 않아요 — 앱 계산 오류예요.");
      var bad = 0, chk = 0; M.eps.forEach(function (e) { chk++; var t1 = e.t0 + 365 * EG_DAY, r1 = null; if (t1 <= last.t) { for (var q = 0; q < n; q++) { if (rows[q].t >= t1) { r1 = rows[q].c / e.c0 - 1; break; } } } if ((r1 == null) !== (e.r1 == null) || (r1 != null && Math.abs(r1 - e.r1) > 1e-9)) bad++; if (e.y1 && (e.y1.lo.c > e.c0 * 1.0000001 || e.y1.hi.c < e.c0 * 0.9999999 || Math.abs(e.y1.lo.c / e.c0 - 1 - e.y1.lo.v) > 1e-9)) bad++; });
      if (chk) add("검산", "이탈 사례 수익률 · 가격", bad ? "bad" : "ok", chk + "건 다시 계산 · 불일치 " + bad, bad ? "이탈 사례의 수익률이나 가격이 다시 계산한 값과 달라요 — 앱 계산 오류예요." : "이탈가 · 1년 뒤 수익 · 최저/최고 가격을 처음부터 다시 찾아 같은지 확인했어요.");
    }
  } catch (e) { add("검산", "계산 검산", "bad", "오류", String(e && e.message || e).slice(0, 80)); }
  var nb = C.filter(function (c) { return c.lv === "bad"; }).length, nw = C.filter(function (c) { return c.lv === "warn"; }).length, no = C.filter(function (c) { return c.lv === "ok"; }).length;
  return (EG.memo[key] = { sym: sym, name: egName(sym), checks: C, bad: nb, warn: nw, ok: no, level: nb ? "bad" : nw ? "warn" : "ok", lastD: lastD, n: n, from: ymd(rows[0].t) });
}
function egVerifyHtml(sym) {
  var V = egVerify(sym); if (!V) return "";
  var bd = function (lv) { return '<span class="dhBadge ' + (lv === "ok" ? "ok" : lv === "bad" ? "bad" : lv === "warn" ? "warn" : "") + '">' + (lv === "ok" ? "✓ 통과" : lv === "bad" ? "✗ 실패" : lv === "warn" ? "⚠️ 주의" : "대조 불가") + '</span>'; }, g0 = "";
  var h = '<div class="egBox egVf"><div class="egH">데이터 검증 — ' + egEsc(V.name) + ' <small>분석에 쓰는 숫자를 세 방향으로 확인했어요: 자료 자체 · 다른 출처와 대조 · 계산 검산 · ' + V.from + ' ~ ' + V.lastD + ' · ' + V.n.toLocaleString() + '개 봉 · 분할 반영 종가(배당 제외)</small></div>';
  h += '<div class="dxSum ' + (V.level === "ok" ? "ok" : "warn") + '"' + (V.level === "bad" ? ' style="background:#fcefef;border-color:#c03b3b"' : '') + '>' + (V.level === "ok" ? '<b>' + V.ok + '개 항목 모두 통과</b> — 아래 평가표 · 이탈 사례는 이 자료로 계산했어요.' : V.level === "warn" ? '<b>통과 ' + V.ok + ' · 주의 ' + V.warn + '</b> — 계산은 했지만 주의 항목이 닿는 숫자는 참고로만 보세요: ' + V.checks.filter(function (c) { return c.lv === "warn"; }).map(function (c) { return egEsc(c.k); }).join(" · ") : '<b>실패 ' + V.bad + '개</b> — 값은 아래에 그대로 보여 드려요. 실패 항목이 닿는 숫자는 실제와 다를 수 있으니 흐름 위주로 참고하세요: ' + V.checks.filter(function (c) { return c.lv === "bad"; }).map(function (c) { return egEsc(c.k); }).join(" · ")) + '</div>';
  h += '<details' + (V.level === "ok" ? "" : " open") + '><summary class="egVfS">검증 항목 ' + V.checks.length + '개 보기</summary><div class="dxWrap"><table class="dgT egScT egVfT"><thead><tr><th>확인한 것</th><th>결과 값</th><th>판정</th><th>뜻</th></tr></thead><tbody>' + V.checks.map(function (c) { var head = c.g !== g0 ? '<tr class="dxG"><td colspan="4">' + ({ "자료": "① 자료 자체", "대조": "② 다른 출처와 대조", "검산": "③ 계산 검산 (같은 값을 다른 방법으로)" })[c.g] + '</td></tr>' : ""; g0 = c.g; return head + '<tr class="' + (c.lv === "bad" || c.lv === "warn" ? "dxBad" : "") + '"><td><b>' + egEsc(c.k) + '</b></td><td>' + egEsc(c.v) + '</td><td>' + bd(c.lv) + '</td><td>' + egEsc(c.t) + '</td></tr>'; }).join("") + '</tbody></table></div></details>';
  h += '<div class="egNote"><b>앱이 확인할 수 없는 것</b> — 야후가 준 값 자체가 틀린 경우(두 자료 모두 같은 출처라 같이 틀려요), 상장 전 가격, 배당을 재투자했을 때의 실제 수익. 그래서 ③ 프롬프트에 <b>Claude 교차 검증</b>을 넣었어요 — 지금 가격 · 사상 최고가 · 역대 최대 낙폭 · 52주 고저 · PER 등을 Claude가 웹에서 따로 찾아 앱 값과 나란히 적어요. 답을 붙여넣으면 「Claude 교차 검증」 표로 나와요.</div>';
  return h + '</div>';
}
function egVerifyLines(sym) {
  var V = egVerify(sym), S = egScore(sym), rows = nbHist[sym]; if (!V || !rows) return [];
  var last = rows[rows.length - 1], i1 = rows.length - 1; while (i1 > 0 && rows[i1 - 1].t >= last.t - 365 * EG_DAY) i1--; var hi = -Infinity, lo = Infinity; for (var i = i1; i < rows.length; i++) { hi = Math.max(hi, rows[i].c); lo = Math.min(lo, rows[i].c); }
  var px = function (v) { return egPx(sym, v); }, F = typeof CORE !== "undefined" && CORE.fund ? CORE.fund[sym] : null, R = S && S.raw;
  var L = ["", "[앱 데이터 검증 — " + V.name + "] 자료 " + V.from + " ~ " + V.lastD + " · " + V.n + "개 봉 · 분할 반영 종가(배당 제외) · 통과 " + V.ok + " / 주의 " + V.warn + " / 실패 " + V.bad];
  V.checks.filter(function (c) { return c.lv === "warn" || c.lv === "bad"; }).forEach(function (c) { L.push("- " + (c.lv === "bad" ? "실패" : "주의") + ": " + c.k + " — " + c.v); });
  L.push("[교차 검증 요청] 아래 앱 값을 웹에서 따로 확인해 edge 안에 \"check\" 배열로 넣는다. 형식: { \"item\": \"항목\", \"app\": \"앱 값\", \"web\": \"웹에서 찾은 값(날짜)\", \"src\": \"출처\", \"ok\": true|false, \"note\": \"다르면 이유(분할 · 배당 · 기준일 · 장중/종가 차이 등)\" }. 못 찾으면 web에 \"확인 못 함\", ok는 null. 앱 가격은 분할 반영 · 배당 제외 종가라는 점을 감안해 비교한다. 3% 넘게 다르면 ok:false.");
  L.push("- 지금 가격: " + px(last.c) + " (" + V.lastD + " 종가)");
  L.push("- 52주(종가 기준) 최고 · 최저: " + px(hi) + " · " + px(lo));
  if (R) { L.push("- 사상 최고 종가: " + px(R.pk) + " (" + egYm(R.pkT) + ")"); L.push("- 역대 최대 낙폭: " + egPct(S.worst) + " · " + px(R.worstPk) + "(" + egYm(R.worstPkT) + ") → " + px(R.worstC) + "(" + egYm(R.worstT) + ")"); L.push("- 지금 고점 대비: " + egPct(S.cur)); if (R.wGap != null) L.push("- 200주 이동평균 대비: " + egPct(R.wGap) + " (지금 " + (R.wGap < 0 ? "아래" : "위") + ")"); }
  L.push("- 자료 시작(상장 또는 야후 제공 시작): " + V.from);
  if (F) { if (F.per != null) L.push("- PER: " + F.per + "배"); if (F.roe != null) L.push("- ROE: " + F.roe.toFixed(1) + "%"); if (F.rev && F.rev.length) L.push("- 최근 확정 매출: " + F.rev[F.rev.length - 1][0] + " " + F.rev[F.rev.length - 1][1]); }
  if (egLev(sym)) L.push("- 레버리지 상품: 배수 · 기초지수 · 과거 액면병합/분할 날짜도 확인");
  return L;
}
(function () {
  /* 프롬프트: 검증 결과 + 교차 검증 요청 */
  EG.seam = EG.seam || {};
  var b0 = egBlock; egBlock = function (syms, withPort) { var t = b0.apply(this, arguments), L = []; if (syms && syms[0]) L = egVerifyLines(syms[0]); if (!L.length) return t; var mark = "\n=== 예측 · 대응 · 방향 (edge)", i = t.indexOf(mark); return i >= 0 ? t.slice(0, i) + "\n" + L.join("\n") + t.slice(i) : t + "\n" + L.join("\n"); };
  var n0 = egNorm; egNorm = function (E) { var o = n0.apply(this, arguments), K = E && E.check; if (Array.isArray(K) && K.some(function (x) { return x && x.item; })) { o = o || { history: [], policy: [], paths: [], roadmap: null, protect: [], grow: [], mine: "" }; o.check = K.filter(function (x) { return x && x.item; }).slice(0, 14); } return o; };
  var x0 = egExtraHtml; egExtraHtml = function (E, opt) {
    var h = x0.apply(this, arguments), N = egNorm(E), K = N && N.check; if (!K) return h; var no = K.filter(function (x) { return x.ok === false; }).length, un = K.filter(function (x) { return x.ok == null; }).length;
    var add = '<div class="anxH">Claude 교차 검증 — 앱 값 vs 웹</div><div class="dxSum ' + (no ? "warn" : "ok") + '">' + K.length + '개 항목 중 일치 <b>' + (K.length - no - un) + '</b> · 불일치 <b>' + no + '</b> · 확인 못 함 <b>' + un + '</b>' + (no ? ' — 불일치 항목이 닿는 점수는 믿지 말고 이유를 먼저 확인하세요.' : '') + '</div><div class="dxWrap"><table class="dgT egScT"><thead><tr><th>항목</th><th>앱 값</th><th>판정</th><th>웹 값 · 출처 · 이유</th></tr></thead><tbody>' + K.map(function (x) { return '<tr class="' + (x.ok === false ? "dxBad" : "") + '"><td><b>' + egEsc(x.item) + '</b></td><td>' + egEsc(x.app || "-") + '</td><td><span class="dhBadge ' + (x.ok === true ? "ok" : x.ok === false ? "bad" : "") + '">' + (x.ok === true ? "✓ 일치" : x.ok === false ? "✗ 다름" : "미확인") + '</span></td><td>' + egEsc(x.web || "-") + (x.src ? ' <small>(' + egEsc(x.src) + ')</small>' : '') + (x.note ? '<br><small>' + egEsc(x.note) + '</small>' : '') + '</td></tr>'; }).join("") + '</tbody></table></div>';
    return h ? h.replace('<div class="egX">', '<div class="egX">' + add) : '<div class="egX">' + add + '</div>';
  };
  /* v12.99 실패가 있어도 값은 그대로 보여 준다 — 맨 위에 어떤 검증이 실패했는지 알리고, 판단은 보는 사람이 한다 */
  var s0 = egScoreHtml; egScoreHtml = function (sym) {
    var h = s0.apply(this, arguments), V = egVerify(sym); if (!h || !V || V.level !== "bad") return h;
    var fl = V.checks.filter(function (c) { return c.lv === "bad"; }), ban = '<div class="dxSum warn" style="background:#fcefef;border-color:#c03b3b"><b>자료 검증 실패 ' + V.bad + '개</b> — 아래 점수와 숫자는 그대로 보여 드리지만, 실패 항목이 닿는 값은 실제와 다를 수 있어요. 숫자 자체보다 흐름을 참고하세요.<br>' + fl.map(function (c) { return '· <b>' + egEsc(c.k) + '</b>: ' + egEsc(c.v); }).join('<br>') + '</div>';
    var k = h.indexOf('<div class="egScTop">'); return k >= 0 ? h.slice(0, k) + ban + h.slice(k) : ban + h;
  };
  var r0 = egScanRow; egScanRow = function (sym) { var r = r0.apply(this, arguments); if (r) { var V = egVerify(sym); if (V) { r.q = V.level; if (V.level === "bad") r.qw = V.checks.filter(function (c) { return c.lv === "bad"; }).map(function (c) { return c.k; }).join(", "); } } return r; };
  /* 스캔 목록에서도 빼지 않는다 — 줄에 '검증 실패' 표시만 */
  var h0 = egScanHtml; egScanHtml = function () { var h = h0.apply(this, arguments), R = egScanLoad(); if (!R || !R.rows) return h; var bad = R.rows.filter(function (r) { return r.q === "bad"; }), wn = R.rows.filter(function (r) { return r.q === "warn"; }).length; var add = '<div class="briefDim" style="margin:6px 0">데이터 검증: 통과 ' + (R.rows.length - bad.length - wn) + ' · 주의 ' + wn + ' · <b>실패 ' + bad.length + '</b>' + (bad.length ? ' — 실패 종목도 목록에 그대로 있고 이름 옆에 "검증 실패"로 표시돼요: ' + bad.slice(0, 12).map(function (r) { return egEsc(r.n) + '(' + egEsc(r.qw || "") + ')'; }).join(", ") + (bad.length > 12 ? " 외 " + (bad.length - 12) : "") : '') + '</div>'; var k = h.indexOf('<div class="egChips">'); return k >= 0 ? h.slice(0, k) + add + h.slice(k) : h; };
  /* 분석 화면 ②: 맨 앞에 검증 */
  if (typeof anxSections === "function") { var a0 = anxSections; anxSections = function (root) {
    var r = a0.apply(this, arguments);
    try { var sym = AN.sym, secs = root.querySelectorAll(".anSec"); if (sym && secs[1] && nbHist[sym] && EG["sd:" + sym] && !secs[1].querySelector(".egVf")) {
      if (!EG.seam[sym] && !EG["sm:" + sym]) { EG["sm:" + sym] = 1; egSeamLoad(sym).then(function () { if (currentTab === "analyst" && AN.sym === sym) renderAnalyst(); }); }
      var hh = egVerifyHtml(sym), first = secs[1].querySelector(".egBox"); if (hh) { if (first) first.insertAdjacentHTML("beforebegin", hh); else secs[1].insertAdjacentHTML("beforeend", hh); }
    } } catch (e) { console.warn("eg", e); }
    return r;
  }; }
  var st = document.createElement("style"); st.textContent = ".egVfS{cursor:pointer;font-weight:700;font-size:13px;margin:6px 0}.egVfT th:nth-child(3){width:86px}.egVfT .dhBadge,.egX .dhBadge{white-space:nowrap}.dhBadge.bad{background:#fcefef;color:#c03b3b}"; document.head.appendChild(st);
})();

/* 과거 파일 원본과 아침 스냅샷의 같은 날 종가를 견준다 — 두 번 따로 받은 자료의 일치 확인 */
function egSeamLoad(sym) {
  EG.seam = EG.seam || {}; if (EG.seam[sym]) return Promise.resolve(EG.seam[sym]);
  var kr = /\.K[SQ]$|^\^K/.test(sym), coin = /-USD$/.test(sym), ymd = function (sec) { return new Date(sec * 1000 + (kr || coin ? 9 : -5) * 3600e3).toISOString().slice(0, 10); };
  if (typeof fetchRecent !== "function" || typeof fetchSnapFile !== "function") return Promise.resolve((EG.seam[sym] = { n: 0, why: "대조 기능 없음" }));
  return Promise.all([fetchRecent().catch(function () { return null; }), fetchSnapFile(sym).catch(function () { return null; })]).then(function (a) {
    var rec = a[0] && a[0].symbols && a[0].symbols[sym], snap = a[1];
    if (!rec || !rec.t) return (EG.seam[sym] = { n: 0, why: "스냅샷에 없는 종목" }); if (!snap || !snap.t || !snap.t.length) return (EG.seam[sym] = { n: 0, why: "과거 파일 없음 (실시간 조회로 계산)" });
    var m = {}, n = 0, mx = 0, mxD = "", big = 0; for (var i = Math.max(0, snap.t.length - 420); i < snap.t.length - 1; i++) m[ymd(snap.t[i])] = snap.c[i];   // 과거 파일의 마지막 봉은 받는 순간 장중 값일 수 있어 뺀다
    for (i = 0; i < rec.t.length; i++) { var d = ymd(rec.t[i]), hc = m[d]; if (hc > 0 && rec.c[i] > 0) { n++; var df = hc / rec.c[i] - 1; if (Math.abs(df) > 0.02) big++; if (Math.abs(df) > Math.abs(mx)) { mx = df; mxD = d; } } }
    return (EG.seam[sym] = n ? { n: n, max: mx, maxD: mxD, big: big, histLast: ymd(snap.t[snap.t.length - 1]) } : { n: 0, why: "겹치는 날 없음" });
  }).catch(function () { return (EG.seam[sym] = { n: 0, why: "대조 실패" }); });
}

/* ============================================================
   v13.00 ① 분석 프롬프트에 본질 · 변수 자료를 함께  ② 스캔 표 설명 · 200주선 이탈 중 · 조건 직접 넣기  ③ 분석 화면을 '요약 + 탭'으로 재구성
   ============================================================ */
/* ---------- ① 본질 · 변수 (본질/변수 화면과 같은 계산) ---------- */
function egCoreEnsure(sym) {
  var idx = egIndexOf(sym), ps = [egEnsure([sym, idx, "^VIX", "KRW=X"])];
  if (typeof macroEnsure === "function") ps.push(macroEnsure().then(function () { return typeof macPxLoad === "function" ? macPxLoad() : null; }).catch(function () {}));
  if (typeof coreFund === "function") ps.push(coreFund(sym).catch(function () {}));
  try { if (typeof CORE !== "undefined" && !CORE.ans && typeof coreLoadAns === "function") coreLoadAns(); } catch (e) {}
  return Promise.all(ps).catch(function () {});
}
function egCoreData(sym) {
  if (typeof coreLong !== "function") return null; var idx = egIndexOf(sym), out = { sym: sym, rows: [], vars: [], fx: null, ev: [], iss: [], ans: null };
  [sym, idx].filter(function (s, i, a) { return s && a.indexOf(s) === i; }).forEach(function (s) { var L = null, F = null, V = null; try { L = coreLong(s); F = (CORE.fund && CORE.fund[s]) || null; V = coreVerdict(L, F); } catch (e) {} if (L) out.rows.push({ sym: s, name: egName(s), L: L, F: F, V: V }); });
  try { out.vars = coreVars() || []; } catch (e) {}
  try { var FX = coreFx(); if (FX) out.fx = { F: FX, V: coreFxVerdict(FX) }; } catch (e) {}
  try { out.ev = coreEvents() || []; } catch (e) {}
  try { out.iss = coreIssues() || []; } catch (e) {}
  try { if (CORE.ans && CORE.ans.j) out.ans = CORE.ans; } catch (e) {}
  var me = out.rows[0], on = out.vars.filter(function (v) { return v.on; }).length; out.essOk = me && me.V ? me.V.st === "good" : null; out.varOn = on;
  out.quad = out.essOk == null ? null : out.essOk && !on ? ["본질 좋음 · 변수 조용", "가장 편한 자리 — 정해 둔 적립을 그대로"] : out.essOk && on ? ["본질 좋음 · 변수 켜짐", "흔들리지만 본질은 그대로 — 변수 대응 규칙(분할 · 현금)을 꺼낼 때"] : !on ? ["본질 약함 · 변수 조용", "시장이 조용해도 이 자산 자체에 문제가 있을 수 있어요 — 이유부터 확인"] : ["본질 약함 · 변수 켜짐", "가장 조심할 자리 — 비중을 늘리기보다 지키는 쪽"];
  return out;
}
function egCoreLines(sym) {
  var D = egCoreData(sym); if (!D || (!D.rows.length && !D.vars.length)) return []; var P = function (v, d) { return typeof corePct === "function" ? corePct(v, d) : egPct(v, d); }, L = ["", "[본질 · 변수 — 앱의 본질/변수 화면과 같은 자료]"];
  if (D.rows.length) { L.push("· 본질 (이 종목과 그 시장)  이름 | 연수익 3년/5년/10년 | 1년 | 아무 날 사서 1년 뒤 플러스 확률·중앙값·최악(최근 10년) | 고점 대비 | 역대 최대 낙폭 | -20% 낙폭 수(미회복)·회복 보통/최장 | 200일선 | 52주 위치 | 연변동성 | 규칙 판정(좋음/나쁨 수)과 근거");
    D.rows.forEach(function (x) { var l = x.L, f = x.F; L.push("- " + x.name + "(" + x.sym + ") | " + P(l.c3, 1) + "/" + P(l.c5, 1) + "/" + P(l.c10, 1) + " | " + P(l.ret1, 1) + " | " + (l.f1 ? Math.round(l.f1.win * 100) + "% · " + P(l.f1.med, 0) + " · 최악 " + P(l.f1.worst, 0) : "-") + " | " + P(l.cur, 1) + " | " + P(l.worst, 0) + (l.worstY ? "(" + l.worstY + ")" : "") + " | " + l.dd20 + "(" + l.dd20open + ")" + (l.recMed ? " · " + Math.round(l.recMed / 30) + "개월/" + Math.round(l.recMax / 30) + "개월" : "") + " | " + (l.above200 == null ? "-" : (l.above200 ? "위 " : "아래 ") + P(l.vs200, 1)) + " | " + (l.pos52 == null ? "-" : Math.round(l.pos52 * 100)) + " | " + (l.vol == null ? "-" : Math.round(l.vol * 100) + "%") + (f ? " | 매출 " + P(f.revG, 0) + " · 영업이익 " + P(f.opG, 0) + (f.opNeg ? "(적자)" : "") + " · ROE " + (f.roe == null ? "-" : f.roe.toFixed(1)) + " · PER " + (f.per == null ? "-" : f.per) + " · 배당 " + (f.divY == null ? "-" : f.divY + "%") : "") + " | " + (x.V ? x.V.t + "(" + x.V.good + "/" + x.V.bad + ") — " + (x.V.why || []).join(" ; ") : "-")); }); }
  if (D.quad) L.push("· 본질 × 변수 지금 자리: " + D.quad[0] + " → " + D.quad[1]);
  if (D.vars.length) { L.push("· 변수 (매크로 조건)  조건 | 지금 | 값 | 과거 n번 → 코스피 1년 뒤 중앙값/승률 | 앱의 대응 규칙"); D.vars.forEach(function (v) { L.push("- " + v.name + " | " + (v.on ? "켜짐" : v.warn ? "주의" : "꺼짐") + " | " + (v.now || "") + (v.y1 ? " | " + v.n + "번 → " + P(v.y1.med, 0) + " / 승률 " + Math.round(v.y1.win * 100) + "%" : "") + (v.on || v.warn ? " | " + (v.resp || "") : "")); }); }
  if (D.fx) { var FX = D.fx.F; L.push("· 환율 자리: 지금 " + Math.round(FX.now) + "원 · 1년 평균 " + Math.round(FX.y1.avg) + "원 · 3년 고점 " + Math.round(FX.max3) + "원 → " + D.fx.V.t); }
  if (D.ev.length) { L.push("· 다가오는 일정(14일)"); D.ev.slice(0, 6).forEach(function (e) { L.push("- " + e.d + " " + e.t + (e.kb ? " — 볼 것: " + e.kb.watch : "")); }); }
  if (D.iss.length) { L.push("· 오늘 켜진 이슈"); D.iss.slice(0, 4).forEach(function (i) { L.push("- " + i.t + (i.sub ? " · " + i.sub : "") + (i.why ? " — 왜: " + i.why : "")); }); }
  if (D.ans) { var J = D.ans.j, E = J.essence || {}, mine = (E.assets || []).filter(function (a) { return a && a.name && (a.name === egName(sym) || String(a.name).indexOf(egName(sym)) >= 0); })[0];
    L.push("· 본질/변수 화면에 저장된 Claude 답 (" + D.ans.day + "): 전체 본질 " + (E.verdict || "-") + (E.score != null ? " " + E.score + "점" : "") + (E.one ? " — " + E.one : ""));
    if (mine) L.push("- 이 종목: " + (mine.st || "") + (mine.score != null ? " " + mine.score + "점" : "") + " · " + (mine.why || "") + (mine.risk ? " / 위험: " + mine.risk : "") + (mine.watch ? " / 볼 것: " + mine.watch : ""));
    (J.variables || []).slice(0, 6).forEach(function (v) { if (v && v.name) L.push("- 변수 " + v.name + " [" + (v.state || "") + "] 대응 시작: " + (v.trigger || "-") + " → " + (v.response || "-")); }); }
  L.push("→ 이 자료로 edge 안에 \"core\" 키를 쓴다: { \"essence\": \"이 종목의 본질 판정(유지|주의|훼손) + 이유 2문장 — 이익 · 성장 · 회복력 숫자 인용\", \"changed\": \"본질이 바뀌었는지 볼 숫자와 시점 한 줄\", \"vars\": [ { \"name\": \"변수(켜짐 · 주의 위주 3개 이내)\", \"path\": \"이 종목에 닿는 경로: 무엇 → 무엇 → 이 종목\", \"trigger\": \"대응을 시작할 조건(숫자)\", \"response\": \"그때 할 일(비중 · 분할 · 확인)\" } ], \"stance\": \"본질 × 변수 지금 자리에서의 행동 원칙 2문장 — 본질이 그대로면 변수는 대응의 대상이지 매도 이유가 아니라는 점을 기준으로\" }. 종합 평가표 · 이탈 사례 · 닮은 과거와 모순되지 않게, 서로 엇갈리면 어느 쪽을 더 믿는지와 이유를 쓴다.");
  return L;
}
function egCoreHtml(sym) {
  var D = egCoreData(sym); if (!D) return ""; var h = '<div class="egBox egCo"><div class="egH">본질 · 변수 — ' + egEsc(egName(sym)) + ' <small>본질/변수 화면과 같은 계산이에요 · 이 종목의 본질 판정과, 지금 켜진 변수 · 다가오는 일정이 프롬프트에 함께 들어가요</small></div>';
  if (D.quad) h += '<div class="dxSum ' + (D.essOk && !D.varOn ? "ok" : "warn") + '"><b>' + egEsc(D.quad[0]) + '</b> — ' + egEsc(D.quad[1]) + '</div>';
  D.rows.forEach(function (x) { var V = x.V || {}; h += '<div class="egA"><div class="egAH"><b>' + egEsc(x.name) + '</b><span>본질 규칙 판정</span><em class="' + (V.st === "good" ? "" : "egThin") + '">' + egEsc(V.t || "-") + ' · 좋음 ' + (V.good || 0) + ' / 나쁨 ' + (V.bad || 0) + '</em></div><div class="egWhy">' + (V.why || []).map(function (w) { return '<span class="' + (/^✓/.test(w) ? "g" : /^✗/.test(w) ? "b" : "") + '">' + egEsc(w) + '</span>'; }).join("") + '</div></div>'; });
  if (D.vars.length) h += '<div class="egSubH">변수 — 지금 켜진 것 ' + D.varOn + '개</div><div class="dxWrap"><table class="dgT egScT"><thead><tr><th>변수</th><th>지금</th><th>상태</th><th>대응 규칙</th></tr></thead><tbody>' + D.vars.slice().sort(function (a, b) { return (b.on ? 2 : b.warn ? 1 : 0) - (a.on ? 2 : a.warn ? 1 : 0); }).map(function (v) { return '<tr class="' + (v.on ? "dxBad" : "") + '"><td><b>' + (v.icon || "") + ' ' + egEsc(v.name) + '</b></td><td>' + egEsc(v.now || "") + '</td><td><span class="dhBadge ' + (v.on ? "bad" : v.warn ? "warn" : "ok") + '">' + (v.on ? "켜짐" : v.warn ? "주의" : "꺼짐") + '</span></td><td>' + egEsc(v.on || v.warn ? v.resp || "" : (v.y1 ? "과거 " + v.n + "번 → 코스피 1년 뒤 보통 " + egPct(v.y1.med) : "")) + '</td></tr>'; }).join("") + '</tbody></table></div>';
  if (D.fx) h += '<div class="egNote"><b>환율 자리</b> — 지금 ' + Math.round(D.fx.F.now).toLocaleString() + '원 · 1년 평균 ' + Math.round(D.fx.F.y1.avg).toLocaleString() + '원 → ' + egEsc(D.fx.V.t) + '</div>';
  if (D.ev.length) h += '<div class="egSubH">다가오는 일정 (14일)</div><div class="egEvL">' + D.ev.slice(0, 6).map(function (e) { return '<div><b>' + egEsc(String(e.d).slice(5)) + '</b> ' + egEsc(e.t) + (e.kb ? '<small>볼 것: ' + egEsc(e.kb.watch) + '</small>' : '') + '</div>'; }).join("") + '</div>';
  if (D.ans) h += '<div class="briefDim" style="margin-top:8px">본질/변수 화면에 저장된 Claude 답(' + egEsc(D.ans.day) + ')도 프롬프트에 요약해 넣어요. <button class="chip" onclick="navTo(\'core\')">본질 · 변수 화면 열기</button></div>'; else h += '<div class="briefDim" style="margin-top:8px">본질/변수 화면에서 Claude 답을 저장해 두면 그 결론(변수별 대응 조건)도 여기 프롬프트에 함께 들어가요. <button class="chip" onclick="navTo(\'core\')">본질 · 변수 화면 열기</button></div>';
  return h + '</div>';
}

/* ---------- ② 스캔: 설명 · 200주선 이탈 중 · 조건 직접 넣기 ---------- */
EGS.cond = EGS.cond || { b: 60, ch: 55, tech: 0, dd: 0, ma: 999, noLev: true, noBad: false };
try { var _c = JSON.parse(localStorage.getItem("sm.scan.cond") || "null"); if (_c) EGS.cond = Object.assign(EGS.cond, _c); } catch (e) {}
egScanFilter = function (rows) {
  var mk = EGS.mk, f = EGS.flt, C = EGS.cond; rows = rows.filter(function (r) { return mk === "all" || (mk === "kr" ? /\.K[SQ]$/.test(r.s) : mk === "coin" ? /-USD$/.test(r.s) : !/\.K[SQ]$|-USD$/.test(r.s)); });
  if (f === "good") rows = rows.filter(function (r) { return r.b >= 65 && r.ch >= 62 && !r.lev; });
  else if (f === "brk") rows = rows.filter(function (r) { return r.wOpen && r.wGap != null && r.wGap < 0; }).sort(function (a, b) { return b.b - a.b; });
  else if (f === "ma") rows = rows.filter(function (r) { return r.wGap != null && r.wGap >= 0 && r.wGap <= 0.1 && r.b >= 55; }).sort(function (a, b) { return a.wGap - b.wGap; });
  else if (f === "dd") rows = rows.filter(function (r) { return r.cur <= -0.2 && r.b >= 60; }).sort(function (a, b) { return a.cur - b.cur; });
  else if (f === "strong") rows = rows.filter(function (r) { return r.b >= 75 && (r.tech || 0) >= 68; });
  else if (f === "lev") rows = rows.filter(function (r) { return r.lev; });
  else if (f === "custom") rows = rows.filter(function (r) { return r.b >= C.b && r.ch >= C.ch && (r.tech == null ? C.tech <= 0 : r.tech >= C.tech) && (C.dd >= 0 ? true : r.cur <= C.dd / 100) && (C.ma >= 900 ? true : r.wGap != null && r.wGap <= C.ma / 100) && (!C.noLev || !r.lev) && (!C.noBad || r.q !== "bad"); });
  return rows;
};
egScanHtml = function () {
  var R = egScanLoad(), today = typeof smKstDay === "function" ? smKstDay() : "", col = function (p) { return p == null ? "#8a93a3" : p >= 68 ? "#1d7f55" : p >= 55 ? "#3182f6" : p >= 42 ? "#b9600f" : "#c03b3b"; }, C = EGS.cond;
  var all = R && R.rows ? R.rows : [], cntOf = function (f) { var k = EGS.flt, m = EGS.mk; EGS.flt = f; var n = egScanFilter(all.slice()).length; EGS.flt = k; EGS.mk = m; return n; };
  var FL = [["good", "튼튼한데 싸진 것"], ["brk", "200주선 이탈 중"], ["ma", "200주선 바로 위"], ["dd", "-20% 넘게 빠진 것"], ["strong", "튼튼하고 오르는 중"], ["all", "전체 순위"], ["lev", "레버리지"], ["custom", "내 조건"]], MK = [["all", "전체"], ["kr", "국내"], ["us", "해외"], ["coin", "코인"]];
  var open = EGS.open != null ? EGS.open : !(typeof AN !== "undefined" && AN.sym), bad = all.filter(function (r) { return r.q === "bad"; }), wn = all.filter(function (r) { return r.q === "warn"; }).length;
  var h = '<details class="egBox egScan"' + (open || EGS.run ? " open" : "") + '><summary class="egScanS"><b>오늘의 후보 — 전 종목 스캔</b><span>' + (EGS.run ? "스캔 중 " + EGS.done + " / " + EGS.total : R ? R.day + " · " + all.length + "종목 · 튼튼한데 싸진 것 <b>" + cntOf("good") + "</b> · 200주선 이탈 중 <b>" + cntOf("brk") + "</b>" + (R.day !== today ? " · 오늘 다시 스캔 필요" : "") : "아직 스캔 전 — 눌러서 열기") + '</span><i>펼치기 · 접기</i></summary>';
  h += '<div class="egH"><small>앱에 있는 종목 전체(지수 · 환율 제외)를 25년 일봉으로 계산해 점수를 매겨요. 매수 추천이 아니라 "먼저 들여다볼 순서"예요.</small></div>';
  h += '<div class="anActs"><button class="primary" data-egscan' + (EGS.run ? " disabled" : "") + '>' + (EGS.run ? "스캔 중 " + EGS.done + " / " + EGS.total : R && R.day === today ? "🔄 다시 스캔" : "🔎 오늘 스캔 시작 (1~3분)") + '</button><span class="briefDim">' + (R ? "마지막 스캔 " + R.day + (R.day !== today ? " — 오늘 데이터로 다시 스캔하세요" : "") : "아침 수집(07:00) 뒤 하루 한 번이면 충분해요") + '</span></div>';
  if (EGS.run) h += '<div class="egBar" style="height:8px"><u style="width:' + (EGS.total ? Math.round(EGS.done / EGS.total * 100) : 0) + '%"></u></div>';
  if (all.length) {
    var rows = egScanFilter(all.slice());
    /* v13.01 조건은 네모 칸으로 줄 맞춰, 시장은 한 줄짜리 전환 스위치로 따로 */
    h += '<div class="egFlRow"><span class="egFlL">시장</span><div class="egSeg">' + MK.map(function (m) { return '<button class="' + (EGS.mk === m[0] ? "on" : "") + '" data-egmk="' + m[0] + '">' + m[1] + '</button>'; }).join("") + '</div></div>';
    h += '<div class="egFlRow"><span class="egFlL">조건</span><div class="egFl">' + FL.map(function (f) { return '<button class="' + (EGS.flt === f[0] ? "on" : "") + '" data-egflt="' + f[0] + '"><span>' + f[1] + '</span><b>' + (f[0] === "all" ? all.length : cntOf(f[0])) + '</b></button>'; }).join("") + '</div></div>';
    if (EGS.flt === "custom") h += '<div class="egCond"><label>체력 ≥ <input type="number" data-egc="b" value="' + C.b + '" min="0" max="100"></label><label>싼 정도 ≥ <input type="number" data-egc="ch" value="' + C.ch + '" min="0" max="100"></label><label>흐름 ≥ <input type="number" data-egc="tech" value="' + C.tech + '" min="0" max="100"></label><label>지금 낙폭 ≤ <input type="number" data-egc="dd" value="' + C.dd + '" max="0" min="-99"> %</label><label>200주선 대비 ≤ <input type="number" data-egc="ma" value="' + (C.ma >= 900 ? "" : C.ma) + '" placeholder="제한 없음"> %</label><label><input type="checkbox" data-egc="noLev"' + (C.noLev ? " checked" : "") + '> 레버리지 빼기</label><label><input type="checkbox" data-egc="noBad"' + (C.noBad ? " checked" : "") + '> 검증 실패 빼기</label><span class="briefDim">예: 체력 70 · 낙폭 -25 · 200주선 0 → "튼튼한데 4년 평균보다 싸고 25% 넘게 빠진 것"</span></div>';
    var FD = { good: "체력 65점 이상 + 싼 정도 62점 이상 (레버리지 제외)", brk: "주봉 종가가 200주선 아래로 내려와 아직 4주 연속 회복하지 못한 종목 — 체력 높은 순", ma: "200주선 위 0~10% — 선에 가까워 곧 닿을 수 있는 종목 (체력 55점 이상)", dd: "고점에서 20% 넘게 빠졌고 체력 60점 이상 — 많이 빠진 순", strong: "체력 75점 이상 + 흐름 68점 이상 — 싸지는 않지만 오르는 중", custom: "아래에 직접 넣은 조건", all: "종합 점수 순", lev: "레버리지 · 인버스 상품만 — 회복력 60점 상한" };
    h += '<div class="briefDim" style="margin:2px 0 6px">조건: ' + FD[EGS.flt] + ' · <b>' + rows.length + '</b>종목 · 데이터 검증 통과 ' + (all.length - bad.length - wn) + ' / 주의 ' + wn + ' / 실패 ' + bad.length + '</div>';
    h += rows.length ? '<div class="dxWrap egScanW"><table class="dgT egScanT"><thead><tr><th>#</th><th>종목</th><th title="체력 55% + 자리 45%">종합</th><th title="회복력 60% + 기업 정보 40%">체력</th><th title="MDD + 장기 평균선">싼 정도</th><th title="기술 지표 4개 평균">흐름</th><th>지금 낙폭<br><small>역대 최대</small></th><th>200주선 대비</th><th>큰 하락 회복</th><th>기록</th><th>한 줄 판정</th></tr></thead><tbody>' + rows.slice(0, 60).map(function (r, i) {
      var sc = function (p) { return '<b style="color:' + col(p) + '">' + (p == null ? "-" : p) + '</b>'; }, tg = [];
      if (r.lev) tg.push('<i class="egTg lev" title="레버리지 · 인버스 상품 — 지수가 제자리여도 원금이 줄 수 있어 회복력 점수를 60점으로 제한했어요">레버리지</i>');
      if (!r.f) tg.push('<i class="egTg" title="기업 정보(ROE · 이익률 · 성장 · PER) 없이 회복력만으로 체력 점수를 냈어요 — ETF · 코인이거나, 상위 40개 밖이라 재무를 받지 않은 주식이에요. 종목을 누르면 재무까지 넣어 다시 계산해요">회복력만</i>');
      if (r.q === "bad") tg.push('<i class="egTg bad" title="자료 검증 실패: ' + egEsc(r.qw || "") + ' — 숫자가 실제와 다를 수 있어요. 값은 그대로 보여 줘요">검증 실패</i>'); else if (r.q === "warn") tg.push('<i class="egTg warn" title="자료 검증에 주의 항목이 있어요 — 종목을 눌러 검증 탭에서 확인">검증 주의</i>');
      return '<tr data-ansym2="' + egEsc(r.s) + '"><td>' + (i + 1) + '</td><td class="dgName"><b>' + egEsc(r.n) + '</b> ' + tg.join(" ") + '<br><small>' + egEsc(r.s) + ' · ' + egPx(r.s, r.px) + '</small></td><td>' + sc(r.t) + '</td><td>' + sc(r.b) + '</td><td>' + sc(r.ch) + '</td><td>' + sc(r.tech) + '<br><small>' + (r.tech == null ? "" : r.tech >= 68 ? "오름" : r.tech <= 48 ? "내림" : "횡보") + '</small></td><td><b class="dn">' + egPct(r.cur) + '</b><br><small>' + egPct(r.worst) + '</small></td><td>' + (r.wGap == null ? '<small>기록 부족</small>' : '<b class="' + (r.wGap < 0 ? "dn" : "") + '">' + egPct(r.wGap) + '</b>' + (r.wOpen && r.wGap < 0 ? '<br><i class="egTg bad">이탈 중</i>' : r.wOpen ? '<br><i class="egTg warn">복귀 확인 중</i>' : '')) + '</td><td>' + r.rec + '번</td><td>' + r.yrs + '년' + (r.cagr != null ? '<br><small>연 ' + egPct(r.cagr, 1) + '</small>' : '') + '</td><td class="egScanR">' + egEsc(r.read) + '</td></tr>';
    }).join("") + '</tbody></table></div><div class="briefDim" style="margin-top:6px">줄을 누르면 그 종목 분석으로 넘어가요.' + (rows.length > 60 ? " 상위 60개만 보여요." : "") + '</div>' : '<div class="briefDim" style="padding:10px 0">이 조건에 맞는 종목이 오늘은 없어요.</div>';
    h += '<details class="egLegend"><summary>표 읽는 법 — 점수 · 표시의 뜻</summary><div class="egLg">' +
      '<div><b>종합</b>체력 55% + 자리 45%. 68점 이상 좋음 · 55~67 보통 · 42~54 주의 · 그 아래 나쁨 (색: 초록 · 파랑 · 주황 · 빨강).</div>' +
      '<div><b>체력</b>오래 살아남고 회복해 왔는가. 회복력(관찰 기간 · -20% 하락 뒤 회복 횟수 · 회복까지 걸린 시간 · 전 기간 연수익 · 3년 보유 플러스 비율) 60% + 기업 정보(ROE · 이익률 · 매출/이익 성장 · PER) 40%.</div>' +
      '<div><b>싼 정도</b>지금 가격이 이 종목의 과거에 비해 얼마나 싼가. MDD(지금 낙폭이 역사에서 어느 정도인지)와 장기 평균선(200주선 대비)으로만 계산해요. 많이 빠질수록 높아요 — 그래서 체력과 같이 봐야 해요.</div>' +
      '<div><b>흐름</b>지금 오르는 중인지 내리는 중인지. 기술 지표 4개의 평균이에요: ① RSI(30 아래 침체는 높게, 70 위 과열은 낮게) ② 20 · 60 · 200일선 배열(정배열 78 · 혼조 55 · 역배열 38) ③ 최근 1년 수익 ④ 1년 변동성(차분할수록 높게). <b>68 이상 = 오름, 48 이하 = 내림, 그 사이 = 횡보.</b> 흐름이 내림이면 "싸졌지만 아직 떨어지는 중"일 수 있어요.</div>' +
      '<div><b>지금 낙폭 / 역대 최대</b>위: 사상 최고 종가 대비 지금. 아래 작은 글씨: 역사상 가장 크게 빠졌던 폭.</div>' +
      '<div><b>200주선 대비</b>주봉 200개(약 4년) 평균 가격 대비 지금. 마이너스면 4년 평균보다 싼 것. <i class="egTg bad">이탈 중</i> = 선 아래로 내려와 아직 못 올라옴 · <i class="egTg warn">복귀 확인 중</i> = 선 위로 올라왔지만 4주 연속은 아직. "기록 부족"은 200주(약 4년) 자료가 없는 종목.</div>' +
      '<div><b>큰 하락 회복</b>고점에서 -20% 넘게 빠진 횟수 중 전고점을 되찾은 횟수. 5/5면 다섯 번 빠져 다섯 번 다 회복, 4/5면 한 번이 지금 진행 중이거나 못 돌아온 것.</div>' +
      '<div><b>기록</b>자료가 있는 기간과 그 기간의 연평균 수익(배당 제외).</div>' +
      '<div><b><i class="egTg">회복력만</i></b>기업 정보 없이 체력을 냈다는 뜻. ETF · 코인은 원래 재무가 없고, 주식은 네이버 호출을 아끼려고 상위 40개만 재무를 받아요. 줄을 눌러 들어가면 재무까지 넣어 다시 계산돼요(점수가 달라질 수 있어요).</div>' +
      '<div><b><i class="egTg warn">검증 주의</i> · <i class="egTg bad">검증 실패</i></b>자료 점검 결과예요. 주의 = 빈 구간 · 급변 같은 의심 항목이 있음. 실패 = 날짜 중복 · 분할 미반영 의심 · 두 자료 불일치처럼 숫자가 틀릴 수 있는 문제. 값은 그대로 보여 드리고, 무엇이 문제인지는 종목의 「검증」 탭에 있어요.</div>' +
      '<div><b><i class="egTg lev">레버리지</i></b>2~3배 · 인버스 상품. 회복력 점수를 60점으로 제한해요.</div></div></details>';
  }
  return h + '</details>';
};
(function () {
  var b0 = egScanBind; egScanBind = function (root) {
    b0.apply(this, arguments); var box = root.querySelector(".egScan"); if (!box) return;
    var redraw = function () { var b = root.querySelector(".egScan"); if (b) { b.outerHTML = egScanHtml(); egScanBind(root); } };
    box.addEventListener("toggle", function () { EGS.open = box.open; });
    Array.prototype.forEach.call(box.querySelectorAll("[data-egc]"), function (el) { el.onchange = function () { var k = el.getAttribute("data-egc"); if (el.type === "checkbox") EGS.cond[k] = el.checked; else { var v = parseFloat(el.value); EGS.cond[k] = isFinite(v) ? v : k === "ma" ? 999 : 0; } try { localStorage.setItem("sm.scan.cond", JSON.stringify(EGS.cond)); } catch (e) {} EGS.open = true; redraw(); }; });
    Array.prototype.forEach.call(box.querySelectorAll("[data-egflt],[data-egmk]"), function (b) { var f = b.onclick; b.onclick = function () { EGS.open = true; if (f) f.apply(this, arguments); }; });
    Array.prototype.forEach.call(box.querySelectorAll("[data-ansym2]"), function (tr) { var f = tr.onclick; tr.onclick = function () { EGS.open = false; if (f) f.apply(this, arguments); }; });
    var go = box.querySelector("[data-egscan]"); if (go) { var g = go.onclick; go.onclick = function () { EGS.open = true; if (g) g.apply(this, arguments); }; }
  };
})();

/* ---------- ③ 분석 화면: 요약 + 탭 ---------- */
function egSumHtml(sym) {
  var S = egScore(sym), V = egVerify(sym), N = egNew(sym), A = egAnalog(sym), M = egMaBreak(sym, "w200"), rows = nbHist[sym]; if (!rows || !rows.length) return "";
  var last = rows[rows.length - 1], px = function (v) { return egPx(sym, v); }, col = function (p) { return p >= 68 ? "#1d7f55" : p >= 55 ? "#3182f6" : p >= 42 ? "#b9600f" : "#c03b3b"; }, K = [], k = function (l, v, s, tone, tab) { K.push('<button class="egK ' + (tone || "") + '" data-egtab="' + tab + '"><small>' + l + '</small><b>' + v + '</b><span>' + (s || "") + '</span></button>'); };
  var h = '<div class="egSum">';
  if (S) {
    var R = S.raw;
    h += '<div class="egSumTop"><div class="egScTot" style="border-color:' + col(S.total) + '"><b style="color:' + col(S.total) + '">' + S.total + '</b><span>종합 · ' + S.grade + '</span></div><div class="egSumRead"><div class="egSumNm">' + egEsc(S.name) + ' <span>' + px(last.c) + ' · ' + (typeof cDate === "function" ? cDate(last.t) : "") + ' 종가</span></div><b>' + egEsc(S.read[0]) + '</b><p>' + egEsc(S.read[1]) + '</p><div class="egSumAx"><span>체력 <b style="color:' + col(S.body) + '">' + S.body + '</b></span><span>싼 정도 <b style="color:' + col(S.cheap) + '">' + S.cheap + '</b></span><span>자리 <b style="color:' + col(S.spot) + '">' + S.spot + '</b></span>' + S.cats.filter(function (c) { return c.id === "tech"; }).map(function (c) { return '<span>흐름 <b style="color:' + col(c.score) + '">' + c.score + '</b> ' + (c.score >= 68 ? "오름" : c.score <= 48 ? "내림" : "횡보") + '</span>'; }).join("") + '</div></div></div>';
    k("지금 고점 대비", S.cur > -0.005 ? "최고가" : egPct(S.cur), "고점 " + px(R.pk) + " · " + egYm(R.pkT), S.cur <= -0.2 ? "dn" : "", "score");
    k("역대 최대 낙폭", egPct(S.worst), px(R.worstPk) + " → " + px(R.worstC) + " · " + egYm(R.worstT), "", "score");
    k("큰 하락 뒤 회복", R.closed + " / " + R.eps + "번", R.recMed != null ? "회복까지 보통 " + (R.recMed < 1 ? Math.round(R.recMed * 12) + "개월" : R.recMed.toFixed(1) + "년") : "-20% 하락 없음", R.eps && R.closed === R.eps ? "ok" : "", "score");
    if (R.wGap != null) k("200주선 대비", egPct(R.wGap), M && M.open ? (M.below ? "이탈 중 · " + M.open.ym + "부터" : "복귀 확인 중") : "과거 이탈 " + R.wN + "번", R.wGap < 0 ? "dn" : "", "hist");
  } else if (N) h += '<div class="egSumTop"><div class="egScTot" style="border-color:#8a93a3"><b style="color:#8a93a3;font-size:22px">신규</b><span>기록 ' + Math.round(N.days / 30.4) + '개월</span></div><div class="egSumRead"><div class="egSumNm">' + egEsc(N.name) + ' <span>' + px(last.c) + '</span></div><b>기록이 짧아 점수 대신 점검표로 봐요</b><p>회복력 · MDD · 200주선 같은 장기 기법을 쓸 수 없어요. 「평가표」 탭의 신규 상장 점검표와 프롬프트의 Claude 조사(공모가 · 락업 · 현금)를 보세요.</p></div></div>';
  if (A && !A.thin) { var h1 = A.h.filter(function (x) { return x.l === "1년"; })[0] || A.h[A.h.length - 1]; k("닮은 과거 " + h1.l + " 뒤", Math.round(h1.win * 100) + "% 플러스", A.n + "번 · 보통 " + egPct(h1.med) + " · 최악 " + egPct(h1.worst), h1.win >= 0.6 ? "ok" : h1.win < 0.45 ? "dn" : "", "hist"); }
  if (V) k("데이터 검증", V.level === "ok" ? "모두 통과" : V.level === "warn" ? "주의 " + V.warn : "실패 " + V.bad, V.level === "ok" ? V.ok + "개 항목" : V.checks.filter(function (c) { return c.lv === (V.level === "bad" ? "bad" : "warn"); }).slice(0, 2).map(function (c) { return egEsc(c.k.replace(/\s*\(.*$/, "")); }).join(" · "), V.level === "ok" ? "ok" : V.level === "bad" ? "bad" : "warn", "vf");
  h += '<div class="egKs">' + K.join("") + '</div>';
  if (S) h += '<div class="egSumLine"><span><i class="g"></i>강한 곳: ' + egEsc(S.strong.join(" · ")) + '</span><span><i class="b"></i>약한 곳: ' + egEsc(S.weak.join(" · ")) + '</span></div>';
  h += '<div class="egSumNext"><b>다음 순서</b> ① 칸을 눌러 근거 확인 → ② 아래 「3 분석 실행」에서 프롬프트 복사(평가표 · 이탈 사례 · 검증에 더해 본질/변수 화면의 자료도 자동으로 들어가요 — 자세히 보려면 <a href="#" onclick="navTo(\'core\');return false">본질 · 변수 화면</a>) → ③ Claude 답 붙여넣기 → ④ 카드</div>';
  return h + '</div>';
}
(function () {
  if (typeof anxSections !== "function") return;
  /* 프롬프트에 본질 · 변수 */
  var b0 = egBlock; egBlock = function (syms, withPort) { var t = b0.apply(this, arguments), L = []; try { if (syms && syms[0] && typeof AN !== "undefined" && currentTab === "analyst") L = egCoreLines(syms[0]); } catch (e) {} if (!L.length) return t; var mark = "\n=== 예측 · 대응 · 방향 (edge)", i = t.indexOf(mark); return i >= 0 ? t.slice(0, i) + "\n" + L.join("\n") + t.slice(i) : t + "\n" + L.join("\n"); };
  var p0 = anxBuildPrompt; anxBuildPrompt = function () { var self = this, a = arguments, sym = typeof AN !== "undefined" ? AN.sym : null; return (sym ? egCoreEnsure(sym) : Promise.resolve()).then(function () { return p0.apply(self, a); }); };
  var n0 = egNorm; egNorm = function (E) { var o = n0.apply(this, arguments), R = E && E.core; if (R && typeof R === "object" && (R.essence || R.stance || (R.vars && R.vars.length))) { o = o || { history: [], policy: [], paths: [], roadmap: null, protect: [], grow: [], mine: "" }; o.core = { essence: R.essence || "", changed: R.changed || "", stance: R.stance || "", vars: Array.isArray(R.vars) ? R.vars.filter(function (v) { return v && v.name; }).slice(0, 4) : [] }; } return o; };
  var x0 = egExtraHtml; egExtraHtml = function (E, opt) {
    var h = x0.apply(this, arguments), N = egNorm(E), R = N && N.core; if (!R) return h;
    var add = '<div class="anxH">본질 · 변수로 본 이 종목</div><div class="egHi">' + (R.essence ? '<div class="coreL"><small>본질</small>' + egEsc(R.essence) + '</div>' : '') + (R.changed ? '<div class="coreL"><small>바뀌었는지 볼 것</small>' + egEsc(R.changed) + '</div>' : '') + (R.stance ? '<div class="coreL act"><small>행동 원칙</small>' + egEsc(R.stance) + '</div>' : '') + '</div>' + (R.vars.length ? '<div class="egHist" style="margin-top:8px">' + R.vars.map(function (v) { return '<div class="egHi"><b>' + egEsc(v.name) + '</b>' + (v.path ? '<div class="egPathLine">' + egEsc(v.path).replace(/\s*(→|->)\s*/g, ' <i>→</i> ') + '</div>' : '') + (v.trigger ? '<div class="coreL"><small>대응 시작</small>' + egEsc(v.trigger) + '</div>' : '') + (v.response ? '<div class="coreL act"><small>그때 할 일</small>' + egEsc(v.response) + '</div>' : '') + '</div>'; }).join("") + '</div>' : '');
    return h ? h.replace('<div class="egX">', '<div class="egX">' + add) : '<div class="egX">' + add + '</div>';
  };
  /* 가장 바깥: ② 칸을 요약 + 탭으로 묶는다 (앞에서 넣은 상자들을 옮기기만 한다) */
  var s0 = anxSections; anxSections = function (root) {
    var r = s0.apply(this, arguments);
    try {
      var sym = AN.sym, secs = root.querySelectorAll(".anSec"), sec = secs[1]; if (!sym || !sec || sec.querySelector(".egTabs")) return r;
      if (!EG["sd:" + sym] || !nbHist[sym] || !nbHist[sym].length) return r;
      var boxes = Array.prototype.slice.call(sec.querySelectorAll(":scope > .egBox")), sc = boxes.filter(function (b) { return b.classList.contains("egSc"); }), vf = boxes.filter(function (b) { return b.classList.contains("egVf"); }), nw = boxes.filter(function (b) { return b.classList.contains("egNewB"); }), hist = boxes.filter(function (b) { return sc.indexOf(b) < 0 && vf.indexOf(b) < 0 && nw.indexOf(b) < 0; });
      if (!boxes.length) return r;
      var rest = Array.prototype.slice.call(sec.children).filter(function (el) { return !el.classList.contains("mkStep") && boxes.indexOf(el) < 0; });
      var V = egVerify(sym), tabs = [["sum", "요약", ""], ["score", "평가표", ""], ["hist", "과거 사례", ""], ["vf", "검증", V && V.level !== "ok" ? '<i class="' + (V.level === "bad" ? "bad" : "warn") + '">' + (V.level === "bad" ? V.bad : V.warn) + '</i>' : '<i class="ok">✓</i>'], ["data", "앱 데이터", ""]];
      var cur = EG.anTab && tabs.some(function (t) { return t[0] === EG.anTab; }) ? EG.anTab : "sum";
      var wrap = document.createElement("div"); wrap.className = "egTabs";
      wrap.innerHTML = '<div class="egTabBar">' + tabs.map(function (t) { return '<button data-egtab="' + t[0] + '" class="' + (t[0] === cur ? "on" : "") + '">' + t[1] + t[2] + '</button>'; }).join("") + '</div>' + tabs.map(function (t) { return '<div class="egPane" data-egpane="' + t[0] + '"' + (t[0] === cur ? "" : " hidden") + '></div>'; }).join("");
      var pane = function (id) { return wrap.querySelector('[data-egpane="' + id + '"]'); };
      pane("sum").innerHTML = egSumHtml(sym);
      nw.concat(sc).forEach(function (b) { pane("score").appendChild(b); }); if (!nw.length && !sc.length) pane("score").innerHTML = '<div class="briefDim">평가표를 만들 만큼 자료가 없어요.</div>';
      hist.forEach(function (b) { pane("hist").appendChild(b); }); if (!hist.length) pane("hist").innerHTML = '<div class="briefDim">과거 사례를 계산할 만큼 긴 자료가 없어요.</div>';
      vf.forEach(function (b) { pane("vf").appendChild(b); });
      rest.forEach(function (el) { pane("data").appendChild(el); }); if (!rest.length) pane("data").innerHTML = '<div class="briefDim">종목을 고르면 6틀 분석용 앱 데이터가 여기 나와요.</div>';
      sec.appendChild(wrap);
      try { var mkS = sec.querySelector(".mkStep"); Array.prototype.forEach.call(mkS.childNodes, function (nd) { if (nd.nodeType === 3 && /앱 데이터/.test(nd.nodeValue)) nd.nodeValue = nd.nodeValue.replace("앱 데이터", "종목 진단"); }); var tg = mkS.querySelector("[data-antg]"); if (tg) tg.style.display = "none"; } catch (e) {}
      var go = function (id) { EG.anTab = id; Array.prototype.forEach.call(wrap.querySelectorAll(".egTabBar button"), function (b) { b.classList.toggle("on", b.getAttribute("data-egtab") === id); }); Array.prototype.forEach.call(wrap.querySelectorAll(".egPane"), function (p) { p.hidden = p.getAttribute("data-egpane") !== id; }); };
      Array.prototype.forEach.call(wrap.querySelectorAll("[data-egtab]"), function (b) { b.onclick = function () { go(b.getAttribute("data-egtab")); if (b.classList.contains("egK")) wrap.scrollIntoView({ block: "start", behavior: "smooth" }); }; });
    } catch (e) { console.warn("eg", e); }
    return r;
  };
  var st = document.createElement("style"); st.textContent = [
    ".egTabBar{display:flex;gap:4px;flex-wrap:wrap;border-bottom:2px solid #e6eaf0;margin:10px 0 12px;position:sticky;top:0;background:var(--admBg,#f4f5f7);z-index:3;padding-top:6px}.egTabBar button{font:inherit;font-size:13.5px;font-weight:700;border:0;background:none;padding:9px 14px;border-radius:10px 10px 0 0;color:#6b7686;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px}.egTabBar button.on{color:#111;border-bottom-color:#3182f6;background:#fff}.egTabBar i{font-style:normal;font-size:11px;font-weight:800;border-radius:999px;padding:1px 6px;margin-left:5px;background:#eef8f2;color:#1d7f55}.egTabBar i.bad{background:#fcefef;color:#c03b3b}.egTabBar i.warn{background:#fff6e8;color:#b9600f}",
    ".egPane>.egBox:first-child{margin-top:0}.egSum{background:#fff;border:1px solid #e3e7ee;border-radius:14px;padding:16px 18px}.egSumTop{display:grid;grid-template-columns:124px 1fr;gap:16px;align-items:center}.egSumNm{font-size:17px;font-weight:900}.egSumNm span{font-size:12.5px;font-weight:500;color:#6b7686;margin-left:6px}.egSumRead>b{display:block;font-size:15px;margin-top:4px;color:#1f3a68}.egSumRead p{margin:4px 0 6px;font-size:13px;line-height:1.55;color:#334}.egSumAx{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#556}.egSumAx b{font-size:15px}",
    ".egKs{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:14px 0 10px}.egK{font:inherit;text-align:left;border:1px solid #e6eaf0;background:#f8f9fb;border-radius:12px;padding:9px 11px;cursor:pointer;border-left:4px solid #b9c2d0}.egK:hover{background:#f0f5ff}.egK small{display:block;font-size:11px;font-weight:700;color:#6b7686}.egK b{display:block;font-size:18px;font-weight:900;line-height:1.25;color:#111}.egK span{display:block;font-size:11.5px;color:#6b7686;line-height:1.35;margin-top:1px}.egK.ok{border-left-color:#1d7f55}.egK.dn{border-left-color:#1f5fbf}.egK.dn b{color:#1f5fbf}.egK.bad{border-left-color:#c03b3b}.egK.bad b{color:#c03b3b}.egK.warn{border-left-color:#b9600f}.egK.warn b{color:#b9600f}",
    ".egSumLine{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:#445}.egSumLine i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:#1d7f55}.egSumLine i.b{background:#c03b3b}.egSumNext{margin-top:10px;font-size:12.5px;line-height:1.5;color:#445;background:#f3f7ff;border-radius:10px;padding:8px 12px}",
    ".egScanS{display:flex;gap:10px;align-items:baseline;cursor:pointer;list-style:none;flex-wrap:wrap}.egScanS::-webkit-details-marker{display:none}.egScanS>b{font-size:14.5px}.egScanS span{font-size:12.5px;color:#556}.egScanS i{font-style:normal;margin-left:auto;font-size:11.5px;color:#3182f6;font-weight:700}.egScan[open] .egScanS{margin-bottom:8px}.egScan .chip b{font-weight:800;opacity:.75;margin-left:2px}",
    ".egFlRow{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:start;margin:8px 0}.egFlL{font-size:12px;font-weight:800;color:#6b7686;padding-top:8px}.egFl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.egFl button{font:inherit;display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;border:1px solid #dfe4ec;background:#fff;border-radius:8px;padding:8px 11px;cursor:pointer;font-size:13px;color:#333;min-width:0}.egFl button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.egFl button b{font-size:12px;font-weight:800;color:#6b7686;background:#eef1f5;border-radius:6px;padding:1px 7px;flex:none}.egFl button:hover{border-color:#3182f6}.egFl button.on{border-color:#3182f6;background:#eaf2ff;color:#1a56c4;font-weight:800}.egFl button.on b{background:#3182f6;color:#fff}",
    ".egSeg{display:inline-flex;border:1px solid #dfe4ec;border-radius:8px;overflow:hidden;background:#fff;width:max-content}.egSeg button{font:inherit;font-size:13px;border:0;border-radius:0;box-shadow:none;background:none;padding:7px 16px;cursor:pointer;color:#445;border-right:1px solid #dfe4ec}.egSeg button:last-child{border-right:0}.egSeg button.on{background:#3182f6;color:#fff;font-weight:800}",
    "@media(max-width:900px){.egFl{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.egFlRow{grid-template-columns:1fr}.egFlL{padding-top:0}}",
    "[data-theme=dark] .egFl button,[data-theme=dark] .egSeg{background:#161b24;border-color:#263041;color:#dde}[data-theme=dark] .egSeg button{color:#ccd;border-color:#263041}[data-theme=dark] .egFl button.on{background:#1c2c4a;color:#9db8ff}[data-theme=dark] .egFl button b{background:#263041;color:#aab}",
    ".egTg{font-style:normal;font-size:10.5px;font-weight:700;border-radius:5px;padding:1px 5px;background:#eef1f5;color:#556;white-space:nowrap;cursor:help}.egTg.bad{background:#fcefef;color:#c03b3b}.egTg.warn{background:#fff6e8;color:#b9600f}.egTg.lev{background:#f1e9fb;color:#6b3fa0}",
    ".egCond{display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#f6f8fb;border-radius:10px;padding:8px 10px;margin:4px 0 6px;font-size:12.5px}.egCond input[type=number]{width:78px;font:inherit;font-size:12.5px;padding:3px 5px;border:1px solid #cfd6e0;border-radius:6px}.egLegend{margin-top:8px;background:#f6f8fb;border-radius:10px;padding:8px 12px}.egLegend summary{cursor:pointer;font-weight:800;font-size:13px}.egLg{display:grid;gap:7px;margin-top:8px;font-size:12.5px;line-height:1.55}.egLg>div{padding-left:124px;text-indent:-124px}.egLg>div>*{text-indent:0}.egLg>div>b:first-child{display:inline-block;width:118px;margin-right:6px}",
    ".egCo .egScT th:nth-child(3){width:66px}.egCo .dhBadge{white-space:nowrap}.egWhy{display:flex;gap:6px;flex-wrap:wrap}.egWhy span{font-size:12px;background:#f1f3f6;border-radius:8px;padding:3px 8px}.egWhy span.g{background:#eef8f2;color:#17603f}.egWhy span.b{background:#fcefef;color:#a02c2c}.egSubH{font-weight:800;font-size:13px;margin:12px 0 6px}.egEvL{display:grid;gap:5px;font-size:12.5px}.egEvL small{display:block;color:#6b7686;font-size:11.5px}",
    "@media(max-width:640px){.egSumTop{grid-template-columns:1fr}.egSumTop .egScTot{margin:0 auto}.egTabBar button{padding:8px 9px;font-size:12.5px}.egKs{grid-template-columns:repeat(2,minmax(0,1fr))}.egK{min-width:0}}",
    "[data-theme=dark] .egSum{background:#161b24;border-color:#263041}[data-theme=dark] .egK{background:#1e2533;border-color:#263041}[data-theme=dark] .egK b,[data-theme=dark] .egSumNm,[data-theme=dark] .egTabBar button.on{color:#eee}[data-theme=dark] .egTabBar{background:#0f131a;border-color:#263041}[data-theme=dark] .egTabBar button.on{background:#161b24}[data-theme=dark] .egSumRead p,[data-theme=dark] .egSumNext,[data-theme=dark] .egCond,[data-theme=dark] .egLegend{color:#ccd;background:#1e2533}[data-theme=dark] .egSumRead>b{color:#9db8ff}"
  ].join(""); document.head.appendChild(st);
})();
