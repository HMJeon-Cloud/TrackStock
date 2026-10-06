// /api/cron-snapshot — 매일 아침 자동 실행 (vercel.json: 한국시간 07:30·08:30)
//
// 저장소는 Upstash Redis 하나만 쓴다 (v5.5부터 Vercel Blob 제거).
//   Blob은 무료 쓰기 한도가 월 2,000회뿐이라 한 번 넘기면 저장소 전체가 정지됐다.
//   Redis는 월 50만 명령·256MB·요청 10MB라 이 앱 규모(하루 약 30명령, 약 50MB)에 여유가 크다.
//
//   ① 과거 전체(sm:chart:SYM) : 종목을 며칠에 걸쳐 순환 갱신 → 실행당 40개
//   ② 최근 구간(sm:recent)    : 전 종목의 최근 90일을 한 값에 → 실행당 1개
//   ③ 목록(sm:manifest)       : 실행당 1개
//   값은 전부 gzip+base64. 읽기는 /api/snap 이 풀어서 주고 CDN이 캐시한다.
//
// 클라이언트가 ①+②를 합쳐 쓰므로 ①이 며칠 지나도 화면 데이터는 항상 최신이다. 실행당 명령 ≈ 43회, 하루 2회 → 월 약 2,600회.
import { loadTickerPairs } from "./_tickers.js";
import { redisConf, redisCmd, setJsonGz, getJsonGzText, KEY, kst } from "./_redis.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CONCURRENCY = 6;
const TIME_BUDGET_MS = 52000;     // 함수 최대 60초 안에서 저장까지 끝나도록 여유를 둔다
const RECENT_BUDGET_MS = 32000;   // ① 최근 구간(가장 중요)에 먼저 쓰는 시간
const FETCH_TIMEOUT_MS = 8000;    // 야후 한 건이 멈춰 있어도 8초면 포기
const HISTORY_PER_RUN = 20;       // 남은 시간에 과거 전체를 받을 종목 수 (하루 2회 → 약 6일이면 전 종목 한 바퀴)
const RECENT_DAYS = 400;      // recent.json이 담는 최근 일수 (v8.9: 90→400 — 200일선·52주 신고/신저가를 자체 데이터로 계산하고, 1년치로 오류를 검증)
const RETRY_BAD = 1;              // 검증에 걸린 종목은 한 번 더 받아 본다

/* 받은 일봉이 믿을 만한지 — 1년치로 검증 (v8.9)
   frozen: 최근 5개 종가가 완전히 같음(거래 정지·멈춘 시세) / spike: 마지막 3일 중 하루가 40%(코인 60%) 넘게 움직였는데 다음 날 되돌아옴(액면분할·오류)
   scale: 마지막 종가가 최근 1년 중앙값의 1/4 미만 또는 4배 초과(단위 오류) / gap: 마지막 날짜가 7일 넘게 오래됨(상장폐지·심볼 변경) */
function validateSeries(sym, s) {
  const c = s.c, t = s.t, n = c.length, flags = [];
  if (n < 30) return ["short"];
  const coin = /-USD$/.test(sym), lim = coin ? 0.6 : 0.4;
  if (!coin && n >= 5 && c.slice(-5).every((x) => x === c[n - 1])) flags.push("frozen");
  for (let i = Math.max(1, n - 3); i < n; i++) {
    const r = c[i] / c[i - 1] - 1;
    if (Math.abs(r) > lim) { const back = i + 1 < n ? c[i + 1] / c[i] - 1 : 0; flags.push(Math.sign(back) === -Math.sign(r) && Math.abs(back) > lim / 2 ? "spike" : "jump"); }
  }
  const sorted = c.slice(-250).slice().sort((x, y) => x - y), med = sorted[Math.floor(sorted.length / 2)];
  if (med > 0 && (c[n - 1] < med / 4 || c[n - 1] > med * 4)) flags.push("scale");
  if (Date.now() / 1000 - t[n - 1] > 7 * 86400) flags.push("gap");
  return flags;
}

async function loadSymbols(origin) {
  const { pairs, source } = await loadTickerPairs(origin);
  return { list: Array.from(new Set(pairs.map((p) => p[0]))), source };
}

/* Yahoo 일봉. range=max 는 interval을 무시하고 월봉을 주므로 날짜 범위로 요청한다. */
const yahooStats = { ok: 0, http: {}, timeout: 0, error: 0 };
async function fetchT(url, opt) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...opt, signal: ac.signal }); }
  finally { clearTimeout(t); }
}
async function fetchYahoo(symbol, days) {
  const now = Math.floor(Date.now() / 1000);
  const p1 = Math.floor(now - days * 86400);
  const path =
    "/v8/finance/chart/" + encodeURIComponent(symbol) +
    "?period1=" + p1 + "&period2=" + now + "&interval=1d&events=div%2Csplit";
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const r = await fetchT("https://" + host + path, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) { yahooStats.http[r.status] = (yahooStats.http[r.status] || 0) + 1; continue; }
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res || !res.timestamp || !res.timestamp.length) continue;
      const gran = res.meta && res.meta.dataGranularity;
      if (gran && gran !== "1d") continue;
      const span = (res.timestamp[res.timestamp.length - 1] - res.timestamp[0]) / 86400;
      if (span > 365 * 3 && res.timestamp.length < span / 3) continue;
      yahooStats.ok++;
      return res;
    } catch (e) { if (e && e.name === "AbortError") yahooStats.timeout++; else yahooStats.error++; }
  }
  return null;
}

