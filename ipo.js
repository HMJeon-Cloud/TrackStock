/* ============================================================
   공모주 (v11.3.4) — 관심 탭 '공모주'
   ① 청약 일정: 언제(청약·상장 예정일) · 어디서(인수단 증권사) · 얼마에(밴드/확정 공모가) · 몇 주(최소 단위·증거금·일반 배정 물량)
      + 얼마까지(참고): 상장일 가격 범위(공모가 60~400%) · 최근 1년 상장주 첫날 종가 분포
   ② 상장 결과: 공모가 → 첫날 시가 · 첫날 종가 · 1개월(20거래일) · 지금
   v11.3.4: 수요예측·청약 경쟁률과 경쟁률 백테스트는 뺐다 (DART 원문에 일정한 형식으로 남지 않아 대부분 비어 있었음)
   데이터: /api/snap?ipo=1 (DART 증권신고서·투자설명서 + 상장 뒤 야후 종가) — 새 함수·크론 없음
   ============================================================ */
var IPO = { doc: null, loading: null, tab: "sched" };
(function () { try { var j = JSON.parse(localStorage.getItem("sm.ipo") || "null"); if (j && (j.tab === "sched" || j.tab === "res")) IPO.tab = j.tab; } catch (e) {} })();
function ipoSave() { try { localStorage.setItem("sm.ipo", JSON.stringify({ tab: IPO.tab })); } catch (e) {} }
var IPO_FD = [[-9, 0, "공모가 아래"], [0, 0.5, "0~50%"], [0.5, 1, "50~100%"], [1, 2, "100~200%"], [2, 9, "200% 넘게"]];   // 첫날 종가 구간
var IPO_DEF = { minQ: 10, depPct: 50, genPct: 25 };   // 원문에서 못 읽으면 쓰는 보통값

function ipoEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function ipoPct(x, d) { return x == null || !isFinite(x) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function ipoWon(v) { return v == null || !isFinite(v) ? "-" : Math.round(v).toLocaleString("ko-KR") + "원"; }
function ipoNum(v) { return v == null || !isFinite(v) ? "-" : Math.round(v).toLocaleString("ko-KR"); }
function ipoD(d) { d = String(d || ""); return d.length >= 8 ? +d.slice(4, 6) + "." + +d.slice(6, 8) : "-"; }
function ipoToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ""); }
function ipoAdd(ymd, d) { var t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) + d * 864e5; return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
function ipoPrice(x) { return x.price || x.offer || null; }
function ipoMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function ipoQ(a, q) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }
function ipoStatus(x) {
  var t = ipoToday(), s = x.sbd || [], e = s[1] || s[0];
  if (x.ret && x.ret.listDate) return ["listed", "상장"];
  if (!s.length) return ["prep", "준비"];
  if (t < s[0]) return ["soon", "청약 예정"];
  if (t <= e) return ["now", "청약 중"];
  return ["wait", "상장 대기"];
}

/* ---------- 데이터 ---------- */
function ipoEnsure(fresh) {
  if (IPO.doc && !fresh) return Promise.resolve(IPO.doc);
  if (IPO.loading) return IPO.loading;
  IPO.loading = fetch("/api/snap?ipo=1" + (fresh ? "&fresh=" + Date.now() : "")).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    .then(function (d) { IPO.doc = d || { items: [], none: true }; IPO.loading = null; return IPO.doc; });
  return IPO.loading;
}
function ipoItems() { return ((IPO.doc && IPO.doc.items) || []).filter(function (x) { return x.stage !== "drop"; }); }
function ipoSched() {
  var t = ipoToday(), lo = ipoAdd(t, -7), hi = ipoAdd(t, 45);
  return ipoItems().filter(function (x) { var s = x.sbd; if (!s) return false; var e = s[1] || s[0]; return e >= lo && s[0] <= hi && !(x.ret && x.ret.days > 3); }).sort(function (a, b) { return a.sbd[0].localeCompare(b.sbd[0]); });
}
function ipoListed() { return ipoItems().filter(function (x) { return x.ret && x.ret.listDate; }).sort(function (a, b) { return b.ret.listDate.localeCompare(a.ret.listDate); }); }

