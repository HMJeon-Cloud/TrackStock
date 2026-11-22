/* ============================================================
   v15.00 거장을 '전문가처럼' 쓰기 (gurux3.js)
   펀드매니저 · 애널리스트는 거장의 움직임을 그대로 따라 사지 않는다. 사람마다 '무엇을 어디서 읽고, 어디에 쓰는가'가 다르다.
   ① 전문가 활용 지도   — 유형별 · 인물별: 신호가 먼저 나오는 곳 · 쓰임 · 시차 · 따라 사기 적합도 · 근거 연구
   ② 복제 적합도        — 13F 기록으로 계산: 상위 종목 유지율 · 회전율 · 집중도 · 13F 신뢰도  (느린 손만 따라 산다)
   ③ 합의 · 쏠림        — 여러 거장의 상위 10종목에 함께 든 종목(골드만 VIP 방식) · 같이 팔릴 위험
   ④ 산 구간과 지금     — 이번 분기에 산 종목의 그 분기 가격대(저 ~ 고 · 평균)와 지금 가격
   근거(보고서에 출처 링크):
     · 버핏 복제: 공개 다음 달부터 따라 산 가상 계좌도 초과수익(1976~2006 · Martin & Puthenpurackal)
     · 확신 = 크기: 운용역의 가장 큰 확신 종목이 월 0.39~1.27%p 초과(Cohen · Polk · Silli "Best Ideas")
     · 복제 펀드: 분기 공시(2004~) 뒤 복제 성과가 원본과 비슷(Verbeek & Wang)
     · 행동주의: 개입 공시 무렵 약 +7%, 1년 안 되돌림 없음(2001~2006 · Brav 외)
     · 합의 종목: 골드만 VIP — 2001년 이후 분기의 59%에서 S&P500 상회, 2022년 -31.9% vs -18.1%
     · 13D 기한: 2024년부터 5영업일(그전 10일)
   계산 · 저장은 gurux.js, 화면 틀은 gurux2.js를 그대로 쓴다. 새 서버 호출은 ④의 시세 받기뿐(기존 /api/chart).
   ============================================================ */
