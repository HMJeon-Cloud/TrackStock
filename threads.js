/* ============================================================
   업로드 글 (v9.4) — 카드를 만들면 인스타 캡션 + 스레드 글이 같이 나온다.
   형식(두 곳 공통): 첫 줄 훅 → 한눈에 요약(숫자 3~5줄) → 인사이트(숫자가 말하는 것 2~3문장) → 카드 안내 → (인스타만) 질문·해시태그
   원칙: 아이콘(이모지) 없음 · 추천·예측·과장 금지(PUB_BANNED) · 숫자는 그날 종가 계산값 그대로 · 스레드 500자 / 인스타 2,200자 이내
   uphill.lab 실험 결과(2026-09~10): 초보자가 이미 하는 질문으로 시작 + 숫자 5줄 이하가 가장 반응이 좋았다 → 훅 5종은 그 공식의 변형
   ============================================================ */
var THR_TOPIC = { all: "주식", kr: "주식", us: "주식", coin: "코인", policy: "재테크", dca: "재테크" };
var THR_TAGS = { all: ["우상향연구소", "주식초보", "재테크", "주식시황", "투자공부"], kr: ["우상향연구소", "국내주식", "코스피", "주식시황", "주식초보"], us: ["우상향연구소", "미국주식", "미국증시", "나스닥", "주식초보"], coin: ["우상향연구소", "비트코인", "코인", "가상자산", "코인시황"], policy: ["우상향연구소", "재테크", "내집마련", "대출금리"] };
function thrPct(x, d) { return cPct(x, d == null ? 2 : d); }
function thrSeed() { return Math.floor((Date.now() + 9 * 3600e3) / 86400e3); }
function thrClean(s) { return thrNoEmoji(String(s).replace(/\s*[—-]\s*평소.*$/, "")).replace(/\s+/g, " ").trim(); }
function thrNoEmoji(s) { return String(s).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}₿]/gu, "").replace(/^\s+/gm, function (m) { return m.replace(/ /g, ""); }).replace(/[ \t]+$/gm, ""); }
function thrPage(names, re) { if (!names) return null; for (var i = 0; i < names.length; i++) if (re.test(names[i])) return i + 1; return null; }

/* 공통 조립: 인스타(≤2200, v9.4 그대로) + 스레드 본문·답글 1·답글 2 (각 ≤500)
   v11.0 스레드 공식: 첫 줄(초보 질문 / 숫자 / 충돌) → 질문 1줄 → 숫자 5줄 이하(방향이 보이게 정렬·소수점 통일) → 해석 1~2줄
   답글 1 = 반대 숫자·한계(신뢰) · 답글 2 = 자기 노출 없이 답할 수 있는 질문 하나 + 앱 안내 한 줄 */
var THR_APP = "프로필 링크에서 직접 검색해볼 수 있습니다.";
function thrCompose(o) {
  var sum = (o.summary || []).filter(Boolean).map(thrNoEmoji), ins = (o.insights || []).filter(Boolean).map(thrNoEmoji), hook = thrNoEmoji(o.hook);
  var foot = o.foot || "종가 기준 자동 집계 · 투자 권유 아님";
  var ig = hook + "\n\n" + (o.sumTitle || "한눈에 요약") + "\n" + sum.join("\n") +
    (ins.length ? "\n\n" + (o.insTitle || "숫자가 말하는 것") + "\n" + ins.slice(0, 3).join("\n") : "") +
    (o.cardList && o.cardList.length ? "\n\n카드 구성\n" + o.cardList.join(" / ") : "") +
    (o.cards ? "\n" + o.cards : "") + (o.question ? "\n\n" + o.question : "") +
    "\n\n※ " + foot + ". 판단과 책임은 각자에게 있어요." + (o.tags && o.tags.length ? "\n\n" + o.tags.map(function (x) { return "#" + x; }).join(" ") : "");
  if (ig.length > 2200) ig = ig.slice(0, 2190) + "…";
  var T = thrThread(o);
  return { th: T.th, r1: T.r1, r2: T.r2, ig: ig };
}
/* 500자 안에서 줄 단위로 자른다 (단어·숫자 중간에서 끊지 않음) */
function thrFit(s, max) {
  s = String(s || "").replace(/\n{3,}/g, "\n\n").trim(); max = max || 500; if (s.length <= max) return s;
  var L = s.split("\n"); while (L.length > 1 && L.join("\n").length > max) L.pop();
  s = L.join("\n").trim(); if (s.length > max) { s = s.slice(0, max - 1); s = s.slice(0, Math.max(s.lastIndexOf(" "), max - 40)) + "…"; }
  return s;
}
/* 숫자 한 줄의 '정렬 기준 값' — 처음 나오는 % 또는 배 */
function thrKey(l) { var m = String(l).replace(/−/g, "-").match(/([+-]?\d[\d,]*(?:\.\d+)?)\s*(%|배)/); return m ? parseFloat(m[1].replace(/,/g, "")) : null; }
/* 숫자 목록: 5줄 이하 · (sort면) 큰 값 → 작은 값 · % 소수점 자리 통일 */
function thrData(lines, sort) {
  var L = (lines || []).filter(Boolean).map(function (l) { return thrNoEmoji(l).replace(/^[·•\-]\s*/, "").trim(); }).filter(Boolean);
  if (sort && L.length > 1 && L.every(function (l) { return thrKey(l) != null; })) L = L.slice().sort(function (a, b) { return thrKey(b) - thrKey(a); });
  L = L.slice(0, 5);
  // 소수점 통일: 부호 붙은 수익률(+1.4% / -3%)만, 자리수를 늘리기만 한다 (반올림으로 값이 바뀌지 않게 — 금리 2.85% 등은 그대로)
  var dec = 0; L.forEach(function (l) { (l.match(/[+-]\d+\.\d+%/g) || []).forEach(function (x) { dec = Math.max(dec, x.split(".")[1].length - 1); }); });
  if (dec) L = L.map(function (l) { return l.replace(/([+-])(\d+(?:\.\d+)?)%/g, function (m, sg, n) { var d = (n.split(".")[1] || "").length; return d >= dec ? m : sg + parseFloat(n).toFixed(dec) + "%"; }); });
  return L.map(function (l) { return l.replace(/\s{2,}/g, " "); });
}
function thrSent(s, n) { return String(s || "").split(/(?<=[.?!])\s+/).slice(0, n || 2).join(" ").trim(); }
/* 해석이 첫 줄·숫자 목록을 그대로 되풀이하면 그 문장은 뺀다 */
function thrNew(sent, seen) { var nums = String(sent).match(/[+-]?\d+(?:\.\d+)?%/g); return !nums || !nums.every(function (x) { return seen.indexOf(x) >= 0; }); }
function thrThread(o) {
  var hook = thrNoEmoji(o.hook || "").trim(), ask = o.ask ? thrNoEmoji(o.ask).trim() : "";
  var data = thrData(o.data || o.summary || [], o.sort);
  var seen = hook + "\n" + data.join("\n");
  var interp = (o.interp != null ? [].concat(o.interp) : (o.insights || []).slice(0, 2)).filter(Boolean).map(function (x) { return thrNoEmoji(x).split(/(?<=[.?!])\s+/).filter(function (z) { return thrNew(z, seen); }).slice(0, 2).join(" ").trim(); }).filter(Boolean).slice(0, 1);
  var foot = "(" + (o.thFoot || "종가 기준 · 투자 권유 아님") + ")";
  function build(nD, nI) { return [hook + (ask ? "\n" + ask : ""), data.slice(0, nD).join("\n"), interp.slice(0, nI).join("\n"), foot].filter(Boolean).join("\n\n"); }
  var nD = data.length, nI = Math.min(2, interp.length), t = build(nD, nI);
  while (t.length > 500 && nI > 1) { nI--; t = build(nD, nI); }
  while (t.length > 500 && nD > 3) { nD--; t = build(nD, nI); }
  if (t.length > 500 && nI) t = build(nD, 0);
  // 답글 1: 본문에 이미 나온 숫자 줄은 빼고, 숫자 줄이 하나도 안 남으면 제목 줄도 뺀다
  var lim = (o.limit || []).filter(function (x) { return x != null; }).map(thrNoEmoji), th0 = t;
  lim = lim.filter(function (l, i) { if (i === 0 || !/[+-]\d/.test(l)) return true; var m = l.match(/(\S+ [+-]\d+(?:\.\d+)?%)$/); return !(m && th0.indexOf(m[1]) >= 0); });
  if (lim.length > 1 && /^반대쪽/.test(lim[0]) && !lim.slice(1).some(function (l) { return /\d/.test(l) && !/^(하루|한 )/.test(l); })) lim[0] = "한계도 적어둘게요.";
  var r1 = lim.join("\n").replace(/^(.*)\n\n/, "$1\n");
  if (/^한계도/.test(r1)) r1 = r1.replace(/^한계도 적어둘게요\.\n\n?/, "한계도 적어둘게요.\n");
  var q = thrNoEmoji(o.reply || "이 숫자 중에 제일 의외였던 건 뭐였나요?").trim();
  var r2 = q + (o.app === false ? "" : "\n\n" + THR_APP);
  return { th: thrFit(t), r1: thrFit(r1), r2: thrFit(r2) };
}
/* 답글 2 질문 — 계좌·동네·나이 같은 자기 노출 없이 답할 수 있는 것만 */
var THR_ASK = ["이 순위에서 제일 의외인 곳은요?", "여러분은 적립식인가요, 한 번에 사시나요?", "지수랑 오른 종목 비율, 어느 쪽을 먼저 보시나요?", "떨어진 날엔 앱을 더 보시나요, 덜 보시나요?", "이 중에 처음 들어본 이름도 있었나요?"];
function thrAsk(i) { return THR_ASK[(thrSeed() + (i || 0)) % THR_ASK.length]; }
function thrSafe(v) { return v.filter(function (x) { return x && x.th && !(typeof PUB_BANNED !== "undefined" && [x.th, x.ig, x.r1, x.r2].some(function (t) { return t && PUB_BANNED.test(t); })); }); }

