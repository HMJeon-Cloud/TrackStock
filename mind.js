/* ============================================================
   '투자 마음' 탭 (v7.1) — 나는 왜 사고, 어떻게 고를까
   지금까지의 탭이 "데이터 → 정보"였다면, 이 탭은 "사람의 마음 → 공감 → 데이터로 답"이다.
     1) 질문 5개: 동기 · 말하는 기준 · 실제로 고른 방식 · -20%일 때 행동 · 가장 궁금한 것
     2) 결과: 투자 유형 + 공감 문장 / 말한 기준 vs 실제 방식의 차이 / 다른 사람들의 답 / 내 질문에 대한 데이터 답 / 나만의 규칙 3개
     3) 결과 카드(블랙 & 골드) 저장·공유
   조사 근거: 자본시장연구원(유튜브 종목 언급 1,128건), FINRA 재단(2026 SNS 투자자 조사), 트렌드모니터(2023), 서울신문(2026.9)
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
  { id: "s", title: "종목을 고를 때 가장 중요하다고 생각하는 건?", sub: "'이래야 한다'고 생각하는 기준", opts: [
    ["good", "🏢", "좋은 회사 (실적·1등)", ""],
    ["cheap", "🏷️", "싼 가격 (저평가)", ""],
    ["growth", "📈", "앞으로의 성장성", ""],
    ["safe", "🛡️", "안정성·배당", ""],
    ["spread", "🧺", "여러 개로 나눠 담기", ""]
  ] },
  { id: "b", title: "가장 최근에 산 종목, 실제로는 어떻게 골랐나요?", sub: "솔직하게! 결과는 나만 봐요", opts: [
    ["news", "📺", "뉴스·유튜브에 자주 나와서", ""],
    ["rise", "🔥", "최근에 많이 올라서", ""],
    ["friend", "💬", "지인·커뮤니티에서 추천해서", ""],
    ["dip", "📉", "많이 떨어져서 싸 보여서", ""],
    ["leader", "🥇", "원래 알던 1등 기업·지수라서", ""],
    ["study", "🔍", "직접 비교하고 숫자를 따져서", ""],
    ["none", "🌱", "아직 사 본 적 없어요", ""]
  ] },
  { id: "f", title: "산 종목이 한 달 만에 -20%가 되면?", sub: "상상만 해도 괜찮아요", opts: [
    ["buy", "🛒", "더 산다 — 싸게 살 기회", ""],
    ["hold", "🧘", "그냥 둔다 — 언젠가 오르겠지", ""],
    ["sell", "✂️", "판다 — 더 잃기 전에", ""],
    ["panic", "😵", "잠이 안 온다… 아마 팔 것 같다", ""]
  ] },
  { id: "q", title: "지금 가장 궁금한 건?", sub: "하나만 고르면 데이터로 답해 볼게요", opts: [
    ["now", "🤔", "지금 사도 돼요?", ""],
    ["drop", "🕳️", "얼마나 떨어질 수 있어요? 언제 회복돼요?", ""],
    ["monthly", "🗓️", "매달 얼마씩 넣으면 몇 년 뒤 얼마예요?", ""],
    ["others", "👀", "남들은 뭐 사요?", ""],
    ["why", "❓", "왜 오르고 왜 떨어진 거예요?", ""],
    ["diff", "⚖️", "S&P500·나스닥·배당주, 뭐가 달라요?", ""],
    ["tax", "🧾", "세금·수수료는 얼마나 나가요?", ""]
  ] }
];
var MIND_LABEL = {};
MIND_Q.forEach(function (q) { q.opts.forEach(function (o) { MIND_LABEL[q.id + ":" + o[0]] = o[2]; }); });

/* ---------- 유형 ---------- */
var MIND_TYPES = {
  shield: { emoji: "🛡️", name: "인플레 방패형", line: "가만히 있으면 손해라는 걸 아는 사람",
    empathy: "월급은 그대로인데 물가와 집값은 오르죠. 통장에 그대로 둔 돈이 사실상 줄어드는 걸 느껴서 시작했을 거예요. 공격보다 '지키는 투자'에 가까워요.",
    strength: "욕심보다 원칙이 먼저라 크게 망가질 일이 적어요.",
    trap: "너무 안전한 것만 찾으면 물가조차 못 이기는 곳에 오래 머물 수 있어요. 반대로 '코인 = 물가 방어'라는 말은 아직 데이터로 증명되지 않았어요. 물가가 치솟던 2022년, 비트코인은 크게 빠졌어요.",
    rules: ["목표는 '대박'이 아니라 '물가 + α'", "주식·채권·금처럼 서로 다르게 움직이는 자산 섞기", "비중 점검은 1년에 한두 번만"] },
  climber: { emoji: "⛰️", name: "우상향 적립형", line: "시간을 내 편으로 만드는 사람",
    empathy: "한 번에 크게 벌기보다, 꾸준히 모아서 언젠가 목표에 닿고 싶은 마음이에요. 월급날 자동이체처럼 투자하는 쪽이 마음 편하죠.",
    strength: "타이밍을 맞히려 하지 않아서, 고점에 몰아 살 위험이 작아요.",
    trap: "가장 큰 손해는 떨어질 때 '적립을 멈추는 것'이에요. 싸게 살 기회가 사라지거든요. 그리고 '무엇을' 적립하느냐가 결과를 크게 바꿔요.",
    rules: ["적립일·금액을 정해서 자동으로", "하락장에도 멈추지 않기 — 멈출 조건은 미리 정해두기", "오래 버틸 1등·지수 위주로"] },
  surfer: { emoji: "🏄", name: "흐름 타는 서퍼형", line: "기회를 놓치기 싫은 사람",
    empathy: "다들 벌었다는 얘기를 들으면 마음이 급해지죠. 뉴스·유튜브·커뮤니티에 자주 보이는 종목이 눈에 들어오는 건 아주 자연스러운 일이에요. 당신만 그런 게 아니에요.",
    strength: "시장에 관심이 많고, 움직임에 빨리 반응해요.",
    trap: "자본시장연구원이 유튜브 종목 언급 1,128건을 분석했더니, 언급된 종목은 언급 '전에' 이미 거래량이 2.25배로 늘고 가격도 먼저 올라 있었어요. 화제가 된 걸 보고 사면 대개 늦게 타는 거예요.",
    rules: ["사기 전에 '최근 한 달 이미 얼마나 올랐나' 확인", "화제 종목은 전체의 일부(예: 10%)만", "산 이유를 한 줄로 적고, 그 이유가 사라지면 정리"] },
  believer: { emoji: "🔭", name: "미래 베팅형", line: "보이는 미래에 걸고 싶은 사람",
    empathy: "AI, 반도체, 전기차처럼 세상이 바뀌는 게 보이면 그 흐름에 올라타고 싶죠. 숫자보다 이야기에 끌리는 건 투자의 출발점으로 나쁘지 않아요.",
    strength: "길게 보는 힘이 있어요. 좋은 기업을 오래 들고 간 사람이 큰 수익을 내곤 해요.",
    trap: "좋은 미래와 좋은 주가는 다를 수 있어요. 기대가 이미 가격에 다 들어가 있으면 좋은 뉴스에도 떨어져요. 2000년 닷컴 때 '인터넷이 세상을 바꾼다'는 맞았지만, 나스닥이 그 고점을 되찾는 데 15년이 걸렸어요.",
    rules: ["한 테마 안에서도 1등 위주로, 여러 종목 나눠서", "'얼마나 떨어져도 버틸지' 숫자로 정해두기", "이야기가 바뀌었는지 분기마다 확인"] },
  hunter: { emoji: "🛒", name: "바겐 헌터형", line: "싸게 사고 싶은 사람",
    empathy: "많이 떨어진 종목을 보면 '지금이 기회 아닐까' 싶죠. 비싸게 사기 싫은 건 좋은 본능이에요.",
    strength: "남들이 무서워할 때 살 용기가 있어요.",
    trap: "싸진 데엔 이유가 있을 때가 많아요. 떨어진 채 영영 돌아오지 못한 종목도 많은데, 우리는 회복한 종목만 기억해요(생존자 편향). 지수는 지금까지 큰 하락을 결국 회복했지만, 개별 종목은 그렇지 않은 경우가 많아요.",
    rules: ["왜 떨어졌는지 먼저 — 시장 전체 탓인지, 그 회사만의 문제인지", "한 번에 다 사지 말고 3~4번 나눠서", "개별주보다 지수·1등에서 먼저 연습"] },
  player: { emoji: "🎲", name: "재미 탐험가형", line: "투자 자체가 즐거운 사람",
    empathy: "차트를 보고 사람들과 종목 얘기하는 게 재밌죠. 미국 조사에서도 SNS로 투자 정보를 보는 사람의 59%가 '재미'를, 59%가 '사람들과의 연결'을 투자 이유로 꼽았어요.",
    strength: "공부를 즐기니 시간이 갈수록 실력이 늘 수 있어요.",
    trap: "같은 조사에서 이들은 '나는 잘 안다'고 답한 비율은 높았지만(63%), 실제 지식 점수는 오히려 낮았어요(42%). 재미와 노후 자금은 다른 주머니에 담는 게 안전해요.",
    rules: ["'재미 계좌'와 '노후 계좌'를 나누기", "재미 계좌엔 잃어도 괜찮은 금액만", "수익보다 매매 횟수 줄이기가 먼저"] }
};
function mindType(a) {
  var sc = { shield: 0, climber: 0, surfer: 0, believer: 0, hunter: 0, player: 0 };
  (a.m || []).forEach(function (m, i) {
    var w = i === 0 ? 3 : 2;
    if (m === "cash") sc.shield += w; if (m === "retire") { sc.climber += w; sc.shield += 1; } if (m === "rich") { sc.climber += w - 1; sc.surfer += 1; }
    if (m === "fomo") sc.surfer += w; if (m === "fun") sc.player += w; if (m === "belief") sc.believer += w;
  });
  ({ good: function () { sc.climber++; }, cheap: function () { sc.hunter += 2; }, growth: function () { sc.believer += 2; }, safe: function () { sc.shield += 2; }, spread: function () { sc.climber++; sc.shield++; } }[a.s] || function () {})();
  ({ news: function () { sc.surfer += 2; }, rise: function () { sc.surfer += 2; }, friend: function () { sc.surfer++; sc.player++; }, dip: function () { sc.hunter += 2; }, leader: function () { sc.climber += 2; }, study: function () { sc.climber++; sc.believer++; } }[a.b] || function () {})();
  ({ buy: function () { sc.climber++; sc.hunter++; }, hold: function () { sc.shield++; sc.believer++; }, sell: function () { sc.surfer++; }, panic: function () { sc.surfer++; sc.player++; } }[a.f] || function () {})();
  if (a.q === "monthly") sc.climber++; if (a.q === "others" || a.q === "now") sc.surfer++; if (a.q === "drop") sc.hunter++;
  var order = ["climber", "shield", "surfer", "believer", "hunter", "player"];
  return order.slice().sort(function (x, y) { return sc[y] - sc[x] || order.indexOf(x) - order.indexOf(y); })[0];
}
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
try { var _ms = JSON.parse(localStorage.getItem("sm.mind") || "null"); if (_ms && _ms.a && _ms.a.q) { mindState.a = _ms.a; mindState.step = MIND_Q.length; } } catch (e) {}

