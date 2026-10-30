/* ============================================================ v12.62 '매일 발행하는 유료 연구 노트' 방향 보강 (마지막에 로드)
   ① 지수 종가 2차 출처 대조(네이버) — 다르면 보류 경고     ② 기기 간 공유 저장(op=kv): 리포트 서술 · AI 문구 · 검수 · 성과
   ③ 올린 글 성과 한 줄 입력 → 다음 편성 입력에 반영          ④ 핵심 3장(숫자 하나씩) 덱 · 모닝 노트 카드 발행
   ⑤ 상단 공통 시장 바 · 용어 정리 · 토스트(alert 대신) · 모닝 노트 접기
   새 서버 함수 없음 (channel.js ?op=kv · ?op=verify)
   ============================================================ */
var PRO = { verify: null, perf: null };
function proTok() { try { return (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) { return ""; } }
function proPost(op, body) { return fetch("/api/channel?op=" + op, { method: "POST", headers: { "content-type": "application/json", "x-owner": proTok() }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); }); }
function proOwner() { return typeof isOwner === "function" && isOwner(); }

/* ---------- 토스트 (alert 대신 · 테스트 환경은 제외) ---------- */
function smToast(msg, kind, ms) {
  var box = document.getElementById("smToasts"); if (!box) { box = document.createElement("div"); box.id = "smToasts"; document.body.appendChild(box); }
  var el = document.createElement("div"); el.className = "smToast " + (kind || ""); var txt = String(msg || ""), long = txt.length > 140;
  el.innerHTML = '<div class="smToastT">' + escapeHtml(long ? txt.slice(0, 140) + "…" : txt) + '</div>' + (long ? '<button class="opsLink" data-more>전체 보기</button>' : '') + '<button class="smToastX" aria-label="닫기">×</button>';
  box.appendChild(el); var tm = setTimeout(function () { el.remove(); }, ms || (long ? 12000 : 6000));
  el.querySelector(".smToastX").onclick = function () { clearTimeout(tm); el.remove(); };
  var mb = el.querySelector("[data-more]"); if (mb) mb.onclick = function () { clearTimeout(tm); var w = document.createElement("div"); w.innerHTML = '<textarea class="thrText" rows="12" readonly style="width:100%"></textarea>'; w.querySelector("textarea").value = txt; if (typeof infoModal !== "undefined") infoModal.open("메시지", w); el.remove(); };
  return el;
}
if (!window.__SM_TEST) { window.__alert0 = window.alert; window.alert = function (m) { try { smToast(m, /실패|오류|못 했|없어요/.test(String(m)) ? "bad" : ""); } catch (e) { window.__alert0(m); } }; }

/* ---------- ② 공용 저장소 ---------- */
function smKvGet(k) { return proOwner() ? proPost("kv", { get: k }).then(function (j) { return j && j.ok ? j.val : null; }).catch(function () { return null; }) : Promise.resolve(null); }
function smKvPut(k, v, ex) { return proOwner() ? proPost("kv", { put: k, val: v, ex: ex }).then(function (j) { return !!(j && j.ok); }).catch(function () { return false; }) : Promise.resolve(false); }
function smKvList(prefix) { return proOwner() ? proPost("kv", { list: prefix }).then(function (j) { return j && j.ok ? (j.items || []) : []; }).catch(function () { return []; }) : Promise.resolve([]); }
/* 리포트 Claude 서술 — 저장할 때 서버에도, 열 때 브라우저에 없으면 서버에서 */
(function () {
  if (typeof rpAiSave !== "function") return;
  var s0 = rpAiSave, l0 = rpAiLoad;
  rpAiSave = function (rp, ai) { s0(rp, ai); try { if (ai && ai.ok) smKvPut("rp:" + smKstDay() + ":" + rp.id, ai); } catch (e) {} };
  rpAiLoad = function (rp) { var j = l0(rp); if (j) return j; smKvGet("rp:" + smKstDay() + ":" + rp.id).then(function (v) { if (v && v.ok && typeof RP !== "undefined" && RP.cur && RP.cur.id === rp.id && !RP.ai) { RP.ai = v; try { localStorage.setItem(rpAiKey(rp), JSON.stringify(v)); } catch (e) {} if (currentTab === "report") renderReport(); } }); return null; };
})();
/* AI 문구·검수 캐시 — localStorage 에 쓰일 때 서버에도 복사, 없으면 서버에서 끌어와 채움 */
(function () {
  var set0 = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { set0.apply(this, arguments); try { if (this === localStorage && /^sm\.(copy|chk):/.test(k)) smKvPut(k.replace(/^sm\./, "").replace(/[^\w.\-:가-힣%|+]/g, "_").slice(0, 170), JSON.parse(v)); } catch (e) {} };
  // 오늘 치 문구·검수를 미리 당겨 둔다(기기 바꿔도 같은 카드를 다시 열면 바로)
  function pull() { if (!proOwner()) return; ["copy:" + smKstDay(), "chk:" + smKstDay()].forEach(function (p) { smKvList(p).then(function (items) { items.forEach(function (it) { var lk = "sm." + it.k; try { if (!localStorage.getItem(lk)) set0.call(localStorage, lk, JSON.stringify(it.v)); } catch (e) {} }); }); }); }
  setTimeout(pull, 4000);
})();

