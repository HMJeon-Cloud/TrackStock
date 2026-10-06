/* ============================================================
   한눈에 보기 (v9.4) — 브리핑·채널 화면을 발표 자료처럼
   · 맨 위 '3초 요약' 슬라이드: 큰 제목 1줄 + 숫자 4개 + 핵심 3줄 (+ 채널은 오늘 할 일 버튼)
   · 섹션마다 금색 '핵심 한 줄'을 제목 바로 아래에, 긴 내용은 접어 두고 '자세히'로 펼침
   기존 섹션의 id·내용은 그대로 두고 감싸기만 한다(다른 코드가 innerHTML을 갈아끼워도 안전)
   ============================================================ */
function slEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s)) : String(s); }
function slFirst(s) { s = String(s || "").split(" — ")[0]; var m = s.match(/^(.+?(?:요|다)\.)(\s|$)/); return m ? m[1] : s; }
function slKpi(k) { return '<div class="slK ' + (k.cls || "") + '"><span>' + slEsc(k.l) + '</span><b>' + slEsc(k.v) + '</b>' + (k.s ? '<small>' + slEsc(k.s) + '</small>' : '') + '</div>'; }
function slHero(o) {
  return '<div class="slKick">' + slEsc(o.kick) + '</div><div class="slHead">' + o.head + '</div>' + (o.sub ? '<div class="slSub">' + slEsc(o.sub) + '</div>' : '') +
    '<div class="slKpis">' + o.kpis.map(slKpi).join("") + '</div>' +
    (o.points && o.points.length ? '<ol class="slPts">' + o.points.map(function (p) { return '<li>' + slEsc(p) + '</li>'; }).join("") + '</ol>' : '') +
    (o.nav && o.nav.length ? '<div class="slNav">' + o.nav.map(function (n) { return '<button data-slgo="' + slEsc(n[1]) + '">' + slEsc(n[0]) + '</button>'; }).join("") + '</div>' : '') +
    (o.acts && o.acts.length ? '<div class="slActs">' + o.acts.map(function (a, i) { return '<button class="' + (i === 0 ? "primary" : "chip") + '" data-slact="' + i + '">' + slEsc(a[0]) + '</button>'; }).join("") + '</div>' : '');
}
function slBindHero(el, acts) {
  Array.prototype.forEach.call(el.querySelectorAll("[data-slgo]"), function (b) { b.onclick = function () { var t = document.querySelector('[data-snap-title="' + b.getAttribute("data-slgo") + '"]'); if (t) { var m = t.querySelector(".slMore"); if (m) { m.classList.add("open"); var bt = t.querySelector(".slToggle"); if (bt) bt.textContent = "접기"; } t.scrollIntoView({ behavior: "smooth", block: "start" }); } }; });
  Array.prototype.forEach.call(el.querySelectorAll("[data-slact]"), function (b) { b.onclick = function () { try { acts[+b.getAttribute("data-slact")][1](); } catch (e) { console.warn(e); } }; });
}
/* 섹션: 핵심 한 줄 + 접기 */
function slSection(sec, key, fold) {
  if (!sec) return;
  var k = sec.querySelector(":scope > .slKey");
  if (key) { if (!k) { k = document.createElement("div"); k.className = "slKey"; var h = sec.querySelector(":scope > h3"); if (h) h.after(k); else sec.prepend(k); } k.textContent = key; }
  else if (k) k.remove();
  if (!fold || sec.getAttribute("data-sl")) return;
  sec.setAttribute("data-sl", "1");
  var more = document.createElement("div"); more.className = "slMore";
  Array.prototype.slice.call(sec.children).forEach(function (ch) { if (ch.tagName === "H3" || ch.classList.contains("slKey")) return; more.appendChild(ch); });
  sec.appendChild(more);
  var bt = document.createElement("button"); bt.className = "slToggle"; bt.textContent = "자세히 보기";
  bt.onclick = function () { var o = more.classList.toggle("open"); bt.textContent = o ? "접기" : "자세히 보기"; };
  sec.appendChild(bt);
}
function slSec(title) { return document.querySelector('[data-snap-title="' + title + '"]'); }

