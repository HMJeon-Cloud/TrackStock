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
import { reqIsOwner } from "./_owner.js";
import { redisConf, redisCmd, setJsonGz, getJsonGzText, KEY, kst } from "./_redis.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CONCURRENCY = 6;
const RECENT_CONCURRENCY = 10;   // v9.3: 코인 76개 추가로 종목이 ~310개 → 최근 구간은 10개씩 동시에
const TIME_BUDGET_MS = 52000;     // 함수 최대 60초 안에서 저장까지 끝나도록 여유를 둔다
const RECENT_BUDGET_MS = 38000;   // ① 최근 구간(가장 중요)에 먼저 쓰는 시간
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
  const alias = {}; pairs.forEach((p) => { if (/-USD$/.test(p[0])) alias[p[0]] = p[2] || ""; });
  return { list: Array.from(new Set(pairs.map((p) => p[0]))), source, alias };
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
  // v9.4: 1 미만 가격은 유효숫자 6자리로 (예전엔 소수 4자리로 잘라 시바이누·페페·봉크 같은 코인이 0이 되는 오류가 있었다)
  const rnd = (x) => { if (!isFinite(x)) return x; return Math.abs(x) >= 1 ? Math.round(x * 10000) / 10000 : Number(x.toPrecision(6)); };
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
  // v9.4: 아직 끝나지 않은 오늘 봉(장중·코인 진행 중인 UTC 하루)은 뺀다 → '종가'만 남긴다
  //   야후 meta.currentTradingPeriod.regular {start,end}: 지금이 end 전이고 마지막 봉이 start 이후면 진행 중인 봉
  let dropped = 0;
  const nowS = Math.floor(Date.now() / 1000), ctp = r.meta && r.meta.currentTradingPeriod && r.meta.currentTradingPeriod.regular;
  const coin = /-USD$/.test(symbol), utc0 = Math.floor(nowS / 86400) * 86400;
  // v9.4.1 코인: 야후는 UTC 자정 직후 '어제' 일봉을 아직 어제 날짜(00:00)로 내주지 않고, 마지막 거래 시각(오늘 00:xx)으로 찍어 보내는 때가 있다.
  //   그걸 '오늘 진행 중인 봉'으로 보고 버리면 어제(=한국 오전 9시 마감) 하루가 통째로 빠져 이틀 전 값이 최신이 된다 (10/7 09:08 실제 발생).
  //   → 어제 봉이 없고 오늘 날짜로 찍힌 봉이 있으면, 그 봉을 어제 종가로 다시 찍는다(자정 직후 몇 분의 가격 차이는 다음 수집 때 확정값으로 교체).
  let restamped = 0;
  const y0 = utc0 - 86400;
  while (t.length > 1) {
    const lt = t[t.length - 1];
    const live = coin ? lt >= utc0 : !!(ctp && ctp.start && ctp.end && nowS < ctp.end && lt >= ctp.start - 3600);
    if (!live) break;
    if (coin && t[t.length - 2] < y0) { t[t.length - 1] = y0; restamped = 1; break; }
    [t, o, h, l, c, a, v].forEach((arr) => arr.pop()); dropped++;
  }
  const meta = {};
  if (dropped) meta.droppedLive = dropped;
  if (restamped) meta.provisional = 1;
  if (r.meta) {
    for (const k of ["currency", "shortName", "longName", "exchangeName", "fullExchangeName",
                     "firstTradeDate", "fiftyTwoWeekHigh", "fiftyTwoWeekLow"]) {
      if (r.meta[k] != null) meta[k] = r.meta[k];
    }
  }
  return { s: symbol, meta, t, o, h, l, c, a, v, div, updated: new Date().toISOString().slice(0, 10) };
}

/* ---------- 데이터 점검 (v9.4) — ?audit=1 : 저장된 과거 전체 + 최근 1년을 여러 방법으로 교차 검증 ----------
   ① 날짜 순서·중복  ② 0·음수·비정상 값  ③ 정밀도(1 미만 가격이 0으로 뭉개졌나)  ④ 하루 급변(되돌림=오류, 지속=분할 미반영 의심, 수정종가로는 매끈하면 정상)
   ⑤ 빈 기간(주식 10일·코인 3일 넘게 비었나)  ⑥ 과거 파일 ↔ 최근 파일 같은 날 종가 비교(1% 넘게 다르면)  ⑦ 야후 52주 고점 ↔ 직접 계산 비교
   ⑧ 마지막 날짜가 오래됐나  ⑨ 과거 길이(1년 미만)  ⑩ 수정종가/종가 비율이 갑자기 튀나(배당·분할 반영 오류)
   결과는 종목별 문제 목록 + 요약. 데이터를 고치지는 않는다(어디가 이상한지 알려 주기만). */
