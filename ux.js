/* ============================================================ v12.69 UX — 순서가 보이는 운영 화면 · 스레드 글 주제별 묶음 · 보완된 부분 표시 · 모바일
   1) 운영 흐름 바: '만들기' 단계에 카드 · 리포트 · 분석 소단계(오늘 했는지) 표시, 문구 최신화(분석은 프롬프트 복사 방식)
   2) 리포트 · 분석 화면 위 '단계 레일'(끈적) — 어디까지 했고 다음이 무엇인지, 누르면 그 자리로
   3) 리포트 스레드 글: 번호 12~15개 → 본문 + 주제별 답글 4개(근거 · 반대쪽 · 그래서 · 질문), 전체 복사 한 번
   4) Claude 서술 적용 뒤 '무엇이 보완됐나' 패널 — 규칙 초안 vs Claude 나란히, 앱 근거에 없던 숫자 표시, 행동안 추가/수정 표시
   5) 모바일: 버튼 줄 바꿈 · 전체 폭 입력 · 모달 전체 화면 · 가로 넘침 방지
   ============================================================ */
var UX = { railOpen: true };
function uxEsc(s) { return escapeHtml(String(s == null ? "" : s)); }
/* 글 속 숫자 토큰(%, 배, 원, 조, 억 단위 포함) — 두 글을 비교할 때 쓴다 */
function uxNums(t) { var m = String(t || "").replace(/−/g, "-").replace(/,/g, "").match(/[+-]?\d+(?:\.\d+)?\s?(?:%|배|원|조|억|만|p|bp|달러|\$)?/g) || []; return m.map(function (x) { return x.replace(/\s+/g, "").replace(/^\+/, ""); }); }
function uxNumSet(t) { var s = {}; uxNums(t).forEach(function (x) { s[x] = 1; var b = x.replace(/[^\d.\-]/g, ""); if (b) s[b] = 1; }); return s; }
/* 새 숫자 강조 — base에 없던 숫자만 <mark> (1자리 정수 · 순번은 제외) */
function uxMarkNew(text, baseSet) {
  var out = uxEsc(text), cnt = 0;
  out = out.replace(/([+-]?\d[\d,]*(?:\.\d+)?)(\s?(?:%|배|원|조|억|만|bp|달러|\$)?)(?=([^\d]|$))/g, function (m, n, u, after, off, str) {
    var before = str.charAt(off - 1), nxt = str.substr(off + m.length, 2);
    if (/[\/.\-:]/.test(before) && /\d/.test(str.charAt(off - 2))) return m;            // 10/28 · 2026-10-28 · 9:30
    if (/^[\/:]\d/.test(nxt) || /^(월|일|년|시|분기|분|Q|주차|차|번째|개월|회)/.test(nxt)) return m;   // 날짜 · 순번
    var k = (n + u).replace(/\s+/g, "").replace(/,/g, "").replace(/^\+/, ""), b = k.replace(/[^\d.\-]/g, "");
    if (!u && b.replace(/^-/, "").length < 2) return m;   // 1자리 숫자(순번 등)
    if (baseSet[k] || baseSet[b]) return m;
    cnt++; return '<mark class="uxNew" title="앱 근거에 없던 숫자 — Claude가 보완한 것이라 출처를 확인하세요">' + m + '</mark>';
  });
  return { html: out, n: cnt };
}
function uxSim(a, b) { var A = {}, B = {}, s = String(a || "").replace(/\s+/g, ""), t = String(b || "").replace(/\s+/g, ""), i, n = 0, u = 0; for (i = 0; i < s.length - 1; i++) A[s.substr(i, 2)] = 1; for (i = 0; i < t.length - 1; i++) B[t.substr(i, 2)] = 1; for (i in A) { u++; if (B[i]) n++; } for (i in B) if (!A[i]) u++; return u ? n / u : 0; }
/* 목록 비교: Claude 항목마다 규칙 항목과 가장 비슷한 것을 찾아 유지 · 수정 · 추가 */
function uxListDiff(base, next) {
  base = (base || []).map(String); next = (next || []).map(String); var used = {};
  var rows = next.map(function (x) { var best = -1, bs = 0; base.forEach(function (b, i) { if (used[i]) return; var s = uxSim(x, b); if (s > bs) { bs = s; best = i; } }); if (best >= 0 && bs >= 0.6) { used[best] = 1; return { t: x, st: "same" }; } if (best >= 0 && bs >= 0.25) { used[best] = 1; return { t: x, st: "edit", from: base[best] }; } return { t: x, st: "add" }; });
  base.forEach(function (b, i) { if (!used[i]) rows.push({ t: b, st: "drop" }); });
  return rows;
}
var UX_ST = { same: ["유지", "#6b7280"], edit: ["수정", "#b9600f"], add: ["추가", "#1d7f55"], drop: ["빠짐", "#9ca3af"] };
function uxListHtml(rows, baseSet) { return '<ul class="uxList">' + rows.map(function (r) { var st = UX_ST[r.st]; return '<li class="' + r.st + '"><i style="background:' + st[1] + '">' + st[0] + '</i><span>' + (r.st === "drop" ? '<s>' + uxEsc(r.t) + '</s>' : uxMarkNew(r.t, baseSet).html) + '</span>' + (r.from ? '<small>← ' + uxEsc(r.from) + '</small>' : '') + '</li>'; }).join("") + '</ul>'; }

