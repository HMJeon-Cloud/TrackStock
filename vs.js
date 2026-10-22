/* ============================================================
   v12.34 국장 vs 미장 (vs 코인) — 시총 상위 종목의 '올해(연초 대비)'·'1년 전 대비' 성적 비교 카드 4장
   ① 국장 vs 미장 · 시총 10 · 올해     ② 국장 vs 미장 · 시총 10 · 1년
   ③ 국장 vs 미장 vs 코인 · 5 · 올해    ④ 국장 vs 미장 vs 코인 · 5 · 1년
   시총 순위: 국내 = 전체 시장 요약(네이버 시가총액 순, 우선주 제외) · 미국 = 후보 종목의 네이버 시가총액으로 정렬
              (둘 다 못 받으면 기준 목록으로 대신하고 카드에 그렇게 적는다)
   코인 = 비트코인·이더리움·리플·솔라나·도지코인 (시총 순위 아님 — 지정 목록)
   수익률 = 종가(주가) 기준 · 배당 미포함 · 각 통화 기준(환율 미반영)
   ============================================================ */
var VS = { at: 0, kr: null, us: null, src: {}, rows: {}, busy: null };
var VS_COIN = [["BTC-USD", "비트코인"], ["ETH-USD", "이더리움"], ["XRP-USD", "리플"], ["SOL-USD", "솔라나"], ["DOGE-USD", "도지코인"]];
var VS_KR_BASE = [["005930.KS", "삼성전자"], ["000660.KS", "SK하이닉스"], ["373220.KS", "LG에너지솔루션"], ["207940.KS", "삼성바이오로직스"], ["005380.KS", "현대차"], ["012450.KS", "한화에어로스페이스"], ["105560.KS", "KB금융"], ["000270.KS", "기아"], ["068270.KS", "셀트리온"], ["034020.KS", "두산에너빌리티"]];
var VS_US_POOL = [["NVDA", "엔비디아"], ["MSFT", "마이크로소프트"], ["AAPL", "애플"], ["GOOGL", "알파벳"], ["AMZN", "아마존"], ["META", "메타"], ["AVGO", "브로드컴"], ["TSLA", "테슬라"], ["BRK-B", "버크셔 해서웨이"], ["LLY", "일라이 릴리"], ["JPM", "JP모건"], ["WMT", "월마트"], ["V", "비자"], ["ORCL", "오라클"], ["MA", "마스터카드"], ["XOM", "엑슨모빌"], ["NFLX", "넷플릭스"], ["COST", "코스트코"], ["MU", "마이크론"], ["AMD", "AMD"], ["PLTR", "팔란티어"], ["UNH", "유나이티드헬스"], ["JNJ", "존슨앤드존슨"]];

function vsTo(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]); }
function vsKo(sym, fb) { var n = typeof BRIEF_KO !== "undefined" && BRIEF_KO[sym]; return String(n || fb || sym).replace(/\s*\(.*?\)\s*/g, "").trim(); }

