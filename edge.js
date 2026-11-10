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
