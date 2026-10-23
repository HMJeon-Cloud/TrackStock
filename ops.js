/* ============================================================ v12.46 오늘의 작업실 — 관리자 하루 작업을 한 화면에서
   위: 왼쪽 → 오른쪽 네 단계(데이터 확인 → 오늘 브리핑 → 만들기 → 업로드·검수). 단계마다 '상태 · 실행 버튼 · 결과 미리보기'.
      오늘 브리핑 = Claude 호출 한 번(smDailyRun)으로 해설·이슈 이유·급등락 이유·내일 볼 것·카드 편성·리포트 선정이 한꺼번에 채워진다.
   아래: 모닝 노트 — 앱이 가진 숫자를 증권사 데일리처럼 한 장에(지수 표 · 폭 · 업종 · 급등락/거래대금 · 핵심 이슈 · 국면 신호 · 매크로 · 일정 · 편성).
   새 서버 함수 없음 — 기존 화면의 함수(dhMarket · nbStat · nbNow · macSer · hubDoneLoad · RP.saved · arcItems)를 그대로 부른다.
   ============================================================ */
var OPS = { busy: {}, Ms: null, at: 0, loading: false };
function opsEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
function opsPct(x, d) { return typeof briefPct === "function" ? briefPct(x, d) : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 2 : d) + "%"; }
function opsTone(x) { return x > 0 ? "up" : x < 0 ? "down" : ""; }
function opsP(x, d) { return x == null || !isFinite(x) ? '<span class="opsNa">-</span>' : '<span class="' + opsTone(x) + '">' + opsPct(x, d) + '</span>'; }
function opsDayLbl() { var d = new Date(Date.now() + 9 * 3600e3); return (d.getUTCMonth() + 1) + "월 " + d.getUTCDate() + "일 (" + "일월화수목금토"[d.getUTCDay()] + ")"; }
function opsHM(ms) { return ms ? new Date(ms + 9 * 3600e3).toISOString().slice(11, 16) : ""; }
function opsBrAi() { return typeof BR_AI !== "undefined" && typeof brAiKey === "function" ? BR_AI[brAiKey()] || null : null; }
function opsToday(ms) { return ms && new Date(ms + 9 * 3600e3).toISOString().slice(0, 10) === smKstDay(); }
function opsNum(v, cur) { if (v == null || !isFinite(v)) return "-"; var a = Math.abs(v); return (cur === "KRW" || a >= 1000) ? Math.round(v).toLocaleString("ko-KR") : a >= 100 ? v.toFixed(1) : v.toFixed(2); }
function opsWarnTxt(b) { return typeof smNumWarn === "function" ? smNumWarn(b) : ""; }

/* 데이터 준비: 시세 · 전체 시장 요약 · 브리핑 계산 · 매크로 */
function opsWarm() {
  if (OPS.loading) return; OPS.loading = true;
  var uni = function (m) { return typeof dlUniLoad === "function" ? dlUniLoad(m).catch(function () { return null; }) : Promise.resolve(null); };
  var mac = typeof macroEnsure === "function" ? macroEnsure().catch(function () { return null; }) : Promise.resolve(null);
  dataReady().then(function () { return Promise.all([briefState.recent || fetchRecent(), uni("us"), uni("kr"), mac]); }).then(function (a) {
    var recent = a[0]; OPS.loading = false;
    if (recent && recent.symbols) {
      if (!briefState.recent) briefState.recent = recent;
      if (typeof dhMarket === "function") { OPS.Ms = ["kr", "us", "coin"].map(function (m) { return dhMarket(m, recent); }); OPS.at = Date.now(); if (typeof smFlowMark === "function") { OPS.Ms.forEach(function (m) { if (m.level === "ok") smFlowMark("data", m.mk); }); if (OPS.Ms.every(function (m) { return m.level === "ok"; })) smFlowMark("data", "all"); } }
      opsCompute();
      if (briefState.result && typeof cardsNewsFetch === "function") cardsNewsFetch(briefState.result).catch(function () {});
    } else OPS.err = "시세 데이터를 불러오지 못했어요";
    if (currentTab === "ops") renderOps();
  }).catch(function (e) { OPS.loading = false; OPS.err = e.message; if (currentTab === "ops") renderOps(); });
}
function opsCompute() {
  if (!briefState.recent || typeof briefCompute !== "function") return;
  try { briefState.result = briefCompute(briefState.recent, { mode: briefState.mode || "day", market: smMk(), popular: briefState.popular }); } catch (e) { console.warn(e); }
  try { briefState.issues = typeof issuesCompute === "function" ? issuesCompute(briefState.recent, { market: smMk(), popular: briefState.popular }) : []; } catch (e) {}
}