/* ---------- 오늘의 브리핑 ---------- */
function slBrief() {
  var R = typeof briefState !== "undefined" && briefState.result, el = document.getElementById("briefHero"); if (!R || !el) return;
  var t = R.temp, i0 = (R.indexRow || [])[0], i1 = (R.indexRow || [])[1], mk = R.market || "all", unit = mk === "coin" ? "코인" : "종목";
  var iss = []; try { iss = issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular }); } catch (e) {}
  var ins = typeof thrInsights === "function" ? thrInsights(R, iss, unit) : [];
  var up = Math.round(t.upPct * 100), head;
  if (i0 && i0.ret > 0 && t.upPct < 0.45) head = i0.name + ' <em class="u">' + briefPct(i0.ret) + '</em>, 그런데 오른 ' + unit + '은 <em>' + up + '%</em>';
  else if (i0 && i0.ret < 0 && t.upPct > 0.55) head = i0.name + ' <em class="d">' + briefPct(i0.ret) + '</em>, 그래도 오른 ' + unit + '이 <em>' + up + '%</em>';
  else if (i0) head = i0.name + ' <em class="' + (i0.ret >= 0 ? "u" : "d") + '">' + briefPct(i0.ret) + '</em> · 시장은 <em>' + slEsc(t.word) + '</em>';
  else head = '시장은 <em>' + slEsc(t.word) + '</em>';
  var vix = (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0], th = R.themes || [], mUp = R.movers && R.movers.up[0], mDn = R.movers && R.movers.down[0];
  var kpis = [
    i1 ? { l: i1.name, v: briefPct(i1.ret), cls: i1.ret >= 0 ? "u" : "d" } : { l: "자산 수", v: String(R.count) },
    { l: "오른 " + unit, v: up + "%", s: t.up + "/" + t.total, cls: t.upPct >= 0.5 ? "u" : "d" },
    { l: "20일선 위", v: Math.round(t.abovePct * 100) + "%", s: "단기 추세", cls: t.abovePct >= 0.5 ? "u" : "d" },
    vix ? { l: "공포지수", v: vix.v, s: parseFloat(vix.v) >= 25 ? "공포" : parseFloat(vix.v) >= 20 ? "불안" : "평온", cls: parseFloat(vix.v) >= 25 ? "d" : "" } : (t.n200 ? { l: "신고가 : 신저가", v: t.newHigh.length + " : " + t.newLow.length, cls: t.newHigh.length >= t.newLow.length ? "u" : "d" } : { l: "업종 1등", v: th[0] ? th[0].name : "-" })
  ];
  var pts = ins.slice(0, 3).map(slFirst);
  if (pts.length < 3 && th.length >= 2) pts.push("1등 " + th[0].name + " " + briefPct(th[0].ret) + " · 꼴찌 " + th[th.length - 1].name + " " + briefPct(th[th.length - 1].ret));
  if (pts.length < 3 && mUp) pts.push("가장 많이 오른 " + unit + ": " + briefName(mUp) + " " + briefPct(mUp.ret1 != null ? mUp.ret1 : mUp.ret));
  el.innerHTML = slHero({ kick: "3초 요약 · " + (R.label || "어제") + " " + (mk !== "all" ? R.mktName + " " : "") + "시장", head: head, kpis: kpis, points: pts.slice(0, 3),
    nav: [["업종", "테마 흐름"], ["급등락", "급등·급락"], ["돈 몰린 곳", "돈이 몰린 곳"], ["숫자", "오늘의 숫자"]] });
  slBindHero(el, []);
  var kp = document.getElementById("briefKpi"); if (kp) kp.style.display = "none";   // 3초 요약과 겹치는 숫자 띠는 숨김
  // 섹션 핵심 한 줄
  var hv = (R.hotVol || [])[0], nums = R.numbers || [];
  slSection(slSec("시장 체력"), t.n200 && t.above200Pct != null ? "20일선 위 " + Math.round(t.abovePct * 100) + "% · 200일선 위 " + Math.round(t.above200Pct * 100) + "% — " + (t.abovePct >= 0.5 && t.above200Pct >= 0.5 ? "단기·장기 모두 위" : t.abovePct < 0.5 && t.above200Pct >= 0.5 ? "단기는 눌렸지만 장기는 위" : t.abovePct >= 0.5 ? "단기 반등, 장기는 아직 아래" : "단기·장기 모두 아래") : "", false);
  slSection(slSec("신고가·신저가"), t.n200 ? "52주 신고가 " + t.newHigh.length + " : 신저가 " + t.newLow.length : "", false);
  slSection(slSec("테마 흐름"), th.length >= 2 ? "1등 " + th[0].name + " " + briefPct(th[0].ret) + "  ·  꼴찌 " + th[th.length - 1].name + " " + briefPct(th[th.length - 1].ret) : "", true);
  slSection(slSec("급등·급락"), mUp && mDn ? "▲ " + briefName(mUp) + " " + briefPct(mUp.ret1 != null ? mUp.ret1 : mUp.ret) + "  ·  ▼ " + briefName(mDn) + " " + briefPct(mDn.ret1 != null ? mDn.ret1 : mDn.ret) : "", true);
  slSection(slSec("돈이 몰린 곳"), hv ? briefName(hv) + " 거래대금이 평소의 " + hv.amtX.toFixed(1) + "배" : "", true);
  slSection(slSec("참고 종목"), "숫자 기준으로 걸러낸 후보 — 추천이 아니라 공부할 목록", true);
  slSection(slSec("오늘의 숫자"), nums.slice(0, 2).map(function (n) { return String(n.l).split(" — ")[0] + " " + n.v; }).join("  ·  "), true);
}

