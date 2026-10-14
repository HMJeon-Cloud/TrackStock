/* ============================================================
   공시 · 구루 (v11.2) — 관심 탭 안 '공시' · '구루'
   ① 공시: 등록 국내 종목의 임원·주요주주 지분 변동 · 5% 대량보유 · 자사주 취득/처분/소각 (DART, 매일 아침 수집)
   ② 구루: 주요 투자자 13F 분기 보유 — 새로 산 · 더 산 · 줄인 · 다 판 종목 (SEC, 새 보고서가 올라오면 수집)
   데이터: /api/snap?disc=1 · ?guru=1 (Redis · CDN 캐시) — 새 함수·크론 없음, 아침 수집 크론 안에서 같이 받는다
   카드(운영자): 양식집 4종 + 묶음 2종(공시 · 구루) + 업로드 글
   ============================================================ */
var DS = { disc: null, guru: null, loading: null, err: null, f: { k: "all", days: 30, mine: false }, g: { id: null } };
var DS_K = { insider: "임원·주요주주", major: "5% 대량보유", buyback: "자사주 취득", trust: "자사주 신탁", dispose: "자사주 처분", cancel: "자사주 소각" };
var DS_DAY = 86400e3;
(function () { try { var j = JSON.parse(localStorage.getItem("sm.disc") || "null"); if (j) { if (j.f) Object.assign(DS.f, j.f); if (j.g) Object.assign(DS.g, j.g); } } catch (e) {} })();
function dsSave() { try { localStorage.setItem("sm.disc", JSON.stringify({ f: DS.f, g: DS.g })); } catch (e) {} }

