/* ============================================================ v16.10 화면 안쪽 공통 보정 — 표 · 상태 아이콘 · 한눈에 요약
   어느 화면이든 같은 규칙으로 읽히게 한다. 각 화면 코드는 건드리지 않고, 그려진 뒤에 한 번 훑어서 맞춘다.
   ① 표: 열 이름은 항상 보인다
      - 긴 표(13줄 이상)는 표 상자 안에서 스크롤하고 열 이름 줄을 위에 붙여 둔다. 짧은 표는 상자 없이 전부 보여 준다.
      - 상자가 없는 표는 화면 위쪽 바 바로 아래에 열 이름이 붙는다.
      - 왼쪽 첫 칸(종목 이름)과 열 이름이 겹칠 때 열 이름이 가려지던 문제를 고쳤다(겹침 순서).
      - 옆으로 더 있는 표는 오른쪽 가장자리에 그림자로 알려 준다.
   ② 표 안 등락 칸: 같은 열 안에서 크기에 따라 옅게 물들인다(빨강 = 올랐다, 파랑 = 내렸다). 숫자를 읽기 전에 어디가 센지 보인다.
      화면이 이미 '등락'이라고 표시한 칸(pos · neg)만 물들인다. 비중 · 확률 같은 숫자는 건드리지 않는다.
   ③ 상태 표시 글자(✓ ✗ ⚠ ⏳ ⓘ): 기기마다 모양이 달라 보이던 것을 같은 선 아이콘 한 벌로 바꿔 그린다.
      글자 자체는 그대로 남겨 둔다(복사 · 검색에 영향 없음). 입력 칸 · 프롬프트 · 내보내는 덱 안은 손대지 않는다.
   ④ 한눈에 요약: 관심 종목 · 시장 지도 · 순위 맨 위에 '지금 상태' 한 줄(이미 받아 둔 값으로만 계산, 서버 호출 없음).
      순위는 화면이 이미 내린 판정(좋은 종목이 싸진 자리 · 무난한 자리 · 기다릴 자리 …)을 그대로 세어 보여 준다. 새 기준을 만들지 않는다.
   ============================================================ */
var VX = { tm: null, n: 0 };
var VX_G = { "✓": "ok", "✔": "ok", "✅": "ok", "✗": "no", "✕": "no", "✖": "no", "❌": "no", "⚠": "warn", "⏳": "wait", "ⓘ": "info" };
var VX_RE = /[✓✔✅✗✕✖❌⚠⏳ⓘ]/, VX_SPLIT = /([✓✔✅✗✕✖❌⚠⏳ⓘ]️?)/;
var VX_SKIP = "textarea,input,option,select,pre,code,svg,canvas,script,style,.gi,[contenteditable],[data-keep-emoji],#ddDeck,.ddS,.snapBox";
function vxE(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function vxPct(v, d) { if (v == null || !isFinite(v)) return "–"; var s = (v * 100).toFixed(d == null ? 1 : d); if (+s === 0) return s.replace("-", "") + "%"; return (v > 0 ? "+" : "") + s + "%"; }

/* ---------- ③ 상태 글자 → 아이콘 ---------- */
function vxGlyphs(root) {
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], x;
  while ((x = w.nextNode())) if (VX_RE.test(x.nodeValue)) list.push(x);
  list.forEach(function (n) {
    var p = n.parentElement; if (!p || p.closest(VX_SKIP)) return;
    var parts = n.nodeValue.split(VX_SPLIT), frag = document.createDocumentFragment();
    parts.forEach(function (s) { if (!s) return; var k = s.length <= 2 ? VX_G[s.charAt(0)] : null; if (k) { var i = document.createElement("i"); i.className = "gi gi-" + k; i.textContent = s; frag.appendChild(i); } else frag.appendChild(document.createTextNode(s)); });
    p.replaceChild(frag, n);
  });
}

