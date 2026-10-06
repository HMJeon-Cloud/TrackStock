/* ============================================================
   정기 발행 세트 (v8.4) — 매일 / 일요일 / 월요일 / 월초 / 월말
     daily        매일        전일 이슈 정리          → 기존 오늘의 브리핑 카드 (cards.js)
     weekReview   일요일      한 주 이슈 정리         → 주간 핵심 이슈 5 · 자산 성적표 · 테마 · 급등락 · 가장 큰 하루 · 숫자 · 돈이 몰린 곳
     weekPreview  월요일      한 주 예상 이슈         → 이번 주 일정 · 볼 것 3가지 · 지난주 흐름 이어질까 · 적립 체크 · 용어
     monthReview  월말        한 달 이슈 정리         → 월간 핵심 이슈 5 · 자산 성적표 · 테마 · 급등락 · 큰 하루·VIX · 월초에 샀다면 · 과거 같은 달과 비교
     monthPreview 월초        한 달 예상 이슈         → 이달 일정 · 이달은 과거에 어땠나(계절성) · 역사 속 이달 · 적립 계획
   모든 카드는 cards.js의 TrackApt 틀(cNew/cHead/cRow/cBox/cFoot)을 그대로 쓴다.
   ============================================================ */
var PER_SETS = {
  weekReview: { t: "📅 한 주 정리", when: "일요일", tag: "WEEKLY REVIEW", mode: "week" },
  weekPreview: { t: "🔭 한 주 예상", when: "월요일", tag: "WEEKLY PREVIEW" },
  monthReview: { t: "📆 한 달 정리", when: "월말 (마지막 거래일~말일)", tag: "MONTHLY REVIEW", mode: "month" },
  monthPreview: { t: "🔭 한 달 예상", when: "월초 (1~3일)", tag: "MONTHLY PREVIEW" }
};
var PER_ASSETS = [["^GSPC", "S&P500"], ["^IXIC", "나스닥"], ["^KS11", "코스피"], ["^KQ11", "코스닥"], ["KRW=X", "달러/원"], ["TLT", "미국 장기채"], ["GLD", "금"], ["USO", "원유"], ["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"]];
var PER_SEASON = [["SPY", "S&P500"], ["^KS11", "코스피"], ["QQQ", "나스닥100"], ["GLD", "금"], ["BTC-USD", "비트코인"]];
var perState = { hist: {} };
/* 빈 공간에 들어가는 '알아두면 좋은 점' (cards.js의 CARD_TIP에 추가) */
Object.assign(CARD_TIP, {
  per_assets: ["자산 성적표를 보는 이유", "주식·채권·금·원유·환율·코인은 같은 뉴스에 다르게 반응해요. 한 주, 한 달 단위로 순위가 뒤바뀌는 걸 보면 '하나에 몰아 담지 않는 이유'가 자연스럽게 보여요."],
  per_theme: ["기간 테마 순위 읽는 법", "하루 순위는 소음이 많지만 한 주·한 달 평균은 돈의 방향을 조금 더 보여줘요. 다만 1등 테마가 다음 기간에도 1등일 확률은 반반에 가까워요."],
  per_movers: ["급등·급락 종목을 볼 때", "크게 오른 종목은 '왜 올랐는지'보다 '이미 얼마나 올랐는지'를 먼저 보세요. 급락 종목은 떨어진 이유가 일시적인지 구조적인지에 따라 전혀 다른 이야기가 돼요."],
  per_bigday: ["가장 큰 하루가 중요한 이유", "장기 수익의 대부분은 며칠의 큰 상승일에 만들어져요. 그런 날은 대개 큰 하락일 바로 근처에 있어서, 무서워서 팔고 나가면 좋은 날도 함께 놓치기 쉬워요."],
  per_numbers: ["세일 중 종목 수가 말해주는 것", "52주 고점 대비 -20% 이상인 종목이 많을수록 시장이 넓게 눌려 있다는 뜻이에요. 반대로 신고가 근처 종목이 늘면 시장 전체가 강한 구간이에요."],
  per_money: ["거래대금이 몰린 종목", "거래대금 급증은 관심이 쏠렸다는 신호일 뿐 방향을 알려주진 않아요. 급증 뒤에는 되돌림도 큰 편이라, 뒤늦게 올라타기보다 관찰 목록에 넣어 두는 쪽이 편해요."],
  per_watch: ["예상 카드의 역할", "이 카드는 '오를지 내릴지'가 아니라 '무엇을 보면 되는지'만 담아요. 일정 전후에 변동이 커진다는 사실을 미리 알면, 흔들리는 날에도 규칙대로 움직이기 쉬워요."],
  per_cont: ["흐름이 이어질까?", "지난주 1등이 이번 주 1등인 경우는 생각보다 적어요. 이미 오른 폭이 클수록 '추격'이 되기 쉬우니, 오른 이유보다 가격 위치를 먼저 보세요."],
  per_dca: ["적립식의 핵심", "적립식은 싸게 사는 기술이 아니라 '멈추지 않는' 기술이에요. 가격이 내려가 있으면 같은 돈으로 더 많이 사게 되고, 올라 있으면 덜 사게 돼서 평균 단가가 자연히 맞춰져요."],
  per_cal: ["일정 카드를 보는 법", "FOMC·CPI·고용·금통위 발표 전후엔 변동이 커지는 경향이 있어요. 미국 지표는 한국 시간 밤 9시 반(서머타임 종료 후 10시 반)에 나와요."],
  per_season: ["계절성은 참고일 뿐", "'과거 이 달에 올랐다'는 확률이지 약속이 아니에요. 같은 달이라도 해마다 결과가 크게 달랐어요. 계절성에 돈을 걸기보다 '이 달에 이런 말이 나오겠구나' 정도로만 알아 두세요."],
  per_history: ["과거 사건을 보는 이유", "그때는 세상이 끝날 것 같았던 사건도 지금 장기 차트에선 작은 점이에요. 다음 위기 때 '이번엔 다르다'는 말이 나올 때 이 카드를 떠올려 보세요."],
  per_last: ["지난달 1위와 이달", "지난달 1위 자산이 이달도 1위일 보장은 없어요. 성적표는 '왜 나눠 담는지'를 확인하는 용도이지, 1위를 쫓아가라는 뜻이 아니에요."]
});


/* ---------- 오늘 어떤 세트를 올릴 날인지 ---------- */
function perToday() {
  var d = new Date(Date.now() + 9 * 3600e3), dow = d.getUTCDay(), dom = d.getUTCDate();
  var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(), out = [];
  if (dom <= 3) out.push("monthPreview");
  if (dom >= last - 2) out.push("monthReview");
  if (dow === 0) out.push("weekReview");
  if (dow === 1) out.push("weekPreview");
  return out;
}
function perMonthName(d) { d = d || new Date(Date.now() + 9 * 3600e3); return (d.getUTCMonth() + 1) + "월"; }
/* ---------- 달력 구간 (v8.4) ----------
   한 주 = 월~일 (오늘이 속한 주), 한 달 = 1일~말일 (오늘이 속한 달). prev=true면 지난주/지난달.
   from/to는 KST 자정 기준 ms. 정리 세트는 이 구간을 BRIEF_WIN으로 걸어 '구간 시작 전 종가 → 구간 안 마지막 종가'로 계산한다. */