var GZ_CH = { f13: "13F", d13: "13D 공시", letter: "서한", memo: "메모", tv: "방송 인터뷰", sns: "SNS", daily: "일별 매매 공개", conf: "콘퍼런스", book: "글 · 저서", call: "분기 설명회", meet: "주주총회", news: "뉴스레터", web: "웹캐스트" };
/* 전문가들이 13F를 다루는 다섯 가지 원칙 */
var GZ_RULES = [
  ["느린 손만 따라 산다", "13F는 분기 말 뒤 45일에 나오는 옛 사진이에요. 몇 년씩 들고 가는 사람의 것만 따라 살 가치가 있어요 — 아래 '복제 적합도'가 이걸 재요."],
  ["크기가 확신이다", "운용역이 가장 크게 실은 종목이 나머지보다 꾸준히 더 올랐다는 연구가 있어요. 종목 수가 아니라 비중을, 그리고 비중을 '바꾼 폭'을 봐요."],
  ["합의는 순풍이자 쏠림이다", "여러 펀드가 같이 든 종목은 평소에는 지수를 이겼지만, 다 같이 팔 때는 지수보다 훨씬 크게 빠졌어요."],
  ["13D와 발언이 13F보다 빠르다", "5% 넘게 사면 5영업일 안에 공시(13D)해야 해요. 행동주의는 13D, 매크로는 발언, 가치 장기는 서한이 먼저예요."],
  ["안 보이는 것을 먼저 따진다", "공매도 · 채권 · 선물 · 현금 · 해외 주식은 13F에 없어요. 옵션 금액은 기초자산 값이라 실제 베팅보다 크게 보여요."]
];
/* 유형별 — 전문가는 이렇게 쓴다 */
var GZ_USE = {
  value: { one: "신규 매수 = 조사할 후보 · 산 가격대와 지금 가격을 견준다", copy: [3, "높음"], first: "13F의 신규 · 전량 매도, 그리고 연례 주주서한.",
    pro: ["새로 산 종목을 '조사할 후보 목록'으로 써요 — 거장이 사업을 이미 검증했다는 점을 출발점으로 삼고 자기 분석을 얹어요.", "거장이 산 분기의 가격대와 지금 가격을 견줘요. 그 가격대 아래로 내려오면 '거장보다 싸게 살 자리'로 봐요.", "현금이 쌓이고 순매도가 이어지면 '살 만한 값이 없다'는 시장 온도계로 인용해요."],
    lag: "45일 늦지만, 몇 년씩 보유하는 사람이라 늦게 따라가도 차이가 작아요.", ev: "버핏이 산 종목을 '공개된 다음 달'부터 따라 산 가상의 계좌도 시장을 크게 이겼다는 연구가 있어요(1976~2006년). 다만 공개 당일 급등한 값에 사는 것은 그 연구의 가정과 달라요." },
  deep: { one: "'지금이 사이클의 어디인가'를 읽는다 · 버려진 곳의 목록", copy: [2, "중간"], first: "투자자 서한과 메모(막스의 메모, 클라만 · 아인혼의 서한). 채권 · 부실자산이 본업이라 13F는 일부예요.",
    pro: ["'지금이 사이클의 어디인가'를 읽는 데 써요 — 이들이 공격적으로 사기 시작하면 '공포가 값에 충분히 반영됐다'는 신호로 봐요.", "새로 산 종목의 업종을 모아 '시장이 버린 곳' 목록을 만들어요.", "시점이 이르기 쉽다는 것을 전제로, 한 번에 사지 않고 나눠서 따라가요."],
    lag: "서한은 분기 뒤 몇 주, 13F는 45일. 이들의 매수는 바닥보다 앞서는 경우가 많아요.", ev: "" },
  activist: { one: "13D가 뜬 종목을 '이벤트'로 다룬다 — 요구사항과 일정을 추적", copy: [2, "중간"], first: "13D 공시(5% 넘게 사면 5영업일 안) · 공개서한 · 주총 표 대결. 13F보다 훨씬 빨라요.",
    pro: ["13D가 뜬 종목을 '이벤트'로 다뤄요 — 무엇을 요구하는지(분할 · 자사주 · 이사 교체 · 매각), 주총까지 일정이 어떤지를 추적해요.", "공시 무렵 오른 폭이 1년 안에 되돌려지지 않았다는 연구가 있어, 발표 뒤에 들어가도 '캠페인이 성공하는가'에 거는 것으로 봐요.", "전량 매도는 캠페인 종료(성공이든 포기든) — 촉매가 사라졌다는 뜻이라 보유 이유를 다시 점검해요."],
    lag: "13D는 5영업일(2024년부터 · 그전에는 10일). 캠페인은 보통 1~3년.", ev: "행동주의 펀드의 개입이 공시된 무렵 주가는 평균 7%쯤 더 올랐고, 그 뒤 1년 동안 되돌림이 없었어요(2001~2006년 미국 사례 연구)." },
  growth: { one: "합의 종목과 테마 이동을 읽는다 — 쏠림 위험의 지표", copy: [1, "낮음~중간"], first: "13F의 상위 종목 묶음, 그리고 콘퍼런스 · 팟캐스트 · SNS 발언. ARK는 매일 매매를 공개해요.",
    pro: ["여러 성장 펀드가 같이 든 종목을 '합의 종목'으로 묶어 봐요 — 평소에는 순풍이지만, 다 같이 팔 때 가장 크게 빠지는 쏠림 위험의 지표이기도 해요.", "분기마다 테마가 어디로 옮겨 가는지(반도체 → 소프트웨어 → 전력 …)를 읽어요.", "한 분기가 아니라 2~3분기 연속 같은 방향인지 확인해요 — 회전이 빨라 한 분기는 소음일 수 있어요."],
    lag: "45일. 회전이 빨라 상위 몇 종목만 믿을 만해요.", ev: "헤지펀드가 가장 많이 든 50종목 바구니(골드만삭스 VIP)는 2001년 이후 분기의 59%에서 S&P500을 이겼지만, 2022년에는 -32%로 지수(-18%)보다 훨씬 크게 빠졌어요." },
  macro: { one: "종목이 아니라 견해를 읽는다 — 내 시나리오의 반대 증거로", copy: [0, "낮음"], first: "방송 · 콘퍼런스 발언과 투자자 서한. 13F의 개별 종목은 생각의 조각이에요.",
    pro: ["발언에서 '금리 · 달러 · 원자재 · 경기' 견해를 뽑아 자기 시나리오의 반대 증거로 써요 — 종목을 따라 사는 용도가 아니에요.", "한 분기에 비중을 크게 뒤집었는지를 봐요. 매크로 투자자의 급선회는 '견해가 바뀌었다'는 신호예요.", "풋 · 콜 옵션은 방향 힌트로만 써요 — 13F의 옵션 금액은 기초자산 값이라 실제 건 돈보다 훨씬 커 보여요."],
    lag: "발언은 그날, 13F는 45일 뒤. 회전이 빨라 13F가 나올 때는 이미 바뀌었을 수 있어요.", ev: "" },
  voice: { one: "타이밍이 아니라 '꼬리 위험 점검표'로 쓴다", copy: [0, "해당 없음"], first: "방송 인터뷰 · 분기 서한 · 뉴스레터 · 웹캐스트. 13F가 없거나 읽을 수 없는 사람들이에요.",
    pro: ["타이밍 신호가 아니라 '꼬리 위험 점검표'로 써요 — 경고가 맞더라도 몇 년 이른 경우가 많았어요.", "여러 명이 같은 위험(부채 · 버블 · 신용)을 말하기 시작하면 포지션 크기와 현금 비중을 점검하는 계기로 삼아요.", "자기 포지션에 유리한 말을 할 수 있다는 점을 늘 깔고 들어요 — 말과 실제 포지션은 다를 수 있어요."],
    lag: "발언은 그날. 다만 '언제'에 대한 정보는 거의 없어요.", ev: "" }
};
/* 인물별 — 신호가 먼저 나오는 곳(sig)과 전문가의 쓰임(pro) */
var GZ_P = {
  berkshire: { sig: ["f13", "letter", "meet"], pro: "새로 산 종목은 공개 직후 주가가 뛰는 일이 잦아(이른바 버핏 효과) 추격하지 않고 조정을 기다려요. 분기 보고서의 현금 · 자사주 매입 규모는 '시장이 비싼가'의 온도계로 인용돼요. 2025년 말 버핏이 CEO에서 물러난 뒤로는 결정 주체가 달라졌다는 점을 감안해요." },
  himalaya: { sig: ["f13"], pro: "종목이 5~10개뿐이고 몇 년에 한 번 움직여서, 신규 · 증액 하나가 그대로 '가장 확신하는 생각'으로 읽혀요. 중국 본토 · 홍콩 보유는 13F에 없다는 점만 따로 챙겨요." },
  fundsmith: { sig: ["letter", "f13"], pro: "매년 초 주주서한에서 산 이유 · 판 이유를 직접 설명해요. 전문가들은 13F보다 이 서한을 먼저 읽고, '사업의 질이 나빠졌다'며 판 종목을 자기 보유 종목 점검에 써요." },
  akre: { sig: ["f13"], pro: "회전이 매우 느려 '따라 사기'에 가장 잘 맞는 유형이에요. 상위 종목이 그대로인지만 확인하고, 드문 신규는 '복리 기계' 후보로 조사해요." },
  pershing: { sig: ["sns", "d13", "call", "f13"], pro: "종목이 10개 안팎이라 13F가 전체 그림에 가깝고, 애크먼 본인이 SNS와 분기 설명회에서 논리를 공개해요. 따라 사는 자금이 많아 공개 직후 가격이 먼저 움직이는 편이라, 논리를 읽고 조정 때 접근해요. 금리 · 신용 헤지는 13F에 보이지 않아요." },
  tci: { sig: ["f13", "d13", "letter"], pro: "소수 종목을 몇 년씩 보유하는 집중형이라 미국 상장분은 따라 사기에 맞아요. 유럽 보유분은 13F 밖이라 전체 그림은 아니에요." },
  baupost: { sig: ["letter", "f13"], pro: "13F는 전체의 일부(현금 · 채권 · 비상장이 큼)라, 전문가들은 연례 서한에 담긴 현금 비중과 시장 평가를 더 무겁게 봐요. 새로 산 종목은 '버려진 곳' 찾기에 써요." },
  oaktree: { sig: ["memo"], pro: "막스의 메모가 본 신호예요. '지금 공격할 때인가 방어할 때인가'라는 사이클 위치 판단으로 읽고, 13F의 종목은 구조조정 뒤 받은 주식이 섞여 있어 의견으로 읽지 않아요." },
  greenlight: { sig: ["letter", "conf", "f13"], pro: "분기 서한과 콘퍼런스 발표에서 매수 · 공매도 논리를 공개해요. 공매도는 13F에 없으니 서한으로 확인하고, 매수 종목은 '싸고 자사주를 사는 회사' 찾기에 써요." },
  appaloosa: { sig: ["tv", "f13"], pro: "테퍼가 방송에서 시장 견해를 말한 날 시장이 반응한 일이 여러 번 있었어요(2010년의 이른바 '테퍼 랠리'가 자주 인용돼요). 13F는 집중돼 있지만 교체가 빨라, 종목보다 '위험을 늘리는가 줄이는가'로 읽어요." },
  pabrai: { sig: ["conf", "f13"], pro: "자산의 큰 부분이 미국 밖이라 13F는 조각이에요. 강연 · 인터뷰에서 밝히는 국가 · 업종 견해를 아이디어 찾기에 써요." },
  thirdpoint: { sig: ["letter", "d13", "f13"], pro: "분기 서한에서 새 포지션과 요구사항을 직접 밝혀요. 서한 → 13D → 13F 순으로 빠르니, 13F는 '이미 알려진 것의 확인'으로 써요." },
  icahn: { sig: ["d13", "letter"], pro: "13D와 공개서한이 신호예요. 지분 공개 직후 주가가 뛰는 일이 알려져 있지만, 전문가들은 요구가 관철되는지(이사회 의석 · 매각)를 끝까지 추적해요." },
  trian: { sig: ["d13", "letter"], pro: "긴 '백서'로 개선안을 공개하고 이사회 의석을 요구해요. 전문가들은 백서의 논리(경쟁사와의 마진 격차 · 구조 개편)를 읽고 주총 표 대결 일정을 달력에 넣어요." },
  elliott: { sig: ["d13", "letter"], pro: "공개서한과 13D가 신호예요. 13F에는 지수 풋 같은 헤지가 크게 잡혀 '약세 베팅'으로 오해되기 쉬운데, 전문가들은 이를 보험으로 읽어요." },
  starboard: { sig: ["d13", "letter", "conf"], pro: "13D와 발표 자료에 적힌 '목표 마진'이 기준선이에요. 전문가들은 그 목표가 분기 실적에서 실제로 좁혀지는지를 추적해요." },
  duquesne: { sig: ["tv", "conf", "f13"], pro: "방송 · 콘퍼런스 발언이 가장 빠른 신호이고, 13F는 '말과 행동이 같은가'를 확인하는 용도예요. 회전이 빨라 종목을 따라 사기에는 맞지 않고, 비중을 단번에 크게 바꾼 곳만 '방향 전환'으로 읽어요." },
  bridgewater: { sig: ["book", "f13"], pro: "13F는 ETF 중심의 수백 종목이라 종목을 따라 사는 것은 의미가 없어요. 달리오의 글(부채 사이클 등)은 장기 틀로, 13F는 '어느 나라 · 자산군 ETF를 늘렸나'로만 읽어요. 달리오는 2022년에 운용 일선에서 물러났다는 점도 감안해요." },
  soros: { sig: ["f13"], pro: "지금은 가족 자산을 운용하는 조직이고 조지 소로스 본인의 판단이 아니에요. 종목 수가 많고 교체가 잦아, 전문가들은 옵션 · ETF의 방향 정도만 참고해요." },
  tiger: { sig: ["f13"], pro: "같은 뿌리에서 나온 펀드들(타이거 컵)과 보유가 많이 겹쳐, 성장주 합의와 쏠림을 재는 기준점으로 써요. 비상장 비중이 커서 13F는 일부예요." },
  ark: { sig: ["daily", "sns", "f13"], pro: "매일 매매 내역을 공개하므로 13F를 기다릴 이유가 없어요. 전문가들은 ARK가 큰 지분을 가진 작은 종목의 수급 영향(환매 때 같이 팔림)을 따로 봐요." },
  coatue: { sig: ["f13", "conf"], pro: "기술주를 사고 파는(롱숏) 펀드라 공매도는 보이지 않아요. 상위 종목의 테마 이동(반도체 ↔ 소프트웨어 ↔ 전력)을 읽는 데 써요." },
  altimeter: { sig: ["tv", "sns", "f13"], pro: "거스트너가 방송 · 팟캐스트에서 견해를 자주 밝히고, 종목이 적어 13F가 그 말을 확인해 줘요. 2022년 메타에 보낸 공개서한처럼 행동주의에 가까운 움직임도 있어요." },
  lonepine: { sig: ["f13"], pro: "창업자가 일선에서 물러난 조직형 펀드라 인물보다 조직의 판단으로 읽어요. 타이거 계열 합의 종목을 확인하는 표본으로 써요." },
  hhintl: { sig: ["f13", "sns"], pro: "애플에 크게 집중하고, 풋옵션을 팔아 원하는 값에 사는 방식으로 알려져 있어요. 중국 투자 커뮤니티에서 매매 이유를 직접 밝히는 일이 많아, 전문가들은 13F와 그 발언을 같이 봐요." },
  atreides: { sig: ["sns", "f13"], pro: "베이커가 SNS에서 반도체 · AI 산업 견해를 자주 밝혀요. 13F는 그 견해가 실제 비중으로 이어졌는지 확인하는 데 써요." },
  ptj: { sig: ["tv"], pro: "1년에 몇 번의 방송 인터뷰가 신호예요. 인플레이션 · 재정적자 · 금 · 비트코인에 대한 견해를 '큰 판의 위험 점검'으로 읽고, 본인의 규칙(200일선 아래에서는 방어)을 추세 판단에 빌려 써요." },
  burry: { sig: ["news", "sns"], pro: "2025년 11월 펀드 등록을 말소해 13F는 더 나오지 않아요. 지금은 유료 뉴스레터가 창구예요. 과거 13F의 풋옵션이 '기초자산 금액'으로 보도돼 베팅 크기가 부풀려진 일이 있어, 전문가들은 숫자보다 논리를 봐요." },
  gundlach: { sig: ["web", "tv"], pro: "채권 시장의 눈으로 금리 · 달러 · 신용을 말해요. 분기 웹캐스트와 연준 회의 날 인터뷰를 '채권 시장이 주식에 보내는 경고'로 읽어요." },
  grantham: { sig: ["letter"], pro: "GMO 분기 서한의 버블 진단과 7년 자산군 기대수익이 신호예요. 맞더라도 몇 년 이른 경우가 많아, 타이밍이 아니라 '기대수익을 낮춰 잡는 근거'로 써요." }
};
function gzUseOf(id) { var P = GX_P[id]; return P ? (P.voice ? GZ_USE.voice : GZ_USE[P.ty]) : null; }
/* AI에게 주는 인물 정보에 덧붙이는 줄 (gurux.js gxProfileText가 부른다) */
function gxProText(id) { var Z = GZ_P[id], U = gzUseOf(id), L = []; if (Z) { L.push("신호가 먼저 나오는 곳: " + Z.sig.map(function (k) { return GZ_CH[k]; }).join(" · ")); L.push("전문가들은 이 사람을 이렇게 쓴다: " + Z.pro); } if (U) L.push("이 유형을 전문가가 쓰는 법: " + U.pro[0]); var c = null; try { c = gxCloneFit(id); } catch (e) {} if (c) L.push("복제 적합도(앱 계산 · 0~100): " + c.s + " — " + c.label + " (" + c.why + ")"); return L; }