/* ---------- ① 지수 종가 2차 대조 ---------- */
var PRO_VKEYS = ["^KS11", "^KQ11", "^GSPC", "^IXIC", "^DJI"];
function proAppCloses() {
  var rec = (typeof briefState !== "undefined" && briefState.recent) || null, out = {}; if (!rec || !rec.symbols) return out;
  PRO_VKEYS.forEach(function (k) { var d = rec.symbols[k]; if (!d || !d.c || !d.c.length) return; var i = d.c.length - 1; while (i >= 0 && d.c[i] == null) i--; if (i < 0) return; var off = /^\^K/.test(k) ? 9 : -5; out[k] = { d: new Date(d.t[i] * 1000 + off * 3600e3).toISOString().slice(0, 10), c: d.c[i] }; });
  return out;
}
function smVerifyRun(fresh) {
  if (!proOwner()) return Promise.resolve(null);
  var app = proAppCloses(); if (!Object.keys(app).length) return Promise.resolve(null);
  return proPost("verify", { app: app, fresh: !!fresh }).then(function (j) { if (j && j.ok) { PRO.verify = j; try { localStorage.setItem("sm.verify", JSON.stringify(j)); } catch (e) {} proVerifyPaint(); } return j; }).catch(function () { return null; });
}
function proVerifyHtml(compact) {
  var V = PRO.verify; if (!V) return compact ? '<span class="opsMuted">2차 대조 전</span>' : '';
  var tag = V.bad ? '<b class="proBad">⚠ 종가 불일치 ' + V.bad + '건 — 오늘 숫자 보류 권장</b>' : V.na === V.items.length ? '<span class="opsMuted">2차 대조 확인 불가(네이버 응답 없음)</span>' : '<b class="proOk">✓ 네이버 종가와 일치' + (V.na ? ' · ' + V.na + '건 확인 불가' : '') + '</b>';
  if (compact) return tag;
  return '<div class="proVerify ' + (V.bad ? "bad" : "ok") + '">' + tag + '<ul>' + V.items.map(function (x) { return '<li><b>' + escapeHtml(x.name) + '</b> ' + (x.date ? escapeHtml(x.date) + ' · 앱 ' + Number(x.app).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + (x.ref ? ' · 네이버 ' + Number(x.ref).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + (x.diff != null ? ' (' + (x.diff * 100).toFixed(2) + '%)' : '') : '') : '') + (x.why ? ' <small>' + escapeHtml(x.why) + '</small>' : '') + '</li>'; }).join("") + '</ul><small class="opsMuted">기준: 0.3% 넘게 다르면 경고 · 1시간 캐시</small> <button class="opsLink" data-verify>다시 대조</button></div>';
}
function proVerifyPaint() {
  var el = document.querySelector("#opsBody .proVerifyBox"); if (el) { el.innerHTML = proVerifyHtml(false); var b = el.querySelector("[data-verify]"); if (b) b.onclick = function () { b.textContent = "대조 중…"; smVerifyRun(true); }; }
  var c = document.querySelector("#opsBody .proVerifyTag"); if (c) c.innerHTML = proVerifyHtml(true);
}
try { PRO.verify = JSON.parse(localStorage.getItem("sm.verify") || "null"); if (PRO.verify && Date.now() - PRO.verify.at > 6 * 3600e3) PRO.verify = null; } catch (e) {}

