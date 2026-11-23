/* ============================================================ v16.00 화면 뼈대 — 메뉴 · 상단 바 · 종목 검색 · 전체 메뉴
   목표: 어느 화면에서든 같은 자리에서 같은 방법으로 움직인다.
   - PC(1024px 이상): 왼쪽 메뉴 + 위쪽 바(종목 검색 · 내 데이터 · 공유)
       v16.30 왼쪽 메뉴는 펼친 모양이 기본(1280px 이상): 갈래 이름 + 한 줄 설명 아래에 모든 화면이 아이콘과 함께 보인다. 위쪽 바에는 '갈래 › 화면 · 설명'.
       접으면 아이콘만 남고(갈래에 올리면 화면 목록), 위쪽 바에 그 갈래의 화면 탭이 나온다. 고른 모양은 기기에 기억한다(sm.sh.rail).
   - 휴대폰: 위쪽 바(검색 · 전체 메뉴) + 화면 탭 줄 + 아래쪽 갈래 메뉴
   - 갈래는 일하는 순서: 시장 → 종목 → 큰손 → 내 투자 → 만들기 → 배우기
   - 관심 탭 안에 숨어 있던 화면(시장 지도 · 매크로 · 공모주 · 뉴스 · 구루 · 공시 · 배당)을 각자 제자리로 꺼냈다.
   기존 화면 코드(switchTab · switchWatchPane · navTo)는 그대로 쓰고 그 위에 얹는다. 이 파일과 skin.js · homex.js를 빼면 예전 화면으로 돌아간다.
   ============================================================ */
var SH = {
  secs: [
    { id: "market", t: "시장", d: "지금 오르나 내리나", pages: ["home", "map", "macro", "ipo", "news"] },
    { id: "stock", t: "종목", d: "무엇을 살까", pages: ["single", "rank", "compare", "follow", "core"] },
    { id: "big", t: "큰손", d: "누가 사고 파나", pages: ["guru", "disc"] },
    { id: "mine", t: "내 투자", d: "내 돈은 어디에", pages: ["watch", "sim", "div"] },
    { id: "make", t: "만들기", d: "운영자 전용", pages: ["ops", "data", "brief", "onecard", "report", "analyst", "channel"] },
    { id: "learn", t: "배우기", d: "처음이라면", pages: ["guide", "mind"] }
  ],
  pages: {
    home: { t: "홈", d: "지금 시장이 고점에서 얼마나 내려와 있는지", tab: "home" },
    map: { t: "시장 지도", d: "전 종목이 각자 고점에서 얼마나 내려왔는지", tab: "watch", wp: "map" },
    macro: { t: "매크로", d: "환율, 금리, 유동성과 과거 같은 조건", tab: "watch", wp: "macro", own: 1 },
    ipo: { t: "공모주", d: "청약 일정과 상장 뒤 성적", tab: "watch", wp: "ipo", own: 1 },
    news: { t: "뉴스", d: "관심 종목 기사와 시장 기사", tab: "watch", wp: "news" },
    single: { t: "종목 분석", d: "차트, 하락과 회복, 기술 지표, 기업 정보", tab: "single" },
    rank: { t: "순위", d: "점수로 줄 세우고 맞았는지 검증", tab: "rank", own: 1 },
    compare: { t: "비교", d: "여러 종목을 같은 기준으로 나란히", tab: "compare" },
    follow: { t: "실적", d: "분기 실적을 따라가며 확인", tab: "follow", own: 1 },
    core: { t: "본질·변수", d: "길게 볼 것과 그때그때 대응할 것", tab: "core", own: 1 },
    guru: { t: "구루", d: "거장들의 보유 종목과 발언", tab: "watch", wp: "guru", own: 1 },
    disc: { t: "공시", d: "임원과 대주주의 지분 변동", tab: "watch", wp: "disc", own: 1 },
    watch: { t: "관심 종목", d: "내 종목이 지금 어디에 있는지", tab: "watch", wp: "list" },
    sim: { t: "내 자산", d: "보유 현황, 과거 시뮬레이션, 리밸런싱", tab: "sim" },
    div: { t: "배당", d: "받을 배당과 세금 계산", tab: "watch", wp: "div", own: 1 },
    ops: { t: "작업실", d: "오늘 할 일을 순서대로", tab: "ops", own: 1 },
    data: { t: "데이터", d: "시세가 최신인지 확인", tab: "data", own: 1 },
    brief: { t: "브리핑", d: "오늘 시장을 숫자로 정리", tab: "brief", own: 1 },
    onecard: { t: "카드", d: "주제를 골라 카드 만들기", tab: "onecard", own: 1 },
    report: { t: "리포트", d: "질문 하나를 끝까지 풀기", tab: "report", own: 1 },
    analyst: { t: "분석", d: "여섯 가지 틀로 종목 분석", tab: "analyst", own: 1 },
    channel: { t: "채널", d: "오늘 쓸 글과 근거 자료", tab: "channel", own: 1 },
    guide: { t: "투자법", d: "나에게 맞는 방법 찾기", tab: "guide" },
    mind: { t: "투자 유형", d: "열여섯 가지 중 나는 어디", tab: "mind" }
  },
  last: {}, find: { open: false, q: "", items: [], at: -1, tm: null, seq: 0 }
};
try { SH.last = JSON.parse(localStorage.getItem("sm.sh.last") || "{}") || {}; } catch (e) { SH.last = {}; }

