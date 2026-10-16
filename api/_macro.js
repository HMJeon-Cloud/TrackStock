// 매크로 지표 수집 (v11.4) — 서버 공용 모듈 (이름이 _로 시작해 Vercel 함수 개수에 안 들어간다)
//
//   한국은행 ECOS (ECOS_API_KEY 필요 · 무료 발급)
//     · krw  원/달러 환율 (매매기준율, 일별)      731Y001 / 0000001
//     · bok  한국은행 기준금리 (일별 → 바뀐 날만) 722Y001 / 0101000
//   미국 FRED (FRED_API_KEY 있으면 API, 없으면 공개 CSV)
//     · fed   미 기준금리 (목표 상단, 2008.12 이전은 단일 목표) DFEDTAR + DFEDTARU → 바뀐 날만
//     · us10y 미 국채 10년 금리 (일별) DGS10
//     · m2    미 M2 통화량 (월별, 10억 달러) M2SL
//   저장: Redis sm:macro (gzip, 기존 스냅샷과 같은 방식) · 공개 읽기 /api/snap?macro=1
//   실행: 아침 수집 크론 안에서 하루 한 번(지표마다 오늘 받았으면 건너뜀) · 운영자 수동(/api/channel?op=disc&part=macro)
//   처음엔 1995년부터 전부, 그 뒤로는 최근 60일(M2는 2년)만 받아 덮어쓴다 — 크론 개수·함수 개수 그대로
import { setJsonGz, getJsonGzText } from "./_redis.js";

export const MACRO_KEY = "sm:macro";
const ECOS = "https://ecos.bok.or.kr/api/StatisticSearch/";
const FRED_API = "https://api.stlouisfed.org/fred/series/observations";
const FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const START = "19950101";
const DAY = 86400e3;

export const MACRO_DEF = {
  krw: { n: "원/달러 환율", u: "원", f: "D", src: "한국은행 ECOS" },
  bok: { n: "한국 기준금리", u: "%", f: "S", src: "한국은행 ECOS" },
  fed: { n: "미국 기준금리(상단)", u: "%", f: "S", src: "FRED" },
  us10y: { n: "미 국채 10년 금리", u: "%", f: "D", src: "FRED" },
  m2: { n: "미국 M2 통화량", u: "십억 달러", f: "M", src: "FRED" },
};

function kstYmd(t) { return new Date((t == null ? Date.now() : t) + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ""); }
function ymdAdd(ymd, d) { const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) + d * DAY; return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
function num(v) { if (v == null) return null; const s = String(v).replace(/,/g, "").trim(); if (!s || s === "." || s === "-") return null; const n = parseFloat(s); return isFinite(n) ? n : null; }
async function getText(url, ms) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 9000);
  try { const r = await fetch(url, { signal: ac.signal, headers: { "User-Agent": "Mozilla/5.0 StockMind" } }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); }
  finally { clearTimeout(tm); }
}

/* ---------- ECOS: 한 번에 최대 10,000줄 → 기간을 나눠서 ---------- */
export function parseEcos(j) {
  if (!j) return { rows: [], err: "빈 응답" };
  if (j.RESULT && !j.StatisticSearch) return { rows: [], err: j.RESULT.CODE === "INFO-200" ? null : (j.RESULT.CODE + " " + (j.RESULT.MESSAGE || "")) };
  const R = (j.StatisticSearch && j.StatisticSearch.row) || [];
  const ymd = (t) => { t = String(t || ""); return t.length === 6 ? t + "01" : t.slice(0, 8); };   // 월별(YYYYMM)이면 1일로
  return { rows: R.map((r) => [ymd(r.TIME), num(r.DATA_VALUE)]).filter((r) => r[0].length === 8 && r[1] != null) };
}
async function ecos(key, stat, cycle, item, from, to, ms) {
  const out = []; let a = from;
  while (a <= to) {
    const b = a.length !== 8 ? to : ymdAdd(a, 365 * 12) < to ? ymdAdd(a, 365 * 12) : to;   // 12년 ≈ 3,000 영업일 (월별은 한 번에)
    const url = ECOS + encodeURIComponent(key) + "/json/kr/1/10000/" + stat + "/" + cycle + "/" + a + "/" + b + "/" + item;
    const p = parseEcos(JSON.parse(await getText(url, ms)));
    if (p.err) throw new Error("ECOS " + stat + ": " + p.err);
    out.push(...p.rows); if (a.length !== 8) break; a = ymdAdd(b, 1);
  }
  return out;
}

