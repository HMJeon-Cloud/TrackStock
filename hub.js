/* ============================================================
   카드 허브 (v11.6) — 카드 만들기의 '오늘 할 일' · '묶음 카드'가 쓰는 주제 목록
   ① 주제 등록부 HUB: 앱에서 만들 수 있는 모든 묶음(기존 덱 + 상식/데이터 리스트 + 새 데이터 주제)
   ② 주제마다 버튼 4개: [한 장] 묶음 전체를 핵심만 꽉 채운 한 장 · [여러 장] 상세 묶음 · [AI 한 장] · [AI 여러 장]
   ③ 점수: 시장 신호·일정·요일·데이터 유무로 오늘의 주제 10개와 '선정 이유'
   ④ 새 주제(데이터): 오늘의 기사(1건 = 1장) · 이번 달 계절성 · 요일별 · 연도별 성적표 · 최악의 하루 · 10년 전 100만원 ·
      52주 신고가·신저가 · 업종 성적표 · 고점 대비 할인 · 돈이 몰린 곳 · 환율 효과
   모든 카드는 종이색 1080×1350 (연구노트 틀) — 릴스(상식 리스트)도 같은 틀로 다시 그린다
   ============================================================ */
var HUB = { cache: {}, loading: {} };
var HUB_HIST = ["SPY", "QQQ", "^KS11", "GLD", "TLT", "BTC-USD", "005930.KS", "000660.KS", "NVDA", "AAPL", "TSLA", "MSFT", "KRW=X", "^GSPC", "^VIX"];
function hubSeed() { return Math.floor((Date.now() + 9 * 3600e3) / 86400e3); }
function hubKst() { return new Date(Date.now() + 9 * 3600e3); }
function hubR() { return (typeof briefState !== "undefined" && briefState.result) || (typeof chState !== "undefined" && chState.brief) || null; }
function hubEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s); }
function hubRows(sym) { var r = (typeof nbHist !== "undefined" && nbHist[sym]) || []; return r.filter(function (x) { return x && x.c > 0 && isFinite(x.c); }); }
function hubMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function hubAvg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
function hubName(sym) { return typeof nbName === "function" ? nbName(sym) : sym; }
function hubIdx(rows, t) { var lo = 0, hi = rows.length; while (lo < hi) { var m = (lo + hi) >> 1; if (rows[m].t < t) lo = m + 1; else hi = m; } return lo; }
function hubLoad(list) { return typeof nbLoad === "function" ? nbLoad(list) : Promise.resolve(); }

/* ---------- 공용: 종이 카드 덱 그리기 (연구노트 틀) ----------
   pages: [{ top:[결론 줄], title, sub, kind:'rows'|'bars'|'tiles'|'table'|'text'|'news', data, gold:[문장, 작은 문장], foot }] */
function hubDraw(spec) {
  HUB.lastSpec = spec; HUB.lastSpecAt = Date.now();
  spec.pages = (spec.pages || []).filter(Boolean);   // v12.18 조건부 페이지(null) 허용
  var out = [], total = spec.pages.length + 2, pg = 1;
  out.push({ name: "표지", cv: nbCover(spec.small || cDate(Date.now()), spec.hook, spec.lead, spec.meta, spec.pages.map(function (p) { return p.title; })) });
  spec.pages.forEach(function (p, i) {
    var c = nbNew(); pg++;
    nbTop(c, i + 1, p.top, pg, total);
    nbBody(c, p.title, p.sub);
    hubBody(c, p);
    nbFoot(c, p.foot || spec.foot); out.push({ name: p.name || ("관찰" + (i + 1)), cv: c.cv });
  });
  out.push({ name: "마무리", cv: nbClose(spec.close[0], spec.close[1], spec.close[2]) });
  return out;
}
function hubBody(c, p) {
  var k = p.kind, d = p.data;
  if (d && typeof d === "object" && !Array.isArray(d) && p.note && !d.note) d.note = p.note;   // v12.18 새 양식이 아래 정리 상자 높이를 미리 알 수 있게
  if (k === "rows") hubRowsFill(c, d, p.leftW);
  else if (k === "rowsNote") { var keepH = NB.H; var noteH = Math.min(260, Math.max(150, 90 + cWrapCount(c.g, p.note || "", NB.W - NB.PAD * 2 - 64, 24, 700) * 36)); NB.H -= noteH; try { hubRowsFill(c, d, p.leftW); } finally { NB.H = keepH; } hubFillRest(c, p); }
  else if (k === "bars") { nbBars(c, d); hubFillRest(c, p); }
  else if (k === "tiles") { nbTiles(c, d.tiles); if (d.rows) hubRowsFill(c, d.rows, p.leftW); else hubFillRest(c, p); }
  else if (k === "table") { hubTableFill(c, d); }
  else if (k === "text") hubTextFill(c, d);
  else if (k === "line") { hubLineFill(c, d); hubFillRest(c, p); }
  else if (k === "hist") { hubHistFill(c, d); hubFillRest(c, p); }
  else if (k === "pair") { hubPairFill(c, d); hubFillRest(c, p); }
  else if (k === "gauge") { hubGaugeFill(c, d); if (d.tiles) nbTiles(c, d.tiles); hubFillRest(c, p); }
  if (p.gold && k !== "rows" && k !== "table") { var y0 = c.y; if (NB.H - 110 - y0 > 120) nbGoldLine(c, p.gold[0], p.gold[1]); }
}
/* 남은 칸을 비우지 않는다: 아래 '한 줄 정리' 상자로 채움 */
function hubFillRest(c, p) {
  var left = NB.H - 100 - c.y; if (left < 90 || !p.note) return;
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, h = Math.min(left - 20, 260);
  cRound(g, P, c.y + 10, W, h, 16, NB_C.box || "#efe9dc");
  g.fillStyle = NB_C.gold2; g.fillRect(P, c.y + 10, 8, h);
  var fs = 26; while (fs > 19 && cWrapCount(g, p.note, W - 64, fs, 700) * fs * 1.5 > h - 36) fs -= 1;
  var nl = cWrapCount(g, p.note, W - 64, fs, 700), th = nl * fs * 1.5, y0 = c.y + 10 + (h - th) / 2 + fs * 0.95;   // v11.8 세로 가운데 정렬
  cWrap(g, p.note, P + 32, y0, W - 64, fs, 700, NB_C.txt, fs * 1.5, 8);
  c.y += h + 20;
}
/* 줄 목록을 남은 높이에 꽉 맞게 (줄이 적으면 글씨를 키운다) — [왼쪽 회색, 가운데 굵게, 오른쪽 값, 색, 작은 설명] */
function hubRowsFill(c, rows, leftW) {
  rows = (rows || []).filter(Boolean); if (!rows.length) return;
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, avail = NB.H - 96 - c.y; if (avail / rows.length < 42) rows = rows.slice(0, Math.max(1, Math.floor(avail / 42)));
  var h = Math.max(42, Math.min(150, Math.floor(avail / rows.length))), y = c.y, lw = leftW || 260;
  var big = Math.min(36, Math.max(20, Math.round(h * 0.4))), small = Math.min(26, Math.max(16, Math.round(h * 0.3)));
  rows.forEach(function (r, i) {
    if (i % 2 === 0) { g.fillStyle = "rgba(20,22,28,0.035)"; g.fillRect(P - 8, y, W + 16, h); }
    var hasSub = r[4] && h >= 84, my = y + h / 2 + (hasSub ? -8 : 10);
    cText(g, cFit(g, r[0], lw - 16, small, 600), P, y + h / 2 + 8, small, 600, NB_C.sub);
    cText(g, cFit(g, r[1], W - lw - 210, big, 800), P + lw, my, big, 800, NB_C.txt);
    if (hasSub) cText(g, cFit(g, r[4], W - lw - 210, small - 2, 500), P + lw, my + small + 10, small - 2, 500, NB_C.sub);
    var vs = big + 4; while (vs > 20 && cW(g, r[2], vs, 900) > 200) vs -= 2;
    cText(g, r[2], P + W, y + h / 2 + 11, vs, 900, r[3] || NB_C.navy, "right");
    g.strokeStyle = NB_C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + h); g.lineTo(P + W, y + h); g.stroke(); y += h;
  });
  c.y = y;
}
/* 표: {cols:[..], rows:[[..]], colors(optional fn)} — 남은 높이에 꽉 */
function hubTableFill(c, d) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, cols = d.cols, rows = d.rows.filter(Boolean), n = cols.length, hh = 58;
  var ws = d.widths || cols.map(function (_, i) { return i === 0 ? 0.3 : 0.7 / (n - 1); }), xs = [P]; ws.forEach(function (w) { xs.push(xs[xs.length - 1] + w * W); });
  var rh = Math.max(44, Math.min(120, Math.floor((NB.H - 100 - c.y - hh) / Math.max(1, rows.length)))), fs = Math.min(32, Math.max(19, Math.round(rh * 0.36))), y = c.y;
  cRound(g, P, y, W, hh, 10, NB_INK); cols.forEach(function (h, i) { cText(g, cFit(g, h, xs[i + 1] - xs[i] - 12, 22, 800), (xs[i] + xs[i + 1]) / 2, y + hh / 2 + 8, 22, 800, NB_C.gold, "center"); });
  y += hh;
  rows.forEach(function (r, k) {
    if (k % 2 === 0) { g.fillStyle = "rgba(20,22,28,0.04)"; g.fillRect(P, y, W, rh); }
    r.forEach(function (v, i) { var s = String(v == null ? "-" : v), col = i === 0 ? NB_C.txt : /^[+▲]/.test(s) ? NB_C.up : /^[-▼−]/.test(s) ? NB_C.down : NB_C.txt; cText(g, cFit(g, s, xs[i + 1] - xs[i] - 14, i === 0 ? fs - 2 : fs, i === 0 ? 700 : 800), (xs[i] + xs[i + 1]) / 2, y + rh / 2 + fs * 0.36, i === 0 ? fs - 2 : fs, i === 0 ? 700 : 800, col, "center"); });
    g.strokeStyle = NB_C.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(P, y + rh); g.lineTo(P + W, y + rh); g.stroke(); y += rh;
  });
  c.y = y + 10;
  if (d.note && NB.H - 100 - c.y > 30) cText(g, cFit(g, "※ " + d.note, W, 20, 600), P, c.y + 22, 20, 600, NB_C.sub);
}
/* 글 문단 (기사 본문 등) — 남은 높이에 맞게 글씨 크기 조절 */
function hubTextFill(c, d) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, avail = NB.H - 100 - c.y - (d.tiles ? 200 : 0) - (d.after ? 130 : 0), paras = (d.paras || []).filter(Boolean);
  var fs = 34; function need() { var n = 0; paras.forEach(function (p) { n += cWrapCount(g, p, W - 56, fs, 600); }); return n * fs * 1.55 + paras.length * 18 + 40; }
  while (need() > avail && fs > 20) fs -= 1;
  while (need() < avail * 0.72 && fs < 46) fs += 1;   // v11.9 글이 짧으면 키워서 빈 곳 없이
  if (need() > avail) fs -= 1;
  var h = Math.max(140, Math.min(avail, need())); cRound(g, P, c.y, W, h, 16, "#ffffff"); g.strokeStyle = NB_C.line; g.lineWidth = 2; g.stroke();
  var y = c.y + Math.max(28, (h - need() + 40) / 2) + fs * 0.9; paras.forEach(function (p) { var k = cWrapCount(g, p, W - 56, fs, 600); cWrap(g, p, P + 28, y, W - 56, fs, 600, NB_C.txt, fs * 1.55, 30); y += k * fs * 1.55 + 18; });
  c.y += h + 16;
  if (d.tiles && d.tiles.length) { var keep = c.y; c.y -= 40; nbTiles(c, d.tiles); c.y = Math.max(c.y - 30, keep + 170); }
  if (d.after) { var g2 = c.g, ah = Math.min(120, NB.H - 96 - c.y); if (ah > 60) { cRound(g2, P, c.y, W, ah, 14, NB_INK); cText(g2, d.after[0], P + 24, c.y + 40, 20, 800, NB_C.gold); cWrap(g2, d.after[1], P + 24, c.y + 76, W - 48, 22, 600, "#f3efe6", 30, 2); c.y += ah; } }
}