/* ---------------- ② 복제 적합도 ---------------- */
function gzHave() { var o = {}; (typeof dsGurus === "function" ? dsGurus() : []).forEach(function (x) { o[x.id] = x; }); return o; }
function gzC01(x) { return Math.max(0, Math.min(1, x)); }
function gxCloneFit(id, gIn) {
  var P = GX_P[id]; if (!P || P.voice) return null; var g = gIn || gzHave()[id]; if (!g) return null;
  var key = id + ":" + (g.acc || g.period) + ":" + ((g.hist || []).length); GXA._fit = GXA._fit || {}; if (GXA._fit[key]) return GXA._fit[key];
  var H = (g.hist || []).filter(function (h) { return h && (h.top || []).length >= 3; }).slice(-7), ks = [], kf = function (x) { return x.t || x.n; };
  for (var i = 1; i < H.length; i++) { var a = H[i - 1].top.slice(0, 5).map(kf), b = H[i].top.slice(0, 5).map(kf); ks.push(a.filter(function (k) { return b.indexOf(k) >= 0; }).length / a.length); }
  var keep = ks.length ? ks.reduce(function (s, v) { return s + v; }, 0) / ks.length : null, turn = g.turn, c = gxConc(g), t5 = c ? c.t5 : null;
  var pk = keep != null ? gzC01((keep - 0.4) / 0.5) : turn != null ? gzC01(1 - turn / 0.35) : 0.5, pt = turn != null ? gzC01(1 - (turn - 0.05) / 0.3) : 0.5, pc = t5 != null ? gzC01((t5 - 0.2) / 0.4) : 0.5;
  var s = Math.round(40 * pk + 25 * pt + 15 * pc + 20 * P.trust / 3), cap = null;
  if (P.ty === "macro") cap = "매크로 유형 — 종목이 아니라 방향을 읽는 사람"; else if (P.trust <= 1) cap = "13F가 전체 자산의 조각"; if (cap) s = Math.min(s, 40);
  var why = [keep != null ? "상위 5종목 유지율 " + Math.round(keep * 100) + "%(" + ks.length + "분기)" : "분기 기록 부족", turn != null ? "분기 회전율 " + Math.round(turn * 100) + "%" : null, t5 != null ? "상위 5 비중 " + Math.round(t5 * 100) + "%" : null, "13F 신뢰도 " + P.trust + "/3"].filter(Boolean).join(" · ") + (cap ? " · " + cap : "");
  return (GXA._fit[key] = { id: id, s: s, keep: keep, nq: ks.length, turn: turn, t5: t5, trust: P.trust, cap: cap, label: s >= 70 ? "따라갈 수 있음" : s >= 45 ? "후보로만" : "따라 사기 부적합", cls: s >= 70 ? "hi" : s >= 45 ? "mid" : "lo", why: why });
}
function gzFitHtml() {
  var have = gzHave(), L = Object.keys(GX_P).filter(function (id) { return have[id]; }).map(function (id) { return gxCloneFit(id); }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }); if (L.length < 3) return "";
  var thin = L.filter(function (x) { return x.nq < 2; }).length;
  return '<div class="gzFit">' + L.map(function (x) { var P = GX_P[x.id], T = GX_TYPES[P.ty]; return '<button type="button" class="gzFr" data-gyp="' + x.id + '" style="--gx:' + T.c + '"><span class="n"><i></i>' + gxE(GX_NM[x.id]) + '</span><span class="gzFb"><span style="width:' + x.s + '%" class="' + x.cls + '"></span></span><b>' + x.s + '</b><span class="gzLv ' + x.cls + '">' + x.label + '</span><small>' + gxE(x.why) + '</small></button>'; }).join("") + '</div>' +
    '<p class="gyNote">점수(0~100) = 상위 5종목이 분기마다 얼마나 그대로인가(40) + 분기 회전율이 낮은가(25) + 몇 종목에 실려 있는가(15) + 13F가 생각을 얼마나 보여 주나(20). 매크로 유형과 13F가 조각인 사람은 40점을 넘지 않게 눌렀어요. 70 이상이면 13F가 늦게 나와도 지금 포트폴리오와 비슷할 가능성이 높은 \'느린 손\', 45 미만이면 종목이 아니라 방향 · 테마만 읽는 편이 맞아요. 점수가 높다는 것은 \'13F로 따라갈 수 있다\'는 뜻이지 \'수익이 좋다\'는 뜻이 아니에요 — 무엇을 왜 샀는지는 인물 칸의 해석에서 따로 봐요.' + (thin ? ' 분기 기록이 2개 미만인 ' + thin + '명은 회전율로 어림한 값이에요 — 13F 수집이 몇 번 더 돌면 정확해져요.' : '') + ' 이 점수는 순위의 \'종목별 거장 점수\'에서 사람마다의 무게로도 쓰여요.</p>';
}