/* ---------- FRED: 키가 있으면 API(JSON), 없으면 공개 CSV ---------- */
export function parseFredCsv(t) {
  return String(t || "").split(/\r?\n/).slice(1).map((l) => l.split(",")).filter((p) => /^\d{4}-\d\d-\d\d$/.test(p[0])).map((p) => [p[0].replace(/-/g, ""), num(p[1])]).filter((r) => r[1] != null);
}
async function fred(id, from, ms) {
  const k = process.env.FRED_API_KEY, d = from.slice(0, 4) + "-" + from.slice(4, 6) + "-" + from.slice(6, 8);
  if (k) {
    const j = JSON.parse(await getText(FRED_API + "?series_id=" + id + "&api_key=" + encodeURIComponent(k) + "&file_type=json&observation_start=" + d, ms));
    if (j.error_message) throw new Error("FRED " + id + ": " + j.error_message);
    return (j.observations || []).map((o) => [String(o.date).replace(/-/g, ""), num(o.value)]).filter((r) => r[1] != null);
  }
  return parseFredCsv(await getText(FRED_CSV + "?id=" + id + "&cosd=" + d, ms));
}

/* 계단 지표(기준금리)는 바뀐 날만 남긴다 */
export function steps(rows) { const out = []; rows.forEach((r) => { if (!out.length || out[out.length - 1][1] !== r[1]) out.push(r); }); return out; }
/* 기존 + 새로 받은 것: 새 값의 첫 날짜부터 갈아끼운다 */
export function merge(old, add) {
  if (!add.length) return old || [];
  const cut = add[0][0], keep = (old || []).filter((r) => r[0] < cut);
  return keep.concat(add);
}

const JOBS = {
  krw: (ctx, from) => ecos(ctx.key, "731Y001", "D", "0000001", from, ctx.today, ctx.tmo()),
  bok: async (ctx, from) => {
    const a = from < "19990506" ? "19990506" : from;
    try { return steps(await ecos(ctx.key, "722Y001", "D", "0101000", a, ctx.today, ctx.tmo())); }
    catch (e) { return steps(await ecos(ctx.key, "722Y001", "M", "0101000", a.slice(0, 6), ctx.today.slice(0, 6), ctx.tmo())); }   // 일별이 안 되면 월별
  },
  fed: async (ctx, from) => {
    const a = from < "20081216" ? await fred("DFEDTAR", from, ctx.tmo()) : [];
    const b = await fred("DFEDTARU", from < "20081216" ? "20081216" : from, ctx.tmo());
    return steps(a.filter((r) => r[0] < "20081216").concat(b));
  },
  us10y: (ctx, from) => fred("DGS10", from, ctx.tmo()),
  m2: (ctx, from) => fred("M2SL", from, ctx.tmo()),
};

export async function collectMacro(redis, opt) {
  opt = opt || {};
  const t0 = Date.now(), budget = opt.budgetMs || 12000, left = () => budget - (Date.now() - t0), tmo = () => Math.max(2000, Math.min(opt.manual ? 20000 : 9000, left()));
  const key = process.env.ECOS_API_KEY, today = kstYmd(), log = { calls: 0, got: {}, errors: [] };
  let prev = null; try { const t = await getJsonGzText(redis, MACRO_KEY); prev = t ? JSON.parse(t) : null; } catch (e) {}
  prev = prev || { series: {} };
  const S = prev.series || {}, ctx = { key, today, tmo };
  const ids = Object.keys(JOBS).filter((id) => opt.force || !S[id] || S[id].at !== today);
  if (!ids.length) return { ok: true, skipped: "오늘 이미 받음", n: Object.keys(S).length };
  await Promise.all(ids.map(async (id) => {
    if ((id === "krw" || id === "bok") && !key) { log.errors.push(MACRO_DEF[id].n + ": ECOS_API_KEY 없음"); return; }
    const old = S[id] && S[id].d && S[id].d.length ? S[id].d : null;
    const from = !old || opt.full ? START : id === "m2" ? ymdAdd(today, -730) : MACRO_DEF[id].f === "S" ? ymdAdd(old[old.length - 1][0], -10) : ymdAdd(today, -60);
    try {
      if (left() < 1500) throw new Error("시간 부족");
      const rows = await JOBS[id](ctx, from); log.calls++;
      let d = old ? merge(old, rows) : rows;
      if (MACRO_DEF[id].f === "S") d = steps(d);
      if (!d.length) throw new Error("값 없음");
      S[id] = Object.assign({}, MACRO_DEF[id], { at: today, last: d[d.length - 1], d });
      log.got[id] = rows.length;
    } catch (e) { log.errors.push(MACRO_DEF[id].n + ": " + (/abort/i.test(e.message) ? "시간 초과" : String(e.message).slice(0, 120))); }
  }));
  const doc = { ver: 1, updated: new Date().toISOString(), series: S, log: Object.assign({ at: new Date().toISOString(), ms: Date.now() - t0 }, log) };
  await setJsonGz(redis, MACRO_KEY, doc);
  return { ok: log.errors.length < ids.length, got: log.got, errors: log.errors, n: Object.keys(S).length, ms: Date.now() - t0 };
}
