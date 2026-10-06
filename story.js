/* ============================================================
   스토리 덱 (v8.6) — "지금 신호 → 닮은 과거 → 그 뒤 무엇이 강했나 → 체크리스트 → 조건별 구성"
   채널 페이지의 자산배분·상황별 과거 사례 데이터를 하나의 이야기로 묶은 10장 안팎의 캐러셀.
   틀: 위 밝은 패널(Exhibit 제목 + 시각 자료) / 아래 검정 패널(큰 메시지, 금색 강조) — 사이에 금색 줄, 바닥에 uphill.lab.
   원칙: 추천·예측 없음. "과거엔 이랬다"와 "무엇을 보면 되는지"까지만. 숫자는 전부 야후 파이낸스 종가에서 계산.
   ============================================================ */
var ST = { W: 1080, H: 1350, PAD: 60, SPLIT: 760 };   // 위 패널 0~760, 아래 검정 760~1350
var ST_C = { top: "#f7f5f0", black: "#111111", navy: "#1f2a44", txt: "#1c2333", sub: "#6b7280", line: "#e4dfd3", gold: "#e6c57a", gold2: "#c9a24f", up: "#d9342b", down: "#2f6fd6", teal: "#5b9bb5", white: "#ffffff", grey: "#9aa3b2" };
var ST_ASSETS = { "SPY": "S&P500", "QQQ": "나스닥100", "^KS11": "코스피", "SCHD": "미국 배당주", "TLT": "장기채", "IEF": "중기채", "SHY": "단기채", "GLD": "금", "DBC": "원자재", "BTC-USD": "비트코인", "KRW=X": "달러/원", "USO": "원유" };

