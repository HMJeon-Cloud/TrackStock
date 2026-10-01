/* ============================================================
   카드 뉴스 (v6.9) — 인스타·스레드용 1080×1350(4:5) 이미지
   한 장에 메시지 하나: 맨 위 큰 제목이 "이 카드가 말하려는 것", 아래는 그 근거 숫자만.
   오늘의 브리핑 5장 / 채널 브리핑 자료 5장. 데이터는 화면과 같은 계산 결과를 그대로 쓴다.
   ============================================================ */
var CARD = { W: 1080, H: 1350, PAD: 84 };
var CARD_C = { bg: "#f2f4f6", card: "#ffffff", txt: "#191f28", txt2: "#4e5968", sub: "#8b95a1", line: "#e5e8eb", up: "#f04452", down: "#3182f6", accent: "#3182f6", soft: "#f2f4f6", warm: "#fff4e6", warmTxt: "#b45309" };
var CARD_FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function cPct(x, d) { if (x == null || !isFinite(x)) return "-"; d = d == null ? 1 : d; return (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%"; }
function cCol(x) { return x > 0 ? CARD_C.up : x < 0 ? CARD_C.down : CARD_C.sub; }
function cDate(ms) { var d = new Date(ms || Date.now()); return (d.getMonth() + 1) + "." + d.getDate() + "(" + "일월화수목금토"[d.getDay()] + ")"; }

/* 주가 표기: 국내 원, 미국·코인 $, 지수는 포인트, 환율은 원 */
function cPrice(sym, v) {
  if (v == null || !isFinite(v)) return "";
  function f(x, d) { return Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  if (/=X$/.test(sym)) return f(v, v >= 100 ? 1 : 2) + "원";
  if (/^\^/.test(sym)) return f(v, sym === "^VIX" ? 1 : 2);
  if (/\.K[SQ]$/.test(sym)) return f(Math.round(v), 0) + "원";
  return "$" + f(v, v >= 1000 ? 0 : v >= 1 ? 2 : 4);
}
function cLast(sym) {   // 최근 90일 데이터의 마지막 종가 (실제 가격, 수정주가 아님)
  var r = (typeof chState !== "undefined" && chState.recent) || (typeof briefState !== "undefined" && briefState.recent);
  var d = r && r.symbols && r.symbols[sym]; if (!d || !d.c) return null;
  for (var i = d.c.length - 1; i >= 0; i--) if (d.c[i] != null) return d.c[i];
  return null;
}

/* ---------- 그리기 도구 ---------- */
var CARD_SNS = "@uphill.lab";
function cNew() {
  var cv = document.createElement("canvas"); cv.width = CARD.W; cv.height = CARD.H;
  var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = CARD_C.bg; g.fillRect(0, 0, CARD.W, CARD.H);
  cRound(g, 40, 40, CARD.W - 80, CARD.H - 80, 48, CARD_C.card);
  return { cv: cv, g: g, y: 150 };
}
function cRound(g, x, y, w, h, r, fill) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fillStyle = fill; g.fill(); }
function cFont(g, size, weight) { g.font = (weight || 400) + " " + size + "px " + CARD_FONT; }
function cW(g, s, size, weight) { cFont(g, size, weight); return g.measureText(s).width; }
function cText(g, s, x, y, size, weight, color, align) { cFont(g, size, weight); g.fillStyle = color || CARD_C.txt; g.textAlign = align || "left"; g.fillText(s, x, y); }
function cFit(g, s, maxW, size, weight) { cFont(g, size, weight); var t = s; while (g.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1); return t === s ? s : t.slice(0, -1) + "…"; }
function cWrap(g, s, x, y, maxW, size, weight, color, lh, maxLines) {
  cFont(g, size, weight); g.fillStyle = color || CARD_C.txt; g.textAlign = "left";
  var words = String(s).split(""), line = "", lines = [];
  for (var i = 0; i < words.length; i++) { var t = line + words[i]; if (g.measureText(t).width > maxW && line) { lines.push(line); line = words[i]; } else line = t; }
  if (line) lines.push(line);
  if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…"; }
  lines.forEach(function (l, k) { g.fillText(l, x, y + k * (lh || size * 1.45)); });
  return y + lines.length * (lh || size * 1.45);
}
/* 제목: 한 줄에 들어가면 64→50px 안에서 맞춰 한 줄. 안 되면 구분점(· , 공백)에서 길이가 비슷하게 두 줄로 나누고 두 줄 모두 같은 크기 */
function cTitle(g, title, y) {
  var maxW = CARD.W - CARD.PAD * 2, lines;
  if (Array.isArray(title)) lines = title;
  else {
    for (var sz = 64; sz >= 50; sz -= 2) if (cW(g, title, sz, 800) <= maxW) { cText(g, title, CARD.PAD, y, sz, 800); return y + 24; }
    var best = null, seps = [" · ", ", ", " "];
    for (var k = 0; k < seps.length && !best; k++) {
      var parts = title.split(seps[k]); if (parts.length < 2) continue;
      for (var i = 1; i < parts.length; i++) {
        var a = parts.slice(0, i).join(seps[k]) + (seps[k] === ", " ? "," : ""), b = parts.slice(i).join(seps[k]);
        var d = Math.abs(cW(g, a, 60, 800) - cW(g, b, 60, 800));
        if (!best || d < best.d) best = { d: d, l: [a, b] };
      }
    }
    lines = best ? best.l : [title];
  }
  var size = 64; while (size > 44 && lines.some(function (l) { return cW(g, l, size, 800) > maxW; })) size -= 2;
  lines.forEach(function (l, i) { cText(g, cFit(g, l, maxW, size, 800), CARD.PAD, y + i * size * 1.3, size, 800); });
  return y + (lines.length - 1) * size * 1.3 + 24;
}
/* 머리: 작은 꼬리표 + 큰 제목(핵심 메시지) + 부제 */
function cHead(c, tag, title, sub, page, total) {
  var g = c.g, P = CARD.PAD;
  cFont(g, 30, 700); var tw = g.measureText(tag).width + 44;
  cRound(g, P, 96, tw, 56, 28, "#e8f3ff"); cText(g, tag, P + 22, 134, 30, 700, CARD_C.accent);
  if (page) cText(g, page + " / " + total, CARD.W - P, 134, 28, 600, CARD_C.sub, "right");
  var y = cTitle(g, title, 246);
  if (sub) y = cWrap(g, sub, P, y + 30, CARD.W - P * 2, 30, 400, CARD_C.txt2, 44, 2);
  c.y = y + 34;
}
/* 바닥: SNS 계정 표기 (모든 카드 공통) */
function cFoot(c, note) {
  var g = c.g, P = CARD.PAD, y = CARD.H - 92;
  g.fillStyle = CARD_C.line; g.fillRect(P, y - 46, CARD.W - P * 2, 2);
  cText(g, CARD_SNS, P, y, 34, 800, CARD_C.accent);
  cText(g, "우상향연구소", P + cW(g, CARD_SNS, 34, 800) + 16, y, 24, 600, CARD_C.sub);
  cText(g, note || "종가 기준 · 투자 조언 아님", CARD.W - P, y, 22, 400, CARD_C.sub, "right");
}
/* 한 줄: 이름 | (부가) | 주가 | 등락 — 열 위치를 고정해 줄마다 숫자가 같은 자리에 오게 */
function cRow(c, name, val, color, opt) {
  opt = opt || {}; var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, h = opt.h || 76;
  var fs = h >= 76 ? 38 : h >= 64 ? 34 : 30, by = c.y + (opt.bar != null ? h * 0.58 : h * 0.62);
  if (opt.rank != null) cText(g, String(opt.rank), P + 18, by - 2, fs - 8, 700, CARD_C.sub, "center");
  var nx = P + (opt.rank != null ? 56 : 0), right = P + W - Math.max(opt.valW || 160, cW(g, val, fs + 2, 800)) - 20;
  cText(g, val, P + W, by, fs + 2, 800, color || CARD_C.txt, "right");
  if (opt.price) { var pf = opt.priceSize || fs - 6; cText(g, opt.price, right, by - 1, pf, 600, CARD_C.txt2, "right"); right -= Math.max(cW(g, opt.price, pf, 600), opt.priceMin || 0) + 24; }
  if (opt.mid) { cText(g, opt.mid, right, by - 2, fs - 12, 500, CARD_C.sub, "right"); right -= cW(g, opt.mid, fs - 12, 500) + 20; }
  cText(g, cFit(g, name, Math.max(120, right - nx), fs, 600), nx, by, fs, 600, CARD_C.txt);
  if (opt.bar != null) {
    var bw = Math.max(6, Math.min(1, Math.abs(opt.bar)) * (W - (nx - P)));
    cRound(g, nx, by + 14, W - (nx - P), 10, 5, CARD_C.soft); cRound(g, nx, by + 14, bw, 10, 5, color || CARD_C.accent);
  }
  if (!opt.noLine) { g.fillStyle = CARD_C.line; g.fillRect(P, c.y + h, W, 1); }
  c.y += h + (opt.gap || 0);
}
function cColHead(c, cols) {   // 표 머리: [[글자, 오른쪽 x]]
  cols.forEach(function (x) { cText(c.g, x[0], x[1], c.y + 4, 24, 700, CARD_C.sub, "right"); }); c.y += 14;
}
function cTiles(c, tiles) {   // 2×N 숫자 타일
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, gap = 24, tw = (W - gap) / 2, th = 190;
  tiles.forEach(function (t, i) {
    var x = P + (i % 2) * (tw + gap), y = c.y + Math.floor(i / 2) * (th + gap);
    cRound(g, x, y, tw, th, 28, CARD_C.soft);
    cText(g, t.v, x + 32, y + 84, 56, 800, t.color || CARD_C.accent);
    cWrap(g, t.l, x + 32, y + 128, tw - 64, 26, 600, CARD_C.txt2, 34, 2);
  });
  c.y += Math.ceil(tiles.length / 2) * (th + gap);
}
/* 남은 공간에 n줄이 들어가도록 행 높이 계산 (note=true면 하단 안내 한 줄 자리 확보) */
function cH(c, n, max, note, extra) { return Math.max(48, Math.min(max, Math.floor((CARD.H - (note ? 215 : 165) - c.y - (extra || 0)) / Math.max(1, n)))); }
function cNote(c, s) { var g = c.g, P = CARD.PAD; cText(g, cFit(g, s, CARD.W - P * 2, 26, 600), P, CARD.H - 178, 26, 600, CARD_C.warmTxt); }
function cPara(c, s) { c.y = cWrap(c.g, s, CARD.PAD, c.y + 40, CARD.W - CARD.PAD * 2, 28, 500, CARD_C.warmTxt, 40, 3) + 10; }
function cLabel(c, s, color) { cText(c.g, s, CARD.PAD, c.y + 30, 30, 800, color || CARD_C.txt); c.y += 44; }

/* ---------- 오늘의 브리핑 카드 ---------- */
function cardsBrief() {
  var R = briefState.result; if (!R) return [];
  var M = R.market || "all", MN = M !== "all" ? R.mktName + " " : "";
  var out = [], T = 5, date = cDate(M === "kr" ? R.asOfKr : (R.asOfUs || R.asOf)), L = R.label, P = CARD.PAD;
  var TAG = (M === "kr" ? "🇰🇷 " : M === "us" ? "🇺🇸 " : M === "coin" ? "🪙 " : "") + MN;
  // 1. 표지 — 시장 온도
  var c = cNew(), t = R.temp;
  cHead(c, TAG + "오늘의 브리핑 · " + date, L + " " + MN + "시장은 " + t.word, "오른 종목 " + Math.round(t.upPct * 100) + "% (" + t.up + " / " + t.total + ")", 1, T);
  var g = c.g, W = CARD.W - P * 2;
  cRound(g, P, c.y, W, 28, 14, "#e8f3ff");
  var grd = g.createLinearGradient(P, 0, P + W, 0); grd.addColorStop(0, CARD_C.down); grd.addColorStop(1, CARD_C.up);
  cRound(g, P, c.y, Math.max(28, W * t.upPct), 28, 14, grd); c.y += 70;
  R.indexRow.slice(0, 6).forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { price: cPrice(x.sym, x.last) }); });
  cPara(c, t.desc);
  cFoot(c); out.push({ name: "1_시장온도", cv: c.cv });
  // 2. 테마 — 업종 평균 + 그 업종 1등 종목과 주가 (코인처럼 업종이 2개 미만이면 전체 시세표)
  c = cNew(); var th = R.themes, top = th[0], bot = th[th.length - 1];
  if (th.length < 2) {
    var all = R.movers.up.concat(R.movers.down.slice().reverse()).slice(0, 10);
    cHead(c, TAG + "시세 · " + date, MN + "전체 " + L + " 등락", "종목 · 지금 가격 · " + L + " 등락", 2, T);
    var ah = cH(c, all.length, 84);
    all.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ah, price: cPrice(s.sym, s.last) }); });
    cFoot(c); out.push({ name: "2_전체시세", cv: c.cv });
  } else {
  cHead(c, TAG + "자금 흐름 · " + date, top.name + " 강세, " + bot.name + " 약세", "업종 평균 등락 · 업종 안에서 가장 많이 오른 종목과 주가", 2, T);
  var mx = Math.max.apply(null, th.map(function (x) { return Math.abs(x.ret); })) || 0.01;
  var th10 = th.slice(0, 10), hh = cH(c, th10.length, 84);
  th10.forEach(function (x) { var b = x.best; cRow(c, x.name, cPct(x.ret), cCol(x.ret), { bar: x.ret / mx, h: hh, noLine: true, priceSize: 24, price: b ? briefName(b) + " " + cPrice(b.sym, b.last) + " " + cPct(b.ret) : "" }); });
  cFoot(c); out.push({ name: "2_테마흐름", cv: c.cv });
  }
  // 3. 급등·급락
  c = cNew(); var up = R.movers.up.slice(0, 5), dn = R.movers.down.slice(0, 5);
  var lead = up[0] || dn[0];
  if (!lead) return out;
  cHead(c, TAG + "가장 많이 움직인 종목 · " + date, up[0] ? "1위 " + briefName(up[0]) + " " + cPct(up[0].ret) : "오른 종목이 없어요",
    dn[0] ? "가장 많이 내린 종목은 " + briefName(dn[0]) + " " + cPct(dn[0].ret) : "내린 종목이 없어요", 3, T);
  var mh = cH(c, up.length + dn.length, 72, false, 100);
  if (up.length) cLabel(c, "▲ 급등", CARD_C.up);
  up.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.up, { rank: i + 1, h: mh, price: cPrice(s.sym, s.last) }); });
  if (dn.length) { c.y += 14; cLabel(c, "▼ 급락", CARD_C.down); }
  dn.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.down, { rank: i + 1, h: mh, price: cPrice(s.sym, s.last) }); });
  cFoot(c); out.push({ name: "3_급등급락", cv: c.cv });
  // 4. 인기 종목
  c = cNew(); var pop = R.popular.filter(function (s) { return !/^\^|=X$/.test(s.sym); }).slice(0, 8);
  var hot = pop.filter(function (s) { return s.amtX != null && s.amtX >= 1.5; }).sort(function (a, b) { return b.amtX - a.amtX; });
  cHead(c, TAG + "인기 종목 · " + date, hot.length ? briefName(hot[0]) + "에 돈이 몰렸어요" : "많이 찾는 종목의 " + L, "주가 · 등락 (작은 글씨: 거래대금이 평소의 몇 배인지)", 4, T);
  var ph = cH(c, pop.length, 84);
  pop.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ph, price: cPrice(s.sym, s.last), mid: s.amtX != null ? s.amtX.toFixed(1) + "배" : "" }); });
  cFoot(c, R.popSrc === "ranked" ? "앱 조회 순위 · 투자 조언 아님" : "거래대금 기준 · 투자 조언 아님"); out.push({ name: "4_인기종목", cv: c.cv });
  // 5. 숫자 + 세일 폭 큰 종목
  c = cNew(); var nums = R.numbers.slice(0, 4), sale = (nums[0].list || []).filter(function (s) { return !/^\^|=X$/.test(s.sym); }).slice(0, 3);
  cHead(c, TAG + "숫자로 보는 " + L, "세일 중인 종목 " + nums[0].v, "52주 최고가보다 20% 넘게 싼 종목 수 · 시장 전체를 네 숫자로", 5, T);
  cTiles(c, nums.map(function (n) { return { v: n.v, l: n.l }; }));
  if (sale.length) {
    c.y += 6; cLabel(c, "가장 많이 할인된 종목 (52주 최고 대비)");
    var sh = cH(c, sale.length, 70, true);
    sale.forEach(function (s) { cRow(c, briefName(s), cPct(s.vsHi, 0), CARD_C.down, { h: sh, price: cPrice(s.sym, s.last) }); });
  }
  cNote(c, "싸졌다는 건 사실이지만, 더 내리지 않는다는 뜻은 아니에요.");
  cFoot(c); out.push({ name: "5_오늘의숫자", cv: c.cv });
  return out;
}

