// /api/cron-snapshot — 하루 2회 자동 실행 (vercel.json)
//
// Vercel Blob의 "Advanced Operations"(put/list)는 무료 월 2,000회뿐이다.
// 종목마다 매일 파일을 새로 쓰면 하루 수백 회가 되어 한도를 크게 넘는다.
// 그래서 쓰기를 이렇게 나눈다.
//
//   ① 과거 전체(charts/SYM.json) : 종목을 며칠에 걸쳐 순환 갱신 → 실행당 10회
//   ② 최근 구간(recent.json)     : 전 종목의 최근 90일을 한 파일에 → 실행당 1회
//   ③ 목록(manifest.json)        : 실행당 1회
//
// 클라이언트가 ①+②를 합쳐 쓰므로 ①이 며칠 지나도 화면 데이터는 항상 최신이다.
// 실행당 쓰기 ≈ 12회, 하루 2회 → 월 약 720회로 한도 안에 들어온다.
import { put, list } from "@vercel/blob";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CONCURRENCY = 6;
const TIME_BUDGET_MS = 55000;
const HISTORY_PER_RUN = 10;   // 한 번에 과거 전체를 다시 받을 종목 수
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

async function readJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

function blobBase() {
  const id = (process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  return id ? "https://" + id + ".public.blob.vercel-storage.com/" : null;
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
  const putOpts = { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" };
  const today = new Date().toISOString().slice(0, 10);
  const force = req.query.force === "1";
  const base = blobBase();

  let symbols;
  try {
    symbols = await loadSymbols(origin);
    if (!symbols.length) throw new Error("no symbols");
  } catch (e) {
    return res.status(500).json({ error: "심볼 목록을 읽지 못했습니다: " + e.message });
  }

  // list()도 Advanced Operation이므로 공개 URL로 직접 읽는다 (주소를 못 구할 때만 list 사용)
  let manifest = base ? await readJson(base + "manifest.json") : null;
  if (!manifest) {
    try {
      const r = await list({ prefix: "manifest.json", limit: 1 });
      if (r.blobs && r.blobs[0]) manifest = await readJson(r.blobs[0].url);
    } catch (e) { /* 처음이면 새로 만든다 */ }
  }
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
        await put("charts/" + sym + ".json", JSON.stringify(snap), putOpts);
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
  if (recentOk > 0) {
    await put("recent.json", JSON.stringify(recent), { ...putOpts, cacheControlMaxAge: 1800 });
    writes++;
    for (const sym of Object.keys(recent.symbols)) {
      entries[sym] = { ...(entries[sym] || {}), updated: today };
    }
  }

  /* ③ 목록 */
  const withHistory = symbols.filter((s) => entries[s] && entries[s].history).length;
  await put("manifest.json", JSON.stringify({
    generated: new Date().toISOString(),
    recentDays: RECENT_DAYS,
    complete: withHistory === symbols.length,
    symbols: entries,
  }), { ...putOpts, cacheControlMaxAge: 600 });
  writes++;

  res.status(200).json({
    ok: true,
    blobWrites: writes,
    historyUpdated: done.length,
    historyRemaining: symbols.length - withHistory,
    recentSymbols: recentOk,
    failed: failed.slice(0, 10),
    elapsedMs: Date.now() - started,
    note: "과거 전체는 순환 갱신, 최근 " + RECENT_DAYS + "일은 매 실행 전 종목 갱신",
  });
}
