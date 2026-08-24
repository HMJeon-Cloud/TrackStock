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

/* B. 최고 상승일 제외 분석
   가장 많이 오른 N일을 놓쳤다면 최종 수익률이 어떻게 되는가 */
function topDaysImpact(rows, nList) {
  var rets = [];
  for (var i = 1; i < rows.length; i++) {
    rets.push({ i: i, r: rows[i].c / rows[i - 1].c - 1, t: rows[i].t });
  }
  if (rets.length < 30) return null;
  var total = rows[rows.length - 1].c / rows[0].c - 1;
  var order = rets.slice().sort(function (a, b) { return b.r - a.r; });

  var results = nList.map(function (N) {
    var excl = {};
    for (var k = 0; k < N && k < order.length; k++) excl[order[k].i] = 1;
    var v = 1;
    for (var m = 0; m < rets.length; m++) if (!excl[rets[m].i]) v *= (1 + rets[m].r);
    return { n: N, ret: v - 1 };
  });
  return { total: total, results: results, topDays: order.slice(0, 30) };
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
    return;
  }
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
    '<span class="badge">현재가<b>' + fmtPrice(pos.last.c) + "</b></span>" +
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

  var html = "<thead><tr><th>경우</th><th>최종 수익률</th><th>원래 대비</th><th>1,000만원이</th></tr></thead><tbody>";
  html += "<tr><td><b>전 기간 보유</b></td>" +
    '<td class="' + pctCls(t.total) + '" style="font-weight:bold">' + fmtPct(t.total) + "</td>" +
    "<td style='color:var(--sub)'>-</td>" +
    "<td><b>" + Math.round(10000000 * (1 + t.total)).toLocaleString("ko-KR") + "원</b></td></tr>";
  t.results.forEach(function (r) {
    var lost = r.ret - t.total;
    html += "<tr><td>최고 상승 <b>" + r.n + "일</b>을 놓쳤다면</td>" +
      '<td class="' + pctCls(r.ret) + '">' + fmtPct(r.ret) + "</td>" +
      '<td class="neg">' + fmtPct(lost) + "p</td>" +
      "<td>" + Math.round(10000000 * (1 + r.ret)).toLocaleString("ko-KR") + "원</td></tr>";
  });
  $("insTopDays").innerHTML = html + "</tbody>";

  // 최고 상승일 TOP 10 목록
  var lh = "<thead><tr><th>순위</th><th>날짜</th><th>하루 상승률</th><th>당시 상태</th></tr></thead><tbody>";
  for (var i = 0; i < 10 && i < t.topDays.length; i++) {
    var d = t.topDays[i];
    var bear = flags[d.i];
    lh += "<tr><td>" + (i + 1) + "</td><td>" + fmtDate(d.t) + "</td>" +
      '<td class="pos" style="font-weight:bold">' + fmtPct(d.r) + "</td>" +
      "<td style='text-align:left'>" + (bear
        ? '<span style="color:var(--up)">전고점 대비 10% 이상 하락 중</span>'
        : '<span style="color:var(--sub)">평상시</span>') + "</td></tr>";
  }
  $("insTopList").innerHTML = lh + "</tbody>";
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

  // 4) 최고 상승일
  if (top && top.results.length >= 2) {
    var r10 = top.results[1]; // 10일
    L.push("전 기간 보유 시 " + fmtPct(top.total) + "였지만, 가장 많이 오른 단 10일을 놓쳤다면 " +
      fmtPct(r10.ret) + "로 줄어듭니다. 그리고 그 10일 중 " + top.inBear10 +
      "일은 주가가 전고점 대비 10% 이상 빠져 있던, 가장 무서웠던 시기에 나왔습니다.");
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

/* ============================================================
   반례 대조군: 일본 니케이225
   "장기 보유하면 회복한다"가 시장 불문 법칙인지 확인하기 위한 장치.
   같은 계산식을 니케이 전체 기간에 적용해 나란히 보여준다.
   ============================================================ */
var JP_CACHE = null;

$("insCompareJP").onclick = function () {
  if (!state.rows || state.rows.length < 250) {
    $("insJPStatus").textContent = "먼저 개별 종목 탭에서 종목을 조회해 주세요.";
    return;
  }
  var btn = this;
  btn.disabled = true;
  $("insJPStatus").textContent = "니케이225 데이터 불러오는 중...";

  var p = JP_CACHE
    ? Promise.resolve(JP_CACHE)
    : fetch("/api/chart?symbol=" + encodeURIComponent("^N225") + "&range=max")
        .then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
            return j;
          });
        })
        .then(function (json) {
          JP_CACHE = parseChart(json).rows;
          return JP_CACHE;
        });

  p.then(function (jp) {
    renderJP(jp);
    $("insJPStatus").textContent = "";
    btn.disabled = false;
  }).catch(function (e) {
    $("insJPStatus").textContent = "불러오지 못했습니다: " + e.message;
    btn.disabled = false;
  });
};