function auditSeries(sym, snap, rec) {
  const out = [], t = snap.t || [], c = snap.c || [], a = snap.a || [], n = c.length, coin = /-USD$/.test(sym), idx = /^\^|=X$|=F$/.test(sym);
  if (n < 2) return [["short", "데이터 " + n + "개"]];
  let unsorted = 0, dup = 0, bad = 0, gaps = 0, maxGap = 0;
  for (let i = 1; i < n; i++) { if (t[i] < t[i - 1]) unsorted++; if (t[i] === t[i - 1]) dup++; const g = (t[i] - t[i - 1]) / 86400; if (g > (coin ? 3 : 10)) { gaps++; if (g > maxGap) maxGap = g; } }
  for (let i = 0; i < n; i++) if (!(c[i] > 0) || !isFinite(c[i])) bad++;
  if (unsorted) out.push(["order", "날짜 순서가 뒤바뀐 곳 " + unsorted]);
  if (dup) out.push(["dup", "같은 날짜 중복 " + dup]);
  if (bad) out.push(["value", "0·음수·비정상 종가 " + bad + "개"]);
  if (gaps) out.push(["gap", "빈 기간 " + gaps + "곳 (최장 " + Math.round(maxGap) + "일)"]);
  // ③ 정밀도: 최근 60개 중 서로 다른 값이 너무 적고 가격이 1 미만이면 반올림으로 뭉개진 것
  const last60 = c.slice(-60), uniq = new Set(last60).size;
  if (c[n - 1] < 1 && uniq < 15) out.push(["precision", "1 미만 가격인데 최근 60일 서로 다른 값이 " + uniq + "개뿐 — 소수점 잘림 의심"]);
  // ④ 급변: 하루 ±40%(코인 ±60%) 넘는 날
  const lim = coin ? 0.6 : idx ? 0.15 : 0.4; let revert = 0, persist = 0, splitOk = 0; const days = [];
  for (let i = 1; i < n; i++) {
    const r = c[i] / c[i - 1] - 1; if (!(Math.abs(r) > lim)) continue;
    const ra = a.length === n && a[i - 1] > 0 ? a[i] / a[i - 1] - 1 : r;
    const nx = i + 1 < n ? c[i + 1] / c[i] - 1 : 0;
    if (Math.abs(ra) <= lim / 2) splitOk++;                                   // 수정종가는 매끈 → 분할이 수정종가에 반영됨(정상)
    else if (Math.sign(nx) === -Math.sign(r) && Math.abs(nx) > lim / 2) { revert++; i++; }  // 다음 날 되돌아옴 → 오류 값 (되돌아온 날은 건너뜀)
    else { persist++; if (days.length < 3) days.push(new Date(t[i] * 1000).toISOString().slice(0, 10) + " " + (r * 100).toFixed(0) + "%"); }
  }
  if (revert) out.push(["spike", "하루 튀었다 되돌아온 날 " + revert + "번 (오류 값 의심)"]);
  if (persist) out.push(["jump", "하루 " + Math.round(lim * 100) + "% 넘게 움직이고 유지된 날 " + persist + "번 (" + days.join(", ") + ") — 실제 급변인지 분할 미반영인지 확인"]);
  if (splitOk) out.push(["split-ok", "분할로 보이는 날 " + splitOk + "번 — 수정종가에 반영돼 정상"]);
  // ⑩ 수정종가 비율 급변
  if (a.length === n) { let jumps = 0; for (let i = 1; i < n; i++) { const p0 = a[i - 1] / c[i - 1], p1 = a[i] / c[i]; if (p0 > 0 && Math.abs(p1 / p0 - 1) > 0.25) jumps++; } if (jumps > 2) out.push(["adj", "수정종가/종가 비율이 25% 넘게 바뀐 날 " + jumps + "번"]); }
  // ⑥ 과거 ↔ 최근 같은 날 비교
  if (rec && rec.t && rec.c) {
    const m = new Map(); for (let i = 0; i < n; i++) m.set(t[i], c[i]);
    let cmp = 0, diff = 0, worst = 0;
    for (let i = 0; i < rec.t.length; i++) { const v = m.get(rec.t[i]); if (v == null) continue; cmp++; const d = Math.abs(rec.c[i] / v - 1); if (d > 0.01) { diff++; if (d > worst) worst = d; } }
    if (cmp >= 20 && diff > 2) out.push(["mismatch", "과거 파일과 최근 파일의 같은 날 종가가 1% 넘게 다른 날 " + diff + "/" + cmp + " (최대 " + (worst * 100).toFixed(0) + "%)"]);
    if (cmp === 0 && rec.t.length && t.length) out.push(["nooverlap", "과거 파일과 최근 파일이 겹치는 날이 없음"]);
  }
  // ⑦ 52주 고점 비교 (최근 파일 기준)
  const src = rec && rec.c && rec.c.length > 200 ? rec : null;
  if (src && src.meta && src.meta.fiftyTwoWeekHigh > 0) { const hi = Math.max(...src.c.slice(-252)); const d = hi / src.meta.fiftyTwoWeekHigh - 1; if (Math.abs(d) > 0.08) out.push(["hi52", "야후 52주 고점 " + src.meta.fiftyTwoWeekHigh + " vs 직접 계산(종가) " + hi + " — " + (d * 100).toFixed(0) + "% 차이"]); }
  // ⑧ ⑨
  const lastT = (rec && rec.t && rec.t.length ? rec.t[rec.t.length - 1] : t[n - 1]), age = (Date.now() / 1000 - lastT) / 86400;
  if (age > (coin ? 2 : 5)) out.push(["stale", "마지막 데이터가 " + Math.round(age) + "일 전"]);
  const yrs = (t[n - 1] - t[0]) / (365.25 * 86400); if (yrs < 1) out.push(["short", "과거 데이터 " + yrs.toFixed(1) + "년치"]);
  return out;
}
async function runAudit(redis, res) {
  const t0 = Date.now(); let recent = null, manifest = null;
  try { const x = await getJsonGzText(redis, KEY.recent); if (x) recent = JSON.parse(x); } catch (e) {}
  try { const x = await getJsonGzText(redis, KEY.manifest); if (x) manifest = JSON.parse(x); } catch (e) {}
  const syms = Object.keys((manifest && manifest.symbols) || (recent && recent.symbols) || {});
  const report = {}, count = {}; let checked = 0, missingHist = [];
  for (let i = 0; i < syms.length; i += 12) {
    if (Date.now() - t0 > 50000) break;
    await Promise.all(syms.slice(i, i + 12).map(async (sym) => {
      let snap = null; try { const x = await getJsonGzText(redis, KEY.chart(sym)); if (x) snap = JSON.parse(x); } catch (e) {}
      const rec = recent && recent.symbols && recent.symbols[sym];
      if (!snap) { missingHist.push(sym); if (!rec) return; snap = rec; }
      const iss = auditSeries(sym, snap, rec !== snap ? rec : null); checked++;
      const real = iss.filter((x) => x[0] !== "split-ok");
      if (iss.length) report[sym] = iss.map((x) => x[0] + ": " + x[1]);
      real.forEach((x) => { count[x[0]] = (count[x[0]] || 0) + 1; });
    }));
  }
  const serious = Object.keys(report).filter((s) => report[s].some((x) => /^(value|order|dup|spike|precision|mismatch|stale|adj)/.test(x)));
  return res.status(200).json({ at: kst(), checked, total: syms.length, elapsedMs: Date.now() - t0, summary: count, serious, missingHistory: missingHist.slice(0, 50), recentFlags: (recent && recent.flags) || {}, report,
    guide: "serious = 바로 확인할 종목. jump(유지된 급변)는 실제 사건(실적·상장폐지·액면분할 미반영)일 수 있어 차트로 확인. split-ok는 정상. 고치려면 해당 종목의 과거 파일을 다시 받으세요(같은 주소에 &force=1)." });
}

