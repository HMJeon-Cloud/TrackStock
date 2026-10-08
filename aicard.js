/* ============================================================
   AI 대표 카드 (v9.7) — 모든 카드 묶음 옆의 "✨ AI" 버튼 하나로.
   ① 카드 묶음에 들어 있는 '모든 글자'를 줄(F1…Fn)로 읽어 원본 데이터로 쓴다 (일부가 아니라 전체)
   ② AI 사용 범위를 고른다: 앱 카드(AI 없음) · 배경만 AI(글·숫자는 앱이 그려 정확) · 전부 AI(글·문구까지 AI가 그림)
   ③ [기획하기] → (배경만/전부면 이미지까지) → 한 화면에서 원본 데이터 · 카드 · 검증/고치기를 나란히 비교
   내 글 카드도 같은 창(원본 데이터 칸에 글을 쓰거나 앱 데이터를 붙여 넣음).
   자동 실행 없음 — AI는 [기획하기]·[이미지 만들기]를 누를 때만.
   ============================================================ */
var AI_SKIP = /^(우상향연구소|@?uphill\.lab|UPHILL\.LAB · 우상향연구소|\d+\s*\/\s*\d+|저장|[·•\-–—›→↗]|.)$/;
var AI_MODE_NM = { app: ["앱 카드", "AI 없음 · 무료"], bg: ["배경만 AI", "글·숫자는 앱(정확)"], full: ["전부 AI", "글·문구까지 AI가 그림"] };
var AI_LAST_MODE = "app";
try { AI_LAST_MODE = localStorage.getItem("sm.aiMode") || "app"; } catch (e) {}

/* ---------- ① 카드 묶음의 모든 글자 읽기 ---------- */
function aiCapture(fn) {
  var orig = window.cText, rec = [], out;
  window.cText = function (g, s) {
    var r = orig.apply(this, arguments);
    try { rec.push({ cv: g.canvas, s: String(s), x: arguments[2], y: arguments[3], size: arguments[4] || 20, w: g.measureText(String(s)).width, align: arguments[7] || "left" }); } catch (e) {}
    return r;
  };
  try { out = fn(); } finally { window.cText = orig; }
  return { out: out, rec: rec };
}
function aiLinesFrom(list, rec) {
  var out = [], id = 0, seen = {};   // 여러 장에 반복되는 머리(꼬리표·날짜·출처)는 처음 한 번만
  (list || []).forEach(function (it) {
    var R = rec.filter(function (r) { return r.cv === it.cv && r.s.trim(); });
    R.forEach(function (r) { r.l = r.align === "right" ? r.x - r.w : r.align === "center" ? r.x - r.w / 2 : r.x; });
    R.sort(function (a, b) { return a.y - b.y || a.l - b.l; });
    var rows = [];
    R.forEach(function (r) { var last = rows[rows.length - 1]; if (last && Math.abs(r.y - last.y) <= Math.max(6, Math.min(r.size, last.size) * 0.4)) last.items.push(r); else rows.push({ y: r.y, items: [r] }); });
    var card = typeof ocDeckName === "function" ? ocDeckName(it.name) : it.name, prev = "";
    rows.forEach(function (row) {
      row.items.sort(function (a, b) { return a.l - b.l; });
      var t = "", px = null;
      row.items.forEach(function (r) { if (px !== null) t += r.l - px > 30 ? " · " : r.l - px > 2 ? " " : ""; t += r.s; px = r.l + r.w; });
      t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "").replace(/\s+/g, " ").trim();
      if (!t || AI_SKIP.test(t) || t === prev || seen[t]) return; prev = t; seen[t] = 1;
      out.push({ id: "F" + (++id), card: card, text: t });
    });
  });
  return out;
}
function aiTitleOf(ctx) {
  var kind = ctx.split(":")[0], arg = ctx.split(":").slice(1).join(":"), R = briefState.result;
  if (kind === "brief") { var mk = R && cMktInfo(R); return (mk ? mk.name : "전체") + " " + (R && R.mode === "week" ? "금주" : "금일") + " 브리핑"; }
  if (kind === "channel") return "채널 전일 정리";
  if (kind === "per") return ocClean(PER_SETS[arg] ? PER_SETS[arg].t : "정기 발행");
  if (kind === "story") { var d = storyDecks().filter(function (x) { return x.key === arg; })[0]; return ocClean(d ? d.t : "연구노트"); }
  if (kind === "policy") { var p = pubPolicyAll().filter(function (x) { return x.id === arg; })[0]; return ocClean(p ? p.t : "정책 카드"); }
  if (kind === "cal") return "이번 주 일정";
  if (kind === "term") return "용어 한 입";
  if (kind === "issues") return "핵심 이슈 5";
  if (kind === "reel") { var x = REEL_LIST.filter(function (z) { return z.id === arg; })[0]; return "릴스 · " + (x ? x.t : arg); }
  return "대표 카드";
}
/* 카드 묶음 다시 만들기(화면에 띄우지 않고) + 글자 수집 */
function aiDeck(ctx) {
  var kind = ctx.split(":")[0], arg = ctx.split(":").slice(1).join(":");
  function cap(fn) { var keep = [CARD_STYLE, CARD_SERIES, CARD_UNIT, CARD_MKT]; try { var c = aiCapture(fn); return { list: c.out || [], lines: aiLinesFrom(c.out || [], c.rec) }; } finally { CARD_STYLE = keep[0]; CARD_SERIES = keep[1]; CARD_UNIT = keep[2]; CARD_MKT = keep[3]; } }
  var draft = false;
  if (kind === "brief") {
    if (!briefState.result) return Promise.reject(new Error("오늘의 브리핑 데이터가 아직 없어요"));
    return cardsNewsFetch(briefState.result).catch(function () { return []; }).then(function () {
      return cap(function () {
        CARD_STYLE = "event"; CARD_UNIT = briefState.market === "coin" ? "코인" : ""; CARD_MKT = cMktInfo(briefState.result); CARD_SERIES = CARD_MKT ? "DAILY · " + CARD_MKT.name + " 전일 정리" : "DAILY · 전일 정리";
        var l = cardsBrief(), iss = issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular, mode: briefState.result.mode });
        if (l.length && iss && iss.length) l.unshift({ name: "0_핵심이슈5", cv: issuesCard(iss) });
        if (CARD_NEWS.items.length) l = l.concat(cardsNews(CARD_NEWS.items, cDate(Date.now())));
        return l;
      });
    });
  }
  if (kind === "channel") return Promise.resolve(cap(function () { CARD_STYLE = "regular"; CARD_SERIES = "CHANNEL · " + cDate(Date.now()); var l = cardsChannel(); if (l.length && chState.issues && chState.issues.length) l.unshift({ name: "0_핵심이슈5", cv: issuesCard(chState.issues) }); return l; }));
  if (kind === "per") {
    var S = PER_SETS[arg], V = perVerify(arg); draft = !!(S.mode && (V.hard || V.early));
    var need = arg === "monthPreview" || arg === "monthReview" ? PER_SEASON.map(function (a) { return a[0]; }) : [];
    return perLoad(need).then(function () { var r = cap(function () { return perCards(arg, draft); }); r.draft = draft; return r; });
  }
  if (kind === "story") return storyPrepare(arg).then(function () { if (!storyReady(arg.split(":")[0])) throw new Error("연구노트 데이터가 아직 준비되지 않았어요(채널 화면 계산 후)"); return cap(function () { return storyCards(arg); }); });
  if (kind === "policy") { var pl = pubPolicyAll().filter(function (p) { return p.id === arg; })[0]; return Promise.resolve(cap(function () { return pubPolicyCards(pl); })); }
  if (kind === "cal") return Promise.resolve(cap(function () { return [{ name: "이번 주 일정", cv: pubCalCard() }]; }));
  if (kind === "term") return Promise.resolve(cap(function () { return [{ name: "용어 한 입", cv: pubTermCard(pubTerm(pubState.termOffset)) }]; }));
  if (kind === "issues") return Promise.resolve(cap(function () { var l = chState.issues && chState.issues.length ? chState.issues : issuesCompute(briefState.recent, { market: briefState.market }); return [{ name: "핵심 이슈 5", cv: issuesCard(l) }]; }));
  if (kind === "reel") {
    var needD = REEL_DATA[arg] && arg !== "loss";
    return (needD && typeof nbLoad === "function" ? nbLoad(REEL_HIST) : Promise.resolve()).then(function () {
      var r = reelGet(arg); if (!r) throw new Error("이 릴스에 필요한 데이터가 아직 없어요");
      var c = cap(function () { return reelImages(r); }); c.reel = r; return c;
    });
  }
  return Promise.reject(new Error("알 수 없는 카드 묶음: " + ctx));
}

