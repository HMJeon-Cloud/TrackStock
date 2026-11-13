/* ============================================================
   v13.10 화면 정리 — 본문은 숫자와 판정만, 설명은 필요할 때만
   ① 설명 접기: 풀이 · 읽는 법 · 안내 문단은 화면에서 ⓘ 하나로 접고, 마우스를 올리거나 누르면 원문이 뜬다.
      주의 문구는 제목만 한 줄로 남긴다(예: "⚠ 레버리지 상품 주의 · 사례가 3번뿐 ⓘ").
   ② 용어 풀이: 표 머리 · 칸 이름의 용어(MDD · RSI · PER · 200주선 …)에 점선 밑줄, 올리면 쉬운 말 설명.
   ③ 도움말 창: 화면 오른쪽 아래 ? — 「이 화면」(하는 일 + 접어 둔 설명 모아보기)과 「용어 사전」(검색).
   ④ 긴 화면은 요약 + 탭: 본질 · 변수, 데이터 센터를 '요약 먼저, 나머지는 탭'으로 묶는다(내용은 옮기기만 하고 지우지 않는다).
   기존 화면 코드는 건드리지 않고, 그려진 뒤에 정리한다. 문제가 생기면 이 파일만 빼면 예전 화면으로 돌아간다.
   ============================================================ */
var CL = { store: [], map: {}, pop: null, tm: null, tab: {}, on: true };
/* 같은 설명은 한 번만 보관한다(화면을 다시 그릴 때마다 쌓이지 않게) */
function clPut(tab, title, html) { var k = tab + "|" + title + "|" + html; if (CL.map[k] != null) return CL.map[k]; return (CL.map[k] = CL.store.push({ tab: tab, title: title, html: html }) - 1); }
function clEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

/* ---------- 용어 사전 ---------- */
var CL_TERMS = [
  ["MDD", /MDD|최대\s?낙폭/, "최대 낙폭(MDD)", "고점에서 가장 깊게 빠졌던 폭이에요. -50%면 반 토막. '얼마나 싸졌나'의 근거이자 '얼마나 더 아플 수 있나'의 근거예요."],
  ["RSI", /RSI/, "RSI", "최근 14일 동안 오른 힘과 내린 힘의 비율(0~100). 30 아래면 단기로 많이 팔린 상태(침체), 70 위면 많이 오른 상태(과열)로 봐요."],
  ["PER", /PER/, "PER (주가수익비율)", "주가가 1년 이익의 몇 배인지. 10배면 지금 이익이 10년 이어질 때 원금을 버는 가격. 낮을수록 이익에 비해 싸지만, 이익이 줄 것 같아서 싼 경우도 있어요."],
  ["PBR", /PBR/, "PBR (주가순자산비율)", "주가가 회사 순자산(자본)의 몇 배인지. 1배 아래면 장부상 자산보다 싸게 거래되는 거예요."],
  ["ROE", /ROE/, "ROE (자기자본이익률)", "주주 돈 100으로 1년에 얼마를 버는지. 15% 이상이면 우량 기업으로 봐요."],
  ["EPS", /EPS/, "EPS (주당순이익)", "1주가 1년에 벌어들인 이익이에요."],
  ["PSR", /PSR/, "PSR (주가매출비율)", "시가총액이 1년 매출의 몇 배인지. 아직 이익이 없는 회사를 비교할 때 써요."],
  ["CAGR", /CAGR|연평균 수익|연수익/, "연평균 수익(CAGR)", "매년 같은 비율로 올랐다고 칠 때의 한 해 수익률. 10년에 2배면 연 약 7%예요."],
  ["w200", /200주선/, "200주선", "주봉 200개(약 4년)의 평균 가격. 지난 4년 동안 산 사람들의 평균 단가쯤이에요. 그 아래면 4년 평균보다 싸게 거래되는 드문 자리예요."],
  ["d200", /200일선/, "200일선", "최근 200거래일(약 10개월) 평균 가격. 위에 있으면 오르는 흐름, 아래면 쉬거나 내리는 흐름으로 봐요."],
  ["ma", /이동평균|정배열|역배열/, "이동평균 · 정배열/역배열", "며칠 동안의 평균 가격을 이은 선이에요. 짧은 선(20일)이 긴 선(200일) 위에 차례로 있으면 정배열(오름), 반대면 역배열(내림)이에요."],
  ["vol", /변동성/, "변동성", "가격이 흔들리는 정도(1년 기준 %). 지수는 15~20%, 개별 주식은 30~40%, 코인 · 레버리지는 60% 이상이 흔해요. 클수록 비중을 작게 가져가요."],
  ["vix", /VIX|공포지수/, "공포지수(VIX)", "미국 시장이 앞으로 한 달 동안 얼마나 흔들릴 것으로 보는지. 20 아래 평온, 20~30 불안, 30 이상 공포 구간이에요."],
  ["body", /체력/, "체력 점수", "오래 살아남고 위기마다 회복해 왔는가. 회복력(관찰 기간 · 큰 하락 뒤 회복 횟수 · 회복 시간 · 장기 수익) 60% + 기업 정보(ROE · 이익률 · 성장 · PER) 40%."],
  ["cheap", /싼 정도/, "싼 정도", "지금 가격이 그 종목의 과거에 비해 얼마나 싼가. MDD와 200주선 대비로만 계산해요. 많이 빠질수록 높아서, 체력과 꼭 같이 봐야 해요."],
  ["spot", /자리 점수|^자리$|자리 \d/, "자리 점수", "MDD 30% + 장기 평균선 25% + 기술 지표 25% + 닮은 과거 10% + 매크로 10%. 지금이 사기에 어떤 자리인지를 봐요."],
  ["flow", /흐름/, "흐름 점수", "지금 오르는 중인지 내리는 중인지. RSI · 이동평균 배열 · 1년 수익 · 변동성 네 가지의 평균. 68 이상 오름, 48 이하 내림."],
  ["total", /종합/, "종합 점수", "체력 55% + 자리 45%. 68 이상 좋음 · 55~67 보통 · 42~54 주의 · 그 아래 나쁨. 과거 기록을 정리한 점수이지 수익의 약속이 아니에요."],
  ["recov", /회복력|큰 하락 (뒤 )?회복/, "회복력", "고점에서 -20% 넘게 빠진 뒤 전고점을 되찾은 기록. 5/5면 다섯 번 빠져 다섯 번 다 회복했다는 뜻이에요."],
  ["analog", /닮은 과거/, "닮은 과거", "지금과 고점 대비 · 3개월 수익 · 200일선 위치가 비슷했던 과거 날을 찾아 그 뒤 결과를 센 거예요. 과거 빈도일 뿐 보장은 아니에요."],
  ["break", /이탈/, "평균선 이탈", "선 위에 8주 이상 있다가 주봉 종가가 선 아래로 내려온 것. 다시 4주 연속 선 위에서 마감하면 끝난 것으로 봐요."],
  ["lev", /레버리지/, "레버리지 상품", "지수 하루 수익률의 2~3배를 따라가는 상품. 지수가 오르내리다 제자리로 와도 원금은 줄어요(변동성 손실)."],
  ["lock", /보호예수|락업/, "보호예수(락업)", "상장 뒤 일정 기간 임직원 · 초기 투자자가 주식을 팔지 못하게 묶어 둔 것. 풀리는 날 전후로 팔 물량이 나올 수 있어요."],
  ["w52", /52주/, "52주 고점 · 저점", "최근 1년 동안 가장 높았던 · 낮았던 가격이에요."],
  ["margin", /영업이익률/, "영업이익률", "매출 100 중 본업으로 남긴 이익. 15% 이상이면 가격을 스스로 정할 힘이 있는 사업으로 봐요."],
  ["essence", /본질/, "본질", "기업의 이익 · 현금흐름 · 자산처럼 길게 보면 가격을 결정하는 것. 이 앱의 기준: 본질이 그대로면 흔들려도 들고 간다."],
  ["variable", /변수/, "변수", "금리 · 환율 · 정책 · 전쟁처럼 미리 맞히기 어려운 것. 예측하지 않고 '켜지면 이렇게 한다'는 대응만 정해 둬요."],
  ["uni", /전체 시장 요약/, "전체 시장 요약", "S&P 500 전 종목과 코스피 시총 상위 200개를 매일 아침 한 번 훑어 만든 요약. 오른 종목 비율 · 업종 흐름의 근거예요."],
  ["snap", /스냅샷|아침 수집/, "아침 수집(스냅샷)", "매일 07:00 · 09:00에 서버가 자동으로 시세를 받아 저장하는 작업이에요."],
  ["adj", /분할 반영/, "분할 반영 종가", "액면분할 · 병합을 과거 가격에 소급해 맞춘 종가. 배당은 넣지 않아서, 배당이 큰 종목은 실제 수익보다 낮게 보여요."],
  ["dca", /적립|분할 ?매수/, "적립 · 분할 매수", "한 번에 사지 않고 여러 번에 나눠 사는 것. 바닥을 맞힐 수 없으니 평균 단가를 낮추는 방법이에요."]
];
var CL_TERM_BY = {}; CL_TERMS.forEach(function (t) { CL_TERM_BY[t[0]] = t; });

