"use strict";
/* ============================================================
   StockMind — 관심 종목 & 뉴스 탭
   - 관심 종목: 기기(localStorage)에 저장. 현재가·전일대비·전고점 대비를 한눈에.
   - 뉴스: 관심 종목별 기사 + 시장 뉴스(주요/해외/시황/환율/금리). 제목만 보여주고 클릭하면 원문.
   ============================================================ */

var WATCH_KEY = "stockmind.watch";
var watchState = { quotes: {}, news: {}, market: {}, filter: "", loading: false };

/* ---------- 저장소 ---------- */
function loadWatch() {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"); } catch (e) { return []; }
}
function saveWatch(list) {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
}
function isWatched(sym) { return loadWatch().some(function (x) { return x.s === sym; }); }
function toggleWatch(sym, name) {
  var list = loadWatch();
  var i = list.findIndex(function (x) { return x.s === sym; });
  if (i >= 0) list.splice(i, 1);
  else {
    if (list.length >= 20) { setStatus("관심 종목은 최대 20개까지입니다.", true); return false; }
    list.push({ s: sym, n: name || sym, t: Date.now() });
  }
  saveWatch(list);
  syncWatchBtn();
  return i < 0;
}
function syncWatchBtn() {
  var b = $("watchBtn");
  if (!b) return;
  var on = state.symbol && isWatched(state.symbol);
  b.classList.toggle("added", !!on);
  b.textContent = on ? "★" : "☆";
  b.title = !state.symbol ? "종목을 분석하면 관심 목록에 넣을 수 있습니다"
    : (on ? "관심 목록에서 빼기" : "관심 목록에 넣기") + " (" + loadWatch().length + "개)";
}

/* ---------- 시세 ---------- */
function fetchQuote(sym) {
  if (watchState.quotes[sym] && Date.now() - watchState.quotes[sym].at < 10 * 60 * 1000) {
    return Promise.resolve(watchState.quotes[sym]);
  }
  return fetch("/api/chart?symbol=" + encodeURIComponent(sym) + "&range=1y")
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var p = parseChart(j);
      var rows = p.rows;
      if (rows.length < 2) throw new Error("데이터 부족");
      var last = rows[rows.length - 1], prev = rows[rows.length - 2];
      var hi = -Infinity, lo = Infinity, s = Math.max(0, rows.length - 252);
      for (var i = s; i < rows.length; i++) { if (rows[i].h > hi) hi = rows[i].h; if (rows[i].l < lo) lo = rows[i].l; }
      var eps = drawdownEpisodes(rows, 0.05);
      var peak = -Infinity;
      for (var k = 0; k < rows.length; k++) if (rows[k].c > peak) peak = rows[k].c;
      var q = {
        at: Date.now(), name: p.meta.shortName || p.meta.longName || sym, cur: p.meta.currency || "USD",
        last: last.c, chg: last.c / prev.c - 1, hi52: hi, lo52: lo,
        vsHi: last.c / hi - 1, vsPeak: last.c / peak - 1,
        m1: (function () { var r = returnOverDays(rows, 30); return r ? r.ret : null; })(),
        y1: rows[0] ? last.c / rows[0].c - 1 : null,
        dd: eps.length ? Math.min.apply(null, eps.map(function (e) { return e.dd; })) : 0,
        date: last.t
      };
      watchState.quotes[sym] = q;
      return q;
    });
}

/* ---------- 뉴스 ---------- */
function fetchNews(params) {
  var key = JSON.stringify(params);
  var cached = watchState.news[key];
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return Promise.resolve(cached.items);
  var qs = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
  return fetch("/api/news?" + qs)
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var items = (j && j.items) || [];
      watchState.news[key] = { at: Date.now(), items: items };
      return items;
    })
    .catch(function () { return []; });
}

/* 제목에서 시장 영향 키워드를 태그로 뽑는다 */
var NEWS_TAGS = [
  ["금리", /금리|연준|Fed|FOMC|기준금리|인하|인상|한국은행|한은/i],
  ["전쟁·지정학", /전쟁|공습|미사일|이란|이스라엘|우크라|러시아|대만|북한|휴전|긴장/i],
  ["관세·무역", /관세|무역|수출|수입|제재|보복|협상/i],
  ["환율", /환율|달러|원화|엔화|위안|외환/i],
  ["유가·원자재", /유가|원유|OPEC|금값|구리|원자재|천연가스/i],
  ["실적", /실적|영업이익|매출|순이익|어닝|가이던스|컨센서스/i],
  ["반도체·AI", /반도체|HBM|AI|엔비디아|TSMC|파운드리|메모리/i],
  ["정책·정치", /정부|대통령|국회|선거|규제|법안|정책/i]
];
function tagNews(title) {
  var out = [];
  for (var i = 0; i < NEWS_TAGS.length; i++) if (NEWS_TAGS[i][1].test(title)) out.push(NEWS_TAGS[i][0]);
  return out;
}
function fmtNewsTime(s) {
  if (!s) return "";
  var m = String(s).match(/(\d{4})[.\-\/]?(\d{2})[.\-\/]?(\d{2})[ T]?(\d{2})?:?(\d{2})?/);
  if (!m) return String(s).slice(0, 16);
  return m[2] + "." + m[3] + (m[4] ? " " + m[4] + ":" + (m[5] || "00") : "");
}
function newsItemHtml(it, sym) {
  var tags = tagNews(it.title);
  return '<li class="newsItem">' +
    '<a href="' + it.url + '" target="_blank" rel="noopener">' + it.title + "</a>" +
    '<div class="newsMeta">' +
    (sym ? '<span class="newsSym">' + cmpLabel(sym) + "</span>" : "") +
    (it.press ? "<span>" + it.press + "</span>" : "") +
    (it.time ? "<span>" + fmtNewsTime(it.time) + "</span>" : "") +
    tags.map(function (t) { return '<span class="newsTag">' + t + "</span>"; }).join("") +
    "</div></li>";
}

