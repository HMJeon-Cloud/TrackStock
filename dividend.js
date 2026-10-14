/* ============================================================
   배당 · 세금 (v11.1)
   ① 목표 배당 → 필요 투자금   ② 계좌별 세후 비교 (일반 · ISA · 연금저축)   ③ 배당 캘린더
   데이터: 매일 받는 최근 400일 스냅샷(sm:recent)의 배당 기록(div) — 앱에 등록된 전체 종목 중 최근 1년 배당이 있는 것
           5년 배당 성장·삭감: 기존 /api/snap?symbol= (전체 기록 · CDN 캐시) — 화면에 보이는 종목만, 열 때만
           국내 배당락일·지급일: 기존 /api/fund (네이버) — 내 보유·관심 국내 종목만, 12시간 캐시
   새 서버 함수 · 크론 · Redis 키 없음 → 과금 없음
   ============================================================ */

/* 세율 표 — 세법이 바뀌면 여기만 고친다 (asOf = 마지막 확인일) */
var DIV_TAX = {
  asOf: "2026-10-14",
  gen: 0.154,                 // 배당소득세 (지방세 포함)
  us: 0.15,                   // 미국 직접투자 배당 — 현지 원천징수
  usGain: 0.22, usGainDed: 2.5e6,   // 해외주식 양도세 · 기본공제 연 250만원
  fin: 2e7,                   // 금융소득 종합과세 기준 (연 2,000만원)
  hiDiv: [[2e7, 0.14], [3e8, 0.2], [5e9, 0.25], [Infinity, 0.3]],   // 고배당기업 분리과세 (2026~2029년 지급 배당, 신고 때 신청)
  isaYear: 2e7, isaTotal: 1e8, isaMin: 3, isaFree: 2e6, isaFreeSeo: 4e6, isaOver: 0.099,
  penYear: 1.8e7, penDed: 6e6, penDedHi: 0.165, penDedLo: 0.132,   // 연금저축 납입 한도 · 세액공제 대상 · 공제율(총급여 5,500만원 이하 / 초과)
  penTax: { "55": 0.055, "70": 0.044, "80": 0.033 }, penOther: 0.165, penCap: 1.5e7,
  src: "국세청·금융투자협회 공시 기준 · 한국경제(2026.4) 고배당기업 분리과세 · 삼성자산운용 KODEX 연금 가이드(2026.3Q)",
  pending: "정부 세제개편안(일반 ISA 최대 5년 · 생산적금융 ISA 신설)은 국회 심의 중이라 반영하지 않았어요."
};
var DV_D = 86400e3;
var DV = { tab: "goal", rows: null, fx: null, asOf: null, hist: {}, histQ: {}, fund: {}, loading: null, err: null,
  goal: { m: 100, base: "gen", mk: "all", sort: "need", more: false }, pick: [], w: {},
  acct: { sym: null, y: 4, g: 0, mode: "year", amt: 1000, years: 10, low: false, seo: false, age: "55" },
  cal: { scope: null } };
var DV_TABS = [["goal", "목표 배당"], ["acct", "계좌별 세금"], ["cal", "배당 캘린더"]];

function dvSaveState() { try { localStorage.setItem("sm.div", JSON.stringify({ tab: DV.tab, goal: DV.goal, pick: DV.pick, w: DV.w, acct: DV.acct, cal: DV.cal })); } catch (e) {} }
(function () { try { var j = JSON.parse(localStorage.getItem("sm.div") || "null"); if (!j) return; ["tab", "pick", "w"].forEach(function (k) { if (j[k] != null) DV[k] = j[k]; }); ["goal", "acct", "cal"].forEach(function (k) { if (j[k]) Object.assign(DV[k], j[k]); }); DV.goal.more = false; } catch (e) {} })();