/* 청약 계산: 기준 가격(확정가, 없으면 밴드 상단) · 최소 단위 · 최소 증거금 · 일반청약 배정 물량 */
function ipoBuy(x) {
  var px = x.price || (x.band && x.band[1]) || x.offer || null, fixed = !!x.price || (!x.band && !!x.offer);
  var minQ = x.minQ || IPO_DEF.minQ, dep = x.depPct || IPO_DEF.depPct, gen = x.genPct || IPO_DEF.genPct;
  return { px: px, fixed: fixed, minQ: minQ, dep: dep, gen: gen, guess: { minQ: !x.minQ, dep: !x.depPct, gen: !x.genPct },
    minDep: px ? px * minQ * dep / 100 : null, genShares: x.shares ? x.shares * gen / 100 : null, lo: px ? px * 0.6 : null, hi: px ? px * 4 : null };
}
/* 최근 1년 상장주 첫날 종가 분포 — '얼마까지 오를까'의 참고값 (예측 아님) */
function ipoFirstDay() {
  var y = ipoListed().filter(function (x) { return x.ret.listDate >= ipoAdd(ipoToday(), -365) && x.ret.c0 != null; }), v = y.map(function (x) { return x.ret.c0; });
  return { n: v.length, med: ipoMed(v), q1: ipoQ(v, 0.25), q3: ipoQ(v, 0.75), up: v.length ? v.filter(function (r) { return r > 0; }).length / v.length : null,
    bk: IPO_FD.map(function (b) { var L = y.filter(function (x) { return x.ret.c0 >= b[0] && x.ret.c0 < b[1]; }); return { lab: b[2], n: L.length, ex: L.slice(0, 3).map(function (x) { return x.name; }) }; }) };
}
function ipoUw(x, max) {
  var U = x.uw && x.uw.length ? x.uw : x.lead ? [{ n: x.lead, lead: true }] : [];
  var tot = U.reduce(function (s, u) { return s + (u.q || 0); }, 0);
  return U.slice(0, max || 6).map(function (u) { return u.n + (u.lead ? "(대표)" : "") + (tot && u.q && U.length > 1 ? " " + Math.round(u.q / tot * 100) + "%" : ""); });
}

