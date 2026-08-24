"use strict";
/* ============================================================
   StockMind — 장바구니 비교 모듈
   index.html의 전역 함수(parseChart, convertRows, fxAt, loadFx,
   drawEventsOnChart, eventListHtml, fmtPct, $ 등)를 재사용한다.
   ============================================================ */

var CMP_COLORS = ["#ffc94d", "#4dc3ff", "#3ddc97", "#ff5b5b", "#c47dff", "#ff9d4d", "#7dd3fc", "#f9a8d4"];

/* 주요 위기·회복 구간 (연 1회 수동 업데이트)
   [이름, 시작일, 종료일, 유형] */
var CRISIS_WINDOWS = [
  ["2018 4분기 급락", "2018-10-01", "2018-12-24", "하락"],
  ["코로나 폭락", "2020-02-19", "2020-03-23", "하락"],
  ["코로나 회복 랠리", "2020-03-23", "2020-12-31", "회복"],
  ["러-우 전쟁 초기", "2022-02-24", "2022-03-08", "하락"],
  ["2022 금리인상 약세장", "2022-01-03", "2022-10-12", "하락"],
  ["SVB 은행위기", "2023-03-08", "2023-03-20", "하락"],
  ["엔캐리 청산", "2024-07-31", "2024-08-05", "하락"],
  ["한국 비상계엄", "2024-12-03", "2024-12-09", "하락"],
  ["미국 상호관세 발표", "2025-04-02", "2025-04-21", "하락"]
];

/* ================= 순수 계산 함수 ================= */

// UTC 기준 일자 번호. 한국 마감(06:30 UTC)과 미국 마감(20~21시 UTC)이
// 모두 같은 거래일로 매핑되므로 시장 간 정렬에 안전하다.
function dayKey(t) { return Math.floor(t / 86400000); }
function keyToMs(d) { return d * 86400000; }

// 여러 종목의 시계열을 공통 타임라인에 정렬 (휴장일은 직전가로 채움)
function alignSeries(list) {
  var maps = [], starts = [], ends = [];
  for (var i = 0; i < list.length; i++) {
    var m = {}, rows = list[i].rows;
    for (var j = 0; j < rows.length; j++) m[dayKey(rows[j].t)] = rows[j].c;
    maps.push(m);
    starts.push(dayKey(rows[0].t));
    ends.push(dayKey(rows[rows.length - 1].t));
  }
  var start = Math.max.apply(null, starts);
  var end = Math.min.apply(null, ends);
  if (end <= start) return null;

  var keySet = {};
  for (var a = 0; a < maps.length; a++) {
    for (var k in maps[a]) {
      var kk = +k;
      if (kk >= start && kk <= end) keySet[kk] = 1;
    }
  }
  var days = Object.keys(keySet).map(Number).sort(function (x, y) { return x - y; });

  var values = [], real = [];
  for (var b = 0; b < maps.length; b++) {
    var vals = [], reals = [], lastV = null;
    for (var c = 0; c < days.length; c++) {
      var v = maps[b][days[c]];
      if (v != null) { lastV = v; reals.push(true); } else { reals.push(false); }
      vals.push(lastV);
    }
    values.push(vals); real.push(reals);
  }

  // 선두에 아직 값이 없는 구간(휴장 차이로 null) 제거
  var cut = 0;
  for (var d = 0; d < days.length; d++) {
    var ok = true;
    for (var e = 0; e < values.length; e++) if (values[e][d] == null) { ok = false; break; }
    if (ok) { cut = d; break; }
  }
  if (cut > 0) {
    days = days.slice(cut);
    for (var f = 0; f < values.length; f++) {
      values[f] = values[f].slice(cut);
      real[f] = real[f].slice(cut);
    }
  }
  return {
    days: days, values: values, real: real,
    symbols: list.map(function (s) { return s.symbol; })
  };
}

// 시작점을 100으로 정규화
function normalize100(vals) {
  var base = vals[0];
  return vals.map(function (v) { return v / base * 100; });
}

