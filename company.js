"use strict";
/* ============================================================
   StockMind — 기업 정보 & 투자지표 (화면 렌더링)
   ※ 이 파일은 루트에 둡니다. 서버 프록시는 api/fund.js 로 별도입니다.
   /api/fund 프록시(네이버 증권)에서 시세·PER/PBR/EPS/BPS·재무제표·
   투자자 매매동향을 받아 초보자용 해설과 함께 표시한다.
   ============================================================ */

/* ================= 순수 함수 ================= */

/* "354,000" / "28.61배" / "0.47%" / "2,069조 5,826억" → 숫자 */
function kNum(s) {
  if (s == null) return null;
  if (typeof s === "number") return s;
  var str = String(s).replace(/,/g, "").trim();
  if (!str || str === "-" || str === "N/A") return null;
  var m = str.match(/^(-?[\d.]+)\s*조\s*(?:([\d.]+)\s*억)?/);
  if (m) return parseFloat(m[1]) * 1e12 + (m[2] ? parseFloat(m[2]) * 1e8 : 0);
  var m2 = str.match(/^(-?[\d.]+)\s*억/);
  if (m2) return parseFloat(m2[1]) * 1e8;
  var n = parseFloat(str.replace(/[^\d.\-]/g, ""));
  return isFinite(n) ? n : null;
}

/* 재무제표 행 찾기 (제목 앞부분 일치) */
function findRow(fin, prefix) {
  if (!fin || !fin.rows) return null;
  var norm = prefix.replace(/\s/g, "");
  for (var i = 0; i < fin.rows.length; i++) {
    var t = (fin.rows[i].title || "").replace(/\s/g, "");
    if (t === norm || t.indexOf(norm) === 0) return fin.rows[i];
  }
  return null;
}

/* 억원 단위 숫자를 사람이 읽기 좋게 */
function fmtEok(v) {
  if (v == null || !isFinite(v)) return "-";
  var sign = v < 0 ? "-" : "";
  var a = Math.abs(v);
  if (a >= 10000) return sign + (a / 10000).toFixed(1) + "조";
  if (a >= 1) return sign + Math.round(a).toLocaleString("ko-KR") + "억";
  return sign + a.toFixed(2) + "억";
}

/* PER 해석 (초보자용 판정) */
function judgePer(per, industryPer) {
  if (per == null) return ["-", "var(--sub)"];
  if (per < 0) return ["적자 (계산불가)", "var(--down)"];
  if (industryPer != null && industryPer > 0) {
    if (per < industryPer * 0.7) return ["업종 대비 낮음", "var(--good)"];
    if (per > industryPer * 1.5) return ["업종 대비 높음", "var(--up)"];
    return ["업종 평균 수준", "var(--sub)"];
  }
  if (per < 8) return ["낮은 편", "var(--good)"];
  if (per > 30) return ["높은 편", "var(--up)"];
  return ["보통", "var(--sub)"];
}
function judgePbr(pbr) {
  if (pbr == null) return ["-", "var(--sub)"];
  if (pbr < 1) return ["순자산보다 싸게 거래", "var(--good)"];
  if (pbr > 5) return ["순자산 대비 높음", "var(--up)"];
  return ["보통", "var(--sub)"];
}
function judgeRoe(roe) {
  if (roe == null) return ["-", "var(--sub)"];
  if (roe < 0) return ["적자", "var(--down)"];
  if (roe >= 15) return ["우수", "var(--good)"];
  if (roe >= 8) return ["양호", "var(--txt)"];
  return ["낮음", "var(--sub)"];
}

/* 조회 불가 사유를 초보자가 이해할 수 있는 문장으로 바꾼다.
   HTTP 상태코드 같은 기술적 문구를 그대로 노출하지 않는다. */