/* ============================================================ 화면 ============================================================ */
function renderIpo() {
  var box = document.getElementById("ipoBody"); if (!box) return;
  if (!IPO.doc) { box.innerHTML = '<div class="dvEmpty">공모주 기록을 불러오는 중…</div>'; ipoEnsure().then(renderIpo); return; }
  if (IPO.doc.none || !ipoItems().length) { box.innerHTML = '<div class="dvEmpty">아직 수집된 공모주가 없어요. 매일 아침 수집이 돌면 DART 증권신고서에서 청약 일정을 모으고, 상장 뒤 가격을 쌓아요.</div>'; return; }
  var h = '<div class="mkTabs ipoTabs">' + [["sched", "청약 일정"], ["res", "상장 결과"]].map(function (t) { return '<button data-ipot="' + t[0] + '" class="' + (IPO.tab === t[0] ? "on" : "") + '">' + t[1] + '</button>'; }).join("") + '</div><div id="ipoPane"></div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-ipot]"), function (b) { b.onclick = function () { IPO.tab = b.getAttribute("data-ipot"); ipoSave(); renderIpo(); }; });
  var pane = document.getElementById("ipoPane");
  if (IPO.tab === "res") ipoResRender(pane); else ipoSchedRender(pane);
  Array.prototype.forEach.call(box.querySelectorAll("[data-ipoopen]"), function (b) { b.onclick = function () { var s = b.getAttribute("data-ipoopen"); if (typeof navTo === "function") navTo("single", "analysis"); var i = document.getElementById("searchInput"); if (i) i.value = s; if (typeof loadSymbol === "function") loadSymbol(s); }; });
}
function ipoName(x) { return x.sym ? '<button class="linkBtn" data-ipoopen="' + x.sym + '">' + ipoEsc(x.name) + '</button>' : '<b>' + ipoEsc(x.name) + '</b>'; }
function ipoKpi(l, v, s) { return '<div class="kpi"><div class="kl">' + l + '</div><div class="kv">' + v + '</div>' + (s ? '<div class="kl" style="margin-top:2px">' + s + '</div>' : '') + '</div>'; }
function ipoSchedRender(pane) {
  var L = ipoSched(), F = ipoFirstDay();
  var now = L.filter(function (x) { return ipoStatus(x)[0] === "now"; }).length, soon = L.filter(function (x) { return ipoStatus(x)[0] === "soon"; }).length;
  var h = '<div class="kpiStrip">' + ipoKpi("청약 중", now + "<small>건</small>") + ipoKpi("청약 예정 (45일)", soon + "<small>건</small>") + ipoKpi("최근 1년 첫날 종가 중앙값", ipoPct(F.med, 0), F.n + "개 · 참고용") + ipoKpi("첫날 공모가 위로 마감", F.up == null ? "-" : Math.round(F.up * 100) + "<small>%</small>", "최근 1년") + '</div>';
  h += L.length ? '<div class="ipoCards">' + L.map(function (x) {
    var st = ipoStatus(x), B = ipoBuy(x), U = ipoUw(x);
    var p = x.price ? ipoWon(x.price) + ' <small>확정</small>' : x.band ? ipoNum(x.band[0]) + "~" + ipoWon(x.band[1]) + ' <small>희망</small>' : x.offer ? ipoWon(x.offer) + ' <small>예정</small>' : "-";
    var when = "청약 " + ipoD(x.sbd[0]) + (x.sbd[1] && x.sbd[1] !== x.sbd[0] ? "~" + ipoD(x.sbd[1]) : "") + (x.pymd ? " · 환불·납입 " + ipoD(x.pymd) : "") + (x.listPlan ? " · 상장 예정 " + ipoD(x.listPlan) : "");
    var many = B.px ? "최소 " + B.minQ + "주" + (B.guess.minQ ? "(보통)" : "") + " = 증거금 " + ipoWon(B.minDep) + " (" + B.dep + "%" + (B.fixed ? "" : " · 밴드 상단 기준") + ")" : "공모가 나오면 계산";
    var gen = B.genShares ? "일반청약 몫 약 " + ipoNum(B.genShares) + "주 (" + B.gen + "%" + (B.guess.gen ? " 가정" : "") + ")" : "";
    var up = B.px ? "상장일 가격 범위 " + ipoWon(B.lo) + " ~ " + ipoWon(B.hi) + (F.n >= 5 ? " · 최근 1년 중앙값이면 약 " + ipoWon(B.px * (1 + F.med)) : "") : "";
    function li(k, v) { return v ? '<li><b>' + k + '</b><span>' + ipoEsc(v) + '</span></li>' : ""; }
    return '<div class="ipoCardI"><div class="dsR1"><span class="dsD">' + ipoD(x.sbd[0]) + '</span>' + ipoName(x) + '<span class="dsTag ipo-' + st[0] + '">' + st[1] + '</span><b class="dsV">' + p + '</b></div><ul class="ipoFacts">' +
      li("언제", when) + li("어디서", U.length ? U.join(" · ") : "신고서 확인 중") + li("몇 주", many + (gen ? " · " + gen : "")) + li("참고", up) + '</ul>' +
      (x.dDoc || x.first ? '<div class="dsR2"><span></span><a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=' + (x.dDoc || x.first) + '" target="_blank" rel="noopener">원문 ›</a></div>' : '') + '</div>';
  }).join("") + '</div>' : '<div class="dvEmpty sm">앞으로 45일 안에 청약하는 공모주가 아직 없어요.</div>';
  if (F.n >= 5) {
    var mx = Math.max.apply(null, F.bk.map(function (b) { return b.n; }).concat([1]));
    h += '<div class="mkStep"><b>i</b>참고 · 최근 1년 상장주 첫날 종가 <small class="briefDim">공모가 대비 · ' + F.n + '개 · 가운데 절반은 ' + ipoPct(F.q1, 0) + ' ~ ' + ipoPct(F.q3, 0) + '</small></div><div class="ipoBk">' + F.bk.map(function (b, i) {
      return '<div class="ipoBkR"><span class="ipoBkL">' + b.lab + '</span><span class="ipoBkBar"><i class="' + (i ? "up" : "dn") + '" style="width:' + Math.round(b.n / mx * 100) + '%"></i></span><b>' + b.n + '개</b><span class="ipoBkS">' + ipoEsc(b.ex.join(" · ")) + '</span></div>';
    }).join("") + '</div>';
  }
  h += '<details class="howto"><summary>일정 읽는 법</summary><div class="body"><ul><li><b>어디서</b> — 인수단에 든 증권사 계좌로 청약해요. 대표 주관사가 보통 물량이 가장 많아요(옆 숫자 = 인수 물량 비중).</li><li><b>몇 주</b> — 최소 청약 단위만 넣어도 <b>균등배정</b>(일반 물량의 절반 이상을 청약자 수대로 나눔) 추첨 대상이에요. 인기 종목은 1주도 못 받거나 1~2주만 받는 경우가 많아요. 증거금은 청약 금액의 일부를 먼저 내고, 배정 안 된 돈은 환불일에 돌려받아요.</li><li><b>참고</b> — 2023년 6월부터 상장 첫날 가격은 공모가의 60~400% 안에서 움직여요. 중앙값은 지난 종목들의 가운데 값일 뿐 <b>이 종목의 예상가가 아니에요.</b></li><li>원문에서 못 읽은 값은 보통값(최소 10주 · 증거금 50% · 일반 몫 25%)으로 계산하고 \'보통\'·\'가정\'으로 표시했어요. 정확한 값은 \'원문\'과 증권사 공지를 확인해 주세요.</li></ul></div></details>';
  pane.innerHTML = h;
}
function ipoResRender(pane) {
  var L = ipoListed().slice(0, 80), F = ipoFirstDay();
  var y = ipoListed().filter(function (x) { return x.ret.listDate >= ipoAdd(ipoToday(), -365); }), m1 = y.map(function (x) { return x.ret.m1; }).filter(function (v) { return v != null; }), last = y.map(function (x) { return x.ret.last; }).filter(function (v) { return v != null; });
  var h = '<div class="kpiStrip">' + ipoKpi("최근 1년 상장", y.length + "<small>개</small>") + ipoKpi("첫날 종가 중앙값", ipoPct(F.med, 0)) + ipoKpi("1개월 중앙값", ipoPct(ipoMed(m1), 0)) + ipoKpi("지금 공모가 위", last.length ? Math.round(last.filter(function (v) { return v > 0; }).length / last.length * 100) + "<small>%</small>" : "-", last.length + "개 중") + '</div>';
  h += '<div class="tableWrap"><table class="dvTable ipoT"><thead><tr><th class="l">상장일 · 종목</th><th>공모가</th><th>첫날 시가</th><th>첫날 종가</th><th>1개월</th><th>지금</th></tr></thead><tbody>' + L.map(function (x) {
    var r = x.ret, px = ipoPrice(x); function c(v) { return '<td class="' + (v > 0 ? "pos" : v < 0 ? "neg" : "") + '">' + (v == null ? "-" : ipoNum(px * (1 + v)) + '<small>' + ipoPct(v, 0) + '</small>') + '</td>'; }
    return '<tr><td class="l"><span class="dsD">' + ipoD(r.listDate) + '</span> ' + ipoName(x) + '</td><td>' + ipoNum(px) + '</td>' + c(r.o0) + c(r.c0) + c(r.m1) + c(r.last) + '</tr>';
  }).join("") + '</tbody></table></div>';
  h += '<p class="mentalNote">가격(원) 아래 작은 글씨 = 공모가 대비. 1개월은 상장 뒤 20거래일째 종가(아직이면 \'-\'), 지금은 최근 종가예요. 실제로는 배정 물량이 몇 주뿐이고 수수료가 있어 체감 수익과 달라요.</p>';
  pane.innerHTML = h;
}

