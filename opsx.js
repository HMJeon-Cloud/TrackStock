/* ============================================================ v16.40 작업실 첫 화면 — 5~10분 안에 오늘을 파악하고 바로 작업
   위에서 아래로 읽는 순서가 곧 아침 순서다.
     오늘 할 일   4단계(데이터 확인 → 오늘 브리핑 → 만들기 → 업로드 · 검수) · 지금 할 일과 그 버튼 · 그 밖에 할 일
     데이터 현황  오늘 숫자를 믿어도 되나 — 문제부터, 정상은 한 줄로
     오늘 시장    브리핑 1번과 같은 결론 · 평소보다 크게 움직인 자산 · 해설 3줄 · 핵심 이슈 5
     일정         오늘 · 7일 · Claude가 본 다음 거래일
     오늘 올릴 것 편성 순서와 상태(만듦 · 올림) · 볼 리포트 · 발행과 기록
     자세히       예전 4단계 카드 · 모닝 노트 전체 · 달력 — 지우지 않고 옮겨서 거기 붙은 기능(원문 보기 · 2차 대조 · 고지문 설정 등)이 그대로 동작
   새 계산은 없다. 작업실(ops.js)과 각 모듈이 만든 값(OPS.Ms · dxRows · PRO.verify · KRX · briefState · BR_AI · 편성 · cxlEvents · fuNotices)을 다시 놓을 뿐이고,
   값이 없거나 실패하면 지어내지 않고 그 사실을 적는다.
   ============================================================ */
