/* ============================================================ v16.30 브리핑 · 채널 재구성
   브리핑 = "오늘 시장을 읽는 화면". 아침에 시장을 확인하는 순서 그대로 위에서 아래로 놓는다.
     1 결론       한 줄 판정 + 방향 · 폭 · 추세 · 심리 · 국면
     2 자산판     주식 · 금리 · 환율 · 원자재 · 코인 · 변동성이 '평소의 몇 배' 움직였나
     3 핵심 이슈  무슨 일 → 같이 볼 숫자 → 왜 중요한가 → 볼 것 → 이유 후보(기사)   + 옆: 일정 · 내 종목
     4 시장의 속  오른 종목 · 이동평균선 위 비율 · 신고가와 신저가
     5 업종 · 특징주
     6 수급 · 가격 위치
     7 지금 위치  고점 대비(MDD) · 국면 신호 · 과거 비슷한 구간   ← 채널 화면에 있던 근거 자료
     8 선별 종목
   채널 = "오늘 올릴 글을 쓰는 화면". 브리핑과 겹치던 요약 · 이슈 · 근거 자료를 걷어내고 글쓰기 + 복사해 쓸 글감만 남긴다.
   계산은 새로 하지 않는다. briefCompute · issuesCompute · briefStats · chDetectNow · cxlEvents 가 만든 값을 다시 놓을 뿐이고,
   값이 없으면 지어내지 않고 '없음'으로 적는다. 카드 · PDF가 읽는 값(briefState.issues 등)은 건드리지 않는다.
   ============================================================ */
