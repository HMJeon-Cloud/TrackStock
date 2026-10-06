/* ============================================================
   '채널' 탭 — 정보 공유 채널 운영자용 발행 자료 (v6.2)
   매일 아침 자동 집계된 데이터를 "그대로 붙여 넣을 수 있는 글"로 만들어 준다.
   홈의 '채널 브리핑 자료' 카드, '오늘' 탭 상단 버튼, 홈 하단 링크, 주소 #t=channel 로 들어온다.

   ① 미국 증시 데일리 브리핑 — 서버(/api/channel)가 아침 데이터로 만든 글
   ② MDD(최대낙폭) 분석        — 대표 자산 + 지금 상황에 맞춰 고른 종목(이유 포함)의 역대 낙폭 속 현재 위치
   ③ 자산배분 스냅샷            — 대표 자산 + 지금 상황에 맞춘 구성 예시(비중·이유)
   ④ 상황별 과거 사례           — 금리 급등·유가 급등·공포 급락 등 과거 구간에서 자산별 성과, 최대 낙폭과 회복일,
                                   '버틴 자산을 팔아 빠진 자산을 샀다면' 1년 뒤 결과 (전부 실제 데이터로 계산)
   전체 글 복사 · 스레드용 짧은 글 · 각 섹션 이미지 저장
   ============================================================ */
var CH_REP_MDD = ["SPY", "QQQ", "^KS11", "TLT", "GLD", "SCHD"];   // 대표 자산 (고정) — v9.3: 코인은 코인 브리핑으로 분리
var chState = { daily: null, mdd: null, mddPick: null, alloc: null, plan: null, now: null, scen: null, recent: null, popular: [] };

