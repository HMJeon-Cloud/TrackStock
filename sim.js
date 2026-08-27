"use strict";
/* ============================================================
   StockMind — 포트폴리오 시뮬레이터 (Phase 4)
   compare.js의 전역(alignSeries, seriesMetrics, windowReturn,
   dayKey, fmtMoney, CRISIS_WINDOWS, cmpState 등)을 재사용한다.
   ============================================================ */

/* ================= 순수 계산 함수 ================= */

// 비중 배열을 합 1로 정규화
function normalizeWeights(ws) {
  var sum = 0;
  for (var i = 0; i < ws.length; i++) sum += Math.max(0, ws[i]);
  if (sum <= 0) return ws.map(function () { return 1 / ws.length; });
  return ws.map(function (w) { return Math.max(0, w) / sum; });
}

/* 포트폴리오 백테스트
   days        : 일자 키 배열
   valuesList  : 자산별 가격 배열의 배열
   weights     : 목표 비중 (합 1로 정규화되어 들어온다고 가정)
   rebalMonths : 리밸런싱 주기(개월). 0이면 리밸런싱 안 함
   initAmt     : 시작일 일시 투자금
   monthlyAmt  : 매월 첫 거래일 추가 투자금 (0이면 거치식)
   반환: { values, invested, rebalIdx }
*/
function portfolioSim(days, valuesList, weights, rebalMonths, initAmt, monthlyAmt) {
  var n = valuesList.length;
  var units = [];
  for (var a = 0; a < n; a++) units.push(0);

  var invested = 0, out = [], invArr = [], rebalIdx = [];
  var d0 = new Date(days[0] * 86400000);
  var startMonthKey = d0.getUTCFullYear() * 12 + d0.getUTCMonth();
  var lastMonth = null, lastRebalPeriod = 0;

  function buy(amount, t) {
    for (var k = 0; k < n; k++) units[k] += amount * weights[k] / valuesList[k][t];
    invested += amount;
  }

  for (var t = 0; t < days.length; t++) {
    var d = new Date(days[t] * 86400000);
    var mk = d.getUTCFullYear() * 12 + d.getUTCMonth();

    if (lastMonth === null) {
      buy(initAmt, t);
      lastMonth = mk;
      lastRebalPeriod = 0;
    } else if (mk > lastMonth) {
      if (monthlyAmt > 0) buy(monthlyAmt, t);
      lastMonth = mk;
      if (rebalMonths > 0) {
        var period = Math.floor((mk - startMonthKey) / rebalMonths);
        if (period > lastRebalPeriod) {
          var total = 0;
          for (var k2 = 0; k2 < n; k2++) total += units[k2] * valuesList[k2][t];
          for (var k3 = 0; k3 < n; k3++) units[k3] = total * weights[k3] / valuesList[k3][t];
          lastRebalPeriod = period;
          rebalIdx.push(t);
        }
      }
    }

    var v = 0;
    for (var k4 = 0; k4 < n; k4++) v += units[k4] * valuesList[k4][t];
    out.push(v);
    invArr.push(invested);
  }
  return { values: out, invested: invArr, rebalIdx: rebalIdx };
}

// 한 자산에 100% 넣은 경우의 비중 벡터
function oneHot(n, i) {
  var w = [];
  for (var k = 0; k < n; k++) w.push(k === i ? 1 : 0);
  return w;
}