/* 국내 시총 10: 전체 시장 요약의 순서(네이버 시가총액 순), 우선주 제외 */
function vsKr() {
  var ld = typeof dlUniLoad === "function" ? dlUniLoad("kr") : Promise.resolve(null);
  return vsTo(ld, 8000).then(function (U) {
    var L = U && U.rows ? U.rows.filter(function (r) { return r && r.s && r.n && !/우[BC]?$|우\(전환\)$|KODEX|TIGER|ETF/.test(r.n) && /0\.K[SQ]$/.test(r.s); })   /* 보통주만(코드 끝 0) */.slice(0, 10).map(function (r) { return [r.s, r.n]; }) : [];
    if (L.length >= 10) { VS.src.kr = "네이버 시가총액 순"; return L; }
    VS.src.kr = "기준 목록(시총 순위를 못 받음)"; return VS_KR_BASE.slice();
  });
}
/* 미국 시총 10: 후보의 시가총액(네이버)을 받아 정렬 — 반 넘게 못 받으면 기준 목록 */
function vsUs() {
  return Promise.all(VS_US_POOL.map(function (p) {
    return vsTo(fetch("/api/fund?symbol=" + encodeURIComponent(p[0])).then(function (r) { return r.json(); }).then(function (d) {
      var info = d && d.info || {}, v = typeof rpV === "function" ? (rpV(info, "marketValue") || rpV(info, "marketCap") || rpV(info, "marketCapValue")) : null;
      return { p: p, v: v > 0 ? v : null };
    }).catch(function () { return { p: p, v: null }; }), 9000).then(function (x) { return x || { p: p, v: null }; });
  })).then(function (A) {
    var got = A.filter(function (x) { return x.v; });
    if (got.length >= 15) { VS.src.us = "네이버 시가총액 순(후보 " + VS_US_POOL.length + "개 중)"; return got.sort(function (a, b) { return b.v - a.v; }).slice(0, 10).map(function (x) { return x.p; }); }
    VS.src.us = "기준 목록(시총을 못 받음)"; return VS_US_POOL.slice(0, 10);
  });
}
function vsPrep() {
  if (VS.busy) return VS.busy;
  if (VS.kr && Date.now() - VS.at < 20 * 60e3) return Promise.resolve();
  VS.busy = Promise.all([vsKr(), vsUs()]).then(function (r) {
    VS.kr = r[0]; VS.us = r[1];
    var syms = VS.kr.concat(VS.us).concat(VS_COIN).map(function (p) { return p[0]; });
    return Promise.all(syms.map(function (s) { return vsTo(getChartData(s, "max").then(function (p) { VS.rows[s] = (p && p.rows || []).filter(function (x) { return x && x.c > 0; }); }).catch(function () {}), 15000); }));
  }).then(function () { VS.at = Date.now(); VS.busy = null; }, function (e) { VS.busy = null; throw e; });
  return VS.busy;
}

/* 시장 현지 날짜 */
function vsOff(sym) { return /\.K[SQ]$/.test(sym) ? 9 : /-USD$/.test(sym) ? 0 : -5; }
function vsD(sym, ms) { return new Date(ms + vsOff(sym) * 3600e3).toISOString().slice(0, 10); }
/* 올해: 작년 마지막 거래일 종가 → 마지막 종가 / 1년: 365일 전(그날 또는 그 전 마지막 거래일) 종가 → 마지막 종가 */
/* k: 몇 년 전 시점의 1년인가 (0 = 지금까지 1년, 1 = 1년 전 시점까지 1년(작년), 2 = 2년 전 …) */
function vsRet(sym, kind, k) {
  var R = VS.rows[sym]; if (!R || R.length < 30) return null;
  var last = R[R.length - 1], base = null;
  if (k) { var te = R[R.length - 1].t - k * 365.25 * 86400e3, e = null; for (var q = R.length - 1; q >= 0; q--) if (R[q].t <= te) { e = R[q]; break; } if (!e || te - e.t > 10 * 86400e3) return null; last = e; }
  var ld = vsD(sym, last.t);
  if (kind === "ytd") { var y0 = ld.slice(0, 4) + "-01-01"; for (var i = R.length - 1; i >= 0; i--) if (vsD(sym, R[i].t) < y0) { base = R[i]; break; } }
  else { var tg = last.t - 365 * 86400e3, j0 = R.indexOf(last); for (var j = j0; j >= 0; j--) if (R[j].t <= tg) { base = R[j]; break; } if (base && tg - base.t > 10 * 86400e3) base = null; }
  if (!base || !(base.c > 0)) return null;
  return { r: last.c / base.c - 1, last: last, base: base, d: ld, bd: vsD(sym, base.t) };
}
function vsList(list, kind, k) { return list.map(function (p) { var x = vsRet(p[0], kind, k); return x ? { sym: p[0], name: vsKo(p[0], p[1]), r: x.r, d: x.d, bd: x.bd, a: x.base.c, b: x.last.c } : null; }).filter(Boolean); }
function vsAvg(L) { return L.length ? L.reduce(function (a, x) { return a + x.r; }, 0) / L.length : null; }
function vsPct(x) { return x == null ? "-" : (x > 0 ? "+" : "") + (Math.abs(x) >= 10 ? (x * 100).toFixed(0) : (x * 100).toFixed(1)) + "%"; }
function vsCol(x) { return x > 0 ? TPL_C.red : x < 0 ? TPL_C.blue : TPL_C.ink2; }
function vsMd(d) { if (!d) return ""; var p = d.split("-"); return (+p[1]) + "/" + (+p[2]); }
function vsYmd(d) { if (!d) return ""; var p = d.split("-"); return p[0].slice(2) + "." + (+p[1]) + "." + (+p[2]); }   // 그때 날짜는 연도까지