/* ---------- 리포트: 무엇이 보완됐나 ---------- */
function uxRpDiffHtml(rp, V, ai) {
  var NR = null; try { NR = rpNarrative(rp); } catch (e) {}
  var plain = function (t) { return String(t || "").replace(/\s?\[E\d+\]/g, ""); };
  var baseTxt = [rp.title, rp.situation.join("\n"), rp.view.txt, rp.view.why.join("\n"), rp.view.plan.join("\n"), rp.watch.join("\n")].concat(rpAiLines(rp).map(function (l) { return l.text; }), NR ? [NR.one, NR.numbers, NR.story, NR.both, NR.so] : [], rp.scen.map(function (s) { return s.txt; })).join("\n");
  var base = uxNumSet(baseTxt), newN = 0, row = function (label, a, b, opt) {
    if (!b) return ""; var M = uxMarkNew(b, base); newN += M.n;
    var same = a && uxSim(a, b) >= 0.6;
    return '<div class="uxRow' + (same ? ' same' : '') + '"><div class="uxRowL">' + label + (same ? ' <em>거의 같음</em>' : '') + '</div><div class="uxCols"><div class="uxA"><small>규칙 초안</small>' + (a ? uxEsc(a) : '<span class="briefDim">없음</span>') + '</div><div class="uxB"><small>Claude</small>' + (opt && opt.html ? opt.html : M.html) + '</div></div></div>';
  };
  var h = "";
  h += row("제목", rp.title, V.headline);
  h += row("상황", rp.situation.join(" "), V.situation);
  if (V.narrative) { var ps = V.narrative.split(/\n{2,}/).filter(Boolean), bs = NR ? [plain(NR.one), plain(NR.numbers), plain(NR.story), plain(NR.both), plain(NR.so)] : []; h += ps.map(function (p, i) { return row("해석 " + (i + 1) + "/" + ps.length, bs[i] || "", p); }).join(""); }
  h += row("의견", rp.view.txt, V.opinion);
  if (V.forecast) rp.scen.forEach(function (s) { if (V.forecast[s.name]) h += row("시나리오 · " + s.name, s.txt, V.forecast[s.name]); });
  var pl = uxListDiff(rp.view.plan, V.plan || []), wt = uxListDiff(rp.watch, V.watch || []);
  var cnt = function (rows) { var c = { add: 0, edit: 0, same: 0, drop: 0 }; rows.forEach(function (r) { c[r.st]++; }); return c; }, cp = cnt(pl), cw = cnt(wt);
  if (V.plan && V.plan.length) h += '<div class="uxRow"><div class="uxRowL">행동안 <em>추가 ' + cp.add + ' · 수정 ' + cp.edit + ' · 유지 ' + cp.same + (cp.drop ? ' · 빠짐 ' + cp.drop : '') + '</em></div>' + uxListHtml(pl, base) + '</div>';
  if (V.watch && V.watch.length) h += '<div class="uxRow"><div class="uxRowL">생각을 바꿀 조건 <em>추가 ' + cw.add + ' · 수정 ' + cw.edit + ' · 유지 ' + cw.same + (cw.drop ? ' · 빠짐 ' + cw.drop : '') + '</em></div>' + uxListHtml(wt, base) + '</div>';
  if (V.interpretation && V.interpretation.length) h += '<div class="uxRow"><div class="uxRowL">Exhibit 해석 <em>Claude가 새로 쓴 ' + V.interpretation.length + '줄</em></div><ul class="uxList">' + V.interpretation.map(function (x) { var M = uxMarkNew(x, base); newN += M.n; return '<li class="add"><i style="background:#1d7f55">추가</i><span>' + M.html + '</span></li>'; }).join("") + '</ul></div>';
  if (V.added && V.added.length) h += '<div class="uxRow"><div class="uxRowL">웹에서 보완한 사실 <em>' + V.added.length + '건 — 출처와 날짜 확인</em></div><ul class="uxList">' + V.added.map(function (x) { return '<li class="add"><i style="background:#1f3a68">보완</i><span>' + uxEsc(x) + '</span></li>'; }).join("") + '</ul></div>';
  var sum = '<span class="uxChip">보완 사실 ' + ((V.added || []).length) + '</span><span class="uxChip ' + (newN ? 'warn' : '') + '">앱에 없던 숫자 ' + newN + '</span><span class="uxChip">행동안 +' + cp.add + ' / 수정 ' + cp.edit + '</span><span class="uxChip">조건 +' + cw.add + ' / 수정 ' + cw.edit + '</span>';
  return '<details class="uxDiff"' + (ai && ai._diffSeen ? '' : ' open') + '><summary><b>무엇이 보완됐나</b> <span class="briefDim">규칙 초안 ↔ Claude 서술</span> <span class="uxChips">' + sum + '</span></summary><div class="uxDiffHint">초록 <mark class="uxNew">표시</mark>는 앱 근거 줄에 없던 숫자예요 — 웹에서 보완된 것이라 올리기 전에 출처를 한 번 확인하세요. 회색 “거의 같음”은 뜻이 그대로인 줄이에요.</div>' + h + '</details>';
}
function uxTag(el, src, where) { if (!el || el.querySelector(":scope > .uxSrc")) return; var t = document.createElement("span"); t.className = "uxSrc " + (src === "Claude" ? "c" : "r"); t.textContent = src; if (where === "prepend") el.insertBefore(t, el.firstChild); else el.appendChild(t); }
function uxRpDecorate() {
  var pane = document.getElementById("rpPane"), rp = RP.cur, ai = RP.ai; if (!pane || !rp) return;
  var V = ai && ai.ok ? ai.out : null, isC = !!(V && ai.claude);
  var head = pane.querySelector(".rpHead"); if (!head) return;
  // 어느 칸이 Claude 글인지 꼬리표
  var h3 = head.querySelector("h3"); if (h3) uxTag(h3, isC && V.headline ? "Claude" : "규칙");
  var st = pane.querySelector(".rpStance .rpStT"); if (st) uxTag(st, isC && V.opinion ? "Claude" : "규칙");
  Array.prototype.forEach.call(pane.querySelectorAll(".mkStep"), function (m) { var t = m.textContent; if (/그래서 어떻게/.test(t)) uxTag(m, isC && V.plan && V.plan.length ? "Claude" : "규칙"); if (/생각을 바꿀 조건/.test(t)) uxTag(m, isC && V.watch && V.watch.length ? "Claude" : "규칙"); if (/앞으로 1년/.test(t)) uxTag(m, isC && V.forecast && Object.keys(V.forecast).length ? "Claude" : "규칙"); });
  var nar = pane.querySelector(".rpNar .rpNarT"); if (nar) uxTag(nar, "Claude"); var nr = pane.querySelector(".rpNarr, .rpStory"); if (nr && !isC) uxTag(nr, "규칙", "prepend");
  // 보완 패널
  if (isC && !pane.querySelector(".uxDiff")) { var d = document.createElement("div"); d.innerHTML = uxRpDiffHtml(rp, V, ai); var el = d.firstChild; head.parentNode.insertBefore(el, head.nextSibling); el.addEventListener("toggle", function () { ai._diffSeen = true; }); if (!ai._diffSeen) setTimeout(function () { ai._diffSeen = true; }, 1500); }
  // 순서 표시 — rpBar 버튼에 ✓(했음) · 지금(다음 할 일) 표시, 다음 안내 한 줄
  var bar = pane.querySelector(".rpBar"); if (bar && !bar.querySelector(".uxRailNext")) {
    var saved = (RP.saved || []).some(function (s) { return s.id === rp.id + ":" + rp.made.slice(0, 10); });
    var st = { claude: isC, deck: !!rp._deckMade, save: saved, thread: !!rp._thrMade }, order = ["claude", "deck", "save"], nx = order.filter(function (k) { return !st[k]; })[0];
    Array.prototype.forEach.call(bar.querySelectorAll("[data-rpa]"), function (b) { var k = b.getAttribute("data-rpa"); if (!(k in st)) return; b.classList.toggle("uxDone", st[k]); b.classList.toggle("uxNow", nx === k); var i = b.querySelector("i"); if (i && st[k]) i.textContent = "✓"; if (k === "thread" && st[k] && !b.querySelector("i")) b.insertAdjacentHTML("afterbegin", "<i>✓</i>"); });
    var nxt = document.createElement("span"); nxt.className = "uxRailNext"; nxt.textContent = nx ? "다음: " + { claude: "Claude 서술 (프롬프트 복사)", deck: "카드 덱 만들기", save: "저장 · 3개월 뒤 채점" }[nx] : "오늘 순서 끝 ✓ · 스레드 글은 선택"; bar.querySelector(".rpBarMain").appendChild(nxt);
  }
}
(function () {
  if (typeof renderReport !== "function") return;
  var r0 = renderReport; renderReport = function () { var r = r0.apply(this, arguments); try { uxRpDecorate(); } catch (e) { console.warn("ux rp", e); } return r; };
  if (typeof rpAction === "function") { var a0 = rpAction; rpAction = function (a, btn) { if (a === "claude" && RP.cur && typeof rpxOpen === "function") return rpxOpen(RP.cur); if (a === "thread" && RP.cur) { RP.cur._thrMade = true; return uxThreadOpen(RP.cur); } if (a === "deck" && RP.cur) RP.cur._deckMade = true; var r = a0.apply(this, arguments); if (a === "save") setTimeout(function () { try { uxRpDecorate(); var old = document.querySelector("#rpPane .uxRail"); if (old) { old.remove(); uxRpDecorate(); } } catch (e) {} }, 300); return r; }; }
})();

