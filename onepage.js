/* ============================================================
   오늘 한 장 (v9.9) — 사회한장·경제정리노트 식 '한 장 정보 카드'
   그날 데이터 + 기사 + 일정 + 스크린(매수 후보·주의 종목) + 상식 한 줄을 한 장(1080×1350)에 번호 칸으로 정리.
   시장(국내·미국·코인)별로 한 장. 모든 숫자는 종가 기준 자동 집계. 스크린은 '조건에 걸린 종목'이지 추천이 아님.
   ============================================================ */
var OP_C = { bg: "#fbf8f1", paper: "#ffffff", ink: "#14161c", ink2: "#3b4256", sub: "#7a7468", line: "#e4dfd3", navy: "#14161c", head: "#14161c", gold: "#c9a24f", gold2: "#e6c57a", goldBg: "#fff4d6", up: "#d9342b", down: "#2f6fd6", upBg: "#fdeeec", downBg: "#eaf1fc", green: "#2e8b57", greenBg: "#e8f5ec", warn: "#b45309", warnBg: "#fff1e0" };
/* 매일 돌아가는 '오늘의 한 줄' — 세금·계좌·실무 상식 (바뀔 수 있는 숫자는 기준을 적음) */
var OP_TIPS = {
  common: [
    ["-50%는 +100%가 필요해요", "잃은 만큼이 아니라 줄어든 돈에서 다시 올라가야 하니까요. 크게 잃지 않는 게 먼저예요."],
    ["72 ÷ 연 수익률 = 두 배 되는 해", "연 7%면 약 10년. 복리는 시간이 곱해질수록 커져요."],
    ["예수금은 판 날 D+2에 출금돼요", "오늘 팔아도 현금은 2영업일 뒤. 급한 돈은 미리 팔아 두세요."],
    ["비상금 3~6개월치부터", "기다릴 수 없는 돈은 결국 바닥에서 팔게 돼요. 투자 전 비상금이 먼저예요."],
    ["신고가는 '비싸다'가 아니에요", "'파는 사람이 없다'에 가까워요. 신저가는 '사는 사람이 없다'고요."],
    ["계좌는 하루 한 번만", "자주 볼수록 감정적으로 사고팔기 쉬워요. 정한 시간에 한 번이면 충분해요."],
    ["금융소득 2,000만원이 기준", "이자+배당이 연 2,000만원을 넘으면 종합과세 대상이에요(국세청 기준, 확인 필요)."],
    ["ISA·연금저축·IRP는 연말 전에", "세액공제 한도를 채우면 돌려받는 돈이 달라져요. 한도는 매년 공지를 확인하세요."]
  ],
  kr: [
    ["국내 주식 상한가·하한가는 ±30%", "하루에 그 이상은 못 움직여요. VI(변동성완화장치)가 걸리면 2분간 단일가예요."],
    ["배당락일엔 보통 배당만큼 내려요", "배당 받으려면 결제일(D+2) 계산해서 기준일 2영업일 전에 사야 해요."],
    ["국내 배당은 15.4% 떼고 들어와요", "배당소득세 14% + 지방세 1.4%. 연 2,000만원 넘으면 종합과세(확인 필요)."],
    ["미수는 D+2까지 못 채우면 반대매매", "돈이 모자라도 사지지만, 결제일까지 채우지 못하면 강제로 팔려요."],
    ["시간외 단일가는 16:00~18:00", "10분마다 한 번씩 체결돼요. 정규장과 가격이 다를 수 있어요."],
    ["대체거래소는 08:00~20:00", "일부 종목은 넥스트레이드에서 더 긴 시간 거래돼요(종목·시간은 공지 확인)."]
  ],
  us: [
    ["해외주식 양도세: 250만원 공제 후 22%", "연간 이익에서 250만원을 빼고 22%(지방세 포함). 5월에 신고해요(국세청 기준, 확인 필요)."],
    ["12월 전에 손실 종목으로 상계", "이익 난 종목과 손실 종목을 같은 해에 팔면 양도세가 줄어요. 결제일 기준이니 12월 말 며칠 전에."],
    ["미국 배당은 15% 떼고 들어와요", "현지 원천징수 15%. 국내에서 추가로 떼지 않지만 금융소득 합산엔 들어가요."],
    ["미국장은 서머타임이면 22:30~05:00", "겨울(11월 첫 일요일 이후)은 23:30~06:00. 프리·애프터마켓은 거래가 적어 가격이 튀어요."],
    ["미국 주식엔 상한가·하한가가 없어요", "하루 수십 %도 움직여요. 급변 시 일시 거래정지(서킷브레이커)만 있어요."],
    ["환율도 수익률이에요", "달러 기준 +3%여도 환율이 -3%면 원화로는 본전. 달러·원화 기준을 구분해서 보세요."],
    ["소수점 매수는 체결 시간이 달라요", "여러 증권사가 0.01주 단위를 지원하지만, 모아서 주문하니 실시간 체결이 아닐 수 있어요."]
  ],
  coin: [
    ["코인 일봉은 거래소마다 기준이 달라요", "우리 카드는 UTC 기준(한국 오전 9시 마감). 업비트도 09시, 다른 앱은 00시일 수 있어요."],
    ["김치 프리미엄은 국내가 비싼 정도", "국내 거래소 원화 가격이 해외 달러 가격보다 몇 % 비싼지. 커지면 과열 신호로 보기도 해요."],
    ["송금 전 네트워크부터 확인", "주소가 맞아도 네트워크가 다르면 복구가 어려워요. 큰 금액 전엔 소액 테스트."],
    ["100만원 이상 송금은 트래블룰", "받는 사람 정보가 필요해요. 거래소마다 가능한 지갑이 달라요."],
    ["가상자산 과세는 시행이 미뤄져 왔어요", "시행 시기와 공제 금액은 최신 공지를 확인하세요."],
    ["코인엔 상한가·하한가가 없어요", "24시간 거래되고 하루 수십 %도 움직여요. 비중이 곧 위험이에요."]
  ]
};
function opPct(x, d) { return cPct(x, d == null ? 2 : d); }
function opCol(x) { return x > 0 ? OP_C.up : x < 0 ? OP_C.down : OP_C.ink2; }
function opSeed() { return Math.floor((Date.now() + 9 * 3600e3) / 86400e3); }

