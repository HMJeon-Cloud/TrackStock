/* ============================================================
   v12.39 Claude 연결 (운영자 전용) — 서버: /api/channel?op=claude (task: analyst · inspect · check · why · plan)
   ① 오늘 편성: 주제 후보 + 리포트 후보 + 오늘 이슈 + 기사 제목을 모아 Claude가 오늘 올릴 카드·볼 리포트를 고른다(10개 넘어도 됨) + 주간 기획
   ② 애널리스트 자동 분석: 프롬프트 → Claude 분석(웹 보완) → 검사관 재검토 → 저장 → 카드 (analyst.js)
   ③ 발행 전 검수 (threads.js 업로드 글 패널)  ④ 핵심 이슈 '왜' 한 줄 (issues.js)
   ============================================================ */
function smClaude(task, input, opt) {
  opt = opt || {};
  var tok = ""; try { tok = (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) {}
  return fetch("/api/channel?op=claude", { method: "POST", headers: { "content-type": "application/json", "x-owner": tok }, body: JSON.stringify({ task: task, input: input, json: !!opt.json, web: opt.web }) })
    .then(function (r) { return r.json().catch(function () { return { ok: false, reason: "HTTP_" + r.status, msg: r.status === 504 ? "서버 시간 초과(5분) — 범위를 줄여 다시 시도해 주세요" : "응답을 읽지 못했어요" }; }); })
    .then(function (j) { if (!j || !j.ok) { var e = new Error((j && (j.msg || j.reason)) || "응답 없음"); e.res = j; throw e; } return j; });
}
function smSrcHtml(S) { return S && S.length ? '<div class="smSrc">출처: ' + S.map(function (s) { return '<a href="' + escapeHtml(s.u) + '" target="_blank" rel="noopener">' + escapeHtml(s.t || s.u) + '</a>'; }).join(" · ") + '</div>' : ""; }
function smKstDay() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }

/* ---------- ① 오늘 편성 ---------- */
var MK_AI = (function () { try { var j = JSON.parse(localStorage.getItem("sm.aiPlan") || "null"); return j && j.day === smKstDay() ? j : null; } catch (e) { return null; } })();
function mkAiSave() { try { localStorage.setItem("sm.aiPlan", JSON.stringify(MK_AI)); } catch (e) {} }
function mkAiInput() {
  var T = typeof mkTopicsScored === "function" ? mkTopicsScored() : [], L = [];
  L.push("[주제 후보] — ctx | 묶음 | 제목 | 앱 점수(0~10) | 앱이 본 선정 이유");
  T.slice().sort(function (a, b) { return b.s - a.s; }).forEach(function (x) { L.push("- " + x.ctx + " | " + x.g + " | " + cPlain(x.t) + " | " + Math.round(x.s) + " | " + (x.why || x.d || "").slice(0, 90)); });
  var Q = typeof rpQuestions === "function" ? (function () { try { return rpQuestions(); } catch (e) { return []; } })() : [];
  if (Q.length) { L.push(""); L.push("[리포트 후보] — id | 종류 | 질문 | 왜"); Q.slice(0, 20).forEach(function (q) { L.push("- " + q.id + " | " + q.kind + " | " + q.t + " | " + (q.why || q.d || "")); }); }
  var iss = []; try { iss = (typeof chState !== "undefined" && chState.issues && chState.issues.length) ? chState.issues : (typeof issuesCompute === "function" && briefState.recent ? issuesCompute(briefState.recent, { market: briefState.market || "all", popular: briefState.popular }) : []); } catch (e) {}
  if (iss.length) { L.push(""); L.push("[오늘 이슈 — 앱 계산]"); iss.slice(0, 10).forEach(function (it) { L.push("- " + it.title + " · " + (it.sub || "")); }); }
  var news = []; try { news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).map(function (n) { return (n.title || n.t || "") + (n.press ? " (" + n.press + ")" : ""); }); } catch (e) {}
  try { if (typeof hubNewsItems === "function") hubNewsItems().forEach(function (n) { news.push(n.t + (n.it && n.it.press ? " (" + n.it.press + ")" : "")); }); } catch (e) {}
  var seen = {}; news = news.filter(function (t) { t = String(t).trim(); if (!t || seen[t]) return false; seen[t] = 1; return true; });
  if (news.length) { L.push(""); L.push("[오늘 기사 제목 — 네이버 검색]"); news.slice(0, 40).forEach(function (t) { L.push("- " + t); }); }
  var R = typeof hubR === "function" ? hubR() : null;
  if (R) { L.push(""); L.push("[시장 숫자] " + (R.indexRow || []).slice(0, 4).map(function (x) { return x.name + " " + (typeof cPct === "function" ? cPct(x.ret, 2) : x.ret); }).join(" · ") + (R.temp && isFinite(R.temp.upPct) ? " · 오른 종목 " + Math.round(R.temp.upPct * 100) + "%" : "")); }
  L.push(""); L.push("요일: " + "일월화수목금토"[new Date(Date.now() + 9 * 3600e3).getUTCDay()] + " · 선택한 시장: " + (typeof MK !== "undefined" ? MK.mk : "all"));
  return L.join("\n");
}
function mkAiRun(btn) {
  var old = btn ? btn.innerHTML : ""; if (btn) { btn.disabled = true; btn.textContent = "Claude가 기사·이슈를 모아 편성 중… (30초~2분)"; }
  var prep = typeof cardsNewsFetch === "function" && typeof hubR === "function" && hubR() ? cardsNewsFetch(hubR()).catch(function () { return []; }) : Promise.resolve();
  return Promise.resolve(prep).then(function () { return smClaude("plan", mkAiInput(), { json: true }); }).then(function (j) {
    MK_AI = { day: smKstDay(), at: Date.now(), data: j.data, sources: j.sources || [], searches: j.searches || [], used: j.used, max: j.max };
    mkAiSave(); MK.filt = "ai"; if (typeof makerRender === "function") makerRender();
  }).catch(function (e) { alert("Claude 편성 실패: " + e.message); }).then(function () { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; } });
}
function mkAiList(T) {
  if (!MK_AI || !MK_AI.data) return [];
  var by = {}; T.forEach(function (x) { by[x.ctx] = x; });
  return (MK_AI.data.picks || []).map(function (p) { var x = by[p.ctx]; return x ? Object.assign({}, x, { why: (p.slot ? "[" + p.slot + "] " : "") + (p.hook ? "“" + p.hook + "” · " : "") + (p.why || "") }) : null; }).filter(Boolean);
}
function mkAiHtml() {
  if (!MK_AI || !MK_AI.data) return '<div class="aiPlan briefDim">아직 ' + SM_MK_NM[smMk()] + ' 오늘 편성이 없어요 — <b>✨ 오늘 브리핑으로 편성</b>을 누르면 기사·이슈를 모아 오늘 올릴 카드와 볼 리포트를 골라 줘요(브리핑 해설도 같이).</div>';
  var D = MK_AI.data, Q = typeof rpQuestions === "function" ? (function () { try { return rpQuestions(); } catch (e) { return []; } })() : [], qb = {}; Q.forEach(function (q) { qb[q.id] = q; });
  var h = '<div class="aiPlan"><div class="aiPlanTop"><b>✨ 오늘 편성</b> <small class="briefDim">' + new Date(MK_AI.at + 9 * 3600e3).toISOString().slice(11, 16) + ' · 웹 검색 ' + (MK_AI.searches || []).length + '회 · 오늘 ' + MK_AI.used + '/' + MK_AI.max + '회</small></div>' + (D.summary ? '<div class="aiPlanSum">' + escapeHtml(D.summary) + '</div>' : '');
  var R = (D.reports || []).filter(function (r) { return qb[r.id]; });
  if (R.length) h += '<div class="aiPlanSub">볼 리포트</div>' + R.map(function (r) { var q = qb[r.id]; return '<div class="aiPlanRow"><span>📑 <b>' + escapeHtml(q.t) + '</b> <small>' + escapeHtml(r.why || "") + '</small></span><button class="chip" data-airp="' + escapeHtml(r.id) + '">리포트 열기</button></div>'; }).join("");
  if ((D.extra || []).length) h += '<div class="aiPlanSub">앱 주제에 없는 오늘 화제 (아이디어)</div>' + D.extra.map(function (x) { return '<div class="aiPlanRow"><span>💡 <b>' + escapeHtml(x.title || "") + '</b> <small>' + escapeHtml(x.idea || "") + (x.data ? ' · 필요한 데이터: ' + escapeHtml(x.data) : '') + '</small></span></div>'; }).join("");
  if ((D.week || []).length) h += '<details class="aiPlanWeek"><summary>이번 주 연재 기획 ' + D.week.length + '개</summary>' + D.week.map(function (w) { return '<div class="aiPlanRow"><span><b>' + escapeHtml(w.day || "") + '</b> ' + escapeHtml(w.title || "") + ' <small>' + escapeHtml(w.hook || "") + '</small></span>' + (w.ctx ? '<button class="chip" data-wsel="' + escapeHtml(w.ctx) + '">고르기</button>' : '') + '</div>'; }).join("") + '</details>';
  h += smSrcHtml(MK_AI.sources) + '<div class="aiPlanSub">올릴 카드 ' + (D.picks || []).length + '개 ↓ (누르면 오른쪽에서 만들기)</div></div>';
  return h;
}
function mkAiBind(pane) {
  var b = pane.querySelector("[data-aiplan]"); if (b) b.onclick = function () { mkAiRun(b); };
  Array.prototype.forEach.call(pane.querySelectorAll("[data-airp]"), function (x) { x.onclick = function () {
    var id = x.getAttribute("data-airp"), q = (typeof rpQuestions === "function" ? rpQuestions() : []).filter(function (z) { return z.id === id; })[0]; if (!q) return;
    if (typeof navTo === "function") navTo("report"); setTimeout(function () { if (typeof rpGo === "function") rpGo({ id: q.id, kind: q.kind, sym: q.sym || null, arg: q.arg || null }); }, 200);
  }; });
}

