/* ============================================================
   오늘의 핵심 이슈 5 (v7.9) — 오늘의 브리핑·채널 브리핑 자료 맨 위
   자료 전체(지수·환율·금리·금·코인·공포지수·오른 종목 비율·테마·급등락·거래대금·MDD·시장 신호)에서
   이슈 후보를 만들고, "평소보다 얼마나 이례적인가"로 점수를 매겨 겹치지 않게 5개를 고른다.
     점수의 기본 = 오늘 등락 ÷ 그 자산의 평소 하루 변동폭(최근 90일 표준편차)
     → 평소 잘 안 움직이는 환율 +1%가, 원래 출렁이는 코인 +1%보다 큰 이슈가 된다.
   항상 '금일(하루)' 기준. 오늘의 브리핑에서 시장(국내·미국·코인)을 고르면 그 시장 이슈만.
   ============================================================ */
var ISS_INDEX = { us: [["^GSPC", "S&P500"], ["^IXIC", "나스닥"]], kr: [["^KS11", "코스피"], ["^KQ11", "코스닥"]] };
var ISS_MACRO = [
  ["KRW=X", "fx", "💱", "원/달러 환율"], ["^VIX", "vix", "😱", "공포지수 VIX"], ["TLT", "rate", "🏦", "미국 장기채"],
  ["GLD", "gold", "🥇", "금"], ["USO", "oil", "🛢️", "원유"], ["BTC-USD", "btc", "🟠", "비트코인"]
];
var ISS_MKT = { fx: ["all", "kr", "us", "coin", "stock"], vix: ["all", "us", "stock"], rate: ["all", "us", "stock"], gold: ["all", "us", "stock"], oil: ["all", "us", "stock"], btc: ["all", "coin"] };

function issPct(x, d) { return (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 2 : d) + "%"; }
/* 기간: day(하루) · week(5거래일) · month(21거래일) — ISS_MODE에 따라 등락과 "평소 변동폭" 기준이 바뀐다 */
var ISS_MODE = "day", ISS_BACK = { day: 1, week: 5, month: 21 }, ISS_LBL = { day: "오늘", week: "이번 주", month: "이번 달" };
function issRet(s) { return ISS_MODE === "day" ? s.ret1 : s.ret; }
function issZ(s) { return s && s.sd > 0 ? Math.abs(issRet(s)) / (s.sd * Math.sqrt(ISS_MODE === "day" ? 1 : (s.winDays || ISS_BACK[ISS_MODE]))) : 0; }
function issTimes(z) { return z >= 1.5 ? " · 평소 " + (ISS_MODE === "day" ? "하루" : ISS_MODE === "week" ? "한 주" : "한 달") + " 변동의 " + z.toFixed(1) + "배" : ""; }
function issAdj(z) { return z >= 2.5 ? "급" : z >= 1.5 ? "큰 폭 " : ""; }

