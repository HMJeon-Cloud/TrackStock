"use strict";
/* ============================================================
   StockMind — 인사이트 모듈 (Phase 5)
   개별 종목 탭에 로드된 state.rows 를 그대로 사용한다.
   ============================================================ */

/* ================= 순수 계산 함수 ================= */

/* A. 보유기간별 결과 분포
   "아무 날에나 사서 N년 들고 있었다면?" 을 전 구간 롤링으로 계산 */
function holdingPeriodStats(rows, years) {
  var ms = years * 365.25 * 86400000;
  var n = rows.length;
  if (n < 2) return null;
  var rets = [], j = 0;
  for (var i = 0; i < n; i++) {
    var target = rows[i].t + ms;
    if (rows[n - 1].t < target) break;   // 남은 기간이 부족하면 종료
    if (j < i) j = i;
    while (j < n - 1 && rows[j].t < target) j++;
    rets.push(rows[j].c / rows[i].c - 1);
  }
  if (rets.length < 10) return null;
  var sorted = rets.slice().sort(function (a, b) { return a - b; });
  var loss = 0, sum = 0;
  for (var k = 0; k < rets.length; k++) {
    if (rets[k] < 0) loss++;
    sum += rets[k];
  }
  function pct(p) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; }
  return {
    years: years,
    n: rets.length,
    lossRate: loss / rets.length,
    avg: sum / rets.length,
    median: pct(0.5),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p10: pct(0.10),
    p90: pct(0.90)
  };
}

/* B. 최고 상승일 / 최악 하락일 제외 분석
   가장 많이 오른(또는 떨어진) N일이 빠지면 최종 수익률이 어떻게 되는가 */
function topDaysImpact(rows, nList) {
  var rets = [];
  for (var i = 1; i < rows.length; i++) {
    rets.push({ i: i, r: rows[i].c / rows[i - 1].c - 1, t: rows[i].t });
  }
  if (rets.length < 30) return null;
  var total = rows[rows.length - 1].c / rows[0].c - 1;
  var up = rets.slice().sort(function (a, b) { return b.r - a.r; });
  var down = rets.slice().sort(function (a, b) { return a.r - b.r; });

  function exclude(order, N) {
    var excl = {};
    for (var k = 0; k < N && k < order.length; k++) excl[order[k].i] = 1;
    var v = 1;
    for (var m = 0; m < rets.length; m++) if (!excl[rets[m].i]) v *= (1 + rets[m].r);
    return v - 1;
  }

  var results = nList.map(function (N) {
    return { n: N, ret: exclude(up, N), retNoWorst: exclude(down, N) };
  });
  return {
    total: total, results: results,
    topDays: up.slice(0, 30), worstDays: down.slice(0, 30)
  };
}

/* 급등일과 급락일이 시간적으로 얼마나 붙어 있는가 (변동성 군집)
   상위 N개 급등일 각각에 대해, 가장 가까운 급락일까지의 거래일 수를 센다 */
function volatilityCluster(topDays, worstDays, n, withinDays) {
  var near = 0, gaps = [];
  for (var a = 0; a < n && a < topDays.length; a++) {
    var best = null;
    for (var b = 0; b < n && b < worstDays.length; b++) {
      var gap = Math.abs(Math.round((topDays[a].t - worstDays[b].t) / 86400000));
      if (best === null || gap < best) best = gap;
    }
    if (best !== null) {
      gaps.push(best);
      if (best <= withinDays) near++;
    }
  }
  gaps.sort(function (x, y) { return x - y; });
  return {
    checked: gaps.length,
    near: near,
    withinDays: withinDays,
    medianGap: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null
  };
}

/* 각 시점이 '전고점 대비 threshold 이상 하락한 상태'였는지 표시 */
function inDrawdownFlags(rows, threshold) {
  var peak = rows[0].c, flags = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].c > peak) peak = rows[i].c;
    flags.push(rows[i].c / peak - 1 <= -threshold);
  }
  return flags;
}