/* ---------- 스크린 (조건에 걸린 종목) ---------- */
function opScreens(R) {
  var S = (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym); }), unit = R.market === "coin" ? "코인" : "종목";
  function has(s) { return s.vsHi != null; }
  var buy = [
    { t: "세일 + 20일선 회복", d: "고점 -20%↓ · 20일선 위", list: S.filter(function (s) { return has(s) && s.vsHi <= -0.2 && s.above20 && s.ret1 > 0; }).sort(function (a, b) { return a.vsHi - b.vsHi; }), tag: function (s) { return "고점 " + opPct(s.vsHi, 0); } },
    { t: "신고가 + 거래대금 급증", d: "52주 신고가 · 평소 2배↑", list: S.filter(function (s) { return s.newHigh && s.amtX >= 2; }).sort(function (a, b) { return b.amtX - a.amtX; }), tag: function (s) { return "대금 " + s.amtX.toFixed(1) + "배"; } },
    { t: "과매도 반등 후보", d: "5일 -8%↓ · 200일선 위", list: S.filter(function (s) { return s.ret5 <= -0.08 && s.above200; }).sort(function (a, b) { return a.ret5 - b.ret5; }), tag: function (s) { return "5일 " + opPct(s.ret5, 0); } },
    { t: "조용히 오르는 " + unit, d: "1개월 +10%↑ · 변동 작음", list: S.filter(function (s) { return s.m1 >= 0.1 && s.sd > 0 && s.sd < 0.02; }).sort(function (a, b) { return b.m1 - a.m1; }), tag: function (s) { return "1개월 " + opPct(s.m1, 0); } }
  ];
  var warn = [
    { t: "단기 과열", d: "20일선 +15%↑ · 대금 급증", list: S.filter(function (s) { return s.vsMa20 >= 0.15 && s.amtX >= 1.5; }).sort(function (a, b) { return b.vsMa20 - a.vsMa20; }), tag: function (s) { return "20일선 " + opPct(s.vsMa20, 0); } },
    { t: "추세 이탈", d: "200일선 아래로 · 이번 주", list: S.filter(function (s) { return s.above200 === false && s.ma200 && s.last / s.ma200 - 1 > -0.05 && s.ret5 < 0; }).sort(function (a, b) { return a.ret5 - b.ret5; }), tag: function (s) { return "5일 " + opPct(s.ret5, 0); } },
    { t: "고점 -10% 진입", d: "손절 기준 확인할 때", list: S.filter(function (s) { return has(s) && s.vsHi <= -0.1 && s.vsHi > -0.14 && s.ret1 < 0; }).sort(function (a, b) { return a.vsHi - b.vsHi; }), tag: function (s) { return "고점 " + opPct(s.vsHi, 0); } },
    { t: "52주 신저가", d: "1년 최저가 경신", list: S.filter(function (s) { return s.newLow; }).sort(function (a, b) { return a.ret1 - b.ret1; }), tag: function (s) { return "하루 " + opPct(s.ret1); } }
  ];
  function pick(arr, n) { return arr.filter(function (x) { return x.list.length; }).slice(0, n || 2).map(function (x) { return { t: x.t, d: x.d, n: x.list.length, rows: x.list.slice(0, 3).map(function (s) { return { name: briefName(s), tag: x.tag(s), ret: s.ret1 }; }) }; }); }
  // v10.1: 복합 점수(추세·위치·RSI·대금 + 재무·수급·기사)로 고른 선별 종목이 준비돼 있으면 첫 줄은 그것, 둘째 줄은 하루 조건 스크린
  var pk = typeof pkReady === "function" ? pkReady(R) : null;
  function pkGroup(list, side) { return { t: side === "buy" ? "복합 점수 매수 후보" : "복합 점수 주의 " + unit, d: "추세·RSI·대금·재무·기사", n: list.length, rows: list.slice(0, 3).map(function (x) { return { name: briefName(x.s), tag: (side === "buy" ? "+" + x.bs + "/-" + x.ws : "-" + x.ws + "/+" + x.bs) + " · " + pkTopReason(x, side).split(" · ")[0], ret: x.s.ret1 }; }) }; }
  if (pk && (pk.buy.length || pk.warn.length)) return { buy: (pk.buy.length ? [pkGroup(pk.buy, "buy")] : []).concat(pick(buy, 1)).slice(0, 2), warn: (pk.warn.length ? [pkGroup(pk.warn, "warn")] : []).concat(pick(warn, 1)).slice(0, 2) };
  return { buy: pick(buy), warn: pick(warn) };
}

