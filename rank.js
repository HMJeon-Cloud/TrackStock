/* ============================================================
   v13.40 종목 순위 (rank.js) — 운영자 전용
   목적: 데이터상 '좋은 종목이면서 지금 사기 좋은 자리'인 종목을 찾는다.
   5가지 기법 묶음마다 0~100점을 매기고, 가중 평균으로 최종 점수 → 순위.
     ① 가격 · 기술    RSI · 이동평균 배열 · 최근 수익 · 변동성 · 지금 낙폭의 위치
     ② 과거 사례      큰 하락 뒤 회복 · 200주선/200일선 이탈 뒤 1년 · 닮은 과거
     ③ 낙폭 · 단계    자기 하락 분포에서 지금이 얼마나 드문 깊이인가 · 그 깊이에서 샀을 때 · 기회 구간
     ④ 기업 · 본질    장기 연수익 · 3년 보유 승률 · ROE · 마진 · 매출/이익 성장 · PER
     ⑤ 시장 · 매크로  VIX · 금리 방향 · 장기 금리 · 환율
   점수의 재료는 기존 평가표(egScore)의 항목과 낙폭 분석(dd.js)이다. 항목마다 값 · 점수 · 이유가 붙는다.
   종목을 누르면 상세(항목별 점수와 이유), '리포트 만들기'는 우상향연구소 틀의 슬라이드로 연다.
   새 api 함수 없음. 과거 통계이며 매수 권유가 아니다.
   ============================================================ */
