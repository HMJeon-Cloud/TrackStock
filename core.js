/* ============================================================ v12.73 본질 · 변수 — 별도 페이지 (운영자)
   생각의 틀: 변수(정책·전쟁·금리·환율…)는 미리 맞출 수 없다 → 발생하면 규칙대로 대응한다.
              본질(기업의 이익·자산의 장기 성장)은 길게 보면 우상향한다 → 그것을 보고 들고 간다.
   ① 본질: 묶음별(지수·ETF / 코인 / 미국 Top10 / 국내 Top5 / 내 관심·보유) 장기 숫자 — 연수익(3·5·10년) · 아무 날 사서 1년 들고 있었을 때 플러스 확률·중앙값·최악 · 낙폭과 회복 · 200일선 · (종목) 매출·영업이익 3년 증가율 · 영업이익률 · ROE · PER/PBR/배당 → 규칙 판정
   ② 변수: 매크로 조건이 지금 켜졌는지 · 켜진 뒤 과거 1년 결과 · 뜻 · 대응 규칙 · 공포지수 · 오늘 이슈(무엇을·어디서 볼지) · 다가오는 일정(무엇을·왜·어디를 볼지)
   ③ 평가·판단·예측: 프롬프트 복사 → claude.ai → 답 붙여넣기 → ④ 판정(자산별 상세 카드 · 변수 대응 카드 · 시나리오 · 전망)
   ============================================================ */