/* ============================================================ v12.18 새 양식 4종 — 선(추이) · 분포 · 짝 막대(둘 비교) · 게이지(지금 위치) ============================================================ */
function hubYmd(t) { var d = new Date(t + 9 * 3600e3); return String(d.getUTCFullYear()).slice(2) + "." + (d.getUTCMonth() + 1); }
/* 선: d = { pts:[{t,v}], fmt(v), refs:[{v,label,color}], fill:true, label:'마지막 값 설명', color } — 시간 흐름을 보여줄 때 */
function hubLineFill(c, d) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, pts = (d.pts || []).filter(function (x) { return x && isFinite(x.v); }); if (pts.length < 2) { c.y += 40; return; }
  var fmt = d.fmt || function (v) { return String(Math.round(v)); }, H = Math.min(420, Math.max(220, NB.H - 110 - c.y - (d.note ? 150 : 0) - 70)), top = c.y + 44, left = P, right = P + W - 150, bottom = top + H;
  var vs = pts.map(function (x) { return x.v; }).concat((d.refs || []).map(function (r) { return r.v; })), mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs); if (mx === mn) mx = mn + 1; var pad = (mx - mn) * 0.08; mn -= pad; mx += pad;
  var X = function (i) { return left + (right - left) * i / (pts.length - 1); }, Y = function (v) { return bottom - (v - mn) / (mx - mn) * H; };
  // 격자 2줄
  g.strokeStyle = NB_C.line; g.lineWidth = 1.5; [0.33, 0.66].forEach(function (f) { var y = top + H * f; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke(); });
  // 기준선
  (d.refs || []).forEach(function (r) { var y = Y(r.v); g.save(); g.setLineDash([10, 8]); g.strokeStyle = r.color || NB_C.grey; g.lineWidth = 2; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke(); g.restore(); cText(g, r.label || fmt(r.v), right + 10, y + 8, 20, 700, r.color || NB_C.sub); });
  // 영역 + 선
  var col = d.color || NB_HI;
  if (d.fill !== false) { g.beginPath(); g.moveTo(X(0), bottom); pts.forEach(function (x, i) { g.lineTo(X(i), Y(x.v)); }); g.lineTo(X(pts.length - 1), bottom); g.closePath(); g.fillStyle = "rgba(184,145,63,0.14)"; g.fill(); }
  g.strokeStyle = col; g.lineWidth = 5; g.lineJoin = "round"; g.lineCap = "round"; g.beginPath(); pts.forEach(function (x, i) { if (i) g.lineTo(X(i), Y(x.v)); else g.moveTo(X(i), Y(x.v)); }); g.stroke();
  // 최고·최저·마지막
  var iMax = 0, iMin = 0; pts.forEach(function (x, i) { if (x.v > pts[iMax].v) iMax = i; if (x.v < pts[iMin].v) iMin = i; });
  var last = pts[pts.length - 1]; g.fillStyle = col; g.beginPath(); g.arc(X(pts.length - 1), Y(last.v), 11, 0, Math.PI * 2); g.fill(); g.fillStyle = NB_PAPER; g.beginPath(); g.arc(X(pts.length - 1), Y(last.v), 5, 0, Math.PI * 2); g.fill();
  cText(g, fmt(last.v), right + 14, Y(last.v) + 10, 30, 900, NB_C.txt);
  if (iMax !== pts.length - 1) cText(g, "최고 " + fmt(pts[iMax].v), Math.min(right - 120, Math.max(left + 60, X(iMax))), Y(pts[iMax].v) - 14, 20, 700, NB_C.sub, "center");
  if (iMin !== pts.length - 1) cText(g, "최저 " + fmt(pts[iMin].v), Math.min(right - 120, Math.max(left + 60, X(iMin))), Math.min(bottom - 8, Y(pts[iMin].v) + 32), 20, 700, NB_C.sub, "center");
  // 축 날짜
  g.strokeStyle = NB_C.sub; g.lineWidth = 2; g.beginPath(); g.moveTo(left, bottom + 2); g.lineTo(right, bottom + 2); g.stroke();
  cText(g, hubYmd(pts[0].t), left, bottom + 32, 20, 600, NB_C.sub); cText(g, hubYmd(pts[Math.floor(pts.length / 2)].t), (left + right) / 2, bottom + 32, 20, 600, NB_C.sub, "center"); cText(g, hubYmd(last.t), right, bottom + 32, 20, 600, NB_C.sub, "right");
  c.y = bottom + 50;
  if (d.label) { cText(g, cFit(g, d.label, W, 22, 600), P, c.y + 20, 22, 600, NB_C.sub); c.y += 34; }
}
/* 분포: d = { values:[], bins:n, fmt, mean:true } — 평균 하나가 아니라 퍼짐을 보여줄 때 */
function hubHistFill(c, d) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, v = (d.values || []).filter(isFinite); if (v.length < 5) { c.y += 40; return; }
  var fmt = d.fmt || function (x) { return cPct(x, 0); }, n = d.bins || 9, mn = Math.min.apply(null, v), mx = Math.max.apply(null, v); if (mx === mn) mx = mn + 1e-6;
  var cnt = []; for (var i = 0; i < n; i++) cnt.push(0); v.forEach(function (x) { var k = Math.min(n - 1, Math.floor((x - mn) / (mx - mn) * n)); cnt[k]++; });
  var H = Math.min(360, Math.max(200, NB.H - 110 - c.y - (d.note ? 150 : 0) - 110)), top = c.y + 60, bottom = top + H, bw = W / n, mxc = Math.max.apply(null, cnt) || 1;
  cnt.forEach(function (k, i) { var lo = mn + (mx - mn) * i / n, hi = lo + (mx - mn) / n, mid = (lo + hi) / 2, h = k / mxc * H, x = P + i * bw + 6; g.fillStyle = mid >= 0 ? NB_C.up : NB_C.down; g.fillRect(x, bottom - h, bw - 12, h); if (k) cText(g, String(k), x + (bw - 12) / 2, bottom - h - 10, 20, 800, NB_C.txt, "center"); if (i % Math.ceil(n / 5) === 0 || i === n - 1) cText(g, fmt(lo), P + i * bw, bottom + 30, 19, 600, NB_C.sub, i === n - 1 ? "left" : "left"); });
  g.strokeStyle = NB_C.sub; g.lineWidth = 2; g.beginPath(); g.moveTo(P, bottom + 2); g.lineTo(P + W, bottom + 2); g.stroke();
  if (mn < 0 && mx > 0) { var x0 = P + (0 - mn) / (mx - mn) * W; g.save(); g.setLineDash([8, 8]); g.strokeStyle = NB_C.txt; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, top - 20); g.lineTo(x0, bottom); g.stroke(); g.restore(); cText(g, "0%", x0, top - 28, 20, 800, NB_C.txt, "center"); }
  var mean = v.reduce(function (a, x) { return a + x; }, 0) / v.length, win = v.filter(function (x) { return x > 0; }).length;
  c.y = bottom + 48; cText(g, cFit(g, "표본 " + v.length + "회 · 평균 " + fmt(mean) + " · 오른 비율 " + Math.round(win / v.length * 100) + "% · 최악 " + fmt(mn) + " · 최고 " + fmt(mx), W, 22, 700), P, c.y + 22, 22, 700, NB_C.txt); c.y += 40;
}
/* 짝 막대: d = { rows:[{l, a, b}], aName, bName, fmt } — 둘(예: S&P500 vs 코스피)을 같은 칸에서 비교 */
function hubPairFill(c, d) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, rows = (d.rows || []).filter(Boolean); if (!rows.length) { c.y += 40; return; }
  var fmt = d.fmt || function (x) { return cPct(x, 0); }, lw = d.leftW || 300, bx = P + lw, bwid = W - lw - 120, avail = NB.H - 110 - c.y - (d.note ? 150 : 0) - 40, rh = Math.max(70, Math.min(130, Math.floor(avail / rows.length)));
  var vals = []; rows.forEach(function (r) { if (isFinite(r.a)) vals.push(Math.abs(r.a)); if (isFinite(r.b)) vals.push(Math.abs(r.b)); }); var mxAbs = Math.max.apply(null, vals) || 0.01;
  // 범례
  g.fillStyle = NB_HI; g.fillRect(P, c.y + 6, 26, 14); cText(g, d.aName || "A", P + 34, c.y + 20, 20, 700, NB_C.txt); var ax = P + 34 + cW(g, d.aName || "A", 20, 700) + 24; g.fillStyle = NB_C.navy; g.fillRect(ax, c.y + 6, 26, 14); cText(g, d.bName || "B", ax + 34, c.y + 20, 20, 700, NB_C.txt); c.y += 40;
  var y = c.y;
  rows.forEach(function (r, i) {
    if (i % 2 === 0) { g.fillStyle = "rgba(20,22,28,0.035)"; g.fillRect(P - 8, y, W + 16, rh); }
    cText(g, cFit(g, r.l, lw - 16, 22, 700), P, y + rh / 2 + 8, 22, 700, NB_C.txt);
    [["a", NB_HI], ["b", NB_C.navy]].forEach(function (k, j) { var v = r[k[0]], by = y + 10 + j * (rh - 20) / 2, bh = (rh - 20) / 2 - 6; if (!isFinite(v)) { cText(g, "표본 부족", bx, by + bh - 4, 18, 600, NB_C.sub); return; } var w = Math.max(4, Math.abs(v) / mxAbs * bwid); g.fillStyle = k[1]; g.globalAlpha = v >= 0 ? 1 : 0.45; g.fillRect(bx, by, w, bh); g.globalAlpha = 1; if (v < 0) { g.strokeStyle = k[1]; g.lineWidth = 2; g.strokeRect(bx + 1, by + 1, w - 2, bh - 2); } cText(g, fmt(v), bx + w + 10, by + bh - 4, 22, 900, v >= 0 ? NB_C.up : NB_C.down); });
    g.strokeStyle = NB_C.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(P, y + rh); g.lineTo(P + W, y + rh); g.stroke(); y += rh;
  });
  c.y = y + 10;
}
/* 게이지: d = { v, min, max, zones:[{to, label, color}], fmt, title, sub } — '지금 위치'를 구간 띠 위에 표시 */
function hubGaugeFill(c, d) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, fmt = d.fmt || function (x) { return String(x); }, mn = d.min, mx = d.max, v = Math.max(mn, Math.min(mx, d.v));
  var X = function (x) { return P + (x - mn) / (mx - mn) * W; }, y0 = c.y + 70, bh = 44, prev = mn;
  (d.zones || []).forEach(function (z, i) { var x1 = X(prev), x2 = X(z.to); g.fillStyle = z.color || "#ddd"; g.fillRect(x1, y0, x2 - x1, bh); cText(g, cFit(g, z.label, x2 - x1 - 8, 19, 700), (x1 + x2) / 2, y0 + bh + 28, 19, 700, NB_C.sub, "center"); if (i) { g.strokeStyle = NB_PAPER; g.lineWidth = 3; g.beginPath(); g.moveTo(x1, y0); g.lineTo(x1, y0 + bh); g.stroke(); cText(g, fmt(prev), x1, y0 - 12, 18, 600, NB_C.sub, "center"); } prev = z.to; });
  // 마커
  var xv = X(v); g.fillStyle = NB_INK; g.beginPath(); g.moveTo(xv, y0 - 6); g.lineTo(xv - 16, y0 - 34); g.lineTo(xv + 16, y0 - 34); g.closePath(); g.fill();
  g.fillStyle = NB_INK; g.fillRect(xv - 3, y0, 6, bh);
  var txt = (d.title ? d.title + " " : "") + fmt(d.v), tw = cW(g, txt, 34, 900) + 36, tx = Math.min(P + W - tw, Math.max(P, xv - tw / 2)); cRound(g, tx, y0 - 96, tw, 54, 12, NB_INK); cText(g, txt, tx + tw / 2, y0 - 58, 34, 900, NB_C.gold, "center");
  c.y = y0 + bh + 60;
  if (d.sub) { cWrap(g, d.sub, P, c.y + 24, W, 24, 600, NB_C.txt, 34, 2); c.y += 24 + 34 * Math.min(2, cWrapCount(g, d.sub, W, 24, 600)); }
  c.y += 10;
}
/* ============================================================ 새 데이터 주제 ============================================================ */
function hubPctTone(v) { return v > 0 ? NB_C.up : v < 0 ? NB_C.down : NB_C.sub; }
/* 기사 본문: 네이버 뉴스 링크면 서버가 본문 문장을 읽어 온다(하루 캐시) — 요약이 "…"로 끊기지 않게 문장 단위로 칸에 맞춰 넣는다 */
var HUB_BODY = {};
function hubBodyFetch(it) {
  var u = it && it.url || ""; if (!/n\.news\.naver\.com|news\.naver\.com/.test(u)) return Promise.resolve(null);
  if (HUB_BODY[u] !== undefined) return Promise.resolve(HUB_BODY[u]);
  return fetch("/api/news?type=body&url=" + encodeURIComponent(u)).then(function (r) { return r.json(); }).then(function (j) { HUB_BODY[u] = j && j.ok && j.sents && j.sents.length ? j.sents : null; return HUB_BODY[u]; }).catch(function () { HUB_BODY[u] = null; return null; });
}
/* 요약 문장 고르기: 문장을 끊지 않고, 글자 수 한도 안에서 앞에서부터 채운다 (마지막이 "…"로 끝나는 조각은 버린다) */
function hubSents(text) { return String(text || "").replace(/\s+/g, " ").split(/(?<=[다요음임함]\.|[.!?])\s+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 6 && !/(\.\.\.|…)$/.test(x) && /[.!?]$/.test(x); }); }
function hubFitSents(sents, maxChars, maxN) { var out = [], n = 0; for (var i = 0; i < sents.length && out.length < (maxN || 6); i++) { if (n + sents[i].length > maxChars) { if (!out.length) out.push(sents[i].slice(0, maxChars - 1).replace(/[,·\s]+$/, "") + "."); break; } out.push(sents[i]); n += sents[i].length; } return out; }
/* ① 오늘의 기사 — 1건 = 1장 (제목 · 본문 요약 · 관련 자산 숫자 · 읽을 거리) */
function hubNewsItems() {
  var items = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items) || [], seen = {};
  return items.filter(function (it) { var k = cNewsClean(it.title).slice(0, 18); if (seen[k] || !it.title) return false; seen[k] = 1; return true; })
    .map(function (it) { var t = cNewsClean(it.title), body = (it.title + " " + (it.desc || "")), syms = []; (typeof NB_NEWS_MAP !== "undefined" ? NB_NEWS_MAP : []).forEach(function (p) { if (p[0].test(body) && syms.indexOf(p[1]) < 0) syms.push(p[1]); }); return { it: it, t: t, syms: syms.slice(0, 3), desc: cNewsClean(it.desc || "") }; })
    .sort(function (a, b) { return (b.desc.length > 40) - (a.desc.length > 40) || b.syms.length - a.syms.length; });
}
function hubTerm(text) { var T = typeof PUB_TERMS !== "undefined" ? PUB_TERMS : []; for (var i = 0; i < T.length; i++) { var nm = T[i][0].split(" (")[0].split("·")[0].trim(); if (nm.length >= 2 && text.indexOf(nm) >= 0) return T[i]; } return null; }
function hubNewsDeck() {
  var L = hubNewsItems().slice(0, 6); if (!L.length) return [];
  var date = cDate(Date.now()), pages = L.map(function (x, i) {
    var body = HUB_BODY[x.it.url] || null, sents = body ? body : hubSents(x.desc), paras = hubFitSents(sents, 520, 6);
    if (!paras.length) paras = x.desc ? [x.desc.replace(/(\.\.\.|…)$/, "").replace(/[^.!?]*$/, "").trim() || x.desc.replace(/(\.\.\.|…)$/, "") + "…"] : ["기사 요약이 제공되지 않은 기사예요. 제목과 아래 숫자를 함께 보세요."];
    var tiles = x.syms.map(function (s) { var st = nbStat(s); return st ? { v: cPct(st.ret1, 1), l: hubName(s) + " 전일 · 1개월 " + cPct(st.m1, 0), color: hubPctTone(st.ret1) } : null; }).filter(Boolean).slice(0, 3);
    var term = hubTerm(x.t + " " + x.desc);
    return { name: "기사" + (i + 1), top: ["\"" + x.t + "\""], title: (x.it.press || "언론사") + (x.it.time ? " · " + String(x.it.time).slice(0, 16) : ""), sub: "기사 요약 · 아래 숫자는 관련 자산의 전일 종가 등락(야후 파이낸스)", kind: "text",
      data: { paras: paras, tiles: tiles, after: term ? ["이 기사 속 단어 · " + term[0], term[1] + " — " + term[2]] : ["읽는 법", "기사는 이유를 말하고, 숫자는 크기를 말해요. 제목이 커도 실제 등락은 작을 수 있어요."] }, foot: "출처: 네이버 뉴스 검색(" + (x.it.press || "각 언론사") + ") · 숫자는 야후 파이낸스 종가 · 투자 권유 아님" };
  });
  return hubDraw({ small: date + " 아침 기사", hook: ["오늘 꼭 읽을 기사 [[" + L.length + "건]]", "한 장에 하나씩"], lead: "제목만 훑지 말고 내용과 숫자를 같이 보세요. 기사마다 요약 · 관련 자산의 실제 등락 · 기사 속 단어 풀이를 붙였어요.", pages: pages, close: ["오늘 기사 중 어떤 게 가장 궁금하셨나요?", ["저장해 두고, 숫자가 바뀔 때", "다시 비교해 보세요."]], foot: "출처: 네이버 뉴스 검색 · 숫자는 야후 파이낸스 종가 · 투자 권유 아님" });
}
/* ② 이번 달은 과거에 어땠나 (달력 달별 수익률) */
function hubMonthStat(sym, mon) {
  var r = hubRows(sym); if (r.length < 500) return null; var by = {};
  r.forEach(function (x) { var d = new Date(x.t + 9 * 3600e3), y = d.getUTCFullYear(), m = d.getUTCMonth(); if (m !== mon) return; var k = y; if (!by[k]) by[k] = { f: null, l: null }; if (!by[k].f) by[k].f = x; by[k].l = x; });
  var yrs = Object.keys(by).map(Number).sort(), out = [];
  yrs.forEach(function (y) { var i = hubIdx(r, by[y].f.t) - 1; if (i < 0) return; out.push({ y: y, v: by[y].l.c / r[i].c - 1 }); });
  var cur = new Date(Date.now() + 9 * 3600e3).getUTCFullYear(); out = out.filter(function (x) { return !(x.y === cur && hubKst().getUTCMonth() === mon); });
  if (out.length < 5) return null; var v = out.map(function (x) { return x.v; });
  return { sym: sym, list: out, med: hubMed(v), avg: hubAvg(v), up: v.filter(function (x) { return x > 0; }).length, n: v.length, best: out.slice().sort(function (a, b) { return b.v - a.v; })[0], worst: out.slice().sort(function (a, b) { return a.v - b.v; })[0] };
}
function hubSeasonDeck() {
  var mon = hubKst().getUTCMonth(), M = (mon + 1) + "월", L = ["SPY", "^KS11", "QQQ", "GLD", "BTC-USD", "TLT"].map(function (s) { return hubMonthStat(s, mon); }).filter(Boolean);
  if (L.length < 3) return [];
  var sp = L.filter(function (x) { return x.sym === "SPY"; })[0] || L[0], ks = L.filter(function (x) { return x.sym === "^KS11"; })[0] || L[1], best = L.slice().sort(function (a, b) { return b.med - a.med; })[0];
  return hubDraw({ small: M + " 시작 전에", hook: ["[[" + M + "]]은 과거에", "어떤 달이었을까?"], lead: "자산 " + L.length + "개의 지난 " + sp.n + "년 이상 " + M + " 성적을 모았어요. 계절성은 참고일 뿐, 올해도 같다는 뜻은 아니에요.", pages: [
    { top: [M + " 중앙값이 가장 높았던 건", "[[" + hubName(best.sym) + " " + cPct(best.med, 1) + "]]", "", "오른 해 " + best.up + " / " + best.n], title: M + " 자산별 수익률 중앙값", sub: "달 첫 거래일 전 종가 → 마지막 거래일 종가 · 해마다 계산한 값의 가운데", kind: "bars", data: L.map(function (x) { return { l: hubName(x.sym), v: x.med, color: hubPctTone(x.med) }; }), note: L.map(function (x) { return hubName(x.sym) + " 오른 해 " + x.up + "/" + x.n + " · 최고 " + x.best.y + "년 " + cPct(x.best.v, 0) + " · 최악 " + x.worst.y + "년 " + cPct(x.worst.v, 0); }).join("\n") },
    { top: ["S&P500의 " + M, "오른 해는 [[" + sp.up + " / " + sp.n + "]]", "", "평균 " + cPct(sp.avg, 1) + " · 중앙값 " + cPct(sp.med, 1)], title: "S&P500 · 최근 " + Math.min(12, sp.list.length) + "년의 " + M, sub: "해마다 " + M + " 한 달 수익률", kind: "rows", data: sp.list.slice(-12).reverse().map(function (x) { return [x.y + "년", M + " 한 달", cPct(x.v, 1), hubPctTone(x.v)]; }), leftW: 200 },
    { top: ["코스피의 " + M, "오른 해는 [[" + ks.up + " / " + ks.n + "]]", "", "가장 좋았던 해 " + ks.best.y + "년 " + cPct(ks.best.v, 0) + " · 가장 나빴던 해 " + ks.worst.y + "년 " + cPct(ks.worst.v, 0)], title: hubName(ks.sym) + " · 최근 " + Math.min(12, ks.list.length) + "년의 " + M, sub: "해마다 " + M + " 한 달 수익률", kind: "rows", data: ks.list.slice(-12).reverse().map(function (x) { return [x.y + "년", M + " 한 달", cPct(x.v, 1), hubPctTone(x.v)]; }), leftW: 200 }
  ], close: [M + "엔 어떤 자산을 더 보시나요?", ["계절성은 '경향'이지 '규칙'이 아니에요.", "저장해 두고 다음 해에 맞춰 보세요."]], foot: "야후 파이낸스 종가 · 달력 달 기준 · 과거 자료이며 투자 권유 아님" });
}
/* ③ 요일별 수익률 */
function hubDowStat(sym) {
  var r = hubRows(sym); if (r.length < 1000) return null; var st = [0, 1, 2, 3, 4, 5, 6].map(function () { return []; });
  for (var i = 1; i < r.length; i++) { var d = new Date(r[i].t + 9 * 3600e3).getUTCDay(); if (sym !== "^KS11" && sym !== "005930.KS") d = new Date(r[i].t - 5 * 3600e3).getUTCDay(); st[d].push(r[i].c / r[i - 1].c - 1); }
  return [1, 2, 3, 4, 5].map(function (d) { var v = st[d]; return { d: "일월화수목금토"[d], avg: hubAvg(v), up: v.filter(function (x) { return x > 0; }).length / Math.max(1, v.length), n: v.length }; });
}
function hubDowDeck() {
  var a = hubDowStat("SPY"), b = hubDowStat("^KS11"); if (!a || !b) return [];
  function best(x) { return x.slice().sort(function (p, q) { return q.avg - p.avg; })[0]; }
  var ba = best(a), bb = best(b), yrs = Math.round((hubRows("SPY").slice(-1)[0].t - hubRows("SPY")[0].t) / 31557600000);
  return hubDraw({ small: "재미로 보는 숫자", hook: ["주식은 [[무슨 요일]]에", "가장 많이 올랐을까?"], lead: "S&P500과 코스피 " + yrs + "년치 일봉을 요일별로 나눠 봤어요. 하루 평균 등락과 오른 날 비율이에요.", pages: [
    { top: ["S&P500은 [[" + ba.d + "요일]]이", "평균 " + cPct(ba.avg, 3) + "로 가장 좋았다.", "", "차이는 아주 작다 — 하루 0.1%p도 안 된다."], title: "S&P500 · 요일별 하루 평균 등락", sub: "미국 현지 요일 기준 · 막대 아래 괄호 = 오른 날 비율", kind: "bars", data: a.map(function (x) { return { l: x.d + " (" + Math.round(x.up * 100) + "%)", v: x.avg, color: hubPctTone(x.avg), txt: cPct(x.avg, 3) }; }), note: "요일 효과는 연구마다 결론이 달라요. 1970~80년대엔 '월요일 효과'(월요일 약세)가 뚜렷했지만 이후엔 많이 약해졌다는 연구가 많아요. 거래 비용을 빼면 요일로 사고파는 전략은 의미가 거의 없어요." },
    { top: ["코스피는 [[" + bb.d + "요일]]이", "평균 " + cPct(bb.avg, 3) + "로 가장 좋았다.", "", "오른 날 비율은 모든 요일이 50% 안팎."], title: "코스피 · 요일별 하루 평균 등락", sub: "한국 요일 기준 · 막대 아래 괄호 = 오른 날 비율", kind: "bars", data: b.map(function (x) { return { l: x.d + " (" + Math.round(x.up * 100) + "%)", v: x.avg, color: hubPctTone(x.avg), txt: cPct(x.avg, 3) }; }), note: "코스피는 전날 밤 미국 시장의 영향을 크게 받아요. 그래서 월요일은 미국의 금요일 분위기를, 화~금은 전날 미국 마감을 이어받는 경우가 많아요." },
    { top: ["요일보다 중요한 건", "[[오래 들고 있었나]]였다."], title: "요일별 오른 날 비율 비교", sub: "S&P500 · 코스피 · 하루 기준", kind: "table", data: { cols: ["요일", "S&P500 평균", "S&P500 오른 날", "코스피 평균", "코스피 오른 날"], rows: a.map(function (x, i) { return [x.d + "요일", cPct(x.avg, 3), Math.round(x.up * 100) + "%", cPct(b[i].avg, 3), Math.round(b[i].up * 100) + "%"]; }), note: "하루 평균은 0.0x% 수준 · 거래 비용(수수료·세금)보다 작아요" } }
  ], close: ["여러분은 무슨 요일에 주식 앱을 가장 많이 여시나요?", ["재미로 본 숫자예요.", "요일보다 기간이 수익을 결정했어요."]], foot: "야후 파이낸스 일봉 · 단순 평균 · 과거 자료이며 투자 권유 아님" });
}
/* ④ 연도별 성적표 */
function hubYears(sym) { var r = hubRows(sym), by = {}; r.forEach(function (x) { var y = new Date(x.t + 9 * 3600e3).getUTCFullYear(); by[y] = by[y] || { f: x, l: x }; by[y].l = x; }); var ys = Object.keys(by).map(Number).sort(), out = []; ys.forEach(function (y, i) { if (!i) return; out.push({ y: y, v: by[y].l.c / by[ys[i - 1]].l.c - 1, ytd: y === hubKst().getUTCFullYear() }); }); return out; }
function hubYearsDeck() {
  var a = hubYears("SPY"), b = hubYears("^KS11"); if (a.length < 10 || b.length < 10) return [];
  var full = function (L) { return L.filter(function (x) { return !x.ytd; }); }, fa = full(a), fb = full(b), cur = a.filter(function (x) { return x.ytd; })[0], curK = b.filter(function (x) { return x.ytd; })[0];
  var bothUp = fa.filter(function (x) { var k = fb.filter(function (z) { return z.y === x.y; })[0]; return k && x.v > 0 && k.v > 0; }).length;
  function row(L, K) { return L.slice(-12).reverse().map(function (x) { var k = (K.filter(function (z) { return z.y === x.y; })[0] || {}).v; return [x.y + (x.ytd ? " (올해)" : "") + "년", cPct(x.v, 1), k == null ? "-" : cPct(k, 1), x.v > 0 && k > 0 ? "둘 다 ↑" : x.v < 0 && k < 0 ? "둘 다 ↓" : "엇갈림"]; }); }
  return hubDraw({ small: "연도별 성적표", hook: ["S&P500 · 코스피", "[[해마다]] 몇 % 였을까?"], lead: "지난 " + fa.length + "년의 연간 수익률을 나란히 놓았어요(배당 제외 · 지수 기준). 좋은 해와 나쁜 해가 번갈아 왔어요.", pages: [
    { top: ["S&P500이 오른 해 [[" + fa.filter(function (x) { return x.v > 0; }).length + " / " + fa.length + "]]", "코스피가 오른 해 [[" + fb.filter(function (x) { return x.v > 0; }).length + " / " + fb.length + "]]", "", "둘 다 오른 해는 " + bothUp + "번."], title: "최근 12년 · 연간 수익률", sub: "전년 마지막 종가 → 그해 마지막 종가 · 올해는 지금까지", kind: "table", data: { cols: ["연도", "S&P500", "코스피", "같이 움직였나"], rows: row(a, b), widths: [0.24, 0.24, 0.24, 0.28] } },
    { top: ["가장 좋았던 해와 나빴던 해의 차이는", "[[" + cPct(fa.slice().sort(function (p, q) { return q.v - p.v; })[0].v - fa.slice().sort(function (p, q) { return p.v - q.v; })[0].v, 0).replace("+", "") + "p]] (S&P500)"], title: "최고·최악의 해", sub: "S&P500 · 코스피 각각 3개", kind: "rows", data: fa.slice().sort(function (p, q) { return q.v - p.v; }).slice(0, 3).map(function (x) { return ["S&P500 최고", x.y + "년", cPct(x.v, 1), NB_C.up]; }).concat(fa.slice().sort(function (p, q) { return p.v - q.v; }).slice(0, 3).map(function (x) { return ["S&P500 최악", x.y + "년", cPct(x.v, 1), NB_C.down]; })).concat(fb.slice().sort(function (p, q) { return q.v - p.v; }).slice(0, 2).map(function (x) { return ["코스피 최고", x.y + "년", cPct(x.v, 1), NB_C.up]; })).concat(fb.slice().sort(function (p, q) { return p.v - q.v; }).slice(0, 2).map(function (x) { return ["코스피 최악", x.y + "년", cPct(x.v, 1), NB_C.down]; })), leftW: 220 },
    { top: ["올해 지금까지", "S&P500 [[" + cPct(cur && cur.v, 1) + "]] · 코스피 [[" + cPct(curK && curK.v, 1) + "]]"], title: "평균과 중앙값", sub: "연간 수익률 " + fa.length + "년", kind: "tiles", data: { tiles: [{ v: cPct(hubAvg(fa.map(function (x) { return x.v; })), 1), l: "S&P500 연평균(단순)", color: NB_C.navy }, { v: cPct(hubMed(fa.map(function (x) { return x.v; })), 1), l: "S&P500 중앙값", color: NB_C.navy }, { v: cPct(hubMed(fb.map(function (x) { return x.v; })), 1), l: "코스피 중앙값", color: NB_C.teal }] }, note: "'평균 몇 %'는 매년 그만큼 오른다는 뜻이 아니에요. 실제로는 +20%와 -10%가 섞여서 나온 결과예요. 한두 해 성적으로 판단하지 말고 5년·10년 단위로 보는 이유예요.", gold: ["좋은 해와 나쁜 해는 미리 알 수 없었다", "그래서 오래, 나눠서"] }
  ], close: ["올해는 어떤 해로 끝날까요?", ["예측 대신 기록을 남겨 두세요.", "저장해 두고 연말에 다시 보세요."]], foot: "야후 파이낸스 종가 · 지수 기준(배당 제외) · 과거 자료이며 투자 권유 아님" });
}
/* ⑤ 최악의 하루 TOP10 · 그 뒤 1년 */
function hubWorstDeck() {
  function worst(sym) { var r = hubRows(sym), L = []; for (var i = 1; i < r.length; i++) L.push({ i: i, t: r[i].t, v: r[i].c / r[i - 1].c - 1 }); L.sort(function (a, b) { return a.v - b.v; }); var pick = [], used = []; L.forEach(function (x) { if (pick.length >= 10) return; if (used.some(function (u) { return Math.abs(u - x.t) < 20 * 86400e3; })) return; used.push(x.t); var j = hubIdx(r, x.t + 365 * 86400e3); x.y1 = j < r.length ? r[j].c / r[x.i].c - 1 : null; pick.push(x); }); return pick; }
  var a = worst("SPY"), b = worst("^KS11"); if (a.length < 5 || b.length < 5) return [];
  var up = a.filter(function (x) { return x.y1 != null && x.y1 > 0; }).length, n = a.filter(function (x) { return x.y1 != null; }).length;
  function rows(L) { return L.map(function (x) { var d = new Date(x.t + 9 * 3600e3); return [d.getUTCFullYear() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCDate(), "그날 " + cPct(x.v, 1), x.y1 == null ? "진행 중" : "1년 뒤 " + cPct(x.y1, 0), x.y1 == null ? NB_C.sub : hubPctTone(x.y1)]; }); }
  return hubDraw({ small: "가장 무서웠던 날", hook: ["주식 역사상 [[최악의 하루]]", "1년 뒤엔 어땠을까?"], lead: "S&P500(ETF)과 코스피에서 하루 낙폭이 가장 컸던 날 10개씩(20일 안에 겹치면 하나로). 그날 종가에 샀다면 1년 뒤 수익률이에요.", pages: [
    { top: ["S&P500 최악의 하루 10번 중", "1년 뒤 오른 건 [[" + up + " / " + n + "]]"], title: "S&P500 · 하루 낙폭 TOP10", sub: "그날 등락 → 그날 종가에 샀다면 1년 뒤", kind: "rows", data: rows(a), leftW: 230 },
    { top: ["코스피 최악의 하루 10번 중", "1년 뒤 오른 건 [[" + b.filter(function (x) { return x.y1 != null && x.y1 > 0; }).length + " / " + b.filter(function (x) { return x.y1 != null; }).length + "]]"], title: "코스피 · 하루 낙폭 TOP10", sub: "그날 등락 → 그날 종가에 샀다면 1년 뒤", kind: "rows", data: rows(b), leftW: 230 },
    { top: ["최악의 날은", "[[최고의 날 근처]]에 몰려 있었다."], title: "하락장에서 기억할 것", sub: "숫자로 본 공포의 날", kind: "tiles", data: { tiles: [{ v: cPct(a[0].v, 1), l: "S&P500 가장 큰 하루 낙폭", color: NB_C.down }, { v: cPct(b[0].v, 1), l: "코스피 가장 큰 하루 낙폭", color: NB_C.down }, { v: up + "/" + n, l: "S&P500 1년 뒤 오른 횟수", color: NB_C.up }] }, note: "큰 하락 뒤에는 큰 반등이 바로 붙어 나오는 일이 많았어요. 겁나서 다 팔면 그 반등을 놓치기 쉬워요. 다만 2008년처럼 1년 뒤에도 더 빠져 있던 경우도 있었어요 — 버틸 수 있는 비중이 먼저예요.", gold: ["공포의 날 = 비중 점검의 날", "팔기 전에 '얼마나 버틸 수 있나'부터"] }
  ], close: ["최악의 날, 여러분은 무엇을 하셨나요?", ["저장해 두고, 다음 급락 때", "1년 뒤 숫자를 떠올려 보세요."]], foot: "야후 파이낸스 종가 · 지수/ETF 기준 · 과거 자료이며 투자 권유 아님" });
}
/* ⑥ 10년 전 100만원 · 5년 전 100만원 */
function hubDecadeDeck() {
  var L = ["SPY", "QQQ", "^KS11", "005930.KS", "000660.KS", "NVDA", "AAPL", "MSFT", "TSLA", "GLD", "TLT", "BTC-USD"], fx = hubRows("KRW=X");
  function val(sym, yrs) { var r = hubRows(sym); if (r.length < 50) return null; var t0 = r[r.length - 1].t - yrs * 365.25 * 86400e3; if (r[0].t > t0 + 20 * 86400e3) return null; var i = hubIdx(r, t0); var x = r[r.length - 1].c / r[i].c; var krw = /\.KS$|\^KS11/.test(sym); if (!krw && fx.length) { var f0 = fx[Math.min(fx.length - 1, hubIdx(fx, r[i].t))].c, f1 = fx[fx.length - 1].c; x *= f1 / f0; } return { sym: sym, x: x, v: 1e6 * x }; }
  var t10 = L.map(function (s) { return val(s, 10); }).filter(Boolean).sort(function (a, b) { return b.x - a.x; }), t5 = L.map(function (s) { return val(s, 5); }).filter(Boolean).sort(function (a, b) { return b.x - a.x; });
  if (t10.length < 5) return [];
  function man(v) { return v >= 1e8 ? (v / 1e8).toFixed(1) + "억원" : Math.round(v / 1e4).toLocaleString("ko-KR") + "만원"; }
  return hubDraw({ small: "재미로 보는 숫자", hook: ["[[10년 전 100만원]]을", "넣었다면 지금 얼마?"], lead: "주식·지수·금·채권·비트코인 " + t10.length + "개. 해외 자산은 그때와 지금 환율까지 반영한 원화 기준이에요(배당·세금·수수료 제외).", pages: [
    { top: ["10년 전 100만원 1등은", "[[" + hubName(t10[0].sym) + " " + man(t10[0].v) + "]]", "", "꼴찌는 " + hubName(t10[t10.length - 1].sym) + " " + man(t10[t10.length - 1].v) + "."], title: "10년 전 100만원 → 지금 (원화)", sub: "그날 종가에 사서 지금까지 그대로 들고 있었다면", kind: "rows", data: t10.map(function (x) { return [cPct(x.x - 1, 0), hubName(x.sym), man(x.v), x.x >= 1 ? NB_C.up : NB_C.down]; }), leftW: 200 },
    { top: ["5년 전이었다면", "1등은 [[" + hubName(t5[0].sym) + " " + man(t5[0].v) + "]]"], title: "5년 전 100만원 → 지금 (원화)", sub: "기간이 바뀌면 순위도 바뀐다", kind: "rows", data: t5.map(function (x) { return [cPct(x.x - 1, 0), hubName(x.sym), man(x.v), x.x >= 1 ? NB_C.up : NB_C.down]; }), leftW: 200 },
    { top: ["1등 종목을 미리 알 순 없었다.", "[[지수]]는 대부분 그 중간에 있었다."], title: "결과만 보면 쉬워 보이지만", sub: "10년 전 시점에서 본 질문들", kind: "tiles", data: { tiles: [{ v: man((t10.filter(function (x) { return x.sym === "SPY"; })[0] || t10[0]).v), l: "S&P500 10년", color: NB_C.navy }, { v: man((t10.filter(function (x) { return x.sym === "^KS11"; })[0] || t10[1]).v), l: "코스피 10년", color: NB_C.teal }, { v: man((t10.filter(function (x) { return x.sym === "GLD"; })[0] || t10[2]).v), l: "금 10년", color: NB_C.gold2 }] }, note: "지금 1등인 자산을 10년 전에 고를 수 있었을까요? 당시엔 다른 종목이 더 유망해 보였을 수도 있어요. 개별 종목은 0원이 될 수도 있지만 지수는 시장 전체라 그 위험이 작아요. 이 결과는 지금까지 살아남은 종목만 본 것(생존편향)이에요.", gold: ["모르면 지수, 알면 일부만", "결과를 보고 고른 목록이라는 점을 기억"] }
  ], close: ["10년 전으로 돌아간다면 무엇을 사시겠어요?", ["지난 10년이 다음 10년은 아니에요.", "저장해 두고 5년 뒤에 맞춰 보세요."]], foot: "야후 파이낸스 종가 · 원화 환산(달러/원) · 배당·세금 제외 · 과거 자료이며 투자 권유 아님" });
}
/* ============================================================ v12.17 새 카드 3종 — "그 상황에 샀다면 1년 뒤" 시리즈 (모두 앱 과거 데이터로 직접 계산) ============================================================ */
/* 공통: 날짜별로 bucket(i)->칸 번호를 주면, 칸마다 252거래일 뒤 수익률의 평균·중앙값·오른 비율·표본수. 20거래일 간격으로 뽑아 같은 국면 중복을 줄인다 */
function hubFwdBuckets(rows, nB, bucketOf) {
  var B = []; for (var k = 0; k < nB; k++) B.push({ v: [], last: -1e9 });
  for (var i = 0; i < rows.length - 252; i++) { var b = bucketOf(i); if (b == null || b < 0) continue; if (i - B[b].last < 20) continue; B[b].last = i; B[b].v.push(rows[i + 252].c / rows[i].c - 1); }
  return B.map(function (x) { var v = x.v; if (!v.length) return { n: 0, v: [] }; var s = v.slice().sort(function (a, b) { return a - b; }); return { n: v.length, v: v, avg: v.reduce(function (a, y) { return a + y; }, 0) / v.length, med: s[v.length >> 1], win: v.filter(function (y) { return y > 0; }).length / v.length }; });
}
function hubLinePts(rows, years, n) { var r = rows.slice(-Math.round(years * 252)); if (r.length < 10) return []; var step = Math.max(1, Math.floor(r.length / (n || 160))), out = []; for (var i = 0; i < r.length; i += step) out.push({ t: r[i].t, v: r[i].c }); if (out[out.length - 1].t !== r[r.length - 1].t) out.push({ t: r[r.length - 1].t, v: r[r.length - 1].c }); return out; }
function hubPairRows(L, A, B) { return L.map(function (l, i) { return { l: l, a: A[i].n ? A[i].avg : NaN, b: B[i].n ? B[i].avg : NaN }; }); }
function hubFwdRows(labels, B, mk) { return labels.map(function (l, i) { var b = B[i]; return b.n ? [l, (mk ? mk + " · " : "") + "오른 비율 " + Math.round(b.win * 100) + "% · " + b.n + "회", "1년 뒤 " + cPct(b.avg, 0), hubPctTone(b.avg)] : [l, "표본 부족", "-", NB_C.sub]; }); }
/* ⑪ 고점 대비 낙폭 구간별 1년 뒤 */
function hubDdDeck() {
  function calc(sym) { var r = hubRows(sym); if (r.length < 1500) return null; var pk = -Infinity, dd = []; r.forEach(function (x) { if (x.c > pk) pk = x.c; dd.push(x.c / pk - 1); }); var edges = [-0.05, -0.1, -0.2, -0.3]; var B = hubFwdBuckets(r, 5, function (i) { var d = dd[i]; return d > -0.05 ? 0 : d > -0.1 ? 1 : d > -0.2 ? 2 : d > -0.3 ? 3 : 4; }); return { r: r, B: B, cur: dd[dd.length - 1] }; }
  var sp = calc("SPY") || calc("^GSPC"), ks = calc("^KS11"); if (!sp || !ks) return [];
  var L = ["고점 근처 (-5% 이내)", "-5 ~ -10%", "-10 ~ -20%", "-20 ~ -30%", "-30% 넘게 빠졌을 때"];
  function zone(d) { return d > -0.05 ? 0 : d > -0.1 ? 1 : d > -0.2 ? 2 : d > -0.3 ? 3 : 4; }
  var zs = zone(sp.cur), zk = zone(ks.cur), bs = sp.B[zs], bk = ks.B[zk];
  return hubDraw({ small: "데이터로 보는 투자", hook: [sp.cur > -0.03 ? "S&P500이 [[고점 근처]]인 지금," : "고점에서 [[" + Math.round(-sp.cur * 100) + "%]] 빠진 지금,", "과거엔 1년 뒤 어땠을까?"], lead: "S&P500과 코스피의 전 기간 일봉에서 '그날이 직전 고점 대비 몇 % 아래였나'로 칸을 나누고, 그날 종가에 샀다면 1년(252거래일) 뒤 수익률을 모았어요. 같은 국면 중복을 줄이려 20거래일 간격으로 뽑았어요.", pages: [
    { top: ["S&P500 · 고점 대비 낙폭별", "1년 뒤 평균 수익률"], title: "S&P500 — 떨어진 폭별로 1년 뒤", sub: "직전 고점 대비 그날 위치 → 1년 뒤", kind: "rows", data: hubFwdRows(L, sp.B, "S&P500"), leftW: 330 },
    { top: ["같은 칸에서 S&P500과 코스피는", "[[얼마나 달랐나]]"], title: "S&P500 vs 코스피 — 칸별 1년 뒤 평균", sub: "같은 낙폭 칸 · 막대 길이 = 1년 뒤 평균 수익률", kind: "pair", data: { rows: hubPairRows(L, sp.B, ks.B), aName: "S&P500", bName: "코스피", leftW: 300 }, note: "코스피는 큰 하락 뒤 반등이 더 가파른 편이지만, 고점 근처 칸의 1년 뒤는 S&P500보다 낮은 경우가 많았어요. 같은 '낙폭'이라도 시장마다 결이 달라요." },
    { top: ["S&P500 최근 3년 흐름과", "[[지금 위치]]"], title: "S&P500 · 최근 3년", sub: "SPY 종가 · 점 = 오늘", kind: "line", data: { pts: hubLinePts(sp.r, 3, 160), fmt: function (v) { return "$" + Math.round(v); }, label: "고점 대비 " + cPct(sp.cur, 1) + " · 지금 칸 = " + L[zs] }, note: "선이 최고점에서 얼마나 내려와 있는지가 '칸'을 정해요. 칸은 매일 바뀌니 저장해 두고 다음 조정 때 다시 보세요." },
    { top: ["지금 S&P500은 고점 대비 [[" + cPct(sp.cur, 0) + "]]", "코스피는 [[" + cPct(ks.cur, 0) + "]]"], title: "지금 위치에 해당하는 칸", sub: "과거 같은 칸의 1년 뒤 — 평균일 뿐 보장이 아님", kind: "gauge", data: { v: sp.cur, min: -0.4, max: 0, fmt: function (x) { return cPct(x, 0); }, title: "S&P500", zones: [{ to: -0.3, label: "-30% 넘게", color: "#2f6fd6" }, { to: -0.2, label: "-20~-30%", color: "#6f95dd" }, { to: -0.1, label: "-10~-20%", color: "#a9bde6" }, { to: -0.05, label: "-5~-10%", color: "#d9d2c0" }, { to: 0, label: "고점 근처", color: "#e6c57a" }], tiles: [{ v: bs.n ? cPct(bs.avg, 0) : "-", l: "S&P500 · " + L[zs] + " 1년 뒤 평균", color: bs.n ? hubPctTone(bs.avg) : NB_C.sub }, { v: bs.n ? Math.round(bs.win * 100) + "%" : "-", l: "S&P500 · 1년 뒤 올라 있던 비율 (" + (bs.n || 0) + "회)", color: NB_C.navy }, { v: bk.n ? cPct(bk.avg, 0) : "-", l: "코스피 · " + L[zk] + " 1년 뒤 평균 (" + (bk.n || 0) + "회)", color: bk.n ? hubPctTone(bk.avg) : NB_C.sub }] }, note: "많이 빠진 칸일수록 1년 뒤 평균이 높게 나오는 경향이 있지만, 표본이 적고(큰 하락은 드물어요) 2000·2008년처럼 1년 뒤에도 더 빠져 있던 때가 섞여 있어요. 평균이 아니라 '오른 비율'과 '표본 수'를 같이 보세요.", gold: ["낙폭은 기회의 크기이자 위험의 크기", "버틸 수 있는 비중이 먼저"] }
  ], close: ["지금 칸에서 여러분은 어떻게 하시겠어요?", ["저장해 두고 1년 뒤 숫자와 맞춰 보세요.", "과거 평균이 미래를 보장하진 않아요."]], foot: "야후 파이낸스 종가 · S&P500은 SPY(ETF) 기준 · 1년 = 252거래일 · 과거 자료이며 투자 권유 아님" });
}
/* ⑫ 공포지수(VIX) 구간별 1년 뒤 */
function hubVixDeck() {
  var v = hubRows("^VIX"), r = hubRows("SPY"); if (v.length < 1500 || r.length < 1500) return [];
  var vt = {}; v.forEach(function (x) { vt[Math.floor((x.t + 9 * 3600e3) / 86400e3)] = x.c; });
  function zone(x) { return x < 15 ? 0 : x < 20 ? 1 : x < 30 ? 2 : 3; }
  var B = hubFwdBuckets(r, 4, function (i) { var x = vt[Math.floor((r[i].t + 9 * 3600e3) / 86400e3)]; return x == null ? null : zone(x); });
  var now = v[v.length - 1].c, z = zone(now), L = ["VIX 15 미만 (아주 평온)", "15 ~ 20 (평온)", "20 ~ 30 (불안)", "30 이상 (공포)"], b = B[z];
  var hi = v.slice().sort(function (a, c) { return c.c - a.c; })[0], hd = new Date(hi.t + 9 * 3600e3);
  return hubDraw({ small: "데이터로 보는 투자", hook: ["공포지수 [[" + now.toFixed(0) + "]] — " + L[z].split(" (")[1].replace(")", "") + ".", "공포가 컸던 날 샀다면 1년 뒤는?"], lead: "VIX(S&P500 변동성 지수)는 '시장이 얼마나 겁먹었나'의 숫자예요. VIX 구간별로 그날 S&P500(SPY)을 샀다면 1년 뒤 수익률을 모았어요(20거래일 간격 표본).", pages: [
    { top: ["VIX 구간별", "S&P500 1년 뒤 평균 수익률"], title: "공포가 클수록 1년 뒤는", sub: "그날 VIX 구간 → 그날 종가에 샀다면 1년 뒤", kind: "rows", data: hubFwdRows(L, B, "S&P500"), leftW: 330 },
    { top: ["VIX 최근 3년 —", "[[20]]을 넘으면 불안, [[30]]을 넘으면 공포"], title: "공포지수 · 최근 3년", sub: "^VIX 종가 · 점 = 오늘 · 역대 최고 " + hi.c.toFixed(0) + " (" + hd.getUTCFullYear() + "." + (hd.getUTCMonth() + 1) + ")", kind: "line", data: { pts: hubLinePts(v, 3, 180), fmt: function (x) { return x.toFixed(0); }, refs: [{ v: 20, label: "불안 20", color: NB_C.gold2 }, { v: 30, label: "공포 30", color: NB_C.up }], label: "VIX는 급등했다가 빠르게 내려오는 성질이 있어요 — 30 위에 오래 머문 적은 드물어요" } },
    b.n >= 5 ? { top: ["[[" + L[z] + "]] 칸에서 샀던", b.n + "번의 1년 뒤는 이렇게 퍼져 있었다"], title: "지금 칸의 1년 뒤 분포", sub: "평균 하나가 아니라 퍼짐을 보세요 — 빨강 = 올랐던 경우, 파랑 = 내렸던 경우", kind: "hist", data: { values: b.v, bins: 9 }, note: "같은 칸이라도 결과는 넓게 퍼져 있어요. 평균이 플러스라도 마이너스로 끝난 경우가 " + Math.round((1 - b.win) * 100) + "%였어요 — 그 경우를 버틸 수 있는 비중인지가 핵심이에요." } : null,
    { top: ["지금 VIX " + now.toFixed(1) + " —", "[[" + L[z] + "]] 칸"], title: "지금 칸의 과거 결과", sub: "역대 최고 VIX " + hi.c.toFixed(0) + " (" + hd.getUTCFullYear() + "." + (hd.getUTCMonth() + 1) + ")", kind: "gauge", data: { v: now, min: 0, max: 50, fmt: function (x) { return x.toFixed(x >= 10 ? 0 : 1); }, title: "VIX", zones: [{ to: 15, label: "아주 평온", color: "#d9d2c0" }, { to: 20, label: "평온", color: "#e6c57a" }, { to: 30, label: "불안", color: "#e39a8a" }, { to: 50, label: "공포", color: "#d9342b" }], tiles: [{ v: now.toFixed(1), l: "오늘 VIX", color: now >= 30 ? NB_C.up : now >= 20 ? NB_C.gold2 : NB_C.navy }, { v: b.n ? cPct(b.avg, 0) : "-", l: "같은 칸 1년 뒤 평균 (" + (b.n || 0) + "회)", color: b.n ? hubPctTone(b.avg) : NB_C.sub }, { v: b.n ? Math.round(b.win * 100) + "%" : "-", l: "1년 뒤 올라 있던 비율", color: NB_C.navy }] }, note: "VIX가 30을 넘은 날은 전체의 몇 %뿐이고 대부분 급락 한가운데예요. 그날 사는 건 무섭지만 1년 뒤 결과는 평온한 날보다 나은 편이었어요. 반대로 VIX가 아주 낮을 때는 '좋은 소식이 다 반영된 때'일 수 있어요. 다만 2008년처럼 공포가 몇 달 이어진 때도 있어요.", gold: ["공포지수는 매수 신호가 아니라 체온계", "비중을 정해 두면 공포가 기회가 된다"] }
  ], close: ["VIX가 30을 넘으면 여러분은 무엇을 하시나요?", ["저장해 두고 다음 급락 때 꺼내 보세요.", "평균은 참고, 비중은 내 그릇만큼."]], foot: "야후 파이낸스 종가 · VIX(^VIX) · S&P500은 SPY(ETF) 기준 · 과거 자료이며 투자 권유 아님" });
}
/* ⑬ 200일선 위/아래에서 산 뒤 1년 */
function hubMa200Deck() {
  function calc(sym) { var r = hubRows(sym); if (r.length < 1500) return null; var sum = 0, ma = []; for (var i = 0; i < r.length; i++) { sum += r[i].c; if (i >= 200) sum -= r[i - 200].c; ma.push(i >= 199 ? sum / 200 : null); } var B = hubFwdBuckets(r, 4, function (i) { if (ma[i] == null) return null; var d = r[i].c / ma[i] - 1; return d >= 0.1 ? 0 : d >= 0 ? 1 : d >= -0.1 ? 2 : 3; }); var last = r[r.length - 1].c, m = ma[ma.length - 1]; return { B: B, d: m ? last / m - 1 : null }; }
  var sp = calc("SPY"), ks = calc("^KS11"); if (!sp || !ks || sp.d == null || ks.d == null) return [];
  var L = ["200일선보다 10% 넘게 위", "200일선 위 (0~10%)", "200일선 아래 (0~-10%)", "200일선보다 10% 넘게 아래"];
  function zone(d) { return d >= 0.1 ? 0 : d >= 0 ? 1 : d >= -0.1 ? 2 : 3; }
  var zs = zone(sp.d), zk = zone(ks.d);
  return hubDraw({ small: "데이터로 보는 투자", hook: ["[[200일선]] 위에서 사는 게 나을까,", "아래에서 사는 게 나을까?"], lead: "200일 이동평균선은 '최근 1년 평균 가격'이에요. 지수가 그 선보다 얼마나 위·아래에 있었는지로 칸을 나누고, 그날 샀다면 1년 뒤 수익률을 모았어요.", pages: [
    { top: ["S&P500 · 200일선 대비 위치별", "1년 뒤 평균 수익률"], title: "S&P500 — 200일선 위·아래에서 산 뒤", sub: "그날 종가 ÷ 200일 평균 → 1년 뒤", kind: "rows", data: hubFwdRows(L, sp.B, "S&P500"), leftW: 330 },
    { top: ["같은 칸에서 S&P500과 코스피는", "[[얼마나 달랐나]]"], title: "S&P500 vs 코스피 — 칸별 1년 뒤 평균", sub: "200일선 대비 같은 위치 칸 · 막대 = 1년 뒤 평균", kind: "pair", data: { rows: hubPairRows(L, sp.B, ks.B), aName: "S&P500", bName: "코스피", leftW: 300 }, note: "두 시장 모두 '선 위냐 아래냐'보다 1년을 들고 있었는지가 더 큰 차이를 만들었어요. 선 아래 칸은 표본이 적어 편차가 커요." },
    { top: ["지금 S&P500은 200일선보다 [[" + cPct(sp.d, 1) + "]]", "코스피는 [[" + cPct(ks.d, 1) + "]]"], title: "지금 위치", sub: "같은 칸의 과거 1년 뒤", kind: "gauge", data: { v: sp.d, min: -0.25, max: 0.25, fmt: function (x) { return cPct(x, 0); }, title: "S&P500 200일선 대비", zones: [{ to: -0.1, label: "10% 넘게 아래", color: "#2f6fd6" }, { to: 0, label: "아래", color: "#a9bde6" }, { to: 0.1, label: "위", color: "#e6c57a" }, { to: 0.25, label: "10% 넘게 위", color: "#d9342b" }], tiles: [{ v: cPct(sp.d, 1), l: "S&P500 · 200일선 대비 (" + L[zs] + ")", color: hubPctTone(sp.d) }, { v: sp.B[zs].n ? cPct(sp.B[zs].avg, 0) : "-", l: "S&P500 같은 칸 1년 뒤 평균 (" + (sp.B[zs].n || 0) + "회)", color: NB_C.navy }, { v: ks.B[zk].n ? cPct(ks.B[zk].avg, 0) : "-", l: "코스피 같은 칸 1년 뒤 평균 (" + (ks.B[zk].n || 0) + "회)", color: NB_C.navy }] }, note: "'추세를 따르라'와 '쌀 때 사라'는 서로 반대 조언인데, 지수에서는 어느 쪽이든 1년 뒤 평균은 플러스인 경우가 많았어요. 차이를 만든 건 선 위냐 아래냐보다 '1년을 들고 있었나'였어요. 200일선보다 10% 넘게 아래는 급락 한가운데라 표본이 적고 편차가 커요.", gold: ["선의 위치보다 보유 기간", "급락 칸은 평균보다 편차를 보라"] }
  ], close: ["여러분은 선 위에서 사는 편인가요, 아래에서 사는 편인가요?", ["저장해 두고 다음에 선을 깰 때 꺼내 보세요.", "지수 이야기예요 — 개별 종목은 0이 될 수도 있어요."]], foot: "야후 파이낸스 종가 · 200일 단순이동평균 · S&P500은 SPY(ETF) 기준 · 과거 자료이며 투자 권유 아님" });
}
/* ⑦~⑩ 오늘 데이터: 52주 신고가·신저가 / 업종 / 고점 대비 할인 / 돈이 몰린 곳 */
function hubStocks() { var R = hubR(); return R ? (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym); }) : []; }
function hubTodayDeck(kind) {
  var R = hubR(); if (!R) return []; var S = hubStocks(), date = typeof tplDateTxt === "function" ? tplDateTxt(R) : cDate(Date.now()), unit = R.market === "coin" ? "코인" : "종목", nm = function (s) { return typeof briefName === "function" ? briefName(s) : s.sym; };
  var foot = "야후 파이낸스 종가 · " + date + " 기준 · StockMind 자동 집계 · 투자 권유 아님";
  if (kind === "hi52") {
    var hi = S.filter(function (s) { return s.newHigh; }).sort(function (a, b) { return b.m1 - a.m1; }), lo = S.filter(function (s) { return s.newLow; }).sort(function (a, b) { return a.m1 - b.m1; }), near = S.filter(function (s) { return !s.newHigh && s.vsHi != null && s.vsHi >= -0.03 && s.longEnough; });
    if (hi.length + lo.length < 3) return [];
    var pages = [];
    if (hi.length) pages.push({ top: ["오늘 52주 신고가 [[" + hi.length + "개]]", "가장 많이 오른 건 " + nm(hi[0]) + " (1개월 " + cPct(hi[0].m1, 0) + ")"], title: "52주 신고가 " + unit, sub: "오늘 종가가 지난 1년 중 가장 높았던 " + unit + " · 오른쪽 = 1개월 수익률", kind: "rows", data: hi.slice(0, 12).map(function (s) { return ["하루 " + cPct(s.ret1, 1), nm(s), cPct(s.m1, 0), hubPctTone(s.m1), "1년 최저가 대비 " + cPct(s.vsLo, 0)]; }), leftW: 190 });
    if (lo.length) pages.push({ top: ["오늘 52주 신저가 [[" + lo.length + "개]]", "가장 많이 빠진 건 " + nm(lo[0]) + " (1개월 " + cPct(lo[0].m1, 0) + ")"], title: "52주 신저가 " + unit, sub: "오늘 종가가 지난 1년 중 가장 낮았던 " + unit + " · 오른쪽 = 1개월 수익률", kind: "rows", data: lo.slice(0, 12).map(function (s) { return ["하루 " + cPct(s.ret1, 1), nm(s), cPct(s.m1, 0), hubPctTone(s.m1), "1년 고점 대비 " + cPct(s.vsHi, 0)]; }), leftW: 190 });
    pages.push({ top: ["신고가는 '비싸다'가 아니라", "[[파는 사람이 없다]]에 가깝다."], title: "오늘의 신고가 · 신저가 숫자", sub: "전체 " + S.length + "개 " + unit + " 중", kind: "tiles", data: { tiles: [{ v: hi.length + "개", l: "52주 신고가", color: NB_C.up }, { v: near.length + "개", l: "신고가까지 3% 안", color: NB_C.navy }, { v: lo.length + "개", l: "52주 신저가", color: NB_C.down }] }, note: "신고가 종목이 많아지는 날은 시장 전체의 힘이 강하다는 신호로 읽혀요. 반대로 신저가가 늘면 약해졌다는 뜻이에요. 신저가 종목은 '싸 보이지만' 바닥은 지나야 알 수 있어요.", gold: ["신고가 수 vs 신저가 수", "시장의 체온계"] });
    return hubDraw({ small: date, hook: ["오늘 [[52주 신고가]]는", "어떤 " + unit + "이었을까?"], lead: "지난 1년 중 가장 비싸게 끝난 " + unit + "과 가장 싸게 끝난 " + unit + "을 모았어요. 숫자는 종가 기준이에요.", pages: pages, close: ["신고가 종목, 사시나요 기다리시나요?", ["저장해 두고 1개월 뒤", "같은 목록을 다시 비교해 보세요."]], foot: foot });
  }
  if (kind === "sector") {
    var T = (R.themes || []).filter(function (t) { return isFinite(t.ret); }); if (T.length < 4) return [];
    var top = T.slice(0, 6), bot = T.slice(-6).reverse();
    return hubDraw({ small: date, hook: ["오늘 [[가장 강한 업종]]과", "가장 약한 업종"], lead: "업종(테마)별로 대표 종목들의 평균 등락을 계산했어요. 같은 날에도 업종마다 방향이 달랐어요.", pages: [
      { top: ["오늘 1등 업종 [[" + T[0].name + " " + cPct(T[0].ret, 1) + "]]", "꼴찌 " + T[T.length - 1].name + " " + cPct(T[T.length - 1].ret, 1)], title: "강한 업종 TOP6 · 약한 업종 TOP6", sub: "업종 평균 등락 · 왼쪽 = 오른 종목 수", kind: "rows", data: top.map(function (t) { return [t.up + "/" + t.n + " 상승", t.name, cPct(t.ret, 1), hubPctTone(t.ret), "가장 센 " + nm(t.best) + " " + cPct(t.best.ret, 1)]; }).concat(bot.map(function (t) { return [t.up + "/" + t.n + " 상승", t.name, cPct(t.ret, 1), hubPctTone(t.ret), "가장 약한 " + nm(t.worst) + " " + cPct(t.worst.ret, 1)]; })), leftW: 170 },
      { top: ["업종 사이 차이", "[[" + cPct(T[0].ret - T[T.length - 1].ret, 1).replace("+", "") + "p]]"], title: "업종별 등락 한눈에", sub: "상위 3 · 하위 3", kind: "bars", data: T.slice(0, 3).concat(T.slice(-3)).map(function (t) { return { l: t.name, v: t.ret, color: hubPctTone(t.ret) }; }), note: "업종 차이가 큰 날은 '시장 전체'보다 '어디에 돈이 몰렸나'가 중요한 날이에요. 강한 업종이 며칠 이어지는지, 하루로 끝나는지를 같이 보세요.", gold: ["하루 1등이 1주 1등은 아니다", "며칠 이어지는지 확인"] }
    ], close: ["요즘 가장 관심 가는 업종은 어디인가요?", ["저장해 두고 일주일 뒤", "같은 순서인지 비교해 보세요."]], foot: foot });
  }
  if (kind === "sale") {
    var L = S.filter(function (s) { return s.vsHi != null && s.longEnough; }).sort(function (a, b) { return a.vsHi - b.vsHi; }); if (L.length < 6) return [];
    var c20 = L.filter(function (s) { return s.vsHi <= -0.2; }).length;
    return hubDraw({ small: date, hook: ["고점보다 [[가장 많이 싸진]]", unit + "은 어디?"], lead: "52주 최고가 대비 지금 가격. 그리고 고점까지 돌아가려면 몇 % 올라야 하는지(회복 필요 수익률)까지 계산했어요.", pages: [
      { top: ["고점 대비 가장 많이 빠진 건", "[[" + nm(L[0]) + " " + cPct(L[0].vsHi, 0) + "]]", "", "고점 회복엔 +" + Math.round((1 / (1 + L[0].vsHi) - 1) * 100) + "%가 필요하다."], title: "고점 대비 할인 TOP12", sub: "52주 최고 종가 대비 · 오른쪽 = 고점까지 필요한 상승률", kind: "rows", data: L.slice(0, 12).map(function (s) { return [cPct(s.vsHi, 0), nm(s), "+" + Math.round((1 / (1 + s.vsHi) - 1) * 100) + "%", NB_C.navy, "1개월 " + cPct(s.m1, 0) + " · " + (s.above20 ? "20일선 위" : "20일선 아래")]; }), leftW: 150 },
      { top: ["고점보다 20% 넘게 싼 " + unit, "[[" + c20 + "개]] / " + L.length + "개"], title: "싸다 ≠ 바닥", sub: "할인 폭이 큰 " + unit + "의 지금 추세", kind: "tiles", data: { tiles: [{ v: c20 + "개", l: "고점 -20% 이하", color: NB_C.down }, { v: L.slice(0, 12).filter(function (s) { return s.above20; }).length + "/12", l: "TOP12 중 20일선 위", color: NB_C.navy }, { v: "+" + Math.round((1 / (1 + L[0].vsHi) - 1) * 100) + "%", l: "1위의 회복 필요 상승률", color: NB_C.up }] }, note: "-50% 빠진 종목은 +100%가 올라야 본전이에요. 많이 빠진 종목은 이유가 있는 경우가 많아요 — 실적·업황·재무를 먼저 확인하고, 20일선 위로 돌아오는지(추세)를 같이 보세요.", gold: ["할인율보다 '왜 빠졌나'", "회복 필요 수익률 = 1 ÷ (1 - 낙폭) - 1"] }
    ], close: ["할인 종목, 어떤 기준으로 고르시나요?", ["저장해 두고 3개월 뒤", "회복했는지 다시 보세요."]], foot: foot });
  }
  if (kind === "vol") {
    var V = S.filter(function (s) { return s.amtX != null && s.amtX >= 1.5; }).sort(function (a, b) { return b.amtX - a.amtX; }); if (V.length < 4) return [];
    return hubDraw({ small: date, hook: ["오늘 [[돈이 몰린]] " + unit, "평소보다 몇 배?"], lead: "오늘 거래대금이 최근 20일 평균의 몇 배였는지. 돈이 몰렸다는 건 관심이 커졌다는 뜻이지, 오른다는 뜻은 아니에요.", pages: [
      { top: ["평소보다 거래대금이 가장 많이 늘어난 건", "[[" + nm(V[0]) + " " + V[0].amtX.toFixed(1) + "배]]", "", "그날 등락 " + cPct(V[0].ret1, 1)], title: "거래대금 급증 TOP12", sub: "오늘 거래대금 ÷ 최근 20일 평균 · 오른쪽 = 오늘 등락", kind: "rows", data: V.slice(0, 12).map(function (s) { return [s.amtX.toFixed(1) + "배", nm(s), cPct(s.ret1, 1), hubPctTone(s.ret1), "1개월 " + cPct(s.m1, 0) + " · 고점 대비 " + cPct(s.vsHi, 0)]; }), leftW: 140 },
      { top: ["돈이 몰린 " + V.length + "개 중", "오른 건 [[" + V.filter(function (s) { return s.ret1 > 0; }).length + "개]], 내린 건 " + V.filter(function (s) { return s.ret1 < 0; }).length + "개"], title: "거래대금이 늘어난 날의 방향", sub: "평소의 1.5배 이상 " + unit, kind: "bars", data: V.slice(0, 6).map(function (s) { return { l: nm(s), v: s.ret1, color: hubPctTone(s.ret1) }; }), note: "거래대금이 크게 늘면서 오르면 '새 돈이 들어왔다', 늘면서 내리면 '많이 팔았다'로 읽어요. 하루로 끝나는지, 다음 날도 이어지는지가 중요해요.", gold: ["대금 + 방향 + 지속", "셋을 같이 보기"] }
    ], close: ["오늘 돈이 몰린 곳 중 의외였던 건?", ["저장해 두고 다음 날", "이어졌는지 확인해 보세요."]], foot: foot });
  }
  return [];
}
/* ⑪ 환율 효과: 같은 S&P500, 달러로 vs 원화로 */
function hubFxDeck() {
  var sp = hubRows("SPY"), fx = hubRows("KRW=X"); if (sp.length < 1000 || fx.length < 1000) return [];
  function at(r, t) { var i = Math.min(r.length - 1, hubIdx(r, t)); return r[i].c; }
  var now = sp[sp.length - 1].t, P = [1, 3, 5, 10].map(function (y) { var t0 = now - y * 365.25 * 86400e3; if (sp[0].t > t0 || fx[0].t > t0) return null; var u = sp[sp.length - 1].c / at(sp, t0) - 1, f = fx[fx.length - 1].c / at(fx, t0) - 1; return { y: y, usd: u, krw: (1 + u) * (1 + f) - 1, fx: f, f0: at(fx, t0) }; }).filter(Boolean);
  if (P.length < 3) return [];
  var f1 = fx[fx.length - 1].c;
  return hubDraw({ small: "환율 상식", hook: ["같은 S&P500인데", "[[원화로 보면]] 수익률이 다르다"], lead: "미국 주식은 '주가'와 '환율'을 같이 산 거예요. 같은 기간 달러 기준과 원화 기준 수익률을 비교했어요. 지금 환율 " + Math.round(f1).toLocaleString("ko-KR") + "원.", pages: [
    { top: [P[P.length - 1].y + "년 기준 차이", "달러 " + cPct(P[P.length - 1].usd, 0) + " → 원화 [[" + cPct(P[P.length - 1].krw, 0) + "]]"], title: "S&P500 · 달러 기준 vs 원화 기준", sub: "기간별 수익률 · 원화 = (1 + 달러 수익률) × (1 + 환율 변화) - 1", kind: "table", data: { cols: ["기간", "달러 기준", "환율 변화", "원화 기준", "그때 환율"], rows: P.map(function (x) { return [x.y + "년", cPct(x.usd, 0), cPct(x.fx, 0), cPct(x.krw, 0), Math.round(x.f0).toLocaleString("ko-KR") + "원"]; }), note: "배당·세금·환전 수수료 제외 · SPY(S&P500 ETF) 종가" } },
    { top: ["달러/원 최근 3년 —", "지금 [[" + Math.round(fx[fx.length - 1].c).toLocaleString("ko-KR") + "원]]"], title: "달러/원 환율 · 최근 3년", sub: "야후 KRW=X 종가 · 점 = 오늘", kind: "line", data: { pts: hubLinePts(fx, 3, 180), fmt: function (v) { return Math.round(v).toLocaleString("ko-KR") + "원"; }, label: "환율이 오르면(원화 약세) 미국 주식의 원화 평가액이 늘고, 내리면 줄어요" } },
    { top: ["환율이 오르면 미국 주식은", "[[원화로 더 벌고]], 내리면 덜 번다."], title: "환율이 바꾼 숫자", sub: "기간별 원화 기준 − 달러 기준", kind: "bars", data: P.map(function (x) { return { l: x.y + "년", v: x.krw - x.usd, color: hubPctTone(x.krw - x.usd), txt: cPct(x.krw - x.usd, 0).replace("%", "%p") }; }), note: "환율이 높을 때 미국 주식을 사면, 나중에 환율이 내려갈 때 주가가 올라도 수익이 깎일 수 있어요. 반대로 위기 때는 환율이 오르면서 원화 기준 손실을 줄여 주는 '자연 헷지' 역할도 했어요. 환율을 맞히기보다 나눠서 사는 게 편해요.", gold: ["미국 주식 = 주가 × 환율", "환헤지(H) 상품은 환율 영향을 줄인 대신 비용이 있어요"] }
  ], close: ["미국 주식 살 때 환율도 보시나요?", ["저장해 두고, 환율이 크게 움직일 때", "다시 꺼내 보세요."]], foot: "야후 파이낸스 종가(SPY · 달러/원) · 배당·세금 제외 · 과거 자료이며 투자 권유 아님" });
}