/* ---------- ① ② 표 ---------- */
function vxNum(td) {
  var m = /^\s*([+\-−]?\d[\d,]*\.?\d*)\s*%/.exec(td.textContent || ""); if (!m) return null;
  var v = parseFloat(m[1].replace(/,/g, "").replace("−", "-")); return isFinite(v) ? v : null;
}
function vxSign(td) {
  if (td.classList.contains("pos")) return 1; if (td.classList.contains("neg")) return -1;
  var c = td.firstElementChild; if (c && td.children.length === 1 && /^(B|SPAN|STRONG|EM)$/.test(c.tagName)) { if (c.classList.contains("pos")) return 1; if (c.classList.contains("neg")) return -1; }
  return 0;
}
function vxHeat(tb) {
  var body = tb.tBodies[0]; if (!body || body.rows.length < 3 || tb.classList.contains("noHeat")) return;
  var cols = {}, r, c, td, s, v;
  for (r = 0; r < body.rows.length; r++) { var cells = body.rows[r].cells; for (c = 1; c < cells.length; c++) { td = cells[c]; if (td.colSpan > 1 || td.tagName !== "TD") continue; s = vxSign(td); if (!s) continue; if (td.style.background || td.style.backgroundColor) continue; v = vxNum(td); if (v == null || v === 0) continue; (cols[c] = cols[c] || []).push([td, Math.abs(v), v > 0 ? 1 : -1]); } }
  Object.keys(cols).forEach(function (k) {
    var a = cols[k]; if (a.length < 3) return;
    var m = a.map(function (x) { return x[1]; }).sort(function (p, q) { return p - q; }), sc = m[Math.min(m.length - 1, Math.floor(m.length * 0.85))] || m[m.length - 1] || 1;
    a.forEach(function (x) { x[0].style.setProperty("--ht", (0.03 + 0.1 * Math.min(1, x[1] / sc)).toFixed(3)); x[0].classList.add("vxH", x[2] > 0 ? "vxUp" : "vxDn"); });
  });
}
function vxTable(tb) {
  if (tb.closest("#ddDeck,.ddS,.snapBox,.noVx")) return;
  var body = tb.tBodies[0], nR = body ? body.rows.length : tb.rows.length, sig = nR + ":" + (tb.rows[0] ? tb.rows[0].cells.length : 0) + ":" + (tb.textContent || "").length + ":" + window.innerWidth + ":" + (tb.offsetWidth > 0 ? 1 : 0);
  if (tb.__vx === sig) return; tb.__vx = sig; tb.classList.add("vxT");
  var stop = tb.closest('[id^="tab-"], .modalBox'), el = tb.parentElement, wrap = null, scroll = false, free = false;
  var ov = function (x) { var cs = getComputedStyle(x); return cs.overflowX + " " + cs.overflowY; };
  while (el && el !== stop && el !== document.body) { var o = ov(el); if (el.classList.contains("vxW") || /(auto|scroll)/.test(o)) { wrap = el; scroll = true; break; } if (/hidden|clip/.test(o)) { wrap = el; break; } el = el.parentElement; }
  if (wrap && scroll && (wrap.children.length === 1 || wrap.classList.contains("tableWrap"))) {
    wrap.classList.add("vxW"); wrap.classList.remove("vxFree");
    var over = wrap.scrollWidth > wrap.clientWidth + 6;
    /* 옆으로 넘치지 않는 표는 상자를 풀어 준다: 화면을 한 번만 스크롤하면 되고, 열 이름은 위쪽 바 아래에 붙어서 따라온다.
       옆으로 넘치는 표는 상자를 풀 수 없어서(풀면 화면 전체가 옆으로 밀린다), 긴 표만 상자 안에서 스크롤하고 열 이름을 상자 위에 붙여 둔다. */
    if (!over && !tb.closest(".modalBox")) { free = true; for (var a2 = wrap.parentElement; a2 && a2 !== stop && a2 !== document.body; a2 = a2.parentElement) if (/(auto|scroll|hidden|clip)/.test(ov(a2))) { free = false; break; } }
    wrap.classList.toggle("vxFree", free); wrap.classList.toggle("vxBox", !free && nR >= 13);
    wrap.classList.toggle("vxX", over);
    if (!wrap.__vxS) { wrap.__vxS = 1; wrap.addEventListener("scroll", function () { wrap.classList.toggle("vxEnd", wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 6); }, { passive: true }); }
  }
  tb.classList.toggle("vxPg", (free || !wrap) && !!tb.tHead && !tb.closest(".modalBox"));
  try { vxHeat(tb); } catch (e) {}
}

