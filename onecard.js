/* ============================================================
   대표 카드 (v9.5) — 릴스용 한 장(1080×1920). 목적: 3초 안에 '무슨 내용인지' 알고, 궁금해서 게시물(상세 카드)로 넘어가게.
   ① 항목별 대표 카드: 오늘의 브리핑·채널 데이터의 '사실 목록'(f1, f2…)을 만들고 → 문구는 규칙 또는 OpenAI가 고르고 → 숫자는 언제나 데이터에서 채운다.
      AI는 숫자를 쓸 수 없다({f1} 자리표시만). AI 문구에 숫자가 섞이면 그 문구는 버리고 규칙 문구로 바꾼다.
   ② 내 글 카드: 붙여 넣은 글을 한 장으로. AI가 쓴 숫자는 입력 글에 있는 숫자인지 하나하나 대조하고, 안 맞으면 저장을 막는다.
   만든 뒤에는 '데이터 ↔ 카드'를 한 화면에서 비교(검증 화면).
   ============================================================ */
var OC_ST = { ai: null, model: "", used: 0, max: 0 };
var OC_N = 9;   // 게시물에 올리는 상세 카드 장수(기본) — 검증 화면에서 바꿀 수 있음

function ocNum(s) { return (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(function (x) { return x.replace(/,/g, "").replace(/\.0+$/, ""); }); }
function ocPct(x, d) { return briefPct(x, d); }
function ocTone(x) { return x > 0 ? "u" : x < 0 ? "d" : ""; }
function ocClean(s) { return String(s || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}₿]/gu, "").replace(/\s+/g, " ").trim(); }
function ocMk() { var R = briefState.result; return R && typeof cMktInfo === "function" ? cMktInfo(R) : null; }

