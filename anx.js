/* ============================================================ v12.68 분석 — 전체 6틀 + 추가 검토를 한 프롬프트로 → 운영자가 Claude(claude.ai)에 직접 전달 → 답변 붙여넣기 → 요약·시각화·요약 카드
   API 호출 없음. ③ 프롬프트 · ④ 답변 붙여넣고 저장 · ⑤ 결과 요약(대시보드) + 요약 카드 묶음.
   답변 끝의 '## 요약 JSON'을 읽어 시각화한다(없으면 서술형만 저장 · 기존 카드형 파서도 그대로).
   ============================================================ */
var ANX = { prompt: "", busy: false, view: null };
var ANX_FRAMES = ["기업", "차트", "실적", "재무", "포트폴리오", "매크로"];
function anxEsc(s) { return typeof anEsc === "function" ? anEsc(s) : escapeHtml(String(s == null ? "" : s)); }
function anxReview(name) {
  return [
    "", "### 추가 검토 (위 분석이 끝난 뒤, 같은 답변 안에서 이어서)",
    "A. 실패 시나리오(사전 부검): " + name + "을 지금 산 뒤 6개월 후 -30%라고 가정 — 가장 그럴듯한 원인 3개, 그 전에 나타날 조기 경고 신호 3개, '이 가설을 버려야 할' 조건 2개.",
    "B. 가장 강한 반론 3개와 각각에 대한 답(반론이 더 강하면 결론을 바꿀 것).",
    "C. 팩트체크: 위 [앱 데이터] 숫자 중 최신 공시·실적과 어긋나 보이는 것이 있으면 표시(앱 숫자가 맞는지 / 다른 출처는 무엇인지). 확인 못 한 것은 '확인 못 함'.",
    "D. 최종 점검: 본문의 숫자·단위·날짜·증감률을 [앱 데이터]와 대조해 다른 것은 바로잡고, 출처 없는 숫자와 과장 표현은 빼고 쓴다."
  ];
}
var ANX_FORMAT = [
  "", "=== 답변 형식 (앱이 그대로 읽어서 요약 화면과 카드로 만들어요. 순서와 표기를 지켜 주세요) ===",
  "## 서술형",
  "【판단 근거 요약】 결론을 받치는 핵심 근거 3가지와, 반대 근거가 결론을 바꾸지 못한 이유 (3~4문장)",
  "이어서 틀마다 【기업】【차트】【실적】【재무】【포트폴리오】【매크로】 한 문단씩, 그다음 【추가 검토】(A~D), 마지막 【종합】. 초보도 읽을 수 있게 쉬운 말로, 숫자는 출처와 함께. 전체 8,000자 이내.",
  "",
  "## 요약 JSON",
  "아래 모양 그대로 ```json 코드 블록 하나. 값은 위 서술형과 같은 내용을 짧게(문장은 40자 안팎). 숫자는 앱 데이터·출처 있는 것만.",
  "```json",
  "{",
  '  "title": "엔비디아 6틀 분석",',
  '  "one": "한 줄 결론(40자)",',
  '  "verdict": "검토 | 나눠서 | 관망 | 비중 축소 | 보류 중 하나",',
  '  "score": 0~100 (높을수록 긍정),',
  '  "frames": [ { "name": "기업|차트|실적|재무|포트폴리오|매크로", "st": "좋음|보통|나쁨", "num": "대표 숫자 하나(예: 영업이익률 62%)", "line": "한 줄 해석" } ],',
  '  "bull": ["긍정 근거 3개"], "bear": ["부정 근거 3개"],',
  '  "counter": [ { "q": "가장 강한 반론", "a": "그에 대한 답" } ],',
  '  "premortem": { "causes": ["-30% 원인 3"], "signals": ["조기 경고 신호 3"], "kill": ["가설 폐기 조건 2"] },',
  '  "check": [ { "claim": "확인한 숫자·주장", "ok": true, "note": "출처·차이" } ],',
  '  "action": { "stance": "행동 수준 한 줄", "plan": ["행동안 3(조건부로)"], "change": ["생각을 바꿀 조건 3(숫자·사건)"], "weight": "포트폴리오 안에서의 비중 제안 한 줄" },',
  '  "sources": ["출처 이름 · 날짜"]',
  "}",
  "```",
  "매수·매도 권유·목표가·수익 보장 표현은 쓰지 않는다. 행동은 '조건이면 이렇게'로."
];
function anxBuildPrompt() {
  if (!AN.sym) return Promise.reject(new Error("먼저 ① 에서 종목을 골라 주세요"));
  var name = anName(AN.sym) + "(" + AN.sym + ")";
  return Promise.all([anAllOuts(AN_MODS), AN.useCtx !== false && typeof arcContext === "function" ? arcContext(AN.sym, null, 4) : ""]).then(function (r) {
    var outs = r[0]; outs._ctx = r[1] || "";
    var base = anPromptAll(outs).split("\n=== 답변 형식")[0];
    return [base].concat(anxReview(name), ANX_FORMAT).join("\n");
  });
}
/* 답변에서 요약 JSON 꺼내기 — 코드 블록 · 둥근 따옴표 · 끝 쉼표 · 주석 견딤 */
function anxSumParse(text) {
  var t = String(text || ""), m = t.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i), raw = m ? m[1] : null;
  if (!raw) { var k = t.lastIndexOf("## 요약 JSON"), s = t.indexOf("{", k >= 0 ? k : 0), e = t.lastIndexOf("}"); if (s >= 0 && e > s) raw = t.slice(s, e + 1); }
  if (!raw) return null;
  var tries = [raw, raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1").replace(/\/\/[^\n]*/g, "")];
  for (var i = 0; i < tries.length; i++) { try { var J = JSON.parse(tries[i]); if (J && typeof J === "object") return anxNorm(J); } catch (e) {} }
  return null;
}
function anxNorm(J) {
  var arr = function (x) { return Array.isArray(x) ? x.filter(Boolean).map(function (y) { return typeof y === "string" ? y : y; }) : x ? [x] : []; };
  J.frames = arr(J.frames).filter(function (f) { return f && f.name; });
  J.bull = arr(J.bull); J.bear = arr(J.bear); J.counter = arr(J.counter).filter(function (c) { return c && (c.q || c.a); });
  J.premortem = J.premortem || {}; ["causes", "signals", "kill"].forEach(function (k) { J.premortem[k] = arr(J.premortem[k]); });
  J.check = arr(J.check).filter(function (c) { return c && c.claim; }); J.action = J.action || {}; J.action.plan = arr(J.action.plan); J.action.change = arr(J.action.change); J.sources = arr(J.sources);
  var sc = parseFloat(J.score); J.score = isFinite(sc) ? Math.max(0, Math.min(100, sc)) : null;
  return J;
}
function anxSave(text) {
  var m = anMod(), P = anParse(text), J = anxSumParse(text); if (!String(text).trim()) return Promise.resolve(null);
  text = anxWithAppNums(String(text));
  var rec = { kind: "analyst", mod: m.id, modName: "6틀 종합", sym: AN.sym, name: anName(AN.sym), title: (J && J.title) || P.title || ("6틀 분석 · " + anName(AN.sym)), text: String(text), scope: "all", p: Object.assign({}, P, J ? { one: J.one || P.one, verdictSt: J.score == null ? P.verdictSt : J.score >= 65 ? "ok" : J.score >= 40 ? "mid" : "bad" } : {}), snap: anSnap(AN.outKey === m.id + ":" + (AN.sym || "") ? AN.out : null), tags: ["6틀"] };
  return arcSave(rec).then(function (it) { AN.ansId = it.id; return it; });
}
/* 앱 데이터에 있던 숫자 목록을 답변 끝에 숨겨 저장 — 나중에 '앱에 없던 숫자'를 표시하는 기준 (프롬프트를 이 화면에서 복사했을 때만) */
function anxWithAppNums(text) {
  if (/<!--앱숫자 /.test(text) || !(ANX && ANX.prompt)) return text;
  var base = ANX.prompt.split("\n### 추가 검토")[0], seen = {}, L = [];
  (typeof uxNums === "function" ? uxNums(base) : []).forEach(function (x) { if (!seen[x] && x.replace(/[^\d]/g, "").length >= 2) { seen[x] = 1; L.push(x); } });
  return L.length ? text.replace(/\s+$/, "") + "\n\n<!--앱숫자 " + L.slice(0, 400).join(" ") + "-->" : text;
}
function anxAppNumSet(text) { var m = String(text || "").match(/<!--앱숫자 ([^>]*)-->/), s = {}; if (!m) return null; m[1].split(" ").forEach(function (x) { if (x) { s[x] = 1; s[x.replace(/[^\d.\-]/g, "")] = 1; } }); return s; }
function anxStripMeta(text) { return String(text || "").replace(/\n*<!--앱숫자 [^>]*-->\s*$/, ""); }
/* ---------- 요약 화면 ---------- */
function anxStCls(st) { return /좋|✓|ok/.test(st) ? "good" : /나쁨|✗|bad/.test(st) ? "bad" : "mid"; }
function anxDashHtml(it, J) {
  if (!J) return '<div class="anxNone">이 답변엔 <b>요약 JSON</b>이 없어요 — 서술형만 저장됐어요. 다음엔 프롬프트를 그대로 붙여넣으면 끝에 요약 JSON이 같이 와요. <button class="chip" data-anxraw>원문 보기</button></div>';
  var base = anxAppNumSet(it.text), NEW = { n: 0 }, mk = function (t) { t = typeof t === "string" ? t : JSON.stringify(t); if (!base || typeof uxMarkNew !== "function") return anxEsc(t); var M = uxMarkNew(t, base); NEW.n += M.n; return M.html; };
  var sc = J.score, scCls = sc == null ? "mid" : sc >= 65 ? "good" : sc >= 40 ? "mid" : "bad", li = function (a) { return a.map(function (x) { return '<li>' + mk(x) + '</li>'; }).join(""); };
  var h = '<div class="anxHero ' + scCls + '"><div class="anxHeroL"><div class="anxVerdict">' + anxEsc(J.verdict || "-") + '</div><div class="anxOne">' + anxEsc(J.one || "") + '</div><div class="anxMeta">' + anxEsc(it.name || "") + ' · ' + (typeof arcD === "function" ? arcD(it.at) : "") + ' · 6틀 + 추가 검토</div></div>' + (sc != null ? '<div class="anxGauge" style="--v:' + sc + '"><b>' + Math.round(sc) + '</b><small>/100</small></div>' : '') + '</div>';
  if (J.frames.length) h += '<div class="anxH">6틀 성적표</div><div class="anxFrames">' + J.frames.map(function (f) { return '<div class="anxFrame ' + anxStCls(f.st) + '"><div class="anxFT"><b>' + anxEsc(f.name) + '</b><i>' + anxEsc(f.st || "") + '</i></div><div class="anxFN">' + mk(f.num || "") + '</div><div class="anxFL">' + mk(f.line || "") + '</div></div>'; }).join("") + '</div>';
  if (J.bull.length || J.bear.length) h += '<div class="anxH">근거 — 긍정 vs 부정</div><div class="anxTwo"><ul class="anxBull">' + li(J.bull) + '</ul><ul class="anxBear">' + li(J.bear) + '</ul></div>';
  if (J.counter.length) h += '<div class="anxH">가장 강한 반론과 답</div><div class="anxQA">' + J.counter.map(function (c) { return '<div><b>Q</b> ' + anxEsc(c.q || "") + '<br><b class="a">A</b> ' + mk(c.a || "") + '</div>'; }).join("") + '</div>';
  var pm = J.premortem; if (pm.causes.length || pm.signals.length) h += '<div class="anxH">실패 시나리오 — 6개월 뒤 -30%라면</div><div class="anxThree"><div><small>원인</small><ul>' + li(pm.causes) + '</ul></div><div><small>조기 경고 신호</small><ul>' + li(pm.signals) + '</ul></div><div><small>가설 폐기 조건</small><ul>' + li(pm.kill) + '</ul></div></div>';
  var ac = J.action; if (ac.stance || ac.plan.length) h += '<div class="anxH">그래서 — 조건부 행동</div><div class="anxAct">' + (ac.stance ? '<div class="anxStance">' + anxEsc(ac.stance) + '</div>' : '') + (ac.plan.length ? '<ol>' + li(ac.plan) + '</ol>' : '') + (ac.weight ? '<div class="anxW">비중: ' + anxEsc(ac.weight) + '</div>' : '') + (ac.change.length ? '<div class="anxChg"><small>생각을 바꿀 조건</small><ul>' + li(ac.change) + '</ul></div>' : '') + '</div>';
  if (J.check.length) h += '<div class="anxH">팩트체크</div><table class="anxChk">' + J.check.map(function (c) { return '<tr><td>' + (c.ok === false ? '<b class="bad">✗</b>' : c.ok === true ? '<b class="good">✓</b>' : '△') + '</td><td>' + mk(c.claim) + (c.note ? '<small>' + mk(c.note) + '</small>' : '') + '</td></tr>'; }).join("") + '</table>';
  if (J.sources.length) h += '<div class="anxSrc">출처: ' + J.sources.map(anxEsc).join(" · ") + '</div>';
  if (base) h = '<div class="anxLegend">' + (NEW.n ? '<mark class="uxNew">초록 표시</mark> ' + NEW.n + '개 = 앱 데이터에 없던 숫자(Claude가 웹에서 보완) — 카드로 쓰기 전에 출처를 확인하세요. 나머지 숫자는 앱 데이터와 같아요.' : '✓ 요약 속 숫자가 모두 앱 데이터에 있던 것이에요 (웹에서 새로 가져온 숫자 없음)') + '</div>' + h;
  return h;
}
/* ---------- 요약 카드 묶음 (숫자 위주 · 한눈에) ---------- */
function anxDeck(it, J) {
  var nm = it.name || anName(it.sym), col = function (st) { var c = anxStCls(st); return c === "good" ? NB_C.up : c === "bad" ? NB_C.down : NB_C.navy; }, pages = [];
  if (J.frames.length) pages.push({ name: "성적표", top: ["좋음 " + J.frames.filter(function (f) { return anxStCls(f.st) === "good"; }).length + " · 나쁨 " + J.frames.filter(function (f) { return anxStCls(f.st) === "bad"; }).length, "[[" + (function () { var w = J.frames.filter(function (f) { return anxStCls(f.st) === "bad"; })[0]; return w ? "약한 곳: " + w.name : "약한 곳 없음"; })() + "]]"], title: "6틀 성적표", sub: "기업 · 차트 · 실적 · 재무 · 포트폴리오 · 매크로", kind: "rows", data: J.frames.map(function (f) { return [f.name, f.line || "", f.num || f.st || "", col(f.st), f.st || ""]; }), leftW: 150 });
  if (J.bull.length || J.bear.length) pages.push({ name: "근거", top: ["긍정 " + J.bull.length + " vs 부정 " + J.bear.length, "[[" + (J.bull.length >= J.bear.length ? "긍정이 조금 더" : "부정이 조금 더") + "]]"], title: "근거 — 긍정 vs 부정", sub: "숫자와 출처가 있는 것만", kind: "rows", data: J.bull.slice(0, 3).map(function (x) { return ["▲ 긍정", x, "", NB_C.up]; }).concat(J.bear.slice(0, 3).map(function (x) { return ["▼ 부정", x, "", NB_C.down]; })), leftW: 120 });
  if (J.counter.length) pages.push({ name: "반론", top: ["가장 강한 반론에", "[[이렇게 답해요]]"], title: "반론에 답하기", sub: "결론에 반대하는 근거를 먼저", kind: "text", data: { paras: [].concat.apply([], J.counter.slice(0, 3).map(function (c) { return ["Q. " + (c.q || ""), "■ " + (c.a || "")]; })).filter(Boolean) } });
  var pm = J.premortem; if (pm.causes.length) pages.push({ name: "실패", top: ["6개월 뒤 -30%라면", "[[원인 " + pm.causes.length + " · 신호 " + pm.signals.length + "]]"], title: "실패 시나리오", sub: "미리 틀릴 이유를 적어 두기", kind: "text", data: { paras: ["원인부터 적어 두면, 그 신호가 보일 때 흔들리지 않아요."].concat(pm.causes.map(function (x) { return "■ 원인: " + x; }), pm.signals.slice(0, 3).map(function (x) { return "■ 신호: " + x; })).slice(0, 7), after: pm.kill.length ? ["가설 폐기 조건", pm.kill.join(" · ")] : null } });
  var ac = J.action; if (ac.stance || ac.plan.length) pages.push({ name: "그래서", top: ["그래서,", "[[" + (J.verdict || ac.stance || "") + "]]"], title: "조건부 행동", sub: "권유가 아니라 '조건이면 이렇게'", kind: "text", data: { paras: [ac.stance || J.one || ""].concat(ac.plan.map(function (x) { return "■ " + x; }), ac.weight ? ["■ 비중: " + ac.weight] : []).filter(Boolean).slice(0, 6), after: ac.change.length ? ["생각을 바꿀 조건", ac.change.join(" · ")] : null } });
  return hubDraw({ small: (typeof arcD === "function" ? arcD(it.at) : "") + " · 6틀 분석", hook: [nm + ",", "[[" + (J.verdict || "분석") + "]]" + (J.score != null ? " " + Math.round(J.score) + "점" : "")], lead: [J.one || ""].concat(J.frames.slice(0, 6).map(function (f) { return f.name + " " + (f.num || f.st || ""); })).slice(0, 7), meta: "앱 데이터 + 공시·기사(출처 표기) · 개인 분석이며 투자 권유 아님", pages: pages, close: ["여러분은 어떻게 보시나요?", ["3개월 뒤 이 분석을", "같은 기준으로 채점해요."]], foot: "StockMind 6틀 분석 · 투자 권유 아님" });
}
/* ---------- ③④⑤ 다시 그리기 ---------- */
function anxSections(root) {
  var secs = root.querySelectorAll(".anSec"); if (secs.length < 5) return;
  var ans = anAnsLoad(), mine = ans.filter(function (a) { return a.sym && a.sym === AN.sym; }), cur = mine.filter(function (a) { return a.id === AN.ansId; })[0] || mine.filter(function (a) { return a.scope === "all"; })[0] || mine[0] || null;
  var s3 = '<div class="mkStep"><b>3</b> Claude에 전달할 프롬프트 <small class="briefDim">전체 6틀(기업·차트·실적·재무·포트폴리오·매크로) + 추가 검토(실패 시나리오·반론·팩트체크·최종 점검)를 한 번에</small></div>' +
    (AN.sym ? '<div class="anxSteps"><div><i>1</i> 아래 버튼으로 프롬프트 복사</div><div><i>2</i> claude.ai 새 대화에 붙여넣기 <small>(웹 검색 켜기 권장)</small></div><div><i>3</i> 답변 전체를 복사해 ④에 붙여넣기</div></div>' +
      '<div class="anActs"><button class="primary" data-anxp>📋 ' + anxEsc(anName(AN.sym)) + ' 6틀 프롬프트 복사</button><button class="chip" data-anxpv>프롬프트 보기</button><label class="anCtxOpt"><input type="checkbox" data-anctx2' + (AN.useCtx !== false ? ' checked' : '') + '> 과거 분석 기록 넣기</label><span class="briefDim anxMsg"></span></div><div class="anxPv" hidden><textarea class="thrText" rows="14" readonly spellcheck="false"></textarea><small class="briefDim anxLen"></small></div>'
      : '<div class="briefDim">① 에서 종목을 먼저 골라 주세요.</div>');
  var s4 = '<div class="mkStep"><b>4</b> 답변 붙여넣고 저장 <small class="briefDim">' + (mine.length ? '이 종목 ' + mine.length + '건 저장됨' : '저장하면 서버에 쌓여 3개월 뒤 자동 채점돼요') + '</small></div>' +
    '<textarea class="anAnsIn" id="anxIn" rows="7" placeholder="Claude 답변 전체를 붙여넣으세요 — 끝의 ## 요약 JSON 까지"></textarea><div class="anActs"><button class="primary" data-anxsave>💾 저장하고 요약 보기</button><span class="briefDim anxChk"></span></div>' +
    (mine.length ? '<div class="anxList">' + mine.slice(0, 8).map(function (a) { var J = anxSumParse(a.text || ""); return '<button class="chip' + (cur && cur.id === a.id ? ' on' : '') + '" data-anxpick="' + anxEsc(a.id) + '">' + (typeof arcD === "function" ? arcD(a.at) : "") + ' · ' + anxEsc(J && J.verdict || (a.p && a.p.one) || a.title || "").slice(0, 20) + (J ? '' : ' <small>(요약 없음)</small>') + '</button>'; }).join("") + '</div>' : '');
  var J = cur ? anxSumParse(cur.text || "") : null;
  if (cur && !cur.text && typeof arcText === "function") arcText(cur.id).then(function (t) { if (t) { cur.text = t; renderAnalyst(); } });
  var s5 = '<div class="mkStep"><b>5</b> 결과 요약 <small class="briefDim">' + (cur ? anxEsc(cur.title || "") : "저장한 답변이 여기 요약돼요") + '</small>' + (cur && J ? '<button class="primary anxCardBtn" data-anxdeck>🃏 요약 카드 만들기</button>' : '') + (cur ? '<button class="chip" data-anxraw>원문</button>' : '') + '</div>' + (cur ? anxDashHtml(cur, J) : '<div class="briefDim">④에 답변을 붙여넣고 저장하면, 6틀 성적표 · 근거 · 반론 · 실패 시나리오 · 조건부 행동이 한 화면에 정리돼요.</div>');
  secs[2].innerHTML = s3; secs[3].innerHTML = s4; secs[4].innerHTML = s5; secs[2].classList.remove("dim"); secs[4].classList.remove("dim");
  // bind
  var msg = root.querySelector(".anxMsg"), pvBox = root.querySelector(".anxPv");
  var withPrompt = function (cb) { if (msg) msg.textContent = "여섯 틀 데이터를 모으는 중…"; anxBuildPrompt().then(function (t) { ANX.prompt = t; if (msg) msg.textContent = ""; cb(t); }).catch(function (e) { if (msg) msg.textContent = ""; smToast ? smToast(e.message, "bad") : alert(e.message); }); };
  var bp = root.querySelector("[data-anxp]"); if (bp) bp.onclick = function () { withPrompt(function (t) { (typeof chCopy === "function" ? chCopy : function (x) { navigator.clipboard.writeText(x); })(t, bp); if (pvBox) { pvBox.querySelector("textarea").value = t; pvBox.querySelector(".anxLen").textContent = t.length.toLocaleString() + "자 · claude.ai에 그대로 붙여넣기"; } }); };
  var pv = root.querySelector("[data-anxpv]"); if (pv) pv.onclick = function () { if (!pvBox.hidden) { pvBox.hidden = true; return; } withPrompt(function (t) { pvBox.hidden = false; pvBox.querySelector("textarea").value = t; pvBox.querySelector(".anxLen").textContent = t.length.toLocaleString() + "자"; }); };
  var cx = root.querySelector("[data-anctx2]"); if (cx) cx.onchange = function () { AN.useCtx = cx.checked; };
  var inp = root.querySelector("#anxIn"), chk = root.querySelector(".anxChk");
  if (inp) inp.oninput = function () { var J2 = anxSumParse(inp.value); chk.innerHTML = !inp.value.trim() ? "" : J2 ? '<b style="color:#1d7f55">✓ 요약 JSON 읽음</b> · 틀 ' + J2.frames.length + '개 · ' + anxEsc(J2.verdict || "") : /##\s*요약 JSON|```json/.test(inp.value) ? '<b style="color:#b9600f">요약 JSON 형식이 깨졌어요</b> — 그래도 서술형으로 저장돼요' : '<span style="color:#b9600f">요약 JSON이 없어요 — 서술형만 저장돼요</span>'; };
  var sv = root.querySelector("[data-anxsave]"); if (sv) sv.onclick = function () { var t = inp.value; if (!t.trim()) return; if (!AN.sym) return smToast("종목을 먼저 골라 주세요", "bad"); sv.disabled = true; sv.textContent = "저장 중…"; anxSave(t).then(function (it) { if (!it) throw new Error("저장하지 못했어요"); AN.arcPairs = null; smToast("저장했어요 — 아래 ⑤에 요약했어요"); renderAnalyst(); setTimeout(function () { var s = document.querySelectorAll("#anBody .anSec")[4]; if (s) try { s.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }, 100); }).catch(function (e) { smToast("저장 실패: " + e.message, "bad"); sv.disabled = false; sv.textContent = "💾 저장하고 요약 보기"; }); };
  Array.prototype.forEach.call(root.querySelectorAll("[data-anxpick]"), function (b) { b.onclick = function () { AN.ansId = b.getAttribute("data-anxpick"); renderAnalyst(); }; });
  var dk = root.querySelector("[data-anxdeck]"); if (dk) dk.onclick = function () { var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); ready.then(function () { cur._deck = true; var list = anxDeck(cur, J); hubShow((cur.name || "") + " · 6틀 분석", list, { ctx: "analyst:" + cur.sym, modal: true, note: "요약 JSON으로 만든 카드 — 숫자·판정은 답변 그대로" }); }); };
  Array.prototype.forEach.call(root.querySelectorAll("[data-anxraw]"), function (b) { b.onclick = function () { var w = document.createElement("div"); w.innerHTML = '<textarea class="thrText" rows="20" readonly style="width:100%"></textarea>'; w.querySelector("textarea").value = cur && cur.text ? anxStripMeta(cur.text) : "(원문을 불러오는 중이에요 — 잠시 뒤 다시)"; if (typeof infoModal !== "undefined") infoModal.open("답변 원문", w); }; });
}
(function () {
  if (typeof renderAnalyst !== "function") return;
  var r0 = renderAnalyst; renderAnalyst = function () {
    if (typeof anMod === "function" && anMod().need !== "stock") { AN.mod = "biz"; AN.out = null; }   // 6틀은 종목이 기준 — 틀 고르기는 앱 데이터 보기용
    AN.pScope = "all";
    var r = r0.apply(this, arguments);
    try { var root = document.getElementById("anBody"); if (root) anxSections(root); } catch (e) { console.warn(e); }
    return r;
  };
  if (typeof SM_GUIDE !== "undefined") SM_GUIDE.analyst = { t: "분석", s: ["① 종목을 고르면 ② 앱 데이터가 계산돼요(틀 버튼은 데이터 보기용 — 프롬프트는 늘 6틀 전체).", "③ 프롬프트를 복사해 claude.ai에 붙여넣고, 답변 전체를 복사해 ④에 저장하세요.", "⑤에 6틀 성적표·근거·반론·실패 시나리오·조건부 행동이 정리되고, 🃏 요약 카드로 바로 만들 수 있어요."] };
})();

/* ============================================================ 리포트 — Claude 서술도 프롬프트 복사 → 답변 붙여넣기 ============================================================ */
var RPX_SYS = "너는 한국 투자 데이터 계정 '우상향연구소'의 수석 리서처다. 독자는 한국 개인투자자 초보.\n규칙: (1) 아래 [근거 줄]의 숫자가 1순위 근거 — 그대로 인용하고 지어내지 않는다. (2) 웹에서 찾은 사실은 날짜·출처를 붙이고, 확실하지 않으면 쓰지 않는다. (3) 매수·매도 권유, 목표가, 수익 보장, 과장 금지 — 판단은 '근거와 조건'으로. (4) 오늘 날짜 기준 최신 상황 우선.\n이번 작업: 앱이 계산한 리포트(질문·상황·Exhibit 증거·시나리오 빈도·규칙 의견·기사)를 증권사 리서치 노트처럼 다시 쓴다. 숫자 뒤의 속사정은 기사와 최근 2주 웹 검색으로 보강하고 언론사·날짜를 붙인다. 규칙 의견이 근거와 맞지 않으면 따르지 말고 왜 다르게 보는지 rationale에 적는다. rationale = 판단 근거 요약: 결론을 받치는 핵심 증거 → 반대 근거와 그에 대한 답 → 그래서 이 결론, 4~6문장.\n출력: 아래 모양의 ```json 코드 블록 하나만.\n```json\n{\"headline\":\"24자 이하\",\"situation\":\"2~3문장\",\"rationale\":\"판단 근거 요약\",\"narrative\":\"4~5문단(빈 줄로 구분): 한 줄로 → 숫자가 말하는 것 → 숫자 뒤의 속사정 → 양쪽 의견을 겹쳐 보면 → 그래서\",\"interpretation\":[\"Exhibit마다 한 줄(60자 이하)\"],\"opinion\":\"3~4문장, 행동 표현(검토·관망·나눠서)\",\"forecast\":{\"회복\":\"\",\"횡보\":\"\",\"추가 하락\":\"\"},\"plan\":[\"행동안 3~4개\"],\"watch\":[\"생각을 바꿀 조건 3~4개\"],\"added\":[\"웹에서 보완한 사실 — 출처\"]}\n```";
function rpxPrompt(rp) {
  var draft = ""; try { var N0 = rpNarrative(rp); draft = [N0.one, N0.numbers, N0.story, N0.both, N0.so].join("\n\n"); } catch (e) {}
  return RPX_SYS + "\n\n오늘: " + smKstDay() + " (한국 시간)\n질문: " + rp.title + "\n리포트 종류: " + rp.kind + (rp.sym ? " · " + rp.name + "(" + rp.sym + ")" : "") + " · 기준 " + rp.asOf + "\n규칙 기반 의견: " + rp.view.stance + " — " + rp.view.txt + "\n\n[근거 줄 — 앱 계산값]\n" + rpAiLines(rp).map(function (l) { return l.id + " | " + l.text; }).join("\n") + (draft ? "\n\n[규칙으로 쓴 초안]\n" + draft : "");
}
function rpxParse(text) {
  var t = String(text || ""), m = t.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i), raw = m ? m[1] : (function () { var s = t.indexOf("{"), e = t.lastIndexOf("}"); return s >= 0 && e > s ? t.slice(s, e + 1) : null; })();
  if (!raw) return null; var tries = [raw, raw.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1")];
  for (var i = 0; i < tries.length; i++) { try { return JSON.parse(tries[i]); } catch (e) {} } return null;
}
function rpxOpen(rp) {
  var p = rpxPrompt(rp), w = document.createElement("div");
  w.innerHTML = '<div class="anxSteps"><div><i>1</i> 프롬프트 복사</div><div><i>2</i> claude.ai에 붙여넣기 <small>(웹 검색 켜기 권장)</small></div><div><i>3</i> 답변(```json 블록) 붙여넣고 적용</div></div>' +
    '<div class="anActs"><button class="primary" data-rpxc>📋 프롬프트 복사</button><small class="briefDim">' + p.length.toLocaleString() + '자</small></div><details><summary class="briefDim">프롬프트 보기</summary><textarea class="thrText" rows="10" readonly></textarea></details>' +
    '<textarea class="anAnsIn" rows="8" data-rpxin placeholder="Claude 답변을 붙여넣으세요 (```json … ``` 포함)"></textarea><div class="anActs"><button class="primary" data-rpxok>적용하기</button><span class="briefDim" data-rpxmsg></span></div>';
  w.querySelector("details textarea").value = p;
  var cb = w.querySelector("[data-rpxc]"); cb.onclick = function () { (typeof chCopy === "function" ? chCopy : function (x) { navigator.clipboard.writeText(x); })(p, cb); };
  var inp = w.querySelector("[data-rpxin]"), msg = w.querySelector("[data-rpxmsg]");
  inp.oninput = function () { var J = rpxParse(inp.value); msg.innerHTML = !inp.value.trim() ? "" : J ? '<b style="color:#1d7f55">✓ 읽음</b> · ' + escapeHtml(J.headline || "") : '<b style="color:#b9600f">JSON을 못 읽었어요</b> — ```json 블록 전체를 붙여넣어 주세요'; };
  w.querySelector("[data-rpxok]").onclick = function () {
    var J = rpxParse(inp.value); if (!J) { msg.innerHTML = '<b style="color:#b9600f">JSON을 못 읽었어요</b>'; return; }
    if (J.rationale && !J.thinking) J.thinking = J.rationale;   // 화면·카드는 기존 thinking 칸을 씀
    RP.ai = { ok: true, out: Object.assign({ interpretation: [], plan: [], watch: [], forecast: {}, added: [] }, J), model: "claude.ai(직접)", claude: true, manual: true, sources: [], searches: [] };
    try { rpNumChk(RP.ai, p); rpAiSave(rp, RP.ai); } catch (e) {}
    if (infoModal.close) infoModal.close(); else { var cl = document.querySelector(".modalWrap:not(.hidden) .modalClose"); if (cl) cl.click(); }
    renderReport(); smToast("Claude 서술을 적용했어요 — ② 카드 덱에도 들어가요");
  };
  if (typeof infoModal !== "undefined") infoModal.open("Claude 서술 — 프롬프트 복사 → 답변 붙여넣기", w);
}
(function () {
  if (typeof renderReport !== "function") return;
  var r0 = renderReport; renderReport = function () {
    var r = r0.apply(this, arguments);
    try {
      var b = document.querySelector('[data-rpa="claude"]');
      if (b && RP.cur) { var nb = b.cloneNode(true); nb.innerHTML = nb.innerHTML.replace(/Claude 서술( 다시)?/, "Claude 서술 (프롬프트 복사)" + (RP.ai && RP.ai.claude ? " 다시" : "")); nb.title = "프롬프트를 복사해 claude.ai에 붙여넣고, 답변을 붙여넣어 적용해요(API 사용 없음)"; b.parentNode.replaceChild(nb, b); nb.onclick = function (e) { e.stopPropagation(); rpxOpen(RP.cur); }; }
      var q = document.querySelector('[data-rpa="ai"]'); if (q) q.remove();   // API '빠르게 다시 쓰기'는 숨김
    } catch (e) { console.warn(e); }
    return r;
  };
})();

(function () { var st = document.createElement("style"); st.textContent = [
".anxSteps{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}.anxSteps>div{flex:1 1 160px;background:#f4f6fb;border-radius:10px;padding:8px 10px;font-size:12.5px}.anxSteps i{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#1f3a68;color:#fff;font-style:normal;font-size:11px;margin-right:6px}",
".anxPv{margin-top:8px}.anxPv textarea{width:100%;font-size:12px}.anxList{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.anxList .on{outline:2px solid #1f3a68}",
".anxLegend{font-size:12px;color:#556;background:#f4f6fb;border-radius:10px;padding:7px 10px;margin:6px 0}.anxCardBtn{margin-left:auto}.anxNone{background:#fff7ec;border-radius:10px;padding:10px 12px;font-size:13px}",
".anxHero{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 16px;margin:8px 0;color:#fff;background:#3b4a66}.anxHero.good{background:linear-gradient(135deg,#17734d,#2a9a6a)}.anxHero.bad{background:linear-gradient(135deg,#a63232,#c95050)}.anxHero.mid{background:linear-gradient(135deg,#2d3f66,#4a5f8c)}",
".anxHeroL{flex:1;min-width:0}.anxVerdict{font-size:22px;font-weight:800}.anxOne{font-size:14px;margin-top:4px;line-height:1.45}.anxMeta{font-size:11.5px;opacity:.8;margin-top:6px}",
".anxGauge{--v:50;width:78px;height:78px;border-radius:50%;flex:none;display:grid;place-items:center;align-content:center;background:conic-gradient(#fff calc(var(--v)*1%),rgba(255,255,255,.25) 0);position:relative}.anxGauge:before{content:'';position:absolute;inset:7px;border-radius:50%;background:rgba(0,0,0,.25)}.anxGauge b,.anxGauge small{position:relative;line-height:1}.anxGauge b{font-size:24px}.anxGauge small{font-size:10px;opacity:.8}",
".anxH{font-weight:700;font-size:13.5px;margin:14px 0 6px;color:#1f3a68}",
".anxFrames{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.anxFrame{border-radius:10px;padding:9px 10px;background:#f4f6fb;border-left:4px solid #8090b0}.anxFrame.good{border-color:#1d7f55;background:#eef8f2}.anxFrame.bad{border-color:#c03b3b;background:#fcefef}",
".anxFT{display:flex;justify-content:space-between;font-size:13px}.anxFT i{font-style:normal;font-size:11.5px;opacity:.75}.anxFN{font-size:15px;font-weight:800;margin:4px 0 2px}.anxFL{font-size:12px;line-height:1.4;color:#445}",
".anxTwo{display:grid;grid-template-columns:1fr 1fr;gap:8px}.anxTwo ul,.anxThree ul,.anxAct ul,.anxAct ol{margin:0;padding-left:18px;font-size:12.5px;line-height:1.5}.anxBull{background:#eef8f2;border-radius:10px;padding:8px 8px 8px 24px!important}.anxBear{background:#fcefef;border-radius:10px;padding:8px 8px 8px 24px!important}",
".anxQA>div{background:#f4f6fb;border-radius:10px;padding:8px 10px;margin-bottom:6px;font-size:12.5px;line-height:1.5}.anxQA b{color:#c03b3b}.anxQA b.a{color:#1d7f55}",
".anxThree{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.anxThree>div{background:#f7f3ee;border-radius:10px;padding:8px}.anxThree small,.anxChg small{display:block;font-weight:700;margin-bottom:4px;color:#7a5520}",
".anxAct{background:#eef2fa;border-radius:12px;padding:10px 12px}.anxStance{font-weight:800;font-size:14.5px;margin-bottom:6px}.anxW{font-size:12.5px;margin-top:6px}.anxChg{margin-top:8px;border-top:1px dashed #b8c2d8;padding-top:6px}",
".anxChk{width:100%;border-collapse:collapse;font-size:12.5px}.anxChk td{text-align:left;padding:5px 6px;border-bottom:1px solid #eceff5;vertical-align:top}.anxChk small{display:block;color:#667}.anxChk td:first-child{width:22px}.anxChk .good{color:#1d7f55}.anxChk .bad{color:#c03b3b}.anxSrc{font-size:11.5px;color:#667;margin-top:10px}",
"@media(max-width:560px){.anxTwo,.anxThree{grid-template-columns:1fr}.anxVerdict{font-size:19px}}",
"[data-theme=dark] .anxSteps>div,[data-theme=dark] .anxFrame,[data-theme=dark] .anxQA>div,[data-theme=dark] .anxAct,[data-theme=dark] .anxThree>div{background:#1e2533;color:#dde}[data-theme=dark] .anxFL{color:#bbc}"
].join(""); document.head.appendChild(st); })();