/* 후보 만들기 → 점수순 정렬 → 종류별 상한을 지키며 5개 */
function issuesCompute(recent, opt) {
  opt = opt || {};
  if (!recent || !recent.symbols) return [];
  var market = opt.market || "all"; ISS_MODE = opt.mode === "week" || opt.mode === "month" ? opt.mode : "day";
  var R = briefCompute(recent, { mode: ISS_MODE, market: market, popular: opt.popular });
  if (R.marketWideOff) return [];   // v12.29 전체 시장 숫자를 못 쓰는 날엔 이슈를 뽑지 않는다
  function st(sym) { var d = recent.symbols[sym]; if (!d) return null; var s = briefStats(sym, d, ISS_MODE); return s && !(R.quality && R.quality.bad[sym]) ? s : null; }
  var C = [];
  // ① 증시 (미국·한국 각각 한 줄)
  ["us", "kr"].forEach(function (reg) {
    if (market !== "all" && market !== "stock" && market !== reg) return;
    var a = ISS_INDEX[reg].map(function (p) { var s = st(p[0]); return s ? { p: p, s: s, z: issZ(s) } : null; }).filter(Boolean);
    if (!a.length) return;
    a.sort(function (x, y) { return y.z - x.z; });
    var m = a[0], other = a[1], up = issRet(m.s) >= 0;
    C.push({ cat: "idx-" + reg, emoji: up ? "📈" : "📉", score: m.z * 1.25 + 0.3,
      title: (reg === "us" ? "미국" : "한국") + " 증시 " + issAdj(m.z) + (up ? "상승" : "하락") + " — " + m.p[1] + " " + issPct(issRet(m.s)),
      sub: (other ? other.p[1] + " " + issPct(issRet(other.s)) : "") + issTimes(m.z), sym: m.p[0] });
  });
  // ② 거시 지표
  ISS_MACRO.forEach(function (x) {
    if (ISS_MKT[x[1]].indexOf(market) < 0) return;
    var s = st(x[0]); if (!s) return;
    var z = issZ(s), up = issRet(s) >= 0, t, sub;
    if (x[1] === "fx") { t = "원/달러 환율 " + Math.round(s.last).toLocaleString() + "원 (" + issPct(issRet(s)) + ")"; sub = (up ? "달러 강세 — 해외 자산의 원화 가치는 올라요" : "달러 약세 — 해외 자산의 원화 수익은 줄어요") + issTimes(z); }
    else if (x[1] === "vix") { var v = s.last; z = Math.max(z, v >= 30 ? 3 : v >= 25 ? 2.2 : v >= 20 ? 1.2 : v < 13 ? 1 : 0.4); t = "공포지수 VIX " + v.toFixed(1) + " — " + (v >= 30 ? "공포 구간" : v >= 20 ? "불안 구간" : v < 13 ? "아주 평온" : "평온"); sub = "하루 " + issPct(issRet(s)) + (v >= 25 ? " · 과거엔 이런 때 저점 근처였던 적이 많았지만, 바닥은 지나서야 알 수 있어요" : ""); }
    else if (x[1] === "rate") { t = "미국 장기채 " + issPct(issRet(s)) + " → 금리 " + (up ? "하락" : "상승"); sub = (up ? "채권값이 오르면 금리는 내려요 — 성장주에 우호적" : "채권값이 내리면 금리는 올라요 — 성장주엔 부담") + issTimes(z); }
    else { t = x[3] + " " + issPct(issRet(s)) + " (" + cPrice(x[0], s.last) + ")"; sub = (z >= 1.5 ? "평소 하루 변동의 " + z.toFixed(1) + "배" : "52주 최고 대비 " + (s.vsHi != null ? issPct(s.vsHi, 0) : "-")); }
    C.push({ cat: x[1], emoji: x[2], score: z, title: t, sub: sub, sym: x[0] });
  });
  // ③ 오른 종목 비율 (시장 전체가 같이 움직였나)
  var up = R.temp.upPct;
  C.push({ cat: "breadth", emoji: up >= 0.5 ? "🌡️" : "🥶", score: Math.abs(up - 0.5) * 8,
    title: (up >= 0.5 ? "오른 종목 " + Math.round(up * 100) + "%" : "내린 종목 " + Math.round((1 - up) * 100) + "%") + " — " + (Math.abs(up - 0.5) >= 0.25 ? "시장 전체가 함께 움직인 날" : Math.abs(up - 0.5) >= 0.12 ? (up >= 0.5 ? "오른 쪽이 우세" : "내린 쪽이 우세") : "반반으로 갈린 날"),
    sub: R.temp.up + " / " + R.temp.total + "개 · 20일 평균선 위 " + Math.round(R.temp.abovePct * 100) + "%" });
  // ④ 테마 (가장 강한·약한 업종)
  var th = R.themes || [];
  if (th.length >= 2) {
    var top = th[0], bot = th[th.length - 1];
    if (top.ret > 0) C.push({ cat: "theme-up", emoji: "🔥", score: top.ret / 0.008, title: top.name + " " + issPct(top.ret) + " 강세", sub: top.n + "개 중 " + top.up + "개 상승 · 1등 " + briefName(top.best) + " " + issPct(top.best.ret), sym: top.best.sym });
    if (bot.ret < 0) C.push({ cat: "theme-down", emoji: "🧊", score: -bot.ret / 0.008, title: bot.name + " " + issPct(bot.ret) + " 약세", sub: bot.n + "개 중 " + bot.up + "개만 상승 · 가장 많이 내린 " + briefName(bot.worst) + " " + issPct(bot.worst.ret), sym: bot.worst.sym });
  }
  // ⑤ 급등·급락 종목 (개별 종목만, 평소 변동 대비)
  var mv = (R.movers.up || []).concat(R.movers.down || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym) && (typeof classifySymbol !== "function" || classifySymbol(s.sym) === "us" || classifySymbol(s.sym) === "kr") && !/^(069500|360750|133690|122630|114800|132030)\.KS$/.test(s.sym); });   // ETF·지수 제외
  mv.sort(function (a, b) { return Math.abs(issRet(b)) * (1 + Math.min(issZ(b), 6) / 6) - Math.abs(issRet(a)) * (1 + Math.min(issZ(a), 6) / 6); });
  mv.slice(0, 3).forEach(function (s) {
    var z = issZ(s);
    C.push({ cat: "mover", emoji: issRet(s) >= 0 ? "🚀" : "🔻", score: Math.min(z, 6) * 0.55 + Math.abs(issRet(s)) * 12,
      title: briefName(s) + " " + issPct(issRet(s)) + " " + (issRet(s) >= 0 ? "급등" : "급락"), sub: cPrice(s.sym, s.last) + issTimes(z) + (s.amtX >= 1.5 ? " · 거래대금 평소의 " + s.amtX.toFixed(1) + "배" : ""), sym: s.sym });
  });
  // ⑥ 돈이 몰린 곳 (거래대금 급증)
  var hv = (R.hotVol || [])[0];
  if (hv) C.push({ cat: "hot", emoji: "💰", score: Math.min(hv.amtX, 8) * 0.6, title: briefName(hv) + "에 돈이 몰렸어요 — 거래대금 평소의 " + hv.amtX.toFixed(1) + "배", sub: "주가 " + issPct(issRet(hv)) + " · " + cPrice(hv.sym, hv.last), sym: hv.sym });
  // ⑦ 채널 전용: 깊은 하락(MDD)·시장 신호
  (opt.mdd || []).forEach(function (r) {
    if (!r || r.err || r.cur > -0.15) return;
    C.push({ cat: "mdd", emoji: "🕳️", score: 1.4 + (r.deeper < 3 ? 1.2 : 0) - r.cur * 2,
      title: r.name + " 고점 대비 " + issPct(r.cur, 0), sub: r.deeper === 0 ? "지난 10년 중 가장 깊은 하락이에요" : "지난 10년 10%+ 하락 " + Math.max(r.eps, r.deeper + 1) + "번 중 " + (r.deeper + 1) + "번째로 깊어요", sym: r.sym });
  });
  if (opt.now && opt.now.why && opt.now.why.length) C.push({ cat: "signal", emoji: "🧭", score: 1.6 + opt.now.why.length * 0.4, title: "지금 시장 신호 — " + opt.now.why[0].split("→").pop().trim(), sub: opt.now.why.join(" / ") });

  // 종류별 상한: 증시 지역별 1, 급등락 2, 나머지 1 · 같은 종목 중복 금지
  C.sort(function (a, b) { return b.score - a.score; });
  var out = [], used = {}, syms = {}, cap = { mover: 2 };
  C.forEach(function (c) {
    if (out.length >= 5) return;
    var k = c.cat; used[k] = used[k] || 0;
    if (used[k] >= (cap[k] || 1)) return;
    if (c.sym && syms[c.sym]) return;
    used[k]++; if (c.sym) syms[c.sym] = 1; out.push(c);
  });
  out.asOf = R.market === "kr" ? R.asOfKr : (R.asOfUs || R.asOf); out.mode = ISS_MODE;
  out.market = R.market; out.mktName = R.mktName;
  return out;
}