/* ---------- 사실 목록 (항목별) ---------- */
var OC_ITEMS = [
  { k: "today", g: "brief", t: "오늘 시장 한 장", d: "지수 · 오른 비율 · 1등/꼴찌 업종 · 가장 많이 오르고 내린 것" },
  { k: "issues", g: "brief", t: "핵심 이슈 5", d: "1~2위만 보여주고 3~5위는 게시물에서" },
  { k: "themes", g: "brief", t: "업종(테마) 성적표", d: "1등 3개 · 꼴찌 2개" },
  { k: "movers", g: "brief", t: "급등 · 급락", d: "가장 많이 오른 3 · 내린 2" },
  { k: "money", g: "brief", t: "돈이 몰린 곳", d: "거래대금이 평소보다 몇 배" },
  { k: "sale", g: "brief", t: "세일 중 (고점 -20%)", d: "개수 + 가장 많이 빠진 3" },
  { k: "hilo", g: "brief", t: "신고가 · 신저가", d: "개수 + 신고가 이름" },
  { k: "news", g: "brief", t: "뉴스 브리핑", d: "기사 제목 3개 + 나머지는 게시물" },
  { k: "mdd", g: "channel", t: "고점 대비 지금 위치 (MDD)", d: "대표 자산이 고점에서 얼마나 빠져 있나" },
  { k: "signal", g: "channel", t: "지금 시장 신호", d: "금리 · 공포 · 추세 신호" },
  { k: "scen", g: "channel", t: "지금과 비슷한 과거", d: "비슷한 상황과 과거 사례 수" }
];
function ocSpec(k) {
  var R = briefState.result, mk = ocMk(), unit = R && R.market === "coin" ? "코인" : "종목", sec = R && R.market === "coin" ? "테마" : "업종";
  var mkName = mk ? mk.name : (R && R.market === "all" ? "전체" : ""), F = [], id = 0;
  function f(label, value, tone, note) { id++; F.push({ id: "f" + id, label: ocClean(label), value: ocClean(value), tone: tone || "", note: note || "" }); return "f" + id; }
  var sp = { k: k, title: (OC_ITEMS.filter(function (x) { return x.k === k; })[0] || {}).t, mk: null, facts: F, n: OC_N, kicker: "", hook: "", hero: "", rows: [], teaser: "" };
  if (/today|issues|themes|movers|money|sale|hilo|news/.test(k)) {
    if (!R) return null;
    sp.mk = mk; var srcDate = mk ? mk.date : "";
    var t = R.temp, i0 = R.indexRow[0], i1 = R.indexRow[1], th = R.themes || [], up = R.movers.up, dn = R.movers.down;
    function r1(s) { return s.ret1 != null ? s.ret1 : s.ret; }
    if (k === "today") {
      var a = i0 ? f(i0.name, ocPct(i0.ret), ocTone(i0.ret), "지수 종가 전일 대비") : null, b = i1 ? f(i1.name, ocPct(i1.ret), ocTone(i1.ret), "지수 종가 전일 대비") : null;
      var c = f("오른 " + unit + " 비율", Math.round(t.upPct * 100) + "%", t.upPct >= 0.5 ? "u" : "d", t.up + " / " + t.total + "개");
      var d = f("20일선 위 " + unit, Math.round(t.abovePct * 100) + "%", "", "20일 평균 위에 있는 비율");
      var e = th.length >= 2 ? f("1등 " + sec + " " + th[0].name, ocPct(th[0].ret), ocTone(th[0].ret), sec + " 평균 등락") : null, e2 = th.length >= 2 ? f("꼴찌 " + sec + " " + th[th.length - 1].name, ocPct(th[th.length - 1].ret), ocTone(th[th.length - 1].ret), sec + " 평균 등락") : null;
      var g1 = up[0] ? f("가장 많이 오른 " + briefName(up[0]), ocPct(r1(up[0])), "u", up[0].sym) : null, g2 = dn[0] ? f("가장 많이 내린 " + briefName(dn[0]), ocPct(r1(dn[0])), "d", dn[0].sym) : null;
      if (t.n200) f("52주 신고가 : 신저가", t.newHigh.length + " : " + t.newLow.length, "", "1년 최고·최저 경신 개수");
      sp.kicker = "오늘의 " + mkName + " 시장"; sp.hero = a || c;
      sp.hook = i0 && i0.ret > 0 && t.upPct < 0.45 ? i0.name + " {" + a + "}인데\n오른 " + unit + "은 {" + c + "}뿐" : i0 && i0.ret < 0 && t.upPct > 0.55 ? i0.name + " {" + a + "}인데\n오른 " + unit + "이 {" + c + "}" : i0 ? i0.name + " {" + a + "},\n내 계좌는 어땠나요?" : "오늘 " + mkName + " 시장, 3초 정리";
      sp.rows = [b, c, e, e2, g1, g2].filter(Boolean).slice(0, 5); sp.teaser = "업종·급등락·세일 종목은 게시물 {n}장에서";
    }
    if (k === "issues") {
      var iss = []; try { iss = issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular }); } catch (e) {}
      if (!iss.length) return null;
      iss.slice(0, 5).forEach(function (it, i) { f((i + 1) + "위 이슈", ocClean(it.title), "", ocClean(it.sub)); });
      sp.kicker = mkName + " 핵심 이슈 5"; sp.hero = "f1"; sp.rows = ["f2"]; sp.hook = "어제 " + mkName + " 시장에서\n평소와 가장 달랐던 것"; sp.teaser = "3~5위는 게시물에서 확인하세요";
      sp.hideRest = true;
    }
    if (k === "themes") {
      if (th.length < 4) return null;
      th.slice(0, 3).forEach(function (x, i) { f((i + 1) + "등 " + x.name, ocPct(x.ret), ocTone(x.ret), sec + " 평균 등락"); });
      th.slice(-2).reverse().forEach(function (x, i) { f((i ? "뒤에서 2등 " : "꼴찌 ") + x.name, ocPct(x.ret), ocTone(x.ret), sec + " 평균 등락"); });
      sp.kicker = mkName + " " + sec + " 성적표"; sp.hero = "f1"; sp.rows = ["f2", "f3", "f4", "f5"]; sp.hook = "어제 돈이 움직인 " + sec + ",\n1등과 꼴찌는?"; sp.teaser = sec + "별 대장 " + unit + "은 게시물에서";
    }
    if (k === "movers") {
      if (!up.length || !dn.length) return null;
      up.slice(0, 3).forEach(function (s, i) { f("급등 " + (i + 1) + " " + briefName(s), ocPct(r1(s)), "u", s.sym); });
      dn.slice(0, 2).forEach(function (s, i) { f("급락 " + (i + 1) + " " + briefName(s), ocPct(r1(s)), "d", s.sym); });
      sp.kicker = mkName + " 급등 · 급락"; sp.hero = "f1"; sp.rows = ["f2", "f3", "f4", "f5"]; sp.hook = "어제 가장 많이 오른 " + unit + ",\n이유는 기사에 있었어요"; sp.teaser = "급등·급락 전체와 관련 기사는 게시물에서";
    }
    if (k === "money") {
      var hv = (R.hotVol || []).slice(0, 4); if (!hv.length) return null;
      hv.forEach(function (s) { f(briefName(s) + " 거래대금", "평소의 " + s.amtX.toFixed(1) + "배", "", s.sym + " 최근 20일 평균 대비"); });
      sp.kicker = mkName + " 돈이 몰린 곳"; sp.hero = "f1"; sp.rows = F.slice(1).map(function (x) { return x.id; }); sp.hook = "평소보다 돈이\n몇 배나 몰린 " + unit; sp.teaser = "인기 " + unit + " 순위는 게시물에서";
    }
    if (k === "sale") {
      var n0 = R.numbers[0], n1 = R.numbers[1]; if (!n0 || !n0.list) return null;
      var s1 = f("52주 고점보다 20% 넘게 싼 " + unit, n0.v, "", (n0.n || "")), s2 = f("52주 고점 근처(-2% 이내)", n1 ? n1.v : "-", "", "");
      n0.list.slice(0, 3).forEach(function (s) { f(briefName(s) + " 고점 대비", ocPct(s.vsHi, 0), "d", s.sym); });
      sp.kicker = mkName + " 세일 중인 " + unit; sp.hero = s1; sp.rows = [s2].concat(F.slice(2).map(function (x) { return x.id; })); sp.hook = "고점보다 20% 넘게\n싸진 " + unit + "이 {" + s1 + "}"; sp.teaser = "세일 " + unit + " 전체 목록은 게시물에서";
    }
    if (k === "hilo") {
      if (!t.n200) return null;
      var h1 = f("52주 신고가", t.newHigh.length + "개", "u", "1년 최고가 경신"), h2 = f("52주 신저가", t.newLow.length + "개", "d", "1년 최저가 경신");
      t.newHigh.slice(0, 3).forEach(function (s) { f(briefName(s), "신고가", "u", s.sym); });
      sp.kicker = mkName + " 신고가 · 신저가"; sp.hero = h1; sp.rows = [h2].concat(F.slice(2).map(function (x) { return x.id; })); sp.hook = "1년 중 가장 비싸진 " + unit + "\n{" + h1 + "}"; sp.teaser = "신저가 " + unit + " 이름은 게시물에서";
    }
    if (k === "news") {
      var it = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items) || []; if (!it.length) return null;
      var nn = f("오늘 고른 기사", it.length + "개", "", "네이버 뉴스 검색");
      it.slice(0, 3).forEach(function (x) { f(cNewsClean(x.title).slice(0, 34), ocClean(x.press || "기사"), "", ""); });
      sp.kicker = mkName + " 아침 뉴스 브리핑"; sp.hero = nn; sp.rows = F.slice(1).map(function (x) { return x.id; }); sp.hook = "출근 전 3분,\n" + mkName + " 시장 기사 정리"; sp.teaser = "요약까지 다 본 기사는 게시물에서";
      sp.newsRows = true;
    }
    sp.src = (mk ? mk.name + " · " + mk.date : "") + " · 종가 기준 자동 집계 · 투자 권유 아님";
    return sp;
  }
  if (typeof chState === "undefined") return null;
  var now = chState.now || { why: [], match: {} };
  sp.src = "과거 데이터(종가) 자동 집계 · " + cDate(Date.now()) + " · 투자 권유 아님";
  if (k === "mdd") {
    var rows = (chState.mdd || []).filter(function (x) { return x && !x.err; }).slice(0, 5); if (!rows.length) return null;
    rows.forEach(function (x) { f(x.name + " 고점 대비", cPct(x.cur, 1), x.cur < -0.1 ? "d" : "", x.eps ? "과거 -10% 하락 " + x.eps + "번 중 " + x.deeper + "번이 더 깊었음" : ""); });
    sp.kicker = "고점 대비 지금 위치"; sp.hero = "f1"; sp.rows = F.slice(1).map(function (x) { return x.id; }); sp.hook = "내 자산, 고점에서\n얼마나 내려와 있을까?"; sp.teaser = "역대 몇 번째 하락인지는 게시물에서";
    return sp;
  }
  if (k === "signal") {
    if (!now.why.length) return null;
    now.why.slice(0, 4).forEach(function (w) { var p = String(w).split("→"); f(ocClean(p[1] || p[0]), ocClean(p[0]).replace(/^.*?:\s*/, ""), "", ""); });
    sp.kicker = "지금 시장 신호"; sp.hero = "f1"; sp.rows = F.slice(1).map(function (x) { return x.id; }); sp.hook = "지금 시장이 보내는\n신호 " + "{n0}가지"; sp.hookN0 = F.length + ""; sp.teaser = "이럴 때 과거엔 어땠는지 게시물에서";
    sp.hook = sp.hook.replace("{n0}", F.length);
    return sp;
  }
  if (k === "scen") {
    var sc = (chState.scen || []).filter(function (s) { return now.match && now.match[s.id]; }); if (!sc.length) return null;
    sc.slice(0, 4).forEach(function (s) { f(ocClean(s.tag), "과거 " + s.eps.length + "번", "", s.eps.map(function (e) { return e[0]; }).join(" · ")); });
    sp.kicker = "지금과 비슷한 과거"; sp.hero = "f1"; sp.rows = F.slice(1).map(function (x) { return x.id; }); sp.hook = "지금과 비슷했던 때,\n그 뒤 1년은?"; sp.teaser = "사례별 자산 성적은 게시물에서";
    return sp;
  }
  return null;
}

