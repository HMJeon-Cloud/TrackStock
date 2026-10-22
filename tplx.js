/* ============================================================
   양식집 확장 (v10.5) — 같은 9가지 틀에 '데이터를 많이 담은' 새 내용 출처를 더한다
   rank: 1년 수익률 · RSI 과매도 · 조용히 오르는 · 기술 점수 TOP12
   table: 급등·급락 상세 · 인기 종목 상세 · 52주 신고가 명단 · 국면별 조건부 승률(25년치)
   compare: 연초 vs 지금 · 1개월 전 vs 지금 / grid: 시장 체력 12 / lines: 숫자로 보는 오늘 7줄
   timeline: 이번 달 남은 일정(주별) / quote: 두 번째 기사 / calendar: 다음 달 달력
   ============================================================ */
(function () {
  function add(cat, list) { TPL_SOURCES[cat] = TPL_SOURCES[cat].concat(list); }
  add("rank", [{ id: "y1", t: "1년 수익률 TOP12" }, { id: "rsiLow", t: "RSI 과매도 TOP12 (많이 눌린 순)" }, { id: "quiet", t: "조용히 오르는 TOP12 (3개월 · 변동 작음)" }, { id: "tech", t: "기술 점수 TOP12 (추세·위치·RSI·대금)" }]);
  add("table", [{ id: "movers", t: "급등·급락 상세 (하루·1주·1개월·RSI·대금)" }, { id: "popular", t: "인기 종목 상세 (종가·등락·고점比·RSI)" }, { id: "hilo", t: "52주 신고가 명단" }, { id: "cond", t: "국면별 조건부 승률 (25년치 · 지금 신호)" }]);
  add("compare", [{ id: "ytd", t: "연초 vs 지금 (대표 자산 4)" }, { id: "m1pop", t: "1개월 전 vs 지금 (인기 4)" }]);
  add("grid", [{ id: "health", t: "시장 체력 12칸 (추세·과열·쏠림)" }]);
  add("lines", [{ id: "today", t: "숫자로 보는 오늘 7줄" }]);
  add("timeline", [{ id: "month", t: "이번 달 남은 일정 (주별)" }]);
  add("quote", [{ id: "second", t: "두 번째로 관심 가는 기사" }]);
  add("calendar", [{ id: "next", t: "다음 달 달력" }]);
})();
/* 출처별 사전 준비(뉴스·선별·25년치) */
var tplPrep0 = tplPrep;
tplPrep = function (cat, mk, src) {
  var p = tplPrep0(cat, mk);
  if (cat === "table" && src === "cond" && typeof nbLoad === "function" && typeof DP_SYMS !== "undefined") p = Promise.all([p, nbLoad(DP_SYMS)]);
  return p;
};
function tplYtd(sym) {
  var r = briefState.recent, d = r && r.symbols[sym]; if (!d || !d.t || !d.c) return null;
  var y = new Date(Date.now() + 9 * 3600e3).getUTCFullYear(), t0 = Date.UTC(y, 0, 1) / 1000 - 9 * 3600, i0 = -1;
  for (var i = 0; i < d.t.length; i++) if (d.t[i] >= t0 && d.c[i] != null) { i0 = i; break; }
  if (i0 < 1) return null; var a = d.c[i0 - 1], b = d.c[d.c.length - 1]; return a > 0 && b > 0 ? { a: a, b: b, r: b / a - 1 } : null;
}
var tplSpec0 = tplSpec;
/* v12.31 바깥 껍데기: ① 시장 전체 숫자를 못 쓰는 날(R.marketWideOff)엔 시장 전체를 말하는 카드는 만들지 않는다
                     ② 1년치 시세가 필요한 순위·명단·체력은 대표 목록으로 계산하므로 부제에 '대표 N개 기준'을 붙인다 */
