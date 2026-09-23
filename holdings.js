"use strict";
/* ============================================================
   StockMind — 내 보유 현황
   매수·매도를 건별로 기록하고, 종목별 평단가·손익·비중과
   포트폴리오 전체의 원금 대비 평가금액 흐름을 계산한다.
   - 평단가: 이동평균법 (국내 증권사와 같은 방식. 매도해도 남은 수량의 평단은 그대로)
   - 해외 자산: 매수일 환율로 원화 원금, 최근 환율로 원화 평가금액 → 환차손익 포함
   - 저장: localStorage "stockmind.holdings" (클라우드 저장을 켜면 함께 동기화)
   ============================================================ */

var HOLD_KEY = "stockmind.holdings";
var DAY_MS = 86400000;

/* ================= 순수 계산 (테스트 대상) ================= */

/* rows(오름차순 t)에서 그날 또는 직전 거래일의 종가 */
function closeOn(rows, t) {
  if (!rows || !rows.length) return null;
  if (t < rows[0].t) return rows[0].c;
  var lo = 0, hi = rows.length - 1;
  if (t >= rows[hi].t) return rows[hi].c;
  while (lo < hi - 1) {
    var mid = (lo + hi) >> 1;
    if (rows[mid].t <= t) lo = mid; else hi = mid;
  }
  return rows[lo].c;
}

function dateToMs(d) {            // "2024-03-15" → 그날 00:00 UTC (일봉 타임스탬프와 같은 기준)
  var p = String(d).split("-");
  return Date.UTC(+p[0], +p[1] - 1, +p[2]);
}
function msToDate(t) { return new Date(t).toISOString().slice(0, 10); }

/* 한 종목의 거래 목록 → 현재 포지션 (이동평균법)
   lots: [{d, side:"buy"|"sell", q, p, fx}] (p는 현지 통화, fx는 원화 환산 배율 · 원화 자산은 1) */
function positionFromLots(lots) {
  var sorted = lots.slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
  var qty = 0, costN = 0, costK = 0, realizedK = 0, investedK = 0, firstBuy = null, warn = null;
  for (var i = 0; i < sorted.length; i++) {
    var L = sorted[i], fx = L.fx || 1;
    if (L.side === "sell") {
      if (qty <= 0) { warn = L.d + " 매도: 보유 수량이 없습니다"; continue; }
      var q = L.q;
      if (q > qty + 1e-9) { warn = L.d + " 매도 수량이 보유 수량보다 많아 " + qty + "주로 처리했습니다"; q = qty; }
      var avgN = costN / qty, avgK = costK / qty;
      realizedK += q * (L.p * fx - avgK);
      qty -= q; costN -= q * avgN; costK -= q * avgK;
      if (qty < 1e-9) { qty = 0; costN = 0; costK = 0; }
    } else {
      if (!firstBuy) firstBuy = L.d;
      qty += L.q; costN += L.q * L.p; costK += L.q * L.p * fx;
      investedK += L.q * L.p * fx;
    }
  }
  return {
    qty: qty, costN: costN, costK: costK,
    avgN: qty > 0 ? costN / qty : null,
    realizedK: realizedK, investedK: investedK,
    firstBuy: firstBuy, warn: warn
  };
}

/* 연환산 수익률(XIRR): 날짜가 제각각인 입출금에 대한 내부수익률.
   flows: [{t, v}] (투입은 음수, 회수·현재 평가는 양수) */