function renderJP(jp) {
  var mine = state.rows;
  var myName = state.meta.shortName || state.meta.longName || state.symbol;
  var myYears = (mine[mine.length - 1].t - mine[0].t) / (365.25 * 86400000);
  var jpYears = (jp[jp.length - 1].t - jp[0].t) / (365.25 * 86400000);
  var candidates = [1, 2, 3, 5, 7, 10, 15, 20, 30];

  var html = "<thead><tr><th>보유기간</th><th>" + myName + " 손실 확률</th>" +
    "<th>니케이225 손실 확률</th><th>니케이 최악의 경우</th></tr></thead><tbody>";
  var rowCount = 0;
  candidates.forEach(function (y) {
    var a = y <= myYears - 0.5 ? holdingPeriodStats(mine, y) : null;
    var b = y <= jpYears - 0.5 ? holdingPeriodStats(jp, y) : null;
    if (!a && !b) return;
    rowCount++;
    function cell(s) {
      if (!s) return '<td style="color:var(--sub)">데이터 부족</td>';
      var alpha = Math.min(s.lossRate * 1.6, 0.45);
      return '<td style="background:rgba(255,91,91,' + alpha.toFixed(3) + ')"><b>' +
        (s.lossRate * 100).toFixed(0) + "%</b></td>";
    }
    html += "<tr><td><b>" + y + "년</b></td>" + cell(a) + cell(b) +
      (b ? '<td class="' + pctCls(b.min) + '">' + fmtPct(b.min) + "</td>"
         : '<td style="color:var(--sub)">-</td>') + "</tr>";
  });
  $("insJP").innerHTML = html + "</tbody>";

  // 니케이의 최대 낙폭과 회복 소요 기간을 사실로 제시
  var jpEps = drawdownEpisodes(jp, 0.10);
  var worst = null;
  for (var i = 0; i < jpEps.length; i++) if (!worst || jpEps[i].dd < worst.dd) worst = jpEps[i];
  var recTxt = "조회 시점까지도 회복하지 못했습니다";
  if (worst && worst.recoverI != null) {
    recTxt = "전고점 회복까지 <b>" +
      ((jp[worst.recoverI].t - jp[worst.peakI].t) / (365.25 * 86400000)).toFixed(1) + "년</b>이 걸렸습니다";
  }

  // 두 시장의 20년(또는 최장 공통) 손실 확률을 직접 대조
  var cmpLine = "";
  for (var k = candidates.length - 1; k >= 0; k--) {
    var y2 = candidates[k];
    var a2 = y2 <= myYears - 0.5 ? holdingPeriodStats(mine, y2) : null;
    var b2 = y2 <= jpYears - 0.5 ? holdingPeriodStats(jp, y2) : null;
    if (a2 && b2) {
      cmpLine = "<br>동일하게 <b>" + y2 + "년</b>을 보유했을 때 손실 확률은 " +
        myName + " <b>" + (a2.lossRate * 100).toFixed(0) + "%</b>, 니케이225 <b>" +
        (b2.lossRate * 100).toFixed(0) + "%</b>였습니다.";
      break;
    }
  }

  $("insJPNote").innerHTML =
    "니케이225 데이터 범위: " + fmtDate(jp[0].t) + " ~ " + fmtDate(jp[jp.length - 1].t) +
    " (" + jpYears.toFixed(0) + "년, " + jp.length.toLocaleString("ko-KR") + "일). " +
    "이 기간의 최대 낙폭은 <b>" + fmtPct(worst ? worst.dd : 0) + "</b>였고, " + recTxt + "." +
    cmpLine +
    "<br><b>주의:</b> Yahoo가 제공하는 니케이225 데이터는 1965년 전후부터 시작하며 " +
    "제공 범위가 바뀔 수 있습니다. 위 숫자는 실제로 받아온 구간 기준입니다." +
    (rowCount === 0 ? " 계산 가능한 보유기간이 없습니다." : "");
}