/* ---------- 채널 (운영자) ---------- */
function slChannel() {
  var el = document.getElementById("chHero"); if (!el || typeof chState === "undefined") return;
  var R = chState.brief, now = chState.now || { why: [], match: {} };
  var today = typeof perToday === "function" ? perToday() : [], next = typeof pubUpcoming === "function" ? pubUpcoming(7).filter(function (e) { return e.k !== "hol"; })[0] : null;
  var acts = [["전일 정리 카드", function () { cardsOpen("channel"); }]];
  today.forEach(function (k) { acts.push([PER_SETS[k].t + " 세트", function () { perOpen(k); }]); });
  if (typeof reelOpen === "function") { var rid = reelToday(), rt = (REEL_LIST.filter(function (x) { return x.id === rid; })[0] || {}).t; acts.push(["오늘의 릴스: " + rt, function () { reelOpen(rid); }]); }
  if (now.why.length && typeof storyOpen === "function") acts.push(["지금 신호 연구노트", function () { storyOpen(); }]);
  var head = "오늘 올릴 것 <em>" + acts.length + "개</em>";
  var kpis = [];
  if (R) {
    var i0 = (R.indexRow || [])[0], t = R.temp;
    if (i0) kpis.push({ l: i0.name, v: briefPct(i0.ret), cls: i0.ret >= 0 ? "u" : "d" });
    kpis.push({ l: "오른 종목", v: Math.round(t.upPct * 100) + "%", s: t.word, cls: t.upPct >= 0.5 ? "u" : "d" });
  }
  var md = (chState.mdd || []).filter(function (x) { return x && !x.err; })[0];
  if (md) kpis.push({ l: md.name + " 고점 대비", v: cPct(md.cur, 1), s: md.eps ? "과거 -10% 하락 " + md.eps + "번 중 " + md.deeper + "번이 더 깊었음" : "", cls: md.cur < -0.1 ? "d" : "" });
  kpis.push({ l: "지금 신호", v: now.why.length ? now.why.length + "개" : "없음", s: now.why.length ? now.why[0].split("→").pop().trim() : "평소 구간" });
  if (next && kpis.length < 4) kpis.push({ l: "다음 일정", v: next.d.slice(5).replace("-", "/"), s: String(next.t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim() });
  var pts = [];
  if (R && typeof thrInsights === "function") { var iss = chState.issues || []; pts = thrInsights(R, iss, "종목").slice(0, 2).map(slFirst); }
  if (next) pts.push("다음 일정: " + next.d.slice(5).replace("-", "/") + "(" + pubDow(next.d) + ") " + String(next.t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim());
  el.innerHTML = slHero({ kick: "오늘 발행 한눈에 · " + (typeof pubToday === "function" ? pubToday().slice(5).replace("-", "/") : ""), head: head, kpis: kpis.slice(0, 4), points: pts.slice(0, 3), acts: acts,
    nav: [["데일리 글", "미국 증시 데일리 브리핑"], ["MDD", "MDD 분석"], ["자산배분", "자산배분"], ["과거 사례", "상황별 과거 사례"]] });
  slBindHero(el, acts);
  var d = chState.daily && chState.daily.ok ? String(chState.daily.text).split("\n").filter(function (l) { return /S&P|나스닥|코스피/.test(l); })[0] : "";
  slSection(slSec("미국 증시 데일리 브리핑"), d ? d.replace(/^[■▲▼\s]+/, "") : "", true);
  slSection(slSec("MDD 분석"), md ? md.name + " 고점 대비 " + cPct(md.cur, 1) + (md.eps ? " · 과거 -10% 하락 " + md.eps + "번 중 " + md.deeper + "번이 더 깊었어요" : "") : "", true);
  slSection(slSec("자산배분"), now.why.length ? "지금 신호: " + now.why.map(function (w) { return w.split("→").pop().trim(); }).join(" · ") : "뚜렷한 신호 없음 — 기본 구성 기준", true);
  var sc = (chState.scen || []).filter(function (s) { return now.match && now.match[s.id]; });
  slSection(slSec("상황별 과거 사례"), sc.length ? "지금과 비슷한 상황: " + sc.map(function (s) { return s.tag; }).join(" · ") : "지금과 딱 맞는 과거 상황은 없어요", true);
}
