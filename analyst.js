/* ============================================================================================
   StockMind v12.3 — 애널리스트 (운영자 전용)
   "월가 애널리스트처럼" 6가지 분석 틀: 기업 · 차트 · 실적 · 재무제표 · 포트폴리오 · 매크로
   모듈마다 ① 제시(앱 데이터 표) → ② 평가(체크리스트 4개 ✓/△/✗ + 이유) → ③ 정리(글) → 프롬프트(데이터 포함 복사) · AI 분석
   숫자는 앱 데이터(야후 종가 · 네이버 증권 재무 · ECOS/FRED)만 쓰고, 없으면 '데이터 없음'으로 표시한다. 과금 없음 · api 함수 추가 없음.
   ============================================================================================ */
var AN = { mod: "biz", sym: null, out: null, busy: false, cache: {}, step: 1, pScope: "module", showData: true };
var AN_MODS = [
  { id: "biz", no: "01", t: "기업 분석", sub: "사업모델 · 성장성 · 적정가치", icon: "🏢", need: "stock",
    ck: ["핵심 사업모델과 수익원", "경쟁력과 성장 동력", "3~5년 실적 전망", "적정 가치와 주요 리스크"],
    role: "너는 글로벌 주식 애널리스트다.", prompt: "[기업명/티커]의 사업모델, 핵심 수익원, 경쟁력, 3~5년 성장 전망, 적정 가치와 주요 리스크를 최신 공시와 신뢰할 수 있는 자료를 바탕으로 분석해줘. 숫자는 출처와 함께 제시해줘." },
  { id: "chart", no: "02", t: "차트 분석", sub: "추세 · 지지선 · 저항선 · 기술적 지표", icon: "📈", need: "stock",
    ck: ["주가 추세와 패턴 분석", "주요 지지선과 저항선", "이동평균선(20·60·120일)", "거래량, RSI, MACD 등 지표 해석"],
    role: "너는 월가의 기술적 분석 전문가다.", prompt: "[기업명/티커]의 최신 주가 차트를 분석해줘. 주가 추세, 주요 지지선과 저항선, 이동평균선(20·60·120일), 거래량, RSI, MACD 등 핵심 지표를 기반으로 향후 상승/하락 시나리오와 주요 가격대를 제시해줘." },
  { id: "earn", no: "03", t: "실적 발표 분석", sub: "매출 · 영업이익 · EPS · 가이던스", icon: "📊", need: "stock",
    ck: ["매출·영업이익·EPS 예상치 비교", "사업 부문별 실적과 핵심 포인트", "향후 가이던스와 주가 영향", "컨퍼런스 콜에서 주목할 내용"],
    role: "너는 실적 분석 전문가다.", prompt: "[기업명/티커]의 최신 분기 실적을 분석해줘. 매출, 영업이익, EPS의 실제치와 시장 예상치를 비교하고, 사업 부문별 성과와 가이던스, 컨퍼런스 콜의 핵심 내용, 주가에 미칠 영향을 정리해줘." },
  { id: "fin", no: "04", t: "재무제표 분석", sub: "수익성 · 현금흐름 · 부채비율", icon: "🧾", need: "stock",
    ck: ["매출·영업이익·순이익 성장률", "ROE·ROIC 등 수익성 지표", "부채비율·유동비율 등 재무 안정성", "영업현금흐름과 잉여현금흐름(FCF)"],
    role: "너는 기업 재무 분석 전문가다.", prompt: "[기업명/티커]의 최근 3~5년 재무제표를 분석해줘. 매출, 영업이익, 순이익 성장률, ROE, ROIC, 부채비율, 유동비율, 영업현금흐름, 잉여현금흐름을 바탕으로 재무 건전성과 투자 매력도를 평가해줘." },
  { id: "pf", no: "05", t: "포트폴리오 분석", sub: "종목 비중 · 상관관계 · 리스크", icon: "💼", need: "pf",
    ck: ["보유 종목 및 비중 진단", "종목 간 상관관계 분석", "수익률과 변동성 평가", "리스크 요인과 비중 조정 제안"],
    role: "너는 글로벌 자산운용사의 포트폴리오 매니저다.", prompt: "내 포트폴리오(종목명, 투자금, 평균 매수가, 현재가, 현금 비중)를 분석해줘. 종목·섹터 비중, 상관관계, 수익률, 변동성, 주요 리스크를 평가하고, 분산투자 관점에서 비중 조정 방향을 제시해줘." },
  { id: "macro", no: "06", t: "매크로 분석", sub: "금리 · 물가 · 환율 · 경기 전망", icon: "🌐", need: "macro",
    ck: ["미국 기준금리와 Fed 정책", "물가·고용·GDP 등 핵심 지표", "달러·원달러 환율과 유동성 흐름", "미·중 갈등 등 지정학적 리스크"],
    role: "너는 글로벌 거시경제 전문가다.", prompt: "현재 글로벌 경제 상황이 주식시장에 미치는 영향을 분석해줘. 미국 기준금리와 Fed 정책, 물가·고용·GDP, 달러와 원달러 환율, 국채금리, 유동성, 미·중 갈등 등을 바탕으로 향후 6개월 낙관/기준/비관 시나리오와 수혜 업종을 제시해줘." }
];
function anMod() { return AN_MODS.filter(function (m) { return m.id === AN.mod; })[0]; }
function anEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s); }
function anPct(x, d) { return x == null || !isFinite(x) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function anNum(v, d) { return v == null || !isFinite(v) ? "-" : (+v).toLocaleString("ko-KR", { maximumFractionDigits: d == null ? 0 : d }); }
function anKrw(sym) { return /\.K[SQ]$/.test(sym) || sym === "^KS11"; }
function anPrice(sym, v) { return v == null ? "-" : anKrw(sym) ? Math.round(v).toLocaleString("ko-KR") + "원" : "$" + (+v).toFixed(2); }
function anName(s) { return typeof rpName === "function" ? rpName(s) : s; }
function anEok(v) { if (v == null || !isFinite(v)) return "-"; var a = Math.abs(v); if (a >= 1e12) return (v / 1e12).toFixed(1) + "조"; if (a >= 1e8) return Math.round(v / 1e8).toLocaleString("ko-KR") + "억"; if (a >= 1e6) return (v / 1e6).toFixed(1) + "M"; return anNum(v); }
/* 네이버 재무 요약 값 = 억원 단위(해외는 ÷100 → 억 달러, company.js 와 동일) */
function anFinMoney(sym, v) { if (v == null || !isFinite(v)) return "-"; if (!anKrw(sym)) v = v / 100; var sign = v < 0 ? "-" : "", a = Math.abs(v); var t = a >= 10000 ? (a / 10000).toFixed(1) + "조" : a >= 1 ? Math.round(a).toLocaleString("ko-KR") + "억" : a.toFixed(2) + "억"; return sign + t + (anKrw(sym) ? "원" : " USD"); }
/* 평가 한 줄: ok(✓) · mid(△) · bad(✗) · na(데이터 없음) */
function anCk(st, t, why) { return { st: st, t: t, why: why || "" }; }

/* ---------- 재무 표 읽기 (company.js findRow/kNum 재사용) ---------- */
function anFin(F, which) { return F && F.finance && F.finance[which] || null; }
function anRow(fin, names) { if (!fin) return null; for (var i = 0; i < names.length; i++) { var r = typeof findRow === "function" ? findRow(fin, names[i]) : null; if (r) return r; } return null; }
function anSeries(fin, names, opt) {   // → [{t:기간명, v:값, f:예상치?}] 확정→예상 순
  var r = anRow(fin, names); if (!r) return [];
  return fin.periods.map(function (p) { var v = typeof kNum === "function" ? kNum(r.values[p.key]) : parseFloat(r.values[p.key]); return v == null || isNaN(v) ? null : { t: p.title, v: v, f: !!p.forecast }; }).filter(Boolean);
}
function anLastConf(S) { var c = S.filter(function (x) { return !x.f; }); return c.length ? c[c.length - 1] : null; }
function anGrowth(S) { var c = S.filter(function (x) { return !x.f; }); if (c.length < 2) return null; var a = c[c.length - 2].v, b = c[c.length - 1].v; return a && a > 0 ? b / a - 1 : null; }
function anCagr(S, n) { var c = S.filter(function (x) { return !x.f; }); if (c.length < 2) return null; var k = Math.min(n, c.length - 1), a = c[c.length - 1 - k].v, b = c[c.length - 1].v; return a > 0 && b > 0 ? Math.pow(b / a, 1 / k) - 1 : null; }

/* ---------- 기술 지표 (차트) ---------- */
function anTech(rows) {
  var n = rows.length; if (n < 130) return null; var c = rows.map(function (r) { return r.c; }), v = rows.map(function (r) { return r.v || 0; });
  function ma(k) { return n >= k ? rpAvg(c.slice(-k)) : null; }
  function ema(arr, k) { var out = [], m = 2 / (k + 1), e = arr[0]; arr.forEach(function (x, i) { e = i ? x * m + e * (1 - m) : x; out.push(e); }); return out; }
  var e12 = ema(c, 12), e26 = ema(c, 26), macd = e12.map(function (x, i) { return x - e26[i]; }), sig = ema(macd.slice(-120), 9), hist = macd[n - 1] - sig[sig.length - 1], histPrev = macd[n - 2] - sig[sig.length - 2];
  var T = typeof rpTech === "function" ? rpTech(rows) : null; if (!T) return null;
  var w52 = rows.slice(-250), lo52 = Math.min.apply(null, w52.map(function (r) { return r.c; })), hi52 = Math.max.apply(null, w52.map(function (r) { return r.c; }));
  var w60 = rows.slice(-60), lo60 = Math.min.apply(null, w60.map(function (r) { return r.c; })), hi60 = Math.max.apply(null, w60.map(function (r) { return r.c; }));
  var vol20 = rpAvg(v.slice(-21, -1)), volX = vol20 ? v[n - 1] / vol20 : null;
  var slope20 = T.ma20 && n > 30 ? T.ma20 / rpAvg(c.slice(-30, -10)) - 1 : null;
  return Object.assign(T, { ma120: ma(120), macd: macd[n - 1], sig: sig[sig.length - 1], hist: hist, histPrev: histPrev, lo52: lo52, hi52: hi52, lo60: lo60, hi60: hi60, volX: volX, slope20: slope20, n: n });
}

/* ============================================================ 데이터 준비 ============================================================ */
function anNewsMap(L) { return (L || []).map(function (it) { return { t: typeof cNewsClean === "function" ? cNewsClean(it.title || "") : it.title, press: it.press || "", time: String(it.time || "").slice(0, 10), url: it.url || "", desc: typeof cNewsClean === "function" ? cNewsClean(it.desc || "") : it.desc || "" }; }).filter(function (x) { return x.t; }); }
function anPrepStock(sym) {
  var ps = [typeof rpLoad === "function" ? rpLoad([sym]) : Promise.resolve(), typeof rpFund === "function" ? rpFund(sym) : Promise.resolve(null)];
  if (typeof fetchNews === "function") { ps.push(fetchNews({ type: "raw", q: anName(sym) + " 실적", size: 10 }).catch(function () { return []; })); ps.push(Promise.all([fetchNews({ type: "raw", q: anName(sym) + " 우려 리스크 하향", size: 12 }).catch(function () { return []; }), fetchNews({ type: "raw", q: anName(sym) + " 상향 기대 호재", size: 12 }).catch(function () { return []; })]).then(function (a) { var seen = {}; return anNewsMap(a[0].concat(a[1])).filter(function (x) { var k = x.t.slice(0, 18); if (seen[k]) return false; seen[k] = 1; return true; }); })); }
  return Promise.all(ps).then(function (r) { return { rows: typeof rpRows === "function" ? rpRows(sym) : [], F: r[1], opp: r[3] || [], news: (r[2] || []).map(function (it) { return { t: typeof cNewsClean === "function" ? cNewsClean(it.title || "") : it.title, press: it.press || "", time: String(it.time || "").slice(0, 10), url: it.url || "", desc: typeof cNewsClean === "function" ? cNewsClean(it.desc || "") : it.desc || "" }; }).filter(function (x) { return x.t; }).slice(0, 6) }; });
}

/* ============================================================ 01 기업 분석 ============================================================ */
function anBiz(sym, D) {
  var F = D.F, info = F && F.info || {}, rows = D.rows, last = rows.length ? rows[rows.length - 1].c : null, name = anName(sym);
  var V = function (k) { return typeof rpV === "function" ? rpV(info, k) : null; };
  var mcap = V("marketValue") || V("marketCap"), per = V("per"), cper = V("cnsPer"), pbr = V("pbr"), roe = V("roe"), frn = V("foreignRate"), dy = V("dividendYieldRatio");
  var indPer = F && F.industry ? (typeof kNum === "function" ? kNum(F.industry.per != null ? F.industry.per : (F.industry.industryPer || null)) : null) : null;
  var tgt = F && F.consensus ? (rpV(F.consensus, "priceTargetMean") || rpV(F.consensus, "targetPrice")) : null, tgtR = tgt && last && tgt / last > 0.2 && tgt / last < 5 ? tgt / last - 1 : null;
  var finA = anFin(F, "annual"), rev = anSeries(finA, ["매출액", "매출", "Revenue"]), op = anSeries(finA, ["영업이익", "Operating Income"]), ni = anSeries(finA, ["당기순이익", "순이익", "Net Income"]), opm = anSeries(finA, ["영업이익률"]);
  var revG = anGrowth(rev), revC = anCagr(rev, 3), opG = anGrowth(op), fc = rev.filter(function (x) { return x.f; }), fcOp = op.filter(function (x) { return x.f; });
  var hi = rows.length ? Math.max.apply(null, rows.slice(-250).map(function (r) { return r.c; })) : null, dd = hi && last ? last / hi - 1 : null;
  var T = rows.length >= 130 ? anTech(rows) : null;
  var cur = anKrw(sym) ? "원" : "$";
  var rowsOut = [
    ["시가총액", mcap ? anEok(mcap) + (anKrw(sym) ? "원" : "$") : "-", ""],
    ["업종 (네이버 분류)", F && F.industry && (F.industry.industryName || F.industry.name) || "-", indPer ? "업종 PER " + indPer.toFixed(1) + "배" : ""],
    ["매출액 (최근 확정)", rev.length && anLastConf(rev) ? anFinMoney(sym, anLastConf(rev).v) : "-", anLastConf(rev) ? anLastConf(rev).t + " · 전년比 " + anPct(revG, 1) : ""],
    ["매출 3년 연평균 성장", anPct(revC, 1), ""],
    ["영업이익 (최근 확정)", op.length && anLastConf(op) ? anFinMoney(sym, anLastConf(op).v) : "-", anLastConf(op) ? "전년比 " + anPct(opG, 1) + (opm.length && anLastConf(opm) ? " · 이익률 " + anLastConf(opm).v.toFixed(1) + "%" : "") : ""],
    ["매출 전망 (컨센서스)", fc.length ? fc.map(function (x) { return x.t + " " + anFinMoney(sym, x.v); }).join(" · ") : "-", fc.length && anLastConf(rev) ? "최근 확정 대비 " + anPct(fc[fc.length - 1].v / anLastConf(rev).v - 1, 0) : ""],
    ["영업이익 전망", fcOp.length ? fcOp.map(function (x) { return x.t + " " + anFinMoney(sym, x.v); }).join(" · ") : "-", ""],
    ["PER (실적 / 예상)", (per ? per.toFixed(1) : "-") + " / " + (cper ? cper.toFixed(1) : "-") + "배", indPer && cper ? (cper < indPer ? "업종보다 낮음" : "업종보다 높음") : ""],
    ["PBR · ROE", (pbr ? pbr.toFixed(2) + "배" : "-") + " · " + (roe ? roe.toFixed(1) + "%" : "-"), ""],
    ["목표주가 평균 (컨센서스)", tgt ? anPrice(sym, tgt) : "-", tgtR != null ? "지금보다 " + anPct(tgtR, 0) : ""],
    ["52주 고점 대비", anPct(dd, 1), T ? "1년 변동성(일평균 " + (T.dayVol * 100).toFixed(1) + "%)" : ""],
    ["외국인 비율 · 배당수익률", (frn ? frn.toFixed(1) + "%" : "-") + " · " + (dy ? dy.toFixed(2) + "%" : "-"), ""]
  ];
  var C = [];
  C.push(rev.length ? anCk(opm.length && anLastConf(opm) && anLastConf(opm).v >= 15 ? "ok" : opm.length && anLastConf(opm) && anLastConf(opm).v >= 7 ? "mid" : opm.length ? "bad" : "mid", "핵심 사업모델과 수익원", (F && F.industry && (F.industry.industryName || F.industry.name) ? "업종 '" + (F.industry.industryName || F.industry.name) + "' · " : "") + "매출 " + anFinMoney(sym, anLastConf(rev).v) + (opm.length && anLastConf(opm) ? " · 영업이익률 " + anLastConf(opm).v.toFixed(1) + "% (" + (anLastConf(opm).v >= 15 ? "높은 편" : anLastConf(opm).v >= 7 ? "보통" : "낮은 편") + ")" : "") + " — 수익원 구성은 공시(사업보고서)에서 확인") : anCk("na", "핵심 사업모델과 수익원", "재무 요약 데이터 없음 — 프롬프트로 AI에 물어보기"));
  C.push(revC != null ? anCk(revC >= 0.1 && (opG == null || opG >= 0) ? "ok" : revC >= 0.03 ? "mid" : "bad", "경쟁력과 성장 동력", "매출 3년 연평균 " + anPct(revC, 1) + (opG != null ? " · 영업이익 전년比 " + anPct(opG, 1) : "") + (revC >= 0.1 ? " — 두 자릿수 성장" : revC >= 0.03 ? " — 완만한 성장" : " — 성장 정체")) : anCk("na", "경쟁력과 성장 동력", "연간 매출 추이 없음"));
  C.push(fc.length ? anCk(fc[fc.length - 1].v / anLastConf(rev).v - 1 >= 0.15 ? "ok" : fc[fc.length - 1].v / anLastConf(rev).v - 1 >= 0 ? "mid" : "bad", "3~5년 실적 전망", "컨센서스 매출 " + fc.map(function (x) { return x.t + " " + anFinMoney(sym, x.v); }).join(" → ") + " (확정 대비 " + anPct(fc[fc.length - 1].v / anLastConf(rev).v - 1, 0) + ")" + (fcOp.length ? " · 영업이익 " + anFinMoney(sym, fcOp[fcOp.length - 1].v) : "")) : anCk("na", "3~5년 실적 전망", "컨센서스 전망치 없음 (국내 대형주 위주로 제공)"));
  var valSt = cper && indPer ? (cper < indPer * 0.8 ? "ok" : cper <= indPer * 1.2 ? "mid" : "bad") : cper ? (cper < 12 ? "ok" : cper < 25 ? "mid" : "bad") : "na";
  C.push(anCk(valSt, "적정 가치와 주요 리스크", valSt === "na" ? "PER 데이터 없음" : "예상 PER " + cper.toFixed(1) + "배" + (indPer ? " vs 업종 " + indPer.toFixed(1) + "배" : "") + (tgtR != null ? " · 목표주가 괴리 " + anPct(tgtR, 0) : "") + " · 고점 대비 " + anPct(dd, 0) + (T ? " · 일변동 " + (T.dayVol * 100).toFixed(1) + "%" : "") + " — 리스크는 '예상 이익이 지켜지느냐'"));
  var sum = [];
  sum.push(nbJosa(name, "은/는") + " " + (mcap ? "시가총액 " + anEok(mcap) + (anKrw(sym) ? "원" : "$") + "의 " : "") + (F && F.industry && (F.industry.industryName || F.industry.name) ? (F.industry.industryName || F.industry.name) + " 업종 기업으로, " : "") + (rev.length && anLastConf(rev) ? "최근 확정 매출 " + anFinMoney(sym, anLastConf(rev).v) + "(전년比 " + anPct(revG, 1) + ")" : "매출 데이터가 없") + (opm.length && anLastConf(opm) ? ", 영업이익률 " + anLastConf(opm).v.toFixed(1) + "%" : "") + "입니다.");
  if (revC != null) sum.push("성장성은 3년 연평균 매출 " + anPct(revC, 1) + "로 " + (revC >= 0.1 ? "두 자릿수 — 성장주로 분류할 만합니다." : revC >= 0.03 ? "완만한 편 — 이익률과 주주환원이 더 중요한 구간입니다." : "정체 — 밸류에이션이 낮아야 매력이 생깁니다."));
  if (fc.length) sum.push("시장은 매출이 " + fc[fc.length - 1].t + "에 " + anFinMoney(sym, fc[fc.length - 1].v) + "(확정 대비 " + anPct(fc[fc.length - 1].v / anLastConf(rev).v - 1, 0) + ")까지 갈 것으로 봅니다. 이 전망이 지켜지는지가 주가의 핵심 변수입니다.");
  if (cper) sum.push("가치 평가: 예상 PER " + cper.toFixed(1) + "배" + (indPer ? "는 업종 평균 " + indPer.toFixed(1) + "배보다 " + (cper < indPer ? "낮아 상대적으로 싼 편" : "높아 프리미엄이 붙은 상태") : "") + (tgtR != null ? ". 증권사 목표주가 평균은 지금보다 " + anPct(tgtR, 0) + "입니다" : "") + ".");
  sum.push("주요 리스크: " + (dd != null && dd <= -0.2 ? "52주 고점 대비 " + anPct(dd, 0) + "로 이미 조정이 깊고, " : "") + "실적 전망 하향, 업종 경기, " + (anKrw(sym) ? "외국인 수급(현재 " + (frn ? frn.toFixed(1) + "%" : "-") + ")" : "달러·금리 환경") + ". 사업 부문별 수익원과 경쟁 구도는 아래 프롬프트로 AI·공시에서 보완하세요.");
  return { rows: rowsOut, ck: C, sum: sum, src: "네이버 증권 재무 요약·컨센서스 · 야후 파이낸스 종가 · " + cDate(Date.now()), news: D.news };
}

/* ============================================================ 02 차트 분석 ============================================================ */
function anChart(sym, D) {
  var rows = D.rows, T = anTech(rows), name = anName(sym); if (!T) return { rows: [], ck: [anCk("na", "주가 추세와 패턴 분석", "일봉 130일 이상 필요")], sum: ["차트 데이터가 부족해요."], src: "" };
  var last = T.last, P = function (v) { return anPrice(sym, v); }, above = [T.ma20, T.ma60, T.ma120].map(function (m) { return m != null && last > m; });
  var trend = above[0] && above[1] && above[2] && T.ma20 > T.ma60 ? "상승 추세 (정배열)" : !above[0] && !above[1] && !above[2] && T.ma20 < T.ma60 ? "하락 추세 (역배열)" : "횡보·전환 구간 (이평선 엉킴)";
  var sup = [T.lo60, T.bLo, T.ma60, T.ma120, T.lo52].filter(function (v) { return v != null && v < last; }).sort(function (a, b) { return b - a; }), res = [T.hi60, T.bHi, T.ma20, T.ma60, T.ma120, T.hi52].filter(function (v) { return v != null && v > last; }).sort(function (a, b) { return a - b; });
  var sup1 = sup[0], sup2 = sup[1], res1 = res[0], res2 = res[1];
  var rsiT = T.rsi >= 70 ? "과열" : T.rsi <= 30 ? "과매도" : T.rsi >= 55 ? "강세권" : T.rsi <= 45 ? "약세권" : "중립";
  var macdT = T.hist > 0 && T.histPrev <= 0 ? "골든크로스 직후" : T.hist < 0 && T.histPrev >= 0 ? "데드크로스 직후" : T.hist > 0 ? "상승 신호 유지" : "하락 신호 유지";
  var rowsOut = [
    ["현재가 · 1일 · 20일 · 60일", P(last), anPct(T.chg1, 1) + " · " + anPct(T.chg20, 1) + " · " + anPct(T.chg60, 1)],
    ["추세 판정", trend, "20일선 기울기 " + anPct(T.slope20, 1)],
    ["20 · 60 · 120일 이동평균", P(T.ma20) + " · " + P(T.ma60) + " · " + (T.ma120 ? P(T.ma120) : "-"), "현재가 위치: " + above.map(function (a, i) { return ["20", "60", "120"][i] + (a ? "↑" : "↓"); }).join(" ")],
    ["지지선 1 · 2", (sup1 ? P(sup1) : "-") + " · " + (sup2 ? P(sup2) : "-"), sup1 ? "지금보다 " + anPct(sup1 / last - 1, 1) : ""],
    ["저항선 1 · 2", (res1 ? P(res1) : "-") + " · " + (res2 ? P(res2) : "-"), res1 ? "지금보다 " + anPct(res1 / last - 1, 1) : ""],
    ["52주 범위", P(T.lo52) + " ~ " + P(T.hi52), "범위 안 위치 " + Math.round((last - T.lo52) / Math.max(1e-9, T.hi52 - T.lo52) * 100) + "%"],
    ["볼린저 밴드(20,2)", P(T.bLo) + " ~ " + P(T.bHi), "밴드 안 위치 " + (T.bPos != null ? Math.round(T.bPos * 100) + "%" : "-")],
    ["RSI(14)", T.rsi.toFixed(0), rsiT],
    ["MACD(12,26,9)", (T.macd >= 0 ? "+" : "") + T.macd.toFixed(2) + " / 시그널 " + T.sig.toFixed(2), macdT],
    ["거래량 (오늘 / 20일 평균)", T.volX ? T.volX.toFixed(1) + "배" : "-", T.volX >= 2 ? "급증" : T.volX >= 1.2 ? "평소보다 많음" : T.volX ? "평소 수준" : "거래량 데이터 없음"]
  ];
  var C = [
    anCk(trend.indexOf("상승") === 0 ? "ok" : trend.indexOf("하락") === 0 ? "bad" : "mid", "주가 추세와 패턴 분석", trend + " · 20일 " + anPct(T.chg20, 1) + " · 60일 " + anPct(T.chg60, 1)),
    anCk(sup1 && last / sup1 - 1 <= 0.05 ? "ok" : res1 && res1 / last - 1 <= 0.03 ? "mid" : "mid", "주요 지지선과 저항선", "지지 " + (sup1 ? P(sup1) + "(" + anPct(sup1 / last - 1, 1) + ")" : "-") + " · 저항 " + (res1 ? P(res1) + "(" + anPct(res1 / last - 1, 1) + ")" : "-") + (sup1 && last / sup1 - 1 <= 0.05 ? " — 지지선 바로 위, 손절 기준 잡기 좋은 자리" : res1 && res1 / last - 1 <= 0.03 ? " — 저항 직전, 돌파 확인 필요" : "")),
    anCk(above.filter(Boolean).length === 3 ? "ok" : above.filter(Boolean).length === 0 ? "bad" : "mid", "이동평균선(20·60·120일)", "현재가가 " + above.filter(Boolean).length + "/3 이평선 위 · " + (T.ma20 > T.ma60 ? "20>60 (단기 우위)" : "20<60 (단기 열위)")),
    anCk(T.rsi > 70 ? "bad" : T.rsi >= 45 && T.rsi <= 70 && T.hist > 0 ? "ok" : "mid", "거래량, RSI, MACD 등 지표 해석", "RSI " + T.rsi.toFixed(0) + "(" + rsiT + ") · MACD " + macdT + " · 거래량 " + (T.volX ? T.volX.toFixed(1) + "배" : "-"))
  ];
  var sum = [];
  sum.push(name + " 주가는 " + nbJosa(P(last), "으로/로") + " " + trend + "입니다. 20·60·120일선 중 " + above.filter(Boolean).length + "개 위에 있고, 20일선 기울기는 " + anPct(T.slope20, 1) + "입니다.");
  sum.push("가격대: 1차 지지 " + (sup1 ? P(sup1) : "-") + ", 2차 " + (sup2 ? P(sup2) : "-") + " / 1차 저항 " + (res1 ? P(res1) : "-") + ", 2차 " + (res2 ? P(res2) : "-") + ". 52주 범위 안에서는 " + Math.round((last - T.lo52) / Math.max(1e-9, T.hi52 - T.lo52) * 100) + "% 위치입니다.");
  sum.push("지표: RSI " + T.rsi.toFixed(0) + "(" + rsiT + "), MACD " + macdT + ", 거래량은 20일 평균의 " + (T.volX ? T.volX.toFixed(1) + "배" : "-") + ". " + (T.volX >= 1.5 ? "거래가 실린 움직임이라 신뢰도가 높습니다." : "거래가 얇아 방향 확정은 이릅니다."));
  sum.push("상승 시나리오: " + (res1 ? P(res1) + " 돌파·안착 시 " + (res2 ? P(res2) : "52주 고점 " + P(T.hi52)) + "까지 열립니다." : "52주 고점 " + P(T.hi52) + " 재도전.") + " 하락 시나리오: " + (sup1 ? P(sup1) + " 이탈 시 " + (sup2 ? P(sup2) : "52주 저점 " + P(T.lo52)) + "까지 봐야 합니다." : "52주 저점 " + P(T.lo52) + " 확인.") + " 기술적 분석은 확률이지 예언이 아니니, 손절선을 먼저 정하세요.");
  return { rows: rowsOut, ck: C, sum: sum, src: "야후 파이낸스 일봉 " + T.n + "일 · StockMind 계산 · " + cDate(Date.now()) };
}

/* ============================================================ 03 실적 발표 분석 ============================================================ */
function anEarn(sym, D) {
  var F = D.F, name = anName(sym), finQ = anFin(F, "quarter"), finA = anFin(F, "annual"), cur = anKrw(sym) ? "원" : "$";
  var rev = anSeries(finQ, ["매출액", "매출", "Revenue"]), op = anSeries(finQ, ["영업이익", "Operating Income"]), ni = anSeries(finQ, ["당기순이익", "순이익", "Net Income"]), eps = anSeries(finQ, ["EPS"]);
  function yoy(S) { var c = S.filter(function (x) { return !x.f; }); if (c.length < 5) return null; var a = c[c.length - 5].v, b = c[c.length - 1].v; return a > 0 ? b / a - 1 : null; }
  function qoq(S) { var c = S.filter(function (x) { return !x.f; }); if (c.length < 2) return null; var a = c[c.length - 2].v, b = c[c.length - 1].v; return a > 0 ? b / a - 1 : null; }
  var L = anLastConf(rev), nextF = rev.filter(function (x) { return x.f; })[0], nextOp = op.filter(function (x) { return x.f; })[0], nextEps = eps.filter(function (x) { return x.f; })[0];
  var opm = L && anLastConf(op) ? anLastConf(op).v / L.v : null, opmPrev = (function () { var c = rev.filter(function (x) { return !x.f; }), o = op.filter(function (x) { return !x.f; }); return c.length >= 5 && o.length >= 5 ? o[o.length - 5].v / c[c.length - 5].v : null; })();
  var rowsOut = L ? [
    ["최근 확정 분기", L.t, ""],
    ["매출액", anFinMoney(sym, L.v), "전년 동기比 " + anPct(yoy(rev), 1) + " · 전분기比 " + anPct(qoq(rev), 1)],
    ["영업이익", anLastConf(op) ? anFinMoney(sym, anLastConf(op).v) : "-", "전년 동기比 " + anPct(yoy(op), 1) + (opm != null ? " · 이익률 " + (opm * 100).toFixed(1) + "%" + (opmPrev != null ? " (1년 전 " + (opmPrev * 100).toFixed(1) + "%)" : "") : "")],
    ["당기순이익", anLastConf(ni) ? anFinMoney(sym, anLastConf(ni).v) : "-", "전년 동기比 " + anPct(yoy(ni), 1)],
    ["EPS", anLastConf(eps) ? anNum(anLastConf(eps).v, 2) + cur : "-", "전년 동기比 " + anPct(yoy(eps), 1)],
    ["다음 분기 컨센서스", nextF ? nextF.t + " 매출 " + anFinMoney(sym, nextF.v) + " · 영업이익 " + (nextOp ? anFinMoney(sym, nextOp.v) : "-") + " · EPS " + (nextEps ? anNum(nextEps.v, 2) : "-") : "-", nextF && L ? "최근 분기 대비 매출 " + anPct(nextF.v / L.v - 1, 0) : ""]
  ] : [["분기 실적", "데이터 없음", "네이버 증권 분기 재무가 없는 종목"]];
  D.news.forEach(function (x, i) { if (i < 4) rowsOut.push(["관련 기사 " + (i + 1), x.t, x.press + (x.time ? " · " + x.time : "")]); });
  var C = [
    L ? anCk((yoy(rev) != null ? yoy(rev) : qoq(rev)) >= 0.1 && (yoy(op) != null ? yoy(op) : qoq(op)) >= 0.1 ? "ok" : (yoy(rev) != null ? yoy(rev) : qoq(rev)) >= 0 ? "mid" : "bad", "매출·영업이익·EPS 예상치 비교", (yoy(rev) != null ? "매출 YoY " + anPct(yoy(rev), 1) + " · 영업이익 YoY " + anPct(yoy(op), 1) + " · EPS YoY " + anPct(yoy(eps), 1) : "매출 QoQ " + anPct(qoq(rev), 1) + " · 영업이익 QoQ " + anPct(qoq(op), 1) + " (전년 동기 자료 없음)") + " — 발표 당시 예상치와의 비교는 기사·AI로 확인") : anCk("na", "매출·영업이익·EPS 예상치 비교", "분기 실적 데이터 없음"),
    anCk("na", "사업 부문별 실적과 핵심 포인트", "부문별 데이터는 앱에 없음 — 프롬프트로 AI·IR 자료에서 확인" + (D.news.length ? " · 관련 기사 " + D.news.length + "건 수집" : "")),
    nextF && L ? anCk(nextF.v / L.v - 1 >= 0.05 ? "ok" : nextF.v / L.v - 1 >= -0.05 ? "mid" : "bad", "향후 가이던스와 주가 영향", "다음 분기 컨센서스 매출 " + anFinMoney(sym, nextF.v) + "(최근 대비 " + anPct(nextF.v / L.v - 1, 0) + ")" + (nextOp && anLastConf(op) ? " · 영업이익 " + anFinMoney(sym, nextOp.v) + "(" + anPct(nextOp.v / anLastConf(op).v - 1, 0) + ")" : "") + " — 회사 가이던스는 컨퍼런스 콜 참고") : anCk("na", "향후 가이던스와 주가 영향", "다음 분기 컨센서스 없음"),
    anCk(opm != null && opmPrev != null ? (opm >= opmPrev ? "ok" : opm >= opmPrev - 0.03 ? "mid" : "bad") : "na", "컨퍼런스 콜에서 주목할 내용", opm != null && opmPrev != null ? "이익률 " + (opmPrev * 100).toFixed(1) + "% → " + (opm * 100).toFixed(1) + "% (" + (opm >= opmPrev ? "개선" : "악화") + ") — 콜에서는 '이익률 방향·수요·재고·가이던스'를 들으세요" : "콜 요약은 AI·기사로 확인")
  ];
  var sum = [];
  if (L) {
    sum.push(name + "의 최근 확정 분기(" + L.t + ") 매출은 " + nbJosa(anFinMoney(sym, L.v), "으로/로") + " " + (yoy(rev) != null ? "전년 동기 대비 " + anPct(yoy(rev), 1) : "전분기 대비 " + anPct(qoq(rev), 1)) + (anLastConf(op) ? ", 영업이익은 " + anFinMoney(sym, anLastConf(op).v) + "(" + anPct(yoy(op), 1) + ")" : "") + (anLastConf(eps) ? ", EPS " + anNum(anLastConf(eps).v, 2) + cur + "(" + anPct(yoy(eps), 1) + ")" : "") + "입니다.");
    if (opm != null && opmPrev != null) sum.push("영업이익률은 1년 전 " + (opmPrev * 100).toFixed(1) + "%에서 " + (opm * 100).toFixed(1) + "%로 " + (opm >= opmPrev ? "좋아졌습니다 — 매출보다 이익이 빨리 느는 구간은 주가에 가장 좋은 조합입니다." : "나빠졌습니다 — 매출이 늘어도 이익률이 꺾이면 시장은 비용·경쟁을 의심합니다."));
    if (nextF) sum.push("다음 분기(" + nextF.t + ") 시장 예상 매출은 " + nbJosa(anFinMoney(sym, nextF.v), "으로/로") + " 최근 분기 대비 " + anPct(nextF.v / L.v - 1, 0) + "입니다. 실제 발표가 이 숫자를 넘기느냐, 그리고 회사 가이던스가 이보다 높으냐가 발표일 주가를 좌우합니다.");
  } else sum.push(name + "은(는) 분기 재무 데이터가 앱에 없습니다. 아래 프롬프트를 복사해 AI에 최신 실적을 물어보세요.");
  if (D.news.length) sum.push("최근 기사: " + D.news.slice(0, 2).map(function (x) { return "'" + x.t + "'(" + x.press + ")"; }).join(", ") + ". 사업 부문별 성과와 컨퍼런스 콜 내용은 앱 데이터에 없으므로 기사·IR에서 보완하세요.");
  return { rows: rowsOut, ck: C, sum: sum, src: "네이버 증권 분기 재무 · 네이버 뉴스 검색 · " + cDate(Date.now()), news: D.news };
}

/* ============================================================ 04 재무제표 분석 ============================================================ */
function anFinancial(sym, D) {
  var F = D.F, name = anName(sym), finA = anFin(F, "annual"), cur = anKrw(sym) ? "원" : "$";
  var rev = anSeries(finA, ["매출액", "매출", "Revenue"]), op = anSeries(finA, ["영업이익", "Operating Income"]), ni = anSeries(finA, ["당기순이익", "순이익", "Net Income"]), roe = anSeries(finA, ["ROE"]), roa = anSeries(finA, ["ROA"]), debt = anSeries(finA, ["부채비율"]), curR = anSeries(finA, ["유동비율"]), ocf = anSeries(finA, ["영업활동현금흐름", "영업현금흐름", "Operating Cash Flow"]), fcf = anSeries(finA, ["잉여현금흐름", "FCF", "Free Cash Flow"]), capex = anSeries(finA, ["CAPEX", "자본적지출"]), ebitda = anSeries(finA, ["EBITDA"]);
  var conf = function (S) { return S.filter(function (x) { return !x.f; }); };
  var yrs = conf(rev).slice(-5).map(function (x) { return x.t; });
  function line(label, S, fmt) { var c = conf(S).slice(-5); return c.length ? [label, c.map(function (x) { return x.t.replace(/\.\d+$/, "") + " " + fmt(x.v); }).join(" · "), ""] : [label, "데이터 없음", ""]; }
  var M = function (v) { return anFinMoney(sym, v); };
  var rowsOut = [line("매출액", rev, M), line("영업이익", op, M), line("당기순이익", ni, M), line("ROE", roe, function (v) { return v.toFixed(1) + "%"; }), line("ROA", roa, function (v) { return v.toFixed(1) + "%"; }), line("부채비율", debt, function (v) { return v.toFixed(0) + "%"; }), line("유동비율", curR, function (v) { return v.toFixed(0) + "%"; }), line("영업활동현금흐름", ocf, M), line("잉여현금흐름(FCF)", fcf, M)];
  var rC = anCagr(rev, 3), oC = anCagr(op, 3), nC = anCagr(ni, 3), roeL = anLastConf(roe), roaL = anLastConf(roa), dL = anLastConf(debt), cL = anLastConf(curR), ocfL = anLastConf(ocf), fcfL = anLastConf(fcf), niL = anLastConf(ni);
  var fcfCalc = !fcfL && ocfL && anLastConf(capex) ? ocfL.v - Math.abs(anLastConf(capex).v) : null;
  var C = [
    rC != null ? anCk(rC >= 0.1 && nC >= 0.1 ? "ok" : rC >= 0.03 ? "mid" : "bad", "매출·영업이익·순이익 성장률", "3년 연평균 매출 " + anPct(rC, 1) + " · 영업이익 " + anPct(oC, 1) + " · 순이익 " + anPct(nC, 1) + (oC != null && rC != null ? (oC > rC ? " — 이익이 매출보다 빨리 늘어 레버리지 효과" : " — 이익 증가가 매출에 못 미침") : "")) : anCk("na", "매출·영업이익·순이익 성장률", "연간 재무 데이터 없음"),
    roeL ? anCk(roeL.v >= 15 ? "ok" : roeL.v >= 8 ? "mid" : "bad", "ROE·ROIC 등 수익성 지표", "ROE " + roeL.v.toFixed(1) + "%(" + roeL.t + ")" + (roaL ? " · ROA " + roaL.v.toFixed(1) + "%" : "") + (roeL.v >= 15 ? " — 우량 기준(15%) 이상" : roeL.v >= 8 ? " — 보통" : " — 자본 효율 낮음") + " · ROIC는 앱에 없음") : anCk("na", "ROE·ROIC 등 수익성 지표", "ROE 데이터 없음"),
    dL ? anCk(dL.v <= 100 && (!cL || cL.v >= 100) ? "ok" : dL.v <= 200 ? "mid" : "bad", "부채비율·유동비율 등 재무 안정성", "부채비율 " + dL.v.toFixed(0) + "%" + (cL ? " · 유동비율 " + cL.v.toFixed(0) + "%" : "") + (dL.v <= 100 ? " — 안정적" : dL.v <= 200 ? " — 보통 (업종 특성 확인)" : " — 높음, 금리 상승기 부담")) : anCk("na", "부채비율·유동비율 등 재무 안정성", "부채비율 데이터 없음 (해외 종목은 미제공이 많음)"),
    ocfL || fcfL ? anCk((fcfL ? fcfL.v : fcfCalc != null ? fcfCalc : ocfL.v) > 0 && (!niL || !ocfL || ocfL.v >= niL.v * 0.8) ? "ok" : (fcfL ? fcfL.v : ocfL.v) > 0 ? "mid" : "bad", "영업현금흐름과 잉여현금흐름(FCF)", (ocfL ? "영업현금흐름 " + M(ocfL.v) : "") + (fcfL ? " · FCF " + M(fcfL.v) : fcfCalc != null ? " · FCF(계산) " + M(fcfCalc) : "") + (niL && ocfL ? " · 순이익 대비 " + Math.round(ocfL.v / niL.v * 100) + "%" + (ocfL.v >= niL.v * 0.8 ? " (이익의 질 양호)" : " (이익보다 현금이 적음 — 매출채권·재고 확인)") : "")) : anCk("na", "영업현금흐름과 잉여현금흐름(FCF)", "현금흐름 데이터 없음 — 프롬프트로 확인")
  ];
  var sum = [];
  sum.push(name + "의 최근 " + Math.min(5, conf(rev).length) + "개년 재무: " + (rC != null ? "매출은 연평균 " + anPct(rC, 1) + ", 영업이익 " + anPct(oC, 1) + ", 순이익 " + anPct(nC, 1) + "로 " + (oC > rC ? "이익이 매출보다 빠르게 늘었습니다." : "이익 성장이 매출을 따라가지 못했습니다.") : "연간 추이 데이터가 없습니다."));
  if (roeL) sum.push("수익성: ROE " + roeL.v.toFixed(1) + "%는 " + (roeL.v >= 15 ? "자기자본을 효율적으로 쓰는 우량 수준입니다." : roeL.v >= 8 ? "평범한 수준으로, 이익률 개선 여부를 봐야 합니다." : "낮은 편이라 PBR이 1배 아래여도 '싸다'고 단정하기 어렵습니다."));
  if (dL) sum.push("안정성: 부채비율 " + dL.v.toFixed(0) + "%" + (cL ? ", 유동비율 " + cL.v.toFixed(0) + "%" : "") + "로 " + (dL.v <= 100 ? "재무 부담이 작습니다." : dL.v <= 200 ? "업종 평균과 비교가 필요합니다(금융·건설·항공은 원래 높음)." : "부채가 많아 금리와 업황에 민감합니다."));
  if (ocfL) sum.push("현금흐름: 영업현금흐름 " + nbJosa(M(ocfL.v), "은/는") + (niL ? " 순이익의 " + Math.round(ocfL.v / niL.v * 100) + "%" : "") + (fcfL ? ", FCF " + M(fcfL.v) : fcfCalc != null ? ", FCF(영업CF−CAPEX) " + M(fcfCalc) : "") + ". " + ((fcfL ? fcfL.v : fcfCalc != null ? fcfCalc : ocfL.v) > 0 ? "남는 현금이 있어 배당·자사주·투자 여력이 있습니다." : "현금이 남지 않아 외부 자금 조달 가능성을 봐야 합니다."));
  sum.push("투자 매력도는 '성장 × 수익성 × 안정성 × 현금'이 모두 ✓일 때 가장 높고, 하나가 ✗면 그 이유가 일시적인지 구조적인지를 프롬프트로 확인하세요.");
  return { rows: rowsOut, ck: C, sum: sum, src: "네이버 증권 연간 재무(" + (yrs.length ? yrs[0] + "~" + yrs[yrs.length - 1] : "-") + ") · " + cDate(Date.now()) };
}

/* ============================================================ 05 포트폴리오 분석 ============================================================ */
function anPfData() {
  var H = typeof loadHoldings === "function" ? loadHoldings() : { lots: [] }, g = {}; (H.lots || []).forEach(function (L) { (g[L.s] = g[L.s] || []).push(L); });
  var syms = Object.keys(g); if (!syms.length) return Promise.resolve(null);
  var fx = (typeof nbStat === "function" && nbStat("KRW=X") || {}).last || 1400;
  return rpLoad(syms).then(function () {
    var items = syms.map(function (s) { var rows = rpRows(s), last = rows.length ? rows[rows.length - 1].c : null; if (last != null && !(last > 0)) last = null; q = 0, cost = 0; g[s].forEach(function (L) { q += L.q; cost += L.q * L.p * (L.fx || (anKrw(s) ? 1 : fx)); }); var k = anKrw(s) ? 1 : fx, val = last != null ? last * q * k : cost; return { s: s, name: anName(s), q: q, cost: cost, val: val, last: last, ret: cost ? val / cost - 1 : null, rows: rows, kr: anKrw(s) }; }).filter(function (x) { return x.q > 0; });
    var tot = items.reduce(function (a, x) { return a + x.val; }, 0); items.forEach(function (x) { x.w = tot ? x.val / tot : 0; });
    items.sort(function (a, b) { return b.w - a.w; });
    return { items: items, tot: tot, fx: fx };
  });
}
function anDailyRets(rows, n) { var r = rows.slice(-(n + 1)), out = {}; for (var i = 1; i < r.length; i++) out[Math.floor(r[i].t / 86400e3)] = r[i].c / r[i - 1].c - 1; return out; }
function anCorr(a, b) { var ks = Object.keys(a).filter(function (k) { return b[k] != null; }); if (ks.length < 60) return null; var xa = ks.map(function (k) { return a[k]; }), xb = ks.map(function (k) { return b[k]; }), ma = rpAvg(xa), mb = rpAvg(xb), sab = 0, sa = 0, sb = 0; ks.forEach(function (k, i) { sab += (xa[i] - ma) * (xb[i] - mb); sa += (xa[i] - ma) * (xa[i] - ma); sb += (xb[i] - mb) * (xb[i] - mb); }); return sa && sb ? sab / Math.sqrt(sa * sb) : null; }
function anPf(P) {
  var I = P.items, n = I.length, top = I[0], hhi = I.reduce(function (a, x) { return a + x.w * x.w; }, 0), effN = hhi ? 1 / hhi : 0, krW = I.filter(function (x) { return x.kr; }).reduce(function (a, x) { return a + x.w; }, 0);
  var rets = {}; I.forEach(function (x) { rets[x.s] = anDailyRets(x.rows, 250); });
  var pairs = [], cs = []; for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) { var c = anCorr(rets[I[i].s], rets[I[j].s]); if (c != null) { pairs.push({ a: I[i].name, b: I[j].name, c: c }); cs.push(c); } }
  pairs.sort(function (a, b) { return b.c - a.c; }); var avgC = cs.length ? rpAvg(cs) : null;
  var vols = I.map(function (x) { var r = Object.keys(rets[x.s]).map(function (k) { return rets[x.s][k]; }); if (r.length < 60) return null; var m = rpAvg(r); return Math.sqrt(rpAvg(r.map(function (v) { return (v - m) * (v - m); }))) * Math.sqrt(252); });
  var pfVol = (function () { var days = {}; I.forEach(function (x) { Object.keys(rets[x.s]).forEach(function (k) { days[k] = (days[k] || 0) + rets[x.s][k] * x.w; }); }); var r = Object.keys(days).map(function (k) { return days[k]; }); if (r.length < 60) return null; var m = rpAvg(r); return Math.sqrt(rpAvg(r.map(function (v) { return (v - m) * (v - m); }))) * Math.sqrt(252); })();
  var totRet = P.tot && I.reduce(function (a, x) { return a + x.cost; }, 0) ? P.tot / I.reduce(function (a, x) { return a + x.cost; }, 0) - 1 : null;
  var rowsOut = [["평가액 합계 (원화 환산)", Math.round(P.tot).toLocaleString("ko-KR") + "원", "종목 " + n + "개 · 전체 수익률 " + anPct(totRet, 1) + " · 환율 " + Math.round(P.fx) + "원 적용"]];
  I.forEach(function (x, i) { rowsOut.push([(i + 1) + ". " + x.name, Math.round(x.w * 100) + "% · " + anPct(x.ret, 1), x.q + "주 · 현재 " + anPrice(x.s, x.last) + (vols[i] != null ? " · 연변동성 " + Math.round(vols[i] * 100) + "%" : "")]); });
  rowsOut.push(["집중도", "1위 " + Math.round(top.w * 100) + "% · 실질 종목 수 " + effN.toFixed(1) + "개", "국내 " + Math.round(krW * 100) + "% · 해외 " + Math.round((1 - krW) * 100) + "%"]);
  rowsOut.push(["상관관계 (1년 일간)", avgC != null ? "평균 " + avgC.toFixed(2) : "-", pairs.length ? "가장 비슷: " + pairs[0].a + "·" + pairs[0].b + " " + pairs[0].c.toFixed(2) + " / 가장 다름: " + pairs[pairs.length - 1].a + "·" + pairs[pairs.length - 1].b + " " + pairs[pairs.length - 1].c.toFixed(2) : ""]);
  rowsOut.push(["포트폴리오 연변동성", pfVol != null ? Math.round(pfVol * 100) + "%" : "-", pfVol != null ? "하루 ±" + (pfVol / Math.sqrt(252) * 100).toFixed(1) + "% · 1년에 한 번쯤 " + anPct(-pfVol * 1.65, 0) + " 겪을 수 있음" : ""]);
  var C = [
    anCk(top.w <= 0.3 && effN >= 4 ? "ok" : top.w <= 0.5 ? "mid" : "bad", "보유 종목 및 비중 진단", "1위 " + top.name + " " + Math.round(top.w * 100) + "% · 실질 종목 수 " + effN.toFixed(1) + "개" + (top.w > 0.5 ? " — 한 종목이 절반 이상, 사실상 몰빵" : top.w > 0.3 ? " — 1위 비중이 큰 편" : " — 고르게 분산")),
    avgC != null ? anCk(avgC <= 0.4 ? "ok" : avgC <= 0.65 ? "mid" : "bad", "종목 간 상관관계 분석", "평균 상관계수 " + avgC.toFixed(2) + (avgC > 0.65 ? " — 같이 움직여 분산 효과가 작음" : avgC > 0.4 ? " — 보통" : " — 서로 다르게 움직여 분산이 잘 됨") + (pairs.length ? " · 최고 " + pairs[0].a + "·" + pairs[0].b + " " + pairs[0].c.toFixed(2) : "")) : anCk("na", "종목 간 상관관계 분석", "1년 일봉이 있는 종목이 2개 이상 필요"),
    pfVol != null ? anCk(pfVol <= 0.2 ? "ok" : pfVol <= 0.35 ? "mid" : "bad", "수익률과 변동성 평가", "전체 수익률 " + anPct(totRet, 1) + " · 연변동성 " + Math.round(pfVol * 100) + "%" + (pfVol > 0.35 ? " — 코스피(약 20%)보다 훨씬 출렁임" : pfVol > 0.2 ? " — 지수보다 다소 큼" : " — 지수 수준")) : anCk("na", "수익률과 변동성 평가", "일봉 데이터 부족"),
    anCk(top.w > 0.4 || (avgC != null && avgC > 0.65) || krW === 0 || krW === 1 ? "mid" : "ok", "리스크 요인과 비중 조정 제안", (top.w > 0.4 ? top.name + " 비중을 30% 아래로 줄이는 것부터. " : "") + (avgC != null && avgC > 0.65 ? "비슷하게 움직이는 종목이 많아 채권·금·다른 업종을 섞으면 변동이 줄어요. " : "") + (krW === 1 ? "국내 100% — 환율·해외 분산 고려. " : krW === 0 ? "해외 100% — 환율 변동이 수익률에 그대로 반영. " : "") + "현금 비중은 앱에 없어 프롬프트에서 직접 적어 주세요.")
  ];
  var sum = [];
  sum.push("보유 종목 " + n + "개, 평가액 " + Math.round(P.tot / 1e4).toLocaleString("ko-KR") + "만원(전체 " + anPct(totRet, 1) + "). 1위 " + top.name + " " + Math.round(top.w * 100) + "%, 실질 종목 수는 " + effN.toFixed(1) + "개로 " + (effN >= 5 ? "분산이 되어 있습니다." : effN >= 3 ? "분산이 약한 편입니다." : "사실상 한두 종목에 좌우됩니다."));
  if (avgC != null) sum.push("종목들은 평균 상관계수 " + avgC.toFixed(2) + "로 " + (avgC > 0.65 ? "거의 같이 움직입니다. 종목 수가 많아도 실제 분산 효과는 작습니다." : avgC > 0.4 ? "어느 정도 같이 움직입니다." : "서로 다르게 움직여 한쪽이 빠질 때 다른 쪽이 받쳐 줍니다.") + (pairs.length ? " 가장 비슷한 짝은 " + pairs[0].a + "·" + pairs[0].b + "(" + pairs[0].c.toFixed(2) + ")입니다." : ""));
  if (pfVol != null) sum.push("변동성: 연 " + Math.round(pfVol * 100) + "%로 1년에 한 번쯤 " + anPct(-pfVol * 1.65, 0) + " 정도의 하락은 정상 범위입니다. 이 숫자를 견딜 수 없다면 비중이 아니라 '총액'을 줄여야 합니다.");
  sum.push("조정 방향: " + (top.w > 0.4 ? "① " + top.name + "를 30% 이하로. " : "① 1위 비중은 적정. ") + (avgC != null && avgC > 0.65 ? "② 상관이 낮은 자산(채권·금·다른 업종) 추가. " : "② 상관관계는 양호. ") + (krW === 1 || krW === 0 ? "③ 국내·해외 한쪽에 몰려 있어 환율 분산 고려." : "③ 국내 " + Math.round(krW * 100) + "% · 해외 " + Math.round((1 - krW) * 100) + "% 지역 분산 유지.") + " 새 돈은 '리밸런싱 계산기'로 부족한 쪽에 넣으세요.");
  return { rows: rowsOut, ck: C, sum: sum, src: "내 자산 보유 기록(브라우저) · 야후 파이낸스 종가 · " + cDate(Date.now()), items: I };
}

