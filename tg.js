/* ============================================================ v12.63 텔레그램 채널 발행(한 방향) + 고지문 + 월간 채점(오답 노트)
   · 카드 결과(④)마다 "텔레그램으로 보내기": 카드 묶음(≤10장, JPEG) + 캡션(스레드 본문 기반 · 해시태그 없이) + 고지문
   · 작업실 ④ "모닝 노트 텔레그램 발행": 글(요약·지수·이슈·내일 볼 것) 먼저, 이어서 카드
   · 고지문: 작업실에서 한 번 적어 두면(신고번호 포함) 모든 발행 글 끝에 붙는다 — 서버 저장(cfg:tg)
   · 월간 채점: 저장한 리포트 + 분석 자산의 적중/빗나감을 모아 카드 묶음 + 글 — '공개 오답 노트'
   ============================================================ */
var TG = { cfg: null, log: null, busy: false };
function tgPost(b) { return proPost("tg", b); }
function tgEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
var TG_DEFAULT_DISCLAIMER = "※ 이 글은 과거·현재 데이터를 정리한 참고 자료이며, 특정 종목의 매수·매도를 권유하지 않습니다. 투자 판단과 결과의 책임은 투자자 본인에게 있습니다.";
function tgCfg() { if (TG.cfg) return TG.cfg; try { TG.cfg = JSON.parse(localStorage.getItem("sm.tgCfg") || "null"); } catch (e) {} if (!TG.cfg) TG.cfg = { disclaimer: TG_DEFAULT_DISCLAIMER, sign: "우상향연구소 · 매일 아침 숫자로 보는 시장" }; return TG.cfg; }
function tgCfgSave(c) { TG.cfg = c; try { localStorage.setItem("sm.tgCfg", JSON.stringify(c)); } catch (e) {} smKvPut("cfg:tg", c); }
(function () { setTimeout(function () { if (typeof smKvGet === "function") smKvGet("cfg:tg").then(function (v) { if (v && v.disclaimer) { TG.cfg = v; try { localStorage.setItem("sm.tgCfg", JSON.stringify(v)); } catch (e) {} } }); }, 3000); })();
function tgFooter() { var c = tgCfg(); return "\n\n" + tgEsc(c.sign || "") + (c.sign ? "\n" : "") + "<i>" + tgEsc(c.disclaimer || TG_DEFAULT_DISCLAIMER) + "</i>"; }
/* 캡션: 스레드 본문(해시태그 없음)을 쓰고, 없으면 인스타 글에서 해시태그를 뺀다. 텔레그램 캡션 1024자 */
function tgCaptionFrom(box, title) {
  var th = box && box.querySelector(".thrTh"), ig = box && box.querySelector(".thrIg"), t = th && th.value.trim() ? th.value : (ig && ig.value ? ig.value.split("\n").filter(function (l) { return !/^#/.test(l.trim()); }).join("\n") : "");
  t = String(t || "").replace(/\n{3,}/g, "\n\n").trim(); if (!t) t = title || "";
  var foot = tgFooter(), max = 1024 - foot.length - 4; if (t.length > max) t = t.slice(0, max - 1) + "…";
  return "<b>" + tgEsc(title || "") + "</b>\n" + tgEsc(t) + foot;
}
function tgJpeg(cv, w) { var c = document.createElement("canvas"), r = (w || 1080) / cv.width; c.width = Math.round(cv.width * r); c.height = Math.round(cv.height * r); c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.84); }
function tgSendCards(list, caption, title, btn) {
  if (TG.busy) return Promise.resolve(false); TG.busy = true; var old = btn ? btn.textContent : ""; if (btn) { btn.disabled = true; btn.textContent = "텔레그램으로 보내는 중…"; }
  var imgs = list.slice(0, 10).map(function (it) { return tgJpeg(it.cv, 1080); });
  var total = imgs.reduce(function (a, u) { return a + u.length; }, 0); if (total > 3800000) imgs = list.slice(0, 10).map(function (it) { return tgJpeg(it.cv, 864); });
  return tgPost({ act: "photos", images: imgs, caption: caption, title: title }).then(function (j) {
    if (!j || !j.ok) throw new Error((j && (j.msg || j.reason)) || "응답 없음");
    smToast("텔레그램 채널에 카드 " + j.n + "장을 올렸어요", "", 5000); try { smFlowMark("pub"); } catch (e) {} TG.log = null; return true;
  }).catch(function (e) { smToast("텔레그램 발송 실패: " + e.message, "bad"); return false; }).then(function (ok) { TG.busy = false; if (btn) { btn.disabled = false; btn.textContent = ok ? "텔레그램에 올림 ✓" : old; } return ok; });
}
function tgSendText(text, btn) {
  if (TG.busy) return Promise.resolve(false); TG.busy = true; var old = btn ? btn.textContent : ""; if (btn) { btn.disabled = true; btn.textContent = "보내는 중…"; }
  return tgPost({ act: "text", text: text }).then(function (j) { if (!j || !j.ok) throw new Error((j && (j.msg || j.reason)) || "응답 없음"); smToast("텔레그램 채널에 글을 올렸어요"); try { smFlowMark("pub"); } catch (e) {} TG.log = null; return true; })
    .catch(function (e) { smToast("텔레그램 발송 실패: " + e.message, "bad"); return false; }).then(function (ok) { TG.busy = false; if (btn) { btn.disabled = false; btn.textContent = ok ? "올림 ✓" : old; } return ok; });
}
/* 카드 결과 상자(hubShow)에 버튼 끼우기 */
(function () {
  if (typeof hubShow !== "function") return;
  var s0 = hubShow; hubShow = function (title, list, opts) {
    var r = s0.apply(this, arguments);
    try {
      var host = opts && opts.modal ? document.querySelector(".modalWrap:not(.hidden) .modalBody") : document.getElementById("mkResult"), row = host && host.querySelector('[data-act="all"]');
      if (row && !host.querySelector("[data-tg]")) { var b = document.createElement("button"); b.className = "chip tgBtn"; b.setAttribute("data-tg", "1"); b.textContent = "✈ 텔레그램으로 보내기 (" + Math.min(10, list.length) + "장)"; row.parentNode.insertBefore(b, row.nextSibling); b.onclick = function () { var cap = tgCaptionFrom(host, title); if (!confirm("텔레그램 채널에 카드 " + Math.min(10, list.length) + "장과 글을 올릴까요?\n\n" + cap.replace(/<[^>]+>/g, "").slice(0, 300) + (cap.length > 300 ? "…" : ""))) return; tgSendCards(list, cap, title, b); }; }
    } catch (e) { console.warn(e); }
    return r;
  };
})();
/* ---------- 모닝 노트 글(텔레그램 HTML) ---------- */
function tgNoteText() {
  var R = briefState.result; if (!R) return "";
  var A = typeof opsBrAi === "function" ? opsBrAi() : null, D = A && A.data || {}, pc = function (x, d) { return x == null || !isFinite(x) ? "-" : (typeof briefPct === "function" ? briefPct(x, d) : ""); }, L = [];
  L.push("<b>📰 모닝 노트 · " + tgEsc(opsDayLbl()) + "</b>  <i>" + tgEsc(cDate(R.asOf)) + " 종가 기준</i>");
  if ((D.story || []).length) { L.push(""); D.story.forEach(function (s, i) { if (s) L.push((i + 1) + ". " + tgEsc(s)); }); }
  var rows = typeof opsIdxRows === "function" ? opsIdxRows(R) : []; if (rows.length) { L.push("", "<b>시장 한눈에</b>"); rows.slice(0, 8).forEach(function (r) { var S = r.S; L.push("• " + tgEsc(r.name) + " <b>" + pc(r.ret) + "</b>" + (S ? "  (1개월 " + pc(S.m1, 1) + " · 고점比 " + pc(S.vsHi, 1) + ")" : "")); }); }
  var t = R.temp; if (t && isFinite(t.upPct)) L.push("", "<b>폭</b> 오른 종목 " + Math.round(t.upPct * 100) + "% · 20일선 위 " + Math.round(t.abovePct * 100) + "% · 신고가 " + (t.newHigh || []).length + " : 신저가 " + (t.newLow || []).length);
  var iss = (briefState.issues || []).slice(0, 5); if (iss.length) { L.push("", "<b>핵심 이슈</b>"); iss.forEach(function (it, i) { var w = typeof ISS_WHY !== "undefined" && ISS_WHY[it.title], ok = w && w.why && w.conf !== "하" && !(w.bad && w.bad.length); L.push((i + 1) + ". <b>" + tgEsc(it.title.split(" — ")[0]) + "</b> — " + tgEsc(it.sub || "")); if (ok) L.push("   └ 왜: " + tgEsc(w.why) + (w.so ? " → " + tgEsc(w.so) : "") + (w.next ? " · 볼 것: " + tgEsc(w.next) : "")); }); }
  var tm = (D.tomorrow || []).slice(0, 4); if (tm.length) { L.push("", "<b>다음 거래일에 볼 것</b>"); tm.forEach(function (x) { L.push("• " + tgEsc(x.what) + (x.when ? " (" + tgEsc(x.when) + ")" : "") + (x.why ? " — " + tgEsc(x.why) : "")); }); }
  var txt = L.join("\n"), foot = tgFooter(); if (txt.length + foot.length > 4096) txt = txt.slice(0, 4096 - foot.length - 2) + "…";
  return txt + foot;
}
/* ---------- 월간 채점(오답 노트) ---------- */
function tgScoreCollect(monthYm) {
  var ym = monthYm || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  var reps = (typeof RP !== "undefined" && RP.saved || []).filter(function (s) { return s.made && String(s.made).slice(0, 7) <= ym; });
  var ans = (typeof arcItems === "function" ? arcItems() : []).filter(function (a) { return a.sym && a.snap && a.snap.price != null; });
  return Promise.all([Promise.all(reps.map(function (s) { return rpVerify(s).then(function (v) { return { kind: "report", t: s.title, sym: s.sym, stance: s.view && s.view.stance, made: s.made, v: v }; }).catch(function () { return null; }); })), (typeof arcVerifyAll === "function" ? arcVerifyAll(ans) : Promise.resolve([])).then(function (P) { return P.map(function (p) { return p.v ? { kind: "analyst", t: p.it.title, sym: p.it.sym, stance: p.it.p && p.it.p.verdictSt, made: new Date(p.it.at).toISOString(), v: p.v } : null; }); })]).then(function (r) {
    var all = r[0].concat(r[1]).filter(function (x) { return x && x.v && x.v.hit !== null && x.v.hit !== undefined; });
    var hit = all.filter(function (x) { return x.v.hit; }), miss = all.filter(function (x) { return !x.v.hit; }), pend = r[0].concat(r[1]).filter(function (x) { return x && x.v && (x.v.hit === null || x.v.hit === undefined); }).length;
    return { ym: ym, n: all.length, hit: hit, miss: miss, pend: pend, items: all };
  });
}
function tgScoreDeck(S) {
  var nm = function (x) { return (typeof rpName === "function" && x.sym ? rpName(x.sym) : x.sym || "") || x.t; }, pc = function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"; }, rate = S.n ? Math.round(S.hit.length / S.n * 100) : 0;
  var worst = S.miss.slice().sort(function (a, b) { return Math.abs(b.v.since) - Math.abs(a.v.since); }).slice(0, 5), best = S.hit.slice().sort(function (a, b) { return Math.abs(b.v.since) - Math.abs(a.v.since); }).slice(0, 5);
  var pages = [];
  pages.push({ name: "성적", top: ["이번 달 판단 " + S.n + "건 중", "[[적중 " + S.hit.length + " · 빗나감 " + S.miss.length + "]]"], title: "채점 기준", sub: "20일 지난 판단만 · '검토' 의견은 +3% 위면 적중, '관망'은 +3% 아래면 적중 · 중립은 ±10% 안", kind: "tiles", data: { tiles: [{ l: "적중률", v: rate + "%" }, { l: "채점 완료", v: S.n + "건" }, { l: "아직 20일 전", v: S.pend + "건" }] }, note: rate >= 60 ? "맞춘 쪽보다 빗나간 쪽을 먼저 보세요 — 다음 달 규칙은 거기서 나와요." : "절반 아래예요. 어떤 유형에서 틀렸는지가 이번 달의 진짜 결과물이에요." });
  if (worst.length) pages.push({ name: "빗나감", top: ["가장 크게 빗나간 것", "[[" + nm(worst[0]) + " " + pc(worst[0].v.since) + "]]"], title: "빗나간 판단 — 공개 오답 노트", sub: "그때 의견 → 이후 실제 움직임", kind: "rows", data: worst.map(function (x) { return [cDate(Date.parse(x.made)), nm(x) + " · " + (x.stance || "-"), pc(x.v.since), NB_C.down, (x.kind === "report" ? "리포트" : "분석") + " · 이후 고점 " + pc(x.v.hi) + " / 저점 " + pc(x.v.lo)]; }), leftW: 150, note: "틀린 판단은 지우지 않아요. 왜 틀렸는지가 다음 달 의견에 붙는 '조건'이 돼요." });
  if (best.length) pages.push({ name: "적중", top: ["가장 잘 본 것", "[[" + nm(best[0]) + " " + pc(best[0].v.since) + "]]"], title: "적중한 판단", sub: "그때 의견 → 이후 실제 움직임", kind: "rows", data: best.map(function (x) { return [cDate(Date.parse(x.made)), nm(x) + " · " + (x.stance || "-"), pc(x.v.since), NB_C.up, (x.kind === "report" ? "리포트" : "분석") + " · 이후 고점 " + pc(x.v.hi) + " / 저점 " + pc(x.v.lo)]; }), leftW: 150, note: "맞춘 것도 운이었는지 근거가 맞았는지 따로 적어 둬요." });
  var byK = {}; S.items.forEach(function (x) { var k = (x.stance || "기타").slice(0, 6); var b = byK[k] = byK[k] || { n: 0, h: 0 }; b.n++; if (x.v.hit) b.h++; });
  var ks = Object.keys(byK).filter(function (k) { return byK[k].n >= 2; }); if (ks.length) pages.push({ name: "유형", top: ["의견 유형별로 보면", "[[" + ks.map(function (k) { return k + " " + Math.round(byK[k].h / byK[k].n * 100) + "%"; }).join(" · ") + "]]"], title: "어떤 의견이 자주 틀렸나", sub: "의견 종류별 적중률(2건 이상)", kind: "bars", data: ks.map(function (k) { return { l: k, v: byK[k].h / byK[k].n, color: byK[k].h / byK[k].n >= 0.5 ? NB_C.up : NB_C.down, txt: byK[k].h + "/" + byK[k].n }; }), note: "적중률이 낮은 유형은 다음 달 의견을 낼 때 '조건'을 더 붙여요." });
  return hubDraw({ small: S.ym.replace("-", ".") + " 월간 채점", hook: ["이번 달 우리는", "[[" + rate + "% 맞췄다]]"], lead: ["판단 " + S.n + "건 채점 · 적중 " + S.hit.length + " · 빗나감 " + S.miss.length, "틀린 것부터 공개해요", "채점 기준은 2장"], meta: "저장한 리포트·분석의 사후 수익률 · 투자 권유 아님", pages: pages, close: ["다음 달에도 같은 기준으로 채점해요.", ["틀린 판단은 지우지 않고", "규칙으로 바꿔요."]], foot: "StockMind 월간 채점 · 투자 권유 아님" });
}
function tgScoreText(S) {
  var nm = function (x) { return (typeof rpName === "function" && x.sym ? rpName(x.sym) : x.sym || "") || x.t; }, pc = function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"; }, rate = S.n ? Math.round(S.hit.length / S.n * 100) : 0, L = [];
  L.push("<b>📊 " + tgEsc(S.ym.replace("-", ".")) + " 월간 채점 — 적중 " + S.hit.length + " · 빗나감 " + S.miss.length + " (" + rate + "%)</b>", "<i>20일 지난 판단만 채점 · 아직 " + S.pend + "건은 대기</i>");
  if (S.miss.length) { L.push("", "<b>빗나간 판단(공개 오답 노트)</b>"); S.miss.slice(0, 6).forEach(function (x) { L.push("• " + tgEsc(cDate(Date.parse(x.made))) + " " + tgEsc(nm(x)) + " · " + tgEsc(x.stance || "-") + " → " + pc(x.v.since)); }); }
  if (S.hit.length) { L.push("", "<b>적중</b>"); S.hit.slice(0, 6).forEach(function (x) { L.push("• " + tgEsc(cDate(Date.parse(x.made))) + " " + tgEsc(nm(x)) + " · " + tgEsc(x.stance || "-") + " → " + pc(x.v.since)); }); }
  return L.join("\n") + tgFooter();
}
function tgScoreOpen(btn) {
  var old = btn ? btn.textContent : ""; if (btn) { btn.disabled = true; btn.textContent = "채점 중…"; }
  tgScoreCollect().then(function (S) {
    if (!S.n) { smToast("아직 채점할 판단이 없어요 — 저장한 리포트·분석이 20일을 지나면 채점돼요(대기 " + S.pend + "건)"); return; }
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return ready.then(function () { var list = tgScoreDeck(S); TG.lastScore = S; hubShow("월간 채점 " + S.ym, list, { ctx: "score:" + S.ym, modal: true, note: "저장한 리포트·분석의 사후 수익률로 자동 채점 — 틀린 것부터" }); setTimeout(function () { var host = document.querySelector(".modalWrap:not(.hidden) .modalBody"), row = host && host.querySelector('[data-act="all"]'); if (row && !host.querySelector("[data-tgtxt]")) { var b = document.createElement("button"); b.className = "chip"; b.setAttribute("data-tgtxt", "1"); b.textContent = "✈ 채점 글만 텔레그램으로"; row.parentNode.insertBefore(b, row.nextSibling); b.onclick = function () { if (confirm("월간 채점 글을 텔레그램 채널에 올릴까요?")) tgSendText(tgScoreText(S), b); }; } }, 300); });
  }).catch(function (e) { smToast("채점 실패: " + e.message, "bad"); }).then(function () { if (btn) { btn.disabled = false; btn.textContent = old; } });
}
/* ---------- 작업실 ④에 붙이기: 텔레그램 상태 · 발행 버튼 · 고지문 · 월간 채점 ---------- */
function tgStatusLoad() { if (TG.status !== undefined) return Promise.resolve(TG.status); return tgPost({ act: "test" }).then(function (j) { TG.status = j; return j; }).catch(function () { TG.status = null; return null; }); }
function tgPanelHtml() {
  var st = TG.status, c = tgCfg();
  var line = st === undefined ? '<span class="opsMuted">텔레그램 연결 확인 중…</span>' : !st ? '<span class="opsMuted">연결 확인 실패</span>' : st.ok ? '<b class="proOk">✓ 채널 연결됨</b> <span class="opsMuted">' + escapeHtml(st.channel && st.channel.title || "") + (st.bot ? ' · 봇 @' + escapeHtml(st.bot) : '') + '</span>' : '<b class="proBad">텔레그램 미연결</b> <span class="opsMuted">' + escapeHtml(st.msg || "") + (st.reason === "NO_KEY" ? ' — Vercel 환경변수 TELEGRAM_BOT_TOKEN · TELEGRAM_CHANNEL' : '') + '</span>';
  return '<div class="tgPanel"><div class="opsSubH">텔레그램 채널(한 방향) <small>' + line + '</small></div>' +
    '<div class="tgActs"><button class="opsBtn pri" data-tg="note">✈ 모닝 노트 발행 (글 + 카드)</button><button class="opsBtn" data-tg="notetxt">글만</button><button class="opsBtn" data-tg="score">📊 월간 채점 만들기</button><button class="opsLink" data-tg="prev">글 미리보기</button><button class="opsLink" data-tg="log">보낸 기록</button></div>' +
    '<details class="tgCfg"><summary>고지문 · 서명 (모든 발행 글 끝에 붙어요)</summary><label>서명<input data-tgcfg="sign" value="' + escapeHtml(c.sign || "") + '"></label><label>고지문 <small>유사투자자문업 신고 뒤엔 신고번호를 여기에</small><textarea data-tgcfg="disclaimer" rows="3">' + escapeHtml(c.disclaimer || "") + '</textarea></label><button class="chip" data-tgcfg-save>저장</button></details></div>';
}
function tgPanelBind(box) {
  Array.prototype.forEach.call(box.querySelectorAll("[data-tg]"), function (b) { b.onclick = function () {
    var a = b.getAttribute("data-tg");
    if (a === "prev") { var w = document.createElement("div"); w.innerHTML = '<div class="tgPrev"></div>'; w.firstChild.innerHTML = tgNoteText().replace(/\n/g, "<br>"); if (typeof infoModal !== "undefined") infoModal.open("텔레그램 글 미리보기", w); return; }
    if (a === "notetxt") { if (!briefState.result) return smToast("브리핑 숫자가 아직 없어요"); if (confirm("모닝 노트 글을 텔레그램 채널에 올릴까요?")) tgSendText(tgNoteText(), b); return; }
    if (a === "note") { if (!briefState.result) return smToast("브리핑 숫자가 아직 없어요"); if (!confirm("모닝 노트 글과 카드 묶음을 텔레그램 채널에 올릴까요?")) return; var old = b.textContent; b.disabled = true; b.textContent = "글 보내는 중…"; tgSendText(tgNoteText(), null).then(function (ok) { if (!ok) throw new Error("글 발송 실패"); var list = proNoteDeck(); if (!list) throw new Error("카드를 만들 숫자가 없어요"); b.textContent = "카드 보내는 중…"; var cap = "<b>📰 모닝 노트 카드 · " + tgEsc(opsDayLbl()) + "</b>\n숫자는 앱 계산, 이유는 출처 확인한 것만" + tgFooter(); return tgSendCards(list, cap, "모닝 노트", null); }).then(function (ok) { b.textContent = ok ? "발행 완료 ✓" : old; }).catch(function (e) { smToast(e.message, "bad"); b.textContent = old; }).then(function () { b.disabled = false; }); return; }
    if (a === "score") { tgScoreOpen(b); return; }
    if (a === "log") { tgPost({ act: "log" }).then(function (j) { var w = document.createElement("div"); var L = (j && j.items) || []; w.innerHTML = L.length ? '<ul class="tgLog">' + L.slice(0, 50).map(function (x) { return '<li><b>' + new Date(x.at + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ") + '</b> ' + (x.kind === "photos" ? "카드 " + x.n + "장" : "글") + ' · ' + escapeHtml(x.title || x.head || "") + '</li>'; }).join("") + '</ul>' : '<div class="briefDim">아직 보낸 기록이 없어요.</div>'; if (typeof infoModal !== "undefined") infoModal.open("텔레그램 보낸 기록", w); }); return; }
  }; });
  var sv = box.querySelector("[data-tgcfg-save]"); if (sv) sv.onclick = function () { var c = Object.assign({}, tgCfg()); Array.prototype.forEach.call(box.querySelectorAll("[data-tgcfg]"), function (i) { c[i.getAttribute("data-tgcfg")] = i.value; }); tgCfgSave(c); smToast("고지문·서명을 저장했어요"); };
}
(function () {
  if (typeof renderOps !== "function") return;
  var r0 = renderOps; renderOps = function () {
    r0.apply(this, arguments);
    var box = document.getElementById("opsBody"); if (!box || !(typeof isOwner === "function" && isOwner())) return;
    var s4 = box.querySelector('.opsStep[data-step="pub"] .opsStepBody'); if (!s4) return;
    var d = document.createElement("div"); d.innerHTML = tgPanelHtml(); s4.insertBefore(d, s4.firstChild); tgPanelBind(d);
    if (TG.status === undefined) tgStatusLoad().then(function () { if (currentTab === "ops") { var cur = document.querySelector("#opsBody .tgPanel .opsSubH small"); if (cur) cur.innerHTML = tgPanelHtml().match(/<small>([\s\S]*?)<\/small><\/div>/)[1]; } });
  };
})();
/* 데이터 센터 연동 안내 표에 텔레그램 줄 */
(function () { if (typeof chDataGuideHtml !== "function") return; var g0 = chDataGuideHtml; chDataGuideHtml = function () { var h = g0.apply(this, arguments); try { h = h.replace(/(<tr><td class="dgName"><b>OPENAI_API_KEY)/, '<tr><td class="dgName"><b>TELEGRAM_BOT_TOKEN · TELEGRAM_CHANNEL</b><br><small>봇을 채널 관리자로 추가 · 채널은 "@아이디" 또는 -100으로 시작하는 숫자 ID</small></td><td>텔레그램 BotFather → 봇 토큰</td><td>✈ 모닝 노트 · 카드 묶음 · 월간 채점 발행(한 방향 채널)</td><td>운영자가 버튼을 누를 때만</td><td>' + (TG.status && TG.status.ok ? '<span class="dhBadge ok">✓ 연결</span>' : TG.status && TG.status.reason === "NO_KEY" ? '<span class="dhBadge bad">✗ 키 없음</span>' : '<span class="dhBadge">작업실에서 확인</span>') + '</td></tr>$1'); } catch (e) {} return h; }; })();