/* ---------- 아이콘: 선 굵기 · 모서리가 같은 한 벌 ---------- */
var SH_IC = {
  market: '<path d="M3 12.5h3.6l2.2-6 4.2 11.5 2.5-7 1.2 1.5H21"/>',
  stock: '<path d="M7.5 3.5v3M7.5 15.5v5M16.5 3.5v5M16.5 16.5v4"/><rect x="5" y="6.5" width="5" height="9" rx="1.2"/><rect x="14" y="8.5" width="5" height="8" rx="1.2"/>',
  big: '<path d="M3.5 9.5L12 4l8.5 5.5"/><path d="M5.5 10v8M10 10v8M14 10v8M18.5 10v8"/><path d="M3.5 20.5h17"/>',
  mine: '<path d="M4.5 8.5a2.5 2.5 0 0 1 2.5-2.5h10v3.5"/><rect x="4.5" y="8" width="15.5" height="11" rx="2.2"/><path d="M15.8 13.5h.4"/>',
  make: '<path d="M4.5 19.5l1-4.2L16 4.8a1.9 1.9 0 0 1 2.7 0l.5.5a1.9 1.9 0 0 1 0 2.7L8.7 18.5z"/><path d="M14 6.8l3.2 3.2"/>',
  learn: '<path d="M12 6.5C9.8 5 7 4.6 4 5v13c3-.4 5.8 0 8 1.5 2.2-1.5 5-1.9 8-1.5V5c-3-.4-5.8 0-8 1.5z"/><path d="M12 6.5v13"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  menu: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  cloud: '<path d="M7.5 18.5a4.5 4.5 0 0 1-.6-8.96A5.5 5.5 0 0 1 17.6 10 4.3 4.3 0 0 1 17 18.5z"/>',
  share: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  star: '<path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9"/><path d="M12 16.6h.01"/>',
  fold: '<path d="M13 7l-5 5 5 5"/><path d="M18.5 7l-5 5 5 5"/>',
  unfold: '<path d="M11 7l5 5-5 5"/><path d="M5.5 7l5 5-5 5"/>',
  /* v16.30 화면마다 하나씩 — 왼쪽 메뉴에서 글자를 읽기 전에 모양으로 먼저 찾는다 */
  p_home: '<path d="M4 11.2L12 4.8l8 6.4"/><path d="M6.3 9.8v9.7h11.4V9.8"/><path d="M10 19.5v-5h4v5"/>',
  p_map: '<rect x="4" y="4" width="16" height="16" rx="2.2"/><path d="M12.5 4v16M4 13.5h8.5M12.5 9.5H20"/>',
  p_macro: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.7 2.3 2.7 14.7 0 17M12 3.5c-2.7 2.3-2.7 14.7 0 17"/>',
  p_ipo: '<path d="M6 20.5V4"/><path d="M6 5h11.5l-2.3 3.5 2.3 3.5H6"/>',
  p_news: '<rect x="4" y="5" width="16" height="14.5" rx="2.2"/><path d="M7.8 9.5h8.4M7.8 13h8.4M7.8 16h5"/>',
  p_single: '<path d="M4 19.5h16"/><path d="M5 15.2l4.2-4.7 3.3 2.9 6.5-7.4"/>',
  p_rank: '<path d="M6 19.5v-6.5M12 19.5V5M18 19.5v-10"/>',
  p_compare: '<path d="M8 5v14M16 5v14"/><path d="M4.8 8.2L8 5l3.2 3.2M12.8 15.8L16 19l3.2-3.2"/>',
  p_follow: '<rect x="5" y="5" width="14" height="15.5" rx="2.2"/><path d="M9.2 5V3.7h5.6V5"/><path d="M8.8 13l2.2 2.2 4.2-4.4"/>',
  p_core: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.3"/><path d="M12 12h.01"/>',
  p_guru: '<circle cx="12" cy="8.3" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  p_disc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5"/>',
  p_watch: '<path d="M12 4.2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/>',
  p_sim: '<path d="M11.5 4.5a8 8 0 1 0 8 8h-8z"/><path d="M15 3.8a8 8 0 0 1 5.2 5.2H15z"/>',
  p_div: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.6c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.7.8-2.7 1.9 0 2.8 5.5 1.2 5.5 3.9 0 1.2-1.2 2-2.8 2-1.2 0-2.3-.5-2.8-1.5"/><path d="M12 6.5v1.7M12 16v1.5"/>',
  p_ops: '<path d="M4.5 7l1.7 1.7 3-3.2M4.5 13.5l1.7 1.7 3-3.2"/><path d="M12.5 7.5h7M12.5 14h7M5 19.5h14.5"/>',
  p_data: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  p_brief: '<path d="M3.5 17.5h17"/><path d="M6.5 17.5a5.5 5.5 0 0 1 11 0"/><path d="M12 6v2.3M5.2 9.3l1.6 1.6M18.8 9.3l-1.6 1.6"/>',
  p_onecard: '<rect x="7.5" y="7.5" width="12.5" height="12.5" rx="2.2"/><path d="M4.5 15.5V6.2A1.7 1.7 0 0 1 6.2 4.5h9.3"/>',
  p_report: '<rect x="5" y="3.5" width="14" height="17" rx="2.2"/><path d="M9 16.5v-3M12 16.5V9.5M15 16.5V12"/>',
  p_analyst: '<path d="M12 3.5l7.4 4.250v8.5L12 20.5l-7.4-4.250v-8.5z"/><path d="M12 12l7.2-4.1M12 12v8.3M12 12L4.8 7.9"/>',
  p_channel: '<path d="M20.5 3.8L3.5 10.6l6.4 2.5 2.5 6.4z"/><path d="M9.9 13.1L20.5 3.8"/>',
  p_guide: '<circle cx="12" cy="12" r="8.5"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  p_mind: '<circle cx="12" cy="12" r="8.5"/><path d="M8.8 14.2c.8 1.1 1.9 1.7 3.2 1.7s2.4-.6 3.2-1.7"/><path d="M9.3 10h.01M14.7 10h.01"/>'
};
function shIc(k, sz) { return '<svg class="shIc" viewBox="0 0 24 24" width="' + (sz || 22) + '" height="' + (sz || 22) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SH_IC[k] || "") + '</svg>'; }
function shEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

