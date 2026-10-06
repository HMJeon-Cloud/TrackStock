/* ============================================================
   카드 뉴스 (v7.0) — 우상향연구소(@uphill.lab) 인스타·스레드용 1080×1350(4:5)
   디자인: 계정 브랜드인 블랙 & 골드. 모든 카드가 같은 틀(로고·꼬리표·제목·바닥)이라 피드에 쌓이면 한 세트로 보인다.
   인스타 프로필 격자는 4:5 게시물을 3:4로 잘라 보여주므로(좌우 약 34px) 글자는 좌우 96px 안쪽에만 둔다.
   한 장에 메시지 하나: 큰 제목이 "이 카드가 말하려는 것", 금색 글씨가 핵심 숫자.
   ============================================================ */
var CARD = { W: 1080, H: 1350, PAD: 60, HEAD: 256 };   // TrackApt 카드와 같은 틀: 남색 머리 + 베이지 바탕 + 흰 박스 (v8.4: 머리를 300→256으로 줄여 본문 공간 확보)
/* 카드 성격: regular = 정기(한 주·한 달 정리/예상, 채널) 남색 머리 / event = 이벤트성(오늘의 브리핑·전일 정리) 검정 머리 + 금색 꼬리표 */
var CARD_STYLE = "regular";
var CARD_SERIES = "";   // 머리 오른쪽 위 작은 시리즈 표시 (예: "WEEKLY REVIEW · 2026 W41")
var CARD_C = {
  navy: "#1f2a44", navy2: "#2a3659", bg: "#f3efe6", box: "#ffffff", line: "#e6e1d6",
  txt: "#1c2333", txt2: "#5b6474", sub: "#8a92a3", onNavy: "#ffffff", onNavy2: "#c9d0de",
  up: "#d9342b", down: "#2f6fd6", gold: "#c9a24f", gold2: "#e6c57a", goldDim: "rgba(201,162,79,0.16)",
  soft: "#f3efe6", tile: "#ffffff", tagBg: "rgba(255,255,255,0.14)"
};
CARD_C.black = "#141414"; CARD_C.black2 = "#262626";
CARD_C.accent = CARD_C.gold; CARD_C.warmTxt = "#8a6a1f"; CARD_C.warm = CARD_C.goldDim; CARD_C.card = CARD_C.box;
var CARD_FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
var CARD_TXT = "";   // 그린 글자 모음 — 웹폰트가 필요한 글자만 내려받으므로, 한 번 그려 글자를 모은 뒤 폰트를 받고 다시 그린다

function cPct(x, d) { if (x == null || !isFinite(x)) return "-"; d = d == null ? 1 : d; var v = (x * 100).toFixed(d); if (parseFloat(v) === 0) v = (0).toFixed(d); return (parseFloat(v) > 0 ? "+" : "") + v + "%"; }
function cCol(x) { return x > 0 ? CARD_C.up : x < 0 ? CARD_C.down : CARD_C.sub; }
function cDate(ms) { var d = new Date((ms || Date.now()) + 9 * 3600 * 1000); return (d.getUTCMonth() + 1) + "." + d.getUTCDate() + "(" + "일월화수목금토"[d.getUTCDay()] + ")"; }   // 한국 시간 기준
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

