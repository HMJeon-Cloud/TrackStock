/* ============================================================
   '투자 마음' 탭 (v7.2) — 나는 왜 사고, 어떻게 고를까 · 16가지 투자 유형
   MBTI처럼 4개 축 × 2 = 16유형. 축마다 몇 %인지도 보여줘서 같은 유형이어도 결과가 사람마다 다르다.
     P 지키기  ↔ G 불리기   (무엇을 원하나)
     D 숫자    ↔ S 이야기   (무엇을 보고 고르나)
     C 침착    ↔ R 민감     (떨어질 때 어떻게 반응하나)
     L 장기    ↔ T 타이밍   (언제·얼마나 오래)
   결과 = 16유형 × 축 강도 × 투자 이유(6) × 말한 기준 vs 실제(35) × 궁금한 것(7) → 사람마다 다른 조합
   조사 근거: 자본시장연구원(유튜브 종목 언급 1,128건), FINRA 재단(2026 SNS 투자자 조사), 트렌드모니터(2023),
             Barber & Odean(2000, 잦은 매매와 수익률), 서울신문(2026.9)
   응답 집계는 /api/poll (보기별 횟수만, 기기당 하루 1회)
   ============================================================ */
var MIND_Q = [
  { id: "m", multi: 2, title: "투자를 하는(하고 싶은) 이유는?", sub: "가장 가까운 것 최대 2개", opts: [
    ["cash", "💸", "가만히 있으면 손해 같아서", "물가·집값은 오르는데 통장 돈은 그대로"],
    ["rich", "🚀", "월급만으론 부자가 될 수 없어서", "근로소득만으론 목표까지 너무 멀어요"],
    ["fomo", "😰", "나만 뒤처지는 것 같아서", "주변은 다 벌었다는데…"],
    ["retire", "🏡", "노후·집·교육비가 걱정돼서", "언젠가 꼭 필요한 목돈"],
    ["fun", "🎲", "재미있고, 사람들과 얘기하려고", "차트 보고 종목 얘기하는 게 즐거워요"],
    ["belief", "🔭", "보이는 미래에 걸고 싶어서", "AI·반도체·전기차처럼 세상이 바뀌는 쪽"]
  ] },
  { id: "goal", title: "투자로 가장 원하는 건?", sub: "둘 중 더 가까운 쪽", opts: [
    ["P", "🛡️", "잃지 않고 지키는 것", "천천히 가도 괜찮아요"], ["G", "📈", "크게 불리는 것", "어느 정도 흔들림은 감수해요"] ] },
  { id: "bet", title: "1년 뒤 결과를 하나 고른다면?", sub: "직감으로!", opts: [
    ["P", "🔒", "확실하게 +5%", "무조건 이만큼"], ["G", "🎰", "반반 확률로 +30% 또는 -10%", "평균은 더 높지만 잃을 수도"] ] },
  { id: "s", title: "종목을 고를 때 가장 중요하다고 생각하는 건?", sub: "'이래야 한다'고 생각하는 기준", opts: [
    ["good", "🏢", "좋은 회사 (실적·1등)", ""], ["cheap", "🏷️", "싼 가격 (저평가)", ""], ["growth", "📈", "앞으로의 성장성", ""],
    ["safe", "🛡️", "안정성·배당", ""], ["spread", "🧺", "여러 개로 나눠 담기", ""] ] },
  { id: "look", title: "새로운 종목을 알게 되면 먼저 보는 건?", sub: "", opts: [
    ["D", "📊", "실적·주가 기록 같은 숫자", "얼마나 벌고, 얼마나 올랐나"], ["S", "📰", "관련 뉴스·영상·사람들 이야기", "무슨 회사고, 왜 화제인가"] ] },
  { id: "b", title: "가장 최근에 산 종목, 실제로는 어떻게 골랐나요?", sub: "솔직하게! 결과는 나만 봐요", opts: [
    ["news", "📺", "뉴스·유튜브에 자주 나와서", ""], ["rise", "🔥", "최근에 많이 올라서", ""], ["friend", "💬", "지인·커뮤니티에서 추천해서", ""],
    ["dip", "📉", "많이 떨어져서 싸 보여서", ""], ["leader", "🥇", "원래 알던 1등 기업·지수라서", ""], ["study", "🔍", "직접 비교하고 숫자를 따져서", ""],
    ["none", "🌱", "아직 사 본 적 없어요", ""] ] },
  { id: "pitch", title: "둘 중 더 끌리는 소개는?", sub: "", opts: [
    ["D", "🧾", "10년간 연평균 +8%, 최대 하락 -25%", "기록으로 증명된 자산"], ["S", "✨", "AI가 바꿀 세상의 핵심 기업", "앞으로가 더 기대되는 자산"] ] },
  { id: "f", title: "산 종목이 한 달 만에 -20%가 되면?", sub: "상상만 해도 괜찮아요", opts: [
    ["buy", "🛒", "더 산다 — 싸게 살 기회", ""], ["hold", "🧘", "그냥 둔다 — 언젠가 오르겠지", ""],
    ["sell", "✂️", "판다 — 더 잃기 전에", ""], ["panic", "😵", "잠이 안 온다… 아마 팔 것 같다", ""] ] },
  { id: "app", title: "증권 앱은 얼마나 자주 열어요?", sub: "", opts: [
    ["C", "🌙", "일주일에 한 번 이하", "잊고 지낼 때가 많아요"], ["R", "📱", "하루에도 여러 번", "자꾸 손이 가요"] ] },
  { id: "how", title: "돈을 넣는 방식은?", sub: "아직 안 해봤다면 하고 싶은 쪽", opts: [
    ["L", "🗓️", "정해진 날, 정해진 금액", "적금처럼 꾸준히"], ["T", "⏱️", "좋은 타이밍을 노려서", "쌀 때·기회가 보일 때"] ] },
  { id: "hold", title: "산 종목, 얼마나 들고 있을 생각이에요?", sub: "", opts: [
    ["L", "🌳", "5년 이상", "길게 보고 가요"], ["T", "🍃", "몇 주에서 몇 달", "목표 수익이 나면 정리"] ] },
  { id: "q", title: "지금 가장 궁금한 건?", sub: "하나만 고르면 데이터로 답해 볼게요", opts: [
    ["now", "🤔", "지금 사도 돼요?", ""], ["drop", "🕳️", "얼마나 떨어질 수 있어요? 언제 회복돼요?", ""],
    ["monthly", "🗓️", "매달 얼마씩 넣으면 몇 년 뒤 얼마예요?", ""], ["others", "👀", "남들은 뭐 사요?", ""],
    ["why", "❓", "왜 오르고 왜 떨어진 거예요?", ""], ["diff", "⚖️", "S&P500·나스닥·배당주, 뭐가 달라요?", ""],
    ["tax", "🧾", "세금·수수료는 얼마나 나가요?", ""] ] }
];
var MIND_LABEL = {};
MIND_Q.forEach(function (q) { q.opts.forEach(function (o) { MIND_LABEL[q.id + ":" + o[0]] = o[2]; }); });