/* C. 현재 위치: 전고점 대비 낙폭과 그 낙폭의 역대 순위 */
function currentPosition(rows, eps) {
  var last = rows[rows.length - 1];
  var runPeak = rows[0].c, runPeakT = rows[0].t;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].c >= runPeak) { runPeak = rows[i].c; runPeakT = rows[i].t; }
  }
  var curDd = last.c / runPeak - 1;

  // 종료된 낙폭들만 비교 대상으로 삼는다 (진행중인 건 자기 자신이므로 제외)
  var done = eps.filter(function (e) { return e.recoverI != null; });
  var deeper = 0;
  for (var k = 0; k < done.length; k++) if (done[k].dd < curDd) deeper++;

  // 회복 소요일 통계
  var recDays = done.map(function (e) {
    return Math.round((rows[e.recoverI].t - rows[e.troughI].t) / 86400000);
  }).sort(function (a, b) { return a - b; });
  var medianRec = recDays.length ? recDays[Math.floor(recDays.length / 2)] : null;

  // 역대 최고점에 샀다면 지금은?
  var peakAllI = 0;
  for (var p = 0; p < rows.length; p++) if (rows[p].c > rows[peakAllI].c) peakAllI = p;
  var fromPeak = last.c / rows[peakAllI].c - 1;

  return {
    last: last, peak: runPeak, peakT: runPeakT, dd: curDd,
    rank: deeper + 1, doneCount: done.length, totalEps: eps.length,
    medianRecoveryDays: medianRec,
    peakAllT: rows[peakAllI].t, peakAllPrice: rows[peakAllI].c, fromPeak: fromPeak
  };
}

/* ================= 렌더링 ================= */
var insightState = { built: false };

function renderInsight() {
  var box = $("insBody"), empty = $("insEmpty");
  if (!state.rows || state.rows.length < 250) {
    box.classList.add("hidden");
    empty.classList.remove("hidden");
    // 왜 비어 있는지 알 수 있게 상태를 함께 적는다
    var why;
    if (!state.rows) {
      why = "아직 조회한 종목이 없습니다.";
    } else {
      var r0 = state.rows[0], r1 = state.rows[state.rows.length - 1];
      var name = (state.meta && (state.meta.shortName || state.meta.longName)) || state.symbol;
      var sel = $("rangeSel") ? $("rangeSel").value : "";
      var spanDays = (r1.t - r0.t) / 86400000;
      var selDays = { "5y": 1826, "10y": 3652, "20y": 7305, "max": Infinity }[sel] || 3652;
      why = name + "(" + state.symbol + ")의 데이터가 " + fmtDate(r0.t) + " ~ " + fmtDate(r1.t) + ", " +
        state.rows.length + "거래일뿐이라 통계를 낼 수 없습니다 (최소 250거래일 필요). ";
      // 요청한 기간보다 훨씬 짧게 왔다면 상장일이 최근인 것이다
      why += spanDays < selDays * 0.9
        ? "선택한 기간(" + sel + ")보다 데이터가 짧은 것은 이 종목이 " + fmtDate(r0.t) + " 무렵 상장되어 그 이전 기록이 없기 때문입니다. 기간을 늘려도 달라지지 않으며, 1년 이상 거래된 뒤에 다시 보실 수 있습니다."
        : "기간을 늘려 다시 조회해 주세요.";
    }
    var el = $("insEmptyWhy");
    if (el) el.textContent = why;
    return;
  }
  try {
    renderInsightBody(box, empty);
  } catch (e) {
    // 조용히 실패하지 않도록 화면에 오류를 드러낸다
    box.classList.add("hidden");
    empty.classList.remove("hidden");
    var el2 = $("insEmptyWhy");
    if (el2) el2.textContent = "인사이트 계산 중 오류: " + (e && e.message) + " — 이 문구를 개발자에게 전달해 주세요.";
    if (window.console) console.error("[인사이트 오류]", e);
  }
}

function renderInsightBody(box, empty) {
  empty.classList.add("hidden");
  box.classList.remove("hidden");

  var rows = state.rows;
  var eps = state.eps || drawdownEpisodes(rows, 0.10);
  var name = state.meta.shortName || state.meta.longName || state.symbol;
  var totalYears = (rows[rows.length - 1].t - rows[0].t) / (365.25 * 86400000);

  $("insTitle").textContent = name + " (" + state.symbol + ") · " +
    fmtDate(rows[0].t) + " ~ " + fmtDate(rows[rows.length - 1].t) +
    " · " + totalYears.toFixed(1) + "년 · " + state.displayCur + " 기준";

  var pos = currentPosition(rows, eps);
  renderPosition(pos, eps);
  var hold = renderHolding(rows, totalYears);
  var top = renderTopDays(rows);
  renderSentences(name, pos, hold, top, eps, totalYears);
}