function renderMind() {
  var box = $("mindBody"); if (!box) return;
  if (mindState.step >= MIND_Q.length) return renderMindResult();
  var q = MIND_Q[mindState.step], cur = mindState.a[q.id];
  var sel = q.multi ? (cur || []) : (cur ? [cur] : []);
  box.innerHTML =
    '<div class="mindProg"><div style="width:' + Math.round(mindState.step / MIND_Q.length * 100) + '%"></div></div>' +
    '<div class="mindStep">' + (mindState.step + 1) + ' / ' + MIND_Q.length + '</div>' +
    '<h3 class="mindQ">' + q.title + '</h3><div class="mindSub">' + q.sub + '</div>' +
    '<div class="mindOpts">' + q.opts.map(function (o) {
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
  var a = mindState.a;
  fetch("/api/poll?m=" + encodeURIComponent((a.m || []).join(",")) + "&s=" + a.s + "&b=" + a.b + "&f=" + a.f + "&q=" + a.q).catch(function () {});
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

/* ---------- 결과 ---------- */
var MIND_SYMS = { now: ["SPY", "005930.KS", "BTC-USD"], drop: ["SPY", "005930.KS", "BTC-USD"], monthly: ["SPY", "005930.KS", "BTC-USD", "KRW=X"],
  diff: ["SPY", "QQQ", "SCHD"], cash: ["SPY", "^KS11", "GLD", "KRW=X"] };
function renderMindResult() {
  var box = $("mindBody"), a = mindState.a, key = mindType(a), T = MIND_TYPES[key];
  mindState.result = key;
  var fit = (MIND_FIT[a.s] || []).indexOf(a.b) >= 0;
  var h = '';
  /* ① 유형 */
  h += '<div class="mindHero"><div class="mindHeroEmo">' + T.emoji + '</div><div><small>나의 투자 유형</small><h2>' + T.name + '</h2><p>' + T.line + '</p></div></div>';
  h += '<div class="mindBox"><div class="mindBoxT">💛 이런 마음이었죠</div><p>' + T.empathy + '</p>' +
    '<div class="mindTwo"><div><b>강점</b><p>' + T.strength + '</p></div><div><b>조심할 함정</b><p>' + T.trap + '</p></div></div></div>';
  /* ② 말하는 기준 vs 실제 */
  h += '<div class="mindBox"><div class="mindBoxT">🪞 말하는 기준 vs 실제로 고른 방식</div>' +
    '<div class="mindVs"><div><small>중요하다고 한 것</small><b>' + MIND_LABEL["s:" + a.s] + '</b></div><div class="mindVsArrow">' + (fit ? "=" : "≠") + '</div><div><small>실제로 고른 방식</small><b>' + MIND_LABEL["b:" + a.b] + '</b></div></div>' +
    '<p>' + (a.b === "none" ? MIND_B_FACT.none : fit ? "말하는 기준과 실제로 고르는 방식이 같아요. 이게 생각보다 드문 일이에요. 지금처럼 '산 이유'를 숫자로 남겨두면 흔들릴 때 큰 힘이 돼요." :
      "대부분의 사람이 이 차이를 갖고 있어요. 머리로 아는 기준과 손이 누르는 버튼이 달라요. " + (MIND_B_FACT[a.b] || "")) + '</p></div>';
  /* ③ 다른 사람들 */
  h += '<div class="mindBox"><div class="mindBoxT">👥 다른 사람들은 어떻게 답했을까</div><div id="mindPoll"><div class="briefDim">불러오는 중…</div></div></div>';
  /* ④ 내 질문에 대한 데이터 답 */
  h += '<div class="mindBox"><div class="mindBoxT">🔢 "' + MIND_LABEL["q:" + a.q] + '"에 데이터로 답하면</div><div id="mindAns"><div class="briefDim">과거 데이터를 계산하는 중…</div></div></div>';
  if ((a.m || []).indexOf("cash") >= 0 && a.q !== "cash")
    h += '<div class="mindBox"><div class="mindBoxT">💸 "가만히 있으면 손해" — 정말일까?</div><div id="mindCash"><div class="briefDim">계산 중…</div></div></div>';
  if ((a.f === "sell" || a.f === "panic") && a.q !== "drop")
    h += '<div class="mindBox"><div class="mindBoxT">😵 -20%에서 판다면 — 과거엔 어땠을까</div><div id="mindFear"><div class="briefDim">계산 중…</div></div></div>';
  /* ⑤ 규칙 */
  h += '<div class="mindBox mindRules"><div class="mindBoxT">📌 ' + T.name + '을 위한 나만의 규칙 3개</div><ol>' + T.rules.map(function (r) { return '<li>' + r + '</li>'; }).join("") + '</ol></div>';
  h += '<div class="row mindNav"><button class="chip" id="mindRetry">↺ 다시 하기</button><button class="primary" id="mindCardBtn">🃏 결과 카드 만들기</button></div>' +
    '<div class="briefDim" style="margin-top:8px">근거: 자본시장연구원 「유튜브 주식채널의 정보효과와 위험요인」, FINRA 재단 SNS 투자자 조사(2026), 트렌드모니터 주식투자 조사(2023). 과거 데이터이며 투자 조언이 아니에요.</div>';
  box.innerHTML = h;
  $("mindRetry").onclick = function () { mindState.a = {}; mindState.step = 0; try { localStorage.removeItem("sm.mind"); } catch (e) {} renderMind(); };
  $("mindCardBtn").onclick = mindCardOpen;
  mindLoadPoll();
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
        : '<p>아직 집계가 적어요. 오늘 탭의 "돈이 몰리는 곳"에서 거래대금 순위를 볼 수 있어요.</p>';
    }).catch(function () { $("mindPop").innerHTML = '<p>지금은 불러올 수 없어요.</p>'; });
    h += '<p><button class="linkBtn" id="mindGoBrief">오늘의 인기 종목·거래대금 순위 보기 ›</button></p>';
  } else if (q === "why") {
    h += '<p>주가가 움직인 이유는 크게 두 가지예요.</p><ul class="mindList"><li><b>시장 전체가 움직였는지</b> — 대부분 종목이 같이 내렸다면 금리·환율·전쟁 같은 큰 이유예요. 내 종목 탓이 아니에요.</li>' +
      '<li><b>그 종목만 움직였는지</b> — 실적, 계약, 소송처럼 회사만의 뉴스가 있었을 가능성이 커요.</li></ul>' +
      '<p>오늘 탭에서 "오른 종목 비율"과 급등·급락 종목의 기사 제목을 같이 보면 어느 쪽인지 바로 보여요. <button class="linkBtn" id="mindGoBrief">오늘의 브리핑 보기 ›</button></p>';
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

/* 다른 사람들의 응답 (응답 30명 미만이면 조사 자료로 대신) */
function mindLoadPoll() {
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
    function bars(prefix, title, mine) {
      var q = MIND_Q.filter(function (x) { return x.id === prefix; })[0];
      var rows = q.opts.map(function (o) { return { k: o[0], l: o[2], v: c[prefix + ":" + o[0]] || 0 }; }).sort(function (x, y) { return y.v - x.v; });
      var tot = prefix === "m" ? n : rows.reduce(function (s, r) { return s + r.v; }, 0) || 1;
      return '<div class="mindBarsT">' + title + '</div>' + rows.map(function (r) {
        var p = Math.round(r.v / tot * 100), me = mine.indexOf(r.k) >= 0;
        return '<div class="mindBar' + (me ? ' me' : '') + '"><span>' + r.l + (me ? ' <em>나</em>' : '') + '</span><div><i style="width:' + p + '%"></i></div><b>' + p + '%</b></div>';
      }).join("");
    }
    el.innerHTML = '<p>지금까지 <b>' + n.toLocaleString() + '명</b>이 답했어요.</p>' +
      bars("m", "투자하는 이유 (최대 2개)", a.m || []) + bars("b", "실제로 고른 방식", [a.b]) + bars("f", "-20%가 되면", [a.f]);
  }).catch(function () { el.innerHTML = '<div class="briefDim">지금은 불러올 수 없어요.</div>'; });
}