/* ⑫ 핵심 이슈 5 — 여러 장: 이슈마다 '무엇이 · 얼마나 · 왜(관련 숫자) · 기사' 한 장 */
function hubIssuesList() { var R = hubR(); if (!R) return []; try { return (typeof chState !== "undefined" && chState.issues && chState.issues.length) ? chState.issues : issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular, now: typeof nbNow === "function" ? nbNow() : null }); } catch (e) { return []; } }
function hubIssueWhy(it) {
  var R = hubR(), S = hubStocks(), st = it.sym && typeof nbStat === "function" ? nbStat(it.sym) : null, nm = function (s) { return typeof briefName === "function" ? briefName(s) : s.sym; }, rows = [], why = [];
  if (st) { rows.push(["오늘", "전일 대비", cPct(st.ret1, 1), hubPctTone(st.ret1), "평소 하루 변동의 " + (st.sd > 0 ? (Math.abs(st.ret1) / st.sd).toFixed(1) : "-") + "배"]); rows.push(["1개월", "20거래일 수익률", cPct(st.m1, 0), hubPctTone(st.m1), st.above20 ? "20일선 위" : "20일선 아래"]); rows.push(["고점", "52주 고점 대비", cPct(st.vsHi, 0), hubPctTone(st.vsHi), st.newHigh ? "오늘 52주 신고가" : st.newLow ? "오늘 52주 신저가" : ""]); if (st.volX) rows.push(["거래량", "최근 5일 ÷ 20일", st.volX.toFixed(1) + "배", NB_C.navy, st.volX >= 1.5 ? "관심이 몰린 상태" : "평소 수준"]); }
  if (/theme/.test(it.cat) && R && R.themes) { var t = R.themes.filter(function (x) { return it.title.indexOf(x.name) === 0; })[0]; if (t) { rows.push(["업종", t.name + " 평균", cPct(t.ret, 1), hubPctTone(t.ret), t.up + "/" + t.n + " 상승"]); rows.push(["가장 센", nm(t.best), cPct(t.best.ret, 1), hubPctTone(t.best.ret), ""]); rows.push(["가장 약한", nm(t.worst), cPct(t.worst.ret, 1), hubPctTone(t.worst.ret), ""]); why.push("업종 안에서 " + t.up + "/" + t.n + "개가 같은 방향 — 한 종목 뉴스가 아니라 업종 전체의 흐름"); } }
  if (it.cat === "breadth" && R && R.temp) { rows.push(["폭", "오른 종목 비율", Math.round(R.temp.upPct * 100) + "%", NB_C.navy, R.temp.up + "/" + R.temp.total]); rows.push(["추세", "20일선 위 비율", Math.round(R.temp.abovePct * 100) + "%", NB_C.navy, ""]); rows.push(["신고가·신저가", S.filter(function (x) { return x.newHigh; }).length + " : " + S.filter(function (x) { return x.newLow; }).length, "", NB_C.navy, ""]); why.push(R.temp.upPct >= 0.75 || R.temp.upPct <= 0.25 ? "종목 대부분이 한 방향 — 개별 재료가 아니라 시장 전체(금리·환율·지수 선물)가 움직인 날" : "방향이 갈린 날 — 업종·종목 재료가 결과를 정했다"); }
  if (it.cat === "signal" && typeof nbNow === "function") nbNow().why.forEach(function (w) { var p = w.split("→"); rows.push(["신호", (p[0] || "").trim(), (p[1] || "").trim(), NB_C.up, ""]); });
  if (/mover/.test(it.cat) && st) why.push(st.amtX >= 1.5 ? "거래대금이 평소의 " + st.amtX.toFixed(1) + "배 — 새 돈이 들어오거나 빠지며 만든 움직임" : "거래대금은 평소 수준 — 수급보다 재료(뉴스)로 움직인 날일 가능성");
  if (/mdd/.test(it.cat) && st) why.push("고점 대비 " + cPct(st.vsHi, 0) + " — 1년 고점 대비 위치를 보면 지금 낙폭이 어느 수준인지 알 수 있다");
  if (/index/.test(it.cat)) why.push("지수는 종목의 합 — 아래 '오른 종목 비율'과 같이 봐야 한 방향인지 알 수 있다");
  var news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).filter(function (n) { var key = it.sym ? nm({ sym: it.sym }) : it.title.split(" ")[0]; return key && key.length >= 2 && (n.title || "").indexOf(key) >= 0; }).slice(0, 3);
  return { rows: rows.slice(0, 6), why: why, news: news };
}
function hubIssuesDeck() {
  var L = hubIssuesList(); if (!L.length) return [];
  var date = typeof tplDateTxt === "function" && hubR() ? tplDateTxt(hubR()) : cDate(Date.now()), foot = "야후 파이낸스 종가 · " + date + " 기준 · StockMind 자동 집계 · 투자 권유 아님";
  var pages = L.map(function (it, i) {
    var W = hubIssueWhy(it), top = [String(it.title).replace(/\s*[—-]\s*/, "\n").split("\n")[0], "[[" + (String(it.title).split(/\s*[—-]\s*/)[1] || hubStrip(it.sub).split(" · ")[0]) + "]]"];
    var note = (W.why.length ? W.why.join(" ") + " " : "") + (W.news.length ? "관련 기사: " + W.news.map(function (n) { return "\"" + cNewsClean(n.title) + "\"" + (n.press ? "(" + n.press + ")" : ""); }).join(" · ") : "");
    if (W.rows.length) return { name: "이슈" + (i + 1), top: top, title: (i + 1) + "위 · " + hubStrip(it.title), sub: hubStrip(it.sub), kind: "rows", data: W.rows, leftW: 150, note: note, foot: foot };
    return { name: "이슈" + (i + 1), top: top, title: (i + 1) + "위 · " + hubStrip(it.title), sub: hubStrip(it.sub), kind: "text", data: { paras: [hubStrip(it.sub)].concat(W.why).concat(W.news.map(function (n) { return "· " + cNewsClean(n.title) + (n.press ? " — " + n.press : ""); })) }, foot: foot };
  });
  // 줄 목록 아래 '왜' 상자 — rows 뒤에 남는 자리에
  pages.forEach(function (p) { if (p.kind === "rows" && p.note) { p.kind = "rowsNote"; } });
  return hubDraw({ small: date + " 핵심 이슈", hook: ["어제 시장의 [[핵심 이슈 5]]", "무엇이, 얼마나, 왜"], lead: L.map(function (it, i) { return (i + 1) + ". " + hubStrip(it.title).split(/\s*[—-]\s*/)[0]; }).join("  "), pages: pages, close: ["이 중 어떤 이슈가 내 계좌와 가장 가까운가요?", ["저장해 두고 내일 아침", "같은 이슈가 이어지는지 보세요."]], foot: foot });
}
/* ⑬ 이번 주 일정 — 여러 장: 날짜마다 '무엇을 · 왜 중요한가 · 과거엔 어떻게 움직였나' */
var HUB_EV_WHY = [[/FOMC|연준|금리 결정|금통위|한국은행/, "금리가 바뀌면 채권·성장주·환율이 먼저 움직여요. 결정 자체보다 '다음 회의' 힌트(점도표·기자회견)에 시장이 반응해요."], [/CPI|물가|PCE/, "물가가 예상보다 높으면 '금리 인하가 늦어진다'로 읽혀 주식·채권이 같이 빠지는 날이 많았어요."], [/고용|실업|비농업/, "고용이 너무 좋으면 금리 걱정, 너무 나쁘면 경기 걱정 — 시장은 '적당한' 숫자를 좋아해요."], [/실적|어닝|earnings/i, "실적은 숫자보다 '다음 분기 가이던스'가 주가를 정해요. 발표 뒤 첫 거래일 변동이 가장 커요."], [/GDP|성장률/, "성장률은 후행 지표라 발표 당일 반응은 작은 편이지만, 예상과 크게 다르면 금리 전망이 바뀌어요."], [/옵션|만기|위칭/, "만기일엔 거래량이 늘고 장 막판 변동이 커요. 방향성 없는 흔들림일 때가 많아요."], [/휴장/, "휴장이면 다음 거래일에 이틀치 뉴스가 한 번에 반영돼요."], [/반도체|수출/, "한국 수출·반도체 지표는 코스피 대형주의 방향과 바로 연결돼요."]];
function hubCalDeck() {
  var up = typeof pubUpcoming === "function" ? pubUpcoming(7) : [], span = 7; if (up.length < 3) { up = pubUpcoming(14); span = 14; }   // 이번 주가 조용하면 2주치
  if (!up.length) return [];
  var byD = {}; up.forEach(function (e) { (byD[e.d] = byD[e.d] || []).push(e); });
  var days = Object.keys(byD).sort().slice(0, 7), spy = hubRows("SPY"), ks = hubRows("^KS11");
  var pages = days.map(function (d) {
    var L = byD[d], rows = L.map(function (e) { var t = cPlain(String(e.t)).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim(), why = (HUB_EV_WHY.filter(function (w) { return w[0].test(t); })[0] || [])[1] || ""; return [e.k === "us" ? "미국" : e.k === "kr" ? "한국" : e.k === "hol" ? "휴장" : "일정", t + (e.sure === false ? " (예정)" : ""), "", NB_C.navy, why]; });
    var why = L.map(function (e) { var t = cPlain(String(e.t)); return (HUB_EV_WHY.filter(function (w) { return w[0].test(t); })[0] || [])[1] || ""; }).filter(Boolean)[0] || "일정이 있는 날은 장 초반 방향이 자주 바뀌어요. 발표 전 포지션을 늘리기보다 발표 뒤 반응을 보고 움직이는 게 편해요.";
    return { name: d.slice(5).replace("-", "/"), top: [d.slice(5).replace("-", "/") + "(" + pubDow(d) + ") [[" + L.length + "개 일정]]", "", cPlain(String(L[0].t)).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim()], title: d.replace(/-/g, ".") + " (" + pubDow(d) + ")", sub: "무엇을 · 왜 중요한가", kind: "rowsNote", data: rows, leftW: 90, note: why };
  });
  return hubDraw({ small: pubToday().slice(5).replace("-", "/") + "부터 " + span + "일", hook: [(span > 7 ? "앞으로 2주 " : "이번 주 ") + "[[이 날]]은", "꼭 보세요"], lead: "앞으로 " + span + "일 동안 발표·실적·휴장 " + up.length + "개. 날짜마다 무엇이 있고 왜 중요한지, 한 장씩 정리했어요.", pages: pages, close: ["이번 주 가장 신경 쓰이는 일정은 뭔가요?", ["저장해 두고 그날 아침", "다시 꺼내 보세요."]], foot: "각 기관 발표 일정 · 한국 시간 · StockMind 정리 · 투자 권유 아님" });
}
/* ⑭ 용어 한 입 — 여러 장: 뜻 · 쉽게 · 알아두면 · 지금 숫자로 보기 */
function hubTermDeck() {
  var t = typeof pubTerm === "function" ? pubTerm(typeof pubState !== "undefined" ? pubState.termOffset || 0 : 0) : null; if (!t) return [];
  var nm = t[0], ex = t[3] || "", R = hubR(), S = hubStocks(), live = [];
  if (/MDD|낙폭/.test(nm) && typeof chState !== "undefined" && chState.mdd) (chState.mdd || []).filter(function (x) { return !x.err; }).slice(0, 5).forEach(function (x) { live.push([x.name, "지금 고점 대비", cPct(x.cur, 0), hubPctTone(x.cur), "최악 " + cPct(x.worst, 0)]); });
  if (/신고가|신저가/.test(nm) && S.length) { live.push(["오늘", "52주 신고가 종목", S.filter(function (x) { return x.newHigh; }).length + "개", NB_C.up, ""]); live.push(["오늘", "52주 신저가 종목", S.filter(function (x) { return x.newLow; }).length + "개", NB_C.down, ""]); }
  if (/VIX|공포/.test(nm) && typeof nbStat === "function") { var v = nbStat("^VIX"); if (v) live.push(["지금", "VIX", v.last.toFixed(1), v.last >= 25 ? NB_C.up : NB_C.navy, v.last < 20 ? "평온" : v.last < 30 ? "불안" : "공포"]); }
  if (/RSI/.test(nm) && S.length) { var ob = S.filter(function (x) { return x.rsi >= 70; }).length, os = S.filter(function (x) { return x.rsi <= 30; }).length; live.push(["오늘", "RSI 70 이상(과열)", ob + "개", NB_C.up, ""]); live.push(["오늘", "RSI 30 이하(과매도)", os + "개", NB_C.down, ""]); }
  if (/이동평균|20일선|200일선/.test(nm) && R && R.temp) live.push(["오늘", "20일선 위 종목 비율", Math.round(R.temp.abovePct * 100) + "%", NB_C.navy, ""]);
  if (/PER|PBR|배수/.test(nm)) live.push(["예시", "PER 10배", "이익의 10년치 가격", NB_C.navy, "PER 30배면 30년치"]);
  if (/환율|달러/.test(nm) && typeof nbStat === "function") { var f = nbStat("KRW=X"); if (f) live.push(["지금", "달러/원", Math.round(f.last).toLocaleString("ko-KR") + "원", NB_C.navy, "1개월 " + cPct(f.m1, 1)]); }
  var pages = [
    { name: "뜻", top: ["[[" + nm + "]]", "", t[1]], title: "뜻", sub: "한 줄 정의", kind: "text", data: { paras: [t[1], t[2]] } },
    { name: "쉽게", top: ["쉽게 말하면"], title: "쉽게 말하면", sub: "초보 눈높이", kind: "text", data: { paras: hubSents(t[2]).length ? hubSents(t[2]) : [t[2]], after: ex ? ["알아두면 좋은 점", ex] : null } }
  ];
  if (ex) pages.push({ name: "알아두면", top: ["알아두면 좋은 점"], title: "실전에서 어떻게 쓰나", sub: "이 단어를 볼 때 같이 볼 것", kind: "text", data: { paras: hubSents(ex).length ? hubSents(ex) : [ex] } });
  if (live.length) pages.push({ name: "지금숫자", top: ["지금 숫자로 보면", "[[" + live[0][2] + "]]"], title: "오늘 데이터에 적용하면", sub: nm + " · " + cDate(Date.now()) + " 기준", kind: "rows", data: live, leftW: 110 });
  return hubDraw({ small: "용어 한 입", hook: ["[[" + nm.split(" (")[0] + "]]", "이 단어, 알고 쓰나요?"], lead: t[1], pages: pages, close: ["이 단어, 어디서 처음 보셨나요?", ["저장해 두고 뉴스에서", "다시 만나면 꺼내 보세요."]], foot: "우상향연구소 용어 사전 · 투자 권유 아님" });
}