function perKst() { return new Date(Date.now() + 9 * 3600e3); }
function perYmd(d) { return d.toISOString().slice(0, 10); }
function perKstMs(ymd) { return Date.parse(ymd + "T00:00:00+09:00"); }
function perWindow(kind, prev) {
  var d = perKst(), isM = /month/.test(kind), s, e;
  if (isM) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + (prev ? -1 : 0);
    s = new Date(Date.UTC(y, m, 1)); e = new Date(Date.UTC(y, m + 1, 0));
  } else {
    var dow = (d.getUTCDay() + 6) % 7;   // 월=0 … 일=6
    s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow - (prev ? 7 : 0))); e = new Date(s.getTime() + 6 * 86400e3);
  }
  var sY = perYmd(s), eY = perYmd(e);
  return { s: sY, e: eY, from: perKstMs(sY), to: perKstMs(eY) + 86400e3 - 1, isM: isM,
    txt: cDate(perKstMs(sY)) + " ~ " + cDate(perKstMs(eY)), short: sY.slice(5).replace("-", ".") + "~" + eY.slice(5).replace("-", "."),
    series: isM ? sY.slice(0, 7).replace("-", ".") : sY.slice(0, 4) + " W" + perIsoWeek(s) };
}
function perIsoWeek(d) { var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); var dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400e3 + 1) / 7); }
/* 구간 안에서 '있어야 하는' 마지막 거래일 (오늘 이전, 주말·등록된 휴장 제외) */
function perExpectedLast(win, mkt) {
  var today = perYmd(perKst()), end = win.e < today ? win.e : today;
  // 미국 데이터는 다음날 아침(KST)에 들어오므로, 오늘이 구간 안이면 어제까지가 기대치
  if (mkt === "us" && end === today) end = perYmd(new Date(perKstMs(today) - 86400e3 + 9 * 3600e3));
  if (mkt === "kr" && end === today && perKst().getUTCHours() < 16) end = perYmd(new Date(perKstMs(today) - 86400e3 + 9 * 3600e3));
  for (var i = 0; i < 10; i++) {
    var dd = perYmd(new Date(perKstMs(end) - i * 86400e3 + 9 * 3600e3)); if (dd < win.s) return null;
    if (!(typeof pubIsHoliday === "function" ? pubIsHoliday(mkt, dd) : (new Date(dd + "T00:00:00+09:00").getDay() % 6 === 0))) return dd;
  }
  return null;
}
/* 정리 세트 정확성 점검 — 하나라도 fail이면 발행용 생성 차단 */
function perVerify(kind) {
  var S = PER_SETS[kind], win = perWindow(kind), recent = perRecent(), out = [];
  if (!recent) return { ok: false, items: [{ ok: false, t: "데이터를 아직 못 불러왔어요" }], win: win };
  if (!S.mode) {   // 예상 세트: 경고만
    var up = typeof pubUpcoming === "function" ? pubUpcoming(win.isM ? 31 : 7) : [];
    out.push({ ok: true, t: "예상 세트는 '무엇을 볼지'만 담고 방향 예측은 넣지 않아요" });
    out.push({ ok: true, t: "일정 " + up.length + "건 — 확정 전 항목은 카드에 '(예정)'으로 표시돼요" });
    return { ok: true, items: out, win: win };
  }
  function lastIn(sym) { var x = recent.symbols[sym]; if (!x || !x.t) return null; for (var k = x.t.length - 1; k >= 0; k--) { var ms = x.t[k] * 1000; if (ms <= win.to && x.c[k] != null) return perYmd(new Date(ms + 9 * 3600e3)); } return null; }
  var kr = lastIn("^KS11"), us = lastIn("^GSPC"), ek = perExpectedLast(win, "kr"), eu = perExpectedLast(win, "us");
  function fmt(d) { return d ? d.slice(5).replace("-", "/") : "-"; }
  var okK = !ek || (kr && kr >= ek), okU = !eu || (us && us >= eu);
  out.push({ ok: okU, w: !okU, t: "미국 데이터: " + fmt(us) + " 마감까지 반영" + (okU ? " — 구간 안 마지막 거래일(" + fmt(eu) + ")과 일치" : " — " + fmt(eu) + " 마감 데이터가 아직 없어요. 아침 수집(08:30) 후 다시 만드세요") });
  out.push({ ok: okK, w: !okK, t: "한국 데이터: " + fmt(kr) + " 마감까지 반영" + (okK ? (ek ? " — 구간 안 마지막 거래일(" + fmt(ek) + ")과 일치" : " — 구간 안 한국 거래일이 아직 없어요(휴장)") : " — " + fmt(ek) + " 마감 데이터가 아직 없어요") });
  var today = perYmd(perKst()), early = today < win.e;
  if (early) out.push({ ok: false, w: false, t: "구간이 아직 안 끝났어요 (" + win.txt + ") — 지금 만들면 '" + fmt(today) + "까지' 중간 정리예요. 카드에 그렇게 표시돼요" });
  var tag = win.isM ? "월말" : "일요일";
  var dow = perKst().getUTCDay();
  if (!win.isM && dow !== 0 && dow !== 6) out.push({ ok: false, w: false, t: "한 주 정리는 일요일(또는 토요일 아침 이후)에 만드는 걸 권해요 — 지금은 " + "일월화수목금토"[dow] + "요일" });
  BRIEF_WIN = { from: win.from, to: win.to };
  var R = briefCompute(recent, { mode: S.mode }); BRIEF_WIN = null;
  var qn = R.quality ? R.quality.stale.length + R.quality.spike.length : 0;
  out.push({ ok: true, t: qn ? "오류 의심 종목 " + qn + "개는 모든 집계에서 자동 제외 (" + R.quality.stale.concat(R.quality.spike).slice(0, 4).map(function (x) { return briefName(x); }).join(", ") + ")" : "오류 의심 종목 없음 (오래된 값·하루 40%↑ 급변 검사)" });
  BRIEF_WIN = { from: win.from, to: win.to }; var sp = recent.symbols["^GSPC"] ? briefStats("^GSPC", recent.symbols["^GSPC"], S.mode) : null, ksx = recent.symbols["^KS11"] ? briefStats("^KS11", recent.symbols["^KS11"], S.mode) : null; BRIEF_WIN = null;
  out.push({ ok: true, t: "집계 종목 " + R.count + "개 · 구간 거래일 미국 " + (sp ? sp.winDays : 0) + "일 / 한국 " + (ksx ? ksx.winDays : 0) + "일 · 수집 " + (recent.generated ? kstFmt(recent.generated) : "-") });
  var gen = recent.generated ? (Date.now() - Date.parse(recent.generated)) / 3600e3 : 999;
  if (gen > 40) out.push({ ok: false, w: true, t: "마지막 수집이 " + Math.round(gen) + "시간 전이에요 — 수집이 멈췄는지 확인" });
  return { ok: out.every(function (x) { return x.ok || !x.w; }), hard: out.some(function (x) { return x.w; }), early: early, items: out, win: win };
}
/* 검토용 도장 (발행 금지) */
function perStamp(cv, txt) {
  var g = cv.getContext("2d"); g.save(); g.translate(CARD.W / 2, CARD.H / 2); g.rotate(-Math.PI / 7); g.globalAlpha = 0.22;
  cFont(g, 110, 800); g.fillStyle = CARD_C.up; g.textAlign = "center"; g.fillText(txt, 0, 40);
  g.lineWidth = 10; g.strokeStyle = CARD_C.up; g.strokeRect(-430, -70, 860, 150); g.restore();
}
/* ---------- 데이터 ---------- */
function perRecent() { return (typeof chState !== "undefined" && chState.recent) || (typeof briefState !== "undefined" && briefState.recent) || null; }
function perLoad(list) {
  return Promise.all(list.map(function (sym) {
    if (perState.hist[sym]) return null;
    return getChartData(sym, "max").then(function (p) { perState.hist[sym] = (p && p.rows) || []; }).catch(function () { perState.hist[sym] = []; });
  }));
}
/* 기간 내 하루 등락 목록 (recent의 일봉에서) */
function perDays(sym, back) {
  var d = perRecent(), x = d && d.symbols[sym]; if (!x || !x.c) return [];
  var out = [], n = x.c.length;
  for (var i = Math.max(1, n - back); i < n; i++) if (x.c[i] != null && x.c[i - 1]) out.push({ t: x.t[i] * 1000, ch: x.c[i] / x.c[i - 1] - 1, c: x.c[i] });
  return out;
}
/* 구간 안 하루 등락 (달력 구간) */
function perDaysWin(sym, win) {
  var d = perRecent(), x = d && d.symbols[sym]; if (!x || !x.c) return [];
  var out = [];
  for (var i = 1; i < x.c.length; i++) { var ms = x.t[i] * 1000; if (ms < win.from || ms > win.to || x.c[i] == null || !x.c[i - 1]) continue; out.push({ t: ms, ch: x.c[i] / x.c[i - 1] - 1, c: x.c[i], d: perYmd(new Date(ms + 9 * 3600e3)) }); }
  return out;
}
/* 날짜별(주) / 주차별(월) 흐름 표 */
function perFlowTable(win, by) {
  var head = ["날짜", "코스피", "S&P500", "나스닥", "비트코인"], keys = ["^KS11", "^GSPC", "^IXIC", "BTC-USD"], rows = [];
  function cell(v) { return v == null ? "" : (v > 0 ? "[[" + cPct(v) + "]]" : cPct(v)); }
  if (!win.isM) {
    for (var i = 0; i < 7; i++) {
      var dd = perYmd(new Date(win.from + i * 86400e3 + 9 * 3600e3)), dow = "일월화수목금토"[new Date(dd + "T00:00:00+09:00").getDay()];
      if (dd >= perYmd(perKst())) { var has = keys.some(function (k) { return (by[k] || []).some(function (q) { return q.d === dd; }); }); if (!has) break; }
      var r = [dd.slice(5).replace("-", "/") + "(" + dow + ")"]; var any = false;
      keys.forEach(function (k) { var x = (by[k] || []).filter(function (q) { return q.d === dd; })[0]; r.push(x ? cell(x.ch) : ""); if (x) any = true; });
      if (any || dow !== "토" && dow !== "일") rows.push(r);
    }
  } else {
    head[0] = "주차"; var wk = {};
    keys.forEach(function (k) { (by[k] || []).forEach(function (q) { var d = new Date(q.d + "T00:00:00+09:00"), mon = new Date(d.getTime() - ((d.getDay() + 6) % 7) * 86400e3), id = perYmd(new Date(mon.getTime() + 9 * 3600e3)); wk[id] = wk[id] || { lo: q.d, hi: q.d }; wk[id][k] = (wk[id][k] || 1) * (1 + q.ch); if (q.d < wk[id].lo) wk[id].lo = q.d; if (q.d > wk[id].hi) wk[id].hi = q.d; }); });
    Object.keys(wk).sort().forEach(function (id, i) { var w = wk[id], r = [(i + 1) + "주차 (" + w.lo.slice(8).replace(/^0/, "") + "~" + w.hi.slice(8).replace(/^0/, "") + "일)"]; keys.forEach(function (k) { r.push(w[k] != null ? cell(w[k] - 1) : ""); }); rows.push(r); });
  }
  return { head: head, rows: rows };
}
function perFmtDay(t) { var d = new Date(t + 9 * 3600e3); return (d.getUTCMonth() + 1) + "/" + d.getUTCDate() + "(" + "일월화수목금토"[d.getUTCDay()] + ")"; }
/* 계절성: 이 달력 달의 과거 수익률 (연도별 월말 종가 비교) */
function perSeason(sym, month) {
  var r = perState.hist[sym]; if (!r || r.length < 300) return null;
  var byYM = {}; r.forEach(function (x) { var d = new Date(x.t); byYM[d.getUTCFullYear() * 100 + d.getUTCMonth() + 1] = x.c; });
  var yrs = [], now = new Date(Date.now() + 9 * 3600e3), thisY = now.getUTCFullYear();
  for (var y = thisY - 15; y < thisY; y++) {
    var prev = month === 1 ? (y - 1) * 100 + 12 : y * 100 + month - 1, cur = y * 100 + month;
    if (byYM[prev] && byYM[cur]) yrs.push({ y: y, r: byYM[cur] / byYM[prev] - 1 });
  }
  if (yrs.length < 5) return null;
  var avg = yrs.reduce(function (a, x) { return a + x.r; }, 0) / yrs.length, up = yrs.filter(function (x) { return x.r > 0; }).length;
  var best = yrs.slice().sort(function (a, b) { return b.r - a.r; })[0], worst = yrs.slice().sort(function (a, b) { return a.r - b.r; })[0];
  return { n: yrs.length, avg: avg, up: up, best: best, worst: worst, from: yrs[0].y };
}
/* 월초(또는 주초) 대비 지금 — '그때 100만원 샀다면' */
function perSince(sym, mode) {
  var d = perRecent(), x = d && d.symbols[sym]; if (!x || !x.c) return null;
  var back = mode === "month" ? 21 : 5, n = x.c.length; if (n <= back) return null;
  return x.c[n - 1] / x.c[n - 1 - back] - 1;
}
function perNow() { var r = perRecent(); return r && typeof chDetectNow === "function" ? chDetectNow(r) : { match: {}, why: [] }; }

