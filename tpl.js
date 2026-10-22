/* ============================================================
   uphill.lab 양식집 (v10.2) — 카테고리별 '정해진 틀 + 바뀌는 내용'
   v10.3 uphill.lab 고유 표시: 위 검정 띠(↗ 금색 마크 + 우상향연구소 · UPHILL.LAB + 금색 테 카테고리) · 아이보리 종이 ·
   제목 아래 '우상향 선'(금색 가는 선이 오른쪽 끝에서 계단처럼 올라가는 화살표) · 아래 검정 띠(↗ @uphill.lab) · 강조는 금색 계열
   틀(9종): market 마감 브리핑 · rank 순위 12칸 · table 표 · compare 그때·지금 · quote 발언/기사 · timeline 날짜별 정리 ·
            grid 숫자 12칸 · lines 한 줄 상식 · calendar 달력
   모든 틀은 같은 '명세(spec)' 모양을 받는다 → 앱 데이터(tplSpec)로도, AI 기획(tplFromPlan)으로도 같은 틀에 내용만 바뀐다.
   ============================================================ */
var TPL = { W: 1080, H: 1350, P: 40, TOP: 300, BAND: 72, FOOT: 60 };
var TPL_C = { paper: "#fbf8f1", ink: "#14161c", ink2: "#33363d", sub: "#7a7468", line: "#14161c", soft: "#e8e1d0", box: "#f3eee2", navy: "#14161c", black: "#14161c", gold: "#e6c57a", gold2: "#b8913f", goldHi: "#f1d48a", red: "#d9342b", blue: "#2f6fd6", green: "#2e7d4f", shade: "#cfc6b0", hl: "#f5e6b8", hlRed: "#fde2e1" };
var TPL_CAT = {
  market: { icon: "📈", name: "마감 브리핑", desc: "지수 2개 + 주인공 3종목 + 8종목 등락", use: "매일 국내·미국·코인 마감" },
  rank: { icon: "🏆", name: "순위", desc: "12칸 순위표 (이름 + 숫자)", use: "1개월 수익률·거래대금·시총" },
  table: { icon: "📋", name: "표", desc: "머리줄 + 줄무늬 행 (최대 9행 × 5열)", use: "선별 종목 판정표·업종 성적표·조건부 승률" },
  compare: { icon: "⏳", name: "그때·지금", desc: "4줄 · 왼쪽 그때 / 오른쪽 지금 + 변화율", use: "1년 전 vs 지금·고점 vs 지금" },
  quote: { icon: "💬", name: "발언·기사", desc: "큰 따옴표 제목 + 왼쪽 인물·출처 칸 + 오른쪽 요지 3문단", use: "오늘 가장 관심 가는 기사·발언" },
  timeline: { icon: "📅", name: "날짜별 정리", desc: "왼쪽 날짜 블록 + 오른쪽 번호 목록(형광펜)", use: "정책 총정리·이번 주 일정·대책 변천" },
  grid: { icon: "🔢", name: "숫자 12칸", desc: "검정 칸 12개 (이름 + 큰 숫자 + 단위)", use: "시장 숫자 한눈에·세금·한도" },
  lines: { icon: "💡", name: "한 줄 상식", desc: "왼쪽 → 오른쪽 7줄 + 노란 펀치라인 + 맺음말", use: "용어·세금·투자 격언" },
  calendar: { icon: "🗓️", name: "달력", desc: "한 달 달력 + 날짜 칸 메모", use: "이번 달 일정·발표일·휴장" }
};
/* uphill.lab 마크: 금색 둥근 네모 안 ↗ */
function tplLogo(g, x, y, sz) {
  cRound(g, x, y, sz, sz, sz * 0.22, TPL_C.gold);
  g.strokeStyle = TPL_C.black; g.lineWidth = sz * 0.11; g.lineCap = "round"; g.lineJoin = "round";
  var a = sz * 0.28, b = sz * 0.72; g.beginPath(); g.moveTo(x + a, y + b); g.lineTo(x + b, y + a); g.moveTo(x + sz * 0.44, y + a); g.lineTo(x + b, y + a); g.lineTo(x + b, y + sz * 0.56); g.stroke();
}
/* 우상향 선: 가는 금색 선이 오른쪽 끝에서 계단처럼 올라가며 화살표로 끝난다 (모든 양식 제목 아래 공통) */
function tplUphill(g, x, y, w) {
  g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
  var e = x + w, pts = [[x, y], [e - 150, y], [e - 118, y - 10], [e - 96, y - 4], [e - 62, y - 22], [e - 44, y - 16], [e - 6, y - 40]];
  g.strokeStyle = TPL_C.gold2; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
  g.beginPath(); g.moveTo(e - 22, y - 40); g.lineTo(e - 6, y - 40); g.lineTo(e - 8, y - 24); g.stroke();
}
function tplNew(meta) {
  var cv = document.createElement("canvas"); cv.width = TPL.W; cv.height = TPL.H; var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  var P = TPL.P, W = TPL.W - P * 2, B = TPL.BAND;
  g.fillStyle = TPL_C.paper; g.fillRect(0, 0, TPL.W, TPL.H);
  // 위 검정 띠: 마크 + 우상향연구소 · UPHILL.LAB / 오른쪽 금색 테 카테고리
  g.fillStyle = TPL_C.black; g.fillRect(0, 0, TPL.W, B); g.fillStyle = TPL_C.gold2; g.fillRect(0, B, TPL.W, 3);
  tplLogo(g, P, (B - 40) / 2, 40);
  cText(g, "우상향연구소", P + 54, B / 2 + 9, 26, 900, "#ffffff");
  g.save(); if ("letterSpacing" in g) g.letterSpacing = "3px"; cText(g, "UPHILL.LAB", P + 54 + cW(g, "우상향연구소", 26, 900) + 14, B / 2 + 7, 15, 800, TPL_C.gold); g.restore();
  var cat = TPL_CAT[meta.cat] || { icon: "📌", name: meta.cat || "" }, catTxt = cat.icon + " " + (meta.catName || cat.name), cw = cW(g, catTxt, 20, 800) + 36;
  cRound(g, TPL.W - P - cw, (B - 40) / 2, cw, 40, 20, null, null); g.strokeStyle = TPL_C.gold; g.lineWidth = 2; g.stroke();
  cText(g, catTxt, TPL.W - P - cw / 2, B / 2 + 7, 20, 800, TPL_C.gold, "center");
  // 출처 · 기준
  var sy = B + 34;
  if (meta.source) { cText(g, cFit(g, "출처  " + meta.source, W, 18, 600), P, sy, 18, 600, TPL_C.sub); sy += 24; }
  if (meta.source2) { cText(g, cFit(g, "· " + meta.source2, W, 18, 600), P, sy, 18, 600, TPL_C.sub); sy += 24; }
  // 제목 (아주 굵게) + 우상향 선
  var ic = typeof TPL_ICON !== "undefined" && TPL_ICON[meta.cat], TW = ic ? W - 118 : W;   // v10.7 보관함의 양식 기본 아이콘 (제목 오른쪽)
  var lines = String(meta.title || "").split("\n").filter(Boolean).slice(0, 2);
  if (lines.length === 1 && cW(g, cPlain(lines[0]), 64, 900) > TW) { var t0 = lines[0], sp = t0.indexOf(" ", Math.floor(t0.length / 2) - 2), cut = sp > 0 && sp < t0.length - 3 ? sp : Math.ceil(t0.length / 2); lines = [t0.slice(0, cut).trim(), t0.slice(cut).trim()]; }
  var size = lines.length > 1 ? 80 : 96;
  lines.forEach(function (l) { while (size > 54 && cW(g, cPlain(l), size, 900) > TW) size -= 4; });
  var ty = sy + 8 + size * 0.86;
  if (ic) { var isz = 100, ix = TPL.W - P - isz, iy = sy + 2; g.save(); cRound(g, ix, iy, isz, isz, 22, null); g.clip(); g.drawImage(ic, ix, iy, isz, isz); g.restore(); cRound(g, ix, iy, isz, isz, 22, null); g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.stroke(); }
  lines.forEach(function (l, i) { cRich(g, l, P, ty + i * size * 1.1, size, 900, TPL_C.ink, TPL_C.gold2); });
  if (meta.flag && typeof cFlag === "function") { var fh = Math.round(size * 0.62), fx = P + cW(g, cPlain(lines[0] || ""), size, 900) + 22; if (fx + fh * 1.9 < TPL.W - P - (ic ? 118 : 0)) cFlag(g, fx, ty - size * 0.72, fh, meta.flag); }   // v12.25 제목 옆 국기
  var y = ty + (lines.length - 1) * size * 1.1 + 30;
  if (cW(g, cPlain(lines[lines.length - 1] || ""), size, 900) > W - 170) y += 30;   // 제목 끝이 화살표와 겹치지 않게
  tplUphill(g, P, y, W); y += 14;
  if (meta.sub) { cText(g, cFit(g, meta.sub, W, 24, 700), P, y + 26, 24, 700, TPL_C.ink2); y += 44; }
  return { cv: cv, g: g, y: y + 20, meta: meta };
}
function tplFoot(c, note) {
  var g = c.g, P = TPL.P, F = TPL.FOOT, y0 = TPL.H - F;
  g.fillStyle = TPL_C.black; g.fillRect(0, y0, TPL.W, F); g.fillStyle = TPL_C.gold2; g.fillRect(0, y0, TPL.W, 3);
  var brand = "@uphill.lab", bw = cW(g, brand, 22, 900);
  cText(g, cFit(g, note || c.meta.note || "StockMind 자동 집계 · 투자 판단과 책임은 본인에게", TPL.W - P * 2 - bw - 70, 17, 600), P, y0 + F / 2 + 8, 17, 600, "#a9a291");
  tplLogo(g, TPL.W - P - bw - 38, y0 + F / 2 - 14, 28);
  cText(g, brand, TPL.W - P, y0 + F / 2 + 9, 22, 900, TPL_C.gold, "right");
  return c.cv;
}
function tplN(a, b) { return TPL.H > 1500 ? b : a; }   // v12.23 릴스형이면 더 많은 항목(내용 추가 우선)
function tplK() { return TPL.H / 1350; }   // v12.22 릴스형(1920)이면 1.42 — 고정 높이 칸을 이 배율로 늘린다
function tplBox(g, x, y, w, h, r, fill, lw, stroke) { cRound(g, x, y, w, h, r, fill || "#ffffff"); g.strokeStyle = stroke || TPL_C.ink; g.lineWidth = lw || 3; g.stroke(); }
function tplCol(v) { return /^[-▼]/.test(String(v)) ? TPL_C.blue : /^[+▲]/.test(String(v)) ? TPL_C.red : TPL_C.ink; }
function tplBand(g, x, y, w, h, text, size, bg, color) { cRound(g, x, y, w, h, 8, bg || TPL_C.black); cText(g, cFit(g, text, w - 24, size || 26, 900), x + w / 2, y + h / 2 + (size || 26) * 0.36, size || 26, 900, color || "#ffffff", "center"); }

