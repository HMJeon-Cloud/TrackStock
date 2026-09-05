// /api/cron-snapshot — Vercel Cron이 하루 2회 호출.
// 사전(tickers.js)에 등록된 모든 종목의 전체 기간 일봉을 Yahoo에서 받아 Vercel Blob에 정적 JSON으로 저장한다.
// 사용자는 이 정적 파일을 직접 읽으므로 함수 호출·상류 API 요청이 발생하지 않는다.
// 시간 예산(50초) 안에 못 끝내면 진행 위치를 manifest에 남기고, 다음 실행이 이어서 처리한다.
import { put, list } from "@vercel/blob";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BUDGET_MS = 50 * 1000;
const CONCURRENCY = 6;

/* tickers.js 는 브라우저용 전역 선언 파일이라 정규식으로 심볼만 뽑는다 */
function loadSymbols() {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "..", "tickers.js"), "utf8");
  const out = [];
  const re = /\[\s*"([^"]+)"\s*,\s*"[^"]*"/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return Array.from(new Set(out));
}

/* Yahoo 일봉 전체 기록 요청.
   주의: range=max 를 쓰면 Yahoo가 interval=1d 를 무시하고 월봉(1mo)을 돌려준다.
   전체 기간의 일봉을 받으려면 period1/period2 로 날짜 범위를 직접 지정해야 한다.
   응답의 meta.dataGranularity 가 "1d" 인지 확인해서 월봉이 오면 버린다. */
async function fetchYahoo(symbol) {
  const now = Math.floor(Date.now() / 1000);
  const p1 = now - 25 * 365.25 * 86400;                          // 최근 25년 (앱이 쓰는 최대치)
  const candidates = [
    "?period1=" + Math.floor(p1) + "&period2=" + now + "&interval=1d&events=div%2Csplit",
    "?range=25y&interval=1d&events=div%2Csplit",                 // 예비
  ];
  for (const qs of candidates) {
    const path = "/v8/finance/chart/" + encodeURIComponent(symbol) + qs;
    for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
      try {
        const r = await fetch("https://" + host + path, { headers: { "User-Agent": UA, Accept: "application/json" } });
        if (!r.ok) continue;
        const j = await r.json();
        const res = j && j.chart && j.chart.result && j.chart.result[0];
        if (!res || !res.timestamp || !res.timestamp.length) continue;
        const gran = res.meta && res.meta.dataGranularity;
        if (gran && gran !== "1d") continue;                       // 월봉·주봉이면 다음 후보로
        // 20년 넘는 기간에 봉이 1,000개도 안 되면 일봉이 아니다
        const span = (res.timestamp[res.timestamp.length - 1] - res.timestamp[0]) / 86400;
        if (span > 365 * 3 && res.timestamp.length < span / 3) continue;
        return res;
      } catch (e) { /* 다음 호스트 */ }
    }
  }
  return null;
}

/* Yahoo 응답 → 열(column) 형식 압축 스냅샷. 최근 25년만 보관한다. */
function toSnapshot(symbol, r) {
  const q = r.indicators.quote[0];
  const adj = (r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose) || null;
  const cutoff = Math.floor(Date.now() / 1000) - 25 * 365.25 * 86400;
  const t = [], o = [], h = [], l = [], c = [], a = [], v = [];
  const r4 = (x) => (x == null || !isFinite(x)) ? null : +(+x).toPrecision(7);
  for (let i = 0; i < r.timestamp.length; i++) {
    const cl = q.close[i];
    if (cl == null || !isFinite(cl) || cl <= 0 || r.timestamp[i] < cutoff) continue;
    t.push(r.timestamp[i]);
    c.push(r4(cl));
    o.push(r4(q.open && q.open[i] != null ? q.open[i] : cl));
    h.push(r4(q.high && q.high[i] != null ? q.high[i] : cl));
    l.push(r4(q.low && q.low[i] != null ? q.low[i] : cl));
    a.push(r4(adj && adj[i] != null && adj[i] > 0 ? adj[i] : cl));
    v.push(q.volume && q.volume[i] != null ? Math.round(q.volume[i]) : 0);
  }
  const div = [];
  if (r.events && r.events.dividends) {
    for (const k of Object.keys(r.events.dividends)) {
      const d = r.events.dividends[k];
      if (d && d.amount != null) div.push([(d.date || +k), +d.amount]);
    }
    div.sort((x, y) => x[0] - y[0]);
  }
  const m = r.meta || {};
  const meta = {
    currency: m.currency, symbol: m.symbol, exchangeName: m.exchangeName, fullExchangeName: m.fullExchangeName,
    shortName: m.shortName, longName: m.longName, firstTradeDate: m.firstTradeDate,
    fiftyTwoWeekHigh: m.fiftyTwoWeekHigh, fiftyTwoWeekLow: m.fiftyTwoWeekLow, instrumentType: m.instrumentType
  };
  return { s: symbol, meta, t, o, h, l, c, a, v, div, updated: new Date().toISOString().slice(0, 10) };
}