/* ---------- 4개 축 ---------- */
var MIND_AXES = [
  { k: "PG", a: "P", b: "G", an: "지키기", bn: "불리기", ad: "잃지 않는 게 먼저", bd: "크게 불리는 게 먼저" },
  { k: "DS", a: "D", b: "S", an: "숫자", bn: "이야기", ad: "기록과 숫자로 판단", bd: "흐름과 이야기로 판단" },
  { k: "CR", a: "C", b: "R", an: "침착", bn: "민감", ad: "떨어져도 계획대로", bd: "움직임에 빨리 반응" },
  { k: "LT", a: "L", b: "T", an: "장기", bn: "타이밍", ad: "꾸준히, 길게", bd: "때를 골라서" }
];
/* 답 → 축 점수 (앞 글자 쪽 점수, 뒤 글자 쪽 점수) */
function mindAxes(a) {
  var sc = { P: 0, G: 0, D: 0, S: 0, C: 0, R: 0, L: 0, T: 0 };
  function add(k, v) { sc[k] += v; }
  var mw = { cash: ["P", 2], retire: ["P", 2], rich: ["G", 2], fomo: ["G", 1], fun: ["G", 1], belief: ["G", 2] };
  (a.m || []).forEach(function (m, i) { var x = mw[m]; if (x) add(x[0], i === 0 ? x[1] : x[1] / 2); if (m === "fomo") add("R", 1); if (m === "fun") add("T", 0.5); });
  if (a.goal) add(a.goal, 3); if (a.bet) add(a.bet, 3);
  ({ safe: [["P", 1]], spread: [["P", 1]], growth: [["G", 1], ["S", 1]], good: [["D", 1]], cheap: [["D", 1]] }[a.s] || []).forEach(function (x) { add(x[0], x[1]); });
  if (a.look) add(a.look, 3); if (a.pitch) add(a.pitch, 3);
  ({ study: [["D", 2]], leader: [["D", 1], ["L", 1]], dip: [["D", 1]], news: [["S", 2], ["T", 1]], friend: [["S", 2]], rise: [["S", 1], ["T", 1]] }[a.b] || []).forEach(function (x) { add(x[0], x[1]); });
  ({ buy: "C", hold: "C", sell: "R", panic: "R" }[a.f]) && add({ buy: "C", hold: "C", sell: "R", panic: "R" }[a.f], 3);
  if (a.app) add(a.app, 3);
  if (a.how) add(a.how, 3); if (a.hold) add(a.hold, 3);
  ({ monthly: "L", now: "T", others: "T" }[a.q]) && add({ monthly: "L", now: "T", others: "T" }[a.q], 1);
  var code = "", pct = {};
  MIND_AXES.forEach(function (x) {
    var A = sc[x.a], B = sc[x.b], p = A + B ? A / (A + B) : 0.5;
    pct[x.k] = p; code += p >= 0.5 ? x.a : x.b;
  });
  return { code: code, pct: pct };
}

