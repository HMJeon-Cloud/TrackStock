/* ============================================================
   스레드 글 (v9.2) — 카드 위에 붙이는 글. 목적: 피드에서 멈추게 하고 → 카드를 넘기게 하는 것.
   uphill.lab 실험에서 확인된 공식 (2026-09~10)
     ✅ 잘 된 것: 초보자가 이미 하는 질문으로 시작 · 숫자는 5줄 이하 · 토픽 태그 1개(주식/재테크/코인)
     ❌ 안 된 것: 원칙·교훈 설명 · 개념이 여러 개 섞인 글 · 서사 없는 숫자 나열
   그래서 모든 글 = ① 첫 줄 훅(질문·반전·숫자 한 방·퀴즈·빈칸) → ② "카드 보기 전 한눈에" 숫자 3~5줄 → ③ 카드로 넘기게 하는 한 줄(몇 장째에 뭐가 있는지)
   원칙: 추천·예측·과장 금지(PUB_BANNED 검사) · 숫자는 전부 그날 종가 계산값 그대로 · 500자 이내
   ============================================================ */
var THR_TOPIC = { all: "주식", kr: "주식", us: "주식", coin: "코인", policy: "재테크", dca: "재테크" };
function thrPct(x, d) { return cPct(x, d == null ? 1 : d); }
function thrSeed() { return Math.floor((Date.now() + 9 * 3600e3) / 86400e3); }
function thrClean(s) { return String(s).replace(/\s*[—-]\s*평소.*$/, "").replace(/\s+/g, " ").trim(); }
/* 카드 목록에서 키워드가 들어간 장 번호 (1부터) */
function thrPage(names, re) { if (!names) return null; for (var i = 0; i < names.length; i++) if (re.test(names[i])) return i + 1; return null; }
function thrFinish(hook, lines, teaser, foot) {
  lines = lines.filter(Boolean).slice(0, 5);
  var t = hook + "\n\n📌 카드 보기 전 한눈에\n" + lines.join("\n") + (teaser ? "\n\n" + teaser : "") + "\n\n" + (foot || "(종가 기준 · 투자 권유 아님)");
  if (t.length > 500) { while (lines.length > 3 && t.length > 500) { lines.pop(); t = hook + "\n\n📌 카드 보기 전 한눈에\n" + lines.join("\n") + (teaser ? "\n\n" + teaser : "") + "\n\n" + (foot || "(종가 기준 · 투자 권유 아님)"); } }
  if (t.length > 500) t = t.slice(0, 497) + "…";
  return t;
}
function thrSafe(v) { return v.filter(function (x) { return x && x.text && !(typeof PUB_BANNED !== "undefined" && PUB_BANNED.test(x.text)); }); }