/* ---------- 결과 카드 (cards.js의 블랙 & 골드 도구 재사용) ---------- */
function mindCardOpen() {
  if (typeof cNew !== "function") return;
  var a = mindState.a, T = MIND_TYPES[mindState.result || mindType(a)];
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  function draw() {
    var c = cNew(), g = c.g, P = CARD.PAD, W = CARD.W - P * 2;
    cHero(c, "INVESTOR TYPE · 나의 투자 유형", "나는 " + T.emoji, T.name, CARD_C.gold, T.line, 0, 0);
    c.y += 10;
    cLabel(c, "투자하는 이유", CARD_C.gold);
    cText(g, cFit(g, (a.m || []).map(function (m) { return MIND_LABEL["m:" + m]; }).join(" · "), W, 30, 600), P, c.y + 36, 30, 600, CARD_C.txt); c.y += 80;
    cLabel(c, "말하는 기준 vs 실제로 고른 방식", CARD_C.gold);
    var fit = (MIND_FIT[a.s] || []).indexOf(a.b) >= 0;
    cText(g, cFit(g, MIND_LABEL["s:" + a.s] + "  " + (fit ? "=" : "≠") + "  " + MIND_LABEL["b:" + a.b], W, 30, 600), P, c.y + 36, 30, 600, CARD_C.txt); c.y += 76;
    cRound(g, P - 6, c.y, W + 12, 2, 1, CARD_C.line); c.y += 20;
    cLabel(c, "나만의 규칙", CARD_C.gold);
    T.rules.forEach(function (r, i) {
      cText(g, String(i + 1), P + 14, c.y + 40, 30, 800, CARD_C.gold, "center");
      cWrap(g, r, P + 50, c.y + 40, W - 50, 31, 600, CARD_C.txt, 42, 2); c.y += 66;
    });
    cNote(c, "당신은 어떤 유형인가요? 댓글로 알려주세요");
    cFoot(c, "우상향연구소 투자 마음 테스트");
    return c.cv;
  }
  ready.then(function () {
    CARD_TXT = ""; draw();
    if (!document.fonts || !document.fonts.load) return;
    var txt = CARD_TXT.replace(/\s+/g, "");
    return Promise.all([500, 600, 700, 800].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); }));
  }).then(function () {
    var cv = draw(), url = cv.toDataURL("image/png"), file = "uphill.lab_투자유형_" + T.name + ".png";
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