function xirr(flows) {
  if (flows.length < 2) return null;
  var t0 = flows[0].t;
  flows.forEach(function (f) { if (f.t < t0) t0 = f.t; });
  var hasNeg = flows.some(function (f) { return f.v < 0; });
  var hasPos = flows.some(function (f) { return f.v > 0; });
  if (!hasNeg || !hasPos) return null;
  function npv(r) {
    var s = 0;
    for (var i = 0; i < flows.length; i++) s += flows[i].v / Math.pow(1 + r, (flows[i].t - t0) / (365.25 * DAY_MS));
    return s;
  }
  var lo = -0.9999, hi = 10, flo = npv(lo), fhi = npv(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (var k = 0; k < 200; k++) {
    var mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/* 날짜별 포트폴리오 흐름: 원금(남은 매수원가)과 평가금액.
   bySym: {sym: {lots, rows, krw}}, fx: 환율 시계열(없으면 해외 자산도 1배) */
function portfolioTimeline(bySym, fx) {
  var syms = Object.keys(bySym);
  if (!syms.length) return [];
  var start = Infinity;
  syms.forEach(function (s) {
    bySym[s].lots.forEach(function (L) { var t = dateToMs(L.d); if (t < start) start = t; });
  });
  // 모든 종목의 거래일을 합친 달력 (국내·해외 휴장일이 달라도 빠짐없이)
  var daySet = {};
  syms.forEach(function (s) {
    (bySym[s].rows || []).forEach(function (r) { if (r.t >= start) daySet[Math.floor(r.t / DAY_MS)] = 1; });
  });
  var days = Object.keys(daySet).map(Number).sort(function (a, b) { return a - b; });
  var todayD = Math.floor(Date.now() / DAY_MS);

  // 종목별 거래를 날짜순으로 두고, 달력을 따라가며 누적
  var cursor = {};
  syms.forEach(function (s) {
    cursor[s] = {
      lots: bySym[s].lots.slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }),
      i: 0, qty: 0, costK: 0
    };
  });
  var out = [];
  days.forEach(function (d) {
    if (d > todayD) return;
    var t = d * DAY_MS, val = 0, cost = 0;
    syms.forEach(function (s) {
      var c = cursor[s], info = bySym[s];
      while (c.i < c.lots.length && Math.floor(dateToMs(c.lots[c.i].d) / DAY_MS) <= d) {
        var L = c.lots[c.i++], lfx = L.fx || 1;
        if (L.side === "sell") {
          if (c.qty > 0) {
            var q = Math.min(L.q, c.qty), avgK = c.costK / c.qty;
            c.qty -= q; c.costK -= q * avgK;
            if (c.qty < 1e-9) { c.qty = 0; c.costK = 0; }
          }
        } else { c.qty += L.q; c.costK += L.q * L.p * lfx; }
      }
      if (c.qty > 0) {
        var px = closeOn(info.rows, t + DAY_MS - 1);
        var fxNow = info.krw ? 1 : (fx ? fxAt(fx, t) : 1);
        val += c.qty * px * fxNow;
        cost += c.costK;
      }
    });
    if (cost > 0) out.push({ t: t, value: val, cost: cost });
  });
  return out;
}

/* ================= 저장 ================= */
function loadHoldings() {
  try {
    var j = JSON.parse(localStorage.getItem(HOLD_KEY) || "null");
    if (j && Array.isArray(j.lots)) return j;
  } catch (e) {}
  return { v: 1, updatedAt: null, lots: [] };
}
function saveHoldings(h) {
  h.updatedAt = new Date().toISOString();
  try { localStorage.setItem(HOLD_KEY, JSON.stringify(h)); } catch (e) {}
  if (typeof cloudDirty === "function") cloudDirty();
}
function tidyLot(L) {
  L.q = +(+L.q).toPrecision(10);
  L.p = +(+L.p).toPrecision(8);
  L.fx = +(+L.fx).toFixed(2);
  return L;
}
function newLotId() { return "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* 원화 자산 여부: 국내 상장·국내 지수는 원화, 나머지는 데이터의 통화를 따른다 */
function isKrwSymbol(sym, meta) {
  if (meta && meta.currency) return meta.currency === "KRW";
  return /\.(KS|KQ)$/.test(sym) || sym === "^KS11" || sym === "^KQ11";
}

/* ================= 화면 ================= */
var hState = { series: {}, meta: {}, fx: null, chart: null, open: {}, loading: false, lastCalc: null };

function setHoldStatus(msg, isErr) {
  var el = $("hStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isErr ? "var(--up)" : "var(--sub)";
}

/* 필요한 종목 시세와 환율을 모은다 (이미 받은 건 다시 받지 않음) */
function ensureHoldData(syms) {
  var need = syms.filter(function (s) { return !hState.series[s]; });
  var needFx = !hState.fx && syms.some(function (s) { return !isKrwSymbol(s, hState.meta[s]); });
  if (!need.length && !needFx) return Promise.resolve();
  setHoldStatus("시세 불러오는 중... (" + need.length + "종목)");
  var jobs = need.map(function (s) {
    return getChartData(s, "max").then(function (p) {
      hState.series[s] = p.rows;
      hState.meta[s] = p.meta || {};
    }).catch(function () { hState.series[s] = []; });
  });
  if (needFx || need.some(function (s) { return !isKrwSymbol(s); })) {
    jobs.push(loadFx("max").then(function (fx) { hState.fx = fx; }).catch(function () {}));
  }
  return Promise.all(jobs).then(function () { setHoldStatus(""); });
}

function groupLots(lots) {
  var g = {};
  lots.forEach(function (L) { (g[L.s] = g[L.s] || []).push(L); });
  return g;
}

function renderHoldings() {
  var H = loadHoldings();
  var box = $("hBody");
  if (!box) return;
  if (!H.lots.length) {
    box.innerHTML = '<div class="emptyCard" style="box-shadow:none;background:var(--soft);padding:28px 16px">' +
      '<div style="font-size:34px;margin-bottom:8px">💼</div><b style="color:var(--txt);font-size:16px">아직 기록이 없어요</b>' +
      '<div style="margin:6px 0 14px;font-size:13px">산 날짜와 수량만 넣으면 평단가·수익률을 계산해 드려요</div>' +
      '<button class="primary" onclick="openHoldForm()">＋ 첫 기록 추가하기</button></div>';
    $("hSummary").innerHTML = "";
    $("hChartWrap").classList.add("hidden");
    $("hInsight").innerHTML = "";
    $("hTable").innerHTML = "";
    return;
  }
  var groups = groupLots(H.lots);
  var syms = Object.keys(groups);
  ensureHoldData(syms).then(function () { renderHoldingsBody(H, groups, syms); });
}

function renderHoldingsBody(H, groups, syms) {
  var fx = hState.fx;
  var fxNow = fx ? fx.rates[fx.rates.length - 1] : null;
  var list = [], totalCost = 0, totalVal = 0, totalReal = 0, totalInvested = 0, flows = [];
  var missingFx = false;

  syms.forEach(function (s) {
    var rows = hState.series[s] || [];
    var krw = isKrwSymbol(s, hState.meta[s]);
    if (!krw && !fxNow) missingFx = true;
    var pos = positionFromLots(groups[s]);
    var last = rows.length ? rows[rows.length - 1] : null;
    var rate = krw ? 1 : (fxNow || 1);
    var val = last ? pos.qty * last.c * rate : 0;

    // 이 종목의 과거 최대 낙폭 (조회 가능한 전 기간)
    var mdd = 0;
    if (rows.length > 30 && typeof drawdownEpisodes === "function") {
      drawdownEpisodes(rows, 0.05).forEach(function (e) { if (e.dd < mdd) mdd = e.dd; });
    }
    var peak = 0;
    rows.forEach(function (r) { if (r.c > peak) peak = r.c; });

    groups[s].forEach(function (L) {
      var v = L.q * L.p * (L.fx || 1);
      flows.push({ t: dateToMs(L.d), v: L.side === "sell" ? v : -v });
    });

    list.push({
      s: s, krw: krw, pos: pos, last: last, val: val, mdd: mdd,
      vsPeak: last && peak ? last.c / peak - 1 : null,
      pnl: val - pos.costK, ret: pos.costK > 0 ? val / pos.costK - 1 : null,
      retN: pos.avgN && last ? last.c / pos.avgN - 1 : null
    });
    totalCost += pos.costK; totalVal += val; totalReal += pos.realizedK; totalInvested += pos.investedK;
  });
  if (totalVal > 0) flows.push({ t: Date.now(), v: totalVal });
  list.sort(function (a, b) { return b.val - a.val; });

  var bySym = {};
  syms.forEach(function (s) {
    bySym[s] = { lots: groups[s], rows: hState.series[s] || [], krw: isKrwSymbol(s, hState.meta[s]) };
  });
  var tl = portfolioTimeline(bySym, fx);
  var worst = null;
  tl.forEach(function (p) { var r = p.value / p.cost - 1; if (!worst || r < worst.r) worst = { r: r, t: p.t }; });

  var firstT = Infinity;
  H.lots.forEach(function (L) { var t = dateToMs(L.d); if (t < firstT) firstT = t; });
  var spanDays = (Date.now() - firstT) / DAY_MS;
  var irr = spanDays >= 365 ? xirr(flows) : null;
  hState.lastCalc = { list: list, totalVal: totalVal };

  // ── 요약
  var pnl = totalVal - totalCost, ret = totalCost > 0 ? pnl / totalCost : 0;
  $("hSummary").innerHTML =
    badge("투입 원금 (보유분)", fmtKrw(totalCost)) +
    badge("평가금액", fmtKrw(totalVal)) +
    badge("평가손익", '<span class="' + pctCls(pnl) + '">' + signKrw(pnl) + "</span>") +
    badge("수익률", '<span class="' + pctCls(ret) + '">' + fmtPct(ret) + "</span>") +
    badge("연환산 (XIRR)", irr == null
      ? '<small style="font-size:11px;color:var(--sub)">' + (spanDays < 365 ? "1년 미만은 연환산 안 함" : "계산 불가") + "</small>"
      : '<span class="' + pctCls(irr) + '">' + fmtPct(irr) + "</span>",
      "매수 시점과 금액이 제각각인 투자를 '연 몇 % 복리'로 환산한 값입니다. 적립식·분할매수의 실제 성과를 볼 때는 단순 수익률보다 이 값이 정확합니다.") +
    (Math.abs(totalReal) > 0.5 ? badge("실현손익 (매도분)", '<span class="' + pctCls(totalReal) + '">' + signKrw(totalReal) + "</span>") : "");

  // ── 종목별 표
  var html = "<thead><tr><th>종목</th><th>보유 수량</th><th>평단가</th><th>최근 종가</th><th>원금</th><th>평가금액</th>" +
    "<th>손익</th><th>비중</th><th>첫 매수</th><th></th></tr></thead><tbody>";
  list.forEach(function (x) {
    var cur = x.krw ? "원" : " " + ((hState.meta[x.s] && hState.meta[x.s].currency) || "USD");
    var w = totalVal > 0 ? x.val / totalVal : 0;
    var days = x.pos.firstBuy ? Math.round((Date.now() - dateToMs(x.pos.firstBuy)) / DAY_MS) : null;
    var closed = x.pos.qty <= 0;
    html += '<tr' + (closed ? ' style="opacity:.55"' : "") + '><td style="text-align:left"><b>' + cmpLabel(x.s) + "</b><br><small style='color:var(--sub)'>" + x.s +
      (x.pos.warn ? " · <span style='color:var(--up)'>⚠</span>" : "") + "</small></td>" +
      "<td>" + (closed ? "전량 매도" : fmtQty(x.pos.qty)) + "</td>" +
      "<td>" + (x.pos.avgN ? fmtPrice(x.pos.avgN) + cur : "-") + "</td>" +
      "<td>" + (x.last ? fmtPrice(x.last.c) + cur + "<br><small style='color:var(--sub)'>" + fmtDate(x.last.t) + "</small>" : "-") + "</td>" +
      "<td>" + fmtKrw(x.pos.costK) + "</td>" +
      "<td><b>" + fmtKrw(x.val) + "</b></td>" +
      '<td class="' + pctCls(x.pnl) + '">' + signKrw(x.pnl) + "<br><b>" + (x.ret == null ? "-" : fmtPct(x.ret)) + "</b>" +
        (!x.krw && x.retN != null && x.ret != null && Math.abs(x.ret - x.retN) > 0.005
          ? "<br><small style='color:var(--sub)' title='현지 통화 기준 수익률. 원화 수익률과의 차이가 환율 효과입니다'>현지 " + fmtPct(x.retN) + "</small>" : "") + "</td>" +
      "<td>" + (w * 100).toFixed(1) + "%<div class='hBar'><i style='width:" + Math.min(100, w * 100).toFixed(1) + "%'></i></div></td>" +
      "<td>" + (x.pos.firstBuy ? x.pos.firstBuy.replace(/-/g, ".") + "<br><small style='color:var(--sub)'>" + fmtDays(days) + "</small>" : "-") + "</td>" +
      "<td style='white-space:nowrap'><button class='chip' data-hopen='" + x.s + "'>거래 " + groups[x.s].length + "건</button> " +
      "<button class='chip' data-hgo='" + x.s + "'>분석</button></td></tr>";
    if (hState.open[x.s]) html += lotRowsHtml(x.s, groups[x.s], x.krw);
  });
  $("hTable").innerHTML = html + "</tbody>";
  bindHoldTable();

  // ── 멘탈 방어 문장
  var lines = [];
  if (worst && worst.r < 0) {
    lines.push("보유 기간 중 가장 나빴던 날은 <b>" + fmtDate(worst.t) + "</b>로, 그날 평가손익률이 <b class='neg'>" + fmtPct(worst.r) +
      "</b>였습니다. 지금은 <b class='" + pctCls(ret) + "'>" + fmtPct(ret) + "</b>입니다. 그 구간을 이미 한 번 버텼다는 기록입니다.");
  } else if (worst) {
    lines.push("기록된 보유 기간 동안 원금 아래로 내려간 날이 없었습니다. 아직 큰 하락장을 이 구성으로 겪어보지 않았다는 뜻이기도 합니다.");
  }
  var scenario = 0;
  list.forEach(function (x) { scenario += x.val * (1 + x.mdd); });
  if (totalVal > 0 && scenario < totalVal) {
    var worstName = list.slice().sort(function (a, b) { return a.mdd - b.mdd; })[0];
    lines.push("각 종목이 과거에 겪은 <b>최대 낙폭이 지금 한꺼번에 다시 온다면</b> 평가금액은 약 <b>" + fmtKrw(scenario) + "</b>(" +
      "<span class='neg'>" + fmtPct(scenario / totalVal - 1) + "</span>)까지 내려갈 수 있습니다. 가장 깊었던 건 " +
      cmpLabel(worstName.s) + "의 " + fmtPct(worstName.mdd) + "입니다. 이 금액을 보고도 팔지 않을 수 있는지가 지금 비중이 맞는지의 기준입니다.");
  }
  var top = list[0];
  if (top && totalVal > 0 && top.val / totalVal > 0.5 && list.length > 1) {
    lines.push("<b>" + cmpLabel(top.s) + "</b> 한 종목이 전체의 " + (top.val / totalVal * 100).toFixed(0) +
      "%입니다. 이 종목의 하락이 곧 계좌 전체의 하락이 됩니다.");
  }
  if (missingFx) lines.push("<span style='color:var(--up)'>환율 데이터를 불러오지 못해 해외 자산은 1달러=1원으로 계산됐습니다. 새로고침해 주세요.</span>");
  $("hInsight").innerHTML = lines.length ? "<ul>" + lines.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul>" : "";

  renderHoldChart(tl);
}

function badge(label, val, title) {
  return '<span class="badge"' + (title ? ' title="' + title + '"' : "") + ">" + label + "<b>" + val + "</b></span>";
}
function fmtKrw(v) {
  if (!isFinite(v)) return "-";
  return Math.round(v).toLocaleString("ko-KR") + "원";
}
function signKrw(v) { return (v >= 0 ? "+" : "−") + fmtKrw(Math.abs(v)); }
function fmtQty(q) { return Math.abs(q - Math.round(q)) < 1e-6 ? Math.round(q).toLocaleString("ko-KR") : (+q.toFixed(4)).toLocaleString("ko-KR"); }
function fmtDays(d) {
  if (d == null) return "";
  if (d < 60) return d + "일째";
  if (d < 730) return Math.round(d / 30.4) + "개월째";
  return (d / 365.25).toFixed(1) + "년째";
}

function lotRowsHtml(sym, lots, krw) {
  var sorted = lots.slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; });
  var rows = sorted.map(function (L) {
    var amt = L.q * L.p * (L.fx || 1);
    return "<tr class='hLot'><td colspan='2' style='text-align:left'>└ " + L.d.replace(/-/g, ".") +
      " <b class='" + (L.side === "sell" ? "neg" : "pos") + "'>" + (L.side === "sell" ? "매도" : "매수") + "</b>" +
      (L.memo ? " <small style='color:var(--sub)'>" + escHtml(L.memo) + "</small>" : "") + "</td>" +
      "<td>" + fmtPrice(L.p) + (krw ? "원" : "") + "</td><td>" + fmtQty(L.q) + "주</td>" +
      "<td colspan='2'>" + fmtKrw(amt) + (krw ? "" : "<br><small style='color:var(--sub)'>환율 " + (+L.fx).toFixed(1) + "</small>") + "</td>" +
      "<td colspan='3'></td><td><button class='chip' data-hdel='" + L.id + "' title='이 기록 삭제'>삭제</button></td></tr>";
  });
  return rows.join("");
}
function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

function bindHoldTable() {
  var tbl = $("hTable");
  Array.prototype.forEach.call(tbl.querySelectorAll("[data-hopen]"), function (b) {
    b.onclick = function () {
      var s = b.getAttribute("data-hopen");
      hState.open[s] = !hState.open[s];
      renderHoldings();
    };
  });
  Array.prototype.forEach.call(tbl.querySelectorAll("[data-hgo]"), function (b) {
    b.onclick = function () {
      var s = b.getAttribute("data-hgo");
      navTo("single", "analysis");
      $("searchInput").value = s;
      loadSymbol(s);
    };
  });
  Array.prototype.forEach.call(tbl.querySelectorAll("[data-hdel]"), function (b) {
    b.onclick = function () {
      if (!confirm("이 거래 기록을 삭제할까요?")) return;
      var H = loadHoldings(), id = b.getAttribute("data-hdel");
      H.lots = H.lots.filter(function (L) { return L.id !== id; });
      saveHoldings(H);
      renderHoldings();
    };
  });
}

function renderHoldChart(tl) {
  var wrap = $("hChartWrap");
  if (!tl.length) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  if (hState.chart) hState.chart.destroy();
  hState.chart = new Chart($("hChart"), {
    type: "line",
    data: {
      labels: tl.map(function (p) { return fmtDate(p.t); }),
      datasets: [
        { label: "평가금액", data: tl.map(function (p) { return p.value; }), borderColor: "#3182f6", borderWidth: 2,
          pointRadius: 0, tension: 0, fill: false },
        { label: "투입 원금", data: tl.map(function (p) { return p.cost; }), borderColor: "#6b7684", borderWidth: 1.5,
          borderDash: [6, 4], pointRadius: 0, tension: 0, fill: false, stepped: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        zoom: typeof buildZoomOptions === "function" ? buildZoomOptions() : undefined,
        legend: { labels: { color: "#191f28", boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (c) { return c.dataset.label + ": " + fmtKrw(c.parsed.y); },
            afterBody: function (items) {
              var p = tl[items[0].dataIndex];
              return ["손익: " + signKrw(p.value - p.cost) + " (" + fmtPct(p.value / p.cost - 1) + ")"];
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: "#8b95a1", maxTicksLimit: (window.innerWidth < 640 ? 4 : 8), maxRotation: 0 }, grid: { color: "rgba(25,31,40,0.06)" } },
        y: { ticks: { color: "#8b95a1", callback: function (v) { return koAmount(v) || fmtKrw(v); } }, grid: { color: "rgba(25,31,40,0.06)" } }
      }
    }
  });
}

/* ================= 입력 ================= */
var hPick = { sym: null };

function hSearchSetup() {
  var inp = $("hSym"), res = $("hSymResults");
  inp.addEventListener("input", function () {
    hPick.sym = null;
    var hits = searchDict(TICKER_DICT, inp.value).slice(0, 6);
    if (!inp.value.trim() || !hits.length) { res.style.display = "none"; return; }
    res.innerHTML = hits.map(function (h) {
      return '<div class="hRes" data-s="' + h.symbol + '"><b>' + h.name + "</b> <small>" + h.symbol + "</small></div>";
    }).join("");
    res.style.display = "block";
    Array.prototype.forEach.call(res.querySelectorAll("[data-s]"), function (d) {
      d.onmousedown = function (e) {
        e.preventDefault();
        hPick.sym = d.getAttribute("data-s");
        inp.value = cmpLabel(hPick.sym) + " (" + hPick.sym + ")";
        res.style.display = "none";
        hSymChanged();
      };
    });
  });
  inp.addEventListener("blur", function () { setTimeout(function () { res.style.display = "none"; }, 150); });
}

function hCurrentSym() {
  if (hPick.sym) return hPick.sym;
  var v = $("hSym").value.trim();
  return v ? resolveSymbol(v) : null;
}

/* 종목이 정해지면 통화에 맞춰 환율 칸을 보이고 숨긴다 */
function hSymChanged() {
  var s = hCurrentSym();
  var krw = s ? isKrwSymbol(s, hState.meta[s]) : true;
  $("hFxWrap").classList.toggle("hidden", krw);
  $("hPriceUnit").textContent = krw ? "원" : "(현지 통화)";
}

function hMsg(msg, isErr) {
  var el = $("hFormMsg");
  el.innerHTML = msg || "";
  el.style.color = isErr ? "var(--up)" : "var(--good)";
}

$("hAddBtn").onclick = function () {
  var s = hCurrentSym();
  if (!s) { hMsg("종목을 입력해 주세요.", true); return; }
  var d = $("hDate").value;
  if (!d) { hMsg("날짜를 입력해 주세요.", true); return; }
  if (dateToMs(d) > Date.now()) { hMsg("미래 날짜는 기록할 수 없습니다.", true); return; }
  var side = $("hSide").value;
  var mode = $("hMode").value;
  var val = numVal("hVal"), price = numVal("hPrice"), fxIn = numVal("hFx");
  if (!isFinite(val) || val <= 0) { hMsg(mode === "qty" ? "수량을 입력해 주세요." : "금액을 입력해 주세요.", true); return; }
  hMsg("그날 시세 확인 중...");

  ensureHoldData([s]).then(function () {
    var rows = hState.series[s] || [];
    if (!rows.length) { hMsg("이 종목의 시세를 찾지 못했습니다. 종목명을 다시 확인해 주세요.", true); return; }
    var t = dateToMs(d);
    var close = closeOn(rows, t + DAY_MS - 1);
    var krw = isKrwSymbol(s, hState.meta[s]);
    var p = isFinite(price) && price > 0 ? price : close;
    var fx = krw ? 1 : (isFinite(fxIn) && fxIn > 0 ? fxIn : (hState.fx ? fxAt(hState.fx, t) : 1));
    // 금액 입력: 원화 금액 기준 → 수량 = 금액 / (단가 × 환율)
    var q = mode === "qty" ? val : val / (p * fx);

    if (t < rows[0].t - 5 * DAY_MS) {
      hMsg("이 종목의 데이터는 " + fmtDate(rows[0].t) + "부터 있습니다. 그 이전 날짜는 기록할 수 없습니다.", true);
      return;
    }
    var H = loadHoldings();
    H.lots.push(tidyLot({ id: newLotId(), s: s, d: d, side: side, q: q, p: p, fx: fx, memo: $("hMemo").value.trim().slice(0, 40) }));
    saveHoldings(H);

    // 입력 단가가 그날 종가와 크게 다르면 액면분할 가능성 안내
    var warn = "";
    if (isFinite(price) && price > 0 && close) {
      var ratio = price / close;
      if (ratio > 1.8 || ratio < 0.55) {
        warn = "<br><span style='color:var(--up)'>⚠ 입력 단가가 그날 종가(" + fmtPrice(close) +
          ")와 " + ratio.toFixed(1) + "배 차이납니다. 이 앱의 과거 가격은 <b>액면분할이 반영된</b> 값이라, 분할 전에 사셨다면 " +
          "수량은 분할 비율만큼 늘리고 단가는 그만큼 나눠 입력해야 손익이 맞습니다.</span>";
      }
    }
    hMsg("기록했습니다: " + cmpLabel(s) + " " + d.replace(/-/g, ".") + " " + (side === "sell" ? "매도 " : "매수 ") +
      fmtQty(q) + "주 × " + fmtPrice(p) + (krw ? "원" : "") + (isFinite(price) && price > 0 ? "" : " (그날 종가)") + warn);
    $("hVal").value = ""; $("hPrice").value = ""; $("hFx").value = ""; $("hMemo").value = "";
    renderHoldings();
  });
};

$("hMode").onchange = function () {
  $("hValLabel").textContent = this.value === "qty" ? "수량 (주)" : "금액 (원)";
  $("hVal").placeholder = this.value === "qty" ? "예: 10" : "예: 1,000,000";
};

/* 정기 매수 일괄 추가: 기간 동안 매월 같은 날(휴장이면 다음 거래일) 정해진 금액만큼 산 것으로 기록 */
function dcaLots(rows, sym, startD, endD, dayOfMonth, amountKrw, krw, fx) {
  var out = [];
  var s = new Date(dateToMs(startD)), e = dateToMs(endD);
  var y = s.getUTCFullYear(), m = s.getUTCMonth();
  if (s.getUTCDate() > dayOfMonth) m++;
  for (var guard = 0; guard < 600; guard++) {
    var target = Date.UTC(y, m, dayOfMonth);
    if (target > e || target > Date.now()) break;
    // 그날 이후 첫 거래일
    var idx = -1;
    for (var i = 0; i < rows.length; i++) if (rows[i].t >= target) { idx = i; break; }
    if (idx < 0) break;
    var r = rows[idx];
    if (r.t - target < 10 * DAY_MS) {
      var rate = krw ? 1 : (fx ? fxAt(fx, r.t) : 1);
      out.push({ s: sym, d: msToDate(r.t), side: "buy", q: amountKrw / (r.c * rate), p: r.c, fx: rate, memo: "정기매수" });
    }
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

$("hDcaBtn").onclick = function () {
  var s = hCurrentSym();
  if (!s) { hMsg("위 종목 칸에 종목을 먼저 입력해 주세요.", true); return; }
  var sd = $("hDcaStart").value, ed = $("hDcaEnd").value || msToDate(Date.now());
  var amt = numVal("hDcaAmt"), day = Math.max(1, Math.min(28, +$("hDcaDay").value || 1));
  if (!sd) { hMsg("정기 매수 시작일을 입력해 주세요.", true); return; }
  if (!isFinite(amt) || amt <= 0) { hMsg("매월 금액을 입력해 주세요.", true); return; }
  hMsg("과거 시세로 계산 중...");
  ensureHoldData([s]).then(function () {
    var rows = hState.series[s] || [];
    if (!rows.length) { hMsg("이 종목의 시세를 찾지 못했습니다.", true); return; }
    var krw = isKrwSymbol(s, hState.meta[s]);
    var lots = dcaLots(rows, s, sd, ed, day, amt, krw, hState.fx);
    if (!lots.length) { hMsg("기간 안에 매수일이 없습니다. 날짜를 확인해 주세요.", true); return; }
    if (!confirm(cmpLabel(s) + "을(를) " + lots[0].d + " ~ " + lots[lots.length - 1].d + " 동안 매월 " + day + "일에 " +
      fmtKrw(amt) + "씩 산 것으로 " + lots.length + "건 기록합니다. 계속할까요?")) { hMsg(""); return; }
    var H = loadHoldings();
    lots.forEach(function (L) { L.id = newLotId(); H.lots.push(tidyLot(L)); });
    saveHoldings(H);
    hMsg(lots.length + "건을 기록했습니다. 각 건은 그날 종가·환율 기준이며, 거래 목록에서 개별로 지울 수 있습니다.");
    renderHoldings();
  });
};

/* 기록 추가 폼은 팝업으로 연다 */
function openHoldForm() {
  hMsg("");
  if (typeof openPop === "function") openPop("hDetails");
}
$("hAddOpen").onclick = openHoldForm;

/* 보유 구성 → 시뮬레이터로 넘기기 (금액 그대로) */
$("hToSim").onclick = function () {
  var c = hState.lastCalc;
  if (!c || !c.list.length) { setHoldStatus("보유 종목이 없습니다.", true); return; }
  var held = c.list.filter(function (x) { return x.val > 0; }).slice(0, 8);
  cmpState.cart = held.map(function (x) { return x.s; });
  simState.amountMode = true;
  simState.amounts = {};
  held.forEach(function (x) { simState.amounts[x.s] = Math.round(x.val); });
  if (typeof cartChanged === "function") cartChanged();
  if (typeof renderChips === "function") renderChips();
  switchPortfolioMode("sim");
  syncSimAssets();
  setSimStatus("보유 구성을 금액 그대로 가져왔습니다. 시작일·기간을 정하고 '시뮬레이션 실행'을 누르면, 이 구성으로 과거를 살았다면 어땠을지 볼 수 있습니다." +
    (c.list.length > 8 ? " (장바구니 한도로 상위 8종목만)" : ""));
};

/* ---------- 보유 현황 / 과거 시뮬레이션 전환 ---------- */
function switchPortfolioMode(mode) {
  $("holdCard").classList.toggle("hidden", mode !== "hold");
  $("simCard").classList.toggle("hidden", mode !== "sim");
  Array.prototype.forEach.call(document.querySelectorAll("#pfModeTabs [data-pm]"), function (b) {
    b.classList.toggle("active", b.getAttribute("data-pm") === mode);
  });
  try { localStorage.setItem("sm.pfMode", mode); } catch (e) {}
  if (mode === "hold") renderHoldings();
  if (typeof resizeVisibleCharts === "function") resizeVisibleCharts();
}
Array.prototype.forEach.call(document.querySelectorAll("#pfModeTabs [data-pm]"), function (b) {
  b.onclick = function () { switchPortfolioMode(b.getAttribute("data-pm")); };
});

/* 초기화 */
(function () {
  $("hDate").value = msToDate(Date.now());
  hSearchSetup();
  $("hSym").addEventListener("change", hSymChanged);
  if (typeof setupMoneyInputs === "function") {
    setupMoneyInputs([{ id: "hVal", hint: true }, { id: "hPrice" }, { id: "hFx" }, { id: "hDcaAmt", hint: true }]);
  }
  if (typeof chartCtrlHtml === "function") {
    $("hChartCtrl").innerHTML = chartCtrlHtml([[63, "3개월"], [126, "6개월"], [252, "1년"], [756, "3년"], [0, "전체"]]);
    setupChartCtrl("hChartCtrl", function () { return hState.chart; });
  }
  var mode = "hold";
  try { mode = localStorage.getItem("sm.pfMode") || "hold"; } catch (e) {}
  $("holdCard").classList.toggle("hidden", mode !== "hold");
  $("simCard").classList.toggle("hidden", mode !== "sim");
  Array.prototype.forEach.call(document.querySelectorAll("#pfModeTabs [data-pm]"), function (b) {
    b.classList.toggle("active", b.getAttribute("data-pm") === mode);
  });
})();
