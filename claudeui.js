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
  if (!MK_AI || !MK_AI.data) return '<div class="aiPlan briefDim">아직 오늘 편성이 없어요 — <b>✨ Claude 편성</b>을 누르면 기사·이슈를 모아 오늘 올릴 카드와 볼 리포트를 골라 줘요.</div>';
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
    (j.data.items || []).forEach(function (x) { var it = list[(+x.i || 0) - 1]; if (it && x.why) ISS_WHY[it.title] = { why: x.why, src: x.src, url: x.url, conf: x.conf }; });
    ISS_WHY._note = j.data.note || ""; ISS_WHY._src = j.sources || [];
    issWhyPaint(list, box);
  }).catch(function (e) { alert("이유 찾기 실패: " + e.message); }).then(function () { btn.disabled = false; btn.innerHTML = old; });
}
function issWhyPaint(list, box) {
  if (!box) return; var lis = box.querySelectorAll(".issList > li");
  Array.prototype.forEach.call(lis, function (li, i) { var it = list[i], w = it && ISS_WHY[it.title], old = li.querySelector(".issWhyAi"); if (old) old.remove(); if (!w) return; var d = document.createElement("div"); d.className = "issWhyAi"; d.innerHTML = "왜: " + escapeHtml(w.why) + (w.src ? ' <small>' + (w.url ? '<a href="' + escapeHtml(w.url) + '" target="_blank" rel="noopener">' + escapeHtml(w.src) + '</a>' : escapeHtml(w.src)) + (w.conf ? " · 확신 " + escapeHtml(w.conf) : "") + '</small>' : ""); var host = li.querySelector("div") || li; host.appendChild(d); });
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
