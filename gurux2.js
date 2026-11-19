/* ============================================================
   구루 탭 재구성 (v14.90) — 한 화면에 섞여 있던 '종합 · 개별 · 관리'를 세 칸으로 나눈다
   ① 종합   : 거장 국면(한 숫자) → 유형별 점수 → 22명 한눈에 → 확신 종목 → 함께 움직인 종목 → AI 종합 해석
   ② 인물   : 유형 · 인물 고르기 → 인물 요약 카드 → [해석 | 이번 분기 | 인물 소개]
   ③ 관리   : (운영자) 한 번에 처리 · 앱 점수 반영 · 13F 수집
   계산 · 저장 · 서버 호출은 gurux.js의 함수를 그대로 쓰고, 화면 배치만 새로 한다.
   ============================================================ */
var GY = { tab: "sum", sub: "ai" };
try { var gy0 = JSON.parse(localStorage.getItem("sm.gurux2") || "{}"); if (gy0.tab) GY.tab = gy0.tab; if (gy0.sub) GY.sub = gy0.sub; } catch (e) {}
function gySave() { try { localStorage.setItem("sm.gurux2", JSON.stringify({ tab: GY.tab, sub: GY.sub })); } catch (e) {} }
function gyRiskCls(r) { return r === "확대" || r === "위험 확대" ? "up" : r === "축소" || r === "위험 축소" ? "dn" : ""; }
function gySgn(n, d) { return n == null || !isFinite(n) ? "–" : (n > 0 ? "+" : "") + (d == null ? Math.round(n) : n.toFixed(d)); }
function gyHave() { var o = {}; dsGurus().forEach(function (x) { o[x.id] = x; }); return o; }
function gyTabs(items, cur, attr) { return '<div class="gySeg">' + items.map(function (t) { return '<button type="button" ' + attr + '="' + t[0] + '" class="' + (cur === t[0] ? "on" : "") + '">' + t[1] + (t[2] ? '<small>' + t[2] + '</small>' : '') + '</button>'; }).join("") + '</div>'; }
function gySec(title, sub, body, extra) { return '<section class="gySec' + (extra || "") + '"><header><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</header>' + body + '</section>'; }

