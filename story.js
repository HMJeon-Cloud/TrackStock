/* ============================================================
   연구노트 덱 (v8.7) — 데이터로 한 가지 질문을 끝까지 따라가는 캐러셀
   틀(우상향연구소 고유): 위 검정 "결론 먼저" (연구노트 · 관찰 01 + 큰 문장, 금색 강조) → 아래 밝은 "근거" (제목 + 시각 자료 + 출처)
   덱 종류 (storyDecks()가 상황·데이터에 맞춰 항상 만들 수 있는 목록을 돌려준다):
     scene:<id>  국면 덱 — 금리 급등 / 금리 인하 전환 / 공포 급락 / 유가 급등 / 달러 강세 (지금 신호와 맞는 것에 ← 지금)
     drawdown    낙폭 덱 — 지금 고점 대비 얼마나 빠졌나, 과거엔 몇 번·얼마나·얼마 만에 회복했나
     dca         적립 덱 — 1년 전 100만원 / 매달 10만원 / 가장 좋은 10일을 놓쳤다면
     news        뉴스 덱 — 오늘 아침 기사 제목 → 그 자산의 실제 숫자 (말과 숫자 비교)
   원칙: 추천·예측 없음. 과거 사실 + 지금 위치 + 무엇을 보면 되는지까지만.
   ============================================================ */
var NB = { W: 1080, H: 1350, PAD: 60, SPLIT: 540 };   // 위 검정 0~540 / 아래 밝은 540~1350
var NB_C = { black: "#111111", light: "#f7f5f0", navy: "#1f2a44", txt: "#1c2333", sub: "#6b7280", line: "#e4dfd3", gold: "#e6c57a", gold2: "#c9a24f", up: "#d9342b", down: "#2f6fd6", teal: "#5b9bb5", white: "#ffffff", grey: "#9aa3b2", box: "#eeeae1" };
var NB_ASSETS = { "SPY": "S&P500", "QQQ": "나스닥100", "^KS11": "코스피", "SCHD": "미국 배당주", "TLT": "장기채", "IEF": "중기채", "SHY": "단기채", "GLD": "금", "DBC": "원자재", "BTC-USD": "비트코인", "KRW=X": "달러/원", "USO": "원유", "^GSPC": "S&P500", "^IXIC": "나스닥", "005930.KS": "삼성전자", "000660.KS": "SK하이닉스" };
var NB_WORD = { label: "연구노트", obs: "관찰", next: "다음 장 →", save: "저장해 두기", cta: "댓글로 생각 남기기" };
/* 받침에 따라 은/는, 이/가, 을/를 */
function nbJosa(w, pair) { var ch = String(w).slice(-1), code = ch.charCodeAt(0), bat = code >= 0xAC00 && code <= 0xD7A3 ? (code - 0xAC00) % 28 !== 0 : /[0-9]$/.test(ch) ? /[013678]$/.test(ch) : /[^aeiouAEIOU\s]$/.test(ch) && /[A-Za-z]$/.test(ch) ? /[lmnrLMNR]$/.test(ch) : false; var p = pair.split("/"); return w + (bat ? p[0] : p[1]); }
function nbName(sym) { return NB_ASSETS[sym] || (typeof chName === "function" ? chName(sym) : sym); }

/* ---------- 틀 ---------- */
function nbNew() {
  var cv = document.createElement("canvas"); cv.width = NB.W; cv.height = NB.H;
  var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = NB_C.black; g.fillRect(0, 0, NB.W, NB.SPLIT);
  g.fillStyle = NB_C.light; g.fillRect(0, NB.SPLIT, NB.W, NB.H - NB.SPLIT);
  var gl = g.createLinearGradient(0, 0, NB.W, 0); gl.addColorStop(0, NB_C.gold2); gl.addColorStop(0.6, NB_C.gold); gl.addColorStop(1, "rgba(230,197,122,0.25)");
  g.fillStyle = gl; g.fillRect(0, NB.SPLIT - 4, NB.W, 4);
  return { cv: cv, g: g, y: NB.SPLIT + 60 };
}
/* 위 검정: "연구노트 · 관찰 01" (금색 작은 글씨) + 오른쪽 쪽번호 + 큰 결론 문장들 */
function nbTop(c, n, lines, page, total) {
  var g = c.g, P = NB.PAD;
  cText(g, "↗ " + NB_WORD.label + " · " + NB_WORD.obs + " " + (n < 10 ? "0" + n : n), P, 92, 24, 700, NB_C.gold);
  if (page) cText(g, page + " / " + total, NB.W - P, 92, 24, 700, NB_C.grey, "right");
  var size = 50, lh = 66, flat;
  function build() { flat = []; lines.forEach(function (l) { flat = flat.concat(nbSplit(g, l, NB.W - P * 2, size)); }); }
  build(); while (flat.length * lh > 330 && size > 36) { size -= 2; lh = size * 1.32; build(); }
  var y0 = NB.SPLIT - 70 - (flat.length - 1) * lh;   // 아래 맞춤 (금색 줄 바로 위에서 끝나게)
  flat.forEach(function (l, i) { cRich(g, l, P, y0 + i * lh, size, 800, NB_C.white, NB_C.gold); });
}
/* 아래 밝은 패널 머리: 근거 제목(남색) + 부제(회색) */
function nbBody(c, title, sub) {
  var g = c.g, P = NB.PAD;
  cText(g, title, P, NB.SPLIT + 70, 30, 800, NB_C.navy);
  if (sub) cText(g, cFit(g, sub, NB.W - P * 2, 21, 500), P, NB.SPLIT + 106, 21, 500, NB_C.sub);
  c.y = NB.SPLIT + 140;
}
function nbFoot(c, src, cta) {
  var g = c.g, P = NB.PAD;
  cText(g, cFit(g, src || "StockMind 집계 · 야후 파이낸스 종가 · 과거 자료이며 투자 권유 아님", NB.W - P * 2 - 220, 19, 500), P, NB.H - 78, 19, 500, NB_C.sub);
  cText(g, cta || NB_WORD.next, P, NB.H - 38, 20, 700, NB_C.gold2);
  var w = cW(g, "uphill.lab", 26, 800), x = NB.W - P - w;
  cText(g, "uphill.lab", NB.W - P, NB.H - 38, 26, 800, NB_C.txt, "right");
  g.strokeStyle = NB_C.gold2; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(x - 38, NB.H - 40); g.lineTo(x - 18, NB.H - 60); g.moveTo(x - 28, NB.H - 60); g.lineTo(x - 18, NB.H - 60); g.lineTo(x - 18, NB.H - 50); g.stroke();
}
function nbSplit(g, s, maxW, size) {
  if (s === "") return [""];
  var words = String(s).split(" "), lines = [], line = ""; cFont(g, size, 800);
  words.forEach(function (w) { var t = line ? line + " " + w : w; if (g.measureText(cPlain(t)).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line);
  var open = false; return lines.map(function (l) { var o = open, n = (l.match(/\[\[/g) || []).length - (l.match(/\]\]/g) || []).length; if (o) l = "[[" + l; if (n > 0) { l += "]]"; open = true; } else if (n < 0) open = false; return l; });
}
/* 표지 / 마무리 (전체 검정) */
function nbCover(small, lines, sub, meta) {
  var c = nbNew(), g = c.g, P = NB.PAD; g.fillStyle = NB_C.black; g.fillRect(0, 0, NB.W, NB.H); g.fillStyle = NB_C.gold; g.fillRect(0, 0, NB.W, 8);
  cText(g, "↗ 우상향연구소 " + NB_WORD.label, P, 110, 26, 700, NB_C.gold);
  cText(g, small, P, 540, 32, 600, "#cfd3dc");
  var flat = []; lines.forEach(function (l) { flat = flat.concat(nbSplit(g, l, NB.W - P * 2, 74)); });
  flat.forEach(function (l, i) { cRich(g, l, P, 660 + i * 94, 74, 800, NB_C.white, NB_C.gold); });
  cWrap(g, sub, P, 660 + flat.length * 94 + 40, NB.W - P * 2, 27, 500, "#cfd3dc", 40, 3);
  cText(g, meta || cDate(Date.now()) + " 기준 · 과거 데이터 비교 자료 · 투자 권유 아님", P, NB.H - 78, 19, 500, NB_C.grey);
  cText(g, NB_WORD.next, P, NB.H - 38, 20, 700, NB_C.gold); cText(g, "uphill.lab", NB.W - P, NB.H - 38, 26, 800, NB_C.white, "right");
  return c.cv;
}
function nbClose(q, lines, foot) {
  var c = nbNew(), g = c.g, P = NB.PAD; g.fillStyle = NB_C.black; g.fillRect(0, 0, NB.W, NB.H); g.fillStyle = NB_C.gold; g.fillRect(0, 0, NB.W, 8);
  cText(g, "↗ 우상향연구소 " + NB_WORD.label, P, 110, 26, 700, NB_C.gold);
  cWrap(g, q, P, 520, NB.W - P * 2, 54, 800, NB_C.white, 70, 3);
  cText(g, NB_WORD.cta, P, 720, 50, 800, NB_C.gold);
  lines.forEach(function (l, i) { cText(g, l, P, 840 + i * 56, 34, 600, "#cfd3dc"); });
  cText(g, foot || "매일 아침 전일 정리 · 일요일 한 주 정리 · 월요일 한 주 예상", P, 1060, 24, 600, "#8e95a3");
  cText(g, "StockMind 자동 집계 · 야후 파이낸스 종가 · 과거 자료이며 투자 권유 아님", P, NB.H - 78, 19, 500, NB_C.grey);
  cText(g, NB_WORD.save, P, NB.H - 38, 20, 700, NB_C.gold); cText(g, "uphill.lab", NB.W - P, NB.H - 38, 26, 800, NB_C.white, "right");
  return c.cv;
}

/* ---------- 시각 자료 (밝은 패널 안, c.y부터) ---------- */
function nbTiles(c, tiles) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, n = tiles.length, tw = W / n, y = c.y + 40;
  tiles.forEach(function (t, i) { var x = P + tw * i + tw / 2; cText(g, t.v, x, y + 70, 62, 800, t.color || NB_C.navy, "center"); cWrap(g, t.l, x, y + 116, tw - 20, 22, 500, NB_C.sub, 30, 2, "center"); });
  g.strokeStyle = NB_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + 196); g.lineTo(P + W, y + 196); g.stroke();
  c.y = y + 226;
}
function nbGoldLine(c, s, sub) { var g = c.g; cText(g, cFit(g, s, NB.W - NB.PAD * 2, 32, 800), NB.W / 2, c.y + 50, 32, 800, NB_C.gold2, "center"); if (sub) cText(g, cFit(g, sub, NB.W - NB.PAD * 2, 22, 500), NB.W / 2, c.y + 92, 22, 500, NB_C.sub, "center"); c.y += 110; }
function nbCards3(c, cards) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, gap = 24, n = cards.length, cw = (W - gap * (n - 1)) / n, h = 400, y = c.y + 10;
  cards.forEach(function (k, i) {
    var x = P + i * (cw + gap); cRound(g, x, y, cw, h, 18, NB_C.box);
    cText(g, k.year, x + cw / 2, y + 90, 48, 800, k.color || NB_C.navy, "center");
    cWrap(g, k.name, x + cw / 2, y + 150, cw - 28, 27, 800, NB_C.txt, 34, 2, "center");
    cWrap(g, k.sub || "", x + cw / 2, y + 236, cw - 28, 21, 500, NB_C.sub, 28, 2, "center");
    if (k.v) { cText(g, k.v, x + cw / 2, y + 340, 36, 800, k.vc || NB_C.navy, "center"); cText(g, k.vl || "", x + cw / 2, y + 372, 18, 500, NB_C.sub, "center"); }
  });
  c.y = y + h + 20;
}
function nbBars(c, items) {
  items = (items || []).filter(function (x) { return x && isFinite(x.v); });   // v9.4: 비정상 값은 빼고 그린다
  if (!items.length) { c.y += 40; return; }
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, n = items.length, bw = Math.min(150, (W - 30 * (n - 1)) / n), gap = n > 1 ? (W - bw * n) / (n - 1) : 0;
  var neg = items.some(function (x) { return x.v < 0; }), mn = Math.min.apply(null, items.map(function (x) { return x.v; }));
  var top = c.y + 50, H = neg ? 230 : 300, mxAbs = Math.max.apply(null, items.map(function (x) { return Math.abs(x.v); })) || 0.01;
  var base = neg ? top + H + 20 : top + H + 40, negH = neg ? Math.abs(mn) / mxAbs * H : 0;
  items.forEach(function (it, i) {
    var x = P + i * (bw + gap), h = Math.min(H, Math.max(6, Math.abs(it.v) / mxAbs * H)), col = it.color || (it.v >= 0 ? NB_C.navy : NB_C.grey), y = it.v >= 0 ? base - h : base;
    g.fillStyle = col; g.fillRect(x, y, bw, h);
    cText(g, it.txt || cPct(it.v), x + bw / 2, it.v >= 0 ? y - 16 : y + h + 34, 28, 800, col, "center");
    cText(g, it.l, x + bw / 2, it.v >= 0 ? base + 40 : y - 14, 21, 600, NB_C.txt, "center");
  });
  g.strokeStyle = NB_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, base); g.lineTo(P + W, base); g.stroke();
  c.y = base + negH + 70;
}
function nbRows(c, rows, leftW) {   // [왼쪽 회색, 가운데 굵게, 오른쪽 값, 색]
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, h = Math.min(92, Math.floor((NB.H - 110 - c.y) / rows.length)), y = c.y, lw = leftW || 300;
  rows.forEach(function (r) {
    cText(g, cFit(g, r[0], lw - 20, 23, 500), P, y + h / 2 + 9, 23, 500, NB_C.sub); cText(g, cFit(g, r[1], W - lw - 170, 29, 800), P + lw, y + h / 2 + 10, 29, 800, NB_C.txt);
    cText(g, r[2], P + W, y + h / 2 + 10, 32, 800, r[3] || NB_C.navy, "right");
    g.strokeStyle = NB_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + h); g.lineTo(P + W, y + h); g.stroke(); y += h;
  });
  c.y = y;
}
function nbChecks(c, items) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, gap = 24, cw = (W - gap) / 2, h = 180, y = c.y;
  items.forEach(function (it, i) {
    var x = P + (i % 2) * (cw + gap), yy = y + Math.floor(i / 2) * (h + gap);
    cRound(g, x, yy, cw, h, 18, it.ok ? "#e9f1ea" : NB_C.box);
    cText(g, it.t, x + 28, yy + 58, 27, 700, NB_C.teal); cText(g, cFit(g, it.s, cw - 110, 25, 600), x + 28, yy + 116, 25, 600, NB_C.txt);
    cText(g, it.ok ? "✓" : "–", x + cw - 34, yy + 104, 42, 800, it.ok ? "#2e7d4f" : NB_C.grey, "right");
  });
  c.y = y + 2 * h + gap + 10;
}
function nbTable(c, rows) {   // [조건, 구성(2줄 가능), 성격, 색]
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, h = Math.min(118, Math.floor((NB.H - 110 - c.y) / rows.length)), y = c.y;
  rows.forEach(function (r) {
    cWrap(g, r[0], P, y + h / 2 - 2, 270, 21, 500, NB_C.sub, 27, 2);
    cWrap(g, r[1], P + 300, y + h / 2 - 2, W - 300 - 130, 24, 800, NB_C.txt, 31, 2);
    cText(g, r[2], P + W, y + h / 2 + 10, 27, 800, r[3] || NB_C.gold2, "right");
    g.strokeStyle = NB_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + h); g.lineTo(P + W, y + h); g.stroke(); y += h;
  });
  c.y = y;
}
function nbNewsRows(c, items) {   // 뉴스 덱: 제목(굵게) ↔ 숫자
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, h = Math.min(150, Math.floor((NB.H - 110 - c.y) / items.length)), y = c.y;
  items.forEach(function (it) {
    cRound(g, P, y, W, h - 14, 16, NB_C.box);
    cWrap(g, it.title, P + 24, y + 42, W - 48, 26, 800, NB_C.txt, 33, 2);
    cText(g, it.left, P + 24, y + h - 38, 22, 600, NB_C.sub);
    cText(g, it.right, P + W - 24, y + h - 36, 30, 800, it.color || NB_C.navy, "right");
    y += h;
  });
  c.y = y;
}

