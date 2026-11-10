/* ============================================================
   v12.91 데이터 센터 보강 — 한눈에 보는 상태표 · 수집 일정 · 수집 이력 · 키 유효기간
   ① 상태표: 데이터 종류마다 '주기 · 마지막 최신화 · 문제 · 다음 예정 · 늦었을 때 할 일'을 한 줄씩
   ② 일정: 매일 · 매주 · 매월 · 분기 · 연 단위로 무엇이 자동이고 무엇을 손으로 해야 하는지
   ③ 이력: 최근 30번 자동 · 수동 수집의 결과와 문제 (서버가 남긴 기록)
   ④ 키: 연동 키마다 설정 여부 · 만료 규칙 · 내가 적어 둔 만료/점검일 · 남은 날 · 갱신 방법 (+ 달력 파일)
   키 '값'은 어디에도 나오지 않는다. 날짜 메모만 이 기기와 서버 설정(cfg:keydates)에 저장한다.
   ============================================================ */
var DX = { dates: null, loaded: false };
function dxEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
function dxToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function dxAdd(d, n) { var p = d.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10); }
function dxDow(d) { var p = d.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }
function dxDiff(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / 86400e3); }
function dxMD(d) { if (!d) return "-"; var p = String(d).slice(0, 10).split("-"); return (+p[1]) + "/" + (+p[2]) + "(" + "일월화수목금토"[dxDow(String(d).slice(0, 10))] + ")"; }
/* 그 시장이 쉬는 날인가 — 주말 + 일정 목록의 휴장일 */
function dxOff(mk, d) {
  var w = dxDow(d); if (w === 0 || w === 6) return true;
  var flag = mk === "kr" ? "🇰🇷" : "🇺🇸", cal = typeof PUB_CAL !== "undefined" ? PUB_CAL : [];
  for (var i = 0; i < cal.length; i++) if (cal[i].d === d && cal[i].k === "hol" && cal[i].t.indexOf(flag) >= 0) return true;
  return false;
}
/* 지금 '있어야 할' 마지막 거래일 — 마지막 자동 수집(07:00 KST)이 끝난 시점 기준.
   국내: 수집일 전날까지의 마지막 장 · 미국: 수집일 전날(현지 날짜)까지의 마지막 장(한국 새벽에 마감) */
function dxExpected(mk) {
  var now = new Date(Date.now() + 9 * 3600e3), mins = now.getUTCHours() * 60 + now.getUTCMinutes(), today = now.toISOString().slice(0, 10);
  var cronDay = mins >= 7 * 60 + 30 ? today : dxAdd(today, -1), d = dxAdd(cronDay, -1), guard = 0;
  while (dxOff(mk, d) && guard++ < 12) d = dxAdd(d, -1);
  return d;
}
function dxAgo(ms) { if (!ms) return ""; var h = (Date.now() - ms) / 3600e3; return h < 1 ? Math.max(1, Math.round(h * 60)) + "분 전" : h < 48 ? Math.round(h) + "시간 전" : Math.round(h / 24) + "일 전"; }
function dxBadge(lv, t) { return '<span class="dhBadge ' + (lv === "ok" ? "ok" : lv === "bad" ? "bad" : lv === "warn" ? "warn" : "") + '">' + (lv === "ok" ? "✓ " : lv === "bad" ? "✗ " : lv === "warn" ? "⚠️ " : "") + dxEsc(t) + '</span>'; }
function dxNextCron() { var now = new Date(Date.now() + 9 * 3600e3), h = now.getUTCHours() + now.getUTCMinutes() / 60; return h < 7 ? "오늘 07:00" : h < 9 ? "오늘 09:00" : "내일 07:00"; }