/* ---------- AI ---------- */
function ocTok() { try { return (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) { return ""; } }
function ocAiStatus() {
  return fetch("/api/channel?op=ai", { headers: { "x-owner": ocTok() }, cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { OC_ST.ai = !!(j && j.ai); OC_ST.model = j.model || ""; OC_ST.fallback = j.fallback || ""; OC_ST.used = j.used || 0; OC_ST.max = j.max || 0; return OC_ST; }).catch(function () { OC_ST.ai = false; return OC_ST; });
}
function ocAi(body) {
  return fetch("/api/channel?op=ai", { method: "POST", headers: { "x-owner": ocTok(), "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
}
var OC_REASON = { NO_KEY: "Vercel 환경변수 OPENAI_API_KEY가 없어요", DAILY_LIMIT: "오늘 AI 호출 한도를 다 썼어요", TIMEOUT: "AI 응답이 늦어요(40초)", REFUSED: "AI가 답을 거절했어요", BAD_JSON: "AI 응답 형식 오류", OWNER_ONLY: "운영자 모드가 꺼져 있어요" };
/* AI 문구 검사: 자리표시({f1},{n}) 밖에 숫자가 있으면 그 문구는 쓰지 않는다 */
function ocNoDigits(s) { return !/\d/.test(String(s).replace(/\{f\d+\}|\{n\}/g, "")); }
function ocApplyAi(sp, out) {
  var log = [], ids = sp.facts.map(function (x) { return x.id; }), nx = Object.assign({}, sp);
  function take(field, v, test) { if (v && test(v)) { nx[field] = ocClean(v).replace(/\\n/g, "\n"); log.push({ ok: true, t: field + ": AI 문구 사용" }); } else if (v) log.push({ ok: false, t: field + ": AI가 숫자를 직접 써서(또는 형식 오류) 규칙 문구로 대체 — \"" + String(v).slice(0, 40) + "\"" }); }
  take("hook", out.hook && String(out.hook).replace(/\\n/g, "\n"), function (v) { return ocNoDigits(v) && (v.match(/\{f\d+\}/g) || []).every(function (p) { return ids.indexOf(p.slice(1, -1)) >= 0; }); });
  take("kicker", out.kicker, ocNoDigits);
  take("teaser", out.teaser, ocNoDigits);
  if (out.hero && ids.indexOf(out.hero) >= 0) nx.hero = out.hero;
  var rows = (out.rows || []).filter(function (r) { return ids.indexOf(r.f) >= 0 && r.f !== nx.hero; });
  if (rows.length >= 2 && !sp.hideRest) {
    nx.rows = rows.slice(0, 5).map(function (r) { return r.f; }); nx.labels = {};
    rows.forEach(function (r) { if (r.label && ocNoDigits(r.label)) nx.labels[r.f] = ocClean(r.label); else if (r.label) log.push({ ok: false, t: r.f + " 이름표: 숫자가 있어 데이터 이름표 사용" }); });
    log.push({ ok: true, t: "줄 순서·선택: AI (" + nx.rows.join(", ") + ")" });
  }
  nx.aiLog = log; nx.byAi = true;
  return nx;
}

/* ---------- 그리기 ---------- */
var OC_DRAWN = null;
function ocWithLog(fn) {   // 카드에 실제로 그려진 글자를 모두 기록 → 숫자 대조
  var orig = window.cText; OC_DRAWN = [];
  window.cText = function (g, s) { OC_DRAWN.push(String(s)); return orig.apply(this, arguments); };
  try { return fn(); } finally { window.cText = orig; }
}
function ocFact(sp, id) { return sp.facts.filter(function (x) { return x.id === id; })[0]; }
function ocFill(sp, s) { return String(s || "").replace(/\{(f\d+)\}/g, function (m, id) { var x = ocFact(sp, id); return x ? "[[" + x.value + "]]" : ""; }).replace(/\{n\}/g, String(sp.n)); }
function ocToneC(t) { return t === "u" ? REEL_C.up : t === "d" ? REEL_C.down : REEL_C.gold2; }
function ocBadge(g, mk, y) {
  if (!mk) return;
  var P = REEL.P, bx = REEL.W - P;
  if (mk.date) { cText(g, mk.date, bx, y + 36, 34, 800, "#ffffff", "right"); bx -= cW(g, mk.date, 34, 800) + 16; }
  var bw = cW(g, mk.name, 36, 900) + 40; cRound(g, bx - bw, y - 6, bw, 58, 14, mk.c); cText(g, mk.name, bx - bw / 2, y + 36, 36, 900, "#ffffff", "center");
}
function ocItemCard(sp) {
  var c = rNew(), g = c.g, P = REEL.P, W = REEL.W - P * 2, mk = sp.mk;
  if (mk) { g.fillStyle = mk.c; g.fillRect(0, 0, REEL.W, 14); g.fillRect(0, 0, 14, REEL.H); }
  rBrand(g, REEL.TOP + 30); ocBadge(g, mk, REEL.TOP);
  var y = REEL.TOP + 130;
  cText(g, sp.kicker, P, y, 36, 800, REEL_C.gold2); y += 40;
  var lines = ocFill(sp, sp.hook).split("\n").slice(0, 3), size = rFitSize(g, lines, W, 88);
  lines.forEach(function (l, i) { rRich(g, l, P, y + size * 1.05 + i * size * 1.24, size, REEL_C.txt, REEL_C.gold2); });
  y += size * 1.05 + (lines.length - 1) * size * 1.24 + 50;
  // 주인공 숫자
  var hf = ocFact(sp, sp.hero);
  if (hf) {
    var long = hf.value.length > 9, hh = long ? 240 : 230;
    cRound(g, P, y, W, hh, 28, "rgba(255,255,255,0.07)"); g.fillStyle = mk ? mk.c : REEL_C.gold; g.fillRect(P, y + 26, 8, hh - 52);
    var lbl = (sp.labels && sp.labels[hf.id]) || hf.label;
    rWrap(g, lbl, P + 44, y + 64, W - 88, 34, 700, REEL_C.txt2, 42, 1);
    if (long) rWrap(g, hf.value, P + 44, y + 140, W - 88, 52, 900, ocToneC(hf.tone), 66, 2);
    else { var vs = 132; while (vs > 80 && cW(g, hf.value, vs, 900) > W - 88) vs -= 6; cText(g, hf.value, P + 40, y + hh - 50, vs, 900, ocToneC(hf.tone)); }
    y += hh + 30;
  }
  // 줄
  var rows = (sp.rows || []).map(function (id) { return ocFact(sp, id); }).filter(Boolean).slice(0, sp.hideRest ? 1 : 4), room = REEL.BOT - 190 - y - (sp.hideRest ? 220 : 0), rh = Math.min(140, Math.floor(room / Math.max(1, rows.length)));
  rows.forEach(function (x, i) {
    var yy = y + i * rh, lbl = (sp.labels && sp.labels[x.id]) || x.label;
    if (i) { g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(P, yy, W, 2); }
    if (sp.newsRows || x.value.length > 10) {
      if (!sp.newsRows) { cText(g, cFit(g, lbl, W - 16, 26, 700), P + 8, yy + 40, 26, 700, REEL_C.txt2); rWrap(g, x.value, P + 8, yy + 86, W - 16, 36, 800, ocToneC(x.tone) === REEL_C.gold2 ? REEL_C.txt : ocToneC(x.tone), 44, Math.max(1, Math.floor((rh - 60) / 44))); return; }
      rWrap(g, lbl, P + 8, yy + rh * 0.42, W - 16, 32, 700, REEL_C.txt, 40, 2); cText(g, x.value, REEL.W - P - 8, yy + rh - 14, 24, 600, REEL_C.dim, "right"); return; }
    var vw = cW(g, x.value, 46, 900); cText(g, cFit(g, lbl, W - vw - 60, 36, 700), P + 8, yy + rh / 2 + 14, 36, 700, REEL_C.txt);
    cText(g, x.value, REEL.W - P - 8, yy + rh / 2 + 16, 46, 900, ocToneC(x.tone), "right");
  });
  if (sp.hideRest) { var yy = y + rows.length * rh; ["3위", "4위", "5위"].forEach(function (r, i) { cRound(g, P, yy + 12 + i * 70, W, 56, 14, "rgba(255,255,255,0.05)"); cText(g, r + "  ????????", P + 24, yy + 52 + i * 70, 30, 800, REEL_C.dim); }); }
  // 게시물로
  var ty = REEL.BOT - 170;
  cRound(g, P, ty, W, 150, 24, "rgba(201,162,79,0.14)", REEL_C.gold);
  rWrap(g, ocFill(sp, sp.teaser).replace(/\[\[|\]\]/g, ""), P + 36, ty + 62, W - 72, 38, 800, REEL_C.txt, 46, 1);
  cText(g, "프로필 → 오늘 올린 게시물  @uphill.lab", P + 36, ty + 118, 28, 700, REEL_C.gold2);
  rWrap(g, sp.src, P, REEL.BOT + 34, W, 22, 500, REEL_C.dim, 30, 2);
  return c.cv;
}
/* 내 글 카드 */
function ocCustomCard(cs) {
  var c = rNew(), g = c.g, P = REEL.P, W = REEL.W - P * 2;
  rBrand(g, REEL.TOP + 30);
  var y = REEL.TOP + 100;
  if (cs.kicker) { var kw = cW(g, cs.kicker, 32, 800) + 44; cRound(g, P, y, kw, 56, 28, "rgba(201,162,79,0.2)"); cText(g, cs.kicker, P + 22, y + 39, 32, 800, REEL_C.gold2); y += 90; }
  var lines = String(cs.hook || "").split("\n").filter(Boolean).slice(0, 3), size = rFitSize(g, lines, W, 84);
  lines.forEach(function (l, i) { rRich(g, l, P, y + size + i * size * 1.24, size, REEL_C.txt, REEL_C.gold2); });
  y += size + (lines.length - 1) * size * 1.24 + 44;
  g.fillStyle = REEL_C.gold; g.fillRect(P, y, 110, 7); y += 40;
  var bottom = REEL.BOT - (cs.takeaway ? 210 : 60);
  if (cs.layout === "table" && cs.table && cs.table.rows && cs.table.rows.length) {
    var head = cs.table.head || [], rows = cs.table.rows, nc = Math.max(head.length, rows[0].length), rh = Math.min(110, Math.floor((bottom - y - 80) / rows.length)), fs = Math.max(24, Math.min(36, rh * 0.36));
    var cw = [W * (nc > 2 ? 0.34 : 0.45)]; for (var i = 1; i < nc; i++) cw.push((W - cw[0]) / (nc - 1));
    function cx(i) { var x = P; for (var k = 0; k < i; k++) x += cw[k]; return x; }
    if (head.length) { cRound(g, P, y, W, 70, 14, "rgba(201,162,79,0.22)"); head.forEach(function (h, i) { cText(g, cFit(g, h, cw[i] - 24, 28, 800), cx(i) + 18, y + 46, 28, 800, REEL_C.gold2); }); y += 80; }
    rows.forEach(function (r, ri) {
      if (ri % 2 === 0) cRound(g, P, y, W, rh - 6, 12, "rgba(255,255,255,0.05)");
      r.forEach(function (v, i) { var hi = /\[\[/.test(v); rWrap(g, cPlain(v), cx(i) + 18, y + rh / 2 + fs * 0.15, cw[i] - 30, fs, i ? 800 : 700, hi ? REEL_C.gold2 : i ? REEL_C.txt : REEL_C.txt2, fs * 1.2, 2); });
      y += rh;
    });
  } else {
    var pts = (cs.points || []).slice(0, 7), ph = Math.min(170, Math.floor((bottom - y) / Math.max(1, pts.length))), hs = Math.min(44, Math.max(32, ph * 0.28)), ds = Math.min(32, Math.max(25, ph * 0.2));
    pts.forEach(function (p, i) {
      var yy = y + i * ph;
      cRound(g, P, yy + 6, W, ph - 14, 20, i % 2 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.07)");
      var num = cs.layout === "steps" ? "STEP " + (i + 1) : String(i + 1).padStart(2, "0"), nw = cW(g, num, cs.layout === "steps" ? 26 : 44, 900);
      cText(g, num, P + 26, yy + 6 + (ph - 14) / 2 + 14, cs.layout === "steps" ? 26 : 44, 900, REEL_C.gold2);
      var x = P + 26 + nw + 24, mw = P + W - 24 - x, nl = p.d ? Math.min(2, rWrapN(g, p.d, mw, ds, 600)) : 0, blk = hs * 0.8 + (nl ? 12 + nl * ds * 1.3 : 0), hy = yy + 6 + (ph - 14 - blk) / 2 + hs * 0.8;
      cText(g, cFit(g, p.h, mw, hs, 800), x, hy, hs, 800, REEL_C.txt);
      if (p.d) rWrap(g, p.d, x, hy + 12 + ds, mw, ds, 600, REEL_C.txt2, ds * 1.3, 2);
    });
  }
  if (cs.takeaway) { var ty = REEL.BOT - 180; cRound(g, P, ty, W, 130, 22, "rgba(201,162,79,0.14)", REEL_C.gold); rWrap(g, cs.takeaway, P + 32, ty + 56, W - 64, 34, 800, REEL_C.txt, 44, 2); }
  rWrap(g, (cs.source ? "출처: " + cs.source + " · " : "") + "더 자세한 정리는 프로필 @uphill.lab", P, REEL.BOT + 34, W, 22, 500, REEL_C.dim, 30, 2);
  return c.cv;
}

/* ---------- 숫자 대조 ---------- */
function ocCheckNums(drawn, allowedText) {
  var allow = {}; ocNum(allowedText).forEach(function (x) { allow[x] = 1; });
  var bad = [], seen = {};
  drawn.filter(function (s) { return !/^\s*(\d{1,2}|STEP \d+)\s*$/.test(s); }).forEach(function (s) { ocNum(s).forEach(function (n) { if (!allow[n] && !seen[n]) { seen[n] = 1; bad.push({ n: n, where: s }); } }); });
  return bad;
}

/* ---------- 내 글 → 구조 (규칙) ---------- */
function ocParse(text, hint) {
  var L = String(text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  if (!L.length) return null;
  var title = L[0].replace(/^#+\s*/, ""), body = L.slice(1), tbl = body.filter(function (l) { return /\||\t/.test(l); });
  var cs = { kicker: hint || "", hook: title, layout: "list", points: [], table: { head: [], rows: [] }, takeaway: "", source: "" };
  if (tbl.length >= 2) {
    var rows = tbl.map(function (l) { return l.split(/\s*\|\s*|\t/).filter(function (x) { return x !== ""; }); }).filter(function (r) { return !r.every(function (x) { return /^[-:]+$/.test(x); }); });
    cs.layout = "table"; cs.table.head = rows[0]; cs.table.rows = rows.slice(1, 9);
  }
  body.filter(function (l) { return !/\||\t/.test(l); }).forEach(function (l) {
    if (/^(출처|source)\s*[:：]/i.test(l)) { cs.source = l.replace(/^[^:：]+[:：]\s*/, ""); return; }
    if (/^(결론|핵심|요약|한줄)\s*[:：]/.test(l)) { cs.takeaway = l.replace(/^[^:：]+[:：]\s*/, ""); return; }
    l = l.replace(/^([-·•*▶✔✓]|\d+[.)]|STEP\s*\d+)\s*/i, "");
    var m = l.match(/^(.{2,24}?)\s*(?:[:：—–]|\s-\s)\s*(.+)$/);
    cs.points.push(m ? { h: m[1], d: m[2] } : { h: l.length > 22 ? l.slice(0, 22) : l, d: l.length > 22 ? l.slice(22) : "" });
  });
  if (cs.layout !== "table") cs.points = cs.points.slice(0, 7);
  if (!cs.takeaway && cs.points.length > 7) cs.takeaway = "";
  return cs;
}

/* ---------- 화면: 검증(데이터 ↔ 카드) ---------- */
function ocFontsThen(draw, done) {
  CARD_TXT = ""; try { draw(); } catch (e) {}
  var txt = CARD_TXT.replace(/\s+/g, "");
  var p = document.fonts && document.fonts.load ? Promise.all([500, 600, 700, 800, 900].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })) : Promise.resolve();
  p.then(done);
}
function ocCaption(sp) {
  var hook = cPlain(ocFill(sp, sp.hook)).replace(/\n/g, " "), hf = ocFact(sp, sp.hero);
  var lines = [hf].concat((sp.rows || []).map(function (id) { return ocFact(sp, id); })).filter(Boolean).map(function (x) { return ((sp.labels && sp.labels[x.id]) || x.label) + " " + x.value; });
  if (sp.hideRest) lines.push("3~5위는 게시물에서");
  return hook + "\n\n" + lines.join("\n") + "\n\n" + cPlain(ocFill(sp, sp.teaser)) + "\n프로필 → 오늘 올린 게시물에서 전체 카드를 볼 수 있어요.\n\n※ " + sp.src + "\n\n#우상향연구소 #" + (sp.mk ? (sp.mk.k === "coin" ? "코인시황 #비트코인" : sp.mk.k === "us" ? "미국주식 #미국증시" : "국내주식 #코스피") : "주식초보 #재테크") + " #주식공부";
}
function ocOpenItem(k, useAi) {
  var sp = ocSpec(k);
  if (!sp) { alert("이 항목에 필요한 데이터가 아직 없어요. (채널 항목은 채널 화면 계산이 끝난 뒤, 뉴스는 카드를 한 번 만든 뒤 준비돼요)"); return; }
  var btn = document.querySelector('[data-oc="' + k + '"][data-ai="' + (useAi ? 1 : 0) + '"]'), old = btn ? btn.textContent : ""; if (btn) btn.textContent = "만드는 중…";
  var p = useAi ? ocAi({ mode: "item", title: sp.title, facts: sp.facts.map(function (x) { return { id: x.id, label: x.label, value: x.value }; }) }).then(function (j) {
    if (j && j.ok) { var nx = ocApplyAi(sp, j.out); nx.aiLog.unshift({ ok: true, t: "AI 모델: " + j.model + (j.tries && j.tries.length > 1 ? " (" + j.tries.join(" → ") + ")" : "") }); return nx; }
    var s2 = Object.assign({}, sp, { aiLog: [{ ok: false, t: "AI 실패: " + (OC_REASON[j && j.reason] || (j && j.reason) || "알 수 없음") + (j && j.detail ? " — " + j.detail : "") + (j && j.tries ? " [" + j.tries.join(" → ") + "]" : "") + " → 규칙 문구로 만들었어요" }] }); return s2;
  }).catch(function (e) { return Object.assign({}, sp, { aiLog: [{ ok: false, t: "AI 호출 실패: " + e.message + " → 규칙 문구" }] }); }) : Promise.resolve(sp);
  p.then(function (s) { if (btn) btn.textContent = old; ocShowItem(s); });
}
function ocShowItem(sp) {
  ocFontsThen(function () { ocItemCard(sp); }, function () {
    var cv = ocWithLog(function () { return ocItemCard(sp); }), drawn = OC_DRAWN.slice();
    var allowed = sp.facts.map(function (x) { return x.value + " " + x.label; }).join(" ") + " " + (sp.mk ? sp.mk.date : "") + " " + sp.src + " " + sp.n + " " + (sp.kicker || "") + " " + cPlain(ocFill(sp, sp.hook));
    // 문구(훅·머리말·이름표) 안의 숫자도 데이터에서 온 것만 허용: 데이터 값·이름표 + 날짜 + 장수
    var bad = ocCheckNums(drawn, sp.facts.map(function (x) { return x.value + " " + x.label; }).join(" ") + " " + (sp.mk ? sp.mk.date : "") + " " + sp.src + " " + sp.n + " 1 2 3 4 5");
    var used = {}; [sp.hero].concat(sp.rows || []).forEach(function (id) { used[id] = 1; }); (String(sp.hook).match(/\{(f\d+)\}/g) || []).forEach(function (p) { used[p.slice(1, -1)] = 1; });
    var url = cv.toDataURL("image/png"), day = pubToday().replace(/-/g, ""), box = document.createElement("div");
    var checks = [{ ok: !bad.length, t: bad.length ? "데이터에 없는 숫자 " + bad.length + "개: " + bad.map(function (b) { return b.n + " (" + b.where.slice(0, 24) + ")"; }).join(", ") : "카드의 모든 숫자가 데이터 값과 일치해요 (" + drawn.reduce(function (a, s) { return a + ocNum(s).length; }, 0) + "개 확인)" }]
      .concat(sp.mk ? [{ ok: !!sp.mk.date, t: "시장·날짜: " + sp.mk.name + " · " + (sp.mk.date || "날짜 없음") }] : []).concat(sp.aiLog || [{ ok: true, t: "문구: 규칙(데이터 기반)" }]);
    box.innerHTML = '<div class="ocV"><div class="ocVL">' +
      '<div class="ocChk">' + checks.map(function (c) { return '<div class="' + (c.ok ? "ok" : "bad") + '">' + (c.ok ? "통과" : "확인") + ' · ' + escapeHtml(c.t) + '</div>'; }).join("") + '</div>' +
      '<table class="ocT"><thead><tr><th>id</th><th>항목</th><th>값</th><th>근거</th><th>카드</th></tr></thead><tbody>' + sp.facts.map(function (x) { return '<tr class="' + (used[x.id] ? "on" : "") + '"><td>' + x.id + '</td><td>' + escapeHtml(x.label) + '</td><td><b>' + escapeHtml(x.value) + '</b></td><td class="briefDim">' + escapeHtml(x.note || "") + '</td><td>' + (used[x.id] ? (x.id === sp.hero ? "주인공" : "사용") : "") + '</td></tr>'; }).join("") + '</tbody></table>' +
      '<details class="chFold"><summary>문구 고치기</summary><div class="ocEd"><label>머리말<input data-e="kicker"></label><label>훅 (숫자는 {f1}처럼)<textarea data-e="hook" rows="2"></textarea></label><label>게시물 안내<input data-e="teaser"></label><label>게시물 장수<input data-e="n" type="number" min="1" max="20"></label><label>주인공 id<input data-e="hero"></label><label>줄 id (쉼표로)<input data-e="rows"></label><button class="primary" data-act="re">다시 그리기</button></div></details>' +
      '<div class="thrLbl" style="color:inherit;margin-top:10px">릴스 캡션</div><textarea class="thrText ocCap" style="min-height:150px;background:var(--card);color:inherit;border-color:var(--line)"></textarea><button class="chip" data-act="cap">캡션 복사</button>' +
      '</div><div class="ocVR"><img alt=""><div class="row" style="gap:6px;margin-top:8px"><button class="primary" data-act="save"' + (bad.length ? ' disabled title="숫자 대조를 통과해야 저장할 수 있어요"' : '') + '>이미지 저장</button><span class="briefDim">1080×1920 · 릴스 9:16</span></div></div></div>';
    box.querySelector("img").src = url;
    box.querySelector(".ocCap").value = ocCaption(sp);
    var E = function (k) { return box.querySelector('[data-e="' + k + '"]'); };
    E("kicker").value = sp.kicker; E("hook").value = sp.hook; E("teaser").value = sp.teaser; E("n").value = sp.n; E("hero").value = sp.hero; E("rows").value = (sp.rows || []).join(",");
    box.querySelector('[data-act="re"]').onclick = function () {
      var nx = Object.assign({}, sp, { kicker: E("kicker").value, hook: E("hook").value, teaser: E("teaser").value, n: +E("n").value || sp.n, hero: E("hero").value.trim(), rows: E("rows").value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), aiLog: (sp.aiLog || []).concat([{ ok: true, t: "직접 수정함" }]) });
      OC_N = nx.n; infoModal.close && infoModal.close(); ocShowItem(nx);
    };
    box.querySelector('[data-act="cap"]').onclick = function () { chCopy(box.querySelector(".ocCap").value, this); };
    box.querySelector('[data-act="save"]').onclick = function () { cardsDownload({ url: url, file: "uphill.lab_대표_" + (sp.mk ? sp.mk.name + "_" : "") + sp.k + "_" + day + ".png" }); };
    infoModal.open("대표 카드 · " + sp.title + (sp.mk ? " · " + sp.mk.name : ""), box);
  });
}
function ocOpenCustom(useAi) {
  var text = ($("ocText") || {}).value || "", hint = ($("ocHint") || {}).value || "", lay = ($("ocLayout") || {}).value || "auto";
  if (!text.trim()) { alert("카드로 만들 글을 넣어 주세요."); return; }
  var btn = $(useAi ? "ocGoAi" : "ocGo"), old = btn.textContent; btn.textContent = "만드는 중…";
  var base = ocParse(text, hint);
  var p = useAi ? ocAi({ mode: "custom", text: text, hint: hint }).then(function (j) {
    if (j && j.ok && j.out) { var o = j.out; return { cs: { kicker: ocClean(o.kicker || hint), hook: String(o.hook || base.hook).replace(/\\n/g, "\n"), layout: o.layout, points: o.points || [], table: o.table || { head: [], rows: [] }, takeaway: o.takeaway || "", source: o.source || "" }, log: [{ ok: true, t: "AI 정리 (" + (j.model || "") + (j.tries && j.tries.length > 1 ? " · " + j.tries.join(" → ") : "") + ")" }] }; }
    return { cs: base, log: [{ ok: false, t: "AI 실패: " + (OC_REASON[j && j.reason] || (j && j.reason)) + " → 규칙 정리" }] };
  }).catch(function (e) { return { cs: base, log: [{ ok: false, t: "AI 호출 실패: " + e.message + " → 규칙 정리" }] }; }) : Promise.resolve({ cs: base, log: [{ ok: true, t: "규칙 정리(줄 단위)" }] });
  p.then(function (r) { btn.textContent = old; if (lay !== "auto") r.cs.layout = lay; if (r.cs.layout === "table" && !(r.cs.table && r.cs.table.rows && r.cs.table.rows.length)) r.cs.layout = "list"; ocShowCustom(r.cs, text, r.log); });
}
function ocShowCustom(cs, text, log) {
  ocFontsThen(function () { ocCustomCard(cs); }, function () {
    var cv = ocWithLog(function () { return ocCustomCard(cs); }), drawn = OC_DRAWN.slice(), bad = ocCheckNums(drawn, text);
    var url = cv.toDataURL("image/png"), day = pubToday().replace(/-/g, ""), box = document.createElement("div");
    var hiIn = escapeHtml(text).replace(/\d[\d,]*(?:\.\d+)?/g, function (m) { return '<mark>' + m + '</mark>'; });
    box.innerHTML = '<div class="ocV"><div class="ocVL"><div class="ocChk">' +
      [{ ok: !bad.length, t: bad.length ? "입력 글에 없는 숫자 " + bad.length + "개: " + bad.map(function (b) { return b.n + " (" + b.where.slice(0, 24) + ")"; }).join(", ") + " — 아래 편집창에서 고치거나 '확인했음'을 눌러야 저장돼요" : "카드의 모든 숫자가 입력 글에 있어요" }].concat(log).map(function (c) { return '<div class="' + (c.ok ? "ok" : "bad") + '">' + (c.ok ? "통과" : "확인") + ' · ' + escapeHtml(c.t) + '</div>'; }).join("") + '</div>' +
      '<div class="thrLbl" style="color:inherit">입력한 글 (숫자 표시)</div><div class="ocIn">' + hiIn.replace(/\n/g, "<br>") + '</div>' +
      '<details class="chFold" open><summary>카드 내용 고치기 (JSON)</summary><textarea class="ocJson" spellcheck="false"></textarea><button class="primary" data-act="re">다시 그리기</button></details>' +
      '</div><div class="ocVR"><img alt=""><div class="row" style="gap:6px;margin-top:8px"><button class="primary" data-act="save"' + (bad.length ? " disabled" : "") + '>이미지 저장</button>' + (bad.length ? '<button class="chip" data-act="ok">숫자 확인했음</button>' : '') + '<span class="briefDim">1080×1920</span></div></div></div>';
    box.querySelector("img").src = url; box.querySelector(".ocJson").value = JSON.stringify(cs, null, 1);
    box.querySelector('[data-act="re"]').onclick = function () { var o; try { o = JSON.parse(box.querySelector(".ocJson").value); } catch (e) { alert("JSON 형식 오류: " + e.message); return; } infoModal.close && infoModal.close(); ocShowCustom(o, text, [{ ok: true, t: "직접 수정함" }]); };
    var ok = box.querySelector('[data-act="ok"]'); if (ok) ok.onclick = function () { box.querySelector('[data-act="save"]').disabled = false; ok.textContent = "확인함"; };
    box.querySelector('[data-act="save"]').onclick = function () { cardsDownload({ url: url, file: "uphill.lab_한장카드_" + day + ".png" }); };
    infoModal.open("한 장 카드 · 검증", box);
  });
}

/* ---------- 탭 ---------- */
function ocRender() {
  var box = $("ocBody"); if (!box) return;
  if (typeof briefState !== "undefined" && !briefState.result && typeof loadBrief === "function") { try { loadBrief(false); } catch (e) {} }
  if (typeof chState !== "undefined" && !chState._init && typeof renderChannel === "function") { try { renderChannel(); } catch (e) {} }
  var R = briefState.result, mk = ocMk();
  var h = '<div id="ocAiLine" class="briefDim" style="margin-bottom:10px">AI 연결 확인 중…</div>';
  h += '<h3 class="chSub" style="margin-top:4px">① 항목별 대표 카드 <small>릴스 한 장 → 게시물(상세 카드)로 유입</small></h3>';
  h += '<div class="pills" style="margin-bottom:8px">' + Object.keys(BRIEF_MKT).map(function (k) { return '<button data-ocm="' + k + '"' + (R && briefState.market === k ? ' class="active"' : '') + '>' + BRIEF_MKT[k] + '</button>'; }).join("") + '</div>';
  h += '<div class="briefDim" style="margin-bottom:8px">' + (R ? (mk ? mk.name + " · " + mk.date : "전체 시장") + " 데이터 · 숫자는 언제나 데이터에서 채우고, AI는 문구와 순서만 골라요" : "오늘의 브리핑 데이터를 불러오는 중… 잠시 뒤 다시 열어 주세요") + '</div>';
  ["brief", "channel"].forEach(function (gp) {
    h += '<div class="perCal" style="margin-bottom:10px">' + OC_ITEMS.filter(function (x) { return x.g === gp; }).map(function (x) {
      return '<div class="perRow"><div class="perBody"><b>' + escapeHtml(x.t) + (gp === "channel" ? ' <small class="briefDim">채널</small>' : '') + '</b><small>' + escapeHtml(x.d) + '</small></div><div class="row" style="gap:4px;flex:0 0 auto"><button class="chip" data-oc="' + x.k + '" data-ai="0">규칙</button><button class="primary" data-oc="' + x.k + '" data-ai="1">AI</button></div></div>'; }).join("") + '</div>';
  });
  h += '<h3 class="chSub">② 내 글로 한 장 카드 <small>인스타 글 · 정책 내용 · 유튜브/책 메모</small></h3>' +
    '<div class="ocForm"><input id="ocHint" placeholder="주제 꼬리표 (예: 디딤돌대출, 책 메모) — 비워도 돼요">' +
    '<textarea id="ocText" placeholder="첫 줄 = 제목&#10;- 항목: 설명&#10;- 항목: 설명&#10;표는 | 로 칸을 나눠요 (예: 소득 | 금리)&#10;핵심: 마지막 한 줄 요약&#10;출처: 기관·책 이름"></textarea>' +
    '<div class="row" style="gap:6px"><select id="ocLayout"><option value="auto">모양 자동</option><option value="list">리스트</option><option value="table">표</option><option value="steps">순서(STEP)</option></select><button class="chip" id="ocGo">규칙으로 만들기</button><button class="primary" id="ocGoAi">AI로 정리해서 만들기</button></div>' +
    '<div class="briefDim" style="margin-top:6px">AI가 쓴 숫자는 입력한 글의 숫자와 하나하나 대조해요. 안 맞는 숫자가 있으면 저장 버튼이 잠겨요.</div></div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-ocm]"), function (b) { b.onclick = function () { switchBriefMarket(b.getAttribute("data-ocm")); setTimeout(ocRender, 300); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-oc]"), function (b) { b.onclick = function () {
    var k = b.getAttribute("data-oc"), ai = b.getAttribute("data-ai") === "1";
    var go = function () { ocOpenItem(k, ai); };
    if (k === "news" && !(CARD_NEWS.items && CARD_NEWS.items.length) && typeof cardsNewsFetch === "function") { b.textContent = "기사 받는 중…"; cardsNewsFetch(briefState.result).then(function () { b.textContent = ai ? "AI" : "규칙"; go(); }, go); } else go(); }; });
  $("ocGo").onclick = function () { ocOpenCustom(false); };
  $("ocGoAi").onclick = function () { ocOpenCustom(true); };
  ocAiStatus().then(function (s) { var el = $("ocAiLine"); if (!el) return; el.innerHTML = s.ai ? "AI 연결됨 · " + escapeHtml(s.model) + (s.fallback ? " (안 되면 " + escapeHtml(s.fallback) + ")" : "") + " · 오늘 " + s.used + " / " + s.max + "회 사용" : "AI 미연결 — Vercel 환경변수 <b>OPENAI_API_KEY</b>를 넣으면 'AI' 버튼이 동작해요. 지금은 '규칙' 버튼만 쓰세요(무료)."; });
  if (!R) setTimeout(function () { if (currentTab === "onecard" && briefState.result) ocRender(); }, 4000);
}
