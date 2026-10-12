/* ============================================================
   선별 종목 (v10.1) — 하루 등락이 아니라 여러 데이터를 겹쳐서 고른다
   1차(모든 종목·즉시): 추세(20·50·200일선) · 위치(고점 대비·52주) · RSI · 1·3개월 흐름 · 거래대금 · 변동성
   2차(상위 후보만·비동기): PER·PBR·ROE·배당·컨센서스 목표가·외국인 수급(/api/fund) + 최근 기사 톤(/api/news)
   결과: 매수 후보 5 · 주의 종목 5 — 각 종목마다 '왜'를 항목별 판정표로 보여준다 (화면 전용, 카드 아님)
   ※ 데이터로 고른 후보이며 투자 판단과 책임은 본인에게.
   ============================================================ */
var PK = { result: null, key: null, loading: false, fund: {}, news: {} };
var PK_TOPN = 7;        // 2차 확인(재무·기사)을 돌릴 후보 수 (매수·주의 각각)
var PK_GOOD = /호실적|실적 개선|흑자|수주|상향|목표가 상향|신고가|사상 최대|증설|자사주|배당 확대|매수 추천|성장|점유율 확대|승인|계약/;
var PK_BAD = /하향|적자|감소|소송|유상증자|하한가|조사|압수수색|리콜|파업|경고|제재|과징금|횡령|배임|상장폐지|감자|급락|불확실|우려|경고/;

function pkRound(x, d) { return x == null || !isFinite(x) ? null : Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0); }
function pkPct(x, d) { return x == null ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }

/* ---------- 1차: 기술 점수 (동기) ---------- */
function pkTech(s) {
  var buy = [], warn = [], isCoin = /-USD$/.test(s.sym);
  function B(t, d, pts) { buy.push({ t: t, d: d, pts: pts }); }
  function W(t, d, pts) { warn.push({ t: t, d: d, pts: pts }); }
  var trend = (s.above200 ? 1 : 0) + (s.above50 ? 1 : 0) + (s.above20 ? 1 : 0);
  var mas = [s.above20 ? "20일선 위" : "20일선 아래", s.above50 == null ? null : s.above50 ? "50일선 위" : "50일선 아래", s.above200 == null ? null : s.above200 ? "200일선 위" : "200일선 아래"].filter(Boolean).join(" · ");
  // 추세
  if (s.above200 && s.above50 && s.above20) B("추세", mas + " — 정배열", 3);
  else if (s.above200 && s.above20) B("추세", mas, 2);
  else if (s.above200 === false && s.above50 === false && !s.above20) W("추세", mas + " — 역배열", 3);
  else if (!s.above20 && s.above50 === false) W("추세", mas, 2);
  else { (s.above200 ? B : W)("추세", mas, 1); }
  if (s.ma50 && s.ma200) { if (s.ma50 > s.ma200) B("중기선", "50일선이 200일선 위 (골든크로스 상태)", 1); else W("중기선", "50일선이 200일선 아래 (데드크로스 상태)", 1); }
  // 위치
  if (s.vsHi != null) {
    if (s.vsHi >= -0.03 && s.newHigh) B("위치", "52주 신고가 — 고점 돌파", 2);
    else if (s.vsHi > -0.08) B("위치", "고점 대비 " + pkPct(s.vsHi, 0) + " — 고점 근처", 1);
    else if (s.vsHi >= -0.25 && s.above200) B("위치", "고점 대비 " + pkPct(s.vsHi, 0) + " — 추세 안의 눌림", 2);
    else if (s.vsHi <= -0.4) W("위치", "고점 대비 " + pkPct(s.vsHi, 0) + " — 추세 붕괴 구간", 2);
    else if (s.vsHi <= -0.25) W("위치", "고점 대비 " + pkPct(s.vsHi, 0), 1);
    if (s.newLow) W("52주", "52주 신저가 경신", 2);
  }
  // RSI
  if (s.rsi != null) {
    var r = Math.round(s.rsi);
    if (r >= 75) W("RSI", "RSI " + r + " — 과열(75↑)", 2);
    else if (r >= 68) W("RSI", "RSI " + r + " — 과열 근접", 1);
    else if (r <= 30 && s.above200) B("RSI", "RSI " + r + " — 장기 추세 안의 과매도(반등 후보)", 2);
    else if (r <= 30) W("RSI", "RSI " + r + " — 과매도지만 추세가 아래", 1);
    else if (r >= 45 && r <= 65) B("RSI", "RSI " + r + " — 건강한 구간(45~65)", 1);
  }
  // 흐름
  if (s.m1 > 0 && s.m3 > 0) B("흐름", "1개월 " + pkPct(s.m1, 0) + " · 3개월 " + pkPct(s.m3, 0) + " — 둘 다 플러스", 1);
  else if (s.m1 < -0.1 && s.m3 < -0.1) W("흐름", "1개월 " + pkPct(s.m1, 0) + " · 3개월 " + pkPct(s.m3, 0) + " — 둘 다 큰 마이너스", 1);
  if (s.m1 >= 0.3) W("과열", "1개월 " + pkPct(s.m1, 0) + " — 한 달 30% 넘게 급등", 2);
  else if (s.m1 >= 0.2) W("과열", "1개월 " + pkPct(s.m1, 0) + " — 급등 뒤 조정 위험", 1);
  if (s.vsMa20 >= 0.15) W("이격", "20일선 위 " + pkPct(s.vsMa20, 0) + " — 평균에서 너무 멀다", 2);
  else if (s.vsMa20 >= 0.08) W("이격", "20일선 위 " + pkPct(s.vsMa20, 0), 1);
  else if (s.vsMa20 >= -0.03 && s.vsMa20 <= 0.05 && s.above20) B("이격", "20일선 " + pkPct(s.vsMa20, 0) + " — 평균 근처에서 매수 가능", 1);
  if (s.ret5 != null && s.ret5 <= -0.1) W("단기", "1주 " + pkPct(s.ret5, 0) + " — 급락 중", 1);
  if (s.crossUp) B("신호", "오늘 20일선 회복", 1);
  // 거래대금
  if (s.amtX != null) {
    if (s.amtX >= 4 && s.vsMa20 >= 0.08) W("거래", "거래대금 평소의 " + s.amtX.toFixed(1) + "배 + 급등 — 투기성 과열", 2);
    else if (s.amtX >= 1.5 && s.amtX < 4 && s.ret1 > 0) B("거래", "거래대금 평소의 " + s.amtX.toFixed(1) + "배 — 돈이 들어옴", 1);
    else if (s.amtX < 0.5) W("거래", "거래대금 평소의 " + s.amtX.toFixed(1) + "배 — 관심 식음", 1);
  }
  // 변동성
  if (s.sd != null) { if (s.sd < (isCoin ? 0.03 : 0.02)) B("변동", "하루 변동 " + (s.sd * 100).toFixed(1) + "% — 조용한 편", 1); else if (s.sd > (isCoin ? 0.07 : 0.045)) W("변동", "하루 변동 " + (s.sd * 100).toFixed(1) + "% — 거친 편", 1); }
  var bs = buy.reduce(function (a, x) { return a + x.pts; }, 0), ws = warn.reduce(function (a, x) { return a + x.pts; }, 0);
  return { s: s, buy: buy, warn: warn, bs: bs, ws: ws, score: bs - ws };
}
function pkCompute(R) {
  var S = (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym) && s.last > 0 && !/ETF|지수|전체시장|KODEX|TIGER|ACE |SOL /.test(s.name || "") && !/^(SPY|VOO|QQQ|VTI|SCHD|JEPI|TLT|IEF|SHY|GLD|SLV|USO|DBC)$/.test(s.sym) && !/(069500|360750|133690|229200|102110)\.KS$/.test(s.sym); });   // 개별 종목·코인만 (지수·ETF는 '종목 선별' 대상이 아님)
  var all = S.map(pkTech);
  // 매수 후보: 플러스 항목이 많고 마이너스가 적은 순 / 주의: 마이너스가 많은 순 (단, 하루 등락 자체는 점수에 없다)
  var buy = all.filter(function (x) { return x.bs >= 4 && x.ws <= 2; }).sort(function (a, b) { return (b.bs - b.ws) - (a.bs - a.ws) || b.bs - a.bs; }).slice(0, PK_TOPN);
  var warn = all.filter(function (x) { return x.ws >= 4; }).sort(function (a, b) { return (b.ws - b.bs) - (a.ws - a.bs) || b.ws - a.ws; }).slice(0, PK_TOPN);
  var seen = {}; buy.forEach(function (x) { seen[x.s.sym] = 1; }); warn = warn.filter(function (x) { return !seen[x.s.sym]; });
  return { buy: buy, warn: warn, total: all.length, market: R.market, asOf: R.asOf, enriched: false, at: Date.now() };
}