/* ---------- ④ 핵심 이슈 '왜' 한 줄 ---------- */
var ISS_WHY = {};
function issWhyRun(list, box, btn) {
  var news = []; try { news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).map(function (n) { return "- " + (n.title || "") + (n.press ? " (" + n.press + (n.time ? " · " + n.time : "") + ")" : "") + (n.desc ? " — " + String(n.desc).slice(0, 140) : "") + (n.url ? " " + n.url : ""); }); } catch (e) {}
  var input = "[핵심 이슈]\n" + list.map(function (it, i) { return (i + 1) + ". " + it.title + " · " + (it.sub || "") + (it.sym ? " (" + it.sym + ")" : ""); }).join("\n") + "\n\n[후보 기사 — 앱이 네이버에서 모은 것]\n" + (news.length ? news.slice(0, 30).join("\n") : "(없음 — 필요하면 웹 검색)");
  var old = btn.innerHTML; btn.disabled = true; btn.textContent = "이유 찾는 중… (20초~1분)";
  smClaude("why", input, { json: true }).then(function (j) {
    (j.data.items || []).forEach(function (x) { var it = list[(+x.i || 0) - 1]; if (it && x.why) ISS_WHY[it.title] = { why: x.why, so: x.so || "", next: x.next || "", src: x.src, url: x.url, conf: x.conf }; });
    ISS_WHY._note = j.data.note || ""; ISS_WHY._src = j.sources || [];
    issWhyPaint(list, box);
  }).catch(function (e) { alert("이유 찾기 실패: " + e.message); }).then(function () { btn.disabled = false; btn.innerHTML = old; });
}
function issWhyPaint(list, box) {
  if (!box) return; var lis = box.querySelectorAll(".issList > li");
  Array.prototype.forEach.call(lis, function (li, i) { var it = list[i], w = it && ISS_WHY[it.title], old = li.querySelector(".issWhyAi"); if (old) old.remove(); if (!w) return; var d = document.createElement("div"); d.className = "issWhyAi"; d.innerHTML = '<div><b>왜</b> ' + escapeHtml(w.why) + '</div>' + (w.so ? '<div><b>그래서</b> ' + escapeHtml(w.so) + '</div>' : "") + (w.next ? '<div><b>볼 것</b> ' + escapeHtml(w.next) + '</div>' : "") + (w.src ? ' <small>' + (w.url ? '<a href="' + escapeHtml(w.url) + '" target="_blank" rel="noopener">' + escapeHtml(w.src) + '</a>' : escapeHtml(w.src)) + (w.conf ? " · 확신 " + escapeHtml(w.conf) : "") + '</small>' : "") + (w.bad && w.bad.length && typeof smNumWarn === "function" ? smNumWarn(w.bad) : ""); var host = li.querySelector("div") || li; host.appendChild(d); });
  var n = box.querySelector(".issWhyNote"); if (!n) { n = document.createElement("div"); n.className = "issWhyNote briefDim"; box.appendChild(n); }
  n.innerHTML = (ISS_WHY._note ? "흐름: " + escapeHtml(ISS_WHY._note) : "") + smSrcHtml(ISS_WHY._src);
}

/* ---------- ③ 발행 전 검수 ---------- */
function thrCheckRun(p, btn, out) {
  var get = function (c) { var t = p.querySelector("." + c); return t ? t.value : ""; };
  var input = "[카드 글자 — 카드 이미지에 그려진 글자]\n" + (typeof CARD_TXT === "string" && CARD_TXT ? CARD_TXT.slice(0, 4000) : "(없음)") + "\n\n[캡션]\n[인스타]\n" + get("thrIg") + "\n[스레드]\n" + get("thrTh") + "\n[답글1]\n" + get("thrR1") + "\n[답글2]\n" + get("thrR2");
  var old = btn.innerHTML; btn.disabled = true; btn.textContent = "검수 중…";
  smClaude("check", input, { json: true, web: false }).then(function (j) {
    var D = j.data, I = D.issues || [];
    out.innerHTML = '<b>검수</b> · ' + escapeHtml(j.model) + ' · ' + (I.length ? '<span style="color:#e2a33a">' + I.length + '건</span> — ' : '<span style="color:#7bd88f">문제 없음</span> — ') + escapeHtml(D.summary || "") + (I.length ? '<ul class="thrChk">' + I.map(function (x) { return '<li><b>[' + escapeHtml(x.where || "") + ' · ' + escapeHtml(x.level || "") + ']</b> ' + escapeHtml(x.problem || "") + (x.fix ? ' → <i>' + escapeHtml(x.fix) + '</i>' : '') + '</li>'; }).join("") + '</ul>' : '');
  }).catch(function (e) { out.textContent = "검수 실패: " + e.message; }).then(function () { btn.disabled = false; btn.innerHTML = old; });
}

