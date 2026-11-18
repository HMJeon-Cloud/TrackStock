/* v14.20 작업실 일정 캘린더 — 앱에 이미 있는 일정을 한 달 달력으로 모아 본다
   · 경제 일정(FOMC · CPI · 고용 · 금통위 · 휴장 · 만기): publish.js 의 PUB_CAL (한국 날짜)
   · 실적 발표: 실적 팔로업에 넣어 둔 종목의 다음 실적일(공지된 날 또는 지난 발표 + 91일 예상)
     미국 종목은 미국 날짜의 장 마감 뒤에 나오므로 달력에는 한국 날짜(다음 날 아침)로 올린다
   새 자료를 받지 않는다(서버 호출 없음). 작업실 맨 위에 꽂는다. */
var CALX = { ym: null, sel: null };
function cxlE(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function cxlToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function cxlAdd(d, n) { return new Date(Date.parse(d + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10); }
var CXL_KIND = { rate: ["금리", "#d9342b"], data: ["지표", "#2f6fd6"], earn: ["실적", "#b8862b"], hol: ["휴장", "#6b7280"], exp: ["만기", "#7c5cc4"] };
function cxlKind(e) { var t = String(e.t || ""); if (e.k === "hol" || /휴장/.test(t)) return "hol"; if (e.k === "earn" || /실적/.test(t)) return "earn"; if (e.k === "fomc" || e.k === "bok" || /FOMC|금통위|금리 결정|기준금리/.test(t)) return "rate"; if (e.k === "exp" || /만기/.test(t)) return "exp"; return "data"; }
function cxlShort(t) { return String(t || "").replace(/^[^\s가-힣A-Za-z0-9]+\s*/, "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim(); }
function cxlEvents() {
  var out = [], seen = {};
  if (typeof PUB_CAL !== "undefined") PUB_CAL.forEach(function (e) { if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.d)) return; out.push({ d: e.d, t: e.t, n: e.n || "", kind: cxlKind(e), est: e.sure === false, src: e.src || "" }); });
  try { if (typeof fuLoad === "function") fuLoad(); if (typeof FU !== "undefined") (FU.list || []).forEach(function (s) { var d = FU.data && FU.data[s]; if (!d) return; var nx = typeof fuNextDay === "function" ? fuNextDay(d) : null; if (!nx) return;
    var us = !/\.(KS|KQ)$|^\d{6}$/.test(s), day = us ? cxlAdd(nx.day, 1) : nx.day, nm = typeof fuNm === "function" ? fuNm(s) : s, k = day + "|" + s; if (seen[k]) return; seen[k] = 1;
    out.push({ d: day, t: (us ? "🇺🇸 " : "🇰🇷 ") + nm + " 실적 발표", n: us ? "미국 " + nx.day.slice(5) + " 장 마감 뒤 기준 → 한국 시간 아침 6~7시쯤. 장 시작 전에 발표하는 회사라면 전날 밤이에요" + (d.quarter ? " · 지금 자료는 " + d.quarter : "") : (d.quarter ? "지금 자료는 " + d.quarter : ""), kind: "earn", est: !!nx.est, sym: s }); }); } catch (e) {}
  return out.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
}
function cxlOpen() { try { return localStorage.getItem("sm.calx.open") !== "0"; } catch (e) { return true; } }
function cxlHtml() {
  var today = cxlToday(), ym = CALX.ym || today.slice(0, 7), y = +ym.slice(0, 4), m = +ym.slice(5, 7), EV = cxlEvents(), by = {}, open = cxlOpen();
  EV.forEach(function (e) { (by[e.d] = by[e.d] || []).push(e); });
  var sel = CALX.sel || (today.slice(0, 7) === ym ? today : null), first = new Date(Date.UTC(y, m - 1, 1)), dow = first.getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  var nMonth = EV.filter(function (e) { return e.d.slice(0, 7) === ym; }).length, up = EV.filter(function (e) { return e.d >= today && e.d <= cxlAdd(today, 7); });
  var h = '<div class="cxlTop"><b>일정 캘린더</b><span class="cxlNav"><button type="button" data-cxl="prev" aria-label="이전 달">‹</button><strong>' + y + '년 ' + m + '월</strong><button type="button" data-cxl="next" aria-label="다음 달">›</button></span><button type="button" class="cxlTd" data-cxl="today">오늘</button><span class="cxlSp"></span><span class="cxlLg">' + Object.keys(CXL_KIND).map(function (k) { return '<i><em style="background:' + CXL_KIND[k][1] + '"></em>' + CXL_KIND[k][0] + '</i>'; }).join("") + '</span><button type="button" class="cxlFold" data-cxl="fold">' + (open ? "접기" : "펼치기") + '</button></div>';
  if (!open) return h + '<div class="cxlSum">' + (up.length ? '앞으로 7일 <b>' + up.length + '건</b> — ' + up.slice(0, 3).map(function (e) { return e.d.slice(5).replace("-", "/") + " " + cxlE(cxlShort(e.t)); }).join(" · ") + (up.length > 3 ? " 외" : "") : "앞으로 7일 동안 등록된 일정이 없어요") + '</div>';
  h += '<div class="cxlGrid"><div class="cxlW">' + ["일", "월", "화", "수", "목", "금", "토"].map(function (w, i) { return '<span class="' + (i === 0 ? "su" : i === 6 ? "sa" : "") + '">' + w + '</span>'; }).join("") + '</div><div class="cxlD">';
  for (var i = 0; i < dow; i++) h += '<div class="cxlC off"></div>';
  for (var dd = 1; dd <= days; dd++) { var ds = ym + "-" + (dd < 10 ? "0" : "") + dd, L = by[ds] || [], wd = (dow + dd - 1) % 7, hol = L.some(function (e) { return e.kind === "hol"; });
    h += '<button type="button" class="cxlC' + (ds === today ? " td" : "") + (ds === sel ? " on" : "") + (ds < today ? " past" : "") + (L.length ? " has" : "") + '" data-cxlday="' + ds + '"><span class="dn' + (wd === 0 || hol ? " su" : wd === 6 ? " sa" : "") + '">' + dd + '</span>' +
      '<span class="ch">' + L.slice(0, 2).map(function (e) { return '<i style="--c:' + CXL_KIND[e.kind][1] + '">' + cxlE(cxlShort(e.t)) + '</i>'; }).join("") + (L.length > 2 ? '<u>+' + (L.length - 2) + '</u>' : '') + '</span>' +
      '<span class="dt">' + L.slice(0, 4).map(function (e) { return '<em style="background:' + CXL_KIND[e.kind][1] + '"></em>'; }).join("") + '</span></button>'; }
  var tail = (7 - ((dow + days) % 7)) % 7; for (var j = 0; j < tail; j++) h += '<div class="cxlC off"></div>';
  h += '</div></div>';
  var row = function (e, withDay) { var K = CXL_KIND[e.kind]; return '<li' + (withDay ? '' : ' class="nd"') + '>' + (withDay ? '<time>' + e.d.slice(5).replace("-", "/") + " " + "일월화수목금토".charAt(new Date(e.d + "T00:00:00Z").getUTCDay()) + '</time>' : '') + '<i style="background:' + K[1] + '">' + K[0] + '</i><div><b>' + cxlE(e.t) + (e.est ? ' <small class="est">예상</small>' : '') + '</b>' + (e.n ? '<p>' + cxlE(e.n) + '</p>' : '') + '</div>' + (e.sym ? '<button type="button" data-cxlsym="' + cxlE(e.sym) + '">열기</button>' : '') + '</li>'; };
  var S = sel ? (by[sel] || []) : [];
  h += '<div class="cxlList">';
  if (sel) h += '<div class="cxlLh">' + (+sel.slice(5, 7)) + '월 ' + (+sel.slice(8)) + '일 (' + "일월화수목금토".charAt(new Date(sel + "T00:00:00Z").getUTCDay()) + ')' + (sel === today ? " · 오늘" : "") + ' <small>' + (S.length ? S.length + "건" : "등록된 일정 없음") + '</small></div>' + (S.length ? '<ul>' + S.map(function (e) { return row(e, 0); }).join("") + '</ul>' : '');
  var cur = ym === today.slice(0, 7), nxt = cur ? EV.filter(function (e) { return e.d > today && e.d <= cxlAdd(today, 21) && e.d !== sel; }).slice(0, 6) : EV.filter(function (e) { return e.d.slice(0, 7) === ym && e.d !== sel; }).slice(0, 10);
  if (nxt.length) h += '<div class="cxlLh">' + (cur ? "다가오는 일정" : m + "월 일정") + ' <small>' + nxt.length + '건</small></div><ul>' + nxt.map(function (e) { return row(e, 1); }).join("") + '</ul>';
  h += '<p class="cxlNt">이번 달 ' + nMonth + '건 · 날짜는 한국 시간 기준 · "예상"은 공지 전이라 바뀔 수 있어요 · 실적일은 실적 팔로업에 넣은 종목만 나와요</p></div>';
  return h;
}
function cxlMount() {
  var box = document.getElementById("opsBody"); if (!box || !(typeof isOwner === "function" && isOwner())) return;
  var w = box.querySelector(".cxlBox"); if (!w) { w = document.createElement("div"); w.className = "cxlBox"; var hd = box.querySelector(".opsHead"); if (hd && hd.parentNode === box) box.insertBefore(w, hd.nextSibling); else box.insertBefore(w, box.firstChild); }
  w.innerHTML = cxlHtml();
  var shift = function (n) { var t = CALX.ym || cxlToday().slice(0, 7), d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 + n, 1)); CALX.ym = d.toISOString().slice(0, 7); CALX.sel = CALX.ym === cxlToday().slice(0, 7) ? cxlToday() : null; cxlMount(); };
  Array.prototype.forEach.call(w.querySelectorAll("[data-cxl]"), function (b) { b.onclick = function () { var a = b.getAttribute("data-cxl"); if (a === "prev") return shift(-1); if (a === "next") return shift(1); if (a === "today") { CALX.ym = null; CALX.sel = null; return cxlMount(); } if (a === "fold") { try { localStorage.setItem("sm.calx.open", cxlOpen() ? "0" : "1"); } catch (e) {} cxlMount(); } }; });
  Array.prototype.forEach.call(w.querySelectorAll("[data-cxlday]"), function (b) { b.onclick = function () { CALX.sel = b.getAttribute("data-cxlday"); cxlMount(); }; });
  Array.prototype.forEach.call(w.querySelectorAll("[data-cxlsym]"), function (b) { b.onclick = function () { if (typeof FU !== "undefined") FU.sel = b.getAttribute("data-cxlsym"); if (typeof switchTab === "function") switchTab("follow"); }; });
}
(function () {
  if (typeof renderOps === "function") { var r0 = renderOps; renderOps = function () { var r = r0.apply(this, arguments); try { cxlMount(); } catch (e) { console.warn("calx", e); } return r; }; }
  if (typeof document === "undefined" || document.getElementById("cxlCss")) return;
  var st = document.createElement("style"); st.id = "cxlCss"; st.textContent = [
    ".cxlBox{border:1px solid var(--line,#e6e9ef);background:var(--card,#fff);border-radius:16px;padding:14px 16px 12px;margin:0 0 18px}",
    ".cxlTop{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cxlTop>b{font-size:16px;font-weight:800;letter-spacing:-.3px}.cxlNav{display:inline-flex;align-items:center;gap:4px}.cxlNav strong{min-width:92px;text-align:center;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}.cxlTop button{font:inherit;border:1px solid var(--line,#e6e9ef);background:transparent;color:inherit;border-radius:8px;cursor:pointer;height:30px;min-width:30px;padding:0 9px;font-size:13px;font-weight:700}.cxlNav button{font-size:17px;line-height:1;padding:0}.cxlTop button:hover{background:var(--soft,#f6f7f9)}.cxlSp{flex:1}.cxlLg{display:inline-flex;gap:10px;font-size:12px;color:var(--muted,#6b7280)}.cxlLg i{font-style:normal;display:inline-flex;align-items:center;gap:4px}.cxlLg em,.cxlC .dt em{display:inline-block;width:7px;height:7px;border-radius:50%}",
    ".cxlSum{margin-top:10px;font-size:13.5px;color:var(--muted,#6b7280)}.cxlSum b{color:var(--ink,#1f2937)}",
    ".cxlGrid{margin-top:12px}.cxlW,.cxlD{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.cxlW span{text-align:center;font-size:12px;font-weight:700;color:var(--muted,#6b7280);padding:2px 0 4px}.cxlW .su,.cxlC .dn.su{color:#d9342b}.cxlW .sa,.cxlC .dn.sa{color:#2f6fd6}",
    ".cxlC{font:inherit;color:inherit;text-align:left;border:1px solid var(--line,#e6e9ef);background:transparent;border-radius:10px;min-height:76px;padding:6px 6px 5px;display:flex;flex-direction:column;gap:3px;cursor:pointer;min-width:0;overflow:hidden}.cxlC.off{border-color:transparent;cursor:default}.cxlC.past{opacity:.55}.cxlC:hover:not(.off){background:var(--soft,#f6f7f9)}.cxlC.td{border-color:#c9a24f;box-shadow:inset 0 0 0 1px #c9a24f}.cxlC.on{background:#fdfaf1;border-color:#141414;box-shadow:inset 0 0 0 1px #141414;opacity:1}.cxlC .dn{font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}.cxlC.td .dn{background:#141414;color:#e6c57a;border-radius:20px;padding:0 7px;align-self:flex-start}",
    ".cxlC .ch{display:flex;flex-direction:column;gap:2px;min-width:0}.cxlC .ch i{font-style:normal;display:block;font-size:11.5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:3px solid var(--c);padding-left:5px;color:var(--ink,#1f2937)}.cxlC .ch u{text-decoration:none;font-size:11px;color:var(--muted,#6b7280);padding-left:8px}.cxlC .dt{display:none;gap:3px;flex-wrap:wrap}",
    ".cxlList{margin-top:12px;border-top:1px solid var(--line,#e6e9ef);padding-top:4px}.cxlLh{font-size:13.5px;font-weight:800;margin:10px 0 4px}.cxlLh small{font-weight:600;color:var(--muted,#6b7280);margin-left:4px}.cxlList ul{list-style:none;margin:0;padding:0}.cxlList li{display:grid;grid-template-columns:auto 38px minmax(0,1fr) auto;gap:10px;align-items:start;padding:7px 0;border-bottom:1px dashed var(--line,#e6e9ef);font-size:13.5px}.cxlList li:last-child{border-bottom:0}.cxlList time{font-size:12.5px;color:var(--muted,#6b7280);font-variant-numeric:tabular-nums;white-space:nowrap;min-width:0;padding-top:2px}.cxlList li.nd{grid-template-columns:38px minmax(0,1fr) auto}.cxlList li>i{font-style:normal;color:#fff;font-size:11.5px;font-weight:800;border-radius:20px;text-align:center;padding:2px 0;margin-top:1px}.cxlList b{font-weight:700}.cxlList p{margin:2px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted,#6b7280)}.cxlList .est{font-weight:700;color:#b8862b;border:1px solid #e3d3a4;border-radius:20px;padding:0 6px;font-size:11px}.cxlList li button{font:inherit;font-size:12.5px;font-weight:700;border:1px solid #c9a24f;background:#fbf6ea;color:#7a5a12;border-radius:8px;padding:4px 10px;cursor:pointer}.cxlNt{margin:8px 0 0;font-size:12px;color:var(--muted,#6b7280);line-height:1.5}",
    "[data-theme=dark] .cxlC.on{background:#2a2414;border-color:#e6c57a;box-shadow:inset 0 0 0 1px #e6c57a}[data-theme=dark] .cxlList li button{background:#2a2414;color:#e9c46a;border-color:#6b5a2a}",
    "@media(max-width:640px){.cxlBox{padding:12px 10px 10px}.cxlLg{display:none}.cxlSp{display:none}.cxlFold{margin-left:auto}.cxlD,.cxlW{gap:3px}.cxlC{min-height:46px;padding:5px 2px 4px;align-items:center;border-radius:8px}.cxlC .ch{display:none}.cxlC .dt{display:flex;justify-content:center;min-height:7px}.cxlC.td .dn{align-self:center}.cxlList li{grid-template-columns:auto 36px minmax(0,1fr);gap:8px}.cxlList li button{grid-column:3;justify-self:start}.cxlList li.nd{grid-template-columns:36px minmax(0,1fr)}.cxlList li.nd button{grid-column:2}}"
  ].join("\n"); document.head.appendChild(st);
})();
