"use strict";
/* ============================================================
   StockMind — 전문가 지표 모듈
   가격 데이터만으로 계산 가능한 기술적/리스크 지표.
   재무 데이터(PER/PBR)는 인증이 필요한 별도 API라 다루지 않는다.
   ============================================================ */

/* ================= 순수 계산 함수 ================= */

/* 단순이동평균. 앞쪽 n-1개는 null (차트에서 빈 구간으로 처리) */
function smaSeries(vals, n) {
  var out = [], sum = 0;
  for (var i = 0; i < vals.length; i++) {
    sum += vals[i];
    if (i >= n) sum -= vals[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

/* RSI (Wilder 방식). 마지막 시점의 값 하나를 반환 */
function rsiWilder(vals, n) {
  if (vals.length < n + 1) return null;
  var avgGain = 0, avgLoss = 0;
  for (var i = 1; i <= n; i++) {
    var ch = vals[i] - vals[i - 1];
    if (ch > 0) avgGain += ch; else avgLoss -= ch;
  }
  avgGain /= n; avgLoss /= n;
  for (var j = n + 1; j < vals.length; j++) {
    var c2 = vals[j] - vals[j - 1];
    avgGain = (avgGain * (n - 1) + (c2 > 0 ? c2 : 0)) / n;
    avgLoss = (avgLoss * (n - 1) + (c2 < 0 ? -c2 : 0)) / n;
  }
  if (avgLoss === 0) return 100;
  var rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/* 일간 수익률 배열 */
function dailyReturns(vals) {
  var out = [];
  for (var i = 1; i < vals.length; i++) out.push(vals[i] / vals[i - 1] - 1);
  return out;
}

/* 연환산 평균수익률과 변동성 (산술 방식, 샤프 계산용 표준 관행) */
function annualizedStats(vals) {
  var r = dailyReturns(vals);
  if (r.length < 30) return null;
  var mean = 0;
  for (var i = 0; i < r.length; i++) mean += r[i];
  mean /= r.length;
  var sq = 0;
  for (var j = 0; j < r.length; j++) sq += (r[j] - mean) * (r[j] - mean);
  var sd = Math.sqrt(sq / (r.length - 1));
  return { annReturn: mean * 252, annVol: sd * Math.sqrt(252), rets: r };
}

/* 샤프 비율: (연수익률 - 무위험수익률) / 연변동성 */
function sharpeRatio(vals, rf) {
  var s = annualizedStats(vals);
  if (!s || s.annVol === 0) return null;
  return (s.annReturn - rf) / s.annVol;
}

/* 소르티노 비율: 분모를 하락 변동성(음의 수익률의 표준편차)만으로 계산 */
function sortinoRatio(vals, rf) {
  var s = annualizedStats(vals);
  if (!s) return null;
  var rfDaily = rf / 252;
  var sq = 0, n = 0;
  for (var i = 0; i < s.rets.length; i++) {
    var d = s.rets[i] - rfDaily;
    if (d < 0) { sq += d * d; }
    n++;
  }
  if (n < 30) return null;
  var dd = Math.sqrt(sq / n) * Math.sqrt(252);
  if (dd === 0) return null;
  return (s.annReturn - rf) / dd;
}

/* 52주(최근 252거래일) 고가/저가와 현재 위치 */
function week52Stats(rows) {
  var start = Math.max(0, rows.length - 252);
  var hi = -Infinity, lo = Infinity, hiT = 0, loT = 0;
  for (var i = start; i < rows.length; i++) {
    if (rows[i].h > hi) { hi = rows[i].h; hiT = rows[i].t; }
    if (rows[i].l < lo) { lo = rows[i].l; loT = rows[i].t; }
  }
  var cur = rows[rows.length - 1].c;
  return {
    high: hi, highT: hiT, low: lo, lowT: loT,
    vsHigh: cur / hi - 1, vsLow: cur / lo - 1,
    days: rows.length - start
  };
}

/* 이동평균 대비 이격도 */
function maGap(vals, n) {
  if (vals.length < n) return null;
  var sum = 0;
  for (var i = vals.length - n; i < vals.length; i++) sum += vals[i];
  return vals[vals.length - 1] / (sum / n) - 1;
}

/* ================= 렌더링 ================= */

function renderMetrics() {
  if (!state.rows || state.rows.length < 60) {
    $("metricsCard").classList.add("hidden");
    return;
  }
  $("metricsCard").classList.remove("hidden");

  var rows = state.rows;
  var closes = rows.map(function (r) { return r.c; });
  var rf = parseFloat($("rfRate").value);
  if (!isFinite(rf)) rf = 3.0;
  rf = rf / 100;

  var rsi = rsiWilder(closes, 14);
  var gap240 = maGap(closes, Math.min(240, closes.length - 1));
  var w52 = week52Stats(rows);
  var sharpe = sharpeRatio(closes, rf);
  var sortino = sortinoRatio(closes, rf);
  var ann = annualizedStats(closes);
  var eps = state.eps || drawdownEpisodes(rows, 0.10);
  var worstDd = 0;
  for (var i = 0; i < eps.length; i++) if (eps[i].dd < worstDd) worstDd = eps[i].dd;

  function rsiLabel(v) {
    if (v == null) return ["-", "var(--sub)"];
    if (v >= 70) return ["과열권", "var(--up)"];
    if (v <= 30) return ["침체권", "var(--down)"];
    return ["중립", "var(--sub)"];
  }
  var rl = rsiLabel(rsi);

  function ratioLabel(v) {
    if (v == null) return ["-", "var(--sub)"];
    if (v >= 1) return ["우수", "var(--good)"];
    if (v >= 0.5) return ["양호", "var(--txt)"];
    if (v >= 0) return ["보통", "var(--sub)"];
    return ["나쁨", "var(--down)"];
  }
  var shl = ratioLabel(sharpe), sol = ratioLabel(sortino);

  $("metricsBadges").innerHTML =
    '<span class="badge" title="최근 14거래일 상승폭과 하락폭의 비율. 70 이상 과열, 30 이하 침체로 봅니다">RSI(14)<b>' +
      (rsi == null ? "-" : rsi.toFixed(1)) +
      ' <small style="color:' + rl[1] + '">' + rl[0] + "</small></b></span>" +
    '<span class="badge" title="최근 종가가 240일(약 1년) 평균가에서 얼마나 떨어져 있는지">240일선 이격<b class="' +
      pctCls(gap240 || 0) + '">' + (gap240 == null ? "-" : fmtPct(gap240)) + "</b></span>" +
    '<span class="badge" title="최근 52주 최고가 대비 현재 위치">52주 최고 대비<b class="' + pctCls(w52.vsHigh) + '">' +
      fmtPct(w52.vsHigh) + "</b></span>" +
    '<span class="badge" title="최근 52주 최저가 대비 현재 위치">52주 최저 대비<b class="' + pctCls(w52.vsLow) + '">' +
      fmtPct(w52.vsLow) + "</b></span>" +
    '<span class="badge" title="위험(변동성) 1단위당 초과수익. 무위험수익률 대비">샤프 비율<b>' +
      (sharpe == null ? "-" : sharpe.toFixed(2)) +
      ' <small style="color:' + shl[1] + '">' + shl[0] + "</small></b></span>" +
    '<span class="badge" title="샤프와 같지만 하락 변동성만 위험으로 계산">소르티노<b>' +
      (sortino == null ? "-" : sortino.toFixed(2)) +
      ' <small style="color:' + sol[1] + '">' + sol[0] + "</small></b></span>" +
    '<span class="badge" title="조회 기간 연환산 변동성">연변동성<b>' +
      (ann ? (ann.annVol * 100).toFixed(1) + "%" : "-") + "</b></span>" +
    '<span class="badge" title="조회 기간 중 최대 낙폭">MDD<b class="neg">' + fmtPct(worstDd) + "</b></span>";

  $("metricsNote").innerHTML =
    "무위험수익률 " + (rf * 100).toFixed(1) + "% 가정 · 조회 기간(" +
    fmtDate(rows[0].t) + "~" + fmtDate(rows[rows.length - 1].t) + ") 기준 계산 · " +
    "52주 고저는 최근 " + w52.days + "거래일의 장중 고가/저가 기준";
}