/* ---------- ① 마감 브리핑 v12.19 (우상향연구소 고유 배치): 지수 2줄(이름 · 큰 값 · 등락 알약) → 주요 움직임 3개는 가로 막대 순위 → 관심 8개는 2×4 타일 → 결론 띠
   {indexes:[{name,val,chg,pct}] ×2, features:[{name,pct,sub}] ×3, chips:[{name,pct}] ≤8, foot} ---------- */
function tplMarket(c, s) {
  if (s.caps && s.etfs) return tplMarket2(c, s);   // v12.25 국내·미국: 지수 → (왼쪽 급등락 | 오른쪽 인기 ETF) → 시총 상위 8
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y;
  var pv = function (t) { var m = String(t || "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) * (/^[-▼]/.test(String(t)) ? -1 : 1) : 0; };
  // ① 지수 2줄
  var nIx = Math.min(2, (s.indexes || []).length), nFt = Math.min(tplN(3, 5), (s.features || []).length), nCh = Math.min(tplN(8, 12), (s.chips || []).length);
  var used = nIx * 104 + 24 + 40 + nFt * 96 + 26 + 40 + Math.ceil(nCh / 4) * 100 + 10 + (s.foot ? 90 : 0), room = TPL.H - TPL.FOOT - 20 - y;
  var K = Math.max(1, Math.min(1.6, room / Math.max(1, used))), ix = (s.indexes || []).slice(0, 2), rh = Math.round(104 * K);
  ix.forEach(function (it, i) {
    var yy = y + i * rh + (rh - 104) / 2, col = tplCol(it.pct);
    cText(g, it.name, P, yy + 62, 34, 900, TPL_C.ink);
    var pct = String(it.pct || ""), pw = cW(g, pct, 26, 900) + 28; cRound(g, P + W - pw, yy + 22, pw, 44, 10, col); cText(g, pct, P + W - pw / 2, yy + 54, 26, 900, "#ffffff", "center");
    var vs = 60; while (vs > 36 && cW(g, it.val, vs, 900) > W - pw - 24 - cW(g, it.name, 34, 900) - 40) vs -= 4;
    cText(g, it.val, P + W - pw - 24, yy + 66, vs, 900, TPL_C.ink, "right");
    if (it.chg) cText(g, "전일 대비 " + it.chg, P + W - pw - 24, yy + 92, 18, 600, TPL_C.sub, "right");
    g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + (i + 1) * rh); g.lineTo(P + W, y + (i + 1) * rh); g.stroke();
  });
  y += ix.length * rh + Math.round(24 * K);
  // ② 주요 움직임 3개 — 가로 막대 (길이 = |등락|, 색 = 방향)
  var ft = (s.features || []).slice(0, tplN(3, 5)), mx = Math.max.apply(null, ft.map(function (f) { return Math.abs(pv(f.pct)); }).concat([0.01]));
  cText(g, "오늘 가장 크게 움직인 종목", P, y + 24, 22, 800, TPL_C.sub); y += 40;
  var fh = Math.round(96 * K), lw = 260, bwMax = W - lw - 170;
  ft.forEach(function (f, i) {
    var yy = y + i * fh + (fh - 96) / 2, col = tplCol(f.pct), w = Math.max(16, Math.abs(pv(f.pct)) / mx * bwMax);
    cText(g, cFit(g, f.name, lw - 20, 34, 900), P, yy + 50, 34, 900, TPL_C.ink); if (f.sub) cText(g, cFit(g, f.sub, lw - 20, 18, 600), P, yy + 76, 18, 600, TPL_C.sub);
    cRound(g, P + lw, yy + 24, w, 44, 8, col); cText(g, f.pct, P + lw + w + 14, yy + 58, 40, 900, col);
    g.strokeStyle = TPL_C.soft; g.lineWidth = 1.5; g.beginPath(); g.moveTo(P, y + (i + 1) * fh); g.lineTo(P + W, y + (i + 1) * fh); g.stroke();
  });
  y += ft.length * fh + Math.round(26 * K);
  // ③ 관심 8개 — 2×4 타일 (이름 왼쪽 · 등락 오른쪽)
  var ch = (s.chips || []).slice(0, tplN(8, 12)), cols = 4, gap = 12, tw = (W - gap * (cols - 1)) / cols, th = Math.round(88 * K);
  cText(g, "그 밖의 관심 종목", P, y + 24, 22, 800, TPL_C.sub); y += 40;
  ch.forEach(function (k, i) {
    var x = P + (i % cols) * (tw + gap), yy = y + Math.floor(i / cols) * (th + gap), col = tplCol(k.pct);
    cRound(g, x, yy, tw, th, 12, TPL_C.box); g.fillStyle = col; g.fillRect(x, yy + 14, 6, th - 28);
    var kf = th > 110 ? 1.25 : 1; cText(g, cFit(g, k.name, tw - 30, 22 * kf, 800), x + 18, yy + th / 2 - 8, 22 * kf, 800, TPL_C.ink); cText(g, k.pct, x + 18, yy + th / 2 + 30 * kf, 28 * kf, 900, col);
  });
  y += Math.ceil(ch.length / cols) * (th + gap) + 10;
  if (s.foot) tplBand(g, P, Math.min(y + 10, TPL.H - 164), W, 70, s.foot, 28);
  return tplFoot(c);
}
/* v12.25 마감 브리핑(국내·미국): 위 지수 2줄 · 가운데 왼쪽 '가장 크게 움직인 종목' 막대 + 오른쪽 '인기 ETF' · 아래 시총 상위 8(약자 배지 + 이름 + 등락) · 결론 띠 */
function tplMarket2(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y;
  var pv = function (t) { var m = String(t || "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) * (/^[-▼]/.test(String(t)) ? -1 : 1) : 0; };
  var ix = (s.indexes || []).slice(0, 2), ft = (s.features || []).slice(0, tplN(4, 6)), et = (s.etfs || []).slice(0, tplN(5, 6)), cp = (s.caps || []).slice(0, 8);
  // 세로 배분: 필요한 높이를 먼저 재고 남는 세로는 칸에 고르게(내용 우선)
  var nMid = Math.max(ft.length, et.length), base = ix.length * 96 + 20 + 36 + nMid * 64 + 24 + 36 + 2 * 118 + 12 + (s.foot ? 84 : 0), room = TPL.H - TPL.FOOT - 16 - y, K = Math.max(1, Math.min(1.5, room / base));
  // ① 지수
  var rh = Math.round(96 * K);
  ix.forEach(function (it, i) {
    var yy = y + i * rh + (rh - 96) / 2, col = tplCol(it.pct);
    cText(g, it.name, P, yy + 58, 34, 900, TPL_C.ink);
    var pct = String(it.pct || ""), pw = cW(g, pct, 26, 900) + 28; cRound(g, P + W - pw, yy + 22, pw, 44, 10, col); cText(g, pct, P + W - pw / 2, yy + 54, 26, 900, "#ffffff", "center");
    var vs = 58; while (vs > 34 && cW(g, it.val, vs, 900) > W - pw - 24 - cW(g, it.name, 34, 900) - 40) vs -= 4;
    cText(g, it.val, P + W - pw - 24, yy + 62, vs, 900, TPL_C.ink, "right");
    if (it.chg) cText(g, "전일 대비 " + it.chg, P + W - pw - 24, yy + 88, 17, 600, TPL_C.sub, "right");
    g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y + (i + 1) * rh); g.lineTo(P + W, y + (i + 1) * rh); g.stroke();
  });
  y += ix.length * rh + Math.round(20 * K);
  // ② 가운데: 왼쪽 급등락 막대 · 오른쪽 인기 ETF
  var gapC = 24, cw = (W - gapC) / 2, mh = Math.round(64 * K), lx = P, rx = P + cw + gapC;
  cText(g, "가장 크게 움직인 종목", lx, y + 24, 21, 800, TPL_C.sub); cText(g, "인기 ETF", rx, y + 24, 21, 800, TPL_C.sub); y += 36;
  g.fillStyle = TPL_C.soft; g.fillRect(P + cw + gapC / 2 - 1, y - 6, 2, nMid * mh);
  var mx = Math.max.apply(null, ft.map(function (f) { return Math.abs(pv(f.pct)); }).concat([0.01]));
  ft.forEach(function (f, i) {
    var yy = y + i * mh, mid = yy + mh / 2, col = tplCol(f.pct), nmW = 150, vW = cW(g, f.pct, 26, 900) + 10, bw = Math.max(10, Math.abs(pv(f.pct)) / mx * (cw - nmW - vW - 16));
    cText(g, cFit(g, f.name, nmW - 10, 22, 800), lx, mid + 8, 22, 800, TPL_C.ink);
    cRound(g, lx + nmW, mid - 13, bw, 26, 6, col); cText(g, f.pct, lx + nmW + bw + 8, mid + 9, 26, 900, col);
  });
  et.forEach(function (e, i) {
    var yy = y + i * mh, mid = yy + mh / 2, col = tplCol(e.pct);
    cRound(g, rx, yy + 6, cw, mh - 12, 10, i % 2 ? "#ffffff" : TPL_C.box); g.fillStyle = col; g.fillRect(rx, yy + 14, 5, mh - 28);
    cText(g, cFit(g, e.name, cw - 150, 22, 800), rx + 18, mid + 8, 22, 800, TPL_C.ink); cText(g, e.pct, rx + cw - 14, mid + 10, 28, 900, col, "right");
  });
  y += nMid * mh + Math.round(24 * K);
  // ③ 시총 상위 8 — 4 × 2 타일
  cText(g, "시가총액 상위 8", P, y + 24, 21, 800, TPL_C.sub); cText(g, "로고는 각 사의 상표", P + W, y + 24, 15, 600, TPL_C.sub, "right"); y += 36;
  var cols = 4, tg = 12, tw = (W - tg * (cols - 1)) / cols, th = Math.round(118 * K) - tg;
  cp.forEach(function (k, i) {
    var x = P + (i % cols) * (tw + tg), yy = y + Math.floor(i / cols) * (th + tg), col = tplCol(k.pct), bz = Math.min(60, th * 0.5);
    cRound(g, x, yy, tw, th, 12, "#ffffff"); g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.stroke();
    if (typeof cMono === "function") cMono(g, x + 12, yy + 12, bz, k.sym, k.name);
    cText(g, cFit(g, k.name, tw - bz - 34, 20, 800), x + bz + 22, yy + 12 + bz / 2 + 7, 20, 800, TPL_C.ink);
    var ps = 32; while (ps > 20 && cW(g, k.pct, ps, 900) > tw - 24) ps -= 2; cText(g, k.pct, x + tw - 12, yy + th - 14, ps, 900, col, "right");
  });
  y += Math.ceil(cp.length / cols) * (th + tg);
  if (s.foot) tplBand(g, P, Math.min(y + 10, TPL.H - TPL.FOOT - 84), W, 70, s.foot, 28);
  return tplFoot(c);
}
/* ---------- ② 순위 12칸: {items:[{rank,tag,name,value,sub}]} ---------- */
function tplRank(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, items = (s.items || []).slice(0, tplN(12, 16)), n = items.length;
  var cols = n <= 3 ? 1 : n <= 4 ? 2 : (n % 3 === 0 && n <= 9) ? 3 : n <= 8 ? 2 : 4, rows = Math.ceil(n / cols), gap = 14, bw = (W - gap * (cols - 1)) / cols, bh = (TPL.H - 74 - y - gap * (rows - 1)) / rows;   // v12.22 3개 이하는 가로로 긴 칸, 높이는 남은 만큼(빈 칸 없이)
  if (cols === 1) {   // v12.22 3개 이하: 가로 한 줄 — 왼쪽 큰 순위 · 가운데 이름(+부가) · 오른쪽 큰 값
    var y0 = y + Math.max(0, ((TPL.H - 74 - y) - (bh * n + gap * (n - 1))) / 2);
    items.forEach(function (it, i) {
      var yy = y0 + i * (bh + gap), rk = it.rank || i + 1, top3 = rk <= 3; tplBox(g, P, yy, W, bh, 14, "#ffffff", top3 ? 5 : 3, top3 ? TPL_C.gold2 : TPL_C.ink);
      var rs = Math.min(120, bh * 0.55); cText(g, String(rk), P + 40, yy + bh / 2 + rs * 0.36, rs, 900, TPL_C.gold2); var nx = P + 40 + cW(g, String(rk), rs, 900) + 36;
      var vs = Math.min(76, bh * 0.36); while (vs > 30 && cW(g, it.value, vs, 900) > W * 0.4) vs -= 2; var vw = cW(g, it.value, vs, 900) + 40; cRound(g, P + W - vw - 24, yy + bh / 2 - vs * 0.75, vw, vs * 1.5, 12, TPL_C.black); cText(g, it.value, P + W - 24 - vw / 2, yy + bh / 2 + vs * 0.36, vs, 900, "#ffffff", "center");
      var mw = P + W - vw - 48 - nx, ns = Math.min(64, bh * 0.3); while (ns > 24 && cW(g, it.name, ns, 900) > mw) ns -= 2;
      cText(g, it.name, nx, yy + bh / 2 + (it.sub || it.tag ? -4 : ns * 0.36), ns, 900, TPL_C.ink); if (it.sub || it.tag) cText(g, cFit(g, [it.tag, it.sub].filter(Boolean).join(" · "), mw, 24, 600), nx, yy + bh / 2 + 36, 24, 600, TPL_C.sub);
    });
    return tplFoot(c);
  }
  items.forEach(function (it, i) {
    var x = P + (i % cols) * (bw + gap), yy = y + Math.floor(i / cols) * (bh + gap);
    var top3 = (it.rank || i + 1) <= 3; tplBox(g, x, yy, bw, bh, 10, "#ffffff", top3 ? 5 : 3, top3 ? TPL_C.gold2 : TPL_C.ink);
    cText(g, (it.rank || i + 1) + "위", x + 16, yy + 44, 34, 900, top3 ? TPL_C.gold2 : TPL_C.ink);
    if (it.tag) cText(g, it.tag, x + bw - 16, yy + 42, 26, 800, TPL_C.sub, "right");
    var ns = bw > 300 ? 44 : 36; while (ns > 22 && cW(g, it.name, ns, 900) > bw - 32) ns -= 2;
    cText(g, it.name, x + bw / 2, yy + bh / 2 + 8, ns, 900, TPL_C.ink, "center");
    if (it.sub) cText(g, cFit(g, it.sub, bw - 24, 20, 600), x + bw / 2, yy + bh / 2 + 42, 20, 600, TPL_C.sub, "center");
    var vh = 58; cRound(g, x + 3, yy + bh - vh - 3, bw - 6, vh, 6, TPL_C.black);
    var vs = 34; while (vs > 20 && cW(g, it.value, vs, 900) > bw - 24) vs -= 2;
    cText(g, it.value, x + bw / 2, yy + bh - vh / 2 + 10, vs, 900, "#ffffff", "center");
  });
  return tplFoot(c);
}
/* ---------- ③ 표: {cols:[..], rows:[[..]], badges:[문자열] (왼쪽 세로 파란 칸·선택), hlCols:[열 index] } ---------- */
function tplTable(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, cols = s.cols || [], rows = (s.rows || []).slice(0, tplN(10, 14)), n = cols.length;
  var bx = s.badges && s.badges.length ? 120 : 0, tw = W - bx, ws = s.widths || cols.map(function (_, i) { return i === 0 ? 0.34 : 0.66 / Math.max(1, n - 1); }), hh = 60, rh = Math.min((rows.length <= 3 ? 240 : 170) * (rows.length < tplN(10, 14) ? tplK() : 1), (TPL.H - 84 - y - hh - (s.note ? 50 : 0)) / Math.max(1, rows.length));   // v11.6 행이 적으면 키워서 빈 곳 없이
  var xs = [P + bx]; ws.forEach(function (w) { xs.push(xs[xs.length - 1] + w * tw); });
  cRound(g, P + bx, y, tw, hh, 0, TPL_C.black);
  cols.forEach(function (h, i) { cText(g, cFit(g, h, xs[i + 1] - xs[i] - 12, 28, 900), (xs[i] + xs[i + 1]) / 2, y + hh / 2 + 10, 28, 900, TPL_C.gold, "center"); });
  rows.forEach(function (r, k) {
    var yy = y + hh + k * rh; g.fillStyle = k % 2 ? "#ffffff" : TPL_C.box; g.fillRect(P + bx, yy, tw, rh);
    r.forEach(function (v, i) {
      var hl = (s.hlCols || []).indexOf(i) >= 0, cx = (xs[i] + xs[i + 1]) / 2, mw = xs[i + 1] - xs[i] - 14, fsB = Math.max(30, Math.min(42, Math.round(rh * 0.3))), fs = i === 0 ? fsB - 3 : fsB;
      var wt = i === 0 ? 800 : 900, col = i === 0 ? TPL_C.ink : tplCol(v);
      if (hl) { var hs = fs; while (hs > fs * 0.6 && cW(g, v, hs, 900) > mw) hs -= 1; var tw2 = Math.min(mw + 8, cW(g, v, hs, 900) + 16); cRound(g, cx - tw2 / 2, yy + rh / 2 - hs * 0.62, tw2, hs * 1.25, 4, TPL_C.hl); }
      var one = fs; while (one > fs * 0.6 && cW(g, String(v), one, wt) > mw) one -= 1;   // v12.20 한 줄에 들어가도록 먼저 줄이고(최소 60%), 그래도 안 되면 두 줄
      if (cW(g, String(v), one, wt) > mw && rh >= 64) { var ws = Math.min(fs - 4, (rh - 14) / 2 / 1.2), nl = Math.min(2, cWrapCount(g, String(v), mw, ws, 700)); cWrap(g, String(v), cx, yy + rh / 2 - (nl - 1) * ws * 0.6 + ws * 0.36, mw, ws, 700, col, ws * 1.2, 2, "center"); }
      else cText(g, cFit(g, String(v), mw, one, wt), cx, yy + rh / 2 + one * 0.36, one, wt, col, "center");
    });
    g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.beginPath(); g.moveTo(P + bx, yy + rh); g.lineTo(P + W, yy + rh); g.stroke();
  });
  if (bx) { var bh = (hh + rows.length * rh) / s.badges.length; s.badges.forEach(function (b, i) { var yy = y + i * bh; cRound(g, P, yy + 4, bx - 10, bh - 8, 8, i % 2 ? TPL_C.ink2 : TPL_C.black); cWrap(g, b, P + (bx - 10) / 2, yy + bh / 2 - (cWrapCount(g, b, bx - 30, 22, 900) - 1) * 13 + 8, bx - 30, 22, 900, "#ffffff", 27, 3, "center"); }); }
  g.strokeStyle = TPL_C.ink; g.lineWidth = 3; g.strokeRect(P + bx, y, tw, hh + rows.length * rh);
  if (s.note) cText(g, cFit(g, s.note, W, 22, 700), P, y + hh + rows.length * rh + 40, 22, 700, TPL_C.ink2);
  return tplFoot(c);
}
/* ---------- ④ 그때·지금 v12.19 (고유 배치): 행마다 '기울기 선' — 왼쪽 점(그때 값) → 오른쪽 점(지금 값), 오르면 선이 올라가고 내리면 내려간다. 변화율은 선 위 알약
   {aLabel,bLabel,aSub,bSub, rows:[{badge,name,sub,a,aDate,b,bDate,pct}] ≤4} ---------- */
function tplCompare(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, rows = (s.rows || []).slice(0, tplN(4, 6));
  var lw = 290, x1 = P + lw + 40, x2 = P + W - 40;
  // 머리: 그때 · 지금 (선 양 끝 위)
  cText(g, s.aLabel || "그때", x1, y + 36, 30, 900, TPL_C.sub, "center"); cText(g, s.bLabel || "지금", x2, y + 36, 30, 900, TPL_C.gold2, "center");
  if (s.aSub) cText(g, s.aSub, x1, y + 62, 18, 600, TPL_C.sub, "center"); if (s.bSub) cText(g, s.bSub, x2, y + 62, 18, 600, TPL_C.sub, "center");
  y += 84; var rh = Math.min(290 * (rows.length < tplN(4, 6) ? tplK() : 1), (TPL.H - 84 - y) / Math.max(1, rows.length));
  rows.forEach(function (r, i) {
    var yy = y + i * rh, up = !/^-/.test(String(r.pct || "")), col = r.pct ? (up ? TPL_C.red : TPL_C.blue) : TPL_C.ink;
    if (i % 2 === 0) { g.fillStyle = "rgba(20,22,28,0.035)"; g.fillRect(P - 10, yy, W + 20, rh); }
    // 왼쪽: 이름 · 부제 · 배지
    var ny = yy + rh / 2; cText(g, cFit(g, r.name, lw - 20, 34, 900), P, ny - 4, 34, 900, TPL_C.ink); if (r.sub) cText(g, cFit(g, r.sub, lw - 20, 20, 600), P, ny + 26, 20, 600, TPL_C.sub);
    if (r.badge) { var bw = cW(g, r.badge, 20, 900) + 24; cRound(g, P, ny - 70, Math.min(lw - 20, bw), 34, 8, TPL_C.ink); cText(g, cFit(g, r.badge, lw - 44, 20, 900), P + Math.min(lw - 20, bw) / 2, ny - 46, 20, 900, TPL_C.gold, "center"); }
    // 기울기 선: 그때(왼쪽) → 지금(오른쪽). 오르면 오른쪽이 위
    var amp = Math.min(rh * 0.28, 70), ya = ny + (up ? amp : -amp) * 0.5, yb = ny - (up ? amp : -amp) * 0.5; if (!r.pct) { ya = yb = ny; }
    g.strokeStyle = col; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(x1, ya); g.lineTo(x2, yb); g.stroke();
    g.fillStyle = TPL_C.paper; [[x1, ya], [x2, yb]].forEach(function (pt) { g.beginPath(); g.arc(pt[0], pt[1], 13, 0, Math.PI * 2); g.fill(); g.strokeStyle = col; g.lineWidth = 6; g.stroke(); });
    var vs = 40; while (vs > 24 && (cW(g, r.a, vs, 900) > (x2 - x1) / 2 - 40 || cW(g, r.b, vs, 900) > (x2 - x1) / 2 - 40)) vs -= 2;
    // 값은 각 점의 바깥쪽(위 또는 아래)에 — 선과 겹치지 않게
    // 그때 값은 점 왼쪽 정렬, 지금 값은 오른쪽 끝에 맞춰(잘림 방지) 더 크게 — '지금'이 핵심
    var vb = Math.min(vs + 10, 52); while (vb > 28 && cW(g, r.b, vb, 900) > W - lw - 60) vb -= 2;
    cText(g, r.a, x1 - 14, up ? ya + vs + 22 : ya - 26, vs, 900, TPL_C.ink, "left"); cText(g, r.b, P + W, up ? yb - 26 : yb + vb + 22, vb, 900, col, "right");
    if (r.aDate) cText(g, r.aDate, x1 - 14, up ? ya + vs + 46 : ya - 56, 17, 600, TPL_C.sub, "left"); if (r.bDate) cText(g, r.bDate, P + W, up ? yb - 56 : yb + vb + 46, 17, 600, TPL_C.sub, "right");
    if (r.pct) { var ps2 = 30, pw = cW(g, r.pct, ps2, 900) + 32, mx = (x1 + x2) / 2, my = (ya + yb) / 2; cRound(g, mx - pw / 2, my - 24, pw, 48, 24, col); cText(g, r.pct, mx, my + 11, ps2, 900, "#ffffff", "center"); }
    g.strokeStyle = TPL_C.soft; g.lineWidth = 2; g.beginPath(); g.moveTo(P, yy + rh); g.lineTo(P + W, yy + rh); g.stroke();
  });
  return tplFoot(c);
}
/* ---------- ⑤ 발언·기사: {tag, person:{name, role, facts:[[k,v]] ≤6}, paras:[..] ≤3} (제목은 meta.title에 따옴표 포함) ---------- */
function tplQuote(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, lw = 340;
  if (s.tag) { tplBand(g, P, y, 200, 72, s.tag, 28, TPL_C.black, TPL_C.gold); g.fillStyle = TPL_C.gold2; g.fillRect(P, y + 64, 200, 8); }
  var py = y + (s.tag ? 90 : 0);
  // 왼쪽 인물/출처 칸
  cRound(g, P, py, lw, 230, 12, TPL_C.box); var ini = String(s.person && s.person.name || "").slice(0, 2);
  g.fillStyle = TPL_C.black; g.beginPath(); g.arc(P + lw / 2, py + 90, 64, 0, Math.PI * 2); g.fill(); cText(g, ini, P + lw / 2, py + 108, 44, 900, TPL_C.gold, "center");
  cText(g, cFit(g, (s.person && s.person.name) || "", lw - 20, 30, 900), P + lw / 2, py + 196, 30, 900, TPL_C.ink, "center");
  if (s.person && s.person.role) cText(g, cFit(g, s.person.role, lw - 20, 20, 600), P + lw / 2, py + 222, 20, 600, TPL_C.sub, "center");
  var facts = (s.person && s.person.facts || []).slice(0, 6), fy = py + 250, fw = (lw - 14) / 2, fh = Math.round(120 * tplK());
  facts.forEach(function (f, i) { var x = P + (i % 2) * (fw + 14), yy = fy + Math.floor(i / 2) * (fh + 14); tplBox(g, x, yy, fw, fh, 10); var vs = 36; while (vs > 20 && cW(g, f[1], vs, 900) > fw - 20) vs -= 2; cText(g, f[1], x + fw / 2, yy + 58, vs, 900, TPL_C.ink, "center"); cText(g, cFit(g, f[0], fw - 16, 19, 700), x + fw / 2, yy + 96, 19, 700, TPL_C.sub, "center"); });
  // 오른쪽 요지
  var rx = P + lw + 40, rw = W - lw - 40, ry = py + 10, paras = (s.paras || []).slice(0, tplN(3, 5)), avail = TPL.H - 94 - ry;
  var fs = 34, lh = 50;
  function total() { var n = 0; paras.forEach(function (p) { n += cWrapCount(g, p, rw, fs, 700); }); return n * lh + (paras.length - 1) * 40; }
  while (total() > avail && fs > 22) { fs -= 2; lh = Math.round(fs * 1.5); }
  while (total() < avail * 0.62 && fs < Math.round(46 * Math.min(1.25, tplK()))) { fs += 2; lh = Math.round(fs * 1.5); }   // v11.6 요지가 짧으면 키워서 빈 곳 없이
  if (total() > avail) { fs -= 2; lh = Math.round(fs * 1.5); }
  var ty = ry + lh + Math.max(0, (avail - total()) / 2 - 20); paras.forEach(function (p) { var n = cWrapCount(g, p, rw, fs, 700); cWrap(g, p, rx + rw / 2, ty, rw, fs, 700, TPL_C.ink, lh, 8, "center"); ty += n * lh + 40; });
  return tplFoot(c);
}
/* ---------- ⑥ 날짜별 정리: {blocks:[{date:"2026\n6.27", title, items:[문장 with [[형광]]]}] ≤4} ---------- */
function tplTimeline(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, blocks = (s.blocks || []).slice(0, tplN(4, 5)), gap = 14;
  var totalItems = blocks.reduce(function (a, b) { return a + Math.min(6, (b.items || []).length); }, 0);
  var avail = TPL.H - 84 - y - gap * (blocks.length - 1), headH = 60, ih = Math.max(34, Math.min(110, (avail - blocks.length * (headH + 24)) / Math.max(1, totalItems)));
  blocks.forEach(function (b) {
    var items = (b.items || []).slice(0, tplN(6, 8)), h = headH + 24 + items.length * ih, dw = 140;
    tplBox(g, P, y, W, h, 10, "#ffffff", 3); cRound(g, P, y, dw, h, 10, TPL_C.black); g.fillStyle = TPL_C.gold2; g.fillRect(P + dw - 4, y, 4, h);
    var dl = String(b.date || "").split("\n"); dl.forEach(function (d, i) { cText(g, d, P + dw / 2, y + h / 2 - (dl.length - 1) * 20 + i * 40 + 12, dl.length > 1 && i === 0 ? 26 : 34, 900, i === dl.length - 1 ? TPL_C.gold : "#ffffff", "center"); });
    tplBand(g, P + dw + 16, y + 10, W - dw - 32, headH - 16, b.title || "", 28, TPL_C.box, TPL_C.ink); g.strokeStyle = TPL_C.ink; g.lineWidth = 3; g.strokeRect(P + dw + 16, y + 10, W - dw - 32, headH - 16);
    items.forEach(function (t, i) {
      var yy = y + headH + 8 + i * ih + ih * 0.68, x = P + dw + 24, fs = Math.min(34, ih * 0.5), maxW = W - dw - 90;   // v12.20 칸이 크면 글씨도 키우고, 폭에 맞춰 줄인다
      while (fs > 20 && cW(g, cPlain(String(t)), fs, 800) > maxW) fs -= 1;
      g.fillStyle = TPL_C.ink; g.beginPath(); g.arc(x + 14, yy - fs * 0.35, 14, 0, Math.PI * 2); g.fill(); cText(g, String(i + 1), x + 14, yy - fs * 0.35 + 7, 18, 900, "#ffffff", "center");
      var parts = String(t).split(/\[\[|\]\]/), cx = x + 40; cFont(g, fs, 800);
      parts.forEach(function (p, k) { if (!p) return; var w = g.measureText(p).width; if (k % 2) { g.fillStyle = TPL_C.hl; g.fillRect(cx - 2, yy - fs * 0.95, w + 4, fs * 1.2); } cText(g, p, cx, yy, fs, 800, TPL_C.ink); cx += w; });
    });
    y += h + gap;
  });
  return tplFoot(c);
}
/* ---------- ⑦ 숫자 12칸: {boxes:[{label, value, unit}] ≤12, note} ---------- */
function tplGrid(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, boxes = (s.boxes || []).slice(0, tplN(12, 16)), n = boxes.length;
  var cols = n <= 4 ? 2 : n <= 6 ? 3 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols), gap = 14, bw = (W - gap * (cols - 1)) / cols, bh = Math.min(330 * (n < tplN(12, 16) ? tplK() : 1), (TPL.H - 104 - y - gap * (rows - 1)) / rows);
  if (s.lead) { cWrap(g, s.lead, P, y + 30, W, 28, 800, TPL_C.ink, 36, 2); y += 76; bh = Math.min(bh, (TPL.H - 104 - y - gap * (rows - 1)) / rows); }
  boxes.forEach(function (b, i) {
    var x = P + (i % cols) * (bw + gap), yy = y + Math.floor(i / cols) * (bh + gap);
    cRound(g, x, yy, bw, bh, 14, TPL_C.black);
    cWrap(g, b.label, x + bw / 2, yy + 52, bw - 24, 26, 800, "#ffffff", 32, 2, "center");
    var vs = Math.min(72, bh * 0.36); while (vs > 30 && cW(g, b.value, vs, 900) + (b.unit ? cW(g, b.unit, 24, 800) + 6 : 0) > bw - 24) vs -= 4;
    var vw = cW(g, b.value, vs, 900), uw = b.unit ? cW(g, b.unit, 24, 800) + 6 : 0, x0 = x + bw / 2 - (vw + uw) / 2;
    cText(g, b.value, x0, yy + bh - 40, vs, 900, b.color || "#ffffff"); if (b.unit) cText(g, b.unit, x0 + vw + 6, yy + bh - 40, 24, 800, TPL_C.gold);
  });
  if (s.note) cText(g, cFit(g, "※ " + s.note, W, 22, 700), P, y + rows * (bh + gap) + 22, 22, 700, TPL_C.ink2);
  return tplFoot(c);
}
/* ---------- ⑧ 한 줄 상식: {rows:[{icon,left,right,sub}] ≤7, punch:{left,right}, closing} ---------- */
function tplLines(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, rows = (s.rows || []).slice(0, tplN(7, 10));
  var punchH = s.punch ? 110 : 0, closeH = s.closing ? 90 : 0, rh = Math.min(170 * (rows.length < tplN(7, 10) ? tplK() : 1), (TPL.H - 94 - y - punchH - closeH - 30) / Math.max(1, rows.length));
  tplBox(g, P, y, W, rows.length * rh + 20, 18);
  rows.forEach(function (r, i) {
    var yy = y + 10 + i * rh, mid = yy + rh / 2;
    // v12.20 핀 아이콘 제거 · 왼쪽 용어는 금색 꼬리표 · 오른쪽 뜻은 한 줄(글씨를 줄여서) — 두 줄은 최후 수단
    var lsz = 34, lmax = 300; while (lsz > 22 && cW(g, r.left, lsz, 900) > lmax - 28) lsz -= 2;
    var tagW = Math.min(lmax, cW(g, r.left, lsz, 900) + 28); cRound(g, P + 28, mid - 26, tagW, 52, 10, "#f3e7c6"); cText(g, cFit(g, r.left, lmax - 28, lsz, 900), P + 28 + tagW / 2, mid + 12, lsz, 900, TPL_C.ink, "center");
    var rx = P + 28 + lmax + 24, rw = W - (lmax + 80), rs = 34; while (rs > 24 && cW(g, r.right, rs, 800) > rw) rs -= 1;
    if (cW(g, r.right, rs, 800) <= rw) { cText(g, r.right, rx, mid + (r.sub ? 4 : 12), rs, 800, TPL_C.ink); if (r.sub) cText(g, cFit(g, r.sub, rw, 19, 600), rx, mid + 34, 19, 600, TPL_C.sub); }
    else { var ws = Math.max(20, Math.min(26, (rh - 24) / 2 / 1.25)), nl = Math.min(2, cWrapCount(g, r.right, rw, ws, 800)); cWrap(g, r.right, rx, mid - (nl - 1) * ws * 0.62 + ws * 0.36, rw, ws, 800, TPL_C.ink, ws * 1.25, 2); }
    if (i < rows.length - 1) { g.setLineDash([8, 8]); g.strokeStyle = TPL_C.shade; g.lineWidth = 2; g.beginPath(); g.moveTo(P + 30, yy + rh); g.lineTo(P + W - 30, yy + rh); g.stroke(); g.setLineDash([]); }
  });
  y += rows.length * rh + 40;
  if (s.punch) { cRound(g, P, y, W, 90, 10, TPL_C.black); g.fillStyle = TPL_C.gold; g.fillRect(P, y, 8, 90); cText(g, cFit(g, s.punch.left, 400, 36, 900), P + 30, y + 58, 36, 900, "#ffffff"); cText(g, "→", P + 470, y + 58, 36, 900, TPL_C.gold); var ps = 44; while (ps > 28 && cW(g, s.punch.right, ps, 900) > W - 560) ps -= 2; cText(g, s.punch.right, P + 520, y + 60, ps, 900, TPL_C.gold); y += 110; }
  if (s.closing) cWrap(g, s.closing, P + W / 2, y + 44, W - 40, 30, 800, TPL_C.ink, 40, 2, "center");
  return tplFoot(c);
}
/* ---------- ⑨ 달력: {year, month, events:{"d":[{t,k}]}, side:{title, items[]} } ---------- */
function tplCalendar(c, s) {
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, y = c.y, first = new Date(Date.UTC(s.year, s.month - 1, 1)), dow0 = first.getUTCDay(), days = new Date(Date.UTC(s.year, s.month, 0)).getUTCDate();
  var cw = W / 7, hh = 64, weeks = Math.ceil((dow0 + days) / 7), rh = Math.min(170 * tplK() * 1.25, (TPL.H - 94 - y - hh) / weeks);
  cRound(g, P, y, W, hh, 0, TPL_C.black); "일월화수목금토".split("").forEach(function (d, i) { cText(g, d, P + cw * i + cw / 2, y + 46, 34, 900, i === 0 ? "#ff6b6b" : i === 6 ? "#7fb2ff" : "#ffffff", "center"); });
  for (var i = 0; i < weeks * 7; i++) {
    var d = i - dow0 + 1, x = P + (i % 7) * cw, yy = y + hh + Math.floor(i / 7) * rh;
    g.strokeStyle = TPL_C.ink; g.lineWidth = 3; g.strokeRect(x, yy, cw, rh);
    if (d < 1 || d > days) { g.fillStyle = TPL_C.box; g.fillRect(x + 2, yy + 2, cw - 4, rh - 4); continue; }
    var ev = (s.events && s.events[d]) || [], hol = ev.some(function (e) { return e.k === "hol"; }), col = hol || i % 7 === 0 ? TPL_C.red : i % 7 === 6 ? TPL_C.blue : TPL_C.ink;
    cText(g, String(d), x + 8, yy + 32, 28, 900, col);
    if (s.today === d) { cRound(g, x + cw - 30, yy + 8, 22, 22, 11, TPL_C.gold2); }
    var ey = yy + 56; ev.slice(0, 3).forEach(function (e) { var bg = e.k === "hol" ? TPL_C.hlRed : e.k === "us" ? "#dbeafe" : e.k === "kr" ? TPL_C.hl : TPL_C.box; var lines = Math.min(2, cWrapCount(g, e.t, cw - 14, 17, 800)); cRound(g, x + 4, ey - 15, cw - 8, lines * 21 + 8, 4, bg); cWrap(g, e.t, x + 7, ey, cw - 14, 17, 800, TPL_C.ink, 21, 2); ey += lines * 21 + 12; });
  }
  return tplFoot(c);
}
/* AI 기획에 넘기는 틀 설명 — 항목 수·모양을 맞춰 오게 */
var TPL_HINT = {
  market: "layout=list · items 13개: 1~2번은 지수(label=지수명, value=지수값, sub=등락%), 3~5번은 주인공 종목(label=이름, value=등락%), 6~13번은 나머지 종목(label=이름, value=등락%)",
  rank: "layout=rank · items 9~12개 순위: label=이름, value=순위 기준 숫자(수익률·배수 등), sub=짧은 꼬리표(10자 이내)",
  table: "layout=list · items 6~9개 표 행: label=항목, value=핵심 숫자, sub=메모(12자 이내)",
  compare: "layout=list · items 4개 비교: label=이름, value='그때값 → 지금값' 형식, sub=한 줄 설명(수익률 등)",
  quote: "layout=hero · title=따옴표 안에 들어갈 한 문장(24자 이내), hero.label=화자/출처, hero.value=역할·설명, items 4개=숫자 근거(label, value), subtitle·cta=요지 문단",
  timeline: "layout=list · items 3~4개 날짜 블록: label=제목, value=날짜(예 '2026 10.13'), sub='문장1 · 문장2 · 문장3' (·로 구분, 각 20자 이내)",
  grid: "layout=list · items 9~12개 숫자 칸: label=이름(10자 이내), value=숫자+단위(예 '58%', '1,380원'), subtitle=한 줄 설명",
  lines: "layout=list · items 7개 한 줄 상식: label=왼쪽(4자 이내), value=오른쪽(8자 이내), sub=부연(16자 이내), hero=펀치라인(label 왼쪽, value 오른쪽), cta=맺음말"
};
var TPL_DRAW = { market: tplMarket, rank: tplRank, table: tplTable, compare: tplCompare, quote: tplQuote, timeline: tplTimeline, grid: tplGrid, lines: tplLines, calendar: tplCalendar };
function tplCard(cat, meta, spec) { meta = meta || {}; meta.cat = cat; if (meta.sub) meta.sub = String(meta.sub).replace(/코인 코인/g, "코인").replace(/전체 종목/g, "전체"); var c = tplNew(meta); return TPL_DRAW[cat](c, spec || {}); }

/* ============================================================
   앱 데이터 → 명세 (양식집 화면용) · 시장별로 내용만 바뀐다
   ============================================================ */
/* v12.20 '20일선 위 50일선 위 200일선 위' → '20·50·200일선 위' 처럼 같은 꼬리를 묶어 한 칸에 들어가게 */
function tplReasonShort(t) { t = String(t || "").trim(); if (!t) return t; var groups = {}, order = [], rest = []; t.split(/\s+/).forEach(function (w) { var m = w.match(/^(\d+)일선(위|아래)$/) || (w.match(/^(\d+)일선$/) ? null : null); if (m) { var k = "일선 " + m[2]; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(m[1]); } else rest.push(w); }); var m2 = t.match(/(\d+)일선 (위|아래)/g); if (m2 && m2.length >= 2) { var g2 = {}, o2 = []; m2.forEach(function (x) { var mm = x.match(/(\d+)일선 (위|아래)/); var k = mm[2]; if (!g2[k]) { g2[k] = []; o2.push(k); } g2[k].push(mm[1]); }); var repl = o2.map(function (k) { return g2[k].join("·") + "일선 " + k; }).join(" · "); var others = t.replace(/(\d+)일선 (위|아래)/g, "").replace(/\s{2,}/g, " ").trim(); return (repl + (others ? " · " + others : "")).trim(); } return t; }
function tplStat(sym) { var r = (typeof briefState !== "undefined" && briefState.recent) || null, d = r && r.symbols[sym]; return d ? briefStats(sym, d, "day") : null; }
function tplDateTxt(R) { var m = typeof cMktInfo === "function" ? cMktInfo(R) : null; return m ? m.date : cDate(Date.now()); }
function tplSrc(R) { return "야후 파이낸스 종가 · " + tplDateTxt(R) + " 기준 · StockMind 자동 집계"; }
function tplPct(x, d) { return x == null ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 2 : d) + "%"; }
function tplFmt(sym, v) { return typeof cPrice === "function" ? cPrice(sym, v) : String(v); }
var TPL_SOURCES = {
  market: [{ id: "today", t: "오늘 마감 (현재 시장)" }],
  rank: [{ id: "m1", t: "1개월 수익률 TOP12" }, { id: "amt", t: "거래대금 평소 대비 TOP12" }, { id: "pop", t: "인기 종목 TOP12 (전일 등락)" }, { id: "sale", t: "고점 대비 할인 TOP12" }],
  table: [{ id: "picks", t: "선별 종목 판정표 (매수 후보)" }, { id: "picksWarn", t: "선별 종목 판정표 (주의)" }, { id: "themes", t: "업종 성적표" }, { id: "idx", t: "주요 지수·자산 한눈에" }],
  compare: [{ id: "y1", t: "1년 전 vs 지금 (대표 자산)" }, { id: "hi", t: "고점 vs 지금 (가장 많이 빠진 4)" }],
  quote: [{ id: "lead", t: "오늘 가장 관심 가는 기사" }],
  timeline: [{ id: "week", t: "이번 주 일정" }, { id: "policy", t: "정책 카드 (첫 번째)" }],
  grid: [{ id: "temp", t: "시장 숫자 12칸" }],
  lines: [{ id: "terms", t: "용어 한 입 7개" }, { id: "mind", t: "하락장 멘탈 체크 7줄" }],
  calendar: [{ id: "month", t: "이번 달 달력" }]
};
/* v10.4 시장 선택: 전체·국내·미국·코인 — 브리핑 화면의 시장과 달라도 그 시장으로 다시 계산 (시장마다 1번만, 캐시) */
var TPL_MKS = [["all", "전체"], ["kr", "🇰🇷 국내"], ["us", "🇺🇸 미국"], ["coin", "₿ 코인"]], TPL_RC = {};
function tplR(mk) {
  if (typeof briefState === "undefined" || !briefState.recent) return null;
  mk = mk || briefState.market || "all";
  if (briefState.result && briefState.market === mk && briefState.result.mode === "day") return briefState.result;
  var key = mk + "|" + (briefState.recent.generated || "");
  if (!TPL_RC[key]) { try { TPL_RC[key] = briefCompute(briefState.recent, { mode: "day", market: mk, popular: briefState.popular }); } catch (e) { console.warn(e); return null; } }
  return TPL_RC[key];
}
function tplSpec(cat, srcId, mkSel) {
  var R = tplR(mkSel); if (!R || R.marketWideOff) return null;   // v12.29 전체 시장 숫자를 못 쓰는 날은 앱 데이터 카드를 만들지 않는다
  var mk = typeof cMktInfo === "function" ? cMktInfo(R) : null, mkName = mk ? mk.name : "전체", unit = R.market === "coin" ? "코인" : "종목", date = tplDateTxt(R), src = tplSrc(R);
  var S = (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym); });
  function r1(s) { return s.ret1 != null ? s.ret1 : s.ret; }
  if (cat === "market") {
    var ix = R.indexRow.slice(0, 2).map(function (i) { var st = tplStat(i.sym); var chg = st ? st.last - st.last / (1 + st.ret1) : null; return { name: i.name, val: tplFmt(i.sym, i.last).replace(/원$|\$/g, function (m) { return m; }), chg: chg != null ? (chg >= 0 ? "▲ " : "▼ ") + Math.abs(chg).toFixed(2) : "", pct: tplPct(i.ret) }; });
    var mv = R.movers.up.slice(0, tplN(2, 3) + (R.market === "us" || R.market === "kr" ? 1 : 0)).concat(R.movers.down.slice(0, tplN(1, 2) + (R.market === "us" || R.market === "kr" ? 1 : 0))).sort(function (a, b) { return Math.abs(r1(b)) - Math.abs(r1(a)); });
    var ft = mv.slice(0, tplN(3, 5)).map(function (s) { return { name: briefName(s), pct: tplPct(r1(s)) }; });
    var pop = (R.popular || []).filter(function (s) { return mv.indexOf(s) < 0; }).slice(0, tplN(8, 12)).map(function (s) { return { name: briefName(s), pct: tplPct(r1(s)) }; });
    var hiN0 = S.filter(function (s) { return s.newHigh; }).length;
    var flag = R.market === "us" || R.market === "kr" ? R.market : null, caps = flag && typeof cCap8 === "function" ? cCap8(R.market) : null, etf = flag && typeof cEtfPop === "function" ? cEtfPop(R.market) : null;
    if (flag) ft = mv.slice(0, tplN(4, 6)).map(function (s) { return { name: briefName(s), pct: tplPct(r1(s)) }; });
    return { meta: { title: mkName === "미국" ? "새벽의 미장" : mkName === "코인" ? "오늘의 코인" : mkName === "국내" ? "오늘의 국장" : "오늘의 시장", sub: date + " · 전일 대비" + (caps ? " · 시총 상위 8: " + caps.src : ""), source: src, catName: mkName + " 마감", flag: flag }, spec: { indexes: ix, features: ft, chips: pop, caps: caps && caps.rows.length >= 4 ? caps.rows.map(function (c) { return { sym: c.sym, name: c.name, pct: tplPct(c.ret) }; }) : null, etfs: etf && etf.length ? etf.map(function (e) { return { name: e.name, pct: tplPct(e.ret) }; }) : null, foot: "오른 " + unit + " " + Math.round(R.temp.upPct * 100) + "%  ·  20일선 위 " + Math.round(R.temp.abovePct * 100) + "%  ·  52주 신고가 " + hiN0 + "개" } };
  }
  if (cat === "rank") {
    var list, title, val, tag;
    if (srcId === "amt") { list = S.filter(function (s) { return s.amtX > 1; }).sort(function (a, b) { return b.amtX - a.amtX; }); title = "거래대금 급증 순위"; val = function (s) { return s.amtX.toFixed(1) + "배"; }; tag = function (s) { return tplPct(r1(s), 1); }; }
    else if (srcId === "pop") { list = R.popular || []; title = "지금 인기 " + unit + " 순위"; val = function (s) { return tplPct(r1(s), 1); }; tag = function (s) { return "고점 " + tplPct(s.vsHi, 0); }; }
    else if (srcId === "sale") { list = S.filter(function (s) { return s.vsHi != null; }).sort(function (a, b) { return a.vsHi - b.vsHi; }); title = "고점 대비 할인 순위"; val = function (s) { return tplPct(s.vsHi, 0); }; tag = function (s) { return "1개월 " + tplPct(s.m1, 0); }; }
    else { list = S.filter(function (s) { return s.m1 != null; }).sort(function (a, b) { return b.m1 - a.m1; }); title = "1개월 수익률 순위"; val = function (s) { return tplPct(s.m1, 1); }; tag = function (s) { return "하루 " + tplPct(r1(s), 1); }; }
    return { meta: { title: title, sub: mkName + " " + unit + " · " + date + " 종가 기준", source: src, catName: mkName + " 순위" }, spec: { items: list.slice(0, tplN(12, 16)).map(function (s, i) { return { rank: i + 1, tag: tag(s), name: briefName(s), value: val(s) }; }) } };
  }
  if (cat === "table") {
    if (srcId === "themes") return { meta: { title: (R.market === "coin" ? "테마" : "업종") + " 성적표", sub: mkName + " · " + date + " · 평균 등락 · 가장 센 " + unit, source: src, catName: mkName + " 업종" }, spec: { cols: [R.market === "coin" ? "테마" : "업종", "평균", "오른 " + unit, "1등", "꼴찌"], widths: [0.26, 0.16, 0.16, 0.21, 0.21], hlCols: [1], rows: R.themes.slice(0, tplN(10, 14)).map(function (t) { return [t.name, tplPct(t.ret, 2), t.up + "/" + t.n, briefName(t.best), briefName(t.worst)]; }) } };
    if (srcId === "idx") { var SY = [["^GSPC", "S&P500"], ["^IXIC", "나스닥"], ["^KS11", "코스피"], ["^KQ11", "코스닥"], ["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"], ["GLD", "금"], ["TLT", "미국 장기채"], ["KRW=X", "달러/원"], ["^VIX", "VIX"]]; return { meta: { title: "오늘의 숫자 한눈에", sub: date + " 종가 · 하루 · 1개월 · 고점 대비", source: src, catName: "시장 숫자" }, spec: { cols: ["자산", "종가", "하루", "1개월", "고점 대비"], widths: [0.26, 0.24, 0.16, 0.16, 0.18], hlCols: [2], rows: SY.map(function (a) { var s = tplStat(a[0]); return s ? [a[1], a[0] === "^VIX" ? s.last.toFixed(1) : tplFmt(a[0], s.last), tplPct(s.ret1, 2), tplPct(s.m1, 0), tplPct(s.vsHi, 0)] : null; }).filter(Boolean) } }; }
    var pk = typeof pkReady === "function" ? pkReady(R) : null, side = srcId === "picksWarn" ? "warn" : "buy", L = pk ? pk[side] : [];
    return { meta: { title: side === "buy" ? "매수 후보 판정표" : "주의 " + unit + " 판정표", sub: mkName + " · " + date + " · 추세·RSI·대금·재무·기사 복합 점수", source: src, catName: "선별 " + unit }, spec: { cols: [unit, "점수", "추세", "RSI", "고점 대비", "핵심 이유"], widths: [0.21, 0.13, 0.17, 0.09, 0.13, 0.27], hlCols: [1], rows: L.map(function (x) { var s = x.s; return [briefName(s), (side === "buy" ? "+" + x.bs + " / -" + x.ws : "-" + x.ws + " / +" + x.bs), (s.above20 ? "20↑" : "20↓") + (s.above200 == null ? "" : s.above200 ? " 200↑" : " 200↓"), s.rsi != null ? Math.round(s.rsi) : "-", tplPct(s.vsHi, 0), tplReasonShort((typeof pkTopReason === "function" ? pkTopReason(x, side) : "").split(" · ").slice(1).join(" ")) || "-"]; }), note: L.length ? "점수 = 플러스 항목 합 / 마이너스 항목 합 · 데이터로 고른 후보이며 판단은 본인에게" : "선별 종목이 아직 계산되지 않았어요 — 오늘의 브리핑 화면을 먼저 열어 주세요" } };
  }
  if (cat === "compare") {
    if (srcId === "hi") { var dd = S.filter(function (s) { return s.vsHi != null && s.hi250; }).sort(function (a, b) { return a.vsHi - b.vsHi; }).slice(0, tplN(4, 6)); return { meta: { title: "고점 vs 지금", sub: mkName + " · 52주 최고가 대비 가장 많이 빠진 " + unit + " 4", source: src, catName: mkName + " 낙폭" }, spec: { aLabel: "고점", aSub: "52주 최고가", bLabel: "지금", bSub: date + " 종가", rows: dd.map(function (s) { return { badge: briefName(s), name: "고점 대비 " + tplPct(s.vsHi, 0), a: tplFmt(s.sym, s.hi250), b: tplFmt(s.sym, s.last), pct: tplPct(s.vsHi, 0) }; }) } }; }
    var SY2 = R.market === "coin" ? ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD"] : R.market === "kr" ? ["^KS11", "005930.KS", "000660.KS", "GLD"] : ["^GSPC", "^IXIC", "BTC-USD", "GLD"];
    return { meta: { title: "1년 전 · 지금", sub: date + " 기준 · 대표 자산 4개 · 1년 수익률", source: src, catName: "그때·지금" }, spec: { aLabel: "1년 전", aSub: "작년 이맘때 종가", bLabel: "지금", bSub: date + " 종가", rows: SY2.map(function (sym) { var s = tplStat(sym); if (!s || s.y1 == null) return null; return { badge: briefName(s), name: "1년 수익률 " + tplPct(s.y1, 0), a: tplFmt(sym, s.last / (1 + s.y1)), b: tplFmt(sym, s.last), pct: tplPct(s.y1, 0) }; }).filter(Boolean) } };
  }
  if (cat === "quote") {
    var items = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items) || [], lead = typeof cNewsLead === "function" ? cNewsLead(items, R) : null;
    if (!lead) return { meta: { title: "\"오늘 기사를\n아직 못 받았어요\"", source: "네이버 뉴스", catName: "오늘의 기사" }, spec: { person: { name: "-", facts: [] }, paras: ["오늘의 브리핑 화면을 먼저 열어 기사를 받아 주세요."] } };
    var it = lead.it, t = cNewsClean(it.title), facts = [];
    (lead.facts || []).slice(0, 4).forEach(function (f) { var m = String(f).match(/^(.*)\s(\S+)$/); facts.push(m ? [m[1], m[2]] : [String(f), ""]); });
    if (!facts.length) R.indexRow.slice(0, 4).forEach(function (i) { facts.push([i.name, tplPct(i.ret, 2)]); });
    var desc = cNewsClean(it.desc || ""), paras = desc ? desc.split(/(?<=다\.)\s+/).filter(Boolean).slice(0, 3) : ["기사 본문 요약이 없어요 — 제목과 숫자만 함께 보세요."];
    return { meta: { title: "\"" + t + "\"", source: "네이버 뉴스 · " + (it.press || "") + " · " + date, source2: "숫자는 야후 파이낸스 종가", catName: "오늘의 기사" }, spec: { tag: "오늘의 기사", person: { name: it.press || "언론", role: ({ main: "국내 증시 기사", world: "해외 증시 기사", fx: "환율 기사", rate: "금리 기사", coin: "코인 기사", stock: "종목 기사" })[it.cat] || "오늘 가장 관심 가는 기사", facts: facts }, paras: paras } };
  }
  if (cat === "timeline") {
    if (srcId === "policy" && typeof pubPolicyAll === "function") { var pl = pubPolicyAll()[0]; if (pl) { var blocks = []; if (pl.table) blocks.push({ date: (pl.eff || "").split(" ")[0].replace(/\.$/, "").replace(/\./, "\n"), title: pl.table.head.join(" · "), items: pl.table.rows.slice(0, 6).map(function (r) { return r[0] + " → [[" + r.slice(1).join(" · ") + "]]"; }) }); if (pl.bullets) blocks.push({ date: "추가\n할인", title: pl.bullets.title, items: pl.bullets.items.slice(0, 5).map(function (x) { return x.replace(/(\d[\d.]*%p?)/g, "[[$1]]"); }) }); return { meta: { title: cPlain(pl.title || pl.t), sub: pl.sub || "", source: pl.src || "", catName: "정책 카드" }, spec: { blocks: blocks } }; } }
    var up = typeof pubUpcoming === "function" ? pubUpcoming(7) : [], byD = {}; up.forEach(function (e) { (byD[e.d] = byD[e.d] || []).push(e); });
    var bl = Object.keys(byD).sort().slice(0, 4).map(function (d) { return { date: d.slice(5).replace("-", "/") + "\n(" + pubDow(d) + ")", title: byD[d].length + "개 일정", items: byD[d].map(function (e) { return String(e.t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim() + (e.n ? " — [[" + e.n.split(" · ")[0] + "]]" : "") + (e.sure === false ? " (예정)" : ""); }) }; });
    return { meta: { title: "이번 주 일정 총정리", sub: pubToday().slice(5).replace("-", "/") + "부터 7일 · 발표·실적·휴장", source: "각 기관 발표 일정 · StockMind 정리", catName: "이번 주 일정" }, spec: { blocks: bl.length ? bl : [{ date: "7일", title: "큰 일정 없음", items: ["이번 주는 예정된 주요 발표가 없어요"] }] } };
  }
  if (cat === "grid") {
    var t = R.temp, vix = tplStat("^VIX"), fx = tplStat("KRW=X"), b = tplStat("BTC-USD"), sp = tplStat("^GSPC"), ks = tplStat("^KS11"), tl = tplStat("TLT"), gl = tplStat("GLD");
    var hiN = S.filter(function (s) { return s.newHigh; }).length, loN = S.filter(function (s) { return s.newLow; }).length, saleN = S.filter(function (s) { return s.vsHi != null && s.vsHi <= -0.2; }).length;
    var boxes = [{ label: "오른 " + unit + " 비율", value: Math.round(t.upPct * 100), unit: "%" }, { label: "20일선 위 비율", value: Math.round(t.abovePct * 100), unit: "%" }, { label: "52주 신고가", value: hiN, unit: "개" }, { label: "52주 신저가", value: loN, unit: "개" }, { label: "고점 -20% 세일", value: saleN, unit: "개" }, { label: "공포지수 VIX", value: vix ? vix.last.toFixed(1) : "-", unit: "" }, { label: "달러/원", value: fx ? Math.round(fx.last).toLocaleString() : "-", unit: "원" }, { label: "S&P500 하루", value: sp ? tplPct(sp.ret1, 2) : "-", unit: "" }, { label: "코스피 하루", value: ks ? tplPct(ks.ret1, 2) : "-", unit: "" }, { label: "비트코인 하루", value: b ? tplPct(b.ret1, 2) : "-", unit: "" }, { label: "미국 장기채 1개월", value: tl ? tplPct(tl.m1, 1) : "-", unit: "" }, { label: "금 1개월", value: gl ? tplPct(gl.m1, 1) : "-", unit: "" }];
    return { meta: { title: "오늘 시장 숫자 12", sub: mkName + " · " + date + " 종가 기준", source: src, catName: "시장 숫자" }, spec: { boxes: boxes, note: "오른 비율·20일선 위 비율이 60%를 넘으면 상승 우세, 40% 아래면 하락 우세로 봐요" } };
  }
  if (cat === "lines") {
    if (srcId === "mind") return { meta: { title: "하락장 멘탈 체크", sub: "떨어질 때 할 일 → 하지 말 일", source: "우상향연구소 원칙", catName: "투자 상식" }, spec: { rows: [{ icon: "📉", left: "빠지니", right: "낙폭 확인", sub: "고점 대비 몇 %인지 숫자부터" }, { icon: "📰", left: "무섭니", right: "뉴스 끄기", sub: "제목 크기 ≠ 숫자 크기" }, { icon: "🗓️", left: "적립일", right: "그대로", sub: "규칙이 감정을 이긴다" }, { icon: "🧮", left: "비중", right: "견딜 만큼만", sub: "못 견딜 낙폭 = 비중 과다" }, { icon: "⏳", left: "회복", right: "기간을 본다", sub: "얼마나보다 언제까지" }, { icon: "💰", left: "현금", right: "나눠 쓰기", sub: "한 번에 다 넣지 않기" }, { icon: "📓", left: "기록", right: "남기기", sub: "다음 하락장의 나를 위해" }], punch: { left: "결국", right: "계획이 멘탈이다" }, closing: "숫자를 먼저 보고, 규칙대로 움직이는 사람이 남아요" } };
    var terms = []; for (var i = 0; i < 7; i++) terms.push(pubTerm(i));
    return { meta: { title: "주식 용어 7개\n한 줄로", sub: "뉴스에 매일 나오는 말 · 한 줄 정의", source: "우상향연구소 용어 한 입", catName: "용어" }, spec: { rows: terms.map(function (tm) { var nm = tm[0].split(" (")[0]; return { icon: "📌", left: nm, right: tm[1] }; }), punch: { left: "용어를 알면", right: "뉴스가 숫자로 보인다" } } };
  }
  if (cat === "calendar") {
    var now = new Date(Date.now() + 9 * 3600e3), yy = now.getUTCFullYear(), mm = now.getUTCMonth() + 1, ev = {};
    (typeof PUB_CAL !== "undefined" ? PUB_CAL : []).forEach(function (e) { if (e.d.slice(0, 7) === yy + "-" + String(mm).padStart(2, "0")) { var d = +e.d.slice(8); (ev[d] = ev[d] || []).push({ t: String(e.t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim(), k: e.k }); } });
    return { meta: { title: "투자 달력 " + mm + "월호", sub: yy + "년 " + mm + "월 · 발표 · 실적 · 휴장 (" + pubToday().slice(5).replace("-", "/") + " 기준)", source: "각 기관 발표 일정 · StockMind 정리", catName: "달력" }, spec: { year: yy, month: mm, today: now.getUTCDate(), events: ev } };
  }
  return null;
}
function tplBuild(cat, srcId, mk) { var x = tplSpec(cat, srcId, mk); if (!x) return null; return tplCard(cat, x.meta, x.spec); }
function tplPrep(cat, mk) { var R = tplR(mk); if (!R) return Promise.resolve(); var lp = typeof cLogoReady === "function" ? cLogoReady() : null; if (cat === "market" && lp) return lp; return cat === "quote" && typeof cardsNewsFetch === "function" ? cardsNewsFetch(R).catch(function () { return []; }) : cat === "table" && typeof pkEnsure === "function" ? pkEnsure(R).catch(function () { return null; }) : Promise.resolve(); }

/* ============================================================
   AI 기획(plan) → 양식 (같은 틀에 AI가 고른 내용만) — plan: {kicker,title,subtitle,layout,hero,items[{label,value,sub}],cta}
   ============================================================ */
function tplFromPlan(cat, plan, st) {
  var p = plan || {}, items = (p.items || []).filter(function (x) { return x.label || x.value; }), mk = st && st.mk, src = st && st.src || "", title = cPlain(String(p.title || "").replace(/\n/g, " "));
  var meta = { title: title, sub: p.subtitle || "", source: src, catName: p.kicker || (mk ? mk.name : "") };
  var spec;
  if (cat === "rank") spec = { items: items.slice(0, tplN(12, 16)).map(function (it, i) { return { rank: i + 1, name: it.label, value: it.value || "", tag: it.sub ? String(it.sub).slice(0, 10) : "" }; }) };
  else if (cat === "table") spec = { cols: ["항목", "값", "메모"], widths: [0.34, 0.26, 0.4], hlCols: [1], rows: items.slice(0, tplN(10, 14)).map(function (it) { return [it.label, it.value || "", it.sub || ""]; }), note: p.cta || "" };
  else if (cat === "compare") spec = { aLabel: "그때", bLabel: "지금", rows: items.slice(0, tplN(4, 6)).map(function (it) { var ab = String(it.value || "").split(/→|->|⇒/); return { badge: it.label, name: it.sub || "", a: ab.length > 1 ? ab[0].trim() : (it.sub || ""), b: ab.length > 1 ? ab[1].trim() : (it.value || ""), pct: "" }; }) };
  else if (cat === "quote") { meta.title = /^["“]/.test(title) ? title : "\"" + title + "\""; spec = { tag: p.kicker || "", person: { name: p.hero && p.hero.label || (mk ? mk.name : "오늘"), role: p.hero && p.hero.value || "", facts: items.slice(0, 4).map(function (it) { return [it.label, it.value || ""]; }) }, paras: [p.subtitle, items.slice(4, 6).map(function (it) { return it.label + " " + (it.value || ""); }).join(" · "), p.cta].filter(Boolean).slice(0, 3) }; }
  else if (cat === "timeline") spec = { blocks: items.slice(0, tplN(4, 5)).map(function (it) { return { date: String(it.value || "").replace(/\s+/, "\n"), title: it.label, items: String(it.sub || "").split(/\s*[·,]\s*/).filter(Boolean).slice(0, 4).map(function (t) { return t.replace(/(\d[\d.,]*%?)/g, "[[$1]]"); }) }; }) };
  else if (cat === "grid") spec = { lead: p.subtitle, boxes: items.slice(0, tplN(12, 16)).map(function (it) { var m = String(it.value || "").match(/^([+\-]?[\d.,]+)(.*)$/); return { label: it.label, value: m ? m[1] : (it.value || ""), unit: m ? m[2].trim() : "" }; }), note: p.cta || "" };
  else if (cat === "lines") spec = { rows: items.slice(0, tplN(7, 10)).map(function (it) { return { icon: "📌", left: it.label, right: it.value || "", sub: it.sub || "" }; }), punch: p.hero && p.hero.value ? { left: p.hero.label || "", right: p.hero.value } : null, closing: p.cta || "" };
  else if (cat === "market") spec = { indexes: items.slice(0, 2).map(function (it) { return { name: it.label, val: it.value || "", chg: "", pct: it.sub || "" }; }), features: items.slice(2, 5).map(function (it) { return { name: it.label, pct: it.value || "" }; }), chips: items.slice(5, 13).map(function (it) { return { name: it.label, pct: it.value || "" }; }) };
  else return null;
  if (cat === "quote" || cat === "rank" || cat === "grid") meta.sub = cat === "grid" ? "" : p.subtitle || "";
  return tplCard(cat, meta, spec);
}

/* ============================================================
   양식집 화면 (채널 자료 탭)
   ============================================================ */
var TPL_UI = { cat: "market", src: null, mk: null };
function tplPanel(box) {
  var cats = Object.keys(TPL_CAT), cat = TPL_UI.cat, srcs = TPL_SOURCES[cat] || [], src = TPL_UI.src && srcs.some(function (s) { return s.id === TPL_UI.src; }) ? TPL_UI.src : (srcs[0] && srcs[0].id);
  var mk = TPL_UI.mk || (typeof briefState !== "undefined" && briefState.market) || "all"; TPL_UI.mk = mk;
  var h = '<div class="pills seg" style="margin-bottom:8px">' + TPL_MKS.map(function (m) { return '<button data-tmk="' + m[0] + '"' + (m[0] === mk ? ' class="active"' : '') + '>' + m[1] + '</button>'; }).join("") + '</div>';
  h += '<div class="briefDim" style="margin-bottom:8px">카테고리마다 틀은 고정, 내용만 바뀌어요 (1080×1350). 아래에서 틀 → 내용 출처를 고르고 <b>미리보기</b> · <b>저장</b>. AI로 만들 때도 ✨ 버튼을 누르면 같은 틀에 AI가 고른 내용만 들어가요.</div>';
  h += '<div class="pills" style="margin-bottom:8px">' + cats.map(function (k) { return '<button data-tcat="' + k + '"' + (k === cat ? ' class="active"' : '') + '>' + TPL_CAT[k].icon + ' ' + TPL_CAT[k].name + '</button>'; }).join("") + '</div>';
  h += '<div class="briefDim" style="margin-bottom:8px"><b>' + TPL_CAT[cat].name + '</b> — ' + TPL_CAT[cat].desc + ' · 쓰임: ' + TPL_CAT[cat].use + '</div>';
  h += '<div class="row" style="gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><select class="tplSrc">' + srcs.map(function (s) { return '<option value="' + s.id + '"' + (s.id === src ? ' selected' : '') + '>' + s.t + '</option>'; }).join("") + '</select>' +
    '<button class="primary" data-tpl-make>🖼️ 미리보기</button><button class="chip" data-tpl-save disabled>⬇ 저장</button>' + (typeof aiBtn === "function" ? aiBtn("tpl:" + cat + ":" + src + ":" + mk, "✨ AI로 같은 틀") : "") + '</div>';
  h += '<div class="tplPrev"><img alt="" style="width:100%;max-width:540px;border-radius:12px;display:none;box-shadow:0 4px 18px rgba(0,0,0,.2)"><div class="briefDim tplPh">미리보기를 누르면 여기에 카드가 나와요</div></div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-tmk]"), function (b) { b.onclick = function () { TPL_UI.mk = b.getAttribute("data-tmk"); tplPanel(box); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-tcat]"), function (b) { b.onclick = function () { TPL_UI.cat = b.getAttribute("data-tcat"); TPL_UI.src = null; tplPanel(box); }; });
  box.querySelector(".tplSrc").onchange = function () { TPL_UI.src = this.value; tplPanel(box); };
  var img = box.querySelector(".tplPrev img"), ph = box.querySelector(".tplPh"), url = null;
  box.querySelector("[data-tpl-make]").onclick = function () {
    var btn = this; btn.textContent = "만드는 중…";
    Promise.resolve(tplPrep(cat, mk, src)).then(function () { return document.fonts && document.fonts.ready ? document.fonts.ready : null; }).then(function () {
      var cv; try { cv = tplBuild(cat, src, mk); } catch (e) { console.warn(e); alert("만들지 못했어요: " + e.message); }
      btn.textContent = "🖼️ 미리보기"; if (!cv) { ph.textContent = "오늘의 브리핑 데이터가 아직 없어요 — 브리핑 화면을 먼저 열어 주세요"; return; }
      url = cv.toDataURL("image/png"); img.src = url; img.style.display = "block"; ph.style.display = "none"; box.querySelector("[data-tpl-save]").disabled = false;
    });
  };
  box.querySelector("[data-tpl-save]").onclick = function () { if (!url) return; cardsDownload({ url: url, file: "uphill.lab_" + TPL_CAT[cat].name + "_" + ({ all: "전체", kr: "국내", us: "미국", coin: "코인" })[mk] + "_" + pubToday().replace(/-/g, "") + ".png" }); };
}
