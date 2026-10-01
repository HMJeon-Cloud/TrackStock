/* ============================================================
   '채널' 탭 — 정보 공유 채널 운영자용 발행 자료 (v6.2)
   매일 아침 자동 집계된 데이터를 "그대로 붙여 넣을 수 있는 글"로 만들어 준다.
   하단 메뉴에는 없고, 홈 하단 '채널 운영' 링크나 주소 #t=channel 로 들어온다.

   ① 미국 증시 데일리 브리핑 — 서버(/api/channel)가 아침 데이터로 만든 글
   ② MDD(최대낙폭) 분석        — 지정한 종목의 역대 낙폭 속 현재 위치 (10년치 데이터로 계산)
   ③ 자산배분 스냅샷            — 주식·채권·금·달러의 기간별 등락
   ④ 상황별 과거 사례           — 금리 급등·유가 급등·공포 급락 등 과거 구간에서 자산별 성과, 최대 낙폭과 회복일,
                                   '버틴 자산을 팔아 빠진 자산을 샀다면' 1년 뒤 결과 (전부 실제 데이터로 계산)
   ④ 부동산 / ⑤ 자료·독서       — 운영자 메모 칸 (자동 데이터 없음)
   전체 글 복사 · 스레드용 짧은 글 · 각 섹션 이미지 저장
   ============================================================ */
var CH_KEY = { mdd: "sm.ch.mdd", notes: "sm.ch.notes" };
var CH_DEFAULT_MDD = ["SPY", "QQQ", "^KS11", "005930.KS", "NVDA", "GLD", "BTC-USD", "TLT"];
var chState = { daily: null, mdd: null, alloc: null, now: null, scen: null };

