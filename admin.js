/* ============================================================ v12.89 운영자 화면 전용 디자인 — 왼쪽 메뉴 + 차분한 작업 화면
   목표: 오래 봐도 덜 피곤하게. 공개 화면(TrackStock 기본 톤: 회색 바탕 · 흰 카드 · 파란 강조)과 같은 색을 쓰되
         운영자 화면만 ① 왼쪽 고정 메뉴(작업 순서대로) ② 넓은 작업 폭 ③ 한 단계 큰 글씨·넉넉한 줄 간격 ④ 색은 필요한 곳에만.
   - PC(1024px 이상): 위쪽 탭 대신 왼쪽 메뉴. 메뉴에서 시장(전체·국내·미국·코인)과 오늘 진행 상황(✓)을 함께 본다.
   - 휴대폰: 아래 탭(5개 + 더보기) 그대로, 화면 안쪽 디자인만 같은 규칙.
   - '이 화면에서 하는 일' 안내는 접힌 한 줄(도움말)로.
   ============================================================ */
var ADM = {
  tabs: ["ops", "data", "brief", "onecard", "report", "analyst", "core", "channel"],
  menu: [
    { g: "오늘 작업", items: [["ops", "🧭", "작업실", "오늘 할 일을 순서대로"], ["data", "🔌", "데이터", "시세가 최신인지 확인"], ["brief", "📰", "시장", "오늘 브리핑 읽기"]] },
    { g: "만들기", items: [["onecard", "🃏", "카드", "카드 작업대 · 즐겨찾기"], ["report", "📑", "리포트", "질문 하나를 끝까지"], ["analyst", "🧑‍💼", "분석", "종목 6틀 분석"], ["core", "⚖️", "본질 · 변수", "길게 볼 것과 대응할 것"]] },
    { g: "공개 화면", small: true, items: [["home", "🏠", "홈"], ["single", "📊", "종목"], ["compare", "⚖", "비교"], ["sim", "💼", "내 자산"], ["watch", "⭐", "관심"], ["guide", "🧭", "투자법"]] }
  ],
  /* 화면 제목 · 한 줄 설명 — 짧고 매끄럽게 */
  head: {
    ops: ["작업실", "오늘 할 일을 순서대로 — 데이터 확인 → 브리핑 → 만들기 → 올리기"],
    data: ["데이터 센터", "지금 화면에 쓰는 시세가 언제 것인지, 어떻게 새로 받는지"],
    brief: ["오늘의 브리핑", "전 종목 시세와 뉴스를 숫자 기준으로 정리했어요"],
    onecard: ["카드 만들기", "주제를 고르고 모양을 정하면 바로 만들어요 — 숫자는 앱 데이터 그대로"],
    report: ["리포트", "질문 하나를 증거 · 시나리오 · 행동안까지 끝까지 풀어요"],
    analyst: ["분석", "종목을 6가지 틀로 보고, Claude 답을 저장해 자산으로 쌓아요"],
    core: ["본질 · 변수", "본질은 길게 들고 가고, 변수는 켜졌을 때 규칙대로 대응해요"],
    channel: ["채널 자료", "오늘 쓸 글과 근거 자료를 한곳에"]
  }
};
function admOn() { return typeof isOwner === "function" && isOwner() && ADM.tabs.indexOf(typeof currentTab !== "undefined" ? currentTab : "") >= 0; }
function admMk() { return typeof smMk === "function" ? smMk() : "all"; }
function admDone() { try { return typeof smFlowDone === "function" ? smFlowDone(admMk()) : {}; } catch (e) { return {}; } }
function admNavHtml() {
  var cur = typeof currentTab !== "undefined" ? currentTab : "", D = admDone(), st = { data: D.data, brief: D.brief, onecard: D.make };
  var mk = admMk(), mkNm = { all: "전체", kr: "국내", us: "미국", coin: "코인" };
  var h = '<div class="admBrand"><b>Stock<span>Mind</span></b><small>운영실</small></div>';
  h += '<div class="admMk" role="radiogroup" aria-label="작업할 시장">' + ["all", "kr", "us", "coin"].map(function (m) { return '<button data-admmk="' + m + '" class="' + (m === mk ? "on" : "") + '">' + mkNm[m] + '</button>'; }).join("") + '</div>';
  ADM.menu.forEach(function (G) {
    h += '<div class="admG' + (G.small ? " sm" : "") + '"><div class="admGT">' + G.g + '</div>' + G.items.map(function (it) { var on = it[0] === cur, done = st[it[0]]; return '<button class="admI' + (on ? " on" : "") + '" data-admtab="' + it[0] + '"><i>' + it[1] + '</i><span><b>' + it[2] + '</b>' + (it[3] && !G.small ? '<small>' + it[3] + '</small>' : '') + '</span>' + (done ? '<em>✓</em>' : '') + '</button>'; }).join("") + '</div>';
  });
  h += '<div class="admFoot"><button class="admI sm" data-admhelp><i>?</i><span><b>도움말 보기</b></span></button><small>v' + (typeof SM_VER !== "undefined" ? SM_VER : "") + '</small></div>';
  return h;
}
function admPaint() {
  var on = admOn(), root = document.documentElement;
  root.classList.toggle("adm", on);
  var nav = document.getElementById("admNav");
  if (!on) { if (nav) nav.hidden = true; return; }
  if (!nav) { nav = document.createElement("nav"); nav.id = "admNav"; nav.setAttribute("aria-label", "운영자 메뉴"); document.body.appendChild(nav); }
  nav.hidden = false; nav.innerHTML = admNavHtml();
  Array.prototype.forEach.call(nav.querySelectorAll("[data-admtab]"), function (b) { b.onclick = function () { var t = b.getAttribute("data-admtab"); if (typeof navTo === "function") navTo(t); else switchTab(t); }; });
  Array.prototype.forEach.call(nav.querySelectorAll("[data-admmk]"), function (b) { b.onclick = function () { if (typeof smSetMk === "function") smSetMk(b.getAttribute("data-admmk")); var t = currentTab; if (t === "ops" && typeof renderOps === "function") renderOps(); else if (t === "onecard" && typeof makerRender === "function") makerRender(); else if (t === "brief" && typeof renderBrief === "function") renderBrief(); admPaint(); }; });
  var hb = nav.querySelector("[data-admhelp]"); if (hb) hb.onclick = function () { try { var j = JSON.parse(localStorage.getItem("sm.guideOff") || "{}") || {}; delete j[currentTab]; localStorage.setItem("sm.guideOff", JSON.stringify(j)); } catch (e) {} if (typeof smGuidePaint === "function") smGuidePaint(); var g = document.getElementById("smGuide"); if (g) { g.classList.add("open"); try { g.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} } };
  admHead();
}
/* 화면 머리: 제목 + 한 줄 설명을 같은 모양으로 (기존 .pgHead 를 고쳐 쓰고, 없는 화면엔 만들어 넣는다) */
function admHead() {
  var t = currentTab, H = ADM.head[t]; if (!H) return;
  var host = document.getElementById("tab-" + t); if (!host) return;
  var ph = host.querySelector(".pgHead h2");
  if (ph) { if (!ph.getAttribute("data-adm")) { var keepSmall = ph.querySelector("small[id]"); ph.setAttribute("data-adm", "1"); ph.innerHTML = escapeHtml(H[0]) + (keepSmall ? "" : '<small>' + escapeHtml(H[1]) + '</small>'); if (keepSmall) ph.appendChild(keepSmall); } }
  else if (!host.querySelector(".admPh") && !host.querySelector(".opsHead,.pgHead,[data-own-head]")) { var d = document.createElement("div"); d.className = "admPh"; d.innerHTML = '<h2>' + escapeHtml(H[0]) + '<small>' + escapeHtml(H[1]) + '</small></h2>'; var flow = host.querySelector("#smFlow"); host.insertBefore(d, flow ? flow.nextSibling : host.firstChild); }
}
/* 도움말은 접힌 한 줄로 — 누르면 펼친다 */
(function () {
  if (typeof smGuidePaint !== "function") return;
  var g0 = smGuidePaint; smGuidePaint = function () {
    var r = g0.apply(this, arguments);
    try { var g = document.getElementById("smGuide"); if (g && !g.getAttribute("data-adm")) { g.setAttribute("data-adm", "1"); var b = g.querySelector("b"); if (b) { b.innerHTML = '<span class="admQ">?</span>' + b.textContent.replace(/ — 이 화면에서 하는 일$/, "") + ' <small>이 화면에서 하는 일</small>'; b.onclick = function () { g.classList.toggle("open"); }; } } } catch (e) {}
    return r;
  };
})();
(function () {
  if (typeof switchTab === "function") { var s0 = switchTab; switchTab = function () { var r = s0.apply(this, arguments); try { admPaint(); } catch (e) { console.warn("adm", e); } return r; }; }
  if (typeof smFlowPaint === "function") { var f0 = smFlowPaint; smFlowPaint = function () { var r = f0.apply(this, arguments); try { if (admOn()) { var nav = document.getElementById("admNav"); if (nav) { nav.innerHTML = admNavHtml(); admPaint(); } } } catch (e) {} return r; }; }
  setTimeout(admPaint, 600); setTimeout(admPaint, 2500); window.addEventListener("resize", function () { clearTimeout(ADM.rt); ADM.rt = setTimeout(admPaint, 200); });

  var C = [
    /* ---------- 공통 토큰 (운영자 화면만) ---------- */
    "html.adm{--admBg:#f4f5f7;--admCard:#fff;--admLine:#e6e8ec;--admTxt:#1d2330;--admSub:#6b7280;--admMute:#9aa1ad;--admAcc:#3182f6;--admInk:#14161c;--admGold:#c9a24f;--admSoft:#f7f8fa}",
    "html.adm body{background:var(--admBg);color:var(--admTxt);font-size:14.5px;line-height:1.6;-webkit-font-smoothing:antialiased}",
    /* ---------- PC: 왼쪽 메뉴 ---------- */
    "#admNav{display:none}",
    "@media(min-width:1024px){",
    " html.adm body{max-width:none;padding:20px 28px 40px 268px}",
    " html.adm .topbar .tabs,html.adm .topbar .brandRow .brand{display:none}html.adm .topbar{margin:0 0 6px;padding:0;background:none;border:0;min-height:0}html.adm .topbar .brandRow{justify-content:flex-end;padding:0}",
    " html.adm #admNav{display:flex;flex-direction:column;position:fixed;left:0;top:0;bottom:0;width:240px;background:#fff;border-right:1px solid var(--admLine);padding:18px 12px;overflow-y:auto;z-index:120}",
    " html.adm [id^=tab-]{max-width:1320px;margin:0 auto}",
    "}",
    ".admBrand{padding:2px 10px 14px;display:flex;align-items:baseline;gap:8px}.admBrand b{font-size:19px;font-weight:900;letter-spacing:-.3px}.admBrand b span{color:var(--admAcc)}.admBrand small{font-size:12px;color:var(--admSub);font-weight:700}",
    ".admMk{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--admSoft);border:1px solid var(--admLine);border-radius:10px;padding:3px;margin:0 4px 14px}.admMk button{border:0;background:transparent;border-radius:7px;padding:6px 0;font-size:12.5px;font-weight:700;color:var(--admSub);cursor:pointer}.admMk button.on{background:var(--admInk);color:#fff}",
    ".admG{margin-bottom:12px}.admGT{font-size:11.5px;font-weight:800;color:var(--admMute);letter-spacing:.3px;padding:0 10px 6px}",
    ".admI{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;border-radius:10px;padding:8px 10px;text-align:left;cursor:pointer;color:var(--admTxt)}.admI:hover{background:var(--admSoft)}.admI.on{background:#eef4ff}.admI.on b{color:var(--admAcc)}",
    ".admI i{font-style:normal;font-size:17px;width:22px;text-align:center;flex:none}.admI span{flex:1;min-width:0;display:flex;flex-direction:column}.admI b{font-size:14px;font-weight:800}.admI small{font-size:11.5px;color:var(--admSub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.admI em{font-style:normal;font-size:12px;font-weight:900;color:#fff;background:#1d7f55;border-radius:50%;width:18px;height:18px;display:grid;place-items:center;flex:none}",
    ".admG.sm .admI{padding:5px 10px}.admG.sm .admI b{font-size:13px;font-weight:600;color:var(--admSub)}.admG.sm .admI i{font-size:14px;filter:grayscale(1);opacity:.6}",
    ".admFoot{margin-top:auto;padding-top:10px;border-top:1px solid var(--admLine);display:flex;align-items:center;justify-content:space-between}.admFoot small{color:var(--admMute);font-size:11px;padding-right:10px}.admFoot .admI{width:auto}",
    /* ---------- 화면 머리 · 카드 ---------- */
    "html.adm [id^=tab-] > .card{background:var(--admCard);border:1px solid var(--admLine);border-radius:14px;padding:22px 24px;box-shadow:none}",
    "html.adm .pgHead h2,html.adm .admPh h2{font-size:20px;font-weight:900;color:var(--admTxt);letter-spacing:-.3px;margin:0}html.adm .pgHead h2 small,html.adm .admPh h2 small{display:block;font-size:13px;font-weight:500;color:var(--admSub);margin-top:4px;letter-spacing:0}",
    "html.adm .admPh{margin:2px 2px 14px}",
    /* 단계 머리(①②③) — 같은 모양으로 */
    "html.adm .mkStep,html.adm .wbStep{font-size:15.5px;font-weight:800;color:var(--admTxt);margin:18px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}html.adm .mkStep b,html.adm .wbStep b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:7px;background:var(--admInk);color:#fff;font-size:12.5px;margin:0}html.adm .mkStep small,html.adm .wbStep small{font-size:12.5px;font-weight:500;color:var(--admSub)}",
    "html.adm .anSec{border-top:1px solid var(--admLine);margin-top:18px;padding-top:6px}",
    /* 글 · 버튼 · 입력 */
    "html.adm .briefDim{color:var(--admSub)}html.adm p,html.adm li{line-height:1.65}",
    "html.adm button.primary{background:var(--admAcc);border-radius:10px;padding:9px 16px;font-size:14px}html.adm button.chip{border-radius:999px;font-size:13px}",
    "html.adm textarea,html.adm input:not([type=checkbox]):not([type=radio]),html.adm select{border-radius:10px;border-color:var(--admLine);background:#fff;font-size:14px}",
    /* 운영 순서 바 — 한 줄로 차분하게 */
    "html.adm .smFlow{background:#fff;border:1px solid var(--admLine);border-radius:12px;padding:8px 12px;margin-bottom:12px}html.adm .smFlowHint{color:var(--admSub)}",
    "@media(min-width:1024px){html.adm .smFlowMk{display:none}}",
    /* 도움말 — 접힌 한 줄 */
    "html.adm .smGuide{border:1px solid var(--admLine);background:#fff;border-radius:12px;padding:8px 14px;margin-bottom:12px}html.adm .smGuide > b{display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;font-size:13.5px}html.adm .smGuide > b small{color:var(--admMute);font-weight:500;font-size:12px}html.adm .smGuide ol,html.adm .smGuide [data-goff]{display:none}html.adm .smGuide.open ol{display:block;margin:8px 0 4px}html.adm .smGuide.open [data-goff]{display:inline-block}",
    ".admQ{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#eef4ff;color:var(--admAcc);font-size:12px;font-weight:900}",
    /* 작업실 */
    "html.adm .opsStep{border-radius:14px;border-color:var(--admLine)}html.adm .opsHead h2{font-size:22px;font-weight:900}",
    /* 휴대폰 */
    "@media(max-width:1023px){html.adm [id^=tab-] > .card{padding:18px 16px;border-radius:14px}html.adm .pgHead h2,html.adm .admPh h2{font-size:18px}}",
    "[data-theme=dark] html.adm,html.adm[data-theme=dark]{--admBg:#0f131a;--admCard:#161b24;--admLine:#263041;--admTxt:#e7eaf0;--admSub:#9aa3b2;--admSoft:#1c2330}html.adm[data-theme=dark] #admNav{background:#121722}"
  ];
  var st = document.createElement("style"); st.id = "admCss"; st.textContent = C.join(""); document.head.appendChild(st);
})();
/* 도움말 문장 다듬기 — 지금 흐름(직접 질문 · 즐겨찾기 · 프롬프트 복사)에 맞게, 짧고 매끄럽게 */
(function () {
  if (typeof SM_GUIDE === "undefined") return;
  SM_GUIDE.ops = { t: "작업실", s: ["① 데이터 확인부터 시작해요. 세 시장의 날짜가 '정상'이면 다음으로 넘어가요.", "② 오늘 브리핑은 '직접 질문'을 권해요. 프롬프트를 복사해 claude.ai에 붙여넣고, 받은 답을 다시 붙여넣으면 끝이에요.", "③ 만들기와 ④ 올리기는 편성 순서대로 — 끝난 단계에는 ✓가 붙어요."] };
  SM_GUIDE.data = { t: "데이터 센터", s: ["세 시장(국내·미국·코인)의 날짜가 마지막 마감일인지 확인해요. '정상'이면 그대로 두면 돼요.", "날짜가 늦거나 '숨김'으로 보이면 '지금 받기' 버튼을 눌러요. 1~4분 걸려요.", "숫자가 갑자기 튄 종목은 ✨ 원인 확인으로 휴장·액면분할·오류 여부를 봐요."] };
  SM_GUIDE.brief = { t: "오늘의 브리핑", s: ["시장을 고르면 그 시장의 온도·업종·급등락이 바로 바뀌어요.", "핵심 이슈와 급등락 아래에는 '왜 · 그래서 · 볼 것'이 붙어요. 작업실에서 오늘 브리핑을 받은 날에만 보여요.", "여기는 읽고 확인하는 화면이에요. 카드는 카드 탭에서 만들어요."] };
  SM_GUIDE.onecard = { t: "카드 만들기", s: ["매일 만드는 카드는 ★ 즐겨찾기에 넣어 두세요. 시장만 고르고 '바로 만들기'를 누르면 돼요.", "새 주제는 ① 주제 → ② 모양 → ③ 미리보기 순서로 골라요. 모양엔 '추천'이 먼저 골라져 있어요.", "④에서 카드 저장, 업로드 글 복사, 발행 전 검수까지 한 번에 해요."] };
  SM_GUIDE.report = { t: "리포트", s: ["'오늘의 리포트'나 '질문 고르기'에서 하나를 열면 증거(Exhibit)와 규칙 의견이 계산돼요.", "① Claude 서술은 프롬프트를 복사해 claude.ai에 붙여넣고, 답을 다시 붙여넣어요. 무엇이 보완됐는지 바로 아래에 표시돼요.", "② 카드 덱 → ③ 저장 순서로 마무리해요. 저장한 리포트는 3개월 뒤 결론을 채점해요."] };
  SM_GUIDE.channel = { t: "채널 자료", s: ["데일리 · 낙폭 · 자산배분 · 과거 사례를 글로 정리한 화면이에요.", "칸마다 '복사'를 눌러 그대로 가져다 쓰면 돼요.", "카드는 카드 탭에서, 오늘 해설은 작업실에서 만들어요."] };
})();