/* ============================================================ 06 매크로 분석 ============================================================ */
function anMacroPrep() { return typeof macroEnsure === "function" ? macroEnsure().then(function (d) { return d && !d.none ? macPxLoad() : null; }).catch(function () { return null; }) : Promise.resolve(); }
function anMacro() {
  var K = typeof macKpis === "function" && typeof MAC !== "undefined" && MAC.doc && !MAC.doc.none ? macKpis() : [], by = {}; K.forEach(function (k) { by[k.id] = k; });
  function last(id) { var k = by[id]; return k && k.S ? k.S.v[k.S.t.length - 1] : null; }
  function ago(id, days) { var k = by[id]; if (!k || !k.S) return null; var j = macIdx(k.S.t, k.S.t[k.S.t.length - 1] - days * 86400e3); return k.S.v[j]; }
  var krw = last("krw"), krw1m = ago("krw", 30), krw1y = ago("krw", 365), fed = last("fed"), fed1y = ago("fed", 365), bok = last("bok"), gap = last("gap"), us10 = last("us10y"), us10y1 = ago("us10y", 365), m2 = last("m2y");
  var st = function (s) { return typeof nbStat === "function" ? nbStat(s) : null; }, spy = st("SPY"), ks = st("^KS11"), vix = st("^VIX"), tlt = st("TLT"), gld = st("GLD"), oil = st("USO") || st("CL=F"), dxy = st("DX-Y.NYB") || st("UUP");
  var R = typeof macReady === "function" && macReady() ? macroCompute().filter(function (r) { return r.now && r.now.on; }) : [];
  function lastMove(id) { var k = by[id]; if (!k || !k.S) return null; var V = k.S.v, T = k.S.t, i = V.length - 1; while (i > 0 && V[i] === V[i - 1]) i--; if (i <= 0) return { dir: "동결", at: null, from: V[0], to: V[V.length - 1], n: 0 }; var dir = V[i] > V[i - 1] ? "인상" : "인하", j = i, n = 0; while (j > 0 && (V[j] > V[j - 1]) === (dir === "인상") && V[j] !== V[j - 1]) { n++; j--; while (j > 0 && V[j] === V[j - 1]) j--; } return { dir: dir, at: T[i], from: V[i - 1], to: V[i], n: n, days: Math.round((T[T.length - 1] - T[i]) / 86400e3) }; }
  var FM = lastMove("fed"), BM = lastMove("bok"), fedDir = FM ? FM.dir : null, fedAgo = FM && FM.days != null ? (FM.days < 1 ? "오늘" : FM.days < 60 ? FM.days + "일 전" : FM.days < 400 ? Math.round(FM.days / 30) + "개월 전" : "1년 넘게 전") : "";
  var y10Warn = us10 != null && us10 >= 5 ? "bad" : us10 != null && us10 >= 4.5 ? "mid" : "ok";
  var rowsOut = [];
  if (K.length) K.forEach(function (k) { var sub = k.sub; if (k.id === "fed" && FM && FM.at) sub = "마지막 변경 " + macD(FM.at) + " " + FM.from.toFixed(2) + "→" + FM.to.toFixed(2) + "% · " + FM.dir + (FM.n > 1 ? " " + FM.n + "회 연속" : " 시작"); if (k.id === "bok" && BM && BM.at) sub = "마지막 변경 " + macD(BM.at) + " " + BM.from.toFixed(2) + "→" + BM.to.toFixed(2) + "% · " + BM.dir; if (k.id === "us10y") sub += y10Warn === "bad" ? " · ⚠ 5% 이상" : y10Warn === "mid" ? " · 4.5% 이상 경계" : ""; rowsOut.push([k.l, k.v, sub]); }); else rowsOut.push(["매크로 데이터", "아직 수집 전", "관심 → 매크로 탭에서 수집"]);
  [["S&P500", spy], ["코스피", ks], ["VIX", vix], ["미국 장기채(TLT)", tlt], ["금(GLD)", gld], ["원유(USO)", oil]].forEach(function (p) { if (p[1]) rowsOut.push([p[0], p[0] === "VIX" ? p[1].last.toFixed(0) : anPct(p[1].m1, 1) + " (1개월)", "1년 " + anPct(p[1].y1 != null ? p[1].y1 : p[1].m12, 0) + (p[0] === "VIX" ? "" : " · 고점 대비 " + anPct(p[1].vsHi, 0))]); });
  if (R.length) rowsOut.push(["지금 해당하는 조건", R.map(function (r) { return r.c.short; }).join(" · "), "과거 사례 기반 — 매크로 탭 참고"]);
  /* v12.4 금리 판정 = '마지막 변경 방향'(1년 전 대비 아님) — 매크로 탭의 '인상 시작/인하 시작' 조건과 같은 기준 */
  var C = [
    fed != null ? anCk(y10Warn === "bad" ? "bad" : fedDir === "인하" && y10Warn === "ok" ? "ok" : fedDir === "인상" ? "bad" : "mid", "미국 기준금리와 Fed 정책", "미 기준금리 " + fed.toFixed(2) + "% · 마지막 변경 " + (FM && FM.at ? macD(FM.at) + " " + FM.from.toFixed(2) + "→" + FM.to.toFixed(2) + "% (" + fedDir + (FM.n > 1 ? " " + FM.n + "회 연속" : " 시작") + ", " + fedAgo + ")" : "없음") + (fed1y != null ? " · 1년 전 " + fed1y.toFixed(2) + "%" : "") + (us10 != null ? " · 10년물 " + us10.toFixed(2) + "%" : "") + (y10Warn === "bad" ? " ⚠ 10년물 5% 이상 — 주식 밸류에이션에 직접 부담" : y10Warn === "mid" ? " · 10년물 4.5% 넘어 경계" : "") + (fedDir === "인하" ? (y10Warn === "ok" ? " — 완화 국면" : " — 기준금리는 내려도 장기금리가 높아 효과 제한") : fedDir === "인상" ? " — 긴축 국면, 고PER 주식 부담" : " — 동결")) : anCk("na", "미국 기준금리와 Fed 정책", "FRED 데이터 없음"),
    anCk("na", "물가·고용·GDP 등 핵심 지표", "물가·고용·GDP는 앱이 수집하지 않아요 → 프롬프트로 확인" + (m2 != null ? " · 참고: 미 M2 전년比 " + anPct(m2, 1) + (m2 >= 0.03 ? "(유동성 확장)" : m2 >= 0 ? "(완만)" : "(수축)") : "") + (BM && BM.at ? " · 한은 마지막 변경 " + macD(BM.at) + " " + BM.dir : "")),
    krw != null ? anCk(krw < 1350 && (krw1m == null || krw / krw1m - 1 < 0.02) ? "ok" : krw < 1420 ? "mid" : "bad", "달러·원달러 환율과 유동성 흐름", "환율 " + Math.round(krw).toLocaleString("ko-KR") + "원 (한 달 " + anPct(krw / krw1m - 1, 1) + " · 1년 " + anPct(krw / krw1y - 1, 1) + ")" + (gap != null ? " · 한미 금리차 " + (gap > 0 ? "+" : "") + gap.toFixed(2) + "%p" : "") + (krw >= 1400 ? " — 원화 약세 심함, 외국인 수급 불리" : krw >= 1350 ? " — 고환율권" : " — 안정권")) : anCk("na", "달러·원달러 환율과 유동성 흐름", "ECOS 환율 데이터 없음"),
    anCk(vix ? (vix.last < 20 ? "ok" : vix.last < 28 ? "mid" : "bad") : "na", "미·중 갈등 등 지정학적 리스크", vix ? "VIX " + vix.last.toFixed(0) + (vix.last < 20 ? " — 시장이 느끼는 위험 낮음" : vix.last < 28 ? " — 경계" : " — 공포") + (oil ? " · 원유 1개월 " + anPct(oil.m1, 1) : "") + (gld ? " · 금 1개월 " + anPct(gld.m1, 1) : "") + " · 지정학 뉴스는 프롬프트로" : "VIX 데이터 없음")
  ];
  var sum = [];
  sum.push("금리: " + (fed != null ? "미국 기준금리 " + fed.toFixed(2) + "%, 마지막 변경은 " + (FM && FM.at ? macD(FM.at) + " " + fedDir + "(" + fedAgo + (FM.n > 1 ? ", " + FM.n + "회 연속" : ", 사이클 시작") + ")" : "없음") + (us10 != null ? ", 10년물 " + us10.toFixed(2) + "%" : "") + (bok != null ? ", 한국 " + bok.toFixed(2) + "%" + (BM && BM.at ? "(" + macD(BM.at) + " " + BM.dir + ")" : "") : "") + "입니다. " + (fedDir === "인상" ? "인상이 시작된 구간은 과거에 고PER 주식이 먼저 흔들렸고, 효과는 6~12개월 뒤 실물에 나타났습니다." : fedDir === "인하" ? "인하기 초반은 주식·채권 모두에 우호적이었지만, 경기 침체를 동반한 인하는 예외였습니다." : "동결이 길어지면 시장은 다음 '방향'을 먼저 가격에 반영합니다.") + (y10Warn === "bad" ? " 10년물이 5%를 넘어 — 기준금리와 무관하게 주식의 할인율 부담이 큽니다." : y10Warn === "mid" ? " 10년물 4.5% 이상은 경계 구간입니다." : "") : "FRED 데이터가 아직 없습니다."));
  sum.push("환율·유동성: " + (krw != null ? "원/달러 " + Math.round(krw).toLocaleString("ko-KR") + "원(1년 " + anPct(krw / krw1y - 1, 1) + ")" + (gap != null ? ", 한미 금리차 " + (gap > 0 ? "+" : "") + gap.toFixed(2) + "%p" : "") + (m2 != null ? ", 미 M2 전년比 " + anPct(m2, 1) : "") + ". " + (krw >= 1400 ? "고환율은 외국인에게 한국 주식을 비싸 보이게 해 수급에 불리하고, 수출주엔 유리합니다." : "환율이 안정권이면 외국인 자금 유입에 유리합니다.") : "환율 데이터가 없습니다."));
  if (spy || ks) sum.push("시장: " + (spy ? "S&P500 1개월 " + anPct(spy.m1, 1) + ", " : "") + (ks ? "코스피 1개월 " + anPct(ks.m1, 1) + ", " : "") + (vix ? "VIX " + vix.last.toFixed(0) : "") + (tlt ? ", 장기채 1개월 " + anPct(tlt.m1, 1) : "") + ". " + (vix && vix.last >= 28 ? "공포 구간 — 과거엔 이런 때 나눠 산 쪽이 1년 뒤 유리했습니다." : vix && vix.last < 20 ? "평온 구간 — 큰 베팅보다 정액 적립이 맞는 때입니다." : "경계 구간입니다."));
  var opt = fedDir === "인하" && y10Warn === "ok" && (!vix || vix.last < 25) ? "낙관" : fedDir === "인상" || y10Warn === "bad" || (vix && vix.last >= 28) || (krw != null && krw >= 1420) ? "비관" : "기준";
  sum.push("6개월 시나리오(규칙 기반 기울기: " + opt + "): 낙관 = 금리 인하 지속 + 환율 안정 → 성장주·반도체·국내 대형주. 기준 = 금리 동결·환율 횡보 → 실적주·배당주 중심. 비관 = 물가 재상승·지정학 충격 → 금·단기채·현금 비중. " + (R.length ? "지금 해당하는 과거 조건: " + R.map(function (r) { return r.c.short; }).join(", ") + " — 매크로 탭에서 1년 뒤 사례를 확인하세요." : "") + " 물가·고용·GDP와 미·중 이슈는 앱이 수집하지 않으니 프롬프트로 보완하세요.");
  return { rows: rowsOut, ck: C, sum: sum, src: "한국은행 ECOS · 미국 FRED · 야후 파이낸스 · " + cDate(Date.now()) };
}