/* 작은 숫자 칸(1개월 -5.1% 같은 것): 부호가 붙은 퍼센트인데 색이 없으면 등락 색을 입힌다 */
function vxKpi(root) {
  Array.prototype.forEach.call(root.querySelectorAll(".badge > b, .badge > strong"), function (b) {
    if (b.__vx || b.closest("#ddDeck,.ddS,.snapBox")) return; b.__vx = 1;
    if (b.classList.contains("pos") || b.classList.contains("neg") || b.style.color || b.children.length) return;
    var m = /^\s*([+\-−])\s?\d[\d,]*\.?\d*\s?%p?\s*$/.exec(b.textContent || ""); if (!m) return;
    if (/^[+\-−]0(\.0+)?\s?%/.test((b.textContent || "").trim())) return;
    b.classList.add(m[1] === "+" ? "pos" : "neg");
  });
}

/* ---------- ④ 한눈에 요약 ---------- */
function vxSum(host, id, tiles, before) {
  if (!host) return; var el = document.getElementById(id);
  if (!tiles || !tiles.length) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = id; el.className = "vxSum"; }
  var ref = before && before.parentNode ? before : null; if (ref) { if (el.nextSibling !== ref || el.parentNode !== ref.parentNode) ref.parentNode.insertBefore(el, ref); } else if (el.parentNode !== host) host.insertBefore(el, host.firstChild);
  var h = tiles.map(function (t) { return '<div class="vxK' + (t.wide ? " wide" : "") + '"' + (t.sym ? ' data-shsym="' + vxE(t.sym) + '" role="button" tabindex="0"' : "") + '><span>' + t.l + '</span><b class="' + (t.c || "") + '">' + t.v + '</b>' + (t.bar ? '<i class="vxAd"><u style="flex:' + t.bar[0] + '"></u><s style="flex:' + t.bar[1] + '"></s></i>' : "") + (t.s ? '<small>' + t.s + '</small>' : "") + '</div>'; }).join("");
  if (el.__h !== h) { el.__h = h; el.innerHTML = h; }
}
function vxWatchSum() {
  var host = document.getElementById("wp-list"); if (!host || typeof loadWatch !== "function") return;
  var wl = loadWatch(), q = (typeof watchState !== "undefined" && watchState.quotes) || {}, rows = wl.map(function (w) { var k = q[w.s]; return k && k.last != null ? { s: w.s, chg: k.chg, vsHi: k.vsHi } : null; }).filter(Boolean);
  var tw = host.querySelector(".tableWrap") || document.getElementById("watchTable");
  if (rows.length < 2) return vxSum(host, "vxWatch", null);
  var up = 0, dn = 0, near = 0, deep = 0, worst = null, best = null;
  rows.forEach(function (r) { if (r.chg > 0.00005) up++; else if (r.chg < -0.00005) dn++; if (r.vsHi != null) { if (r.vsHi >= -0.05) near++; if (r.vsHi <= -0.2) deep++; if (!worst || r.vsHi < worst.vsHi) worst = r; } if (r.chg != null && (!best || Math.abs(r.chg) > Math.abs(best.chg))) best = r; });
  var nm = function (s) { return vxE(typeof cmpLabel === "function" ? cmpLabel(s) : s); };
  vxSum(host, "vxWatch", [
    { l: "오늘 오른 종목", v: up + " <em>/ " + rows.length + "</em>", c: up > dn ? "pos" : up < dn ? "neg" : "", bar: [up, dn], s: "내린 종목 " + dn + "개" },
    { l: "고점 부근", v: near + "개", s: "52주 최고가에서 -5% 안" },
    { l: "-20% 아래", v: deep + "개", c: deep ? "neg" : "", s: "깊게 내려와 있는 종목" },
    worst ? { l: "가장 깊은 종목", v: nm(worst.s), s: "고점 대비 " + vxPct(worst.vsHi), sym: worst.s, wide: 1 } : null,
    best && best.chg ? { l: "오늘 가장 크게 움직인 종목", v: nm(best.s), s: "전일 대비 " + vxPct(best.chg), sym: best.s, wide: 1 } : null
  ].filter(Boolean), tw && tw.closest ? (tw.closest(".tableWrap") || tw) : null);
}
function vxMapSum() {
  var host = document.getElementById("wp-map"); if (!host || typeof mapState === "undefined" || !mapState.rows) return;
  var list = mapState.rows.filter(function (r) { return mapState.filter === "all" || r.grp === mapState.filter; }), n = list.length;
  var box = document.getElementById("marketMap"), before = box ? (box.closest(".tableWrap") || box) : null;
  if (n < 5) return vxSum(host, "vxMap", null);
  var hv = list.filter(function (r) { return r.vsHi != null; }), near = 0, deep = 0, os = 0, ob = 0, vol = 0, up1 = 0, n1 = 0;
  hv.forEach(function (r) { if (r.vsHi >= -0.05) near++; if (r.vsHi <= -0.2) deep++; });
  list.forEach(function (r) { if (r.rsi != null) { if (r.rsi <= 30) os++; else if (r.rsi >= 70) ob++; } if (r.volX >= 2) vol++; if (r.m1 != null) { n1++; if (r.m1 > 0) up1++; } });
  var med = hv.map(function (r) { return r.vsHi; }).sort(function (a, b) { return a - b; })[Math.floor(hv.length / 2)];
  vxSum(host, "vxMap", [
    { l: "고점 대비 가운데 값", v: vxPct(med), c: med < -0.00005 ? "neg" : "", s: n + "개 종목 기준" },
    { l: "고점 부근", v: hv.length ? Math.round(near / hv.length * 100) + "%" : "–", s: near + "개, -5% 안" },
    { l: "-20% 아래", v: hv.length ? Math.round(deep / hv.length * 100) + "%" : "–", c: deep ? "neg" : "", s: deep + "개" },
    { l: "한 달 새 오른 종목", v: n1 ? Math.round(up1 / n1 * 100) + "%" : "–", c: up1 * 2 > n1 ? "pos" : up1 * 2 < n1 ? "neg" : "", bar: [up1, n1 - up1], s: up1 + " / " + n1 },
    { l: "과매도 · 과열", v: os + " · " + ob, s: "RSI 30 아래 · 70 위" },
    { l: "거래량 급증", v: vol + "개", s: "최근 5일이 평소의 2배 이상" }
  ], before);
}