/* ---------- 숫자 표기 ---------- */
function dvMan(v) {
  if (v == null || !isFinite(v)) return "-";
  var neg = v < 0; v = Math.abs(v);
  var s;
  if (v >= 1e8) { var e = Math.floor(v / 1e8), m = Math.round((v - e * 1e8) / 1e4); if (m >= 10000) { e++; m = 0; } s = e.toLocaleString("ko-KR") + "억" + (m ? " " + m.toLocaleString("ko-KR") + "만" : "") + "원"; }
  else if (v >= 1e4) s = Math.round(v / 1e4).toLocaleString("ko-KR") + "만원";
  else s = Math.round(v).toLocaleString("ko-KR") + "원";
  return (neg ? "-" : "") + s;
}
function dvEok(v) { if (v == null || !isFinite(v)) return "-"; return v >= 1e8 ? (v / 1e8).toFixed(1) + "억" : Math.round(v / 1e4).toLocaleString("ko-KR") + "만"; }
function dvP(x, d) { return x == null || !isFinite(x) ? "-" : (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function dvSP(x, d) { return x == null || !isFinite(x) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function dvPer(r, a) { return r.krw ? Math.round(a).toLocaleString("ko-KR") + "원" : "$" + (a < 0.1 ? a.toFixed(3) : a.toFixed(2)); }
function dvEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function dvKst(t) { return new Date(t + 9 * 3600e3); }
function dvMonthStart(t, add) { var d = dvKst(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (add || 0), 1) - 9 * 3600e3; }
function dvTs(x) { x = +x; return x > 1e12 ? x : x * 1000; }

/* ---------- 종목 분류 · 이름 ---------- */
function dvIsEtf(name) { return /ETF|KODEX|TIGER|ACE |SOL |RISE|PLUS |KBSTAR|HANARO|ARIRANG|JEPI|커버드콜/.test(name); }
function dvKind(sym, name) {
  if (/\.(KS|KQ)$/.test(sym)) { if (!dvIsEtf(name)) return "krStock"; return /미국|나스닥|S&P|골드|금|선물|레버리지|인버스|채권|중국|일본/.test(name) ? "krEtfFor" : "krEtfDom"; }
  return "us";
}
var DV_KIND = { krStock: "국내 주식", krEtfDom: "국내 주식형 ETF", krEtfFor: "국내 상장 해외·기타 ETF", us: "미국 직접투자" };
function dvShort(r) { var m = r.name.match(/\(([A-Z0-9.\-]{2,6})\)/); if (m && !r.krw) return m[1]; return r.name.replace(/\s*\(.*?\)\s*/g, " ").trim() || r.sym; }

/* ---------- 데이터: 최근 400일 스냅샷의 배당 기록 → 배당 종목 표 ---------- */
function dvBuild(recent) {
  var now = Date.now(), rows = [], seen = {}, S = (recent && recent.symbols) || {};
  var fxD = S["KRW=X"], fx = null; if (fxD && fxD.c) for (var i = fxD.c.length - 1; i >= 0; i--) if (fxD.c[i] > 0) { fx = fxD.c[i]; break; }
  (typeof TICKER_DICT !== "undefined" ? TICKER_DICT : []).forEach(function (t) {
    var sym = t[0], name = t[1]; if (seen[sym]) return; seen[sym] = 1;
    if (/-USD$|^\^|=X$|=F$|\.NYB$/.test(sym)) return;   // 코인·지수·환율·선물 제외
    var d = S[sym]; if (!d || !d.c || !d.div || !d.div.length) return;
    var price = null, pt = null; for (var k = d.c.length - 1; k >= 0; k--) if (d.c[k] > 0) { price = d.c[k]; pt = d.t ? dvTs(d.t[k]) : null; break; }
    if (!price) return;
    var ev = d.div.map(function (e) { return { t: dvTs(e[0]), a: +e[1] }; }).filter(function (e) { return e.a > 0 && isFinite(e.a); }).sort(function (a, b) { return a.t - b.t; });
    var y1 = ev.filter(function (e) { return e.t > now - 365 * DV_D && e.t <= now + DV_D; });
    if (!y1.length) return;
    var ttm = y1.reduce(function (s, e) { return s + e.a; }, 0), n = y1.length, yld = ttm / price;
    var krw = (d.meta && d.meta.currency) ? d.meta.currency === "KRW" : /\.(KS|KQ)$/.test(sym);
    var mon = {}; y1.forEach(function (e) { var m = dvKst(e.t).getUTCMonth() + 1; mon[m] = (mon[m] || 0) + e.a / ttm; });
    rows.push({ sym: sym, name: name, price: price, pt: pt, ttm: ttm, n: n, yld: yld, krw: krw, kind: dvKind(sym, name), etf: dvIsEtf(name), mon: mon, ev: ev,
      freq: n >= 10 ? "월" : n >= 3 ? "분기" : n === 2 ? "반기" : "연", bad: yld > 0.2, trap: yld >= 0.08 });
  });
  DV.rows = rows; DV.fx = fx; DV.asOf = recent && recent.generated;
  return rows;
}
function dvEnsure() {
  if (DV.rows) return Promise.resolve(DV.rows);
  if (DV.loading) return DV.loading;
  var get = typeof fetchRecent === "function" ? fetchRecent() : fetch("/api/snap?recent=1").then(function (r) { return r.json(); });
  DV.loading = Promise.resolve(get).then(function (rec) { if (!rec) { DV.err = "시세 데이터를 받지 못했어요. 잠시 후 다시 열어 주세요."; return []; } return dvBuild(rec); }).catch(function (e) { DV.err = String(e && e.message || e); return []; }).then(function (r) { DV.loading = null; return r; });
  return DV.loading;
}
function dvOk(r) { return !r.bad; }
function dvMk(rows, mk) { return rows.filter(function (r) { return mk === "kr" ? r.krw : mk === "us" ? !r.krw : mk === "etf" ? r.etf : true; }); }
function dvRate(r, base) { return base === "pre" ? 0 : base === "pen" ? DIV_TAX.penTax["55"] : r.kind === "us" ? DIV_TAX.us : DIV_TAX.gen; }
function dvNeed(month, yld, rate) { return yld > 0 ? month * 12 / (1 - rate) / yld : null; }

/* 5년 배당 이력 (전체 기록 파일) → 연간 합계 · 5년 성장률 · 삭감 횟수 */
function dvHist(sym) {
  if (DV.hist[sym]) return Promise.resolve(DV.hist[sym]);
  if (DV.histQ[sym]) return DV.histQ[sym];
  DV.histQ[sym] = fetch("/api/snap?symbol=" + encodeURIComponent(sym)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
    var y = {}, cy = dvKst(Date.now()).getUTCFullYear();
    (j.div || []).forEach(function (e) { var yr = dvKst(dvTs(e[0])).getUTCFullYear(); if (yr < cy && +e[1] > 0) y[yr] = (y[yr] || 0) + (+e[1]); });
    var yrs = []; for (var k = cy - 6; k < cy; k++) yrs.push(y[k] || 0);
    var full = yrs.filter(function (v) { return v > 0; }).length, g5 = null, cuts = 0;
    if (yrs[0] > 0 && yrs[5] > 0) g5 = Math.pow(yrs[5] / yrs[0], 1 / 5) - 1;
    for (var i = 1; i < yrs.length; i++) if (yrs[i - 1] > 0 && yrs[i] < yrs[i - 1] * 0.9) cuts++;
    return (DV.hist[sym] = { g5: g5, cuts: cuts, yrs: yrs, full: full });
  }).catch(function () { return (DV.hist[sym] = { g5: null, cuts: null, yrs: [], full: 0, err: true }); });
  return DV.histQ[sym];
}
function dvHistMany(syms, onEach) {
  var q = syms.filter(function (s) { return !DV.hist[s]; }), i = 0;
  function next() { if (i >= q.length) return Promise.resolve(); var s = q[i++]; return dvHist(s).then(function () { if (onEach) onEach(s); return next(); }); }
  return Promise.all([next(), next(), next()]);
}
function dvGrowTxt(h) { if (!h) return '<span class="briefDim">…</span>'; if (h.err || h.full < 2) return '<span class="briefDim">기록 부족</span>'; return (h.g5 != null ? '<b class="' + (h.g5 >= 0 ? "pos" : "neg") + '">' + dvSP(h.g5) + '</b>' : '<span class="briefDim">5년 미만</span>') + (h.cuts ? ' <span class="dvWarn">삭감 ' + h.cuts + '회</span>' : ''); }

/* 국내 종목 배당락일·지급일 (/api/fund · 12시간 캐시) */
function dvDate(v) { var m = String(v == null ? "" : (typeof v === "object" ? v.value : v)).match(/(\d{4})[.\-\/]?\s?(\d{1,2})[.\-\/]?\s?(\d{1,2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600e3 : null; }
function dvFund(sym) {
  if (!/\.(KS|KQ)$/.test(sym)) return Promise.resolve(null);
  if (DV.fund[sym]) return Promise.resolve(DV.fund[sym]);
  try { var c = JSON.parse(localStorage.getItem("sm.fdiv:" + sym) || "null"); if (c && Date.now() - c.at < 12 * 3600e3) return Promise.resolve(DV.fund[sym] = c); } catch (e) {}
  return fetch("/api/fund?symbol=" + encodeURIComponent(sym)).then(function (r) { return r.json(); }).then(function (d) {
    var I = (d && d.info) || {}; function g(ks) { for (var i = 0; i < ks.length; i++) if (I[ks[i]] != null) return I[ks[i]]; return null; }
    var out = { at: Date.now(), ex: dvDate(g(["exDividendAt", "exDividendDate"])), pay: dvDate(g(["dividendAt", "dividendDate"])), yld: (typeof pkNum === "function" ? pkNum(g(["dividendYieldRatio", "dividendYield"])) : null) };
    DV.fund[sym] = out; try { localStorage.setItem("sm.fdiv:" + sym, JSON.stringify(out)); } catch (e) {}
    return out;
  }).catch(function () { return null; });
}

/* ---------- 내 종목 (보유 · 관심) ---------- */
function dvMine() {
  var q = {}, w = {};
  try { (typeof loadHoldings === "function" ? loadHoldings().lots : []).forEach(function (L) { q[L.s] = (q[L.s] || 0) + (L.side === "sell" ? -1 : 1) * (+L.q || 0); }); } catch (e) {}
  try { (typeof loadWatch === "function" ? loadWatch() : []).forEach(function (x) { w[x.s] = 1; }); } catch (e) {}
  Object.keys(q).forEach(function (s) { if (q[s] <= 1e-9) delete q[s]; });
  return { qty: q, watch: w };
}

/* ---------- 계좌별 세후 (1년 단위, 배당 재투자) ----------
   o: { mode: "year"|"once", amt(원), years, y(배당률), g(주가 상승률), kind, low(총급여 5,500만원 이하), seo(서민형 ISA), age("55"|"70"|"80") } */
function dvSim(o) {
  var D = DIV_TAX, N = Math.max(1, Math.min(40, Math.round(o.years) || 1)), C = [];
  for (var i = 0; i < N; i++) C.push(o.mode === "once" ? (i === 0 ? o.amt : 0) : o.amt);
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function general(cs, kind) {
    var B = 0, basis = 0, gross = 0, tax = 0, maxY = 0, td = kind === "us" ? D.us : D.gen;
    cs.forEach(function (c) { B += c; basis += c; var div = B * o.y, gain = B * o.g, t = div * td; gross += div; tax += t; maxY = Math.max(maxY, div); B += gain + div - t; basis += div - t; });
    var cap = B - basis, capTax = cap <= 0 ? 0 : kind === "krEtfFor" ? cap * D.gen : kind === "us" ? Math.max(0, cap - D.usGainDed) * D.usGain : 0;
    return { paid: sum(cs), end: B - capTax, gross: gross, tax: tax + capTax, capTax: capTax, refund: 0, maxY: maxY };
  }
  function split(cap1, capTot) { var a = [], b = [], tot = 0; C.forEach(function (c) { var room = Math.max(0, Math.min(cap1, capTot - tot)), x = Math.min(c, room); a.push(x); b.push(c - x); tot += x; }); return [a, b]; }
  var gen = general(C, o.kind);
  // ISA
  var ik = o.kind === "us" ? "krEtfFor" : o.kind, sp = split(D.isaYear, D.isaTotal), B = 0, gross = 0, gt = 0;
  sp[0].forEach(function (c) { B += c; var div = B * o.y, gain = B * o.g; gross += div; if (ik === "krEtfFor") gt += gain; B += div + gain; });
  var inc = gross + gt, free = o.seo ? D.isaFreeSeo : D.isaFree, itax = N < D.isaMin ? Math.max(0, inc) * D.gen : Math.max(0, inc - free) * D.isaOver;
  var iov = general(sp[1], o.kind);
  var isa = { paid: sum(C), end: B - itax + iov.end, gross: gross + iov.gross, tax: itax + iov.tax, refund: 0, over: sum(sp[1]), early: N < D.isaMin, sub: o.kind === "us", maxY: iov.maxY };
  // 연금저축
  var pk = o.kind === "krStock" ? "krEtfDom" : o.kind === "us" ? "krEtfFor" : o.kind, sp2 = split(D.penYear, Infinity), B2 = 0, g2 = 0, ded = 0, ref = 0, rate = o.low ? D.penDedHi : D.penDedLo;
  sp2[0].forEach(function (c) { var d = Math.min(c, D.penDed); ded += d; ref += d * rate; B2 += c; var div = B2 * o.y, gain = B2 * o.g; g2 += div; B2 += div + gain; });
  var paidIn = sum(sp2[0]), base = Math.max(0, B2 - (paidIn - ded)), ptax = base * (D.penTax[o.age] || D.penTax["55"]);
  var pov = general(sp2[1], o.kind);
  var pen = { paid: sum(C), end: B2 - ptax + pov.end, gross: g2 + pov.gross, tax: ptax + pov.tax, refund: ref, over: sum(sp2[1]), sub: o.kind === "krStock" || o.kind === "us", big: base / 10 > D.penCap, maxY: pov.maxY };
  return { gen: gen, isa: isa, pen: pen, N: N };
}

/* ============================================================ 화면 ============================================================ */
function renderDiv() {
  var box = document.getElementById("dvBody"); if (!box) return;
  if (!DV.rows) { box.innerHTML = '<div class="dvEmpty">배당 기록을 불러오는 중…</div>'; dvEnsure().then(function () { renderDiv(); }); return; }
  if (!DV.rows.length) { box.innerHTML = '<div class="dvEmpty">' + dvEsc(DV.err || "배당 기록이 있는 종목을 찾지 못했어요.") + '</div>'; return; }
  var h = '<div class="mkTabs dvTabs">' + DV_TABS.map(function (t) { return '<button data-dvt="' + t[0] + '" class="' + (DV.tab === t[0] ? "on" : "") + '">' + t[1] + '</button>'; }).join("") + '</div><div id="dvPane"></div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-dvt]"), function (b) { b.onclick = function () { DV.tab = b.getAttribute("data-dvt"); dvSaveState(); renderDiv(); }; });
  var pane = document.getElementById("dvPane");
  if (DV.tab === "acct") dvAcctRender(pane); else if (DV.tab === "cal") dvCalRender(pane); else dvGoalRender(pane);
}
function dvAsOfTxt() { var t = DV.asOf ? Date.parse(DV.asOf) : Date.now(), d = dvKst(t); return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCDate(); }
function dvKpi(l, v, s) { return '<div class="kpi"><div class="kl">' + l + '</div><div class="kv">' + v + (s ? '<small>' + s + '</small>' : '') + '</div></div>'; }
function dvBars(vals, labels, fmt, hl) {
  var mx = Math.max.apply(null, vals.concat([1]));
  return '<div class="dvBars">' + vals.map(function (v, i) { return '<div class="dvBar' + (hl === i ? ' on' : '') + '"><span class="dvBarV">' + (v > 0 ? fmt(v) : "") + '</span><i style="height:' + Math.max(v > 0 ? 3 : 0, Math.round(v / mx * 100)) + '%"></i><span class="dvBarL">' + labels[i] + '</span></div>'; }).join("") + '</div>';
}
function dvOpen(sym) { if (typeof navTo === "function") navTo("single", "analysis"); else switchTab("single"); var i = document.getElementById("searchInput"); if (i) i.value = sym; if (typeof loadSymbol === "function") loadSymbol(sym); }
function dvBindOpen(box) { Array.prototype.forEach.call(box.querySelectorAll("[data-dvopen]"), function (b) { b.onclick = function () { dvOpen(b.getAttribute("data-dvopen")); }; }); }
function dvNum(v, def) { v = parseFloat(String(v).replace(/,/g, "")); return isFinite(v) ? v : def; }

/* ---------- ① 목표 배당 → 필요 투자금 ---------- */
function dvGoalRender(pane) {
  var G = DV.goal, M = Math.max(1, G.m) * 1e4, rows = dvMk(DV.rows.filter(dvOk), G.mk);
  rows.forEach(function (r) { r.need = dvNeed(M, r.yld, dvRate(r, G.base)); });
  var srt = { need: function (a, b) { return a.need - b.need; }, month: function (a, b) { return b.n - a.n || a.need - b.need; }, grow: function (a, b) { var x = DV.hist[a.sym], y = DV.hist[b.sym]; return ((y && y.g5) != null ? y.g5 : -9) - ((x && x.g5) != null ? x.g5 : -9); }, name: function (a, b) { return a.name < b.name ? -1 : 1; } }[G.sort] || null;
  rows.sort(srt || function (a, b) { return a.need - b.need; });
  var ys = rows.map(function (r) { return r.yld; }).sort(function (a, b) { return a - b; }), med = ys.length ? ys[Math.floor(ys.length / 2)] : null;
  var baseTxt = { gen: "세후 · 일반계좌", pen: "세후 · 연금 수령(5.5%)", pre: "세전" }[G.base];
  var h = '<div class="mkStep"><b>1</b>매달 받고 싶은 배당</div>' +
    '<div class="dvForm"><label class="dvF"><span>월 목표</span><div class="dvIn"><input id="dvM" type="number" inputmode="numeric" min="1" step="10" value="' + G.m + '"><em>만원</em></div></label>' +
    '<label class="dvF"><span>기준</span><select id="dvBase"><option value="gen"' + (G.base === "gen" ? " selected" : "") + '>세후 · 일반 15.4%</option><option value="pen"' + (G.base === "pen" ? " selected" : "") + '>세후 · 연금 5.5%</option><option value="pre"' + (G.base === "pre" ? " selected" : "") + '>세전</option></select></label>' +
    '<div class="dvF dvChips"><span>빠른 선택</span><div>' + [50, 100, 200, 300].map(function (v) { return '<button class="chip' + (G.m === v ? ' on' : '') + '" data-dvm="' + v + '">' + v + '만</button>'; }).join("") + '</div></div></div>' +
    '<div class="kpiStrip">' + dvKpi("배당 주는 종목", rows.length + "<small>개</small>") + dvKpi("배당률 중앙값", dvP(med)) + dvKpi("중앙값이면 필요한 돈", dvEok(dvNeed(M, med, G.base === "pre" ? 0 : G.base === "pen" ? DIV_TAX.penTax["55"] : DIV_TAX.gen))) + dvKpi("기준일", dvAsOfTxt(), "종가") + '</div>' +
    '<div class="mkStep"><b>2</b>종목별로 필요한 투자금 <small class="briefDim">월 ' + G.m + '만원 · ' + baseTxt + '</small></div>' +
    '<div class="dvBar2"><div class="pills dvPills">' + [["all", "전체"], ["kr", "국내"], ["us", "미국"], ["etf", "ETF만"]].map(function (x) { return '<button data-dvmk="' + x[0] + '" class="' + (G.mk === x[0] ? "active" : "") + '">' + x[1] + '</button>'; }).join("") + '</div>' +
    '<select id="dvSort"><option value="need"' + (G.sort === "need" ? " selected" : "") + '>필요 투자금 적은 순</option><option value="month"' + (G.sort === "month" ? " selected" : "") + '>자주 주는 순 (월배당 먼저)</option><option value="grow"' + (G.sort === "grow" ? " selected" : "") + '>5년 배당 성장 순</option><option value="name"' + (G.sort === "name" ? " selected" : "") + '>이름 순</option></select></div>';
  var show = G.more ? rows : rows.slice(0, 20);
  h += '<div class="tableWrap"><table class="dvTable"><thead><tr><th>담기</th><th class="l">종목</th><th>배당률</th><th>주기</th><th>1년 주당 배당</th><th>필요 투자금</th><th>5년 배당 성장</th></tr></thead><tbody>' +
    show.map(function (r) { var on = DV.pick.indexOf(r.sym) >= 0; return '<tr' + (on ? ' class="on"' : '') + '><td><input type="checkbox" data-dvpick="' + r.sym + '"' + (on ? " checked" : "") + '></td><td class="l"><button class="linkBtn" data-dvopen="' + r.sym + '">' + dvEsc(r.name) + '</button><small>' + r.sym + ' · ' + DV_KIND[r.kind] + '</small></td><td><b>' + dvP(r.yld, 2) + '</b>' + (r.trap ? '<small class="dvWarn">함정 확인</small>' : '') + '</td><td>' + r.freq + ' ' + r.n + '회</td><td>' + dvPer(r, r.ttm) + '</td><td><b>' + dvMan(r.need) + '</b></td><td data-dvg="' + r.sym + '">' + dvGrowTxt(DV.hist[r.sym]) + '</td></tr>'; }).join("") + '</tbody></table></div>';
  if (rows.length > 20) h += '<button class="chip dvMore" id="dvMore">' + (G.more ? "20개만 보기" : "모두 보기 (" + rows.length + "개)") + '</button>';
  h += '<div class="mkStep"><b>3</b>담은 종목으로 묶음 만들기 <small class="briefDim">최대 6개 · 비중을 바꿔 보세요</small></div><div id="dvMix"></div>';
  h += '<details class="howto"><summary>숫자 읽는 법</summary><div class="body"><ul>' +
    '<li><b>배당률</b> = 최근 1년 동안 실제로 준 배당 ÷ ' + dvAsOfTxt() + ' 종가. 회사가 배당을 늘리거나 줄이면 바로 달라져요.</li>' +
    '<li><b>필요 투자금</b> = 월 목표 × 12 ÷ (1 − 세율) ÷ 배당률. 미국 직접투자는 현지 원천징수 15%, 나머지는 15.4%로 계산했어요.</li>' +
    '<li><b>함정 확인</b>: 배당률 8% 이상. 주가가 크게 빠져서 배당률이 높아 보이는 경우가 많았어요. 20%를 넘는 값은 데이터 오류일 가능성이 커서 목록에서 뺐어요.</li>' +
    '<li><b>5년 배당 성장</b> = 5년 전 1년치 배당 → 작년 1년치 배당의 연평균 변화. 전년보다 10% 넘게 줄어든 해는 <b>삭감</b>으로 셌어요.</li>' +
    '<li>환율은 계산에 쓰지 않아요(배당률은 같은 통화끼리 나눈 값). 배당락일에는 주가가 배당만큼 빠지는 게 보통이라 배당만으로 수익을 판단하면 안 돼요.</li></ul></div></details>';
  pane.innerHTML = h;
  // 이벤트
  var mi = document.getElementById("dvM"); mi.onchange = function () { G.m = Math.max(1, Math.round(dvNum(mi.value, 100))); dvSaveState(); renderDiv(); };
  document.getElementById("dvBase").onchange = function () { G.base = this.value; dvSaveState(); renderDiv(); };
  document.getElementById("dvSort").onchange = function () { G.sort = this.value; dvSaveState(); if (G.sort === "grow") dvHistMany(rows.slice(0, 40).map(function (r) { return r.sym; }), null).then(function () { renderDiv(); }); renderDiv(); };
  Array.prototype.forEach.call(pane.querySelectorAll("[data-dvm]"), function (b) { b.onclick = function () { G.m = +b.getAttribute("data-dvm"); dvSaveState(); renderDiv(); }; });
  Array.prototype.forEach.call(pane.querySelectorAll("[data-dvmk]"), function (b) { b.onclick = function () { G.mk = b.getAttribute("data-dvmk"); dvSaveState(); renderDiv(); }; });
  var mb = document.getElementById("dvMore"); if (mb) mb.onclick = function () { G.more = !G.more; renderDiv(); };
  Array.prototype.forEach.call(pane.querySelectorAll("[data-dvpick]"), function (c) { c.onchange = function () { var s = c.getAttribute("data-dvpick"), i = DV.pick.indexOf(s); if (c.checked && i < 0) { if (DV.pick.length >= 6) { c.checked = false; alert("묶음은 6개까지 담을 수 있어요."); return; } DV.pick.push(s); } if (!c.checked && i >= 0) DV.pick.splice(i, 1); c.closest("tr").classList.toggle("on", c.checked); dvSaveState(); dvMixRender(); }; });
  dvBindOpen(pane);
  dvMixRender();
  // 보이는 종목의 5년 배당 이력은 열 때만 받는다 (CDN 캐시)
  dvHistMany(show.slice(0, 20).map(function (r) { return r.sym; }), function (s) { var td = pane.querySelector('[data-dvg="' + s + '"]'); if (td) td.innerHTML = dvGrowTxt(DV.hist[s]); });
}
function dvMixRender() {
  var el = document.getElementById("dvMix"); if (!el) return;
  var G = DV.goal, M = Math.max(1, G.m) * 1e4, by = {}; DV.rows.forEach(function (r) { by[r.sym] = r; });
  var P = DV.pick.filter(function (s) { return by[s]; }).map(function (s) { return by[s]; });
  if (!P.length) { el.innerHTML = '<div class="dvEmpty sm">표에서 <b>담기</b>를 체크하면 여러 종목을 섞었을 때 필요한 돈과 달마다 받는 돈을 보여줘요.</div>'; return; }
  var tw = 0; P.forEach(function (r) { if (!(DV.w[r.sym] > 0)) DV.w[r.sym] = Math.round(100 / P.length); tw += DV.w[r.sym]; });
  var yMix = 0, tEff = 0; P.forEach(function (r) { var w = DV.w[r.sym] / tw; yMix += w * r.yld; tEff += w * r.yld * dvRate(r, G.base); }); tEff = yMix > 0 ? tEff / yMix : 0;
  var need = dvNeed(M, yMix, tEff), mon = []; for (var m = 1; m <= 12; m++) { var v = 0; P.forEach(function (r) { var w = DV.w[r.sym] / tw; v += need * w * r.yld * (r.mon[m] || 0) * (1 - dvRate(r, G.base)); }); mon.push(v); }
  var mn = Math.min.apply(null, mon), mx = Math.max.apply(null, mon), cm = dvKst(Date.now()).getUTCMonth();
  var h = '<div class="tableWrap"><table class="dvTable dvMixT"><thead><tr><th class="l">종목</th><th>비중</th><th>배당률</th><th>주기</th><th>이 종목에 넣을 돈</th><th></th></tr></thead><tbody>' +
    P.map(function (r) { var w = DV.w[r.sym] / tw; return '<tr><td class="l">' + dvEsc(r.name) + '</td><td><div class="dvIn sm"><input type="number" min="0" max="100" data-dvw="' + r.sym + '" value="' + DV.w[r.sym] + '"><em>%</em></div></td><td>' + dvP(r.yld, 2) + '</td><td>' + r.freq + '</td><td><b>' + dvMan(need * w) + '</b></td><td><button class="chip" data-dvdel="' + r.sym + '">빼기</button></td></tr>'; }).join("") + '</tbody></table></div>' +
    '<div class="kpiStrip">' + dvKpi("묶음 배당률", dvP(yMix, 2)) + dvKpi("필요한 돈", dvEok(need)) + dvKpi("가장 적은 달", dvEok(mn), "원") + dvKpi("가장 많은 달", dvEok(mx), "원") + '</div>' +
    '<div class="dvCap">이 묶음이면 달마다 받는 돈 (' + ({ gen: "세후", pen: "세후·연금", pre: "세전" })[G.base] + ' · 작년에 준 달 기준)</div>' +
    dvBars(mon, "1 2 3 4 5 6 7 8 9 10 11 12".split(" ").map(function (x) { return x + "월"; }), dvEok, cm) +
    '<p class="mentalNote">월 평균은 ' + G.m + '만원이지만 ' + (mx > mn * 2 && mn >= 0 ? '달마다 차이가 커요. 분기배당 종목은 3·6·9·12월처럼 특정 달에 몰려 들어와요. 매달 비슷하게 받고 싶다면 월배당 종목이나 지급 달이 다른 종목을 섞어 보세요.' : '달마다 비교적 고르게 들어와요.') + '</p>';
  el.innerHTML = h;
  Array.prototype.forEach.call(el.querySelectorAll("[data-dvw]"), function (i) { i.onchange = function () { DV.w[i.getAttribute("data-dvw")] = Math.max(0, dvNum(i.value, 0)); dvSaveState(); dvMixRender(); }; });
  Array.prototype.forEach.call(el.querySelectorAll("[data-dvdel]"), function (b) { b.onclick = function () { var s = b.getAttribute("data-dvdel"); DV.pick = DV.pick.filter(function (x) { return x !== s; }); dvSaveState(); renderDiv(); }; });
}

/* ---------- ② 계좌별 세후 비교 ---------- */
function dvAcctRender(pane) {
  var A = DV.acct, by = {}; DV.rows.forEach(function (r) { by[r.sym] = r; });
  if (!A.sym || (A.sym !== "custom" && !by[A.sym])) { A.sym = by.SCHD ? "SCHD" : DV.rows[0].sym; A.y = +(by[A.sym].yld * 100).toFixed(2); }
  var r = by[A.sym], kind = A.sym === "custom" ? (A.kind || "krEtfFor") : r.kind;
  var list = DV.rows.filter(dvOk).slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  var h = '<div class="mkStep"><b>1</b>같은 돈을 어디에 넣을까</div><div class="dvForm">' +
    '<label class="dvF wide"><span>종목</span><select id="dvAs"><option value="custom"' + (A.sym === "custom" ? " selected" : "") + '>직접 입력</option>' + list.map(function (x) { return '<option value="' + x.sym + '"' + (x.sym === A.sym ? " selected" : "") + '>' + dvEsc(x.name) + ' · ' + dvP(x.yld, 1) + '</option>'; }).join("") + '</select></label>' +
    (A.sym === "custom" ? '<label class="dvF"><span>종류</span><select id="dvAk">' + Object.keys(DV_KIND).map(function (k) { return '<option value="' + k + '"' + (k === kind ? " selected" : "") + '>' + DV_KIND[k] + '</option>'; }).join("") + '</select></label>' : '') +
    '<label class="dvF"><span>배당률</span><div class="dvIn"><input id="dvAy" type="number" step="0.1" value="' + A.y + '"><em>%/년</em></div></label>' +
    '<label class="dvF"><span>주가 변화 가정</span><div class="dvIn"><input id="dvAg" type="number" step="0.5" value="' + A.g + '"><em>%/년</em></div></label>' +
    '<label class="dvF"><span>넣는 방식</span><select id="dvAm"><option value="year"' + (A.mode === "year" ? " selected" : "") + '>매년 넣기</option><option value="once"' + (A.mode === "once" ? " selected" : "") + '>한 번에</option></select></label>' +
    '<label class="dvF"><span>금액</span><div class="dvIn"><input id="dvAa" type="number" step="100" value="' + A.amt + '"><em>만원</em></div></label>' +
    '<label class="dvF"><span>기간</span><div class="dvIn"><input id="dvAn" type="number" min="1" max="40" value="' + A.years + '"><em>년</em></div></label>' +
    '<label class="dvF"><span>연금 받을 나이</span><select id="dvAage"><option value="55"' + (A.age === "55" ? " selected" : "") + '>55~69세 (5.5%)</option><option value="70"' + (A.age === "70" ? " selected" : "") + '>70~79세 (4.4%)</option><option value="80"' + (A.age === "80" ? " selected" : "") + '>80세 이상 (3.3%)</option></select></label>' +
    '<label class="dvCk"><input type="checkbox" id="dvAlow"' + (A.low ? " checked" : "") + '> 총급여 5,500만원 이하 (세액공제 16.5%)</label>' +
    '<label class="dvCk"><input type="checkbox" id="dvAseo"' + (A.seo ? " checked" : "") + '> 서민형 ISA (비과세 400만원)</label></div>';
  var S = dvSim({ mode: A.mode, amt: A.amt * 1e4, years: A.years, y: A.y / 100, g: A.g / 100, kind: kind, low: A.low, seo: A.seo, age: A.age });
  var acc = [["gen", "일반계좌", S.gen], ["isa", "ISA", S.isa], ["pen", "연금저축", S.pen]], best = acc.slice().sort(function (a, b) { return (b[2].end + b[2].refund) - (a[2].end + a[2].refund); })[0][0];
  function notes(k, x) {
    var n = [];
    if (k === "gen") { n.push(kind === "us" ? "배당 15%(현지 원천징수)" + (A.g > 0 ? " · 팔 때 양도세 22%(연 250만원 공제)" : "") : "배당 15.4%" + (kind === "krEtfFor" && A.g > 0 ? " · 팔 때 차익에도 15.4%" : kind === "krStock" || kind === "krEtfDom" ? " · 매매차익 비과세" : "")); if (x.maxY > DIV_TAX.fin) n.push('<span class="dvWarn">한 해 배당이 2,000만원을 넘어 금융소득 종합과세 대상이 될 수 있어요</span>'); }
    if (k === "isa") { n.push("운용 중 세금 없음 → " + (S.N >= DIV_TAX.isaMin ? "끝에 이익 " + (A.seo ? "400" : "200") + "만원까지 비과세, 넘는 부분 9.9%" : '<span class="dvWarn">3년 전에 해지하면 15.4% 그대로</span>')); if (x.over > 0) n.push("한도(연 2,000만·총 1억) 넘는 " + dvMan(x.over) + "은 일반계좌로 계산"); if (x.sub) n.push("미국 직접투자는 ISA에 못 담아요 → 같은 지수의 국내 상장 ETF로 계산"); }
    if (k === "pen") { n.push("운용 중 세금 없음 → 55세 이후 연금으로 받을 때 " + dvP(DIV_TAX.penTax[A.age], 1)); n.push("세액공제: 연 600만원까지 " + (A.low ? "16.5%" : "13.2%") + " 환급 (투자금과 따로 표시)"); if (x.over > 0) n.push("연 1,800만원 넘는 " + dvMan(x.over) + "은 일반계좌로 계산"); if (x.sub) n.push((kind === "krStock" ? "개별 주식은" : "미국 직접투자는") + " 연금저축에 못 담아요 → 같은 성격 ETF로 계산"); n.push("55세 전에 연금 외로 찾으면 16.5%"); if (x.big) n.push('<span class="dvWarn">연 1,500만원 넘게 받으면 종합과세 또는 16.5% 분리과세</span>'); }
    return n;
  }
  h += '<div class="mkStep"><b>2</b>' + S.N + '년 뒤 세후 비교 <small class="briefDim">넣은 돈 ' + dvMan(S.gen.paid) + ' · 배당은 받는 대로 다시 투자</small></div>' +
    '<div class="dvAccs">' + acc.map(function (a) { var x = a[2], prof = x.end - x.paid; return '<div class="dvAcc' + (a[0] === best ? ' best' : '') + '"><div class="dvAccH"><b>' + a[1] + '</b>' + (a[0] === best ? '<em>환급 포함 1위</em>' : '') + '</div>' +
      '<div class="dvAccV">' + dvMan(x.end) + '</div><div class="dvAccS">세후 평가액 · 이익 <b class="' + (prof >= 0 ? "pos" : "neg") + '">' + dvMan(prof) + '</b></div>' +
      '<div class="dvAccRows"><div><span>세전 배당 합계</span><b>' + dvMan(x.gross) + '</b></div><div><span>낸 세금</span><b>' + dvMan(x.tax) + '</b></div><div><span>세액공제 환급</span><b>' + (x.refund ? "+" + dvMan(x.refund) : "-") + '</b></div><div class="sum"><span>세후 + 환급</span><b>' + dvMan(x.end + x.refund) + '</b></div></div>' +
      '<ul class="dvNotes">' + notes(a[0], x).map(function (t) { return '<li>' + t + '</li>'; }).join("") + '</ul></div>'; }).join("") + '</div>';
  var bx = acc.filter(function (a) { return a[0] === best; })[0][2], diff = bx.end + bx.refund - S.gen.end;
  h += '<p class="mentalNote">' + (best === "gen" ? "이 조건에선 일반계좌와 차이가 거의 없어요." : "같은 돈인데 " + (best === "isa" ? "ISA" : "연금저축") + "가 일반계좌보다 " + dvMan(diff) + " 더 남아요" + (best === "pen" ? " (세액공제 환급 " + dvMan(S.pen.refund) + " 포함)" : "") + ". 다만 ISA는 3년, 연금저축은 55세까지 묶이는 돈이라 언제 쓸 돈인지 먼저 정하세요.") + '</p>' +
    '<details class="howto"><summary>세율 기준 (' + DIV_TAX.asOf + ' 확인)</summary><div class="body"><ul>' +
    '<li>일반계좌: 배당 15.4% (미국 직접투자 배당은 현지 15%). 연 금융소득이 2,000만원을 넘으면 다른 소득과 합쳐 최대 49.5%.</li>' +
    '<li>고배당기업 분리과세 (2026~2029년 지급 배당): 2,000만원 이하 14% · 3억 이하 20% · 50억 이하 25% · 50억 초과 30%. 종합소득세 신고 때 따로 신청해야 해요. 이 계산에는 넣지 않았어요.</li>' +
    '<li>ISA: 연 2,000만원·총 1억원 납입, 3년 의무. 이익 200만원(서민형 400만원) 비과세, 넘는 부분 9.9% 분리과세. 국내 주식 매매차익은 원래 비과세라 이익에서 뺐어요.</li>' +
    '<li>연금저축: 연 1,800만원 납입, 세액공제는 600만원까지(IRP 합산 900만원). 총급여 5,500만원 이하 16.5%, 초과 13.2%. 받을 때 55~69세 5.5% · 70~79세 4.4% · 80세 이상 3.3%. 공제받지 않은 원금은 세금 없이 돌려받아요.</li>' +
    '<li>' + DIV_TAX.pending + '</li><li>개인 상황(다른 소득·건강보험료 등)은 반영하지 않은 단순 계산이에요. 실제 신고 전에는 증권사·세무 상담으로 확인하세요.</li><li>출처: ' + DIV_TAX.src + '</li></ul></div></details>';
  pane.innerHTML = h;
  function bind(id, f) { var e = document.getElementById(id); if (e) e.onchange = function () { f(e); dvSaveState(); renderDiv(); }; }
  bind("dvAs", function (e) { A.sym = e.value; if (by[A.sym]) A.y = +(by[A.sym].yld * 100).toFixed(2); });
  bind("dvAk", function (e) { A.kind = e.value; });
  bind("dvAy", function (e) { A.y = dvNum(e.value, A.y); });
  bind("dvAg", function (e) { A.g = dvNum(e.value, 0); });
  bind("dvAm", function (e) { A.mode = e.value; });
  bind("dvAa", function (e) { A.amt = Math.max(1, dvNum(e.value, 1000)); });
  bind("dvAn", function (e) { A.years = Math.max(1, Math.min(40, Math.round(dvNum(e.value, 10)))); });
  bind("dvAage", function (e) { A.age = e.value; });
  bind("dvAlow", function (e) { A.low = e.checked; });
  bind("dvAseo", function (e) { A.seo = e.checked; });
}

/* ---------- ③ 배당 캘린더 ---------- */
/* 앞으로 12개월: 최근 1년 배당락 기록을 1년 뒤로 옮긴 '예상' + 이번 달 이미 지난 실제 기록 + 국내는 네이버 배당락일(확정) */
function dvEvents(rows, months) {
  var now = Date.now(), s0 = dvMonthStart(now, 0), s1 = dvMonthStart(now, months || 12), out = [];
  rows.forEach(function (r) {
    var f = DV.fund[r.sym], conf = f && f.ex && f.ex > now - 31 * DV_D ? f.ex : null;
    r.ev.forEach(function (e) {
      if (e.t >= s0 && e.t <= now) out.push({ r: r, t: e.t, a: e.a, st: "past" });
      if (e.t > now - 365 * DV_D && e.t <= now) { var p = e.t + 364 * DV_D; if (p > now && p < s1) { if (conf && Math.abs(conf - p) < 45 * DV_D) return; out.push({ r: r, t: p, a: e.a, st: "est" }); } }
    });
    if (conf && conf >= s0 && conf < s1 && !out.some(function (x) { return x.r === r && Math.abs(x.t - conf) < 3 * DV_D; })) out.push({ r: r, t: conf, a: r.ev.length ? r.ev[r.ev.length - 1].a : 0, st: "conf", pay: f.pay });
  });
  return out.sort(function (a, b) { return a.t - b.t; });
}
function dvCalRender(pane) {
  var mine = dvMine(), by = {}; DV.rows.forEach(function (r) { by[r.sym] = r; });
  var mySyms = Object.keys(mine.qty).concat(Object.keys(mine.watch)).filter(function (s, i, a) { return by[s] && a.indexOf(s) === i; });
  if (!DV.cal.scope) DV.cal.scope = mySyms.length ? "mine" : "all";
  var scope = DV.cal.scope, rows = scope === "mine" ? mySyms.map(function (s) { return by[s]; }) : DV.rows.filter(dvOk);
  var krNeed = rows.filter(function (r) { return r.krw && !DV.fund[r.sym]; }).map(function (r) { return r.sym; });
  if (scope === "mine" && krNeed.length && !DV.cal.fetching) { DV.cal.fetching = true; Promise.all(krNeed.slice(0, 20).map(dvFund)).then(function () { DV.cal.fetching = false; if (DV.tab === "cal") renderDiv(); }); }
  var ev = dvEvents(rows, 12), now = Date.now(), fx = DV.fx || 1350;
  function amt(e) { var q = mine.qty[e.r.sym]; if (!q) return 0; return q * e.a * (e.r.krw ? 1 : fx); }
  var months = []; for (var i = 0; i < 12; i++) months.push({ s: dvMonthStart(now, i), e: dvMonthStart(now, i + 1), list: [], sum: 0 });
  ev.forEach(function (e) { for (var i = 0; i < 12; i++) if (e.t >= months[i].s && e.t < months[i].e) { months[i].list.push(e); months[i].sum += amt(e); break; } });
  var heldN = mySyms.filter(function (s) { return mine.qty[s]; }).length, yearSum = months.reduce(function (s, m) { return s + m.sum; }, 0);
  var h = '<div class="dvBar2"><div class="pills dvPills"><button data-dvsc="mine" class="' + (scope === "mine" ? "active" : "") + '">내 종목 (보유·관심 ' + mySyms.length + ')</button><button data-dvsc="all" class="' + (scope === "all" ? "active" : "") + '">전체 배당 종목 ' + DV.rows.filter(dvOk).length + '</button></div></div>';
  if (scope === "mine" && !mySyms.length) h += '<div class="dvEmpty sm">보유 기록이나 관심 종목 중에 배당을 주는 종목이 없어요. <b>내 자산</b>에 보유 기록을 넣거나 <b>종목</b> 화면에서 ☆로 관심 종목을 추가하면 여기에 모여요. 지금은 전체 배당 종목을 볼 수 있어요.</div>';
  h += '<div class="kpiStrip">' + dvKpi("이번 달 배당락", months[0].list.length + "<small>건</small>") + dvKpi("앞으로 12개월", ev.filter(function (e) { return e.st !== "past"; }).length + "<small>건</small>") +
    (heldN ? dvKpi("12개월 예상 배당", dvEok(yearSum), "원 세전") + dvKpi("월 평균", dvEok(yearSum / 12), "원 세전") : dvKpi("대상 종목", rows.length + "<small>개</small>") + dvKpi("기준일", dvAsOfTxt())) + '</div>';
  if (heldN && yearSum > 0) h += '<div class="dvCap">내 보유 수량 기준 달마다 받을 배당 (세전 · 원화 환산 · 배당락 달 기준)</div>' + dvBars(months.map(function (m) { return m.sum; }), months.map(function (m) { return (dvKst(m.s).getUTCMonth() + 1) + "월"; }), dvEok, 0);
  h += '<div class="dvCal">' + months.map(function (m, i) {
    var d = dvKst(m.s), lim = scope === "all" ? 10 : 30, L = m.list.slice().sort(function (a, b) { return (mine.qty[b.r.sym] ? 1 : 0) - (mine.qty[a.r.sym] ? 1 : 0) || a.t - b.t; });
    return '<div class="dvMon' + (i === 0 ? ' now' : '') + '"><div class="dvMonH"><b>' + (d.getUTCMonth() + 1) + '월</b><span>' + (d.getUTCFullYear() !== dvKst(now).getUTCFullYear() ? d.getUTCFullYear() + " · " : "") + m.list.length + '건' + (m.sum ? ' · ' + dvEok(m.sum) + '원' : '') + '</span></div>' +
      (L.length ? '<ul>' + L.slice(0, lim).sort(function (a, b) { return a.t - b.t; }).map(function (e) { var q = mine.qty[e.r.sym], dd = dvKst(e.t); return '<li class="' + e.st + '"><span class="dvDay">' + dd.getUTCDate() + '일</span><button class="linkBtn" data-dvopen="' + e.r.sym + '">' + dvEsc(dvShort(e.r)) + '</button><span class="dvTag">' + ({ past: "지남", est: "예상", conf: "확정" })[e.st] + '</span><span class="dvAmt">' + (q ? dvMan(amt(e)) : dvPer(e.r, e.a)) + '</span></li>'; }).join("") + (L.length > lim ? '<li class="more">외 ' + (L.length - lim) + '개</li>' : '') + '</ul>' : '<div class="dvNone">배당락 없음</div>') + '</div>';
  }).join("") + '</div>';
  h += '<details class="howto"><summary>캘린더 읽는 법</summary><div class="body"><ul><li>날짜는 <b>배당락일</b>이에요. 그 전 거래일까지 갖고 있어야 배당을 받아요. 실제 입금은 보통 미국 2~4주 뒤, 국내 결산배당은 3~4월이에요.</li><li><b>예상</b> = 작년 같은 때 배당락일을 1년 뒤로 옮긴 날짜. 회사 사정에 따라 며칠 달라지거나 건너뛸 수 있어요.</li><li><b>확정</b> = 네이버 증권에 공시된 국내 종목 배당락일 (내 종목만 조회).</li><li>금액: 보유 수량이 있으면 수량 × 최근 1회 주당 배당(달러는 오늘 환율 ' + Math.round(fx).toLocaleString("ko-KR") + '원), 없으면 주당 배당이에요. 세전 금액이에요.</li></ul></div></details>';
  pane.innerHTML = h;
  Array.prototype.forEach.call(pane.querySelectorAll("[data-dvsc]"), function (b) { b.onclick = function () { DV.cal.scope = b.getAttribute("data-dvsc"); dvSaveState(); renderDiv(); }; });
  dvBindOpen(pane);
}

/* ============================================================
   채널 카드 (운영자) — 양식집(tpl) 틀 그대로: 순위 · 표 · 표 · 달력
   ============================================================ */
var DV_CARD = { month: 100, scen: { mode: "year", amt: 1e7, years: 10, y: 0.04, g: 0, kind: "krEtfFor", low: false, seo: false, age: "55" } };
function dvCardRows(mkSel, withTrap) { var mk = mkSel === "kr" ? "kr" : mkSel === "us" ? "us" : "all"; return dvMk((DV.rows || []).filter(function (r) { return dvOk(r) && r.yld < 0.15 && (withTrap || !r.trap); }), mk); }
function dvMkName(mkSel) { return mkSel === "kr" ? "국내" : mkSel === "us" ? "미국" : "전체"; }
function dvSpec(cat, src, mkSel) {
  if (!DV.rows || !DV.rows.length) return null;
  var date = dvAsOfTxt(), M = DV_CARD.month * 1e4, rows = dvCardRows(mkSel), mn = dvMkName(mkSel);
  var source = "야후 파이낸스 배당 기록 · " + date + " 종가 · StockMind 자동 집계";
  if (cat === "rank" && src === "divNeed") {
    var l = rows.map(function (r) { return { r: r, need: dvNeed(M, r.yld, dvRate(r, "gen")) }; }).sort(function (a, b) { return a.need - b.need; }).slice(0, 12);
    return { meta: { title: "월 " + DV_CARD.month + "만원 배당받으려면", sub: mn + " 배당 종목 · 세후(15.4%) 월 " + DV_CARD.month + "만원에 필요한 투자금 · 적은 순", source: source, catName: "배당" },
      spec: { items: l.map(function (x, i) { return { rank: i + 1, name: dvShort(x.r), value: dvEok(x.need) + "원", sub: "배당 " + dvP(x.r.yld, 1) + " · " + x.r.freq + "배당" }; }) } };
  }
  if (cat === "table" && src === "divTop") {
    var t = dvCardRows(mkSel, true).sort(function (a, b) { return b.yld - a.yld; }).slice(0, 10);
    return { meta: { title: "배당률 TOP10, 믿어도 될까", sub: mn + " · 최근 1년 실제 배당 ÷ 종가 · 5년 성장·삭감으로 함정 확인", source: source, catName: "배당" },
      spec: { cols: ["종목", "배당률", "주기", "5년 성장", "삭감"], widths: [0.34, 0.17, 0.13, 0.2, 0.16], hlCols: [1], rows: t.map(function (r) { var hh = DV.hist[r.sym]; return [dvShort(r), dvP(r.yld, 1), r.freq, hh && hh.g5 != null ? dvSP(hh.g5, 1) : "-", hh && hh.full >= 2 ? (hh.cuts ? hh.cuts + "회" : "없음") : "-"]; }), note: "배당률 8% 이상은 주가 급락으로 높아 보이는 경우가 많아요 · 삭감 = 전년보다 10% 넘게 줄어든 해" } };
  }
  if (cat === "table" && src === "divTax") {
    var sc = DV_CARD.scen, S = dvSim(sc), A = [["일반계좌", S.gen], ["ISA", S.isa], ["연금저축", S.pen]];
    return { meta: { title: "같은 돈, 계좌만 바꾸면", sub: "매년 " + dvEok(sc.amt) + "원 · " + sc.years + "년 · 배당 " + dvP(sc.y, 0) + " 재투자 · 주가 변화 0% 가정", source: "세율 " + DIV_TAX.asOf + " 기준 · 국세청·금투협 · StockMind 계산", catName: "배당 세금" },
      spec: { cols: ["계좌", "낸 세금", "세후 평가액", "세액공제", "합계"], widths: [0.16, 0.16, 0.24, 0.18, 0.26], hlCols: [4], rows: A.map(function (a) { function w(v) { return dvMan(v).replace(/원$/, ""); } return [a[0], w(a[1].tax), w(a[1].end), a[1].refund ? "+" + w(a[1].refund) : "-", w(a[1].end + a[1].refund)]; }),
        note: "국내 상장 해외 ETF 기준 · ISA 3년 뒤 200만원 비과세·초과 9.9% · 연금은 55세 이후 5.5% · 한도 넘는 돈은 일반계좌" } };
  }
  if (cat === "calendar" && src === "divMonth") {
    var now = Date.now(), d = dvKst(now), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, evs = {}, cnt = {};
    rows = dvCardRows(mkSel, true); dvEvents(rows, 1).forEach(function (e) { var dd = dvKst(e.t); if (dd.getUTCMonth() + 1 !== m) return; var k = dd.getUTCDate(); (cnt[k] = cnt[k] || []).push(e); });
    Object.keys(cnt).forEach(function (k) { var L = cnt[k].sort(function (a, b) { return b.r.yld - a.r.yld; }); evs[k] = (L.length > 3 ? L.slice(0, 2) : L).map(function (e) { return { t: dvShort(e.r) + (e.st === "est" ? "*" : ""), k: e.r.krw ? "kr" : "us" }; }); if (L.length > 3) evs[k].push({ t: "외 " + (L.length - 2) + "개", k: "" }); });
    var total = Object.keys(cnt).reduce(function (s, k) { return s + cnt[k].length; }, 0);
    return { meta: { title: m + "월 배당락 달력", sub: mn + " 배당 종목 " + total + "건 · 그 전 거래일까지 갖고 있어야 받아요 · *는 작년 기준 예상", source: source, catName: "배당" }, spec: { year: y, month: m, events: evs, today: d.getUTCDate() } };
  }
  return null;
}
(function () {
  if (typeof TPL_SOURCES === "undefined" || typeof tplSpec !== "function") return;
  TPL_SOURCES.rank.push({ id: "divNeed", t: "월 100만원 배당 — 필요 투자금 TOP12" });
  TPL_SOURCES.table.push({ id: "divTop", t: "배당률 TOP10 (5년 성장·삭감)" }, { id: "divTax", t: "같은 돈, 계좌별 세후 (일반·ISA·연금)" });
  TPL_SOURCES.calendar.push({ id: "divMonth", t: "이번 달 배당락 달력" });
  var s0 = tplSpec; tplSpec = function (cat, src, mk) { if (/^div/.test(src || "")) return dvSpec(cat, src, mk); return s0.apply(this, arguments); };
  var p0 = tplPrep; tplPrep = function (cat, mk, src) {
    if (!/^div/.test(src || "")) return p0.apply(this, arguments);
    return dvEnsure().then(function () { if (src === "divTop") return dvHistMany(dvCardRows(mk, true).sort(function (a, b) { return b.yld - a.yld; }).slice(0, 10).map(function (r) { return r.sym; })); });
  };
})();

/* 배당 카드 4장 + 업로드 글 (인스타 · 스레드 본문 · 답글 1 · 답글 2) */
function dvDeckOpen(mkSel) {
  mkSel = mkSel || "all";
  var plan = [["rank", "divNeed", "필요투자금"], ["table", "divTop", "배당률TOP"], ["table", "divTax", "계좌별세금"], ["calendar", "divMonth", "배당락달력"]];
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return Promise.all(plan.map(function (p) { return tplPrep(p[0], mkSel, p[1]); })); }).then(function () {
    var list = plan.map(function (p, i) { var x = dvSpec(p[0], p[1], mkSel); if (!x) return null; return { cv: tplCard(p[0], x.meta, x.spec), name: (i + 1) + "_" + p[2] }; }).filter(Boolean);
    if (!list.length) { alert("배당 데이터가 아직 준비되지 않았어요."); return; }
    var day = typeof pubToday === "function" ? pubToday().replace(/-/g, "") : "", box = document.createElement("div");
    box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">전부 저장</button></div>' + (typeof thrPanelHtml === "function" ? thrPanelHtml("재테크") : "") + '<div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    list.forEach(function (it, i) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_배당_" + day + "_" + it.name + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + it.name.replace("_", ". ") + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
    box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
    if (typeof thrBind === "function") try { thrBind(box, thrDiv(mkSel, list.map(function (it) { return it.name; }))); } catch (e) { console.warn(e); }
    infoModal.open("배당 카드 · " + list.length + "장", box);
  });
}

/* 업로드 글: v11.0 스레드 공식 (첫 줄 → 질문 → 숫자 5줄 → 해석 · 답글 1 한계 · 답글 2 질문) */
function thrDiv(mkSel, names) {
  if (!DV.rows || typeof thrCompose !== "function") return [];
  var M = DV_CARD.month * 1e4, rows = dvCardRows(mkSel), mn = dvMkName(mkSel);
  var L = rows.map(function (r) { return { r: r, need: dvNeed(M, r.yld, dvRate(r, "gen")) }; }).sort(function (a, b) { return a.need - b.need; });
  if (!L.length) return [];
  var ys = rows.map(function (r) { return r.yld; }).sort(function (a, b) { return a - b; }), med = ys[Math.floor(ys.length / 2)];
  var n3 = dvNeed(M, 0.03, DIV_TAX.gen), n4 = dvNeed(M, 0.04, DIV_TAX.gen), nMed = dvNeed(M, med, DIV_TAX.gen);
  var top5 = L.filter(function (x) { return !x.r.trap; }).slice(0, 5).map(function (x) { return dvShort(x.r) + " " + dvEok(x.need) + "원 (배당 " + dvP(x.r.yld, 1) + ")"; });
  var S = dvSim(DV_CARD.scen), acc = [["연금저축", S.pen.end + S.pen.refund], ["ISA", S.isa.end], ["일반계좌", S.gen.end]].sort(function (a, b) { return b[1] - a[1]; });
  var accL = acc.map(function (a) { return a[0] + " " + dvMan(a[1]); }), gap = acc[0][1] - acc[2][1];
  var trap = dvCardRows(mkSel, true).filter(function (r) { return r.trap; }).length;
  var LIM = ["한계도 적어둘게요.", "배당률은 최근 1년 실제 배당 기준이라, 배당이 줄면 필요한 돈은 더 늘어납니다.", "배당락일에는 주가가 배당만큼 빠지는 게 보통이에요. 배당만 보고 수익을 판단하면 안 됩니다.", trap ? "배당률 8%가 넘는 " + trap + "개는 주가가 크게 빠져서 높아 보이는 경우가 많아 이 순위에서 뺐어요." : "지금 목록은 앱에 등록된 종목만 계산한 결과예요."];
  var LIMT = ["한계도 적어둘게요.", "세율은 " + DIV_TAX.asOf.slice(0, 7).replace("-", "년 ") + "월 기준이고, ISA 개정안이 국회 심의 중이라 바뀔 수 있어요.", "연금저축은 55세 이후 연금으로 받아야 이 세율이고, ISA는 3년 동안 묶입니다.", "주가 변화 0%, 배당 4%를 가정한 단순 계산이에요."];
  var base = { summary: top5.concat(["배당률 중앙값 " + dvP(med, 1) + " → 필요 투자금 " + dvEok(nMed) + "원"]), insights: ["배당률 3%와 4%면 월 100만원에 필요한 돈이 " + dvEok(n3 - n4) + "원 차이 나요.", "매년 1,000만원씩 10년을 넣어도 계좌에 따라 세후가 " + dvMan(gap) + " 달라요."],
    cardList: (names || []).map(function (n) { return n.replace("_", " "); }), question: "여러분은 월배당과 분기배당 중 어느 쪽이 더 끌리세요?", tags: ["우상향연구소", "배당주", "배당투자", "ISA", "연금저축", "재테크"], foot: "야후 파이낸스 배당 기록 · " + dvAsOfTxt() + " 종가 · 세율 " + DIV_TAX.asOf + " 기준 · 투자 권유 아님",
    data: top5, sort: false, thFoot: "최근 1년 배당 · 종가 기준 · 투자 권유 아님", limit: LIM, reply: "여러분은 적립식인가요, 한 번에 사시나요?" };
  var out = [];
  function add(label, hook, ex) { var c = thrCompose(Object.assign({}, base, ex || {}, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  add("초보 질문형", "월 100만원 배당, 얼마가 있어야 받을까요?", { ask: mn + " 배당 종목을 필요한 돈이 적은 순으로 놓아봤어요.", interp: ["배당률 3%와 4%면 필요한 돈이 " + dvEok(n3 - n4) + "원 차이 납니다."] });
  add("숫자 한 방형", dvEok(nMed) + "원.\n배당률 중앙값(" + dvP(med, 1) + ")으로 세후 월 100만원을 받으려면 필요한 돈이에요.", { ask: "배당률이 높으면 얼마나 줄어들까요?", interp: ["숫자만 보면 높은 배당률이 좋아 보이지만, 그만큼 주가가 빠진 종목일 수 있어요."], reply: "이 순위에서 제일 의외인 곳은요?" });
  add("반전형", "매년 1,000만원씩 10년,\n같은 돈인데 계좌에 따라 세후가 " + dvMan(gap) + " 달라요.", { ask: "어느 계좌가 가장 많이 남았을까요?", data: accL, interp: ["차이는 배당에 붙는 세금을 언제, 얼마나 내느냐에서 나와요. 연금저축은 세액공제 환급을 더한 값이에요."], limit: LIMT, reply: "이 정도 차이면, 돈이 묶이는 기간을 감수할 만하다고 보세요?" });
  return thrSafe(out);
}