/* --- C. 현재 위치 --- */
function renderPosition(pos, eps) {
  var atHigh = pos.dd > -0.005;
  $("insPosBadges").innerHTML =
    '<span class="badge" title="장중 실시간이 아니라 확정된 최근 거래일 종가입니다">최근 종가<b>' +
      fmtPrice(pos.last.c) + ' <small style="color:var(--sub)">' + fmtDate(pos.last.t) + "</small></b></span>" +
    '<span class="badge">기간 내 최고가<b>' + fmtPrice(pos.peak) +
      ' <span style="font-size:11px;color:var(--sub)">' + fmtDate(pos.peakT) + "</span></b></span>" +
    '<span class="badge">전고점 대비<b class="' + (atHigh ? "" : "neg") + '">' +
      (atHigh ? "신고가 부근" : fmtPct(pos.dd)) + "</b></span>" +
    (atHigh ? ""
      : '<span class="badge">역대 낙폭 순위<b>' + pos.rank + "위 / " + (pos.doneCount + 1) + "회</b></span>") +
    '<span class="badge">10%+ 하락 경험<b>' + pos.totalEps + "회 중 " + pos.doneCount + "회 회복</b></span>" +
    (pos.medianRecoveryDays != null
      ? '<span class="badge">저점→전고점 회복(중앙값)<b>' + pos.medianRecoveryDays + "일</b></span>" : "");
}

/* --- A. 보유기간별 손실 확률 --- */
function renderHolding(rows, totalYears) {
  var candidates = [1, 2, 3, 5, 7, 10, 15, 20];
  var stats = [];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] > totalYears - 0.5) break;
    var s = holdingPeriodStats(rows, candidates[i]);
    if (s) stats.push(s);
  }
  if (!stats.length) {
    $("insHolding").innerHTML =
      '<tbody><tr><td style="text-align:left;color:var(--sub)">기간이 짧아 계산할 수 없습니다. 조회 기간을 늘려 주세요.</td></tr></tbody>';
    return [];
  }

  var html = "<thead><tr><th>보유기간</th><th>손실 확률</th><th>중앙값 수익</th>" +
    "<th>최악의 경우</th><th>하위 10%</th><th>상위 10%</th><th>최선의 경우</th><th>표본</th></tr></thead><tbody>";
  stats.forEach(function (s) {
    // 손실 확률에 따라 배경색 농도를 달리해 한눈에 흐름이 보이게 한다
    var alpha = Math.min(s.lossRate * 1.6, 0.45);
    html += "<tr><td><b>" + s.years + "년</b></td>" +
      "<td style='background:rgba(255,91,91," + alpha.toFixed(3) + ");font-weight:bold'>" +
        (s.lossRate * 100).toFixed(1) + "%</td>" +
      '<td class="' + pctCls(s.median) + '">' + fmtPct(s.median) + "</td>" +
      '<td class="neg">' + fmtPct(s.min) + "</td>" +
      '<td class="' + pctCls(s.p10) + '">' + fmtPct(s.p10) + "</td>" +
      '<td class="' + pctCls(s.p90) + '">' + fmtPct(s.p90) + "</td>" +
      '<td class="pos">' + fmtPct(s.max) + "</td>" +
      "<td style='color:var(--sub)'>" + s.n.toLocaleString() + "개</td></tr>";
  });
  $("insHolding").innerHTML = html + "</tbody>";

  // 손실이 한 번도 없었던 경우 = 조회 기간이 예외적 상승기와 겹쳤을 가능성
  var allSafe = stats.filter(function (s) { return s.lossRate === 0; });
  var msg = "";
  if (allSafe.length && allSafe.length === stats.length) {
    msg = "<b style='color:var(--accent)'>주의:</b> 모든 보유기간에서 손실 사례가 <b>한 번도</b> 나오지 않았습니다. " +
      "이는 이 종목이 안전하다는 뜻이 아니라, <b>조회한 " + totalYears.toFixed(1) +
      "년이 거의 전부 상승 구간이었다</b>는 뜻입니다. 기간을 <b>전체</b>로 늘려 다시 보시고, " +
      "그래도 같다면 이 종목의 역사 자체가 짧다는 점을 감안하세요.";
  } else if (allSafe.length) {
    var firstSafe = allSafe[0];
    msg = "<b>" + firstSafe.years + "년</b> 이상 보유한 경우에는 이 기간 안에서 손실로 끝난 사례가 없었습니다. " +
      "다만 이는 <b>조회한 " + totalYears.toFixed(1) + "년 안에서만</b> 성립하는 사실이며, " +
      "기간을 바꾸면 결과도 달라집니다.";
  }
  // 최장 보유기간의 최악값이 크게 마이너스면 함께 경고
  var longest = stats[stats.length - 1];
  if (longest && longest.min < -0.2) {
    msg += (msg ? "<br>" : "") + "<b>" + longest.years + "년</b>을 보유하고도 최악의 경우 <b class='neg'>" +
      fmtPct(longest.min) + "</b>였던 시점이 있습니다. 장기 보유가 손실을 없애주지는 않습니다.";
  }
  $("insHoldNote").innerHTML = msg;
  return stats;
}

