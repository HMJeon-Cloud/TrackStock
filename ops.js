/* ============================================================ v12.43 오늘의 작업실 — 관리자 작업을 한 화면에서
   위: 왼쪽 → 오른쪽 다섯 단계(데이터 확인 → 오늘 시장 → 편성 → 만들기 → 업로드·검수). 단계마다 '지금 상태 · 바로 실행 버튼 · 결과 미리보기'
   아래: 오늘 만든 결과물을 한눈에(시장 해설 · 핵심 이슈 왜/그래서/볼 것 · 급등락 이유 · 내일 볼 것 · 편성 · 만든 것)
   새 서버 함수 없음 — 기존 화면의 함수(dhMarket · brAiRun · mkAiRun · hubDoneLoad · RP.saved · arcItems)를 그대로 부른다.
   ============================================================ */
var OPS = { busy: {}, Ms: null, at: 0, loading: false };
function opsEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
function opsPct(x) { return typeof briefPct === "function" ? briefPct(x) : (x > 0 ? "+" : "") + (x * 100).toFixed(2) + "%"; }
function opsTone(x) { return x > 0 ? "up" : x < 0 ? "down" : ""; }
function opsDayLbl() { var d = new Date(Date.now() + 9 * 3600e3); return (d.getUTCMonth() + 1) + "월 " + d.getUTCDate() + "일 (" + "일월화수목금토"[d.getUTCDay()] + ")"; }
function opsHM(ms) { return ms ? new Date(ms + 9 * 3600e3).toISOString().slice(11, 16) : ""; }
function opsBrAi() { return typeof BR_AI !== "undefined" && typeof brAiKey === "function" ? BR_AI[brAiKey()] || null : null; }
function opsToday(ms) { return ms && new Date(ms + 9 * 3600e3).toISOString().slice(0, 10) === smKstDay(); }

/* 데이터 준비: 시세 · 전체 시장 요약 · 브리핑 계산 */
function opsWarm() {
  if (OPS.loading) return; OPS.loading = true;
  var uni = function (m) { return typeof dlUniLoad === "function" ? dlUniLoad(m).catch(function () { return null; }) : Promise.resolve(null); };
  dataReady().then(function () { return Promise.all([briefState.recent || fetchRecent(), uni("us"), uni("kr")]); }).then(function (a) {
    var recent = a[0]; OPS.loading = false;
    if (recent && recent.symbols) {
      if (!briefState.recent) briefState.recent = recent;
      if (typeof dhMarket === "function") { OPS.Ms = ["kr", "us", "coin"].map(function (m) { return dhMarket(m, recent); }); OPS.at = Date.now(); if (OPS.Ms.every(function (m) { return m.level === "ok"; }) && typeof smFlowMark === "function") smFlowMark("data"); }
      if (!briefState.result && typeof briefCompute === "function") { try { briefState.result = briefCompute(recent, { mode: briefState.mode || "day", market: briefState.market || "all", popular: briefState.popular }); } catch (e) { console.warn(e); } }
      if (briefState.result && !briefState.issues && typeof issuesCompute === "function") { try { briefState.issues = issuesCompute(recent, { market: briefState.market || "all", popular: briefState.popular }); } catch (e) {} }
      if (briefState.result && typeof cardsNewsFetch === "function") cardsNewsFetch(briefState.result).catch(function () {});
    } else OPS.err = "시세 데이터를 불러오지 못했어요";
    if (currentTab === "ops") renderOps();
  }).catch(function (e) { OPS.loading = false; OPS.err = e.message; if (currentTab === "ops") renderOps(); });
}