function chLoad(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
function chSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function chName(sym) { return (typeof BRIEF_KO !== "undefined" && BRIEF_KO[sym]) ? BRIEF_KO[sym].replace(/\s*\(.*?\)\s*/g, "").trim() : sym; }
function chPct(x, d) { if (x == null || !isFinite(x)) return "-"; d = d == null ? 1 : d; return (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%"; }
function chCopy(text, btn) {
  function done(ok) { var old = btn.textContent; btn.textContent = ok ? "✓ 복사됨" : "복사 실패"; setTimeout(function () { btn.textContent = old; }, 1500); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
  else { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(true); } catch (e) { done(false); } ta.remove(); }
}

/* ---------- ① 데일리 브리핑 (서버 글) ---------- */
function chLoadDaily(force) {
  var box = $("chDaily");
  box.innerHTML = '<div class="briefDim">글 만드는 중…</div>';
  return fetch("/api/channel" + (force ? "?r=" + Date.now() : "")).then(function (r) { return r.json(); }).then(function (d) {
    chState.daily = d;
    if (!d.ok) { box.innerHTML = '<div class="briefDim">아직 데이터가 없어요 (' + (d.reason || "") + '). 아침 수집 뒤에 생겨요.</div>'; return; }
    box.innerHTML = '<pre class="chText" id="chDailyText"></pre>';
    $("chDailyText").textContent = d.text;
    $("chDailyMeta").textContent = d.text.length + "자 · 데이터 " + (d.generated || "").replace("T", " ").slice(0, 16) + " 수집";
  }).catch(function () { box.innerHTML = '<div class="briefDim">글을 불러오지 못했어요.</div>'; });
}

/* ---------- ② MDD 분석 (10년치 데이터) ---------- */
function chMddRow(sym) {
  return getChartData(sym, "max").then(function (parsed) {
    var rows = parsed.rows; if (!rows || rows.length < 250) throw new Error("short");
    var last = rows[rows.length - 1].c, peak = -Infinity, peakT = 0;
    rows.forEach(function (r) { if (r.c > peak) { peak = r.c; peakT = r.t; } });
    var cur = last / peak - 1;
    var eps = drawdownEpisodes(rows, 0.10);
    var finished = eps.filter(function (e) { return e.recoverI != null; });
    var deeper = eps.filter(function (e) { return e.dd < cur; }).length;
    var recDays = finished.map(function (e) { return Math.round((rows[e.recoverI].t - rows[e.troughI].t) / 86400000); }).sort(function (a, b) { return a - b; });
    var medRec = recDays.length ? recDays[Math.floor(recDays.length / 2)] : null;
    var worst = eps.length ? Math.min.apply(null, eps.map(function (e) { return e.dd; })) : null;
    // 현재 구간: 고점 이후 며칠째
    var days = Math.round((rows[rows.length - 1].t - peakT) / 86400000);
    var years = (rows[rows.length - 1].t - rows[0].t) / (365.25 * 86400000);
    return { sym: sym, name: chName(sym), cur: cur, days: days, eps: eps.length, deeper: deeper, worst: worst, medRec: medRec, years: years, source: parsed.source };
  }).catch(function () { return { sym: sym, name: chName(sym), err: true }; });
}
function chLoadMdd() {
  var list = chLoad(CH_KEY.mdd, CH_DEFAULT_MDD);
  $("chMddInput").value = list.join(", ");
  var box = $("chMdd"); box.innerHTML = '<div class="briefDim">10년치 데이터로 계산 중… (' + list.length + '종목)</div>';
  return Promise.all(list.map(chMddRow)).then(function (rs) {
    chState.mdd = rs;
    var ok = rs.filter(function (r) { return !r.err; });
    box.innerHTML = '<div class="tableWrap"><table id="chMddTable"><tr><th>종목</th><th>전고점 대비</th><th>고점 후</th><th>역대 순위</th><th>역대 최악</th><th>회복 중앙값</th></tr>' +
      ok.map(function (r) {
        return '<tr><td><b>' + r.name + '</b><div class="briefDim">' + r.sym + ' · ' + r.years.toFixed(0) + '년치</div></td>' +
          '<td style="color:' + (r.cur < -0.1 ? "var(--down)" : "var(--txt)") + ';font-weight:700">' + chPct(r.cur) + '</td>' +
          '<td>' + (r.cur > -0.005 ? "신고가 부근" : r.days + "일") + '</td>' +
          '<td>' + (r.cur <= -0.1 ? (r.deeper + 1) + "위 / " + r.eps + "회" : "10% 미만") + '</td>' +
          '<td>' + chPct(r.worst) + '</td><td>' + (r.medRec != null ? r.medRec + "일" : "-") + '</td></tr>';
      }).join("") + '</table></div>' +
      (rs.length > ok.length ? '<div class="briefDim" style="margin-top:6px">데이터 부족: ' + rs.filter(function (r) { return r.err; }).map(function (r) { return r.sym; }).join(", ") + '</div>' : "") +
      '<div class="briefDim" style="margin-top:6px">역대 순위 = 10% 이상 하락 구간들 중 지금 낙폭이 몇 번째로 깊은지. 회복 중앙값 = 저점에서 전고점 회복까지 걸린 날의 중앙값.</div>';
    if (typeof snapAttach === "function") snapAttach();
  });
}
function chMddText() {
  var rs = (chState.mdd || []).filter(function (r) { return !r.err; });
  if (!rs.length) return "";
  var L = ["📉 MDD 체크 — 전고점 대비 현재 위치"];
  rs.forEach(function (r) {
    L.push("· " + r.name + " " + chPct(r.cur) + (r.cur <= -0.1 ? " (역대 " + (r.deeper + 1) + "위/" + r.eps + "회, 고점 후 " + r.days + "일)" : r.cur > -0.005 ? " (신고가 부근)" : "") +
      " · 역대 최악 " + chPct(r.worst, 0) + (r.medRec != null ? " · 회복 중앙값 " + r.medRec + "일" : ""));
  });
  L.push("※ 과거 패턴이 반복된다는 보장은 없음. 감정 대신 기준을 만드는 참고 자료.");
  return L.join("\n");
}

/* ---------- ③ 자산배분 스냅샷 (recent 재사용) ---------- */
var CH_ALLOC = [["SPY", "주식(S&P500)"], ["TLT", "장기채(TLT)"], ["GLD", "금(GLD)"], ["SHY", "현금성(단기채)"], ["KRW=X", "달러/원"]];
function chLoadAlloc() {
  return fetchRecent().then(function (recent) {
    if (!recent || !recent.symbols) { $("chAlloc").innerHTML = '<div class="briefDim">데이터 없음</div>'; return; }
    var rows = CH_ALLOC.map(function (p) {
      var d = recent.symbols[p[0]]; if (!d || !d.c || d.c.length < 22) return null;
      var c = d.c, n = c.length, last = c[n - 1];
      return { name: p[1], d1: last / c[n - 2] - 1, w1: n > 5 ? last / c[n - 6] - 1 : null, m1: last / c[Math.max(0, n - 22)] - 1, m3: last / c[0] - 1 };
    }).filter(Boolean);
    chState.alloc = rows;
    chState.now = chDetectNow(recent);
    $("chAlloc").innerHTML = '<div class="tableWrap"><table><tr><th>자산</th><th>하루</th><th>1주</th><th>1개월</th><th>3개월</th></tr>' +
      rows.map(function (r) {
        function td(x) { return '<td style="color:' + (x > 0 ? "var(--up)" : x < 0 ? "var(--down)" : "var(--sub)") + '">' + chPct(x) + '</td>'; }
        return '<tr><td><b>' + r.name + '</b></td>' + td(r.d1) + td(r.w1) + td(r.m1) + td(r.m3) + '</tr>';
      }).join("") + '</table></div>';
    if (typeof snapAttach === "function") snapAttach();
  });
}
function chAllocText() {
  var rs = chState.alloc || []; if (!rs.length) return "";
  return "⚖️ 4자산 스냅샷 (1주 / 1개월 / 3개월)\n" + rs.map(function (r) { return "· " + r.name + " " + chPct(r.w1) + " / " + chPct(r.m1) + " / " + chPct(r.m3); }).join("\n");
}

/* ---------- ④ 상황별 과거 사례 ----------
   날짜 구간은 널리 알려진 사건 기준이고, 숫자(등락·낙폭·회복일·1년 뒤)는 전부 앱의 실제 가격 데이터로 계산한다. */
var CH_ASSETS = [["SPY", "S&P500"], ["QQQ", "나스닥100"], ["TLT", "미국 장기채"], ["GLD", "금"], ["NVDA", "엔비디아"], ["AAPL", "애플"], ["TSLA", "테슬라"], ["^KS11", "코스피"]];
var CH_SCEN = [
  { id: "rateUp", tag: "금리 급등", icon: "📈",
    lesson: "금리가 오르면 채권 가격은 떨어져요(금리와 채권 가격은 반대로 움직임). 성장주·기술주가 특히 크게 빠졌고, 이런 구간에서 채권은 피난처가 되지 못했어요.",
    eps: [["2022 연준 급격한 금리인상", "2022-01-03", "2022-10-12"], ["2018 파월 쇼크(긴축 지속)", "2018-10-01", "2018-12-24"], ["2013 테이퍼 탠트럼", "2013-05-21", "2013-06-24"]] },
  { id: "rateDown", tag: "금리 인하 전환", icon: "📉",
    lesson: "금리 인하 국면에서는 채권 가격이 오르는 경향이 있어요. 2022년처럼 채권이 같이 빠진 뒤라면, 금리 방향이 바뀌는 시점에 주식·채권 비중을 다시 맞추는 근거가 돼요.",
    eps: [["2019 연준 금리인하 전환", "2019-07-31", "2019-12-31"], ["2024 연준 금리인하 시작", "2024-09-18", "2024-12-31"]] },
  { id: "panic", tag: "공포 급락 (VIX 급등)", icon: "😱",
    lesson: "짧고 깊은 급락은 대부분 몇 주~몇 달 안에 저점을 찍었어요. 이때 금·장기채가 상대적으로 버틴 경우가 많아, '버틴 자산 일부를 팔아 빠진 주식을 사는' 리밸런싱이 결과적으로 유리했던 구간이에요.",
    eps: [["2020 코로나 폭락", "2020-02-19", "2020-03-23"], ["2024 엔캐리 청산 급락", "2024-07-16", "2024-08-05"], ["2025 미국 상호관세 발표", "2025-04-02", "2025-04-08"]] },
  { id: "oilUp", tag: "유가 급등·전쟁", icon: "🛢️",
    lesson: "유가가 뛰면 물가 걱정 → 금리 상승 압력으로 이어져 주식과 채권이 같이 약해질 수 있어요. 금과 에너지 업종이 상대적으로 강했던 사례가 많아요.",
    eps: [["2022 러-우 전쟁", "2022-02-24", "2022-06-08"], ["2023 이스라엘-하마스 전쟁", "2023-10-06", "2023-10-27"]] },
  { id: "dollarUp", tag: "달러 강세", icon: "💵",
    lesson: "달러가 강할 때 원화로 투자한 미국 자산은 환율 덕에 손실이 줄어드는 '자연 헷지' 효과가 있었어요. 반대로 코스피 같은 원화 자산은 외국인 매도로 약한 경우가 많아요.",
    eps: [["2022 킹달러", "2022-03-01", "2022-09-28"], ["2024 말 강달러", "2024-10-01", "2024-12-31"]] }
];

/* 지금 상황 감지 (최근 90일 데이터) */
function chDetectNow(recent) {
  function m1(sym) { var d = recent.symbols[sym]; if (!d || !d.c || d.c.length < 22) return null; var c = d.c, n = c.length; return c[n - 1] / c[n - 22] - 1; }
  function last(sym) { var d = recent.symbols[sym]; return d && d.c && d.c.length ? d.c[d.c.length - 1] : null; }
  var tlt = m1("TLT"), uso = m1("USO"), krw = m1("KRW=X"), vix = last("^VIX");
  var spy = recent.symbols.SPY, spyHi = spy && spy.meta && spy.meta.fiftyTwoWeekHigh ? last("SPY") / spy.meta.fiftyTwoWeekHigh - 1 : null;
  var match = {}, why = [];
  if (tlt != null && tlt <= -0.03) { match.rateUp = 1; why.push("장기채(TLT) 1개월 " + chPct(tlt) + " → 금리 상승 중"); }
  if (tlt != null && tlt >= 0.03) { match.rateDown = 1; why.push("장기채(TLT) 1개월 " + chPct(tlt) + " → 금리 하락 중"); }
  if (vix != null && vix >= 25) { match.panic = 1; why.push("VIX " + vix.toFixed(0) + " → 공포 구간"); }
  if (spyHi != null && spyHi <= -0.1) { match.panic = 1; why.push("S&P500 52주 고점 대비 " + chPct(spyHi) + " → 조정 구간"); }
  if (uso != null && uso >= 0.1) { match.oilUp = 1; why.push("원유(USO) 1개월 " + chPct(uso) + " → 유가 급등"); }
  if (krw != null && krw >= 0.02) { match.dollarUp = 1; why.push("달러/원 1개월 " + chPct(krw) + " → 달러 강세"); }
  return { match: match, why: why, tlt: tlt, vix: vix };
}

function chIdx(rows, ms) { var lo = 0, hi = rows.length - 1; while (lo < hi) { var mid = (lo + hi) >> 1; if (rows[mid].t < ms) lo = mid + 1; else hi = mid; } return lo; }
/* 한 구간 × 한 자산: 구간 등락, 구간 중 최대 낙폭, 저점 이후 회복일, 구간 끝에서 1년 뒤 */
function chEpisodeStat(rows, s, e) {
  var si = chIdx(rows, Date.parse(s)), ei = chIdx(rows, Date.parse(e) + 86399999);
  if (ei >= rows.length) ei = rows.length - 1;
  if (!rows.length || rows[si].t > Date.parse(e) + 86400000 || si >= ei) return null;
  if (Math.abs(rows[si].t - Date.parse(s)) > 10 * 86400000) return null;   // 그 시기 데이터가 없음
  var ret = rows[ei].c / rows[si].c - 1;
  var pk = si, peakBefore = rows[si].c, dd = 0, ti = si;
  for (var i = si; i <= ei; i++) {
    if (rows[i].c > rows[pk].c) pk = i;
    var d = rows[i].c / rows[pk].c - 1; if (d < dd) { dd = d; ti = i; peakBefore = rows[pk].c; }
  }
  var rec = null;
  if (dd < -0.02) { for (var j = ti; j < rows.length; j++) if (rows[j].c >= peakBefore) { rec = Math.round((rows[j].t - rows[ti].t) / 86400000); break; } }
  var fi = chIdx(rows, rows[ei].t + 365 * 86400000), fwd = (fi < rows.length && rows[fi].t - rows[ei].t < 400 * 86400000) ? rows[fi].c / rows[ei].c - 1 : null;
  return { ret: ret, dd: dd, rec: rec, recovered: dd >= -0.02 || rec != null, fwd: fwd };
}
function chLoadScenarios() {
  var box = $("chScen");
  box.innerHTML = '<div class="briefDim">과거 데이터로 계산 중… (8개 자산 × ' + CH_SCEN.reduce(function (a, x) { return a + x.eps.length; }, 0) + '개 구간)</div>';
  return Promise.all(CH_ASSETS.map(function (a) {
    return getChartData(a[0], "max").then(function (p) { return { sym: a[0], name: a[1], rows: p.rows }; }).catch(function () { return { sym: a[0], name: a[1], rows: [] }; });
  })).then(function (data) {
    var now = chState.now || { match: {}, why: [] };
    var scen = CH_SCEN.map(function (sc) {
      var eps = sc.eps.map(function (ep) {
        var st = data.map(function (d) { var x = d.rows.length ? chEpisodeStat(d.rows, ep[1], ep[2]) : null; return x ? Object.assign({ sym: d.sym, name: d.name }, x) : null; }).filter(Boolean);
        if (st.length < 3) return null;
        var by = st.slice().sort(function (a, b) { return b.ret - a.ret; });
        return { name: ep[0], s: ep[1], e: ep[2], st: st, best: by[0], worst: by[by.length - 1] };
      }).filter(Boolean);
      return Object.assign({}, sc, { eps: eps, now: !!now.match[sc.id] });
    }).filter(function (sc) { return sc.eps.length; });
    scen.sort(function (a, b) { return (b.now ? 1 : 0) - (a.now ? 1 : 0); });
    chState.scen = scen;
    chRenderScenarios();
  });
}
function chFmtRec(x) { return x.dd >= -0.02 ? "거의 안 빠짐" : x.rec != null ? x.rec + "일 만에 회복" : "아직 미회복"; }
function chRenderScenarios() {
  var scen = chState.scen || [], now = chState.now || { why: [] };
  var html = '<div class="chNowBox"><b>지금 시장</b> ' + (now.why.length ? now.why.map(function (w) { return '<span class="chNowTag">' + w + '</span>'; }).join("") : '<span class="briefDim">특별히 두드러진 신호 없음 — 평소 구간</span>') + '</div>';
  html += scen.map(function (sc) {
    return '<div class="chScen' + (sc.now ? " now" : "") + '">' +
      '<div class="chScenHead"><span>' + sc.icon + '</span><b>' + sc.tag + '</b>' + (sc.now ? '<span class="chNowBadge">지금과 비슷</span>' : '') + '</div>' +
      '<div class="chScenLesson">' + sc.lesson + '</div>' +
      sc.eps.map(function (ep) {
        var stocks = ep.st.filter(function (x) { return /^(NVDA|AAPL|TSLA)$/.test(x.sym); });
        return '<div class="chEp"><div class="chEpHead">' + ep.name + ' <small>' + ep.s.replace(/-/g, ".") + ' ~ ' + ep.e.replace(/-/g, ".") + '</small></div>' +
          '<div class="chEpGrid">' + ep.st.map(function (x) {
            return '<div class="chEpCell"><span>' + x.name + '</span><b style="color:' + (x.ret >= 0 ? "var(--up)" : "var(--down)") + '">' + chPct(x.ret, 0) + '</b></div>';
          }).join("") + '</div>' +
          '<div class="chEpNote">🛡 가장 버틴 <b>' + ep.best.name + ' ' + chPct(ep.best.ret, 0) + '</b> · 💥 가장 빠진 <b>' + ep.worst.name + ' ' + chPct(ep.worst.ret, 0) + '</b>' +
          (ep.worst.fwd != null && ep.best.fwd != null ? '<br>↻ 끝난 시점에 버틴 자산을 팔아 빠진 자산을 샀다면, 1년 뒤 ' + ep.worst.name + ' <b>' + chPct(ep.worst.fwd, 0) + '</b> vs 그대로 둔 ' + ep.best.name + ' <b>' + chPct(ep.best.fwd, 0) + '</b>' : '') + '</div>' +
          (stocks.length ? '<div class="chEpNote">🧠 ' + stocks.map(function (x) { return x.name + ' 최대 ' + chPct(x.dd, 0) + ' → ' + chFmtRec(x); }).join(" · ") + '</div>' : '') +
          '</div>';
      }).join("") + '</div>';
  }).join("");
  html += '<div class="noteLine" style="margin-top:10px">⚠️ 과거 사례예요. 같은 상황에서 같은 결과가 나온다는 보장은 없어요. 2배·3배 레버리지 상품은 하락 폭이 더 크고, 오르내림을 반복하면 지수가 제자리여도 손실이 쌓여요(변동성 손실) — 회복용으로 쓸 땐 비중과 기간을 더 보수적으로 잡으세요.</div>';
  $("chScen").innerHTML = html;
  if (typeof snapAttach === "function") snapAttach();
}
function chScenText(onlyNow) {
  var scen = (chState.scen || []).filter(function (sc) { return !onlyNow || sc.now; });
  if (!scen.length) scen = (chState.scen || []).slice(0, 1);
  if (!scen.length) return "";
  var now = chState.now || { why: [] }, L = ["🧭 상황별 과거 사례"];
  if (now.why.length) L.push("지금: " + now.why.join(" / "));
  scen.forEach(function (sc) {
    L.push(""); L.push(sc.icon + " " + sc.tag + (sc.now ? " (지금과 비슷)" : "")); L.push(sc.lesson);
    sc.eps.forEach(function (ep) {
      L.push("· " + ep.name + ": " + ep.st.map(function (x) { return x.name + " " + chPct(x.ret, 0); }).join(", "));
      if (ep.worst.fwd != null && ep.best.fwd != null) L.push("  → 버틴 " + ep.best.name + "를 팔아 빠진 " + ep.worst.name + "를 샀다면 1년 뒤 " + chPct(ep.worst.fwd, 0) + " (그대로 뒀다면 " + chPct(ep.best.fwd, 0) + ")");
      var stocks = ep.st.filter(function (x) { return /^(NVDA|AAPL|TSLA)$/.test(x.sym); });
      if (stocks.length) L.push("  → " + stocks.map(function (x) { return x.name + " 최대 " + chPct(x.dd, 0) + ", " + chFmtRec(x); }).join(" / "));
    });
  });
  L.push(""); L.push("※ 과거 데이터 기준. 같은 결과를 보장하지 않으며, 레버리지 상품은 변동성 손실에 유의.");
  return L.join("\n");
}

/* ---------- 메모·전체 글 ---------- */
var CH_NOTES = [["alloc", "③ 자산배분·전략 메모"], ["estate", "④ 부동산 메모"], ["reading", "⑤ 자료·독서·아이디어 메모"]];
function chNotes() { return chLoad(CH_KEY.notes, {}); }
function chFullText(short) {
  var d = chState.daily, notes = chNotes(), parts = [];
  if (d && d.ok) parts.push(short ? d.text.split("\n■ 종목")[0].trim() : d.text);
  var mdd = chMddText(); if (mdd && !short) parts.push(mdd);
  var al = chAllocText(); if (al && !short) parts.push(al);
  var sc = chScenText(true); if (sc && !short) parts.push(sc);
  if (notes.alloc) parts.push("💭 전략 메모\n" + notes.alloc);
  if (notes.estate && !short) parts.push("🏠 부동산\n" + notes.estate);
  if (notes.reading && !short) parts.push("📚 자료·아이디어\n" + notes.reading);
  var t = parts.join("\n\n");
  if (short && t.length > 480) t = t.slice(0, 470).replace(/\n[^\n]*$/, "") + "\n…(전문은 링크)";
  return t;
}
function chUpdateCount() {
  var full = chFullText(false), s = chFullText(true);
  $("chCount").textContent = "전체 " + full.length + "자 · 스레드용 " + s.length + "자" + (s.length > 500 ? " (500자 초과)" : "");
}

function renderChannel() {
  if (chState._init) return;
  chState._init = true;
  // 메모 칸
  var notes = chNotes();
  $("chNotes").innerHTML = CH_NOTES.map(function (n) {
    return '<div style="margin-top:12px"><label class="hLbl" style="display:block;margin-bottom:4px">' + n[1] + '</label>' +
      '<textarea class="chNote" data-k="' + n[0] + '" rows="4" placeholder="오늘 올릴 내용을 적어 두면 전체 글에 같이 들어가요. 이 기기에만 저장돼요."></textarea></div>';
  }).join("");
  Array.prototype.forEach.call(document.querySelectorAll(".chNote"), function (ta) {
    ta.value = notes[ta.getAttribute("data-k")] || "";
    ta.oninput = function () { var n = chNotes(); n[ta.getAttribute("data-k")] = ta.value; chSave(CH_KEY.notes, n); chUpdateCount(); };
  });
  $("chDailyCopy").onclick = function () { if (chState.daily && chState.daily.ok) chCopy(chState.daily.text, this); };
  $("chDailyReload").onclick = function () { chLoadDaily(true).then(chUpdateCount); };
  $("chMddApply").onclick = function () {
    var list = $("chMddInput").value.split(/[,\s]+/).map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean).slice(0, 12);
    chSave(CH_KEY.mdd, list); chLoadMdd().then(chUpdateCount);
  };
  $("chMddCopy").onclick = function () { chCopy(chMddText(), this); };
  $("chAllocCopy").onclick = function () { chCopy(chAllocText(), this); };
  $("chFullCopy").onclick = function () { chCopy(chFullText(false), this); };
  $("chShortCopy").onclick = function () { chCopy(chFullText(true), this); };
  dataReady().then(function () {
    return Promise.all([chLoadDaily(false), chLoadAlloc(), chLoadMdd()]);
  }).then(chLoadScenarios).then(chUpdateCount);
  $("chScenCopy").onclick = function () { chCopy(chScenText(false), this); };
}