/* ============================================================ 실행 ============================================================ */
function anRun() {
  var m = anMod(), key = m.id + ":" + (m.need === "stock" ? AN.sym || "" : "");
  if (m.need === "stock" && !AN.sym) { AN.out = null; renderAnalyst(); return; }
  AN.busy = true; AN.err = null; renderAnalyst();
  var p;
  if (m.need === "stock") p = anPrepStock(AN.sym).then(function (D) { var out = ({ biz: anBiz, chart: anChart, earn: anEarn, fin: anFinancial })[m.id](AN.sym, D); out.counter = anCounter(m, out, D.opp); return out; });
  else if (m.need === "pf") p = anPfData().then(function (P) { if (!P) throw new Error("'내 자산'에 보유 종목을 먼저 기록해 주세요"); return anPf(P); });
  else p = anMacroPrep().then(anMacro);
  p.then(function (out) { AN.out = out; AN.outKey = key; AN.step = 2; }).catch(function (e) { AN.err = e.message; AN.out = null; }).then(function () { AN.busy = false; renderAnalyst(); });
}
/* v12.7 반론 검토: 규칙 종합(또는 ✓/✗ 개수)으로 우리 결론을 정하고, 반대편 기사에서 빠진 주제를 찾는다 */
function anCounter(m, out, opp) {
  if (!opp || !opp.length || typeof hubClassify !== "function" || typeof hubCounter !== "function") return null;
  var okN = out.ck.filter(function (c) { return c.st === "ok"; }).length, badN = out.ck.filter(function (c) { return c.st === "bad"; }).length, stance = okN > badN ? "up" : badN > okN ? "down" : "flat";
  var cls = hubClassify(opp), exp = { bull: cls.bull, bear: cls.bear }, ours = out.rows.map(function (r) { return r.join(" "); }).concat(out.ck.map(function (c) { return c.t + " " + c.why; }), out.sum).join(" ");
  var C = hubCounter(stance, exp, ours); if (C) C.stance = stance; return C;
}
function anLines(out) { var L = [], id = 0; (out.rows || []).forEach(function (r) { L.push({ id: "D" + (++id), text: r[0] + ": " + r[1] + (r[2] ? " (" + r[2] + ")" : "") }); }); (out.ck || []).forEach(function (c) { L.push({ id: "C" + (++id), text: "[" + ({ ok: "양호", mid: "보통", bad: "주의", na: "데이터 없음" })[c.st] + "] " + c.t + " — " + c.why }); }); return L; }
/* 모든 모듈 데이터 한 번에 (종목 풀세트 · 전체) */
function anAllOuts(list) {
  var outs = {}, q = Promise.resolve();
  list.forEach(function (m) { q = q.then(function () { if (m.need === "stock") return AN.sym ? anPrepStock(AN.sym).then(function (D) { outs[m.id] = ({ biz: anBiz, chart: anChart, earn: anEarn, fin: anFinancial })[m.id](AN.sym, D); }) : null; if (m.need === "pf") return anPfData().then(function (P) { if (P) outs[m.id] = anPf(P); }).catch(function () {}); return anMacroPrep().then(function () { outs[m.id] = anMacro(); }).catch(function () {}); }); });
  return q.then(function () { return outs; });
}