/* ---------- 단계 카드 ---------- */
function opsStep(i, k, st, title, what, body, acts) {
  return '<article class="opsStep ' + st + '" data-step="' + k + '"><header><span class="opsNode">' + (st === "done" ? "✓" : i) + '</span><div><h3>' + title + '</h3><p>' + what + '</p></div></header><div class="opsStepBody">' + body + '</div><footer>' + acts + '</footer></article>';
}
function opsSteps() {
  var D = smFlowDone(), next = SM_FLOW.filter(function (s) { return !D[s.k]; })[0], st = function (k) { return D[k] ? "done" : next && next.k === k ? "now" : "wait"; };
  var R = briefState.result, A = opsBrAi(), plan = typeof MK_AI !== "undefined" && MK_AI && MK_AI.data ? MK_AI.data : null, made = typeof hubDoneLoad === "function" ? hubDoneLoad() : [];
  var h = [];
  // ① 데이터
  var b1 = !OPS.Ms ? '<div class="opsMuted">' + (OPS.err ? opsEsc(OPS.err) : "상태를 확인하는 중…") + '</div>' : OPS.Ms.map(function (M) {
    var nm = { kr: "국내", us: "미국", coin: "코인" }[M.mk], warn = M.err ? "계산 실패" : M.stale && M.stale.length ? "늦은 종목 " + M.stale.length : M.spike && M.spike.length ? "급변 의심 " + M.spike.length : M.mk !== "coin" && M.off ? "전체 시장 숫자 숨김" : M.coinLate ? "어제 마감분 없음" : "";
    return '<div class="opsMk ' + (warn ? "warn" : "ok") + '"><b>' + nm + '</b><span>' + (typeof dhMD === "function" ? dhMD(M.date) : M.date) + '</span><em>' + (warn ? opsEsc(warn) : "정상") + '</em></div>';
  }).join("");
  h.push(opsStep(1, "data", st("data"), "데이터 확인", "오늘 화면에 쓰는 시세가 최신인지", b1,
    '<button class="opsBtn" data-ops="recheck">다시 확인</button><button class="opsLink" data-ops="go:data">데이터 센터</button>' + (D.data ? '' : '<button class="opsLink" data-ops="mark:data">확인했어요</button>')));
  // ② 오늘 시장
  var b2 = A && A.data && (A.data.story || []).length ? '<p class="opsLead">' + opsEsc(A.data.story[0]) + '</p><div class="opsMuted">' + opsHM(A.at) + ' 생성 · 이슈 ' + (A.data.issues || []).filter(function (x) { return x.why; }).length + '개 이유 · 내일 볼 것 ' + (A.data.tomorrow || []).length + '개</div>'
    : R ? '<div class="opsMuted">' + opsEsc((R.indexRow || []).slice(0, 2).map(function (x) { return x.name + " " + opsPct(x.ret); }).join(" / ")) + '</div><div class="opsMuted">해설을 만들면 이유와 출처가 붙어요</div>' : '<div class="opsMuted">브리핑 계산 중…</div>';
  h.push(opsStep(2, "brief", st("brief"), "오늘 시장", "해설 3줄 · 이슈 이유 · 급등락 이유 · 내일 볼 것", b2,
    '<button class="opsBtn' + (st("brief") === "now" ? " pri" : "") + '" data-ops="brief"' + (R && !OPS.busy.brief ? '' : ' disabled') + '>' + (OPS.busy.brief ? "Claude가 해설 쓰는 중…" : A ? "해설 다시 만들기" : "Claude 해설 만들기") + '</button><button class="opsLink" data-ops="go:brief">브리핑 화면</button>'));
  // ③ 편성
  var b3 = plan ? '<p class="opsLead">' + opsEsc(plan.summary || "") + '</p><div class="opsMuted">카드 ' + (plan.picks || []).length + '개 · 리포트 ' + (plan.reports || []).length + '개 · ' + opsHM(MK_AI.at) + '</div>' : '<div class="opsMuted">주제 후보 · 리포트 후보 · 이슈 · 기사를 모아 오늘 올릴 순서를 정해요</div>';
  h.push(opsStep(3, "plan", st("plan"), "편성", "오늘 올릴 카드와 볼 리포트 고르기", b3,
    '<button class="opsBtn' + (st("plan") === "now" ? " pri" : "") + '" data-ops="plan"' + (OPS.busy.plan ? ' disabled' : '') + '>' + (OPS.busy.plan ? "Claude가 편성 중…" : plan ? "편성 다시 하기" : "Claude 편성 시작") + '</button><button class="opsLink" data-ops="go:work">카드 작업대</button>'));
  // ④ 만들기
  var doneCtx = {}; made.forEach(function (d) { doneCtx[d.ctx] = 1; });
  var picks = plan ? (plan.picks || []) : [], T = {}; try { (typeof mkTopicsScored === "function" ? mkTopicsScored() : []).forEach(function (x) { T[x.ctx] = x; }); } catch (e) {}
  var b4 = picks.length ? '<ol class="opsPicks">' + picks.slice(0, 6).map(function (p) { var x = T[p.ctx]; return '<li class="' + (doneCtx[p.ctx] ? "done" : "") + '"><button data-ops="make:' + opsEsc(p.ctx) + '"><span>' + opsEsc(p.hook || (x ? cPlain(x.t) : p.ctx)) + '</span><small>' + (doneCtx[p.ctx] ? "만듦" : opsEsc(p.slot || "")) + '</small></button></li>'; }).join("") + '</ol>' + (picks.length > 6 ? '<div class="opsMuted">외 ' + (picks.length - 6) + '개는 카드 작업대에서</div>' : '')
    : '<div class="opsMuted">편성을 하면 만들 순서가 여기에 나와요. 편성 없이도 아래 버튼으로 바로 만들 수 있어요.</div>';
  h.push(opsStep(4, "make", st("make"), "만들기", "편성 순서대로 카드 · 리포트 · 분석", b4,
    '<button class="opsLink" data-ops="go:work">카드</button><button class="opsLink" data-ops="go:report">리포트</button><button class="opsLink" data-ops="go:analyst">분석</button>'));
  // ⑤ 업로드
  var b5 = made.length ? '<div class="opsMuted">오늘 만든 카드 ' + made.length + '개 — 하나씩 열어 업로드 글을 쓰고 검수하세요</div><ul class="opsMade">' + made.slice(-4).reverse().map(function (d) { return '<li><button data-ops="make:' + opsEsc(d.ctx) + '">' + opsEsc(cPlain(d.t || d.ctx)) + '<small>' + opsHM(d.at) + '</small></button></li>'; }).join("") + '</ul>' : '<div class="opsMuted">카드를 만들면 여기서 업로드 글 쓰기로 바로 갈 수 있어요</div>';
  h.push(opsStep(5, "pub", st("pub"), "업로드 · 검수", "Claude 문구 → 발행 전 검수 → 올리기", b5,
    (D.pub ? '<span class="opsMuted">검수 완료</span>' : '<button class="opsLink" data-ops="mark:pub"' + (made.length ? '' : ' disabled') + '>올렸어요</button>')));
  var n = SM_FLOW.filter(function (s) { return D[s.k]; }).length;
  return { html: h.join(""), n: n, next: next };
}