// 총수익 / CAGR / 최대낙폭 / 연변동성
function seriesMetrics(vals, days, real) {
  var first = vals[0], last = vals[vals.length - 1];
  var years = (days[days.length - 1] - days[0]) / 365.25;
  var total = last / first - 1;
  var cagr = years > 0.5 ? Math.pow(last / first, 1 / years) - 1 : total;

  var peak = vals[0], mdd = 0;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i] > peak) peak = vals[i];
    var dd = vals[i] / peak - 1;
    if (dd < mdd) mdd = dd;
  }

  // 변동성은 실제 거래일끼리만 계산 (채워넣은 날의 0% 수익률 제외)
  var rets = [], prev = null;
  for (var j = 0; j < vals.length; j++) {
    if (real[j]) {
      if (prev != null) rets.push(vals[j] / prev - 1);
      prev = vals[j];
    }
  }
  var vol = 0;
  if (rets.length > 2) {
    var mean = 0;
    for (var m = 0; m < rets.length; m++) mean += rets[m];
    mean /= rets.length;
    var sq = 0;
    for (var n = 0; n < rets.length; n++) sq += (rets[n] - mean) * (rets[n] - mean);
    vol = Math.sqrt(sq / (rets.length - 1)) * Math.sqrt(252);
  }
  return { total: total, cagr: cagr, mdd: mdd, vol: vol, years: years };
}

// 두 자산의 일간수익률 상관계수 (양쪽 모두 실제 거래일인 날만 사용)
function pairCorrelation(valsA, realA, valsB, realB) {
  var ra = [], rb = [], pa = null, pb = null;
  for (var i = 0; i < valsA.length; i++) {
    if (realA[i] && realB[i]) {
      if (pa != null) { ra.push(valsA[i] / pa - 1); rb.push(valsB[i] / pb - 1); }
      pa = valsA[i]; pb = valsB[i];
    }
  }
  if (ra.length < 10) return null;
  var ma = 0, mb = 0, n = ra.length;
  for (var j = 0; j < n; j++) { ma += ra[j]; mb += rb[j]; }
  ma /= n; mb /= n;
  var cov = 0, va = 0, vb = 0;
  for (var k = 0; k < n; k++) {
    var da = ra[k] - ma, db = rb[k] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}

// 특정 기간 [t1, t2] 수익률. 시작가는 t1 직전(또는 당일) 종가를 사용.
function windowReturn(days, vals, t1, t2) {
  var d1 = dayKey(t1), d2 = dayKey(t2);
  if (d2 < days[0] || d1 > days[days.length - 1]) return null;
  var i1 = -1, i2 = -1;
  for (var i = 0; i < days.length; i++) { if (days[i] <= d1) i1 = i; else break; }
  if (i1 < 0) i1 = 0;
  for (var j = days.length - 1; j >= 0; j--) { if (days[j] <= d2) { i2 = j; break; } }
  if (i2 <= i1) return null;
  return vals[i2] / vals[i1] - 1;
}

// 금액 표기 (억/만 단위)
function fmtMoney(v) {
  if (!isFinite(v)) return "-";
  var abs = Math.abs(v);
  if (abs >= 100000000) return (v / 100000000).toFixed(abs >= 1000000000 ? 0 : 1) + "억";
  if (abs >= 10000) return Math.round(v / 10000).toLocaleString("ko-KR") + "만";
  return Math.round(v).toLocaleString("ko-KR");
}

/* ================= 상태 & UI ================= */
var cmpState = {
  cart: ["005930.KS", "GLD", "TLT", "KRW=X"],
  cache: {}, results: null, aligned: null, chart: null, view: null, mixedCur: false
};

function cmpLabel(sym) {
  for (var i = 0; i < TICKER_DICT.length; i++) {
    if (TICKER_DICT[i][0] === sym) return TICKER_DICT[i][1];
  }
  return sym;
}

function renderChips() {
  var box = $("cmpChips");
  if (!cmpState.cart.length) {
    box.innerHTML = '<span style="color:var(--sub);font-size:12px">비교할 종목을 2개 이상 추가하세요.</span>';
    return;
  }
  box.innerHTML = cmpState.cart.map(function (s, i) {
    var col = CMP_COLORS[i % CMP_COLORS.length];
    return '<span class="cartChip" style="border-color:' + col + '">' +
      '<i style="background:' + col + '"></i>' + cmpLabel(s) +
      '<b data-x="' + s + '">&times;</b></span>';
  }).join("");
  Array.prototype.forEach.call(box.querySelectorAll("b[data-x]"), function (btn) {
    btn.onclick = function () {
      var s = btn.getAttribute("data-x");
      cmpState.cart = cmpState.cart.filter(function (x) { return x !== s; });
      renderChips();
    };
  });
}

function addToCart(sym) {
  if (!sym) return;
  if (cmpState.cart.indexOf(sym) >= 0) return;
  if (cmpState.cart.length >= 8) { setCmpStatus("최대 8개까지 비교할 수 있습니다.", true); return; }
  cmpState.cart.push(sym);
  renderChips();
  setCmpStatus("");
}

function setCmpStatus(msg, isErr) {
  var el = $("cmpStatus");
  el.textContent = msg || "";
  el.className = isErr ? "err" : "";
}

/* ---------- 비교용 검색 자동완성 ---------- */
$("cmpInput").addEventListener("input", function () {
  var q = this.value.trim();
  var box = $("cmpResults");
  if (!q) { box.style.display = "none"; return; }
  var hits = searchDict(TICKER_DICT, q);
  if (!hits.length) { box.style.display = "none"; return; }
  box.innerHTML = hits.map(function (it) {
    return '<div class="item" data-s="' + it.symbol + '">' + it.name +
      '<span class="exch">' + it.symbol + "</span></div>";
  }).join("");
  box.style.display = "block";
  Array.prototype.forEach.call(box.querySelectorAll(".item"), function (child) {
    child.onclick = function () {
      addToCart(child.getAttribute("data-s"));
      $("cmpInput").value = "";
      box.style.display = "none";
    };
  });
});
$("cmpInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    var hits = searchDict(TICKER_DICT, this.value.trim());
    if (hits.length) { addToCart(hits[0].symbol); this.value = ""; $("cmpResults").style.display = "none"; }
  }
});
document.addEventListener("click", function (e) {
  if (!$("cmpSearchBox").contains(e.target)) $("cmpResults").style.display = "none";
});
$("cmpAddCurrent").onclick = function () {
  if (!state.symbol) { setCmpStatus("먼저 위에서 종목을 분석해 주세요.", true); return; }
  addToCart(state.symbol);
};

