/* ============================================================
   카드 뉴스 (v7.0) — 우상향연구소(@uphill.lab) 인스타·스레드용 1080×1350(4:5)
   디자인: 계정 브랜드인 블랙 & 골드. 모든 카드가 같은 틀(로고·꼬리표·제목·바닥)이라 피드에 쌓이면 한 세트로 보인다.
   인스타 프로필 격자는 4:5 게시물을 3:4로 잘라 보여주므로(좌우 약 34px) 글자는 좌우 96px 안쪽에만 둔다.
   한 장에 메시지 하나: 큰 제목이 "이 카드가 말하려는 것", 금색 글씨가 핵심 숫자.
   ============================================================ */
var CARD = { W: 1080, H: 1350, PAD: 96 };
var CARD_C = {
  bg: "#0c0c0e", bg2: "#16151a", txt: "#f4f1ea", txt2: "#b9b3a8", sub: "#7d786f", line: "rgba(255,255,255,0.09)",
  up: "#ff5f5f", down: "#5b9bff", gold: "#d6b464", gold2: "#f1dca2", goldDim: "rgba(214,180,100,0.16)",
  soft: "rgba(255,255,255,0.07)", tile: "rgba(255,255,255,0.045)"
};
CARD_C.accent = CARD_C.gold; CARD_C.warmTxt = CARD_C.gold; CARD_C.warm = CARD_C.goldDim;
var CARD_FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
var CARD_TXT = "";   // 그린 글자 모음 — 웹폰트가 필요한 글자만 내려받으므로, 한 번 그려 글자를 모은 뒤 폰트를 받고 다시 그린다

