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
import { redisConf, redisCmd, setJsonGz, getJsonGzText, KEY } from "./_redis.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CONCURRENCY = 6;
const TIME_BUDGET_MS = 55000;
const HISTORY_PER_RUN = 40;   // 한 번에 과거 전체를 다시 받을 종목 수 (Redis는 쓰기 한도가 넉넉해 넉넉히 잡는다. 시간 예산 55초 안에서 멈춘다)
const RECENT_DAYS = 90;       // recent.json이 담는 최근 일수

async function loadSymbols(origin) {
  const r = await fetch(origin + "/tickers.js", { cache: "no-store" });
  const src = await r.text();
  const out = [];
  const re = /\[\s*"([^"]+)"\s*,\s*"[^"]*"/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return Array.from(new Set(out));
}

/* Yahoo 일봉. range=max 는 interval을 무시하고 월봉을 주므로 날짜 범위로 요청한다. */
async function fetchYahoo(symbol, days) {
  const now = Math.floor(Date.now() / 1000);
  const p1 = Math.floor(now - days * 86400);
  const path =
    "/v8/finance/chart/" + encodeURIComponent(symbol) +
    "?period1=" + p1 + "&period2=" + now + "&interval=1d&events=div%2Csplit";
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const r = await fetch("https://" + host + path, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res || !res.timestamp || !res.timestamp.length) continue;
      const gran = res.meta && res.meta.dataGranularity;
      if (gran && gran !== "1d") continue;
      const span = (res.timestamp[res.timestamp.length - 1] - res.timestamp[0]) / 86400;
      if (span > 365 * 3 && res.timestamp.length < span / 3) continue;
      return res;
    } catch (e) { /* 다음 호스트 */ }
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

  let symbols;
  try {
    symbols = await loadSymbols(origin);
    if (!symbols.length) throw new Error("no symbols");
  } catch (e) {
    return res.status(500).json({ error: "심볼 목록을 읽지 못했습니다: " + e.message });
  }

  let manifest = null;
  try { const t = await getJsonGzText(redis, KEY.manifest); if (t) manifest = JSON.parse(t); } catch (e) { /* 처음이면 새로 만든다 */ }
  const entries = (manifest && manifest.symbols) || {};

  let writes = 0;
  const done = [], failed = [];

  /* ① 과거 전체 — 가장 오래 안 받은 종목부터 */
  const stale = symbols
    .map((s) => ({ s, at: (entries[s] && entries[s].history) || "" }))
    .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0))
    .filter((x) => force || x.at !== today)
    .slice(0, HISTORY_PER_RUN);

  for (let i = 0; i < stale.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
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

  /* ② 최근 구간 — 전 종목을 한 파일에 */
  const recent = { generated: new Date().toISOString(), days: RECENT_DAYS, symbols: {} };
  let recentOk = 0;
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    await Promise.all(symbols.slice(i, i + CONCURRENCY).map(async (sym) => {
      try {
        const r = await fetchYahoo(sym, RECENT_DAYS);
        if (!r) return;
        const s = toSnapshot(sym, r, 1);
        if (!s.t.length) return;
        recent.symbols[sym] = { t: s.t, o: s.o, h: s.h, l: s.l, c: s.c, a: s.a, v: s.v, div: s.div, meta: s.meta };
        recentOk++;
      } catch (e) { /* 건너뛴다 */ }
    }));
  }
  let recentSaved = null;
  if (recentOk > 0) {
    try {
      const bytes = await setJsonGz(redis, KEY.recent, recent, 7 * 86400);
      writes++; recentSaved = { ok: true, bytes };
    } catch (e) { recentSaved = { ok: false, error: String(e.message).slice(0, 120) }; }
    for (const sym of Object.keys(recent.symbols)) {
      entries[sym] = { ...(entries[sym] || {}), updated: today };
    }
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

  res.status(200).json({
    ok: true,
    store: "redis",
    redisWrites: writes,
    historyUpdated: done.length,
    historyRemaining: symbols.length - withHistory,
    recentSymbols: recentOk,
    recentSaved, manifestOk,
    failed: failed.slice(0, 10),
    elapsedMs: Date.now() - started,
    note: "과거 전체는 순환 갱신, 최근 " + RECENT_DAYS + "일은 매 실행 전 종목 갱신",
  });
}