/* ---------- 운영자: 지금 수집 (공모주) — 지난 2년을 나눠서 끝까지 ---------- */
function ipoRunCollect() {
  var tok = ""; try { tok = (typeof OWNER !== "undefined" && OWNER.token) || localStorage.getItem("sm.owner") || ""; } catch (e) {}
  var msg = document.querySelector("#wp-ipo .dsRunMsg"), btn = document.querySelector("#wp-ipo [data-ipo-run]"), errs = [], t0 = Date.now(), tot = 0, found = 0;
  function say(t) { if (msg) msg.innerHTML = ipoEsc(t) + (errs.length ? '<details class="dsErr"><summary>오류 ' + errs.length + '건 보기</summary><ul>' + errs.slice(0, 40).map(function (x) { return "<li>" + ipoEsc(x) + "</li>"; }).join("") + '</ul></details>' : ''); }
  if (!tok) { say("운영자 토큰이 없어요."); return; }
  if (btn) btn.disabled = true;
  function run(n) {
    say("공모주 받는 중 (" + n + "회차) · 찾은 회사 " + tot + "개 · " + Math.round((Date.now() - t0) / 1000) + "초");
    return fetch("/api/channel?op=disc&run=1&part=ipo&ipodays=730", { headers: { "x-owner": tok }, cache: "no-store" }).then(function (r) { return r.json().catch(function () { return { ok: false, reason: "HTTP_" + r.status }; }); }).then(function (j) {
      var d = j.ipo || {}; (d.log && d.log.errors || []).forEach(function (x) { if (errs.indexOf(x) < 0) errs.push(x); });
      if (!j.ok || d.ok === false) { errs.push(d.reason === "NO_DART_KEY" ? "DART_API_KEY 없음" : (j.reason || d.reason || d.error || "실패")); return; }
      tot = d.total || tot; found += d.found || 0;
      if (d.done || n >= 40) return;
      say("공모주 받는 중 (" + n + "회차) · " + (d.progress || "") + " · 회사 " + tot + "개 · 남은 일 " + (d.remain || 0) + "개 · " + Math.round((Date.now() - t0) / 1000) + "초");
      return run(n + 1);
    });
  }
  run(1).then(function () { say("완료 · 공모주 " + tot + "개 (새로 " + found + "개) · " + Math.round((Date.now() - t0) / 1000) + "초"); IPO.doc = null; return ipoEnsure(true).then(renderIpo); })
    .catch(function (e) { say("요청 실패: " + (e && e.message || e) + " — 다시 누르면 이어서 받아요."); })
    .then(function () { if (btn) btn.disabled = false; });
}
document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-ipo-run]"); if (b && !(typeof isOwner === "function" && !isOwner())) ipoRunCollect(); });