/* ---------- 상식·데이터 리스트(구 릴스) — 종이 틀로 다시 그림 ---------- */
function hubReelDeck(r) {
  if (!r) return [];
  var items = r.items || [], per = items.length > 8 ? Math.ceil(items.length / 2) : items.length, pages = [];
  for (var p = 0; p * per < items.length; p++) {
    var chunk = items.slice(p * per, (p + 1) * per);
    pages.push({ name: "리스트" + (p + 1), top: [r.hook[0], r.hook[1]].concat(p ? ["", "(" + (p + 1) + "/" + Math.ceil(items.length / per) + ")"] : []), title: (r.t || cPlain(r.hook.join(" "))) + (Math.ceil(items.length / per) > 1 ? " · " + (p + 1) : ""), sub: r.lead, kind: "rows", data: chunk.map(function (it, i) { var v = String(it[1] || ""), m = v.match(/[+\-−]?\d[\d,.]*\s*(%p?|배|원|만원|억|년|개월|일|회|번)?/); return [String(p * per + i + 1).padStart(2, "0"), it[0], m && v.length > 14 ? m[0] : v.length <= 14 ? v : "", /^[-−]/.test(m ? m[0] : v) ? NB_C.down : NB_C.navy, v.length > 14 ? v : ""]; }), leftW: 70 });
  }
  pages.push({ name: "정리", top: ["한 줄로 정리하면", "[[" + String(r.insight || "").split(/(?<=[.요])\s/)[0] + "]]"], title: "기억할 것", sub: "기준: " + r.src, kind: "text", data: { paras: [r.insight].concat(items.slice(0, 3).map(function (it) { return "· " + it[0] + " — " + it[1]; })), after: ["기준", String(r.src || "") + " · 바뀔 수 있어 확인 필요"] } });
  return hubDraw({ small: r.kind === "data" ? "실제 데이터로 계산" : "저장해 두는 상식", hook: r.hook, lead: r.lead, pages: pages, close: [items.length + "개 중 몇 개나 알고 계셨나요?", ["저장해 두고 필요할 때", "꺼내 보세요."]], foot: "우상향연구소 · " + (r.src || "") + " · 투자 권유 아님" });
}
/* 릴스 이미지 → 같은 종이 틀(1080×1350)로 */
if (typeof reelImages === "function") { reelImages = function (r) { CARD_TXT = ""; return hubReelDeck(r); }; }