/* ---------- 데이터 도우미 ---------- */
function nbRecent() { return (typeof chState !== "undefined" && chState.recent) || (typeof briefState !== "undefined" && briefState.recent) || null; }
function nbStat(sym) { var r = nbRecent(), d = r && r.symbols[sym]; return d ? briefStats(sym, d, "day") : null; }
function nbNow() { var r = nbRecent(); return (typeof chState !== "undefined" && chState.now) || (r && typeof chDetectNow === "function" ? chDetectNow(r) : { match: {}, why: [] }); }
/* 가장 좋은 N일을 놓쳤다면 (SPY 10년) */
function nbMissBest(rows, years, n) {
  if (!rows || rows.length < 300) return null;
  var t0 = rows[rows.length - 1].t - years * 365.25 * 86400e3, i0 = 0; while (i0 < rows.length && rows[i0].t < t0) i0++;
  if (i0 < 1 || rows.length - i0 < 200) return null;
  var rs = []; for (var i = i0; i < rows.length; i++) rs.push(rows[i].c / rows[i - 1].c - 1);
  var all = rs.reduce(function (a, r) { return a * (1 + r); }, 1);
  var sorted = rs.slice().sort(function (a, b) { return b - a; }), cut = sorted[n - 1];
  var miss = rs.reduce(function (a, r) { return r >= cut ? a : a * (1 + r); }, 1);
  var missW = rs.reduce(function (a, r) { return r <= sorted[sorted.length - n] ? a : a * (1 + r); }, 1);
  return { all: all - 1, miss: miss - 1, missWorst: missW - 1, days: rs.length };
}

/* ---------- 덱 목록 ---------- */
function storyDecks() {
  var now = nbNow(), out = [];
  if (typeof CH_SCEN !== "undefined") CH_SCEN.forEach(function (sc) {
    out.push({ key: "scene:" + sc.id, t: sc.icon + " " + sc.tag + "이(가) 오면", d: "과거 " + sc.eps.length + "번 — 그 뒤 1년 무엇이 강했나 · 체크리스트 · 조건별 구성", now: !!now.match[sc.id], ready: storyReady("scene"), group: "국면" });
  });
  out.unshift({ key: "today", t: "🔍 오늘의 관찰 — 오늘 가장 이례적인 것부터", d: "그날 데이터에서 평소와 다른 것 5~6가지를 골라 매일 다른 순서·다른 틀로 엮어요 (숫자만 바뀌는 덱이 아니라 구성 자체가 바뀜)", now: true, ready: !!nbRecent(), group: "매일" });
  out.push({ key: "drawdown", t: "🕳️ 지금 고점 대비 얼마나 빠졌나", d: "대표 자산의 낙폭 · 전고점 못 넘은 기간 · 비슷한 깊이의 과거 회복 기간", now: !!now.match.panic, ready: storyReady("drawdown"), group: "낙폭" });
  out.push({ key: "dca", t: "🗓️ 적금처럼 샀다면", d: "1년 전 100만원 · 매달 10만원 · 가장 좋은 10일을 놓쳤다면", now: false, ready: storyReady("dca"), group: "적립" });
  out.push({ key: "news", t: "📰 오늘 기사 vs 실제 숫자", d: "아침 뉴스 제목과 그 자산의 종가 변화를 나란히", now: typeof CARD_NEWS !== "undefined" && CARD_NEWS.items.length > 0, ready: storyReady("news"), group: "뉴스" });
  return out;
}
function storyReady(kind) {
  var r = nbRecent(); if (!r) return false;
  if (kind === "scene" || !kind) return !!(typeof chState !== "undefined" && chState.scen && chState.scen.length && chState.cmp);
  if (kind === "drawdown") return NB_DD_SYMS.filter(function (x) { return nbHist[x] && nbHist[x].length > 250; }).length >= 3;
  if (kind === "dca") return !!(typeof CARD_HIST !== "undefined" && CARD_HIST.SPY && CARD_HIST.SPY.length > 300);
  if (kind === "news") return !!(typeof CARD_NEWS !== "undefined" && CARD_NEWS.items.length);
  if (kind === "today") return !!r;
  return false;
}
/* 덱 만들기 전 필요한 데이터 불러오기 */
function storyPrepare(key) {
  var kind = key.split(":")[0], ps = [];
  if (kind === "dca" && typeof cardsPrefetch === "function") ps.push(cardsPrefetch("all"));
  if (kind === "drawdown") ps.push(nbLoad(NB_DD_SYMS));
  if (kind === "today") ps.push(nbLoad(["SPY", "^VIX", "^KS11", "BTC-USD", "GLD", "QQQ", "TLT"]), typeof cardsPrefetch === "function" ? cardsPrefetch("all") : null, typeof cardsNewsFetch === "function" ? cardsNewsFetch(typeof briefState !== "undefined" ? briefState.result : null).catch(function () { return []; }) : null);
  if (kind === "news" && typeof cardsNewsFetch === "function") ps.push(cardsNewsFetch(typeof briefState !== "undefined" ? briefState.result : null).catch(function () { return []; }));
  return Promise.all(ps);
}
function storyCards(key) {
  var kind = key.split(":")[0], id = key.split(":")[1];
  if (kind === "scene") return nbSceneDeck(id);
  if (kind === "drawdown") return nbDrawdownDeck();
  if (kind === "dca") return nbDcaDeck();
  if (kind === "news") return nbNewsDeck();
  if (kind === "today") return nbTodayDeck();
  return [];
}