function fundMessage(d) {
  var reason = d && d.reason;
  if (reason === "NOT_A_COMPANY") {
    return "<b>이 자산은 기업이 아닙니다.</b> 지수·환율·원자재·암호화폐는 매출이나 이익 같은 재무제표가 존재하지 않아 " +
      "PER·PBR·ROE를 계산할 수 없습니다.<br>" +
      "<small>대신 위쪽 <b>전문가 지표</b>(RSI·샤프·MDD)와 <b>지지·저항선</b>, <b>캔들 차트</b>는 정상적으로 사용할 수 있습니다.</small>";
  }
  if (reason === "WORLD_UNSUPPORTED" || (d && d.market === "WORLD")) {
    return "<b>해외 종목은 재무 데이터를 제공하지 않습니다.</b> 이 앱의 기업 정보는 네이버 증권 자료를 쓰는데, " +
      "국내 상장 종목만 안정적으로 제공됩니다.<br>" +
      "<small>미국 종목의 PER·PBR·ROE는 <b>네이버 증권 해외주식</b>, <b>Yahoo Finance</b>, 증권사 앱의 종목 정보에서 확인하실 수 있습니다. " +
      "이 앱의 가격 기반 분석(낙폭·지지저항·캔들·RSI·샤프 등)은 해외 종목도 모두 정상 작동합니다.</small>";
  }
  return "<b>기업 정보를 불러오지 못했습니다.</b> 잠시 후 다시 시도해 주세요.<br>" +
    "<small>가격 기반 분석은 정상 작동합니다.</small>";
}

/* ================= 상태 & 로딩 ================= */
var fundState = { data: null, symbol: null, view: "quarter" };

function loadFund(symbol) {
  fundState.symbol = symbol;
  fundState.data = null;
  var card = $("fundCard");
  card.classList.remove("hidden");
  $("fundStatus").textContent = "기업 정보 불러오는 중...";
  $("fundBody").classList.add("hidden");

  fetch("/api/fund?symbol=" + encodeURIComponent(symbol))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (fundState.symbol !== symbol) return; // 다른 종목으로 바뀜
      if (!d || !d.ok) {
        $("fundStatus").innerHTML = fundMessage(d);
        return;
      }
      fundState.data = d;
      $("fundStatus").textContent = "";
      $("fundBody").classList.remove("hidden");
      renderFund();
    })
    .catch(function (e) {
      $("fundStatus").textContent = "기업 정보 조회 실패: " + e.message;
    });
}

/* ================= 렌더링 ================= */
function renderFund() {
  var d = fundState.data;
  if (!d) return;
  var I = d.info || {};
  function v(code) { return I[code] ? I[code].value : null; }
  function n(code) { return kNum(v(code)); }

  /* --- 1. 시세 요약 --- */
  var quote = [
    ["전일", v("lastClosePrice")], ["시가", v("openPrice")],
    ["고가", v("highPrice")], ["저가", v("lowPrice")],
    ["거래량", v("accumulatedTradingVolume")], ["거래대금", v("accumulatedTradingValue")],
    ["시가총액", v("marketValue")], ["외국인 보유율", v("foreignRate")],
    ["52주 최고", v("highPriceOf52Weeks")], ["52주 최저", v("lowPriceOf52Weeks")]
  ];
  $("fundQuote").innerHTML = quote.filter(function (q) { return q[1] != null; }).map(function (q) {
    return '<span class="badge">' + q[0] + "<b>" + q[1] + "</b></span>";
  }).join("");

  /* --- 2. 투자지표 --- */
  var per = n("per"), eps = n("eps"), pbr = n("pbr"), bps = n("bps");
  var cnsPer = n("cnsPer"), cnsEps = n("cnsEps"), divY = n("dividendYieldRatio"), div = v("dividend");
  var indPer = null;
  if (d.industry && d.industry.industryPer != null) indPer = kNum(d.industry.industryPer);
  else if (d.industry && d.industry.per != null) indPer = kNum(d.industry.per);

  // ROE는 재무제표에서 (최근 확정 분기/연간)
  var roe = null, roeLabel = "";
  var finA = d.finance && d.finance.annual, finQ = d.finance && d.finance.quarter;
  var roeRow = findRow(finA, "ROE") || findRow(finQ, "ROE");
  var roeSrc = findRow(finA, "ROE") ? finA : finQ;
  if (roeRow && roeSrc) {
    var confirmed = roeSrc.periods.filter(function (p) { return !p.forecast && roeRow.values[p.key] != null; });
    if (confirmed.length) {
      var lastP = confirmed[confirmed.length - 1];
      roe = kNum(roeRow.values[lastP.key]);
      roeLabel = lastP.title;
    }
  }

  var pj = judgePer(per, indPer), bj = judgePbr(pbr), rj = judgeRoe(roe);
  var html = "";
  html += badge("PER", per == null ? "-" : per.toFixed(2) + "배", pj,
    "주가 ÷ 주당순이익. 지금 버는 돈의 몇 년치 가격에 거래되는지" + (indPer ? " · 업종 PER " + indPer.toFixed(1) + "배" : ""));
  if (cnsPer != null) html += badge("추정 PER", cnsPer.toFixed(2) + "배", ["증권사 전망치 기준", "var(--sub)"], "애널리스트들의 올해 이익 전망으로 계산한 PER");
  html += badge("EPS", eps == null ? "-" : Math.round(eps).toLocaleString("ko-KR") + "원", null, "주당순이익. 1주가 1년에 벌어들이는 이익");
  if (cnsEps != null) html += badge("추정 EPS", Math.round(cnsEps).toLocaleString("ko-KR") + "원", ["전망치", "var(--sub)"], "애널리스트 전망 주당순이익");
  html += badge("PBR", pbr == null ? "-" : pbr.toFixed(2) + "배", bj, "주가 ÷ 주당순자산. 회사가 가진 재산 대비 주가가 몇 배인지");
  html += badge("BPS", bps == null ? "-" : Math.round(bps).toLocaleString("ko-KR") + "원", null, "주당순자산. 회사를 청산하면 1주당 돌아오는 장부상 재산");
  html += badge("ROE", roe == null ? "-" : roe.toFixed(1) + "%", rj, "자기자본이익률. 주주 돈으로 1년에 몇 % 이익을 냈는지" + (roeLabel ? " · " + roeLabel + " 기준" : ""));
  html += badge("배당수익률", divY == null ? "-" : divY.toFixed(2) + "%", null, "주가 대비 연간 배당금 비율" + (div ? " · 주당 " + div : ""));
  $("fundMetrics").innerHTML = html;

  /* --- 3. 실적 표 --- */
  renderFinanceTable();

  /* --- 4. 투자자별 매매동향 --- */
  renderTrend(d);

  /* --- 5. 컨센서스 --- */
  renderConsensus(d);

  $("fundSource").textContent = "출처: 네이버 증권 · " + (d.market === "KR" ? "국내" : "해외") + " 종목 " + (d.name || d.code) +
    " · 30분 캐시 · 재무제표 단위 억원";
}