/* --- B. 최고 상승일 제외 --- */
function renderTopDays(rows) {
  var t = topDaysImpact(rows, [5, 10, 20, 30]);
  if (!t) {
    $("insTopDays").innerHTML =
      '<tbody><tr><td style="text-align:left;color:var(--sub)">데이터가 부족합니다.</td></tr></tbody>';
    return null;
  }
  var flags = inDrawdownFlags(rows, 0.10);
  var inBear = 0;
  for (var k = 0; k < 10 && k < t.topDays.length; k++) {
    if (flags[t.topDays[k].i]) inBear++;
  }
  t.inBear10 = inBear;

  var base = 10000000 * (1 + t.total);
  var html = "<thead><tr><th>경우</th><th>최종 수익률</th><th>1,000만원이</th>" +
    "<th>전부 보유 대비 자산</th></tr></thead><tbody>";
  html += "<tr><td><b>전 기간 그대로 보유</b></td>" +
    '<td class="' + pctCls(t.total) + '" style="font-weight:bold">' + fmtPct(t.total) + "</td>" +
    "<td><b>" + Math.round(base).toLocaleString("ko-KR") + "원</b></td>" +
    "<td style='color:var(--sub)'>기준</td></tr>";
  t.results.forEach(function (r) {
    var amt = 10000000 * (1 + r.ret);
    var ratio = base !== 0 ? amt / base - 1 : 0;
    html += "<tr><td>최고 <b>상승</b> " + r.n + "일을 놓쳤다면</td>" +
      '<td class="' + pctCls(r.ret) + '">' + fmtPct(r.ret) + "</td>" +
      "<td>" + Math.round(amt).toLocaleString("ko-KR") + "원</td>" +
      '<td class="neg" style="font-weight:bold">' + fmtPct(ratio) + "</td></tr>";
  });
  // 정반대 계산: 최악의 하락일을 피했다면
  t.results.forEach(function (r) {
    var amt2 = 10000000 * (1 + r.retNoWorst);
    var ratio2 = base !== 0 ? amt2 / base - 1 : 0;
    html += "<tr style='background:#141b29'><td>최악 <b>하락</b> " + r.n + "일을 피했다면</td>" +
      '<td class="' + pctCls(r.retNoWorst) + '">' + fmtPct(r.retNoWorst) + "</td>" +
      "<td>" + Math.round(amt2).toLocaleString("ko-KR") + "원</td>" +
      '<td class="pos" style="font-weight:bold">' + fmtPct(ratio2) + "</td></tr>";
  });
  $("insTopDays").innerHTML = html + "</tbody>";

  // 최고 상승일 TOP 10
  var lh = "<thead><tr><th>순위</th><th>날짜</th><th>하루 상승률</th><th>당시 상태</th></tr></thead><tbody>";
  for (var i = 0; i < 10 && i < t.topDays.length; i++) {
    var d = t.topDays[i];
    lh += "<tr><td>" + (i + 1) + "</td><td>" + fmtDate(d.t) + "</td>" +
      '<td class="pos" style="font-weight:bold">' + fmtPct(d.r) + "</td>" +
      "<td style='text-align:left'>" + (flags[d.i]
        ? '<span style="color:var(--up)">전고점 대비 10% 이상 하락 중</span>'
        : '<span style="color:var(--sub)">평상시</span>') + "</td></tr>";
  }
  $("insTopList").innerHTML = lh + "</tbody>";

  // 최악 하락일 TOP 10
  var wh = "<thead><tr><th>순위</th><th>날짜</th><th>하루 하락률</th><th>당시 상태</th>" +
    "<th>가장 가까운 급등일까지</th></tr></thead><tbody>";
  for (var j = 0; j < 10 && j < t.worstDays.length; j++) {
    var w = t.worstDays[j];
    var minGap = null, gapDate = null;
    for (var k = 0; k < 10 && k < t.topDays.length; k++) {
      var g = Math.abs(Math.round((w.t - t.topDays[k].t) / 86400000));
      if (minGap === null || g < minGap) { minGap = g; gapDate = t.topDays[k].t; }
    }
    wh += "<tr><td>" + (j + 1) + "</td><td>" + fmtDate(w.t) + "</td>" +
      '<td class="neg" style="font-weight:bold">' + fmtPct(w.r) + "</td>" +
      "<td style='text-align:left'>" + (flags[w.i]
        ? '<span style="color:var(--up)">전고점 대비 10% 이상 하락 중</span>'
        : '<span style="color:var(--sub)">평상시</span>') + "</td>" +
      "<td style='text-align:left'>" + (minGap === null ? "-"
        : (minGap === 0 ? '<b style="color:var(--accent)">같은 날 아님(별개일)</b>'
           : '<b style="color:' + (minGap <= 30 ? "var(--accent)" : "var(--sub)") + '">' +
             minGap + "일</b> <small style='color:var(--sub)'>(" + fmtDate(gapDate) + ")</small>")) +
      "</td></tr>";
  }
  $("insWorstList").innerHTML = wh + "</tbody>";

  // 변동성 군집 요약
  var cl = volatilityCluster(t.topDays, t.worstDays, 10, 30);
  t.cluster = cl;
  $("insCluster").innerHTML =
    "최고 상승일 10일 중 <b style='color:var(--accent)'>" + cl.near + "일</b>이 " +
    "최악의 하락일 10일과 <b>" + cl.withinDays + "일 이내</b>에 붙어 있습니다" +
    (cl.medianGap != null ? " (간격 중앙값 <b>" + cl.medianGap + "일</b>)" : "") + ". " +
    "폭등과 폭락은 <b>같은 국면에서 번갈아 나옵니다.</b> " +
    "이것이 \"무서울 때 잠깐 피했다가 돌아오기\"가 실제로는 매우 어려운 이유입니다.";

  return t;
}

