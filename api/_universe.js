// v12.9 전체 시장 유니버스 — S&P 500 전 종목 · 코스피 시가총액 상위 200
//   크론(cron-snapshot) 안에서 돌고(새 함수 없음), 시계열은 저장하지 않는다. 종목당 요약 숫자만 남겨 sm:uni:us / sm:uni:kr (gz, ~100KB)에 둔다.
//   목록: S&P 500 = 위키피디아 구성표(섹터 포함, 7일 캐시 · 실패 시 지난 목록) · 코스피 200 = 네이버 시가총액 상위(매일 · 실패 시 지난 목록)
//   안전장치: 야후가 막히거나 시간이 모자라면 지난 요약을 그대로 두고(stale 표시) 받은 종목만 갱신한다. 한 종목도 못 받으면 저장하지 않는다.
import { redisCmd, setJsonGz, getJsonGzText } from "./_redis.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const KEYS = { list: (m) => "sm:uni:list:" + m, data: (m) => "sm:uni:" + m };
const CONC = 6, GAP_MS = 120, FETCH_MS = 8000, LIST_TTL_US = 7 * 86400e3;

async function fetchT(url, opt, ms) { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms || FETCH_MS); try { return await fetch(url, { ...opt, signal: ac.signal }); } finally { clearTimeout(t); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 목록 ---------- */
async function listUS(rc) {
  let prev = null; try { const t = await redisCmd(rc, ["GET", KEYS.list("us")]); prev = t ? JSON.parse(t) : null; } catch (e) {}
  if (prev && prev.items && prev.items.length >= 450 && Date.now() - prev.at < LIST_TTL_US) return { items: prev.items, source: "cache", at: prev.at };
  try {
    const r = await fetchT("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", { headers: { "User-Agent": "StockMind/1.0 (daily market breadth; contact via site)", Accept: "text/html" } }, 12000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const html = await r.text();
    const tbl = html.split(/<table[^>]*id="constituents"[^>]*>/)[1]; if (!tbl) throw new Error("표 없음");
    const body = tbl.split("</table>")[0], rows = body.split(/<tr[^>]*>/).slice(2), items = [];
    for (const row of rows) {
      const cells = row.split(/<td[^>]*>/).slice(1).map((c) => c.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim());
      if (cells.length < 4) continue;
      const sym = cells[0].replace(/\./g, "-"), name = cells[1], sector = cells[2];
      if (/^[A-Z][A-Z0-9-]{0,6}$/.test(sym)) items.push({ s: sym, n: name.slice(0, 40), sec: sector.slice(0, 40) });
    }
    if (items.length < 450) throw new Error("종목 " + items.length + "개뿐");
    const doc = { at: Date.now(), items, source: "wikipedia" };
    await redisCmd(rc, ["SET", KEYS.list("us"), JSON.stringify(doc), "EX", String(60 * 86400)]);
    return { items, source: "wikipedia", at: doc.at };
  } catch (e) {
    if (prev && prev.items && prev.items.length) return { items: prev.items, source: "cache(stale): " + String(e.message).slice(0, 60), at: prev.at };
    throw e;
  }
}
async function listKR(rc) {
  let prev = null; try { const t = await redisCmd(rc, ["GET", KEYS.list("kr")]); prev = t ? JSON.parse(t) : null; } catch (e) {}
  try {
    const items = [], seen = {};
    for (let page = 1; page <= 4 && items.length < 200; page++) {   // 네이버가 한 페이지에 100개를 다 주지 않을 때가 있어 200개가 찰 때까지 (최대 4페이지)
      const r = await fetchT("https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=" + page + "&pageSize=100", { headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://m.stock.naver.com/" } }, 10000);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json(), L = (j && (j.stocks || j.items || j.result || j)) || [];
      (Array.isArray(L) ? L : []).forEach((x) => { const code = String(x.itemCode || x.code || x.reutersCode || "").replace(/\D/g, ""); if (code.length === 6 && !seen[code]) { seen[code] = 1; const it = x.industryCodeType || x.industry || {}; items.push({ s: code + ".KS", n: String(x.stockName || x.name || code).slice(0, 30), sec: String(it.industryGroupKor || it.name || x.industryName || "").slice(0, 30) }); } /* v12.29 업종 이름이 오면 같이 (없으면 빈칸 → 화면은 테마로 대신) */ });
      if (!(Array.isArray(L) && L.length)) break;
    }
    if (items.length < 150) throw new Error("종목 " + items.length + "개뿐");
    const doc = { at: Date.now(), items: items.slice(0, 200), source: "naver" };
    await redisCmd(rc, ["SET", KEYS.list("kr"), JSON.stringify(doc), "EX", String(60 * 86400)]);
    return { items: doc.items, source: "naver", at: doc.at };
  } catch (e) {
    if (prev && prev.items && prev.items.length) return { items: prev.items, source: "cache(stale): " + String(e.message).slice(0, 60), at: prev.at };
    throw e;
  }
}

/* ---------- 종목 하나 → 요약 숫자 ---------- */
/* v12.29 그 시장 현지 날짜 (국내 +9h · 미국 -5h) */
const locD = (sym, ts) => new Date((ts + (/\.K[SQ]$/.test(sym) ? 9 : -5) * 3600) * 1000).toISOString().slice(0, 10);
export function summarize(sym, res) {
  const q = res.indicators.quote[0], T = res.timestamp, c = [], v = [], t = [];
  for (let i = 0; i < T.length; i++) { const x = q.close[i]; if (x == null || !isFinite(x) || x <= 0) continue; c.push(x); v.push(q.volume && q.volume[i] != null ? q.volume[i] : 0); t.push(T[i]); }
  /* v12.29 ① 장중(아직 안 끝난) 봉은 뺀다 — 09시 국내 수집이 오늘 장중 가격을 '종가'로 담던 문제
            ② 막 끝난 거래일 봉이 빈 값이면, 장이 끝난 뒤에만 야후 meta의 정규장 종가로 채운다 */
  const nowS = Math.floor(Date.now() / 1000), m = res.meta || {}, ctp = m.currentTradingPeriod && m.currentTradingPeriod.regular;
  const live = !!(ctp && ctp.start && ctp.end && nowS >= ctp.start - 3600 && nowS < ctp.end);
  while (live && t.length > 1 && t[t.length - 1] >= ctp.start - 3600) { c.pop(); v.pop(); t.pop(); }
  let fixed = 0;
  if (!live && m.regularMarketTime && m.regularMarketPrice > 0 && t.length && m.regularMarketTime > t[t.length - 1] && locD(sym, m.regularMarketTime) > locD(sym, t[t.length - 1]) && Math.abs(m.regularMarketPrice / c[c.length - 1] - 1) < 0.4) {
    c.push(m.regularMarketPrice); v.push(m.regularMarketVolume || 0); t.push(m.regularMarketTime); fixed = 1;
  }
  const n = c.length; if (n < 25) return null;
  /* 이번 주(지난주 마지막 종가 대비) · 이번 달(지난달 마지막 종가 대비) — 브리핑 '금주·이번 달'을 전체 시장으로 계산하려고 */
  const dl = locD(sym, t[n - 1]), dd = new Date(dl + "T00:00:00Z"), wkStart = new Date(dd.getTime() - ((dd.getUTCDay() + 6) % 7) * 86400e3).toISOString().slice(0, 10), moStart = dl.slice(0, 8) + "01";
  let iw = -1, im = -1; for (let i = n - 1; i >= 0; i--) { const d = locD(sym, t[i]); if (iw < 0 && d < wkStart) iw = i; if (im < 0 && d < moStart) { im = i; break; } }
  const last = c[n - 1], ma = (k) => n >= k ? c.slice(-k).reduce((a, x) => a + x, 0) / k : null;
  const m20 = ma(20), m50 = ma(50), m200 = ma(200);
  const prev = c.slice(Math.max(0, n - 251), n - 1), longEnough = prev.length >= 200, hi = longEnough ? Math.max(...prev) : null, lo = longEnough ? Math.min(...prev) : null;
  const amt = v[n - 1] * last, win = []; for (let i = Math.max(1, n - 21); i < n - 1; i++) win.push(v[i] * c[i]); const med = win.length ? win.slice().sort((a, b) => a - b)[win.length >> 1] : 0;
  const rr = (x) => Math.round(x * 10000) / 10000;
  return { s: sym, c: Math.abs(last) >= 1 ? Math.round(last * 100) / 100 : Number(last.toPrecision(5)), r1: rr(last / c[n - 2] - 1), r5: n > 5 ? rr(last / c[n - 6] - 1) : null, m1: n > 21 ? rr(last / c[n - 22] - 1) : null,
    a20: m20 != null ? last >= m20 : null, a50: m50 != null ? last >= m50 : null, a200: m200 != null ? last >= m200 : null,
    hi, lo, vh: hi ? rr(last / hi - 1) : null, vl: lo ? rr(last / lo - 1) : null, nh: longEnough && last >= hi, nl: longEnough && last <= lo,
    amt: Math.round(amt), ax: med > 0 ? Math.round(amt / med * 100) / 100 : null, t: t[n - 1] * 1000, nd: n,
    d: dl, wk: iw >= 0 ? rr(last / c[iw] - 1) : null, mo: im >= 0 ? rr(last / c[im] - 1) : null, fx: fixed || undefined };
}
async function fetchOne(sym, stats) {
  const now = Math.floor(Date.now() / 1000), path = "/v8/finance/chart/" + encodeURIComponent(sym) + "?period1=" + (now - 400 * 86400) + "&period2=" + now + "&interval=1d";
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const r = await fetchT("https://" + host + path, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.status === 429) { stats.h429++; await sleep(1500); continue; }
      if (!r.ok) { stats.http[r.status] = (stats.http[r.status] || 0) + 1; continue; }
      const j = await r.json(), res = j && j.chart && j.chart.result && j.chart.result[0];
      if (!res || !res.timestamp || !res.timestamp.length) continue;
      stats.ok++; return res;
    } catch (e) { if (e && e.name === "AbortError") stats.timeout++; else stats.error++; }
  }
  return null;
}

/* ---------- 수집 본체: budgetMs 안에서 받을 수 있는 만큼, 나머지는 지난 요약 유지 ---------- */
/* v12.13 생존 편향 대비 — 그달의 구성 목록을 월별로 한 번 보관(sm:uni:hist:<mkt>:<YYYY-MM>, 400일). 나중에 "그때 구성"으로 다시 계산할 수 있게. 함수·크론 추가 없음 */
async function keepListHistory(rc, mkt, list) {
  try {
    const ym = new Date().toISOString().slice(0, 7), key = "sm:uni:hist:" + mkt + ":" + ym;
    if (await redisCmd(rc, ["EXISTS", key])) return;
    await redisCmd(rc, ["SET", key, JSON.stringify({ at: Date.now(), source: list.source, syms: list.items.map((x) => x.s) }), "EX", String(400 * 86400)]);
  } catch (e) {}
}
export async function collectUniverse(rc, mkt, budgetMs) {
  const t0 = Date.now(), stats = { ok: 0, http: {}, h429: 0, timeout: 0, error: 0 };
  const list = mkt === "kr" ? await listKR(rc) : await listUS(rc);
  await keepListHistory(rc, mkt, list);
  let prev = null; try { const t = await getJsonGzText(rc, KEYS.data(mkt)); if (t) prev = JSON.parse(t); } catch (e) {}
  const prevBy = {}; ((prev && prev.rows) || []).forEach((r) => { prevBy[r.s] = r; });
  // 오래된 것부터 (시간이 모자라도 매번 같은 종목만 빠지지 않게)
  const order = list.items.slice().sort((a, b) => ((prevBy[a.s] && prevBy[a.s].t) || 0) - ((prevBy[b.s] && prevBy[b.s].t) || 0));
  const rows = {}, failed = []; let stop = false, conc = CONC;
  for (let i = 0; i < order.length && !stop; i += conc) {
    if (Date.now() - t0 > budgetMs - 9000) { stop = true; break; }
    await Promise.all(order.slice(i, i + conc).map(async (it) => {
      const res = await fetchOne(it.s, stats);
      const row = res ? summarize(it.s, res) : null;
      if (row) { row.n = it.n; row.sec = it.sec || (prevBy[it.s] && prevBy[it.s].sec) || ""; rows[it.s] = row; } else failed.push(it.s);
    }));
    if (stats.h429 >= 3 && conc > 2) conc = 3;   // 막히기 시작하면 천천히
    await sleep(GAP_MS);
  }
  let kept = 0; list.items.forEach((it) => { if (!rows[it.s] && prevBy[it.s]) { rows[it.s] = { ...prevBy[it.s], stale: true }; kept++; } });
  const all = list.items.map((it) => rows[it.s]).filter(Boolean), fresh = all.filter((r) => !r.stale);
  if (!fresh.length) return { ok: false, reason: "야후에서 한 종목도 받지 못함 — 지난 요약 유지", mkt, list: list.source, stats, elapsedMs: Date.now() - t0 };
  const asOf = Math.max(...fresh.map((r) => r.t || 0)), asOfD = fresh.reduce((a, r) => (r.d && r.d > a ? r.d : a), "");
  const lagN = fresh.filter((r) => r.d && r.d < asOfD).length;   // 마지막 거래일보다 늦은 종목 수(화면에서 집계 제외)
  const doc = { ver: 2, mkt, asOfD, lagN, generated: new Date().toISOString(), asOf, n: all.length, fresh: fresh.length, kept, listSource: list.source, listAt: list.at, rows: all };
  const bytes = await setJsonGz(rc, KEYS.data(mkt), doc, 10 * 86400);
  return { ok: true, mkt, n: all.length, fresh: fresh.length, kept, asOfD, lagN, failed: failed.length, failedSample: failed.slice(0, 8), list: list.source, listN: list.items.length, bytes, stats, stopped: stop, elapsedMs: Date.now() - t0 };
}