/* ---------- 말풍선 ---------- */
function clPopEl() { if (CL.pop) return CL.pop; var p = document.createElement("div"); p.id = "clPop"; p.setAttribute("role", "tooltip"); p.hidden = true; document.body.appendChild(p); p.addEventListener("mouseenter", function () { clearTimeout(CL.tm); }); p.addEventListener("mouseleave", function () { clHide(150); }); CL.pop = p; return p; }
function clShow(el) {
  var p = clPopEl(), html = "";
  if (el.hasAttribute("data-clt")) { var t = CL_TERM_BY[el.getAttribute("data-clt")]; if (!t) return; html = '<b>' + clEsc(t[2]) + '</b><p>' + clEsc(t[3]) + '</p>'; }
  else { var it = CL.store[+el.getAttribute("data-clh")]; if (!it) return; html = (it.title ? '<b>' + clEsc(it.title) + '</b>' : '') + '<div class="clBody">' + it.html + '</div>'; }
  clearTimeout(CL.tm); p.innerHTML = html; p.hidden = false; p.style.left = "0px"; p.style.top = "0px"; CL.cur = el;
  var r = el.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, x = Math.max(8, Math.min(vw - pw - 8, r.left + r.width / 2 - pw / 2)), y = r.bottom + 8; if (y + ph > vh - 8) y = Math.max(8, r.top - ph - 8);
  p.style.left = Math.round(x + window.scrollX) + "px"; p.style.top = Math.round(y + window.scrollY) + "px";
}
function clHide(ms) { clearTimeout(CL.tm); CL.tm = setTimeout(function () { if (CL.pop) CL.pop.hidden = true; CL.cur = null; }, ms == null ? 0 : ms); }
document.addEventListener("mouseover", function (e) { var t = e.target && e.target.closest ? e.target.closest("[data-clh],[data-clt]") : null; if (t) { clearTimeout(CL.tm); CL.tm = setTimeout(function () { clShow(t); }, 120); } }, true);
document.addEventListener("mouseout", function (e) { var t = e.target && e.target.closest ? e.target.closest("[data-clh],[data-clt]") : null; if (t) clHide(220); }, true);
document.addEventListener("focusin", function (e) { var t = e.target && e.target.closest ? e.target.closest("[data-clh],[data-clt]") : null; if (t) clShow(t); });
document.addEventListener("focusout", function (e) { var t = e.target && e.target.closest ? e.target.closest("[data-clh],[data-clt]") : null; if (t) clHide(200); });
document.addEventListener("click", function (e) {
  var t = e.target && e.target.closest ? e.target.closest("[data-clh]") : null;
  if (t) { e.preventDefault(); e.stopPropagation(); if (CL.cur === t && CL.pop && !CL.pop.hidden) clHide(0); else clShow(t); return; }
  var g = e.target && e.target.closest ? e.target.closest("[data-clt]") : null; if (g && !g.closest("button,a,summary,tr[data-ansym2]")) { clShow(g); return; }
  if (CL.pop && !CL.pop.hidden && !(e.target.closest && e.target.closest("#clPop"))) clHide(0);
}, true);
document.addEventListener("keydown", function (e) { if (e.key === "Escape") { clHide(0); clDrawer(false); } });
window.addEventListener("scroll", function () { if (CL.pop && !CL.pop.hidden) clHide(0); }, { passive: true });

/* ---------- ① 설명 접기 ---------- */
var CL_NOTE_SEL = ".corePlain,.coreIntro,.coreHelp,.egNote,.dgIntro,.opsNote,.dvNote,.briefPickIntro,.egSumNext";
var CL_HEAD_SEL = ".egH,.mkStep,.dhH,.anxH,.egSubH,.dxSub,h2,h3,h4,.opsSubH,.coreH";
function clTitleOf(el) { var h = el.previousElementSibling, n = 0; while (h && n < 4) { if (h.matches && h.matches(CL_HEAD_SEL)) break; h = h.previousElementSibling; n++; } if (!h || !h.matches || !h.matches(CL_HEAD_SEL)) { var b = el.closest(".egBox,.anSec,.card,section"); h = b ? b.querySelector(CL_HEAD_SEL) : null; } if (!h) return ""; var c = h.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll("small,button,.clI,em"), function (x) { x.remove(); }); return c.textContent.replace(/\s+/g, " ").trim().slice(0, 40); }
function clIcon(idx, label) { var b = document.createElement("button"); b.type = "button"; b.className = "clI" + (label ? " lab" : ""); b.setAttribute("data-clh", idx); b.setAttribute("aria-label", "설명 보기"); b.innerHTML = '<i>i</i>' + (label ? '<span>' + clEsc(label) + '</span>' : ''); return b; }
function clCollapse(root) {
  var tabId = typeof currentTab !== "undefined" ? currentTab : "";
  /* 제목 옆 작은 설명 → ⓘ */
  Array.prototype.forEach.call(root.querySelectorAll(".egH > small, .dhH > small, .mkStep > small.briefDim"), function (sm) {
    if (sm.getAttribute("data-cl") || sm.closest("#clDrawer,#clPop")) return; sm.setAttribute("data-cl", "1"); var txt = sm.textContent.trim(); if (txt.length < (sm.parentNode.classList.contains("mkStep") ? 64 : 38)) return;   // 짧은 부제는 그대로
    var idx = clPut(tabId, clTitleOf(sm) || (sm.parentNode.firstChild && sm.parentNode.firstChild.textContent || "").trim().slice(0, 40), sm.innerHTML); sm.classList.add("clHid"); sm.parentNode.insertBefore(clIcon(idx), sm);
  });
  /* 풀이 · 안내 문단 → 한 줄(주의 제목만) + ⓘ */
  Array.prototype.forEach.call(root.querySelectorAll(CL_NOTE_SEL), function (el) {
    if (el.getAttribute("data-cl") || el.closest("#clDrawer,#clPop,.clHid")) return; el.setAttribute("data-cl", "1");
    if (el.querySelector("input,select,textarea,canvas,[data-dh],[data-egdeck]")) return; var txt = el.textContent.trim(); if (txt.length < 60) return;
    var title = clTitleOf(el), heads = Array.prototype.filter.call(el.querySelectorAll(":scope > b, :scope > p > b"), function (b) { var pv = b.previousSibling; while (pv && pv.nodeType === 3 && !pv.nodeValue.trim()) pv = pv.previousSibling; return !pv || pv.nodeName === "BR"; }).map(function (b) { return b.textContent.trim(); }).filter(function (t, i, a) { return t && t.length <= 24 && a.indexOf(t) === i; });   // 문장 맨 앞의 굵은 글씨만 '소제목'으로 본다
    var warn = heads.filter(function (t) { return /주의|뿐$|번뿐|실패|확인할 수 없는|알 수 없는/.test(t); });
    var idx = clPut(tabId, title, el.innerHTML), line = document.createElement("div"); line.className = "clLine" + (warn.length ? " warn" : "");
    line.appendChild(clIcon(idx, warn.length ? "⚠ " + warn.slice(0, 3).join(" · ") : heads.length ? heads.slice(0, 2).join(" · ") : /^쉽게 말하면/.test(txt) ? "쉽게 말하면" : "설명 보기"));
    el.classList.add("clHid"); el.parentNode.insertBefore(line, el);
  });
  /* 긴 회색 안내문(버튼 없는 것) → ⓘ */
  Array.prototype.forEach.call(root.querySelectorAll("div.briefDim, p.briefDim, p.opsMuted, div.opsMuted, span.opsMuted"), function (el) {
    if (el.getAttribute("data-cl") || el.closest("#clDrawer,#clPop,.clHid,.clLine,td,th,summary,.egScanS,.anActs,.egK")) return; el.setAttribute("data-cl", "1");
    if (el.children.length && el.querySelector("button,a,input,select,b")) return; var txt = el.textContent.trim(); if (txt.length < 95) return;
    var idx = clPut(tabId, clTitleOf(el), el.innerHTML), line = document.createElement("div"); line.className = "clLine"; line.appendChild(clIcon(idx, txt.slice(0, 26).replace(/[ ·—-]+$/, "") + "…")); el.classList.add("clHid"); el.parentNode.insertBefore(line, el);
  });
}
/* ---------- ② 용어 밑줄 ---------- */
var CL_TERM_SEL = "th, .egK > small, .egSumAx > span, .egScCat summary > b, .egScT td:first-child > b, .dgName > b, .coreMxH, .egCell > small, .egEpG small, .kpiL, .opsTile small";
function clTerms(root) {
  Array.prototype.forEach.call(root.querySelectorAll(CL_TERM_SEL), function (el) {
    if (el.getAttribute("data-clg") || el.closest("#clDrawer,#clPop,.clHid")) return; el.setAttribute("data-clg", "1");
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], nd; while ((nd = w.nextNode())) nodes.push(nd);
    for (var i = 0; i < nodes.length; i++) { var tn = nodes[i], s = tn.nodeValue; if (!s || s.length < 2 || (tn.parentNode.closest && tn.parentNode.closest(".clT,.clI,button.chip"))) continue;
      for (var k = 0; k < CL_TERMS.length; k++) { var m = CL_TERMS[k][1].exec(s); if (!m) continue; var sp = document.createElement("span"); sp.className = "clT"; sp.setAttribute("data-clt", CL_TERMS[k][0]); sp.tabIndex = 0; sp.textContent = m[0]; var after = tn.splitText(m.index); after.nodeValue = after.nodeValue.slice(m[0].length); tn.parentNode.insertBefore(sp, after); break; } }
  });
}

