"use strict";
/* ============================================================
   StockMind — 기술적 분석 모듈
   지지/저항선 자동 탐지, 캔들차트, 기간 수익률.
   가격 데이터(state.rows: t, o, h, l, c, v)만 사용한다.
   ============================================================ */

/* ================= 순수 계산 함수 ================= */

/* 스윙 고점/저점: 좌우 w봉 안에서 가장 높은(낮은) 봉 */
function swingPoints(rows, w) {
  var highs = [], lows = [];
  for (var i = w; i < rows.length - w; i++) {
    var isHigh = true, isLow = true;
    for (var k = i - w; k <= i + w; k++) {
      if (k === i) continue;
      if (rows[k].h >= rows[i].h) isHigh = false;
      if (rows[k].l <= rows[i].l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push({ i: i, p: rows[i].h, t: rows[i].t });
    if (isLow) lows.push({ i: i, p: rows[i].l, t: rows[i].t });
  }
  return { highs: highs, lows: lows };
}

/* 가까운 가격대끼리 묶어 하나의 '레벨'로 만든다 (tol: 상대 오차, 예 0.015 = 1.5%) */
function clusterLevels(points, tol) {
  var sorted = points.slice().sort(function (a, b) { return a.p - b.p; });
  var clusters = [];
  for (var i = 0; i < sorted.length; i++) {
    var last = clusters[clusters.length - 1];
    if (last && Math.abs(sorted[i].p - last.mean) / last.mean <= tol) {
      last.pts.push(sorted[i]);
      var s = 0;
      for (var k = 0; k < last.pts.length; k++) s += last.pts[k].p;
      last.mean = s / last.pts.length;
      if (sorted[i].t > last.lastT) last.lastT = sorted[i].t;
    } else {
      clusters.push({ mean: sorted[i].p, pts: [sorted[i]], lastT: sorted[i].t });
    }
  }
  return clusters.map(function (c) {
    return { price: c.mean, touches: c.pts.length, lastT: c.lastT };
  });
}

/* 지지선/저항선 탐지
   lookback: 최근 몇 봉을 볼지, w: 스윙 판정 폭, tol: 묶음 허용 오차, maxEach: 위아래 각각 최대 개수 */
function supportResistance(rows, opts) {
  opts = opts || {};
  var lookback = opts.lookback || 250, w = opts.w || 6, tol = opts.tol || 0.015, maxEach = opts.maxEach || 3;
  var seg = rows.slice(Math.max(0, rows.length - lookback));
  if (seg.length < w * 4) return { support: [], resistance: [], cur: rows[rows.length - 1].c };

  var sp = swingPoints(seg, w);
  var cur = rows[rows.length - 1].c;
  var levels = clusterLevels(sp.highs.concat(sp.lows), tol);

  var res = [], sup = [];
  levels.forEach(function (lv) {
    lv.pct = lv.price / cur - 1;
    if (lv.price > cur * 1.003) res.push(lv);
    else if (lv.price < cur * 0.997) sup.push(lv);
  });
  // 터치 횟수 많은 순 → 같으면 현재가에 가까운 순
  function rank(a, b) { return b.touches - a.touches || Math.abs(a.pct) - Math.abs(b.pct); }
  res.sort(rank); sup.sort(rank);
  res = res.slice(0, maxEach).sort(function (a, b) { return a.price - b.price; });
  sup = sup.slice(0, maxEach).sort(function (a, b) { return b.price - a.price; });
  return { support: sup, resistance: res, cur: cur, lookback: seg.length };
}

/* 기간 수익률: 마지막 날 기준 N일 전(달력일) 대비 */
function returnOverDays(rows, days) {
  var last = rows[rows.length - 1];
  var target = last.t - days * 86400000;
  var idx = -1;
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].t <= target) { idx = i; break; }
  }
  if (idx < 0) return null;
  return { ret: last.c / rows[idx].c - 1, fromT: rows[idx].t, fromC: rows[idx].c };
}

function returnYTD(rows) {
  var last = rows[rows.length - 1];
  var y = new Date(last.t).getFullYear();
  var idx = -1;
  for (var i = 0; i < rows.length; i++) {
    if (new Date(rows[i].t).getFullYear() === y) { idx = i; break; }
  }
  if (idx <= 0) return null;
  var base = rows[idx - 1]; // 전년도 마지막 거래일 종가 기준
  return { ret: last.c / base.c - 1, fromT: base.t, fromC: base.c };
}