/* ---------- 카드 묶음 ---------- */
function perCards(kind, draft) {
  var S = PER_SETS[kind], recent = perRecent(); if (!recent) return [];
  var out = [], mode = S.mode, pop = (typeof briefState !== "undefined" && briefState.popular) || null;
  var win = perWindow(kind), prevWin = perWindow(kind, true);
  CARD_STYLE = "regular"; CARD_SERIES = S.tag + " · " + win.series;
  // 정리 세트는 이 달력 구간으로, 예상 세트의 '지난주/지난달' 부분은 직전 구간으로 계산
  BRIEF_WIN = { from: (mode ? win : prevWin).from, to: (mode ? win : prevWin).to };
  try { out = perCardsInner(kind, S, recent, mode, pop, win, prevWin); } finally { BRIEF_WIN = null; CARD_SERIES = ""; }
  if (draft) out.forEach(function (it) { perStamp(it.cv, "검토용 · 발행 금지"); });
  return out;
}
function perCardsInner(kind, S, recent, mode, pop, win, prevWin) {
  var out = [], R = briefCompute(recent, { mode: mode || "week", popular: pop });
  var L = R.label, P = CARD.PAD, W = CARD.W - P * 2, c, g;
  var today = perYmd(perKst()), early = today < win.e;
  // 정리 카드 날짜 = 구간 끝(월~일이면 일요일). 구간이 안 끝났으면 '~오늘'로 솔직하게
  var date = cDate(perKstMs(early ? today : win.e)), rgTxt = early ? cDate(win.from) + " ~ " + cDate(perKstMs(today)) + " (진행 중)" : win.txt;
  function foot(c, n, k) { cFoot(c, n, k); }
  function st(sym) { var d = recent.symbols[sym]; return d ? briefStats(sym, d, mode || "week") : null; }
  function dataNote(extra) { var kr = R.asOfKr ? cDate(R.asOfKr) : "-", us = R.asOfUs ? cDate(R.asOfUs) : "-"; return (extra ? extra + " · " : "") + "한국 " + kr + " · 미국 " + us + " 종가까지"; }

  if (kind === "weekReview" || kind === "monthReview") {
    var T = 7, iss = issuesCompute(recent, { mode: mode, popular: pop });
    // 1. 핵심 이슈 5
    out.push({ name: "1_핵심이슈5", cv: issuesCard(iss, 1, T) });
    // 2. 자산 성적표 — 시작가 → 끝가, 등락
    c = cNew(); g = c.g;
    var rows = PER_ASSETS.map(function (a) { var s = st(a[0]); return s ? { name: a[1], sym: a[0], ret: s.ret, last: s.last, start: s.start } : null; }).filter(Boolean).sort(function (a, b) { return b.ret - a.ret; });
    cHead(c, S.tag + " · " + date, L + " 자산 성적표 — 1위 [[" + rows[0].name + " " + cPct(rows[0].ret) + "]]", rgTxt + " · 구간 시작 전 종가 → 마지막 종가", 2, T);
    var rh = cH(c, rows.length, 84, true);
    rows.forEach(function (x, i) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { rank: i + 1, h: rh, price: cPrice(x.sym, x.start) + " → " + cPrice(x.sym, x.last) }); });
    cNote(c, "같은 기간에도 자산마다 방향이 달라요 — 나눠 담는 이유예요. 코인은 주말 포함, 주식은 거래일만.");
    foot(c, dataNote(), "per_assets"); out.push({ name: "2_자산성적표", cv: c.cv });
    // 3. 테마
    c = cNew(); var th = R.themes;
    cHead(c, S.tag + " · " + date, "[[" + th[0].name + "]] 강세, " + th[th.length - 1].name + " 약세", L + " 업종 평균 등락 · 괄호는 업종 안 1등 종목 · " + rgTxt, 3, T);
    var mx = Math.max.apply(null, th.map(function (x) { return Math.abs(x.ret); })) || 0.01, th10 = th.slice(0, 11), hh = cH(c, th10.length, 84);
    th10.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { bar: x.ret / mx, h: hh, noLine: true, priceSize: 22, price: briefName(x.best) + " " + cPct(x.best.ret) + " · " + x.up + "/" + x.n + "개 상승" }); });
    foot(c, dataNote(), "per_theme"); out.push({ name: "3_테마", cv: c.cv });
    // 4. 급등·급락 (고점 대비 위치까지)
    c = cNew(); var up = R.movers.up.slice(0, 5), dn = R.movers.down.slice(0, 5);
    cHead(c, S.tag + " · " + date, L + " 1위 [[" + briefName(up[0]) + " " + cPct(up[0].ret) + "]]", "가장 많이 내린 종목은 " + briefName(dn[0]) + " " + cPct(dn[0].ret) + " · 회색: 시작가 → 끝가 · 고점比", 4, T);
    var mh = cH(c, up.length + dn.length, 72, false, 100);
    cLabel(c, "▲ " + L + " 급등", CARD_C.up); up.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.up, { rank: i + 1, h: mh, price: cPrice(s.sym, s.start) + " → " + cPrice(s.sym, s.last), mid: s.vsHi != null ? "고점比 " + cPct(s.vsHi, 0) : "" }); });
    c.y += 14; cLabel(c, "▼ " + L + " 급락", CARD_C.down); dn.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.down, { rank: i + 1, h: mh, price: cPrice(s.sym, s.start) + " → " + cPrice(s.sym, s.last), mid: s.vsHi != null ? "고점比 " + cPct(s.vsHi, 0) : "" }); });
    foot(c, dataNote(), "per_movers"); out.push({ name: "4_급등급락", cv: c.cv });
    // 5. 날짜별 흐름 표 (주: 거래일별 / 월: 주차별) + 가장 큰 하루 · VIX 범위
    c = cNew(); var days = perDaysWin("^GSPC", win), kdays = perDaysWin("^KS11", win), vix = perDaysWin("^VIX", win), btc = perDaysWin("BTC-USD", win), nq = perDaysWin("^IXIC", win);
    var big = days.slice().sort(function (a, b) { return Math.abs(b.ch) - Math.abs(a.ch); })[0], kbig = kdays.slice().sort(function (a, b) { return Math.abs(b.ch) - Math.abs(a.ch); })[0];
    var vhi = vix.length ? Math.max.apply(null, vix.map(function (x) { return x.c; })) : null, vlo = vix.length ? Math.min.apply(null, vix.map(function (x) { return x.c; })) : null;
    var upd = days.filter(function (x) { return x.ch > 0; }).length, kupd = kdays.filter(function (x) { return x.ch > 0; }).length;
    cHead(c, S.tag + " · " + date, big ? L + " 가장 큰 하루 — [[" + perFmtDay(big.t) + " S&P500 " + cPct(big.ch) + "]]" : L + " 날짜별 흐름", "S&P500 오른 날 " + upd + "/" + days.length + " · 코스피 오른 날 " + kupd + "/" + kdays.length + (vhi != null ? " · 공포지수 " + vlo.toFixed(0) + "~" + vhi.toFixed(0) : "") + (kbig ? " · 코스피 최대 " + perFmtDay(kbig.t) + " " + cPct(kbig.ch) : ""), 5, T);
    var tbl = perFlowTable(win, { "^KS11": kdays, "^GSPC": days, "^IXIC": nq, "BTC-USD": btc });
    cTable(c, tbl.head, tbl.rows, { w: [1.3, 1, 1, 1, 1], rowH: tbl.rows.length > 8 ? 52 : 60, fs: tbl.rows.length > 8 ? 22 : 24 });
    cNote(c, "큰 하루 하나가 " + L + " 성적의 대부분을 정하는 경우가 많아요 — 그래서 시장에 머물러 있는 게 중요해요. 빈칸은 휴장.");
    foot(c, dataNote("각 날 종가 대비 전일 종가"), "per_bigday"); out.push({ name: "5_날짜별흐름", cv: c.cv });
    // 6. 숫자
    c = cNew(); var nums = R.numbers.slice(0, 4);
    cHead(c, S.tag + " · " + date, "세일 중인 종목 [[" + nums[0].v + "]]", L + " 끝 기준 · 52주 최고 대비 -20% / 신고가 근처 / 20일선 위 / VIX", 6, T);
    cTiles(c, nums.map(function (n) { return { v: n.v, l: n.l }; }));
    var ath = (nums[1].list || []).slice(0, 5), sale = (nums[0].list || []).slice(0, 5);
    var lst = ath.length ? ath : sale; if (lst.length) { c.y += 6; cLabel(c, ath.length ? "신고가 근처 종목 (52주 고점 대비)" : "세일 폭이 큰 종목 (52주 고점 대비)"); var ah = cH(c, lst.length, 64, true); lst.forEach(function (s) { cRow(c, briefName(s), cPct(s.vsHi, 0), cCol(s.vsHi), { h: ah, price: cPrice(s.sym, s.last), mid: L + " " + cPct(s.ret) }); }); }
    cNote(c, "신고가 종목이 늘어나는 주는 시장 전체가 강할 때가 많아요.");
    foot(c, dataNote(), "per_numbers"); out.push({ name: "6_숫자", cv: c.cv });
    // 7. 돈이 몰린 곳
    c = cNew(); var hot = R.popular.filter(function (s) { return !/^\^|=X$/.test(s.sym); }).slice(0, 9);
    cHead(c, S.tag + " · " + date, L + " 돈이 몰린 곳", "인기 종목의 " + L + " 등락 · 거래대금은 마지막 날 기준 평소(20일 평균)比", 7, T);
    var ph = cH(c, hot.length, 84, true);
    hot.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ph, price: cPrice(s.sym, s.start) + " → " + cPrice(s.sym, s.last), mid: s.amtX != null ? "거래대금 " + s.amtX.toFixed(1) + "배" : "" }); });
    if (mode === "month") { var mo0 = new Date(win.from + 9 * 3600e3).getUTCMonth() + 1, sm = PER_SEASON.map(function (a) { var ss = perSeason(a[0], mo0), s1 = st(a[0]); return ss && s1 ? a[1] + " " + cPct(s1.ret, 0) + " (과거 " + mo0 + "월 평균 " + cPct(ss.avg, 0) + ")" : null; }).filter(Boolean); if (sm.length) cNote(c, "과거 같은 달과 비교 — " + sm.slice(0, 2).join(" · ")); }
    else cNote(c, "거래대금이 몰린 종목은 다음 주 되돌림도 큰 편이에요.");
    foot(c, (R.popSrc === "ranked" ? "앱 조회 순위 · " : "거래대금 순 · ") + dataNote(), "per_money"); out.push({ name: "7_돈이몰린곳", cv: c.cv });
  }

  if (kind === "weekPreview") {
    var T2 = 5, now = perNow(), fw = win.txt, date = cDate(Date.now()), up7 = pubUpcoming(8).filter(function (e) { return e.k !== "hol"; }), hol7 = pubUpcoming(8).filter(function (e) { return e.k === "hol"; });
    // 1. 이번 주 일정
    out.push({ name: "1_이번주일정", cv: pubCalCard() });
    // 2. 볼 것 3가지 = 가장 큰 일정 + 지금 신호 + 임계 자산
    c = cNew(); var watch = [];
    var keyEv = up7.filter(function (e) { return /FOMC|CPI|고용|금통위/.test(e.t); })[0] || up7[0];
    if (keyEv) watch.push({ e: "🗓️", t: keyEv.d.slice(5).replace("-", "/") + "(" + pubDow(keyEv.d) + ") " + keyEv.t.replace(/^[^\s]+\s/, ""), s: keyEv.n || "발표 전후로 변동이 커질 수 있어요" });
    if (now.why.length) watch.push({ e: "🧭", t: now.why[0].split("→").pop().trim(), s: now.why[0].split("→")[0].trim() });
    var spy = recent.symbols["^GSPC"] ? briefStats("^GSPC", recent.symbols["^GSPC"], "week") : null, ks = recent.symbols["^KS11"] ? briefStats("^KS11", recent.symbols["^KS11"], "week") : null;
    if (spy && spy.vsHi != null && spy.vsHi >= -0.02) watch.push({ e: "🏔️", t: "S&P500 사상 최고가 근처 (" + cPct(spy.vsHi, 1) + ")", s: "고점에선 '너무 올랐다'는 말이 늘지만, 신고가 뒤에 신고가가 오는 경우가 더 많았어요" });
    else if (spy && spy.vsHi != null && spy.vsHi <= -0.08) watch.push({ e: "🕳️", t: "S&P500 고점 대비 " + cPct(spy.vsHi, 0), s: "조정 구간 — 나눠 사는 사람에겐 기회, 몰아 사는 사람에겐 시험" });
    if (ks && ks.above20 === false) watch.push({ e: "📉", t: "코스피 20일선 아래", s: "최근 한 달 산 사람 대부분이 손실 구간 — 반등 시 매물이 나올 수 있어요" });
    var vixS = recent.symbols["^VIX"] ? briefStats("^VIX", recent.symbols["^VIX"], "week") : null;
    if (vixS && vixS.last >= 22) watch.push({ e: "😱", t: "공포지수 " + vixS.last.toFixed(0) + " — 불안 구간", s: "뉴스가 커 보이는 주 · 규칙대로만" });
    if (hol7.length) watch.push({ e: "🛌", t: hol7.map(function (e) { return e.d.slice(5).replace("-", "/") + " " + e.t.replace(/^[^\s]+\s/, ""); }).join(", "), s: "휴장일엔 그 시장 데이터가 갱신되지 않아요" });
    watch = watch.slice(0, 4);
    cHead(c, S.tag + " · " + date, "이번 주 볼 것 [[" + watch.length + "가지]]", fw + " · 일정 · 지금 시장 신호 · 고점/추세 위치", 2, T2);
    var wh = Math.min(150, Math.floor((CARD.H - 150 - c.y) / Math.max(1, watch.length)));
    watch.forEach(function (w, i) { cBox(g = c.g, P, c.y, W, wh - 12, 16); cText(c.g, String(i + 1), P + 40, c.y + wh / 2 + 10, 44, 800, CARD_C.gold, "center"); cText(c.g, cFit(c.g, w.e + " " + w.t, W - 120, 30, 800), P + 84, c.y + wh / 2 - 6, 30, 800, CARD_C.txt); cText(c.g, cFit(c.g, w.s, W - 120, 22, 500), P + 84, c.y + wh / 2 + 28, 22, 500, CARD_C.sub); c.y += wh; });
    cNote(c, "예상은 틀릴 수 있어요. '무엇을 보면 되는지'만 챙기는 카드예요.");
    foot(c, "과거 데이터·공개 일정 · 투자 조언 아님", "per_watch"); out.push({ name: "2_볼것", cv: c.cv });
    // 3. 지난주 흐름 이어질까
    c = cNew(); var th2 = R.themes, mv = R.movers.up.slice(0, 3).concat(R.movers.down.slice(0, 2));
    cHead(c, S.tag + " · " + date, "지난주 [[" + th2[0].name + "]] 강세 — 이어질까?", "지난주(" + prevWin.short + ") 테마 상·하위와 급등락 종목 · 추격보다 '얼마나 올랐나' 확인", 3, T2);
    cLabel(c, "지난주 테마"); var t5 = th2.slice(0, 3).concat(th2.slice(-2)), th3 = cH(c, t5.length + mv.length, 66, true, 90);
    t5.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: th3, price: briefName(x.best) + " " + cPct(x.best.ret), priceSize: 21 }); });
    c.y += 10; cLabel(c, "지난주 급등·급락"); mv.forEach(function (s) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { h: th3, price: cPrice(s.sym, s.last), mid: s.vsHi != null ? "고점比 " + cPct(s.vsHi, 0) : "" }); });
    cNote(c, "지난주 1등 테마가 이번 주도 1등일 확률은 반반이에요. 이미 오른 폭부터 보세요.");
    foot(c, null, "per_cont"); out.push({ name: "3_이어질까", cv: c.cv });
    // 4. 적립 체크
    c = cNew(); var dca = [["SPY", "S&P500"], ["QQQ", "나스닥100"], ["005930.KS", "삼성전자"], ["GLD", "금"], ["BTC-USD", "비트코인"]].map(function (a) { var d = recent.symbols[a[0]]; var s = d ? briefStats(a[0], d, "week") : null; return s ? { name: a[1], sym: a[0], s: s } : null; }).filter(Boolean);
    cHead(c, S.tag + " · " + date, "이번 주 적립하는 분들께", "지금 위치 — 52주 고점 대비 · 20일선 · 지난주 등락", 4, T2);
    var dh2 = cH(c, dca.length, 90, true);
    dca.forEach(function (x) { cRow(c, x.name, x.s.vsHi != null ? cPct(x.s.vsHi, 0) : "-", x.s.vsHi != null && x.s.vsHi <= -0.1 ? CARD_C.down : CARD_C.txt, { h: dh2, price: cPrice(x.sym, x.s.last), mid: (x.s.above20 ? "20일선 위" : "20일선 아래") + " · 지난주 " + cPct(x.s.ret) }); });
    cNote(c, "오른쪽 숫자는 52주 최고가 대비예요. 적립식은 타이밍이 아니라 '멈추지 않는 것'이 핵심이에요.");
    foot(c, null, "per_dca"); out.push({ name: "4_적립체크", cv: c.cv });
    // 5. 용어
    out.push({ name: "5_용어", cv: pubTermCard(pubTerm()) });
  }

  if (kind === "monthPreview") {
    var T3 = 5, now2 = new Date(win.from + 9 * 3600e3), mo = now2.getUTCMonth() + 1, ym = win.s.slice(0, 7), date = cDate(Date.now());
    var mEv = PUB_CAL.filter(function (e) { return e.d.slice(0, 7) === ym; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    // 1. 이달의 일정
    c = cNew(); var evs = mEv.filter(function (e) { return e.k !== "hol"; }), hols = mEv.filter(function (e) { return e.k === "hol"; });
    cHead(c, S.tag + " · " + date, mo + "월 시장 일정 [[" + evs.length + "건]]", "한국 시간 · 미국 지표는 밤 9~10시 반 발표" + (hols.length ? " · 휴장 " + hols.map(function (e) { return e.d.slice(8) + "일"; }).join(",") : ""), 1, T3);
    var eh = cH(c, Math.min(evs.length, 10), 80, true);
    evs.slice(0, 10).forEach(function (e) { cRow(c, e.t.replace(/^[^\s]+\s/, "") + (e.sure === false ? " (예정)" : ""), e.d.slice(5).replace("-", "/"), CARD_C.navy, { h: eh, mid: e.n ? e.n.split(" · ")[0] : "", valW: 150 }); });
    cNote(c, "핵심은 " + (evs.filter(function (e) { return /FOMC|CPI|금통위/.test(e.t); }).map(function (e) { return e.d.slice(8) + "일 " + e.t.replace(/^[^\s]+\s/, "").split(" (")[0]; }).join(" · ") || "지표 발표일") + " — 전후로 변동 커요");
    foot(c, "FOMC·BLS·BEA·한국은행 공개 일정 · 투자 조언 아님", "per_cal"); out.push({ name: "1_이달일정", cv: c.cv });
    // 2. 계절성
    c = cNew(); var seas = PER_SEASON.map(function (a) { var s = perSeason(a[0], mo); return s ? Object.assign({ name: a[1], sym: a[0] }, s) : null; }).filter(Boolean);
    if (seas.length) {
      var s0 = seas[0];
      cHead(c, S.tag + " · " + date, mo + "월은 과거에 [[" + (s0.up / s0.n >= 0.6 ? "올랐던 달" : s0.up / s0.n <= 0.4 ? "약했던 달" : "반반인 달") + "]]", "지난 " + s0.n + "년 같은 달 평균 등락 · 오른 해 비율 · 계절성은 참고일 뿐 예언이 아니에요", 2, T3);
      var sh = cH(c, seas.length, 96, true);
      seas.forEach(function (x) { cRow(c, x.name, cPct(x.avg, 1), cCol(x.avg), { h: sh, mid: "오른 해 " + x.up + "/" + x.n + " · 최고 " + x.best.y + " " + cPct(x.best.r, 0) + " · 최저 " + x.worst.y + " " + cPct(x.worst.r, 0), valW: 140 }); });
      cNote(c, "같은 달이라도 해마다 결과는 달랐어요(최고·최저 해 참고). 계절성에 돈을 걸진 마세요.");
    } else cHead(c, S.tag + " · " + date, mo + "월 계절성", "10년치 데이터를 아직 못 불러왔어요", 2, T3);
    foot(c, "월말 종가 기준 · 투자 조언 아님", "per_season"); out.push({ name: "2_계절성", cv: c.cv });
    // 3. 역사 속 이달
    c = cNew(); var evh = (typeof EVENTS !== "undefined" ? EVENTS : []).filter(function (e) { return new Date(e.ts).getMonth() + 1 === mo; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 8);
    cHead(c, S.tag + " · " + date, "역사 속 [[" + mo + "월]]", "과거 이 달에 있었던 큰 사건 — 그때도 끝인 줄 알았지만 지금 차트에선 작은 점", 3, T3);
    var hh2 = cH(c, Math.max(1, evh.length), 76, true);
    evh.forEach(function (e) { cRow(c, e.name, String(new Date(e.ts).getFullYear()), CARD_C.navy, { h: hh2, mid: e.type, valW: 110 }); });
    if (!evh.length) cSummary(c, "이 달에 기록된 큰 사건은 없어요 — 조용한 달이네요");
    cNote(c, "사건 뒤 1년, 지수가 어땠는지는 종목 탭에서 사건 표시선을 켜면 보여요.");
    foot(c, "StockMind 사건 기록 · 투자 조언 아님", "per_history"); out.push({ name: "3_역사속이달", cv: c.cv });
    // 4. 지난달 요약 → 이달 볼 것
    c = cNew(); var Rm = R, thm = Rm.themes, now3 = perNow();
    cHead(c, S.tag + " · " + date, "지난달 [[" + thm[0].name + "]] 강세 · 이달 볼 것", "지난달(" + prevWin.short + ") 자산 성적 상·하위 · 지금 시장 신호", 4, T3);
    var rowsM = PER_ASSETS.map(function (a) { var d = recent.symbols[a[0]]; var s = d ? briefStats(a[0], d, "month") : null; return s ? { name: a[1], sym: a[0], ret: s.ret, last: s.last } : null; }).filter(Boolean).sort(function (a, b) { return b.ret - a.ret; });
    var pick = rowsM.slice(0, 3).concat(rowsM.slice(-2)), ph2 = cH(c, pick.length, 70, true, 120);
    cLabel(c, "지난달 자산"); pick.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: ph2, price: cPrice(x.sym, x.last) }); });
    c.y += 10; cLabel(c, "지금 시장 신호"); cSummary(c, now3.why.length ? now3.why.join(" / ") : "두드러진 신호 없음 — 평소 구간");
    cNote(c, "지난달 1위가 이달 1위일 보장은 없어요. 비중을 지키는 게 먼저예요.");
    foot(c, null, "per_last"); out.push({ name: "4_지난달과이달", cv: c.cv });
    // 5. 적립 계획
    c = cNew(); var dca2 = [["SPY", "S&P500"], ["QQQ", "나스닥100"], ["005930.KS", "삼성전자"], ["GLD", "금"], ["BTC-USD", "비트코인"]].map(function (a) { var d = recent.symbols[a[0]]; var s = d ? briefStats(a[0], d, "month") : null; return s ? { name: a[1], sym: a[0], s: s } : null; }).filter(Boolean);
    cHead(c, S.tag + " · " + date, mo + "월 적립 계획 체크", "지난달 말 종가 · 52주 고점 대비 · 지난달 등락 — 적립일을 정했다면 그대로", 5, T3);
    var dh3 = cH(c, dca2.length, 90, true);
    dca2.forEach(function (x) { cRow(c, x.name, x.s.vsHi != null ? cPct(x.s.vsHi, 0) : "-", x.s.vsHi != null && x.s.vsHi <= -0.1 ? CARD_C.down : CARD_C.txt, { h: dh3, price: cPrice(x.sym, x.s.last), mid: "지난달 " + cPct(x.s.ret) }); });
    cNote(c, "오른쪽은 52주 최고가 대비예요. 싸 보여도 비싸 보여도 정한 날 정한 만큼이 적립식이에요.");
    foot(c, null, "per_dca"); out.push({ name: "5_적립계획", cv: c.cv });
  }
  return out;
}