var TPLX_WIDE = { "table:movers": 1, "table:hilo": 1, "grid:health": 1, "lines:today": 1 };
var TPLX_APP = { "rank:y1": 1, "rank:rsiLow": 1, "rank:quiet": 1, "rank:tech": 1, "table:hilo": 1, "grid:health": 1 };
tplSpec = function (cat, srcId, mkSel) {
  var R = tplR(mkSel); if (!R) return null;
  if (R.marketWideOff && TPLX_WIDE[cat + ":" + srcId]) return null;
  var x = tplSpecX(cat, srcId, mkSel);
  if (x && x.meta && TPLX_APP[cat + ":" + srcId]) { var n = (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym); }).length; x.meta.sub = (x.meta.sub || "") + " · 대표 " + n + "개 중(전체 시장 아님)"; }
  return x;
};
function tplSpecX(cat, srcId, mkSel) {
  var R = tplR(mkSel); if (!R) return null;
  var mk = typeof cMktInfo === "function" ? cMktInfo(R) : null, mkName = mk ? mk.name : "전체", unit = R.market === "coin" ? "코인" : "종목", date = tplDateTxt(R), src = tplSrc(R);
  var S = (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym); });
  var SX = S.filter(function (s) { return !/ETF|지수|전체시장|KODEX|TIGER/.test(s.name || "") && !/^(SPY|VOO|QQQ|VTI|SCHD|JEPI|TLT|IEF|SHY|GLD|SLV|USO|DBC)$/.test(s.sym); });
  function r1(s) { return s.ret1 != null ? s.ret1 : s.ret; }
  function P(x, d) { return tplPct(x, d == null ? 1 : d); }
  function rsi(s) { return s.rsi != null ? String(Math.round(s.rsi)) : "-"; }
  function head(title, sub, cn) { return { title: title, sub: sub, source: src, catName: cn }; }
  /* ---------- rank ---------- */
  if (cat === "rank" && srcId === "y1") { var l = SX.filter(function (s) { return s.y1 != null; }).sort(function (a, b) { return b.y1 - a.y1; }); return { meta: head("1년 수익률 순위", mkName + " " + unit + " · " + date + " · 1년 전 같은 날 대비", mkName + " 순위"), spec: { items: l.slice(0, tplN(12, 16)).map(function (s, i) { return { rank: i + 1, name: briefName(s), value: P(s.y1, 0), tag: "고점 " + P(s.vsHi, 0) }; }) } }; }
  if (cat === "rank" && srcId === "rsiLow") { var l2 = SX.filter(function (s) { return s.rsi != null; }).sort(function (a, b) { return a.rsi - b.rsi; }); return { meta: head("RSI 과매도 순위", mkName + " " + unit + " · " + date + " · RSI 30 아래면 많이 눌린 구간", mkName + " 순위"), spec: { items: l2.slice(0, tplN(12, 16)).map(function (s, i) { return { rank: i + 1, name: briefName(s), value: "RSI " + rsi(s), tag: s.above200 ? "200일선 위" : "200일선 아래" }; }) } }; }
  if (cat === "rank" && srcId === "quiet") { var l3 = SX.filter(function (s) { return s.m3 > 0 && s.sd > 0; }).sort(function (a, b) { return b.m3 / b.sd - a.m3 / a.sd; }); return { meta: head("조용히 오르는 순위", mkName + " · 3개월 수익률 ÷ 하루 변동 — 덜 흔들리고 꾸준히 오른 순", mkName + " 순위"), spec: { items: l3.slice(0, tplN(12, 16)).map(function (s, i) { return { rank: i + 1, name: briefName(s), value: P(s.m3, 0), tag: "변동 " + (s.sd * 100).toFixed(1) + "%" }; }) } }; }
  if (cat === "rank" && srcId === "tech" && typeof pkTech === "function") { var l4 = SX.map(pkTech).sort(function (a, b) { return b.score - a.score || b.bs - a.bs; }); return { meta: head("기술 점수 순위", mkName + " · 추세·위치·RSI·흐름·이격·거래대금·변동성 합산 (하루 등락 제외)", "선별 " + unit), spec: { items: l4.slice(0, tplN(12, 16)).map(function (x, i) { return { rank: i + 1, name: briefName(x.s), value: "+" + x.bs + " / -" + x.ws, tag: P(x.s.m1, 0) + " 1개월" }; }) } }; }
  /* ---------- table ---------- */
  if (cat === "table" && srcId === "movers") {
    var up = R.movers.up.slice(0, tplN(5, 7)), dn = R.movers.down.slice(0, tplN(5, 7));
    return { meta: head("급등·급락 상세", mkName + " · " + date + " · 위 5 오른 / 아래 5 내린 " + unit, mkName + " 급등락"), spec: { cols: [unit, "하루", "1주", "1개월", "RSI", "대금"], widths: [0.3, 0.14, 0.14, 0.14, 0.12, 0.16], hlCols: [1], rows: up.concat(dn).map(function (s) { return [briefName(s), P(r1(s)), P(s.ret5), P(s.m1, 0), rsi(s), s.amtX != null ? s.amtX.toFixed(1) + "배" : "-"]; }), note: "대금 = 거래대금이 평소(20일 평균)의 몇 배인지" } };
  }
  if (cat === "table" && srcId === "popular") {
    var pl = (R.popular || []).slice(0, tplN(10, 14));
    return { meta: head("인기 " + unit + " 상세", mkName + " · " + date + " · 사람들이 가장 많이 찾는 " + unit, mkName + " 인기"), spec: { cols: [unit, "종가", "하루", "1개월", "고점比", "RSI"], widths: [0.26, 0.2, 0.13, 0.13, 0.15, 0.13], hlCols: [2], rows: pl.map(function (s) { return [briefName(s), tplFmt(s.sym, s.last), P(r1(s)), P(s.m1, 0), P(s.vsHi, 0), rsi(s)]; }) } };
  }
  if (cat === "table" && srcId === "hilo") {
    var hi = SX.filter(function (s) { return s.newHigh; }).sort(function (a, b) { return (b.amtX || 0) - (a.amtX || 0); }).slice(0, tplN(10, 14));
    return { meta: head("52주 신고가 명단", mkName + " · " + date + " · " + SX.filter(function (s) { return s.newHigh; }).length + "개 중 거래대금 많은 순", mkName + " 신고가"), spec: { cols: [unit, "종가", "하루", "1개월", "1년", "대금"], widths: [0.26, 0.2, 0.13, 0.13, 0.14, 0.14], hlCols: [4], rows: hi.map(function (s) { return [briefName(s), tplFmt(s.sym, s.last), P(r1(s)), P(s.m1, 0), P(s.y1, 0), s.amtX != null ? s.amtX.toFixed(1) + "배" : "-"]; }), note: hi.length ? "신고가 = 오늘 종가가 지난 1년 중 가장 높음 · '비싸다'보다 '파는 사람이 적다'에 가까워요" : "오늘은 52주 신고가 " + unit + "이 없어요" } };
  }
  if (cat === "table" && srcId === "cond" && typeof dpCondStats === "function") {
    var now = typeof nbNow === "function" ? nbNow() : { match: {} }, ids = ["panic", "rateUp", "rateDown", "oilUp", "dollarUp"], order = ids.filter(function (k) { return now.match && now.match[k]; }).concat(ids), id = null, st = null;
    for (var q = 0; q < order.length && !(st && st.assets.length >= 3); q++) { id = order[q]; st = dpCondStats(id); }   // 지금 신호부터, 사례가 모자라면 다음 국면
    if (!(st && st.assets.length)) return { meta: head("이런 국면, 과거엔", "25년치 데이터를 불러오는 중이거나 사례가 부족해요 — 잠시 뒤 다시 눌러 주세요", "연구노트"), spec: { cols: ["자산", "6개월 승률", "1년 승률"], rows: [] } };
    if (st && st.assets.length) return { meta: head("이런 국면, 과거엔", DP_COND[id].t + " · " + st.years + "년치 " + st.n + "번 · " + (st.nowHit ? "지금 조건 충족" : "지금은 조건 밖"), "연구노트"), spec: { cols: ["자산", "6개월 승률", "6개월 중앙", "1년 승률", "1년 중앙", "1년 최악"], widths: [0.2, 0.16, 0.16, 0.16, 0.16, 0.16], hlCols: [3], rows: st.assets.map(function (a) { return [a.name, Math.round(a.w6 * 100) + "%", P(a.m6, 0), Math.round(a.w12 * 100) + "%", P(a.m12, 0), P(a.worst12, 0)]; }), note: "승률 = 그 뒤 플러스였던 비율 · 과거 통계이며 미래를 보장하지 않아요" } };
  }
  /* ---------- compare ---------- */
  if (cat === "compare" && srcId === "ytd") {
    var SY = R.market === "coin" ? ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD"] : R.market === "kr" ? ["^KS11", "^KQ11", "005930.KS", "000660.KS"] : R.market === "us" ? ["^GSPC", "^IXIC", "NVDA", "AAPL"] : ["^GSPC", "^KS11", "BTC-USD", "GLD"];
    var y0 = new Date(Date.now() + 9 * 3600e3).getUTCFullYear();
    return { meta: head(y0 + "년 연초 vs 지금", date + " 기준 · 작년 마지막 거래일 종가 → 지금", "그때·지금"), spec: { aLabel: "연초", aSub: (y0 - 1) + "년 마지막 종가", bLabel: "지금", bSub: date + " 종가", rows: SY.map(function (sym) { var y = tplYtd(sym), s = tplStat(sym); if (!y || !s) return null; return { badge: briefName(s), name: "올해 " + P(y.r, 0), a: tplFmt(sym, y.a), b: tplFmt(sym, y.b), pct: P(y.r, 0) }; }).filter(Boolean) } };
  }
  if (cat === "compare" && srcId === "m1pop") {
    var pp = (R.popular || []).filter(function (s) { return s.m1 != null; }).slice(0, tplN(4, 6));
    return { meta: head("한 달 전 · 지금", mkName + " 인기 " + unit + " 4개 · " + date, "그때·지금"), spec: { aLabel: "1개월 전", aSub: "21거래일 전 종가", bLabel: "지금", bSub: date + " 종가", rows: pp.map(function (s) { return { badge: briefName(s), name: "고점 대비 " + P(s.vsHi, 0), a: tplFmt(s.sym, s.last / (1 + s.m1)), b: tplFmt(s.sym, s.last), pct: P(s.m1, 0) }; }) } };
  }
  /* ---------- grid ---------- */
  if (cat === "grid" && srcId === "health") {
    var n = SX.length || 1, cnt = function (f) { return SX.filter(f).length; }, med = function (arr) { arr = arr.filter(function (x) { return x != null && isFinite(x); }).sort(function (a, b) { return a - b; }); return arr.length ? arr[arr.length >> 1] : null; };
    var b50 = SX.filter(function (s) { return s.above50 != null; }), b200 = SX.filter(function (s) { return s.above200 != null; });
    var boxes = [{ label: "20일선 위", value: Math.round(cnt(function (s) { return s.above20; }) / n * 100), unit: "%" }, { label: "50일선 위", value: b50.length ? Math.round(b50.filter(function (s) { return s.above50; }).length / b50.length * 100) : "-", unit: "%" }, { label: "200일선 위", value: b200.length ? Math.round(b200.filter(function (s) { return s.above200; }).length / b200.length * 100) : "-", unit: "%" }, { label: "RSI 70↑ 과열", value: cnt(function (s) { return s.rsi >= 70; }), unit: "개" },
      { label: "RSI 30↓ 과매도", value: cnt(function (s) { return s.rsi != null && s.rsi <= 30; }), unit: "개" }, { label: "52주 신고가", value: cnt(function (s) { return s.newHigh; }), unit: "개" }, { label: "52주 신저가", value: cnt(function (s) { return s.newLow; }), unit: "개" }, { label: "대금 2배↑ 쏠림", value: cnt(function (s) { return s.amtX >= 2; }), unit: "개" },
      { label: "1개월 +10%↑", value: cnt(function (s) { return s.m1 >= 0.1; }), unit: "개" }, { label: "1개월 -10%↓", value: cnt(function (s) { return s.m1 <= -0.1; }), unit: "개" }, { label: "1개월 중앙값", value: P(med(SX.map(function (s) { return s.m1; })), 1), unit: "" }, { label: "고점比 중앙값", value: P(med(SX.map(function (s) { return s.vsHi; })), 0), unit: "" }];
    return { meta: head("시장 체력 12", mkName + " " + n + "개 " + unit + " · " + date + " 종가", "시장 체력"), spec: { boxes: boxes, note: "선 위 비율이 높고 신고가가 많으면 체력 좋음 · 과열 수가 과매도 수보다 훨씬 많으면 숨 고르기 신호" } };
  }
  /* ---------- lines ---------- */
  if (cat === "lines" && srcId === "today") {
    var t = R.temp, i0 = R.indexRow[0], th = R.themes || [], mv = R.movers.up[0], md = R.movers.down[0], hv = (R.hotVol || [])[0], vix = tplStat("^VIX");
    var rows = [i0 ? { icon: "📊", left: i0.name, right: P(i0.ret), sub: "대표 지수 하루 등락" } : null, { icon: "🌡️", left: "오른 " + unit, right: Math.round(t.upPct * 100) + "%", sub: t.upPct >= 0.6 ? "넓게 오른 날" : t.upPct <= 0.4 ? "넓게 내린 날" : "반반 — 종목별로 갈린 날" },
      { icon: "📈", left: "20일선 위", right: Math.round(t.abovePct * 100) + "%", sub: "단기 추세가 살아 있는 비율" }, th[0] ? { icon: "🏆", left: "1등 업종", right: th[0].name + " " + P(th[0].ret), sub: "꼴찌 " + th[th.length - 1].name + " " + P(th[th.length - 1].ret) } : null,
      mv ? { icon: "🚀", left: "최대 상승", right: briefName(mv) + " " + P(r1(mv)), sub: md ? "최대 하락 " + briefName(md) + " " + P(r1(md)) : "" } : null, hv ? { icon: "💰", left: "돈 쏠림", right: briefName(hv) + " " + hv.amtX.toFixed(1) + "배", sub: "거래대금이 평소의 몇 배인지" } : null,
      vix ? { icon: "😨", left: "공포지수", right: vix.last.toFixed(1), sub: vix.last < 20 ? "20 아래 — 평온" : vix.last < 30 ? "20~30 — 불안" : "30 이상 — 공포" } : null].filter(Boolean).slice(0, tplN(7, 10));
    return { meta: head("숫자로 보는 오늘", mkName + " · " + date + " · 7줄 요약", "오늘 숫자"), spec: { rows: rows, punch: { left: "오늘의 한 줄", right: t.upPct >= 0.6 ? "넓게 오른 날" : t.upPct <= 0.4 ? "넓게 내린 날" : "고르는 장" }, closing: "숫자는 매일 바뀌어요 — 저장해 두고 내일과 비교해 보세요" } };
  }
  /* ---------- timeline ---------- */
  if (cat === "timeline" && srcId === "month" && typeof pubUpcoming === "function") {
    var ev = pubUpcoming(31).filter(function (e) { return e.k !== "hol"; }), wk = {};
    ev.forEach(function (e) { var p = e.d.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400e3), k = mon.toISOString().slice(0, 10); (wk[k] = wk[k] || []).push(e); });
    var bl = Object.keys(wk).sort().slice(0, 4).map(function (k) { var a = new Date(k + "T00:00:00Z"); return { date: (a.getUTCMonth() + 1) + "/" + a.getUTCDate() + "\n주", title: wk[k].length + "개 일정", items: wk[k].slice(0, tplN(5, 7)).map(function (e) { return e.d.slice(5).replace("-", "/") + " " + String(e.t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim() + (e.sure === false ? " (예정)" : "") + (e.n ? " — [[" + e.n.split(" · ")[0] + "]]" : ""); }) }; });
    return { meta: head("이번 달 남은 일정", pubToday().slice(5).replace("-", "/") + "부터 한 달 · 주별 · 발표·실적", "일정"), spec: { blocks: bl.length ? bl : [{ date: "-", title: "큰 일정 없음", items: ["예정된 주요 발표가 없어요"] }] } };
  }
  /* ---------- quote ---------- */
  if (cat === "quote" && srcId === "second") {
    var items = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items) || [], l1 = typeof cNewsLead === "function" ? cNewsLead(items, R) : null, rest = l1 ? items.filter(function (x) { return x !== l1.it; }) : items, l2b = rest.length >= 3 && typeof cNewsLead === "function" ? cNewsLead(rest, R) : (rest[0] ? { it: rest[0], facts: [] } : null);
    if (l2b) { var it = l2b.it, tt = cNewsClean(it.title), desc = cNewsClean(it.desc || ""), facts = []; (l2b.facts || []).slice(0, tplN(4, 6)).forEach(function (f) { var m = String(f).match(/^(.*)\s(\S+)$/); facts.push(m ? [m[1], m[2]] : [String(f), ""]); }); if (!facts.length) R.indexRow.slice(0, 4).forEach(function (i) { facts.push([i.name, P(i.ret)]); });
      return { meta: { title: "\"" + tt + "\"", source: "네이버 뉴스 · " + (it.press || "") + " · " + date, source2: "숫자는 야후 파이낸스 종가", catName: "오늘의 기사 2" }, spec: { tag: "두 번째 기사", person: { name: it.press || "언론", role: "오늘 두 번째로 관심 가는 기사", facts: facts }, paras: desc ? desc.split(/(?<=다\.)\s+/).filter(Boolean).slice(0, tplN(3, 5)) : ["기사 요약이 없어요 — 제목과 숫자를 함께 보세요."] } }; }
  }
  /* ---------- calendar ---------- */
  if (cat === "calendar" && srcId === "next") {
    var nw = new Date(Date.now() + 9 * 3600e3), yy = nw.getUTCFullYear(), mm = nw.getUTCMonth() + 2; if (mm > 12) { mm = 1; yy++; }
    var evs = {}; (typeof PUB_CAL !== "undefined" ? PUB_CAL : []).forEach(function (e) { if (e.d.slice(0, 7) === yy + "-" + String(mm).padStart(2, "0")) { var d = +e.d.slice(8); (evs[d] = evs[d] || []).push({ t: String(e.t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim(), k: e.k }); } });
    return { meta: { title: "투자 달력 " + mm + "월호", sub: yy + "년 " + mm + "월 · 미리 보는 발표·실적·휴장", source: "각 기관 발표 일정 · StockMind 정리", catName: "달력" }, spec: { year: yy, month: mm, events: evs } };
  }
  return tplSpec0(cat, srcId, mkSel);
};