/* ---------- 지금 어디인가 ---------- */
function shOwner() { return typeof isOwner === "function" && isOwner(); }
function shOk(id) {
  var P = SH.pages[id]; if (!P) return false;
  if (P.own && !shOwner()) return false;
  if (typeof TABS !== "undefined" && TABS.indexOf(P.tab) < 0) return false;
  if (P.wp && !document.getElementById("wp-" + P.wp)) return false;
  return true;
}
function shCur() {
  var t = typeof currentTab !== "undefined" ? currentTab : "home";
  if (t === "watch") { var w = typeof watchPane !== "undefined" ? watchPane : "list"; return w === "list" ? "watch" : (SH.pages[w] ? w : "watch"); }
  return SH.pages[t] ? t : "home";
}
function shSecOf(id) { for (var i = 0; i < SH.secs.length; i++) if (SH.secs[i].pages.indexOf(id) >= 0) return SH.secs[i]; return SH.secs[0]; }
function shPagesOf(S) { return S.pages.filter(shOk); }
function shSecs() { return SH.secs.filter(function (S) { return shPagesOf(S).length > 0; }); }

/* ---------- 이동 ---------- */
function shGo(id) {
  var P = SH.pages[id]; if (!P || !shOk(id)) return;
  shCloseAll();
  if (id === shCur()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  if (!P.wp) { if (typeof navTo === "function") navTo(P.tab); else switchTab(P.tab); return; }
  if (typeof currentTab !== "undefined" && currentTab === "watch") { switchWatchPane(P.wp); window.scrollTo(0, 0); return; }
  /* 다른 탭에서 관심 탭 안쪽 화면으로 바로 갈 때: 예전 안쪽 화면이 잠깐 보이지 않게 먼저 맞춰 놓고 들어간다 */
  try { history.replaceState(viewState(), ""); history.pushState({ tab: "watch", sub: null, y: 0, wp: P.wp }, ""); } catch (e) {}
  shSetPane(P.wp);
  switchTab("watch");
  if (typeof toggleBackPill === "function") toggleBackPill(false);
}
function shSetPane(p) {
  try { watchPane = p; } catch (e) {}
  ["list", "map", "news", "div", "disc", "guru", "ipo", "macro"].forEach(function (k) { var el = document.getElementById("wp-" + k); if (el) el.classList.toggle("hidden", k !== p); });
  Array.prototype.forEach.call(document.querySelectorAll("#watchTabs [data-wp]"), function (b) { b.classList.toggle("active", b.getAttribute("data-wp") === p); });
  if (p === "news" && typeof renderNewsFilters === "function") try { renderNewsFilters(); } catch (e) {}
}
function shGoSec(sid) {
  var S = SH.secs.filter(function (x) { return x.id === sid; })[0]; if (!S) return;
  var ps = shPagesOf(S); if (!ps.length) return;
  var cur = shCur();
  if (ps.indexOf(cur) >= 0) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  var want = SH.last[sid]; shGo(ps.indexOf(want) >= 0 ? want : ps[0]);
}
/* 종목 하나를 어디서든 연다 */
function shOpenSym(sym) {
  if (!sym) return; shCloseAll();
  if (typeof currentTab === "undefined" || currentTab !== "single") { if (typeof navTo === "function") navTo("single", "chart"); else switchTab("single", "chart"); }
  var si = document.getElementById("searchInput"); if (si) si.value = sym;
  if (typeof loadSymbol === "function") loadSymbol(sym);
}

/* ---------- 그리기 ---------- */
function shBuild() {
  if (document.getElementById("shTop")) return;
  document.documentElement.classList.add("sh");
  var rail = document.createElement("nav"); rail.id = "shRail"; rail.setAttribute("aria-label", "주 메뉴");
  var top = document.createElement("header"); top.id = "shTop";
  top.innerHTML =
    '<div class="shApp"><button type="button" class="shBrand" data-shgo="home" aria-label="홈으로"><img src="/icons/icon-192.png?v=2" alt="" width="28" height="28"><b>StockMind</b></button>' +
    '<span class="shAppSp"></span><button type="button" class="shIb" data-shfind aria-label="종목 검색">' + shIc("search", 21) + '</button><button type="button" class="shIb" data-shmenu aria-label="전체 메뉴">' + shIc("menu", 21) + '</button></div>' +
    '<div class="shBarRow"><div class="shCrumb" aria-label="지금 화면"></div><nav class="shTabs" aria-label="이 갈래의 화면"></nav>' +
    '<div class="shTools"><div class="shFind" role="search"><label class="shFindIn">' + shIc("search", 17) + '<input id="shQ" type="search" placeholder="화면 · 종목 검색" autocomplete="off" spellcheck="false" aria-label="화면 이름, 종목 이름이나 코드로 검색"><kbd>/</kbd><button type="button" class="shFindX" data-shfindx aria-label="검색 닫기">' + shIc("close", 18) + '</button></label><div class="shFindBox" hidden></div></div>' +
    '<span class="shActs"></span></div></div>';
  var bar = document.createElement("nav"); bar.id = "shBar"; bar.setAttribute("aria-label", "주 메뉴");
  var menu = document.createElement("div"); menu.id = "shMenu"; menu.hidden = true;
  document.body.insertBefore(top, document.body.firstChild);
  document.body.appendChild(rail); document.body.appendChild(bar); document.body.appendChild(menu);
  /* 예전 상단의 '내 데이터' · '공유' 버튼은 기능(누르면 하는 일)을 그대로 둔 채 자리만 옮긴다 */
  var acts = top.querySelector(".shActs");
  ["cloudBtn", "shareBtn"].forEach(function (id) {
    var b = document.getElementById(id); if (!b) return; var ic = id === "cloudBtn" ? "cloud" : "share";
    /* 기존 코드가 단추 글자를 통째로 바꿔도(예: 연결된 아이디 표시) 아이콘 + 글자 모양을 다시 입힌다 */
    var decor = function () { if (b.querySelector(".shIc")) return; var lab = (b.textContent || "").replace(/[^가-힣A-Za-z0-9 _.@\-]/g, "").trim() || (id === "cloudBtn" ? "내 데이터" : "공유"); b.setAttribute("aria-label", lab); b.innerHTML = shIc(ic, 19) + '<span>' + shEsc(lab) + '</span>'; };
    decor(); b.classList.add("shAct"); acts.appendChild(b);
    try { new MutationObserver(decor).observe(b, { childList: true }); } catch (e) {}
  });
  /* 공유: 예전에는 결과 안내가 종목 분석 화면 안에만 떠서 다른 화면에서는 눌러도 반응이 없어 보였다 → 어디서든 알림으로 보여 준다 */
  var sb = document.getElementById("shareBtn");
  if (sb && typeof buildShareHash === "function") sb.onclick = function () {
    var hash = buildShareHash(), url = location.origin + location.pathname + hash, done = function (ok) { var m = ok ? "이 화면의 링크를 복사했어요. 열면 같은 화면이 다시 나와요." : "복사하지 못했어요. 주소창의 주소를 직접 복사해 주세요."; if (typeof smToast === "function") smToast(m, ok ? "" : "bad"); else if (typeof setStatus === "function") { setStatus(m, !ok); setTimeout(function () { setStatus(""); }, 4000); } };
    try { history.replaceState(null, "", hash); } catch (e) {}
    var ok = false; try { var ta = document.createElement("textarea"); ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); document.body.removeChild(ta); } catch (e) { ok = false; }
    if (ok) done(true); else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); }); else done(false);
  };
  /* 화면 오른쪽 아래에 떠 있던 도움말(?) 단추는 위쪽 바로 옮긴다 — 표의 마지막 칸을 가리지 않게 */
  if (typeof clDrawer === "function") { var hb = document.createElement("button"); hb.type = "button"; hb.className = "shAct shHelp"; hb.setAttribute("data-shhelp", "1"); hb.setAttribute("aria-label", "도움말"); hb.innerHTML = shIc("help", 19) + '<span>도움말</span>'; acts.insertBefore(hb, acts.firstChild); document.documentElement.classList.add("shHasHelp"); }

  rail.addEventListener("mouseleave", function () { rail.classList.remove("quiet"); });
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest("#shRail")) rail.classList.add("quiet");   // 누른 뒤에는 펼침 메뉴를 접는다(마우스가 메뉴를 벗어나면 다시 켜짐)
    var g = t.closest("[data-shgo]"); if (g) { e.preventDefault(); shGo(g.getAttribute("data-shgo")); return; }
    var s = t.closest("[data-shsec]"); if (s) { e.preventDefault(); shGoSec(s.getAttribute("data-shsec")); return; }
    var y = t.closest("[data-shsym]"); if (y) { e.preventDefault(); shOpenSym(y.getAttribute("data-shsym")); return; }
    if (t.closest("[data-shfold]")) { e.preventDefault(); shRailSet(document.documentElement.classList.contains("shWide") ? "mini" : "wide"); return; }
    if (t.closest("[data-shmenu]")) { e.preventDefault(); shMenuOpen(); return; }
    if (t.closest("[data-shmenux]")) { e.preventDefault(); shMenuClose(); return; }
    if (t.closest("[data-shhelp]")) { e.preventDefault(); shMenuClose(); try { var dr = document.getElementById("clDrawer"); clDrawer(!dr || dr.hidden, "page"); } catch (er) {} return; }
    if (t.closest("[data-shfind]")) { e.preventDefault(); shFindOpen(); return; }
    if (t.closest("[data-shfindx]")) { e.preventDefault(); shFindClose(true); return; }
    if (SH.find.open && !t.closest(".shFind")) shFindClose();
  });
  document.addEventListener("keydown", function (e) {
    var tg = e.target, typing = tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable);
    if (e.key === "Escape") { if (!menu.hidden) { shMenuClose(); e.preventDefault(); } else if (SH.find.open) { shFindClose(true); e.preventDefault(); } return; }
    if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); shFindOpen(); }
  });
  var q = top.querySelector("#shQ");
  q.addEventListener("focus", function () { SH.find.open = true; top.classList.add("finding"); shFindRun(); });
  q.addEventListener("input", function () { shFindRun(); });
  q.addEventListener("keydown", function (e) {
    var F = SH.find, n = F.items.length;
    if (e.key === "ArrowDown" && n) { e.preventDefault(); F.at = (F.at + 1) % n; shFindMark(); }
    else if (e.key === "ArrowUp" && n) { e.preventDefault(); F.at = (F.at - 1 + n) % n; shFindMark(); }
    else if (e.key === "Enter") { e.preventDefault(); var it = F.items[F.at >= 0 ? F.at : 0]; if (it) shFindPick(it); else if (q.value.trim()) shOpenSym(q.value.trim()); }
  });
  window.addEventListener("resize", function () { clearTimeout(SH.rt); SH.rt = setTimeout(function () { shRailMode(); shPaint(); }, 150); });
  shRailMode();
}
/* v16.30 왼쪽 메뉴: 펼친 모양(모든 화면이 한눈에)과 접은 모양(아이콘만).
   고른 적이 없으면 화면 폭이 1280px 이상일 때 펼친다. 한 번 고르면 그 기기에서 기억한다. */
