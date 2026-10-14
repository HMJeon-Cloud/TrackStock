/* ============================================================
   AI 보관함 (v10.7) — AI로 만든 배경 · 스타일 · 구성 · 아이콘을 서버(Redis)에 모아 두고 다시 쓴다
   서버: /api/channel?op=lib (운영자 전용) · 기기 어디서나 같은 보관함
   종류: bg 배경(다시 쓰면 이미지 생성 0원) · style 전부 AI 이미지(다음 생성의 참고 이미지 + 분위기 설명)
         preset 구성(말머리·제목 패턴·항목 이름·요청 문구 → 같은 틀로) · icon 양식별 아이콘(양식 카드 제목 옆에 고정)
   추천: 같은 카드 종류 · 양식 · 시장 · 제목 낱말이 겹칠수록 위로 (즐겨찾기·많이 쓴 것 가산)
   ============================================================ */
var LIBS = { items: null, at: 0, cache: {}, loading: null };
var LIB_KIND = { bg: "🖼️ 배경", style: "🎨 스타일", preset: "🧩 구성", icon: "🔣 아이콘" };
var TPL_ICON = {};   // 양식(cat) → Image (기본 아이콘)
function libTok() { return typeof ocTok === "function" ? ocTok() : ""; }
function libApi(body, q) {
  var url = "/api/channel?op=lib" + (q || "");
  var opt = body ? { method: "POST", headers: { "x-owner": libTok(), "Content-Type": "application/json" }, body: JSON.stringify(body) } : { headers: { "x-owner": libTok() } };
  return fetch(url, opt).then(function (r) { return r.json(); });
}
function libLoad(force) {
  if (LIBS.items && !force && Date.now() - LIBS.at < 60e3) return Promise.resolve(LIBS.items);
  if (LIBS.loading && !force) return LIBS.loading;
  LIBS.loading = libApi(null).then(function (j) { LIBS.loading = null; LIBS.items = j && j.ok ? j.items : []; LIBS.at = Date.now(); LIBS.err = j && !j.ok ? j.reason : null; return LIBS.items; }).catch(function () { LIBS.loading = null; LIBS.items = LIBS.items || []; return LIBS.items; });
  return LIBS.loading;
}
function libGet(id) {
  if (LIBS.cache[id]) return Promise.resolve(LIBS.cache[id]);
  return libApi(null, "&id=" + encodeURIComponent(id)).then(function (j) { if (j && j.ok) LIBS.cache[id] = j; return j; });
}
function libSave(e) { return libApi({ act: "save", kind: e.kind, name: e.name, tags: e.tags, img: e.img, data: e.data, thumb: e.thumb }).then(function (j) { if (j && j.ok) { LIBS.items = [j.item].concat(LIBS.items || []); } return j; }); }
function libUpd(id, patch) { return libApi(Object.assign({ act: "upd", id: id }, patch)).then(function (j) { if (j && j.ok && LIBS.items) LIBS.items = LIBS.items.map(function (x) { return x.id === id ? j.item : (patch.def && x.kind === j.item.kind && x.tags.tpl === j.item.tags.tpl ? Object.assign({}, x, { def: false }) : x); }); return j; }); }
function libDel(id) { return libApi({ act: "del", id: id }).then(function (j) { if (j && j.ok && LIBS.items) LIBS.items = LIBS.items.filter(function (x) { return x.id !== id; }); delete LIBS.cache[id]; return j; }); }
function libUse(id) { libApi({ act: "use", id: id }).catch(function () {}); }
/* 이미지 줄이기: 원본(이미지·캔버스·URL) → JPEG data URL */
function libShrink(src, maxW, q, png) {
  function draw(im) { var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, s = Math.min(1, maxW / w), cv = document.createElement("canvas"); cv.width = Math.round(w * s); cv.height = Math.round(h * s); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL(png ? "image/png" : "image/jpeg", q || 0.84); }
  if (typeof src === "string") return new Promise(function (ok, no) { var im = new Image(); im.onload = function () { ok(draw(im)); }; im.onerror = no; im.src = src; });
  return Promise.resolve(draw(src));
}
/* 지금 작업의 꼬리표 */
function libWords(s) { return (String(s || "").replace(/\[\[|\]\]/g, "").match(/[가-힣A-Za-z]{2,}/g) || []).filter(function (w) { return !/^(오늘|지금|이번|그리고|the|and)$/.test(w); }).slice(0, 10); }
function libTagsOf(st) { var ctx = st.ctx || "", k = ctx.split(":")[0]; return { ctx: ctx, k: k, tpl: st.tpl || (k === "tpl" ? ctx.split(":")[1] : ""), mk: st.mk && st.mk.k ? st.mk.k : (ctx.split(":")[3] || ""), words: libWords(st.title + " " + (st.plan ? st.plan.title : "")) }; }
function libScore(x, t) {
  var s = 0, a = x.tags || {};
  if (t.ctx && a.ctx === t.ctx) s += 4;
  if (t.k && a.k === t.k) s += 2;
  if (t.tpl && a.tpl === t.tpl) s += 3;
  if (t.mk && a.mk === t.mk) s += 1;
  (a.words || []).forEach(function (w) { if ((t.words || []).indexOf(w) >= 0) s += 1; });
  if (x.fav) s += 2; s += Math.min(2, (x.uses || 0) * 0.3);
  return s;
}
function libSuggest(t, kinds, n) {
  return (LIBS.items || []).filter(function (x) { return kinds.indexOf(x.kind) >= 0; }).map(function (x) { return { x: x, s: libScore(x, t) }; })
    .sort(function (a, b) { return b.s - a.s || b.x.at - a.x.at; }).slice(0, n || 6).map(function (o) { return o.x; });
}
/* 양식 기본 아이콘 불러오기 → TPL_ICON */
function libLoadIcons() {
  return libLoad().then(function (items) {
    var defs = items.filter(function (x) { return x.kind === "icon" && x.def && x.tags && x.tags.tpl; });
    TPL_ICON = {};
    return Promise.all(defs.map(function (x) { return libGet(x.id).then(function (j) { if (!j || !j.img) return; return new Promise(function (ok) { var im = new Image(); im.onload = function () { TPL_ICON[x.tags.tpl] = im; ok(); }; im.onerror = ok; im.src = j.img; }); }); }));
  });
}
function libChip(x) {
  return '<button class="libChip" data-lib="' + x.id + '" title="' + escapeHtml(x.name) + '">' + (x.thumb ? '<img src="' + x.thumb + '" alt="">' : '<i>' + (LIB_KIND[x.kind] || "").split(" ")[0] + '</i>') + '<span><b>' + escapeHtml(x.name) + '</b><small>' + (LIB_KIND[x.kind] || x.kind) + (x.fav ? " · ★" : "") + (x.uses ? " · " + x.uses + "회" : "") + '</small></span></button>';
}