/* ---------------- ③ 합의 · 쏠림 ---------------- */
function gxConsensus() {
  var G = typeof dsGurus === "function" ? dsGurus() : [], by = {}, ck = G.map(function (g) { return g.id + String(g.acc || g.period || "").slice(-6); }).join("|"); if (GXA._cons && GXA._consN === ck) return GXA._cons;
  G.forEach(function (g) { var P = GX_P[g.id]; if (!P || P.voice) return; (g.top || []).slice(0, 10).forEach(function (x, i) { if (!x.w || x.w < 0.02) return; var k = x.t || x.n, o = by[k] || (by[k] = { k: k, t: x.t, n: x.n, who: [] }); o.who.push({ id: g.id, nm: g.nm, ty: P.ty, w: x.w, rank: i + 1, chg: x.chg }); }); });
  var min = G.length >= 12 ? 3 : 2, L = Object.keys(by).map(function (k) { return by[k]; }).filter(function (x) { return x.who.length >= min; });
  L.forEach(function (x) { var ty = {}; x.who.forEach(function (w) { ty[w.ty] = 1; }); x.nty = Object.keys(ty).length; x.sumW = x.who.reduce(function (s, w) { return s + w.w; }, 0); x.who.sort(function (a, b) { return b.w - a.w; });
    x.adds = x.who.filter(function (w) { return w.chg === "new" || (typeof w.chg === "number" && w.chg >= 0.05); }).length; x.cuts = x.who.filter(function (w) { return typeof w.chg === "number" && w.chg <= -0.05; }).length;
    x.crowd = x.who.length >= 5 || (x.who.length >= 4 && x.nty <= 1); x.broad = x.nty >= 3; });
  L.sort(function (a, b) { return b.who.length - a.who.length || b.sumW - a.sumW; }); GXA._cons = L; GXA._consN = ck; return L;
}
function gzConsHtml() {
  var L = gxConsensus().slice(0, 8); if (!L.length) return "";
  return '<div class="gyGrid2">' + L.map(function (x) { return '<div class="gyCard gyLi"><div class="gyLiT">' + gyNm(x) + '<span class="gyBadges"><span class="gyPill gzN">' + x.who.length + '명 보유</span>' + (x.crowd ? '<span class="gyPill gzCr">쏠림 주의</span>' : x.broad ? '<span class="gyPill gzBr">유형을 넘은 합의</span>' : '') + '</span></div>' +
    gyWho(x.who.map(function (w) { return { html: gxE(w.nm) + ' <b>' + (w.w * 100).toFixed(1) + '%</b>', c: w.chg === "new" || (typeof w.chg === "number" && w.chg >= 0.05) ? "up" : typeof w.chg === "number" && w.chg <= -0.05 ? "dn" : "" }; }), function (w) { return w.c; }) +
    '<p class="gzCn">' + (x.adds || x.cuts ? '이번 분기 ' + (x.adds ? '늘린 ' + x.adds + '명' : '') + (x.adds && x.cuts ? ' · ' : '') + (x.cuts ? '줄인 ' + x.cuts + '명' : '') + ' — ' : '') + (x.crowd ? "많은 거장이 같이 들고 있어요. 평소에는 순풍이지만, 누군가 팔기 시작하면 같이 팔릴 수 있는 자리예요." : x.broad ? "성격이 다른 유형이 함께 들고 있어요 — 한 가지 이유(테마)가 아니라 여러 이유로 선택된 종목이에요." : "같은 유형 안의 합의예요 — 그 유형의 테마가 꺾이면 같이 움직여요.") + '</p></div>'; }).join("") + '</div>' +
    '<p class="gyNote">여러 거장의 상위 10종목(비중 2% 이상)에 함께 들어 있는 종목이에요 — 골드만삭스가 분기마다 내는 \'헤지펀드 VIP\' 바구니와 같은 방식이에요. 그 바구니는 2001년 이후 분기의 59%에서 S&P500을 이겼지만, 2022년에는 -32%로 지수(-18%)보다 훨씬 크게 빠졌어요. 그래서 전문가들은 합의 종목을 \'사야 할 목록\'이 아니라 \'비중을 지나치게 싣지 말아야 할 목록\'으로도 읽어요. 우리 표본은 ' + gzHave13() + '명이라 작다는 점도 감안해 주세요.</p>';
}
function gzHave13() { return (typeof dsGurus === "function" ? dsGurus() : []).filter(function (g) { return GX_P[g.id] && !GX_P[g.id].voice; }).length; }