/* ---------- 데이터 로드 (순차 요청) ---------- */
function fetchSeries(symbol, range) {
  var key = symbol + "|" + range;
  if (cmpState.cache[key]) return Promise.resolve(cmpState.cache[key]);
  return fetch("/api/chart?symbol=" + encodeURIComponent(symbol) + "&range=" + range)
    .then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
        return j;
      });
    })
    .then(function (json) {
      var parsed = parseChart(json);
      if (parsed.rows.length < 30) throw new Error(symbol + ": 데이터 부족");
      var obj = { symbol: symbol, rows: parsed.rows, meta: parsed.meta };
      cmpState.cache[key] = obj;
      return obj;
    });
}

$("cmpRun").onclick = function () {
  var cart = cmpState.cart.slice();
  if (cart.length < 2) { setCmpStatus("2개 이상의 종목이 필요합니다.", true); return; }
  var range = $("cmpRange").value;

  var results = [];
  var chain = Promise.resolve();
  cart.forEach(function (sym, idx) {
    chain = chain.then(function () {
      setCmpStatus("불러오는 중... (" + (idx + 1) + "/" + cart.length + ") " + cmpLabel(sym));
      return fetchSeries(sym, range).then(function (obj) { results.push(obj); });
    });
  });

  chain
    .then(function () {
      // 원화가 아닌 자산이 하나라도 있으면 환율 데이터를 함께 받아둔다
      var needFx = results.some(function (r) { return (r.meta.currency || "USD") !== "KRW"; });
      cmpState.mixedCur = needFx;
      if (!needFx) return null;
      setCmpStatus("환율 데이터 불러오는 중...");
      return loadFx(range).catch(function () { return null; });
    })
    .then(function (fx) {
      cmpState.fx = fx || null;
      cmpState.results = results;
      cmpState.view = null;
      if (!cmpState.fx) $("cmpKrw").checked = false;
      rebuildAligned();
      setCmpStatus("");
      renderCompare();
    })
    .catch(function (e) { setCmpStatus("오류: " + e.message, true); });
};