function issuesText(list) {
  var d = typeof cDate === "function" ? cDate(list.asOf) : "";
  return "📌 " + (ISS_LBL[list.mode] || "오늘") + "의 핵심 이슈 5" + (list.market && list.market !== "all" ? " (" + list.mktName + ")" : "") + " — " + d + "\n\n" +
    list.map(function (it, i) { return (i + 1) + ". " + it.emoji + " " + it.title + "\n   " + it.sub; }).join("\n") +
    "\n\n※ 종가 기준 자동 집계 · 평소 대비 이례적인 순 · 투자 조언 아님\n@uphill.lab";
}

/* 화면: 섹션 렌더 */
function issuesRender(boxId, list) {
  var box = $(boxId); if (!box) return;
  if (!list || !list.length) { box.innerHTML = ""; return; }
  box.innerHTML = '<div class="issHead"><b>📌 ' + (ISS_LBL[list.mode] || "오늘") + '의 핵심 이슈 5</b><small>' + (list.market && list.market !== "all" ? list.mktName + " · " : "") + '자료 전체에서 평소보다 이례적인 순</small>' +
    '<span class="issBtns"><button class="chip" data-act="copy">복사</button></span></div>' +
    '<ol class="issList">' + list.map(function (it, i) {
      return '<li><span class="issNo">' + (i + 1) + '</span><span class="issEmo">' + it.emoji + '</span><div><b>' + escapeHtml(it.title) + '</b><small>' + escapeHtml(it.sub) + '</small></div>' +
        (it.sym ? '<button class="linkBtn issGo" data-sym="' + it.sym + '" title="종목 탭에서 보기">›</button>' : '') + '</li>';
    }).join("") + '</ol>';
  box.querySelector('[data-act="copy"]').onclick = function () { (typeof chCopy === "function" ? chCopy : issCopy)(issuesText(list), this); };
  var cb = box.querySelector('[data-act="card"]'); if (cb) cb.onclick = function () { issuesCardOpen(list); };   // v12.27 카드 버튼이 없는 화면에서 오류 나던 것
  Array.prototype.forEach.call(box.querySelectorAll(".issGo"), function (b) {
    b.onclick = function () { $("searchInput").value = b.getAttribute("data-sym"); navTo("single", "chart"); if (typeof load === "function") load(); };
  });
}
function issCopy(text, btn) {
  function done(ok) { var o = btn.textContent; btn.textContent = ok ? "✓ 복사됨" : "복사 실패"; setTimeout(function () { btn.textContent = o; }, 1500); }
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); else done(false);
}