/* ---------- 렌더링 ---------- */
function renderWatchList() {
  var list = loadWatch();
  var box = $("watchList");
  if (!list.length) {
    box.innerHTML = '<div class="mentalNote" style="margin-top:0">관심 종목이 없습니다. <b>개별 종목 분석</b>에서 종목을 조회한 뒤 ' +
      '<b>☆</b> 버튼을 누르면 여기에 쌓입니다. 최대 20개.</div>';
    $("watchNews").innerHTML = "";
    return;
  }
  var html = "<thead><tr><th>종목</th><th>현재가</th><th>전일 대비</th><th>1개월</th><th>1년</th>" +
    "<th>52주 최고 대비</th><th>1년 최대낙폭</th><th></th></tr></thead><tbody>";
  list.forEach(function (w) {
    var q = watchState.quotes[w.s];
    html += '<tr data-sym="' + w.s + '"><td style="text-align:left"><b>' + cmpLabel(w.s) + "</b><br><small style='color:var(--sub)'>" + w.s + "</small></td>";
    if (!q) {
      html += "<td colspan='6' style='color:var(--sub)'>불러오는 중...</td>";
    } else {
      var u = q.cur === "KRW" ? "원" : " " + q.cur;
      html += "<td>" + fmtPrice(q.last) + u + "<br><small style='color:var(--sub)'>" + fmtDate(q.date) + "</small></td>" +
        '<td class="' + pctCls(q.chg) + '">' + fmtPct(q.chg) + "</td>" +
        '<td class="' + pctCls(q.m1 || 0) + '">' + (q.m1 == null ? "-" : fmtPct(q.m1)) + "</td>" +
        '<td class="' + pctCls(q.y1 || 0) + '">' + (q.y1 == null ? "-" : fmtPct(q.y1)) + "</td>" +
        '<td class="' + pctCls(q.vsHi) + '">' + fmtPct(q.vsHi) + "</td>" +
        '<td class="neg">' + fmtPct(q.dd) + "</td>";
    }
    html += "<td style='white-space:nowrap'>" +
      '<button class="chip" data-open="' + w.s + '" title="분석 화면 열기">분석</button> ' +
      '<button class="chip" data-cart="' + w.s + '" title="장바구니 담기">🛒</button> ' +
      '<button class="chip" data-del="' + w.s + '" title="관심 목록에서 빼기">✕</button></td></tr>';
  });
  box.innerHTML = html + "</tbody>";

  Array.prototype.forEach.call(box.querySelectorAll("[data-open]"), function (b) {
    b.onclick = function () {
      var s = b.getAttribute("data-open");
      navTo("single", "analysis");
      $("searchInput").value = s;
      loadSymbol(s);
    };
  });
  Array.prototype.forEach.call(box.querySelectorAll("[data-cart]"), function (b) {
    b.onclick = function () {
      var s = b.getAttribute("data-cart");
      if (cmpState.cart.indexOf(s) >= 0) { setWatchStatus(cmpLabel(s) + "은(는) 이미 장바구니에 있습니다."); return; }
      if (cmpState.cart.length >= 8) { setWatchStatus("장바구니는 최대 8개까지입니다.", true); return; }
      addToCart(s);
      setWatchStatus("장바구니에 담았습니다: " + cmpLabel(s) + " (현재 " + cmpState.cart.length + "개)");
    };
  });
  Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function (b) {
    b.onclick = function () {
      toggleWatch(b.getAttribute("data-del"));
      renderWatchList();
      renderWatchNews();
    };
  });
}

function setWatchStatus(msg, isErr) {
  var el = $("watchStatus");
  el.textContent = msg || "";
  el.style.color = isErr ? "var(--up)" : "var(--sub)";
}

function loadWatchQuotes() {
  var list = loadWatch();
  if (!list.length) return Promise.resolve();
  setWatchStatus("시세 불러오는 중...");
  return Promise.all(list.map(function (w) {
    return fetchQuote(w.s).catch(function () { return null; });
  })).then(function () {
    setWatchStatus("");
    renderWatchList();
  });
}

function applyNewsFilter(items) {
  var f = watchState.filter;
  if (!f) return items;
  return items.filter(function (it) { return tagNews(it.title).indexOf(f) >= 0; });
}

