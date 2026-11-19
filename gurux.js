/* ============================================================
   구루 인물 사전 · 유형별 읽기 (v14.50) — 관심 탭 '구루' 화면 위에 얹는다
   ① 유형(매크로 · 가치 장기 · 딥밸류 · 행동주의 · 기술 성장)과 인물 정보(철학 · 매매 습관 · 이력)
   ② 유형에 따라 13F에서 '무엇을 보고 무엇을 버릴지'를 다르게 읽는다 — 규칙으로 계산(이 단계에서는 AI 호출 없음)
   인물 정보는 널리 알려진 사실만 적었다. 숫자 · 날짜는 굵직한 것만.
   ============================================================ */
var GX_TYPES = {
  macro: { nm: "매크로", c: "#2f6fbd", d: "금리 · 통화 · 경기 흐름을 먼저 보고 자산을 고른다. 주식은 생각을 담는 그릇 가운데 하나다.",
    see: ["주식 총액이 늘었나 줄었나(위험을 늘리는 중인가)", "지수 · 국가 · 섹터 ETF 비중", "풋 · 콜 옵션의 방향", "한 분기에 비중을 크게 바꾼 곳"],
    skip: "비중 1% 안팎의 개별 종목 수십 개는 해석하지 않는다. 채권 · 통화 · 원자재 · 공매도는 13F에 없다 — 인터뷰와 서한을 같이 봐야 한다.",
    use: "'지금 위험을 늘릴 때인가 줄일 때인가'라는 큰 방향을 얻는다. 종목 따라 사기에는 맞지 않는다." },
  value: { nm: "가치 · 우량 장기", c: "#1f8a5b", d: "좋은 사업을 적당한 값에 사서 오래 들고 간다. 거의 움직이지 않는 것이 기본값이다.",
    see: ["새로 산 종목(드문 일이라 그 자체가 신호)", "오래 들고 있던 종목의 전량 매도(생각이 바뀌었다는 뜻)", "상위 5종목 비중", "몇 분기에 걸쳐 계속 사는 종목"],
    skip: "분기마다 몇 % 줄이고 늘리는 것은 대부분 자금 유출입 · 비중 관리다.",
    use: "'어떤 사업을 몇 년 들고 갈 만한가'의 후보 목록을 얻는다. 산 가격대가 공개되므로 지금 가격과 비교할 수 있다." },
  deep: { nm: "딥밸류 · 부실 · 크레딧", c: "#8a6414", d: "남들이 던지는 자산을 싸게 줍는다. 주식보다 채권 · 부실자산이 본업인 경우가 많다.",
    see: ["시장이 겁먹은 분기에 주식 총액이 늘었나", "새로 산 종목의 업종(어디가 버려졌다고 보는가)", "숏 · 헤지는 안 보인다는 점"],
    skip: "13F는 이들 자산의 일부다(채권 · 비상장 · 해외는 빠짐). 비중 숫자를 전체 계좌처럼 읽지 않는다.",
    use: "'지금 시장이 지나치게 싫어하는 곳이 어디인가'를 얻는다. 시점은 이르기 쉬우니 분할로 본다." },
  activist: { nm: "행동주의 · 이벤트", c: "#b0413e", d: "소수 종목을 크게 사서 경영진에 변화를 요구한다. 분석 대상은 '싼 주식'이 아니라 '바뀔 수 있는 회사'다.",
    see: ["새로 등장한 5% 이상 비중(새 캠페인일 가능성)", "전량 매도(캠페인 종료 · 실패 인정)", "종목 수(보통 10개 안팎)"],
    skip: "작은 비중의 신규는 탐색일 뿐이다. 13F보다 13D · 공개서한이 먼저 나온다.",
    use: "'이 회사에 무엇이 바뀌면 값이 오르는가'라는 촉매 관점을 얻는다. 캠페인은 1~3년 걸린다." },
  growth: { nm: "기술 · 성장", c: "#6b4bb8", d: "산업의 큰 변화(인터넷 · 클라우드 · AI)에 올라탄 기업을 고른다. 테마에 대한 확신과 회전이 함께 있다.",
    see: ["상위 종목이 어떤 테마에 몰려 있나", "분기 회전율(얼마나 갈아탔나)", "여러 성장 투자자가 같은 분기에 같이 산 종목", "크게 줄인 대형주(테마 이탈)"],
    skip: "비상장 지분이 큰 곳은 13F가 전체의 일부다. 급등락 구간의 비중 변화는 주가 변동 때문일 수 있다.",
    use: "'돈이 어느 테마로 옮겨 가는가'를 얻는다. 변동이 크니 한 분기가 아니라 2~3분기 흐름으로 본다." },
  trend: { nm: "추세추종 · 퀀트", c: "#5c6570", d: "가격 추세와 통계 규칙으로 매매한다. 선물 중심이라 13F에는 생각이 드러나지 않는다.",
    see: [], skip: "13F로는 볼 수 없다(선물 · 초단기 · 수천 종목).", use: "이 유형은 '지금 무엇을 샀나'가 아니라 '과거에 그 규칙이 어땠나'로 배워야 한다 — 이 화면에는 넣지 않았다." }
};
var GX_TY_ORDER = ["macro", "value", "deep", "activist", "growth"];
/* trust: 13F가 이 사람의 생각을 얼마나 보여 주나 (3 = 거의 전부 · 2 = 일부 · 1 = 조각) */
var GX_P = {
  berkshire: { ty: "value", tags: ["초장기 보유", "현금 대기"], one: "훌륭한 사업을 적당한 값에 사서 영원히 들고 간다.",
    phil: ["이해할 수 있는 사업 · 오래가는 경쟁 우위 · 믿을 수 있는 경영진 · 합리적 가격", "남들이 탐욕스러울 때 두려워하고, 두려워할 때 탐욕스러워진다", "살 것이 없으면 현금으로 기다린다 — 기다리는 것도 포지션이다"],
    how: ["한번 사면 수십 년(코카콜라 1988년~, 아멕스 1960년대~)", "확신이 서면 한 종목에 크게 싣는다(애플이 한때 주식의 절반 가까이)", "비싸다고 보면 몇 분기에 걸쳐 조용히 줄이고 현금을 쌓는다"],
    hist: [["1965", "버크셔 해서웨이 경영권 인수"], ["1988", "코카콜라 매수 — 지금까지 보유"], ["2008", "금융위기 때 골드만삭스 · GE에 자금 투입"], ["2016~", "애플 대량 매수 → 2024년에 크게 축소, 현금 사상 최대"], ["2025", "연말 CEO에서 물러나고 그렉 에이블이 승계"]],
    read: "새 종목이 드물어 '신규'와 '전량 매도'가 가장 큰 신호. 주식 총액이 줄고 현금이 느는 분기는 '시장이 비싸다'는 무언의 의견이다.",
    learn: "살 것이 없을 때 억지로 사지 않는 태도, 그리고 폭락 때 쓸 현금을 평소에 남겨 두는 것.", trust: 3, tw: "미국 주식이 대부분이라 잘 보인다. 다만 일부는 다른 운용역의 몫이고, 승계 이후에는 결정 주체가 달라진다." },
  himalaya: { ty: "value", tags: ["초집중", "멍거의 제자"], one: "평생 몇 번 오지 않는 기회에 크게 건다.",
    phil: ["가치투자는 '아는 것'의 범위 안에서만 한다", "좋은 기업을 찾으면 오래, 크게 보유한다", "안전마진 — 틀려도 크게 잃지 않는 값에 산다"],
    how: ["13F 종목이 5~10개뿐", "몇 년씩 매매가 없다가 한 번 움직인다", "중국 · 홍콩 보유분이 따로 있다(BYD를 멍거에게 소개한 사람)"],
    hist: [["1989", "천안문 학생 지도자 → 미국 망명, 컬럼비아대"], ["1997", "히말라야 캐피털 설립"], ["2000년대", "찰리 멍거가 자금을 맡김"], ["2008", "버크셔의 BYD 투자에 다리를 놓음"]],
    read: "종목이 적어 신규 하나하나가 큰 의견이다. 비중 순위가 곧 확신 순위.", learn: "종목 수를 줄일수록 한 종목을 깊이 알아야 한다는 것.", trust: 2, tw: "미국 상장분만 보인다. 중국 본토 · 홍콩 보유는 빠져 있다." },
  fundsmith: { ty: "value", tags: ["우량주", "저회전"], one: "좋은 회사를 사고, 비싸게 사지 않고, 아무것도 하지 않는다.",
    phil: ["투하자본수익률이 높고 현금이 잘 도는 회사만", "경기에 덜 흔들리는 소비재 · 헬스케어 · 소프트웨어", "매매 비용과 세금이 수익을 갉아먹는다 — 회전을 줄인다"],
    how: ["20~30종목을 길게 보유", "실적이 구조적으로 꺾였다고 보면 판다(일시적 부진은 버틴다)", "시장 예측 · 타이밍을 하지 않는다"],
    hist: [["2010", "펀드스미스 설립"], ["2010년대", "영국 최대 주식형 펀드로 성장"], ["2021~", "대형 기술주 쏠림 장에서 지수를 밑도는 해가 이어짐"]],
    read: "매매가 적어 신규 · 전량 매도가 눈에 띈다. 판 종목은 '사업의 질이 나빠졌다'는 판단인 경우가 많다.", learn: "주가가 아니라 사업의 수익성(자본수익률 · 현금흐름)으로 보유를 판단하는 기준.", trust: 2, tw: "미국 상장분만 보인다. 유럽 상장 종목은 빠진다." },
  akre: { ty: "value", tags: ["복리 기계", "저회전"], one: "복리로 불어나는 사업을 찾아 방해하지 않는다.",
    phil: ["세 다리 의자 — 뛰어난 사업 · 뛰어난 경영진 · 번 돈을 다시 잘 투자할 기회", "자기자본이익률이 높고 재투자할 곳이 많은 회사", "좋은 회사는 팔 이유가 거의 없다"],
    how: ["결제망 · 신용평가 · 통신탑처럼 통행료를 받는 사업을 오래 보유", "상위 몇 종목이 대부분의 비중", "주가가 빠진 분기에 기존 보유 종목을 더 산다"],
    hist: [["1989", "애커 캐피털 설립"], ["2000년대~", "마스터카드 · 무디스 · 아메리칸타워 등을 10년 넘게 보유"], ["2020년대", "창업자는 일선에서 한발 물러나고 후임 운용역이 이어감"]],
    read: "상위 종목이 유지되는지가 핵심. 오래된 핵심 종목을 줄이기 시작하면 주목.", learn: "'팔지 않아도 되는 회사'의 조건 세 가지를 내 보유 종목에 대 보는 것.", trust: 3, tw: "미국 주식 롱 포지션 중심이라 잘 보인다." },
  pabrai: { ty: "value", tags: ["초집중", "복제 투자"], one: "앞면이면 크게 벌고, 뒷면이어도 조금만 잃는 곳에만 건다.",
    phil: ["단도 투자 — 위험은 작고 불확실성만 큰 상황을 산다", "좋은 아이디어는 부끄러워하지 않고 베낀다(버핏 · 멍거 복제를 공언)", "몇 번 안 되는 기회에 크게"],
    how: ["종목 수가 한 손에 꼽힌다", "미국에 살 것이 없으면 인도 · 터키 등 해외로 간다", "한 업종에 몰아서 들고 가기도 한다"],
    hist: [["1999", "파브라이 펀드 시작"], ["2007", "버핏과의 점심을 낙찰받음"], ["2010년대 후반~", "자산의 큰 부분을 미국 밖으로 옮김"]],
    read: "13F에 남은 소수 종목은 강한 확신이지만, 전체 자산의 일부라는 점을 먼저 본다.", learn: "'틀리면 얼마 잃나'를 먼저 계산하는 순서.", trust: 1, tw: "자산 상당수가 해외에 있어 13F는 조각이다." },
  duquesne: { ty: "macro", tags: ["집중 베팅", "빠른 손절"], style: "swing", one: "확신이 있을 때 크게 걸고, 틀렸다고 느끼면 그날 판다.",
    phil: ["수익은 분산이 아니라 '옳을 때 얼마나 크게 걸었나'에서 나온다", "지금 실적이 아니라 18개월 뒤를 본다 — 유동성이 시장을 움직인다", "생각이 바뀌면 자존심 없이 뒤집는다"],
    how: ["한 분기에 상위 종목이 통째로 바뀌기도 한다", "먼저 사고 나중에 분석한다 — 맞으면 키우고 틀리면 자른다", "주식 · 채권 · 통화 · 원자재를 가리지 않는다(13F에는 주식만)"],
    hist: [["1988~2000", "소로스 퀀텀 펀드 수석 운용역"], ["1992", "영국 파운드 공매도를 설계"], ["2000", "기술주 꼭지에 다시 들어갔다 큰 손실 — 본인이 가장 자주 꺼내는 실수"], ["2010", "30년 동안 손실 낸 해 없이 외부 자금을 돌려주고 패밀리오피스로 전환"], ["2022~2024", "AI 초입에 엔비디아를 크게 샀다가 2024년에 대부분 매도 — '너무 일찍 팔았다'고 인정"]],
    read: "① 비중을 3%p 넘게 늘린 곳 = 새 확신 ② 전량 매도 = 생각을 바꿨다 ③ 주식 총액의 증감 = 위험 선호. 작은 종목 수십 개는 건너뛴다.",
    learn: "확신의 크기에 맞춰 비중을 싣는 법, 그리고 틀렸을 때 줄이는 속도. 그의 원자재 · 채권 포지션(예: 경기 둔화에 거는 숏)은 13F에 없으니 인터뷰로 보충해야 한다.", trust: 2, tw: "주식 롱만 보인다. 채권 · 통화 · 원자재 · 공매도는 빠져 있고, 45일 사이에 이미 바뀌었을 수 있다." },
  bridgewater: { ty: "macro", tags: ["자산 배분", "시스템"], one: "경제는 기계처럼 움직인다 — 사이클을 읽고 자산을 나눈다.",
    phil: ["부채 사이클과 통화 질서가 자산 가격을 정한다", "서로 상관이 낮은 수익원을 여러 개 쌓는다(올웨더 · 리스크 패리티)", "원칙을 글로 적고 규칙으로 만든다"],
    how: ["종목이 수백 개 — 개별 종목은 규칙이 뽑은 결과일 뿐", "지수 · 신흥국 · 금 ETF 비중으로 생각이 드러난다", "사람의 직감이 아니라 시스템이 매매한다"],
    hist: [["1975", "브리지워터 설립"], ["1996", "올웨더 전략 출시"], ["2008", "금융위기를 예고하고 그해 수익"], ["2022", "경영권을 넘김"], ["2025", "남은 지분을 정리하고 이사회에서 물러남"]],
    read: "개별 종목 해석은 하지 않는다. ① 미국 지수 대 신흥국 대 금 ETF 비중이 어디로 옮겨 갔나 ② 주식 총액 증감만 본다.",
    learn: "한 자산에 몰지 않고 '경기 국면이 바뀌어도 버티는 배분'을 짜는 사고방식. 달리오 개인의 견해는 13F가 아니라 그의 글에서 본다.", trust: 1, tw: "13F는 전체 자산의 일부(채권 · 원자재 · 통화가 본체). 지금은 달리오 개인이 아닌 회사의 시스템이 운용한다." },
  soros: { ty: "macro", tags: ["재귀성", "패밀리오피스"], one: "시장은 늘 틀린다 — 틀린 믿음이 스스로를 키우다 무너지는 지점을 노린다.",
    phil: ["재귀성 — 가격이 현실을 바꾸고, 바뀐 현실이 다시 가격을 민다", "가설을 세우고 작게 시험한 뒤 맞으면 크게 키운다", "살아남는 것이 먼저다"],
    how: ["종목 수가 많고 옵션 · 전환사채가 섞여 있다", "여러 운용역 · 외부 위탁의 합이다", "분기마다 회전이 크다"],
    hist: [["1973", "퀀텀 펀드의 전신 설립"], ["1992", "영국 파운드 공매도 — '영란은행을 무너뜨린 사람'"], ["2011", "외부 자금을 돌려주고 패밀리오피스로 전환"], ["현재", "소로스 본인은 운용하지 않는다"]],
    read: "'소로스의 생각'으로 읽으면 안 된다. 옵션 방향과 큰 신규 포지션 정도만 참고한다.", learn: "가설 → 작은 시험 → 확인 뒤 증액이라는 포지션 키우는 순서(그의 책에서).", trust: 1, tw: "여러 운용역의 합이고 본인은 운용하지 않는다. 주식 외 자산은 보이지 않는다." },
  appaloosa: { ty: "macro", tags: ["부실 출신", "집중 베팅"], style: "swing", one: "정책이 바닥을 받쳐 줄 때, 남들이 무서워하는 것을 크게 산다.",
    phil: ["중앙은행 · 정부가 어느 편인지 먼저 본다", "최악의 경우가 생각보다 덜 나쁘면 산다", "확신이 서면 포트폴리오의 큰 부분을 싣는다"],
    how: ["몇 개 테마에 몰아서 산다(은행 · 대형 기술 · 중국 등)", "생각이 바뀌면 빠르게 줄인다", "채권 · 부실자산이 뿌리라 주식도 '싸게 던져진 것'을 좋아한다"],
    hist: [["1993", "골드만삭스 정크본드 데스크를 나와 아팔루사 설립"], ["2009", "금융위기 바닥에서 은행주를 대량 매수해 큰 수익"], ["2010", "'연준이 받쳐 준다' 발언으로 랠리를 알림"], ["2024", "중국 부양책 직후 중국 주식을 크게 늘렸다고 공개 발언"]],
    read: "상위 종목이 어느 테마에 몰려 있는지, 그 테마 비중이 분기 사이 늘었는지 줄었는지를 본다.", learn: "'정책이 누구 편인가'를 먼저 묻는 습관과, 공포 구간에서의 매수 규모.", trust: 2, tw: "주식 롱은 잘 보이지만 채권 · 부실자산은 빠져 있다." },
  baupost: { ty: "deep", tags: ["안전마진", "현금 대기"], one: "얼마를 벌까보다 얼마를 잃을 수 있나를 먼저 본다.",
    phil: ["안전마진 — 가치보다 충분히 싸지 않으면 사지 않는다", "살 것이 없으면 현금을 들고 기다린다", "남들이 팔 수밖에 없는 상황(강제 매도 · 분할 · 파산)을 찾는다"],
    how: ["인기 없는 종목 · 복잡한 상황을 산다", "비중을 천천히 쌓고 천천히 뺀다", "현금 비중이 높은 시기가 길다"],
    hist: [["1982", "바우포스트 설립"], ["1991", "『안전마진』 출간 — 절판돼 고가에 거래되는 책"], ["2008", "위기 때 쌓아 둔 현금으로 부실자산 매수"]],
    read: "새로 산 종목의 공통점(업종 · 상황)을 본다. 왜 싸졌는지가 핵심.", learn: "'싸 보이는 이유'와 '실제로 싼 이유'를 구분하는 질문.", trust: 2, tw: "부실채권 · 부동산 · 비상장이 많아 13F는 일부다." },
  oaktree: { ty: "deep", tags: ["사이클", "크레딧"], one: "미래는 알 수 없지만, 지금이 사이클의 어디쯤인지는 알 수 있다.",
    phil: ["2차적 사고 — 남들과 다르게, 그리고 더 옳게", "리스크는 변동성이 아니라 돈을 잃을 가능성이다", "시장 심리의 진자가 어느 끝에 있는지 본다"],
    how: ["본업은 부실채권 · 하이일드", "13F의 주식은 구조조정으로 받은 지분이 섞여 있다", "공포가 극심할 때 공격적으로 산다(2008년 말)"],
    hist: [["1995", "오크트리 설립"], ["2000", "닷컴 버블을 경고한 메모로 이름을 알림"], ["2008", "리먼 직후 부실채권을 대규모 매수"], ["2019", "브룩필드가 과반 지분 인수"]],
    read: "종목보다 그의 메모가 본체다. 13F는 '어느 업종의 망가진 회사에 들어가 있나' 정도만 본다.", learn: "'지금 시장 심리는 어디쯤인가'를 점검하는 습관 — 앱의 낙폭 단계 판단과 맞닿아 있다.", trust: 1, tw: "채권이 본업인 회사의 주식 조각이다." },
  greenlight: { ty: "deep", tags: ["가치 롱숏", "공개 숏"], one: "싸고 좋은 것을 사고, 비싸고 나쁜 것을 판다.",
    phil: ["숫자를 끝까지 파서 시장이 놓친 것을 찾는다", "패시브 자금 시대에는 '스스로 주주에게 돌려주는 싼 회사'를 산다", "금은 통화정책에 대한 보험이다"],
    how: ["상위 몇 종목 비중이 크다", "회계 · 사업 모델에 문제가 있다고 보는 회사를 공개적으로 공매도한다", "수년간 같은 종목을 들고 간다"],
    hist: [["1996", "그린라이트 캐피털 설립"], ["2008", "리먼 브러더스 공매도를 공개 — 파산 넉 달 전"], ["2015~", "성장주 장세에서 긴 부진, 테슬라 공매도 손실"], ["2020년대", "저평가 · 자사주 매입 기업 중심으로 회복"]],
    read: "롱만 보인다. 상위 종목과 새로 산 종목의 '싼 이유'를 본다.", learn: "주주환원(자사주 · 배당)으로 수익이 나오는 싼 종목이라는 기준.", trust: 2, tw: "공매도 절반이 13F에 없다." },
  pershing: { ty: "activist", tags: ["초집중", "공개 발언"], one: "단순하고 예측 가능한, 현금을 잘 버는 회사 8~12개에 전부를 건다.",
    phil: ["이해하기 쉽고 해자가 있는 대형 우량 기업", "경영이 바뀌면 값이 오를 회사를 사서 직접 바꾼다", "큰 위험은 값싼 보험(헤지)으로 막는다"],
    how: ["종목 수 10개 안팎, 한 종목이 10~20%", "사면 공개적으로 이유를 설명한다", "틀렸다고 판단하면 손실을 확정하고 나온다(밸리언트 · 넷플릭스)"],
    hist: [["2004", "퍼싱 스퀘어 설립"], ["2012~2018", "허벌라이프 공매도 — 실패로 끝남"], ["2015~2017", "밸리언트로 큰 손실"], ["2020", "코로나 직전 신용 헤지로 약 2,700만 달러를 26억 달러로"], ["2022", "넷플릭스를 석 달 만에 손절"]],
    read: "새 종목 = 새 캠페인 또는 새 확신. 종목이 적어 비중 변화가 곧 의견이다.", learn: "적은 종목을 깊이 아는 것, 그리고 틀렸을 때 인정하는 속도.", trust: 3, tw: "미국 대형주 롱 중심이라 잘 보인다. 헤지(옵션 · 스와프)는 안 보인다." },
  thirdpoint: { ty: "activist", tags: ["이벤트", "공개서한"], one: "무언가 바뀌는 순간(분할 · 합병 · 경영진 교체)에 값이 다시 매겨진다.",
    phil: ["촉매가 있는 저평가", "필요하면 경영진을 공개적으로 압박한다", "주식 · 채권 · 구조화 상품을 넘나든다"],
    how: ["30~40종목, 분기 회전이 꽤 크다", "거친 공개서한으로 유명했다", "시장 상황에 따라 성장주 · 가치주를 오간다"],
    hist: [["1995", "서드 포인트 설립"], ["2012", "야후 이사회 진입"], ["2013~", "소니 · 네슬레 · 디즈니 등에 변화를 요구"]],
    read: "새 종목에 어떤 사건(분할 · 인수 · 구조조정)이 걸려 있는지를 찾는다.", learn: "'이 종목이 다시 평가받을 사건이 있는가'라는 질문.", trust: 2, tw: "주식 롱은 보이지만 채권 · 숏은 빠진다." },
  tci: { ty: "activist", tags: ["초집중", "독점 사업"], one: "대체할 수 없는 사업을 몇 개만, 아주 오래.",
    phil: ["진입장벽이 높은 독점 · 과점 사업(신용평가 · 철도 · 항공엔진 · 결제망)", "가격 결정력이 있어 물가를 이기는 회사", "주주로서 경영진에 직접 요구한다"],
    how: ["종목 수 10~15개, 상위 5개가 대부분", "한번 사면 수년", "초기에는 공격적 행동주의, 지금은 장기 보유자에 가깝다"],
    hist: [["2003", "TCI 펀드 설립 — 수익의 일부를 아동 자선재단으로"], ["2005", "독일 증권거래소의 런던거래소 인수를 막음"], ["2010년대~", "초집중 장기 보유로 업계 최상위 수익"]],
    read: "상위 종목의 순서와 비중 변화만 보면 된다. 신규는 드물고 무겁다.", learn: "'이 회사가 가격을 올려도 고객이 떠나지 못하는가'라는 한 가지 질문.", trust: 3, tw: "미국 상장 주식 롱 중심(일부 유럽 종목은 빠짐)." },
  icahn: { ty: "activist", tags: ["원조 행동주의", "지배 지분"], one: "나쁜 경영진 아래 묻힌 싼 자산을 사서 흔든다.",
    phil: ["자산가치보다 싼 회사를 대량 매수한다", "이사회 의석 · 자사주 매입 · 매각을 요구한다", "여론이 싫어하는 곳에 기회가 있다"],
    how: ["종목이 적고 한 종목 지분율이 높다", "자회사 격인 지배 지분이 많아 매매가 드물다", "몇 년씩 싸운다"],
    hist: [["1985", "TWA 인수 — '기업 사냥꾼'"], ["2012", "넷플릭스 매수 — 대표적 성공"], ["2013", "애플에 자사주 매입 확대를 요구"], ["2023", "공매도 리포트로 본인 회사 주가가 급락"]],
    read: "지배 지분은 해석하지 않는다. 새로 등장한 이름만 본다.", learn: "'자산가치 대비 얼마나 싼가'라는 계산.", trust: 2, tw: "보유 대부분이 장기 지배 지분이라 분기 변화가 적다." },
  trian: { ty: "activist", tags: ["이사회 진입", "운영 개선"], one: "좋은 브랜드가 나쁜 운영에 갇혀 있을 때 들어간다.",
    phil: ["소비재 · 산업재의 알려진 브랜드", "싸움보다 이사회 안에서 비용 · 구조를 고친다", "몇 년에 걸쳐 실적으로 증명한다"],
    how: ["종목 10개 안팎", "지분을 쌓은 뒤 백서를 낸다", "목표를 이루거나 실패하면 전량 매도"],
    hist: [["2005", "트라이언 설립"], ["2017", "P&G와 역대 최대 규모 위임장 대결"], ["2024", "디즈니 위임장 대결에서 진 뒤 지분 매도"]],
    read: "새 대형 포지션 = 다음 캠페인 후보. 전량 매도 = 끝난 캠페인.", learn: "브랜드는 좋은데 이익률이 동종 대비 낮은 회사를 찾는 눈.", trust: 3, tw: "미국 주식 롱 소수 종목이라 잘 보인다." },
  tiger: { ty: "growth", tags: ["인터넷 · 소프트웨어", "비상장 큼"], one: "세계의 인터넷 · 소프트웨어 승자를 일찍, 크게 산다.",
    phil: ["큰 시장에서 점유율을 넓히는 선두 기업", "상장 · 비상장을 가리지 않는다", "좋은 기업은 비싸 보여도 들고 간다"],
    how: ["상위 종목 비중이 높다", "금리 급등기에 큰 타격(2022년)", "이후 대형 기술주 중심으로 종목을 줄였다"],
    hist: [["2001", "줄리언 로버트슨의 지원으로 설립('타이거 컵')"], ["2010년대", "페이스북 · 중국 인터넷 초기 투자"], ["2022", "상장 주식 펀드가 반 토막 수준의 손실"]],
    read: "상위 종목이 어떤 테마(클라우드 · AI · 핀테크)에 몰려 있는지, 무엇을 통째로 뺐는지 본다.", learn: "성장주는 금리에 약하다는 것 — 금리 국면과 같이 봐야 한다.", trust: 2, tw: "비상장 벤처 지분이 커서 13F는 일부다." },
  ark: { ty: "growth", tags: ["파괴적 혁신", "규칙적 리밸런싱"], one: "5년 뒤 세상을 바꿀 기술에 지금 건다.",
    phil: ["AI · 로봇 · 유전체 · 블록체인 등 혁신 플랫폼", "단기 실적보다 5년 뒤 시장 크기", "빠질 때 더 사고 급등하면 덜어 낸다"],
    how: ["확신 종목을 하락 중에도 계속 산다", "급등한 종목은 비중 한도에 맞춰 판다", "ETF라 매일 매매가 공개된다"],
    hist: [["2014", "ARK 설립"], ["2020", "대표 ETF가 한 해 약 150% 상승"], ["2021~2022", "금리 상승기에 고점 대비 70% 넘게 하락"]],
    read: "'판 것'은 대개 비중 관리다. 몇 분기째 계속 사는 종목이 진짜 확신.", learn: "변동성을 견디는 대가가 얼마나 큰지 — 같은 전략의 영광과 낙폭을 함께 본다.", trust: 3, tw: "주식 롱 ETF라 거의 전부 보인다(일별 공개가 더 빠르다)." },
  coatue: { ty: "growth", tags: ["기술 롱숏", "데이터"], one: "기술 산업의 승자와 패자를 데이터로 가른다.",
    phil: ["기술 · 미디어 · 통신에만 집중한다", "산업 구조가 바뀔 때 승자에 싣는다(모바일 → 클라우드 → AI)", "데이터 분석으로 추세를 확인한다"],
    how: ["60~70종목, 상위 10개가 절반 안팎", "분기 회전이 크다", "비상장 투자가 크다"],
    hist: [["1999", "닷컴 버블 한가운데 설립('타이거 컵')"], ["2010년대", "기술 전문 헤지펀드로 성장"], ["2023~", "AI 인프라 쪽으로 무게를 옮김"]],
    read: "상위 10종목의 테마 구성과 분기 사이 순위 변화를 본다.", learn: "'이번 기술 사이클의 돈은 어느 층(칩 · 클라우드 · 소프트웨어)에 모이는가'.", trust: 2, tw: "공매도와 비상장은 보이지 않는다." },
  altimeter: { ty: "growth", tags: ["기술 집중", "공개 발언"], one: "기술의 큰 물결 하나에 올라타 몇 종목에 집중한다.",
    phil: ["클라우드 · AI처럼 10년짜리 변화", "상장 전부터 따라가 상장 후에도 보유", "경영진에게 공개적으로 요구한다"],
    how: ["종목 수가 적고 상위 비중이 크다", "시장이 과열이라 보면 현금 · 헤지를 늘린다고 공개적으로 말한다", "테마가 바뀌면 빠르게 갈아탄다"],
    hist: [["2008", "금융위기 한가운데 알티미터 설립"], ["2020", "스노우플레이크 상장 전 투자로 큰 수익"], ["2022", "메타에 비용 절감을 요구하는 공개서한"]],
    read: "상위 5종목이 곧 그의 AI 견해다. 총액이 줄면 방어로 돌아섰다는 뜻.", learn: "하나의 큰 테마 안에서도 종목을 좁히는 방식.", trust: 2, tw: "비상장 지분과 헤지는 보이지 않는다." },
  lonepine: { ty: "growth", tags: ["우량 성장", "펀더멘털"], one: "오래 성장할 우량 기업을 깊이 조사해 산다.",
    phil: ["경쟁 우위가 뚜렷한 성장 기업", "기업 탐방 · 조사에 기반한 상향식 선택", "가격이 맞지 않으면 기다린다"],
    how: ["20~30종목", "분기마다 꽤 갈아탄다", "지금은 창업자가 아닌 후임 운용역들이 결정한다"],
    hist: [["1997", "론 파인 설립('타이거 컵')"], ["2019", "창업자가 일선 운용에서 물러남"], ["2022", "성장주 급락기에 큰 손실"]],
    read: "새로 산 종목과 다 판 종목의 업종을 본다. 인물보다 조직의 판단으로 읽는다.", learn: "성장주도 '질'로 고른다는 기준.", trust: 2, tw: "창업자 개인의 판단이 아니다. 숏은 보이지 않는다." }
};
var GX = { ty: "all", sel: null };
try { var gx0 = JSON.parse(localStorage.getItem("sm.gurux") || "{}"); if (gx0.ty) GX.ty = gx0.ty; } catch (e) {}
function gxSave() { try { localStorage.setItem("sm.gurux", JSON.stringify({ ty: GX.ty })); } catch (e) {} }
function gxE(s) { return typeof dsEsc === "function" ? dsEsc(s) : String(s == null ? "" : s); }
function gxPc(x, d) { return x == null || !isFinite(x) ? "-" : (x * 100).toFixed(d == null ? 0 : d) + "%"; }
function gxName(m) { return (typeof dsIss === "function" ? dsIss(m) : m.n) + (m.t ? "(" + m.t + ")" : ""); }
function gxIds() { return Object.keys(GX_P).filter(function (id) { return GX.ty === "all" || GX_P[id].ty === GX.ty; }); }
/* 집중도 — 서버 값이 없으면(옛 자료) 상위 15종목 비중으로 계산 */
function gxConc(g) { if (g.conc && g.conc.t5) return g.conc; var w = (g.top || []).map(function (x) { return x.w || 0; }), s = function (k) { return w.slice(0, k).reduce(function (a, x) { return a + x; }, 0); }; return w.length ? { t1: s(1), t5: s(5), t10: s(10) } : null; }