/* ---------- 2차: 재무·수급·기사 (비동기, 상위 후보만) ---------- */
function pkFund(sym) {
  if (/-USD$/.test(sym)) return Promise.resolve(null);
  if (PK.fund[sym] && Date.now() - PK.fund[sym].at < 6 * 3600e3) return Promise.resolve(PK.fund[sym].d);
  try { var c = JSON.parse(localStorage.getItem("sm.fund:" + sym) || "null"); if (c && Date.now() - c.at < 12 * 3600e3) { PK.fund[sym] = c; return Promise.resolve(c.d); } } catch (e) {}
  return fetch("/api/fund?symbol=" + encodeURIComponent(sym)).then(function (r) { return r.json(); }).then(function (d) {
    var slim = pkSlimFund(d); PK.fund[sym] = { at: Date.now(), d: slim };
    try { localStorage.setItem("sm.fund:" + sym, JSON.stringify(PK.fund[sym])); } catch (e) {}
    return slim;
  }).catch(function () { return null; });
}
function pkNum(v) { if (v == null) return null; if (typeof v === "object") v = v.value; if (typeof v === "number") return v; var n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? n : null; }
function pkSlimFund(d) {
  if (!d || !d.ok) return null;
  var I = d.info || {};
  function g(keys) { for (var i = 0; i < keys.length; i++) { var v = pkNum(I[keys[i]]); if (v != null) return v; } return null; }
  var out = { per: g(["per", "perTtm", "peRatio", "priceEarningRatio"]), cnsPer: g(["cnsPer"]), eps: g(["eps", "epsTtm", "earningPerShare"]), pbr: g(["pbr", "pbRatio", "priceBookRatio"]), roe: g(["roe", "returnOnEquity"]), div: g(["dividendYieldRatio", "dividendYield"]), frgn: g(["foreignRate"]), close: g(["lastClosePrice", "closePrice"]) };
  var c = d.consensus || {}; out.target = pkNum(c.priceTargetMean || c.targetPrice || c.priceTarget); out.opinion = c.recommMean || c.recommendMean || c.opinion || null; out.analysts = pkNum(c.analystCount || c.count);
  // 외국인·기관 최근 5일 순매수 합 (국내)
  var list = Array.isArray(d.trend) ? d.trend : d.trend && (d.trend.result || d.trend.datas) || null;
  if (Array.isArray(list) && list.length) {
    function pick(o, re) { var ks = Object.keys(o); for (var i = 0; i < ks.length; i++) if (re.test(ks[i])) return pkNum(o[ks[i]]); return null; }
    var f5 = 0, o5 = 0, n = 0;
    list.slice(0, 5).forEach(function (o) { var f = pick(o, /foreign.*(pure|net).*(buy|quant)|frgn_pure/i), g2 = pick(o, /(organ|institution).*(pure|net).*(buy|quant)|organ_pure/i); if (f != null || g2 != null) { n++; f5 += f || 0; o5 += g2 || 0; } });
    if (n) { out.frgn5 = f5; out.org5 = o5; out.trendDays = n; }
  }
  return out;
}
function pkNews(s) {
  var name = briefName(s), key = name;
  if (PK.news[key] && Date.now() - PK.news[key].at < 30 * 60e3) return Promise.resolve(PK.news[key].items);
  if (typeof fetchNews !== "function") return Promise.resolve([]);
  return fetchNews({ type: "stock", q: name, size: 4 }).then(function (items) { items = (items || []).slice(0, 4); PK.news[key] = { at: Date.now(), items: items }; return items; }).catch(function () { return []; });
}
function pkEnrichOne(x) {
  var s = x.s;
  return Promise.all([pkFund(s.sym), pkNews(s)]).then(function (r) {
    var f = r[0], news = r[1]; x.fund = f; x.news = news; x.fin = []; x.press = [];
    function B(t, d, pts) { x.fin.push({ t: t, d: d, pts: pts, side: "buy" }); x.bs += pts; }
    function W(t, d, pts) { x.fin.push({ t: t, d: d, pts: pts, side: "warn" }); x.ws += pts; }
    function N(t, d, pts) { x.fin.push({ t: t, d: d, pts: 0, side: "info" }); }
    if (f) {
      if (f.per != null) { if (f.per > 0 && f.per < 12) B("PER", "PER " + f.per.toFixed(1) + "배 — 이익 대비 싼 편", 1); else if (f.per > 0 && f.per <= 25) N("PER", "PER " + f.per.toFixed(1) + "배 — 보통"); else if (f.per > 60) W("PER", "PER " + f.per.toFixed(0) + "배 — 이익 대비 매우 비쌈", 1); else if (f.per < 0 || (f.eps != null && f.eps < 0)) W("PER", "적자(EPS 마이너스) — PER 계산 불가", 1); else N("PER", "PER " + f.per.toFixed(1) + "배"); }
      else if (f.eps != null && f.eps < 0) W("이익", "EPS 마이너스 — 적자", 1);
      if (f.pbr != null) { if (f.pbr > 0 && f.pbr < 1) B("PBR", "PBR " + f.pbr.toFixed(2) + "배 — 장부가 아래", 1); else if (f.pbr > 8) W("PBR", "PBR " + f.pbr.toFixed(1) + "배 — 자산 대비 매우 비쌈", 1); else N("PBR", "PBR " + f.pbr.toFixed(2) + "배"); }
      if (f.roe != null) { if (f.roe >= 15) B("ROE", "ROE " + f.roe.toFixed(1) + "% — 자본 효율 높음", 1); else if (f.roe < 0) W("ROE", "ROE " + f.roe.toFixed(1) + "% — 자본 까먹는 중", 1); else N("ROE", "ROE " + f.roe.toFixed(1) + "%"); }
      if (f.div != null && f.div >= 3) B("배당", "배당수익률 " + f.div.toFixed(1) + "% — 기다리는 동안 배당", 1);
      if (f.target != null && s.last > 0) { var up = f.target / s.last - 1; if (Math.abs(up) < 3) { if (up >= 0.2) B("목표가", "증권사 목표가 평균까지 " + pkPct(up, 0) + (f.analysts ? " (" + f.analysts + "명)" : ""), 1); else if (up < 0) W("목표가", "현재가가 증권사 목표가 평균보다 " + pkPct(-up, 0) + " 높음", 1); else N("목표가", "증권사 목표가 평균까지 " + pkPct(up, 0)); } }
      if (f.frgn5 != null) { if (f.frgn5 > 0 && f.org5 > 0) B("수급", "최근 " + f.trendDays + "일 외국인·기관 동반 순매수", 2); else if (f.frgn5 > 0) B("수급", "최근 " + f.trendDays + "일 외국인 순매수", 1); else if (f.frgn5 < 0 && f.org5 < 0) W("수급", "최근 " + f.trendDays + "일 외국인·기관 동반 순매도", 2); else if (f.frgn5 < 0) W("수급", "최근 " + f.trendDays + "일 외국인 순매도", 1); }
      if (f.frgn != null && f.frgn >= 30) N("외국인", "외국인 보유 " + f.frgn.toFixed(1) + "%");
    } else if (!/-USD$/.test(s.sym)) N("재무", "재무 지표 미제공 — 가격 기준만 반영");
    if (news.length) {
      var good = 0, bad = 0;
      news.forEach(function (it) { var t = it.title || ""; if (PK_GOOD.test(t)) good++; if (PK_BAD.test(t)) bad++; });
      if (good && !bad) B("기사", "최근 기사 " + news.length + "건 중 긍정 키워드 " + good + "건", 1);
      else if (bad && !good) W("기사", "최근 기사 " + news.length + "건 중 부정 키워드 " + bad + "건", 1);
      else if (good && bad) N("기사", "기사 " + news.length + "건 — 긍정 " + good + " · 부정 " + bad + " 엇갈림");
      else N("기사", "최근 기사 " + news.length + "건 — 뚜렷한 톤 없음");
    } else N("기사", "최근 관련 기사 없음");
    x.score = x.bs - x.ws; x.done = true;
    return x;
  });
}
function pkEnsure(R) {
  var key = (R.market || "all") + "|" + (R.asOf || "") + "|" + (R.mode || "");
  if (PK.result && PK.key === key) return PK.enrichP || Promise.resolve(PK.result);
  PK.key = key; PK.result = pkCompute(R); PK.loading = true;
  var res = PK.result;
  PK.enrichP = Promise.all(res.buy.concat(res.warn).map(pkEnrichOne)).then(function () {
    if (PK.result !== res) return PK.result;
    res.buy.sort(function (a, b) { return b.score - a.score; }); res.warn.sort(function (a, b) { return (b.ws - b.bs) - (a.ws - a.bs); });
    // 2차에서 뒤집힌 후보는 빼고 5개씩
    res.buy = res.buy.filter(function (x) { return x.score >= 3; }).slice(0, 5); res.warn = res.warn.filter(function (x) { return x.ws - x.bs >= 3; }).slice(0, 5);
    res.enriched = true; PK.loading = false;
    if (typeof pkRender === "function" && typeof briefState !== "undefined" && briefState.result === R) pkRender(R);
    return res;
  });
  return PK.enrichP;
}
/* 다른 모듈(오늘 한 장)용: 준비된 결과만 */
function pkReady(R) { var key = (R.market || "all") + "|" + (R.asOf || "") + "|" + (R.mode || ""); return PK.result && PK.key === key && PK.result.enriched ? PK.result : null; }
function pkTopReason(x, side) { var l = (side === "buy" ? x.buy : x.warn).concat((x.fin || []).filter(function (f) { return f.side === side; })).sort(function (a, b) { return b.pts - a.pts; }); return l[0] ? l[0].t + " · " + l[0].d.split(" — ")[0] : ""; }