// 환산 설정에 따라 정렬 데이터를 다시 만든다 (재조회 없음)
function rebuildAligned() {
  var useKrw = !!(cmpState.fx && $("cmpKrw").checked);
  var list = cmpState.results.map(function (r) {
    var isForeign = (r.meta.currency || "USD") !== "KRW";
    if (useKrw && isForeign) return { symbol: r.symbol, rows: convertRows(r.rows, cmpState.fx) };
    return { symbol: r.symbol, rows: r.rows };
  });
  var aligned = alignSeries(list);
  if (!aligned || aligned.days.length < 30) throw new Error("공통 기간이 너무 짧습니다.");
  cmpState.aligned = aligned;
}

/* ---------- 렌더링 ---------- */

// 현재 확대 구간(cmpState.view)에 해당하는 부분 시계열
function getView() {
  var A = cmpState.aligned;
  var full = { days: A.days, values: A.values };
  if (!cmpState.view) return full;
  var d1 = dayKey(cmpState.view.t1), d2 = dayKey(cmpState.view.t2);
  var i1 = -1, i2 = -1;
  for (var i = 0; i < A.days.length; i++) { if (A.days[i] <= d1) i1 = i; else break; }
  if (i1 < 0) i1 = 0;
  for (var j = A.days.length - 1; j >= 0; j--) { if (A.days[j] <= d2) { i2 = j; break; } }
  if (i2 <= i1 + 1) return full;
  return {
    days: A.days.slice(i1, i2 + 1),
    values: A.values.map(function (v) { return v.slice(i1, i2 + 1); })
  };
}

function renderCompare() {
  $("cmpBody").classList.remove("hidden");
  var A = cmpState.aligned;
  var curNote = "";
  if (cmpState.mixedCur) {
    curNote = $("cmpKrw").checked
      ? " · 전 자산 원화(KRW) 환산"
      : " · 각 자산 원래 통화 기준(수익률 비교만 유효)";
  }
  $("cmpPeriod").textContent =
    "공통 기간: " + fmtDate(keyToMs(A.days[0])) + " ~ " + fmtDate(keyToMs(A.days[A.days.length - 1])) + curNote;
  renderCmpChart();
  renderCmpSummary();
  renderCmpCrisis();
  renderCmpCorr();
}

var cmpEventPlugin = {
  id: "cmpEvents",
  afterDatasetsDraw: function (chart) {
    if (!cmpState.aligned) return;
    var V = getView();
    drawEventsOnChart(
      chart,
      V.days.map(keyToMs),
      $("cmpShowEvents").checked,
      $("cmpShowLabels").checked
    );
  }
};