/* ============================================================ 프롬프트 (한 번에 복사 · 항목별 답 → 종합 · 서술형 + 카드형) ============================================================ */
var AN_FORMAT = [
  "",
  "=== 답변 형식 (반드시 이 순서와 표기를 지켜줘. 앱이 그대로 읽어서 카드로 만들어.) ===",
  "## 서술형",
  "한 줄 결론 1문장, 그 다음 항목마다 한 문단(항목 이름을 문단 첫머리에 【항목 이름】으로), 마지막에 '종합' 문단. 초보가 끝까지 읽을 수 있는 쉬운 말, 숫자는 출처와 함께.",
  "",
  "## 카드형",
  "제목: (24자 이하)",
  "한 줄: (결론 1문장, 40자 이하)",
  "항목: 항목 이름 | 판정(✓ 또는 △ 또는 ✗) | 핵심 한 문장(50자 이하) | 근거 숫자(출처 포함, 60자 이하) | 초보용 의미(50자 이하)",
  "(항목 줄은 체크리스트 수만큼 반복)",
  "종합: 판정(✓/△/✗) | 3문장 이내 종합 평가",
  "반론: 가장 강한 반대 근거 3개를 / 로 구분 (출처 포함)",
  "보완: 반론을 반영해 고친 것 또는 추가로 확인한 것 한 줄",
  "리스크: a / b / c",
  "확인할 것: a / b / c",
  "변화: (과거 기록이 주어진 경우만) 유지 또는 상향 또는 하향 | 한 줄 이유",
  "출처: 사용한 자료·날짜를 쉼표로"
].join("\n");
function anPromptModule(m, out, opts) {
  opts = opts || {}; var name = m.need === "stock" && AN.sym ? anName(AN.sym) + "(" + AN.sym + ")" : null;
  var L = [];
  if (opts.ctx) { L.push(opts.ctx); L.push(""); }
  L.push(m.role + " " + m.prompt.replace(/\[기업명\/티커\]/g, name || "[기업명/티커]"));
  L.push(""); L.push("아래 체크리스트 " + m.ck.length + "개를 항목마다 따로 답한 뒤, 내 결론에 반박하는 근거를 최소 3개 찾아 '반론' 문단을 쓰고(반대편 애널리스트·기사·숫자), 그 반론을 반영해 빠진 부분을 보완한 다음 최종 판단을 내려줘. 반론이 더 강하면 판단을 바꿔도 돼."); m.ck.forEach(function (c, i) { L.push((i + 1) + ". " + c); });
  if (out) { L.push(""); L.push("[내 앱(StockMind)이 계산한 데이터 — 이 숫자를 근거로 쓰고, '데이터 없음' 항목은 최신 공시·자료로 보완해줘. 숫자를 지어내지 말고 출처를 붙여줘.]"); anLines(out).forEach(function (l) { L.push("- " + l.text); }); }
  if (typeof arcCalibLines === "function" && AN.calib !== false) { var CL = arcCalibLines(m.id); if (CL.length) { L.push(""); CL.forEach(function (x) { L.push(x); }); } }
  var RL = anRetroLines(); if (RL.length) { L.push(""); RL.forEach(function (x) { L.push(x); }); }   // v12.40 Claude 회고 주의점
  if (!opts.noFormat) L.push(AN_FORMAT);
  return L.join("\n");
}
/* 종목 풀세트: 01~04 한 번에 → 모듈별 항목 답 → 모듈 종합 → 최종 투자 판단 */
function anPromptFull(outs) {
  var mods = AN_MODS.filter(function (m) { return m.need === "stock"; }), name = AN.sym ? anName(AN.sym) + "(" + AN.sym + ")" : "[기업명/티커]", L = [];
  L.push("너는 글로벌 증권사의 리서치 팀장이다. " + name + "을(를) 네 가지 틀(기업 · 차트 · 실적 · 재무제표)로 차례로 분석하고, 마지막에 네 분석을 종합해 최종 투자 판단을 내려줘. 독자는 한국 개인투자자 초보. 숫자는 출처와 함께, 지어내지 말 것.");
  mods.forEach(function (m, i) { L.push(""); L.push("### " + m.no + " " + m.t + " — " + m.sub); L.push(m.prompt.replace(/\[기업명\/티커\]/g, name)); m.ck.forEach(function (c, k) { L.push("  " + (k + 1) + ") " + c); }); var o = outs && outs[m.id]; if (o) { L.push("  [앱 데이터]"); anLines(o).forEach(function (l) { L.push("  - " + l.text); }); } if (typeof arcCalibLines === "function" && AN.calib !== false) arcCalibLines(m.id).forEach(function (x) { L.push("  " + x); }); });
  if (outs && outs._ctx) { L.push(""); L.push(outs._ctx); }
  var RL2 = anRetroLines(); if (RL2.length) { L.push(""); RL2.forEach(function (x) { L.push(x); }); }   // v12.40
  L.push(""); L.push("### 최종 종합"); L.push("네 틀의 결과를 겹쳐서: 서로 같은 방향을 가리키는 것 / 엇갈리는 것 / 내 결론에 반박하는 가장 강한 근거 3개와 그에 대한 답 / 그래서 지금 어떤 행동(검토·관망·나눠서 등)이 맞는지 / 생각을 바꿀 조건 3개." + (outs && outs._ctx ? " 과거 기록이 있으면 '그때 대비 무엇이 달라졌고 판단을 어떻게 조정하는지'도." : ""));
  L.push(AN_FORMAT.replace("(항목 줄은 체크리스트 수만큼 반복)", "(항목 줄은 네 틀 각각 1줄 = 4줄: 이름은 '기업' '차트' '실적' '재무')"));
  return L.join("\n");
}
/* 전체 6틀: 종목 4 + 포트폴리오 + 매크로 */
function anPromptAll(outs) {
  var L = [anPromptFull(outs).split("\n=== 답변 형식")[0]];
  ["pf", "macro"].forEach(function (id) { var m = AN_MODS.filter(function (x) { return x.id === id; })[0]; L.push(""); L.push("### " + m.no + " " + m.t + " — " + m.sub); L.push(m.prompt); m.ck.forEach(function (c, k) { L.push("  " + (k + 1) + ") " + c); }); var o = outs && outs[id]; if (o) { L.push("  [앱 데이터]"); anLines(o).forEach(function (l) { L.push("  - " + l.text); }); } });
  L.push(""); L.push("### 최종 종합 (여섯 틀)"); L.push("종목 판단(01~04)이 내 포트폴리오(05)와 매크로 환경(06) 안에서 어떤 의미인지까지 합쳐서 최종 판단과 비중 제안을 내려줘.");
  L.push(AN_FORMAT.replace("(항목 줄은 체크리스트 수만큼 반복)", "(항목 줄은 여섯 틀 각각 1줄 = 6줄: '기업' '차트' '실적' '재무' '포트폴리오' '매크로')"));
  return L.join("\n");
}
/* ============================================================ v12.15 검토 프롬프트 4종 — 참고 자료(클로드로 주식 분석하는 8가지 방법)에서 우리에게 없던 것만 ============================================================
   · 실패 시나리오(pre-mortem) · 팩트체크(붙여넣은 글 vs 앱 숫자) · 검사관 모드(받은 답변 재검토 = 출처 검증 + 검사관) · 아침 3분 브리핑(보유 종목 + 오늘 기사)
   공시 원문(10-Q/10-K)·실적 PDF 검산은 무료 연동이 없어 제외. 모두 앱 숫자를 근거로 넣고, 지어내지 말라는 규칙을 붙인다. */
