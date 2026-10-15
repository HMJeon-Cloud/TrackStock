/* ============================================================
   공모주 (v11.3) — 관심 탭 '공모주'
   ① 일정: 청약 예정·진행 중·상장 대기 (공모가 밴드/확정가 · 수요예측 경쟁률 · 확약 · 주관사)
   ② 상장 결과: 공모가 대비 상장일 시가·종가 · 1개월(20거래일) · 지금
   ③ 백테스트: '수요예측 경쟁률이 높으면 수익도 높았나' — 구간별 중앙값·승률 · 순위 상관 · 산점도
   데이터: /api/snap?ipo=1 (DART 증권신고서·투자설명서·증권발행실적보고서 원문 + 상장 후 야후 종가) — 새 함수·크론 없음
   ============================================================ */
var IPO = { doc: null, loading: null, tab: "sched", metric: "m1" };
(function () { try { var j = JSON.parse(localStorage.getItem("sm.ipo") || "null"); if (j) { IPO.tab = j.tab || IPO.tab; IPO.metric = j.metric || IPO.metric; } } catch (e) {} })();
function ipoSave() { try { localStorage.setItem("sm.ipo", JSON.stringify({ tab: IPO.tab, metric: IPO.metric })); } catch (e) {} }
var IPO_BK = [[0, 500, "500:1 미만"], [500, 1000, "500~1,000:1"], [1000, 1500, "1,000~1,500:1"], [1500, 1e9, "1,500:1 이상"]];
var IPO_MET = { c0: "상장일 종가", o0: "상장일 시가", m1: "1개월(20거래일)" };

function ipoEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function ipoPct(x, d) { return x == null || !isFinite(x) ? "-" : (x > 0 ? "+" : "") + (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function ipoWon(v) { return v == null || !isFinite(v) ? "-" : Math.round(v).toLocaleString("ko-KR") + "원"; }
function ipoRatio(v) { return v == null ? "-" : (v >= 100 ? Math.round(v).toLocaleString("ko-KR") : v.toFixed(1)) + ":1"; }
function ipoD(d) { d = String(d || ""); return d.length >= 8 ? +d.slice(4, 6) + "." + +d.slice(6, 8) : "-"; }
function ipoToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ""); }
function ipoAdd(ymd, d) { var t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) + d * 864e5; return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
function ipoPrice(x) { return x.price || x.offer || null; }
function ipoMed(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function ipoAvg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
/* 순위 상관(스피어만): 경쟁률 순서와 수익률 순서가 얼마나 같이 움직였나 (-1~+1) */
function ipoSpear(xs, ys) {
  var n = xs.length; if (n < 5) return null;
  function rank(a) { var idx = a.map(function (v, i) { return [v, i]; }).sort(function (p, q) { return p[0] - q[0]; }), r = new Array(n); for (var i = 0; i < n;) { var j = i; while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++; for (var k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
  var rx = rank(xs), ry = rank(ys), mx = ipoAvg(rx), my = ipoAvg(ry), sxy = 0, sxx = 0, syy = 0;
  for (var i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) * (rx[i] - mx); syy += (ry[i] - my) * (ry[i] - my); }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
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
function ipoBack(metric) {
  var S = ipoListed().filter(function (x) { return x.demand != null && x.ret[metric] != null; });
  var bk = IPO_BK.map(function (b) { var L = S.filter(function (x) { return x.demand >= b[0] && x.demand < b[1]; }), v = L.map(function (x) { return x.ret[metric]; }); return { lab: b[2], n: L.length, med: ipoMed(v), avg: ipoAvg(v), win: L.length ? v.filter(function (r) { return r > 0; }).length / L.length : null, best: L.slice().sort(function (a, b) { return b.ret[metric] - a.ret[metric]; })[0] || null }; });
  var rho = ipoSpear(S.map(function (x) { return x.demand; }), S.map(function (x) { return x.ret[metric]; }));
  var Lk = S.filter(function (x) { return x.lockup != null; }), rhoL = ipoSpear(Lk.map(function (x) { return x.lockup; }), Lk.map(function (x) { return x.ret[metric]; }));
  var from = S.length ? S.map(function (x) { return x.ret.listDate; }).sort()[0] : null;
  return { S: S, bk: bk, rho: rho, rhoL: rhoL, nL: Lk.length, from: from };
}
function ipoRhoTxt(r) { if (r == null) return "표본 부족"; var a = Math.abs(r); return a < 0.1 ? "거의 관계없음" : (a < 0.3 ? "약하게 " : a < 0.5 ? "어느 정도 " : "뚜렷하게 ") + (r > 0 ? "같이 움직임" : "반대로 움직임"); }

/* ============================================================ 화면 ============================================================ */
function renderIpo() {
  var box = document.getElementById("ipoBody"); if (!box) return;
  if (!IPO.doc) { box.innerHTML = '<div class="dvEmpty">공모주 기록을 불러오는 중…</div>'; ipoEnsure().then(renderIpo); return; }
  if (IPO.doc.none || !ipoItems().length) { box.innerHTML = '<div class="dvEmpty">아직 수집된 공모주가 없어요. 매일 아침 수집이 돌면 DART 증권신고서에서 청약 일정과 경쟁률을 모으고, 상장 뒤 수익률을 쌓아요.</div>'; return; }
  var h = '<div class="mkTabs ipoTabs">' + [["sched", "청약 일정"], ["res", "상장 결과"], ["back", "경쟁률 백테스트"]].map(function (t) { return '<button data-ipot="' + t[0] + '" class="' + (IPO.tab === t[0] ? "on" : "") + '">' + t[1] + '</button>'; }).join("") + '</div><div id="ipoPane"></div>';
  box.innerHTML = h;
  Array.prototype.forEach.call(box.querySelectorAll("[data-ipot]"), function (b) { b.onclick = function () { IPO.tab = b.getAttribute("data-ipot"); ipoSave(); renderIpo(); }; });
  var pane = document.getElementById("ipoPane");
  if (IPO.tab === "res") ipoResRender(pane); else if (IPO.tab === "back") ipoBackRender(pane); else ipoSchedRender(pane);
  Array.prototype.forEach.call(box.querySelectorAll("[data-ipoopen]"), function (b) { b.onclick = function () { var s = b.getAttribute("data-ipoopen"); if (typeof navTo === "function") navTo("single", "analysis"); var i = document.getElementById("searchInput"); if (i) i.value = s; if (typeof loadSymbol === "function") loadSymbol(s); }; });
}
function ipoName(x) { return x.sym ? '<button class="linkBtn" data-ipoopen="' + x.sym + '">' + ipoEsc(x.name) + '</button>' : '<b>' + ipoEsc(x.name) + '</b>'; }
function ipoKpi(l, v, s) { return '<div class="kpi"><div class="kl">' + l + '</div><div class="kv">' + v + '</div>' + (s ? '<div class="kl" style="margin-top:2px">' + s + '</div>' : '') + '</div>'; }
function ipoSchedRender(pane) {
  var L = ipoSched(), t = ipoToday();
  var now = L.filter(function (x) { return ipoStatus(x)[0] === "now"; }).length, soon = L.filter(function (x) { return ipoStatus(x)[0] === "soon"; }).length, wait = L.filter(function (x) { return ipoStatus(x)[0] === "wait"; }).length;
  var h = '<div class="kpiStrip">' + ipoKpi("청약 중", now + "<small>건</small>") + ipoKpi("청약 예정 (45일)", soon + "<small>건</small>") + ipoKpi("상장 대기", wait + "<small>건</small>") + ipoKpi("쌓인 상장 기록", ipoListed().length + "<small>건</small>", "백테스트 표본") + '</div>';
  h += L.length ? '<div class="dsList">' + L.map(function (x) {
    var st = ipoStatus(x), p = x.price ? ipoWon(x.price) + ' <small>확정</small>' : x.band ? ipoWon(x.band[0]).replace("원", "") + "~" + ipoWon(x.band[1]) + ' <small>희망</small>' : x.offer ? ipoWon(x.offer) + ' <small>예정</small>' : "-";
    var bits = [x.lead ? "주관 " + x.lead : "", x.demand != null ? "수요예측 " + ipoRatio(x.demand) : "수요예측 전", x.lockup != null ? "확약 " + x.lockup.toFixed(1) + "%" : "", x.sub != null ? "청약 " + ipoRatio(x.sub) : "", x.listPlan ? "상장 예정 " + ipoD(x.listPlan) : ""].filter(Boolean);
    return '<div class="dsRow"><div class="dsR1"><span class="dsD">' + ipoD(x.sbd[0]) + (x.sbd[1] && x.sbd[1] !== x.sbd[0] ? "~" + ipoD(x.sbd[1]) : "") + '</span>' + ipoName(x) + '<span class="dsTag ipo-' + st[0] + '">' + st[1] + '</span><b class="dsV">' + p + '</b></div><div class="dsR2"><span>' + ipoEsc(bits.join(" · ")) + '</span>' + (x.dDoc || x.first ? '<a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=' + (x.dDoc || x.first) + '" target="_blank" rel="noopener">원문 ›</a>' : '') + '</div></div>';
  }).join("") + '</div>' : '<div class="dvEmpty sm">앞으로 45일 안에 청약하는 공모주가 아직 없어요.</div>';
  h += '<details class="howto"><summary>일정 읽는 법</summary><div class="body"><ul><li>DART <b>증권신고서</b>를 낸 비상장 회사만 모았어요(스팩 제외). 청약일·공모가는 신고서 요약 정보, 경쟁률·확정가·확약은 <b>투자설명서·정정 신고서 원문</b>에서 읽었어요.</li><li><b>수요예측</b>은 기관투자자 대상이라 청약 며칠 전에 끝나요. 경쟁률·확정 공모가는 그 뒤에 채워져요.</li><li>원문 문장이 회사마다 달라 일부 숫자를 못 읽을 수 있어요. 그럴 땐 \'원문\'에서 확인해 주세요.</li></ul></div></details>';
  pane.innerHTML = h;
}
function ipoResRender(pane) {
  var L = ipoListed().slice(0, 80);
  var y = ipoListed().filter(function (x) { return x.ret.listDate >= ipoAdd(ipoToday(), -365); }), c0 = y.map(function (x) { return x.ret.c0; }).filter(function (v) { return v != null; }), m1 = y.map(function (x) { return x.ret.m1; }).filter(function (v) { return v != null; });
  var h = '<div class="kpiStrip">' + ipoKpi("최근 1년 상장", y.length + "<small>개</small>") + ipoKpi("상장일 종가 중앙값", ipoPct(ipoMed(c0))) + ipoKpi("1개월 중앙값", ipoPct(ipoMed(m1))) + ipoKpi("1개월 뒤 공모가 위", m1.length ? Math.round(m1.filter(function (v) { return v > 0; }).length / m1.length * 100) + "<small>%</small>" : "-") + '</div>';
  h += '<div class="tableWrap"><table class="dvTable ipoT"><thead><tr><th class="l">상장일 · 종목</th><th>공모가</th><th>수요예측</th><th>청약</th><th>첫날 시가</th><th>첫날 종가</th><th>1개월</th><th>지금</th></tr></thead><tbody>' + L.map(function (x) {
    var r = x.ret; function c(v) { return '<td class="' + (v > 0 ? "pos" : v < 0 ? "neg" : "") + '">' + ipoPct(v, 0) + '</td>'; }
    return '<tr><td class="l"><span class="dsD">' + ipoD(r.listDate) + '</span> ' + ipoName(x) + '</td><td>' + ipoWon(ipoPrice(x)) + '</td><td>' + ipoRatio(x.demand) + '</td><td>' + ipoRatio(x.sub) + '</td>' + c(r.o0) + c(r.c0) + c(r.m1) + c(r.last) + '</tr>';
  }).join("") + '</tbody></table></div>';
  h += '<p class="mentalNote">수익률 = 공모가 대비. 1개월은 상장 뒤 20거래일째 종가예요(아직 20일이 안 된 종목은 비어 있어요). 실제로는 배정 물량이 적고 수수료가 있어 체감 수익과 달라요.</p>';
  pane.innerHTML = h;
}
function ipoBackRender(pane) {
  var M = IPO.metric, B = ipoBack(M);
  var h = '<div class="dvBar2"><div class="pills dvPills">' + Object.keys(IPO_MET).map(function (k) { return '<button data-ipom="' + k + '" class="' + (M === k ? "active" : "") + '">' + ({ c0: "첫날 종가", o0: "첫날 시가", m1: "1개월" })[k] + '</button>'; }).join("") + '</div></div>';
  if (B.S.length < 8) { pane.innerHTML = h + '<div class="dvEmpty sm">경쟁률과 ' + IPO_MET[M] + ' 수익률이 모두 있는 종목이 ' + B.S.length + '개뿐이라 아직 비교하기 어려워요. 수집이 쌓이면 자동으로 채워져요.</div>'; ipoBindMet(pane); return; }
  var hi = B.bk[3], lo = B.bk[0];
  h += '<div class="kpiStrip">' + ipoKpi("표본", B.S.length + "<small>개</small>", (B.from ? B.from.slice(0, 4) + "." + ipoD(B.from) + " 상장부터" : "")) + ipoKpi("경쟁률과 수익 순위 상관", B.rho == null ? "-" : (B.rho > 0 ? "+" : "") + B.rho.toFixed(2), ipoRhoTxt(B.rho)) + ipoKpi(hi.lab + " 중앙값", ipoPct(hi.med), hi.n + "개") + ipoKpi(lo.lab + " 중앙값", ipoPct(lo.med), lo.n + "개") + '</div>';
  var mx = Math.max.apply(null, B.bk.map(function (b) { return Math.abs(b.med || 0); }).concat([0.01]));
  h += '<div class="mkStep"><b>1</b>수요예측 경쟁률 구간별 ' + IPO_MET[M] + ' 수익률 <small class="briefDim">중앙값 · 공모가 대비</small></div><div class="ipoBk">' + B.bk.map(function (b) {
    return '<div class="ipoBkR"><span class="ipoBkL">' + b.lab + '<small>' + b.n + '개</small></span><span class="ipoBkBar"><i class="' + ((b.med || 0) >= 0 ? "up" : "dn") + '" style="width:' + Math.round(Math.abs(b.med || 0) / mx * 100) + '%"></i></span><b class="' + ((b.med || 0) >= 0 ? "pos" : "neg") + '">' + ipoPct(b.med) + '</b><span class="ipoBkS">평균 ' + ipoPct(b.avg) + ' · 공모가 위 ' + (b.win == null ? "-" : Math.round(b.win * 100) + "%") + '</span></div>';
  }).join("") + '</div>';
  h += '<div class="mkStep"><b>2</b>종목 하나하나 <small class="briefDim">가로 = 경쟁률(로그) · 세로 = ' + IPO_MET[M] + ' 수익률</small></div>' + ipoScatter(B.S, M);
  var conc = hi.med != null && lo.med != null ? (hi.med > lo.med ? "경쟁률 " + hi.lab + " 구간의 " + IPO_MET[M] + " 수익률 중앙값은 " + ipoPct(hi.med) + "로, " + lo.lab + " 구간(" + ipoPct(lo.med) + ")보다 높았어요." : "경쟁률이 높았던 구간이 오히려 수익률이 낮거나 비슷했어요 (" + hi.lab + " " + ipoPct(hi.med) + " · " + lo.lab + " " + ipoPct(lo.med) + ").") : "";
  h += '<p class="mentalNote"><b>읽는 법</b> ' + conc + ' 순위 상관은 ' + (B.rho == null ? "-" : B.rho.toFixed(2)) + '로 "' + ipoRhoTxt(B.rho) + '"이에요(+1이면 경쟁률 순서대로 수익도 높음, 0이면 무관). 같은 구간 안에서도 결과가 크게 갈렸어요(점이 위아래로 넓게 퍼짐).' + (B.rhoL != null ? ' 의무보유 확약 비율과의 상관은 ' + B.rhoL.toFixed(2) + '(' + B.nL + '개)였어요.' : '') + '</p>';
  h += '<details class="howto"><summary>한계</summary><div class="body"><ul><li>표본이 작아요(' + B.S.length + '개). 몇 종목만 바뀌어도 숫자가 크게 움직여요.</li><li>2023년 6월부터 상장일 가격 제한이 공모가의 60~400%로 넓어져, 그 전후의 상장일 수익률은 성격이 달라요.</li><li>경쟁률이 높을수록 실제로 받는 주식 수는 적어요. 수익률이 높아도 손에 쥐는 금액은 작을 수 있어요.</li><li>스팩·상장하지 않은 공모는 뺐고, 경쟁률을 원문에서 못 읽은 종목도 빠져 있어요.</li></ul></div></details>';
  pane.innerHTML = h; ipoBindMet(pane);
}
function ipoBindMet(pane) { Array.prototype.forEach.call(pane.querySelectorAll("[data-ipom]"), function (b) { b.onclick = function () { IPO.metric = b.getAttribute("data-ipom"); ipoSave(); renderIpo(); }; }); }
/* 산점도 (SVG) — 점 하나 = 종목 하나 */
function ipoScatter(S, M) {
  var W = 640, H = 260, pl = 46, pr = 12, pt = 10, pb = 30, xs = S.map(function (x) { return Math.log10(Math.max(1, x.demand)); }), ys = S.map(function (x) { return x.ret[M]; });
  var x0 = Math.floor(Math.min.apply(null, xs) * 2) / 2, x1 = Math.ceil(Math.max.apply(null, xs) * 2) / 2 || x0 + 1, y0 = Math.min(-0.2, Math.min.apply(null, ys)), y1 = Math.max(0.2, Math.max.apply(null, ys));
  y1 = Math.min(y1, 4.5); y0 = Math.max(y0, -0.8);
  function X(v) { return pl + (v - x0) / ((x1 - x0) || 1) * (W - pl - pr); } function Y(v) { return pt + (y1 - Math.max(y0, Math.min(y1, v))) / (y1 - y0) * (H - pt - pb); }
  var g = '<svg class="ipoSc" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="경쟁률과 수익률 산점도">';
  [0.5, 1, 2].concat([y0, y1]).filter(function (v, i, a) { return a.indexOf(v) === i && v >= y0 && v <= y1; }).forEach(function (v) { g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + ipoPct(v, 0) + '</text>'; });
  g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" class="zl"/>';
  for (var v = Math.ceil(x0); v <= x1; v += 0.5) g += '<text x="' + X(v) + '" y="' + (H - 10) + '" text-anchor="middle">' + Math.round(Math.pow(10, v)).toLocaleString("ko-KR") + ':1</text>';
  S.forEach(function (x, i) { g += '<circle cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(ys[i]).toFixed(1) + '" r="4" class="' + (ys[i] >= 0 ? "u" : "d") + '"><title>' + ipoEsc(x.name) + ' · ' + ipoRatio(x.demand) + ' · ' + ipoPct(ys[i]) + '</title></circle>'; });
  return '<div class="ipoScW">' + g + '</svg></div>';
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
function ipoSrc() { return "DART 증권신고서·투자설명서·증권발행실적보고서 · 야후 파이낸스 종가 · StockMind 정리"; }
function ipoSpec(cat, src) {
  if (src === "ipoSched" && cat === "table") {
    var L = ipoSched().filter(function (x) { return ipoStatus(x)[0] !== "listed"; }).slice(0, 10); if (!L.length) return null;
    return { meta: { title: "이번에 청약하는 공모주", sub: "청약일 순 · 경쟁률은 기관 수요예측 결과 (끝난 곳만)", source: ipoSrc(), catName: "공모주" },
      spec: { cols: ["청약일", "종목", "공모가", "수요예측", "주관사"], widths: [0.17, 0.27, 0.19, 0.17, 0.2], hlCols: [3], rows: L.map(function (x) { return [ipoD(x.sbd[0]) + (x.sbd[1] && x.sbd[1] !== x.sbd[0] ? "~" + ipoD(x.sbd[1]) : ""), x.name, x.price ? ipoWon(x.price) : x.band ? Math.round(x.band[0] / 100) / 10 + "~" + Math.round(x.band[1] / 100) / 10 + "천원" : "-", x.demand != null ? ipoRatio(x.demand) : "예측 전", x.lead || "-"]; }), note: "경쟁률이 높을수록 받는 주식 수는 적어요 · 증거금은 청약 금액의 50%" } };
  }
  if (src === "ipoResult" && cat === "table") {
    var R = ipoListed().slice(0, 10); if (!R.length) return null;
    return { meta: { title: "최근 상장한 공모주 성적", sub: "공모가 대비 · 첫날 종가와 1개월(20거래일)", source: ipoSrc(), catName: "공모주" },
      spec: { cols: ["상장일", "종목", "수요예측", "첫날", "1개월"], widths: [0.15, 0.3, 0.19, 0.18, 0.18], hlCols: [4], rows: R.map(function (x) { return [ipoD(x.ret.listDate), x.name, ipoRatio(x.demand), ipoPct(x.ret.c0, 0), ipoPct(x.ret.m1, 0)]; }), note: "1개월이 '-'면 아직 20거래일이 안 된 종목" } };
  }
  if (src === "ipoBack" && cat === "table") {
    var B1 = ipoBack("c0"), B2 = ipoBack("m1"); if (B2.S.length < 8) return null;
    return { meta: { title: "경쟁률이 높으면 더 벌었을까", sub: "수요예측 경쟁률 구간별 · 공모가 대비 중앙값 · 표본 " + B2.S.length + "개", source: ipoSrc(), catName: "공모주" },
      spec: { cols: ["경쟁률", "종목 수", "첫날 종가", "1개월", "1개월 공모가 위"], widths: [0.26, 0.14, 0.2, 0.18, 0.22], hlCols: [3], rows: B2.bk.map(function (b, i) { return [b.lab, b.n + "개", ipoPct(B1.bk[i].med, 0), ipoPct(b.med, 0), b.win == null ? "-" : Math.round(b.win * 100) + "%"]; }), note: "순위 상관 " + (B2.rho == null ? "-" : B2.rho.toFixed(2)) + " (" + ipoRhoTxt(B2.rho) + ") · 같은 구간 안에서도 결과가 크게 갈렸어요" } };
  }
  return null;
}
(function () {
  if (typeof TPL_SOURCES === "undefined" || typeof tplSpec !== "function") return;
  TPL_SOURCES.table.push({ id: "ipoSched", t: "공모주 청약 일정" }, { id: "ipoResult", t: "최근 상장 공모주 성적" }, { id: "ipoBack", t: "경쟁률 구간별 수익 (백테스트)" });
  var s0 = tplSpec; tplSpec = function (cat, src, mk) { if (/^ipo/.test(src || "")) return ipoSpec(cat, src); return s0.apply(this, arguments); };
  var p0 = tplPrep; tplPrep = function (cat, mk, src) { if (/^ipo/.test(src || "")) return ipoEnsure(); return p0.apply(this, arguments); };
})();
function ipoDeckOpen() {
  var plan = [["ipoSched", "청약일정"], ["ipoResult", "상장성적"], ["ipoBack", "경쟁률백테스트"]];
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
  return [{ id: "ipo", t: "🎟️ 공모주 — " + (s.length ? "이번 주 청약 " + s.length + "곳" : "") + (s.length && l.length ? " · " : "") + (l.length ? "최근 상장 " + l.length + "곳" : ""), d: "청약 직전·상장 직후가 '경쟁률 높으면 벌까?'가 가장 많이 읽히는 때", kind: "ipo" }];
}

/* ---------- 업로드 글 (v11.0 스레드 공식) ---------- */
function thrIpo(names) {
  if (typeof thrCompose !== "function") return [];
  var B = ipoBack("m1"), B0 = ipoBack("c0"), S = ipoSched().filter(function (x) { return ipoStatus(x)[0] !== "listed"; }), R = ipoListed().slice(0, 5);
  var data = B.S.length >= 8 ? B.bk.slice().reverse().map(function (b) { return b.lab + " → 1개월 " + ipoPct(b.med, 0) + " (" + b.n + "개)"; }) : R.map(function (x) { return x.name + " 첫날 " + ipoPct(x.ret.c0, 0) + " · 경쟁률 " + ipoRatio(x.demand); });
  var LIM = ["한계도 적어둘게요.", "경쟁률이 높을수록 실제로 받는 주식은 몇 주뿐이라, 수익률이 높아도 손에 쥐는 돈은 작을 수 있어요.", "2023년 6월부터 상장 첫날 가격 제한이 바뀌어서, 그 전후 숫자는 성격이 달라요.", "표본이 " + B.S.length + "개라 몇 종목만 바뀌어도 결과가 움직입니다."];
  var base = { summary: data.concat(S.slice(0, 3).map(function (x) { return "청약 " + ipoD(x.sbd[0]) + " " + x.name + (x.demand != null ? " · 수요예측 " + ipoRatio(x.demand) : ""); })), insights: [B.rho != null ? "경쟁률과 1개월 수익률의 순위 상관은 " + B.rho.toFixed(2) + " — " + ipoRhoTxt(B.rho) + "이었어요(1이면 완전히 같은 순서)." : "", "같은 구간 안에서도 결과가 크게 갈렸어요."].filter(Boolean),
    cardList: (names || []).map(function (n) { return n.replace("_", " "); }), question: "공모주 청약, 경쟁률 보고 넣으시나요 아니면 일정마다 넣으시나요?", tags: ["우상향연구소", "공모주", "공모주청약", "IPO", "재테크"], foot: "DART 증권신고서·투자설명서 · 야후 종가 · 공모가 대비 · 투자 권유 아님",
    data: data, sort: false, thFoot: "DART 공시 · 공모가 대비 · 투자 권유 아님", limit: LIM, reply: "이 결과에서 제일 의외인 건 뭐였나요?" };
  var out = [];
  function add(label, hook, ex) { var c = thrCompose(Object.assign({}, base, ex || {}, { hook: hook })); out.push({ label: label, th: c.th, r1: c.r1, r2: c.r2, ig: c.ig }); }
  if (B.S.length >= 8) {
    var hi = B.bk[3], lo = B.bk[0];
    add("초보 질문형", "공모주 경쟁률이 높으면,\n수익도 높았을까요?", { ask: "최근 " + B.S.length + "개 공모주를 경쟁률 구간으로 나눠 봤어요.", interp: [hi.med != null && lo.med != null ? (hi.med > lo.med ? "높은 구간이 1개월 중앙값으로 더 좋았지만, 같은 구간 안에서도 크게 갈렸어요." : "경쟁률이 높다고 1개월 수익이 더 좋진 않았어요.") : ""] });
    add("숫자 한 방형", ipoPct(hi.med, 0) + ".\n수요예측 " + hi.lab + " 공모주의 1개월 수익률 중앙값이에요.", { ask: "경쟁률이 낮았던 곳은 어땠을까요?", reply: "경쟁률 몇 대 1부터 관심이 가세요?" });
  }
  var t7 = ipoToday(), S7 = S.filter(function (x) { return x.sbd[0] <= ipoAdd(t7, 7) && (x.sbd[1] || x.sbd[0]) >= t7; });
  if (S7.length) add("반전형", "이번 주 청약 " + S7.length + "곳.\n경쟁률이 제일 높은 곳이 제일 많이 올랐을까요?", { ask: "지난 공모주 숫자부터 확인해 볼게요." });
  if (!out.length && R.length) add("초보 질문형", "최근 상장한 공모주,\n첫날 얼마나 올랐을까요?", { ask: "공모가 대비로 놓아봤어요." });
  return thrSafe(out);
}