/* ---------- ③ 올린 글 성과 ---------- */
function proPerfKey(day) { return "perf:" + (day || smKstDay()); }
function proPerfLoad() { try { var j = JSON.parse(localStorage.getItem("sm.perf:" + smKstDay()) || "{}"); return j || {}; } catch (e) { return {}; } }
function proPerfSave(ctx, field, val) {
  var P = proPerfLoad(); P[ctx] = P[ctx] || {}; P[ctx][field] = val === "" ? null : +val; P[ctx].t = P[ctx].t || (function () { var d = (typeof hubDoneLoad === "function" ? hubDoneLoad() : []).filter(function (x) { return x.ctx === ctx; })[0]; return d ? cPlain(d.t || ctx) : ctx; })();
  try { localStorage.setItem("sm.perf:" + smKstDay(), JSON.stringify(P)); } catch (e) {}
  clearTimeout(PRO.perfT); PRO.perfT = setTimeout(function () { smKvPut(proPerfKey(), { day: smKstDay(), items: P }); }, 800);
}
function proPerfHistory() { return smKvList("perf:").then(function (items) { var rows = []; items.forEach(function (it) { var v = it.v || {}, day = v.day || it.k.slice(5); Object.keys(v.items || {}).forEach(function (ctx) { var x = v.items[ctx]; if (x && (x.save != null || x.reach != null)) rows.push({ day: day, ctx: ctx, t: x.t || ctx, save: x.save, reach: x.reach }); }); }); PRO.perf = rows; return rows; }); }
function proPerfLines() {
  var rows = PRO.perf || []; if (!rows.length) return [];
  var byCtx = {}; rows.forEach(function (r) { var b = byCtx[r.ctx] = byCtx[r.ctx] || { t: r.t, n: 0, save: 0, reach: 0 }; b.n++; b.save += r.save || 0; b.reach += r.reach || 0; });
  var L = Object.keys(byCtx).map(function (k) { var b = byCtx[k]; return { ctx: k, t: b.t, n: b.n, save: b.save / b.n, reach: b.reach / b.n }; }).sort(function (a, b) { return b.save - a.save; });
  return L.slice(0, 10).map(function (x) { return "- " + x.ctx + " | " + x.t + " | 평균 저장 " + Math.round(x.save) + " · 도달 " + Math.round(x.reach) + " (" + x.n + "회)"; });
}
function proPerfHtml(made) {
  var P = proPerfLoad();
  if (!made.length) return '';
  return '<div class="proPerf"><div class="opsSubH">올린 글 성과 <small>하루 뒤 인스타 인사이트에서 저장·도달을 적어 두면 다음 편성에 반영돼요</small></div>' + made.slice().reverse().slice(0, 8).map(function (d) { var x = P[d.ctx] || {}; return '<div class="proPerfRow"><span>' + escapeHtml(cPlain(d.t || d.ctx)) + '</span><label>저장 <input type="number" min="0" data-perf="save" data-ctx="' + escapeHtml(d.ctx) + '" value="' + (x.save != null ? x.save : "") + '"></label><label>도달 <input type="number" min="0" data-perf="reach" data-ctx="' + escapeHtml(d.ctx) + '" value="' + (x.reach != null ? x.reach : "") + '"></label></div>'; }).join("") + '</div>';
}

/* ---------- ⑤ 상단 공통 시장 바 (순서 바 안의 '○○ 기준' 칩을 누를 수 있게) ---------- */
(function () {
  if (typeof smFlowPaint !== "function") return;
  var p0 = smFlowPaint; smFlowPaint = function () {
    var r = p0.apply(this, arguments);
    try { var el = document.querySelector("#smFlow .smFlowMk"); if (el && !el.querySelector("button")) { var mk = smMk(); el.innerHTML = ["all", "kr", "us", "coin"].map(function (m) { return '<button data-gmk="' + m + '" class="' + (m === mk ? "on" : "") + '">' + SM_MK_NM[m].replace(/^\S+\s/, "") + '</button>'; }).join(""); el.classList.add("seg"); Array.prototype.forEach.call(el.querySelectorAll("[data-gmk]"), function (b) { b.onclick = function () { smSetMk(b.getAttribute("data-gmk")); if (typeof opsCompute === "function") opsCompute(); var t = currentTab; if (t === "ops" && typeof renderOps === "function") renderOps(); else if (t === "onecard" && typeof makerRender === "function") makerRender(); else if (t === "brief" && typeof renderBrief === "function" && briefState.result) renderBrief(); else if (t === "report" && typeof renderReport === "function") { RP.today = null; renderReport(); } smFlowPaint(); }; }); } } catch (e) {}
    return r;
  };
})();