/* ---------- 채널 브리핑 자료 카드 ---------- */
var CARD_PLAN_COL = ["#3182f6", "#14976a", "#eb6834", "#c98500", "#7c5cd6"];
function cMixName(sym) { return (typeof CH_SHORT !== "undefined" && CH_SHORT[sym]) || chName(sym); }
function cardsChannel() {
  var R = chState.brief, out = [], T = 5; if (!R) return [];
  var date = cDate(R.asOfUs), P = CARD.PAD, W = CARD.W - P * 2;
  function idx(name) { return R.indexRow.filter(function (x) { return x.name === name; })[0]; }
  // 1. 미국 증시 요약
  // 미국 증시 데일리는 미국 지표만 (국내·코인과 섞지 않음) + 한국 투자자용 달러/원
  var U = briefCompute(chState.recent, { market: "us" });
  var urow = U.indexRow.concat(R.indexRow.filter(function (x) { return x.sym === "KRW=X"; }));
  var c = cNew(), sp = urow.filter(function (x) { return x.sym === "^GSPC"; })[0], nq = urow.filter(function (x) { return x.sym === "^IXIC"; })[0];
  cHead(c, "🇺🇸 미국 증시 데일리 · " + date + " 마감", "S&P500 " + cPct(sp && sp.ret) + " · 나스닥 " + cPct(nq && nq.ret), "미국 지수·공포지수·채권·금 + 달러/원", 1, T);
  var ih = cH(c, urow.length, 76, true);
  urow.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: ih, price: cPrice(x.sym, x.last) }); });
  var th = U.themes;
  cNote(c, "강세 " + th.slice(0, 2).map(function (x) { return x.name; }).join("·") + " / 약세 " + th.slice(-2).map(function (x) { return x.name; }).join("·"));
  cFoot(c); out.push({ name: "1_미국증시", cv: c.cv });
  // 2. MDD
  c = cNew(); var rs = (chState.mdd || []).concat(chState.mddPick || []).filter(function (r) { return !r.err; }).slice(0, 9);
  var deep = rs.filter(function (r) { return r.cur <= -0.1; }).sort(function (a, b) { return a.cur - b.cur; })[0];
  cHead(c, "MDD 체크 · " + date, deep ? deep.name + " 고점 대비 " + cPct(deep.cur, 0) : "대표 자산 대부분 고점 근처", "지금 주가 · 고점 대비 위치 · 작은 글씨는 역대 하락 중 깊이 순위", 2, T);
  var rh = cH(c, rs.length, 84);
  rs.forEach(function (r) { cRow(c, r.name, cPct(r.cur, 0), r.cur <= -0.1 ? CARD_C.down : CARD_C.txt, { h: rh, price: cPrice(r.sym, cLast(r.sym)), mid: r.cur <= -0.1 ? (r.deeper + 1) + "위/" + r.eps + "회" : "", bar: r.cur }); });
  cFoot(c, "10년치 데이터 · 투자 조언 아님"); out.push({ name: "2_MDD", cv: c.cv });
  // 3. 지금 상황 맞춤 구성 — 4번 카드 맨 윗줄과 같은 구성
  var plan = chState.plan, pLabel = CH_PLAN_LABEL[plan.key]; c = cNew();
  cHead(c, "자산배분 · 지금 상황", "지금은 " + plan.title.split(" — ")[0] + " → " + pLabel, (chState.now && chState.now.why.length) ? "근거: " + chState.now.why.join(" / ") : "두드러진 신호가 없어 평소 균형형을 보여줘요", 3, T);
  var g = c.g, x = P;
  var prow = plan.items.map(function (it) { return { sym: it[0], name: cMixName(it[0]) + " (" + it[0] + ")", w: it[1], why: it[2] }; });
  prow.forEach(function (it, i) { var w = W * it.w / 100; cRound(g, x, c.y, Math.max(8, w - 6), 40, 10, CARD_PLAN_COL[i % 5]); x += w; });
  c.y += 70;
  var per = (CARD.H - 215 - c.y) / prow.length, two = per >= 124;
  prow.forEach(function (it, i) {
    cRound(g, P, c.y + 12, 24, 24, 6, CARD_PLAN_COL[i % 5]);
    cText(g, it.name, P + 40, c.y + 34, 32, 700, CARD_C.txt);
    cText(g, it.w + "%", CARD.W - P, c.y + 34, 34, 800, CARD_PLAN_COL[i % 5], "right");
    cText(g, cPrice(it.sym, cLast(it.sym)), CARD.W - P - 110, c.y + 33, 26, 600, CARD_C.txt2, "right");
    cWrap(g, it.why, P + 40, c.y + 72, W - 40, 25, 400, CARD_C.txt2, 33, two ? 2 : 1);
    c.y += per;
  });
  cNote(c, "규칙 기반 예시이며 추천이 아니에요. 다음 카드에서 다른 구성과 비교해요.");
  cFoot(c); out.push({ name: "3_자산배분", cv: c.cv });
  // 4. 6가지 구성 비교 (1년·3년) — 구성별 종목·비중 함께, 지금 구성을 맨 위에
  c = cNew(); var cmp = (chState.cmp || []).slice().sort(function (a, b) { return (b.key === plan.key) - (a.key === plan.key); });
  function best(i) { var ok = cmp.filter(function (x) { return x.res[i]; }); return ok.slice().sort(function (a, b) { return b.res[i].ret - a.res[i].ret; })[0]; }
  var b1 = best(2), b3 = best(3);
  var ttl = b1 && b3 && b1.key === b3.key ? "1년·3년 모두 1위는 " + b1.label : [b1 ? "1년 1위 " + b1.label : "", b3 ? "3년 1위 " + b3.label : ""].filter(Boolean).join(" · ");
  cHead(c, "구성 비교 · 처음 비중 그대로 뒀다면", ttl || "구성별 성과", "수익률 (괄호: 그 사이 최대 낙폭) · 이름 아래가 실제 담은 종목", 4, T);
  var c1 = CARD.W - P - 190, c2 = CARD.W - P;
  cColHead(c, [["1년", c1], ["3년", c2]]);
  var ch = cH(c, cmp.length, 112, true);
  cmp.forEach(function (x) {
    var a = x.res[2], b = x.res[3], gg = c.g, now = x.key === plan.key, y0 = c.y;
    if (now) cRound(gg, P - 16, y0 + 4, W + 32, ch - 8, 18, CARD_C.warm);
    cText(gg, x.label, P, y0 + 44, 34, 800, now ? CARD_C.warmTxt : CARD_C.txt);
    if (now) { var lw = cW(gg, x.label, 34, 800); cRound(gg, P + lw + 12, y0 + 16, 64, 36, 18, CARD_C.warmTxt); cText(gg, "지금", P + lw + 44, y0 + 42, 22, 800, "#fff", "center"); }
    var mix = CH_PLANS[x.key].items.map(function (it) { return cMixName(it[0]) + " " + it[1]; }).join(" · "), mw = c1 - P - 90, ms = 24;
    while (ms > 18 && cW(gg, mix, ms, 500) > mw) ms--;
    cText(gg, cFit(gg, mix, mw, ms, 500), P, y0 + 80, ms, 500, CARD_C.txt2);
    [[a, c1], [b, c2]].forEach(function (z) {
      cText(gg, z[0] ? cPct(z[0].ret, 0) : "-", z[1], y0 + 46, 34, 800, z[0] ? cCol(z[0].ret) : CARD_C.sub, "right");
      if (z[0]) cText(gg, "(" + cPct(z[0].mdd, 0) + ")", z[1], y0 + 78, 22, 400, CARD_C.sub, "right");
    });
    if (!now) { gg.fillStyle = CARD_C.line; gg.fillRect(P, y0 + ch - 2, W, 1); }
    c.y += ch;
  });
  cNote(c, "기간마다 1위가 바뀌어요 — 한 가지에 몰지 않고 나눠 담는 이유예요.");
  cFoot(c, "숫자는 비중(%) · 과거 데이터 · 투자 조언 아님"); out.push({ name: "4_구성비교", cv: c.cv });
  // 5. 과거 사례 (지금과 비슷한 것, 없으면 첫 사례)
  var sc = (chState.scen || [])[0]; c = cNew();
  if (sc) {
    var ep = sc.eps[0];
    cHead(c, "과거 사례 · " + sc.tag + (sc.now ? " (지금과 비슷)" : ""), ep.name, ep.s.replace(/-/g, ".") + " ~ " + ep.e.slice(5).replace(/-/g, ".") + " 등락 · 작은 숫자는 지금 주가", 5, T);
    var rows = ep.st.filter(function (x) { return x.sym !== "KRW=X"; }).sort(function (a, b) { return b.ret - a.ret; }).slice(0, 6);
    var pops = (ep.pop || []).slice(0, 3), sh2 = cH(c, rows.length + pops.length, 72, false, pops.length ? 60 : 0);
    rows.forEach(function (x) { cRow(c, x.name, cPct(x.ret, 0), cCol(x.ret), { h: sh2, price: cPrice(x.sym, cLast(x.sym)), priceSize: 24 }); });
    if (pops.length) {
      c.y += 12; cLabel(c, "🧠 그때 인기 종목은 (최대 낙폭 → 회복)");
      pops.forEach(function (x) { cRow(c, x.name, chFmtRec(x), CARD_C.txt2, { h: sh2, valW: 220, price: cPct(x.dd, 0) }); });
    }
  }
  cFoot(c, "과거 데이터 · 투자 조언 아님"); out.push({ name: "5_과거사례", cv: c.cv });
  return out;
}