/* 유형에 따라 이번 분기를 읽는다 — 규칙 기반. 조건에 맞는 문장만 나온다 */
function gxRead(g, P) {
  var T = P.ty, out = [], c = gxConc(g), buys = g.buys || [], sells = g.sells || [], tot = g.total || 0;
  var news = buys.filter(function (m) { return m.kind === "new"; }), exits = sells.filter(function (m) { return m.kind === "exit"; });
  var dw = function (m) { return m.pw != null && m.w != null ? m.w - m.pw : (tot ? m.dv / tot : 0); };
  var ups = buys.slice().sort(function (a, b) { return dw(b) - dw(a); }), up = ups[0];
  var chgTot = g.prevTotal ? g.total / g.prevTotal - 1 : null;
  var swing = P.style === "swing";
  /* 1) 위험을 늘렸나 — 매크로 · 딥밸류에서 가장 먼저 */
  if (chgTot != null && (T === "macro" || T === "deep" || Math.abs(chgTot) >= 0.15)) out.push({ k: "주식 총액", v: (chgTot >= 0 ? "+" : "") + gxPc(chgTot), t: "13F 주식 합계가 지난 분기보다 " + (Math.abs(chgTot) < 0.05 ? "거의 그대로다." : chgTot > 0 ? "늘었다." : "줄었다.") + " 주가 변동이 섞인 숫자라 방향만 본다" + (T === "macro" ? " — 늘었으면 위험을 더 지는 쪽, 줄었으면 물러서는 쪽." : T === "deep" ? " — 시장이 겁먹은 분기에 늘었다면 '싸졌다'는 판단이다." : ".") });
  /* 2) 집중도 */
  if (c) out.push({ k: "상위 5종목", v: gxPc(c.t5), t: c.t5 >= 0.6 ? "몇 종목에 거의 전부를 실었다 — 순위가 곧 확신의 순서다." : c.t5 >= 0.35 ? "상위 종목에 무게가 실려 있다." : "넓게 퍼져 있다 — 개별 종목보다 묶음(업종 · ETF)으로 읽는 편이 맞다." });
  /* 3) 유형별 핵심 */
  if (T === "macro" && !swing) {
    if (g.etfW != null) out.push({ k: "ETF 비중", v: gxPc(g.etfW), t: g.etfW >= 0.15 ? "지수 · 국가 ETF로 방향을 잡고 있다. 어떤 ETF인지가 곧 견해다." : "ETF 비중은 크지 않다." });
  }
  if (T === "macro" || T === "growth" || T === "deep") {
    var os = g.optSum; if (os && (os.put + os.call) > 0 && tot && (os.put + os.call) / tot >= 0.03) { var o1 = (g.opts || [])[0]; out.push({ k: "옵션", v: "풋 " + dsUsd(os.put) + " · 콜 " + dsUsd(os.call), t: (os.put > os.call * 1.5 ? "풋이 더 크다 — 하락 대비이거나 하락에 거는 쪽." : os.call > os.put * 1.5 ? "콜이 더 크다 — 상승에 거는 쪽." : "풋과 콜이 비슷하다.") + (o1 ? " 가장 큰 것: " + gxName(o1) + " " + (o1.pc === "put" ? "풋" : "콜") + (o1.isNew ? "(신규)" : "") + "." : "") + " 13F의 옵션 금액은 기초자산 값이라 실제 건 돈보다 훨씬 크게 보이고, 헤지인지 베팅인지는 알 수 없다." }); }
  }
  if (up && dw(up) >= (swing || T === "activist" ? 0.03 : 0.02)) out.push({ k: "가장 크게 늘린 곳", v: gxName(up) + " +" + (dw(up) * 100).toFixed(1) + "%p", t: (up.kind === "new" ? "새로 사서 단번에 " + gxPc(up.w, 1) + " 비중. " : "비중을 " + gxPc(up.pw, 1) + " → " + gxPc(up.w, 1) + "로. ") + (swing ? "이 사람은 확신이 설 때만 크게 싣는다 — 이번 분기의 대표 의견으로 본다." : T === "activist" ? "행동주의 투자자의 큰 신규 · 증액은 새 캠페인의 시작일 수 있다." : T === "value" ? "거의 움직이지 않는 사람의 증액이라 무게가 있다." : T === "growth" ? "어떤 테마에 속한 종목인지 같이 본다." : "무엇이 싸졌다고 보는지 보여 준다.") });
  if (news.length) { var big = news.filter(function (m) { return (m.w || 0) >= 0.01; }); out.push({ k: "새로 산 종목", v: (g.nNew || news.length) + "개", t: T === "value" || T === "activist" ? (big.length ? "의미 있는 크기(1% 이상): " + big.slice(0, 4).map(function (m) { return gxName(m) + " " + gxPc(m.w, 1); }).join(", ") + ". 이 유형에게 신규는 드문 일이다." : "모두 1% 미만의 작은 크기다 — 탐색 단계로 본다.") : (big.length ? "1% 이상: " + big.slice(0, 4).map(function (m) { return gxName(m) + " " + gxPc(m.w, 1); }).join(", ") + "." : "모두 작은 크기다.") + ((g.nNew || 0) >= 15 ? " 신규가 많아 하나하나에 뜻을 두기 어렵다." : "") }); }
  if (exits.length) { var bx = exits.filter(function (m) { return (m.pw || 0) >= 0.01; }); out.push({ k: "다 판 종목", v: (g.nExit || exits.length) + "개", t: (bx.length ? "지난 분기 1% 이상이던 것: " + bx.slice(0, 4).map(function (m) { return gxName(m) + " " + gxPc(m.pw, 1); }).join(", ") + ". " : exits.slice(0, 3).map(gxName).join(", ") + ". ") + (swing ? "이 사람에게 전량 매도는 '생각을 바꿨다'는 뜻이다 — 줄인 것보다 훨씬 강한 신호." : T === "value" ? "오래 들고 가는 사람이 다 팔았다면 사업에 대한 판단이 바뀐 것이다." : T === "activist" ? "캠페인이 끝났거나 접었다는 뜻." : T === "growth" ? "테마에서 빠져나온 것인지 본다." : "") }); }
  if (g.turn != null) out.push({ k: "분기 회전율", v: gxPc(g.turn), t: g.turn >= 0.3 ? "포트폴리오의 큰 부분을 갈아탔다." + (T === "value" ? " 이 유형으로는 이례적이다." : "") : g.turn <= 0.05 ? "거의 움직이지 않았다" + (T === "value" ? " — 이 유형의 기본값이다. '안 판 것'도 의견이다." : ".") : "보통 수준의 조정이다." });
  return out;
}
function gxProfileHtml(id, g) {
  var P = GX_P[id]; if (!P) return ""; var T = GX_TYPES[P.ty], st = "★★★".slice(0, P.trust) + "☆☆☆".slice(0, 3 - P.trust);
  var h = '<div class="gxCard" style="--gx:' + T.c + '"><div class="gxTop"><span class="gxTy">' + T.nm + '</span>' + (P.tags || []).map(function (t) { return '<span class="gxTag">' + gxE(t) + '</span>'; }).join("") + '<span class="gxTrust" title="13F가 이 사람의 생각을 얼마나 보여 주나">13F 신뢰도 ' + st + '</span></div>';
  h += '<p class="gxOne">“' + gxE(P.one) + '”</p>';
  h += '<div class="gxCols"><div><h5>투자 철학</h5><ul>' + P.phil.map(function (x) { return '<li>' + gxE(x) + '</li>'; }).join("") + '</ul></div><div><h5>실제로 이렇게 움직인다</h5><ul>' + P.how.map(function (x) { return '<li>' + gxE(x) + '</li>'; }).join("") + '</ul></div></div>';
  h += '<details class="gxDet"><summary>걸어온 길</summary><div class="gxHist">' + P.hist.map(function (x) { return '<div><b>' + gxE(x[0]) + '</b><span>' + gxE(x[1]) + '</span></div>'; }).join("") + '</div></details>';
  h += '<div class="gxLens"><div><h5>이 사람의 13F는 이렇게 읽는다</h5><p>' + gxE(P.read) + '</p></div><div><h5>' + T.nm + ' 유형에서 버릴 것</h5><p>' + gxE(T.skip) + '</p></div></div>';
  h += '<p class="gxTw"><b>13F의 한계</b> ' + gxE(P.tw) + '</p></div>';
  return h;
}
function gxReadHtml(g, P) {
  var R = gxRead(g, P), T = GX_TYPES[P.ty]; if (!R.length) return "";
  return '<div class="mkStep gxStep"><b>✓</b>' + T.nm + ' 유형의 눈으로 읽은 이번 분기 <small class="briefDim">숫자에서 규칙으로 뽑은 것 · 의도는 13F만으로 확정할 수 없어요</small></div><div class="gxRead" style="--gx:' + T.c + '">' + R.map(function (r) { return '<div class="gxR"><span class="gxRk">' + gxE(r.k) + '</span><b>' + gxE(r.v) + '</b><p>' + gxE(r.t) + '</p></div>'; }).join("") + '</div>' +
    '<div class="gxApply" style="--gx:' + T.c + '"><h5>우리는 여기서 무엇을 얻나</h5><p>' + gxE(P.learn) + '</p><p class="briefDim">' + gxE(T.use) + '</p></div>';
}
function gxHistHtml(g) {
  var H = (g.hist || []).slice(-8); if (H.length < 2) return "";
  var mx = Math.max.apply(null, H.map(function (h) { return h.total || 0; })) || 1;
  return '<div class="mkStep"><b>↗</b>분기별 흐름 <small class="briefDim">새 보고서가 올 때마다 한 줄씩 쌓여요</small></div><div class="gxHq">' + H.map(function (h) { return '<div class="gxHr"><span>' + dsQ(h.p) + '</span><span class="gxHb"><i style="width:' + Math.round((h.total || 0) / mx * 100) + '%"></i></span><b>' + dsUsd(h.total) + '</b><small>' + (h.n || 0) + '종목 · 상위5 ' + gxPc(h.t5) + '</small><em>' + (h.top || []).slice(0, 3).map(function (x) { return gxE(x.t || x.n); }).join(" · ") + '</em></div>'; }).join("") + '</div>';
}
function gxOptsHtml(g, P) {
  var O = g.opts || []; if (!O.length || !(P.ty === "macro" || P.ty === "growth" || P.ty === "deep")) return "";
  return '<div class="mkStep"><b>±</b>옵션 포지션 <small class="briefDim">금액 = 기초자산 값(실제 건 돈이 아님) · 헤지일 수도 있어요</small></div><div class="gxOp">' + O.slice(0, 6).map(function (o) { return '<div><span class="dsTag ' + (o.pc === "put" ? "sell" : "buy") + '">' + (o.pc === "put" ? "풋" : "콜") + '</span><span class="gxOn">' + gxE(gxName(o)) + '</span><b>' + dsUsd(o.v) + '</b><small>' + (o.isNew ? "신규" : o.chg != null ? dsPct(o.chg, 0) : "") + '</small></div>'; }).join("") + '</div>';
}
/* 구루 화면에 얹기 — 원래 그리기(renderGuru)를 한 뒤 유형 줄 · 인물 카드 · 읽기를 끼워 넣는다 */
function gxDecorate() {
  var box = document.getElementById("guruBody"); if (!box || typeof dsGurus !== "function") return;
  var G = dsGurus(), have = {}; G.forEach(function (x) { have[x.id] = x; });
  var pills = box.querySelector(".dsGuruPills"); if (!pills) { if (!G.length) gxEmpty(box); return; }
  var ids = gxIds(), cnt = function (ty) { return Object.keys(GX_P).filter(function (id) { return ty === "all" || GX_P[id].ty === ty; }).length; };
  var tyRow = document.createElement("div"); tyRow.className = "gxTyRow";
  tyRow.innerHTML = '<button data-gxty="all" class="' + (GX.ty === "all" ? "on" : "") + '">전체 <small>' + cnt("all") + '</small></button>' + GX_TY_ORDER.map(function (k) { return '<button data-gxty="' + k + '" class="' + (GX.ty === k ? "on" : "") + '" style="--gx:' + GX_TYPES[k].c + '"><i></i>' + GX_TYPES[k].nm + ' <small>' + cnt(k) + '</small></button>'; }).join("");
  pills.parentNode.insertBefore(tyRow, pills);
  if (GX.ty !== "all") { var d = document.createElement("p"); d.className = "gxTyD"; d.style.setProperty("--gx", GX_TYPES[GX.ty].c); d.innerHTML = '<b>' + GX_TYPES[GX.ty].nm + '</b> ' + gxE(GX_TYPES[GX.ty].d) + (GX_TYPES[GX.ty].see.length ? '<span>봐야 할 것: ' + GX_TYPES[GX.ty].see.map(gxE).join(" · ") + '</span>' : ''); pills.parentNode.insertBefore(d, pills); }
  var cur = GX.sel && !have[GX.sel] ? GX.sel : DS.g.id;
  /* 사람 줄: 고른 유형의 인물 전부(받은 자료가 없는 사람은 흐리게 — 눌러서 인물 정보는 볼 수 있다) + 사전에 없는 수집 인물 */
  var list = ids.slice().sort(function (a, b) { return (have[b] ? 1 : 0) - (have[a] ? 1 : 0) || ((have[b] || {}).filed || "").localeCompare((have[a] || {}).filed || ""); });
  if (GX.ty === "all") G.forEach(function (x) { if (!GX_P[x.id]) list.push(x.id); });
  var nmOf = function (id) { return have[id] ? have[id].nm : (GX_NM[id] || id); };
  pills.innerHTML = list.map(function (id) { var P = GX_P[id]; return '<button data-gxg="' + id + '" class="' + (id === cur ? "active" : "") + (have[id] ? "" : " gxNo") + '">' + (P ? '<i class="gxDot" style="background:' + GX_TYPES[P.ty].c + '"></i>' : '') + gxE(nmOf(id)) + '</button>'; }).join("");
  Array.prototype.forEach.call(tyRow.querySelectorAll("[data-gxty]"), function (b) { b.onclick = function () { GX.ty = b.getAttribute("data-gxty"); GX.sel = null; gxSave(); var L = gxIds().filter(function (id) { return have[id]; }).sort(function (a, b2) { return (have[b2].filed || "").localeCompare(have[a].filed || ""); }); if (L.length && L.indexOf(DS.g.id) < 0) { DS.g.id = L[0]; dsSave(); } else if (!L.length) GX.sel = gxIds()[0] || null; renderGuru(); }; });
  Array.prototype.forEach.call(pills.querySelectorAll("[data-gxg]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-gxg"); if (have[id]) { GX.sel = null; DS.g.id = id; dsSave(); } else GX.sel = id; renderGuru(); }; });
  var head = box.querySelector(".dsGHead");
  if (cur && !have[cur]) {   // 아직 13F를 받지 않은 인물 — 인물 정보만
    var n = pills.nextSibling; while (n) { var nx = n.nextSibling; box.removeChild(n); n = nx; }
    var w = document.createElement("div"); w.innerHTML = '<div class="dsGHead"><div><b>' + gxE(nmOf(cur)) + '</b> <span class="briefDim">' + gxE(GX_ORG[cur] || "") + '</span></div><span class="briefDim">13F 수집 전</span></div>' + gxProfileHtml(cur) + '<div class="dvEmpty">이 사람의 13F는 아직 받지 않았어요. GitHub의 "SEC 13F 수집"을 한 번 실행하면 보유 종목과 이번 분기 읽기가 채워져요.</div>';
    while (w.firstChild) box.appendChild(w.firstChild); return;
  }
  var g = have[DS.g.id], P = g && GX_P[g.id]; if (!g || !P || !head) return;
  var card = document.createElement("div"); card.innerHTML = gxProfileHtml(g.id, g); head.parentNode.insertBefore(card.firstChild, head.nextSibling);
  var kpi = box.querySelector(".kpiStrip"); if (kpi) { var rd = document.createElement("div"); rd.innerHTML = gxReadHtml(g, P); while (rd.firstChild) kpi.parentNode.insertBefore(rd.firstChild, kpi.nextSibling ? kpi.nextSibling : null), kpi = kpi.nextSibling || kpi; }
  var how = box.querySelector("details.howto"); var ex = document.createElement("div"); ex.innerHTML = gxOptsHtml(g, P) + gxHistHtml(g);
  while (ex.firstChild) { if (how) how.parentNode.insertBefore(ex.firstChild, how); else box.appendChild(ex.firstChild); }
}
function gxEmpty(box) { }
var GX_NM = { berkshire: "워런 버핏", pershing: "빌 애크먼", duquesne: "스탠리 드러켄밀러", appaloosa: "데이비드 테퍼", himalaya: "리루", baupost: "세스 클라만", soros: "조지 소로스", bridgewater: "레이 달리오", thirdpoint: "댄 로브", tiger: "체이스 콜먼", ark: "캐시 우드", tci: "크리스 혼", fundsmith: "테리 스미스", akre: "척 애커", pabrai: "모니시 파브라이", greenlight: "데이비드 아인혼", oaktree: "하워드 막스", icahn: "칼 아이칸", trian: "넬슨 펠츠", coatue: "필립 라폰트", altimeter: "브래드 거스트너", lonepine: "스티븐 맨델" };
var GX_ORG = { berkshire: "버크셔 해서웨이", pershing: "퍼싱 스퀘어", duquesne: "듀케인 패밀리오피스", appaloosa: "아팔루사", himalaya: "히말라야 캐피털", baupost: "바우포스트", soros: "소로스 펀드", bridgewater: "브리지워터", thirdpoint: "서드 포인트", tiger: "타이거 글로벌", ark: "ARK 인베스트", tci: "TCI 펀드", fundsmith: "펀드스미스", akre: "애커 캐피털", pabrai: "달랄 스트리트", greenlight: "그린라이트 캐피털", oaktree: "오크트리 캐피털", icahn: "아이칸 엔터프라이즈", trian: "트라이언 펀드", coatue: "코튜 매니지먼트", altimeter: "알티미터 캐피털", lonepine: "론 파인 캐피털" };
(function () {
  if (typeof renderGuru !== "function") return;
  var r0 = renderGuru; renderGuru = function () { r0.apply(this, arguments); try { gxDecorate(); } catch (e) { if (window.console) console.warn("gx", e); } };
  var st = document.createElement("style"); st.textContent =
    ".gxTyRow{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:8px}.gxTyRow button{flex:0 0 auto;border:1px solid var(--line);background:var(--card);color:var(--txt2,var(--sub));border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.gxTyRow button i{width:8px;height:8px;border-radius:50%;background:var(--gx)}.gxTyRow button small{font-weight:600;opacity:.6}.gxTyRow button.on{background:var(--txt);color:#fff;border-color:var(--txt)}" +
    ".gxTyD{margin:0 0 10px;padding:10px 12px;border-left:3px solid var(--gx);background:var(--soft,var(--card2));border-radius:0 8px 8px 0;font-size:13px;line-height:1.6;color:var(--txt2,var(--txt))}.gxTyD b{color:var(--gx);margin-right:6px}.gxTyD span{display:block;margin-top:4px;color:var(--sub);font-size:12.5px}" +
    ".gxDot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:middle}.dsGuruPills button.gxNo{opacity:.55}" +
    ".gxCard{border:1px solid var(--line);border-top:3px solid var(--gx);border-radius:12px;padding:14px 16px;margin:0 0 14px;background:var(--card)}.gxTop{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.gxTy{background:var(--gx);color:#fff;font-size:12px;font-weight:800;padding:3px 9px;border-radius:6px}.gxTag{font-size:12px;font-weight:700;color:var(--txt2,var(--sub));background:var(--soft,var(--card2));padding:3px 8px;border-radius:6px}.gxTrust{margin-left:auto;font-size:12px;color:var(--sub);white-space:nowrap}" +
    ".gxOne{margin:12px 0 12px;font-size:17px;font-weight:800;line-height:1.5;letter-spacing:-.2px;word-break:keep-all}.gxCols,.gxLens{display:grid;grid-template-columns:1fr 1fr;gap:14px}.gxCard h5,.gxApply h5{margin:0 0 6px;font-size:12px;font-weight:800;color:var(--gx);letter-spacing:.2px}.gxCard ul{margin:0;padding-left:16px}.gxCard li{font-size:13.5px;line-height:1.6;margin-bottom:3px;word-break:keep-all}.gxCard p{font-size:13.5px;line-height:1.65;margin:0;word-break:keep-all}" +
    ".gxDet{margin:12px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:8px 0}.gxDet summary{font-size:13px;font-weight:700;cursor:pointer;color:var(--txt2,var(--txt))}.gxHist{margin-top:8px;display:grid;gap:5px}.gxHist div{display:grid;grid-template-columns:86px 1fr;gap:8px;font-size:13px;line-height:1.5}.gxHist b{color:var(--gx);font-variant-numeric:tabular-nums}" +
    ".gxTw{margin-top:12px!important;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px!important;color:var(--sub)}.gxTw b{color:var(--txt2,var(--txt));margin-right:4px}" +
    ".gxRead{display:grid;gap:8px;margin-bottom:10px}.gxR{display:grid;grid-template-columns:120px 1fr;column-gap:12px;row-gap:2px;padding:10px 12px;border:1px solid var(--line);border-left:3px solid var(--gx);border-radius:8px;background:var(--card)}.gxRk{font-size:12px;font-weight:700;color:var(--sub);grid-row:1 / span 2;align-self:start;padding-top:2px}.gxR b{font-size:15px;font-variant-numeric:tabular-nums;word-break:keep-all}.gxR p{margin:0;font-size:13px;line-height:1.6;color:var(--txt2,var(--txt));word-break:keep-all}" +
    ".gxApply{padding:12px 14px;border-radius:10px;background:var(--soft,var(--card2));margin-bottom:16px}.gxApply p{margin:0 0 4px;font-size:13.5px;line-height:1.65;word-break:keep-all}" +
    ".gxHq{display:grid;gap:4px;margin-bottom:14px}.gxHr{display:grid;grid-template-columns:92px 1fr 70px 130px;gap:8px;align-items:center;font-size:13px}.gxHr em{grid-column:2 / -1;font-style:normal;font-size:12px;color:var(--sub);margin-top:-2px}.gxHb{height:8px;background:var(--soft,var(--card2));border-radius:4px;overflow:hidden}.gxHb i{display:block;height:100%;background:var(--txt);opacity:.75;border-radius:4px}.gxHr b{text-align:right;font-variant-numeric:tabular-nums}.gxHr small{color:var(--sub)}" +
    ".gxOp{display:grid;gap:4px;margin-bottom:14px}.gxOp div{display:grid;grid-template-columns:36px 1fr 80px 50px;gap:8px;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)}.gxOp b{text-align:right;font-variant-numeric:tabular-nums}.gxOp small{color:var(--sub);text-align:right}" +
    "@media(max-width:640px){.gxCols,.gxLens{grid-template-columns:1fr;gap:10px}.gxR{grid-template-columns:1fr}.gxRk{grid-row:auto}.gxHr{grid-template-columns:78px 1fr 62px}.gxHr small{display:none}.gxTrust{margin-left:0;width:100%}}";
  document.head.appendChild(st);
})();