function shRailPref() { try { var v = localStorage.getItem("sm.sh.rail"); return v === "wide" || v === "mini" ? v : ""; } catch (e) { return ""; } }
function shRailMode() {
  var w = window.innerWidth || document.documentElement.clientWidth || 0, pref = shRailPref();
  var wide = w >= 1024 && (pref ? pref === "wide" : w >= 1280);
  var H = document.documentElement, was = H.classList.contains("shWide");
  H.classList.toggle("shWide", wide);
  if (was !== wide) { SH.sig = ""; }
  return wide;
}
function shRailSet(mode) {
  try { localStorage.setItem("sm.sh.rail", mode); } catch (e) {}
  shRailMode(); shPaint();
  var r = document.getElementById("shRail"); if (r) r.classList.add("quiet");
  try { window.dispatchEvent(new Event("resize")); } catch (e) {}   // 그래프 · 표가 넓어진(좁아진) 자리에 다시 맞추도록
}

function shPaint() {
  var top = document.getElementById("shTop"); if (!top) return;
  var cur = shCur(), S = shSecOf(cur), secs = shSecs(), owner = shOwner();
  SH.last[S.id] = cur; try { localStorage.setItem("sm.sh.last", JSON.stringify(SH.last)); } catch (e) {}
  document.documentElement.setAttribute("data-shp", cur); document.documentElement.setAttribute("data-shs", S.id);   // 주의: 누를 곳 표시(data-shgo · data-shsec)와 이름이 겹치면 안 된다
  var done = {}; try { if (owner && typeof smFlowDone === "function") { var D = smFlowDone(); done = { data: D.data, brief: D.brief, onecard: D.make }; } } catch (e) {}

  /* 왼쪽 메뉴(PC) */
  var rail = document.getElementById("shRail"), sig = secs.map(function (x) { return x.id + ":" + shPagesOf(x).join(","); }).join("|") + "#" + cur + "#" + JSON.stringify(done) + "#" + (document.documentElement.classList.contains("shWide") ? "w" : "m");
  if (SH.sig !== sig) {
    SH.sig = sig;
    var wide = document.documentElement.classList.contains("shWide");
    rail.innerHTML = '<div class="shHead"><button type="button" class="shLogo" data-shgo="home" aria-label="StockMind 홈"><img src="/icons/icon-192.png?v=2" alt="" width="44" height="44"><b>StockMind</b></button></div><div class="shSecs">' + secs.map(function (x) {
      var ps = shPagesOf(x);
      return '<div class="shSec' + (x.id === S.id ? " on" : "") + '"><button type="button" class="shSecB" data-shsec="' + x.id + '"' + (x.id === S.id ? ' aria-current="true"' : "") + '>' + shIc(x.id, 23) + '<span>' + x.t + '</span>' + (x.d ? '<small>' + x.d + '</small>' : "") + '</button>' +
        '<div class="shFly"><div class="shFlyIn"><b>' + x.t + '</b>' + ps.map(function (p) { return '<button type="button" data-shgo="' + p + '" class="' + (p === cur ? "on" : "") + '"' + (p === cur ? ' aria-current="page"' : "") + ' title="' + shEsc(SH.pages[p].d) + '">' + shIc("p_" + p, 19) + '<span>' + SH.pages[p].t + '</span>' + (done[p] ? '<em title="오늘 끝냄">완료</em>' : "") + '</button>'; }).join("") + '</div></div></div>';
    }).join("") + '</div><div class="shRailFoot"><button type="button" class="shSecB shFoldB" data-shfold aria-label="' + (wide ? "메뉴 접기" : "메뉴 펼치기") + '">' + shIc(wide ? "fold" : "unfold", 20) + '<span>' + (wide ? "메뉴 접기" : "펼치기") + '</span></button><button type="button" class="shSecB shAllB" data-shmenu>' + shIc("menu", 21) + '<span>전체</span></button></div>';
    var onB = rail.querySelector(".shFlyIn button.on"), sc = rail.querySelector(".shSecs");   // 지금 화면이 메뉴 안에서 보이게
    if (wide && onB && sc) { try { var rb = onB.getBoundingClientRect(), rs = sc.getBoundingClientRect(); if (rb.bottom > rs.bottom - 8 || rb.top < rs.top + 8) sc.scrollTop += rb.top - rs.top - rs.height / 2; } catch (e) {} }

    /* 아래쪽 메뉴(휴대폰) — 갈래가 다섯을 넘으면 배우기는 '전체 메뉴'에서 */
    var bs = secs.length > 5 ? secs.filter(function (x) { return x.id !== "learn"; }).slice(0, 5) : secs;
    var bar = document.getElementById("shBar");
    bar.style.setProperty("--n", bs.length);
    bar.innerHTML = bs.map(function (x) { return '<button type="button" data-shsec="' + x.id + '" class="' + (x.id === S.id ? "on" : "") + '"' + (x.id === S.id ? ' aria-current="true"' : "") + '>' + shIc(x.id, 23) + '<span>' + x.t + '</span></button>'; }).join("");

    /* 화면 탭 */
    var tabs = top.querySelector(".shTabs"), ps = shPagesOf(S);
    tabs.innerHTML = ps.map(function (p) { return '<button type="button" data-shgo="' + p + '" class="' + (p === cur ? "on" : "") + '"' + (p === cur ? ' aria-current="page"' : "") + '>' + SH.pages[p].t + (done[p] ? '<i class="shDone" title="오늘 끝냄"></i>' : "") + '</button>'; }).join("");
    var on = tabs.querySelector(".on"); if (on && tabs.scrollWidth > tabs.clientWidth) { try { tabs.scrollLeft = Math.max(0, on.offsetLeft - 24); } catch (e) {} }
    var cr = top.querySelector(".shCrumb"); if (cr) cr.innerHTML = '<span>' + S.t + '</span><i aria-hidden="true">›</i><b>' + SH.pages[cur].t + '</b><small>' + shEsc(SH.pages[cur].d) + '</small>';
    document.title = (cur === "home" ? "" : SH.pages[cur].t + " · ") + "StockMind";
  }
}