function chLoad(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
function chSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function chName(sym) { return (typeof BRIEF_KO !== "undefined" && BRIEF_KO[sym]) ? BRIEF_KO[sym].replace(/\s*\(.*?\)\s*/g, "").trim() : sym; }
function chPct(x, d) { if (x == null || !isFinite(x)) return "-"; d = d == null ? 1 : d; return (x > 0 ? "+" : "") + (x * 100).toFixed(d) + "%"; }
function chCopy(text, btn) {
  function done(ok) { var old = btn.textContent; btn.textContent = ok ? "✓ 복사됨" : "복사 실패"; setTimeout(function () { btn.textContent = old; }, 1500); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
  else { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(true); } catch (e) { done(false); } ta.remove(); }
}

/* ---------- ① 데일리 브리핑 (서버 글) ---------- */
function chLoadDaily(force) {
  var box = $("chDaily");
  box.innerHTML = '<div class="briefDim">글 만드는 중…</div>';
  return fetch("/api/channel" + (force ? "?r=" + Date.now() : ""), { headers: ownerHeaders() }).then(function (r) { return r.json(); }).then(function (d) {
    chState.daily = d;
    if (!d.ok) { box.innerHTML = '<div class="briefDim">아직 데이터가 없어요 (' + (d.reason || "") + '). 아침 수집 뒤에 생겨요.</div>'; return; }
    var first = d.text.split("\n").filter(Boolean).slice(0, 3).join("  ·  ");
    box.innerHTML = '<details class="chFold"><summary>' + escapeHtml(first).slice(0, 120) + '… <span class="briefDim">(' + d.text.length + '자 · 펼쳐 보기)</span></summary><pre class="chText" id="chDailyText"></pre></details>';
    $("chDailyText").textContent = d.text;
    $("chDailyMeta").textContent = d.text.length + "자 · 데이터 " + kstFmt(d.generated) + " 수집 (한국 시간)";
  }).catch(function () { box.innerHTML = '<div class="briefDim">글을 불러오지 못했어요.</div>'; });
}

/* ---------- 공통: 최근 데이터·지금 상황·인기 종목 ---------- */
function chPrepare() {
  return fetchRecent().then(function (recent) {
    if (!recent || !recent.symbols) return null;
    chState.recent = recent;
    chState.now = chDetectNow(recent);
    // 인기 종목: 브리핑과 같은 기준(조회 순위 → 없으면 거래대금)
    var popP = (typeof briefState !== "undefined" && briefState.popular) ? Promise.resolve(briefState.popular)
      : fetch("/api/snap?popular=1").then(function (r) { return r.json(); }).then(function (j) { return (j && j.items) || []; }).catch(function () { return []; });
    return popP.then(function (pop) {
      var list = [];
      try {
        var R = briefCompute(recent, { mode: "day", market: "stock", popular: pop });   // v9.3: 채널(주식) 자료엔 코인 제외
        chState.brief = R;
        list = R.popular.map(function (s) { return s.sym; }).filter(function (sym) { return !/^\^|=X$|=F$/.test(sym); });
      } catch (e) {}
      chState.popular = (list.length ? list : CH_POP_DEFAULT).slice(0, 8);
      return recent;
    });
  });
}
/* 데이터 점검 결과 표시 */
function chRenderQuality() {
  var R = chState.brief, box = $("chQuality"); if (!R || !box) return;
  var q = R.quality, n = q.stale.length + q.spike.length;
  var gen = chState.recent && chState.recent.generated ? kstFmt(chState.recent.generated) + " (한국 시간)" : "-";
  box.innerHTML = '<b>🩺 데이터 점검</b> 수집 ' + gen + ' · ' + q.total + '개 자산 · ' +
    (n ? '<span style="color:#b45309">확인 필요 ' + n + '개 — 순위·카드에서 제외했어요</span>' : '<span style="color:var(--good)">이상 없음</span>') +
    (n ? '<div class="briefDim" style="margin-top:4px">' +
      (q.stale.length ? '오래된 데이터(수집 실패로 지난 값): ' + q.stale.map(function (s) { return briefName(s) + " " + kstFmt(new Date(s.lastT).toISOString(), false).slice(5); }).join(", ") + '<br>' : '') +
      (q.spike.length ? '하루 ±40% 넘는 급변(오류 의심): ' + q.spike.map(function (s) { return briefName(s) + " " + chPct(s.ret1); }).join(", ") : '') + '</div>' : '') +
    '<div class="row" style="gap:6px;margin-top:6px"><button class="chip" id="chAuditBtn">과거 데이터까지 전체 점검</button><span class="briefDim" style="font-size:11.5px">25년치 · 9가지 방법으로 교차 확인 · 30~50초</span></div><div id="chAuditOut"></div>';
  var ab = $("chAuditBtn"); if (ab) ab.onclick = chRunAudit;
}
/* v9.4 — 과거 데이터 전체 점검: 서버(/api/cron-snapshot?audit=1)가 저장된 모든 종목을 순서·중복·0/음수·자릿수·튀었다 돌아온 값·유지된 급변·
   수정주가 비율·과거파일↔최근값 불일치·52주 최고가 교차확인·갱신 지연으로 검사한다. 운영자 토큰으로 실행(CRON_SECRET 불필요) */
var CH_AUDIT_WORD = { order: "날짜 순서", dup: "중복 날짜", value: "0·음수 값", gap: "긴 공백", precision: "자릿수 손실", spike: "튀었다 돌아온 값", jump: "유지된 급변", "split-ok": "액면분할(정상)", adj: "수정주가 비율 이상", mismatch: "과거↔최근 값 불일치", nooverlap: "겹치는 날 없음", hi52: "52주 최고가 차이", stale: "갱신 지연", short: "데이터 짧음" };
function chRunAudit() {
  var out = $("chAuditOut"), btn = $("chAuditBtn"); if (!out) return;
  var tok = ""; try { tok = (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) {}
  btn.disabled = true; btn.textContent = "점검 중… (최대 1분)"; out.innerHTML = "";
  fetch("/api/cron-snapshot?audit=1", { headers: { "x-owner": tok }, cache: "no-store" }).then(function (r) { return r.json().then(function (j) { j._st = r.status; return j; }); }).then(function (j) {
    btn.disabled = false; btn.textContent = "다시 점검";
    if (j._st !== 200) { out.innerHTML = '<div class="chWhyBox">점검 실패: ' + escapeHtml(j.error || ("HTTP " + j._st)) + (j._st === 401 ? ' — 운영자 모드(토큰)가 이 기기에 켜져 있어야 해요.' : '') + '</div>'; return; }
    var sum = Object.keys(j.summary || {}).map(function (k) { return (CH_AUDIT_WORD[k] || k) + " " + j.summary[k]; }).join(" · ");
    var ser = j.serious || [];
    out.innerHTML = '<div class="chWhyBox" style="margin-top:6px"><b>' + j.checked + '/' + j.total + '개 종목 점검</b> · ' + escapeHtml(j.at || "") + '<br>' +
      (ser.length ? '<span style="color:#b45309"><b>바로 확인할 종목 ' + ser.length + '개</b></span>' : '<span style="color:var(--good)"><b>바로 고칠 문제 없음</b></span>') + (sum ? ' <span class="briefDim">(' + escapeHtml(sum) + ')</span>' : '') +
      (ser.length ? '<ul style="margin:6px 0 0 18px;padding:0">' + ser.slice(0, 30).map(function (s) { return '<li><b>' + escapeHtml(chName(s)) + '</b> <span class="briefDim">' + escapeHtml(s) + '</span> — ' + escapeHtml((j.report[s] || []).map(function (x) { var k = x.split(":")[0]; return (CH_AUDIT_WORD[k] || k) + x.slice(k.length); }).join(" / ")) + '</li>'; }).join("") + '</ul>' : '') +
      ((j.missingHistory || []).length ? '<div class="briefDim" style="margin-top:4px">과거 파일 없음 ' + j.missingHistory.length + '개: ' + escapeHtml(j.missingHistory.slice(0, 12).join(", ")) + '</div>' : '') +
      (j.checked < j.total ? '<div class="briefDim">시간 제한으로 ' + (j.total - j.checked) + '개는 시간 제한(50초)으로 이번에 확인하지 못했어요. 한 번 더 누르면 다시 처음부터 점검해요.</div>' : '') +
      '<div class="briefDim" style="margin-top:4px">' + escapeHtml(j.guide || "") + '</div></div>';
  }).catch(function (e) { btn.disabled = false; btn.textContent = "다시 점검"; out.innerHTML = '<div class="chWhyBox">점검 실패: ' + escapeHtml(e.message) + '</div>'; });
}
function chStat(sym) { var d = chState.recent && chState.recent.symbols[sym]; return d ? briefStats(sym, d, "day") : null; }

/* ---------- ② MDD 분석 (10년치 데이터) ---------- */
function chMddRow(sym, why) {
  return getChartData(sym, "max").then(function (parsed) {
    var rows = parsed.rows; if (!rows || rows.length < 250) throw new Error("short");
    var last = rows[rows.length - 1].c, peak = -Infinity, peakT = 0;
    rows.forEach(function (r) { if (r.c > peak) { peak = r.c; peakT = r.t; } });
    var cur = last / peak - 1;
    var eps = drawdownEpisodes(rows, 0.10);
    var finished = eps.filter(function (e) { return e.recoverI != null; });
    var deeper = eps.filter(function (e) { return e.dd < cur; }).length;
    var recDays = finished.map(function (e) { return Math.round((rows[e.recoverI].t - rows[e.troughI].t) / 86400000); }).sort(function (a, b) { return a - b; });
    var medRec = recDays.length ? recDays[Math.floor(recDays.length / 2)] : null;
    var worst = eps.length ? Math.min.apply(null, eps.map(function (e) { return e.dd; })) : null;
    var days = Math.round((rows[rows.length - 1].t - peakT) / 86400000);
    var years = (rows[rows.length - 1].t - rows[0].t) / (365.25 * 86400000);
    return { sym: sym, name: chName(sym), why: why || "", cur: cur, days: days, eps: eps.length, deeper: deeper, worst: worst, medRec: medRec, years: years };
  }).catch(function () { return { sym: sym, name: chName(sym), why: why || "", err: true }; });
}
/* 지금 상황에 맞춰 MDD를 볼 종목 고르기 — 규칙과 이유를 함께 */
function chPickMdd() {
  var out = [], seen = {}; CH_REP_MDD.forEach(function (s) { seen[s] = 1; });
  function add(sym, why) { if (!sym || seen[sym] || out.length >= 8) return; if (!chStat(sym)) return; seen[sym] = 1; out.push({ sym: sym, why: why }); }
  var R = chState.brief, now = chState.now || { match: {} };
  // 1) 지금 사람들이 많이 보는 종목
  chState.popular.slice(0, 3).forEach(function (sym) { var s = chStat(sym); add(sym, "인기 종목 — 지금 많이 찾는 만큼 '얼마나 빠져 있나'가 궁금한 종목" + (s && s.vsHi != null ? " (52주 고점 대비 " + chPct(s.vsHi, 0) + ")" : "")); });
  // 2) 거래대금 상위(큰 회사) 중 가장 깊이 빠진 종목
  if (R) {
    var isFund = function (sym) { return typeof classifySymbol === "function" && classifySymbol(sym) !== "us" && classifySymbol(sym) !== "kr"; };
    var big = [].concat(R.turnover.us, R.turnover.kr).filter(function (s) { return s.vsHi != null && s.vsHi <= -0.2 && !isFund(s.sym); }).sort(function (a, b) { return a.vsHi - b.vsHi; });
    big.slice(0, 2).forEach(function (s) { add(s.sym, "거래가 많은 대형주인데 52주 고점보다 " + chPct(s.vsHi, 0) + " — 과거 낙폭과 비교해 '세일'인지 볼 때"); });
    // 3) 오늘 크게 빠진 종목
    var drop = R.movers.down.filter(function (s) { return s.ret <= -0.04; })[0];
    if (drop) add(drop.sym, "오늘 " + chPct(drop.ret) + " 급락 — 이 정도 하락이 과거엔 몇 번째였는지");
  }
  // 4) 지금 상황의 버팀목 후보
  if (now.match.rateUp) add("SHY", "금리 상승 중 — 단기채는 금리가 올라도 가격이 덜 흔들려 대기 자금 보관처로 쓰여 왔음");
  if (now.match.rateDown) add("IEF", "금리 하락 중 — 금리가 내리면 채권 가격이 오르는 경향");
  if (now.match.oilUp) add("USO", "유가 급등 — 원유 가격이 과거 고점 대비 어디쯤인지");
  if (now.match.panic) add("SCHD", "조정·공포 구간 — 배당주는 하락기에 상대적으로 덜 빠졌던 경우가 많음");
  if (now.match.dollarUp) add("SCHD", "달러 강세 — 원화 투자자에겐 미국 배당주가 환차익까지 얹어지는 구간");
  add("NVDA", "대표 성장주 — 큰 낙폭과 빠른 회복을 반복해 온 사례");
  return out;
}
function chMddTable(rs, withWhy, id) {
  var ok = rs.filter(function (r) { return !r.err; });
  return '<div class="tableWrap"><table class="chMddT"' + (id ? ' id="' + id + '"' : '') + '><tr><th>종목</th><th>고점比</th><th>역대</th><th>최악/회복</th></tr>' +
    ok.map(function (r, i) {
      return '<tr' + (r.group ? ' class="chGroupRow"' : '') + '><td><b>' + r.name + '</b>' + (r.why ? ' <button class="chInfo" data-why="' + escapeHtml(r.why) + '" title="선정 이유">ⓘ</button>' : '') +
        '<div class="briefDim">' + r.sym + (r.cur > -0.005 ? " · 신고가 부근" : " · 고점 후 " + r.days + "일") + '</div></td>' +
        '<td style="color:' + (r.cur < -0.1 ? "var(--down)" : "var(--txt)") + ';font-weight:700">' + chPct(r.cur) + '</td>' +
        '<td>' + (r.cur <= -0.1 ? (r.deeper + 1) + "위 / " + r.eps + "회" : '<span class="briefDim">10% 미만</span>') + '</td>' +
        '<td>' + chPct(r.worst, 0) + (r.medRec != null ? ' <span class="briefDim">/ ' + r.medRec + '일</span>' : '') + '</td></tr>';
    }).join("") + '</table></div>' +
    (rs.length > ok.length ? '<div class="briefDim" style="margin-top:6px">데이터 부족: ' + rs.filter(function (r) { return r.err; }).map(function (r) { return r.sym; }).join(", ") + '</div>' : "");
}
function chBindInfo(root) {
  Array.prototype.forEach.call(root.querySelectorAll(".chInfo"), function (b) {
    b.onclick = function (e) { e.stopPropagation(); var d = document.createElement("div"); d.style.cssText = "font-size:14px;line-height:1.7"; d.textContent = b.getAttribute("data-why"); infoModal.open("💡 선정 이유", d); };
  });
}
function chLoadMdd() {
  var box = $("chMdd"), picks = chPickMdd();
  box.innerHTML = '<div class="briefDim">10년치 데이터로 계산 중… (' + (CH_REP_MDD.length + picks.length) + '종목)</div>';
  return Promise.all([
    Promise.all(CH_REP_MDD.map(function (s) { return chMddRow(s); })),
    Promise.all(picks.map(function (p) { return chMddRow(p.sym, p.why); }))
  ]).then(function (arr) {
    chState.mdd = arr[0]; chState.mddPick = arr[1];
    // 대표 자산 + 맞춤 종목을 한 표로 (맞춤 종목은 ⓘ로 이유)
    var seen = {}, rows = [];
    arr[0].forEach(function (r) { if (!seen[r.sym]) { seen[r.sym] = 1; rows.push(r); } });
    var picks = arr[1].filter(function (r) { if (seen[r.sym]) return false; seen[r.sym] = 1; return true; });
    if (picks.length) { picks[0] = Object.assign({ group: true }, picks[0]); rows = rows.concat(picks); }
    box.innerHTML = '<div class="briefDim" style="margin-bottom:6px">위 ' + arr[0].length + '개는 대표 자산, 아래 ' + picks.length + '개는 오늘 데이터로 고른 종목(ⓘ 이유) · 역대 순위 = 10%+ 하락 중 지금이 몇 번째로 깊은지 · 최악/회복 = 역대 최대 낙폭 / 회복까지 걸린 날(중앙값)</div>' +
      chMddTable(rows, true, "chMddTable");
    chBindInfo(box);
    if (typeof snapAttach === "function") snapAttach();
  });
}
function chMddText() {
  function lines(rs) {
    return rs.filter(function (r) { return !r.err; }).map(function (r) {
      return "· " + r.name + " " + chPct(r.cur) + (r.cur <= -0.1 ? " (역대 " + (r.deeper + 1) + "위/" + r.eps + "회, 고점 후 " + r.days + "일)" : r.cur > -0.005 ? " (신고가 부근)" : "") +
        " · 역대 최악 " + chPct(r.worst, 0) + (r.medRec != null ? " · 회복 중앙값 " + r.medRec + "일" : "") + (r.why ? "\n   └ " + r.why : "");
    });
  }
  var a = lines(chState.mdd || []), b = lines(chState.mddPick || []);
  if (!a.length && !b.length) return "";
  var L = ["📉 MDD 체크 — 전고점 대비 현재 위치", "[대표 자산]"].concat(a);
  if (b.length) L = L.concat(["", "[지금 상황 맞춤]"], b);
  L.push("※ 과거 패턴이 반복된다는 보장은 없음. 감정 대신 기준을 만드는 참고 자료.");
  return L.join("\n");
}

/* ---------- ③ 자산배분: 대표 자산 + 지금 상황 맞춤 구성 ---------- */
var CH_ALLOC = [["SPY", "주식(S&P500)"], ["TLT", "장기채(TLT)"], ["GLD", "금(GLD)"], ["SHY", "현금성(단기채)"], ["KRW=X", "달러/원"]];
/* 상황별 구성 예시 — 비중과 이유. 우선순위: 공포 > 금리 상승 > 유가 > 금리 하락 > 달러 > 평소 */
var CH_PLANS = {
  panic: { title: "조정·공포 구간 — 나눠 사기 + 대기 자금", items: [
    ["SPY", 40, "고점 대비 빠진 지금, 한 번에 말고 3~4번에 나눠 담는 핵심 자산"], ["QQQ", 15, "급락 때 더 빠지고 회복 때 더 빨랐던 성장주 묶음"],
    ["GLD", 15, "공포 구간에 상대적으로 버텼던 경우가 많은 버팀목"], ["SHY", 20, "추가 하락 시 꺼내 쓸 대기 자금 — 가격 변동이 작음"], ["TLT", 10, "경기 침체 우려가 커지면 오르는 경향"]] },
  rateUp: { title: "금리 상승 구간 — 짧은 채권 + 가치주 + 물가 헷지", items: [
    ["SPY", 35, "장기 핵심 자산은 유지"], ["SCHD", 15, "배당 가치주 — 금리 상승기에 성장주보다 덜 흔들렸던 편"],
    ["SHY", 25, "금리가 올라도 가격 영향이 작고, 오른 금리만큼 이자를 받음 (장기채 대신)"], ["GLD", 15, "물가·정책 불확실성 헷지"], ["DBC", 10, "금리 상승의 원인이 물가라면 원자재가 버팀목"]] },
  oilUp: { title: "유가 급등 구간 — 원자재·배당주로 물가 대응", items: [
    ["SPY", 40, "장기 핵심 자산은 유지"], ["DBC", 15, "유가·원자재 상승을 직접 담는 자산"], ["GLD", 15, "물가·지정학 불안 헷지"],
    ["SCHD", 15, "에너지·필수소비재 비중이 있는 배당주"], ["SHY", 15, "물가 → 금리 상승 압력에 대비한 짧은 채권"]] },
  rateDown: { title: "금리 하락 구간 — 장기채·성장주 비중 확대", items: [
    ["SPY", 35, "장기 핵심 자산은 유지"], ["QQQ", 20, "금리가 내리면 성장주 가치 평가에 유리"],
    ["TLT", 25, "금리가 내리면 가격이 오르는 장기채 — 하락폭이 컸던 만큼 회복 여력"], ["GLD", 10, "실질 금리 하락기에 강했던 금"], ["SHY", 10, "리밸런싱용 대기 자금"]] },
  dollarUp: { title: "달러 강세 구간 — 달러 자산의 환차익 활용", items: [
    ["SPY", 45, "원화 투자자에겐 주가 + 환율 두 가지로 버티는 자산"], ["QQQ", 15, "달러 자산 성장주"],
    ["SHY", 20, "달러로 이자 받으며 기다리는 현금성 — 환율이 꺾이면 원화 자산으로 옮길 자금"], ["GLD", 10, "달러와 반대로 움직일 때가 많아 균형용"], ["TLT", 10, "위기 시 버팀목"]] },
  none: { title: "평소 구간 — 균형형 기본 구성", items: [
    ["SPY", 40, "장기 핵심 자산"], ["QQQ", 15, "성장 노출"], ["TLT", 20, "주식이 빠질 때 반대로 움직이길 기대하는 장기채"],
    ["GLD", 15, "주식·채권과 다르게 움직이는 분산 자산"], ["SHY", 10, "하락 때 추가 매수할 대기 자금"]] }
};
function chPickPlan() {
  var m = (chState.now || {}).match || {};
  var key = m.panic ? "panic" : m.rateUp ? "rateUp" : m.oilUp ? "oilUp" : m.rateDown ? "rateDown" : m.dollarUp ? "dollarUp" : "none";
  return Object.assign({ key: key }, CH_PLANS[key]);
}
/* 기간별 성과 계산 (10년치 데이터) */
var CH_PERIODS = [["3개월", 91], ["6개월", 182], ["1년", 365], ["3년", 1095]];
var CH_PLAN_LABEL = { panic: "조정·공포형", rateUp: "금리 상승형", oilUp: "유가 급등형", rateDown: "금리 하락형", dollarUp: "달러 강세형", none: "평소 균형형" };
var CH_WHY_ASSETS = [
  ["TLT", "미국 장기채", "미국 국채 금리", "금리가 오르면(물가↑·긴축·경기 과열) 채권 가격은 내리고, 금리가 내리면(경기 둔화·인하 기대·위기 때 안전자산 수요) 채권 가격은 올라요."],
  ["GLD", "금", "금값 국제 금시세", "실질금리가 내려가거나 달러가 약해질 때, 전쟁·금융 불안이 커질 때 올라요. 금리가 빠르게 오르면 이자가 없는 금은 약해지기 쉬워요."],
  ["DBC", "원자재", "국제유가 원자재", "경기가 좋아 수요가 늘거나 전쟁·감산으로 공급이 막히면 올라요. 경기 침체 우려가 커지면 가장 먼저 빠지는 편이에요."],
  ["KRW=X", "달러/원", "원달러 환율", "미국 금리가 더 높거나 위기 때 안전자산 수요가 몰리면 달러가 강해져요(환율↑). 한국 수출 경기가 좋으면 원화가 강해져요(환율↓)."],
  ["SPY", "미국 주식", "뉴욕증시", "기업 실적과 금리가 핵심이에요. 실적이 좋아도 금리가 급하게 오르면 빠지고, 금리 인하 기대가 생기면 먼저 반등하곤 해요."]
];
chState.whyPeriod = 2;   // 기본 1년
chState.hist = {};
function chLoadHist(list) {
  return Promise.all(list.map(function (sym) {
    if (chState.hist[sym]) return null;
    return getChartData(sym, "max").then(function (p) { chState.hist[sym] = p.rows || []; }).catch(function () { chState.hist[sym] = []; });
  }));
}
function chAt(rows, ms) { if (!rows || !rows.length) return null; var i = chIdx(rows, ms); if (i >= rows.length) i = rows.length - 1; return i; }
function chPeriodRet(sym, days) {
  var r = chState.hist[sym]; if (!r || r.length < 30) return null;
  var lastT = r[r.length - 1].t, i0 = chAt(r, lastT - days * 86400000);
  if (r[i0].t - (lastT - days * 86400000) > 15 * 86400000) return null;   // 그만큼 오래된 데이터가 없음
  return r[r.length - 1].c / r[i0].c - 1;
}
/* 구성(비중) 성과: 처음 비중으로 사서 그대로 둔 경우의 수익률·최대낙폭 */
function chPortfolio(items, days) {
  var data = items.map(function (it) { return { w: it[1] / 100, r: chState.hist[it[0]] }; }).filter(function (d) { return d.r && d.r.length > 30; });
  if (!data.length) return null;
  var ref = data[0].r, lastT = ref[ref.length - 1].t, t0 = lastT - days * 86400000;
  if (data.some(function (d) { return d.r[0].t > t0 + 15 * 86400000; })) return null;
  var base = data.map(function (d) { return d.r[chAt(d.r, t0)].c; }), wsum = data.reduce(function (a, d) { return a + d.w; }, 0);
  var i0 = chAt(ref, t0), peak = 1, mdd = 0, v = 1;
  for (var i = i0; i < ref.length; i += 1) {
    var t = ref[i].t; v = 0;
    data.forEach(function (d, k) { var j = chAt(d.r, t); v += d.w / wsum * d.r[j].c / base[k]; });
    if (v > peak) peak = v; var dd = v / peak - 1; if (dd < mdd) mdd = dd;
  }
  return { ret: v - 1, mdd: mdd };
}
function chRet(sym) {
  var d = chState.recent && chState.recent.symbols[sym]; if (!d || !d.c || d.c.length < 22) return null;
  var c = d.c, n = c.length, last = c[n - 1];
  return { d1: last / c[n - 2] - 1, w1: n > 5 ? last / c[n - 6] - 1 : null, m1: last / c[Math.max(0, n - 22)] - 1, m3: last / c[Math.max(0, n - 64)] - 1 };
}
function chTd(x) { return '<td style="color:' + (x > 0 ? "var(--up)" : x < 0 ? "var(--down)" : "var(--sub)") + '">' + chPct(x) + '</td>'; }
function chPerHead() { return CH_PERIODS.map(function (p) { return '<th>' + p[0] + '</th>'; }).join(""); }

/* '왜 움직였나': 기간 중 가장 크게 움직인 날 + 그 시기 사건 + 당시 기사 검색 링크 */
function chBigDays(sym, days, n) {
  var r = chState.hist[sym]; if (!r || r.length < 30) return [];
  var lastT = r[r.length - 1].t, i0 = chAt(r, lastT - days * 86400000), out = [];
  for (var i = Math.max(1, i0 + 1); i < r.length; i++) out.push({ t: r[i].t, ch: r[i].c / r[i - 1].c - 1 });
  return out.sort(function (a, b) { return Math.abs(b.ch) - Math.abs(a.ch); }).slice(0, n);
}
function chNewsLink(t, q, label) {
  function ymd(ms) { var d = new Date(ms); return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0"); }
  var url = "https://search.naver.com/search.naver?where=news&query=" + encodeURIComponent(q) + "&pd=3&ds=" + ymd(t - 3 * 86400000) + "&de=" + ymd(t + 3 * 86400000) + "&sort=0";
  return '<a class="evtTag newsLink" href="' + url + '" target="_blank" rel="noopener">' + (label || "📰 당시 기사") + '</a>';
}
function chFmtDay(t) { var d = new Date(t); return (d.getFullYear() % 100) + "." + (d.getMonth() + 1) + "." + d.getDate(); }
function chRenderWhy() {
  var pi = chState.whyPeriod, per = CH_PERIODS[pi], days = per[1];
  var html = '<div class="pills" id="chWhyTabs" style="margin-bottom:10px">' + CH_PERIODS.map(function (p, i) { return '<button data-wp="' + i + '"' + (i === pi ? ' class="active"' : '') + '>' + p[0] + '</button>'; }).join("") + '</div>';
  var lastT = Date.now(), t0 = lastT - days * 86400000;
  var evs = (typeof EVENTS !== "undefined" ? EVENTS : []).filter(function (e) { return e.ts >= t0 && e.ts <= lastT; });
  html += CH_WHY_ASSETS.map(function (a) {
    var ret = chPeriodRet(a[0], days), big = chBigDays(a[0], days, 3);
    var news = (chState.whyNews || {})[a[0]] || [];
    return '<div class="chWhyAsset"><div class="chWhyHead"><b>' + a[1] + '</b><span style="color:' + (ret > 0 ? "var(--up)" : ret < 0 ? "var(--down)" : "var(--sub)") + ';font-weight:700">' + per[0] + ' ' + chPct(ret) + '</span></div>' +
      '<div class="chWhyRule">📘 ' + a[3] + '</div>' +
      (big.length ? '<div class="chWhyDays"><span class="briefDim">크게 움직인 날</span> ' + big.map(function (b) {
        return '<span class="chDay"><b style="color:' + (b.ch > 0 ? "var(--up)" : "var(--down)") + '">' + chFmtDay(b.t) + ' ' + chPct(b.ch) + '</b> ' + chNewsLink(b.t, a[2], "📰") + '</span>';
      }).join("") + '</div>' : '') +
      (pi === 0 && news.length ? '<div class="chWhyNews">' + news.slice(0, 2).map(function (it) { return '<a class="briefNewsLink" href="' + it.url + '" target="_blank" rel="noopener">· ' + escapeHtml(it.title) + '</a>'; }).join("") + '</div>' : '') +
      '</div>';
  }).join("");
  html += evs.length ? '<div class="chWhyEvents"><b>이 기간의 큰 사건</b> ' + evs.map(function (e) {
    var col = (typeof EVENT_TYPES !== "undefined" && EVENT_TYPES[e.type]) || "#8b95a1";
    return '<span class="evtTag" style="color:' + col + ';border-color:' + col + '">' + e.date.slice(2).replace(/-/g, ".") + ' ' + e.name + '</span>';
  }).join("") + '</div>' : '<div class="briefDim" style="margin-top:6px">이 기간에 앱에 기록된 큰 사건은 없어요. 위의 📰 링크로 그날 기사를 확인해 보세요.</div>';
  html += '<div class="briefDim" style="margin-top:6px">📰는 그날 앞뒤 3일의 네이버 뉴스 검색으로 열려요. 최근 3개월을 고르면 최신 기사 제목도 함께 보여요.</div>';
  $("chWhy").innerHTML = html;
  Array.prototype.forEach.call(document.querySelectorAll("#chWhyTabs [data-wp]"), function (b) {
    b.onclick = function () { chState.whyPeriod = +b.getAttribute("data-wp"); chRenderWhy(); chUpdateCount(); };
  });
}
function chLoadWhyNews() {
  if (typeof fetchNews !== "function") return Promise.resolve();
  chState.whyNews = {};
  return Promise.all(CH_WHY_ASSETS.map(function (a) {
    return fetchNews({ type: "stock", q: a[2], size: 3 }).then(function (items) { chState.whyNews[a[0]] = items || []; });
  }));
}

function chLoadAlloc() {
  if (!chState.recent) { $("chAlloc").innerHTML = '<div class="briefDim">데이터 없음</div>'; return Promise.resolve(); }
  var plan = chPickPlan(); chState.plan = plan;
  var syms = {}; CH_ALLOC.forEach(function (a) { syms[a[0]] = 1; }); CH_WHY_ASSETS.forEach(function (a) { syms[a[0]] = 1; });
  Object.keys(CH_PLANS).forEach(function (k) { CH_PLANS[k].items.forEach(function (it) { syms[it[0]] = 1; }); }); syms.IEF = 1;
  $("chAlloc").innerHTML = '<div class="briefDim">3년치까지 기간별로 계산 중…</div>';
  return Promise.all([chLoadHist(Object.keys(syms)), chLoadWhyNews()]).then(function () {
    var P = CH_PERIODS;
    // 대표 자산
    chState.alloc = CH_ALLOC.map(function (a) { return { sym: a[0], name: a[1], per: P.map(function (p) { return chPeriodRet(a[0], p[1]); }) }; });
    // 맞춤 구성
    plan.rows = plan.items.map(function (it) { return { sym: it[0], w: it[1], why: it[2], name: chName(it[0]), per: P.map(function (p) { return chPeriodRet(it[0], p[1]); }) }; });
    plan.port = P.map(function (p) { return chPortfolio(plan.items, p[1]); });
    var b6040 = [["SPY", 60], ["IEF", 40]], spy = [["SPY", 100]];
    plan.b6040 = P.map(function (p) { return chPortfolio(b6040, p[1]); });
    plan.spy = P.map(function (p) { return chPortfolio(spy, p[1]); });
    // 6가지 구성 비교
    chState.cmp = Object.keys(CH_PLANS).map(function (k) { return { key: k, label: CH_PLAN_LABEL[k], res: P.map(function (p) { return chPortfolio(CH_PLANS[k].items, p[1]); }) }; });
    chRenderAlloc();
    chRenderWhy();
    if (typeof snapAttach === "function") snapAttach();
  });
}
/* 구성 내용 한 줄: "S&P500(SPY) 40 · 금(GLD) 15 …" */
var CH_SHORT = { SPY: "S&P500", QQQ: "나스닥100", SCHD: "배당주", TLT: "장기채", IEF: "중기채", SHY: "단기채", GLD: "금", DBC: "원자재", USO: "원유" };
function chMix(items) { return items.map(function (it) { return (CH_SHORT[it[0]] || chName(it[0])) + "(" + it[0] + ") " + it[1] + "%"; }).join(" · "); }
function chMixShort(items) { return items.map(function (it) { return it[0] + " " + it[1]; }).join(" · "); }
var CH_LEGEND = "SPY=S&P500 · QQQ=나스닥100 · SCHD=미국 배당주 · TLT=장기채(20년+) · IEF=중기채(7~10년) · SHY=단기채(1~3년) · GLD=금 · DBC=원자재";
function chPortCells(arr) {
  return arr.map(function (x) {
    if (!x) return '<td>-</td>';
    return '<td><b style="color:' + (x.ret >= 0 ? "var(--up)" : "var(--down)") + '">' + chPct(x.ret) + '</b><div class="chMdd">최대 ' + chPct(x.mdd, 0) + '</div></td>';
  }).join("");
}
function chRenderAlloc() {
  var plan = chState.plan, P = CH_PERIODS;
  var why = (chState.now && chState.now.why.length) ? chState.now.why.join(" / ") : "두드러진 신호 없음";
  // 기간별 1위 요약
  var lines = P.map(function (p, i) {
    var ok = chState.cmp.filter(function (c) { return c.res[i]; });
    if (!ok.length) return "";
    var best = ok.slice().sort(function (a, b) { return b.res[i].ret - a.res[i].ret; })[0];
    var safe = ok.slice().sort(function (a, b) { return b.res[i].mdd - a.res[i].mdd; })[0];
    return '<li><b>' + p[0] + '</b>: 수익 1위 <b>' + best.label + '</b> ' + chPct(best.res[i].ret) + ' · 낙폭 가장 작은 <b>' + safe.label + '</b> ' + chPct(safe.res[i].mdd, 0) + '</li>';
  }).filter(Boolean);
  chState.cmpLines = lines.map(function (l) { return l.replace(/<[^>]+>/g, ""); });
  $("chAlloc").innerHTML =
    '<h4 class="chSub">🎯 지금 상황 맞춤 구성 <small>' + plan.title + '</small></h4>' +
    '<div class="chWhyBox">판단 근거: ' + why + '</div>' +
    '<div class="chPlanList">' + plan.rows.map(function (it) {
      return '<div class="chPlanItem"><div class="chPlanTop"><b>' + it.name + '</b> <span class="briefDim">' + it.sym + '</span><b class="chPlanW">' + it.w + '%</b></div><div class="chPlanWhy">' + it.why + '</div></div>';
    }).join("") + '</div>' +

    '<h4 class="chSub">⚖️ 이 구성을 다른 구성과 비교하면 <small>같은 기간에 샀다면 · 수익률 / 최대 낙폭</small></h4>' +
    '<div class="tableWrap"><table id="chCmp"><tr><th>구성</th>' + chPerHead() + '</tr>' +
    chState.cmp.map(function (c) {
      return '<tr' + (c.key === plan.key ? ' class="chCur"' : '') + '><td><b>' + c.label + '</b>' + (c.key === plan.key ? ' <span class="chNowBadge">지금</span>' : '') +
        '<div class="chMix">' + chMixShort(CH_PLANS[c.key].items) + '</div></td>' + chPortCells(c.res) + '</tr>';
    }).join("") +
    '<tr class="chPortRow sub"><td>주식60/채권40<div class="chMix">SPY 60 · IEF 40</div></td>' + chPortCells(plan.b6040) + '</tr>' +
    '<tr class="chPortRow sub"><td>S&P500 100%<div class="chMix">SPY 100</div></td>' + chPortCells(plan.spy) + '</tr>' +
    '</table></div>' +
    '<ul class="chCmpSum">' + lines.join("") + '</ul>' +
    '<details class="chFold"><summary>💬 \'지금\' 표시가 1위가 아닌 이유 · 표 읽는 법 · 약어</summary><div class="chFoldBody">' +
    '이 표는 <b>지난</b> 3개월~3년 동안 각 구성을 들고 있었다면 어땠을지예요. \'지금\' 구성은 오늘의 신호(금리·공포·유가·달러)를 보고 <b>앞으로</b>를 대비해 고른 것이라 지난 성적과 순위가 다를 수 있어요. 지난 1위를 따라가면 이미 오른 자산을 뒤늦게 사는 셈이 되기 쉬워요.<br>' +
    '짧은 기간 1위와 긴 기간 1위가 다르다면 그게 "상황에 맞춰 비중을 조절하는 이유"이자 "한 구성에 다 걸지 않는 이유"예요. 수익만 보지 말고 최대 낙폭(버틸 수 있는 하락인지)을 같이 보세요. 처음 비중으로 사서 그대로 둔 기준이며 <b>예시</b>이지 추천이 아니에요.<br>' +
    '<span class="briefDim">구성 아래 숫자는 비중(%) · ' + CH_LEGEND + '</span></div></details>';
}
function chAllocText() {
  var rs = chState.alloc || [], plan = chState.plan; if (!rs.length) return "";
  var heads = CH_PERIODS.map(function (p) { return p[0]; }).join(" / ");
  var L = ["⚖️ 자산 스냅샷 (" + heads + ")"].concat(rs.map(function (r) { return "· " + r.name + " " + r.per.map(function (x) { return chPct(x, 0); }).join(" / "); }));
  if (plan && plan.rows) {
    L.push(""); L.push("🎯 지금 상황 맞춤 구성 예시 — " + plan.title);
    if (chState.now && chState.now.why.length) L.push("근거: " + chState.now.why.join(" / "));
    plan.rows.forEach(function (it) { L.push("· " + it.name + "(" + it.sym + ") " + it.w + "% — " + it.why); });
    L.push("이 구성 (" + heads + "): " + plan.port.map(function (x) { return x ? chPct(x.ret, 0) + "(최대 " + chPct(x.mdd, 0) + ")" : "-"; }).join(" / "));
    L.push("주식60/채권40: " + plan.b6040.map(function (x) { return x ? chPct(x.ret, 0) : "-"; }).join(" / "));
  }
  if (chState.cmpLines && chState.cmpLines.length) {
    L.push(""); L.push("📊 6가지 구성 비교 — 기간별 1위"); chState.cmpLines.forEach(function (l) { L.push("· " + l); });
    L.push("구성 내용:"); Object.keys(CH_PLANS).forEach(function (k) { L.push("  " + CH_PLAN_LABEL[k] + ": " + chMix(CH_PLANS[k].items)); });
    L.push("  주식60/채권40: S&P500(SPY) 60% · 중기채(IEF) 40%");
  }
  // 왜 움직였나 (선택한 기간)
  var pi = chState.whyPeriod, days = CH_PERIODS[pi][1];
  L.push(""); L.push("🔎 왜 움직였나 (" + CH_PERIODS[pi][0] + ")");
  CH_WHY_ASSETS.forEach(function (a) {
    var big = chBigDays(a[0], days, 2);
    L.push("· " + a[1] + " " + chPct(chPeriodRet(a[0], days)) + (big.length ? " — 큰 움직임 " + big.map(function (b) { return chFmtDay(b.t) + " " + chPct(b.ch); }).join(", ") : ""));
    L.push("  " + a[3]);
  });
  var t0 = Date.now() - days * 86400000;
  var evs = (typeof EVENTS !== "undefined" ? EVENTS : []).filter(function (e) { return e.ts >= t0; });
  if (evs.length) L.push("이 기간 사건: " + evs.map(function (e) { return e.date.slice(2).replace(/-/g, ".") + " " + e.name; }).join(", "));
  L.push("※ 규칙 기반 예시이며 추천이 아님.");
  return L.join("\n");
}

/* ---------- ④ 상황별 과거 사례 ----------
   날짜 구간은 널리 알려진 사건 기준이고, 숫자(등락·낙폭·회복일·1년 뒤)는 전부 앱의 실제 가격 데이터로 계산한다. */
var CH_ASSETS = [["SPY", "S&P500"], ["QQQ", "나스닥100"], ["^KS11", "코스피"], ["SCHD", "미국 배당주"], ["TLT", "장기채"], ["IEF", "중기채"], ["SHY", "단기채"], ["GLD", "금"], ["DBC", "원자재"], ["KRW=X", "달러/원"]];   // v9.3: 비트코인 제외(코인은 따로)
var CH_POP_DEFAULT = ["NVDA", "TSLA", "AAPL", "MSFT", "005930.KS", "000660.KS", "PLTR", "AMZN"];
var CH_SCEN = [
  { id: "rateUp", tag: "금리 급등", icon: "📈",
    lesson: "금리가 오르면 채권 가격은 떨어져요(금리와 채권 가격은 반대로 움직임). 성장주·기술주가 특히 크게 빠지는 경향이 있고, 2022년처럼 채권이 주식과 같이 빠지면 피난처가 되지 못했어요. 다만 2018년 말처럼 주식 급락이 깊어지면 채권이 다시 오르기도 했어요 — 아래 숫자로 확인하세요.",
    eps: [["2022 연준 급격한 금리인상", "2022-01-03", "2022-10-12"], ["2018 파월 쇼크(긴축 지속)", "2018-10-01", "2018-12-24"], ["2013 테이퍼 탠트럼", "2013-05-21", "2013-06-24"]] },
  { id: "rateDown", tag: "금리 인하 전환", icon: "📉",
    lesson: "금리가 내리면 채권 가격이 오르는 경향이 있어요. 하지만 기준금리 인하가 곧 장기금리 하락은 아니에요 — 2024년처럼 인하를 시작했는데도 장기금리가 올라 장기채가 빠진 경우도 있었어요. 아래 숫자로 두 사례를 비교해 보세요.",
    eps: [["2019 연준 금리인하 전환", "2019-07-31", "2019-12-31"], ["2024 연준 금리인하 시작", "2024-09-18", "2024-12-31"]] },
  { id: "panic", tag: "공포 급락 (VIX 급등)", icon: "😱",
    lesson: "짧고 깊은 급락은 대부분 몇 주~몇 달 안에 저점을 찍었어요. 이때 금·장기채가 상대적으로 버틴 경우가 많았지만 항상은 아니었어요. '버틴 자산 일부를 팔아 빠진 자산을 사는' 리밸런싱이 1년 뒤 어땠는지 아래 숫자로 확인하세요.",
    eps: [["2020 코로나 폭락", "2020-02-19", "2020-03-23"], ["2024 엔캐리 청산 급락", "2024-07-16", "2024-08-05"], ["2025 미국 상호관세 발표", "2025-04-02", "2025-04-08"]] },
  { id: "oilUp", tag: "유가 급등·전쟁", icon: "🛢️",
    lesson: "유가가 뛰면 물가 걱정 → 금리 상승 압력으로 이어져 주식과 채권이 같이 약해질 수 있어요. 원자재·에너지가 상대적으로 강한 경향이 있어요.",
    eps: [["2022 러-우 전쟁", "2022-02-24", "2022-06-08"], ["2023 이스라엘-하마스 전쟁", "2023-10-06", "2023-10-27"]] },
  { id: "dollarUp", tag: "달러 강세", icon: "💵",
    lesson: "달러가 강할 때 원화로 투자한 미국 자산은 환율 덕에 손실이 줄어드는 '자연 헷지' 효과가 있었어요. 반대로 코스피 같은 원화 자산은 외국인 매도로 약한 경우가 많아요.",
    eps: [["2022 킹달러", "2022-03-01", "2022-09-28"], ["2024 말 강달러", "2024-10-01", "2024-12-31"]] }
];

/* 지금 상황 감지 (최근 90일 데이터) */
function chDetectNow(recent) {
  function m1(sym) { var d = recent.symbols[sym]; if (!d || !d.c || d.c.length < 22) return null; var c = d.c, n = c.length; return c[n - 1] / c[n - 22] - 1; }
  function last(sym) { var d = recent.symbols[sym]; return d && d.c && d.c.length ? d.c[d.c.length - 1] : null; }
  var tlt = m1("TLT"), uso = m1("USO"), krw = m1("KRW=X"), vix = last("^VIX");
  var spy = recent.symbols.SPY, spyHi = spy && spy.meta && spy.meta.fiftyTwoWeekHigh ? last("SPY") / spy.meta.fiftyTwoWeekHigh - 1 : null;
  var match = {}, why = [];
  if (tlt != null && tlt <= -0.03) { match.rateUp = 1; why.push("장기채(TLT) 1개월 " + chPct(tlt) + " → 금리 상승 중"); }
  if (tlt != null && tlt >= 0.03) { match.rateDown = 1; why.push("장기채(TLT) 1개월 " + chPct(tlt) + " → 금리 하락 중"); }
  if (vix != null && vix >= 25) { match.panic = 1; why.push("VIX " + vix.toFixed(0) + " → 공포 구간"); }
  if (spyHi != null && spyHi <= -0.1) { match.panic = 1; why.push("S&P500 52주 고점 대비 " + chPct(spyHi) + " → 조정 구간"); }
  if (uso != null && uso >= 0.1) { match.oilUp = 1; why.push("원유(USO) 1개월 " + chPct(uso) + " → 유가 급등"); }
  if (krw != null && krw >= 0.02) { match.dollarUp = 1; why.push("달러/원 1개월 " + chPct(krw) + " → 달러 강세"); }
  return { match: match, why: why, tlt: tlt, vix: vix };
}

function chIdx(rows, ms) { var lo = 0, hi = rows.length - 1; while (lo < hi) { var mid = (lo + hi) >> 1; if (rows[mid].t < ms) lo = mid + 1; else hi = mid; } return lo; }
/* 한 구간 × 한 자산: 구간 등락, 구간 중 최대 낙폭, 저점 이후 회복일, 구간 끝에서 1년 뒤 */
function chEpisodeStat(rows, s, e) {
  var si = chIdx(rows, Date.parse(s)), ei = chIdx(rows, Date.parse(e) + 86399999);
  if (ei >= rows.length) ei = rows.length - 1;
  if (!rows.length || rows[si].t > Date.parse(e) + 86400000 || si >= ei) return null;
  if (Math.abs(rows[si].t - Date.parse(s)) > 10 * 86400000) return null;   // 그 시기 데이터가 없음
  var ret = rows[ei].c / rows[si].c - 1;
  var pk = si, peakBefore = rows[si].c, dd = 0, ti = si;
  for (var i = si; i <= ei; i++) {
    if (rows[i].c > rows[pk].c) pk = i;
    var d = rows[i].c / rows[pk].c - 1; if (d < dd) { dd = d; ti = i; peakBefore = rows[pk].c; }
  }
  var rec = null;
  if (dd < -0.02) { for (var j = ti; j < rows.length; j++) if (rows[j].c >= peakBefore) { rec = Math.round((rows[j].t - rows[ti].t) / 86400000); break; } }
  var fi = chIdx(rows, rows[ei].t + 365 * 86400000), fwd = (fi < rows.length && rows[fi].t - rows[ei].t < 400 * 86400000) ? rows[fi].c / rows[ei].c - 1 : null;
  return { ret: ret, dd: dd, rec: rec, recovered: dd >= -0.02 || rec != null, fwd: fwd };
}
function chLoadScenarios() {
  var box = $("chScen");
  var pop = chState.popular.filter(function (s) { return !CH_ASSETS.some(function (a) { return a[0] === s; }); });
  var all = CH_ASSETS.map(function (a) { return { sym: a[0], name: a[1], pop: false }; })
    .concat(pop.map(function (s) { return { sym: s, name: chName(s), pop: true }; }));
  box.innerHTML = '<div class="briefDim">과거 데이터로 계산 중… (' + all.length + '개 자산 × ' + CH_SCEN.reduce(function (a, x) { return a + x.eps.length; }, 0) + '개 구간)</div>';
  return Promise.all(all.map(function (a) {
    return getChartData(a.sym, "max").then(function (p) { return Object.assign({ rows: p.rows }, a); }).catch(function () { return Object.assign({ rows: [] }, a); });
  })).then(function (data) {
    var now = chState.now || { match: {}, why: [] };
    var scen = CH_SCEN.map(function (sc) {
      var eps = sc.eps.map(function (ep) {
        var st = data.map(function (d) { var x = d.rows.length ? chEpisodeStat(d.rows, ep[1], ep[2]) : null; return x ? Object.assign({ sym: d.sym, name: d.name, pop: d.pop }, x) : null; }).filter(Boolean);
        var rep = st.filter(function (x) { return !x.pop; });
        if (rep.length < 3) return null;
        var by = rep.filter(function (x) { return x.sym !== "KRW=X"; }).sort(function (a, b) { return b.ret - a.ret; });
        return { name: ep[0], s: ep[1], e: ep[2], st: rep, pop: st.filter(function (x) { return x.pop; }), best: by[0], worst: by[by.length - 1] };
      }).filter(Boolean);
      return Object.assign({}, sc, { eps: eps, now: !!now.match[sc.id] });
    }).filter(function (sc) { return sc.eps.length; });
    scen.sort(function (a, b) { return (b.now ? 1 : 0) - (a.now ? 1 : 0); });
    chState.scen = scen;
    chRenderScenarios();
  });
}
function chFmtRec(x) { return x.dd >= -0.02 ? "거의 안 빠짐" : x.rec != null ? x.rec + "일 만에 회복" : "아직 미회복"; }
function chCells(list) {
  return '<div class="chEpGrid">' + list.map(function (x) {
    return '<div class="chEpCell"><span>' + x.name + '</span><b style="color:' + (x.ret >= 0 ? "var(--up)" : "var(--down)") + '">' + chPct(x.ret, 0) + '</b></div>';
  }).join("") + '</div>';
}
function chRenderScenarios() {
  var scen = chState.scen || [], now = chState.now || { why: [] };
  var html = '<div class="chNowBox"><b>지금 시장</b> ' + (now.why.length ? now.why.map(function (w) { return '<span class="chNowTag">' + w + '</span>'; }).join("") : '<span class="briefDim">특별히 두드러진 신호 없음 — 평소 구간</span>') + '</div>';
  // 지금과 비슷한 상황만 펼치고 나머지는 접음. 에피소드는 한 줄 요약(버틴/빠진) + '자세히'
  html += scen.map(function (sc, si) {
    var open = sc.now || (si === 0 && !scen.some(function (x) { return x.now; }));
    return '<details class="chScen' + (sc.now ? " now" : "") + '"' + (open ? ' open' : '') + '>' +
      '<summary class="chScenHead"><span>' + sc.icon + '</span><b>' + sc.tag + '</b>' + (sc.now ? '<span class="chNowBadge">지금과 비슷</span>' : '') + '<small class="briefDim">사례 ' + sc.eps.length + '개</small></summary>' +
      '<div class="chScenLesson">' + sc.lesson + '</div>' +
      sc.eps.map(function (ep) {
        return '<div class="chEp"><div class="chEpHead">' + ep.name + ' <small>' + ep.s.replace(/-/g, ".") + ' ~ ' + ep.e.slice(2).replace(/-/g, ".") + '</small></div>' +
          '<div class="chEpNote">🛡 버틴 <b>' + ep.best.name + ' ' + chPct(ep.best.ret, 0) + '</b> · 💥 빠진 <b>' + ep.worst.name + ' ' + chPct(ep.worst.ret, 0) + '</b>' +
          (ep.pop.length ? ' · 🔥 ' + ep.pop.slice(0, 2).map(function (x) { return x.name + ' ' + chPct(x.ret, 0); }).join(", ") : '') + '</div>' +
          '<details class="chEpMore"><summary>자세히 — 자산 ' + (ep.st.length + ep.pop.length) + '개 · 그 뒤 1년 · 회복 기간</summary>' +
          '<div class="chGroup">대표 자산</div>' + chCells(ep.st) +
          (ep.pop.length ? '<div class="chGroup">🔥 지금 인기 자산은 그때</div>' + chCells(ep.pop) : '') +
          (ep.worst.fwd != null && ep.best.fwd != null ? '<div class="chEpNote">↻ 끝난 시점에 버틴 자산을 팔아 빠진 자산을 샀다면, 1년 뒤 ' + ep.worst.name + ' <b>' + chPct(ep.worst.fwd, 0) + '</b> vs 그대로 둔 ' + ep.best.name + ' <b>' + chPct(ep.best.fwd, 0) + '</b></div>' : '') +
          (ep.pop.length ? '<div class="chEpNote">🧠 ' + ep.pop.map(function (x) { return x.name + ' 최대 ' + chPct(x.dd, 0) + ' → ' + chFmtRec(x); }).join(" · ") + '</div>' : '') +
          '</details></div>';
      }).join("") + '</details>';
  }).join("");
  html += '<div class="noteLine" style="margin-top:10px">⚠️ 과거 사례예요. 같은 상황에서 같은 결과가 나온다는 보장은 없어요. 2배·3배 레버리지 상품은 하락 폭이 더 크고, 오르내림을 반복하면 지수가 제자리여도 손실이 쌓여요(변동성 손실) — 회복용으로 쓸 땐 비중과 기간을 더 보수적으로 잡으세요.</div>';
  $("chScen").innerHTML = html;
  if (typeof snapAttach === "function") snapAttach();
}
function chScenText(onlyNow) {
  var scen = (chState.scen || []).filter(function (sc) { return !onlyNow || sc.now; });
  if (!scen.length) scen = (chState.scen || []).slice(0, 1);
  if (!scen.length) return "";
  var now = chState.now || { why: [] }, L = ["🧭 상황별 과거 사례"];
  if (now.why.length) L.push("지금: " + now.why.join(" / "));
  scen.forEach(function (sc) {
    L.push(""); L.push(sc.icon + " " + sc.tag + (sc.now ? " (지금과 비슷)" : "")); L.push(sc.lesson);
    sc.eps.forEach(function (ep) {
      L.push("· " + ep.name + ": " + ep.st.map(function (x) { return x.name + " " + chPct(x.ret, 0); }).join(", "));
      if (ep.pop.length) L.push("  🔥 인기 자산: " + ep.pop.map(function (x) { return x.name + " " + chPct(x.ret, 0); }).join(", "));
      if (ep.worst.fwd != null && ep.best.fwd != null) L.push("  → 버틴 " + ep.best.name + "를 팔아 빠진 " + ep.worst.name + "를 샀다면 1년 뒤 " + chPct(ep.worst.fwd, 0) + " (그대로 뒀다면 " + chPct(ep.best.fwd, 0) + ")");
      if (ep.pop.length) L.push("  → " + ep.pop.map(function (x) { return x.name + " 최대 " + chPct(x.dd, 0) + ", " + chFmtRec(x); }).join(" / "));
    });
  });
  L.push(""); L.push("※ 과거 데이터 기준. 같은 결과를 보장하지 않으며, 레버리지 상품은 변동성 손실에 유의.");
  return L.join("\n");
}

/* ---------- 전체 글 ---------- */
function chFullText(short) {
  var d = chState.daily, parts = [];
  if (!short && chState.issues && chState.issues.length && typeof issuesText === "function") parts.push(issuesText(chState.issues).replace(/\n@uphill\.lab$/, ""));   // 맨 앞: 핵심 이슈 5
  if (d && d.ok) parts.push(short ? d.text.split("\n■ 종목")[0].trim() : d.text);
  if (!short) {
    var mdd = chMddText(); if (mdd) parts.push(mdd);
    var al = chAllocText(); if (al) parts.push(al);
    var sc = chScenText(true); if (sc) parts.push(sc);
  }
  var t = parts.join("\n\n");
  if (short && t.length > 480) t = t.slice(0, 470).replace(/\n[^\n]*$/, "") + "\n…(전문은 링크)";
  return t;
}
function chUpdateCount() {
  var full = chFullText(false), s = chFullText(true);
  $("chCount").textContent = "전체 " + full.length + "자 · 스레드용 " + s.length + "자" + (s.length > 500 ? " (500자 초과)" : "");
}

function renderChannel() {
  if (chState._init) return;
  chState._init = true;
  $("chDailyCopy").onclick = function () { if (chState.daily && chState.daily.ok) chCopy(chState.daily.text, this); };
  $("chDailyReload").onclick = function () { chLoadDaily(true).then(chUpdateCount); };
  $("chMddCopy").onclick = function () { chCopy(chMddText(), this); };
  $("chAllocCopy").onclick = function () { chCopy(chAllocText(), this); };
  $("chScenCopy").onclick = function () { chCopy(chScenText(false), this); };
  $("chFullCopy").onclick = function () { chCopy(chFullText(false), this); };
  $("chShortCopy").onclick = function () { chCopy(chFullText(true), this); };
  dataReady().then(function () {
    return Promise.all([chLoadDaily(false), chPrepare()]);
  }).then(function () {
    chRenderQuality();
    if (typeof slChannel === "function") try { slChannel(); } catch (e) { console.warn(e); }
    if (typeof issuesForChannel === "function") try { issuesForChannel(); } catch (e) { console.warn(e); }
    if (typeof pubRender === "function") try { pubRender(); } catch (e) { console.warn(e); }
    return Promise.all([chLoadAlloc(), chLoadMdd()]);
  }).then(function () { if (typeof issuesForChannel === "function") try { issuesForChannel(); } catch (e) { console.warn(e); } if (typeof pubRender === "function") try { pubRender(); } catch (e) { console.warn(e); } })   // MDD·시장 신호 반영해 다시
    .then(chLoadScenarios).then(chUpdateCount).then(slRun, slRun);
  function slRun() { if (typeof slChannel === "function") try { slChannel(); } catch (e) { console.warn(e); } }
}