var CORE = { busy: false, ess: null, fund: {}, ans: null, prompt: "", open: {} };
var CORE_GROUPS = [
  { g: "지수 · ETF", syms: ["SPY", "QQQ", "^KS11", "GLD", "SCHD", "TLT"] },
  { g: "코인", syms: ["BTC-USD", "ETH-USD", "XRP-USD", "SOL-USD"] },
  { g: "미국 Top10", syms: ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "BRK-B", "LLY"] },
  { g: "국내 Top5", syms: ["005930.KS", "000660.KS", "373220.KS", "207940.KS", "005380.KS"] },
  { g: "내 관심 · 보유", syms: [] }
];
function coreEsc(s) { return escapeHtml(String(s == null ? "" : s)); }
function corePct(v, d) { return v == null || !isFinite(v) ? "-" : (v > 0 ? "+" : "") + (v * 100).toFixed(d == null ? 1 : d) + "%"; }
function coreName(s) { return typeof nbName === "function" ? nbName(s) : s; }
function coreIsStock(s) { return /\.K[SQ]$/.test(s) || (/^[A-Z][A-Z\-]{0,5}$/.test(s) && ["SPY", "QQQ", "GLD", "SCHD", "TLT", "SLV", "USO", "DBC", "IWM", "VTI", "VOO"].indexOf(s) < 0); }
function coreGroups() {
  var seen = {}, out = CORE_GROUPS.map(function (G) { return { g: G.g, syms: G.syms.filter(function (s) { if (seen[s]) return false; seen[s] = 1; return true; }) }; }), mine = out[out.length - 1];
  var add = function (s) { if (s && !seen[s] && mine.syms.length < 10) { seen[s] = 1; mine.syms.push(s); } };
  try { (loadHoldings().lots || []).forEach(function (L) { add(L.s); }); } catch (e) {}
  try { loadWatch().forEach(function (w) { add(w.s); }); } catch (e) {}
  return out.filter(function (G) { return G.syms.length; });
}
function coreSyms() { return [].concat.apply([], coreGroups().map(function (G) { return G.syms; })); }
/* ---------- ① 본질 — 장기 숫자 ---------- */
function coreFwd(rows, days) {   // 아무 날 사서 days 뒤 — 플러스 확률 · 중앙값 · 최악 (최근 10년)
  var n = rows.length, out = [], t0 = rows[n - 1].t - 10 * 365.25 * 86400e3, j = 0;
  for (var i = 0; i < n; i += 5) { if (rows[i].t < t0) continue; var tt = rows[i].t + days * 86400e3; while (j < n && rows[j].t < tt) j++; if (j >= n) break; out.push(rows[j].c / rows[i].c - 1); }
  if (out.length < 30) return null; var s = out.slice().sort(function (a, b) { return a - b; });
  return { n: out.length, win: out.filter(function (x) { return x > 0; }).length / out.length, med: s[Math.floor(s.length / 2)], worst: s[0], best: s[s.length - 1] };
}
function coreLong(sym) {
  var rows = typeof nbHist !== "undefined" && nbHist[sym]; if (!rows || rows.length < 260) return null;
  var last = rows[rows.length - 1], atY = function (y) { var t = last.t - y * 365.25 * 86400e3, i = 0; while (i < rows.length - 1 && rows[i].t < t) i++; return rows[i]; };
  var span = (last.t - rows[0].t) / (365.25 * 86400e3), yrs = Math.min(10, span), r0 = atY(yrs), cagr = yrs >= 3 ? Math.pow(last.c / r0.c, 1 / yrs) - 1 : null;
  var c = function (y) { if (span < y) return null; var r = atY(y); return Math.pow(last.c / r.c, 1 / y) - 1; };
  var dd = typeof nbDd === "function" ? nbDd(sym) : null;
  var eps = typeof drawdownEpisodes === "function" ? drawdownEpisodes(rows, 0.20) : [], open = eps.filter(function (e) { return e.recoverI == null; }).length;
  var recs = eps.filter(function (e) { return e.recoverI != null; }).map(function (e) { return Math.round((rows[e.recoverI].t - rows[e.peakI].t) / 86400e3); }).sort(function (a, b) { return a - b; }), recMed = recs.length ? recs[Math.floor(recs.length / 2)] : null, recMax = recs.length ? recs[recs.length - 1] : null;
  var sum = 0, n = 0; for (var i = Math.max(0, rows.length - 200); i < rows.length; i++) { sum += rows[i].c; n++; } var ma200 = n ? sum / n : null;
  var hi = -Infinity, lo = Infinity; for (var k = Math.max(0, rows.length - 250); k < rows.length; k++) { hi = Math.max(hi, rows[k].c); lo = Math.min(lo, rows[k].c); }
  var sd = null; if (rows.length > 260) { var rs = []; for (var q = rows.length - 250; q < rows.length; q++) rs.push(rows[q].c / rows[q - 1].c - 1); var m = rs.reduce(function (a, b) { return a + b; }, 0) / rs.length; sd = Math.sqrt(rs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / rs.length) * Math.sqrt(252); }
  return { sym: sym, name: coreName(sym), yrs: Math.round(yrs), span: span, cagr: cagr, c3: c(3), c5: c(5), c10: c(10), ret1: last.c / atY(1).c - 1, cur: dd ? dd.cur : null, worst: dd ? dd.worst : null, worstY: dd ? dd.worstY : null, dd20: eps.length, dd20open: open, recMed: recMed, recMax: recMax, above200: ma200 != null ? last.c >= ma200 : null, vs200: ma200 != null ? last.c / ma200 - 1 : null, pos52: hi > lo ? (last.c - lo) / (hi - lo) : null, vol: sd, f1: coreFwd(rows, 365), f3: coreFwd(rows, 3 * 365) };
}
function coreFund(sym) {
  if (!coreIsStock(sym)) return Promise.resolve(null); if (CORE.fund[sym] !== undefined) return Promise.resolve(CORE.fund[sym]);
  return fetch("/api/fund?symbol=" + encodeURIComponent(sym)).then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.ok) { CORE.fund[sym] = null; return null; }
    var I = d.info || {}, num = function (v) { var x = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(x) ? x : null; };
    var fin = (d.financials && (d.financials.annual || d.annual)) || d.annual || null, rows = Array.isArray(fin) ? fin : (fin && fin.rows) || [];
    var rev = [], op = [], ni = []; rows.forEach(function (r) { var y = String(r.period || r.date || r.y || r.label || "").slice(0, 7), rv = num(r.revenue != null ? r.revenue : r.sales != null ? r.sales : r.매출액), o = num(r.operatingIncome != null ? r.operatingIncome : r.op != null ? r.op : r.영업이익), nn = num(r.netIncome != null ? r.netIncome : r.당기순이익); if (rv != null) rev.push([y, rv]); if (o != null) op.push([y, o]); if (nn != null) ni.push([y, nn]); });
    var g3 = function (a) { if (a.length < 3) return null; var x = a.slice(-3); return x[0][1] > 0 && x[2][1] > 0 ? Math.pow(x[2][1] / x[0][1], 1 / 2) - 1 : x[2][1] > x[0][1] ? 0.001 : -0.001; };
    var trend = function (a) { var g = g3(a); return g == null ? null : g > 0.03 ? "up" : g < -0.03 ? "down" : "flat"; };
    var margin = rev.length && op.length ? op[op.length - 1][1] / rev[rev.length - 1][1] : null;
    var F = { per: num(I.per || I.perTtm || I.peRatio), pbr: num(I.pbr || I.pbRatio), roe: num(I.roe || I.returnOnEquity), divY: num(I.dividendYieldRatio || I.dividendYield), eps: num(I.eps || I.epsTtm), revG: g3(rev), opG: g3(op), niG: g3(ni), revT: trend(rev), opT: trend(op), margin: margin, rev: rev.slice(-4), op: op.slice(-4), name: d.name, opNeg: op.length ? op[op.length - 1][1] < 0 : null };
    CORE.fund[sym] = F; return F;
  }).catch(function () { CORE.fund[sym] = null; return null; });
}
/* 규칙 판정 — 좋은 항목 · 나쁜 항목을 세어서 (자료가 없으면 '자료 부족') */
function coreVerdict(L, F) {
  if (!L) return { st: "na", t: "자료 부족", why: [], good: 0, bad: 0 };
  var good = 0, bad = 0, why = [], Y = L.yrs;
  if (L.cagr != null) { if (L.cagr >= 0.07) { good++; why.push("✓ " + Y + "년 연 " + corePct(L.cagr, 1)); } else if (L.cagr < 0) { bad += 2; why.push("✗ " + Y + "년 연 " + corePct(L.cagr, 1) + " 장기 하락"); } else why.push("– " + Y + "년 연 " + corePct(L.cagr, 1) + " (7% 미만)"); }
  if (L.f1) { if (L.f1.win >= 0.7) { good++; why.push("✓ 아무 날 사서 1년 뒤 플러스 " + Math.round(L.f1.win * 100) + "%"); } else if (L.f1.win < 0.55) { bad++; why.push("✗ 1년 뒤 플러스 확률 " + Math.round(L.f1.win * 100) + "% (동전 던지기 수준)"); } else why.push("– 1년 뒤 플러스 " + Math.round(L.f1.win * 100) + "%"); }
  if (L.dd20) { if (!L.dd20open) { good++; why.push("✓ -20% 낙폭 " + L.dd20 + "번 모두 회복" + (L.recMed ? " (보통 " + Math.round(L.recMed / 30) + "개월)" : "")); } else { bad++; why.push("✗ -20% 낙폭 " + L.dd20open + "번 아직 미회복"); } } else why.push("✓ -20% 낙폭 없음");
  if (L.above200 != null) { if (L.above200) { good++; why.push("✓ 200일선 위 " + corePct(L.vs200, 1)); } else why.push("– 200일선 아래 " + corePct(L.vs200, 1) + " (추세 쉬는 중)"); }
  if (F) {
    if (F.opNeg) { bad += 2; why.push("✗ 영업이익 적자"); }
    if (F.revG != null) { if (F.revG > 0.05) { good++; why.push("✓ 매출 3년 연 " + corePct(F.revG, 0)); } else if (F.revG < 0) { bad++; why.push("✗ 매출 3년 감소"); } else why.push("– 매출 정체"); }
    if (F.opG != null && !F.opNeg) { if (F.opG > 0.05) { good++; why.push("✓ 영업이익 3년 연 " + corePct(F.opG, 0)); } else if (F.opG < 0) { bad++; why.push("✗ 영업이익 3년 감소"); } }
    if (F.roe != null) { if (F.roe >= 10) { good++; why.push("✓ ROE " + F.roe.toFixed(1) + "%"); } else why.push("– ROE " + F.roe.toFixed(1) + "% (10% 미만)"); }
    if (F.margin != null && F.margin >= 0.15) { good++; why.push("✓ 영업이익률 " + Math.round(F.margin * 100) + "%"); }
  }
  var st = bad >= 2 || (L.cagr != null && L.cagr < 0) ? "bad" : bad === 1 || good < 3 ? "mid" : "good";
  return { st: st, t: st === "good" ? "우상향 유지" : st === "mid" ? "주의" : "훼손", why: why, good: good, bad: bad };
}
function coreEssence() {
  var syms = coreSyms();
  return Promise.all([typeof nbLoad === "function" ? nbLoad(syms) : Promise.resolve(), Promise.all(syms.map(coreFund))]).then(function () {
    CORE.ess = syms.map(function (s) { var L = coreLong(s), F = CORE.fund[s] || null; return { sym: s, name: coreName(s), L: L, F: F, V: coreVerdict(L, F) }; });
    return CORE.ess;
  });
}
/* ---------- ② 변수 — 조건 · 뜻 · 대응 ---------- */
var CORE_RESP = {
  krw1400: "원화 자산만 있으면 환차손은 없지만 수입물가·외국인 매도가 따라와요. 미국 자산은 원화로 환산하면 수익이 완충돼요 — 지금 환전·추가 매수는 서두르지 말고 나눠서.",
  krw1300: "'고환율' 구간에 들어왔다는 신호. 달러 자산 비중을 확인하고, 국내 종목은 수출주(유리)·내수주(불리)를 구분해서 볼 것.",
  krwJump: "한 달 +3%는 외국인 자금이 빠져나간다는 뜻. 지수가 같이 빠지면 미리 정해 둔 분할매수 1단계만 실행, 추격 환전은 금지.",
  bokCut: "인하 시작은 '경기가 안 좋다'는 뜻이기도 해요. 첫 인하 뒤 1년 결과는 아래 숫자 참고 — 배당주·리츠·장기채가 금리에 민감.",
  bokHike: "인상 시작: 대출 이자 ↑, 부동산·성장주 밸류 압박. 빚 없이 현금을 잘 버는 기업 위주로 점검.",
  fedCut: "연준 인하 = '돈이 풀린다'(좋음) vs '경기가 꺾인다'(나쁨) — 둘 중 어느 쪽인지 고용·실적으로 확인한 뒤 대응.",
  fedHike: "달러 금리 ↑: 고PER 성장주 밸류 부담, 달러 강세. 분할 매수 간격을 넓히고 현금을 조금 더.",
  us10y45: "안전한 미국 국채가 4.5%를 주면 주식의 '경쟁 상대'가 생겨요. 고PER 비중을 점검하고 채권을 대안으로 검토.",
  inv: "장단기 금리 역전은 '경고등'이지 타이밍이 아니에요 — 역전이 풀린 뒤가 더 위험했던 적이 많아요. 현금 비중만 조금 올려 둠.",
  m2neg: "시중에 돈이 줄어드는 구간: 밸류 높은 자산부터 흔들려요. 본질 좋은 것만 남기고 잡다한 포지션 정리.",
  m2hot: "돈이 넘치는 구간: 자산 가격이 실적보다 앞서가요 — 추격하지 말고 정해 둔 비중 유지."
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
  if (vv != null && isFinite(vv)) V.unshift({ id: "vix", icon: "😱", name: "공포지수(VIX) " + vv.toFixed(1), on: vv >= 30, warn: vv >= 20, now: vv >= 30 ? "30 이상 — 공포 구간" : vv >= 20 ? "20~30 — 주의 구간" : "20 아래 — 평온", resp: "20 아래선 아무것도 안 함. 20~30은 현금만 준비. 30을 넘으면 정해 둔 분할매수(3회)를 시작 — 과거 VIX 30 위에서 산 뒤 1년은 대체로 플러스였어요(카드 '공포지수 구간별' 참고).", mean: "앞으로 한 달 미국 시장이 얼마나 흔들릴지 옵션 가격으로 계산한 값. 평소 12~20, 30 넘으면 공포." });
  return V;
}
/* 오늘 이슈 — 제목으로 종류를 알아내 '무엇을 · 어디서 볼지' */
var CORE_ISS_KB = [
  { re: /공포지수|VIX/, what: "숫자 자체보다 구간 — 20 아래면 평온, 20~30 주의, 30 넘으면 공포. 30 위는 과거 대부분 '싸게 사는 구간'이었지만 며칠 더 빠질 수 있으니 나눠서", ref: "CBOE VIX · 이 앱 '공포지수 구간별 — 1년 뒤' 카드" },
  { re: /증시 (큰 폭 )?(상승|하락)|코스피|코스닥|S&P|나스닥|다우/, what: "지수 하루 등락은 '폭'(오른 종목 비율)과 '주도 업종'을 같이 봐야 해요 — 몇 종목만 끌었으면 약한 상승, 고루 올랐으면 건강한 상승", ref: "이 앱 '오늘' 탭의 오른 종목 비율·업종 성적표 · 거래소 투자자별 매매" },
  { re: /금 |금\+|금\s*[+-]|원자재|유가|은 /, what: "금·유가는 '변수'가 켜질 때 먼저 움직이는 자산 — 달러·실질금리·지정학 중 무엇 때문인지 확인", ref: "미 10년물 실질금리 · 달러인덱스 · 주요 외신" },
  { re: /금리|FOMC|연준|한은|금통위/, what: "결정 자체보다 '앞으로의 말'(성명서·점도표·기자회견)과 발표 뒤 10년물·환율 반응", ref: "연준 성명서(federalreserve.gov) · 한은 통방 결정문 · 미 10년물" },
  { re: /환율|달러|원화/, what: "1,400원 같은 선을 넘었는지, 외국인 순매도가 같이 나오는지, 당국 개입 발언", ref: "서울외환시장 종가 · 외국인 수급(거래소) · 기재부·한은 발언" },
  { re: /물가|CPI|PCE|인플레/, what: "예상치와의 차이, 근원 물가(음식·에너지 제외)가 내려오는지", ref: "미 노동통계국(bls.gov) · 통계청 소비자물가" },
  { re: /실적|어닝|가이던스|영업이익|매출/, what: "숫자보다 '다음 분기 전망(가이던스)'과 컨센서스 대비 — 좋은 실적에 주가가 빠지면 이미 반영된 것", ref: "회사 IR 자료 · DART 공시 · 증권사 컨센서스" },
  { re: /반도체|HBM|AI|엔비디아|하이닉스/, what: "수요(빅테크 설비투자 발표)와 공급(증설·가격)을 따로 보기 — 둘 다 좋아야 오래 감", ref: "빅테크 실적 발표의 capex 항목 · 트렌드포스 메모리 가격" },
  { re: /급등|급락|폭락|폭등|상한가|하한가/, what: "하루 등락은 이유가 무엇이든 '본질이 바뀌었나'만 확인 — 바뀌지 않았으면 규칙대로, 바뀌었으면 비중 재검토", ref: "회사 공시(DART) · 주요 언론 1차 보도" },
  { re: /관세|무역|수출|규제|정책|법안|선거/, what: "실제로 발효되는 시점과 대상, 그리고 과거 비슷한 정책 뒤 지수가 어떻게 갔는지", ref: "정부 발표 원문 · 관세 고시 · 과거 사례(이 앱 '매크로' 탭)" },
  { re: /전쟁|분쟁|지정학|중동|우크라|대만/, what: "유가·금·달러가 먼저 반응해요 — 지수는 과거 대부분 몇 주 안에 회복했지만 유가가 오래 높으면 물가로 번짐", ref: "WTI 유가 · 금 · VIX" },
  { re: /코인|비트코인|이더|ETF|거래소/, what: "현물 ETF 자금 유입·유출, 거래소 사고 여부, 미국 금리 방향(코인은 금리에 민감)", ref: "파사이드(ETF 흐름) · 코인글래스 · 거래소 공지" },
  { re: /부동산|아파트|금리 인하|대출|DSR|청약/, what: "정책이 바뀌는 날짜와 대상(소득구간·지역), 실제 거래량이 따라오는지", ref: "국토부 보도자료 · 실거래가 공개시스템 · TrackApt" }
];
function coreIssKb(t) { t = String(t || ""); for (var i = 0; i < CORE_ISS_KB.length; i++) if (CORE_ISS_KB[i].re.test(t)) return CORE_ISS_KB[i]; return { what: "이 이슈가 '본질(이익·자산 가치)'을 바꾸는지, 아니면 '변수(일시적 가격)'인지부터 구분", ref: "1차 출처(공시·정부 발표·회사 IR) → 그다음 기사" }; }
function coreEvents() { var ev = []; try { ev = typeof pubUpcoming === "function" ? pubUpcoming(14) : []; } catch (e) {} return ev.slice(0, 10).map(function (e) { var kb = typeof pubKb === "function" ? pubKb(e.t) : null, st = kb && typeof pubEvStats === "function" ? pubEvStats(kb.k) : null; return { d: e.d, t: e.t, n: e.n || "", kb: kb, st: st }; }); }
function coreIssues() { var out = []; try { var iss = (typeof briefState !== "undefined" && briefState.issues) || []; iss.slice(0, 5).forEach(function (it) { var w = typeof ISS_WHY !== "undefined" ? ISS_WHY[it.title] : null; out.push({ t: it.title, sub: it.sub || "", why: w ? w.why : "", so: w ? w.so : "", next: w ? w.next : "", src: w ? w.src : "", kb: coreIssKb(it.title + " " + (it.sub || "")) }); }); } catch (e) {} return out; }
/* ---------- ③ 프롬프트 · 답 ---------- */
function coreText() {
  var L = [], E = CORE.ess || [], V = coreVars(), G = coreGroups();
  L.push("[본질 — 묶음별 장기 숫자]  이름 | 연수익 3년/5년/10년 | 1년 | 아무 날 사서 1년 뒤: 플러스 확률·중앙값·최악 (최근 10년) | 고점 대비 | 역대 최대 낙폭 | -20% 낙폭 수(미회복) · 회복 보통/최장 | 200일선 | 52주 위치(0=저점,100=고점) | 연변동성 | (종목) 매출·영업이익 3년 연증가율 · 영업이익률 · ROE · PER · PBR · 배당 | 규칙 판정(좋음/나쁨 수)");
  G.forEach(function (g) { L.push("· " + g.g); g.syms.forEach(function (s) { var x = E.filter(function (e) { return e.sym === s; })[0]; if (!x) return; var l = x.L, f = x.F; L.push("- " + x.name + "(" + x.sym + ") | " + (l ? corePct(l.c3, 1) + "/" + corePct(l.c5, 1) + "/" + corePct(l.c10, 1) + " | " + corePct(l.ret1, 1) + " | " + (l.f1 ? Math.round(l.f1.win * 100) + "% · " + corePct(l.f1.med, 0) + " · 최악 " + corePct(l.f1.worst, 0) : "-") + " | " + corePct(l.cur, 1) + " | " + corePct(l.worst, 0) + (l.worstY ? "(" + l.worstY + ")" : "") + " | " + l.dd20 + "(" + l.dd20open + ") · " + (l.recMed ? Math.round(l.recMed / 30) + "개월/" + Math.round(l.recMax / 30) + "개월" : "-") + " | " + (l.above200 == null ? "-" : (l.above200 ? "위 " : "아래 ") + corePct(l.vs200, 1)) + " | " + (l.pos52 == null ? "-" : Math.round(l.pos52 * 100)) + " | " + (l.vol == null ? "-" : Math.round(l.vol * 100) + "%") : "장기 자료 없음") + (f ? " | 매출 " + corePct(f.revG, 0) + " · 영업이익 " + corePct(f.opG, 0) + (f.opNeg ? "(적자)" : "") + " · 영업이익률 " + (f.margin == null ? "-" : Math.round(f.margin * 100) + "%") + " · ROE " + (f.roe == null ? "-" : f.roe) + " · PER " + (f.per == null ? "-" : f.per) + " · PBR " + (f.pbr == null ? "-" : f.pbr) + " · 배당 " + (f.divY == null ? "-" : f.divY + "%") : "") + " | " + x.V.t + "(" + x.V.good + "/" + x.V.bad + ")"); }); });
  L.push("", "[변수 — 매크로 조건]  조건 | 지금 켜짐? | 지금 값 | 과거 발생 n번 → 코스피 1년 뒤 중앙값/승률");
  V.forEach(function (v) { L.push("- " + v.name + " | " + (v.on ? "켜짐" : v.warn ? "주의" : "꺼짐") + " | " + v.now + (v.y1 ? " | " + v.n + "번 → " + corePct(v.y1.med, 0) + " / 승률 " + Math.round(v.y1.win * 100) + "%" : "")); });
  var ev = coreEvents(); if (ev.length) { L.push("", "[다가오는 일정 14일]"); ev.forEach(function (e) { L.push("- " + e.d + " " + e.t + (e.n ? " — " + e.n : "") + (e.kb ? " — 볼 것: " + e.kb.watch : "")); }); }
  var iss = coreIssues(); if (iss.length) { L.push("", "[오늘 켜진 이슈]"); iss.forEach(function (i) { L.push("- " + i.t + (i.sub ? " · " + i.sub : "") + (i.why ? " — 왜: " + i.why : "") + (i.next ? " / 볼 것: " + i.next : "")); }); }
  return L.join("\n");
}
var CORE_SYS = [
  "너는 장기 투자자의 리서치 파트너다. 독자는 투자를 시작한 지 얼마 안 된 한국 개인투자자 — 전문 용어는 쓰되 바로 뒤에 쉬운 말로 풀어 준다.",
  "생각의 틀은 둘이다. 본질: 기업의 이익·현금흐름·자산의 장기 성장 — 길게 보면 우상향하는가. 변수: 정책·전쟁·금리·환율·유동성 — 미리 맞출 수 없으므로 '발생하면 어떻게 대응할지'만 정한다.",
  "규칙: (1) 아래 [앱 데이터]의 숫자가 1순위, 숫자를 지어내지 않는다. (2) 웹 검색으로 자산마다 최근 2주의 '본질에 관한 사실'(실적·가이던스·수주·배당 정책·규제·ETF 자금 흐름 등)을 하나 이상 찾아 날짜·출처를 붙인다 — 못 찾으면 빈칸. (3) 매수·매도 권유·목표가·수익 보장 금지 — 판단은 '조건이면 이렇게'. (4) 변수는 예측하지 말고 '지금 상태 → 켜지면 대응'으로만. (5) 모든 자산을 빠짐없이 다룬다(묶음 순서대로).",
  "", "답변 형식 (설명 없이 ```json 하나):",
  "```json", "{",
  '  "essence": { "verdict": "우상향 유지 | 주의 | 훼손 (전체 기준)", "score": 0~100, "one": "한 줄 결론(40자)", "easy": "초보에게 설명하듯 3문장 — 지금 본질이 어떤 상태인지",',
  '    "assets": [ { "name": "이름(앱 데이터 이름 그대로)", "group": "묶음 이름", "st": "유지|주의|훼손", "score": 0~100,',
  '        "numbers": [ { "l": "숫자 이름(예: 10년 연수익)", "v": "값", "m": "이 숫자가 뜻하는 것 한 줄(쉽게)" } ],  // 가장 중요한 숫자 3개',
  '        "why": "판정 이유 2~3문장(본질 관점: 이익·성장·회복력)", "fact": "최근 2주 본질 관련 사실 — 출처·날짜 (없으면 빈칸)", "risk": "이 자산의 본질을 훼손할 수 있는 것 한 줄", "watch": "본질이 바뀌었는지 확인할 숫자·시점 한 줄", "action": "지금 행동 수준 한 줄(조건부 — 비중·분할·보유)" } ] },',
  '  "variables": [ { "name": "변수", "state": "평온|주의|경계", "easy": "이게 뭔지 한 줄(쉽게)", "now": "지금 상태(숫자·날짜)", "trigger": "대응을 시작할 조건(숫자)", "response": "그때 할 일(비중·분할·확인)", "hit": "켜지면 어느 자산이 먼저 흔들리나" } ],',
  '  "scenarios": [ { "name": "시나리오", "p": "낮음|보통|높음", "what": "무슨 일", "sign": "시작 신호", "do": "그때 할 일" } ],',
  '  "outlook": { "3개월": "조건부 전망 2문장(변수 중심)", "1년": "조건부 전망 2문장(본질 중심)" },',
  '  "stance": "지금 행동 수준 한 줄", "change": ["이 판단을 바꿀 조건 3개(숫자·사건)"], "sources": ["출처 · 날짜"]',
  "}", "```"
];
function corePrompt() { return CORE_SYS.join("\n") + "\n\n오늘: " + smKstDay() + " (한국 시간)\n\n[앱 데이터]\n" + coreText(); }
function coreParse(text) { var t = String(text || ""), m = t.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i), raw = m ? m[1] : (function () { var s = t.indexOf("{"), e = t.lastIndexOf("}"); return s >= 0 && e > s ? t.slice(s, e + 1) : null; })(); if (!raw) return null; var tries = [raw, raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1").replace(/\/\/[^\n"]*$/gm, "")]; for (var i = 0; i < tries.length; i++) { try { var J = JSON.parse(tries[i]); if (J && typeof J === "object") return J; } catch (e) {} } return null; }
function coreSave(J, raw) { var rec = { day: smKstDay(), at: Date.now(), j: J, raw: String(raw).slice(0, 30000) }; CORE.ans = rec; try { localStorage.setItem("sm.core", JSON.stringify(rec)); } catch (e) {} if (typeof smKvPut === "function") smKvPut("cfg:core:last", rec, 90 * 86400).catch(function () {}); }
function coreLoadAns() { try { var r = JSON.parse(localStorage.getItem("sm.core") || "null"); if (r && r.j) CORE.ans = r; } catch (e) {} if (!CORE.ans && typeof smKvGet === "function") smKvGet("cfg:core:last").then(function (r) { if (r && r.j && !CORE.ans) { CORE.ans = r; if (currentTab === "core") renderCore(); } }); }
/* ---------- 화면 ---------- */
var CORE_ST = { good: ["우상향 유지", "#1d7f55"], mid: ["주의", "#b9600f"], bad: ["훼손", "#c03b3b"], na: ["자료 부족", "#889"] };
var CORE_COLS = [["판정", "규칙으로 매긴 결론 — 아래 '근거'의 ✓(좋음)·✗(나쁨) 개수로"], ["연수익", "3년/5년/10년, 매년 평균 몇 % 늘었나(복리). 7% 이상이면 10년에 두 배"], ["1년 뒤", "최근 10년 동안 '아무 날이나 사서 1년 들고 있었다면' 플러스였던 비율 · 중앙값 · 최악 — 본질이 좋은 자산은 70% 이상"], ["낙폭", "고점 대비 지금 몇 % 아래인지 · 역대 최대 낙폭(연도)"], ["회복", "-20% 넘게 빠진 적이 몇 번이고 모두 회복했는지 · 회복에 보통 몇 개월"], ["200일선", "최근 200일 평균 가격 — 위면 추세 유지, 아래면 쉬는 중"], ["52주 위치", "1년 중 최저가 0 ~ 최고가 100 사이 지금 자리"], ["본질(종목)", "매출·영업이익 3년 연평균 증가율 · 영업이익률 · ROE(자기자본 대비 이익) · PER(이익 대비 가격) · PBR(장부가 대비 가격) · 배당률"]];
function coreEssHtml() {
  var E = CORE.ess; if (!E) return '<div class="briefDim">장기 데이터를 계산하는 중… (10년치 시세 · 종목 재무 — 처음엔 30초쯤)</div>';
  var g = E.filter(function (x) { return x.V.st === "good"; }).length, by = {}; E.forEach(function (x) { by[x.sym] = x; });
  var h = '<div class="coreSum"><b>' + g + '/' + E.length + '</b> 자산이 <i>우상향 유지</i> — 본질이 유지되는 것은 변수가 와도 들고 간다 <button class="chip" data-corehelp="ess">이 표 읽는 법</button></div>' +
    '<div class="coreHelp" data-help="ess" hidden><ul>' + CORE_COLS.map(function (c) { return '<li><b>' + c[0] + '</b> — ' + c[1] + '</li>'; }).join("") + '<li><b>판정 규칙</b> — 연수익 7%↑ · 1년 뒤 플러스 70%↑ · -20% 낙폭 모두 회복 · 200일선 위 · (종목) 매출·영업이익 3년 연 5%↑ · ROE 10%↑ · 영업이익률 15%↑ 가 ✓. ✓가 셋 미만이면 <i>주의</i>, ✗가 둘 이상이거나 장기 수익이 마이너스·영업적자면 <i>훼손</i>.</li></ul></div>';
  coreGroups().forEach(function (G) {
    var rows = G.syms.map(function (s) { return by[s]; }).filter(Boolean); if (!rows.length) return;
    h += '<div class="coreGH">' + coreEsc(G.g) + ' <small>' + rows.filter(function (x) { return x.V.st === "good"; }).length + '/' + rows.length + ' 유지</small></div><div class="coreTW"><table class="coreT"><thead><tr><th>자산</th><th>판정</th><th>연수익 3/5/10년</th><th>1년</th><th>1년 뒤 +확률 · 중앙값 · 최악</th><th>낙폭 (지금 · 최대)</th><th>회복</th><th>200일선</th><th>52주</th><th>본질(종목)</th></tr></thead><tbody>' +
      rows.map(function (x) { var l = x.L, f = x.F, st = CORE_ST[x.V.st]; return '<tr><td><b>' + coreEsc(x.name) + '</b><small>' + coreEsc(x.sym) + '</small></td><td><span class="coreBadge" style="background:' + st[1] + '">' + st[0] + '</span><small>✓' + x.V.good + ' ✗' + x.V.bad + '</small></td>' + (l ? '<td>' + corePct(l.c3, 0) + ' / ' + corePct(l.c5, 0) + ' / ' + corePct(l.c10, 0) + '</td><td class="' + (l.ret1 >= 0 ? "up" : "dn") + '">' + corePct(l.ret1, 1) + '</td><td>' + (l.f1 ? '<b>' + Math.round(l.f1.win * 100) + '%</b> · ' + corePct(l.f1.med, 0) + ' · <span class="dn">' + corePct(l.f1.worst, 0) + '</span>' : '-') + '</td><td><span class="dn">' + corePct(l.cur, 1) + '</span> · ' + corePct(l.worst, 0) + '<small>' + (l.worstY || "") + '</small></td><td>' + (l.dd20 ? (l.dd20 - l.dd20open) + '/' + l.dd20 + (l.dd20open ? ' <b class="dn">미회복</b>' : ' ✓') + (l.recMed ? '<small>보통 ' + Math.round(l.recMed / 30) + '개월</small>' : '') : '없음') + '</td><td class="' + (l.above200 ? "up" : "dn") + '">' + (l.above200 == null ? "-" : (l.above200 ? "위 " : "아래 ") + corePct(l.vs200, 1)) + '</td><td>' + (l.pos52 == null ? "-" : '<span class="coreBar"><i style="width:' + Math.round(l.pos52 * 100) + '%"></i></span>' + Math.round(l.pos52 * 100)) + '</td>' : '<td colspan="7" class="briefDim">장기 자료 없음</td>') + '<td>' + (f ? '<small>매출 ' + corePct(f.revG, 0) + ' · 영업이익 ' + (f.opNeg ? '<b class="dn">적자</b>' : corePct(f.opG, 0)) + ' · 이익률 ' + (f.margin == null ? "-" : Math.round(f.margin * 100) + "%") + '<br>ROE ' + (f.roe == null ? "-" : f.roe.toFixed(1)) + ' · PER ' + (f.per == null ? "-" : f.per.toFixed(1)) + ' · PBR ' + (f.pbr == null ? "-" : f.pbr.toFixed(2)) + (f.divY != null ? ' · 배당 ' + f.divY.toFixed(1) + '%' : '') + '</small>' : '<small class="briefDim">' + (coreIsStock(x.sym) ? "재무 없음" : "지수·ETF·코인") + '</small>') + '</td></tr><tr class="coreWhy"><td colspan="10">' + coreEsc(x.V.why.join("  ")) + '</td></tr>'; }).join("") + '</tbody></table></div>';
  });
  return h;
}
function coreVarHtml() {
  var V = coreVars(), on = V.filter(function (v) { return v.on; }), ev = coreEvents(), iss = coreIssues();
  var row = function (v) { return '<div class="coreVar ' + (v.on ? "on" : v.warn ? "warn" : "") + '"><div class="coreVarH"><span class="coreDot"></span><b>' + coreEsc(v.icon + " " + v.name) + '</b><em>' + (v.on ? "지금 켜짐" : v.warn ? "주의" : "꺼짐") + '</em></div>' + (v.mean ? '<div class="coreVarM"><small>뜻</small>' + coreEsc(v.mean) + '</div>' : '') + '<div class="coreVarNow"><small>지금</small>' + coreEsc(v.now) + (v.y1 ? '<br><small>과거</small>' + v.n + '번 켜진 뒤 코스피 1년 중앙값 <b>' + corePct(v.y1.med, 0) + '</b> · 올랐던 비율 ' + Math.round(v.y1.win * 100) + '%' + (v.m3 ? ' (3개월 ' + corePct(v.m3.med, 0) + ')' : '') : '') + '</div>' + (v.resp ? '<div class="coreVarR"><small>켜지면</small>' + coreEsc(v.resp) + '</div>' : '') + '</div>'; };
  var h = '<div class="coreSum">지금 켜진 변수 <b>' + on.length + '</b>개 — 변수는 맞추는 게 아니라 <i>켜졌을 때 규칙대로</i> <button class="chip" data-corehelp="var">읽는 법</button></div><div class="coreHelp" data-help="var" hidden><ul><li><b>켜짐/꺼짐</b> — 조건(예: 환율 1,400원 돌파)이 지금 성립하는지. 빨간 테두리가 켜진 것.</li><li><b>과거</b> — 같은 조건이 켜졌던 날들 뒤 코스피가 1년 동안 어떻게 갔는지의 중앙값과, 오른 경우의 비율. 미래 보장이 아니라 "보통 이랬다"는 기준.</li><li><b>켜지면</b> — 그때 할 일을 미리 적어 둔 것. 변수는 예측하지 않고, 켜졌을 때 이 줄대로만 움직이는 게 목적.</li></ul></div>';
  h += V.length ? '<div class="coreVars">' + on.map(row).join("") + V.filter(function (v) { return !v.on; }).map(row).join("") + '</div>' : '<div class="briefDim">매크로 데이터를 불러오는 중…</div>';
  if (iss.length) h += '<div class="coreH">오늘 켜진 이슈 <small class="briefDim">브리핑 핵심 이슈 — 이유는 Claude 정리 · "무엇을 볼지"는 이슈 종류별 안내</small></div><div class="coreIss">' + iss.map(function (i) { return '<div class="coreIssC"><b>' + coreEsc(i.t) + '</b>' + (i.sub ? '<small class="briefDim"> ' + coreEsc(i.sub) + '</small>' : '') + (i.why ? '<div class="coreL"><small>왜</small>' + coreEsc(i.why) + (i.src ? ' <em>(' + coreEsc(i.src) + ')</em>' : '') + '</div>' : '') + (i.so ? '<div class="coreL"><small>그래서</small>' + coreEsc(i.so) + '</div>' : '') + '<div class="coreL"><small>무엇을</small>' + coreEsc(i.next || i.kb.what) + '</div><div class="coreL"><small>어디서</small>' + coreEsc(i.kb.ref) + '</div></div>'; }).join("") + '</div>';
  if (ev.length) h += '<div class="coreH">다가오는 변수 <small class="briefDim">14일 — 무엇이고 · 왜 중요하고 · 무엇을 볼지</small></div><div class="coreIss">' + ev.map(function (e) { var kb = e.kb; return '<div class="coreIssC ev"><b><span class="coreD">' + coreEsc(e.d.slice(5)) + '</span>' + coreEsc(e.t) + '</b>' + (kb ? '<div class="coreL"><small>무엇</small>' + coreEsc(kb.what) + '</div><div class="coreL"><small>왜</small>' + coreEsc(kb.why) + '</div><div class="coreL"><small>볼 것</small>' + coreEsc(kb.watch) + '</div><div class="coreL"><small>움직임</small>' + coreEsc(kb.who) + (e.st && e.st.abs != null ? ' · 과거 발표일 S&P500 평균 ±' + (e.st.abs * 100).toFixed(1) + '%' : '') + '</div>' : e.n ? '<div class="coreL"><small>메모</small>' + coreEsc(e.n) + '</div>' : '<div class="coreL"><small>볼 것</small>발표 시각과 예상치 — 예상과 다를 때만 시장이 움직여요</div>') + '</div>'; }).join("") + '</div>';
  return h;
}
function coreAnsHtml() {
  var A = CORE.ans, J = A && A.j; if (!J) return '<div class="briefDim">③에서 답을 붙여넣으면 여기에 자산별 상세 판정 · 변수 대응 · 시나리오 · 전망이 정리돼요.</div>';
  var es = J.essence || {}, st = /유지/.test(es.verdict) ? "good" : /훼손/.test(es.verdict) ? "bad" : "mid", sc = parseFloat(es.score), stc = function (s) { return /유지/.test(s) ? "good" : /훼손/.test(s) ? "bad" : "mid"; };
  var h = '<div class="anxHero ' + st + '"><div class="anxHeroL"><div class="anxVerdict">본질 · ' + coreEsc(es.verdict || "-") + '</div><div class="anxOne">' + coreEsc(es.one || "") + '</div>' + (es.easy ? '<div class="anxOne" style="font-size:12.5px;opacity:.9;margin-top:6px">' + coreEsc(es.easy) + '</div>' : '') + '<div class="anxMeta">' + (A.day || "") + ' · claude.ai 직접 · ' + coreEsc(J.stance || "") + '</div></div>' + (isFinite(sc) ? '<div class="anxGauge" style="--v:' + sc + '"><b>' + Math.round(sc) + '</b><small>/100</small></div>' : '') + '</div>';
  var assets = es.assets || [];
  if (assets.length) {
    var groups = []; assets.forEach(function (a) { var g = a.group || "자산"; if (groups.indexOf(g) < 0) groups.push(g); });
    h += '<div class="anxH">자산별 본질 판정 <small class="briefDim">' + assets.length + '개 · 제목을 누르면 접혀요</small></div>';
    groups.forEach(function (g) { h += '<div class="coreGH">' + coreEsc(g) + '</div><div class="coreCards">' + assets.filter(function (a) { return (a.group || "자산") === g; }).map(function (a, i) { var c = stc(a.st), s2 = parseFloat(a.score); return '<details class="coreCard ' + c + '" open><summary><span class="coreBadge" style="background:' + CORE_ST[c][1] + '">' + coreEsc(a.st || "") + '</span><b>' + coreEsc(a.name) + '</b>' + (isFinite(s2) ? '<i class="coreScore"><u style="width:' + Math.round(s2) + '%"></u><span>' + Math.round(s2) + '</span></i>' : '') + '</summary><div class="coreCardB">' + ((a.numbers || []).length ? '<div class="coreNums">' + a.numbers.slice(0, 4).map(function (n) { return '<div><b>' + coreEsc(n.v) + '</b><small>' + coreEsc(n.l) + '</small><em>' + coreEsc(n.m || "") + '</em></div>'; }).join("") + '</div>' : '') + (a.why ? '<div class="coreL"><small>왜</small>' + coreEsc(a.why) + '</div>' : '') + (a.fact ? '<div class="coreL fact"><small>최근</small>' + coreEsc(a.fact) + '</div>' : '') + (a.risk ? '<div class="coreL"><small>리스크</small>' + coreEsc(a.risk) + '</div>' : '') + (a.watch ? '<div class="coreL"><small>확인</small>' + coreEsc(a.watch) + '</div>' : '') + (a.action ? '<div class="coreL act"><small>지금</small>' + coreEsc(a.action) + '</div>' : '') + '</div></details>'; }).join("") + '</div>'; });
  }
  if ((J.variables || []).length) h += '<div class="anxH">변수 대응 — 켜지면 이렇게</div><div class="coreVars">' + J.variables.map(function (v) { var c = /경계/.test(v.state) ? "bad" : /주의/.test(v.state) ? "mid" : "good"; return '<div class="coreVar ' + (c === "bad" ? "on" : c === "mid" ? "warn" : "") + '"><div class="coreVarH"><span class="coreDot"></span><b>' + coreEsc(v.name) + '</b><em><span class="coreBadge" style="background:' + CORE_ST[c][1] + '">' + coreEsc(v.state || "") + '</span></em></div>' + (v.easy ? '<div class="coreVarM"><small>뜻</small>' + coreEsc(v.easy) + '</div>' : '') + '<div class="coreL"><small>지금</small>' + coreEsc(v.now || "") + '</div><div class="coreL"><small>시작 조건</small>' + coreEsc(v.trigger || "") + '</div><div class="coreL act"><small>할 일</small>' + coreEsc(v.response || "") + '</div>' + (v.hit ? '<div class="coreL"><small>먼저 흔들림</small>' + coreEsc(v.hit) + '</div>' : '') + '</div>'; }).join("") + '</div>';
  if ((J.scenarios || []).length) h += '<div class="anxH">시나리오 — 이런 일이 생기면</div><div class="coreVars">' + J.scenarios.slice(0, 4).map(function (s) { return '<div class="coreVar"><div class="coreVarH"><b>' + coreEsc(s.name) + '</b><em>가능성 ' + coreEsc(s.p || "") + '</em></div><div class="coreL"><small>무슨 일</small>' + coreEsc(s.what || "") + '</div>' + (s.sign ? '<div class="coreL"><small>시작 신호</small>' + coreEsc(s.sign) + '</div>' : '') + '<div class="coreL act"><small>할 일</small>' + coreEsc(s.do || "") + '</div></div>'; }).join("") + '</div>';
  if (J.outlook) h += '<div class="anxH">조건부 전망</div><div class="anxTwo"><div class="anxAct"><small style="font-weight:700">3개월 · 변수 중심</small><div style="font-size:13px;line-height:1.5">' + coreEsc(J.outlook["3개월"] || "") + '</div></div><div class="anxAct"><small style="font-weight:700">1년 · 본질 중심</small><div style="font-size:13px;line-height:1.5">' + coreEsc(J.outlook["1년"] || "") + '</div></div></div>';
  if ((J.change || []).length) h += '<div class="anxH">이 판단을 바꿀 조건</div><ul class="coreList">' + J.change.map(function (c) { return '<li>' + coreEsc(c) + '</li>'; }).join("") + '</ul>';
  if ((J.sources || []).length) h += '<div class="anxSrc">출처: ' + J.sources.map(coreEsc).join(" · ") + '</div>';
  return h;
}
function renderCore() {
  var box = document.getElementById("coreBody"); if (!box) return;
  if (!(typeof isOwner === "function" && isOwner())) { box.innerHTML = '<div class="dvEmpty">운영자 전용 페이지예요.</div>'; return; }
  if (!CORE.ess && !CORE.busy) { CORE.busy = true; var ps = [coreEssence()]; if (typeof macroEnsure === "function") ps.push(macroEnsure().then(function () { return typeof macPxLoad === "function" ? macPxLoad() : null; }).catch(function () {})); if (typeof briefState !== "undefined" && !briefState.result && typeof loadBrief === "function") { try { loadBrief(false); } catch (e) {} } Promise.all(ps).then(function () { CORE.busy = false; if (currentTab === "core") renderCore(); }); }
  if (!CORE.ans) coreLoadAns();
  var h = '<div class="coreIntro"><div><b>변수</b>는 미리 맞출 수 없다 → <i>발생하면 규칙대로 대응</i><small>정책·전쟁·금리·환율·유동성. 예측하지 않고, 켜졌을 때 할 일만 정해 둔다.</small></div><div><b>본질</b>은 길게 보면 우상향한다 → <i>그것을 보고 들고 간다</i><small>기업의 이익·현금흐름, 자산의 장기 성장. 이게 유지되는 한 변수에 흔들리지 않는다.</small></div></div>';
  h += '<section class="anSec"><div class="mkStep"><b>1</b> 본질 — 길게 보면 우상향인가 <small class="briefDim">지수·ETF / 코인 / 미국 Top10 / 국내 Top5 / 내 관심·보유 — 10년 시세 · 1년 뒤 확률 · 낙폭 회복 · 재무</small><button class="chip" data-corer style="margin-left:auto">다시 계산</button></div>' + coreEssHtml() + '</section>';
  h += '<section class="anSec"><div class="mkStep"><b>2</b> 변수 — 켜졌는가, 켜지면 어떻게 <small class="briefDim">매크로 조건 · 공포지수 · 오늘 이슈 · 다가오는 일정</small></div>' + coreVarHtml() + '</section>';
  h += '<section class="anSec"><div class="mkStep"><b>3</b> 평가 · 판단 · 예측 <small class="briefDim">프롬프트 복사 → claude.ai(Fable 5.1 · 웹 검색 켜기) → 답 붙여넣기</small></div>' +
    '<div class="anxSteps"><div><i>1</i> 프롬프트 복사(①②가 전부 들어가요)</div><div><i>2</i> claude.ai 새 대화 · 웹 검색 켜기 · 자산마다 최근 사실을 찾게 돼요</div><div><i>3</i> ```json 블록을 붙여넣고 저장</div></div>' +
    '<div class="anActs"><button class="primary" data-corep' + (CORE.ess ? '' : ' disabled') + '>📋 본질·변수 프롬프트 복사</button><button class="chip" data-corepv>프롬프트 보기</button><span class="briefDim" data-coremsg></span></div><div class="anxPv" hidden><textarea class="thrText" rows="12" readonly spellcheck="false"></textarea><small class="briefDim anxLen"></small></div>' +
    '<textarea class="anAnsIn" rows="7" data-corein placeholder="Claude 답변을 붙여넣으세요 (```json … ``` 포함)"></textarea><div class="anActs"><button class="primary" data-coreok>💾 저장하고 판정 보기</button><span class="briefDim" data-corechk></span></div></section>';
  h += '<section class="anSec"><div class="mkStep"><b>4</b> 판정 <small class="briefDim">' + (CORE.ans ? coreEsc(CORE.ans.day) + ' 저장분' : '') + '</small>' + (CORE.ans ? '<button class="chip" data-coreraw style="margin-left:auto">원문</button>' : '') + '</div>' + coreAnsHtml() + '</section>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-corehelp]"), function (b) { b.onclick = function () { var d = box.querySelector('[data-help="' + b.getAttribute("data-corehelp") + '"]'); if (d) d.hidden = !d.hidden; }; });
  var rb = box.querySelector("[data-corer]"); if (rb) rb.onclick = function () { CORE.ess = null; CORE.fund = {}; renderCore(); };
  var pv = box.querySelector(".anxPv"), msg = box.querySelector("[data-coremsg]"), show = function (t) { pv.hidden = false; pv.querySelector("textarea").value = t; pv.querySelector(".anxLen").textContent = t.length.toLocaleString() + "자"; };
  var pb = box.querySelector("[data-corep]"); if (pb) pb.onclick = function () { var t = corePrompt(); CORE.prompt = t; chCopy(t, pb); show(t); msg.textContent = t.length.toLocaleString() + "자 · 자산 " + (CORE.ess || []).length + "개 · claude.ai에 그대로 붙여넣기"; };
  box.querySelector("[data-corepv]").onclick = function () { if (!pv.hidden) { pv.hidden = true; return; } show(corePrompt()); };
  var inp = box.querySelector("[data-corein]"), chk = box.querySelector("[data-corechk]");
  inp.oninput = function () { var J = coreParse(inp.value); chk.innerHTML = !inp.value.trim() ? "" : J ? '<b style="color:#1d7f55">✓ 읽음</b> · 자산 ' + ((J.essence || {}).assets || []).length + '/' + (CORE.ess || []).length + ' · 변수 ' + (J.variables || []).length + ' · 시나리오 ' + (J.scenarios || []).length : '<b style="color:#b9600f">JSON을 못 읽었어요</b> — ```json 블록 전체를 붙여넣어 주세요'; };
  box.querySelector("[data-coreok]").onclick = function () { var J = coreParse(inp.value); if (!J) { chk.innerHTML = '<b style="color:#b9600f">JSON을 못 읽었어요</b>'; return; } coreSave(J, inp.value); smToast("저장했어요 — ④ 판정"); renderCore(); setTimeout(function () { var s = document.querySelectorAll("#coreBody .anSec")[3]; if (s) try { s.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }, 100); };
  var raw = box.querySelector("[data-coreraw]"); if (raw) raw.onclick = function () { var w = document.createElement("div"); w.innerHTML = '<textarea class="thrText" rows="20" readonly style="width:100%"></textarea>'; w.querySelector("textarea").value = CORE.ans.raw || ""; infoModal.open("답변 원문", w); };
}
/* ---------- 탭 등록 (index.html 수정 없이) ---------- */
(function () {
  if (typeof TABS === "undefined" || typeof switchTab !== "function") return;
  if (TABS.indexOf("core") < 0) TABS.push("core"); if (typeof OWNER_TABS !== "undefined" && OWNER_TABS.indexOf("core") < 0) OWNER_TABS.push("core");
  var an = document.getElementById("tab-analyst"); if (an && !document.getElementById("tab-core")) { var d = document.createElement("div"); d.id = "tab-core"; d.className = "hidden"; d.innerHTML = '<div class="card"><div class="pgHead"><h2>본질 · 변수 <small>본질은 길게, 변수는 대응으로 — 운영자 전용</small></h2></div><div id="coreBody" style="margin-top:10px"></div></div>'; an.parentNode.insertBefore(d, an.nextSibling); }
  var nb = document.querySelector('.tabs button[data-tab="analyst"]'); if (nb && !document.querySelector('.tabs button[data-tab="core"]')) { var b = document.createElement("button"); b.setAttribute("data-tab", "core"); b.className = "ownerOnly"; b.innerHTML = "<i>⚖️</i><span>본질·변수</span>"; nb.parentNode.insertBefore(b, nb.nextSibling); b.onclick = function () { switchTab("core"); }; }
  var s0 = switchTab; switchTab = function (t) { if (t === "core" && !(typeof isOwner === "function" && isOwner())) t = "home"; var r = s0.apply(this, arguments); try { if (t === "core") renderCore(); } catch (e) { console.warn(e); } return r; };
  if (typeof SM_GUIDE !== "undefined") SM_GUIDE.core = { t: "본질·변수", s: ["① 본질: 사람들이 많이 보는 자산(지수·코인·미국 Top10·국내 Top5)과 내 관심·보유 종목이 길게 우상향하는지 숫자로 판정해요 — '이 표 읽는 법'을 누르면 칸마다 뜻이 나와요.", "② 변수: 환율·금리·공포지수 같은 조건이 지금 켜졌는지, 뜻은 무엇인지, 켜지면 할 일을 정해 둬요. 오늘 이슈·다가오는 일정엔 '무엇을·어디서 볼지'가 붙어요.", "③ 프롬프트를 복사해 claude.ai에 묻고 답을 붙여넣으면 ④에 자산별 상세 카드 · 변수 대응 · 시나리오 · 전망이 정리돼요."] };
  var st = document.createElement("style"); st.textContent = [
    ".coreIntro{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 4px}.coreIntro>div{background:#14161c;color:#f3efe6;border-radius:12px;padding:10px 14px;font-size:13.5px}.coreIntro i{font-style:normal;color:#e6c57a}.coreIntro small{display:block;font-size:11.5px;color:#b9b3a8;margin-top:4px}",
    ".coreSum{font-size:14px;margin:6px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.coreSum b{font-size:18px;color:#1f3a68}.coreSum i{font-style:normal;color:#1d7f55;font-weight:700}.coreHelp{background:#fffaf0;border:1px solid #e6d3a3;border-radius:10px;padding:8px 12px;font-size:12.5px;margin-bottom:8px}.coreHelp ul{margin:0;padding-left:16px;line-height:1.6}.coreHelp i{font-style:normal;font-weight:700}",
    ".coreGH{font-weight:800;font-size:13.5px;margin:12px 0 4px;color:#14161c}.coreGH small{font-weight:400;color:#889;margin-left:6px}.coreTW{overflow-x:auto;-webkit-overflow-scrolling:touch}",
    ".coreT{width:100%;border-collapse:collapse;font-size:12.5px;min-width:900px}.coreT th{font-weight:700;color:#667;text-align:left;padding:6px 6px;border-bottom:2px solid #e5e7eb;white-space:nowrap;font-size:11.5px}.coreT td{padding:7px 6px;border-bottom:1px solid #f0f0f0;vertical-align:top;white-space:nowrap}.coreT td:last-child{white-space:normal;min-width:210px;line-height:1.45}.coreT td small{display:block;color:#99a;font-size:11px}.coreT td.up,.coreT .up{color:#c03b3b;font-weight:700}.coreT td.dn,.coreT .dn{color:#2456b7;font-weight:700}.coreT tr.coreWhy td{border-bottom:1px solid #e5e7eb;padding:0 6px 8px;color:#667;font-size:11.5px;white-space:normal}",
    ".coreBar{display:inline-block;width:46px;height:6px;background:#e5e7eb;border-radius:3px;margin-right:4px;vertical-align:middle}.coreBar i{display:block;height:100%;background:#1f3a68;border-radius:3px}",
    ".coreBadge{display:inline-block;color:#fff;border-radius:8px;padding:2px 8px;font-size:11.5px;font-weight:700;white-space:nowrap}",
    ".coreVars{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}.coreVar{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;background:#fff;min-width:0}.coreVar.on{border-color:#c03b3b;background:#fcefef}.coreVar.warn{border-color:#e6c57a;background:#fffaf0}",
    ".coreVarH{display:flex;align-items:center;gap:8px;font-size:13.5px}.coreVarH b{flex:1;min-width:0}.coreVarH em{font-style:normal;font-size:11.5px;color:#889;white-space:nowrap}.coreVar.on .coreVarH em{color:#c03b3b;font-weight:700}.coreDot{width:10px;height:10px;border-radius:50%;background:#cbd5e1;flex:none}.coreVar.on .coreDot{background:#c03b3b}.coreVar.warn .coreDot{background:#e6c57a}",
    ".coreVarM{font-size:12px;color:#556;margin-top:5px;line-height:1.5}.coreVarNow{font-size:12px;color:#556;margin-top:4px;line-height:1.6}.coreVarR{font-size:12px;margin-top:6px;padding-top:6px;border-top:1px dashed #e5e7eb;line-height:1.5}.coreVarM small,.coreVarNow small,.coreVarR small,.coreL small{display:inline-block;background:#eef0f4;color:#445;border-radius:6px;padding:0 6px;margin-right:6px;font-weight:700;font-size:11px}.coreVarR small{background:#14161c;color:#e6c57a}",
    ".coreL{font-size:12.5px;line-height:1.55;margin-top:5px;word-break:keep-all;overflow-wrap:anywhere}.coreL.act small{background:#14161c;color:#e6c57a}.coreL.fact small{background:#e8eefb;color:#1f3a68}.coreL em{color:#99a;font-style:normal;font-size:11px}",
    ".coreIss{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px}.coreIssC{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;background:#fff;font-size:13px;min-width:0}.coreIssC>b{display:block;margin-bottom:2px}.coreIssC.ev{background:#fbf8f1}.coreD{display:inline-block;background:#14161c;color:#e6c57a;border-radius:6px;padding:0 6px;font-size:11.5px;margin-right:6px}",
    ".coreH{font-weight:700;font-size:13.5px;margin:14px 0 6px;color:#1f3a68}.coreList{margin:0;padding-left:18px;font-size:12.5px;line-height:1.6}",
    ".coreCards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px;margin-bottom:6px}.coreCard{border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:0;min-width:0}.coreCard.good{border-left:5px solid #1d7f55}.coreCard.mid{border-left:5px solid #b9600f}.coreCard.bad{border-left:5px solid #c03b3b}.coreCard summary{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;list-style:none;font-size:14px}.coreCard summary::-webkit-details-marker{display:none}.coreCard summary b{flex:1;min-width:0}.coreScore{position:relative;width:70px;height:16px;background:#eef0f4;border-radius:8px;overflow:hidden;font-style:normal;flex:none}.coreScore u{position:absolute;left:0;top:0;bottom:0;background:#c9a24f;text-decoration:none}.coreScore span{position:relative;display:block;text-align:center;font-size:10.5px;font-weight:800;line-height:16px}",
    ".coreCardB{padding:0 12px 12px}.coreNums{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:4px 0 8px}.coreNums>div{background:#f4f6fb;border-radius:10px;padding:8px}.coreNums b{display:block;font-size:17px;color:#14161c}.coreNums small{display:block;font-size:11px;color:#667;margin-top:2px}.coreNums em{display:block;font-size:11px;color:#889;font-style:normal;margin-top:3px;line-height:1.4}",
    "@media(max-width:640px){.coreIntro{grid-template-columns:1fr}.coreNums{grid-template-columns:1fr 1fr}.coreT{min-width:860px}}",
    "[data-theme=dark] .coreVar,[data-theme=dark] .coreIssC,[data-theme=dark] .coreCard{background:#1e2533;border-color:#2b3447}[data-theme=dark] .coreT td{border-color:#2b3447}[data-theme=dark] .coreNums>div{background:#232a38}"
  ].join(""); document.head.appendChild(st);
})();
