/* ============================================================
   카드 만들기 (v10.5) — 흩어져 있던 카드 만들기를 한 화면에
   ① 한 장 양식: 시장 → 양식(9종) → 내용(앱 데이터 | 직접 입력) → 오른쪽 실시간 미리보기 → 저장 / ✨ AI
      '고쳐 쓰기'를 누르면 앱 데이터가 입력칸 글로 바뀌어 그대로 고칠 수 있다 (글 ↔ 양식 명세 변환기 MK_FMT)
   ② 카드 묶음(여러 장): 오늘의 브리핑·오늘 한 장·채널·정기 발행·연구노트·정책·일정·용어·릴스를 버튼 하나로
   ============================================================ */
var MK = { mk: null, cat: "rank", src: null, mode: "app", text: {}, meta: {}, url: null, timer: null, tab: "work", sel: null, filt: "today", q: "", size: (function () { try { return localStorage.getItem("sm.cardSize") || "post"; } catch (e) { return "post"; } })() };   // v12.21 size: post(1080×1350) | reel(1080×1920)
var MK_TABS = [["work", "작업대"], ["one", "직접 쓰기"], ["lib", "보관함"]];   // v12.1 오늘 할 일 + 묶음 카드 → 작업대(① 상태 ② 주제 ③ 만들기 ④ 결과)
/* 다른 화면에서 '카드 만들기 ›'로 들어올 때: 탭·시장을 정해서 연다 */
function makerGo(tab, mk) { if (tab) MK.tab = tab; if (mk) MK.mk = mk; if (typeof navTo === "function") navTo("onecard"); else switchTab("onecard"); }
function mkLoad() { try { var j = JSON.parse(localStorage.getItem("sm.maker") || "null"); if (j) { MK.text = j.text || {}; MK.meta = j.meta || {}; MK.cat = j.cat || MK.cat; MK.mode = j.mode || MK.mode; } } catch (e) {} }
function mkSave() { try { localStorage.setItem("sm.maker", JSON.stringify({ text: MK.text, meta: MK.meta, cat: MK.cat, mode: MK.mode })); } catch (e) {} }
function mkSplit(l) { return String(l).split("|").map(function (x) { return x.trim(); }); }
function mkLines(t) { return String(t || "").split(/\r?\n/).map(function (x) { return x.replace(/\s+$/, ""); }).filter(function (x) { return x.trim(); }); }

