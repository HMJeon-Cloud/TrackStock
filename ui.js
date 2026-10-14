/* ============================================================
   v10.8 화면 정리 공통 (마지막에 불러온다)
   ① 운영자 전용 잠금: 카드·AI·보관함·브리핑 관련 함수는 서버가 확인한 운영자만 실행
   ② 불필요한 그림 문자(이모지·국기) 지우기 — 아래 탭 아이콘과 카드 이미지(캔버스)는 그대로
   ============================================================ */
(function () {
  /* ① 운영자 잠금 — 화면 진입(switchTab)뿐 아니라 함수 자체도 막는다 (주소창·콘솔로 불러도 실행 안 됨) */
  var GUARD = ["aiOpen", "aiOpenCustom", "aiStudio", "makerGo", "makerRender", "cardsOpen", "onePageOpen", "storyOpen", "perOpen", "perOpen2", "reelOpen", "issuesCardOpen", "pubSingleCard", "pubPolicyOpen", "pubRender", "tplPanel", "libTabRender", "libSave", "loadBrief", "renderChannel"];
  GUARD.forEach(function (name) {
    var f = window[name]; if (typeof f !== "function" || f.__guarded) return;
    var g = function () { if (typeof isOwner === "function" && !isOwner()) { console.warn("운영자 전용: " + name); return; } return f.apply(this, arguments); };
    g.__guarded = true; window[name] = g;
  });
  // [data-ai-open] 같은 버튼이 공개 화면에 남아 있어도 숨김 (운영자에게만 보임)
  var st = document.createElement("style");
  st.textContent = "html:not(.isOwner) [data-ai-open], html:not(.isOwner) .aiBtn, html:not(.isOwner) #tab-onecard, html:not(.isOwner) #tab-brief, html:not(.isOwner) #tab-channel { display: none !important; }";
  document.head.appendChild(st);

  /* ② 그림 문자 지우기: 글자 노드만 손댄다. 그림 문자만 있던 노드(✓·★ 같은 표시)는 그대로 둔다 */
  var RE;
  try { RE = new RegExp("(?:[\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u20BF][\\uFE0F\\u200D\\u20E3]*)+\\s?", "gu"); } catch (e) { RE = null; }
  if (!RE) return;
  var KEEP = ".tabs, canvas, svg, textarea, input, [data-keep-emoji], .slHero .slKick";
  function clean(node) {
    if (node.nodeType === 3) {
      var t = node.nodeValue; if (!t || !RE.test(t)) { RE.lastIndex = 0; return; } RE.lastIndex = 0;
      var p = node.parentElement; if (!p || p.closest(KEEP)) return;
      var n = t.replace(RE, ""); if (n.trim()) node.nodeValue = n;
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