/* 시장 머리: 국기(또는 코인 로고) + 이름 + 평균 알약 */
function vsHead(g, x, y, w, M, avg) {
  var h = 52; cRound(g, x, y, w, h, 12, TPL_C.black);
  var ix = x + 14;
  if (M.flag && typeof cFlag === "function") ix += cFlag(g, ix, y + 15, 22, M.flag) + 10;
  else if (typeof cMono === "function") { cMono(g, ix, y + 10, 32, "BTC-USD", "비트코인"); ix += 42; }
  cText(g, M.label, ix, y + 35, 25, 900, "#ffffff");
  var t = "평균 " + vsPct(avg), tw = cW(g, t, 21, 900) + 24;
  cRound(g, x + w - tw - 10, y + 10, tw, 32, 16, avg >= 0 ? TPL_C.red : TPL_C.blue); cText(g, t, x + w - tw / 2 - 10, y + 33, 21, 900, "#ffffff", "center");
  return y + h;
}
/* 한 줄: 순위 · 로고 · 이름 ······ 등락 / 아래 막대(공통 축) */
function vsRow(g, x, y, w, h, i, it, ax) {
  var lz = Math.min(44, h - 22), cy = y + Math.min(30, h * 0.42);
  cText(g, String(i + 1), x + 12, cy + 8, 20, 900, TPL_C.sub, "center");
  if (typeof cMono === "function") cMono(g, x + 28, cy - lz / 2, lz, it.sym, it.name);
  var nx = x + 28 + lz + 12, pt = vsPct(it.r), tall = h >= 110 && w < 400, ps = tall ? 38 : 28; while (ps > 20 && cW(g, pt, ps, 900) > (tall ? w - 40 : 140)) ps -= 2;
  var pw = cW(g, pt, ps, 900);
  if (tall) {   // 좁고 높은 칸(코인 포함 3열): 이름 줄 아래에 큰 등락
    cText(g, cFit(g, it.name, w - (nx - x) - 6, 23, 800), nx, cy + 8, 23, 800, TPL_C.ink);
    cText(g, pt, x + w - 4, y + h - 30, ps, 900, vsCol(it.r), "right");
    if (h >= 150 && typeof cPrice === "function") { cText(g, cFit(g, vsYmd(it.bd) + " " + cPrice(it.sym, it.a), w - 20, 17, 600), x + 12, cy + 42, 17, 600, TPL_C.sub); cText(g, cFit(g, "→ " + vsMd(it.d) + " " + cPrice(it.sym, it.b), w - 20, 17, 600), x + 12, cy + 64, 17, 600, TPL_C.sub); }   // 릴스 3열: 그때 → 지금 가격
  } else {
    cText(g, cFit(g, it.name, w - (nx - x) - pw - 16, 23, 800), nx, cy + 8, 23, 800, TPL_C.ink);
    cText(g, pt, x + w - 4, cy + 10, ps, 900, vsCol(it.r), "right");
    if (h >= 108 && typeof cPrice === "function") cText(g, cFit(g, vsYmd(it.bd) + " " + cPrice(it.sym, it.a) + "  →  " + vsMd(it.d) + " " + cPrice(it.sym, it.b), w - (nx - x) - 6, 18, 600), nx, cy + 40, 18, 600, TPL_C.sub);   // 릴스: 남는 높이에 '그때 → 지금' 가격
  }
  // 막대: 공통 축(ax.zero 비율 지점이 0)
  var by = y + h - 14, bx = tall ? x + 12 : nx, bw = x + w - 4 - bx, z = bx + bw * ax.zero;
  g.fillStyle = TPL_C.soft; g.fillRect(bx, by, bw, 6);
  var len = it.r >= 0 ? bw * (1 - ax.zero) * Math.min(1, it.r / ax.pos) : bw * ax.zero * Math.min(1, -it.r / ax.neg);
  g.fillStyle = vsCol(it.r); if (it.r >= 0) g.fillRect(z, by - 2, Math.max(2, len), 10); else g.fillRect(z - len, by - 2, Math.max(2, len), 10);
  if (ax.zero > 0.02) { g.fillStyle = TPL_C.ink; g.fillRect(z - 1, by - 6, 2, 18); }
  g.fillStyle = TPL_C.soft; g.fillRect(x, y + h - 1, w, 1);
}
function vsAxis(all) {
  var pos = Math.max(0.05, Math.max.apply(null, all.map(function (x) { return x.r; }).concat([0]))), neg = Math.max(0, -Math.min.apply(null, all.map(function (x) { return x.r; }).concat([0])));
  if (neg > 0) neg = Math.max(neg, 0.05);
  // 극단값 하나가 축을 다 먹지 않게 상한(두 번째로 큰 값의 1.6배)
  var ps = all.map(function (x) { return x.r; }).filter(function (v) { return v > 0; }).sort(function (a, b) { return b - a; }); if (ps.length > 1 && ps[0] > ps[1] * 1.6) pos = ps[1] * 1.6;
  return { pos: pos, neg: neg, zero: neg ? neg / (pos + neg) : 0 };
}
function vsWin(Ms) { var s = Ms.slice().sort(function (a, b) { return (b.avg || -9) - (a.avg || -9); }); return s[0].label + (s.length > 2 ? " 1위 · " + s[s.length - 1].label + " 꼴찌" : " 승 (평균 " + vsPct(s[0].avg - s[1].avg).replace("+", "") + "p 차이)"); }