function renderCmpChart() {
  var A = cmpState.aligned;
  var V = getView();
  var isLog = $("cmpLog").checked;
  var isAmount = $("cmpMode").value === "amount";
  var principal = parseFloat($("cmpPrincipal").value);
  if (!isFinite(principal) || principal <= 0) principal = 10000000;

  var datasets = A.symbols.map(function (sym, i) {
    var n = normalize100(V.values[i]);
    return {
      label: cmpLabel(sym),
      data: isAmount ? n.map(function (v) { return principal * v / 100; }) : n,
      borderColor: CMP_COLORS[i % CMP_COLORS.length],
      borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false
    };
  });

  if (cmpState.chart) cmpState.chart.destroy();
  cmpState.chart = new Chart($("cmpChart"), {
    type: "line",
    data: { labels: V.days.map(function (d) { return fmtDate(keyToMs(d)); }), datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#e6ebf5", boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var y = ctx.parsed.y;
              if (isAmount) {
                return ctx.dataset.label + ": " + Math.round(y).toLocaleString("ko-KR") + "원 (" +
                  fmtPct(y / principal - 1) + ")";
              }
              return ctx.dataset.label + ": " + fmtPct(y / 100 - 1);
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: "#8b97b0", maxTicksLimit: 8, maxRotation: 0 }, grid: { color: "#222b40" } },
        y: {
          type: isLog ? "logarithmic" : "linear",
          ticks: {
            color: "#8b97b0",
            callback: function (v) { return isAmount ? fmtMoney(v) : fmtPct(v / 100 - 1); }
          },
          // 원금선(수익률 0%)을 밝게 강조
          grid: {
            color: function (ctx) {
              var baseline = isAmount ? principal : 100;
              return (ctx.tick && Math.abs(ctx.tick.value - baseline) < baseline * 0.001) ? "#5a6580" : "#222b40";
            }
          }
        }
      }
    },
    plugins: [cmpEventPlugin]
  });

  $("cmpEventList").innerHTML = eventListHtml(keyToMs(V.days[0]), keyToMs(V.days[V.days.length - 1]));

  if (cmpState.view) {
    $("cmpViewLabel").textContent = "확대: " + cmpState.view.name;
    $("cmpResetView").classList.remove("hidden");
  } else {
    $("cmpViewLabel").textContent = "";
    $("cmpResetView").classList.add("hidden");
  }
  $("cmpPrincipalWrap").style.opacity = isAmount ? "1" : "0.4";
}

$("cmpLog").onchange = function () { if (cmpState.aligned) renderCmpChart(); };
$("cmpMode").onchange = function () { if (cmpState.aligned) renderCmpChart(); };
$("cmpPrincipal").addEventListener("input", function () { if (cmpState.aligned) renderCmpChart(); });
$("cmpShowEvents").onchange = function () { if (cmpState.chart) cmpState.chart.update(); };
$("cmpShowLabels").onchange = function () { if (cmpState.chart) cmpState.chart.update(); };
$("cmpKrw").onchange = function () {
  if (!cmpState.results) return;
  try { rebuildAligned(); renderCompare(); }
  catch (e) { setCmpStatus("오류: " + e.message, true); }
};
$("cmpResetView").onclick = function () {
  cmpState.view = null;
  renderCmpChart();
  renderCmpCrisis();
};

function renderCmpSummary() {
  var A = cmpState.aligned;
  var html = "<thead><tr><th>자산</th><th>총수익</th><th>연평균(CAGR)</th><th>최대낙폭</th><th>연변동성</th><th>위기 평균성과</th></tr></thead><tbody>";
  for (var i = 0; i < A.symbols.length; i++) {
    var m = seriesMetrics(A.values[i], A.days, A.real[i]);
    var sum = 0, cnt = 0;
    for (var w = 0; w < CRISIS_WINDOWS.length; w++) {
      if (CRISIS_WINDOWS[w][3] !== "하락") continue;
      var t1 = new Date(CRISIS_WINDOWS[w][1] + "T00:00:00Z").getTime();
      var t2 = new Date(CRISIS_WINDOWS[w][2] + "T00:00:00Z").getTime();
      var r = windowReturn(A.days, A.values[i], t1, t2);
      if (r != null) { sum += r; cnt++; }
    }
    var avgCrisis = cnt ? sum / cnt : null;
    var col = CMP_COLORS[i % CMP_COLORS.length];
    html += "<tr><td><i class='dot' style='background:" + col + "'></i>" + cmpLabel(A.symbols[i]) + "</td>" +
      '<td class="' + pctCls(m.total) + '">' + fmtPct(m.total) + "</td>" +
      '<td class="' + pctCls(m.cagr) + '">' + fmtPct(m.cagr) + "</td>" +
      '<td class="neg">' + fmtPct(m.mdd) + "</td>" +
      "<td>" + (m.vol * 100).toFixed(1) + "%</td>" +
      (avgCrisis == null ? "<td>-</td>"
        : '<td class="' + pctCls(avgCrisis) + '" style="font-weight:bold">' + fmtPct(avgCrisis) + "</td>") +
      "</tr>";
  }
  $("cmpSummary").innerHTML = html + "</tbody>";
}