/* ============================================================ 카드 (운영자) ============================================================ */
function ipoSrc() { return "DART 증권신고서·투자설명서 · 야후 파이낸스 종가 · StockMind 정리"; }
function ipoSpec(cat, src) {
  if (src === "ipoSched" && cat === "table") {
    var L = ipoSched().filter(function (x) { return ipoStatus(x)[0] === "soon" || ipoStatus(x)[0] === "now"; }).slice(0, 10); if (!L.length) return null;
    return { meta: { title: "이번에 청약하는 공모주", sub: "청약일 순 · 최소 증거금 = 최소 단위 × 공모가 × 증거금률", source: ipoSrc(), catName: "공모주" },
      spec: { cols: ["청약일", "종목", "공모가", "최소 증거금", "주관사"], widths: [0.16, 0.26, 0.2, 0.18, 0.2], hlCols: [3], rows: L.map(function (x) { var B = ipoBuy(x); return [ipoD(x.sbd[0]) + (x.sbd[1] && x.sbd[1] !== x.sbd[0] ? "~" + ipoD(x.sbd[1]) : ""), x.name, x.price ? ipoWon(x.price) : x.band ? ipoNum(x.band[0]) + "~" + ipoNum(x.band[1]) : x.offer ? ipoWon(x.offer) : "-", B.minDep ? ipoWon(B.minDep) : "-", (x.uw && x.uw.length > 1 ? x.uw[0].n + " 외 " + (x.uw.length - 1) : x.lead) || "-"]; }), note: "밴드만 나온 종목은 상단 가격 기준 · 균등배정은 최소 단위만 넣어도 추첨 대상" } };
  }
  if (src === "ipoResult" && cat === "table") {
    var R = ipoListed().slice(0, 10); if (!R.length) return null;
    return { meta: { title: "최근 상장한 공모주 성적", sub: "공모가 대비 · 첫날 시가·종가 · 1개월(20거래일) · 지금", source: ipoSrc(), catName: "공모주" },
      spec: { cols: ["상장일", "종목", "첫날 시가", "첫날 종가", "1개월", "지금"], widths: [0.13, 0.27, 0.15, 0.15, 0.15, 0.15], hlCols: [5], rows: R.map(function (x) { return [ipoD(x.ret.listDate), x.name, ipoPct(x.ret.o0, 0), ipoPct(x.ret.c0, 0), ipoPct(x.ret.m1, 0), ipoPct(x.ret.last, 0)]; }), note: "1개월이 '-'면 아직 20거래일이 안 된 종목" } };
  }
  if (src === "ipoFirst" && cat === "table") {
    var F = ipoFirstDay(); if (F.n < 8) return null;
    return { meta: { title: "공모주, 첫날 얼마에 끝났을까", sub: "최근 1년 상장 " + F.n + "개 · 첫날 종가 (공모가 대비)", source: ipoSrc(), catName: "공모주" },
      spec: { cols: ["첫날 종가", "종목 수", "비중", "예"], widths: [0.22, 0.14, 0.14, 0.5], hlCols: [1], rows: F.bk.map(function (b) { return [b.lab, b.n + "개", Math.round(b.n / F.n * 100) + "%", b.ex.join(" · ") || "-"]; }), note: "중앙값 " + ipoPct(F.med, 0) + " · 가운데 절반 " + ipoPct(F.q1, 0) + "~" + ipoPct(F.q3, 0) + " · 다음 종목의 예상이 아니에요" } };
  }
  return null;
}
(function () {
  if (typeof TPL_SOURCES === "undefined" || typeof tplSpec !== "function") return;
  TPL_SOURCES.table.push({ id: "ipoSched", t: "공모주 청약 일정" }, { id: "ipoResult", t: "최근 상장 공모주 성적" }, { id: "ipoFirst", t: "공모주 첫날 종가 분포" });
  var s0 = tplSpec; tplSpec = function (cat, src, mk) { if (/^ipo/.test(src || "")) return ipoSpec(cat, src); return s0.apply(this, arguments); };
  var p0 = tplPrep; tplPrep = function (cat, mk, src) { if (/^ipo/.test(src || "")) return ipoEnsure(); return p0.apply(this, arguments); };
})();
function ipoDeckOpen() {
  var plan = [["ipoSched", "청약일정"], ["ipoResult", "상장성적"], ["ipoFirst", "첫날분포"]];
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { return ipoEnsure(); }).then(function () {
    var list = []; plan.forEach(function (p) { var x = ipoSpec("table", p[0]); if (x) list.push({ cv: tplCard("table", x.meta, x.spec), name: (list.length + 1) + "_" + p[1] }); });
    if (!list.length) { alert("아직 공모주 기록이 없어요."); return; }
    var day = typeof pubToday === "function" ? pubToday().replace(/-/g, "") : "", box = document.createElement("div");
    box.innerHTML = '<div class="row" style="gap:8px;margin-bottom:12px"><button class="primary" data-act="all">전부 저장</button></div>' + (typeof thrPanelHtml === "function" ? thrPanelHtml("재테크") : "") + '<div class="cardsWrap"></div>';
    var wrap = box.querySelector(".cardsWrap");
    list.forEach(function (it) { it.url = it.cv.toDataURL("image/png"); it.file = "uphill.lab_공모주_" + day + "_" + it.name + ".png"; var f = document.createElement("figure"); f.innerHTML = '<img alt=""><figcaption><span>' + it.name.replace("_", ". ") + '</span><button class="chip" style="padding:3px 10px;font-size:11px">저장</button></figcaption>'; f.querySelector("img").src = it.url; f.querySelector("button").onclick = function () { cardsDownload(it); }; wrap.appendChild(f); });
    box.querySelector('[data-act="all"]').onclick = function () { list.forEach(function (it, i) { setTimeout(function () { cardsDownload(it); }, i * 400); }); };
    if (typeof thrBind === "function") try { thrBind(box, thrIpo(list.map(function (x) { return x.name; }))); } catch (e) { console.warn(e); }
    infoModal.open("공모주 카드 · " + list.length + "장", box);
  });
}
/* 오늘 올릴 카드: 7일 안에 청약이 있거나, 3일 안에 상장한 종목이 있을 때 */
function ipoPlanHints() {
  if (!IPO.doc) return [];
  var t = ipoToday(), s = ipoSched().filter(function (x) { return x.sbd[0] <= ipoAdd(t, 7) && (x.sbd[1] || x.sbd[0]) >= t; }), l = ipoListed().filter(function (x) { return x.ret.listDate >= ipoAdd(t, -3); });
  if (!s.length && !l.length) return [];
  return [{ id: "ipo", t: "🎟️ 공모주 — " + (s.length ? "이번 주 청약 " + s.length + "곳" : "") + (s.length && l.length ? " · " : "") + (l.length ? "최근 상장 " + l.length + "곳" : ""), d: "청약 직전엔 '어디서 얼마로 몇 주', 상장 직후엔 '첫날 얼마에 끝났나'가 가장 많이 읽혀요", kind: "ipo" }];
}