/* ============================================================
   v14.60 — 2~5단계
   ② 13F 밖의 이야기(발언 조사 · 운영자 메모)  ③ AI 해석  ④ 거장 종합(국면 · 유형별 · 확신 종목)  ⑤ 종목 순위에 반영(묶음 비중 조정 · 종목별 거장 보유)
   ============================================================ */
var GXA = { doc: null, loading: null, busy: {} };
function gxAiLoad(fresh) {
  if (GXA.doc && !fresh) return Promise.resolve(GXA.doc); if (GXA.loading) return GXA.loading;
  GXA.loading = fetch("/api/snap?guruai=1" + (fresh ? "&fresh=" + Date.now() : "")).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) { GXA.doc = j && (j.notes || j.ai) ? j : { notes: {}, ai: {} }; GXA.loading = null; return GXA.doc; });
  return GXA.loading;
}
function gxOwner() { return typeof isOwner === "function" && isOwner(); }
function gxApi(body) { if (typeof proPost !== "function") return Promise.resolve({ ok: false, msg: "운영자 로그인이 필요해요" }); return proPost("guru", body).catch(function () { return { ok: false, msg: "서버에 닿지 못했어요" }; }); }
function gxToast(m, k) { if (typeof smToast === "function") smToast(m, k); }
/* 인물 정보를 글로 — AI에게 주는 재료 */
function gxProfileText(id) { var P = GX_P[id]; if (!P) return ""; var T = GX_TYPES[P.ty];
  return ["유형: " + T.nm + (P.style === "swing" ? " (집중 베팅형 — 확신이 있을 때 크게, 틀리면 바로 정리)" : "") + " · 특징: " + (P.tags || []).join(", "), "한 줄: " + P.one, "철학: " + P.phil.join(" / "), "매매 습관: " + P.how.join(" / "), "이력: " + P.hist.map(function (x) { return x[0] + " " + x[1]; }).join(" / "), "이 사람의 13F 읽는 법: " + P.read, "13F의 한계: " + P.tw, "유형에서 버릴 것: " + T.skip].join("\n"); }