/* ---------- 16유형 ---------- */
var MIND_TYPES16 = {
  PDCL: { emoji: "🏛️", name: "성벽 건축가", line: "무너지지 않는 계좌가 최고의 무기",
    desc: "지키는 게 목표고, 숫자로 판단하고, 흔들려도 버티며, 길게 가요. 투자 교과서에 가장 가까운 유형이에요.",
    strength: "큰 실수를 거의 하지 않아요. 시간이 갈수록 복리가 당신 편이에요.",
    trap: "너무 안전하게만 짜면 물가를 겨우 따라가는 계좌가 될 수 있어요. 지키는 자산과 불리는 자산의 비율을 숫자로 정해두세요.",
    rules: ["지수·채권·금을 정해진 비율로", "1년에 한 번, 비율이 틀어졌으면 되돌리기", "'안전 자산은 몇 %' 같은 나만의 기준 하나"] },
  PDCT: { emoji: "🦉", name: "신중한 저격수", line: "확실히 쌀 때만 방아쇠를 당기는 사람",
    desc: "잃지 않는 게 먼저지만, 기다리다 기회가 오면 움직여요. 숫자로 '싸다'가 확인돼야 사요.",
    strength: "비싸게 사는 일이 드물어요. 기다릴 줄 아는 인내심이 있어요.",
    trap: "'조금만 더 싸지면 사야지' 하다가 영영 못 사는 경우가 많아요. 기다리는 동안 현금은 물가에 조금씩 녹아요.",
    rules: ["살 가격·조건을 미리 적어두기", "조건이 오면 감정 없이, 나눠서 사기", "기다리는 현금은 이자라도 받는 곳에"] },
  PDRL: { emoji: "🧮", name: "걱정 많은 회계사", line: "숫자로 안심하고 싶은 사람",
    desc: "숫자를 꼼꼼히 보고 길게 갈 생각인데, 계좌가 파랗게 물들면 마음이 크게 흔들려요.",
    strength: "공부를 성실히 해서 근거 없는 투자를 잘 안 해요.",
    trap: "머리는 '버텨'라고 하는데 손이 '팔아'를 눌러요. 하락은 과거에도 생각보다 자주 왔다는 숫자를 미리 봐두면 덜 흔들려요.",
    rules: ["견딜 수 있는 최대 하락폭(예: -20%)에 맞춰 주식 비중 정하기", "앱은 일주일에 한 번만", "떨어지면 뉴스보다 '과거 하락 기록'부터 보기"] },
  PDRT: { emoji: "🚨", name: "비상벨 경비원", line: "위험 신호에 가장 먼저 반응하는 사람",
    desc: "잃지 않는 게 최우선이고, 숫자로 위험을 감지하면 빠르게 움직여요.",
    strength: "큰 폭락에서 빨리 빠져나올 수 있어요.",
    trap: "비상벨이 너무 자주 울려요. 미국 증시가 가장 크게 오른 날들은 가장 크게 떨어진 날 바로 근처에 몰려 있었어요. 팔고 나면 그 반등을 놓치기 쉬워요.",
    rules: ["팔 조건과 '다시 살 조건'을 같이 정하기", "전부가 아니라 일부만 줄이기", "비상금을 따로 둬서 급하게 팔 이유 없애기"] },
  PSCL: { emoji: "🌏", name: "큰 그림 정원사", line: "세상의 큰 흐름을 믿고 천천히 키우는 사람",
    desc: "지키는 게 목표지만 숫자보다 경제·세상의 큰 이야기로 판단해요. 한 번 정하면 오래 가요.",
    strength: "단기 소음에 흔들리지 않아요.",
    trap: "이야기가 바뀌었는데도 '원래 믿음'을 고집할 수 있어요. 가끔은 내 이야기를 숫자로 검증해 보세요.",
    rules: ["내 투자 이야기를 3줄로 적어두기", "1년에 한 번, 그 이야기가 아직 맞는지 숫자로 확인", "서로 다른 이야기를 가진 자산 2~3개로 나누기"] },
  PSCT: { emoji: "🌊", name: "물때 보는 어부", line: "분위기가 바뀌는 때를 읽는 사람",
    desc: "지키는 게 먼저인데, 시장 분위기와 뉴스 흐름을 보고 들어갈 때와 나올 때를 고르려 해요.",
    strength: "과열과 공포를 감으로 느끼는 눈치가 있어요.",
    trap: "분위기는 생각보다 늦게, 또는 너무 빨리 바뀌어요. 감이 맞았던 기억만 남기 쉬워요(확증 편향).",
    rules: ["분위기 판단을 기록하고 맞힌 비율 세보기", "공포지수·오른 종목 비율 같은 숫자도 같이 보기", "한 번에 전부가 아니라 비중만 조금씩 조절"] },
  PSRL: { emoji: "🕯️", name: "조마조마 수호자", line: "지키고 싶어서 오히려 불안한 사람",
    desc: "길게 지키고 싶지만, 나쁜 뉴스를 보면 마음이 크게 흔들려요.",
    strength: "위험을 진지하게 받아들이고, 무리하지 않아요.",
    trap: "뉴스는 나쁜 소식을 더 크게 다뤄요. 뉴스를 볼수록 불안이 커지고, 불안할 때 내린 결정이 가장 비싸요.",
    rules: ["뉴스 대신 숫자(내 자산의 과거 최대 하락)를 보기", "자동 적립으로 '결정할 일' 자체를 줄이기", "잃어도 잠잘 수 있는 만큼만"] },
  PSRT: { emoji: "📡", name: "뉴스 레이더", line: "소식에 가장 빨리 반응하는 사람",
    desc: "지키려는 마음이 커서 새 소식이 나오면 바로바로 대응해요.",
    strength: "정보가 빠르고 부지런해요.",
    trap: "반응할수록 수수료·세금·실수가 쌓여요. 뉴스로 나왔을 땐 이미 가격에 반영된 경우가 많아요.",
    rules: ["뉴스를 보고 24시간 뒤에 결정하기", "한 달 매매 횟수 상한 정하기", "핵심 자산은 손대지 않는 계좌에 따로"] },
  GDCL: { emoji: "🏔️", name: "복리 등반가", line: "좋은 걸 사서 오래 들고 가는 사람",
    desc: "불리는 게 목표지만 숫자로 확인하고, 흔들려도 버티며, 길게 가요. 이름 그대로 '우상향'에 가장 가까운 유형이에요.",
    strength: "복리의 힘을 제대로 쓸 수 있어요.",
    trap: "확신이 강해서 한두 종목에 몰리기 쉬워요. 좋은 기업도 10년씩 제자리걸음을 할 수 있어요.",
    rules: ["한 종목 최대 비중 정하기", "산 이유(숫자)를 적고 분기마다 확인", "지수를 바닥에 깔고 그 위에 종목"] },
  GDCT: { emoji: "⚡", name: "숫자 사냥꾼", line: "숫자로 확인한 기회를 놓치지 않는 사람",
    desc: "불리는 게 목표고, 숫자로 기회를 찾고, 흔들림에 강하며, 좋은 때를 노려 적극적으로 움직여요.",
    strength: "분석력과 실행력을 다 갖췄어요.",
    trap: "잘 맞힐수록 매매가 잦아지고 자신감이 커져요. 수수료·세금을 빼고도 지수를 이겼는지 꼭 비교해 보세요.",
    rules: ["1년에 한 번, 내 수익률과 S&P500 비교", "매수 전 체크리스트 3줄", "확신 없을 땐 쉬는 것도 매매"] },
  GDRL: { emoji: "🔬", name: "예민한 연구원", line: "공부는 깊게, 마음은 여린 사람",
    desc: "숫자로 성장할 곳을 찾아 길게 보려 하지만, 하락이 오면 마음이 많이 흔들려요.",
    strength: "근거를 갖고 투자해요.",
    trap: "공부한 만큼 확신했다가, 하락이 오면 그 확신이 한꺼번에 무너져 바닥에서 파는 패턴이 생기기 쉬워요. 확신과 비중은 따로 관리하세요.",
    rules: ["확신이 커도 비중은 정해둔 한도 안에서", "떨어졌을 때 할 행동을 미리 적어두기", "공부한 종목과 지수를 반반"] },
  GDRT: { emoji: "🏎️", name: "속도의 엔지니어", line: "숫자와 속도로 승부하는 사람",
    desc: "불리고 싶고, 숫자로 판단하고, 빠르게 반응하고, 타이밍을 노려요. 16유형 중 가장 바쁜 유형이에요.",
    strength: "판단과 실행이 빨라요.",
    trap: "개인 투자자 6만여 계좌를 분석한 연구(Barber & Odean)에서 가장 자주 사고판 그룹의 수익률이 가장 낮았어요. 속도가 곧 수익은 아니에요.",
    rules: ["빠른 매매 계좌와 장기 계좌 분리", "매매 일지(이유·결과) 쓰기", "빠른 매매는 전체 자산의 일부만"] },
  GSCL: { emoji: "🚀", name: "미래 항해사", line: "바뀔 세상에 길게 거는 사람",
    desc: "불리는 게 목표고, 큰 변화(기술·산업)의 이야기를 믿고, 흔들려도 버티며, 길게 가요.",
    strength: "큰 변화가 맞아떨어지면 가장 크게 버는 유형이에요.",
    trap: "이야기가 맞아도 주가는 틀릴 수 있어요. 닷컴 때 '인터넷이 세상을 바꾼다'는 맞았지만, 나스닥은 그 고점을 되찾는 데 15년이 걸렸어요.",
    rules: ["이야기 하나에 여러 종목, 그중 1등 위주", "버틸 수 있는 최대 하락을 숫자로 정하기", "1년에 한 번, 이야기가 아직 유효한지 점검"] },
  GSCT: { emoji: "🏄", name: "트렌드 서퍼", line: "흐름이 보이면 과감하게 올라타는 사람",
    desc: "불리고 싶고, 시장의 이야기와 흐름을 읽고, 흔들림에 강하며, 탈 때와 내릴 때를 고르려 해요.",
    strength: "흐름을 일찍 알아채고 과감해요.",
    trap: "화제가 됐을 땐 이미 많이 오른 뒤인 경우가 많아요. 유튜브에 언급된 종목은 언급 전부터 거래량이 2.25배였어요.",
    rules: ["탈 때 내릴 조건도 같이 정하기", "화제 종목은 전체의 일부만", "사기 전 '최근 한 달 상승률' 확인"] },
  GSRL: { emoji: "💫", name: "꿈꾸는 개미", line: "큰 꿈을 품었지만 마음은 여린 사람",
    desc: "크게 불리고 싶고 미래 이야기에 끌리지만, 하락이 오면 많이 불안해요.",
    strength: "꿈이 있어서 꾸준히 관심을 가져요. 관심은 모든 공부의 시작이에요.",
    trap: "꿈이 큰 종목일수록 많이 흔들려요. 흔들림을 못 견디면 꿈이 이뤄지기 전에 내리게 돼요.",
    rules: ["꿈 종목은 일부만, 나머지는 지수 적립", "사기 전에 그 종목의 과거 최대 하락부터 확인", "앱 확인은 하루 한 번까지"] },
  GSRT: { emoji: "🎢", name: "롤러코스터 탑승객", line: "짜릿함을 즐기는 사람",
    desc: "크게 불리고 싶고, 화제와 이야기에 끌리고, 빠르게 반응하고, 타이밍을 노려요. 가장 짜릿하지만 가장 위험한 조합이에요.",
    strength: "시장에 대한 관심과 에너지가 16유형 중 가장 커요.",
    trap: "SNS로 투자 정보를 얻는 사람은 투자 사기 권유를 받았을 때 실제로 돈을 잃은 비율이 68%로, 그렇지 않은 사람(26%)보다 훨씬 높았어요.",
    rules: ["재미 계좌엔 잃어도 되는 돈만", "레버리지·'추천방'은 멀리", "한 달에 한 번은 장기 계좌에도 적립"] }
};
/* 닮은 투자 대가 — 목적·판단·시간 축 기준 (잘 알려진 투자 철학만 요약) */
var MIND_MASTER = {
  PDL: ["존 보글", "인덱스 펀드의 아버지. 시장 전체를 낮은 비용으로 오래 들고 가라."],
  PDT: ["벤저민 그레이엄", "가치투자의 아버지. 충분히 쌀 때만 사는 '안전마진'."],
  PSL: ["레이 달리오", "경제의 큰 흐름을 읽고, 어떤 날씨에도 버티도록 나눠 담는 '올웨더'."],
  PST: ["하워드 막스", "시장은 시계추처럼 탐욕과 공포를 오간다. 지금이 어디쯤인지 읽어라."],
  GDL: ["워런 버핏", "좋은 기업을 적정한 가격에 사서 아주 오래 들고 간다."],
  GDT: ["피터 린치", "생활 속에서 기회를 찾고, 숫자로 확인해 적극적으로 산다."],
  GSL: ["필립 피셔", "오래 성장할 기업을 찾아 깊이 이해하고 끝까지 함께 간다."],
  GST: ["제시 리버모어", "시장의 흐름을 타는 추세 매매의 전설. 큰 성공과 큰 실패를 모두 겪었다."]
};
/* 투자 이유별 공감 문장 */
var MIND_MOTIVE = {
  cash: "월급은 그대로인데 물가와 집값은 오르죠. 통장에 그대로 둔 돈이 사실상 줄어드는 걸 느껴서 시작했을 거예요.",
  rich: "월급만으로는 원하는 삶까지 너무 멀다는 계산, 해 본 적 있죠. 투자는 그 거리를 줄일 거의 유일한 방법처럼 보여요.",
  fomo: "다들 벌었다는 얘기를 들으면 마음이 급해지죠. 그 조급함은 아주 자연스러운 감정이에요. 당신만 그런 게 아니에요.",
  retire: "노후, 집, 아이 교육비… 언젠가 꼭 필요한 목돈을 생각하면 지금부터 뭔가 해야 할 것 같죠.",
  fun: "차트를 보고 사람들과 종목 얘기하는 게 즐겁죠. 미국 조사에서도 SNS로 투자 정보를 보는 사람의 59%가 '재미'를 이유로 꼽았어요.",
  belief: "AI, 반도체, 전기차처럼 세상이 바뀌는 게 보이면 그 흐름에 함께하고 싶죠. 숫자보다 이야기에 끌리는 건 투자의 좋은 출발점이에요."
};
function mindFlip(code, idx) { var pairs = { P: "G", G: "P", D: "S", S: "D", C: "R", R: "C", L: "T", T: "L" }; return code.split("").map(function (ch, i) { return idx.indexOf(i) >= 0 ? pairs[ch] : ch; }).join(""); }
/* 말하는 기준 vs 실제로 고른 방식 */
var MIND_FIT = { good: ["leader", "study"], cheap: ["dip", "study"], growth: ["leader", "study"], safe: ["leader"], spread: ["leader", "study"] };
var MIND_B_FACT = {
  news: "자본시장연구원 분석: 유튜브에 언급된 종목은 언급 전부터 거래량이 2.25배, 주가는 언급 전날까지 이미 +1.3% (언급 당일은 +0.8%). 화제가 됐다는 건 '이미 움직였다'는 뜻일 때가 많아요.",
  rise: "많이 오른 종목은 '앞으로도'가 아니라 '이미'를 말해줘요. 같은 연구에서 화제 종목은 사람들이 몰리기 전에 먼저 올라 있었어요.",
  friend: "FINRA 재단 조사: SNS·커뮤니티로 정보를 얻는 투자자는 평균 7.6곳에서 정보를 찾을 만큼 부지런했지만, 투자 사기 권유를 받았을 때 실제로 돈을 잃은 비율은 68%로 그렇지 않은 사람(26%)보다 훨씬 높았어요.",
  dip: "떨어진 데엔 이유가 있을 때가 많아요. 시장 전체가 빠진 건지, 그 회사만 빠진 건지부터 나눠 보면 판단이 쉬워져요.",
  none: "아직 안 샀다면 지금이 기준을 만들기 가장 좋은 때예요. 첫 매수 전에 정한 기준이 가장 오래가요."
};