/* ---------- 캡션 ---------- */
function perCaption(kind) {
  var S = PER_SETS[kind], recent = perRecent(); if (!recent) return { ig: "", th: "" };
  var mode = S.mode || "week", win = perWindow(kind), prevWin = perWindow(kind, true), W0 = mode === S.mode && S.mode ? win : prevWin;
  BRIEF_WIN = { from: W0.from, to: W0.to };
  try { return perCaptionInner(kind, S, recent, mode, win, prevWin); } finally { BRIEF_WIN = null; }
}
function perCaptionInner(kind, S, recent, mode, win, prevWin) {
  var R = briefCompute(recent, { mode: mode }), L = R.label, lines = [], q, today = perYmd(perKst());
  var rg = { txt: today < win.e && S.mode ? win.short.split("~")[0] + "~" + today.slice(5).replace("-", ".") + " 진행 중" : win.short };
  var tags = PUB_TAGS_BASE.concat(kind.indexOf("month") === 0 ? ["월간결산", "자산배분", "ETF투자"] : ["주간증시", "주식시황", "미국증시"]).map(function (x) { return "#" + x; }).join(" ");
  if (kind === "weekReview" || kind === "monthReview") {
    var iss = issuesCompute(recent, { mode: mode }), rows = PER_ASSETS.map(function (a) { var d = recent.symbols[a[0]]; var s = d ? briefStats(a[0], d, mode) : null; return s ? { name: a[1], ret: s.ret } : null; }).filter(Boolean).sort(function (a, b) { return b.ret - a.ret; });
    lines.push(L + " 시장, 한 장으로 정리했어요 (" + rg.txt + ")");
    lines.push(""); lines.push("📌 " + L + " 핵심 이슈 5"); iss.forEach(function (it, i) { lines.push((i + 1) + ". " + it.emoji + " " + it.title); });
    lines.push(""); lines.push("🏆 " + L + " 자산 1위 " + rows[0].name + " " + cPct(rows[0].ret) + " · 꼴찌 " + rows[rows.length - 1].name + " " + cPct(rows[rows.length - 1].ret));
    lines.push("🔥 테마 1위 " + R.themes[0].name + " " + cPct(R.themes[0].ret) + " · 오른 종목 " + Math.round(R.temp.upPct * 100) + "%");
    q = kind === "monthReview" ? "이번 달 계좌는 어땠나요? 가장 잘한 선택과 아쉬운 선택 하나씩 댓글로 남겨 보세요." : "이번 주 가장 기억에 남는 숫자는 뭐였나요?";
  } else if (kind === "weekPreview") {
    var up = pubUpcoming(8).filter(function (e) { return e.k !== "hol"; });
    lines.push("이번 주 시장, 이것만 보면 돼요 (" + rg.txt + ")"); lines.push("");
    lines.push("🗓️ 일정"); up.slice(0, 5).forEach(function (e) { lines.push("· " + e.d.slice(5).replace("-", "/") + "(" + pubDow(e.d) + ") " + e.t.replace(/^[^\s]+\s/, "")); });
    var now = perNow(); if (now.why.length) { lines.push(""); lines.push("🧭 지금 신호: " + now.why.join(" / ")); }
    lines.push(""); lines.push("🔥 지난주 테마 1위 " + R.themes[0].name + " " + cPct(R.themes[0].ret) + " — 이어질지 지켜볼 것");
    q = "이번 주 적립일이 있는 분? 어떤 걸 사실 건지 댓글로 알려주세요.";
  } else {
    var mo = new Date(win.from + 9 * 3600e3).getUTCMonth() + 1, ym = win.s.slice(0, 7);
    var mEv = PUB_CAL.filter(function (e) { return e.d.slice(0, 7) === ym && e.k !== "hol"; });
    lines.push(mo + "월 시장, 미리 보기"); lines.push("");
    lines.push("🗓️ 이달 일정 " + mEv.length + "건"); mEv.filter(function (e) { return /FOMC|CPI|고용|금통위|실적/.test(e.t); }).slice(0, 5).forEach(function (e) { lines.push("· " + e.d.slice(8) + "일 " + e.t.replace(/^[^\s]+\s/, "")); });
    var seas = PER_SEASON.map(function (a) { var s = perSeason(a[0], mo); return s ? a[1] + " 평균 " + cPct(s.avg, 1) + " (오른 해 " + s.up + "/" + s.n + ")" : null; }).filter(Boolean);
    if (seas.length) { lines.push(""); lines.push("📊 과거 " + mo + "월은: " + seas.slice(0, 3).join(" · ")); }
    q = "이번 달 목표 하나만 정한다면? 저는 '적립 멈추지 않기'예요.";
  }
  lines.push(""); lines.push(q);
  if (S.mode) { lines.push(""); lines.push("📅 집계 구간 " + win.txt + " · 한국 " + (R.asOfKr ? cDate(R.asOfKr) : "-") + " / 미국 " + (R.asOfUs ? cDate(R.asOfUs) : "-") + " 종가까지"); }
  var disc = "\n\n※ 종가 기준 자동 집계 · 투자 권유 아니며 판단과 책임은 각자에게 · 출처: 야후 파이낸스, 연준·BLS·한국은행 공개 일정";
  var ig = lines.join("\n") + disc + "\n\n" + tags, th = lines.slice(0, 9).join("\n") + "\n\n(종가 기준 · 투자 권유 아님)";
  if (th.length > 500) th = th.slice(0, 490).replace(/\n[^\n]*$/, "") + "…";
  return { ig: ig, th: th, igLen: ig.length, thLen: th.length };
}

