/* ============================================================
   발행 도우미 (v8.2) — 우상향연구소(@uphill.lab)에 주기적으로 올릴 때 쓰는 운영 도구
     ① 발행 전 점검     : 데이터가 오늘 것인지 · 제외 종목 · 휴장일 · 금지 표현 · 글자 수 한도
     ② 오늘 뭐 올리지   : 요일 + 오늘 시장 상황에 맞춘 추천 세트 (한 번에 카드 생성)
     ③ 캡션 생성        : 인스타 캡션(훅 → 핵심 5 → 한 줄 해석 → 질문 → 면책 → 해시태그) · 스레드(500자) 버전
     ④ 이번 주 일정     : FOMC·CPI·고용·금통위·휴장·만기 등 (PUB_CAL, 운영자가 파일에서 유지) + 카드
     ⑤ 용어 한 입       : 매일 다른 용어 1개 — 저장용 상시 콘텐츠 (PUB_TERMS) + 카드
   ============================================================ */

/* ---------- ④ 일정 (한국 시간 기준 날짜 · 미국 발표는 한국 시간 밤/새벽) ----------
   날짜가 바뀌면 이 목록만 고치면 돼요. src = 출처 메모. sure=false 는 '예정(확인 필요)'로 표시. */
var PUB_CAL = [
  // 2026-10
  { d: "2026-10-02", t: "🇺🇸 9월 고용보고서", k: "us", n: "21:30 발표 · FOMC 10월 결정의 최대 변수", src: "BLS" },
  { d: "2026-10-05", t: "🇰🇷 휴장 (개천절 대체공휴일)", k: "hol" },
  { d: "2026-10-08", t: "🇰🇷 삼성전자 3분기 잠정실적", k: "kr", n: "반도체 업황 가늠", sure: false },
  { d: "2026-10-08", t: "🇰🇷 옵션 만기일", k: "kr", n: "둘째 목요일 · 마감 무렵 변동 커질 수 있음" },
  { d: "2026-10-09", t: "🇰🇷 휴장 (한글날)", k: "hol" },
  { d: "2026-10-14", t: "🇺🇸 9월 CPI (물가)", k: "us", n: "21:30 발표 · 금리 인하 속도 좌우", src: "BLS" },
  { d: "2026-10-15", t: "🇺🇸 9월 소매판매", k: "us", n: "21:30 발표", src: "Census" },
  { d: "2026-10-15", t: "🇺🇸 3분기 실적 시즌 시작", k: "us", n: "대형 은행부터 · 빅테크는 10월 넷째 주~", sure: false },
  { d: "2026-10-22", t: "🇰🇷 한국은행 금통위 (기준금리)", k: "kr", n: "오전 발표", src: "한국은행" },
  { d: "2026-10-29", t: "🇺🇸 FOMC 금리 결정", k: "us", n: "새벽 03:00 발표 · 03:30 파월 기자회견 (현지 10/28)", src: "연준" },
  { d: "2026-10-29", t: "🇺🇸 3분기 GDP 속보치 · 9월 PCE 물가", k: "us", n: "21:30 발표", src: "BEA" },
  // 2026-11
  { d: "2026-11-06", t: "🇺🇸 10월 고용보고서", k: "us", n: "22:30 발표 (서머타임 해제 후)", src: "BLS" },
  { d: "2026-11-10", t: "🇺🇸 10월 CPI (물가)", k: "us", n: "22:30 발표", src: "BLS" },
  { d: "2026-11-12", t: "🇰🇷 옵션 만기일", k: "kr" },
  { d: "2026-11-25", t: "🇺🇸 10월 PCE 물가 · 3분기 GDP 잠정치", k: "us", n: "22:30 발표", src: "BEA" },
  { d: "2026-11-26", t: "🇰🇷 한국은행 금통위 (기준금리)", k: "kr", src: "한국은행" },
  { d: "2026-11-26", t: "🇺🇸 휴장 (추수감사절)", k: "hol" },
  { d: "2026-11-27", t: "🇺🇸 조기 폐장 (블랙프라이데이)", k: "hol" },
  // 2026-12
  { d: "2026-12-04", t: "🇺🇸 11월 고용보고서", k: "us", n: "22:30 발표", src: "BLS" },
  { d: "2026-12-10", t: "🇺🇸 FOMC 금리 결정 + 점도표", k: "us", n: "새벽 04:00 발표 (현지 12/9) · 내년 금리 전망 공개", src: "연준" },
  { d: "2026-12-10", t: "🇺🇸 11월 CPI (물가)", k: "us", n: "22:30 발표", src: "BLS" },
  { d: "2026-12-10", t: "🇰🇷 선물·옵션 동시 만기일", k: "kr", n: "분기 만기 · 변동 유의" },
  { d: "2026-12-18", t: "🇺🇸 선물·옵션 동시 만기 (네 마녀의 날)", k: "us" },
  { d: "2026-12-23", t: "🇺🇸 11월 PCE 물가 · 3분기 GDP 확정치", k: "us", n: "22:30 발표", src: "BEA" },
  { d: "2026-12-25", t: "🇰🇷🇺🇸 휴장 (성탄절)", k: "hol" },
  { d: "2026-12-31", t: "🇰🇷 휴장 (연말 휴장일)", k: "hol" },
  // 2027 FOMC (연준 발표 일정 · 한국 시간 발표일)
  { d: "2027-01-28", t: "🇺🇸 FOMC 금리 결정", k: "us", n: "새벽 발표 (현지 1/26~27)", src: "연준" },
  { d: "2027-03-18", t: "🇺🇸 FOMC 금리 결정 + 점도표", k: "us", src: "연준" },
  { d: "2027-04-29", t: "🇺🇸 FOMC 금리 결정", k: "us", src: "연준" },
  { d: "2027-06-10", t: "🇺🇸 FOMC 금리 결정 + 점도표", k: "us", src: "연준" }
];
var PUB_CAL_K = { us: "미국", kr: "한국", hol: "휴장" };
function pubToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function pubDow(d) { return "일월화수목금토"[new Date(d + "T00:00:00+09:00").getDay()]; }
function pubUpcoming(days) {
  var t0 = pubToday(), t1 = new Date(Date.parse(t0 + "T00:00:00+09:00") + (days || 7) * 86400e3).toISOString().slice(0, 10);
  return PUB_CAL.filter(function (e) { return e.d >= t0 && e.d < t1; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
}
function pubIsHoliday(mkt, d) { d = d || pubToday(); var flag = mkt === "kr" ? "🇰🇷" : "🇺🇸"; var dow = new Date(d + "T00:00:00+09:00").getDay(); if (dow === 0 || dow === 6) return "주말"; var h = PUB_CAL.filter(function (e) { return e.d === d && e.k === "hol" && e.t.indexOf(flag) >= 0; })[0]; return h ? h.t.replace(/^[^\s]+\s/, "") : ""; }

/* ---------- ⑤ 용어 한 입 ---------- */
var PUB_TERMS = [
  ["MDD (최대 낙폭)", "가장 높았던 때부터 가장 낮았던 때까지 얼마나 빠졌나", "수익률보다 먼저 봐야 할 숫자예요. -50%를 회복하려면 +100%가 필요하거든요. 내가 견딜 수 있는 MDD가 곧 내 주식 비중의 상한이에요.", "S&P500의 2008년 MDD는 약 -55%, 코스피는 2020년 3월 한 달에 -35%였어요."],
  ["52주 신고가·신저가", "최근 1년 중 가장 비싼 값 / 가장 싼 값", "신고가는 '비싸다'가 아니라 '파는 사람이 없다'는 뜻에 가까워요. 신저가는 '싸다'가 아니라 '사는 사람이 없다'는 뜻이고요.", "신고가 종목이 많아지는 날은 시장 전체가 강할 때가 많아요."],
  ["VIX (공포지수)", "앞으로 한 달 S&P500이 얼마나 출렁일지에 대한 시장의 예상", "20 아래면 평온, 30 넘으면 공포. 2020년 3월엔 82까지 갔어요. 공포가 극단일 때가 저점 근처였던 적이 많지만, 바닥은 지나야 알 수 있어요.", "VIX가 높을 때 나눠 사기 시작한 사람은 대개 1년 뒤 웃었어요."],
  ["PER (주가수익비율)", "주가가 1년 이익의 몇 배인가", "PER 20이면 지금 이익이 20년 쌓여야 주가만큼이 돼요. 낮으면 싸 보이지만 '이익이 줄 것 같아서' 낮은 경우도 많아요.", "같은 업종끼리 비교할 때만 의미가 있어요. 반도체와 식품의 PER을 비교하면 안 돼요."],
  ["배당수익률", "주가 대비 1년 배당금의 비율", "3%면 100만원 넣고 연 3만원. 주가가 떨어지면 수익률 숫자는 올라가니, 높다고 좋은 게 아니라 '왜 높아졌나'를 봐야 해요.", "배당을 매년 늘려 온 기업을 모은 ETF가 SCHD예요."],
  ["금리와 채권 가격", "금리가 오르면 채권 가격은 내린다", "이미 발행된 채권은 이자가 고정이라, 새 채권 이자가 오르면 헌 채권은 덜 매력적이 돼 값이 내려요. 만기가 길수록(TLT) 더 크게 움직여요.", "2022년 금리 급등 때 20년 장기채 ETF는 주식만큼 빠졌어요(-31%)."],
  ["달러/원 환율과 해외주식", "미국 주식 수익률 = 주가 변동 + 환율 변동", "S&P500이 +10%여도 환율이 -10%면 원화로는 본전이에요. 반대로 주가가 빠질 때 환율이 오르면 손실이 줄어요(자연 헷지).", "2022년 S&P500은 -18%였지만 환율 덕에 원화 기준으론 -12%였어요."],
  ["적립식 (DCA)", "정해진 날 정해진 금액을 꾸준히 사는 방법", "가격이 쌀 때 더 많이, 비쌀 때 더 적게 사게 돼서 평균 단가가 낮아져요. 타이밍을 맞히려는 스트레스가 사라지는 게 가장 큰 장점이에요.", "떨어질 때 멈추는 순간 적립식의 장점이 사라져요."],
  ["리밸런싱", "비중이 틀어진 자산을 원래 비율로 되돌리는 것", "오른 자산을 조금 팔고 빠진 자산을 조금 사는 셈이라, 자동으로 '비싸게 팔고 싸게 사기'가 돼요. 1년에 한두 번이면 충분해요.", "60/40 포트폴리오를 리밸런싱 없이 두면 10년 뒤엔 80/20이 되어 있어요."],
  ["거래대금", "주가 × 거래량 — 그 종목에 실제로 오간 돈", "거래량은 1주 1원짜리도 1주라 왜곡돼요. 거래대금이 평소의 2~3배면 '무슨 일이 있다'는 신호예요.", "거래대금이 급증하며 오른 종목은 며칠 뒤 되돌림도 큰 편이에요."],
  ["이동평균선 (20일선)", "최근 20거래일 종가의 평균을 이은 선", "주가가 20일선 위면 최근 한 달 산 사람 대부분이 이익, 아래면 대부분 손실 상태예요. 추세의 방향을 보는 가장 단순한 기준이에요.", "20일선 위 종목 비율이 80%를 넘으면 과열, 20% 아래면 과매도로 보기도 해요."],
  ["RSI (상대강도지수)", "최근 14일 동안 오른 힘과 내린 힘의 비율 (0~100)", "70 넘으면 과열, 30 아래면 과매도. 다만 강한 추세에선 70 위에 몇 주씩 머물기도 해서 '팔 신호'로 쓰면 자주 틀려요.", "RSI 30 아래에서 산 지수 ETF는 3개월 뒤 플러스였던 비율이 높았어요."],
  ["ETF", "여러 종목을 한 바구니에 담아 주식처럼 사고파는 펀드", "S&P500 ETF 1주를 사면 미국 대표 500개 기업을 조금씩 다 사는 거예요. 종목 고르기에 자신 없을 때의 기본 선택지예요.", "같은 지수를 따라도 보수(연 수수료)가 다르니 확인하세요. 0.03%와 0.5%는 20년이면 큰 차이예요."],
  ["레버리지 ETF", "지수 하루 움직임의 2배·3배를 따라가는 ETF", "'하루'가 핵심이에요. 오르내림을 반복하면 지수가 제자리여도 레버리지는 손실이 쌓여요(변동성 손실). 장기 보유용이 아니에요.", "지수 -10% → +11%로 제자리일 때, 2배 ETF는 -20% → +22% = -2.4%예요."],
  ["생존자 편향", "살아남은 것만 보고 전체를 판단하는 오류", "'10년 전 엔비디아 샀으면'은 지금 1등을 알고 하는 말이에요. 10년 전 유망주 목록엔 사라진 회사가 더 많았어요.", "지수 투자는 사라지는 종목은 빠지고 새 1등이 들어오니, 생존자 편향을 내 편으로 쓰는 방법이에요."],
  ["손절과 물타기", "떨어진 종목을 파느냐, 더 사느냐", "기준은 '왜 떨어졌나'예요. 시장 전체가 빠진 거면 물타기(나눠 사기)가, 그 회사만의 문제면 손절이 맞는 경우가 많아요.", "물타기는 지수·1등 기업에서만, 개별 테마주는 손절 기준을 미리 정해두세요."],
  ["기준금리", "중앙은행이 정하는 모든 금리의 출발점", "올리면 예금·대출 이자가 오르고 주식·부동산엔 부담, 내리면 반대예요. 결정보다 '앞으로 어떻게 하겠다'는 말(포워드 가이던스)에 시장이 더 반응해요.", "미국은 FOMC(연 8회), 한국은 금통위(연 8회)에서 정해요."],
  ["CPI (소비자물가지수)", "장바구니 물가가 1년 전보다 얼마나 올랐나", "물가가 높으면 금리를 못 내리고, 낮아지면 내릴 여지가 생겨요. 그래서 발표일에 시장이 크게 움직여요. 매달 중순 밤 9시 반(한국)에 나와요.", "예상치보다 0.1%p만 높아도 그날 나스닥이 2% 빠진 적이 있어요."],
  ["고용보고서 (NFP)", "미국에서 한 달 새 일자리가 얼마나 늘었나", "매달 첫째 금요일 밤에 나와요. 너무 좋으면 '금리 못 내리겠네'로 주식이 빠지고, 너무 나쁘면 '경기 침체?'로 빠져요. 적당한 게 제일 좋아요.", "실업률이 전저점보다 0.5%p 오르면 침체 신호로 보는 '삼 법칙'이 있어요."],
  ["어닝 시즌", "기업들이 분기 실적을 발표하는 시기", "1·4·7·10월 중순부터 약 한 달. 실적 자체보다 '예상과 비교해 어땠나', '다음 분기 전망'이 주가를 움직여요.", "실적이 좋아도 전망이 보수적이면 빠지고, 실적이 나빠도 최악은 지났다면 오르기도 해요."],
  ["시가총액", "주가 × 발행 주식 수 — 회사 전체의 가격표", "주가 1만원 회사가 주가 100만원 회사보다 클 수 있어요. '주가가 싸다'는 시총을 봐야 알아요.", "코스피 전체 시총보다 큰 미국 회사가 여럿 있어요."],
  ["안전자산", "위기 때 오히려 오르거나 덜 빠지는 자산", "달러, 미국 국채, 금이 대표예요. 다만 2022년처럼 금리가 급등하면 국채도 같이 빠지는 예외가 있어요. 영원한 안전자산은 없어요.", "주식이 빠질 때 달러/원이 오르는 건 한국 투자자에게 보험 역할을 해요."],
  ["변동성", "가격이 얼마나 크게 출렁이나", "같은 +10%라도 매일 ±5%씩 움직여서 온 것과 매일 +0.1%씩 온 것은 전혀 달라요. 변동성이 크면 버티기가 어렵고, 못 버티면 수익은 내 것이 아니에요.", "비트코인의 하루 변동은 S&P500의 4~5배예요."],
  ["복리", "이자에 이자가 붙는 것", "연 7%면 10년에 2배, 20년에 4배, 30년에 7.6배. 앞의 10년보다 뒤의 10년이 훨씬 커요. 그래서 '언제 시작하나'가 '얼마로 시작하나'보다 중요해요.", "72를 수익률로 나누면 2배 되는 데 걸리는 해가 나와요(72의 법칙)."],
  ["공매도", "빌린 주식을 먼저 팔고 나중에 사서 갚는 것", "주가가 내리면 이익이에요. 공매도가 많이 쌓인 종목이 오르기 시작하면 갚으려고 사느라 더 급등하기도 해요(숏 스퀴즈).", "공매도 비중이 높다 = 전문가들이 비관적으로 본다는 신호로 참고할 수 있어요."],
  ["베타", "시장이 1% 움직일 때 이 종목은 몇 % 움직이나", "베타 1.5면 시장보다 1.5배 크게 오르내려요. 공격적 종목은 베타가 높고, 배당주·필수소비재는 낮아요.", "포트폴리오 베타를 낮추고 싶으면 채권·금·배당주를 섞어요."],
  ["분산투자", "서로 다르게 움직이는 자산을 섞는 것", "종목을 10개 사도 다 반도체면 분산이 아니에요. 주식·채권·금처럼 '다른 이유로' 움직이는 걸 섞어야 계좌 전체의 흔들림이 줄어요.", "핵심은 '수익률을 높이는' 게 아니라 '버틸 수 있게 만드는' 거예요."],
  ["달러 강세 / 약세", "달러 가치가 다른 통화 대비 오르고 내리는 것", "미국 금리가 높거나 세계가 불안하면 달러로 돈이 몰려 강세. 그러면 신흥국 주식(한국 포함)에서 돈이 빠지는 경향이 있어요.", "달러 약세 구간엔 금·신흥국·원자재가 좋았던 적이 많아요."],
  ["IPO·상장", "회사가 처음으로 주식시장에 주식을 파는 것", "첫날 급등 뉴스가 많지만, 상장 후 1년 수익률은 지수보다 낮았던 경우가 더 많아요. 기관이 보유 물량을 파는 시점(보호예수 해제)을 확인하세요.", "상장 첫날 산 사람과 6개월 뒤 산 사람의 결과가 크게 달랐어요."],
  ["멘탈 방어", "떨어질 때 팔지 않게 미리 만들어 두는 장치", "규칙(비중·적립일·손절선)을 숫자로 적어두고, 떨어지면 뉴스 대신 과거 하락 기록을 봐요. 감정이 결정하기 전에 규칙이 결정하게 하는 거예요.", "이 계정이 매일 숫자를 올리는 이유예요."]
];
function pubTerm(offset) { var day = Math.floor((Date.now() + 9 * 3600e3) / 86400e3) + (offset || 0); return PUB_TERMS[day % PUB_TERMS.length]; }

/* ---------- 해시태그 · 금지 표현 ---------- */
var PUB_TAGS_BASE = ["우상향연구소", "주식초보", "재테크", "투자공부", "경제공부"];
var PUB_TAGS_POOL = { daily: ["미국증시", "증시브리핑", "오늘의증시", "주식뉴스", "나스닥", "S&P500", "코스피"], kr: ["코스피", "코스닥", "국내주식", "삼성전자", "SK하이닉스"], us: ["미국주식", "나스닥", "엔비디아", "테슬라", "S&P500"], coin: ["비트코인", "코인", "이더리움", "암호화폐"], long: ["적립식투자", "장기투자", "ETF투자", "자산배분", "월급쟁이재테크"], mind: ["투자성향", "MBTI", "투자유형테스트", "주린이"], term: ["주식용어", "경제용어", "금융문맹탈출"] };
var PUB_BANNED = /(추천|사세요|파세요|매수하세요|매도하세요|확실|무조건|보장|급등\s*예정|목표가|지금\s*사야|놓치면)/;

/* ---------- ① 발행 전 점검 ---------- */
function pubChecklist() {
  var R = (typeof chState !== "undefined" && chState.brief) || (typeof briefState !== "undefined" && briefState.result), out = [];
  if (!R) return [{ ok: false, t: "데이터를 아직 못 불러왔어요" }];
  var today = pubToday(), asUs = R.asOfUs ? new Date(R.asOfUs + 9 * 3600e3).toISOString().slice(0, 10) : "", asKr = R.asOfKr ? new Date(R.asOfKr + 9 * 3600e3).toISOString().slice(0, 10) : "";
  var dow = new Date(today + "T00:00:00+09:00").getDay(), krHol = pubIsHoliday("kr"), usHol = pubIsHoliday("us");
  // 기준일: 평일이면 미국은 전날(어제 밤 마감)이어야 '오늘 데이터'
  var yest = new Date(Date.parse(today + "T00:00:00+09:00") - 86400e3).toISOString().slice(0, 10);
  var gap = Math.round((Date.parse(today) - Date.parse(asUs || today)) / 86400e3);
  var usFresh = dow === 0 || dow === 1 ? gap <= 3 : gap <= 1;
  out.push({ ok: usFresh, t: "미국 데이터 기준일 " + (asUs || "-").slice(5).replace("-", ".") + (usFresh ? " — 최신" : " — " + gap + "일 전 데이터예요. 아침 수집(08:30)이 끝났는지 확인"), w: !usFresh });
  var gk = Math.round((Date.parse(today) - Date.parse(asKr || today)) / 86400e3), krFresh = krHol ? true : (dow === 0 || dow === 1 ? gk <= 3 : gk <= 1);
  out.push({ ok: krFresh, t: "한국 데이터 기준일 " + (asKr || "-").slice(5).replace("-", ".") + (krHol ? " — 오늘 " + krHol + ", 전 거래일 값이 정상" : krFresh ? " — 최신" : " — " + gk + "일 전"), w: !krFresh });
  var qn = R.quality ? R.quality.stale.length + R.quality.spike.length : 0;
  out.push({ ok: qn === 0, t: qn ? "데이터 확인 필요 " + qn + "개 — 자동 제외됨 (" + (R.quality.stale.concat(R.quality.spike).slice(0, 3).map(function (s) { return briefName(s); }).join(", ")) + ")" : "데이터 점검 이상 없음", w: qn > 3 });
  if (krHol) out.push({ ok: true, t: "오늘 한국 " + krHol + " — 캡션에 자동으로 표시돼요" });
  if (usHol) out.push({ ok: true, t: "오늘 미국 " + usHol + " — 내일 아침 미국 데이터는 갱신되지 않아요" });
  var up = pubUpcoming(2).filter(function (e) { return e.k !== "hol"; });
  if (up.length) out.push({ ok: true, t: "48시간 내 일정: " + up.map(function (e) { return e.t.replace(/^[^\s]+\s/, "") + "(" + e.d.slice(5).replace("-", "/") + ")"; }).join(", ") + " — 캡션에 한 줄 넣으면 저장이 늘어요" });
  var ow = typeof isOwner === "function" && isOwner();
  out.push({ ok: ow, t: ow ? "운영자 모드" : "운영자 모드가 아니에요", w: !ow });
  return out;
}

/* ---------- ② 오늘 뭐 올리지 ---------- */
function pubPlan() {
  var R = (typeof chState !== "undefined" && chState.brief) || (typeof briefState !== "undefined" && briefState.result);
  var dow = new Date(pubToday() + "T00:00:00+09:00").getDay(), plan = [], why = [];
  var iss = (typeof chState !== "undefined" && chState.issues) || (typeof briefState !== "undefined" && briefState.issues) || [];
  // 매일 기본
  plan.push({ id: "top5", t: "📌 오늘의 핵심 이슈 5", d: "매일 아침 고정 — 피드의 '오늘' 역할", kind: "issues" });
  if (R) {
    var vix = (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0], v = vix ? parseFloat(vix.v) : 0;
    if (Math.abs(R.temp.upPct - 0.5) >= 0.25) { plan.push({ id: "temp", t: "🌡️ 시장 온도 (" + R.temp.word + ")", d: "오늘은 시장 전체가 한 방향으로 움직인 날 — 온도 카드가 먹혀요", kind: "brief", pick: "1_시장온도" }); why.push("오른 종목 " + Math.round(R.temp.upPct * 100) + "%"); }
    if (v >= 25) { plan.push({ id: "fear", t: "😱 과거 공포 사례 카드", d: "VIX " + v.toFixed(0) + " — 불안한 날엔 '그때도 그랬다'가 가장 저장돼요", kind: "channel", pick: "5_과거사례" }); why.push("VIX " + v.toFixed(0)); }
    var hot = (R.hotVol || [])[0]; if (hot && hot.amtX >= 3) { plan.push({ id: "hot", t: "💰 돈이 몰린 곳 (" + briefName(hot) + " " + hot.amtX.toFixed(1) + "배)", d: "거래대금 급증 종목은 '왜?'라는 댓글을 부르는 소재", kind: "brief", pick: "4_인기종목" }); }
  }
  if (dow === 1) plan.push({ id: "cal", t: "🗓️ 이번 주 일정", d: "월요일 고정 — 한 주의 길잡이, 저장률 높은 형식", kind: "cal" });
  if (dow >= 2 && dow <= 4) plan.push({ id: "movers", t: "🚀 급등·급락 + 돈이 몰린 곳", d: "화~목 — 종목 얘기가 가장 잘 읽히는 요일", kind: "brief", pick: "3_급등급락" });
  if (dow === 5) plan.push({ id: "dca", t: "🗓️ 매달 10만원 / 1년 전 100만원", d: "금요일 — 주말에 천천히 보는 '적금처럼' 시리즈 (반응 최고 포맷)", kind: "brief", pick: "8_매달10만원" });
  if (dow === 0 || dow === 6) { plan.push({ id: "mind", t: "💛 투자 유형 테스트 소개", d: "주말 — 참여형 콘텐츠, 댓글로 4글자 받기", kind: "mind" }); plan.push({ id: "alloc", t: "⚖️ 자산배분 비교", d: "주말 — 시간 들여 읽는 긴 호흡 콘텐츠", kind: "channel", pick: "4_구성비교" }); }
  plan.push({ id: "term", t: "📖 용어 한 입 — " + pubTerm()[0], d: "매일 1장 — 검색·저장으로 새 사람이 들어오는 상시 콘텐츠", kind: "term" });
  return { plan: plan, why: why, dow: "일월화수목금토"[dow] };
}

/* ---------- ③ 캡션 ---------- */
function pubCaption(opt) {
  opt = opt || {};
  var R = (typeof chState !== "undefined" && chState.brief) || (typeof briefState !== "undefined" && briefState.result);
  var iss = (typeof chState !== "undefined" && chState.issues) || (typeof briefState !== "undefined" && briefState.issues) || [];
  if (!R || !iss.length) return { ig: "", th: "", warn: ["데이터가 아직 없어요"] };
  var date = cDate(R.asOfUs || R.asOf), krHol = pubIsHoliday("kr"), warn = [];
  var top = iss[0], t = R.temp;
  // 훅: 1위 이슈를 질문형/숫자형으로
  var hook = top.title.replace(/\s—\s/, ", ");
  var hooks = ["오늘 시장 한 줄: " + hook, hook + " — 무슨 일이었을까요?", "어젯밤 미국 증시, " + hook];
  var hookLine = hooks[Math.floor((Date.now() / 86400e3) % hooks.length)];
  var body = iss.map(function (it, i) { return (i + 1) + ". " + it.emoji + " " + it.title + "\n    " + it.sub; }).join("\n");
  var read = t.upPct >= 0.65 ? "대부분 올랐어요. 이런 날엔 '나만 못 번 것 같은' 조급함을 조심하세요." : t.upPct >= 0.5 ? "오른 종목과 내린 종목이 반반 — 종목별 이유가 갈린 날이에요." : t.upPct >= 0.35 ? "내린 종목이 더 많아요. 개별 악재보다 시장 전체 분위기일 가능성이 커요." : "거의 다 내렸어요. 내 종목만의 문제가 아니에요. 과거 하락 기록을 먼저 보세요.";
  var q = ["여러분 계좌는 오늘 어땠나요?", "이 중에 들고 계신 종목 있나요?", "오늘 가장 눈에 띈 건 뭐였어요?", "저장해 두고 내일 아침 숫자와 비교해 보세요."][Math.floor((Date.now() / 86400e3) % 4)];
  var up = pubUpcoming(3).filter(function (e) { return e.k !== "hol"; }), calLine = up.length ? "\n\n🗓️ 다가오는 일정: " + up.slice(0, 2).map(function (e) { return e.d.slice(5).replace("-", "/") + "(" + pubDow(e.d) + ") " + e.t.replace(/^[^\s]+\s/, ""); }).join(" · ") : "";
  var disc = "\n\n※ 전일 종가 기준 자동 집계" + (krHol ? " · 오늘 한국 " + krHol + "로 국내는 전 거래일 값" : "") + " · 투자 권유가 아니며 판단과 책임은 각자에게 있어요. 데이터 출처: 야후 파이낸스 · 네이버 뉴스 제목";
  var tags = PUB_TAGS_BASE.concat(PUB_TAGS_POOL.daily.slice(0, 4), R.market && R.market !== "all" ? PUB_TAGS_POOL[R.market].slice(0, 2) : []);
  var newsLine = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items.length) ? "\n\n📰 아침 뉴스\n" + CARD_NEWS.items.slice(0, 3).map(function (it) { return "· " + cNewsClean(it.title); }).join("\n") : "";
  var ig = hookLine + "\n\n📌 오늘의 핵심 이슈 5 (" + date + ")\n" + body + "\n\n🌡️ 오른 종목 " + Math.round(t.upPct * 100) + "% — " + read + newsLine + "\n\n" + q + calLine + disc + "\n\n" + tags.map(function (x) { return "#" + x; }).join(" ");
  // 스레드: 500자 — 훅 + 상위 3 + 질문
  var th = hookLine + "\n\n" + iss.slice(0, 3).map(function (it, i) { return (i + 1) + ". " + it.emoji + " " + it.title; }).join("\n") + "\n\n" + read + "\n\n" + q + "\n\n(전일 종가 기준 · 투자 권유 아님)";
  if (th.length > 500) th = th.slice(0, 490).replace(/\n[^\n]*$/, "") + "…";
  if (PUB_BANNED.test(ig)) warn.push("캡션에 추천·단정 표현이 들어 있어요: " + (ig.match(PUB_BANNED) || [])[0]);
  if (ig.length > 2200) warn.push("인스타 캡션 2,200자 초과 (" + ig.length + "자)");
  return { ig: ig, th: th, warn: warn, igLen: ig.length, thLen: th.length };
}
function pubTermCaption(term) {
  var tg = PUB_TAGS_BASE.concat(PUB_TAGS_POOL.term, ["주식공부"]).map(function (x) { return "#" + x; }).join(" ");
  return "📖 용어 한 입 — " + term[0] + "\n\n" + term[1] + "\n\n" + term[2] + "\n\n💡 " + term[3] + "\n\n헷갈렸던 용어 있으면 댓글로 남겨 주세요. 다음 카드로 만들어 드릴게요.\n\n" + tg;
}

/* ---------- 카드: 이번 주 일정 / 용어 ---------- */
function pubCalCard() {
  var week = pubUpcoming(8), next = pubUpcoming(15).filter(function (e) { return week.indexOf(e) < 0; }), c = cNew(), g = c.g, P = CARD.PAD, W = CARD.W - P * 2;
  var t0 = pubToday(), t1 = new Date(Date.parse(t0 + "T00:00:00+09:00") + 7 * 86400e3).toISOString().slice(0, 10);
  var n1 = week.filter(function (e) { return e.k !== "hol"; }).length;
  cHead(c, "이번 주 일정 · " + cDate(Date.now()), n1 ? "이번 주 시장 일정 [[" + n1 + "건]]" : "이번 주는 [[조용한 주]]", t0.slice(5).replace("-", ".") + " ~ " + t1.slice(5).replace("-", ".") + " · 한국 시간 · 미국 지표는 밤 9~10시 반 발표");
  // 이번 주 일정이 적으면 다음 주 것으로 채운다 (구분 줄 표시)
  var list = week.slice(), extra = 0;
  while (list.length < 7 && extra < next.length) list.push(Object.assign({ next: true }, next[extra++]));
  var h = cH(c, list.length, 96, true), last = "", nextShown = false;
  list.forEach(function (e) {
    if (e.next && !nextShown) { cText(g, "다음 주", P + 4, c.y + 24, 22, 800, CARD_C.sub); c.y += 34; nextShown = true; }
    var dstr = e.d.slice(5).replace("-", "/") + "(" + pubDow(e.d) + ")";
    cBox(g, P, c.y, W, h - 10, 14);
    if (e.k === "hol") cRound(g, P, c.y, W, h - 10, 14, "#f6f3ec");
    cText(g, dstr, P + 22, c.y + h * 0.5 + 8, 24, 800, e.d === last ? CARD_C.sub : CARD_C.navy);
    var tx = P + 170;
    cText(g, cFit(g, e.t + (e.sure === false ? " (예정)" : ""), W - 190, 27, 700), tx, c.y + (e.n ? h * 0.42 : h * 0.5 + 8), 27, 700, CARD_C.txt);
    if (e.n) cText(g, cFit(g, e.n, W - 190, 21, 500), tx, c.y + h * 0.42 + 30, 21, 500, CARD_C.sub);
    last = e.d; c.y += h;
  });
  cNote(c, "일정은 발표 기관 사정으로 바뀔 수 있어요. 발표 당일 아침 다시 확인하세요.");
  cFoot(c, "FOMC·BLS·BEA·한국은행 공개 일정 · 투자 조언 아님");
  return c.cv;
}
function pubTermCard(term) {
  var c = cNew(), g = c.g, P = CARD.PAD, W = CARD.W - P * 2;
  cHead(c, "용어 한 입", "[[" + term[0] + "]]", term[1]);
  cBox(g, P, c.y, W, 10, 4); // spacer-less
  var y1 = cWrap(g, term[2], P + 32, c.y + 56, W - 64, 30, 500, CARD_C.txt, 46, 6);
  cBox(g, P, c.y, W, y1 - c.y + 10, 18); cWrap(g, term[2], P + 32, c.y + 56, W - 64, 30, 500, CARD_C.txt, 46, 6);
  c.y = y1 + 36;
  var y2 = cWrap(g, term[3], P + 32, c.y + 70, W - 64, 26, 500, CARD_C.txt2, 38, 4);
  cBox(g, P, c.y, W, y2 - c.y + 14, 18); cRound(g, P, c.y + 14, 6, y2 - c.y - 14, 3, CARD_C.gold);
  cText(g, "💡 숫자로 보면", P + 32, c.y + 38, 23, 800, CARD_C.warmTxt);
  cWrap(g, term[3], P + 32, c.y + 70, W - 64, 26, 500, CARD_C.txt2, 38, 4);
  c.y = y2 + 30;
  cNote(c, "헷갈리는 용어는 댓글로 — 다음 카드로 만들어 드려요");
  cFoot(c, "우상향연구소 용어 시리즈 · 투자 조언 아님", "term");
  return c.cv;
}
if (typeof CARD_TIP !== "undefined") CARD_TIP.term = ["이 시리즈를 보는 법", "하루 한 개씩, 뉴스에 나온 말을 바로 찾아보는 용도예요. 외우기보다 '내 계좌에선 이 숫자가 얼마지?'를 한 번 확인해 보세요."];

/* ---------- ⑥ 정책 카드 (v8.4) ----------
   정책·제도 변경을 '표 + 조건'으로. 사람들이 실제로 찾는 숫자(구간별 금리·한도·요건)를 그대로 보여준다.
   항목은 아래 PUB_POLICY에 추가하거나, 발행 도우미 '정책 카드' 탭의 편집창(JSON)에서 바로 추가·수정할 수 있다(이 기기 저장).
   ※ 정책 숫자는 기관 공지 그대로 옮겨야 한다. src·eff(적용일)를 꼭 적고, 카드 바닥에 자동 표기된다. */
var PUB_POLICY = [
  {
    id: "didimdol-2025-03", t: "디딤돌대출 금리", short: "내집마련 디딤돌대출", eff: "2025.3.24 적용", src: "주택도시기금 · 하나은행 상품안내",
    title: "디딤돌대출, 내 소득이면 [[금리 몇 %]]?", sub: "부부합산 연소득 × 만기 — 일반 가구 기본금리",
    table: { head: ["연소득(부부합산)", "10년", "15년", "20년", "30년"], rows: [["2천만원 이하", "2.85%", "2.95%", "3.05%", "3.10%"], ["2천~4천만원", "3.20%", "3.30%", "3.40%", "3.45%"], ["4천~7천만원", "3.35%", "3.65%", "3.75%", "3.80%"], ["7천~8.5천만원(신혼)", "3.90%", "4.00%", "4.10%", "4.15%"]] },
    table2: { title: "신혼가구 특별금리 (부부합산 8.5천만원 이하)", head: ["연소득(부부합산)", "10년", "15년", "20년", "30년"], rows: [["2천만원 이하", "2.55%", "2.65%", "2.75%", "2.80%"], ["2천~4천만원", "2.90%", "3.00%", "3.10%", "3.15%"], ["4천~7천만원", "3.25%", "3.35%", "3.45%", "3.50%"], ["7천~8.5천만원", "3.60%", "3.70%", "3.80%", "3.85%"]] },
    bullets: { title: "추가 할인 (우대금리 · 중복 가능 · 5년간)", items: ["다자녀 0.7%p · 2자녀 0.5%p · 1자녀 0.3%p", "생애최초 · 신혼 · 장애인 · 다문화 · 한부모 0.2~0.5%p", "청약저축 가입자 0.3~0.5%p (납입 기간·회차에 따라)", "부동산 전자계약 0.1%p · 지방 미분양주택 0.2%p", "저액 대출(한도의 30% 이하) 0.1%p · 중도상환 40% 이상 0.2%p"] },
    notes: ["최저금리 하한: 일반 1.5% · 신혼 1.2%", "지방 주택 0.2%p 인하 · 5년 변동 +0.1%p · 10년 고정 +0.2%p · 순수 고정 +0.3%p", "신생아 특례는 별도 표 (소득 2억원까지, 1.80%~4.50%)"],
    check: "금리는 분기마다 바뀔 수 있어요 — 발행 전 주택도시기금(nhuf.molit.go.kr) 공지에서 적용일을 확인하세요",
    tags: ["디딤돌대출", "주택담보대출", "내집마련", "신혼부부대출"]
  }
];
function pubPolicyAll() { var custom = []; try { custom = JSON.parse(localStorage.getItem("sm.policy") || "[]"); } catch (e) { custom = []; } var byId = {}; PUB_POLICY.concat(custom).forEach(function (p) { if (p && p.id) byId[p.id] = p; }); return Object.keys(byId).map(function (k) { return byId[k]; }); }
function pubPolicySave(arr) { try { localStorage.setItem("sm.policy", JSON.stringify(arr)); } catch (e) {} }
/* 정책 카드 묶음: ① 표 카드 (표 + 핵심 메모) ② 조건 카드 (두 번째 표 / 우대 조건 / 메모). 들어갈 게 적으면 1장으로 */
function pubPolicyCards(pl) {
  CARD_STYLE = "regular"; CARD_SERIES = "POLICY · " + (pl.eff || "");
  var out = [], T = (pl.table2 ? 1 : 0) + (pl.bullets ? 1 : 0) + 1, c, n = 0;
  function head(c, title, sub) { n++; cHead(c, "POLICY · " + cDate(Date.now()), title, sub, n, T); }
  function foot(c) { cFoot(c, "출처: " + (pl.src || "기관 공지") + (pl.eff ? " · " + pl.eff : "") + " · 대출·투자 권유 아님"); }
  function tbl(c, t, reserve) { var n = t.rows.length, rh = Math.max(56, Math.min(112, Math.floor((CARD.H - 170 - c.y - reserve) / (n + 1)))); cTable(c, t.head, t.rows, { hi: t.hi, rowH: rh, fs: rh >= 100 ? 32 : rh >= 84 ? 30 : rh >= 70 ? 27 : 24 }); }
  c = cNew(); head(c, pl.title || pl.t, pl.sub || "");
  tbl(c, pl.table, pl.notes && pl.notes.length ? 150 + Math.min(pl.notes.length, 2) * 36 : 0);
  if (pl.notes && pl.notes.length && !pl.table2 && !pl.bullets) cBullets(c, "함께 알아둘 것", pl.notes, { fs: 25 });
  else if (pl.notes && pl.notes.length) cBullets(c, "핵심 메모", pl.notes.slice(0, 2), { fs: 25 });
  if (pl.check) cNote(c, "※ " + pl.check);
  foot(c); out.push({ name: "1_" + pl.t.replace(/\s/g, ""), cv: c.cv });
  if (pl.table2) {
    c = cNew(); head(c, pl.table2.title.replace(/\(.*\)/, "").trim() + " [[금리표]]", pl.table2.title);
    tbl(c, pl.table2, pl.notes && pl.notes.length > 2 ? 150 + (pl.notes.length - 2) * 36 : 0);
    if (pl.notes && pl.notes.length > 2) cBullets(c, "함께 알아둘 것", pl.notes.slice(2), { fs: 25 });
    if (pl.check) cNote(c, "※ " + pl.check); foot(c); out.push({ name: "2_" + pl.table2.title.slice(0, 8).replace(/\s/g, ""), cv: c.cv });
  }
  if (pl.bullets) {
    c = cNew(); head(c, "[[" + pl.bullets.title.split(" (")[0] + "]] 조건", pl.bullets.title);
    cBullets(c, null, pl.bullets.items, { fs: 27 });
    if (pl.notes && pl.notes.length) cBullets(c, "함께 알아둘 것", pl.notes, { fs: 25 });
    if (pl.check) cNote(c, "※ " + pl.check); foot(c); out.push({ name: (pl.table2 ? 3 : 2) + "_조건", cv: c.cv });
  }
  CARD_SERIES = "";
  return out;
}
function pubPolicyCaption(pl) {
  var lines = [pl.short || pl.t, "", "📋 " + (pl.sub || "")];
  pl.table.rows.slice(0, 6).forEach(function (r) { lines.push("· " + r[0] + ": " + r.slice(1).join(" / ")); });
  if (pl.bullets) { lines.push(""); lines.push("➕ " + pl.bullets.title); pl.bullets.items.slice(0, 4).forEach(function (t) { lines.push("· " + t); }); }
  if (pl.notes) { lines.push(""); pl.notes.slice(0, 2).forEach(function (t) { lines.push("※ " + t); }); }
  lines.push(""); lines.push("내 소득 구간은 어디인지 표에서 찾아보세요. 조건이 바뀌면 다시 정리해 올릴게요.");
  var tags = PUB_TAGS_BASE.concat(pl.tags || []).map(function (x) { return "#" + x; }).join(" ");
  var ig = lines.join("\n") + "\n\n※ 출처: " + (pl.src || "") + (pl.eff ? " · " + pl.eff : "") + " · 투자·대출 권유 아님, 최신 공지 확인 필수\n\n" + tags;
  var th = lines.slice(0, 10).join("\n"); if (th.length > 480) th = th.slice(0, 470).replace(/\n[^\n]*$/, "") + "…";
  return { ig: ig, th: th + "\n\n(출처: " + (pl.src || "") + ")", igLen: ig.length };
}
function pubPolicyOpen(id) {
  var pl = pubPolicyAll().filter(function (p) { return p.id === id; })[0]; if (!pl) return;
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { CARD_TXT = ""; try { pubPolicyCards(pl); } catch (e) { console.warn(e); } if (!document.fonts || !document.fonts.load) return; var txt = CARD_TXT.replace(/\s+/g, ""); return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })); })
    .then(function () {
      var list; try { list = pubPolicyCards(pl); } catch (e) { console.warn(e); alert("카드를 만들지 못했어요: " + e.message); return; }
      var cap = pubPolicyCaption(pl), day = pubToday().replace(/-/g, ""), box = document.createElement("div");
      box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">⬇ 전부 저장</button><button class="chip" data-act="cap">📋 캡션 (' + cap.igLen + '자)</button><button class="chip" data-act="th">📋 스레드</button></div><div class="cardsWrap"></div>';
      var wrap = box.querySelector(".cardsWrap");
      list.forEach(function (it, i) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_정책_" + pl.id + "_" + day + "_" + it.name + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + (i + 1) + '. ' + it.name.replace(/^\d_/, "") + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
      box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
      box.querySelector('[data-act="cap"]').onclick = function () { chCopy(cap.ig, this); };
      box.querySelector('[data-act="th"]').onclick = function () { chCopy(cap.th, this); };
      infoModal.open("🃏 " + pl.t + " · " + list.length + "장", box);
    });
}