/* ---------- 상태 ---------- */
var mindState = { step: 0, a: {}, poll: null, hist: {}, result: null };
try { var _ms = JSON.parse(localStorage.getItem("sm.mind") || "null"); if (_ms && _ms.a && _ms.a.q && _ms.a.goal) { mindState.a = _ms.a; mindState.step = MIND_Q.length; } } catch (e) {}

function renderMind() {
  var box = $("mindBody"); if (!box) return;
  if (mindState.step >= MIND_Q.length) return renderMindResult();
  var q = MIND_Q[mindState.step], cur = mindState.a[q.id];
  var sel = q.multi ? (cur || []) : (cur ? [cur] : []), two = q.opts.length === 2;
  box.innerHTML =
    '<div class="mindProg"><div style="width:' + Math.round(mindState.step / MIND_Q.length * 100) + '%"></div></div>' +
    '<div class="mindStep">' + (mindState.step + 1) + ' / ' + MIND_Q.length + '</div>' +
    '<h3 class="mindQ">' + q.title + '</h3><div class="mindSub">' + (q.sub || "&nbsp;") + '</div>' +
    '<div class="mindOpts' + (two ? ' two' : '') + '">' + q.opts.map(function (o) {
      return '<button class="mindOpt' + (sel.indexOf(o[0]) >= 0 ? ' on' : '') + '" data-v="' + o[0] + '"><span class="mindEmo">' + o[1] + '</span><span><b>' + o[2] + '</b>' + (o[3] ? '<small>' + o[3] + '</small>' : '') + '</span></button>';
    }).join("") + '</div>' +
    '<div class="row mindNav">' + (mindState.step ? '<button class="chip" id="mindPrev">‹ 이전</button>' : '<span></span>') +
    (q.multi ? '<button class="primary" id="mindNext"' + (sel.length ? '' : ' disabled') + '>다음 ›</button>' : '') + '</div>';
  Array.prototype.forEach.call(box.querySelectorAll(".mindOpt"), function (b) {
    b.onclick = function () {
      var v = b.getAttribute("data-v");
      if (q.multi) {
        var arr = (mindState.a[q.id] || []).slice(), i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else { arr.push(v); if (arr.length > q.multi) arr.shift(); }
        mindState.a[q.id] = arr; renderMind();
      } else { mindState.a[q.id] = v; mindState.step++; mindAfterStep(); }
    };
  });
  if ($("mindPrev")) $("mindPrev").onclick = function () { mindState.step--; renderMind(); };
  if ($("mindNext")) $("mindNext").onclick = function () { mindState.step++; mindAfterStep(); };
}
function mindAfterStep() {
  if (mindState.step >= MIND_Q.length) {
    try { localStorage.setItem("sm.mind", JSON.stringify({ a: mindState.a, at: Date.now() })); } catch (e) {}
    mindSendPoll();
  }
  renderMind();
  var card = $("mindCard"); if (card) window.scrollTo({ top: Math.max(0, card.offsetTop - 70), behavior: "smooth" });
}
function mindSendPoll() {
  var today = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem("sm.mind.sent") === today) return; localStorage.setItem("sm.mind.sent", today); } catch (e) {}
  var a = mindState.a, t = mindAxes(a).code;
  fetch("/api/poll?m=" + encodeURIComponent((a.m || []).join(",")) + "&s=" + a.s + "&b=" + a.b + "&f=" + a.f + "&q=" + a.q + "&t=" + t).catch(function () {});
}