/* ---------- ① 국면 덱 ---------- */
function nbSceneDeck(id) {
  if (!storyReady("scene")) return [];
  var out = [], now = nbNow(), recent = nbRecent();
  var main = chState.scen.filter(function (s) { return s.id === id; })[0] || chState.scen.filter(function (s) { return s.now; })[0] || chState.scen[0];
  var isNow = !!now.match[main.id];
  var tlt = nbStat("TLT"), vix = nbStat("^VIX"), spy = nbStat("SPY"), uso = nbStat("USO"), krw = nbStat("KRW=X");
  var epsFwd = main.eps.filter(function (e) { return e.st.some(function (x) { return x.fwd != null; }); }).slice(0, 3);
  var total = 2 + 1 + epsFwd.length + 1 + 1 + 1 + 1 + 1, pg = 0, n = 0, c;
  var hookWord = isNow && now.why.length ? now.why[0].split("→").pop().trim() : main.tag;
  // 표지
  pg++; out.push({ name: "표지", cv: nbCover(isNow ? "지금 시장이 보내는 신호" : "이런 상황이 오면", [isNow ? "지금은 [[" + hookWord + "]]" : "[[" + main.tag + "]]이 오면", "과거엔 무엇이 강했을까?"], main.tag + " 국면 " + main.eps.length + "번의 과거를 자산별로 뜯어봤어요. 결론부터 말하면, 정해진 승자는 없었어요.") });
  // 관찰 01 지금 숫자
  c = nbNew(); pg++; n++;
  nbTop(c, n, ["지금 시장의 숫자는", "[[" + (now.why.length ? now.why[0].split("→").pop().trim() : "두드러진 신호 없음") + "]]을 가리킨다.", isNow ? "그래서 [[" + main.tag + "]] 국면과 비교한다." : "오늘은 " + main.tag + " 국면이 아니지만, 미리 알아 둔다."], pg, total);
  nbBody(c, "시장을 움직이는 숫자 셋", cDate(recent.generated ? Date.parse(recent.generated) : Date.now()) + " 종가 기준 · 한 달 변화 · 원유 1개월 " + cPct(uso && uso.m1) + " · 달러/원 1개월 " + cPct(krw && krw.m1));
  nbTiles(c, [{ v: cPct(tlt && tlt.m1), l: "미국 장기채(TLT) 1개월", color: tlt && tlt.m1 < 0 ? NB_C.up : NB_C.teal }, { v: vix ? vix.last.toFixed(1) : "-", l: "공포지수 VIX", color: vix && vix.last >= 25 ? NB_C.up : NB_C.navy }, { v: spy && spy.vsHi != null ? cPct(spy.vsHi, 0) : "-", l: "S&P500 52주 고점 대비", color: spy && spy.vsHi <= -0.1 ? NB_C.up : NB_C.navy }]);
  nbGoldLine(c, now.why.length ? now.why.join("  ·  ") : "평소 구간 — 두드러진 신호 없음", "장기채가 오르면 금리 하락, VIX 25 이상이면 공포, 고점 대비 -10%면 조정으로 봐요");
  nbFoot(c); out.push({ name: "지금숫자", cv: c.cv });
  // 관찰 02 닮은 과거
  c = nbNew(); pg++; n++;
  var les = (main.lesson.match(/[^.。]+[.。]/) || [main.lesson])[0].trim();
  nbTop(c, n, ["같은 [[" + main.tag + "]]이어도", "원인과 깊이는 매번 달랐다.", "", les.length > 56 ? les.slice(0, 54) + "…" : les], pg, total);
  nbBody(c, main.tag + " 국면 — 과거 " + main.eps.length + "번", "구간 중 S&P500 등락 · 기간");
  nbCards3(c, main.eps.slice(0, 3).map(function (e) { var s = e.st.filter(function (x) { return x.sym === "SPY"; })[0]; return { year: e.s.slice(0, 4), name: e.name.replace(/^\d{4}\s*/, ""), sub: e.s.slice(5).replace("-", ".") + " ~ " + e.e.slice(5).replace("-", "."), v: s ? cPct(s.ret, 1) : "", vl: "S&P500 구간 등락", vc: s ? cCol(s.ret) : null, color: NB_C.up }; }));
  nbFoot(c); out.push({ name: "닮은과거", cv: c.cv });
  // 관찰 03~ 사례별 1년 뒤
  epsFwd.forEach(function (e) {
    c = nbNew(); pg++; n++;
    var rows = e.st.filter(function (x) { return x.fwd != null && x.sym !== "KRW=X"; }).sort(function (a, b) { return b.fwd - a.fwd; });
    var top = rows.slice(0, 4).concat(rows.length > 4 ? [rows[rows.length - 1]] : []), best = rows[0], worst = rows[rows.length - 1];
    nbTop(c, n, ["[[" + e.name.replace(/^\d{4}\s*/, "") + "]] 뒤 1년,", "가장 강했던 건 [[" + nbName(best.sym) + " " + cPct(best.fwd, 0) + "]]", "", worst.fwd < 0 ? nbJosa(nbName(worst.sym), "은/는") + " " + cPct(worst.fwd, 0) + ". 같은 사건 뒤에도 자산마다 달랐다." : "가장 약한 " + nbName(worst.sym) + "도 " + cPct(worst.fwd, 0) + ". 다 올랐지만 폭이 달랐다."], pg, total);
    nbBody(c, e.name + " 뒤 1년", "구간이 끝난 날(" + e.e.replace(/-/g, ".") + ")부터 1년 뒤 자산별 등락 · 상위 4 + 꼴찌");
    nbBars(c, top.map(function (x, k) { return { l: nbName(x.sym), v: x.fwd, color: k === 0 ? NB_C.up : x.fwd < 0 ? NB_C.grey : [NB_C.navy, NB_C.teal, NB_C.gold2, NB_C.navy][k % 4] }; }));
    nbFoot(c); out.push({ name: e.s.slice(0, 4) + "뒤1년", cv: c.cv });
  });
  // 승자 표
  c = nbNew(); pg++; n++;
  var allEps = []; chState.scen.forEach(function (s) { s.eps.forEach(function (e) { var r = e.st.filter(function (x) { return x.fwd != null && x.sym !== "KRW=X"; }).sort(function (a, b) { return b.fwd - a.fwd; })[0]; if (r) allEps.push({ y: e.s.slice(0, 4), tag: s.tag, best: r }); }); });
  allEps = allEps.slice(0, 7); var uniq = {}; allEps.forEach(function (a) { uniq[nbName(a.best.sym)] = 1; });
  nbTop(c, n, ["금리·유가가 꺾이면", "먼저 오르는 자산은 뭘까?", "", allEps.length + "번의 사례에서 1등은 [[" + Object.keys(uniq).length + "가지]].", "사건의 원인에 따라 승자가 달랐다."], pg, total);
  nbBody(c, "역사에는 정해진 순서가 없었다", "국면이 끝난 뒤 1년, 가장 강했던 자산");
  nbRows(c, allEps.map(function (a) { return [a.y + " · " + a.tag, nbName(a.best.sym), cPct(a.best.fwd, 0), cCol(a.best.fwd)]; }));
  nbFoot(c); out.push({ name: "승자표", cv: c.cv });
  // 체크리스트
  c = nbNew(); pg++; n++;
  var chk = [{ t: "장기금리", s: tlt && tlt.m1 >= 0.03 ? "하락 전환 (TLT 1개월 " + cPct(tlt.m1) + ")" : tlt && tlt.m1 <= -0.03 ? "상승 중 (TLT " + cPct(tlt.m1) + ")" : "횡보 (TLT " + cPct(tlt && tlt.m1) + ")", ok: !!(tlt && tlt.m1 >= 0.03) },
    { t: "공포지수", s: vix ? (vix.last < 20 ? "평온 (" + vix.last.toFixed(0) + ")" : vix.last < 25 ? "불안 (" + vix.last.toFixed(0) + ")" : "공포 (" + vix.last.toFixed(0) + ")") : "-", ok: !!(vix && vix.last < 20) },
    { t: "S&P500 추세", s: spy ? (spy.above20 ? "20일선 위" : "20일선 아래") + " · 고점比 " + cPct(spy.vsHi, 0) : "-", ok: !!(spy && spy.above20) },
    { t: "달러", s: krw ? (Math.abs(krw.m1) < 0.02 ? "안정 (1개월 " + cPct(krw.m1) + ")" : krw.m1 > 0 ? "강세 (1개월 " + cPct(krw.m1) + ")" : "약세 (1개월 " + cPct(krw.m1) + ")") : "-", ok: !!(krw && Math.abs(krw.m1) < 0.02) }];
  var okN = chk.filter(function (x) { return x.ok; }).length;
  nbTop(c, n, ["하나가 아니라,", "네 개를 같이 봐야 한다.", "", "장기금리 · 공포지수 · 추세 · 달러", "[[지금은 " + okN + " / 4]]"], pg, total);
  nbBody(c, "'좋은 금리 하락'을 확인하는 체크리스트", "넷이 함께 나올수록 과거엔 주식·채권이 같이 올랐던 경우가 많았어요");
  nbChecks(c, chk);
  nbFoot(c); out.push({ name: "체크리스트", cv: c.cv });
  // 조건별 구성 — 전체 비중(합 100)
  c = nbNew(); pg++; n++;
  var cond = [["rateDown", "장기채 ↑ · VIX 안정", "공격"], ["none", "뚜렷한 신호 없음", "균형"], ["panic", "VIX 25↑ · 고점 -10%", "방어"], ["rateUp", "장기채 ↓ (금리 상승)", "수비"], ["oilUp", "원유 1개월 +10%", "물가 대응"]];
  var nowKey = (chState.plan || {}).key || "none";
  nbTop(c, n, ["[[" + cond.length + "가지 상황]]을 미리 그려 두고", "그 상황에 맞게 조정하면 된다.", "", "코어는 그대로, 신규 자금의 방향만 바꾼다."], pg, total);
  nbBody(c, "순서 매매 대신 조건 매매", "비중(%) 합 100 · 지금 = " + CH_PLAN_LABEL[nowKey]);
  nbTable(c, cond.map(function (k) { var p = CH_PLANS[k[0]], mix = p.items.map(function (it) { return nbName(it[0]) + " " + it[1]; }).join(" · "), isNow = nowKey === k[0]; return [k[1] + (isNow ? " ← 지금" : ""), mix, k[2], isNow ? NB_C.up : NB_C.gold2]; }));
  nbFoot(c, "예시 구성이며 손실을 막아주지 않는다 · 비중은 % · 투자 권유 아님"); out.push({ name: "조건표", cv: c.cv });
  // 구성 성과
  c = nbNew(); pg++; n++;
  var cmp = chState.cmp.filter(function (x) { return x.res[2] && x.res[3]; }).sort(function (a, b) { return b.res[3].ret - a.res[3].ret; });
  if (cmp.length) {
    var top1 = cmp[0], low1 = cmp[cmp.length - 1];
    nbTop(c, n, ["3년 기준 1위는 [[" + top1.label + " " + cPct(top1.res[3].ret, 0) + "]]", "꼴찌는 " + low1.label + " " + cPct(low1.res[3].ret, 0) + ".", "", "기간마다 1위가 바뀐다.", "그래서 한 가지에 몰지 않는다."], pg, total);
    nbBody(c, "그 구성들, 과거엔 어땠나", "처음 비중 그대로 뒀을 때 — 왼쪽 1년(괄호: 최대 낙폭) · 오른쪽 3년");
    nbRows(c, cmp.map(function (x) { return ["1년 " + cPct(x.res[2].ret, 0) + " (" + cPct(x.res[2].mdd, 0) + ")", x.label, cPct(x.res[3].ret, 0), cCol(x.res[3].ret)]; }), 330);
    nbFoot(c); out.push({ name: "구성성과", cv: c.cv });
  }
  // 마무리
  pg++; out.push({ name: "마무리", cv: nbClose("지금은 어떤 구간이라고 보시나요?", ["저장해 두고, 신호가 바뀔 때", "다시 꺼내 보면 돼요."]) });
  return out;
}