/* ---------- 열기 (필요한 10년치 데이터 먼저) ---------- */
function perOpen(kind, force) {
  var S = PER_SETS[kind], V = perVerify(kind);
  // 정리 세트: 확정 데이터가 아니면 발행용 생성을 막는다 (검토용은 도장 찍어서만)
  if (!force && (S.mode ? (V.hard || V.early || !V.ok) : false)) return perGateModal(kind, V);
  var draft = PER_FORCE_DRAFT != null ? PER_FORCE_DRAFT : (S.mode && (V.hard || V.early));
  var need = kind === "monthPreview" || kind === "monthReview" ? PER_SEASON.map(function (a) { return a[0]; }) : [];
  var btn = document.querySelector('[data-per="' + kind + '"]'), old = btn ? btn.textContent : ""; if (btn) btn.textContent = "만드는 중…";
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return perLoad(need); }).then(function () {
    CARD_TXT = ""; try { perCards(kind); } catch (e) { console.warn(e); }
    if (!document.fonts || !document.fonts.load) return;
    var txt = CARD_TXT.replace(/\s+/g, "");
    return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); }));
  }).then(function () {
    if (btn) btn.textContent = old;
    var list; try { list = perCards(kind, draft); } catch (e) { console.warn(e); list = []; }
    if (!list.length) { alert("아직 데이터가 다 준비되지 않았어요."); return; }
    var day = pubToday().replace(/-/g, ""), cap = perCaption(kind), box = document.createElement("div");
    box.innerHTML = (draft ? '<div class="chWhyBox" style="margin-bottom:10px">⛔ 검토용이에요 — 데이터가 확정되지 않아 "발행 금지" 도장이 찍혀 있어요. 구간이 끝나고 아침 수집 뒤 다시 만드세요.</div>' : '') +
      '<div class="perVerify">' + V.items.map(function (x) { return '<div class="pubCkRow ' + (x.ok ? "ok" : x.w ? "bad" : "warn") + '"><span>' + (x.ok ? "✅" : x.w ? "⛔" : "⚠️") + '</span><span>' + escapeHtml(x.t) + '</span></div>'; }).join("") + '</div>' +
      '<div class="row" style="gap:8px;margin:10px 0 12px"><button class="primary" data-act="all">⬇ 전부 저장</button>' + (navigator.canShare && !draft ? '<button class="chip" data-act="share">↗ 공유</button>' : '') +
      '</div>' + thrPanelHtml(/month/.test(kind) ? "재테크" : "주식") + '<div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    list.forEach(function (it, i) {
      it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_" + S.t.replace(/[^가-힣]/g, "") + "_" + day + "_" + it.name + (draft ? "_검토용" : "") + ".png";
      var f = document.createElement("figure");
      f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + '. ' + it.name.replace(/^\d_/, "") + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>';
      f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f);
    });
    box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
    try { thrBind(box, thrOr(thrPeriodic(kind, list.map(function (it) { return it.name; })), cap)); } catch (e) { console.warn(e); }
    var sh = box.querySelector('[data-act="share"]');
    if (sh) sh.onclick = function () { Promise.all(list.map(function (it) { return new Promise(function (ok) { it.cv.toBlob(function (b) { ok(new File([b], it.file, { type: "image/png" })); }, "image/png"); }); })).then(function (files) { if (navigator.canShare({ files: files })) return navigator.share({ files: files }); }).catch(function () {}); };
    infoModal.open("🃏 " + S.t + " · " + list.length + "장" + (draft ? " (검토용)" : ""), box);
  });
}
/* 정리 세트 생성 전 점검 창 */
function perGateModal(kind, V) {
  var S = PER_SETS[kind], box = document.createElement("div");
  box.innerHTML = '<div class="chWhyBox" style="margin-bottom:10px">' + (V.hard ? '⛔ 구간 안 마지막 거래일의 종가가 아직 없어요. 정리 세트는 확정 데이터로만 만들어요.' : '⚠️ 아직 구간이 끝나지 않았거나 권장 요일이 아니에요.') + '</div>' +
    '<div class="perVerify">' + V.items.map(function (x) { return '<div class="pubCkRow ' + (x.ok ? "ok" : x.w ? "bad" : "warn") + '"><span>' + (x.ok ? "✅" : x.w ? "⛔" : "⚠️") + '</span><span>' + escapeHtml(x.t) + '</span></div>'; }).join("") + '</div>' +
    '<div class="row" style="gap:8px;margin-top:12px">' + (V.hard ? '' : '<button class="primary" data-act="go">그래도 만들기 (현재까지 기준으로 표시)</button>') + '<button class="chip" data-act="draft">검토용으로 보기 (발행 금지 도장)</button></div>' +
    '<div class="briefDim" style="margin-top:8px">구간: ' + V.win.txt + ' · 한 주 정리는 일요일, 한 달 정리는 말일(또는 다음 달 1일 아침 수집 후)에 만들면 구간 전체가 확정돼요.</div>';
  var go = box.querySelector('[data-act="go"]'); if (go) go.onclick = function () { infoModal.close && infoModal.close(); perOpenForce(kind, false); };
  box.querySelector('[data-act="draft"]').onclick = function () { infoModal.close && infoModal.close(); perOpenForce(kind, true); };
  infoModal.open("🔍 " + S.t + " — 만들기 전 점검", box);
}
function perOpenForce(kind, draft) { var V = perVerify(kind); perOpen2(kind, draft || V.hard); }
function perOpen2(kind, draft) { PER_FORCE_DRAFT = draft; perOpen(kind, true); PER_FORCE_DRAFT = null; }
var PER_FORCE_DRAFT = null;
/* ---------- 주제 은행 (발행 캘린더 + 아이디어) ---------- */
var PER_TOPICS = [
  { when: "매일 아침", items: ["📌 오늘의 핵심 이슈 5 (표지)", "🌡️ 시장 온도 — 오른 종목 비율", "🔥 자금 흐름 — 테마 1등·꼴찌", "🚀 급등·급락 TOP 5 + 기사 제목", "💰 돈이 몰린 곳 — 거래대금 급증", "🔢 오늘의 숫자 — 세일 중·신고가·20일선·VIX", "🎯 시장 심리 온도계", "📖 용어 한 입 (저장용)"] },
  { when: "일요일 · 한 주 정리", items: ["📌 주간 핵심 이슈 5", "🏆 주간 자산 성적표 (주식·채권·금·원유·환율·코인)", "🔥 주간 테마 순위", "🚀 주간 급등·급락", "📊 가장 큰 하루 · VIX 범위 · 오른 날 수", "🔢 주말 기준 숫자 — 신고가 종목", "💰 주간 돈이 몰린 곳", "(수동) 이번 주 가장 많이 읽힌 뉴스 키워드"] },
  { when: "월요일 · 한 주 예상", items: ["🗓️ 이번 주 일정 (FOMC·CPI·고용·금통위·휴장·만기)", "👀 이번 주 볼 것 3~4가지", "🔁 지난주 흐름 이어질까 — 추격 주의", "🗓️ 적립하는 분들께 — 지금 위치", "📖 이번 주 용어", "(수동) 이번 주 실적 발표 기업"] },
  { when: "월초 · 한 달 예상", items: ["🗓️ 이달 일정 전체", "📊 이달은 과거에 어땠나 — 계절성 (S&P500·코스피·금·비트코인)", "📜 역사 속 이달 — 과거 사건", "🔁 지난달 요약 → 이달 볼 것", "🗓️ 이달 적립 계획 체크", "(수동) 이달 배당락·ETF 분배금 일정"] },
  { when: "월말 · 한 달 정리", items: ["📌 월간 핵심 이슈 5", "🏆 월간 자산 성적표", "🔥 월간 테마 순위", "🚀 월간 급등·급락", "📊 이달 가장 큰 하루 · VIX 범위", "🔢 월말 숫자", "💰 월간 돈이 몰린 곳 + 과거 같은 달 대비", "(수동) 내 계좌 월간 정산 — 넣은 돈 vs 평가금 (숫자만, 자랑 아님)"] },
  { when: "수시 · 상황 발생 시", items: ["😱 VIX 25↑ — 과거 공포 사례 카드 (채널 ④)", "🕳️ 지수 -10% — MDD 체크 카드 (채널 ②)", "⚖️ 금리·유가·달러 급변 — 자산배분 비교 (채널 ③)", "🗓️ 1년 전 100만원 / 매달 10만원 (적금처럼 시리즈)", "💛 투자 유형 테스트 — 댓글 참여형", "📰 큰 뉴스 날 — '왜 올랐나/내렸나' 기사 제목 카드", "📋 정책·제도 변경 — 구간별 금리·한도 표 + 조건 (정책 카드 탭)", "🏦 금리 결정 뒤 — 예금·대출·국채 숫자가 어떻게 바뀌었나 표", "📓 연구노트 — 국면 5종 · 낙폭 · 적립 · 기사 vs 숫자 (연구노트 탭)"] }
];