/* ---------- 단계 카드 ---------- */
function opsStep(i, k, st, title, what, body, acts) {
  return '<article class="opsStep ' + st + '" data-step="' + k + '"><header><span class="opsNode">' + (st === "done" ? "✓" : i) + '</span><div><h3>' + title + '</h3><p>' + what + '</p></div></header><div class="opsStepBody">' + body + '</div><footer>' + acts + '</footer></article>';
}
function opsSteps() {
  var mk = smMk(), D = smFlowDone(mk), next = SM_FLOW.filter(function (s) { return !D[s.k]; })[0], st = function (k) { return D[k] ? "done" : next && next.k === k ? "now" : "wait"; };
  var R = briefState.result, A = opsBrAi(), P = smPlanFor(mk), plan = P ? P.data : null, made = smDoneFor(mk), busy = typeof SM_DAILY !== "undefined" && SM_DAILY.busy;
  var h = [];
  // ① 데이터
  var b1 = !OPS.Ms ? '<div class="opsMuted">' + (OPS.err ? opsEsc(OPS.err) : "상태를 확인하는 중…") + '</div>' : OPS.Ms.filter(function (M) { return mk === "all" || M.mk === mk; }).map(function (M) {
    var nm = { kr: "국내", us: "미국", coin: "코인" }[M.mk], warn = M.err ? "계산 실패" : M.stale && M.stale.length ? "늦은 종목 " + M.stale.length : M.spike && M.spike.length ? "급변 의심 " + M.spike.length : M.mk !== "coin" && M.off ? "전체 시장 숫자 숨김" : M.coinLate ? "어제 마감분 없음" : "";
    return '<div class="opsMk ' + (warn ? "warn" : "ok") + '"><b>' + nm + '</b><span>' + (typeof dhMD === "function" ? dhMD(M.date) : M.date) + '</span><em>' + (warn ? opsEsc(warn) : "정상") + '</em></div>';
  }).join("");
  h.push(opsStep(1, "data", st("data"), "데이터 확인", mk === "all" ? "세 시장의 시세가 최신인지" : SM_MK_NM[mk] + " 시세가 최신인지", b1,
    '<button class="opsBtn" data-ops="recheck">다시 확인</button><button class="opsLink" data-ops="go:data">데이터 센터</button>' + (D.data ? '' : '<button class="opsLink" data-ops="mark:data">확인했어요</button>')));
  // ② 오늘 브리핑 (Claude 한 번)
  var nIss = A ? (A.data.issues || []).filter(function (x) { return x.why; }).length : 0;
  var b2 = A ? '<p class="opsLead">' + opsEsc((A.data.story || [])[0] || A.data.note || "") + '</p><ul class="opsGot"><li>해설 ' + (A.data.story || []).filter(Boolean).length + '줄</li><li>이슈 이유 ' + nIss + '/' + (A.iss || []).length + '</li><li>급등락 이유 ' + (A.data.movers || []).filter(function (m) { return m.why; }).length + '</li><li>내일 볼 것 ' + (A.data.tomorrow || []).length + '</li><li>카드 편성 ' + (plan ? (plan.picks || []).length : 0) + '</li><li>리포트 ' + (plan ? (plan.reports || []).length : 0) + '</li></ul><div class="opsMuted">' + opsHM(A.at) + ' · 웹 검색 ' + (A.searches || 0) + '회' + (A.repaired ? ' · 형식 자동 복구' : '') + (A.truncated ? ' · <span class="opsHot">답이 길어 뒷부분이 잘림 — 다시 만들면 대개 전부 나와요</span>' : '') + (A.stop && A.stop !== "end_turn" ? ' · 멈춤 ' + opsEsc(A.stop) : '') + (A.shared ? ' · 국내·미국·코인 공통' : '') + '</div>' + (A.raw ? '<button class="opsLink" data-ops="raw">Claude 원문 보기</button>' : '') + ''
    : R ? '<div class="opsMuted">Claude 호출 한 번으로 국내·미국·코인을 함께 읽고 여섯 가지를 채워요: 시장 해설 3줄 · 핵심 이슈 왜/그래서/볼 것 · 급등락 이유 · 내일 볼 것 · 오늘 카드 편성 · 볼 리포트</div>' : '<div class="opsMuted">브리핑 계산 중…</div>';
  if (typeof SM_DAILY !== "undefined" && SM_DAILY.last && !A) b2 += '<div class="opsErr">마지막 시도 실패 ' + opsHM(SM_DAILY.last.at) + ' — ' + opsEsc(String(SM_DAILY.last.msg || "").split("\n")[0]) + (SM_DAILY.last.raw ? ' <button class="opsLink" data-ops="rawerr">원문 보기</button>' : '') + '</div>';
  h.push(opsStep(2, "brief", st("brief"), "오늘 브리핑", "Claude 한 번 · 세 시장 공통 — 해설 · 이유 · 편성 · 리포트", b2,
    '<button class="opsBtn' + (st("brief") === "now" ? " pri" : "") + '" data-ops="daily"' + (R && !busy ? '' : ' disabled') + '>' + (busy ? "Claude가 만드는 중… (1~3분)" : typeof smJobPending === "function" && smJobPending("daily") ? "진행 중인 작업 이어서 받기" : A ? "다시 만들기" : "Claude 브리핑 만들기") + '</button><button class="opsLink" data-ops="go:brief">브리핑 화면</button>'));
  // ③ 만들기
  var doneCtx = {}; made.forEach(function (d) { doneCtx[d.ctx] = 1; });
  var picks = plan ? (typeof mkAiList === "function" && typeof mkTopicsScored === "function" ? (function () { try { return mkAiList(mkTopicsScored()); } catch (e) { return []; } })() : []) : [];
  var Q = []; try { Q = typeof rpQuestions === "function" ? rpQuestions() : []; } catch (e) {} var qb = {}; Q.forEach(function (q) { qb[q.id] = q; });
  var reps = plan ? (plan.reports || []).map(function (r) { return qb[r.id] ? { id: r.id, t: qb[r.id].t, why: r.why } : r.name ? { id: "", t: r.name + ", 기회인가 위기인가", why: r.why } : null; }).filter(Boolean) : [];
  var b3 = picks.length || reps.length ? (picks.length ? '<div class="opsSubH">카드 ' + picks.length + '</div><ol class="opsPicks">' + picks.slice(0, 5).map(function (x) { return '<li class="' + (doneCtx[x.ctx] ? "done" : "") + '"><button data-ops="make:' + opsEsc(x.ctx) + '"><span>' + opsEsc(cPlain(x.t)) + '</span><small>' + (doneCtx[x.ctx] ? "만듦" : opsEsc((x.why || "").match(/^\[(.+?)\]/) ? x.why.match(/^\[(.+?)\]/)[1] : "")) + '</small></button></li>'; }).join("") + '</ol>' + (picks.length > 5 ? '<div class="opsMuted">외 ' + (picks.length - 5) + '개는 카드 작업대에서</div>' : '') : '') +
    (reps.length ? '<div class="opsSubH">리포트 ' + reps.length + '</div><ul class="opsMade">' + reps.slice(0, 3).map(function (r) { return '<li><button data-ops="report:' + opsEsc(r.id) + '">' + opsEsc(r.t) + '</button></li>'; }).join("") + '</ul>' : '')
    : '<div class="opsMuted">② 브리핑을 만들면 오늘 만들 카드와 볼 리포트가 순서대로 나와요. 편성 없이도 아래 링크로 바로 만들 수 있어요.</div>';
  h.push(opsStep(3, "make", st("make"), "만들기", "편성 순서대로 카드 · 리포트 · 분석", b3,
    '<button class="opsLink" data-ops="go:work">카드 작업대</button><button class="opsLink" data-ops="go:report">리포트</button><button class="opsLink" data-ops="go:analyst">분석</button>'));
  // ④ 업로드·검수
  var b4 = made.length ? '<div class="opsMuted">오늘 만든 카드 ' + made.length + '개 — 카드마다 아래 순서로</div><ol class="opsHow"><li>✨ AI 문구 — 인스타 캡션·스레드 본문·답글 2개(궁금증형·정보형 두 가지)</li><li>발행 전 검수 — 카드 글자와 캡션의 숫자·부호·날짜 대조, 권유·과장·오탈자 점검</li><li>복사해서 올리기</li></ol><ul class="opsMade">' + made.slice(-3).reverse().map(function (d) { return '<li><button data-ops="make:' + opsEsc(d.ctx) + '">' + opsEsc(cPlain(d.t || d.ctx)) + '<small>' + opsHM(d.at) + '</small></button></li>'; }).join("") + '</ul>'
    : '<div class="opsMuted">카드를 만들면 여기서 업로드 글(✨ AI 문구) → 검수로 바로 갈 수 있어요. 글은 카드마다 따로 만들어야 해서(숫자가 다름) Claude를 카드 수만큼 써요.</div>';
  h.push(opsStep(4, "pub", st("pub"), "업로드 · 검수", "AI 문구 → 발행 전 검수 → 올리기", b4,
    (D.pub ? '<span class="opsMuted">오늘 올림 ✓</span>' : '<button class="opsLink" data-ops="mark:pub"' + (made.length ? '' : ' disabled') + '>올렸어요</button>')));
  var n = SM_FLOW.filter(function (s) { return D[s.k]; }).length;
  return { html: h.join(""), n: n, total: SM_FLOW.length, next: next };
}