/* ---------- AI 작업창 연결: ② 보관함 추천 · ③ 💾 보관 ---------- */
function libStudioSuggest(st, el, api) {
  var box = el.querySelector(".aiLib"); if (!box) return;
  box.innerHTML = '<div class="briefDim">📚 보관함 불러오는 중…</div>';
  libLoad().then(function () {
    if (LIBS.err) { box.innerHTML = '<div class="briefDim">📚 보관함을 쓸 수 없어요 (' + LIBS.err + ')</div>'; return; }
    var t = libTagsOf(st), list = libSuggest(t, ["bg", "style", "preset"], 6);
    box.innerHTML = '<label class="aiLbl">📚 보관함에서 쓰기 <small>비슷한 순 · 배경은 다시 쓰면 0원 · 스타일은 참고 이미지로 · 구성은 같은 틀로</small></label>' +
      (list.length ? '<div class="libRow">' + list.map(libChip).join("") + '</div>' : '<div class="briefDim">아직 보관한 게 없어요. 결과가 마음에 들면 ③의 💾 보관을 눌러 두세요.</div>') +
      (st.libUsed ? '<div class="libUsed">사용 중: ' + st.libUsed.map(escapeHtml).join(" · ") + ' <button class="linkBtn" data-libclear>해제</button></div>' : '');
    Array.prototype.forEach.call(box.querySelectorAll("[data-lib]"), function (b) { b.onclick = function () { libApply(st, b.getAttribute("data-lib"), el, api); }; });
    var cl = box.querySelector("[data-libclear]"); if (cl) cl.onclick = function () { st.bgFixed = false; st.bgImg = null; st.styleVisual = null; st.presetData = null; st.libUsed = null; libStudioSuggest(st, el, api); api.render(); };
  });
}
function libApply(st, id, el, api) {
  var x = (LIBS.items || []).filter(function (i) { return i.id === id; })[0]; if (!x) return;
  api.banner("info", "보관함에서 불러오는 중…");
  libGet(id).then(function (j) {
    if (!j || !j.ok) { api.banner("bad", "불러오지 못했어요"); return; }
    st.libUsed = (st.libUsed || []).filter(function (n) { return n.indexOf(LIB_KIND[x.kind]) !== 0; }).concat([LIB_KIND[x.kind] + " " + x.name]);
    libUse(id);
    if (x.kind === "bg") {
      return aiLoadImg(j.img).then(function (im) { st.bgImg = im; st.bgFixed = true; api.setMode("bg"); api.banner("ok", "보관한 배경을 씁니다 — 이미지 생성 없이 0원. ②에서 만들기를 누르면 글·숫자를 그 위에 그려요."); libStudioSuggest(st, el, api); });
    }
    if (x.kind === "style") {
      st.styleVisual = j.data && j.data.visual || ""; if (j.img && st.imgs.length < 3) { st.imgs.push(j.img); api.thumbs(); }
      api.banner("ok", "보관한 스타일을 참고합니다 — 기획 때 참고 이미지로 보내고, 이미지 생성 때 같은 분위기 설명을 씁니다."); libStudioSuggest(st, el, api); return;
    }
    if (x.kind === "preset") {
      var d = j.data || {}; st.presetData = d;
      var tsel = el.querySelector(".aiTpl"); if (tsel && d.tpl != null) { tsel.value = d.tpl; tsel.dispatchEvent(new Event("change")); }
      var g = el.querySelector(".aiGoal"); if (g && d.goal) g.value = d.goal;
      var rq = el.querySelector(".aiReq"); if (rq && d.req && rq.value.indexOf(d.req) < 0) rq.value = (rq.value ? rq.value + "\n" : "") + d.req;
      api.banner("ok", "보관한 구성을 씁니다 — 말머리·제목 패턴·항목 구성을 따라 하고 숫자만 새 재료로 채워요. ②에서 만들기를 누르세요."); libStudioSuggest(st, el, api);
    }
  });
}
function libPresetText(d) {
  if (!d || !d.plan) return "";
  var p = d.plan;
  return "보관한 구성(이 틀을 그대로 따르고 숫자·내용만 새 재료로): 말머리 '" + (p.kicker || "") + "', 제목 패턴 '" + String(p.title || "").replace(/\n/g, " / ") + "', layout=" + (p.layout || "list") + ", 항목 " + (p.items || []).length + "개(" + (p.items || []).map(function (i) { return i.label; }).join(", ") + ")" + (p.cta ? ", 유도 문구 '" + p.cta + "'" : "");
}
function libSaveMenu(st, el, api) {
  var old = el.querySelector(".libSave"); if (old) { old.remove(); return; }
  var can = [];
  if (st.bgImg && !st.bgFixed) can.push(["bg", "🖼️ 배경 이미지", "다음에 같은 종류 카드에서 0원으로 다시 쓰기"]);
  if (st.fullImg) can.push(["style", "🎨 스타일 (전부 AI 이미지)", "다음 생성 때 참고 이미지 + 같은 분위기"]);
  if (st.plan) can.push(["preset", "🧩 구성", "말머리·제목 패턴·항목 구성·요청 문구"]);
  if (!can.length) { alert("보관할 결과가 아직 없어요."); return; }
  var d = document.createElement("div"); d.className = "libSave";
  d.innerHTML = '<b>💾 보관함에 저장</b>' + can.map(function (c, i) { return '<label><input type="checkbox" value="' + c[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + c[1] + ' <small>' + c[2] + '</small></label>'; }).join("") +
    '<input class="libName" placeholder="이름 (비우면 자동)" value="' + escapeHtml((st.title || "").slice(0, 30)) + '"><div class="row" style="gap:6px"><button class="primary" data-libgo>저장</button><button class="chip" data-libx>닫기</button><span class="briefDim libMsg"></span></div>';
  el.querySelector(".aiActs").after(d);
  d.querySelector("[data-libx]").onclick = function () { d.remove(); };
  d.querySelector("[data-libgo]").onclick = function () {
    var kinds = Array.prototype.map.call(d.querySelectorAll("input[type=checkbox]:checked"), function (c) { return c.value; }); if (!kinds.length) return;
    var name = d.querySelector(".libName").value.trim() || st.title, tags = libTagsOf(st), msg = d.querySelector(".libMsg"), btn = this; btn.disabled = true; msg.textContent = "저장 중…";
    var jobs = kinds.map(function (k) {
      if (k === "bg") return Promise.all([libShrink(st.bgImg, 1024, 0.82), libShrink(st.bgImg, 160, 0.7)]).then(function (r) { return libSave({ kind: "bg", name: name, tags: tags, img: r[0], thumb: r[1], data: { visual: st.plan && st.plan.visual || "" } }); });
      if (k === "style") return Promise.all([libShrink(st.fullUrl || st.fullImg, 1024, 0.82), libShrink(st.fullUrl || st.fullImg, 160, 0.7)]).then(function (r) { return libSave({ kind: "style", name: name, tags: tags, img: r[0], thumb: r[1], data: { visual: st.plan && st.plan.visual || "", title: st.plan && st.plan.title } }); });
      var req = el.querySelector(".aiReq"), goal = el.querySelector(".aiGoal");
      return (st.url ? libShrink(st.url, 160, 0.7) : Promise.resolve(null)).then(function (th) { return libSave({ kind: "preset", name: name, tags: tags, thumb: th, data: { tpl: st.tpl || "", req: req ? req.value.trim() : "", goal: goal ? goal.value : "", plan: { kicker: st.plan.kicker, title: st.plan.title, subtitle: st.plan.subtitle, layout: st.plan.layout, items: (st.plan.items || []).map(function (i) { return { label: i.label, value: i.value, sub: i.sub }; }), cta: st.plan.cta, visual: st.plan.visual } } }); });
    });
    Promise.all(jobs).then(function (rs) { var bad = rs.filter(function (r) { return !r || !r.ok; }); btn.disabled = false; msg.textContent = bad.length ? "일부 실패: " + (bad[0] && bad[0].reason || "") : "저장했어요 ✓ (카드 만들기 → 📚 보관함에서 관리)"; if (!bad.length) setTimeout(function () { d.remove(); }, 1600); });
  };
}

/* ---------- 카드 만들기 → 📚 보관함 탭 ---------- */
var LIBUI = { kind: "all" };
function libTabRender(pane) {
  pane.innerHTML = '<div class="briefDim">보관함 불러오는 중…</div>';
  libLoad(true).then(function (items) {
    if (LIBS.err) { pane.innerHTML = '<div class="briefDim">보관함을 쓸 수 없어요 (' + LIBS.err + ') — 서버 저장소(Upstash Redis) 연결을 확인해 주세요.</div>'; return; }
    var bytes = items.reduce(function (a, x) { return a + (x.size || 0); }, 0), kinds = ["all", "bg", "style", "preset", "icon"];
    var h = '<div class="briefDim" style="margin-bottom:8px">AI로 만든 배경·스타일·구성·아이콘을 서버에 보관해 PC·휴대폰 어디서나 다시 써요. 지금 ' + items.length + '개 · ' + (bytes / 1e6).toFixed(1) + 'MB (즐겨찾기 아닌 것 300개 · 120MB를 넘으면 오래되고 덜 쓴 것부터 자동 정리)</div>';
    h += '<div class="pills seg" style="margin-bottom:10px">' + kinds.map(function (k) { return '<button data-lk="' + k + '"' + (k === LIBUI.kind ? ' class="active"' : '') + '>' + (k === "all" ? "전체" : LIB_KIND[k]) + ' <small>' + (k === "all" ? items.length : items.filter(function (x) { return x.kind === k; }).length) + '</small></button>'; }).join("") + '</div>';
    if (LIBUI.kind === "all" || LIBUI.kind === "icon") {
      h += '<div class="libIconMake"><b>🔣 양식 아이콘 만들기</b> <small class="briefDim">양식 카드 제목 옆에 붙는 고정 아이콘 · AI 이미지 1장(약 40원)</small><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><select class="libIcCat">' + Object.keys(TPL_CAT).map(function (k) { return '<option value="' + k + '">' + TPL_CAT[k].icon + " " + TPL_CAT[k].name + '</option>'; }).join("") + '</select><input class="libIcSub" placeholder="그릴 것 (예: 금색 트로피, 상승 화살표 달력)"><button class="primary" data-icmake>🎨 만들기</button><span class="briefDim libIcMsg"></span></div></div>';
    }
    var list = items.filter(function (x) { return LIBUI.kind === "all" || x.kind === LIBUI.kind; });
    h += list.length ? '<div class="libGrid">' + list.map(function (x) {
      var t = x.tags || {};
      return '<div class="libCard' + (x.def ? ' def' : '') + '">' + (x.thumb ? '<img src="' + x.thumb + '" alt="">' : '<div class="libNoImg">' + (LIB_KIND[x.kind] || "").split(" ")[0] + '</div>') +
        '<div class="libMeta"><b>' + escapeHtml(x.name) + '</b><small>' + (LIB_KIND[x.kind] || x.kind) + (t.tpl && TPL_CAT[t.tpl] ? " · " + TPL_CAT[t.tpl].name : "") + (t.mk ? " · " + t.mk : "") + (x.uses ? " · " + x.uses + "회 사용" : "") + '</small>' +
        '<small>' + new Date(x.at).toLocaleDateString("ko-KR") + (x.def ? ' · <b style="color:#b8913f">양식 기본 아이콘</b>' : '') + '</small></div>' +
        '<div class="libBtns"><button class="chip" data-lfav="' + x.id + '">' + (x.fav ? "★" : "☆") + '</button><button class="chip" data-lren="' + x.id + '">이름</button>' + (x.kind === "icon" ? '<button class="chip" data-ldef="' + x.id + '">' + (x.def ? "기본 해제" : "기본으로") + '</button>' : '') + '<button class="chip" data-ldel="' + x.id + '">🗑</button></div></div>';
    }).join("") + '</div>' : '<div class="briefDim" style="padding:12px 0">아직 없어요. AI 작업창 ③의 💾 보관으로 저장하거나, 위에서 아이콘을 만들어 보세요.</div>';
    pane.innerHTML = h;
    Array.prototype.forEach.call(pane.querySelectorAll("[data-lk]"), function (b) { b.onclick = function () { LIBUI.kind = b.getAttribute("data-lk"); libTabRender(pane); }; });
    Array.prototype.forEach.call(pane.querySelectorAll("[data-lfav]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-lfav"), x = LIBS.items.filter(function (i) { return i.id === id; })[0]; libUpd(id, { fav: !x.fav }).then(function () { libTabRender(pane); }); }; });
    Array.prototype.forEach.call(pane.querySelectorAll("[data-lren]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-lren"), x = LIBS.items.filter(function (i) { return i.id === id; })[0], n = prompt("새 이름", x.name); if (n != null && n.trim()) libUpd(id, { name: n.trim() }).then(function () { libTabRender(pane); }); }; });
    Array.prototype.forEach.call(pane.querySelectorAll("[data-ldef]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-ldef"), x = LIBS.items.filter(function (i) { return i.id === id; })[0]; libUpd(id, { def: !x.def }).then(function () { return libLoadIcons(); }).then(function () { libTabRender(pane); }); }; });
    Array.prototype.forEach.call(pane.querySelectorAll("[data-ldel]"), function (b) { b.onclick = function () { if (!confirm("보관함에서 지울까요? (되돌릴 수 없어요)")) return; libDel(b.getAttribute("data-ldel")).then(function () { return libLoadIcons(); }).then(function () { libTabRender(pane); }); }; });
    var mk = pane.querySelector("[data-icmake]");
    if (mk) mk.onclick = function () {
      var cat = pane.querySelector(".libIcCat").value, sub = pane.querySelector(".libIcSub").value.trim() || TPL_CAT[cat].name, msg = pane.querySelector(".libIcMsg"), btn = this;
      btn.disabled = true; msg.textContent = "AI가 아이콘을 그리는 중… (20~60초)";
      aiCall({ mode: "image", scope: "icon", subject: sub, plan: { title: sub } }).then(function (j) {
        if (!(j && j.ok && j.image)) throw new Error((j && (j.reason || "")) || "실패");
        return Promise.all([libShrink(j.image, 256, 0.9, true), libShrink(j.image, 120, 0.8)]).then(function (r) {
          var hasDef = (LIBS.items || []).some(function (x) { return x.kind === "icon" && x.def && x.tags.tpl === cat; });
          return libSave({ kind: "icon", name: TPL_CAT[cat].name + " · " + sub, tags: { tpl: cat, k: "tpl", words: libWords(sub) }, img: r[0], thumb: r[1] }).then(function (s) { if (s && s.ok && !hasDef) return libUpd(s.item.id, { def: true }); });
        });
      }).then(function () { return libLoadIcons(); }).then(function () { btn.disabled = false; msg.textContent = "만들었어요 ✓"; libTabRender(pane); })
        .catch(function (e) { btn.disabled = false; msg.textContent = "실패: " + e.message; });
    };
  });
}