/* 인사이트: 그날 숫자에서 '읽을거리'를 골라 2~3문장 (해석이지 예측이 아님) */
function thrInsights(R, iss, unit) {
  var t = R.temp, i0 = (R.indexRow || [])[0], th = R.themes || [], out = [];
  var up = Math.round(t.upPct * 100), a20 = Math.round(t.abovePct * 100);
  if (i0 && i0.ret > 0.003 && t.upPct < 0.45) out.push({ s: 4, t: i0.name + "는 " + thrPct(i0.ret) + "였지만 오른 " + unit + "은 " + up + "%에 그쳤어요. 몇몇 큰 " + unit + "이 지수를 끌어올린 날이라, 내 " + unit + "이 빠졌다면 시장 전체 탓은 아닐 수 있어요." });
  else if (i0 && i0.ret < -0.003 && t.upPct > 0.55) out.push({ s: 4, t: i0.name + "는 " + thrPct(i0.ret) + "였지만 오른 " + unit + "이 " + up + "%로 더 많았어요. 지수를 끌어내린 건 일부 대형 " + unit + "이었어요." });
  else if (t.upPct >= 0.65) out.push({ s: 3, t: "열 개 중 " + Math.round(t.upPct * 10) + "개가 오른, 넓게 오른 날이에요. 하루 숫자보다 20일선 위 비율(" + a20 + "%)이 추세를 더 잘 보여줘요." });
  else if (t.upPct <= 0.35) out.push({ s: 3, t: "열 개 중 " + Math.round((1 - t.upPct) * 10) + "개가 내린 날이에요. 이런 날은 개별 악재보다 시장 전체 분위기일 가능성이 커요." });
  if (t.n200 && t.above200Pct != null) {
    var l = Math.round(t.above200Pct * 100);
    if (t.abovePct < 0.4 && t.above200Pct >= 0.5) out.push({ s: 3.5, t: "단기 추세(20일선 위 " + a20 + "%)는 눌렸지만 장기 추세(200일선 위 " + l + "%)는 아직 절반 이상이에요. 긴 흐름이 꺾인 건 아니라는 뜻이에요." });
    else if (t.abovePct >= 0.5 && t.above200Pct < 0.4) out.push({ s: 3.5, t: "단기 반등(20일선 위 " + a20 + "%)은 넓지만 장기 추세(200일선 위 " + l + "%)는 아직 아래예요. 반등과 회복은 다른 이야기예요." });
  }
  if (th.length >= 4) { var gap = th[0].ret - th[th.length - 1].ret; if (Math.abs(gap) >= 0.02) out.push({ s: 2 + Math.min(2, gap * 40), t: "1등 " + th[0].name + "(" + thrPct(th[0].ret) + ")와 꼴찌 " + th[th.length - 1].name + "(" + thrPct(th[th.length - 1].ret) + ")의 차이가 " + (gap * 100).toFixed(1) + "%p — 같은 날에도 어디에 있었느냐에 따라 결과가 크게 갈렸어요." }); }
  if (t.n200) { var nh = t.newHigh.length, nl = t.newLow.length; if (nh + nl >= 5) out.push({ s: 2.5, t: "52주 신고가 " + nh + "개, 신저가 " + nl + "개. " + (nh > nl * 1.5 ? "신고가가 넓게 늘어나는 구간은 시장 전체가 강했던 때가 많았어요." : nl > nh * 1.5 ? "신저가가 더 많은 날은 바닥을 찾기보다 위치를 확인하는 게 먼저예요." : "양쪽이 비슷하게 섞여, 종목마다 갈리는 장이에요.") }); }
  var vix = (R.numbers || []).filter(function (n) { return n.sym === "^VIX"; })[0];
  if (vix) { var v = parseFloat(vix.v); if (v >= 25) out.push({ s: 3, t: "공포지수가 " + vix.v + "로 높아요. 과거엔 이런 구간에서 하루 변동이 커졌고, 감정적으로 사고팔기 쉬웠어요." }); else if (v < 14) out.push({ s: 1.5, t: "공포지수 " + vix.v + " — 평온한 구간이에요. 이런 때일수록 비중을 점검해 두는 게 좋아요." }); }
  var hot = (R.hotVol || [])[0]; if (hot && hot.amtX >= 2.5) out.push({ s: 2, t: briefName(hot) + "의 거래대금이 평소의 " + hot.amtX.toFixed(1) + "배였어요. 관심이 몰린 만큼 다음 며칠 변동도 커지기 쉬워요." });
  return out.sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.t; });
}