/* ---------- 리포트 스레드 글: 본문 + 주제별 답글 (uphill.lab 반응 좋았던 뼈대: 질문 → 숫자 5줄 → 해석 1~2줄 / 답글 1 반대 숫자·한계 / 답글 2 질문) ---------- */
/* 스레드 숫자 줄: Exhibit마다 첫 데이터 항목(이름 + 값) — '고점 대비 -3.2%'처럼 읽히게 */
function uxExLines(rp) {
  var L = []; rp.exhibits.forEach(function (e) {
    var d = e.data || [], x = d[0]; if (!x) { L.push(e.title + " " + e.big); return; }
    if (e.kind === "rows") { if (/^[\d.]/.test(String(x[0]))) return; L.push(x[0] + " " + x[2]); } else if (e.kind === "tiles") L.push((/샀다면/.test(e.title) && /^\d/.test(x.l) ? "비슷한 위치에서 산 뒤 " : "") + x.l + " " + x.v); else L.push(x.l + " " + (x.txt || (typeof rpPct === "function" ? rpPct(x.v, 1) : x.v)));
  });
  L = L.filter(function (l) { return /\d/.test(l); });
  if (L.length < 3) rp.exhibits.forEach(function (e) { if (L.length < 3 && e.big && /\d/.test(e.big)) L.push(e.title.replace(/ — .*$/, "") + " " + e.big); });
  return L;
}
function uxThreadSeries(rp) {
  var ai = RP.ai, V = ai && ai.ok && ai.claude ? ai.out : null, NR = null; try { NR = rpNarrative(rp); } catch (e) {}
  var plain = function (t) { return thrNoEmoji(String(t || "").replace(/\s?\[E\d+\]/g, "")).trim(); }, sent = function (t, n) { return thrSent(plain(t), n || 2); };
  var paras = V && V.narrative ? V.narrative.split(/\n{2,}/).map(plain).filter(Boolean) : [];
  var nums = thrData(uxExLines(rp));
  var interp = V ? (V.headline && V.headline !== rp.title ? V.headline + ". " : "") + sent(paras[0] || V.opinion, 2) : sent(NR ? NR.one : rp.situation[0], 2);
  var foot = "(" + rp.asOf + " 종가 기준 · 개인 분석이며 투자 권유 아님)";
  var th = thrFit([rp.title, nums.join("\n"), interp, foot].filter(Boolean).join("\n\n"));
  // 답글 1 · 근거 — 숫자 뒤의 속사정 + Exhibit 읽기
  var r1 = thrFit(["근거부터요.", (paras[2] || paras[1] || (NR ? plain(NR.story) : "")), rp.exhibits.slice(0, 3).map(function (e) { return "· " + plain(e.read).split(/(?<=[.?!])\s+/)[0]; }).join("\n")].filter(Boolean).join("\n\n"));
  // 답글 2 · 반대쪽 — 반론 · 하락 근거 기사 · 최악의 경우
  var worst = rp.scen.filter(function (s) { return /하락/.test(s.name); })[0];
  var r2 = thrFit(["반대쪽 숫자도 적어둘게요.", rp.counter && rp.counter.txt ? plain(rp.counter.txt) : (paras[3] || (NR ? plain(NR.both) : "")), rp.exp && rp.exp.bear.length ? rp.exp.bear.slice(0, 2).map(function (x) { return "▼ " + plain(x.t); }).join("\n") : "", worst ? "과거 비슷한 상황에서 " + worst.name + " " + Math.round(worst.p * 100) + "% (" + worst.range + ")" : "", "지난 10년은 대체로 오른 시기라, 다른 시기였다면 숫자가 달랐을 수 있어요."].filter(Boolean).join("\n\n"));
  // 답글 3 · 그래서 — 의견 + 행동안 + 생각을 바꿀 조건
  var plan = (V && V.plan && V.plan.length ? V.plan : rp.view.plan).slice(0, 3), watch = (V && V.watch && V.watch.length ? V.watch : rp.watch).slice(0, 3);
  var r3 = thrFit(["그래서 — " + rp.view.stance, sent(V ? V.opinion : rp.view.txt, 2), plan.map(function (p) { return "· " + plain(p); }).join("\n"), "생각을 바꿀 조건\n" + watch.map(function (w) { return "· " + plain(w); }).join("\n")].filter(Boolean).join("\n\n"));
  var r4 = thrFit(thrAsk(0) + "\n\n" + THR_APP);
  return [{ k: "본문", h: "첫 줄이 피드에 보여요 — 질문 · 숫자 · 해석", t: th }, { k: "답글 1 · 근거", h: "숫자 뒤의 속사정", t: r1 }, { k: "답글 2 · 반대쪽", h: "반론 · 한계로 신뢰 확보", t: r2 }, { k: "답글 3 · 그래서", h: "의견 · 행동안 · 바꿀 조건", t: r3 }, { k: "답글 4 · 질문", h: "자기 노출 없이 답할 질문 하나", t: r4 }];
}
function uxThreadOpen(rp) {
  var T = uxThreadSeries(rp), box = document.createElement("div");
  var all = T.map(function (p) { return "[" + p.k + "]\n" + p.t; }).join("\n\n──────\n\n");
  box.innerHTML = '<div class="uxThrTop"><div class="briefDim">본문 1개 + 주제별 답글 4개 — 번호가 아니라 <b>근거 · 반대쪽 · 그래서 · 질문</b>으로 묶었어요. 전부 500자 안.</div><div class="anActs"><button class="primary" data-uxall>📋 전체 복사 (구분선 포함)</button><button class="chip" data-uxig>인스타 캡션 복사</button></div></div>' +
    T.map(function (p, i) { return '<div class="thrPart"><div class="thrLbl"><b>' + uxEsc(p.k) + '</b><em>' + uxEsc(p.h) + '</em><span class="thrCnt">' + p.t.length + ' / 500자</span><button class="chip thrCopy">복사</button></div><textarea class="thrText' + (i ? ' sm' : '') + '" spellcheck="false">' + uxEsc(p.t) + '</textarea></div>'; }).join("");
  Array.prototype.forEach.call(box.querySelectorAll(".thrPart"), function (pt) { var ta = pt.querySelector("textarea"), c = pt.querySelector(".thrCnt"); ta.oninput = function () { c.textContent = ta.value.length + " / 500자"; c.style.color = ta.value.length > 500 ? "var(--up)" : ""; }; pt.querySelector(".thrCopy").onclick = function () { chCopy(ta.value, this); }; });
  box.querySelector("[data-uxall]").onclick = function () { var tas = box.querySelectorAll("textarea"); chCopy(Array.prototype.map.call(tas, function (ta, i) { return "[" + T[i].k + "]\n" + ta.value; }).join("\n\n──────\n\n"), this); };
  box.querySelector("[data-uxig]").onclick = function () { chCopy(rpCaption(rp), this); };
  if (typeof infoModal !== "undefined") infoModal.open("스레드 글 · " + rp.title, box);
}