/* ---------- 그리기 도구 (TrackApt 카드 틀) ---------- */
var CARD_SNS = "@uphill.lab";
function cRound(g, x, y, w, h, r, fill, stroke) {
  r = Math.min(r, h / 2, w / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
}
/* 흰 박스 (아주 옅은 그림자) */
function cBox(g, x, y, w, h, r) {
  g.save(); g.shadowColor = "rgba(31,42,68,0.08)"; g.shadowBlur = 14; g.shadowOffsetY = 4;
  cRound(g, x, y, w, h, r || 18, CARD_C.box); g.restore();
}
function cFont(g, size, weight) { g.font = (weight || 400) + " " + size + "px " + CARD_FONT; }
function cW(g, s, size, weight) { cFont(g, size, weight); return g.measureText(s).width; }
function cText(g, s, x, y, size, weight, color, align) { s = String(s); CARD_TXT += s; cFont(g, size, weight); g.fillStyle = color || CARD_C.txt; g.textAlign = align || "left"; g.fillText(s, x, y); }
function cFit(g, s, maxW, size, weight) { cFont(g, size, weight); var t = s; while (g.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1); return t === s ? s : t.slice(0, -1) + "…"; }
function cWrap(g, s, x, y, maxW, size, weight, color, lh, maxLines, align) {
  cFont(g, size, weight);
  var ch = String(s).split(""), line = "", lines = [];
  for (var i = 0; i < ch.length; i++) { var t = line + ch[i]; if (g.measureText(t).width > maxW && line) { lines.push(line); line = ch[i]; } else line = t; }
  if (line) lines.push(line);
  if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…"; }
  lines.forEach(function (l, k) { cText(g, l, x, y + k * (lh || size * 1.45), size, weight, color, align); });
  return y + lines.length * (lh || size * 1.45);
}
/* 강조: 제목 안의 [[…]] 부분만 금색 (머리 위에서는 밝은 금색) */
function cPlain(s) { return String(s).replace(/\[\[|\]\]/g, ""); }
function cRich(g, s, x, y, size, weight, color, hi) {
  var parts = String(s).split(/\[\[|\]\]/), cx = x;
  parts.forEach(function (p, i) { if (!p) return; cText(g, p, cx, y, size, weight, i % 2 ? (hi || CARD_C.gold2) : (color || CARD_C.txt)); cx += cW(g, p, size, weight); });
}
/* 배경: 위 남색 머리 + 금색 곡선, 아래 베이지 */
function cNew() {
  var cv = document.createElement("canvas"); cv.width = CARD.W; cv.height = CARD.H;
  var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = CARD_C.bg; g.fillRect(0, 0, CARD.W, CARD.H);
  var ev = CARD_STYLE === "event";
  var lg = g.createLinearGradient(0, 0, CARD.W, CARD.HEAD); lg.addColorStop(0, ev ? CARD_C.black : CARD_C.navy); lg.addColorStop(1, ev ? CARD_C.black2 : CARD_C.navy2);
  g.fillStyle = lg; g.fillRect(0, 0, CARD.W, CARD.HEAD);
  // 금색 우상향 곡선 (머리 배경 장식) — 이벤트 카드는 조금 더 선명하게
  g.save(); g.beginPath(); g.rect(0, 0, CARD.W, CARD.HEAD); g.clip();
  g.strokeStyle = ev ? "rgba(230,197,122,0.6)" : "rgba(201,162,79,0.45)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(CARD.W * 0.42, CARD.HEAD + 10); g.bezierCurveTo(CARD.W * 0.62, CARD.HEAD - 40, CARD.W * 0.72, 120, CARD.W + 10, 30); g.stroke();
  g.strokeStyle = ev ? "rgba(230,197,122,0.3)" : "rgba(201,162,79,0.22)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(CARD.W * 0.5, CARD.HEAD + 10); g.bezierCurveTo(CARD.W * 0.7, CARD.HEAD - 10, CARD.W * 0.8, 170, CARD.W + 10, 90); g.stroke();
  g.restore();
  // 우상향연구소 시그니처: 머리 아래 금색 가는 줄 + 오른쪽 끝 작은 ↗ 꺾임
  var gl = g.createLinearGradient(0, 0, CARD.W, 0); gl.addColorStop(0, "rgba(201,162,79,0.15)"); gl.addColorStop(0.55, CARD_C.gold); gl.addColorStop(1, CARD_C.gold2);
  g.fillStyle = gl; g.fillRect(0, CARD.HEAD - 4, CARD.W, 4);
  g.strokeStyle = CARD_C.gold2; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(CARD.W - 54, CARD.HEAD - 2); g.lineTo(CARD.W - 30, CARD.HEAD - 26); g.moveTo(CARD.W - 42, CARD.HEAD - 26); g.lineTo(CARD.W - 30, CARD.HEAD - 26); g.lineTo(CARD.W - 30, CARD.HEAD - 14); g.stroke();
  if (ev) { g.fillStyle = CARD_C.gold; g.fillRect(0, 0, CARD.W, 8); }   // 이벤트 카드: 맨 위 금색 띠
  return { cv: cv, g: g, y: CARD.HEAD + 32 };
}
function cLogo(g, x, y) {
  g.strokeStyle = CARD_C.onNavy; g.lineWidth = 4; g.lineJoin = "round"; g.lineCap = "round";
  g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + 26, y - 20); g.stroke();
  g.beginPath(); g.moveTo(x + 12, y - 20); g.lineTo(x + 26, y - 20); g.lineTo(x + 26, y - 6); g.stroke();
  cText(g, "우상향연구소", x + 40, y, 30, 800, CARD_C.onNavy);
}
/* 제목(머리 안, 흰 글씨): 한 줄에 들어가면 한 줄, 안 되면 구분점에서 길이가 비슷하게 두 줄 */
function cTitle(g, title, y, maxSize) {
  var maxW = CARD.W - CARD.PAD * 2, lines, top = maxSize || 58;
  if (Array.isArray(title)) lines = title;
  else {
    for (var sz = top; sz >= top - 10; sz -= 2) if (cW(g, cPlain(title), sz, 800) <= maxW) { cRich(g, title, CARD.PAD, y, sz, 800, CARD_C.onNavy); return y + 24; }
    var best = null, seps = [" → ", " · ", ", ", " — ", " "];
    for (var k = 0; k < seps.length && !best; k++) {
      var parts = title.split(seps[k]); if (parts.length < 2) continue;
      for (var i = 1; i < parts.length; i++) {
        var a = parts.slice(0, i).join(seps[k]) + (seps[k] === ", " ? "," : ""), b = (seps[k] === " → " ? "→ " : "") + parts.slice(i).join(seps[k]);
        if ((a.match(/\[\[/g) || []).length !== (a.match(/\]\]/g) || []).length) continue;
        var d = Math.abs(cW(g, cPlain(a), 54, 800) - cW(g, cPlain(b), 54, 800));
        if (!best || d < best.d) best = { d: d, l: [a, b] };
      }
    }
    lines = best ? best.l : [title];
  }
  var size = top; while (size > 40 && lines.some(function (l) { return cW(g, cPlain(l), size, 800) > maxW; })) size -= 2;
  var y0 = lines.length > 1 ? y - size * 0.65 : y;
  lines.forEach(function (l, i) { cRich(g, l, CARD.PAD, y0 + i * size * 1.25, size, 800, CARD_C.onNavy); });
  return y0 + (lines.length - 1) * size * 1.25 + 24;
}
/* 머리: 로고 · 꼬리표 · 날짜(쪽번호) / 큰 제목 / 부제는 본문 첫 요약 박스로 */
var CARD_UNIT = "";   // "코인"이면 제목·부제의 '종목'을 '코인'으로 (코인 브리핑)
function cHead(c, tag, title, sub, page, total) {
  var g = c.g, P = CARD.PAD, ev = CARD_STYLE === "event";
  if (CARD_UNIT === "코인") { if (typeof title === "string") title = title.replace(/종목/g, "코인"); if (sub) sub = String(sub).replace(/종목/g, "코인"); }
  cLogo(g, P, 72);
  // 꼬리표(둥근 테두리) — 날짜 부분은 꼬리표에서 떼어 오른쪽에. 이벤트 카드는 금색 채움
  var m = String(tag).match(/^(.*?)\s*·\s*([0-9]{1,2}\.[0-9]{1,2}\([일월화수목금토]\)[^·]*)$/);
  var tagTxt = m ? m[1] : tag, dateTxt = m ? m[2] : "";
  var lx = P + 40 + cW(g, "우상향연구소", 30, 800) + 22;
  cFont(g, 24, 700); var tw = g.measureText(tagTxt).width + 36;
  if (ev) { cRound(g, lx, 44, tw, 42, 21, CARD_C.gold); cText(g, tagTxt, lx + 18, 73, 24, 800, CARD_C.black); }
  else { cRound(g, lx, 44, tw, 42, 21, CARD_C.tagBg, "rgba(255,255,255,0.55)"); cText(g, tagTxt, lx + 18, 73, 24, 700, CARD_C.onNavy); }
  var right = dateTxt + (page ? "  ·  " + page + "/" + total : "");
  if (right) cText(g, right, CARD.W - P, 73, 26, 700, ev ? CARD_C.gold2 : CARD_C.onNavy, "right");
  if (CARD_SERIES) cText(g, CARD_SERIES, CARD.W - P, 106, 19, 600, ev ? "rgba(230,197,122,0.75)" : CARD_C.onNavy2, "right");
  c.y = CARD.HEAD + 32;
  if (!title) return;
  cTitle(g, title, 184);
  if (sub) cSummary(c, sub);
}
/* 첫 요약 박스: 왼쪽 금색 세로줄 + 한 줄 요약 (TrackApt의 "한 줄 요약") */
function cSummary(c, text, color) {
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, h = 64;
  cFont(g, 26, 600); if (g.measureText(text).width > W - 70) h = 100;
  cBox(g, P, c.y, W, h, 16); cRound(g, P, c.y + 10, 6, h - 20, 3, CARD_C.gold);
  if (h === 64) cText(g, cFit(g, text, W - 70, 26, 600), P + 32, c.y + 41, 26, 600, color || CARD_C.txt);
  else cWrap(g, text, P + 32, c.y + 38, W - 70, 26, 600, color || CARD_C.txt, 34, 2);
  c.y += h + 22;
}
/* 표지형 머리: 머리에 작은 문장 + 아주 큰 단어/숫자 */
function cHero(c, tag, small, big, bigColor, sub, page, total) {
  var g = c.g, P = CARD.PAD;
  cHead(c, tag, "", null, page, total);
  cText(g, small, P, 134, 30, 600, CARD_C.onNavy2);
  var size = 88; while (size > 54 && cW(g, big, size, 800) > CARD.W - P * 2) size -= 4;
  cText(g, big, P - 2, 226, size, 800, bigColor === CARD_C.up || bigColor === CARD_C.down ? bigColor : CARD_C.gold2);
  c.y = CARD.HEAD + 32;
  if (sub) cSummary(c, sub);
}
/* 바닥: 출처·면책(왼쪽 회색) + @uphill.lab(오른쪽 굵게) */
function cFoot(c, note, tipKey) {
  if (tipKey && !c.noTip) cFill(c, CARD_TIP[tipKey]);
  var g = c.g, P = CARD.PAD, y = CARD.H - 44;
  var txt = (/^출처:/.test(note || "") ? "" : "StockMind 자동 집계 · ") + (note || "종가 기준 · 투자 조언 아님").replace(/ · 투자 조언 아님$/, "") + " · 투자 권유 아님";
  var mw = cW(g, "uphill.lab", 28, 800) + 48;
  cText(g, cFit(g, txt, CARD.W - P * 2 - mw - 16, 22, 500), P, y, 22, 500, CARD_C.sub);
  cMark(g, CARD.W - P, y);
}
/* 우상향연구소 워드마크: 금색 ↗ 꺾임 + uphill.lab (바닥 오른쪽) */
function cMark(g, rx, y) {
  var w = cW(g, "uphill.lab", 28, 800), x = rx - w;
  cText(g, "uphill.lab", rx, y, 28, 800, CARD_C.txt, "right");
  g.strokeStyle = CARD_C.gold; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(x - 40, y - 2); g.lineTo(x - 18, y - 24); g.moveTo(x - 29, y - 24); g.lineTo(x - 18, y - 24); g.lineTo(x - 18, y - 13); g.stroke();
  g.fillStyle = CARD_C.gold; g.fillRect(x, y + 10, w, 3);
}
/* 한 줄: [순위.] 이름(굵게) · 회색 부가 · 주가 | 오른쪽 큰 값 — 각 줄이 흰 박스 */
function cRow(c, name, val, color, opt) {
  opt = opt || {}; var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, h = Math.max(56, (opt.h || 76));
  var fs = h >= 76 ? 30 : h >= 64 ? 27 : 24, gap = h >= 64 ? 10 : 6, bh = h - gap;
  cBox(g, P, c.y, W, bh, 14);
  if (opt.hi) { cRound(g, P, c.y, W, bh, 14, "#fff7e4"); cRound(g, P, c.y + 8, 6, bh - 16, 3, CARD_C.gold); }
  var by = c.y + bh * 0.5 + (opt.bar != null ? -6 : 0) + fs * 0.36;
  var nx = P + 24 + (opt.hi ? 10 : 0);
  if (opt.rank != null) { cText(g, opt.rank + ".", nx, by, fs, 800, CARD_C.txt); nx += cW(g, opt.rank + ".", fs, 800) + 10; }
  var vf = fs + 6, vw = Math.max(opt.valW ? opt.valW * 0.8 : 0, cW(g, val, vf, 800));
  cText(g, val, P + W - 24, by, vf, 800, color || CARD_C.txt, "right");
  var right = P + W - 24 - vw - 22;
  var metaParts = []; if (opt.mid) metaParts.push(opt.mid); if (opt.price) metaParts.push(opt.price);
  var nameW = cW(g, name, fs, 700), meta = metaParts.join(" · "), ms = Math.max(18, fs - 8);
  var avail = right - nx;
  if (meta && nameW + 14 + cW(g, meta, ms, 500) <= avail) {   // 한 줄: 이름 + 회색 부가
    cText(g, name, nx, by, fs, 700, CARD_C.txt);
    cText(g, meta, nx + nameW + 14, by, ms, 500, CARD_C.sub);
  } else if (meta && bh >= 66) {                                  // 두 줄: 이름 / 회색 부가
    cText(g, cFit(g, name, avail, fs - 2, 700), nx, c.y + bh * 0.5 - 2, fs - 2, 700, CARD_C.txt);
    cText(g, cFit(g, meta, avail, ms, 500), nx, c.y + bh * 0.5 + ms + 6, ms, 500, CARD_C.sub);
  } else {
    cText(g, cFit(g, name + (meta ? "  " + meta : ""), avail, fs, 700), nx, by, fs, 700, CARD_C.txt);
  }
  if (opt.bar != null) {
    var bw = Math.max(6, Math.min(1, Math.abs(opt.bar)) * (avail));
    cRound(g, nx, c.y + bh - 16, avail, 6, 3, CARD_C.soft); cRound(g, nx, c.y + bh - 16, bw, 6, 3, color || CARD_C.gold);
  }
  c.y += h + (opt.gap || 0);
}
function cColHead(c, cols) { cols.forEach(function (x) { cText(c.g, x[0], x[1] - 24, c.y + 4, 22, 700, CARD_C.sub, "right"); }); c.y += 16; }
function cTiles(c, tiles) {   // 2×N 숫자 타일 (흰 박스)
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, gap = 18, tw = (W - gap) / 2, th = 170;
  tiles.forEach(function (t, i) {
    var x = P + (i % 2) * (tw + gap), y = c.y + Math.floor(i / 2) * (th + gap);
    cBox(g, x, y, tw, th, 18);
    cText(g, t.v, x + 28, y + 76, 50, 800, t.color || CARD_C.navy);
    cWrap(g, t.l, x + 28, y + 118, tw - 56, 23, 500, CARD_C.txt2, 30, 2);
  });
  c.y += Math.ceil(tiles.length / 2) * (th + gap);
}
/* 표: head=["구분","10년",...], rows=[["2천만원 이하","2.85%",...],...]. 첫 열은 왼쪽 정렬·굵게, 나머지는 가운데. [[..]]는 금색 강조. opt: {w:[비율...], rowH, fs, hi:[행번호]} */
function cTable(c, head, rows, opt) {
  opt = opt || {}; var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, n = head.length;
  var ratio = opt.w || head.map(function (_, i) { return i === 0 ? 1.6 : 1; }), sum = ratio.reduce(function (a, b) { return a + b; }, 0);
  var cw = ratio.map(function (r) { return W * r / sum; }), rh = opt.rowH || 58, fs = opt.fs || 24, hh = rh;
  var total = hh + rows.length * rh;
  cBox(g, P, c.y, W, total, 16);
  g.save(); g.beginPath(); cRound(g, P, c.y, W, total, 16, null); g.clip();
  g.fillStyle = CARD_STYLE === "event" ? CARD_C.black : CARD_C.navy; g.fillRect(P, c.y, W, hh);
  var x = P;
  head.forEach(function (h, i) { cText(g, h, i === 0 ? x + 22 : x + cw[i] / 2, c.y + hh / 2 + fs * 0.36, fs - 2, 800, CARD_C.onNavy, i === 0 ? "left" : "center"); x += cw[i]; });
  rows.forEach(function (r, ri) {
    var y = c.y + hh + ri * rh;
    if (ri % 2) { g.fillStyle = "#f8f5ee"; g.fillRect(P, y, W, rh); }
    if (opt.hi && opt.hi.indexOf(ri) >= 0) { g.fillStyle = CARD_C.goldDim; g.fillRect(P, y, W, rh); }
    x = P;
    r.forEach(function (v, i) {
      var txt = cFit(g, cPlain(String(v)), cw[i] - 24, fs, i === 0 ? 700 : 600), gold = /\[\[/.test(String(v));
      cText(g, txt, i === 0 ? x + 22 : x + cw[i] / 2, y + rh / 2 + fs * 0.36, fs, i === 0 ? 700 : 600, gold ? CARD_C.warmTxt : i === 0 ? CARD_C.txt : CARD_C.txt2, i === 0 ? "left" : "center");
      x += cw[i];
    });
    g.strokeStyle = CARD_C.line; g.lineWidth = 1; g.beginPath(); g.moveTo(P, y + rh); g.lineTo(P + W, y + rh); g.stroke();
  });
  g.restore();
  c.y += total + 22;
}
/* 글머리 목록 박스 (정책 카드의 '추가 조건' 등) */
function cBullets(c, title, items, opt) {
  opt = opt || {}; var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, fs = opt.fs || 23, lh = fs + 11;
  var lines = [];
  items.forEach(function (t) { var n = cWrapCount(g, t, W - 90, fs, 500); lines.push({ t: t, n: n }); });
  var h = (title ? 50 : 20) + lines.reduce(function (a, l) { return a + l.n * lh + 8; }, 0) + 10;
  cBox(g, P, c.y, W, h, 16);
  var y = c.y + (title ? 44 : 14);
  if (title) cText(g, title, P + 26, y, fs, 800, CARD_C.warmTxt);
  y += title ? 18 : 10;
  lines.forEach(function (l) { cText(g, "•", P + 28, y + fs, fs, 800, CARD_C.gold); cWrap(g, l.t, P + 56, y + fs, W - 90, fs, 500, CARD_C.txt2, lh, l.n); y += l.n * lh + 8; });
  c.y += h + 22;
}
function cWrapCount(g, s, maxW, size, weight) { cFont(g, size, weight); var n = 1, line = "", ch = String(s).split(""); for (var i = 0; i < ch.length; i++) { var t = line + ch[i]; if (g.measureText(t).width > maxW && line) { n++; line = ch[i]; } else line = t; } return n; }
/* ---------- 한눈에 보는 판 도구 (v8.9) ---------- */
/* 가로 막대 + 기준선(점선) + 오른쪽 큰 값 */
function cBarH(c, label, sub, pct, ref, refLabel, valTxt) {
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, y = c.y, v = Math.round(pct * 1000) / 10;
  cText(g, label, P, y + 34, 28, 800, CARD_C.txt); cText(g, sub, P + cW(g, label, 28, 800) + 12, y + 34, 20, 500, CARD_C.sub);
  cText(g, valTxt || (v.toFixed(1) + "%"), P + W, y + 40, 46, 800, CARD_C.warmTxt, "right");
  var ty = y + 58, th = 30;
  cRound(g, P, ty, W, th, 8, "#e9e4d8"); cRound(g, P, ty, Math.max(8, W * Math.min(1, pct)), th, 8, CARD_C.gold2);
  if (ref != null) { var rx = P + W * ref; g.save(); g.setLineDash([6, 6]); g.strokeStyle = "#444"; g.lineWidth = 3; g.beginPath(); g.moveTo(rx, ty - 8); g.lineTo(rx, ty + th + 8); g.stroke(); g.restore(); cText(g, refLabel || "", rx + 10, ty + th / 2 + 7, 19, 600, "#444"); }
  c.y = ty + th + 34;
}
/* 작은 가로 막대 (한 줄: 라벨 · 부가 · 막대 · 값) — 분포 같은 여러 줄용 */
function cBarHS(c, label, sub, pct, valTxt) {
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, y = c.y, lw = 300;
  cText(g, label, P, y + 30, 23, 800, CARD_C.txt); cText(g, sub, P, y + 56, 18, 500, CARD_C.sub);
  var bx = P + lw, bw = W - lw - 130;
  cRound(g, bx, y + 22, bw, 26, 6, "#e9e4d8"); cRound(g, bx, y + 22, Math.max(6, bw * Math.min(1, pct)), 26, 6, CARD_C.gold2);
  cText(g, valTxt, P + W, y + 44, 30, 800, CARD_C.warmTxt, "right");
  c.y = y + 74;
}
/* 읽는 법 상자 (회색) — 제목 줄 + 본문 */
function cHow(c, title, text) {
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, n = cWrapCount(g, text, W - 56, 22, 500), h = 44 + n * 31 + 22;
  if (c.y + h > CARD.H - 96) { n = Math.max(1, Math.floor((CARD.H - 96 - c.y - 66) / 31)); h = 44 + n * 31 + 22; if (n < 1) return; }
  cRound(g, P, c.y, W, h, 14, "#ece8df"); cText(g, title, P + 28, c.y + 36, 22, 800, CARD_C.txt);
  cWrap(g, text, P + 28, c.y + 70, W - 56, 22, 500, CARD_C.txt2, 31, n);
  c.y += h + 18;
}
/* 저울형 비교: 왼쪽 큰 숫자(초록) · 가운데 비율 막대(가운데 점선) · 오른쪽 큰 숫자(빨강) — 칸 채우기 대신 (v9.1) */
function cCompare2(c, a, b) {
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, y = c.y, tot = Math.max(1, a.v + b.v), p = a.v + b.v ? a.v / tot : 0.5;
  cText(g, String(a.v), P, y + 84, 96, 800, "#2e7d4f"); cText(g, a.l, P, y + 118, 22, 700, "#2e7d4f"); cText(g, a.s, P, y + 146, 19, 500, CARD_C.txt2);
  cText(g, String(b.v), P + W, y + 84, 96, 800, "#b4342b", "right"); cText(g, b.l, P + W, y + 118, 22, 700, "#b4342b", "right"); cText(g, b.s, P + W, y + 146, 19, 500, CARD_C.txt2, "right");
  var lw = Math.max(cW(g, String(a.v), 96, 800), cW(g, a.l, 22, 700), cW(g, a.s, 19, 500)), rw = Math.max(cW(g, String(b.v), 96, 800), cW(g, b.l, 22, 700), cW(g, b.s, 19, 500));
  var bx = P + lw + 30, bw = W - lw - rw - 60, by = y + 60;
  if (bw > 120) { cRound(g, bx, by, bw, 22, 11, "#b4342b"); cRound(g, bx, by, Math.max(0, bw * p), 22, 11, "#2e7d4f"); g.save(); g.setLineDash([6, 6]); g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = 3; g.beginPath(); g.moveTo(bx + bw / 2, by - 10); g.lineTo(bx + bw / 2, by + 32); g.stroke(); g.restore(); cText(g, Math.round(p * 100) + " : " + Math.round((1 - p) * 100), bx + bw / 2, by + 62, 20, 600, CARD_C.sub, "center"); }
  c.y = y + 170;
}
/* 두 줄 목록 (좌/우) — 왼쪽 색 띠 + 이름 + 회색 부가 (v9.1) */
function cTwoLists(c, L, R) {
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, gap = 24, cw = (W - gap) / 2, y0 = c.y, maxY = c.y;
  [[L, P, "#2e7d4f"], [R, P + cw + gap, "#b4342b"]].forEach(function (k) {
    var lst = k[0], x = k[1], y = y0, col = k[2];
    cText(g, lst.title, x, y + 22, 21, 800, col); y += 34;
    if (lst.head) { cText(g, cFit(g, lst.head, cw, 16, 500), x, y + 14, 16, 500, CARD_C.sub); y += 24; }
    if (!lst.items.length) { cText(g, "해당 없음", x + 14, y + 26, 20, 500, CARD_C.sub); y += 40; }
    lst.items.forEach(function (it) { cRound(g, x, y + 6, 5, 50, 2, col); cText(g, cFit(g, it[0], cw - 20, 23, 800), x + 16, y + 28, 23, 800, CARD_C.txt); cText(g, cFit(g, it[1] + " · " + it[2], cw - 20, 17, 500), x + 16, y + 52, 17, 500, CARD_C.txt2); y += 64; });
    if (y > maxY) maxY = y;
  });
  c.y = maxY + 10;
}
/* 남은 공간에 n줄이 들어가도록 행 높이 계산 (note=true면 하단 안내 한 줄 자리 확보) */
function cH(c, n, max, note, extra) { return Math.max(56, Math.min(max, Math.floor((CARD.H - (note ? 150 : 100) - c.y - (extra || 0)) / Math.max(1, n)))); }
function cNote(c, s) { var g = c.g, P = CARD.PAD; c.hasNote = true; cWrap(g, s, P, CARD.H - 118, CARD.W - P * 2, 22, 500, CARD_C.txt2, 30, 2); }
function cPara(c, s) { var g = c.g, P = CARD.PAD, W = CARD.W - P * 2; var y1 = cWrap(g, s, P + 28, c.y + 44, W - 56, 25, 500, CARD_C.txt2, 36, 3); cBox(g, P, c.y + 6, W, y1 - c.y + 4, 16); cWrap(g, s, P + 28, c.y + 44, W - 56, 25, 500, CARD_C.txt2, 36, 3); c.y = y1 + 26; }
function cLabel(c, s, color) { cText(c.g, s, CARD.PAD + 4, c.y + 28, 24, 800, color && color !== CARD_C.txt2 && color !== CARD_C.gold ? color : CARD_C.navy); c.y += 40; }
function cBar(c, pct, h) {   // 금색 진행 막대
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2; h = h || 16;
  cRound(g, P, c.y, W, h, 8, "#e3ddd0");
  var lg = g.createLinearGradient(P, 0, P + W, 0); lg.addColorStop(0, "#b08d3e"); lg.addColorStop(1, CARD_C.gold2);
  cRound(g, P, c.y, Math.max(h, W * Math.max(0, Math.min(1, pct))), h, 8, lg);
  c.y += h;
}

/* ---------- 빈 공간 채우기 ----------
   카드마다 결과값(종목 수·제목 길이)이 달라 아래쪽이 비는 날이 있다.
   다 그린 뒤 남은 높이를 재서 ① 그 카드의 '읽는 법' 해설 박스 → ② 그래도 남으면 우상향 산 일러스트 순으로 채운다. */
var CARD_TIP = {
  "1_시장온도": ["오른 종목 비율을 보는 이유", "지수는 큰 회사 몇 개가 끌어올릴 수 있어요. 오른 종목 비율은 시장 전체가 같이 움직였는지를 보여줘요. 지수는 올랐는데 비율이 낮다면, 일부 대형주만 오른 날이에요."],
  "2_테마흐름": ["업종 흐름 읽는 법", "막대는 업종 평균 등락이에요. 업종 1등이 크게 올랐는데 평균이 낮다면, 업종 전체가 아니라 그 종목만의 이슈일 가능성이 커요."],
  "2_전체시세": ["코인 시세 읽는 법", "코인은 24시간 거래돼서 '하루 등락'은 매일 같은 시각을 기준으로 잘라 계산해요. 주식보다 하루 변동이 훨씬 큰 편이라, 하루 숫자보다 한 달 흐름을 같이 보는 게 좋아요."],
  "3_급등급락": ["급등·급락을 볼 때", "먼저 이유를 나눠 보세요. 실적·계약 같은 회사 뉴스인지, 시장 전체 분위기인지. 뒤따라 사기 전에는 '이미 얼마나 올랐나'부터 확인하는 습관이 가장 큰 방패예요."],
  "4_인기종목": ["'평소의 몇 배'란", "최근 거래대금을 지난 한 달 평균과 비교한 값이에요. 2배가 넘으면 평소보다 관심이 확 몰렸다는 뜻이고, 그만큼 가격도 크게 흔들리기 쉬워요."],
  "5_오늘의숫자": ["52주 최고가 대비란", "지난 1년 중 가장 비쌌던 가격과 비교해 지금 얼마나 내려와 있는지예요. 많이 내려왔다는 건 '싸졌다'는 사실일 뿐, 바닥이라는 뜻은 아니에요."],
  "6_심리온도": ["이 온도계 쓰는 법", "'공포일 때 사고 탐욕일 때 조심하라'는 말이 있지만, 온도는 며칠씩 극단에 머물기도 해요. 매매 신호보다 지금 내 감정을 점검하는 거울로 쓰세요."],
  "7_1년전100만원": ["같은 1년, 다른 결과", "같은 기간에도 자산마다 결과가 크게 갈렸어요. 1년은 운이 크게 작용하는 짧은 기간이에요. 3년·5년으로 늘리면 순위가 또 바뀌어요."],
  "8_매달10만원": ["적립식의 핵심", "가격이 떨어진 달엔 같은 돈으로 더 많이 사게 돼요. 그래서 중간에 크게 떨어졌다가 회복한 자산일수록 적립식 결과가 좋아지는 경우가 많아요."],
  "1_미국증시": ["한국 투자자가 같이 볼 것", "미국 주식은 주가와 환율이 함께 수익률을 정해요. S&P500이 올라도 달러/원이 내리면 원화로 계산한 수익은 줄어들어요."],
  "2_MDD": ["MDD(최대 낙폭)란", "가장 높았던 때보다 지금 얼마나 내려와 있는지예요. '○위/○회'는 지난 10년간 10% 넘게 빠졌던 구간 중 지금이 몇 번째로 깊은지를 뜻해요."],
  "3_자산배분": ["왜 나눠 담을까", "주식·채권·금은 서로 다른 이유로 오르내려요. 한쪽이 빠질 때 다른 쪽이 버텨주면 계좌 전체의 흔들림이 줄어, 끝까지 버티기 쉬워져요."],
  "4_구성비교": ["낙폭을 같이 보는 이유", "수익률이 높아도 중간에 -30%를 견디지 못하면 그 수익은 내 것이 되지 않아요. 괄호 속 최대 낙폭을 함께 보세요."],
  "5_과거사례": ["과거 사례 보는 법", "비슷한 상황이라도 결과는 매번 조금씩 달랐어요. 정답을 찾기보다 '그때 무엇이 버텨줬나'를 확인하는 용도예요."],
  "mind": ["4글자 읽는 법", "P 지키기 · G 불리기  /  D 숫자 · S 이야기  /  C 침착 · R 민감  /  L 장기 · T 타이밍. 정답 유형은 없어요. 내 성향의 약점을 아는 게 핵심이에요."]
};
function cFill(c, tip) {
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, bottom = CARD.H - (c.hasNote ? 150 : 96), top = c.y + 6;
  function nLines(txt) {
    cFont(g, 23, 500); var n = 0, line = "", ch = txt.split("");
    for (var i = 0; i < ch.length; i++) { var t = line + ch[i]; if (g.measureText(t).width > W - 64 && line) { n++; line = ch[i]; } else line = t; }
    return n + 1;
  }
  if (tip && bottom - top >= 110) {
    var sent = tip[1].match(/[^.!?]+[.!?]?\s*/g) || [tip[1]], pick = null;
    for (var k = sent.length; k >= 1 && !pick; k--) {
      var txt = sent.slice(0, k).join("").trim(), L = nLines(txt), bh = 74 + L * 33;
      if (bh <= bottom - top) pick = { txt: txt, L: L, bh: bh };
    }
    if (pick) {
      var by = top;   // 본문 바로 아래에 붙이고, 남는 공간은 아래 장식으로
      cBox(g, P, by, W, pick.bh, 16);
      cText(g, "알아두면 좋은 점", P + 28, by + 42, 23, 800, CARD_C.warmTxt);
      cWrap(g, pick.txt, P + 28, by + 80, W - 56, 23, 500, CARD_C.txt2, 33, pick.L);
      top = by + pick.bh + 18;
    }
  }
  // v8.5: 빈 공간 장식(막대+곡선)은 산만해서 뺐다 — 남는 공간은 비워 둔다
}
/* 우상향 막대 + 금색 곡선 (TrackApt 카드 아래쪽 장식과 같은 느낌) */
function cArt(g, x, y, w, h) {
  g.save();
  var base = y + h, n = 7, bw = w * 0.07, gapx = (w * 0.6 - bw * n) / (n - 1), hs = [0.12, 0.2, 0.16, 0.3, 0.26, 0.42, 0.5];
  for (var i = 0; i < n; i++) { var bh = h * hs[i] * 0.9; cRound(g, x + i * (bw + gapx), base - bh, bw, bh, 4, "rgba(31,42,68,0.07)"); }
  g.strokeStyle = CARD_C.gold; g.lineWidth = 4; g.lineCap = "round";
  g.beginPath(); g.moveTo(x + w * 0.55, base - h * 0.1); g.bezierCurveTo(x + w * 0.75, base - h * 0.12, x + w * 0.85, base - h * 0.55, x + w, base - h * 0.82); g.stroke();
  g.restore();
}
/* ---------- 긴 기간 데이터 (1년 전·적립식 카드용) ---------- */
/* 1년 전 100만원 / 매달 10만원 카드에 쓰는 종목 — 사람들이 실제로 많이 사는 대표 ETF 위주 + 대표 종목 둘 + 비트코인 (v8.5) */
var CARD_SETS = {
  all: ["SPY", "QQQ", "SCHD", "TLT", "GLD", "360750.KS", "133690.KS", "069500.KS", "005930.KS", "BTC-USD"],
  kr: ["069500.KS", "360750.KS", "133690.KS", "132030.KS", "005930.KS", "000660.KS", "005380.KS", "035420.KS", "207940.KS", "373220.KS"],
  us: ["SPY", "QQQ", "SCHD", "TLT", "GLD", "JEPI", "NVDA", "AAPL", "MSFT", "TSLA"],
  coin: ["BTC-USD", "ETH-USD", "XRP-USD", "SOL-USD", "BNB-USD", "DOGE-USD", "ADA-USD", "TRX-USD", "LINK-USD", "AVAX-USD"]
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
  var g = c.g, cx = CARD.W / 2, cy = c.y + 250, r = 250, cols = ["#2f6fd6", "#8fa9c9", "#b9b3a8", CARD_C.gold, CARD_C.up];
  g.lineWidth = 44; g.lineCap = "butt";
  for (var i = 0; i < 5; i++) {
    g.beginPath(); g.strokeStyle = cols[i]; g.globalAlpha = 0.85;
    g.arc(cx, cy, r, Math.PI + Math.PI * i / 5 + 0.012, Math.PI + Math.PI * (i + 1) / 5 - 0.012); g.stroke();
  }
  g.globalAlpha = 1;
  var a = Math.PI + Math.PI * Math.max(0, Math.min(100, score)) / 100;
  g.strokeStyle = CARD_C.navy; g.lineWidth = 8; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 64), cy + Math.sin(a) * (r - 64)); g.stroke();
  g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.fillStyle = CARD_C.gold; g.fill();
  cText(g, "공포", cx - r, cy + 50, 24, 600, CARD_C.sub, "center"); cText(g, "탐욕", cx + r, cy + 50, 24, 600, CARD_C.sub, "center");
  cText(g, String(score), cx, cy + 112, 84, 800, CARD_C.navy, "center");
  cText(g, "/ 100", cx + cW(g, String(score), 84, 800) / 2 + 12, cy + 112, 26, 600, CARD_C.sub);
  c.y = cy + 136;
}