function toSnapshot(symbol, r, maxYears) {
  const q = r.indicators.quote[0];
  const adj = (r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose) || null;
  const cutoff = Math.floor(Date.now() / 1000) - maxYears * 365.25 * 86400;
  const t = [], o = [], h = [], l = [], c = [], a = [], v = [];
  const rnd = (x) => Math.round(x * 10000) / 10000;
  for (let i = 0; i < r.timestamp.length; i++) {
    const cl = q.close[i];
    if (cl == null || !isFinite(cl) || cl <= 0 || r.timestamp[i] < cutoff) continue;
    t.push(r.timestamp[i]);
    c.push(rnd(cl));
    o.push(rnd(q.open && q.open[i] != null ? q.open[i] : cl));
    h.push(rnd(q.high && q.high[i] != null ? q.high[i] : cl));
    l.push(rnd(q.low && q.low[i] != null ? q.low[i] : cl));
    a.push(rnd(adj && adj[i] != null && isFinite(adj[i]) && adj[i] > 0 ? adj[i] : cl));
    v.push(q.volume && q.volume[i] != null ? q.volume[i] : 0);
  }
  const div = [];
  if (r.events && r.events.dividends) {
    for (const k of Object.keys(r.events.dividends)) {
      const d = r.events.dividends[k];
      if (d && d.amount != null) div.push([d.date || +k, d.amount]);
    }
    div.sort((x, y) => x[0] - y[0]);
  }
  const meta = {};
  if (r.meta) {
    for (const k of ["currency", "shortName", "longName", "exchangeName", "fullExchangeName",
                     "firstTradeDate", "fiftyTwoWeekHigh", "fiftyTwoWeekLow"]) {
      if (r.meta[k] != null) meta[k] = r.meta[k];
    }
  }
  return { s: symbol, meta, t, o, h, l, c, a, v, div, updated: new Date().toISOString().slice(0, 10) };
}

