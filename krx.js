/* ============================================================ v12.71 국내 마감 자료 카드 4종 — 서버 op=kr(네이버 급등락 순위·업종, 외국인·기관 순매수, 지수 수급) + 오늘 브리핑(news·points·sectors)
   kr-news   오늘의 주요 뉴스 — 기사 12~13개 + 핵심 포인트 5 (브리핑의 news·points)
   kr-sector 섹터별 주도주 — 급등 상위를 업종으로 묶고, 브리핑의 sectors.why 를 붙인다
   kr-flow   수급 — 외국인·기관 순매수·순매도 상위 + 지수 수급(개인·외국인·기관)
   kr-close  마감 한 장 — 코스피·코스닥 상자(종가·등락·20일 흐름·수급·상승/하락) + 핫테마 3열
   원칙: 못 읽은 칸은 그리지 않는다(빈 자리 대신 '자료 없음' 한 줄).
   ============================================================ */
var KRX = { data: null, busy: false };
function krxDay() { return smKstDay(); }
function krxCached() { try { var j = JSON.parse(localStorage.getItem("sm.kr:" + krxDay()) || "null"); return j && j.ok ? j : null; } catch (e) { return null; } }
function krxLoad(fresh) {
  if (!fresh) { var c = KRX.data || krxCached(); if (c && Date.now() - (c.at || 0) < 20 * 60e3) { KRX.data = c; return Promise.resolve(c); } }
  if (KRX.busy) return KRX.busy;
  KRX.busy = smDailyPost({ fresh: fresh ? 1 : 0, _op: "kr" }).then(function (j) { if (!j || !j.ok) throw new Error((j && j.reason) || "서버 응답 없음"); KRX.data = j; try { localStorage.setItem("sm.kr:" + krxDay(), JSON.stringify(j)); } catch (e) {} return j; }).finally(function () { KRX.busy = false; });
  return KRX.busy;
}
/* smDailyPost 는 op=claude 로 보낸다 — _op 가 있으면 그 op 로 */
(function () { var p0 = smDailyPost; smDailyPost = function (payload) { if (payload && payload._op) { var op = payload._op, tok = ""; try { tok = (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) {} var body = Object.assign({}, payload); delete body._op; return fetch("/api/channel?op=" + op, { method: "POST", headers: { "content-type": "application/json", "x-owner": tok }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }); } return p0.apply(this, arguments); }; })();
function krxFull() { return typeof smDailyFull === "function" ? smDailyFull() : null; }
function krxPct(v, d) { return v == null ? "-" : (v > 0 ? "+" : "") + v.toFixed(d == null ? 2 : d) + "%"; }
function krxEok(v) { if (v == null) return "-"; var a = Math.abs(v), s = a >= 10000 ? (a / 10000).toFixed(1) + "조" : Math.round(a).toLocaleString() + "억"; return (v < 0 ? "-" : "+") + s; }   // 억원 단위 입력
/* 급등 상위 → 업종 묶음 (코스피+코스닥, 업종 없는 종목은 '개별') */
function krxSectors(K, n) {
  var all = (K.up.kospi || []).map(function (x) { return Object.assign({ mk: "코스피" }, x); }).concat((K.up.kosdaq || []).map(function (x) { return Object.assign({ mk: "코스닥" }, x); })).filter(function (x) { return x.ret != null && x.ret > 0; });
  /* v12.81 네이버 급등 목록에 업종이 비면 앱 유니버스(코스피200)의 업종으로 채우고, 업종 묶음이 모자라면 유니버스 전체를 업종별로 묶어 보탠다 */
  var RK = krFrame(), U = {}; ((RK && RK.uniStocks) || []).forEach(function (x) { U[String(x.sym).replace(/\.K[SQ]$/, "")] = x; });
  all.forEach(function (x) { if (!x.sec && U[x.code] && U[x.code].sec) x.sec = U[x.code].sec; });
  var by = {}; all.forEach(function (x) { var k = x.sec || "개별"; (by[k] = by[k] || []).push(x); });
  var S = Object.keys(by).map(function (k) { var L = by[k].sort(function (a, b) { return b.ret - a.ret; }); return { name: k, items: L, score: L.length * 2 + L.slice(0, 3).reduce(function (s, x) { return s + x.ret; }, 0) / 10, n: L.length }; });
  var F = krxFull(), W = {}; ((F && F.data && F.data.sectors) || []).forEach(function (s) { W[s.name] = s; });
  S.forEach(function (s) { var w = W[s.name] || Object.keys(W).map(function (k) { return W[k]; }).filter(function (w) { return (w.names || []).some(function (nm) { return s.items.some(function (x) { return x.name === nm; }); }); })[0]; s.why = w ? w.why : ""; });
  var multi = S.filter(function (s) { return s.name !== "개별" && s.n >= 2; }), singles = [].concat.apply([], S.filter(function (s) { return s.name === "개별" || s.n < 2; }).map(function (s) { return s.items; })).sort(function (a, b) { return b.ret - a.ret; });
  multi.sort(function (a, b) { return b.score - a.score; });
  var out = multi.slice(0, n || 6);
  if (out.length < Math.min(3, n || 6) && RK && (RK.uniStocks || []).length) {   // 유니버스(코스피200) 업종 묶음으로 보강
    var used = {}; out.forEach(function (x) { used[x.name] = 1; });
    usSectors(RK, 8).filter(function (g) { return !used[g.name] && g.avg > 0; }).forEach(function (g) { if (out.length < (n || 6)) out.push({ name: g.name, items: g.items, n: g.n, why: g.why || "", avg: g.avg, up: g.up, uni: true }); });
  }
  if (singles.length && out.length < (n || 6)) out.push({ name: "개별 급등", items: singles, n: singles.length, why: "", single: true });
  return out;
}
function krFrame() { var F = typeof smMkFrame === "function" ? smMkFrame("kr") : null; return F && F.R ? F.R : null; }
/* ---------- 그리기 도우미 (1080×1350 · 흰 종이 · 위 검정 띠) ---------- */
var KX = { W: 1080, H: 1350, P: 56, ink: "#14161c", gold: "#c9a24f", paper: "#fbf8f1", up: "#c03b3b", dn: "#2456b7", sub: "#6b7280", line: "#e4dfd3", box: "#ffffff", soft: "#f3efe6" };
function kxNew(title, sub, page, total, tag) {
  var cv = document.createElement("canvas"); cv.width = KX.W; cv.height = KX.H; var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = KX.paper; g.fillRect(0, 0, KX.W, KX.H); g.fillStyle = KX.ink; g.fillRect(0, 0, KX.W, 112);
  if (typeof cBrandMark === "function") cBrandMark(g, KX.P, 34, 30); cText(g, "우상향연구소", KX.P + 42, 58, 22, 900, "#f3efe6"); cText(g, "UPHILL.LAB", KX.P + 190, 58, 15, 700, KX.gold);
  cText(g, cDate(Date.now()) + " · " + (tag || "국내 마감"), KX.W - KX.P, 58, 18, 700, "#b9b3a8", "right");
  cText(g, cFit(g, title, KX.W - KX.P * 2 - 220, 34, 900), KX.P, 94, 34, 900, "#f3efe6");
  if (sub) cText(g, cFit(g, sub, 210, 16, 600), KX.W - KX.P, 94, 16, 600, KX.gold, "right");
  if (total > 1) { var bw = (KX.W - KX.P * 2 - (total - 1) * 6) / total; for (var i = 0; i < total; i++) { g.fillStyle = i < page ? KX.gold : "#3a3f4c"; g.fillRect(KX.P + i * (bw + 6), 104, bw, 4); } }
  return { cv: cv, g: g, y: 112 + 30 };
}
function kxFoot(c, src) {
  var g = c.g, y0 = KX.H - 60; g.fillStyle = KX.ink; g.fillRect(KX.P, y0, KX.W - KX.P * 2, 2);
  cText(g, cFit(g, src || "네이버 증권 집계 · 종가 기준 · 투자 권유 아님", KX.W - KX.P * 2 - 200, 15, 600), KX.P, y0 + 30, 15, 600, KX.sub);
  cText(g, "@uphill.lab", KX.W - KX.P, y0 + 31, 18, 900, KX.ink, "right");
}
function kxEmpty(c, msg) { cText(c.g, msg, KX.W / 2, c.y + 120, 24, 700, KX.sub, "center"); }
var KX_CAT = { 반도체: "#2456b7", 정책: "#1d7f55", 금리: "#7a4ea8", 환율: "#b9600f", 실적: "#c03b3b", 수급: "#1f3a68", 부동산: "#8a6d2b", 코인: "#d97706", 해외: "#0e7490", 산업: "#4b5563" };
/* ---------- 1) 오늘의 주요 뉴스 ---------- */
function krxNewsDeck() {
  var F = krxFull(), N = F && F.data ? (F.data.news || []) : [], PT = F && F.data ? (F.data.points || []) : [];
  if (!N.length) throw new Error("오늘 브리핑에 뉴스 목록(news)이 없어요 — 작업실 ②에서 새 프롬프트로 다시 받으세요");
  var per = 4, pages = Math.ceil(N.length / per), total = pages + (PT.length ? 1 : 0), out = [];
  for (var p = 0; p < pages; p++) {
    var c = kxNew("오늘의 주요 뉴스", "핵심만 " + N.length + "개 기사", p + 1, total), g = c.g, items = N.slice(p * per, p * per + per), h = Math.floor((KX.H - 60 - c.y - 10) / per);
    items.forEach(function (it, i) {
      var y = c.y + i * h, no = p * per + i + 1, col = KX_CAT[String(it.cat || "").slice(0, 3)] || KX_CAT[Object.keys(KX_CAT).filter(function (k) { return String(it.cat || "").indexOf(k) >= 0; })[0]] || "#4b5563";
      cRound(g, KX.P, y, KX.W - KX.P * 2, h - 16, 18, KX.box, KX.line);
      cRound(g, KX.P + 22, y + 22, 58, 40, 10, KX.up); cText(g, String(no), KX.P + 51, y + 51, 26, 900, "#fff", "center");
      var cat = String(it.cat || "뉴스").slice(0, 6), cw = cW(g, cat, 17, 800) + 28; cRound(g, KX.P + 92, y + 26, cw, 32, 8, col); cText(g, cat, KX.P + 92 + cw / 2, y + 49, 17, 800, "#fff", "center");
      if (it.press) cText(g, cFit(g, String(it.press), 220, 16, 600), KX.W - KX.P - 22, y + 49, 16, 600, KX.sub, "right");
      var y2 = cWrap(g, String(it.title || ""), KX.P + 22, y + 104, KX.W - KX.P * 2 - 44, 31, 900, KX.ink, 38, 2);
      (it.pts || []).slice(0, 3).forEach(function (pt, k) { cText(g, "•", KX.P + 26, y2 + 8 + k * 30, 20, 800, KX.gold); cText(g, cFit(g, String(pt), KX.W - KX.P * 2 - 70, 20, 600), KX.P + 48, y2 + 8 + k * 30, 20, 600, "#2a2f3a"); });
    });
    kxFoot(c, "기사 요약 · 출처 각 언론사 · 투자 권유 아님"); out.push({ name: "뉴스" + (p + 1), cv: c.cv });
  }
  if (PT.length) {
    var c2 = kxNew("오늘의 핵심 포인트", PT.length + "가지", total, total), g2 = c2.g, hh = Math.floor((KX.H - 60 - c2.y - 10) / PT.length);
    PT.forEach(function (pt, i) { var y = c2.y + i * hh; cRound(g2, KX.P, y, KX.W - KX.P * 2, hh - 16, 18, i % 2 ? KX.box : KX.soft, KX.line); cRound(g2, KX.P + 22, y + hh / 2 - 30, 44, 44, 22, KX.gold); cText(g2, "✓", KX.P + 44, y + hh / 2 + 5, 24, 900, KX.ink, "center"); cText(g2, cFit(g2, String(pt.t || ""), 300, 30, 900), KX.P + 86, y + hh / 2 - 6, 30, 900, KX.ink); cWrap(g2, String(pt.d || ""), KX.P + 86, y + hh / 2 + 30, KX.W - KX.P * 2 - 120, 21, 600, KX.sub, 27, 2); });
    kxFoot(c2, "오늘 브리핑 정리 · 투자 권유 아님"); out.push({ name: "핵심포인트", cv: c2.cv });
  }
  return out;
}
/* ---------- 2) 섹터별 주도주 ---------- */
function krxSectorDeck() {
  var K = KRX.data || krxCached(); if (!K) throw new Error("국내 마감 자료를 아직 못 받았어요");
  var S = krxSectors(K, 6); if (!S.length) throw new Error("급등 상위 자료가 없어요 (네이버 끝점 변경?) — " + (K.miss || []).join(" / "));
  var per = 6, pages = 1, out = [], ik = K.index && K.index.kospi, iq = K.index && K.index.kosdaq;
  var head = (ik && ik.ret != null ? "코스피 " + krxPct(ik.ret) : "") + (iq && iq.ret != null ? " · 코스닥 " + krxPct(iq.ret) : "");
  for (var p = 0; p < pages; p++) {
    var c = kxNew("오늘의 주도 섹터", head || "업종별 급등 상위", p + 1, pages), g = c.g, L = S.slice(p * per, p * per + per), cols = 2, gap = 20, bw = (KX.W - KX.P * 2 - gap) / cols, bh = Math.floor((KX.H - 60 - c.y - 10 - gap * 2) / 3);
    L.forEach(function (s, i) {
      var x = KX.P + (i % cols) * (bw + gap), y = c.y + Math.floor(i / cols) * (bh + gap); cRound(g, x, y, bw, bh, 20, KX.box, KX.line);
      cRound(g, x + 20, y + 18, cW(g, s.name, 24, 900) + 36, 40, 10, KX.ink); cText(g, s.name, x + 38, y + 46, 24, 900, KX.gold);
      cText(g, s.uni ? "평균 " + usPct(s.avg) + " · 오른 종목 " + s.up + "/" + s.n : s.n + "종목", x + bw - 20, y + 46, 16, 700, s.uni ? KX.up : KX.sub, "right");
      var yy = y + 78; if (s.why) { yy = cWrap(g, s.why, x + 20, yy + 4, bw - 40, 17, 600, KX.up, 22, 2) + 6; } else yy += 8;
      var rows = s.items.slice(0, 5), rh = Math.min(66, Math.floor((y + bh - 16 - yy) / Math.max(1, rows.length))), fs = rh >= 56 ? 27 : 23;
      rows.forEach(function (it, k) { var ry = yy + k * rh + rh / 2 + 8; cText(g, cFit(g, it.name, bw - 190, fs, 800), x + 20, ry, fs, 800, KX.ink); cText(g, krxPct(it.ret), x + bw - 20, ry, fs + 1, 900, it.ret >= 29.5 ? "#d9480f" : KX.up, "right"); g.fillStyle = KX.line; g.fillRect(x + 20, ry + 14, bw - 40, 1); });
    });
    kxFoot(c, "네이버 증권 급등 상위(코스피·코스닥) · 업종은 네이버 분류 · 이유는 Claude 정리 · 투자 권유 아님"); out.push({ name: "섹터" + (p + 1), cv: c.cv });
  }
  return out;
}
/* ---------- 3) 수급 ---------- */
function krxFlowDeck() {
  var K = KRX.data || krxCached(); if (!K) throw new Error("국내 마감 자료를 아직 못 받았어요");
  var I = K.investor || {}, ik = K.index && K.index.kospi, iq = K.index && K.index.kosdaq, out = [];
  var has = function (a, b) { return I[a] && I[a][b] && I[a][b].length; };
  if (!has("foreign", "buy") && !has("inst", "buy")) throw new Error("외국인·기관 순매매 자료를 못 읽었어요 — " + (K.miss || []).filter(function (m) { return /investor/.test(m); }).join(" / "));
  [["buy", "순매수 상위"], ["sell", "순매도 상위"]].forEach(function (t, pi) {
    var c = kxNew("주체별 " + t[1], "외국인 · 기관 (금액 기준)", pi + 1, 2), g = c.g, y0 = c.y;
    // 지수 수급 머리
    if (ik && (ik.foreign != null || ik.indiv != null)) { cRound(g, KX.P, y0, KX.W - KX.P * 2, 64, 14, KX.soft); var parts = [["코스피", ik], ["코스닥", iq]].filter(function (p) { return p[1] && (p[1].foreign != null); }).map(function (p) { return p[0] + " 개인 " + krxEok(p[1].indiv) + " · 외국인 " + krxEok(p[1].foreign) + " · 기관 " + krxEok(p[1].inst); }); cText(g, cFit(g, parts.join("   |   "), KX.W - KX.P * 2 - 40, 19, 700), KX.W / 2, y0 + 40, 19, 700, KX.ink, "center"); y0 += 84; }
    var cols = [["외국인 " + t[1], (I.foreign || {})[t[0]] || []], ["기관 " + t[1], (I.inst || {})[t[0]] || []]], gap = 20, bw = (KX.W - KX.P * 2 - gap) / 2, bh = KX.H - 60 - y0 - 12;
    cols.forEach(function (col, i) {
      var x = KX.P + i * (bw + gap); cRound(g, x, y0, bw, bh, 20, KX.box, KX.line); g.fillStyle = t[0] === "buy" ? KX.up : KX.dn; g.fillRect(x, y0 + 20, 6, 32); cText(g, col[0], x + 22, y0 + 46, 24, 900, KX.ink);
      cText(g, "백만원", x + bw - 20, y0 + 46, 15, 600, KX.sub, "right");
      var rows = col[1].slice(0, 12), rh = Math.floor((bh - 80) / 12);
      if (!rows.length) cText(g, "자료 없음", x + bw / 2, y0 + 140, 20, 700, KX.sub, "center");
      rows.forEach(function (r, k) { var ry = y0 + 80 + k * rh + rh / 2 + 7; cText(g, String(k + 1), x + 22, ry, 17, 700, KX.sub); cText(g, cFit(g, r.name + (r.mk === "kosdaq" ? " ᴷ" : ""), bw - 220, 22, 800), x + 50, ry, 22, 800, KX.ink); cText(g, r.amt != null ? Math.round(r.amt).toLocaleString() : "-", x + bw - 20, ry, 21, 800, t[0] === "buy" ? KX.up : KX.dn, "right"); if (r.ret != null) cText(g, krxPct(r.ret, 1), x + bw - 150, ry, 15, 600, r.ret >= 0 ? KX.up : KX.dn, "right"); g.fillStyle = KX.line; g.fillRect(x + 22, ry + 12, bw - 44, 1); });
    });
    kxFoot(c, "네이버 증권 투자자별 순매매 상위 · ᴷ는 코스닥 · 개인 상위는 제공되지 않아요 · 투자 권유 아님"); out.push({ name: t[0] === "buy" ? "순매수" : "순매도", cv: c.cv });
  });
  return out;
}
/* ---------- 4) 마감 한 장 ---------- */
function krxSpark(g, sym, x, y, w, h) {
  var r = typeof nbRecent === "function" ? nbRecent() : null, d = r && r.symbols && r.symbols[sym]; if (!d || !d.c || d.c.length < 5) return false;
  var c = d.c.slice(-22), mn = Math.min.apply(null, c), mx = Math.max.apply(null, c), up = c[c.length - 1] >= c[0];
  g.beginPath(); c.forEach(function (v, i) { var px = x + i / (c.length - 1) * w, py = y + h - (mx === mn ? h / 2 : (v - mn) / (mx - mn) * h); i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.strokeStyle = up ? KX.up : KX.dn; g.lineWidth = 4; g.lineJoin = "round"; g.stroke();
  g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fillStyle = up ? "rgba(192,59,59,0.10)" : "rgba(36,86,183,0.10)"; g.fill();
  return true;
}
function krxCloseDeck() {
  var K = KRX.data || krxCached(); if (!K) throw new Error("국내 마감 자료를 아직 못 받았어요");
  var c = kxNew("오늘의 간단 시황", "국내 마감", 1, 1), g = c.g, y = c.y, st = function (s) { return typeof nbStat === "function" ? nbStat(s) : null; }, RK = krFrame();
  var boxes = [["코스피", "^KS11", K.index && K.index.kospi], ["코스닥", "^KQ11", K.index && K.index.kosdaq]], gap = 20, bw = (KX.W - KX.P * 2 - gap) / 2, bh = 430;
  cText(g, "시장 마감", KX.P, y + 6, 22, 900, KX.ink); g.fillStyle = KX.gold; g.fillRect(KX.P, y + 16, 110, 4); y += 40;
  boxes.forEach(function (b, i) {
    var x = KX.P + i * (bw + gap), S = st(b[1]), ix = b[2] || {}, close = ix.close != null ? ix.close : S ? S.last : null, ret = ix.ret != null ? ix.ret / 100 : S ? S.ret1 : null;
    cRound(g, x, y, bw, bh, 20, KX.box, KX.line); cText(g, b[0], x + 22, y + 44, 24, 900, KX.ink);
    if (close != null) cText(g, close.toLocaleString(undefined, { maximumFractionDigits: 2 }), x + 22, y + 96, 40, 900, KX.ink);
    if (ret != null) cText(g, (ret >= 0 ? "▲ " : "▼ ") + cPct(ret, 2), x + bw - 22, y + 96, 26, 900, ret >= 0 ? KX.up : KX.dn, "right");
    if (!krxSpark(g, b[1], x + 22, y + 120, bw - 44, 120)) cText(g, "최근 흐름 자료 없음", x + bw / 2, y + 190, 18, 600, KX.sub, "center"); else cText(g, "최근 20일", x + bw - 22, y + 118, 14, 600, KX.sub, "right");
    var ry = y + 282, rows = [];
    if (ix.indiv != null || ix.foreign != null) rows.push(["개인", krxEok(ix.indiv), ix.indiv], ["외국인", krxEok(ix.foreign), ix.foreign], ["기관", krxEok(ix.inst), ix.inst]);
    var cnt = ix.up != null ? [["상승", String(ix.up) + (ix.upLimit ? "(" + ix.upLimit + ")" : ""), 1], ["보합", String(ix.flat == null ? "-" : ix.flat), 0], ["하락", String(ix.down) + (ix.downLimit ? "(" + ix.downLimit + ")" : ""), -1]] : [];
    if (!cnt.length && RK && RK.temp && i === 0 && RK.temp.total) { var tt = RK.temp; cnt = [["오른 종목", Math.round(tt.upPct * 100) + "% (" + tt.up + "/" + tt.total + ")", 1], ["20일선 위", (tt.abovePct != null && isFinite(tt.abovePct) ? Math.round(tt.abovePct * 100) + "%" : "-"), 0], ["52주 신고가", (tt.newHigh || []).length + " · 신저가 " + (tt.newLow || []).length, 0]]; cText(g, "코스피200 기준", x + bw - 22, y + bh - 14, 12, 600, KX.sub, "right"); }
    if (!rows.length) { var sk = st(b[1]); if (sk) rows = [["1개월", cPct(sk.m1, 1), sk.m1], ["1년", cPct(sk.y1 != null ? sk.y1 : 0, 1), sk.y1], ["고점 대비", cPct(sk.vsHi, 1), sk.vsHi]]; }
    if (!rows.length && !cnt.length) cText(g, "수급 · 등락 종목 수 자료 없음", x + 22, ry + 30, 17, 600, KX.sub);
    rows.forEach(function (r, k) { cText(g, r[0], x + 22, ry + k * 34 + 24, 18, 600, KX.sub); cText(g, r[1], x + 170, ry + k * 34 + 24, 20, 800, r[2] == null ? KX.sub : r[2] >= 0 ? KX.up : KX.dn, "right"); });
    cnt.forEach(function (r, k) { cText(g, r[0], x + bw / 2 + 30, ry + k * 34 + 24, 18, 600, KX.sub); cText(g, r[1], x + bw - 22, ry + k * 34 + 24, 20, 800, r[2] > 0 ? KX.up : r[2] < 0 ? KX.dn : KX.sub, "right"); });
    if (ix.amount != null) cText(g, "거래대금 " + krxEok(ix.amount).replace(/^\+/, ""), x + bw - 22, y + 44, 15, 600, KX.sub, "right");
  });
  y += bh + 36;
  cText(g, "핫테마", KX.P, y + 6, 22, 900, KX.ink); g.fillStyle = KX.gold; g.fillRect(KX.P, y + 16, 80, 4); y += 40;
  var I = K.investor || {}, hasInv = I.foreign && I.foreign.buy && I.foreign.buy.length, mvK = RK && RK.movers || { up: [], down: [] }, hasMv = !hasInv && (mvK.up.length || mvK.down.length || (RK && (RK.hotVol || []).length)), S = krxSectors(K, 3), cw = (KX.W - KX.P * 2 - gap * 2) / 3;
  var maxRows = Math.max.apply(null, [3].concat(S.map(function (x) { return Math.min(6, x.items.length); }))), rh = 54, ch = Math.min(KX.H - 60 - y - 12 - (hasInv || hasMv ? 190 : 0), 96 + maxRows * rh + 14);
  if (!S.length) cText(g, "급등 상위 자료 없음", KX.W / 2, y + 100, 20, 700, KX.sub, "center");
  S.forEach(function (s, i) {
    var x = KX.P + i * (cw + gap); cRound(g, x, y, cw, ch, 20, KX.box, KX.line); cRound(g, x + 20, y + 18, cw - 40, 44, 10, KX.ink); cText(g, cFit(g, s.name, cw - 60, 22, 900), x + cw / 2, y + 48, 22, 900, KX.gold, "center");
    var yy = y + 80; if (s.why) yy = cWrap(g, s.why, x + 18, yy + 2, cw - 36, 15, 600, KX.sub, 20, 2) + 4;
    var rows = s.items.slice(0, 6), rr = Math.min(rh, Math.floor((y + ch - 14 - yy) / Math.max(1, rows.length)));
    rows.forEach(function (it, k) { var ry = yy + k * rr + rr / 2 + 7; cText(g, cFit(g, it.name, cw - 150, 21, 800), x + 18, ry, 21, 800, KX.ink); cText(g, "(" + krxPct(it.ret) + ")", x + cw - 18, ry, 20, 800, KX.up, "right"); g.fillStyle = KX.line; g.fillRect(x + 18, ry + 12, cw - 36, 1); });
  });
  y += ch + 30;
  /* 남는 자리에 수급 상위 — 외국인·기관 순매수 · 외국인 순매도 (자료 있을 때만) */
  if (!hasInv && hasMv && KX.H - 60 - y > 130) {   // 수급 자료가 없으면 앱 데이터로 급등·급락·거래대금 급증
    cText(g, "급등 · 급락 · 거래대금 급증", KX.P, y + 6, 22, 900, KX.ink); g.fillStyle = KX.gold; g.fillRect(KX.P, y + 16, 90, 4); y += 36;
    var cols2 = [["급등", mvK.up, KX.up], ["급락", mvK.down, KX.dn], ["거래대금 급증", (RK && RK.hotVol) || [], KX.ink]], hh2 = KX.H - 60 - y - 10, nrow2 = Math.max(2, Math.min(4, Math.floor((hh2 - 50) / 30)));
    cols2.forEach(function (col, i) { var x = KX.P + i * (cw + gap); cRound(g, x, y, cw, hh2, 16, KX.soft); cText(g, col[0], x + 16, y + 30, 17, 900, col[2]); col[1].slice(0, nrow2).forEach(function (r, k) { var ry = y + 58 + k * 30, nm = typeof briefName === "function" ? briefName(r) : (r.name || r.sym); cText(g, cFit(g, nm, cw - 120, 16, 700), x + 16, ry, 16, 700, KX.ink); cText(g, col[0] === "거래대금 급증" ? (r.amtX ? r.amtX.toFixed(1) + "배" : cPct(r.ret, 2)) : cPct(r.ret, 2), x + cw - 16, ry, 15, 800, col[2] === KX.ink ? KX.sub : col[2], "right"); }); });
  }
  if (hasInv && KX.H - 60 - y > 150) {
    cText(g, "수급 상위", KX.P, y + 6, 22, 900, KX.ink); g.fillStyle = KX.gold; g.fillRect(KX.P, y + 16, 90, 4); y += 36;
    var cols = [["외국인 순매수", (I.foreign || {}).buy || [], KX.up], ["기관 순매수", (I.inst || {}).buy || [], KX.up], ["외국인 순매도", (I.foreign || {}).sell || [], KX.dn]], hh = KX.H - 60 - y - 10, nrow = Math.max(3, Math.min(5, Math.floor((hh - 50) / 32)));
    cols.forEach(function (col, i) { var x = KX.P + i * (cw + gap); cRound(g, x, y, cw, hh, 16, KX.soft); cText(g, col[0], x + 16, y + 30, 17, 900, col[2]); cText(g, "백만원", x + cw - 16, y + 30, 12, 600, KX.sub, "right"); col[1].slice(0, nrow).forEach(function (r, k) { var ry = y + 58 + k * 32; cText(g, cFit(g, (k + 1) + " " + r.name, cw - 130, 17, 700), x + 16, ry, 17, 700, KX.ink); cText(g, r.amt != null ? Math.round(Math.abs(r.amt)).toLocaleString() : "-", x + cw - 16, ry, 16, 800, col[2], "right"); }); });
  }
  kxFoot(c, "네이버 증권 · 야후 파이낸스 종가 · 본 자료는 주가에 대한 판단이나 투자 권유를 포함하지 않습니다");
  return [{ name: "마감한장", cv: c.cv }];
}
/* ---------- 한글 표기 — 사전(TICKER_DICT)에 있으면 그 이름, 없으면 널리 쓰는 표기만 손으로, 그 밖엔 영문 그대로(어색한 번역 금지) ---------- */
var US_SEC_KO = { "Information Technology": "IT", "Health Care": "헬스케어", "Financials": "금융", "Consumer Discretionary": "경기소비재", "Communication Services": "커뮤니케이션", "Industrials": "산업재", "Consumer Staples": "필수소비재", "Energy": "에너지", "Utilities": "유틸리티", "Real Estate": "부동산", "Materials": "소재" };
var US_KO = { AAPL: "애플", MSFT: "마이크로소프트", NVDA: "엔비디아", AMZN: "아마존", GOOGL: "알파벳", GOOG: "알파벳", META: "메타", TSLA: "테슬라", AVGO: "브로드컴", "BRK-B": "버크셔해서웨이", LLY: "일라이릴리", JPM: "JP모건", V: "비자", MA: "마스터카드", UNH: "유나이티드헬스", XOM: "엑슨모빌", JNJ: "존슨앤드존슨", PG: "P&G", COST: "코스트코", HD: "홈디포", ABBV: "애브비", WMT: "월마트", NFLX: "넷플릭스", KO: "코카콜라", PEP: "펩시코", BAC: "뱅크오브아메리카", ORCL: "오라클", CRM: "세일즈포스", CVX: "셰브론", AMD: "AMD", MRK: "머크", ADBE: "어도비", CSCO: "시스코", TMO: "서모피셔", ACN: "액센츄어", MCD: "맥도날드", LIN: "린데", ABT: "애보트", DIS: "디즈니", WFC: "웰스파고", TXN: "텍사스인스트루먼트", INTU: "인튜이트", QCOM: "퀄컴", CAT: "캐터필러", GE: "GE", AMGN: "암젠", IBM: "IBM", VZ: "버라이즌", PFE: "화이자", INTC: "인텔", NOW: "서비스나우", GS: "골드만삭스", MS: "모건스탠리", AXP: "아메리칸익스프레스", UBER: "우버", BKNG: "부킹홀딩스", SPGI: "S&P글로벌", RTX: "RTX", HON: "하니웰", LOW: "로우스", UNP: "유니온퍼시픽", NKE: "나이키", SBUX: "스타벅스", BA: "보잉", LMT: "록히드마틴", DE: "디어", PM: "필립모리스", MO: "알트리아", T: "AT&T", TMUS: "T모바일", CMCSA: "컴캐스트", PYPL: "페이팔", ADP: "ADP", BLK: "블랙록", SCHW: "찰스슈왑", C: "씨티그룹", GILD: "길리어드", ISRG: "인튜이티브서지컬", VRTX: "버텍스", REGN: "리제네론", BMY: "BMS", MDT: "메드트로닉", DHR: "다나허", SYK: "스트라이커", ELV: "엘리번스", CI: "시그나", CVS: "CVS", MU: "마이크론", AMAT: "어플라이드머티리얼즈", LRCX: "램리서치", KLAC: "KLA", ADI: "아나로그디바이스", PANW: "팔로알토", CRWD: "크라우드스트라이크", PLTR: "팔란티어", ANET: "아리스타", SNPS: "시놉시스", CDNS: "케이던스", MRVL: "마벨", DASH: "도어대시", CVNA: "카바나", ABNB: "에어비앤비", MAR: "메리어트", HLT: "힐튼", GM: "GM", F: "포드", TJX: "TJX", TGT: "타겟", DG: "달러제너럴", DLTR: "달러트리", HSY: "허쉬", MDLZ: "몬델리즈", KHC: "크래프트하인즈", GIS: "제너럴밀스", CL: "콜게이트", KMB: "킴벌리클라크", STZ: "컨스텔레이션브랜즈", "BF-B": "브라운포맨", SHW: "셔윈윌리엄스", PPG: "PPG", APD: "에어프로덕츠", ECL: "에코랩", NEM: "뉴몬트", FCX: "프리포트맥모란", NUE: "뉴코어", CRH: "CRH", MOS: "모자이크", AMCR: "암코어", COP: "코노코필립스", SLB: "슐럼버거", EOG: "EOG", OXY: "옥시덴탈", NEE: "넥스트에라", DUK: "듀크에너지", SO: "서던컴퍼니", CEG: "컨스텔레이션에너지", VST: "비스트라", PLD: "프로로지스", AMT: "아메리칸타워", EQIX: "에퀴닉스", CBRE: "CBRE", CSGP: "코스타", WY: "웨어하우저", EXR: "엑스트라스페이스", ARE: "알렉산드리아", PH: "파커하니핀", ETN: "이튼", EMR: "에머슨", GD: "제너럴다이내믹스", NOC: "노스롭그루먼", UPS: "UPS", FDX: "페덱스", DAL: "델타항공", UAL: "유나이티드항공", AAL: "아메리칸항공", HWM: "하우멧", PNR: "펜테어", CPRT: "코파트", TDG: "트랜스다임", XYL: "자일럼", FAST: "패스널", WM: "웨이스트매니지먼트", CTAS: "신타스", PAYX: "페이첵스", KKR: "KKR", BX: "블랙스톤", FDS: "팩트셋", MCO: "무디스", MSCI: "MSCI", ICE: "ICE", CME: "CME", CBOE: "Cboe", FIS: "FIS", FI: "파이서브", COF: "캐피털원", USB: "US뱅코프", PNC: "PNC", TFC: "트루이스트", AIG: "AIG", MET: "메트라이프", PRU: "푸르덴셜", TRV: "트래블러스", PGR: "프로그레시브", ALL: "올스테이트", ERIE: "에리인뎀니티", LULU: "룰루레몬", CMG: "치폴레", YUM: "얌브랜즈", EBAY: "이베이", ETSY: "엣시", EA: "EA", TTWO: "테이크투", WBD: "워너브라더스디스커버리", PARA: "파라마운트", CHTR: "차터", LUMN: "루멘", CIEN: "시에나", IDXX: "아이덱스", ZTS: "조에티스", MRNA: "모더나", BIIB: "바이오젠", HCA: "HCA", CNC: "센틴", HUM: "휴매나", DXCM: "덱스컴", EW: "에드워즈", BSX: "보스턴사이언티픽", PHM: "풀티그룹", DHI: "DR호턴", LEN: "레나", NVR: "NVR", GPN: "글로벌페이먼츠", EL: "에스티로더", NCLH: "노르웨이지안크루즈", CCL: "카니발", RCL: "로열캐리비안", LVS: "라스베이거스샌즈", WYNN: "윈리조트", MGM: "MGM", SMCI: "슈퍼마이크로", ON: "온세미", NXPI: "NXP", MCHP: "마이크로칩", TER: "테라다인", FSLR: "퍼스트솔라", ENPH: "엔페이즈" };
function usKo(name, sym) { var k = sym ? String(sym).replace(/\./g, "-") : ""; if (k && typeof BRIEF_KO !== "undefined" && BRIEF_KO[k]) return BRIEF_KO[k]; if (k && US_KO[k]) return US_KO[k]; return String(name || sym || ""); }
function usSecKo(sec) { return US_SEC_KO[sec] || sec; }
/* ---------- 미국 마감 — S&P500 유니버스(섹터 포함)로 ---------- */
function usFrame() { var F = typeof smMkFrame === "function" ? smMkFrame("us") : null; return F && F.R ? F.R : null; }
function usSectors(R, n) {
  var S = (R && R.uniStocks) || []; if (!S.length) return [];
  var by = {}; S.forEach(function (x) { if (x.ret == null || !isFinite(x.ret)) return; var k = usSecKo(x.sec || "기타"); (by[k] = by[k] || []).push(Object.assign({}, x, { name: usKo(x.name, x.sym) })); });
  var out = Object.keys(by).map(function (k) { var L = by[k].slice().sort(function (a, b) { return b.ret - a.ret; }), avg = L.reduce(function (a, x) { return a + x.ret; }, 0) / L.length, up = L.filter(function (x) { return x.ret > 0; }).length; return { name: k, items: L, n: L.length, avg: avg, up: up, score: avg * 100 + up / L.length }; }).filter(function (x) { return x.n >= 3; });
  out.sort(function (a, b) { return b.score - a.score; });
  var F = krxFull(), W = {}; ((F && F.data && F.data.sectors) || []).forEach(function (s) { W[s.name] = s; });
  out.forEach(function (s) { var w = W[s.name]; s.why = w ? w.why : ""; });
  return out.slice(0, n || 6);
}
function usPct(v) { return v == null ? "-" : (v > 0 ? "+" : "") + (v * 100).toFixed(2) + "%"; }
function usSectorDeck() {
  var R = usFrame(); if (!R) throw new Error("미국 시장 데이터를 아직 준비하는 중이에요");
  var S = usSectors(R, 6); if (!S.length) throw new Error("S&P500 유니버스 요약이 없어요 — 데이터 센터에서 'S&P 500 요약 지금 받기'");
  var idx = (R.indexRow || []).filter(function (x) { return /GSPC|IXIC|DJI/.test(x.sym); }).map(function (x) { return x.name + " " + usPct(x.ret); }).join(" · ");
  var c = kxNew("미국 주도 섹터 — S&P500", idx || "섹터별 평균 등락", 1, 1, "미국 마감"), g = c.g, cols = 2, gap = 20, bw = (KX.W - KX.P * 2 - gap) / cols, bh = Math.floor((KX.H - 60 - c.y - 10 - gap * 2) / 3);
  S.forEach(function (s, i) {
    var x = KX.P + (i % cols) * (bw + gap), y = c.y + Math.floor(i / cols) * (bh + gap), col = s.avg >= 0 ? KX.up : KX.dn; cRound(g, x, y, bw, bh, 20, KX.box, KX.line);
    cRound(g, x + 20, y + 18, cW(g, s.name, 22, 900) + 36, 40, 10, KX.ink); cText(g, s.name, x + 38, y + 46, 22, 900, KX.gold);
    cText(g, "평균 " + usPct(s.avg) + " · 오른 종목 " + s.up + "/" + s.n, x + bw - 20, y + 46, 16, 700, col, "right");
    var yy = y + 78; if (s.why) yy = cWrap(g, s.why, x + 20, yy + 4, bw - 40, 16, 600, KX.up, 21, 2) + 6; else yy += 6;
    var rows = s.items.slice(0, 5), rh = Math.min(62, Math.floor((y + bh - 16 - yy) / Math.max(1, rows.length))), fs = rh >= 54 ? 25 : 21;
    rows.forEach(function (it, k) { var ry = yy + k * rh + rh / 2 + 8; cText(g, cFit(g, it.name + " ", bw - 200, fs, 800), x + 20, ry, fs, 800, KX.ink); cText(g, usPct(it.ret), x + bw - 20, ry, fs, 900, it.ret >= 0 ? KX.up : KX.dn, "right"); g.fillStyle = KX.line; g.fillRect(x + 20, ry + 14, bw - 40, 1); });
  });
  kxFoot(c, "S&P500 전 종목 · 야후 파이낸스 종가 · 섹터는 GICS · 투자 권유 아님"); return [{ name: "미국섹터", cv: c.cv }];
}
function usCloseDeck() {
  var R = usFrame(); if (!R) throw new Error("미국 시장 데이터를 아직 준비하는 중이에요");
  var c = kxNew("오늘의 간단 시황 — 미국", "S&P500 · 나스닥 · 다우", 1, 1, "미국 마감"), g = c.g, y = c.y, st = function (s) { return typeof nbStat === "function" ? nbStat(s) : null; }, gap = 20;
  cText(g, "시장 마감", KX.P, y + 6, 22, 900, KX.ink); g.fillStyle = KX.gold; g.fillRect(KX.P, y + 16, 110, 4); y += 40;
  var boxes = [["S&P500", "^GSPC"], ["나스닥", "^IXIC"], ["다우", "^DJI"]], bw = (KX.W - KX.P * 2 - gap * 2) / 3, bh = 330, t = R.temp;
  boxes.forEach(function (b, i) {
    var x = KX.P + i * (bw + gap), S = st(b[1]); cRound(g, x, y, bw, bh, 20, KX.box, KX.line); cText(g, b[0], x + 18, y + 40, 22, 900, KX.ink);
    if (S) { cText(g, S.last.toLocaleString(undefined, { maximumFractionDigits: 2 }), x + 18, y + 86, 32, 900, KX.ink); cText(g, (S.ret1 >= 0 ? "▲ " : "▼ ") + usPct(S.ret1), x + bw - 18, y + 86, 20, 900, S.ret1 >= 0 ? KX.up : KX.dn, "right"); }
    if (!krxSpark(g, b[1], x + 18, y + 106, bw - 36, 100)) cText(g, "흐름 자료 없음", x + bw / 2, y + 160, 16, 600, KX.sub, "center");
    if (S) { cText(g, "1개월 " + usPct(S.m1), x + 18, y + 246, 16, 600, KX.sub); cText(g, "고점 대비 " + usPct(S.vsHi), x + bw - 18, y + 246, 16, 600, KX.sub, "right"); cText(g, "1년 " + usPct(S.y1), x + 18, y + 274, 16, 600, KX.sub); cText(g, "20일선 " + (S.above20 ? "위" : "아래") + " · 200일선 " + (S.above200 == null ? "-" : S.above200 ? "위" : "아래"), x + bw - 18, y + 274, 16, 600, KX.sub, "right"); }
  });
  y += bh + 20;
  // 폭 · 변수 띠
  var vix = st("^VIX"), dxy = st("DX-Y.NYB"), krw = st("KRW=X"), tlt = st("TLT"), chips = [];
  if (t && t.upPct != null && isFinite(t.upPct)) chips.push(["오른 종목", Math.round(t.upPct * 100) + "%", "(" + t.up + "/" + t.total + ")"]); if (t && t.abovePct != null && isFinite(t.abovePct)) chips.push(["20일선 위", Math.round(t.abovePct * 100) + "%", ""]); if (t && (t.newHigh || []).length) chips.push(["52주 신고가", (t.newHigh || []).length + "개", "신저가 " + (t.newLow || []).length]);
  if (vix) chips.push(["VIX", vix.last.toFixed(1), vix.last >= 30 ? "공포" : vix.last >= 20 ? "주의" : "평온"]); if (dxy) chips.push(["달러인덱스", dxy.last.toFixed(1), "1개월 " + usPct(dxy.m1)]); if (krw) chips.push(["원/달러", Math.round(krw.last).toLocaleString(), "1개월 " + usPct(krw.m1)]); if (tlt) chips.push(["장기채 TLT", usPct(tlt.ret1), "1개월 " + usPct(tlt.m1)]);
  if (chips.length) { var cw0 = (KX.W - KX.P * 2 - 12 * (Math.min(chips.length, 7) - 1)) / Math.min(chips.length, 7); chips.slice(0, 7).forEach(function (ch, i) { var x = KX.P + i * (cw0 + 12); cRound(g, x, y, cw0, 92, 14, KX.soft); cText(g, cFit(g, ch[0], cw0 - 16, 14, 700), x + cw0 / 2, y + 26, 14, 700, KX.sub, "center"); cText(g, cFit(g, ch[1], cw0 - 16, 26, 900), x + cw0 / 2, y + 58, 26, 900, KX.ink, "center"); cText(g, cFit(g, ch[2], cw0 - 16, 13, 600), x + cw0 / 2, y + 80, 13, 600, KX.sub, "center"); }); y += 92 + 24; }
  // 핫섹터 3열
  cText(g, "핫섹터", KX.P, y + 6, 22, 900, KX.ink); g.fillStyle = KX.gold; g.fillRect(KX.P, y + 16, 80, 4); y += 40;
  var S = usSectors(R, 3), cw = (KX.W - KX.P * 2 - gap * 2) / 3, mv = R.movers || { up: [], down: [] }, hasMv = mv.up.length || mv.down.length, ch = Math.min(KX.H - 60 - y - 12 - (hasMv ? 170 : 0), 96 + 5 * 50 + 14);
  if (!S.length) cText(g, "S&P500 유니버스 요약 없음 — 데이터 센터에서 받기", KX.W / 2, y + 60, 18, 700, KX.sub, "center");
  S.forEach(function (s, i) { var x = KX.P + i * (cw + gap); cRound(g, x, y, cw, ch, 20, KX.box, KX.line); cRound(g, x + 18, y + 16, cw - 36, 42, 10, KX.ink); cText(g, cFit(g, s.name, cw - 60, 20, 900), x + cw / 2, y + 45, 20, 900, KX.gold, "center"); cText(g, "평균 " + usPct(s.avg), x + cw / 2, y + 80, 15, 700, s.avg >= 0 ? KX.up : KX.dn, "center"); var yy = y + 96, rows = s.items.slice(0, 5), rr = Math.min(50, Math.floor((y + ch - 12 - yy) / Math.max(1, rows.length))); rows.forEach(function (it, k) { var ry = yy + k * rr + rr / 2 + 6; cText(g, cFit(g, it.name, cw - 140, 19, 800), x + 16, ry, 19, 800, KX.ink); cText(g, usPct(it.ret), x + cw - 16, ry, 18, 800, it.ret >= 0 ? KX.up : KX.dn, "right"); g.fillStyle = KX.line; g.fillRect(x + 16, ry + 12, cw - 32, 1); }); });
  y += (S.length ? ch : 100) + 28;
  if (hasMv && KX.H - 60 - y > 130) {
    cText(g, "급등 · 급락 · 거래대금 급증", KX.P, y + 6, 22, 900, KX.ink); g.fillStyle = KX.gold; g.fillRect(KX.P, y + 16, 90, 4); y += 36;
    var cols = [["급등", mv.up, KX.up], ["급락", mv.down, KX.dn], ["거래대금 급증", R.hotVol || [], KX.ink]], hh = KX.H - 60 - y - 10, nrow = Math.max(2, Math.min(4, Math.floor((hh - 50) / 30)));
    cols.forEach(function (col, i) { var x = KX.P + i * (cw + gap); cRound(g, x, y, cw, hh, 16, KX.soft); cText(g, col[0], x + 16, y + 30, 17, 900, col[2]); col[1].slice(0, nrow).forEach(function (r, k) { var ry = y + 58 + k * 30; var nm = usKo(typeof briefName === "function" ? briefName(r) : (r.name || r.sym), r.sym); cText(g, cFit(g, nm, cw - 120, 16, 700), x + 16, ry, 16, 700, KX.ink); cText(g, col[0] === "거래대금 급증" ? (r.amtX ? r.amtX.toFixed(1) + "배" : usPct(r.ret)) : usPct(r.ret), x + cw - 16, ry, 15, 800, col[2] === KX.ink ? KX.sub : col[2], "right"); }); });
  }
  kxFoot(c, "야후 파이낸스 종가 · S&P500 전 종목 폭 · 본 자료는 주가에 대한 판단이나 투자 권유를 포함하지 않습니다"); return [{ name: "미국마감", cv: c.cv }];
}
/* ---------- 연구노트 목록·실행에 끼워 넣기 ---------- */
var KRX_DECKS = [
  { key: "kr-close", t: "🏁 오늘의 간단 시황 — 마감 한 장", d: "코스피·코스닥 종가·등락·20일 흐름 · 개인/외국인/기관 · 상승/하락 종목 수 · 핫테마 3열", fn: krxCloseDeck, need: "kr" },
  { key: "kr-sector", t: "🧭 오늘의 주도 섹터 — 업종별 급등 상위", d: "급등 상위(코스피·코스닥)를 업종으로 묶고 오늘 오른 이유 한 줄(브리핑) · 한 장에 6업종", fn: krxSectorDeck, need: "kr" },
  { key: "kr-flow", t: "💰 주체별 수급 — 외국인·기관 순매수·순매도", d: "외국인·기관 순매수/순매도 상위 12 · 지수 수급(개인·외국인·기관) · 개인 상위는 네이버 미제공", fn: krxFlowDeck, need: "kr" },
  { key: "us-close", t: "🇺🇸 오늘의 간단 시황 — 미국 마감 한 장", d: "S&P500·나스닥·다우 종가·등락·20일 흐름 · 오른 종목 비율 · VIX·달러·환율 · 핫섹터 3열 · 급등락", fn: usCloseDeck, need: "us" },
  { key: "us-sector", t: "🇺🇸 미국 주도 섹터 — S&P500 섹터별", d: "S&P500 전 종목을 GICS 섹터로 묶어 평균 등락·오른 비율·상위 5종목 · 한 장에 6섹터", fn: usSectorDeck, need: "us" },
  { key: "kr-news", t: "📰 오늘의 주요 뉴스 — 핵심만 13개", d: "오늘 브리핑(직접 질문)의 news 12~13개 + 핵심 포인트 5 · 한 장에 4개", fn: krxNewsDeck, need: "daily" }
];
(function () {
  if (typeof storyDecks !== "function") return;
  var d0 = storyDecks; storyDecks = function () { var out = d0.apply(this, arguments); var F = krxFull(), hasNews = !!(F && F.data && (F.data.news || []).length), K = KRX.data || krxCached(); KRX_DECKS.forEach(function (x, i) { out.splice(1 + i, 0, { key: x.key, t: x.t, d: x.d, now: true, ready: x.need === "kr" ? !!K : x.need === "us" ? !!usFrame() : hasNews, group: x.need === "us" ? "미국 마감" : "국내 마감" }); }); return out; };
  var r0 = storyReady; storyReady = function (kind) { if (/^(kr|us)-/.test(kind)) { var x = KRX_DECKS.filter(function (d) { return d.key === kind; })[0]; return x && x.need === "daily" ? !!(krxFull() && (krxFull().data.news || []).length) : x && x.need === "us" ? !!usFrame() : !!(KRX.data || krxCached()); } return r0.apply(this, arguments); };
  var p0 = storyPrepare; storyPrepare = function (key) { if (/^(kr|us)-/.test(key)) { var x = KRX_DECKS.filter(function (d) { return d.key === key; })[0]; var ps = [x && x.need === "kr" ? krxLoad(false).catch(function (e) { console.warn("kr", e); return null; }) : x && x.need === "us" && typeof dlUniLoad === "function" ? dlUniLoad("us").catch(function () { return null; }) : null, x && x.need === "kr" && typeof dlUniLoad === "function" ? dlUniLoad("kr").catch(function () { return null; }) : null]; if (typeof nbRecent === "function" && !nbRecent() && typeof fetchRecent === "function") ps.push(Promise.resolve(typeof dataReady === "function" ? dataReady() : null).then(function () { return fetchRecent(); }).then(function (r) { if (r && typeof briefState !== "undefined" && !briefState.recent) briefState.recent = r; }).catch(function () {})); return Promise.all(ps); } return p0.apply(this, arguments); };
  var c0 = storyCards; storyCards = function (key) { var x = KRX_DECKS.filter(function (d) { return d.key === key; })[0]; if (x) return x.fn(); return c0.apply(this, arguments); };
  if (typeof hubTitleOf === "function") { var t0 = hubTitleOf; hubTitleOf = function (ctx) { var x = KRX_DECKS.filter(function (d) { return "story:" + d.key === ctx; })[0]; return x ? x.t.replace(/^\S+\s/, "") : t0.apply(this, arguments); }; }
})();
/* 오늘 브리핑 프롬프트에 '국내 급등 상위(업종)'를 넣어 sectors.why 를 쓰게 한다 */
(function () { if (typeof smDailyInput !== "function") return; var i0 = smDailyInput; smDailyInput = function () { var s = i0.apply(this, arguments); try { var K = KRX.data || krxCached(); if (K) { var S = krxSectors(K, 8); if (S.length) s += "\n\n[국내 급등 상위 — 업종별 · 네이버] 업종 | 종목(등락률)\n" + S.map(function (x) { return "- " + x.name + " | " + x.items.slice(0, 5).map(function (it) { return it.name + "(" + krxPct(it.ret, 1) + ")"; }).join(", "); }).join("\n"); var I = K.investor || {}; var top = function (a, b) { return ((I[a] || {})[b] || []).slice(0, 5).map(function (r) { return r.name; }).join(", "); }; if (top("foreign", "buy")) s += "\n[수급 — 네이버] 외국인 순매수 상위: " + top("foreign", "buy") + " / 기관 순매수 상위: " + top("inst", "buy") + " / 외국인 순매도 상위: " + top("foreign", "sell"); } } catch (e) {} return s; }; })();
/* 오늘 브리핑 결과에 news · points · sectors 를 남긴다 (smDailyApply 는 data 에 여섯 가지만 담는다) */
(function () { if (typeof smDailyApply !== "function") return; var a0 = smDailyApply; smDailyApply = function (j, input) { var r = a0.apply(this, arguments); try { var D = j && j.data || {}, F = SM_DAILY.full; if (F && F.data) { F.data.news = D.news || []; F.data.points = D.points || []; F.data.sectors = D.sectors || []; localStorage.setItem("sm.dailyFull", JSON.stringify(Object.assign({}, F, { raw: "" }))); } } catch (e) {} return r; }; })();
/* 작업실 ① 데이터 확인에 '국내 마감 자료' 줄 */
(function () {
  if (typeof renderOps !== "function") return;
  var r0 = renderOps; renderOps = function () {
    var r = r0.apply(this, arguments);
    try {
      var step = document.querySelector('#opsBody .opsStep[data-step="data"] .opsStepBody'); if (!step || step.querySelector(".krxLine")) return r;
      var K = KRX.data || krxCached(), d = document.createElement("div"); d.className = "opsMk krxLine " + (K ? (K.miss && K.miss.length ? "warn" : "ok") : "");
      var n = K ? ((K.up.kospi || []).length + (K.up.kosdaq || []).length) : 0, inv = K && K.investor && K.investor.foreign && K.investor.foreign.buy ? K.investor.foreign.buy.length : 0, ix = K && K.index && K.index.kospi && (K.index.kospi.foreign != null || K.index.kospi.up != null);
      d.innerHTML = '<b>마감 자료</b><span>' + (K ? new Date(K.at).toTimeString().slice(0, 5) + " · 급등 " + n + " · 수급 " + inv + " · 지수 " + (ix ? "✓" : "✗") : "아직 안 받음") + '</span><em>' + (K && K.miss && K.miss.length ? '못 읽음 ' + K.miss.length + '칸' : K ? '정상' : '') + ' <button class="opsLink" data-krx>' + (K ? "다시 받기" : "받기") + '</button></em>';
      step.appendChild(d); d.querySelector("[data-krx]").onclick = function (ev) { ev.stopPropagation(); this.textContent = "받는 중…"; krxLoad(true).then(function (j) { smToast("국내 마감 자료 " + (j.miss && j.miss.length ? "일부만 " : "") + "받았어요" + (j.miss && j.miss.length ? " — " + j.miss.join(" / ") : "")); renderOps(); }).catch(function (e) { smToast("마감 자료 실패: " + e.message, "bad"); renderOps(); }); };
      if (K && K.miss && K.miss.length) { var m = document.createElement("div"); m.className = "opsMuted"; m.style.fontSize = "11.5px"; m.textContent = "못 읽은 칸: " + K.miss.join(" / "); step.appendChild(m); }
    } catch (e) { console.warn("krx ops", e); }
    return r;
  };
})();
/* 운영자면 하루 한 번 자동으로 받아 둔다 (장 마감 후) */
(function () { var tries = 0, go = function () { if (typeof isOwner === "function" && isOwner()) { var h = new Date(Date.now() + 9 * 3600e3).getUTCHours(); if (!krxCached() && h >= 16) krxLoad(false).catch(function () {}); return; } if (++tries < 10) setTimeout(go, 1500); }; setTimeout(go, 4000); })();