/* ---------- 오늘의 브리핑 카드 (8장) ---------- */
function cardsBrief() {
  var R = briefState.result; if (!R) return [];
  var M = R.market || "all", MN = M !== "all" ? R.mktName + " " : "";
  var out = [], T = 9, date = cDate(M === "kr" ? R.asOfKr : (R.asOfUs || R.asOf)), L = R.label, P = CARD.PAD;
  var TG = function (s) { return s + (MN ? " · " + MN.trim() : "") + " · " + date; };
  // 1. 표지 — 시장 온도
  var c = cNew(), t = R.temp;
  cHero(c, TG("DAILY BRIEF"), L + " " + MN + "시장은", t.word, CARD_C.gold, "오른 종목 " + Math.round(t.upPct * 100) + "%  ·  " + t.up + " / " + t.total + "개", 1, T);
  cBar(c, t.upPct); c.y += 30;
  var ir = R.indexRow.slice(0, M === "coin" ? 9 : 6), ih = cH(c, ir.length, 72, false, 100);
  ir.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: ih, price: cPrice(x.sym, x.last) }); });
  cPara(c, t.desc);
  cFoot(c, null, "1_시장온도"); out.push({ name: "1_시장온도", cv: c.cv });
  // 1-2. 시장 체력 — 20·50·200일선 위 비율을 기준선 있는 가로 막대로 (v8.9, 한눈에 보는 판)
  c = cNew();
  var hp = Math.round(t.abovePct * 1000) / 10, find = t.n200 && t.above200Pct != null ? (t.abovePct < 0.4 && t.above200Pct >= 0.5 ? "장기 추세는 살아 있는데 [[단기는 눌렸어요]]" : t.abovePct >= 0.5 && t.above200Pct < 0.4 ? "단기 반등은 넓지만 [[장기 추세는 아직 아래]]" : t.abovePct >= 0.6 && t.above200Pct >= 0.6 ? "단기·장기 추세 모두 [[절반을 넘어요]]" : "20일선 위 종목 [[" + hp + "%]] — " + (t.abovePct >= 0.5 ? "절반 이상" : "절반 미만")) : "20일선 위 종목 [[" + hp + "%]] — " + (t.abovePct >= 0.5 ? "절반 이상" : "절반에 못 미쳐요");
  cHead(c, TG("시장 체력"), find, "'추세 위' = 주가가 20·50·200일 이동평균선 위 · " + t.total + "개 집계 · 50% 선은 비교선이지 매수·매도 기준이 아니에요", 2, T);
  cBarH(c, "20일선 위", "단기 추세", t.abovePct, 0.5, "절반 50%");
  if (t.n50) cBarH(c, "50일선 위", "중기 추세", t.above50Pct, 0.5, "절반 50%");
  if (t.n200) cBarH(c, "200일선 위", "장기 추세", t.above200Pct, 0.5, "절반 50%"); else cSummary(c, "200일선은 1년치 데이터가 쌓인 뒤 표시돼요");
  cHow(c, "읽는 법", "20·50·200일 평균 가격보다 위에 있는 종목의 비율이에요. 지수는 올랐는데 비율이 낮으면 몇 개 큰 종목이 끌어올린 날이고, 비율이 높으면 넓게 오른 날이에요. 막대는 시장 참여 정도일 뿐 신호가 아니에요.");
  var ir2 = R.indexRow.slice(0, 4); if (ir2.length && c.y + ir2.length * 56 < CARD.H - 100) { cLabel(c, "같은 날 지수"); ir2.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: 56, price: cPrice(x.sym, x.last) }); }); }
  cFoot(c, null); out.push({ name: "2_시장체력", cv: c.cv });
  // 2. 테마 — 업종 평균 + 그 업종 1등 종목과 주가 (코인처럼 업종이 2개 미만이면 전체 시세표)
  c = cNew(); var th = R.themes, top = th[0], bot = th[th.length - 1];
  if (th.length < 2) {
    var all = R.movers.up.concat(R.movers.down.slice().reverse()).slice(0, 10);
    cHead(c, TG("PRICE"), MN + "전체 " + L + " 등락", "종목 · 지금 가격 · " + L + " 등락", 3, T);
    var ah = cH(c, all.length, 84);
    all.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ah, price: cPrice(s.sym, s.last) }); });
    cFoot(c, null, "2_전체시세"); out.push({ name: "2_전체시세", cv: c.cv });
  } else {
    cHead(c, TG("MONEY FLOW"), "[[" + top.name + "]] 강세, " + bot.name + " 약세", "업종 평균 등락 · 업종 안에서 가장 많이 오른 종목과 주가", 3, T);
    var mx = Math.max.apply(null, th.map(function (x) { return Math.abs(x.ret); })) || 0.01;
    var th10 = th.slice(0, 12), hh = cH(c, th10.length, 84);
    th10.forEach(function (x) { var b = x.best; cRow(c, x.name, cPct(x.ret), cCol(x.ret), { bar: x.ret / mx, h: hh, noLine: true, priceSize: 22, price: b ? briefName(b) + " " + cPrice(b.sym, b.last) + " " + cPct(b.ret) : "" }); });
    cFoot(c, null, "2_테마흐름"); out.push({ name: "2_테마흐름", cv: c.cv });
  }
  // 3. 급등·급락
  c = cNew(); var up = R.movers.up.slice(0, 7), dn = R.movers.down.slice(0, 7);
  if (!up[0] && !dn[0]) return out;
  cHead(c, TG("TOP MOVERS"), up[0] ? "1위 [[" + briefName(up[0]) + " " + cPct(up[0].ret) + "]]" : "오른 종목이 없어요",
    dn[0] ? "가장 많이 내린 종목은 " + briefName(dn[0]) + " " + cPct(dn[0].ret) : "내린 종목이 없어요", 4, T);
  var mh = cH(c, up.length + dn.length, 72, false, 100);
  if (up.length) cLabel(c, "▲ 급등", CARD_C.up);
  up.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.up, { rank: i + 1, h: mh, price: cPrice(s.sym, s.last) }); });
  if (dn.length) { c.y += 14; cLabel(c, "▼ 급락", CARD_C.down); }
  dn.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.down, { rank: i + 1, h: mh, price: cPrice(s.sym, s.last) }); });
  cFoot(c, null, "3_급등급락"); out.push({ name: "3_급등급락", cv: c.cv });
  // 4. 인기 종목
  c = cNew(); var pop = R.popular.filter(function (s) { return !/^\^|=X$/.test(s.sym); }).slice(0, 10);
  var hot = pop.filter(function (s) { return s.amtX != null && s.amtX >= 1.5; }).sort(function (a, b) { return b.amtX - a.amtX; });
  cHead(c, TG("HOT"), hot.length ? "[[" + briefName(hot[0]) + "]]에 돈이 몰렸어요" : "많이 찾는 종목의 " + L, "주가 · 등락 (작은 글씨: 거래대금이 평소의 몇 배인지)", 5, T);
  var ph = cH(c, pop.length, 84);
  pop.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ph, price: cPrice(s.sym, s.last), mid: s.amtX != null ? s.amtX.toFixed(1) + "배" : "" }); });
  cFoot(c, R.popSrc === "ranked" ? "앱 조회 순위 · 투자 조언 아님" : "거래대금 기준 · 투자 조언 아님", "4_인기종목"); out.push({ name: "4_인기종목", cv: c.cv });
  // 5. 숫자 + 세일 폭 큰 종목
  c = cNew(); var nums = R.numbers.slice(0, 4), sale = (nums[0].list || []).filter(function (s) { return !/^\^|=X$/.test(s.sym); });
  // 5. 세일 중인 종목 — 상세 1쪽: 가장 많이 할인된 10개 (고점比 막대 · 가격 · 오늘 · 20일선)
  var saleN = sale.length, s10 = sale.slice(0, 10);
  cHead(c, TG("NUMBERS · 세일"), "세일 중인 종목 [[" + saleN + "개]] / " + R.count, "52주 최고가보다 20% 넘게 싼 종목 · 막대는 고점 대비 거리 · 회색은 지금 가격 · 오늘 등락 · 20일선", 6, T);
  if (s10.length) {
    var mxS = Math.max.apply(null, s10.map(function (x) { return Math.abs(x.vsHi); })) || 0.5, sh = cH(c, s10.length, 76, true);
    s10.forEach(function (x, i) { cRow(c, briefName(x), cPct(x.vsHi, 0), CARD_C.down, { rank: i + 1, h: sh, bar: x.vsHi / mxS, price: cPrice(x.sym, x.last), mid: L + " " + cPct(x.ret1 != null ? x.ret1 : x.ret) + " · " + (x.above20 ? "20일선 위" : "20일선 아래"), noLine: true }); });
  } else cSummary(c, "52주 고점 대비 -20% 아래인 종목이 없어요");
  cNote(c, "싸졌다는 건 사실이지만 더 안 내린다는 뜻은 아니에요. 20일선 위로 올라선 종목은 '내림세가 멈췄나'의 첫 신호예요.");
  cFoot(c, null); out.push({ name: "5_세일중", cv: c.cv });
  // 5-2. 고점과의 거리 분포 — 상세 2쪽: 전체 종목이 고점에서 얼마나 떨어져 있나 (구간별 개수 막대) + 추세·심리 타일
  c = cNew(); var allS = (nums[0].list || []).concat(nums[1].list || [], (nums[2].list || []), (nums[2].list2 || []));
  var seen = {}, uni = []; allS.forEach(function (x) { if (!seen[x.sym] && x.vsHi != null && !/^\^|=X$/.test(x.sym)) { seen[x.sym] = 1; uni.push(x); } });
  var bins = [["고점 근처 (0~-5%)", 0, -0.05], ["-5 ~ -10%", -0.05, -0.1], ["-10 ~ -20%", -0.1, -0.2], ["-20 ~ -30%", -0.2, -0.3], ["-30 ~ -50%", -0.3, -0.5], ["-50% 아래", -0.5, -1]];
  var cnt = bins.map(function (b) { return uni.filter(function (x) { return x.vsHi <= b[1] + 1e-9 && x.vsHi > b[2]; }).length; }), mxC = Math.max.apply(null, cnt) || 1;
  var med = uni.slice().sort(function (a, b) { return a.vsHi - b.vsHi; })[Math.floor(uni.length / 2)];
  cHead(c, TG("NUMBERS · 분포"), "종목 절반이 고점 대비 [[" + (med ? cPct(med.vsHi, 0) : "-") + "]] 아래", uni.length + "개 종목이 52주 최고가에서 얼마나 떨어져 있나 — 구간별 개수 · 중앙값 " + (med ? cPct(med.vsHi, 0) : "-"), 7, T);
  bins.forEach(function (b, i) { cBarHS(c, b[0], Math.round(cnt[i] / Math.max(1, uni.length) * 100) + "% of " + uni.length, cnt[i] / mxC, cnt[i] + "개"); });
  c.y += 12; cTiles(c, [{ v: nums[2].v, l: "20일 평균선 위 종목 비율" }, { v: nums[3] ? nums[3].v : "-", l: nums[3] ? nums[3].l : "VIX 공포지수" }]);
  cHow(c, "읽는 법", "왼쪽 구간일수록 고점 가까이, 오른쪽일수록 깊게 빠진 종목이에요. 오른쪽이 두꺼우면 시장이 넓게 눌려 있고, 왼쪽이 두꺼우면 넓게 강한 구간이에요. 매수·매도 기준이 아니에요.");
  cFoot(c, null); out.push({ name: "5_고점거리분포", cv: c.cv });
  // 6. 신고가·신저가 (1년치가 있을 때) / 없으면 숫자 뒤의 종목
  c = cNew();
  if (t.n200) {
    var nh = t.newHigh.length, nl = t.newLow.length, tot2 = Math.max(1, nh + nl);
    var f2 = nh === 0 && nl === 0 ? "오늘 52주 신고가·신저가 종목이 [[없어요]]" : nh >= nl ? "신고가 종목이 신저가보다 [[" + (nl ? (nh / nl).toFixed(1) + "배 많아요" : nh + "개 많아요") + "]]" : "신저가 종목이 신고가보다 [[" + (nh ? (nl / nh).toFixed(1) + "배 많아요" : nl + "개 많아요") + "]]";
    cHead(c, TG("신고가·신저가"), f2, "52주 종가 기준 신고가 " + nh + " · 신저가 " + nl + " · 근접(3% 이내) " + t.nearHigh.length + " / " + t.nearLow.length, 8, T);
    cCompare2(c, { l: "▲ 52주 종가 신고가", v: nh, s: "신고가 근접(3% 이내) " + t.nearHigh.length }, { l: "▼ 52주 종가 신저가", v: nl, s: "신저가 근접(3% 이내) " + t.nearLow.length });
    cTwoLists(c, { title: "▲ " + (nh ? "신고가" : "신고가 근접") + " 주요 5 · 거래대금 순", head: "종목 · 오늘 종가 / 1년 최고 · 거래대금", items: (nh ? t.newHigh : t.nearHigh).slice(0, 5).map(function (s) { return [briefName(s), cPrice(s.sym, s.last) + " / " + cPrice(s.sym, s.hi250), briefAmtTxt(s)]; }) },
      { title: "▼ " + (nl ? "신저가" : "신저가 근접") + " 주요 5 · 거래대금 순", head: "종목 · 오늘 종가 / 1년 최저 · 거래대금", items: (nl ? t.newLow : t.nearLow).slice(0, 5).map(function (s) { return [briefName(s), cPrice(s.sym, s.last) + " / " + cPrice(s.sym, s.lo250), briefAmtTxt(s)]; }) });
    cHow(c, "읽는 법", "오늘 종가가 지난 1년 종가 중 최고/최저면 신고가/신저가예요. 신고가가 많다고 비싸다가 아니고, 신저가가 많다고 싸다가 아니에요 — 어느 쪽이 넓게 늘어나는지를 봐요.");
    cFoot(c, null); out.push({ name: "6_신고가신저가", cv: c.cv });
  } else {
    var ath = (nums[1].list || []).slice(0, 4), abv = (nums[2].list || []).slice().sort(function (a, b) { return (b.amt || 0) - (a.amt || 0); }).slice(0, 4), sale4 = sale.slice(0, 4);
    cHead(c, TG("NUMBERS · 종목"), "숫자 뒤의 [[종목]]", "세일 중 " + nums[0].v + " · 신고가 근처 " + nums[1].v + " · 20일선 위 " + nums[2].v + " — 각각 대표 종목", 8, T);
    var groups = [["🏷️ 세일 중 — 52주 최고 대비 가장 많이 내린 순", sale4, function (x) { return cPct(x.vsHi, 0); }, CARD_C.down], ["🏔️ 신고가 근처 — 52주 최고 대비", ath, function (x) { return cPct(x.vsHi, 1); }, CARD_C.up], ["📈 20일선 위 — 거래대금 큰 순 · 20일 평균 대비", abv, function (x) { return cPct(x.vsMa20, 1); }, CARD_C.navy]];
    var nRows = groups.reduce(function (a, g) { return a + g[1].length; }, 0), gh = Math.max(50, Math.min(62, Math.floor((CARD.H - 150 - c.y - groups.length * 48) / Math.max(1, nRows))));
    groups.forEach(function (gr) { cLabel(c, gr[0], gr[3]); if (!gr[1].length) { cSummary(c, "해당 종목 없음"); return; } gr[1].forEach(function (x) { cRow(c, briefName(x), gr[2](x), gr[3], { h: gh, price: cPrice(x.sym, x.last), mid: L + " " + cPct(x.ret1 != null ? x.ret1 : x.ret) }); }); c.y += 6; });
    cNote(c, "세일은 '더 안 내린다'는 뜻이 아니고, 신고가는 '비싸다'는 뜻이 아니에요.");
    cFoot(c, null); out.push({ name: "6_숫자뒤종목", cv: c.cv });
  }
  // 6. 시장 심리 온도계 (자체 계산)
  c = cNew(); var md = cMood(R);
  cHead(c, TG("MOOD"), MN + "시장 심리는 [[" + md.word + "]]", "0 = 극도의 공포, 100 = 극도의 탐욕 · 아래 " + md.parts.length + "가지 숫자로 계산", 9, T);
  cGauge(c, md.score, md.word);
  var gh = cH(c, md.parts.length, 70, true);
  md.parts.forEach(function (p) { cRow(c, p.k, p.txt, CARD_C.gold, { h: gh, mid: "온도 " + Math.round(p.s * 100) }); });
  cNote(c, "극단일수록 감정적으로 사고팔기 쉬운 때예요. 방향을 맞히는 지표는 아니에요.");
  cFoot(c, "StockMind 자체 계산 · CNN 공포탐욕지수 아님", "6_심리온도"); out.push({ name: "7_심리온도", cv: c.cv });
  // (v9.0) 1년 전 100만원 · 매달 10만원 카드는 매일 올리기엔 맞지 않아 세트에서 뺐다 → 연구노트 "적금처럼 샀다면" 덱에서 만든다
  return out;
}

