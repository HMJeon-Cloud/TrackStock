// 채널용 '미국 증시 데일리 브리핑' 글 생성 (서버 공용)
//   /api/channel 의 미리보기와 아침 자동 발송(텔레그램)이 같은 글을 쓰도록 여기 한 곳에서 만든다.
//   입력: Redis의 최근 90일 시세(recent) + 네이버 뉴스 제목. 출력: 메신저에 바로 붙일 수 있는 순수 텍스트.
//   추천·전망은 쓰지 않는다. 숫자와 기사 제목(이유 후보)만 나열하고, 판단은 운영자가 덧붙인다.

const THEMES = [
  ["반도체", ["005930.KS", "000660.KS", "042700.KS", "NVDA", "AMD", "INTC", "MU", "TSM", "ASML", "QCOM", "AVGO", "ARM", "MRVL", "LRCX", "AMAT", "KLAC", "ADI", "NXPI", "TXN", "SOXX", "SMH", "SMCI", "058470.KQ"]],
  ["AI·빅테크", ["AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "PLTR", "NFLX", "ORCL", "CRM", "ADBE", "NOW", "PANW", "CRWD", "SNOW", "IBM", "CSCO", "035420.KS", "035720.KS"]],
  ["2차전지", ["373220.KS", "051910.KS", "006400.KS", "003670.KS", "247540.KQ", "086520.KQ", "009830.KS"]],
  ["바이오·헬스", ["207940.KS", "068270.KS", "000100.KS", "196170.KQ", "028300.KQ", "068760.KQ", "096530.KQ", "LLY", "JNJ", "UNH", "PFE", "MRK", "ABBV", "ABT", "TMO", "AMGN", "NVO", "VRTX", "REGN", "ISRG", "GEHC"]],
  ["자동차", ["005380.KS", "000270.KS", "012330.KS", "086280.KS", "TSLA", "F", "GM", "RIVN"]],
  ["조선·방산·기계", ["012450.KS", "079550.KS", "047810.KS", "064350.KS", "042660.KS", "009540.KS", "329180.KS", "010140.KS", "034020.KS", "241560.KS", "LMT", "RTX", "NOC", "GD", "GE", "GEV", "CAT", "DE", "HON", "BA", "ETN", "EMR"]],
  ["금융", ["105560.KS", "055550.KS", "086790.KS", "316140.KS", "138040.KS", "032830.KS", "323410.KS", "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP", "MA", "V", "SCHW", "CB", "BRK-B", "SPGI", "PYPL", "COIN"]],
  ["에너지·소재", ["096770.KS", "010950.KS", "078930.KS", "011170.KS", "010060.KS", "005490.KS", "010130.KS", "015760.KS", "XOM", "CVX", "COP", "SHEL", "BP", "SLB", "OXY", "LIN", "FCX", "NEM", "NEE", "DUK", "SO"]],
  ["소비재·유통", ["090430.KS", "051900.KS", "097950.KS", "033780.KS", "066570.KS", "KO", "PEP", "PG", "WMT", "COST", "HD", "LOW", "TGT", "MCD", "SBUX", "NKE", "DIS", "MO", "PM", "MDLZ", "CL", "BKNG", "UBER", "ABNB", "SHOP", "SPOT"]],
  ["엔터·게임", ["352820.KS", "036570.KS", "251270.KS", "259960.KS", "263750.KQ", "293490.KQ", "035900.KQ", "041510.KQ", "122870.KQ"]],
];
const EXCLUDE = /^(TQQQ|SOXL|122630\.KS|114800\.KS|\^VIX|DX-Y\.NYB|KRW=X|JPYKRW=X|EURKRW=X)$/;
const KR = /\.K[SQ]$|^\^KS|^\^KQ/;
const ETF = /^(SPY|QQQ|VOO|VTI|IVV|DIA|IWM|GLD|SLV|TLT|IEF|SHY|BND|AGG|LQD|SCHD|JEPI|VNQ|EFA|EEM|ARKK|SOXX|SMH|XL[A-Z]|DBC|USO)$/;
const MACRO = [["^GSPC", "S&P500"], ["^IXIC", "나스닥"], ["^DJI", "다우"], ["^KS11", "코스피"], ["^KQ11", "코스닥"]];
const MACRO2 = [["TLT", "미국 장기채(TLT)"], ["USO", "원유(USO)"], ["DX-Y.NYB", "달러인덱스"], ["KRW=X", "달러/원"], ["GLD", "금(GLD)"], ["BTC-USD", "비트코인"]];

const pct = (x, d = 1) => (x == null || !isFinite(x)) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
const fmtDate = (ms) => { const d = new Date(ms + 9 * 3600 * 1000); return (d.getUTCMonth() + 1) + "." + d.getUTCDate() + "(" + "일월화수목금토"[d.getUTCDay()] + ")"; };

export function stats(sym, d, names) {
  const c = d.c || [], v = d.v || [], n = c.length;
  if (n < 22 || c[n - 1] == null) return null;
  const last = c[n - 1];
  let ma20 = 0; for (let i = n - 20; i < n; i++) ma20 += c[i]; ma20 /= 20;
  let v5 = 0, v20 = 0; for (let i = n - 5; i < n; i++) v5 += v[i] || 0; for (let i = Math.max(0, n - 25); i < n - 5; i++) v20 += v[i] || 0;
  v5 /= 5; v20 /= Math.max(1, Math.min(20, n - 5));
  const hi = d.meta && d.meta.fiftyTwoWeekHigh;
  return {
    sym, name: (names && names[sym]) || (d.meta && (d.meta.shortName || d.meta.longName)) || sym,
    last, ret1: last / c[n - 2] - 1, ret5: n > 5 ? last / c[n - 6] - 1 : null, m1: last / c[Math.max(0, n - 22)] - 1,
    above20: last >= ma20, vsHi: hi > 0 ? last / hi - 1 : null, volX: v20 > 0 ? v5 / v20 : null,
    lastT: d.t && d.t.length ? d.t[d.t.length - 1] * 1000 : 0,
  };
}

/* recent + 뉴스 제목 → 글 조각들. news: [{title, press, url}] (없으면 빈 배열) */
export function composeDaily(recent, names, news) {
  const by = {}; const rows = [];
  for (const sym of Object.keys(recent.symbols || {})) { const s = stats(sym, recent.symbols[sym], names); if (s) { by[sym] = s; rows.push(s); } }
  // 데이터 점검: 최신 기준일보다 4일 넘게 뒤처진 종목(수집 실패 잔존)·하루 ±40% 초과(오류 의심)·중복 종목은 순위에서 뺀다
  const DUP = { GOOG: 1, "BRK-A": 1, VOO: 1 };
  let asOf = 0; rows.forEach((s) => { if (!KR.test(s.sym) && !/-USD$|=X$|=F$/.test(s.sym) && s.lastT > asOf) asOf = s.lastT; });
  const us = rows.filter((s) => !KR.test(s.sym) && !EXCLUDE.test(s.sym) && !/-USD$|=X$|=F$|^\^/.test(s.sym) && !DUP[s.sym] &&
    asOf - s.lastT <= 4 * 86400000 && Math.abs(s.ret1) <= 0.4);
  const vix = by["^VIX"];

  const L = [];
  L.push("📈 미국 증시 데일리 브리핑 — " + fmtDate(asOf) + " 마감");
  L.push("");
  // 지수
  L.push("■ 지수");
  L.push(MACRO.filter((m) => by[m[0]]).map((m) => m[1] + " " + pct(by[m[0]].ret1)).join(" · "));
  if (vix) L.push("VIX " + vix.last.toFixed(1) + " (" + (vix.last >= 30 ? "공포" : vix.last >= 20 ? "불안" : "평온") + ")");
  L.push("");
  // 거시 변수
  L.push("■ 금리·유가·환율·금·코인");
  L.push(MACRO2.filter((m) => by[m[0]]).map((m) => m[1] + " " + pct(by[m[0]].ret1)).join(" · "));
  L.push("");
  // 테마 (미국 종목만)
  const themes = THEMES.map(([name, list]) => {
    const l = list.map((s) => by[s]).filter((s) => s && us.includes(s));   // 점검 통과한 미국 종목만
    if (l.length < 2) return null;
    const avg = l.reduce((a, s) => a + s.ret1, 0) / l.length;
    const best = l.slice().sort((a, b) => b.ret1 - a.ret1)[0];
    return { name, avg, n: l.length, best };
  }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  if (themes.length >= 2) {
    L.push("■ 자금 흐름 (업종)");
    L.push("강세: " + themes.slice(0, 3).map((t) => t.name + " " + pct(t.avg)).join(" · "));
    L.push("약세: " + themes.slice(-3).reverse().map((t) => t.name + " " + pct(t.avg)).join(" · "));
    L.push("");
  }
  // 급등락
  const sorted = us.filter((s) => !ETF.test(s.sym)).sort((a, b) => b.ret1 - a.ret1);   // 급등락은 개별 종목만
  const up = sorted.slice(0, 5), down = sorted.slice(-5).reverse();
  const breadth = us.length ? us.filter((s) => s.ret1 > 0).length / us.length : 0;
  L.push("■ 종목 (오른 종목 " + Math.round(breadth * 100) + "%)");
  L.push("▲ " + up.map((s) => s.name + " " + pct(s.ret1)).join(", "));
  L.push("▼ " + down.map((s) => s.name + " " + pct(s.ret1)).join(", "));
  L.push("");
  // 뉴스
  const items = (news || []).slice(0, 5);
  if (items.length) {
    L.push("■ 간밤 헤드라인");
    items.forEach((it) => L.push("· " + it.title.replace(/\s+/g, " ").trim()));
    L.push("");
  }
  // 체크포인트 (숫자 기반 문장)
  const cp = [];
  if (breadth >= 0.65) cp.push("오른 종목이 대부분 — 시장 전체 흐름. 개별 종목 뉴스보다 거시 변수가 이유일 가능성");
  else if (breadth <= 0.35) cp.push("내린 종목이 대부분 — 내 종목만의 문제가 아님. 과거 낙폭과 비교해 볼 때");
  else cp.push("오른 종목과 내린 종목이 반반 — 업종별로 이유가 갈린 날");
  if (vix && vix.last >= 25) cp.push("VIX " + vix.last.toFixed(0) + " — 과거 공포 구간은 저점 근처였던 적이 많았지만, 바닥 확인은 사후에만 가능");
  if (vix && vix.last < 15) cp.push("VIX " + vix.last.toFixed(0) + " — 평온할 때가 분할 매수 계획을 점검하기 좋은 때");
  const sale = us.filter((s) => s.vsHi != null && s.vsHi <= -0.2).length;
  cp.push("52주 최고 대비 -20% 이상인 미국 종목 " + sale + "개 / " + us.length + "개");
  L.push("■ 체크포인트");
  cp.forEach((c) => L.push("· " + c));
  L.push("");
  L.push("※ 종가 기준 자동 집계. 투자 조언이 아니며 판단은 각자의 기준으로.");
  return { text: L.join("\n"), asOf, breadth, up, down, themes, vix: vix ? vix.last : null };
}
