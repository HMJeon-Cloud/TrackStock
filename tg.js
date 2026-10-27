/* ============================================================ v12.64 발행 준비(손으로 올리기) — 자동 업로드 없음. 텔레그램 글 · 고지문 · 발행 묶음 ZIP · 월간 채점 · 내 계좌라면
   · 카드 결과(④)마다 "텔레그램으로 보내기": 카드 묶음(≤10장, JPEG) + 캡션(스레드 본문 기반 · 해시태그 없이) + 고지문
   · 작업실 ④ "모닝 노트 텔레그램 발행": 글(요약·지수·이슈·내일 볼 것) 먼저, 이어서 카드
   · 고지문: 작업실에서 한 번 적어 두면(신고번호 포함) 모든 발행 글 끝에 붙는다 — 서버 저장(cfg:tg)
   · 월간 채점: 저장한 리포트 + 분석 자산의 적중/빗나감을 모아 카드 묶음 + 글 — '공개 오답 노트'
   ============================================================ */
var TG = { cfg: null, lastScore: null };
function tgEsc(s) { return String(s == null ? "" : s); }
var TG_DEFAULT_DISCLAIMER = "※ 이 글은 과거·현재 데이터를 정리한 참고 자료이며, 특정 종목의 매수·매도를 권유하지 않습니다. 투자 판단과 결과의 책임은 투자자 본인에게 있습니다.";
function tgCfg() { if (TG.cfg) return TG.cfg; try { TG.cfg = JSON.parse(localStorage.getItem("sm.tgCfg") || "null"); } catch (e) {} if (!TG.cfg) TG.cfg = { disclaimer: TG_DEFAULT_DISCLAIMER, sign: "우상향연구소 · 매일 아침 숫자로 보는 시장" }; return TG.cfg; }
function tgCfgSave(c) { TG.cfg = c; try { localStorage.setItem("sm.tgCfg", JSON.stringify(c)); } catch (e) {} if (typeof smKvPut === "function") smKvPut("cfg:tg", c); }
(function () { setTimeout(function () { if (typeof smKvGet === "function") smKvGet("cfg:tg").then(function (v) { if (v && v.disclaimer) { TG.cfg = v; try { localStorage.setItem("sm.tgCfg", JSON.stringify(v)); } catch (e) {} } }); }, 3000); })();
function tgFooter() { var c = tgCfg(); return "\n\n" + (c.sign ? c.sign + "\n" : "") + (c.disclaimer || TG_DEFAULT_DISCLAIMER); }
/* 캡션: 스레드 본문(해시태그 없음)을 쓰고, 없으면 인스타 글에서 해시태그를 뺀다. 텔레그램 캡션 1024자 */
function tgCaptionFrom(box, title) {
  var th = box && box.querySelector(".thrTh"), ig = box && box.querySelector(".thrIg"), t = th && th.value.trim() ? th.value : (ig && ig.value ? ig.value.split("\n").filter(function (l) { return !/^#/.test(l.trim()); }).join("\n") : "");
  t = String(t || "").replace(/\n{3,}/g, "\n\n").trim(); if (!t) t = title || "";
  return (title ? title + "\n\n" : "") + t + tgFooter();
}
/* ---------- 모닝 노트 글(텔레그램 HTML) ---------- */
function tgNoteText() {
  var R = briefState.result; if (!R) return "";
  var A = typeof opsBrAi === "function" ? opsBrAi() : null, D = A && A.data || {}, pc = function (x, d) { return x == null || !isFinite(x) ? "-" : (typeof briefPct === "function" ? briefPct(x, d) : ""); }, L = [];
  L.push("📰 모닝 노트 · " + opsDayLbl() + "  (" + cDate(R.asOf) + " 종가 기준)");
  if ((D.story || []).length) { L.push(""); D.story.forEach(function (s, i) { if (s) L.push((i + 1) + ". " + tgEsc(s)); }); }
  var rows = typeof opsIdxRows === "function" ? opsIdxRows(R) : []; if (rows.length) { L.push("", "📊 시장 한눈에"); rows.slice(0, 8).forEach(function (r) { var S = r.S; L.push("• " + r.name + " " + pc(r.ret) + (S ? "  (1개월 " + pc(S.m1, 1) + " · 고점比 " + pc(S.vsHi, 1) + ")" : "")); }); }
  var t = R.temp; if (t && isFinite(t.upPct)) L.push("", "🌡 폭: 오른 종목 " + Math.round(t.upPct * 100) + "% · 20일선 위 " + Math.round(t.abovePct * 100) + "% · 신고가 " + (t.newHigh || []).length + " : 신저가 " + (t.newLow || []).length);
  var iss = (briefState.issues || []).slice(0, 5); if (iss.length) { L.push("", "📌 핵심 이슈"); iss.forEach(function (it, i) { var w = typeof ISS_WHY !== "undefined" && ISS_WHY[it.title], ok = w && w.why && w.conf !== "하" && !(w.bad && w.bad.length); L.push((i + 1) + ". " + it.title.split(" — ")[0] + " — " + tgEsc(it.sub || "")); if (ok) L.push("   └ 왜: " + tgEsc(w.why) + (w.so ? " → " + tgEsc(w.so) : "") + (w.next ? " · 볼 것: " + tgEsc(w.next) : "")); }); }
  var my = tgMyMoney(R); if (my.length) { L.push("", "💰 100만원이었다면"); my.forEach(function (m) { L.push("• " + m.name + ": 오늘 " + tgWon(m.d1) + " · 1개월 " + tgWon(m.m1) + (m.y1 != null ? " · 1년 " + tgWon(m.y1) : "")); }); }
  var tm = (D.tomorrow || []).slice(0, 4); if (tm.length) { L.push("", "🗓 다음 거래일에 볼 것"); tm.forEach(function (x) { L.push("• " + tgEsc(x.what) + (x.when ? " (" + tgEsc(x.when) + ")" : "") + (x.why ? " — " + tgEsc(x.why) : "")); }); }
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
  L.push("📊 " + S.ym.replace("-", ".") + " 월간 채점 — 적중 " + S.hit.length + " · 빗나감 " + S.miss.length + " (" + rate + "%)", "20일 지난 판단만 채점 · 아직 " + S.pend + "건은 대기");
  if (S.miss.length) { L.push("", "❌ 빗나간 판단(공개 오답 노트)"); S.miss.slice(0, 6).forEach(function (x) { L.push("• " + tgEsc(cDate(Date.parse(x.made))) + " " + tgEsc(nm(x)) + " · " + tgEsc(x.stance || "-") + " → " + pc(x.v.since)); }); }
  if (S.hit.length) { L.push("", "✅ 적중"); S.hit.slice(0, 6).forEach(function (x) { L.push("• " + tgEsc(cDate(Date.parse(x.made))) + " " + tgEsc(nm(x)) + " · " + tgEsc(x.stance || "-") + " → " + pc(x.v.since)); }); }
  return L.join("\n") + tgFooter();
}
function tgScoreOpen(btn) {
  var old = btn ? btn.textContent : ""; if (btn) { btn.disabled = true; btn.textContent = "채점 중…"; }
  tgScoreCollect().then(function (S) {
    if (!S.n) { smToast("아직 채점할 판단이 없어요 — 저장한 리포트·분석이 20일을 지나면 채점돼요(대기 " + S.pend + "건)"); return; }
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return ready.then(function () { var list = tgScoreDeck(S); TG.lastScore = S; hubShow("월간 채점 " + S.ym, list, { ctx: "score:" + S.ym, modal: true, note: "저장한 리포트·분석의 사후 수익률로 자동 채점 — 틀린 것부터" }); setTimeout(function () { var host = document.querySelector(".modalWrap:not(.hidden) .modalBody"), row = host && host.querySelector('[data-act="all"]'); if (row && !host.querySelector("[data-tgtxt]")) { var b = document.createElement("button"); b.className = "chip"; b.setAttribute("data-tgtxt", "1"); b.textContent = "📋 채점 글 복사"; row.parentNode.insertBefore(b, row.nextSibling); b.onclick = function () { (typeof chCopy === "function" ? chCopy : function (t) { navigator.clipboard.writeText(t); })(tgScoreText(S), b); }; } }, 300); });
  }).catch(function (e) { smToast("채점 실패: " + e.message, "bad"); }).then(function () { if (btn) { btn.disabled = false; btn.textContent = old; } });
}

/* ---------- '내 계좌라면' — 100만원 기준 오늘·1개월·1년 손익 ---------- */
function tgMyMoney(R) {
  var out = [], st = function (s) { return typeof nbStat === "function" ? nbStat(s) : null; };
  (R.indexRow || []).slice(0, 4).forEach(function (x) { var S = st(x.sym); if (!S || /=X$|\^VIX/.test(x.sym)) return; out.push({ name: x.name, d1: Math.round(1000000 * x.ret), m1: Math.round(1000000 * S.m1), y1: S.y1 != null ? Math.round(1000000 * S.y1) : null }); });
  return out;
}
function tgWon(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR") + "원"; }
/* ---------- 작은 ZIP(압축 없음) — 카드 PNG + 글 파일을 한 번에 ---------- */
var SM_CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function smCrc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = SM_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function smZip(files) {
  var enc = new TextEncoder(), parts = [], central = [], off = 0, now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  var le = function (n, b) { var a = new Uint8Array(b); for (var i = 0; i < b; i++) a[i] = (n >>> (8 * i)) & 0xFF; return a; };
  files.forEach(function (f) {
    var name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = smCrc32(data);
    var h = [le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(0, 2), le(dt, 2), le(dd, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), name], hl = 0; h.forEach(function (x) { hl += x.length; });
    central.push([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(0, 2), le(dt, 2), le(dd, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), name]);
    h.forEach(function (x) { parts.push(x); }); parts.push(data); off += hl + data.length;
  });
  var cstart = off, clen = 0; central.forEach(function (c) { c.forEach(function (x) { parts.push(x); clen += x.length; }); });
  [le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(clen, 4), le(cstart, 4), le(0, 2)].forEach(function (x) { parts.push(x); });
  return new Blob(parts, { type: "application/zip" });
}
function smZipDownload(files, fname) { var b = smZip(files), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
function dataUrlBytes(u) { var b = atob(String(u).split(",")[1]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
function tgBundle(host, title, list, extraTxt) {
  var day = (typeof pubToday === "function" ? pubToday() : smKstDay()).replace(/-/g, ""), slug = String(title).replace(/[^가-힣A-Za-z0-9]/g, "").slice(0, 14) || "cards";
  var files = list.map(function (it, i) { return { name: String(i + 1).padStart(2, "0") + "_" + String(it.name || "card").replace(/[^가-힣A-Za-z0-9_]/g, "") + ".png", data: dataUrlBytes(it.url || it.cv.toDataURL("image/png")) }; });
  var ig = host && host.querySelector(".thrIg"), th = host && host.querySelector(".thrTh"), r1 = host && host.querySelector(".thrR1"), r2 = host && host.querySelector(".thrR2");
  files.push({ name: "텔레그램.txt", data: extraTxt || tgCaptionFrom(host, title) });
  if (ig && ig.value) files.push({ name: "인스타_캡션.txt", data: ig.value });
  if (th && th.value) files.push({ name: "스레드.txt", data: th.value + (r1 && r1.value ? "\n\n[답글 1]\n" + r1.value : "") + (r2 && r2.value ? "\n\n[답글 2]\n" + r2.value : "") });
  files.push({ name: "순서.txt", data: "올리는 순서\n1) 텔레그램: 사진 " + Math.min(10, list.length) + "장(01~" + String(Math.min(10, list.length)).padStart(2, "0") + ")을 한 묶음으로 올리고 첫 장 설명에 텔레그램.txt 붙여넣기\n2) 인스타: 같은 사진 + 인스타_캡션.txt\n3) 스레드: 1장 + 스레드.txt 본문, 답글 1·2는 이어서\n\n" + title + " · " + day });
  smZipDownload(files, "uphill_" + slug + "_" + day + ".zip");
}
/* 카드 결과 상자에 '발행 묶음 ZIP' + '텔레그램 글 복사' */
(function () {
  if (typeof hubShow !== "function") return;
  var s0 = hubShow; hubShow = function (title, list, opts) {
    var r = s0.apply(this, arguments);
    try {
      var host = opts && opts.modal ? document.querySelector(".modalWrap:not(.hidden) .modalBody") : document.getElementById("mkResult"), row = host && host.querySelector('[data-act="all"]');
      if (row && !host.querySelector("[data-bundle]")) {
        var z = document.createElement("button"); z.className = "chip"; z.setAttribute("data-bundle", "1"); z.textContent = "📦 발행 묶음 ZIP (카드 + 글)"; row.parentNode.insertBefore(z, row.nextSibling); z.onclick = function () { tgBundle(host, title, list); };
        var c = document.createElement("button"); c.className = "chip"; c.textContent = "📋 텔레그램 글 복사"; z.parentNode.insertBefore(c, z.nextSibling); c.onclick = function () { (typeof chCopy === "function" ? chCopy : function (t) { navigator.clipboard.writeText(t); })(tgCaptionFrom(host, title), c); };
      }
    } catch (e) { console.warn(e); }
    return r;
  };
})();
/* ---------- 작업실 ④ 패널 ---------- */
function tgPanelHtml() {
  var c = tgCfg();
  return '<div class="tgPanel"><div class="opsSubH">발행 준비 <small>텔레그램·인스타·스레드에 직접 올려요 — 앱은 올릴 것을 만들어 줘요</small></div>' +
    '<div class="tgActs"><button class="opsBtn pri" data-tg="bundle">📦 모닝 노트 발행 묶음 ZIP</button><button class="opsBtn" data-tg="copy">📋 텔레그램 글 복사</button><button class="opsBtn" data-tg="score">📊 월간 채점 만들기</button><button class="opsLink" data-tg="prev">글 미리보기</button></div>' +
    '<div class="opsMuted">ZIP 안: 카드 PNG 전부 + 텔레그램.txt + 순서.txt · 글 끝에 고지문이 자동으로 붙어요</div>' +
    '<details class="tgCfg"><summary>고지문 · 서명 (모든 글 끝에 붙어요)</summary><label>서명<input data-tgcfg="sign" value="' + escapeHtml(c.sign || "") + '"></label><label>고지문 <small>유사투자자문업 신고 뒤엔 신고번호를 여기에</small><textarea data-tgcfg="disclaimer" rows="3">' + escapeHtml(c.disclaimer || "") + '</textarea></label><button class="chip" data-tgcfg-save>저장</button></details></div>';
}
function tgPanelBind(box) {
  Array.prototype.forEach.call(box.querySelectorAll("[data-tg]"), function (b) { b.onclick = function () {
    var a = b.getAttribute("data-tg");
    if (a === "prev") { var w = document.createElement("div"); w.innerHTML = '<textarea class="thrText" rows="18" readonly style="width:100%"></textarea>'; w.querySelector("textarea").value = tgNoteText(); if (typeof infoModal !== "undefined") infoModal.open("텔레그램 글 미리보기", w); return; }
    if (a === "copy") { if (!briefState.result) return smToast("브리핑 숫자가 아직 없어요"); (typeof chCopy === "function" ? chCopy : function (t) { navigator.clipboard.writeText(t); })(tgNoteText(), b); try { smFlowMark("pub"); } catch (e) {} return; }
    if (a === "bundle") { if (!briefState.result) return smToast("브리핑 숫자가 아직 없어요"); var old = b.textContent; b.disabled = true; b.textContent = "카드 그리는 중…"; var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); ready.then(function () { var list = typeof proNoteDeck === "function" ? proNoteDeck() : null; if (!list) throw new Error("브리핑 숫자가 아직 없어요"); list.forEach(function (it) { it.url = it.cv.toDataURL("image/png"); }); tgBundle(null, "모닝노트", list, tgNoteText()); try { hubDoneAdd("note:" + smMk(), "모닝 노트"); smFlowMark("pub"); } catch (e) {} smToast("발행 묶음 ZIP을 내려받았어요 — 순서.txt 대로 올리면 돼요"); }).catch(function (e) { smToast(e.message, "bad"); }).then(function () { b.disabled = false; b.textContent = old; if (currentTab === "ops") renderOps(); }); return; }
    if (a === "score") { tgScoreOpen(b); return; }
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
  };
})();
/* 모닝 노트 카드에 '내 계좌라면' 장 */
(function () {
  if (typeof proNoteDeck !== "function") return;
  var d0 = proNoteDeck; proNoteDeck = function () {
    var list = d0.apply(this, arguments); if (!list) return list;
    try {
      var R = briefState.result, my = tgMyMoney(R); if (!my.length) return list;
      var c = nbNew(), total = list.length + 1; nbTop(c, list.length - 1, ["100만원이었다면", "[[" + my[0].name + " 오늘 " + tgWon(my[0].d1) + "]]"], list.length, total); nbBody(c, "내 계좌라면", "100만원 기준 · 오늘 · 1개월 · 1년 (배당·세금 제외)");
      hubBody(c, { kind: "rows", data: my.map(function (m) { return [m.name, "1개월 " + tgWon(m.m1) + (m.y1 != null ? " · 1년 " + tgWon(m.y1) : ""), tgWon(m.d1), m.d1 >= 0 ? NB_C.up : NB_C.down, "오늘 하루 기준"]; }), leftW: 170, note: "지수 등락보다 '내 돈으로 얼마'가 먼저예요. 하루 숫자에 흔들리지 않으려면 1개월·1년 칸을 같이 보세요." });
      nbFoot(c, "야후 파이낸스 종가 · StockMind 계산 · 투자 권유 아님");
      var i = list.length && list[list.length - 1].name === "마무리" ? list.length - 1 : list.length; list.splice(i, 0, { name: "내계좌", cv: c.cv });
    } catch (e) { console.warn(e); }
    return list;
  };
})();