// 현재 설정을 사람이 읽는 문장으로 풀어쓴다 (시뮬레이터 해석의 출발점)
function describeSim(I, R) {
  var parts = R.symbols.map(function (s, i) {
    return cmpLabel(s) + " " + Math.round(I.w[i] * 100) + "%";
  }).join(" / ");
  var html = "<b>" + fmtDate(keyToMs(R.days[0])) + "</b>에 <b>" +
    Math.round(I.init).toLocaleString("ko-KR") + "원</b>을 <b>" + parts + "</b> 비율로 나눠 삽니다.";
  if (I.monthly > 0) {
    html += "<br>이후 <b>매월 첫 거래일마다 " + Math.round(I.monthly).toLocaleString("ko-KR") +
      "원</b>을 같은 비율로 추가 매수합니다.";
  } else {
    html += "<br>추가 매수는 하지 않고 " + fmtDate(keyToMs(R.days[R.days.length - 1])) + "까지 그대로 둡니다.";
  }
  if (I.rebal > 0) {
    html += "<br><b>" + rebalLabel(I.rebal) + "</b> — 가격이 움직여 비율이 틀어지면, 많이 오른 것을 팔고 " +
      "덜 오른 것을 사서 위 비율로 되돌립니다.";
  } else {
    html += "<br><b>리밸런싱은 하지 않습니다</b> — 한 번 산 뒤로는 비율이 저절로 바뀌는 대로 둡니다.";
  }
  return html;
}

// 포트폴리오 지수에서 낙폭 구간 상위 N개를 뽑는다
function worstEpisodes(days, idxVals, topN) {
  var rows = days.map(function (d, i) { return { t: keyToMs(d), c: idxVals[i] }; });
  var eps = drawdownEpisodes(rows, 0.05);
  eps.sort(function (a, b) { return a.dd - b.dd; });
  return eps.slice(0, topN).map(function (e) {
    return {
      dd: e.dd,
      t1: rows[e.peakI].t,
      t2: rows[e.troughI].t,
      peakV: rows[e.peakI].c,
      troughV: rows[e.troughI].c,
      recovered: e.recoverI != null ? rows[e.recoverI].t : null
    };
  });
}

/* ================= 상태 & UI ================= */
var simState = { results: null, aligned: null, chart: null, weights: {}, idx: null, startIdx: 0 };

function setSimStatus(msg, isErr) {
  var el = $("simStatus");
  el.textContent = msg || "";
  el.className = isErr ? "err" : "";
}

// 장바구니(장바구니 비교 탭과 공유)에 맞춰 비중 입력칸을 다시 그린다
function syncSimAssets() {
  var box = $("simAssets");
  var cart = cmpState.cart;
  if (!cart.length) {
    box.innerHTML = '<span style="color:var(--sub);font-size:12px">' +
      '먼저 <b>장바구니 비교</b> 탭에서 종목을 담아 주세요. 이 탭은 같은 장바구니를 사용합니다.</span>';
    $("simWeightSum").textContent = "";
    return;
  }
  var html = "";
  cart.forEach(function (sym, i) {
    if (simState.weights[sym] == null) simState.weights[sym] = Math.round(100 / cart.length);
    var col = CMP_COLORS[i % CMP_COLORS.length];
    html += '<div class="wRow">' +
      "<i class='dot' style='background:" + col + "'></i>" +
      '<span class="wName">' + cmpLabel(sym) + "</span>" +
      '<input class="wInput" type="range" min="0" max="100" step="5" data-w="' + sym + '" value="' + simState.weights[sym] + '">' +
      '<input class="wNum" type="number" min="0" max="100" step="1" data-n="' + sym + '" value="' + simState.weights[sym] + '">%' +
      "</div>";
  });
  box.innerHTML = html;

  Array.prototype.forEach.call(box.querySelectorAll("[data-w]"), function (el) {
    el.addEventListener("input", function () {
      var sym = el.getAttribute("data-w");
      simState.weights[sym] = +el.value;
      box.querySelector('[data-n="' + sym + '"]').value = el.value;
      updateWeightSum();
    });
  });
  Array.prototype.forEach.call(box.querySelectorAll("[data-n]"), function (el) {
    el.addEventListener("input", function () {
      var sym = el.getAttribute("data-n");
      simState.weights[sym] = +el.value || 0;
      box.querySelector('[data-w="' + sym + '"]').value = el.value;
      updateWeightSum();
    });
  });
  updateWeightSum();
}