async function readManifest() {
  try {
    const r = await list({ prefix: "manifest.json", limit: 1 });
    const b = r.blobs && r.blobs[0];
    if (!b) return null;
    const j = await (await fetch(b.url, { cache: "no-store" })).json();
    return j;
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  // Vercel Cron은 CRON_SECRET이 설정돼 있으면 Authorization 헤더로 보낸다. 수동 호출 방지.
  if (process.env.CRON_SECRET) {
    const auth = req.headers["authorization"] || "";
    if (auth !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "unauthorized" });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, note: "Blob 저장소가 연결되지 않았습니다 (BLOB_READ_WRITE_TOKEN 없음)." });
  }

  const started = Date.now();
  const symbols = loadSymbols();
  const prev = (await readManifest()) || { symbols: {}, cursor: 0 };
  const entries = prev.symbols || {};
  let cursor = typeof prev.cursor === "number" ? prev.cursor : 0;
  const today = new Date().toISOString().slice(0, 10);

  // 오늘 이미 갱신된 종목은 건너뛰고, 커서부터 순환하며 처리한다
  const order = symbols.slice(cursor).concat(symbols.slice(0, cursor));
  const todo = order.filter((s) => !(entries[s] && entries[s].updated === today));

  let done = 0, failed = 0, stopped = false;
  const putOpts = { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 3600 };

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    if (Date.now() - started > BUDGET_MS) { stopped = true; break; }
    const batch = todo.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (sym) => {
      try {
        const r = await fetchYahoo(sym);
        if (!r) { failed++; entries[sym] = { ...(entries[sym] || {}), error: today }; return; }
        const snap = toSnapshot(sym, r);
        // 전체(25년)와 경량(10년) 두 벌 저장 — 대부분의 조회는 10년이라 경량 파일로 대역폭을 절반으로 줄인다
        const cut10 = Math.floor(Date.now() / 1000) - 10 * 365.25 * 86400;
        let k = 0; while (k < snap.t.length && snap.t[k] < cut10) k++;
        const lite = { ...snap, t: snap.t.slice(k), o: snap.o.slice(k), h: snap.h.slice(k), l: snap.l.slice(k),
          c: snap.c.slice(k), a: snap.a.slice(k), v: snap.v.slice(k), div: snap.div.filter((d) => d[0] >= cut10) };
        await Promise.all([
          put("charts/" + sym + ".json", JSON.stringify(snap), putOpts),
          put("charts10/" + sym + ".json", JSON.stringify(lite), putOpts)
        ]);
        entries[sym] = { updated: today, rows: snap.t.length, from: snap.t[0], currency: snap.meta.currency };
        done++;
      } catch (e) {
        failed++;
        entries[sym] = { ...(entries[sym] || {}), error: today, msg: String(e.message).slice(0, 80) };
      }
    }));
    cursor = (symbols.indexOf(batch[batch.length - 1]) + 1) % symbols.length;
  }

  const manifest = {
    generated: new Date().toISOString(),
    total: symbols.length,
    complete: !stopped && todo.length - done - failed <= 0,
    cursor: stopped ? cursor : 0,
    symbols: entries
  };
  await put("manifest.json", JSON.stringify(manifest), { ...putOpts, cacheControlMaxAge: 600 });

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true, done, failed, remaining: Math.max(0, todo.length - done - failed), stopped,
    elapsedSec: Math.round((Date.now() - started) / 100) / 10, total: symbols.length
  });
}
