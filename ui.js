/* ============================================================
   v10.8 화면 정리 공통 (마지막에 불러온다)
   ① 운영자 전용 잠금: 카드·AI·보관함·브리핑 관련 함수는 서버가 확인한 운영자만 실행
   ② 불필요한 그림 문자(이모지·국기) 지우기 — 아래 탭 아이콘과 카드 이미지(캔버스)는 그대로
   ============================================================ */
(function () {
  /* ① 운영자 잠금 — 화면 진입(switchTab)뿐 아니라 함수 자체도 막는다 (주소창·콘솔로 불러도 실행 안 됨) */
  var GUARD = ["aiOpen", "aiOpenCustom", "aiStudio", "makerGo", "makerRender", "cardsOpen", "onePageOpen", "storyOpen", "perOpen", "perOpen2", "reelOpen", "issuesCardOpen", "pubSingleCard", "pubPolicyOpen", "pubRender", "tplPanel", "libTabRender", "libSave", "loadBrief", "renderChannel", "dvDeckOpen", "dsDeckOpen", "discDeckOpen", "guruDeckOpen", "ipoDeckOpen", "macroDeckOpen", "hubOne", "hubAiMulti", "hubOpenList"];
  GUARD.forEach(function (name) {
    var f = window[name]; if (typeof f !== "function" || f.__guarded) return;
    var g = function () { if (typeof isOwner === "function" && !isOwner()) { console.warn("운영자 전용: " + name); return; } return f.apply(this, arguments); };
    g.__guarded = true; window[name] = g;
  });
  // [data-ai-open] 같은 버튼이 공개 화면에 남아 있어도 숨김 (운영자에게만 보임)
  var st = document.createElement("style");
  st.textContent = "html:not(.isOwner) [data-ai-open], html:not(.isOwner) .aiBtn, html:not(.isOwner) #tab-onecard, html:not(.isOwner) #tab-brief, html:not(.isOwner) #tab-channel { display: none !important; }";
  document.head.appendChild(st);

  /* v10.9 아래 메뉴(모바일) 아이콘: 이모지 대신 단색 선 아이콘 · PC 위 메뉴는 글자만 */
  var NAV_SVG = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    brief: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    onecard: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    single: '<path d="M4 19h16"/><path d="M5 15l4-4 3 3 7-7"/>',
    compare: '<path d="M7 20V9M12 20V4M17 20v-7"/>',
    sim: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/>',
    watch: '<path d="M12 4l2.5 5.2 5.5.6-4.1 3.8 1.2 5.4L12 16.3 6.9 19l1.2-5.4L4 9.8l5.5-.6z"/>',
    mind: '<circle cx="12" cy="9" r="4"/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/>',
    channel: '<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    div: '<circle cx="12" cy="12" r="9"/><path d="M7.5 9l2.2 6 2.3-5.5 2.3 5.5 2.2-6M6.8 12h10.4"/>'
  };
  function navIcons() { Array.prototype.forEach.call(document.querySelectorAll(".tabs button[data-tab]"), function (b) { var i = b.querySelector("i"), k = b.getAttribute("data-tab"); if (i && NAV_SVG[k] && !i.__svg) { i.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + NAV_SVG[k] + '</svg>'; i.__svg = true; } }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", navIcons); else navIcons();

  /* ② 그림 문자 지우기: 글자 노드만 손댄다. 그림 문자만 있던 노드(✓·★ 같은 표시)는 그대로 둔다 */
  var RE;
  try { RE = new RegExp("(?:[\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u20BF][\\uFE0F\\u200D\\u20E3]*)+\\s?", "gu"); } catch (e) { RE = null; }
  if (!RE) return;
  var KEEP = ".tabs, canvas, svg, textarea, input, option, [data-keep-emoji]";
  function clean(node) {
    if (node.nodeType === 3) {
      var t = node.nodeValue; if (!t || !RE.test(t)) { RE.lastIndex = 0; return; } RE.lastIndex = 0;
      var p = node.parentElement; if (!p || p.closest(KEEP)) return;
      var n = t.replace(RE, "");
      if (n.trim()) { node.nodeValue = n; return; }
      // v10.9 그림 문자만 있던 자리: 버튼·링크는 그대로(누를 곳이 사라지면 안 됨), 나머지는 비우고 칸을 숨김
      var btn = p.closest("button, a, label");
      if (btn) { var rest = btn.textContent.replace(RE, ""); RE.lastIndex = 0; if (!rest.trim()) return; }   // 그림만 있는 버튼은 그대로 (누를 곳 유지)
      node.nodeValue = "";
      if (p !== btn && !p.textContent.trim() && !p.querySelector("*")) p.classList.add("emoIcon");
      return;
    }
    if (node.nodeType !== 1 || node.matches && node.matches(KEEP)) return;
    var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null), x, list = [];
    while ((x = w.nextNode())) list.push(x);
    list.forEach(clean);
    if (node.title && RE.test(node.title)) { RE.lastIndex = 0; node.title = node.title.replace(RE, ""); } RE.lastIndex = 0;
  }
  var busy = false;
  var mo = new MutationObserver(function (ms) {
    if (busy) return; busy = true;
    try { ms.forEach(function (m) { if (m.type === "characterData") clean(m.target); else m.addedNodes.forEach(clean); }); } finally { busy = false; }
  });
  function start() { clean(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