function updateWeightSum() {
  var sum = 0;
  cmpState.cart.forEach(function (s) { sum += simState.weights[s] || 0; });
  var el = $("simWeightSum");
  el.innerHTML = "비중 합계<b class='" + (sum === 100 ? "" : "neg") + "'>" + sum + "%</b>";
  el.title = sum === 100 ? "" : "합이 100%가 아니면 비율대로 자동 환산됩니다.";
}

$("simEqual").onclick = function () {
  var cart = cmpState.cart;
  if (!cart.length) return;
  var base = Math.floor(100 / cart.length);
  cart.forEach(function (s, i) {
    simState.weights[s] = base + (i < 100 - base * cart.length ? 1 : 0);
  });
  syncSimAssets();
};

/* ---------- 실행 ---------- */
$("simRun").onclick = function () {
  var cart = cmpState.cart.slice();
  if (cart.length < 1) { setSimStatus("장바구니에 종목이 없습니다.", true); return; }
  var range = $("simRange").value;

  var results = [];
  var chain = Promise.resolve();
  cart.forEach(function (sym, idx) {
    chain = chain.then(function () {
      setSimStatus("불러오는 중... (" + (idx + 1) + "/" + cart.length + ") " + cmpLabel(sym));
      return fetchSeries(sym, range).then(function (obj) { results.push(obj); });
    });
  });

  chain
    .then(function () {
      var needFx = results.some(function (r) { return (r.meta.currency || "USD") !== "KRW"; });
      if (!needFx) return null;
      setSimStatus("환율 데이터 불러오는 중...");
      return loadFx(range).catch(function () { return null; });
    })
    .then(function (fx) {
      simState.fx = fx || null;
      simState.results = results;
      // 포트폴리오는 통화가 섞이면 계산이 불가능하므로 항상 원화로 통일한다
      var list = results.map(function (r) {
        var isForeign = (r.meta.currency || "USD") !== "KRW";
        if (isForeign && simState.fx) return { symbol: r.symbol, rows: convertRows(r.rows, simState.fx) };
        return { symbol: r.symbol, rows: r.rows };
      });
      var aligned = alignSeries(list);
      if (!aligned || aligned.days.length < 60) throw new Error("공통 기간이 너무 짧습니다.");
      simState.aligned = aligned;

      var el = $("simStart");
      el.min = dayKeyToDateStr(aligned.days[0]);
      el.max = dayKeyToDateStr(aligned.days[aligned.days.length - 1]);
      if (!el.value || el.value < el.min || el.value > el.max) el.value = el.min;
      simState.startIdx = indexOnOrAfter(aligned.days, new Date(el.value + "T00:00:00Z").getTime());

      setSimStatus("");
      renderSim();
    })
    .catch(function (e) { setSimStatus("오류: " + e.message, true); });
};

$("simStart").addEventListener("change", function () {
  if (!simState.aligned) return;
  simState.startIdx = indexOnOrAfter(simState.aligned.days, new Date(this.value + "T00:00:00Z").getTime());
  renderSim();
});
["simRebal", "simInit", "simMonthly", "simLog", "simShowAssets"].forEach(function (id) {
  var el = $(id);
  el.addEventListener(el.type === "number" ? "input" : "change", function () {
    if (simState.aligned) renderSim();
  });
});
$("simShowEvents").onchange = function () { if (simState.chart) simState.chart.update(); };
$("simApplyWeights").onclick = function () { if (simState.aligned) renderSim(); };

/* ---------- 렌더링 ---------- */
function simRange() {
  var A = simState.aligned, s = simState.startIdx || 0;
  return {
    days: A.days.slice(s),
    values: A.values.map(function (v) { return v.slice(s); }),
    symbols: A.symbols
  };
}