/* --- 인사이트 문장 자동 생성 --- */
function renderSentences(name, pos, hold, top, eps, totalYears) {
  var L = [];
  var period = fmtDate(state.rows[0].t) + "~" + fmtDate(state.rows[state.rows.length - 1].t);

  // 1) 현재 위치
  if (pos.dd <= -0.005) {
    L.push(name + "은(는) 지금 전고점 " + fmtPrice(pos.peak) + "(" + fmtDate(pos.peakT) + ") 대비 " +
      fmtPct(pos.dd) + " 아래에 있습니다. 이 기간에 있었던 " + (pos.doneCount + 1) +
      "번의 10% 이상 하락 중 " + pos.rank + "번째로 깊은 낙폭입니다.");
  } else {
    L.push(name + "은(는) 지금 기간 내 신고가 부근에 있습니다.");
  }
  if (pos.doneCount > 0) {
    L.push("지난 " + totalYears.toFixed(0) + "년간 10% 이상 하락은 " + pos.totalEps + "번 있었고, 그중 " +
      pos.doneCount + "번은 전고점을 회복했습니다" +
      (pos.medianRecoveryDays != null ? " (저점에서 회복까지 중앙값 " + pos.medianRecoveryDays + "일)" : "") + ".");
  }

  // 2) 최악의 타이밍
  L.push("역대 최고점이었던 " + fmtDate(pos.peakAllT) + "(" + fmtPrice(pos.peakAllPrice) +
    ")에 샀더라도, 팔지 않고 지금까지 들고 있었다면 " + fmtPct(pos.fromPeak) + "입니다.");

  // 3) 보유기간별 손실 확률
  if (hold && hold.length) {
    var parts = hold.map(function (s) {
      return s.years + "년 " + (s.lossRate * 100).toFixed(0) + "%";
    }).join(", ");
    L.push("이 기간 중 아무 날에나 샀다고 가정하면, 보유기간별 손실 확률은 " + parts + "였습니다.");
    var first = hold[0], last = hold[hold.length - 1];
    if (last.lossRate < first.lossRate) {
      L.push("같은 종목이라도 " + first.years + "년 보유 시 손실 확률이 " +
        (first.lossRate * 100).toFixed(0) + "%인 반면 " + last.years + "년 보유 시 " +
        (last.lossRate * 100).toFixed(0) + "%로 낮아졌습니다. 언제 샀는지보다 얼마나 오래 들고 있었는지가 결과를 더 크게 갈랐습니다.");
    } else if (last.lossRate > first.lossRate) {
      L.push("주의: 이 종목은 보유기간을 늘려도 손실 확률이 낮아지지 않았습니다(" +
        first.years + "년 " + (first.lossRate * 100).toFixed(0) + "% → " +
        last.years + "년 " + (last.lossRate * 100).toFixed(0) + "%). 장기 보유가 항상 해답은 아니라는 사례입니다.");
    }
  }

  // 4) 최고 상승일 — 반대편 계산과 군집 사실을 반드시 함께 낸다
  if (top && top.results.length >= 2) {
    var r10 = top.results[1]; // 10일
    L.push("전 기간 보유 시 " + fmtPct(top.total) + "였지만, 가장 많이 오른 단 10일을 놓쳤다면 " +
      fmtPct(r10.ret) + "로 줄어듭니다. 그중 " + top.inBear10 +
      "일은 주가가 전고점 대비 10% 이상 빠져 있던, 가장 무서웠던 시기에 나왔습니다.");
    L.push("다만 반대 계산도 성립합니다. 최악의 하락 10일을 피했다면 " + fmtPct(r10.retNoWorst) +
      "가 됩니다. 그래서 이 수치는 \"타이밍이 무의미하다\"는 근거가 되지 못합니다.");
    if (top.cluster && top.cluster.checked) {
      L.push("실제 문제는 둘이 붙어 있다는 점입니다. 최고 상승일 10일 중 " + top.cluster.near +
        "일이 최악의 하락일 10일과 " + top.cluster.withinDays + "일 이내에 몰려 있었습니다" +
        (top.cluster.medianGap != null ? " (간격 중앙값 " + top.cluster.medianGap + "일)" : "") +
        ". 급락만 피하고 급등만 잡는 것은 이 간격 때문에 실무적으로 매우 어렵습니다.");
    }
  }

  var html = L.map(function (s) { return "<li>" + s + "</li>"; }).join("");
  $("insSentences").innerHTML = "<ul>" + html + "</ul>";
  $("insCopySrc").value = "[" + name + " · " + period + " · " + state.displayCur + " 기준]\n" +
    L.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n") +
    "\n\n※ 과거 데이터이며 미래를 보장하지 않습니다. 상장폐지된 종목은 애초에 조회 대상에 없으므로(생존 편향) 실제보다 낙관적으로 보일 수 있습니다.";
}

$("insCopy").onclick = function () {
  var ta = $("insCopySrc");
  ta.classList.remove("hidden");
  ta.select();
  var ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  if (!ok && navigator.clipboard) {
    navigator.clipboard.writeText(ta.value).then(function () {
      $("insCopyMsg").textContent = "복사했습니다.";
    });
  } else {
    $("insCopyMsg").textContent = ok ? "복사했습니다." : "복사에 실패했습니다. 아래 상자에서 직접 선택해 주세요.";
  }
  if (ok) ta.classList.add("hidden");
  setTimeout(function () { $("insCopyMsg").textContent = ""; }, 3000);
};
