/* ============================================================
   카드 만들기 (v10.5) — 흩어져 있던 카드 만들기를 한 화면에
   ① 한 장 양식: 시장 → 양식(9종) → 내용(앱 데이터 | 직접 입력) → 오른쪽 실시간 미리보기 → 저장 / ✨ AI
      '고쳐 쓰기'를 누르면 앱 데이터가 입력칸 글로 바뀌어 그대로 고칠 수 있다 (글 ↔ 양식 명세 변환기 MK_FMT)
   ② 카드 묶음(여러 장): 오늘의 브리핑·오늘 한 장·채널·정기 발행·연구노트·정책·일정·용어·릴스를 버튼 하나로
   ============================================================ */
var MK = { mk: null, cat: "rank", src: null, mode: "app", text: {}, meta: {}, url: null, timer: null, tab: "today" };
var MK_TABS = [["today", "📌 오늘 할 일"], ["one", "🧩 한 장 양식"], ["decks", "🗂️ 묶음 카드"], ["reels", "🎬 릴스"]];
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
function mkChannelReady() { if (typeof chState === "undefined" || !chState.recent) { if (typeof renderChannel === "function") try { renderChannel(); } catch (e) {} } }

/* ---------- 화면 ---------- */
function makerRender() {
  var root = document.getElementById("mkBody"); if (!root) return;
  if (!MK.inited) { mkLoad(); MK.inited = true; }
  if (!mkReady()) { root.innerHTML = '<div class="briefDim">전 종목 데이터를 불러오는 중이에요… (한 번만)</div>'; return; }
  mkChannelReady();
  MK.mk = MK.mk || briefState.market || "all";
  var top = '<div class="mkTop"><div class="pills seg mkMkt" title="모든 탭에 적용">' + TPL_MKS.map(function (m) { return '<button data-mmk="' + m[0] + '"' + (m[0] === MK.mk ? ' class="active"' : '') + '>' + m[1] + '</button>'; }).join("") + '</div>' +
    '<button class="chip aiBtn" data-ai-open="custom" title="내가 쓴 글·데이터로 AI가 한 장 카드를">✍️ 내 글로 AI 카드</button></div>' +
    '<div class="mkTabs">' + MK_TABS.map(function (t) { return '<button data-mtab="' + t[0] + '"' + (t[0] === MK.tab ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join("") + '</div><div class="mkPane"></div>';
  root.innerHTML = top;
  Array.prototype.forEach.call(root.querySelectorAll("[data-mmk]"), function (b) { b.onclick = function () { MK.mk = b.getAttribute("data-mmk"); if (typeof switchBriefMarket === "function" && briefState.market !== MK.mk) switchBriefMarket(MK.mk); makerRender(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-mtab]"), function (b) { b.onclick = function () { MK.tab = b.getAttribute("data-mtab"); makerRender(); }; });
  var pane = root.querySelector(".mkPane");
  if (MK.tab === "today") {
    pane.innerHTML = '<div class="briefDim" style="margin-bottom:8px">발행 전 점검 → 오늘 요일·신호에 맞는 추천 세트. 각 줄의 🃏는 카드 묶음, ✨는 그 묶음을 AI 한 장으로.</div><div class="mkToday"></div>';
    if (typeof pubRender === "function") try { pubRender(pane.querySelector(".mkToday"), "plan"); } catch (e) { console.warn(e); }
  } else if (MK.tab === "decks") {
    pane.innerHTML = mkDecks(); mkDeckBind(pane);
  } else if (MK.tab === "reels") {
    pane.innerHTML = typeof reelTabHtml === "function" ? reelTabHtml() : "";
    Array.prototype.forEach.call(pane.querySelectorAll("[data-reel]"), function (b) { b.onclick = function () { reelOpen(b.getAttribute("data-reel")); }; });
  } else mkOneRender(pane);
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
    if (!cv) { if (ph) ph.textContent = "이 내용은 아직 데이터가 없어요"; return; }
    MK.url = cv.toDataURL("image/png"); img.src = MK.url; img.hidden = false; if (ph) ph.hidden = true;
    var sv = box.querySelector("[data-msave]"); if (sv) sv.disabled = false; if (msg) msg.textContent = "";
  });
}
/* ---------- 카드 묶음 ---------- */
function mkDecks() {
  function b(label, act, ai) { return '<span class="mkDeck"><button class="chip" data-mdeck="' + act + '">' + label + '</button>' + (ai ? aiBtn(ai, "✨") : "") + '</span>'; }
  var g = [];
  g.push(["오늘", [b("🃏 오늘의 브리핑 카드", "brief", "brief"), b("📄 오늘 한 장", "onepage", "onepage"), b("📢 채널 전일 정리", "channel", "channel"), b("🔥 핵심 이슈 5", "issues", "issues")]]);
  if (typeof PER_SETS !== "undefined") g.push(["정기 발행", Object.keys(PER_SETS).map(function (k) { return b(PER_SETS[k].t, "per:" + k, "per:" + k); })]);
  if (typeof storyDecks === "function") { var d = []; try { d = storyDecks(); } catch (e) {} g.push(["연구노트", d.map(function (x) { return b(x.t + (x.now ? " ←지금" : ""), "story:" + x.key, "story:" + x.key); })]); }
  if (typeof pubPolicyAll === "function") g.push(["정책 · 일정 · 용어", pubPolicyAll().map(function (p) { return b("🏛️ " + (p.short || p.t), "pol:" + p.id, "policy:" + p.id); }).concat([b("🗓️ 이번 주 일정", "cal", "cal"), b("📖 용어 한 입", "term", "term")])]);
  return '<div class="briefDim" style="margin-bottom:6px">여러 장짜리 캐러셀. 위에서 고른 시장이 브리핑 카드·오늘 한 장에 적용돼요. 옆의 ✨는 그 묶음 전체를 AI 한 장으로.</div><div class="mkDecks">' + g.map(function (x) { return '<div class="mkDeckG"><span>' + x[0] + '</span><div>' + x[1].join("") + '</div></div>'; }).join("") + '</div>';
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
    };
  });
}