/* ---------- 뉴스 브리핑 카드 (v8.5) — 머니투데이식: 번호 + 굵은 제목 + 두 줄 요약, 한 장에 5개 ----------
   출처: 네이버 뉴스 검색(공식 API). 증시 마감·미국 증시·환율·금리 + 그날 급등락 종목 기사를 모아 중복을 빼고 10개. */
var CARD_NEWS = { items: [], at: 0 };
function cardsNewsFetch(R) {
  if (typeof fetchNews !== "function") return Promise.resolve([]);
  var mk = (R && R.market) || "all";
  if (CARD_NEWS.mk === mk && Date.now() - CARD_NEWS.at < 20 * 60e3 && CARD_NEWS.items.length) return Promise.resolve(CARD_NEWS.items);
  // 시장별 기사 주제 (v9.3: 코인은 코인 기사만, 미국은 미국·금리·환율, 국내는 국내 위주)
  var QS = {
    coin: [{ type: "market", cat: "coin", size: 8 }, { type: "market", cat: "coin2", size: 6 }, { type: "market", cat: "fx", size: 2 }],
    us: [{ type: "market", cat: "world", size: 8 }, { type: "market", cat: "rate", size: 4 }, { type: "market", cat: "fx", size: 3 }],
    kr: [{ type: "market", cat: "main", size: 8 }, { type: "market", cat: "market", size: 5 }, { type: "market", cat: "fx", size: 3 }]
  };
  var qs = (QS[mk] || [{ type: "market", cat: "main", size: 6 }, { type: "market", cat: "world", size: 5 }, { type: "market", cat: "fx", size: 3 }, { type: "market", cat: "rate", size: 3 }]).map(function (q) { return Object.assign({}, q); });
  var mv = R ? R.movers.up.slice(0, 2).concat(R.movers.down.slice(0, 1)) : [];
  mv.forEach(function (s) { qs.push({ type: "stock", q: briefName(s), size: 2, sym: s.sym }); });
  return Promise.all(qs.map(function (q) { return fetchNews(q).then(function (items) { return (items || []).map(function (it) { it.cat = q.cat || "stock"; return it; }); }).catch(function () { return []; }); })).then(function (lists) {
    var out = [], seen = [];
    function key(t) { return String(t).replace(/\[.*?\]|\(.*?\)|[^가-힣A-Za-z0-9]/g, "").slice(0, 18); }
    function dup(t) { var k = key(t); return seen.some(function (x) { return x === k || (k.length > 8 && (x.indexOf(k.slice(0, 10)) >= 0 || k.indexOf(x.slice(0, 10)) >= 0)); }); }
    // 카테고리를 번갈아 뽑아 한쪽으로 쏠리지 않게
    var idx = lists.map(function () { return 0; }), guard = 0;
    while (out.length < 10 && guard++ < 60) {
      var added = false;
      lists.forEach(function (l, i) { while (idx[i] < l.length && out.length < 10) { var it = l[idx[i]++]; if (!it.title || dup(it.title) || /\[속보\]|\[포토\]|\[영상\]|\[사진\]/.test(it.title)) continue; seen.push(key(it.title)); out.push(it); added = true; break; } });
      if (!added) break;
    }
    CARD_NEWS = { items: out, at: Date.now(), mk: mk };
    return out;
  });
}
function cNewsClean(t) { return String(t).replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim(); }
function cardsNews(items, dateTxt) {
  var out = [], pages = Math.ceil(items.length / 5); if (!items.length) return out;
  for (var pg = 0; pg < pages; pg++) {
    var c = cNew(), g = c.g, P = CARD.PAD, W = CARD.W - P * 2, chunk = items.slice(pg * 5, pg * 5 + 5);
    cHead(c, "NEWS BRIEFING · " + dateTxt, pg === 0 ? "아침 뉴스 브리핑 [[" + items.length + "]]" : "아침 뉴스 브리핑 [[" + (pg * 5 + 1) + "~" + Math.min(items.length, pg * 5 + 5) + "]]", null, pg + 1, pages);
    c.y -= 6;
    var avail = CARD.H - 100 - c.y, bh = Math.floor(avail / chunk.length) - 12;
    chunk.forEach(function (it, i) {
      var n = pg * 5 + i + 1, y = c.y, ttl = cNewsClean(it.title), desc = cNewsClean(it.desc || ""), meta = [it.press, it.cat === "stock" ? "종목" : ""].filter(Boolean).join(" · ");
      cBox(g, P, y, W, bh, 16);
      cText(g, String(n), P + 26, y + 52, 40, 800, CARD_C.gold);
      var tx = P + 26 + cW(g, String(n), 40, 800) + 16, tw = W - (tx - P) - 26;
      // 제목: 최대 2줄, 요약: 남는 줄 수만큼 (2~3줄)
      var ty = cWrap(g, ttl, tx, y + 48, tw, 30, 800, CARD_C.txt, 38, 2);
      var left = bh - (ty - y) - 26, dl = Math.max(0, Math.min(3, Math.floor(left / 29)));
      if (desc && dl) cWrap(g, desc, tx, ty + 2, tw, 22, 500, CARD_C.txt2, 29, dl);
      if (meta) cText(g, meta, P + W - 24, y + bh - 16, 19, 600, CARD_C.sub, "right");
      c.y += bh + 12;
    });
    cFoot(c, "출처: 네이버 뉴스 검색(각 언론사) · 제목·요약은 기사 원문 그대로 · 투자 권유 아님");
    out.push({ name: "N" + (pg + 1) + "_뉴스브리핑", cv: c.cv });
  }
  return out;
}
/* ---------- 채널 브리핑 자료 카드 (5장) ---------- */
var CARD_PLAN_COL = ["#c9a24f", "#1f2a44", "#8a6a1f", "#5b7fb0", "#9aa3b2"];
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
  cFoot(c, null, "1_미국증시"); out.push({ name: "1_미국증시", cv: c.cv });
  // 2. MDD
  c = cNew(); var rs = (chState.mdd || []).concat(chState.mddPick || []).filter(function (r) { return !r.err; }).slice(0, 9);
  var deep = rs.filter(function (r) { return r.cur <= -0.1; }).sort(function (a, b) { return a.cur - b.cur; })[0];
  cHead(c, "MDD · " + date, deep ? deep.name + " 고점 대비 [[" + cPct(deep.cur, 0) + "]]" : "대표 자산 대부분 [[고점 근처]]", "지금 주가 · 고점 대비 위치 · 작은 글씨는 역대 하락 중 깊이 순위", 2, T);
  var rh = cH(c, rs.length, 84);
  rs.forEach(function (r) { cRow(c, r.name, cPct(r.cur, 0), r.cur <= -0.1 ? CARD_C.down : CARD_C.txt, { h: rh, price: cPrice(r.sym, cLast(r.sym)), mid: r.cur <= -0.1 ? (r.deeper + 1) + "위/" + r.eps + "회" : "", bar: r.cur }); });
  cFoot(c, "10년치 데이터 · 투자 조언 아님", "2_MDD"); out.push({ name: "2_MDD", cv: c.cv });
  // 3. 지금 상황 맞춤 구성 — 4번 카드 맨 윗줄과 같은 구성
  var plan = chState.plan, pLabel = CH_PLAN_LABEL[plan.key]; c = cNew();
  cHead(c, "ALLOCATION · 지금 상황", "지금은 " + plan.title.split(" — ")[0] + " → [[" + pLabel + "]]", (chState.now && chState.now.why.length) ? "근거: " + chState.now.why.join(" / ") : "두드러진 신호가 없어 평소 균형형을 보여줘요", 3, T);
  var g = c.g, x = P;
  var prow = plan.items.map(function (it) { return { sym: it[0], name: cMixName(it[0]) + " (" + it[0] + ")", w: it[1], why: it[2] }; });
  prow.forEach(function (it, i) { var w = W * it.w / 100; cRound(g, x, c.y, Math.max(8, w - 6), 36, 8, CARD_PLAN_COL[i % 5]); x += w; });
  c.y += 66;
  var per = Math.min(120, Math.floor((CARD.H - 160 - c.y) / prow.length)), two = per >= 112;
  prow.forEach(function (it, i) {
    cBox(g, P, c.y, W, per - 10, 14);
    cRound(g, P + 22, c.y + 20, 18, 18, 5, CARD_PLAN_COL[i % 5]);
    cText(g, it.name, P + 52, c.y + 37, 28, 700, CARD_C.txt);
    cText(g, it.w + "%", CARD.W - P - 22, c.y + 38, 32, 800, CARD_C.txt, "right");
    cText(g, cPrice(it.sym, cLast(it.sym)), CARD.W - P - 110, c.y + 37, 22, 500, CARD_C.sub, "right");
    cWrap(g, it.why, P + 52, c.y + 68, W - 80, 22, 400, CARD_C.txt2, 29, two ? 2 : 1);
    c.y += per;
  });
  cNote(c, "규칙 기반 예시이며 추천이 아니에요. 다음 카드에서 다른 구성과 비교해요.");
  cFoot(c, null, "3_자산배분"); out.push({ name: "3_자산배분", cv: c.cv });
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
    cBox(gg, P, y0, W, ch - 10, 14);
    if (now) { cRound(gg, P, y0, W, ch - 10, 14, "#fff7e4"); cRound(gg, P, y0 + 8, 6, ch - 26, 3, CARD_C.gold); }
    var lx0 = P + 24 + (now ? 10 : 0);
    cText(gg, x.label, lx0, y0 + 42, 30, 800, CARD_C.txt);
    if (now) { var lw = cW(gg, x.label, 30, 800); cRound(gg, lx0 + lw + 12, y0 + 18, 58, 30, 15, CARD_C.gold); cText(gg, "지금", lx0 + lw + 41, y0 + 40, 19, 800, "#fff", "center"); }
    var mix = CH_PLANS[x.key].items.map(function (it) { return cMixName(it[0]) + " " + it[1]; }).join(" · "), mw = c1 - P - 90, ms = 23;
    while (ms > 17 && cW(gg, mix, ms, 500) > mw) ms--;
    cText(gg, cFit(gg, mix, mw, ms, 500), lx0, y0 + 74, ms, 500, CARD_C.sub);
    [[a, c1], [b, c2]].forEach(function (z) {
      cText(gg, z[0] ? cPct(z[0].ret, 0) : "-", z[1] - 24, y0 + 44, 31, 800, z[0] ? cCol(z[0].ret) : CARD_C.sub, "right");
      if (z[0]) cText(gg, "(" + cPct(z[0].mdd, 0) + ")", z[1] - 24, y0 + 74, 20, 400, CARD_C.sub, "right");
    });
    c.y += ch;
  });
  cNote(c, "기간마다 1위가 바뀌어요 — 한 가지에 몰지 않고 나눠 담는 이유예요.");
  cFoot(c, "숫자는 비중(%) · 과거 데이터 · 투자 조언 아님", "4_구성비교"); out.push({ name: "4_구성비교", cv: c.cv });
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
  cFoot(c, "과거 데이터 · 투자 조언 아님", "5_과거사례"); out.push({ name: "5_과거사례", cv: c.cv });
  return out;
}