function badge(label, value, judge, tip) {
  return '<span class="badge" title="' + tip.replace(/"/g, "&quot;") + '">' + label + "<b>" + value +
    (judge ? ' <small style="color:' + judge[1] + '">' + judge[0] + "</small>" : "") + "</b></span>";
}

function renderFinanceTable() {
  var d = fundState.data;
  var fin = d.finance && d.finance[fundState.view];
  var box = $("fundFinance");
  if (!fin || !fin.periods || !fin.periods.length) {
    box.innerHTML = "<tbody><tr><td style='color:var(--sub)'>재무제표 데이터가 없습니다" +
      (d.market === "WORLD" ? " (해외 종목은 미제공)" : "") + ".</td></tr></tbody>";
    return;
  }
  var WANT = [
    ["매출액", "eok"], ["영업이익", "eok"], ["영업이익률", "pct"], ["당기순이익", "eok"], ["순이익률", "pct"],
    ["ROE", "pct"], ["부채비율", "pct"], ["EPS", "won"], ["PER", "bae"], ["BPS", "won"], ["PBR", "bae"],
    ["주당배당금", "won"], ["시가배당률", "pct"], ["EV/EBITDA", "bae"]
  ];
  var periods = fin.periods.slice(-6);
  var html = "<thead><tr><th style='text-align:left'>항목</th>";
  periods.forEach(function (p) {
    html += "<th" + (p.forecast ? " style='color:var(--accent)'" : "") + ">" + p.title + (p.forecast ? "<br><small>(전망)</small>" : "") + "</th>";
  });
  html += "</tr></thead><tbody>";
  var shown = 0;
  WANT.forEach(function (w) {
    var row = findRow(fin, w[0]);
    if (!row) return;
    shown++;
    html += "<tr><td style='text-align:left'><b>" + row.title + "</b></td>";
    periods.forEach(function (p) {
      var raw = row.values[p.key];
      var num = kNum(raw);
      var txt;
      if (num == null) txt = "-";
      else if (w[1] === "eok") txt = fmtEok(num);
      else if (w[1] === "pct") txt = num.toFixed(1) + "%";
      else if (w[1] === "won") txt = Math.round(num).toLocaleString("ko-KR");
      else txt = num.toFixed(2);
      var cls = (w[1] === "eok" || w[1] === "pct") && w[0] !== "부채비율" ? (num < 0 ? "neg" : "") : "";
      html += "<td class='" + cls + "'" + (p.forecast ? " style='color:var(--sub)'" : "") + ">" + txt + "</td>";
    });
    html += "</tr>";
  });
  if (!shown) html += "<tr><td colspan='" + (periods.length + 1) + "' style='color:var(--sub)'>표시할 항목이 없습니다.</td></tr>";
  box.innerHTML = html + "</tbody>";
}

/* 투자자별 매매동향 — 응답 키 이름이 바뀔 수 있어 정규식으로 유연하게 찾는다 */
function renderTrend(d) {
  var box = $("fundTrend");
  var list = null;
  if (Array.isArray(d.trend)) list = d.trend;
  else if (d.trend && Array.isArray(d.trend.result)) list = d.trend.result;
  else if (d.trend && Array.isArray(d.trend.datas)) list = d.trend.datas;
  else if (Array.isArray(d.dealTrend)) list = d.dealTrend;
  if (!list || !list.length) { box.innerHTML = "<tbody><tr><td style='color:var(--sub)'>투자자별 매매동향 데이터가 없습니다.</td></tr></tbody>"; return; }

  function pick(obj, re) {
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) if (re.test(keys[i])) return obj[keys[i]];
    return null;
  }
  var rows = list.slice(0, 7).map(function (o) {
    return {
      date: pick(o, /^(bizdate|date|localTradedAt|tradeDate)$/i),
      close: kNum(pick(o, /closePrice|close_val|closeprice/i)),
      frgn: kNum(pick(o, /foreign.*(pure|net).*(buy|quant)|frgn_pure/i)),
      org: kNum(pick(o, /(organ|institution).*(pure|net).*(buy|quant)|organ_pure/i)),
      indi: kNum(pick(o, /(indi|individual|personal).*(pure|net).*(buy|quant)|indi_pure/i)),
      hold: kNum(pick(o, /foreign.*(hold|ratio)|frgn_hold/i))
    };
  }).filter(function (r) { return r.date; });
  if (!rows.length) { box.innerHTML = "<tbody><tr><td style='color:var(--sub)'>투자자별 매매동향 형식을 해석하지 못했습니다.</td></tr></tbody>"; return; }

  function cell(x) {
    if (x == null) return "<td>-</td>";
    var s = Math.round(x).toLocaleString("ko-KR");
    return '<td class="' + (x > 0 ? "pos" : x < 0 ? "neg" : "") + '">' + (x > 0 ? "+" : "") + s + "</td>";
  }
  var html = "<thead><tr><th>날짜</th><th>종가</th><th>외국인</th><th>기관</th><th>개인</th><th>외국인 보유율</th></tr></thead><tbody>";
  rows.forEach(function (r) {
    var ds = String(r.date).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3").slice(0, 10);
    html += "<tr><td>" + ds + "</td><td>" + (r.close == null ? "-" : r.close.toLocaleString("ko-KR")) + "</td>" +
      cell(r.frgn) + cell(r.org) + cell(r.indi) +
      "<td>" + (r.hold == null ? "-" : r.hold.toFixed(2) + "%") + "</td></tr>";
  });
  box.innerHTML = html + "</tbody>";
}

