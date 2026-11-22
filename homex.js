/* ============================================================ v16.00 홈 — 오늘의 시장을 한 화면에
   전문가가 아침에 보는 순서 그대로: ① 주요 지수가 고점에서 얼마나 내려와 있나 → ② 시장 전체가 같이 움직이나(시장 폭)
   → ③ 오늘 크게 움직인 종목 → ④ 내 관심 종목 → ⑤ 다가오는 일정 · 순위 상위.
   - 숫자는 모두 사전 수집 묶음(fetchRecent, 서버 호출 추가 없음)에서 계산한다. 못 받으면 못 받았다고 그대로 알린다.
   - 가운데 그림 '고점선 아래 깊이'가 이 앱의 관점이다: 위의 선이 52주 고점, 막대가 길수록 깊이 내려와 있다.
   ============================================================ */
var HX = { recent: null, rows: null, by: {}, mv: "all", busy: false, fail: false, narrow: null };
var HX_BOARD = [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["^GSPC", "S&P500"], ["^NDX", "나스닥100"], ["^DJI", "다우"], ["^N225", "니케이"], ["GC=F", "금"], ["BTC-USD", "비트코인"]];
var HX_ENV = [["^VIX", "변동성(VIX)"], ["KRW=X", "달러/원"], ["TLT", "미국 장기채"]];
var HX_BK = [[-0.05, "고점 부근", "#d5e2f8"], [-0.1, "-5~-10%", "#a9c4f1"], [-0.2, "-10~-20%", "#7aa3ea"], [-0.3, "-20~-30%", "#4a80e0"], [-9, "-30% 아래", "#1f56b8"]];
function hxE(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function hxPct(v, d) { if (v == null || !isFinite(v)) return "–"; var s = (v * 100).toFixed(d == null ? 1 : d); if (+s === 0) s = (0).toFixed(d == null ? 1 : d); return (v > 0 && +s !== 0 ? "+" : "") + s + "%"; }
function hxCls(v) { return v == null || !isFinite(v) || Math.abs(v) < 0.0005 ? "flat" : v > 0 ? "pos" : "neg"; }   /* 0.0%로 보이는 값에는 색을 입히지 않는다 */
function hxNum(v) { if (v == null || !isFinite(v)) return "–"; var a = Math.abs(v); return v.toLocaleString("en-US", { maximumFractionDigits: a >= 10000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : 4, minimumFractionDigits: a >= 10000 ? 0 : a >= 100 ? 1 : 2 }); }
function hxMoney(r) { if (r.last == null || !isFinite(r.last)) return "–"; var c = r.cur || (/\.K[SQ]$/.test(r.s) ? "KRW" : ""); if (c === "KRW") return Math.round(r.last).toLocaleString("ko-KR") + "원"; if (c === "USD") return "$" + hxNum(r.last); return hxNum(r.last) + (c ? " " + c : ""); }
function hxName(s) { var n = typeof cmpLabel === "function" ? cmpLabel(s) : s; return n; }
function hxGrp(s) { return typeof classifySymbol === "function" ? classifySymbol(s) : (/\.K[SQ]$/.test(s) ? "kr" : "us"); }
function hxDay(t) { if (!t) return ""; var d = new Date(t + 9 * 3600e3), w = "일월화수목금토".charAt(d.getUTCDay()); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate() + "(" + w + ")"; }
function hxDepthCol(v) { if (v == null) return "#d5e2f8"; for (var i = 0; i < HX_BK.length; i++) if (v >= HX_BK[i][0]) return HX_BK[i][2]; return HX_BK[4][2]; }

/* 묶음 한 종목 → 화면에 쓰는 값 */
function hxRow(sym, d) {
  var c = (d.c || []).filter(function (x) { return x != null && isFinite(x); }), n = c.length; if (n < 3) return null;
  var last = c[n - 1], prev = c[n - 2], hi = 0, i, v = d.v || [];
  for (i = Math.max(0, n - 252); i < n; i++) if (c[i] > hi) hi = c[i];
  var mh = d.meta && +d.meta.fiftyTwoWeekHigh; if (mh > hi) hi = mh;
  var v5 = 0, v20 = 0, m = v.length; for (i = m - 5; i < m; i++) v5 += v[i] || 0; for (i = Math.max(0, m - 25); i < m - 5; i++) v20 += v[i] || 0; v5 /= 5; v20 /= Math.max(1, Math.min(20, m - 5));
  return { s: sym, n: hxName(sym), grp: hxGrp(sym), last: last, chg: prev > 0 ? last / prev - 1 : null, vsHi: hi > 0 ? last / hi - 1 : null, 
    volX: v20 > 0 && m >= 25 ? v5 / v20 : null, cur: (d.meta && d.meta.currency) || "", t: d.t && d.t.length ? d.t[d.t.length - 1] * 1000 : null, sp: c.slice(-66) };
}
function hxBuild(recent) {
  var rows = [], by = {};
  Object.keys((recent && recent.symbols) || {}).forEach(function (s) { var r = null; try { r = hxRow(s, recent.symbols[s]); } catch (e) {} if (r) { rows.push(r); by[s] = r; } });
  HX.rows = rows; HX.by = by;
}
function hxLoad(force) {
  if (HX.busy) return; if (HX.rows && !force) return hxPaint();
  if (typeof fetchRecent !== "function") { HX.fail = true; return hxPaint(); }
  HX.busy = true; HX.fail = false; hxPaint();
  if (force && typeof DATA !== "undefined") DATA.recentPromise = null;
  fetchRecent().then(function (recent) { HX.busy = false; if (!recent || !recent.symbols) { HX.fail = true; HX.recent = null; HX.rows = null; } else { HX.recent = recent; hxBuild(recent); } hxPaint(); })
    .catch(function () { HX.busy = false; HX.fail = true; hxPaint(); });
}

/* ---------- 그림 조각 ---------- */
function hxSpark(a, w, h) {
  if (!a || a.length < 5) return "";
  var mn = Math.min.apply(null, a), mx = Math.max.apply(null, a), r = mx - mn || 1, n = a.length;
  var pts = a.map(function (v, i) { return (i / (n - 1) * (w - 4) + 2).toFixed(1) + "," + ((1 - (v - mn) / r) * (h - 4) + 2).toFixed(1); });
  var lp = pts[n - 1].split(",");
  return '<svg class="hxSp" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><polyline points="' + pts.join(" ") + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + lp[0] + '" cy="' + lp[1] + '" r="2.2" fill="currentColor"/></svg>';
}
/* ① 고점선 아래 깊이 */
function hxBoardHtml() {
  var list = HX_BOARD.map(function (b) { var r = HX.by[b[0]] || (b[0] === "GC=F" ? HX.by.GLD : null); return r ? { r: r, n: b[1] } : null; }).filter(Boolean);
  if (!list.length) return "";
  var deep = 0; list.forEach(function (x) { if (x.r.vsHi != null && -x.r.vsHi > deep) deep = -x.r.vsHi; });
  var mx = Math.min(0.8, Math.max(0.2, Math.ceil(deep * 10 + 0.0001) / 10)), ticks = [], t;
  for (t = 0.1; t <= mx + 1e-9; t += 0.1) ticks.push(t);
  var narrow = HX.narrow;
  var env = HX_ENV.map(function (b) { var r = HX.by[b[0]]; return r ? '<button type="button" class="hxEnv" data-shsym="' + hxE(r.s) + '"><span>' + b[1] + '</span><b>' + hxNum(r.last) + '</b><em class="' + hxCls(r.chg) + '">' + hxPct(r.chg) + '</em></button>' : ""; }).join("");
  var h = '<section class="hxP hxBoard"><header class="hxH"><div><h2>고점에서 얼마나 내려와 있나</h2><p>위의 선이 52주 최고가예요. 막대가 길수록 깊이 내려와 있어요.</p></div>' + (env ? '<div class="hxEnvs">' + env + '</div>' : "") + '</header>';
  if (narrow) {
    h += '<div class="hxDepR">' + list.map(function (x) { var r = x.r, d = r.vsHi == null ? 0 : Math.min(1, -r.vsHi / mx), top = r.vsHi != null && r.vsHi > -0.01;
      return '<button type="button" class="hxDr" data-shsym="' + hxE(r.s) + '"><span class="hxDrN"><b>' + x.n + '</b><small>' + hxNum(r.last) + ' <em class="' + hxCls(r.chg) + '">' + hxPct(r.chg) + '</em></small></span><span class="hxDrB"><i style="width:' + (d * 100).toFixed(1) + '%;background:' + hxDepthCol(r.vsHi) + '"></i></span><span class="hxDrV' + (top ? " top" : "") + '">' + (top ? "고점" : hxPct(r.vsHi)) + '</span></button>'; }).join("") + '</div>';
  } else {
    var H = 128;
    h += '<div class="hxDep" style="--n:' + list.length + ';--h:' + H + 'px"><div class="hxDepTop">' + list.map(function (x) { var r = x.r; return '<button type="button" class="hxDc" data-shsym="' + hxE(r.s) + '"><b>' + x.n + '</b><span>' + hxNum(r.last) + '</span><em class="' + hxCls(r.chg) + '">' + hxPct(r.chg) + '</em></button>'; }).join("") + '</div>' +
      '<div class="hxDepArea"><div class="hxPeak"><span>고점</span></div>' + ticks.map(function (v) { return '<div class="hxTick" style="top:' + (v / mx * H).toFixed(1) + 'px"><span>-' + Math.round(v * 100) + '%</span></div>'; }).join("") +
      '<div class="hxBars">' + list.map(function (x) { var r = x.r, d = r.vsHi == null ? 0 : Math.min(1, -r.vsHi / mx), top = r.vsHi != null && r.vsHi > -0.01;
        return '<div class="hxBarC"><i style="height:' + Math.max(top ? 0 : 3, d * H).toFixed(1) + 'px;background:' + hxDepthCol(r.vsHi) + '"></i><b class="' + (top ? "top" : "") + '">' + (r.vsHi == null ? "–" : top ? "고점 부근" : hxPct(r.vsHi)) + '</b></div>'; }).join("") + '</div></div>' +
      '<div class="hxDepBot">' + list.map(function (x) { return '<div class="hxSpC" title="최근 3개월 흐름">' + hxSpark(x.r.sp, 96, 30) + '</div>'; }).join("") + '</div></div>';
  }
  return h + '</section>';
}
/* ② 시장 폭 */
function hxBreadthHtml() {
  var G = [["kr", "국내 종목"], ["us", "해외 종목"], ["idx", "지수와 ETF"]], out = "";
  G.forEach(function (g) {
    var rs = HX.rows.filter(function (r) { return r.grp === g[0] && r.vsHi != null; }); if (rs.length < 5) return;
    var cnt = [0, 0, 0, 0, 0], up = 0, dn = 0;
    rs.forEach(function (r) { for (var i = 0; i < HX_BK.length; i++) if (r.vsHi >= HX_BK[i][0]) { cnt[i]++; break; } if (r.chg > 0.00005) up++; else if (r.chg < -0.00005) dn++; });
    var n = rs.length, deepN = cnt[3] + cnt[4], med = rs.map(function (r) { return r.vsHi; }).sort(function (a, b) { return a - b; })[Math.floor(n / 2)];
    out += '<div class="hxBr"><div class="hxBrH"><b>' + g[1] + '</b><span>' + n + '개, 가운데 값 ' + hxPct(med) + '</span></div>' +
      '<div class="hxStk" role="img" aria-label="' + g[1] + ' 고점 대비 분포">' + cnt.map(function (c, i) { return c ? '<i style="flex:' + c + ';background:' + HX_BK[i][2] + '" title="' + HX_BK[i][1] + ' ' + c + '개"></i>' : ""; }).join("") + '</div>' +
      '<dl class="hxBrK"><div><dt>고점 부근</dt><dd>' + Math.round(cnt[0] / n * 100) + '%</dd></div><div><dt>-20% 아래</dt><dd>' + Math.round(deepN / n * 100) + '%</dd></div><div><dt>오늘 오른 종목</dt><dd class="' + (up > dn ? "pos" : up < dn ? "neg" : "") + '">' + (up + dn ? Math.round(up / (up + dn) * 100) + "%" : "–") + '</dd></div></dl>' +
      '<div class="hxAd" role="img" aria-label="오른 종목 ' + up + '개, 내린 종목 ' + dn + '개"><i class="u" style="flex:' + up + '"></i><i class="d" style="flex:' + dn + '"></i></div></div>';
  });
  if (!out) return "";
  return '<section class="hxP hxBreadth"><header class="hxH"><div><h2>시장 폭</h2><p>지수만 버티는지, 종목들이 같이 가는지 봐요.</p></div><button type="button" class="hxMore" data-shgo="map">시장 지도</button></header>' + out +
    '<div class="hxLg">' + HX_BK.map(function (b) { return '<span><i style="background:' + b[2] + '"></i>' + b[1] + '</span>'; }).join("") + '</div></section>';
}
/* ③ 오늘 크게 움직인 종목 */
function hxMoversHtml() {
  var rs = HX.rows.filter(function (r) { return (r.grp === "kr" || r.grp === "us") && r.chg != null && (HX.mv === "all" || r.grp === HX.mv); });
  if (rs.length < 4) return "";
  var up = rs.slice().sort(function (a, b) { return b.chg - a.chg; }).slice(0, 6), dn = rs.slice().sort(function (a, b) { return a.chg - b.chg; }).slice(0, 6);
  var li = function (r) { return '<button type="button" class="hxMv" data-shsym="' + hxE(r.s) + '"><b>' + hxE(r.n) + '</b>' + (r.volX >= 2 ? '<small>거래량 ' + r.volX.toFixed(1) + '배</small>' : "") + '<em class="' + hxCls(r.chg) + '">' + hxPct(r.chg) + '</em></button>'; };
  return '<section class="hxP hxMovers"><header class="hxH"><div><h2>오늘 크게 움직인 종목</h2><p>마지막 거래일의 하루 등락이에요.</p></div><div class="hxSeg" role="group" aria-label="시장 고르기">' + [["all", "전체"], ["kr", "국내"], ["us", "해외"]].map(function (x) { return '<button type="button" data-hxmv="' + x[0] + '" class="' + (HX.mv === x[0] ? "on" : "") + '" aria-pressed="' + (HX.mv === x[0]) + '">' + x[1] + '</button>'; }).join("") + '</div></header>' +
    '<div class="hxMvG"><div><h3 class="pos">많이 오른 종목</h3>' + up.map(li).join("") + '</div><div><h3 class="neg">많이 내린 종목</h3>' + dn.map(li).join("") + '</div></div></section>';
}
/* ④ 내 관심 종목 */
function hxWatchHtml() {
  var wl = []; try { wl = typeof loadWatch === "function" ? loadWatch() : []; } catch (e) {}
  var head = '<header class="hxH"><div><h2>내 관심 종목</h2><p>' + (wl.length ? "고점 대비 위치를 같은 눈금으로 봐요." : "종목 분석에서 별을 누르면 여기에 모여요.") + '</p></div>' + (wl.length ? '<button type="button" class="hxMore" data-shgo="watch">전체 보기</button>' : "") + '</header>';
  if (!wl.length) return '<section class="hxP hxWatch">' + head + '<div class="hxChips">' + ["005930.KS", "SPY", "QQQ", "^KS11", "GLD", "BTC-USD"].map(function (s) { return '<button type="button" class="chip" data-shsym="' + s + '">' + hxE(hxName(s)) + '</button>'; }).join("") + '</div></section>';
  var q = typeof watchState !== "undefined" ? watchState.quotes : {};
  var rows = wl.slice(0, 10).map(function (w) { var r = HX.by[w.s], k = q && q[w.s]; if (!r && k) r = { s: w.s, n: hxName(w.s), last: k.last, chg: k.chg, vsHi: k.vsHi, cur: k.cur }; return r || { s: w.s, n: hxName(w.s), miss: 1 }; });
  return '<section class="hxP hxWatch">' + head + '<div class="hxWl">' + rows.map(function (r) {
    if (r.miss) return '<button type="button" class="hxWr" data-shsym="' + hxE(r.s) + '"><b>' + hxE(r.n) + '</b><span class="hxMiss">시세 묶음에 없어요. 누르면 따로 불러와요.</span></button>';
    var d = r.vsHi == null ? 0 : Math.min(1, -r.vsHi / 0.5);
    return '<button type="button" class="hxWr" data-shsym="' + hxE(r.s) + '"><b>' + hxE(r.n) + '</b><span class="hxWn">' + hxMoney(r) + '</span><em class="' + hxCls(r.chg) + '">' + hxPct(r.chg) + '</em><span class="hxWb" title="52주 고점 대비"><i style="width:' + (d * 100).toFixed(1) + '%;background:' + hxDepthCol(r.vsHi) + '"></i></span><span class="hxWv">' + hxPct(r.vsHi) + '</span></button>'; }).join("") + '</div></section>';
}
/* ⑤ 일정 · 순위 */
function hxEventsHtml() {
  var ev = []; try { ev = typeof cxlEvents === "function" ? cxlEvents() : []; } catch (e) {}
  var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), end = new Date(Date.now() + 9 * 3600e3 + 21 * 86400e3).toISOString().slice(0, 10);
  ev = ev.filter(function (e) { return e.d >= today && e.d <= end; }).slice(0, 7); if (!ev.length) return "";
  var K = typeof CXL_KIND !== "undefined" ? CXL_KIND : {};
  return '<section class="hxP hxEvents"><header class="hxH"><div><h2>다가오는 일정</h2><p>앞으로 3주 안의 발표와 휴장이에요.</p></div></header><div class="hxEv">' + ev.map(function (e) {
    var k = K[e.kind] || ["일정", "#667080"], dd = new Date(Date.parse(e.d + "T00:00:00Z")), dl = Math.round((Date.parse(e.d) - Date.parse(today)) / 86400e3);
    var t = typeof cxlShort === "function" ? cxlShort(e.t) : e.t;
    return '<div class="hxEr"><span class="hxEd"><b>' + (dd.getUTCMonth() + 1) + "/" + dd.getUTCDate() + '</b><small>' + (dl === 0 ? "오늘" : dl === 1 ? "내일" : "일월화수목금토".charAt(dd.getUTCDay()) + "요일") + '</small></span><i style="background:' + k[1] + '"></i><span class="hxEt"><b>' + hxE(t) + '</b><small>' + k[0] + (e.est ? ", 예상 날짜" : "") + '</small></span></div>'; }).join("") + '</div></section>';
}
function hxRankHtml() {
  if (!(typeof isOwner === "function" && isOwner()) || typeof rkAll !== "function") return "";
  var all = []; try { all = rkAll(); } catch (e) { all = []; }
  var head = '<header class="hxH"><div><h2>순위 상위</h2><p>' + (all.length ? "종목 점수가 높은 순서예요. 타이밍 점수는 따로 봐요." : "아직 점수를 계산하지 않았어요.") + '</p></div><button type="button" class="hxMore" data-shgo="rank">' + (all.length ? "순위 보기" : "계산하러 가기") + '</button></header>';
  if (!all.length) return '<section class="hxP hxRank">' + head + '</section>';
  var top = all.filter(function (r) { return !r.lev; }).slice(0, 6), col = function (v) { return typeof smScCol === "function" ? smScCol(v) : "#14161c"; };
  return '<section class="hxP hxRank">' + head + '<div class="hxRk"><div class="hxRkH"><span></span><span>종목</span><span>종목 점수</span><span>타이밍</span></div>' + top.map(function (r, i) {
    return '<button type="button" class="hxRr" data-shsym="' + hxE(r.s) + '"><i>' + (i + 1) + '</i><b>' + hxE(r.n || hxName(r.s)) + '</b><span class="hxSc"><u><s style="width:' + Math.max(0, Math.min(100, r.t)) + '%;background:' + col(r.t) + '"></s></u>' + Math.round(r.t) + '</span><span class="hxTm">' + (r.tm == null ? "–" : Math.round(r.tm)) + '</span></button>'; }).join("") + '</div></section>';
}
/* 운영자: 오늘 작업 진행 */
function hxFlowHtml() {
  if (!(typeof isOwner === "function" && isOwner()) || typeof smFlowDone !== "function" || typeof SM_FLOW === "undefined") return "";
  var D = {}; try { D = smFlowDone(); } catch (e) { return ""; }
  var next = SM_FLOW.filter(function (s) { return !D[s.k]; })[0];
  return '<div class="hxFlow" aria-label="오늘 작업 진행">' + SM_FLOW.map(function (s, i) { return '<button type="button" data-hxflow="' + s.k + '" class="' + (D[s.k] ? "done" : next && next.k === s.k ? "next" : "") + '"><i>' + (D[s.k] ? "✓" : i + 1) + '</i>' + hxE(s.n || s.k) + '</button>'; }).join("") + '<button type="button" class="hxFlowGo" data-shgo="ops">작업실 열기</button></div>';
}
function hxStartHtml() {
  if (typeof isOwner === "function" && isOwner()) return "";
  return '<section class="hxStart"><h2>처음이라면</h2><div class="hxSt"><button type="button" data-shgo="mind"><b>투자 유형 테스트</b><small>질문 12개로 열여섯 가지 유형 중 내 자리를 찾아요.</small></button><button type="button" data-shgo="guide"><b>나에게 맞는 투자법</b><small>질문 4개에 답하면 먼저 읽을 방법을 알려 줘요.</small></button><button type="button" data-shsym="005930.KS"><b>종목 하나 살펴보기</b><small>삼성전자가 얼마나 떨어졌고 얼마 만에 회복했는지 봐요.</small></button></div></section>';
}