/* 캔들 하나의 성격 판정 (학습용) */
function candleShape(r) {
  var body = Math.abs(r.c - r.o), range = r.h - r.l;
  if (range <= 0) return "보합";
  var upper = r.h - Math.max(r.o, r.c), lower = Math.min(r.o, r.c) - r.l;
  var bodyR = body / range;
  var up = r.c >= r.o;
  // 꼬리가 몸통보다 압도적으로 길면 꼬리 패턴이 우선 (도지보다 먼저 판정)
  if (lower >= range * 0.6 && upper <= range * 0.15) return up ? "망치형 (긴 아래꼬리, 매수세 유입)" : "교수형 (긴 아래꼬리, 주의)";
  if (upper >= range * 0.6 && lower <= range * 0.15) return up ? "역망치형 (긴 윗꼬리)" : "유성형 (긴 윗꼬리, 매도압력)";
  if (bodyR < 0.1) return "도지 (망설임)";
  if (bodyR > 0.7) return up ? "장대양봉 (강한 매수)" : "장대음봉 (강한 매도)";
  return up ? "양봉" : "음봉";
}

/* ================= 렌더링 ================= */
var techState = { levels: null, candleChart: null };

/* 지지/저항선 오버레이 플러그인 (메인 차트) */
var levelsPlugin = {
  id: "srLevels",
  afterDatasetsDraw: function (chart) {
    if (!$("showLevels").checked || !techState.levels) return;
    var L = techState.levels, ys = chart.scales.y, ctx = chart.ctx, area = chart.chartArea;
    ctx.save();
    ctx.font = "bold 10px sans-serif";
    ctx.textBaseline = "middle";
    ctx.setLineDash([6, 4]);
    function draw(list, color, label) {
      for (var i = 0; i < list.length; i++) {
        var y = ys.getPixelForValue(list[i].price);
        if (y < area.top || y > area.bottom) continue;
        ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(area.left, y); ctx.lineTo(area.right, y); ctx.stroke();
        ctx.globalAlpha = 1;
        var txt = label + " " + fmtPrice(list[i].price) + " (" + list[i].touches + "회)";
        var tw = ctx.measureText(txt).width + 8;
        ctx.fillStyle = "#0f1420";
        ctx.fillRect(area.right - tw - 2, y - 8, tw, 16);
        ctx.fillStyle = color;
        ctx.fillText(txt, area.right - tw + 2, y);
      }
    }
    draw(L.resistance, "#ff5b5b", "저항");
    draw(L.support, "#3ddc97", "지지");
    ctx.restore();
  }
};

function computeLevels() {
  if (!state.rows || state.rows.length < 60) { techState.levels = null; return; }
  techState.levels = supportResistance(state.rows, { lookback: 250, w: 6, tol: 0.015, maxEach: 3 });
}

function renderLevelsTable() {
  var L = techState.levels;
  var box = $("levelsTable");
  if (!L || (!L.support.length && !L.resistance.length)) {
    box.innerHTML = "<tbody><tr><td style='color:var(--sub)'>최근 구간에서 뚜렷한 지지/저항 레벨이 없습니다.</td></tr></tbody>";
    return;
  }
  var unit = state.displayCur === "KRW" ? "원" : " " + state.displayCur;
  var html = "<thead><tr><th>구분</th><th>가격대</th><th>현재가 대비</th><th>터치 횟수</th><th>마지막 터치</th></tr></thead><tbody>";
  L.resistance.slice().reverse().forEach(function (lv) {
    html += "<tr><td><b style='color:var(--up)'>저항</b></td><td>" + fmtPrice(lv.price) + unit + "</td>" +
      '<td class="pos">+' + (lv.pct * 100).toFixed(1) + "%</td><td>" + lv.touches + "회</td><td>" + fmtDate(lv.lastT) + "</td></tr>";
  });
  html += "<tr style='background:#202a40'><td><b>현재가</b></td><td><b>" + fmtPrice(L.cur) + unit + "</b></td><td>-</td><td>-</td><td>-</td></tr>";
  L.support.forEach(function (lv) {
    html += "<tr><td><b style='color:var(--good)'>지지</b></td><td>" + fmtPrice(lv.price) + unit + "</td>" +
      '<td class="neg">' + (lv.pct * 100).toFixed(1) + "%</td><td>" + lv.touches + "회</td><td>" + fmtDate(lv.lastT) + "</td></tr>";
  });
  box.innerHTML = html + "</tbody>";
  $("levelsNote").textContent = "최근 " + L.lookback + "거래일의 스윙 고점·저점(좌우 6봉 기준)을 1.5% 오차로 묶어 터치 횟수 순으로 위아래 최대 3개씩 표시합니다.";
}