/* ---------- ② 낙폭 덱 (10년치 일봉에서 직접 계산 · v8.8) ----------
   과거 오류: chMddRow의 '보통 회복 기간'은 -10% 이상 모든 사례의 중앙값이라, 지금처럼 깊고 긴 하락과 맞지 않았다.
   이제: 지금 낙폭과 비슷한 깊이(지금의 80% 이상) 사례만 골라 회복 기간을 재고, '아직 전고점 못 넘은 지 N일'을 따로 보여준다. */
var NB_DD_SYMS = ["SPY", "QQQ", "^KS11", "TLT", "GLD", "BTC-USD"];
var nbHist = {};
function nbLoad(list) { return Promise.all(list.map(function (sym) { if (nbHist[sym]) return null; return getChartData(sym, "max").then(function (p) { nbHist[sym] = (p && p.rows) || []; }).catch(function () { nbHist[sym] = []; }); })); }
function nbDd(sym) {
  var rows = nbHist[sym]; if (!rows || rows.length < 250) return null;
  var eps = drawdownEpisodes(rows, 0.10), last = rows[rows.length - 1], peak = -Infinity, peakT = 0;
  rows.forEach(function (r) { if (r.c > peak) { peak = r.c; peakT = r.t; } });
  var cur = last.c / peak - 1, sincePeak = Math.round((last.t - peakT) / 86400e3);
  var done = eps.filter(function (e) { return e.recoverI != null; }).map(function (e) { return { dd: e.dd, rec: Math.round((rows[e.recoverI].t - rows[e.troughI].t) / 86400e3), total: Math.round((rows[e.recoverI].t - rows[e.peakI].t) / 86400e3), y: new Date(rows[e.troughI].t).getFullYear() }; });
  var similar = done.filter(function (e) { return e.dd <= cur * 0.8; }).sort(function (a, b) { return a.total - b.total; });
  var medSim = similar.length ? similar[Math.floor(similar.length / 2)].total : null, longest = done.length ? done.slice().sort(function (a, b) { return b.total - a.total; })[0] : null;
  var worst = eps.length ? eps.slice().sort(function (a, b) { return a.dd - b.dd; })[0] : null;
  return { sym: sym, name: nbName(sym), cur: cur, sincePeak: sincePeak, eps: eps.length, done: done.length, deeper: eps.filter(function (e) { return e.dd < cur; }).length, worst: worst ? worst.dd : null, worstY: worst ? new Date(rows[worst.troughI].t).getFullYear() : null, medSim: medSim, simN: similar.length, longest: longest, years: (last.t - rows[0].t) / (365.25 * 86400e3), ongoing: cur <= -0.1 };
}
function nbMonths(d) { return d == null ? "-" : d < 45 ? d + "일" : d < 700 ? Math.round(d / 30) + "개월" : (d / 365).toFixed(1) + "년"; }
function nbDrawdownDeck() {
  var rows = NB_DD_SYMS.map(nbDd).filter(Boolean).sort(function (a, b) { return a.cur - b.cur; }); if (rows.length < 3) return [];
  var out = [], deep = rows[0], spy = rows.filter(function (x) { return x.sym === "SPY"; })[0] || deep, total = 6, pg = 0, n = 0, c, seed = nbSeed();
  var hooks = [["빠질 때 가장 먼저 보는 숫자", ["지금 [[고점 대비 " + cPct(deep.cur, 0) + "]]", "과거엔 몇 번, 얼마나, 얼마 만에?"]], ["얼마나 빠졌나보다 중요한 것", ["[[" + deep.name + "]]은 전고점을", "못 넘은 지 [[" + nbMonths(deep.sincePeak) + "]]째"]], ["하락장 체감 온도계", ["대표 자산 " + rows.filter(function (x) { return x.ongoing; }).length + "개가 [[-10% 아래]]", "과거의 하락은 어떻게 끝났나"]]][seed % 3];
  pg++; out.push({ name: "표지", cv: nbCover(hooks[0], hooks[1], deep.name + "이(가) 대표 자산 중 가장 많이 빠져 있어요. 10년치 일봉으로 과거의 하락과 회복을 꺼내 봤어요.") });
  c = nbNew(); pg++; n++;
  nbTop(c, n, ["지금 가장 많이 빠진 건 [[" + deep.name + " " + cPct(deep.cur, 0) + "]],", "전고점 이후 " + nbMonths(deep.sincePeak) + "째.", "", "가장 덜 빠진 " + nbJosa(rows[rows.length - 1].name, "은/는") + " " + cPct(rows[rows.length - 1].cur, 0) + "."], pg, total);
  nbBody(c, "대표 자산의 지금 위치", "역대 최고가 대비 · 최고가 이후 지난 기간");
  nbRows(c, rows.map(function (x) { return ["최고가 후 " + nbMonths(x.sincePeak), x.name, cPct(x.cur, 0), x.cur <= -0.1 ? NB_C.up : NB_C.navy]; }), 230);
  nbFoot(c); out.push({ name: "지금위치", cv: c.cv });
  c = nbNew(); pg++; n++;
  nbTop(c, n, ["[[" + spy.name + "]]" + nbJosa(spy.name, "은/는").slice(spy.name.length) + " 지난 " + Math.round(spy.years) + "년 동안", "-10% 넘게 빠진 적이 [[" + spy.eps + "번]].", "", spy.worst != null ? "가장 깊었을 땐 " + spy.worstY + "년 " + cPct(spy.worst, 0) + "." : "-10% 넘게 빠진 적이 없었다."], pg, total);
  nbBody(c, "-10% 하락은 드문 일이 아니었다", "자산별 최악의 낙폭(연도) · -10% 이상 하락 횟수");
  nbBars(c, rows.slice(0, 5).map(function (x, i) { return { l: x.name + (x.worstY ? " '" + String(x.worstY).slice(2) : ""), v: x.worst != null ? x.worst : 0, color: i === 0 ? NB_C.up : NB_C.grey, txt: (x.worst != null ? cPct(x.worst, 0) : "-") + " · " + x.eps + "번" }; }));
  nbFoot(c); out.push({ name: "횟수", cv: c.cv });
  c = nbNew(); pg++; n++;
  var withSim = rows.filter(function (x) { return x.ongoing; });
  var lead = withSim[0] || deep;
  nbTop(c, n, lead.medSim != null ? ["지금만큼 빠졌던 과거 " + lead.simN + "번,", "[[" + lead.name + "]]" + nbJosa(lead.name, "은/는").slice(lead.name.length) + " 고점에서 고점까지 보통 [[" + nbMonths(lead.medSim) + "]].", "", "지금은 " + nbMonths(lead.sincePeak) + "째" + (lead.longest ? " — 역대 가장 길었던 회복은 " + nbMonths(lead.longest.total) + "(" + lead.longest.y + "년)." : ".")] : ["[[" + lead.name + "]]" + nbJosa(lead.name, "은/는").slice(lead.name.length) + " 지금만큼 빠졌다가", "회복한 사례가 [[아직 없다]].", "", lead.longest ? "역대 가장 길었던 회복은 " + nbMonths(lead.longest.total) + "(" + lead.longest.y + "년)." : "비교할 과거가 없다."], pg, total);
  nbBody(c, "비슷한 깊이의 과거 하락, 고점에서 고점까지", "지금 낙폭의 80% 이상 빠진 사례만 · 중앙값 · 회색은 '아직 회복 전' 기간");
  nbRows(c, rows.map(function (x) { return [x.ongoing ? "회복 전 " + nbMonths(x.sincePeak) + "째" : "고점 근처", x.name, x.medSim != null ? nbMonths(x.medSim) + " (" + x.simN + "번)" : x.ongoing ? "전례 없음" : "-", x.medSim != null && x.ongoing && x.sincePeak > x.medSim ? NB_C.up : NB_C.navy]; }), 250);
  nbFoot(c, "고점→저점→고점 회복에 걸린 날수 · 과거 자료이며 투자 권유 아님"); out.push({ name: "회복", cv: c.cv });
  c = nbNew(); pg++; n++;
  nbTop(c, n, [deep.eps ? "지금 " + deep.name + "의 낙폭은 과거 " + deep.eps + "번 중 [[" + (deep.deeper + 1) + "번째]]로 깊다." : "지금 " + deep.name + "은 아직 [[-10% 하락]] 전이다.", "", deep.deeper > 0 ? "이보다 깊었던 " + deep.deeper + "번은 모두 끝이 있었다. 길이는 달랐다." : "지난 " + Math.round(deep.years) + "년 중 가장 깊다. 과거엔 모든 하락에 끝이 있었다."], pg, total);
  nbBody(c, "지금 하락, 과거와 나란히", "지금 낙폭 · 최악 낙폭 · 이보다 깊었던 횟수 · 비슷한 깊이의 회복");
  nbTable(c, rows.slice(0, 5).map(function (x) { return [x.name, "지금 " + cPct(x.cur, 0) + (x.worst != null ? " · 최악 " + cPct(x.worst, 0) + "('" + String(x.worstY).slice(2) + ")" : "") + " · 더 깊었던 적 " + x.deeper + "번", x.medSim != null ? nbMonths(x.medSim) : "–", NB_C.navy]; }));
  nbFoot(c); out.push({ name: "비교", cv: c.cv });
  pg++; out.push({ name: "마무리", cv: nbClose([["하락장에서 가장 어려운 건 '얼마나'가 아니라 '언제까지'예요.", "내가 견딜 수 있는 낙폭이 곧 내 주식 비중의 상한이에요."], ["전고점은 '언젠가'는 왔지만 '언제'는 아무도 몰랐어요.", "그래서 기간을 견딜 수 있는 돈으로만 투자해요."]][seed % 2][0], [[["내가 견딜 수 있는 낙폭이", "곧 내 주식 비중의 상한이에요."], ["기다릴 수 있는 돈과", "기다릴 수 없는 돈을 나누세요."]][seed % 2]][0]) });
  return out;
}
function nbSeed() { return Math.floor((Date.now() + 9 * 3600e3) / 86400e3); }