/* ---------- 결과물 보드 ---------- */
function opsBoard() {
  var R = briefState.result, A = opsBrAi(), Dd = A && A.data || {}, chk = A && A.chk || {}, iss = briefState.issues || [], plan = typeof MK_AI !== "undefined" && MK_AI && MK_AI.data ? MK_AI.data : null;
  var warn = function (b) { return typeof smNumWarn === "function" ? smNumWarn(b) : ""; }, h = '';
  // 시장 해설
  h += '<section class="opsPanel opsWide"><h4>오늘 시장 해설</h4>' + ((Dd.story || []).length ? '<ol class="opsStory">' + Dd.story.map(function (l, k) { return l ? '<li>' + opsEsc(l) + ' ' + warn(chk.story && chk.story[k]) + '</li>' : ''; }).join("") + '</ol>' + (Dd.note ? '<p class="opsMuted">흐름: ' + opsEsc(Dd.note) + '</p>' : '') + (typeof smSrcHtml === "function" ? smSrcHtml(A.sources) : '')
    : '<p class="opsEmpty">② 오늘 시장에서 Claude 해설을 만들면 여기에 세 줄로 정리돼요.</p>') + '</section>';
  // 내일 볼 것
  h += '<section class="opsPanel"><h4>내일 볼 것</h4>' + ((Dd.tomorrow || []).length ? '<ul class="opsTm">' + Dd.tomorrow.map(function (t) { return '<li><b>' + opsEsc(t.what) + '</b>' + (t.when ? '<time>' + opsEsc(t.when) + '</time>' : '') + (t.why ? '<p>' + opsEsc(t.why) + '</p>' : '') + '</li>'; }).join("") + '</ul>'
    : (typeof pubUpcoming === "function" ? (function () { var ev = []; try { ev = pubUpcoming(3); } catch (e) {} return ev.length ? '<ul class="opsTm">' + ev.slice(0, 3).map(function (e) { return '<li><b>' + opsEsc(e.t) + '</b><time>' + opsEsc(e.d.slice(5).replace("-", "/")) + '</time>' + (e.n ? '<p>' + opsEsc(e.n) + '</p>' : '') + '</li>'; }).join("") + '</ul><p class="opsMuted">일정표 기준 · 해설을 만들면 오늘 이슈와 연결돼요</p>' : '<p class="opsEmpty">다가오는 일정이 없어요.</p>'; })() : '')) + '</section>';
  // 핵심 이슈
  h += '<section class="opsPanel opsWide"><h4>핵심 이슈 ' + iss.length + '</h4>' + (iss.length ? '<table class="opsIss"><thead><tr><th></th><th>이슈</th><th>왜</th><th>그래서</th><th>볼 것</th></tr></thead><tbody>' + iss.map(function (it, i) {
    var w = typeof ISS_WHY !== "undefined" && ISS_WHY[it.title];
    return '<tr><td class="opsNo">' + (i + 1) + '</td><td><b>' + opsEsc(it.title) + '</b><small>' + opsEsc(it.sub) + '</small></td>' + (w && w.why ? '<td>' + opsEsc(w.why) + (w.src ? '<small>' + (w.url ? '<a href="' + opsEsc(w.url) + '" target="_blank" rel="noopener">' + opsEsc(w.src) + '</a>' : opsEsc(w.src)) + (w.conf ? ' · 확신 ' + opsEsc(w.conf) : '') + '</small>' : '') + warn(w.bad) + '</td><td>' + opsEsc(w.so || "") + '</td><td>' + opsEsc(w.next || "") + '</td>' : '<td colspan="3" class="opsMuted">' + (w ? "확실한 원인을 찾지 못해 비워 뒀어요" : "해설을 만들면 채워져요") + '</td>') + '</tr>';
  }).join("") + '</tbody></table>' : '<p class="opsEmpty">이슈를 계산하는 중이에요.</p>') + '</section>';
  // 급등락
  var mv = R && R.movers || { up: [], down: [] }, mw = {}; (Dd.movers || []).forEach(function (m, k) { mw[m.sym] = { why: m.why, src: m.src, bad: chk.movers && chk.movers[k] }; });
  var mrow = function (s) { var w = mw[s.sym]; return '<li><span class="opsMvN">' + opsEsc(briefName(s)) + '</span><b class="' + opsTone(s.ret) + '">' + opsPct(s.ret) + '</b>' + (w && w.why ? '<p>' + opsEsc(w.why) + (w.src ? ' <small>' + opsEsc(w.src) + '</small>' : '') + ' ' + warn(w.bad) + '</p>' : '') + '</li>'; };
  h += '<section class="opsPanel"><h4>급등 · 급락</h4>' + (mv.up.length + mv.down.length ? '<div class="opsMv"><ul>' + mv.up.slice(0, 5).map(mrow).join("") + '</ul><ul>' + mv.down.slice(0, 5).map(mrow).join("") + '</ul></div>' : '<p class="opsEmpty">오늘 집계한 급등락이 없어요.</p>') + '</section>';
  // 편성 · 만든 것
  var made = typeof hubDoneLoad === "function" ? hubDoneLoad() : [], doneCtx = {}; made.forEach(function (d) { doneCtx[d.ctx] = 1; });
  var rps = (typeof RP !== "undefined" && RP.saved || []).filter(function (r) { return r.made && String(r.made).slice(0, 10) === smKstDay(); });
  var ans = (typeof arcItems === "function" ? arcItems() : []).filter(function (a) { return opsToday(a.at); });
  h += '<section class="opsPanel"><h4>오늘 편성</h4>' + (plan && (plan.picks || []).length ? '<ol class="opsPlan">' + plan.picks.map(function (p) { return '<li class="' + (doneCtx[p.ctx] ? "done" : "") + '"><span>' + opsEsc(p.slot || "") + '</span><b>' + opsEsc(p.hook || p.ctx) + '</b><small>' + opsEsc(p.why || "") + '</small></li>'; }).join("") + '</ol>' : '<p class="opsEmpty">③ 편성을 하면 올릴 순서가 여기에 정리돼요.</p>') + '</section>';
  h += '<section class="opsPanel"><h4>오늘 만든 것</h4><div class="opsCount"><div><b>' + made.length + '</b><span>카드</span></div><div><b>' + rps.length + '</b><span>리포트 저장</span></div><div><b>' + ans.length + '</b><span>분석 저장</span></div></div>' +
    (made.length + rps.length + ans.length ? '<ul class="opsList">' + made.slice().reverse().map(function (d) { return '<li>카드 · ' + opsEsc(cPlain(d.t || d.ctx)) + ' <small>' + opsHM(d.at) + '</small></li>'; }).concat(rps.map(function (r) { return '<li>리포트 · ' + opsEsc(r.title) + ' <small>' + opsEsc(r.view && r.view.stance || "") + '</small></li>'; }), ans.map(function (a) { return '<li>분석 · ' + opsEsc(a.title) + ' <small>' + opsHM(a.at) + '</small></li>'; })).slice(0, 12).join("") + '</ul>' : '<p class="opsEmpty">아직 없어요. ④ 만들기에서 시작하세요.</p>') + '</section>';
  return h;
}
/* 결과물 전체를 글로 (메모·공유용) */
function opsText() {
  var A = opsBrAi(), D = A && A.data || {}, L = ["[오늘의 작업실] " + opsDayLbl()];
  if ((D.story || []).length) { L.push("", "■ 시장 해설"); D.story.forEach(function (l, k) { if (l) L.push((k + 1) + ". " + l); }); }
  var iss = briefState.issues || []; if (iss.length) { L.push("", "■ 핵심 이슈"); iss.forEach(function (it, i) { var w = ISS_WHY[it.title]; L.push((i + 1) + ". " + it.title + " — " + (it.sub || "")); if (w && w.why) L.push("   왜: " + w.why + (w.so ? " / 그래서: " + w.so : "") + (w.next ? " / 볼 것: " + w.next : "") + (w.bad && w.bad.length ? " (⚠ 숫자 확인: " + w.bad.join(", ") + ")" : "")); }); }
  if ((D.tomorrow || []).length) { L.push("", "■ 내일 볼 것"); D.tomorrow.forEach(function (t) { L.push("- " + t.what + (t.when ? " (" + t.when + ")" : "") + (t.why ? " — " + t.why : "")); }); }
  var plan = typeof MK_AI !== "undefined" && MK_AI && MK_AI.data; if (plan && (plan.picks || []).length) { L.push("", "■ 오늘 편성"); plan.picks.forEach(function (p, i) { L.push((i + 1) + ". [" + (p.slot || "") + "] " + (p.hook || p.ctx)); }); }
  return L.join("\n");
}