/* ---------- 전체 메뉴 ---------- */
function shMenuOpen() {
  var m = document.getElementById("shMenu"); if (!m) return; shFindClose();
  var cur = shCur();
  m.innerHTML = '<div class="shMenuBg" data-shmenux></div><div class="shMenuBox" role="dialog" aria-modal="true" aria-label="전체 메뉴"><div class="shMenuH"><b>전체 메뉴</b><button type="button" class="shIb" data-shmenux aria-label="닫기">' + shIc("close", 20) + '</button></div><div class="shMenuG">' +
    shSecs().map(function (x) { return '<section><h3>' + shIc(x.id, 18) + x.t + '</h3>' + shPagesOf(x).map(function (p) { var P = SH.pages[p]; return '<button type="button" data-shgo="' + p + '" class="' + (p === cur ? "on" : "") + '"><b>' + P.t + '</b><small>' + P.d + '</small></button>'; }).join("") + '</section>'; }).join("") +
    '</div><div class="shMenuF"><span>v' + (typeof SM_VER !== "undefined" ? SM_VER : "") + '</span><span class="shMenuFL">' + (typeof clDrawer === "function" ? '<button type="button" class="shLink" data-shhelp>도움말</button>' : "") + '<button type="button" class="shLink" data-shinfo>이용 안내</button></span></div></div>';
  m.hidden = false; document.documentElement.classList.add("shLock");
  var ib = m.querySelector("[data-shinfo]"); if (ib) ib.onclick = function () { shMenuClose(); var f = document.getElementById("footInfo"); if (f) f.click(); };
  var first = m.querySelector(".shMenuG button.on") || m.querySelector(".shMenuG button"); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
}
function shMenuClose() { var m = document.getElementById("shMenu"); if (m) m.hidden = true; document.documentElement.classList.remove("shLock"); }