function cPct(x, d) { if (x == null || !isFinite(x)) return "-"; d = d == null ? 1 : d; return (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%"; }
function cCol(x) { return x > 0 ? CARD_C.up : x < 0 ? CARD_C.down : CARD_C.sub; }
function cDate(ms) { var d = new Date(ms || Date.now()); return (d.getMonth() + 1) + "." + d.getDate() + "(" + "일월화수목금토"[d.getDay()] + ")"; }
function cMan(v) {   // 원 → "3,120만원" / "1.24억원"
  if (v == null || !isFinite(v)) return "-";
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(v >= 1e9 ? 1 : 2).replace(/\.?0+$/, "") + "억원";
  return Math.round(v / 1e4).toLocaleString("en-US") + "만원";
}
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
function cNm(sym) { return typeof chName === "function" ? chName(sym) : sym; }

/* ---------- 그리기 도구 ---------- */
var CARD_SNS = "@uphill.lab";
function cRound(g, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, h / 2, w / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
}
function cFont(g, size, weight) { g.font = (weight || 400) + " " + size + "px " + CARD_FONT; }
function cW(g, s, size, weight) { cFont(g, size, weight); return g.measureText(s).width; }
function cText(g, s, x, y, size, weight, color, align) { s = String(s); CARD_TXT += s; cFont(g, size, weight); g.fillStyle = color || CARD_C.txt; g.textAlign = align || "left"; g.fillText(s, x, y); }
function cFit(g, s, maxW, size, weight) { cFont(g, size, weight); var t = s; while (g.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1); return t === s ? s : t.slice(0, -1) + "…"; }
function cWrap(g, s, x, y, maxW, size, weight, color, lh, maxLines) {
  cFont(g, size, weight);
  var ch = String(s).split(""), line = "", lines = [];
  for (var i = 0; i < ch.length; i++) { var t = line + ch[i]; if (g.measureText(t).width > maxW && line) { lines.push(line); line = ch[i]; } else line = t; }
  if (line) lines.push(line);
  if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…"; }
  lines.forEach(function (l, k) { cText(g, l, x, y + k * (lh || size * 1.45), size, weight, color); });
  return y + lines.length * (lh || size * 1.45);
}
/* 금색 강조: 제목 안의 [[…]] 부분만 금색 */
function cPlain(s) { return String(s).replace(/\[\[|\]\]/g, ""); }
function cRich(g, s, x, y, size, weight, color) {
  var parts = String(s).split(/\[\[|\]\]/), cx = x;
  parts.forEach(function (p, i) { if (!p) return; cText(g, p, cx, y, size, weight, i % 2 ? CARD_C.gold : (color || CARD_C.txt)); cx += cW(g, p, size, weight); });
}
/* 배경: 짙은 검정 + 오른쪽 위 은은한 금빛 + 얇은 금테 */
function cNew() {
  var cv = document.createElement("canvas"); cv.width = CARD.W; cv.height = CARD.H;
  var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  var lg = g.createLinearGradient(0, 0, 0, CARD.H); lg.addColorStop(0, CARD_C.bg); lg.addColorStop(1, CARD_C.bg2);
  g.fillStyle = lg; g.fillRect(0, 0, CARD.W, CARD.H);
  var rg = g.createRadialGradient(CARD.W - 60, 40, 0, CARD.W - 60, 40, 760);
  rg.addColorStop(0, "rgba(214,180,100,0.20)"); rg.addColorStop(0.45, "rgba(214,180,100,0.05)"); rg.addColorStop(1, "rgba(214,180,100,0)");
  g.fillStyle = rg; g.fillRect(0, 0, CARD.W, CARD.H);
  g.strokeStyle = "rgba(214,180,100,0.28)"; g.lineWidth = 2; g.strokeRect(28, 28, CARD.W - 56, CARD.H - 56);
  return { cv: cv, g: g, y: 150 };
}
/* 로고: 우상향 화살표 + UPHILL LAB */
function cLogo(g, x, y) {
  g.strokeStyle = CARD_C.gold; g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round";
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 12); g.lineTo(x + 24, y - 5); g.lineTo(x + 42, y - 24); g.stroke();
  g.beginPath(); g.moveTo(x + 30, y - 25); g.lineTo(x + 43, y - 25); g.lineTo(x + 43, y - 12); g.stroke();
  try { g.letterSpacing = "5px"; } catch (e) {}
  cText(g, "UPHILL LAB", x + 60, y - 2, 24, 800, CARD_C.gold);
  try { g.letterSpacing = "0px"; } catch (e) {}
}
/* 제목: 한 줄에 들어가면 한 줄(크기를 줄여 맞춤). 안 되면 구분점에서 길이가 비슷하게 두 줄, 두 줄 같은 크기 */
function cTitle(g, title, y, maxSize) {
  var maxW = CARD.W - CARD.PAD * 2, lines, top = maxSize || 64;
  if (Array.isArray(title)) lines = title;
  else {
    for (var sz = top; sz >= top - 14; sz -= 2) if (cW(g, cPlain(title), sz, 800) <= maxW) { cRich(g, title, CARD.PAD, y, sz, 800); return y + 24; }
    var best = null, seps = [" → ", " · ", ", ", " "];
    for (var k = 0; k < seps.length && !best; k++) {
      var parts = title.split(seps[k]); if (parts.length < 2) continue;
      for (var i = 1; i < parts.length; i++) {
        var a = parts.slice(0, i).join(seps[k]) + (seps[k] === ", " ? "," : ""), b = (seps[k] === " → " ? "→ " : "") + parts.slice(i).join(seps[k]);
        if ((a.match(/\[\[/g) || []).length !== (a.match(/\]\]/g) || []).length) continue;   // 금색 구간을 반으로 자르지 않음
        var d = Math.abs(cW(g, cPlain(a), 60, 800) - cW(g, cPlain(b), 60, 800));
        if (!best || d < best.d) best = { d: d, l: [a, b] };
      }
    }
    lines = best ? best.l : [title];
  }
  var size = top; while (size > 44 && lines.some(function (l) { return cW(g, cPlain(l), size, 800) > maxW; })) size -= 2;
  lines.forEach(function (l, i) { cRich(g, l, CARD.PAD, y + i * size * 1.3, size, 800); });
  return y + (lines.length - 1) * size * 1.3 + 24;
}
/* 머리: 로고 · 쪽번호 / 금테 꼬리표 / 큰 제목 / 부제 */
function cHead(c, tag, title, sub, page, total) {
  var g = c.g, P = CARD.PAD;
  cLogo(g, P, 118);
  if (page) cText(g, (page < 10 ? "0" : "") + page + "  /  " + (total < 10 ? "0" : "") + total, CARD.W - P, 114, 24, 600, CARD_C.sub, "right");
  cFont(g, 26, 700); var tw = g.measureText(tag).width + 40;
  cRound(g, P, 160, tw, 50, 25, CARD_C.goldDim, "rgba(214,180,100,0.55)");
  cText(g, tag, P + 20, 194, 26, 700, CARD_C.gold2);
  if (!title) { c.y = 240; return; }
  var y = cTitle(g, title, 300);
  if (sub) y = cWrap(g, sub, P, y + 28, CARD.W - P * 2, 29, 400, CARD_C.txt2, 42, 2);
  c.y = y + 36;
}
/* 표지형 머리: 작은 문장 + 아주 큰 한 단어/숫자 */
function cHero(c, tag, small, big, bigColor, sub, page, total) {
  var g = c.g, P = CARD.PAD;
  cHead(c, tag, "", null, page, total);
  cText(g, small, P, 300, 40, 600, CARD_C.txt2);
  var size = 150; while (size > 70 && cW(g, big, size, 800) > CARD.W - P * 2) size -= 4;
  cText(g, big, P - 4, 300 + size, size, 800, bigColor || CARD_C.gold);
  var y = 300 + size + 22;
  if (sub) y = cWrap(g, sub, P, y + 46, CARD.W - P * 2, 30, 500, CARD_C.txt2, 42, 2);
  c.y = y + 30;
}
/* 바닥: 계정 표기 (모든 카드 공통) */
function cFoot(c, note) {
  var g = c.g, P = CARD.PAD, y = CARD.H - 86;
  g.fillStyle = CARD_C.line; g.fillRect(P, y - 50, CARD.W - P * 2, 1);
  g.fillStyle = CARD_C.gold; g.fillRect(P, y - 51, 64, 3);
  cText(g, CARD_SNS, P, y, 32, 800, CARD_C.gold);
  cText(g, "우상향연구소", P + cW(g, CARD_SNS, 32, 800) + 16, y, 23, 600, CARD_C.txt2);
  cText(g, note || "종가 기준 · 투자 조언 아님", CARD.W - P, y, 21, 400, CARD_C.sub, "right");
}
/* 한 줄: 이름 | (부가) | 주가 | 등락 — 열 위치를 고정해 줄마다 숫자가 같은 자리에 */
function cRow(c, name, val, color, opt) {
  opt = opt || {}; var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, h = opt.h || 76;
  var fs = h >= 76 ? 36 : h >= 64 ? 32 : 29, by = c.y + (opt.bar != null ? h * 0.56 : h * 0.62);
  if (opt.hi) cRound(g, P - 18, c.y + 4, W + 36, h - 8, 16, CARD_C.goldDim);
  if (opt.rank != null) cText(g, String(opt.rank), P + 16, by - 2, fs - 8, 700, opt.rank === 1 ? CARD_C.gold : CARD_C.sub, "center");
  var nx = P + (opt.rank != null ? 54 : 0), right = P + W - Math.max(opt.valW || 150, cW(g, val, fs + 2, 800)) - 22;
  cText(g, val, P + W, by, fs + 2, 800, color || CARD_C.txt, "right");
  if (opt.price) { var pf = opt.priceSize || fs - 7; cText(g, opt.price, right, by - 1, pf, 500, CARD_C.txt2, "right"); right -= cW(g, opt.price, pf, 500) + 22; }
  if (opt.mid) { cText(g, opt.mid, right, by - 2, fs - 12, 500, CARD_C.sub, "right"); right -= cW(g, opt.mid, fs - 12, 500) + 18; }
  cText(g, cFit(g, name, Math.max(120, right - nx), fs, 600), nx, by, fs, 600, opt.hi ? CARD_C.gold2 : CARD_C.txt);
  if (opt.bar != null) {
    var bw = Math.max(6, Math.min(1, Math.abs(opt.bar)) * (W - (nx - P)));
    cRound(g, nx, by + 14, W - (nx - P), 8, 4, CARD_C.soft); cRound(g, nx, by + 14, bw, 8, 4, color || CARD_C.gold);
  }
  if (!opt.noLine && !opt.hi) { g.fillStyle = CARD_C.line; g.fillRect(P, c.y + h, W, 1); }
  c.y += h + (opt.gap || 0);
}
function cColHead(c, cols) { cols.forEach(function (x) { cText(c.g, x[0], x[1], c.y + 4, 22, 700, CARD_C.sub, "right"); }); c.y += 14; }
function cTiles(c, tiles) {   // 2×N 숫자 타일
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, gap = 22, tw = (W - gap) / 2, th = 186;
  tiles.forEach(function (t, i) {
    var x = P + (i % 2) * (tw + gap), y = c.y + Math.floor(i / 2) * (th + gap);
    cRound(g, x, y, tw, th, 24, CARD_C.tile, "rgba(214,180,100,0.22)");
    cText(g, t.v, x + 30, y + 82, 56, 800, t.color || CARD_C.gold);
    cWrap(g, t.l, x + 30, y + 126, tw - 60, 25, 500, CARD_C.txt2, 33, 2);
  });
  c.y += Math.ceil(tiles.length / 2) * (th + gap);
}
/* 남은 공간에 n줄이 들어가도록 행 높이 계산 (note=true면 하단 안내 한 줄 자리 확보) */
function cH(c, n, max, note, extra) { return Math.max(48, Math.min(max, Math.floor((CARD.H - (note ? 220 : 170) - c.y - (extra || 0)) / Math.max(1, n)))); }
function cNote(c, s) { var g = c.g, P = CARD.PAD; cText(g, cFit(g, s, CARD.W - P * 2, 25, 500), P, CARD.H - 182, 25, 500, CARD_C.gold); }
function cPara(c, s) { c.y = cWrap(c.g, s, CARD.PAD, c.y + 40, CARD.W - CARD.PAD * 2, 28, 500, CARD_C.txt2, 40, 3) + 10; }
function cLabel(c, s, color) { cText(c.g, s, CARD.PAD, c.y + 30, 28, 800, color || CARD_C.txt2); c.y += 44; }
function cBar(c, pct, h) {   // 금색 진행 막대
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2; h = h || 18;
  cRound(g, P, c.y, W, h, 9, CARD_C.soft);
  var lg = g.createLinearGradient(P, 0, P + W, 0); lg.addColorStop(0, "#8c7340"); lg.addColorStop(1, CARD_C.gold2);
  cRound(g, P, c.y, Math.max(h, W * Math.max(0, Math.min(1, pct))), h, 9, lg);
  c.y += h;
}

/* ---------- 긴 기간 데이터 (1년 전·적립식 카드용) ---------- */
var CARD_SETS = {
  all: ["SPY", "QQQ", "005930.KS", "000660.KS", "NVDA", "TSLA", "BTC-USD", "GLD"],
  kr: ["069500.KS", "005930.KS", "000660.KS", "005380.KS", "035420.KS", "207940.KS", "105560.KS", "373220.KS"],
  us: ["SPY", "QQQ", "SCHD", "NVDA", "AAPL", "MSFT", "TSLA", "GLD"],
  coin: ["BTC-USD", "ETH-USD", "XRP-USD", "SOL-USD", "DOGE-USD", "ADA-USD", "BNB-USD"]
};
var CARD_HIST = {};
function cardsPrefetch(market) {
  var list = (CARD_SETS[market] || CARD_SETS.all).concat(["KRW=X"]);
  if (typeof getChartData !== "function") return Promise.resolve();
  return Promise.all(list.map(function (sym) {
    if (CARD_HIST[sym]) return null;
    return getChartData(sym, "max").then(function (p) { CARD_HIST[sym] = (p && p.rows) || []; }).catch(function () { CARD_HIST[sym] = []; });
  }));
}
function cAt(rows, t) { var lo = 0, hi = rows.length - 1; if (hi < 0) return -1; while (lo < hi) { var m = (lo + hi) >> 1; if (rows[m].t < t) lo = m + 1; else hi = m; } return lo; }
/* 원화 환산: 달러 자산은 그날 환율을 곱한다 (환율 데이터가 없으면 1 = 환율 변동 제외) */
function cFx(sym, t) {
  if (/\.K[SQ]$/.test(sym)) return 1;
  var fx = CARD_HIST["KRW=X"]; if (!fx || !fx.length) return 1;
  var i = cAt(fx, t); if (i < 0) return 1; if (i > 0 && fx[i].t > t) i--; return fx[i].c || 1;
}
function cHasFx() { return !!(CARD_HIST["KRW=X"] && CARD_HIST["KRW=X"].length > 100); }
/* 1년 전에 100만원 */
function cYearAgo(market) {
  var out = [], now = Date.now();
  (CARD_SETS[market] || CARD_SETS.all).forEach(function (sym) {
    var r = CARD_HIST[sym]; if (!r || r.length < 200) return;
    var t0 = now - 365 * 86400000, i = cAt(r, t0); if (i < 0 || Math.abs(r[i].t - t0) > 10 * 86400000) return;
    var last = r[r.length - 1];
    var ret = (last.c * cFx(sym, last.t)) / (r[i].c * cFx(sym, r[i].t)) - 1;
    out.push({ sym: sym, name: cNm(sym), ret: ret, val: 1e6 * (1 + ret), px: cLast(sym) });
  });
  return out.sort(function (a, b) { return b.val - a.val; });
}
/* 매달 10만원씩 적립 — 10·7·5·3년 중 4개 이상 자산의 데이터가 있는 가장 긴 기간 */
function cDca(market) {
  var syms = CARD_SETS[market] || CARD_SETS.all, now = Date.now(), years = [10, 7, 5, 3];
  for (var k = 0; k < years.length; k++) {
    var Y = years[k], t0 = now - Y * 365.25 * 86400000, res = [];
    syms.forEach(function (sym) {
      var r = CARD_HIST[sym]; if (!r || !r.length || r[0].t > t0 + 20 * 86400000) return;
      var d = new Date(t0), units = 0, n = 0;
      for (var m = 0; m < Y * 12; m++) {
        var ms = new Date(d.getFullYear(), d.getMonth() + 1 + m, 1).getTime(); if (ms > now) break;
        var i = cAt(r, ms); if (i < 0 || r[i].t < ms) continue;
        units += 100000 / (r[i].c * cFx(sym, r[i].t)); n++;
      }
      var last = r[r.length - 1];
      if (n) res.push({ sym: sym, name: cNm(sym), n: n, principal: n * 100000, val: units * last.c * cFx(sym, last.t) });
    });
    if (res.length >= 4) return { years: Y, rows: res.sort(function (a, b) { return b.val - a.val; }) };
  }
  return null;
}
/* 시장 심리 온도 (자체 계산, 0~100) — 오른 종목 비율·20일선 위 비율·신고가 대 세일 비율·VIX */
function cMood(R) {
  var parts = [], nums = R.numbers || [];
  var sale = parseInt(nums[0] && nums[0].v, 10) || 0, ath = parseInt(nums[1] && nums[1].v, 10) || 0;
  parts.push({ k: "오른 종목 비율", s: R.temp.upPct, txt: Math.round(R.temp.upPct * 100) + "%" });
  parts.push({ k: "20일 평균선 위 종목", s: R.temp.abovePct, txt: Math.round(R.temp.abovePct * 100) + "%" });
  var hs = (ath + sale) ? ath / (ath + sale) : 0.5;
  parts.push({ k: "신고가 근처 : 세일 중", s: Math.min(1, hs * 2), txt: ath + " : " + sale });
  var vix = nums.filter(function (n) { return n.sym === "^VIX"; })[0];
  if (vix) { var vv = parseFloat(vix.v); parts.push({ k: "VIX 공포지수", s: Math.max(0, Math.min(1, (35 - vv) / 23)), txt: vv.toFixed(1) }); }
  var score = Math.round(parts.reduce(function (a, p) { return a + p.s; }, 0) / parts.length * 100);
  var word = score < 25 ? "극도의 공포" : score < 45 ? "공포" : score <= 55 ? "중립" : score <= 75 ? "탐욕" : "극도의 탐욕";
  return { score: score, word: word, parts: parts };
}
function cGauge(c, score, word) {
  var g = c.g, cx = CARD.W / 2, cy = c.y + 270, r = 270, cols = ["#5b9bff", "#8fa9c9", "#a8a29a", CARD_C.gold, CARD_C.up];
  g.lineWidth = 44; g.lineCap = "butt";
  for (var i = 0; i < 5; i++) {
    g.beginPath(); g.strokeStyle = cols[i]; g.globalAlpha = 0.85;
    g.arc(cx, cy, r, Math.PI + Math.PI * i / 5 + 0.012, Math.PI + Math.PI * (i + 1) / 5 - 0.012); g.stroke();
  }
  g.globalAlpha = 1;
  var a = Math.PI + Math.PI * Math.max(0, Math.min(100, score)) / 100;
  g.strokeStyle = CARD_C.txt; g.lineWidth = 8; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 64), cy + Math.sin(a) * (r - 64)); g.stroke();
  g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.fillStyle = CARD_C.gold; g.fill();
  cText(g, "공포", cx - r, cy + 50, 24, 600, CARD_C.sub, "center"); cText(g, "탐욕", cx + r, cy + 50, 24, 600, CARD_C.sub, "center");
  cText(g, String(score), cx, cy + 112, 84, 800, CARD_C.gold2, "center");
  cText(g, "/ 100", cx + cW(g, String(score), 84, 800) / 2 + 12, cy + 112, 26, 600, CARD_C.sub);
  c.y = cy + 140;
}