/* ---------- ① 한눈에 보는 상태표 ---------- */
function dxRows(Ms, recent) {
  var C = (typeof DATA !== "undefined" && DATA.config) || {}, K = C.keys || {}, lr = C.lastRun || {}, E = (typeof DH !== "undefined" && DH.ext) || {}, rows = [], NM = { kr: "국내", us: "미국", coin: "코인" };
  var genMs = recent && recent.generated ? Date.parse(recent.generated) : 0, nextC = dxNextCron();
  (Ms || []).forEach(function (M) {
    var lv = M.err ? "bad" : M.level === "ok" ? "ok" : "warn", why = M.err ? "계산 실패" : M.late ? dxMD(M.exp) + " 장이 없음" : M.stale && M.stale.length ? "늦은 종목 " + M.stale.length + "개" : M.coinLate ? "어제 마감분 없음" : M.spike && M.spike.length ? "급변 의심 " + M.spike.length + "개" : M.mk !== "coin" && M.off ? "전체 시장 숫자 숨김" : "정상";
    rows.push({ g: "시세", n: NM[M.mk] + " 시세 (대표 목록 " + (M.count || "-") + "개)", cyc: "매일 07:00 · 09:00 자동", last: (M.date ? dxMD(M.date) + (M.mk === "coin" ? " 9시 마감" : " 종가") : "-") + (genMs ? '<small>수집 ' + dxAgo(genMs) + '</small>' : ''), lv: lv, why: why, next: nextC, fix: lv === "ok" ? "" : M.mk !== "coin" && M.off && !M.late && !(M.stale && M.stale.length) ? "uni-" + M.mk : "snap" });
    if (M.mk !== "coin") { var U = M.uni, ex = typeof dxExpected === "function" ? dxExpected(M.mk) : "", ud = U && (U.asOfD || ""), ulv = !U ? "warn" : U.ver !== 2 || (ex && ud && ud < ex) || (U.lagN || 0) > U.n * 0.2 ? "warn" : "ok";
      rows.push({ g: "시세", n: M.mk === "us" ? "미국 전체 시장 요약 (S&P 500)" : "국내 전체 시장 요약 (코스피 시총상위 200)", cyc: M.mk === "us" ? "매일 07:00 + 09:00 자동" : "매일 07:00 자동", last: U ? dxMD(ud) + '<small>' + U.n + '종목' + (U.generated ? ' · 수집 ' + dxAgo(Date.parse(U.generated)) : '') + '</small>' : "-", lv: ulv, why: !U ? "못 불러옴" : U.ver !== 2 ? "옛 방식" : ex && ud && ud < ex ? dxMD(ex) + " 장이 없음" : (U.lagN || 0) > U.n * 0.2 ? "하루 늦은 종목 " + U.lagN + "개" : "정상", next: nextC, fix: ulv === "ok" ? "" : "uni-" + M.mk }); }
  });
  var hs = C.symbols || 0, wh = C.withHistory || 0;
  rows.push({ g: "시세", n: "과거 25년 일봉 파일", cyc: "실행마다 20종목씩 돌아가며 (전 종목 한 바퀴 약 " + (hs ? Math.ceil(hs / 40) : "-") + "일)", last: wh + " / " + hs + "종목 보유" + (lr.historyUpdated != null ? '<small>지난 실행 ' + lr.historyUpdated + '종목 갱신</small>' : ''), lv: hs && wh >= hs ? "ok" : hs && wh >= hs * 0.95 ? "ok" : "warn", why: hs && wh < hs * 0.95 ? "없는 종목 " + (hs - wh) + "개" : lr.historyFailed ? "지난 실행 실패 " + lr.historyFailed + "개" : "정상", next: nextC, fix: hs && wh < hs * 0.95 ? "snap" : "" });
  /* 매크로: 지표마다 마지막 자료 날짜 */
  var M = E.macro, ser = (M && M.series) || {}, need = { krw: ["원/달러(한국은행)", 5], us10y: ["미 10년 금리", 7], m2: ["미 M2(월)", 75] }, today = dxToday(), mBad = [], mTxt = [];
  Object.keys(need).forEach(function (k) { var s = ser[k], a = s && (Array.isArray(s) ? s : s.d || s.rows), r = a && a.length ? String(a[a.length - 1][0]) : "", d = r.length >= 8 ? r.slice(0, 4) + "-" + r.slice(4, 6) + "-" + r.slice(6, 8) : ""; mTxt.push(need[k][0] + " " + (d ? dxMD(d) : "없음")); if (!d || dxDiff(today, d) > need[k][1]) mBad.push(need[k][0]); });
  ["bok", "fed"].forEach(function (k) { var s = ser[k], a = s && (Array.isArray(s) ? s : s.d || s.rows); if (!a || !a.length) mBad.push(k === "bok" ? "한국 기준금리" : "미 기준금리"); });
  var mErr = M && M.log && M.log.errors && M.log.errors.length ? M.log.errors[0] : "";
  rows.push({ g: "경제 지표", n: "환율 · 금리 · M2", cyc: "매일 07:00 자동 (지표마다 하루 한 번)", last: (M && M.updated ? '수집 ' + dxAgo(Date.parse(M.updated)) : "-") + '<small>' + mTxt.join(" · ") + '</small>', lv: !M ? "warn" : mBad.length || mErr ? "warn" : "ok", why: !M ? "못 불러옴" : mBad.length ? "오래됨: " + mBad.join(", ") : mErr ? "오류: " + String(mErr).slice(0, 60) : "정상", next: nextC, fix: !M || mBad.length || mErr ? "macro" : "" });
  var ext = function (g, n, doc, cyc, maxH, fix, extra) { var u = doc && (doc.updated || doc.generated || doc.at), h = u ? (Date.now() - Date.parse(u)) / 3600e3 : null, er = doc && doc.log && doc.log.errors && doc.log.errors.length ? doc.log.errors[0] : ""; rows.push({ g: g, n: n, cyc: cyc, last: (u ? dxAgo(Date.parse(u)) : "-") + (extra ? '<small>' + extra + '</small>' : ''), lv: !doc ? "warn" : h > maxH || er ? "warn" : "ok", why: !doc ? "없음" : h > maxH ? Math.round(h / 24) + "일째 그대로" : er ? "오류: " + String(er).slice(0, 60) : "정상", next: nextC, fix: !doc || h > maxH || er ? fix : "" }); };
  ext("공시 · 기관", "국내 공시 (지분 · 자사주)", E.disc, "매일 자동 (수집 끝 남는 시간)", 54, "dart", E.disc && E.disc.n != null ? E.disc.n + "건" : "");
  ext("공시 · 기관", "공모주 일정 · 수익률", E.ipo, "매일 자동 (수집 끝 남는 시간)", 54, "ipo", "");
  var G = E.guru, gu = G && G.updated ? (Date.now() - Date.parse(G.updated)) / 86400e3 : null;
  rows.push({ g: "공시 · 기관", n: "구루 13F (분기 보고)", cyc: "분기마다 (2 · 5 · 8 · 11월 중순 공개)" + (G && G.via === "github" ? " · 지금은 손으로 실행" : ""), last: G && G.updated ? dxAgo(Date.parse(G.updated)) + (G.via ? '<small>경로: ' + dxEsc(G.via) + '</small>' : '') : "-", lv: !G ? "warn" : gu > 110 ? "warn" : "ok", why: !G ? "없음" : gu > 110 ? Math.round(gu) + "일째 그대로 — 새 분기분 확인 필요" : "정상", next: dxNext13F(), fix: !G || gu > 110 ? "sec" : "" });
  /* 국내 마감 자료(네이버 순위 · 수급) */
  var KD = typeof KRX !== "undefined" ? (KRX.data || (typeof krxCached === "function" ? krxCached() : null)) : null, kw = KD && typeof krxWhy === "function" ? krxWhy(KD) : "";
  rows.push({ g: "네이버", n: "국내 급등락 · 외국인/기관 수급", cyc: "작업실에서 받을 때 (20분 보관)", last: KD ? dxAgo(KD.at) + (KD.tradeDay ? '<small>' + dxMD(KD.tradeDay) + ' 장' + (KD.live ? ' · 장중' : '') + '</small>' : '') : "오늘 안 받음", lv: !KD ? "" : kw || (KD.miss && KD.miss.length) ? "warn" : "ok", why: !KD ? "작업실 ①에서 받기" : kw ? kw : KD.miss && KD.miss.length ? "못 읽은 칸 " + KD.miss.length + "개: " + KD.miss.slice(0, 2).join(" / ") : "정상", next: "필요할 때", fix: "kr" });
  rows.push({ g: "네이버", n: "뉴스 검색", cyc: "화면을 열 때 실시간 (30분 보관)", last: "실시간", lv: K.naverHub ? "ok" : K.naverDev ? "warn" : "bad", why: K.naverHub ? "HUB 키 사용 중" : K.naverDev ? "구 키 사용 중 — HUB 키로 교체 필요" : "키 없음", next: "-", fix: "" });
  rows.push({ g: "네이버", n: "종목 지표 · 재무 · 목표주가", cyc: "종목을 열 때 실시간 (30분 보관)", last: "실시간", lv: "", why: "키 없이 공개 화면에서 읽음 — 네이버가 주소를 바꾸면 빈칸이 됨", next: "-", fix: "" });
  /* 손으로 넣는 것 */
  var cal = typeof PUB_CAL !== "undefined" ? PUB_CAL : [], hand = cal.filter(function (e) { return e.k !== "hol" && !e.sure && e.src && !/공개 일정/.test(e.src); }).map(function (e) { return e.d; }).sort(), lastHand = hand.length ? hand[hand.length - 1] : "", allLast = cal.map(function (e) { return e.d; }).sort().slice(-1)[0] || "", dh = lastHand ? dxDiff(lastHand, today) : -1;
  rows.push({ g: "손으로", n: "경제 일정 (CPI · 고용 · 실적 등 직접 넣은 것)", cyc: "한 달에 한 번 손으로", last: lastHand ? dxMD(lastHand) + "까지" + '<small>FOMC · 금통위 · 휴장은 ' + dxMD(allLast) + '까지 자동</small>' : "-", lv: dh >= 30 ? "ok" : "warn", why: dh >= 30 ? "정상" : dh >= 0 ? "앞으로 " + dh + "일치뿐 — 다음 달 일정 추가" : "직접 넣은 일정이 지났어요", next: "매달 말", fix: "" });
  var dl = null; try { dl = JSON.parse(localStorage.getItem("sm.dailyManual:" + today) || "null"); } catch (e) {}
  rows.push({ g: "손으로", n: "오늘 브리핑 (Claude 답 붙여넣기)", cyc: "매일 아침 손으로", last: dl && dl.out ? "오늘 적용함" : dl ? "프롬프트만 만듦" : "오늘 아직", lv: dl && dl.out ? "ok" : "", why: dl && dl.out ? "정상" : "작업실 ②에서 진행", next: "내일 아침", fix: "" });
  return rows;
}
function dxNext13F() { var t = dxToday(), y = +t.slice(0, 4), c = [y + "-02-14", y + "-05-15", y + "-08-14", y + "-11-14", (y + 1) + "-02-14"]; for (var i = 0; i < c.length; i++) if (c[i] >= t) return dxMD(c[i]) + " 무렵"; return "-"; }
function dxTopHtml(Ms, recent) {
  var R = dxRows(Ms, recent), bad = R.filter(function (r) { return r.lv === "warn" || r.lv === "bad"; }), BT = { snap: "☀️ 아침 수집", "uni-us": "🇺🇸 요약 받기", "uni-kr": "🇰🇷 요약 받기", macro: "📉 매크로 수집", dart: "📑 공시 수집", sec: "🧓 13F 수집", ipo: "🆕 공모주 수집" };
  var K = dxKeyState(), kd = K.filter(function (k) { return k.lv === "warn" || k.lv === "bad"; });
  var h = '<h3 class="dhH">⓪ 한눈에 보기 <small>종류마다 주기 · 마지막 최신화 · 문제 · 다음 예정</small></h3>';
  h += '<div class="dxSum ' + (bad.length || kd.length ? "warn" : "ok") + '">' + (bad.length ? '<b>확인할 곳 ' + bad.length + '개</b> — ' + bad.slice(0, 4).map(function (r) { return dxEsc(r.n.replace(/\s*\(.*\)$/, "")) + ": " + dxEsc(r.why); }).join(" · ") : '<b>데이터 ' + R.length + '종류 모두 정상</b>') + (kd.length ? ' · <b>키 점검 ' + kd.length + '개</b> — ' + kd.slice(0, 3).map(function (k) { return dxEsc(k.name) + " " + dxEsc(k.badge); }).join(" · ") + ' <a href="#dxKeys">아래 ⑥</a>' : '') + '</div>';
  var g0 = "";
  h += '<div class="dxWrap"><table class="dgT dxT"><thead><tr><th>데이터</th><th>주기</th><th>마지막 최신화</th><th>상태</th><th>다음 예정</th><th>늦었을 때</th></tr></thead><tbody>' + R.map(function (r) {
    var head = r.g !== g0 ? '<tr class="dxG"><td colspan="6">' + dxEsc(r.g) + '</td></tr>' : ""; g0 = r.g;
    var fix = r.fix === "kr" ? '<button class="chip" onclick="navTo(\'ops\')">작업실에서 받기</button>' : r.fix && BT[r.fix] ? '<button class="chip" data-dh="' + r.fix + '">' + BT[r.fix] + '</button>' : '<span class="briefDim">-</span>';
    return head + '<tr class="' + (r.lv === "warn" || r.lv === "bad" ? "dxBad" : "") + '"><td class="dgName"><b>' + dxEsc(r.n) + '</b></td><td>' + dxEsc(r.cyc) + '</td><td class="dxLast">' + r.last + '</td><td>' + dxBadge(r.lv, r.lv === "ok" ? "정상" : r.lv ? "확인" : "참고") + (r.why && r.why !== "정상" ? '<small>' + dxEsc(r.why) + '</small>' : '') + '</td><td>' + dxEsc(r.next) + '</td><td>' + fix + '</td></tr>';
  }).join("") + '</tbody></table></div>';
  return h;
}