/* ---------- 전일 정리 (시장별) ---------- */
function thrDaily(R, iss, names, opts) {
  opts = opts || {};
  if (!R) return [];
  var mk = R.market || "all", when = opts.when || (R.mode === "week" ? "이번 주" : R.mode === "month" ? "이번 달" : "어제");
  var t = R.temp, ir = R.indexRow || [], i0 = ir[0], i1 = ir[1];
  var th = R.themes || [], tTop = th.length >= 2 ? th[0] : null, tBot = th.length >= 2 ? th[th.length - 1] : null;
  var mUp = R.movers && R.movers.up[0], mDn = R.movers && R.movers.down[0], hot = (R.hotVol || [])[0];
  var nums = R.numbers || [], saleN = nums[0] ? nums[0].v : null, vix = nums.filter(function (n) { return n.sym === "^VIX"; })[0];
  var nh = t.newHigh ? t.newHigh.length : 0, nl = t.newLow ? t.newLow.length : 0, has1y = !!t.n200;
  var top = iss && iss[0], zz = top && (top.sub || "").match(/평소[^0-9]*([0-9.]+)배/);
  var N = names ? names.length : 0, mkName = mk === "all" || mk === "coin" ? "" : R.mktName + " ", unit = mk === "coin" ? "코인" : "종목", endTag = when === "어제" ? "" : when + " 끝 기준 ";
  function r1(s) { return s ? (s.ret1 != null && R.mode !== "week" && R.mode !== "month" ? s.ret1 : s.ret) : null; }
  // 한눈에 (숫자 5줄 이하)
  var L = [];
  if (i0) L.push((mk === "coin" ? "₿ " : "📊 ") + i0.name + " " + thrPct(i0.ret) + (i1 ? " · " + i1.name + " " + thrPct(i1.ret) : ""));
  L.push("🌡️ 오른 " + unit + " " + Math.round(t.upPct * 100) + "% · 20일선 위 " + Math.round(t.abovePct * 100) + "%");
  if (tTop) L.push("🔥 " + tTop.name + " " + thrPct(tTop.ret) + " / 🧊 " + tBot.name + " " + thrPct(tBot.ret));
  if (mUp && mDn) L.push("🚀 " + briefName(mUp) + " " + thrPct(r1(mUp)) + " · 🔻 " + briefName(mDn) + " " + thrPct(r1(mDn)));
  if (has1y && (nh || nl)) L.push("🏔️ " + endTag + "52주 신고가 " + nh + " : 신저가 " + nl);
  else if (hot) L.push("💰 " + briefName(hot) + " 거래대금 평소의 " + hot.amtX.toFixed(1) + "배");
  var pSale = thrPage(names, /세일/), pMove = thrPage(names, /급등급락/), pTheme = thrPage(names, /테마|전체시세/), pHL = thrPage(names, /신고가/), pNews = thrPage(names, /^N/);
  var teasers = [];
  if (pSale && saleN) teasers.push("👇 고점보다 20% 넘게 싼 " + saleN + " " + unit + ", " + pSale + "장째에 리스트로 넣었어요");
  if (pHL && has1y) teasers.push("👇 신고가·신저가 종목 이름은 " + pHL + "장째에");
  if (pMove) teasers.push("👇 가장 많이 오르고 내린 " + unit + " " + (R.movers.up.length >= 7 ? "14" : "10") + "개는 " + pMove + "장째에");
  if (pNews) teasers.push("👇 같이 읽으면 좋은 아침 기사 10개는 " + pNews + "장째부터");
  var teaser = teasers.length ? teasers[thrSeed() % teasers.length] : (N ? "👇 카드 " + N + "장에 다 정리했어요" : "");
  var out = [];
  // ① 초보 질문형
  var q;
  if (mk === "coin" && i0) q = i0.name + " " + thrPct(i0.ret) + ".\n다른 코인들은 어땠을까요?";
  else if (i0 && i0.ret <= -0.015) q = when + " 계좌 보고 놀라셨죠?\n" + i0.name + " " + thrPct(i0.ret) + ", 내 종목만 그런 게 아니었어요.";
  else if (i0 && i0.ret >= 0.015) q = i0.name + " " + thrPct(i0.ret) + ".\n나만 못 탄 것 같은 기분, 숫자로 확인해 볼게요.";
  else if (i0 && i0.ret > 0 && t.upPct < 0.45) q = "지수는 올랐는데\n왜 내 종목은 빠졌을까요?";
  else q = when + " " + mkName + "시장, 30초면 다 봐요.\n숫자 5줄로 먼저 보여드릴게요.";
  out.push({ label: "초보 질문형", text: thrFinish(q, L, teaser) });
  // ② 반전형 — 지수 vs 체감
  var tw;
  if (i0 && i0.ret > 0 && t.upPct < 0.5) tw = i0.name + " " + thrPct(i0.ret) + ".\n그런데 오른 " + unit + "은 " + Math.round(t.upPct * 100) + "%뿐이었어요.";
  else if (i0 && i0.ret < 0 && t.upPct > 0.5) tw = i0.name + " " + thrPct(i0.ret) + ".\n그런데 오른 " + unit + "이 " + Math.round(t.upPct * 100) + "%로 더 많았어요.";
  else if (mUp && tBot && /\S/.test(tBot.name)) tw = tBot.name + "이 " + thrPct(tBot.ret) + "로 꼴찌였던 날,\n1등은 의외로 " + briefName(mUp) + " " + thrPct(r1(mUp)) + "였어요.";
  else if (mUp) tw = "오른 " + unit + " " + Math.round(t.upPct * 100) + "%.\n그중 1등은 " + briefName(mUp) + " " + thrPct(r1(mUp)) + " — 이름 들어 보셨어요?";
  if (tw) out.push({ label: "반전형", text: thrFinish(tw, L, teaser) });
  // ③ 숫자 한 방형
  if (top && zz) out.push({ label: "숫자 한 방형", text: thrFinish(zz[1] + "배.\n" + when + " " + thrClean(top.title).replace(/\s*\(.*?\)\s*$/, "") + " — 평소 하루 움직임의 " + zz[1] + "배였어요.", L, teaser) });
  else if (saleN) out.push({ label: "숫자 한 방형", text: thrFinish(saleN + ".\n52주 고점보다 20% 넘게 싼 " + mkName + unit + " 수예요.", L, teaser) });
  // ④ 퀴즈형 — 정답은 카드에
  var opts3 = null, qz = null, ans = null;
  if (tTop && th.length >= 4) { ans = tTop.name; opts3 = [tTop.name, th[Math.floor(th.length / 2)].name, tBot.name]; qz = when + " 가장 많이 오른 업종은?"; }
  else if (mk === "coin" && mUp) { var pool = R.movers.up.slice(0, 1).concat(R.movers.down.slice(0, 2)); ans = briefName(mUp); opts3 = pool.map(briefName); qz = when + " 가장 많이 오른 코인은?"; }
  if (opts3) {
    var s = thrSeed(); opts3 = opts3.map(function (x, i) { return { x: x, k: (i * 7 + s) % 3 }; }).sort(function (a, b) { return a.k - b.k; }).map(function (o) { return o.x; });
    var Lq = L.filter(function (l) { return !/^🔥|^🚀/.test(l); });
    out.push({ label: "퀴즈형", text: thrFinish(qz + "\n① " + opts3[0] + "  ② " + opts3[1] + "  ③ " + opts3[2] + "\n\n정답은 카드 " + (mk === "coin" ? (pMove || pTheme || 2) : (pTheme || pMove || 2)) + "장째 👇", Lq, "", "(종가 기준 · 투자 권유 아님)") });
  }
  // ⑤ 빈칸형 — 5가지 중 2개만 보여주고 나머지는 카드로
  if (iss && iss.length >= 4) {
    var hookL = when + " " + mkName + "시장에서 평소와 달랐던 5가지.\n" + (thrSeed() % 2 ? "4번째가 제일 의외였어요." : "3번째는 아무도 얘기 안 했어요.");
    var Lb = [iss[0], iss[1]].map(function (it, i) { return (i + 1) + ". " + it.emoji + " " + thrClean(it.title); }).concat(["3. ???", "4. ???", "5. ???"]);
    out.push({ label: "빈칸형", text: thrFinish(hookL, Lb, "👇 3~5번은 카드 1장째에", "(종가 기준 · 투자 권유 아님)") });
  }
  return thrSafe(out);
}