/* ---------- 표기 ---------- */
function dsEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function dsWon(v) {
  if (v == null || !isFinite(v)) return "-"; var n = v < 0, a = Math.abs(v), s;
  if (a >= 1e12) s = (a / 1e12).toFixed(a >= 1e13 ? 0 : 1) + "조"; else if (a >= 1e8) s = (a >= 1e10 ? Math.round(a / 1e8).toLocaleString("ko-KR") : (a / 1e8).toFixed(1)) + "억"; else if (a >= 1e4) s = Math.round(a / 1e4).toLocaleString("ko-KR") + "만"; else s = Math.round(a).toLocaleString("ko-KR");
  return (n ? "-" : "") + s + "원";
}
function dsUsd(v) { if (v == null || !isFinite(v)) return "-"; var n = v < 0, a = Math.abs(v), s = a >= 1e9 ? "$" + (a / 1e9).toFixed(a >= 1e11 ? 0 : 1) + "B" : a >= 1e6 ? "$" + Math.round(a / 1e6).toLocaleString("en-US") + "M" : "$" + Math.round(a / 1e3).toLocaleString("en-US") + "K"; return (n ? "-" : "") + s; }
function dsSh(v) { if (v == null || !isFinite(v)) return "-"; return (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "주"; }
function dsPct(x, d) { return x == null || !isFinite(x) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function dsYmd(d) { d = String(d || ""); return d.length >= 8 ? +d.slice(4, 6) + "." + +d.slice(6, 8) : d; }
function dsT(d) { d = String(d || ""); return Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)) - 9 * 3600e3; }
function dsJ(w, a, b) { var c = String(w || "").trim().slice(-1).charCodeAt(0); var bat = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 !== 0 : /[0-9LMNR]$/i.test(String(w).trim()); return w + (bat ? a : b); }
function dsKo(sym) { if (typeof BRIEF_KO !== "undefined" && BRIEF_KO[sym]) return BRIEF_KO[sym].replace(/\s*\(.*?\)\s*/g, "").trim(); if (typeof TICKER_DICT !== "undefined") for (var i = 0; i < TICKER_DICT.length; i++) if (TICKER_DICT[i][0] === sym) return TICKER_DICT[i][1]; return null; }
/* 13F 종목명: 등록된 티커면 한글명, 아니면 영문을 보기 좋게 */
function dsIss(x) {
  var ko = x.t ? dsKo(x.t) : null; if (ko) return ko;
  return String(x.n || "").toLowerCase().replace(/\b(inc|corp|co|ltd|plc|hldgs|del|new|com|cl a|cl b|class a|class b)\b\.?/g, "").replace(/\s+/g, " ").trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || x.n;
}
function dsPrice(sym) { var r = typeof DATA !== "undefined" && DATA.recentData; var d = (r && r.symbols && r.symbols[sym]) || null; if (!d && typeof briefState !== "undefined" && briefState.recent) d = briefState.recent.symbols[sym]; if (!d || !d.c) return null; for (var i = d.c.length - 1; i >= 0; i--) if (d.c[i] > 0) return d.c[i]; return null; }
function dsVal(it) { if (it.k !== "insider" && it.k !== "major") return it.amt || null; var p = dsPrice(it.sym); return p && it.chg ? it.chg * p : null; }
function dsDart(id) { return "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + encodeURIComponent(id); }

/* ---------- 데이터 ---------- */
function dsEnsure() {
  if (DS.disc && DS.guru) return Promise.resolve();
  if (DS.loading) return DS.loading;
  function get(q) { return fetch("/api/snap?" + q + "=1").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  var rec = typeof fetchRecent === "function" ? fetchRecent().then(function (r) { if (r && typeof DATA !== "undefined") DATA.recentData = r; }).catch(function () {}) : Promise.resolve();
  DS.loading = Promise.all([get("disc"), get("guru"), rec]).then(function (a) { DS.disc = a[0] || { items: [], none: true }; DS.guru = a[1] || { gurus: [], none: true }; DS.loading = null; });
  return DS.loading;
}
function dsMine() { var s = {}; try { (typeof loadHoldings === "function" ? loadHoldings().lots : []).forEach(function (L) { s[L.s] = 1; }); } catch (e) {} try { (typeof loadWatch === "function" ? loadWatch() : []).forEach(function (x) { s[x.s] = 1; }); } catch (e) {} return s; }
function dsItems(days, k, mine) {
  var now = Date.now(), my = mine ? dsMine() : null;
  return ((DS.disc && DS.disc.items) || []).filter(function (it) {
    if (days && dsT(it.d) < now - days * DS_DAY) return false;
    if (k === "insider" && it.k !== "insider") return false; if (k === "major" && it.k !== "major") return false; if (k === "own" && !/buyback|trust|dispose|cancel/.test(it.k)) return false;
    if (my && !my[it.sym]) return false; return true;
  });
}
function dsSide(it) { if (/buyback|trust/.test(it.k)) return "buy"; if (/dispose/.test(it.k)) return "sell"; if (it.k === "cancel") return "cancel"; return it.chg > 0 ? "buy" : it.chg < 0 ? "sell" : "zero"; }
var DS_SIDE = { buy: "매수", sell: "매도", zero: "변동", cancel: "소각" };

/* ============================================================ ① 공시 화면 ============================================================ */
function renderDisc() {
  var box = document.getElementById("discBody"); if (!box) return;
  if (!DS.disc) { box.innerHTML = '<div class="dvEmpty">공시를 불러오는 중…</div>'; dsEnsure().then(renderDisc); return; }
  var F = DS.f, all = dsItems(F.days, "all", F.mine), L = dsItems(F.days, F.k, F.mine);
  if (DS.disc.none || !(DS.disc.items || []).length) { box.innerHTML = '<div class="dvEmpty">아직 수집된 공시가 없어요. 매일 아침 수집이 돌면 등록된 국내 종목의 임원·대주주 지분 변동과 자사주 공시가 여기에 모여요.</div>'; return; }
  var ins = all.filter(function (x) { return x.k === "insider"; }), ib = ins.filter(function (x) { return x.chg > 0; }), is = ins.filter(function (x) { return x.chg < 0; });
  var bb = all.filter(function (x) { return /buyback|trust/.test(x.k); }), bbAmt = bb.reduce(function (s, x) { return s + (x.amt || 0); }, 0);
  var vb = ib.reduce(function (s, x) { return s + (dsVal(x) || 0); }, 0), vs = is.reduce(function (s, x) { return s + (dsVal(x) || 0); }, 0);
  var h = '<div class="dvBar2"><div class="pills dvPills">' + [["all", "전체"], ["insider", "임원·주주"], ["major", "5% 보유"], ["own", "자사주"]].map(function (x) { return '<button data-dsk="' + x[0] + '" class="' + (F.k === x[0] ? "active" : "") + '">' + x[1] + '</button>'; }).join("") + '</div>' +
    '<div class="row" style="gap:6px"><select id="dsDays"><option value="7"' + (F.days == 7 ? " selected" : "") + '>최근 7일</option><option value="30"' + (F.days == 30 ? " selected" : "") + '>최근 30일</option><option value="120"' + (F.days == 120 ? " selected" : "") + '>최근 120일</option></select>' +
    '<label class="dvCk" style="grid-column:auto"><input type="checkbox" id="dsMine"' + (F.mine ? " checked" : "") + '> 내 종목만</label></div></div>' +
    '<div class="kpiStrip">' + dvKpiDs("임원·주요주주 매수", ib.length + "<small>건</small>", vb ? "약 " + dsWon(vb) : "") + dvKpiDs("임원·주요주주 매도", is.length + "<small>건</small>", vs ? "약 " + dsWon(Math.abs(vs)) : "") + dvKpiDs("자사주 취득 결정", bb.length + "<small>건</small>", bbAmt ? dsWon(bbAmt) : "") + dvKpiDs("5% 대량보유 변동", all.filter(function (x) { return x.k === "major"; }).length + "<small>건</small>") + '</div>';
  // 종목별로 모아 보기 (임원·주요주주 순매수 금액)
  var agg = {}; ins.forEach(function (x) { var a = agg[x.sym] || (agg[x.sym] = { sym: x.sym, corp: x.corp, n: 0, sh: 0, v: 0, who: {} }); a.n++; a.sh += x.chg || 0; a.v += dsVal(x) || 0; a.who[x.who] = 1; });
  var A = Object.keys(agg).map(function (k) { return agg[k]; }), top = A.filter(function (a) { return a.v > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 5), bot = A.filter(function (a) { return a.v < 0; }).sort(function (a, b) { return a.v - b.v; }).slice(0, 5);
  if (top.length || bot.length) h += '<div class="mkStep"><b>1</b>회사별로 모아 보기 <small class="briefDim">임원·주요주주 순매수 · 추정 금액 = 주식 수 × 최근 종가</small></div><div class="dsCols">' +
    [["순매수가 많은 회사", top, "pos"], ["순매도가 많은 회사", bot, "neg"]].map(function (c) { return '<div class="dsCol"><div class="dsColH">' + c[0] + '</div>' + (c[1].length ? c[1].map(function (a) { return '<div class="dsAgg"><button class="linkBtn" data-dsopen="' + a.sym + '">' + dsEsc(dsKo(a.sym) || a.corp) + '</button><span class="briefDim">' + Object.keys(a.who).length + '명 · ' + a.n + '건</span><b class="' + c[2] + '">' + dsWon(a.v) + '</b></div>'; }).join("") : '<div class="dvNone">없음</div>') + '</div>'; }).join("") + '</div>';
  h += '<div class="mkStep"><b>' + (top.length || bot.length ? 2 : 1) + '</b>공시 목록 <small class="briefDim">' + L.length + '건 · 최신순</small></div>';
  h += L.length ? '<div class="dsList">' + L.slice(0, 150).map(function (it) {
    var sd = dsSide(it), v = dsVal(it), own = /buyback|trust|dispose|cancel/.test(it.k);
    var chg = /buyback|trust|dispose/.test(it.k) ? (it.qty ? Math.round(it.qty).toLocaleString("ko-KR") + "주" : "") : it.k === "cancel" ? "" : (it.chg != null ? dsSh(it.chg) : "") + (it.rate != null && it.k === "major" ? " · 지분 " + it.rate.toFixed(2) + "%" + (it.rateChg ? " (" + (it.rateChg > 0 ? "+" : "") + it.rateChg.toFixed(2) + "%p)" : "") : "");
    var sub = own ? [it.period, it.purpose].filter(Boolean).join(" · ") : it.k === "major" ? (it.reason || "") : "";
    var who = (it.who || "") + (it.pos ? " · " + it.pos.replace(/\s*·\s*-$/, "") : "");
    return '<div class="dsRow"><div class="dsR1"><span class="dsD">' + dsYmd(it.d) + '</span><button class="linkBtn" data-dsopen="' + it.sym + '">' + dsEsc(dsKo(it.sym) || it.corp) + '</button><span class="dsTag ' + sd + '">' + DS_K[it.k] + (own ? "" : " " + DS_SIDE[sd]) + '</span><b class="dsV ' + (sd === "sell" ? "neg" : sd === "buy" ? "pos" : "") + '">' + (v ? dsWon(Math.abs(v)) : "") + '</b></div>' +
      '<div class="dsR2"><span>' + dsEsc([who, chg, sub].filter(Boolean).join(" · ")) + '</span><a href="' + dsDart(it.id) + '" target="_blank" rel="noopener">원문 ›</a></div></div>';
  }).join("") + '</div>' : '<div class="dvEmpty sm">이 조건에 맞는 공시가 없어요.</div>';
  h += '<details class="howto"><summary>공시 읽는 법</summary><div class="body"><ul>' +
    '<li><b>임원·주요주주</b> 지분 변동에는 장내 매수·매도 말고도 스톡옵션 행사·증여·상속·담보 처분이 섞여 있어요. 이유는 <b>원문</b>에서 확인하세요.</li>' +
    '<li><b>추정 금액</b> = 변동 주식 수 × 최근 종가. 실제 거래 가격과 달라요.</li>' +
    '<li><b>자사주 취득 결정</b>은 계획이에요. 기간 안에 다 사지 않는 경우도 있고, 사들인 뒤 <b>소각</b>해야 주주 몫이 실제로 늘어나요.</li>' +
    '<li>공시는 거래 후 며칠 안에 올라와요. 숫자를 본 때는 이미 가격에 반영됐을 수 있어요.</li>' +
    '<li>매일 아침 DART(금융감독원 전자공시)에서 앱에 등록된 국내 종목만 모아요. 마지막 수집: ' + dsEsc((DS.disc.updated || "").slice(0, 16).replace("T", " ")) + ' (UTC)</li></ul></div></details>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-dsk]"), function (b) { b.onclick = function () { F.k = b.getAttribute("data-dsk"); dsSave(); renderDisc(); }; });
  document.getElementById("dsDays").onchange = function () { F.days = +this.value; dsSave(); renderDisc(); };
  document.getElementById("dsMine").onchange = function () { F.mine = this.checked; dsSave(); renderDisc(); };
  dsBindOpen(box);
}
function dvKpiDs(l, v, s) { return '<div class="kpi"><div class="kl">' + l + '</div><div class="kv">' + v + '</div>' + (s ? '<div class="kl" style="margin-top:2px">' + s + '</div>' : '') + '</div>'; }
function dsBindOpen(box) { Array.prototype.forEach.call(box.querySelectorAll("[data-dsopen]"), function (b) { b.onclick = function () { var s = b.getAttribute("data-dsopen"); if (typeof navTo === "function") navTo("single", "analysis"); var i = document.getElementById("searchInput"); if (i) i.value = s; if (typeof loadSymbol === "function") loadSymbol(s); }; }); }

/* ============================================================ ② 구루 화면 ============================================================ */
function dsGurus() { return ((DS.guru && DS.guru.gurus) || []).filter(function (g) { return g && g.period; }); }
function dsLatest() { return dsGurus().slice().sort(function (a, b) { return (b.filed || "").localeCompare(a.filed || ""); })[0] || null; }
function dsQ(period) { var p = String(period || ""); if (!p) return "-"; var m = +p.slice(5, 7); return p.slice(0, 4) + "년 " + Math.ceil(m / 3) + "분기"; }
var DS_KIND = { new: "새로 매수", add: "추가 매수", trim: "일부 매도", exit: "전량 매도" };
function dsCross() {
  var by = {};
  dsGurus().forEach(function (g) {
    (g.buys || []).forEach(function (m) { var k = m.t || m.n; var x = by[k] || (by[k] = { k: k, t: m.t, n: m.n, b: [], s: [], dv: 0 }); x.b.push(g.nm); x.dv += m.dv; });
    (g.sells || []).forEach(function (m) { var k = m.t || m.n; var x = by[k] || (by[k] = { k: k, t: m.t, n: m.n, b: [], s: [], dv: 0 }); x.s.push(g.nm); x.dv += m.dv; });
  });
  return Object.keys(by).map(function (k) { return by[k]; });
}
function renderGuru() {
  var box = document.getElementById("guruBody"); if (!box) return;
  if (!DS.guru) { box.innerHTML = '<div class="dvEmpty">투자자 보고서를 불러오는 중…</div>'; dsEnsure().then(renderGuru); return; }
  var G = dsGurus();
  if (!G.length) { box.innerHTML = '<div class="dvEmpty">아직 수집된 13F 보고서가 없어요. 수집이 돌면 버핏 등 주요 투자자의 분기 매수·매도가 여기에 정리돼요.</div>'; return; }
  var g = G.filter(function (x) { return x.id === DS.g.id; })[0] || dsLatest(); DS.g.id = g.id;
  var h = '<div class="pills dsGuruPills">' + G.map(function (x) { return '<button data-dsg="' + x.id + '" class="' + (x.id === g.id ? "active" : "") + '">' + dsEsc(x.nm) + '</button>'; }).join("") + '</div>';
  h += '<div class="dsGHead"><div><b>' + dsEsc(g.nm) + '</b> <span class="briefDim">' + dsEsc(g.org) + '</span></div><span class="briefDim">' + dsQ(g.period) + ' 말 기준 · ' + dsEsc(g.filed) + ' 공개' + (g.prevPeriod ? ' · ' + dsQ(g.prevPeriod) + '와 비교' : '') + '</span></div>';
  h += '<div class="kpiStrip">' + dvKpiDs("미국 주식 보유", dsUsd(g.total)) + dvKpiDs("종목 수", (g.n || 0) + "<small>개</small>") + dvKpiDs("새로 산 종목", (g.nNew || 0) + "<small>개</small>") + dvKpiDs("다 판 종목", (g.nExit || 0) + "<small>개</small>") + '</div>';
  var mx = Math.max.apply(null, (g.top || []).map(function (x) { return x.w || 0; }).concat([0.01]));
  h += '<div class="mkStep"><b>1</b>가장 많이 들고 있는 종목 <small class="briefDim">비중 = 13F 미국 주식 합계 대비</small></div><div class="dsTop">' + (g.top || []).slice(0, 10).map(function (x, i) {
    var c = x.chg === "new" ? '<span class="dsTag buy">신규</span>' : typeof x.chg === "number" && Math.abs(x.chg) >= 0.01 ? '<span class="' + (x.chg > 0 ? "pos" : "neg") + '">' + dsPct(x.chg, 0) + '</span>' : '<span class="briefDim">유지</span>';
    return '<div class="dsTopR"><span class="dsRank">' + (i + 1) + '</span><span class="dsNm">' + (x.t && dsKo(x.t) ? '<button class="linkBtn" data-dsopen="' + x.t + '">' + dsEsc(dsIss(x)) + '</button>' : dsEsc(dsIss(x))) + (x.t ? '<small>' + x.t + '</small>' : '') + '</span><span class="dsW"><i style="width:' + Math.round((x.w || 0) / mx * 100) + '%"></i></span><b>' + (x.w != null ? (x.w * 100).toFixed(1) + "%" : "-") + '</b><span class="dsChg">' + c + '</span></div>';
  }).join("") + '</div>';
  function mv(list, cls) { return list.length ? list.slice(0, 8).map(function (m) { return '<div class="dsAgg"><span class="dsNm">' + (m.t && dsKo(m.t) ? '<button class="linkBtn" data-dsopen="' + m.t + '">' + dsEsc(dsIss(m)) + '</button>' : dsEsc(dsIss(m))) + '<small>' + DS_KIND[m.kind] + (m.pct != null && m.kind !== "exit" && m.kind !== "new" ? ' ' + dsPct(m.pct, 0) : '') + '</small></span><b class="' + cls + '">' + dsUsd(m.dv) + '</b></div>'; }).join("") : '<div class="dvNone">없음</div>'; }
  h += '<div class="mkStep"><b>2</b>' + dsQ(g.period) + ' 매수 · 매도 <small class="briefDim">금액 = 주식 수 변화 × 분기 말 가격</small></div><div class="dsCols"><div class="dsCol"><div class="dsColH">산 종목</div>' + mv(g.buys || [], "pos") + '</div><div class="dsCol"><div class="dsColH">판 종목</div>' + mv(g.sells || [], "neg") + '</div></div>';
  var cr = dsCross().filter(function (x) { return x.b.length + x.s.length >= 2; }).sort(function (a, b) { return (b.b.length + b.s.length) - (a.b.length + a.s.length) || Math.abs(b.dv) - Math.abs(a.dv); }).slice(0, 10);
  if (cr.length) h += '<div class="mkStep"><b>3</b>여러 투자자가 함께 움직인 종목 <small class="briefDim">' + G.length + '명의 최근 13F 기준</small></div><div class="dsList">' + cr.map(function (x) { return '<div class="dsRow"><div class="dsR1"><span class="dsNm">' + dsEsc(dsIss(x)) + (x.t ? ' <small style="display:inline">' + x.t + '</small>' : '') + '</span><span class="dsTag buy">산 ' + x.b.length + '명</span><span class="dsTag sell">판 ' + x.s.length + '명</span></div><div class="dsR2"><span>' + dsEsc([x.b.length ? "산 사람: " + x.b.join(", ") : "", x.s.length ? "판 사람: " + x.s.join(", ") : ""].filter(Boolean).join(" / ")) + '</span></div></div>'; }).join("") + '</div>';
  h += '<details class="howto"><summary>13F 읽는 법</summary><div class="body"><ul><li>13F는 운용자산 1억 달러 이상 기관이 <b>분기 말 기준</b>으로 <b>45일 안에</b> 내는 미국 주식 보유 보고서예요. 지금은 이미 팔았거나 더 샀을 수 있어요.</li><li>미국 상장 주식(매수 포지션)만 보여요. 현금·채권·해외 주식·공매도는 빠져 있어서 그 사람 전체 계좌가 아니에요. 옵션(풋·콜)은 이 화면에서 뺐어요.</li><li>대형 기관은 여러 운용역의 결정이 섞여 있어요(버크셔도 일부는 다른 매니저가 운용).</li><li>종목 이름은 SEC 목록과 대조해 붙였어요. 등록된 종목이면 이름을 눌러 분석 화면으로 갈 수 있어요.</li></ul></div></details>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-dsg]"), function (b) { b.onclick = function () { DS.g.id = b.getAttribute("data-dsg"); dsSave(); renderGuru(); }; });
  dsBindOpen(box);
}

/* ============================================================ 카드 (운영자) ============================================================ */
function dsSrc(kind) { return kind === "guru" ? "SEC EDGAR 13F · StockMind 정리" : "DART 전자공시 · " + dsYmd(DS.disc && DS.disc.last) + " 수집 · StockMind 정리"; }
function dsSpec(cat, src, mkSel) {
  if (src === "discInsider" && cat === "table") {
    var L = dsItems(7, "insider").concat(dsItems(7, "major")).filter(function (x) { return x.chg; }).map(function (x) { return { x: x, v: dsVal(x) || 0 }; }).sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); }).slice(0, 10);
    if (!L.length) return null;
    return { meta: { title: "임원·대주주가 사고판 주식", sub: "최근 7일 · 등록 국내 종목 · 추정 금액 = 주식 수 × 최근 종가", source: dsSrc(), catName: "공시" },
      spec: { cols: ["종목", "누가", "구분", "주식 수", "추정 금액"], widths: [0.24, 0.24, 0.14, 0.18, 0.2], hlCols: [4], rows: L.map(function (o) { var x = o.x; return [dsKo(x.sym) || x.corp, (x.pos ? String(x.pos).split(" · ")[0] + " " : "") + (x.who || ""), x.chg > 0 ? "매수" : "매도", dsSh(x.chg), dsWon(Math.abs(o.v))]; }), note: "증여·스톡옵션·상속도 섞여 있어요 · 이유는 공시 원문에서 확인" } };
  }
  if (src === "discBuyback" && cat === "rank") {
    var B = dsItems(30, "own").filter(function (x) { return /buyback|trust/.test(x.k) && x.amt; }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, 12);
    if (!B.length) return null;
    return { meta: { title: "자사주 사겠다는 회사", sub: "최근 30일 자사주 취득 결정 · 금액 큰 순 · 계획이라 다 사지 않을 수도 있어요", source: dsSrc(), catName: "공시" },
      spec: { items: B.map(function (x, i) { return { rank: i + 1, name: dsKo(x.sym) || x.corp, value: dsWon(x.amt), sub: (x.k === "trust" ? "신탁 · " : "") + dsYmd(x.d) + " 공시" }; }) } };
  }
  if (src === "guruMoves" && cat === "table") {
    var g = DS.g.id && dsGurus().filter(function (x) { return x.id === DS.g.id; })[0] || dsLatest(); if (!g) return null;
    var M = (g.buys || []).slice(0, 5).concat((g.sells || []).slice(0, 5));
    return { meta: { title: g.nm + "의 " + dsQ(g.period), sub: g.org + " 13F · " + g.filed + " 공개 · " + (g.prevPeriod ? dsQ(g.prevPeriod) + " 대비" : ""), source: dsSrc("guru"), catName: "구루" },
      spec: { cols: ["구분", "종목", "주식 수 변화", "금액", "비중"], widths: [0.18, 0.3, 0.18, 0.18, 0.16], hlCols: [3], rows: M.map(function (m) { return [DS_KIND[m.kind], dsIss(m), m.kind === "new" ? "신규" : m.kind === "exit" ? "전량" : dsPct(m.pct, 0), dsUsd(m.dv), m.w ? (m.w * 100).toFixed(1) + "%" : "-"]; }), note: "13F = 분기 말 미국 주식 보유 · 45일 늦게 공개 · 지금도 들고 있다는 뜻은 아니에요" } };
  }
  if (src === "guruCross" && cat === "table") {
    var C = dsCross().filter(function (x) { return x.b.length + x.s.length >= 2; }).sort(function (a, b) { return (b.b.length + b.s.length) - (a.b.length + a.s.length) || Math.abs(b.dv) - Math.abs(a.dv); }).slice(0, 10);
    if (!C.length) return null;
    return { meta: { title: "대가들이 같이 움직인 종목", sub: dsGurus().length + "명의 최근 13F · 산 사람 vs 판 사람", source: dsSrc("guru"), catName: "구루" },
      spec: { cols: ["종목", "산 사람", "판 사람", "합계 금액"], widths: [0.28, 0.27, 0.27, 0.18], hlCols: [3], rows: C.map(function (x) { return [dsIss(x), x.b.length ? x.b.length + "명" + (x.b.length <= 2 ? " · " + x.b.join(", ") : "") : "-", x.s.length ? x.s.length + "명" + (x.s.length <= 2 ? " · " + x.s.join(", ") : "") : "-", dsUsd(x.dv)]; }), note: "투자자마다 분기 말 기준 · 공개일이 달라요" } };
  }
  return null;
}
(function () {
  if (typeof TPL_SOURCES === "undefined" || typeof tplSpec !== "function") return;
  TPL_SOURCES.table.push({ id: "discInsider", t: "임원·대주주 매수·매도 (최근 7일)" }, { id: "guruMoves", t: "구루 13F 분기 매수·매도" }, { id: "guruCross", t: "여러 구루가 같이 움직인 종목" });
  TPL_SOURCES.rank.push({ id: "discBuyback", t: "자사주 취득 결정 금액 TOP (30일)" });
  var s0 = tplSpec; tplSpec = function (cat, src, mk) { if (/^(disc|guru)/.test(src || "")) return dsSpec(cat, src, mk); return s0.apply(this, arguments); };
  var p0 = tplPrep; tplPrep = function (cat, mk, src) { if (/^(disc|guru)/.test(src || "")) return dsEnsure(); return p0.apply(this, arguments); };
})();