/* ---------- ④ 핵심 3장 — 묶음에서 숫자가 가장 뚜렷한 장 3개를 '숫자 하나 + 의미 한 줄'로 ---------- */
function hubCorePages(spec) {
  if (!spec || !spec.pages) return [];
  var cand = spec.pages.map(function (p, i) { var j = (p.top || []).filter(Boolean).join(" "), m = j.match(/\[\[([^\]]{1,18})\]\]/); return m && /\d/.test(m[1]) ? { i: i, p: p, v: m[1], q: cPlain(j.replace("[[" + m[1] + "]]", "")).replace(/\s{2,}/g, " ").trim() } : null; }).filter(Boolean);
  // 변화율·배수·금액처럼 '크기'가 있는 숫자 우선
  cand.sort(function (a, b) { var sa = /%|배|원|달러/.test(a.v) ? 1 : 0, sb = /%|배|원|달러/.test(b.v) ? 1 : 0; return sb - sa || a.i - b.i; });
  return cand.slice(0, 3).sort(function (a, b) { return a.i - b.i; });
}
function hubCoreDeck(spec) {
  var C = hubCorePages(spec); if (C.length < 2) return null;
  var out = [], total = C.length + 2;
  out.push({ name: "표지", cv: nbCover(spec.small || cDate(Date.now()), spec.hook, spec.lead, spec.meta, C.map(function (x) { return { t: x.p.title, v: x.v, q: x.q, strong: true }; })) });
  C.forEach(function (x, k) {
    var c = nbNew(), g = c.g, P = NB.PAD, W = NB.W - P * 2; nbTop(c, k + 1, [x.q || x.p.title], k + 2, total); nbBody(c, x.p.title, x.p.sub);
    var fs = 190; while (fs > 90 && cW(g, x.v, fs, 900) > W - 40) fs -= 6;
    var yv = c.y + 90 + fs, col = /^[+▲]|상승|급등/.test(x.v) ? NB_C.up : /^[-−▼]|하락|급락/.test(x.v) ? NB_C.down : NB_C.gold2; cText(g, x.v, NB.W / 2, yv, fs, 900, col, "center");
    g.fillStyle = NB_C.gold; g.fillRect(NB.W / 2 - 60, yv + 30, 120, 6);
    var under = x.p.sub && cPlain(x.p.sub) !== cPlain(x.q || "") ? cPlain(x.p.sub) : ""; c.y = yv + 70;
    if (under) { cWrap(g, under, NB.W / 2, c.y + 40, W - 40, 30, 600, NB_C.txt, 44, 3, "center"); c.y += 44 * Math.min(3, cWrapCount(g, under, W - 40, 30, 600)) + 50; } else c.y += 40;
    if (x.p.note) hubFillRest(c, { note: x.p.note }); else if (NB.H - 100 - c.y > 160) hubFillRest(c, { note: "숫자 하나만 기억하세요: " + x.v + " — " + (x.q || x.p.title) });
    nbFoot(c, x.p.foot || spec.foot); out.push({ name: "핵심" + (k + 1), cv: c.cv });
  });
  out.push({ name: "마무리", cv: nbClose(spec.close[0], spec.close[1], spec.close[2]) });
  return out;
}
/* 작업대 분량 선택에 '핵심 3장' 추가 — 여러 장을 그린 뒤 그 spec 으로 만든다 */
(function () {
  if (typeof mkCapLoad !== "function") return;
  var cap0 = mkCapLoad; mkCapLoad = function (ctx) {
    var key = ctx + "|" + MK.size, C = MK._cap[key];
    if (C && Date.now() - C.at < 10 * 60e3) { if (C.core === undefined) C.core = null; return cap0(ctx); }
    var r = cap0(ctx);
    // 여러 장이 다 그려진 뒤(HUB.lastSpec 이 남아 있을 때) 핵심 3장도 만들어 둔다
    var tries = 0, iv = setInterval(function () { var C2 = MK._cap[key]; if (C2 && C2.multi) { clearInterval(iv); try { C2.core = HUB.lastSpec && Date.now() - (HUB.lastSpecAt || 0) < 120e3 ? hubCoreDeck(HUB.lastSpec) : null; C2.coreSpec = C2.core ? HUB.lastSpec : null; } catch (e) { C2.core = null; } if (MK.sel === ctx) makerRender(); } else if (++tries > 240) clearInterval(iv); }, 500);
    return r;
  };
  var sh0 = mkShapeFor; mkShapeFor = function (ctx, cap) { var sh = sh0(ctx, cap); var u = MK.shapeBy[ctx]; if (u && u.n === "core") sh.n = cap && cap.core ? "core" : sh.n; else if (!u && cap && cap.core && (cap.multi || []).length >= 6) sh.n = "core"; return sh; };
  var rec0 = mkRec; mkRec = function (ctx, cap) { var r = rec0(ctx, cap); if (cap && cap.core && (cap.multi || []).length >= 6) { r.n = "core"; r.whyN = "숫자 하나 + 의미 한 줄짜리 3장 — 피드에서 가장 잘 멈춰요(상세는 여러 장으로 따로)"; } return r; };
  var html0 = mkWorkHtml; mkWorkHtml = function () {
    var h = html0.apply(this, arguments), cap = MK.sel ? MK._cap[MK.sel + "|" + MK.size] : null;
    if (cap && cap.core) { var sh = mkShapeFor(MK.sel, cap), rec = mkRec(MK.sel, cap); h = h.replace('<div class="wbShapeRow"><span>분량</span><div>', '<div class="wbShapeRow"><span>분량</span><div><button class="wbOpt' + (sh.n === "core" ? " on" : "") + '" data-shape="n:core"><b>핵심 3장 · 숫자 하나씩' + (rec.n === "core" ? ' <i class="wbRec">추천</i>' : '') + '</b><small>표지 + 큰 숫자 3장 + 마무리</small></button>'); }
    return h;
  };
  var paint0 = mkCapPaint; mkCapPaint = function (ctx) {
    var C = MK._cap[ctx + "|" + MK.size], sh = C ? mkShapeFor(ctx, C) : null;
    if (C && sh && sh.n === "core" && C.core) { var keepM = C.multi, keepN = C.multiNames; C.multi = C.core.map(function (x) { return x.cv; }); C.multiNames = C.core.map(function (x) { return x.name; }); var u = MK.shapeBy[ctx]; MK.shapeBy[ctx] = Object.assign({}, u || {}, { n: "multi" }); try { paint0(ctx); } finally { C.multi = keepM; C.multiNames = keepN; if (u) MK.shapeBy[ctx] = u; else delete MK.shapeBy[ctx]; } return; }
    return paint0(ctx);
  };
  var go0 = mkMakeGo; mkMakeGo = function (ctx, btn) {
    var C = MK._cap[ctx + "|" + MK.size], sh = C ? mkShapeFor(ctx, C) : null;
    if (sh && sh.n === "core" && sh.draw === "app" && C.core) { if (typeof HUB !== "undefined") HUB.useToday = sh.src === "today"; var t = hubTopic(ctx); hubShow((t ? cPlain(t.t).replace(/^\S+\s/, "") : ctx) + " · 핵심 3장", C.core.map(function (x) { return { name: x.name, cv: x.cv }; }), { ctx: ctx, note: "묶음에서 숫자가 뚜렷한 3장만 — 한 장에 숫자 하나. 상세는 '여러 장'으로" }); return; }
    return go0(ctx, btn);
  };
})();