function renderWatchNews() {
  var list = loadWatch();
  var box = $("watchNews");
  if (!list.length) { box.innerHTML = ""; return; }
  var html = "";
  list.forEach(function (w) {
    var key = JSON.stringify({ type: "stock", symbol: w.s, size: 6 });
    var c = watchState.news[key];
    var items = c ? applyNewsFilter(c.items) : null;
    html += '<div class="newsGroup"><div class="newsGroupTitle">' + cmpLabel(w.s) +
      (c ? ' <small style="color:var(--sub)">' + c.items.length + "건</small>" : "") + "</div>";
    if (!c) html += "<div style='font-size:12px;color:var(--sub);padding:4px 0 8px'>불러오는 중...</div>";
    else if (!items.length) html += "<div style='font-size:12px;color:var(--sub);padding:4px 0 8px'>" +
      (watchState.filter ? "이 키워드에 해당하는 기사가 없습니다." : "최근 기사가 없습니다.") + "</div>";
    else html += "<ul class='newsList'>" + items.map(function (it) { return newsItemHtml(it, null); }).join("") + "</ul>";
    html += "</div>";
  });
  box.innerHTML = html;
}

function loadWatchNews() {
  var list = loadWatch();
  if (!list.length) return Promise.resolve();
  renderWatchNews();
  return Promise.all(list.map(function (w) {
    return fetchNews({ type: "stock", symbol: w.s, size: 6 });
  })).then(renderWatchNews);
}

var MARKET_CATS = [
  { id: "main", label: "주요 뉴스", p: { type: "market", cat: "main", size: 15 } },
  { id: "world", label: "해외증시", p: { type: "market", cat: "world", size: 15 } },
  { id: "f401", label: "시황·전망", p: { type: "market", cat: "focus", sid: "401", size: 15 } },
  { id: "f429", label: "환율", p: { type: "market", cat: "focus", sid: "429", size: 12 } },
  { id: "f404", label: "채권·금리", p: { type: "market", cat: "focus", sid: "404", size: 12 } }
];
var marketCat = "main";

function renderMarketNews() {
  var cat = MARKET_CATS.filter(function (c) { return c.id === marketCat; })[0];
  var key = JSON.stringify(cat.p);
  var c = watchState.news[key];
  var box = $("marketNews");
  Array.prototype.forEach.call(document.querySelectorAll("#marketCats button"), function (b) {
    b.classList.toggle("active", b.getAttribute("data-cat") === marketCat);
  });
  if (!c) { box.innerHTML = "<div style='font-size:12px;color:var(--sub)'>불러오는 중...</div>"; return; }
  var items = applyNewsFilter(c.items);
  if (!items.length) { box.innerHTML = "<div style='font-size:12px;color:var(--sub)'>" + (watchState.filter ? "이 키워드에 해당하는 기사가 없습니다." : "기사를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.") + "</div>"; return; }
  box.innerHTML = "<ul class='newsList'>" + items.map(function (it) { return newsItemHtml(it, null); }).join("") + "</ul>";
}

function loadMarketNews() {
  var cat = MARKET_CATS.filter(function (c) { return c.id === marketCat; })[0];
  renderMarketNews();
  return fetchNews(cat.p).then(renderMarketNews);
}

function renderNewsFilters() {
  var box = $("newsFilters");
  var tags = NEWS_TAGS.map(function (t) { return t[0]; });
  box.innerHTML = '<button class="chip' + (watchState.filter ? "" : " active") + '" data-f="">전체</button>' +
    tags.map(function (t) {
      return '<button class="chip' + (watchState.filter === t ? " active" : "") + '" data-f="' + t + '">' + t + "</button>";
    }).join("");
  Array.prototype.forEach.call(box.querySelectorAll("[data-f]"), function (b) {
    b.onclick = function () {
      watchState.filter = b.getAttribute("data-f");
      renderNewsFilters();
      renderWatchNews();
      renderMarketNews();
    };
  });
}

/* 탭 진입 시 */
function renderWatchTab(force) {
  renderNewsFilters();
  renderWatchList();
  if (force) { watchState.quotes = {}; watchState.news = {}; }
  loadWatchQuotes();
  loadWatchNews();
  loadMarketNews();
}

/* ---------- 이벤트 ---------- */
$("marketCats").innerHTML = MARKET_CATS.map(function (c) {
  return '<button class="chip" data-cat="' + c.id + '">' + c.label + "</button>";
}).join("");
Array.prototype.forEach.call(document.querySelectorAll("#marketCats button"), function (b) {
  b.onclick = function () { marketCat = b.getAttribute("data-cat"); loadMarketNews(); };
});
$("watchRefresh").onclick = function () { renderWatchTab(true); };
$("watchBtn").onclick = function () {
  if (!state.symbol) { setStatus("먼저 종목을 분석해 주세요.", true); return; }
  var added = toggleWatch(state.symbol, state.meta.shortName || state.meta.longName || state.symbol);
  setStatus((added ? "관심 목록에 넣었습니다: " : "관심 목록에서 뺐습니다: ") + cmpLabel(state.symbol) +
    " (현재 " + loadWatch().length + "개)");
};