/* ============================================================ 주제 등록부 ============================================================ */
var HUB_NEW = [
  { id: "daily", t: "🗞️ 오늘 시장 데일리 9장", d: "미국 = S&P 500 전 종목 · 국내 = 코스피 시총상위 200 기준(KOSPI200 지수와 다름) — 한눈에 · 시장 체력 · 업종 · 거래 집중 · 업종 거래활동 · 신고가/신저가 · 자산군·상관 · 성적표 · 기사", g: "오늘 시장", need: "daily", fn: function () { return typeof dlDeck === "function" ? dlDeck() : []; } },
  { id: "news", t: "📰 오늘의 기사 — 1건 = 1장", d: "제목 · 본문 요약 · 관련 자산 실제 등락 · 기사 속 단어 풀이", g: "오늘 시장", need: "news", fn: hubNewsDeck },
  { id: "hi52", t: "🏔️ 52주 신고가 · 신저가", d: "오늘 1년 최고·최저로 끝난 종목 + 1개월 수익률", g: "오늘 시장", need: "brief", fn: function () { return hubTodayDeck("hi52"); } },
  { id: "sector", t: "🧭 업종 성적표 — 강한 곳 · 약한 곳", d: "업종 평균 등락 TOP6 · 하위 6 · 가장 센/약한 종목", g: "오늘 시장", need: "brief", fn: function () { return hubTodayDeck("sector"); } },
  { id: "sale", t: "🏷️ 고점 대비 할인 TOP12", d: "52주 고점 대비 · 고점까지 필요한 상승률 · 추세", g: "오늘 시장", need: "brief", fn: function () { return hubTodayDeck("sale"); } },
  { id: "vol", t: "💰 돈이 몰린 곳 — 거래대금 급증", d: "평소 대비 몇 배 · 그날 방향 · 1개월", g: "오늘 시장", need: "brief", fn: function () { return hubTodayDeck("vol"); } },
  { id: "season", t: "📆 이번 달은 과거에 어땠나", d: "S&P500·코스피·나스닥·금·비트코인·장기채의 이번 달 성적", g: "데이터로 보는 투자", need: "hist", fn: hubSeasonDeck },
  { id: "years", t: "📊 연도별 성적표 (S&P500 · 코스피)", d: "최근 12년 연간 수익률 · 최고·최악의 해 · 평균의 함정", g: "데이터로 보는 투자", need: "hist", fn: hubYearsDeck },
  { id: "worst", t: "🌪️ 최악의 하루 TOP10 — 1년 뒤", d: "하루 낙폭이 가장 컸던 날과 그 뒤 1년", g: "데이터로 보는 투자", need: "hist", fn: hubWorstDeck },
  { id: "decade", t: "⏳ 10년 전 · 5년 전 100만원", d: "주식·지수·금·채권·비트코인 12개 원화 기준", g: "재미로 보는 숫자", need: "hist", fn: hubDecadeDeck },
  { id: "dow", t: "📅 무슨 요일에 가장 많이 올랐나", d: "S&P500·코스피 요일별 평균 등락 · 오른 날 비율", g: "재미로 보는 숫자", need: "hist", fn: hubDowDeck },
  { id: "fx", t: "💱 같은 S&P500, 원화로 보면", d: "1·3·5·10년 달러 기준 vs 원화 기준 · 환율 효과", g: "데이터로 보는 투자", need: "hist", fn: hubFxDeck },
  { id: "dd", t: "📉 고점 대비 낙폭별 — 1년 뒤", d: "S&P500·코스피 · 고점에서 -5/-10/-20/-30% 빠진 날 샀다면 1년 뒤 평균·오른 비율 + 지금 칸", g: "데이터로 보는 투자", need: "hist", fn: hubDdDeck },
  { id: "vix", t: "😱 공포지수 구간별 — 1년 뒤", d: "VIX 15/20/30 구간별 S&P500 1년 뒤 · 지금 VIX 칸 · 역대 최고", g: "데이터로 보는 투자", need: "hist", fn: hubVixDeck },
  { id: "ma200", t: "📏 200일선 위·아래에서 산 뒤 1년", d: "S&P500·코스피 · 200일선 대비 위치별 1년 뒤 · 지금 위치", g: "데이터로 보는 투자", need: "hist", fn: hubMa200Deck }
];
function hubPrep(need) {
  if (need === "hist") return hubLoad(HUB_HIST);
  if (need === "daily") return Promise.all([hubLoad(HUB_HIST.concat(["IEF", "^KQ11", "ETH-USD"])), hubR() && typeof cardsNewsFetch === "function" ? cardsNewsFetch(hubR()).catch(function () { return []; }) : Promise.resolve(), typeof dlPrep === "function" ? dlPrep(hubR()).catch(function () { return null; }) : Promise.resolve()]);
  if (need === "news") return (hubR() && typeof cardsNewsFetch === "function" ? cardsNewsFetch(hubR()).catch(function () { return []; }) : Promise.resolve()).then(function () { return Promise.all(hubNewsItems().slice(0, 6).map(function (x) { return hubBodyFetch(x.it); })); });
  return Promise.resolve();
}
/* 묶음 → { prep: 데이터 준비, build: 카드 목록 } — 화면에 띄우지 않고 만들 수 있게 (aiDeck이 못 만드는 것만) */
function hubSrc(ctx) {
  var kind = ctx.split(":")[0], arg = ctx.split(":").slice(1).join(":");
  if (kind === "hub") { var x = HUB_NEW.filter(function (h) { return h.id === arg; })[0]; if (!x) return null; return { prep: function () { return hubPrep(x.need); }, build: function () { return x.fn() || []; } }; }
  if (kind === "issues") return { prep: function () { return hubPrep("news"); }, build: hubIssuesDeck };
  if (kind === "cal") return { prep: function () { return Promise.resolve(); }, build: hubCalDeck };
  if (kind === "term") return { prep: function () { return Promise.resolve(); }, build: hubTermDeck };
  if (kind === "macro") return { prep: function () { return macroEnsure().then(macPxLoad).then(function () { if (!macReady()) throw new Error("매크로 데이터가 아직 없어요"); }); }, build: function () { return macDeck(arg || "all"); } };
  if (kind === "ipo") return { prep: function () { return ipoEnsure(); }, build: function () { var l = []; [["ipoSched", "청약일정"], ["ipoResult", "상장성적"], ["ipoFirst", "첫날분포"]].forEach(function (p) { var x = ipoSpec("table", p[0]); if (x) l.push({ cv: tplCard("table", x.meta, x.spec), name: (l.length + 1) + "_" + p[1] }); }); return l; } };
  if (kind === "div") { var plan = [["rank", "divNeed", "필요투자금"], ["table", "divTop", "배당률TOP"], ["table", "divTax", "계좌별세금"], ["calendar", "divMonth", "배당락달력"]]; return { prep: function () { return Promise.all(plan.map(function (p) { return tplPrep(p[0], "all", p[1]); })); }, build: function () { return plan.map(function (p, i) { var x = dvSpec(p[0], p[1], "all"); return x ? { cv: tplCard(p[0], x.meta, x.spec), name: (i + 1) + "_" + p[2] } : null; }).filter(Boolean); } }; }
  if (kind === "disc" || kind === "guru") return { prep: function () { return dsEnsure(); }, build: function () {
    var l = [];
    if (kind === "guru") { var gs = dsGurus().slice().sort(function (a, b) { return (b.filed || "").localeCompare(a.filed || ""); }).slice(0, 2), keep = DS.g.id; gs.forEach(function (g) { DS.g.id = g.id; var x = dsSpec("table", "guruMoves"); if (x) l.push({ cv: tplCard("table", x.meta, x.spec), name: (l.length + 1) + "_" + g.nm.replace(/\s/g, "") }); }); DS.g.id = keep; var c = dsSpec("table", "guruCross"); if (c) l.push({ cv: tplCard("table", c.meta, c.spec), name: (l.length + 1) + "_같이움직인종목" }); }
    else [["table", "discInsider", "임원대주주"], ["rank", "discBuyback", "자사주"]].forEach(function (p) { var x = dsSpec(p[0], p[1]); if (x) l.push({ cv: tplCard(p[0], x.meta, x.spec), name: (l.length + 1) + "_" + p[2] }); });
    return l; } };
  return null;
}
/* aiDeck(카드 → 글자 수집)이 새 주제·배당·공시·구루·공모주·매크로도 읽게 */
(function () {
  if (typeof aiDeck !== "function") return;
  var a0 = aiDeck;
  aiDeck = function (ctx) {
    var S = hubSrc(ctx); if (!S) return a0.apply(this, arguments);
    return Promise.resolve(S.prep()).then(function () {
      var keep = [CARD_STYLE, CARD_SERIES, CARD_UNIT, CARD_MKT], c; try { c = aiCapture(S.build); } finally { CARD_STYLE = keep[0]; CARD_SERIES = keep[1]; CARD_UNIT = keep[2]; CARD_MKT = keep[3]; }
      var L = c.out || []; if (!L.length) throw new Error("이 묶음에 필요한 데이터가 아직 없어요"); return { list: L, lines: aiLinesFrom(L, c.rec) };
    });
  };
  if (typeof aiTitleOf === "function") { var t0 = aiTitleOf; aiTitleOf = function (ctx) { var h = hubTopic(ctx); return h ? cPlain(h.t).replace(/^\S+\s/, "") : t0.apply(this, arguments); }; }
})();

/* 모든 주제 (그룹 · 제목 · 설명 · 여러 장 열기 · 점수) */
function hubTopics() {
  var T = [], R = hubR(), now = typeof nbNow === "function" ? nbNow() : { match: {}, why: [] }, kst = hubKst(), dow = kst.getUTCDay(), dd = kst.getUTCDate(), mo = kst.getUTCMonth() + 1, seed = hubSeed();
  function add(o) { T.push(o); }
  var vix = R && (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0], vixV = vix ? parseFloat(vix.v) : null, temp = R ? R.temp : null;
  var S = hubStocks(), hiN = S.filter(function (s) { return s.newHigh; }).length, loN = S.filter(function (s) { return s.newLow; }).length, hot = R && (R.hotVol || [])[0], th = R ? (R.themes || []) : [];
  // 오늘 시장
  add({ ctx: "issues", g: "오늘 시장", t: "📌 핵심 이슈 5", d: "한 장 = 다섯 줄 요약 · 여러 장 = 이슈마다 무엇이·얼마나·왜 + 관련 기사", multi: function (b) { hubOpenList("issues", b); }, score: function () { return { s: 9, why: "매일 아침 고정 — 피드의 '오늘' 역할, 가장 먼저 읽히는 형식" }; } });
  add({ ctx: "brief", g: "오늘 시장", t: "📰 오늘의 브리핑 (약 10장)", d: "시장 온도 · 업종 · 급등락 · 돈 몰린 곳 · 숫자", multi: function () { cardsOpen("brief"); }, score: function () { var x = temp ? Math.abs(temp.upPct - 0.5) : 0; return { s: 6 + x * 10, why: temp ? "오른 종목 " + Math.round(temp.upPct * 100) + "% — " + (x >= 0.25 ? "시장이 한 방향으로 크게 움직인 날이라 전체 정리가 잘 읽혀요" : "평범한 날엔 전체 정리를 저장용으로") : "전일 정리 기본 세트" }; } });
  add({ ctx: "onepage", g: "오늘 시장", t: "🧾 오늘 한 장 (9칸)", d: "지수·온도·업종·급등락·기사를 한 페이지에", multi: function (b) { onePageOpen(b); }, score: function () { return { s: 5 + (dow >= 1 && dow <= 5 ? 1 : 0), why: "평일 — 한 장으로 끝나는 요약은 스레드·스토리에 바로 쓰기 좋아요" }; } });
  add({ ctx: "channel", g: "오늘 시장", t: "📺 채널 전일 정리 (국내+미국)", d: "주식 전일 정리 · 낙폭 · 자산배분 · 과거 사례", multi: function () { cardsOpen("channel"); }, score: function () { return { s: vixV >= 25 ? 8 : 5, why: vixV >= 25 ? "VIX " + vixV.toFixed(0) + " — 불안한 날엔 '과거 사례·낙폭'이 들어 있는 채널 세트가 저장돼요" : "국내·미국을 같이 보는 정리" }; } });
  HUB_NEW.forEach(function (h) {
    add({ ctx: "hub:" + h.id, g: h.g, t: h.t, d: h.d, multi: function (b) { hubOpenList("hub:" + h.id, b); }, score: function () {
      if (h.id === "daily") return { s: dow >= 1 && dow <= 5 ? 9.5 : 5, why: dow >= 1 && dow <= 5 ? "평일 아침 고정 — 9장 한 세트로 '오늘 시장'을 결론 문장 + 큰 숫자로 (한 장 = 01 한눈에)" : "주말엔 금요일 마감 기준으로" };
      if (h.id === "news") { var n = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items || []).length; return { s: n ? 8 : 6, why: n ? "오늘 기사 " + n + "건 수집 — 기사 1건을 한 장에 풀어 주는 형식이 '저장'이 많아요" : "아침 기사로 하루를 여는 고정 형식 (기사는 만들 때 받아 와요)" }; }
      if (h.id === "hi52") return { s: hiN + loN >= 15 ? 8 : hiN + loN >= 6 ? 6 : 3, why: "오늘 52주 신고가 " + hiN + "개 · 신저가 " + loN + "개" + (hiN > loN * 2 ? " — 신고가가 압도적, 시장 힘이 센 날" : loN > hiN * 2 ? " — 신저가가 많아 약한 날" : "") };
      if (h.id === "sector") { var sp = th.length >= 2 ? th[0].ret - th[th.length - 1].ret : 0; return { s: sp >= 0.04 ? 8 : sp >= 0.02 ? 6 : 3, why: th.length ? "업종 1등 " + th[0].name + " " + cPct(th[0].ret, 1) + " vs 꼴찌 " + th[th.length - 1].name + " " + cPct(th[th.length - 1].ret, 1) + " — 차이 " + cPct(sp, 1).replace("+", "") + "p" : "업종 데이터 준비 중" }; }
      if (h.id === "sale") { var c20 = S.filter(function (s) { return s.vsHi != null && s.vsHi <= -0.2; }).length; return { s: S.length && c20 / S.length >= 0.3 ? 7 : 4, why: "고점 대비 -20% 이하 " + c20 + "개" + (S.length ? " (" + Math.round(c20 / S.length * 100) + "%)" : "") + " — " + (c20 / Math.max(1, S.length) >= 0.3 ? "세일 중인 종목이 많은 날" : "평소 수준") }; }
      if (h.id === "vol") return { s: hot && hot.amtX >= 3 ? 7 : 4, why: hot ? "거래대금 1위 " + briefName(hot) + " 평소의 " + hot.amtX.toFixed(1) + "배" : "거래대금 데이터 준비 중" };
      if (h.id === "season") return { s: dd <= 5 ? 9 : dd >= 26 ? 7 : 3, why: dd <= 5 ? mo + "월 초 — '이번 달은 과거에 어땠나'가 가장 많이 찾는 때" : dd >= 26 ? "월말 — 다음 달 미리보기로 쓰기 좋아요" : "월초·월말에 올리면 반응이 좋은 주제" };
      if (h.id === "years") return { s: (mo === 12 && dd >= 15) || (mo === 1 && dd <= 10) ? 9 : 4 + (seed % 7 === 2 ? 2 : 0), why: mo === 12 || mo === 1 ? "연말·연초 — 한 해 성적표가 가장 많이 읽히는 때" : "저장용 상시 콘텐츠 · 순환 노출" };
      if (h.id === "worst") return { s: (vixV >= 25 || (temp && temp.upPct < 0.25)) ? 9 : 3, why: vixV >= 25 ? "VIX " + vixV.toFixed(0) + " — 공포가 큰 날 '최악의 날 1년 뒤'가 가장 위로가 돼요" : temp && temp.upPct < 0.25 ? "오른 종목 " + Math.round(temp.upPct * 100) + "% — 크게 빠진 날" : "급락장에 꺼내 쓰는 주제" };
      if (h.id === "decade") return { s: (dow === 0 || dow === 6) ? 7 : 3 + (seed % 5 === 1 ? 2 : 0), why: dow === 0 || dow === 6 ? "주말 — 가볍게 보는 '그때 샀다면' 시리즈가 공유가 많아요" : "재미형 상시 콘텐츠" };
      if (h.id === "dow") return { s: (dow === 0 || dow === 6) ? 6 : 2 + (seed % 6 === 3 ? 3 : 0), why: "재미로 보는 숫자 — 댓글 참여형" };
      if (h.id === "dd") { var spq = typeof nbStat === "function" ? nbStat("SPY") : null, ksq = typeof nbStat === "function" ? nbStat("^KS11") : null, ddm = Math.min(spq && spq.vsHi != null ? spq.vsHi : 0, ksq && ksq.vsHi != null ? ksq.vsHi : 0); return { s: ddm <= -0.2 ? 9.5 : ddm <= -0.1 ? 9 : ddm <= -0.05 ? 6 : 3 + (seed % 9 === 4 ? 2 : 0), why: ddm <= -0.05 ? "지수가 고점 대비 " + cPct(ddm, 0) + " — '이만큼 빠졌을 때 1년 뒤'가 가장 읽히는 때" : "고점 근처 — 조정이 오면 꺼내 쓰는 주제 (순환 노출)" }; }
      if (h.id === "vix") return { s: vixV >= 30 ? 9.5 : vixV >= 20 ? 8.5 : vixV != null && vixV < 13 ? 6 : 3 + (seed % 8 === 5 ? 2 : 0), why: vixV != null ? "VIX " + vixV.toFixed(1) + (vixV >= 20 ? " — 공포 구간, '공포에 샀다면'이 가장 위로되는 때" : vixV < 13 ? " — 너무 평온할 때의 경고로" : " — 평온, 상시 저장용") : "VIX 데이터 준비 중" };
      if (h.id === "ma200") { var a200 = temp && temp.above200Pct != null ? temp.above200Pct : null; return { s: a200 != null && (a200 <= 0.35 || a200 >= 0.8) ? 8 : 3 + (seed % 7 === 6 ? 2 : 0), why: a200 != null ? "200일선 위 종목 " + Math.round(a200 * 100) + "%" + (a200 <= 0.35 ? " — 대부분 선 아래, '아래에서 사면?' 질문이 나오는 때" : a200 >= 0.8 ? " — 대부분 선 위, 추격 매수 고민이 많은 때" : "") : "추세 상식 — 상시" }; }
      if (h.id === "fx") { var krw = typeof nbStat === "function" ? nbStat("KRW=X") : null; return { s: krw && Math.abs(krw.m1) >= 0.02 ? 8 : 3, why: krw ? "달러/원 1개월 " + cPct(krw.m1, 1) + (Math.abs(krw.m1) >= 0.02 ? " — 환율이 크게 움직인 달" : "") : "환율이 움직일 때 꺼내 쓰는 상식" }; }
      return { s: 3, why: "" };
    } });
  });
  // 정기 발행
  if (typeof PER_SETS !== "undefined") { var td = typeof perToday === "function" ? perToday() : []; Object.keys(PER_SETS).forEach(function (k) { add({ ctx: "per:" + k, g: "정기 발행", t: PER_SETS[k].t, d: PER_SETS[k].when + " 발행", multi: function () { perOpen(k); }, score: function () { return td.indexOf(k) >= 0 ? { s: 10, why: "오늘이 '" + cPlain(PER_SETS[k].t).replace(/^\S+\s/, "") + "' 발행일 (" + PER_SETS[k].when + ")" } : { s: 0, why: PER_SETS[k].when + " 발행" }; } }); }); }
  // 연구노트 (국면 · 낙폭 · 적립 · 오늘의 관찰 · 기사 vs 숫자)
  if (typeof storyDecks === "function") { var dk = []; try { dk = storyDecks(); } catch (e) {} dk.filter(function (x) { return x.key !== "news"; }).forEach(function (x) { add({ ctx: "story:" + x.key, g: "국면 · 연구노트", t: x.t, d: x.d, multi: function () { storyOpen(x.key); }, score: function () { var KW = { "scene:rateUp": /장기채/, "scene:rateDown": /장기채/, "scene:panic": /VIX|고점/, "scene:oilUp": /원유/, "scene:dollarUp": /달러/, drawdown: /고점|VIX/ }, w = now.why.filter(function (z) { return !KW[x.key] || KW[x.key].test(z); }); return x.now ? { s: x.key === "today" ? 7 : 9, why: x.key === "today" ? "매일 구성이 바뀌는 관찰 덱 — 오늘 가장 이례적인 것부터" : "지금 신호와 맞는 국면" + (w.length ? " — " + w.map(function (z) { return String(z).split(" → ").pop(); }).join(" · ") : "") } : { s: x.key === "dca" ? (dow === 5 ? 7 : 3) : 2, why: x.key === "dca" ? (dow === 5 ? "금요일 — 주말에 천천히 보는 '적금처럼' 시리즈" : "적립식 상시 콘텐츠") : "신호가 오면 추천돼요" }; } }); }); }
  // 매크로
  if (typeof macDeckList === "function" && typeof MAC !== "undefined" && MAC.doc && !MAC.doc.none) { var R2 = MAC.px && MAC.px.ks ? macroCompute() : []; (MAC.px && MAC.px.ks ? macDeckList() : []).forEach(function (x) { add({ ctx: "macro:" + x.id, g: "매크로 · 환율·금리", t: x.t, d: x.d, multi: function () { macroDeckOpen(x.id); }, score: function () { var r = R2.filter(function (z) { return z.c.id === x.id; })[0], l = r && r.ev[r.ev.length - 1]; if (r && r.now.on && l && Date.now() - l.t < 30 * 86400e3) return { s: 9, why: r.c.tag + " — 최근 30일 안에 새로 나온 조건 (" + r.now.txt + ")" }; if (r && r.now.on) return { s: 6, why: "지금 해당: " + r.now.txt }; return { s: x.id === "all" ? 3 : 1, why: x.id === "all" ? "조건 11개를 한 장에 — 상시 저장용" : "조건이 나오면 추천돼요" }; } }); }); }
  // 배당 · 공시 · 구루 · 공모주
  if (typeof dvDeckOpen === "function") add({ ctx: "div", g: "배당 · 공시 · 구루 · 공모주", t: "💰 배당 카드 4장", d: "필요 투자금 · 배당률 TOP · 계좌별 세금 · 이달 배당락", multi: function () { dvDeckOpen("all"); }, score: function () { var q = mo % 3 === 0 && dd >= 15; return { s: dd <= 3 ? 8 : q ? 8 : 3, why: dd <= 3 ? "월초 — '월 100만원 받으려면' · 이달 배당락 달력" : q ? mo + "월 분기 배당 시즌 — 배당락 전에 저장되는 카드" : "배당 상시 콘텐츠" }; } });
  if (typeof dsDeckOpen === "function") {
    add({ ctx: "disc", g: "배당 · 공시 · 구루 · 공모주", t: "🏛️ 공시 — 임원·대주주 매수매도 · 자사주", d: "최근 7일 지분 변동 · 30일 자사주 취득 결정", multi: function () { dsDeckOpen("disc"); }, score: function () { var h = typeof dsPlanHints === "function" && typeof DS !== "undefined" && DS.disc ? dsPlanHints().filter(function (x) { return x.kind === "disc"; })[0] : null; return h ? { s: 7, why: cPlain(h.t).replace(/^\S+\s/, "") } : { s: 3, why: "공시가 쌓이면 추천돼요" }; } });
    add({ ctx: "guru", g: "배당 · 공시 · 구루 · 공모주", t: "🧓 구루 13F — 투자 대가들의 분기 매매", d: "최근 공개한 투자자 매수·매도 · 같이 움직인 종목", multi: function () { dsDeckOpen("guru"); }, score: function () { var h = typeof dsPlanHints === "function" && typeof DS !== "undefined" && DS.guru ? dsPlanHints().filter(function (x) { return x.kind === "guru"; })[0] : null; return h ? { s: 8, why: cPlain(h.t).replace(/^\S+\s/, "") } : { s: (mo === 2 || mo === 5 || mo === 8 || mo === 11) && dd >= 14 ? 6 : 2, why: (mo === 2 || mo === 5 || mo === 8 || mo === 11) && dd >= 14 ? "13F 공개 시즌(분기 끝 45일 뒤)" : "13F 공개 시즌에 추천돼요" }; } });
  }
  if (typeof ipoDeckOpen === "function") add({ ctx: "ipo", g: "배당 · 공시 · 구루 · 공모주", t: "🎟️ 공모주 — 청약 일정 · 상장 성적", d: "청약일 · 공모가 · 최소 증거금 · 증권사 · 첫날 성적", multi: function () { ipoDeckOpen(); }, score: function () { var h = typeof ipoPlanHints === "function" ? ipoPlanHints()[0] : null; return h ? { s: 8, why: cPlain(h.t).replace(/^\S+\s/, "") } : { s: 2, why: "청약 일정이 있으면 추천돼요" }; } });
  // 상식 · 데이터 리스트 (구 릴스)
  if (typeof REEL_LIST !== "undefined") REEL_LIST.forEach(function (x, i) { add({ ctx: "reel:" + x.id, g: x.g === "데이터" ? "데이터로 보는 투자" : "투자 상식 리스트", t: (x.g === "데이터" ? "📈 " : "📚 ") + x.t, d: x.d, multi: function () { reelOpen(x.id); }, score: function () { var on = seed % REEL_LIST.length === i; return { s: on ? 6 : (x.id === "bear" && (vixV >= 25 || (temp && temp.upPct < 0.3))) ? 7 : 1, why: on ? "오늘 순서의 상식 리스트 (매일 하나씩 돌아가며)" : x.id === "bear" && vixV >= 25 ? "불안한 날 — '하락장 금지 7'이 저장돼요" : "저장용 상식" }; } }); });
  // 정책 · 일정 · 용어
  if (typeof pubPolicyAll === "function") pubPolicyAll().forEach(function (p) { add({ ctx: "policy:" + p.id, g: "정책 · 일정 · 용어", t: "🏠 " + (p.short || p.t), d: (p.eff || "") + (p.src ? " · " + p.src : ""), multi: function () { pubPolicyOpen(p.id); }, score: function () { return { s: 1, why: "정책 정리 — 바뀔 때 다시 올리기" }; } }); });
  add({ ctx: "cal", g: "정책 · 일정 · 용어", t: "🗓️ 이번 주 일정", d: "한 장 = 7일 한눈에 · 여러 장 = 날짜마다 무엇을·왜 중요한가", multi: function (b) { hubOpenList("cal", b); }, score: function () { var up = typeof pubUpcoming === "function" ? pubUpcoming(2).filter(function (e) { return e.k !== "hol"; }) : []; return dow === 1 ? { s: 9, why: "월요일 고정 — 한 주의 길잡이, 저장률 높은 형식" } : up.length ? { s: 6, why: "48시간 안 일정: " + up.slice(0, 2).map(function (e) { return cPlain(e.t).replace(/^\S+\s/, ""); }).join(", ") } : { s: 2, why: "" }; } });
  add({ ctx: "term", g: "정책 · 일정 · 용어", t: "📖 용어 한 입 — " + (typeof pubTerm === "function" ? pubTerm()[0] : ""), d: "한 장 = 정의 카드 · 여러 장 = 뜻·쉽게·실전·지금 숫자로", multi: function (b) { hubOpenList("term", b); }, score: function () { return { s: 4, why: "매일 1장 저장용 — 오늘의 단어 '" + (typeof pubTerm === "function" ? pubTerm()[0] : "") + "'" }; } });
  return T;
}
function hubTopic(ctx) { return hubTopics().filter(function (x) { return x.ctx === ctx; })[0] || null; }
/* 오늘의 주제 10 — 점수 순 · 그룹당 최대 3개 */
function hubToday(n) {
  var L = hubTopics().map(function (x) { var sc = { s: 0, why: "" }; try { sc = x.score(); } catch (e) {} return Object.assign({}, x, { s: sc.s, why: sc.why }); }).sort(function (a, b) { return b.s - a.s; });
  var out = [], byG = {}; L.forEach(function (x) { if (out.length >= (n || 10)) return; byG[x.g] = (byG[x.g] || 0) + 1; if (byG[x.g] > 3 && L.length > 14) return; out.push(x); });
  if (out.length < (n || 10)) L.forEach(function (x) { if (out.length < (n || 10) && out.indexOf(x) < 0) out.push(x); });
  return out;
}