export default async function handler(req, res) {
  const started = Date.now();
  const ownerOk = req.query.audit === "1" && reqIsOwner(req);   // 데이터 점검은 운영자 토큰으로도 실행 가능 (수집은 CRON_SECRET만)
  if (process.env.CRON_SECRET && !ownerOk) {
    const auth = req.headers.authorization || "";
    const key = req.query.key || "";
    if (auth !== "Bearer " + process.env.CRON_SECRET && key !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }
  if (req.query.audit === "1") { const rc = redisConf(); if (!rc) return res.status(500).json({ error: "Redis 없음" }); return runAudit(rc, res); }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = proto + "://" + req.headers.host;
  const today = new Date().toISOString().slice(0, 10);
  const force = req.query.force === "1";
  const redis = redisConf();
  if (!redis) {
    return res.status(500).json({ error: "Redis가 연결되지 않았습니다 (KV_REST_API_URL / KV_REST_API_TOKEN 필요)." });
  }

  // 종목 목록이 이상하면(로그인 페이지 등) 데이터를 하나도 건드리지 않고 멈추고, 이유를 실행 기록에 남긴다
  let symbols, symSource, coinAlias = {};
  try {
    const r = await loadSymbols(origin);
    symbols = r.list; symSource = r.source; coinAlias = r.alias || {};
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
  // 오래 못 받은 종목부터 (시간이 모자라 끝까지 못 가도 매번 같은 종목만 빠지지 않게)
  // v9.4.1: UTC 0~2시(한국 9~11시) 수집은 코인 일봉이 막 마감된 때라 코인부터 받는다 (시간이 모자라도 코인은 빠지지 않게)
  const coinFirst = new Date().getUTCHours() < 3;
  const order = symbols.slice().sort((x, y) => {
    if (coinFirst) { const cx = /-USD$/.test(x) ? 0 : 1, cy = /-USD$/.test(y) ? 0 : 1; if (cx !== cy) return cx - cy; }
    const a = (entries[x] && entries[x].recentAt) || "", b = (entries[y] && entries[y].recentAt) || ""; return a < b ? -1 : a > b ? 1 : 0; });
  for (let i = 0; i < order.length; i += RECENT_CONCURRENCY) {
    if (Date.now() - started > RECENT_BUDGET_MS) break;
    await Promise.all(order.slice(i, i + RECENT_CONCURRENCY).map(async (sym) => {
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
        // 코인: 받은 데이터의 이름이 우리가 적어 둔 영어 이름과 하나도 안 겹치면(심볼이 다른 코인으로 바뀐 경우) 쓰지 않는다
        if (coinAlias[sym] && s.meta) {
          const nm = String((s.meta.longName || "") + " " + (s.meta.shortName || "")).toLowerCase(), words = coinAlias[sym].toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && /[a-z]/.test(w));
          const nw = nm.split(/[^a-z0-9.]+/).filter(Boolean);
          if (nm.trim() && words.length && !words.some((w) => nw.some((x) => x === w || (w.length >= 4 && x.indexOf(w) === 0)))) { recent.flags[sym] = "name(" + nm.trim().slice(0, 30) + ")"; flagged++; return; }
        }
        if (flags.length) recent.flags[sym] = flags.join(",");
        // 배당·분할이 없어 수정종가가 종가와 같으면 a는 빼서 크기를 줄인다 (화면에서 c로 채움)
        if (s.a && s.a.every((x, k) => x === s.c[k])) s.a = undefined;
        // 이전 스냅샷과 같은 날짜의 종가가 1% 넘게 다르면(수정 데이터) 표시
        if (prev && prev.t && prev.t.length) { const lt = prev.t[prev.t.length - 1], j = s.t.indexOf(lt); if (j >= 0 && Math.abs(s.c[j] / prev.c[prev.c.length - 1] - 1) > 0.01) recent.flags[sym] = (recent.flags[sym] ? recent.flags[sym] + "," : "") + "revised"; }
        recent.symbols[sym] = { t: s.t, o: s.o, h: s.h, l: s.l, c: s.c, v: s.v, div: s.div, meta: s.meta };
        if (s.a) recent.symbols[sym].a = s.a;
        entries[sym] = { ...(entries[sym] || {}), recentAt: new Date().toISOString() };
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