/* 순매매 방향 — 서버 값(flow)이 없으면 주요 매매 목록으로 어림 */
function gxFlow(g) { if (g.flow != null) return g.flow; var b = (g.buys || []).reduce(function (a, m) { return a + (m.dv || 0); }, 0), s = (g.sells || []).reduce(function (a, m) { return a + (m.dv || 0); }, 0), base = g.prevTotal || g.total; return base ? (b + s) / base : null; }
function gxClamp(x) { return Math.max(-1, Math.min(1, x)); }
/* ④ 거장 국면 — 순매매 방향을 '13F 신뢰도 × 유형 가중'으로 평균. 매크로 · 딥밸류는 위험 태도를 더 잘 보여 줘 1.5배, 매크로는 옵션 기울기를 더한다 */
function gxRegime() {
  if (typeof dsGurus !== "function") return null; var G = dsGurus(), a = 0, b = 0, rows = [], per = "";
  G.forEach(function (g) { var P = GX_P[g.id]; if (!P) return; var f = gxFlow(g); if (f == null) return; var x = gxClamp(f / 0.1);
    if (P.ty === "macro" && g.optSum && g.total) x = gxClamp(x + gxClamp((g.optSum.call - g.optSum.put) / g.total / 0.2) * 0.5);
    var w = P.trust * (P.ty === "macro" || P.ty === "deep" ? 1.5 : 1); a += x * w; b += w; rows.push({ id: g.id, nm: g.nm, ty: P.ty, f: f, x: x, w: w }); if ((g.period || "") > per) per = g.period; });
  if (rows.length < 4 || !b) return null; var sc = Math.round(a / b * 100);
  var say = { up: 0, dn: 0 }, N = (GXA.doc && GXA.doc.notes) || {}; Object.keys(N).forEach(function (id) { var r = N[id] && N[id].stance && N[id].stance.risk; if (r === "확대") say.up++; else if (r === "축소") say.dn++; });
  return { score: sc, label: sc >= 25 ? "위험 확대" : sc <= -25 ? "위험 축소" : "중립", n: rows.length, rows: rows.sort(function (p, q) { return q.x - p.x; }), period: per, say: say };
}
/* 확신 종목 — 집중 투자자(13F 신뢰도 2 이상 · 상위 5종목 30% 이상)가 비중을 바꾼 폭(%p) × 신뢰도 */
function gxConviction() {
  var by = {}; (typeof dsGurus === "function" ? dsGurus() : []).forEach(function (g) { var P = GX_P[g.id], c = P && gxConc(g); if (!P || P.trust < 2 || !c || c.t5 < 0.3) return; var tot = g.total || 0;
    (g.buys || []).concat(g.sells || []).forEach(function (m) { var d = m.pw != null && m.w != null ? m.w - m.pw : (tot ? m.dv / tot : 0); if (Math.abs(d) < 0.005) return; var k = m.t || m.n, x = by[k] || (by[k] = { k: k, t: m.t, n: m.n, s: 0, who: [] }); x.s += d * 100 * P.trust / 3; x.who.push({ nm: g.nm, d: d, kind: m.kind, ty: P.ty }); }); });
  var L = Object.keys(by).map(function (k) { return by[k]; }); return { up: L.filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 6), dn: L.filter(function (x) { return x.s < 0; }).sort(function (a, b) { return a.s - b.s; }).slice(0, 6) };
}
/* 종목 하나를 누가 들고 있나 — 순위 상세 · 다른 화면에서 쓴다 */
function gxHolders(sym) {
  var out = []; if (!sym || typeof dsGurus !== "function" || !DS.guru) return out; var s = String(sym).toUpperCase();
  dsGurus().forEach(function (g) { var P = GX_P[g.id], hit = null; (g.top || []).forEach(function (x, i) { if (x.t === s) hit = { rank: i + 1, w: x.w, chg: x.chg }; });
    var mv = (g.buys || []).concat(g.sells || []).filter(function (m) { return m.t === s; })[0]; if (!hit && !mv) return;
    out.push({ id: g.id, nm: g.nm, ty: P ? P.ty : null, trust: P ? P.trust : 0, w: hit ? hit.w : (mv ? mv.w : null), rank: hit ? hit.rank : null, kind: mv ? mv.kind : (hit && hit.chg === "new" ? "new" : "hold"), pw: mv ? mv.pw : null, period: g.period }); });
  return out.sort(function (a, b) { return (b.w || 0) - (a.w || 0); });
}
function gxSumHtml() {
  var R = gxRegime(), G = dsGurus(); if (!G.length) return "";
  var open = true; try { open = localStorage.getItem("sm.gurux.sum") !== "0"; } catch (e) {}
  var h = '<details class="gxSum"' + (open ? " open" : "") + '><summary><b>거장 종합</b>' + (R ? '<span class="gxReg ' + (R.score >= 25 ? "up" : R.score <= -25 ? "dn" : "") + '">' + R.label + ' ' + (R.score > 0 ? "+" : "") + R.score + '</span><small>' + R.n + '명 · ' + (typeof dsQ === "function" ? dsQ(R.period) : R.period) + ' 13F 기준</small>' : '<small>자료가 4명 이상 모이면 계산해요</small>') + '</summary>';
  if (R) {
    var pos = Math.round((R.score + 100) / 2);
    h += '<div class="gxGauge"><div class="gxGb"><i style="left:' + pos + '%"></i></div><div class="gxGl"><span>위험 축소</span><span>중립</span><span>위험 확대</span></div></div>';
    h += '<p class="gxNote">순매매(주식 수 변화 × 분기 말 가격 ÷ 지난 분기 합계)를 사람마다 -100~+100으로 바꿔 평균했어요. 주가 변동은 빠져 있고, 13F 신뢰도가 높은 사람 · 매크로와 딥밸류 유형에 더 큰 무게를 줬어요.' + (R.say.up + R.say.dn ? ' 발언 조사 기준으로는 위험 확대 ' + R.say.up + '명 · 축소 ' + R.say.dn + '명.' : '') + ' 분기 말 기준이라 45일 넘게 늦은 그림이에요.</p>';
    h += '<div class="gxTyT"><div class="h"><span>유형</span><span>순매수한 사람 / 순매도한 사람</span><span>옵션</span><span>눈에 띄는 움직임</span></div>' + GX_TY_ORDER.map(function (ty) { var rs = R.rows.filter(function (r) { return r.ty === ty; }); if (!rs.length) return ""; var up = rs.filter(function (r) { return r.f > 0.01; }), dn = rs.filter(function (r) { return r.f < -0.01; }), put = 0, call = 0; G.forEach(function (g) { if (GX_P[g.id] && GX_P[g.id].ty === ty && g.optSum) { put += g.optSum.put || 0; call += g.optSum.call || 0; } });
      var top = rs.slice().sort(function (a, b) { return Math.abs(b.f) - Math.abs(a.f); })[0];
      return '<div style="--gx:' + GX_TYPES[ty].c + '"><span><i></i>' + GX_TYPES[ty].nm + '</span><span><b class="pos">' + up.length + '</b> / <b class="neg">' + dn.length + '</b><small>' + rs.length + '명</small></span><span>' + (put + call ? '풋 ' + dsUsd(put) + ' · 콜 ' + dsUsd(call) : '–') + '</span><span>' + (top ? gxE(top.nm) + ' ' + (top.f >= 0 ? "+" : "") + gxPc(top.f) + ' 순매' + (top.f >= 0 ? "수" : "도") : '') + '</span></div>'; }).join("") + '</div>';
    var C = gxConviction(), row = function (x) { return '<div><span class="gxCn">' + gxE(x.t || x.n) + '</span><b class="' + (x.s > 0 ? "pos" : "neg") + '">' + (x.s > 0 ? "+" : "") + x.s.toFixed(1) + '</b><small>' + x.who.slice(0, 3).map(function (w) { return gxE(w.nm) + " " + (w.kind === "new" ? "신규" : w.kind === "exit" ? "전량 매도" : (w.d > 0 ? "+" : "") + (w.d * 100).toFixed(1) + "%p"); }).join(" · ") + '</small></div>'; };
    if (C.up.length || C.dn.length) h += '<div class="gxCv"><div><h5>확신을 실은 종목</h5>' + (C.up.map(row).join("") || '<p class="briefDim">없음</p>') + '</div><div><h5>확신을 거둔 종목</h5>' + (C.dn.map(row).join("") || '<p class="briefDim">없음</p>') + '</div></div><p class="gxNote">집중 투자자(13F 신뢰도 ★★ 이상 · 상위 5종목 30% 이상)가 비중을 0.5%p 넘게 바꾼 종목만. 점수 = 비중 변화(%p) × 신뢰도. 수백 종목을 들고 있는 곳은 뺐어요.</p>';
  }
  return h + '</details>';
}
/* 인물 화면: 13F 밖의 이야기 + AI 해석 */
function gxAiHtml(id, g) {
  var D = GXA.doc || { notes: {}, ai: {} }, N = D.notes[id] || {}, A = D.ai[id], own = gxOwner(), T = GX_TYPES[GX_P[id].ty], h = '';
  var stale = A && g && A.period !== g.period;
  h += '<div class="mkStep"><b>AI</b>왜 이렇게 움직였나 <small class="briefDim">인물 정보 + 13F 숫자 + 발언을 겹쳐 읽은 추정이에요</small></div>';
  if (A) {
    h += '<div class="gxAi" style="--gx:' + T.c + '"><div class="gxAh"><b>' + gxE(A.head) + '</b><span class="gxReg ' + (A.risk === "확대" ? "up" : A.risk === "축소" ? "dn" : "") + '">위험 ' + gxE(A.risk) + '</span></div>' + (stale ? '<p class="gxStale">이 해석은 ' + dsQ(A.period) + ' 기준이에요 — 새 분기 보고서가 나왔어요.</p>' : '') + '<p class="gxAv">' + gxE(A.view) + '</p>' +
      '<div class="gxIn">' + (A.intent || []).map(function (x) { return '<div><div class="m"><b>' + gxE(x.move) + '</b><span class="gxCf c' + (x.conf === "높음" ? 3 : x.conf === "보통" ? 2 : 1) + '">확신 ' + gxE(x.conf) + '</span></div><p>' + gxE(x.why) + '</p>' + (x.basis ? '<small>근거: ' + gxE(x.basis) + '</small>' : '') + '</div>'; }).join("") + '</div>' +
      ((A.apply || []).length ? '<h5>우리는 이렇게 적용한다</h5><div class="gxAp">' + A.apply.map(function (x) { return '<div><b>' + gxE(x.do) + '</b><p>' + gxE(x.how) + '</p></div>'; }).join("") + '</div>' : '') +
      ((A.dont || []).length ? '<h5>이렇게 쓰면 안 된다</h5><ul>' + A.dont.map(function (x) { return '<li>' + gxE(x) + '</li>'; }).join("") + '</ul>' : '') +
      ((A.watch || []).length ? '<h5>다음 분기에 확인할 것</h5><ul>' + A.watch.map(function (x) { return '<li>' + gxE(x) + '</li>'; }).join("") + '</ul>' : '') +
      '<p class="gxTw"><b>한계</b> ' + gxE(A.caveat) + ' <span>· ' + new Date(A.at).toISOString().slice(0, 10) + ' 작성' + (A.withNote ? " · 발언 조사 반영" : " · 발언 조사 없이 작성") + (A.withMemo ? " · 메모 반영" : "") + '</span></p></div>';
  } else h += '<div class="dvNone">' + (own ? "아직 해석을 만들지 않았어요. 발언 조사를 먼저 하면 근거가 더 탄탄해져요." : "아직 해석이 준비되지 않았어요.") + '</div>';
  if (own && g) h += '<div class="gxBtns"><button type="button" class="chip" data-gxrun="read"' + (GXA.busy[id] ? " disabled" : "") + '>' + (GXA.busy[id] === "read" ? "해석하는 중…" : A ? "해석 다시 만들기" : "해석 만들기") + '</button><small class="briefDim">Claude 1회 · 웹 검색 없음</small></div>';
  h += '<div class="mkStep"><b>✎</b>13F 밖의 이야기 <small class="briefDim">공매도 · 선물 · 채권 · 현금과 "왜"는 13F에 없어요 — 인터뷰 · 서한에서 찾아요</small></div>';
  if ((N.views || []).length) h += '<div class="gxNv">' + N.views.map(function (v) { return '<div><span class="d">' + gxE(v.date) + '</span><span class="k">' + gxE(v.kind) + '</span><p>' + gxE(v.say) + (v.pos ? ' <em>' + gxE(v.pos) + '</em>' : '') + '<small>' + (v.url ? '<a href="' + gxE(v.url) + '" target="_blank" rel="noopener">' + gxE(v.src) + '</a>' : gxE(v.src)) + '</small></p></div>'; }).join("") + '</div>' + (N.stance && N.stance.risk !== "미확인" ? '<p class="gxNote"><b>발언으로 본 위험 태도: ' + gxE(N.stance.risk) + '</b> — ' + gxE(N.stance.why) + '</p>' : '') + ((N.miss || []).length ? '<p class="gxNote">찾지 못한 것 · 주의: ' + N.miss.map(gxE).join(" / ") + '</p>' : '') + '<p class="gxNote">' + gxE(N.asOf || "") + ' 조사 · AI가 웹에서 찾은 내용이라 원문 링크로 확인해 주세요.</p>';
  else if (N.at) h += '<div class="dvNone">최근 6개월 안에서 확인된 발언을 찾지 못했어요' + ((N.miss || []).length ? " — " + N.miss.map(gxE).join(" / ") : "") + '</div>';
  else h += '<div class="dvNone">' + (own ? "아직 조사하지 않았어요." : "아직 조사된 발언이 없어요.") + '</div>';
  if (N.memo && !own) h += '<p class="gxMemoV"><b>운영자 메모</b> ' + gxE(N.memo) + '</p>';
  if (own) h += '<div class="gxBtns"><button type="button" class="chip" data-gxrun="note"' + (GXA.busy[id] ? " disabled" : "") + '>' + (GXA.busy[id] === "note" ? "찾는 중… (1~3분)" : N.at ? "발언 다시 조사" : "발언 조사") + '</button><small class="briefDim">Claude 1회 · 웹 검색 사용</small></div><div class="gxMemo"><textarea data-gxmemo rows="3" placeholder="직접 본 내용을 적어 두면 해석에 반영해요. 예: 11월 인터뷰에서 구리 숏을 언급 — 경기 둔화에 거는 포지션">' + gxE(N.memo || "") + '</textarea><button type="button" class="chip" data-gxrun="memo">메모 저장</button></div>';
  return h;
}
function gxAiBind(box, id) {
  Array.prototype.forEach.call(box.querySelectorAll("[data-gxrun]"), function (b) { b.onclick = function () { var k = b.getAttribute("data-gxrun"), P = GX_P[id], body;
    if (k === "memo") { var ta = box.querySelector("[data-gxmemo]"); body = { memo: id, text: ta ? ta.value : "" }; }
    else if (k === "note") body = { note: id, profile: gxProfileText(id) };
    else body = { read: id, profile: gxProfileText(id), ty: GX_TYPES[P.ty].nm };
    if (k !== "memo") { GXA.busy[id] = k; renderGuru(); }
    gxApi(body).then(function (j) { delete GXA.busy[id]; if (!j || !j.ok) { gxToast((j && (j.msg || j.reason)) || "실패했어요", "bad"); renderGuru(); return; }
      GXA.doc = GXA.doc || { notes: {}, ai: {} }; if (j.note) GXA.doc.notes[id] = j.note; if (j.ai) GXA.doc.ai[id] = j.ai; gxToast(k === "memo" ? "메모를 저장했어요" : k === "note" ? "발언 조사를 마쳤어요" : "해석을 만들었어요"); renderGuru(); }); }; });
}
/* 구루 화면에 2~4단계 얹기 */
function gxDecorate2() {
  var box = document.getElementById("guruBody"); if (!box || typeof dsGurus !== "function") return;
  if (!GXA.doc) { gxAiLoad().then(function () { if (typeof watchPane === "undefined" || watchPane === "guru") renderGuru(); }); }
  var ty = box.querySelector(".gxTyRow"); if (ty && !box.querySelector(".gxSum")) { var s = document.createElement("div"); s.innerHTML = gxSumHtml(); if (s.firstChild) { var el = s.firstChild; ty.parentNode.insertBefore(el, ty); el.addEventListener("toggle", function () { try { localStorage.setItem("sm.gurux.sum", el.open ? "1" : "0"); } catch (e) {} }); } }
  var have = {}; dsGurus().forEach(function (x) { have[x.id] = x; });
  var id = GX.sel && !have[GX.sel] ? GX.sel : DS.g.id; if (!id || !GX_P[id]) return;
  var w = document.createElement("div"); w.className = "gxAiWrap"; w.innerHTML = gxAiHtml(id, have[id]);
  var ap = box.querySelector(".gxApply"), anchor = ap ? ap.nextSibling : null;
  if (ap) ap.parentNode.insertBefore(w, anchor); else { var card = box.querySelector(".gxCard"); if (card) card.parentNode.insertBefore(w, card.nextSibling); else box.appendChild(w); }
  gxAiBind(w, id);
}
/* ⑤ 종목 순위에 반영 — 켰을 때만. 국면 점수가 ±25를 넘으면 묶음 비중을 옮긴다(최대 10점) */
function gxRankOn() { try { return localStorage.getItem("sm.rank.gx") === "1"; } catch (e) { return false; } }
function gxAdjPlan() { var R = gxRegime(); if (!R || Math.abs(R.score) < 25) return { R: R, s: 0 }; return { R: R, s: Math.min(10, Math.round(Math.abs(R.score) / 10)) }; }
function gxAdjW(w) {
  if (!gxRankOn() || typeof DS === "undefined" || !DS.guru) return w; var P = gxAdjPlan(); if (!P.s || w.length < 5) return w;
  var o = w.slice(), s = P.s;
  if (P.R.score < 0) { var d = Math.min(s, o[0]); o[0] -= d; o[2] += Math.ceil(d / 2); o[3] += Math.floor(d / 2); }   // 위험 축소: 가격 · 기술(추세) ↓ → 낙폭 · 단계, 기업 · 본질 ↑
  else { var d2 = Math.min(s, o[2]); o[2] -= d2; o[0] += d2; }                                                          // 위험 확대: 낙폭 · 단계(깊은 곳 기다리기) ↓ → 가격 · 기술 ↑
  return o;
}
function gxRankBoxHtml() {
  var on = gxRankOn(), P = gxAdjPlan(), R = P.R, h = '<div class="egBox gxRk"><label class="gxSw"><input type="checkbox" data-gxrank' + (on ? " checked" : "") + '><b>거장 국면 반영</b></label>';
  if (!R) return h + '<span>거장 13F 자료가 4명 이상 모이면 쓸 수 있어요.</span></div>';
  h += '<span class="gxReg ' + (R.score >= 25 ? "up" : R.score <= -25 ? "dn" : "") + '">' + R.label + ' ' + (R.score > 0 ? "+" : "") + R.score + '</span><span>' + (!P.s ? "지금은 중립 구간(±25 안)이라 켜도 비중이 바뀌지 않아요." : R.score < 0 ? "거장들이 위험을 줄이는 중 → ① 가격 · 기술 비중 -" + P.s + ", ③ 낙폭 · 단계 +" + Math.ceil(P.s / 2) + ", ④ 기업 · 본질 +" + Math.floor(P.s / 2) + (on ? " (적용 중)" : " (켜면 적용)") : "거장들이 위험을 늘리는 중 → ③ 낙폭 · 단계 비중 -" + P.s + ", ① 가격 · 기술 +" + P.s + (on ? " (적용 중)" : " (켜면 적용)")) + '</span><small>분기 말 기준 13F로 만든 가설이에요. 과거 검증은 아직 못 했어요(쌓인 분기가 적어요) — 켜고 끈 순위를 비교해 참고만 하세요.</small></div>';
  return h;
}
function gxRankMount(el) {
  if (typeof DS === "undefined") return; if (!DS.guru) { if (typeof dsEnsure === "function" && !GXA._rk) { GXA._rk = 1; dsEnsure().then(function () { return gxAiLoad(); }).then(function () { if (typeof renderRank === "function" && document.getElementById("rankBody")) renderRank(); }); } return; }
  var top = el.querySelector(".rkTop"); if (!top) return; var w = document.createElement("div"); w.innerHTML = gxRankBoxHtml(); var b = w.firstChild; top.parentNode.insertBefore(b, top.nextSibling);
  var cb = b.querySelector("[data-gxrank]"); if (cb) cb.onchange = function () { try { localStorage.setItem("sm.rank.gx", cb.checked ? "1" : "0"); } catch (e) {} if (typeof RK !== "undefined") { RK._moods = null; } renderRank(); };
}
function gxHoldersHtml(sym) {
  var H = gxHolders(sym); if (!H.length) return "";
  var KN = { "new": "신규", add: "증액", trim: "축소", exit: "전량 매도", hold: "유지" };
  return '<div class="gxHold"><h4>거장 보유 <small>' + (typeof dsQ === "function" ? dsQ(H[0].period) : "") + ' 13F · 순위 점수에는 넣지 않고 참고로 보여 줘요</small></h4>' + H.slice(0, 8).map(function (x) { var T = x.ty ? GX_TYPES[x.ty] : null; return '<div><span class="n">' + (T ? '<i style="background:' + T.c + '"></i>' : '') + gxE(x.nm) + (T ? '<small>' + T.nm + '</small>' : '') + '</span><span>' + (x.w ? gxPc(x.w, 1) + (x.rank ? ' · ' + x.rank + '위' : '') : '–') + '</span><b class="' + (x.kind === "new" || x.kind === "add" ? "pos" : x.kind === "trim" || x.kind === "exit" ? "neg" : "") + '">' + KN[x.kind] + '</b></div>'; }).join("") + '<p>유형에 따라 무게가 달라요 — 매크로 투자자의 작은 비중은 뜻이 약하고, 집중 투자자의 신규 · 전량 매도는 강한 의견이에요.</p></div>';
}
(function () {
  if (typeof renderGuru === "function") { var r1 = renderGuru; renderGuru = function () { r1.apply(this, arguments); try { gxDecorate2(); } catch (e) { if (window.console) console.warn("gx2", e); } }; }
  if (typeof rkDetailHtml === "function") { var d0 = rkDetailHtml; rkDetailHtml = function (R) { var h = d0.apply(this, arguments); try { h += gxHoldersHtml(R && R.sym); } catch (e) {} return h; }; }
  var st = document.createElement("style"); st.textContent =
    ".gxSum{border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:12px;background:var(--card)}.gxSum summary{cursor:pointer;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:15px}.gxSum summary small{color:var(--sub);font-size:12.5px}.gxReg{font-size:12px;font-weight:800;padding:3px 9px;border-radius:6px;background:var(--soft,var(--card2));color:var(--txt2,var(--txt));white-space:nowrap}.gxReg.up{background:#fde8ea;color:var(--up)}.gxReg.dn{background:#e3eefe;color:var(--down)}" +
    ".gxGauge{margin:14px 0 6px}.gxGb{position:relative;height:10px;border-radius:5px;background:linear-gradient(90deg,#3182f6 0%,#dfe5ee 45%,#dfe5ee 55%,#f04452 100%)}.gxGb i{position:absolute;top:-4px;width:4px;height:18px;margin-left:-2px;background:var(--txt);border-radius:2px}.gxGl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--sub);margin-top:5px}.gxNote{font-size:12.5px;line-height:1.6;color:var(--sub);margin:8px 0}" +
    ".gxTyT{display:grid;gap:0;margin:10px 0;border:1px solid var(--line);border-radius:8px;overflow:hidden}.gxTyT>div{display:grid;grid-template-columns:150px 150px 170px 1fr;gap:10px;padding:8px 12px;font-size:13px;align-items:center;border-top:1px solid var(--line)}.gxTyT>div.h{border-top:0;background:var(--soft,var(--card2));font-size:12px;font-weight:700;color:var(--sub)}.gxTyT i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gx);margin-right:6px}.gxTyT small{color:var(--sub);margin-left:6px}" +
    ".gxCv{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}.gxCv h5,.gxAi h5{margin:12px 0 6px;font-size:12px;font-weight:800;color:var(--txt2,var(--txt))}.gxCv h5{margin-top:0}.gxCv>div>div{display:grid;grid-template-columns:70px 50px 1fr;gap:8px;font-size:13px;padding:5px 0;border-bottom:1px solid var(--line);align-items:baseline}.gxCn{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gxCv small{color:var(--sub);font-size:12px}.gxSum .pos,.gxHold .pos{color:var(--up)}.gxSum .neg,.gxHold .neg{color:var(--down)}" +
    ".gxAiWrap{margin-bottom:16px}.gxAi{border:1px solid var(--line);border-left:3px solid var(--gx);border-radius:10px;padding:14px 16px;background:var(--card)}.gxAh{display:flex;justify-content:space-between;gap:10px;align-items:center}.gxAh b{font-size:16.5px;letter-spacing:-.2px;word-break:keep-all}.gxAv{margin:8px 0 12px;font-size:14px;line-height:1.7;word-break:keep-all}.gxStale{font-size:12.5px;color:#8a6414;background:#fbf1d9;border-radius:6px;padding:6px 10px;margin:8px 0}" +
    ".gxIn{display:grid;gap:8px}.gxIn>div{padding:10px 12px;border-radius:8px;background:var(--soft,var(--card2))}.gxIn .m{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.gxIn .m b{font-size:14px;word-break:keep-all}.gxIn p{margin:4px 0 2px;font-size:13.5px;line-height:1.65;word-break:keep-all}.gxIn small{font-size:12px;color:var(--sub)}.gxCf{font-size:11.5px;font-weight:800;padding:2px 7px;border-radius:5px;white-space:nowrap;background:#eceff3;color:#5b6474}.gxCf.c3{background:#e2f4ea;color:#157347}.gxCf.c2{background:#fbf1d9;color:#8a6414}" +
    ".gxAp{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gxAp>div{border:1px solid var(--line);border-radius:8px;padding:10px 12px}.gxAp b{font-size:13.5px}.gxAp p{margin:4px 0 0;font-size:13px;line-height:1.6;word-break:keep-all}.gxAi ul{margin:0;padding-left:16px}.gxAi li{font-size:13px;line-height:1.65;word-break:keep-all}.gxAi .gxTw span{color:var(--sub)}" +
    ".gxBtns{display:flex;gap:8px;align-items:center;margin:8px 0 14px}.gxNv{display:grid;gap:0;border:1px solid var(--line);border-radius:10px;overflow:hidden}.gxNv>div{display:grid;grid-template-columns:86px 44px 1fr;gap:8px;padding:9px 12px;border-top:1px solid var(--line);font-size:13px;align-items:baseline}.gxNv>div:first-child{border-top:0}.gxNv .d{color:var(--sub);font-variant-numeric:tabular-nums}.gxNv .k{font-size:11.5px;font-weight:800;color:var(--txt2,var(--sub))}.gxNv p{margin:0;line-height:1.6;word-break:keep-all}.gxNv em{font-style:normal;font-weight:700;background:#fbf1d9;color:#8a6414;border-radius:4px;padding:1px 6px;font-size:12px;white-space:nowrap}.gxNv small{display:block;color:var(--sub);font-size:12px}.gxNv a{color:var(--accent)}" +
    ".gxMemo{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start;margin-bottom:14px}.gxMemo textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;resize:vertical;background:var(--card);color:var(--txt)}.gxMemoV{font-size:13px;line-height:1.6;padding:8px 12px;background:var(--soft,var(--card2));border-radius:8px}" +
    ".gxRk{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;font-size:13px}.gxRk small{flex-basis:100%;color:#8a92a3;font-size:12px}.gxSw{display:inline-flex;gap:6px;align-items:center;cursor:pointer}.gxAdj{color:#c9772b;font-weight:700}" +
    ".gxHold{margin-top:16px;border-top:1px solid #e6e9ef;padding-top:12px}.gxHold h4{margin:0 0 8px;font-size:14px}.gxHold h4 small{font-weight:500;color:#8a92a3;font-size:12px;margin-left:6px}.gxHold>div{display:grid;grid-template-columns:1fr 110px 80px;gap:8px;font-size:13px;padding:6px 0;border-bottom:1px solid #eef0f4;align-items:center}.gxHold .n i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px}.gxHold .n small{color:#8a92a3;margin-left:6px;font-size:11.5px}.gxHold b{text-align:right}.gxHold p{font-size:12px;color:#8a92a3;margin:8px 0 0}" +
    "@media(max-width:640px){.gxTyT>div{grid-template-columns:1fr 1fr}.gxTyT>div.h{display:none}.gxCv,.gxAp{grid-template-columns:1fr}.gxNv>div{grid-template-columns:78px 1fr}.gxNv .k{display:none}.gxMemo{grid-template-columns:1fr}}";
  document.head.appendChild(st);
})();