/* ---------- ④ 모닝 노트 카드 발행 — 작업실 결과물을 그대로 카드 묶음으로 ---------- */
function proNoteDeck() {
  var R = briefState.result; if (!R) return null;
  var A = typeof opsBrAi === "function" ? opsBrAi() : null, D = A && A.data || {}, mk = smMk(), pages = [], pc = function (x, d) { return typeof briefPct === "function" ? briefPct(x, d) : ""; };
  var rows = (typeof opsIdxRows === "function" ? opsIdxRows(R) : []).slice(0, 7).map(function (r) { var S = r.S; return [r.name, S ? "5일 " + pc(S.ret5) + " · 1개월 " + pc(S.m1, 1) : "", pc(r.ret), r.ret >= 0 ? NB_C.up : NB_C.down, S && S.vsHi != null ? "52주 고점 대비 " + pc(S.vsHi, 1) : ""]; });
  if (rows.length) pages.push({ name: "지수", top: ["오늘 시장은", "[[" + rows[0][0] + " " + rows[0][2] + "]]"], title: "시장 한눈에", sub: "일간 · 5일 · 1개월 · 52주 고점 대비", kind: "rows", data: rows, leftW: 200, note: D.story && D.story[0] ? D.story[0] : null });
  var t = R.temp; if (t && isFinite(t.upPct)) pages.push({ name: "폭", top: ["오른 종목", "[[" + Math.round(t.upPct * 100) + "%]]"], title: "시장의 폭", sub: (R.basis && R.basis.name) || "", kind: "tiles", data: { tiles: [{ l: "오른 종목", v: Math.round(t.upPct * 100) + "%" }, { l: "20일선 위", v: Math.round(t.abovePct * 100) + "%" }, { l: "신고가 : 신저가", v: (t.newHigh || []).length + " : " + (t.newLow || []).length }] }, note: t.upPct >= 0.7 ? "대부분 상승 — 시장 전체가 움직인 날" : t.upPct <= 0.3 ? "대부분 하락 — 시장 전체가 움직인 날" : "방향이 갈린 날 — 업종·종목 재료가 결과를 정했다" });
  var th = R.themes || []; if (th.length >= 3) pages.push({ name: "업종", top: ["가장 센 업종", "[[" + th[0].name + " " + pc(th[0].ret) + "]]"], title: "업종 흐름", sub: "평균 등락 · 상승 종목 비율", kind: "rows", data: th.slice(0, 4).concat(th.slice(-2)).map(function (x) { return [x.name, x.up + "/" + x.n + " 상승", pc(x.ret), x.ret >= 0 ? NB_C.up : NB_C.down, briefName(x.best) + " " + pc(x.best.ret, 1)]; }), leftW: 190 });
  var iss = (briefState.issues || []).slice(0, 5); if (iss.length) pages.push({ name: "이슈", top: ["오늘 핵심 이슈", "[[" + iss.length + "가지]]"], title: "핵심 이슈 — 왜 / 그래서", sub: "평소보다 이례적인 순 · 이유는 출처 확인한 것만", kind: "rows", data: iss.map(function (it, i) { var w = typeof ISS_WHY !== "undefined" && ISS_WHY[it.title], ok = w && w.why && w.conf !== "하" && !(w.bad && w.bad.length); return [String(i + 1), it.title.split(" — ")[0], "", NB_C.navy, ok ? "왜 " + w.why + (w.so ? " → " + w.so : "") : it.sub]; }), leftW: 60 });
  var tm = (D.tomorrow || []).slice(0, 4); if (tm.length) pages.push({ name: "내일", top: ["다음 거래일", "[[볼 것 " + tm.length + "개]]"], title: "내일 볼 것", sub: "일정과 오늘 이슈를 연결해서", kind: "rows", data: tm.map(function (x) { return [x.when || "", x.what, "", NB_C.navy, x.why || ""]; }), leftW: 150 });
  if (pages.length < 2) return null;
  return hubDraw({ small: cDate(R.asOf) + " 종가 · 모닝 노트" + (mk !== "all" ? " · " + SM_MK_NM[mk].replace(/^\S+\s/, "") : ""), hook: D.story && D.story[0] ? ["오늘 시장,", "[[" + D.story[0].split(/[,.—]/)[0].slice(0, 22) + "]]"] : ["오늘 시장", "[[숫자로 한 장]]"], lead: (D.story || []).slice(0, 3), meta: "야후 파이낸스 종가 · 네이버 기사 · Claude 해설(출처 확인) · 투자 권유 아님", pages: pages, close: ["내일 아침에도 같은 시간에 올려요.", ["저장해 두고 한 주 뒤", "오늘 숫자와 비교해 보세요."]], foot: "StockMind 모닝 노트 · 투자 권유 아님" });
}
function proNotePublish(btn) {
  var old = btn ? btn.textContent : ""; if (btn) { btn.disabled = true; btn.textContent = "카드 그리는 중…"; }
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { var list = proNoteDeck(); if (!list) throw new Error("브리핑 숫자가 아직 없어요"); hubShow("모닝 노트 " + cDate(Date.now()), list, { ctx: "note:" + smMk(), modal: true, note: "작업실 모닝 노트를 그대로 카드로 — 저장 · 업로드 글은 아래에서" }); try { smFlowMark("pub"); } catch (e) {} })
    .catch(function (e) { alert("모닝 노트 카드를 만들지 못했어요: " + e.message); }).then(function () { if (btn) { btn.disabled = false; btn.textContent = old; } });
}