/* ---------------- ① 종합 ---------------- */
function gyHero() {
  var R = gxRegime(), TS = gxTypeScores(); if (!R) return '<div class="dvEmpty">거장 자료가 4명 이상 모이면 종합을 계산해요.</div>';
  var up = R.rows.filter(function (r) { return r.f > 0.01; }).length, dn = R.rows.filter(function (r) { return r.f < -0.01; }).length, pos = Math.round((R.score + 100) / 2);
  var lead = R.score <= -25 ? "큰돈은 위험을 줄이는 쪽으로 기울어 있어요" : R.score >= 25 ? "큰돈은 위험을 더 지는 쪽으로 기울어 있어요" : "한쪽으로 쏠리지 않았어요 — 방향보다 '누가 무엇을 바꿨나'를 볼 때예요";
  var tk = GX_TY_ORDER.filter(function (k) { return TS && TS[k]; });
  var h = '<div class="gyHero"><div class="gyHeroL"><span class="gyK">거장 국면 점수</span><div class="gyBig ' + gyRiskCls(R.label) + '">' + gySgn(R.score) + '<small>/ ±100</small></div><span class="gyReg ' + gyRiskCls(R.label) + '">' + R.label + '</span>' +
    '<p class="gyLead">' + lead + '</p><p class="gyMeta">' + R.n + '명 · 순매수 ' + up + '명 · 순매도 ' + dn + '명 · ' + dsQ(R.period) + ' 말 13F 기준</p>' +
    '<div class="gyGauge"><i style="left:' + pos + '%"></i></div><div class="gyGl"><span>위험 축소</span><span>중립</span><span>위험 확대</span></div></div>';
  h += '<div class="gyHeroR"><span class="gyK">유형별 점수</span>' + tk.map(function (k) { var t = TS[k]; return '<button type="button" class="gyTyR" data-gyty="' + k + '" style="--gx:' + GX_TYPES[k].c + '"><span class="n"><i></i>' + GX_TYPES[k].nm + '</span>' + gxBar(t.score) + '<b class="' + (t.score >= 25 ? "pos" : t.score <= -25 ? "neg" : "") + '">' + gySgn(t.score) + '</b><small>' + t.up + '↑ ' + t.dn + '↓</small></button>'; }).join("") + '<p class="gyNote">점수 = 주가 변동을 뺀 실제 순매매 방향(사람마다 ±10%면 끝값). 유형을 누르면 그 유형의 인물만 봐요.</p></div></div>';
  return h;
}
function gyPeopleGrid() {
  var have = gyHave(), D = GXA.doc || { notes: {}, ai: {} };
  return '<div class="gyPg">' + GX_TY_ORDER.map(function (ty) {
    var ids = Object.keys(GX_P).filter(function (id) { return GX_P[id].ty === ty; }); if (!ids.length) return "";
    ids.sort(function (a, b) { return ((have[b] || {}).flow != null ? 1 : 0) - ((have[a] || {}).flow != null ? 1 : 0) || (gxFlow(have[a] || {}) || 0) - (gxFlow(have[b] || {}) || 0); });
    return '<div class="gyPgCol" style="--gx:' + GX_TYPES[ty].c + '"><h4><i></i>' + GX_TYPES[ty].nm + '</h4>' + ids.map(function (id) {
      var g = have[id], f = g ? gxFlow(g) : null, A = D.ai[id], st = gxTodo(id), risk = A && A.risk && A.risk !== "미확인" ? A.risk : null;
      return '<button type="button" class="gyPc' + (g ? "" : " off") + '" data-gyp="' + id + '"><span class="nm">' + gxE(GX_NM[id]) + '</span><span class="fl ' + (f > 0.01 ? "pos" : f < -0.01 ? "neg" : "") + '">' + (f == null ? "13F 없음" : "순매매 " + gySgn(f * 100, 1) + "%") + '</span>' + (risk ? '<span class="gyReg sm ' + gyRiskCls(risk) + '">' + risk + '</span>' : '') + (A && A.head && st.k !== "stale" ? '<span class="hd">' + gxE(A.head) + '</span>' : st.k !== "ok" && g ? '<span class="hd dim">' + gxE(st.t) + '</span>' : '') + '</button>';
    }).join("") + '</div>';
  }).join("") + '</div>';
}
function gyConvHtml() {
  var C = gxConviction(); if (!C.up.length && !C.dn.length) return "";
  var row = function (x) { return '<div class="gyCv"><span class="t">' + gxE(x.t || x.n) + '</span><b class="' + (x.s > 0 ? "pos" : "neg") + '">' + gySgn(x.s, 1) + '</b><span class="w">' + x.who.slice(0, 3).map(function (w) { return gxE(w.nm) + " " + (w.kind === "new" ? "신규" : w.kind === "exit" ? "전량 매도" : gySgn(w.d * 100, 1) + "%p"); }).join(" · ") + '</span></div>'; };
  return '<div class="gy2"><div class="gyBox"><h4 class="pos">비중을 크게 실은 종목</h4>' + (C.up.map(row).join("") || '<p class="gyNote">없음</p>') + '</div><div class="gyBox"><h4 class="neg">비중을 크게 거둔 종목</h4>' + (C.dn.map(row).join("") || '<p class="gyNote">없음</p>') + '</div></div><p class="gyNote">몇 종목에 크게 싣는 집중 투자자(13F 신뢰도 ★★ 이상 · 상위 5종목 30% 이상)가 비중을 0.5%p 넘게 바꾼 종목. 점수 = 비중 변화(%p) × 신뢰도. 다른 유형끼리 같은 종목에 실었다면 더 강한 신호예요.</p>';
}
function gyCrossHtml() {
  var cr = dsCross().filter(function (x) { return x.b.length + x.s.length >= 2; }).sort(function (a, b) { return (b.b.length + b.s.length) - (a.b.length + a.s.length) || Math.abs(b.dv) - Math.abs(a.dv); }).slice(0, 8); if (!cr.length) return "";
  return '<div class="gyX">' + cr.map(function (x) { return '<div class="gyXr"><span class="t">' + gxE(x.t || dsIss(x)) + '</span><span class="b">' + (x.b.length ? '<em class="pos">산 ' + x.b.length + '</em>' : '') + (x.s.length ? '<em class="neg">판 ' + x.s.length + '</em>' : '') + '</span><small>' + gxE([x.b.length ? "산: " + x.b.join(", ") : "", x.s.length ? "판: " + x.s.join(", ") : ""].filter(Boolean).join(" / ")) + '</small></div>'; }).join("") + '</div>';
}
function gySumAiHtml() {
  var SM = GXA.doc && GXA.doc.sum, R = gxRegime(), own = gxOwner(), h = '';
  if (SM) {
    h += '<div class="gyAi"><div class="gyAiH"><b>' + gxE(SM.head) + '</b><span class="gyReg ' + gyRiskCls(SM.risk) + '">위험 ' + gxE(SM.risk) + '</span></div>' + (R && SM.period && SM.period !== R.period ? '<p class="gxStale">이 해석은 ' + dsQ(SM.period) + ' 기준이에요 — 새 분기 자료가 들어왔어요.</p>' : '') + '<p class="gyP">' + gxE(SM.view) + '</p>';
    if ((SM.byType || []).length) h += '<div class="gyTyG">' + SM.byType.map(function (x) { return '<div><div class="m"><b>' + gxE(x.ty) + '</b><span class="gyReg sm ' + gyRiskCls(x.risk) + '">' + gxE(x.risk) + '</span></div><p>' + gxE(x.read) + '</p></div>'; }).join("") + '</div>';
    var two = (SM.agree ? '<div class="gyBox"><h4>유형 사이에 일치하는 것</h4><p class="gyP">' + gxE(SM.agree) + '</p></div>' : '') + (SM.split ? '<div class="gyBox"><h4>엇갈리는 것</h4><p class="gyP">' + gxE(SM.split) + '</p></div>' : ''); if (two) h += '<div class="gy2">' + two + '</div>';
    if ((SM.names || []).length) h += '<h5>눈여겨볼 종목</h5><div class="gyCards">' + SM.names.map(function (x) { return '<div><b>' + gxE(x.t) + '</b><p>' + gxE(x.read) + '</p></div>'; }).join("") + '</div>';
    if ((SM.themes || []).length) h += '<h5>돈이 옮겨 가는 테마</h5><div class="gyChipsV">' + SM.themes.map(function (t) { return '<span>' + gxE(t) + '</span>'; }).join("") + '</div>';
    if ((SM.apply || []).length) h += '<h5>우리는 이렇게 적용한다</h5><div class="gyCards">' + SM.apply.map(function (x) { return '<div><b>' + gxE(x.do) + '</b><p>' + gxE(x.how) + '</p></div>'; }).join("") + '</div>';
    var ul = function (t, a) { return (a || []).length ? '<div class="gyBox"><h4>' + t + '</h4><ul>' + a.map(function (x) { return '<li>' + gxE(x) + '</li>'; }).join("") + '</ul></div>' : ''; }, two2 = ul("이렇게 쓰면 안 된다", SM.dont) + ul("다음 분기에 확인할 것", SM.watch); if (two2) h += '<div class="gy2">' + two2 + '</div>';
    h += '<p class="gyFoot"><b>한계</b> ' + gxE(SM.caveat) + ' · ' + new Date(SM.at).toISOString().slice(0, 10) + (SM.manual ? " 직접 저장" : " 작성") + '</p></div>';
  } else h += '<div class="gyEmpty">' + (own ? "아직 종합 해석이 없어요. 개별 해석을 몇 명 만든 뒤에 만들면 더 탄탄해요." : "아직 종합 해석이 준비되지 않았어요.") + '</div>';
  if (own) h += '<div class="gyAct"><button type="button" class="chip" data-gxsum' + (GXA.busy._sum ? " disabled" : "") + '>' + (GXA.busy._sum ? "종합하는 중…" : SM ? "다시 만들기" : "종합 해석 만들기") + '</button><small>Claude 1회</small></div>' + gxManualHtml("sum", "22명의 요약과 종합 숫자가 프롬프트에 들어 있어요.");
  return h;
}
function gySumTab() {
  var h = gySec("지금 큰돈은 어느 쪽인가", "", gyHero(), " gyFirst");
  h += gySec("22명 한눈에", "유형별로 묶었어요 · 누르면 그 사람의 해석으로 가요 · 순매매 = 주가 변동을 뺀 실제 사고판 방향", gyPeopleGrid());
  var cv = gyConvHtml(); if (cv) h += gySec("확신이 실린 곳 · 거둔 곳", "", cv);
  var cr = gyCrossHtml(); if (cr) h += gySec("여러 거장이 함께 움직인 종목", "최근 13F에서 2명 이상이 같은 분기에 사거나 판 종목", cr);
  h += gySec("AI 종합 해석", "유형별로 무엇이 일치하고 엇갈리는지", gySumAiHtml());
  h += '<details class="gyHow"><summary>숫자는 어떻게 만들었나 · 13F 읽는 법</summary><div><p><b>13F</b> — 미국에서 1억 달러 이상을 굴리는 기관이 분기가 끝나고 45일 안에 내는 보유 주식 보고서. 미국 주식의 매수 포지션만 담기고 공매도 · 채권 · 원자재 · 현금은 빠져요. 지금은 이미 바뀌었을 수 있어요.</p><p><b>순매매</b> — 주식 수가 늘고 준 만큼만 계산한 금액(주식 수 변화 × 분기 말 가격)을 지난 분기 보유액으로 나눈 값. 주가가 올라 평가액이 커진 것은 빼요.</p><p><b>거장 국면 점수</b> — 사람마다 순매매를 -100~+100으로 바꿔 평균. 13F가 생각을 잘 보여 주는 사람(신뢰도 ★ 많은 사람)과 매크로 · 딥밸류 유형에 무게를 더 줘요. 발언 조사나 AI 해석에서 위험 태도가 확인되면 30%(13F 분기 말 뒤의 발언이면 50%) 섞어요.</p><p><b>풋 · 콜</b> — 풋은 내릴 때, 콜은 오를 때 이익이 나는 옵션. 13F의 옵션 금액은 기초자산 값이라 크게 보이고, 보험인지 베팅인지는 알 수 없어요.</p></div></details>';
  return h;
}