/* ---------- 오늘의 브리핑 카드 (8장) ---------- */
function cardsBrief() {
  var R = briefState.result; if (!R) return [];
  var M = R.market || "all", MN = M !== "all" ? R.mktName + " " : "";
  var ya = cYearAgo(R.market || "all"), dca = cDca(R.market || "all");
  var out = [], T = 6 + (ya.length >= 3 ? 1 : 0) + (dca ? 1 : 0), date = cDate(M === "kr" ? R.asOfKr : (R.asOfUs || R.asOf)), L = R.label, P = CARD.PAD;
  var TG = function (s) { return s + (MN ? " · " + MN.trim() : "") + " · " + date; };
  // 1. 표지 — 시장 온도
  var c = cNew(), t = R.temp;
  cHero(c, TG("DAILY BRIEF"), L + " " + MN + "시장은", t.word, CARD_C.gold, "오른 종목 " + Math.round(t.upPct * 100) + "%  ·  " + t.up + " / " + t.total + "개", 1, T);
  cBar(c, t.upPct); c.y += 30;
  var ir = R.indexRow.slice(0, 6), ih = cH(c, ir.length, 72, false, 100);
  ir.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: ih, price: cPrice(x.sym, x.last) }); });
  cPara(c, t.desc);
  cFoot(c); out.push({ name: "1_시장온도", cv: c.cv });
  // 2. 테마 — 업종 평균 + 그 업종 1등 종목과 주가 (코인처럼 업종이 2개 미만이면 전체 시세표)
  c = cNew(); var th = R.themes, top = th[0], bot = th[th.length - 1];
  if (th.length < 2) {
    var all = R.movers.up.concat(R.movers.down.slice().reverse()).slice(0, 10);
    cHead(c, TG("PRICE"), MN + "전체 " + L + " 등락", "종목 · 지금 가격 · " + L + " 등락", 2, T);
    var ah = cH(c, all.length, 84);
    all.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ah, price: cPrice(s.sym, s.last) }); });
    cFoot(c); out.push({ name: "2_전체시세", cv: c.cv });
  } else {
    cHead(c, TG("MONEY FLOW"), "[[" + top.name + "]] 강세, " + bot.name + " 약세", "업종 평균 등락 · 업종 안에서 가장 많이 오른 종목과 주가", 2, T);
    var mx = Math.max.apply(null, th.map(function (x) { return Math.abs(x.ret); })) || 0.01;
    var th10 = th.slice(0, 10), hh = cH(c, th10.length, 84);
    th10.forEach(function (x) { var b = x.best; cRow(c, x.name, cPct(x.ret), cCol(x.ret), { bar: x.ret / mx, h: hh, noLine: true, priceSize: 22, price: b ? briefName(b) + " " + cPrice(b.sym, b.last) + " " + cPct(b.ret) : "" }); });
    cFoot(c); out.push({ name: "2_테마흐름", cv: c.cv });
  }
  // 3. 급등·급락
  c = cNew(); var up = R.movers.up.slice(0, 5), dn = R.movers.down.slice(0, 5);
  if (!up[0] && !dn[0]) return out;
  cHead(c, TG("TOP MOVERS"), up[0] ? "1위 [[" + briefName(up[0]) + " " + cPct(up[0].ret) + "]]" : "오른 종목이 없어요",
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
  cHead(c, TG("HOT"), hot.length ? "[[" + briefName(hot[0]) + "]]에 돈이 몰렸어요" : "많이 찾는 종목의 " + L, "주가 · 등락 (작은 글씨: 거래대금이 평소의 몇 배인지)", 4, T);
  var ph = cH(c, pop.length, 84);
  pop.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ph, price: cPrice(s.sym, s.last), mid: s.amtX != null ? s.amtX.toFixed(1) + "배" : "" }); });
  cFoot(c, R.popSrc === "ranked" ? "앱 조회 순위 · 투자 조언 아님" : "거래대금 기준 · 투자 조언 아님"); out.push({ name: "4_인기종목", cv: c.cv });
  // 5. 숫자 + 세일 폭 큰 종목
  c = cNew(); var nums = R.numbers.slice(0, 4), sale = (nums[0].list || []).filter(function (s) { return !/^\^|=X$/.test(s.sym); }).slice(0, 3);
  cHead(c, TG("NUMBERS"), "세일 중인 종목 [[" + nums[0].v + "]]", "52주 최고가보다 20% 넘게 싼 종목 수 · 시장 전체를 네 숫자로", 5, T);
  cTiles(c, nums.map(function (n) { return { v: n.v, l: n.l }; }));
  if (sale.length) {
    c.y += 4; cLabel(c, "가장 많이 할인된 종목 (52주 최고 대비)");
    var sh = cH(c, sale.length, 70, true);
    sale.forEach(function (s) { cRow(c, briefName(s), cPct(s.vsHi, 0), CARD_C.down, { h: sh, price: cPrice(s.sym, s.last) }); });
  }
  cNote(c, "싸졌다는 건 사실이지만, 더 내리지 않는다는 뜻은 아니에요.");
  cFoot(c); out.push({ name: "5_오늘의숫자", cv: c.cv });
  // 6. 시장 심리 온도계 (자체 계산)
  c = cNew(); var md = cMood(R);
  cHead(c, TG("MOOD"), MN + "시장 심리는 [[" + md.word + "]]", "0 = 극도의 공포, 100 = 극도의 탐욕 · 아래 " + md.parts.length + "가지 숫자로 계산", 6, T);
  cGauge(c, md.score, md.word);
  var gh = cH(c, md.parts.length, 70, true);
  md.parts.forEach(function (p) { cRow(c, p.k, p.txt, CARD_C.gold, { h: gh, mid: "온도 " + Math.round(p.s * 100) }); });
  cNote(c, "극단일수록 감정적으로 사고팔기 쉬운 때예요. 방향을 맞히는 지표는 아니에요.");
  cFoot(c, "StockMind 자체 계산 · CNN 공포탐욕지수 아님"); out.push({ name: "6_심리온도", cv: c.cv });
  // 7. 1년 전에 100만원 샀다면 (원화 기준)
  if (ya.length >= 3) {
    c = cNew(); var w1 = ya[0];
    cHead(c, TG("1 YEAR AGO"), "1년 전 100만원 → [[" + w1.name + " " + cMan(w1.val) + "]]", "1년 전에 100만원어치 샀다면 지금 얼마? · 작은 숫자는 지금 주가", 7, T);
    var yh = cH(c, ya.length, 84, true);
    ya.forEach(function (x, i) { cRow(c, x.name, cMan(x.val), cCol(x.ret), { rank: i + 1, h: yh, price: cPct(x.ret, 0), mid: cPrice(x.sym, x.px), hi: i === 0 }); });
    cNote(c, "지금 유명한 종목만 고른 것 자체가 결과를 알고 고른 거예요(생존자 편향).");
    cFoot(c, (cHasFx() ? "환율 포함 원화 기준" : "환율 변동 제외") + " · 배당 재투자 · 투자 조언 아님"); out.push({ name: "7_1년전100만원", cv: c.cv });
  }
  // 8. 매달 10만원씩 적립했다면
  if (dca) {
    c = cNew(); var d1 = dca.rows[0], prin = d1.principal;
    cHead(c, TG("DCA"), "매달 10만원 " + dca.years + "년 → [[" + d1.name + " " + cMan(d1.val) + "]]", "적금처럼 매달 첫 거래일에 10만원씩 샀다면 · 넣은 돈 " + cMan(prin), T, T);
    var dh = cH(c, dca.rows.length, 84, true);
    dca.rows.forEach(function (x, i) { cRow(c, x.name, cMan(x.val), x.val >= x.principal ? CARD_C.up : CARD_C.down, { rank: i + 1, h: dh, price: (x.val / x.principal).toFixed(1) + "배", hi: i === 0 }); });
    cNote(c, "나눠 사면 고점에 몰아 살 걱정이 줄어요. 지난 성과가 미래를 보장하진 않아요.");
    cFoot(c, (cHasFx() ? "환율 포함 원화 기준" : "환율 변동 제외") + " · 배당 재투자 · 투자 조언 아님"); out.push({ name: "8_매달10만원", cv: c.cv });
  }
  return out;
}

