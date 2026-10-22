/* ============================================================
   v12.33 데이터 센터 (운영자 전용) — 데이터 연동·점검·최신화 버튼을 한 화면에
   ① 시장별(국내·미국·코인) 지금 화면에 보여주는 데이터가 '며칠 종가'인지, 어디서 왔는지, 정상인지
   ② 그 밖의 데이터(매크로·공시·구루·공모주·일정)의 마지막 갱신과 손으로 할 일
   ③ 최신화 버튼 — 버튼마다 무엇을 하는지·얼마나 걸리는지·언제 누르는지
   ④ 연동 안내(키·출처·주기) 전체 표
   새 서버 함수 없음 — 기존 /api/config · /api/snap · /api/cron-snapshot · /api/channel?op=disc 만 사용
   ============================================================ */
var DH = { busy: false, ext: null };

function dhEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s); }
function dhLocD(mk, ms) { if (!ms) return ""; return new Date(ms + (mk === "kr" ? 9 : mk === "coin" ? 0 : -5) * 3600e3).toISOString().slice(0, 10); }
function dhMD(d) { if (!d) return "-"; var p = String(d).slice(0, 10).split("-"); var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return (+p[1]) + "/" + (+p[2]) + "(" + "일월화수목금토"[dt.getUTCDay()] + ")"; }
function dhKst(iso) { if (!iso) return "-"; try { return typeof kstFmt === "function" ? kstFmt(iso) : String(iso).slice(0, 16); } catch (e) { return String(iso).slice(0, 16); } }
function dhAgo(iso) { if (!iso) return ""; var h = (Date.now() - new Date(iso).getTime()) / 3600e3; return h < 1 ? Math.max(1, Math.round(h * 60)) + "분 전" : h < 48 ? Math.round(h) + "시간 전" : Math.round(h / 24) + "일 전"; }
function dhBadge(kind, txt) { return '<span class="dhBadge ' + kind + '">' + (kind === "ok" ? "✓ " : kind === "warn" ? "⚠️ " : kind === "bad" ? "✗ " : "") + dhEsc(txt) + '</span>'; }
function dhOwn() { try { return (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) { return ""; } }

/* 다음 자동 수집 (크론: 매일 07:00 · 09:00 KST) */
function dhNextCron() {
  var now = new Date(Date.now() + 9 * 3600e3), h = now.getUTCHours() + now.getUTCMinutes() / 60;
  return h < 7 ? "오늘 07:00" : h < 9 ? "오늘 09:00" : "내일 07:00";
}

/* 공시·구루·공모주·매크로 상태 (공개 읽기, 운영자는 CDN 건너뜀) */
function dhLoadExt() {
  var f = function (q) { return fetch("/api/snap?" + q + "=1&fresh=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
  return Promise.all([f("macro"), f("disc"), f("guru"), f("ipo")]).then(function (a) { DH.ext = { macro: a[0], disc: a[1], guru: a[2], ipo: a[3] }; return DH.ext; });
}

/* 시장 하나의 상태 */
function dhMarket(mk, recent) {
  var R = null; try { R = briefCompute(recent, { mode: "day", market: mk }); } catch (e) { return { mk: mk, err: e.message }; }
  var q = R.quality || { stale: [], spike: [] }, inM = function (s) { var m = /\.K[SQ]$|^\^KS|^\^KQ/.test(s.sym) ? "kr" : /-USD$/.test(s.sym) ? "coin" : /=X$|=F$|^\^(N225|HSI|STOXX50E|FTSE|GDAXI|SSEC)$|^DX-Y/.test(s.sym) ? "x" : "us"; return m === mk; };
  var stale = q.stale.filter(inM), spike = q.spike.filter(inM);
  var date = mk === "kr" ? dhLocD("kr", R.asOfKr) : mk === "us" ? dhLocD("us", R.asOfUs) : "";
  var out = { mk: mk, R: R, date: date, count: R.count, stale: stale, spike: spike, idx: R.indexRow || [], basis: R.basis || {}, off: !!R.marketWideOff };
  if (mk === "coin") { var b = recent.symbols && recent.symbols["BTC-USD"]; if (b && b.t && b.t.length) { var lt = b.t[b.t.length - 1] * 1000, close = Math.floor(lt / 86400e3) * 86400e3 + 86400e3; out.date = new Date(close + 9 * 3600e3).toISOString().slice(0, 10); out.coinLate = close < Math.floor((Date.now() - 20 * 60e3) / 86400e3) * 86400e3; } }
  var U = typeof DL_UNI !== "undefined" && DL_UNI[mk] && DL_UNI[mk].doc; out.uni = U || null;
  out.level = out.err ? "bad" : (mk !== "coin" && out.off) || stale.length || spike.length || out.coinLate ? "warn" : "ok";
  return out;
}

function dhMarketCard(M) {
  var NM = { kr: "🇰🇷 국내", us: "🇺🇸 미국", coin: "🪙 코인" }[M.mk];
  if (M.err) return '<div class="dhMk"><h4>' + NM + '</h4>' + dhBadge("bad", "계산 실패") + '<div class="briefDim">' + dhEsc(M.err) + '</div></div>';
  var h = '<div class="dhMk"><div class="dhMkHead"><h4>' + NM + '</h4>' + (M.level === "ok" ? dhBadge("ok", "정상") : dhBadge("warn", "확인 필요")) + '</div>';
  h += '<div class="dhBig">' + (M.mk === "coin" ? dhMD(M.date) + ' 오전 9시 마감' : dhMD(M.date) + ' 종가') + '<small>' + (M.mk === "coin" ? "코인 일봉은 한국 오전 9시(UTC 0시) 마감" : M.mk === "us" ? "미국 현지 날짜 · 한국 새벽 5~6시 마감" : "한국 오후 3시 30분 마감") + '</small></div>';
  h += '<div class="dhIdx">' + M.idx.slice(0, 3).map(function (x) { return '<span><b>' + dhEsc(x.name) + '</b> ' + (typeof briefPct === "function" ? briefPct(x.ret) : "") + '</span>'; }).join("") + '</div>';
  var rows = [];
  rows.push(["대표 목록 (1년치 시세)", M.count + "개 · " + (M.stale.length ? '<span class="dhWarn">늦은 ' + M.stale.length + '개: ' + dhEsc(M.stale.slice(0, 5).map(function (s) { return briefName(s); }).join(", ")) + '</span>' : M.spike.length ? '<span class="dhWarn">급변 의심 ' + M.spike.length + '개</span>' : '<span class="dhOk">모두 같은 날까지</span>'), "야후 파이낸스 일봉 → Redis(최근 400일 + 과거 25년)"]);
  if (M.mk !== "coin") {
    var U = M.uni, b = M.basis;
    var ut = !U ? '<span class="dhWarn">아직 못 불러옴</span>' : U.n + "종목 · 거래일 " + dhMD(U.asOfD || dhLocD(M.mk, U.asOf)) + (U.ver !== 2 ? ' · <span class="dhWarn">옛 방식 — 다시 받기 필요</span>' : U.lagN ? ' · <span class="dhWarn">하루 늦은 ' + U.lagN + '개(집계 제외)</span>' : "");
    rows.push([M.mk === "us" ? "전체 시장 요약 (S&P 500)" : "전체 시장 요약 (코스피 시총상위 200)", ut, M.mk === "us" ? "위키피디아 구성표 + 야후 일봉 요약" : "네이버 시가총액 순 + 야후 일봉 요약"]);
    rows.push(["화면의 시장 숫자", b.kind === "uni" ? '<span class="dhOk">전체 시장 기준 (' + b.n + '/' + b.total + '종목)</span>' : '<span class="dhWarn">숨김 — ' + dhEsc(b.why || "준비 중") + '</span>', "오른 종목·20일선·신고가·업종·급등락·거래대금"]);
  } else rows.push(["화면의 시장 숫자", "코인 목록 " + M.count + "개 기준 (전체 코인 시장 아님)", "오른 코인·테마·급등락"]);
  h += '<div class="dhRows">' + rows.map(function (r) { return '<div class="dhRow"><div class="dhRowL">' + r[0] + '</div><div class="dhRowV">' + r[1] + '</div><div class="dhRowS">' + r[2] + '</div></div>'; }).join("") + '</div>';
  h += '<div class="dhHow">' + (M.mk === "coin" ? "자동: 매일 07:00·09:00 (09:00 실행에서 코인을 먼저 받음) · 09:20 이후에도 전날 마감분이 없으면 ☀️ 아침 수집" : M.mk === "us" ? "자동: 07:00 대표 목록 + 전체 요약, 09:00 요약 나머지 · 늦거나 숨김이면 ☀️ 아침 수집 (요약도 자동으로 이어 받음)" : "자동: 07:00 대표 목록 + 전체 요약(어제 마감 확정분) · 늦거나 숨김이면 ☀️ 아침 수집") + '</div>';
  return h + '</div>';
}

/* 기타 데이터 표 */
function dhExtRows() {
  var E = DH.ext || {}, C = (typeof DATA !== "undefined" && DATA.config) || {}, K = C.keys || {}, rows = [];
  var st = function (doc, maxH) { if (!doc) return dhBadge("warn", "없음"); var u = doc.updated || doc.generated || doc.at; if (!u) return dhBadge("", "-"); var h = (Date.now() - new Date(u).getTime()) / 3600e3; return dhBadge(h <= maxH ? "ok" : "warn", dhAgo(u)); };
  // 매크로: 지표마다 마지막 날짜
  var M = E.macro, ser = (M && M.series) || {}, nm = { krw: "원/달러", bok: "한국 기준금리", fed: "미 기준금리", us10y: "미 10년 금리", m2: "미 M2" };
  var last = Object.keys(nm).map(function (k) { var s = ser[k], arr = s && (Array.isArray(s) ? s : s.rows); var r = arr && arr.length ? arr[arr.length - 1] : null; var d = r ? String(r[0]) : ""; return nm[k] + " " + (d ? d.slice(4, 6) + "/" + d.slice(6, 8) : "없음"); }).join(" · ");
  var merr = M && M.log && M.log.errors && M.log.errors.length ? '<div class="dhWarn">오류: ' + dhEsc(M.log.errors.slice(0, 3).join(" / ")) + '</div>' : "";
  rows.push(["매크로 (환율·금리·M2)", st(M, 30) + '<div>' + last + '</div>' + merr, "ECOS(한국은행) · FRED", "매일 07:00 크론 · 기준금리는 바뀐 날만 기록", "FRED 오류가 계속되면 FRED_API_KEY 등록 · 매크로 지금 수집"]);
  rows.push(["국내 공시 (지분·자사주)", st(E.disc, 30) + (E.disc && E.disc.n != null ? '<div>' + E.disc.n + '건</div>' : ""), "DART", "매일 크론 끝 남는 시간", "건너뛴 날만 공시 지금 수집"]);
  rows.push(["구루 13F", st(E.guru, 24 * 10) + (E.guru && E.guru.via ? '<div>경로: ' + dhEsc(E.guru.via) + '</div>' : ""), "SEC EDGAR", "분기마다 새 보고서 · 매일 확인", "SEC_UA 설정 확인 · 구루 지금 수집"]);
  rows.push(["공모주", st(E.ipo, 30), "DART + 야후", "매일 크론 끝 남는 시간", "처음 한 번은 공모주 지금 수집(과거 2년)"]);
  // 일정 목록(손으로 관리)
  var cal = typeof PUB_CAL !== "undefined" ? PUB_CAL : [], lastEv = cal.length ? cal.map(function (e) { return e.d; }).sort().slice(-1)[0] : "", today = typeof pubToday === "function" ? pubToday() : "";
  var days = lastEv ? Math.round((Date.parse(lastEv) - Date.parse(today)) / 86400e3) : -1;
  rows.push(["경제 일정 (FOMC·CPI·금통위·휴장)", (days >= 45 ? dhBadge("ok", dhMD(lastEv) + "까지") : dhBadge("warn", lastEv ? dhMD(lastEv) + "까지뿐" : "없음")) + '<div>' + cal.length + '건</div>', "연준·BLS·BEA·한국은행 발표 일정 (손으로 입력)", "자동 아님", "<b>손으로</b>: publish.js 맨 위 PUB_CAL에 다음 달 일정 추가 · 결과(동결·인상)는 n칸에 메모"]);
  rows.push(["뉴스·기사", K.naverHub || K.naverDev ? dhBadge("ok", K.naverHub ? "HUB 키" : "구 키") : dhBadge("bad", "키 없음"), "네이버 검색 API", "화면을 열 때 실시간 (10분 캐시)", K.naverHub ? "-" : "구 키는 2027-06 종료 → HUB 키로 교체"]);
  rows.push(["종목 지표·재무·수급", dhBadge("", "요청할 때"), "네이버 증권 공개 API", "화면에서 열 때 실시간", "-"]);
  return '<div class="tableWrap"><table class="dgT"><thead><tr><th>데이터</th><th>지금 상태</th><th>어디서</th><th>자동 주기</th><th>손으로 할 일</th></tr></thead><tbody>' +
    rows.map(function (r) { return '<tr><td class="dgName"><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + r[4] + '</td></tr>'; }).join("") + '</tbody></table></div>';
}

/* 버튼 패널 — 버튼마다 설명·소요·언제 */
var DH_BTNS = [
  { id: "snap", t: "☀️ 아침 수집 지금 실행", d: "크론과 같은 수집: 대표 목록 309개 최근 400일 + 빈 날 메우기 + 과거 순환 20개 + 공시. 끝나면 전체 시장 요약 날짜를 비교해 다르면 이어서 자동으로 받아요.", w: "1~5분 (요약까지면 3~8분)", when: "시장 카드에 ⚠️가 있을 때 · 휴일 다음 날 · 09:20 뒤에도 코인 전날 마감분이 없을 때" },
  { id: "uni-us", t: "🇺🇸 S&P 500 요약 지금 받기", d: "S&P 500 전 종목의 등락·이평선·52주 고저·거래대금 요약만 새로 받아요. 오늘 탭·카드의 미국 '시장 숫자'가 여기서 나와요.", w: "1~4분", when: "미국 카드가 '숨김'이거나 '옛 방식 · 하루 늦은 종목'이 많을 때" },
  { id: "uni-kr", t: "🇰🇷 코스피 200 요약 지금 받기", d: "코스피 시총상위 200 요약만 새로 받아요. 장중에 눌러도 오늘 장중 가격은 빼고 어제 종가로 계산해요.", w: "1~3분", when: "국내 카드가 '숨김'일 때" },
  { id: "audit", t: "🔍 과거 데이터 전체 점검", d: "저장된 25년치 전체를 날짜 순서·중복·0/음수·자릿수·튀었다 돌아온 값·분할 반영·과거↔최근 불일치 등 9가지로 검사해요. 고치지는 않고 알려만 줘요.", w: "30~50초", when: "월 1회 · 차트가 이상해 보일 때" },
  { id: "macro", t: "📉 매크로 지금 수집", d: "환율·한미 기준금리·미 10년 금리·M2를 다시 받아요.", w: "10~30초", when: "매크로 줄에 오류가 있거나 금리 발표 직후" },
  { id: "dart", t: "📑 공시 지금 수집", d: "최근 30일 국내 공시(임원·대주주 지분, 자사주)를 받아요.", w: "10~40초", when: "공시가 하루 넘게 비었을 때" },
  { id: "sec", t: "🧓 구루 13F 지금 수집", d: "주요 투자자 13F 보고서를 확인해 새 분기분을 받아요.", w: "10~40초", when: "분기 보고 시즌(2·5·8·11월 중순)" },
  { id: "ipo", t: "🆕 공모주 지금 수집", d: "청약 일정·경쟁률·상장 후 수익률을 받아요(처음엔 과거 2년).", w: "30초~2분", when: "처음 한 번 · 일정이 비었을 때" }
];
function dhBtnsHtml() {
  return '<div class="dhBtns">' + DH_BTNS.map(function (b) {
    return '<div class="dhBtn"><button class="chip" data-dh="' + b.id + '"' + (b.id === "snap" ? ' id="chSnapBtn"' : b.id === "audit" ? ' id="chAuditBtn"' : "") + '>' + b.t + '</button><div class="dhBtnTxt">' + b.d + '<small>⏱ ' + b.w + ' · 언제: ' + b.when + '</small></div><div class="dhOut briefDim" id="' + (b.id === "snap" ? "chSnapOut" : b.id === "audit" ? "chAuditOut" : "dhOut-" + b.id) + '"></div></div>';
  }).join("") + '</div><div class="briefDim" style="margin-top:8px;font-size:12px"><b>전체 시장 요약 저장 상태</b> · <span id="chUniOut"></span></div>';
}
function dhBind(box) {
  Array.prototype.forEach.call(box.querySelectorAll("[data-dh]"), function (b) {
    var id = b.getAttribute("data-dh");
    b.onclick = function () {
      if (id === "snap") return chRunSnapshot(b);
      if (id === "audit") return chRunAudit();
      if (id === "uni-us" || id === "uni-kr") { var o = $("dhOut-" + id); return chRunUniverse(id.slice(4), b, o).then(function () { dhRefresh(true); }); }
      var o2 = $("dhOut-" + id), old = b.innerHTML, q = id === "macro" ? "part=macro&force=1" : id === "ipo" ? "part=ipo&ipodays=730" : "days=30&part=" + id;
      b.disabled = true; b.textContent = "수집 중…"; if (o2) o2.textContent = "";
      fetch("/api/channel?op=disc&run=1&" + q, { headers: { "x-owner": dhOwn() }, cache: "no-store" }).then(function (r) { return r.json().catch(function () { return { ok: false, reason: "HTTP_" + r.status }; }); }).then(function (j) {
        b.disabled = false; b.innerHTML = old;
        var part = j && (j[id] || j.macro || j.ipo || j.dart || j.sec) || j || {};
        if (o2) o2.innerHTML = (j && j.ok !== false && !(part && part.ok === false) ? '<span class="dhOk">완료</span>' : '<span class="dhWarn">실패: ' + dhEsc((part && (part.reason || part.error)) || (j && (j.reason || j.error)) || "알 수 없음") + '</span>') + (part && part.errors && part.errors.length ? ' · 오류 ' + dhEsc(part.errors.slice(0, 2).join(" / ")) : "");
        dhLoadExt().then(function () { var t = $("dhExt"); if (t) t.innerHTML = dhExtRows(); });
      }).catch(function (e) { b.disabled = false; b.innerHTML = old; if (o2) o2.textContent = "실패: " + e.message; });
    };
  });
}

/* 다시 확인: 캐시를 비우고 서버 최신값으로 */
function dhRefresh(quiet) {
  if (typeof DATA !== "undefined") { DATA.ready = null; DATA.recentPromise = null; }
  if (typeof DL_UNI !== "undefined") { delete DL_UNI.us; delete DL_UNI.kr; }
  if (typeof BRIEF_UNI_PENDING !== "undefined") { delete BRIEF_UNI_PENDING.us; delete BRIEF_UNI_PENDING.kr; }
  renderDataHub(true, quiet);
}

function renderDataHub(force, quiet) {
  var box = $("dataHubBody"); if (!box) return;
  if (DH.busy) return; DH.busy = true;
  if (!quiet) box.innerHTML = '<div class="briefDim" style="padding:20px 0">데이터 상태를 확인하는 중…</div>';
  var load = function (m) { return typeof dlUniLoad === "function" ? dlUniLoad(m) : Promise.resolve(null); };
  dataReady().then(function () { return Promise.all([fetchRecent(), load("us"), load("kr"), dhLoadExt()]); }).then(function (a) {
    DH.busy = false;
    var recent = a[0];
    if (recent && recent.symbols && typeof briefState !== "undefined" && briefState.recent && briefState.recent !== recent && typeof briefCompute === "function") { briefState.recent = recent; try { briefState.result = briefCompute(recent, { mode: briefState.mode, market: briefState.market, popular: briefState.popular }); } catch (e) {} if (typeof TPL_RC !== "undefined") Object.keys(TPL_RC).forEach(function (k) { delete TPL_RC[k]; }); }   // 다른 화면도 새 값으로
    var C = (typeof DATA !== "undefined" && DATA.config) || {}, lr = C.lastRun || {};
    if (!recent || !recent.symbols) { box.innerHTML = '<div class="dhWarn">시세 데이터를 불러오지 못했어요 — ' + dhEsc(DATA.reason || "") + '</div>'; return; }
    var Ms = ["kr", "us", "coin"].map(function (m) { return dhMarket(m, recent); }), bad = Ms.filter(function (m) { return m.level !== "ok"; }).length;
    var h = '<div class="dhTop"><div><b>마지막 수집</b> ' + dhKst(recent.generated) + ' <span class="briefDim">(' + dhAgo(recent.generated) + ')</span> · <b>다음 자동 수집</b> ' + dhNextCron() + ' · <b>전체</b> ' + (bad ? dhBadge("warn", "확인 필요 " + bad + "곳") : dhBadge("ok", "정상")) + '</div><button class="chip" id="dhReload">🔄 다시 확인</button></div>';
    if (lr.at) h += '<div class="briefDim" style="margin:4px 0 0">마지막 서버 실행 ' + dhEsc(String(lr.at).slice(0, 16)) + (lr.repaired ? ' · 빈 날 메운 종목 ' + lr.repaired + '개' : '') + (lr.behindN ? ' · <span class="dhWarn">늦은 종목 ' + lr.behindN + '개</span>' : '') + (lr.yahoo ? ' · 야후 성공 ' + (lr.yahoo.ok || 0) + '회' : '') + '</div>';
    h += '<h3 class="dhH">① 시장별로 지금 보여주는 데이터</h3><div class="dhMks">' + Ms.map(dhMarketCard).join("") + '</div>';
    h += '<h3 class="dhH">② 최신화 버튼 <small>운영자 토큰으로 실행 · 키는 화면에 나오지 않아요</small></h3>' + dhBtnsHtml();
    h += '<h3 class="dhH">③ 그 밖의 데이터 · 손으로 할 일</h3><div id="dhExt">' + dhExtRows() + '</div>';
    h += '<h3 class="dhH">④ 연동 안내 <small>API 키 · 출처 · 주기 전체 표</small></h3><details class="dhGuide"><summary>펼쳐 보기 — 키가 필요한 연동 · 키 없이 오는 데이터 · 운영자가 할 일</summary><div class="dgWrap">' + (typeof chDataGuideHtml === "function" ? chDataGuideHtml() : "") + '</div></details>';
    box.innerHTML = h;
    $("dhReload").onclick = function () { dhRefresh(false); };
    dhBind(box);
    if (typeof chUniStatus === "function") chUniStatus();
  }).catch(function (e) { DH.busy = false; box.innerHTML = '<div class="dhWarn">불러오지 못했어요: ' + dhEsc(e.message) + '</div>'; });
}