/* ---------------- ② 인물 ---------------- */
function gyPick() {
  var have = gyHave(), cnt = function (ty) { return Object.keys(GX_P).filter(function (id) { return ty === "all" || GX_P[id].ty === ty; }).length; };
  var ids = gxIds().sort(function (a, b) { return (have[b] ? 1 : 0) - (have[a] ? 1 : 0); }), cur = gyCur();
  return '<div class="gyPick"><div class="gyChips">' + [["all", "전체"]].concat(GX_TY_ORDER.map(function (k) { return [k, GX_TYPES[k].nm]; })).map(function (t) { return '<button type="button" data-gxty="' + t[0] + '" class="' + (GX.ty === t[0] ? "on" : "") + '"' + (t[0] !== "all" ? ' style="--gx:' + GX_TYPES[t[0]].c + '"' : '') + '>' + (t[0] !== "all" ? '<i></i>' : '') + t[1] + ' <small>' + cnt(t[0]) + '</small></button>'; }).join("") + '</div>' +
    (GX.ty !== "all" ? '<p class="gyTyD" style="--gx:' + GX_TYPES[GX.ty].c + '"><b>' + GX_TYPES[GX.ty].nm + '</b> ' + gxE(GX_TYPES[GX.ty].easy || GX_TYPES[GX.ty].d) + '</p>' : '') +
    '<div class="gyPeople">' + ids.map(function (id) { return '<button type="button" data-gyp="' + id + '" class="' + (id === cur ? "on" : "") + (have[id] ? "" : " off") + '"><i style="background:' + GX_TYPES[GX_P[id].ty].c + '"></i>' + gxE(GX_NM[id]) + '</button>'; }).join("") + '</div></div>';
}
function gyCur() { var have = gyHave(); if (GX.sel && GX_P[GX.sel]) return GX.sel; var id = DS.g && DS.g.id; if (id && GX_P[id] && (GX.ty === "all" || GX_P[id].ty === GX.ty)) return id; var L = gxIds().filter(function (x) { return have[x]; }); return L[0] || gxIds()[0]; }
function gyPersonHead(id, g) {
  var P = GX_P[id], T = GX_TYPES[P.ty], A = GXA.doc && GXA.doc.ai[id], N = GXA.doc && GXA.doc.notes[id], c = g ? gxConc(g) : null, f = g ? gxFlow(g) : null, st = gxTodo(id);
  var h = '<div class="gyPh" style="--gx:' + T.c + '"><div class="gyPhT"><div><h3>' + gxE(GX_NM[id]) + '</h3><span class="org">' + gxE(GX_ORG[id] || (g && g.org) || "") + '</span></div><div class="tags"><span class="gxTy">' + T.nm + '</span>' + (P.ty2 || []).map(function (k) { return '<span class="gxTy2" style="--gx2:' + GX_TYPES[k].c + '">+ ' + GX_TYPES[k].nm + '</span>'; }).join("") + '</div></div>';
  h += '<p class="gyOne">“' + gxE(P.one) + '”</p>';
  h += '<div class="gyKpi">' + [["13F 합계", g ? dsUsd(g.total) : "–"], ["순매매", f == null ? "–" : gySgn(f * 100, 1) + "%", f > 0.01 ? "pos" : f < -0.01 ? "neg" : ""], ["상위 5종목", c ? gxPc(c.t5) : "–"], ["신규 / 전량매도", g ? (g.nNew || 0) + " · " + (g.nExit || 0) : "–"], ["AI 위험 태도", A && A.risk ? A.risk : "–", gyRiskCls(A && A.risk)], ["13F 신뢰도", "★★★".slice(0, P.trust) + "☆☆☆".slice(0, 3 - P.trust)]].map(function (k) { return '<div><span>' + k[0] + '</span><b class="' + (k[2] || "") + '">' + k[1] + '</b></div>'; }).join("") + '</div>';
  if (A && A.head) h += '<div class="gyHl"><span>이번 분기 한 줄</span><b>' + gxE(A.head) + '</b>' + (st.k !== "ok" ? '<em>' + gxE(st.t) + '</em>' : '') + '</div>';
  h += '<p class="gyMeta">' + (g ? dsQ(g.period) + ' 말 기준 · ' + gxE(g.filed) + ' 공개' + (g.prevPeriod ? ' · ' + dsQ(g.prevPeriod) + '와 비교' : '') : '13F를 아직 받지 않았어요') + (N && N.asOf ? ' · 발언 조사 ' + gxE(N.asOf) : '') + '</p></div>';
  return h;
}
function gyHoldHtml(g) {
  var mx = Math.max.apply(null, (g.top || []).map(function (x) { return x.w || 0; }).concat([0.01]));
  var top = '<div class="dsTop">' + (g.top || []).slice(0, 10).map(function (x, i) { var c = x.chg === "new" ? '<span class="dsTag buy">신규</span>' : typeof x.chg === "number" && Math.abs(x.chg) >= 0.01 ? '<span class="' + (x.chg > 0 ? "pos" : "neg") + '">' + dsPct(x.chg, 0) + '</span>' : '<span class="briefDim">유지</span>';
    return '<div class="dsTopR"><span class="dsRank">' + (i + 1) + '</span><span class="dsNm">' + (x.t && dsKo(x.t) ? '<button class="linkBtn" data-dsopen="' + x.t + '">' + dsEsc(dsIss(x)) + '</button>' : dsEsc(dsIss(x))) + (x.t ? '<small>' + x.t + '</small>' : '') + '</span><span class="dsW"><i style="width:' + Math.round((x.w || 0) / mx * 100) + '%"></i></span><b>' + (x.w != null ? (x.w * 100).toFixed(1) + "%" : "-") + '</b><span class="dsChg">' + c + '</span></div>'; }).join("") + '</div>';
  var mv = function (list, cls) { return list.length ? list.slice(0, 8).map(function (m) { return '<div class="dsAgg"><span class="dsNm">' + (m.t && dsKo(m.t) ? '<button class="linkBtn" data-dsopen="' + m.t + '">' + dsEsc(dsIss(m)) + '</button>' : dsEsc(dsIss(m))) + '<small>' + DS_KIND[m.kind] + (m.pw != null || m.w != null ? ' · 비중 ' + gxPc(m.pw || 0, 1) + ' → ' + gxPc(m.w || 0, 1) : '') + '</small></span><b class="' + cls + '">' + dsUsd(m.dv) + '</b></div>'; }).join("") : '<div class="dvNone">없음</div>'; };
  return gySec("가장 많이 들고 있는 종목", "비중 = 13F 미국 주식 합계 대비 · 오른쪽은 주식 수 변화", top) + gySec(dsQ(g.period) + " 사고판 종목", "금액 = 주식 수 변화 × 분기 말 가격", '<div class="dsCols"><div class="dsCol"><div class="dsColH">산 종목</div>' + mv(g.buys || [], "pos") + '</div><div class="dsCol"><div class="dsColH">판 종목</div>' + mv(g.sells || [], "neg") + '</div></div>');
}
function gyQuarterTab(id, g) {
  if (!g) return '<div class="gyEmpty">13F를 아직 받지 않았어요. 관리 칸의 13F 수집(GitHub)을 한 번 돌리면 채워져요.</div>';
  var P = GX_P[id], R = gxRead(g, P), T = GX_TYPES[P.ty];
  var h = gySec(T.nm + " 유형의 눈으로 본 이번 분기", "숫자에서 규칙으로 뽑은 것 · 의도는 13F만으로 확정할 수 없어요", '<div class="gxRead" style="--gx:' + T.c + '">' + R.map(function (r) { return '<div class="gxR"><span class="gxRk">' + gxE(r.k) + '</span><b>' + gxE(r.v) + '</b><p>' + gxE(r.t) + '</p></div>'; }).join("") + '</div>');
  h += gyHoldHtml(g);
  var op = gxOptsHtml(g, P); if (op) h += gySec("옵션 포지션", "금액 = 기초자산 값(실제 건 돈 아님) · 헤지일 수도 있어요", op.replace(/^<div class="mkStep">[\s\S]*?<\/div>/, ""));
  var hi = gxHistHtml(g); if (hi) h += gySec("분기별 흐름", "합계 · 종목 수 · 상위 5 비중 · 상위 종목", hi.replace(/^<div class="mkStep">[\s\S]*?<\/div>/, ""));
  return h;
}
function gyAiTab(id, g) { return '<div class="gxAiWrap gyAiWrap">' + gxAiHtml(id, g) + '</div>'; }
function gyBioTab(id) {
  var P = GX_P[id], T = GX_TYPES[P.ty];
  return gxProfileHtml(id).replace(/<div class="gxTop">[\s\S]*?<\/div><p class="gxOne">[\s\S]*?<\/p>/, "") + '<div class="gxApply" style="--gx:' + T.c + '"><h5>우리는 여기서 무엇을 얻나</h5><p>' + gxE(P.learn) + '</p><p class="briefDim">' + gxE(T.use) + '</p></div>';
}
function gyWhoTab() {
  var have = gyHave(), id = gyCur(); if (!id) return '<div class="dvEmpty">인물이 없어요</div>'; var g = have[id];
  if (g && DS.g.id !== id) { DS.g.id = id; try { dsSave(); } catch (e) {} }
  var h = gyPick() + gyPersonHead(id, g), A = GXA.doc && GXA.doc.ai[id];
  h += gyTabs([["ai", "해석", A ? "" : "없음"], ["q", "이번 분기 숫자"], ["bio", "인물 소개"]], GY.sub, "data-gysub");
  h += '<div class="gyBody">' + (GY.sub === "q" ? gyQuarterTab(id, g) : GY.sub === "bio" ? gyBioTab(id) : gyAiTab(id, g)) + '</div>';
  return h;
}

