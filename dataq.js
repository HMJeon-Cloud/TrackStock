/* ============================================================
   v12.91 데이터 한 번만 받기 — 같은 주소를 여러 화면이 따로 받지 않게 하는 공용 보관함
   · 시세 과거 파일(/api/snap?symbol=) · 종목 지표(/api/fund) · 인기 종목(/api/snap?popular) 을 화면 10여 곳이 각자 받던 것을
     주소 기준으로 한 번만 받아 30분 동안 나눠 쓴다. 동시에 같은 주소를 요청하면 한 요청을 같이 기다린다.
   · 실패(오류 응답)는 보관하지 않는다 → 다음에 다시 시도한다.
   · '다시 확인'·'아침 수집' 뒤에는 smCacheClear()로 화면들이 들고 있던 옛 값을 한꺼번에 비운다.
   ============================================================ */
var SMQ = { map: {}, hit: 0, miss: 0, max: 80 };
var SMQ_RULES = [
  [/^\/api\/snap\?symbol=/, 30 * 60e3],
  [/^\/api\/fund\?/, 30 * 60e3],
  [/^\/api\/snap\?popular=1/, 10 * 60e3]
];
(function () {
  if (typeof window === "undefined" || !window.fetch || window.__smq) return; window.__smq = 1;
  var f0 = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : null, m = (init && init.method) || "GET";
      if (!url || m !== "GET" || /[?&]fresh=/.test(url) || (init && (init.cache === "no-store" || init.headers))) return f0(input, init);
      var path = url.replace(/^https?:\/\/[^/]+/, ""), ttl = 0;
      for (var i = 0; i < SMQ_RULES.length; i++) if (SMQ_RULES[i][0].test(path)) { ttl = SMQ_RULES[i][1]; break; }
      if (!ttl) return f0(input, init);
      var e = SMQ.map[path], now = Date.now();
      if (e && now - e.at < ttl) { SMQ.hit++; return e.p.then(function (r) { return r.clone(); }); }
      SMQ.miss++;
      var p = f0(input, init).then(function (r) { if (!r.ok) delete SMQ.map[path]; return r; }, function (err) { delete SMQ.map[path]; throw err; });
      SMQ.map[path] = { at: now, p: p };
      var ks = Object.keys(SMQ.map); if (ks.length > SMQ.max) { ks.sort(function (a, b) { return SMQ.map[a].at - SMQ.map[b].at; }).slice(0, ks.length - SMQ.max).forEach(function (k) { delete SMQ.map[k]; }); }
      return p.then(function (r) { return r.clone(); });
    } catch (err) { return f0(input, init); }
  };
})();
/* 화면들이 따로 들고 있는 옛 값을 한꺼번에 비운다 (새로 수집한 뒤 · '다시 확인') */
function smCacheClear(why) {
  SMQ.map = {};
  var wipe = function (o) { if (o && typeof o === "object") Object.keys(o).forEach(function (k) { delete o[k]; }); };
  try { if (typeof DATA !== "undefined") { DATA.ready = null; DATA.recentPromise = null; DATA.recentData = null; } } catch (e) {}
  try { if (typeof nbHist !== "undefined") wipe(nbHist); } catch (e) {}
  try { if (typeof CARD_HIST !== "undefined") wipe(CARD_HIST); } catch (e) {}
  try { if (typeof RP !== "undefined" && RP.hist) wipe(RP.hist); } catch (e) {}
  try { if (typeof chState !== "undefined") { if (chState.hist) wipe(chState.hist); chState.recent = null; } } catch (e) {}
  try { if (typeof mindState !== "undefined" && mindState.hist) wipe(mindState.hist); } catch (e) {}
  try { if (typeof perState !== "undefined" && perState.hist) wipe(perState.hist); } catch (e) {}
  try { if (typeof MAC !== "undefined") { MAC.doc = null; MAC.res = null; if (MAC.px) wipe(MAC.px); } } catch (e) {}
  try { if (typeof VS !== "undefined" && VS.rows) wipe(VS.rows); } catch (e) {}
  try { if (typeof hState !== "undefined") { wipe(hState.series); hState.fx = null; } } catch (e) {}
  try { if (typeof FX_CACHE !== "undefined") wipe(FX_CACHE); } catch (e) {}
  try { if (typeof DS !== "undefined") { DS.disc = null; DS.guru = null; } } catch (e) {}
  try { if (typeof IPO !== "undefined") IPO.doc = null; } catch (e) {}
  try { if (typeof DL_UNI !== "undefined") { delete DL_UNI.us; delete DL_UNI.kr; } } catch (e) {}
  try { if (typeof BRIEF_UNI_PENDING !== "undefined") { delete BRIEF_UNI_PENDING.us; delete BRIEF_UNI_PENDING.kr; } } catch (e) {}
  try { if (typeof briefState !== "undefined") { briefState.recent = null; briefState.result = null; briefState.issues = null; } } catch (e) {}
  try { if (typeof CORE !== "undefined") { CORE.ess = null; CORE.fund = {}; } } catch (e) {}
  try { if (typeof EG !== "undefined") { EG.memo = {}; EG.coreWarm = 0; EG.coreReady = 0; } } catch (e) {}
  try { if (typeof TPL_RC !== "undefined") wipe(TPL_RC); } catch (e) {}
  try { if (typeof MK !== "undefined" && MK._cap) wipe(MK._cap); } catch (e) {}
  try { if (typeof OPS !== "undefined") OPS.Ms = null; } catch (e) {}
}

/* 원/달러 — 야후(KRW=X) 최근 종가 → 한국은행 매매기준율(ECOS) 순서로, 둘 다 없으면 null (고정값으로 대신하지 않는다) */
function smFxAny() {
  try { var r = (typeof briefState !== "undefined" && briefState.recent) || (typeof DATA !== "undefined" && DATA.recentData) || null, d = r && r.symbols && r.symbols["KRW=X"]; if (d && d.c) { for (var i = d.c.length - 1; i >= 0; i--) if (d.c[i] > 0) return d.c[i]; } } catch (e) {}
  try { if (typeof nbHist !== "undefined" && nbHist["KRW=X"] && nbHist["KRW=X"].length) return nbHist["KRW=X"][nbHist["KRW=X"].length - 1].c; } catch (e) {}
  try { var s = typeof MAC !== "undefined" && MAC.doc && MAC.doc.series && MAC.doc.series.krw, a = s && (s.d || s.rows); if (a && a.length) return +a[a.length - 1][1] || null; } catch (e) {}
  return null;
}