function renderCmpCrisis() {
  var A = cmpState.aligned;
  var html = "<thead><tr><th>사건</th>";
  for (var i = 0; i < A.symbols.length; i++) {
    html += "<th><i class='dot' style='background:" + CMP_COLORS[i % CMP_COLORS.length] + "'></i>" +
      cmpLabel(A.symbols[i]) + "</th>";
  }
  html += "</tr></thead><tbody>";

  for (var w = 0; w < CRISIS_WINDOWS.length; w++) {
    var cw = CRISIS_WINDOWS[w];
    var t1 = new Date(cw[1] + "T00:00:00Z").getTime();
    var t2 = new Date(cw[2] + "T00:00:00Z").getTime();
    var cells = [], any = false;
    for (var i2 = 0; i2 < A.symbols.length; i2++) {
      var r = windowReturn(A.days, A.values[i2], t1, t2);
      if (r == null) { cells.push("<td>-</td>"); continue; }
      any = true;
      cells.push('<td class="' + pctCls(r) + '">' + fmtPct(r) + "</td>");
    }
    if (!any) continue;
    var typeCol = cw[3] === "회복" ? "var(--good)" : "var(--sub)";
    var isActive = cmpState.view && cmpState.view.name === cw[0];
    html += "<tr class='crisisRow" + (isActive ? " active" : "") + "' data-w='" + w + "'>" +
      "<td style='text-align:left'>" + cw[0] +
      "<br><small style='color:" + typeCol + "'>" + cw[1].slice(2) + " ~ " + cw[2].slice(2) + "</small></td>" +
      cells.join("") + "</tr>";
  }
  $("cmpCrisis").innerHTML = html + "</tbody>";

  Array.prototype.forEach.call($("cmpCrisis").querySelectorAll(".crisisRow"), function (tr) {
    tr.onclick = function () {
      var cw2 = CRISIS_WINDOWS[+tr.getAttribute("data-w")];
      if (cmpState.view && cmpState.view.name === cw2[0]) {
        cmpState.view = null;
      } else {
        cmpState.view = {
          name: cw2[0],
          t1: new Date(cw2[1] + "T00:00:00Z").getTime(),
          t2: new Date(cw2[2] + "T00:00:00Z").getTime()
        };
      }
      renderCmpChart();
      renderCmpCrisis();
      $("cmpChart").scrollIntoView({ behavior: "smooth", block: "center" });
    };
  });
}

function renderCmpCorr() {
  var A = cmpState.aligned;
  var n = A.symbols.length;
  var html = "<thead><tr><th></th>";
  for (var i = 0; i < n; i++) html += "<th>" + cmpLabel(A.symbols[i]) + "</th>";
  html += "</tr></thead><tbody>";
  for (var r = 0; r < n; r++) {
    html += "<tr><td><i class='dot' style='background:" + CMP_COLORS[r % CMP_COLORS.length] + "'></i>" +
      cmpLabel(A.symbols[r]) + "</td>";
    for (var c = 0; c < n; c++) {
      if (r === c) { html += "<td style='color:var(--sub)'>1.00</td>"; continue; }
      var v = pairCorrelation(A.values[r], A.real[r], A.values[c], A.real[c]);
      if (v == null) { html += "<td>-</td>"; continue; }
      var alpha = Math.min(Math.abs(v), 1) * 0.35;
      var bg = v < 0 ? "rgba(61,220,151," + alpha + ")" : "rgba(255,91,91," + alpha + ")";
      html += "<td style='background:" + bg + "'>" + v.toFixed(2) + "</td>";
    }
    html += "</tr>";
  }
  $("cmpCorr").innerHTML = html + "</tbody>";
}

renderChips();