/* ---------------- ③ 관리 ---------------- */
function gyAdminTab() {
  var h = '';
  if (gxOwner()) h += gySec("한 번에 처리", "여러 명의 발언 조사 + 해석을 서버 자동 또는 묶음 프롬프트로", gxJobHtml().replace(/^<h5 class="gxH5">[\s\S]*?<\/h5>/, ""));
  h += gySec("앱 점수에 반영", "거장 점수를 기준으로 순위 · 평가표 · 본질 · 변수의 계산 비율을 옮겨요", gxCfgHtml());
  if (gxOwner()) h += gySec("13F 수집", "SEC는 Vercel 서버를 막아 두어서 GitHub Actions의 'SEC 13F 수집'이 주로 받아요(매주 화요일 08:13 자동)", '<div class="gyAct"><button class="chip" data-ds-run="1">지금 수집(서버)</button><span class="dsRunMsg briefDim">공시(DART)와 13F를 이어서 받아요 · 13F는 SEC가 막으면 실패할 수 있어요</span></div>');
  return h;
}

/* ---------------- 그리기 ---------------- */
function gyRender() {
  var box = document.getElementById("guruBody"); if (!box) return;
  if (!DS.guru) { box.innerHTML = '<div class="dvEmpty">투자자 보고서를 불러오는 중…</div>'; dsEnsure().then(gyRender); return; }
  if (!GXA.doc) { box.innerHTML = '<div class="dvEmpty">해석 자료를 불러오는 중…</div>'; gxAiLoad().then(gyRender); return; }
  var hb = document.querySelector("#guruCard > .dsRunBar"); if (hb) hb.parentNode.removeChild(hb);   // 수집 버튼은 관리 칸으로 옮겼다
  var own = gxOwner();
  var R = gxRegime(), tabs = [["sum", "종합", R ? R.label + " " + gySgn(R.score) : ""], ["who", "인물", Object.keys(GX_P).length + "명"], ["admin", own ? "관리" : "점수 반영", own ? "처리 · 점수 반영" : ""]];
  var h = '<div class="gyTop">' + gyTabs(tabs, GY.tab, "data-gytab") + '</div><div class="gyPane">' + (GY.tab === "who" ? gyWhoTab() : GY.tab === "admin" ? gyAdminTab() : gySumTab()) + '</div>';
  box.innerHTML = h; gyBind(box);
}
function gyBind(box) {
  var q = function (s) { return box.querySelectorAll(s); }, each = function (s, f) { Array.prototype.forEach.call(q(s), f); };
  each("[data-gytab]", function (b) { b.onclick = function () { GY.tab = b.getAttribute("data-gytab"); gySave(); gyRender(); box.scrollIntoView({ block: "start", behavior: "smooth" }); }; });
  each("[data-gysub]", function (b) { b.onclick = function () { GY.sub = b.getAttribute("data-gysub"); gySave(); gyRender(); }; });
  each("[data-gyp]", function (b) { b.onclick = function () { var id = b.getAttribute("data-gyp"), have = gyHave(); if (have[id]) { GX.sel = null; DS.g.id = id; try { dsSave(); } catch (e) {} } else GX.sel = id; if (GX.ty !== "all" && GX_P[id].ty !== GX.ty) GX.ty = "all"; GY.tab = "who"; gySave(); gxSave(); gyRender(); var pb = box.querySelector(".gyPh"); if (pb && b.closest(".gyPg")) pb.scrollIntoView({ block: "start", behavior: "smooth" }); }; });
  each("[data-gxty]", function (b) { b.onclick = function () { GX.ty = b.getAttribute("data-gxty"); GX.sel = null; gxSave(); gyRender(); }; });
  each("[data-gyty]", function (b) { b.onclick = function () { GX.ty = b.getAttribute("data-gyty"); GX.sel = null; GY.tab = "who"; gxSave(); gySave(); gyRender(); }; });
  if (typeof dsBindOpen === "function") dsBindOpen(box);
  var pane = box.querySelector(".gyPane");
  if (GY.tab === "sum") { var sb = box.querySelector("[data-gxsum]"); if (sb) sb.onclick = function () { GXA.busy._sum = 1; gyRender(); gxApi({ sum: 1, ctx: gxSumCtx(), people: gxPeople() }).then(function (j) { delete GXA.busy._sum; if (!j || !j.ok) gxToast((j && (j.msg || j.reason)) || "실패했어요", "bad"); else { GXA.doc.sum = j.sum; gxToast("종합 해석을 만들었어요"); } gyRender(); }); };
    gxManualBind(pane, function () { return { ctx: gxSumCtx(), people: gxPeople() }; }, function (k, j) { if (j.sum) GXA.doc.sum = j.sum; gyRender(); }); }
  if (GY.tab === "who") { var id = gyCur(), w = box.querySelector(".gyAiWrap"); if (w) gxAiBind(w, id); }
  if (GY.tab === "admin") { gxCfgBind(pane, gyRender); try { gxJobBind(pane); } catch (e) {} if (gxOwner() && !GXA._jl) { GXA._jl = 1; gxJobLoad().then(gyRender); } }
}
/* 기존 그리기를 바꾼다 — gurux.js의 버튼 처리(renderGuru 호출)도 이 화면을 다시 그린다 */
(function () {
  renderGuru = gyRender;
  var st = document.createElement("style"); st.textContent =
    "#guruBody{--gyline:var(--line,#e6e9ef);--gysoft:var(--soft,#f5f6f8)}" +
    ".gyTop{position:sticky;top:0;z-index:5;background:var(--card,#fff);padding:4px 0 10px;margin-bottom:6px}.gySeg{display:flex;gap:4px;background:var(--gysoft);border-radius:12px;padding:4px}.gySeg button{flex:1;border:0;background:transparent;border-radius:9px;padding:9px 8px;font-size:14px;font-weight:700;color:var(--sub,#6b7684);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1.25}.gySeg button small{font-size:11.5px;font-weight:600;opacity:.75}.gySeg button.on{background:var(--card,#fff);color:var(--txt,#191f28);box-shadow:0 1px 3px rgba(0,0,0,.08)}" +
    ".gyBody .gySeg,.gyPane>.gySeg{margin:14px 0 4px}.gySec{margin:22px 0 0}.gySec.gyFirst{margin-top:6px}.gySec>header{margin-bottom:10px}.gySec h3{margin:0;font-size:16.5px;font-weight:800;letter-spacing:-.3px}.gySec>header p{margin:3px 0 0;font-size:12.5px;color:var(--sub,#8b95a1);line-height:1.5;word-break:keep-all}" +
    ".gyHero{display:grid;grid-template-columns:1fr 1fr;gap:14px}.gyHeroL,.gyHeroR{border:1px solid var(--gyline);border-radius:14px;padding:16px 18px;background:var(--card,#fff)}.gyK{font-size:12px;font-weight:800;color:var(--sub,#8b95a1);letter-spacing:.2px}.gyBig{font-size:44px;font-weight:900;letter-spacing:-1.5px;line-height:1.1;margin:6px 0 6px;font-variant-numeric:tabular-nums}.gyBig small{font-size:14px;font-weight:600;color:var(--sub,#8b95a1);margin-left:6px;letter-spacing:0}.gyBig.up{color:var(--up,#f04452)}.gyBig.dn{color:var(--down,#3182f6)}" +
    ".gyReg{display:inline-block;font-size:12.5px;font-weight:800;padding:3px 10px;border-radius:7px;background:#eceff3;color:#4e5968;white-space:nowrap}.gyReg.up{background:#fde8ea;color:var(--up,#f04452)}.gyReg.dn{background:#e3eefe;color:var(--down,#3182f6)}.gyReg.sm{font-size:11px;padding:1px 7px;border-radius:5px}" +
    ".gyLead{font-size:15.5px;font-weight:700;line-height:1.6;margin:10px 0 4px;word-break:keep-all}.gyMeta{font-size:12.5px;color:var(--sub,#8b95a1);margin:4px 0 0}.gyGauge{position:relative;height:10px;border-radius:5px;margin-top:14px;background:linear-gradient(90deg,#3182f6 0%,#dfe5ee 42%,#dfe5ee 58%,#f04452 100%)}.gyGauge i{position:absolute;top:-4px;width:4px;height:18px;margin-left:-2px;background:var(--txt,#191f28);border-radius:2px}.gyGl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--sub,#8b95a1);margin-top:5px}" +
    ".gyTyR{display:grid;grid-template-columns:128px 1fr 40px 54px;gap:10px;align-items:center;width:100%;border:0;background:transparent;padding:9px 4px;border-bottom:1px solid var(--gyline);font:inherit;font-size:13.5px;cursor:pointer;text-align:left;color:var(--txt,#191f28)}.gyTyR:hover{background:var(--gysoft)}.gyTyR .n{font-weight:700;white-space:nowrap}.gyTyR i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gx);margin-right:7px}.gyTyR b{text-align:right;font-variant-numeric:tabular-nums}.gyTyR small{color:var(--sub,#8b95a1);font-size:12px;text-align:right}.gyNote{font-size:12px;color:var(--sub,#8b95a1);line-height:1.6;margin:8px 0 0;word-break:keep-all}" +
    "#guruBody .pos{color:var(--up,#f04452)}#guruBody .neg{color:var(--down,#3182f6)}" +
    ".gyPg{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.gyPgCol h4{margin:0 0 6px;font-size:12.5px;font-weight:800;display:flex;align-items:center;gap:6px;color:var(--txt2,#4e5968)}.gyPgCol h4 i{width:8px;height:8px;border-radius:50%;background:var(--gx)}.gyPc{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;text-align:left;border:1px solid var(--gyline);border-left:3px solid var(--gx);border-radius:9px;padding:9px 10px;margin-bottom:6px;background:var(--card,#fff);cursor:pointer;font:inherit;color:var(--txt,#191f28)}.gyPc:hover{border-color:var(--gx)}.gyPc.off{opacity:.55}.gyPc .nm{font-size:13.5px;font-weight:800}.gyPc .fl{font-size:12px;font-weight:700;color:var(--sub,#8b95a1)}.gyPc .hd{font-size:12px;line-height:1.45;color:var(--txt2,#4e5968);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}.gyPc .hd.dim{color:#c9772b;font-weight:700}" +
    ".gy2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gyBox{border:1px solid var(--gyline);border-radius:12px;padding:12px 14px;background:var(--card,#fff)}.gyBox h4{margin:0 0 8px;font-size:13px;font-weight:800}.gyBox ul{margin:0;padding-left:16px}.gyBox li{font-size:13px;line-height:1.65;word-break:keep-all}.gyCv{display:grid;grid-template-columns:64px 46px 1fr;gap:8px;font-size:13px;padding:6px 0;border-bottom:1px solid var(--gyline);align-items:baseline}.gyCv:last-child{border-bottom:0}.gyCv .t{font-weight:800}.gyCv b{text-align:right;font-variant-numeric:tabular-nums}.gyCv .w{font-size:12px;color:var(--sub,#8b95a1)}" +
    ".gyX{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.gyXr{display:grid;grid-template-columns:70px 96px 1fr;gap:8px;align-items:baseline;font-size:13px;padding:7px 0;border-bottom:1px solid var(--gyline)}.gyXr .t{font-weight:800}.gyXr em{font-style:normal;font-size:11.5px;font-weight:800;margin-right:6px}.gyXr small{font-size:12px;color:var(--sub,#8b95a1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".gyAi{border:1px solid var(--gyline);border-radius:14px;padding:16px 18px;background:var(--card,#fff)}.gyAiH{display:flex;justify-content:space-between;gap:10px;align-items:center}.gyAiH b{font-size:17px;letter-spacing:-.3px;word-break:keep-all}.gyP{font-size:14px;line-height:1.75;margin:8px 0 12px;word-break:keep-all}.gyBox .gyP{margin:0}.gyAi h5{margin:14px 0 8px;font-size:13px;font-weight:800}.gyTyG{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-bottom:12px}.gyTyG>div{background:var(--gysoft);border-radius:10px;padding:10px 12px}.gyTyG .m{display:flex;justify-content:space-between;align-items:center;gap:8px}.gyTyG p{margin:5px 0 0;font-size:13px;line-height:1.6;word-break:keep-all}" +
    ".gyCards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}.gyCards>div{border:1px solid var(--gyline);border-radius:10px;padding:10px 12px}.gyCards b{font-size:13.5px}.gyCards p{margin:4px 0 0;font-size:13px;line-height:1.6;word-break:keep-all}.gyChipsV{display:flex;flex-wrap:wrap;gap:6px}.gyChipsV span{background:var(--gysoft);border-radius:999px;padding:4px 11px;font-size:12.5px;font-weight:700}.gyFoot{margin:14px 0 0;padding-top:10px;border-top:1px dashed var(--gyline);font-size:12.5px;color:var(--sub,#8b95a1);line-height:1.6}.gyFoot b{color:var(--txt2,#4e5968)}" +
    ".gyEmpty{padding:16px;border:1px dashed var(--gyline);border-radius:12px;font-size:13.5px;color:var(--sub,#8b95a1);text-align:center}.gyAct{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}.gyAct small{color:var(--sub,#8b95a1);font-size:12px}.gyHow{margin:24px 0 4px;font-size:13px;border-top:1px solid var(--gyline);padding-top:12px}.gyHow summary{cursor:pointer;font-weight:700;color:var(--sub,#6b7684)}.gyHow p{line-height:1.7;color:var(--txt2,#4e5968);margin:8px 0;word-break:keep-all}" +
    ".gyPick{margin-bottom:12px}.gyChips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.gyChips button{flex:0 0 auto;border:1px solid var(--gyline);background:var(--card,#fff);color:var(--txt2,#4e5968);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;gap:6px;align-items:center}.gyChips button i{width:8px;height:8px;border-radius:50%;background:var(--gx)}.gyChips button small{opacity:.6;font-weight:600}.gyChips button.on{background:var(--txt,#191f28);color:#fff;border-color:var(--txt,#191f28)}" +
    ".gyTyD{margin:8px 0 0;padding:8px 12px;border-left:3px solid var(--gx);background:var(--gysoft);border-radius:0 8px 8px 0;font-size:13px;line-height:1.6;word-break:keep-all}.gyTyD b{color:var(--gx);margin-right:4px}.gyPeople{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.gyPeople button{border:1px solid var(--gyline);background:var(--card,#fff);border-radius:8px;padding:6px 10px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;gap:6px;align-items:center;color:var(--txt,#191f28)}.gyPeople button i{width:7px;height:7px;border-radius:50%}.gyPeople button.on{background:var(--txt,#191f28);color:#fff;border-color:var(--txt,#191f28)}.gyPeople button.off{opacity:.5}" +
    ".gyPh{border:1px solid var(--gyline);border-top:4px solid var(--gx);border-radius:14px;padding:16px 18px;background:var(--card,#fff)}.gyPhT{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.gyPhT h3{margin:0;font-size:21px;font-weight:900;letter-spacing:-.5px}.gyPhT .org{font-size:13px;color:var(--sub,#8b95a1)}.gyPhT .tags{display:flex;gap:6px;flex-wrap:wrap}.gyOne{margin:10px 0 12px;font-size:15px;font-weight:700;line-height:1.55;word-break:keep-all;color:var(--txt2,#333d4b)}" +
    ".gyKpi{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.gyKpi>div{background:var(--gysoft);border-radius:10px;padding:9px 11px}.gyKpi span{display:block;font-size:11.5px;color:var(--sub,#8b95a1);font-weight:700}.gyKpi b{display:block;font-size:16px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}.gyKpi b.up{color:var(--up,#f04452)}.gyKpi b.dn{color:var(--down,#3182f6)}" +
    ".gyHl{margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--gysoft);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.gyHl span{font-size:12px;font-weight:800;color:var(--sub,#8b95a1)}.gyHl b{font-size:14.5px;word-break:keep-all;flex:1}.gyHl em{font-style:normal;font-size:11.5px;font-weight:800;color:#c9772b;background:#fbf1d9;border-radius:5px;padding:2px 7px}" +
    ".gyBody{margin-top:6px}.gyBody .gxCard{border-top:0;padding-top:4px}.gyAiWrap>.mkStep:first-child{margin-top:4px}" +
    "@media screen and (max-width:900px){.gyPg{grid-template-columns:repeat(2,minmax(0,1fr))}.gyKpi{grid-template-columns:repeat(3,minmax(0,1fr))}}" +
    "@media screen and (max-width:640px){.gyHero,.gy2,.gyX{grid-template-columns:1fr}.gyBig{font-size:38px}.gyTyR{grid-template-columns:110px 1fr 34px}.gyTyR small{display:none}.gySeg button{font-size:13px;padding:8px 4px}.gySeg button small{font-size:10.5px}.gyXr{grid-template-columns:60px 80px}.gyXr small{grid-column:1 / -1;white-space:normal}.gyPhT h3{font-size:19px}}";
  document.head.appendChild(st);
})();