var OX = { more: null, extLoading: false };
try { OX.more = localStorage.getItem("sm.ox.more") || ""; } catch (e) { OX.more = ""; }
function oxE(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function oxOwner() { return typeof isOwner === "function" && isOwner(); }
function oxDay() { return typeof smKstDay === "function" ? smKstDay() : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function oxHM(ms) { return ms ? new Date(ms + 9 * 3600e3).toISOString().slice(11, 16) : ""; }
function oxMD(d) { if (!d) return "-"; var p = String(d).slice(0, 10).split("-"); return (+p[1]) + "/" + (+p[2]) + " (" + "일월화수목금토".charAt(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()) + ")"; }
function oxStrip(h) { return String(h == null ? "" : h).replace(/<small>/g, " · ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
var OX_IC = {
  ok: '<path d="M6.5 12.5l3.6 3.6 7.4-8.1"/>', warn: '<path d="M12 7.2v6.1"/><path d="M12 16.9h.01"/>', bad: '<path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4"/>',
  wait: '<path d="M7.5 12h9"/>', go: '<path d="M9.5 6.5l5.5 5.5-5.5 5.5"/>', up: '<path d="M6.5 14.5l5.5-5.5 5.5 5.5"/>', down: '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>'
};
function oxIc(k, sz) { return '<svg class="oxIc" viewBox="0 0 24 24" width="' + (sz || 16) + '" height="' + (sz || 16) + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (OX_IC[k] || "") + '</svg>'; }
function oxSt(lv, txt) { return '<span class="oxSt ' + (lv || "mute") + '">' + (lv === "ok" || lv === "bad" || lv === "warn" ? oxIc(lv, 13) : "") + oxE(txt) + '</span>'; }
function oxHd(id, title, sub, right) { return '<header class="oxPh"><h3 id="oxh-' + id + '">' + title + (sub ? '<small>' + sub + '</small>' : "") + '</h3>' + (right ? '<div class="oxPhR">' + right + '</div>' : "") + '</header>'; }

/* ---------- 상태 모으기 ---------- */
function oxMk() { return typeof smMk === "function" ? smMk() : "all"; }
function oxPostLoad() { try { var j = JSON.parse(localStorage.getItem("sm.ox.post") || "null"); return j && j.d === oxDay() ? j.f || {} : {}; } catch (e) { return {}; } }
function oxPostSet(ctx, on) { var f = oxPostLoad(); if (on) f[ctx] = Date.now(); else delete f[ctx]; try { localStorage.setItem("sm.ox.post", JSON.stringify({ d: oxDay(), f: f })); } catch (e) {} return f; }
function oxPlan(mk) {
  var P = typeof smPlanFor === "function" ? smPlanFor(mk) : null, plan = P ? P.data : null, picks = [];
  if (plan && typeof mkAiList === "function" && typeof mkTopicsScored === "function") { try { picks = mkAiList(mkTopicsScored()); } catch (e) { picks = []; } }
  var made = typeof smDoneFor === "function" ? smDoneFor(mk) : [], byCtx = {}; made.forEach(function (d) { byCtx[d.ctx] = d; });
  var Q = []; try { Q = typeof rpQuestions === "function" ? rpQuestions() : []; } catch (e) {} var qb = {}; Q.forEach(function (q) { qb[q.id] = q; });
  var reps = []; try { reps = typeof opsReps === "function" ? opsReps(plan, qb) : []; } catch (e) {}
  var post = oxPostLoad(), inPlan = {}; picks.forEach(function (x) { inPlan[x.ctx] = 1; });
  return { P: P, plan: plan, picks: picks, made: made, byCtx: byCtx, reps: reps, post: post, extra: made.filter(function (d) { return !inPlan[d.ctx] && !/^note:/.test(d.ctx); }), madeN: picks.filter(function (x) { return byCtx[x.ctx]; }).length, postN: made.filter(function (d) { return post[d.ctx]; }).length };
}
function oxWhy(x) { var m = String(x.why || "").match(/^\[(.+?)\]\s*(?:“(.+?)”\s*·\s*)?(.*)$/); return m ? { slot: m[1], hook: m[2] || "", why: m[3] || "" } : { slot: "", hook: "", why: x.why || "" }; }
/* 데이터 현황 줄: 데이터 센터의 상태표(dxRows)를 그대로 쓰되, 작업실에서 판단에 필요한 것만 */
function oxDataRows() {
  var Ms = typeof OPS !== "undefined" ? OPS.Ms : null; if (!Ms) return null;
  var mk = oxMk(), rows = [], ext = typeof DH !== "undefined" && !!DH.ext, cfg = typeof DATA !== "undefined" && DATA.config;
  var src = []; try { src = typeof dxRows === "function" ? dxRows(Ms, (typeof briefState !== "undefined" && briefState.recent) || null) : []; } catch (e) { src = []; }
  if (!src.length) Ms.forEach(function (M) { src.push({ g: "시세", n: { kr: "국내", us: "미국", coin: "코인" }[M.mk] + " 시세", last: M.date ? oxMD(M.date) : "-", lv: M.err ? "bad" : M.level === "ok" ? "ok" : "warn", why: M.err ? "계산 실패" : M.level === "ok" ? "정상" : "확인 필요", fix: "snap" }); });
  src.forEach(function (r) {
    if (r.g === "손으로") return;
    if (/종목 지표/.test(r.n)) return;
    if ((r.g === "경제 지표" || r.g === "공시 · 기관") && !ext) return;
    if (/과거 30년/.test(r.n) && !(cfg && cfg.symbols)) return;
    if (r.g === "시세" && mk !== "all") { var rm = /국내|코스피/.test(r.n) ? "kr" : /미국|S&P/.test(r.n) ? "us" : /코인/.test(r.n) ? "coin" : ""; if (rm && rm !== mk) return; }
    var nm = r.n.replace(/\s*\(.*\)$/, "").replace(/^국내 급등락 · 외국인\/기관 수급$/, "국내 마감 자료 (네이버)"), last = oxStrip(r.last).replace(/^-$/, "").replace(/ · -$/, ""), why = r.why || "";
    if (r.fix === "kr" && /작업실/.test(why)) why = "급등락 · 외국인/기관 수급을 카드에 쓰려면 받기";
    rows.push({ n: nm, lv: r.lv || "", why: why, last: last, fix: r.fix || "", g: r.g, num: r.g === "시세" });
  });
  var V = typeof PRO !== "undefined" ? PRO.verify : null;
  rows.splice(Math.min(rows.length, Ms.length + 2), 0, { num: true, n: "종가 2차 대조 (네이버)", lv: !V ? "" : V.bad ? "bad" : V.na === V.items.length ? "warn" : "ok", why: !V ? "아직 대조 전" : V.bad ? "종가 불일치 " + V.bad + "건 — 오늘 숫자 보류 권장" : V.na === V.items.length ? "네이버 응답이 없어 확인 불가" : "정상", last: V ? oxHM(V.at) + " 대조" + (V.na ? " · 확인 불가 " + V.na + "건" : "") : "", fix: "verify", g: "시세" });
  return { rows: rows, ext: ext };
}
function oxDataSum(D) {
  if (!D) return { lv: "", n: 0, txt: "확인 중" };
  var bad = D.rows.filter(function (r) { return r.lv === "bad"; }), warn = D.rows.filter(function (r) { return r.lv === "warn"; });
  return { lv: bad.length ? "bad" : warn.length ? "warn" : "ok", n: bad.length + warn.length, bad: bad, warn: warn, txt: bad.length + warn.length ? "확인 " + (bad.length + warn.length) + "곳" : "모두 정상" };
}
/* 그 밖에 할 일 — 4단계 밖에서 손이 가야 하는 것 */
function oxChores() {
  var L = [];
  try { if (typeof fuNotices === "function") fuNotices().filter(function (n) { return n.kind === "due"; }).forEach(function (n) { L.push({ k: "실적 팔로업", t: (typeof fuNm === "function" ? fuNm(n.s) : n.s) + " — 발표가 지나 새 분기를 받아와야 해요", b: '<button type="button" class="oxBtn sm" data-funt="' + oxE(n.s) + '">열기</button>' }); }); } catch (e) {}
  try { if (typeof dxRows === "function" && typeof OPS !== "undefined" && OPS.Ms) dxRows(OPS.Ms, briefState.recent).filter(function (r) { return r.g === "손으로" && /경제 일정/.test(r.n) && r.lv === "warn"; }).forEach(function (r) { L.push({ k: "경제 일정", t: r.why + " (CPI · 고용 · 실적 등 직접 넣는 일정)", b: '<button type="button" class="oxBtn sm" data-ox="go:data">데이터 센터</button>' }); }); } catch (e) {}
  try { if (typeof dxKeyState === "function" && typeof DATA !== "undefined" && DATA.config && DATA.config.keys) { var K = dxKeyState(), hot = K.filter(function (k) { return k.lv === "bad" || (k.lv === "warn" && k.left != null); }), chk = K.filter(function (k) { return k.lv === "warn" && k.left == null; });
    hot.forEach(function (k) { L.push({ k: "연동 키", t: k.name + " — " + k.badge, b: '<button type="button" class="oxBtn sm" data-ox="go:data">데이터 센터</button>', lv: k.lv }); });
    if (chk.length) L.push({ k: "연동 키 점검", t: chk.length + "개 — " + chk.slice(0, 3).map(function (k) { return k.name; }).join(", ") + (chk.length > 3 ? " 외" : "") + " (만료일 · 점검일을 적어 두면 미리 알려 줘요)", b: '<button type="button" class="oxBtn sm" data-ox="go:data">적기</button>', low: 1 }); } } catch (e) {}
  return L;
}

/* ---------- ① 오늘 할 일 ---------- */
function oxTodoHtml() {
  var mk = oxMk(), D = smFlowDone(mk), next = SM_FLOW.filter(function (s) { return !D[s.k]; })[0], A = typeof opsBrAi === "function" ? opsBrAi() : null, PL = oxPlan(mk), DS = oxDataSum(oxDataRows());
  var busy = typeof SM_DAILY !== "undefined" && SM_DAILY.busy, fail = typeof SM_DAILY !== "undefined" && SM_DAILY.last && !A ? SM_DAILY.last : null, dlx = null; try { dlx = typeof dlxLoad === "function" ? dlxLoad() : null; } catch (e) {}
  var sub = {
    data: !(typeof OPS !== "undefined" && OPS.Ms) ? ["", "확인 중…"] : D.data ? [DS.n ? "warn" : "ok", "확인함" + (DS.n ? " · 주의 " + DS.n : "")] : [DS.lv, DS.txt],
    brief: busy ? ["now", "만드는 중…"] : A ? ["ok", "완료 " + oxHM(A.at)] : fail ? ["bad", "실패 " + oxHM(fail.at)] : dlx ? ["", "프롬프트 복사함 " + oxHM(dlx.at)] : ["", "아직"],
    make: PL.plan ? [PL.madeN && PL.madeN >= PL.picks.length ? "ok" : PL.madeN ? "now" : "", "만듦 " + PL.madeN + " / " + PL.picks.length] : PL.made.length ? ["ok", "만듦 " + PL.made.length] : ["", "편성 전"],
    pub: D.pub ? ["ok", "올림 ✓"] : PL.made.length ? ["", "올림 " + PL.postN + " / " + PL.made.length] : ["", "만든 카드 없음"]
  };
  var n = SM_FLOW.filter(function (s) { return D[s.k]; }).length;
  var steps = '<ol class="oxSteps">' + SM_FLOW.map(function (s, i) {
    var st = D[s.k] ? "done" : next && next.k === s.k ? "now" : "wait", sb = sub[s.k] || ["", ""];
    if (st === "done" && s.k === "make" && PL.plan && PL.madeN < PL.picks.length) st = "part";   // 한 장이라도 만들면 다음 단계로 넘어가지만, 편성이 남았으면 덜 끝난 것으로 보인다
    return '<li><button type="button" class="oxStep ' + st + '" data-ox="step:' + s.k + '"' + (st === "now" ? ' aria-current="step"' : "") + '><i>' + (st === "done" || st === "part" ? oxIc("ok", 15) : i + 1) + '</i><b>' + oxE(s.n) + '</b><small class="' + (sb[0] || "") + '">' + oxE(sb[1]) + '</small></button></li>';
  }).join("") + '</ol>';
  /* 지금 할 일 */
  var h, t, tn = 0, acts = "", meta = "";
  if (!next) { t = "오늘 순서를 모두 마쳤어요"; h = "수고했어요. 내일 아침 7시 수집이 끝나면 데이터 확인부터 다시 시작해요. 올린 글의 저장 · 도달은 하루 뒤에 '오늘 올릴 것'의 성과 칸에 적어 두면 다음 편성에 반영돼요."; acts = '<button type="button" class="oxBtn" data-ox="jump:up">성과 적기</button>'; }
  else if (next.k === "data") {
    t = "데이터 확인"; tn = 1;
    h = !(typeof OPS !== "undefined" && OPS.Ms) ? "시세 상태를 확인하는 중이에요." : DS.n ? "확인할 곳이 " + DS.n + "곳 있어요. 아래 '데이터 현황'에서 이유를 보고, 써도 되는 숫자면 '확인했어요'로 넘어가세요. 늦은 시장의 숫자는 카드에 쓰지 않는 게 안전해요." : "데이터가 모두 정상이에요. '확인했어요'를 누르고 오늘 브리핑으로 넘어가세요.";
    acts = '<button type="button" class="oxBtn pri" data-ox="mark:data">확인했어요</button><button type="button" class="oxBtn" data-ox="jump:data">데이터 현황 보기</button><button type="button" class="oxBtn" data-ox="recheck">다시 확인</button>';
  } else if (next.k === "brief") {
    t = "오늘 브리핑"; tn = 2;
    h = busy ? "Claude가 기사 · 이슈를 읽고 해설 · 편성 · 리포트를 만드는 중이에요(1~3분). 끝나면 이 화면이 저절로 바뀌어요." : "프롬프트를 복사해 claude.ai에 붙여넣고 답을 가져오면 해설 3줄 · 이슈 이유 · 급등락 이유 · 내일 볼 것 · 카드 편성 · 리포트 선정이 한 번에 채워져요.";
    var job = typeof smJobPending === "function" && smJobPending("daily");
    acts = busy ? '<button type="button" class="oxBtn" disabled>만드는 중…</button>' : '<button type="button" class="oxBtn pri" data-ox="dlx">직접 질문 (claude.ai)</button><button type="button" class="oxBtn" data-ox="daily" title="서버 API로 자동 생성 — Claude 크레딧을 써요">' + (job ? "진행 중인 작업 이어서 받기" : "자동 (API)") + '</button>';
    if (fail) meta = '<span class="oxBadTxt">마지막 시도 실패 ' + oxHM(fail.at) + ' — ' + oxE(String(fail.msg || "").split("\n")[0].slice(0, 120)) + '</span>';
    else if (dlx) meta = "오늘 " + oxHM(dlx.at) + " 프롬프트 복사함 — 답을 받았으면 '직접 질문'에서 붙여넣어 적용하세요";
    else if (!(typeof briefState !== "undefined" && briefState.result)) meta = "시장 숫자를 준비하는 중이라 잠시 뒤에 누를 수 있어요";
  } else if (next.k === "make") {
    t = "만들기"; tn = 3;
    var nx = PL.picks.filter(function (x) { return !PL.byCtx[x.ctx]; })[0];
    if (nx) { var w = oxWhy(nx); h = "편성 순서대로 만들어요. 다음 카드는 '" + cPlain(nx.t) + "'" + (w.slot ? " (" + w.slot + ")" : "") + "이에요."; acts = '<button type="button" class="oxBtn pri" data-ox="make:' + oxE(nx.ctx) + '">이 카드 만들기</button><button type="button" class="oxBtn" data-ox="go:work">카드 작업대</button>' + (PL.reps.length ? '<button type="button" class="oxBtn" data-ox="jump:up">볼 리포트 ' + PL.reps.length + '</button>' : ""); }
    else if (PL.plan) { h = "편성한 카드를 모두 만들었어요. 리포트 · 분석이 남았다면 이어서 하고, 아니면 업로드로 넘어가요."; acts = '<button type="button" class="oxBtn pri" data-ox="jump:up">올릴 것 보기</button><button type="button" class="oxBtn" data-ox="go:report">리포트</button><button type="button" class="oxBtn" data-ox="go:analyst">분석</button>'; }
    else { h = "편성이 없어요. 카드 작업대의 '오늘 카드'에서 직접 고르거나, 2단계 '오늘 브리핑'을 만들면 Claude가 순서를 정해 줘요."; acts = '<button type="button" class="oxBtn pri" data-ox="go:work">카드 작업대</button><button type="button" class="oxBtn" data-ox="dlx">브리핑 만들기 (claude.ai)</button>'; }
  } else {
    t = "업로드 · 검수"; tn = 4;
    h = "만든 카드마다 업로드 글(AI 문구) → 발행 전 검수 → 올리기. 올린 카드는 아래 '오늘 올릴 것'에서 체크하고, 다 올렸으면 '올렸어요'를 누르세요.";
    acts = '<button type="button" class="oxBtn pri" data-ox="jump:up">올릴 것 보기</button><button type="button" class="oxBtn" data-ox="tg:bundle">모닝 노트 발행 묶음 ZIP</button><button type="button" class="oxBtn" data-ox="mark:pub"' + (PL.made.length ? "" : " disabled") + '>올렸어요</button>';
    var left = PL.picks.filter(function (x) { return !PL.byCtx[x.ctx]; });
    if (left.length) { meta = "편성 카드 중 " + left.length + "개를 아직 안 만들었어요 — 더 만들 거면 '" + oxE(cPlain(left[0].t)) + "'부터"; acts += '<button type="button" class="oxBtn" data-ox="make:' + oxE(left[0].ctx) + '">다음 카드 만들기</button>'; }
  }
  var now = '<div class="oxNow"><span class="oxNowK">' + (next ? "지금 할 일" : "오늘 끝") + '</span><h3>' + (tn ? '<i>' + tn + '단계</i>' : "") + oxE(t) + '</h3><p>' + oxE(h) + '</p><div class="oxActs">' + acts + '</div>' + (meta ? '<p class="oxMeta">' + meta + '</p>' : "") + '</div>';
  /* 그 밖에 할 일 */
  var C = oxChores(), urgent = C.filter(function (c) { return !c.low; }).length;
  var aside = '<aside class="oxChores"><h4>그 밖에 할 일 <b class="' + (urgent ? "on" : "") + '">' + C.length + '</b></h4>' + (C.length ? '<ul>' + C.map(function (c) { return '<li class="' + (c.low ? "low" : "") + '"><span class="k">' + oxE(c.k) + '</span><p>' + oxE(c.t) + '</p>' + (c.b || "") + '</li>'; }).join("") + '</ul>' : '<p class="oxEmpty">없어요. 실적 발표 · 경제 일정 · 연동 키에 손댈 일이 생기면 여기에 올라와요.</p>') + '</aside>';
  return '<section class="oxTodo" id="ox-todo" aria-labelledby="oxh-todo">' + oxHd("todo", "오늘 할 일", n + " / " + SM_FLOW.length + " 단계", "") + '<div class="oxTodoG"><div class="oxTodoIn"><div class="oxTodoL">' + steps + now + '</div>' + aside + '</div></div></section>';
}

/* ---------- ② 데이터 현황 ---------- */
var OX_FIX = { snap: "아침 수집", "uni-us": "S&P 500 요약 받기", "uni-kr": "코스피 200 요약 받기", macro: "매크로 수집", dart: "공시 수집", sec: "13F 수집", ipo: "공모주 수집" };
function oxDataHtml() {
  var Dr = oxDataRows(), S = oxDataSum(Dr), h;
  if (!Dr) h = '<p class="oxEmpty">시세 상태를 확인하는 중이에요…</p>';
  else {
    var row = function (r) {
      var lv = r.lv || "mute", btn = "";
      if (r.fix === "kr") btn = '<button type="button" class="oxBtn sm" data-ox="krx">' + (/안 받음|못 받음/.test(r.last + r.why) ? "받기" : "다시 받기") + '</button>';
      else if (r.fix === "verify") btn = '<button type="button" class="oxBtn sm" data-ox="verify">' + (r.lv ? "다시 대조" : "대조하기") + '</button>';
      var detail = r.lv === "ok" ? r.last : (r.why && r.why !== "정상" ? r.why : "") + (r.last ? (r.why && r.why !== "정상" ? " · " : "") + r.last : "");
      var fixTxt = r.lv && r.lv !== "ok" && OX_FIX[r.fix] ? '<em>해결: 데이터 센터 › ' + OX_FIX[r.fix] + '</em>' : "";
      return '<li class="' + lv + '"><span class="oxDi" title="' + (r.lv === "ok" ? "정상" : r.lv === "bad" ? "문제" : r.lv === "warn" ? "확인 필요" : "참고") + '">' + oxIc(r.lv === "ok" ? "ok" : r.lv === "bad" ? "bad" : r.lv === "warn" ? "warn" : "wait", 13) + '</span><div><b>' + oxE(r.n) + '</b><small>' + oxE(detail) + '</small>' + fixTxt + '</div>' + btn + '</li>';
    };
    var probs = Dr.rows.filter(function (r) { return r.lv === "bad" || r.lv === "warn"; }), neutral = Dr.rows.filter(function (r) { return !r.lv; }), ok = Dr.rows.filter(function (r) { return r.lv === "ok"; });
    var badNum = (S.bad || []).filter(function (r) { return r.num; }), warnNum = (S.warn || []).filter(function (r) { return r.num; });
    var verdict = badNum.length ? ["bad", "쓰면 안 되는 숫자가 있어요 — " + badNum[0].n + ": " + badNum[0].why] : S.bad && S.bad.length ? ["bad", "고칠 곳이 있어요 — " + S.bad[0].n + ": " + S.bad[0].why + (warnNum.length ? " · 시세 확인 " + warnNum.length + "곳" : "")] : warnNum.length ? ["warn", "시세 확인할 곳 " + warnNum.length + "곳 — 늦거나 숨긴 시장의 숫자는 카드에 쓰기 전에 확인하세요"] : S.n ? ["warn", "숫자는 정상이고, 손볼 곳이 " + S.n + "곳 있어요"] : ["ok", "모두 정상이에요 — 오늘 숫자를 그대로 써도 돼요"];
    h = '<p class="oxVerdict ' + verdict[0] + '">' + oxE(verdict[1]) + '</p>' +
      (probs.length + neutral.length ? '<ul class="oxDl">' + probs.concat(neutral).map(row).join("") + '</ul>' : "") +
      (ok.length ? '<details class="oxOkD"><summary>' + oxIc("ok", 13) + '정상 ' + ok.length + ' <span>' + oxE(ok.map(function (r) { return r.n; }).join(", ")) + '</span></summary><ul class="oxDl">' + ok.map(row).join("") + '</ul></details>' : "") +
      (!Dr.ext ? '<p class="oxNote">공시 · 매크로 · 13F · 공모주 상태를 불러오는 중이에요.</p>' : "");
    var ex = typeof dxExpected === "function" ? "있어야 할 마지막 장: 국내 " + oxMD(dxExpected("kr")) + " · 미국 " + oxMD(dxExpected("us")) : "";
    h += '<p class="oxNote">' + oxE(ex) + (typeof dxNextCron === "function" ? (ex ? " · " : "") + "다음 자동 수집 " + dxNextCron() : "") + '</p>';
  }
  var right = oxSt(S.lv, S.txt);
  return '<section class="oxP" id="ox-data" aria-labelledby="oxh-data">' + oxHd("data", "데이터 현황", "오늘 숫자를 믿어도 되나", right) + h +
    '<div class="oxActs foot"><button type="button" class="oxBtn" data-ox="recheck">다시 확인</button><button type="button" class="oxBtn" data-ox="go:data">데이터 센터</button></div></section>';
}

/* ---------- ③ 오늘 시장 ---------- */
var OX_ASSETS = [["^KS11", "코스피"], ["^KQ11", "코스닥"], ["^GSPC", "S&P500"], ["^IXIC", "나스닥"], ["^VIX", "공포지수"], ["KRW=X", "달러/원"], ["TLT", "미국 장기채"], ["GLD", "금"], ["USO", "원유"], ["BTC-USD", "비트코인"]];
function oxMktHtml() {
  var R = typeof briefState !== "undefined" ? briefState.result : null, h;
  var go = '<button type="button" class="oxLink" data-ox="go:brief">브리핑에서 자세히' + oxIc("go", 14) + '</button>';
  if (!R || typeof bxVerdict !== "function") return '<section class="oxP" id="ox-mkt" aria-labelledby="oxh-mkt">' + oxHd("mkt", "오늘 시장", "", go) + '<p class="oxEmpty">' + (typeof OPS !== "undefined" && OPS.err ? "시장 숫자를 불러오지 못했어요 — " + oxE(OPS.err) : "시장 숫자를 준비하는 중이에요…") + '</p></section>';
  var V = bxVerdict(R), mode = typeof bxMode === "function" ? bxMode() : "day", lab = mode === "week" ? "한 주" : mode === "month" ? "한 달" : "하루";
  var asOf = []; try { (OPS.Ms || []).forEach(function (M) { if (M.mk !== "coin" && M.date && (oxMk() === "all" || oxMk() === M.mk)) asOf.push({ kr: "국내", us: "미국" }[M.mk] + " " + oxMD(M.date)); }); } catch (e) {}
  h = '<p class="oxHead">' + V.head + '</p>';
  if (V.off) h += '<p class="oxWarnBox"><b>시장 전체 숫자를 숨겼어요.</b> ' + oxE(V.offWhy || "전체 시장 요약이 아직 준비되지 않았어요") + ' — 지수와 자산 숫자만 믿을 수 있는 값이에요.</p>';
  h += '<div class="oxJ">' + V.tiles.map(function (k) { return '<div class="oxJt' + (k.txt ? " txt" : "") + '"><span>' + oxE(k.l) + '</span><b class="' + (k.c === "bxU" ? "oxU" : k.c === "bxD" ? "oxD" : "") + '">' + oxE(k.v) + '</b><em>' + oxE(k.w) + '</em></div>'; }).join("") + '</div>';
  /* 자산: 평소 대비 몇 배 움직였나 */
  var rows = OX_ASSETS.map(function (p) { var s = bxStat(p[0]); if (!s) return null; return { sym: p[0], n: p[1], s: s, r: bxRet(s), z: bxZ(s) }; }).filter(Boolean);
  if (rows.length) {
    var hot = rows.filter(function (o) { return o.z != null && o.z >= 1.5; }).sort(function (a, b) { return b.z - a.z; });
    h += '<div class="oxSub"><b>평소 대비</b><span>' + (hot.length ? "크게 움직인 것 " + hot.length + "개 — " + hot.slice(0, 3).map(function (o) { return oxE(o.n) + ' <em class="' + (o.r > 0 ? "oxU" : o.r < 0 ? "oxD" : "") + '">' + bxPct(o.r) + '</em>'; }).join(" · ") : "모두 평소 " + lab + " 변동폭의 1.5배 안이에요") + '</span></div>';
    h += '<div class="oxAs">' + rows.map(function (o) {
      var pr = o.sym === "^VIX" ? o.s.last.toFixed(1) : typeof cPrice === "function" ? cPrice(o.sym, o.s.last) : String(o.s.last);
      return '<button type="button" class="oxA' + (o.z != null && o.z >= 2.5 ? " hi" : o.z != null && o.z >= 1.5 ? " mid" : "") + '" data-shsym="' + oxE(o.sym) + '"><span class="n">' + oxE(o.n) + '</span><span class="p">' + oxE(pr) + '</span><span class="c ' + (o.r > 0.00005 ? "oxU" : o.r < -0.00005 ? "oxD" : "") + '">' + bxPct(o.r) + '</span><span class="z">' + bxGauge(o.z) + '</span></button>';
    }).join("") + '</div>';
  }
  /* 해설 3줄: Claude가 있으면 Claude, 없으면 숫자에서 읽은 것 */
  var A = typeof opsBrAi === "function" ? opsBrAi() : null, story = A && A.data && (A.data.story || []).filter(Boolean);
  if (story && story.length) h += '<div class="oxRead"><div class="oxSub"><b>Claude 해설</b><span>' + oxHM(A.at) + (A.searches ? " · 웹 검색 " + A.searches + "회" : "") + '</span></div><ol>' + story.map(function (l, k) { var bad = A.chk && A.chk.story && A.chk.story[k]; return '<li>' + oxE(l) + (bad && bad.length && typeof smNumWarn === "function" ? " " + smNumWarn(bad) : "") + '</li>'; }).join("") + '</ol></div>';
  else if (V.lines.length) h += '<div class="oxRead"><div class="oxSub"><b>숫자에서 읽은 것</b><span>앱 계산 · Claude 해설은 2단계 브리핑 뒤에</span></div><ol>' + V.lines.map(function (l) { return '<li>' + oxE(l) + '</li>'; }).join("") + '</ol></div>';
  /* 핵심 이슈 */
  var iss = briefState.issues || [];
  if (iss.length) {
    h += '<div class="oxIss"><div class="oxSub"><b>핵심 이슈 ' + iss.length + '</b><span>평소와 가장 달랐던 것</span></div><ol>' + iss.map(function (it, i) {
      var sc = (typeof BX_SCOPE !== "undefined" && BX_SCOPE[it.cat]) || ["기타", ""], w = typeof ISS_WHY !== "undefined" ? ISS_WHY[it.title] : null;
      var sub = w && w.why ? w.why : String(it.sub || "").replace(/\s*·\s*평소 (하루|한 주|한 달) 변동의 [0-9.]+배/, "").replace(/^평소 (하루|한 주|한 달) 변동의 [0-9.]+배$/, "");
      return '<li><button type="button" data-ox="iss:' + i + '"><span class="tg s' + (sc[2] || 9) + '">' + oxE(sc[0]) + '</span><b>' + oxE(it.title) + '</b>' + (sub ? '<small' + (w && w.why ? ' class="ai"' : "") + '>' + oxE(sub) + '</small>' : "") + '</button></li>';
    }).join("") + '</ol></div>';
  } else h += '<p class="oxNote">' + (V.off ? "시장 전체 숫자를 쓸 수 없는 날이라 이슈를 고르지 않았어요." : "오늘은 고를 만한 이슈가 없어요.") + '</p>';
  var right = '<span class="oxAsOf">' + oxE(asOf.join(" · ") + (asOf.length ? " 종가" : "")) + '</span>' + go;
  return '<section class="oxP" id="ox-mkt" aria-labelledby="oxh-mkt">' + oxHd("mkt", "오늘 시장", lab + " 기준", right) + h + '</section>';
}

/* ---------- ④ 일정 ---------- */
/* 공모주 청약 — 공모주 화면과 같은 자료(DART 증권신고서 · /api/snap?ipo=1). 청약 기간이 7일 창에 걸치면 넣고, 이미 시작했으면 '오늘'에 */
function oxIpoEv(today, end) {
  var doc = (typeof IPO !== "undefined" && IPO.doc) || (typeof DH !== "undefined" && DH.ext && DH.ext.ipo) || null, out = [];
  var iso = function (v) { v = String(v || ""); return v.length >= 8 ? v.slice(0, 4) + "-" + v.slice(4, 6) + "-" + v.slice(6, 8) : ""; }, md = function (d) { return (+d.slice(5, 7)) + "/" + (+d.slice(8, 10)); };
  ((doc && doc.items) || []).forEach(function (x) {
    if (!x || x.stage === "drop" || !x.sbd || !x.sbd.length || (x.ret && x.ret.listDate) || !x.name) return;
    var s = iso(x.sbd[0]), e = iso(x.sbd[1] || x.sbd[0]); if (!s || !e || e < today || s > end) return;
    var pr = x.price || x.offer, lead = x.lead || (x.uw && x.uw[0] && x.uw[0].n) || "";
    out.push({ d: s < today ? today : s, t: x.name + " 공모주 청약" + (e === today ? " 마감" : s === today ? " 시작" : s < today ? " 중" : ""), n: "청약 " + md(s) + (e !== s ? "~" + md(e) : "") + (pr != null && isFinite(pr) && +pr > 0 ? " · 공모가 " + Math.round(+pr).toLocaleString("ko-KR") + "원" : "") + (lead ? " · " + lead : ""), kind: "ipo", ipo: 1 });
  });
  return out;
}
function oxEvHtml() {
  var h = "", today = typeof cxlToday === "function" ? cxlToday() : oxDay(), EV = [];
  try { if (typeof cxlEvents === "function" && typeof cxlAdd === "function") { var end = cxlAdd(today, 7); EV = cxlEvents().filter(function (e) { return e.d >= today && e.d <= end; }); try { EV = EV.concat(oxIpoEv(today, end)).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }); } catch (x) {} } } catch (e) { EV = []; }
  var td = EV.filter(function (e) { return e.d === today; }), rest = EV.filter(function (e) { return e.d > today; });
  var row = function (e, day) {
    var K = typeof bxKind === "function" ? bxKind(e.kind) : ["일정", "#7a8494"], note = e.n || ""; try { if (!note && e.kind !== "hol" && typeof pubEvNote === "function") note = pubEvNote(e) || ""; } catch (x) {}
    var tm = (note.match(/(\d{1,2}:\d{2})/) || [])[1] || "", tt = typeof bxClean === "function" ? bxClean(e.t) : e.t;
    if (e.ipo) K = ["공모", "#c2578f"];
    return '<li' + (e.sym ? ' data-ox="fu:' + oxE(e.sym) + '" class="lk"' : e.ipo ? ' data-ox="go:ipo" class="lk"' : "") + '><time>' + (day ? oxE(oxMD(e.d)) : tm ? '<b>' + tm + '</b>' : "종일") + '</time><div><span class="oxK" style="--c:' + K[1] + '">' + K[0] + '</span><b>' + oxE(tt) + (e.est ? ' <small class="est">예상</small>' : "") + '</b>' + (note ? '<p>' + oxE(note) + '</p>' : "") + '</div></li>';
  };
  h += '<div class="oxEvG today"><div class="oxSub"><b>오늘 ' + oxE(oxMD(today)) + '</b></div>' + (td.length ? '<ul class="oxEl">' + td.map(function (e) { return row(e, false); }).join("") + '</ul>' : '<p class="oxEmpty sm">오늘 등록된 일정이 없어요.</p>') + '</div>';
  h += '<div class="oxEvG"><div class="oxSub"><b>7일 안</b><span>' + (rest.length ? rest.length + "건" : "") + '</span></div>' + (rest.length ? '<ul class="oxEl">' + rest.slice(0, 7).map(function (e) { return row(e, true); }).join("") + '</ul>' + (rest.length > 7 ? '<p class="oxNote">외 ' + (rest.length - 7) + '건은 달력에서</p>' : "") : '<p class="oxEmpty sm">앞으로 7일 동안 등록된 일정이 없어요.</p>') + '</div>';
  var A = typeof opsBrAi === "function" ? opsBrAi() : null, tm = A && A.data && A.data.tomorrow || [];
  if (tm.length) h += '<div class="oxEvG"><div class="oxSub"><b>Claude가 본 다음 거래일</b><span>' + oxHM(A.at) + '</span></div><ul class="oxEl ai">' + tm.slice(0, 4).map(function (t) { return '<li><time>' + (t.when ? oxE(t.when) : "") + '</time><div><b>' + oxE(t.what) + '</b>' + (t.why ? '<p>' + oxE(t.why) + '</p>' : "") + '</div></li>'; }).join("") + '</ul></div>';
  var right = oxSt(td.length ? "now" : "", "오늘 " + td.length + " · 7일 " + rest.length);
  return '<section class="oxP" id="ox-ev" aria-labelledby="oxh-ev">' + oxHd("ev", "일정", "오늘부터 7일 · 한국 시간", right) + h + '<div class="oxActs foot"><button type="button" class="oxBtn" data-ox="more:cal">달력 전체</button></div></section>';
}

/* ---------- ⑤ 오늘 올릴 것 ---------- */
function oxUpHtml() {
  var mk = oxMk(), PL = oxPlan(mk), D = smFlowDone(mk), L = "", R = "";
  var stLabel = function (d, post) { return post ? '<span class="oxSt ok">' + oxIc("ok", 13) + '올림 ' + oxHM(post) + '</span>' : d ? '<span class="oxSt mid">' + oxIc("ok", 13) + '만듦 ' + oxHM(d.at) + '</span>' : ""; };
  var postBox = function (ctx, d) { return '<label class="oxChk' + (d ? "" : " off") + '"><input type="checkbox" data-oxpost="' + oxE(ctx) + '"' + (PL.post[ctx] ? " checked" : "") + (d ? "" : " disabled") + '><span>올림</span></label>'; };
  if (PL.plan) {
    if (PL.plan.summary) L += '<p class="oxLead">' + oxE(PL.plan.summary) + '</p>';
    var nextCtx = (PL.picks.filter(function (x) { return !PL.byCtx[x.ctx]; })[0] || {}).ctx;
    L += PL.picks.length ? '<ol class="oxPk">' + PL.picks.map(function (x, i) {
      var w = oxWhy(x), d = PL.byCtx[x.ctx], post = PL.post[x.ctx], cls = post ? "posted" : d ? "made" : x.ctx === nextCtx ? "next" : "";
      return '<li class="' + cls + '"><span class="no">' + (i + 1) + '</span><div class="t">' + (w.slot ? '<em>' + oxE(w.slot) + '</em>' : "") + '<b>' + oxE(cPlain(x.t)) + '</b>' + (w.hook || w.why ? '<small>' + (w.hook ? "“" + oxE(w.hook) + "”" + (w.why ? " · " : "") : "") + oxE(w.why) + '</small>' : "") + '</div><div class="s">' + (stLabel(d, post) || (x.ctx === nextCtx ? '<span class="oxSt now">' + oxIc("go", 13) + '다음</span>' : '<span class="oxSt mute">대기</span>')) + '</div><div class="a"><button type="button" class="oxBtn sm' + (x.ctx === nextCtx ? " pri" : "") + '" data-ox="make:' + oxE(x.ctx) + '">' + (d ? "열기" : "만들기") + '</button>' + postBox(x.ctx, d) + '</div></li>';
    }).join("") + '</ol>' : '<p class="oxEmpty">편성은 있는데 카드 주제와 맞는 것을 찾지 못했어요 — 카드 작업대의 편성 칸에서 확인하세요.</p>';
  } else {
    L += '<p class="oxEmpty">아직 편성이 없어요. 2단계 \'오늘 브리핑\'을 만들면 Claude가 오늘 올릴 카드와 순서를 정해 줘요. 그 전에 카드 작업대의 \'오늘 카드\'에서 직접 골라 만들 수도 있어요.</p><div class="oxActs"><button type="button" class="oxBtn" data-ox="go:work">카드 작업대</button></div>';
  }
  if (PL.extra.length) L += '<div class="oxSub"><b>편성 밖에서 만든 것</b><span>' + PL.extra.length + '개</span></div><ul class="oxPk ex">' + PL.extra.slice().reverse().map(function (d) { var post = PL.post[d.ctx]; return '<li class="' + (post ? "posted" : "made") + '"><span class="no">·</span><div class="t"><b>' + oxE(cPlain(d.t || d.ctx)) + '</b></div><div class="s">' + stLabel(d, post) + '</div><div class="a"><button type="button" class="oxBtn sm" data-ox="make:' + oxE(d.ctx) + '">열기</button>' + postBox(d.ctx, d) + '</div></li>'; }).join("") + '</ul>';
  if (PL.reps.length) L += '<div class="oxSub"><b>볼 리포트</b><span>' + PL.reps.length + '개 · 오늘 편성</span></div><ul class="oxRp">' + PL.reps.map(function (r) { return '<li><button type="button" data-ox="report:' + oxE(r.id) + '"><b>' + oxE(r.t) + '</b>' + (r.why ? '<small>' + oxE(r.why) + '</small>' : "") + oxIc("go", 15) + '</button></li>'; }).join("") + '</ul>';
  /* 발행 · 기록 */
  var noteMade = PL.made.filter(function (d) { return /^note:/.test(d.ctx); })[0];
  R += '<div class="oxTool"><h4>모닝 노트<small>오늘 숫자 · 해설을 카드 묶음과 글로' + (noteMade ? " · " + oxHM(noteMade.at) + " 만듦" : "") + '</small></h4><div class="oxActs"><button type="button" class="oxBtn" data-ox="note">카드 발행</button><button type="button" class="oxBtn" data-ox="tg:bundle">발행 묶음 ZIP</button><button type="button" class="oxBtn" data-ox="tg:copy">텔레그램 글 복사</button><button type="button" class="oxLink" data-ox="tg:prev">글 미리보기</button></div></div>';
  R += '<div class="oxTool"><h4>업로드 글<small>캡션 · 스레드 본문 · 답글</small></h4><div class="oxActs"><button type="button" class="oxBtn" data-ox="go:channel">채널에서 쓰기</button><button type="button" class="oxBtn" data-ox="copy">모닝 노트 글 복사</button><button type="button" class="oxLink" data-ox="tgcfg">고지문 · 서명 설정</button></div></div>';
  R += '<div class="oxTool"><h4>마무리</h4>' + (D.pub ? '<p class="oxDone">' + oxIc("ok", 15) + '오늘 올림 표시 완료</p>' : '<div class="oxActs"><button type="button" class="oxBtn' + (PL.made.length && PL.postN >= PL.made.length ? " pri" : "") + '" data-ox="mark:pub"' + (PL.made.length ? "" : " disabled") + '>다 올렸어요</button></div><p class="oxNote">' + (PL.made.length ? "올린 카드 " + PL.postN + " / " + PL.made.length + " — 모두 체크하면 자동으로 끝냄 표시돼요" : "만든 카드가 생기면 누를 수 있어요") + '</p>') + '</div>';
  var perf = ""; try { perf = typeof proPerfHtml === "function" ? proPerfHtml(PL.made.filter(function (d) { return !/^note:/.test(d.ctx); })) : ""; } catch (e) {}
  if (perf) R += '<div class="oxTool oxPerf">' + perf + '</div>';
  var right = oxSt(PL.made.length && PL.postN >= PL.made.length && PL.made.length ? "ok" : PL.plan ? "now" : "", (PL.plan ? "카드 " + PL.picks.length + " · " : "") + "만듦 " + PL.made.length + " · 올림 " + PL.postN);
  var meta = PL.P ? "Claude 편성 " + oxHM(PL.P.at) : "편성 전";
  return '<section class="oxP oxUp" id="ox-up" aria-labelledby="oxh-up">' + oxHd("up", "오늘 올릴 것", meta, right) + '<div class="oxUpG"><div class="oxUpIn"><div class="oxUpL">' + L + '</div><div class="oxUpR">' + R + '</div></div></div></section>';
}

/* ---------- 전체 ---------- */
var OX_PANELS = { todo: oxTodoHtml, data: oxDataHtml, mkt: oxMktHtml, ev: oxEvHtml, up: oxUpHtml };
function oxTopHtml() {
  var mk = oxMk(), now = new Date(Date.now() + 9 * 3600e3);
  var seg = '<div class="oxSeg" role="radiogroup" aria-label="작업할 시장">' + ["all", "kr", "us", "coin"].map(function (m) { var Dm = smFlowDone(m), n = SM_FLOW.filter(function (x) { return Dm[x.k]; }).length; return '<button type="button" role="radio" aria-checked="' + (m === mk) + '" class="' + (m === mk ? "on" : "") + '" data-ox="mk:' + m + '"><b>' + { all: "전체", kr: "국내", us: "미국", coin: "코인" }[m] + '</b><small>' + (n === SM_FLOW.length ? "끝" : n + "/" + SM_FLOW.length) + '</small></button>'; }).join("") + '</div>';
  return '<header class="oxTop"><div class="oxTitle"><h2>' + (now.getUTCMonth() + 1) + '월 ' + now.getUTCDate() + '일 ' + "일월화수목금토".charAt(now.getUTCDay()) + '요일</h2><p>오늘의 작업실 · ' + now.toISOString().slice(11, 16) + ' 기준' + (typeof dxNextCron === "function" ? " · 다음 자동 수집 " + dxNextCron() : "") + '</p></div><div class="oxTopR">' + seg + '</div></header>';
}
function oxMoreHtml() {
  var T = [["steps", "단계별 도구", "Claude 원문 · 2차 대조 상세 · 마감 자료 · 발행 준비"], ["note", "모닝 노트 전체", "지수 · 업종 · 급등락 · 매크로 표"], ["cal", "일정 달력", "한 달 달력 · 다가오는 일정"]];
  return '<section class="oxMore" id="ox-more"><div class="oxMoreBar" role="tablist" aria-label="자세히"><span>자세히</span>' + T.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (OX.more === t[0]) + '" class="' + (OX.more === t[0] ? "on" : "") + '" data-ox="more:' + t[0] + '"><b>' + t[1] + '</b><small>' + t[2] + '</small></button>'; }).join("") + '</div>' + T.map(function (t) { return '<div class="oxMoreP" data-oxpane="' + t[0] + '"' + (OX.more === t[0] ? "" : " hidden") + '></div>'; }).join("") + '</section>';
}
function oxHtml() {
  return oxTopHtml() + oxTodoHtml() + '<div class="oxGrid"><div class="oxGridIn"><div class="oxCol a">' + oxDataHtml() + oxEvHtml() + '</div><div class="oxCol b">' + oxMktHtml() + '</div></div></div>' + oxUpHtml() + oxMoreHtml();
}
/* 예전 작업실 칸을 '자세히' 아래로 옮긴다(지우지 않음) */
function oxAdopt(box, root) {
  var kids = Array.prototype.slice.call(box.children).filter(function (k) { return k !== root; }), pane = function (id) { return root.querySelector('[data-oxpane="' + id + '"]'); };
  kids.forEach(function (k) {
    var c = k.classList;
    if (c.contains("opsMkSeg") || c.contains("opsHead") || c.contains("fuNtOps")) { k.remove(); return; }   // 시장 고르기 · 제목 · 실적 안내는 새 화면이 대신한다
    if (c.contains("cxlBox")) { pane("cal").appendChild(k); return; }
    if (c.contains("opsBoardH") || c.contains("opsBoard")) { pane("note").appendChild(k); return; }
    pane("steps").appendChild(k);   // 4단계 카드 · 2차 대조 상자 · 그 밖에 붙은 것
  });
}
function oxPaint(id) {
  var el = document.getElementById("ox-" + id), f = OX_PANELS[id]; if (!el || !f) return;
  var tmp = document.createElement("div"); try { tmp.innerHTML = f(); } catch (e) { console.warn("ox paint", id, e); return; }
  var n = tmp.firstElementChild; if (n) el.parentNode.replaceChild(n, el);
}
function oxEnsureExt() {
  if (typeof DH === "undefined" || DH.ext || OX.extLoading || typeof dhLoadExt !== "function") return;
  OX.extLoading = true;
  dhLoadExt().then(function () { OX.extLoading = false; oxPaint("data"); oxPaint("todo"); oxPaint("ev"); }).catch(function () { OX.extLoading = false; });
}
function oxRender() {
  var box = document.getElementById("opsBody"); if (!box || !oxOwner()) return;
  if (!box.querySelector(":scope > .opsRail")) return;
  var html = oxHtml();   // 여기서 실패하면 예전 화면을 그대로 둔다
  var old = document.getElementById("oxRoot"); if (old) old.remove();
  var root = document.createElement("div"); root.id = "oxRoot"; root.setAttribute("data-own-head", "1"); root.innerHTML = html;
  box.insertBefore(root, box.firstChild);
  oxAdopt(box, root);
  oxEnsureExt();
}
function oxSmooth() { try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; } catch (e) { return "auto"; } }
function oxJump(id) { var el = document.getElementById("ox-" + id); if (el) try { el.scrollIntoView({ behavior: oxSmooth(), block: "start" }); } catch (e) { el.scrollIntoView(); } }
function oxMore(id, keep) {
  OX.more = OX.more === id && !keep ? "" : id; try { localStorage.setItem("sm.ox.more", OX.more); } catch (e) {}
  var root = document.getElementById("ox-more"); if (!root) return;
  Array.prototype.forEach.call(root.querySelectorAll("[data-oxpane]"), function (p) { p.hidden = p.getAttribute("data-oxpane") !== OX.more; });
  Array.prototype.forEach.call(root.querySelectorAll(".oxMoreBar button"), function (b) { var on = b.getAttribute("data-ox") === "more:" + OX.more; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  if (OX.more) setTimeout(function () { try { root.scrollIntoView({ behavior: oxSmooth(), block: "start" }); } catch (e) {} }, 30);
}
/* 예전 칸(자세히 안)에 있는 진짜 버튼을 누른다 — 같은 기능을 두 벌 만들지 않으려고 */
function oxPress(sel, btn, busyTxt) {
  var b = document.querySelector("#ox-more " + sel);
  if (!b) { if (typeof smToast === "function") smToast("이 기능을 찾지 못했어요 — '자세히 › 단계별 도구'에서 해 주세요", "bad"); return false; }
  if (btn && busyTxt) { btn.disabled = true; btn.textContent = busyTxt; }
  b.click(); return true;
}
function oxAct(a, btn) {
  if (a.indexOf("mk:") === 0 || a === "recheck" || a.indexOf("mark:") === 0 || a.indexOf("report:") === 0 || a.indexOf("make:") === 0) return opsAct(a, btn);
  if (a === "copy") return opsAct("copy", btn);
  if (a.indexOf("go:") === 0) { var g = a.slice(3); if (g === "brief" || g === "channel" || g === "ipo") return typeof shGo === "function" ? shGo(g) : navTo(g); if (g === "data") return navTo("data"); return opsAct(a, btn); }
  if (a.indexOf("jump:") === 0) return oxJump(a.slice(5));
  if (a.indexOf("more:") === 0) return oxMore(a.slice(5));
  if (a.indexOf("step:") === 0) { var k = a.slice(5); return oxJump(k === "data" ? "data" : k === "brief" ? (typeof opsBrAi === "function" && opsBrAi() ? "mkt" : "todo") : "up"); }
  if (a === "dlx") { if (typeof dlxOpen === "function") return dlxOpen(); return oxPress('[data-dlx]', btn); }
  if (a === "daily") { if (typeof smDailyRun !== "function" || !(typeof briefState !== "undefined" && briefState.result) || (typeof SM_DAILY !== "undefined" && SM_DAILY.busy)) return; var p = smDailyRun(null); renderOps(); return p.then(function () { if (currentTab === "ops") renderOps(); }); }
  if (a === "krx") { if (typeof krxLoad !== "function") return; if (btn) { btn.disabled = true; btn.textContent = "받는 중…"; } return krxLoad(true).then(function (j) { if (typeof smToast === "function") smToast("국내 마감 자료 " + (j.miss && j.miss.length ? "일부만 받았어요 — " + j.miss.join(" / ") : "받았어요")); }).catch(function (e) { if (typeof smToast === "function") smToast("마감 자료를 받지 못했어요 — " + e.message, "bad"); }).then(function () { if (currentTab === "ops") renderOps(); }); }
  if (a === "verify") { if (typeof smVerifyRun !== "function") return; if (btn) { btn.disabled = true; btn.textContent = "대조 중…"; } return smVerifyRun(true).then(function (j) { if (!j && typeof smToast === "function") smToast("2차 대조를 하지 못했어요 — 네이버 응답이 없거나 앱 종가가 아직 없어요", "bad"); oxPaint("data"); }); }
  if (a === "note") { if (typeof proNotePublish === "function") return proNotePublish(btn); return oxPress("[data-note]", btn); }
  if (a.indexOf("tg:") === 0) { var t = a.slice(3); return oxPress('.tgPanel [data-tg="' + t + '"]', btn, t === "bundle" ? "카드 그리는 중…" : ""); }
  if (a === "tgcfg") { oxMore("steps", true); setTimeout(function () { var d = document.querySelector("#ox-more .tgCfg"); if (d) { d.open = true; try { d.scrollIntoView({ behavior: oxSmooth(), block: "center" }); } catch (e) {} } }, 80); return; }
  if (a.indexOf("iss:") === 0) { var i = +a.slice(4); if (typeof shGo === "function") shGo("brief"); else navTo("brief"); setTimeout(function () { var L = document.querySelectorAll("#bxIss .bxI"), it = (briefState.issues || [])[i], tgt = null; Array.prototype.forEach.call(L, function (el) { if (!tgt && it && el.querySelector("h4") && el.querySelector("h4").textContent.indexOf(it.title) >= 0) tgt = el; }); tgt = tgt || document.getElementById("bx-iss"); if (tgt) try { tgt.scrollIntoView({ behavior: oxSmooth(), block: "start" }); } catch (e) {} }, 700); return; }
  if (a.indexOf("fu:") === 0) { if (typeof FU !== "undefined") FU.sel = a.slice(3); if (typeof switchTab === "function") switchTab("follow"); return; }
}
(function () {
  if (typeof renderOps !== "function") return;
  try { if (typeof clOps === "function") clOps = function () {}; } catch (e) {}   // 예전 '오늘 할 일 / 모닝 노트' 탭 묶기는 새 화면이 대신한다
  var r0 = renderOps; renderOps = function () { var r = r0.apply(this, arguments); try { oxRender(); } catch (e) { console.warn("ox", e); } return r; };
  if (typeof proVerifyPaint === "function") { var v0 = proVerifyPaint; proVerifyPaint = function () { var r = v0.apply(this, arguments); try { oxPaint("data"); } catch (e) {} return r; }; }
  document.addEventListener("click", function (e) {
    var root = document.getElementById("oxRoot"), t = e.target; if (!root || !t || !t.closest || !root.contains(t)) return;
    var fb = t.closest("[data-funt]"); if (fb && root.contains(fb) && !fb.closest("#ox-more")) { e.preventDefault(); if (typeof FU !== "undefined") FU.sel = fb.getAttribute("data-funt"); if (typeof switchTab === "function") switchTab("follow"); return; }
    var b = t.closest("[data-ox]"); if (!b || !root.contains(b) || b.closest("#ox-more .oxMoreP")) return;
    if (b.disabled) return; e.preventDefault(); try { oxAct(b.getAttribute("data-ox"), b); } catch (er) { console.warn("ox act", er); }
  });
  document.addEventListener("change", function (e) {
    var t = e.target, root = document.getElementById("oxRoot"); if (!root || !t || !root.contains(t) || t.closest("#ox-more")) return;
    if (t.hasAttribute("data-oxpost")) {
      var ctx = t.getAttribute("data-oxpost"), f = oxPostSet(ctx, t.checked), mk = oxMk(), made = typeof smDoneFor === "function" ? smDoneFor(mk).filter(function (d) { return !/^note:/.test(d.ctx); }) : [];
      if (t.checked && made.length && made.every(function (d) { return f[d.ctx]; }) && typeof smFlowMark === "function") smFlowMark("pub");
      if (typeof renderOps === "function") renderOps(); return;
    }
    if (t.hasAttribute("data-perf") && typeof proPerfSave === "function") proPerfSave(t.getAttribute("data-ctx"), t.getAttribute("data-perf"), t.value);
  });
  try { if (typeof SM_FLOW !== "undefined") SM_FLOW.forEach(function (f) {   // 다른 화면 위쪽 순서 바의 안내도 새 작업실 이름으로
    if (f.k === "data") f.hint = "작업실 '데이터 현황'에서 늦은 시장 · 2차 대조를 보고 '확인했어요'";
    if (f.k === "brief") f.hint = "작업실 '지금 할 일'의 직접 질문 — 프롬프트 복사 → claude.ai → 답 붙여넣기. 급하면 자동(API)";
    if (f.k === "pub") f.hint = "작업실 '오늘 올릴 것'에서 발행 묶음 ZIP · 텔레그램 글 복사 → 직접 올리고 '올림' 체크";
  }); } catch (e) {}
  try { if (typeof SH !== "undefined" && SH.pages && SH.pages.ops) { SH.pages.ops.d = "오늘 데이터 · 시장 · 일정 · 올릴 것을 한 화면에"; SH.sig = ""; } } catch (e) {}
  try { if (typeof ADM !== "undefined" && ADM.head) ADM.head.ops = ["오늘의 작업실", "오늘 데이터 · 시장 · 일정 · 올릴 것을 한 화면에"]; } catch (e) {}
  try { if (typeof SM_GUIDE !== "undefined") SM_GUIDE.ops = { t: "작업실", s: ["맨 위 '오늘 할 일'의 '지금 할 일' 버튼부터 누르면 순서대로 끝나요.", "데이터 현황에 확인할 곳이 있으면 그 시장의 숫자는 카드에 쓰기 전에 확인해요.", "오늘 올릴 것에서 편성 순서대로 만들고, 올린 카드는 '올림'에 체크해요.", "예전 4단계 카드 · 모닝 노트 전체 표 · 달력은 맨 아래 '자세히'에 있어요."] }; } catch (e) {}

  var css = [
    "#oxRoot{display:grid;gap:14px;margin:0 0 18px;min-width:0}",
    "#oxRoot .oxU{color:var(--up)}#oxRoot .oxD{color:var(--down)}",
    /* 머리 */
    ".oxTop{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;justify-content:space-between}.oxTitle{min-width:0}.oxTitle h2{margin:0;font-size:24px;font-weight:800;letter-spacing:-.03em;color:var(--txt);line-height:1.25}.oxTitle p{margin:4px 0 0;font-size:13px;color:var(--sub)}",
    ".oxSeg{display:inline-flex;background:var(--card2);border-radius:11px;padding:3px;gap:2px}.oxSeg button{border:0;background:none;border-radius:9px;padding:6px 12px;font:inherit;cursor:pointer;display:flex;align-items:baseline;gap:6px;color:var(--sub);white-space:nowrap}.oxSeg b{font-size:13.5px;font-weight:700}.oxSeg small{font-size:11.5px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}.oxSeg button.on{background:#fff;color:var(--txt);box-shadow:0 1px 3px rgba(20,22,28,.12)}.oxSeg button.on small{color:var(--goldInk)}",
    /* 패널 */
    ".oxP,.oxTodo{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:18px 20px;min-width:0}",
    ".oxPh{display:flex;align-items:center;gap:10px;margin:0 0 12px;min-width:0;flex-wrap:wrap}.oxPh h3{margin:0;font-size:17px;font-weight:780;letter-spacing:-.02em;color:var(--txt);display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0}.oxPh h3 small{font-size:13px;font-weight:500;color:var(--sub)}.oxPhR{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
    ".oxSt{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap;line-height:1.5}.oxSt:has(.oxIc){padding-left:7px}.oxSt.ok{color:var(--good);background:#e9f5ee}.oxSt.warn{color:var(--warn);background:#fcf1e3}.oxSt.bad{color:var(--bad);background:#fbebeb}.oxSt.now{color:var(--goldInk);background:var(--goldSoft)}.oxSt.mid{color:var(--txt2);background:var(--card2)}.oxSt.mute{color:var(--sub);background:var(--soft)}",
    ".oxBtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--txt);font:inherit;font-size:13.5px;font-weight:650;cursor:pointer;white-space:nowrap}.oxBtn:hover{background:var(--soft)}.oxBtn.pri{background:var(--ink);border-color:var(--ink);color:#fff}.oxBtn.pri:hover{background:#2a2e38}.oxBtn:disabled{opacity:.45;cursor:default}.oxBtn:focus-visible,.oxLink:focus-visible,.oxStep:focus-visible,.oxA:focus-visible,.oxIss button:focus-visible,.oxRp button:focus-visible,.oxSeg button:focus-visible,.oxMoreBar button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}.oxBtn.sm{height:30px;padding:0 11px;font-size:12.5px;border-radius:8px}",
    ".oxLink{display:inline-flex;align-items:center;gap:3px;border:0;background:none;padding:4px 2px;font:inherit;font-size:13px;font-weight:650;color:var(--goldInk);cursor:pointer;white-space:nowrap}.oxLink:hover{text-decoration:underline;text-underline-offset:3px}",
    ".oxActs{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.oxActs.foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--line2)}",
    ".oxEmpty{margin:0;font-size:13.5px;line-height:1.6;color:var(--sub);background:var(--soft);border-radius:10px;padding:12px 14px}.oxEmpty.sm{padding:9px 12px;font-size:13px}.oxNote{margin:10px 0 0;font-size:12.5px;line-height:1.55;color:var(--muted)}.oxLead{margin:0 0 10px;font-size:14px;line-height:1.6;color:var(--txt2)}",
    ".oxSub{display:flex;align-items:baseline;gap:8px;margin:16px 0 8px;flex-wrap:wrap}.oxSub b{font-size:13.5px;font-weight:750;color:var(--txt)}.oxSub span{font-size:12.5px;color:var(--sub)}.oxSub em{font-style:normal;font-weight:700}",
    /* 오늘 할 일 */
    ".oxTodoG{container-type:inline-size}.oxTodoIn{display:grid;gap:16px}.oxTodoL{min-width:0}",
    "@container (min-width:860px){.oxTodoIn{grid-template-columns:minmax(0,1fr) 290px}.oxChores{border-left:1px solid var(--line2);padding-left:18px}}",
    ".oxSteps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}",
    ".oxStep{width:100%;height:100%;display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:8px;row-gap:2px;align-items:center;text-align:left;border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 12px;font:inherit;cursor:pointer;color:var(--txt)}.oxStep:hover{background:var(--soft)}",
    ".oxStep i{grid-row:1/3;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:800;border:1.5px solid var(--line);color:var(--sub);background:#fff}.oxStep b{font-size:14px;font-weight:750;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:clip}.oxStep small{font-size:12px;font-weight:600;color:var(--sub);line-height:1.4}",
    ".oxStep small.ok{color:var(--good)}.oxStep small.warn{color:var(--warn)}.oxStep small.bad{color:var(--bad)}.oxStep small.now{color:var(--goldInk)}",
    ".oxStep.done i{background:var(--good);border-color:var(--good);color:#fff}.oxStep.done b{color:var(--txt2)}",
    ".oxStep.now{border-color:var(--gold);background:var(--goldSoft);box-shadow:inset 0 0 0 1px var(--gold)}.oxStep.now i{background:var(--ink);border-color:var(--ink);color:#fff}",
    ".oxStep.wait b{color:var(--sub)}.oxStep.part i{background:#fff;border-color:var(--good);color:var(--good)}",
    ".oxNow{margin-top:12px;border-radius:12px;background:#fcf8ee;border:1px solid var(--goldLine);border-left:4px solid var(--gold);padding:14px 16px}.oxNowK{display:block;font-size:12px;font-weight:750;color:var(--goldInk);margin-bottom:2px}.oxNow h3{margin:0 0 4px;font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--txt);display:flex;align-items:center;gap:8px}.oxNow h3 i{font-style:normal;font-size:12px;font-weight:800;color:#fff;background:var(--ink);border-radius:6px;padding:2px 7px;letter-spacing:0}.oxNow p{margin:0 0 12px;font-size:14px;line-height:1.6;color:var(--txt2)}.oxNow .oxMeta{margin:10px 0 0;font-size:12.5px;color:var(--sub)}.oxBadTxt{color:var(--bad);font-weight:650}",
    ".oxChores h4{margin:0 0 8px;font-size:14px;font-weight:750;color:var(--txt);display:flex;align-items:center;gap:6px}.oxChores h4 b{font-size:12px;font-weight:800;min-width:20px;height:20px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:var(--card2);color:var(--sub);padding:0 6px}.oxChores h4 b.on{background:var(--warn);color:#fff}",
    ".oxChores ul{list-style:none;margin:0;padding:0;display:grid}.oxChores li{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:2px;align-items:center;padding:9px 0;border-top:1px solid var(--line2)}.oxChores li:first-child{border-top:0;padding-top:2px}.oxChores li .k{grid-column:1;font-size:12px;font-weight:750;color:var(--warn)}.oxChores li.low .k{color:var(--sub)}.oxChores li p{grid-column:1;margin:0;font-size:13px;line-height:1.5;color:var(--txt2)}.oxChores li .oxBtn{grid-column:2;grid-row:1/3}.oxChores .oxEmpty{font-size:12.5px}",
    /* 파악 칸 */
    ".oxGrid{container-type:inline-size}.oxGridIn{display:flex;flex-direction:column;gap:14px}.oxCol{display:contents}#ox-data{order:1}#ox-mkt{order:2}#ox-ev{order:3}",
    "@container (min-width:900px){.oxGridIn{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:start}.oxCol{display:flex;flex-direction:column;gap:14px;min-width:0}}",
    /* 데이터 현황 */
    ".oxVerdict{margin:0 0 10px;font-size:14px;font-weight:650;line-height:1.55;border-radius:10px;padding:10px 12px}.oxVerdict.ok{color:var(--good);background:#eef7f1}.oxVerdict.warn{color:#8f4a0c;background:#fcf3e6}.oxVerdict.bad{color:var(--bad);background:#fbecec}",
    ".oxDl{list-style:none;margin:0;padding:0;display:grid}.oxDl li{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line2)}.oxDl li:first-child{border-top:0}.oxDl li div{min-width:0}.oxDl b{display:block;font-size:13.5px;font-weight:700;color:var(--txt)}.oxDl small{display:block;font-size:12.5px;line-height:1.5;color:var(--sub)}.oxDl em{display:block;font-style:normal;font-size:12px;font-weight:650;color:var(--goldInk);margin-top:1px}",
    ".oxDi{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--soft);color:var(--sub)}.oxDl li.ok .oxDi{background:#e9f5ee;color:var(--good)}.oxDl li.warn .oxDi{background:#fcf1e3;color:var(--warn)}.oxDl li.bad .oxDi{background:#fbebeb;color:var(--bad)}.oxDl li.warn small{color:#8f4a0c}.oxDl li.bad small{color:var(--bad)}",
    ".oxOkD{margin-top:6px;border-top:1px solid var(--line2);padding-top:8px}.oxOkD summary{cursor:pointer;list-style:none;display:flex;align-items:baseline;gap:6px;font-size:13px;font-weight:700;color:var(--good);min-width:0;white-space:nowrap}.oxOkD summary .oxIc{align-self:center;flex:none}.oxOkD summary::-webkit-details-marker{display:none}.oxOkD summary span{font-weight:500;color:var(--sub);min-width:0;line-height:1.5;white-space:normal}.oxOkD[open] summary span{display:none}.oxOkD .oxDl{margin-top:4px}",
    /* 오늘 시장 */
    ".oxAsOf{font-size:12.5px;color:var(--sub);white-space:nowrap}",
    ".oxHead{margin:0 0 12px;font-size:21px;font-weight:800;letter-spacing:-.03em;line-height:1.4;color:var(--txt)}.oxHead em{font-style:normal;color:var(--goldInk)}.oxHead em.bxU{color:var(--up)}.oxHead em.bxD{color:var(--down)}",
    ".oxWarnBox{margin:0 0 12px;font-size:13px;line-height:1.55;color:#8f4a0c;background:#fcf3e6;border-radius:10px;padding:9px 12px}",
    ".oxJ{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}.oxJt{background:var(--soft);border-radius:10px;padding:9px 11px;min-width:0}.oxJt span{display:block;font-size:12px;font-weight:650;color:var(--sub)}.oxJt b{display:block;font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--txt);font-variant-numeric:tabular-nums;line-height:1.3;white-space:nowrap}.oxJt.txt b{font-size:15px;white-space:normal}.oxJt em{display:block;font-style:normal;font-size:12.5px;font-weight:650;color:var(--txt2)}",
    ".oxAs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));column-gap:24px}",
    ".oxA{display:grid;grid-template-columns:minmax(78px,1fr) auto 64px 84px;gap:8px;align-items:center;width:100%;border:0;border-bottom:1px solid var(--line2);background:none;padding:7px 4px;font:inherit;font-size:13.5px;color:var(--txt);text-align:right;cursor:pointer;font-variant-numeric:tabular-nums}.oxA:hover{background:var(--soft)}.oxA .n{text-align:left;font-weight:650;white-space:nowrap}.oxA .p{color:var(--txt2);white-space:nowrap}.oxA .c{font-weight:750;white-space:nowrap}.oxA .z{display:flex;justify-content:flex-end}.oxA .bxG i{width:30px}.oxA .bxG b{min-width:32px}.oxA.mid{background:#fcf8ee}.oxA.hi{background:var(--goldSoft)}",
    ".oxRead ol{margin:0;padding:0;list-style:none;counter-reset:oxr;display:grid;gap:6px}.oxRead li{counter-increment:oxr;position:relative;padding-left:24px;font-size:14px;line-height:1.6;color:var(--txt2)}.oxRead li::before{content:counter(oxr);position:absolute;left:0;top:3px;width:17px;height:17px;border-radius:50%;background:var(--goldSoft);color:var(--goldInk);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}",
    ".oxIss ol{margin:0;padding:0;list-style:none;display:grid}.oxIss li button{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:8px;row-gap:2px;align-items:baseline;width:100%;border:0;border-top:1px solid var(--line2);background:none;padding:9px 4px;font:inherit;text-align:left;cursor:pointer;color:var(--txt)}.oxIss li:first-child button{border-top:0}.oxIss li button:hover{background:var(--soft)}.oxIss b{font-size:14px;font-weight:700;line-height:1.45}.oxIss small{grid-column:2;font-size:12.5px;line-height:1.5;color:var(--sub);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.oxIss small.ai{color:var(--txt2)}",
    ".oxIss .tg{font-size:11.5px;font-weight:750;color:#fff;background:var(--ink);border-radius:5px;padding:1px 7px;white-space:nowrap;line-height:1.6}.oxIss .tg.s2{background:#5b4a1c}.oxIss .tg.s3{background:#3d4452}.oxIss .tg.s4,.oxIss .tg.s5,.oxIss .tg.s9{background:#667080}",
    /* 일정 */
    ".oxEvG .oxSub{margin-top:4px}.oxEvG+.oxEvG{margin-top:14px;padding-top:12px;border-top:1px solid var(--line2)}.oxEvG+.oxEvG .oxSub{margin-top:0}",
    ".oxEl{list-style:none;margin:0;padding:0;display:grid}.oxEl li{display:grid;grid-template-columns:70px minmax(0,1fr);gap:8px;padding:7px 0}.oxEl li+li{border-top:1px solid var(--line2)}.oxEl li.lk{cursor:pointer}.oxEl li.lk:hover b{text-decoration:underline}.oxEl time{font-size:12.5px;color:var(--sub);font-variant-numeric:tabular-nums;line-height:1.55}.oxEl time b{font-size:13.5px;color:var(--txt);font-weight:750}.oxEl div{min-width:0}.oxEl div b{font-size:13.5px;font-weight:700;color:var(--txt);line-height:1.5}.oxEl p{margin:2px 0 0;font-size:12.5px;line-height:1.5;color:var(--sub);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.oxEl small.est{font-size:11px;font-weight:650;color:var(--warn)}",
    ".oxEvG.today .oxEl li{background:#fcf8ee;border-radius:8px;padding:8px 8px}.oxEl.ai time{color:var(--goldInk);font-weight:650}",
    ".oxK{display:inline-block;font-size:11px;font-weight:750;color:var(--c);border:1px solid var(--c);border-radius:5px;padding:0 5px;margin-right:6px;line-height:1.5;vertical-align:1px}",
    /* 오늘 올릴 것 */
    ".oxUpG{container-type:inline-size}.oxUpIn{display:grid;gap:18px}.oxUpL,.oxUpR{min-width:0}",
    "@container (min-width:820px){.oxUpIn{grid-template-columns:minmax(0,7fr) minmax(0,4fr)}.oxUpR{border-left:1px solid var(--line2);padding-left:18px}}",
    ".oxPk{list-style:none;margin:0;padding:0;display:grid}.oxPk li{display:grid;grid-template-columns:24px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line2)}.oxPk li:first-child{border-top:0}",
    ".oxPk .no{width:24px;height:24px;border-radius:50%;background:var(--card2);color:var(--sub);font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}.oxPk li.next .no{background:var(--ink);color:#fff}.oxPk li.made .no,.oxPk li.posted .no{background:#e9f5ee;color:var(--good)}",
    ".oxPk .t{min-width:0}.oxPk .t em{font-style:normal;font-size:11.5px;font-weight:750;color:var(--goldInk);background:var(--goldSoft);border-radius:5px;padding:1px 6px;margin-right:6px;vertical-align:1px}.oxPk .t b{font-size:14px;font-weight:700;color:var(--txt);line-height:1.45}.oxPk .t small{display:block;font-size:12.5px;line-height:1.5;color:var(--sub);margin-top:2px}.oxPk li.posted .t b{color:var(--sub)}",
    ".oxPk .a{display:flex;align-items:center;gap:8px}.oxChk{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:650;color:var(--txt2);cursor:pointer;white-space:nowrap}.oxChk input{width:16px;height:16px;accent-color:var(--good);margin:0}.oxChk.off{color:var(--muted);cursor:default}",
    ".oxRp{list-style:none;margin:0;padding:0;display:grid}.oxRp button{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;align-items:center;width:100%;border:0;border-top:1px solid var(--line2);background:none;padding:9px 4px;font:inherit;text-align:left;cursor:pointer;color:var(--txt)}.oxRp li:first-child button{border-top:0}.oxRp button:hover{background:var(--soft)}.oxRp b{font-size:13.5px;font-weight:700}.oxRp small{grid-column:1;font-size:12.5px;color:var(--sub);line-height:1.5}.oxRp .oxIc{grid-column:2;grid-row:1/3;color:var(--muted)}",
    ".oxTool+.oxTool{margin-top:14px;padding-top:14px;border-top:1px solid var(--line2)}.oxTool h4{margin:0 0 8px;font-size:14px;font-weight:750;color:var(--txt);display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.oxTool h4 small{font-size:12.5px;font-weight:500;color:var(--sub)}.oxDone{margin:0;display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:var(--good)}",
    ".oxPerf .proPerf .opsSubH{font-size:14px;font-weight:750;margin:0 0 6px}.oxPerf .proPerfRow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:5px 0;font-size:13px}.oxPerf .proPerfRow span{min-width:0;white-space:normal;line-height:1.4}.oxPerf input{width:64px;height:28px;border:1px solid var(--line);border-radius:7px;padding:0 6px;font:inherit;font-size:13px}",
    /* 자세히 */
    ".oxMore{min-width:0}.oxMoreBar{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap}.oxMoreBar>span{align-self:center;font-size:14px;font-weight:750;color:var(--sub);margin-right:4px}",
    ".oxMoreBar button{border:1px solid var(--line);background:#fff;border-radius:11px;padding:8px 14px;font:inherit;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:1px;min-width:0}.oxMoreBar button:hover{background:var(--soft)}.oxMoreBar b{font-size:13.5px;font-weight:750;color:var(--txt)}.oxMoreBar small{font-size:12px;color:var(--sub)}.oxMoreBar button.on{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}",
    ".oxMoreP{margin-top:12px}.oxMoreP>.opsRail{margin-top:0}",
    "@media(max-width:700px){.oxP,.oxTodo{padding:16px 14px}.oxTop{align-items:flex-start}.oxTitle h2{font-size:21px}.oxSeg{width:100%}.oxSeg button{flex:1;justify-content:center;padding:6px 4px}.oxSteps{grid-template-columns:repeat(2,minmax(0,1fr))}.oxHead{font-size:19px}.oxPk li{grid-template-columns:24px minmax(0,1fr) auto}.oxPk .a{grid-column:2/-1;justify-content:flex-start}.oxPk .s{grid-column:3;grid-row:1}.oxA{grid-template-columns:minmax(60px,1fr) auto 62px 72px;font-size:13px}.oxMoreBar button{flex:1 1 100%}.oxPhR{margin-left:0}.oxPh{gap:6px 10px}}",
    "@media(max-width:380px){.oxA .p{display:none}.oxA{grid-template-columns:minmax(60px,1fr) 64px 72px}}"
  ].join("");
  var st = document.createElement("style"); st.id = "oxCss"; st.textContent = css; document.head.appendChild(st);
})();