/* ---------- 미리보기·저장 ---------- */
function cardsOpen(kind) {
  var make = kind === "brief" ? cardsBrief : cardsChannel;
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    var list;
    try { list = make(); } catch (e) { console.warn(e); list = []; }
    if (!list.length) { alert("아직 데이터가 다 준비되지 않았어요. 잠시 뒤 다시 눌러 주세요."); return; }
    var day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    var box = document.createElement("div");
    var mk = kind === "brief" && typeof briefState !== "undefined" ? (briefState.market || "all") : null;
    var mkHtml = mk ? '<div class="pills" style="margin-bottom:10px">' + Object.keys(BRIEF_MKT).map(function (k) {
      return '<button data-cm="' + k + '"' + (k === mk ? ' class="active"' : '') + '>' + BRIEF_MKT[k] + '</button>'; }).join("") + '</div>' : "";
    box.innerHTML = mkHtml + '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button>' +
      (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유 (인스타·카톡)</button>' : '') +
      '<span class="briefDim">1080×1350 · 인스타 4:5 · 저장이 안 되면 이미지를 길게 눌러 저장</span></div><div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    Array.prototype.forEach.call(box.querySelectorAll("[data-cm]"), function (b) {
      b.onclick = function () { switchBriefMarket(b.getAttribute("data-cm")); cardsOpen("brief"); };
    });
    list.forEach(function (it, i) {
      it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_" + (kind === "brief" ? "오늘" + (mk && mk !== "all" ? "_" + BRIEF_MKT[mk] : "") : "채널") + "_" + day + "_" + it.name + ".png";
      var f = document.createElement("figure");
      f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + '. ' + it.name.replace(/^\d_/, "") + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>';
      f.querySelector("img").src = it.url;
      f.querySelector("button").onclick = function () { cardsDownload(it); };
      wrap.appendChild(f);
    });
    box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
    var sh = box.querySelector('[data-act="share"]');
    if (sh) sh.onclick = function () {
      Promise.all(list.map(function (it) { return new Promise(function (ok) { it.cv.toBlob(function (b) { ok(new File([b], it.file, { type: "image/png" })); }, "image/png"); }); }))
        .then(function (files) { if (navigator.canShare({ files: files })) return navigator.share({ files: files }); alert("이 기기는 여러 장 공유를 지원하지 않아요. 한 장씩 저장해 주세요."); })
        .catch(function () {});
    };
    infoModal.open("🃏 " + (kind === "brief" ? (mk && mk !== "all" ? BRIEF_MKT[mk] + " " : "") + "오늘의 브리핑" : "채널 브리핑") + " 카드 " + list.length + "장", box);
  });
}
function cardsDownload(it) { var a = document.createElement("a"); a.href = it.url; a.download = it.file; document.body.appendChild(a); a.click(); a.remove(); }

(function () {
  var b = document.getElementById("briefCards"); if (b) b.onclick = function () { cardsOpen("brief"); };
  var c = document.getElementById("chCards"); if (c) c.onclick = function () { cardsOpen("channel"); };
})();