var RK = { res: null, run: false, done: 0, total: 0, mk: "all", body: true, noLev: true, q: "", sort: "t", live: {}, sel: null };
var RK_G = [
  { id: "g1", no: "①", n: "가격 · 기술", w: 15, what: "지금 가격의 흐름과 위치를 봐요. RSI(과열 · 침체), 이동평균 배열, 최근 3개월 · 1년 수익, 변동성, 그리고 지금 낙폭이 이 종목의 역사에서 어느 정도인지.", get: "지금 흐름이 오르는 쪽인지, 과열인지, 평소보다 싼 자리인지" },
  { id: "g2", no: "②", n: "과거 사례", w: 20, what: "비슷한 일이 있었을 때 그 뒤를 봐요. 큰 하락(-20% 이상)을 몇 번 겪고 몇 번 회복했는지, 200주선 · 200일선 아래로 내려간 뒤 1년, 지금과 닮은 자리 뒤 1년.", get: "위기마다 돌아온 종목인지, 지금 같은 자리가 과거에 기회였는지" },
  { id: "g3", no: "③", n: "낙폭 · 단계", w: 30, what: "이 종목 자신의 하락 사건 분포로 지금 깊이를 재요. 매수 5단계 중 어디인지, 이 깊이까지 간 사건이 얼마나 드문지, 그 깊이에서 샀을 때 1년 뒤, 드문 기회 구간까지의 거리.", get: "지금이 자주 오지 않는 자리인지, 그 자리에서 산 결과가 어땠는지" },
  { id: "g4", no: "④", n: "기업 · 본질", w: 25, what: "길게 들고 갈 이유를 봐요. 전 기간 연평균 수익, 아무 날 사서 3년 뒤 플러스였던 비율, (주식은) ROE · 영업이익률 · 매출과 이익 성장 · PER.", get: "길게 보면 우상향하는 자산인지, 돈을 벌고 늘리고 있는지" },
  { id: "g5", no: "⑤", n: "시장 · 매크로", w: 10, what: "종목 바깥의 환경을 봐요. 공포지수(VIX), 미국 기준금리 방향, 미 10년 금리 변화, 원/달러 환율.", get: "지금 환경이 주식에 우호적인지 — 종목 간 차이는 작고 전체 시기를 가늠하는 용도" }
];
/* 점수가 붙는 항목 목록 — 화면에서 골라 넣고 뺄 수 있다. [키, 묶음(0~4), 짧은 이름, 이름을 알아보는 패턴] */
var RK_I = [
  ["rsi", 0, "RSI", /^RSI/], ["arr", 0, "이동평균 배열", /^이동평균 배열/], ["mom", 0, "최근 3개월 · 1년 수익", /^최근 3개월/], ["vol", 0, "1년 변동성", /^1년 변동성/], ["ddnow", 0, "지금 고점 대비(사상최고가)", /^지금 고점 대비/], ["ddmax", 0, "역대 최대 낙폭 대비", /^역대 최대 낙폭/], ["ddpct", 0, "더 깊이 빠져 있던 날 비율", /^지금보다 더 깊이/], ["ddyr", 0, "한 해 최대 낙폭 평균", /^한 해 최대 낙폭/],
  ["yrs", 1, "관찰 기간", /^관찰 기간/], ["rec", 1, "큰 하락 뒤 회복 횟수", /^큰 하락/], ["rect", 1, "전고점 회복까지 걸린 기간", /^전고점 회복까지/], ["w200", 1, "200주선 대비", /^200주선 대비/], ["w200a", 1, "200주선 이탈 뒤 1년", /^200주선 이탈 뒤/], ["d200a", 1, "200일선 이탈 뒤 1년", /^200일선 이탈 뒤/], ["ana", 1, "닮은 과거 뒤 1년", /^1년 뒤 플러스였던/],
  ["stage", 2, "지금 매수 단계", /^지금 매수 단계/], ["share", 2, "이번 깊이까지 간 사건 비율", /^이번 하락 깊이/], ["entry", 2, "지금 깊이에서 샀을 때 1년 후", /^지금 깊이\(/], ["opp", 2, "드문 기회 구간 안인가", /^드문 기회 구간\(/], ["opp1", 2, "기회 구간에서 샀을 때 1년 후", /^기회 구간에서 샀을 때/], ["ytd", 2, "연초 대비", /^연초 대비/],
  ["cagr", 3, "전 기간 연평균 수익", /^전 기간 연평균/], ["win3", 3, "3년 보유 플러스 비율", /^아무 날 사서 3년/], ["roe", 3, "ROE", /^ROE/], ["margin", 3, "영업이익률", /^영업이익률/], ["revg", 3, "매출 성장", /^매출 성장/], ["opg", 3, "영업이익 성장", /^영업이익 성장/], ["per", 3, "PER", /^PER/],
  ["vix", 4, "공포지수(VIX)", /^공포지수/], ["fed", 4, "미국 기준금리 방향", /^미국 기준금리/], ["us10", 4, "미 10년 금리", /^미 10년/], ["krw", 4, "원/달러", /^원\/달러/]
];
var RK_FUND = ["roe", "margin", "revg", "opg", "per"];
/* 평가 기준 — 항목마다 [점수 매기는 기준, 왜 그렇게 보나]. 점수는 0~100, 높을수록 '사기 좋은 쪽' */
var RK_CRIT = {
  rsi: ["30 이하 85 · 45 이하 70 · 60 이하 60 · 70 이하 48 · 그 위 30", "많이 팔린 상태(침체)일수록 높게, 과열일수록 낮게"],
  arr: ["정배열 78 · 혼조 55 · 역배열 38", "20 · 60 · 200일선이 차례로 위에 있으면 오르는 흐름"],
  mom: ["1년 수익 +30% 이상 80 · +10% 이상 70 · 0% 이상 58 · -20% 이상 45 · 그 아래 32", "1년 흐름이 좋을수록 높게 — 싸졌지만 계속 떨어지는 종목을 걸러요"],
  vol: ["연 변동성 18% 이하 88 · 30% 이하 70 · 50% 이하 50 · 80% 이하 32 · 그 위 18", "흔들림이 작을수록 버티기 쉬워요"],
  ddnow: ["사상최고가 대비 -50% 이상 95 · -35% 88 · -20% 75 · -10% 60 · -3% 45 · 그보다 얕으면 32", "많이 내려와 있을수록 싼 자리"],
  ddmax: ["30 + 65 × (지금 낙폭 ÷ 역대 최대 낙폭)", "역대 최악에 가까울수록 높게 (지금 고점 대비와 겹치는 항목 — 기본으로 꺼 둠)"],
  ddpct: ["30 + 65 × (1 − 지금보다 더 깊이 빠져 있던 날의 비율)", "지금 깊이가 드물수록 높게 (지금 고점 대비와 겹치는 항목 — 기본으로 꺼 둠)"],
  ddyr: ["한 해 최대 낙폭 평균이 -13%보다 얕으면 90 · -22%까지 75 · -35%까지 58 · -50%까지 40 · 그보다 깊으면 25", "해마다 덜 빠지는 종목일수록 높게"],
  yrs: ["기록 20년 이상 100 · 12년 85 · 7년 65 · 4년 45 · 그 미만 25", "오래 살아남은 기록일수록 믿을 수 있어요"],
  rec: ["35 + 65 × (회복한 횟수 ÷ 큰 하락 횟수) × min(1, 회복 횟수 ÷ 3) · 큰 하락이 없었으면 55", "-20% 넘는 하락을 겪고 전고점까지 돌아온 비율 — 사례가 3번 미만이면 덜 쳐줘요"],
  rect: ["회복까지 중앙값 1년 이하 100 · 2년 이하 80 · 4년 이하 55 · 그 위 30", "빨리 회복한 종목일수록 높게"],
  w200: ["200주선 대비 -20% 이하 95 · 0% 이하 86 · +15% 이하 68 · +40% 이하 50 · +80% 이하 36 · 그 위 24", "4년 평균 가격보다 쌀수록 높게"],
  w200a: ["35 + 60 × (이탈 뒤 1년 플러스 비율) × min(1, 사례 수 ÷ 4)", "200주선 아래로 내려간 뒤 1년이 좋았던 종목인가 — 사례가 적으면 덜 쳐줘요"],
  d200a: ["35 + 60 × (이탈 뒤 1년 플러스 비율) · 사례 3번 이상일 때만", "200일선이 깨진 뒤에도 1년 안에 회복했던 종목인가"],
  ana: ["닮은 자리 뒤 1년 플러스였던 비율(%) 그대로", "지금과 낙폭 · 추세가 비슷했던 과거 뒤의 결과"],
  stage: ["단계 밖 30 · 1단계 55 · 2단계 68 · 3단계 78 · 4단계 88 · 5단계 95", "이 종목 자신의 하락 분포에서 깊은 단계일수록 높게"],
  share: ["30 + 65 × (1 − 이번 깊이까지 간 사건의 비율)", "이번 하락이 이 종목에서 드문 깊이일수록 높게 (하락 사건 중일 때만)"],
  entry: ["30 + 65 × (그 깊이에서 산 뒤 1년 플러스 비율) · 사례 3번 이상일 때만", "지금 깊이에서 샀던 과거의 결과"],
  opp: ["지금 가격이 기회 구간 안이면 95 · 밖이면 점수 없음", "사건의 약 10%만 닿은 깊이 안에 있는가"],
  opp1: ["구간 안일 때만: 30 + 65 × (기회 구간에서 산 뒤 1년 플러스 비율) · 사례 3번 이상", "기회 구간에서 산 과거의 결과"],
  ytd: ["평년 최저보다 낮으면 82 · 평년 최저의 절반보다 낮으면 66 · 연초보다 낮으면 52 · 연초보다 높으면 40", "올해 들어 평년보다 많이 빠졌는가"],
  cagr: ["전 기간 연평균 +12% 이상 100 · +8% 85 · +5% 68 · +2% 50 · 0% 이상 35 · 마이너스 12", "길게 보면 우상향하는 자산인가"],
  win3: ["아무 날 사서 3년 뒤 플러스였던 비율(%) 그대로", "언제 사도 3년 들고 있으면 됐던 종목인가"],
  roe: ["20% 이상 100 · 15% 90 · 10% 75 · 5% 55 · 0% 초과 35 · 적자 10", "자기자본으로 돈을 잘 버는가"],
  margin: ["영업이익률 25% 이상 100 · 15% 88 · 8% 70 · 3% 50 · 0% 초과 35 · 적자 10", "가격 결정력이 있는 사업인가"],
  revg: ["최근 3개 연도 매출 연평균 +15% 이상 100 · +8% 85 · +3% 65 · 0% 이상 50 · -5% 이상 35 · 그 아래 15", "매출이 커지고 있는가"],
  opg: ["최근 3개 연도 영업이익 연평균 +15% 이상 100 · +8% 85 · +3% 65 · 0% 이상 50 · -10% 이상 30 · 그 아래 12", "이익이 늘고 있는가"],
  per: ["10배 이하 85 · 18배 이하 75 · 28배 이하 60 · 45배 이하 42 · 그 위 25 · 적자 15", "이익에 비해 가격이 낮을수록 높게"],
  vix: ["30 이상 62 · 20~30 50 · 20 미만 60", "공포 구간은 과거에 나눠 사기 유리했고, 불안이 커지는 구간이 가장 낮아요"],
  fed: ["마지막 변경이 인하 70 · 동결 55 · 인상 40", "금리를 내리는 시기가 주식에 대체로 우호적"],
  us10: ["1년 전보다 0.3%p 넘게 내렸으면 68 · 0.5%p 넘게 올랐으면 40 · 그 사이 55", "장기 금리가 내려오면 주식 가격에 우호적"],
  krw: ["1년 평균보다 5% 넘게 높으면 40 · 5% 넘게 낮으면 68 · 그 사이 55 (국내 종목은 해당 없음)", "환율이 높을 때 달러 자산을 사면 환율이 내려올 때 수익이 깎여요"]
};
var RK_DEF_OFF = ["ddmax", "ddpct"];   // '지금 고점 대비'와 같은 것을 다시 세는 항목 — 낙폭 하나가 ① 점수를 좌우하지 않게 기본으로 뺀다
var RK_LV = [[80, "매우 좋음"], [68, "좋음"], [55, "보통"], [42, "주의"], [0, "나쁨"]];
function rkKey(g, name) { for (var i = 0; i < RK_I.length; i++) if (RK_I[i][1] === g && RK_I[i][3].test(name)) return RK_I[i][0]; return null; }
function rkOff() { if (RK._off) return RK._off; var o = {}, raw = null; try { raw = localStorage.getItem("sm.rank.off"); } catch (e) {} try { (raw == null ? RK_DEF_OFF : JSON.parse(raw) || []).forEach(function (k) { o[k] = 1; }); } catch (e) {} return (RK._off = o); }
function rkOffSave(o) { RK._off = o; try { localStorage.setItem("sm.rank.off", JSON.stringify(Object.keys(o))); } catch (e) {} }
/* 항목 점수표(키 → 점수)에서 고른 항목만으로 묶음 점수를 낸다 */
/* ---------- 분류(섹터)와 분위기 ----------
   분류: 브리핑의 테마 묶음(BRIEF_THEMES)을 그대로 쓴다. 없는 종목은 '기타'.
   분위기: 200일선 위에 있는 종목의 비율로 본다 — 65% 이상 상승장, 35% 이하 하락장, 그 사이 혼조.
           같은 분류 종목이 4개 이상이면 그 분류의 분위기를, 아니면 그 시장(국내 · 미국 · 코인)의 분위기를 쓴다.
   잣대: ① 가격 · 기술 안에는 방향이 반대인 항목이 같이 있다(오를수록 좋은 '추세' vs 빠질수록 좋은 '낙폭').
         상승장에서는 추세 항목만, 하락장에서는 낙폭 항목만 써서 지금 장에 맞는 쪽으로 본다. 혼조면 둘 다 쓴다. */
var RK_FIT = { up: ["ddnow", "ddmax", "ddpct"], down: ["arr", "mom"], mid: [] };
var RK_MOODN = { up: "상승장", down: "하락장", mid: "혼조" };
function rkFitOn() { var v = null; try { v = localStorage.getItem("sm.rank.fit"); } catch (e) {} return v !== "0"; }
function rkSec(sym) { if (!RK._sec) { RK._sec = {}; try { (typeof BRIEF_THEMES !== "undefined" ? BRIEF_THEMES : []).forEach(function (t) { t[1].forEach(function (x) { if (!RK._sec[x]) RK._sec[x] = t[0]; }); }); } catch (e) {} } return RK._sec[sym] || null; }
function rkMk(s) { return /\.K[SQ]$/.test(s) ? "kr" : /-USD$/.test(s) ? "coin" : "us"; }
function rkMoodOf(up, n) { if (!n) return "mid"; var p = up / n; return p >= 0.65 ? "up" : p <= 0.35 ? "down" : "mid"; }
/* rows: [{s, u(200일선 위 1/0)}] → { mk:{kr:{up,n,mood}}, sec:{반도체:{...}}, of(sym) } */
function rkMoods(rows) {
  var mk = {}, sec = {}, add = function (o, k, u) { if (!o[k]) o[k] = { up: 0, n: 0 }; o[k].n++; o[k].up += u ? 1 : 0; };
  rows.forEach(function (r) { if (r.u == null || r.lev) return; add(mk, rkMk(r.s), r.u); var c = rkSec(r.s); if (c) add(sec, c, r.u); });
  [mk, sec].forEach(function (o) { Object.keys(o).forEach(function (k) { o[k].mood = rkMoodOf(o[k].up, o[k].n); o[k].p = o[k].n ? o[k].up / o[k].n : null; }); });
  return { mk: mk, sec: sec, of: function (sym) { var c = rkSec(sym); if (c && sec[c] && sec[c].n >= 4) return { mood: sec[c].mood, by: c + " 분류", p: sec[c].p, n: sec[c].n }; var m = mk[rkMk(sym)]; return m ? { mood: m.mood, by: ({ kr: "국내", us: "미국", coin: "코인" })[rkMk(sym)] + " 시장", p: m.p, n: m.n } : { mood: "mid", by: "", p: null, n: 0 }; } };
}
function rkMoodsNow() { var R = rkLoad(); if (!R) return null; if (RK._moods && RK._moodsAt === R.at) return RK._moods; RK._moods = rkMoods(R.rows); RK._moodsAt = R.at; return RK._moods; }
/* 200일선 위인가 (시세가 220일 이상 있을 때) */
function rkAbove200(sym) { var a = typeof nbHist !== "undefined" ? nbHist[sym] : null; if (!a || a.length < 220) return null; var n = a.length, sum = 0; for (var i = n - 200; i < n; i++) sum += a[i].c; return a[n - 1].c >= sum / 200 ? 1 : 0; }
function rkGsOf(map, lev, mood) {
  var off = rkOff(), fo = mood && RK_FIT[mood] ? RK_FIT[mood] : null; if (fo && fo.length) { off = Object.assign({}, off); fo.forEach(function (k) { off[k] = 1; }); }
  var sum = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0], want = 0, have = 0;
  RK_I.forEach(function (I) { if (off[I[0]]) return; want++; var v = map ? map[I[0]] : null; if (v == null) return; have++; sum[I[1]] += v; cnt[I[1]]++; });
  var gs = sum.map(function (v, i) { if (!cnt[i]) return null; var x = Math.round(v / cnt[i]); return lev && (i === 1 || i === 3) ? Math.min(60, x) : x; });
  return { gs: gs, want: want, have: have };
}
function rkBodyOf(gs) { return gs[1] != null && gs[3] != null ? Math.round((gs[1] + gs[3]) / 2) : gs[1] != null ? gs[1] : gs[3]; }
function rkSpotOf(gs) { return gs[0] != null && gs[2] != null ? Math.round((gs[0] + gs[2] * 2) / 3) : gs[2] != null ? gs[2] : gs[0]; }
function rkVerdict(body, spot) {
  return body == null || spot == null ? ["자료 부족", "고른 항목으로는 체력이나 자리 점수를 매길 수 없어요."]
    : body >= 68 && spot >= 68 ? ["좋은 종목이 싸진 자리", "체력(과거 사례 · 본질)이 검증됐고, 지금 가격은 이 종목의 역사에서 드문 깊이예요. 과거 기록으로는 나눠 모으기 좋았던 구간이에요."]
    : body >= 68 && spot >= 52 ? ["좋은 종목 · 무난한 자리", "체력은 검증됐어요. 가격은 아주 싸지도 비싸지도 않아요 — 정해 둔 적립을 이어 가는 자리예요."]
    : body >= 68 ? ["좋은 종목 · 기다릴 자리", "체력은 검증됐지만 지금 가격은 이 종목의 역사에서 싼 편이 아니에요. 낙폭이 깊어질 때를 기다리는 쪽이 과거엔 유리했어요."]
    : body < 55 && spot >= 68 ? ["싸 보이지만 체력이 약함", "많이 빠졌지만 회복 기록이나 장기 수익이 약해요. 싼 데에 이유가 있을 수 있어요 — 왜 빠졌는지부터 확인하세요."]
    : body < 55 ? ["서두를 이유가 없음", "체력도 자리도 뚜렷한 강점이 없어요."]
    : spot >= 68 ? ["보통 체력 · 싸진 자리", "가격은 드문 깊이지만 체력은 평균 수준이에요. 비중을 작게, 나눠서 보는 편이 맞아요."]
    : ["보통", "뚜렷한 강점도 약점도 없어요."];
}
function rkEsc(s) { return typeof ddEsc === "function" ? ddEsc(s) : String(s == null ? "" : s); }
function rkW() { var o = null; try { o = JSON.parse(localStorage.getItem("sm.rank.w") || "null"); } catch (e) {} return RK_G.map(function (g, i) { var v = o && isFinite(+o[i]) ? +o[i] : g.w; return Math.max(0, Math.min(100, v)); }); }
function rkTotal(gs, ws) { ws = ws || rkW(); var a = 0, b = 0; gs.forEach(function (v, i) { if (v != null && ws[i] > 0) { a += v * ws[i]; b += ws[i]; } }); return b ? Math.round(a / b) : null; }
function rkGrade(t) { if (t == null) return "–"; for (var i = 0; i < RK_LV.length; i++) if (t >= RK_LV[i][0]) return RK_LV[i][1]; return "나쁨"; }
function rkCol(v) { return smScCol(v); }

/* 지금 가격이 드문 기회 구간 안인가 — 기준 깊이가 제대로 잡힌 종목(그 깊이까지 간 사건 3건 이상 · 8% 이상)만 */
function rkInOpp(A) { if (!A || A.none || !A.opp || A.opp.n < 3) return false; var q = A.R.th.filter(function (x) { return Math.abs(x.th - A.tailTh) < 1e-9; })[0]; return !!(q && q.p >= 0.08 && A.cur <= A.tailTh + 1e-9); }
/* ---------- ③ 낙폭 · 단계 항목 ---------- */
function rkDdItems(sym) {
  var A = typeof ddGet === "function" ? ddGet(sym) : null, it = [], P = function (v, d) { return ddPct(v, d); };
  if (!A) return { items: [], note: "낙폭 분석을 할 만큼 시세가 길지 않아요." };
  if (A.none) return { items: [{ n: "지금 매수 단계", v: "하락 사건 없음", p: 30, t: "기록 기간 동안 52주 고점에서 -10% 넘게 빠진 적이 없어요 — 싸게 살 자리는 아니에요" }], note: "" };
  var st = A.stNow, cur = A.cur;
  it.push({ n: "지금 매수 단계 (5단계 중)", v: (st ? st + "단계" : "단계 밖") + " · 52주 고점 대비 " + P(cur), p: [30, 55, 68, 78, 88, 95][st] || 30, t: !st ? "아직 1단계(" + P(A.stages[0].d, 0) + ")에 닿지 않았어요 — 이 종목의 평소 범위 안이에요" : st >= 4 ? "사건 10건 중 1건만 닿은 깊이예요 — 이 종목에서 드문 자리예요" : st >= 2 ? "사건 4건 중 1건쯤이 닿는 깊이예요" : "절반의 하락이 여기까지는 와요 — 흔한 깊이예요" });
  if (A.open && A.share != null) it.push({ n: "이번 하락 깊이까지 간 사건 비율", v: (A.share * 100).toFixed(1) + "% (" + A.R.n + "건 중 " + Math.round(A.share * A.R.n) + "건) · 이번 최저 " + P(A.deepNow), p: Math.round(30 + 65 * (1 - A.share)), t: A.share <= 0.12 ? "이 종목 역사에서 손에 꼽는 깊이예요" : A.share <= 0.35 ? "가끔 있던 깊이예요" : "자주 있던 깊이예요" });
  var e = null; A.ent.forEach(function (x) { if (cur <= x.th + 1e-9) e = x; });
  if (e) it.push({ n: "지금 깊이(" + Math.round(e.th * 100) + "%)에서 샀을 때 1년 후", v: e.n1 ? e.n1 + "번 중 " + Math.round(e.pos * e.n1) + "번 플러스 · 중앙값 " + P(e.r1) + " · 최악 " + P(e.worst) : "1년 뒤 기록 없음", p: e.n1 >= 3 ? Math.round(30 + 65 * e.pos) : null, t: e.n1 < 3 ? "사례가 3번 미만이라 점수에 넣지 않았어요" : e.pos >= 0.6 ? "이 깊이에서 사면 1년 뒤 플러스인 경우가 더 많았어요" : "이 깊이에서 사도 1년 뒤 마이너스가 잦았어요 — 추가 하락(중앙값 " + P(e.more) + ")을 견뎌야 했어요" });
  var O = A.opp;
  if (O && O.n) {
    var s1 = O.st.r1, gap = cur > A.tailTh ? (1 + A.tailTh) / (1 + cur) - 1 : null;
    var inNow = rkInOpp(A);
    it.push({ n: "드문 기회 구간(" + P(A.tailTh, 0) + " 이하)", v: inNow ? "지금 구간 안 — " + A.yrs.toFixed(0) + "년간 " + O.n + "번째" : A.inOpp ? "이번 하락에서 닿았다가 올라옴 — 지금은 밖 (" + P(gap, 0) + " 위)" : "밖 — 그 가격까지 " + P(gap, 0) + " 남음 (과거 " + O.n + "번)", p: inNow ? 95 : null, t: inNow ? "사건의 약 10%만 닿은 깊이에 들어와 있어요" : "지금 가격은 기회 구간 밖이에요 — 참고용(점수 없음)" });
    if (s1.n) it.push({ n: "기회 구간에서 샀을 때 1년 후 (과거)", v: s1.n + "번 중 " + s1.pos + "번 플러스 · 중앙값 " + P(s1.med, 0) + " · 최악 " + P(s1.worst, 0), p: inNow && s1.n >= 3 ? Math.round(30 + 65 * s1.pos / s1.n) : null, t: (inNow ? "" : "지금은 구간 밖이라 점수에 넣지 않았어요. ") + (O.fail.length ? "마이너스였던 " + O.fail.length + "번은 " + ddYrs(O.fail) + "년 고점에서 시작한 하락이었어요" : "기록상 1년 뒤 마이너스는 없었어요") + " · 산 뒤 1년 안 최저 중앙값 " + P(O.lo1.med, 0) });
  }
  var y = A.Y.cur;
  if (y && A.Y.avgLow != null) it.push({ n: "연초 대비 (평년과 비교)", v: P(y.end) + " · 올해 최저 " + P(y.low) + " · 평년 최저 " + P(A.Y.avgLow), p: y.end <= A.Y.avgLow ? 82 : y.end <= A.Y.avgLow / 2 ? 66 : y.end <= 0 ? 52 : 40, t: y.end <= A.Y.avgLow ? "평년에 빠지는 깊이보다 더 내려와 있어요" : y.end <= 0 ? "연초보다 낮지만 평년 범위 안이에요" : "연초보다 올라 있어요 — 연초 기준으로는 싼 자리가 아니에요" });
  if (A.grp.brk.n && A.grp.ok.n) it.push({ n: "200주선을 깬 하락 vs 안 깬 하락", v: "깬 " + A.grp.brk.n + "건 중앙값 " + P(A.grp.brk.depth, 0) + " · 안 깬 " + A.grp.ok.n + "건 " + P(A.grp.ok.depth, 0), p: null, t: "200주선을 깨면 하락이 깊어지는 종목인지 보는 참고 값이에요(점수 없음)" });
  return { items: it, note: A.R.n < 10 ? "하락 사건이 " + A.R.n + "건뿐이라 단계와 비율은 거친 값이에요." : (A.S.synth ? "상장 전 구간은 " + A.S.synth.under + "×" + A.S.synth.lev + " 역산을 붙여 계산했어요." : "") };
}

/* ---------- 5묶음 점수 ---------- */
function rkScore(sym) {
  var S = typeof egScore === "function" ? egScore(sym) : null; if (!S) return null;
  var by = {}; S.cats.forEach(function (c) { by[c.id] = c; });
  var take = function (id, f) { return by[id] ? by[id].items.filter(function (x) { return !f || f(x); }) : []; }, isLong = function (x) { return /^전 기간 연평균|^아무 날 사서 3년/.test(x.n); };
  var dd = rkDdItems(sym), notes = function () { return Array.prototype.slice.call(arguments).filter(Boolean).join(" "); };
  var G = [
    { items: take("tech").concat(take("mdd")), note: "" },
    { items: take("res", function (x) { return !isLong(x); }).concat(take("ma"), take("ana")), note: S.lev ? "레버리지 상품이라 최대 60점으로 눌렀어요 — 지수가 회복해도 이 상품은 원금이 줄 수 있어요." : "" },
    { items: dd.items, note: dd.note },
    { items: take("res", isLong).concat(take("fund")), note: notes(by.fund ? by.fund.note : (typeof coreIsStock === "function" && coreIsStock(sym) && !S.lev ? "기업 정보(ROE · 성장 · PER)를 아직 받지 못해 장기 수익 기록만으로 계산했어요." : "ETF · 코인 · 레버리지는 재무제표가 없어 장기 수익 기록으로만 봐요."), S.lev ? "레버리지 상품이라 최대 60점으로 눌렀어요." : "") },
    { items: take("mac"), note: by.mac ? "" : "매크로 자료를 받지 못했어요." }
  ];
  var map = {}, off = rkOff(), MD = rkFitOn() && rkMoodsNow() ? rkMoodsNow().of(sym) : null, mood = MD ? MD.mood : null, fo = mood ? RK_FIT[mood] : [];
  G.forEach(function (g, i) { g.items = g.items.map(function (x) { var y = { n: x.n, v: x.v, p: x.p, t: x.t, k: x.p != null ? rkKey(i, x.n) : null }; if (y.k) { map[y.k] = y.p; y.off = !!off[y.k] || fo.indexOf(y.k) >= 0; y.fit = !off[y.k] && fo.indexOf(y.k) >= 0; } else if (y.p != null) y.p = null; return y; }); });
  var gg = rkGsOf(map, S.lev, mood), gs = gg.gs, body = rkBodyOf(gs), spot = rkSpotOf(gs), verdict = rkVerdict(body, spot);
  var all = []; G.forEach(function (g, i) { g.items.forEach(function (x) { if (x.p != null && !x.off) all.push({ g: i, n: x.n, v: x.v, p: x.p, t: x.t }); }); });
  var sorted = all.slice().sort(function (a, b) { return b.p - a.p; });
  return { sym: sym, name: S.name, gs: gs, G: G, map: map, moodD: MD, want: gg.want, have: gg.have, total: rkTotal(gs), body: body, spot: spot, verdict: verdict, strong: sorted.slice(0, 3), weak: sorted.slice(-3).reverse(), lev: !!S.lev, hasFund: S.hasFund, cur: S.cur, asOf: S.asOf, lastC: S.raw.lastC, S: S, A: typeof ddGet === "function" ? ddGet(sym) : null };
}
function rkRow(sym) {
  var R = rkScore(sym); if (!R) return null; var A = R.A, q = null; try { var V = typeof egVerify === "function" ? egVerify(sym) : null; q = V ? V.level : null; } catch (e) {}
  return { s: sym, n: R.name, i: R.map, k: typeof coreIsStock === "function" && coreIsStock(sym) && !R.lev ? 1 : 0, u: rkAbove200(sym), cur: A && !A.none ? A.cur : R.cur, st: A && !A.none ? A.stNow : 0, opp: rkInOpp(A) ? 1 : 0, px: R.lastC, lev: R.lev ? 1 : 0, f: R.hasFund ? 1 : 0, q: q };
}

/* ---------- 기업 정보 보관: 재무는 분기에 한 번 바뀌므로 받은 값을 7일 동안 이 기기에 두고 다시 쓴다 ---------- */
function rkFundStore() { if (RK._fs) return RK._fs; var o = {}; try { o = JSON.parse(localStorage.getItem("sm.rank.fund") || "{}") || {}; } catch (e) {} return (RK._fs = o); }
function rkFundSave() { try { localStorage.setItem("sm.rank.fund", JSON.stringify(RK._fs || {})); } catch (e) {} }
function rkFund(sym) {
  if (typeof coreFund !== "function" || typeof CORE === "undefined") return Promise.resolve(null);
  var st = rkFundStore(), c = st[sym]; if (CORE.fund[sym] === undefined && c && Date.now() - c.at < 7 * 86400e3) { CORE.fund[sym] = c.f; RK.fundHit = (RK.fundHit || 0) + 1; return Promise.resolve(c.f); }
  var had = CORE.fund[sym] !== undefined;
  return coreFund(sym).then(function (F) { if (F && !had) { st[sym] = { at: Date.now(), f: { per: F.per, pbr: F.pbr, roe: F.roe, divY: F.divY, eps: F.eps, revG: F.revG, opG: F.opG, niG: F.niG, revT: F.revT, opT: F.opT, margin: F.margin, rev: F.rev, op: F.op, name: F.name, opNeg: F.opNeg, lastY: F.lastY } }; RK.fundNew = (RK.fundNew || 0) + 1; } return F; }).catch(function () { return null; });
}
/* ---------- 전 종목 계산 ---------- */
function rkLoad() { if (RK.res) return RK.res; try { var v = JSON.parse(localStorage.getItem("sm.rank") || "null"); if (v && v.rows && v.rows[0] && v.rows[0].i) RK.res = v; } catch (e) {} if (!RK.res && !RK.kv && typeof smKvGet === "function") { RK.kv = 1; try { smKvGet("cfg:rank").then(function (v) { if (v && v.rows && v.rows[0] && v.rows[0].i && !RK.res) { RK.res = v; if (typeof currentTab !== "undefined" && currentTab === "rank") renderRank(); } }); } catch (e) {} } return RK.res; }
function rkClean(sym, had) { if (had[sym]) return; delete nbHist[sym]; try { Object.keys(EG.memo).forEach(function (k) { if (k.indexOf(":" + sym + ":") > 0 || k.indexOf(sym + ":") === 0) delete EG.memo[k]; }); Object.keys(DD.memo).forEach(function (k) { if (k.indexOf(sym + ":") === 0) delete DD.memo[k]; }); } catch (e) {} }
function rkRun(onTick) {
  if (RK.run) return Promise.resolve(RK.res); var list = egScanList(), rows = [], had = {}, idx = 0; RK.run = true; RK.done = 0; RK.total = list.length; RK.phase = 1; RK.fundHit = 0; RK.fundNew = 0;
  Object.keys(nbHist).forEach(function (k) { had[k] = 1; }); Object.keys(DD_LEV).forEach(function (k) { had[DD_LEV[k][0]] = 1; });   // 기초 ETF는 역산에 계속 쓰므로 지우지 않는다
  var pre = [egEnsure(["^VIX"]), typeof macroEnsure === "function" ? macroEnsure().catch(function () {}) : null];
  var one = function () {
    if (idx >= list.length) return Promise.resolve(); var sym = list[idx++];
    return ddEnsure(sym).catch(function () {}).then(function () { return typeof egSeamLoad === "function" ? egSeamLoad(sym) : null; }).catch(function () {}).then(function () { try { var r = rkRow(sym); if (r) rows.push(r); } catch (e) { console.warn("rk", sym, e); } rkClean(sym, had); RK.done++; if (onTick) onTick(); }).then(one);
  };
  return Promise.all(pre).then(function () { var ws = []; for (var i = 0; i < 5; i++) ws.push(one()); return Promise.all(ws); }).then(function () {
    /* 2단계: 주식 전부의 기업 정보(네이버)를 받아 ④를 다시 계산 — 상위 일부만 받으면 받은 종목만 점수가 달라져 비교가 안 되므로 */
    RK.phase = 2; var cand = rows.filter(function (r) { return r.k; }), j = 0; RK.total = cand.length; RK.done = 0;
    var two = function () { if (j >= cand.length) return Promise.resolve(); var r = cand[j++]; return Promise.all([ddEnsure(r.s).catch(function () {}), rkFund(r.s)]).then(function () { try { var x = rkRow(r.s); if (x) Object.assign(r, x); } catch (e) {} rkClean(r.s, had); RK.done++; if (onTick) onTick(); }).then(two); };
    return Promise.all([two(), two(), two()]);
  }).then(function () {
    RK.howOpen = 0; rkFundSave();
    RK.res = { day: typeof smKstDay === "function" ? smKstDay() : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), at: Date.now(), rows: rows }; RK.run = false;
    try { localStorage.setItem("sm.rank", JSON.stringify(RK.res)); } catch (e) {}
    if (typeof smKvPut === "function") { try { var W2 = rkW(); smKvPut("cfg:rank", { day: RK.res.day, at: RK.res.at, rows: rows.slice().sort(function (a, b) { return rkTotal(rkGsOf(b.i, b.lev).gs, W2) - rkTotal(rkGsOf(a.i, a.lev).gs, W2); }).slice(0, 200) }); } catch (e) {} }
    return RK.res;
  }).catch(function (e) { RK.run = false; throw e; });
}