/* ============================================================ v12.42 오늘의 브리핑 — ✨ Claude 해설 (한 번에: 시장 해설 3줄 · 핵심 이슈 왜/그래서/볼 것 · 급등락 이유 · 내일 볼 것) ============================================================ */
var BR_AI = (function () { try { return JSON.parse(localStorage.getItem("sm.briefAi") || "{}") || {}; } catch (e) { return {}; } })();
function brAiKey() { var b = typeof briefState !== "undefined" ? briefState : {}; return smKstDay() + "|" + (b.market || "all") + "|" + (b.mode || "day"); }
function brAiSave() { try { var keep = {}, d = smKstDay(); Object.keys(BR_AI).forEach(function (k) { if (k.indexOf(d) === 0) keep[k] = BR_AI[k]; }); BR_AI = keep; localStorage.setItem("sm.briefAi", JSON.stringify(keep)); } catch (e) {} }
function brAiInput() {
  var R = briefState.result, L = [], pc = function (x) { return typeof briefPct === "function" ? briefPct(x) : (x * 100).toFixed(2) + "%"; };
  L.push("[시장 — " + (R.mktName || "전체") + " · " + (R.label || "오늘") + "] " + (R.indexRow || []).slice(0, 5).map(function (x) { return x.name + " " + pc(x.ret); }).join(" · "));
  var t = R.temp; if (t && isFinite(t.upPct)) L.push("오른 종목 " + Math.round(t.upPct * 100) + "% (" + t.up + "/" + t.total + ") · 20일선 위 " + Math.round(t.abovePct * 100) + "% · 52주 신고가 " + (t.newHigh || []).length + " · 신저가 " + (t.newLow || []).length + (R.basis && R.basis.name ? " · 기준 " + R.basis.name : ""));
  var th = R.themes || []; if (th.length) L.push("[업종] 강세 " + th.slice(0, 3).map(function (x) { return x.name + " " + pc(x.ret); }).join(", ") + " / 약세 " + th.slice(-2).map(function (x) { return x.name + " " + pc(x.ret); }).join(", "));
  if (t && (t.newHigh || []).length) L.push("[52주 신고가] " + t.newHigh.slice(0, 8).map(function (s) { return s && s.sym ? briefName(s) : String(s); }).join(", "));
  if ((R.hotVol || []).length) L.push("[거래대금 급증 — 평소 대비] " + R.hotVol.slice(0, 6).map(function (s) { return briefName(s) + " " + s.amtX.toFixed(1) + "배 (" + pc(s.ret) + ")"; }).join(" · "));
  var mv = R.movers || { up: [], down: [] };
  L.push("[급등] " + mv.up.slice(0, 5).map(function (s) { return s.sym + " " + briefName(s) + " " + pc(s.ret); }).join(" · "));
  L.push("[급락] " + mv.down.slice(0, 5).map(function (s) { return s.sym + " " + briefName(s) + " " + pc(s.ret); }).join(" · "));
  var iss = briefState.issues || []; if (iss.length) { L.push("", "[핵심 이슈]"); iss.forEach(function (it, i) { L.push((i + 1) + ". " + it.title + " · " + (it.sub || "") + (it.sym ? " (" + it.sym + ")" : "")); }); }
  var news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).slice(0, 30); if (news.length) { L.push("", "[후보 기사 — 네이버]"); news.forEach(function (n) { L.push("- " + (n.title || "") + (n.press ? " (" + n.press + (n.time ? " · " + n.time : "") + ")" : "") + (n.desc ? " — " + String(n.desc).slice(0, 120) : "") + (n.url ? " " + n.url : "")); }); }
  var ev = typeof pubUpcoming === "function" ? (function () { try { return pubUpcoming(7); } catch (e) { return []; } })() : []; if (ev.length) { L.push("", "[다가오는 일정 7일]"); ev.slice(0, 12).forEach(function (e) { L.push("- " + e.d + " " + e.t + (e.n ? " — " + e.n : "")); }); }
  return L.join("\n");
}
function brAiRun(btn) {
  var R = briefState.result; if (!R) return;
  var old = btn.innerHTML; btn.disabled = true; btn.textContent = "Claude가 기사·이슈를 읽고 해설 중… (30초~2분)";
  var prep = typeof cardsNewsFetch === "function" ? cardsNewsFetch(R).catch(function () { return []; }) : Promise.resolve();
  Promise.resolve(prep).then(function () { return smClaude("brief", brAiInput(), { json: true }); }).then(function (j) {
    var D = j.data || {}, key = brAiKey(), iss = briefState.issues || [];
    (D.issues || []).forEach(function (x) { var it = iss[(+x.i || 0) - 1]; if (it) ISS_WHY[it.title] = { why: x.why || "", so: x.so || "", next: x.next || "", src: x.src, url: x.url, conf: x.conf }; });
    BR_AI[key] = { at: Date.now(), model: j.model, data: D, sources: j.sources || [], searches: (j.searches || []).length, iss: iss.map(function (it) { return it.title; }) }; brAiSave();
    brAiPaint();
  }).catch(function (e) { alert("Claude 해설 실패: " + e.message); }).then(function () { if (document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; } });
}
function brAiPaint() {
  var sec = document.getElementById("briefAiSec"); if (!sec || typeof briefState === "undefined" || !briefState.result) return;
  var A = BR_AI[brAiKey()], own = typeof isOwner === "function" && isOwner() && typeof smClaude === "function";
  if (!own) { sec.style.display = "none"; return; }
  sec.style.display = "";
  if (A && A.data) { (A.data.issues || []).forEach(function (x, k) { var t = A.iss && A.iss[(+x.i || 0) - 1]; if (t && !ISS_WHY[t]) ISS_WHY[t] = { why: x.why || "", so: x.so || "", next: x.next || "", src: x.src, url: x.url, conf: x.conf, bad: A.chk && A.chk.issues[k] }; }); }
  var h = '<div class="brAiHead"><b>✨ 오늘 브리핑</b><small class="briefDim">' + (A ? new Date(A.at + 9 * 3600e3).toISOString().slice(11, 16) + ' · ' + escapeHtml(A.model || "") + ' · 웹 검색 ' + A.searches + '회' : 'Claude 한 번 — 해설 3줄 · 이슈 왜/그래서/볼 것 · 급등락 이유 · 내일 볼 것 · 카드 편성 · 리포트 선정') + '</small><button class="' + (A ? 'chip' : 'primary') + '" data-brai>' + (A ? '다시 만들기' : '✨ 오늘 브리핑 만들기') + '</button></div>';
  if (A && A.data) {
    var D = A.data;
    if ((D.story || []).length) h += '<ol class="brAiStory">' + D.story.map(function (x, k) { return x ? '<li>' + escapeHtml(x) + (A.chk && typeof smNumWarn === "function" ? ' ' + smNumWarn(A.chk.story[k]) : '') + '</li>' : ''; }).join("") + '</ol>';
    if ((D.tomorrow || []).length) h += '<div class="brAiSub">내일 볼 것</div><ul class="brAiTm">' + D.tomorrow.map(function (x) { return '<li><b>' + escapeHtml(x.what || "") + '</b>' + (x.when ? ' <small>' + escapeHtml(x.when) + '</small>' : '') + (x.why ? '<div class="briefDim">' + escapeHtml(x.why) + '</div>' : '') + '</li>'; }).join("") + '</ul>';
    if (D.note) h += '<div class="briefDim" style="margin-top:6px">흐름: ' + escapeHtml(D.note) + '</div>';
    h += smSrcHtml(A.sources);
  }
  sec.innerHTML = h;
  var b = sec.querySelector("[data-brai]"); if (b) b.onclick = function () { brAiRun(b); };
  // 급등락 이유
  if (A && A.data) (A.data.movers || []).forEach(function (m, mi) { if (!m.why) return; var mb = A.chk && A.chk.movers[mi]; Array.prototype.forEach.call(document.querySelectorAll('#briefBody .briefMover[data-sym="' + String(m.sym).replace(/"/g, "") + '"]'), function (el) { var o = el.querySelector(".brMovWhy"); if (o) o.remove(); var d = document.createElement("div"); d.className = "brMovWhy"; d.innerHTML = "왜: " + escapeHtml(m.why) + (m.src ? ' <small>' + (m.url ? '<a href="' + escapeHtml(m.url) + '" target="_blank" rel="noopener">' + escapeHtml(m.src) + '</a>' : escapeHtml(m.src)) + (m.conf ? ' · 확신 ' + escapeHtml(m.conf) : '') + '</small>' : '') + (mb && mb.length && typeof smNumWarn === "function" ? ' ' + smNumWarn(mb) : ''); el.appendChild(d); }); });
  if (typeof issWhyPaint === "function" && briefState.issues) issWhyPaint(briefState.issues, document.getElementById("briefTop5"));
}
(function () { if (typeof renderBrief !== "function") return; var rb0 = renderBrief; renderBrief = function () { var r = rb0.apply(this, arguments); try { brAiPaint(); } catch (e) { console.warn(e); } return r; }; })();

/* ============================================================ v12.42 운영 순서 바 — 관리자 화면을 '데이터 확인 → 오늘 시장 → 편성 → 만들기 → 업로드' 순서로 ============================================================ */
(function () { try { if (typeof MK !== "undefined" && MK_AI && MK_AI.data && MK.filt === "today") MK.filt = "ai"; } catch (e) {} })();   // 오늘 편성이 있으면 작업대는 AI 편성부터
/* 이유 찾기 결과도 하루 동안 유지 */
(function () { try { var j = JSON.parse(localStorage.getItem("sm.issWhy") || "null"); if (j && j.d === smKstDay() && j.m) Object.keys(j.m).forEach(function (k) { if (!ISS_WHY[k]) ISS_WHY[k] = j.m[k]; }); } catch (e) {} })();
function issWhySave() { try { var m = {}; Object.keys(ISS_WHY).forEach(function (k) { if (k.charAt(0) !== "_") m[k] = ISS_WHY[k]; }); localStorage.setItem("sm.issWhy", JSON.stringify({ d: smKstDay(), m: m })); } catch (e) {} }
(function () { var p0 = issWhyPaint; issWhyPaint = function (list, box) { issWhySave(); return p0(list, box); }; })();
/* v12.44 시장별 작업 — 작업실·브리핑·카드 작업대가 같은 시장(briefState.market)을 쓴다. 진행 표시·편성·만든 카드도 시장마다 따로 */
var SM_MK_NM = { all: "전체", kr: "🇰🇷 국내", us: "🇺🇸 미국", coin: "₿ 코인" };
function smMk() { return typeof briefState !== "undefined" && SM_MK_NM[briefState.market] ? briefState.market : "all"; }
function smSymMk(sym) { if (!sym) return "all"; return /\.K[SQ]$|^\^K[SQ]/.test(sym) ? "kr" : /-USD$/.test(sym) ? "coin" : "us"; }
function smFlowFlags() { try { var j = JSON.parse(localStorage.getItem("sm.flow") || "null"); return j && j.d === smKstDay() ? j.f : {}; } catch (e) { return {}; } }
function smFlowMark(k, mk) { try { var f = smFlowFlags(), key = k + "@" + (mk || smMk()); if (f[key]) return; f[key] = Date.now(); localStorage.setItem("sm.flow", JSON.stringify({ d: smKstDay(), f: f })); smFlowPaint(); } catch (e) {} }
/* 편성: 시장마다 하나씩 (하루 유지) */
var MK_AI_MAP = (function () { try { var j = JSON.parse(localStorage.getItem("sm.aiPlanMk") || "null"); return j && j.d === smKstDay() ? j.m : {}; } catch (e) { return {}; } })();
if (MK_AI && !MK_AI_MAP[MK_AI.mk || "all"]) MK_AI_MAP[MK_AI.mk || "all"] = MK_AI;
MK_AI = MK_AI_MAP[smMk()] || null;
(function () { var s0 = mkAiSave; mkAiSave = function () { try { if (MK_AI) { MK_AI.mk = MK_AI.mk || smMk(); MK_AI_MAP[MK_AI.mk] = MK_AI; localStorage.setItem("sm.aiPlanMk", JSON.stringify({ d: smKstDay(), m: MK_AI_MAP })); } } catch (e) {} return s0.apply(this, arguments); }; })();
function smPlanFor(mk) { return MK_AI_MAP[mk] && MK_AI_MAP[mk].data ? MK_AI_MAP[mk] : null; }
/* 만든 카드에 시장 표시 */
function smDoneFor(mk) { return (typeof hubDoneLoad === "function" ? hubDoneLoad() : []).filter(function (d) { return !d.mk || mk === "all" || d.mk === mk; }); }
(function () { if (typeof hubDoneAdd !== "function") return; var a0 = hubDoneAdd; hubDoneAdd = function (ctx, title) { var r = a0.apply(this, arguments); try { var j = JSON.parse(localStorage.getItem("sm.mkdone") || "null"); if (j && j.items && j.items.length) { var it = j.items[j.items.length - 1]; if (!it.mk) it.mk = (typeof MK !== "undefined" && MK.mk) || smMk(); localStorage.setItem("sm.mkdone", JSON.stringify(j)); } } catch (e) {} smFlowPaint(); return r; }; })();
/* 시장 바꾸기 — 브리핑 · 카드 작업대 · 편성을 함께 */
function smSetMk(m, quiet) {
  if (!SM_MK_NM[m]) m = "all";
  if (typeof switchBriefMarket === "function" && briefState.market !== m) switchBriefMarket(m, true);
  else { briefState.market = m; try { localStorage.setItem("sm.briefMkt", m); } catch (e) {} }
  if (typeof MK !== "undefined") { MK.mk = m; MK._T = null; }
  MK_AI = MK_AI_MAP[m] || null;
  if (!quiet) smFlowPaint();
}
(function () { if (typeof switchBriefMarket !== "function") return; var b0 = switchBriefMarket; switchBriefMarket = function (m) { var r = b0.apply(this, arguments); try { if (typeof MK !== "undefined") { MK.mk = briefState.market; MK._T = null; } MK_AI = MK_AI_MAP[briefState.market] || null; if (briefState.result && typeof issuesCompute === "function" && briefState.recent) briefState.issues = issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular }); smFlowPaint(); } catch (e) {} return r; }; })();
var SM_FLOW = [
  { k: "data", n: "데이터 확인", tab: ["data"], hint: "데이터 센터에서 국내·미국 최신화 상태를 확인하세요 (늦은 시장은 ✨ 이상치 점검)" },
  { k: "brief", n: "오늘 시장", tab: ["brief"], hint: "오늘의 브리핑에서 ✨ Claude 해설 만들기 — 해설 3줄 · 핵심 이슈 왜/그래서/볼 것 · 급등락 이유" },
  { k: "plan", n: "편성", tab: [], hint: "카드 작업대 ✨ AI 편성에서 Claude 편성 시작 — 오늘 만들 카드·리포트를 골라요" },
  { k: "make", n: "만들기", tab: ["onecard", "report", "analyst"], hint: "편성 순서대로 카드 · 리포트 · 분석(🤖 끝까지 분석)을 만드세요" },
  { k: "pub", n: "업로드 글 · 검수", tab: [], hint: "카드 아래 업로드 글에서 ✨ AI 문구 → 발행 전 검수 후 올리세요" }
];
function smFlowDone(mk) {
  mk = mk || smMk(); var f = smFlowFlags(), d = {}, has = function (k) { return !!(f[k + "@" + mk] || (mk !== "all" && f[k + "@all"] && k === "data")); };
  d.data = has("data");
  d.brief = has("brief") || Object.keys(typeof BR_AI !== "undefined" ? BR_AI : {}).some(function (k) { return k.indexOf(smKstDay() + "|" + mk + "|") === 0; });
  d.plan = !!smPlanFor(mk);
  d.make = smDoneFor(mk).filter(function (x) { return mk === "all" || x.mk === mk; }).length > 0 || has("make");
  d.pub = has("pub");
  return d;
}
function smFlowGo(k) {
  if (k === "data") return navTo("data");
  if (k === "brief") { navTo("brief"); return setTimeout(function () { var s = document.getElementById("briefAiSec"); if (s && s.style.display !== "none") s.scrollIntoView({ behavior: "smooth", block: "start" }); }, 400); }
  if (k === "plan" || k === "make" || k === "pub") { if (typeof MK !== "undefined") { MK.tab = "work"; if (k === "plan") MK.filt = "ai"; } return navTo("onecard"); }
}
function smFlowPaint() {
  var el = document.getElementById("smFlow"); if (!(typeof isOwner === "function" && isOwner())) { if (el) el.style.display = "none"; return; }
  var tab = typeof currentTab !== "undefined" ? currentTab : "home", owner = ["home", "data", "brief", "onecard", "report", "analyst", "channel"];
  if (owner.indexOf(tab) < 0) { if (el) el.style.display = "none"; return; }
  if (!el) { el = document.createElement("div"); el.id = "smFlow"; el.className = "smFlow"; }
  var host = document.getElementById("tab-" + tab); if (!host) return;
  if (el.parentNode !== host) host.insertBefore(el, host.firstChild);
  el.style.display = "";
  var D = smFlowDone(), next = SM_FLOW.filter(function (s) { return !D[s.k]; })[0];
  var cur = SM_FLOW.filter(function (s) { return s.tab.indexOf(tab) >= 0; })[0];
  el.innerHTML = '<div class="smFlowBar"><span class="smFlowMk" title="작업실 · 브리핑 · 카드 작업대가 같은 시장을 써요">' + SM_MK_NM[smMk()] + ' 기준</span>' + SM_FLOW.map(function (s, i) { return '<button data-flow="' + s.k + '" class="' + (D[s.k] ? "done " : "") + (cur && cur.k === s.k ? "on " : "") + (next && next.k === s.k ? "next" : "") + '"><i>' + (D[s.k] ? "✓" : i + 1) + '</i><span>' + s.n + '</span></button>'; }).join('<em>›</em>') + '</div>' +
    '<div class="smFlowHint"><button class="smFlowOps" data-flowops>작업실에서 한눈에</button>' + (next ? '<b>다음 할 일 · ' + (SM_FLOW.indexOf(next) + 1) + '</b> ' + escapeHtml(next.hint) : '<b>오늘 순서 끝 ✓</b> 수고했어요 — 내일 아침 데이터 확인부터') + '</div>';
  Array.prototype.forEach.call(el.querySelectorAll("[data-flow]"), function (b) { b.onclick = function () { smFlowGo(b.getAttribute("data-flow")); }; });
  var ob = el.querySelector("[data-flowops]"); if (ob) ob.onclick = function () { navTo("ops"); };
}
(function () {
  if (typeof switchTab !== "function") return;
  var sw0 = switchTab; switchTab = function (t) { var r = sw0.apply(this, arguments); try { if (currentTab === "data") ["all", "kr", "us", "coin"].forEach(function (m) { smFlowMark("data", m); }); smFlowPaint(); } catch (e) {} return r; };
  if (typeof brAiPaint === "function") { var bp0 = brAiPaint; brAiPaint = function () { var r = bp0.apply(this, arguments); try { smFlowPaint(); } catch (e) {} return r; }; }
  if (typeof mkAiRun === "function") { var mr0 = mkAiRun; mkAiRun = function () { var r = mr0.apply(this, arguments); Promise.resolve(r).then(function () { smFlowPaint(); }); return r; }; }
  document.addEventListener("click", function (e) { var t = e.target && e.target.closest && e.target.closest(".thrAi, .thrChkBtn, .thrCopy, [data-thrcopy]"); if (t) smFlowMark("pub"); }, true);
  document.addEventListener("DOMContentLoaded", function () { setTimeout(smFlowPaint, 800); });
  setTimeout(smFlowPaint, 1500);
})();

/* ============================================================ v12.43 숫자 대조 — Claude 글의 숫자가 앱이 준 입력에 있는지 확인 (틀린 정보 차단)
   %·%p·배·원·달러·pt·bp·조·억 이 붙은 숫자만 본다. 입력 숫자를 글의 소수 자리로 반올림해도 같으면 통과.
   ============================================================ */
function smNumTok(t) {
  var out = [], re = /([+\-−–]?\d[\d,]*(?:\.\d+)?)\s*(%p|%포인트|%|배|원|달러|pt|bp|조|억|만)/g, m;
  t = String(t || "");
  while ((m = re.exec(t))) { var raw = m[1].replace(/[−–]/g, "-").replace(/,/g, ""), v = Math.abs(parseFloat(raw)); if (!isFinite(v)) continue; var dec = (raw.split(".")[1] || "").length; out.push({ s: m[0].trim(), v: v, dec: dec, u: m[2] === "%포인트" ? "%p" : m[2], at: m.index }); }
  return out;
}
var SM_NUM_STOP = /^(상승|하락|급등|급락|오른|내린|종목|비율|평소|하루|대비|기준|최근|오늘|어제|전일|거래|대금|변동|수익률|시장|전체|이상|이하|약|만에|가장|지수|업종|평균)$/;
/* 숫자 바로 앞의 이름(코스피·삼성전자 등)이 입력에도 있으면, 입력에서 그 이름 근처(같은 칸 안)의 숫자와만 맞춰 본다 — '코스피 1%'가 다른 지수의 1.46%로 통과하지 않게 */
function smNumCheck(text, src) {
  src = String(src || ""); text = String(text || "");
  var S = smNumTok(src), bad = [], seen = {};
  var same = function (x, y) { if (y.u !== x.u && !((x.u === "%" || x.u === "%p") && (y.u === "%" || y.u === "%p"))) return false; var f = Math.pow(10, x.dec); return Math.abs(Math.round(y.v * f) / f - x.v) < 1e-9 || Math.abs(y.v - x.v) < 1e-9; };
  smNumTok(text).forEach(function (x) {
    if (x.v === 0 || (x.u === "만" && x.v < 10)) return;
    var st = Math.max(0, x.at - 16), pre = text.slice(st, x.at); if (st > 0 && /[가-힣A-Za-z]/.test(text.charAt(st - 1))) pre = pre.replace(/^[가-힣A-Za-z0-9&.]+/, ""); pre = pre.split(/[\d%,·|]/).pop(); var words = (pre.match(/[가-힣A-Za-z&][가-힣A-Za-z0-9&.]{1,}/g) || []).filter(function (w) { return !SM_NUM_STOP.test(w) && src.indexOf(w) >= 0; }), ok;
    if (words.length) { var w = words[words.length - 1], near = [], p = -1; while ((p = src.indexOf(w, p + 1)) >= 0) near = near.concat(smNumTok(src.slice(p, p + w.length + 70).split(/[·|\n]/)[0])); ok = near.some(function (y) { return same(x, y); }); }
    else ok = S.some(function (y) { return same(x, y); });
    if (!ok && !seen[x.s]) { seen[x.s] = 1; bad.push((words.length ? words[words.length - 1] + " " : "") + x.s); }
  });
  return bad;
}
function smNumWarn(bad) { return bad && bad.length ? '<span class="smNumBad" title="앱이 준 숫자에 없는 값이에요 — 웹 출처를 확인하기 전까지 카드·업로드 글에는 넣지 않아요">⚠ 숫자 확인: ' + bad.slice(0, 4).map(escapeHtml).join(", ") + '</span>' : ""; }

/* 브리핑 해설 · 이슈 이유에 숫자 대조 붙이기 */
(function () {
  if (typeof brAiRun !== "function") return;
  var inpLast = "";
  var bi0 = brAiInput; brAiInput = function () { inpLast = bi0.apply(this, arguments); return inpLast; };
  var save0 = brAiSave; brAiSave = function () {
    try { var A = BR_AI[brAiKey()]; if (A && A.data && !A.chk && inpLast) { var D = A.data, src = inpLast + "\n" + (D.tomorrow || []).map(function (t) { return t.when || ""; }).join(" ");
      A.chk = { story: (D.story || []).map(function (l) { return smNumCheck(l, src); }), issues: (D.issues || []).map(function (x) { return smNumCheck([x.why, x.so, x.next].join(" "), src); }), movers: (D.movers || []).map(function (x) { return smNumCheck(x.why, src); }) };
      (D.issues || []).forEach(function (x, k) { var t = A.iss && A.iss[(+x.i || 0) - 1]; if (t && ISS_WHY[t]) ISS_WHY[t].bad = A.chk.issues[k]; });
    } } catch (e) { console.warn(e); }
    return save0.apply(this, arguments);
  };
  var wr0 = issWhyRun; issWhyRun = function (list, box, btn) {
    var news = []; try { news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).map(function (n) { return (n.title || "") + " " + (n.desc || ""); }); } catch (e) {}
    var src = list.map(function (it) { return it.title + " " + (it.sub || ""); }).join("\n") + "\n" + news.join("\n");
    var p0 = issWhyPaint; issWhyPaint = function (l, b) { list.forEach(function (it) { var w = ISS_WHY[it.title]; if (w && !w.bad) w.bad = smNumCheck([w.why, w.so, w.next].join(" "), src); }); issWhyPaint = p0; return p0(l, b); };
    return wr0(list, box, btn);
  };
})();

/* ============================================================ v12.46 오늘 브리핑 한 번 — 해설·이슈 이유·급등락 이유·내일 볼 것·카드 편성·리포트 선정을 Claude 호출 1회로
   이전: brief(해설) · why(이슈) · plan(편성) · rpick(리포트) 네 번이 같은 기사·이슈를 각각 읽었다 → 입력 토큰 4배, 웹 검색 4배, 서로 다른 설명.
   지금: smDailyRun 한 번 → BR_AI(해설) · ISS_WHY(이슈) · MK_AI(편성) · RP.ai2(리포트) 를 모두 채운다. 시장(국내·미국·코인·전체)마다 따로, 하루 보관.
   브리핑 화면 · 카드 작업대 · 리포트 · 작업실의 버튼은 전부 이 함수를 부른다(결과 공유).
   ============================================================ */
function smDailyInput() {
  var R = briefState.result, L = [], pc = function (x) { return typeof briefPct === "function" ? briefPct(x) : (x * 100).toFixed(2) + "%"; }, st = function (s) { return typeof nbStat === "function" ? nbStat(s) : null; };
  L.push("[시장 — " + (R.mktName || "전체") + " · " + (R.label || "오늘") + " · 기준일 " + (typeof cDate === "function" ? cDate(R.asOf) : "") + "]");
  (R.indexRow || []).forEach(function (x) { var S = st(x.sym); L.push("- " + x.name + " " + pc(x.ret) + (S ? " · 5일 " + pc(S.ret5 || 0) + " · 1개월 " + pc(S.m1) + " · 52주 고점 대비 " + pc(S.vsHi || 0) + " · 평소 하루 변동의 " + (S.sd > 0 ? (Math.abs(S.ret1) / S.sd).toFixed(1) : "-") + "배" : "")); });
  var t = R.temp; if (t && isFinite(t.upPct)) L.push("[폭] 오른 종목 " + Math.round(t.upPct * 100) + "% (" + t.up + "/" + t.total + ") · 20일선 위 " + Math.round(t.abovePct * 100) + "%" + (t.above200Pct != null ? " · 200일선 위 " + Math.round(t.above200Pct * 100) + "%" : "") + " · 52주 신고가 " + (t.newHigh || []).length + " · 신저가 " + (t.newLow || []).length + (R.basis && R.basis.name ? " · 기준 " + R.basis.name : ""));
  var th = R.themes || []; if (th.length) L.push("[업종] " + th.slice(0, 4).map(function (x) { return x.name + " " + pc(x.ret) + "(" + x.up + "/" + x.n + ")"; }).join(", ") + " / 약세 " + th.slice(-3).map(function (x) { return x.name + " " + pc(x.ret); }).join(", "));
  if (t && (t.newHigh || []).length) L.push("[52주 신고가] " + t.newHigh.slice(0, 8).map(function (s) { return s && s.sym ? briefName(s) : String(s); }).join(", "));
  if ((R.hotVol || []).length) L.push("[거래대금 급증 — 평소 대비] " + R.hotVol.slice(0, 6).map(function (s) { return s.sym + " " + briefName(s) + " " + s.amtX.toFixed(1) + "배 (" + pc(s.ret) + ")"; }).join(" · "));
  var mv = R.movers || { up: [], down: [] };
  L.push("[급등] " + mv.up.slice(0, 5).map(function (s) { return s.sym + " " + briefName(s) + " " + pc(s.ret); }).join(" · "));
  L.push("[급락] " + mv.down.slice(0, 5).map(function (s) { return s.sym + " " + briefName(s) + " " + pc(s.ret); }).join(" · "));
  try { var now = nbNow(); if (now && now.why && now.why.length) L.push("[국면 신호 — 앱 규칙] " + now.why.join(" / ")); } catch (e) {}
  try { if (typeof macSer === "function") { var mm = ["krw", "bok", "fed", "us10y"].map(function (k) { var S = macSer(k); if (!S || !S.v.length) return null; var nm = { krw: "원/달러", bok: "한국 기준금리", fed: "미 기준금리", us10y: "미 10년물" }[k]; return nm + " " + S.v[S.v.length - 1] + (k === "krw" ? "원" : "%"); }).filter(Boolean); if (mm.length) L.push("[매크로] " + mm.join(" · ")); } } catch (e) {}
  var iss = briefState.issues || []; if (iss.length) { L.push("", "[핵심 이슈]"); iss.forEach(function (it, i) { L.push((i + 1) + ". " + it.title + " · " + (it.sub || "") + (it.sym ? " (" + it.sym + ")" : "")); }); }
  var news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).slice(0, 40); if (news.length) { L.push("", "[후보 기사 — 네이버]"); news.forEach(function (n) { L.push("- " + (n.title || "") + (n.press ? " (" + n.press + (n.time ? " · " + n.time : "") + ")" : "") + (n.desc ? " — " + String(n.desc).slice(0, 110) : "") + (n.url ? " " + n.url : "")); }); }
  var ev = []; try { ev = typeof pubUpcoming === "function" ? pubUpcoming(7) : []; } catch (e) {} if (ev.length) { L.push("", "[다가오는 일정 7일]"); ev.slice(0, 12).forEach(function (e) { L.push("- " + e.d + " " + e.t + (e.n ? " — " + e.n : "")); }); }
  var T = []; try { T = typeof mkTopicsScored === "function" ? mkTopicsScored() : []; } catch (e) {}
  if (T.length) { L.push("", "[주제 후보] — ctx | 묶음 | 제목 | 앱 점수(0~10) | 앱이 본 선정 이유"); T.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, 60).forEach(function (x) { L.push("- " + x.ctx + " | " + x.g + " | " + cPlain(x.t) + " | " + Math.round(x.s) + " | " + (x.why || x.d || "").slice(0, 80)); }); }
  var Q = []; try { Q = typeof rpQuestions === "function" ? rpQuestions() : []; } catch (e) {}
  if (Q.length) { L.push("", "[리포트 후보] — id | 종류 | 질문 | 왜"); Q.slice(0, 24).forEach(function (q) { L.push("- " + q.id + " | " + q.kind + " | " + q.t + " | " + (q.why || q.d || "")); }); }
  L.push("", "요일: " + "일월화수목금토"[new Date(Date.now() + 9 * 3600e3).getUTCDay()] + " · 선택한 시장: " + smMk());
  return L.join("\n");
}
var SM_DAILY = { busy: false };
function smDailyApply(j, input) {
  var D = j.data || {}, mk = smMk(), key = brAiKey(), iss = briefState.issues || [];
  // ① 해설·이슈·급등락·내일 → BR_AI + ISS_WHY (숫자 대조 포함)
  var src = input + "\n" + (D.tomorrow || []).map(function (t) { return t.when || ""; }).join(" ");
  var chk = { story: (D.story || []).map(function (l) { return smNumCheck(l, src); }), issues: (D.issues || []).map(function (x) { return smNumCheck([x.why, x.so, x.next].join(" "), src); }), movers: (D.movers || []).map(function (x) { return smNumCheck(x.why, src); }) };
  (D.issues || []).forEach(function (x, k) { var it = iss[(+x.i || 0) - 1]; if (it) ISS_WHY[it.title] = { why: x.why || "", so: x.so || "", next: x.next || "", src: x.src, url: x.url, conf: x.conf, bad: chk.issues[k] }; });
  ISS_WHY._note = D.note || ""; ISS_WHY._src = j.sources || [];
  BR_AI[key] = { at: Date.now(), model: j.model, data: { story: D.story || [], issues: D.issues || [], movers: D.movers || [], tomorrow: D.tomorrow || [], note: D.note || "" }, sources: j.sources || [], searches: (j.searches || []).length, iss: iss.map(function (it) { return it.title; }), chk: chk, repaired: !!j.repaired };
  brAiSave(); issWhySave();
  // ② 편성 → MK_AI (시장별)
  var P = D.plan || {}; MK_AI = { day: smKstDay(), at: Date.now(), mk: mk, data: { summary: P.summary || D.note || "", picks: P.picks || [], extra: P.extra || [], week: P.week || [], reports: (D.reports || []).filter(function (r) { return r.id; }) }, rpick: { picks: D.reports || [], summary: P.summary || "" }, sources: j.sources || [], searches: j.searches || [], used: j.used, max: j.max };
  mkAiSave(); if (typeof MK !== "undefined") { MK.filt = "ai"; MK._T = null; }
  // ③ 리포트 선정 → RP.ai2
  smRpickApply();
}
function smRpickApply() { if (typeof RP === "undefined") return; var P = smPlanFor(smMk()); RP.ai2 = P && P.rpick && P.rpick.picks && P.rpick.picks.length ? { day: smKstDay(), picks: P.rpick.picks, summary: P.rpick.summary || "", sources: P.sources || [], model: "daily" } : null; RP.today = null; try { if (RP.ai2) localStorage.setItem("sm.rpAi", JSON.stringify(RP.ai2)); else localStorage.removeItem("sm.rpAi"); } catch (e) {} }
function smDailyRepaint() {
  try { if (typeof brAiPaint === "function") brAiPaint(); } catch (e) {}
  try { if (currentTab === "onecard" && typeof makerRender === "function") makerRender(); } catch (e) {}
  try { if (currentTab === "report" && typeof renderReport === "function") renderReport(); } catch (e) {}
  try { if (currentTab === "ops" && typeof renderOps === "function") renderOps(); } catch (e) {}
  try { if (currentTab === "channel" && typeof chState !== "undefined" && chState.issues && typeof issWhyPaint === "function") issWhyPaint(chState.issues, document.getElementById("chIssues")); } catch (e) {}
  try { smFlowPaint(); } catch (e) {}
}
/* 실행 — btn 은 눌린 버튼(있으면 잠그고 진행 문구). 돌아오는 Promise 는 성공 여부(true/false) */
function smDailyRun(btn) {
  if (SM_DAILY.busy) return Promise.resolve(false);
  if (!briefState.result) { alert("시장 데이터를 아직 준비하는 중이에요 — 잠시 뒤 다시 눌러 주세요"); return Promise.resolve(false); }
  if (!briefState.issues && typeof issuesCompute === "function" && briefState.recent) { try { briefState.issues = issuesCompute(briefState.recent, { market: smMk(), popular: briefState.popular }); } catch (e) {} }
  SM_DAILY.busy = true; var old = btn ? btn.innerHTML : ""; if (btn) { btn.disabled = true; btn.textContent = "Claude가 기사·이슈를 읽고 브리핑·편성·리포트를 한 번에 만드는 중… (1~3분)"; }
  var prep = typeof cardsNewsFetch === "function" ? cardsNewsFetch(briefState.result).catch(function () { return []; }) : Promise.resolve();
  var mac = typeof macroEnsure === "function" ? macroEnsure().catch(function () { return null; }) : Promise.resolve();
  var input = "";
  return Promise.all([prep, mac]).then(function () { input = smDailyInput(); return smClaude("daily", input, { json: true }); })
    .then(function (j) { smDailyApply(j, input); return true; })
    .catch(function (e) { alert("오늘 브리핑 실패: " + e.message); return false; })
    .then(function (ok) { SM_DAILY.busy = false; if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; } smDailyRepaint(); return ok; });
}
/* 옛 진입점을 모두 한 번 호출로 — 브리핑 화면 · 이슈 '이유' · 카드 작업대 편성 · 리포트 선정 */
brAiRun = function (btn) { return smDailyRun(btn); };
issWhyRun = function (list, box, btn) { return smDailyRun(btn); };
mkAiRun = function (btn) { return smDailyRun(btn); };
if (typeof rpAiPickRun === "function") rpAiPickRun = function (btn) { return smDailyRun(btn); };
/* 리포트 선정은 시장별 편성 안에 들어 있으므로 시장을 바꾸면 따라간다 */
(function () { var s0 = smSetMk; smSetMk = function () { var r = s0.apply(this, arguments); try { smRpickApply(); } catch (e) {} return r; }; var b0 = switchBriefMarket; switchBriefMarket = function () { var r = b0.apply(this, arguments); try { smRpickApply(); } catch (e) {} return r; }; try { smRpickApply(); } catch (e) {} })();
/* 편성 목록 — Claude 가 ctx 를 조금 바꿔 써도 제목으로 찾는다(하나도 안 나오던 원인). 못 찾은 것은 '아이디어'로 */
mkAiList = function (T) {
  if (!MK_AI || !MK_AI.data) return [];
  var by = {}, byT = {}; T.forEach(function (x) { by[x.ctx] = x; byT[cPlain(x.t).replace(/\s+/g, "")] = x; });
  var norm = function (s) { return String(s || "").replace(/\s+/g, "").toLowerCase(); };
  return (MK_AI.data.picks || []).map(function (p) {
    var x = by[p.ctx] || byT[norm(p.title)] || null;
    if (!x && p.ctx) { var c = norm(p.ctx); x = T.filter(function (y) { return norm(y.ctx) === c || norm(y.ctx).indexOf(c) >= 0 || c.indexOf(norm(y.ctx)) >= 0; })[0] || null; }
    if (!x && (p.title || p.hook)) { var tt = norm(p.title || p.hook); x = T.filter(function (y) { var yt = norm(cPlain(y.t)); return yt && (yt.indexOf(tt) >= 0 || tt.indexOf(yt) >= 0); })[0] || null; }
    return x ? Object.assign({}, x, { why: (p.slot ? "[" + p.slot + "] " : "") + (p.hook ? "“" + p.hook + "” · " : "") + (p.why || "") }) : null;
  }).filter(Boolean);
};
/* 운영 순서 — 편성 단계가 브리핑에 합쳐져 4단계 */
SM_FLOW = [
  { k: "data", n: "데이터 확인", tab: ["data"], hint: "데이터 센터에서 시세가 최신인지 확인하세요 (늦은 시장은 ✨ 원인 확인)" },
  { k: "brief", n: "오늘 브리핑", tab: ["brief"], hint: "✨ 오늘 브리핑 한 번 — 해설 3줄 · 이슈 왜/그래서/볼 것 · 급등락 이유 · 내일 볼 것 · 카드 편성 · 리포트 선정이 한 번에 나와요" },
  { k: "make", n: "만들기", tab: ["onecard", "report", "analyst"], hint: "편성 순서대로 카드 · 리포트 · 분석(🤖 끝까지 분석)을 만드세요" },
  { k: "pub", n: "업로드 · 검수", tab: [], hint: "카드마다 ✨ AI 문구(인스타·스레드 글) → 발행 전 검수 → 올리기" }
];
smFlowGo = function (k) {
  if (k === "data") return navTo("data");
  if (k === "brief") return navTo("ops");
  if (k === "make" || k === "pub") { if (typeof MK !== "undefined") { MK.tab = "work"; MK.mk = smMk(); if (smPlanFor(smMk())) MK.filt = "ai"; } return navTo("onecard"); }
};