function vxRankSum() {
  var host = document.getElementById("rankBody"); if (!host || typeof rkAll !== "function") return;
  var all = []; try { all = rkAll().filter(function (r) { return !r.lev; }); } catch (e) { all = []; }
  var ref = host.querySelector(".rkHow");
  if (all.length < 5 || !ref) return vxSum(host, "vxRank", null);
  var cnt = {}, first = {};
  all.forEach(function (r) { var k = typeof r.v === "string" ? r.v : (r.v && r.v[0]); if (!k) return; cnt[k] = (cnt[k] || 0) + 1; (first[k] = first[k] || []).length < 2 && first[k].push(r.n || r.s); });
  var tile = function (k, cls) { var n = cnt[k] || 0; return { l: k, v: n + "개", c: n ? cls : "", s: n ? vxE(first[k].join(", ")) + (n > first[k].length ? " 외 " + (n - first[k].length) + "개" : "") : "지금은 없어요" }; };
  var top = all[0], R = typeof rkLoad === "function" ? rkLoad() : null;
  vxSum(host, "vxRank", [
    tile("좋은 종목이 싸진 자리", "gold"), tile("좋은 종목 · 무난한 자리", ""), tile("좋은 종목 · 기다릴 자리", ""), tile("싸 보이지만 종목 점수가 낮음", "warnT"),
    { l: "종목 점수 1위", v: vxE(top.n || top.s), s: "종목 점수 " + Math.round(top.t) + "점" + (top.tm != null ? ", 타이밍 " + Math.round(top.tm) + "점" : "") },
    { l: "계산한 종목", v: all.length + "개", s: (R && R.day ? R.day + " 계산" : "") + ", 레버리지 제외" }
  ], ref);
}

/* ---------- ⑤ 긴 화면: 목차 · 순서 · 접기 (v16.20) ----------
   구루 종합 · 실적 허브처럼 한 화면이 길 때: 위쪽 바 아래에 칸 이름 줄을 붙여 두고 누르면 그 칸으로 간다. 지금 보고 있는 칸이 표시된다.
   구루 종합은 순서를 '지금 상태 → 이번 분기에 한 일 → 사람 → 쓰는 법'으로 바꾸고, 자주 바뀌지 않는 참고 칸 두 개는 접어 둔다. 내용 · 계산은 그대로. */
var VX_TOC = [[/지금 큰돈/, "국면"], [/확신이 실린/, "산 것, 판 것"], [/함께 움직인/, "함께 움직임"], [/함께 들고/, "함께 보유"], [/\d+명 한눈에/, "인물"], [/따라갈 수/, "따라가기"], [/이렇게 쓴다/, "쓰는 법"], [/AI 종합/, "AI 해석"],
  [/우리의 결론/, "결론"], [/핵심 데이터/, "핵심 데이터"], [/품질 점검/, "품질 점검"], [/인사이트/, "인사이트"], [/리뷰/, "리뷰"], [/밸류 위치/, "밸류"], [/KPI/, "KPI"], [/숫자로 보는/, "숫자"], [/리스크/, "리스크"], [/분기별 추이/, "추이"], [/실적과 밸류/, "실적 표"], [/시나리오/, "시나리오"], [/Q&A/, "Q&A"], [/거장/, "거장"], [/우리 앱 데이터/, "앱 데이터"], [/누락/, "누락 점검"]];