function simInputs() {
  var R = simRange();
  var w = normalizeWeights(R.symbols.map(function (s) { return simState.weights[s] || 0; }));
  var rebal = +$("simRebal").value;
  var init = parseFloat($("simInit").value);
  var monthly = parseFloat($("simMonthly").value);
  if (!isFinite(init) || init < 0) init = 10000000;
  if (!isFinite(monthly) || monthly < 0) monthly = 0;
  return { R: R, w: w, rebal: rebal, init: init, monthly: monthly };
}

var simEventPlugin = {
  id: "simEvents",
  afterDatasetsDraw: function (chart) {
    if (!simState.aligned) return;
    var R = simRange();
    drawEventsOnChart(chart, R.days.map(keyToMs), $("simShowEvents").checked, false);
  }
};

function renderSim() {
  $("simBody").classList.remove("hidden");
  var I = simInputs(), R = I.R;
  var allTrue = R.days.map(function () { return true; });

  // 실제 투자 결과 (적립금 포함)
  var actual = portfolioSim(R.days, R.values, I.w, I.rebal, I.init, I.monthly);
  // 순수 지수 (적립금 제외) — 수익률·낙폭·사건별 성과 계산용
  var idx = portfolioSim(R.days, R.values, I.w, I.rebal, 1, 0);
  var idxNoRebal = portfolioSim(R.days, R.values, I.w, 0, 1, 0);
  var actualNoRebal = portfolioSim(R.days, R.values, I.w, 0, I.init, I.monthly);

  simState.idx = idx;

  /* --- 차트 --- */
  var datasets = [{
    label: "내 포트폴리오",
    data: actual.values,
    borderColor: "#ffc94d", borderWidth: 2.4, pointRadius: 0, tension: 0, fill: false
  }];
  if (I.rebal > 0) {
    datasets.push({
      label: "리밸런싱 안 했다면",
      data: actualNoRebal.values,
      borderColor: "#8b97b0", borderWidth: 1.2, borderDash: [6, 4],
      pointRadius: 0, tension: 0, fill: false
    });
  }
  if (I.monthly > 0) {
    datasets.push({
      label: "누적 투입원금",
      data: actual.invested,
      borderColor: "#5a6580", borderWidth: 1.2, borderDash: [2, 3],
      pointRadius: 0, tension: 0, fill: false
    });
  }
  if ($("simShowAssets").checked) {
    R.symbols.forEach(function (sym, i) {
      var one = portfolioSim(R.days, R.values, oneHot(R.symbols.length, i), 0, I.init, I.monthly);
      datasets.push({
        label: cmpLabel(sym) + " 100%",
        data: one.values,
        borderColor: CMP_COLORS[i % CMP_COLORS.length], borderWidth: 1,
        pointRadius: 0, tension: 0, fill: false
      });
    });
  }

  if (simState.chart) simState.chart.destroy();
  simState.chart = new Chart($("simChart"), {
    type: "line",
    data: { labels: R.days.map(function (d) { return fmtDate(keyToMs(d)); }), datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#e6ebf5", boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var y = ctx.parsed.y;
              var inv = actual.invested[ctx.dataIndex];
              if (ctx.dataset.label === "누적 투입원금") {
                return "누적 투입원금: " + Math.round(y).toLocaleString("ko-KR") + "원";
              }
              return ctx.dataset.label + ": " + Math.round(y).toLocaleString("ko-KR") +
                "원 (" + fmtPct(y / inv - 1) + ")";
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: "#8b97b0", maxTicksLimit: 8, maxRotation: 0 }, grid: { color: "#222b40" } },
        y: {
          type: $("simLog").checked ? "logarithmic" : "linear",
          ticks: { color: "#8b97b0", callback: function (v) { return fmtMoney(v); } },
          grid: { color: "#222b40" }
        }
      }
    },
    plugins: [simEventPlugin]
  });

  /* --- 요약 배지 --- */
  var m = seriesMetrics(idx.values, R.days, allTrue);
  var finalVal = actual.values[actual.values.length - 1];
  var totalInv = actual.invested[actual.invested.length - 1];
  var mNo = seriesMetrics(idxNoRebal.values, R.days, allTrue);
  var finalNo = actualNoRebal.values[actualNoRebal.values.length - 1];

  var shortPeriod = m.years < 1;
  var ddImprove = m.mdd - mNo.mdd; // 양수면 낙폭이 얕아진 것

  $("simDesc").innerHTML = describeSim(I, R);

  $("simBadges").innerHTML =
    '<span class="badge" title="지금 이 포트폴리오를 전부 팔면 손에 쥐는 돈">최종 평가금액<b>' +
      Math.round(finalVal).toLocaleString("ko-KR") + "원</b></span>" +
    '<span class="badge" title="초기 투자금 + 매월 추가금을 모두 더한 실제로 넣은 돈">총 투입원금<b>' +
      Math.round(totalInv).toLocaleString("ko-KR") + "원</b></span>" +
    '<span class="badge" title="(최종 평가금액 ÷ 총 투입원금) - 1">총수익률<b class="' + pctCls(finalVal / totalInv - 1) + '">' +
      fmtPct(finalVal / totalInv - 1) + "</b></span>" +
    '<span class="badge" title="복리 기준 연 환산 수익률">연평균(CAGR)<b class="' +
      (shortPeriod ? "" : pctCls(m.cagr)) + '" style="' + (shortPeriod ? "color:var(--sub)" : "") + '">' +
      fmtPct(m.cagr) + (shortPeriod ? " ⚠" : "") + "</b></span>" +
    '<span class="badge" title="기간 중 고점에서 가장 깊이 빠진 폭. 버텨야 했던 고통의 크기">최대낙폭<b class="neg">' +
      fmtPct(m.mdd) + "</b></span>" +
    '<span class="badge" title="가격이 흔들린 정도(연 환산). 클수록 출렁임이 큼">연변동성<b>' +
      (m.vol * 100).toFixed(1) + "%</b></span>" +
    (I.rebal > 0
      ? '<span class="badge" title="리밸런싱을 한 결과와 안 한 결과의 최종 금액 차이">리밸런싱 효과<b class="' +
          pctCls(finalVal - finalNo) + '">' +
          (finalVal >= finalNo ? "+" : "") + Math.round(finalVal - finalNo).toLocaleString("ko-KR") + "원</b></span>" +
        '<span class="badge" title="리밸런싱으로 최대낙폭이 얼마나 얕아졌는지">낙폭 개선<b style="color:' +
          (ddImprove >= 0 ? "var(--good)" : "var(--up)") + '">' +
          (ddImprove >= 0 ? "+" : "") + (ddImprove * 100).toFixed(1) + "%p</b></span>"
      : "");

  $("simWarn").innerHTML = shortPeriod
    ? "⚠ 투자 기간이 <b>" + (m.years * 12).toFixed(0) + "개월</b>로 1년이 안 됩니다. " +
      "<b>연평균(CAGR)은 이 짧은 성과를 1년으로 부풀린 값</b>이라 신뢰할 수 없습니다. " +
      "총수익률만 보시고, 의미 있는 비교를 하려면 시작일을 몇 년 앞으로 옮겨 주세요."
    : "";

  renderSimCompare(I, R, allTrue, idx, idxNoRebal, actual, actualNoRebal, shortPeriod);
  renderSimCrisis(I, R, idx);
  renderSimWorst(I, R, idx);
}