/* ---------- 채널 브리핑 자료 카드 (5장) ---------- */
var CARD_PLAN_COL = ["#d6b464", "#f1dca2", "#9c8350", "#7d8fa6", "#c9c2b4"];
function cMixName(sym) { return (typeof CH_SHORT !== "undefined" && CH_SHORT[sym]) || cNm(sym); }
function cardsChannel() {
  var R = chState.brief, out = [], T = 5; if (!R) return [];
  var date = cDate(R.asOfUs), P = CARD.PAD, W = CARD.W - P * 2;
  // 1. 미국 증시 요약 — 미국 지표만 + 한국 투자자용 달러/원
  var U = briefCompute(chState.recent, { market: "us" });
  var urow = U.indexRow.concat(R.indexRow.filter(function (x) { return x.sym === "KRW=X"; }));
  var c = cNew(), sp = urow.filter(function (x) { return x.sym === "^GSPC"; })[0], nq = urow.filter(function (x) { return x.sym === "^IXIC"; })[0];
  cHero(c, "US MARKET · " + date + " 마감", "간밤 미국 증시 S&P500", cPct(sp && sp.ret, 2), sp ? cCol(sp.ret) : CARD_C.gold, "나스닥 " + cPct(nq && nq.ret) + " · 공포지수·채권·금·환율까지 한눈에", 1, T);
  var ih = cH(c, urow.length, 72, true);
  urow.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: ih, price: cPrice(x.sym, x.last) }); });
  var th = U.themes;
  if (th.length >= 2) cNote(c, "강세 " + th.slice(0, 2).map(function (x) { return x.name; }).join("·") + "  /  약세 " + th.slice(-2).map(function (x) { return x.name; }).join("·"));
  cFoot(c); out.push({ name: "1_미국증시", cv: c.cv });
  // 2. MDD
  c = cNew(); var rs = (chState.mdd || []).concat(chState.mddPick || []).filter(function (r) { return !r.err; }).slice(0, 9);
  var deep = rs.filter(function (r) { return r.cur <= -0.1; }).sort(function (a, b) { return a.cur - b.cur; })[0];
  cHead(c, "MDD · " + date, deep ? deep.name + " 고점 대비 [[" + cPct(deep.cur, 0) + "]]" : "대표 자산 대부분 [[고점 근처]]", "지금 주가 · 고점 대비 위치 · 작은 글씨는 역대 하락 중 깊이 순위", 2, T);
  var rh = cH(c, rs.length, 84);
  rs.forEach(function (r) { cRow(c, r.name, cPct(r.cur, 0), r.cur <= -0.1 ? CARD_C.down : CARD_C.txt, { h: rh, price: cPrice(r.sym, cLast(r.sym)), mid: r.cur <= -0.1 ? (r.deeper + 1) + "위/" + r.eps + "회" : "", bar: r.cur }); });
  cFoot(c, "10년치 데이터 · 투자 조언 아님"); out.push({ name: "2_MDD", cv: c.cv });
  // 3. 지금 상황 맞춤 구성 — 4번 카드 맨 윗줄과 같은 구성
  var plan = chState.plan, pLabel = CH_PLAN_LABEL[plan.key]; c = cNew();
  cHead(c, "ALLOCATION · 지금 상황", "지금은 " + plan.title.split(" — ")[0] + " → [[" + pLabel + "]]", (chState.now && chState.now.why.length) ? "근거: " + chState.now.why.join(" / ") : "두드러진 신호가 없어 평소 균형형을 보여줘요", 3, T);
  var g = c.g, x = P;
  var prow = plan.items.map(function (it) { return { sym: it[0], name: cMixName(it[0]) + " (" + it[0] + ")", w: it[1], why: it[2] }; });
  prow.forEach(function (it, i) { var w = W * it.w / 100; cRound(g, x, c.y, Math.max(8, w - 6), 36, 8, CARD_PLAN_COL[i % 5]); x += w; });
  c.y += 66;
  var per = (CARD.H - 220 - c.y) / prow.length, two = per >= 124;
  prow.forEach(function (it, i) {
    cRound(g, P, c.y + 12, 22, 22, 6, CARD_PLAN_COL[i % 5]);
    cText(g, it.name, P + 38, c.y + 33, 31, 700, CARD_C.txt);
    cText(g, it.w + "%", CARD.W - P, c.y + 34, 34, 800, CARD_PLAN_COL[i % 5], "right");
    cText(g, cPrice(it.sym, cLast(it.sym)), CARD.W - P - 110, c.y + 33, 25, 500, CARD_C.txt2, "right");
    cWrap(g, it.why, P + 38, c.y + 71, W - 38, 24, 400, CARD_C.txt2, 32, two ? 2 : 1);
    c.y += per;
  });
  cNote(c, "규칙 기반 예시이며 추천이 아니에요. 다음 카드에서 다른 구성과 비교해요.");
  cFoot(c); out.push({ name: "3_자산배분", cv: c.cv });
  // 4. 6가지 구성 비교 (1년·3년) — 구성별 종목·비중 함께, 지금 구성을 맨 위에
  c = cNew(); var cmp = (chState.cmp || []).slice().sort(function (a, b) { return (b.key === plan.key) - (a.key === plan.key); });
  function best(i) { var ok = cmp.filter(function (x) { return x.res[i]; }); return ok.slice().sort(function (a, b) { return b.res[i].ret - a.res[i].ret; })[0]; }
  var b1 = best(2), b3 = best(3);
  var ttl = b1 && b3 && b1.key === b3.key ? "1년·3년 모두 1위는 [[" + b1.label + "]]" : [b1 ? "1년 1위 [[" + b1.label + "]]" : "", b3 ? "3년 1위 [[" + b3.label + "]]" : ""].filter(Boolean).join(" · ");
  cHead(c, "BACKTEST · 처음 비중 그대로 뒀다면", ttl || "구성별 성과", "수익률 (괄호: 그 사이 최대 낙폭) · 이름 아래가 실제 담은 종목", 4, T);
  var c1 = CARD.W - P - 180, c2 = CARD.W - P;
  cColHead(c, [["1년", c1], ["3년", c2]]);
  var ch = cH(c, cmp.length, 112, true);
  cmp.forEach(function (x) {
    var a = x.res[2], b = x.res[3], gg = c.g, now = x.key === plan.key, y0 = c.y;
    if (now) cRound(gg, P - 18, y0 + 4, W + 36, ch - 8, 16, CARD_C.goldDim);
    cText(gg, x.label, P, y0 + 44, 32, 800, now ? CARD_C.gold2 : CARD_C.txt);
    if (now) { var lw = cW(gg, x.label, 32, 800); cRound(gg, P + lw + 12, y0 + 17, 62, 34, 17, CARD_C.gold); cText(gg, "지금", P + lw + 43, y0 + 42, 21, 800, CARD_C.bg, "center"); }
    var mix = CH_PLANS[x.key].items.map(function (it) { return cMixName(it[0]) + " " + it[1]; }).join(" · "), mw = c1 - P - 90, ms = 23;
    while (ms > 17 && cW(gg, mix, ms, 500) > mw) ms--;
    cText(gg, cFit(gg, mix, mw, ms, 500), P, y0 + 80, ms, 500, CARD_C.txt2);
    [[a, c1], [b, c2]].forEach(function (z) {
      cText(gg, z[0] ? cPct(z[0].ret, 0) : "-", z[1], y0 + 46, 33, 800, z[0] ? cCol(z[0].ret) : CARD_C.sub, "right");
      if (z[0]) cText(gg, "(" + cPct(z[0].mdd, 0) + ")", z[1], y0 + 78, 21, 400, CARD_C.sub, "right");
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
    cHead(c, "HISTORY · " + sc.tag + (sc.now ? " (지금과 비슷)" : ""), ep.name, ep.s.replace(/-/g, ".") + " ~ " + ep.e.slice(5).replace(/-/g, ".") + " 등락 · 작은 숫자는 지금 주가", 5, T);
    var rows = ep.st.filter(function (x) { return x.sym !== "KRW=X"; }).sort(function (a, b) { return b.ret - a.ret; }).slice(0, 6);
    var pops = (ep.pop || []).slice(0, 3), sh2 = cH(c, rows.length + pops.length, 72, false, pops.length ? 60 : 0);
    rows.forEach(function (x) { cRow(c, x.name, cPct(x.ret, 0), cCol(x.ret), { h: sh2, price: cPrice(x.sym, cLast(x.sym)), priceSize: 23 }); });
    if (pops.length) {
      c.y += 12; cLabel(c, "그때 인기 종목은 (최대 낙폭 → 회복)", CARD_C.gold);
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
  var btn = document.getElementById(kind === "brief" ? "briefCards" : "chCards"), old = btn ? btn.textContent : "";
  if (btn) btn.textContent = "만드는 중…";
  var mkt = kind === "brief" && typeof briefState !== "undefined" ? (briefState.market || "all") : null;
  ready.then(function () { return mkt ? cardsPrefetch(mkt) : null; }).then(function () {
    // 1차로 그려 쓰인 글자를 모으고 → 그 글자의 웹폰트를 받아 → 다시 그린다 (폰트가 늦게 와서 기본 글꼴로 저장되는 것 방지)
    CARD_TXT = "";
    try { make(); } catch (e) {}
    if (!document.fonts || !document.fonts.load) return;
    var txt = CARD_TXT.replace(/\s+/g, "");
    return Promise.all([400, 500, 600, 700, 800].map(function (w) { return document.fonts.load(w + " 40px \"Pretendard Variable\"", txt).catch(function () {}); }));
  }).then(function () {
    if (btn) btn.textContent = old;
    var list;
    try { list = make(); } catch (e) { console.warn(e); list = []; }
    if (!list.length) { alert("아직 데이터가 다 준비되지 않았어요. 잠시 뒤 다시 눌러 주세요."); return; }
    var day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    var box = document.createElement("div");
    var mk = mkt;
    var mkHtml = mk ? '<div class="pills" style="margin-bottom:10px">' + Object.keys(BRIEF_MKT).map(function (k) {
      return '<button data-cm="' + k + '"' + (k === mk ? ' class="active"' : '') + '>' + BRIEF_MKT[k] + '</button>'; }).join("") + '</div>' : "";
    box.innerHTML = mkHtml + '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button>' +
      (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유 (인스타·카톡)</button>' : '') +
      '<span class="briefDim">1080×1350 · 인스타 4:5 · 저장이 안 되면 이미지를 길게 눌러 저장 · 장마다 따로 올려도, 묶어서 올려도 돼요</span></div><div class="cardsWrap"></div>';
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