/* ---------- ③ 도움말 창 ---------- */
function clDrawer(open, tab) {
  var d = document.getElementById("clDrawer"); if (!d) { if (!open) return; d = document.createElement("aside"); d.id = "clDrawer"; d.hidden = true; document.body.appendChild(d); }
  if (!open) { d.hidden = true; return; }
  CL.dTab = tab || CL.dTab || "page"; var cur = typeof currentTab !== "undefined" ? currentTab : "", G = typeof SM_GUIDE !== "undefined" ? SM_GUIDE[cur] : null, notes = CL.store.filter(function (x) { return x.tab === cur; }), seen = {}, uniq = notes.filter(function (x) { var k = x.html.slice(0, 80); if (seen[k]) return false; seen[k] = 1; return true; });
  var h = '<div class="clDH"><b>도움말</b><button type="button" data-cldx aria-label="닫기">×</button></div><div class="clDT"><button type="button" class="' + (CL.dTab === "page" ? "on" : "") + '" data-cldt="page">이 화면</button><button type="button" class="' + (CL.dTab === "term" ? "on" : "") + '" data-cldt="term">용어 사전</button></div><div class="clDB">';
  if (CL.dTab === "page") {
    if (G) h += '<div class="clDG"><b>' + clEsc(G.t || "이 화면에서 하는 일") + '</b>' + (G.s && G.s.length ? '<ol>' + G.s.map(function (x) { return '<li>' + x + '</li>'; }).join("") + '</ol>' : '') + (G.d ? '<p>' + G.d + '</p>' : '') + '</div>';
    var grp = [], gi = {}; uniq.forEach(function (x) { var t = x.title || "설명"; if (gi[t] == null) { gi[t] = grp.push({ t: t, h: [] }) - 1; } grp[gi[t]].h.push(x.html); });
    h += grp.length ? '<div class="clDS">이 화면에서 접어 둔 설명 ' + grp.length + '묶음</div>' + grp.map(function (x) { return '<details class="clDN"><summary>' + clEsc(x.t) + '</summary>' + x.h.map(function (y) { return '<div class="clBody">' + y + '</div>'; }).join("") + '</details>'; }).join("") : '<div class="clDS">이 화면에는 접어 둔 설명이 없어요.</div>';
  } else {
    h += '<input type="search" id="clQ" placeholder="용어 찾기 (예: MDD, 200주선)" value="' + clEsc(CL.q || "") + '"><div id="clTL">' + clTermList() + '</div>';
  }
  d.innerHTML = h + '</div>'; d.hidden = false;
  d.querySelector("[data-cldx]").onclick = function () { clDrawer(false); };
  Array.prototype.forEach.call(d.querySelectorAll("[data-cldt]"), function (b) { b.onclick = function () { clDrawer(true, b.getAttribute("data-cldt")); }; });
  var q = d.querySelector("#clQ"); if (q) q.oninput = function () { CL.q = q.value; d.querySelector("#clTL").innerHTML = clTermList(); };
}
function clTermList() { var q = (CL.q || "").trim().toLowerCase(); return CL_TERMS.filter(function (t) { return !q || (t[2] + " " + t[3]).toLowerCase().indexOf(q) >= 0; }).map(function (t) { return '<div class="clTI"><b>' + clEsc(t[2]) + '</b><p>' + clEsc(t[3]) + '</p></div>'; }).join("") || '<div class="clDS">찾는 용어가 없어요.</div>'; }
function clFab() {
  var hb = document.querySelector("#admNav [data-admhelp]"); if (hb && !hb._cl) { hb._cl = 1; hb.addEventListener("click", function (e) { e.stopImmediatePropagation(); e.preventDefault(); clDrawer(true, "page"); }, true); }   // 왼쪽 메뉴의 '도움말 보기'도 같은 창을 연다
  if (document.getElementById("clFab")) return; var b = document.createElement("button"); b.id = "clFab"; b.type = "button"; b.setAttribute("aria-label", "도움말 열기"); b.innerHTML = "?"; b.onclick = function () { var d = document.getElementById("clDrawer"); clDrawer(!d || d.hidden, "page"); }; document.body.appendChild(b); }