function renderConsensus(d) {
  var box = $("fundConsensus");
  var c = d.consensus;
  if (!c) { box.innerHTML = ""; return; }
  var target = kNum(c.priceTargetMean || c.targetPrice || c.priceTarget);
  var rec = c.recommMean || c.recommendMean || c.opinion || null;
  var cnt = c.analystCount || c.count || null;
  if (target == null && !rec) { box.innerHTML = ""; return; }
  var cur = kNum(d.info.lastClosePrice && d.info.lastClosePrice.value);
  var up = (target != null && cur) ? target / cur - 1 : null;
  box.innerHTML = "<b>증권사 컨센서스</b> · " +
    (target != null ? "목표주가 평균 <b>" + Math.round(target).toLocaleString("ko-KR") + "원</b>" +
      (up != null ? ' (전일 대비 <span class="' + pctCls(up) + '">' + fmtPct(up) + "</span>)" : "") : "") +
    (rec ? " · 투자의견 " + rec : "") + (cnt ? " · 애널리스트 " + cnt + "명" : "") +
    "<br><small style='color:var(--sub)'>목표주가는 12개월 전망이며 자주 빗나갑니다. 방향의 참고일 뿐 매수 근거로 쓰지 마세요.</small>";
}

$("fundViewQ").onclick = function () { fundState.view = "quarter"; setFundView(); };
$("fundViewA").onclick = function () { fundState.view = "annual"; setFundView(); };
function setFundView() {
  $("fundViewQ").classList.toggle("active", fundState.view === "quarter");
  $("fundViewA").classList.toggle("active", fundState.view === "annual");
  if (fundState.data) renderFinanceTable();
}