/* 묶음 카드: kind = "disc" | "guru" */
function dsDeckOpen(kind) {
  var plan = kind === "guru" ? [["table", "guruMoves", "매수매도"], ["table", "guruCross", "같이움직인종목"]] : [["table", "discInsider", "임원대주주"], ["rank", "discBuyback", "자사주"]];
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(dsEnsure).then(function () {
    var list = [];
    if (kind === "guru") {   // 최근 공개한 투자자 2명까지
      var gs = dsGurus().slice().sort(function (a, b) { return (b.filed || "").localeCompare(a.filed || ""); }).slice(0, 2), keep = DS.g.id;
      gs.forEach(function (g) { DS.g.id = g.id; var x = dsSpec("table", "guruMoves"); if (x) list.push({ cv: tplCard("table", x.meta, x.spec), name: (list.length + 1) + "_" + g.nm.replace(/\s/g, "") }); });
      DS.g.id = keep; var c = dsSpec("table", "guruCross"); if (c) list.push({ cv: tplCard("table", c.meta, c.spec), name: (list.length + 1) + "_같이움직인종목" });
    } else plan.forEach(function (p) { var x = dsSpec(p[0], p[1]); if (x) list.push({ cv: tplCard(p[0], x.meta, x.spec), name: (list.length + 1) + "_" + p[2] }); });
    if (!list.length) { alert(kind === "guru" ? "아직 수집된 13F 보고서가 없어요." : "최근 공시가 아직 없어요."); return; }
    var day = typeof pubToday === "function" ? pubToday().replace(/-/g, "") : "", box = document.createElement("div");
    box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">전부 저장</button></div>' + (typeof thrPanelHtml === "function" ? thrPanelHtml("주식") : "") + '<div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    list.forEach(function (it) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_" + (kind === "guru" ? "구루" : "공시") + "_" + day + "_" + it.name + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + it.name.replace("_", ". ") + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
    box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
    if (typeof thrBind === "function") try { thrBind(box, kind === "guru" ? thrGuru(list.map(function (x) { return x.name; })) : thrDisc(list.map(function (x) { return x.name; }))); } catch (e) { console.warn(e); }
    infoModal.open((kind === "guru" ? "구루 13F 카드" : "공시 카드") + " · " + list.length + "장", box);
  });
}
function discDeckOpen() { dsDeckOpen("disc"); }
function guruDeckOpen() { dsDeckOpen("guru"); }
/* 오늘 올릴 카드 조건: 공시는 최근 2일 임원·대주주·자사주가 3건 이상 / 구루는 최근 10일 안에 13F가 공개됐을 때 */
function dsPlanHints() {
  var out = [];
  if (DS.disc && DS.disc.items) { var n = dsItems(2, "all").filter(function (x) { return x.k !== "major"; }).length; if (n >= 3) out.push({ id: "disc", t: "📑 임원·대주주 매매 · 자사주 공시", d: "최근 2일 " + n + "건 — '회사 사람이 샀다'는 클릭을 부르는 소재", kind: "disc" }); }
  var g = DS.guru && dsLatest(); if (g && Date.now() - Date.parse(g.filed) < 10 * DS_DAY) out.push({ id: "guru", t: "🧭 " + g.nm + " 13F — " + dsQ(g.period) + " 매수·매도", d: g.filed + " 공개 — 13F 시즌엔 '대가는 뭘 샀나'가 가장 많이 읽혀요", kind: "guru" });
  return out;
}