/* ---------- 화면: 목록 ---------- */
function rkFlags(r) { var f = [], i = r.i || {}; if (r.q === "bad") f.push(["검증 실패", "warn", "시세에 어긋나는 곳이 있어요 — 흐름 참고용"]); if (i.arr != null && i.arr <= 38) f.push(["내리는 중", "", "20 · 60 · 200일선이 역배열 — 아직 떨어지는 흐름"]); if (i.vol != null && i.vol <= 32) f.push(["흔들림 큼", "", "1년 변동성이 연 50%를 넘어요 — 비중을 작게"]); if (r.k && !r.f) f.push(["기업정보 못 받음", "", "ROE · 성장 · PER 없이 계산했어요"]); if (r.have != null && r.want && r.have / r.want < 0.6) f.push(["자료 적음", "", "고른 항목의 60% 미만으로 계산했어요"]); return f; }
function rkCalc(r, W, M) { var md = M ? M.of(r.s) : null, gg = rkGsOf(r.i, r.lev, md ? md.mood : null), o = Object.assign({}, r); o.md = md; o.sec = rkSec(r.s); o.g = gg.gs; o.want = gg.want; o.have = gg.have; o.t = rkTotal(gg.gs, W); o.b = rkBodyOf(gg.gs); o.v = rkVerdict(o.b, rkSpotOf(gg.gs))[0]; return o; }
function rkAll() { var R = rkLoad(), W = rkW(); if (!R) return []; var M = rkFitOn() ? rkMoodsNow() : null, rows = R.rows.map(function (r) { return rkCalc(r, W, M); }).filter(function (r) { return r.t != null; }); rows.sort(function (a, b) { return b.t - a.t; }); rows.forEach(function (r, i) { r.rank = i + 1; }); return rows; }
function rkRows() {
  var rows = rkAll(), q = RK.q.trim().toLowerCase();
  rows = rows.filter(function (r) { if (RK.mk !== "all" && rkMk(r.s) !== RK.mk) return false; if (RK.kind === "stock" && !r.k) return false; if (RK.kind === "etf" && (r.k || rkMk(r.s) === "coin")) return false; if (RK.noLev && r.lev) return false; if (RK.body && !(r.b >= 60)) return false; if (RK.full && r.have < r.want) return false; if (q && (r.n + " " + r.s).toLowerCase().indexOf(q) < 0) return false; return true; });
  if (RK.sort === "cur") rows.sort(function (a, b) { return (a.cur == null ? 9 : a.cur) - (b.cur == null ? 9 : b.cur); });
  else if (RK.sort !== "t") { var k = +RK.sort.slice(1); rows.sort(function (a, b) { return (b.g[k] == null ? -1 : b.g[k]) - (a.g[k] == null ? -1 : a.g[k]); }); }
  return rows;
}
function rkBar(v) { return '<span class="smBar"><i style="width:' + (v == null ? 0 : v) + '%;background:' + smScCol(v) + '"></i></span>' + smScChip(v); }
function rkListHtml() {
  var R = rkLoad(), W = rkW(), rows = rkRows(), h = '';
  h += '<div class="egBox rkTop"><div class="rkTopL"><b>데이터상 사기 좋은 종목 찾기</b><span>5가지 기법 묶음마다 0~100점 → 가중 평균이 최종 점수예요. 종목을 누르면 항목별 점수와 이유, 리포트를 볼 수 있어요.</span></div><div class="rkTopR">' + (RK.run ? '<span class="rkProg">' + (RK.phase === 2 ? "기업 정보 반영 " : "계산 중 ") + RK.done + " / " + RK.total + '</span>' : '<span class="briefDim' + (R && typeof smKstDay === "function" && R.day !== smKstDay() ? " rkOld" : "") + '">' + (R ? "계산 " + R.day + " · " + R.rows.length + "종목" + (typeof smKstDay === "function" && R.day !== smKstDay() ? " · 오늘 것이 아니에요" : "") : "아직 계산 전") + '</span>') + (R && !RK.run ? '<button data-rkcsv>CSV</button>' : '') + '<button class="primary" data-rkrun' + (RK.run ? " disabled" : "") + '>' + (R ? "다시 계산" : "전 종목 점수 계산") + '</button></div></div>';
  var off = rkOff(), nOn = RK_I.filter(function (I) { return !off[I[0]]; }).length;
  h += '<details class="egBox rkHow"' + (R && !RK.howOpen ? "" : " open") + '><summary>점수에 넣을 항목 고르기 · 비중 <em>' + nOn + ' / ' + RK_I.length + '개 항목 사용 중</em></summary>' +
    '<div class="rkPre"><span>빠르게 고르기</span><button data-rkpre="all">전체</button><button data-rkpre="nofund">기업 정보 빼고 (주식 · ETF · 코인 같은 잣대)</button><button data-rkpre="spot">자리만 (① · ③)</button><button data-rkpre="body">체력만 (② · ④)</button><button data-rkpre="dd">낙폭 · 단계만 (③)</button></div>' +
    '<div class="rkGs">' + RK_G.map(function (g, i) { var its = RK_I.filter(function (I) { return I[1] === i; }), on = its.filter(function (I) { return !off[I[0]]; }).length;
      return '<div class="rkG' + (on ? "" : " none") + '"><div class="h"><label class="all"><input type="checkbox" data-rkgall="' + i + '"' + (on === its.length ? " checked" : "") + '><b>' + g.no + ' ' + g.n + '</b></label><label>비중 <input type="number" min="0" max="100" step="5" value="' + W[i] + '" data-rkw="' + i + '"></label></div><p>' + rkEsc(g.what) + '</p><div class="its">' + its.map(function (I) { return '<label><input type="checkbox" data-rki="' + I[0] + '"' + (off[I[0]] ? "" : " checked") + '>' + rkEsc(I[2]) + '</label>'; }).join("") + '</div><small>얻는 것: ' + rkEsc(g.get) + '</small></div>'; }).join("") + '</div>' +
    '<div class="ddMini"><b>읽는 법</b> "역대 최대 낙폭 대비" · "더 깊이 빠져 있던 날 비율"은 "지금 고점 대비"와 같은 것을 다시 세는 항목이라 기본으로 꺼 뒀어요(켜면 낙폭이 ① 점수를 좌우해요). 체크한 항목만으로 점수를 다시 매겨요(다시 계산할 필요 없이 바로 바뀌어요). 묶음 점수 = 그 묶음에서 고른 항목 점수의 평균, 최종 = 비중으로 가중 평균. 한 묶음의 항목을 모두 빼면 그 묶음은 최종 점수에서 빠져요. 체력 = ②와 ④의 평균. 기업 정보(ROE · 마진 · 성장 · PER)는 주식에만 있어요 — ETF · 코인과 같은 잣대로 비교하려면 "기업 정보 빼고"를, 주식끼리 비교하려면 아래에서 "주식만"을 고르세요. <button class="ghost" data-rkwreset>비중 기본값으로</button></div></details>';
  h += '<details class="egBox rkHow rkCrit"' + (RK.critOpen ? " open" : "") + '><summary>평가 기준표 — 항목마다 점수를 어떻게 매기나</summary><div class="ddMini" style="margin-top:10px"><b>공통</b> 모든 항목은 0~100점이고 높을수록 "사기 좋은 쪽"이에요. 등급: ' + RK_LV.map(function (x, i) { return (i === RK_LV.length - 1 ? RK_LV[i - 1][0] + " 미만" : x[0] + " 이상") + " " + x[1]; }).join(" · ") + '. 사례가 적은 항목은 점수를 덜 주거나 아예 뺐어요. 기준 숫자는 사람이 정한 값이에요.</div>' + RK_G.map(function (g, i) { return '<div class="ddSub">' + g.no + ' ' + g.n + '</div><div class="dxWrap"><table class="dgT"><thead><tr><th>항목</th><th>점수 기준</th><th>왜 이렇게 보나</th><th>사용</th></tr></thead><tbody>' + RK_I.filter(function (I) { return I[1] === i; }).map(function (I) { var c = RK_CRIT[I[0]] || ["", ""]; return '<tr' + (off[I[0]] ? ' class="rkOffR"' : '') + '><td><b>' + rkEsc(I[2]) + '</b></td><td>' + rkEsc(c[0]) + '</td><td>' + rkEsc(c[1]) + '</td><td>' + (off[I[0]] ? "제외" : "사용") + '</td></tr>'; }).join("") + '</tbody></table></div>'; }).join("") + '<div class="ddMini"><b>최종 점수</b> 묶음 점수 = 고른 항목 점수의 평균 → 최종 = Σ(묶음 점수 × 비중) ÷ Σ비중. 체력 = (② + ④) ÷ 2, 자리 = (① + ③×2) ÷ 3. 레버리지 상품은 ② · ④를 최대 60점으로 눌러요. 한 줄 판정: 체력 68 이상 · 자리 68 이상이면 "좋은 종목이 싸진 자리", 체력 55 미만 · 자리 68 이상이면 "싸 보이지만 체력이 약함".</div></details>';
  try { if (typeof rbHtml === "function") h += rbHtml(); } catch (e) { console.warn("rb html", e); }
  if (!R) return h + '<div class="egBox"><div class="briefDim">"전 종목 점수 계산"을 누르면 종목마다 시세를 받고, 주식은 기업 정보까지 전부 받아 점수를 매겨요. 3~6분쯤 걸려요.</div></div>';
  h += '<div class="egBox"><div class="rkFl"><div class="egSeg">' + [["all", "전체"], ["kr", "국내"], ["us", "미국"], ["coin", "코인"]].map(function (x) { return '<button data-rkmk="' + x[0] + '" class="' + (RK.mk === x[0] ? "on" : "") + '">' + x[1] + '</button>'; }).join("") + '</div><div class="egSeg">' + [["all", "모든 종류"], ["stock", "주식만"], ["etf", "ETF · 지수"]].map(function (x) { return '<button data-rkkind="' + x[0] + '" class="' + ((RK.kind || "all") === x[0] ? "on" : "") + '">' + x[1] + '</button>'; }).join("") + '</div><label class="rkChk"><input type="checkbox" data-rkbody' + (RK.body ? " checked" : "") + '> 체력 60점 이상만</label><label class="rkChk"><input type="checkbox" data-rknolev' + (RK.noLev ? " checked" : "") + '> 레버리지 제외</label><label class="rkChk"><input type="checkbox" data-rkfull' + (RK.full ? " checked" : "") + '> 고른 항목이 다 있는 종목만</label><input type="search" placeholder="종목 찾기" value="' + rkEsc(RK.q) + '" data-rkq><span class="briefDim">' + rows.length + '종목</span></div>';
  var M0 = rkMoodsNow(), fit = rkFitOn();
  if (M0) { var mc = function (nm, o) { return '<span class="rkMd ' + o.mood + '" title="200일선 위 ' + o.up + ' / ' + o.n + '종목"><b>' + nm + '</b> ' + RK_MOODN[o.mood] + ' <small>' + Math.round(o.p * 100) + '%</small></span>'; };
    var top = rkAll().filter(function (r) { return !r.lev; }).slice(0, 20), cnt = {}; top.forEach(function (r) { var c = r.sec || (rkMk(r.s) === "coin" ? "코인" : "기타"); cnt[c] = (cnt[c] || 0) + 1; }); var ck = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }), big = ck[0] !== "기타" && cnt[ck[0]] >= 8 ? ck[0] : null;
    h += '<div class="rkMood"><div class="l"><span class="t">지금 분위기 <small>200일선 위에 있는 종목 비율 — 65% 이상 상승장 · 35% 이하 하락장</small></span><div>' + [["kr", "국내"], ["us", "미국"], ["coin", "코인"]].filter(function (x) { return M0.mk[x[0]]; }).map(function (x) { return mc(x[1], M0.mk[x[0]]); }).join("") + '</div><details class="rkSecD"' + (RK.secOpen ? " open" : "") + '><summary>분류별 분위기 ' + Object.keys(M0.sec).filter(function (k) { return M0.sec[k].n >= 4; }).length + '개</summary><div>' + Object.keys(M0.sec).filter(function (k) { return M0.sec[k].n >= 4; }).sort(function (a, b) { return M0.sec[b].p - M0.sec[a].p; }).map(function (k) { return mc(k, M0.sec[k]); }).join("") + '</div></details></div><div class="r"><div class="egSeg">' + [["1", "분위기에 맞는 잣대"], ["0", "고른 항목 그대로"]].map(function (x) { return '<button data-rkfit="' + x[0] + '" class="' + ((fit ? "1" : "0") === x[0] ? "on" : "") + '">' + x[1] + '</button>'; }).join("") + '</div><small>' + (fit ? "상승장인 종목은 ①에서 추세 항목만, 하락장인 종목은 낙폭 항목만 써요. 혼조는 둘 다." : "모든 종목에 같은 항목을 써요.") + '</small></div></div>' +
      '<div class="rkConc' + (big ? " warn" : "") + '"><b>상위 20개 분류</b> ' + ck.map(function (k) { return k + " " + cnt[k]; }).join(" · ") + (big ? ' — ' + big + '에 몰려 있어요. 여러 개를 사도 사실상 한 가지에 거는 셈이라, 분류 전체에 넣을 한도를 먼저 정하세요.' : '') + '</div>'; }
  var th = function (k, t, tip) { return '<th data-rksort="' + k + '" class="' + (RK.sort === k ? "on" : "") + '"' + (tip ? ' title="' + rkEsc(tip) + '"' : '') + '>' + t + '</th>'; };
  h += '<div class="rkLg"><span>점수 색</span>' + RK_LV.map(function (x, i) { return smScChip(x[0] === 0 ? 30 : x[0] + 2) + '<small>' + (i === 0 ? x[0] + " 이상 " : i === RK_LV.length - 1 ? RK_LV[i - 1][0] + " 미만 " : x[0] + "~" + (RK_LV[i - 1][0] - 1) + " ") + x[1] + '</small>'; }).join("") + '<small class="briefDim">· 종목을 누르면 항목별 점수와 이유가 열려요</small></div>';
  h += '<div class="dxWrap rkWrap"><table class="dgT rkT"><thead><tr><th>종목</th>' + th("t", "최종") + RK_G.map(function (g, i) { return th("g" + i, g.no + " " + g.n.split(" · ")[0], g.n + " — " + g.what); }).join("") + th("cur", "고점 대비", "52주 고점 대비 — 누르면 많이 빠진 순") + '<th>단계</th><th>한 줄 판정</th><th>주의</th></tr></thead><tbody>' +
    rows.slice(0, 120).map(function (r) { return '<tr data-rksym="' + rkEsc(r.s) + '"><td><span class="rkNo">' + r.rank + '</span><b>' + rkEsc(r.n) + '</b>' + (r.lev ? ' <span class="egTg lev">레버리지</span>' : '') + '<br><small>' + rkEsc(r.s.replace(/\.K[SQ]$/, "")) + ' · ' + (typeof egPx === "function" ? egPx(r.s, r.px) : r.px) + (r.sec ? ' · ' + rkEsc(r.sec) : '') + (r.have < r.want ? ' · 항목 ' + r.have + '/' + r.want : '') + '</small></td><td class="rkTot">' + smScChip(r.t, "lg") + '<small>' + rkGrade(r.t) + '</small></td>' + r.g.map(function (v) { return '<td class="rkC">' + smScChip(v) + '</td>'; }).join("") + '<td>' + ddPct(r.cur, 0) + '</td><td>' + (r.opp ? '<span class="egTg rkOppT">기회 구간</span>' : r.st ? r.st + "단계" : "–") + '</td><td>' + rkEsc(r.v) + '</td><td class="rkFg">' + (function (fl) { return fl.length ? fl.slice(0, 1).map(function (f) { return '<span class="egTg ' + f[1] + '" title="' + rkEsc(f[2]) + '">' + f[0] + '</span>'; }).join(" ") + (fl.length > 1 ? ' <span class="egTg" title="' + rkEsc(fl.slice(1).map(function (f) { return f[0] + " — " + f[2]; }).join(" / ")) + '">+' + (fl.length - 1) + '</span>' : '') : '<span class="briefDim">–</span>'; })(rkFlags(r)) + '</td></tr>'; }).join("") + '</tbody></table></div>' + (rows.length > 120 ? '<div class="briefDim" style="margin-top:6px">위에서 120개만 보여요. 조건이나 검색으로 좁혀 보세요.</div>' : '') + (rows.length ? '' : '<div class="briefDim" style="margin-top:8px">조건에 맞는 종목이 없어요. "체력 60점 이상만"을 끄거나 시장을 바꿔 보세요.</div>') + '</div>';
  return h;
}
function renderRank() {
  var el = document.getElementById("rankBody"); if (!el) return; el.innerHTML = rkListHtml();
  var re = function () { renderRank(); }, q = el.querySelector("[data-rkq]");
  var run = el.querySelector("[data-rkrun]"); if (run) run.onclick = function () { rkRun(function () { var p = document.querySelector("#rankBody .rkProg"); if (p) p.textContent = (RK.phase === 2 ? "기업 정보 반영 " : "계산 중 ") + RK.done + " / " + RK.total; else if (typeof currentTab !== "undefined" && currentTab === "rank") renderRank(); }).then(re, function (e) { console.warn(e); if (typeof toast === "function") toast("점수 계산 중 문제가 생겼어요"); re(); }); re(); };
  Array.prototype.forEach.call(el.querySelectorAll("[data-rkmk]"), function (b) { b.onclick = function () { RK.mk = b.getAttribute("data-rkmk"); re(); }; });
  Array.prototype.forEach.call(el.querySelectorAll("[data-rksort]"), function (b) { b.onclick = function () { RK.sort = b.getAttribute("data-rksort"); re(); }; });
  var c1 = el.querySelector("[data-rkbody]"); if (c1) c1.onchange = function () { RK.body = c1.checked; re(); }; var c2 = el.querySelector("[data-rknolev]"); if (c2) c2.onchange = function () { RK.noLev = c2.checked; re(); };
  if (q) q.oninput = function () { RK.q = q.value; clearTimeout(RK.qt); RK.qt = setTimeout(function () { renderRank(); var n = document.querySelector("#rankBody [data-rkq]"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  Array.prototype.forEach.call(el.querySelectorAll("[data-rkw]"), function (i) { i.onchange = function () { var W = rkW(); W[+i.getAttribute("data-rkw")] = Math.max(0, Math.min(100, +i.value || 0)); try { localStorage.setItem("sm.rank.w", JSON.stringify(W)); } catch (e) {} keep(); }; });
  var keep = function () { RK.howOpen = 1; re(); };
  Array.prototype.forEach.call(el.querySelectorAll("[data-rkfit]"), function (b) { b.onclick = function () { try { localStorage.setItem("sm.rank.fit", b.getAttribute("data-rkfit")); } catch (e) {} RK.live = {}; re(); }; });
  var sd = el.querySelector(".rkSecD"); if (sd) sd.addEventListener("toggle", function () { RK.secOpen = sd.open ? 1 : 0; });
  var cr = el.querySelector(".rkCrit"); if (cr) cr.addEventListener("toggle", function () { RK.critOpen = cr.open ? 1 : 0; });
  var csv = el.querySelector("[data-rkcsv]"); if (csv) csv.onclick = function () { rkCsv(); };
  Array.prototype.forEach.call(el.querySelectorAll("[data-rkkind]"), function (b) { b.onclick = function () { RK.kind = b.getAttribute("data-rkkind"); re(); }; });
  var c3 = el.querySelector("[data-rkfull]"); if (c3) c3.onchange = function () { RK.full = c3.checked; re(); };
  Array.prototype.forEach.call(el.querySelectorAll("[data-rki]"), function (c) { c.onchange = function () { var o = Object.assign({}, rkOff()), k = c.getAttribute("data-rki"); if (c.checked) delete o[k]; else o[k] = 1; rkOffSave(o); keep(); }; });
  Array.prototype.forEach.call(el.querySelectorAll("[data-rkgall]"), function (c) { c.onchange = function () { var o = Object.assign({}, rkOff()), g = +c.getAttribute("data-rkgall"); RK_I.forEach(function (I) { if (I[1] !== g) return; if (c.checked) delete o[I[0]]; else o[I[0]] = 1; }); rkOffSave(o); keep(); }; });
  Array.prototype.forEach.call(el.querySelectorAll("[data-rkpre]"), function (b) { b.onclick = function () { var k = b.getAttribute("data-rkpre"), o = {}, gOn = k === "spot" ? [0, 2] : k === "body" ? [1, 3] : k === "dd" ? [2] : null; RK_I.forEach(function (I) { if (gOn && gOn.indexOf(I[1]) < 0) o[I[0]] = 1; if (k === "nofund" && RK_FUND.indexOf(I[0]) >= 0) o[I[0]] = 1; }); rkOffSave(o); if (k === "spot" || k === "dd") RK.body = false; keep(); }; });
  try { if (typeof rbBind === "function") rbBind(el); } catch (e) { console.warn("rb bind", e); }
  var hw = el.querySelector(".rkHow:not(.rkCrit):not(.rbBox)"); if (hw) hw.addEventListener("toggle", function () { RK.howOpen = hw.open ? 1 : 0; });
  var wr = el.querySelector("[data-rkwreset]"); if (wr) wr.onclick = function () { try { localStorage.removeItem("sm.rank.w"); } catch (e) {} keep(); };
  Array.prototype.forEach.call(el.querySelectorAll("tr[data-rksym]"), function (tr) { tr.onclick = function () { rkOpen(tr.getAttribute("data-rksym")); }; });
}

function rkCsv() {
  var rows = rkRows(), q = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var L = [["순위", "종목", "코드", "최종"].concat(RK_G.map(function (g) { return g.no + g.n; }), ["체력", "52주고점대비(%)", "단계", "기회구간", "판정", "주의", "항목수"]).join(",")];
  rows.forEach(function (r) { L.push([r.rank, q(r.n), r.s, r.t].concat(r.g.map(function (v) { return v == null ? "" : v; }), [r.b == null ? "" : r.b, r.cur == null ? "" : (r.cur * 100).toFixed(1), r.st || "", r.opp ? "Y" : "", q(r.v), q(rkFlags(r).map(function (f) { return f[0]; }).join(" / ")), r.have + "/" + r.want]).join(",")); });
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + L.join("\n")], { type: "text/csv;charset=utf-8" })); a.download = "종목순위_" + (RK.res ? RK.res.day : "") + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/* ---------- 상세 (오른쪽 서랍) ---------- */
function rkLive(sym) {
  return Promise.all([ddEnsure(sym).catch(function () {}), egEnsure(["^VIX"]), typeof macroEnsure === "function" ? macroEnsure().catch(function () {}) : null, rkFund(sym).then(function (F) { rkFundSave(); return F; })])
    .then(function () { return typeof egSeamLoad === "function" ? egSeamLoad(sym) : null; }).catch(function () {}).then(function () { return rkScore(sym); });
}
function rkRankOf(sym) { var a = rkAll(); for (var i = 0; i < a.length; i++) if (a[i].s === sym) return { rank: i + 1, of: a.length }; return null; }
function rkDetailHtml(R) {
  var W = rkW(), rk = rkRankOf(R.sym), tot = rkTotal(R.gs, W), h = '';
  h += '<div class="rkDH"><div><small>' + rkEsc(R.sym.replace(/\.K[SQ]$/, "")) + ' · ' + (typeof egPx === "function" ? egPx(R.sym, R.lastC) : R.lastC) + ' · ' + ddYmd(R.asOf) + ' 기준</small><h3>' + rkEsc(R.name) + '</h3><div class="rkV"><b>' + rkEsc(R.verdict[0]) + '</b> ' + rkEsc(R.verdict[1]) + '</div></div><div class="rkBig"><b>' + (tot == null ? "–" : tot) + '</b><span>' + rkGrade(tot) + (rk ? ' · ' + rk.rank + '위 / ' + rk.of + (function (pc) { return pc <= 50 ? ' (상위 ' + Math.max(1, pc) + '%)' : ' (하위 ' + Math.max(1, 100 - pc) + '%)'; })(Math.round(rk.rank / rk.of * 100)) : '') + '</span></div></div>';
  var Ad = R.A && !R.A.none ? R.A : null; if (Ad && Ad.R.worst) { var lossP = ddPrefs().loss, capP = Math.min(100, lossP / 100 / Math.abs(Ad.R.worst) * 100); h += '<div class="rkCap"><b>비중 상한</b> 계좌에서 이 종목으로 잃어도 되는 한도가 ' + lossP + '%라면 → 비중 ' + capP.toFixed(0) + '% 이하 (과거 최대 낙폭 ' + ddPct(Ad.R.worst, 0) + '가 다시 온다고 가정). 한도는 분석 화면의 "낙폭 · 단계" 탭에서 바꿀 수 있어요.</div>'; }
  if (R.moodD) h += '<div class="rkCap"><b>이 종목에 쓴 잣대</b> ' + rkEsc(R.moodD.by) + ' ' + RK_MOODN[R.moodD.mood] + ' (200일선 위 ' + Math.round((R.moodD.p || 0) * 100) + '% · ' + R.moodD.n + '종목) → ' + (R.moodD.mood === "up" ? "①에서 낙폭 항목은 빼고 추세 항목(이동평균 배열 · 1년 수익)으로 봤어요 — 오르는 장에서는 강한 종목이 계속 강한 편이라서요." : R.moodD.mood === "down" ? "①에서 추세 항목은 빼고 낙폭 항목으로 봤어요 — 다 같이 빠지는 장에서 역배열은 감점 사유가 아니라서요." : "①의 추세 항목과 낙폭 항목을 둘 다 썼어요.") + '</div>';
  h += '<div class="rkAct"><button class="primary" data-rkrep>리포트 만들기</button><button data-rkprompt>Claude용 프롬프트 복사</button><button data-rkdd>낙폭 자료</button><button data-rkan>분석 화면에서 열기</button></div>';
  h += '<div class="rkSum">' + RK_G.map(function (g, i) { return '<a href="#rkg' + i + '" data-rkjump="' + i + '"><span>' + g.no + ' ' + g.n + ' <em>비중 ' + W[i] + '</em></span>' + rkBar(R.gs[i]) + '</a>'; }).join("") + '</div>';
  h += '<div class="briefDim" style="margin:-6px 0 8px">고른 항목 ' + R.want + '개 중 이 종목에 있는 것 ' + R.have + '개로 계산했어요.' + (R.have < R.want ? ' 없는 항목은 빼고 평균을 냈어요.' : '') + '</div><div class="rkSW"><div><b class="up">강점</b>' + R.strong.map(function (x) { return '<p><i>' + x.p + '</i>' + RK_G[x.g].no + ' ' + rkEsc(x.n) + ' — ' + rkEsc(x.v) + '</p>'; }).join("") + '</div><div><b class="dn">약점</b>' + R.weak.map(function (x) { return '<p><i>' + x.p + '</i>' + RK_G[x.g].no + ' ' + rkEsc(x.n) + ' — ' + rkEsc(x.v) + '</p>'; }).join("") + '</div></div>';
  RK_G.forEach(function (g, i) { var G = R.G[i];
    h += '<div class="rkGD" id="rkg' + i + '"><div class="h"><div><b>' + g.no + ' ' + g.n + '</b><p>' + rkEsc(g.what) + '</p></div><div class="sc">' + smScChip(R.gs[i], "lg") + '<small>비중 ' + W[i] + '</small></div></div>' +
      (G.items.length ? '<div class="dxWrap"><table class="dgT"><thead><tr><th>항목</th><th>값</th><th>점수</th><th>왜 이 점수인가</th></tr></thead><tbody>' + G.items.map(function (x) { return '<tr' + (x.off ? ' class="rkOffR"' : '') + '><td><b>' + rkEsc(x.n) + '</b>' + (x.k && RK_CRIT[x.k] ? '<small class="rkCr">기준: ' + rkEsc(RK_CRIT[x.k][0]) + '</small>' : '') + '</td><td>' + rkEsc(x.v) + '</td><td>' + (x.p == null ? '<span class="briefDim">참고</span>' : x.off ? '<span class="briefDim">' + (x.fit ? "잣대 제외" : "제외") + ' (' + x.p + ')</span>' : smScChip(x.p)) + '</td><td>' + rkEsc(x.t || "") + '</td></tr>'; }).join("") + '</tbody></table></div>' : '<div class="briefDim">이 묶음은 자료가 없어 점수에서 빠졌어요.</div>') + (G.note ? '<div class="ddMini">' + rkEsc(G.note) + '</div>' : '') + '</div>'; });
  h += '<div class="briefDim" style="margin:10px 0 4px">과거 통계로 매긴 점수이며 앞으로를 보장하지 않아요. 점수 기준과 비중은 사람이 정한 값이에요. 매수 권유가 아닌 참고 자료예요.</div>';
  return h;
}
function rkOpen(sym) {
  var d = document.getElementById("rkDrawer"); if (!d) { d = document.createElement("div"); d.id = "rkDrawer"; d.innerHTML = '<div class="rkDim"></div><aside><button class="rkX" aria-label="닫기">✕</button><div class="rkDB"></div></aside>'; document.body.appendChild(d); d.querySelector(".rkDim").onclick = d.querySelector(".rkX").onclick = function () { d.classList.remove("on"); document.documentElement.classList.remove("rkOpen"); }; document.addEventListener("keydown", function (e) { if (e.key === "Escape" && d.classList.contains("on") && !document.getElementById("ddDeck")) d.querySelector(".rkX").onclick(); }); }
  var box = d.querySelector(".rkDB"); RK.sel = sym; d.classList.add("on"); document.documentElement.classList.add("rkOpen"); box.innerHTML = '<div class="briefDim" style="padding:30px 0">' + rkEsc(typeof nbName === "function" ? nbName(sym) : sym) + ' — 항목별 점수를 계산하는 중…</div>'; box.scrollTop = 0;
  rkLive(sym).then(function (R) {
    if (RK.sel !== sym) return; if (!R) { box.innerHTML = '<div class="briefDim" style="padding:30px 0">시세가 짧아 점수를 매기지 못했어요.</div>'; return; }
    RK.live[sym] = R; box.innerHTML = rkDetailHtml(R);
    box.querySelector("[data-rkrep]").onclick = function () { rkDeck(sym); };
    box.querySelector("[data-rkdd]").onclick = function () { if (R.A && !R.A.none) ddDeck(sym); else if (typeof toast === "function") toast("낙폭 자료를 만들 하락 사건이 없어요"); };
    box.querySelector("[data-rkan]").onclick = function () { d.classList.remove("on"); document.documentElement.classList.remove("rkOpen"); AN.sym = sym; switchTab("analyst"); };
    box.querySelector("[data-rkprompt]").onclick = function () { var t = rkPrompt(R), ok = function () { if (typeof toast === "function") toast("프롬프트를 복사했어요 — claude.ai에 붙여넣으세요"); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { rkCopyFallback(t); ok(); }); else { rkCopyFallback(t); ok(); } };
    Array.prototype.forEach.call(box.querySelectorAll("[data-rkjump]"), function (a) { a.onclick = function (e) { e.preventDefault(); var t = box.querySelector("#rkg" + a.getAttribute("data-rkjump")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }; });
  }).catch(function (e) { console.warn("rk open", e); box.innerHTML = '<div class="briefDim" style="padding:30px 0">계산하지 못했어요.</div>'; });
}
function rkCopyFallback(t) { var ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;left:-9999px"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }
function rkPrompt(R) {
  var W = rkW(), rk = rkRankOf(R.sym), L = [];
  L.push("아래는 한 종목을 5가지 기법으로 점수화한 앱 데이터야. 종목: " + R.name + " (" + R.sym + ") · 기준일 " + ddYmd(R.asOf) + ". 이 숫자만 근거로 종목 리포트를 써 줘. 모르는 사실은 지어내지 말고 '확인 필요'라고 적어 줘.");
  L.push("\n[최종] " + rkTotal(R.gs, W) + "점 (" + rkGrade(rkTotal(R.gs, W)) + ")" + (rk ? " · " + rk.of + "종목 중 " + rk.rank + "위" : "") + " · 체력 " + R.body + " · 자리 " + R.spot + " · 판정: " + R.verdict[0]);
  RK_G.forEach(function (g, i) { L.push("\n[" + g.no + " " + g.n + "] " + (R.gs[i] == null ? "자료 없음" : R.gs[i] + "점") + " (비중 " + W[i] + ") — " + g.what); R.G[i].items.forEach(function (x) { L.push("- " + x.n + ": " + x.v + " → " + (x.p == null ? "참고" : x.off ? "점수 계산에서 제외(" + x.p + "점)" : x.p + "점") + (x.t ? " (" + x.t + ")" : "")); }); if (R.G[i].note) L.push("  ※ " + R.G[i].note); });
  L.push("\n[써 줄 것]\n1) 한 줄 결론: 데이터상 지금 사기 좋은 종목인가 (좋음 / 기다림 / 피함 중 하나와 이유)\n2) 근거 3가지: 위 항목의 숫자를 인용해서\n3) 반론 2가지: 이 결론이 틀릴 수 있는 이유 — 점수에 안 잡히는 위험 포함\n4) 시나리오: 좋을 때 / 보통 / 나쁠 때 각각 무엇을 보면 알 수 있는지\n5) 행동안: 나눠 사는 단계와 비중 상한, 생각을 바꿀 조건\n쉬운 말로, 숫자는 위에서 준 것만 써 줘. 매수 권유가 아니라 판단 재료로 써 줘.");
  return L.join("\n");
}

/* ---------- 리포트 (우상향연구소 슬라이드 틀) ---------- */
function rkSlides(R) {
  var P = ddPrefs(), W = rkW(), own = P.brand === "우상향연구소", sns = typeof CARD_SNS !== "undefined" ? CARD_SNS : "@uphill.lab", nm = typeof ddNm === "function" ? ddNm({ name: R.name, sym: R.sym }) : R.name, tot = rkTotal(R.gs, W), rk = rkRankOf(R.sym), S = [], A = R.A && !R.A.none ? R.A : null;
  var foot = R.sym + " 일별 종가 (~" + ddYmd(R.asOf) + ")" + (R.hasFund ? " · 재무 네이버 증권" : "") + " · " + P.brand + " 리서치";
  var band = function () { return '<header class="uhBand">' + uhMark(30) + '<b>' + rkEsc(P.brand) + '</b>' + (own ? '<em>UPHILL.LAB</em>' : '') + '<span>' + rkEsc(nm) + ' · 종목 리포트</span><i></i></header>'; };
  var T = function (kick, title, body, cls) { S.push('<section class="ddS ' + (cls || "") + '">' + band() + '<div class="uhHead"><small>' + kick + '</small><h2>' + title + '</h2>' + uhLine() + '</div><div class="ddSB">' + body + '</div><footer><span>' + rkEsc(foot) + '</span><b>' + (own ? rkEsc(sns) : "") + '</b></footer></section>'); };
  var bar = function (v) { return '<u class="rkSBar"><i style="width:' + (v == null ? 0 : v) + '%;background:' + (v == null ? "#ccc" : v >= 70 ? "#c9a24f" : v >= 50 ? "#141414" : "#2f6fd6") + '"></i></u>'; };
  /* 표지 */
  S.push('<section class="ddS uhCover">' + (A ? '<div class="uhCv">' + ddSvgDD(A, 1280, 250, { bare: 1, fg: UH.gold, fill: UH.gold, fillOp: .16 }) + '</div>' : '') + '<div class="uhCvTop">' + uhMark(46) + '<b>' + rkEsc(P.brand) + '</b>' + (own ? '<em>UPHILL.LAB</em>' : '') + '</div><small class="uhCvK">STOCK REPORT · 5가지 기법 종합 평가</small><h1>' + rkEsc(nm) + '</h1><p>' + rkEsc(R.verdict[0]) + '</p><span class="uhCvN">' + rkEsc(R.name) + ' · ' + (typeof egPx === "function" ? egPx(R.sym, R.lastC) : R.lastC) + '</span><div class="uhCvM"><div><small>기준일</small><b>' + ddYmd(R.asOf) + '</b></div><div><small>최종 점수</small><b>' + tot + '점 · ' + rkGrade(tot) + '</b></div><div><small>순위</small><b>' + (rk ? rk.rank + '위 / ' + rk.of + '종목' : '–') + '</b></div><div><small>성격</small><b>참고용 · 매수 권유 아님</b></div></div></section>');
  /* 한 장 결론 */
  T("한 장 결론", rkEsc(nm) + " · <mark>" + tot + "점</mark> — " + rkEsc(R.verdict[0]), '<div class="uhSum"><div class="uhNow"><small>최종 점수 · ' + rkGrade(tot) + '</small><b>' + tot + '</b><span>' + (rk ? rk.of + '종목 중 ' + rk.rank + '위' : '순위는 전 종목 계산 후') + '</span><div><span>체력 (② · ④ 평균)</span><em>' + R.body + '</em><small>좋은 종목인가</small></div><div><span>자리 (① · ③)</span><em>' + R.spot + '</em><small>지금 사기 좋은 가격인가</small></div><div><span>52주 고점 대비</span><em>' + ddPct(A ? A.cur : R.cur, 0) + '</em><small>' + (A ? (rkInOpp(A) ? "드문 기회 구간 안" : A.stNow ? "매수 " + A.stNow + "단계" : "단계 밖") : "") + '</small></div></div><div class="rkSF"><div class="rkSG">' + RK_G.map(function (g, i) { return '<div><span>' + g.no + ' ' + g.n + '<em>비중 ' + W[i] + '</em></span>' + bar(R.gs[i]) + '<b>' + (R.gs[i] == null ? "–" : R.gs[i]) + '</b></div>'; }).join("") + '</div><p class="rkSV">' + rkEsc(R.verdict[1]) + '</p></div></div>');
  /* 강점과 약점 */
  var sw = function (a, cls) { return a.map(function (x) { return '<div class="uhEv"><div class="y ' + cls + '">' + x.p + '</div><div class="m"><b>' + rkEsc(x.n) + '</b><u style="background:#8a92a3">' + RK_G[x.g].no + ' ' + RK_G[x.g].n + '</u><small>' + rkEsc(x.v) + (x.t ? ' — ' + rkEsc(x.t) : '') + '</small></div><em></em></div>'; }).join(""); };
  T("강점과 약점", "점수를 올린 것 3가지, 깎은 것 3가지", '<div class="uhEvG"><div><div class="uhEvH up">강점 — 점수가 가장 높은 항목</div>' + sw(R.strong, "") + '</div><div><div class="uhEvH dn">약점 — 점수가 가장 낮은 항목</div>' + sw(R.weak, "") + '</div></div>', "uhTight rkSW2");
  /* 묶음별 */
  RK_G.forEach(function (g, i) { var G = R.G[i], its = G.items.slice(0, 9); if (!its.length) return;
    T(g.no + " " + g.n, rkEsc(g.n) + " <mark>" + (R.gs[i] == null ? "–" : R.gs[i] + "점") + "</mark> <em>· 비중 " + W[i] + "</em>", '<p class="uhN" style="margin:0 0 10px;font-size:15px">' + rkEsc(g.what) + '</p><table class="uhT rkST"><thead><tr><th>항목</th><th>값</th><th>점수</th><th>왜 이 점수인가</th></tr></thead><tbody>' + its.map(function (x) { return '<tr><td>' + rkEsc(x.n) + '</td><td>' + rkEsc(x.v) + '</td><td>' + (x.p == null ? '<span style="color:#8a92a3">참고</span>' : x.off ? '<span style="color:#8a92a3">제외</span>' : '<b>' + x.p + '</b>') + '</td><td>' + rkEsc(x.t || "") + '</td></tr>'; }).join("") + '</tbody></table>' + (G.note ? '<p class="uhN">' + rkEsc(G.note) + '</p>' : ''), "uhTight"); });
  /* 평가 기준 (부록 2장) */
  var critT = function (gi) { return RK_I.filter(function (I) { return gi.indexOf(I[1]) >= 0 && !rkOff()[I[0]]; }).map(function (I) { var c = RK_CRIT[I[0]] || ["", ""]; return '<tr><td>' + RK_G[I[1]].no + ' ' + rkEsc(I[2]) + '</td><td>' + rkEsc(c[0]) + '</td></tr>'; }).join(""); };
  [[[0, 1], "① 가격 · 기술 / ② 과거 사례"], [[2, 4], "③ 낙폭 · 단계 / ⑤ 시장 · 매크로"], [[3], "④ 기업 · 본질"]].forEach(function (x) { var body = critT(x[0]); if (body) T("평가 기준", "점수는 이렇게 매겼습니다 <em>· " + x[1] + "</em>", '<table class="uhT rkCT"><thead><tr><th>항목</th><th>점수 기준 (0~100, 높을수록 사기 좋은 쪽)</th></tr></thead><tbody>' + body + '</tbody></table>', "uhTight"); });
  /* 낙폭 · 기회 */
  if (A) { var k = ddKpis(A), hold = A.opp.n ? ddHold(A) : [], hl = function (t) { return rkEsc(t).replace(/([+\-]\d[\d.,]*%)/g, '<mark>$1</mark>'); };
    T("낙폭과 기회", rkEsc(ddHead(A)), '<div class="uhCard">' + ddSvgDD(A, 1110, 250, { fg: UH.ink, sub: UH.sub, fill: UH.gold, fillOp: .28, lineCol: UH.up, hi: UH.warm, line: A.tailTh, lineLab: "" }) + '</div><div class="uhMini" style="margin-top:12px">' + A.stages.map(function (s) { return '<div class="' + (A.stNow === s.k ? "now" : A.stMax >= s.k ? "was" : "") + '"><small>' + s.k + '단계 · 사건의 ' + Math.round(s.p * 100) + '%</small><b>' + ddPct(s.d, 0) + '</b></div>'; }).join("") + '</div>' + (hold.filter(Boolean).length ? '<div class="uhHold"><i>버티는 힘</i><div>' + hold.filter(Boolean).map(function (x) { return '<p>' + hl(x) + '</p>'; }).join("") + '</div></div>' : ''), "uhTight"); }
  /* 정리 */
  var chk = R.weak.map(function (x) { return RK_G[x.g].no + " " + x.n + " (" + x.p + "점): " + (x.t || x.v); });
  var flip = []; if (A) { if (A.stages[A.stNow]) flip.push("52주 고점 대비 " + ddPct(A.stages[A.stNow].d, 0) + " (" + ddPx(R.sym, A.openPk.c * (1 + A.stages[A.stNow].d)) + ")에 닿으면 다음 매수 단계"); if (!rkInOpp(A) && A.opp.n) flip.push("드문 기회 구간은 " + ddPct(A.tailTh, 0) + " (" + ddPx(R.sym, A.openPk.c * (1 + A.tailTh)) + ") 아래"); if (A.w200 != null) flip.push("200주선 " + ddPx(R.sym, A.w200) + (R.lastC < A.w200 ? " 위로 올라서는지" : " 아래로 내려가는지")); }
  if (R.gs[3] != null && R.gs[3] < 55) flip.push("④ 기업 · 본질 점수가 낮아요 — 이익이 돌아오는지 다음 실적에서 확인");
  T("정리", "그래서 — <mark>" + rkEsc(R.verdict[0]) + "</mark>", '<div class="uhRow"><aside class="uhDark" style="flex:1.1"><small>판정</small><p style="font-size:17px;color:#fff;margin-top:8px;line-height:1.6">' + rkEsc(R.verdict[1]) + '</p><div><span>최종</span><b class="g">' + tot + '점</b></div><div><span>체력 · 자리</span><b>' + R.body + ' · ' + R.spot + '</b></div></aside><aside class="uhSide" style="flex:1.5"><b>사기 전에 확인할 것 (약점에서)</b>' + chk.map(function (c) { return '<p style="margin:8px 0 0">· ' + rkEsc(c) + '</p>'; }).join("") + (flip.length ? '<b class="sub">생각을 바꿀 가격 · 조건</b>' + flip.slice(0, 4).map(function (c) { return '<p style="margin:8px 0 0">· ' + rkEsc(c) + '</p>'; }).join("") : '') + '</aside></div><p class="uhN">점수는 과거 통계와 사람이 정한 기준 · 비중으로 매긴 값이에요. 뉴스 · 실적 전망 · 수급처럼 점수에 안 잡히는 것은 따로 확인하세요. 과거가 앞으로를 보장하지 않으며, 매수 권유가 아닌 참고 자료입니다.' + (R.lev ? " 레버리지 ETF는 원금 대부분을 잃을 수 있습니다." : "") + '</p>', "uhTight");
  return S;
}
function rkDeck(sym) { var R = RK.live[sym]; if (!R) return; ddDeck(sym, { name: R.name, title: "종목 리포트", tag: "종목리포트", make: function () { return rkSlides(R); } }); }

/* ---------- 탭 등록 ---------- */
(function () {
  if (typeof document === "undefined" || typeof TABS === "undefined") return;
  if (TABS.indexOf("rank") < 0) TABS.push("rank"); if (typeof OWNER_TABS !== "undefined" && OWNER_TABS.indexOf("rank") < 0) OWNER_TABS.push("rank");
  var an = document.getElementById("tab-analyst"); if (an && !document.getElementById("tab-rank")) { var d = document.createElement("div"); d.id = "tab-rank"; d.className = "hidden"; d.innerHTML = '<div class="card"><div class="pgHead"><h2>종목 순위 <small>5가지 기법 점수로 사기 좋은 종목 찾기 — 운영자 전용</small></h2></div><div id="rankBody" style="margin-top:10px"></div></div>'; an.parentNode.insertBefore(d, an); }
  var nb = document.querySelector('.tabs button[data-tab="analyst"]'); if (nb && !document.querySelector('.tabs button[data-tab="rank"]')) { var b = document.createElement("button"); b.setAttribute("data-tab", "rank"); b.className = "ownerOnly"; b.innerHTML = "<i>🏆</i><span>순위</span>"; nb.parentNode.insertBefore(b, nb); b.onclick = function () { switchTab("rank"); }; }
  var s0 = switchTab; switchTab = function (t) { if (t === "rank" && !(typeof isOwner === "function" && isOwner())) t = "home"; var r = s0.apply(this, arguments); try { if (t === "rank") renderRank(); } catch (e) { console.warn(e); } return r; };
  if (typeof ADM !== "undefined") { if (ADM.tabs.indexOf("rank") < 0) ADM.tabs.splice(ADM.tabs.indexOf("analyst"), 0, "rank"); var m = ADM.menu[1]; if (m && !m.items.some(function (x) { return x[0] === "rank"; })) m.items.splice(2, 0, ["rank", "🏆", "종목 순위", "점수로 사기 좋은 종목 찾기"]); ADM.head.rank = ["종목 순위", "5가지 기법 점수로 데이터상 사기 좋은 종목을 찾아요"]; }
  var st = document.createElement("style"); st.id = "rkCss"; st.textContent = [
    "body:has(#tab-rank:not(.hidden)){max-width:1480px}.rkTop{display:flex;gap:14px;justify-content:space-between;align-items:center;flex-wrap:wrap}.rkTopL b{display:block;font-size:16px}.rkTopL span{font-size:13px;color:#5b6474}.rkTopR{display:flex;gap:10px;align-items:center}.rkProg{font-size:13px;font-weight:700;color:#3182f6}",
    ".rkHow summary{cursor:pointer;font-weight:800;font-size:14px}.rkGs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0}.rkG{background:#f6f8fb;border-radius:10px;padding:10px 12px}.rkG .h{display:flex;justify-content:space-between;align-items:center;gap:6px}.rkG b{font-size:14px}.rkG .all{display:flex;gap:6px;align-items:center;cursor:pointer}.rkG.none{opacity:.55}.rkG .its{display:grid;gap:3px;margin:6px 0;padding-top:6px;border-top:1px solid #e3e7ee}.rkG .its label{font-size:12.5px;color:#223;display:flex;gap:6px;align-items:flex-start;white-space:normal;cursor:pointer}.rkG .its input,.rkG .all input{width:auto;margin-top:2px}.rkHow summary em{font-style:normal;font-weight:600;font-size:12.5px;color:#3182f6;margin-left:8px}.rkPre{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}.rkPre span{font-size:12.5px;color:#5b6474;font-weight:700}.rkPre button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid #dfe4ec;background:#fff;border-radius:8px;padding:5px 10px;cursor:pointer}.rkOffR td{opacity:.5}.rkOppT{background:#141414!important;color:#e6c57a!important}.rkG label{font-size:11.5px;color:#5b6474;white-space:nowrap}.rkG input{width:48px;font:inherit;font-size:12.5px;padding:2px 4px;border:1px solid #cfd6e0;border-radius:6px;text-align:right}.rkG p{font-size:12.5px;line-height:1.5;margin:6px 0 4px;color:#334}.rkG small{font-size:11.5px;color:#8a6a1f;line-height:1.4;display:block}",
    ".rkFl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.rkChk{font-size:13px;display:flex;gap:4px;align-items:center;white-space:nowrap}.rkFl input[type=search]{font:inherit;font-size:13px;padding:6px 10px;border:1px solid #cfd6e0;border-radius:8px;width:150px}",
    ".rkWrap{max-height:none;overflow-x:auto}.rkT{min-width:980px}.rkT th,.rkT td{white-space:nowrap}.rkT td:first-child{white-space:nowrap;min-width:200px}.rkT thead th{position:sticky;top:0;background:#fff;z-index:1}.rkFg .egTg{margin-right:2px}.rkLg{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 10px;font-size:12px}.rkLg span{font-weight:700;color:#5b6474}.rkLg small{color:#5b6474;margin-right:8px}.rkLg .smChip{min-width:30px;padding:2px 5px;font-size:11.5px}.rkOld{color:#b9600f!important;font-weight:700}.rkMood{display:flex;gap:14px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px}.rkMood .l{flex:1;min-width:260px}.rkMood .t{display:block;font-size:13px;font-weight:800;margin-bottom:5px}.rkMood .t small{font-weight:500;color:#8a92a3;font-size:11.5px;margin-left:4px}.rkMood .l>div,.rkSecD>div{display:flex;gap:5px;flex-wrap:wrap}.rkSecD{margin-top:6px}.rkSecD summary{cursor:pointer;font-size:12px;color:#5b6474;font-weight:700;margin-bottom:5px}.rkT th,.rkT td{padding-left:8px!important;padding-right:8px!important}.rkT td:first-child small{display:block;max-width:205px;overflow:hidden;text-overflow:ellipsis;margin-left:26px}.rkT td:first-child br{display:none}.rkMd{font-size:12px;border-radius:8px;padding:3px 8px;background:#eef1f5;color:#445;white-space:nowrap}.rkMd b{font-weight:800}.rkMd small{opacity:.75}.rkMd.up{background:#e3f4e6;color:#176b36}.rkMd.down{background:#fde7e7;color:#a12b2b}.rkMood .r{text-align:right}.rkMood .r small{display:block;font-size:11.5px;color:#5b6474;margin-top:4px;max-width:330px}.rkConc{font-size:12.5px;background:#f6f8fb;border-radius:8px;padding:7px 12px;margin-bottom:10px;line-height:1.5}.rkConc.warn{background:#fff6e8;border-left:4px solid #b9600f}.rkTopR button:not(.primary){font:inherit;font-size:12.5px;font-weight:700;border:1px solid #dfe4ec;background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer}.rkCr{display:block;font-size:11px;color:#8a92a3;font-weight:500;line-height:1.45;margin-top:3px;white-space:normal}.rkCap{background:#f6f8fb;border-left:4px solid #141414;border-radius:8px;padding:8px 12px;font-size:12.5px;line-height:1.55;margin:10px 0 0}.rkCrit .dgT td{font-size:12.5px;line-height:1.5;vertical-align:top}.rkCrit .dgT td:nth-child(1),.rkCrit .dgT td:nth-child(4),.rkCrit .dgT th{white-space:nowrap}.rkCrit .dgT td:nth-child(4){text-align:center;width:1%}.rkCrit .dgT td:nth-child(2){min-width:300px}.rkT th[data-rksort]{cursor:pointer;white-space:nowrap}.rkT th.on{color:#3182f6}.rkT th.on::after{content:' ▼';font-size:9px}.rkT tbody tr{cursor:pointer}.rkT tbody tr:hover td{background:#f3f7ff}.rkNo{display:inline-block;min-width:26px;color:#8a92a3;font-weight:700;font-size:12px}.rkT td small{color:#8a92a3;font-size:11.5px;margin-left:26px}.rkTot small{display:block;margin:3px 0 0!important}.rkT td.rkC{white-space:nowrap}.rkT td.rkC{text-align:center}.rkT td:nth-last-child(2),.rkT td:nth-last-child(3){white-space:nowrap}.rkT th[data-rksort]{text-align:center}",
    "html.rkOpen{overflow:hidden}#rkDrawer{position:fixed;inset:0;z-index:8000;display:none}#rkDrawer.on{display:block}.rkDim{position:absolute;inset:0;background:rgba(10,14,22,.45)}#rkDrawer aside{position:absolute;top:0;right:0;bottom:0;width:min(860px,100%);background:#fff;box-shadow:-8px 0 30px rgba(0,0,0,.18);display:flex;flex-direction:column}.rkX{position:absolute;top:10px;right:12px;border:0;background:#f0f2f6;border-radius:50%;width:32px;height:32px;font-size:15px;cursor:pointer;z-index:2}.rkDB{overflow-y:auto;padding:18px 22px 30px;flex:1}",
    ".rkDH{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;padding-right:46px}.rkDH small{color:#8a92a3;font-size:12px}.rkDH h3{margin:2px 0 6px;font-size:22px}.rkV{font-size:13.5px;line-height:1.6;color:#334}.rkV b{color:#141414}.rkBig{flex:none;text-align:center;background:#141414;color:#fff;border-radius:16px;padding:10px 18px;min-width:112px}.rkBig b{display:block;font-size:44px;font-weight:900;line-height:1.05;color:#e6c57a}.rkBig span{font-size:11.5px;color:#c9d0de;font-weight:700}",
    ".rkAct{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.rkAct button{font:inherit;font-size:13px;font-weight:700;border:1px solid #dfe4ec;background:#fff;border-radius:8px;padding:7px 12px;cursor:pointer}.rkAct button.primary{background:#141414;color:#fff;border-color:#141414}.rkSum{display:grid;gap:4px;margin-bottom:12px}.rkSum a{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;text-decoration:none;color:inherit;padding:6px 10px;border-radius:8px;background:#f6f8fb;font-size:13.5px;font-weight:700}.rkSum em{font-style:normal;font-weight:500;color:#8a92a3;font-size:11.5px;margin-left:6px}.rkSum .smBar{width:160px}",
    ".rkSW{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:6px}.rkSW>div{background:#f6f8fb;border-radius:10px;padding:10px 12px}.rkSW b.up{color:#1a9b5f}.rkSW b.dn{color:#d9534f}.rkSW p{margin:6px 0 0;font-size:12.5px;line-height:1.5}.rkSW i{font-style:normal;font-weight:900;display:inline-block;min-width:26px}",
    ".rkGD{border-top:2px solid #141414;margin-top:16px;padding-top:10px}.rkGD .h{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:8px}.rkGD .h b{font-size:16px}.rkGD .h p{margin:3px 0 0;font-size:12.5px;color:#5b6474;line-height:1.5}.rkGD .sc{text-align:right;flex:none}.rkGD .sc b{line-height:1}.rkGD .sc small{display:block;font-size:11px;color:#8a92a3}.rkGD .dgT td{font-size:12.5px;line-height:1.5;vertical-align:top}.rkGD .dgT td:nth-child(3){text-align:center;white-space:nowrap}",
    "@media(max-width:900px){.rkGs{grid-template-columns:minmax(0,1fr)}}@media(max-width:720px){.rkMood .r{text-align:left}.rkT{min-width:0}.rkT th,.rkT td{white-space:normal}.rkT thead th{position:static}.rkDB{padding:14px 14px 30px}.rkSW{grid-template-columns:minmax(0,1fr)}.rkDH{flex-direction:column;padding-right:36px}.rkSum .smBar{width:80px}.rkT td small{margin-left:0}.rkFl input[type=search]{width:100%}.rkT td.rkC{text-align:left}}",
    "[data-theme=dark] #rkDrawer aside{background:#11151c;color:#dfe4ec}[data-theme=dark] .rkG,[data-theme=dark] .rkSW>div,[data-theme=dark] .rkSum a{background:#1e2533}[data-theme=dark] .rkG p,[data-theme=dark] .rkV{color:#c3cad6}[data-theme=dark] .rkV b{color:#fff}[data-theme=dark] .rkGD{border-top-color:#c9a24f}[data-theme=dark] .rkMd{background:#232a36;color:#c3cad6}[data-theme=dark] .rkMd.up{background:#173524;color:#8fd6a5}[data-theme=dark] .rkMd.down{background:#3a1c1c;color:#f0a3a3}[data-theme=dark] .rkConc{background:#1e2533}[data-theme=dark] .rkT thead th{background:#161b24}[data-theme=dark] .rkCap{background:#1e2533;border-left-color:#c9a24f}[data-theme=dark] .rkG .its label{color:#c3cad6}[data-theme=dark] .rkPre button{background:#1c212b;color:#fff;border-color:#39414f}[data-theme=dark] .rkAct button{background:#1c212b;color:#fff;border-color:#39414f}[data-theme=dark] .rkT tbody tr:hover td{background:#18233a}[data-theme=dark] .rkX{background:#263041;color:#fff}",
    /* 리포트 슬라이드 전용 */
    ".rkSF{min-width:0}.rkSG{display:grid;gap:9px}.rkSG>div{display:grid;grid-template-columns:230px 1fr 54px;gap:14px;align-items:center}.rkSG span{font-size:18px;font-weight:800}.rkSG em{font-style:normal;font-size:12.5px;color:#8a92a3;font-weight:600;margin-left:8px}.rkSG b{font-size:26px;font-weight:900;text-align:right}.rkSBar{display:block;height:14px;background:#efeadf;border-radius:7px;text-decoration:none;overflow:hidden}.rkSBar i{display:block;height:14px;border-radius:7px}.rkSV{font-size:17px;font-weight:600;line-height:1.6;margin:18px 0 0;color:#333;border-top:1px solid #e6e1d6;padding-top:14px}.uhNow>b{font-size:96px}",
    ".rkCT{table-layout:fixed;font-size:13px!important}.rkCT td{white-space:normal;padding:3px 10px!important;line-height:1.4;text-align:left!important;font-weight:600!important}.rkCT td:first-child,.rkCT th:first-child{width:27%;font-weight:800!important}.rkCT th{text-align:left!important}.rkST{table-layout:fixed}.rkST td{vertical-align:top;overflow-wrap:anywhere;white-space:normal}.rkST td:nth-child(1){font-weight:800;width:23%}.rkST td:nth-child(2),.rkST th:nth-child(2){text-align:left;width:27%;font-weight:600;font-size:14px}.rkST td:nth-child(3),.rkST th:nth-child(3){text-align:center;width:7%}.rkST td:nth-child(3) b{font-size:18px}.rkST td:nth-child(4){text-align:left!important;font-size:13.5px!important;font-weight:600;color:#444}.rkSW2 .uhEv{grid-template-columns:54px 1fr 0}.rkSW2 .uhEv .y{font-size:28px;color:#141414}.rkSW2 .uhEv .m b{display:block;margin-bottom:2px}.rkSW2 .uhEv .m u{margin-top:2px}"
  ].join("");
  document.head.appendChild(st);
})();