/* ============================================================ v12.47 오늘 브리핑은 시장 구분 없이 하루 한 번 — 국내·미국·코인을 한 입력에 담아 한 번 호출하고, 결과를 네 시장 키에 모두 저장
   (시장마다 따로 부르면 같은 기사·일정을 세 번 읽고 토큰도 세 배. 계정은 세 시장을 함께 다루므로 한 번이 맞다)
   + 결과가 비어 있으면(해설·이슈·편성 전부 0) 성공으로 치지 않고 원문·멈춘 이유를 보여 준다 ============================================================ */
var SM_MK_LIST = ["all", "kr", "us", "coin"];
function smMkFrame(mk) {
  if (!briefState.recent || typeof briefCompute !== "function") return null;
  try { return { R: briefCompute(briefState.recent, { mode: "day", market: mk, popular: briefState.popular }), iss: typeof issuesCompute === "function" ? issuesCompute(briefState.recent, { market: mk, popular: briefState.popular }) : [] }; } catch (e) { return null; }
}
/* 네 시장의 이슈를 제목으로 합친 목록(순서: 전체 → 국내 → 미국 → 코인) — Claude 에 번호로 넘기고, 돌아온 번호를 제목으로 되돌린다 */
var SM_DAILY_ISS = [];
smDailyInput = function () {
  var pc = function (x) { return typeof briefPct === "function" ? briefPct(x) : (x * 100).toFixed(2) + "%"; }, st = function (s) { return typeof nbStat === "function" ? nbStat(s) : null; }, L = [], F = {};
  SM_MK_LIST.forEach(function (m) { F[m] = smMkFrame(m); });
  var R0 = F.all && F.all.R || briefState.result;
  L.push("[기준일 " + (typeof cDate === "function" ? cDate(R0.asOf) : "") + " 종가 · 국내(오후 3:30 마감) · 미국(한국 새벽 마감) · 코인(오전 9시 마감)을 한 번에]");
  [["kr", "국내"], ["us", "미국"], ["coin", "코인"]].forEach(function (p) {
    var Fm = F[p[0]], R = Fm && Fm.R; if (!R) return;
    L.push("", "[" + p[1] + " 시장]");
    (R.indexRow || []).forEach(function (x) { var S = st(x.sym); L.push("- " + x.name + " " + pc(x.ret) + (S ? " · 5일 " + pc(S.ret5 || 0) + " · 1개월 " + pc(S.m1) + " · 52주 고점 대비 " + pc(S.vsHi || 0) + " · 평소 하루 변동의 " + (S.sd > 0 ? (Math.abs(S.ret1) / S.sd).toFixed(1) : "-") + "배" : "")); });
    var t = R.temp; if (t && isFinite(t.upPct)) L.push("폭: 오른 종목 " + Math.round(t.upPct * 100) + "% (" + t.up + "/" + t.total + ") · 20일선 위 " + Math.round(t.abovePct * 100) + "%" + (t.above200Pct != null ? " · 200일선 위 " + Math.round(t.above200Pct * 100) + "%" : "") + " · 52주 신고가 " + (t.newHigh || []).length + " · 신저가 " + (t.newLow || []).length);
    var th = R.themes || []; if (th.length) L.push("업종: 강세 " + th.slice(0, 3).map(function (x) { return x.name + " " + pc(x.ret) + "(" + x.up + "/" + x.n + ")"; }).join(", ") + " / 약세 " + th.slice(-2).map(function (x) { return x.name + " " + pc(x.ret); }).join(", "));
    if (t && (t.newHigh || []).length) L.push("52주 신고가: " + t.newHigh.slice(0, 6).map(function (s) { return s && s.sym ? briefName(s) : String(s); }).join(", "));
    if ((R.hotVol || []).length) L.push("거래대금 급증: " + R.hotVol.slice(0, 4).map(function (s) { return s.sym + " " + briefName(s) + " " + s.amtX.toFixed(1) + "배 (" + pc(s.ret) + ")"; }).join(" · "));
    var mv = R.movers || { up: [], down: [] };
    if (mv.up.length) L.push("급등: " + mv.up.slice(0, 4).map(function (s) { return s.sym + " " + briefName(s) + " " + pc(s.ret); }).join(" · "));
    if (mv.down.length) L.push("급락: " + mv.down.slice(0, 4).map(function (s) { return s.sym + " " + briefName(s) + " " + pc(s.ret); }).join(" · "));
  });
  try { var now = nbNow(); if (now && now.why && now.why.length) L.push("", "[국면 신호 — 앱 규칙] " + now.why.join(" / ")); } catch (e) {}
  try { if (typeof macSer === "function") { var mm = ["krw", "bok", "fed", "us10y"].map(function (k) { var S = macSer(k); if (!S || !S.v.length) return null; return { krw: "원/달러", bok: "한국 기준금리", fed: "미 기준금리", us10y: "미 10년물" }[k] + " " + S.v[S.v.length - 1] + (k === "krw" ? "원" : "%"); }).filter(Boolean); if (mm.length) L.push("[매크로] " + mm.join(" · ")); } } catch (e) {}
  // 이슈: 네 시장 합치기(제목 중복 제거)
  SM_DAILY_ISS = []; var seen = {};
  SM_MK_LIST.forEach(function (m) { ((F[m] && F[m].iss) || []).forEach(function (it) { if (seen[it.title]) return; seen[it.title] = 1; SM_DAILY_ISS.push(Object.assign({ mk: m }, it)); }); });
  if (SM_DAILY_ISS.length) { L.push("", "[핵심 이슈 — 시장별 상위]"); SM_DAILY_ISS.forEach(function (it, i) { L.push((i + 1) + ". [" + ({ all: "전체", kr: "국내", us: "미국", coin: "코인" })[it.mk] + "] " + it.title + " · " + (it.sub || "") + (it.sym ? " (" + it.sym + ")" : "")); }); }
  var news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).slice(0, 40); if (news.length) { L.push("", "[후보 기사 — 네이버]"); news.forEach(function (n) { L.push("- " + (n.title || "") + (n.press ? " (" + n.press + (n.time ? " · " + n.time : "") + ")" : "") + (n.desc ? " — " + String(n.desc).slice(0, 110) : "") + (n.url ? " " + n.url : "")); }); }
  var ev = []; try { ev = typeof pubUpcoming === "function" ? pubUpcoming(7) : []; } catch (e) {} if (ev.length) { L.push("", "[다가오는 일정 7일]"); ev.slice(0, 12).forEach(function (e) { L.push("- " + e.d + " " + e.t + (e.n ? " — " + e.n : "")); }); }
  var T = []; try { T = typeof mkTopicsScored === "function" ? mkTopicsScored() : []; } catch (e) {}
  if (T.length) { L.push("", "[주제 후보] — ctx | 묶음 | 제목 | 앱 점수(0~10) | 앱이 본 선정 이유"); T.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, 60).forEach(function (x) { L.push("- " + x.ctx + " | " + x.g + " | " + cPlain(x.t) + " | " + Math.round(x.s) + " | " + (x.why || x.d || "").slice(0, 80)); }); }
  var Q = []; try { Q = typeof rpQuestions === "function" ? rpQuestions() : []; } catch (e) {}
  if (Q.length) { L.push("", "[리포트 후보] — id | 종류 | 질문 | 왜"); Q.slice(0, 24).forEach(function (q) { L.push("- " + q.id + " | " + q.kind + " | " + q.t + " | " + (q.why || q.d || "")); }); }
  L.push("", "요일: " + "일월화수목금토"[new Date(Date.now() + 9 * 3600e3).getUTCDay()] + " · 계정은 국내·미국·코인을 모두 다룬다 — 편성은 세 시장을 섞어서");
  return L.join("\n");
};
function smDailyEmpty(D) { return !(D.story || []).filter(Boolean).length && !(D.issues || []).some(function (x) { return x.why; }) && !((D.plan || {}).picks || []).length && !(D.reports || []).length; }
smDailyApply = function (j, input) {
  var D = j.data || {}, iss = SM_DAILY_ISS, day = smKstDay();
  if (smDailyEmpty(D)) { var e = new Error("Claude 답에 내용이 없어요 (해설·이슈·편성 모두 0) — 멈춘 이유: " + (j.stop || "?") + (j.repaired ? " · 형식 복구 뒤에도 비어 있음" : "") + "\n원문 앞부분: " + String(j.text || "").slice(0, 200)); e.raw = j; throw e; }
  var src = input + "\n" + (D.tomorrow || []).map(function (t) { return t.when || ""; }).join(" ");
  var chk = { story: (D.story || []).map(function (l) { return smNumCheck(l, src); }), issues: (D.issues || []).map(function (x) { return smNumCheck([x.why, x.so, x.next].join(" "), src); }), movers: (D.movers || []).map(function (x) { return smNumCheck(x.why, src); }) };
  (D.issues || []).forEach(function (x, k) { var it = iss[(+x.i || 0) - 1]; if (it) ISS_WHY[it.title] = { why: x.why || "", so: x.so || "", next: x.next || "", src: x.src, url: x.url, conf: x.conf, bad: chk.issues[k] }; });
  ISS_WHY._note = D.note || ""; ISS_WHY._src = j.sources || [];
  var rec = { at: Date.now(), model: j.model, data: { story: D.story || [], issues: D.issues || [], movers: D.movers || [], tomorrow: D.tomorrow || [], note: D.note || "" }, sources: j.sources || [], searches: (j.searches || []).length, iss: iss.map(function (it) { return it.title; }), chk: chk, repaired: !!j.repaired, stop: j.stop, usage: j.usage || null, raw: String(j.text || "").slice(0, 6000), shared: true };
  var P = D.plan || {}, plan = { day: day, at: rec.at, data: { summary: P.summary || D.note || "", picks: P.picks || [], extra: P.extra || [], week: P.week || [], reports: (D.reports || []).filter(function (r) { return r.id; }) }, rpick: { picks: D.reports || [], summary: P.summary || "" }, sources: j.sources || [], searches: j.searches || [], used: j.used, max: j.max, shared: true };
  var mode = briefState.mode || "day";
  SM_MK_LIST.forEach(function (m) { BR_AI[day + "|" + m + "|" + mode] = rec; MK_AI_MAP[m] = Object.assign({ mk: m }, plan); });
  brAiSave(); issWhySave();
  try { localStorage.setItem("sm.aiPlanMk", JSON.stringify({ d: day, m: MK_AI_MAP })); } catch (e) {}
  MK_AI = MK_AI_MAP[smMk()]; if (typeof MK !== "undefined") { MK.filt = "ai"; MK._T = null; }
  smRpickApply();
};
/* 빈 결과·실패 원문을 남겨 두고 작업실에서 볼 수 있게 */
smDailyRun = function (btn) {
  if (SM_DAILY.busy) return Promise.resolve(false);
  if (!briefState.result) { alert("시장 데이터를 아직 준비하는 중이에요 — 잠시 뒤 다시 눌러 주세요"); return Promise.resolve(false); }
  SM_DAILY.busy = true; var old = btn ? btn.innerHTML : ""; if (btn) { btn.disabled = true; btn.textContent = "Claude가 국내·미국·코인 기사·이슈를 읽고 브리핑·편성·리포트를 한 번에 만드는 중… (1~3분)"; }
  var prep = typeof cardsNewsFetch === "function" ? cardsNewsFetch(briefState.result).catch(function () { return []; }) : Promise.resolve();
  var mac = typeof macroEnsure === "function" ? macroEnsure().catch(function () { return null; }) : Promise.resolve();
  var input = "";
  return Promise.all([prep, mac]).then(function () { input = smDailyInput(); return smClaude("daily", input, { json: true }); })
    .then(function (j) { smDailyApply(j, input); SM_DAILY.last = null; return true; })
    .catch(function (e) { SM_DAILY.last = { at: Date.now(), msg: e.message, raw: e.raw ? String(e.raw.text || "").slice(0, 6000) : (e.res && e.res.text) || "", stop: e.raw ? e.raw.stop : e.res && e.res.reason }; try { localStorage.setItem("sm.dailyErr", JSON.stringify(SM_DAILY.last)); } catch (x) {} alert("오늘 브리핑 실패: " + e.message); return false; })
    .then(function (ok) { SM_DAILY.busy = false; if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; } smDailyRepaint(); return ok; });
};
try { SM_DAILY.last = JSON.parse(localStorage.getItem("sm.dailyErr") || "null"); if (SM_DAILY.last && Date.now() - SM_DAILY.last.at > 12 * 3600e3) SM_DAILY.last = null; } catch (e) {}
brAiRun = function (btn) { return smDailyRun(btn); }; issWhyRun = function (l, b, btn) { return smDailyRun(btn); }; mkAiRun = function (btn) { return smDailyRun(btn); }; if (typeof rpAiPickRun === "function") rpAiPickRun = function (btn) { return smDailyRun(btn); };
/* 진행 표시: 브리핑은 시장 공통 */
(function () { var d0 = smFlowDone; smFlowDone = function (mk) { var d = d0.apply(this, arguments); var day = smKstDay(); d.brief = d.brief || Object.keys(BR_AI).some(function (k) { return k.indexOf(day + "|") === 0 && BR_AI[k] && BR_AI[k].shared; }); return d; }; })();