/* ---------- 데이터 계산 ---------- */
function mindLoad(list) {
  return Promise.all(list.map(function (sym) {
    if (mindState.hist[sym]) return null;
    return getChartData(sym, "max").then(function (p) { mindState.hist[sym] = (p && p.rows) || []; }).catch(function () { mindState.hist[sym] = []; });
  }));
}
function mAt(rows, t) { var lo = 0, hi = rows.length - 1; if (hi < 0) return -1; while (lo < hi) { var m = (lo + hi) >> 1; if (rows[m].t < t) lo = m + 1; else hi = m; } return lo; }
function mFx(sym, t) {
  if (/\.K[SQ]$|^\^KS/.test(sym)) return 1;
  var fx = mindState.hist["KRW=X"]; if (!fx || fx.length < 100) return 1;
  var i = mAt(fx, t); if (i > 0 && fx[i].t > t) i--; return fx[i].c || 1;
}
function mName(sym) { return typeof briefName === "function" ? briefName({ sym: sym, name: sym }) : sym; }
function mP(x, d) { return typeof cPct === "function" ? cPct(x, d) : (x * 100).toFixed(d || 0) + "%"; }
function mMan(v) { return typeof cMan === "function" ? cMan(v) : Math.round(v / 1e4) + "만원"; }
/* 아무 날에나 샀다면 1년 뒤 플러스였던 비율 (최근 20년 이내) */
function mWinRate(rows) {
  if (!rows || rows.length < 400) return null;
  var start = Math.max(0, mAt(rows, Date.now() - 20 * 365.25 * 86400000)), win = 0, n = 0, worst = 0, first = null;
  for (var i = start; i < rows.length; i++) {
    var j = mAt(rows, rows[i].t + 365 * 86400000); if (j >= rows.length || rows[j].t < rows[i].t + 360 * 86400000) break;
    var r = rows[j].c / rows[i].c - 1; n++; if (r > 0) win++; if (r < worst) worst = r; if (first == null) first = rows[i].t;
  }
  return n > 200 ? { p: win / n, worst: worst, from: new Date(first).getFullYear() } : null;
}
/* 고점 대비 -20% 이상 하락 구간: 횟수, 가장 깊은 하락과 회복 기간 */
function mDrops(rows) {
  if (!rows || rows.length < 400) return null;
  var start = Math.max(0, mAt(rows, Date.now() - 20 * 365.25 * 86400000));
  var peak = rows[start].c, peakT = rows[start].t, inDD = false, cnt = 0, worst = { dd: 0 }, cur = null;
  for (var i = start; i < rows.length; i++) {
    var c = rows[i].c;
    if (c >= peak) {
      if (cur) { cur.rec = Math.round((rows[i].t - cur.troughT) / 86400000); cur.total = Math.round((rows[i].t - cur.peakT) / 86400000); cur = null; }
      peak = c; peakT = rows[i].t; inDD = false; continue;
    }
    var dd = c / peak - 1;
    if (dd <= -0.2 && !inDD) { inDD = true; cnt++; }
    if (!cur || cur.peakT !== peakT) cur = { peakT: peakT, dd: dd, troughT: rows[i].t, rec: null };
    if (dd < cur.dd) { cur.dd = dd; cur.troughT = rows[i].t; }
    if (cur.dd < worst.dd) worst = cur;
  }
  var last = rows[rows.length - 1];
  return { cnt: cnt, worst: worst, from: new Date(rows[start].t).getFullYear(), now: last.c / peak - 1 };
}
/* 매달 10만원 적립 (원화) */
function mDca(sym, years) {
  var r = mindState.hist[sym], now = Date.now(), t0 = now - years * 365.25 * 86400000;
  if (!r || !r.length || r[0].t > t0 + 20 * 86400000) return null;
  var d = new Date(t0), units = 0, n = 0;
  for (var m = 0; m < years * 12; m++) {
    var ms = new Date(d.getFullYear(), d.getMonth() + 1 + m, 1).getTime(); if (ms > now) break;
    var i = mAt(r, ms); if (i < 0 || r[i].t < ms) continue;
    units += 100000 / (r[i].c * mFx(sym, r[i].t)); n++;
  }
  var last = r[r.length - 1];
  return n ? { principal: n * 100000, val: units * last.c * mFx(sym, last.t) } : null;
}
/* N년 전 목돈 → 지금 (원화) */
function mLump(sym, years, amt) {
  var r = mindState.hist[sym], t0 = Date.now() - years * 365.25 * 86400000;
  if (!r || !r.length || r[0].t > t0 + 20 * 86400000) return null;
  var i = mAt(r, t0), last = r[r.length - 1];
  return amt * (last.c * mFx(sym, last.t)) / (r[i].c * mFx(sym, r[i].t));
}
function mCagr(sym, years) {
  var r = mindState.hist[sym], t0 = Date.now() - years * 365.25 * 86400000;
  if (!r || !r.length || r[0].t > t0 + 20 * 86400000) return null;
  var i = mAt(r, t0), last = r[r.length - 1], mdd = 0, pk = r[i].c;
  for (var k = i; k < r.length; k++) { if (r[k].c > pk) pk = r[k].c; var dd = r[k].c / pk - 1; if (dd < mdd) mdd = dd; }
  return { cagr: Math.pow(last.c / r[i].c, 1 / years) - 1, mdd: mdd };
}

var MIND_SYMS = { now: ["SPY", "005930.KS", "BTC-USD"], drop: ["SPY", "005930.KS", "BTC-USD"], monthly: ["SPY", "005930.KS", "BTC-USD", "KRW=X"],
  diff: ["SPY", "QQQ", "SCHD"], cash: ["SPY", "^KS11", "GLD", "KRW=X"] };