/* ---------- v9.8 표지 제목(헤드라인) 엔진 ----------
   전처럼 1위 이슈 하나로 "○○ 약세 — 돈이 움직였다"를 찍어내지 않고,
   이슈 5개 + 시장 폭(오른 비율) + 지수 + 업종 1등·꼴찌 + 급등락 + 거래대금 + 그날 기사 제목을 함께 읽어
   '그날 가장 궁금한 한 줄'을 고른다. 사실(숫자)만 쓰고, 기사는 제목에 실제로 등장하는 이름만 붙인다. */
function issNewsHit(name, news) {
  if (!name || !news || !news.length) return null;
  var key = String(name).replace(/\s*\(.*?\)\s*/g, "").replace(/\s+/g, "").slice(0, 6); if (key.length < 2) return null;
  for (var i = 0; i < news.length; i++) { var t = cNewsClean(news[i].title); if (t.replace(/\s+/g, "").indexOf(key) >= 0) return t; }
  return null;
}
function issShort(t, n) { t = String(t).replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim(); if (t.length <= n) return t; var cut = t.slice(0, n + 6), sp = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("…"), cut.lastIndexOf(",")); return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,·…]+$/, ""); }   // v10.4: 말줄임 대신 단어 끝에서 끊기
function issHeadline(list, R, news) {
  var out = [], seed = Math.floor((Date.now() + 9 * 3600e3) / 86400e3);
  if (!R || R.marketWideOff) return null;
  var t = R.temp, i0 = (R.indexRow || [])[0], th = R.themes || [], upP = Math.round(t.upPct * 100), dnP = 100 - upP;
  var unit = R.market === "coin" ? "코인" : "종목", sec = R.market === "coin" ? "테마" : "업종";
  var top = list[0] || {}, k = (top.sub || "").match(/평소[^0-9]*([0-9.]+)배/), times = k ? +k[1] : 0;
  var mv = (R.movers && R.movers.up[0]) || null, md = (R.movers && R.movers.down[0]) || null, hv = (R.hotVol || [])[0];
  function r1(x) { return x.ret1 != null && R.mode === "day" ? x.ret1 : x.ret; }
  function add(score, hook, sub) { out.push({ score: score, hook: hook, sub: sub }); }
  // ① 지수와 종목이 따로 논 날
  if (i0 && i0.ret > 0.002 && t.upPct < 0.45) add(5 + (0.45 - t.upPct) * 10, i0.name + " [[" + issPct(i0.ret) + "]]인데 10개 중 " + Math.round((1 - t.upPct) * 10) + "개는 내렸다", "지수를 올린 건 몇몇 큰 " + unit + " — 내 " + unit + "이 빠진 이유");
  if (i0 && i0.ret < -0.002 && t.upPct > 0.55) add(5 + (t.upPct - 0.55) * 10, i0.name + " [[" + issPct(i0.ret) + "]]인데 10개 중 " + Math.round(t.upPct * 10) + "개는 올랐다", "지수를 끌어내린 건 일부 대형 " + unit);
  // ② 시장 전체가 한 방향
  if (t.upPct >= 0.7) add(4 + (t.upPct - 0.7) * 10, "10개 중 [[" + Math.round(t.upPct * 10) + "개]]가 오른 날" + (th[0] ? " — " + th[0].name + " " + issPct(th[0].ret) : ""), "오른 " + unit + " " + upP + "% · 20일선 위 " + Math.round(t.abovePct * 100) + "%");
  if (t.upPct <= 0.3) add(4 + (0.3 - t.upPct) * 10, "10개 중 [[" + Math.round((1 - t.upPct) * 10) + "개]]가 내린 날" + (md ? " — 최대 " + briefName(md) + " " + issPct(r1(md)) : ""), "내린 " + unit + " " + dnP + "% · 개별 악재보다 시장 전체 분위기");
  // ③ 거시 충격 (환율·금리·공포·금·원유·비트코인) — 평소의 N배일 때만
  if (/^(fx|rate|vix|gold|oil|btc)$/.test(top.cat) && times >= 2) {
    var nm = String(top.title).replace(/\s*[—(].*$/, "").replace(/\s*→.*$/, "");
    var hit = issNewsHit(nm.split(" ")[0] === "원/달러" ? "환율" : nm.split(" ")[0], news);
    add(4.5 + Math.min(times, 6) * 0.3, "[[" + nm + "]] — 평소의 " + times + "배" + (top.cat === "rate" ? ", 금리가 움직였다" : top.cat === "vix" ? ", 시장이 긴장했다" : top.cat === "fx" ? ", 달러가 움직였다" : ""), hit ? "기사: " + issShort(hit, 44) : String(top.sub).split(" · ")[0]);
  }
  // ④ 업종 1등·꼴찌의 간극
  if (th.length >= 4) { var gap = th[0].ret - th[th.length - 1].ret; if (gap >= 0.025) add(3 + gap * 40, th[0].name + " [[" + issPct(th[0].ret) + "]] vs " + th[th.length - 1].name + " [[" + issPct(th[th.length - 1].ret) + "]]", "같은 날 " + sec + " 차이 " + (gap * 100).toFixed(1) + "%p — 어디에 있었느냐가 갈랐다"); }
  // ⑤ 급등락 종목 + 그 이름이 들어간 기사
  [mv, md].forEach(function (x) { if (!x || Math.abs(r1(x)) < 0.04) return; var hit = issNewsHit(briefName(x), news); add((hit ? 5.5 : 3.2) + Math.abs(r1(x)) * 10, "[[" + briefName(x) + " " + issPct(r1(x)) + "]]" + (hit ? " — 기사는 이렇게 말했다" : ", 이유는?"), hit ? "“" + issShort(hit, 42) + "”" : (x.amtX >= 1.5 ? "거래대금 평소의 " + x.amtX.toFixed(1) + "배" : "관련 기사는 뒤 뉴스 브리핑에")); });
  // ⑥ 돈이 몰린 곳
  if (hv && hv.amtX >= 3) { var hh = issNewsHit(briefName(hv), news); add(3.5 + Math.min(hv.amtX, 8) * 0.3 + (hh ? 1 : 0), "[[" + briefName(hv) + "]]에 평소의 " + hv.amtX.toFixed(1) + "배 돈이 몰렸다", hh ? "기사: " + issShort(hh, 44) : "주가 " + issPct(r1(hv)) + " — 관심이 몰린 이유는?"); }
  // ⑦ 테마가 움직였고 기사도 있는 경우
  if (th[0] && Math.abs(th[0].ret) >= 0.02) { var th0 = issNewsHit(th[0].name.split("·")[0], news) || issNewsHit(briefName(th[0].best), news); if (th0) add(4.8, "[[" + th[0].name + " " + issPct(th[0].ret) + "]] — 기사가 먼저 말했다", "“" + issShort(th0, 42) + "”"); }
  if (th.length && th[th.length - 1].ret <= -0.02) { var tb = th[th.length - 1], thb = issNewsHit(tb.name.split("·")[0], news) || issNewsHit(briefName(tb.worst), news); if (thb) add(4.8, "[[" + tb.name + " " + issPct(tb.ret) + "]] — 무슨 일이?", "“" + issShort(thb, 42) + "”"); }
  // ⑧ 기본 (1위 이슈) — 위 후보가 없을 때만 의미 있게
  if (top.title) add(2, "[[" + String(top.title).replace(/\s*—.*$/, "") + "]]" + (times ? " — 평소의 " + times + "배, 왜?" : " — 오늘 1위 이슈"), String(top.sub || "").split(" · ")[0]);
  out.sort(function (a, b) { return b.score - a.score; });
  // 1·2위 점수가 비슷하면 날짜로 번갈아 (매일 같은 틀로 보이지 않게)
  var pick = out[0]; if (out[1] && out[0].score - out[1].score < 0.6 && seed % 2) pick = out[1];
  return pick || null;
}
/* 카드 (블랙 & 골드) — 카드 묶음 맨 앞 표지로도 쓴다 */
function issuesCard(list, page, total) {
  var c = cNew(), g = c.g, P = CARD.PAD, W = CARD.W - P * 2;
  var mk = list.market && list.market !== "all" ? list.mktName + " · " : "";
  var lbl = ISS_LBL[list.mode] || "오늘", tag = list.mode === "week" ? "WEEKLY TOP 5" : list.mode === "month" ? "MONTHLY TOP 5" : "TODAY'S TOP 5";
  // 표지 제목: 1위 이슈로 궁금증을 만드는 한 줄 (사실만, 과장 없이) — 넘기게 하는 역할
  var top = list[0], hook = lbl + "의 핵심 이슈 [[5]]";
  if (top) {
    var tt = String(top.title).replace(/\s*—.*$/, ""), k = (top.sub || "").match(/평소[^0-9]*([0-9.]+)배/);
    if (/^idx/.test(top.cat)) hook = "[[" + tt + "]]" + (k ? " — 평소의 " + k[1] + "배, 왜?" : " — 무슨 일이?");
    else if (/^theme/.test(top.cat)) hook = "[[" + tt + "]] — 돈이 움직였다";
    else if (top.cat === "mover") hook = "[[" + tt.replace(/ 급[등락]$/, "") + "]]" + (k ? " — 평소의 " + k[1] + "배" : "") + ", 이유는?";
    else if (top.cat === "hot") hook = "[[" + tt.split("에 돈이")[0] + "]]에 돈이 몰렸다 — 왜?";
    else if (top.cat === "breadth") hook = "[[" + tt + "]] — 내 종목만 그런 게 아니다";
    else if (/mdd|dd/.test(top.cat)) hook = "[[" + tt + "]] — 이제 어디쯤?";
    else hook = "[[" + tt + "]]" + (k ? " — 평소의 " + k[1] + "배, 왜?" : " — 오늘 1위 이슈");
    if (cW(g, cPlain(hook), 44, 800) > (CARD.W - P * 2) * 1.9) hook = "[[" + tt + "]]";
  }
  // v9.8 데이터 + 기사를 함께 읽은 헤드라인이 있으면 그걸 우선
  var sub = top ? "오늘 가장 이례적인 움직임 5가지 — 넘겨서 확인 →" : "자료 전체에서 평소보다 이례적인 움직임 순";
  try {
    var Rh = list.R || (typeof briefState !== "undefined" && briefState.result && briefState.result.market === (list.market || "all") ? briefState.result : null);
    var nw = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.mk === (list.market || "all") && CARD_NEWS.items) || [];
    var hl = list.mode === "day" ? issHeadline(list, Rh, nw) : null;
    if (hl && hl.hook) { hook = hl.hook; if (cW(g, cPlain(hook), 44, 800) > (CARD.W - P * 2) * 1.9) hook = "[[" + cPlain(hook).replace(/\[\[|\]\]/g, "").split(/ — | vs |, /)[0] + "]]"; if (hl.sub) sub = hl.sub; }
  } catch (e) { console.warn(e); }
  cHead(c, tag + " · " + mk + cDate(list.asOf), hook, sub, page || 0, total || 0);
  // v12.23 릴스형(세로가 긴 한 장): 칸을 늘리기 전에 이슈마다 관련 기사 제목 한 줄을 더 담는다(있을 때만)
  var reel = CARD.H > 1500, newsAll = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items) || [];
  function newsFor(it) { var key = String(it.title || "").replace(/^[^가-힣A-Za-z0-9]+/, "").split(/[ +\-—(]/)[0]; if (!key || key.length < 1) return null; var hit = newsAll.filter(function (n) { return String(n.title || "").indexOf(key) >= 0; })[0]; return hit ? (typeof cNewsClean === "function" ? cNewsClean(hit.title) : String(hit.title)) + (hit.press ? " · " + hit.press : "") : null; }
  var extra = reel ? list.map(newsFor) : list.map(function () { return null; }), anyExtra = extra.some(Boolean);
  var per = reel && anyExtra ? Math.floor((CARD.H - 110 - c.y) / list.length) : Math.min(Math.round(150 * (reel ? CARD.H / 1350 : 1)), Math.floor((CARD.H - 110 - c.y) / list.length));
  list.forEach(function (it, i) {
    var y = c.y, bh = per - 12, ex = extra[i], mid = y + bh / 2 - (ex ? 22 : 0);
    cBox(g, P, y, W, bh, 16);
    cText(g, String(i + 1), P + 44, y + bh / 2 + 18, 50, 800, CARD_C.gold, "center");
    var tx = P + 92, tw = W - 116;
    var ts = reel ? 34 : 31; while (ts > 23 && cW(g, it.emoji + " " + it.title, ts, 800) > tw) ts -= 1;
    cText(g, cFit(g, it.emoji + " " + it.title, tw, ts, 800), tx, mid - 4, ts, 800, CARD_C.txt);
    cText(g, cFit(g, it.sub, tw, 22, 500), tx, mid + 30, 22, 500, CARD_C.sub);
    if (ex) { g.fillStyle = CARD_C.gold; g.fillRect(tx, mid + 52, 4, 30); cText(g, cFit(g, ex, tw - 16, 21, 600), tx + 14, mid + 75, 21, 600, CARD_C.txt); }
    c.y += per;
  });
  cFoot(c, "종가 기준 자동 집계 · 투자 조언 아님");
  return c.cv;
}
function issuesCardOpen(list) {
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    CARD_TXT = ""; issuesCard(list);
    if (!document.fonts || !document.fonts.load) return;
    var txt = CARD_TXT.replace(/\s+/g, "");
    return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); }));
  }).then(function () {
    var cv = issuesCard(list);
    var url = cv.toDataURL("image/png"), file = "uphill.lab_핵심이슈5_" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "") + ".png";
    var box = document.createElement("div");
    box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="save">⬇ 저장</button>' +
      (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유</button>' : '') + '<span class="briefDim">1080×1350 · 카드 묶음(🃏 카드 만들기)에도 맨 앞에 들어가요</span></div>' +
      '<img alt="" style="width:100%;max-width:420px;border-radius:12px;display:block;margin:0 auto">';
    box.querySelector("img").src = url;
    box.querySelector('[data-act="save"]').onclick = function () { var l = document.createElement("a"); l.href = url; l.download = file; document.body.appendChild(l); l.click(); l.remove(); };
    var sh = box.querySelector('[data-act="share"]');
    if (sh) sh.onclick = function () { cv.toBlob(function (b) { var f = new File([b], file, { type: "image/png" }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(function () {}); }); };
    if (typeof thrPanelHtml === "function" && typeof hubThreadsAuto === "function") { var tpd = document.createElement("div"); tpd.innerHTML = thrPanelHtml("주식"); box.appendChild(tpd.firstChild); try { thrBind(box, hubThreadsAuto("오늘의 핵심 이슈 5", [{ name: "핵심 이슈 5" }], { lines: list.slice(0, 5).map(function (it) { return String(it.title || "").replace(/<[^>]+>/g, ""); }) })); } catch (e) {} }   // v12.21 캡션·스레드 글
    infoModal.open("📌 " + (ISS_LBL[list.mode] || "오늘") + "의 핵심 이슈 5", box);
    if (typeof ocHook === "function") try { ocHook("issues", ["핵심 이슈 5"], box); } catch (e) { console.warn(e); }
  });
}

/* 페이지 연결 */
function issuesForBrief() {
  if (typeof briefState === "undefined" || !briefState.recent) return;
  briefState.issues = issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular });
  issuesRender("briefTop5", briefState.issues);
}
function issuesForChannel() {
  if (typeof chState === "undefined" || !chState.recent) return;
  chState.issues = issuesCompute(chState.recent, { market: "stock", popular: chState.popularRaw, mdd: (chState.mdd || []).concat(chState.mddPick || []), now: chState.now });
  issuesRender("chTop5", chState.issues);
}