/* ---------- ③ 적립 덱 ---------- */
function nbDcaDeck() {
  if (!storyReady("dca")) return [];
  var out = [], ya = cYearAgo("all"), dca = cDca("all"), miss = nbMissBest(CARD_HIST.SPY, 10, 10);
  if (!ya.length || !dca) return [];
  var total = 5 + (miss ? 1 : 0), pg = 0, n = 0, c, w1 = ya[0], d1 = dca.rows[0];
  pg++; out.push({ name: "표지", cv: nbCover("타이밍 대신 꾸준함", ["적금처럼 샀다면", "[[" + dca.years + "년 뒤 얼마]]가 됐을까?"], "매달 10만원, 1년 전 100만원, 그리고 가장 좋은 10일을 놓쳤을 때 — 실제 종가로 계산했어요.") });
  c = nbNew(); pg++; n++;
  nbTop(c, n, ["1년 전 100만원은", "[[" + w1.name + " " + cMan(w1.val) + "]]이 됐다.", "", "지금 유명한 종목만 고른 것 자체가 결과를 알고 고른 것(생존자 편향)."], pg, total);
  nbBody(c, "1년 전에 100만원어치 샀다면", (cHasFx() ? "환율 포함 원화 기준" : "환율 변동 제외") + " · 배당 재투자");
  nbRows(c, ya.slice(0, 8).map(function (x) { return [cPct(x.ret, 0), x.name, cMan(x.val), cCol(x.ret)]; }), 150);
  nbFoot(c); out.push({ name: "1년전", cv: c.cv });
  c = nbNew(); pg++; n++;
  nbTop(c, n, ["매달 10만원 " + dca.years + "년,", "넣은 돈 " + cMan(d1.principal) + "이 [[" + d1.name + " " + cMan(d1.val) + "]].", "", "나눠 사면 고점에 몰아 살 걱정이 줄어든다."], pg, total);
  nbBody(c, "적금처럼 매달 첫 거래일에 10만원씩", "넣은 돈 대비 배수 · " + (cHasFx() ? "환율 포함 원화" : "환율 제외") + " · 배당 재투자");
  nbRows(c, dca.rows.slice(0, 8).map(function (x) { return [(x.val / x.principal).toFixed(1) + "배", x.name, cMan(x.val), x.val >= x.principal ? NB_C.up : NB_C.down]; }), 150);
  nbFoot(c); out.push({ name: "매달10만원", cv: c.cv });
  if (miss) {
    c = nbNew(); pg++; n++;
    nbTop(c, n, ["10년 동안 [[가장 좋은 10일]]을 놓쳤다면", "수익은 " + cPct(miss.all, 0) + " → [[" + cPct(miss.miss, 0) + "]].", "", "좋은 날은 대개 무서운 날 바로 옆에 있었다."], pg, total);
    nbBody(c, "S&P500 10년 — 시장에 머문 사람 vs 나갔다 온 사람", "거래일 " + miss.days + "일 중 10일만 빼도 결과가 이만큼 달라져요");
    nbBars(c, [{ l: "계속 들고 있음", v: miss.all, color: NB_C.navy }, { l: "최고 10일 놓침", v: miss.miss, color: NB_C.up }, { l: "최악 10일 피함", v: miss.missWorst, color: NB_C.gold2 }]);
    nbFoot(c, "SPY 종가 · 최악 10일을 '피하는' 것은 미리 알 수 없어 실제로는 불가능에 가까워요 · 투자 권유 아님"); out.push({ name: "좋은10일", cv: c.cv });
  }
  c = nbNew(); pg++; n++;
  var spy = nbStat("SPY"), ks = nbStat("069500.KS") || nbStat("^KS11");
  nbTop(c, n, ["적립식의 핵심은", "싸게 사는 기술이 아니라 [[멈추지 않는 것]].", "", "내려가 있으면 더 많이, 올라 있으면 덜 사게 돼 평균이 맞춰진다."], pg, total);
  nbBody(c, "지금 위치 — 이번 달 적립하는 분들께", "52주 고점 대비 · 20일선 · 한 달 등락");
  nbRows(c, [["SPY", "S&P500 ETF"], ["QQQ", "나스닥100 ETF"], ["360750.KS", "TIGER 미국S&P500"], ["069500.KS", "KODEX 200"], ["GLD", "금 ETF"], ["BTC-USD", "비트코인"]].map(function (a) { var s = nbStat(a[0]); return s ? [(s.above20 ? "20일선 위" : "20일선 아래") + " · 한 달 " + cPct(s.m1, 0), a[1], s.vsHi != null ? "고점比 " + cPct(s.vsHi, 0) : "-", s.vsHi != null && s.vsHi <= -0.1 ? NB_C.down : NB_C.navy] : null; }).filter(Boolean), 300);
  nbFoot(c); out.push({ name: "지금위치", cv: c.cv });
  pg++; out.push({ name: "마무리", cv: nbClose("여러분은 매달 어떤 걸 사고 계세요?", ["적립일을 정했다면 그대로.", "시장이 무서운 날일수록 규칙이 지켜 줘요."]) });
  return out;
}

/* ---------- ④ 뉴스 덱 ---------- */
var NB_NEWS_MAP = [[/삼성전자/, "005930.KS"], [/하이닉스/, "000660.KS"], [/반도체|HBM/, "000660.KS"], [/코스피/, "^KS11"], [/코스닥/, "^KQ11"], [/뉴욕증시|S&P|다우/, "^GSPC"], [/나스닥|기술주|빅테크/, "^IXIC"], [/엔비디아/, "NVDA"], [/테슬라/, "TSLA"], [/애플/, "AAPL"], [/환율|달러/, "KRW=X"], [/국채|장기채|금리/, "TLT"], [/유가|원유|WTI/, "USO"], [/금값|금 가격|골드/, "GLD"], [/비트코인|코인|가상자산/, "BTC-USD"], [/공포|VIX/, "^VIX"]];
function nbNewsDeck() {
  if (!storyReady("news")) return [];
  var items = CARD_NEWS.items.map(function (it) { var m = NB_NEWS_MAP.filter(function (p) { return p[0].test(it.title); })[0]; var s = m ? nbStat(m[1]) : null; return s ? { title: cNewsClean(it.title), sym: m[1], s: s, press: it.press } : null; }).filter(Boolean);
  var seen = {}; items = items.filter(function (x) { if (seen[x.sym]) return false; seen[x.sym] = 1; return true; }).slice(0, 8);
  if (items.length < 2) return [];
  var out = [], total = 3 + Math.ceil(items.length / 4), pg = 0, n = 0, c, date = cDate(Date.now());
  var big = items.slice().sort(function (a, b) { return Math.abs(b.s.ret1) - Math.abs(a.s.ret1); })[0];
  pg++; out.push({ name: "표지", cv: nbCover(date + " 아침", ["오늘 기사 제목과", "[[실제 숫자]]를 나란히 놓으면"], "기사는 이유를 말하고, 숫자는 크기를 말해요. " + items.length + "개 기사의 자산이 실제로 얼마나 움직였는지 종가로 확인했어요.") });
  for (var i = 0; i < items.length; i += 4) {
    c = nbNew(); pg++; n++; var chunk = items.slice(i, i + 4);
    var lead = chunk[0];
    nbTop(c, n, ["\"" + (lead.title.length > 26 ? lead.title.slice(0, 25) + "…" : lead.title) + "\"", "", "실제로는 [[" + nbName(lead.sym) + " " + cPct(lead.s.ret1) + "]] — 평소 하루 변동의 " + (lead.s.sd > 0 ? (Math.abs(lead.s.ret1) / lead.s.sd).toFixed(1) : "-") + "배."], pg, total);
    nbBody(c, "기사 제목 ↔ 그 자산의 전일 등락", "오른쪽 숫자는 전일 종가 등락 · 아래 회색은 고점 대비·20일선");
    nbNewsRows(c, chunk.map(function (x) { return { title: x.title, left: nbName(x.sym) + " · " + (x.press || "") + " · 고점比 " + cPct(x.s.vsHi, 0) + " · " + (x.s.above20 ? "20일선 위" : "20일선 아래"), right: cPct(x.s.ret1), color: cCol(x.s.ret1) }; }));
    nbFoot(c, "출처: 네이버 뉴스 검색(각 언론사) · 숫자는 야후 파이낸스 종가 · 투자 권유 아님"); out.push({ name: "기사vs숫자" + (n), cv: c.cv });
  }
  c = nbNew(); pg++; n++;
  nbTop(c, n, ["오늘 기사 중 숫자가 가장 컸던 건", "[[" + nbName(big.sym) + " " + cPct(big.s.ret1) + "]].", "", "제목의 크기와 숫자의 크기는 다를 때가 많다."], pg, total);
  nbBody(c, "기사 자산들의 실제 움직임", "전일 등락 크기 순");
  nbBars(c, items.slice().sort(function (a, b) { return Math.abs(b.s.ret1) - Math.abs(a.s.ret1); }).slice(0, 5).map(function (x, k) { return { l: nbName(x.sym), v: x.s.ret1, color: x.s.ret1 >= 0 ? (k === 0 ? NB_C.up : NB_C.navy) : NB_C.down }; }));
  nbFoot(c); out.push({ name: "크기순", cv: c.cv });
  pg++; out.push({ name: "마무리", cv: nbClose("기사를 읽은 뒤엔 숫자를 한 번 확인해 보세요.", ["제목이 큰 날일수록", "실제 숫자는 생각보다 작을 때가 많아요."]) });
  return out;
}

/* ---------- ⑤ 오늘의 관찰 (매일 구성이 바뀌는 덱 · v8.8) ----------
   모듈 풀에서 '오늘 얼마나 이례적인가' 점수로 5~6개를 골라 점수 순으로 엮는다. 모듈마다 시각 틀이 다르고(숫자 타일·막대·목록·카드·체크·표·타임라인),
   문장은 모듈마다 2~3가지 변주 중 날짜(seed)와 데이터 조건으로 고른다. → 같은 날은 같은 덱, 다른 날은 다른 구성. */