function anDataBlock(out) { if (!out) return []; var L = ["[내 앱(StockMind)이 계산한 데이터 — 이 숫자만 근거로 쓰고, 없는 숫자는 '데이터 없음'이라고 써줘. 출처를 붙이고 지어내지 마.]"]; anLines(out).forEach(function (l) { L.push("- " + l.text); }); return L; }
function anPromptPremortem(out) {
  var name = AN.sym ? anName(AN.sym) + "(" + AN.sym + ")" : "[기업명/티커]", L = [];
  L.push("너는 회의적인 리스크 매니저야. " + name + "을(를) 지금 매수한 뒤 6개월 후 주가가 30% 하락했다고 가정해줘(사전 부검, pre-mortem).");
  L.push("1) 가능한 원인 3가지를 '가능성 높은 순'으로, 각각 왜 그럴 수 있는지 아래 앱 숫자와 연결해서 써줘.");
  L.push("2) 원인마다 '조기 경고 신호' 2개씩 — 내가 어디서(공시·기사·숫자) 무엇을 보면 알 수 있는지 구체적으로.");
  L.push("3) '내 투자 가설이 틀렸다고 판단할 조건' 3가지 — 숫자나 사건으로 딱 잘라서(예: 영업이익률이 X% 아래, 가이던스 하향).");
  L.push("4) 반대로 '내가 틀리지 않았는데 주가만 빠진 경우'를 구분하는 기준 1가지.");
  L.push(""); L = L.concat(anDataBlock(out));
  L.push(""); L.push("## 서술형"); L.push("(위 1~4를 문단으로)"); L.push("## 카드형"); L.push("제목: " + name.replace(/\(.*\)/, "") + " 실패 시나리오"); L.push("한 줄: (가장 가능성 높은 원인 한 문장)"); L.push("원인 1|가능성|핵심|경고 신호|틀렸다고 볼 조건"); L.push("원인 2|…"); L.push("원인 3|…"); L.push("확인할 것: (쉼표로)");
  return L.join("\n");
}
function anPromptFactcheck(out, text) {
  var name = AN.sym ? anName(AN.sym) + "(" + AN.sym + ")" : "[기업명/티커]", L = [];
  L.push("너는 팩트체커야. 아래 [글]은 " + name + "에 대해 내가 받은 리포트·커뮤니티·기사 내용이야. 글의 핵심 주장을 번호를 붙여 정리하고, 주장마다 (a) 사실/추정/의견 중 무엇인지, (b) 아래 앱 숫자와 맞는지(맞음·다름·확인 불가), (c) 다르면 글의 값 → 앱의 값 → 차이의 이유 후보(기준일·단위·GAAP/Non-GAAP·전분기 vs 전년 동기 혼용)를 써줘.");
  L.push("앱에 없는 숫자는 '확인 불가'로 두고 지어내지 마. 마지막에 '이 글을 믿어도 되는 정도'를 상·중·하로 매기고 이유 한 줄.");
  L.push(""); L.push("[글]"); L.push(text || "(여기에 글을 붙여넣기)"); L.push("[/글]");
  L.push(""); L = L.concat(anDataBlock(out));
  L.push(""); L.push("## 서술형"); L.push("(주장별 검증 문단)"); L.push("## 카드형"); L.push("제목: " + name.replace(/\(.*\)/, "") + " 팩트체크"); L.push("한 줄: (믿어도 되는 정도와 이유)"); L.push("주장 1|판정(맞음/다름/확인 불가)|글의 값|앱의 값|차이 이유"); L.push("주장 2|…"); L.push("확인할 것: (쉼표로)");
  return L.join("\n");
}
function anPromptInspector(out, answer) {
  var L = [];
  L.push("너는 비판적인 검토자(검사관)야. 아래 [분석]은 방금 받은 AI 분석이야. 다음을 점검해서 틀린 곳을 고쳐줘.");
  L.push("1) 숫자·증감률·날짜·단위를 다시 계산해 확인. 2) 아래 [앱 데이터]에 없는 숫자는 '출처 없음'으로 표시하고 삭제하거나 '확인 필요'로 바꿔. 3) 인용·근거가 실제로 있는지, 논리 비약·과장은 없는지. 4) 틀렸거나 확인되지 않은 항목만 '원래 → 수정 → 근거'로 표로 정리. 5) 고칠 게 없으면 '확인된 수정 사항 없음'이라고만 답해.");
  L.push("6) 마지막에 수정을 반영한 [분석]의 '## 카드형' 블록을 다시 써줘(항목|판정|핵심|근거 숫자|의미 형식 유지).");
  L.push(""); L.push("[분석]"); L.push(answer || "(여기에 받은 답변을 붙여넣기)"); L.push("[/분석]");
  L.push(""); L = L.concat(anDataBlock(out));
  return L.join("\n");
}
function anPromptMorning() {
  var lots = []; try { lots = loadHoldings().lots || []; } catch (e) {}
  var syms = [], seen = {}; lots.forEach(function (x) { if (x.s && !seen[x.s]) { seen[x.s] = 1; syms.push(x.s); } });
  if (!syms.length && AN.sym) syms.push(AN.sym);
  var news = typeof hubNewsItems === "function" ? hubNewsItems() : [], L = [], today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  L.push("오늘은 " + today + ". 내 보유 종목은 " + (syms.length ? syms.map(function (s) { return anName(s) + "(" + s + ")"; }).join(", ") : "[종목1], [종목2]") + "이야.");
  L.push("지난 24시간 동안 각 종목의 주요 뉴스·공시를 정리하고, 매출·이익에 미칠 영향과 중요도(상·중·하), 출처 링크를 알려줘. 특이사항이 없으면 '없다'고 해. 3분 안에 읽을 분량으로, 종목마다 2~3줄.");
  L.push("아래 [오늘 기사]는 내 앱이 네이버 검색으로 모은 제목이야 — 여기 없는 사건은 '확인 필요'로 표시하고 지어내지 마.");
  L.push(""); L.push("[오늘 기사]"); news.slice(0, 25).forEach(function (n) { L.push("- " + n.t + (n.it && n.it.press ? " (" + n.it.press + (n.it.time ? " · " + n.it.time : "") + ")" : "") + (n.it && n.it.url ? " " + n.it.url : "")); }); if (!news.length) L.push("(앱에 수집된 기사 없음 — 관심 탭 뉴스를 먼저 열면 채워져요)"); L.push("[/오늘 기사]");
  (syms.length ? syms : []).forEach(function (s) { var r = typeof rpRows === "function" ? rpRows(s) : []; if (r.length > 1) L.push("- " + anName(s) + " 전일 종가 " + anPrice(s, r[r.length - 1].c) + " (" + anPct(r[r.length - 1].c / r[r.length - 2].c - 1, 2) + ")"); });
  L.push(""); L.push("## 서술형"); L.push("(종목별 2~3줄)"); L.push("## 카드형"); L.push("제목: 보유 종목 아침 브리핑 " + today); L.push("한 줄: (오늘 가장 중요한 한 가지)"); L.push("종목|중요도(상/중/하)|핵심|영향|출처");
  return L.join("\n");
}
function anCopy(text, btn) {
  var done = function () { if (btn) { var o = btn.innerHTML; btn.textContent = "✓ 복사됨"; setTimeout(function () { btn.innerHTML = o; }, 1500); } };
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(done).catch(function () { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { alert("복사가 막혔어요. 아래 '프롬프트 보기'에서 직접 복사해 주세요."); } document.body.removeChild(ta); });
}