function renderOps() {
  var box = document.getElementById("opsBody"); if (!box) return;
  if (!(typeof isOwner === "function" && isOwner())) { box.innerHTML = '<div class="dvEmpty">운영자 전용 페이지예요.</div>'; return; }
  if (!OPS.Ms && !OPS.loading) opsWarm();
  var S = opsSteps(), used = typeof MK_AI !== "undefined" && MK_AI && MK_AI.used ? MK_AI.used + "/" + MK_AI.max : null;
  var h = '<div class="opsHead"><div><h2>오늘의 작업실</h2><p>' + opsDayLbl() + ' · ' + (S.next ? '다음은 <b>' + (SM_FLOW.indexOf(S.next) + 1) + '. ' + S.next.n + '</b>' : '<b>오늘 순서를 모두 마쳤어요</b>') + '</p></div><div class="opsHeadR"><div class="opsProg" style="--p:' + S.n / 5 + '"><i></i></div><span>' + S.n + ' / 5 단계</span><button class="opsLink" data-ops="copy">결과 글로 복사</button></div></div>';
  h += '<div class="opsRail">' + S.html + '</div>';
  h += '<h3 class="opsBoardH">오늘의 결과물</h3><div class="opsBoard">' + opsBoard() + '</div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-ops]"), function (b) { b.onclick = function () { opsAct(b.getAttribute("data-ops"), b); }; });
}
function opsAct(a, btn) {
  if (a === "recheck") { OPS.Ms = null; if (typeof DATA !== "undefined") { DATA.ready = null; DATA.recentPromise = null; } briefState.recent = null; briefState.result = null; briefState.issues = null; renderOps(); return; }
  if (a === "copy") { var t = opsText(); (typeof chCopy === "function" ? chCopy : function (x) { navigator.clipboard && navigator.clipboard.writeText(x); })(t, btn); return; }
  if (a.indexOf("mark:") === 0) { smFlowMark(a.slice(5)); renderOps(); return; }
  if (a.indexOf("go:") === 0) { var g = a.slice(3); if (g === "work") { if (typeof MK !== "undefined") { MK.tab = "work"; if (MK_AI && MK_AI.data) MK.filt = "ai"; } return navTo("onecard"); } return navTo(g); }
  if (a.indexOf("make:") === 0) { if (typeof MK !== "undefined") { MK.tab = "work"; MK.sel = a.slice(5); if (MK_AI && MK_AI.data) MK.filt = "ai"; } navTo("onecard"); setTimeout(function () { var r = document.querySelector("#mkBody .wbRight"); if (r) try { r.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }, 300); return; }
  if (a === "brief") {
    if (!briefState.result || OPS.busy.brief) return;
    if (!briefState.issues && typeof issuesCompute === "function") try { briefState.issues = issuesCompute(briefState.recent, { market: briefState.market || "all", popular: briefState.popular }); } catch (e) {}
    OPS.busy.brief = true; renderOps();
    var fake = document.createElement("button"); document.body.appendChild(fake); fake.style.display = "none";
    var before = opsBrAi(), t0 = Date.now();
    brAiRun(fake);
    var iv = setInterval(function () { var A = opsBrAi(); if ((A && A !== before) || !fake.disabled || Date.now() - t0 > 300000) { clearInterval(iv); OPS.busy.brief = false; fake.remove(); if (currentTab === "ops") renderOps(); } }, 600);
    return;
  }
  if (a === "plan") {
    if (OPS.busy.plan) return; OPS.busy.plan = true; renderOps();
    Promise.resolve(mkAiRun(null)).then(function () { OPS.busy.plan = false; if (currentTab === "ops") renderOps(); });
  }
}