/* 캔들차트 (최근 N일) */
function renderCandles() {
  var n = parseInt($("candleDays").value, 10) || 120;
  var rows = state.rows.slice(Math.max(0, state.rows.length - n));
  if (rows.length < 5 || rows[0].o == null) {
    $("candleCard").classList.add("hidden");
    return;
  }
  $("candleCard").classList.remove("hidden");

  var UP = "#ff5b5b", DOWN = "#4d8dff";
  var colors = rows.map(function (r) { return r.c >= r.o ? UP : DOWN; });
  var closes = rows.map(function (r) { return r.c; });
  var maxVol = 0;
  rows.forEach(function (r) { if (r.v > maxVol) maxVol = r.v; });

  var datasets = [
    { // 꼬리 (저가~고가)
      label: "꼬리", type: "bar",
      data: rows.map(function (r) { return [r.l, r.h]; }),
      backgroundColor: colors, barPercentage: 0.18, categoryPercentage: 1, grouped: false, order: 2
    },
    { // 몸통 (시가~종가)
      label: "몸통", type: "bar",
      data: rows.map(function (r) { return [Math.min(r.o, r.c), Math.max(r.o, r.c)]; }),
      backgroundColor: colors, barPercentage: 0.75, categoryPercentage: 1, grouped: false, minBarLength: 1, order: 1
    }
  ];
  if (rows.length > 20 && typeof smaSeries === "function") {
    var allCloses = state.rows.map(function (r) { return r.c; });
    var ma20 = smaSeries(allCloses, 20).slice(-rows.length);
    datasets.push({
      label: "20일선", type: "line", data: ma20,
      borderColor: "#ffc94d", borderWidth: 1.2, pointRadius: 0, tension: 0, fill: false, order: 0
    });
  }
  if (maxVol > 0) {
    datasets.push({
      label: "거래량", type: "bar", yAxisID: "y1",
      data: rows.map(function (r) { return r.v || 0; }),
      backgroundColor: colors.map(function (c) { return c + "33"; }),
      barPercentage: 0.9, categoryPercentage: 1, grouped: false, order: 3
    });
  }

  if (techState.candleChart) techState.candleChart.destroy();
  techState.candleChart = new Chart($("candleChart"), {
    type: "bar",
    data: { labels: rows.map(function (r) { return fmtDate(r.t); }), datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        zoom: typeof buildZoomOptions === "function" ? buildZoomOptions() : undefined,
        legend: { display: false },
        tooltip: {
          filter: function (item) { return item.datasetIndex === 1; },
          callbacks: {
            label: function (ctx) {
              var r = rows[ctx.dataIndex];
              var chg = r.c / r.o - 1;
              return [
                "시가 " + fmtPrice(r.o) + " / 고가 " + fmtPrice(r.h),
                "저가 " + fmtPrice(r.l) + " / 종가 " + fmtPrice(r.c) + " (" + fmtPct(chg) + ")",
                "거래량 " + (r.v ? r.v.toLocaleString("ko-KR") : "-"),
                "모양: " + candleShape(r)
              ];
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: "#8b97b0", maxTicksLimit: 8, maxRotation: 0 }, grid: { color: "#222b40" } },
        y: { position: "left", ticks: { color: "#8b97b0", callback: function (v) { return fmtPrice(v); } }, grid: { color: "#222b40" } },
        y1: { position: "right", max: maxVol * 4, display: false, grid: { display: false } }
      }
    }
  });

  // 최근 5봉 요약
  var lastFive = rows.slice(-5).reverse();
  $("candleRecent").innerHTML = lastFive.map(function (r) {
    var chg = r.c / r.o - 1;
    var col = r.c >= r.o ? "var(--up)" : "var(--down)";
    return '<span class="badge">' + fmtDate(r.t) + '<b style="color:' + col + '">' +
      (r.c >= r.o ? "양봉" : "음봉") + " " + fmtPct(chg) + '</b><small style="color:var(--sub)"> ' + candleShape(r) + "</small></span>";
  }).join("");
}

/* 기간 수익률 배지 */
function renderPeriodReturns() {
  var rows = state.rows;
  var items = [
    ["1개월", returnOverDays(rows, 30)],
    ["3개월", returnOverDays(rows, 91)],
    ["6개월", returnOverDays(rows, 182)],
    ["1년", returnOverDays(rows, 365)],
    ["연초 대비", returnYTD(rows)],
    ["3년", returnOverDays(rows, 365 * 3)],
    ["5년", returnOverDays(rows, 365 * 5)]
  ];
  $("periodReturns").innerHTML = items.map(function (it) {
    if (!it[1]) return "";
    return '<span class="badge" title="' + fmtDate(it[1].fromT) + " " + fmtPrice(it[1].fromC) + ' 대비">' +
      it[0] + '<b class="' + pctCls(it[1].ret) + '">' + fmtPct(it[1].ret) + "</b></span>";
  }).join("");
}

function renderTechnical() {
  if (!state.rows || state.rows.length < 30) return;
  computeLevels();
  renderLevelsTable();
  renderPeriodReturns();
  renderCandles();
}

$("showLevels").onchange = function () { if (state.chart) state.chart.update("none"); };
$("candleDays").onchange = function () { if (state.rows) renderCandles(); };
$("candleResetZoom").onclick = function () {
  if (typeof resetChartZoom === "function") resetChartZoom(techState.candleChart);
};