function mindAxisLine(x, p) {
  var first = p >= 0.5, v = Math.round((first ? p : 1 - p) * 100), name = first ? x.an : x.bn;
  var lvl = v >= 75 ? "확실한 " : v >= 60 ? "" : "살짝 ";
  return { v: v, first: first, name: name, txt: lvl + name + " 쪽 — " + (first ? x.ad : x.bd) + (v < 60 ? " (반대쪽 성향도 꽤 있어요)" : "") };
}
function renderMindResult() {
  var box = $("mindBody"), a = mindState.a, ax = mindAxes(a), code = ax.code, T = MIND_TYPES16[code];
  mindState.result = ax;
  var fit = (MIND_FIT[a.s] || []).indexOf(a.b) >= 0;
  var master = MIND_MASTER[code[0] + code[1] + code[3]];
  var good = mindFlip(code, [2, 3]), clash = mindFlip(code, [0, 1, 2, 3]);
  var h = '';
  /* ① 유형 */
  h += '<div class="mindHero"><div class="mindHeroEmo">' + T.emoji + '</div><div><small>나의 투자 유형</small>' +
    '<div class="mindCode">' + code.split("").map(function (ch) { return '<span>' + ch + '</span>'; }).join("") + '</div>' +
    '<h2>' + T.name + '</h2><p>' + T.line + '</p></div></div>';
  /* ② 4개 축 */
  h += '<div class="mindBox"><div class="mindBoxT">🧭 나의 4가지 성향</div>' + MIND_AXES.map(function (x) {
    var p = ax.pct[x.k], L = mindAxisLine(x, p);
    return '<div class="mindAxis"><div class="mindAxisTop"><span class="' + (L.first ? 'on' : '') + '">' + x.a + ' ' + x.an + '</span><b>' + L.v + '% ' + L.name + '</b><span class="' + (L.first ? '' : 'on') + '">' + x.bn + ' ' + x.b + '</span></div>' +
      '<div class="mindAxisBar"><i style="left:' + (100 - Math.round(p * 100)) + '%"></i></div><div class="mindAxisTxt">' + L.txt + '</div></div>';
  }).join("") + '</div>';
  /* ③ 공감 + 설명 */
  var mot = (a.m || []).map(function (m) { return MIND_MOTIVE[m]; }).filter(Boolean);
  h += '<div class="mindBox"><div class="mindBoxT">💛 이런 마음이었죠</div><p>' + (mot[0] || "") + '</p><p>' + T.desc + '</p>' +
    '<div class="mindTwo"><div><b>강점</b><p>' + T.strength + '</p></div><div><b>조심할 함정</b><p>' + T.trap + '</p></div></div></div>';
  /* ④ 닮은 대가 + 궁합 */
  h += '<div class="mindBox"><div class="mindBoxT">🤝 닮은 투자 대가 · 궁합</div>' +
    '<div class="mindMaster"><span>🎩</span><div><b>' + master[0] + '</b><p>' + master[1] + '</p></div></div>' +
    '<div class="mindPair"><button class="mindPairItem" data-code="' + good + '"><small>💚 서로 보완하는 짝</small><b>' + MIND_TYPES16[good].emoji + ' ' + good + ' ' + MIND_TYPES16[good].name + '</b><span>목표는 같고, 반응·시간 감각이 반대라 서로의 빈틈을 메워줘요</span></button>' +
    '<button class="mindPairItem" data-code="' + clash + '"><small>⚡ 부딪히기 쉬운 유형</small><b>' + MIND_TYPES16[clash].emoji + ' ' + clash + ' ' + MIND_TYPES16[clash].name + '</b><span>모든 성향이 정반대 — 같이 투자 얘기하면 할 말이 많아요</span></button></div>' +
    '<div class="briefDim" style="margin-top:6px">대가의 투자 철학을 한 줄로 요약한 재미 요소예요. 실제 그 사람과 같다는 뜻은 아니에요.</div></div>';
  /* ⑤ 말하는 기준 vs 실제 */
  h += '<div class="mindBox"><div class="mindBoxT">🪞 말하는 기준 vs 실제로 고른 방식</div>' +
    '<div class="mindVs"><div><small>중요하다고 한 것</small><b>' + MIND_LABEL["s:" + a.s] + '</b></div><div class="mindVsArrow">' + (fit ? "=" : "≠") + '</div><div><small>실제로 고른 방식</small><b>' + MIND_LABEL["b:" + a.b] + '</b></div></div>' +
    '<p>' + (a.b === "none" ? MIND_B_FACT.none : fit ? "말하는 기준과 실제로 고르는 방식이 같아요. 이게 생각보다 드문 일이에요. 지금처럼 '산 이유'를 숫자로 남겨두면 흔들릴 때 큰 힘이 돼요." :
      "대부분의 사람이 이 차이를 갖고 있어요. 머리로 아는 기준과 손이 누르는 버튼이 달라요. " + (MIND_B_FACT[a.b] || "")) + '</p></div>';
  /* ⑥ 다른 사람들 */
  h += '<div class="mindBox"><div class="mindBoxT">👥 다른 사람들은 어떻게 답했을까</div><div id="mindPoll"><div class="briefDim">불러오는 중…</div></div></div>';
  /* ⑦ 내 질문에 대한 데이터 답 */
  h += '<div class="mindBox"><div class="mindBoxT">🔢 "' + MIND_LABEL["q:" + a.q] + '"에 데이터로 답하면</div><div id="mindAns"><div class="briefDim">과거 데이터를 계산하는 중…</div></div></div>';
  if ((a.m || []).indexOf("cash") >= 0)
    h += '<div class="mindBox"><div class="mindBoxT">💸 "가만히 있으면 손해" — 정말일까?</div><div id="mindCash"><div class="briefDim">계산 중…</div></div></div>';
  if ((a.f === "sell" || a.f === "panic") && a.q !== "drop")
    h += '<div class="mindBox"><div class="mindBoxT">😵 -20%에서 판다면 — 과거엔 어땠을까</div><div id="mindFear"><div class="briefDim">계산 중…</div></div></div>';
  /* ⑧ 규칙 */
  h += '<div class="mindBox mindRules"><div class="mindBoxT">📌 ' + T.name + '을 위한 나만의 규칙 3개</div><ol>' + T.rules.map(function (r) { return '<li>' + r + '</li>'; }).join("") + '</ol></div>';
  /* ⑨ 16유형 전체 */
  h += '<details class="mindBox mindAll"><summary class="mindBoxT">🗂️ 16가지 유형 전체 보기</summary><div class="mindGrid">' + Object.keys(MIND_TYPES16).map(function (k) {
    var t = MIND_TYPES16[k];
    return '<button class="mindGridItem' + (k === code ? ' me' : '') + '" data-code="' + k + '"><span>' + t.emoji + '</span><b>' + k + '</b><small>' + t.name + '</small></button>';
  }).join("") + '</div><div id="mindPeek"></div></details>';
  h += '<div class="row mindNav"><button class="chip" id="mindRetry">↺ 다시 하기</button><button class="primary" id="mindCardBtn">🃏 결과 카드 만들기</button></div>' +
    '<div class="briefDim" style="margin-top:8px">근거: 자본시장연구원 「유튜브 주식채널의 정보효과와 위험요인」, FINRA 재단 SNS 투자자 조사(2026), 트렌드모니터 주식투자 조사(2023), Barber & Odean(2000). 재미로 보는 성향 테스트이며 과거 데이터 기반, 투자 조언이 아니에요.</div>';
  box.innerHTML = h;
  $("mindRetry").onclick = function () { mindState.a = {}; mindState.step = 0; try { localStorage.removeItem("sm.mind"); } catch (e) {} renderMind(); };
  $("mindCardBtn").onclick = mindCardOpen;
  Array.prototype.forEach.call(box.querySelectorAll("[data-code]"), function (b) { b.onclick = function () { mindPeek(b.getAttribute("data-code")); }; });
  mindLoadPoll(code);
  var need = (MIND_SYMS[a.q] || []).slice();
  if ($("mindCash")) need = need.concat(MIND_SYMS.cash);
  if ($("mindFear")) need = need.concat(MIND_SYMS.drop);
  if (need.length && need.indexOf("KRW=X") < 0 && need.some(function (s) { return !/\.K[SQ]$|^\^KS/.test(s); })) need.push("KRW=X");
  mindLoad(need.filter(function (s, i) { return need.indexOf(s) === i; })).then(function () {
    mindRenderAnswer(a.q, $("mindAns"));
    if ($("mindCash")) mindRenderAnswer("cash", $("mindCash"));
    if ($("mindFear")) mindRenderAnswer("drop", $("mindFear"), true);
  });
}
/* 다른 유형 살짝 보기 */
function mindPeek(k) {
  var t = MIND_TYPES16[k], el = $("mindPeek"), det = document.querySelector(".mindAll"); if (!t || !el) return;
  if (det) det.open = true;
  el.innerHTML = '<div class="mindPeekBox"><b>' + t.emoji + ' ' + k + ' · ' + t.name + '</b><small>' + t.line + '</small><p>' + t.desc + '</p><p><b>함정</b> ' + t.trap + '</p><p class="briefDim">닮은 대가: ' + MIND_MASTER[k[0] + k[1] + k[3]][0] + '</p></div>';
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* 다른 사람들의 응답 (응답 30명 미만이면 조사 자료로 대신) */
function mindLoadPoll(code) {
  var el = $("mindPoll"), a = mindState.a;
  fetch("/api/poll").then(function (r) { return r.json(); }).then(function (j) {
    var c = j.counts || {}, n = j.total || 0;
    if (n < 30) {
      el.innerHTML = '<p>아직 응답이 ' + n + '명이라 조금 더 모이면 보여드릴게요. 대신 조사 자료로 보면:</p>' +
        mRow("주식 투자 심리 — 손실 불안감", "36.1%", "수익 기대감(34.2%)보다 조금 높아요 · 트렌드모니터 2023", "var(--down)") +
        mRow("SNS로 정보 얻는 미국 투자자 — '재미' 때문", "59%", "그렇지 않은 투자자는 18% · FINRA 재단", "var(--accent)") +
        mRow("젊은 투자자(18~34세) — SNS로 투자 결정", "60%", "전체 투자자는 29% · FINRA 재단", "var(--accent)") +
        '<p class="mindFoot">사고 싶은 마음 반, 잃을까 무서운 마음 반. 다들 비슷해요.</p>';
      return;
    }
    var types = Object.keys(MIND_TYPES16).map(function (k) { return { k: k, v: c["t:" + k] || 0 }; }).sort(function (x, y) { return y.v - x.v; });
    var tTot = types.reduce(function (s, t) { return s + t.v; }, 0) || 1, mine = types.filter(function (t) { return t.k === code; })[0], rank = types.indexOf(mine) + 1;
    function bars(prefix, title, mineArr) {
      var q = MIND_Q.filter(function (x) { return x.id === prefix; })[0];
      var rows = q.opts.map(function (o) { return { k: o[0], l: o[2], v: c[prefix + ":" + o[0]] || 0 }; }).sort(function (x, y) { return y.v - x.v; });
      var tot = prefix === "m" ? n : rows.reduce(function (s, r) { return s + r.v; }, 0) || 1;
      return '<div class="mindBarsT">' + title + '</div>' + rows.map(function (r) {
        var p = Math.round(r.v / tot * 100), me = mineArr.indexOf(r.k) >= 0;
        return '<div class="mindBar' + (me ? ' me' : '') + '"><span>' + r.l + (me ? ' <em>나</em>' : '') + '</span><div><i style="width:' + p + '%"></i></div><b>' + p + '%</b></div>';
      }).join("");
    }
    var typeBars = '<div class="mindBarsT">유형 순위 (상위 5)</div>' + types.slice(0, 5).map(function (t) {
      var p = Math.round(t.v / tTot * 100), me = t.k === code;
      return '<div class="mindBar' + (me ? ' me' : '') + '"><span>' + MIND_TYPES16[t.k].emoji + ' ' + t.k + ' ' + MIND_TYPES16[t.k].name + (me ? ' <em>나</em>' : '') + '</span><div><i style="width:' + p + '%"></i></div><b>' + p + '%</b></div>';
    }).join("");
    el.innerHTML = '<p>지금까지 <b>' + n.toLocaleString() + '명</b>이 답했어요. 나와 같은 <b>' + code + '</b> 유형은 <b>' + Math.round((mine ? mine.v : 0) / tTot * 100) + '%</b>, 16유형 중 <b>' + rank + '위</b>예요.</p>' +
      typeBars + bars("m", "투자하는 이유 (최대 2개)", a.m || []) + bars("b", "실제로 고른 방식", [a.b]) + bars("f", "-20%가 되면", [a.f]);
  }).catch(function () { el.innerHTML = '<div class="briefDim">지금은 불러올 수 없어요.</div>'; });
}

/* ---------- 결과 카드 (cards.js의 블랙 & 골드 도구 재사용) ---------- */
function mindCardOpen() {
  if (typeof cNew !== "function") return;
  var a = mindState.a, ax = mindState.result || mindAxes(a), code = ax.code, T = MIND_TYPES16[code], master = MIND_MASTER[code[0] + code[1] + code[3]];
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  function draw() {
    var c = cNew(), g = c.g, P = CARD.PAD, W = CARD.W - P * 2;
    cHead(c, "나의 투자 유형", "", null, 0, 0);
    // 머리: 4글자 코드(금색) + 유형 이름(흰색)
    cText(g, code.split("").join("  "), P - 2, 166, 76, 800, CARD_C.gold2);
    cText(g, T.emoji + " " + T.name, P, 222, 40, 800, CARD_C.onNavy);
    cSummary(c, T.line);
    // 4개 축 막대 — 기운 쪽에서부터 채움 (흰 박스 안)
    cBox(g, P, c.y, W, MIND_AXES.length * 80 + 24, 16); c.y += 20;
    MIND_AXES.forEach(function (x) {
      var p = ax.pct[x.k], L = mindAxisLine(x, p), y = c.y, bx = P + 28, bw2 = W - 56;
      cText(g, x.a + " " + x.an, bx, y + 30, 24, 700, L.first ? CARD_C.navy : CARD_C.sub);
      cText(g, x.bn + " " + x.b, bx + bw2, y + 30, 24, 700, L.first ? CARD_C.sub : CARD_C.navy, "right");
      cText(g, L.v + "%", CARD.W / 2, y + 30, 24, 800, CARD_C.txt, "center");
      cRound(g, bx, y + 46, bw2, 12, 6, "#e3ddd0");
      var lg = g.createLinearGradient(bx, 0, bx + bw2, 0);
      lg.addColorStop(0, L.first ? CARD_C.gold2 : "#b08d3e"); lg.addColorStop(1, L.first ? "#b08d3e" : CARD_C.gold2);
      if (L.first) cRound(g, bx, y + 46, Math.max(12, bw2 * p), 12, 6, lg); else cRound(g, bx + bw2 * p, y + 46, Math.max(12, bw2 * (1 - p)), 12, 6, lg);
      c.y += 80;
    });
    c.y += 26;
    cLabel(c, "나만의 규칙");
    T.rules.forEach(function (r, i) {
      cBox(g, P, c.y, W, 52, 12);
      cText(g, String(i + 1), P + 30, c.y + 35, 24, 800, CARD_C.gold, "center");
      cText(g, cFit(g, r, W - 80, 24, 600), P + 56, c.y + 35, 24, 600, CARD_C.txt); c.y += 60;
    });
    c.y += 6;
    cBox(g, P, c.y, W, 56, 12);
    cText(g, "닮은 투자 대가  ", P + 24, c.y + 37, 23, 700, CARD_C.warmTxt);
    cText(g, master[0], P + 24 + cW(g, "닮은 투자 대가  ", 23, 700), c.y + 37, 25, 800, CARD_C.txt); c.y += 56;
    cNote(c, "당신의 4글자는? 댓글로 알려주세요");
    cFoot(c, "우상향연구소 투자 유형 테스트 · 16유형", "mind");
    return c.cv;
  }
  ready.then(function () {
    CARD_TXT = ""; draw();
    if (!document.fonts || !document.fonts.load) return;
    var txt = CARD_TXT.replace(/\s+/g, "");
    return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); }));
  }).then(function () {
    var cv = draw(), url = cv.toDataURL("image/png"), file = "uphill.lab_투자유형_" + code + "_" + T.name + ".png";
    var box = document.createElement("div");
    box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="save">⬇ 저장</button>' +
      (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유</button>' : '') + '<span class="briefDim">1080×1350 · 저장이 안 되면 이미지를 길게 눌러 저장</span></div>' +
      '<img alt="" style="width:100%;max-width:420px;border-radius:12px;display:block;margin:0 auto">';
    box.querySelector("img").src = url;
    box.querySelector('[data-act="save"]').onclick = function () { var l = document.createElement("a"); l.href = url; l.download = file; document.body.appendChild(l); l.click(); l.remove(); };
    var sh = box.querySelector('[data-act="share"]');
    if (sh) sh.onclick = function () { cv.toBlob(function (b) { var f = new File([b], file, { type: "image/png" }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(function () {}); }); };
    infoModal.open("🃏 나의 투자 유형 카드", box);
  });
}
function mRow(name, val, sub, color) {
  return '<div class="briefRow"><span></span><span class="briefRowName">' + name + '</span><span class="briefRowMeta">' + (sub || "") + '</span><b style="color:' + (color || "var(--txt)") + '">' + val + '</b></div>';
}
function mindRenderAnswer(q, el, fearMode) {
  if (!el) return;
  var H = mindState.hist, h = "", up = "var(--up)", dn = "var(--down)";
  if (q === "now") {
    h += '<p>솔직히 말하면 "지금 사도 되는지"는 아무도 몰라요. 대신 <b>과거에 아무 날이나 골라 샀다면</b> 1년 뒤 어땠는지는 셀 수 있어요.</p>';
    MIND_SYMS.now.forEach(function (s) { var w = mWinRate(H[s]); if (w) h += mRow(mName(s), Math.round(w.p * 100) + "%", w.from + "년~ · 최악 " + mP(w.worst, 0), "var(--accent)"); });
    h += '<p class="mindFoot">= 아무 날에 사서 1년 들고 있었을 때 플러스였던 비율. 타이밍보다 "얼마나 오래 들고 있을 수 있나"가 더 중요하다는 뜻이에요.</p>';
  } else if (q === "drop") {
    if (fearMode) h += '<p>-20%에서 파는 건 아주 흔한 반응이에요. 그런데 과거엔 -20%가 생각보다 자주 왔고, 대부분 다시 회복했어요.</p>';
    MIND_SYMS.drop.forEach(function (s) {
      var d = mDrops(H[s]); if (!d) return;
      var w = d.worst, rec = w.rec != null ? "고점 회복까지 " + mDays(w.total) : "아직 고점 회복 전";
      h += mRow(mName(s), mP(w.dd, 0), d.from + "년~ -20% 넘는 하락 " + d.cnt + "번 · 가장 깊었을 때 " + rec, dn);
    });
    h += '<p class="mindFoot">가장 크게 떨어졌을 때의 낙폭이에요. 지수는 결국 회복했지만, 개별 종목·코인은 회복 기간이 훨씬 길거나 회복하지 못한 경우도 있어요.</p>';
  } else if (q === "monthly") {
    var yrs = [10, 7, 5].filter(function (y) { return MIND_SYMS.monthly.slice(0, 3).filter(function (s) { return mDca(s, y); }).length >= 2; })[0] || 3;
    h += '<p>적금처럼 <b>매달 10만원씩 ' + yrs + '년</b> 샀다면 (원화 기준, 배당 재투자)</p>';
    MIND_SYMS.monthly.slice(0, 3).forEach(function (s) { var r = mDca(s, yrs); if (r) h += mRow(mName(s), mMan(r.val), "넣은 돈 " + mMan(r.principal) + " · " + (r.val / r.principal).toFixed(1) + "배", r.val >= r.principal ? up : dn); });
    h += mRow("예금 (연 3% 가정)", mMan(mDepositDca(yrs)), "넣은 돈 " + mMan(yrs * 12 * 100000), "var(--sub)");
    h += '<p class="mindFoot">지난 결과예요. 같은 자산이라도 시작 시점에 따라 결과가 크게 달라져요.</p>';
  } else if (q === "cash") {
    var ly = [10, 7, 5, 3].filter(function (y) { return ["SPY", "^KS11", "GLD"].filter(function (s) { return mLump(s, y, 1); }).length >= 2; })[0] || 3;
    h += '<p><b>' + ly + '년 전 1,000만원</b>을 어디에 뒀느냐에 따라 (원화 기준)</p>';
    h += mRow("현금 (통장에 그대로)", "1,000만원", "숫자는 그대로, 물가가 오른 만큼 살 수 있는 건 줄어요", "var(--sub)");
    MIND_SYMS.cash.filter(function (s) { return s !== "KRW=X"; }).forEach(function (s) { var v = mLump(s, ly, 1e7); if (v) h += mRow(mName(s), mMan(v), mP(v / 1e7 - 1, 0), v >= 1e7 ? up : dn); });
    h += '<p class="mindFoot">코스피는 지수 값(배당 제외), S&P500·금은 ETF(배당 재투자)·환율 포함 기준이에요.</p>';
  } else if (q === "diff") {
    h += '<p>최근 10년, 연평균 수익률과 그 사이 가장 크게 떨어진 폭 (달러 기준, 배당 재투자)</p>';
    var desc = { SPY: "미국 대표 500개 기업 — 시장 전체", QQQ: "나스닥 100 — 기술·성장주 중심", SCHD: "배당을 꾸준히 늘려 온 기업" };
    MIND_SYMS.diff.forEach(function (s) { var r = mCagr(s, 10); if (r) h += mRow(mName(s), "연 " + mP(r.cagr, 1), desc[s] + " · 최대 " + mP(r.mdd, 0), up); });
    h += '<p class="mindFoot">더 많이 오른 건 더 크게 흔들리기도 했어요. 수익률과 낙폭을 같이 보세요. <button class="linkBtn" id="mindGoCompare">직접 비교해 보기 ›</button></p>';
  } else if (q === "others") {
    h += '<div id="mindPop"><div class="briefDim">불러오는 중…</div></div>';
    fetch("/api/snap?popular=1").then(function (r) { return r.json(); }).then(function (j) {
      var it = (j && j.items || []).slice(0, 7);
      $("mindPop").innerHTML = it.length ? '<p>이 앱에서 최근 2주간 많이 조회되고 관심 담긴 종목이에요.</p>' + it.map(function (x, i) { return mRow((i + 1) + ". " + mName(x.s), "", "", ""); }).join("") +
        '<p class="mindFoot">남들이 많이 본다는 건 "관심"이지 "정답"은 아니에요. 화제가 된 종목은 이미 오른 뒤인 경우가 많았어요.</p>'
        : '<p>아직 집계가 적어요. 조금 더 모이면 보여드릴게요.</p>';
    }).catch(function () { $("mindPop").innerHTML = '<p>지금은 불러올 수 없어요.</p>'; });
    if (typeof isOwner === "function" && isOwner()) h += '<p><button class="linkBtn" id="mindGoBrief">오늘의 인기 종목·거래대금 순위 보기 ›</button></p>';
  } else if (q === "why") {
    h += '<p>주가가 움직인 이유는 크게 두 가지예요.</p><ul class="mindList"><li><b>시장 전체가 움직였는지</b> — 대부분 종목이 같이 내렸다면 금리·환율·전쟁 같은 큰 이유예요. 내 종목 탓이 아니에요.</li>' +
      '<li><b>그 종목만 움직였는지</b> — 실적, 계약, 소송처럼 회사만의 뉴스가 있었을 가능성이 커요.</li></ul>' +
      '<p>같은 날 다른 종목들도 같이 움직였는지, 그 종목 기사 제목에 실적·계약 같은 단어가 있는지 보면 어느 쪽인지 대부분 보여요. ' + (typeof isOwner === "function" && isOwner() ? '<button class="linkBtn" id="mindGoBrief">오늘의 브리핑 보기 ›</button>' : '') + '</p>';
  } else if (q === "tax") {
    h += '<ul class="mindList"><li><b>해외주식</b> — 1년 동안 번 돈(손익 합산)에서 250만원을 뺀 나머지에 약 22% 양도소득세. 다음 해 5월에 직접 신고해요.</li>' +
      '<li><b>국내주식</b> — 대주주가 아니면 사고팔아 번 돈엔 세금이 없지만, 팔 때마다 거래세가 조금 붙어요.</li>' +
      '<li><b>배당</b> — 받을 때 약 15.4%(국내)·15%(미국) 세금이 미리 떼여요.</li>' +
      '<li><b>ISA 계좌</b> — 일정 금액까지 수익에 세금을 안 내거나 덜 내요. 처음 시작한다면 먼저 알아볼 만해요.</li></ul>' +
      '<p class="mindFoot">세법은 자주 바뀌어요. 큰 금액이라면 증권사 안내나 국세청에서 최신 기준을 꼭 확인하세요.</p>';
  }
  el.innerHTML = h || '<div class="briefDim">데이터를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>';
  if ($("mindGoCompare")) $("mindGoCompare").onclick = function () { navTo("compare"); };
  Array.prototype.forEach.call(el.querySelectorAll("#mindGoBrief"), function (b) { b.onclick = function () { navTo("brief"); }; });
}
function mDays(d) { return d >= 365 ? (d / 365).toFixed(1).replace(/\.0$/, "") + "년" : d + "일"; }
function mDepositDca(years) { var v = 0, r = 0.03 / 12; for (var m = 0; m < years * 12; m++) v = (v + 100000) * (1 + r); return v; }