function renderSimCompare(I, R, allTrue, idx, idxNoRebal, actual, actualNoRebal, shortPeriod) {
  var mixLabel = R.symbols.map(function (s, i) {
    return Math.round(I.w[i] * 100) + "%";
  }).join("/");
  var rows = [];
  rows.push({
    name: "내 포트폴리오 (" + mixLabel + " · " + rebalLabel(I.rebal) + ")",
    val: actual.values[actual.values.length - 1],
    idx: idx.values, hi: true
  });
  if (I.rebal > 0) {
    rows.push({
      name: "같은 비율 (" + mixLabel + ") · 리밸런싱만 안 한 경우",
      val: actualNoRebal.values[actualNoRebal.values.length - 1],
      idx: idxNoRebal.values
    });
  }
  R.symbols.forEach(function (sym, i) {
    var w1 = oneHot(R.symbols.length, i);
    rows.push({
      name: cmpLabel(sym) + " 100% (이 종목에만 전부 넣었다면)",
      val: portfolioSim(R.days, R.values, w1, 0, I.init, I.monthly).values.slice(-1)[0],
      idx: portfolioSim(R.days, R.values, w1, 0, 1, 0).values,
      color: CMP_COLORS[i % CMP_COLORS.length]
    });
  });

  var totalInv = actual.invested[actual.invested.length - 1];
  var html = "<thead><tr><th>전략</th><th>최종 평가금액</th><th>총수익</th><th>연평균(CAGR)</th>" +
    "<th>최대낙폭</th><th>연변동성</th><th>위기 평균성과</th></tr></thead><tbody>";
  rows.forEach(function (r) {
    var mm = seriesMetrics(r.idx, R.days, allTrue);
    var sum = 0, cnt = 0;
    for (var w = 0; w < CRISIS_WINDOWS.length; w++) {
      if (CRISIS_WINDOWS[w][3] !== "하락") continue;
      var t1 = new Date(CRISIS_WINDOWS[w][1] + "T00:00:00Z").getTime();
      var t2 = new Date(CRISIS_WINDOWS[w][2] + "T00:00:00Z").getTime();
      var rr = windowReturn(R.days, r.idx, t1, t2);
      if (rr != null) { sum += rr; cnt++; }
    }
    var avgCrisis = cnt ? sum / cnt : null;
    html += "<tr" + (r.hi ? " style='background:#202a40'" : "") + "><td>" +
      (r.color ? "<i class='dot' style='background:" + r.color + "'></i>" : "") +
      (r.hi ? "<b>" + r.name + "</b>" : r.name) + "</td>" +
      "<td>" + Math.round(r.val).toLocaleString("ko-KR") + "원</td>" +
      '<td class="' + pctCls(r.val / totalInv - 1) + '" style="font-weight:bold">' + fmtPct(r.val / totalInv - 1) + "</td>" +
      (shortPeriod
        ? '<td style="color:var(--sub)">' + fmtPct(mm.cagr) + " ⚠</td>"
        : '<td class="' + pctCls(mm.cagr) + '">' + fmtPct(mm.cagr) + "</td>") +
      '<td class="neg">' + fmtPct(mm.mdd) + "</td>" +
      "<td>" + (mm.vol * 100).toFixed(1) + "%</td>" +
      (avgCrisis == null
        ? '<td style="color:var(--sub)">-</td>'
        : '<td class="' + pctCls(avgCrisis) + '" style="font-weight:bold">' + fmtPct(avgCrisis) + "</td>") +
      "</tr>";
  });
  $("simCompare").innerHTML = html + "</tbody>";
}