/* ---------------- ① 전문가 활용 지도 ---------------- */
function gzUseHtml() {
  var cnt = function (ty, v) { return Object.keys(GX_P).filter(function (id) { return v ? GX_P[id].voice : GX_P[id].ty === ty && !GX_P[id].voice; }); };
  var h = '<ol class="gzRules">' + GZ_RULES.map(function (r, i) { return '<li><span class="no">' + (i + 1) + '</span><b>' + r[0] + '</b><p>' + r[1] + '</p></li>'; }).join("") + '</ol>';
  var card = function (key, nm, col, ids) { var U = GZ_USE[key]; if (!U || !ids.length) return "";
    return '<details class="gzT" style="--gx:' + col + '"' + (GXA.useOpen === key ? " open" : "") + ' data-gzuse="' + key + '"><summary><span class="h"><i></i><b>' + nm + '</b><span class="gzLv ' + ["lo", "mid", "mid", "hi"][U.copy[0]] + '">따라 사기 ' + U.copy[1] + '</span></span><span class="o">' + gxE(U.one) + '</span><span class="p">' + ids.map(function (id) { return gxE(GX_NM[id]); }).join(" · ") + '</span></summary>' +
      '<dl><dt>먼저 볼 곳</dt><dd>' + gxE(U.first) + '</dd><dt>전문가의 쓰임</dt><dd><ul>' + U.pro.map(function (x) { return '<li>' + gxE(x) + '</li>'; }).join("") + '</ul></dd><dt>시차</dt><dd>' + gxE(U.lag) + '</dd>' + (U.ev ? '<dt>근거</dt><dd>' + gxE(U.ev) + '</dd>' : '') + '</dl>' +
      '<div class="gzPl"><h6>인물마다 다르게 본다</h6>' + ids.map(function (id) { var Z = GZ_P[id]; if (!Z) return ""; var one = Z.pro; return '<div><button type="button" data-gyp="' + id + '">' + gxE(GX_NM[id]) + '</button><span class="sg">' + Z.sig.slice(0, 3).map(function (c, i) { return '<em class="' + (i === 0 ? "on" : "") + '">' + GZ_CH[c] + '</em>'; }).join("") + '</span><p>' + gxE(one) + '</p></div>'; }).join("") + '</div></details>'; };
  h += '<div class="gzMap">' + ["value", "deep", "activist", "growth", "macro"].map(function (k) { return card(k, GX_TYPES[k].nm, GX_TYPES[k].c, cnt(k)); }).join("") + card("voice", "발언형 (13F 없음)", "#5c6570", cnt(null, true)) + '</div>';
  return h + '<p class="gyNote">유형을 누르면 펼쳐져요. 인물마다의 쓰임은 인물 칸의 \'인물 소개\'에 따로 적었어요. 연구 결과는 과거 미국 시장의 평균이고, 앞으로도 같다는 보장은 없어요.</p>';
}
function gzProHtml(id) {
  var Z = GZ_P[id], U = gzUseOf(id), P = GX_P[id]; if (!Z || !U || !P) return ""; var T = GX_TYPES[P.ty], c = null; try { c = gxCloneFit(id); } catch (e) {}
  return '<div class="gzPro" style="--gx:' + T.c + '"><h5>전문가는 이 사람을 이렇게 쓴다</h5><div class="gzSig"><span>신호가 먼저 나오는 곳</span>' + Z.sig.map(function (k, i) { return '<em class="' + (i === 0 ? "on" : "") + '">' + GZ_CH[k] + '</em>'; }).join("") + '</div><p>' + gxE(Z.pro) + '</p>' +
    '<ul>' + U.pro.map(function (x) { return '<li>' + gxE(x) + '</li>'; }).join("") + '</ul>' +
    '<div class="gzKv"><div><span>시차</span><p>' + gxE(U.lag) + '</p></div><div><span>따라 사기</span><p>' + (c ? '<b class="gzLv ' + c.cls + '">' + c.s + ' · ' + c.label + '</b> ' + gxE(c.why) : P.voice ? "13F가 없어 따라 살 종목이 없어요 — 견해만 읽어요." : "13F를 받으면 복제 적합도를 계산해요.") + '</p></div></div>' + (U.ev ? '<p class="gzEv"><b>근거</b> ' + gxE(U.ev) + '</p>' : '') + '</div>';
}