/* ---------- 작업실에 붙이기: 2차 대조 · 성과 입력 · 노트 발행 · 모닝 노트 접기 ---------- */
(function () {
  if (typeof renderOps !== "function") return;
  var r0 = renderOps; renderOps = function () {
    r0.apply(this, arguments);
    var box = document.getElementById("opsBody"); if (!box || !proOwner()) return;
    // ① 데이터 카드에 2차 대조
    var s1 = box.querySelector('.opsStep[data-step="data"] .opsStepBody'); if (s1) { var tg = document.createElement("div"); tg.className = "proVerifyTag opsMuted"; tg.style.marginTop = "6px"; tg.innerHTML = proVerifyHtml(true); s1.appendChild(tg); }
    // ④ 카드에 노트 발행 + 성과 입력
    var s4 = box.querySelector('.opsStep[data-step="pub"] .opsStepBody'); if (s4) { var pb = document.createElement("div"); pb.innerHTML = '<button class="opsBtn pri" data-note>📰 모닝 노트 카드 발행</button><div class="opsMuted">작업실 숫자·해설을 그대로 카드 묶음으로(저장·업로드 글 포함)</div>'; s4.insertBefore(pb, s4.firstChild); pb.querySelector("[data-note]").onclick = function () { proNotePublish(this); }; var made = typeof smDoneFor === "function" ? smDoneFor(smMk()) : []; var ph = proPerfHtml(made); if (ph) { var pd = document.createElement("div"); pd.innerHTML = ph; s4.appendChild(pd); Array.prototype.forEach.call(pd.querySelectorAll("[data-perf]"), function (inp) { inp.onchange = function () { proPerfSave(inp.getAttribute("data-ctx"), inp.getAttribute("data-perf"), inp.value); }; }); } }
    // 모닝 노트 위에 2차 대조 상자 + 접기
    var bh = box.querySelector(".opsBoardH"); if (bh) {
      var vb = document.createElement("div"); vb.className = "proVerifyBox"; vb.innerHTML = proVerifyHtml(false); bh.parentNode.insertBefore(vb, bh); var vbtn = vb.querySelector("[data-verify]"); if (vbtn) vbtn.onclick = function () { vbtn.textContent = "대조 중…"; smVerifyRun(true); };
      var full = (function () { try { return localStorage.getItem("sm.opsFull") === "1"; } catch (e) { return false; } })(), keep = { "요약": 1, "시장 한눈에": 1, "핵심 이슈": 1, "오늘 편성": 1, "오늘 만든 것": 1 };
      var tgl = document.createElement("button"); tgl.className = "opsLink"; tgl.textContent = full ? "핵심만 보기" : "자세히 보기(업종·급등락·매크로·일정·주요 종목)"; tgl.onclick = function () { try { localStorage.setItem("sm.opsFull", full ? "0" : "1"); } catch (e) {} renderOps(); }; bh.appendChild(tgl);
      if (!full) Array.prototype.forEach.call(box.querySelectorAll(".opsBoard .opsPanel"), function (p) { var t = (p.querySelector("h4") || {}).textContent || ""; if (!Object.keys(keep).some(function (k) { return t.indexOf(k) === 0; })) p.style.display = "none"; });
    }
    if (!PRO.verify && !PRO.verifyTried && briefState.recent) { PRO.verifyTried = true; smVerifyRun(false); }
    if (!PRO.perf) proPerfHistory().then(function () {});
  };
})();
/* 편성 입력에 성과 반영 */
(function () { if (typeof smDailyInput !== "function") return; var i0 = smDailyInput; smDailyInput = function () { var s = i0.apply(this, arguments); try { var L = proPerfLines(); if (L.length) s += "\n\n[지난 30일 올린 글 성과 — ctx | 제목 | 평균 저장·도달] 저장이 많았던 유형을 편성에서 우선하되 같은 주제를 반복하지는 말 것\n" + L.join("\n"); } catch (e) {} return s; }; })();

/* ---------- 용어 정리 ---------- */
(function () {
  try { var b = document.querySelector('.tabs button[data-tab="brief"] span'); if (b) b.textContent = "시장"; var c = document.querySelector("#startChannel .startText b"); if (c) c.textContent = "복사용 글 모음"; var cs = document.querySelector("#startChannel .startText small"); if (cs) cs.textContent = "데일리 · MDD · 자산배분 · 과거 사례를 글로 복사"; var bb = document.querySelector("#startBrief .startText b"); if (bb) bb.textContent = "② 시장 보기"; } catch (e) {}
})();