/* ---------- 업로드 글 (v11.0 스레드 공식) ---------- */
function thrDisc(names) {
  if (typeof thrCompose !== "function") return [];
  var ins = dsItems(7, "insider").concat(dsItems(7, "major")).filter(function (x) { return x.chg; }), agg = {};
  ins.forEach(function (x) { var a = agg[x.sym] || (agg[x.sym] = { nm: dsKo(x.sym) || x.corp, v: 0, sh: 0 }); a.v += dsVal(x) || 0; a.sh += x.chg; });
  var A = Object.keys(agg).map(function (k) { return agg[k]; }).filter(function (a) { return a.v; }).sort(function (a, b) { return b.v - a.v; });
  var data = A.slice(0, 5).map(function (a) { return a.nm + " " + (a.v > 0 ? "순매수" : "순매도") + " " + dsWon(Math.abs(a.v)) + " (" + dsSh(a.sh) + ")"; });
  var bb = dsItems(30, "own").filter(function (x) { return /buyback|trust/.test(x.k) && x.amt; }).sort(function (a, b) { return b.amt - a.amt; });
  var bL = bb.slice(0, 5).map(function (x) { return (dsKo(x.sym) || x.corp) + " " + dsWon(x.amt) + " (" + dsYmd(x.d) + ")"; });
  var nb = ins.filter(function (x) { return x.chg > 0; }).length, ns = ins.filter(function (x) { return x.chg < 0; }).length;
  if (!data.length && !bL.length) return [];
  var LIM = ["한계도 적어둘게요.", "임원 지분 변동엔 장내 매수 말고도 스톡옵션·증여·상속이 섞여 있어요. 이유는 공시 원문에서 확인해야 합니다.", "자사주 취득 '결정'은 계획이라, 기간 안에 다 사지 않는 경우도 있어요.", "공시는 거래 뒤 며칠 안에 올라와서, 이미 가격에 반영됐을 수 있습니다."];
  var base = { summary: data.concat(bL.length ? ["자사주 취득 결정 " + bb.length + "건 · 합계 " + dsWon(bb.reduce(function (s, x) { return s + x.amt; }, 0))] : []), insights: ["최근 7일 임원·대주주 매수 " + nb + "건, 매도 " + ns + "건이었어요.", "회사 사정을 가장 잘 아는 사람들의 선택이라 주목받지만, 이유가 매매가 아닐 때도 많아요."],
    cardList: (names || []).map(function (n) { return n.replace("_", " "); }), question: "임원 매수와 자사주 매입, 어느 쪽이 더 믿음이 가세요?", tags: ["우상향연구소", "공시", "자사주", "주식초보", "국내주식"], foot: "DART 전자공시 · 등록 국내 종목 · 추정 금액은 최근 종가 기준 · 투자 권유 아님",
    data: data.length ? data : bL, sort: false, thFoot: "DART 공시 · 추정 금액은 최근 종가 기준 · 투자 권유 아님", limit: LIM, reply: "임원 매수와 자사주 매입, 어느 쪽이 더 믿음이 가세요?" };
  var out = [];
  function add(label, hook, ex) { var c = thrCompose(Object.assign({}, base, ex || {}, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  if (data.length) add("초보 질문형", "회사 임원이 자기 회사 주식을 샀다면,\n좋은 신호일까요?", { ask: "최근 7일 공시를 금액 순으로 모아봤어요.", interp: ["매수 " + nb + "건, 매도 " + ns + "건. 다만 지분 변동엔 매매가 아닌 이유도 섞여 있어요."] });
  if (data.length && A[0]) add("숫자 한 방형", dsWon(Math.abs(A[0].v)) + ".\n최근 7일 " + A[0].nm + " 임원·대주주의 " + (A[0].v > 0 ? "순매수" : "순매도") + " 규모예요.", { ask: "다른 회사들은 어땠을까요?", interp: ["추정 금액은 주식 수 × 최근 종가로 계산했어요."], reply: "이 목록에서 제일 의외인 회사는요?" });
  if (bL.length) add("반전형", "주가가 빠질 때 회사가\n자기 주식을 사겠다고 나섰어요.", { ask: "최근 30일 자사주 취득 결정, 금액 큰 순이에요.", data: bL, interp: ["사들인 뒤 소각까지 해야 주주 몫이 실제로 늘어나요."], reply: "자사주는 사서 들고 있는 것과 소각하는 것, 차이를 알고 계셨나요?" });
  return thrSafe(out);
}
function thrGuru(names) {
  if (typeof thrCompose !== "function") return [];
  var g = dsLatest(); if (!g) return [];
  var mv = (g.buys || []).slice(0, 3).concat((g.sells || []).slice(0, 2)).sort(function (a, b) { return b.dv - a.dv; });
  var data = mv.map(function (m) { return dsIss(m) + " " + DS_KIND[m.kind] + " " + dsUsd(m.dv); });
  var cr = dsCross().filter(function (x) { return x.b.length >= 2; }).sort(function (a, b) { return b.b.length - a.b.length || b.dv - a.dv; }).slice(0, 5);
  var crL = cr.map(function (x) { return dsIss(x) + " — " + x.b.length + "명이 매수"; });
  var top3 = (g.top || []).slice(0, 3).map(function (x) { return dsIss(x) + " " + (x.w * 100).toFixed(0) + "%"; }).join(" · ");
  var LIM = ["한계도 적어둘게요.", "13F는 분기 말 기준이고 45일 뒤에 공개돼요. 지금은 이미 팔았을 수도 있습니다.", "미국 상장 주식만 보여서 현금·채권·공매도는 빠져 있어요.", "지난 10년은 대체로 오른 시기라, 대가들의 성적도 그 덕을 봤어요."];
  var base = { summary: data.concat(top3 ? ["보유 상위: " + top3] : []), insights: [g.nm + "(" + g.org + ")의 " + dsQ(g.period) + " 13F예요. 새로 산 종목 " + (g.nNew || 0) + "개, 다 판 종목 " + (g.nExit || 0) + "개."].concat(crL.length ? ["여러 투자자가 같이 산 종목: " + crL.slice(0, 3).join(", ")] : []),
    cardList: (names || []).map(function (n) { return n.replace("_", " "); }), question: "이 목록에서 제일 의외인 종목은요?", tags: ["우상향연구소", "13F", "버핏", "미국주식", "주식초보"], foot: "SEC EDGAR 13F · " + g.filed + " 공개 · 투자 권유 아님",
    data: data, sort: false, thFoot: "SEC 13F · 분기 말 기준 · 투자 권유 아님", limit: LIM, reply: "이 목록에서 제일 의외인 종목은요?" };
  var out = [];
  function add(label, hook, ex) { var c = thrCompose(Object.assign({}, base, ex || {}, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  add("초보 질문형", dsJ(g.nm, "은", "는") + " 지난 분기에\n뭘 사고 뭘 팔았을까요?", { ask: dsQ(g.period) + " 13F에서 금액이 큰 순으로 놓아봤어요.", interp: ["보유 상위 3개는 " + top3 + "예요."] });
  if (crL.length) add("숫자 한 방형", cr[0].b.length + "명.\n" + dsJ(dsIss(cr[0]), "을", "를") + " 같은 분기에 산 대가들의 수예요.", { ask: "다른 종목은 몇 명이 같이 샀을까요?", data: crL, interp: ["여럿이 같이 샀다고 정답은 아니에요. 각자 들어간 가격과 이유가 달라요."] });
  if (g.sells && g.sells[0]) add("반전형", dsJ(g.nm, "이", "가") + " 판 종목,\n" + dsIss(g.sells[0]) + " " + dsUsd(Math.abs(g.sells[0].dv)) + "어치였어요.", { ask: "반대로 새로 담은 건 뭐였을까요?" });
  return thrSafe(out);
}