/* ---------------- ④ 이번 분기에 산 종목 — 그때 가격대와 지금 ---------------- */
GXA.band = GXA.band || {};
function gzBandKey(id, g) { return id + ":" + g.period; }
function gzBandList(g) { var seen = {}; return (g.buys || []).filter(function (m) { if (!m.t || seen[m.t] || (m.w || 0) < 0.005) return false; seen[m.t] = 1; return true; }).slice(0, 8); }
function gzBandLoad(id, g) {
  var key = gzBandKey(id, g), L = gzBandList(g); if (!L.length || typeof getChartData !== "function") return Promise.resolve(null);
  var t1 = Date.parse(g.period + "T23:59:59Z"), t0 = g.prevPeriod ? Date.parse(g.prevPeriod + "T23:59:59Z") : t1 - 92 * 864e5; GXA.band[key] = { loading: true };
  return Promise.all(L.map(function (m) { return getChartData(m.t, "1y").then(function (d) { var rows = ((d && d.rows) || []).filter(function (r) { return r.c > 0; }), q = rows.filter(function (r) { return r.t > t0 && r.t <= t1; }); if (q.length < 20) return { t: m.t, n: m.n, kind: m.kind, w: m.w, pw: m.pw, miss: rows.length ? "분기 시세가 모자라요" : "시세를 받지 못했어요" };
      var lo = Infinity, hi = -Infinity, sum = 0; q.forEach(function (r) { if (r.c < lo) lo = r.c; if (r.c > hi) hi = r.c; sum += r.c; }); var last = rows[rows.length - 1];
      return { t: m.t, n: m.n, kind: m.kind, w: m.w, pw: m.pw, lo: lo, hi: hi, avg: sum / q.length, end: q[q.length - 1].c, now: last.c, nowT: last.t }; }).catch(function () { return { t: m.t, n: m.n, kind: m.kind, w: m.w, pw: m.pw, miss: "시세를 받지 못했어요" }; }); })).then(function (rows) { GXA.band[key] = { rows: rows, at: Date.now() }; return GXA.band[key]; });
}
function gzBandHtml(id, g) {
  if (!g) return ""; var L = gzBandList(g); if (!L.length) return ""; var B = GXA.band[gzBandKey(id, g)], P = GX_P[id], U = function (v) { return "$" + (v >= 100 ? v.toFixed(0) : v.toFixed(2)); }, pc = function (v) { return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%"; };
  var head = '<p class="gyNote" style="margin:0 0 10px">13F는 분기 말에 몇 주를 들고 있었는지만 알려 주고 얼마에 샀는지는 알려 주지 않아요. 그래서 전문가들은 그 분기의 가격대(가장 낮은 값 ~ 가장 높은 값)와 평균을 \'산 구간\'으로 놓고 지금 가격과 견줘요. 지금이 그 구간 아래면 거장보다 싸게 살 수 있는 자리지만, 그 뒤에 무엇이 바뀌었는지부터 확인해야 해요.</p>';
  if (!B) return head + '<div class="gyAct"><button type="button" class="gyBtn ghost" data-gzband="' + id + '">산 구간과 지금 가격 견주기</button><small>' + L.length + '종목의 최근 1년 시세를 받아요 · ' + L.map(function (m) { return gxE(m.t); }).join(", ") + '</small></div>';
  if (B.loading) return head + '<div class="gyEmpty">시세를 받는 중…</div>';
  var rows = B.rows || [], ok = rows.filter(function (r) { return !r.miss; }), under = ok.filter(function (r) { return r.now < r.lo; }).length;
  var h = head + '<div class="gzBd">' + rows.map(function (r) { var KN = { "new": "신규", add: "증액" }, nm = gyNm(r);
    if (r.miss) return '<div class="gzBr0"><div class="t">' + nm + '<span class="gyPill up">' + (KN[r.kind] || "") + '</span></div><span class="miss">' + r.miss + '</span></div>';
    var mn = Math.min(r.lo, r.now), mx = Math.max(r.hi, r.now), sp = mx - mn || 1, p = function (v) { return ((v - mn) / sp * 100).toFixed(1); }, d = r.now / r.avg - 1, pos = r.now < r.lo ? "under" : r.now > r.hi ? "over" : "in";
    return '<div class="gzBr0"><div class="t">' + nm + '<span class="gyPill up">' + (KN[r.kind] || "") + ' ' + gxPc(r.pw || 0, 1) + ' → ' + gxPc(r.w || 0, 1) + '</span></div>' +
      '<div class="bar"><span class="rg" style="left:' + p(r.lo) + '%;width:' + (p(r.hi) - p(r.lo)).toFixed(1) + '%"></span><span class="av" style="left:' + p(r.avg) + '%" title="분기 평균"></span><span class="nw ' + pos + '" style="left:' + p(r.now) + '%" title="지금"></span></div>' +
      '<div class="v"><span>분기 ' + U(r.lo) + ' ~ ' + U(r.hi) + '</span><span>평균 ' + U(r.avg) + '</span><span>지금 <b>' + U(r.now) + '</b></span><b class="' + (d < 0 ? "neg" : "pos") + '">평균 대비 ' + pc(d) + '</b><em class="' + pos + '">' + (pos === "under" ? "구간 아래" : pos === "over" ? "구간 위" : "구간 안") + '</em></div></div>'; }).join("") + '</div>';
  h += '<p class="gyNote">' + (ok.length ? ok.length + "종목 가운데 " + under + "종목이 그 분기의 가장 낮은 값보다 아래에 있어요. " : "") + '막대의 옅은 띠 = 그 분기 가격대 · 세로선 = 분기 평균 · 점 = 지금. ' + (P && (P.style === "swing" || P.ty === "macro" || P.ty === "growth") ? "이 사람은 교체가 빠른 편이라, 지금은 이미 팔았을 수 있어요 — 다음 13F에서 확인해 주세요. " : "") + '종가 기준이고 배당 · 환율은 넣지 않았어요.</p>';
  return h;
}
function gzBind(box) {
  Array.prototype.forEach.call(box.querySelectorAll("[data-gzband]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-gzband"), g = gzHave()[id]; if (!g) return; b.disabled = true; gzBandLoad(id, g).then(function () { if (typeof gyRender === "function") gyRender(); }); if (typeof gyRender === "function") gyRender(); }; });
  Array.prototype.forEach.call(box.querySelectorAll("details[data-gzuse]"), function (d) { d.addEventListener("toggle", function () { if (d.open) GXA.useOpen = d.getAttribute("data-gzuse"); else if (GXA.useOpen === d.getAttribute("data-gzuse")) GXA.useOpen = null; }); });
}
(function () {
  if (typeof document === "undefined") return; var st = document.createElement("style"); st.textContent =
    ".gzRules{list-style:none;margin:0 0 14px;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.gzRules li{border:1px solid rgba(17,24,39,.06);border-radius:14px;padding:12px 12px 10px;background:var(--card,#fff);box-shadow:0 1px 2px rgba(17,24,39,.04)}.gzRules .no{display:inline-flex;width:20px;height:20px;border-radius:50%;background:var(--txt,#191f28);color:#fff;font-size:11.5px;font-weight:800;align-items:center;justify-content:center;margin-bottom:6px}.gzRules b{display:block;font-size:13.5px;letter-spacing:-.2px;word-break:keep-all}.gzRules p{margin:4px 0 0;font-size:12px;line-height:1.55;color:var(--txt2,#4e5968);word-break:keep-all}" +
    ".gzMap{display:grid;gap:8px}.gzT{border:1px solid rgba(17,24,39,.06);border-left:4px solid var(--gx);border-radius:14px;background:var(--card,#fff);box-shadow:0 1px 2px rgba(17,24,39,.04);padding:0 16px}.gzT summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:290px 1fr;gap:4px 14px;padding:12px 0;align-items:center}.gzT summary::-webkit-details-marker{display:none}.gzT .h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.gzT .h i{width:9px;height:9px;border-radius:50%;background:var(--gx);flex:0 0 auto}.gzT .h b{font-size:14.5px;white-space:nowrap}.gzT .o{font-size:13.5px;font-weight:700;word-break:keep-all;line-height:1.5}.gzT .p{grid-column:2;font-size:12px;color:var(--sub,#8b95a1);line-height:1.5;word-break:keep-all}.gzT[open] summary{border-bottom:1px solid rgba(17,24,39,.06)}" +
    ".gzT dl,.gzKv{margin:0}.gzT dl{display:grid;grid-template-columns:96px 1fr;gap:8px 14px;padding:12px 0 14px;font-size:13px;line-height:1.65}.gzT dt{font-weight:800;color:var(--gx);font-size:12px;padding-top:2px}.gzT dd{margin:0;word-break:keep-all}.gzT ul,.gzPro ul{margin:0;padding-left:16px}.gzT li,.gzPro li{margin-bottom:3px;word-break:keep-all}" +
    ".gzPl{border-top:1px solid rgba(17,24,39,.06);padding:12px 0 14px}.gzPl h6{margin:0 0 8px;font-size:12px;font-weight:800;color:var(--gx)}.gzPl>div{display:grid;grid-template-columns:128px 1fr;gap:3px 12px;align-items:baseline;padding:7px 0;border-top:1px dashed rgba(17,24,39,.08)}.gzPl>div:first-of-type{border-top:0}.gzPl button{border:0;background:transparent;padding:0;font:inherit;font-size:13.5px;font-weight:800;text-align:left;cursor:pointer;color:var(--txt,#191f28);white-space:nowrap}.gzPl button:hover{color:var(--gx)}.gzPl .sg{display:flex;flex-wrap:wrap;gap:5px}.gzPl .sg em{font-style:normal;font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--gysoft,#f5f6f8);color:var(--txt2,#4e5968);white-space:nowrap}.gzPl .sg em.on{background:var(--gx);color:#fff}.gzPl p{grid-column:2;margin:0;font-size:12.5px;line-height:1.6;color:var(--txt2,#4e5968);word-break:keep-all}" +
    ".gzLv{display:inline-block;font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap;background:#eceff3;color:#5b6474}.gzLv.hi{background:var(--k-e2f4ea,#e2f4ea);color:var(--k-157347,#157347)}.gzLv.mid{background:#fbf1d9;color:#8a6414}.gzLv.lo{background:#eceff3;color:#5b6474}" +
    ".gzFit{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.gzFr{display:grid;grid-template-columns:max-content 1fr 30px max-content;gap:4px 10px;align-items:center;width:100%;text-align:left;white-space:normal;border:0;border-bottom:1px solid rgba(17,24,39,.06);background:transparent;padding:9px 2px;cursor:pointer;font:inherit;color:var(--txt,#191f28)}.gzFr:hover{background:var(--gysoft,#f5f6f8)}.gzFr .n{font-size:13.5px;font-weight:800;white-space:nowrap}.gzFr .n i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gx);margin-right:7px}.gzFb{display:block;height:8px;border-radius:999px;background:var(--gysoft,#f5f6f8);overflow:hidden;min-width:60px}.gzFb span{display:block;height:100%;border-radius:999px;background:#aeb5bf}.gzFb span.hi{background:var(--k-1f8a5b,#1f8a5b)}.gzFb span.mid{background:#d59a2a}.gzFr b{text-align:right;font-size:14px;font-variant-numeric:tabular-nums}.gzFr small{grid-column:1 / -1;font-size:11.5px;color:var(--sub,#8b95a1);line-height:1.5;word-break:keep-all}" +
    ".gyPill.gzN{background:var(--gysoft,#f5f6f8);color:var(--txt2,#4e5968)}.gyPill.gzCr{background:#fbf1d9;color:#8a6414}.gyPill.gzBr{background:var(--k-e2f4ea,#e2f4ea);color:var(--k-157347,#157347)}.gzCn{margin:8px 0 0;font-size:12.5px;line-height:1.6;color:var(--txt2,#4e5968);word-break:keep-all}" +
    ".gzPro{border:1px solid rgba(17,24,39,.06);border-left:4px solid var(--gx);border-radius:14px;padding:14px 16px;margin:14px 0;background:var(--card,#fff)}.gzPro h5{margin:0 0 10px;font-size:13.5px;font-weight:800;color:var(--gx)}.gzPro>p{margin:10px 0;font-size:14px;line-height:1.75;word-break:keep-all}.gzPro li{font-size:13px;line-height:1.65}.gzSig{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.gzSig span{font-size:12px;font-weight:700;color:var(--sub,#8b95a1);margin-right:2px}.gzSig em{font-style:normal;font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;background:var(--gysoft,#f5f6f8);color:var(--txt2,#4e5968);white-space:nowrap}.gzSig em.on{background:var(--gx);color:#fff}" +
    ".gzKv{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.gzKv>div{background:var(--gysoft,#f5f6f8);border-radius:10px;padding:9px 12px}.gzKv span{font-size:11.5px;font-weight:800;color:var(--sub,#8b95a1)}.gzKv p{margin:3px 0 0;font-size:12.5px;line-height:1.6;word-break:keep-all}.gzEv{margin:12px 0 0!important;padding-top:10px;border-top:1px dashed rgba(17,24,39,.12);font-size:12.5px!important;color:var(--txt2,#4e5968)}.gzEv b{margin-right:4px}" +
    ".gzBd{display:grid;gap:0;border:1px solid rgba(17,24,39,.06);border-radius:14px;background:var(--card,#fff);padding:2px 16px}.gzBr0{padding:12px 0;border-bottom:1px solid rgba(17,24,39,.06)}.gzBr0:last-child{border-bottom:0}.gzBr0 .t{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.gzBr0 .miss{font-size:12px;color:#c9772b;font-weight:700}.gzBr0 .bar{position:relative;height:14px;margin:10px 6px 8px;border-radius:999px;background:var(--gysoft,#f5f6f8)}.gzBr0 .rg{position:absolute;top:0;height:100%;border-radius:999px;background:rgba(20,22,28,.13)}.gzBr0 .av{position:absolute;top:-3px;width:2px;height:20px;margin-left:-1px;background:var(--accent,#14161c)}.gzBr0 .nw{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--txt,#191f28);box-shadow:0 0 0 3px var(--card,#fff)}.gzBr0 .nw.under{background:var(--down,#3182f6)}.gzBr0 .nw.over{background:var(--up,#f04452)}" +
    ".gzBr0 .v{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;font-size:12.5px;color:var(--txt2,#4e5968);font-variant-numeric:tabular-nums}.gzBr0 .v span,.gzBr0 .v b{white-space:nowrap}.gzBr0 .v em{font-style:normal;font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:#eceff3;color:#5b6474;white-space:nowrap;margin-left:auto}.gzBr0 .v em.under{background:var(--downSoft,#ebf2fd);color:var(--down,#3182f6)}.gzBr0 .v em.over{background:var(--k-fdecee,#fdecee);color:var(--up,#f04452)}" +
    ".gyKpi b small.gzLv{margin-left:6px;vertical-align:2px}" +
    ".gxVoiceN{border:1px dashed rgba(17,24,39,.18);border-radius:12px;padding:11px 14px;font-size:13px;line-height:1.65;color:var(--txt2,#4e5968);margin:4px 0 12px;word-break:keep-all}.gxVoiceN b{display:inline-block;font-size:11.5px;font-weight:800;background:#5c6570;color:#fff;border-radius:6px;padding:1px 8px;margin-right:6px}.gyVb{display:inline-block;font-style:normal;font-size:10.5px;font-weight:800;background:#5c6570;color:#fff;border-radius:5px;padding:1px 6px;margin-left:6px;vertical-align:1px;line-height:1.5;white-space:nowrap}.gyPeople button.on .gyVb{background:rgba(255,255,255,.28)}" +
    "@media screen and (max-width:900px){.gzRules{grid-template-columns:repeat(2,minmax(0,1fr))}.gzFit{grid-template-columns:1fr}}" +
    "@media screen and (max-width:640px){.gzPl>div{grid-template-columns:1fr}.gzPl p{grid-column:1}.gzRules{grid-template-columns:1fr}.gzT summary{grid-template-columns:1fr}.gzT .p{grid-column:1}.gzT dl{grid-template-columns:1fr;gap:2px 0}.gzT dd{margin-bottom:8px}.gzKv{grid-template-columns:1fr}.gzFr{grid-template-columns:max-content 1fr 30px}.gzFr .gzLv{grid-column:1 / -1;justify-self:start}.gzBr0 .v em{margin-left:0}}";
  document.head.appendChild(st);
})();
if (typeof module !== "undefined") module.exports = { GZ_P: GZ_P, GZ_USE: GZ_USE };