/* ---------- 미리보기·저장 ---------- */
function cardsOpen(kind) {
  var make0 = kind === "brief" ? cardsBrief : cardsChannel;
  var make = function () {   // 맨 앞에 '오늘의 핵심 이슈 5' 표지 카드
    CARD_STYLE = kind === "brief" ? "event" : "regular";   // 오늘의 브리핑(전일 정리)은 이벤트성 → 검정 머리, 채널 자료는 정기 → 남색 머리
    CARD_SERIES = kind === "brief" ? "DAILY · 전일 정리" : "CHANNEL · " + cDate(Date.now());
    CARD_UNIT = kind === "brief" && briefState.market === "coin" ? "코인" : "";
    var list = make0();
    try {
      var iss = kind === "brief" ? (typeof issuesCompute === "function" && briefState.recent ? issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular }) : null)
        : (chState && chState.issues);
      if (list.length && iss && iss.length) list.unshift({ name: "0_핵심이슈5", cv: issuesCard(iss) });
      if (kind === "brief" && list.length && CARD_NEWS.items.length) list = list.concat(cardsNews(CARD_NEWS.items, cDate(Date.now()) + (new Date(Date.now() + 9 * 3600e3).getUTCHours() < 12 ? " 아침" : " 오후")));   // 맨 뒤에 뉴스 브리핑 1~2장
    } catch (e) { console.warn(e); }
    return list;
  };
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var btn = document.getElementById(kind === "brief" ? "briefCards" : "chCards"), old = btn ? btn.textContent : "";
  if (btn) btn.textContent = "만드는 중…";
  var mkt = kind === "brief" && typeof briefState !== "undefined" ? (briefState.market || "all") : null;
  ready.then(function () { return mkt ? cardsPrefetch(mkt) : null; }).then(function () { return kind === "brief" ? cardsNewsFetch(briefState.result).catch(function () { return []; }) : null; }).then(function () {
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
    CARD_STYLE = "regular"; CARD_SERIES = ""; CARD_UNIT = "";
    if (!list.length) { alert("아직 데이터가 다 준비되지 않았어요. 잠시 뒤 다시 눌러 주세요."); return; }
    var day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    var box = document.createElement("div");
    var mk = mkt;
    var mkHtml = mk ? '<div class="pills" style="margin-bottom:10px">' + Object.keys(BRIEF_MKT).map(function (k) {
      return '<button data-cm="' + k + '"' + (k === mk ? ' class="active"' : '') + '>' + BRIEF_MKT[k] + '</button>'; }).join("") + '</div>' : "";
    box.innerHTML = mkHtml + (typeof thrPanelHtml === "function" ? thrPanelHtml(kind === "brief" ? THR_TOPIC[mk || "all"] : "주식") : "") + '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button>' +
      (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유 (인스타·카톡)</button>' : '') +
      '<span class="briefDim">1080×1350 · 인스타 4:5 · 저장이 안 되면 이미지를 길게 눌러 저장 · 장마다 따로 올려도, 묶어서 올려도 돼요</span></div><div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    if (typeof thrBind === "function") try {
      var names = list.map(function (it) { return it.name; });
      var Rk = kind === "brief" ? briefState.result : chState.brief;
      var issK = kind === "brief" ? (typeof issuesCompute === "function" && briefState.recent ? issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular }) : []) : (chState.issues || []);
      thrBind(box, thrDaily(Rk, issK, names));
    } catch (e) { console.warn(e); }
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