/* ---------- 분석 화면: 단계 레일 + 새 숫자 표시 ---------- */
function uxAnRail(root) {
  var secs = root.querySelectorAll(".anSec"); if (secs.length < 5) return;
  var ready = !!(AN.sym && AN.out && AN.outKey === (AN.mod + ":" + AN.sym)), mine = (typeof anAnsLoad === "function" ? anAnsLoad() : []).filter(function (a) { return a.sym && a.sym === AN.sym; });
  var cur = mine.filter(function (a) { return a.id === AN.ansId; })[0] || mine[0], J = cur && typeof anxSumParse === "function" ? anxSumParse(cur.text || "") : null;
  var steps = [{ n: "종목", done: !!AN.sym }, { n: "앱 데이터", done: ready }, { n: "프롬프트", done: !!(ANX && ANX.prompt) }, { n: "답변 저장", done: mine.length > 0 }, { n: "요약", done: !!J }, { n: "카드", done: !!(cur && cur._deck), opt: true }];
  var nx = steps.filter(function (s) { return !s.done && !s.opt; })[0];
  var old = root.querySelector(".uxRail"); if (old) old.remove();
  var r = document.createElement("div"); r.className = "uxRail an";
  r.innerHTML = steps.map(function (s, i) { return '<button data-sec="' + i + '" class="' + (s.done ? "done" : nx === s ? "now" : "") + '"><i>' + (s.done ? "✓" : i + 1) + '</i>' + s.n + '</button>'; }).join('<em>›</em>') + '<span class="uxRailNext">' + (nx ? '다음: ' + nx.n + (nx.n === "프롬프트" ? " 복사 → claude.ai" : nx.n === "답변 저장" ? " — 답변 전체를 ④에" : "") : '요약까지 끝 ✓ · 🃏 카드로') + '</span>';
  root.insertBefore(r, root.firstChild);
  Array.prototype.forEach.call(r.querySelectorAll("[data-sec]"), function (b) { b.onclick = function () { var s = secs[Math.min(+b.getAttribute("data-sec"), 4)]; if (s) try { s.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }; });
  var now = r.querySelector(".now"); if (now) try { now.scrollIntoView({ inline: "center", block: "nearest" }); } catch (e) {}
}
(function () {
  if (typeof renderAnalyst !== "function") return;
  var r0 = renderAnalyst; renderAnalyst = function () { var r = r0.apply(this, arguments); try { var root = document.getElementById("anBody"); if (root) uxAnRail(root); } catch (e) { console.warn("ux an", e); } return r; };
})();

/* ---------- 운영 흐름 바: 만들기 소단계(카드 · 리포트 · 분석) + 문구 최신화 ---------- */
(function () {
  if (typeof SM_FLOW === "undefined") return;
  SM_FLOW.forEach(function (s) { if (s.k === "make") s.hint = "편성 순서대로 카드 → 리포트(Claude 서술은 프롬프트 복사) → 분석(6틀 프롬프트 복사 → 답변 저장)"; if (s.k === "pub") s.hint = "작업실 ④에서 발행 묶음 ZIP · 텔레그램 글 복사 → 직접 올리기"; });
  if (typeof smFlowPaint !== "function") return;
  var p0 = smFlowPaint; smFlowPaint = function () {
    var r = p0.apply(this, arguments);
    try {
      var el = document.getElementById("smFlow"); if (!el || el.style.display === "none") return r;
      var tab = typeof currentTab !== "undefined" ? currentTab : "", day = smKstDay();
      var made = typeof smDoneFor === "function" ? smDoneFor(smMk()).length : 0;
      var rpN = (RP && RP.saved || []).filter(function (s) { return String(s.made || "").slice(0, 10) === day; }).length;
      var anN = (typeof arcItems === "function" ? arcItems() : []).filter(function (a) { return new Date(a.at + 9 * 3600e3).toISOString().slice(0, 10) === day; }).length;
      var subs = [["onecard", "카드", made], ["report", "리포트", rpN], ["analyst", "분석", anN]];
      var old = el.querySelector(".uxSub"); if (old) old.remove();
      if (["onecard", "report", "analyst"].indexOf(tab) < 0) return r;
      var d = document.createElement("div"); d.className = "uxSub"; d.innerHTML = '<span class="briefDim">만들기 ·</span>' + subs.map(function (s) { return '<button data-ux="' + s[0] + '" class="' + (tab === s[0] ? "on" : "") + (s[2] ? " done" : "") + '">' + s[1] + (s[2] ? ' <i>' + s[2] + '</i>' : '') + '</button>'; }).join('<em>›</em>') + '<span class="briefDim uxSubHint">오늘 만든 수 · 순서는 왼쪽부터</span>';
      el.appendChild(d); Array.prototype.forEach.call(d.querySelectorAll("[data-ux]"), function (b) { b.onclick = function () { navTo(b.getAttribute("data-ux")); }; });
    } catch (e) { console.warn("ux flow", e); }
    return r;
  };
})();

/* ---------- 스타일 (모바일 포함) ---------- */
(function () { var st = document.createElement("style"); st.textContent = [
".uxRail{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none;padding:6px 8px;margin:0 0 10px;background:#fff;border:1px solid var(--line,#e5e7eb);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.04)}.uxRail::-webkit-scrollbar{display:none}",
".uxRail button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;padding:5px 8px;border-radius:999px;font-size:12.5px;white-space:nowrap;color:var(--sub,#667);cursor:pointer}.uxRail button i{font-style:normal;display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#eee;font-size:11px;font-weight:800}",
".uxRail button.done{color:#8a6d2b}.uxRail button.done i{background:#c9a24f;color:#fff}.uxRail button.now{background:#14161c;color:#fff;font-weight:700}.uxRail button.now i{background:#e6c57a;color:#14161c}.uxRail em{color:#ccc;font-style:normal}.uxRailNext{margin-left:auto;font-size:12px;color:#1f3a68;white-space:nowrap;padding-left:8px}",
".uxSub{display:flex;align-items:center;gap:4px;margin-top:6px;padding-top:6px;border-top:1px dashed #e6d3a3;font-size:12.5px;overflow-x:auto;scrollbar-width:none}.uxSub button{border:0;background:transparent;padding:4px 8px;border-radius:999px;color:var(--sub,#667);cursor:pointer;white-space:nowrap}.uxSub button.on{background:#14161c;color:#fff}.uxSub button.done:not(.on){color:#8a6d2b}.uxSub button i{font-style:normal;background:#c9a24f;color:#fff;border-radius:8px;padding:0 5px;font-size:11px;margin-left:2px}.uxSub em{color:#ccc;font-style:normal}.uxSubHint{margin-left:auto;font-size:11px;white-space:nowrap}",
".uxSrc{display:inline-block;font-size:10px;font-weight:700;border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:middle;letter-spacing:.2px}.uxSrc.c{background:#f3e7c4;color:#7a5520}.uxSrc.r{background:#eef0f4;color:#667}",
".uxDiff{margin:8px 0 12px;border:1px solid #e6d3a3;border-radius:14px;background:#fffdf7;padding:0 12px 4px}.uxDiff summary{cursor:pointer;padding:10px 0;font-size:13.5px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}.uxChips{display:flex;gap:4px;flex-wrap:wrap}.uxChip{font-size:11px;background:#eef0f4;border-radius:8px;padding:2px 7px;color:#445}.uxChip.warn{background:#fdecd6;color:#b9600f}",
".uxDiffHint{font-size:12px;color:#667;margin:0 0 8px}.uxRow{border-top:1px solid #f0e7d2;padding:8px 0}.uxRow.same{opacity:.7}.uxRowL{font-size:12.5px;font-weight:700;color:#1f3a68;margin-bottom:4px}.uxRowL em{font-style:normal;font-weight:400;color:#889;font-size:11.5px;margin-left:6px}",
".uxCols{display:grid;grid-template-columns:1fr 1fr;gap:8px}.uxA,.uxB{font-size:12.5px;line-height:1.5;border-radius:10px;padding:8px 10px}.uxA{background:#f4f6fb;color:#556}.uxB{background:#fff;border:1px solid #e6d3a3}.uxA small,.uxB small{display:block;font-size:10.5px;font-weight:700;color:#99a;margin-bottom:3px}.uxB small{color:#b08a3a}",
"mark.uxNew{background:#d9f4e5;color:#0f5a3a;border-radius:4px;padding:0 3px;font-weight:700}",
".uxList{list-style:none;margin:0;padding:0}.uxList li{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;padding:4px 0;border-top:1px dashed #eee}.uxList li:first-child{border-top:0}.uxList li i{flex:none;font-style:normal;font-size:10.5px;color:#fff;border-radius:6px;padding:1px 6px;margin-top:2px}.uxList li small{display:block;color:#99a;font-size:11px}.uxList li.drop{opacity:.6}",
".rpBar{position:sticky;top:0;z-index:5;background:#fff;padding:6px 0 4px;margin:0 0 10px}.rpBarMain button.uxDone{opacity:.85}.rpBarMain button.uxDone i{background:#c9a24f!important;color:#fff!important}.rpBarMain button.uxNow{box-shadow:0 0 0 2px #e6c57a}.rpBarMain .uxRailNext{flex-basis:100%;margin-left:0;padding:2px 2px 0}.rpBarSub button i{font-style:normal;margin-right:4px;color:#c9a24f}",
".opsT{display:block;overflow-x:auto;max-width:100%}@media(max-width:640px){.opsT{-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}.opsT:before{content:'옆으로 밀면 더 있어요 →';display:block;font-size:11px;color:#8a6d2b;padding:2px 0 4px}}",
".uxThrTop{margin-bottom:6px}.uxThrTop .anActs{margin-top:6px}.thrLbl em{font-style:normal;font-size:11px;color:#b9b3a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
/* 모바일 */
"@media(max-width:640px){.smFlowHint{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11.5px}.smFlow{padding:6px 8px}.uxCols{grid-template-columns:1fr}.uxRailNext{display:none}.uxRail{top:0;margin-left:-4px;margin-right:-4px;border-radius:10px}.uxSubHint{display:none}",
".rpBarMain,.rpBarSub,.anActs{gap:6px}.rpBarMain button,.anActs>button.primary{flex:1 1 46%;justify-content:center;min-height:40px}.rpBarSub button{flex:1 1 30%;justify-content:center}",
".anAnsIn,.thrText,.anxPv textarea{font-size:14px}.anxFrames{grid-template-columns:1fr 1fr}.anxSteps>div{flex:1 1 100%}",
".modalBox{max-width:none;width:100%;height:100%;max-height:100dvh;border-radius:0;padding:16px 14px 70px;overflow:auto}.modalBox .modalClose{position:fixed;left:12px;right:12px;bottom:12px;z-index:2}",
".mkTabs,.rpTabs,.pills{overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;-webkit-overflow-scrolling:touch}.mkTabs button,.rpTabs button{white-space:nowrap;flex:none}",
".thrGrid{grid-template-columns:1fr}.rpTiles{grid-template-columns:repeat(2,1fr)}.hubActs .chip,.perRow .primary{min-height:36px}",
"#rpBody,#anBody,#ocBody,#opsBody{overflow-x:hidden}.rpEx,.anSec,.anxHero,.uxDiff{max-width:100%;box-sizing:border-box}textarea{max-width:100%}}",
"[data-theme=dark] .rpBar{background:#1b2130}[data-theme=dark] .uxRail{background:#1b2130;border-color:#2b3447}[data-theme=dark] .uxB{background:#1e2533;color:#dde}[data-theme=dark] .uxA{background:#232a38;color:#bbc}[data-theme=dark] .uxDiff{background:#1b2130}"
].join(""); document.head.appendChild(st); })();

/* ============================================================ v12.72 카드 작업대 · 작업실: '오늘 이슈'(매일 새로 생기는 것) vs '오늘 카드'(매일 올릴 수 있는 것) 두 묶음으로 ============================================================ */
var UX_ISSUE_RE = /^(issues|hub:news|hub:vol|hub:sector|story:news|story:kr-news|story:kr-sector|story:kr-flow|story:us-sector|report:)/;
function uxCatOf(ctx, text) { return UX_ISSUE_RE.test(String(ctx || "")) || /이슈|급등|급락|뉴스|기사|수급|거래대금|주도 섹터/.test(String(text || "")) ? "issue" : "card"; }
function uxSplitMaker(root) {
  var grid = root.querySelector(".wbGrid"); if (!grid || grid.querySelector(".uxCatH")) return;
  var rows = Array.prototype.slice.call(grid.querySelectorAll(".wbRow")), blocks = { issue: [], card: [] }, cnt = { issue: 0, card: 0 };
  rows.forEach(function (r) {
    var label = r.querySelector(".wbRowL"), chips = Array.prototype.slice.call(r.querySelectorAll(".wbChip")), lt = label ? label.textContent : "";
    if (/오늘 추천/.test(lt)) { blocks.issue.unshift(r); return; }   // 추천 줄은 위에 그대로
    var parts = { issue: [], card: [] }; chips.forEach(function (c) { parts[uxCatOf(c.getAttribute("data-wsel"), c.textContent + " " + lt)].push(c); });
    ["issue", "card"].forEach(function (k) { if (!parts[k].length) return; var nr = document.createElement("div"); nr.className = "wbRow"; nr.innerHTML = '<div class="wbRowL">' + escapeHtml(lt) + '</div><div class="wbRowC"></div>'; var cc = nr.querySelector(".wbRowC"); parts[k].forEach(function (c) { cc.appendChild(c); }); blocks[k].push(nr); cnt[k] += parts[k].length; });
    r.remove();
  });
  var mk = function (k, title, sub) { var h = document.createElement("div"); h.className = "wbRow uxCatH " + k; h.innerHTML = '<div class="wbRowL">' + title + '</div><div class="wbRowC"><span>' + sub + ' · <b>' + cnt[k] + '</b>개</span></div>'; return h; };
  grid.innerHTML = "";
  grid.appendChild(mk("issue", "🔥 오늘 이슈", "매일 새로 생기는 것 — 핵심 이슈 · 급등락 · 기사 · 수급 · 주도 섹터 · 리포트")); blocks.issue.forEach(function (r) { grid.appendChild(r); });
  grid.appendChild(mk("card", "🗂️ 오늘 카드", "매일 올릴 수 있는 것 — 데일리 · 마감 한 장 · 관찰 · 데이터 시리즈 · 정기 발행 · 용어·일정")); blocks.card.forEach(function (r) { grid.appendChild(r); });
}
(function () {
  if (typeof makerRender === "function") { var m0 = makerRender; makerRender = function () { var r = m0.apply(this, arguments); try { var root = document.getElementById("mkBody"); if (root) uxSplitMaker(root); } catch (e) { console.warn("ux maker", e); } return r; }; }
  if (typeof renderOps === "function") { var o0 = renderOps; renderOps = function () { var r = o0.apply(this, arguments); try { Array.prototype.forEach.call(document.querySelectorAll('#opsBody button[data-ops^="make:"], #opsBody button[data-ops^="report:"]'), function (b) { if (b.querySelector(".uxTag")) return; var ctx = b.getAttribute("data-ops").replace(/^make:/, ""), k = uxCatOf(ctx, b.textContent); var t = document.createElement("i"); t.className = "uxTag " + k; t.textContent = k === "issue" ? "이슈" : "카드"; b.insertBefore(t, b.firstChild); }); } catch (e) {} return r; }; }
  var st = document.createElement("style"); st.textContent = ".wbRow.uxCatH{background:#14161c;color:#f3efe6}.wbRow.uxCatH .wbRowL{color:#e6c57a;font-weight:800;border-right-color:#333}.wbRow.uxCatH .wbRowC{padding:8px 10px;font-size:12px;color:#c9c4b8}.wbRow.uxCatH.card{background:#1f2a44}.uxTag{font-style:normal;font-size:10px;font-weight:800;border-radius:5px;padding:1px 5px;margin-right:5px;vertical-align:1px;background:#fcefef;color:#c03b3b}.uxTag.card{background:#eef2fa;color:#1f3a68}"; document.head.appendChild(st);
})();

/* ============================================================ v12.77 카드 작업대 즐겨찾기 — 주제 + 모양(분량·크기·그리기·자료)을 저장, '오늘 편성'보다 위에 크게. 서버(kv cfg:fav)에도 같이 둔다 ============================================================ */
var FAV = { list: null, synced: false };
function favLoad() { if (FAV.list) return FAV.list; try { FAV.list = JSON.parse(localStorage.getItem("sm.fav") || "[]"); } catch (e) { FAV.list = []; } if (!Array.isArray(FAV.list)) FAV.list = []; return FAV.list; }
function favSave() { try { localStorage.setItem("sm.fav", JSON.stringify(FAV.list)); } catch (e) {} if (typeof smKvPut === "function") smKvPut("cfg:fav", { list: FAV.list, at: Date.now() }, 365 * 86400).catch(function () {}); }
function favSync() { if (FAV.synced || typeof smKvGet !== "function") return; FAV.synced = true; smKvGet("cfg:fav").then(function (r) { if (r && Array.isArray(r.list) && r.list.length && (!favLoad().length || (r.at || 0) > (FAV.at || 0))) { FAV.list = r.list; FAV.at = r.at; try { localStorage.setItem("sm.fav", JSON.stringify(FAV.list)); } catch (e) {} if (currentTab === "onecard" && typeof makerRender === "function") makerRender(); } }); }
function favKey(f) { return f.ctx + "|" + f.n + "|" + f.size + "|" + f.draw + "|" + f.src; }
function favCur() { if (!MK.sel) return null; var cap = MK._cap[MK.sel + "|" + MK.size], sh = typeof mkShapeFor === "function" ? mkShapeFor(MK.sel, cap) : MK.shape, t = typeof hubTitleOf === "function" ? hubTitleOf(MK.sel) : MK.sel; return { ctx: MK.sel, n: sh.n, size: MK.size === "reel" ? "reel" : "post", draw: sh.draw, src: sh.src || "app", t: t, mk: MK.mk || "all", at: Date.now() }; }
function favHas(f) { var k = favKey(f); return favLoad().some(function (x) { return favKey(x) === k; }); }
function favToggle(f) { var k = favKey(f), L = favLoad(), i = L.findIndex(function (x) { return favKey(x) === k; }); if (i >= 0) L.splice(i, 1); else L.unshift(f); FAV.list = L.slice(0, 24); FAV.at = Date.now(); favSave(); }
function favShapeTxt(f) { return [f.n === "one" ? "한 장" : "여러 장", f.size === "reel" ? "릴스 9:16" : "게시 4:5", { app: "우리 양식", ai1: "AI 한 장", aiN: "AI 여러 장" }[f.draw] || f.draw, f.src === "today" ? "오늘 자료 취합" : "기존 데이터"].join(" · "); }
function favRun(f, btn) {
  MK.sel = f.ctx; MK.size = f.size; try { localStorage.setItem("sm.cardSize", f.size); } catch (e) {} MK.shapeBy[f.ctx] = { n: f.n, draw: f.draw, src: f.src }; if (f.mk && f.mk !== MK.mk && typeof MK !== "undefined") { MK.mk = f.mk; MK._T = null; if (typeof smSetMk === "function") try { smSetMk(f.mk); } catch (e) {} }
  makerRender(); var b = document.querySelector("#mkBody [data-make]"); if (b && !b.disabled) { mkMakeGo(f.ctx, b); setTimeout(function () { var r = document.querySelector("#mkResult"); if (r) try { r.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }, 400); } else { smToast("모양을 확인하는 중이에요 — 잠시 뒤 ③ 만들기를 눌러 주세요"); }
}
function favHtml() {
  var L = favLoad(), done = {}; (typeof hubDoneLoad === "function" ? hubDoneLoad() : []).forEach(function (d) { done[d.ctx] = 1; });
  var cards = L.map(function (f, i) { return '<div class="favCard' + (done[f.ctx] ? " done" : "") + (f.ctx === MK.sel ? " on" : "") + '" data-favi="' + i + '"><div class="favT"><i>★</i><b>' + escapeHtml(typeof hubTitleOf === "function" ? hubTitleOf(f.ctx) : f.t) + '</b>' + (done[f.ctx] ? '<em>오늘 만듦 ✓</em>' : '') + '</div><div class="favS">' + escapeHtml(favShapeTxt(f)) + '</div><div class="favMk">' + [["all", "전체"], ["kr", "국내"], ["us", "미국"], ["coin", "코인"]].map(function (m) { return '<button data-favmk="' + i + ':' + m[0] + '" class="' + ((f.mk || "all") === m[0] ? "on" : "") + '">' + m[1] + '</button>'; }).join("") + '<small>어느 시장 데이터로 만들지</small></div><div class="favA"><button class="primary" data-favgo="' + i + '">▶ 이 모양으로 바로 만들기</button><button class="chip" data-favsel="' + i + '">모양 보기</button><button class="chip favX" data-favdel="' + i + '" title="즐겨찾기에서 빼기">✕</button></div></div>'; }).join("");
  return '<section class="wbFav"><div class="wbTodayH"><b>★ 즐겨찾기</b><small>매일 꼭 만드는 카드 — 주제 + 모양이 저장돼 한 번에 만들어져요 · ' + L.length + '개</small></div>' + (L.length ? '<div class="favGrid">' + cards + '</div>' : '<div class="favEmpty">아직 없어요 — 아래에서 주제를 고르고 ② 모양을 정한 뒤 <b>☆ 즐겨찾기에 추가</b>를 누르면 여기에 가장 크게 올라와요. 오늘 편성보다 먼저 보여요.</div>') + '</section>';
}
(function () {
  if (typeof makerRender !== "function") return;
  var m0 = makerRender; makerRender = function () {
    var r = m0.apply(this, arguments);
    try {
      favSync();
      var root = document.getElementById("mkBody"); if (!root || root.querySelector(".wbFav")) return r;
      var today = root.querySelector(".wbToday"); if (today) { var d = document.createElement("div"); d.innerHTML = favHtml(); today.parentNode.insertBefore(d.firstChild, today); }
      // ② 모양 정하기 안에 추가/빼기 버튼
      var go = root.querySelector(".wbGo"); if (go && MK.sel) { var cur = favCur(), has = cur && favHas(cur), b = document.createElement("button"); b.className = "chip favBtn" + (has ? " on" : ""); b.textContent = has ? "★ 즐겨찾기 됨 — 빼기" : "☆ 이 주제 + 모양을 즐겨찾기에 추가"; b.onclick = function () { var c = favCur(); if (!c) return; favToggle(c); smToast(favHas(c) ? "즐겨찾기에 넣었어요 — 작업대 맨 위" : "즐겨찾기에서 뺐어요"); makerRender(); }; go.appendChild(b); }
      Array.prototype.forEach.call(root.querySelectorAll("[data-favgo]"), function (x) { x.onclick = function () { var f = favLoad()[+x.getAttribute("data-favgo")]; if (f) favRun(f, x); }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-favsel]"), function (x) { x.onclick = function () { var f = favLoad()[+x.getAttribute("data-favsel")]; if (!f) return; MK.sel = f.ctx; MK.size = f.size; MK.shapeBy[f.ctx] = { n: f.n, draw: f.draw, src: f.src }; makerRender(); var s = document.querySelector("#mkBody .wbShape"); if (s) try { s.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-favmk]"), function (x) { x.onclick = function () { var p = x.getAttribute("data-favmk").split(":"), f = favLoad()[+p[0]]; if (!f) return; f.mk = p[1]; FAV.at = Date.now(); favSave(); makerRender(); }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-favdel]"), function (x) { x.onclick = function () { var f = favLoad()[+x.getAttribute("data-favdel")]; if (f && (window.__SM_TEST || confirm("즐겨찾기에서 뺄까요? — " + (f.t || f.ctx)))) { favToggle(f); makerRender(); } }; });
    } catch (e) { console.warn("fav", e); }
    return r;
  };
  var st = document.createElement("style"); st.textContent = [
    ".wbFav{border:2px solid #c9a24f;background:linear-gradient(180deg,#fff8e6,#fffdf7);border-radius:16px;padding:14px 16px;margin-bottom:12px;box-shadow:0 4px 14px rgba(201,162,79,.18)}.wbFav .wbTodayH b{font-size:17px;color:#7a5520}",
    ".favGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-top:10px}.favCard{background:#fff;border:1px solid #e6d3a3;border-radius:14px;padding:12px 14px;position:relative}.favCard.on{outline:2px solid #14161c}.favCard.done{background:#f7f9f7}",
    ".favT{display:flex;align-items:center;gap:6px;font-size:15px}.favT i{font-style:normal;color:#c9a24f;font-size:18px}.favT b{flex:1;min-width:0}.favT em{font-style:normal;font-size:11px;color:#1d7f55;font-weight:700;background:#eef8f2;border-radius:6px;padding:1px 6px}",
    ".favS{font-size:12px;color:#667;margin:4px 0 6px}.favMk{display:flex;gap:4px;align-items:center;margin-bottom:8px;flex-wrap:wrap}.favMk button{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:2px 10px;font-size:12px;cursor:pointer}.favMk button.on{background:#14161c;color:#fff;border-color:#14161c}.favMk small{font-size:11px;color:#99a;margin-left:4px}.favA{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.favA{flex-wrap:nowrap}.favA .primary{flex:1 1 120px;min-height:36px;padding-left:8px;padding-right:8px;font-size:13px}.favX{color:#999;padding:4px 9px}.favEmpty{font-size:13px;color:#556;margin-top:6px;line-height:1.6}",
    ".favBtn{margin-left:8px}.favBtn.on{background:#fff3cf;border-color:#c9a24f;color:#7a5520;font-weight:700}",
    "@media(max-width:640px){.favGrid{grid-template-columns:1fr}}"
  ].join(""); document.head.appendChild(st);
})();

/* ============================================================ v12.80 모바일 하단 탭 정리 — 13개 → 5개 + '더보기' (운영자일 때). 비운영자는 공개 탭 6개 그대로 ============================================================ */
(function () {
  var MAIN = ["home", "ops", "onecard", "report", "analyst"];   // 손이 가장 자주 가는 다섯
  var nav = document.querySelector(".tabs"); if (!nav) return;
  var more = document.createElement("button"); more.className = "ownerOnly uxMore"; more.setAttribute("data-more", "1"); more.innerHTML = "<i>⋯</i><span>더보기</span>"; nav.appendChild(more);
  var sheet = document.createElement("div"); sheet.className = "uxSheet hidden"; sheet.innerHTML = '<div class="uxSheetBg"></div><div class="uxSheetBox"><div class="uxSheetH"><b>모든 화면</b><button class="chip" data-close>닫기</button></div><div class="uxSheetGrid"></div></div>'; document.body.appendChild(sheet);
  function paint() {
    var owner = typeof isOwner === "function" && isOwner(), mobile = window.matchMedia("(max-width: 700px)").matches, cur = typeof currentTab !== "undefined" ? currentTab : "home";
    Array.prototype.forEach.call(nav.querySelectorAll("button[data-tab]"), function (b) { var t = b.getAttribute("data-tab"); b.classList.toggle("uxHideM", owner && mobile && MAIN.indexOf(t) < 0); });
    more.classList.toggle("active", owner && mobile && MAIN.indexOf(cur) < 0);
    var grid = sheet.querySelector(".uxSheetGrid"); grid.innerHTML = "";
    Array.prototype.forEach.call(nav.querySelectorAll("button[data-tab]"), function (b) { var t = b.getAttribute("data-tab"); if (!owner && b.classList.contains("ownerOnly")) return; var x = document.createElement("button"); x.className = (t === cur ? "on" : ""); x.innerHTML = b.innerHTML; x.onclick = function () { sheet.classList.add("hidden"); if (typeof navTo === "function") navTo(t); else switchTab(t); }; grid.appendChild(x); });
  }
  more.onclick = function () { paint(); sheet.classList.remove("hidden"); };
  sheet.querySelector(".uxSheetBg").onclick = sheet.querySelector("[data-close]").onclick = function () { sheet.classList.add("hidden"); };
  if (typeof switchTab === "function") { var s0 = switchTab; switchTab = function () { var r = s0.apply(this, arguments); try { paint(); } catch (e) {} return r; }; }
  window.addEventListener("resize", paint); setTimeout(paint, 800); setTimeout(paint, 3000);
  var st = document.createElement("style"); st.textContent = [
    "@media(max-width:700px){.tabs button.uxHideM{display:none}}@media(min-width:701px){.tabs .uxMore{display:none!important}}",
    ".uxSheet{position:fixed;inset:0;z-index:400}.uxSheet.hidden{display:none}.uxSheetBg{position:absolute;inset:0;background:rgba(0,0,0,.35)}.uxSheetBox{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:18px 18px 0 0;padding:14px 14px calc(18px + var(--sab,0px));max-height:70vh;overflow:auto}",
    ".uxSheetH{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:15px}.uxSheetGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.uxSheetGrid button{display:flex;flex-direction:column;align-items:center;gap:4px;border:1px solid #e5e7eb;background:#fafafa;border-radius:12px;padding:10px 4px;font-size:12px;font-weight:600;color:#445}.uxSheetGrid button i{font-style:normal;font-size:22px}.uxSheetGrid button.on{background:#14161c;color:#fff;border-color:#14161c}",
    "[data-theme=dark] .uxSheetBox{background:#1b2130}[data-theme=dark] .uxSheetGrid button{background:#232a38;border-color:#2b3447;color:#dde}"
  ].join(""); document.head.appendChild(st);
})();

/* ============================================================ v12.84 운영자용 오류 표시 — 화면이 비면 왜 비었는지 바로 보이게 (window.onerror + 주요 화면 그리기 함수 감싸기) ============================================================ */
(function () {
  var box = null, list = [];
  function show(msg) {
    if (!(typeof isOwner === "function" && isOwner())) return;
    if (!box) { box = document.createElement("div"); box.className = "uxErr"; box.innerHTML = '<b>⚠ 화면 오류</b> <span></span> <button class="chip" data-copy>복사</button><button class="chip" data-x>닫기</button>'; document.body.appendChild(box); box.querySelector("[data-x]").onclick = function () { box.remove(); box = null; list = []; }; box.querySelector("[data-copy]").onclick = function () { chCopy(list.join("\n"), this); }; }
    list.push(msg); box.querySelector("span").textContent = list[list.length - 1] + (list.length > 1 ? " (+" + (list.length - 1) + ")" : "");
  }
  window.addEventListener("error", function (e) { try { var f = String(e.filename || "").split("/").pop(); show((e.message || "오류") + " — " + f + ":" + (e.lineno || "?")); } catch (x) {} });
  window.addEventListener("unhandledrejection", function (e) { try { var r = e.reason; if (r && r.message && !/Failed to fetch|NetworkError|abort/i.test(r.message)) show("비동기 오류: " + r.message + (r.stack ? " — " + String(r.stack).split("\n")[1] : "")); } catch (x) {} });
  ["renderBrief", "renderOps", "renderReport", "renderAnalyst", "makerRender", "renderCore", "renderChannel", "renderDataHub"].forEach(function (fn) {
    if (typeof window[fn] !== "function") return; var f0 = window[fn];
    window[fn] = function () { try { return f0.apply(this, arguments); } catch (e) { show(fn + " 실패: " + e.message + (e.stack ? " — " + String(e.stack).split("\n")[1] : "")); console.error(fn, e); throw e; } };
  });
  var st = document.createElement("style"); st.textContent = ".uxErr{position:fixed;left:12px;right:12px;bottom:calc(84px + var(--sab,0px));z-index:500;background:#fff3f3;border:1px solid #e5a3a3;color:#7a1f1f;border-radius:12px;padding:8px 12px;font-size:12.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;box-shadow:0 4px 14px rgba(0,0,0,.12)}.uxErr span{flex:1;min-width:0;word-break:break-all}@media(min-width:701px){.uxErr{bottom:16px;left:auto;max-width:640px}}"; document.head.appendChild(st);
})();