function stNew() {
  var cv = document.createElement("canvas"); cv.width = ST.W; cv.height = ST.H;
  var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = ST_C.top; g.fillRect(0, 0, ST.W, ST.SPLIT);
  g.fillStyle = ST_C.black; g.fillRect(0, ST.SPLIT, ST.W, ST.H - ST.SPLIT);
  var gl = g.createLinearGradient(0, 0, ST.W, 0); gl.addColorStop(0, "rgba(201,162,79,0.2)"); gl.addColorStop(0.6, ST_C.gold2); gl.addColorStop(1, ST_C.gold);
  g.fillStyle = gl; g.fillRect(0, ST.SPLIT - 3, ST.W, 3);
  return { cv: cv, g: g, y: 0 };
}
/* 위 패널 머리: "Exhibit 01. 제목" + 회색 부제 + 오른쪽 쪽번호 */
function stTop(c, n, title, sub, page, total) {
  var g = c.g, P = ST.PAD;
  cText(g, (n ? "Exhibit " + (n < 10 ? "0" + n : n) + ". " : "") + title, P, 104, 34, 800, ST_C.navy);
  if (sub) cText(g, sub, P, 146, 22, 500, ST_C.sub);
  if (page) { cRound(g, ST.W - P - 112, 62, 112, 48, 24, ST_C.navy); cText(g, page + "/" + total, ST.W - P - 56, 95, 24, 700, ST_C.white, "center"); }
  c.y = 190;
}
/* 아래 검정 패널: 큰 문장들(흰색, [[금색]]) + 작은 출처 + 워드마크 */
function stBottom(c, lines, src, cta) {
  var g = c.g, P = ST.PAD, size = 52, lh = 68;
  var flat = []; lines.forEach(function (l) { flat = flat.concat(stSplit(g, l, ST.W - P * 2, size)); });
  while (flat.length * lh > 440 && size > 38) { size -= 2; lh = size * 1.3; flat = []; lines.forEach(function (l) { flat = flat.concat(stSplit(g, l, ST.W - P * 2, size)); }); }
  var y0 = ST.SPLIT + 100;
  flat.forEach(function (l, i) { cRich(g, l, P, y0 + i * lh, size, 800, ST_C.white, ST_C.gold); if (l === "") y0 += lh * 0.35; });
  cText(g, src || "StockMind 집계 · 야후 파이낸스 종가 · 과거 자료이며 투자 권유 아님", P, ST.H - 86, 19, 500, ST_C.grey);
  cText(g, cta || "SWIPE ›", P, ST.H - 40, 20, 700, ST_C.gold);
  // 워드마크
  var w = cW(g, "uphill.lab", 26, 800), x = ST.W - P - w;
  cText(g, "uphill.lab", ST.W - P, ST.H - 40, 26, 800, ST_C.white, "right");
  g.strokeStyle = ST_C.gold; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(x - 38, ST.H - 42); g.lineTo(x - 18, ST.H - 62); g.moveTo(x - 28, ST.H - 62); g.lineTo(x - 18, ST.H - 62); g.lineTo(x - 18, ST.H - 52); g.stroke();
}
/* [[..]]를 유지하며 줄바꿈 (공백 단위, 금색 토큰은 쪼개지 않음) */
function stSplit(g, s, maxW, size) {
  if (s === "") return [""];
  var words = String(s).split(" "), lines = [], line = "";
  cFont(g, size, 800);
  words.forEach(function (w) { var t = line ? line + " " + w : w; if (g.measureText(cPlain(t)).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line);
  // 줄이 금색 토큰 중간에서 끊겼으면 닫고 다시 연다
  var open = false; return lines.map(function (l) { var o = open; var n = (l.match(/\[\[/g) || []).length - (l.match(/\]\]/g) || []).length; if (o) l = "[[" + l; if (n > 0) { l += "]]"; open = true; } else if (n < 0) open = false; return l; });
}
/* 시각 자료들 */
function stTiles(c, tiles) {   // 가로 3개 큰 숫자
  var g = c.g, P = ST.PAD, W = ST.W - P * 2, n = tiles.length, tw = W / n, y = c.y + 60;
  tiles.forEach(function (t, i) { var x = P + tw * i + tw / 2; cText(g, t.v, x, y + 70, 64, 800, t.color || ST_C.navy, "center"); cWrap(g, t.l, x, y + 118, tw - 20, 22, 500, ST_C.sub, 30, 2, "center"); });
  g.strokeStyle = ST_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + 200); g.lineTo(P + W, y + 200); g.stroke();
  c.y = y + 230;
}
function stGoldLine(c, s, sub) { var g = c.g; cText(g, s, ST.W / 2, c.y + 50, 34, 800, ST_C.gold2, "center"); if (sub) cText(g, sub, ST.W / 2, c.y + 94, 22, 500, ST_C.sub, "center"); c.y += 110; }
function stCards3(c, cards) {   // 연도 카드 3개 (연도, 이름, 부제, 수치)
  var g = c.g, P = ST.PAD, W = ST.W - P * 2, gap = 24, n = cards.length, cw = (W - gap * (n - 1)) / n, h = 400, y = c.y + 10;
  cards.forEach(function (k, i) {
    var x = P + i * (cw + gap); cRound(g, x, y, cw, h, 18, "#eeeae1");
    cText(g, k.year, x + cw / 2, y + 90, 48, 800, k.color || ST_C.navy, "center");
    cWrap(g, k.name, x + cw / 2, y + 150, cw - 28, 27, 800, ST_C.txt, 34, 2, "center");
    cWrap(g, k.sub || "", x + cw / 2, y + 236, cw - 28, 21, 500, ST_C.sub, 28, 2, "center");
    if (k.v) { cText(g, k.v, x + cw / 2, y + 340, 36, 800, k.vc || ST_C.navy, "center"); cText(g, k.vl || "", x + cw / 2, y + 372, 18, 500, ST_C.sub, "center"); }
  });
  c.y = y + h + 20;
}
function stBars(c, items) {   // 세로 막대 (라벨 아래, 값 위)
  var g = c.g, P = ST.PAD, W = ST.W - P * 2, n = items.length, bw = Math.min(150, (W - 30 * (n - 1)) / n), gap = (W - bw * n) / Math.max(1, n - 1);
  var neg = items.some(function (x) { return x.v < 0; }), mn = Math.min.apply(null, items.map(function (x) { return x.v; }));
  var top = c.y + 60, H = neg ? 230 : 300, mxAbs = Math.max.apply(null, items.map(function (x) { return Math.abs(x.v); })) || 0.01;
  var base = neg ? top + H + 20 : top + H + 40, negH = neg ? Math.abs(mn) / mxAbs * H : 0;
  items.forEach(function (it, i) {
    var x = P + i * (bw + gap), h = Math.max(6, Math.abs(it.v) / mxAbs * H), col = it.color || (it.v >= 0 ? ST_C.navy : ST_C.grey);
    var y = it.v >= 0 ? base - h : base;
    g.fillStyle = col; g.fillRect(x, y, bw, h);
    cText(g, cPct(it.v), x + bw / 2, it.v >= 0 ? y - 16 : y + h + 34, 28, 800, col, "center");
    cText(g, it.l, x + bw / 2, it.v >= 0 ? base + 40 : y - 14, 21, 600, ST_C.txt, "center");
  });
  g.strokeStyle = ST_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, base); g.lineTo(P + W, base); g.stroke();
  c.y = base + negH + 70;
}
function stRows(c, rows, leftW) {   // 줄 목록: [왼쪽 회색, 가운데 굵게, 오른쪽 값(색)]
  var g = c.g, P = ST.PAD, W = ST.W - P * 2, h = Math.min(96, Math.floor((ST.SPLIT - 30 - c.y) / rows.length)), y = c.y, lw = leftW || 300;
  rows.forEach(function (r) {
    cText(g, cFit(g, r[0], lw - 20, 24, 500), P, y + h / 2 + 10, 24, 500, ST_C.sub); cText(g, r[1], P + lw, y + h / 2 + 10, 30, 800, ST_C.txt);
    cText(g, r[2], P + W, y + h / 2 + 10, 34, 800, r[3] || ST_C.navy, "right");
    g.strokeStyle = ST_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + h); g.lineTo(P + W, y + h); g.stroke(); y += h;
  });
  c.y = y;
}
function stChecks(c, items) {   // 2×2 체크 박스: {t, s, ok}
  var g = c.g, P = ST.PAD, W = ST.W - P * 2, gap = 28, cw = (W - gap) / 2, h = 190, y = c.y;
  items.forEach(function (it, i) {
    var x = P + (i % 2) * (cw + gap), yy = y + Math.floor(i / 2) * (h + gap);
    cRound(g, x, yy, cw, h, 18, it.ok ? "#e9f1ea" : "#eeeae1");
    cText(g, it.t, x + 28, yy + 62, 28, 700, ST_C.teal); cText(g, it.s, x + 28, yy + 122, 26, 600, ST_C.txt);
    cText(g, it.ok ? "✓" : "–", x + cw - 36, yy + 110, 44, 800, it.ok ? "#2e7d4f" : ST_C.grey, "right");
  });
  c.y = y + 2 * h + gap + 10;
}
function stTable(c, rows) {   // 조건 | 구성 | 성격 — 3열 표(가로줄만)
  var g = c.g, P = ST.PAD, W = ST.W - P * 2, h = Math.min(120, Math.floor((ST.SPLIT - 30 - c.y) / rows.length)), y = c.y;
  rows.forEach(function (r) {
    cWrap(g, r[0], P, y + h / 2 - 2, 300, 22, 500, ST_C.sub, 28, 2);
    cWrap(g, r[1], P + 330, y + h / 2 + 4, W - 330 - 120, 28, 800, ST_C.txt, 34, 2);
    cText(g, r[2], P + W, y + h / 2 + 10, 28, 800, r[3] || ST_C.gold2, "right");
    g.strokeStyle = ST_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + h); g.lineTo(P + W, y + h); g.stroke(); y += h;
  });
  c.y = y;
}
function stCover(title, sub, small) {   // 표지: 전체 검정
  var c = stNew(), g = c.g, P = ST.PAD; g.fillStyle = ST_C.black; g.fillRect(0, 0, ST.W, ST.H);
  g.fillStyle = ST_C.gold; g.fillRect(0, 0, ST.W, 8);
  cText(g, "↗ 우상향연구소 · 스토리", P, 110, 26, 700, ST_C.gold);
  cText(g, small, P, 520, 34, 600, "#cfd3dc");
  var lines = []; title.forEach(function (l) { lines = lines.concat(stSplit(g, l, ST.W - P * 2, 76)); });
  lines.forEach(function (l, i) { cRich(g, l, P, 640 + i * 96, 76, 800, ST_C.white, ST_C.gold); });
  cWrap(g, sub, P, 640 + lines.length * 96 + 40, ST.W - P * 2, 28, 500, "#cfd3dc", 40, 3);
  cText(g, cDate(Date.now()) + " 기준 · 과거 데이터로 본 비교 자료 · 투자 권유 아님", P, ST.H - 86, 19, 500, ST_C.grey);
  cText(g, "SWIPE ›", P, ST.H - 40, 20, 700, ST_C.gold);
  cText(g, "uphill.lab", ST.W - P, ST.H - 40, 26, 800, ST_C.white, "right");
  return c.cv;
}
function stName(sym) { return ST_ASSETS[sym] || (typeof chName === "function" ? chName(sym) : sym); }

