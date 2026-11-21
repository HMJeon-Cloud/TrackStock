/* ============================================================
   v15.00 전문가 기법 (edgex.js) — 평가표(egScore)에 '참고' 묶음 두 개를 더한다
   ① 전문가 기법 — 추세 · 상대강도 · 수급      (기관 · 퀀트 · 추세 매매자가 실제로 쓰는 6가지)
        52주 고점 근접도        George & Hwang(2004): 52주 고점에 가까운 종목이 그 뒤에도 더 올랐다
        12-1 모멘텀             Jegadeesh & Titman(1993): 최근 한 달을 뺀 1년 수익 — 퀀트 모멘텀의 표준
        시장 대비 상대강도      IBD 방식: 최근 분기에 두 배 무게를 둔 1년 성과에서 지수 성과를 뺀다
        추세 템플릿(8조건)      Minervini: 50 · 150 · 200일선의 배열과 52주 고저 대비 위치
        상승일 · 하락일 거래량  O'Neil의 매집 · 분산: 오른 날 거래량 합 ÷ 내린 날 거래량 합(50일)
        추세의 매끄러움         Clenow: 90일 로그 가격의 기울기(연율) × 결정계수(R²)
   ② 매크로 심화 — 금리 곡선 · 신용 · 금융여건  (매크로 전문가의 기본 계기판)
        장단기 금리차(10년−3개월) · 신용 스프레드(Baa−10년) · 금융여건(NFCI) · 실질금리(10년 TIPS) · 삼 법칙
   원칙: 검증 전에는 점수에 넣지 않는다. 두 묶음은 axis "ref"라 종합 · 체력 · 자리 점수에 들어가지 않고,
         종목 순위에서도 역할(종목/타이밍)이 없는 '검증 전 · 참고' 항목으로 보인다.
         '점수 검증'(rankbt.js)을 다시 돌리면 과거 13년에서 맞았는지 재고, 맞은 항목만 점수에 넣을 수 있다.
   모든 값은 '그 시점에 알 수 있던 것'만 쓴다(시세의 마지막 날 기준) — 검증에서 미래를 미리 보지 않게.
   ============================================================ */
