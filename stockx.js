/* ============================================================ v16.00 종목 분석 — 종목 머리
   어느 하위 화면(차트 · 하락·회복 · 인사이트 · 기술 지표 · 기업 정보)에 있어도 '지금 무슨 종목을, 어느 가격에서 보고 있는지'가 맨 위에 보인다.
   - 이름 · 코드 · 마지막 종가 · 전일 대비 · 기준일
   - 52주 범위 안에서 지금 위치(왼쪽 끝이 최저, 오른쪽 끝이 최고)
   - 1개월 · 3개월 · 1년 수익률, 조회 기간 고점 대비, 조회 기간 최대 낙폭
   - 관심 · 담기 버튼은 기능 그대로 이 줄로 옮겼다. 기간을 바꾸면 '분석'을 다시 누르지 않아도 바로 다시 불러온다.
   숫자는 화면에 이미 불러온 가격(state.rows)에서만 계산한다. 값이 없으면 줄표로 둔다.
   ============================================================ */
var SX = {};
function sxE(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function sxPct(v) { return typeof fmtPct === "function" ? fmtPct(v) : (v == null ? "-" : (v * 100).toFixed(1) + "%"); }
function sxCls(v) { return v == null || !isFinite(v) || Math.abs(v) < 0.0005 ? "" : v > 0 ? "pos" : "neg"; }
function sxStats() {
  var R = state.rows, n = R.length, last = R[n - 1], prev = n > 1 ? R[n - 2] : null, i, D = 86400e3;
  var hi = -Infinity, lo = Infinity, t1 = last.t - 365 * D;
  for (i = n - 1; i >= 0 && R[i].t >= t1; i--) { var h = R[i].h != null ? R[i].h : R[i].c, l = R[i].l != null ? R[i].l : R[i].c; if (h > hi) hi = h; if (l != null && l < lo) lo = l; }
  var back = function (days) { var t = last.t - days * D; if (R[0].t > t + 5 * D) return null; for (var k = n - 1; k >= 0; k--) if (R[k].t <= t) return R[k].c > 0 ? last.c / R[k].c - 1 : null; return null; };
  var peak = -Infinity; for (i = 0; i < n; i++) if (R[i].c > peak) peak = R[i].c;
  var mdd = null; try { mdd = typeof trueMaxDd === "function" ? trueMaxDd(R) : null; } catch (e) {}
  return { last: last, chg: prev && prev.c > 0 ? last.c / prev.c - 1 : null, hi: isFinite(hi) ? hi : null, lo: isFinite(lo) ? lo : null, m1: back(30), m3: back(91), y1: back(365), vsPeak: peak > 0 ? last.c / peak - 1 : null, mdd: mdd, years: (last.t - R[0].t) / (365.25 * D) };
}
function sxDay(t) { var d = new Date(t), w = "일월화수목금토".charAt(d.getDay()); return (d.getMonth() + 1) + "/" + d.getDate() + "(" + w + ")"; }
function sxPaint() {
  var host = document.getElementById("tab-single"); if (!host) return;
  var el = document.getElementById("sxHead"), has = typeof state !== "undefined" && state.rows && state.rows.length > 1 && state.meta;
  host.classList.toggle("sxOn", !!has);
  if (!has) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement("section"); el.id = "sxHead"; el.className = "sxHead"; el.innerHTML = '<div class="sxMain"></div><div class="sxActs"></div>'; var st = document.getElementById("subTabs"); host.insertBefore(el, st || host.firstChild);
    var acts = el.querySelector(".sxActs"); ["watchBtn", "addCartBtn"].forEach(function (id) { var b = document.getElementById(id); if (b) acts.appendChild(b); }); }
  el.hidden = false;
  var S = sxStats(), name = state.meta.shortName || state.meta.longName || state.symbol; try { if (typeof cmpLabel === "function" && cmpLabel(state.symbol) !== state.symbol) name = cmpLabel(state.symbol); } catch (e) {}
  var pos = S.hi != null && S.lo != null && S.hi > S.lo ? Math.max(0, Math.min(1, (S.last.c - S.lo) / (S.hi - S.lo))) : null, vsHi = S.hi ? S.last.c / S.hi - 1 : null;
  var k = function (lab, v, tone, tip) { return '<div' + (tip ? ' title="' + sxE(tip) + '"' : "") + '><dt>' + lab + '</dt><dd class="' + (tone === "dd" ? (v != null && v < -0.00005 ? "neg" : "") : sxCls(v)) + '">' + sxPct(v) + '</dd></div>'; };
  var yrs = S.years >= 1 ? Math.round(S.years) + "년" : "조회 기간";
  el.querySelector(".sxMain").innerHTML =
    '<div class="sxId"><h1>' + sxE(name) + '</h1><p>' + sxE(state.symbol) + (state.displayCur ? ", " + sxE(state.displayCur) : "") + '</p></div>' +
    '<div class="sxPx"><b>' + fmtPrice(S.last.c) + '</b><em class="' + sxCls(S.chg) + '">' + sxPct(S.chg) + '</em><small>' + sxDay(S.last.t) + ' 종가</small></div>' +
    (pos == null ? "" : '<div class="sxRange" title="최근 52주 최저가와 최고가 사이에서 지금 위치"><div class="sxRgH"><span>52주 범위</span><b class="' + (vsHi != null && vsHi < -0.00005 ? "neg" : "") + '">고점 대비 ' + sxPct(vsHi) + '</b></div><div class="sxRg"><i style="left:' + (pos * 100).toFixed(1) + '%"></i></div><div class="sxRgL"><span>' + fmtPrice(S.lo) + '</span><span>' + fmtPrice(S.hi) + '</span></div></div>') +
    '<dl class="sxK">' + k("1개월", S.m1) + k("3개월", S.m3) + k("1년", S.y1) + k(yrs + " 고점 대비", S.vsPeak, "dd", "조회한 기간에서 가장 높았던 종가와 비교한 값") + k(yrs + " 최대 낙폭", S.mdd, "dd", "조회한 기간에 고점에서 가장 깊게 빠졌던 폭") + '</dl>';
}
(function () {
  if (typeof render !== "function") return;
  var r0 = render; render = function () { var r = r0.apply(this, arguments); try { sxPaint(); } catch (e) { console.warn("stock head", e); } return r; };
  if (typeof refreshSubPanes === "function") { var p0 = refreshSubPanes; refreshSubPanes = function () { var r = p0.apply(this, arguments); try { sxPaint(); } catch (e) {} return r; }; }
  var rs = document.getElementById("rangeSel");
  if (rs) rs.addEventListener("change", function () { try { if (state.symbol && state.rows && state.rows.length) { var si = document.getElementById("searchInput"); if (si) si.value = state.symbol; loadSymbol(state.symbol); } } catch (e) {} });
  var C = [
    ".sxHead{display:flex;align-items:center;gap:14px 20px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-bottom:14px}.sxHead[hidden]{display:none}",
    ".sxMain{display:flex;align-items:center;gap:14px 32px;flex-wrap:wrap;flex:1 1 auto;min-width:0}",
    ".sxId{min-width:0}.sxId h1{font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1.25;margin:0;word-break:keep-all}.sxId p{margin:1px 0 0;font-size:12.5px;color:var(--sub);font-variant-numeric:tabular-nums}",
    ".sxPx{display:grid;grid-template-columns:auto auto;align-items:baseline;gap:0 10px}.sxPx b{font-size:26px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.2}.sxPx em{font-style:normal;font-size:16px;font-weight:750;font-variant-numeric:tabular-nums}.sxPx small{grid-column:1/-1;font-size:12px;color:var(--sub)}",
    ".sxRange{flex:0 1 230px;min-width:170px}.sxRgH{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12px;color:var(--sub)}.sxRgH b{font-size:13px;font-weight:750;color:var(--txt);font-variant-numeric:tabular-nums}.sxRgH b.neg{color:var(--down)}",
    ".sxRg{position:relative;height:6px;border-radius:3px;margin:8px 0 6px;background:linear-gradient(90deg,#a9c4f1,#e8ecf2 55%,#f3c7c2)}.sxRg i{position:absolute;top:-4px;width:4px;height:14px;margin-left:-2px;border-radius:2px;background:#14161c;box-shadow:0 0 0 2px #fff}",
    ".sxRgL{display:flex;justify-content:space-between;font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums}",
    ".sxK{display:flex;gap:0;margin:0;flex:1 1 auto}.sxK div{padding:0 16px;border-left:1px solid var(--line2);min-width:0}.sxK div:first-child{border-left:0;padding-left:0}.sxK dt{font-size:12px;color:var(--sub);white-space:nowrap}.sxK dd{margin:1px 0 0;font-size:16px;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:-.02em;white-space:nowrap}",
    ".sxActs{display:flex;gap:6px;flex:none}",
    "html.sh .sxActs .cartBtn{font-size:13.5px!important;padding:8px 13px!important;border:1px solid #d6dae1;background:#fff;color:var(--txt);border-radius:9px;line-height:1.3}html.sh .sxActs .cartBtn:hover{border-color:var(--txt);background:#fff}",
    "html.sh .sxActs #watchBtn::after{content:\" 관심\";font-weight:650}html.sh .sxActs #watchBtn.added{background:var(--goldSoft);border-color:var(--goldLine);color:var(--goldInk)}html.sh .sxActs #addCartBtn.added{background:#14161c;border-color:#14161c;color:#fff}",
    "html.sh .cartBtn.added{color:#fff}",
    /* 종목을 불러온 뒤에는 검색 칸을 얇게: 빠른 선택 칩은 접는다(위쪽 검색창에서 최근 본 종목 · 관심 종목이 뜬다) */
    "html.sh #tab-single.sxOn #presets{display:none}html.sh #tab-single.sxOn #searchCard{padding:12px 14px}html.sh #tab-single.sxOn #recentRow{margin-top:8px!important}html.sh #tab-single.sxOn #status:empty{display:none}",
    "html.sh #tab-single.sxOn #chartTitle{font-size:15.5px;color:var(--txt2)}",
    "@media(min-width:1024px){html.sh #tab-single.sxOn #searchCard{display:flex;align-items:center;gap:8px 16px;flex-wrap:wrap;padding:10px 14px}html.sh #tab-single.sxOn #searchCard>.row:first-child{flex:0 1 480px;margin:0}html.sh #tab-single.sxOn #recentRow{margin:0!important;flex:0 1 auto}html.sh #tab-single.sxOn #status{flex:1 1 220px;margin:0;text-align:right}}",
    /* 휴대폰: 종목을 불러온 뒤에는 검색 줄 한 줄 + 종목 머리를 낮게 — 예전에는 차트가 화면 아래로 밀려 있었다 */
    "@media(max-width:860px){.sxHead{position:relative;padding:13px 14px 12px;gap:10px}.sxMain{gap:8px 16px}.sxId{flex:1 1 100%;padding-right:104px}.sxId h1{font-size:19px}.sxPx{grid-template-columns:auto auto 1fr;flex:1 1 100%}.sxPx b{font-size:24px}.sxPx small{grid-column:auto;justify-self:end}.sxRange{flex:1 1 100%;min-width:0}.sxRg{margin:6px 0 5px}",
    ".sxK{flex:1 1 100%;display:flex;overflow-x:auto;scrollbar-width:none;margin:2px -14px 0;padding:0 14px;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 30px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 30px),transparent)}.sxK div:last-child{padding-right:26px}.sxK::-webkit-scrollbar{display:none}.sxK div{flex:0 0 auto;padding:0 13px}.sxK div:first-child{padding-left:0}.sxK dd{font-size:15px}",
    ".sxActs{position:absolute;top:11px;right:12px;width:auto;gap:4px}html.sh .sxActs .cartBtn{padding:6px 10px!important;font-size:13px!important}html.sh .sxActs #watchBtn::after{content:\"\"}",
    "html.sh #tab-single.sxOn #searchCard{padding:10px 12px}html.sh #tab-single.sxOn #searchCard>.row:first-child{flex-wrap:nowrap;gap:6px;margin:0}html.sh #tab-single.sxOn #searchBox{flex:1 1 auto;min-width:0}html.sh #tab-single.sxOn #rangeSel{flex:0 0 78px;width:78px;padding-left:8px;padding-right:2px}html.sh #tab-single.sxOn #loadBtn{flex:0 0 auto;padding:9px 13px}html.sh #tab-single.sxOn #recentRow{display:none!important}html.sh #tab-single.sxOn #status{font-size:12px;margin-top:6px;line-height:1.45}}"
  ];
  var st = document.createElement("style"); st.id = "sxCss"; st.textContent = C.join(""); document.head.appendChild(st);
})();
