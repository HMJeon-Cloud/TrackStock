/* ============================================================
   카드 뉴스 (v6.7) — 인스타·스레드용 1080×1350(4:5) 이미지
   한 장에 메시지 하나: 맨 위 큰 제목이 "이 카드가 말하려는 것", 아래는 그 근거 숫자만.
   오늘의 브리핑 5장 / 채널 브리핑 자료 5장. 데이터는 화면과 같은 계산 결과를 그대로 쓴다.
   ============================================================ */
var CARD = { W: 1080, H: 1350, PAD: 84 };
var CARD_C = { bg: "#f2f4f6", card: "#ffffff", txt: "#191f28", txt2: "#4e5968", sub: "#8b95a1", line: "#e5e8eb", up: "#f04452", down: "#3182f6", accent: "#3182f6", soft: "#f2f4f6", warm: "#fff4e6", warmTxt: "#b45309" };
var CARD_FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

function cPct(x, d) { if (x == null || !isFinite(x)) return "-"; d = d == null ? 1 : d; return (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%"; }
function cCol(x) { return x > 0 ? CARD_C.up : x < 0 ? CARD_C.down : CARD_C.sub; }
function cDate(ms) { var d = new Date(ms || Date.now()); return (d.getMonth() + 1) + "." + d.getDate() + "(" + "일월화수목금토"[d.getDay()] + ")"; }

/* ---------- 그리기 도구 ---------- */
function cNew() {
  var cv = document.createElement("canvas"); cv.width = CARD.W; cv.height = CARD.H;
  var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = CARD_C.bg; g.fillRect(0, 0, CARD.W, CARD.H);
  cRound(g, 40, 40, CARD.W - 80, CARD.H - 80, 48, CARD_C.card);
  return { cv: cv, g: g, y: 150 };
}
function cRound(g, x, y, w, h, r, fill) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fillStyle = fill; g.fill(); }
function cFont(g, size, weight) { g.font = (weight || 400) + " " + size + "px " + CARD_FONT; }
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
/* 머리: 작은 꼬리표 + 큰 제목(핵심 메시지) + 부제 */
function cHead(c, tag, title, sub, page, total) {
  var g = c.g, P = CARD.PAD;
  cFont(g, 30, 700); var tw = g.measureText(tag).width + 44;
  cRound(g, P, 96, tw, 56, 28, "#e8f3ff"); cText(g, tag, P + 22, 134, 30, 700, CARD_C.accent);
  if (page) cText(g, page + " / " + total, CARD.W - P, 134, 28, 600, CARD_C.sub, "right");
  var y = cWrap(g, title, P, 250, CARD.W - P * 2, 64, 800, CARD_C.txt, 84, 3);
  if (sub) y = cWrap(g, sub, P, y + 8, CARD.W - P * 2, 32, 400, CARD_C.txt2, 46, 3);
  c.y = y + 40;
}
function cFoot(c, note) {
  var g = c.g, P = CARD.PAD, y = CARD.H - 96;
  g.fillStyle = CARD_C.line; g.fillRect(P, y - 44, CARD.W - P * 2, 2);
  cText(g, "StockMind", P, y, 28, 800, CARD_C.accent);
  cText(g, note || "종가 기준 · 투자 조언 아님", CARD.W - P, y, 24, 400, CARD_C.sub, "right");
}
/* 한 줄: 이름 ··· 값 (+ 선택: 막대) */
function cRow(c, name, val, color, opt) {
  opt = opt || {}; var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, h = opt.h || 76;
  var fs = h >= 76 ? 38 : h >= 64 ? 34 : 30, by = c.y + (opt.bar != null ? h * 0.58 : h * 0.62);
  if (opt.rank != null) { cText(g, String(opt.rank), P + 18, by - 2, fs - 8, 700, CARD_C.sub, "center"); }
  var nx = P + (opt.rank != null ? 56 : 0);
  cText(g, cFit(g, name, W * (opt.mid ? 0.42 : 0.6), fs, 600), nx, by, fs, 600, CARD_C.txt);
  cFont(g, fs + 2, 800); var vw = Math.max(g.measureText(val).width, 130);
  if (opt.mid) cText(g, opt.mid, P + W - vw - 36, by - 2, fs - 10, 500, CARD_C.sub, "right");
  cText(g, val, P + W, by, fs + 2, 800, color || CARD_C.txt, "right");
  if (opt.bar != null) {
    var bw = Math.max(6, Math.min(1, Math.abs(opt.bar)) * (W - (nx - P)));
    cRound(g, nx, by + 14, W - (nx - P), 10, 5, CARD_C.soft); cRound(g, nx, by + 14, bw, 10, 5, color || CARD_C.accent);
  }
  if (!opt.noLine) { g.fillStyle = CARD_C.line; g.fillRect(P, c.y + h, W, 1); }
  c.y += h + (opt.gap || 0);
}
function cTiles(c, tiles) {   // 2×N 숫자 타일
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2, gap = 24, tw = (W - gap) / 2, th = 210;
  tiles.forEach(function (t, i) {
    var x = P + (i % 2) * (tw + gap), y = c.y + Math.floor(i / 2) * (th + gap);
    cRound(g, x, y, tw, th, 28, CARD_C.soft);
    cText(g, t.v, x + 32, y + 92, 60, 800, t.color || CARD_C.accent);
    cWrap(g, t.l, x + 32, y + 140, tw - 64, 28, 600, CARD_C.txt2, 38, 2);
  });
  c.y += Math.ceil(tiles.length / 2) * (th + gap);
}
/* 남은 공간에 n줄이 들어가도록 행 높이 계산 (note=true면 하단 안내 한 줄 자리 확보) */
function cH(c, n, max, note, extra) { return Math.max(48, Math.min(max, Math.floor((CARD.H - (note ? 215 : 165) - c.y - (extra || 0)) / Math.max(1, n)))); }
function cNote(c, s) { var g = c.g, P = CARD.PAD; cText(g, cFit(g, s, CARD.W - P * 2, 26, 600), P, CARD.H - 178, 26, 600, CARD_C.warmTxt); }
function cPara(c, s) { c.y = cWrap(c.g, s, CARD.PAD, c.y + 40, CARD.W - CARD.PAD * 2, 28, 500, CARD_C.warmTxt, 40, 3) + 10; }

/* ---------- 오늘의 브리핑 카드 ---------- */
function cardsBrief() {
  var R = briefState.result; if (!R) return [];
  var out = [], T = 5, date = cDate(R.asOfUs || R.asOf), L = R.label;
  // 1. 표지 — 시장 온도
  var c = cNew(), t = R.temp;
  cHead(c, "오늘의 브리핑 · " + date, L + " 시장은 " + t.word, "오른 종목 " + Math.round(t.upPct * 100) + "% (" + t.up + " / " + t.total + ")", 1, T);
  var g = c.g, P = CARD.PAD, W = CARD.W - P * 2;
  cRound(g, P, c.y, W, 28, 14, "#e8f3ff");
  var grd = g.createLinearGradient(P, 0, P + W, 0); grd.addColorStop(0, CARD_C.down); grd.addColorStop(1, CARD_C.up);
  cRound(g, P, c.y, Math.max(28, W * t.upPct), 28, 14, grd); c.y += 80;
  R.indexRow.slice(0, 6).forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret)); });
  cPara(c, t.desc);
  cFoot(c); out.push({ name: "1_시장온도", cv: c.cv });
  // 2. 테마
  c = cNew(); var th = R.themes, top = th[0], bot = th[th.length - 1];
  cHead(c, "자금 흐름 · " + date, top.name + " 강세, " + bot.name + " 약세", "업종(테마)별 평균 등락 — 어디로 돈이 움직였나", 2, T);
  var mx = Math.max.apply(null, th.map(function (x) { return Math.abs(x.ret); })) || 0.01;
  var th10 = th.slice(0, 10), hh = cH(c, th10.length, 84);
  th10.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { bar: x.ret / mx, h: hh, noLine: true }); });
  cFoot(c); out.push({ name: "2_테마흐름", cv: c.cv });
  // 3. 급등·급락
  c = cNew(); var up = R.movers.up.slice(0, 5), dn = R.movers.down.slice(0, 5);
  if (!up.length || !dn.length) return out;
  cHead(c, "가장 많이 움직인 종목 · " + date, briefName(up[0]) + " " + cPct(up[0].ret) + " · " + briefName(dn[0]) + " " + cPct(dn[0].ret), L + " 등락 상위·하위 5", 3, T);
  var mh = cH(c, up.length + dn.length, 72, false, 110);
  cText(c.g, "▲ 급등", P, c.y + 20, 30, 800, CARD_C.up); c.y += 30;
  up.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.up, { rank: i + 1, h: mh }); });
  c.y += 40; cText(c.g, "▼ 급락", P, c.y, 30, 800, CARD_C.down); c.y += 10;
  dn.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), CARD_C.down, { rank: i + 1, h: mh }); });
  cFoot(c); out.push({ name: "3_급등급락", cv: c.cv });
  // 4. 인기 종목
  c = cNew(); var pop = R.popular.filter(function (s) { return !/^\^|=X$/.test(s.sym); }).slice(0, 8);
  var hot = pop.filter(function (s) { return s.amtX != null && s.amtX >= 1.5; });
  cHead(c, "인기 종목 · " + date, hot.length ? briefName(hot[0]) + "에 관심이 몰렸어요" : "많이 찾는 종목의 " + L, "등락 · 52주 고점 대비 · 거래대금 평소比", 4, T);
  var ph = cH(c, pop.length, 84);
  pop.forEach(function (s, i) { cRow(c, briefName(s), cPct(s.ret), cCol(s.ret), { rank: i + 1, h: ph, mid: (s.vsHi != null ? cPct(s.vsHi, 0) : "") + (s.amtX != null ? " · " + s.amtX.toFixed(1) + "배" : "") }); });
  cFoot(c, R.popSrc === "ranked" ? "앱 조회 순위 · 투자 조언 아님" : "거래대금 기준 · 투자 조언 아님"); out.push({ name: "4_인기종목", cv: c.cv });
  // 5. 숫자
  c = cNew(); var nums = R.numbers.slice(0, 4);
  cHead(c, "숫자로 보는 " + L, nums[0].v + " — " + nums[0].l.replace(/'/g, ""), "시장 전체를 네 개의 숫자로", 5, T);
  cTiles(c, nums.map(function (n) { return { v: n.v, l: n.l }; }));
  cNote(c, "숫자는 과거 데이터예요. 같은 흐름이 반복된다는 보장은 없어요.");
  cFoot(c); out.push({ name: "5_오늘의숫자", cv: c.cv });
  return out;
}

/* ---------- 채널 브리핑 자료 카드 ---------- */
function cardsChannel() {
  var R = chState.brief, out = [], T = 5; if (!R) return [];
  var date = cDate(R.asOfUs), P = CARD.PAD;
  function idx(name) { return R.indexRow.filter(function (x) { return x.name === name; })[0]; }
  // 1. 미국 증시 요약
  var c = cNew(), sp = idx("S&P500"), nq = idx("나스닥");
  cHead(c, "미국 증시 데일리 · " + date + " 마감", "S&P500 " + cPct(sp && sp.ret) + " · 나스닥 " + cPct(nq && nq.ret), "지수·금리·환율·금·코인 한눈에", 1, T);
  var ih = cH(c, R.indexRow.length, 76, true);
  R.indexRow.forEach(function (x) { cRow(c, x.name, cPct(x.ret), cCol(x.ret), { h: ih }); });
  var th = R.themes;
  cNote(c, "강세 " + th.slice(0, 2).map(function (x) { return x.name; }).join("·") + " / 약세 " + th.slice(-2).map(function (x) { return x.name; }).join("·"));
  cFoot(c); out.push({ name: "1_미국증시", cv: c.cv });
  // 2. MDD
  c = cNew(); var rs = (chState.mdd || []).concat(chState.mddPick || []).filter(function (r) { return !r.err; }).slice(0, 9);
  var deep = rs.filter(function (r) { return r.cur <= -0.1; }).sort(function (a, b) { return a.cur - b.cur; })[0];
  cHead(c, "MDD 체크 · " + date, deep ? deep.name + " 고점 대비 " + cPct(deep.cur, 0) : "대표 자산 대부분 고점 근처", "전고점 대비 지금 위치 · 역대 10%+ 하락 중 순위", 2, T);
  var rh = cH(c, rs.length, 84);
  rs.forEach(function (r) { cRow(c, r.name, cPct(r.cur, 0), r.cur <= -0.1 ? CARD_C.down : CARD_C.txt, { h: rh, mid: r.cur <= -0.1 ? "역대 " + (r.deeper + 1) + "위/" + r.eps + "회" : "고점 근처", bar: r.cur, noLine: false }); });
  cFoot(c, "10년치 데이터 · 투자 조언 아님"); out.push({ name: "2_MDD", cv: c.cv });
  // 3. 지금 상황 맞춤 구성
  var plan = chState.plan; c = cNew();
  cHead(c, "자산배분 · 지금 상황", plan.title.split(" — ")[0], (chState.now && chState.now.why.length) ? "근거: " + chState.now.why.join(" / ") : "두드러진 신호 없음", 3, T);
  var g = c.g, W = CARD.W - P * 2, colors = ["#3182f6", "#14976a", "#eb6834", "#c98500", "#7c5cd6"], x = P;
  var prow = plan.items.map(function (it) { return { name: chName(it[0]), w: it[1], why: it[2] }; });
  prow.forEach(function (it, i) { var w = W * it.w / 100; cRound(g, x, c.y, Math.max(8, w - 6), 44, 10, colors[i % 5]); x += w; });
  c.y += 80;
  var per = (CARD.H - 215 - c.y) / prow.length, two = per >= 128;
  prow.forEach(function (it, i) {
    cRound(g, P, c.y + 14, 24, 24, 6, colors[i % 5]);
    cText(g, it.name + "  " + it.w + "%", P + 40, c.y + 36, 34, 700, CARD_C.txt);
    cWrap(g, it.why, P + 40, c.y + 76, W - 40, 26, 400, CARD_C.txt2, 34, two ? 2 : 1);
    c.y += per;
  });
  cNote(c, "규칙 기반 예시이며 추천이 아니에요.");
  cFoot(c); out.push({ name: "3_자산배분", cv: c.cv });
  // 4. 6가지 구성 비교 (1년·3년)
  c = cNew(); var cmp = chState.cmp || [];
  function best(i) { var ok = cmp.filter(function (x) { return x.res[i]; }); return ok.sort(function (a, b) { return b.res[i].ret - a.res[i].ret; })[0]; }
  var b1 = best(2), b3 = best(3);
  cHead(c, "구성 비교 · 처음 비중 그대로 뒀다면", (b1 ? "1년 1위 " + b1.label : "") + (b3 ? " · 3년 1위 " + b3.label : ""), "수익률 (그 사이 최대 낙폭)", 4, T);
  cText(c.g, "1년", CARD.W - P - 290, c.y + 10, 28, 700, CARD_C.sub, "right"); cText(c.g, "3년", CARD.W - P, c.y + 10, 28, 700, CARD_C.sub, "right"); c.y += 24;
  var ch = cH(c, cmp.length, 104, true);
  cmp.forEach(function (x) {
    var a = x.res[2], b = x.res[3], gg = c.g;
    cText(gg, x.label + (x.key === plan.key ? " ●" : ""), P, c.y + 50, 36, x.key === plan.key ? 800 : 600, x.key === plan.key ? CARD_C.warmTxt : CARD_C.txt);
    cText(gg, a ? cPct(a.ret, 0) : "-", CARD.W - P - 290, c.y + 46, 36, 800, a ? cCol(a.ret) : CARD_C.sub, "right");
    cText(gg, a ? "(" + cPct(a.mdd, 0) + ")" : "", CARD.W - P - 290, c.y + 80, 24, 400, CARD_C.sub, "right");
    cText(gg, b ? cPct(b.ret, 0) : "-", CARD.W - P, c.y + 46, 36, 800, b ? cCol(b.ret) : CARD_C.sub, "right");
    cText(gg, b ? "(" + cPct(b.mdd, 0) + ")" : "", CARD.W - P, c.y + 80, 24, 400, CARD_C.sub, "right");
    gg.fillStyle = CARD_C.line; gg.fillRect(P, c.y + ch - 4, W, 1); c.y += ch;
  });
  cNote(c, "● 지금 상황 구성 · 기간마다 1위가 바뀌어요 — 분산하는 이유");
  cFoot(c, "SPY·QQQ·SCHD·TLT·IEF·SHY·GLD·DBC 기준"); out.push({ name: "4_구성비교", cv: c.cv });
  // 5. 과거 사례 (지금과 비슷한 것, 없으면 첫 사례)
  var sc = (chState.scen || [])[0]; c = cNew();
  if (sc) {
    var ep = sc.eps[0];
    cHead(c, "과거 사례 · " + sc.tag + (sc.now ? " (지금과 비슷)" : ""), ep.name, ep.s.replace(/-/g, ".") + " ~ " + ep.e.replace(/-/g, "."), 5, T);
    var rows = ep.st.filter(function (x) { return x.sym !== "KRW=X"; }).sort(function (a, b) { return b.ret - a.ret; }).slice(0, 6);
    var pops = (ep.pop || []).slice(0, 3), sh = cH(c, rows.length + pops.length, 72, false, pops.length ? 70 : 0);
    rows.forEach(function (x) { cRow(c, x.name, cPct(x.ret, 0), cCol(x.ret), { h: sh }); });
    c.y += 16;
    if (pops.length) {
      cText(c.g, "🧠 그때 인기 종목은", P, c.y + 30, 30, 800, CARD_C.txt); c.y += 50;
      pops.forEach(function (x) { cRow(c, x.name, chFmtRec(x), CARD_C.txt2, { h: sh, mid: "최대 " + cPct(x.dd, 0) }); });
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
    box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button>' +
      (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유 (인스타·카톡)</button>' : '') +
      '<span class="briefDim">1080×1350 · 인스타 4:5 · 저장이 안 되면 이미지를 길게 눌러 저장</span></div><div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    list.forEach(function (it, i) {
      it.url = it.cv.toDataURL("image/png"); it.file = "StockMind_" + (kind === "brief" ? "오늘" : "채널") + "_" + day + "_" + it.name + ".png";
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
    infoModal.open("🃏 " + (kind === "brief" ? "오늘의 브리핑" : "채널 브리핑") + " 카드 " + list.length + "장", box);
  });
}
function cardsDownload(it) { var a = document.createElement("a"); a.href = it.url; a.download = it.file; document.body.appendChild(a); a.click(); a.remove(); }

(function () {
  var b = document.getElementById("briefCards"); if (b) b.onclick = function () { cardsOpen("brief"); };
  var c = document.getElementById("chCards"); if (c) c.onclick = function () { cardsOpen("channel"); };
})();