export default async function handler(req, res) {
  const started = Date.now();
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || "";
    const key = req.query.key || "";
    if (auth !== "Bearer " + process.env.CRON_SECRET && key !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = proto + "://" + req.headers.host;
  const today = new Date().toISOString().slice(0, 10);
  const force = req.query.force === "1";
  const redis = redisConf();
  if (!redis) {
    return res.status(500).json({ error: "Redis가 연결되지 않았습니다 (KV_REST_API_URL / KV_REST_API_TOKEN 필요)." });
  }

  // 종목 목록이 이상하면(로그인 페이지 등) 데이터를 하나도 건드리지 않고 멈추고, 이유를 실행 기록에 남긴다
  let symbols, symSource;
  try {
    const r = await loadSymbols(origin);
    symbols = r.list; symSource = r.source;
  } catch (e) {
    const log = { at: new Date().toISOString(), elapsedMs: Date.now() - started, symbols: 0, recentOk: 0, kept: 0,
      recentSaved: { ok: false, error: "종목 목록을 읽지 못해 이번 실행은 건너뜀 — 지난 데이터 유지" }, symbolsError: String(e.message).slice(0, 300) };
    try { await redisCmd(redis, ["SET", "sm:cronlog", JSON.stringify(log), "EX", String(14 * 86400)]); } catch (x) {}
    return res.status(500).json({ error: "심볼 목록을 읽지 못했습니다: " + e.message });
  }

  let manifest = null;
  try { const t = await getJsonGzText(redis, KEY.manifest); if (t) manifest = JSON.parse(t); } catch (e) { /* 처음이면 새로 만든다 */ }
  const entries = (manifest && manifest.symbols) || {};

  let writes = 0;
  const done = [], failed = [];

  /* ① 최근 구간 — 가장 중요하므로 먼저. 이번에 못 받은 종목은 지난 값을 그대로 둔다 */
  let prevRecent = null;
  try { const t = await getJsonGzText(redis, KEY.recent); if (t) prevRecent = JSON.parse(t); } catch (e) { /* 없으면 새로 */ }
  const recent = { generated: new Date().toISOString(), days: RECENT_DAYS, symbols: {}, flags: {} };
  let recentOk = 0, flagged = 0;
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    if (Date.now() - started > RECENT_BUDGET_MS) break;
    await Promise.all(symbols.slice(i, i + CONCURRENCY).map(async (sym) => {
      try {
        let s = null, flags = [];
        for (let attempt = 0; attempt <= RETRY_BAD; attempt++) {
          const r = await fetchYahoo(sym, RECENT_DAYS);
          if (!r) continue;
          const cand = toSnapshot(sym, r, 2);
          if (!cand.t.length) continue;
          flags = validateSeries(sym, cand);
          s = cand;
          if (!flags.some((f) => f === "spike" || f === "scale" || f === "frozen")) break;   // 의심스러우면 한 번 더
        }
        if (!s) return;
        const prev = prevRecent && prevRecent.symbols && prevRecent.symbols[sym];
        const bad = flags.filter((f) => f === "spike" || f === "scale" || f === "frozen");
        if (bad.length && prev && prev.c && prev.c.length) {   // 검증 실패 → 지난 값을 유지하고 표시만
          recent.symbols[sym] = prev; recent.flags[sym] = bad.join(",") + "(이전 값 유지)"; flagged++; return;
        }
        if (flags.length) recent.flags[sym] = flags.join(",");
        // 이전 스냅샷과 같은 날짜의 종가가 1% 넘게 다르면(수정 데이터) 표시
        if (prev && prev.t && prev.t.length) { const lt = prev.t[prev.t.length - 1], j = s.t.indexOf(lt); if (j >= 0 && Math.abs(s.c[j] / prev.c[prev.c.length - 1] - 1) > 0.01) recent.flags[sym] = (recent.flags[sym] ? recent.flags[sym] + "," : "") + "revised"; }
        recent.symbols[sym] = { t: s.t, o: s.o, h: s.h, l: s.l, c: s.c, a: s.a, v: s.v, div: s.div, meta: s.meta };
        recentOk++;
      } catch (e) { /* 건너뛴다 */ }
    }));
  }
  let kept = 0;
  if (prevRecent && prevRecent.symbols) {
    for (const sym of symbols) {
      if (!recent.symbols[sym] && prevRecent.symbols[sym]) { recent.symbols[sym] = prevRecent.symbols[sym]; kept++; }
    }
  }
  let recentSaved = null;
  if (recentOk > 0) {
    try {
      const bytes = await setJsonGz(redis, KEY.recent, recent, 14 * 86400);
      writes++; recentSaved = { ok: true, bytes };
    } catch (e) { recentSaved = { ok: false, error: String(e.message).slice(0, 160) }; }
    for (const sym of Object.keys(recent.symbols)) {
      if (!prevRecent || !prevRecent.symbols || recent.symbols[sym] !== prevRecent.symbols[sym]) entries[sym] = { ...(entries[sym] || {}), updated: today };
    }
  } else {
    recentSaved = { ok: false, error: "야후에서 한 종목도 받지 못함 — 지난 데이터 유지" };
  }

  /* ② 과거 전체 — 남은 시간 안에서, 가장 오래 안 받은 종목부터 */
  const stale = symbols
    .map((s) => ({ s, at: (entries[s] && entries[s].history) || "" }))
    .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0))
    .filter((x) => force || x.at !== today)
    .slice(0, HISTORY_PER_RUN);
  for (let i = 0; i < stale.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS - 6000) break;   // 한 묶음(최대 8초) 여유
    await Promise.all(stale.slice(i, i + CONCURRENCY).map(async ({ s: sym }) => {
      try {
        const r = await fetchYahoo(sym, 25 * 365.25);
        if (!r) throw new Error("no data");
        const snap = toSnapshot(sym, r, 25);
        if (!snap.t.length) throw new Error("empty");
        await setJsonGz(redis, KEY.chart(sym), snap, 45 * 86400);   // 45일 안에 다시 안 받으면 만료
        writes++;
        entries[sym] = { ...(entries[sym] || {}), history: today, rows: snap.t.length, updated: today };
        done.push(sym);
      } catch (e) {
        failed.push(sym + ": " + String(e.message).slice(0, 40));
      }
    }));
  }

  /* ③ 목록 */
  const withHistory = symbols.filter((s) => entries[s] && entries[s].history).length;
  let manifestOk = true;
  try {
    await setJsonGz(redis, KEY.manifest, {
      generated: new Date().toISOString(),
      recentDays: RECENT_DAYS,
      complete: withHistory === symbols.length,
      symbols: entries,
    });
    writes++;
  } catch (e) { manifestOk = false; }

  /* ④ 실행 기록 — /api/config 에서 비밀값 없이 확인할 수 있게 남긴다 */
  const log = {
    at: new Date().toISOString(), elapsedMs: Date.now() - started,
    symbols: symbols.length, symbolsFrom: symSource, recentOk, kept, flagged, flags: recent.flags, recentSaved, historyUpdated: done.length,
    historyFailed: failed.length, withHistory, manifestOk, yahoo: yahooStats,
    failedSample: failed.slice(0, 5)
  };
  try { await redisCmd(redis, ["SET", "sm:cronlog", JSON.stringify(log), "EX", String(14 * 86400)]); } catch (e) {}

  res.status(200).json({
    ok: true,
    store: "redis",
    at: kst(new Date().toISOString()),
    symbols: symbols.length, symbolsFrom: symSource,
    redisWrites: writes,
    historyUpdated: done.length,
    historyRemaining: symbols.length - withHistory,
    recentSymbols: recentOk, recentKept: kept,
    recentSaved, manifestOk, yahoo: yahooStats,
    failed: failed.slice(0, 10),
    elapsedMs: Date.now() - started,
    note: "과거 전체는 순환 갱신, 최근 " + RECENT_DAYS + "일은 매 실행 전 종목 갱신",
  });
}