/* ---------- 그리기 ---------- */
function hxPaint() {
  var host = document.getElementById("tab-home"); if (!host) return;
  var root = document.getElementById("hxRoot"); if (!root) { root = document.createElement("div"); root.id = "hxRoot"; host.insertBefore(root, host.firstChild); }
  if (host.firstChild !== root) host.insertBefore(root, host.firstChild);
  HX.narrow = window.matchMedia("(max-width: 860px)").matches;
  var kr = HX.by["^KS11"], us = HX.by["^GSPC"], basis = [];
  if (kr && kr.t) basis.push("국내 " + hxDay(kr.t)); if (us && us.t) basis.push("미국 " + hxDay(us.t));
  var h = '<div class="hxTop"><div><h1>오늘의 시장</h1><p>' + (HX.rows ? (basis.length ? basis.join(", ") + " 종가 기준" : "마지막 거래일 종가 기준") + "이에요. 장중 가격은 반영하지 않아요." : HX.busy ? "시세 묶음을 받는 중이에요." : "") + '</p></div>' + hxFlowHtml() + '</div>';
  if (!HX.rows) {
    h += HX.busy ? '<div class="hxP hxWait" aria-busy="true"><i></i><i></i><i></i></div>' :
      '<div class="hxP hxFail"><b>시세 묶음을 받지 못했어요.</b><p>아침 자동 수집이 아직 끝나지 않았거나 연결이 끊긴 상태예요. 숫자를 지어내지 않고 비워 둡니다.</p><div><button type="button" class="primary" data-hxretry>다시 받기</button>' + (typeof isOwner === "function" && isOwner() ? '<button type="button" data-shgo="data">데이터 화면에서 확인</button>' : "") + '</div></div>';
    h += '<div class="hxGrid">' + hxWatchHtml() + hxEventsHtml() + '</div>' + hxStartHtml();
  } else {
    h += hxBoardHtml() + '<div class="hxGrid">' + hxBreadthHtml() + hxMoversHtml() + hxWatchHtml() + hxRankHtml() + hxEventsHtml() + '</div>' + hxStartHtml();
  }
  root.innerHTML = h;
  Array.prototype.forEach.call(root.querySelectorAll("[data-hxmv]"), function (b) { b.onclick = function () { HX.mv = b.getAttribute("data-hxmv"); hxPaint(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-hxflow]"), function (b) { b.onclick = function () { if (typeof smFlowGo === "function") smFlowGo(b.getAttribute("data-hxflow")); }; });
  var rb = root.querySelector("[data-hxretry]"); if (rb) rb.onclick = function () { hxLoad(true); };
}
(function () {
  if (typeof switchTab !== "function") return;
  var s0 = switchTab; switchTab = function () { var r = s0.apply(this, arguments); try { if (currentTab === "home") hxLoad(); } catch (e) { console.warn("home", e); } return r; };
  if (typeof applyOwnerUI === "function") { var o0 = applyOwnerUI; applyOwnerUI = function () { var r = o0.apply(this, arguments); try { if (currentTab === "home") hxPaint(); } catch (e) {} return r; }; }
  window.addEventListener("resize", function () { clearTimeout(HX.rt); HX.rt = setTimeout(function () { try { var n = window.matchMedia("(max-width: 860px)").matches; if (n !== HX.narrow && currentTab === "home") hxPaint(); } catch (e) {} }, 180); });
  function start() { try { if (typeof currentTab === "undefined" || currentTab === "home") hxLoad(); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 60); }); else setTimeout(start, 60);
  var C = [
    "html.sh #tab-home>.hero,html.sh #tab-home>.startCards,html.sh #tab-home>.homeChips,html.sh #tab-home>#smFlow{display:none!important}",
    "#hxRoot{--hxGap:16px}",
    ".hxTop{display:flex;align-items:flex-end;justify-content:space-between;gap:12px 24px;flex-wrap:wrap;margin:2px 2px 16px}.hxTop h1{font-size:24px;font-weight:800;letter-spacing:-.03em;margin:0;line-height:1.25}.hxTop p{margin:3px 0 0;font-size:13px;color:var(--sub)}",
    ".hxFlow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.hxFlow button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px 5px 6px;font-size:13px;font-weight:650;color:var(--txt2);cursor:pointer}.hxFlow button i{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--card2);font-style:normal;font-size:11.5px;font-weight:800;color:var(--sub)}",
    ".hxFlow button.done{color:var(--good);border-color:#bfe3d1}.hxFlow button.done i{background:var(--good);color:#fff}.hxFlow button.next{border-color:var(--txt);color:var(--txt)}.hxFlow button.next i{background:var(--txt);color:#fff}.hxFlow .hxFlowGo{padding:6px 14px;background:#14161c;color:#fff;border-color:#14161c}.hxFlow .hxFlowGo:hover{background:#2c313c}",
    ".hxP{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px 18px;min-width:0}",
    ".hxH{display:flex;align-items:flex-start;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin-bottom:14px}.hxH h2{font-size:16.5px;font-weight:800;letter-spacing:-.02em;margin:0;line-height:1.3}.hxH p{margin:2px 0 0;font-size:12.5px;color:var(--sub);line-height:1.45}",
    ".hxMore{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:650;color:var(--txt2);cursor:pointer;flex:none}.hxMore:hover{border-color:var(--txt);color:var(--txt);background:#fff}",
    /* 깊이 보드 */
    ".hxBoard{margin-bottom:var(--hxGap);padding-bottom:14px}",
    ".hxEnvs{display:flex;gap:6px;flex-wrap:wrap}.hxEnv{display:inline-flex;align-items:baseline;gap:7px;border:1px solid var(--line);background:var(--soft);border-radius:9px;padding:5px 10px;font-size:12.5px;cursor:pointer;color:var(--txt2)}.hxEnv span{color:var(--sub);font-weight:600}.hxEnv b{font-size:13.5px;font-weight:750;color:var(--txt);font-variant-numeric:tabular-nums}.hxEnv em{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums}.hxEnv:hover{border-color:var(--txt);background:#fff}",
    ".hxDep{position:relative;padding-left:44px}",
    ".hxDepTop,.hxBars,.hxDepBot{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr))}",
    ".hxDc{display:flex;flex-direction:column;align-items:center;gap:0;border:0;background:none;border-radius:10px;padding:6px 2px 9px;cursor:pointer;color:var(--txt);min-width:0}.hxDc:hover{background:var(--soft)}.hxDc b{font-size:13.5px;font-weight:700;letter-spacing:-.01em;white-space:nowrap}.hxDc span{font-size:16px;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.35;white-space:nowrap}.hxDc em{font-style:normal;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.3}",
    ".hxDepArea{position:relative;height:calc(var(--h) + 30px)}",
    ".hxPeak{position:absolute;left:-44px;right:0;top:0;border-top:2px solid #14161c}.hxPeak span{position:absolute;left:0;top:-20px;font-size:11.5px;font-weight:750;color:var(--txt);white-space:nowrap}",
    ".hxTick{position:absolute;left:-44px;right:0;border-top:1px dashed #dfe3e8}.hxTick span{position:absolute;left:0;top:-9px;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;background:#fff;padding-right:6px}",
    ".hxBars{position:absolute;left:0;right:0;top:1px}.hxBarC{display:flex;flex-direction:column;align-items:center;min-width:0}.hxBarC i{display:block;width:min(46px,56%);border-radius:0 0 6px 6px}.hxBarC b{margin-top:5px;font-size:14px;font-weight:800;color:#1f56b8;font-variant-numeric:tabular-nums;letter-spacing:-.02em;background:#fff;padding:0 4px;white-space:nowrap}.hxBarC b.top{color:var(--goldInk);font-size:12.5px}",
    ".hxDepBot{margin-top:2px}.hxSpC{display:grid;place-items:center;color:#5a6373}.hxSp{max-width:86%;height:auto}",
    ".hxDepR{display:flex;flex-direction:column}.hxDr{display:grid;grid-template-columns:minmax(96px,34%) 1fr 62px;align-items:center;gap:10px;border:0;border-top:1px solid var(--line2);background:none;border-radius:0;padding:9px 0;cursor:pointer;color:var(--txt);text-align:left}.hxDr:first-child{border-top:2px solid #14161c}",
    ".hxDrN b{display:block;font-size:14px;font-weight:700}.hxDrN small{display:block;font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums;white-space:nowrap}.hxDrN em{font-style:normal;font-weight:700}.hxDrB{height:12px;border-left:2px solid #14161c;background:var(--soft);border-radius:0 6px 6px 0;overflow:hidden}.hxDrB i{display:block;height:100%;border-radius:0 6px 6px 0}.hxDrV{font-size:14px;font-weight:800;color:#1f56b8;text-align:right;font-variant-numeric:tabular-nums}.hxDrV.top{color:var(--goldInk);font-size:12.5px}",
    /* 격자 */
    ".hxGrid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--hxGap)}.hxGrid>.hxP{grid-column:span 12}",
    "@media(min-width:1024px){.hxGrid>.hxBreadth{grid-column:span 5}.hxGrid>.hxMovers{grid-column:span 7}.hxGrid>.hxWatch{grid-column:span 7}.hxGrid>.hxRank,.hxGrid>.hxEvents{grid-column:span 5}.hxGrid>.hxWatch:last-child,.hxGrid>.hxEvents:nth-last-child(1):nth-child(odd){grid-column:span 12}}",
    /* 시장 폭 */
    ".hxBr{padding:10px 0 12px;border-top:1px solid var(--line2)}.hxBr:first-of-type{border-top:0;padding-top:0}.hxBrH{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:7px}.hxBrH b{font-size:14px;font-weight:750}.hxBrH span{font-size:12.5px;color:var(--sub);font-variant-numeric:tabular-nums}",
    ".hxStk{display:flex;height:14px;border-radius:4px;overflow:hidden;gap:1px;background:#fff}.hxStk i{display:block;min-width:2px}",
    ".hxBrK{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:9px 0 7px}.hxBrK div{min-width:0}.hxBrK dt{font-size:12px;color:var(--sub)}.hxBrK dd{margin:0;font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.3}",
    ".hxAd{display:flex;height:5px;border-radius:3px;overflow:hidden;gap:1px;background:var(--card2)}.hxAd i{display:block}.hxAd .u{background:var(--up)}.hxAd .d{background:var(--down)}",
    ".hxLg{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line2);font-size:12px;color:var(--sub)}.hxLg span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.hxLg i{width:10px;height:10px;border-radius:3px;display:block}",
    /* 움직인 종목 */
    ".hxSeg{display:inline-flex;background:var(--card2);border-radius:9px;padding:3px;gap:2px;flex:none}.hxSeg button{border:0;background:none;border-radius:7px;padding:4px 12px;font-size:12.5px;font-weight:650;color:var(--sub);cursor:pointer}.hxSeg button:hover{background:none;color:var(--txt)}.hxSeg button.on{background:#fff;color:var(--txt);box-shadow:0 0 0 1px var(--line)}",
    ".hxMvG{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px}.hxMvG h3{font-size:12.5px;font-weight:750;margin:0 0 4px;padding-bottom:6px;border-bottom:1px solid var(--line)}",
    ".hxMv{display:flex;align-items:baseline;gap:8px;width:100%;border:0;border-bottom:1px solid var(--line2);background:none;border-radius:0;padding:8px 2px;cursor:pointer;color:var(--txt);text-align:left}.hxMv:last-child{border-bottom:0}.hxMv:hover{background:var(--soft)}.hxMv b{flex:1;min-width:0;font-size:14px;font-weight:650;word-break:keep-all}.hxMv small{font-size:11.5px;font-weight:650;color:var(--goldInk);background:var(--goldSoft);border-radius:5px;padding:1px 6px;white-space:nowrap;flex:none}.hxMv em{font-style:normal;font-size:14px;font-weight:750;font-variant-numeric:tabular-nums;flex:none;min-width:58px;text-align:right}",
    /* 관심 종목 */
    ".hxWr{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(70px,auto) 64px minmax(60px,1fr) 58px;align-items:center;gap:12px;width:100%;border:0;border-bottom:1px solid var(--line2);background:none;border-radius:0;padding:9px 2px;cursor:pointer;color:var(--txt);text-align:left}.hxWr:last-child{border-bottom:0}.hxWr:hover{background:var(--soft)}",
    ".hxWr b{font-size:14px;font-weight:650;min-width:0;word-break:keep-all}.hxWn{font-size:14px;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}.hxWr em{font-style:normal;font-size:14px;font-weight:750;font-variant-numeric:tabular-nums;text-align:right}.hxWb{height:8px;border-left:2px solid #14161c;background:var(--soft);border-radius:0 4px 4px 0;overflow:hidden}.hxWb i{display:block;height:100%;border-radius:0 4px 4px 0}.hxWv{font-size:13.5px;font-weight:750;color:#1f56b8;font-variant-numeric:tabular-nums;text-align:right}.hxMiss{grid-column:2/-1;font-size:12.5px;color:var(--sub)}",
    ".hxChips{display:flex;flex-wrap:wrap;gap:6px}",
    /* 순위 */
    ".hxRkH,.hxRr{display:grid;grid-template-columns:22px minmax(0,1fr) 128px 52px;align-items:center;gap:10px}.hxRkH{font-size:12px;color:var(--sub);padding:0 2px 6px;border-bottom:1px solid var(--line)}.hxRkH span:nth-child(n+3){text-align:right}",
    ".hxRr{width:100%;border:0;border-bottom:1px solid var(--line2);background:none;border-radius:0;padding:8px 2px;cursor:pointer;color:var(--txt);text-align:left}.hxRr:last-child{border-bottom:0}.hxRr:hover{background:var(--soft)}.hxRr>i{font-style:normal;font-size:12.5px;font-weight:750;color:var(--sub);text-align:center;font-variant-numeric:tabular-nums}.hxRr>b{font-size:14px;font-weight:650;min-width:0;word-break:keep-all}",
    ".hxSc{display:flex;align-items:center;gap:8px;justify-content:flex-end;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}.hxSc u{display:block;flex:1;height:6px;border-radius:3px;background:var(--card2);overflow:hidden;text-decoration:none}.hxSc s{display:block;height:100%;border-radius:3px;text-decoration:none}.hxTm{font-size:14px;font-weight:650;color:var(--txt2);text-align:right;font-variant-numeric:tabular-nums}",
    /* 일정 */
    ".hxEv{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0 28px}.hxEr{display:grid;grid-template-columns:58px 8px minmax(0,1fr);align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid var(--line2)}.hxEd b{display:block;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.25}.hxEd small{display:block;font-size:12px;color:var(--sub)}.hxEr>i{width:8px;height:8px;border-radius:50%;display:block}.hxEt b{display:block;font-size:14px;font-weight:650;word-break:keep-all;line-height:1.4}.hxEt small{display:block;font-size:12px;color:var(--sub)}",
    /* 처음이라면 · 대기 · 실패 */
    ".hxStart{margin-top:22px}.hxStart h2{font-size:14px;font-weight:750;color:var(--sub);margin:0 2px 8px}.hxSt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.hxSt button{display:block;text-align:left;border:1px solid var(--line);background:#fff;border-radius:12px;padding:14px 16px;cursor:pointer;color:var(--txt)}.hxSt button:hover{border-color:var(--txt);background:#fff}.hxSt b{display:block;font-size:15px;font-weight:750}.hxSt small{display:block;font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.5;word-break:keep-all;white-space:normal;font-weight:500}",
    ".hxWait{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:var(--hxGap)}.hxWait i{display:block;height:120px;border-radius:10px;background:linear-gradient(90deg,var(--card2),var(--soft),var(--card2));background-size:200% 100%;animation:hxSh 1.4s linear infinite}@keyframes hxSh{to{background-position:-200% 0}}",
    ".hxFail{margin-bottom:var(--hxGap);border-color:#f0c9c5;background:#fffafa}.hxFail b{font-size:15.5px}.hxFail p{margin:4px 0 12px;font-size:13.5px;color:var(--txt2)}.hxFail div{display:flex;gap:8px;flex-wrap:wrap}",
    "#hxRoot .flat{color:var(--sub)}",
    "@media(max-width:860px){.hxFlow{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;width:100%;margin:0 -14px;padding:0 14px;width:calc(100% + 28px)}.hxFlow::-webkit-scrollbar{display:none}.hxFlow button{flex:none}.hxTop h1{font-size:21px}.hxP{padding:15px 14px}.hxMvG{grid-template-columns:1fr;gap:16px}.hxSt{grid-template-columns:1fr;gap:8px}.hxWr{grid-template-columns:minmax(0,1fr) auto 58px;gap:4px 10px}.hxWb{grid-column:1/3;order:5}.hxWv{order:6}.hxEnvs{width:100%}.hxEnv{flex:1 1 0;flex-direction:column;align-items:flex-start;gap:0}}"
  ];
  var st = document.createElement("style"); st.id = "hxCss"; st.textContent = C.join(""); document.head.appendChild(st);
})();