function nbPick(arr, seed) { return arr[((seed % arr.length) + arr.length) % arr.length]; }
function nbTodayDeck() {
  var recent = nbRecent(); if (!recent) return [];
  var R = typeof briefState !== "undefined" && briefState.result ? briefState.result : briefCompute(recent, {});
  var seed = nbSeed(), now = nbNow(), mods = [], st = nbStat, date = cDate(R.asOf || Date.now());
  function z(s) { return s && s.sd > 0 ? Math.abs(s.ret1) / s.sd : 0; }
  var spy = st("SPY"), ks = st("^KS11"), vix = st("^VIX"), tlt = st("TLT"), krw = st("KRW=X"), uso = st("USO"), gld = st("GLD"), btc = st("BTC-USD");
  /* 1. 오늘 가장 크게 움직인 자산 셋 (타일) */
  var macro = [["^GSPC", "S&P500"], ["^KS11", "코스피"], ["^VIX", "공포지수"], ["TLT", "미국 장기채"], ["KRW=X", "달러/원"], ["USO", "원유"], ["GLD", "금"], ["BTC-USD", "비트코인"]].map(function (a) { var x = st(a[0]); return x ? { sym: a[0], name: a[1], s: x, z: z(x) } : null; }).filter(Boolean).sort(function (a, b) { return b.z - a.z; });
  if (macro.length >= 3) mods.push({ score: macro[0].z, key: "macro", draw: function (c, n, pg, total) {
    var m = macro.slice(0, 3), lead = m[0];
    nbTop(c, n, nbPick([["오늘 가장 크게 움직인 건", "[[" + lead.name + " " + cPct(lead.s.ret1) + "]] — 평소 하루의 " + lead.z.toFixed(1) + "배.", "", "나머지 둘도 평소보다 컸다."], ["[[" + lead.name + "]]이 " + cPct(lead.s.ret1) + ".", "이 정도 움직임은 최근 90일 중 상위 " + Math.round((1 - (lead.s.pctRank || 0.5)) * 100) + "% 안이다.", "", "오늘은 이 숫자부터 본다."], ["뉴스보다 먼저 보는 숫자 셋.", "", "[[" + m.map(function (x) { return x.name + " " + cPct(x.s.ret1); }).join(" · ") + "]]"]], seed), pg, total);
    nbBody(c, "오늘 평소와 가장 달랐던 숫자", date + " 종가 · 전일 대비 · 아래 작은 글씨는 평소 하루 변동 대비 배수");
    nbTiles(c, m.map(function (x) { return { v: x.sym === "^VIX" ? x.s.last.toFixed(1) : cPct(x.s.ret1), l: x.name + " · 평소의 " + x.z.toFixed(1) + "배", color: x.sym === "^VIX" ? (x.s.last >= 25 ? NB_C.up : NB_C.navy) : cCol(x.s.ret1) }; }));
    nbGoldLine(c, now.why.length ? now.why[0] : "두드러진 국면 신호 없음 — 평소 구간", "장기채↑=금리 하락 · VIX 25↑=공포 · 고점 대비 -10%=조정");
    nbFoot(c);
  } });
  /* 2. 급등 1위 종목 해부 (막대: 1일·1주·1달·3달) */
  var up = R.movers && R.movers.up[0], dn = R.movers && R.movers.down[0];
  var lead2 = up && dn ? (Math.abs(up.ret1) >= Math.abs(dn.ret1) ? up : dn) : up || dn;
  if (lead2) mods.push({ score: z(lead2) * 0.9, key: "mover", draw: function (c, n, pg, total) {
    var nm = briefName(lead2), isUp = lead2.ret1 >= 0;
    nbTop(c, n, nbPick([["오늘 " + (isUp ? "가장 많이 오른" : "가장 많이 내린") + " 종목은", "[[" + nm + " " + cPct(lead2.ret1) + "]].", "", "하루 숫자보다 [[어디서 왔는지]]를 본다 — 1주·1달·3달."], ["[[" + nm + "]] " + cPct(lead2.ret1) + ".", "", "고점 대비 " + cPct(lead2.vsHi, 0) + ", 20일선 " + (lead2.above20 ? "위" : "아래") + ".", (isUp ? "오른 날엔 '얼마나 올라와 있나'" : "내린 날엔 '얼마나 내려와 있나'") + "부터."]], seed + 1), pg, total);
    nbBody(c, nm + " — 하루가 아니라 흐름으로", "오늘 · 1주 · 1달 · 3달 등락 · 지금 " + cPrice(lead2.sym, lead2.last));
    nbBars(c, [{ l: "오늘", v: lead2.ret1, color: cCol(lead2.ret1) }, { l: "1주", v: lead2.ret5 || 0, color: NB_C.navy }, { l: "1달", v: lead2.m1, color: NB_C.navy }, { l: "3달", v: lead2.m3, color: NB_C.teal }, { l: "52주 고점比", v: lead2.vsHi || 0, color: NB_C.grey }]);
    nbFoot(c, "종가 기준 · 특정 종목 언급은 사실 전달이며 추천 아님");
  } });
  /* 3. 시장 온도 — 오른 종목 비율 vs 지수 (타일 2 + 골드라인) */
  var t = R.temp, idx = R.indexRow && R.indexRow[0];
  if (t) mods.push({ score: Math.abs(t.upPct - 0.5) * 6, key: "temp", draw: function (c, n, pg, total) {
    var diverge = idx && ((idx.ret > 0 && t.upPct < 0.45) || (idx.ret < 0 && t.upPct > 0.55));
    nbTop(c, n, diverge ? ["지수는 " + cPct(idx.ret) + "인데", "오른 종목은 [[" + Math.round(t.upPct * 100) + "%]]뿐.", "", "몇 개 큰 종목이 지수를 끌었다. 내 종목이 안 오른 게 이상한 날이 아니다."] : nbPick([["오늘 오른 종목 [[" + Math.round(t.upPct * 100) + "%]].", "", t.upPct >= 0.6 ? "넓게 오른 날 — 지수와 체감이 같은 날." : t.upPct <= 0.4 ? "넓게 내린 날 — 개별 악재보다 시장 전체." : "반반 — 종목마다 다른 날."], ["열 종목 중 [[" + Math.round(t.upPct * 10) + "개]]가 올랐다.", "", "20일선 위 종목은 " + Math.round(t.abovePct * 100) + "% — 추세는 " + (t.abovePct >= 0.5 ? "아직 위쪽" : "아직 아래쪽") + "."]], seed + 2), pg, total);
    nbBody(c, "시장 온도 — 지수 뒤의 종목들", t.total + "개 집계 · 오른 종목 비율 · 20일선 위 비율");
    nbTiles(c, [{ v: Math.round(t.upPct * 100) + "%", l: "오른 종목 비율 (" + t.up + "/" + t.total + ")", color: t.upPct >= 0.5 ? NB_C.up : NB_C.down }, { v: Math.round(t.abovePct * 100) + "%", l: "20일선 위 종목" }, { v: idx ? cPct(idx.ret) : "-", l: (idx ? idx.name : "지수") + " 등락", color: idx ? cCol(idx.ret) : null }]);
    nbGoldLine(c, "열 종목 중 " + Math.round(t.upPct * 10) + "개 상승 · " + Math.round(t.abovePct * 10) + "개 추세 위", "지수와 비율이 어긋나는 날은 큰 종목 몇 개의 날이에요");
    nbFoot(c);
  } });
  /* 4. 테마 — 1등 vs 꼴찌 (막대 5) */
  var th = R.themes || [];
  if (th.length >= 4) mods.push({ score: Math.abs(th[0].ret - th[th.length - 1].ret) * 40, key: "theme", draw: function (c, n, pg, total) {
    var a = th[0], b = th[th.length - 1];
    nbTop(c, n, nbPick([["오늘 돈은 [[" + a.name + "]]로 갔고", b.name + "에서 나왔다.", "", "차이 " + cPct(a.ret - b.ret) + "p — 같은 시장, 다른 하루."], ["[[" + a.name + " " + cPct(a.ret) + "]] vs " + b.name + " " + cPct(b.ret) + ".", "", "업종 1등엔 " + briefName(a.best) + " " + cPct(a.best.ret) + "이 있었다."]], seed + 3), pg, total);
    nbBody(c, "업종 흐름 — 위 둘, 아래 둘, 그리고 가운데", "업종 평균 등락 · 오른 종목 수");
    var pick = [th[0], th[1], th[Math.floor(th.length / 2)], th[th.length - 2], th[th.length - 1]];
    nbBars(c, pick.map(function (x, i) { return { l: x.name, v: x.ret, color: i === 0 ? NB_C.up : i === 4 ? NB_C.down : NB_C.navy, txt: cPct(x.ret) }; }));
    nbFoot(c);
  } });
  /* 5. 낙폭 — 대표 자산 중 -10% 아래 (목록) */
  var dds = NB_DD_SYMS.map(nbDd).filter(Boolean).sort(function (a, b) { return a.cur - b.cur; });
  if (dds.length >= 3 && dds[0].cur <= -0.08) mods.push({ score: Math.abs(dds[0].cur) * 8, key: "dd", draw: function (c, n, pg, total) {
    var d = dds[0];
    nbTop(c, n, nbPick([["[[" + d.name + "]]은 전고점을", "못 넘은 지 [[" + nbMonths(d.sincePeak) + "]]째.", "", d.medSim != null ? "비슷한 깊이의 과거 " + d.simN + "번은 고점까지 보통 " + nbMonths(d.medSim) + " 걸렸다." : "이만큼 빠졌다 회복한 전례가 아직 없다."], ["고점 대비 [[" + cPct(d.cur, 0) + "]] — " + d.name + ".", "", "지난 " + Math.round(d.years) + "년 중 이보다 깊었던 적 " + d.deeper + "번. " + (d.deeper ? "모두 끝이 있었다." : "처음이다.")]], seed + 4), pg, total);
    nbBody(c, "대표 자산의 고점 대비 위치", "역대 최고가 대비 · 최고가 이후 기간 · 비슷한 깊이의 과거 회복(중앙값)");
    nbRows(c, dds.map(function (x) { return ["최고가 후 " + nbMonths(x.sincePeak) + (x.medSim != null ? " · 과거 회복 " + nbMonths(x.medSim) : ""), x.name, cPct(x.cur, 0), x.cur <= -0.1 ? NB_C.up : NB_C.navy]; }), 340);
    nbFoot(c);
  } });
  /* 6. 신고가 / 세일 (체크 2×2) */
  var nums = R.numbers || [], sale = nums[0], ath = nums[1];
  if (sale && ath) mods.push({ score: ((ath.list || []).length >= 8 ? 2.5 : 0) + ((sale.list || []).length / Math.max(1, R.count) > 0.5 ? 2.5 : 1), key: "numbers", draw: function (c, n, pg, total) {
    var athN = (ath.list || []).length, saleN = (sale.list || []).length;
    nbTop(c, n, athN >= 8 ? ["신고가 근처 종목이 [[" + athN + "개]].", "", "신고가가 늘어나는 날은 시장이 넓게 강한 날이 많았다. '너무 올랐다'는 말도 같이 늘어난다."] : ["세일 중인 종목 [[" + saleN + "개]] / " + R.count + ".", "", "52주 고점보다 20% 넘게 싼 종목이 " + Math.round(saleN / Math.max(1, R.count) * 100) + "%. 싸다는 사실과 바닥은 다르다."], pg, total);
    nbBody(c, "숫자 넷으로 보는 시장 위치", "세일 중 · 신고가 근처 · 20일선 위 · 공포지수");
    var lbl = ["세일 중 (고점 -20%↓)", "신고가 근처", "20일선 위 비율", "공포지수 VIX"], four = nums.slice(0, 4);
    while (four.length < 4) four.push({ v: vix ? vix.last.toFixed(1) : "-", l: "VIX" });
    nbChecks(c, four.map(function (x, i) { return { t: lbl[i], s: x.v + (i === 0 ? " — 싸졌다는 사실" : i === 1 ? " — 강한 종목들" : i === 2 ? " — 추세 위" : (vix && vix.last < 20 ? " — 평온" : vix && vix.last < 25 ? " — 불안" : " — 공포")), ok: i === 1 ? athN >= 5 : i === 2 ? !!(t && t.abovePct >= 0.5) : i === 3 ? !!(vix && vix.last < 20) : saleN / Math.max(1, R.count) < 0.4 }; }));
    nbFoot(c);
  } });
  /* 7. 역사 속 이번 주 (타임라인 목록) */
  var kst = new Date(Date.now() + 9 * 3600e3), md = kst.getUTCMonth() * 100 + kst.getUTCDate();
  var evs = (typeof EVENTS !== "undefined" ? EVENTS : []).filter(function (e) { var d = new Date(e.ts + 9 * 3600e3), m = d.getUTCMonth() * 100 + d.getUTCDate(); return Math.abs(m - md) <= 10; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 6);
  if (evs.length >= 2 && nbHist.SPY) mods.push({ score: 1.6 + (seed % 3) * 0.3, key: "history", draw: function (c, n, pg, total) {
    var rows = evs.map(function (e) { var r = nbHist.SPY, i = cAt(r, e.ts), j = cAt(r, e.ts + 365 * 86400e3); var f = r[i] && r[j] && j < r.length - 1 ? r[j].c / r[i].c - 1 : null; return { y: new Date(e.ts).getFullYear(), name: e.name, type: e.type, f: f }; });
    var ok = rows.filter(function (x) { return x.f != null; }), upN = ok.filter(function (x) { return x.f > 0; }).length;
    nbTop(c, n, nbPick([["이번 주 즈음, 과거엔 이런 일이 있었다.", "", ok.length ? "그 뒤 1년, S&P500은 " + ok.length + "번 중 [[" + upN + "번]] 올라 있었다." : "그때도 세상이 끝날 것 같았다."], ["[[" + rows[0].y + "년 " + rows[0].name + "]].", "", "그 날짜가 돌아왔다. " + (rows[0].f != null ? "그 뒤 1년 S&P500은 " + cPct(rows[0].f, 0) + "." : "")]], seed + 5), pg, total);
    nbBody(c, "역사 속 이번 주", "±10일 안의 과거 사건 · 오른쪽은 사건 1년 뒤 S&P500");
    nbRows(c, rows.map(function (x) { return [x.y + " · " + x.type, x.name, x.f != null ? cPct(x.f, 0) : "–", x.f != null ? cCol(x.f) : NB_C.grey]; }), 190);
    nbFoot(c, "StockMind 사건 기록 · SPY 종가 · 과거 자료이며 투자 권유 아님");
  } });
  /* 8. 계절성 — 이달 (막대) */
  var mo = kst.getUTCMonth() + 1, seas = [["SPY", "S&P500"], ["^KS11", "코스피"], ["QQQ", "나스닥100"], ["GLD", "금"], ["BTC-USD", "비트코인"]].map(function (a) { if (!perState) return null; perState.hist[a[0]] = perState.hist[a[0]] || nbHist[a[0]]; var x = typeof perSeason === "function" ? perSeason(a[0], mo) : null; return x ? Object.assign({ name: a[1] }, x) : null; }).filter(Boolean);
  if (seas.length >= 3 && kst.getUTCDate() <= 12) mods.push({ score: 1.4, key: "season", draw: function (c, n, pg, total) {
    var s0 = seas[0];
    nbTop(c, n, ["과거 " + s0.n + "번의 " + mo + "월, S&P500은 [[" + s0.up + "번]] 올랐다.", "", "평균 " + cPct(s0.avg, 1) + " — 최고 " + s0.best.y + "년 " + cPct(s0.best.r, 0) + ", 최저 " + s0.worst.y + "년 " + cPct(s0.worst.r, 0) + ". 계절은 확률이지 약속이 아니다."], pg, total);
    nbBody(c, mo + "월은 과거에 어땠나", "지난 " + s0.n + "년 같은 달 평균 등락 · 막대 위 숫자는 오른 해 / 전체");
    nbBars(c, seas.map(function (x) { return { l: x.name, v: x.avg, color: x.avg >= 0 ? NB_C.navy : NB_C.grey, txt: cPct(x.avg, 1) + " · " + x.up + "/" + x.n }; }));
    nbFoot(c, "월말 종가 기준 · 과거 자료이며 투자 권유 아님");
  } });
  /* 9. 뉴스 vs 숫자 (목록) */
  if (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items.length) {
    var items = CARD_NEWS.items.map(function (it) { var m = NB_NEWS_MAP.filter(function (p) { return p[0].test(it.title); })[0]; var x = m ? st(m[1]) : null; return x ? { title: cNewsClean(it.title), sym: m[1], s: x, press: it.press } : null; }).filter(Boolean);
    var seen = {}; items = items.filter(function (x) { if (seen[x.sym]) return false; seen[x.sym] = 1; return true; }).slice(0, 4);
    if (items.length >= 2) mods.push({ score: 1.2 + Math.max.apply(null, items.map(function (x) { return z(x.s); })) * 0.5, key: "news", draw: function (c, n, pg, total) {
      var big = items.slice().sort(function (a, b) { return Math.abs(b.s.ret1) - Math.abs(a.s.ret1); })[0];
      nbTop(c, n, nbPick([["오늘 아침 기사 " + items.length + "개의 자산 중", "숫자가 가장 컸던 건 [[" + nbName(big.sym) + " " + cPct(big.s.ret1) + "]].", "", "기사는 이유를 말하고, 숫자는 크기를 말한다."], ["\"" + (items[0].title.length > 24 ? items[0].title.slice(0, 23) + "…" : items[0].title) + "\"", "", "실제 숫자: [[" + nbName(items[0].sym) + " " + cPct(items[0].s.ret1) + "]]. 제목의 크기와 숫자의 크기는 다를 때가 많다."]], seed + 6), pg, total);
      nbBody(c, "기사 제목 ↔ 그 자산의 전일 등락", "오른쪽은 전일 종가 등락 · 아래는 고점 대비·20일선");
      nbNewsRows(c, items.map(function (x) { return { title: x.title, left: nbName(x.sym) + " · " + (x.press || "") + " · 고점比 " + cPct(x.s.vsHi, 0) + " · " + (x.s.above20 ? "20일선 위" : "20일선 아래"), right: cPct(x.s.ret1), color: cCol(x.s.ret1) }; }));
      nbFoot(c, "출처: 네이버 뉴스 검색(각 언론사) · 숫자는 야후 파이낸스 종가 · 투자 권유 아님");
    } });
  }
  /* 10. 환율 효과 — 원화로 본 미국 주식 (타일) */
  if (spy && krw && Math.abs(krw.m1) >= 0.015) mods.push({ score: Math.abs(krw.m1) * 60, key: "fx", draw: function (c, n, pg, total) {
    var won = (1 + spy.m1) * (1 + krw.m1) - 1;
    nbTop(c, n, ["한 달 동안 S&P500은 " + cPct(spy.m1) + ",", "원화로 보면 [[" + cPct(won) + "]].", "", "달러/원 " + cPct(krw.m1) + "이 " + (krw.m1 > 0 ? "손실을 줄여" : "수익을 깎아") + " 줬다. 원화 투자자는 환율을 같이 든다."], pg, total);
    nbBody(c, "같은 ETF, 다른 체감 — 환율 효과", "최근 1개월 · 달러 기준 vs 원화 환산");
    nbTiles(c, [{ v: cPct(spy.m1), l: "S&P500 (달러)", color: cCol(spy.m1) }, { v: cPct(krw.m1), l: "달러/원 환율", color: cCol(krw.m1) }, { v: cPct(won), l: "원화로 본 S&P500", color: cCol(won) }]);
    nbGoldLine(c, krw.m1 > 0 ? "달러 강세 = 미국 자산의 자연 헷지" : "달러 약세 = 원화 자산이 상대적으로 유리", "환율은 길게 보면 왕복하지만, 한 달 단위론 수익률을 좌우해요");
    nbFoot(c);
  } });
  /* 11. 돈이 몰린 곳 (목록) */
  var hot = (R.hotVol || []).slice(0, 5);
  if (hot.length >= 3) mods.push({ score: (hot[0].amtX || 1) * 0.6, key: "money", draw: function (c, n, pg, total) {
    nbTop(c, n, nbPick([["오늘 돈이 몰린 곳은 [[" + briefName(hot[0]) + "]].", "거래대금이 평소의 " + (hot[0].amtX || 0).toFixed(1) + "배.", "", "관심이 쏠린 곳은 방향이 아니라 변동이 커진다."], ["거래대금 평소의 [[" + (hot[0].amtX || 0).toFixed(1) + "배]] — " + briefName(hot[0]) + ".", "", "몰린 돈은 며칠 뒤 되돌림도 큰 편이었다. 관찰 목록에만."]], seed + 7), pg, total);
    nbBody(c, "거래대금이 평소보다 급증한 종목", "20일 평균 대비 배수 · 오늘 등락");
    nbRows(c, hot.map(function (x) { return ["평소의 " + (x.amtX || 0).toFixed(1) + "배 · " + cPrice(x.sym, x.last), briefName(x), cPct(x.ret1), cCol(x.ret1)]; }), 300);
    nbFoot(c, "거래대금 기준 · 특정 종목 언급은 사실 전달이며 추천 아님");
  } });
  /* 12. 적립 체크 (표) */
  mods.push({ score: 1.0 + (kst.getUTCDay() === 1 ? 1.5 : 0), key: "dca", draw: function (c, n, pg, total) {
    var list = [["SPY", "S&P500 ETF"], ["QQQ", "나스닥100 ETF"], ["360750.KS", "TIGER 미국S&P500"], ["069500.KS", "KODEX 200"], ["GLD", "금 ETF"]].map(function (a) { var x = st(a[0]); return x ? { name: a[1], s: x } : null; }).filter(Boolean);
    var cheap = list.filter(function (x) { return x.s.vsHi != null && x.s.vsHi <= -0.1; }).length;
    nbTop(c, n, nbPick([["이번 주 적립하는 분들께.", "", "대표 ETF " + list.length + "개 중 [[" + cheap + "개]]가 고점보다 10% 넘게 싸다. 싸면 같은 돈으로 더 많이 사게 된다 — 그게 적립식이다."], ["적립일이 정해져 있다면", "오늘 숫자는 [[참고만]].", "", "내려가 있으면 더 많이, 올라 있으면 덜 사게 돼 평균이 맞춰진다."]], seed + 8), pg, total);
    nbBody(c, "대표 ETF의 지금 위치", "52주 고점 대비 · 20일선 · 한 달 등락");
    nbTable(c, list.map(function (x) { return [x.name, "고점比 " + cPct(x.s.vsHi, 0) + " · " + (x.s.above20 ? "20일선 위" : "20일선 아래") + " · 한 달 " + cPct(x.s.m1, 0), cPrice(x.name.indexOf("TIGER") >= 0 || x.name.indexOf("KODEX") >= 0 ? "069500.KS" : "SPY", x.s.last), x.s.vsHi != null && x.s.vsHi <= -0.1 ? NB_C.down : NB_C.navy]; }));
    nbFoot(c);
  } });
  // 고르기: 점수 순 상위 6 (같은 성격 중복 방지는 키가 다르므로 자동) — 요일별로 하나는 고정 변주
  mods.sort(function (a, b) { return b.score - a.score; });
  var chosen = mods.slice(0, 6);
  if (!chosen.length) return [];
  var total = chosen.length + 2, pg = 0, n = 0, out = [];
  var leadMod = chosen[0], covers = [["오늘 가장 이례적인 것부터", ["오늘 시장에서", "[[평소와 달랐던]] " + chosen.length + "가지"], "순서는 '얼마나 이례적인가'로 매일 새로 정해져요. 1번이 오늘의 주인공."], ["숫자가 먼저, 해석은 나중", ["[[" + date + "]]", "데이터가 고른 오늘의 관찰 " + chosen.length + "개"], "큰 뉴스와 큰 숫자는 다를 때가 많아요. 오늘은 숫자부터."], ["매일 다른 질문", ["오늘은 [[" + { macro: "지수와 금리", mover: "한 종목", temp: "시장 온도", theme: "업종", dd: "낙폭", numbers: "위치", history: "역사", season: "계절", news: "뉴스", fx: "환율", money: "거래대금", dca: "적립" }[leadMod.key] + "]]부터", "본다."], "오늘 데이터에서 가장 눈에 띈 것을 1번으로 올렸어요."]];
  var cv = nbPick(covers, seed);
  pg++; out.push({ name: "표지", cv: nbCover(cv[0], cv[1], cv[2]) });
  chosen.forEach(function (m) { var c = nbNew(); pg++; n++; try { m.draw(c, n, pg, total); } catch (e) { console.warn(m.key, e); return; } out.push({ name: m.key, cv: c.cv }); });
  var closes = [["오늘 숫자 중 어떤 게 가장 눈에 들어오셨나요?", ["내일 아침, 다른 순서로 다시 올게요."]], ["지수가 아니라 비율을, 제목이 아니라 숫자를.", ["매일 아침 같은 시간,", "다른 관찰로 찾아와요."]], ["오늘의 1번이 내일도 1번일까요?", ["그날 가장 이례적인 것이", "늘 1번이 돼요."]]];
  var cl = nbPick(closes, seed + 3);
  pg++; out.push({ name: "마무리", cv: nbClose(cl[0], cl[1]) });
  return out;
}

/* ---------- 캡션 ---------- */
function storyCaption(key) {
  var kind = key.split(":")[0], lines = [], now = nbNow(), tags = ["자산배분", "투자공부"];
  if (kind === "scene") {
    var main = chState.scen.filter(function (s) { return s.id === key.split(":")[1]; })[0] || chState.scen[0];
    lines.push((now.match[main.id] && now.why.length ? "지금은 " + now.why[0].split("→").pop().trim() : main.tag + "이 오면") + " — 과거엔 무엇이 강했을까요?"); lines.push("");
    lines.push("🔎 지금 신호: " + (now.why.length ? now.why.join(" / ") : "두드러진 신호 없음")); lines.push("📚 비교한 과거: " + main.tag + " 국면 " + main.eps.map(function (e) { return e.s.slice(0, 4); }).join("·") + "년"); lines.push("");
    main.eps.slice(0, 3).forEach(function (e) { var r = e.st.filter(function (x) { return x.fwd != null && x.sym !== "KRW=X"; }).sort(function (a, b) { return b.fwd - a.fwd; })[0]; if (r) lines.push("· " + e.name + " 뒤 1년 → 가장 강했던 자산 " + nbName(r.sym) + " " + cPct(r.fwd, 0)); });
    lines.push(""); lines.push("정해진 승자는 없었어요. 그래서 '예측' 대신 '조건'을 봅니다 — 장기금리·공포지수·추세·달러."); lines.push(""); lines.push("지금은 어떤 구간이라고 보시나요?"); tags = tags.concat(["금리", "유가", "ETF투자"]);
  } else if (kind === "drawdown") {
    var rows = chState.mdd.filter(function (x) { return !x.err; }).sort(function (a, b) { return a.cur - b.cur; });
    lines.push("지금 고점 대비 얼마나 빠졌을까요? 과거엔 몇 번, 얼마 만에 회복했을까요?"); lines.push("");
    rows.slice(0, 5).forEach(function (x) { lines.push("· " + x.name + " 고점比 " + cPct(x.cur, 0) + " · -10%↑ 하락 " + x.eps + "번 · 최악 " + cPct(x.worst, 0) + (x.medRec != null ? " · 보통 " + Math.round(x.medRec / 30) + "개월 만에 회복" : "")); });
    lines.push(""); lines.push("하락장에서 어려운 건 '얼마나'가 아니라 '언제까지'예요. 내가 견딜 수 있는 낙폭이 곧 내 주식 비중의 상한이에요."); tags = tags.concat(["하락장", "MDD", "멘탈관리"]);
  } else if (kind === "dca") {
    var ya = cYearAgo("all"), d = cDca("all");
    lines.push("적금처럼 샀다면 " + (d ? d.years + "년 뒤 얼마가 됐을까요?" : "")); lines.push("");
    if (d) d.rows.slice(0, 4).forEach(function (x) { lines.push("· 매달 10만원 → " + x.name + " " + cMan(x.val) + " (" + (x.val / x.principal).toFixed(1) + "배)"); });
    if (ya.length) { lines.push(""); lines.push("1년 전 100만원 → " + ya.slice(0, 3).map(function (x) { return x.name + " " + cMan(x.val); }).join(" · ")); }
    lines.push(""); lines.push("적립식의 핵심은 싸게 사는 기술이 아니라 멈추지 않는 것. 여러분은 매달 어떤 걸 사고 계세요?"); tags = tags.concat(["적립식", "ETF적립", "S&P500"]);
  } else if (kind === "today") {
    var R2 = typeof briefState !== "undefined" && briefState.result ? briefState.result : null;
    lines.push("오늘 시장에서 평소와 달랐던 것들 — 순서는 데이터가 정했어요."); lines.push("");
    if (now.why.length) lines.push("🧭 " + now.why.join(" / "));
    if (R2) { lines.push("🌡️ 오른 종목 " + Math.round(R2.temp.upPct * 100) + "% · 20일선 위 " + Math.round(R2.temp.abovePct * 100) + "%"); if (R2.themes && R2.themes.length) lines.push("🔥 업종 1등 " + R2.themes[0].name + " " + cPct(R2.themes[0].ret) + " · 꼴찌 " + R2.themes[R2.themes.length - 1].name + " " + cPct(R2.themes[R2.themes.length - 1].ret)); if (R2.movers && R2.movers.up[0]) lines.push("🚀 " + briefName(R2.movers.up[0]) + " " + cPct(R2.movers.up[0].ret1) + " · 📉 " + briefName(R2.movers.down[0]) + " " + cPct(R2.movers.down[0].ret1)); }
    lines.push(""); lines.push("오늘 숫자 중 어떤 게 가장 눈에 들어오셨나요?"); tags = tags.concat(["오늘의시장", "주식시황", "데이터로보는시장"]);
  } else {
    lines.push("오늘 아침 기사 제목과 실제 숫자를 나란히 놓아 봤어요."); lines.push("");
    CARD_NEWS.items.slice(0, 5).forEach(function (it) { var m = NB_NEWS_MAP.filter(function (p) { return p[0].test(it.title); })[0], s = m ? nbStat(m[1]) : null; lines.push("· " + cNewsClean(it.title) + (s ? " → " + nbName(m[1]) + " " + cPct(s.ret1) : "")); });
    lines.push(""); lines.push("기사는 이유를 말하고, 숫자는 크기를 말해요. 제목이 큰 날일수록 숫자는 생각보다 작을 때가 많아요."); tags = tags.concat(["경제뉴스", "증시", "주식뉴스"]);
  }
  var tg = PUB_TAGS_BASE.concat(tags).map(function (x) { return "#" + x; }).join(" ");
  var ig = lines.join("\n") + "\n\n※ 과거 데이터(야후 파이낸스 종가) 자동 집계 · 예시 구성은 손실을 막아주지 않으며 투자 권유 아님" + "\n\n" + tg;
  var th = lines.slice(0, 8).join("\n") + "\n\n(과거 자료 · 투자 권유 아님)"; if (th.length > 500) th = th.slice(0, 490) + "…";
  return { ig: ig, th: th, igLen: ig.length, thLen: th.length };
}

/* ---------- 열기 ---------- */
function storyOpen(key) {
  key = key || "scene:" + ((nbNow().match && Object.keys(nbNow().match)[0]) || "none");
  var deck = storyDecks().filter(function (d) { return d.key === key; })[0] || { t: "연구노트" };
  var btn = document.querySelector('[data-story="' + key + '"]'), old = btn ? btn.textContent : ""; if (btn) btn.textContent = "만드는 중…";
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return storyPrepare(key); }).then(function () {
    if (!storyReady(key.split(":")[0])) { if (btn) btn.textContent = old; alert("이 덱에 필요한 데이터가 아직 준비되지 않았어요. 채널 페이지 계산이 끝난 뒤 다시 눌러 주세요."); return; }
    CARD_TXT = ""; try { storyCards(key); } catch (e) { console.warn(e); }
    if (!document.fonts || !document.fonts.load) return true;
    var txt = CARD_TXT.replace(/\s+/g, "");
    return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })).then(function () { return true; });
  }).then(function (go) {
    if (!go) return;
    if (btn) btn.textContent = old;
    var list; try { list = storyCards(key); } catch (e) { console.warn(e); list = []; }
    if (!list.length) { alert("아직 데이터가 준비되지 않았어요. (뉴스 덱은 기사 제목에서 자산을 2개 이상 찾아야 만들어져요)"); return; }
    var cap = storyCaption(key), day = pubToday().replace(/-/g, ""), box = document.createElement("div"), slug = deck.t.replace(/[^가-힣A-Za-z0-9]/g, "").slice(0, 12);
    box.innerHTML = '<div class="briefDim" style="margin-bottom:8px">위 검정 = 결론 먼저, 아래 밝은 패널 = 근거. 추천·예측 문장은 없고 "과거엔 이랬다 · 지금 위치 · 무엇을 볼지"까지만 담았어요.</div>' +
      '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button>' + (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유</button>' : '') + '</div>' + thrPanelHtml(key === "dca" ? "재테크" : "주식") + '<div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    list.forEach(function (it, i) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_연구노트_" + slug + "_" + day + "_" + (i + 1) + "_" + it.name + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + '. ' + it.name + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
    box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
    try { thrBind(box, thrOr(thrStory(key, list.map(function (it) { return it.name; })), cap)); } catch (e) { console.warn(e); }
    var sh = box.querySelector('[data-act="share"]');
    if (sh) sh.onclick = function () { Promise.all(list.map(function (it) { return new Promise(function (ok) { it.cv.toBlob(function (b) { ok(new File([b], it.file, { type: "image/png" })); }, "image/png"); }); })).then(function (files) { if (navigator.canShare({ files: files })) return navigator.share({ files: files }); }).catch(function () {}); };
    infoModal.open("📓 " + deck.t + " · " + list.length + "장", box);
  });
}