/* ---------- 업로드 글 (v11.0 스레드 공식) ---------- */
function thrIpo(names) {
  if (typeof thrCompose !== "function") return [];
  var F = ipoFirstDay(), t7 = ipoToday(), S = ipoSched().filter(function (x) { var k = ipoStatus(x)[0]; return (k === "soon" || k === "now") && x.sbd[0] <= ipoAdd(t7, 7); }), R = ipoListed().slice(0, 5);
  var sLines = S.slice(0, 4).map(function (x) { var B = ipoBuy(x), U = ipoUw(x, 2); return ipoD(x.sbd[0]) + " " + x.name + (B.px ? " · " + ipoWon(B.px) + (B.fixed ? "" : "(상단)") : "") + (B.minDep ? " · 최소 증거금 " + ipoWon(B.minDep) : "") + (U.length ? " · " + U[0].replace(/ \d+%$/, "") : ""); });
  var rLines = R.map(function (x) { return x.name + " 첫날 종가 " + ipoPct(x.ret.c0, 0) + (x.ret.m1 != null ? " · 1개월 " + ipoPct(x.ret.m1, 0) : ""); });
  var LIM = ["한계도 적어둘게요.", "인기 공모주는 최소 단위로 넣으면 1~2주, 못 받는 경우도 많아요. 수익률이 높아도 손에 쥐는 돈은 작을 수 있어요.", "지난 종목의 중앙값은 다음 종목의 예상가가 아니에요.", "증거금·최소 단위는 증권사마다 다를 수 있어 공지를 꼭 확인해 주세요."];
  var base = { summary: sLines.concat(rLines.slice(0, 3)), insights: [F.n >= 8 ? "최근 1년 상장 " + F.n + "개의 첫날 종가 중앙값은 공모가 대비 " + ipoPct(F.med, 0) + ", 공모가 위로 끝난 비율은 " + Math.round(F.up * 100) + "%였어요." : ""].filter(Boolean),
    cardList: (names || []).map(function (n) { return n.replace("_", " "); }), question: "공모주 청약, 최소 단위만 넣으시나요 아니면 더 넣으시나요?", tags: ["우상향연구소", "공모주", "공모주청약", "IPO", "재테크"], foot: "DART 증권신고서·투자설명서 · 야후 종가 · 공모가 대비 · 투자 권유 아님",
    data: sLines.length ? sLines : rLines, sort: false, thFoot: "DART 공시 · 공모가 대비 · 투자 권유 아님", limit: LIM, reply: "공모주 고를 때 제일 먼저 보는 게 뭐예요?" };
  var out = [];
  function add(label, hook, ex) { var c = thrCompose(Object.assign({}, base, ex || {}, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  if (S.length) add("초보 질문형", "이번 주 공모주 청약 " + S.length + "곳,\n얼마 있으면 넣을 수 있을까요?", { ask: "청약일 · 공모가 · 최소 증거금 · 증권사만 정리했어요.", data: sLines });
  if (F.n >= 8) add("숫자 한 방형", ipoPct(F.med, 0) + ".\n최근 1년 공모주의 상장 첫날 종가 중앙값이에요.", { ask: "공모가 아래로 끝난 곳은 몇 개였을까요?", data: F.bk.map(function (b) { return b.lab + " " + b.n + "개"; }), reply: "첫날에 파시나요, 더 들고 가시나요?" });
  if (R.length) add("반전형", "첫날 올랐던 공모주,\n한 달 뒤에도 올라 있었을까요?", { ask: "최근 상장한 종목을 공모가 대비로 놓아봤어요.", data: rLines });
  return thrSafe(out);
}