function renderSimCrisis(I, R, idx) {
  var found = false;
  var html = "<thead><tr><th>사건</th><th>내 포트폴리오</th>";
  R.symbols.forEach(function (sym, i) {
    html += "<th><i class='dot' style='background:" + CMP_COLORS[i % CMP_COLORS.length] + "'></i>" +
      cmpLabel(sym) + "</th>";
  });
  html += "</tr></thead><tbody>";

  for (var w = 0; w < CRISIS_WINDOWS.length; w++) {
    var cw = CRISIS_WINDOWS[w];
    var t1 = new Date(cw[1] + "T00:00:00Z").getTime();
    var t2 = new Date(cw[2] + "T00:00:00Z").getTime();
    var pr = windowReturn(R.days, idx.values, t1, t2);
    if (pr == null) continue;
    found = true;
    var cells = R.symbols.map(function (sym, i) {
      var rr = windowReturn(R.days, R.values[i], t1, t2);
      return rr == null ? "<td>-</td>" : '<td class="' + pctCls(rr) + '">' + fmtPct(rr) + "</td>";
    });
    var typeCol = cw[3] === "회복" ? "var(--good)" : "var(--sub)";
    html += "<tr><td style='text-align:left'>" + cw[0] +
      "<br><small style='color:" + typeCol + "'>" + cw[1].slice(2) + " ~ " + cw[2].slice(2) + "</small></td>" +
      '<td class="' + pctCls(pr) + '" style="font-weight:bold;background:#202a40">' + fmtPct(pr) + "</td>" +
      cells.join("") + "</tr>";
  }
  if (!found) {
    var first = CRISIS_WINDOWS[0][1], last = CRISIS_WINDOWS[CRISIS_WINDOWS.length - 1][2];
    $("simCrisis").innerHTML =
      '<tbody><tr><td style="text-align:left;white-space:normal;color:var(--sub);line-height:1.8">' +
      "투자 시작일(<b>" + fmtDate(keyToMs(R.days[0])) + "</b>) 이후에는 이 앱에 등록된 역사적 사건이 없습니다.<br>" +
      "등록된 사건은 <b>" + first + " ~ " + last + "</b> 사이에 있으니, 이 표를 보시려면 " +
      "<b>시작일을 그 이전으로 앞당겨</b> 다시 실행해 주세요. " +
      '아래 <b style="color:var(--accent)">내 포트폴리오 최악의 하락 구간</b> 표는 시작일과 무관하게 항상 볼 수 있습니다.' +
      "</td></tr></tbody>";
    return;
  }
  $("simCrisis").innerHTML = html + "</tbody>";
}