/* t 이하인 마지막 줄의 위치 (없으면 -1) */
function egxAsOf(R, t) { var lo = 0, hi = R.length - 1, r = -1; while (lo <= hi) { var m = (lo + hi) >> 1; if (R[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
/* i1에서 거꾸로 days일(달력) 동안의 수익 — 그만큼의 기록이 없으면 null */
function egxRet(R, i1, days) { if (i1 < 0) return null; var t = R[i1].t - days * EG_DAY; if (R[0].t > t + 10 * EG_DAY) return null; var j = egxAsOf(R, t); return j >= 0 && R[j].c > 0 ? R[i1].c / R[j].c - 1 : null; }
/* IBD식 가중 성과: 최근 3개월에 두 배 무게 */
function egxWRet(R, i1) { var a = egxRet(R, i1, 91), b = egxRet(R, i1, 182), c = egxRet(R, i1, 273), d = egxRet(R, i1, 365); return a == null || b == null || c == null || d == null ? null : (2 * a + b + c + d) / 5; }
function egxIdxName(idx) { return idx === "^KS11" ? "코스피" : idx === "BTC-USD" ? "비트코인" : "S&P500"; }

/* 종목 하나의 전문가 기법 값 — 화면 · 점수 · 검증이 같이 쓴다 */
function egxCalc(sym, rows) {
  var n = rows.length, last = rows[n - 1], o = { n: n };
  var c = function (i) { return rows[i].c; };
  /* 52주 고 · 저 */
  var i0 = egxAsOf(rows, last.t - 365 * EG_DAY) + 1; if (i0 < 0) i0 = 0;
  if (n - i0 >= 180 && rows[0].t <= last.t - 355 * EG_DAY) { var hi = -Infinity, lo = Infinity; for (var i = i0; i < n; i++) { if (c(i) > hi) hi = c(i); if (c(i) < lo) lo = c(i); } o.hi52 = hi; o.lo52 = lo; o.near = last.c / hi; o.offLow = last.c / lo - 1; }
  /* 12-1 모멘텀 */
  var j1 = egxAsOf(rows, last.t - 30 * EG_DAY), j12 = rows[0].t <= last.t - 355 * EG_DAY ? egxAsOf(rows, last.t - 365 * EG_DAY) : -1;
  if (j1 > 0 && j12 >= 0 && j12 < j1 && c(j12) > 0) { o.mom121 = c(j1) / c(j12) - 1; o.m1 = last.c / c(j1) - 1; }
  /* 시장 대비 상대강도 */
  var idx = typeof egIndexOf === "function" ? egIndexOf(sym) : null, I = idx && idx !== sym && typeof nbHist !== "undefined" ? nbHist[idx] : null;
  o.idx = idx; o.idxSelf = idx === sym;
  if (I && I.length > 260) { var iN = egxAsOf(I, last.t + EG_DAY * 0.25); if (iN >= 0 && last.t - I[iN].t < 7 * EG_DAY) { var ws = egxWRet(rows, n - 1), wi = egxWRet(I, iN); if (ws != null && wi != null) { o.rs = ws - wi; o.rsS = ws; o.rsI = wi; } } }
  /* 추세 템플릿 */
  if (n >= 222) {
    var ma = function (k, end) { var s = 0; for (var q = end - k + 1; q <= end; q++) s += c(q); return s / k; }, e = n - 1;
    var m50 = ma(50, e), m150 = ma(150, e), m200 = ma(200, e), m200p = ma(200, e - 21);
    var T = [["종가 > 150 · 200일선", last.c > m150 && last.c > m200], ["150일선 > 200일선", m150 > m200], ["200일선이 한 달 전보다 높음", m200 > m200p], ["50일선 > 150 · 200일선", m50 > m150 && m50 > m200], ["종가 > 50일선", last.c > m50]];
    if (o.lo52 != null) { T.push(["52주 저점보다 30% 이상 위", last.c >= o.lo52 * 1.3]); T.push(["52주 고점에서 25% 안", last.c >= o.hi52 * 0.75]); }
    if (o.rs != null) T.push(["시장보다 강함(상대강도 +)", o.rs > 0]);
    o.tt = T; o.ttOk = T.filter(function (x) { return x[1]; }).length; o.ttN = T.length; o.m50 = m50; o.m150 = m150; o.m200 = m200;
  }
  /* 상승일 · 하락일 거래량 (50거래일) */
  if (n >= 52) { var up = 0, dn = 0, vd = 0; for (var k = n - 50; k < n; k++) { var v = rows[k].v || 0; if (v > 0) vd++; if (c(k) > c(k - 1)) up += v; else if (c(k) < c(k - 1)) dn += v; } if (vd >= 40 && up > 0 && dn > 0) o.udv = up / dn; }
  /* 추세의 매끄러움 — 90거래일 로그 가격 회귀 */
  if (n >= 90) { var N = 90, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0; for (var x = 0; x < N; x++) { var y = Math.log(c(n - N + x)); sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; }
    var den = N * sxx - sx * sx, b = den ? (N * sxy - sx * sy) / den : 0, vy = N * syy - sy * sy, r2 = den && vy > 0 ? Math.pow(N * sxy - sx * sy, 2) / (den * vy) : 0; o.slope = Math.exp(b * 252) - 1; o.r2 = r2; o.smooth = o.slope * r2; }
  return o;
}
/* 평가표에 묶음을 더한다 — egScore가 부른다. it · cat은 egScore 안의 도우미 */
function egxCats(sym, rows, it, cat) {
  var X = egxCalc(sym, rows), pc = function (v, d) { return egPct(v, d == null ? 0 : d); }, px = function (v) { return typeof egPx === "function" ? egPx(sym, v) : String(v); }, items = [];
  if (X.near != null) items.push(it("52주 고점 근접도", Math.round(X.near * 100) + "% (52주 고점 " + px(X.hi52) + " · 저점 대비 " + pc(X.offLow) + ")", egStep(X.near, [[0.95, 82], [0.85, 70], [0.7, 55], [0.5, 42], [0, 30]]),
    X.near >= 0.95 ? "52주 고점 바로 아래예요 — 연구에서는 고점에 가까운 종목이 그 뒤에도 더 올랐어요(싸 보이지 않아 덜 사는 심리 때문)" : X.near >= 0.85 ? "52주 고점에서 15% 안이에요 — 오르는 흐름 안에 있어요" : X.near >= 0.7 ? "52주 고점에서 꽤 내려왔어요" : "52주 고점에서 멀어요 — '낙폭' 항목은 이것을 싸다고 보지만, 이 기법은 약한 종목으로 봐요"));
  if (X.mom121 != null) items.push(it("12-1 모멘텀 (최근 한 달 뺀 1년)", pc(X.mom121) + " · 최근 한 달 " + pc(X.m1), egStep(X.mom121, [[0.4, 85], [0.2, 75], [0.05, 62], [-0.1, 48], [-9, 32]]),
    X.mom121 >= 0.2 ? "1년 흐름이 강해요 — 최근 한 달은 되돌림이 잦아 빼고 보는 것이 퀀트 모멘텀의 표준이에요" : X.mom121 >= -0.1 ? "1년 흐름이 밋밋해요" : "1년 흐름이 약해요 — 모멘텀 전략은 이런 종목을 피해요"));
  if (X.rs != null) items.push(it("시장 대비 상대강도 (" + egxIdxName(X.idx) + ")", pc(X.rs) + "p (종목 " + pc(X.rsS) + " · 지수 " + pc(X.rsI) + ")", egStep(X.rs, [[0.2, 85], [0.08, 72], [-0.05, 55], [-0.15, 42], [-9, 30]]),
    X.rs >= 0.08 ? "지수보다 뚜렷이 강해요 — 기관이 주도주를 고를 때 가장 먼저 보는 숫자예요" : X.rs >= -0.05 ? "지수와 비슷하게 움직였어요" : "지수보다 약해요 — 시장이 오를 때 못 따라간 종목이에요"));
  else if (X.idxSelf) items.push(it("시장 대비 상대강도", "지수 자신", "info", "지수 자신이라 견줄 대상이 없어요"));
  if (X.tt) items.push(it("추세 템플릿 (" + X.ttN + "조건)", X.ttOk + " / " + X.ttN + " 충족" + (X.ttOk < X.ttN ? " · 미충족: " + X.tt.filter(function (x) { return !x[1]; }).slice(0, 3).map(function (x) { return x[0]; }).join(", ") : ""), 30 + 60 * X.ttOk / X.ttN,
    X.ttOk === X.ttN ? "모든 조건을 채웠어요 — 추세 매매자가 '2단계 상승'이라 부르는 모습이에요" : X.ttOk >= X.ttN - 2 ? "조건 대부분을 채웠어요 — 상승 추세에 가까워요" : X.ttOk <= 2 ? "조건을 거의 못 채웠어요 — 추세 매매자는 손대지 않는 구간이에요(싸다는 것과는 다른 이야기)" : "추세가 섞여 있어요"));
  if (X.udv != null) items.push(it("상승일 · 하락일 거래량 비 (50일)", X.udv.toFixed(2) + "배", egStep(X.udv, [[1.5, 80], [1.2, 70], [0.9, 55], [0.7, 42], [0, 30]]),
    X.udv >= 1.2 ? "오른 날에 거래가 더 실렸어요 — 큰손이 사 모으는(매집) 모습으로 읽어요" : X.udv >= 0.9 ? "오른 날과 내린 날의 거래가 비슷해요" : "내린 날에 거래가 더 실렸어요 — 큰손이 파는(분산) 모습으로 읽어요"));
  if (X.smooth != null) items.push(it("추세의 매끄러움 (90일 기울기 × R²)", (X.smooth >= 0 ? "+" : "") + X.smooth.toFixed(2) + " (연율 " + pc(X.slope) + " · R² " + X.r2.toFixed(2) + ")", egStep(X.smooth, [[0.6, 85], [0.3, 75], [0.1, 62], [0, 52], [-0.15, 42], [-9, 30]]),
    X.smooth >= 0.3 ? "고르게 오르는 추세예요 — 급등 한 번으로 만든 수익률과 구별하려고 R²(직선에 가까운 정도)를 곱해요" : X.smooth >= 0 ? "오르고는 있지만 들쭉날쭉해요" : "내리는 추세예요"));
  cat("pro", "전문가 기법 — 추세 · 상대강도 · 수급", "ref", 0, items, "기관 · 퀀트 · 추세 매매자가 쓰는 기법이에요. 아직 우리 종목들로 검증하지 않아 종합 점수에는 넣지 않았어요 — 종목 순위의 '점수 검증'을 다시 돌리면 과거 13년에 맞았는지 나와요. '낙폭이 깊을수록 높은 점수'인 자리 항목과 방향이 반대인 것이 많아요: 낙폭 항목은 '언제', 이 항목들은 '무엇을'에 가까워요.");
  /* 매크로 심화 */
  var mi = egxMacro(sym, rows[rows.length - 1], it);
  if (mi.length) cat("mac2", "매크로 심화 — 금리 곡선 · 신용 · 금융여건", "ref", 0, mi, "매크로 전문가의 기본 계기판이에요. 모든 종목에 같은 값이라 '무엇을'이 아니라 '언제'를 가늠하는 용도이고, 검증 전이라 종합 점수에는 넣지 않았어요. 출처: 미국 FRED.");
}
/* 매크로 심화 항목 — 그 시점에 알려진 값으로 */
function egxMacro(sym, last, it) {
  var out = []; if (typeof macSer !== "function" || typeof macAt !== "function") return out;
  var kr = /\.K[SQ]$|^\^K/.test(sym || ""), T0 = last.t + (kr ? -0.5 : 0.35) * EG_DAY, sgn = function (v, d) { return (v >= 0 ? "+" : "") + v.toFixed(d == null ? 2 : d); };
  try {
    var cv = macSer("t10y3m"); if (cv && cv.v.length > 50) { var c0 = macAt(cv, T0), c6 = macAt(cv, T0 - 182 * EG_DAY); if (c0 != null) { var wasInv = false, i1 = macIdx(cv.t, T0 + 1) - 1; for (var i = i1; i >= 0 && cv.t[i] >= T0 - 548 * EG_DAY; i--) if (cv.v[i] < 0) { wasInv = true; break; }
      out.push(it("장단기 금리차 (10년 − 3개월)", sgn(c0) + "%p" + (c6 != null ? " (6개월 전 " + sgn(c6) + ")" : ""), c0 < 0 ? 40 : wasInv ? 45 : c0 >= 1 ? 65 : 55,
        c0 < 0 ? "역전 상태예요 — 1955년 이후 미국의 모든 침체 앞에 역전이 있었어요(보통 1~2년 앞). 다만 역전된 동안 주가는 오르는 경우도 많았어요" : wasInv ? "최근 1년 반 안에 역전이 있었고 지금은 풀렸어요 — 과거 침체는 역전이 '풀리는' 무렵에 시작된 적이 많아 가장 조심하는 구간이에요" : c0 >= 1 ? "곡선이 가팔라요 — 경기 확장 초 · 중반의 모습이에요" : "평평한 편이에요 — 뚜렷한 신호는 아니에요")); } }
    var cr = macSer("baa10y"); if (cr && cr.v.length > 60) { var s0 = macAt(cr, T0); if (s0 != null) { var sm = 0, sn = 0, j1 = macIdx(cr.t, T0 + 1) - 1; for (var j = j1; j >= 0 && cr.t[j] >= T0 - 365 * EG_DAY; j--) { sm += cr.v[j]; sn++; } var avg = sn ? sm / sn : null, d = avg != null ? s0 - avg : null;
      if (d != null) out.push(it("신용 스프레드 (Baa − 10년)", s0.toFixed(2) + "%p (1년 평균 대비 " + sgn(d) + ")", d >= 1 ? 62 : d >= 0.3 ? 45 : d <= -0.3 ? 60 : 55,
        d >= 1 ? "크게 벌어졌어요 — 신용 공포 구간. 과거엔 나눠 사기 시작한 쪽이 유리했지만 더 벌어질 수 있어요" : d >= 0.3 ? "벌어지는 중이에요 — 회사채 시장이 위험을 다시 매기고 있어요. 주식보다 먼저 움직이는 경우가 많아요" : d <= -0.3 ? "좁혀졌어요 — 돈 빌리기 쉬운 환경이에요" : "1년 평균 근처예요")); } }
    var nf = macSer("nfci"); if (nf && nf.v.length > 30) { var f0 = macAt(nf, T0 - 5 * EG_DAY); if (f0 != null) out.push(it("금융여건 (시카고 연준 NFCI)", sgn(f0), f0 > 0.5 ? 55 : f0 > 0 ? 42 : f0 <= -0.3 ? 62 : 55,
      f0 > 0.5 ? "위기 수준으로 조여 있어요 — 공포 구간" : f0 > 0 ? "평균보다 조여 있어요(0 위) — 돈이 빡빡해지는 중이에요" : f0 <= -0.3 ? "평균보다 느슨해요 — 위험자산에 우호적인 환경이에요" : "평균 근처예요")); }
    var rr = macSer("real10"); if (rr && rr.v.length > 60) { var r0 = macAt(rr, T0), r1 = macAt(rr, T0 - 365 * EG_DAY); if (r0 != null && r1 != null) out.push(it("미 실질금리 (10년 물가연동)", r0.toFixed(2) + "% (1년 변화 " + sgn(r0 - r1) + "%p)", r0 - r1 <= -0.3 ? 68 : r0 - r1 >= 0.5 ? 40 : 55,
      (r0 - r1 <= -0.3 ? "실질금리가 내려왔어요 — 성장주 · 금에 우호적" : r0 - r1 >= 0.5 ? "실질금리가 올랐어요 — 먼 미래 이익에 기대는 주식에 부담" : "1년 전과 비슷해요") + (r0 >= 2 ? " · 2% 위는 2008년 이전 수준이라 높은 편이에요" : ""))); }
    var sh = macSer("sahm"); if (sh && sh.v.length > 12) { var h0 = macAt(sh, T0 - 35 * EG_DAY); if (h0 != null) out.push(it("삼 법칙 (실업률 상승 폭)", h0.toFixed(2) + "%p", h0 >= 0.5 ? 40 : h0 >= 0.3 ? 48 : 58,
      h0 >= 0.5 ? "0.5를 넘었어요 — 과거 침체가 시작될 때 나오던 신호예요" : h0 >= 0.3 ? "오르는 중이에요 — 0.5가 기준선" : "고용은 안정적이에요")); }
  } catch (e) { if (typeof console !== "undefined") console.warn("egxMacro", e); }
  return out;
}
/* ---------- 전문가 방법 점검표 — 우리 점수에 무엇이 있고 무엇이 없나 (종목 순위 화면 아래) ---------- */
var EGX_AUDIT = [
  ["추세 · 모멘텀", "퀀트 · 추세 매매자", "① 이동평균 배열 · 1년 수익 / 새로: 12-1 모멘텀 · 52주 고점 근접도 · 추세 템플릿 · 추세의 매끄러움", "new", "있음 · 새 항목은 검증 전"],
  ["상대강도(시장 대비)", "기관의 주도주 고르기", "새로: 시장 대비 상대강도(국내 코스피 · 미국 S&P500 · 코인 비트코인)", "new", "검증 전"],
  ["수급(거래량)", "추세 매매자", "새로: 상승일 · 하락일 거래량 비 / 국내 종목의 외국인 · 기관 매매는 종목 발굴 화면에만 있음", "new", "검증 전"],
  ["평균 회귀 · 낙폭", "가치 · 역발상 투자자", "③ 낙폭 단계 · 기회 구간, ② 200주선 · 닮은 과거", "ok", "있음 · 검증됨(타이밍)"],
  ["기업의 질 · 성장 · 가격", "가치 · 퀄리티 투자자", "④ ROE · 영업이익률 · 매출/이익 성장 · PER", "part", "있음 · 과거 값이 없어 검증 못 함 → 실전 기록으로 확인"],
  ["이익 추정치 변화 · 실적 발표 뒤 흐름", "퀀트 · 애널리스트", "새로: 목표가 · 다음 연도 이익 추정을 주마다 기록해 '오른 종목 · 내린 종목'을 보여 줌(실전 기록 칸) / 점수 항목과 실적 발표 뒤 흐름은 아직 없음", "part", "쌓는 중 · 점수는 다음 후보"],
  ["이익의 질(현금흐름 대비 이익)", "회계 분석 · 퀀트", "실적 팔로업의 AI 분석에 일부(현금흐름 · 일회성) — 점수 항목은 없음", "part", "부분"],
  ["가격에 든 기대(역산 DCF)", "펀더멘털 분석가", "PER · 밸류에이션 밴드까지 — '지금 가격이 몇 % 성장을 전제하나'는 없음", "part", "부분 · 다음 후보"],
  ["매크로 계기판", "매크로 전략가", "⑤ VIX · 기준금리 · 10년 금리 · 환율 / 새로: 금리 곡선 · 신용 스프레드 · 금융여건 · 실질금리 · 삼 법칙", "new", "있음 · 새 항목은 검증 전"],
  ["포지셔닝 · 쏠림", "헤지펀드 · 프라임브로커", "새로: 구루의 합의 종목 · 쏠림 표시 / 공매도 잔고 · 옵션 수급은 없음", "part", "부분"],
  ["큰손의 움직임(13F · 13D)", "복제 전략 · 이벤트 투자", "구루: 유형별 읽기 · AI 해석 / 새로: 전문가 활용 지도 · 복제 적합도 · 산 구간과 지금 / 13D 공시 수집은 없음", "part", "부분"],
  ["보지 않은 기간에서의 확인", "모든 퀀트", "점수 검증(앞 절반으로 정하고 뒤 절반으로 확인) / 새로: 실전 기록(주마다 점수를 남겨 뒤에 맞춰 봄)", "new", "있음 · 쌓는 중"],
  ["비중 · 손실 한도", "모든 운용역", "낙폭 단계별 분할 · 변동성 항목 — 변동성에 맞춘 비중 계산, 손실 한도 규칙은 없음", "part", "부분 · 다음 후보"]
];
function egxAuditHtml() {
  var e = typeof rkEsc === "function" ? rkEsc : function (x) { return String(x); }, C = { ok: ["있음", "#157347", "#e2f4ea"], "new": ["v15 추가", "#8a6414", "#fbf1d9"], part: ["부분", "#2459c4", "#e8f0ff"], no: ["없음", "#c03b3b", "#fde8ea"] };
  return '<details class="egBox rkHow egxAud"' + (typeof EG !== "undefined" && EG.audOpen ? " open" : "") + '><summary>전문가 방법 점검표 — 우리 점수에 무엇이 있고 무엇이 없나 <em>' + EGX_AUDIT.filter(function (r) { return r[3] === "no" || r[3] === "part"; }).length + '가지가 없거나 부분</em></summary><div class="briefDim" style="margin:10px 0">펀드매니저 · 퀀트 · 매크로 전략가가 실제로 쓰는 방법을 나란히 놓고 우리 앱에 있는지 본 표예요. \'검증 전\' 항목은 값만 보여 주고 점수에는 넣지 않았어요 — 위 \'점수 검증\'을 다시 돌리면 우리 종목에서 맞았는지 나와요. 연구에서 맞았던 방법도 발표 뒤에는 힘이 크게 줄었다는 것이 알려져 있어서(표본 밖 26% · 발표 뒤 58% 감소), 넣기 전에 우리 자료로 확인하는 순서를 지켜요.</div><div class="dxWrap"><table class="dgT egxAudT"><thead><tr><th>전문가의 방법</th><th>누가 쓰나</th><th>우리 앱</th><th>상태</th></tr></thead><tbody>' +
    EGX_AUDIT.map(function (r) { var c = C[r[3]]; return '<tr><td><b>' + e(r[0]) + '</b></td><td>' + e(r[1]) + '</td><td>' + e(r[2]) + '</td><td><span style="display:inline-block;font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 8px;white-space:nowrap;color:' + c[1] + ';background:' + c[2] + '">' + c[0] + '</span><small style="display:block;color:#8a92a3;margin-top:3px">' + e(r[4]) + '</small></td></tr>'; }).join("") + '</tbody></table></div></details>';
}
if (typeof module !== "undefined") module.exports = { egxAsOf: egxAsOf, egxRet: egxRet, egxCalc: egxCalc };