/* ---------- ② 일정 · ③ 이력 · ④ 키 ---------- */
var DX_SCHED = [
  ["매일 07:00", "자동", "대표 목록 시세(최근 400일) → 늦은 종목 메우기 → 환율·금리·공시·공모주·13F 확인 → 과거 25년 파일 20종목 → 국내 전체 요약 → 미국 전체 요약", "07:30 이후 데이터 센터가 '정상'인지 한 번 보기"],
  ["매일 09:00", "자동", "코인 먼저(오전 9시 마감분) → 나머지 시세 → 미국 전체 요약 나머지", "09:20 뒤에도 코인이 어제 마감분이 아니면 ☀️ 아침 수집"],
  ["매일 아침", "손으로", "작업실 ① 확인 → ② 오늘 브리핑(프롬프트 복사 → Claude 답 붙여넣기) → ③ 카드 · 리포트", "국내 급등락 · 수급은 작업실에서 '받기'를 눌러야 와요"],
  ["매주 월요일", "손으로", "지난주 올린 글 성과 기록 · 이번 주 일정(실적 · 지표) 확인", "일정이 2주치 아래면 다음 달 일정 추가"],
  ["매월 1일", "손으로", "🔍 과거 데이터 전체 점검(30~50초) · 분석 기록 백업 · 경제 일정 다음 달 치 추가 · Upstash 사용량 · AI 사용 요금 확인", "점검에서 'serious'로 나온 종목만 확인"],
  ["분기 (2 · 5 · 8 · 11월 중순)", "손으로", "🧓 구루 13F 수집 · 키 점검(아래 ⑥ '점검 완료' 누르기) · 미국 시총 상위 10 목록 확인", "13F는 공개 뒤 며칠 안에 한 번"],
  ["연 1회 (12월)", "손으로", "내년 FOMC · 금통위 · 휴장일 목록 추가(publish.js) · 종목 사전(tickers.js) 정리 · 운영자 키 교체 검토", "휴장일 목록이 끝나면 '있어야 할 거래일' 계산이 틀려져요"]
];
function dxSchedHtml() { return '<div class="dxWrap"><table class="dgT"><thead><tr><th>언제</th><th>누가</th><th>무엇을</th><th>확인할 것</th></tr></thead><tbody>' + DX_SCHED.map(function (r) { return '<tr><td class="dgName"><b>' + r[0] + '</b></td><td>' + (r[1] === "자동" ? '<span class="dgOk">자동</span>' : '<span class="dgNo">손으로</span>') + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join("") + '</tbody></table></div>'; }
function dxRunsHtml() {
  var C = (typeof DATA !== "undefined" && DATA.config) || {}, runs = C.runs || [];
  if (!runs.length) return '<div class="briefDim">아직 기록이 없어요 — 이번 버전의 서버 파일(api/cron-snapshot.js · api/config.js)을 올린 뒤 첫 수집부터 쌓여요. (최근 30번, 40일 보관)</div>';
  var cell = function (v) { return v === "ok" ? '<span class="dgOk">✓</span>' : v === "fail" ? '<span class="dgNo">✗</span>' : v === "skip" ? '<span class="dxSkip">건너뜀</span>' : v === "same" ? '<span class="briefDim">오늘 받음</span>' : v ? '<span class="dgOk">' + dxEsc(v) + '</span>' : '<span class="briefDim">-</span>'; };
  var badN = runs.filter(function (r) { return r.p && r.p.length; }).length;
  return '<div class="briefDim" style="margin-bottom:6px">최근 ' + runs.length + '번 중 문제가 있었던 실행 <b>' + badN + '번</b> · 시각은 한국 시간</div><div class="dxWrap"><table class="dgT dxT"><thead><tr><th>언제</th><th>종류</th><th>시세</th><th>걸린 시간</th><th>전체 요약</th><th>매크로</th><th>공시</th><th>13F</th><th>공모주</th><th>문제</th></tr></thead><tbody>' + runs.slice(0, 30).map(function (r) {
    return '<tr class="' + (r.p && r.p.length ? "dxBad" : "") + '"><td class="dgName">' + dxEsc(String(r.at).slice(5, 16)) + '</td><td>' + (r.by === "manual" ? "수동" : "자동") + '</td><td>' + (r.ok != null ? r.ok + "종목" + (r.kept ? ' <small>못 받음 ' + r.kept + '</small>' : '') + (r.behind ? ' <small class="dgNo">늦음 ' + r.behind + '</small>' : '') : "-") + '</td><td>' + (r.ms ? Math.round(r.ms / 1000) + "초" : "-") + '</td><td>' + cell(r.uni) + '</td><td>' + cell(r.macro) + '</td><td>' + cell(r.dart) + '</td><td>' + cell(r.sec) + '</td><td>' + cell(r.ipo) + '</td><td>' + (r.p && r.p.length ? r.p.map(dxEsc).join("<br>") : '<span class="dgOk">없음</span>') + '</td></tr>';
  }).join("") + '</tbody></table></div>';
}
/* 키 목록 — has: /api/config 의 keys 이름 · rule: 만료 규칙 · how: 갱신 방법 · def: 미리 적어 둔 날짜(있을 때만) */
var DX_KEYS = [
  { id: "naverDev", name: "네이버 검색 (구 개발자센터 키)", env: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET", rule: "구 개발자센터 검색 API는 종료 예정 — 앱에 적어 둔 종료일 2027-06-30 (네이버 공지에서 최종 확인)", def: "2027-06-30", how: "네이버 클라우드 콘솔 → API HUB 이용 신청 → Application 등록 → 새 Client ID/Secret을 NAVER_HUB_KEY_ID / NAVER_HUB_KEY 로 넣고 Redeploy. 구 키는 새 주소에서 쓸 수 없어요.", url: "https://guide.ncloud-docs.com/docs/apihub-migration", optional: true },
  { id: "naverHub", name: "네이버 검색 (API HUB 키)", env: "NAVER_HUB_KEY_ID / NAVER_HUB_KEY", rule: "키 자체의 만료일은 안내돼 있지 않음 — 이용 요금 · 한도는 콘솔에서 확인", how: "네이버 클라우드 콘솔 → API HUB → Application → 인증 정보. 뉴스가 갑자기 비면 여기부터 확인.", url: "https://guide.ncloud-docs.com/docs/apihub-overview" },
  { id: "anthropic", name: "Claude API", env: "ANTHROPIC_API_KEY", rule: "키는 지우기 전까지 유효. 끊기는 원인은 대개 잔액 — 선불 크레딧의 만료일은 콘솔 Billing에 표시돼요", how: "platform.claude.com → Billing에서 잔액 · 크레딧 만료일 확인 → 아래 '내 만료일'에 적어 두기. 키 교체: API Keys → 새 키 → Vercel 환경변수 교체 → Redeploy.", url: "https://platform.claude.com" },
  { id: "openai", name: "OpenAI API (카드 그림)", env: "OPENAI_API_KEY", rule: "키는 지우기 전까지 유효. 선불 크레딧의 만료일은 Billing 화면에 표시돼요", how: "platform.openai.com → Billing에서 잔액 · 만료일 확인 → 아래에 적어 두기.", url: "https://platform.openai.com" },
  { id: "dart", name: "DART 공시", env: "DART_API_KEY", rule: "만료일이 따로 안내되지 않는 인증키(하루 요청 한도 있음) — 상태는 opendart 마이페이지에서 확인", how: "opendart.fss.or.kr → 인증키 신청/관리. 공시 줄에 'DART_0xx' 오류가 보이면 키 상태 확인.", url: "https://opendart.fss.or.kr" },
  { id: "ecos", name: "한국은행 ECOS", env: "ECOS_API_KEY", rule: "만료일이 따로 안내되지 않는 인증키 — 상태는 ECOS 마이페이지에서 확인", how: "ecos.bok.or.kr → Open API → 인증키 관리. 환율 날짜가 며칠째 그대로면 확인.", url: "https://ecos.bok.or.kr/api/" },
  { id: "fred", name: "미국 FRED", env: "FRED_API_KEY", rule: "만료일이 따로 안내되지 않는 키. 없으면 공개 CSV로 받지만 막히는 날이 있어 등록 권장", how: "fred.stlouisfed.org → My Account → API Keys.", url: "https://fred.stlouisfed.org/docs/api/api_key.html", optional: true },
  { id: "secUa", name: "SEC 접속 표시 (키 아님)", env: "SEC_UA", rule: "만료 없음. 이메일이 들어간 접속 표시가 없으면 SEC가 거절", how: "\"StockMind 연락용이메일\" 형식. 13F가 계속 실패하면 값 확인.", optional: true },
  { id: "redis", name: "Upstash Redis (모든 저장소)", env: "KV_REST_API_URL / KV_REST_API_TOKEN", rule: "토큰 만료 없음. 무료 DB는 30일 넘게 사용이 없으면 보관 처리될 수 있음(매일 수집이 돌면 해당 없음) · 사용량 한도는 콘솔 Usage에서 확인", how: "console.upstash.com → 데이터베이스 → Usage. 한도에 가까우면 수집 횟수를 줄이거나 유료 전환.", url: "https://upstash.com/docs/redis/help/faq" },
  { id: "cron", name: "CRON_SECRET (자동 수집 보호)", env: "CRON_SECRET", rule: "직접 정한 값 — 만료 없음. 바꾸면 운영자 토큰이 모두 풀려요", how: "바꿀 일이 생기면 Vercel 환경변수 교체 → Redeploy → 이 기기에서 운영자 다시 잠금 해제." },
  { id: "owner", name: "OWNER_KEY (운영자 잠금 해제)", env: "OWNER_KEY", rule: "직접 정한 값 — 만료 없음. 1년에 한 번 교체 권장", how: "Vercel 환경변수 교체 → Redeploy → 주소 끝에 ?owner 로 다시 입력.", optional: true },
  { id: "salt", name: "USER_SALT (사용자 동기화)", env: "USER_SALT", rule: "절대 바꾸지 않는 값 — 바꾸면 모든 사용자의 저장 데이터를 못 읽어요", how: "교체 대상 아님. 확인만.", fixed: true }
];
function dxDatesLoad() { if (DX.dates) return DX.dates; var d = {}; try { d = JSON.parse(localStorage.getItem("sm.keydates") || "{}") || {}; } catch (e) {} DX.dates = d; return d; }
function dxDatesSave() { try { localStorage.setItem("sm.keydates", JSON.stringify(DX.dates || {})); } catch (e) {} if (typeof smKvPut === "function") smKvPut("cfg:keydates", DX.dates || {}); }
function dxKeyState() {
  var C = (typeof DATA !== "undefined" && DATA.config) || {}, K = C.keys || {}, D = dxDatesLoad(), today = dxToday();
  return DX_KEYS.map(function (k) {
    var has = K[k.id], exp = (D[k.id] && D[k.id].exp) || (k.def && has ? k.def : ""), chk = (D[k.id] && D[k.id].chk) || "", left = exp ? dxDiff(exp, today) : null, since = chk ? dxDiff(today, chk) : null, lv = "ok", badge = "";
    if (has == null) { lv = ""; badge = "확인 불가"; }
    else if (k.id === "naverHub" && !has) { lv = K.naverDev ? "warn" : "bad"; badge = K.naverDev ? "구 키로 동작 중 — 전환 필요" : "없음 (뉴스 안 나옴)"; }
    else if (k.id === "naverDev" && !has) { lv = ""; badge = K.naverHub ? "필요 없음" : "미설정"; }
    else if (!has) { lv = k.optional ? "" : "bad"; badge = k.optional ? "미설정(선택)" : "없음"; }
    else if (k.id === "naverDev" && K.naverHub) { lv = "ok"; badge = "HUB 키로 이미 전환됨"; exp = ""; left = null; }
    else if (left != null && left < 0) { lv = "bad"; badge = "만료일 지남 (" + (-left) + "일)"; }
    else if (left != null && left <= 30) { lv = "warn"; badge = "D-" + left; }
    else if (left != null) { lv = "ok"; badge = "D-" + left; }
    else if (k.fixed) { lv = "ok"; badge = "설정됨"; }
    else if (since == null) { lv = "warn"; badge = "점검한 적 없음"; }
    else if (since > 100) { lv = "warn"; badge = "점검 " + since + "일 전"; }
    else { lv = "ok"; badge = "점검 " + since + "일 전"; }
    return { k: k, name: k.name, has: has, exp: exp, chk: chk, left: left, lv: lv, badge: badge, note: (D[k.id] && D[k.id].note) || "" };
  });
}
function dxKeysHtml() {
  var S = dxKeyState();
  var h = '<div class="dgIntro">키의 <b>값</b>은 여기에 나오지 않아요(있는지만 표시). 발급처가 만료일을 알려 주지 않는 키가 많아서, <b>내가 확인한 만료일</b>(선불 크레딧 · 구 키 종료일 등)을 적어 두면 남은 날을 세어 30일 전부터 맨 위에 알려 줘요. 만료일이 없는 키는 <b>분기에 한 번 점검</b>하고 「점검 완료」를 눌러 두세요. 날짜 메모는 이 기기와 서버 설정에만 저장돼요.</div>';
  h += '<div class="dxWrap"><table class="dgT dxT"><thead><tr><th>연동</th><th>지금</th><th>만료 규칙</th><th>내 만료일</th><th>마지막 점검</th><th>갱신 방법</th></tr></thead><tbody>' + S.map(function (s) {
    var k = s.k, set = s.has == null ? '<span class="dgNa">확인 불가</span>' : s.has ? '<span class="dgOk">✓ 설정됨</span>' : '<span class="' + (k.optional ? "dgNa" : "dgNo") + '">' + (k.optional ? "미설정" : "✗ 없음") + '</span>';
    return '<tr class="' + (s.lv === "warn" || s.lv === "bad" ? "dxBad" : "") + '"><td class="dgName"><b>' + dxEsc(k.name) + '</b><br><code>' + dxEsc(k.env) + '</code></td><td>' + set + '<div>' + dxBadge(s.lv, s.badge) + '</div></td><td>' + dxEsc(k.rule) + '</td><td>' + (k.fixed ? '<span class="briefDim">해당 없음</span>' : '<input type="date" class="dxDate" data-dxexp="' + k.id + '" value="' + dxEsc(s.exp) + '">') + '</td><td>' + (s.chk ? dxMD(s.chk) : '<span class="briefDim">-</span>') + (k.fixed ? '' : '<br><button class="chip" data-dxchk="' + k.id + '">점검 완료</button>') + '</td><td>' + dxEsc(k.how) + (k.url ? ' <a href="' + k.url + '" target="_blank" rel="noopener">열기</a>' : '') + '</td></tr>';
  }).join("") + '</tbody></table></div>';
  h += '<div class="anActs" style="margin-top:8px"><button class="chip" data-dxics>📅 달력에 넣기 (.ics 내려받기)</button><button class="chip" data-dxall>모든 키 오늘 점검 완료로 표시</button><span class="briefDim">달력 파일에는 만료일 30일 전 · 7일 전 알림과 분기 점검일이 들어가요</span></div>';
  h += '<details class="dhGuide" style="margin-top:8px"><summary>키를 갱신하는 공통 순서</summary><ol class="dxOl"><li>발급처에서 새 키를 만든다 (기존 키는 아직 지우지 않는다).</li><li>Vercel → 프로젝트 → Settings → Environment Variables 에서 값을 바꾼다.</li><li>Deployments → 맨 위 배포 → ⋯ → <b>Redeploy</b> (환경변수는 다시 배포해야 적용).</li><li>데이터 센터에서 해당 「지금 수집」 버튼을 눌러 정상인지 확인한다.</li><li>정상이면 발급처에서 옛 키를 지우고, 여기서 「점검 완료」를 누른다.</li></ol></details>';
  return h;
}
function dxIcs() {
  var S = dxKeyState(), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StockMind//keys//KO"], stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", n = 0;
  var ev = function (d, title, desc) { var dt = d.replace(/-/g, ""); L.push("BEGIN:VEVENT", "UID:sm-" + dt + "-" + (n++) + "@stockmind", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + dt, "DTEND;VALUE=DATE:" + dxAdd(d, 1).replace(/-/g, ""), "SUMMARY:" + title, "DESCRIPTION:" + String(desc || "").replace(/[\n,;]/g, " "), "END:VEVENT"); };
  S.forEach(function (s) { if (s.exp && s.has) { ev(dxAdd(s.exp, -30), "[StockMind] " + s.name + " 만료 30일 전", s.k.how); ev(dxAdd(s.exp, -7), "[StockMind] " + s.name + " 만료 7일 전", s.k.how); ev(s.exp, "[StockMind] " + s.name + " 만료일", s.k.how); } });
  var t = dxToday(), y = +t.slice(0, 4); [y + "-02-15", y + "-05-15", y + "-08-15", y + "-11-15", (y + 1) + "-02-15", (y + 1) + "-05-15"].filter(function (d) { return d >= t; }).slice(0, 4).forEach(function (d) { ev(d, "[StockMind] 분기 점검 — 키 · 13F · 시총 상위 목록", "데이터 센터 ⑥ 키 점검 완료 누르기 · 구루 13F 지금 수집"); });
  for (var m = 1; m <= 6; m++) { var dd = new Date(Date.UTC(y, +t.slice(5, 7) - 1 + m, 1)).toISOString().slice(0, 10); ev(dd, "[StockMind] 월간 점검 — 과거 데이터 점검 · 백업 · 다음 달 일정", "데이터 센터 과거 데이터 전체 점검 · 분석 기록 백업 · 경제 일정 추가 · 사용량 확인"); }
  ev((y + (t.slice(5) > "12-10" ? 1 : 0)) + "-12-10", "[StockMind] 연간 — 내년 FOMC · 금통위 · 휴장일 추가", "publish.js 일정 목록 · tickers.js 정리");
  L.push("END:VCALENDAR");
  var blob = new Blob([L.join("\r\n")], { type: "text/calendar;charset=utf-8" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "StockMind_점검일정.ics"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function dxBottomHtml() {
  return '<h3 class="dhH">⑤ 수집 일정과 이력 <small>언제 무엇이 도는지 · 지난 실행에 문제가 있었는지</small></h3><div class="dxSub">수집 일정표</div>' + dxSchedHtml() + '<div class="dxSub">수집 이력 (서버 기록)</div><div id="dxRuns">' + dxRunsHtml() + '</div>' +
    '<h3 class="dhH" id="dxKeys">⑥ 키 · 유효기간 <small>설정 여부 · 만료 규칙 · 내가 적어 둔 날짜 · 갱신 방법</small></h3><div id="dxKeyBox">' + dxKeysHtml() + '</div>' +
    '<h3 class="dhH">⑦ 같은 데이터가 두 곳에서 올 때 <small>어느 쪽을 기준으로 쓰는지</small></h3>' + dxDupHtml();
}
function dxDupHtml() {
  var rows = [
    ["원/달러 환율", "야후(KRW=X) · 한국은행 ECOS(매매기준율)", "시세 환산 · 카드 = <b>야후</b>(그날 종가, 빠름) / 장기 흐름 · 환율 자리 판단 = <b>ECOS</b>(공식, 하루 늦음). 둘은 몇 원 다를 수 있어요. 야후를 못 읽으면 ECOS로 대신하고, 둘 다 없으면 환산하지 않아요(고정값 사용 안 함)."],
    ["지수 종가", "야후(^KS11 등) · 네이버", "화면 숫자 = <b>야후</b> / 네이버는 대조용(0.3% 넘게 다르면 경고)과 국내 한 장 카드의 장 마감 자료. 네이버 자료의 날짜가 앱 종가와 다르거나 장중이면 카드에 쓰지 않아요."],
    ["종목 과거 시세", "저장된 스냅샷 · 야후 실시간(/api/chart)", "<b>스냅샷</b>(검증 통과분)이 기준. 스냅샷에 없는 종목만 실시간으로 받아요."],
    ["같은 파일을 여러 화면이", "시세 과거 파일 · 종목 지표 · 인기 종목", "이제 주소 기준으로 <b>한 번만</b> 받아 30분 동안 화면들이 나눠 써요. 「다시 확인」과 「아침 수집」 뒤에는 모두 비우고 새로 받아요."],
    ["RSI · 최대 낙폭", "화면마다 계산식이 달랐음", "RSI는 와일더 방식, 최대 낙폭은 고점 대비 실제 최저로 <b>하나로 통일</b>했어요."]
  ];
  return '<div class="dxWrap"><table class="dgT"><thead><tr><th>무엇</th><th>오는 곳</th><th>기준</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td class="dgName"><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join("") + '</tbody></table></div>';
}
function dxBind(box) {
  var redraw = function () { var b = document.getElementById("dxKeyBox"); if (b) { b.innerHTML = dxKeysHtml(); dxBind(box); } };
  Array.prototype.forEach.call(box.querySelectorAll("[data-dxexp]"), function (i) { i.onchange = function () { var id = i.getAttribute("data-dxexp"), D = dxDatesLoad(); D[id] = D[id] || {}; D[id].exp = i.value || ""; dxDatesSave(); redraw(); if (typeof smToast === "function") smToast(i.value ? "만료일을 저장했어요 — 30일 전부터 맨 위에 알려요" : "만료일을 지웠어요"); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-dxchk]"), function (b) { b.onclick = function () { var id = b.getAttribute("data-dxchk"), D = dxDatesLoad(); D[id] = D[id] || {}; D[id].chk = dxToday(); dxDatesSave(); redraw(); }; });
  var all = box.querySelector("[data-dxall]"); if (all) all.onclick = function () { var D = dxDatesLoad(); DX_KEYS.forEach(function (k) { if (!k.fixed) { D[k.id] = D[k.id] || {}; D[k.id].chk = dxToday(); } }); dxDatesSave(); redraw(); if (typeof smToast === "function") smToast("오늘 날짜로 점검 완료 표시했어요 — 다음 점검은 3개월 뒤"); };
  var ics = box.querySelector("[data-dxics]"); if (ics) ics.onclick = dxIcs;
  if (!DX.loaded && typeof smKvGet === "function") { DX.loaded = true; smKvGet("cfg:keydates").then(function (v) { if (v && typeof v === "object") { var D = dxDatesLoad(), ch = false; Object.keys(v).forEach(function (k) { if (!D[k] || JSON.stringify(D[k]) !== JSON.stringify(v[k])) { D[k] = Object.assign({}, v[k], D[k] || {}); ch = true; } }); if (ch) { try { localStorage.setItem("sm.keydates", JSON.stringify(D)); } catch (e) {} redraw(); } } }); }
}
(function () {
  var st = document.createElement("style"); st.id = "dxCss"; st.textContent = [
    ".dxSum{border-radius:12px;padding:10px 14px;margin:6px 0 10px;font-size:13.5px;line-height:1.55;background:#eef8f2;border-left:4px solid #1d7f55}.dxSum.warn{background:#fff6e8;border-color:#b9600f}",
    ".dxT td small{display:block;color:#6b7686;font-size:11.5px;line-height:1.4;margin-top:2px}.dxT tr.dxBad td{background:#fffaf0}.dxT tr.dxG td{background:#f1f4f8;font-weight:800;font-size:12px;color:#445;padding:5px 10px}.dxLast{white-space:nowrap}.dxSkip{color:#b9600f;font-size:12px}",
    ".dxWrap{overflow-x:auto;border:1px solid var(--admLine,#e3e7ee);border-radius:12px;background:var(--admCard,#fff)}.dxWrap table{margin:0}",
    ".dxSub{font-weight:800;font-size:13.5px;margin:12px 0 6px}.dxDate{font:inherit;font-size:12.5px;padding:4px 6px;border:1px solid #cfd6e0;border-radius:8px;background:#fff}.dxOl{margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.7}",
    "[data-theme=dark] .dxSum{background:#16261e;color:#dde}[data-theme=dark] .dxSum.warn{background:#2a2114}[data-theme=dark] .dxT tr.dxBad td{background:#241f14}[data-theme=dark] .dxT tr.dxG td{background:#1c2330;color:#cbd}[data-theme=dark] .dxDate{background:#161b24;color:#dde;border-color:#263041}"
  ].join(""); document.head.appendChild(st);
  if (typeof SM_GUIDE !== "undefined" && SM_GUIDE.data && SM_GUIDE.data.s) SM_GUIDE.data.s = ["⓪ 한눈에 보기에서 노란 줄(확인)이 있는지만 보면 돼요. 줄마다 주기 · 마지막 최신화 · 문제 · 버튼이 있어요.", "노란 줄이 있으면 그 줄의 버튼을 누르세요. 버튼이 없으면 '왜' 칸의 안내를 따라요.", "⑤에서 지난 수집에 문제가 있었는지, ⑥에서 키 만료가 다가오는지 확인해요. 분기에 한 번 「점검 완료」를 눌러 두세요."];
})();