/* ---------- ④ 요약 + 탭 ---------- */
function clTabify(box, key, panes, cur) {   // panes: [{id,label,badge,nodes:[...],html}]
  var wrap = document.createElement("div"); wrap.className = "clTabs"; wrap.setAttribute("data-clk", key); cur = CL.tab[key] && panes.some(function (p) { return p.id === CL.tab[key]; }) ? CL.tab[key] : cur || panes[0].id;
  wrap.innerHTML = '<div class="clTabBar" role="tablist">' + panes.map(function (p) { return '<button type="button" role="tab" data-cltab="' + p.id + '" class="' + (p.id === cur ? "on" : "") + '">' + clEsc(p.label) + (p.badge || "") + '</button>'; }).join("") + '</div>' + panes.map(function (p) { return '<div class="clPane" data-clpane="' + p.id + '"' + (p.id === cur ? "" : " hidden") + '></div>'; }).join("");
  panes.forEach(function (p) { var el = wrap.querySelector('[data-clpane="' + p.id + '"]'); if (p.html) el.innerHTML = p.html; (p.nodes || []).forEach(function (n) { el.appendChild(n); }); });
  box.appendChild(wrap);
  var go = function (id) { CL.tab[key] = id; Array.prototype.forEach.call(wrap.querySelectorAll(":scope > .clTabBar > button"), function (b) { b.classList.toggle("on", b.getAttribute("data-cltab") === id); }); Array.prototype.forEach.call(wrap.querySelectorAll(":scope > .clPane"), function (p) { p.hidden = p.getAttribute("data-clpane") !== id; }); };
  wrap._go = go;
  wrap.addEventListener("click", function (e) { var b = e.target.closest ? e.target.closest("[data-cltab]") : null; if (b && wrap.contains(b)) { go(b.getAttribute("data-cltab")); if (!b.closest(".clTabBar")) wrap.scrollIntoView({ block: "start", behavior: "smooth" }); } });
  return wrap;
}
function clK(label, value, sub, tone, tab) { return '<button type="button" class="clK ' + (tone || "") + '"' + (tab ? ' data-cltab="' + tab + '"' : '') + '><small>' + label + '</small><b>' + value + '</b><span>' + (sub || "") + '</span></button>'; }
/* 데이터 센터 */
function clData() {
  var box = document.getElementById("dataHubBody"); if (!box || box.querySelector(".clTabs") || !box.querySelector("h3.dhH")) return;
  var kids = Array.prototype.slice.call(box.children), groups = [], g = { id: "top", nodes: [] }; groups.push(g);
  kids.forEach(function (el) { if (el.matches && el.matches("h3.dhH")) { g = { id: (el.textContent.trim().charAt(0) || "x"), head: el, nodes: [el] }; groups.push(g); } else g.nodes.push(el); });
  var by = {}; groups.forEach(function (x) { by[x.id] = x; }); var pick = function (ids) { var out = []; ids.forEach(function (i) { if (by[i]) out = out.concat(by[i].nodes); }); return out; };
  var bad = box.querySelectorAll(".dxT tr.dxBad").length, keyBad = 0; try { keyBad = typeof dxKeyState === "function" ? dxKeyState().filter(function (k) { return k.lv === "warn" || k.lv === "bad"; }).length : 0; } catch (e) {}
  var runs = (typeof DATA !== "undefined" && DATA.config && DATA.config.runs) || [], runBad = runs.slice(0, 6).filter(function (r) { return r.p && r.p.length; }).length;
  var bd = function (n, c) { return n ? '<i class="' + c + '">' + n + '</i>' : ''; };
  var panes = [{ id: "sum", label: "한눈에 보기", nodes: pick(["top", "⓪"]) }, { id: "mk", label: "시장별 상세", nodes: pick(["①"]) }, { id: "btn", label: "지금 받기", nodes: pick(["②"]) }, { id: "ext", label: "그 밖의 데이터", nodes: pick(["③"]) }, { id: "run", label: "일정 · 이력", badge: bd(runBad, "warn"), nodes: pick(["⑤"]) }, { id: "key", label: "키 · 유효기간", badge: bd(keyBad, "warn"), nodes: pick(["⑥"]) }, { id: "doc", label: "연동 안내", nodes: pick(["④", "⑦"]) }].filter(function (p) { return p.nodes.length; });
  var used = []; panes.forEach(function (p) { used = used.concat(p.nodes); }); var rest = kids.filter(function (k) { return used.indexOf(k) < 0; }); if (rest.length) panes[0].nodes = panes[0].nodes.concat(rest);
  var w = clTabify(box, "data", panes, "sum");
  Array.prototype.forEach.call(box.querySelectorAll('a[href="#dxKeys"]'), function (a) { a.onclick = function (e) { e.preventDefault(); w._go("key"); }; });
}
/* 본질 · 변수 */
function clCore() {
  var box = document.getElementById("coreBody"); if (!box || box.querySelector(".clTabs")) return; var secs = Array.prototype.slice.call(box.querySelectorAll(":scope > section.anSec")); if (secs.length < 2 || typeof CORE === "undefined" || !CORE.ess) return;
  var kids = Array.prototype.slice.call(box.children), top = kids.filter(function (k) { return secs.indexOf(k) < 0; });
  var find = function (re) { return secs.filter(function (s) { var m = s.querySelector(".mkStep"); return m && re.test(m.textContent); }); };
  var s1 = find(/^\s*1\s/), s2 = find(/^\s*2\s/), sx = secs.filter(function (s) { return s.classList.contains("egCore"); }), s3 = secs.filter(function (s) { return s1.indexOf(s) < 0 && s2.indexOf(s) < 0 && sx.indexOf(s) < 0; });
  /* 요약 */
  var E = CORE.ess || [], good = E.filter(function (x) { return x.V && x.V.st === "good"; }), badE = E.filter(function (x) { return x.V && x.V.st === "bad"; }), V = [], FX = null, P = null, J = CORE.ans && CORE.ans.j;
  try { V = coreVars() || []; } catch (e) {} try { var f = coreFx(); if (f) FX = { f: f, v: coreFxVerdict(f) }; } catch (e) {} try { P = typeof egPortfolio === "function" ? egPortfolio() : null; } catch (e) {}
  var on = V.filter(function (v) { return v.on; }), essOk = E.length ? good.length / E.length >= 0.5 : null, quad = essOk == null ? ["자료 읽는 중", ""] : essOk && !on.length ? ["본질 좋음 · 변수 조용", "가장 편한 자리 — 정해 둔 적립을 그대로"] : essOk ? ["본질 좋음 · 변수 켜짐", "흔들리지만 본질은 그대로 — 대응 규칙(분할 · 현금)을 꺼낼 때"] : !on.length ? ["본질 약함 · 변수 조용", "조용할 때 약한 자산부터 점검"] : ["본질 약함 · 변수 켜짐", "가장 조심할 자리 — 늘리기보다 지키기"];
  var h = '<div class="clSum"><div class="clSumHead ' + (essOk && !on.length ? "ok" : essOk ? "mid" : "bad") + '"><small>지금 자리</small><b>' + clEsc(quad[0]) + '</b><span>' + clEsc(quad[1]) + '</span></div><div class="clKs">';
  h += clK("본질 — 우상향 유지", good.length + " / " + E.length, badE.length ? "훼손 의심 " + badE.length + ": " + badE.slice(0, 3).map(function (x) { return clEsc(x.name); }).join(", ") : "훼손 의심 없음", badE.length ? "warn" : "ok", "ess");
  h += clK("변수 — 켜진 것", on.length + "개", on.length ? on.slice(0, 2).map(function (v) { return clEsc(v.name); }).join(" · ") : "지금은 조용해요", on.length ? "bad" : "ok", "var");
  if (FX) h += clK("환율 자리", Math.round(FX.f.now).toLocaleString() + "원", clEsc(FX.v.t || ""), "", "var");
  if (P && P.n) { var st = (P.stress || []).filter(function (s) { return !s.thin; }).sort(function (a, b) { return a.loss - b.loss; })[0], fl = (P.flags || []).filter(function (x) { return x.lv !== "good"; }); h += clK("내 자산 — 최악 재현", st ? (st.loss * 100).toFixed(0) + "%" : "-", st ? clEsc(st.name) + "이 다시 오면" + (fl.length ? " · 쏠림 주의 " + fl.length : "") : "보유 종목 자료 부족", st && st.loss <= -0.35 ? "bad" : "", "fwd"); }
  else h += clK("내 자산", "미입력", "보유 종목을 넣으면 방어 점검이 나와요", "", "fwd");
  if (J && J.essence) h += clK("Claude 판정 (" + clEsc(String(CORE.ans.day || "").slice(5)) + ")", clEsc(J.essence.verdict || "-") + (J.essence.score != null ? " · " + J.essence.score : ""), clEsc(J.essence.one || ""), /훼손/.test(J.essence.verdict || "") ? "bad" : /주의/.test(J.essence.verdict || "") ? "warn" : "ok", "ai"); else h += clK("Claude 판정", "아직 없음", "프롬프트를 복사해 답을 붙여넣으면 채워져요", "", "ai");
  h += '</div>';
  var worst = E.filter(function (x) { return x.L; }).slice().sort(function (a, b) { return a.L.cur - b.L.cur; }).slice(0, 5);
  if (worst.length) h += '<div class="clSumSub">고점에서 가장 많이 내려와 있는 자산</div><div class="clRows">' + worst.map(function (x) { var c = x.V ? x.V.st : ""; return '<div class="clRow"><b>' + clEsc(x.name) + '</b><span class="dn">' + (x.L.cur * 100).toFixed(0) + '%</span><em class="' + (c === "good" ? "ok" : c === "bad" ? "bad" : "mid") + '">' + clEsc(x.V ? x.V.t : "-") + '</em></div>'; }).join("") + '</div>';
  if (on.length) h += '<div class="clSumSub">켜진 변수와 대응</div><div class="clRows">' + on.slice(0, 4).map(function (v) { return '<div class="clRow v"><b>' + clEsc((v.icon || "") + " " + v.name) + '</b><span>' + clEsc(v.now || "") + '</span><em>' + clEsc((v.resp || "").slice(0, 70)) + '</em></div>'; }).join("") + '</div>';
  h += '</div>';
  var panes = [{ id: "sum", label: "요약", html: h, nodes: [] }, { id: "ess", label: "본질", nodes: s1 }, { id: "var", label: "변수", badge: on.length ? '<i class="bad">' + on.length + '</i>' : '', nodes: s2 }, { id: "fwd", label: "예측 · 방어", nodes: sx }, { id: "ai", label: "Claude 분석", badge: J ? '<i class="ok">✓</i>' : '', nodes: s3 }, { id: "how", label: "읽는 법", nodes: top }].filter(function (p) { return p.html || p.nodes.length; });
  clTabify(box, "core", panes, "sum");
}