/* ---------- 그리기 ---------- */
/* 기사가 없을 때 8번 칸을 채우는 순위 — 비어 있지 않은 것부터 2개 (날짜로 순서를 바꿔 매일 같은 둘이 아니게) */
function opRanks(R) {
  var S = (R.stocks || []).filter(function (s) { return !/^\^|=X$|=F$/.test(s.sym); });
  function top(list, val, col) { return list.slice(0, 5).map(function (s) { return { name: briefName(s), val: val(s), col: col ? col(s) : OP_C.ink }; }); }
  var all = [
    { t: "1개월 수익률 TOP5", rows: top(S.filter(function (s) { return s.m1 != null; }).sort(function (a, b) { return b.m1 - a.m1; }), function (s) { return opPct(s.m1, 0); }, function (s) { return opCol(s.m1); }) },
    { t: "고점 대비 할인 TOP5", rows: top(S.filter(function (s) { return s.vsHi != null && s.vsHi < 0; }).sort(function (a, b) { return a.vsHi - b.vsHi; }), function (s) { return opPct(s.vsHi, 0); }, function () { return OP_C.down; }) },
    { t: "거래대금 평소 대비 TOP5", rows: top(S.filter(function (s) { return s.amtX > 1; }).sort(function (a, b) { return b.amtX - a.amtX; }), function (s) { return s.amtX.toFixed(1) + "배"; }) },
    { t: "1주 수익률 TOP5", rows: top(S.filter(function (s) { return s.ret5 != null; }).sort(function (a, b) { return b.ret5 - a.ret5; }), function (s) { return opPct(s.ret5, 0); }, function (s) { return opCol(s.ret5); }) },
    { t: "3개월 수익률 TOP5", rows: top(S.filter(function (s) { return s.m3 != null; }).sort(function (a, b) { return b.m3 - a.m3; }), function (s) { return opPct(s.m3, 0); }, function (s) { return opCol(s.m3); }) }
  ].filter(function (x) { return x.rows.length >= 3; });
  var k = all.length ? opSeed() % all.length : 0;
  return all.slice(k).concat(all.slice(0, k));
}
function opBox(g, x, y, w, h, no, title, sub, col) {
  cRound(g, x, y, w, h, 14, OP_C.paper, OP_C.line);
  cRound(g, x, y, w, 46, 14, col || OP_C.navy); g.fillStyle = col || OP_C.navy; g.fillRect(x, y + 20, w, 26);
  g.fillStyle = OP_C.gold; g.beginPath(); g.arc(x + 28, y + 23, 15, 0, Math.PI * 2); g.fill();
  cText(g, String(no), x + 28, y + 31, 21, 900, "#1c2333", "center");
  cText(g, title, x + 52, y + 31, 24, 800, "#ffffff");
  if (sub) cText(g, cFit(g, sub, w - 52 - cW(g, title, 24, 800) - 36, 17, 600), x + 52 + cW(g, title, 24, 800) + 14, y + 31, 17, 600, "#c9b98f");
  g.fillStyle = OP_C.gold; g.fillRect(x, y + 44, w, 2);   // v12.25 우상향연구소 색: 먹색 머리 + 금색 선
  return y + 60;
}
function opRow(g, x, y, w, name, right, rc, sub, fs) {
  fs = fs || 21; var rw = right ? cW(g, right, fs, 800) : 0;
  cText(g, cFit(g, name, w - rw - 14, fs, 700), x, y, fs, 700, OP_C.ink);
  if (right) cText(g, right, x + w, y, fs, 800, rc || OP_C.ink, "right");
  if (sub) cText(g, cFit(g, sub, w, 15, 500), x, y + 20, 15, 500, OP_C.sub);
}
function opTile(g, x, y, w, h, label, val, vc, sub) {
  cRound(g, x, y, w, h, 10, OP_C.bg);
  cText(g, cFit(g, label, w - 16, 15, 600), x + 10, y + 20, 15, 600, OP_C.sub);
  var vs = 26; while (vs > 16 && cW(g, val, vs, 900) > w - 16) vs -= 2;
  cText(g, val, x + 10, y + 48, vs, 900, vc || OP_C.ink);
  if (sub) cText(g, cFit(g, sub, w - 16, 13, 500), x + 10, y + 66, 13, 500, OP_C.sub);
}
function onePageCard(R, iss, news) {
  var cv = document.createElement("canvas"); cv.width = CARD.W; cv.height = CARD.H; var g = cv.getContext("2d"); g.textBaseline = "alphabetic";
  g.fillStyle = OP_C.bg; g.fillRect(0, 0, CARD.W, CARD.H);
  var P = 36, W = CARD.W - P * 2, mk = typeof cMktInfo === "function" ? cMktInfo(R) : null, unit = R.market === "coin" ? "코인" : "종목", sec = R.market === "coin" ? "테마" : "업종";
  var mkName = mk ? mk.name : "전체", mkc = OP_C.head, t = R.temp, rec = briefState.recent && briefState.recent.symbols, flag = R.market === "us" || R.market === "kr" ? R.market : null;   // v12.25 칸 머리는 모두 먹색(시장 구분은 국기로)
  function st(sym) { var d = rec && rec[sym]; return d ? briefStats(sym, d, "day") : null; }
  // ── 머리
  g.fillStyle = OP_C.head; g.fillRect(0, 0, CARD.W, 10); g.fillStyle = OP_C.gold; g.fillRect(0, 10, CARD.W, 3);
  var tagTxt = R.market === "coin" ? "코인" : mkName + " 주식", fw = flag && typeof cFlag === "function" ? Math.round(22 * (flag === "us" ? 1.9 : 1.5)) + 10 : 0, tagW = cW(g, tagTxt, 20, 800) + 30 + fw;
  cRound(g, P, 26, tagW, 40, 8, OP_C.head); if (fw) cFlag(g, P + 12, 35, 22, flag); cText(g, tagTxt, P + 15 + fw, 53, 20, 800, OP_C.gold2);
  cText(g, "매일 한 장 · 우상향연구소", P + tagW + 14, 53, 18, 700, OP_C.sub);
  cText(g, (mk ? mk.date : cDate(Date.now())), CARD.W - P, 53, 22, 800, OP_C.ink, "right");
  var hl = null; try { hl = typeof issHeadline === "function" ? issHeadline(iss || [], R, news || []) : null; } catch (e) {}
  var title = hl ? cPlain(hl.hook).replace(/\[\[|\]\]/g, "") : "오늘 " + mkName + " 시장 한 장";
  var ts = 50; while (ts > 34 && cWrapCount(g, title, W, ts, 900) > 2) ts -= 2;
  var ty = cWrap(g, title, P, 112, W, ts, 900, OP_C.ink, ts * 1.18, 2);
  cText(g, cFit(g, (hl && hl.sub ? hl.sub : "") + (hl && hl.sub ? "  ·  " : "") + "시장 · " + sec + " · 급등락 · 스크린 · 일정 · 시총 상위 · 상식을 한 장에", W, 18, 600), P, ty + 8, 18, 600, OP_C.ink2);
  var y = ty + 34, gap = 14, colW = (W - gap) / 2, L = P, Rx = P + colW + gap;
  // ── 1 시장 한눈에 (왼쪽, 지수 2 + 타일 6)
  var i0 = (R.indexRow || [])[0], i1 = (R.indexRow || [])[1];
  var h1 = 300, yy = opBox(g, L, y, colW, h1, 1, "시장 한눈에", "종가 · 전일 대비", mkc);
  [i0, i1].forEach(function (ix, k) { if (!ix) return; opTile(g, L + 12 + k * ((colW - 32) / 2 + 4), yy, (colW - 32) / 2, 72, ix.name, opPct(ix.ret), opCol(ix.ret), typeof cPrice === "function" ? cPrice(ix.sym, ix.last) : ""); });
  yy += 80;
  var macros = R.market === "coin" ? [["ETH-USD", "이더리움"], ["SOL-USD", "솔라나"], ["XRP-USD", "리플"], ["KRW=X", "원/달러"], ["^VIX", "공포지수"], ["GLD", "금"]] : R.market === "kr" ? [["KRW=X", "원/달러"], ["^VIX", "공포지수"], ["TLT", "미국 장기채"], ["GLD", "금"], ["USO", "원유"], ["^GSPC", "S&P500"]] : [["KRW=X", "원/달러"], ["^VIX", "공포지수"], ["TLT", "미국 장기채"], ["GLD", "금"], ["USO", "원유"], ["BTC-USD", "비트코인"]];
  var tw = (colW - 24 - 12) / 3;
  macros.forEach(function (m, k) { var s = st(m[0]); var val = !s ? "-" : m[0] === "KRW=X" ? Math.round(s.last).toLocaleString() + "원" : m[0] === "^VIX" ? s.last.toFixed(1) : opPct(s.ret1); var sub = !s ? "" : (m[0] === "KRW=X" || m[0] === "^VIX") ? opPct(s.ret1) : (typeof cPrice === "function" ? cPrice(m[0], s.last) : ""); opTile(g, L + 12 + (k % 3) * (tw + 6), yy + Math.floor(k / 3) * 78, tw, 72, m[1], val, s ? (m[0] === "^VIX" ? (s.last >= 25 ? OP_C.down : OP_C.ink) : opCol(s.ret1)) : OP_C.sub, sub); });
  // ── 2 시장 온도 (오른쪽)
  var h2 = h1, y2 = opBox(g, Rx, y, colW, h2, 2, "시장 온도", "오른 " + unit + " 비율", mkc);
  var upP = Math.round(t.upPct * 100);
  cText(g, upP + "%", Rx + 12, y2 + 46, 54, 900, upP >= 50 ? OP_C.up : OP_C.down);
  cText(g, " 올랐어요 · " + t.up + "/" + t.total + "개", Rx + 12 + cW(g, upP + "%", 54, 900), y2 + 46, 18, 600, OP_C.ink2);
  cRound(g, Rx + 12, y2 + 58, colW - 24, 14, 7, OP_C.downBg); cRound(g, Rx + 12, y2 + 58, Math.max(14, (colW - 24) * t.upPct), 14, 7, OP_C.up);
  cWrap(g, "시장은 " + t.word + " — " + (t.desc || ""), Rx + 12, y2 + 96, colW - 24, 16, 600, OP_C.ink2, 21, 2);
  var tiles2 = [["20일선 위", Math.round(t.abovePct * 100) + "%", "단기 추세"], ["200일선 위", t.n200 && t.above200Pct != null ? Math.round(t.above200Pct * 100) + "%" : "-", "장기 추세"], ["신고가 : 신저가", t.n200 ? t.newHigh.length + " : " + t.newLow.length : "-", "52주"]];
  tiles2.forEach(function (x, k) { opTile(g, Rx + 12 + k * (tw + 6), y2 + 140, tw, 72, x[0], x[1], OP_C.ink, x[2]); });
  y += h1 + gap;
  // ── 3 업종 성적표 (왼쪽) / 4 급등·급락 (오른쪽)
  var th = R.themes || [], h3 = 206, y3 = opBox(g, L, y, colW, h3, 3, sec + " 성적표", "1등 3 · 꼴찌 2", mkc);
  var rowsT = th.slice(0, 3).concat(th.slice(-2).reverse()), mxT = Math.max(0.01, Math.max.apply(null, rowsT.map(function (x) { return Math.abs(x.ret); })));
  rowsT.forEach(function (x, k) { var ry = y3 + 20 + k * 27; cText(g, cFit(g, (k < 3 ? (k + 1) + "등 " : "꼴찌 ") + x.name, 150, 17, 700), L + 12, ry, 17, 700, OP_C.ink); var bx = L + 168, bw = colW - 168 - 80; cRound(g, bx, ry - 12, bw, 12, 6, OP_C.bg); cRound(g, bx, ry - 12, Math.max(6, bw * Math.abs(x.ret) / mxT), 12, 6, x.ret >= 0 ? OP_C.up : OP_C.down); cText(g, opPct(x.ret), L + colW - 12, ry, 17, 800, opCol(x.ret), "right"); });
  var mv = R.movers || { up: [], down: [] }, y4 = opBox(g, Rx, y, colW, h3, 4, "급등 · 급락", "가장 많이 움직인 " + unit, mkc);
  function r1(s) { return s.ret1 != null ? s.ret1 : s.ret; }
  var half = (colW - 36) / 2;
  cText(g, "▲ 급등", Rx + 12, y4 + 14, 15, 800, OP_C.up); cText(g, "▼ 급락", Rx + 24 + half, y4 + 14, 15, 800, OP_C.down);
  mv.up.slice(0, 4).forEach(function (s, k) { opRow(g, Rx + 12, y4 + 44 + k * 32, half, briefName(s), opPct(r1(s)), OP_C.up, null, 17); });
  mv.down.slice(0, 4).forEach(function (s, k) { opRow(g, Rx + 24 + half, y4 + 44 + k * 32, half, briefName(s), opPct(r1(s)), OP_C.down, null, 17); });
  y += h3 + gap;
  // ── 5 매수 후보 스크린 (왼쪽) / 6 주의 스크린 (오른쪽)
  var sc = opScreens(R), h5 = 226;
  function drawScreen(x, no, title, groups, col, bg) {
    var yb = opBox(g, x, y, colW, h5, no, title, "복합 점수 + 하루 조건 · 판단은 본인", mkc);   // v12.25 머리는 먹색 통일, 안쪽 색으로 구분
    if (!groups.length) { cText(g, "오늘은 조건에 걸린 " + unit + "이 없어요", x + 12, yb + 30, 17, 600, OP_C.sub); return; }
    var gh = (h5 - 70) / groups.length;
    groups.forEach(function (gp, k) {
      var gy = yb + k * gh; cRound(g, x + 12, gy, colW - 24, gh - 8, 10, bg);
      cText(g, gp.t, x + 24, gy + 24, 17, 800, col); cText(g, gp.d + " · " + gp.n + "개", x + colW - 24, gy + 24, 13, 600, OP_C.sub, "right");
      gp.rows.forEach(function (r, j) { var rx = x + 24 + j * ((colW - 48) / 3), rw = (colW - 48) / 3 - 6; cText(g, cFit(g, r.name, rw, 16, 700), rx, gy + 50, 16, 700, OP_C.ink); cText(g, cFit(g, r.tag, rw, 13, 600), rx, gy + 68, 13, 600, OP_C.sub); });
    });
  }
  drawScreen(L, 5, "매수 후보 스크린", sc.buy, OP_C.up, OP_C.upBg);
  drawScreen(Rx, 6, "주의 " + unit + " 스크린", sc.warn, OP_C.down, OP_C.downBg);
  y += h5 + gap;
  // ── 7 오늘 일정 + 돈 몰린 곳 (왼쪽) / 8 오늘의 기사 (오른쪽)
  var h7 = 200, y7 = opBox(g, L, y, colW, h7, 7, "오늘 일정 · 돈 몰린 곳", "", mkc);
  var up = typeof pubUpcoming === "function" ? pubUpcoming(3).filter(function (e) { return e.k !== "hol"; }).slice(0, 2) : [];
  if (up.length) up.forEach(function (e, k) { opRow(g, L + 12, y7 + 22 + k * 28, colW - 24, e.d.slice(5).replace("-", "/") + "(" + pubDow(e.d) + ") " + String(e.t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim() + (e.sure === false ? " (예정)" : ""), "", null, null, 17); });
  else cText(g, "3일 안에 큰 일정 없음", L + 12, y7 + 22, 17, 600, OP_C.sub);
  var hv = (R.hotVol || []).slice(0, 3), hy = y7 + 22 + Math.max(1, up.length) * 28 + 6;
  g.fillStyle = OP_C.line; g.fillRect(L + 12, hy - 14, colW - 24, 1);
  cText(g, "💰 거래대금 평소 대비", L + 12, hy + 6, 14, 800, OP_C.sub);
  hv.forEach(function (s, k) { var rx = L + 12 + k * ((colW - 24) / 3); cText(g, cFit(g, briefName(s), (colW - 24) / 3 - 8, 16, 700), rx, hy + 30, 16, 700, OP_C.ink); cText(g, s.amtX.toFixed(1) + "배 · " + opPct(r1(s)), rx, hy + 48, 13, 600, opCol(r1(s))); });
  // v12.25 8 = 시가총액 상위 8 (기사 칸을 대신) — 약자 배지 + 이름 + 하루 등락
  var cap = typeof cCap8 === "function" ? cCap8(R.market === "coin" ? "coin" : R.market === "kr" ? "kr" : "us") : { rows: [], src: "" };
  var y8 = opBox(g, Rx, y, colW, h7, 8, "시가총액 상위 8", cap.src, mkc);
  if (cap.rows.length) {
    var cc = 2, cwid = (colW - 24 - 10) / cc, rh8 = Math.min(34, Math.floor((h7 - 70) / Math.ceil(Math.min(8, cap.rows.length) / cc)));
    cap.rows.slice(0, 8).forEach(function (k, i) {
      var cx = Rx + 12 + (i % cc) * (cwid + 10), cy = y8 - 10 + Math.floor(i / cc) * rh8, bz = rh8 - 6;
      if (typeof cMono === "function") cMono(g, cx, cy, bz, k.sym, k.name);
      var pc = opPct(k.ret), pw = cW(g, pc, 17, 800);
      cText(g, cFit(g, k.name, cwid - bz - pw - 20, 16, 700), cx + bz + 8, cy + bz / 2 + 6, 16, 700, OP_C.ink);
      cText(g, pc, cx + cwid, cy + bz / 2 + 6, 17, 800, opCol(k.ret), "right");
    });
  } else cText(g, "시가총액 상위 종목 숫자가 아직 없어요", Rx + 12, y8 + 24, 16, 600, OP_C.sub);
  y += h7 + gap;
  // ── 9 오늘의 한 줄 상식 (가로 전체)
  var tips = OP_TIPS.common.concat(OP_TIPS[R.market === "coin" ? "coin" : R.market === "us" ? "us" : "kr"] || []), tip = tips[opSeed() % tips.length];
  var h9 = CARD.H - 66 - y; if (h9 > 60) {
    cRound(g, P, y, W, h9, 14, OP_C.goldBg, OP_C.gold2);
    cRound(g, P + 14, y + 12, 116, 30, 15, OP_C.gold); cText(g, "9 · 한 줄 상식", P + 72, y + 33, 15, 900, "#1c2333", "center");
    cText(g, cFit(g, tip[0], W - 160, 22, 900), P + 142, y + 34, 22, 900, OP_C.ink);
    cWrap(g, tip[1], P + 14, y + 62, W - 28, 16, 500, OP_C.ink2, 21, 2);
  }
  // ── 바닥
  cText(g, "종가 기준 자동 집계 · 선별 " + unit + "은 여러 데이터로 고른 후보이며 판단·책임은 본인에게 · 세금·제도 숫자는 최신 공지 확인 · 투자 권유 아님", P, CARD.H - 24, 14, 500, OP_C.sub);
  cText(g, "@uphill.lab", CARD.W - P, CARD.H - 24, 18, 900, OP_C.ink, "right");
  return cv;
}

/* ---------- 열기 ---------- */
function onePageOpen(btn) {
  var R = briefState.result; if (!R) { alert("오늘의 브리핑 데이터를 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요."); return; }
  if (R.marketWideOff) { alert("오늘 한 장을 만들 수 없어요 — " + ((R.basis && R.basis.why) || "전체 시장 요약 준비 중") + ".\n틀린 숫자를 피하려고 전체 시장 숫자가 맞춰질 때까지 막아 두었어요."); return; }
  var old = btn ? btn.innerHTML : ""; if (btn) btn.textContent = "만드는 중…";
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return Promise.all([typeof cardsNewsFetch === "function" ? cardsNewsFetch(R).catch(function () { return []; }) : [], typeof pkEnsure === "function" ? pkEnsure(R).catch(function () { return null; }) : null]); }).then(function () {
    var iss = []; try { iss = issuesCompute(briefState.recent, { market: briefState.market, popular: briefState.popular }); } catch (e) {}
    var news = (typeof CARD_NEWS !== "undefined" && CARD_NEWS.items) || [];
    var keep = CARD_MKT; CARD_MKT = cMktInfo(R);
    var draw = function () { return onePageCard(R, iss, news); };
    CARD_TXT = ""; try { draw(); } catch (e) { console.warn(e); }
    var txt = CARD_TXT.replace(/\s+/g, "");
    var fl = document.fonts && document.fonts.load ? Promise.all([500, 600, 700, 800, 900].map(function (w) { return document.fonts.load(w + ' 40px "Pretendard Variable"', txt).catch(function () {}); })) : Promise.resolve();
    return fl.then(function () {
      var cv; try { cv = draw(); } finally { CARD_MKT = keep; }
      if (btn) btn.innerHTML = old;
      var url = cv.toDataURL("image/png"), day = pubToday().replace(/-/g, ""), mk = cMktInfo(R), box = document.createElement("div");
      var file = "uphill.lab_오늘한장_" + (mk ? mk.name : "전체") + "_" + day + ".png";
      box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:10px"><button class="primary" data-act="save">⬇ 저장</button>' + (navigator.canShare ? '<button class="chip" data-act="share">↗ 공유</button>' : '') + '<span class="briefDim">1080×1350 · 게시물·릴스 표지로 · 선별 종목은 추세·RSI·대금·재무·기사를 겹쳐 고른 후보 · 판단과 책임은 본인에게</span></div><img alt="" style="width:100%;max-width:520px;border-radius:12px;display:block;margin:0 auto;box-shadow:0 4px 18px rgba(0,0,0,.2)">';
      box.querySelector("img").src = url;
      box.querySelector('[data-act="save"]').onclick = function () { cardsDownload({ url: url, file: file }); };
      var sh = box.querySelector('[data-act="share"]'); if (sh) sh.onclick = function () { cv.toBlob(function (b) { var f = new File([b], file, { type: "image/png" }); if (navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(function () {}); }); };
      if (typeof thrPanelHtml === "function" && typeof hubThreadsAuto === "function") { var tpd = document.createElement("div"); tpd.innerHTML = thrPanelHtml("주식"); box.appendChild(tpd.firstChild); try { thrBind(box, hubThreadsAuto("오늘 한 장 · " + (mk ? mk.name : "전체"), [{ name: "오늘 한 장" }], { lines: (typeof issuesForBrief === "function" ? [] : []).concat(R && R.indexRow ? R.indexRow.slice(0, 3).map(function (x) { return x.name + " " + briefPct(x.ret); }) : []).concat(R && R.temp ? ["오른 종목 " + Math.round(R.temp.upPct * 100) + "%"] : []) })); } catch (e) {} }   // v12.21 캡션·스레드 글
      infoModal.open("📄 오늘 한 장 · " + (mk ? mk.name : "전체"), box);
    });
  }).catch(function (e) { if (btn) btn.innerHTML = old; alert("만들지 못했어요: " + e.message); });
}