/* ---------- 글 ↔ 명세 ---------- */
var MK_FMT = {
  rank: { help: "한 줄에 하나: 이름 | 숫자 | 꼬리표(선택) — 최대 12줄", ex: "엔비디아 | +32.5% | 하루 +2.1%\n브로드컴 | +28.1% | 하루 +1.4%\n마이크론 | +25.0% | 하루 -0.8%\nTSMC | +18.2% | 하루 +0.5%",
    to: function (s) { return (s.items || []).map(function (x) { return [x.name, x.value, x.tag || ""].join(" | "); }).join("\n"); },
    from: function (t) { return { items: mkLines(t).slice(0, 12).map(function (l, i) { var a = mkSplit(l); return { rank: i + 1, name: a[0], value: a[1] || "", tag: a[2] || "" }; }) }; } },
  table: { help: "첫 줄 = 머리줄(칸 이름을 | 로), 다음 줄부터 행 — 최대 10행 · ※로 시작하면 아래 메모", ex: "구분 | 디딤돌 | 보금자리론\n대상 | 무주택 세대주 | 무주택·1주택\n소득 | 6천만원 이하 | 7천만원 이하\n최대 한도 | 2.5억 | 3.6억\n※ 조건은 신청 시점 공고 기준",
    to: function (s) { return [(s.cols || []).join(" | ")].concat((s.rows || []).map(function (r) { return r.join(" | "); })).concat(s.note ? ["※ " + s.note] : []).join("\n"); },
    from: function (t) { var L = mkLines(t), note = ""; L = L.filter(function (l) { if (/^※/.test(l.trim())) { note = l.trim().replace(/^※\s*/, ""); return false; } return true; }); var cols = L.length ? mkSplit(L[0]) : []; return { cols: cols, rows: L.slice(1, 11).map(function (l) { var a = mkSplit(l); while (a.length < cols.length) a.push(""); return a.slice(0, cols.length); }), hlCols: cols.length > 1 ? [1] : [], note: note }; } },
  compare: { help: "첫 줄 @ 왼쪽 이름 | 오른쪽 이름, 다음 줄부터: 이름 | 그때 값 | 지금 값 | 변화(선택) | 설명(선택) — 최대 4줄", ex: "@ 작년 | 올해\n창동주공 19평 | 4.4억 | 6.1억 | +39% | 2025.1 → 2026.10\n성원 19평 | 4.7억 | 6.7억 | +43%",
    to: function (s) { return ["@ " + (s.aLabel || "그때") + " | " + (s.bLabel || "지금")].concat((s.rows || []).map(function (r) { return [r.badge, r.a, r.b, r.pct || "", r.name || ""].join(" | "); })).join("\n"); },
    from: function (t) { var L = mkLines(t), a = "그때", b = "지금"; if (L[0] && /^@/.test(L[0].trim())) { var h = mkSplit(L.shift().trim().replace(/^@\s*/, "")); a = h[0] || a; b = h[1] || b; } return { aLabel: a, bLabel: b, rows: L.slice(0, 4).map(function (l) { var x = mkSplit(l); return { badge: x[0], a: x[1] || "", b: x[2] || "", pct: x[3] || "", name: x[4] || "" }; }) }; } },
  quote: { help: "첫 줄 = 말한 사람 | 역할, # 로 시작 = 숫자 근거(이름 | 값, 최대 6), 나머지 줄 = 요지 문단(최대 3) · 제목에 따옴표 문장", ex: "LH 사장 | 국정감사 발언\n# 나이 | 53세\n# 기술고시 | 32회\n2021년 집값이 정점을 찍은 뒤 고금리 영향으로 많이 내려갔다.\n공급이 확대되면 집값이 안정될 것이다.",
    to: function (s) { var p = s.person || {}; return [(p.name || "") + " | " + (p.role || "")].concat((p.facts || []).map(function (f) { return "# " + f[0] + " | " + f[1]; })).concat(s.paras || []).join("\n"); },
    from: function (t) { var L = mkLines(t), h = mkSplit(L.shift() || ""), facts = [], paras = []; L.forEach(function (l) { if (/^#/.test(l.trim())) { var a = mkSplit(l.trim().replace(/^#\s*/, "")); facts.push([a[0], a[1] || ""]); } else paras.push(l.trim()); }); return { tag: "", person: { name: h[0] || "", role: h[1] || "", facts: facts.slice(0, 6) }, paras: paras.slice(0, 3) }; } },
  timeline: { help: "@ 날짜 | 블록 제목 으로 블록 시작, 아래 줄이 그 블록의 항목(최대 6) · [[ ]] 안은 형광펜 · 블록 최대 4개", ex: "@ 2025 6.27 | 가계부채 관리 강화\n주담대 한도 [[최대 6억]]\n전입 의무 [[6개월]]\n@ 2025 9.7 | 주택공급 확대\n수도권 [[135만 호]] 착공 목표",
    to: function (s) { return (s.blocks || []).map(function (b) { return ["@ " + String(b.date || "").replace(/\n/g, " ") + " | " + (b.title || "")].concat(b.items || []).join("\n"); }).join("\n"); },
    from: function (t) { var bl = [], cur = null; mkLines(t).forEach(function (l) { if (/^@/.test(l.trim())) { var a = mkSplit(l.trim().replace(/^@\s*/, "")); cur = { date: String(a[0] || "").replace(/\s+/, "\n"), title: a[1] || "", items: [] }; bl.push(cur); } else { if (!cur) { cur = { date: "", title: "", items: [] }; bl.push(cur); } cur.items.push(l.trim()); } }); return { blocks: bl.slice(0, 4) }; } },
  grid: { help: "한 줄에 하나: 이름 | 숫자 | 단위(선택) — 최대 12칸 · > 로 시작 = 위 한 줄 설명, ※ = 아래 메모", ex: "> 오늘 시장을 숫자 12개로\n오른 종목 | 51 | %\n신고가 | 30 | 개\n공포지수 | 17.7\n달러/원 | 1,380 | 원",
    to: function (s) { return (s.lead ? ["> " + s.lead] : []).concat((s.boxes || []).map(function (b) { return [b.label, b.value, b.unit || ""].join(" | "); })).concat(s.note ? ["※ " + s.note] : []).join("\n"); },
    from: function (t) { var o = { boxes: [] }; mkLines(t).forEach(function (l) { l = l.trim(); if (/^>/.test(l)) o.lead = l.replace(/^>\s*/, ""); else if (/^※/.test(l)) o.note = l.replace(/^※\s*/, ""); else { var a = mkSplit(l); o.boxes.push({ label: a[0], value: a[1] || "", unit: a[2] || "" }); } }); o.boxes = o.boxes.slice(0, 12); return o; } },
  lines: { help: "한 줄에 하나: 왼쪽 | 오른쪽 | 작은 설명(선택) — 최대 7줄 · ! 왼쪽 | 오른쪽 = 검정 펀치라인, > = 맺음말", ex: "사자니 | 취득세\n살자니 | 종부세 | 종합부동산세\n팔자니 | 양도세\n! 기다리자니 | 아파트값 급등세\n> 결국 어디에 있어도 돈 나가는 건 피할 수 없다",
    to: function (s) { return (s.rows || []).map(function (r) { return [r.left, r.right, r.sub || ""].join(" | "); }).concat(s.punch ? ["! " + s.punch.left + " | " + s.punch.right] : []).concat(s.closing ? ["> " + s.closing] : []).join("\n"); },
    from: function (t) { var o = { rows: [] }; mkLines(t).forEach(function (l) { l = l.trim(); if (/^!/.test(l)) { var p = mkSplit(l.replace(/^!\s*/, "")); o.punch = { left: p[0], right: p[1] || "" }; } else if (/^>/.test(l)) o.closing = l.replace(/^>\s*/, ""); else { var a = mkSplit(l); o.rows.push({ icon: "📌", left: a[0], right: a[1] || "", sub: a[2] || "" }); } }); o.rows = o.rows.slice(0, 7); return o; } },
  market: { help: "# 지수 | 값 | 등락 (2줄) · * 주인공 | 등락 (3줄) · 나머지: 이름 | 등락 (최대 8) · > 맨 아래 띠 문구", ex: "# 나스닥 | 27,245.90 | -0.44%\n# S&P500 | 7,807.24 | -0.06%\n* 마이크론 | -3.88%\n* AMD | -2.28%\n* 인텔 | -3.20%\n엔비디아 | -1.29%\n애플 | +1.29%\n> 혼조 마감",
    to: function (s) { return (s.indexes || []).map(function (i) { return "# " + [i.name, i.val, i.pct].join(" | "); }).concat((s.features || []).map(function (f) { return "* " + f.name + " | " + f.pct; })).concat((s.chips || []).map(function (c) { return c.name + " | " + c.pct; })).concat(s.foot ? ["> " + s.foot] : []).join("\n"); },
    from: function (t) { var o = { indexes: [], features: [], chips: [] }; mkLines(t).forEach(function (l) { l = l.trim(); var a; if (/^#/.test(l)) { a = mkSplit(l.replace(/^#\s*/, "")); o.indexes.push({ name: a[0], val: a[1] || "", chg: "", pct: a[2] || "" }); } else if (/^\*/.test(l)) { a = mkSplit(l.replace(/^\*\s*/, "")); o.features.push({ name: a[0], pct: a[1] || "" }); } else if (/^>/.test(l)) o.foot = l.replace(/^>\s*/, ""); else { a = mkSplit(l); o.chips.push({ name: a[0], pct: a[1] || "" }); } }); o.indexes = o.indexes.slice(0, 2); o.features = o.features.slice(0, 3); o.chips = o.chips.slice(0, 8); return o; } },
  calendar: { help: "첫 줄 @ 2026-11 (연-월), 다음 줄부터: 날짜(일) | 내용 | 종류(kr·us·hol, 선택)", ex: "@ 2026-11\n3 | 미국 중간선거 | us\n6 | 한국은행 금리 결정 | kr\n12 | 옵션 만기일 | kr",
    to: function (s) { var L = ["@ " + s.year + "-" + String(s.month).padStart(2, "0")]; Object.keys(s.events || {}).sort(function (a, b) { return a - b; }).forEach(function (d) { s.events[d].forEach(function (e) { L.push(d + " | " + e.t + (e.k ? " | " + e.k : "")); }); }); return L.join("\n"); },
    from: function (t) { var L = mkLines(t), nw = new Date(Date.now() + 9 * 3600e3), o = { year: nw.getUTCFullYear(), month: nw.getUTCMonth() + 1, events: {} }; if (L[0] && /^@/.test(L[0].trim())) { var m = L.shift().match(/(\d{4})\D+(\d{1,2})/); if (m) { o.year = +m[1]; o.month = +m[2]; } } L.forEach(function (l) { var a = mkSplit(l), d = parseInt(a[0], 10); if (d >= 1 && d <= 31) (o.events[d] = o.events[d] || []).push({ t: a[1] || "", k: (a[2] || "").toLowerCase() }); }); return o; } }
};

/* ---------- 데이터 준비 (브리핑 · 채널 계산이 아직이면 한 번 불러온다) ---------- */
function mkReady() {
  if (typeof briefState !== "undefined" && briefState.recent) return true;
  if (typeof loadBrief === "function" && !MK.loading) { MK.loading = true; loadBrief(false); var n = 0, iv = setInterval(function () { if ((briefState && briefState.recent) || ++n > 60) { clearInterval(iv); MK.loading = false; if (currentTab === "onecard") makerRender(); } }, 500); }
  return false;
}
/* v11.6 추천 점수에 쓰는 데이터를 한 번씩 미리 받아 두고, 받으면 다시 그린다 (운영자 화면이라 과금 없는 공개 데이터만) */
function mkWarm() {
  if (MK.warmed || !(typeof isOwner === "function" && isOwner())) return; MK.warmed = true;
  var ps = [];
  if (typeof dsEnsure === "function") ps.push(dsEnsure().catch(function () {}));
  if (typeof ipoEnsure === "function") ps.push(ipoEnsure().catch(function () {}));
  if (typeof macroEnsure === "function") ps.push(macroEnsure().then(function (d) { return d && !d.none ? macPxLoad() : null; }).catch(function () {}));
  if (typeof cardsNewsFetch === "function" && typeof briefState !== "undefined" && briefState.result) ps.push(cardsNewsFetch(briefState.result).catch(function () {}));
  Promise.all(ps).then(function () { if (typeof currentTab !== "undefined" && currentTab === "onecard" && (MK.tab === "today" || MK.tab === "decks")) makerRender(); });
}
function mkChannelReady() { if (typeof chState === "undefined" || !chState.recent) { if (typeof renderChannel === "function") try { renderChannel(); } catch (e) {} } }

/* ---------- 화면 ---------- */
/* 직접 쓰기 카드의 글감: 양식 제목·부제 + 표의 첫 행들 */
function mkCardLines(cat) { var L = []; try { var x = MK.mode === "app" ? tplSpec(cat, MK.src, MK.mk) : null; if (x) { if (x.meta && x.meta.title) L.push(cPlain(String(x.meta.title)).replace(/\n/g, " ")); if (x.meta && x.meta.sub) L.push(String(x.meta.sub)); var sp = x.spec || {}; (sp.rows || sp.items || sp.boxes || []).slice(0, 4).forEach(function (r) { if (Array.isArray(r)) L.push(r.map(String).join(" ")); else if (r && typeof r === "object") L.push([r.name || r.label || r.left, r.value || r.pct || r.b || r.right].filter(Boolean).join(" ")); }); } else { var m = MK.meta[cat] || {}; if (m.title) L.push(cPlain(String(m.title)).replace(/\n/g, " ")); if (MK.text[cat]) L = L.concat(String(MK.text[cat]).split("\n").slice(0, 4)); } } catch (e) {} return L.filter(Boolean); }
function makerRender() {
  var root = document.getElementById("mkBody"); if (!root) return;
  if (!MK.inited) { mkLoad(); MK.inited = true; }
  if (!mkReady()) { root.innerHTML = '<div class="briefDim">전 종목 데이터를 불러오는 중이에요… (한 번만)</div>'; return; }
  mkChannelReady();
  MK.mk = MK.mk || briefState.market || "all";
  var top = '<div class="mkTop"><div class="pills seg mkMkt" title="모든 탭에 적용">' + TPL_MKS.map(function (m) { return '<button data-mmk="' + m[0] + '"' + (m[0] === MK.mk ? ' class="active"' : '') + '>' + m[1] + '</button>'; }).join("") + '</div>' +
    '<div class="pills seg mkSize" title="만드는 카드 크기 — 모든 카드에 적용"><button data-msize="post"' + (MK.size !== "reel" ? ' class="active"' : '') + '>게시형 4:5</button><button data-msize="reel"' + (MK.size === "reel" ? ' class="active"' : '') + '>릴스형 9:16</button></div>' +
    (MK.tab === "work" ? '' : '<button class="chip aiBtn" data-ai-open="custom" title="내가 쓴 글·데이터로 AI가 한 장 카드를">내 글로 AI 카드</button>') + '</div>' +
    '<div class="mkTabs">' + MK_TABS.map(function (t) { return '<button data-mtab="' + t[0] + '"' + (t[0] === MK.tab ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join("") + '</div><div class="mkPane"></div>';
  root.innerHTML = top;
  Array.prototype.forEach.call(root.querySelectorAll("[data-mmk]"), function (b) { b.onclick = function () { MK.mk = b.getAttribute("data-mmk"); if (typeof switchBriefMarket === "function" && briefState.market !== MK.mk) switchBriefMarket(MK.mk); makerRender(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-msize]"), function (b) { b.onclick = function () { MK.size = b.getAttribute("data-msize"); try { localStorage.setItem("sm.cardSize", MK.size); } catch (e) {} if (typeof cardSizeApply === "function") cardSizeApply(MK.size); makerRender(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-mtab]"), function (b) { b.onclick = function () { MK.tab = b.getAttribute("data-mtab"); makerRender(); }; });
  var pane = root.querySelector(".mkPane");
  if (MK.tab === "reels" || MK.tab === "decks" || MK.tab === "today") MK.tab = "work";
  mkWarm();
  if (MK.tab === "work") { pane.innerHTML = mkWorkHtml(); mkWorkBind(pane); }
  else if (MK.tab === "today") {
    pane.innerHTML = typeof hubTodayHtml === "function" ? hubTodayHtml() : "";
    if (typeof hubBind === "function") hubBind(pane);
    if (typeof perToday === "function" && perToday().length) { var pt = document.createElement("div"); pt.className = "briefDim"; pt.style.marginTop = "6px"; pt.textContent = "정기 발행일이에요: " + perToday().map(function (k) { return cPlain(PER_SETS[k].t); }).join(" · "); pane.appendChild(pt); }
  } else if (MK.tab === "decks") {
    pane.innerHTML = typeof hubDecksHtml === "function" ? hubDecksHtml() : mkDecks(); if (typeof hubBind === "function") hubBind(pane); else mkDeckBind(pane);
  } else if (MK.tab === "lib") { if (typeof libTabRender === "function") libTabRender(pane); }
  else mkOneRender(pane);
  if (!MK.iconsLoaded && typeof libLoadIcons === "function") { MK.iconsLoaded = true; libLoadIcons().then(function () { if (Object.keys(TPL_ICON).length && MK.tab === "one") mkPreview(); }).catch(function () {}); }
}
function mkOneRender(box) {
  var cat = MK.cat, srcs = TPL_SOURCES[cat] || [], src = MK.src && srcs.some(function (s) { return s.id === MK.src; }) ? MK.src : srcs[0].id; MK.src = src;
  var F = MK_FMT[cat], txt = MK.text[cat] != null ? MK.text[cat] : F.ex, meta = MK.meta[cat] || {};
  var h = '<div class="mkCols"><div class="mkLeft">';
  h += '<div class="mkStep"><b>1</b> 양식</div><div class="mkCats">' + Object.keys(TPL_CAT).map(function (k) { return '<button data-mcat="' + k + '"' + (k === cat ? ' class="on"' : '') + '><i>' + TPL_CAT[k].icon + '</i><span>' + TPL_CAT[k].name + '</span></button>'; }).join("") + '</div><div class="briefDim" style="margin:4px 0 8px">' + TPL_CAT[cat].desc + ' · 쓰임: ' + TPL_CAT[cat].use + '</div>';
  h += '<div class="mkStep"><b>2</b> 내용 <small class="briefDim">· 시장: ' + ({ all: "전체", kr: "국내", us: "미국", coin: "코인" })[MK.mk] + ' (위에서 바꿈)</small></div><div class="pills seg"><button data-mmode="app"' + (MK.mode === "app" ? ' class="active"' : '') + '>📊 앱 데이터</button><button data-mmode="text"' + (MK.mode === "text" ? ' class="active"' : '') + '>✏️ 직접 입력</button></div>';
  if (MK.mode === "app") {
    h += '<div class="mkSrcs">' + srcs.map(function (s) { return '<button data-msrc="' + s.id + '"' + (s.id === src ? ' class="on"' : '') + '>' + s.t + '</button>'; }).join("") + '</div>';
    h += '<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><button class="chip" data-medit>✏️ 이 내용 고쳐 쓰기</button>' + aiBtn("tpl:" + cat + ":" + src + ":" + MK.mk, "✨ AI로 다듬기") + '</div>';
  } else {
    h += '<div class="mkForm"><label>제목 <small>두 줄은 줄바꿈 · [[ ]] 안은 금색</small><textarea class="mkTitle" rows="2">' + escapeHtml(meta.title || "") + '</textarea></label>' +
      '<div class="mkGrid2"><label>부제<input class="mkSub" value="' + escapeHtml(meta.sub || "") + '"></label><label>꼬리표<input class="mkTag" value="' + escapeHtml(meta.catName || "") + '" placeholder="' + TPL_CAT[cat].name + '"></label></div>' +
      '<label>출처 · 기준<input class="mkSrcTxt" value="' + escapeHtml(meta.source || "") + '" placeholder="예) 국토부 실거래가 공개(2026.10.11 조회)"></label>' +
      '<label>내용 <small>' + F.help + '</small><textarea class="mkTxt" rows="10">' + escapeHtml(txt) + '</textarea></label>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap"><button class="chip" data-mex>예시 넣기</button><button class="chip" data-mclear>비우기</button><button class="chip aiBtn" data-mai>✨ 이 글로 AI 카드</button></div></div>';
  }
  h += '<div class="row" style="gap:6px;margin-top:12px"><button class="primary" data-msave disabled>⬇ 저장 (1080×1350)</button><span class="briefDim mkMsg"></span></div>';
  if (typeof thrPanelHtml === "function") h += thrPanelHtml("주식");
  h += '</div><div class="mkRight"><div class="mkPrev"><img alt="" hidden><div class="briefDim mkPh">미리보기를 만드는 중…</div></div></div></div>';
  box.innerHTML = h;
  var $m = function (q) { return box.querySelector(q); };
  Array.prototype.forEach.call(box.querySelectorAll("[data-mcat]"), function (b) { b.onclick = function () { MK.cat = b.getAttribute("data-mcat"); MK.src = null; mkSave(); makerRender(); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-mmode]"), function (b) { b.onclick = function () { MK.mode = b.getAttribute("data-mmode"); mkSave(); makerRender(); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-msrc]"), function (b) { b.onclick = function () { MK.src = b.getAttribute("data-msrc"); makerRender(); }; });
  if ($m("[data-medit]")) $m("[data-medit]").onclick = function () {
    tplPrep(cat, MK.mk, src).then(function () { var x = tplSpec(cat, src, MK.mk); if (!x) return; MK.text[cat] = F.to(x.spec); MK.meta[cat] = { title: x.meta.title, sub: x.meta.sub || "", source: x.meta.source || "", catName: x.meta.catName || "" }; MK.mode = "text"; mkSave(); makerRender(); });
  };
  if (MK.mode === "text") {
    var sync = function () { MK.text[cat] = $m(".mkTxt").value; MK.meta[cat] = { title: $m(".mkTitle").value, sub: $m(".mkSub").value, source: $m(".mkSrcTxt").value, catName: $m(".mkTag").value }; mkSave(); clearTimeout(MK.timer); MK.timer = setTimeout(mkPreview, 250); };
    Array.prototype.forEach.call(box.querySelectorAll(".mkForm input,.mkForm textarea"), function (el) { el.oninput = sync; });
    $m("[data-mex]").onclick = function () { $m(".mkTxt").value = F.ex; if (!$m(".mkTitle").value) $m(".mkTitle").value = TPL_CAT[cat].name + " 예시"; sync(); };
    $m("[data-mclear]").onclick = function () { $m(".mkTxt").value = ""; sync(); };
    $m("[data-mai]").onclick = function () { var t = ($m(".mkTitle").value || TPL_CAT[cat].name).replace(/\n/g, " ") + "\n" + $m(".mkTxt").value.split(/\r?\n/).map(function (l) { return l.replace(/^[#*!>@]\s*/, "- ").replace(/\s*\|\s*/g, ": "); }).join("\n") + ($m(".mkSrcTxt").value ? "\n출처: " + $m(".mkSrcTxt").value : ""); if (typeof aiOpenCustom === "function") aiOpenCustom(t, cat === "calendar" ? "" : cat, "내 글 · " + TPL_CAT[cat].name); };
  }
  $m("[data-msave]").onclick = function () { if (!MK.url) return; cardsDownload({ url: MK.url, file: "uphill.lab_" + TPL_CAT[cat].name + "_" + ({ all: "전체", kr: "국내", us: "미국", coin: "코인" })[MK.mk] + "_" + pubToday().replace(/-/g, "") + ".png" }); };
  mkPreview();
}
function mkPreview() {
  var box = document.getElementById("mkBody"); if (!box) return;
  var img = box.querySelector(".mkPrev img"), ph = box.querySelector(".mkPh"), msg = box.querySelector(".mkMsg"), cat = MK.cat;
  var p = MK.mode === "app" ? tplPrep(cat, MK.mk, MK.src) : Promise.resolve();
  Promise.resolve(p).then(function () { return document.fonts && document.fonts.ready ? document.fonts.ready : null; }).then(function () {
    var cv = null;
    try {
      if (MK.mode === "app") cv = tplBuild(cat, MK.src, MK.mk);
      else { var m = MK.meta[cat] || {}, spec = MK_FMT[cat].from(MK.text[cat] != null ? MK.text[cat] : MK_FMT[cat].ex); cv = tplCard(cat, { title: m.title || TPL_CAT[cat].name, sub: m.sub, source: m.source, catName: m.catName || "" }, spec); }
    } catch (e) { console.warn(e); if (msg) msg.textContent = "그리지 못했어요: " + e.message; }
    if (!cv) { var Rq = MK.mode === "app" && typeof tplR === "function" ? tplR(MK.mk) : null; if (ph) ph.textContent = Rq && Rq.marketWideOff ? "전체 시장 숫자가 맞춰질 때까지 만들지 않아요 — " + ((Rq.basis && Rq.basis.why) || "") : "이 내용은 아직 데이터가 없어요"; return; }   /* v12.29 */
    MK.url = cv.toDataURL("image/png"); img.src = MK.url; img.hidden = false; if (ph) ph.hidden = true;
    var sv = box.querySelector("[data-msave]"); if (sv) { sv.disabled = false; sv.textContent = "⬇ 저장 (" + (MK.size === "reel" ? "1080×1920" : "1080×1350") + ")"; } if (msg) msg.textContent = "";
    // v12.21 직접 쓰기도 인스타 캡션 + 스레드 글
    var tp = box.querySelector(".thrPanel"); if (tp && typeof thrBind === "function" && typeof hubThreadsAuto === "function") { var meta = MK.mode === "app" ? (TPL_CAT[cat] ? TPL_CAT[cat].name : cat) : ((MK.meta[cat] || {}).title || TPL_CAT[cat].name); try { var mlines = mkCardLines(cat); thrBind(box, hubThreadsAuto(mlines[0] || cPlain(String(meta)), [{ name: "한장" }], { lines: mlines.slice(1) })); } catch (e) {} }
  });
}
/* ============================================================ v12.1 작업대 — ① 오늘 상태 ② 주제 고르기 ③ 만들기 ④ 결과 ============================================================ */
function mkTopicsScored() { if (MK._T && Date.now() - MK._Tat < 60e3) return MK._T; MK._T = hubTopics().map(function (x) { var sc = { s: 0, why: "" }; try { sc = x.score(); } catch (e) {} return Object.assign({}, x, { s: sc.s, why: sc.why }); }); MK._Tat = Date.now(); return MK._T; }
function mkWorkHtml() {
  var R = hubR(), kst = hubKst(), dow = "일월화수목금토"[kst.getUTCDay()], ck = typeof pubChecklist === "function" ? pubChecklist() : [], bad = ck.filter(function (c) { return !c.ok; }), done = hubDoneLoad(), doneCtx = {}; done.forEach(function (d) { doneCtx[d.ctx] = (doneCtx[d.ctx] || 0) + 1; });
  var temp = R && (R.uniTemp || R.temp), vix = R && (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0], newsN = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).length, now = typeof nbNow === "function" ? nbNow() : { why: [] }, per = typeof perToday === "function" ? perToday() : [];
  var T = mkTopicsScored(), today = hubToday(10), groups = []; T.forEach(function (x) { if (groups.indexOf(x.g) < 0) groups.push(x.g); });
  if (!MK.sel || !T.some(function (x) { return x.ctx === MK.sel; })) MK.sel = today[0] ? today[0].ctx : (T[0] && T[0].ctx);
  // ① 오늘 상태
  var kpi = function (l, v, c) { return '<div class="wbKpi"><small>' + l + '</small><b' + (c ? ' class="' + c + '"' : '') + '>' + v + '</b></div>'; };
  var h = '<div class="wbStep"><b>1</b> 오늘 상태 <small>' + (kst.getUTCMonth() + 1) + '.' + kst.getUTCDate() + '(' + dow + ') · ' + ({ all: "전체", kr: "국내", us: "미국", coin: "코인" })[MK.mk] + ' 시장 기준</small></div><div class="wbKpis">' +
    kpi(R && R.uniTemp ? "오른 종목(전체 시장)" : "오른 종목", temp && isFinite(temp.upPct) ? Math.round(temp.upPct * 100) + "%" : "-", temp ? (temp.upPct >= 0.6 ? "pos" : temp.upPct <= 0.4 ? "neg" : "") : "") + kpi("VIX", vix ? parseFloat(vix.v).toFixed(0) : "-", vix && parseFloat(vix.v) >= 25 ? "neg" : "") + kpi("오늘 기사", newsN ? newsN + "건" : "수집 전") + kpi("시장 신호", now.why.length ? now.why.length + "개" : "없음", now.why.length ? "pos" : "") + kpi("정기 발행", per.length ? per.map(function (k) { return cPlain(PER_SETS[k].t).replace(/^\S+\s/, ""); }).join(", ") : "없음", per.length ? "pos" : "") + kpi("오늘 만든 카드", done.length + "건") +
    '</div>' + (now.why.length ? '<div class="wbSig">지금 신호 · ' + now.why.map(escapeHtml).join(" / ") + '</div>' : '') +
    '<details class="hubCk wbCk"' + (bad.length ? ' open' : '') + '><summary>발행 전 점검 ' + (bad.length ? '<b class="rbWarn">확인 ' + bad.length + '건</b>' : '<b style="color:#2e7d4f">이상 없음</b>') + ' <small class="briefDim">· 데이터 기준일 · 휴장 · 오류 종목</small></summary><div class="pubCk">' + ck.map(function (c) { return '<div class="pubCkRow ' + (c.ok ? "ok" : c.w ? "bad" : "warn") + '"><span>' + (c.ok ? "✅" : c.w ? "⛔" : "⚠️") + '</span><span>' + escapeHtml(c.t) + '</span></div>'; }).join("") + '</div></details>';
  // ② 주제 고르기
  var L = MK.filt === "ai" && typeof mkAiList === "function" ? mkAiList(T) : MK.filt === "today" ? today : MK.filt === "all" ? T.slice().sort(function (a, b) { return b.s - a.s; }) : T.filter(function (x) { return x.g === MK.filt; });
  if (MK.q) { var q = MK.q.toLowerCase(); L = L.filter(function (x) { return (cPlain(x.t) + " " + x.d + " " + x.g).toLowerCase().indexOf(q) >= 0; }); }
  h += '<div class="wbCols"><div class="wbLeft"><div class="wbStep"><b>2</b> 주제 고르기 <small>' + L.length + '개 · 점수 = 시장 신호·일정·데이터</small></div>';
  h += '<div class="wbFilt">' + (typeof smClaude === "function" ? '<button data-wf="ai"' + (MK.filt === "ai" ? ' class="on"' : '') + '>✨ AI 편성' + (typeof MK_AI !== "undefined" && MK_AI && MK_AI.data ? ' ' + (MK_AI.data.picks || []).length : '') + '</button>' : '') + '<button data-wf="today"' + (MK.filt === "today" ? ' class="on"' : '') + '>오늘 추천 10</button><button data-wf="all"' + (MK.filt === "all" ? ' class="on"' : '') + '>전체 ' + T.length + '</button>' + groups.map(function (g) { return '<button data-wf="' + escapeHtml(g) + '"' + (MK.filt === g ? ' class="on"' : '') + '>' + escapeHtml(g) + '</button>'; }).join("") + '<input class="wbQ" placeholder="검색" value="' + escapeHtml(MK.q) + '"></div>';
  if (MK.filt === "ai" && typeof mkAiHtml === "function") h += '<div class="row" style="gap:6px;margin:6px 0"><button class="primary" data-aiplan>✨ Claude 편성 ' + (typeof MK_AI !== "undefined" && MK_AI ? "다시" : "시작") + '</button><small class="briefDim">주제 후보 + 리포트 후보 + 오늘 이슈 + 기사를 모아 Claude가 골라요 · 30초~2분</small></div>' + mkAiHtml();   // v12.39
  h += '<div class="wbList">' + L.map(function (x, i) { var sc = x.s >= 8 ? "hi" : x.s >= 5 ? "mid" : ""; return '<div class="wbItem' + (x.ctx === MK.sel ? ' on' : '') + '" data-wsel="' + escapeHtml(x.ctx) + '"><span class="wbRank">' + (MK.filt === "today" || MK.filt === "ai" ? i + 1 : '<i class="wbSc ' + sc + '">' + Math.round(x.s) + '</i>') + '</span><div class="wbMain"><b>' + escapeHtml(x.t) + (doneCtx[x.ctx] ? ' <em class="wbDone">✓ 만듦 ' + doneCtx[x.ctx] + '</em>' : '') + '</b><small>' + escapeHtml(x.why || x.d) + '</small></div><span class="wbG">' + escapeHtml(x.g.split(" · ")[0].replace(/^데이터로 보는 투자$/, "데이터").replace(/^재미로 보는 숫자$/, "재미").replace(/^투자 상식 리스트$/, "투자 상식")) + '</span></div>'; }).join("") + (L.length ? "" : '<div class="briefDim">해당하는 주제가 없어요</div>') + '</div></div>';
  // ③ 만들기
  var S = T.filter(function (x) { return x.ctx === MK.sel; })[0];
  h += '<div class="wbRight"><div class="wbStep"><b>3</b> 만들기</div>' + (S ? mkMakeHtml(S) : '<div class="briefDim">왼쪽에서 주제를 고르세요</div>') + '</div></div>';
  // ④ 결과
  h += '<div id="mkResult" class="wbResult" hidden></div>';
  return h;
}
function mkMakeHtml(S) {
  var h = '<div class="wbSel"><div class="wbSelT">' + escapeHtml(S.t) + '</div><div class="wbSelD">' + escapeHtml(S.d) + '</div>' + (S.why ? '<div class="hubWhy"><span>왜 지금</span>' + escapeHtml(S.why) + '</div>' : '') + '</div>';
  h += '<div class="wbBriefBox" data-brief="' + escapeHtml(S.ctx) + '"><div class="briefDim">읽는 요약(숫자 + 요즘 이슈 + 전문가)을 준비하는 중…</div></div>';
  h += '<div class="wbActs">' +
    '<button class="wbAct" data-hub="one" data-ctx="' + escapeHtml(S.ctx) + '"><b>한 장</b><small>핵심 숫자 + 이슈 띠 · 1장</small></button>' +
    '<button class="wbAct" data-hub="multi" data-ctx="' + escapeHtml(S.ctx) + '"><b>여러 장</b><small>요약 + 근거 카드 전부</small></button>' +
    '<button class="wbAct ai" data-hub="ai1" data-ctx="' + escapeHtml(S.ctx) + '"><b>AI 한 장</b><small>AI가 읽고 1장 기획</small></button>' +
    '<button class="wbAct ai" data-hub="aiN" data-ctx="' + escapeHtml(S.ctx) + '"><b>AI 여러 장</b><small>AI가 엮어 5~8장</small></button></div>' +
    '<div class="briefDim" style="margin-top:8px">만든 카드는 아래 ④에 바로 떠요 · 업로드 글(스레드·인스타)도 같이 · 숫자는 앱 데이터 그대로</div>';
  return h;
}
function mkWorkBind(pane) {
  Array.prototype.forEach.call(pane.querySelectorAll("[data-wf]"), function (b) { b.onclick = function () { MK.filt = b.getAttribute("data-wf"); makerRender(); }; });
  var q = pane.querySelector(".wbQ"); if (q) { q.oninput = function () { MK.q = q.value; clearTimeout(MK.qt); MK.qt = setTimeout(function () { var pos = q.selectionStart; makerRender(); var q2 = document.querySelector("#mkBody .wbQ"); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) {} } }, 350); }; }
  Array.prototype.forEach.call(pane.querySelectorAll("[data-wsel]"), function (b) { b.onclick = function () { MK.sel = b.getAttribute("data-wsel"); makerRender(); var r = document.querySelector("#mkBody .wbRight"); if (r && window.innerWidth < 900) try { r.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }; });
  if (typeof mkAiBind === "function") mkAiBind(pane);   // v12.39 Claude 편성
  if (typeof hubBind === "function") hubBind(pane);
  var bb = pane.querySelector("[data-brief]");
  if (bb && typeof hubBrief === "function") { var ctx = bb.getAttribute("data-brief"); hubBrief(ctx).then(function (B) { var cur = document.querySelector('#mkBody [data-brief="' + ctx.replace(/"/g, '\\"') + '"]'); if (cur) cur.innerHTML = hubBriefHtml(B); }).catch(function (e) { var cur = document.querySelector("#mkBody [data-brief]"); if (cur) cur.innerHTML = '<div class="briefDim">읽는 요약을 만들지 못했어요: ' + escapeHtml(e.message) + '</div>'; }); }
}
function mkMarkDone(ctx) { var el = document.querySelector('#mkBody .wbItem[data-wsel="' + ctx.replace(/"/g, '\\"') + '"] b'); if (!el) return; var em = el.querySelector(".wbDone"); if (em) em.textContent = "✓ 만듦 " + (parseInt(em.textContent.replace(/\D/g, "")) + 1 || 1); else el.insertAdjacentHTML("beforeend", ' <em class="wbDone">✓ 만듦 1</em>'); var k = document.querySelector("#mkBody .wbKpis .wbKpi:last-child b"); if (k) k.textContent = hubDoneLoad().length + "건"; }

/* ---------- 카드 묶음 (구 탭 · 참고용) ---------- */
function mkDecks() {
  function row(t, d, act, ai, now) { return '<div class="pubPlanItem' + (now ? ' per' : '') + '"><div><b>' + escapeHtml(t) + '</b><small>' + escapeHtml(d || "") + '</small></div><div class="rlActs"><button class="chip" data-mdeck="' + act + '">만들기</button>' + (ai ? aiBtn(ai, "AI") : "") + '</div></div>'; }
  var g = [];
  g.push(["오늘", [row("오늘의 브리핑 카드", "시장 온도·업종·급등락·돈 몰린 곳 · 약 10장", "brief", "brief"), row("오늘 한 장", "9칸 한 페이지 요약", "onepage", "onepage"), row("채널 전일 정리", "주식 전일 정리 · 약 6장", "channel", "channel"), row("핵심 이슈 5", "오늘의 이슈 다섯 줄 한 장", "issues", "issues")]]);
  if (typeof PER_SETS !== "undefined") { var td = typeof perToday === "function" ? perToday() : []; g.push(["정기 발행", Object.keys(PER_SETS).map(function (k) { return row(String(PER_SETS[k].t).replace(/^\S+\s/, ""), PER_SETS[k].when + " 발행" + (td.indexOf(k) >= 0 ? " · 오늘" : ""), "per:" + k, "per:" + k, td.indexOf(k) >= 0); })]); }
  if (typeof storyDecks === "function") { var d = []; try { d = storyDecks(); } catch (e) {} g.push(["연구노트", d.map(function (x) { return row(String(x.t).replace(/^\S+\s/, ""), (x.now ? "지금 신호 · " : "") + x.d, "story:" + x.key, "story:" + x.key, x.now); })]); }
  if (typeof dsDeckOpen === "function") g.push(["공시 · 구루", [row("공시 카드", "임원·대주주 매수·매도(7일) · 자사주 취득 결정(30일) + 업로드 글", "disc"), row("구루 13F 카드", "최근 공개한 투자자 2명 매수·매도 · 같이 움직인 종목 + 업로드 글", "guru")].concat(typeof ipoDeckOpen === "function" ? [row("공모주 카드", "청약 일정(공모가·최소 증거금·증권사) · 최근 상장 성적 · 첫날 종가 분포 + 업로드 글", "ipo")] : [])]);
  if (typeof macDeckList === "function") { var ml = macDeckList(); if (ml.length) g.push(["매크로 · 환율·금리", ml.map(function (x) { return row(x.t, (x.now ? "지금 해당 · " : "") + x.d, "macro:" + x.id, null, x.now); })]); else if (typeof isOwner === "function" && isOwner() && !MAC.doc && !MAC.loading) macroEnsure().then(function (d) { return d && !d.none ? macPxLoad() : null; }).then(function () { if (typeof MK !== "undefined" && MK.tab === "decks" && typeof makerRender === "function" && macDeckList().length) makerRender(); }); }
  if (typeof dvDeckOpen === "function") g.push(["배당", [row("배당 카드 4장", "필요 투자금 · 배당률 TOP · 계좌별 세금 · 이달 배당락 + 업로드 글", "div")]]);
  if (typeof pubPolicyAll === "function") g.push(["정책 · 일정 · 용어", pubPolicyAll().map(function (p) { return row(p.short || p.t, (p.eff || "") + (p.src ? " · " + p.src : ""), "pol:" + p.id, "policy:" + p.id); }).concat([row("이번 주 일정", "앞으로 7일 발표·실적·휴장", "cal", "cal"), row("용어 한 입", "오늘의 용어 한 장", "term", "term")])]);
  return g.map(function (x) { return '<h4 class="mkH">' + x[0] + ' <small>' + x[1].length + '</small></h4><div class="pubPlan">' + x[1].join("") + '</div>'; }).join("");
}
function mkDeckBind(box) {
  Array.prototype.forEach.call(box.querySelectorAll("[data-mdeck]"), function (btn) {
    btn.onclick = function () {
      var a = btn.getAttribute("data-mdeck"), k = a.split(":")[0], arg = a.split(":").slice(1).join(":");
      if ((k === "brief" || k === "onepage") && MK.mk && briefState.market !== MK.mk && typeof switchBriefMarket === "function") switchBriefMarket(MK.mk);
      if (k === "brief") cardsOpen("brief");
      else if (k === "onepage") onePageOpen(btn);
      else if (k === "channel") cardsOpen("channel");
      else if (k === "issues") { var l = (typeof chState !== "undefined" && chState.issues && chState.issues.length) ? chState.issues : issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular }); issuesCardOpen(l); }
      else if (k === "per") perOpen(arg);
      else if (k === "story") storyOpen(arg);
      else if (k === "pol") pubPolicyOpen(arg);
      else if (k === "cal") pubSingleCard(pubCalCard, "uphill.lab_이번주일정_" + pubToday().replace(/-/g, "") + ".png", "🗓️ 이번 주 일정", "cal");
      else if (k === "term") pubSingleCard(function () { return pubTermCard(pubTerm(pubState.termOffset || 0)); }, "uphill.lab_용어_" + pubToday().replace(/-/g, "") + ".png", "📖 용어 한 입", "term");
      else if (k === "reel") reelOpen(arg);
      else if (k === "div") dvDeckOpen(MK.mk || "all");
      else if (k === "disc" || k === "guru") dsDeckOpen(k);
      else if (k === "ipo") ipoDeckOpen();
      else if (k === "macro") macroDeckOpen(arg);
    };
  });
}