/* ---------- 화면 ---------- */
function pkRender(R) {
  var box = document.getElementById("briefSelect"); if (!box) return;
  var res = PK.result && PK.key === ((R.market || "all") + "|" + (R.asOf || "") + "|" + (R.mode || "")) ? PK.result : null;
  if (!res) { pkEnsure(R); res = PK.result; }
  var unit = R.market === "coin" ? "코인" : "종목";
  function item(x, side) {
    var s = x.s, pos = x.buy.concat((x.fin || []).filter(function (f) { return f.side === "buy"; })), neg = x.warn.concat((x.fin || []).filter(function (f) { return f.side === "warn"; })), info = (x.fin || []).filter(function (f) { return f.side === "info"; });
    var main = side === "buy" ? pos : neg, top = main.slice().sort(function (a, b) { return b.pts - a.pts; }).slice(0, 3);
    var sc = side === "buy" ? "+" + x.bs + " / -" + x.ws : "-" + x.ws + " / +" + x.bs;
    var open = PK.open === s.sym;
    var h = '<div class="pkItem' + (open ? ' open' : '') + '" data-pk-sym="' + s.sym + '"><div class="pkHead"><div class="pkName">' + briefSymLink(s) + ' <span class="pkPrice">' + (typeof cPrice === "function" ? cPrice(s.sym, s.last) : "") + ' <span style="color:' + briefColor(s.ret1) + '">' + briefPct(s.ret1) + '</span></span></div><div class="pkScore ' + side + '" title="플러스 점수 / 마이너스 점수">' + sc + '</div></div>';
    h += '<div class="pkTags">' + top.map(function (r) { return '<span class="pkTag ' + side + '">' + escapeHtml(r.t) + ' · ' + escapeHtml(r.d.split(" — ")[0]) + '</span>'; }).join("") + (x.done ? '' : '<span class="pkTag wait">재무·기사 확인 중…</span>') + '</div>';
    h += '<button class="linkBtn pkMore" data-pk-more="' + s.sym + '">' + (open ? "접기 ▴" : "왜 이 " + unit + "? 판정표 보기 ▾") + '</button>';
    if (open) {
      h += '<div class="pkDetail"><table class="pkTable"><thead><tr><th>항목</th><th>데이터</th><th>판정</th></tr></thead><tbody>';
      pos.forEach(function (r) { h += '<tr><td>' + escapeHtml(r.t) + '</td><td>' + escapeHtml(r.d) + '</td><td class="pos">+' + r.pts + '</td></tr>'; });
      neg.forEach(function (r) { h += '<tr><td>' + escapeHtml(r.t) + '</td><td>' + escapeHtml(r.d) + '</td><td class="neg">-' + r.pts + '</td></tr>'; });
      info.forEach(function (r) { h += '<tr><td>' + escapeHtml(r.t) + '</td><td>' + escapeHtml(r.d) + '</td><td class="briefDim">참고</td></tr>'; });
      h += '</tbody></table>';
      h += '<div class="pkNums">' + [["종가", typeof cPrice === "function" ? cPrice(s.sym, s.last) : ""], ["1주", pkPct(s.ret5, 0)], ["1개월", pkPct(s.m1, 0)], ["3개월", pkPct(s.m3, 0)], ["고점 대비", pkPct(s.vsHi, 0)], ["20일선", pkPct(s.vsMa20, 0)], ["RSI", s.rsi != null ? Math.round(s.rsi) : "-"], ["거래대금", s.amtX != null ? s.amtX.toFixed(1) + "배" : "-"]].map(function (a) { return '<span><small>' + a[0] + '</small><b>' + a[1] + '</b></span>'; }).join("") + '</div>';
      if (x.news && x.news.length) h += '<div class="pkNews">' + x.news.map(function (it) { return '<a class="briefNewsLink" href="' + it.url + '" target="_blank" rel="noopener">📰 ' + escapeHtml(it.title) + '</a>' + (it.press ? ' <small class="briefDim">' + escapeHtml(it.press) + '</small>' : ''); }).join("<br>") + '</div>';
      h += '<div class="row" style="gap:6px;margin-top:8px"><button class="chip briefSym" data-sym="' + s.sym + '">📈 차트·재무 자세히</button><button class="chip briefWatch" data-sym="' + s.sym + '" data-name="' + escapeHtml(s.name) + '">☆ 관심</button></div></div>';
    }
    return h + '</div>';
  }
  var status = res.enriched ? "1차 " + res.total + "개 " + unit + " 기술 점수 → 상위 후보 재무(PER·PBR·ROE·배당·목표가·수급)·기사까지 확인 완료" : "1차 " + res.total + "개 " + unit + " 기술 점수 완료 → 상위 후보 재무·기사 확인 중…";
  box.innerHTML = '<div class="briefPickIntro">' + status + ' · 하루 등락은 점수에 넣지 않아요</div>' +
    '<div class="briefTwoCol pkCols"><div><div class="briefColTitle" style="color:var(--up)">🟢 매수 후보 <small>' + res.buy.length + '</small></div>' + (res.buy.length ? res.buy.map(function (x) { return item(x, "buy"); }).join("") : '<div class="briefDim">조건(플러스 4점 이상·마이너스 2점 이하)에 드는 ' + unit + '이 없어요</div>') + '</div>' +
    '<div><div class="briefColTitle" style="color:var(--down)">🔴 주의 ' + unit + ' <small>' + res.warn.length + '</small></div>' + (res.warn.length ? res.warn.map(function (x) { return item(x, "warn"); }).join("") : '<div class="briefDim">마이너스 4점 이상인 ' + unit + '이 없어요</div>') + '</div></div>' +
    '<div class="briefDim" style="margin-top:8px">점수표: 추세(20·50·200일선) · 위치(고점 대비·52주) · RSI · 1·3개월 흐름 · 20일선 이격 · 거래대금 · 변동성 + PER·PBR·ROE·배당·증권사 목표가·외국인/기관 수급(국내) · 최근 기사 키워드 — 데이터로 고른 후보이며 투자 판단과 책임은 본인에게 있어요</div>';
  Array.prototype.forEach.call(box.querySelectorAll("[data-pk-more]"), function (b) { b.onclick = function () { var k = b.getAttribute("data-pk-more"); PK.open = PK.open === k ? null : k; pkRender(R); }; });
  Array.prototype.forEach.call(box.querySelectorAll(".briefSym"), function (b) { b.onclick = function () { document.getElementById("searchInput").value = b.getAttribute("data-sym"); if (typeof navTo === "function") navTo("single", "chart"); else switchTab("single", "chart"); if (typeof load === "function") load(); }; });
  Array.prototype.forEach.call(box.querySelectorAll(".briefWatch"), function (b) { b.onclick = function () { if (typeof toggleWatch === "function") { toggleWatch(b.getAttribute("data-sym"), b.getAttribute("data-name")); b.textContent = "★ 담김"; b.disabled = true; } }; });
}