/* ---------- 정기 세트 ---------- */
function thrPeriodic(kind, names) {
  var S = PER_SETS[kind], recent = typeof perRecent === "function" ? perRecent() : null; if (!S || !recent) return [];
  var win = perWindow(kind), prev = perWindow(kind, true), isM = /month/.test(kind), unit = isM ? "달" : "주";
  if (S.mode) {   // 정리 세트 = 달력 구간으로 계산해서 전일 템플릿 재사용
    BRIEF_WIN = { from: win.from, to: win.to };
    try {
      var R = briefCompute(recent, { mode: S.mode, popular: (typeof briefState !== "undefined" && briefState.popular) || null });
      var iss = issuesCompute(recent, { mode: S.mode });
      var v = thrDaily(R, iss, names, { when: "이번 " + unit });
      // 정리 전용 훅 하나 더: 자산 성적표 1등/꼴찌
      var rows = PER_ASSETS.map(function (a) { var d = recent.symbols[a[0]]; var s = d ? briefStats(a[0], d, S.mode) : null; return s ? { name: a[1], ret: s.ret } : null; }).filter(Boolean).sort(function (a, b) { return b.ret - a.ret; });
      if (rows.length >= 4) {
        var L = rows.slice(0, 3).map(function (x, i) { return (i + 1) + "위 " + x.name + " " + thrPct(x.ret); }).concat(["꼴찌 " + rows[rows.length - 1].name + " " + thrPct(rows[rows.length - 1].ret)]);
        v.unshift({ label: "성적표형", text: thrFinish("이번 " + unit + " 1등 자산, 예상하셨나요?\n주식·채권·금·원유·환율·코인 " + rows.length + "개 줄 세웠어요. (" + win.short + ")", L, "👇 업종·급등락·가장 큰 하루는 카드에", "(" + win.short + " 종가 기준 · 투자 권유 아님)") });
      }
      return thrSafe(v);
    } finally { BRIEF_WIN = null; }
  }
  // 예상 세트 = 일정 + 지금 신호 + 지난 구간 1등
  var ym = win.s.slice(0, 7), up = PUB_CAL.filter(function (e) { return e.k !== "hol" && (isM ? e.d.slice(0, 7) === ym : e.d >= win.s && e.d <= win.e); }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  var key = up.filter(function (e) { return /FOMC|CPI|고용|금통위|실적/.test(e.t); });
  var now = typeof perNow === "function" ? perNow() : { why: [] };
  BRIEF_WIN = { from: prev.from, to: prev.to };
  var Rp; try { Rp = briefCompute(recent, { mode: isM ? "month" : "week" }); } finally { BRIEF_WIN = null; }
  var evL = (key.length ? key : up).slice(0, 3).map(function (e) { return "🗓️ " + e.d.slice(5).replace("-", "/") + "(" + pubDow(e.d) + ") " + e.t.replace(/^[^\s]+\s/, "") + (e.sure === false ? " (예정)" : ""); });
  var L2 = evL.concat(now.why.length ? ["🧭 지금 신호: " + now.why[0].split("→").pop().trim()] : [], Rp.themes && Rp.themes.length ? ["🔥 지난" + unit + " 1등 " + Rp.themes[0].name + " " + thrPct(Rp.themes[0].ret)] : []);
  var out = [];
  out.push({ label: "초보 질문형", text: thrFinish("이번 " + unit + " 주식 앱, 언제 특히 눈여겨봐야 할까요?\n" + ((key.length || up.length) <= 1 ? "꼭 볼 날짜는 하나예요." : (key.length || up.length) + "개 날짜만 기억하면 돼요."), L2, "👇 날짜별로 무슨 발표인지는 카드 1장째", "(공개 일정 · 예측 아님 · 투자 권유 아님)") });
  if (Rp.themes && Rp.themes.length) out.push({ label: "반전형", text: thrFinish("지난" + unit + " 1등은 " + Rp.themes[0].name + " " + thrPct(Rp.themes[0].ret) + ".\n이번 " + unit + "에도 1등일 확률, 생각보다 낮았어요.", L2, "👇 지난" + unit + " 흐름과 이번 " + unit + " 볼 것 3가지는 카드에", "(과거 데이터 · 예측 아님 · 투자 권유 아님)") });
  if (key[0]) out.push({ label: "숫자 한 방형", text: thrFinish(key[0].d.slice(5).replace("-", "/") + ".\n이번 " + unit + " 가장 큰 발표가 있는 날이에요. " + key[0].t.replace(/^[^\s]+\s/, "") + ".", L2, "👇 발표 전후로 같이 볼 숫자는 카드에", "(공개 일정 · 예측 아님 · 투자 권유 아님)") });
  if (isM && typeof perSeason === "function") { var mo = new Date(win.from + 9 * 3600e3).getUTCMonth() + 1, ss = perSeason("SPY", mo); if (ss) out.push({ label: "퀴즈형", text: thrFinish("지난 " + ss.n + "년, " + mo + "월에 S&P500이 오른 해는 몇 번일까요?\n① " + Math.max(0, ss.up - 3) + "번  ② " + ss.up + "번  ③ " + Math.min(ss.n, ss.up + 3) + "번", evL, "👇 정답과 코스피·금·비트코인의 " + mo + "월은 카드 2장째", "(과거 데이터 · 예측 아님 · 투자 권유 아님)") }); }
  return thrSafe(out);
}

/* ---------- 연구노트 · 정책 · 기타: 캡션 줄에서 숫자 줄만 골라 ---------- */
function thrFromCaption(cap, hooks, N, teaserTxt) {
  var lines = String(cap.ig || "").split("\n"), first = lines[0] || "";
  var nums = lines.filter(function (l) { return /^[·•]|^[🔎📚🧭🌡️🔥🚀📊🗓️🏆💰📋➕]/.test(l.trim()) && /[0-9]/.test(l); }).map(function (l) {
    l = l.replace(/^·\s*/, "· ").trim();
    if (/→/.test(l) && / \/ /.test(l)) { var ci = l.indexOf(":"), em = (l.match(/^(\S+)\s/) || [])[1], pre = ci > 0 ? l.slice(0, ci + 1) + " " : (em && !/[가-힣A-Za-z0-9]/.test(em) ? em + " 지금: " : ""); l = pre + l.slice(ci > 0 ? ci + 1 : (pre ? em.length + 1 : 0)).split(" / ").map(function (x) { return x.split("→").pop().trim(); }).join(" · "); }
    return l.replace(/ 뒤 1년 → 가장 강했던 자산 /, " 뒤 1년 1등 ");
  }).slice(0, 5);
  var teaser = teaserTxt || (N ? "👇 " + N + "장으로 정리했어요" : "");
  var out = [{ label: "기본형", text: thrFinish(first, nums, teaser) }];
  (hooks || []).forEach(function (h) { out.push({ label: h[0], text: thrFinish(h[1], nums, teaser) }); });
  return thrSafe(out);
}
function thrStory(key, names) {
  var cap = typeof storyCaption === "function" ? storyCaption(key) : null; if (!cap) return [];
  var kind = key.split(":")[0], N = names ? names.length : 0, hooks = [];
  var now = typeof nbNow === "function" ? nbNow() : { why: [] };
  if (kind === "scene") { var sc = (chState.scen || []).filter(function (s) { return s.id === key.split(":")[1]; })[0]; if (sc) { hooks.push(["초보 질문형", sc.tag + "이 오면 뭘 들고 있어야 할까요?\n과거 " + sc.eps.length + "번을 뒤져 봤어요."]); hooks.push(["반전형", sc.tag + " 뒤 1년,\n1등 자산은 매번 달랐어요."]); } }
  if (kind === "drawdown") { hooks.push(["초보 질문형", "지금 빠진 거, 얼마나 기다려야 돌아올까요?\n10년치로 과거 회복 기간을 재 봤어요."]); hooks.push(["숫자 한 방형", "'언젠가는 오른다'의 '언젠가'.\n자산마다 몇 개월이었는지 세 봤어요."]); }
  if (kind === "dca") { hooks.push(["초보 질문형", "주식, 적금처럼 매달 사면 정말 안 잃을까요?\n실제 종가로 계산해 봤어요."]); hooks.push(["숫자 한 방형", "10일.\n10년 중 가장 좋았던 10일만 놓쳐도 결과가 이만큼 달라져요."]); }
  if (kind === "news") { hooks.push(["반전형", "기사 제목은 '급등'인데\n실제 숫자는 몇 %였을까요?"]); }
  if (kind === "today") { hooks.push(["빈칸형", "어제 시장에서 평소와 가장 달랐던 것.\n1번은 지수가 아니었어요."]); if (now.why.length) hooks.push(["초보 질문형", "요즘 시장, " + now.why[0].split("→").pop().trim() + "이라는데\n그게 무슨 뜻일까요?"]); }
  var tz = { scene: "👇 그래서 지금은 어떤 조건인지, 체크리스트는 카드 뒤쪽에", drawdown: "👇 지금만큼 빠졌던 과거, 회복까지 걸린 기간은 카드 4장째", dca: "👇 '가장 좋은 10일을 놓쳤다면'은 카드 뒤쪽에", news: "👇 기사 제목과 실제 숫자, 나란히 놓은 건 카드 2장째부터", today: "👇 오늘의 1번이 뭔지는 카드 2장째" }[kind];
  return thrFromCaption(cap, hooks, N, tz ? tz + (N ? " (" + N + "장)" : "") : null);
}
function thrPolicy(pl, names) {
  var cap = typeof pubPolicyCaption === "function" ? pubPolicyCaption(pl) : null; if (!cap) return [];
  var rows = pl.table.rows, N = names ? names.length : 0;
  var L = rows.slice(0, 4).map(function (r) { return "· " + r[0] + ": " + r[1] + (r.length > 2 ? " ~ " + r[r.length - 1] : ""); });
  var tz = "👇 " + (pl.bullets ? "추가 할인 조건 " + pl.bullets.items.length + "가지는 마지막 장에" : "자세한 표는 카드에");
  var foot = "(출처: " + (pl.src || "") + (pl.eff ? " · " + pl.eff : "") + " · 권유 아님)";
  return thrSafe([
    { label: "초보 질문형", text: thrFinish("내 소득이면 " + (pl.short || pl.t) + " 몇 %일까요?\n표 하나로 찾을 수 있게 정리했어요.", L, tz, foot) },
    { label: "숫자 한 방형", text: thrFinish((rows[0] && rows[0][1]) + ".\n" + (pl.short || pl.t) + " 가장 낮은 구간의 금리예요.", L, tz, foot) },
    { label: "반전형", text: thrFinish("같은 " + (pl.short || pl.t) + "인데\n조건 몇 개로 금리가 이만큼 달라져요.", L, tz, foot) }
  ]);
}

/* ---------- 화면 조각: 모달 맨 위에 붙이는 '스레드 글' 패널 ---------- */
function thrPanelHtml(topic) {
  return '<div class="thrPanel"><div class="thrHead"><b>🧵 스레드 글</b><small>카드 위에 붙일 글 · 토픽 태그: <b>' + (topic || "주식") + '</b></small></div>' +
    '<div class="pills thrTabs"></div><textarea class="thrText" spellcheck="false"></textarea>' +
    '<div class="row" style="gap:8px;align-items:center"><button class="primary thrCopy">📋 복사</button><span class="thrCount briefDim"></span><span class="briefDim" style="font-size:11px">첫 줄이 피드에 보여요 · 카드는 글 아래에 첨부</span></div></div>';
}
function thrBind(box, variants) {
  var p = box.querySelector(".thrPanel"); if (!p) return;
  if (!variants || !variants.length) { p.style.display = "none"; return; }
  var tabs = p.querySelector(".thrTabs"), ta = p.querySelector(".thrText"), cnt = p.querySelector(".thrCount"), cur = 0;
  function show(i) { cur = i; ta.value = variants[i].text; upd(); Array.prototype.forEach.call(tabs.children, function (b, k) { b.classList.toggle("active", k === i); }); }
  function upd() { var n = ta.value.length; cnt.textContent = n + " / 500자"; cnt.style.color = n > 500 ? "var(--up)" : ""; }
  tabs.innerHTML = variants.map(function (v, i) { return '<button>' + v.label + '</button>'; }).join("");
  Array.prototype.forEach.call(tabs.children, function (b, i) { b.onclick = function () { show(i); }; });
  ta.oninput = upd;
  p.querySelector(".thrCopy").onclick = function () { chCopy(ta.value, this); };
  show(thrSeed() % variants.length);
}