/* ---------- 종목 검색 ---------- */
function shFindOpen() { var top = document.getElementById("shTop"), q = document.getElementById("shQ"); if (!q) return; shMenuClose(); top.classList.add("finding"); SH.find.open = true; q.focus(); try { q.select(); } catch (e) {} shFindRun(); }
function shFindClose(clear) { var top = document.getElementById("shTop"), q = document.getElementById("shQ"); if (!top) return; SH.find.open = false; top.classList.remove("finding"); var box = top.querySelector(".shFindBox"); if (box) box.hidden = true; if (q) { if (clear) q.value = ""; if (document.activeElement === q) q.blur(); } }
function shCloseAll() { shMenuClose(); shFindClose(true); }
function shName(sym) { return typeof cmpLabel === "function" ? cmpLabel(sym) : sym; }
function shFindRun() {
  var q = document.getElementById("shQ"), F = SH.find, v = (q.value || "").trim(), groups = [];
  clearTimeout(F.tm); var seq = ++F.seq;
  if (!v) {
    var rec = [], wl = [];
    try { rec = (typeof loadRecent === "function" ? loadRecent() : []).map(function (x) { return { k: "sym", s: x.s, n: shName(x.s) }; }); } catch (e) {}
    try { wl = (typeof loadWatch === "function" ? loadWatch() : []).slice(0, 8).map(function (x) { return { k: "sym", s: x.s, n: shName(x.s) }; }); } catch (e) {}
    if (rec.length) groups.push(["최근 본 종목", rec]);
    if (wl.length) groups.push(["관심 종목", wl]);
    if (!groups.length) groups.push(["많이 보는 종목", ["005930.KS", "SPY", "QQQ", "^KS11", "GLD", "BTC-USD"].map(function (s) { return { k: "sym", s: s, n: shName(s) }; })]);
    return shFindDraw(groups);
  }
  var lo = v.toLowerCase();
  var pg = Object.keys(SH.pages).filter(function (id) { return shOk(id) && SH.pages[id].t.replace(/\s/g, "").toLowerCase().indexOf(lo.replace(/\s/g, "")) >= 0; }).slice(0, 4).map(function (id) { return { k: "page", id: id, n: SH.pages[id].t, d: shSecOf(id).t }; });
  var dict = []; try { dict = (typeof searchDict === "function" && typeof TICKER_DICT !== "undefined" ? searchDict(TICKER_DICT, v) : []).slice(0, 8).map(function (x) { return { k: "sym", s: x.symbol, n: x.name }; }); } catch (e) {}
  if (dict.length) groups.push(["종목", dict]);
  if (pg.length) groups.push(["화면", pg]);
  shFindDraw(groups, v);
  /* 영문이 섞인 검색어는 사전에 없어도 전체 검색으로 보완한다(기존 종목 검색과 같은 방식) */
  if (/[a-zA-Z]/.test(v) && v.length >= 2) F.tm = setTimeout(function () {
    fetch("/api/search?q=" + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (d) {
      if (seq !== F.seq) return; var have = {}; dict.forEach(function (x) { have[x.s] = 1; });
      var ex = (d.quotes || []).filter(function (x) { return x.symbol && !have[x.symbol]; }).slice(0, 6).map(function (x) { return { k: "sym", s: x.symbol, n: x.name || x.symbol, d: x.exch || "" }; });
      if (ex.length) { groups.push(["전체 검색 결과", ex]); shFindDraw(groups, v); }
    }).catch(function () {});
  }, 350);
}
function shFindDraw(groups, v) {
  var top = document.getElementById("shTop"), box = top.querySelector(".shFindBox"), F = SH.find, i = 0; F.items = [];
  var h = groups.map(function (g) { return '<div class="shFg">' + g[0] + '</div>' + g[1].map(function (it) { F.items.push(it); return '<button type="button" class="shFi" data-i="' + (i++) + '"><b>' + shEsc(it.n) + '</b><small>' + shEsc(it.k === "sym" ? it.s + (it.d ? " " + it.d : "") : it.d + " 화면") + '</small></button>'; }).join(""); }).join("");
  if (!F.items.length) h = '<div class="shFe">' + (v ? '‘' + shEsc(v) + '’에 맞는 종목이 없어요. 영문 코드(예: NVDA)로도 찾아보세요.' : "") + '</div>';
  box.innerHTML = h; box.hidden = !SH.find.open; F.at = v && F.items.length ? 0 : -1; shFindMark();
  Array.prototype.forEach.call(box.querySelectorAll(".shFi"), function (b) { b.onmousedown = function (e) { e.preventDefault(); }; b.onclick = function () { shFindPick(F.items[+b.getAttribute("data-i")]); }; });
}
function shFindMark() { var top = document.getElementById("shTop"); Array.prototype.forEach.call(top.querySelectorAll(".shFi"), function (b) { var on = +b.getAttribute("data-i") === SH.find.at; b.classList.toggle("at", on); if (on) try { b.scrollIntoView({ block: "nearest" }); } catch (e) {} }); }
function shFindPick(it) { if (!it) return; if (it.k === "page") shGo(it.id); else shOpenSym(it.s); }