/* ---------- 모닝 노트 (결과물) ---------- */
function opsIdxRows(R) {
  var rows = (R.indexRow || []).map(function (x) { var S = typeof nbStat === "function" ? nbStat(x.sym) : null; return { sym: x.sym, name: x.name, last: x.last, ret: x.ret, S: S }; });
  var mk = smMk(), extra = mk === "kr" ? [["^VIX", "공포지수"], ["^GSPC", "S&P500"]] : mk === "us" ? [["KRW=X", "달러/원"], ["^KS11", "코스피"]] : mk === "coin" ? [["^GSPC", "S&P500"], ["GLD", "금"]] : [["TLT", "미국 장기채"], ["^DJI", "다우"]];
  extra.forEach(function (p) { if (rows.some(function (r) { return r.sym === p[0]; })) return; var S = typeof nbStat === "function" ? nbStat(p[0]) : null; if (S) rows.push({ sym: p[0], name: p[1], last: S.last, ret: S.ret1, S: S, extra: true }); });
  return rows;
}
function opsIdxTable(R) {
  var rows = opsIdxRows(R); if (!rows.length) return '<p class="opsEmpty">지수 데이터가 없어요.</p>';
  return '<table class="opsT"><thead><tr><th>지수 · 자산</th><th class="r">종가</th><th class="r">일간</th><th class="r">5일</th><th class="r">1개월</th><th class="r">3개월</th><th class="r">52주 고점 대비</th><th class="r">20일선</th><th class="r">평소 대비</th></tr></thead><tbody>' +
    rows.map(function (r) { var S = r.S, sig = S && S.sd > 0 ? Math.abs(S.ret1) / S.sd : null; return '<tr' + (r.extra ? ' class="opsDim"' : '') + '><td>' + opsEsc(r.name) + (S && S.newHigh ? ' <i class="opsTag hi">52주 신고가</i>' : S && S.newLow ? ' <i class="opsTag lo">52주 신저가</i>' : '') + '</td><td class="r">' + opsNum(r.last, S && S.cur) + '</td><td class="r">' + opsP(r.ret) + '</td><td class="r">' + opsP(S && S.ret5) + '</td><td class="r">' + opsP(S && S.m1, 1) + '</td><td class="r">' + opsP(S && S.m3, 1) + '</td><td class="r">' + opsP(S && S.vsHi, 1) + '</td><td class="r">' + (S ? (S.above20 ? '<span class="up">위</span>' : '<span class="down">아래</span>') : '-') + '</td><td class="r">' + (sig != null ? '<b class="' + (sig >= 2 ? "opsHot" : "") + '">' + sig.toFixed(1) + '배</b>' : '-') + '</td></tr>'; }).join("") + '</tbody></table>';
}
var OPS_MAJOR = { kr: ["005930.KS", "000660.KS", "005380.KS", "373220.KS", "207940.KS", "068270.KS", "035420.KS", "105560.KS", "012450.KS", "000270.KS"], us: ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "TSM", "JPM"], coin: ["BTC-USD", "ETH-USD", "XRP-USD", "SOL-USD", "BNB-USD", "DOGE-USD"] };
function opsMajorTable(R) {
  var mk = smMk(), syms = mk === "all" ? OPS_MAJOR.kr.slice(0, 4).concat(OPS_MAJOR.us.slice(0, 4), OPS_MAJOR.coin.slice(0, 2)) : OPS_MAJOR[mk] || [];
  var pop = (briefState.popular || []).map(function (p) { return p.s; }).filter(function (s) { return mk === "all" || smSymMk(s) === mk; }), popSet = {}; pop.forEach(function (s) { popSet[s] = 1; });
  var list = syms.slice(); pop.forEach(function (s) { if (list.indexOf(s) < 0 && list.length < syms.length + 4) list.push(s); });
  var rec = briefState.recent && briefState.recent.symbols || {}, rows = list.map(function (s) { var S = rec[s] && typeof nbStat === "function" ? nbStat(s) : null; return S ? { sym: s, S: S, pop: !!popSet[s] } : null; }).filter(Boolean);
  if (!rows.length) return '<p class="opsEmpty">주요 종목 데이터가 없어요.</p>';
  var nm = function (s) { return typeof briefName === "function" ? briefName({ sym: s, name: rec[s] && rec[s].meta && rec[s].meta.shortName }) : s; };
  return '<table class="opsT"><thead><tr><th>종목</th><th class="r">종가</th><th class="r">일간</th><th class="r">5일</th><th class="r">1개월</th><th class="r">3개월</th><th class="r">52주 고점 대비</th><th class="r">20일선</th><th class="r">거래대금</th><th class="r">평소 대비</th></tr></thead><tbody>' +
    rows.map(function (r) { var S = r.S, sig = S.sd > 0 ? Math.abs(S.ret1) / S.sd : null; return '<tr><td>' + opsEsc(nm(r.sym)) + (r.pop ? ' <i class="opsTag pop">인기</i>' : '') + (S.newHigh ? ' <i class="opsTag hi">52주 신고가</i>' : S.newLow ? ' <i class="opsTag lo">52주 신저가</i>' : '') + '</td><td class="r">' + opsNum(S.last, S.cur) + '</td><td class="r">' + opsP(S.ret1) + '</td><td class="r">' + opsP(S.ret5) + '</td><td class="r">' + opsP(S.m1, 1) + '</td><td class="r">' + opsP(S.m3, 1) + '</td><td class="r">' + opsP(S.vsHi, 1) + '</td><td class="r">' + (S.above20 ? '<span class="up">위</span>' : '<span class="down">아래</span>') + '</td><td class="r">' + (S.amtX != null ? '<b class="' + (S.amtX >= 1.8 ? "opsHot" : "") + '">' + S.amtX.toFixed(1) + '배</b>' : '-') + '</td><td class="r">' + (sig != null ? '<b class="' + (sig >= 2 ? "opsHot" : "") + '">' + sig.toFixed(1) + '배</b>' : '-') + '</td></tr>'; }).join("") + '</tbody></table><p class="opsMuted">시가총액 상위 + 이 앱에서 최근 2주 많이 찾은 종목(인기) · 거래대금 = 최근 5일 ÷ 20일 평균</p>';
}
function opsBreadth(R) {
  var t = R.temp; if (!t || !isFinite(t.upPct)) return '<p class="opsEmpty">전체 시장 숫자가 숨겨져 있어요 — ① 데이터 확인에서 전체 시장 요약 상태를 보세요.</p>';
  var tile = function (v, l, s) { return '<div class="opsTile"><b>' + v + '</b><span>' + l + '</span>' + (s ? '<small>' + s + '</small>' : '') + '</div>'; };
  var mood = t.upPct >= 0.7 ? "대부분 상승 — 시장 전체가 움직인 날" : t.upPct <= 0.3 ? "대부분 하락 — 시장 전체가 움직인 날" : "방향이 갈린 날 — 업종·종목 재료가 결과를 정함";
  var trend = t.abovePct >= 0.6 ? "상승 추세 우세" : t.abovePct <= 0.4 ? "하락 추세 우세" : "혼조";
  return '<div class="opsTiles">' + tile(Math.round(t.upPct * 100) + "%", "오른 종목", t.up + "/" + t.total) + tile(Math.round(t.abovePct * 100) + "%", "20일선 위", trend) + (t.above200Pct != null ? tile(Math.round(t.above200Pct * 100) + "%", "200일선 위", t.above200 + "/" + t.n200) : "") + tile((t.newHigh || []).length + " : " + (t.newLow || []).length, "52주 신고가 : 신저가", (t.nearHigh || []).length ? "고점 근처 " + t.nearHigh.length : "") + '</div><p class="opsMuted">' + mood + (R.basis && R.basis.name ? ' · 기준 ' + opsEsc(R.basis.name) : '') + '</p>' +
    ((t.newHigh || []).length ? '<div class="opsChips"><span>신고가</span>' + t.newHigh.slice(0, 8).map(function (s) { return '<i>' + opsEsc(briefName(s)) + '</i>'; }).join("") + '</div>' : '') + ((t.newLow || []).length ? '<div class="opsChips"><span>신저가</span>' + t.newLow.slice(0, 8).map(function (s) { return '<i>' + opsEsc(briefName(s)) + '</i>'; }).join("") + '</div>' : '');
}
function opsThemes(R) {
  var th = R.themes || []; if (!th.length) return '<p class="opsEmpty">업종 데이터가 없어요.</p>';
  var nm = function (s) { return s ? briefName(s) + ' ' + opsPct(s.ret, 1) : "-"; };
  return '<table class="opsT"><thead><tr><th>업종</th><th class="r">평균</th><th class="r">상승 / 종목</th><th>가장 센</th><th>가장 약한</th></tr></thead><tbody>' + th.map(function (x) { return '<tr><td>' + opsEsc(x.name) + '</td><td class="r">' + opsP(x.ret) + '</td><td class="r"><span class="opsBar"><i style="width:' + Math.round(x.up / x.n * 100) + '%"></i></span>' + x.up + '/' + x.n + '</td><td>' + opsEsc(nm(x.best)) + '</td><td>' + opsEsc(nm(x.worst)) + '</td></tr>'; }).join("") + '</tbody></table>';
}
function opsMovers(R, A) {
  var chk = A && A.chk || {}, mw = {}; ((A && A.data.movers) || []).forEach(function (m, k) { mw[m.sym] = { why: m.why, src: m.src, bad: chk.movers && chk.movers[k] }; });
  var row = function (s, amt) { var w = mw[s.sym], S = typeof nbStat === "function" ? nbStat(s.sym) : null; return '<li><div class="opsMvL"><b>' + opsEsc(briefName(s)) + '</b><small>' + (S && S.sd > 0 ? '평소의 ' + (Math.abs(S.ret1) / S.sd).toFixed(1) + '배' : '') + (S && S.vsHi != null ? ' · 고점 대비 ' + opsPct(S.vsHi, 0) : '') + (amt && s.amtX ? ' · 거래대금 ' + s.amtX.toFixed(1) + '배' : S && S.amtX >= 1.5 ? ' · 거래대금 ' + S.amtX.toFixed(1) + '배' : '') + '</small></div><b class="' + opsTone(s.ret) + '">' + opsPct(s.ret) + '</b>' + (w && w.why ? '<p>' + opsEsc(w.why) + (w.src ? ' <small>' + opsEsc(w.src) + '</small>' : '') + ' ' + opsWarnTxt(w.bad) + '</p>' : '') + '</li>'; };
  var mv = R.movers || { up: [], down: [] }, hot = R.hotVol || [];
  if (!mv.up.length && !mv.down.length) return '<p class="opsEmpty">오늘 집계한 급등락이 없어요.</p>';
  return '<div class="opsMv3"><div><div class="opsSubH">급등</div><ul>' + mv.up.slice(0, 5).map(function (s) { return row(s); }).join("") + '</ul></div><div><div class="opsSubH">급락</div><ul>' + mv.down.slice(0, 5).map(function (s) { return row(s); }).join("") + '</ul></div><div><div class="opsSubH">거래대금 급증</div>' + (hot.length ? '<ul>' + hot.slice(0, 5).map(function (s) { return row(s, true); }).join("") + '</ul>' : '<p class="opsEmpty">평소의 1.8배를 넘은 종목이 없어요.</p>') + '</div></div>';
}
function opsIssues() {
  var iss = briefState.issues || []; if (!iss.length) return '<p class="opsEmpty">' + (briefState.result ? "이 시장에서 고를 만한 이슈가 없어요." : "이슈를 계산하는 중이에요.") + '</p>';
  return '<table class="opsT opsIss"><thead><tr><th></th><th>이슈</th><th>왜</th><th>그래서</th><th>볼 것</th></tr></thead><tbody>' + iss.map(function (it, i) {
    var w = typeof ISS_WHY !== "undefined" && ISS_WHY[it.title];
    return '<tr><td class="opsNo">' + (i + 1) + '</td><td><b>' + opsEsc(it.title) + '</b><small>' + opsEsc(it.sub) + '</small></td>' + (w && w.why ? '<td>' + opsEsc(w.why) + (w.src ? '<small>' + (w.url ? '<a href="' + opsEsc(w.url) + '" target="_blank" rel="noopener">' + opsEsc(w.src) + '</a>' : opsEsc(w.src)) + (w.conf ? ' · 확신 ' + opsEsc(w.conf) : '') + '</small>' : '') + opsWarnTxt(w.bad) + '</td><td>' + opsEsc(w.so || "") + '</td><td>' + opsEsc(w.next || "") + '</td>' : '<td colspan="3" class="opsMuted">' + (w || opsBrAi() ? "확실한 원인을 찾지 못해 비워 뒀어요" : "② 브리핑을 만들면 채워져요") + '</td>') + '</tr>';
  }).join("") + '</tbody></table>';
}
function opsSignals(R) {
  var L = []; try { var now = nbNow(); (now && now.why || []).forEach(function (w) { L.push(w); }); } catch (e) {}
  var st = function (s) { return typeof nbStat === "function" ? nbStat(s) : null; }, ks = st("^KS11"), sp = st("SPY") || st("^GSPC"), vix = st("^VIX");
  var ph = function (nm, S) { if (!S || S.vsHi == null) return null; var d = S.vsHi; return nm + " 고점 대비 " + opsPct(d, 1) + " — " + (d <= -0.2 ? "약세장 구간" : d <= -0.1 ? "조정 구간" : d >= -0.03 ? "고점 근처" : "완만한 되돌림"); };
  var P = [ph("코스피", ks), ph("S&P500", sp)].filter(Boolean);
  if (vix) P.push("공포지수 " + opsNum(vix.last) + " (" + opsPct(vix.ret1) + ") — " + (vix.last >= 30 ? "공포" : vix.last >= 20 ? "경계" : "안정"));
  if (!L.length && !P.length) return '<p class="opsEmpty">신호 데이터가 없어요.</p>';
  return (P.length ? '<ul class="opsSig">' + P.map(function (x) { return '<li>' + opsEsc(x) + '</li>'; }).join("") + '</ul>' : '') + (L.length ? '<div class="opsSubH">앱 규칙 신호</div><ul class="opsSig">' + L.map(function (x) { return '<li>' + opsEsc(x) + '</li>'; }).join("") + '</ul>' : '<p class="opsMuted">앱 규칙 신호(금리 상승·달러 강세·유가·공포)는 지금 없음 — 평시</p>');
}
function opsMacro() {
  if (typeof macSer !== "function") return '<p class="opsEmpty">매크로 데이터가 없어요.</p>';
  var items = [["krw", "원/달러", "원", 0], ["bok", "한국 기준금리", "%", 2], ["fed", "미 기준금리", "%", 2], ["us10y", "미 10년물", "%", 2]].map(function (p) { var S = macSer(p[0]); if (!S || !S.v.length) return null; var n = S.v.length, v = S.v[n - 1], prev = n > 1 ? S.v[n - 2] : null, d = new Date(S.t[n - 1]); var chg = prev != null ? v - prev : null; return '<div class="opsTile"><b>' + (p[3] ? v.toFixed(p[3]) : Math.round(v).toLocaleString("ko-KR")) + '<small>' + p[2] + '</small></b><span>' + p[1] + '</span><small>' + (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + (chg != null && Math.abs(chg) > 1e-9 ? ' · ' + (chg > 0 ? '+' : '') + (p[3] ? chg.toFixed(2) + '%p' : Math.round(chg) + '원') : chg != null ? ' · 변동 없음' : '') + '</small></div>'; }).filter(Boolean);
  var gap = typeof macGapSer === "function" ? macGapSer() : null; if (gap && gap.v.length) items.push('<div class="opsTile"><b>' + gap.v[gap.v.length - 1].toFixed(2) + '<small>%p</small></b><span>한미 금리차 (미−한)</span><small>' + (gap.v[gap.v.length - 1] > 0 ? "미국이 높음 — 환율 상방 압력" : "한국이 높음") + '</small></div>');
  return items.length ? '<div class="opsTiles">' + items.join("") + '</div><p class="opsMuted">한국은행 ECOS · FRED · 매일 07:00 수집 · 기준금리는 바뀐 날만 기록</p>' : '<p class="opsEmpty">매크로 수집이 아직 없어요 — 데이터 센터에서 매크로 지금 수집</p>';
}
function opsCalendar(A) {
  var D = A && A.data || {}, h = '';
  if ((D.tomorrow || []).length) h += '<div class="opsSubH">다음 거래일에 볼 것 <small>Claude</small></div><ul class="opsTm">' + D.tomorrow.map(function (t) { return '<li><b>' + opsEsc(t.what) + '</b>' + (t.when ? '<time>' + opsEsc(t.when) + '</time>' : '') + (t.why ? '<p>' + opsEsc(t.why) + '</p>' : '') + '</li>'; }).join("") + '</ul>';
  var ev = []; try { ev = typeof pubUpcoming === "function" ? pubUpcoming(7) : []; } catch (e) {}
  h += '<div class="opsSubH">7일 일정 <small>FOMC · CPI · 금통위 · 휴장</small></div>' + (ev.length ? '<ul class="opsCal">' + ev.slice(0, 10).map(function (e) { return '<li><time>' + opsEsc(e.d.slice(5).replace("-", "/")) + '</time><b>' + opsEsc(e.t) + '</b>' + (e.n ? '<small>' + opsEsc(e.n) + '</small>' : '') + '</li>'; }).join("") + '</ul>' : '<p class="opsEmpty">앞으로 7일 동안 등록된 일정이 없어요.</p>');
  return h;
}
function opsPlanBoard(plan, picks, reps, made) {
  var doneCtx = {}; made.forEach(function (d) { doneCtx[d.ctx] = 1; });
  var h = '';
  if (plan && plan.summary) h += '<p class="opsLead">' + opsEsc(plan.summary) + '</p>';
  if (picks.length) h += '<div class="opsSubH">올릴 카드 ' + picks.length + '</div><ol class="opsPlan">' + picks.map(function (x) { var m = (x.why || "").match(/^\[(.+?)\]\s*(?:“(.+?)”\s*·\s*)?(.*)$/); return '<li class="' + (doneCtx[x.ctx] ? "done" : "") + '"><span>' + opsEsc(m ? m[1] : "") + '</span><b>' + opsEsc(cPlain(x.t)) + '</b><small>' + opsEsc(m ? (m[2] ? "“" + m[2] + "” · " : "") + m[3] : x.why || "") + '</small></li>'; }).join("") + '</ol>';
  if (reps.length) h += '<div class="opsSubH">볼 리포트 ' + reps.length + '</div><ul class="opsList">' + reps.map(function (r) { return '<li>' + opsEsc(r.t) + (r.why ? ' <small>' + opsEsc(r.why) + '</small>' : '') + '</li>'; }).join("") + '</ul>';
  if (plan && (plan.extra || []).length) h += '<div class="opsSubH">앱 주제에 없는 오늘 화제</div><ul class="opsList">' + plan.extra.map(function (x) { return '<li>' + opsEsc(x.title || "") + ' <small>' + opsEsc(x.idea || "") + (x.data ? ' · 필요한 데이터: ' + opsEsc(x.data) : '') + '</small></li>'; }).join("") + '</ul>';
  if (plan && (plan.week || []).length) h += '<details class="opsWeek"><summary>이번 주 연재 기획 ' + plan.week.length + '개</summary><ul class="opsList">' + plan.week.map(function (w) { return '<li><b>' + opsEsc(w.day || "") + '</b> ' + opsEsc(w.title || "") + ' <small>' + opsEsc(w.hook || "") + '</small></li>'; }).join("") + '</ul></details>';
  return h || '<p class="opsEmpty">② 브리핑을 만들면 올릴 카드와 볼 리포트가 여기에 정리돼요.</p>';
}
function opsBoard() {
  var R = briefState.result, A = opsBrAi(), Dd = A && A.data || {}, chk = A && A.chk || {}, mk = smMk(), P = smPlanFor(mk), plan = P ? P.data : null;
  if (!R) return '<p class="opsEmpty">시장 데이터를 준비하는 중이에요…</p>';
  var picks = plan ? (function () { try { return mkAiList(mkTopicsScored()); } catch (e) { return []; } })() : [];
  var Q = []; try { Q = typeof rpQuestions === "function" ? rpQuestions() : []; } catch (e) {} var qb = {}; Q.forEach(function (q) { qb[q.id] = q; });
  var reps = plan ? (plan.reports || []).map(function (r) { return qb[r.id] ? { t: qb[r.id].t, why: r.why } : r.name ? { t: r.name, why: r.why } : null; }).filter(Boolean) : [];
  var made = smDoneFor(mk), inMk = function (sym) { return mk === "all" || !sym || smSymMk(sym) === mk; };
  var rps = (typeof RP !== "undefined" && RP.saved || []).filter(function (r) { return r.made && String(r.made).slice(0, 10) === smKstDay() && inMk(r.sym); });
  var ans = (typeof arcItems === "function" ? arcItems() : []).filter(function (a) { return opsToday(a.at) && inMk(a.sym); });
  var sec = function (cls, title, sub, body) { return '<section class="opsPanel ' + cls + '"><h4>' + title + (sub ? ' <small>' + sub + '</small>' : '') + '</h4>' + body + '</section>'; };
  var asOf = typeof cDate === "function" ? cDate(R.asOf) : "";
  var h = '';
  // 1 요약
  h += sec("opsWide opsSum", "요약", asOf + " 종가 기준" + (A ? " · Claude " + opsHM(A.at) : ""), (Dd.story || []).length ? '<ol class="opsStory">' + Dd.story.map(function (l, k) { return l ? '<li>' + opsEsc(l) + ' ' + opsWarnTxt(chk.story && chk.story[k]) + '</li>' : ''; }).join("") + '</ol>' + (Dd.note ? '<p class="opsNote">오늘의 흐름 — ' + opsEsc(Dd.note) + '</p>' : '') + (typeof smSrcHtml === "function" ? smSrcHtml(A.sources) : '')
    : '<p class="opsEmpty">② 브리핑을 만들면 세 줄 해설이 여기에 와요. 아래 숫자는 Claude 없이도 앱이 바로 계산한 값이에요.</p>');
  // 2 지수
  h += sec("opsWide", "시장 한눈에", "지수 · 환율 · 금 · 변동성", opsIdxTable(R));
  h += sec("opsWide", "주요 종목", "시가총액 상위 · 인기 종목", opsMajorTable(R));
  // 3 폭 + 4 신호
  h += sec("", "시장의 폭", R.temp && R.temp.uni ? opsEsc(R.temp.uni) : "", opsBreadth(R));
  h += sec("", "국면 · 신호", "고점 대비 위치 · 공포지수 · 앱 규칙", opsSignals(R));
  // 5 업종
  h += sec("opsWide", "업종 흐름", "평균 등락 · 상승 종목 비율", opsThemes(R));
  // 6 급등락
  h += sec("opsWide", "급등 · 급락 · 거래대금", "이유는 Claude(출처 포함) · 확실하지 않으면 비움", opsMovers(R, A));
  // 7 이슈
  h += sec("opsWide", "핵심 이슈 " + (briefState.issues || []).length, "평소보다 이례적인 순 · 왜 / 그래서 / 볼 것", opsIssues());
  // 8 매크로 + 9 일정
  h += sec("", "매크로", "금리 · 환율", opsMacro());
  h += sec("", "일정", "", opsCalendar(A));
  // 10 편성 + 11 만든 것
  h += sec("", "오늘 편성", plan ? "Claude · " + opsHM(P.at) : "", opsPlanBoard(plan, picks, reps, made));
  h += sec("", "오늘 만든 것", "", '<div class="opsCount"><div><b>' + made.length + '</b><span>카드</span></div><div><b>' + rps.length + '</b><span>리포트 저장</span></div><div><b>' + ans.length + '</b><span>분석 저장</span></div></div>' +
    (made.length + rps.length + ans.length ? '<ul class="opsList">' + made.slice().reverse().map(function (d) { return '<li>카드 · ' + opsEsc(cPlain(d.t || d.ctx)) + ' <small>' + opsHM(d.at) + '</small></li>'; }).concat(rps.map(function (r) { return '<li>리포트 · ' + opsEsc(r.title) + ' <small>' + opsEsc(r.view && r.view.stance || "") + '</small></li>'; }), ans.map(function (a) { return '<li>분석 · ' + opsEsc(a.title) + ' <small>' + opsHM(a.at) + '</small></li>'; })).slice(0, 12).join("") + '</ul>' : '<p class="opsEmpty">아직 없어요. ③ 만들기에서 시작하세요.</p>'));
  return h;
}
/* 모닝 노트 전체를 글로 (메모·공유용) */
function opsText() {
  var R = briefState.result, A = opsBrAi(), D = A && A.data || {}, pc = function (x, d) { return x == null || !isFinite(x) ? "-" : opsPct(x, d); }, L = ["[모닝 노트] " + opsDayLbl() + " · " + SM_MK_NM[smMk()].replace(/^\S+\s/, "") + (R ? " · " + (typeof cDate === "function" ? cDate(R.asOf) : "") + " 종가 기준" : "")];
  if ((D.story || []).length) { L.push("", "■ 요약"); D.story.forEach(function (l, k) { if (l) L.push((k + 1) + ". " + l); }); if (D.note) L.push("흐름: " + D.note); }
  if (R) {
    L.push("", "■ 시장 한눈에 (일간 · 5일 · 1개월 · 52주 고점 대비)"); opsIdxRows(R).forEach(function (r) { var S = r.S; L.push("- " + r.name + " " + opsNum(r.last, S && S.cur) + " · " + pc(r.ret) + " · " + pc(S && S.ret5) + " · " + pc(S && S.m1, 1) + " · " + pc(S && S.vsHi, 1)); });
    try { var rec = briefState.recent.symbols, mk0 = smMk(), ms = mk0 === "all" ? OPS_MAJOR.kr.slice(0, 4).concat(OPS_MAJOR.us.slice(0, 4), OPS_MAJOR.coin.slice(0, 2)) : OPS_MAJOR[mk0] || []; var ML = ms.map(function (s) { var S = rec[s] ? nbStat(s) : null; return S ? briefName({ sym: s, name: rec[s].meta && rec[s].meta.shortName }) + " " + pc(S.ret1) + " (1개월 " + pc(S.m1, 1) + ")" : null; }).filter(Boolean); if (ML.length) L.push("", "■ 주요 종목: " + ML.join(" · ")); } catch (e) {}
    var t = R.temp; if (t && isFinite(t.upPct)) L.push("", "■ 폭: 오른 종목 " + Math.round(t.upPct * 100) + "% (" + t.up + "/" + t.total + ") · 20일선 위 " + Math.round(t.abovePct * 100) + "% · 52주 신고가 " + (t.newHigh || []).length + " · 신저가 " + (t.newLow || []).length);
    if ((R.themes || []).length) { L.push("", "■ 업종"); R.themes.forEach(function (x) { L.push("- " + x.name + " " + pc(x.ret) + " (" + x.up + "/" + x.n + ")"); }); }
    var mw = {}; (D.movers || []).forEach(function (m) { mw[m.sym] = m.why; });
    var mv = R.movers || { up: [], down: [] }; if (mv.up.length) L.push("", "■ 급등: " + mv.up.slice(0, 5).map(function (s) { return briefName(s) + " " + pc(s.ret) + (mw[s.sym] ? " (" + mw[s.sym] + ")" : ""); }).join(" · "));
    if (mv.down.length) L.push("■ 급락: " + mv.down.slice(0, 5).map(function (s) { return briefName(s) + " " + pc(s.ret) + (mw[s.sym] ? " (" + mw[s.sym] + ")" : ""); }).join(" · "));
    if ((R.hotVol || []).length) L.push("■ 거래대금 급증: " + R.hotVol.slice(0, 5).map(function (s) { return briefName(s) + " " + s.amtX.toFixed(1) + "배"; }).join(" · "));
  }
  var iss = briefState.issues || []; if (iss.length) { L.push("", "■ 핵심 이슈"); iss.forEach(function (it, i) { var w = ISS_WHY[it.title]; L.push((i + 1) + ". " + it.title + " — " + (it.sub || "")); if (w && w.why) L.push("   왜: " + w.why + (w.so ? " / 그래서: " + w.so : "") + (w.next ? " / 볼 것: " + w.next : "") + (w.src ? " [" + w.src + "]" : "") + (w.bad && w.bad.length ? " (⚠ 숫자 확인: " + w.bad.join(", ") + ")" : "")); }); }
  try { var now = nbNow(); if (now && now.why && now.why.length) L.push("", "■ 신호: " + now.why.join(" / ")); } catch (e) {}
  if ((D.tomorrow || []).length) { L.push("", "■ 다음 거래일에 볼 것"); D.tomorrow.forEach(function (t) { L.push("- " + t.what + (t.when ? " (" + t.when + ")" : "") + (t.why ? " — " + t.why : "")); }); }
  var P = smPlanFor(smMk()), plan = P && P.data; if (plan && (plan.picks || []).length) { L.push("", "■ 오늘 편성"); plan.picks.forEach(function (p, i) { L.push((i + 1) + ". [" + (p.slot || "") + "] " + (p.title || p.hook || p.ctx) + (p.hook && p.title ? " — " + p.hook : "")); }); }
  if (plan && (plan.reports || []).length) { var qb = {}; try { rpQuestions().forEach(function (q) { qb[q.id] = q; }); } catch (e) {} L.push("■ 볼 리포트: " + plan.reports.map(function (r) { return (qb[r.id] ? qb[r.id].t : r.name || r.id) + (r.why ? " (" + r.why + ")" : ""); }).join(" · ")); }
  return L.join("\n");
}

function renderOps() {
  var box = document.getElementById("opsBody"); if (!box) return;
  if (!(typeof isOwner === "function" && isOwner())) { box.innerHTML = '<div class="dvEmpty">운영자 전용 페이지예요.</div>'; return; }
  if (!OPS.Ms && !OPS.loading) opsWarm();
  var S = opsSteps(), mk = smMk();
  var seg = '<div class="opsMkSeg" role="radiogroup" aria-label="작업할 시장">' + ["all", "kr", "us", "coin"].map(function (m) { var Dm = smFlowDone(m), n = SM_FLOW.filter(function (x) { return Dm[x.k]; }).length; return '<button role="radio" aria-checked="' + (m === mk) + '" class="' + (m === mk ? "on" : "") + '" data-ops="mk:' + m + '"><b>' + SM_MK_NM[m] + '</b><small>' + (n === SM_FLOW.length ? "완료 ✓" : n + "/" + SM_FLOW.length) + '</small></button>'; }).join("") + '</div>';
  var h = seg + '<div class="opsHead"><div><h2>' + SM_MK_NM[mk] + ' 작업실</h2><p>' + opsDayLbl() + ' · ' + (mk === "all" ? "세 시장을 합쳐서 보는 중" : SM_MK_NM[mk].replace(/^\S+\s/, "") + "만 보는 중") + ' · ' + (S.next ? '다음은 <b>' + (SM_FLOW.indexOf(S.next) + 1) + '. ' + S.next.n + '</b>' : '<b>오늘 순서를 모두 마쳤어요</b>') + '</p></div><div class="opsHeadR"><div class="opsProg" style="--p:' + S.n / S.total + '"><i></i></div><span>' + S.n + ' / ' + S.total + ' 단계</span><button class="opsLink" data-ops="copy">모닝 노트 복사</button></div></div>';
  h += '<div class="opsRail n4">' + S.html + '</div>';
  h += '<h3 class="opsBoardH">모닝 노트 <small>' + SM_MK_NM[mk] + ' 기준 · 숫자는 앱 계산, 이유·해설은 Claude</small></h3><div class="opsBoard">' + opsBoard() + '</div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-ops]"), function (b) { b.onclick = function () { opsAct(b.getAttribute("data-ops"), b); }; });
}
function opsAct(a, btn) {
  if (a === "recheck") { OPS.Ms = null; if (typeof DATA !== "undefined") { DATA.ready = null; DATA.recentPromise = null; } briefState.recent = null; briefState.result = null; briefState.issues = null; renderOps(); return; }
  if (a === "copy") { var t = opsText(); (typeof chCopy === "function" ? chCopy : function (x) { navigator.clipboard && navigator.clipboard.writeText(x); })(t, btn); return; }
  if (a.indexOf("mk:") === 0) { smSetMk(a.slice(3)); opsCompute(); if (briefState.result && typeof cardsNewsFetch === "function") cardsNewsFetch(briefState.result).catch(function () {}); renderOps(); return; }
  if (a.indexOf("mark:") === 0) { smFlowMark(a.slice(5)); renderOps(); return; }
  if (a.indexOf("go:") === 0) { var g = a.slice(3); if (g === "work") { if (typeof MK !== "undefined") { MK.tab = "work"; MK.mk = smMk(); if (smPlanFor(smMk())) MK.filt = "ai"; } return navTo("onecard"); } if (g === "report" && typeof RP !== "undefined") { RP.tab = "today"; RP.cur = null; } return navTo(g); }
  if (a.indexOf("make:") === 0) { if (typeof MK !== "undefined") { MK.tab = "work"; MK.sel = a.slice(5); MK.mk = smMk(); if (smPlanFor(smMk())) MK.filt = "ai"; } navTo("onecard"); setTimeout(function () { var r = document.querySelector("#mkBody .wbRight"); if (r) try { r.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }, 300); return; }
  if (a.indexOf("report:") === 0) { var id = a.slice(7), q = (typeof rpQuestions === "function" ? rpQuestions() : []).filter(function (z) { return z.id === id; })[0]; if (typeof RP !== "undefined") { RP.tab = "today"; RP.cur = null; } navTo("report"); if (q) setTimeout(function () { if (typeof rpGo === "function") rpGo({ id: q.id, kind: q.kind, sym: q.sym || null, arg: q.arg || null }); }, 250); return; }
  if (a === "raw" || a === "rawerr") { var A = a === "raw" ? opsBrAi() : null, txt = A ? A.raw : (SM_DAILY.last && SM_DAILY.last.raw) || ""; var box = document.createElement("div"); box.innerHTML = '<div class="briefDim" style="margin-bottom:8px">' + (A ? 'Claude 원문 (앞 6,000자) · 멈춘 이유 ' + opsEsc(A.stop || "-") + (A.usage ? ' · 출력 토큰 ' + (A.usage.output_tokens || "-") : '') : '실패한 호출의 원문 — ' + opsEsc(SM_DAILY.last && SM_DAILY.last.msg || "")) + '</div><textarea class="thrText" rows="18" readonly style="width:100%"></textarea>'; box.querySelector("textarea").value = txt || "(원문 없음)"; if (typeof infoModal !== "undefined") infoModal.open("Claude 원문", box); else alert(txt.slice(0, 2000)); return; }
  if (a === "daily") { if (!briefState.result || (typeof SM_DAILY !== "undefined" && SM_DAILY.busy)) return; renderOps(); var b = document.querySelector('#opsBody [data-ops="daily"]'); smDailyRun(b).then(function () { if (currentTab === "ops") renderOps(); }); return; }
}