/* ---------- 덱 구성 ---------- */
function storyReady() { return !!(typeof chState !== "undefined" && chState.recent && chState.scen && chState.scen.length && chState.cmp); }
function storyCards() {
  if (!storyReady()) return [];
  var out = [], now = chState.now || chDetectNow(chState.recent), recent = chState.recent;
  var scen = chState.scen.slice(), main = scen.filter(function (s) { return s.now; })[0] || scen[0];
  var st = function (sym) { var d = recent.symbols[sym]; return d ? briefStats(sym, d, "day") : null; };
  var tlt = st("TLT"), vix = st("^VIX"), spy = st("SPY"), uso = st("USO"), krw = st("KRW=X"), ks = st("^KS11");
  var total = 0, c;
  // 카드 수 미리 계산: 표지 + 세 숫자 + 닮은 과거 + 사례별(최대 3) + 승자표 + 체크 + 조건표 + 구성 성과 + 마무리
  var epsFwd = main.eps.filter(function (e) { return e.st.some(function (x) { return x.fwd != null; }); }).slice(0, 3);
  total = 1 + 1 + 1 + epsFwd.length + 1 + 1 + 1 + 1 + 1;
  var pg = 0;
  // 0. 표지
  var hookWord = now.why.length ? now.why[0].split("→").pop().trim() : "평소 구간";
  out.push({ name: "0_표지", cv: stCover(["지금은 [[" + hookWord + "]]", "과거엔 무엇이 강했을까?"], main.tag + " 국면 " + main.eps.length + "번의 과거 사례를 자산별로 뜯어봤어요. 결론은 '정해진 승자는 없었다'.", "유가·금리·공포지수가 움직일 때") }); pg++;
  // 1. 지금 시장 세 숫자
  c = stNew(); pg++;
  stTop(c, 1, "지금 시장을 움직이는 숫자", cDate(recent.generated ? Date.parse(recent.generated) : Date.now()) + " 종가 기준 · 한 달 변화", pg, total);
  stTiles(c, [{ v: cPct(tlt && tlt.m1), l: "미국 장기채(TLT) 1개월", color: tlt && tlt.m1 < 0 ? ST_C.up : ST_C.teal }, { v: vix ? vix.last.toFixed(1) : "-", l: "공포지수 VIX", color: vix && vix.last >= 25 ? ST_C.up : ST_C.navy }, { v: spy && spy.vsHi != null ? cPct(spy.vsHi, 0) : "-", l: "S&P500 52주 고점 대비", color: spy && spy.vsHi <= -0.1 ? ST_C.up : ST_C.navy }]);
  stGoldLine(c, now.why.length ? now.why[0].split("→").pop().trim() : "두드러진 신호 없음", now.why.length > 1 ? now.why[1] : "원유 1개월 " + cPct(uso && uso.m1) + " · 달러/원 1개월 " + cPct(krw && krw.m1));
  stBottom(c, ["지금 시장의 숫자는", "[[" + hookWord + "]]을 가리킨다.", "", "그래서 비교할 과거는", "[[" + main.tag + "]] 국면이다."]);
  out.push({ name: "1_지금숫자", cv: c.cv });
  // 2. 닮은 과거
  c = stNew(); pg++;
  stTop(c, 2, "지금과 닮은 과거 " + main.eps.length + "번", main.tag + " 국면 — 구간 중 S&P500 등락", pg, total);
  stCards3(c, main.eps.slice(0, 3).map(function (e) { var s = e.st.filter(function (x) { return x.sym === "SPY"; })[0]; return { year: e.s.slice(0, 4), name: e.name.replace(/^\d{4}\s*/, ""), sub: e.s.slice(5).replace("-", ".") + " ~ " + e.e.slice(5).replace("-", "."), v: s ? cPct(s.ret, 1) : "", vl: "S&P500 구간 등락", vc: s ? cCol(s.ret) : null, color: ST_C.up }; }));
  var les = (main.lesson.match(/[^.。]+[.。]/) || [main.lesson])[0].trim();
  stBottom(c, ["같은 [[" + main.tag + "]]이어도", "원인과 깊이는 매번 달랐다.", "", les.length > 60 ? les.slice(0, 58) + "…" : les]);
  out.push({ name: "2_닮은과거", cv: c.cv });
  // 3~. 사례별: 구간 끝 1년 뒤 자산별 수익률
  epsFwd.forEach(function (e, i) {
    c = stNew(); pg++;
    var rows = e.st.filter(function (x) { return x.fwd != null && x.sym !== "KRW=X"; }).sort(function (a, b) { return b.fwd - a.fwd; });
    var top = rows.slice(0, 4).concat(rows.length > 4 ? [rows[rows.length - 1]] : []);
    stTop(c, 3 + i, e.name + " 뒤 1년", "구간이 끝난 날(" + e.e.replace(/-/g, ".") + ")부터 1년 뒤 자산별 등락", pg, total);
    stBars(c, top.map(function (x, k) { return { l: stName(x.sym), v: x.fwd, color: k === 0 ? ST_C.up : x.fwd < 0 ? ST_C.grey : [ST_C.navy, ST_C.teal, ST_C.gold2, ST_C.navy][k % 4] }; }));
    var best = rows[0], worst = rows[rows.length - 1];
    stBottom(c, ["[[" + e.name.replace(/^\d{4}\s*/, "") + "]] 뒤 1년,", "가장 강했던 건 [[" + stName(best.sym) + " " + cPct(best.fwd, 0) + "]]", "", worst.fwd < 0 ? stName(worst.sym) + "은(는) " + cPct(worst.fwd, 0) + " — 같은 사건 뒤에도 자산마다 달랐다." : "가장 약한 " + stName(worst.sym) + "도 " + cPct(worst.fwd, 0) + " — 다 올랐지만 폭이 달랐다."]);
    out.push({ name: (3 + i) + "_" + e.s.slice(0, 4), cv: c.cv });
  });
  // 승자 표 (모든 국면)
  c = stNew(); pg++;
  var allEps = []; scen.forEach(function (s) { s.eps.forEach(function (e) { var r = e.st.filter(function (x) { return x.fwd != null && x.sym !== "KRW=X"; }).sort(function (a, b) { return b.fwd - a.fwd; })[0]; if (r) allEps.push({ y: e.s.slice(0, 4), tag: s.tag, best: r }); }); });
  allEps = allEps.slice(0, 7);
  stTop(c, 3 + epsFwd.length, "역사에는 정해진 순서가 없었다", "국면이 끝난 뒤 1년, 가장 강했던 자산", pg, total);
  stRows(c, allEps.map(function (a) { return [a.y + " · " + a.tag, stName(a.best.sym), cPct(a.best.fwd, 0), cCol(a.best.fwd)]; }));
  var uniq = {}; allEps.forEach(function (a) { uniq[stName(a.best.sym)] = 1; });
  stBottom(c, ["금리·유가가 꺾이면", "먼저 오르는 자산은 뭘까?", "", allEps.length + "번의 사례에서 1등은 [[" + Object.keys(uniq).length + "가지]]였다.", "사건의 원인에 따라 승자가 달랐다."]);
  out.push({ name: "W_승자표", cv: c.cv });
  // 체크리스트
  c = stNew(); pg++;
  var chk = [{ t: "장기금리", s: tlt && tlt.m1 >= 0.03 ? "하락 전환 (TLT 1개월 " + cPct(tlt.m1) + ")" : tlt && tlt.m1 <= -0.03 ? "상승 중 (TLT " + cPct(tlt.m1) + ")" : "횡보 (TLT " + cPct(tlt && tlt.m1) + ")", ok: !!(tlt && tlt.m1 >= 0.03) },
    { t: "공포지수", s: vix ? (vix.last < 20 ? "평온 (" + vix.last.toFixed(0) + ")" : vix.last < 25 ? "불안 (" + vix.last.toFixed(0) + ")" : "공포 (" + vix.last.toFixed(0) + ")") : "-", ok: !!(vix && vix.last < 20) },
    { t: "S&P500 추세", s: spy ? (spy.above20 ? "20일선 위" : "20일선 아래") + " · 고점比 " + cPct(spy.vsHi, 0) : "-", ok: !!(spy && spy.above20) },
    { t: "달러", s: krw ? (Math.abs(krw.m1) < 0.02 ? "안정 (1개월 " + cPct(krw.m1) + ")" : krw.m1 > 0 ? "강세 (1개월 " + cPct(krw.m1) + ")" : "약세 (1개월 " + cPct(krw.m1) + ")") : "-", ok: !!(krw && Math.abs(krw.m1) < 0.02) }];
  var okN = chk.filter(function (x) { return x.ok; }).length;
  stTop(c, 4 + epsFwd.length, "네 가지가 함께 나오면 확률이 높아진다", "'좋은 금리 하락'을 확인하는 체크리스트 — 지금 " + okN + "/4", pg, total);
  stChecks(c, chk);
  stBottom(c, ["하나가 아니라,", "네 개를 같이 봐야 한다.", "", "장기금리, 공포지수, 추세,", "[[그리고 달러]] — 지금은 " + okN + "/4"]);
  out.push({ name: "C_체크리스트", cv: c.cv });
  // 조건별 구성 표
  c = stNew(); pg++;
  var cond = [["rateDown", "장기채 ↑ · VIX 안정", "공격"], ["none", "뚜렷한 신호 없음", "균형"], ["panic", "VIX 25↑ · 고점 -10%", "방어"], ["rateUp", "장기채 ↓ (금리 상승)", "수비"], ["oilUp", "원유 1개월 +10%", "물가 대응"]];
  stTop(c, 5 + epsFwd.length, "순서 매매 대신 조건 매매", "코어는 유지하고 신규 자금의 방향만 바꾼다 · 지금 = " + CH_PLAN_LABEL[(chState.plan || {}).key || "none"], pg, total);
  stTable(c, cond.map(function (k) { var p = CH_PLANS[k[0]], top3 = p.items.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3).map(function (it) { return stName(it[0]) + " " + it[1]; }).join(" · "); var isNow = (chState.plan || {}).key === k[0]; return [k[1] + (isNow ? "  ← 지금" : ""), top3, k[2], isNow ? ST_C.up : ST_C.gold2]; }));
  stBottom(c, ["[[" + cond.length + "가지 상황]]을 그려 두고", "그 상황에 맞게 조정하면 된다.", "", "누구나 쉽게, 상황을 판단하고", "나눠 담을 수 있게 정리했다."], "예시 구성이며 손실을 막아주지 않는다 · 숫자는 비중(%) · 투자 권유 아님");
  out.push({ name: "P_조건표", cv: c.cv });
  // 구성별 과거 성과
  c = stNew(); pg++;
  var cmp = chState.cmp.filter(function (x) { return x.res[2] && x.res[3]; }).sort(function (a, b) { return b.res[3].ret - a.res[3].ret; });
  stTop(c, 6 + epsFwd.length, "그 구성들, 과거엔 어땠나", "처음 비중 그대로 뒀을 때 — 왼쪽 1년(괄호: 최대 낙폭) · 오른쪽 3년 수익률", pg, total);
  stRows(c, cmp.map(function (x) { return ["1년 " + cPct(x.res[2].ret, 0) + " (" + cPct(x.res[2].mdd, 0) + ")", x.label, cPct(x.res[3].ret, 0), cCol(x.res[3].ret)]; }), 330);
  var top1 = cmp[0], low1 = cmp[cmp.length - 1];
  stBottom(c, ["3년 기준 1위는 [[" + top1.label + " " + cPct(top1.res[3].ret, 0) + "]]", "꼴찌는 " + low1.label + " " + cPct(low1.res[3].ret, 0) + ".", "", "기간마다 1위가 바뀐다.", "그래서 한 가지에 몰지 않는다."]);
  out.push({ name: "R_구성성과", cv: c.cv });
  // 마무리
  c = stNew(); pg++; var g = c.g; g.fillStyle = ST_C.black; g.fillRect(0, 0, ST.W, ST.H); g.fillStyle = ST_C.gold; g.fillRect(0, 0, ST.W, 8);
  cText(g, "↗ 우상향연구소 · 스토리", ST.PAD, 110, 26, 700, ST_C.gold);
  [["지금은 어떤 구간이라고 보시나요?", ST_C.white, 54], ["", null, 0], ["댓글에 남겨 주세요.", ST_C.gold, 54], ["", null, 0], ["저장해 두고, 신호가 바뀔 때", "#cfd3dc", 40], ["다시 꺼내 보면 돼요.", "#cfd3dc", 40]].forEach(function (l, i) { if (l[0]) cText(g, l[0], ST.PAD, 520 + i * 74, l[2], 800, l[1]); });
  cText(g, "매주 일요일 한 주 정리 · 월요일 한 주 예상 · 매일 아침 전일 정리", ST.PAD, 1040, 24, 600, "#cfd3dc");
  cText(g, "StockMind 자동 집계 · 야후 파이낸스 종가 · 과거 자료이며 투자 권유 아님", ST.PAD, ST.H - 86, 19, 500, ST_C.grey);
  cText(g, "저장 · 좋아요", ST.PAD, ST.H - 40, 20, 700, ST_C.gold); cText(g, "uphill.lab", ST.W - ST.PAD, ST.H - 40, 26, 800, ST_C.white, "right");
  out.push({ name: "Z_마무리", cv: c.cv });
  return out;
}
function storyCaption() {
  if (!storyReady()) return { ig: "", th: "", igLen: 0, thLen: 0 };
  var now = chState.now || { why: [] }, main = chState.scen.filter(function (s) { return s.now; })[0] || chState.scen[0], lines = [];
  var hook = now.why.length ? now.why[0].split("→").pop().trim() : "평소 구간";
  lines.push("지금은 " + hook + " — 과거엔 무엇이 강했을까요?"); lines.push("");
  lines.push("🔎 지금 신호: " + (now.why.length ? now.why.join(" / ") : "두드러진 신호 없음"));
  lines.push("📚 비교한 과거: " + main.tag + " 국면 " + main.eps.map(function (e) { return e.s.slice(0, 4); }).join("·") + "년");
  lines.push("");
  main.eps.slice(0, 3).forEach(function (e) { var r = e.st.filter(function (x) { return x.fwd != null && x.sym !== "KRW=X"; }).sort(function (a, b) { return b.fwd - a.fwd; })[0]; if (r) lines.push("· " + e.name + " 뒤 1년 → 가장 강했던 자산 " + stName(r.sym) + " " + cPct(r.fwd, 0)); });
  lines.push(""); lines.push("정해진 승자는 없었어요. 사건의 원인에 따라 달랐습니다. 그래서 '예측' 대신 '조건'을 봅니다 — 장기금리·공포지수·추세·달러.");
  lines.push(""); lines.push("지금은 어떤 구간이라고 보시나요? 댓글로 남겨 주세요.");
  var tags = PUB_TAGS_BASE.concat(["자산배분", "금리", "유가", "ETF투자", "투자공부"]).map(function (x) { return "#" + x; }).join(" ");
  var ig = lines.join("\n") + "\n\n※ 과거 데이터(야후 파이낸스 종가) 자동 집계 · 예시 구성은 손실을 막아주지 않으며 투자 권유 아님" + "\n\n" + tags;
  var th = lines.slice(0, 7).join("\n") + "\n\n(과거 자료 · 투자 권유 아님)"; if (th.length > 500) th = th.slice(0, 490) + "…";
  return { ig: ig, th: th, igLen: ig.length, thLen: th.length };
}
function storyOpen() {
  if (!storyReady()) { alert("채널 브리핑 자료의 '상황별 과거 사례'와 '자산배분'이 먼저 계산돼야 해요. 몇 초 뒤 다시 눌러 주세요."); return; }
  var btn = document.querySelector("[data-story]"), old = btn ? btn.textContent : ""; if (btn) btn.textContent = "만드는 중…";
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { CARD_TXT = ""; try { storyCards(); } catch (e) { console.warn(e); } if (!document.fonts || !document.fonts.load) return; var txt = CARD_TXT.replace(/\s+/g, ""); return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })); })
    .then(function () {
      if (btn) btn.textContent = old;
      var list; try { list = storyCards(); } catch (e) { console.warn(e); list = []; }
      if (!list.length) { alert("아직 데이터가 준비되지 않았어요."); return; }
      var cap = storyCaption(), day = pubToday().replace(/-/g, ""), box = document.createElement("div");
      box.innerHTML = '<div class="briefDim" style="margin-bottom:8px">순서: 표지 → 지금 숫자 → 닮은 과거 → 사례별 1년 뒤 → 승자 표 → 체크리스트 → 조건별 구성 → 구성 성과 → 마무리. 추천·예측 문장은 없고 "과거엔 이랬다"까지만 담았어요.</div>' +
        '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button>' + (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유</button>' : '') + '<button class="chip" data-act="cap">📋 인스타 캡션 (' + cap.igLen + '자)</button><button class="chip" data-act="th">📋 스레드 (' + cap.thLen + '자)</button></div><div class="cardsWrap"></div>';
      var wrap = box.querySelector(".cardsWrap");
      list.forEach(function (it, i) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_스토리_" + day + "_" + (i + 1) + "_" + it.name.replace(/^[^_]+_/, "") + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + '. ' + it.name.replace(/^[^_]+_/, "") + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
      box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
      box.querySelector('[data-act="cap"]').onclick = function () { chCopy(cap.ig, this); };
      box.querySelector('[data-act="th"]').onclick = function () { chCopy(cap.th, this); };
      var sh = box.querySelector('[data-act="share"]');
      if (sh) sh.onclick = function () { Promise.all(list.map(function (it) { return new Promise(function (ok) { it.cv.toBlob(function (b) { ok(new File([b], it.file, { type: "image/png" })); }, "image/png"); }); })).then(function (files) { if (navigator.canShare({ files: files })) return navigator.share({ files: files }); }).catch(function () {}); };
      infoModal.open("📚 스토리 덱 · " + list.length + "장", box);
    });
}