/* 카드 하나 그리기 */
function vsKName(k) { return !k ? "최근" : k === 1 ? "작년" : k + "년 전"; }
/* 이 k(몇 년 전)의 1년을 그릴 수 있나 — 시장마다 목록의 70% 이상(최소 3개) 값이 있어야 */
function vsCan(three, kind, k) {
  if (!VS.kr) return false; var n = three ? 5 : 10, L = [VS.kr.slice(0, n), VS.us.slice(0, n)]; if (three) L.push(VS_COIN);
  return L.every(function (l) { var got = vsList(l, kind, k).length; return got >= Math.max(3, Math.ceil(l.length * 0.7)); });
}
function vsYears(three) { var out = []; for (var k = 0; k <= 15; k++) { if (!vsCan(three, "y1", k)) break; out.push(k); } return out; }
function vsCard(kind, three, k) {
  if (!VS.kr) return null; k = k || 0;
  var n = three ? 5 : 10, KL = kind === "ytd" ? "올해" : k ? vsKName(k) + " 1년" : "최근 1년";
  var Ms = [{ key: "kr", label: "국장", flag: "kr", list: vsList(VS.kr.slice(0, n), kind, k), all: n }, { key: "us", label: "미장", flag: "us", list: vsList(VS.us.slice(0, n), kind, k), all: n }];
  if (three) Ms.push({ key: "coin", label: "코인", list: vsList(VS_COIN, kind, k), all: VS_COIN.length });
  Ms.forEach(function (M) { M.avg = vsAvg(M.list); });
  if (Ms.some(function (M) { return M.list.length < Math.min(3, n); })) return null;
  var miss = Ms.reduce(function (a, M) { return a + (M.all - M.list.length); }, 0);
  var dk = Ms[0].list[0], du = Ms[1].list[0];
  var range = kind === "ytd" ? "작년 마지막 종가 → " : k ? vsYmd(du.bd) + " → " + vsYmd(du.d) + " · " : "1년 전 종가 → ";
  var title = (three ? "국장 vs 미장 vs 코인" : "국장 vs 미장") + "\n" + (kind === "ytd" ? "올해 성적표" : k ? vsKName(k) + " 1년 성적표" : "1년 성적표");
  var sub = (three ? "시총 상위 5 + 대표 코인 5" : "시가총액 상위 10") + " · " + range + (k ? "지금 순위 기준" : "국내 " + vsMd(dk.d) + " · 미국 " + vsMd(du.d) + " 종가");
  var src = "야후 파이낸스 종가 · 순위: 국내 " + (VS.src.kr || "-") + " · 미국 " + (VS.src.us || "-");
  var c = tplNew({ cat: "compare", catName: "국장 vs 미장" + (k ? " · " + vsKName(k) : ""), title: title, sub: sub, source: src });
  var g = c.g, P = TPL.P, W = TPL.W - P * 2, all = []; Ms.forEach(function (M) { all = all.concat(M.list); });
  var ax = vsAxis(all), bandH = 66, noteH = 30, yEnd = TPL.H - TPL.FOOT - 22 - bandH - noteH, y = c.y;
  if (true) {   // 시장마다 한 열 (2열 · 3열)
    var cols = Ms.length, gap = cols > 2 ? 16 : 22, cw = (W - gap * (cols - 1)) / cols, rh = Math.min(cols > 2 ? 200 : 150, (yEnd - y - 62) / n);
    Ms.forEach(function (M, k) { var x = P + k * (cw + gap), yy = vsHead(g, x, y, cw, M, M.avg) + 8; M.list.forEach(function (it, i) { vsRow(g, x, yy + i * rh, cw, rh, i, it, ax); }); });
    y += 62 + rh * n;
  } else {
    var secH = (yEnd - y) / 3, rh3 = Math.min(84, (secH - 66) / 5);
    Ms.forEach(function (M, k) { var yy = vsHead(g, P, y + k * secH, W, M, M.avg) + 6; M.list.forEach(function (it, i) { vsRow(g, P, yy + i * rh3, W, rh3, i, it, ax); }); });
    y += secH * 3;
  }
  cText(g, cFit(g, "주가(종가) 기준 · 배당 미포함 · 각자 통화 기준(환율 미반영) · 평균은 단순 평균" + (k ? " · 종목은 지금 시총 순위(그때 순위와 다를 수 있음)" : "") + (miss ? " · " + miss + "개는 그때 상장 전이라 제외" : "") + (ax.pos < Math.max.apply(null, all.map(function (x) { return x.r; })) ? " · 막대 끝이 넘치는 값은 축 상한" : ""), W, 15, 600), P, TPL.H - TPL.FOOT - 22 - bandH - 10, 15, 600, TPL_C.sub);
  tplBand(g, P, TPL.H - TPL.FOOT - 16 - bandH, W, bandH - 6, KL + " 평균 · " + Ms.map(function (M) { return M.label + " " + vsPct(M.avg); }).join("  vs  ") + "  →  " + vsWin(Ms), 26);
  return tplFoot(c);
}
/* 올해 = 한 장 · 1년 = 지금 + 작년 + 2년 전 … (데이터가 되는 해까지) */
function vsDeck(three, kind) {
  var base = three ? "국장미장코인" : "국장미장", out = [];
  if (kind === "ytd") { var a = vsCard("ytd", three, 0); if (a) out.push({ name: base + "_올해", cv: a }); return out; }
  vsYears(three).forEach(function (k) { var cv = vsCard("y1", three, k); if (cv) out.push({ name: base + "_1년_" + vsKName(k), cv: cv }); });
  return out;
}
/* 작업대 주제로 등록 (새 서버 함수 없음) */
(function () {
  if (typeof HUB_NEW === "undefined") return;
  /* v12.35 올해 · 1년을 따로. 1년은 '여러 장' = 최근 1년 + 작년 + 2년 전 … / '한 장' = 최근 1년 */
  HUB_NEW.push({ id: "vs2y", t: "🆚 국장 vs 미장 — 시총 10 (올해)", d: "국내·미국 시가총액 상위 10종목 · 작년 마지막 종가 → 지금", g: "비교", need: "vs", fn: function () { return vsDeck(false, "ytd"); }, one: function () { return vsCard("ytd", false, 0); } });
  HUB_NEW.push({ id: "vs2r", t: "🆚 국장 vs 미장 — 시총 10 (1년)", d: "한 장 = 최근 1년 · 여러 장 = 최근 1년 + 작년 + 2년 전 … (데이터가 되는 해까지)", g: "비교", need: "vs", fn: function () { return vsDeck(false, "y1"); }, one: function () { return vsCard("y1", false, 0); } });
  HUB_NEW.push({ id: "vs3y", t: "🆚 국장 vs 미장 vs 코인 — 5종목 (올해)", d: "시총 상위 5 + 비트코인·이더리움·리플·솔라나·도지코인 · 작년 마지막 종가 → 지금", g: "비교", need: "vs", fn: function () { return vsDeck(true, "ytd"); }, one: function () { return vsCard("ytd", true, 0); } });
  HUB_NEW.push({ id: "vs3r", t: "🆚 국장 vs 미장 vs 코인 — 5종목 (1년)", d: "한 장 = 최근 1년 · 여러 장 = 최근 1년 + 작년 + 2년 전 … (데이터가 되는 해까지)", g: "비교", need: "vs", fn: function () { return vsDeck(true, "y1"); }, one: function () { return vsCard("y1", true, 0); } });
  if (typeof hubPrep === "function") { var hp0 = hubPrep; hubPrep = function (need) { return need === "vs" ? Promise.all([typeof cLogoReady === "function" ? cLogoReady() : null, vsPrep()]) : hp0.apply(this, arguments); }; }
})();
