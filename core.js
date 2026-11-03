/* ============================================================ v12.72 본질 · 변수 — 별도 페이지 (운영자)
   생각의 틀: 변수(정책·전쟁·금리·환율…)는 미리 맞출 수 없다 → 발생하면 규칙대로 대응한다.
              본질(기업의 이익·자산의 장기 성장)은 길게 보면 우상향한다 → 그것을 보고 들고 간다.
   ① 본질: 자산·종목마다 10년 연수익 · 최대 낙폭과 회복 · 200일선 · (종목) 매출·영업이익 추세 · ROE · PER/PBR → 규칙 판정(우상향 유지 / 주의 / 훼손)
   ② 변수: 매크로 조건(환율·금리·M2…)이 지금 켜졌는지 · 켜진 뒤 과거 1년 코스피 결과 · 대응 규칙 · 공포지수 · 다가오는 일정 · 오늘 켜진 이슈
   ③ 평가·판단·예측: 프롬프트 복사 → claude.ai → 답 붙여넣기 → 판정 화면 + 서버 보관
   ============================================================ */
var CORE = { busy: false, ess: null, fund: {}, ans: null, prompt: "" };
var CORE_BASE = ["SPY", "QQQ", "^KS11", "GLD", "BTC-USD", "SCHD"];
function coreEsc(s) { return escapeHtml(String(s == null ? "" : s)); }
function corePct(v, d) { return v == null || !isFinite(v) ? "-" : (v > 0 ? "+" : "") + (v * 100).toFixed(d == null ? 1 : d) + "%"; }
function coreName(s) { return typeof nbName === "function" ? nbName(s) : s; }
function coreSyms() {
  var out = CORE_BASE.slice(), add = function (s) { if (s && out.indexOf(s) < 0 && out.length < 14) out.push(s); };
  try { (loadHoldings().lots || []).forEach(function (L) { add(L.s); }); } catch (e) {}
  try { loadWatch().forEach(function (w) { add(w.s); }); } catch (e) {}
  return out;
}
function coreIsStock(s) { return /\.K[SQ]$/.test(s) || /^[A-Z]{1,5}$/.test(s) && ["SPY", "QQQ", "GLD", "SCHD", "TLT", "SLV", "USO", "DBC", "IWM", "VTI", "VOO"].indexOf(s) < 0; }
/* ---------- ① 본질 — 장기 숫자 ---------- */
function coreLong(sym) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || rows.length < 260) return null;
  var last = rows[rows.length - 1], atY = function (y) { var t = last.t - y * 365.25 * 86400e3, i = 0; while (i < rows.length - 1 && rows[i].t < t) i++; return rows[i]; };
  var yrs = Math.min(10, (last.t - rows[0].t) / (365.25 * 86400e3)), r0 = atY(yrs), cagr = yrs >= 3 ? Math.pow(last.c / r0.c, 1 / yrs) - 1 : null;
  var r5 = yrs >= 5 ? atY(5) : null, r3 = atY(3), r1 = atY(1);
  var dd = typeof nbDd === "function" ? nbDd(sym) : null;
  var eps = typeof drawdownEpisodes === "function" ? drawdownEpisodes(rows, 0.20) : [], open = eps.filter(function (e) { return e.recoverI == null; }).length, deep = eps.length;
  var sum = 0, n = 0; for (var i = Math.max(0, rows.length - 200); i < rows.length; i++) { sum += rows[i].c; n++; } var ma200 = n ? sum / n : null;
  return { sym: sym, name: coreName(sym), yrs: Math.round(yrs), cagr: cagr, ret5: r5 ? Math.pow(last.c / r5.c, 1 / 5) - 1 : null, ret3: Math.pow(last.c / r3.c, 1 / 3) - 1, ret1: last.c / r1.c - 1, cur: dd ? dd.cur : null, worst: dd ? dd.worst : null, worstY: dd ? dd.worstY : null, dd20: deep, dd20open: open, above200: ma200 != null ? last.c >= ma200 : null, vs200: ma200 != null ? last.c / ma200 - 1 : null };
}
function coreFund(sym) {
  if (!coreIsStock(sym)) return Promise.resolve(null); if (CORE.fund[sym] !== undefined) return Promise.resolve(CORE.fund[sym]);
  return fetch("/api/fund?symbol=" + encodeURIComponent(sym)).then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) { CORE.fund[sym] = null; return null; }
    var I = d.info || {}, num = function (v) { var x = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(x) ? x : null; };
    var fin = (d.financials && (d.financials.annual || d.annual)) || d.annual || null, rows = Array.isArray(fin) ? fin : (fin && fin.rows) || [];
    var rev = [], op = []; rows.forEach(function (r) { var y = r.period || r.date || r.y || r.label, rv = num(r.revenue != null ? r.revenue : r.sales != null ? r.sales : r.매출액), o = num(r.operatingIncome != null ? r.operatingIncome : r.op != null ? r.op : r.영업이익); if (rv != null) rev.push([y, rv]); if (o != null) op.push([y, o]); });
    var trend = function (a) { if (a.length < 3) return null; var x = a.slice(-3); return x[2][1] > x[0][1] && x[1][1] > x[0][1] * 0.9 ? "up" : x[2][1] < x[0][1] ? "down" : "flat"; };
    var F = { per: num(I.per || I.perTtm || I.peRatio), pbr: num(I.pbr || I.pbRatio), roe: num(I.roe || I.returnOnEquity), divY: num(I.dividendYieldRatio || I.dividendYield), eps: num(I.eps || I.epsTtm), revT: trend(rev), opT: trend(op), rev: rev.slice(-4), op: op.slice(-4), name: d.name };
    CORE.fund[sym] = F; return F;
  }).catch(function () { CORE.fund[sym] = null; return null; });
}
/* 규칙 판정 — 숫자가 모자라면 '자료 부족' */
function coreVerdict(L, F) {
  if (!L) return { st: "na", t: "자료 부족", why: [] };
  var good = 0, bad = 0, why = [];
  if (L.cagr != null) { if (L.cagr >= 0.07) { good++; why.push(L.yrs + "년 연 " + corePct(L.cagr, 1)); } else if (L.cagr < 0) { bad += 2; why.push(L.yrs + "년 연 " + corePct(L.cagr, 1) + " (장기 하락)"); } else why.push(L.yrs + "년 연 " + corePct(L.cagr, 1) + " (낮음)"); }
  if (L.dd20) { if (!L.dd20open) { good++; why.push("-20% 낙폭 " + L.dd20 + "번 모두 회복"); } else { bad++; why.push("-20% 낙폭 " + L.dd20open + "번 아직 미회복"); } } else why.push("-20% 낙폭 없음");
  if (L.above200 != null) { if (L.above200) good++; else why.push("200일선 아래 " + corePct(L.vs200, 1)); }
  if (F) { if (F.revT === "up") { good++; why.push("매출 3년 증가"); } else if (F.revT === "down") { bad++; why.push("매출 3년 감소"); } if (F.opT === "up") { good++; why.push("영업이익 3년 증가"); } else if (F.opT === "down") { bad++; why.push("영업이익 3년 감소"); } if (F.roe != null) { if (F.roe >= 10) { good++; why.push("ROE " + F.roe.toFixed(1) + "%"); } else why.push("ROE " + F.roe.toFixed(1) + "% (낮음)"); } }
  var st = bad >= 2 || (L.cagr != null && L.cagr < 0) ? "bad" : bad === 1 || good < 2 ? "mid" : "good";
  return { st: st, t: st === "good" ? "우상향 유지" : st === "mid" ? "주의" : "훼손", why: why };
}
function coreEssence() {
  var syms = coreSyms(), need = syms.filter(function (s) { return !(typeof nbHist !== "undefined" && nbHist[s]); });
  return Promise.all([typeof nbLoad === "function" ? nbLoad(syms) : Promise.resolve(), Promise.all(syms.map(coreFund))]).then(function () {
    CORE.ess = syms.map(function (s) { var L = coreLong(s), F = CORE.fund[s] || null; return { sym: s, name: coreName(s), L: L, F: F, V: coreVerdict(L, F) }; });
    return CORE.ess;
  });
}
/* ---------- ② 변수 — 조건 · 대응 규칙 ---------- */
var CORE_RESP = {
  krw1400: "원화 자산만 있으면 환차손 없이 지나가지만 수입물가·외국인 매도가 따라옴. 미국 자산은 원화 환산 수익이 완충 — 지금 환전·추가 매수는 서두르지 않고 분할.",
  krw1300: "고환율 구간 진입 신호. 달러 자산 비중을 확인하고, 원화 자산은 수출주·내수주 구분해서 볼 것.",
  krwJump: "한 달 +3%는 외국인 자금 이탈 신호. 지수가 같이 빠지면 정해 둔 분할매수 1단계만 실행, 추격 환전 금지.",
  bokCut: "인하 시작은 '경기가 안 좋다'는 뜻이기도 함. 첫 인하 뒤 1년 결과는 아래 숫자대로 — 배당·리츠·장기채는 금리 민감.",
  bokHike: "인상 시작: 대출 부담 ↑ 부동산·성장주 밸류 압박. 현금흐름 좋은 기업 위주로 점검.",
  fedCut: "연준 인하 = 유동성 완화 vs 경기 둔화 — 둘 중 무엇이 이유인지 고용·실적으로 확인하고 대응.",
  fedHike: "달러 금리 ↑: 고PER 성장주 밸류 부담, 달러 강세. 분할 매수 간격을 넓힘.",
  us10y45: "안전한 채권이 4.5%면 주식의 경쟁 상대가 생김. 고PER 비중을 점검하고 채권을 대안으로 검토.",
  inv: "장단기 역전은 경고이지 타이밍이 아님 — 역전 해소 뒤가 더 위험했던 적이 많음. 현금 비중만 조금 올려 둠.",
  m2neg: "돈이 줄어드는 구간: 밸류 높은 자산부터 흔들림. 본질 좋은 것만 남기고 잡다한 포지션 정리.",
  m2hot: "돈이 넘치는 구간: 자산 가격이 실적보다 앞서감 — 추격하지 말고 정해 둔 비중 유지."
};
function coreVars() {
  var V = [], R = typeof hubR === "function" ? hubR() : null;
  if (typeof macroCompute === "function" && typeof macReady === "function" && macReady()) {
    macroCompute().forEach(function (r) {
      var ks = r.st && r.st.ks && r.st.ks[2], ks3 = r.st && r.st.ks && r.st.ks[0];
      V.push({ id: r.c.id, icon: r.c.icon, name: r.c.tag, on: !!(r.now && r.now.on), now: r.now ? r.now.txt : "", n: r.ev.length, y1: ks && ks.n ? ks : null, m3: ks3 && ks3.n ? ks3 : null, mean: r.c.mean || "", resp: CORE_RESP[r.c.id] || "" });
    });
  }
  var vix = R && (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0], vv = vix ? parseFloat(String(vix.v).replace(/[^\d.]/g, "")) : null;
  if (vv != null && isFinite(vv)) V.unshift({ id: "vix", icon: "😱", name: "공포지수(VIX) " + vv.toFixed(1), on: vv >= 30, warn: vv >= 20, now: vv >= 30 ? "30 이상 — 공포 구간" : vv >= 20 ? "20~30 — 주의 구간" : "20 아래 — 평온", resp: "20 아래선 아무것도 안 함. 20~30은 현금 준비만. 30을 넘으면 정해 둔 분할매수(3회)를 시작 — 과거 VIX 30 위에서 산 뒤 1년은 대체로 플러스였음(카드 '공포지수 구간별' 참고).", mean: "시장이 앞으로 한 달 얼마나 흔들릴지 보는 값. 높을수록 공포." });
  return V;
}
function coreEvents() { var ev = []; try { ev = typeof pubUpcoming === "function" ? pubUpcoming(14) : []; } catch (e) {} return ev.slice(0, 10); }
function coreIssues() { var out = []; try { var iss = (typeof briefState !== "undefined" && briefState.issues) || []; iss.slice(0, 5).forEach(function (it) { var w = typeof ISS_WHY !== "undefined" ? ISS_WHY[it.title] : null; out.push({ t: it.title, sub: it.sub || "", why: w ? w.why : "", so: w ? w.so : "", next: w ? w.next : "" }); }); } catch (e) {} return out; }
/* ---------- ③ 프롬프트 · 답 ---------- */
function coreText() {
  var L = [], E = CORE.ess || [], V = coreVars();
  L.push("[본질 — 자산·종목별 장기 숫자]  이름 | 연수익(기간) | 5년 연수익 | 1년 | 고점 대비 | 역대 최대 낙폭 | -20% 낙폭 수/미회복 | 200일선 | (종목) 매출·영업이익 3년 추세 · ROE · PER · PBR · 배당률 | 규칙 판정");
  E.forEach(function (x) { var l = x.L, f = x.F; L.push("- " + x.name + "(" + x.sym + ") | " + (l ? corePct(l.cagr, 1) + "(" + l.yrs + "년) | " + corePct(l.ret5, 1) + " | " + corePct(l.ret1, 1) + " | " + corePct(l.cur, 1) + " | " + corePct(l.worst, 0) + (l.worstY ? "(" + l.worstY + ")" : "") + " | " + l.dd20 + "/" + l.dd20open + " | " + (l.above200 == null ? "-" : l.above200 ? "위 " : "아래 ") + corePct(l.vs200, 1) : "장기 자료 없음") + (f ? " | 매출 " + (f.revT || "-") + " · 영업이익 " + (f.opT || "-") + " · ROE " + (f.roe == null ? "-" : f.roe) + " · PER " + (f.per == null ? "-" : f.per) + " · PBR " + (f.pbr == null ? "-" : f.pbr) + " · 배당 " + (f.divY == null ? "-" : f.divY + "%") : "") + " | " + x.V.t + (x.V.why.length ? " (" + x.V.why.join(", ") + ")" : "")); });
  L.push("", "[변수 — 매크로 조건]  조건 | 지금 켜짐? | 지금 값 | 과거 발생 n번 → 코스피 1년 뒤 중앙값/승률");
  V.forEach(function (v) { L.push("- " + v.name + " | " + (v.on ? "켜짐" : "꺼짐") + " | " + v.now + (v.y1 ? " | " + v.n + "번 → " + corePct(v.y1.med, 0) + " / 승률 " + Math.round(v.y1.win * 100) + "%" : "")); });
  var ev = coreEvents(); if (ev.length) { L.push("", "[다가오는 일정 14일]"); ev.forEach(function (e) { L.push("- " + e.d + " " + e.t + (e.n ? " — " + e.n : "")); }); }
  var iss = coreIssues(); if (iss.length) { L.push("", "[오늘 켜진 이슈]"); iss.forEach(function (i) { L.push("- " + i.t + (i.sub ? " · " + i.sub : "") + (i.why ? " — 왜: " + i.why : "") + (i.next ? " / 볼 것: " + i.next : "")); }); }
  return L.join("\n");
}
var CORE_SYS = [
  "너는 장기 투자자의 리서치 파트너다. 독자는 한국 개인투자자. 생각의 틀은 둘로 나뉜다.",
  "본질: 기업의 이익·현금흐름·자산의 장기 성장 — 길게 보면 우상향하는가. 변수: 정책·전쟁·금리·환율·유동성 — 미리 맞출 수 없으므로 '발생하면 어떻게 대응할지'만 정한다.",
  "규칙: (1) 아래 [앱 데이터]의 숫자가 1순위, 숫자를 지어내지 않는다. (2) 웹에서 최근 2주 사실을 보강하면 날짜·출처를 붙인다(실적 발표·가이던스·배당 정책·규제 등 본질에 관한 것 위주). (3) 매수·매도 권유·목표가·수익 보장 금지 — 판단은 '조건이면 이렇게'로. (4) 변수는 예측하지 말고 '지금 상태 → 켜지면 대응'으로만 쓴다. (5) 짧게, 숫자와 함께.",
  "", "답변 형식 (설명 없이 ```json 하나):",
  "```json", "{",
  '  "essence": { "verdict": "우상향 유지 | 주의 | 훼손 중 하나(전체 포트폴리오 기준)", "score": 0~100, "one": "한 줄 결론(40자)", "assets": [ { "name": "이름", "st": "유지|주의|훼손", "line": "근거 한 줄(숫자 포함, 50자)", "fact": "최근 2주 본질 관련 사실(없으면 빈칸) — 출처·날짜" } ] },',
  '  "variables": [ { "name": "변수 이름", "state": "평온|주의|경계", "now": "지금 상태 한 줄", "trigger": "대응을 시작할 조건(숫자)", "response": "그때 할 일 한 줄(비중·분할·확인)" } ],',
  '  "scenarios": [ { "name": "시나리오", "p": "낮음|보통|높음", "what": "무슨 일", "do": "그때 할 일" } ],',
  '  "outlook": { "3개월": "조건부 전망 한 줄(변수 중심)", "1년": "조건부 전망 한 줄(본질 중심)" },',
  '  "stance": "지금 행동 수준 한 줄(예: 본질 유지 · 변수 대기 · 분할 2/3 보유)", "change": ["이 판단을 바꿀 조건 3개(숫자·사건)"], "sources": ["출처 · 날짜"]',
  "}", "```"
];
function corePrompt() { return CORE_SYS.join("\n") + "\n\n오늘: " + smKstDay() + " (한국 시간)\n\n[앱 데이터]\n" + coreText(); }
function coreParse(text) { var t = String(text || ""), m = t.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i), raw = m ? m[1] : (function () { var s = t.indexOf("{"), e = t.lastIndexOf("}"); return s >= 0 && e > s ? t.slice(s, e + 1) : null; })(); if (!raw) return null; var tries = [raw, raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1")]; for (var i = 0; i < tries.length; i++) { try { var J = JSON.parse(tries[i]); if (J && typeof J === "object") return J; } catch (e) {} } return null; }
function coreKey() { return "cfg:core:" + smKstDay(); }
function coreSave(J, raw) { var rec = { day: smKstDay(), at: Date.now(), j: J, raw: String(raw).slice(0, 20000) }; CORE.ans = rec; try { localStorage.setItem("sm.core", JSON.stringify(rec)); } catch (e) {} if (typeof smKvPut === "function") smKvPut("cfg:core:last", rec, 90 * 86400).catch(function () {}); }
function coreLoadAns() { try { var r = JSON.parse(localStorage.getItem("sm.core") || "null"); if (r && r.j) CORE.ans = r; } catch (e) {} if (!CORE.ans && typeof smKvGet === "function") smKvGet("cfg:core:last").then(function (r) { if (r && r.j && !CORE.ans) { CORE.ans = r; if (currentTab === "core") renderCore(); } }); }
/* ---------- 화면 ---------- */
var CORE_ST = { good: ["우상향 유지", "#1d7f55"], mid: ["주의", "#b9600f"], bad: ["훼손", "#c03b3b"], na: ["자료 부족", "#889"] };
function coreEssHtml() {
  var E = CORE.ess; if (!E) return '<div class="briefDim">장기 데이터를 계산하는 중… (10년치 시세 · 종목 재무)</div>';
  var g = E.filter(function (x) { return x.V.st === "good"; }).length;
  return '<div class="coreSum"><b>' + g + '/' + E.length + '</b> 자산이 <i>우상향 유지</i> — 본질이 유지되는 것은 변수가 와도 들고 간다</div><table class="coreT"><thead><tr><th>자산</th><th>판정</th><th>연수익</th><th>1년</th><th>고점 대비</th><th>최대 낙폭</th><th>-20% 회복</th><th>200일선</th><th>본질(종목)</th></tr></thead><tbody>' +
    E.map(function (x) { var l = x.L, f = x.F, st = CORE_ST[x.V.st]; return '<tr><td><b>' + coreEsc(x.name) + '</b><small>' + coreEsc(x.sym) + '</small></td><td><span class="coreBadge" style="background:' + st[1] + '">' + st[0] + '</span></td>' + (l ? '<td>' + corePct(l.cagr, 1) + '<small>' + l.yrs + '년</small></td><td class="' + (l.ret1 >= 0 ? "up" : "dn") + '">' + corePct(l.ret1, 1) + '</td><td class="dn">' + corePct(l.cur, 1) + '</td><td>' + corePct(l.worst, 0) + '<small>' + (l.worstY || "") + '</small></td><td>' + (l.dd20 ? (l.dd20 - l.dd20open) + '/' + l.dd20 + (l.dd20open ? ' <b class="dn">미회복</b>' : ' ✓') : '없음') + '</td><td class="' + (l.above200 ? "up" : "dn") + '">' + (l.above200 == null ? "-" : (l.above200 ? "위 " : "아래 ") + corePct(l.vs200, 1)) + '</td>' : '<td colspan="6" class="briefDim">장기 자료 없음</td>') + '<td>' + (f ? '<small>매출 ' + (({ up: "↑", down: "↓", flat: "→" })[f.revT] || "-") + ' · 영업이익 ' + (({ up: "↑", down: "↓", flat: "→" })[f.opT] || "-") + ' · ROE ' + (f.roe == null ? "-" : f.roe.toFixed(1)) + ' · PER ' + (f.per == null ? "-" : f.per.toFixed(1)) + ' · PBR ' + (f.pbr == null ? "-" : f.pbr.toFixed(2)) + (f.divY != null ? ' · 배당 ' + f.divY.toFixed(1) + '%' : '') + '</small>' : '<small class="briefDim">' + (coreIsStock(x.sym) ? "재무 없음" : "지수·ETF") + '</small>') + '</td></tr><tr class="coreWhy"><td colspan="9">' + coreEsc(x.V.why.join(" · ")) + '</td></tr>'; }).join("") + '</tbody></table>' +
    '<div class="briefDim" style="font-size:12px;margin-top:6px">규칙: 연수익 7% 이상 · -20% 낙폭을 모두 회복 · 200일선 위 · (종목) 매출·영업이익 3년 증가 · ROE 10% 이상 — 좋은 항목이 둘 미만이면 주의, 나쁜 항목이 둘 이상이거나 장기 수익이 마이너스면 훼손. 관심·보유 종목은 자동으로 추가돼요.</div>';
}
function coreVarHtml() {
  var V = coreVars(), on = V.filter(function (v) { return v.on; }), ev = coreEvents(), iss = coreIssues();
  if (!V.length) return '<div class="briefDim">매크로 데이터를 불러오는 중…</div>';
  var row = function (v) { return '<div class="coreVar ' + (v.on ? "on" : v.warn ? "warn" : "") + '"><div class="coreVarH"><span class="coreDot"></span><b>' + coreEsc(v.icon + " " + v.name) + '</b><em>' + (v.on ? "지금 켜짐" : v.warn ? "주의" : "꺼짐") + '</em></div><div class="coreVarNow">' + coreEsc(v.now) + (v.y1 ? ' · 과거 ' + v.n + '번 → 코스피 1년 뒤 중앙값 <b>' + corePct(v.y1.med, 0) + '</b> (승률 ' + Math.round(v.y1.win * 100) + '%)' : '') + '</div>' + (v.resp ? '<div class="coreVarR"><small>발생하면</small>' + coreEsc(v.resp) + '</div>' : '') + '</div>'; };
  return '<div class="coreSum">지금 켜진 변수 <b>' + on.length + '</b>개 — 변수는 맞추는 게 아니라 <i>켜졌을 때 규칙대로</i></div><div class="coreVars">' + on.map(row).join("") + V.filter(function (v) { return !v.on; }).map(row).join("") + '</div>' +
    (iss.length ? '<div class="coreH">오늘 켜진 이슈 <small class="briefDim">브리핑 핵심 이슈 — 이유는 Claude 정리</small></div><ul class="coreList">' + iss.map(function (i) { return '<li><b>' + coreEsc(i.t) + '</b>' + (i.why ? ' — ' + coreEsc(i.why) : '') + (i.next ? ' <small>볼 것: ' + coreEsc(i.next) + '</small>' : '') + '</li>'; }).join("") + '</ul>' : '') +
    (ev.length ? '<div class="coreH">다가오는 변수 <small class="briefDim">14일</small></div><ul class="coreList">' + ev.map(function (e) { return '<li><b>' + coreEsc(e.d.slice(5)) + '</b> ' + coreEsc(e.t) + (e.n ? ' <small>' + coreEsc(e.n) + '</small>' : '') + '</li>'; }).join("") + '</ul>' : '');
}
function coreAnsHtml() {
  var A = CORE.ans, J = A && A.j; if (!J) return '<div class="briefDim">③에서 답을 붙여넣으면 여기에 판정·대응표·시나리오·전망이 정리돼요.</div>';
  var es = J.essence || {}, st = /유지/.test(es.verdict) ? "good" : /훼손/.test(es.verdict) ? "bad" : "mid", sc = parseFloat(es.score);
  var h = '<div class="anxHero ' + st + '"><div class="anxHeroL"><div class="anxVerdict">본질 · ' + coreEsc(es.verdict || "-") + '</div><div class="anxOne">' + coreEsc(es.one || "") + '</div><div class="anxMeta">' + (A.day || "") + ' · claude.ai 직접 · ' + coreEsc(J.stance || "") + '</div></div>' + (isFinite(sc) ? '<div class="anxGauge" style="--v:' + sc + '"><b>' + Math.round(sc) + '</b><small>/100</small></div>' : '') + '</div>';
  if ((es.assets || []).length) h += '<div class="anxH">자산별 본질</div><div class="anxFrames">' + es.assets.map(function (a) { var c = /유지/.test(a.st) ? "good" : /훼손/.test(a.st) ? "bad" : "mid"; return '<div class="anxFrame ' + c + '"><div class="anxFT"><b>' + coreEsc(a.name) + '</b><i>' + coreEsc(a.st || "") + '</i></div><div class="anxFL">' + coreEsc(a.line || "") + '</div>' + (a.fact ? '<div class="anxFL" style="color:#1f3a68;margin-top:4px">' + coreEsc(a.fact) + '</div>' : '') + '</div>'; }).join("") + '</div>';
  if ((J.variables || []).length) h += '<div class="anxH">변수 대응표 — 켜지면 이렇게</div><table class="coreT coreResp"><thead><tr><th>변수</th><th>상태</th><th>지금</th><th>대응 시작 조건</th><th>그때 할 일</th></tr></thead><tbody>' + J.variables.map(function (v) { var c = /경계/.test(v.state) ? "bad" : /주의/.test(v.state) ? "mid" : "good"; return '<tr><td><b>' + coreEsc(v.name) + '</b></td><td><span class="coreBadge" style="background:' + CORE_ST[c][1] + '">' + coreEsc(v.state || "") + '</span></td><td>' + coreEsc(v.now || "") + '</td><td>' + coreEsc(v.trigger || "") + '</td><td>' + coreEsc(v.response || "") + '</td></tr>'; }).join("") + '</tbody></table>';
  if ((J.scenarios || []).length) h += '<div class="anxH">시나리오</div><div class="anxThree">' + J.scenarios.slice(0, 3).map(function (s) { return '<div><small>' + coreEsc(s.name) + ' · ' + coreEsc(s.p || "") + '</small><div style="font-size:12.5px;line-height:1.5"><b>' + coreEsc(s.what || "") + '</b><br>→ ' + coreEsc(s.do || "") + '</div></div>'; }).join("") + '</div>';
  if (J.outlook) h += '<div class="anxH">조건부 전망</div><div class="anxTwo"><div class="anxAct"><small style="font-weight:700">3개월 · 변수 중심</small><div>' + coreEsc(J.outlook["3개월"] || "") + '</div></div><div class="anxAct"><small style="font-weight:700">1년 · 본질 중심</small><div>' + coreEsc(J.outlook["1년"] || "") + '</div></div></div>';
  if ((J.change || []).length) h += '<div class="anxH">이 판단을 바꿀 조건</div><ul class="coreList">' + J.change.map(function (c) { return '<li>' + coreEsc(c) + '</li>'; }).join("") + '</ul>';
  if ((J.sources || []).length) h += '<div class="anxSrc">출처: ' + J.sources.map(coreEsc).join(" · ") + '</div>';
  return h;
}
function renderCore() {
  var box = document.getElementById("coreBody"); if (!box) return;
  if (!(typeof isOwner === "function" && isOwner())) { box.innerHTML = '<div class="dvEmpty">운영자 전용 페이지예요.</div>'; return; }
  if (!CORE.ess && !CORE.busy) { CORE.busy = true; var ps = [coreEssence()]; if (typeof macroEnsure === "function") ps.push(macroEnsure().then(function () { return typeof macPxLoad === "function" ? macPxLoad() : null; }).catch(function () {})); if (typeof briefState !== "undefined" && !briefState.result && typeof loadBrief === "function") { try { loadBrief(false); } catch (e) {} } Promise.all(ps).then(function () { CORE.busy = false; if (currentTab === "core") renderCore(); }); }
  if (!CORE.ans) coreLoadAns();
  var h = '<div class="coreIntro"><div><b>변수</b>는 미리 맞출 수 없다 → <i>발생하면 규칙대로 대응</i></div><div><b>본질</b>은 길게 보면 우상향한다 → <i>그것을 보고 들고 간다</i></div></div>';
  h += '<section class="anSec"><div class="mkStep"><b>1</b> 본질 — 길게 보면 우상향인가 <small class="briefDim">10년 시세 · 낙폭 회복 · 200일선 · (종목) 매출·이익·ROE</small><button class="chip" data-corer style="margin-left:auto">다시 계산</button></div>' + coreEssHtml() + '</section>';
  h += '<section class="anSec"><div class="mkStep"><b>2</b> 변수 — 켜졌는가, 켜지면 어떻게 <small class="briefDim">매크로 조건 · 공포지수 · 오늘 이슈 · 다가오는 일정</small></div>' + coreVarHtml() + '</section>';
  h += '<section class="anSec"><div class="mkStep"><b>3</b> 평가 · 판단 · 예측 <small class="briefDim">프롬프트 복사 → claude.ai(Fable 5.1) → 답 붙여넣기</small></div>' +
    '<div class="anxSteps"><div><i>1</i> 프롬프트 복사(①②가 전부 들어가요)</div><div><i>2</i> claude.ai 새 대화 · 웹 검색 켜기</div><div><i>3</i> ```json 블록을 붙여넣고 저장</div></div>' +
    '<div class="anActs"><button class="primary" data-corep' + (CORE.ess ? '' : ' disabled') + '>📋 본질·변수 프롬프트 복사</button><button class="chip" data-corepv>프롬프트 보기</button><span class="briefDim" data-coremsg></span></div><div class="anxPv" hidden><textarea class="thrText" rows="12" readonly spellcheck="false"></textarea><small class="briefDim anxLen"></small></div>' +
    '<textarea class="anAnsIn" rows="7" data-corein placeholder="Claude 답변을 붙여넣으세요 (```json … ``` 포함)"></textarea><div class="anActs"><button class="primary" data-coreok>💾 저장하고 판정 보기</button><span class="briefDim" data-corechk></span></div></section>';
  h += '<section class="anSec"><div class="mkStep"><b>4</b> 판정 <small class="briefDim">' + (CORE.ans ? coreEsc(CORE.ans.day) + ' 저장분' : '') + '</small>' + (CORE.ans ? '<button class="chip" data-coreraw style="margin-left:auto">원문</button>' : '') + '</div>' + coreAnsHtml() + '</section>';
  box.innerHTML = h;
  var rb = box.querySelector("[data-corer]"); if (rb) rb.onclick = function () { CORE.ess = null; CORE.fund = {}; renderCore(); };
  var pv = box.querySelector(".anxPv"), msg = box.querySelector("[data-coremsg]"), show = function (t) { pv.hidden = false; pv.querySelector("textarea").value = t; pv.querySelector(".anxLen").textContent = t.length.toLocaleString() + "자"; };
  var pb = box.querySelector("[data-corep]"); if (pb) pb.onclick = function () { var t = corePrompt(); CORE.prompt = t; chCopy(t, pb); show(t); msg.textContent = t.length.toLocaleString() + "자 · claude.ai에 그대로 붙여넣기"; };
  box.querySelector("[data-corepv]").onclick = function () { if (!pv.hidden) { pv.hidden = true; return; } show(corePrompt()); };
  var inp = box.querySelector("[data-corein]"), chk = box.querySelector("[data-corechk]");
  inp.oninput = function () { var J = coreParse(inp.value); chk.innerHTML = !inp.value.trim() ? "" : J ? '<b style="color:#1d7f55">✓ 읽음</b> · 자산 ' + ((J.essence || {}).assets || []).length + ' · 변수 ' + (J.variables || []).length + ' · 시나리오 ' + (J.scenarios || []).length : '<b style="color:#b9600f">JSON을 못 읽었어요</b> — ```json 블록 전체를 붙여넣어 주세요'; };
  box.querySelector("[data-coreok]").onclick = function () { var J = coreParse(inp.value); if (!J) { chk.innerHTML = '<b style="color:#b9600f">JSON을 못 읽었어요</b>'; return; } coreSave(J, inp.value); smToast("저장했어요 — ④ 판정"); renderCore(); setTimeout(function () { var s = document.querySelectorAll("#coreBody .anSec")[3]; if (s) try { s.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }, 100); };
  var raw = box.querySelector("[data-coreraw]"); if (raw) raw.onclick = function () { var w = document.createElement("div"); w.innerHTML = '<textarea class="thrText" rows="20" readonly style="width:100%"></textarea>'; w.querySelector("textarea").value = CORE.ans.raw || ""; infoModal.open("답변 원문", w); };
}
/* ---------- 탭 등록 (index.html 수정 없이) ---------- */
(function () {
  if (typeof TABS === "undefined" || typeof switchTab !== "function") return;
  if (TABS.indexOf("core") < 0) TABS.push("core"); if (typeof OWNER_TABS !== "undefined" && OWNER_TABS.indexOf("core") < 0) OWNER_TABS.push("core");
  var an = document.getElementById("tab-analyst"); if (an && !document.getElementById("tab-core")) { var d = document.createElement("div"); d.id = "tab-core"; d.className = "hidden"; d.innerHTML = '<div class="card"><div class="pgHead"><h2>본질 · 변수 <small>본질은 길게, 변수는 대응으로 — 운영자 전용</small></div><div id="coreBody" style="margin-top:10px"></div></div>'; an.parentNode.insertBefore(d, an.nextSibling); }
  var nb = document.querySelector('.tabs button[data-tab="analyst"]'); if (nb && !document.querySelector('.tabs button[data-tab="core"]')) { var b = document.createElement("button"); b.setAttribute("data-tab", "core"); b.className = "ownerOnly"; b.innerHTML = "<i>⚖️</i><span>본질·변수</span>"; nb.parentNode.insertBefore(b, nb.nextSibling); b.onclick = function () { switchTab("core"); }; }
  var s0 = switchTab; switchTab = function (t) { if (t === "core" && !(typeof isOwner === "function" && isOwner())) t = "home"; var r = s0.apply(this, arguments); try { if (t === "core") renderCore(); } catch (e) { console.warn(e); } return r; };
  if (typeof SM_GUIDE !== "undefined") SM_GUIDE.core = { t: "본질·변수", s: ["① 본질: 자산·종목이 길게 우상향하는지 숫자로 판정해요(관심·보유 종목 자동 포함).", "② 변수: 환율·금리·공포지수 같은 조건이 지금 켜졌는지와, 켜지면 할 일을 정해 둬요.", "③ 프롬프트를 복사해 claude.ai에 묻고 답을 붙여넣으면 ④에 판정·대응표·시나리오·전망이 정리돼요."] };
  var st = document.createElement("style"); st.textContent = [
    ".coreIntro{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 4px}.coreIntro>div{background:#14161c;color:#f3efe6;border-radius:12px;padding:10px 14px;font-size:13.5px}.coreIntro i{font-style:normal;color:#e6c57a}",
    ".coreSum{font-size:14px;margin:6px 0 8px}.coreSum b{font-size:18px;color:#1f3a68}.coreSum i{font-style:normal;color:#1d7f55;font-weight:700}",
    ".coreT{width:100%;border-collapse:collapse;font-size:12.5px}.coreT th{font-weight:700;color:#667;text-align:left;padding:6px 6px;border-bottom:2px solid #e5e7eb;white-space:nowrap}.coreT td{padding:7px 6px;border-bottom:1px solid #f0f0f0;vertical-align:top}.coreT td small{display:block;color:#99a;font-size:11px}.coreT td.up{color:#c03b3b;font-weight:700}.coreT td.dn{color:#2456b7;font-weight:700}.coreT tr.coreWhy td{border-bottom:1px solid #e5e7eb;padding:0 6px 8px;color:#667;font-size:11.5px}",
    ".coreBadge{display:inline-block;color:#fff;border-radius:8px;padding:2px 8px;font-size:11.5px;font-weight:700;white-space:nowrap}",
    ".coreVars{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}.coreVar{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;background:#fff}.coreVar.on{border-color:#c03b3b;background:#fcefef}.coreVar.warn{border-color:#e6c57a;background:#fffaf0}",
    ".coreVarH{display:flex;align-items:center;gap:8px;font-size:13.5px}.coreVarH em{margin-left:auto;font-style:normal;font-size:11.5px;color:#889}.coreVar.on .coreVarH em{color:#c03b3b;font-weight:700}.coreDot{width:10px;height:10px;border-radius:50%;background:#cbd5e1;flex:none}.coreVar.on .coreDot{background:#c03b3b}.coreVar.warn .coreDot{background:#e6c57a}",
    ".coreVarNow{font-size:12px;color:#556;margin-top:4px;line-height:1.5}.coreVarR{font-size:12px;margin-top:6px;padding-top:6px;border-top:1px dashed #e5e7eb;line-height:1.5}.coreVarR small{display:inline-block;background:#14161c;color:#e6c57a;border-radius:6px;padding:0 6px;margin-right:6px;font-weight:700}",
    ".coreH{font-weight:700;font-size:13.5px;margin:14px 0 6px;color:#1f3a68}.coreList{margin:0;padding-left:18px;font-size:12.5px;line-height:1.6}.coreList small{color:#889}.coreResp td{font-size:12px}",
    "@media(max-width:640px){.coreIntro{grid-template-columns:1fr}.coreT{display:block;overflow-x:auto;white-space:nowrap}.coreT tr.coreWhy td{white-space:normal}}",
    "[data-theme=dark] .coreVar{background:#1e2533;border-color:#2b3447}[data-theme=dark] .coreT td{border-color:#2b3447}"
  ].join(""); document.head.appendChild(st);
})();