// 포트폴리오가 실제로 겪은 최악의 하락 구간 (시작일과 무관하게 항상 표시)
function renderSimWorst(I, R, idx) {
  var eps = worstEpisodes(R.days, idx.values, 3);
  if (!eps.length) {
    $("simWorst").innerHTML =
      '<tbody><tr><td style="text-align:left;color:var(--sub)">5% 이상 하락한 구간이 없습니다. 매우 조용한 기간이었습니다.</td></tr></tbody>';
    return;
  }
  var html = "<thead><tr><th>구간</th><th>내 포트폴리오</th>";
  R.symbols.forEach(function (sym, i) {
    html += "<th><i class='dot' style='background:" + CMP_COLORS[i % CMP_COLORS.length] + "'></i>" +
      cmpLabel(sym) + "</th>";
  });
  html += "<th>전고점 회복</th></tr></thead><tbody>";

  eps.forEach(function (ep, n) {
    var cells = R.symbols.map(function (sym, i) {
      var rr = windowReturn(R.days, R.values[i], ep.t1, ep.t2);
      return rr == null ? "<td>-</td>" : '<td class="' + pctCls(rr) + '">' + fmtPct(rr) + "</td>";
    });
    var days = Math.round((ep.t2 - ep.t1) / 86400000);
    html += "<tr><td style='text-align:left'>" + (n + 1) + "위 하락<br>" +
      "<small style='color:var(--sub)'>" + fmtDate(ep.t1) + " ~ " + fmtDate(ep.t2) + " (" + days + "일)</small></td>" +
      '<td class="' + pctCls(ep.dd) + '" style="font-weight:bold;background:#202a40">' + fmtPct(ep.dd) + "</td>" +
      cells.join("") +
      "<td>" + (ep.recovered ? fmtDate(ep.recovered)
        : ongoingStatusHtml(ep.peakV, ep.troughV, idx.values[idx.values.length - 1])) + "</td></tr>";
  });
  $("simWorst").innerHTML = html + "</tbody>";
}

function rebalLabel(m) {
  if (m === 0) return "리밸런싱 없음";
  if (m === 1) return "매월 리밸런싱";
  if (m === 3) return "분기 리밸런싱";
  if (m === 6) return "반기 리밸런싱";
  return "연 1회 리밸런싱";
}