var BX = { news: {}, newsAt: {}, posOn: false, built: false, chBuilt: false };
function bxE(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function bxPct(x, d) { if (x == null || !isFinite(x)) return "–"; d = d == null ? 2 : d; var v = (x * 100).toFixed(d); if (parseFloat(v) === 0) return (0).toFixed(d) + "%"; return (x > 0 ? "+" : "") + v + "%"; }
function bxCls(x) { return x == null || !isFinite(x) || Math.abs(x) < 0.00005 ? "" : x > 0 ? "bxU" : "bxD"; }
function bxMode() { return typeof briefState !== "undefined" && (briefState.mode === "week" || briefState.mode === "month") ? briefState.mode : "day"; }
function bxStat(sym, mode) { try { var r = briefState.recent, d = r && r.symbols && r.symbols[sym]; return d ? briefStats(sym, d, mode || bxMode()) : null; } catch (e) { return null; } }
function bxRet(s, mode) { return (mode || bxMode()) === "day" ? s.ret1 : s.ret; }
/* 평소 변동폭의 몇 배인가 — 하루는 최근 석 달 하루 변동폭, 한 주는 그 값 × √거래일 */
function bxZ(s, mode) { mode = mode || bxMode(); if (!s || !(s.sd > 0)) return null; var r = bxRet(s, mode); if (r == null || !isFinite(r)) return null; return Math.abs(r) / (s.sd * Math.sqrt(mode === "day" ? 1 : (s.winDays || 5))); }
function bxGauge(z, o) {
  if (z == null || !isFinite(z)) return '<span class="bxG none">–</span>';
  o = o || {}; var max = o.max || 3, mid = o.mid || 1.5, hi = o.hi || 2.5, lv = z >= hi ? " hi" : z >= mid ? " mid" : "";
  return '<span class="bxG' + lv + '" title="' + (o.title || "평소 변동폭의") + ' ' + z.toFixed(1) + '배"><i><u style="width:' + Math.round(Math.min(z, max) / max * 100) + '%"></u></i><b>' + (o.pre || "") + z.toFixed(1) + '배</b></span>';
}
function bxName(sym) { var s = { sym: sym, name: sym }; try { return briefName(bxStat(sym, "day") || s); } catch (e) { return sym; } }
function bxClean(t) { return String(t || "").replace(/^[^\s가-힣A-Za-z0-9(]+\s*/, "").replace(/\s+/g, " ").trim(); }
function bxOwner() { return typeof isOwner === "function" && isOwner(); }

/* ---------- 뼈대: 한 번만 만든다. 예전 칸은 id를 그대로 둔 채 새 자리로 옮긴다(예전 코드가 id로 찾아 그리므로 계속 동작) ---------- */
var BX_SECS = [
  ["sum", "결론", "오늘 시장을 한 문단으로"],
  ["board", "자산판", "무엇이 평소보다 크게 움직였나"],
  ["iss", "핵심 이슈", "평소와 달랐던 것, 그리고 왜 중요한가"],
  ["breadth", "시장의 속", "지수 뒤에서 종목들은 어땠나"],
  ["lead", "업종 · 특징주", "어디가 끌고 어디가 밀렸나"],
  ["money", "수급 · 가격 위치", "돈이 몰린 곳과 고점 대비 자리"],
  ["pos", "지금 위치", "긴 흐름에서 어디쯤인가"],
  ["pick", "선별 종목", "숫자 · 재무 · 기사를 겹쳐 고른 후보"]
];
function bxSecHtml(id, no, t, d, body) { return '<section class="bxSec" id="bx-' + id + '"><header><i class="bxNo">' + no + '</i><h3>' + t + '<small>' + d + '</small></h3><span class="bxHd" id="bxHd-' + id + '"></span></header>' + (body || "") + '</section>'; }
function bxMove(node, host) { if (!node || !host || (node.parentNode && node.parentNode.parentNode === host)) return; var nx = node.nextElementSibling, cell = document.createElement("div"); cell.className = "bxCell"; host.appendChild(cell); cell.appendChild(node); if (nx && nx.classList && nx.classList.contains("snapRow")) cell.appendChild(nx); }
function bxSnap(title, root) { return (root || document).querySelector('[data-snap-title="' + title + '"]'); }
function bxSkeleton() {
  var box = document.getElementById("briefBody"); if (!box) return null;
  var root = document.getElementById("bxRoot");
  if (root) return root;
  root = document.createElement("div"); root.id = "bxRoot";
  var n = 0, S = {}; BX_SECS.forEach(function (x) { S[x[0]] = x; });
  function sec(id, body) { var x = S[id]; return bxSecHtml(id, ++n, x[1], x[2], body); }
  root.innerHTML =
    sec("sum", '<div id="bxSum"></div><div id="bxAi"></div>') +
    sec("board", '<div id="bxBoard"></div>') +
    '<div class="bxTwo">' + sec("iss", '<div id="bxIss"></div>') +
      '<aside class="bxSide"><section class="bxSec bxMini" id="bx-cal"><header><h3>일정<small>오늘부터 7일</small></h3></header><div id="bxCal"></div></section>' +
      '<section class="bxSec bxMini" id="bx-mine"><header><h3>내 종목<small>관심 종목은 오늘</small></h3></header><div id="bxMine"></div></section></aside></div>' +
    sec("breadth", '<div id="bxTemp"></div><div class="bxGrid2" id="bxBreadth"></div>') +
    sec("lead", '<div class="bxGrid2 a57" id="bxLead"></div>') +
    sec("money", '<div class="bxGrid2 a75" id="bxMoney"></div>') +
    sec("pos", '<div id="bxPosNow"></div><div id="bxPos"></div>') +
    sec("pick", '<div id="bxPick"></div>');
  box.insertBefore(root, box.firstChild);
  var old = document.createElement("div"); old.id = "bxOld"; old.hidden = true; box.appendChild(old);
  var tb = document.getElementById("tab-brief");
  /* 예전 칸 옮기기 */
  bxMove(document.getElementById("briefAiSec"), document.getElementById("bxAi"));
  bxMove(bxSnap("한눈에", tb), document.getElementById("bxTemp"));
  bxMove(bxSnap("시장 체력", tb), document.getElementById("bxBreadth")); bxMove(bxSnap("신고가·신저가", tb), document.getElementById("bxBreadth"));
  bxMove(bxSnap("테마 흐름", tb), document.getElementById("bxLead")); bxMove(bxSnap("급등·급락", tb), document.getElementById("bxLead"));
  bxMove(bxSnap("돈이 몰린 곳", tb), document.getElementById("bxMoney")); bxMove(bxSnap("오늘의 숫자", tb), document.getElementById("bxMoney"));
  bxMove(document.getElementById("briefSelectSec"), document.getElementById("bxPick"));
  ["briefHero", "briefTop5"].forEach(function (id) { var el = document.getElementById(id); if (el) old.appendChild(el); });
  var cols = box.querySelector(":scope > .bCols"); if (cols) old.appendChild(cols);
  /* 채널 화면의 근거 자료(고점 대비 · 자산배분 · 과거 사례)는 '지금 위치'로 */
  var pos = document.getElementById("bxPos");
  [["MDD 분석", "고점 대비 지금 위치 "], ["자산배분", "국면에 맞춘 자산 구성 "], ["상황별 과거 사례", "과거 비슷한 구간 "]].forEach(function (x) {
    var sec = bxSnap(x[0]); if (!sec) return; bxMove(sec, pos);
    var h3 = sec.querySelector(":scope > h3"); if (h3 && h3.firstChild && h3.firstChild.nodeType === 3) h3.firstChild.nodeValue = x[1];   // 채널 화면의 번호(②③④)는 여기서 뜻이 없으므로 뗀다
  });
  BX.built = true;
  return root;
}

/* ---------- 1 결론 ---------- */
/* v16.40 결론 계산을 화면과 떼어 둔다 — 브리핑 1번과 작업실 '오늘 시장'이 같은 문장 · 같은 숫자를 쓰도록 */
function bxVerdict(R) {
  R = R || (typeof briefState !== "undefined" ? briefState.result : null); if (!R) return null;
  var t = R.uniTemp || R.temp || {}, ir = R.indexRow || [], i0 = ir[0], i1 = ir[1], unit = R.market === "coin" ? "코인" : "종목", off = !!R.marketWideOff || t.empty || !isFinite(t.upPct);
  var up = off ? null : Math.round(t.upPct * 100), a20 = off || !isFinite(t.abovePct) ? null : Math.round(t.abovePct * 100);
  var sp = function (x) { return '<em class="' + bxCls(x) + '">' + bxPct(x) + '</em>'; };
  var head;
  if (off) head = i0 ? bxE(i0.name) + " " + sp(i0.ret) + (i1 ? ", " + bxE(i1.name) + " " + sp(i1.ret) : "") : "지수 자료를 읽지 못했어요";
  else if (i0 && i0.ret > 0 && t.upPct < 0.45) head = bxE(i0.name) + " " + sp(i0.ret) + ", 그런데 오른 " + unit + "은 <em>" + up + "%</em>뿐";
  else if (i0 && i0.ret < 0 && t.upPct > 0.55) head = bxE(i0.name) + " " + sp(i0.ret) + ", 그래도 오른 " + unit + "이 <em>" + up + "%</em>";
  else if (i0) head = bxE(i0.name) + " " + sp(i0.ret) + (i1 ? ", " + bxE(i1.name) + " " + sp(i1.ret) : "") + " — 오른 " + unit + " <em>" + up + "%</em>";
  else head = "오른 " + unit + " <em>" + up + "%</em>";
  var vix = bxStat("^VIX", "day"), now = null; try { now = typeof chDetectNow === "function" ? chDetectNow(briefState.recent) : null; } catch (e) {}
  var nh = (t.newHigh || []).length, nl = (t.newLow || []).length;
  var T = [];
  if (i0) T.push({ l: "방향", v: bxPct(i0.ret), c: bxCls(i0.ret), w: Math.abs(i0.ret) < 0.002 ? "보합" : i0.ret > 0 ? "상승" : "하락", s: i0.name });
  T.push({ l: "폭", v: up == null ? "–" : up + "%", c: up == null ? "" : up >= 50 ? "bxU" : "bxD", w: up == null ? "준비 중" : up >= 65 ? "넓게 오름" : up >= 55 ? "오른 쪽 우세" : up > 45 ? "반반" : up > 35 ? "내린 쪽 우세" : "넓게 내림", s: up == null ? "시장 전체 숫자 없음" : "오른 " + unit + " " + t.up + "/" + t.total });
  T.push({ l: "추세", v: a20 == null ? "–" : a20 + "%", c: a20 == null ? "" : a20 >= 50 ? "bxU" : "bxD", w: a20 == null ? "준비 중" : a20 >= 60 ? "상승 우세" : a20 <= 40 ? "하락 우세" : "혼조", s: "20일선 위" + (t.n200 && t.above200Pct != null ? " · 200일선 위 " + Math.round(t.above200Pct * 100) + "%" : "") });
  if (vix && (R.market === "all" || R.market === "us" || R.market === "stock")) T.push({ l: "심리", v: vix.last.toFixed(1), c: vix.last >= 25 ? "bxD" : "", w: vix.last >= 30 ? "공포" : vix.last >= 20 ? "불안" : "평온", s: "공포지수 · 하루 " + bxPct(vix.ret1, 1) });
  else if (t.n200) T.push({ l: "신고가 : 신저가", v: nh + " : " + nl, c: nh > nl ? "bxU" : nl > nh ? "bxD" : "", w: nh > nl ? "신고가 우세" : nl > nh ? "신저가 우세" : "비슷", s: "52주 종가 기준" });
  if (now) { var sig = (now.why || []).map(function (w) { return w.split("→").pop().trim(); }); T.push({ l: "국면", v: sig.length ? sig[0] : "평소 구간", c: "", w: sig.length > 1 ? "신호 " + sig.length + "개" : sig.length ? "신호 1개" : "뚜렷한 신호 없음", s: sig.length ? (now.why[0].split("→")[0] || "").trim() : "금리 · 공포 · 유가 · 달러 모두 평소 범위", txt: 1 }); }
  var lines = []; try { lines = off || typeof thrInsights !== "function" ? [] : thrInsights(R, briefState.issues || [], unit).slice(0, 3); } catch (e) {}
  var basis = R.marketWideOff ? "" : R.uniTemp ? (R.uniTemp.uni || "전체 시장") + (R.basis && R.basis.date ? " · " + String(R.basis.date).slice(5).replace("-", "/") + " 마감" : "") + " 기준" : "대표 자산 " + (R.temp ? R.temp.total : 0) + "개 기준";
  return { head: head, tiles: T, lines: lines, basis: basis, off: !!R.marketWideOff, offWhy: (R.basis && R.basis.why) || "" };
}
function bxSum() {
  var el = document.getElementById("bxSum"), V = bxVerdict(); if (!V || !el) return;
  var T = V.tiles, lines = V.lines, basis = V.basis;
  var h = '<p class="bxHead">' + V.head + '</p>';
  if (V.off) h += '<div class="bxWarn"><b>시장 전체 숫자를 숨겼어요.</b> ' + bxE(V.offWhy || "전체 시장 요약이 아직 준비되지 않았어요") + ' — 지수와 자산판만 믿을 수 있는 값이에요. 틀린 숫자를 보여 주지 않으려는 조치예요.</div>';
  h += '<div class="bxJ">' + T.map(function (k) { return '<div class="bxJt' + (k.txt ? " txt" : "") + '"><span>' + k.l + '</span><b class="' + k.c + '">' + bxE(k.v) + '</b><em>' + bxE(k.w) + '</em><small>' + bxE(k.s) + '</small></div>'; }).join("") + '</div>';
  if (lines.length) h += '<ol class="bxLines">' + lines.map(function (x) { return '<li>' + bxE(x) + '</li>'; }).join("") + '</ol>';
  if (basis) h += '<p class="bxNote">' + bxE(basis) + ' · 종가 기준 · 숫자에서 읽은 내용이고 전망이 아니에요</p>';
  el.innerHTML = h;
}

/* ---------- 2 자산판 ---------- */
var BX_BOARD = [
  ["주식", [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["^GSPC", "S&P500"], ["^IXIC", "나스닥"], ["^N225", "니케이"], ["^HSI", "항셍"]]],
  ["심리", [["^VIX", "공포지수(VIX)"]]],
  ["금리 · 환율", [["TLT", "미국 장기채"], ["KRW=X", "달러/원"], ["DX-Y.NYB", "달러지수"], ["JPYKRW=X", "엔/원"]]],
  ["원자재 · 코인", [["GLD", "금"], ["USO", "원유"], ["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"]]]
];
var BX_BOARD_NOTE = { "JPYKRW=X": "100엔 기준", TLT: "오르면 금리는 내림", "KRW=X": "오르면 원화 약세", "^VIX": "20 넘으면 불안", GLD: "금 ETF", USO: "원유 ETF" };
var BX_BOARD_TIP = { TLT: "미국 20년 이상 국채 ETF. 값이 오르면 장기 금리는 내린 것이에요", "KRW=X": "1달러를 사는 데 드는 원화. 오르면 원화 약세예요", "^VIX": "옵션 시장이 내다보는 앞으로 30일의 변동성. 20 넘으면 불안, 30 넘으면 공포 구간으로 봐요", "DX-Y.NYB": "주요 6개 통화 대비 달러 값", GLD: "금 현물을 따라가는 ETF 가격", USO: "서부텍사스유 선물을 따라가는 ETF 가격" };
function bxBoard() {
  var el = document.getElementById("bxBoard"); if (!el) return;
  var mode = bxMode(), lab = mode === "week" ? "한 주" : mode === "month" ? "한 달" : "하루", all = [], miss = [];
  var groups = BX_BOARD.map(function (g) {
    var rows = g[1].map(function (p) { var s = bxStat(p[0]); if (!s) { miss.push(p[1]); return null; } var o = { sym: p[0], n: p[1], s: s, r: bxRet(s), z: bxZ(s) }; all.push(o); return o; }).filter(Boolean);
    return [g[0], rows];
  }).filter(function (g) { return g[1].length; });
  if (!all.length) { el.innerHTML = '<div class="bxEmpty">지수 · 환율 · 원자재 시세를 읽지 못했어요. 데이터 화면에서 수집 상태를 확인해 주세요.</div>'; return; }
  var hot = all.filter(function (o) { return o.z != null && o.z >= 1.5; }).sort(function (a, b) { return b.z - a.z; });
  var sumLine = hot.length ? '평소보다 크게 움직인 것 <b>' + hot.length + '개</b> — ' + hot.slice(0, 4).map(function (o) { return bxE(o.n) + ' <em class="' + bxCls(o.r) + '">' + bxPct(o.r) + '</em> (' + o.z.toFixed(1) + '배)'; }).join(" · ") : '모든 자산이 평소 ' + lab + ' 변동폭의 1.5배 안에서 움직였어요 — 특별히 튄 곳이 없는 날이에요.';
  function row(o) {
    var s = o.s, note = BX_BOARD_NOTE[o.sym];
    return '<button type="button" class="bxR' + (o.z != null && o.z >= 2.5 ? " hi" : o.z != null && o.z >= 1.5 ? " mid" : "") + '" data-shsym="' + bxE(o.sym) + '"' + (BX_BOARD_TIP[o.sym] ? ' title="' + bxE(BX_BOARD_TIP[o.sym]) + '"' : "") + '>' +
      '<span class="n">' + bxE(o.n) + (note ? '<small>' + bxE(note) + '</small>' : "") + '</span>' +
      '<span class="p">' + bxE(o.sym === "DX-Y.NYB" ? s.last.toFixed(2) : o.sym === "JPYKRW=X" && s.last < 50 ? (s.last * 100).toFixed(1) + "원" : typeof cPrice === "function" ? cPrice(o.sym, s.last) : String(s.last)) + '</span>' +
      '<span class="c ' + bxCls(o.r) + '">' + bxPct(o.r) + '</span>' +
      '<span class="z">' + bxGauge(o.z) + '</span>' +
      '<span class="m ' + bxCls(s.m1) + '">' + bxPct(s.m1, 1) + '</span>' +
      '<span class="h">' + (s.vsHi != null && o.sym !== "^VIX" ? bxPct(s.vsHi, 1) : "–") + '</span></button>';
  }
  var head = '<div class="bxR bxRh"><span class="n">자산</span><span class="p">지금</span><span class="c">' + (mode === "day" ? "하루" : mode === "week" ? "한 주" : "한 달") + '</span><span class="z">평소 대비</span><span class="m">1개월</span><span class="h">고점 대비</span></div>';
  var half = [[], []]; groups.forEach(function (g, i) { half[i < 2 ? 0 : 1].push(g); }); if (!half[1].length) half = [half[0]];
  el.innerHTML = '<p class="bxLead">' + sumLine + '</p><div class="bxBd' + (half.length < 2 ? " one" : "") + '">' + half.map(function (col) {
    return '<div class="bxBc">' + head + col.map(function (g) { return '<div class="bxBg">' + g[0] + '</div>' + g[1].map(row).join(""); }).join("") + '</div>';
  }).join("") + '</div><p class="bxNote">평소 대비 = 이번 ' + lab + ' 등락 ÷ 최근 석 달의 평소 ' + lab + ' 변동폭. 1.5배부터 눈여겨보고 2.5배부터는 드문 움직임이에요. 고점 대비는 52주 최고 종가 기준.' + (miss.length ? ' 시세가 없어 뺀 것: ' + bxE(miss.join(", ")) + '.' : '') + '</p>';
}

/* ---------- 3 핵심 이슈 ---------- */
var BX_SCOPE = { "idx-us": ["시장", "미국 증시", 1], "idx-kr": ["시장", "한국 증시", 1], breadth: ["시장", "시장 폭", 1], fx: ["거시", "환율", 2], vix: ["거시", "변동성", 2], rate: ["거시", "금리", 2], gold: ["거시", "금", 2], oil: ["거시", "원유", 2], btc: ["거시", "코인", 2], "theme-up": ["업종", "강한 업종", 3], "theme-down": ["업종", "약한 업종", 3], mover: ["종목", "급등락", 4], hot: ["종목", "거래대금", 4], mdd: ["위치", "깊은 하락", 5], signal: ["위치", "시장 신호", 5] };
function bxThemeOf(sym) { if (typeof BRIEF_THEMES === "undefined") return null; for (var i = 0; i < BRIEF_THEMES.length; i++) if (BRIEF_THEMES[i][1].indexOf(sym) >= 0) return BRIEF_THEMES[i]; return null; }
/* 이슈마다: 같이 볼 숫자(앱이 가진 값) · 왜 중요한가(일반 원리) · 볼 것. 원인은 단정하지 않는다 — 원인은 기사와 Claude 해설 칸의 몫 */
function bxKb(it, R) {
  var c = it.cat, s = it.sym ? bxStat(it.sym, "day") : null, r = s ? s.ret1 : null, up = r != null ? r >= 0 : /상승|강세|급등/.test(it.title), ev = [], why = "", watch = "";
  var t = R.uniTemp || R.temp || {}, hasT = !R.marketWideOff && isFinite(t.upPct);
  function chip(label, sym) { var x = bxStat(sym, "day"); if (x) ev.push([label, bxPct(x.ret1), x.ret1]); return x; }
  if (c === "idx-us" || c === "idx-kr") {
    if (hasT) { ev.push(["오른 종목", Math.round(t.upPct * 100) + "%", t.upPct - 0.5]); if (isFinite(t.abovePct)) ev.push(["20일선 위", Math.round(t.abovePct * 100) + "%", t.abovePct - 0.5]); }
    if (c === "idx-kr") chip("달러/원", "KRW=X"); else chip("미국 장기채", "TLT");
    why = "지수는 덩치 큰 종목 몇 개가 좌우해요. 오른 종목 비율이 지수와 같은 방향이면 시장 전체가 움직인 날이고, 반대면 대형주만 움직인 날이에요.";
    if (hasT && r != null) why += (r >= 0) === (t.upPct >= 0.5) ? " 오늘은 지수와 종목 수가 같은 방향이었어요." : " 오늘은 지수와 종목 수가 엇갈렸어요.";
    watch = c === "idx-kr" ? "달러/원 방향, 강했던 업종이 다음 날에도 이어지는지" : "금리(장기채)와 같이 움직였는지, 강했던 업종이 이어지는지";
  } else if (c === "breadth") {
    if (isFinite(t.abovePct)) ev.push(["20일선 위", Math.round(t.abovePct * 100) + "%", t.abovePct - 0.5]);
    if (t.n200) ev.push(["신고가 : 신저가", (t.newHigh || []).length + " : " + (t.newLow || []).length, (t.newHigh || []).length - (t.newLow || []).length]);
    var i0 = (R.indexRow || [])[0]; if (i0) ev.push([i0.name, bxPct(i0.ret), i0.ret]);
    why = "오른 종목 비율은 지수가 말해 주지 않는 시장의 속이에요. 한쪽으로 크게 쏠린 날은 종목마다의 이유보다 금리 · 환율 · 큰 뉴스 같은 시장 전체 요인인 경우가 많아요.";
    watch = "내 종목이 시장과 같은 방향이었는지, 20일선 위 비율이 따라 움직이는지";
  } else if (c === "fx") {
    var dx = chip("달러지수", "DX-Y.NYB"); chip("코스피", "^KS11"); if (s && s.m1 != null) ev.push(["달러/원 1개월", bxPct(s.m1, 1), s.m1]);
    why = up ? "원화 값이 내렸다는 뜻이에요. 외국인이 한국 주식을 팔 때 자주 같이 나타나고, 수출 기업엔 유리하지만 수입 물가엔 부담이에요." : "원화 값이 올랐다는 뜻이에요. 외국인 자금이 들어올 때 자주 같이 나타나고, 달러 자산의 원화 환산 수익은 줄어요.";
    if (dx && r != null && Math.abs(dx.ret1) >= 0.001) why += (dx.ret1 >= 0) === (r >= 0) ? " 달러지수도 같은 방향이라 달러 자체가 움직인 날로 보여요." : " 달러지수는 반대 방향이라 원화 쪽 요인이 커 보여요.";
    watch = "달러지수 방향, 코스피 대형주 흐름, 해외 자산의 원화 환산 손익";
  } else if (c === "vix") {
    chip("S&P500", "^GSPC"); if (s && s.m1 != null) ev.push(["VIX 1개월", bxPct(s.m1, 0), -s.m1]);
    why = "VIX는 옵션 시장이 내다보는 앞으로 30일의 S&P500 변동성이에요. 보통 20 아래는 평온, 20~30은 불안, 30 위는 공포 구간으로 봐요. 방향이 아니라 '얼마나 흔들릴지'에 대한 값이에요.";
    watch = "20 · 30선을 넘는지, 지수의 하루 변동폭이 같이 커지는지";
  } else if (c === "rate") {
    chip("나스닥", "^IXIC"); chip("달러/원", "KRW=X"); if (s && s.m1 != null) ev.push(["장기채 1개월", bxPct(s.m1, 1), s.m1]);
    why = up ? "장기채 값이 오르면 금리는 내린 거예요. 금리가 내리면 먼 미래 이익에 기대는 성장주 · 기술주 평가에 숨통이 트여요." : "장기채 값이 내리면 금리는 오른 거예요. 금리가 오르면 성장주 · 기술주 평가에 부담이 되고 달러는 강해지기 쉬워요.";
    watch = "나스닥 · 성장주가 같이 반응했는지, 다음 물가 · 고용 지표 일정";
  } else if (c === "gold") {
    chip("달러지수", "DX-Y.NYB"); chip("미국 장기채", "TLT"); if (s && s.vsHi != null) ev.push(["52주 고점 대비", bxPct(s.vsHi, 1), s.vsHi]);
    why = "금은 금리가 내리거나 달러가 약해질 때, 그리고 불안이 커질 때 강해지는 경향이 있어요. 주식과 다르게 움직이는 날이 많아 섞어 들면 출렁임을 줄여 줘요.";
    watch = "달러지수와 금리 방향이 금과 맞물려 움직였는지";
  } else if (c === "oil") {
    chip("S&P500", "^GSPC"); if (s && s.m1 != null) ev.push(["원유 1개월", bxPct(s.m1, 1), s.m1]);
    why = up ? "유가가 오르면 물가와 금리에 부담이 돼요. 에너지 업종엔 유리하고, 항공 · 화학처럼 기름을 많이 쓰는 업종엔 비용 부담이에요." : "유가가 내리면 물가 부담이 줄어요. 에너지 업종엔 불리하고, 항공 · 화학처럼 기름을 많이 쓰는 업종엔 비용이 줄어요.";
    watch = "에너지 업종 움직임, 다음 물가 지표";
  } else if (c === "btc") {
    chip("이더리움", "ETH-USD"); chip("나스닥", "^IXIC"); if (s && s.vsHi != null) ev.push(["52주 고점 대비", bxPct(s.vsHi, 1), s.vsHi]);
    why = "코인은 위험 자산을 사려는 분위기를 가장 먼저 반영하는 편이에요. 주말에도 거래되므로 월요일 주식 시장보다 먼저 움직여요.";
    watch = "코인 관련주(거래소 · 채굴 · 보유 기업)가 같이 움직이는지, 나스닥 방향";
  } else if (c === "theme-up" || c === "theme-down") {
    var th = (R.themes || []).filter(function (x) { return it.title.indexOf(x.name) === 0; })[0];
    if (th) { ev.push(["오른 종목", th.up + "/" + th.n, th.up / th.n - 0.5]); if (th.best) ev.push(["가장 강한", briefName(th.best) + " " + bxPct(th.best.ret), th.best.ret]); if (th.worst && th.worst !== th.best) ev.push(["가장 약한", briefName(th.worst) + " " + bxPct(th.worst.ret), th.worst.ret]); }
    why = "업종이 통째로 움직이면 종목 하나의 뉴스보다 정책 · 금리 · 원자재 값 · 대표 기업 실적 같은 업종 공통 요인일 가능성이 커요.";
    if (th && th.n >= 3) { var same = (c === "theme-up" ? th.up : th.n - th.up) / th.n; why += same >= 0.75 ? " 묶음 안 대부분이 같은 방향이라 업종 전체의 움직임이에요." : " 묶음 안에서도 방향이 갈려, 몇 종목이 평균을 끌었어요."; }
    watch = "대표 종목의 다음 실적 · 공시, 같은 흐름이 며칠 이어지는지";
  } else if (c === "mover") {
    if (s) { if (s.amtX != null) ev.push(["거래대금", "평소의 " + s.amtX.toFixed(1) + "배", s.amtX - 1]); if (s.vsHi != null) ev.push(["52주 고점 대비", bxPct(s.vsHi, 1), s.vsHi]); if (s.m1 != null) ev.push(["1개월", bxPct(s.m1, 1), s.m1]); }
    why = "평소 하루 변동폭을 크게 벗어난 움직임이에요. 실적 · 공시 · 수주 · 증권사 의견처럼 그 종목만의 이유가 있는 경우가 많아요.";
    var tm = it.sym ? bxThemeOf(it.sym) : null;
    if (tm) { var sum = 0, cnt = 0; tm[1].forEach(function (y) { if (y === it.sym) return; var x = bxStat(y, "day"); if (x) { sum += x.ret1; cnt++; } }); if (cnt >= 3 && r != null) { var avg = sum / cnt; ev.push([tm[0] + " 평균", bxPct(avg), avg]); why += Math.abs(avg) >= 0.01 && (avg >= 0) === (r >= 0) ? " 같은 묶음(" + tm[0] + ") 평균도 같은 방향이라 업종 요인이 섞여 있어요." : " 같은 묶음(" + tm[0] + ") 평균은 크게 움직이지 않아 종목 고유의 이유로 보여요."; } }
    watch = "공시와 실적 발표일, 거래대금이 다음 날에도 이어지는지";
  } else if (c === "hot") {
    if (s) { ev.push(["주가", bxPct(s.ret1), s.ret1]); try { if (R.amtKrw && s.amt) ev.push(["거래대금", briefFmtAmt(R.amtKrw(s)), 0]); } catch (e) {} if (s.vsHi != null) ev.push(["52주 고점 대비", bxPct(s.vsHi, 1), s.vsHi]); }
    why = "거래대금이 갑자기 늘었다는 건 관심이 몰렸다는 뜻이지, 방향을 말해 주진 않아요. " + (r != null && r >= 0 ? "오르면서 거래가 터졌으니 새로 사려는 쪽이 붙은 날이에요." : "내리면서 거래가 터졌으니 파는 쪽이 급했던 날이에요.") + " 이런 뒤 며칠은 변동이 커지기 쉬워요.";
    watch = "다음 날에도 거래가 이어지는지, 공시와 기사";
  } else if (c === "mdd") {
    why = "고점에서 얼마나 내려왔는지는 싸다 · 비싸다가 아니라, 과거 하락과 견준 지금 자리를 알려 줘요.";
    watch = "아래 '지금 위치'에서 과거 하락과 회복 기간";
  } else if (c === "signal") {
    why = "금리 · 공포지수 · 유가 · 달러가 정해 둔 기준을 넘으면 켜지는 신호예요. 과거 같은 신호 때의 흐름을 참고하는 용도예요.";
    watch = "아래 '지금 위치'에서 과거 비슷한 구간";
  }
  return { ev: ev, why: why, watch: watch, z: s ? bxZ(s, "day") : null, ax: s && s.amtX != null ? s.amtX : null };
}
var BX_NEWS_KEY = { fx: [{ type: "market", cat: "fx", size: 12 }, /환율|달러|원화/], rate: [{ type: "market", cat: "rate", size: 12 }, /금리|국채|연준|Fed|FOMC|채권/i], vix: [{ type: "market", cat: "world", size: 15 }, /VIX|변동성|공포/i], gold: [{ type: "market", cat: "world", size: 15 }, /금값|금 가격|금 선물|국제 금/], oil: [{ type: "market", cat: "world", size: 15 }, /유가|원유|WTI|브렌트/i], btc: [{ type: "market", cat: "world", size: 15 }, /비트코인|가상자산|암호화폐|코인/], "idx-us": [{ type: "market", cat: "world", size: 15 }, /뉴욕|나스닥|S&P|다우|미국 증시|월가/i], "idx-kr": [{ type: "market", cat: "main", size: 15 }, /코스피|코스닥|증시/], breadth: [{ type: "market", cat: "main", size: 15 }, /코스피|코스닥|증시|뉴욕/] };
function bxNewsFor(it, key) {
  if (typeof fetchNews !== "function") return;
  if (BX.news[key] !== undefined) return;
  var K = BX_NEWS_KEY[it.cat], p, re = null;
  if (K) { p = K[0]; re = K[1]; }
  else if (it.cat === "mover" || it.cat === "hot") { if (!it.sym) return; p = { type: "stock", q: bxName(it.sym), size: 3 }; }
  else if (it.cat === "theme-up" || it.cat === "theme-down") { var nm = String(it.title).split(/\s[+\-–]?\d/)[0].replace(/\s*\(.*?\)\s*/g, "").trim(); if (!nm) return; p = { type: "stock", q: nm.replace(/·/g, " "), size: 3 }; }
  else return;
  BX.news[key] = null;
  fetchNews(p).then(function (items) {
    var L = (items || []).filter(function (x) { return x && x.title && (!re || re.test(x.title)); }).slice(0, 2);
    BX.news[key] = L; bxNewsPaint(key);
  }).catch(function () { BX.news[key] = []; bxNewsPaint(key); });
}
function bxNewsHtml(key) {
  var L = BX.news[key];
  if (L === undefined) return "";
  if (L === null) return '<span class="bxDim">기사 찾는 중…</span>';
  if (!L.length) return '<span class="bxDim">맞는 기사 제목을 찾지 못했어요 — 뚜렷한 뉴스 없이 움직였을 수 있어요</span>';
  return L.map(function (x) { var t = String(x.title).replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"); return '<a href="' + bxE(x.url || "#") + '" target="_blank" rel="noopener">' + bxE(t) + (x.press ? ' <small>' + bxE(x.press) + '</small>' : "") + '</a>'; }).join("");
}
function bxNewsPaint(key) { var el = document.querySelector('#bxIss [data-bxnews="' + key + '"]'); if (el) el.innerHTML = bxNewsHtml(key); }
function bxIss() {
  var el = document.getElementById("bxIss"), R = briefState.result; if (!el || !R) return;
  var list = briefState.issues || [], hd = document.getElementById("bxHd-iss");
  if (!list.length) {
    el.innerHTML = '<div class="bxEmpty">' + (R.marketWideOff ? "시장 전체 숫자를 쓸 수 없는 날이라 이슈를 고르지 않았어요. 틀린 순위를 보여 주지 않으려는 조치예요 — 위 자산판과 아래 일정은 그대로 볼 수 있어요." : "오늘은 고를 만한 이슈가 없어요.") + '</div>';
    if (hd) hd.innerHTML = ""; return;
  }
  var own = bxOwner() && typeof smClaude === "function" && typeof issWhyRun === "function";
  if (hd) {
    hd.innerHTML = '<button type="button" class="chip" data-bx="copy">전체 복사</button>' + (own ? '<button type="button" class="chip" data-bx="why" title="Claude가 웹에서 확인해 이슈마다 왜 · 그래서 · 볼 것을 채워요">Claude로 이유 채우기</button>' : "");
    hd.querySelector('[data-bx="copy"]').onclick = function () { (typeof chCopy === "function" ? chCopy : issCopy)(issuesText(list), this); };
    var wb = hd.querySelector('[data-bx="why"]'); if (wb) wb.onclick = function () { issWhyRun(list, document.getElementById("briefTop5"), wb); };
  }
  var view = list.map(function (it, i) { var sc = BX_SCOPE[it.cat] || ["기타", "", 9]; return { it: it, i: i, sc: sc }; }).sort(function (a, b) { return a.sc[2] - b.sc[2] || a.i - b.i; });
  var watch = {}; try { (typeof loadWatch === "function" ? loadWatch() : []).forEach(function (w) { watch[w.s] = 1; }); } catch (e) {}
  var day = (list.asOf || 0) + "|" + (list.market || "all");
  el.innerHTML = '<p class="bxLead">평소 변동폭을 가장 크게 벗어난 다섯 가지예요. 큰 것부터 작은 것 순서(시장 → 거시 → 업종 → 종목)로 놓았어요.' + (list.market && list.market !== "all" ? ' <b>' + bxE(list.mktName || "") + '</b>만 봤어요.' : '') + '</p><ol class="bxIL">' + view.map(function (v, n) {
    var it = v.it, K = bxKb(it, R), w = typeof ISS_WHY !== "undefined" ? ISS_WHY[it.title] : null, key = day + "|" + it.cat + "|" + (it.sym || it.title.slice(0, 12));
    bxNewsFor(it, key);
    var sub = String(it.sub || "").replace(/\s*·\s*평소 (하루|한 주|한 달) 변동의 [0-9.]+배/, "").replace(/^평소 (하루|한 주|한 달) 변동의 [0-9.]+배$/, "").trim();
    var h = '<li class="bxI"><div class="bxIh"><span class="bxTag s' + v.sc[2] + '">' + v.sc[0] + (v.sc[1] ? '<i>' + v.sc[1] + '</i>' : "") + '</span>' + (it.sym && watch[it.sym] ? '<span class="bxMineTag">관심 종목</span>' : "") + '<span class="bxIz">' + (it.cat === "hot" && K.ax != null ? bxGauge(K.ax, { max: 6, mid: 1.8, hi: 4, pre: "거래대금 평소의 ", title: "거래대금이 최근 20일 평균의" }) : K.z != null ? bxGauge(K.z, { pre: "평소의 " }) : "") + '</span></div>' +
      '<h4><i class="bxIn">' + (n + 1) + '</i>' + bxE(it.title) + '</h4>' + (sub ? '<p class="bxIs">' + bxE(sub) + '</p>' : "");
    if (K.ev.length) h += '<div class="bxEv"><span>같이 볼 숫자</span>' + K.ev.map(function (e) { return '<em>' + bxE(e[0]) + ' <b class="' + bxCls(e[2]) + '">' + bxE(e[1]) + '</b></em>'; }).join("") + '</div>';
    h += '<dl class="bxDl">';
    if (w && w.why) {
      h += '<dt class="ai">왜</dt><dd>' + bxE(w.why) + '</dd>' + (w.so ? '<dt class="ai">그래서</dt><dd>' + bxE(w.so) + '</dd>' : "") + (w.next ? '<dt class="ai">볼 것</dt><dd>' + bxE(w.next) + '</dd>' : "") +
        '<dt></dt><dd class="bxSrc">Claude 해설' + (w.src ? ' · 출처 ' + (w.url ? '<a href="' + bxE(w.url) + '" target="_blank" rel="noopener">' + bxE(w.src) + '</a>' : bxE(w.src)) : "") + (w.conf ? ' · 확신 ' + bxE(w.conf) : "") + (w.bad && w.bad.length && typeof smNumWarn === "function" ? " " + smNumWarn(w.bad) : "") + '</dd>';
      if (K.why) h += '<dt>원리</dt><dd class="bxSoft">' + bxE(K.why) + '</dd>';
    } else {
      if (K.why) h += '<dt>왜 중요한가</dt><dd>' + bxE(K.why) + '</dd>';
      if (K.watch) h += '<dt>볼 것</dt><dd>' + bxE(K.watch) + '</dd>';
    }
    h += '<dt>이유 후보</dt><dd class="bxNews" data-bxnews="' + bxE(key) + '">' + bxNewsHtml(key) + '</dd></dl>';
    if (it.sym) h += '<div class="bxIa"><button type="button" class="chip" data-shsym="' + bxE(it.sym) + '">' + bxE(bxName(it.sym)) + ' 차트 열기</button></div>';
    return h + '</li>';
  }).join("") + '</ol>' +
    '<p class="bxNote">' + (typeof ISS_WHY !== "undefined" && ISS_WHY._note ? '흐름: ' + bxE(ISS_WHY._note) + ' · ' : '') + '\'왜 중요한가\'는 일반 원리이고 오늘의 원인을 단정하지 않아요. 원인은 기사 제목(이유 후보)과 Claude 해설에서 확인하세요.' + (own ? '' : '') + '</p>';
}

/* ---------- 옆: 일정 · 내 종목 ---------- */
/* v16.40 일정 종류 표시 — 빨강 · 파랑은 '올랐다 · 내렸다'에만 쓰므로 여기선 먹 · 금 · 청록 · 회색 · 보라 */
var BX_KIND = { rate: ["금리", "#14161c"], data: ["지표", "#8a6a1f"], earn: ["실적", "#0f7f7a"], hol: ["휴장", "#7a8494"], exp: ["만기", "#6b5bd2"] };
function bxKind(k) { return BX_KIND[k] || ["일정", "#7a8494"]; }
function bxCal() {
  var el = document.getElementById("bxCal"); if (!el) return;
  if (typeof cxlEvents !== "function" || typeof cxlToday !== "function" || typeof cxlAdd !== "function") { el.innerHTML = '<div class="bxEmpty">일정 자료가 없어요.</div>'; return; }
  var today = cxlToday(), end = cxlAdd(today, 7), EV = [];
  try { EV = cxlEvents().filter(function (e) { return e.d >= today && e.d <= end; }); } catch (e) {}
  if (!EV.length) { el.innerHTML = '<div class="bxEmpty">앞으로 7일 동안 등록된 일정이 없어요.</div><button type="button" class="bxLink" data-shgo="ops">달력 전체 보기</button>'; return; }
  var dow = function (d) { return "일월화수목금토".charAt(new Date(d + "T00:00:00Z").getUTCDay()); };
  el.innerHTML = '<ul class="bxCl">' + EV.slice(0, 7).map(function (e) {
    var K = bxKind(e.kind), note = e.n || ""; try { if (!note && typeof pubEvNote === "function") note = pubEvNote(e) || ""; } catch (er) {}
    var when = e.d === today ? "오늘" : e.d === cxlAdd(today, 1) ? "내일" : "";
    return '<li' + (when === "오늘" ? ' class="td"' : "") + '><time>' + (when ? '<b>' + when + '</b>' : "") + e.d.slice(5).replace("-", "/") + " " + dow(e.d) + '</time><div><span class="bxK" style="--c:' + K[1] + '">' + K[0] + '</span><b>' + bxE(bxClean(e.t)) + (e.est ? ' <small class="est">예상</small>' : "") + '</b>' + (note ? '<p>' + bxE(note) + '</p>' : "") + '</div></li>';
  }).join("") + '</ul>' + (EV.length > 7 ? '<p class="bxNote">외 ' + (EV.length - 7) + '건</p>' : "") + '<button type="button" class="bxLink" data-shgo="ops">달력 전체 보기</button>';
}
function bxMine() {
  var el = document.getElementById("bxMine"); if (!el) return;
  var W = []; try { W = typeof loadWatch === "function" ? loadWatch() : []; } catch (e) {}
  if (!W.length) { el.innerHTML = '<div class="bxEmpty">관심 종목을 담아 두면, 그중 오늘 크게 움직인 종목이 여기에 먼저 보여요.</div><button type="button" class="bxLink" data-shgo="watch">관심 종목 열기</button>'; return; }
  var rows = [], miss = 0;
  W.forEach(function (w) { var s = bxStat(w.s); if (!s) { miss++; return; } rows.push({ sym: w.s, n: (function () { try { return briefName(s); } catch (e) { return w.n || w.s; } })(), s: s, r: bxRet(s), z: bxZ(s) }); });
  rows.sort(function (a, b) { return (b.z || 0) - (a.z || 0); });
  if (!rows.length) { el.innerHTML = '<div class="bxEmpty">관심 종목 ' + W.length + '개가 매일 받는 시세 묶음 밖이라 여기서는 계산하지 못해요.</div><button type="button" class="bxLink" data-shgo="watch">관심 종목 화면에서 보기</button>'; return; }
  var big = rows.filter(function (x) { return x.z != null && x.z >= 1.5; }).length;
  el.innerHTML = '<p class="bxLead">' + (big ? '평소보다 크게 움직인 종목 <b>' + big + '개</b>' : '모두 평소 범위 안이에요') + '</p><div class="bxMl">' + rows.slice(0, 6).map(function (x) {
    return '<button type="button" data-shsym="' + bxE(x.sym) + '"><span>' + bxE(x.n) + '</span><b class="' + bxCls(x.r) + '">' + bxPct(x.r) + '</b>' + bxGauge(x.z) + '</button>';
  }).join("") + '</div>' + (rows.length > 6 || miss ? '<p class="bxNote">' + (rows.length > 6 ? '외 ' + (rows.length - 6) + '개' : '') + (rows.length > 6 && miss ? ' · ' : '') + (miss ? '시세 묶음 밖 ' + miss + '개는 빠졌어요' : '') + '</p>' : '') + '<button type="button" class="bxLink" data-shgo="watch">관심 종목 전체 보기</button>';
}

/* ---------- 7 지금 위치: 신호는 바로, 무거운 계산(10년치)은 그 칸이 보일 때 ---------- */
function bxPosNow() {
  var el = document.getElementById("bxPosNow"); if (!el) return;
  var now = null; try { now = typeof chDetectNow === "function" ? chDetectNow(briefState.recent) : null; } catch (e) {}
  if (!now) { el.innerHTML = ""; return; }
  el.innerHTML = '<div class="bxSig"><span>지금 켜진 신호</span>' + (now.why && now.why.length ? now.why.map(function (w) { var p = w.split("→"); return '<em><b>' + bxE((p[1] || p[0]).trim()) + '</b>' + (p[1] ? ' ' + bxE(p[0].trim()) : "") + '</em>'; }).join("") : '<em>없음 — 금리 · 공포지수 · 유가 · 달러가 모두 평소 범위예요</em>') + '</div>';
}
function bxPosLoad() {
  if (BX.posOn) return; BX.posOn = true;
  if (typeof renderChannel !== "function" || !bxOwner()) { var p = document.getElementById("bxPos"); if (p && !p.children.length) p.innerHTML = '<div class="bxEmpty">과거 하락 · 비슷한 구간 자료는 운영자 화면에서만 계산해요.</div>'; return; }
  try { renderChannel(); } catch (e) { console.warn("bx pos", e); }
}
function bxPosWatch() {
  var sec = document.getElementById("bx-pos"); if (!sec || BX.posOn) return;
  if (!("IntersectionObserver" in window)) { bxPosLoad(); return; }
  if (BX.io) return;
  BX.io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { BX.io.disconnect(); BX.io = null; bxPosLoad(); } }, { rootMargin: "500px 0px" });
  BX.io.observe(sec);
}

/* ---------- 차례 ---------- */
function bxToc() {
  var root = document.getElementById("bxRoot"); if (!root || typeof vxToc !== "function") return;
  var secs = BX_SECS.map(function (x) { return document.getElementById("bx-" + x[0]); }).filter(function (s) { return s && !s.hidden; });
  vxToc(root, secs, "bxToc");
  var nav = document.getElementById("bxToc"); if (!nav) return;
  Array.prototype.forEach.call(nav.children, function (b) { var s = secs[+b.getAttribute("data-i")], no = s && s.querySelector(".bxNo"), x = s && BX_SECS.filter(function (y) { return "bx-" + y[0] === s.id; })[0]; if (no && x) b.innerHTML = '<i>' + no.textContent + '</i>' + x[1]; });
  root.insertBefore(nav, root.firstChild);
}
function bxRender() {
  if (typeof briefState === "undefined" || !briefState.result) return;
  var root = bxSkeleton(); if (!root) return;
  var steps = [bxSum, bxBoard, bxIss, bxCal, bxMine, bxPosNow];
  steps.forEach(function (f) { try { f(); } catch (e) { console.warn("bx", e); } });
  /* 비어 있는 칸은 숨긴다(선별 종목 등) */
  var pk = document.getElementById("bx-pick"); if (pk) pk.hidden = !document.getElementById("briefSelectSec");
  var ps = document.getElementById("bx-pos"); if (ps) ps.hidden = !bxOwner();   // 과거 하락 · 비슷한 구간 계산은 운영자 화면에서만 한다
  try { bxToc(); } catch (e) { console.warn("bx toc", e); }
  bxPosWatch();
}

/* ---------- 채널: 글쓰기 + 글감 ---------- */
function bxChMat() {
  var host = document.querySelector("#tab-channel .chColR"); if (!host) return;
  var el = document.getElementById("bxMat");
  if (!el) { el = document.createElement("section"); el.id = "bxMat"; el.className = "bxSec bxMat"; var q = host.querySelector(".chQuality"); host.insertBefore(el, q ? q.nextSibling : host.firstChild); }
  var R = typeof chState !== "undefined" ? chState.brief : null, iss = (typeof chState !== "undefined" && chState.issues) || [], rows = [];
  if (R) { var t = R.uniTemp || R.temp || {}, i0 = (R.indexRow || [])[0], i1 = (R.indexRow || [])[1]; var line = (i0 ? i0.name + " " + bxPct(i0.ret) : "") + (i1 ? " · " + i1.name + " " + bxPct(i1.ret) : "") + (isFinite(t.upPct) && !R.marketWideOff ? " · 오른 종목 " + Math.round(t.upPct * 100) + "%(" + t.up + "/" + t.total + ")" : ""); if (line) rows.push(["결론", line, line]); }
  iss.forEach(function (it, i) { rows.push(["이슈 " + (i + 1), it.title, it.title + (it.sub ? "\n" + it.sub : ""), it.sub]); });
  try { if (typeof cxlEvents === "function") { var td = cxlToday(), ev = cxlEvents().filter(function (e) { return e.d >= td && e.d <= cxlAdd(td, 7) && e.kind !== "hol"; }).slice(0, 3); ev.forEach(function (e) { var s = e.d.slice(5).replace("-", "/") + "(" + "일월화수목금토".charAt(new Date(e.d + "T00:00:00Z").getUTCDay()) + ") " + bxClean(e.t); rows.push(["일정", s, s]); }); } } catch (e) {}
  var long = [["핵심 이슈 5", function () { return iss.length && typeof issuesText === "function" ? issuesText(iss) : ""; }], ["고점 대비(MDD) 글", function () { return typeof chMddText === "function" ? chMddText() : ""; }], ["자산배분 글", function () { return typeof chAllocText === "function" ? chAllocText() : ""; }], ["과거 사례 글", function () { return typeof chScenText === "function" ? chScenText(true) : ""; }]];
  el.innerHTML = '<header><h3>오늘 글감<small>줄을 누르면 복사돼요</small></h3><span class="bxHd"><button type="button" class="chip" data-shgo="brief">브리핑에서 자세히</button></span></header>' +
    (rows.length ? '<div class="bxMt">' + rows.map(function (r, i) { return '<button type="button" data-bxc="' + i + '"><span class="k">' + r[0] + '</span><span class="t"><b>' + bxE(r[1]) + '</b>' + (r[3] ? '<small>' + bxE(r[3]) + '</small>' : "") + '</span><span class="cp">복사</span></button>'; }).join("") + '</div>' : '<div class="bxEmpty">오늘 자료를 아직 읽지 못했어요. 데이터 화면에서 수집 상태를 확인해 주세요.</div>') +
    '<div class="bxMl2"><span>긴 글로 복사</span>' + long.map(function (l, i) { return '<button type="button" class="chip" data-bxl="' + i + '">' + l[0] + '</button>'; }).join("") + '</div>' +
    '<p class="bxNote">이슈는 주식 시장 기준이고 고점 대비 · 시장 신호까지 넣은 목록이에요(업로드 글과 같은 기준). 고점 대비 · 자산배분 · 과거 사례 표는 브리핑의 \'지금 위치\'에 있어요.</p>';
  Array.prototype.forEach.call(el.querySelectorAll("[data-bxc]"), function (b) { b.onclick = function () { var r = rows[+b.getAttribute("data-bxc")]; if (r) chCopy(r[2], b.querySelector(".cp")); }; });
  Array.prototype.forEach.call(el.querySelectorAll("[data-bxl]"), function (b) { b.onclick = function () { var t = ""; try { t = long[+b.getAttribute("data-bxl")][1]() || ""; } catch (e) {} if (!t) { if (typeof smToast === "function") smToast("아직 계산이 끝나지 않았어요. 잠시 뒤 다시 눌러 주세요.", "bad"); return; } chCopy(t, b); }; });
}
function bxChannel() {
  var tab = document.getElementById("tab-channel"); if (!tab) return;
  if (!BX.chBuilt) {
    BX.chBuilt = true; tab.classList.add("bxCh");
    var h2 = tab.querySelector(".pgHead h2"); if (h2) { h2.setAttribute("data-adm", "1"); h2.innerHTML = '채널<small>오늘 올릴 글을 쓰는 곳 — 왼쪽에서 쓰고, 오른쪽 글감을 눌러 복사해요</small>'; }
    /* 브리핑을 아직 열지 않았다면 근거 자료 칸은 잠시 보관해 둔다(브리핑을 열 때 '지금 위치'로 옮겨진다) */
    if (!document.getElementById("bxPos")) { var hold = document.createElement("div"); hold.id = "bxPosHold"; hold.hidden = true; tab.appendChild(hold); ["MDD 분석", "자산배분", "상황별 과거 사례"].forEach(function (t) { var sec = bxSnap(t, tab); if (!sec) return; var nx = sec.nextElementSibling; hold.appendChild(sec); if (nx && nx.classList && nx.classList.contains("snapRow")) hold.appendChild(nx); }); }
    var lab = tab.querySelector(".chColR > .colLabel"); if (lab) lab.remove();
    var ps = tab.querySelector("#pubSec > h3"); if (ps) ps.innerHTML = '글쓰기 <small>인스타 · 스레드 캡션과 답글 · 주제 은행 · 일정 목록 · 정책 데이터</small>';
    var dh = bxSnap("미국 증시 데일리 브리핑", tab); if (dh) { var h3 = dh.querySelector(":scope > h3"); if (h3 && h3.firstChild && h3.firstChild.nodeType === 3) h3.firstChild.nodeValue = "미국 증시 데일리 글 "; }
    var how = tab.querySelector("details.howto .body"); if (how) how.innerHTML = '<ul><li><b>글쓰기</b>에서 말투를 고르면 오늘 숫자로 캡션 · 스레드 본문 · 답글이 채워져요. 고쳐 쓴 뒤 복사하세요.</li><li><b>오늘 글감</b>은 주식 시장 기준 이슈에 고점 대비와 시장 신호를 더한 목록이에요. 줄을 누르면 그 줄이 복사돼요.</li><li><b>미국 증시 데일리 글</b>은 서버가 종가와 기사 제목으로 쓴 글이에요. 매일 아침 수집 뒤 새로 만들어져요.</li><li>고점 대비 · 자산배분 · 과거 사례 표는 브리핑의 \'지금 위치\'에서 보고, 글은 \'긴 글로 복사\'로 가져가요.</li><li>자동 글에는 전망 · 추천이 없어요. 숫자와 기사 제목까지만 쓰고, 판단은 운영자가 덧붙이는 구조예요.</li></ul>';
  }
  try { bxChMat(); } catch (e) { console.warn("bx ch", e); }
}

/* ---------- 얹기 ---------- */
(function () {
  if (typeof renderBrief !== "function") return;
  try { clBrief = function () {}; } catch (e) {}   // 예전 '주제별 탭' 묶기는 쓰지 않는다(새 뼈대가 대신한다)
  var rb0 = renderBrief; renderBrief = function () { var r = rb0.apply(this, arguments); try { bxRender(); } catch (e) { console.warn("bx", e); } return r; };
  if (typeof issWhyPaint === "function") { var wp0 = issWhyPaint; issWhyPaint = function () { var r = wp0.apply(this, arguments); try { if (document.getElementById("bxRoot")) bxIss(); } catch (e) {} return r; }; }
  if (typeof brAiPaint === "function") { var ap0 = brAiPaint; brAiPaint = function () { var r = ap0.apply(this, arguments); try { if (document.getElementById("bxRoot")) bxIss(); } catch (e) {} return r; }; }
  ["issuesForChannel", "chUpdateCount", "slChannel"].forEach(function (fn) { try { var f0 = window[fn]; if (typeof f0 !== "function") return; window[fn] = function () { var r = f0.apply(this, arguments); try { bxChannel(); } catch (e) {} return r; }; } catch (e) {} });
  if (typeof renderChannel === "function") { var rc0 = renderChannel; renderChannel = function () { var r = rc0.apply(this, arguments); try { bxChannel(); } catch (e) {} return r; }; }
  try { if (typeof SM_GUIDE !== "undefined") {
    SM_GUIDE.brief = { t: "브리핑", s: ["위에서 아래로 읽으면 돼요: 결론 → 자산판 → 핵심 이슈 → 시장의 속 → 업종 · 특징주 → 수급 → 지금 위치.", "'평소 대비 몇 배'가 1.5배를 넘는 줄이 오늘 평소와 달랐던 곳이에요.", "이슈의 원인은 '이유 후보(기사)'와 Claude 해설에서 확인해요. 카드는 카드 화면에서 만들어요."] };
    SM_GUIDE.channel = { t: "채널", s: ["왼쪽 글쓰기에서 말투를 고르고 고쳐 쓴 뒤 복사해요.", "오른쪽 '오늘 글감'의 줄을 누르면 그 줄이 복사돼요.", "표와 근거 자료는 브리핑의 '지금 위치'에 있어요."] };
  } } catch (e) {}
  try { if (typeof ADM !== "undefined" && ADM.head) { ADM.head.brief = ["오늘의 브리핑", "아침에 시장을 확인하는 순서대로"]; ADM.head.channel = ["채널", "오늘 올릴 글을 쓰는 곳 — 왼쪽에서 쓰고, 오른쪽 글감을 눌러 복사해요"]; } } catch (e) {}
  try { if (typeof SH !== "undefined" && SH.pages) { SH.pages.brief.d = "오늘 시장을 읽는 순서대로"; SH.pages.channel.d = "오늘 올릴 글과 글감"; SH.sig = ""; if (typeof shPaint === "function") shPaint(); } } catch (e) {}

  var css = [
    /* 브리핑: 큰 카드 하나를 풀어 칸마다 카드로 */
    "html.sh #briefCard{background:none;border:0;box-shadow:none;padding:0;border-radius:0}",
    "html.sh #briefCard>.howto{margin:10px 0 0}html.sh #briefCard>.toolbar{border-bottom:0;padding:0;margin-bottom:0;background:none;box-shadow:none}",
    "#tab-brief:has(#smFlow .smFlowMk button) #briefMktTabs{display:none}","#bxRoot{margin-top:14px}#bxOld,#bxPosHold{display:none!important}",
    "#bxRoot .vxToc{background:var(--bg);margin:0 0 12px;padding:8px 0;border-bottom:1px solid var(--line)}#bxRoot .vxToc button i{font-style:normal;font-weight:800;color:var(--muted);margin-right:6px;font-size:12px}#bxRoot .vxToc button.on i{color:inherit;opacity:.7}",
    ".bxSec{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:18px 20px 16px;margin:0 0 14px;min-width:0;scroll-margin-top:calc(var(--shStick) + 58px)}",
    ".bxSec>header{display:flex;align-items:center;gap:10px;margin:0 0 12px;min-width:0;flex-wrap:wrap}.bxSec>header h3{margin:0;font-size:17px;font-weight:780;letter-spacing:-.02em;color:var(--txt);display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;min-width:0}.bxSec>header h3 small{font-size:13px;font-weight:500;color:var(--sub);letter-spacing:-.01em}",
    ".bxNo{flex:none;width:22px;height:22px;border-radius:7px;background:var(--ink);color:#fff;font-style:normal;font-size:12.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}",
    ".bxHd{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}",
    ".bxU{color:var(--up)}.bxD{color:var(--down)}.bxDim{color:var(--muted)}",
    ".bxLead{margin:0 0 12px;font-size:14px;line-height:1.6;color:var(--txt2)}.bxLead b{color:var(--txt)}.bxLead em{font-style:normal;font-weight:700}",
    ".bxNote{margin:10px 0 0;font-size:12.5px;line-height:1.55;color:var(--muted)}",
    ".bxEmpty{font-size:13.5px;line-height:1.6;color:var(--sub);background:var(--soft);border-radius:10px;padding:12px 14px}",
    ".bxWarn{font-size:13.5px;line-height:1.6;color:var(--warn);background:#fdf5ea;border:1px solid #f1dcc0;border-radius:10px;padding:10px 14px;margin:0 0 12px}.bxWarn b{font-weight:750}",
    ".bxLink{display:inline-block;border:0;background:none;padding:8px 0 0;font:inherit;font-size:13px;font-weight:650;color:var(--goldInk);cursor:pointer;text-decoration:underline;text-underline-offset:3px}",
    /* 1 결론 */
    ".bxHead{margin:0 0 14px;font-size:24px;font-weight:800;letter-spacing:-.03em;line-height:1.35;color:var(--txt)}.bxHead em{font-style:normal;color:var(--goldInk)}.bxHead em.bxU{color:var(--up)}.bxHead em.bxD{color:var(--down)}",
    ".bxJ{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 14px}.bxJt{background:var(--soft);border-radius:12px;padding:12px 14px;min-width:0;display:grid;grid-template-columns:auto 1fr;align-items:baseline;column-gap:8px;row-gap:2px}",
    ".bxJt span{grid-column:1/-1;font-size:12.5px;font-weight:650;color:var(--sub)}.bxJt b{font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--txt);font-variant-numeric:tabular-nums;line-height:1.2}.bxJt b.bxU{color:var(--up)}.bxJt b.bxD{color:var(--down)}.bxJt em{font-style:normal;font-size:13.5px;font-weight:700;color:var(--txt2);justify-self:end;text-align:right}.bxJt small{grid-column:1/-1;font-size:12px;color:var(--muted);line-height:1.45}",
    ".bxJt.txt b{font-size:16.5px;line-height:1.35;grid-column:1/-1}.bxJt.txt em{grid-column:1/-1;justify-self:start;font-size:12.5px;color:var(--sub);font-weight:600}",
    ".bxLines{margin:0;padding:0;list-style:none;counter-reset:bxl;display:grid;gap:8px}.bxLines li{counter-increment:bxl;position:relative;padding-left:26px;font-size:14.5px;line-height:1.65;color:var(--txt2)}.bxLines li::before{content:counter(bxl);position:absolute;left:0;top:3px;width:18px;height:18px;border-radius:50%;background:var(--goldSoft);color:var(--goldInk);font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center}",
    "#bxAi:empty{display:none}#bxAi{margin-top:14px;border-top:1px solid var(--line2);padding-top:14px}html.sh #bxAi .briefSec{border:0;margin:0;padding:0;background:none;box-shadow:none}",
    /* 2 자산판 */
    ".bxBd{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,450px),1fr));gap:0 28px}.bxBd.one{grid-template-columns:minmax(0,1fr)}.bxBc{min-width:0}",
    ".bxR{display:grid;grid-template-columns:minmax(84px,1.5fr) minmax(60px,1fr) 66px minmax(88px,1.15fr) 56px 60px;align-items:center;gap:6px;width:100%;border:0;border-bottom:1px solid var(--line2);background:none;padding:9px 6px;font:inherit;font-size:14px;color:var(--txt);text-align:right;cursor:pointer;border-radius:0;font-variant-numeric:tabular-nums}",
    "button.bxR:hover{background:var(--soft)}.bxR .n{text-align:left;font-weight:650;min-width:0;display:flex;flex-direction:column;gap:1px}.bxR .n small{font-size:11.5px;font-weight:500;color:var(--muted);white-space:normal;line-height:1.35}.bxR .p{color:var(--txt2)}.bxR .c{font-weight:750}.bxR .m{font-size:13px}.bxR .h{font-size:13px;color:var(--sub)}.bxR .z{display:flex;justify-content:flex-end}",
    ".bxR.mid{background:#fcf8ee}.bxR.hi{background:var(--goldSoft)}.bxRh{cursor:default;font-size:12px;font-weight:650;color:var(--sub);padding:6px;border-bottom:1px solid var(--line)}.bxRh .n{font-weight:650}.bxRh .p,.bxRh .c,.bxRh .h{color:var(--sub);font-weight:650;font-size:12px}",
    ".bxBg{font-size:12px;font-weight:750;color:var(--goldInk);padding:12px 6px 4px;letter-spacing:-.01em}",
    ".bxG{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--sub);white-space:nowrap}.bxG i{display:block;width:44px;height:6px;border-radius:3px;background:var(--line2);overflow:hidden}.bxG u{display:block;height:100%;background:var(--muted);border-radius:3px;text-decoration:none}.bxG b{font-weight:650;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}",
    ".bxG.mid u{background:var(--gold)}.bxG.mid b{color:var(--goldInk);font-weight:750}.bxG.hi u{background:var(--ink)}.bxG.hi b{color:var(--txt);font-weight:800}.bxG.none{color:var(--muted)}",
    /* 3 핵심 이슈 + 옆 */
    ".bxTwo{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}.bxSide{min-width:0;display:grid;gap:0}.bxMini>header h3{font-size:15.5px}",
    ".bxIL{list-style:none;margin:0;padding:0;display:grid;gap:12px}.bxI{border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-width:0}",
    ".bxIh{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}.bxIz{margin-left:auto}",
    ".bxTag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:750;color:#fff;background:var(--ink);border-radius:6px;padding:3px 8px;white-space:nowrap}.bxTag i{font-style:normal;font-weight:600;opacity:.72}.bxTag.s2{background:#5b4a1c}.bxTag.s3{background:#3d4452}.bxTag.s4,.bxTag.s5,.bxTag.s9{background:#667080}",
    ".bxMineTag{font-size:12px;font-weight:700;color:var(--goldInk);background:var(--goldSoft);border-radius:6px;padding:3px 8px}",
    ".bxI h4{margin:0;font-size:17px;font-weight:780;letter-spacing:-.02em;line-height:1.45;color:var(--txt);display:flex;gap:9px;align-items:baseline}.bxIn{flex:none;font-style:normal;font-size:15px;font-weight:800;color:var(--goldInk);font-variant-numeric:tabular-nums}",
    ".bxIs{margin:4px 0 0 19px;font-size:13.5px;line-height:1.55;color:var(--sub)}",
    ".bxEv{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0 0 19px}.bxEv span{font-size:12px;font-weight:650;color:var(--muted);margin-right:2px}.bxEv em{font-style:normal;font-size:12.5px;color:var(--txt2);background:var(--soft);border-radius:6px;padding:3px 8px;white-space:nowrap}.bxEv em b{font-weight:750;font-variant-numeric:tabular-nums;color:var(--txt)}.bxEv em b.bxU{color:var(--up)}.bxEv em b.bxD{color:var(--down)}",
    ".bxDl{display:grid;grid-template-columns:86px minmax(0,1fr);gap:7px 10px;margin:12px 0 0 19px;padding-top:12px;border-top:1px dashed var(--line)}.bxDl dt{font-size:12.5px;font-weight:700;color:var(--sub);line-height:1.6;white-space:nowrap}.bxDl dt.ai{color:var(--goldInk)}.bxDl dd{margin:0;font-size:13.5px;line-height:1.6;color:var(--txt2);min-width:0}",
    ".bxDl dd.bxSoft{color:var(--sub);font-size:13px}.bxDl dd.bxSrc{font-size:12px;color:var(--muted)}.bxDl dd.bxSrc a{color:var(--goldInk)}",
    ".bxNews{display:grid;gap:4px}.bxNews a{color:var(--txt2);text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:3px}.bxNews a:hover{color:var(--txt);text-decoration-color:var(--txt)}.bxNews a small{font-size:11.5px;color:var(--muted);text-decoration:none;display:inline-block}",
    ".bxIa{margin:12px 0 0 19px}",
    ".bxCl{list-style:none;margin:0;padding:0;display:grid}.bxCl li{display:grid;grid-template-columns:74px minmax(0,1fr);gap:8px;padding:10px 0;border-top:1px solid var(--line2)}.bxCl li:first-child{border-top:0;padding-top:2px}.bxCl time{font-size:12.5px;color:var(--sub);font-variant-numeric:tabular-nums;line-height:1.5;display:flex;flex-direction:column}.bxCl time b{color:var(--goldInk);font-weight:800}",
    ".bxCl li div b{font-size:14px;font-weight:700;color:var(--txt);line-height:1.5}.bxCl li div p{margin:3px 0 0;font-size:12.5px;line-height:1.55;color:var(--sub)}.bxCl small.est{font-size:11px;font-weight:650;color:var(--warn)}.bxK{display:inline-block;font-size:11px;font-weight:750;color:var(--c);border:1px solid var(--c);border-radius:5px;padding:0 5px;margin-right:6px;line-height:1.5;vertical-align:1px}",
    ".bxMl{display:grid}.bxMl button{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;border:0;border-top:1px solid var(--line2);background:none;padding:9px 0;font:inherit;font-size:14px;color:var(--txt);cursor:pointer;text-align:left;border-radius:0}.bxMl button:first-child{border-top:0}.bxMl button:hover span{text-decoration:underline}.bxMl span{font-weight:650;min-width:0}.bxMl b{font-weight:750;font-variant-numeric:tabular-nums}.bxMl .bxG i{width:28px}",
    /* 옮겨 온 예전 칸: 칸 안의 작은 묶음으로 */
    ".bxGrid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 28px;align-items:start}.bxGrid2.a57{grid-template-columns:minmax(0,5fr) minmax(0,7fr)}.bxGrid2.a75{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}.bxCell{min-width:0}",
    "html.sh #bxRoot .bxSec .briefSec{border:0;margin:0;padding:0;background:none;box-shadow:none;border-radius:0;min-width:0}html.sh #bxRoot .bxSec .briefSec>h3,html.sh #bxRoot .bxSec .briefSec h3{font-size:15px;font-weight:750;margin:0 0 10px}",
    "#bxTemp .briefIdxRow,#bxTemp #briefKpi,#bxTemp #briefCal{display:none!important}#bxTemp .briefTemp{display:block;margin:0 0 14px}#bxTemp .briefTempDesc{font-size:14px;line-height:1.6}#bxTemp:has(.briefTempDesc:empty){display:none}",
    "#bxPick #briefSelectSec>h3{display:none}","#bxBreadth .fdBars{margin-bottom:22px}",
    /* 7 지금 위치 */
    ".bxSig{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}.bxSig span{font-size:12.5px;font-weight:700;color:var(--sub)}.bxSig em{font-style:normal;font-size:13px;color:var(--sub);background:var(--soft);border-radius:8px;padding:6px 10px}.bxSig em b{color:var(--txt);font-weight:750}",
    "#bxPos{display:grid;gap:18px}html.sh #bxPos>.briefSec{border-top:1px solid var(--line2)!important;padding-top:16px!important}html.sh #bxPos>.briefSec:first-child{border-top:0!important;padding-top:0!important}#bxPos #chMdd:empty::before,#bxPos #chAlloc:empty::before,#bxPos #chScen:empty::before{content:\"불러오는 중이에요…\";font-size:13px;color:var(--muted)}",
    /* 채널 */
    "html.sh #tab-channel.bxCh #chHero,html.sh #tab-channel.bxCh #chTop5{display:none!important}",
    ".bxMat{margin-top:12px}.bxMt{display:grid}.bxMt button{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:start;border:0;border-top:1px solid var(--line2);background:none;padding:10px 4px;font:inherit;text-align:left;cursor:pointer;border-radius:0;color:var(--txt)}.bxMt button:first-child{border-top:0}.bxMt button:hover{background:var(--soft)}",
    ".bxMt .k{font-size:12px;font-weight:750;color:var(--goldInk);line-height:1.7;white-space:nowrap}.bxMt button,.bxMl button,.bxR{white-space:normal}.bxMt .t{min-width:0;display:grid;gap:2px;overflow-wrap:anywhere}.bxMt .t b{font-size:14px;font-weight:650;line-height:1.5}.bxMt .t small{font-size:12.5px;color:var(--sub);line-height:1.5}.bxMt .cp{font-size:12px;font-weight:650;color:var(--sub);border:1px solid var(--line);border-radius:999px;padding:2px 9px;white-space:nowrap;line-height:1.6}",
    ".bxMl2{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--line2)}.bxMl2 span{font-size:12.5px;font-weight:700;color:var(--sub);margin-right:2px}",
    "@media(max-width:1180px){.bxTwo{grid-template-columns:minmax(0,1fr)}.bxSide{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}}",
    "@media(max-width:1199px){html.shWide .bxGrid2,html.shWide .bxGrid2.a57,html.shWide .bxGrid2.a75{grid-template-columns:minmax(0,1fr);gap:18px}}",
    "@media(max-width:860px){.bxGrid2,.bxGrid2.a57,.bxGrid2.a75,.bxSide{grid-template-columns:minmax(0,1fr)}.bxSide{gap:0}.bxGrid2{gap:18px}.bxSec{padding:16px 14px 14px}.bxHead{font-size:20px}.bxJ{grid-template-columns:repeat(2,minmax(0,1fr))}.bxJt b{font-size:19px}.bxJt.txt{grid-column:1/-1}}",
    "@media(max-width:560px){.bxR{grid-template-columns:minmax(84px,1.3fr) minmax(58px,1fr) 62px minmax(84px,1fr);font-size:13.5px}.bxR .m,.bxR .h,.bxR .n small{display:none}.bxSec>header{align-items:flex-start}.bxNo{margin-top:1px}.bxG i{width:30px}.bxDl{grid-template-columns:minmax(0,1fr);gap:2px;margin-left:0}.bxDl dd{margin-bottom:8px}.bxIs,.bxEv,.bxIa{margin-left:0}.bxI{padding:12px 12px}.bxI h4{font-size:16px}.bxSec>header h3 small{flex-basis:100%}.bxMt button{grid-template-columns:44px minmax(0,1fr) auto}}"
  ].join("");
  var st = document.createElement("style"); st.id = "bxCss"; st.textContent = css; document.head.appendChild(st);
})();