function vxTocLabel(t) {
  t = String(t || "").replace(/\s+/g, " ").trim(); for (var i = 0; i < VX_TOC.length; i++) if (VX_TOC[i][0].test(t)) return VX_TOC[i][1];
  t = t.split(/ — | · |\(/)[0].trim(); if (t.length <= 9) return t; var w = t.split(" "), o = ""; for (var k = 0; k < w.length; k++) { if ((o + " " + w[k]).trim().length > 9) break; o = (o + " " + w[k]).trim(); } return o || t.slice(0, 9);
}
function vxHeadText(sec) { var h = sec.querySelector(":scope > header h3, :scope > .egH, :scope > summary b, :scope > h3, :scope > h4"); if (!h) return ""; for (var n = h.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return n.nodeValue.trim(); return (h.textContent || "").trim(); }
function vxToc(host, secs, id) {
  var old = document.getElementById(id); if (old) old.remove();
  secs = secs.filter(function (x) { return x && x.offsetParent !== null && vxHeadText(x); }); host.classList.toggle("vxHasToc", secs.length >= 4); if (secs.length < 4) { if (VX.toc && VX.toc.id === id) VX.toc = null; return; }
  var nav = document.createElement("nav"); nav.id = id; nav.className = "vxToc"; nav.setAttribute("aria-label", "이 화면의 칸으로 바로 가기");
  nav.innerHTML = secs.map(function (x, i) { x.classList.add("vxSec"); return '<button type="button" data-i="' + i + '">' + vxE(vxTocLabel(vxHeadText(x))) + '</button>'; }).join("");
  secs[0].parentNode.insertBefore(nav, secs[0]);
  nav.onclick = function (e) { var b = e.target.closest ? e.target.closest("button[data-i]") : null; if (!b) return; var x = secs[+b.getAttribute("data-i")]; if (!x) return; if (x.classList.contains("vxFold")) vxFoldSet(x, true); var T = VX.toc; if (T) { T.pin = +b.getAttribute("data-i"); T.pinY = null; clearTimeout(T.pt); T.pt = setTimeout(function () { T.pinY = window.scrollY; }, 900); } try { x.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (er) { x.scrollIntoView(); } vxTocMark(); };
  VX.toc = { id: id, nav: nav, secs: secs }; vxTocMark();
}
function vxTocMark() {
  var T = VX.toc; if (!T || !T.nav.isConnected || T.nav.offsetParent === null) return;
  var line = T.nav.getBoundingClientRect().bottom + 14, at = 0; T.secs.forEach(function (x, i) { if (x.isConnected && x.getBoundingClientRect().top <= line) at = i; });
  /* 방금 누른 칸은 그 칸으로 표시한다(화면 맨 아래 칸은 더 내려갈 수 없어 위치만으로는 앞 칸으로 잡힌다). 직접 스크롤하면 다시 위치로 판단한다 */
  if (T.pin != null) { if (T.pinY == null || Math.abs(window.scrollY - T.pinY) < 40) at = T.pin; else T.pin = null; }
  Array.prototype.forEach.call(T.nav.children, function (b, i) { var on = i === at; if (b.classList.contains("on") !== on) { b.classList.toggle("on", on); if (on && T.nav.scrollWidth > T.nav.clientWidth) T.nav.scrollLeft = Math.max(0, b.offsetLeft - T.nav.clientWidth / 2 + b.offsetWidth / 2); } });
}
function vxFoldSet(sec, open) { sec.classList.toggle("vxFold", !open); var b = sec.querySelector(":scope > header .vxFoldB"); if (b) { b.textContent = open ? "접기" : "펼치기"; b.setAttribute("aria-expanded", open ? "true" : "false"); } try { var o = JSON.parse(localStorage.getItem("sm.vx.open") || "{}"); o[sec.getAttribute("data-vxk")] = open ? 1 : 0; localStorage.setItem("sm.vx.open", JSON.stringify(o)); } catch (e) {} }
function vxGuru() {
  var pane = document.querySelector("#tab-watch .gyPane"); if (!pane || typeof GY === "undefined" || GY.tab !== "sum") return;
  var secs = Array.prototype.slice.call(pane.querySelectorAll(":scope > section.gySec")); if (secs.length < 4) return;
  var ORD = [/지금 큰돈/, /확신이 실린/, /함께 움직인/, /함께 들고/, /AI 종합/, /\d+명 한눈에/, /따라갈 수/, /이렇게 쓴다/], FOLD = /따라갈 수|이렇게 쓴다/, open = {}; try { open = JSON.parse(localStorage.getItem("sm.vx.open") || "{}"); } catch (e) {}
  var rank = function (x) { var t = vxHeadText(x); for (var i = 0; i < ORD.length; i++) if (ORD[i].test(t)) return i; return 5.5; };
  var sorted = secs.map(function (x, i) { return [x, rank(x), i]; }).sort(function (a, b) { return a[1] - b[1] || a[2] - b[2]; }).map(function (x) { return x[0]; });
  var tail = secs[secs.length - 1].nextSibling; sorted.forEach(function (x) { pane.insertBefore(x, tail); });
  sorted.forEach(function (x, i) { x.classList.toggle("gyFirst", i === 0); var t = vxHeadText(x); if (!FOLD.test(t)) return; var k = "guru:" + vxTocLabel(t), hd = x.querySelector(":scope > header"); x.setAttribute("data-vxk", k);
    if (hd && !hd.querySelector(".vxFoldB")) { var b = document.createElement("button"); b.type = "button"; b.className = "vxFoldB"; hd.appendChild(b); b.onclick = function () { vxFoldSet(x, x.classList.contains("vxFold")); vxQueue(); }; }
    vxFoldSet(x, !!open[k]); });
  vxToc(pane, sorted, "vxTocGuru");
}
function vxFollow() {
  var host = document.getElementById("followBody"); if (!host || typeof FU === "undefined") return;
  if (!FU.sel) { var o = document.getElementById("vxTocFu"); if (o) o.remove(); host.classList.remove("vxHasToc"); return; }
  vxToc(host, Array.prototype.slice.call(host.querySelectorAll(":scope > .egBox.fuSec, :scope > details.egBox.fuSec")), "vxTocFu");
}

/* ---------- 돌리기 ---------- */
function vxRun() {
  VX.tm = null;
  var roots = Array.prototype.slice.call(document.querySelectorAll('[id^="tab-"]:not(.hidden), .modalWrap:not(.hidden) .modalBox, #clDrawer:not([hidden]), #smToasts'));
  roots.forEach(function (r) { try { vxGlyphs(r); } catch (e) {} if (r.id === "smToasts") return; try { vxKpi(r); } catch (e) {} Array.prototype.forEach.call(r.querySelectorAll("table"), function (t) { try { vxTable(t); } catch (e) {} }); });
}
function vxQueue() { if (!VX.tm) VX.tm = setTimeout(vxRun, 90); }
(function () {
  if (typeof document === "undefined") return;
  function start() {
    try { new MutationObserver(vxQueue).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
    window.addEventListener("resize", function () { clearTimeout(VX.rt); VX.rt = setTimeout(vxRun, 220); });
    document.addEventListener("click", vxQueue, true);   // 접힌 칸 · 하위 탭을 열면 그 안의 표도 다시 맞춘다
    vxQueue();
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  if (typeof renderWatchList === "function") { var w0 = renderWatchList; renderWatchList = function () { var r = w0.apply(this, arguments); try { vxWatchSum(); } catch (e) {} return r; }; }
  if (typeof gyRender === "function") { var g0 = gyRender; gyRender = function () { var r = g0.apply(this, arguments); try { vxGuru(); } catch (e) { console.warn("vx guru", e); } return r; };
    /* 구루 화면은 renderGuru 이름으로도 불린다(예전 함수를 그대로 가리키고 있다) → 그쪽도 같이 바꿔 둔다 */
    if (typeof renderGuru === "function") { if (renderGuru === g0) renderGuru = gyRender; else { var rg0 = renderGuru; renderGuru = function () { var r = rg0.apply(this, arguments); try { vxGuru(); } catch (e) {} return r; }; } } }
  if (typeof renderFollow === "function") { var f0 = renderFollow; renderFollow = function () { var r = f0.apply(this, arguments); try { vxFollow(); } catch (e) { console.warn("vx follow", e); } return r; }; }
  var sc = false; window.addEventListener("scroll", function () { if (sc) return; sc = true; requestAnimationFrame(function () { sc = false; try { vxTocMark(); } catch (e) {} }); }, { passive: true });
  if (typeof renderRank === "function") { var k0 = renderRank; renderRank = function () { var r = k0.apply(this, arguments); try { vxRankSum(); } catch (e) {} return r; }; }
  if (typeof renderMarketMap === "function") { var m0 = renderMarketMap; renderMarketMap = function () { var r = m0.apply(this, arguments); try { vxMapSum(); } catch (e) {} return r; }; }
  document.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("vxK") && e.target.getAttribute("data-shsym")) { e.preventDefault(); e.target.click(); } });

  var ic = function (d) { return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E" + d + "%3C/svg%3E\")"; };
  var T = 'html.sh [id^="tab-"] ', C = [
    /* 상태 아이콘 */
    ".gi{display:inline-block;width:1.05em;height:1.05em;vertical-align:-.16em;font-style:normal;font-weight:400;overflow:hidden;text-indent:-9em;white-space:nowrap;color:inherit;background:currentColor;-webkit-mask:var(--gi) center/contain no-repeat;mask:var(--gi) center/contain no-repeat;flex:none}",
    ".gi-ok{--gi:" + ic("%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E") + "}",
    ".gi-no{--gi:" + ic("%3Cpath d='M6.5 6.5l11 11M17.5 6.5l-11 11'/%3E") + "}",
    ".gi-warn{--gi:" + ic("%3Cpath d='M12 4.2L2.8 19.8h18.4z' stroke-width='2.2'/%3E%3Cpath d='M12 10.3v4.2M12 17.2v.1' stroke-width='2.4'/%3E") + "}",
    ".gi-wait{--gi:" + ic("%3Ccircle cx='12' cy='12' r='8.6' stroke-width='2.2'/%3E%3Cpath d='M12 7.4V12l3.2 2' stroke-width='2.2'/%3E") + "}",
    ".gi-info{--gi:" + ic("%3Ccircle cx='12' cy='12' r='8.6' stroke-width='2.2'/%3E%3Cpath d='M12 11v5.2M12 7.7v.1' stroke-width='2.4'/%3E") + "}",
    /* 표 */
    "html.sh .vxW.tableWrap{max-height:none}html.sh .vxW.vxBox{max-height:min(72vh,620px);overflow:auto;overscroll-behavior:auto}@media(min-width:1024px){html.sh .vxW.vxBox{max-height:min(76vh,820px)}}",
    "html.sh .vxW.vxFree{overflow:visible!important;max-height:none!important;-webkit-mask-image:none!important;mask-image:none!important}",
    "html.sh table.vxT thead th{z-index:3}html.sh table.vxT thead th:first-child{z-index:5}html.sh table.vxPg thead th{top:var(--shStick);box-shadow:0 1px 0 var(--line)}",
    "html.sh table.vxT tbody th{top:auto}",
    "html.sh .vxW.vxX:not(.vxEnd){-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 30px),rgba(0,0,0,.18));mask-image:linear-gradient(90deg,#000 calc(100% - 30px),rgba(0,0,0,.18))}",
    "@media(max-width:700px){html.sh .vxW table.vxT :is(td,th):first-child{position:sticky;left:0;z-index:2;background:#fff}html.sh .vxW table.vxT thead th:first-child{z-index:5}html.sh .vxW.vxX table.vxT :is(td,th):first-child{box-shadow:1px 0 0 var(--line)}}",
    "html.sh td.vxH.vxUp{background-color:rgb(217 52 43 / var(--ht,.06))}html.sh td.vxH.vxDn{background-color:rgb(47 111 214 / var(--ht,.06))}",
    /* 긴 화면 목차 · 접기 */
    ".vxToc{position:sticky;top:var(--shStick);z-index:6;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;background:#fff;padding:8px 0;margin:4px 0 12px;border-bottom:1px solid var(--line2)}.vxToc::-webkit-scrollbar{display:none}",
    "html.sh .vxToc button{flex:none;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:650;color:var(--txt2);cursor:pointer;white-space:nowrap;line-height:1.4}html.sh .vxToc button:hover{border-color:var(--txt);color:var(--txt);background:#fff}html.sh .vxToc button.on{background:var(--txt);border-color:var(--txt);color:#fff}",
    ".vxSec{scroll-margin-top:calc(var(--shStick) + 62px)}html.sh .vxHasToc table.vxPg thead th{top:calc(var(--shStick) + 49px)}",
    ".gySec>header{position:relative}html.sh .vxFoldB{position:absolute;right:0;top:0;border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:650;color:var(--txt2);cursor:pointer}html.sh .vxFoldB:hover{border-color:var(--txt);color:var(--txt);background:#fff}.gySec.vxFold>:not(header){display:none}.gySec.vxFold{padding:12px 14px;border:1px dashed #d6dae1;border-radius:12px}.gySec.vxFold>header{margin:0;padding-right:86px}.gySec:not(.vxFold)>header:has(.vxFoldB){padding-right:70px}",
    /* 한눈에 요약 */
    ".vxSum{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px;margin:4px 0 14px}",
    ".vxK{min-width:0;background:var(--soft);border:1px solid var(--line2);border-radius:10px;padding:9px 12px 10px}.vxK.wide{grid-column:span 1}.vxK[data-shsym]{cursor:pointer}.vxK[data-shsym]:hover{border-color:var(--txt);background:#fff}",
    ".vxK span{display:block;font-size:12px;color:var(--sub);white-space:nowrap}.vxK b{display:block;font-size:18px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.35;word-break:keep-all}.vxK b em{font-style:normal;font-size:13px;font-weight:600;color:var(--sub)}.vxK small{display:block;font-size:12px;color:var(--sub);font-variant-numeric:tabular-nums;line-height:1.4;word-break:keep-all}",
    ".vxK b.gold{color:var(--goldInk)}.vxK b.warnT{color:var(--warn)}#vxRank{grid-template-columns:repeat(auto-fit,minmax(168px,1fr));margin:0 0 12px}#vxRank .vxK span{white-space:normal;word-break:keep-all;line-height:1.35}#vxRank .vxK b{font-size:17px}",
    ".vxAd{display:flex;height:4px;border-radius:2px;overflow:hidden;gap:1px;margin:3px 0 4px;background:var(--card2)}.vxAd u,.vxAd s{display:block;text-decoration:none}.vxAd u{background:var(--up)}.vxAd s{background:var(--down)}",
    "@media(max-width:700px){.vxSum{display:flex;overflow-x:auto;scrollbar-width:none;margin:4px -14px 12px;padding:0 14px;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 26px),transparent)}.vxSum::-webkit-scrollbar{display:none}.vxK{flex:0 0 auto;min-width:124px;max-width:62vw}#vxRank{margin:0 -14px 12px}#vxRank .vxK{min-width:158px;max-width:70vw}.vxK:last-child{margin-right:18px}.vxK b{font-size:17px}}",
    /* 매크로 '조건별 한눈에' */
    "html.sh .mcOnLine{font-size:13px;color:var(--sub);margin:0 0 8px;line-height:1.5}html.sh .mcOnLine b{color:var(--goldInk)}",
    "html.sh .mcOv td.mcV{text-align:right;vertical-align:top;min-width:74px}html.sh .mcOv thead th{white-space:normal;word-break:keep-all;line-height:1.3}html.sh .mcOv td.l{white-space:normal}@media(max-width:700px){html.sh .mcOv td.l{max-width:32vw}html.sh .mcOv td.mcV{min-width:66px}html.sh .mcOv td.mcV .vxAd{width:48px}}html.sh .mcOv td.mcV b{display:block;font-size:15px;font-weight:800;line-height:1.3}html.sh .mcOv td.mcV .vxAd{width:60px;margin:4px 0 3px auto}html.sh .mcOv td.mcV small{display:block;font-size:11.5px!important;color:var(--sub);font-weight:500;line-height:1.3}",
    "html.sh .mcOv tr.macOn td:first-child{border-left:3px solid var(--gold)}html.sh .mcOv td:first-child{border-left:3px solid transparent}html.sh .mcOv .linkBtn{white-space:normal;text-align:left;word-break:keep-all}",
    "html.sh .mcNow{display:inline-block;margin:2px 0 0 6px;font-size:11px;font-weight:800;color:var(--goldInk);background:var(--goldSoft);border:1px solid var(--goldLine);border-radius:999px;padding:0 7px;line-height:18px;white-space:nowrap;vertical-align:1px}"
  ];
  var st = document.createElement("style"); st.id = "vxCss"; st.textContent = C.join(""); document.head.appendChild(st);
})();