/* ---------- 비교 도우미 ---------- */
function aiNorm(s) { return String(s || "").replace(/[\s,]/g, "").replace(/[‐-―−]/g, "-"); }
function aiTok(s) { return (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(function (x) { return x.replace(/,/g, "").replace(/^0+(?=\d)/, ""); }); }
function aiRefFind(lines, value, label) {
  var v = aiNorm(value); if (!v) return "";
  var hit = lines.filter(function (l) { return aiNorm(l.text).indexOf(v) >= 0; });
  if (label) { var w = String(label).split(/\s+/)[0]; var h2 = hit.filter(function (l) { return w && l.text.indexOf(w) >= 0; }); if (h2.length) return h2[0].id; }
  return hit.length ? hit[0].id : "";
}
function aiLine(st, id) { return st.lines.filter(function (l) { return l.id === id; })[0]; }
function aiItemCheck(st, it) {
  if (!it || !it.value) return { ok: true, t: "" };
  var L = aiLine(st, it.ref), v = aiNorm(it.value);
  if (L && aiNorm(L.text).indexOf(v) >= 0) return { ok: true, t: "값이 근거 줄과 일치" };
  var other = aiRefFind(st.lines, it.value);
  if (other) return { ok: true, t: "값이 " + other + " 줄에 있어요" + (it.ref ? " (적힌 근거 " + it.ref + "와 다름)" : ""), alt: other };
  if (st.extraOk && st.extraOk(it.value)) return { ok: true, t: "앱 계산값(카드 묶음 데이터)" };
  return { ok: false, t: "근거 줄에 없는 값 — 고치거나 지우세요" };
}

/* ---------- ② 기획 (규칙 · AI) ---------- */
function aiRulePlan(st) {
  var sp = st.spec, L = st.lines;
  if (sp) {
    var hf = ocFact(sp, sp.hero), rows = (sp.rows || []).map(function (id) { return ocFact(sp, id); }).filter(Boolean);
    function it(f) { return { label: f.label, value: f.value, sub: "", ref: aiRefFind(L, f.value, f.label) }; }
    return { kicker: sp.kicker || "", title: cPlain(ocFill(sp, sp.hook)), subtitle: sp.mk ? sp.mk.name + " · " + sp.mk.date : "", layout: hf && hf.value.length <= 12 ? "hero" : "list",
      hero: hf ? it(hf) : { label: "", value: "", ref: "" }, items: (hf && hf.value.length > 12 ? [hf] : []).concat(rows).slice(0, 5).map(it), cta: cPlain(ocFill(sp, sp.teaser)), visual: "" };
  }
  if (st.reel) {
    var r = st.reel;
    return { kicker: r.t || "", title: cPlain(r.hook.join("\n")), subtitle: "", layout: "list", hero: { label: "", value: "", ref: "" },
      items: r.items.slice(0, 5).map(function (x) { return { label: x[0], value: x[1].length <= 24 ? x[1] : "", sub: x[1].length > 24 ? x[1].slice(0, 30) : "", ref: aiRefFind(L, x[1].length <= 24 ? x[1] : x[0], x[0]) }; }), cta: n2cta(st), visual: "" };
  }
  // 내 글 등: 첫 줄 제목, 숫자가 있는 줄을 항목으로
  var first = L[0] ? L[0].text : st.title, items = [];
  L.slice(1).forEach(function (l) {
    if (items.length >= 5) return;
    var m = l.text.replace(/^[-·•*]\s*/, "").match(/^(.{1,20}?)\s*[:：]\s*(.+)$/);
    if (m) items.push({ label: m[1], value: m[2].slice(0, 24), sub: "", ref: l.id });
    else if (/\d/.test(l.text)) items.push({ label: l.text.slice(0, 20), value: "", sub: "", ref: l.id });
  });
  return { kicker: st.hint || "", title: first.replace(/^\[데이터\]\s*/, ""), subtitle: "", layout: "list", hero: { label: "", value: "", ref: "" }, items: items, cta: "자세한 내용은 게시물에서", visual: "" };
}
function n2cta(st) { return st.list && st.list.length > 1 ? st.list.length + "장 전체는 게시물에서" : "자세한 내용은 게시물에서"; }
function aiCleanPlan(p) {
  p = p || {}; var c = function (s) { return ocClean(String(s || "")).replace(/\\n/g, "\n"); };
  return { kicker: c(p.kicker), title: String(p.title || "").replace(/\\n/g, "\n").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim(), subtitle: c(p.subtitle), layout: /^(rank|hero|list)$/.test(p.layout) ? p.layout : "rank",
    hero: p.hero && p.hero.value ? { label: c(p.hero.label), value: c(p.hero.value), ref: String(p.hero.ref || "").toUpperCase() } : { label: "", value: "", ref: "" },
    items: (p.items || []).slice(0, 6).map(function (x) { return { label: c(x.label), value: c(x.value), sub: c(x.sub), ref: String(x.ref || "").toUpperCase() }; }), cta: c(p.cta), visual: String(p.visual || "").slice(0, 600) };
}

/* ---------- ③ 그리기 (앱이 글자를 그림: 앱 카드 · 배경만 AI) ---------- */
function aiHi(s) { return String(s).replace(/(?<![A-Za-z&\d.])([+\-]?\d[\d,]*(?:\.\d+)?%?)/g, "[[$1]]"); }
function aiPlanCard(st) {
  var p = st.plan, c = rNew(), g = c.g, P = REEL.P, W = REEL.W - P * 2, mk = st.mk;
  if (st.bgImg && st.mode === "bg" && OC_LAYER !== "text") {
    var im = st.bgImg, sc = Math.max(REEL.W / im.width, REEL.H / im.height), dw = im.width * sc, dh = im.height * sc;
    g.drawImage(im, (REEL.W - dw) / 2, (REEL.H - dh) / 2, dw, dh);
    var ov = g.createLinearGradient(0, 0, 0, REEL.H); ov.addColorStop(0, "rgba(0,0,0,0.55)"); ov.addColorStop(0.35, "rgba(0,0,0,0.45)"); ov.addColorStop(1, "rgba(0,0,0,0.78)"); g.fillStyle = ov; g.fillRect(0, 0, REEL.W, REEL.H);
  }
  if (mk && OC_LAYER !== "text") { g.fillStyle = mk.c; g.fillRect(0, 0, REEL.W, 14); g.fillRect(0, 0, 14, REEL.H); }
  if (OC_LAYER === "bg") return c.cv;
  rBrand(g, REEL.TOP + 30); ocBadge(g, mk, REEL.TOP);
  var y = REEL.TOP + 110;
  if (p.kicker) { var kw = cW(g, p.kicker, 32, 800) + 44; cRound(g, P, y, kw, 56, 28, "rgba(201,162,79,0.22)"); cText(g, p.kicker, P + 22, y + 39, 32, 800, REEL_C.gold2); y += 80; }
  var lines = String(p.title || "").split("\n").filter(Boolean).slice(0, 3);
  if (lines.length === 1 && cW(g, lines[0], 64, 900) > W) { var ws = lines[0].split(" "), hf = Math.ceil(ws.length / 2); lines = [ws.slice(0, hf).join(" "), ws.slice(hf).join(" ")]; }
  var size = rFitSize(g, lines, W, 84);
  lines.forEach(function (l, i) { rRich(g, aiHi(l), P, y + size + i * size * 1.22, size, REEL_C.txt, REEL_C.gold2); });
  y += size + (lines.length - 1) * size * 1.22 + 26;
  if (p.subtitle) { rWrap(g, p.subtitle, P, y + 30, W, 30, 600, REEL_C.txt2, 40, 2); y += 60; }
  y += 20;
  var nIt = (p.items || []).filter(function (x) { return x.label || x.value; }).length, heroH = p.layout === "hero" && p.hero && p.hero.value ? 224 : 0;
  var deckOn = st.deckNames && st.deckNames.length > 1 && (REEL.BOT - 170 - 140 - y - heroH) / Math.max(1, Math.min(nIt, 3)) >= 104;   // 항목이 우선 — 자리가 모자라면 '게시물 구성'은 뺀다
  var bottom = REEL.BOT - 170 - (deckOn ? 140 : 0);
  if (p.layout === "hero" && p.hero && p.hero.value) {
    var hh = 200; cRound(g, P, y, W, hh, 28, "rgba(255,255,255,0.08)"); g.fillStyle = mk ? mk.c : REEL_C.gold; g.fillRect(P, y + 26, 8, hh - 52);
    rWrap(g, p.hero.label, P + 44, y + 60, W - 88, 32, 700, REEL_C.txt2, 40, 1);
    var vs = 124; while (vs > 60 && cW(g, p.hero.value, vs, 900) > W - 88) vs -= 6;
    cText(g, p.hero.value, P + 40, y + hh - 44, vs, 900, /^-/.test(p.hero.value) ? REEL_C.down : /^\+/.test(p.hero.value) ? REEL_C.up : REEL_C.gold2);
    y += hh + 24;
  }
  var items = (p.items || []).filter(function (x) { return x.label || x.value; }), room = bottom - y, n = items.length;
  while (n > 1 && room / n < 104) n--;
  items = items.slice(0, n);
  var ih = Math.min(170, Math.floor(room / Math.max(1, n)));
  items.forEach(function (it, i) {
    var yy = y + i * ih, bh = ih - 14, rank = p.layout !== "hero";
    cRound(g, P, yy, W, bh, 22, "rgba(255,255,255,0.08)", "rgba(241,212,138,0.18)");
    var x = P + 26;
    if (rank) { var r0 = Math.min(30, bh / 2 - 8); g.fillStyle = REEL_C.gold; g.beginPath(); g.arc(x + r0, yy + bh / 2, r0, 0, Math.PI * 2); g.fill(); cText(g, String(i + 1), x + r0, yy + bh / 2 + r0 * 0.42, r0 * 1.2, 900, "#141317", "center"); x += r0 * 2 + 22; }
    var longV = it.value && it.value.length > 12, vw = it.value && !longV ? cW(g, it.value, 38, 900) + 44 : 0, mw = P + W - 22 - x - (vw ? vw + 14 : 0);
    var ls = Math.min(40, Math.max(30, bh * 0.3)), hasSub = !!(it.sub || longV), ly = yy + bh / 2 + (hasSub ? -6 : ls * 0.36);
    cText(g, cFit(g, it.label, mw, ls, 800), x, ly, ls, 800, REEL_C.txt);
    if (longV) rWrap(g, it.value, x, ly + 40, P + W - 22 - x, 28, 800, REEL_C.gold2, 34, 1);
    else if (it.sub) cText(g, cFit(g, it.sub, mw, 25, 600), x, ly + 38, 25, 600, REEL_C.txt2);
    if (vw) { var vx = P + W - 22 - vw, col = /^-/.test(it.value) ? REEL_C.down : /^\+/.test(it.value) ? REEL_C.up : REEL_C.gold2; cRound(g, vx, yy + bh / 2 - 32, vw, 64, 32, "rgba(0,0,0,0.35)", col); cText(g, it.value, vx + vw / 2, yy + bh / 2 + 13, 38, 900, col, "center"); }
  });
  if (deckOn) {
    var dy = REEL.BOT - 300; cText(g, "게시물 " + st.deckNames.length + "장 구성", P, dy, 26, 800, REEL_C.gold2);
    var dx = P, dl = 0, uniq = st.deckNames.filter(function (x, i, a) { return a.indexOf(x) === i; });
    uniq.forEach(function (nm) { var w = cW(g, nm, 26, 700) + 30; if (dx + w > P + W) { dx = P; dl++; } if (dl > 1) return; cRound(g, dx, dy + 16 + dl * 48, w, 40, 20, "rgba(255,255,255,0.10)"); cText(g, nm, dx + 15, dy + 45 + dl * 48, 26, 700, REEL_C.txt); dx += w + 8; });
  }
  if (p.cta) { var ty = REEL.BOT - 150; cRound(g, P, ty, W, 104, 52, "rgba(201,162,79,0.16)", REEL_C.gold); cText(g, cFit(g, p.cta, W - 140, 36, 800), REEL.W / 2, ty + 64, 36, 800, REEL_C.txt, "center"); cText(g, "›", P + W - 44, ty + 66, 44, 800, REEL_C.gold2, "center"); }
  cText(g, "@uphill.lab", REEL.W - P, REEL.BOT + 20, 24, 700, REEL_C.dim, "right");
  if (st.src) rWrap(g, st.src, P, REEL.BOT + 20, W - 200, 20, 500, REEL_C.dim, 26, 2);
  return c.cv;
}
function aiFullCard(st) {   // 전부 AI: 받은 2:3 이미지를 9:16 안에 (위아래는 인스타 UI가 덮는 구역)
  var cv = document.createElement("canvas"); cv.width = REEL.W; cv.height = REEL.H; var g = cv.getContext("2d"), im = st.fullImg;
  g.fillStyle = "#000"; g.fillRect(0, 0, REEL.W, REEL.H);
  if (im) { var sc = Math.max(REEL.W / im.width, REEL.H / im.height); g.save(); g.filter = "blur(30px) brightness(0.45)"; g.drawImage(im, (REEL.W - im.width * sc) / 2, (REEL.H - im.height * sc) / 2, im.width * sc, im.height * sc); g.restore();
    var s2 = Math.min(REEL.W / im.width, REEL.H / im.height); g.drawImage(im, (REEL.W - im.width * s2) / 2, (REEL.H - im.height * s2) / 2, im.width * s2, im.height * s2); }
  return cv;
}

/* ---------- ④ 작업창 ---------- */
function aiTok2() { return typeof ocTok === "function" ? ocTok() : ""; }
function aiCall(body) { return fetch("/api/channel?op=ai", { method: "POST", headers: { "x-owner": aiTok2(), "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return { ok: false, reason: "HTTP_" + r.status }; }); }); }
function aiLoadImg(u) { return new Promise(function (ok, no) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error("이미지를 열지 못했어요")); }; im.src = u; }); }
function aiOpen(ctx, btn) {
  if (ctx === "custom") return aiStudio({ ctx: "custom", title: "내 글 · 데이터 한 장 카드", custom: true, lines: [], list: [] });
  var old = btn ? btn.textContent : ""; if (btn) { btn.textContent = "카드 읽는 중…"; btn.disabled = true; }
  aiDeck(ctx).then(function (d) {
    if (btn) { btn.textContent = old; btn.disabled = false; }
    var names = (d.list || []).map(function (it) { return it.name; });
    var spec = null; try { spec = ctx.indexOf("reel:") === 0 ? null : ocDeckSpec(ctx, names, { draft: !!d.draft }); } catch (e) {}
    if (!d.lines.length) { alert("카드 묶음에서 읽을 내용이 없어요. 데이터가 준비된 뒤 다시 눌러 주세요."); return; }
    aiStudio({ ctx: ctx, title: aiTitleOf(ctx), lines: d.lines, list: d.list, spec: spec, reel: d.reel, draft: !!d.draft });
  }).catch(function (e) { if (btn) { btn.textContent = old; btn.disabled = false; } alert("준비하지 못했어요: " + e.message); });
}
function aiStudioClose() { var el = document.getElementById("aiStudio"); if (el) el.remove(); document.removeEventListener("keydown", aiStudioKey, true); }
function aiStudioKey(e) { if (e.key === "Escape" && document.getElementById("aiStudio")) { e.stopPropagation(); aiStudioClose(); } }
function aiStudio(cfg) {
  aiStudioClose(); if (typeof ocStudioClose === "function") ocStudioClose();
  var st = { ctx: cfg.ctx, title: cfg.title, custom: !!cfg.custom, lines: cfg.lines || [], list: cfg.list || [], spec: cfg.spec, reel: cfg.reel, draft: cfg.draft,
    mode: AI_LAST_MODE, imgs: [], plan: null, planBy: "", bgImg: null, fullImg: null, fullUrl: null, ocr: null, ly: "all", url: null, need: "", hint: "" };
  st.deckNames = st.list.map(function (it) { return ocDeckName(it.name); });
  st.mk = st.spec && st.spec.mk ? st.spec.mk : null;
  st.src = st.spec && st.spec.src ? st.spec.src : st.custom ? "" : "카드 묶음 데이터 기준 · 투자 권유 아님";
  st.extraOk = function (v) { if (!st.spec) return false; var n = aiNorm(v); return st.spec.facts.some(function (f) { return aiNorm(f.value) === n; }); };
  var el = document.createElement("div"); el.id = "aiStudio"; el.className = "aiStu";
  el.innerHTML = '<div class="aiIn">' +
    '<div class="aiTop"><div class="aiTtl"><b>대표 카드 · ' + escapeHtml(st.title) + '</b><small>' + (st.custom ? "내 글·앱 데이터 → 릴스 한 장" : "카드 묶음 " + st.list.length + "장의 모든 내용 → 릴스 한 장") + '</small></div>' +
    '<div class="aiSeg"><span>AI 사용 범위</span>' + Object.keys(AI_MODE_NM).map(function (k) { return '<button data-mode="' + k + '"><b>' + AI_MODE_NM[k][0] + '</b><small>' + AI_MODE_NM[k][1] + '</small></button>'; }).join("") + '</div>' +
    '<button class="chip" data-x>닫기</button></div>' +
    '<div class="aiBar"><input class="aiReq" placeholder="추가 요청 (예: 초보 관점으로, 제목은 질문형, 급락 쪽 강조, 순위 카드로)"><label class="chip aiAtt">📎 참고 이미지<input type="file" accept="image/*" multiple hidden></label><div class="aiThumbs"></div>' +
    '<button class="primary" data-plan>기획하기</button><button class="chip" data-img>이미지 만들기</button><button class="chip" data-save>카드 저장(1080×1920)</button></div>' +
    '<div class="aiBanner">원본 데이터를 확인하고 <b>기획하기</b>를 누르세요. ' + (AI_LAST_MODE === "app" ? "앱 카드는 AI 없이 무료로 만들어요." : "AI는 버튼을 누를 때만 호출돼요.") + '</div>' +
    '<div class="aiCols"><div class="aiCol aiSrc"><div class="aiColH">원본 데이터 <small></small></div><div class="aiSrcBody"></div></div>' +
    '<div class="aiCol aiMid"><div class="aiColH">카드</div><div class="aiPh">기획하기를 누르면<br>여기에 카드가 나와요</div><img alt="" hidden><div class="pills aiLay" hidden>' + Object.keys(OC_LAYER_NM).map(function (k) { return '<button data-ly="' + k + '">' + OC_LAYER_NM[k] + '</button>'; }).join("") + '</div></div>' +
    '<div class="aiCol aiChk"><div class="aiColH">검증 · 고치기 <small>칸을 고치면 바로 다시 그려요</small></div><div class="aiChkBody"><div class="briefDim">기획 뒤 여기서 카드의 모든 글·숫자를 원본 줄과 맞춰 볼 수 있어요.</div></div></div></div></div>';
  document.body.appendChild(el); document.addEventListener("keydown", aiStudioKey, true);
  var $a = function (q) { return el.querySelector(q); };
  $a("[data-x]").onclick = aiStudioClose;
  // 모드
  function setMode(m) {
    st.mode = m; AI_LAST_MODE = m; try { localStorage.setItem("sm.aiMode", m); } catch (e) {}
    Array.prototype.forEach.call(el.querySelectorAll("[data-mode]"), function (b) { b.classList.toggle("on", b.getAttribute("data-mode") === m); });
    $a("[data-img]").disabled = m === "app"; $a("[data-img]").textContent = (m === "bg" ? (st.bgImg ? "배경 다시" : "배경 만들기") : m === "full" ? (st.fullImg ? "이미지 다시" : "이미지 만들기") : "이미지 만들기");
    if (st.plan) render();
  }
  Array.prototype.forEach.call(el.querySelectorAll("[data-mode]"), function (b) { b.onclick = function () { setMode(b.getAttribute("data-mode")); }; });
  // 참고 이미지
  $a(".aiAtt input").onchange = function () { var fs = Array.prototype.slice.call(this.files || []).slice(0, 3 - st.imgs.length); this.value = ""; Promise.all(fs.map(ocImgShrink)).then(function (us) { us.filter(Boolean).forEach(function (u) { st.imgs.push(u); }); thumbs(); }); };
  function thumbs() { $a(".aiThumbs").innerHTML = st.imgs.map(function (u, i) { return '<span><img src="' + u + '"><button data-rm="' + i + '">✕</button></span>'; }).join(""); Array.prototype.forEach.call(el.querySelectorAll("[data-rm]"), function (b) { b.onclick = function () { st.imgs.splice(+b.getAttribute("data-rm"), 1); thumbs(); }; }); }
  // 원본 데이터
  function used() { var u = {}; if (st.plan) { [st.plan.hero].concat(st.plan.items || []).forEach(function (x) { if (x && x.ref) u[x.ref] = 1; }); } return u; }
  function srcRender() {
    var u = used(), body = $a(".aiSrcBody");
    $a(".aiSrc .aiColH small").textContent = st.lines.length + "개 · 금색 = 카드에 쓰인 근거";
    var list = '<div class="aiLines">' + st.lines.map(function (l) { return '<div class="aiL' + (u[l.id] ? " on" : "") + '" id="ai-' + l.id + '"><b>' + l.id + '</b><span>' + (l.card ? '<i>' + escapeHtml(l.card) + '</i> · ' : '') + escapeHtml(l.text) + '</span></div>'; }).join("") + '</div>';
    if (st.custom) {
      if (!body.querySelector(".aiCustom")) {
        body.innerHTML = '<div class="aiCustom"><input class="aiHint" placeholder="주제 꼬리표 (예: 디딤돌대출, 책 메모)"><textarea class="aiTxt" placeholder="첫 줄 = 제목&#10;- 항목: 설명&#10;표는 | 로 칸 나누기&#10;출처: 기관·책 이름&#10;&#10;아래 버튼으로 앱 데이터를 붙여 넣을 수 있어요"></textarea>' +
          '<div class="aiIns"><input class="aiSym" list="aiSymList" placeholder="종목·코인 이름"><datalist id="aiSymList"></datalist><button class="chip" data-ins="sym">종목 숫자</button><button class="chip" data-ins="brief">지금 브리핑</button><button class="chip" data-ins="cal">이번 주 일정</button><button class="chip" data-ins="mdd">고점 대비</button>' +
          (pubPolicyAll().map(function (p) { return '<button class="chip" data-ins="pol:' + p.id + '">' + escapeHtml(p.short || p.t) + '</button>'; }).join("")) + '</div><div class="aiLinesWrap"></div></div>';
        var rs = briefState.recent && briefState.recent.symbols; if (rs) body.querySelector("#aiSymList").innerHTML = Object.keys(rs).map(function (k) { return '<option value="' + escapeHtml(briefName({ sym: k })) + '">'; }).join("");
        var ta = body.querySelector(".aiTxt");
        var sync = function () { st.hint = body.querySelector(".aiHint").value; st.lines = ta.value.split(/\r?\n/).map(function (t) { return t.trim(); }).filter(Boolean).map(function (t, i) { return { id: "F" + (i + 1), card: "", text: t }; }); body.querySelector(".aiLinesWrap").innerHTML = '<div class="aiLines">' + st.lines.map(function (l) { return '<div class="aiL' + (used()[l.id] ? " on" : "") + '"><b>' + l.id + '</b><span>' + escapeHtml(l.text) + '</span></div>'; }).join("") + '</div>'; $a(".aiSrc .aiColH small").textContent = st.lines.length + "줄 · 금색 = 카드에 쓰인 근거"; };
        ta.oninput = sync; body.querySelector(".aiHint").oninput = sync;
        Array.prototype.forEach.call(body.querySelectorAll("[data-ins]"), function (b) { b.onclick = function () {
          // 기존 '데이터 넣기' 함수를 그대로 쓰기 위해 임시로 #ocText·#ocSym 역할을 맡긴다
          var keepT = ta.id, keepS = body.querySelector(".aiSym").id; ta.id = "ocText"; body.querySelector(".aiSym").id = "ocSym";
          try { ocInsert(b.getAttribute("data-ins")); } finally { ta.id = keepT; body.querySelector(".aiSym").id = keepS; }
          sync(); }; });
        st.syncCustom = sync; sync();
      } else st.syncCustom();
      return;
    }
    body.innerHTML = list;
  }
  srcRender();
  // 기획하기
  $a("[data-plan]").onclick = function () {
    var b = this, req = $a(".aiReq").value.trim(), useAi = st.mode !== "app" || !!req || st.imgs.length;
    if (!st.lines.length) { alert("원본 데이터가 비어 있어요."); return; }
    b.disabled = true; b.textContent = useAi ? "AI 기획 중… (10~60초)" : "기획 중…";
    var p = !useAi ? Promise.resolve({ plan: aiRulePlan(st), by: "규칙(앱 데이터 그대로 · AI 없음)" }) :
      aiCall({ mode: "plan", title: st.title, deck: st.deckNames.join(", "), lines: st.lines.map(function (l) { return { id: l.id, text: (l.card ? "[" + l.card + "] " : "") + l.text }; }), request: req, images: st.imgs }).then(function (j) {
        if (j && j.ok && j.out) return { plan: aiCleanPlan(j.out), by: "AI 기획 · " + j.model + (j.tries && j.tries.length > 1 ? " (" + j.tries.join(" → ") + ")" : "") };
        throw new Error((OC_REASON[j && j.reason] || (j && j.reason) || "알 수 없음") + (j && j.detail ? " — " + j.detail : "") + (j && j.tries ? " [" + j.tries.join(" → ") + "]" : ""));
      });
    p.then(function (r) {
      st.plan = r.plan; st.planBy = r.by; st.ocr = null; b.disabled = false; b.textContent = "새로 기획";
      if (st.mode === "app") { render(); return; }
      render(); return makeImage();
    }).catch(function (e) { b.disabled = false; b.textContent = st.plan ? "새로 기획" : "기획하기"; banner("bad", "AI 기획 실패: " + e.message + " — '앱 카드'로 바꾸면 AI 없이 만들 수 있어요."); });
  };
  // 이미지
  function makeImage() {
    if (!st.plan) { alert("먼저 기획하기를 눌러 주세요."); return Promise.resolve(); }
    var b = $a("[data-img]"), scope = st.mode === "bg" ? "bg" : "full"; b.disabled = true; b.textContent = "이미지 만드는 중… (20~90초)";
    banner("info", scope === "bg" ? "AI가 배경을 그리는 중이에요. 글·숫자는 앱이 그 위에 정확히 그려요." : "AI가 카드 전체를 그리는 중이에요. 다 되면 이미지 속 글자를 다시 읽어 원본과 대조해요.");
    return aiCall({ mode: "image", scope: scope, plan: st.plan }).then(function (j) {
      if (!(j && j.ok && j.image)) throw new Error((j && (j.reason || "")) + (j && j.tries ? " [" + j.tries.join(" → ") + "]" : ""));
      st.imgModel = j.model;
      return aiLoadImg(j.image).then(function (im) {
        if (scope === "bg") { st.bgImg = im; b.disabled = false; render(); return; }
        st.fullImg = im; st.fullUrl = j.image; st.ocr = null; render();
        b.textContent = "글자 읽는 중…";
        return aiCall({ mode: "read", image: j.image }).then(function (k) { st.ocr = k && k.ok ? k.lines : ["(읽기 실패: " + ((k && k.reason) || "") + ")"]; b.disabled = false; render(); });
      });
    }).catch(function (e) { b.disabled = false; banner("bad", "이미지 실패: " + e.message); }).then(function () { setMode(st.mode); });
  }
  $a("[data-img]").onclick = makeImage;
  // 레이어
  Array.prototype.forEach.call(el.querySelectorAll("[data-ly]"), function (b) { b.onclick = function () { st.ly = b.getAttribute("data-ly"); render(); }; });
  // 저장
  $a("[data-save]").onclick = function () {
    if (!st.url) { alert("먼저 기획하기로 카드를 만들어 주세요."); return; }
    if (st.lock && !st.forceOk) { if (!confirm("검증에서 확인이 필요한 항목이 있어요. 그래도 저장할까요?")) return; st.forceOk = true; }
    var day = pubToday().replace(/-/g, ""), base = "uphill.lab_대표_" + st.title.replace(/[^\w가-힣]/g, "") + "_" + day;
    cardsDownload({ url: st.url, file: base + (st.mode === "full" ? "_AI" : st.ly === "bg" ? "_배경" : st.ly === "text" ? "_글" : "") + ".png" });
  };
  function banner(kind, html) { var b = $a(".aiBanner"); b.className = "aiBanner " + (kind || ""); b.innerHTML = html; }
  // 그리기 + 검증
  function render() {
    var p = st.plan; if (!p) return;
    var img = $a(".aiMid img"), drawn = [], url;
    $a(".aiLay").hidden = st.mode === "full";
    Array.prototype.forEach.call(el.querySelectorAll("[data-ly]"), function (x) { x.classList.toggle("active", x.getAttribute("data-ly") === st.ly); });
    if (st.mode === "full") {
      if (!st.fullImg) { $a(".aiPh").hidden = false; $a(".aiPh").innerHTML = "<b>이미지 만들기</b>를 누르면<br>AI가 카드 전체를 그려요"; img.hidden = true; st.url = null; }
      else { url = aiFullCard(st).toDataURL("image/jpeg", 0.92); }
    } else {
      var draw = function () { return aiPlanCard(st); };
      var cv = ocWithLog(draw); drawn = OC_DRAWN.slice();
      if (st.draft && typeof perStamp === "function") perStamp(cv, "검토용 · 발행 금지");
      url = st.ly === "all" ? cv.toDataURL("image/png") : ocLayerUrl(draw, st.ly);
    }
    if (url) { st.url = url; img.src = url; img.hidden = false; img.classList.toggle("ocChecker", st.ly === "text" && st.mode !== "full"); $a(".aiPh").hidden = true; }
    // 검증
    var allTok = {}; st.lines.forEach(function (l) { aiTok(l.text).forEach(function (t) { allTok[t] = 1; }); });
    if (st.spec) st.spec.facts.forEach(function (f) { aiTok(f.value + " " + f.label).forEach(function (t) { allTok[t] = 1; }); });
    if (st.mk) aiTok(st.mk.date).forEach(function (t) { allTok[t] = 1; });
    aiTok(st.src + " " + st.deckNames.length + " " + st.list.length + " 1 2 3 4 5 6").forEach(function (t) { allTok[t] = 1; });
    var fields = [["kicker", "말머리"], ["title", "제목"], ["subtitle", "부제"], ["cta", "유도 문구"]], badF = [];
    fields.forEach(function (f) { aiTok(p[f[0]]).forEach(function (t) { if (!allTok[t]) badF.push(f[1] + "의 " + t); }); });
    var its = (p.layout === "hero" && p.hero && p.hero.value ? [p.hero] : []).concat(p.items || []), itChk = its.map(function (it) { return aiItemCheck(st, it); }), badI = itChk.filter(function (c) { return !c.ok; }).length;
    (p.items || []).concat([p.hero]).forEach(function (it) { if (it) aiTok(it.label + " " + it.sub).forEach(function (t) { if (!allTok[t]) badF.push((it.label || "항목") + "의 " + t); }); });
    var badD = st.mode === "full" ? [] : (function () { var s = {}; drawn.forEach(function (d) { aiTok(d).forEach(function (t) { if (!allTok[t]) s[t] = 1; }); }); return Object.keys(s); })();
    var ocrMiss = null;
    if (st.mode === "full" && st.ocr) {
      var o = aiNorm(st.ocr.join(" ")), exp = []; its.forEach(function (it) { if (it.value) exp.push(it.value); }); aiTok(p.title + " " + p.subtitle + " " + p.kicker).forEach(function (t) { exp.push(t); });
      exp = exp.filter(function (x, i, a) { return a.indexOf(x) === i; }); ocrMiss = exp.filter(function (x) { return o.indexOf(aiNorm(x)) < 0; });
      st.ocrExp = exp;
    }
    st.lock = !!(badF.length || badI || badD.length || (ocrMiss && ocrMiss.length) || st.draft || (st.mode === "full" && !st.ocr));
    var msg = st.mode === "full" && !st.fullImg ? ["info", "기획 완료 · " + st.planBy + " — <b>이미지 만들기</b>를 누르면 AI가 카드 전체를 그려요."] :
      st.lock ? ["bad", "확인 필요: " + [badI ? "근거 줄에 없는 값 " + badI + "개" : "", badF.length ? "원본에 없는 숫자 " + badF.length + "개(" + badF.slice(0, 3).join(", ") + ")" : "", badD.length ? "카드에 그려진 숫자 중 원본에 없는 것 " + badD.join(", ") : "", ocrMiss && ocrMiss.length ? "이미지에서 못 찾은 값 " + ocrMiss.join(", ") : "", st.mode === "full" && !st.ocr ? "이미지 글자 읽는 중" : "", st.draft ? "검토용(구간 미확정)" : ""].filter(Boolean).join(" · ") + " — 오른쪽에서 고치세요"] :
      ["ok", (st.mode === "full" ? "이미지 속 글자에서 기대한 값 " + (st.ocrExp || []).length + "개를 모두 찾았어요" : "카드의 모든 숫자·값이 원본 데이터에 있어요") + " · " + st.planBy + (st.mode !== "app" && st.imgModel ? " · 이미지 " + st.imgModel : "") + " — 그래도 최종 확인은 직접 해 주세요"];
    if (st.mode === "bg" && !st.bgImg) msg = ["info", "기획 완료 · " + st.planBy + " — <b>배경 만들기</b>를 누르면 AI 배경이 들어가요(지금은 앱 배경)."];
    banner(msg[0], msg[1]);
    srcRender();
    chkRender(its, itChk);
  }
  function chkRender(its, itChk) {
    var p = st.plan, body = $a(".aiChkBody"), focus = document.activeElement && body.contains(document.activeElement) ? document.activeElement.getAttribute("data-k") : null;
    var h = "";
    if (st.mode === "full") h += '<div class="aiOcr"><b>이미지에서 읽은 글자로 대조</b><div>' + (!st.fullImg ? "이미지를 만들면 AI가 글자를 다시 읽어 원본과 대조해요." : !st.ocr ? "글자 읽는 중…" : (st.ocrExp || []).length + "개 기대값 중 " + ((st.ocrExp || []).length - (st.ocrExp || []).filter(function (x) { return aiNorm(st.ocr.join(" ")).indexOf(aiNorm(x)) < 0; }).length) + "개 확인") + '</div>' + (st.ocr ? '<details><summary>읽은 글자 전체</summary><pre>' + escapeHtml(st.ocr.join("\n")) + '</pre></details>' : '') + '<div class="briefDim" style="font-size:11.5px">전부 AI 모드에서 글을 고치면 <b>이미지 다시</b>를 눌러야 반영돼요.</div></div>';
    h += '<label class="aiF"><span>레이아웃</span><select data-k="layout"><option value="rank">순위·단계</option><option value="hero">큰 숫자 + 항목</option><option value="list">목록</option></select></label>';
    [["kicker", "말머리"], ["title", "제목 (줄바꿈 가능)"], ["subtitle", "부제"], ["cta", "유도 문구"]].forEach(function (f) {
      var bad = aiTok(p[f[0]]).filter(function (t) { var ok = st.lines.some(function (l) { return aiTok(l.text).indexOf(t) >= 0; }) || (st.spec && st.spec.facts.some(function (x) { return aiTok(x.value + " " + x.label).indexOf(t) >= 0; })) || (st.mk && aiTok(st.mk.date).indexOf(t) >= 0) || String(st.list.length) === t; return !ok; });
      h += '<label class="aiF"><span>' + f[1] + '</span>' + (f[0] === "title" ? '<textarea data-k="' + f[0] + '" rows="2">' + escapeHtml(p[f[0]] || "") + '</textarea>' : '<input data-k="' + f[0] + '" value="' + escapeHtml(p[f[0]] || "") + '">') + '<em class="' + (bad.length ? "bad" : "ok") + '">' + (bad.length ? "원본에 없는 숫자: " + bad.join(", ") : aiTok(p[f[0]]).length ? "숫자 확인됨" : "숫자 없음") + '</em></label>';
    });
    if (p.layout === "hero") h += itemHtml(p.hero, "hero", "큰 숫자", itChk[0]);
    (p.items || []).forEach(function (it, i) { h += itemHtml(it, i, (i + 1) + ". 항목", itChk[(p.layout === "hero" && p.hero && p.hero.value ? 1 : 0) + i]); });
    h += '<button class="chip" data-add>+ 항목 추가</button>';
    h += '<details class="aiCapD"><summary>릴스 캡션</summary><textarea class="thrText aiCap"></textarea><button class="chip" data-cap>캡션 복사</button></details>';
    body.innerHTML = h;
    body.querySelector('[data-k="layout"]').value = p.layout;
    body.querySelector(".aiCap").value = aiCaption(st);
    body.querySelector("[data-cap]").onclick = function () { chCopy(body.querySelector(".aiCap").value, this); };
    body.querySelector("[data-add]").onclick = function () { p.items.push({ label: "", value: "", sub: "", ref: "" }); render(); };
    var tm = null;
    Array.prototype.forEach.call(body.querySelectorAll("[data-k]"), function (inp) {
      inp.oninput = inp.onchange = function () {
        var k = inp.getAttribute("data-k"), v = inp.value, m = k.match(/^it:(hero|\d+):(\w+)$/);
        if (m) { var it = m[1] === "hero" ? p.hero : p.items[+m[1]]; it[m[2]] = m[2] === "ref" ? v.toUpperCase().trim() : v; } else p[k] = v;
        clearTimeout(tm); tm = setTimeout(render, inp.tagName === "SELECT" ? 0 : 350);
      };
    });
    Array.prototype.forEach.call(body.querySelectorAll("[data-del]"), function (b) { b.onclick = function () { p.items.splice(+b.getAttribute("data-del"), 1); render(); }; });
    Array.prototype.forEach.call(body.querySelectorAll("[data-go]"), function (b) { b.onclick = function () { var t = document.getElementById("ai-" + b.getAttribute("data-go")); if (t) { t.scrollIntoView({ block: "center", behavior: "smooth" }); t.classList.add("flash"); setTimeout(function () { t.classList.remove("flash"); }, 1200); } }; });
    if (focus) { var f2 = body.querySelector('[data-k="' + focus + '"]'); if (f2) { f2.focus(); try { var L2 = f2.value.length; f2.setSelectionRange(L2, L2); } catch (e) {} } }
  }
  function itemHtml(it, key, ttl, chk) {
    it = it || { label: "", value: "", sub: "", ref: "" }; var L = aiLine(st, it.ref) || (chk && chk.alt ? aiLine(st, chk.alt) : null), v = String(it.value || "");
    var line = L ? escapeHtml(L.text).replace(escapeHtml(v), '<mark>' + escapeHtml(v) + '</mark>') : "";
    return '<div class="aiItem"><div class="aiItemH"><b>' + ttl + '</b><span>근거 <input class="aiRef" data-k="it:' + key + ':ref" value="' + escapeHtml(it.ref || "") + '" placeholder="F?">' + (L ? ' <button class="linkBtn" data-go="' + L.id + '">원본 보기</button>' : '') + '</span>' + (key !== "hero" ? '<button class="linkBtn" data-del="' + key + '">삭제</button>' : '') + '</div>' +
      '<div class="aiItemF"><input data-k="it:' + key + ':label" value="' + escapeHtml(it.label || "") + '" placeholder="항목 이름"><input data-k="it:' + key + ':value" value="' + escapeHtml(v) + '" placeholder="값"><input data-k="it:' + key + ':sub" value="' + escapeHtml(it.sub || "") + '" placeholder="보조 설명"></div>' +
      (L ? '<div class="aiOrig">원본: ' + line + '</div>' : '') + (chk && chk.t ? '<em class="' + (chk.ok ? "ok" : "bad") + '">' + escapeHtml(chk.t) + '</em>' : '') + '</div>';
  }
  setMode(st.mode);
  $a(".aiReq").focus();
}
function aiCaption(st) {
  var p = st.plan; if (!p) return "";
  var its = (p.layout === "hero" && p.hero && p.hero.value ? [p.hero] : []).concat(p.items || []).filter(function (x) { return x.label || x.value; });
  return String(p.title).replace(/\n/g, " ") + "\n\n" + its.map(function (x) { return "· " + x.label + (x.value ? " " + x.value : "") + (x.sub ? " (" + x.sub + ")" : ""); }).join("\n") +
    "\n\n" + (p.cta || "") + "\n프로필 → 오늘 올린 게시물에서 전체를 볼 수 있어요.\n\n※ " + (st.src || "투자 권유 아님") + "\n\n#우상향연구소 #주식초보 #재테크 #주식공부";
}
/* 어디서나: data-ai-open="ctx" 버튼 하나로 작업창 열기 */
document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-ai-open]"); if (!b) return; e.preventDefault(); aiOpen(b.getAttribute("data-ai-open"), b); });
function aiBtn(ctx, label) { return '<button class="chip aiBtn" data-ai-open="' + ctx + '" title="이 카드 묶음을 한 장으로 — AI 사용 범위는 작업창에서 선택">' + (label || "✨ AI") + '</button>'; }