/* v13.20 작업실: 맨 위에 오늘 요약 한 줄(진행 · 데이터 · 만든 것 · 첫 이슈), 아래는 '할 일 4단계 / 모닝 노트' 탭 */
function clOps() {
  var box = document.getElementById("opsBody"); if (!box || box.querySelector(".clTabs")) return; var rail = box.querySelector(":scope > .opsRail"), board = box.querySelector(":scope > .opsBoard"); if (!rail || !board) return;
  var kids = Array.prototype.slice.call(box.children), ri = kids.indexOf(rail), bh = box.querySelector(":scope > .opsBoardH"), bi = bh ? kids.indexOf(bh) : kids.indexOf(board);
  var stepNodes = kids.slice(ri, bi), noteNodes = kids.slice(bi), steps = Array.prototype.slice.call(rail.querySelectorAll(".opsStep")), done = steps.filter(function (x) { return x.classList.contains("done"); }).length, now = steps.filter(function (x) { return x.classList.contains("now"); })[0];
  var nowT = now ? ((now.querySelector("h3") || {}).textContent || "").trim() : "", h = '<div class="clKs clOpsK">';
  h += clK("오늘 진행", done + " / " + steps.length + " 단계", nowT ? "다음: " + clEsc(nowT) : "오늘 할 일을 모두 끝냈어요", done === steps.length ? "ok" : "", "todo");
  var Ms = (typeof OPS !== "undefined" && OPS.Ms) || [], NM = { kr: "국내", us: "미국", coin: "코인" }, badM = Ms.filter(function (m) { return m.level !== "ok"; });
  if (Ms.length) h += clK("데이터", badM.length ? "확인 " + badM.length + "곳" : "모두 정상", Ms.map(function (m) { return NM[m.mk] + " " + (typeof dhMD === "function" && m.date ? dhMD(m.date) : "-") + (m.level === "ok" ? "" : " ⚠"); }).join(" · "), badM.length ? "warn" : "ok", "todo");
  var iss = (typeof briefState !== "undefined" && briefState.issues) || [], R = typeof briefState !== "undefined" ? briefState.result : null;
  if (R && R.temp && !R.temp.empty && R.temp.word && R.temp.total > 0 && !(R.marketWideOff) && !clOpsOff()) h += clK("시장 온도", clEsc(R.temp.word || "-"), "오른 종목 " + Math.round((R.temp.upPct || 0) * 100) + "%" + (R.temp.total ? " · " + R.temp.up + "/" + R.temp.total : ""), "", "note");
  if (iss.length) h += clK("핵심 이슈 " + iss.length, clEsc(String(iss[0].title || "").slice(0, 22)), clEsc(iss[0].sub || ""), "", "note");
  var made = Array.prototype.slice.call(board.querySelectorAll(".opsMade b, .opsPanel .opsTiles .opsTile")).slice(-3), mt = []; made.forEach(function (t) { var b = t.querySelector ? t.querySelector("b") : null, l = t.querySelector ? t.querySelector("span") : null; if (b && l && /카드|리포트|분석/.test(l.textContent)) mt.push(l.textContent.trim().replace(/ 저장$/, "") + " " + b.textContent.trim()); });
  if (mt.length) h += clK("오늘 만든 것", mt.map(function (x) { return x.replace(/^\D+/, ""); }).join(" · "), mt.map(function (x) { return x.replace(/\s*\d+$/, ""); }).join(" · "), "", "note");
  h += '</div>';
  var sum = document.createElement("div"); sum.innerHTML = h; var strip = sum.firstChild; box.insertBefore(strip, rail);
  var w = clTabify(box, "ops", [{ id: "todo", label: "오늘 할 일", badge: done < steps.length ? '<i class="warn">' + (steps.length - done) + '</i>' : '<i class="ok">✓</i>', nodes: stepNodes }, { id: "note", label: "모닝 노트", nodes: noteNodes }], "todo");
  Array.prototype.forEach.call(strip.querySelectorAll("[data-cltab]"), function (b) { b.onclick = function () { w._go(b.getAttribute("data-cltab")); }; });
}
/* v13.20 오늘의 브리핑: 3초 요약은 그대로 맨 위, 아래는 주제별 탭 */
function clBrief() {
  var box = document.getElementById("briefBody"); if (!box || box.classList.contains("hidden") || box.querySelector(".clTabs")) return; var cols = box.querySelector(":scope > .bCols"), hero = document.getElementById("briefHero"); if (!cols || !hero || !cols.children.length) return;
  var titleOf = function (el) { var h = el.querySelector("h3, .briefSecT, .slKick, .brAiHead b, .issH"); if (!h) return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 14); var c = h.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll("small,button,span.briefDim,.clI"), function (x) { x.remove(); }); return c.textContent.replace(/\s+/g, " ").trim().slice(0, 24); };
  var G = { iss: [], mkt: [], thm: [], money: [] }, lastKey = "mkt";
  Array.prototype.slice.call(cols.children).forEach(function (el) {
    if (el.classList.contains("snapRow") || !el.classList.contains("briefSec")) { G[lastKey].push(el); return; }
    var t = titleOf(el), k = el.id === "briefTop5" || /핵심 이슈/.test(t) ? "iss" : /세일|돈이 몰린|인기/.test(t) ? "money" : /테마|업종|급등|급락/.test(t) ? "thm" : "mkt"; lastKey = k; G[k].push(el);
  });
  var top = Array.prototype.slice.call(box.children).filter(function (el) { return el !== cols; }), heroIdx = top.indexOf(hero), sel = document.getElementById("briefSelectSec"), selNodes = [];
  if (sel) { selNodes.push(sel); var nx = sel.nextElementSibling; if (nx && nx.classList.contains("snapRow")) selNodes.push(nx); }
  var wrapCols = function (nodes) { if (!nodes.length) return []; var d = document.createElement("div"); d.className = "bCols clBCols" + (nodes.filter(function (n) { return n.classList.contains("briefSec"); }).length <= 1 ? " one" : ""); nodes.forEach(function (n) { d.appendChild(n); }); return [d]; };
  var nIss = (typeof briefState !== "undefined" && briefState.issues ? briefState.issues.length : 0);
  var panes = [{ id: "iss", label: "핵심 이슈", badge: nIss ? '<i>' + nIss + '</i>' : '', nodes: wrapCols(G.iss) }, { id: "pick", label: "선별 종목", nodes: selNodes }, { id: "mkt", label: "시장 체력 · 지수", nodes: wrapCols(G.mkt) }, { id: "thm", label: "테마 · 급등락", nodes: wrapCols(G.thm) }, { id: "money", label: "돈이 몰린 곳 · 세일", nodes: wrapCols(G.money) }].filter(function (p) { return p.nodes.length; });
  if (panes.length < 2) { panes.forEach(function (p) { p.nodes.forEach(function (n) { box.appendChild(n); }); }); return; }
  cols.classList.add("clHid");
  var w = clTabify(box, "brief", panes, "iss");
  /* 3초 요약의 바로가기 버튼 → 해당 탭을 먼저 연다 */
  Array.prototype.forEach.call(hero.querySelectorAll(".slNav button, .slNav a"), function (b) { if (b._cl) return; b._cl = 1; b.addEventListener("click", function () { var t = b.textContent; w._go(/업종|테마|급등/.test(t) ? "thm" : /돈/.test(t) ? "money" : /숫자|지수|체력/.test(t) ? "mkt" : "iss"); }, true); });
}
/* v13.20 분석: 5~8번(결과 요약 · 분석 자산 · 보정 · 회고)은 한 줄 탭으로 */
function clAnalyst() {
  var root = document.getElementById("anBody"); if (!root || root.querySelector(".clTabs[data-clk=anres]")) return; var secs = Array.prototype.slice.call(root.querySelectorAll(":scope > section.anSec, :scope > .anSec")); if (secs.length < 7) return;
  var tail = secs.filter(function (x) { var m = x.querySelector(":scope > .mkStep > b"); return m && +m.textContent >= 5; }); if (tail.length < 3) return;
  var host = document.createElement("section"); host.className = "anSec clAnRes"; tail[0].parentNode.insertBefore(host, tail[0]);
  var hasAns = false; try { hasAns = typeof anAnsLoad === "function" && anAnsLoad().some(function (a) { return a.sym === AN.sym; }); } catch (e) {}
  var panes = tail.map(function (x, i) { var m = x.querySelector(":scope > .mkStep"), c = m.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll("small,button,label,input,.clI"), function (y) { y.remove(); }); var no = (c.querySelector("b") || {}).textContent || "", t = c.textContent.replace(no, "").trim(); return { id: "s" + no, label: no + " " + t, badge: i === 0 && hasAns ? '<i class="ok">✓</i>' : '', nodes: [x] }; });
  clTabify(host, "anres", panes, hasAns ? panes[0].id : panes[0].id);
}
/* 카드 작업대: '오늘 카드' 목록은 앞 두 묶음만 보이고 나머지는 접는다(고른 주제가 있는 묶음 · 검색 중에는 펼침) */
function clMaker() {
  var grid = document.querySelector("#tab-onecard .wbGrid"); if (!grid || grid.getAttribute("data-clm")) return; var rows = Array.prototype.slice.call(grid.children), ci = -1;
  rows.forEach(function (r, i) { if (r.classList.contains("uxCatH") && r.classList.contains("card")) ci = i; }); if (ci < 0) return; grid.setAttribute("data-clm", "1");
  var q = document.querySelector("#tab-onecard .wbQ"), searching = q && q.value.trim().length > 0, cat = rows.slice(ci + 1), hid = [];
  cat.forEach(function (r, i) { if (i >= 2 && !r.querySelector(".wbChip.on") && !searching && !CL.mkOpen) { r.classList.add("clHid"); hid.push(r); } });
  if (!hid.length && !CL.mkOpen) return;
  var n = hid.reduce(function (a, r) { return a + r.querySelectorAll(".wbChip").length; }, 0), b = document.createElement("button"); b.type = "button"; b.className = "clMore";
  b.textContent = CL.mkOpen ? "묶음 접기 ▲" : "나머지 " + hid.length + "개 묶음 · 주제 " + n + "개 펼치기 ▼"; b.onclick = function () { CL.mkOpen = !CL.mkOpen; cat.forEach(function (r) { r.classList.remove("clHid"); }); grid.removeAttribute("data-clm"); b.remove(); clMaker(); };
  grid.appendChild(b);
}
/* ---------- 실행: 그려진 뒤 정리 ---------- */
function clRun() {
  if (!CL.on) return; var root = null;
  try { var cur = typeof currentTab !== "undefined" ? currentTab : ""; root = document.getElementById("tab-" + cur) || document.body; } catch (e) { root = document.body; }
  try { clData(); } catch (e) { console.warn("cl data", e); }
  try { clCore(); } catch (e) { console.warn("cl core", e); }
  try { clMaker(); } catch (e) { console.warn("cl maker", e); }
  try { clOps(); } catch (e) { console.warn("cl ops", e); }
  try { clBrief(); } catch (e) { console.warn("cl brief", e); }
  try { clAnalyst(); } catch (e) { console.warn("cl analyst", e); }
  try { clTables(); } catch (e) { console.warn("cl tables", e); }
  try { clCollapse(root); } catch (e) { console.warn("cl collapse", e); }
  try { clTerms(root); } catch (e) { console.warn("cl terms", e); }
  try { clFab(); } catch (e) {}
}
(function () {
  var t = null, kick = function () { clearTimeout(t); t = setTimeout(clRun, 180); };
  var start = function () { try { new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var tg = ms[i].target; if (tg && tg.closest && tg.closest("#clPop,#clDrawer")) continue; kick(); return; } }).observe(document.body, { childList: true, subtree: true }); } catch (e) {} kick(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  var st = document.createElement("style"); st.id = "clCss"; st.textContent = [
    ".clHid{display:none!important}",
    ".clOpsK{margin:10px 0 14px}.clOpsK>*{min-width:0;overflow:hidden}.clOpsK>* b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.clOpsK>:last-child:nth-child(odd){grid-column:1/-1}.clOpsK .clK b{font-size:17px}.opsRail .opsStep{min-height:0}.clBCols{margin-top:0}.clBCols.one{display:block!important;columns:auto!important;column-count:1!important}.clBCols.one>.briefSec{width:auto!important;max-width:none!important}.clAnRes{border-top:0!important;padding-top:0!important}.clAnRes .clPane>.anSec{border-top:0;padding-top:0;margin-top:0}.clAnRes .clPane>.anSec>.mkStep>b{display:none}",
    ".clMore{font:inherit;font-size:12.5px;font-weight:700;display:block;width:100%;margin-top:8px;padding:9px;border:1px dashed #cfd6e0;border-radius:8px;background:#fafbfc;color:#1a56c4;cursor:pointer;box-shadow:none}.clMore:hover{border-color:#3182f6;background:#f0f5ff}",
    "html.adm .chip,html.adm .wbChip{border-radius:8px}",
    "#smGuide{display:none!important}.clPane[data-clpane=sum]>h3.dhH{display:none}.anChips span.chip.on{display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:7px 12px;background:#1b2230;color:#fff;font-weight:700;font-size:13px}.anChips span.chip.on small{color:#c9d2e0;font-weight:500}",
    ".clI{font:inherit;display:inline-flex;align-items:center;gap:6px;vertical-align:middle;border:0;background:none;padding:0 2px;margin:0 0 0 6px;cursor:help;color:#6b7686;box-shadow:none;border-radius:6px;min-height:0;line-height:1}.clI i{font-style:normal;font-weight:800;font-size:11px;width:17px;height:17px;border-radius:50%;border:1.5px solid #9aa5b5;color:#6b7686;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif;flex:none;background:#fff}.clI:hover i,.clI:focus-visible i{border-color:#3182f6;color:#3182f6}.clI:focus-visible{outline:2px solid #3182f6;outline-offset:2px}.clI.lab span{font-size:12px;font-weight:600;color:#6b7686}.clI.lab:hover span{color:#3182f6;text-decoration:underline}",
    ".clLine{margin:6px 0;line-height:1.2}.clLine .clI{margin-left:0}.clLine.warn .clI span{color:#b9600f}.clLine.warn .clI i{border-color:#d99a4a;color:#b9600f}",
    ".clT{display:inline!important;border-bottom:1px dotted #8a93a3;cursor:help;font:inherit!important;color:inherit!important;margin:0!important}.clT:focus-visible{outline:2px solid #3182f6;outline-offset:2px;border-radius:3px}",
    "#clPop{position:absolute;z-index:9000;max-width:380px;min-width:200px;background:#1b2230;color:#eef1f6;border-radius:12px;padding:12px 14px;font-size:12.5px;line-height:1.6;box-shadow:0 10px 30px rgba(0,0,0,.28)}#clPop>b{display:block;font-size:13px;margin-bottom:4px;color:#fff}#clPop p{margin:0}#clPop .clBody{max-height:46vh;overflow:auto}#clPop .clBody b{color:#ffd98a}#clPop .clBody a{color:#9db8ff}#clPop .clBody button{display:none}#clPop .clBody br+br{display:none}",
    "#clFab{position:fixed;right:18px;bottom:18px;z-index:800;width:44px;height:44px;border-radius:50%;border:1px solid #d5dbe5;background:#fff;color:#1f3a68;font-size:20px;font-weight:900;cursor:pointer;box-shadow:0 4px 14px rgba(20,30,50,.16);padding:0}#clFab:hover{border-color:#3182f6;color:#3182f6}",
    "#clDrawer{position:fixed;right:0;top:0;bottom:0;width:min(400px,92vw);z-index:8500;background:#fff;border-left:1px solid #e3e7ee;box-shadow:-10px 0 30px rgba(20,30,50,.12);display:flex;flex-direction:column}#clDrawer[hidden]{display:none}.clDH{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 8px}.clDH b{font-size:16px}.clDH button{border:0;background:none;font-size:22px;cursor:pointer;color:#6b7686;padding:0 4px;box-shadow:none}.clDT{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid #e9edf2}.clDT button{font:inherit;font-size:13px;font-weight:700;border:0;background:none;padding:8px 12px;color:#6b7686;cursor:pointer;border-bottom:3px solid transparent;border-radius:0;box-shadow:none}.clDT button.on{color:#111;border-bottom-color:#3182f6}.clDB{padding:12px 16px 24px;overflow:auto;flex:1;font-size:13px;line-height:1.65}.clDG{background:#f3f7ff;border-radius:12px;padding:10px 14px;margin-bottom:10px}.clDG ol{margin:6px 0 0;padding-left:18px}.clDS{font-size:12px;font-weight:800;color:#6b7686;margin:12px 0 6px}.clDN{border-top:1px solid #eef1f5;padding:8px 0}.clDN summary{cursor:pointer;font-weight:700}.clDN .clBody{margin-top:6px;color:#334}.clDN .clBody+.clBody{border-top:1px dashed #e3e7ee;padding-top:6px}.clDN .clBody button{display:none}#clQ{width:100%;font:inherit;font-size:13px;padding:8px 10px;border:1px solid #cfd6e0;border-radius:8px;margin-bottom:8px;box-sizing:border-box}.clTI{border-top:1px solid #eef1f5;padding:8px 0}.clTI p{margin:2px 0 0;color:#445}",
    ".clTabBar{display:flex;gap:2px;flex-wrap:wrap;border-bottom:2px solid #e6eaf0;margin:0 0 14px;position:sticky;top:0;background:var(--admBg,#f4f5f7);z-index:5;padding-top:6px}.clTabBar button{font:inherit;font-size:13.5px;font-weight:700;border:0;background:none;padding:9px 14px;border-radius:10px 10px 0 0;color:#6b7686;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;box-shadow:none}.clTabBar button:hover{color:#1f3a68}.clTabBar button.on{color:#111;border-bottom-color:#3182f6;background:#fff}.clTabBar i{font-style:normal;font-size:11px;font-weight:800;border-radius:999px;padding:1px 6px;margin-left:5px;background:#eef8f2;color:#1d7f55}.clTabBar i.bad{background:#fcefef;color:#c03b3b}.clTabBar i.warn{background:#fff6e8;color:#b9600f}.clPane>h3.dhH:first-child{margin-top:0}.clPane>section.anSec:first-child{margin-top:0}",
    ".clSum{background:#fff;border:1px solid #e3e7ee;border-radius:14px;padding:16px 18px}.clSumHead{border-radius:12px;padding:12px 16px;background:#eef8f2;border-left:5px solid #1d7f55}.clSumHead.mid{background:#fff6e8;border-color:#b9600f}.clSumHead.bad{background:#fcefef;border-color:#c03b3b}.clSumHead small{display:block;font-size:11.5px;font-weight:800;color:#6b7686}.clSumHead b{font-size:19px;font-weight:900}.clSumHead span{display:block;font-size:13px;color:#445;margin-top:2px}",
    ".clKs{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:12px 0 4px}.clK{font:inherit;text-align:left;border:1px solid #e6eaf0;background:#f8f9fb;border-radius:12px;padding:10px 12px;cursor:pointer;border-left:4px solid #b9c2d0;box-shadow:none}.clK:hover{background:#f0f5ff}.clK small{display:block;font-size:11px;font-weight:700;color:#6b7686}.clK b{display:block;font-size:19px;font-weight:900;line-height:1.25;color:#111}.clK span{display:block;font-size:11.5px;color:#6b7686;line-height:1.4;margin-top:1px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.clK.ok{border-left-color:#1d7f55}.clK.bad{border-left-color:#c03b3b}.clK.bad b{color:#c03b3b}.clK.warn{border-left-color:#b9600f}.clK.warn b{color:#b9600f}",
    ".clSumSub{font-size:12px;font-weight:800;color:#6b7686;margin:14px 0 6px}.clRows{display:grid;gap:4px}.clRow{display:grid;grid-template-columns:minmax(120px,200px) 70px 1fr;gap:10px;align-items:baseline;font-size:13px;padding:6px 10px;background:#f8f9fb;border-radius:8px}.clRow.v{grid-template-columns:minmax(140px,230px) minmax(120px,220px) 1fr}.clRow span.dn{color:#1f5fbf;font-weight:800;text-align:right}.clRow em{font-style:normal;font-size:12px;color:#556}.clRow em.ok{color:#1d7f55}.clRow em.bad{color:#c03b3b}.clRow em.mid{color:#b9600f}",
    "@media(max-width:640px){#clFab{right:12px;bottom:76px;width:40px;height:40px}.clTabBar button{padding:8px 9px;font-size:12.5px}.clKs{grid-template-columns:repeat(2,minmax(0,1fr))}.clK{min-width:0}.clRow,.clRow.v{grid-template-columns:1fr auto}.clRow em{grid-column:1/-1}#clPop{max-width:calc(100vw - 16px)}}",
    "[data-theme=dark] .clI i{background:#161b24;border-color:#5a6578;color:#aab}[data-theme=dark] #clFab,[data-theme=dark] #clDrawer,[data-theme=dark] .clSum{background:#161b24;border-color:#263041;color:#dde}[data-theme=dark] .clDG,[data-theme=dark] .clK,[data-theme=dark] .clRow{background:#1e2533;border-color:#263041}[data-theme=dark] .clK b,[data-theme=dark] .clDT button.on,[data-theme=dark] .clTabBar button.on{color:#eee}[data-theme=dark] .clTabBar{background:#0f131a;border-color:#263041}[data-theme=dark] .clTabBar button.on{background:#161b24}[data-theme=dark] .clSumHead{background:#16261e;color:#dde}[data-theme=dark] .clSumHead.mid{background:#2a2114}[data-theme=dark] .clSumHead.bad{background:#2a1717}[data-theme=dark] .clSumHead span,[data-theme=dark] .clTI p,[data-theme=dark] .clDN .clBody{color:#ccd}",
    "@media print{#clFab,#clDrawer,#clPop{display:none!important}.clHid{display:block!important}}"
  ].join(""); document.head.appendChild(st);
})();