/* ---------- 화면 ---------- */
var pubState = { tab: "plan", termOffset: 0, policy: null };
function pubRender() {
  var box = $("pubBox"); if (!box) return;
  var tabs = [["plan", "오늘 뭐 올리지"], ["per", "정기 발행"], ["topics", "주제 은행"], ["policy", "정책 카드"], ["caption", "캡션"], ["cal", "이번 주 일정"], ["term", "용어 한 입"]];
  var h = '<div class="pills" style="margin-bottom:10px">' + tabs.map(function (t) { return '<button data-pt="' + t[0] + '"' + (t[0] === pubState.tab ? ' class="active"' : '') + '>' + t[1] + '</button>'; }).join("") + '</div>';
  if (pubState.tab === "plan") {
    var ck = pubChecklist(), pl = pubPlan(), today = typeof perToday === "function" ? perToday() : [];
    if (today.length) h += '<div class="perToday">' + today.map(function (k) { var S = PER_SETS[k]; return '<div class="pubPlanItem per"><div><b>' + S.t + ' 올리는 날</b><small>' + S.when + ' 정기 세트 · 카드 ' + (k === "weekReview" || k === "monthReview" ? 7 : 5) + '장 + 캡션</small></div><button class="primary" data-per="' + k + '">🃏 세트 만들기</button></div>'; }).join("") + '</div>';
    h += '<div class="pubCk">' + ck.map(function (c) { return '<div class="pubCkRow ' + (c.ok ? "ok" : c.w ? "bad" : "warn") + '"><span>' + (c.ok ? "✅" : c.w ? "⛔" : "⚠️") + '</span><span>' + escapeHtml(c.t) + '</span></div>'; }).join("") + '</div>';
    h += '<h4 class="chSub">' + pl.dow + '요일 추천 세트' + (pl.why.length ? ' <small>오늘 신호: ' + pl.why.join(" · ") + '</small>' : '') + '</h4>';
    h += '<div class="pubPlan">' + pl.plan.map(function (p) { return '<div class="pubPlanItem"><div><b>' + p.t + '</b><small>' + p.d + '</small></div><button class="chip" data-make="' + p.kind + '" data-pick="' + (p.pick || "") + '">🃏 만들기</button></div>'; }).join("") + '</div>';
    h += '<div class="briefDim" style="margin-top:8px">권장 리듬: 인스타 캐러셀 주 3~4회(핵심 이슈 5 + 그날 1~2장) · 스레드 매일 1개(캡션 탭의 500자 버전) · 용어 카드는 저장용으로 매일 또는 격일</div>';
  } else if (pubState.tab === "per") {
    var td = typeof perToday === "function" ? perToday() : [];
    h += '<div class="briefDim" style="margin-bottom:8px">매일은 "오늘 뭐 올리지" 탭(전일 이슈 정리). 구간은 달력 기준이에요 — 한 주 = 월~일, 한 달 = 1일~말일. <b>정리</b> 세트는 구간 안 마지막 거래일 종가가 들어와 있어야만 발행용으로 만들어지고(아니면 "검토용 · 발행 금지" 도장), <b>예상</b> 세트는 일정과 지금 위치만 담고 방향 예측은 하지 않아요.</div>';
    var perRows = [{ when: "매일 아침", t: "📰 전일 이슈 정리 (검정 머리 · 이벤트성)", cards: "핵심 이슈 5 · 시장 온도 · 자금 흐름 · 급등락 · 돈이 몰린 곳 · 숫자 · 심리 온도계 (8장)", make: "brief" }].concat(Object.keys(PER_SETS).map(function (k) { var S = PER_SETS[k]; return { k: k, when: S.when, t: S.t, now: td.indexOf(k) >= 0, cards: { weekReview: "핵심 이슈 5 · 자산 성적표(시작→끝 가격) · 테마 · 급등락 · 날짜별 흐름 표 · 숫자 · 돈이 몰린 곳 (7장)", weekPreview: "이번 주 일정 · 볼 것 3~4가지 · 지난주 흐름 이어질까 · 적립 체크 · 용어 (5장)", monthReview: "핵심 이슈 5 · 자산 성적표(시작→끝 가격) · 테마 · 급등락 · 주차별 흐름 표 · 숫자 · 돈이 몰린 곳 + 과거 같은 달 (7장)", monthPreview: "이달 일정 · 과거 같은 달 계절성 · 역사 속 이달 · 지난달 요약→이달 볼 것 · 적립 계획 (5장)" }[k] }; }));
    h += '<div class="perCal">' + perRows.map(function (r) { return '<div class="perRow' + (r.now ? ' now' : '') + '"><div class="perWhen">' + r.when + (r.now ? ' <b>← 오늘</b>' : '') + '</div><div class="perBody"><b>' + r.t + '</b><small>' + r.cards + '</small></div>' + (r.k ? '<button class="chip" data-per="' + r.k + '">🃏 만들기</button>' : '<button class="chip" data-make="brief">🃏 만들기</button>') + '</div>'; }).join("") + '</div>';
    h += '<h4 class="chSub" style="margin-top:14px">수시 세트</h4><div class="perCal"><div class="perRow"><div class="perWhen">신호가 바뀔 때 · 월 1~2회</div><div class="perBody"><b>📚 스토리 덱 — 지금 신호 → 닮은 과거 → 그 뒤 무엇이 강했나</b><small>표지 · 지금 숫자 · 닮은 과거 3 · 사례별 1년 뒤(막대) · 승자 표 · 체크리스트 4 · 조건별 구성 표 · 구성 성과 · 마무리 (9~11장, 위 밝은 패널 + 아래 검정 메시지)</small></div><button class="chip" data-story="1">🃏 만들기</button></div></div>';
    h += '<div class="briefDim" style="margin-top:8px">월간 세트는 S&P500·코스피·금·비트코인 10년치를 처음 한 번 불러와서 몇 초 걸릴 수 있어요. 예상 세트는 "무엇을 볼지"만 담고 방향 예측은 하지 않아요(채널 원칙).</div>';
  } else if (pubState.tab === "topics") {
    h += '<div class="briefDim" style="margin-bottom:8px">카드로 바로 만들 수 있는 주제와, 손으로 보충하면 좋은 주제(수동)를 리듬별로 모았어요. 소재가 떠오르지 않는 날 펼쳐 보세요.</div>';
    h += PER_TOPICS.map(function (g, i) { return '<details class="chFold"' + (i === 0 ? ' open' : '') + '><summary>' + g.when + ' <small class="briefDim">' + g.items.length + '개</small></summary><ul class="perTopics">' + g.items.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join("") + '</ul></details>'; }).join("");
  } else if (pubState.tab === "policy") {
    var pls = pubPolicyAll(), cur = pls.filter(function (p) { return p.id === pubState.policy; })[0] || pls[0];
    h += '<div class="briefDim" style="margin-bottom:8px">정책·제도 변경은 "내 구간은 얼마?"가 핵심이라 표로 보여줘요. 숫자는 기관 공지를 그대로 옮기고 적용일·출처를 적어야 카드 바닥에 표기돼요.</div>';
    h += '<div class="pills" style="margin-bottom:8px">' + pls.map(function (p) { return '<button data-pol="' + p.id + '"' + (cur && p.id === cur.id ? ' class="active"' : '') + '>' + escapeHtml(p.t) + '</button>'; }).join("") + '</div>';
    if (cur) h += '<div class="chPlanItem"><div style="font-size:13.5px;line-height:1.7"><b>' + escapeHtml(cur.short || cur.t) + '</b> <span class="briefDim">' + escapeHtml(cur.eff || "") + ' · ' + escapeHtml(cur.src || "") + '</span><br>' + escapeHtml(cur.sub || "") + ' · 표 ' + cur.table.rows.length + '행' + (cur.table2 ? ' + 표 ' + cur.table2.rows.length + '행' : '') + (cur.bullets ? ' · 조건 ' + cur.bullets.items.length + '개' : '') + '<br><span class="briefDim">⚠️ ' + escapeHtml(cur.check || "") + '</span></div></div>' +
      '<div class="row" style="gap:6px;margin:8px 0"><button class="primary" data-make="policy" data-id="' + cur.id + '">🃏 카드 만들기</button><button class="chip" data-act="poledit">✏️ 편집 / 새 항목</button></div>';
    h += '<details class="chFold" id="polEditor"><summary>편집창 (JSON · 이 기기에 저장)</summary><div class="briefDim" style="margin:6px 0">아래 형식 그대로 복사해 숫자만 바꾸면 돼요. id가 같으면 덮어쓰고, 새 id면 추가돼요. 표의 값에 [[ ]]를 두르면 금색 강조.</div><textarea id="polJson" style="width:100%;min-height:220px;font:12px/1.5 ui-monospace,monospace;border:1px solid var(--line);border-radius:10px;padding:8px"></textarea><div class="row" style="gap:6px;margin-top:6px"><button class="primary" data-act="polsave">저장</button><button class="chip" data-act="poldel">이 항목 삭제(내 기기 저장분만)</button><span id="polMsg" class="briefDim"></span></div></details>';
  } else if (pubState.tab === "caption") {
    var cap = pubCaption();
    h += (cap.warn.length ? '<div class="chWhyBox">⚠️ ' + cap.warn.join(" / ") + '</div>' : '') +
      '<div class="row" style="gap:6px;margin-bottom:6px"><b>인스타그램 캡션</b><span class="briefDim">' + (cap.igLen || 0) + '자 / 2,200</span><button class="chip" data-copy="ig">📋 복사</button></div><pre class="chText" id="pubIg"></pre>' +
      '<div class="row" style="gap:6px;margin:12px 0 6px"><b>스레드</b><span class="briefDim">' + (cap.thLen || 0) + '자 / 500</span><button class="chip" data-copy="th">📋 복사</button></div><pre class="chText" id="pubTh"></pre>' +
      '<div class="briefDim" style="margin-top:8px">훅 문장과 질문은 날마다 자동으로 바뀌어요. 종목 이름을 직접 언급할 땐 "추천"처럼 읽히지 않게 사실(숫자)만 쓰세요. 해시태그는 5~10개가 적당해요.</div>';
  } else if (pubState.tab === "cal") {
    var up = pubUpcoming(14);
    h += '<div class="row" style="gap:6px;margin-bottom:8px"><button class="primary" data-make="cal">🃏 이번 주 일정 카드</button><span class="briefDim">앞으로 2주 · 한국 시간</span></div>' +
      '<div class="pubCal">' + (up.length ? up.map(function (e) { return '<div class="pubCalRow ' + e.k + '"><b>' + e.d.slice(5).replace("-", "/") + '(' + pubDow(e.d) + ')</b><div><span>' + escapeHtml(e.t) + (e.sure === false ? ' <small class="briefDim">(예정)</small>' : '') + '</span>' + (e.n ? '<small>' + escapeHtml(e.n) + '</small>' : '') + '</div></div>'; }).join("") : '<div class="briefDim">2주 내 등록된 일정이 없어요.</div>') + '</div>' +
      '<div class="briefDim" style="margin-top:8px">일정은 publish.js 맨 위 PUB_CAL 목록에서 고쳐요. 출처: 연준(FOMC) · BLS(CPI·고용) · BEA(GDP·PCE) · 한국은행(금통위). 실적 발표일은 회사 공시로 확정되니 "(예정)" 표시는 발표 전 확인하세요.</div>';
  } else {
    var term = pubTerm(pubState.termOffset);
    h += '<div class="row" style="gap:6px;margin-bottom:8px"><button class="chip" data-term="-1">‹</button><b>' + escapeHtml(term[0]) + '</b><button class="chip" data-term="1">›</button><button class="primary" data-make="term">🃏 카드</button><button class="chip" data-copy="term">📋 캡션 복사</button></div>' +
      '<div class="chPlanItem"><div style="font-size:14px;line-height:1.7"><b>' + escapeHtml(term[1]) + '</b><br>' + escapeHtml(term[2]) + '<br><span class="briefDim">💡 ' + escapeHtml(term[3]) + '</span></div></div>' +
      '<div class="briefDim" style="margin-top:8px">용어 ' + PUB_TERMS.length + '개가 날짜 순으로 돌아가요(오늘 자동 선택). 댓글로 들어온 용어는 publish.js의 PUB_TERMS에 한 줄 추가하면 돼요.</div>';
  }
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-pt]"), function (b) { b.onclick = function () { pubState.tab = b.getAttribute("data-pt"); pubRender(); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-pol]"), function (b) { b.onclick = function () { pubState.policy = b.getAttribute("data-pol"); pubRender(); }; });
  if ($("polJson")) {
    var curP = pubPolicyAll().filter(function (p) { return p.id === pubState.policy; })[0] || pubPolicyAll()[0];
    $("polJson").value = JSON.stringify(curP, null, 1);
    var ed = box.querySelector('[data-act="poledit"]'); if (ed) ed.onclick = function () { $("polEditor").open = true; $("polJson").focus(); };
    box.querySelector('[data-act="polsave"]').onclick = function () {
      var obj; try { obj = JSON.parse($("polJson").value); } catch (e) { $("polMsg").textContent = "JSON 형식 오류: " + e.message; return; }
      if (!obj.id || !obj.t || !obj.table || !obj.table.head || !obj.table.rows) { $("polMsg").textContent = "id, t, table.head, table.rows는 꼭 필요해요"; return; }
      var arr = []; try { arr = JSON.parse(localStorage.getItem("sm.policy") || "[]"); } catch (e) {} arr = arr.filter(function (p) { return p.id !== obj.id; }); arr.push(obj); pubPolicySave(arr); pubState.policy = obj.id; pubRender();
    };
    box.querySelector('[data-act="poldel"]').onclick = function () { var arr = []; try { arr = JSON.parse(localStorage.getItem("sm.policy") || "[]"); } catch (e) {} pubPolicySave(arr.filter(function (p) { return p.id !== pubState.policy; })); pubState.policy = null; pubRender(); };
  }
  Array.prototype.forEach.call(box.querySelectorAll("[data-story]"), function (b) { b.onclick = function () { storyOpen(); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-per]"), function (b) { b.onclick = function () { perOpen(b.getAttribute("data-per")); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-term]"), function (b) { b.onclick = function () { pubState.termOffset += +b.getAttribute("data-term"); pubRender(); }; });
  if ($("pubIg")) { var cap2 = pubCaption(); $("pubIg").textContent = cap2.ig; $("pubTh").textContent = cap2.th; }
  Array.prototype.forEach.call(box.querySelectorAll("[data-copy]"), function (b) {
    b.onclick = function () { var k = b.getAttribute("data-copy"), cap3 = pubCaption(); chCopy(k === "ig" ? cap3.ig : k === "th" ? cap3.th : pubTermCaption(pubTerm(pubState.termOffset)), b); };
  });
  Array.prototype.forEach.call(box.querySelectorAll("[data-make]"), function (b) {
    b.onclick = function () {
      var k = b.getAttribute("data-make");
      if (k === "issues" && chState.issues) issuesCardOpen(chState.issues);
      else if (k === "brief") { if (typeof briefState !== "undefined" && !briefState.result && typeof loadBrief === "function") loadBrief(false); setTimeout(function () { cardsOpen("brief"); }, briefState.result ? 0 : 1500); }
      else if (k === "channel") cardsOpen("channel");
      else if (k === "mind") navTo("mind");   // 유형 테스트 페이지에서 결과 카드 생성
      else if (k === "cal") pubSingleCard(pubCalCard, "uphill.lab_이번주일정_" + pubToday().replace(/-/g, "") + ".png", "🗓️ 이번 주 일정");
      else if (k === "policy") pubPolicyOpen(b.getAttribute("data-id"));
      else if (k === "term") pubSingleCard(function () { return pubTermCard(pubTerm(pubState.termOffset)); }, "uphill.lab_용어_" + pubTerm(pubState.termOffset)[0].replace(/[^\w가-힣]/g, "") + ".png", "📖 용어 한 입");
    };
  });
}
function pubSingleCard(draw, file, title) {
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { CARD_TXT = ""; draw(); if (!document.fonts || !document.fonts.load) return; var txt = CARD_TXT.replace(/\s+/g, ""); return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })); })
    .then(function () {
      var cv = draw(), url = cv.toDataURL("image/png"), box = document.createElement("div");
      box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="save">⬇ 저장</button>' + (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유</button>' : '') + '</div><img alt="" style="width:100%;max-width:420px;border-radius:12px;display:block;margin:0 auto">';
      box.querySelector("img").src = url;
      box.querySelector('[data-act="save"]').onclick = function () { var l = document.createElement("a"); l.href = url; l.download = file; document.body.appendChild(l); l.click(); l.remove(); };
      var sh = box.querySelector('[data-act="share"]'); if (sh) sh.onclick = function () { cv.toBlob(function (b) { var f = new File([b], file, { type: "image/png" }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(function () {}); }); };
      infoModal.open(title, box);
    });
}
/* 오늘의 브리핑(공개)에도 이번 주 일정 한 줄 */
function pubBriefLine() {
  var el = $("briefCal"); if (!el) return;
  var up = pubUpcoming(7).filter(function (e) { return e.k !== "hol"; }).slice(0, 4);
  el.innerHTML = up.length ? '<span class="briefDim">🗓️ 이번 주</span> ' + up.map(function (e) { return '<span class="briefHist"><b>' + e.d.slice(5).replace("-", "/") + '(' + pubDow(e.d) + ')</b> ' + escapeHtml(e.t.replace(/^[^\s]+\s/, "")) + '</span>'; }).join("") : "";
}
