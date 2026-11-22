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
    '<p class="gyLead">' + lead + '</p><p class="gyMeta">' + R.n + '명 · 순매수 ' + up + '명 · 순매도 ' + dn + '명 · ' + dsQ(R.period) + ' 말 13F 기준' + (R.nv ? ' · 발언형 ' + R.nv + '명의 위험 태도 포함' : '') + '</p>' +
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
      if (GX_P[id].voice) { var N = D.notes[id], nv = N && (N.views || []).length, sr = N && N.stance && N.stance.risk !== "미확인" ? N.stance.risk : null;   // v15.00 발언형 — 13F 대신 발언으로
        return '<button type="button" class="gyPc' + (N && N.at ? "" : " off") + '" data-gyp="' + id + '"><span class="nm">' + gxE(GX_NM[id]) + '<em class="gyVb">발언</em></span><span class="fl">' + (N && N.at ? "발언 " + nv + "건 · " + gxE(N.asOf || "") : "발언 조사 전") + '</span>' + (sr ? '<span class="gyReg sm ' + gyRiskCls(sr) + '">' + sr + '</span>' : '') + (N && (N.themes || []).length ? '<span class="hd">' + N.themes.slice(0, 3).map(gxE).join(" · ") + '</span>' : '') + '</button>'; }
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
  if (own) h += '<div class="gyAct"><button type="button" class="chip" data-gxsum' + (GXA.busy._sum ? " disabled" : "") + '>' + (GXA.busy._sum ? "종합하는 중…" : SM ? "다시 만들기" : "종합 해석 만들기") + '</button><small>Claude 1회</small></div>' + gxManualHtml("sum", Object.keys(GX_P).length + "명의 요약과 종합 숫자가 프롬프트에 들어 있어요.");
  return h;
}
function gySumTab() {
  var h = gySec("지금 큰돈은 어느 쪽인가", "", gyHero(), " gyFirst");
  h += gySec(Object.keys(GX_P).length + "명 한눈에", "유형별로 묶었어요 · 누르면 그 사람의 해석으로 가요 · 순매매 = 주가 변동을 뺀 실제 사고판 방향 · '발언' 표시는 13F 없이 발언으로만 읽는 사람", gyPeopleGrid());
  /* v15.00 전문가처럼 쓰기 — 활용 지도 · 복제 적합도 · 합의와 쏠림 (gurux3.js) */
  var um = typeof gzUseHtml === "function" ? gzUseHtml() : ""; if (um) h += gySec("전문가는 거장을 이렇게 쓴다", "따라 사지 않고, 사람마다 다른 곳을 읽어요 — 다섯 가지 원칙과 유형별 쓰임", um);
  var ft = typeof gzFitHtml === "function" ? gzFitHtml() : ""; if (ft) h += gySec("누구의 13F를 따라갈 수 있나", "복제 적합도 — 13F가 늦게 나와도 쓸모 있는 '느린 손'인지 기록으로 계산 · 누르면 그 사람으로 가요", ft);
  var cv = gyConvHtml(); if (cv) h += gySec("확신이 실린 곳 · 거둔 곳", "", cv);
  var cs = typeof gzConsHtml === "function" ? gzConsHtml() : ""; if (cs) h += gySec("거장들이 함께 들고 있는 종목", "합의이자 쏠림 — 평소에는 순풍, 팔 때는 같이 팔려요", cs);
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
    '<div class="gyPeople">' + ids.map(function (id) { return '<button type="button" data-gyp="' + id + '" class="' + (id === cur ? "on" : "") + (have[id] || GX_P[id].voice ? "" : " off") + '"><i style="background:' + GX_TYPES[GX_P[id].ty].c + '"></i>' + gxE(GX_NM[id]) + (GX_P[id].voice ? '<em class="gyVb">발언</em>' : '') + '</button>'; }).join("") + '</div></div>';
}
function gyCur() { var have = gyHave(); if (GX.sel && GX_P[GX.sel]) return GX.sel; var id = DS.g && DS.g.id; if (id && GX_P[id] && (GX.ty === "all" || GX_P[id].ty === GX.ty)) return id; var L = gxIds().filter(function (x) { return have[x]; }); return L[0] || gxIds()[0]; }
function gyPersonHead(id, g) {
  var P = GX_P[id], T = GX_TYPES[P.ty], A = GXA.doc && GXA.doc.ai[id], N = GXA.doc && GXA.doc.notes[id], c = g ? gxConc(g) : null, f = g ? gxFlow(g) : null, st = gxTodo(id);
  var h = '<div class="gyPh" style="--gx:' + T.c + '"><div class="gyPhT"><div><h3>' + gxE(GX_NM[id]) + '</h3><span class="org">' + gxE(GX_ORG[id] || (g && g.org) || "") + '</span></div><div class="tags"><span class="gxTy">' + T.nm + '</span>' + (P.ty2 || []).map(function (k) { return '<span class="gxTy2" style="--gx2:' + GX_TYPES[k].c + '">+ ' + GX_TYPES[k].nm + '</span>'; }).join("") + '</div></div>';
  h += '<p class="gyOne">“' + gxE(P.one) + '”</p>';
  var cf = null; try { cf = typeof gxCloneFit === "function" ? gxCloneFit(id) : null; } catch (e) {}
  var sr = N && N.stance && N.stance.risk && N.stance.risk !== "미확인" ? N.stance.risk : null, sig = typeof GZ_P !== "undefined" && GZ_P[id] ? GZ_CH[GZ_P[id].sig[0]] : "–";
  var K = P.voice ? [["읽는 방법", "발언"], ["발언 위험 태도", sr || "–", gyRiskCls(sr)], ["확인된 발언", N && N.at ? ((N.views || []).length + "건") : "–"], ["발언 조사", N && N.asOf ? N.asOf.slice(5) : "–"], ["주 무대", sig], ["13F", "읽지 않음"]]
    : [["13F 합계", g ? dsUsd(g.total) : "–"], ["순매매", f == null ? "–" : gySgn(f * 100, 1) + "%", f > 0.01 ? "pos" : f < -0.01 ? "neg" : ""], ["상위 5종목", c ? gxPc(c.t5) : "–"], ["신규 / 전량매도", g ? (g.nNew || 0) + " · " + (g.nExit || 0) : "–"], ["AI 위험 태도", A && A.risk ? A.risk : "–", gyRiskCls(A && A.risk)], cf ? ["복제 적합도", cf.s + '<small class="gzLv ' + cf.cls + '">' + cf.label + '</small>'] : ["13F 신뢰도", "★★★".slice(0, P.trust) + "☆☆☆".slice(0, 3 - P.trust)]];
  h += '<div class="gyKpi">' + K.map(function (k) { return '<div><span>' + k[0] + '</span><b class="' + (k[2] || "") + '">' + k[1] + '</b></div>'; }).join("") + '</div>';
  if (A && A.head && !P.voice) h += '<div class="gyHl"><span>이번 분기 한 줄</span><b>' + gxE(A.head) + '</b>' + (st.k !== "ok" ? '<em>' + gxE(st.t) + '</em>' : '') + '</div>';
  h += '<p class="gyMeta">' + (P.voice ? '13F로 읽지 않는 발언형이에요' : g ? dsQ(g.period) + ' 말 기준 · ' + gxE(g.filed) + ' 공개' + (g.prevPeriod ? ' · ' + dsQ(g.prevPeriod) + '와 비교' : '') : '13F를 아직 받지 않았어요') + (N && N.asOf ? ' · 발언 조사 ' + gxE(N.asOf) : '') + '</p></div>';
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
  var bd = typeof gzBandHtml === "function" ? gzBandHtml(id, g) : ""; if (bd) { var bs = gySec("이번 분기에 산 종목 — 그때 가격대와 지금", "거장이 산 구간보다 지금이 싼가 비싼가", bd), mk = '<section class="gySec"><header><h3>가장 많이 들고 있는 종목', at = h.indexOf(mk); h = at >= 0 ? h.slice(0, at) + bs + h.slice(at) : h + bs; }   // 가격에 $가 들어 있어 replace의 치환 문자열로 쓰지 않는다
  return h;
}
function gyAiTab(id, g) { return '<div class="gxAiWrap gyAiWrap">' + gxAiHtml(id, g) + '</div>'; }
function gyBioTab(id) {
  var P = GX_P[id], T = GX_TYPES[P.ty];
  return (typeof gzProHtml === "function" ? gzProHtml(id) : "") + gxProfileHtml(id).replace(/<div class="gxTop">[\s\S]*?<\/div><p class="gxOne">[\s\S]*?<\/p>/, "") + '<div class="gxApply" style="--gx:' + T.c + '"><h5>우리는 여기서 무엇을 얻나</h5><p>' + gxE(P.learn) + '</p><p class="briefDim">' + gxE(T.use) + '</p></div>';
}
function gyWhoTab() {
  var have = gyHave(), id = gyCur(); if (!id) return '<div class="dvEmpty">인물이 없어요</div>'; var g = have[id];
  if (g && DS.g.id !== id) { DS.g.id = id; try { dsSave(); } catch (e) {} }
  var h = gyPick() + gyPersonHead(id, g), A = GXA.doc && GXA.doc.ai[id];
  var V = !!GX_P[id].voice, sub = V && GY.sub === "q" ? "ai" : GY.sub, Nn = GXA.doc && GXA.doc.notes[id];
  h += gyTabs(V ? [["ai", "발언", Nn && Nn.at ? "" : "없음"], ["bio", "인물 소개 · 쓰임"]] : [["ai", "해석", A ? "" : "없음"], ["q", "이번 분기 숫자"], ["bio", "인물 소개 · 쓰임"]], sub, "data-gysub");
  h += '<div class="gyBody">' + (sub === "q" ? gyQuarterTab(id, g) : sub === "bio" ? gyBioTab(id) : gyAiTab(id, g)) + '</div>';
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
  each("[data-gyp]", function (b) { b.onclick = function () { var id = b.getAttribute("data-gyp"), have = gyHave(); if (have[id]) { GX.sel = null; DS.g.id = id; try { dsSave(); } catch (e) {} } else GX.sel = id; if (GX.ty !== "all" && GX_P[id].ty !== GX.ty) GX.ty = "all"; GY.tab = "who"; gySave(); gxSave(); gyRender(); var pb = box.querySelector(".gyPh"); if (pb && (b.closest(".gyPg") || b.closest(".gzFit") || b.closest(".gzPl"))) pb.scrollIntoView({ block: "start", behavior: "smooth" }); }; });
  each("[data-gxty]", function (b) { b.onclick = function () { GX.ty = b.getAttribute("data-gxty"); GX.sel = null; gxSave(); gyRender(); }; });
  each("[data-gyty]", function (b) { b.onclick = function () { GX.ty = b.getAttribute("data-gyty"); GX.sel = null; GY.tab = "who"; gxSave(); gySave(); gyRender(); }; });
  if (typeof dsBindOpen === "function") dsBindOpen(box);
  var pane = box.querySelector(".gyPane");
  if (GY.tab === "sum") { var sb = box.querySelector("[data-gxsum]"); if (sb) sb.onclick = function () { GXA.busy._sum = 1; gyRender(); gxApi({ sum: 1, ctx: gxSumCtx(), people: gxPeople() }).then(function (j) { delete GXA.busy._sum; if (!j || !j.ok) gxToast((j && (j.msg || j.reason)) || "실패했어요", "bad"); else { GXA.doc.sum = j.sum; gxToast("종합 해석을 만들었어요"); } gyRender(); }); };
    gxManualBind(pane, function () { return { ctx: gxSumCtx(), people: gxPeople() }; }, function (k, j) { if (j.sum) GXA.doc.sum = j.sum; gyRender(); }); }
  if (GY.tab === "who") { var id = gyCur(), w = box.querySelector(".gyAiWrap"); if (w) gxAiBind(w, id); }
  if (typeof gzBind === "function") { try { gzBind(box); } catch (e) {} }
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
    ".gyReg{display:inline-block;font-size:12.5px;font-weight:800;padding:3px 10px;border-radius:7px;background:#eceff3;color:#4e5968;white-space:nowrap}.gyReg.up{background:var(--k-fde8ea,#fde8ea);color:var(--up,#f04452)}.gyReg.dn{background:var(--downSoft,#ebf2fd);color:var(--down,#3182f6)}.gyReg.sm{font-size:11px;padding:1px 7px;border-radius:5px}" +
    ".gyLead{font-size:15.5px;font-weight:700;line-height:1.6;margin:10px 0 4px;word-break:keep-all}.gyMeta{font-size:12.5px;color:var(--sub,#8b95a1);margin:4px 0 0}.gyGauge{position:relative;height:10px;border-radius:5px;margin-top:14px;background:linear-gradient(90deg,var(--down,#2f6fd6) 0%,#dfe5ee 42%,#dfe5ee 58%,var(--up,#d9342b) 100%)}.gyGauge i{position:absolute;top:-4px;width:4px;height:18px;margin-left:-2px;background:var(--txt,#191f28);border-radius:2px}.gyGl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--sub,#8b95a1);margin-top:5px}" +
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

/* ============================================================
   v14.91 디자인 정리 — 종목명이 줄바꿈 · 말줄임(…)으로 잘리지 않게, 관리 칸(한 번에 처리 · 점수 반영)을 단계형으로
   ============================================================ */
/* 종목 이름: 한글명이 있으면 한글, 없으면 정리한 영문 — 줄을 바꾸지 않고 통째로 보여 준다(티커는 작은 글씨로) */
function gyNm(x) { var t = x.t || null, ko = t && typeof dsKo === "function" ? dsKo(t) : null, nm = ko || (typeof dsIss === "function" ? dsIss(x) : x.n) || t || ""; return '<span class="gyNm"><b>' + gxE(nm) + '</b>' + (t && t !== nm ? '<small>' + gxE(t) + '</small>' : '') + '</span>'; }
function gyWho(list, kind) { return '<div class="gyWho">' + list.map(function (w) { return '<span class="' + (kind ? kind(w) : "") + '">' + w.html + '</span>'; }).join("") + '</div>'; }
/* 막대 — -100~+100, 가운데가 0 */
function gyBar(sc) { var p = Math.max(-100, Math.min(100, sc || 0)) / 2; return '<span class="gyBarT"><span class="z"></span><span class="f ' + (sc >= 25 ? "up" : sc <= -25 ? "dn" : "") + '" style="left:' + (p < 0 ? 50 + p : 50) + '%;width:' + Math.abs(p) + '%"></span></span>'; }
gxBar = gyBar;

gyConvHtml = function () {
  var C = gxConviction(); if (!C.up.length && !C.dn.length) return "";
  var row = function (x) { return '<div class="gyLi"><div class="gyLiT">' + gyNm(x) + '<span class="gyPill ' + (x.s > 0 ? "up" : "dn") + '">' + gySgn(x.s, 1) + '</span></div>' + gyWho(x.who.slice(0, 4).map(function (w) { return { html: gxE(w.nm) + ' <b>' + (w.kind === "new" ? "신규" : w.kind === "exit" ? "전량 매도" : gySgn(w.d * 100, 1) + "%p") + '</b>', d: w.d, kind: w.kind }; }), function (w) { return w.d > 0 ? "up" : "dn"; }) + '</div>'; };
  return '<div class="gy2"><div class="gyCard"><h4><span class="dot up"></span>비중을 크게 실은 종목</h4>' + (C.up.map(row).join("") || '<p class="gyNote">없음</p>') + '</div><div class="gyCard"><h4><span class="dot dn"></span>비중을 크게 거둔 종목</h4>' + (C.dn.map(row).join("") || '<p class="gyNote">없음</p>') + '</div></div><p class="gyNote">집중 투자자(13F 신뢰도 ★★ 이상 · 상위 5종목 30% 이상)가 비중을 0.5%p 넘게 바꾼 종목. 점수 = 비중 변화(%p) × 신뢰도. 다른 유형끼리 같은 종목에 실었다면 더 강한 신호예요.</p>';
};
gyCrossHtml = function () {
  var cr = dsCross().filter(function (x) { return x.b.length + x.s.length >= 2; }).sort(function (a, b) { return (b.b.length + b.s.length) - (a.b.length + a.s.length) || Math.abs(b.dv) - Math.abs(a.dv); }).slice(0, 8); if (!cr.length) return "";
  return '<div class="gyGrid2">' + cr.map(function (x) { return '<div class="gyCard gyLi"><div class="gyLiT">' + gyNm(x) + '<span class="gyBadges">' + (x.b.length ? '<span class="gyPill up">산 ' + x.b.length + '명</span>' : '') + (x.s.length ? '<span class="gyPill dn">판 ' + x.s.length + '명</span>' : '') + '</span></div>' + gyWho(x.b.map(function (n) { return { html: gxE(n), c: "up" }; }).concat(x.s.map(function (n) { return { html: gxE(n), c: "dn" }; })), function (w) { return w.c; }) + '</div>'; }).join("") + '</div>';
};
/* 22명 카드 — 해석 한 줄을 자르지 않는다 */
gyPeopleGrid = (function (f0) { return function () { return f0().replace(/class="gyPg"/, 'class="gyPg gyPg2"'); }; })(gyPeopleGrid);

/* ---------- 관리 ① 한 번에 처리 (단계형) ---------- */
function gyJobHtml() {
  if (!gxOwner()) return ""; var S = gxSel(), J = GXA.job, run = J && J.job && !J.done && !J.stale, sel = Object.keys(GX_P).filter(function (id) { return S[id]; }), n = sel.length;
  /* v14.92 상태를 세 가지로 — 완료(최신) · 할 일 · 13F 없음. 진행 중인 작업이 있으면 그 상태가 우선 */
  var STC = { done: ["완료", "✓"], todo: ["할 일", "!"], wait: ["13F 없음", "–"], run: ["진행 중", "…"], fail: ["실패", "×"] };
  var stOf = function (id) { var T = gxTodo(id), r = J && J.res && J.job && J.job.ids.indexOf(id) >= 0 ? J.res[id] : null;
    if (r && r.state === "run") return { c: "run", t: r.phase === "read" ? "해석 중" : "발언 조사 중" };
    if (r && r.state === "fail" && !(J.done && !T.todo)) return { c: "fail", t: "실패 · " + String((r.read && r.read !== "ok" ? r.read : r.note) || "").slice(0, 40) };
    if (T.k === "ok") return { c: "done", t: T.voice ? "발언 최신" : "최신 해석" };
    if (T.k === "no13f") return T.noteOld ? { c: "wait", t: "13F 없음 · 13F 수집 뒤에 처리" } : { c: "wait", t: "13F 없음 · 발언만 최신" };
    return { c: "todo", t: T.k === "old" ? "발언 조사 오래됨" : T.t }; };
  var ALL = Object.keys(GX_P), cnt = { done: 0, todo: 0, wait: 0, run: 0, fail: 0 }; ALL.forEach(function (id) { cnt[stOf(id).c]++; });
  var todoN = ALL.filter(function (id) { return gxTodo(id).todo; }).length, pct = Math.round(cnt.done / ALL.length * 100);
  var h = '<div class="gyStep"><div class="gyStepH"><span class="no">1</span><b>누구를</b><em>' + n + '명 선택</em></div>';
  h += '<div class="gyStat"><div class="gyStatBar"><i class="d" style="width:' + pct + '%"></i><i class="r" style="width:' + Math.round((cnt.run) / ALL.length * 100) + '%"></i></div><div class="gyStatN">' +
    [["done", "완료"], ["todo", "할 일"], ["run", "진행 중"], ["fail", "실패"], ["wait", "13F 없음"]].filter(function (k) { return k[0] === "done" || k[0] === "todo" || cnt[k[0]]; }).map(function (k) { return '<span class="' + k[0] + '"><i>' + STC[k[0]][1] + '</i>' + k[1] + ' <b>' + cnt[k[0]] + '</b></span>'; }).join("") + '<span class="tot">전체 ' + ALL.length + '명 중 ' + pct + '% 완료</span></div>' +
    '<p class="gyNote">완료 = 이번 분기 13F 해석이 있고, 그 뒤에 추가된 발언 · 메모가 없고, 발언 조사가 30일 안. 하나라도 어긋나면 할 일이에요. 13F가 없는 사람은 13F 수집 뒤에 할 일로 바뀌어요. \'발언형\'(13F 없이 읽는 사람)은 발언 조사가 30일 안이면 완료예요.</p></div>';
  h += '<div class="gyQuick"><button type="button" data-gxsel="todo">할 일만 고르기 <small>' + todoN + '</small></button><button type="button" data-gxsel="all">전원</button><button type="button" data-gxsel="none">선택 해제</button></div>';
  h += GX_TY_ORDER.map(function (ty) { var ids = ALL.filter(function (id) { return GX_P[id].ty === ty; }), dn = ids.filter(function (id) { return stOf(id).c === "done"; }).length;
    return '<div class="gyPickRow" style="--gx:' + GX_TYPES[ty].c + '"><button type="button" class="gyTyLbl" data-gxsel="ty:' + ty + '" title="이 유형 모두 추가"><i></i>' + GX_TYPES[ty].nm + ' <small>' + dn + '/' + ids.length + '</small></button><div class="gyTog">' + ids.map(function (id) { var t = stOf(id);
      return '<label class="st-' + t.c + (S[id] ? " on" : "") + '" title="' + gxE(t.t) + '"><input type="checkbox" data-gxpick="' + id + '"' + (S[id] ? " checked" : "") + '><span class="ck"></span><span class="ic">' + STC[t.c][1] + '</span><span class="nm">' + gxE(GX_NM[id]) + '</span><span class="sx">' + gxE(t.c === "done" ? "완료" : t.c === "wait" ? (t.t.indexOf("최신") > 0 ? "발언만 완료" : "13F 없음") : t.t) + '</span></label>'; }).join("") + '</div></div>'; }).join("") + '</div>';
  h += '<div class="gyStep"><div class="gyStepH"><span class="no">2</span><b>무엇을</b></div><div class="gySegS">' + [["both", "발언 조사 + 해석"], ["read", "해석만"], ["note", "발언 조사만"]].map(function (c) { return '<button type="button" data-gxwhat="' + c[0] + '" class="' + (GXA.what === c[0] ? "on" : "") + '">' + c[1] + '</button>'; }).join("") + '</div></div>';
  var calls = n * (GXA.what === "both" ? 2 : 1), mins = n ? Math.ceil(n / 3) * (GXA.what === "both" ? 4 : GXA.what === "note" ? 3 : 2) : 0, over = J && J.max && J.used + calls > J.max;
  var chunks = []; for (var i = 0; i < sel.length; i += GXA.bsz) chunks.push(sel.slice(i, i + GXA.bsz));
  h += '<div class="gyStep"><div class="gyStepH"><span class="no">3</span><b>어떻게</b></div><div class="gyWays">';
  h += '<div class="gyWay main"><div class="gyWayH"><b>서버에서 자동으로</b><span class="gyTag">추천</span></div><p>3명씩 동시에 처리해요. 창을 닫아도 계속 돌아요.</p><div class="gyStats"><div><span>인원</span><b>' + n + '명</b></div><div><span>Claude 호출</span><b>' + calls + '회</b></div><div><span>예상 시간</span><b>약 ' + mins + '분</b></div><div><span>오늘 사용</span><b class="' + (over ? "neg" : "") + '">' + (J && J.max ? J.used + '/' + J.max : '–') + '</b></div></div>' + (over ? '<p class="gyWarn">하루 한도를 넘어요 — Vercel의 CLAUDE_DAILY_MAX를 올리거나 인원을 줄여 주세요.</p>' : '') + (run ? '<button type="button" class="gyBtn ghost" data-gxjstop>멈추기</button>' : '<button type="button" class="gyBtn" data-gxjgo' + (n ? "" : " disabled") + '>' + (n ? n + '명 시작' : '먼저 인물을 골라 주세요') + '</button>') + '<div class="gxJobSt">' + gxJobStHtml() + '</div></div>';
  h += '<div class="gyWay"><div class="gyWayH"><b>묶음 프롬프트로 직접</b></div><p>웹 검색이 되는 AI에 한 번 묻고, 답 하나로 그 묶음을 모두 저장해요. 답이 끊기면 인원을 줄여 주세요.</p><div class="gySegS sm">' + [2, 3, 4].map(function (k) { return '<button type="button" data-gxbsz="' + k + '" class="' + (GXA.bsz === k ? "on" : "") + '">' + k + '명씩</button>'; }).join("") + '</div><div class="gyChunks">' + (chunks.length ? chunks.map(function (c, k) { return '<button type="button" data-gxbprep="' + c.join(",") + '"><span class="k">' + (k + 1) + '</span><span class="w">' + c.map(function (id) { return '<i>' + gxE(GX_NM[id]) + '</i>'; }).join(" · ") + '</span><span class="cp">복사</span></button>'; }).join("") : '<p class="gyNote">1단계에서 인물을 골라 주세요</p>') + '</div><textarea class="gyTa" data-gxbans rows="3" placeholder="AI가 준 답 전체를 붙여 넣어요"></textarea><button type="button" class="gyBtn ghost" data-gxbsave>답 저장(여러 명)</button></div></div></div>';
  var cfg = (J && J.cfg) || {};
  h += '<label class="gySwRow"><span class="gySw"><input type="checkbox" data-gxauto' + (cfg.auto ? " checked" : "") + '><i></i></span><span><b>새 13F가 들어오면 그 사람만 자동으로</b><small>매주 화요일 13F 수집 뒤 · 새 보고서가 온 사람만 발언 조사 + 해석 · 켜면 Claude 사용이 자동으로 생겨요</small></span></label>';
  return h;
}
/* ---------- 관리 ② 앱 점수에 반영 ---------- */
function gyCfgHtml() {
  var C = gxCfg(), B = gxBasis(); if (!B) return '<div class="gyEmpty">거장 13F 자료가 4명 이상 모이면 쓸 수 있어요.</div>';
  var TS = B.types, W0 = typeof rkWBase === "function" ? rkWBase() : null, W1 = W0 ? gxAdjW(W0, true) : null;
  var h = '<label class="gySwRow big"><span class="gySw"><input type="checkbox" data-gxon' + (C.on ? " checked" : "") + '><i></i></span><span><b>거장 점수를 앱 점수에 반영</b><small>' + (C.on ? "켜짐 — 아래 기준으로 계산 비율을 옮기고 있어요" : "꺼짐 — 켜기 전에 아래에서 바뀌는 값을 미리 볼 수 있어요") + '</small></span><span class="gyScore ' + gyRiskCls(B.label) + '"><small>기준 점수</small>' + gySgn(B.score) + '<em>' + B.label + '</em></span></label>';
  h += '<div class="gyStep"><div class="gyStepH"><span class="no">1</span><b>기준으로 삼을 의견</b></div><div class="gySegS wrap">' + [["all", "전체 종합"]].concat(GX_TY_ORDER.filter(function (k) { return TS[k]; }).map(function (k) { return [k, GX_TYPES[k].nm]; })).concat([["mix", "내 비율"]]).map(function (c) { return '<button type="button" data-gxbasis="' + c[0] + '" class="' + (C.basis === c[0] ? "on" : "") + '">' + c[1] + '</button>'; }).join("") + '</div>';
  h += '<div class="gyTsT">' + GX_TY_ORDER.map(function (k) { var t = TS[k]; if (!t) return ""; var on = C.basis === k || C.basis === "all" || (C.basis === "mix" && +C.mix[k] > 0); return '<div class="' + (on ? "" : "dim") + '" style="--gx:' + GX_TYPES[k].c + '"><span class="n"><i></i>' + GX_TYPES[k].nm + '</span>' + gyBar(t.score) + '<b class="' + (t.score >= 25 ? "pos" : t.score <= -25 ? "neg" : "") + '">' + gySgn(t.score) + '</b><small>' + t.n + '명 · ↑' + t.up + ' ↓' + t.dn + '</small>' + (C.basis === "mix" ? '<label class="mix">비율<input type="number" min="0" max="100" step="5" value="' + (+C.mix[k] || 0) + '" data-gxmix="' + k + '"></label>' : '') + '</div>'; }).join("") + '</div></div>';
  h += '<div class="gyStep"><div class="gyStepH"><span class="no">2</span><b>종목별 거장 점수 섞기</b><em>거장이 들고 있는 미국 종목에만</em></div><div class="gySegS">' + [0, 5, 10, 15].map(function (b) { return '<button type="button" data-gxblend="' + b + '" class="' + (C.blend === b ? "on" : "") + '">' + (b ? b + "%" : "섞지 않음") + '</button>'; }).join("") + '</div></div>';
  h += '<div class="gyStep"><div class="gyStepH"><span class="no">3</span><b>' + (C.on ? "지금 이렇게 바뀌어 있어요" : "켜면 이렇게 바뀌어요") + '</b>' + (!B.s ? '<em>기준 점수가 ±25 안이라 비율은 그대로</em>' : '') + '</div><div class="gyFx">';
  if (B.s && W0) h += '<div><span class="w">종목 순위 · 묶음 비중</span><div class="ch">' + RK_G.map(function (g, i) { return W1[i] !== W0[i] ? '<span>' + g.no + ' ' + g.n + ' <s>' + W0[i] + '</s> → <b class="' + (W1[i] > W0[i] ? "pos" : "neg") + '">' + W1[i] + '</b></span>' : null; }).filter(Boolean).join("") + '</div></div>';
  if (B.s) { var k = B.s / 20, off = B.score < 0, m = function (x) { return '×' + x.toFixed(2); }; h += '<div><span class="w">평가표 · 자리 점수 비율</span><div class="ch"><span>기술 지표(흐름) <b class="' + (off ? "neg" : "pos") + '">' + m(off ? 1 - k : 1 + k) + '</b></span><span>MDD(낙폭) <b class="' + (off ? "pos" : "neg") + '">' + m(off ? 1 + k : 1 - k) + '</b></span><span>장기 평균선 <b class="' + (off ? "pos" : "neg") + '">' + m(off ? 1 + k / 2 : 1 - k / 2) + '</b></span><span class="dim">체력(본질) 점수는 그대로</span></div></div>'; }
  h += '<div><span class="w">종목별 거장 점수</span><div class="ch"><span>' + (C.blend ? '종목 점수에 <b>' + C.blend + '%</b> 섞기' : '섞지 않고 참고로만 표시') + '</span></div></div>';
  h += '<div><span class="w">본질 · 변수</span><div class="ch"><span>기준 점수 -25 아래면 \'거장 국면\' 변수 켜짐 · 지금 <b class="' + (B.score <= -25 ? "neg" : "") + '">' + (B.score <= -25 ? "켜짐" : "꺼짐") + '</b></span></div></div></div>';
  if (B.s) h += '<p class="gyNote">이유: ' + (B.score < 0 ? "거장들이 위험을 줄일 때는 '오르는 흐름'보다 '충분히 싸졌는가'와 '기업의 체력'을 더 무겁게 봐요." : "거장들이 위험을 늘릴 때는 깊은 하락을 기다리기보다 '흐름이 살아 있는가'를 더 무겁게 봐요.") + '</p>';
  h += '</div><p class="gyNote">분기 말 13F로 만든 가설이에요. 옮기는 방향과 크기는 정해 둔 규칙이고, 과거 검증은 기록이 몇 분기 쌓인 뒤에 할 수 있어요. 켠 결과와 끈 결과를 비교해 참고해 주세요.</p>';
  return '<div class="gyCfg">' + h + '</div>';
}
gxCfgHtml = gyCfgHtml;
gyAdminTab = function () {
  var h = '';
  if (gxOwner()) h += gySec("한 번에 처리", "여러 명의 13F 밖의 이야기 + 해석을 한꺼번에", '<div class="gyPanel"><div class="gxJob gyJob">' + gyJobHtml() + '</div></div>', " gyFirst");
  h += gySec("앱 점수에 반영", "거장 점수를 기준으로 순위 · 평가표 · 본질 · 변수의 계산 비율을 옮겨요", '<div class="gyPanel">' + gyCfgHtml() + '</div>', gxOwner() ? "" : " gyFirst");
  if (gxOwner()) h += gySec("13F 수집", "SEC는 Vercel 서버를 막아 두어서 GitHub Actions의 'SEC 13F 수집'이 주로 받아요 · 매주 화요일 08:13 자동", '<div class="gyPanel gyAct"><button class="gyBtn ghost" data-ds-run="1">지금 수집(서버)</button><span class="dsRunMsg briefDim">공시(DART)와 13F를 이어서 받아요</span></div>');
  return h;
};
(function () {
  var st = document.createElement("style"); st.textContent =
    /* 공통 — 카드 · 그림자 · 둥근 모서리 */
    "#guruBody{--gyr:16px;--gysh:0 1px 2px rgba(17,24,39,.04),0 6px 20px rgba(17,24,39,.05);--gyup:var(--up,#f04452);--gydn:var(--down,#3182f6)}" +
    "#guruBody .gyHeroL,#guruBody .gyHeroR,#guruBody .gyPh,#guruBody .gyAi,.gyCard,.gyPanel{border:1px solid rgba(17,24,39,.06);border-radius:var(--gyr);box-shadow:var(--gysh);background:var(--card,#fff)}" +
    ".gySec h3{font-size:17px}.gySec{margin-top:28px}.gyCard{padding:14px 16px}.gyCard h4{margin:0 0 6px;font-size:13.5px;font-weight:800;display:flex;align-items:center;gap:7px}.gyCard h4 .dot{width:8px;height:8px;border-radius:50%}.dot.up{background:var(--gyup)}.dot.dn{background:var(--gydn)}" +
    /* 종목명 — 한 줄, 자르지 않음 */
    ".gyNm{display:inline-flex;align-items:baseline;gap:6px;min-width:0;flex-wrap:wrap}.gyNm b{font-size:14px;font-weight:800;white-space:nowrap;letter-spacing:-.2px}.gyNm small{font-size:11.5px;font-weight:700;color:var(--sub,#8b95a1);white-space:nowrap}" +
    ".gyLi{padding:10px 0;border-bottom:1px solid rgba(17,24,39,.06)}.gyCard .gyLi:last-child{border-bottom:0;padding-bottom:2px}.gyLiT{display:flex;justify-content:space-between;align-items:center;gap:6px 10px;flex-wrap:wrap}.gyPill{display:inline-flex;align-items:center;font-size:12px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;font-variant-numeric:tabular-nums}.gyPill.up{background:var(--k-fdecee,#fdecee);color:var(--gyup)}.gyPill.dn{background:var(--downSoft,#ebf2fd);color:var(--gydn)}.gyBadges{display:inline-flex;gap:5px;flex:0 0 auto}" +
    ".gyWho{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.gyWho span{font-size:12px;padding:3px 9px;border-radius:7px;background:var(--gysoft);color:var(--txt2,#4e5968);white-space:nowrap}.gyWho span b{font-weight:800}.gyWho span.up b{color:var(--gyup)}.gyWho span.dn b{color:var(--gydn)}.gyWho span.up:not(:has(b)){box-shadow:inset 2px 0 0 var(--gyup)}.gyWho span.dn:not(:has(b)){box-shadow:inset 2px 0 0 var(--gydn)}" +
    ".gyGrid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}.gyGrid2 .gyLi{padding:12px 14px;border-bottom:1px solid rgba(17,24,39,.06)}" +
    /* 막대 */
    ".gyBarT{position:relative;display:block;height:8px;border-radius:999px;background:var(--gysoft);overflow:hidden}.gyBarT .z{position:absolute;left:50%;top:0;width:1px;height:100%;background:rgba(17,24,39,.18)}.gyBarT .f{position:absolute;top:0;height:100%;background:#aeb5bf;border-radius:999px}.gyBarT .f.up{background:var(--gyup)}.gyBarT .f.dn{background:var(--gydn)}" +
    ".gyTyR{grid-template-columns:max-content 1fr 44px 52px;border-radius:10px;border-bottom:0;padding:10px 8px}.gyTyR+.gyTyR{border-top:1px solid rgba(17,24,39,.05)}" +
    ".gyPg2 .gyPc{border:1px solid rgba(17,24,39,.06);border-left:3px solid var(--gx);box-shadow:0 1px 2px rgba(17,24,39,.04);border-radius:12px}.gyPg2 .gyPc .hd{-webkit-line-clamp:unset;display:block;overflow:visible}.gyPg2 .gyPc .nm{white-space:nowrap}" +
    /* 관리 — 단계형 */
    ".gyPanel{padding:6px 18px 16px}.gyJob{border:0!important;padding:0!important;background:transparent!important}.gyStep{padding:14px 0;border-bottom:1px solid rgba(17,24,39,.06)}.gyStep:last-of-type{border-bottom:0}.gyStepH{display:flex;align-items:center;gap:9px;margin-bottom:10px}.gyStepH .no{width:22px;height:22px;border-radius:50%;background:var(--txt,#191f28);color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}.gyStepH b{font-size:14.5px}.gyStepH em{font-style:normal;font-size:12.5px;color:var(--sub,#8b95a1);margin-left:auto}" +
    ".gyQuick{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}.gyQuick button,.gyTyLbl{border:1px solid rgba(17,24,39,.1);background:var(--card,#fff);border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--txt2,#4e5968)}.gyQuick small{opacity:.6;margin-left:3px}" +
    ".gyPickRow{display:grid;grid-template-columns:190px 1fr;gap:10px;align-items:start;padding:6px 0}.gyTyLbl{display:inline-flex;align-items:center;gap:6px;justify-self:start;white-space:nowrap}.gyTyLbl i{width:8px;height:8px;border-radius:50%;background:var(--gx)}.gyTog{display:flex;flex-wrap:wrap;gap:6px}.gyTog label{position:relative;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(17,24,39,.1);border-radius:10px;padding:6px 10px;font-size:13px;cursor:pointer;background:var(--card,#fff);transition:all .15s}.gyTog label:hover{border-color:var(--gx)}.gyTog input{position:absolute;opacity:0;pointer-events:none}.gyTog label.on{background:var(--gx);border-color:var(--gx);color:#fff}.gyTog .nm{font-weight:700;white-space:nowrap}.gyTog .td,.gyTog .js{font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:5px;background:#fbf1d9;color:#8a6414;white-space:nowrap}.gyTog .td.no13f{background:#eceff3;color:var(--t-8b95a1,#8b95a1)}.gyTog label.on .td{background:rgba(255,255,255,.25);color:#fff}.gyTog .js.run{background:#fbf1d9;color:#8a6414}.gyTog .js.done{background:var(--k-e2f4ea,#e2f4ea);color:var(--k-157347,#157347)}.gyTog .js.fail{background:var(--k-fde8ea,#fde8ea);color:var(--k-c03b3b,#c03b3b)}" +
    ".gySegS{display:inline-flex;gap:4px;background:var(--gysoft);border-radius:12px;padding:4px;flex-wrap:wrap}.gySegS button{border:0;background:transparent;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;color:var(--sub,#6b7684);cursor:pointer;white-space:nowrap}.gySegS button.on{background:var(--card,#fff);color:var(--txt,#191f28);box-shadow:0 1px 3px rgba(0,0,0,.1)}.gySegS.sm button{padding:6px 11px;font-size:12.5px}" +
    ".gyWays{display:grid;grid-template-columns:1fr 1fr;gap:12px}.gyWay{border:1px solid rgba(17,24,39,.08);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}.gyWay.main{background:linear-gradient(180deg,rgba(49,130,246,.05),transparent 60%);border-color:rgba(49,130,246,.25)}.gyWayH{display:flex;align-items:center;gap:8px}.gyWayH b{font-size:14.5px}.gyTag{font-size:11px;font-weight:800;color:var(--txt2,#3d4452);background:var(--card2,#f1f2f4);border-radius:6px;padding:2px 7px}.gyWay p{margin:0;font-size:12.5px;line-height:1.6;color:var(--txt2,#4e5968);word-break:keep-all}" +
    ".gyStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.gyStats div{background:var(--card,#fff);border:1px solid rgba(17,24,39,.06);border-radius:10px;padding:7px 9px}.gyStats span{display:block;font-size:11px;color:var(--sub,#8b95a1);font-weight:700;white-space:nowrap}.gyStats b{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}.gyWarn{color:var(--k-c03b3b,#c03b3b)!important;font-weight:700}" +
    ".gyBtn{border:0;border-radius:12px;padding:11px 16px;font-size:14px;font-weight:800;background:var(--txt,#191f28);color:#fff;cursor:pointer}.gyBtn:disabled{opacity:.35;cursor:default}.gyBtn.ghost{background:var(--gysoft);color:var(--txt,#191f28)}.gyWay.main .gyBtn:not(.ghost){background:var(--accent,#14161c)}" +
    ".gyChunks{display:grid;gap:6px}.gyChunks button{display:flex;align-items:center;gap:8px;text-align:left;border:1px solid rgba(17,24,39,.1);background:var(--card,#fff);border-radius:10px;padding:8px 10px;cursor:pointer;font:inherit;font-size:13px}.gyChunks .k{width:20px;height:20px;border-radius:6px;background:var(--gysoft);display:inline-flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;flex:0 0 auto}.gyChunks .w{flex:1;font-weight:700;word-break:keep-all}.gyChunks .cp{font-size:12px;font-weight:800;color:var(--accent,#14161c);text-decoration:underline;flex:0 0 auto}.gyChunks button.done{opacity:.55}.gyChunks button.done .cp:after{content:' ✓'}.gyTa{width:100%;box-sizing:border-box;border:1px solid rgba(17,24,39,.12);border-radius:10px;padding:9px 11px;font:inherit;font-size:13px;resize:vertical;background:var(--card,#fff);color:var(--txt,#191f28)}" +
    ".gxJobSt:empty{display:none}.gxJobSt{background:var(--card,#fff);border-radius:10px;padding:10px 12px;border:1px solid rgba(17,24,39,.06)}" +
    ".gySwRow{display:flex;align-items:center;gap:12px;padding:14px 0 4px;cursor:pointer}.gySwRow>span:nth-child(2){flex:1;min-width:0}.gySwRow b{display:block;font-size:14px}.gySwRow small{display:block;font-size:12px;color:var(--sub,#8b95a1);margin-top:2px;line-height:1.5;word-break:keep-all}.gySwRow.big{padding:16px 0 12px;border-bottom:1px solid rgba(17,24,39,.06)}" +
    ".gySw{position:relative;flex:0 0 auto;width:44px;height:26px}.gySw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}.gySw i{position:absolute;inset:0;border-radius:999px;background:#d1d6db;transition:background .2s}.gySw i:after{content:'';position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}.gySw input:checked+i{background:var(--accent,#14161c)}.gySw input:checked+i:after{transform:translateX(18px)}" +
    ".gyScore{display:flex;flex-direction:column;align-items:flex-end;font-size:26px;font-weight:900;letter-spacing:-.8px;line-height:1.05;font-variant-numeric:tabular-nums;flex:0 0 auto}.gyScore small{font-size:11px;font-weight:700;color:var(--sub,#8b95a1);letter-spacing:0}.gyScore em{font-style:normal;font-size:11.5px;font-weight:800;letter-spacing:0}.gyScore.up{color:var(--gyup)}.gyScore.dn{color:var(--gydn)}" +
    ".gyTsT{display:grid;gap:2px;margin-top:12px}.gyTsT>div{display:grid;grid-template-columns:max-content 1fr 40px 96px auto;gap:12px;align-items:center;padding:7px 4px;font-size:13px}.gyTsT>div.dim{opacity:.4}.gyTsT .n{font-weight:700;white-space:nowrap;min-width:120px}.gyTsT i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gx);margin-right:7px}.gyTsT b{text-align:right;font-variant-numeric:tabular-nums}.gyTsT small{color:var(--sub,#8b95a1);font-size:12px;white-space:nowrap}.gyTsT .mix{display:inline-flex;gap:5px;align-items:center;font-size:12px;color:var(--sub,#8b95a1)}.gyTsT .mix input{width:52px;border:1px solid rgba(17,24,39,.12);border-radius:7px;padding:4px 6px;font:inherit;font-size:12.5px}" +
    ".gyFx{display:grid;gap:8px}.gyFx>div{display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:baseline;padding:9px 12px;background:var(--gysoft);border-radius:10px}.gyFx .w{font-size:12.5px;font-weight:800;color:var(--txt2,#4e5968)}.gyFx .ch{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px}.gyFx .ch span{white-space:nowrap}.gyFx .ch s{color:var(--sub,#8b95a1)}.gyFx .ch .dim{color:var(--sub,#8b95a1)}.gyCfg .gyNote{margin-top:10px}" +
    ".gyWays{align-items:start}.gyWay,.gyWays>*{min-width:0}.gyChunks button{min-width:0;width:100%;box-sizing:border-box}.gyChunks .w{min-width:0;white-space:normal;line-height:1.5}.gyChunks .w i{font-style:normal;white-space:nowrap}.gyPg2 .gyPc{min-width:0}.gyPg2 .gyPc .hd{width:100%;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}.gyWho span.up:not(:has(b)),.gyWho span.dn:not(:has(b)){box-shadow:none}.gyWho span.up:not(:has(b)):before,.gyWho span.dn:not(:has(b)):before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;vertical-align:1px;background:var(--gyup)}.gyWho span.dn:not(:has(b)):before{background:var(--gydn)}" +
    ".gyStat{background:var(--gysoft);border-radius:12px;padding:12px 14px;margin-bottom:12px}.gyStatBar{position:relative;height:8px;border-radius:999px;background:rgba(17,24,39,.08);overflow:hidden;display:flex}.gyStatBar i{display:block;height:100%}.gyStatBar i.d{background:var(--k-1fa463,#1fa463)}.gyStatBar i.r{background:var(--run,#4a6fd8)}.gyStatN{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-top:10px;font-size:13px}.gyStatN span{display:inline-flex;align-items:center;gap:5px;font-weight:700;color:var(--txt2,#4e5968)}.gyStatN span b{font-size:15px;font-variant-numeric:tabular-nums}.gyStatN span i{font-style:normal;width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff}.gyStatN .done i{background:var(--k-1fa463,#1fa463)}.gyStatN .done b{color:var(--k-1fa463,#1fa463)}.gyStatN .todo i{background:#e2a33b}.gyStatN .todo b{color:#c27d10}.gyStatN .run i{background:var(--run,#4a6fd8)}.gyStatN .fail i{background:var(--k-e5484d,#e5484d)}.gyStatN .wait i{background:#aeb5bf}.gyStatN .tot{margin-left:auto;font-weight:600;color:var(--sub,#8b95a1);font-size:12.5px}.gyStat .gyNote{margin-top:8px}" +
    ".gyTyLbl small{opacity:.6;font-weight:700;margin-left:2px}" +
    /* 칩: 상태는 왼쪽 아이콘 · 오른쪽 글씨 색으로, 선택은 테두리 + 체크로 — 둘이 섞이지 않게 */
    ".gyTog label{padding:6px 10px 6px 8px;gap:6px;background:var(--card,#fff)!important;color:var(--txt,#191f28)!important;border:1.5px solid rgba(17,24,39,.1)!important}.gyTog label .ck{width:16px;height:16px;border-radius:5px;border:1.5px solid rgba(17,24,39,.25);flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#fff}.gyTog label.on{border-color:var(--gx)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--gx) 18%,transparent)}.gyTog label.on .ck{background:var(--gx);border-color:var(--gx)}.gyTog label.on .ck:after{content:'✓';font-weight:900}" +
    ".gyTog .ic{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex:0 0 auto}.gyTog .sx{font-size:11.5px;font-weight:800;white-space:nowrap}.gyTog .st-done .ic{background:var(--k-1fa463,#1fa463)}.gyTog .st-done .sx{color:var(--k-1fa463,#1fa463)}.gyTog .st-todo .ic{background:#e2a33b}.gyTog .st-todo .sx{color:#c27d10}.gyTog .st-run .ic{background:var(--run,#4a6fd8)}.gyTog .st-run .sx{color:var(--run,#4a6fd8)}.gyTog .st-fail .ic{background:var(--k-e5484d,#e5484d)}.gyTog .st-fail .sx{color:var(--k-e5484d,#e5484d)}.gyTog .st-wait .ic{background:#c5cbd3}.gyTog .st-wait .sx{color:var(--t-8b95a1,#8b95a1)}.gyTog .st-wait .nm{color:var(--t-8b95a1,#8b95a1)}.gyTog .st-done{background:var(--k-f3faf6,#f3faf6)!important}" +
    "@media screen and (max-width:760px){.gyStatN .tot{margin-left:0;flex-basis:100%}.gyStepH em{display:none}.gyWays{grid-template-columns:1fr}.gyPickRow{grid-template-columns:1fr;gap:6px}.gyStats{grid-template-columns:repeat(2,minmax(0,1fr))}.gyTsT>div{grid-template-columns:max-content 1fr 36px}.gyTsT small,.gyTsT .mix{grid-column:1 / -1}.gyTsT .n{min-width:0}.gyFx>div{grid-template-columns:1fr;gap:4px}.gyGrid2{grid-template-columns:1fr}.gyPanel{padding:4px 14px 14px}}";
  document.head.appendChild(st);
})();