/* 작업실: 국내·미국 중 하나라도 '전체 시장 숫자 숨김' 상태면 요약 칸에도 시장 온도를 올리지 않는다 */
function clOpsOff() { try { var Ms = typeof OPS !== "undefined" && OPS.Ms; if (!Ms) return false; var a = Array.isArray(Ms) ? Ms : Object.keys(Ms).map(function (k) { return Ms[k]; }); return a.some(function (M) { return M && M.mk !== "coin" && M.off; }); } catch (e) { return false; } }

/* ============================================================
   v13.21 좁은 화면(휴대폰)에서 표가 글자 단위로 꺾이던 문제
   · 칸이 3개 이상인 표(.dgT)는 휴대폰에서 '한 줄 = 카드 한 장'으로 바꿔 보여 준다 (칸 이름은 왼쪽에 작게)
   · 오늘의 후보(스캔) 표는 전용 카드: 이름 + 종합 → 점수 4칸 → 200주선 · 회복 · 기록 → 한 줄 판정
   ============================================================ */
function clTables() {
  var ts = document.querySelectorAll("table.dgT");
  for (var i = 0; i < ts.length; i++) {
    var t = ts[i]; if (t.classList.contains("egScanT")) { clScanMore(t); continue; }
    var hs = t.tHead && t.tHead.rows[0] ? t.tHead.rows[0].cells : null; if (!hs || hs.length < 3) continue;
    var rows = t.tBodies[0] ? t.tBodies[0].rows : []; if (t._cln === rows.length && t.classList.contains("clRT") && (!rows.length || rows[rows.length - 1]._cl)) continue;
    var lab = []; for (var k = 0; k < hs.length; k++) lab.push((hs[k].textContent || "").replace(/\s+/g, " ").trim());
    for (var r = 0; r < rows.length; r++) {
      var cs = rows[r].cells, col = 0; rows[r]._cl = 1;
      for (var c = 0; c < cs.length; c++) { var sp = cs[c].colSpan || 1; if (sp === 1 && lab[col] && col > 0 && cs[c].getAttribute("data-l") !== lab[col]) cs[c].setAttribute("data-l", lab[col]); if (sp > 1) cs[c].classList.add("clSpan"); if (/^[-–—]?$/.test((cs[c].textContent || "").trim()) && c > 0 && !cs[c].querySelector("input,button,select,img,svg")) cs[c].classList.add("clNil"); else cs[c].classList.remove("clNil"); col += sp; }
    }
    t._cln = rows.length; if (!t.classList.contains("clRT")) t.classList.add("clRT");
  }
}
/* 스캔 목록: 휴대폰에서는 15개만 먼저, 나머지는 '더 보기' */
function clScanMore(t) {
  var w = t.closest(".egScanW"); if (!w || w._clMore) return; w._clMore = 1;
  var n = t.tBodies[0] ? t.tBodies[0].rows.length : 0; if (n <= 15) return;
  var b = document.createElement("button"); b.type = "button"; b.className = "clScanMore"; b.textContent = "나머지 " + (n - 15) + "개 더 보기";
  b.onclick = function () { w.classList.add("clAll"); b.remove(); };
  w.insertAdjacentElement("afterend", b);
}
(function () {
  if (typeof document === "undefined" || document.getElementById("clCss2")) return;
  var st = document.createElement("style"); st.id = "clCss2"; st.textContent = [
    ".clScanMore{display:none}",
    "@media(max-width:720px){",
    /* 일반 표 → 카드 */
    ".dxWrap:has(>table.clRT),.tableWrap:has(>table.clRT){overflow:visible;max-height:none;border:0;background:transparent}",
    "table.clRT{display:block;width:100%;min-width:0!important;table-layout:auto;border:0}table.clRT thead{display:none}table.clRT tbody{display:block}",
    "table.clRT tr{display:block;padding:11px 12px;margin:0 0 8px;border:1px solid var(--admLine,#e3e7ee);border-radius:12px;background:var(--admCard,#fff)}",
    "table.clRT td{display:block;position:relative;border:0!important;padding:3px 0 3px 92px!important;min-height:22px;width:auto!important;min-width:0!important;max-width:none!important;text-align:left!important;white-space:normal!important;word-break:keep-all;overflow-wrap:anywhere;font-size:13px;line-height:1.5;background:transparent!important}",
    "table.clRT td[data-l]::before{content:attr(data-l);position:absolute;left:0;top:4px;width:84px;font-size:11.5px;font-weight:700;color:#7a8494;line-height:1.35;word-break:keep-all}",
    "table.clRT td:not([data-l]){padding-left:0!important}table.clRT td:first-child{font-size:14.5px;font-weight:800;padding-bottom:6px!important}table.clRT td.clNil{display:none}",
    "table.clRT tr.dxBad{border-color:#f0b8b8;background:#fff8f8}",
    /* 스캔 표 → 전용 카드 */
    ".egScanW{overflow:visible!important;max-height:none!important;border:0!important;background:transparent!important}",
    "table.egScanT{display:block;width:100%;border:0;counter-reset:sc}table.egScanT thead{display:none}table.egScanT tbody{display:block}",
    "table.egScanT tr{counter-increment:sc;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;padding:12px;margin:0 0 8px;border:1px solid var(--admLine,#e3e7ee);border-radius:12px;background:var(--admCard,#fff)}",
    ".egScanW:not(.clAll) table.egScanT tr:nth-child(n+16){display:none}.clScanMore{display:block;width:100%;padding:11px;border:1px solid var(--admLine,#e3e7ee);border-radius:10px;background:var(--admCard,#fff);font-weight:700;font-size:13px;color:#3182f6;cursor:pointer}",
    "table.egScanT td{display:block;border:0!important;padding:0!important;min-width:0!important;white-space:normal!important;word-break:keep-all;overflow-wrap:normal;background:transparent!important;text-align:center;line-height:1.3}",
    "table.egScanT td:nth-child(1){display:none}",
    "table.egScanT td:nth-child(2){grid-column:1/10;text-align:left;font-size:14.5px;overflow-wrap:anywhere}table.egScanT td:nth-child(2)>b::before{content:counter(sc) \". \";color:#8a93a3;font-weight:700}table.egScanT td:nth-child(2) small{font-size:11.5px}",
    "table.egScanT td:nth-child(3){grid-column:10/13;text-align:right}table.egScanT td:nth-child(3) b{font-size:26px;font-weight:900;line-height:1}table.egScanT td:nth-child(3)::after{content:\"종합\";display:block;font-size:10.5px;color:#7a8494;font-weight:700;margin-top:2px}",
    "table.egScanT td:nth-child(n+4):nth-child(-n+10){background:#f5f7fa!important;border-radius:8px;padding:6px 2px 7px!important;font-size:12px}table.egScanT td:nth-child(n+4):nth-child(-n+10)::before{display:block;font-size:10.5px;color:#7a8494;font-weight:700;margin-bottom:3px}",
    "table.egScanT td:nth-child(n+4):nth-child(-n+7){grid-column:span 3}table.egScanT td:nth-child(n+4):nth-child(-n+7) b{font-size:16px}table.egScanT td:nth-child(n+4):nth-child(-n+7) br{display:none}table.egScanT td:nth-child(n+4):nth-child(-n+7) small{display:block;font-size:10.5px;margin-top:1px}",
    "table.egScanT td:nth-child(n+8):nth-child(-n+10){grid-column:span 4}table.egScanT td:nth-child(n+8):nth-child(-n+10) b{font-size:13.5px}",
    "table.egScanT td:nth-child(4)::before{content:\"체력\"}table.egScanT td:nth-child(5)::before{content:\"싼 정도\"}table.egScanT td:nth-child(6)::before{content:\"흐름\"}table.egScanT td:nth-child(7)::before{content:\"낙폭 / 최대\"}table.egScanT td:nth-child(8)::before{content:\"200주선 대비\"}table.egScanT td:nth-child(9)::before{content:\"큰 하락 회복\"}table.egScanT td:nth-child(10)::before{content:\"기록\"}",
    "table.egScanT td:nth-child(11){grid-column:1/-1;text-align:left;font-size:12.5px;line-height:1.5;min-width:0!important;color:#445}",
    "table.egScanT .egTg{white-space:nowrap}",
    ".egFl button span{white-space:normal;overflow:visible;text-overflow:clip;line-height:1.3;word-break:keep-all}.egFl button{padding:8px 9px;font-size:12.5px}",
    ".egLg>div{padding-left:0!important;text-indent:0!important}.egLg>div>b:first-child{display:block!important;width:auto!important;margin:0 0 2px!important}",
    ".coreVars,.coreIss{grid-template-columns:minmax(0,1fr)!important}.coreVar,.coreIssC{min-width:0}.clRow,.clRow.v{grid-template-columns:minmax(0,1fr) auto!important}.clRow>*{min-width:0;overflow-wrap:anywhere}.clRow.v{grid-template-columns:minmax(0,1fr)!important}",
    ".wbShapeRow{grid-template-columns:52px minmax(0,1fr)}.wbShapeRow>div{min-width:0;flex-wrap:wrap}.wbOpt{min-width:0;max-width:100%}.wbTodayH small{flex:1 1 140px;min-width:0}table.clRT td>*{max-width:100%}table.clRT .dgNo{white-space:normal}",
    /* 홈 시작 카드가 화면 밖으로 밀리던 것 */
    ".startCards{grid-template-columns:minmax(0,1fr)!important}.startCard{min-width:0;max-width:100%}",
    "}",
    "@media(max-width:720px){[data-theme=dark] table.clRT tr,[data-theme=dark] table.egScanT tr{background:#161b24;border-color:#263041}[data-theme=dark] table.egScanT td:nth-child(n+4):nth-child(-n+10){background:#1e2533!important}[data-theme=dark] table.clRT tr.dxBad{background:#2a1a1a;border-color:#5a2a2a}[data-theme=dark] table.egScanT td:nth-child(11){color:#aab}}"
  ].join("");
  document.head.appendChild(st);
})();