/* ---------- 전일 정리 (시장별) ---------- */
function thrDaily(R, iss, names, opts) {
  opts = opts || {}; if (!R) return [];
  var mk = R.market || "all", when = opts.when || (R.mode === "week" ? "이번 주" : R.mode === "month" ? "이번 달" : "어제");
  var t = R.temp, ir = R.indexRow || [], i0 = ir[0], i1 = ir[1];
  var th = R.themes || [], tTop = th.length >= 2 ? th[0] : null, tBot = th.length >= 2 ? th[th.length - 1] : null;
  var mUp = R.movers && R.movers.up[0], mDn = R.movers && R.movers.down[0], hot = (R.hotVol || [])[0];
  var nums = R.numbers || [], saleN = nums[0] ? nums[0].v : null;
  var nh = t.newHigh ? t.newHigh.length : 0, nl = t.newLow ? t.newLow.length : 0, has1y = !!t.n200;
  var top = iss && iss[0], zz = top && (top.sub || "").match(/평소[^0-9]*([0-9.]+)배/);
  var mkName = mk === "all" || mk === "coin" ? "" : R.mktName + " ", unit = mk === "coin" ? "코인" : "종목", sec = mk === "coin" ? "테마" : "업종", endTag = when === "어제" ? "" : when + " 끝 기준 ";
  function r1(s) { return s ? (s.ret1 != null && R.mode !== "week" && R.mode !== "month" ? s.ret1 : s.ret) : null; }
  var S = [];
  if (i0) S.push(i0.name + " " + thrPct(i0.ret) + (i1 ? " · " + i1.name + " " + thrPct(i1.ret) : ""));
  S.push("오른 " + unit + " " + Math.round(t.upPct * 100) + "% · 20일선 위 " + Math.round(t.abovePct * 100) + "%");
  if (tTop) S.push("가장 강한 " + sec + " " + tTop.name + " " + thrPct(tTop.ret) + " · 가장 약한 " + sec + " " + tBot.name + " " + thrPct(tBot.ret));
  if (mUp && mDn) S.push("가장 많이 오른 " + unit + " " + briefName(mUp) + " " + thrPct(r1(mUp)) + " · 가장 많이 내린 " + unit + " " + briefName(mDn) + " " + thrPct(r1(mDn)));
  if (has1y && (nh || nl)) S.push(endTag + "52주 신고가 " + nh + "개 · 신저가 " + nl + "개");
  else if (hot) S.push(briefName(hot) + " 거래대금 평소의 " + hot.amtX.toFixed(1) + "배");
  var INS = thrInsights(R, iss, unit);
  var pSale = thrPage(names, /세일/), pMove = thrPage(names, /급등급락/), pTheme = thrPage(names, /테마|전체시세/), pHL = thrPage(names, /신고가/);
  var tz = [];
  if (pSale && saleN) tz.push("고점보다 20% 넘게 싼 " + saleN + " " + unit + " 리스트는 카드 " + pSale + "장째에 있어요.");
  if (pHL && has1y) tz.push("신고가·신저가 " + unit + " 이름은 카드 " + pHL + "장째에 있어요.");
  if (pMove) tz.push("가장 많이 오르고 내린 " + unit + " 14개는 카드 " + pMove + "장째에 있어요.");
  var cardsLine = tz.length ? tz[thrSeed() % tz.length] : "";
  var cardList = (names || []).map(function (n, i) { return (i + 1) + " " + String(n).replace(/^[0-9N]+_?/, "").replace(/\d+$/, "").replace(/([a-z])([A-Z])/g, "$1 $2"); }).slice(0, 12);
  var q = ["여러분 계좌는 " + when + " 어땠나요?", "이 중에 들고 계신 " + unit + " 있나요?", when + " 숫자 중 가장 눈에 띈 건 뭐였나요?", "저장해 두고 다음 정리와 비교해 보세요."][thrSeed() % 4];
  // v11.0 스레드용 숫자 목록 (5줄 이하, 큰 값 → 작은 값, 소수점 1자리 통일)
  var D_SEC = null, D_MOV = null, D_BR = null;
  if (th.length >= 3) { var ix = th.length <= 5 ? th.map(function (x, i) { return i; }) : [0, 1, Math.floor(th.length / 2), th.length - 2, th.length - 1]; D_SEC = ix.map(function (i) { return (i === th.length - 1 ? "꼴찌" : (i + 1) + "위") + " " + th[i].name + " " + thrPct(th[i].ret); }); }
  if (mUp && mDn) { var U = R.movers.up.slice(0, 3), Dn = R.movers.down.slice(0, 2).reverse(); D_MOV = U.concat(Dn).map(function (x) { return briefName(x) + " " + thrPct(r1(x)); }); }
  D_BR = [["오른 " + unit, t.upPct], ["20일선 위 " + unit, t.abovePct]].concat(t.n200 && t.above200Pct != null ? [["200일선 위 " + unit, t.above200Pct]] : []).sort(function (x, y) { return y[1] - x[1]; }).map(function (x) { return x[0] + " " + Math.round(x[1] * 100) + "%"; });
  // 답글 1: 반대 숫자 · 한계
  var neg = i0 && i0.ret < 0, LIM = ["반대쪽 숫자도 같이 적어둘게요."];
  if (neg) { if (mUp) LIM.push("가장 많이 오른 " + unit + " " + briefName(mUp) + " " + thrPct(r1(mUp))); if (tTop) LIM.push("가장 강한 " + sec + " " + tTop.name + " " + thrPct(tTop.ret)); if (has1y) LIM.push("52주 신고가 " + nh + "개"); }
  else { if (mDn) LIM.push("가장 많이 내린 " + unit + " " + briefName(mDn) + " " + thrPct(r1(mDn))); if (tBot) LIM.push("가장 약한 " + sec + " " + tBot.name + " " + thrPct(tBot.ret)); if (has1y) LIM.push("52주 신저가 " + nl + "개"); }
  LIM.push("", (when === "어제" ? "하루" : when.replace("이번 ", "한 ")) + " 숫자 하나로 추세를 말하긴 어렵습니다. 20일·200일 흐름을 같이 봐야 해요.", "종가 기준이라 장중에 크게 흔들린 건 이 숫자에 안 보입니다.");
  var base = { summary: S, insights: INS, cards: cardsLine, cardList: cardList, question: q, tags: THR_TAGS[mk] || THR_TAGS.all, data: D_SEC || D_MOV || S, limit: LIM };
  var out = [], nAdd = 0;
  function add(label, hook, extra) { var c = thrCompose(Object.assign({ reply: thrAsk(nAdd++) }, base, extra || {}, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  // ① 초보 질문형
  var q1;
  if (mk === "coin" && i0) q1 = i0.name + " " + thrPct(i0.ret) + ".\n다른 코인들은 어땠을까요?";
  else if (i0 && i0.ret <= -0.015) q1 = when + " 계좌 보고 놀라셨죠?\n" + i0.name + " " + thrPct(i0.ret) + ", 내 종목만 그런 게 아니었어요.";
  else if (i0 && i0.ret >= 0.015) q1 = i0.name + " " + thrPct(i0.ret) + ".\n나만 못 탄 것 같은 기분, 숫자로 확인해 볼게요.";
  else if (i0 && i0.ret > 0 && t.upPct < 0.45) q1 = "지수는 올랐는데\n왜 내 " + unit + "은 빠졌을까요?";
  else q1 = when + " " + mkName + "시장, 어디가 오르고 어디가 빠졌을까요?";
  add("초보 질문형", q1, mk === "coin" ? { data: D_MOV || S, ask: "많이 오른 순서대로 놓아봤어요." } : { ask: D_SEC ? sec + "별로 줄 세우면 이렇습니다." : "" });
  // ② 반전형 (충돌로 시작)
  var tw;
  if (i0 && i0.ret > 0 && t.upPct < 0.5) tw = i0.name + " " + thrPct(i0.ret) + ".\n그런데 오른 " + unit + "은 " + Math.round(t.upPct * 100) + "%뿐이었어요.";
  else if (i0 && i0.ret < 0 && t.upPct > 0.5) tw = i0.name + " " + thrPct(i0.ret) + ".\n그런데 오른 " + unit + "이 " + Math.round(t.upPct * 100) + "%로 더 많았어요.";
  else if (mUp && tBot) tw = tBot.name + "이 " + thrPct(tBot.ret) + "로 꼴찌였던 날,\n1등은 " + briefName(mUp) + " " + thrPct(r1(mUp)) + "였어요.";
  else if (mUp) tw = "오른 " + unit + " " + Math.round(t.upPct * 100) + "%.\n그중 1등은 " + briefName(mUp) + " " + thrPct(r1(mUp)) + ".";
  if (tw) add("반전형", tw, { ask: "그럼 누가 끌어올리고 누가 끌어내렸을까요?", data: D_MOV || D_SEC || S });
  // ③ 숫자 한 방형
  if (top && zz) add("숫자 한 방형", zz[1] + "배.\n" + when + " " + thrClean(top.title).replace(/\s*\(.*?\)\s*$/, "") + " — 평소 하루 움직임의 " + zz[1] + "배였어요.", { ask: "다른 숫자들은 어땠을까요?", data: D_MOV || D_SEC || S });
  else if (saleN) add("숫자 한 방형", saleN + ".\n52주 고점보다 20% 넘게 싼 " + mkName + unit + " 수예요.", { ask: "시장 전체 체력은 어느 정도일까요?", data: D_BR, interp: INS.filter(function (l) { return /20일선|200일선/.test(l); }).slice(0, 1) });
  // ④ 퀴즈형 (정답이 드러나는 숫자는 본문에서 뺀다)
  var opts3 = null, qz = null;
  if (tTop && th.length >= 4) { opts3 = [tTop.name, th[Math.floor(th.length / 2)].name, tBot.name]; qz = when + " 가장 많이 오른 " + (sec === "업종" ? "업종은?" : "테마는?"); }
  else if (mk === "coin" && mUp) { opts3 = R.movers.up.slice(0, 1).concat(R.movers.down.slice(0, 2)).map(briefName); qz = when + " 가장 많이 오른 코인은?"; }
  if (opts3) {
    var sd = thrSeed(); opts3 = opts3.map(function (x, i) { return { x: x, k: (i * 7 + sd) % 3 }; }).sort(function (a, b) { return a.k - b.k; }).map(function (o) { return o.x; });
    var pq = mk === "coin" ? (pMove || pTheme || 2) : (pTheme || pMove || 2);
    add("퀴즈형", qz + "\n1) " + opts3[0] + "  2) " + opts3[1] + "  3) " + opts3[2], { ask: "힌트로 시장 전체 숫자부터 드릴게요.", data: D_BR, interp: ["정답은 카드 " + pq + "장째에 있어요."], reply: "몇 번이라고 보셨나요? 정답 보기 전에 골라주세요.", summary: S.filter(function (l) { return !/^가장 (강한|많이)/.test(l); }), insights: INS.filter(function (l) { return !/1등 /.test(l); }) });
  }
  // ⑤ 빈칸형
  if (iss && iss.length >= 4) {
    var bl = [iss[0], iss[1]].map(function (it, i) { return (i + 1) + ". " + thrClean(it.title); }).concat(["3. ?", "4. ?", "5. ?"]);
    add("빈칸형", when + " " + mkName + "시장에서 평소와 달랐던 5가지.\n" + (thrSeed() % 2 ? "4번째가 제일 의외였어요." : "3번째는 아무도 얘기 안 했어요."), { summary: bl, data: bl, interp: ["3~5번은 카드 1장째에 있어요."], sumTitle: "평소와 달랐던 5가지", cards: "3~5번은 카드 1장째에 있어요.", reply: "3~5번에 뭐가 들어갈지 하나만 맞혀보실래요?" });
  }
  return thrSafe(out);
}

/* ---------- 정기 세트 ---------- */
function thrPeriodic(kind, names) {
  var S = PER_SETS[kind], recent = typeof perRecent === "function" ? perRecent() : null; if (!S || !recent) return [];
  var win = perWindow(kind), prev = perWindow(kind, true), isM = /month/.test(kind), unit = isM ? "달" : "주";
  if (S.mode) {
    BRIEF_WIN = { from: win.from, to: win.to };
    try {
      var R = briefCompute(recent, { mode: S.mode, popular: (typeof briefState !== "undefined" && briefState.popular) || null });
      var iss = issuesCompute(recent, { mode: S.mode });
      var v = thrDaily(R, iss, names, { when: "이번 " + unit });
      var rows = PER_ASSETS.map(function (a) { var d = recent.symbols[a[0]]; var s = d ? briefStats(a[0], d, S.mode) : null; return s ? { name: a[1], ret: s.ret } : null; }).filter(Boolean).sort(function (a, b) { return b.ret - a.ret; });
      if (rows.length >= 4) {
        var L = rows.slice(0, 3).map(function (x, i) { return (i + 1) + "위 " + x.name + " " + thrPct(x.ret); }).concat(["꼴찌 " + rows[rows.length - 1].name + " " + thrPct(rows[rows.length - 1].ret)]);
        var DL = (rows.length <= 5 ? rows : rows.slice(0, 4).concat([rows[rows.length - 1]])).map(function (x) { return (x === rows[rows.length - 1] ? "꼴찌" : (rows.indexOf(x) + 1) + "위") + " " + x.name + " " + thrPct(x.ret); });
        var spread = rows[0].ret - rows[rows.length - 1].ret;
        var c = thrCompose({ hook: "이번 " + unit + " 1등 자산, 예상하셨나요?\n주식·채권·금·원유·환율·코인 " + rows.length + "개를 줄 세웠어요. (" + win.short + ")", summary: L, data: DL, interp: ["1등과 꼴찌 차이 " + (spread * 100).toFixed(1) + "%p. 같은 " + unit + "에도 자산마다 방향이 달랐어요."], insights: ["1등과 꼴찌의 차이가 " + (spread * 100).toFixed(1) + "%p예요. 같은 " + unit + "에도 자산마다 방향이 달랐어요 — 나눠 담는 이유가 여기 있어요."].concat(thrInsights(R, iss, "종목")), cards: "업종·급등락·가장 큰 하루는 카드에 이어서 정리했어요.", question: "이번 " + unit + " 여러분 계좌의 1등은 뭐였나요?", tags: ["우상향연구소", isM ? "월간결산" : "주간증시", "자산배분", "재테크", "주식초보"], foot: win.short + " 종가 기준 · 투자 권유 아님",
          limit: ["한계도 적어둘게요.", "한 " + unit + " 성적은 그 " + unit + "에 들고 있던 사람에게만 맞는 숫자예요.", "1등 자산은 " + unit + "마다 자주 바뀝니다. 이번 1등이 다음에도 1등이라는 뜻은 아니에요.", "지난 10년은 주식이 대체로 오른 시기였어요. 더 길게 보면 순위가 또 달라집니다."], reply: "이번 " + unit + " 순위에서 제일 의외인 자산은요?" });
        v.unshift({ label: "성적표형", th: c.th, r1: c.r1, r2: c.r2, ig: c.ig });
      }
      return thrSafe(v);
    } finally { BRIEF_WIN = null; }
  }
  var ym = win.s.slice(0, 7), up = PUB_CAL.filter(function (e) { return e.k !== "hol" && (isM ? e.d.slice(0, 7) === ym : e.d >= win.s && e.d <= win.e); }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  var key = up.filter(function (e) { return /FOMC|CPI|고용|금통위|실적/.test(e.t); });
  var now = typeof perNow === "function" ? perNow() : { why: [] };
  BRIEF_WIN = { from: prev.from, to: prev.to };
  var Rp; try { Rp = briefCompute(recent, { mode: isM ? "month" : "week" }); } finally { BRIEF_WIN = null; }
  var evL = (key.length ? key : up).slice(0, 4).map(function (e) { return e.d.slice(5).replace("-", "/") + "(" + pubDow(e.d) + ") " + thrNoEmoji(e.t).trim() + (e.sure === false ? " (예정)" : ""); });
  var sig = now.why.length ? ["지금 신호: " + now.why.map(function (w) { return w.split("→").pop().trim(); }).join(" · ")] : [];
  var last1 = Rp.themes && Rp.themes.length ? ["지난" + unit + " 1등 업종 " + Rp.themes[0].name + " " + thrPct(Rp.themes[0].ret)] : [];
  var Sm = evL.concat(sig, last1), nk = key.length || up.length;
  var Ins = ["발표 전후로는 하루 변동이 커지곤 했어요. 방향을 맞히기보다, 그날 계좌를 덜 보는 것도 방법이에요.", last1.length ? "지난" + unit + " 1등이 이번 " + unit + "에도 1등인 경우는 생각보다 적었어요. 이미 오른 폭부터 확인해 보세요." : ""];
  var base = { summary: Sm, insights: Ins, cards: "날짜별로 무슨 발표인지, 같이 볼 숫자는 카드에 정리했어요.", question: "이번 " + unit + " 가장 신경 쓰이는 일정은 뭔가요?", tags: ["우상향연구소", isM ? "월간전망" : "주간일정", "경제일정", "주식초보", "재테크"], foot: "공개 일정·과거 데이터 · 예측 아님 · 투자 권유 아님", data: evL.concat(last1).slice(0, 5), thFoot: "공개 일정 · 예측 아님", limit: ["한계도 적어둘게요.", "발표 숫자를 맞혀도 시장은 반대로 움직인 적이 많았습니다.", "일정은 '변동이 커질 수 있는 날'이지 '오르는 날·내리는 날'이 아니에요.", "일정은 바뀔 수 있으니 당일 공지를 한 번 더 확인해 주세요."], reply: "이 중 가장 신경 쓰이는 날짜는 언제인가요?" };
  var out = [];
  function add(l, h, ex) { var c = thrCompose(Object.assign({}, base, ex || {}, { hook: h })); out.push({ label: l, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  add("초보 질문형", "이번 " + unit + " 주식 앱, 언제 특히 눈여겨봐야 할까요?\n" + (nk <= 1 ? "꼭 볼 날짜는 하나예요." : nk + "개 날짜만 기억하면 돼요."));
  if (last1.length) add("반전형", "지난" + unit + " 1등은 " + Rp.themes[0].name + " " + thrPct(Rp.themes[0].ret) + ".\n이번 " + unit + "에도 1등일 확률, 생각보다 낮았어요.");
  if (key[0]) add("숫자 한 방형", key[0].d.slice(5).replace("-", "/") + ".\n이번 " + unit + " 가장 큰 발표가 있는 날이에요. " + thrNoEmoji(key[0].t).trim() + ".");
  if (isM && typeof perSeason === "function") { var mo = new Date(win.from + 9 * 3600e3).getUTCMonth() + 1, ss = perSeason("SPY", mo); if (ss) add("퀴즈형", "지난 " + ss.n + "년, " + mo + "월에 S&P500이 오른 해는 몇 번일까요?\n1) " + Math.max(0, ss.up - 3) + "번  2) " + ss.up + "번  3) " + Math.min(ss.n, ss.up + 3) + "번\n정답은 카드 2장째에 있어요.", { insights: ["계절성은 확률이지 약속이 아니에요. 같은 달이라도 해마다 결과가 크게 달랐어요."], interp: [], reply: "몇 번이라고 보셨나요? 정답 보기 전에 골라주세요.", limit: ["한계도 적어둘게요.", "지난 " + ss.n + "년은 S&P500이 대체로 오른 시기였어요. 그래서 '오른 해'가 많아 보이기 쉽습니다.", "계절성은 확률이지 약속이 아니에요. 같은 달이라도 해마다 결과가 크게 달랐습니다."] }); }
  return thrSafe(out);
}

/* ---------- 연구노트 · 정책 ---------- */
function thrFromCaption(cap, hooks, N, cardsTxt, ins, tags, th) {
  var lines = String(cap.ig || "").split("\n"), first = thrNoEmoji(lines[0] || "").trim();
  var nums = lines.filter(function (l) { return /[0-9]/.test(l) && /^[·•]|^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l.trim()); }).map(function (l) {
    l = thrNoEmoji(l).replace(/^·\s*/, "").trim();
    if (/→/.test(l) && / \/ /.test(l)) { var ci = l.indexOf(":"); l = (ci > 0 ? l.slice(0, ci + 1) + " " : "") + l.slice(ci > 0 ? ci + 1 : 0).split(" / ").map(function (x) { return x.split("→").pop().trim(); }).join(" · "); }
    return l.replace(/ 뒤 1년 → 가장 강했던 자산 /, " 뒤 1년 1등 ");
  }).slice(0, 5);
  var base = { summary: nums, insights: ins || [], cards: cardsTxt || (N ? N + "장으로 정리했어요." : ""), question: "여러분은 지금 어떤 구간이라고 보시나요?", tags: tags || THR_TAGS.all, foot: "과거 데이터(종가) 자동 집계 · 투자 권유 아님" };
  th = th || {};
  var keyed = nums.filter(function (l) { return thrKey(l) != null; }); if (keyed.length >= 2) nums = keyed;
  base = Object.assign(base, { data: nums, sort: th.sort !== false, interp: th.interp, thFoot: "과거 종가 · 투자 권유 아님", limit: th.limit || ["한계도 적어둘게요.", "과거 데이터로 계산한 결과예요. 지난 10년은 대체로 오른 시기라, 다른 시기였다면 숫자가 달랐을 수 있습니다."], reply: th.reply || "이 숫자 중에 제일 의외였던 건 뭐였나요?" });
  var out = [], c = thrCompose(Object.assign({}, base, { hook: first })); out.push({ label: "기본형", th: c.th, r1: c.r1, r2: c.r2, ig: c.ig });
  (hooks || []).forEach(function (h) { var d = thrCompose(Object.assign({}, base, { hook: h[1] }, h[2] || {})); out.push({ label: h[0], th: d.th, r1: d.r1, r2: d.r2, ig: d.ig }); });
  if (out.length > 1) out.push(out.shift());   // 질문형 훅이 먼저 보이게
  return thrSafe(out);
}
function thrStory(key, names) {
  var cap = typeof storyCaption === "function" ? storyCaption(key) : null; if (!cap) return [];
  var kind = key.split(":")[0], N = names ? names.length : 0, hooks = [], ins = [], now = typeof nbNow === "function" ? nbNow() : { why: [] };
  if (kind === "scene") { var sc = (chState.scen || []).filter(function (s) { return s.id === key.split(":")[1]; })[0]; if (sc) { hooks.push(["초보 질문형", sc.tag + "이 오면 뭘 들고 있어야 할까요?\n과거 " + sc.eps.length + "번을 뒤져 봤어요."]); hooks.push(["반전형", sc.tag + " 뒤 1년,\n1등 자산은 매번 달랐어요."]); ins = ["사건이 같아도 원인이 달랐고, 그래서 이긴 자산도 달랐어요.", "그래서 예측보다 조건(장기금리·공포지수·추세·달러)을 먼저 봐요."]; } }
  if (kind === "drawdown") { hooks.push(["초보 질문형", "지금 빠진 거, 얼마나 기다려야 돌아올까요?\n10년치로 과거 회복 기간을 재 봤어요."]); ins = ["회복은 늘 왔지만 걸린 시간은 자산마다, 하락의 깊이마다 달랐어요.", "내가 기다릴 수 있는 기간이 곧 내가 감당할 수 있는 비중이에요."]; }
  if (kind === "dca") { hooks.push(["초보 질문형", "주식, 적금처럼 매달 사면 정말 안 잃을까요?\n실제 종가로 계산해 봤어요."]); ins = ["나눠 사면 고점에 몰아 살 위험이 줄어요.", "다만 지난 결과는 시작 시점에 따라 크게 달랐어요."]; }
  if (kind === "news") { hooks.push(["반전형", "기사 제목은 '급등'인데\n실제 숫자는 몇 %였을까요?"]); ins = ["기사는 이유를 말하고, 숫자는 크기를 말해요. 제목이 큰 날일수록 실제 숫자는 생각보다 작을 때가 많았어요."]; }
  if (kind === "today") { hooks.push(["빈칸형", "어제 시장에서 평소와 가장 달랐던 것.\n1번은 지수가 아니었어요."]); if (now.why.length) hooks.push(["초보 질문형", "요즘 시장, '" + now.why[0].split("→").pop().trim() + "'이라는데\n그게 무슨 뜻일까요?"]); }
  var tz = { scene: "지금은 어떤 조건인지, 체크리스트는 카드 뒤쪽에 있어요.", drawdown: "지금만큼 빠졌던 과거와 회복 기간은 카드 4장째에 있어요.", dca: "'가장 좋은 10일을 놓쳤다면'은 카드 뒤쪽에 있어요.", news: "기사 제목과 실제 숫자를 나란히 놓은 건 카드 2장째부터예요.", today: "오늘의 1번은 카드 2장째에 있어요." }[kind];
  var TH = {
    scene: { limit: ["한계도 적어둘게요.", "비교한 과거는 몇 번뿐이에요. 표본이 적어서, 다음 번에도 같은 자산이 이긴다는 뜻은 아닙니다.", "사건 이름이 같아도 금리·물가 같은 배경이 달랐어요."], reply: "이 중에 제일 의외였던 1등 자산은요?" },
    drawdown: { limit: ["한계도 적어둘게요.", "지금까지 살아남은 지수·종목만 계산했어요(생존편향). 사라진 종목은 회복하지 못했습니다.", "최악의 경우는 표에 적힌 것보다 더 깊었던 적도 있고, 회복이 몇 년 걸린 적도 있어요."], reply: "회복 기간 중에 제일 의외였던 건 어디였나요?" },
    dca: { limit: ["한계도 적어둘게요.", "지난 10년은 대체로 오른 시기였어요. 같은 방법이라도 옆으로 긴 구간에선 결과가 약했습니다.", "지금 남아 있는 지수·ETF로만 계산했어요(생존편향). 수수료·세금도 빠져 있어요."], reply: "여러분은 적립식인가요, 한 번에 사시나요?" },
    news: { limit: ["한계도 적어둘게요.", "제목이 작아도 숫자가 컸던 날도 있었어요.", "기사와 숫자를 짝지은 건 자동 연결이라, 다른 이유로 움직였을 수도 있습니다."], reply: "제목과 숫자 차이가 제일 컸던 건 어느 기사였나요?" },
    today: { reply: "지수랑 오른 종목 비율, 어느 쪽을 먼저 보시나요?", limit: ["한계도 적어둘게요.", "하루 숫자 하나로 추세를 말하긴 어렵습니다. 20일·200일 흐름을 같이 봐야 해요.", "종가 기준이라 장중에 크게 흔들린 건 이 숫자에 안 보입니다."], sort: false }
  }[kind];
  return thrFromCaption(cap, hooks, N, tz, ins, kind === "dca" ? ["우상향연구소", "적립식", "ETF", "재테크", "주식초보"] : THR_TAGS.all, TH);
}
function thrPolicy(pl, names) {
  var rows = pl.table.rows, nm = pl.short || pl.t;
  var S = rows.slice(0, 5).map(function (r) { return r[0] + ": " + r[1] + (r.length > 2 ? " ~ " + r[r.length - 1] : ""); });
  var Ins = [(pl.bullets ? "우대 조건(" + pl.bullets.items.length + "가지)을 겹치면 표의 금리보다 더 내려가요. " : "") + "조건이 바뀌는 일이 잦으니 신청 전 기관 공지에서 적용일을 꼭 확인하세요."];
  var base = { summary: S, insights: Ins, cards: pl.bullets ? "추가 할인 조건은 마지막 장에 있어요." : "자세한 표는 카드에 있어요.", question: "내 구간은 어디인지 댓글로 남겨 주세요. 조건이 바뀌면 다시 정리해 올릴게요.", tags: THR_TAGS.policy.concat(pl.tags || []).slice(0, 7), foot: "출처: " + (pl.src || "") + (pl.eff ? " · " + pl.eff : "") + " · 권유 아님",
    data: S, interp: [pl.bullets ? "우대 조건을 겹치면 표의 금리보다 더 내려가요." : "구간마다 금리가 이렇게 달라집니다."], thFoot: "출처: " + (pl.src || "공식 공고") + " · 권유 아님",
    limit: ["한계도 적어둘게요.", "표의 금리는 기본 금리예요. 실제 금리는 신청 시점과 우대 조건에 따라 달라집니다.", "정책 상품은 한도·조건이 바뀌거나 일찍 끝나는 일이 잦았어요. 신청 전 기관 공지에서 적용일을 꼭 확인해 주세요."],
    reply: "대출 금리 정리와 청약 조건 정리 중 어느 쪽이 더 궁금하세요?" };
  var out = [];
  function add(l, h) { var c = thrCompose(Object.assign({}, base, { hook: h })); out.push({ label: l, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  add("초보 질문형", "내 소득이면 " + nm + " 몇 %일까요?\n표 하나로 찾을 수 있게 정리했어요.");
  add("숫자 한 방형", (rows[0] && rows[0][1]) + ".\n" + nm + " 가장 낮은 구간의 금리예요.");
  add("반전형", "같은 " + nm + "인데\n조건 몇 개로 금리가 이만큼 달라져요.");
  return thrSafe(out);
}

/* ---------- 화면: 카드 창 맨 위 '업로드 글' 패널 (인스타 + 스레드 본문·답글 1·답글 2) ---------- */
function thrPart(cls, label, max, hint) {
  return '<div class="thrPart"><div class="thrLbl"><b>' + label + '</b>' + (hint ? '<em>' + hint + '</em>' : '') + '<span class="thrCnt" data-max="' + max + '"></span><button class="chip thrCopy">복사</button></div><textarea class="thrText ' + cls + '" spellcheck="false"></textarea></div>';
}
function thrPanelHtml(topic) {
  return '<div class="thrPanel" data-topic="' + (topic || "주식") + '"><div class="thrHead"><b>업로드 글</b><small>스레드 토픽: <b>' + (topic || "주식") + '</b> · 본문 올린 뒤 답글 1·2를 이어서 달기</small><span class="thrAiBtns"><button class="chip thrAi" title="지금 글(우리 숫자)을 바탕으로 Claude가 다시 쓰고, 필요하면 최근 사실을 찾아 보완해요 · 누를 때만 비용이 들어요">✨ AI 문구 (Claude)</button><button class="chip thrChkBtn" title="올리기 직전: 카드 글자와 캡션의 숫자 불일치·권유처럼 읽히는 문장·과장·오탈자를 찾아요">🧐 발행 전 검수</button></span></div><div class="thrAiOut briefDim"></div>' +
    '<div class="pills thrTabs"></div>' +
    '<div class="thrGrid"><div class="thrCol">' + thrPart("thrIg", "인스타 캡션", 2200) + '</div>' +
    '<div class="thrCol">' + thrPart("thrTh", "스레드 본문", 500, "첫 줄이 피드에 보임") + thrPart("thrR1 sm", "답글 1", 500, "반대 숫자·한계") + thrPart("thrR2 sm", "답글 2", 500, "질문 하나") + '</div></div></div>';
}
function thrBind(box, variants) {
  var p = box.querySelector(".thrPanel"); if (!p) return;
  if (!variants || !variants.length) { p.style.display = "none"; return; }
  var tabs = p.querySelector(".thrTabs"), parts = Array.prototype.slice.call(p.querySelectorAll(".thrPart")), keys = ["ig", "th", "r1", "r2"];
  function upd() { parts.forEach(function (pt) { var ta = pt.querySelector("textarea"), c = pt.querySelector(".thrCnt"), mx = +c.getAttribute("data-max"); c.textContent = ta.value.length + " / " + mx.toLocaleString() + "자"; c.style.color = ta.value.length > mx ? "var(--up)" : ""; }); }
  function show(i) { var v = variants[i]; parts.forEach(function (pt, k) { var ta = pt.querySelector("textarea"); ta.value = v[keys[k]] || ""; pt.style.display = k > 1 && !v[keys[k]] ? "none" : ""; }); upd(); Array.prototype.forEach.call(tabs.children, function (b, k) { b.classList.toggle("active", k === i); }); }
  tabs.innerHTML = variants.map(function (v) { return '<button>' + v.label + '</button>'; }).join("");
  Array.prototype.forEach.call(tabs.children, function (b, i) { b.onclick = function () { show(i); }; });
  parts.forEach(function (pt) { var ta = pt.querySelector("textarea"); ta.oninput = upd; pt.querySelector(".thrCopy").onclick = function () { chCopy(ta.value, this); }; });
  show(thrSeed() % variants.length);
  /* v12.38 ✨ AI 문구: 누를 때만 Claude API로 다시 쓴다(자동 생성 아님). 결과는 탭으로 앞에 붙이고, 우리 데이터에 없는 숫자는 표시만 */
  var ab = p.querySelector(".thrAi"), ao = p.querySelector(".thrAiOut"), cbk = p.querySelector(".thrChkBtn");
  if (cbk) cbk.onclick = function () { if (typeof thrCheckRun === "function") thrCheckRun(p, cbk, ao); };   // v12.39 발행 전 검수
  if (ab) ab.onclick = function () {
    var base = variants.filter(function (v) { return !/^✨/.test(v.label); })[0] || variants[0];
    var data = ["[인스타 규칙 글]", base.ig, "[스레드 본문]", base.th, "[답글1]", base.r1 || "", "[답글2]", base.r2 || ""].join("\n");
    var ttl = (p.closest(".modalBox") && (p.closest(".modalBox").querySelector("h3, .modalTitle, .mTitle") || {}).textContent) || String(base.th || "").split("\n")[0];
    var tok = ""; try { tok = (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) {}
    var old = ab.innerHTML; ab.disabled = true; ab.textContent = "쓰는 중… (10~40초)"; ao.textContent = "";
    fetch("/api/channel?op=copy", { method: "POST", headers: { "content-type": "application/json", "x-owner": tok }, body: JSON.stringify({ title: ttl, topic: p.getAttribute("data-topic") || "", data: data, lines: typeof CARD_TXT === "string" ? CARD_TXT.slice(0, 2500) : "" }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        ab.disabled = false; ab.innerHTML = old;
        if (!j || !j.ok) { ao.innerHTML = '<span style="color:#b45309">AI 문구 실패: ' + escapeHtml((j && (j.msg || j.reason)) || "응답 없음") + '</span>'; return; }
        variants = j.variants.concat(variants.filter(function (v) { return !/^✨/.test(v.label); }));
        tabs.innerHTML = variants.map(function (v) { return '<button>' + escapeHtml(v.label) + '</button>'; }).join("");
        Array.prototype.forEach.call(tabs.children, function (b, i) { b.onclick = function () { show(i); }; });
        show(0);
        var nums = function (t) { return (String(t).match(/[+\-−]?\d[\d,]*(?:\.\d+)?%/g) || []).map(function (x) { return x.replace(/[−]/g, "-").replace(/,/g, ""); }); };
        var have = {}; nums(data + "\n" + (typeof CARD_TXT === "string" ? CARD_TXT : "") + "\n" + (j.added || []).join("\n")).forEach(function (x) { have[x.replace(/^\+/, "")] = 1; });
        var odd = []; j.variants.forEach(function (v) { nums([v.ig, v.th, v.r1, v.r2].join("\n")).forEach(function (x) { var k = x.replace(/^\+/, ""); if (!have[k] && odd.indexOf(x) < 0) odd.push(x); }); });
        ao.innerHTML = '<b>✨ Claude 결과</b> · ' + escapeHtml(j.model || "") + ' · 오늘 ' + j.used + '/' + j.max + '회' + (j.searches && j.searches.length ? ' · 웹 검색 ' + j.searches.length + '회' : ' · 웹 검색 없음') +
          (j.added && j.added.length ? '<div>보완한 사실: ' + j.added.map(escapeHtml).join(" / ") + '</div>' : '') +
          (j.sources && j.sources.length ? '<div>출처: ' + j.sources.map(function (s) { return '<a href="' + escapeHtml(s.u) + '" target="_blank" rel="noopener">' + escapeHtml(s.t || s.u) + '</a>'; }).join(" · ") + '</div>' : '') +
          (odd.length ? '<div style="color:#b45309">⚠️ 우리 데이터에서 못 찾은 숫자: ' + escapeHtml(odd.join(", ")) + ' — 올리기 전에 확인하세요</div>' : '<div style="color:var(--good)">✓ 글 속 % 숫자가 모두 우리 데이터·보완 사실과 일치</div>') +
          (j.note ? '<div>편집 메모: ' + escapeHtml(j.note) + '</div>' : '');
      }).catch(function (e) { ab.disabled = false; ab.innerHTML = old; ao.textContent = "AI 문구 실패: " + e.message; });
  };
}
/* 변형이 하나도 안 나오면 기존 캡션을 이모지만 지워 기본형으로 쓴다 (스레드는 줄 단위로 500자 안에) */
function thrOr(v, cap) {
  if (v && v.length) return v; if (!cap || !cap.ig) return [];
  var ig = thrNoEmoji(cap.ig), th = thrFit(thrNoEmoji(cap.th || ig).split("\n").filter(function (l) { return !/^#/.test(l.trim()); }).join("\n"));
  return [{ label: "기본형", ig: ig, th: th, r1: "한계도 적어둘게요.\n과거 종가로 계산한 결과예요. 지난 10년은 대체로 오른 시기라, 다른 시기였다면 숫자가 달랐을 수 있습니다.", r2: "이 숫자 중에 제일 의외였던 건 뭐였나요?\n\n" + THR_APP }];
}