/* ============================================================ 답변 붙여넣기 → 파싱 → 저장(아카이브 = 분석 자산) ============================================================ */
function anAnsLoad() { return typeof arcItems === "function" ? arcItems() : []; }
/* 카드형 블록 파싱 — 느슨하게: 줄 머리 키워드로 읽음 */
function anParse(text) {
  var t = String(text || "").replace(/\r/g, ""), P = { items: [], risks: [], watch: [], paras: [], srcs: "", counter: [] };
  var cardIdx = t.search(/^\s*#{1,4}\s*카드형/m), narIdx = t.search(/^\s*#{1,4}\s*서술형/m);
  var nar = narIdx >= 0 ? t.slice(narIdx, cardIdx > narIdx ? cardIdx : undefined).replace(/^\s*#{1,4}\s*서술형\s*/m, "") : cardIdx > 0 ? t.slice(0, cardIdx) : t;
  var card = cardIdx >= 0 ? t.slice(cardIdx) : t;
  P.paras = nar.split(/\n\s*\n/).map(function (x) { return x.replace(/\s*\n\s*/g, " ").trim(); }).filter(function (x) { return x && !/^#{1,4}/.test(x); });
  card.split("\n").forEach(function (ln) {
    var l = ln.replace(/^\s*[-*•]\s*/, "").trim(); if (!l) return; var m;
    if ((m = l.match(/^(제목|Title)\s*[:：]\s*(.+)/))) P.title = m[2].trim();
    else if ((m = l.match(/^(한\s*줄|한줄\s*결론|결론\s*한\s*줄)\s*[:：]\s*(.+)/))) P.one = m[2].trim();
    else if ((m = l.match(/^항목\s*[:：]\s*(.+)/))) { var seg = m[1].split("|").map(function (x) { return x.trim(); }); if (seg.length >= 2) P.items.push({ name: seg[0], st: anStOf(seg[1]), key: seg[2] || "", num: seg[3] || "", mean: seg[4] || "" }); }
    else if ((m = l.match(/^종합\s*[:：]\s*(.+)/))) { var sg = m[1].split("|").map(function (x) { return x.trim(); }); P.verdictSt = anStOf(sg[0]); P.verdict = sg.length > 1 ? sg.slice(1).join(" ") : sg[0]; }
    else if ((m = l.match(/^결론\s*[:：]\s*(.+)/))) { if (!P.verdict) P.verdict = m[1].trim(); }
    else if ((m = l.match(/^리스크\s*[:：]\s*(.+)/))) P.risks = m[1].split(/\s*\/\s*/).filter(Boolean);
    else if ((m = l.match(/^확인(할\s*것)?\s*[:：]\s*(.+)/))) P.watch = m[2].split(/\s*\/\s*/).filter(Boolean);
    else if ((m = l.match(/^출처\s*[:：]\s*(.+)/))) P.srcs = m[1].trim();
    else if ((m = l.match(/^변화\s*[:：]\s*(.+)/))) P.change = m[1].trim();
    else if ((m = l.match(/^반론\s*[:：]\s*(.+)/))) P.counter = m[1].split(/\s*\/\s*/).filter(Boolean);
    else if ((m = l.match(/^보완\s*[:：]\s*(.+)/))) P.fix = m[1].trim();
  });
  P.ok = !!(P.items.length || P.verdict || P.paras.length);
  return P;
}
function anStOf(s) { s = String(s || ""); return /✓|양호|좋|긍정|OK|O\b/i.test(s) ? "ok" : /✗|X|주의|나쁨|부정|위험/i.test(s) ? "bad" : /△|보통|중립|혼재/.test(s) ? "mid" : "mid"; }
function anSnap(out) {   // 저장 시점의 앱 데이터 스냅샷 — 나중에 '그때 vs 지금' 비교·검증에 쓴다
  var m = anMod(), price = null;
  if (m.need === "stock" && AN.sym) { var rows = typeof rpRows === "function" ? rpRows(AN.sym) : []; if (rows.length) price = rows[rows.length - 1].c; }
  return { price: price, key: typeof arcSnapKey === "function" ? arcSnapKey(out) : {}, rows: out ? out.rows.slice(0, 40).map(function (r) { return [r[0], r[1]]; }) : [], ck: out ? out.ck.map(function (c) { return c.st; }) : [] };
}
function anAnsAdd(text) {
  var m = anMod(), P = anParse(text); if (!String(text).trim()) return Promise.resolve(null);
  var rec = { kind: "analyst", mod: m.id, modName: m.t, sym: m.need === "stock" ? AN.sym : null, name: m.need === "stock" && AN.sym ? anName(AN.sym) : m.t, title: P.title || (m.t + (AN.sym && m.need === "stock" ? " · " + anName(AN.sym) : "")), text: String(text), scope: AN.pScope || "module", p: P, snap: anSnap(AN.outKey === m.id + ":" + (m.need === "stock" ? AN.sym || "" : "") ? AN.out : null), tags: [] };
  return arcSave(rec).then(function (it) { AN.ansId = it.id; return it; });
}

/* ============================================================ v12.39 Claude 자동 분석 — 프롬프트 → 분석(웹 보완) → 검사관 재검토 → 저장 → 카드
   허술함 방지: 분석 시스템 지시(서버)가 '출발 가설·무게 둔 근거·생각이 바뀐 지점'(【사고 과정】), 반론 3개 정면 답변, 실패 시나리오, 생각을 바꿀 조건을 강제한다.
   검사관이 숫자·출처를 다시 확인해 카드형 블록을 고친다. 결과는 ④ 저장(분석 자산)에 쌓여 다음 분석의 문맥·적중률 보정에 쓰인다.
   ============================================================ */
var AN_AUTO_STEPS = ["앱 데이터", "Claude 분석 · 웹 보완", "검사관 재검토", "저장", "카드"];
function anAutoHtml() {
  var A = AN.auto; if (!A) return "";
  return '<div class="anAuto"><b>🤖 자동 분석</b> <small class="briefDim">' + anEsc(A.label || "") + '</small><div class="anAutoSteps">' + AN_AUTO_STEPS.map(function (t, i) { return '<span class="' + (i < A.step ? "done" : i === A.step && A.busy ? "on" : "") + '">' + (i < A.step ? "✓ " : "") + t + '</span>'; }).join("") + '</div>' +
    (A.msg ? '<div>' + anEsc(A.msg) + '</div>' : '') + (A.err ? '<div class="rbWarn">' + anEsc(A.err) + '</div>' : '') + (A.src && A.src.length && typeof smSrcHtml === "function" ? smSrcHtml(A.src) : '') + '</div>';
}
function anAutoSet(o) { AN.auto = Object.assign(AN.auto || {}, o); if (typeof currentTab === "undefined" || currentTab === "analyst") renderAnalyst(); }
function anAutoMerge(t1, t2, src) {
  var out = t1, card2 = "", review = "";
  if (t2) { var ci = t2.search(/^\s*#{1,4}\s*카드형/m), ri = t2.search(/^\s*#{1,4}\s*검토 결과/m); if (ci >= 0) card2 = t2.slice(ci).trim(); if (ri >= 0) review = t2.slice(ri, ci > ri ? ci : undefined).replace(/^\s*#{1,4}\s*검토 결과\s*/m, "").trim(); }
  if (card2) { var c1 = out.search(/^\s*#{1,4}\s*카드형/m); out = (c1 >= 0 ? out.slice(0, c1) : out + "\n\n") + card2; }
  if (review) out += "\n\n## 검토 결과 (검사관)\n" + review;
  if (src && src.length) out += "\n\n## 참고 링크\n" + src.map(function (s) { return "- " + (s.t || "") + " " + s.u; }).join("\n");
  return out;
}
function anAutoRun(prompt, O) {
  var m = anMod(), label = m.no + " " + m.t + (AN.sym && m.need === "stock" ? " · " + anName(AN.sym) : "") + " · " + ({ module: "이 틀만", full: "종목 풀세트", all: "전체 6틀" })[AN.pScope || "module"], src = [];
  AN.auto = null; AN.autoNote = null; anAutoSet({ busy: true, step: 1, label: label, msg: "Claude가 앱 데이터를 읽고, 빈칸은 최신 공시·기사로 보완하며 분석 중이에요 (1~4분)…", err: null, src: [] });
  var t0 = Date.now(), t1 = "";
  smClaude("analyst", prompt).then(function (j) {
    t1 = j.text || ""; src = j.sources || [];
    /* v12.66 형식 머리(## 서술형/카드형)가 빠졌어도 내용이 있으면 살린다 — 빈 답일 때만 실패(이유를 같이 보여 줌) */
    if (!/##\s*카드형/.test(t1) && !/##\s*서술형/.test(t1)) {
      if (String(t1).replace(/\s+/g, "").length > 400) t1 = "## 서술형\n" + t1;
      else throw new Error("Claude 답이 비어 있어요(멈춘 이유: " + (j.stop || "?") + (j.blocks ? " · 블록 " + Object.keys(j.blocks).map(function (k) { return k + "×" + j.blocks[k]; }).join(", ") : "") + (j.usage ? " · 출력 토큰 " + j.usage.output_tokens : "") + ") — 범위를 '이 틀만'으로 줄이거나 다시 시도해 주세요");
    }
    if (j.stop === "max_tokens" && !/##\s*카드형/.test(t1)) AN.autoNote = "답이 길어 끝부분(카드형)이 잘렸어요 — 서술형만 저장했어요";
    anAutoSet({ step: 2, src: src, msg: "검사관이 숫자·출처·논리를 다시 확인하는 중… (분석에서 웹 검색 " + (j.searches || []).length + "회 사용)" });
    return smClaude("inspect", anPromptInspector(O && AN.pScope === "module" ? O : null, t1)).then(function (k) { (k.sources || []).forEach(function (s) { if (!src.some(function (x) { return x.u === s.u; })) src.push(s); }); return k.text || ""; }).catch(function (e) { AN.auto.msg = "검사관 단계 실패(" + e.message + ") — 분석 원문으로 저장해요"; return ""; });
  }).then(function (t2) {
    anAutoSet({ step: 3, msg: "저장 중…" });
    var finalText = anAutoMerge(t1, t2, src);
    return anAnsAdd(finalText);
  }).then(function (it) {
    if (!it) throw new Error("저장하지 못했어요");
    AN.arcPairs = null; AN.step = 5;
    anAutoSet({ step: 4, msg: "카드를 만드는 중…" });
    var P = anParse(it.text || ""), kind = P.items.length ? "card" : "narr";
    anMakeCards(it, kind, null);
    anAutoSet({ busy: false, step: 5, msg: (AN.autoNote ? AN.autoNote + " · " : "") + "완료 · " + Math.round((Date.now() - t0) / 1000) + "초 · ④에 저장됨 · " + (kind === "card" ? "카드형" : "서술형") + " 카드를 열었어요(다른 형태는 ⑤에서)" });
  }).catch(function (e) { anAutoSet({ busy: false, err: "자동 분석 실패: " + e.message + (t1 ? " — 분석 원문은 ④ 입력칸에 넣어 두었어요" : "") }); if (t1) { var ta = document.getElementById("anAnsMain"); if (ta) ta.value = t1; } });
}

/* ============================================================ v12.40 Claude 회고 · 검토 바로 실행
   회고: 저장된 분석 + 그 뒤 실제 결과(가격·적중) → 우리가 자주 틀리는 패턴 · 계속 지킬 패턴 · 다음 프롬프트에 넣을 주의 문장(sm.retroRules)
   검토: 팩트체크·검사관·실패 시나리오·아침 브리핑 프롬프트를 복사 대신 Claude로 바로 → 결과 보기 · ④에 저장
   ============================================================ */
var AN_RETRO = (function () { try { return JSON.parse(localStorage.getItem("sm.retroRules") || "null"); } catch (e) { return null; } })();
function anRetroLines() { return AN_RETRO && AN_RETRO.rules && AN_RETRO.rules.length ? ["[과거 회고에서 나온 주의점 — " + new Date(AN_RETRO.at + 9 * 3600e3).toISOString().slice(0, 10) + " Claude 회고, 이번 분석에서 같은 실수를 피할 것]"].concat(AN_RETRO.rules.map(function (r) { return "- " + r; })) : []; }
function anRetroInput() {
  var items = anAnsLoad().slice().sort(function (a, b) { return a.at - b.at; }), pv = {}; (AN.arcPairs || []).forEach(function (x) { if (x && x.it) pv[x.it.id] = x.v; });
  var st = { ok: "긍정✓", mid: "중립△", bad: "부정✗" }, L = ["[저장된 분석과 그 뒤 결과] — 날짜 | 틀 | 대상 | 우리 판정 | 한 줄 결론 | 리스크 | 결과(지금까지 가격 변화 · 경과일 · 적중)"];
  items.slice(-80).forEach(function (it) {
    var P = it.p || {}, v = pv[it.id];
    L.push("- " + arcD(it.at) + " | " + (it.modName || it.mod || "") + " | " + (it.name || it.sym || "") + " | " + (st[P.verdictSt] || "-") + " | " + String(P.one || P.verdict || it.title || "").slice(0, 80) + " | " + (P.risks || []).slice(0, 2).join(" / ").slice(0, 60) + " | " + (v ? anPct(v.since, 1) + " · " + v.days + "일 · 기간 중 최저 " + anPct(v.lo, 0) + " 최고 " + anPct(v.hi, 0) + " · " + (v.hit == null ? "검증 전(20일 미만)" : v.hit ? "적중" : "빗나감") : "결과 없음(종목 아님 또는 가격 없음)"));
  });
  if (typeof arcScore === "function" && AN.arcPairs) { var S = arcScore(AN.arcPairs); if (S._all) L.push("", "[전체 적중] " + S._all.hit + "/" + S._all.n); }
  return L.join("\n");
}
function anRetroRun(btn) {
  var old = btn.innerHTML; btn.disabled = true; btn.textContent = "회고 중… (30초~2분)";
  smClaude("retro", anRetroInput(), { json: true, web: false }).then(function (j) {
    AN_RETRO = Object.assign({ at: Date.now(), model: j.model }, j.data || {}); try { localStorage.setItem("sm.retroRules", JSON.stringify(AN_RETRO)); } catch (e) {}
    renderAnalyst(); var el = document.getElementById("anRetro"); if (el) try { el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
  }).catch(function (e) { alert("회고 실패: " + e.message); }).then(function () { if (document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; } });
}
function anRetroHtml() {
  var R = AN_RETRO, n = anAnsLoad().length;
  var h = '<section class="anSec" id="anRetro"><div class="mkStep"><b>8</b> 회고 <small class="briefDim">' + (R ? new Date(R.at + 9 * 3600e3).toISOString().slice(0, 10) + ' · ' + anEsc(R.stats || "") : '저장된 분석 ' + n + '건과 실제 결과를 Claude가 읽고 우리가 자주 틀리는 패턴을 찾아요') + '</small>' + (typeof smClaude === "function" ? '<button class="chip" data-anretro style="margin-left:auto"' + (n ? '' : ' disabled') + '>🧭 Claude 회고' + (R ? ' 다시' : '') + '</button>' : '') + '</div>';
  if (R) {
    h += (R.summary ? '<div class="anRetroSum">' + anEsc(R.summary) + '</div>' : '');
    if ((R.miss || []).length) h += '<div class="anSubH">자주 틀린 패턴</div><ul class="anRetroL">' + R.miss.map(function (x) { return '<li><b>' + anEsc(x.pattern) + '</b><small>근거: ' + anEsc(x.evidence || "") + '</small><i>→ ' + anEsc(x.fix || "") + '</i></li>'; }).join("") + '</ul>';
    if ((R.keep || []).length) h += '<div class="anSubH">계속 지킬 패턴</div><ul class="anRetroL">' + R.keep.map(function (x) { return '<li><b>' + anEsc(x.pattern) + '</b><small>' + anEsc(x.evidence || "") + '</small></li>'; }).join("") + '</ul>';
    if ((R.rules || []).length) h += '<div class="anSubH">다음 분석 프롬프트에 자동으로 넣는 주의점 <small class="briefDim">(③ 프롬프트 · 🤖 자동 분석 모두)</small></div><ol class="anRetroR">' + R.rules.map(function (r) { return '<li>' + anEsc(r) + '</li>'; }).join("") + '</ol><button class="chip" data-anretrooff>주의점 빼기</button>';
  }
  return h + '</section>';
}
var AN_REV_OUT = null;
function anRevRun(kind, prompt, btn) {
  var old = btn.innerHTML; btn.disabled = true; btn.textContent = "Claude 실행 중… (30초~2분)";
  var nm = { pre: "실패 시나리오", fact: "팩트체크", insp: "검사관", morn: "아침 브리핑" }[kind] || "검토";
  smClaude("review", prompt).then(function (j) { AN_REV_OUT = { kind: kind, name: nm, text: j.text || "", sources: j.sources || [], model: j.model, searches: (j.searches || []).length }; renderAnalyst(); })
    .catch(function (e) { alert(nm + " 실패: " + e.message); }).then(function () { if (document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = old; } });
}
function anRevOutHtml() {
  var R = AN_REV_OUT; if (!R) return "";
  return '<div class="anRevOut"><div class="anSubH">🤖 ' + anEsc(R.name) + ' 결과 <small class="briefDim">' + anEsc(R.model || "") + ' · 웹 검색 ' + R.searches + '회</small><span style="margin-left:auto;display:inline-flex;gap:6px"><button class="chip" data-anrevsave>④에 저장</button><button class="chip" data-anrevcp>복사</button><button class="chip" data-anrevx>닫기</button></span></div><div class="anRevTxt">' + anEsc(R.text).replace(/\n/g, "<br>") + '</div>' + (typeof smSrcHtml === "function" ? smSrcHtml(R.sources) : '') + '</div>';
}

/* ============================================================ 답변 → 카드 (서술형 · 카드형) ============================================================ */
function anCardsFrom(it, kind) {
  var P = anParse(it.text || ""), m = AN_MODS.filter(function (x) { return x.id === it.mod; })[0] || anMod(), title = P.title || it.title, day = cDate(Date.now()), foot = "AI 분석(" + day + ") · " + (P.srcs || "출처는 답변 참고") + " · 투자 권유 아님", list = [];
  var stTxt = { ok: "양호 ✓", mid: "보통 △", bad: "주의 ✗" };
  list.push({ name: "표지", cv: nbCover(m.no + " " + m.t + " · " + day, [title], P.one || "", "월가 애널리스트 6틀 중 " + m.t + " · " + (it.name || "") + " · 투자 권유 아님") });
  if (kind === "card") {
    var total = P.items.length + 3, pg = 1;
    P.items.forEach(function (x, i) { var c = nbNew(); pg++; nbTop(c, i + 1, [x.name + ":", "[[" + stTxt[x.st] + "]]", "", x.key], pg, total); nbBody(c, x.name, m.t + " 체크리스트 " + (i + 1) + "/" + P.items.length); hubSectionsFill(c, [x.key ? { h: "핵심", t: x.key } : null, x.num ? { h: "근거 숫자", t: x.num } : null, x.mean ? { h: "초보용 의미", t: x.mean } : null].filter(Boolean).length ? [x.key ? { h: "핵심", t: x.key } : null, x.num ? { h: "근거 숫자", t: x.num } : null, x.mean ? { h: "초보용 의미", t: x.mean } : null].filter(Boolean) : [{ h: "핵심", t: "-" }], null); nbFoot(c, foot); list.push({ name: String(x.name).replace(/\s/g, "").slice(0, 8), cv: c.cv }); });
    var c2 = nbNew(); pg++; nbTop(c2, P.items.length + 1, ["종합:", "[[" + (stTxt[P.verdictSt] || "판단") + "]]", "", P.one || ""], pg, total); nbBody(c2, "종합 평가", "항목 " + P.items.length + "개를 겹쳐 보면");
    hubSectionsFill(c2, [{ h: "종합", t: P.verdict || "-" }, P.counter && P.counter.length ? { h: "반론", t: P.counter.join(" · ") } : null, P.fix ? { h: "보완", t: P.fix } : null, P.risks.length ? { h: "리스크", t: P.risks.join(" · ") } : null, P.watch.length ? { h: "확인할 것", t: P.watch.join(" · ") } : null].filter(Boolean), null); nbFoot(c2, foot); list.push({ name: "종합", cv: c2.cv });
  } else {
    var paras = P.paras.length ? P.paras : [P.verdict || it.text.slice(0, 600)], pages = [], cur = [], len = 0;
    paras.forEach(function (p) { if (len + p.length > 420 && cur.length) { pages.push(cur); cur = []; len = 0; } cur.push(p); len += p.length; }); if (cur.length) pages.push(cur);
    var total2 = pages.length + 2;
    pages.forEach(function (pp, i) { var c = nbNew(); var head = (pp[0].match(/^【([^】]+)】/) || [])[1]; nbTop(c, i + 1, [head ? head + ":" : "읽기 " + (i + 1) + "/" + pages.length, "[[" + (head ? pp[0].replace(/^【[^】]+】\s*/, "").split(/(?<=[.다요])\s/)[0].slice(0, 40) : (P.one || title).slice(0, 40)) + "]]"], i + 2, total2); nbBody(c, title, m.t + " · 서술형 " + (i + 1) + "/" + pages.length); hubTextFill(c, { paras: pp.map(function (p) { return p.replace(/^【[^】]+】\s*/, ""); }) }); nbFoot(c, foot); list.push({ name: "글" + (i + 1), cv: c.cv }); });
  }
  list.push({ name: "마무리", cv: nbClose("여러분은 어떻게 보시나요?", ["AI 분석은 참고 자료예요.", "숫자의 출처를 꼭 직접 확인해 보세요."]) });
  return list;
}
function anMakeCards(it, kind, btn) {
  var old = btn ? btn.innerHTML : ""; if (btn) { btn.textContent = "만드는 중…"; btn.disabled = true; }
  arcText(it.id).then(function (t) { it.text = t || it.text || ""; return hubFonts(function () { return anCardsFrom(it, kind); }); }).then(function (list) { hubShow(it.title + " · " + (kind === "card" ? "카드형" : "서술형"), list, { modal: true, note: "AI 답변을 " + (kind === "card" ? "항목 카드 + 종합" : "읽는 글 카드") + "로 만들었어요. 숫자·출처는 답변에 적힌 그대로이니 올리기 전에 확인하세요." }); }).catch(function (e) { alert("카드를 만들지 못했어요: " + e.message); }).then(function () { if (btn) { btn.innerHTML = old; btn.disabled = false; } });
}

/* ============================================================ 화면 — 단계: ① 틀·종목 ② 앱 데이터 ③ 프롬프트 ④ 답변 ⑤ 카드 ============================================================ */
AN.step = AN.step || 1; AN.pScope = AN.pScope || "module";
function anRecent() {
  var out = [], seen = {}; function add(s) { if (s && !seen[s] && !/^\^|=X$/.test(s)) { seen[s] = 1; out.push(s); } }
  try { (loadHoldings().lots || []).forEach(function (L) { add(L.s); }); } catch (e) {}
  try { (typeof briefState !== "undefined" && briefState.popular || []).forEach(function (p) { add(p.s || p.symbol || p); }); } catch (e) {}
  return out.slice(0, 8);
}
function renderAnalyst() {
  var root = document.getElementById("anBody"); if (!root) return; var m = anMod(), O = AN.out, ans = anAnsLoad(), mine = ans.filter(function (a) { return a.mod === m.id && (m.need !== "stock" || a.sym === AN.sym); }).sort(function (a, b) { return b.at - a.at; }), cur = ans.filter(function (a) { return a.id === AN.ansId; })[0] || mine[0] || null;
  if (ARC_ST.items === null && !ARC_ST.loading) arcLoad().then(function () { renderAnalyst(); });
  var past = m.need === "stock" ? (AN.sym ? arcFor(AN.sym, null, 50) : []) : arcFor(null, m.id, 50), pastSame = past.filter(function (x) { return x.mod === m.id; }), lastRec = pastSame[0] || null;
  if (O && AN.outKey !== m.id + ":" + (m.need === "stock" ? AN.sym || "" : "")) O = null;
  var ready = !!O, st = function (k) { return k < AN.step ? "done" : k === AN.step ? "on" : ""; };
  var h = '';   // v12.14 7칸 스테퍼 제거 — 번호 제목이 상태를 같이 보여준다(두 겹 계층 → 한 겹)
  // ① 틀 · 종목
  h += '<section class="anSec"><div class="mkStep"><b>1</b> 분석 틀 고르기 <small class="briefDim">' + m.no + ' ' + anEsc(m.t) + (AN.sym && m.need === "stock" ? ' · ' + anEsc(anName(AN.sym)) : '') + '</small></div>';
  h += '<div class="anGrid">' + AN_MODS.map(function (x) { var n = ans.filter(function (a) { return a.mod === x.id; }).length; return '<button class="anMod' + (x.id === AN.mod ? ' on' : '') + '" data-anmod="' + x.id + '"><span class="anNo">' + x.no + '</span><span class="anMain"><b>' + x.icon + ' ' + x.t + (n ? ' <em class="anCnt">' + n + '</em>' : '') + '</b><small>' + x.sub + '</small></span></button>'; }).join("") + '</div>';
  // v12.14 체크리스트 4개는 ② 평가 카드에 그대로 나오므로 여기선 반복하지 않는다
  if (m.need === "stock") h += '<div class="anPick"><div class="rpAsk"><input id="anSym" placeholder="종목 검색 (예: 삼성전자, NVDA)" autocomplete="off"><div class="hResults" id="anSymRes"></div></div><div class="anChips">' + (AN.sym ? '<span class="chip on">' + anEsc(anName(AN.sym)) + ' <small>' + AN.sym + '</small></span>' : '') + anRecent().filter(function (s) { return s !== AN.sym; }).map(function (s) { return '<button class="chip" data-ansym="' + s + '">' + anEsc(anName(s)) + '</button>'; }).join("") + '</div></div>';
  else if (m.need === "pf") h += '<div class="briefDim" style="margin:8px 0">\'내 자산\'에 기록한 보유 종목으로 계산해요 (브라우저 저장 · 현금 비중은 프롬프트에 직접 적기).</div>';
  else h += '<div class="briefDim" style="margin:8px 0">한국은행 ECOS · 미국 FRED(일 1회 수집) + 야후 지수·ETF로 계산해요. 금리 판정은 \'마지막 변경 방향\' 기준, 10년물 5% 이상이면 경고.</div>';
  h += '</section>';
  // ② 앱 데이터
  h += '<section class="anSec"><div class="mkStep"><b>2</b> 앱 데이터 <small class="briefDim">' + (ready ? anEsc(O.src) : (m.need === "stock" && !AN.sym ? "종목을 고르면 계산해요" : AN.busy ? "계산 중…" : "")) + '</small>' + (ready ? '<button class="chip anTg" data-antg="data">' + (AN.showData === false ? "펼치기 ▼" : "접기 ▲") + '</button>' : '') + '</div>';
  if (AN.busy) h += '<div class="briefDim">데이터를 모으고 계산하는 중…</div>';
  else if (AN.err) h += '<div class="rbWarn">' + anEsc(AN.err) + '</div>';
  else if (ready && AN.showData !== false) {
    var okN = O.ck.filter(function (c) { return c.st === "ok"; }).length, naN = O.ck.filter(function (c) { return c.st === "na"; }).length;
    h += '<div class="anDataGrid"><div><div class="anSubH">제시 <small>앱 숫자 그대로</small></div><table class="anT">' + O.rows.filter(function (r) { return r[1] != null && String(r[1]).trim() !== "-" && String(r[1]).trim() !== ""; }).map(function (r) { return '<tr><th>' + anEsc(r[0]) + '</th><td><b>' + anEsc(r[1]) + '</b>' + (r[2] ? '<small>' + anEsc(r[2]) + '</small>' : '') + '</td></tr>'; }).join("") + '</table>' + (function () { var miss = O.rows.filter(function (r) { return r[1] == null || String(r[1]).trim() === "-" || String(r[1]).trim() === ""; }); return miss.length ? '<div class="briefDim" style="font-size:11.5px;margin-top:6px">자료 없음 ' + miss.length + '개: ' + anEsc(miss.map(function (r) { return r[0].replace(/\s*\(.*?\)\s*/g, ""); }).join(" · ")) + '</div>' : ""; })() + '</div>';
    var CAL = typeof arcApplyCalib === "function" && AN.calib !== false ? arcApplyCalib(m.id, O.ck) : { ck: O.ck.map(function (c) { return Object.assign({}, c, { raw: c.st }); }), verdict: null, notes: [] }, vTxt = { ok: "양호 ✓", mid: "보통 △", bad: "주의 ✗" };
    h += '<div><div class="anSubH">평가 <small>양호 ' + okN + ' · 데이터 없음 ' + naN + ' · 규칙 기준' + (ARC_CAL.data && ARC_CAL.data.n ? ' · 보정 적용(검증 ' + ARC_CAL.data.n + '건)' : '') + '</small></div>' + (CAL.verdict ? '<div class="anRuleV ' + CAL.verdict + '">규칙 종합 <b>' + vTxt[CAL.verdict] + '</b><small>항목 가중 평균 ' + (CAL.v >= 0 ? "+" : "") + CAL.v.toFixed(2) + (CAL.notes.length ? ' · ' + anEsc(CAL.notes.join(" / ")) : '') + '</small></div>' : '') + '<div class="anCks one">' + CAL.ck.map(function (c) { var t = c.trust; return '<div class="anCk ' + c.st + '"><span class="anSt">' + ({ ok: "✓", mid: "△", bad: "✗", na: "—" })[c.st] + '</span><div><b>' + anEsc(c.t) + (t && t.grade !== "few" ? ' <em class="anTrust ' + t.grade + '">적중 ' + Math.round(t.acc * 100) + '% · ' + t.n + '건</em>' : '') + (c.raw !== c.st ? ' <em class="anTrust low">원래 ' + ({ ok: "✓", bad: "✗" })[c.raw] + '</em>' : '') + '</b><small>' + anEsc(c.why) + '</small></div></div>'; }).join("") + '</div>';
    h += '<div class="anSubH" style="margin-top:12px">정리 <small>규칙 기반 글</small></div><div class="anSum">' + O.sum.map(function (p) { return '<p>' + anEsc(p) + '</p>'; }).join("") + '</div></div></div>';
    if (O.counter) { var CT = O.counter; h += '<div class="anCounter"><div class="anSubH">반론 검토 <small>우리 결론(' + ({ up: "긍정", down: "부정", flat: "중립" })[CT.stance] + ')과 반대쪽 기사 ' + CT.n + '건 · 우리가 안 다룬 주제는 아래 칩</small></div>' + (CT.items.length ? '<ul>' + CT.items.map(function (x) { return '<li><a href="' + anEsc(x.url) + '" target="_blank" rel="noopener">' + anEsc(x.t) + '</a> <small>' + anEsc(x.press) + (x.time ? " · " + anEsc(x.time) : "") + '</small></li>'; }).join("") + '</ul>' : '') + (CT.gap.length ? '<div class="rpGap">' + CT.gap.map(function (g) { return '<span>' + anEsc(g.w) + (g.n > 1 ? ' <small>' + g.n + '건</small>' : '') + '</span>'; }).join("") + '</div>' : '') + (CT.fix ? '<p class="rpFix">' + anEsc(CT.fix) + '</p>' : '') + '</div>'; }
    if (lastRec && lastRec.snap && lastRec.snap.rows && lastRec.snap.rows.length) {
      var D = arcDiff(lastRec.snap.rows, O.rows), stT = { ok: "✓", mid: "△", bad: "✗" };
      h += '<div class="anDiff"><div class="anSubH">그때 vs 지금 <small>' + arcD(lastRec.at) + ' 기록(' + anEsc(lastRec.title) + ' · 종합 ' + (stT[lastRec.p && lastRec.p.verdictSt] || "-") + ') 대비 바뀐 숫자 ' + D.length + '개' + (lastRec.snap.price != null && m.need === "stock" && O && typeof rpRows === "function" && rpRows(AN.sym).length ? ' · 가격 ' + anPrice(AN.sym, lastRec.snap.price) + ' → ' + anPrice(AN.sym, rpRows(AN.sym)[rpRows(AN.sym).length - 1].c) + ' (' + anPct(rpRows(AN.sym)[rpRows(AN.sym).length - 1].c / lastRec.snap.price - 1, 1) + ')' : '') + '</small></div>' + (D.length ? '<table class="anT anTd">' + D.slice(0, 12).map(function (d) { return '<tr><th>' + anEsc(d.label) + '</th><td><small>' + anEsc(d.from) + '</small><b class="' + (d.dir > 0 ? "pos" : d.dir < 0 ? "neg" : "") + '">→ ' + anEsc(d.to) + '</b></td></tr>'; }).join("") + '</table>' : '<div class="briefDim">같은 항목의 숫자가 그대로예요.</div>') + '</div>';
    }
  }
  h += '</section>';
  // ③ 프롬프트
  h += '<section class="anSec' + (ready ? '' : ' dim') + '"><div class="mkStep"><b>3</b> 분석 실행 <small class="briefDim">🤖 한 번 누르면 분석 → 검사관 재검토 → 저장 → 카드까지 · 다른 AI를 쓰려면 아래 ‘수동’</small></div>';
  h += '<div class="anPrOpts">' + [["module", "이 틀만", m.no + " " + m.t + " · 체크리스트 " + m.ck.length + "개 + 앱 데이터"], ["full", "종목 풀세트", "01~04 네 틀 한 번에 → 틀별 종합 → 최종 투자 판단" + (m.need === "stock" ? "" : " (종목 선택 필요)")], ["all", "전체 6틀", "종목 4 + 포트폴리오 + 매크로 → 최종 판단·비중 제안"]].map(function (o) { return '<label class="anPrOpt' + (AN.pScope === o[0] ? ' on' : '') + '"><input type="radio" name="anScope" value="' + o[0] + '"' + (AN.pScope === o[0] ? ' checked' : '') + '><b>' + o[1] + '</b><small>' + o[2] + '</small></label>'; }).join("") + '</div>';
  h += '<label class="anCtxOpt"><input type="checkbox" data-anctx' + (AN.useCtx !== false ? ' checked' : '') + '> 과거 분석 기록 넣기 <small class="briefDim">' + (past.length ? "이 " + (m.need === "stock" ? "종목" : "틀") + " 기록 " + past.length + "건 중 최근 3건 → '그때 vs 지금 · 판단 조정' 문단을 요청" : "아직 기록 없음 — 저장이 쌓이면 자동으로 들어가요") + '</small></label>';
  /* v12.42 순서 재구성: 🤖 자동이 기본 — 프롬프트 복사·검토 프롬프트(수동)는 접어 둔다 */
  h += '<div class="anActs">' + (typeof smClaude === "function" ? '<button class="primary anAutoBtn" data-anauto' + (ready || AN.pScope !== "module" ? '' : ' disabled') + ' title="프롬프트 → Claude 분석(웹으로 빈칸 보완) → 검사관 재검토 → 저장 → 카드까지 자동">🤖 Claude가 끝까지 분석</button>' : '') + '<span class="briefDim anPrMsg"></span></div>' + anAutoHtml();
  h += '<details class="anManual"' + (AN.manualOpen ? ' open' : '') + '><summary>수동 — 프롬프트 복사해서 다른 AI에 붙여넣기 (답변은 ④에 저장)</summary><div class="anActs"><button class="chip" data-ancopy' + (ready || AN.pScope !== "module" ? '' : ' disabled') + '>📋 프롬프트 복사</button><button class="chip" data-anprev>프롬프트 보기</button></div><div class="anPrBox" hidden><textarea class="thrText" rows="14" spellcheck="false" readonly></textarea></div>';
  // v12.15 검토 프롬프트 — 틀 분석과 별개로 한 번에 복사해 쓰는 4가지 (앱 숫자 포함)
  h += '<div class="anRevH">검토 프롬프트 <small class="briefDim">틀 분석과 별개 · 앱 숫자를 근거로 넣어요 · 답변은 ④에 저장</small></div><div class="anRev">' +
    '<button class="wbAct" data-anrev="pre"' + (ready ? '' : ' disabled') + '><b>⚠️ 실패 시나리오</b><small>6개월 뒤 -30% 가정 → 원인 3 · 경고 신호 · 가설 폐기 조건</small></button>' +
    '<button class="wbAct" data-anrev="fact"' + (ready ? '' : ' disabled') + '><b>🔍 팩트체크</b><small>리포트·커뮤니티 글을 붙여넣으면 주장별로 앱 숫자와 대조</small></button>' +
    '<button class="wbAct" data-anrev="insp"' + (ready ? '' : ' disabled') + '><b>🧐 검사관 모드</b><small>받은 답변의 숫자·출처·논리 재검토 → 수정표 + 카드형 다시</small></button>' +
    '<button class="wbAct" data-anrev="morn"><b>☕ 아침 3분 브리핑</b><small>내 자산 보유 종목 + 오늘 기사 → 종목별 2~3줄</small></button></div></details>' +
    (typeof smClaude === "function" ? '<div class="anRevAi"><small class="briefDim">추가 검토 · Claude로 바로:</small><button class="chip" data-anrevai="pre"' + (ready ? '' : ' disabled') + '>⚠️ 실패 시나리오</button><button class="chip" data-anrevai="morn">☕ 아침 브리핑</button><button class="chip" data-anrev="fact"' + (ready ? '' : ' disabled') + '>🔍 팩트체크(글 넣기)</button><button class="chip" data-anrev="insp"' + (ready ? '' : ' disabled') + '>🧐 검사관(답변 넣기)</button></div>' : '') +
    '<div class="anRevIn" hidden><textarea class="anAnsIn" rows="6" placeholder=""></textarea><div class="anActs"><button class="primary" data-anrevcopy>📋 프롬프트 복사</button>' + (typeof smClaude === "function" ? '<button class="primary" data-anrevgo>🤖 Claude로 바로</button>' : '') + '<button class="chip" data-anrevclose>닫기</button></div></div>' + anRevOutHtml() + '</section>';
  // ④ 답변
  h += '<section class="anSec"><div class="mkStep"><b>4</b> 저장된 답변 <small class="briefDim">' + (mine.length ? '이 틀 ' + mine.length + '건 저장됨' : '서버에 쌓여 자산이 돼요 · 그때 가격·숫자도 같이 저장') + '</small></div>';
  h += '<details class="anManual"' + (mine.length ? '' : ' open') + '><summary>다른 AI 답변 붙여넣어 저장 (🤖 자동은 저절로 저장돼요)</summary><textarea class="anAnsIn" id="anAnsMain" rows="7" placeholder="AI 답변 전체를 여기에 붙여넣고 [저장]을 누르세요. (## 서술형 / ## 카드형 블록이 있으면 항목·판정·리스크를 자동으로 읽어요)"></textarea><div class="anActs"><button class="primary" data-ansave>💾 저장</button><button class="chip" data-anclear>비우기</button></div></details>';
  if (mine.length) h += '<div class="anAnsList">' + mine.slice(0, 8).map(function (a) { var P = a.text ? anParse(a.text) : Object.assign({ items: [], risks: [], watch: [], paras: [] }, a.p || {}); return '<div class="anAns' + (cur && cur.id === a.id ? ' on' : '') + '" data-anpick="' + a.id + '"><div class="anAnsMain"><b>' + anEsc(a.title) + '</b><small>' + arcD(a.at) + ' · ' + (P.items.length ? "항목 " + P.items.length + "개 · " : "") + (P.paras.length ? "문단 " + P.paras.length + "개" : "서술 없음") + (P.verdict ? ' · 종합 ' + ({ ok: "✓", mid: "△", bad: "✗" })[P.verdictSt || "mid"] : "") + '</small></div><div class="anAnsActs"><button class="chip" data-ancp="' + a.id + '">복사</button><button class="chip" data-andel="' + a.id + '">삭제</button></div></div>'; }).join("") + '</div>';
  h += '</section>';
  // ⑤ 카드
  h += '<section class="anSec' + (cur ? '' : ' dim') + '"><div class="mkStep"><b>5</b> 카드 만들기 <small class="briefDim">' + (cur ? '선택한 답변: ' + anEsc(cur.title) : '저장된 답변을 고르면 만들 수 있어요') + '</small></div>';
  if (cur) { var PP = cur.text ? anParse(cur.text) : Object.assign({ items: [], risks: [], watch: [], paras: [] }, cur.p || {}); if (!cur.text) arcText(cur.id).then(function (t) { if (t) renderAnalyst(); }); h += '<div class="anPrev">' + (PP.one ? '<div class="anPrevOne">' + anEsc(PP.one) + '</div>' : '') + (PP.items.length ? '<div class="anCks">' + PP.items.map(function (x) { return '<div class="anCk ' + x.st + '"><span class="anSt">' + ({ ok: "✓", mid: "△", bad: "✗" })[x.st] + '</span><div><b>' + anEsc(x.name) + '</b><small>' + anEsc(x.key) + (x.num ? ' · ' + anEsc(x.num) : '') + '</small></div></div>'; }).join("") + '</div>' : '<div class="briefDim">카드형 블록을 찾지 못했어요 — 서술형 카드만 만들 수 있어요. (답변에 "## 카드형" 블록이 있는지 확인)</div>') + (PP.verdict ? '<div class="anSum" style="margin-top:8px"><p><b>종합</b> ' + anEsc(PP.verdict) + '</p>' + (PP.counter && PP.counter.length ? '<p><b>반론</b> ' + PP.counter.map(anEsc).join(" · ") + '</p>' : '') + (PP.fix ? '<p><b>보완</b> ' + anEsc(PP.fix) + '</p>' : '') + (PP.risks.length ? '<p><b>리스크</b> ' + PP.risks.map(anEsc).join(" · ") + '</p>' : '') + (PP.watch.length ? '<p><b>확인할 것</b> ' + PP.watch.map(anEsc).join(" · ") + '</p>' : '') + '</div>' : '') + '</div>';
    h += '<div class="anActs"><button class="wbAct" data-ancard="narr"><b>서술형 카드</b><small>표지 + 읽는 글 ' + Math.max(1, Math.ceil(PP.paras.join("").length / 420)) + '장 + 마무리</small></button><button class="wbAct" data-ancard="card"' + (PP.items.length ? '' : ' disabled') + '><b>카드형</b><small>표지 + 항목 ' + PP.items.length + '장 + 종합 + 마무리</small></button></div>'; }
  h += '</section>';
  // ⑥ 분석 자산
  h += '<section class="anSec" id="anArc"><div class="mkStep"><b>6</b> 분석 자산 <small class="briefDim">' + (ans.length ? ans.length + '건 · 다음 프롬프트의 문맥 · 적중률 · 백업' : '저장한 답변이 여기에 쌓여요') + '</small></div>' + (ans.length ? (typeof arcHtml === "function" ? arcHtml(ans, AN.arcPairs || [], AN.ansId) : '') : '<div class="briefDim" style="font-size:12.5px">아직 기록이 없어요 — ④에서 답변을 저장하면 종목별 기록·그때 vs 지금·적중률이 여기에 생겨요.' + (typeof arcHtml === "function" ? ' <button class="chip" data-arcimp>백업 가져오기</button>' : '') + '</div>') + '</section>';
  h += '<section class="anSec" id="anCal"><div class="mkStep"><b>7</b> 보정 <small class="briefDim">' + (ARC_CAL.data && ARC_CAL.data.n ? '검증 ' + ARC_CAL.data.n + '건 기준' : '검증된 기록이 20일 이상 쌓이면 자동') + '</small><label class="chip anTg" style="margin-left:auto"><input type="checkbox" data-ancal' + (AN.calib !== false ? ' checked' : '') + '> 보정 적용</label></div>' + (ARC_CAL.data && ARC_CAL.data.n ? (typeof arcCalibHtml === "function" ? arcCalibHtml() : '') + '<details class="fdHow"><summary>보정이 하는 일</summary><div>적중률이 낮은 체크리스트 항목의 규칙 가중치를 낮추고(✓/✗→△, ×½) 프롬프트에 메모해요. 기록이 쌓일수록 정확해져요.</div></details>' : '') + '</section>';
  h += anRetroHtml();   // v12.40
  root.innerHTML = h;
  // bind
  Array.prototype.forEach.call(root.querySelectorAll("[data-anmod]"), function (b) { b.onclick = function () { AN.mod = b.getAttribute("data-anmod"); AN.out = null; AN.err = null; AN.ansId = null; AN.step = 1; renderAnalyst(); var mm = anMod(); if (mm.need !== "stock" || AN.sym) anRun(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-ansym]"), function (b) { b.onclick = function () { AN.sym = b.getAttribute("data-ansym"); AN.ansId = null; anRun(); }; });
  var inp = document.getElementById("anSym"), res = document.getElementById("anSymRes");
  if (inp) {
    inp.addEventListener("input", function () { var hits = typeof searchDict === "function" && typeof TICKER_DICT !== "undefined" ? searchDict(TICKER_DICT, inp.value).filter(function (x) { return !/^\^|=X$/.test(x.symbol); }).slice(0, 6) : []; if (!inp.value.trim() || !hits.length) { res.style.display = "none"; return; } res.innerHTML = hits.map(function (x) { return '<div class="hRes" data-s="' + x.symbol + '"><b>' + anEsc(x.name) + '</b> <small>' + x.symbol + '</small></div>'; }).join(""); res.style.display = "block"; Array.prototype.forEach.call(res.querySelectorAll("[data-s]"), function (d) { d.onmousedown = function (e) { e.preventDefault(); res.style.display = "none"; inp.value = ""; AN.sym = d.getAttribute("data-s"); AN.ansId = null; anRun(); }; }); });
    inp.addEventListener("blur", function () { setTimeout(function () { res.style.display = "none"; }, 150); });
  }
  var tg = root.querySelector("[data-antg]"); if (tg) tg.onclick = function () { AN.showData = AN.showData === false ? true : false; renderAnalyst(); };
  // v12.15 검토 프롬프트
  var revIn = root.querySelector(".anRevIn"), revTa = revIn && revIn.querySelector("textarea"), revKind = null;
  Array.prototype.forEach.call(root.querySelectorAll("[data-anrev]"), function (b) { b.onclick = function () {
    revKind = b.getAttribute("data-anrev");
    if (revKind === "pre") { anCopy(anPromptPremortem(O), b); revIn.hidden = true; return; }
    if (revKind === "morn") { anCopy(anPromptMorning(), b); revIn.hidden = true; return; }
    revIn.hidden = false; revTa.value = revKind === "insp" && cur && cur.text ? cur.text : ""; revTa.placeholder = revKind === "fact" ? "검증할 리포트·커뮤니티 글·기사를 여기에 붙여넣고 [프롬프트 복사]" : "재검토할 AI 답변을 여기에 붙여넣고 [프롬프트 복사] (④에서 고른 답변이 있으면 자동으로 들어가요)"; revTa.focus();
  }; });
  var rc = root.querySelector("[data-anrevcopy]"); if (rc) rc.onclick = function () { anCopy(revKind === "fact" ? anPromptFactcheck(O, revTa.value.trim()) : anPromptInspector(O, revTa.value.trim()), rc); };
  var rg = root.querySelector("[data-anrevgo]"); if (rg) rg.onclick = function () { if (!revKind) return; anRevRun(revKind, revKind === "fact" ? anPromptFactcheck(O, revTa.value.trim()) : anPromptInspector(O, revTa.value.trim()), rg); };   // v12.40
  Array.prototype.forEach.call(root.querySelectorAll("[data-anrevai]"), function (b) { b.onclick = function () { var k = b.getAttribute("data-anrevai"); anRevRun(k, k === "pre" ? anPromptPremortem(O) : anPromptMorning(), b); }; });
  var rvs = root.querySelector("[data-anrevsave]"); if (rvs) rvs.onclick = function () { rvs.disabled = true; anAnsAdd(AN_REV_OUT.text + (AN_REV_OUT.sources.length ? "\n\n## 참고 링크\n" + AN_REV_OUT.sources.map(function (s) { return "- " + s.t + " " + s.u; }).join("\n") : "")).then(function () { AN.step = 5; AN_REV_OUT = null; AN.arcPairs = null; renderAnalyst(); }); };
  var rvc = root.querySelector("[data-anrevcp]"); if (rvc) rvc.onclick = function () { anCopy(AN_REV_OUT.text, rvc); };
  var rvx = root.querySelector("[data-anrevx]"); if (rvx) rvx.onclick = function () { AN_REV_OUT = null; renderAnalyst(); };
  var rtb = root.querySelector("[data-anretro]"); if (rtb) rtb.onclick = function () { anRetroRun(rtb); };
  var rto = root.querySelector("[data-anretrooff]"); if (rto) rto.onclick = function () { if (!confirm("다음 분석 프롬프트에서 회고 주의점을 뺄까요?")) return; AN_RETRO = null; try { localStorage.removeItem("sm.retroRules"); } catch (e) {} renderAnalyst(); };
  var rx = root.querySelector("[data-anrevclose]"); if (rx) rx.onclick = function () { revIn.hidden = true; };
  Array.prototype.forEach.call(root.querySelectorAll('input[name="anScope"]'), function (r) { r.onchange = function () { AN.pScope = r.value; renderAnalyst(); }; });
  function buildPrompt(cb) {
    var msg = root.querySelector(".anPrMsg"), ctxP = AN.useCtx !== false && typeof arcContext === "function" ? arcContext(m.need === "stock" ? AN.sym : null, m.need === "stock" ? null : m.id, 3) : Promise.resolve("");
    if (AN.pScope === "module") { ctxP.then(function (ctx) { cb(anPromptModule(m, O, { ctx: ctx })); }); return; }
    if (!AN.sym) { alert("종목 풀세트는 먼저 종목을 골라 주세요(01~04 틀 중 하나에서)."); return; }
    if (msg) msg.textContent = "여러 틀 데이터를 모으는 중…";
    Promise.all([anAllOuts(AN_MODS.filter(function (x) { return AN.pScope === "all" || x.need === "stock"; })), AN.useCtx !== false ? arcContext(AN.sym, null, 4) : ""]).then(function (r) { var outs = r[0]; outs._ctx = r[1] || ""; if (msg) msg.textContent = ""; cb(AN.pScope === "all" ? anPromptAll(outs) : anPromptFull(outs)); }).catch(function (e) { if (msg) msg.textContent = ""; alert("데이터를 모으지 못했어요: " + e.message); });
  }
  var cx = root.querySelector("[data-anctx]"); if (cx) cx.onchange = function () { AN.useCtx = cx.checked; };
  var cal = root.querySelector("[data-ancal]"); if (cal) cal.onchange = function () { AN.calib = cal.checked; renderAnalyst(); };
  var cp = root.querySelector("[data-ancopy]"); if (cp) cp.onclick = function () { buildPrompt(function (t) { anCopy(t, cp); AN.step = Math.max(AN.step, 4); var box = root.querySelector(".anPrBox"); if (box && !box.hidden) box.querySelector("textarea").value = t; }); };
  var pv = root.querySelector("[data-anprev]"); if (pv) pv.onclick = function () { var box = root.querySelector(".anPrBox"); if (!box.hidden) { box.hidden = true; return; } buildPrompt(function (t) { box.hidden = false; box.querySelector("textarea").value = t; }); };
  var au = root.querySelector("[data-anauto]"); if (au) au.onclick = function () { if (AN.auto && AN.auto.busy) return; buildPrompt(function (t) { anAutoRun(t, O); }); };   // v12.39
  var sv = root.querySelector("[data-ansave]"); if (sv) sv.onclick = function () { var ta = document.getElementById("anAnsMain"); if (!ta.value.trim()) { alert("붙여넣은 답변이 비어 있어요."); return; } sv.textContent = "저장 중…"; sv.disabled = true; anAnsAdd(ta.value).then(function () { AN.step = 5; AN.arcPairs = null; renderAnalyst(); var sec = document.querySelectorAll("#anBody .anSec")[4]; if (sec) try { sec.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {} }); };
  var cl = root.querySelector("[data-anclear]"); if (cl) cl.onclick = function () { document.getElementById("anAnsMain").value = ""; };   // v12.39 ③ 검토 입력칸과 헷갈리던 것
  Array.prototype.forEach.call(root.querySelectorAll("[data-anpick]"), function (b) { b.onclick = function (e) { if (e.target.closest("button")) return; AN.ansId = b.getAttribute("data-anpick"); AN.step = 5; renderAnalyst(); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-ancp]"), function (b) { b.onclick = function () { arcText(b.getAttribute("data-ancp")).then(function (t) { anCopy(t, b); }); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-andel]"), function (b) { b.onclick = function () { if (!confirm("이 기록을 지울까요? (서버에서도 지워져요)")) return; var id = b.getAttribute("data-andel"); arcDel(id); if (AN.ansId === id) AN.ansId = null; AN.arcPairs = null; renderAnalyst(); }; });
  if (typeof arcBind === "function") arcBind(root, function () { renderAnalyst(); });
  Array.prototype.forEach.call(root.querySelectorAll("[data-arcpick]"), function (b) { b.onclick = function (e) { if (e.target.closest("button,select,label")) return; var id = b.getAttribute("data-arcpick"), it = anAnsLoad().filter(function (x) { return x.id === id; })[0]; if (!it) return; AN.ansId = id; if (it.mod && it.mod !== AN.mod) { AN.mod = it.mod; AN.out = null; } if (it.sym) AN.sym = it.sym; AN.step = 5; renderAnalyst(); var mm = anMod(); if (!AN.out && (mm.need !== "stock" || AN.sym)) anRun(); }; });
  if (AN.arcPairs == null && ans.length && typeof arcVerifyAll === "function") { AN.arcPairs = []; arcVerifyAll(ans.filter(function (x) { return x.sym && x.snap && x.snap.price != null; }).slice(0, 120)).then(function (P) { AN.arcPairs = P; try { arcCalib(P); } catch (e) {} renderAnalyst(); }); }
  Array.prototype.forEach.call(root.querySelectorAll("[data-ancard]"), function (b) { b.onclick = function () { if (cur) anMakeCards(cur, b.getAttribute("data-ancard"), b); }; });
}
function analystGo(mod, sym) { if (mod) AN.mod = mod; if (sym) AN.sym = sym; if (typeof navTo === "function") navTo("analyst"); else switchTab("analyst"); anRun(); }