/* ---------- 기존 흐름에 얹기 ---------- */
(function () {
  if (typeof switchTab !== "function") return;
  /* 운영자 전용 옛 뼈대(왼쪽 메뉴)는 끈다 — 화면 머리글을 넣어 주는 기능만 남긴다.
     단, 덱(PDF · 카드 내보내기)을 열어 둔 동안에는 예전과 똑같은 조건으로 옛 규칙을 되살린다.
     덱 안 글의 줄 간격 같은 값이 옛 규칙에서 내려오고 있어서, 이걸 빼면 PDF 모양이 달라진다(검증으로 확인). 덱이 화면을 덮고 있어 뒤 화면은 보이지 않는다. */
  if (typeof admOn === "function") {
    var admOn0 = admOn, root = document.documentElement;
    admOn = function () { return root.classList.contains("ddOpen") && admOn0(); };
    if (typeof ddDeck === "function") { var dd0 = ddDeck; ddDeck = function () { try { if (admOn0()) root.classList.add("adm"); } catch (e) {} return dd0.apply(this, arguments); }; }
    try { new MutationObserver(function () { try { if (root.classList.contains("adm") !== admOn()) admPaint(); } catch (e) {} }).observe(root, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    try { admPaint(); } catch (e) {}
  }
  function after() { try { shPaint(); } catch (e) { console.warn("shell", e); } try { if (typeof admHead === "function" && shOwner()) admHead(); } catch (e) {} }
  var s0 = switchTab; switchTab = function () { var r = s0.apply(this, arguments); after(); return r; };
  if (typeof switchWatchPane === "function") { var w0 = switchWatchPane; switchWatchPane = function () { var r = w0.apply(this, arguments); after(); return r; }; }
  if (typeof applyOwnerUI === "function") { var o0 = applyOwnerUI; applyOwnerUI = function () { var r = o0.apply(this, arguments); SH.sig = ""; after(); return r; }; }
  if (typeof smFlowPaint === "function") { var f0 = smFlowPaint; smFlowPaint = function () { var r = f0.apply(this, arguments); try { shPaint(); } catch (e) {} return r; }; }
  function start() { shBuild(); after(); setTimeout(after, 700); setTimeout(after, 2600); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