/* ============================================================ 버튼 4개 ============================================================ */
function hubBtns(ctx) {
  return '<div class="hubActs"><button class="chip" data-hub="one" data-ctx="' + ctx + '" title="묶음 전체 내용을 핵심만 한 장에">한 장</button><button class="chip" data-hub="multi" data-ctx="' + ctx + '" title="상세 묶음 카드">여러 장</button><button class="chip aiBtn" data-hub="ai1" data-ctx="' + ctx + '" title="AI가 묶음 전체를 읽고 한 장 기획">AI 한 장</button><button class="chip aiBtn" data-hub="aiN" data-ctx="' + ctx + '" title="AI가 근거 숫자만 써서 풀어 쓴 상세 카드">AI 여러 장</button></div>';
}
function hubBind(box) {
  Array.prototype.forEach.call(box.querySelectorAll("[data-hub]"), function (b) {
    b.onclick = function () {
      var m = b.getAttribute("data-hub"), ctx = b.getAttribute("data-ctx"), t = hubTopic(ctx);
      if (m === "multi") { if (t) { var mk = (typeof MK !== "undefined" && MK.mk) || null; if ((ctx === "brief" || ctx === "onepage") && mk && briefState.market !== mk && typeof switchBriefMarket === "function") switchBriefMarket(mk); try { t.multi(b); } catch (e) { alert("만들지 못했어요: " + e.message); } } }
      else if (m === "one") hubOne(ctx, b);
      else if (m === "ai1") { if (typeof aiOpen === "function") aiOpen(ctx, b); }
      else if (m === "aiN") hubAiMulti(ctx, b);
    };
  });
}
/* 카드 목록 보여주기 (공용 창) */
/* v12.21 모든 카드에 인스타 캡션 + 스레드 글 — 묶음이 직접 만든 글(opts.thr)이 없으면 카드의 결론 문장·읽는 요약으로 자동 작성 */
function hubThreadsAuto(title, list, opts) {
  if (typeof thrCompose !== "function") return [];
  var spec = HUB.lastSpec && Date.now() - (HUB.lastSpecAt || 0) < 90e3 ? HUB.lastSpec : null, B = opts.brief || null;
  var tops = spec && spec.pages ? spec.pages.map(function (p) { return cPlain((p.top || []).filter(Boolean).join(" ")).replace(/\s{2,}/g, " ").trim(); }).filter(Boolean).slice(0, 5) : [];
  if (!tops.length && opts.lines) tops = opts.lines.slice(0, 5);
  if (!tops.length) tops = [hubStrip(String(opts.note || title))];
  var base = { summary: (B && B.head ? [B.head] : []).concat(tops).slice(0, 6), insights: B ? [B.issueLine, B.expLine, B.gapLine, B.so].filter(Boolean) : [spec && spec.lead ? spec.lead : ""].filter(Boolean), cardList: list.map(function (x, i) { return (i + 1) + " " + x.name; }), question: "이 중에 가장 의외였던 건 뭐였나요?", tags: ["우상향연구소", "주식초보", "재테크", "투자공부"], foot: "과거·오늘 종가 자동 집계 · 투자 권유 아님" };
  var out = []; function add(label, hook) { try { var c = thrCompose(Object.assign({}, base, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); } catch (e) {} }
  var name = hubStrip(String(title)).replace(/ · (한 장|여러 장)$/, "");
  add("초보 질문형", name + ",\n숫자로 보면 어떨까요?"); add("반전형", name + ".\n생각과 다른 숫자가 있었어요."); add("정리형", name + " —\n오늘 숫자를 한 장에 정리했어요.");
  return out;
}
/* v12.21 릴스형(1080×1920): 게시형 카드를 검정 바탕 가운데에 두고(인스타 UI가 덮는 위 250·아래 350px은 비움) 위엔 채널명, 아래엔 저장 안내 */
function hubReelWrap(cv) {
  var out = document.createElement("canvas"); out.width = 1080; out.height = 1920; var g = out.getContext("2d");
  g.fillStyle = "#14161c"; g.fillRect(0, 0, 1080, 1920);
  var y0 = Math.round((1920 - cv.height) / 2); g.save(); g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = 40; g.drawImage(cv, 0, y0, 1080, cv.height); g.restore();
  g.textBaseline = "alphabetic"; cText(g, "우상향연구소 · 데이터로 보는 투자", 540, y0 - 36, 24, 800, "#e6c57a", "center");
  cText(g, "저장해 두고 다음에 다시 보세요 · @uphill.lab", 540, y0 + cv.height + 56, 22, 700, "#a9a291", "center");
  return out;
}
function hubSize() { return (typeof MK !== "undefined" && MK.size) || (function () { try { return localStorage.getItem("sm.cardSize") || "post"; } catch (e) { return "post"; } })(); }
function hubShow(title, list, opts) {
  opts = opts || {};
  if (hubSize() === "reel") list.forEach(function (it) { if (it.cv && it.cv.height !== 1920) it.cv = hubReelWrap(it.cv); });
  if (!opts.thr || !opts.thr.length) opts.thr = hubThreadsAuto(title, list, opts);
  var day = typeof pubToday === "function" ? pubToday().replace(/-/g, "") : "", box = document.createElement("div"), slug = String(title).replace(/[^가-힣A-Za-z0-9]/g, "").slice(0, 14);
  box.innerHTML = (opts.note ? '<div class="briefDim" style="margin-bottom:8px">' + opts.note + '</div>' : '') + '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button></div>' + (opts.thr && typeof thrPanelHtml === "function" ? thrPanelHtml("주식") : "") + (opts.log ? '<details class="howto"><summary>숫자 확인 ' + opts.log.length + '줄</summary><div class="body"><ul>' + opts.log.map(function (l) { return '<li>' + hubEsc(l) + '</li>'; }).join("") + '</ul></div></details>' : '') + '<div class="cardsWrap"></div>';
  var wrap = box.querySelector(".cardsWrap");
  list.forEach(function (it, i) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_" + slug + "_" + day + "_" + (i + 1) + "_" + String(it.name).replace(/[^가-힣A-Za-z0-9_]/g, "") + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + ". " + hubEsc(it.name) + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
  box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
  if (opts.thr && typeof thrBind === "function") try { thrBind(box, opts.thr); } catch (e) {}
  if (opts.ctx) hubDoneAdd(opts.ctx, title);
  var host = document.getElementById("mkResult");
  if (host && typeof currentTab !== "undefined" && currentTab === "onecard" && !opts.modal) {   // v12.1 작업대 안에 바로 보여 준다
    // v12.14 결과가 생기면 ①②③은 접고 결과를 맨 위에 — '다른 주제 만들기'로 다시 펼친다
    var pane = host.parentElement; if (pane) pane.classList.add("wbCollapsed");
    host.innerHTML = '<div class="wbStep"><b>4</b> 결과 · 업로드 <small>' + hubEsc(title) + ' · ' + list.length + '장</small><button class="chip wbClose" title="①②③ 펼치기">← 다른 주제 만들기</button></div>';
    host.appendChild(box); host.hidden = false; host.querySelector(".wbClose").onclick = function () { host.hidden = true; host.innerHTML = ""; if (pane) pane.classList.remove("wbCollapsed"); try { pane.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} };
    if (opts.brief) { var bb = document.createElement("div"); bb.className = "wbBrief"; bb.innerHTML = hubBriefHtml(opts.brief); box.insertBefore(bb, box.firstChild); }
    try { host.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
    return;
  }
  infoModal.open(title + " · " + list.length + "장", box);
}
function hubFonts(fn) {
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  return ready.then(function () { CARD_TXT = ""; try { fn(); } catch (e) {} if (!document.fonts || !document.fonts.load) return; var txt = CARD_TXT.replace(/\s+/g, ""); return Promise.all([500, 600, 700, 800, 900].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })); }).then(function () { return fn(); });
}
function hubOpenList(ctx, btn) {
  var t = hubTopic(ctx), old = btn ? btn.innerHTML : ""; if (btn) { btn.textContent = "만드는 중…"; btn.disabled = true; }
  var S = hubSrc(ctx); if (!S) { if (btn) { btn.innerHTML = old; btn.disabled = false; } return; }
  Promise.all([Promise.resolve(S.prep()).then(function () { return hubFonts(S.build); }), hubBrief(ctx).catch(function () { return null; })])
    .then(function (r) { var list = r[0], B = r[1]; if (!list || !list.length) throw new Error("데이터가 아직 없어요"); if (B) { var bc = hubBriefCard(B, hubTitleOf(ctx), list.length + 1); if (bc) list.splice(list[0] && list[0].name === "표지" ? 1 : 0, 0, { name: "읽는요약", cv: bc }); } hubShow(t ? cPlain(t.t).replace(/^\S+\s/, "") : "카드", list, { ctx: ctx, brief: B, note: "위 검정 = 결론 먼저, 아래 종이 = 근거. 2번째 '읽는 요약' 장 = 숫자 + 요즘 이슈 + 전문가 의견을 한 장에. 나머지는 과거·오늘 숫자만.", thr: hubThreads(ctx, list, B) }); })
    .catch(function (e) { alert("만들지 못했어요: " + e.message); }).then(function () { if (btn) { btn.innerHTML = old; btn.disabled = false; } });
}

/* ---------- [한 장] 묶음 전체에서 핵심만 꽉 채운 한 장 (AI 없이) ----------
   주제마다 '구조가 있는 데이터'에서 뽑는다 (카드 글자를 다시 읽지 않음 → 이름·숫자가 정확히 짝지어짐) */
var HUB_SKIP = /(출처|투자 권유|StockMind|자동 집계|uphill|@|저장해 두|다음 장|댓글로|관찰 \d|^\d+\s*\/\s*\d+$|읽는 법|프로필)/;
function hubSplitFact(t) {
  var re = /([+\-−]?\d[\d,]*(?:\.\d+)?\s*(?:%p|%|배|원|만원|억원|억|조|달러|개월|년|일|개|건|번|회|주|명|bp)?(?:\s*\/\s*\d+)?)(?!.*\d)/, m = String(t).match(re);
  if (!m) return null; var v = m[1].trim(), lab = String(t).slice(0, m.index).replace(/[·:|→\-\s(]+$/, "").trim();
  return { label: lab || String(t).slice(m.index + m[0].length).replace(/^[)\s·]+/, "").trim(), value: v };
}
function hubStrip(s) { return cPlain(String(s || "")).replace(/\[\[|\]\]/g, "").trim(); }
/* hubDraw 명세 → 사실 목록 (장마다 고르게) */
function hubSpecFacts(spec) {
  var per = [];
  spec.pages.forEach(function (p) {
    var L = [], d = p.data;
    if (p.kind === "gauge" && d && isFinite(d.v)) L.push({ label: (d.title || "") + " 지금 위치", value: (d.fmt || String)(d.v) });
    if (p.kind === "pair" && d && d.rows) d.rows.forEach(function (r) { if (isFinite(r.a)) L.push({ label: (d.aName || "A") + " · " + hubStrip(r.l), value: (d.fmt || function (x) { return cPct(x, 0); })(r.a) }); if (isFinite(r.b)) L.push({ label: (d.bName || "B") + " · " + hubStrip(r.l), value: (d.fmt || function (x) { return cPct(x, 0); })(r.b) }); });
    if (p.kind === "rows" || (p.kind === "tiles" && d.rows)) (p.kind === "rows" ? d : d.rows).forEach(function (r) { if (r && r[2] != null && String(r[2]).trim() !== "-" && !/표본 부족|데이터 없음/.test(String(r[1]))) L.push({ label: hubStrip(r[1]) + (r[0] && !/^\d+$/.test(r[0]) ? " · " + hubStrip(r[0]) : ""), value: hubStrip(r[2]) }); });   // v12.17 값 없는 행은 한 장에서 뺀다
    if (p.kind === "tiles") d.tiles.forEach(function (t) { L.push({ label: hubStrip(t.l), value: hubStrip(t.v) }); });
    if (p.kind === "bars") d.forEach(function (b) { L.push({ label: hubStrip(b.l), value: b.txt || cPct(b.v, 1) }); });
    if (p.kind === "table") d.rows.forEach(function (r) { L.push({ label: hubStrip(r[0]) + " · " + d.cols[1], value: hubStrip(r[1]), note: d.cols.slice(2).map(function (c, i) { return c + " " + hubStrip(r[i + 2]); }).join(" · ") }); });
    if (p.kind === "text" && d.tiles) d.tiles.forEach(function (t) { L.push({ label: hubStrip(p.top[0]).slice(0, 30) + " · " + hubStrip(t.l), value: hubStrip(t.v) }); });
    per.push(L.filter(function (x) { return x.value && x.label; }));
  });
  var out = [], k = 0; while (out.length < 14 && k < 20) { per.forEach(function (L) { if (L[k] && out.length < 14) out.push(L[k]); }); k++; }
  return { head: hubStrip(spec.hook.join(" ")), head2: spec.pages[0] ? hubStrip(spec.pages[0].top.filter(Boolean).slice(0, 2).join(" ")) : "", facts: out, src: spec.foot || "" };
}
/* 한 장 그리기: 맨 위 검정 결론 띠 + 사실 칸(값이 길면 글로) */
function hubOneCard(sp) {
  if (HUB.oneBrief && !sp.brief) { sp.brief = HUB.oneBrief; if (HUB.oneBrief.head && !sp.head2) sp.head2 = HUB.oneBrief.head; }
  var meta = { title: sp.title, sub: sp.sub || "", source: sp.src || (cDate(Date.now()) + " 기준 · StockMind 자동 집계"), catName: "한 장 요약", cat: "table" };
  var c = tplNew(meta), g = c.g, P = TPL.P, W = TPL.W - P * 2, F = (sp.facts || []).slice(0, 14), y = c.y;
  if (sp.head2) { var hs = 30, nl = Math.min(2, cWrapCount(g, sp.head2, W - 40, hs, 800)), hh = nl * 40 + 34; cRound(g, P, y, W, hh, 12, TPL_C.black); cWrap(g, sp.head2, P + 20, y + 48, W - 40, hs, 800, TPL_C.gold, 40, 2); y += hh + 14; }
  var longV = F.some(function (f) { return String(f.value).length > 12; }), two = F.length > 6 && !longV, cols = two ? 2 : 1, rowsN = Math.ceil(F.length / cols) || 1;
  var B = sp.brief && (sp.brief.issue.length || sp.brief.exp) ? sp.brief : null, bh = B ? 150 : 0;   // v12.1 아래 '요즘 이슈 · 전문가' 띠
  var avail = TPL.H - TPL.FOOT - 22 - y - bh, rh = Math.max(56, Math.min(two ? 230 : 200, Math.floor(avail / rowsN))), cw = (W - (cols - 1) * 14) / cols;
  if (rh * rowsN > avail) { F = F.slice(0, Math.floor(avail / rh) * cols); rowsN = Math.ceil(F.length / cols); }
  F.forEach(function (f, i) {
    var col = i % cols, row = Math.floor(i / cols), x = P + col * (cw + 14), yy = y + row * rh, h = rh - 10, v = String(f.value);
    cRound(g, x, yy, cw, h, 12, row % 2 ? "#ffffff" : TPL_C.box); g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.stroke();
    var ls = Math.max(18, Math.min(two ? 24 : 28, h * 0.24));
    if (v.length > 12 && h < 104) {   // v11.9 줄이 낮으면 한 줄로: 이름(왼쪽) + 값(오른쪽, 줄여서) — 겹치지 않게
      var vs1 = Math.min(26, h * 0.4); while (vs1 > 16 && cW(g, v, vs1, 800) > cw * 0.55) vs1 -= 1;
      cText(g, cFit(g, f.label, cw * 0.4, ls, 700), x + 18, yy + h / 2 + ls * 0.36, ls, 700, TPL_C.ink2); cText(g, cFit(g, v, cw * 0.56, vs1, 800), x + cw - 18, yy + h / 2 + vs1 * 0.36, vs1, 800, TPL_C.ink, "right"); return;
    }
    if (v.length > 12) {   // 값이 문장이면: 이름 한 줄 + 값 두 줄
      cText(g, cFit(g, f.label, cw - 36, ls, 800), x + 18, yy + ls + 14, ls, 800, TPL_C.gold2);
      var vs = Math.max(20, Math.min(30, (h - ls - 30) / 2.6)); cWrap(g, v, x + 18, yy + ls + 24 + vs * 1.1, cw - 36, vs, 700, TPL_C.ink, vs * 1.35, Math.max(1, Math.floor((h - ls - 28) / (vs * 1.35))));
      return;
    }
    var vs2 = Math.min(two ? 48 : 60, h * 0.46); while (vs2 > 22 && cW(g, v, vs2, 900) > cw * (two ? 0.62 : 0.38)) vs2 -= 2;
    if (two) { var n2 = Math.min(2, cWrapCount(g, f.label, cw - 30, ls, 700)); cWrap(g, f.label, x + 15, yy + 10 + ls * 1.1, cw - 30, ls, 700, TPL_C.ink2, ls * 1.25, 2); cText(g, v, x + cw - 15, yy + h - 16, vs2, 900, tplCol(v), "right"); if (f.note && n2 < 2 && h > 120) cText(g, cFit(g, f.note, cw * 0.4, 16, 600), x + 15, yy + h - 18, 16, 600, TPL_C.sub); }
    else { var lw = cw * 0.58, n1 = Math.min(2, cWrapCount(g, f.label, lw, ls, 700)), ty = yy + h / 2 - (n1 - 1) * ls * 0.62 + ls * 0.3 - (f.note ? 12 : 0); cWrap(g, f.label, x + 20, ty, lw, ls, 700, TPL_C.ink2, ls * 1.25, 2); if (f.note && h >= 84) cText(g, cFit(g, f.note, lw, 17, 600), x + 20, ty + n1 * ls * 1.25 + 4, 17, 600, TPL_C.sub); cText(g, v, x + cw - 20, yy + h / 2 + vs2 * 0.34, vs2, 900, tplCol(v), "right"); }
  });
  if (!F.length) cWrap(g, "이 묶음엔 한 장으로 뽑을 숫자가 없어요. [여러 장]을 써 주세요.", P, y + 60, W, 30, 700, TPL_C.ink2, 44, 3);
  if (B) hubBriefStrip(c, B, TPL.H - TPL.FOOT - 22 - bh + 10, bh - 10);
  return tplFoot(c, (sp.n ? "상세 " + sp.n + "장은 게시물에서 · " : "") + "과거·오늘 숫자 요약 · 투자 권유 아님");
}
function hubTitleOf(ctx) { var t = hubTopic(ctx); return t ? hubStrip(t.t).replace(/^\S+\s/, "").replace(/\s*\(.*?\)\s*$/, "") : (typeof aiTitleOf === "function" ? aiTitleOf(ctx) : "한 장 요약"); }
/* 주제 → 한 장 (canvas) */
function hubOneMake(ctx) {
  var kind = ctx.split(":")[0], arg = ctx.split(":").slice(1).join(":"), title = hubTitleOf(ctx);
  function one(cv) { return [{ name: "한장요약", cv: cv }]; }
  function viaSpec(prep, draw) { return Promise.resolve(prep()).then(function () { HUB.lastSpec = null; CARD_TXT = ""; var l = draw() || []; if (!HUB.lastSpec || !l.length) throw new Error("데이터가 아직 없어요"); var f = hubSpecFacts(HUB.lastSpec); return function () { return hubOneCard({ title: title, sub: f.head2 ? "" : f.head, head2: f.head2, facts: f.facts, src: f.src, n: l.length }); }; }); }
  if (kind === "hub" && arg === "daily") return hubPrep("daily").then(function () { return function () { var R = hubR(); return R ? dlCard1(R) : null; }; });
  if (kind === "hub") { var x = HUB_NEW.filter(function (h) { return h.id === arg; })[0]; return viaSpec(function () { return hubPrep(x.need); }, x.fn); }
  if (kind === "reel") return (typeof nbLoad === "function" && REEL_DATA[arg] && arg !== "loss" ? nbLoad(REEL_HIST) : Promise.resolve()).then(function () {
    if (TPL_SOURCES.lines.some(function (z) { return z.id === "hxReel_" + arg; })) return function () { return tplBuild("lines", "hxReel_" + arg); };
    var r = reelGet(arg); if (!r) throw new Error("데이터가 아직 없어요");
    var F = r.items.map(function (it) { var m = hubSplitFact(it[1]); return m && m.value ? { label: it[0] + (m.label && m.label !== it[1] ? " · " + m.label : ""), value: m.value } : { label: it[0], value: String(it[1]) }; });
    return function () { return hubOneCard({ title: hubStrip(r.t || r.hook.join(" ")), head2: hubStrip(r.hook.join(" ")), facts: F, src: r.src, n: r.items.length }); };
  });
  if (kind === "issues") return Promise.resolve(function () { var l = hubIssuesList(); return l.length ? issuesCard(l) : null; });
  if (kind === "cal") return Promise.resolve(function () { return pubCalCard(); });
  if (kind === "term") return Promise.resolve(function () { return pubTermCard(pubTerm(typeof pubState !== "undefined" ? pubState.termOffset || 0 : 0)); });
  if (kind === "onepage") return aiDeck(ctx).then(function (d) { var cv = d.list && d.list[0] && d.list[0].cv; if (!cv) throw new Error("데이터가 아직 없어요"); return function () { return cv; }; });
  if (kind === "brief") return aiDeck("onepage").then(function (d) { if (!d.list || !d.list[0]) throw new Error("데이터가 아직 없어요"); return function () { return d.list[0].cv; }; });
  if (kind === "macro") return macroEnsure().then(macPxLoad).then(function () {
    if (!macReady()) throw new Error("매크로 데이터가 아직 없어요");
    if (!arg || arg === "all") return function () { return tplBuild("table", "hxMacro"); };
    var r = macRes(arg), st = r.st, bk = macBase("ks", 365), F = [];
    F.push({ label: "지금", value: r.now.big || "-", note: r.now.on ? "조건에 해당" : "조건 밖" });
    MAC_H.forEach(function (h, i) { F.push({ label: "코스피 " + h[1] + " 뒤 중앙값", value: cPct(st.ks[i].med, 0), note: st.ks[i].n + "번 중 " + st.ks[i].win + "번 상승" }); });
    if (bk) F.push({ label: "평소(아무 날) 1년", value: cPct(bk.med, 0), note: "상승 " + Math.round(bk.win * 100) + "%" });
    F.push({ label: "S&P500(원화) 1년 중앙값", value: cPct(st.spk[2].med, 0) }); F.push({ label: "환율 1년 뒤 중앙값", value: cPct(st.fx[2].med, 0) });
    r.ev.slice(-6).reverse().forEach(function (e) { var v = e.f.ks[2]; F.push({ label: macD(e.t, true) + " 사례 → 코스피 1년", value: typeof v === "number" ? cPct(v, 0) : v === "wait" ? "진행 중" : "-" }); });
    return function () { return hubOneCard({ title: r.c.tag + " → 1년 뒤", head2: (r.from ? new Date(r.from).getUTCFullYear() + "년 이후 " : "") + r.ev.length + "번 · 다음 거래일에 샀다면 · " + r.c.mean.split(" — ")[0], facts: F, src: "한국은행 ECOS · 미국 FRED · 야후 종가 · " + cDate(Date.now()), n: 8 }); };
  });
  var S = hubSrc(ctx);
  if (kind === "div") return Promise.resolve(S.prep()).then(function () { return function () { var x = dvSpec("table", "divTop", "all"); return x ? tplCard("table", x.meta, x.spec) : null; }; });
  if (kind === "disc") return Promise.resolve(S.prep()).then(function () { return function () { var x = dsSpec("table", "discInsider"); return x ? tplCard("table", x.meta, x.spec) : null; }; });
  if (kind === "guru") return Promise.resolve(S.prep()).then(function () { return function () { var x = dsSpec("table", "guruMoves"); return x ? tplCard("table", x.meta, x.spec) : null; }; });
  if (kind === "ipo") return Promise.resolve(S.prep()).then(function () {
    var L = ipoSched().filter(function (x) { var k = ipoStatus(x)[0]; return k === "soon" || k === "now" || k === "wait"; }).slice(0, 6), Fd = ipoFirstDay(), F = [];
    L.forEach(function (x) { var B = ipoBuy(x), U = ipoUw(x, 2); F.push({ label: x.name + " · 청약 " + ipoD(x.sbd[0]) + (x.sbd[1] && x.sbd[1] !== x.sbd[0] ? "~" + ipoD(x.sbd[1]) : ""), value: x.price ? ipoWon(x.price) : x.band ? ipoNum(x.band[0]) + "~" + ipoNum(x.band[1]) : "-", note: (B.minDep ? "최소 증거금 " + ipoWon(B.minDep) : "") + (U.length ? " · " + U.join(", ") : "") }); });
    if (Fd.n) { F.push({ label: "최근 1년 첫날 종가 중앙값", value: cPct(Fd.med, 0), note: Fd.n + "개 · 가운데 절반 " + cPct(Fd.q1, 0) + "~" + cPct(Fd.q3, 0) }); F.push({ label: "첫날 공모가 위로 마감", value: Math.round(Fd.up * 100) + "%", note: "최근 1년" }); }
    ipoListed().slice(0, Math.max(0, 10 - F.length)).forEach(function (x) { F.push({ label: x.name + " · " + ipoD(x.ret.listDate) + " 상장 → 지금", value: cPct(x.ret.last, 0), note: "첫날 종가 " + cPct(x.ret.c0, 0) + " · 1개월 " + cPct(x.ret.m1, 0) }); });
    if (!F.length) throw new Error("공모주 기록이 아직 없어요");
    return function () { return hubOneCard({ title: "공모주 한 장 — 청약 · 상장 성적", head2: L.length ? "청약 일정 " + L.length + "곳 · 공모가 · 최소 증거금 · 증권사 + 최근 상장 성적" : "최근 상장 공모주 성적 · 공모가 대비", facts: F, src: "DART 증권신고서·투자설명서 · 야후 종가 · " + cDate(Date.now()), n: 3 }); };
  });
  // 나머지(채널·정기 발행·연구노트·정책): 대표 카드용 사실 목록(이름·값 짝)
  return aiDeck(ctx).then(function (d) {
    var names = (d.list || []).map(function (it) { return it.name; }), sp = typeof ocDeckSpec === "function" ? ocDeckSpec(ctx, names, { draft: !!d.draft }) : null;
    if (!sp || !sp.facts || !sp.facts.length) throw new Error("이 묶음은 한 장으로 줄일 데이터가 없어요");
    return function () { return hubOneCard({ title: title, head2: hubStrip(typeof ocFill === "function" ? ocFill(sp, sp.hook || "") : sp.hook || "").replace(/\n/g, " ").replace(/\{[a-z]\d+\}/g, ""), facts: sp.facts.map(function (f) { return { label: f.label || "", value: f.value, note: f.note }; }), src: sp.src, n: names.length }); };
  });
}
function hubOne(ctx, btn) {
  var old = btn ? btn.innerHTML : ""; if (btn) { btn.textContent = "만드는 중…"; btn.disabled = true; }
  Promise.all([hubOneMake(ctx), hubBrief(ctx).catch(function () { return null; })]).then(function (r) { HUB.oneBrief = r[1]; return hubFonts(r[0]).then(function (cv) { HUB.oneBrief = null; return cv; }, function (e) { HUB.oneBrief = null; throw e; }); }).then(function (cv) {
    if (!cv) throw new Error("데이터가 아직 없어요");
    hubShow(hubTitleOf(ctx) + " · 한 장", [{ name: "한장요약", cv: cv }], { ctx: ctx, note: "상세 묶음의 핵심을 한 장에 담았어요(AI 없음 · 숫자는 앱 데이터 그대로) + 아래 띠에 요즘 이슈·전문가 의견. 게시물 첫 장·스토리·스레드 이미지로 쓰기 좋아요.", thr: hubThreads(ctx, [{ name: "한장요약" }]) });
  }).catch(function (e) { alert("한 장을 만들지 못했어요: " + e.message); }).then(function () { if (btn) { btn.innerHTML = old; btn.disabled = false; } });
}

/* ---------- [AI 여러 장] AI가 묶음 전체를 읽고 5~8장으로 풀어 씀 — 숫자는 근거 줄에 있는 그대로만, 앱이 그림 ---------- */
function hubAiMulti(ctx, btn) {
  var t = hubTopic(ctx), old = btn ? btn.innerHTML : ""; if (btn) { btn.textContent = "AI 기획 중…"; btn.disabled = true; }
  var lines = null, title = t ? cPlain(t.t).replace(/^\S+\s/, "") : ctx, B = null;
  Promise.all([aiDeck(ctx), hubBrief(ctx).catch(function () { return null; })]).then(function (r) {
    var d = r[0]; B = r[1];
    lines = (d.lines || []).filter(function (l) { return !HUB_SKIP.test(l.text); }); if (!lines.length) throw new Error("묶음에서 읽을 내용이 없어요");
    if (B) hubBriefLines(B).forEach(function (t2, i) { lines.push({ id: "n" + (i + 1), text: t2 }); });
    return fetch("/api/channel?op=ai", { method: "POST", headers: { "x-owner": typeof ocTok === "function" ? ocTok() : "", "Content-Type": "application/json" }, body: JSON.stringify({ mode: "deck", title: title, n: Math.min(8, Math.max(5, Math.round(lines.length / 12))), lines: lines.slice(0, 500).map(function (l) { return { id: l.id, text: l.text }; }) }) }).then(function (r) { return r.json(); });
  }).then(function (j) {
    if (!j || !j.ok) throw new Error((typeof OC_REASON !== "undefined" && OC_REASON[j && j.reason]) || (j && j.reason) || "AI 실패");
    var chk = hubAiCheck(j.out, lines);
    return hubFonts(function () { var L = hubAiCards(j.out, chk, title); if (B) { var bc = hubBriefCard(B, title, L.length + 1); if (bc) L.splice(1, 0, { name: "읽는요약", cv: bc }); } return L; }).then(function (list) { hubShow(title + " · AI 여러 장", list, { ctx: ctx, brief: B, note: "AI(" + j.model + ")가 묶음 " + lines.length + "줄을 읽고 기획했어요. 숫자는 근거 줄에 있는 표기만 썼고, 근거와 다른 숫자 줄은 뺐어요.", log: chk.log, thr: hubAiThreads(j.out, title, list) }); });
  }).catch(function (e) { alert("AI 여러 장을 만들지 못했어요: " + e.message); }).then(function () { if (btn) { btn.innerHTML = old; btn.disabled = false; } });
}
function hubNorm(s) { return String(s || "").replace(/[\s,]/g, "").replace(/[‐-―−]/g, "-"); }
function hubAiCheck(out, lines) {
  var by = {}; lines.forEach(function (l) { by[l.id] = hubNorm(l.text); }); var log = [], all = hubNorm(lines.map(function (l) { return l.text; }).join(" "));
  (out.cards || []).forEach(function (c, ci) { c.rows = (c.rows || []).filter(function (r) { var v = hubNorm(r.value), ok = v && ((by[r.ref] && by[r.ref].indexOf(v) >= 0) || all.indexOf(v) >= 0); if (!ok) log.push((ci + 1) + "장 '" + r.label + " " + r.value + "' — 근거 줄에 없어 뺐어요"); return ok; }); });
  if (!log.length) log.push("모든 숫자가 근거 줄과 일치했어요");
  return { log: log };
}
function hubAiCards(out, chk, title) {
  var cards = (out.cards || []).filter(function (c) { return c.title; }), total = cards.length + 1, list = [];
  cards.forEach(function (c, i) {
    if (i === 0) { list.push({ name: "표지", cv: nbCover(c.kicker || title, String(c.title).split("\n").slice(0, 2), c.lead || "", cDate(Date.now()) + " 기준 · 앱 데이터 + AI 기획 · 투자 권유 아님") }); return; }
    var cv = nbNew(); nbTop(cv, i, String(c.title).split("\n").slice(0, 2).concat(c.lead ? ["", c.lead] : []), i + 1, total);
    nbBody(cv, c.kicker || title, c.sub || "");
    if (c.rows && c.rows.length) hubRowsFill(cv, c.rows.slice(0, 8).map(function (r) { return [r.tag || "", r.label, r.value, /^[-−▼]/.test(r.value) ? NB_C.down : /^[+▲]/.test(r.value) ? NB_C.up : NB_C.navy, r.note || ""]; }), 170);
    if (c.takeaway && NB.H - 110 - cv.y > 110) nbGoldLine(cv, c.takeaway, "");
    nbFoot(cv, "앱 데이터 기준 · AI 기획 · 숫자는 근거 줄 그대로 · 투자 권유 아님"); list.push({ name: String(c.kicker || "카드" + (i + 1)).replace(/\s/g, "").slice(0, 10), cv: cv.cv });
  });
  list.push({ name: "마무리", cv: nbClose(out.question || "이 중에 가장 의외였던 숫자는요?", ["저장해 두고 다음에", "숫자가 바뀌면 다시 비교해 보세요."]) });
  return list;
}

/* ---------- 업로드 글 (v11.0 공식) ---------- */
function hubThreads(ctx, list, B) {
  if (typeof thrCompose !== "function") return [];
  B = B || (HUB.briefCache[ctx] && HUB.briefCache[ctx].B) || null;
  var kind = ctx.split(":")[0], arg = ctx.split(":")[1];
  try {
    if (kind === "macro" && typeof thrMacro === "function") return thrMacro(arg || "all", list.map(function (x) { return x.name; }));
    if (kind === "ipo" && typeof thrIpo === "function") return thrIpo(list.map(function (x) { return x.name; }));
    if (kind === "story" && typeof thrStory === "function") return thrOr(thrStory(arg, list.map(function (x) { return x.name; })), storyCaption(arg));
  } catch (e) {}
  var t = hubTopic(ctx), name = t ? cPlain(t.t).replace(/^\S+\s/, "") : "오늘의 카드", lines = [];
  var spec = HUB.lastSpec && Date.now() - (HUB.lastSpecAt || 0) < 90e3 ? HUB.lastSpec : null, tops = kind === "hub" && arg === "daily" && typeof DL !== "undefined" && DL.bigs ? DL.bigs.slice(0, 5) : spec && spec.pages ? spec.pages.map(function (p) { return cPlain((p.top || []).filter(Boolean).join(" ")).replace(/\s{2,}/g, " ").trim(); }).filter(Boolean).slice(0, 5) : [];   // v12.21 카드의 결론 문장을 글감으로
  var base = { summary: (B ? [B.head].concat(B.nums.slice(0, 3).map(function (f) { return f.label + " " + f.value; })) : []).concat(tops).slice(0, 7).filter(Boolean).length ? (B ? [B.head] : []).concat(tops.length ? tops : B ? B.nums.slice(0, 3).map(function (f) { return f.label + " " + f.value; }) : [t ? t.d : ""]) : [t ? t.d : ""], insights: B ? [B.issueLine, B.expLine, B.gapLine, B.so].filter(Boolean) : [], cardList: list.map(function (x, i) { return (i + 1) + " " + x.name; }), question: "이 중에 가장 의외였던 건 뭐였나요?", tags: ["우상향연구소", "주식초보", "재테크", "투자공부"], foot: "과거·오늘 종가 자동 집계" + (B && B.issue.length ? " · 기사: " + B.issue.map(function (x) { return x.press; }).filter(Boolean).join(", ") : "") + " · 투자 권유 아님", data: B ? B.nums.slice(0, 6).map(function (f) { return f.label + " " + f.value; }) : [t ? t.d : name], sort: false, thFoot: "종가 자동 집계 · 투자 권유 아님", limit: ["한계도 적어둘게요.", "과거 숫자예요. 같은 상황에서 같은 결과가 나온다는 보장은 없습니다."], reply: "다음엔 어떤 숫자가 궁금하세요?" };
  var out = []; function add(label, hook) { var c = thrCompose(Object.assign({}, base, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  add("초보 질문형", name + ",\n숫자로 보면 어떨까요?"); add("반전형", name + ".\n생각과 다른 숫자가 있었어요.");
  return thrSafe(out);
}
function hubAiThreads(out, title, list) {
  if (typeof thrCompose !== "function") return [];
  var rows = []; (out.cards || []).forEach(function (c) { (c.rows || []).slice(0, 2).forEach(function (r) { rows.push(r.label + " " + r.value); }); });
  var base = { summary: rows.slice(0, 6), insights: (out.cards || []).map(function (c) { return c.takeaway; }).filter(Boolean).slice(0, 2), cardList: list.map(function (x, i) { return (i + 1) + " " + x.name; }), question: out.question || "이 중에 가장 의외였던 숫자는요?", tags: ["우상향연구소", "주식초보", "재테크", "투자공부"], foot: "앱 데이터 + AI 기획 · 투자 권유 아님", data: rows.slice(0, 6), sort: false, thFoot: "앱 데이터 · 투자 권유 아님", limit: ["한계도 적어둘게요.", "숫자는 앱이 계산한 과거·오늘 값이고, 문장은 AI가 정리했어요. 예측이 아닙니다."], reply: "다음엔 어떤 숫자가 궁금하세요?" };
  var c = thrCompose(Object.assign({}, base, { hook: cPlain(String((out.cards && out.cards[0] && out.cards[0].title) || title)).replace(/\n/g, ",\n") })); return thrSafe([{ label: "AI 기본형", th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }]);
}

/* ============================================================ 화면 (카드 만들기의 두 탭) ============================================================ */
function hubTodayHtml() {
  var L = hubToday(10), ck = typeof pubChecklist === "function" ? pubChecklist() : [];
  var bad = ck.filter(function (c) { return !c.ok; }).length;
  var h = '<details class="hubCk"' + (bad ? ' open' : '') + '><summary>발행 전 점검 ' + (bad ? '<b class="rbWarn">확인 ' + bad + '건</b>' : '<b style="color:#2e7d4f">이상 없음</b>') + '</summary><div class="pubCk">' + ck.map(function (c) { return '<div class="pubCkRow ' + (c.ok ? "ok" : c.w ? "bad" : "warn") + '"><span>' + (c.ok ? "✅" : c.w ? "⛔" : "⚠️") + '</span><span>' + hubEsc(c.t) + '</span></div>'; }).join("") + '</div></details>';
  h += '<h4 class="chSub">오늘의 주제 10 <small>' + "일월화수목금토"[hubKst().getUTCDay()] + '요일 · 시장 신호 · 일정 · 데이터로 점수를 매겼어요</small></h4><div class="hubList">' + L.map(function (x, i) {
    return '<div class="hubItem"><div class="hubRank">' + (i + 1) + '</div><div class="hubMain"><b>' + hubEsc(x.t) + '</b><small>' + hubEsc(x.d) + '</small><div class="hubWhy"><span>선정 이유</span>' + hubEsc(x.why || "상시 콘텐츠") + '</div>' + hubBtns(x.ctx) + '</div></div>';
  }).join("") + '</div><div class="briefDim" style="margin-top:8px">한 장 = 묶음 전체에서 핵심 숫자만 꽉 채운 한 장 · 여러 장 = 상세 묶음 · AI 한 장 / AI 여러 장 = AI가 같은 내용을 읽고 기획(숫자는 앱 데이터 그대로)</div>';
  return h;
}
function hubDecksHtml() {
  var T = hubTopics().map(function (x) { var sc = { s: 0, why: "" }; try { sc = x.score(); } catch (e) {} return Object.assign({}, x, sc); }), rec = T.slice().sort(function (a, b) { return b.s - a.s; }).filter(function (x) { return x.s >= 6; }).slice(0, 8);
  var groups = []; T.forEach(function (x) { if (groups.indexOf(x.g) < 0) groups.push(x.g); });
  function row(x, why) { return '<div class="hubItem sm"><div class="hubMain"><b>' + hubEsc(x.t) + '</b><small>' + hubEsc(x.d) + (why && x.why ? ' · <span class="hubWhyS">' + hubEsc(x.why) + '</span>' : '') + '</small>' + hubBtns(x.ctx) + '</div></div>'; }
  var h = rec.length ? '<h4 class="mkH">⭐ 지금 시장에 맞는 추천 <small>' + rec.length + '</small></h4><div class="hubList">' + rec.map(function (x) { return row(x, true); }).join("") + '</div>' : '';
  groups.forEach(function (g) { var L = T.filter(function (x) { return x.g === g; }); h += '<details class="hubG"' + (g === "오늘 시장" ? ' open' : '') + '><summary class="mkH">' + g + ' <small>' + L.length + '</small></summary><div class="hubList">' + L.map(function (x) { return row(x, x.s >= 6); }).join("") + '</div></details>'; });
  return h;
}

/* ============================================================ 한 장 양식에 내용 추가 (양식 → 내용 고르기) ============================================================ */
(function () {
  if (typeof TPL_SOURCES === "undefined" || typeof tplSpec !== "function") return;
  for (var i = 1; i <= 6; i++) TPL_SOURCES.quote.push({ id: "hxNews" + i, t: "오늘의 기사 " + i + "번째 (제목 · 요약 · 숫자)" });
  TPL_SOURCES.table.push({ id: "hxMacro", t: "매크로 조건별 코스피 1년 뒤 (환율·금리)" }, { id: "hxYears", t: "연도별 성적표 S&P500 · 코스피" }, { id: "hxFx", t: "S&P500 달러 vs 원화 수익률" });
  TPL_SOURCES.grid.push({ id: "hxMacroNow", t: "지금 매크로 숫자 (환율·금리·M2)" });
  TPL_SOURCES.rank.push({ id: "hxDecade", t: "10년 전 100만원 → 지금 순위" });
  if (typeof REEL_FIX !== "undefined") REEL_FIX.forEach(function (r) { TPL_SOURCES.lines.push({ id: "hxReel_" + r.id, t: "상식 · " + r.t }); });
  var s0 = tplSpec; tplSpec = function (cat, src, mk) { if (/^hx/.test(src || "")) { try { return hubTplSpec(cat, src, mk); } catch (e) { console.warn(e); return null; } } return s0.apply(this, arguments); };
  var p0 = tplPrep; tplPrep = function (cat, mk, src) {
    if (!/^hx/.test(src || "")) return p0.apply(this, arguments);
    if (/^hxNews/.test(src)) return hubPrep("news");
    if (src === "hxMacro" || src === "hxMacroNow") return typeof macroEnsure === "function" ? macroEnsure().then(function (d) { return d && !d.none && src === "hxMacro" ? macPxLoad() : null; }) : Promise.resolve();
    if (src === "hxYears" || src === "hxFx" || src === "hxDecade") return hubLoad(HUB_HIST);
    return Promise.resolve();
  };
})();
function hubTplSpec(cat, src, mk) {
  var date = cDate(Date.now());
  if (/^hxNews/.test(src)) {
    var x = hubNewsItems()[+src.slice(6) - 1]; if (!x) return null;
    var facts = x.syms.map(function (s) { var st = nbStat(s); return st ? [hubName(s), cPct(st.ret1, 1)] : null; }).filter(Boolean);
    var R = hubR(); if (facts.length < 4 && R) R.indexRow.slice(0, 4 - facts.length).forEach(function (i) { facts.push([i.name, cPct(i.ret, 1)]); });
    var paras = x.desc ? x.desc.split(/(?<=[다요]\.)\s+/).filter(Boolean).slice(0, 3) : ["기사 요약이 제공되지 않았어요 — 제목과 숫자를 같이 보세요."];
    return { meta: { title: "\"" + x.t + "\"", source: "네이버 뉴스 · " + (x.it.press || "") + " · " + date, source2: "숫자는 야후 파이낸스 종가(전일 등락)", catName: "오늘의 기사" }, spec: { tag: "오늘의 기사", person: { name: x.it.press || "기사", role: String(x.it.time || "").slice(0, 16), facts: facts.slice(0, 6) }, paras: paras } };
  }
  if (src === "hxMacro") {
    if (typeof macReady !== "function" || !macReady()) return null;
    var Rm = macroCompute().filter(function (r) { return r.st.ks[2].n >= 1; }).sort(function (a, b) { return b.st.ks[2].med - a.st.ks[2].med; }), bk = macBase("ks", 365);
    return { meta: { title: "환율·금리가 이럴 때\n1년 뒤 코스피는?", sub: "조건이 처음 나온 다음 거래일에 샀다면 · 중앙값 · 평소 " + cPct(bk && bk.med, 0), source: "한국은행 ECOS · 미국 FRED · 야후 종가 · " + date, catName: "매크로" }, spec: { cols: ["조건", "사례", "코스피 1년", "S&P(원화) 1년", "지금"], widths: [0.38, 0.1, 0.18, 0.2, 0.14], hlCols: [2], rows: Rm.slice(0, 9).map(function (r) { var a = r.st.ks[2], b = r.st.spk[2]; return [r.c.short, r.ev.length + "번", cPct(a.med, 0) + " (" + a.win + "/" + a.n + ")", b.n ? cPct(b.med, 0) : "-", r.now.on ? "해당" : ""]; }), note: "사례가 적어 참고용 · 예측 아님" } };
  }
  if (src === "hxMacroNow") {
    if (typeof macKpis !== "function" || !MAC.doc || MAC.doc.none) return null; var K = macKpis(); if (!K.length) return null;
    var boxes = K.map(function (k) { var m = String(k.v).match(/^([+\-]?[\d.,]+)(.*)$/); return { label: k.l, value: m ? m[1] : k.v, unit: m ? m[2] : "" }; });
    K.forEach(function (k) { if (k.sub && boxes.length < 12) { var m = String(k.sub).match(/([+\-]?[\d.,]+)\s*(%p|%|원)?/); if (m && /^한 달/.test(k.sub)) boxes.push({ label: k.l.replace(/\(.*\)/, "") + " " + k.sub.split(" ")[0] + (k.sub.indexOf("1년") >= 0 ? "" : " 변화"), value: m[1], unit: m[2] || "" }); } });
    return { meta: { title: "지금 매크로 숫자", sub: date + " 기준 · 환율 · 기준금리(한·미) · 미 10년 금리 · M2", source: "한국은행 ECOS · 미국 FRED", catName: "매크로" }, spec: { boxes: boxes.slice(0, 12), note: "한미 금리차 + = 미국 금리가 더 높음 · M2 = 시중에 풀린 돈" } };
  }
  if (src === "hxYears") {
    var a = hubYears("SPY"), b = hubYears("^KS11"); if (a.length < 5) return null;
    return { meta: { title: "연도별 성적표\nS&P500 · 코스피", sub: "전년 말 → 그해 말 · 지수 기준 · 올해는 지금까지", source: "야후 파이낸스 종가 · " + date, catName: "연도별" }, spec: { cols: ["연도", "S&P500", "코스피", "같이?"], widths: [0.25, 0.25, 0.25, 0.25], hlCols: [1, 2], rows: a.slice(-10).reverse().map(function (x) { var k = (b.filter(function (z) { return z.y === x.y; })[0] || {}).v; return [x.y + (x.ytd ? "*" : ""), cPct(x.v, 1), k == null ? "-" : cPct(k, 1), x.v > 0 && k > 0 ? "둘 다 ↑" : x.v < 0 && k < 0 ? "둘 다 ↓" : "엇갈림"]; }), note: "* 올해는 지금까지 · 배당 제외" } };
  }
  if (src === "hxFx") {
    var sp = hubRows("SPY"), fx = hubRows("KRW=X"), now = sp.length ? sp[sp.length - 1].t : 0, at = function (r, t) { return r[Math.min(r.length - 1, hubIdx(r, t))].c; };
    if (sp.length < 300 || fx.length < 300) return null;
    var rows = [1, 3, 5, 10].map(function (y) { var t0 = now - y * 365.25 * 86400e3; if (sp[0].t > t0 || fx[0].t > t0) return null; var u = sp[sp.length - 1].c / at(sp, t0) - 1, f = fx[fx.length - 1].c / at(fx, t0) - 1; return [y + "년", cPct(u, 0), cPct(f, 0), cPct((1 + u) * (1 + f) - 1, 0), Math.round(at(fx, t0)).toLocaleString("ko-KR") + "원"]; }).filter(Boolean);
    return { meta: { title: "같은 S&P500,\n원화로 보면?", sub: "달러 기준 · 환율 변화 · 원화 기준 · 그때 환율", source: "야후 파이낸스(SPY · 달러/원) · " + date, catName: "환율 효과" }, spec: { cols: ["기간", "달러 기준", "환율", "원화 기준", "그때 환율"], widths: [0.16, 0.2, 0.18, 0.22, 0.24], hlCols: [3], rows: rows, note: "배당·세금·환전 수수료 제외" } };
  }
  if (src === "hxDecade") {
    var L = ["SPY", "QQQ", "^KS11", "005930.KS", "000660.KS", "NVDA", "AAPL", "MSFT", "TSLA", "GLD", "TLT", "BTC-USD"], fxr = hubRows("KRW=X"), out = [];
    L.forEach(function (sym) { var r = hubRows(sym); if (r.length < 50) return; var t0 = r[r.length - 1].t - 10 * 365.25 * 86400e3; if (r[0].t > t0 + 20 * 86400e3) return; var i = hubIdx(r, t0), x = r[r.length - 1].c / r[i].c; if (!/\.KS$|\^KS11/.test(sym) && fxr.length) x *= fxr[fxr.length - 1].c / fxr[Math.min(fxr.length - 1, hubIdx(fxr, r[i].t))].c; out.push({ sym: sym, x: x }); });
    out.sort(function (a, b) { return b.x - a.x; }); if (out.length < 4) return null;
    return { meta: { title: "10년 전 100만원,\n지금은?", sub: "원화 기준(환율 반영) · 배당·세금 제외", source: "야후 파이낸스 종가 · " + date, catName: "그때 샀다면" }, spec: { items: out.slice(0, 12).map(function (x, i) { var v = x.x * 1e6; return { rank: i + 1, name: hubName(x.sym), value: v >= 1e8 ? (v / 1e8).toFixed(1) + "억" : Math.round(v / 1e4).toLocaleString("ko-KR") + "만", tag: cPct(x.x - 1, 0) }; }) } };
  }
  if (/^hxReel_/.test(src)) {
    var r = (typeof REEL_FIX !== "undefined" ? REEL_FIX : []).filter(function (z) { return z.id === src.slice(7); })[0]; if (!r) return null;
    var it = r.items.slice(0, 7), last = r.items[7];
    return { meta: { title: cPlain(r.hook.join("\n")), sub: r.lead, source: r.src, catName: "투자 상식" }, spec: { rows: it.map(function (x) { var w = String(x[1]); return { icon: "", left: x[0], right: w, sub: "" }; }), punch: last ? { left: last[0].slice(0, 10), right: String(last[1]).slice(0, 14) } : null, closing: String(r.insight).split(/(?<=[.요])\s/)[0] } };
  }
  return null;
}


/* ============================================================ v12.1 읽는 요약 — 숫자 + 요즘 이슈 + 전문가 의견을 독자 화법으로 ============================================================ */
HUB.briefCache = HUB.briefCache || {};
/* 주제 → 기사 검색어 (없으면 기사·전문가 생략) */
function hubQuery(ctx) {
  var k = ctx.split(":")[0], a = ctx.split(":").slice(1).join(":"), R = hubR(), th = R ? (R.themes || []) : [], mo = hubKst().getUTCMonth() + 1;
  if (k === "hub") return ({ news: null, hi52: "52주 신고가 종목 증권가", sector: th.length ? th[0].name + " 업종 전망 증권사" : "업종 전망 증권사", sale: "저가 매수 기회 증권사 의견", vol: "거래대금 급증 종목", season: mo + "월 증시 전망 증권사", years: "연간 증시 전망 증권사", worst: "급락 이후 반등 전망 전문가", decade: "장기투자 수익률 전문가", dow: null, fx: "환율 전망 전문가" })[a] || null;
  if (k === "macro") return "환율 금리 전망 전문가";
  if (k === "div") return "배당주 전망 증권사"; if (k === "ipo") return "공모주 청약 전망"; if (k === "disc") return "자사주 매입 공시 주가"; if (k === "guru") return "버핏 13F 매수 매도";
  if (k === "cal") return "이번주 증시 일정 변수"; if (k === "term") return (typeof pubTerm === "function" ? pubTerm(typeof pubState !== "undefined" ? pubState.termOffset || 0 : 0)[0] : "") + " 투자";
  if (k === "reel" || k === "policy") return null;
  return "증시 전망 증권사 애널리스트";
}
var HUB_SO = {
  "hub:hi52": "신고가가 많은 날은 시장 힘이 센 날, 신저가가 많은 날은 약한 날이에요. 내 종목이 어느 줄에 있는지만 확인해 보세요.",
  "hub:sector": "업종 차이가 클수록 '뭘 들고 있느냐'가 수익을 갈라요. 한 업종에 몰려 있다면 비중부터 점검해 보세요.",
  "hub:sale": "많이 빠졌다고 다 싼 건 아니에요. 고점 대비 낙폭과 이익 전망을 같이 보고, 산다면 나눠서 사세요.",
  "hub:vol": "돈이 몰린 종목은 그만큼 변동도 커요. 따라 사기보다 '왜 몰렸나'를 먼저 읽어 보세요.",
  "hub:season": "달력 효과는 참고일 뿐이에요. 적립 날짜를 바꾸는 것보다 꾸준히 사는 게 결과가 좋았어요.",
  "hub:years": "해마다 성적은 크게 달랐지만, 오래 들고 있을수록 손해로 끝난 해는 줄었어요.",
  "hub:worst": "최악의 날 다음 1년은 생각보다 괜찮았던 적이 많아요. 공포에 팔지 않는 것만으로도 절반은 성공이에요.",
  "hub:decade": "10년 전 1백만원의 차이는 '무엇을'보다 '얼마나 오래'에서 났어요.",
  "hub:fx": "환율은 미국 주식 수익률을 바꿔요. 달러 기준과 원화 기준을 같이 보는 습관을 들이세요.",
  macro: "금리·환율은 6~12개월 뒤 실적과 수급으로 돌아와요. 오늘 반응보다 방향을 보세요.",
  div: "배당은 공짜 돈이 아니에요. 배당률보다 '배당이 꺾이지 않을 회사인지'가 먼저예요.",
  ipo: "공모주는 첫날 성적 분포를 알고 들어가야 해요. 최소 증거금과 배정 방식부터 확인하세요.",
  disc: "임원·대주주 매수는 좋은 신호지만, 금액과 횟수를 같이 보세요. 자사주는 '취득 후 소각'인지가 핵심이에요.",
  guru: "대가의 매매는 분기 늦게 공개돼요. 따라 사기보다 '왜 샀나'를 공부하는 재료로 쓰세요.",
  cal: "일정은 변동성의 예고편이에요. 발표 전날 큰 매매는 피하고, 결과를 보고 움직여도 늦지 않아요.",
  term: "용어를 알면 뉴스가 읽혀요. 오늘 단어를 내 계좌에서 한 번 찾아보세요.",
  issues: "이슈는 하루면 바뀌지만 숫자는 남아요. 제목보다 '얼마나·왜'를 기억하세요.",
  _: "숫자는 과거와 오늘의 값이에요. 그대로 반복된다는 보장은 없으니, 살 금액과 기간을 먼저 정하고 보세요."
};
function hubSo(ctx) { var k = ctx.split(":")[0]; return HUB_SO[ctx] || HUB_SO[k] || HUB_SO._; }
/* 기사 분류 (report.js 의 RP_BULL/RP_BEAR 가 있으면 그대로) */
function hubClassify(items) {
  var BU = typeof RP_BULL !== "undefined" ? RP_BULL : /(상향|매수|반등|회복|호조|기대|수혜|긍정|호재|최선호|저평가)/, BE = typeof RP_BEAR !== "undefined" ? RP_BEAR : /(하향|매도|우려|악화|부진|리스크|둔화|하락|약세|경고|과열|거품)/;
  var bull = [], bear = []; items.forEach(function (x) { var s = x.t + " " + (x.desc || "").slice(0, 80), b = BU.test(s), r = BE.test(s); if (b && !r) bull.push(x); else if (r && !b) bear.push(x); });
  return { bull: bull, bear: bear };
}
/* 주제의 숫자(구조 데이터) — 한 장과 같은 사실 목록을 캔버스 없이 */
function hubBriefFacts(ctx) {
  return hubOneMake(ctx).then(function (draw) { var keep = HUB.oneBrief; HUB.oneBrief = null; var F = []; var o0 = hubOneCard; hubOneCard = function (sp) { F = (sp.facts || []).slice(); return o0(sp); }; try { CARD_TXT = ""; draw(); } catch (e) {} finally { hubOneCard = o0; HUB.oneBrief = keep; } return F; }).catch(function () { return []; });
}
/* 읽는 요약 만들기: { head, nums[], issue[], exp{bull,bear}, issueLine, expLine, so, srcs } · 30분 캐시 */
function hubBrief(ctx) {
  var c = HUB.briefCache[ctx]; if (c && Date.now() - c.at < 30 * 60e3) return Promise.resolve(c.B);
  var q = hubQuery(ctx), t = hubTopic(ctx), title = hubTitleOf(ctx);
  var pN = (/^(hub:news|issues|brief|onepage|channel|cal|term|reel:|policy:)/.test(ctx) ? Promise.resolve([]) : hubBriefFacts(ctx));
  var pI = q && typeof fetchNews === "function" ? fetchNews({ type: "raw", q: q, size: 12 }).catch(function () { return []; }) : Promise.resolve([]);
  var pG = (/^(issues|brief|onepage|channel|hub:news)$/.test(ctx) && hubR() && typeof cardsNewsFetch === "function") ? cardsNewsFetch(hubR()).catch(function () { return []; }) : Promise.resolve();
  return Promise.all([pN, pI, pG]).then(function (r) {
    var F = r[1] && r[1].length !== undefined ? r[0] : r[0], raw = (r[1] || []).map(function (it) { return { t: cNewsClean(it.title || ""), press: it.press || "", time: String(it.time || "").slice(0, 10), url: it.url || "", desc: cNewsClean(it.desc || "") }; }).filter(function (x) { return x.t; });
    var seen = {}; raw = raw.filter(function (x) { var k = x.t.slice(0, 18); if (seen[k]) return false; seen[k] = 1; return true; });
    var gen = /^(issues|brief|onepage|channel|hub:news)$/.test(ctx) ? hubNewsItems().slice(0, 2).map(function (x) { return { t: x.t, press: x.it.press || "", time: String(x.it.time || "").slice(0, 10), url: x.it.url || "", desc: x.desc || "" }; }) : [];
    var cls = hubClassify(raw), issue = (gen.length ? gen : raw.slice(0, 2)).slice(0, 2), exp = raw.length >= 2 ? { bull: cls.bull.slice(0, 3), bear: cls.bear.slice(0, 3), n: raw.length } : null;
    var nums = [], seenN = {}; (F || []).forEach(function (f) { if (!f || !f.value || !/\d/.test(String(f.value))) return; var k = String(f.label || "").split(/\s*[·:]\s*/)[0] + "|" + f.value; if (seenN[k]) return; seenN[k] = 1; nums.push(f); }); nums = nums.slice(0, 6);
    var head = hubHead(ctx, nums, t);
    var issueLine = issue.length ? "요즘 기사에선 " + issue.map(function (x) { return "'" + x.t.replace(/[\.…]+$/, "") + "'(" + (x.press || "기사") + ")"; }).join(", ") + (issue.length > 1 ? " 같은 이야기가 나와요." : " 이야기가 나와요.") : "";
    var expLine = exp ? (exp.bull.length + exp.bear.length === 0 ? "최근 기사 " + exp.n + "건에서 뚜렷한 상승·하락 의견은 아직 없어요." : "전문가 의견은 상승 쪽 " + exp.bull.length + ", 조심 쪽 " + exp.bear.length + (exp.bull.length > exp.bear.length ? " — 기대가 앞서요. " : exp.bull.length < exp.bear.length ? " — 경계가 앞서요. " : " — 팽팽해요. ") + [exp.bull[0] ? "'" + exp.bull[0].t + "'(" + exp.bull[0].press + ")" : "", exp.bear[0] ? "'" + exp.bear[0].t + "'(" + exp.bear[0].press + ")" : ""].filter(Boolean).join(" vs ")) : "";
    var ours = [head, issueLine].concat(nums.map(function (f) { return f.label + " " + f.value; })).join(" "), gapW = exp ? hubGap(exp.bull.concat(exp.bear), ours, 4) : [];
    var gapLine = gapW.length ? "이 카드가 안 다룬 시각: " + gapW.map(function (g) { return g.w; }).join(" · ") + " — 기사 쪽 주제예요. 숫자와 같이 보세요." : "";
    var B = { ctx: ctx, title: title, head: head, nums: nums, issue: issue, exp: exp, issueLine: issueLine, expLine: expLine, gap: gapW, gapLine: gapLine, so: hubSo(ctx), q: q, srcs: issue.concat(exp ? exp.bull.concat(exp.bear) : []).map(function (x) { return x.press + (x.time ? " " + x.time : ""); }).filter(function (x, i, a) { return x.trim() && a.indexOf(x) === i; }) };
    HUB.briefCache[ctx] = { at: Date.now(), B: B }; return B;
  });
}
/* 한 줄 결론 — 독자 화법 */
function hubHead(ctx, nums, t) {
  var k = ctx.split(":")[0], a = ctx.split(":")[1], R = hubR();
  if (k === "hub" && a === "hi52") { var S = hubStocks(), hiN = S.filter(function (x) { return x.newHigh; }).length, loN = S.filter(function (x) { return x.newLow; }).length; return "오늘 52주 신고가 " + hiN + "개, 신저가 " + loN + "개 — " + (hiN > loN * 2 ? "시장 힘이 센 날이에요." : loN > hiN * 2 ? "약한 날이에요." : "힘이 팽팽한 날이에요."); }
  if (k === "hub" && a === "sector" && R && R.themes && R.themes.length >= 2) { var th = R.themes; return "오늘은 " + th[0].name + "(" + cPct(th[0].ret, 1) + ") 쪽이 끌고 " + th[th.length - 1].name + "(" + cPct(th[th.length - 1].ret, 1) + ") 쪽이 처졌어요."; }
  if (k === "issues" || k === "brief" || k === "onepage" || k === "channel") { var tp = R && R.temp; return tp ? "오늘 오른 종목이 " + Math.round(tp.upPct * 100) + "%" + (tp.upPct >= 0.65 ? " — 대부분 올랐어요." : tp.upPct <= 0.35 ? " — 대부분 내렸어요." : " — 반반이에요.") : (t ? hubStrip(t.d) : ""); }
  var N = nums.filter(function (f) { return f.label; });
  if (N.length >= 2) return nbJosa(N[0].label, "은/는") + " " + N[0].value + ", " + nbJosa(N[1].label, "은/는") + " " + N[1].value + "예요.";
  if (N.length === 1) return N[0].label + " " + N[0].value + "예요.";
  if (nums.length) return nums.slice(0, 2).map(function (f) { return f.value; }).join(", ") + ".";
  return t ? hubStrip(t.d) : "";
}
function hubBriefLines(B) { var L = []; if (B.head) L.push("한 줄 결론: " + B.head); if (B.gapLine) L.push("빠진 시각: " + B.gapLine); B.issue.forEach(function (x) { L.push("요즘 기사: " + x.t + " (" + x.press + (x.time ? " " + x.time : "") + ")"); }); if (B.exp) { B.exp.bull.forEach(function (x) { L.push("상승 쪽 의견 기사: " + x.t + " (" + x.press + ")"); }); B.exp.bear.forEach(function (x) { L.push("조심 쪽 의견 기사: " + x.t + " (" + x.press + ")"); }); } L.push("그래서: " + B.so); return L; }
/* 카드: 연구노트 양식 한 장 — 위 검정 '한 줄로', 아래 숫자 / 요즘 이슈 / 전문가는 / 그래서 */
function hubBriefCard(B, title, total) {
  if (!B || (!B.nums.length && !B.issue.length && !B.exp)) return null;
  var c = nbNew(); nbTop(c, 1, ["한 줄로:", "[[" + (B.head || title) + "]]"], 2, total || 2);
  nbBody(c, "읽는 요약 — " + title, "숫자 · 요즘 이슈 · 전문가 의견을 한 장에 · 근거는 다음 장부터");
  var secs = [];
  if (B.nums.length) secs.push({ h: "숫자가 말하는 것", t: B.nums.slice(0, 4).map(function (f) { return f.label + " " + f.value + (f.note ? "(" + f.note + ")" : ""); }).join(" · ") + "." });
  if (B.issueLine) secs.push({ h: "요즘 이슈", t: B.issueLine });
  if (B.expLine) secs.push({ h: "전문가는", t: B.expLine });
  if (B.gapLine) secs.push({ h: "빠진 시각", t: B.gapLine });
  hubSectionsFill(c, secs, ["그래서", B.so]);
  nbFoot(c, "앱 데이터 + 네이버 뉴스 검색(" + (B.srcs.slice(0, 3).join(", ") || "기사 없음") + ") · 투자 권유 아님");
  return c.cv;
}
/* 소제목이 있는 문단들 + 아래 검정 '그래서' 상자 — 남은 높이에 맞춤 */
function hubSectionsFill(c, secs, after) {
  var g = c.g, P = NB.PAD, W = NB.W - P * 2, afterH = after ? 150 : 0, avail = NB.H - 100 - c.y - afterH - 16, fs = 30;
  function need(f) { var n = 0; secs.forEach(function (s) { n += 34 + cWrapCount(g, s.t, W - 56, f, 600) * f * 1.5 + 22; }); return n + 24; }
  while (need(fs) > avail && fs > 19) fs -= 1;
  while (need(fs) < avail * 0.8 && fs < 46) fs += 1; if (need(fs) > avail) fs -= 1;
  var h = Math.max(140, Math.min(avail, need(fs))); cRound(g, P, c.y, W, h, 16, "#ffffff"); g.strokeStyle = NB_C.line; g.lineWidth = 2; g.stroke();
  var y = c.y + 24 + Math.max(0, (h - need(fs)) / 2);
  secs.forEach(function (s) { cText(g, s.h, P + 28, y + 22, 21, 900, NB_C.gold2); y += 34; var n = cWrapCount(g, s.t, W - 56, fs, 600); cWrap(g, s.t, P + 28, y + fs * 0.9, W - 56, fs, 600, NB_C.txt, fs * 1.5, 12); y += n * fs * 1.5 + 22; });
  c.y += h + 16;
  if (after) { var ah = Math.min(afterH - 10, NB.H - 96 - c.y); if (ah > 60) { cRound(g, P, c.y, W, ah, 14, NB_INK); cText(g, after[0], P + 24, c.y + 40, 20, 800, NB_C.gold); var fs2 = 24; while (fs2 > 18 && cWrapCount(g, after[1], W - 48, fs2, 600) * fs2 * 1.35 > ah - 60) fs2 -= 1; cWrap(g, after[1], P + 24, c.y + 76, W - 48, fs2, 600, "#f3efe6", fs2 * 1.35, 3); c.y += ah; } }
}
/* 한 장(종이 양식) 아래 띠: 요즘 이슈 한 줄 + 전문가 한 줄 */
function hubBriefStrip(c, B, y, h) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2; cRound(g, P, y, W, h, 12, TPL_C.black);
  var lines = []; if (B.issue.length) lines.push(["요즘 이슈", B.issue[0].t + " (" + (B.issue[0].press || "기사") + ")"]); if (B.expLine) lines.push(["전문가는", B.expLine.split(" — ")[0] + (B.expLine.indexOf(" — ") > 0 ? " — " + B.expLine.split(" — ")[1].split(". ")[0] : "")]); if (!lines.length) lines.push(["그래서", B.so]);
  var yy = y + 20, lh = (h - 24) / lines.length;
  lines.forEach(function (l) { cText(g, l[0], P + 22, yy + 26, 18, 800, TPL_C.gold); var fs = 22; while (fs > 15 && cWrapCount(g, l[1], W - 170, fs, 600) > (lh > 70 ? 2 : 1)) fs -= 1; cWrap(g, l[1], P + 126, yy + 27, W - 150, fs, 600, "#f3efe6", fs * 1.3, lh > 70 ? 2 : 1); yy += lh; });
}
/* 화면용: 작업대 결과·미리보기 패널 */
function hubBriefHtml(B) {
  if (!B) return '<div class="briefDim">읽는 요약을 만들 데이터가 아직 없어요.</div>';
  function li(x) { return '<li>' + (x.url ? '<a href="' + hubEsc(x.url) + '" target="_blank" rel="noopener">' + hubEsc(x.t) + '</a>' : hubEsc(x.t)) + ' <small>' + hubEsc(x.press) + (x.time ? " · " + hubEsc(x.time) : "") + '</small></li>'; }
  var h = '<div class="wbBrH">읽는 요약 <small>카드·업로드 글에 같이 들어가요 · 숫자(앱) + 기사(네이버 검색' + (B.q ? ': ' + hubEsc(B.q) : '') + ') + 전문가 의견(제목 키워드 분류)</small></div>';
  if (B.nums.length) h += '<div class="wbBrRow"><span>숫자</span><div class="wbNums">' + B.nums.slice(0, 6).map(function (f) { return '<i>' + hubEsc(f.label) + ' <b>' + hubEsc(f.value) + '</b></i>'; }).join("") + '</div></div>';
  if (B.issue.length) h += '<div class="wbBrRow"><span>요즘 이슈</span><ul>' + B.issue.map(li).join("") + '</ul></div>';
  if (B.exp) h += '<div class="wbBrRow"><span>전문가는</span>' + (B.exp ? '<div><b class="pos">▲ 상승 ' + B.exp.bull.length + '</b> · <b class="neg">▼ 조심 ' + B.exp.bear.length + '</b> <small class="briefDim">(기사 ' + B.exp.n + '건)</small><ul>' + B.exp.bull.slice(0, 2).map(li).join("") + B.exp.bear.slice(0, 2).map(li).join("") + '</ul></div>' : '<i class="briefDim">의견 기사 없음</i>') + '</div>';
  if (B.gapLine) h += '<div class="wbBrRow"><span>빠진 시각</span><em>' + hubEsc(B.gapLine) + '</em></div>';
  if (!B.issue.length && !B.exp) h += '<div class="wbBrRow"><span>기사</span><i class="briefDim">관련 기사·의견 기사 없음 — 숫자만으로 만들어요</i></div>';
  return h;
}
/* 오늘 만든 기록 (브라우저) */
function hubDoneLoad() { try { var j = JSON.parse(localStorage.getItem("sm.mkdone") || "null"); var d = typeof pubToday === "function" ? pubToday() : ""; return j && j.d === d ? j.items : []; } catch (e) { return []; } }
function hubDoneAdd(ctx, title) { try { var d = typeof pubToday === "function" ? pubToday() : "", items = hubDoneLoad(); items.push({ ctx: ctx, t: title, at: Date.now() }); localStorage.setItem("sm.mkdone", JSON.stringify({ d: d, items: items.slice(-60) })); if (typeof mkMarkDone === "function") mkMarkDone(ctx); } catch (e) {} }

/* ============================================================ v12.7 반론 검토 — 반대편 기사에서 '우리가 다루지 않은 주제'를 찾는다 ============================================================ */
var HUB_STOP = /^(기사|증권|증권사|증권가|전망|주가|종목|투자|시장|분석|관련|대한|위해|지난|오늘|올해|내년|이번|최근|기대|우려|상향|하향|목표|목표가|목표주가|의견|매수|매도|유지|리스크|중립|조정|경고|둔화|호재|악재|수혜|부담|변수|영향|우위|전환|흐름|추세|반등|회복|압력|불안|긴장|가능성|전문가|애널리스트|보고서|리포트|발표|기업|회사|국내|해외|미국|한국|코스피|코스닥|나스닥|지수|상승|하락|급등|급락|강세|약세|마감|거래|개장|장중|대비|이상|이하|정도|수준|경우|때문|통해|따라|대해|위한|있다|없다|한다|된다|이다|것이|것으로|이라고|라고|했다|한다고|그리고|하지만|그러나|또한|등의|등을|등이|있는|없는|하는|되는|되고|있어|대상|규모|가운데|이날|지난해|전년|분기|실적|매출|영업이익|순이익|주식|증시|시황|외국인|기관|개인|물량|비중|평가|판단|가격|주당|달러|원화|환율|금리|연준|한은|물가|고용|경기|경제|정책|정부|의장|총재|대통령|이후|이전|현재|당시|사실|상황|결과|이유|방향|전체|일부|주요|핵심|중심|최대|최소|최고|최저|평균|기준|전망치|예상치|컨센서스)$/;
var HUB_NOUN = /^(대형주|중형주|소형주|성장주|가치주|배당주|수출주|내수주|경기주|방어주|테마주|우량주|관련주|수혜주|기술주|반도체주|은행주|증권주|보험주|바이오주|자동차주|건설주|조선주|철강주|화학주|정유주|항공주|여행주|게임주|엔터주|미디어주|통신주|유틸리티주|리츠|채권|달러|원화|엔화|유로|위안)$/;
var HUB_JOSA2 = /(에서는|으로는|에게는|까지는|부터는|이라는|이라고|에서|으로|에게|까지|부터|보다|처럼|만큼|이며|이고)$/, HUB_JOSA1 = /[은는이가을를의에로도과와만]$/, HUB_PRED = /(다|려|며|해|돼|했|됐|졌|렸|니|까|네|요|어|아|하고|되고|하며|되며|하면|되면|하는|되는|하여|되어|해서|돼서|면서|하자|하니|하던|하기|되기|하게|되게|할수|될수)$/;
function hubTokens(text) {
  var raw = {}; String(text || "").split(/[^가-힣A-Za-z0-9]+/).forEach(function (w) { if (!w) return; if (/^[가-힣]+$/.test(w)) { if (w.length >= 4) w = w.replace(HUB_JOSA2, ""); raw[w] = (raw[w] || 0) + 1; } else if (/^[A-Z][A-Za-z0-9]+$/.test(w)) raw[w] = (raw[w] || 0) + 1; });
  var out = {};
  Object.keys(raw).forEach(function (w) {
    var t = w;
    if (/^[가-힣]+$/.test(t)) {
      if (t.length >= 3 && HUB_JOSA1.test(t)) { var stem = t.slice(0, -1); if (raw[stem] || HUB_STOP.test(stem) || HUB_NOUN.test(stem) || t.length >= 5 || /[은는을를]$/.test(t) || (/로$/.test(t) && /(확대|축소|증가|감소|상승|하락|개선|악화|둔화|회복)$/.test(stem))) t = stem; }   // '목표주가'는 그대로, '반도체가'는 '반도체'가 따로 있을 때만 줄임
      if (t.length < 2 || t.length > 8 || HUB_STOP.test(t) || (t.length >= 3 && HUB_PRED.test(t))) return;   // 서술어(…다/…려/…했) 제외
    }
    out[t] = (out[t] || 0) + raw[w];
  });
  return out;
}
/* theirs: [{t, desc}] 반대편 기사 · ours: 우리 글 전체 → 우리 글에 없는 주제어 (많이 나온 순) */
function hubGap(theirs, ours, n) {
  var cnt = {}, oursN = String(ours || "").replace(/\s+/g, ""), doc = {};
  theirs.forEach(function (x, i) { var T = hubTokens(x.t + " " + (x.desc || "").slice(0, 200)); Object.keys(T).forEach(function (k) { cnt[k] = (cnt[k] || 0) + T[k]; (doc[k] = doc[k] || {})[i] = 1; }); });
  return Object.keys(cnt).filter(function (k) { return oursN.indexOf(k) < 0; }).sort(function (a, b) { return Object.keys(doc[b]).length - Object.keys(doc[a]).length || cnt[b] - cnt[a] || b.length - a.length; }).slice(0, n || 6).map(function (k) { return { w: k, n: Object.keys(doc[k]).length }; });
}
/* 반론 묶음: 우리 결론(stance: "up"|"down"|"flat")과 반대인 기사 + 빠진 주제 + 보완 문장 */
function hubCounter(stance, exp, oursText) {
  if (!exp) return null;
  var opp = stance === "up" ? exp.bear : stance === "down" ? exp.bull : exp.bear.concat(exp.bull), same = stance === "up" ? exp.bull : stance === "down" ? exp.bear : [];
  if (!opp.length) return { n: 0, items: [], gap: [], txt: "반대편 근거 기사를 찾지 못했어요 — 반론이 없다는 뜻이 아니라, 아직 기사로 나오지 않았거나 검색어에 안 잡힌 것일 수 있어요.", fix: "" };
  var gap = hubGap(opp, oursText, 6), covered = opp.length - opp.filter(function (x) { return hubGap([x], oursText, 1).length; }).length;
  var txt = "우리 결론과 반대쪽 근거 " + opp.length + "건" + (same.length ? " (같은 쪽 " + same.length + "건)" : "") + ". " + (gap.length ? "그중 우리 글이 다루지 않은 주제: " + gap.map(function (g) { return "'" + g.w + "'" + (g.n > 1 ? "(" + g.n + "건)" : ""); }).join(", ") + "." : "반대편 근거의 주제는 우리 글에도 들어 있어요 — 해석의 차이예요.");
  var fix = gap.length >= 2 ? "보완: 결론을 한 단계 보수적으로 보고(" + (stance === "up" ? "검토 → 나눠서·작게" : stance === "down" ? "관망 → 조건부 관심" : "양쪽 모두 열어 두기") + "), " + gap.slice(0, 3).map(function (g) { return g.w; }).join("·") + "에 대한 숫자를 먼저 확인한 뒤 판단을 확정하세요." : gap.length === 1 ? "보완: '" + gap[0].w + "' 한 가지만 확인하면 결론을 유지해도 돼요." : "보완: 반대편 주장을 숫자로 반박할 수 있는지(우리 Exhibit과 대조) 한 번만 더 보세요.";
  return { n: opp.length, items: opp.slice(0, 5), gap: gap, txt: txt, fix: fix, covered: covered };
}
