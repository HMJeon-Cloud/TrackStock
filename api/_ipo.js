// 공모주 수집 (v11.3) — 서버 공용 모듈 (이름이 _로 시작해 Vercel 함수 개수에 안 들어간다)
//
//   데이터 출처는 DART가 먼저다:
//     ① 발견: 공시검색 증권신고서(지분증권, C001) 중 '비상장(E) 회사'가 낸 것 = 신규 상장 공모 (스팩 제외)
//     ② 일정·공모가: 증권신고서 주요정보 API(estkRs) — 청약기일 · 납입기일 · 모집가액 · 모집총액 · 주관사
//     ③ 경쟁률: 그 회사의 발행공시 원문(document.xml, zip)
//          - 정정 증권신고서 / 투자설명서 → 수요예측 경쟁률 · 확정 공모가 · 희망 공모가 밴드 · 의무보유 확약 · 상장 예정일
//          - 증권발행실적보고서 → 일반 청약 경쟁률
//     ④ 상장 뒤 주가: 회사 개황(company.json)의 종목코드 → 야후 일봉 → 상장일 시가·종가, 1개월(20거래일) 수익률
//   저장: Redis sm:ipo (gzip, 기존과 같은 방식) · 공개 읽기 /api/snap?ipo=1
//   실행: 아침 수집 크론 안(남은 시간) · 운영자 수동(/api/channel?op=disc&part=ipo, 화면 버튼이 반복 호출)
import { setJsonGz, getJsonGzText } from "./_redis.js";
import { inflateRawSync } from "zlib";

export const IPO_KEY = "sm:ipo";
const DART = "https://opendart.fss.or.kr/api/";
const DAY = 86400e3;

/* ---------- 공용 ---------- */
function kstYmd(t) { return new Date((t == null ? Date.now() : t) + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ""); }
function ymdAdd(ymd, d) { const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) + d * DAY; return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
function ymdT(ymd) { return Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) - 9 * 3600e3; }
function num(v) { if (v == null) return null; const s = String(v).replace(/,/g, "").trim(); if (!s || s === "-") return null; const n = parseFloat(s); return isFinite(n) ? n : null; }
async function getRes(url, ms) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 9000);
  try { const r = await fetch(url, { signal: ac.signal, headers: { "User-Agent": "Mozilla/5.0 StockMind" } }); if (!r.ok) throw new Error("HTTP " + r.status); return Buffer.from(await r.arrayBuffer()); }
  finally { clearTimeout(tm); }
}
async function getJson(url, ms) { return JSON.parse((await getRes(url, ms)).toString("utf8")); }
async function readDoc(redis) { try { const t = await getJsonGzText(redis, IPO_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }

/* 날짜 글자 → YYYYMMDD 목록 ("2026년 10월 20일 ~ 2026년 10월 21일", "2026.10.20~10.21" 등) */
export function parseDates(s) {
  const out = [], str = String(s || ""); let m, lastY = null, lastM = null;
  const re = /(?:(\d{4})\s*[.\-년\/]\s*)?(\d{1,2})\s*[.\-월\/]\s*(\d{1,2})\s*일?/g;
  while ((m = re.exec(str))) {
    const y = m[1] ? +m[1] : lastY, mo = +m[2], d = +m[3];
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    lastY = y; lastM = mo; out.push(String(y) + String(mo).padStart(2, "0") + String(d).padStart(2, "0"));
  }
  return out;
}

/* ---------- zip(document.xml) 풀기 — 외부 라이브러리 없이 ---------- */
export function unzip(buf) {
  const out = []; let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) return out;
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n && p + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString("utf8");
    try {
      const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), raw = buf.slice(ds, ds + csize);
      const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
      if (data) out.push({ name, data });
    } catch (err) {}
    p += 46 + nl + xl + cl;
  }
  return out;
}
/* DART 원문 XML → 읽을 수 있는 글 (표 칸은 ' | ', 줄은 줄바꿈) */
export function docText(data) {
  let head = data.slice(0, 200).toString("latin1"), enc = /encoding\s*=\s*["'](euc-kr|ks_c_5601[^"']*|cp949)["']/i.test(head) ? "euc-kr" : "utf-8";
  let s; try { s = new TextDecoder(enc).decode(data); } catch (e) { s = data.toString("utf8"); }
  return s.replace(/<\/(TD|TH|TE|TU)>/gi, " | ").replace(/<\/TR>|<BR\s*\/?>|<\/P>|<\/TITLE>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&cr;/gi, "\n")
    .replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n");
}
const R_RATIO = "([\\d,]{1,8}(?:\\.\\d+)?)\\s*(?:대|:)\\s*1(?![\\d.,])";
function ratioOk(v) { return v != null && v >= 1 && v <= 20000; }
/* 수요예측 · 공모가 · 확약 · 상장일 뽑기 (문서 형식이 회사·주관사마다 달라 여러 표현을 차례로 본다) */
export function parseDemand(t) {
  const out = {}; t = String(t || "");
  const cands = [
    new RegExp("수요\\s*예측[^\\n]{0,300}?경쟁률[은는이가]?\\s*(?:약\\s*)?" + R_RATIO),
    new RegExp("수요\\s*예측[^\\n]{0,300}?" + R_RATIO + "\\s*의?\\s*경쟁률"),
    new RegExp("수요\\s*예측\\s*경쟁률[^0-9]{0,40}" + R_RATIO),
  ];
  for (const re of cands) { const m = t.match(re); if (m && ratioOk(num(m[1]))) { out.demand = num(m[1]); break; } }
  if (out.demand == null) {   // 표: '수요예측 결과' 다음 '합계' 줄의 N:1
    const i = t.search(/수요\s*예측\s*(?:결과|참여)/);
    if (i >= 0) { const seg = t.slice(i, i + 6000), j = seg.search(/합\s*계|총\s*계|전\s*체/); if (j >= 0) { const m = seg.slice(j, j + 500).match(new RegExp(R_RATIO)); if (m && ratioOk(num(m[1]))) out.demand = num(m[1]); } }
  }
  let m = t.match(/확정\s*(?:공모|발행)\s*가(?:액|격)?[^0-9\n]{0,60}?([\d,]{3,})\s*원/); if (m) out.price = num(m[1]);
  m = t.match(/(?:희망|예정)\s*공모\s*가(?:액|격)?\s*(?:밴드|범위|구간)?[^0-9\n]{0,40}?([\d,]{3,})\s*원?\s*[~∼～\-]\s*([\d,]{3,})\s*원/); if (m) out.band = [num(m[1]), num(m[2])];
  m = t.match(/의무\s*보유\s*확약[^\n]{0,200}?([\d.]{1,5})\s*%/); if (m && num(m[1]) <= 100) out.lockup = num(m[1]);
  m = t.match(/(?:매매\s*개시|상장)\s*(?:예정)?\s*일[^0-9\n]{0,20}(\d{4}\s*[.\-년]\s*\d{1,2}\s*[.\-월]\s*\d{1,2})/); if (m) { const d = parseDates(m[1])[0]; if (d) out.listPlan = d; }
  return out;
}
export function parseSub(t) {
  t = String(t || "");
  const res = [new RegExp("일반\\s*(?:투자자|청약자)?[^\\n]{0,200}?경쟁률[^0-9\\n]{0,30}" + R_RATIO), new RegExp("청약\\s*경쟁률[^0-9\\n]{0,40}" + R_RATIO), new RegExp("일반\\s*청약[^\\n]{0,200}?" + R_RATIO)];
  for (const re of res) { const m = t.match(re); if (m && ratioOk(num(m[1]))) return num(m[1]); }
  return null;
}

/* ---------- DART 호출 ---------- */
async function dartList(key, q, ms) { return getJson(DART + "list.json?crtfc_key=" + key + "&page_count=100&" + q, ms); }
function rowGet(row, keys, re) { for (const k of keys) if (row[k] != null && String(row[k]).trim() && String(row[k]).trim() !== "-") return row[k]; if (re) for (const k of Object.keys(row)) if (re.test(k) && row[k]) return row[k]; return null; }
/* estkRs: group[{title, list}] → 첫 신고(예정가)와 마지막 정정(확정가)의 숫자 */
export function parseEstk(j) {
  const out = {}; if (!j || j.status !== "000") return out;
  const groups = Array.isArray(j.group) ? j.group : j.list ? [{ title: "일반사항", list: j.list }] : [];
  for (const g of groups) {
    const L = (g.list || []).slice().sort((a, b) => String(a.rcept_no || "").localeCompare(String(b.rcept_no || "")));
    if (!L.length) continue; const first = L[0], last = L[L.length - 1];
    if (/일반/.test(g.title)) { const sbd = parseDates(rowGet(last, ["sbd"], /sbd/)); if (sbd.length) out.sbd = [sbd[0], sbd[sbd.length - 1]]; const py = parseDates(rowGet(last, ["pymd"], /pymd/)); if (py.length) out.pymd = py[0]; }
    if (/증권의\s*종류|증권종류/.test(g.title)) {
      const pick = (r) => r && /보통|주식/.test(String(r.stksen || "")) ? r : r;
      const a = pick(first), b = pick(last);
      out.offer0 = num(rowGet(a, ["slprc"], /prc/)); out.offer = num(rowGet(b, ["slprc"], /prc/)); out.amt = num(rowGet(b, ["slta"], /slta|amt/)); out.shares = num(rowGet(b, ["stkcnt"], /cnt/));
    }
    if (/인수인/.test(g.title)) { const lead = L.filter((r) => /대표|주관/.test(String(r.actsen || ""))).concat(L)[0]; if (lead) out.lead = String(rowGet(lead, ["actnmn"], /nm/) || "").replace(/주식회사|\(주\)|㈜/g, "").trim().slice(0, 30); }
  }
  return out;
}
async function yahoo(sym, fromT, ms) {
  const p1 = Math.floor(fromT / 1000) - 3 * 86400, p2 = Math.floor(Date.now() / 1000) + 86400;
  const j = await getJson("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?period1=" + p1 + "&period2=" + p2 + "&interval=1d", ms);
  const r = j && j.chart && j.chart.result && j.chart.result[0]; if (!r || !r.timestamp) return null;
  const q = r.indicators.quote[0], rows = [];
  r.timestamp.forEach((t, i) => { if (q.close[i] > 0) rows.push({ t: t * 1000, o: q.open[i] || q.close[i], c: q.close[i] }); });
  return rows;
}
/* 상장 후 수익률: 공모가 대비 상장일 시가·종가 · 5일 · 20거래일(1개월) · 60거래일(3개월) · 최근 */
export function returns(rows, price) {
  if (!rows || !rows.length || !price) return null;
  const at = (k) => (rows[k] ? rows[k].c / price - 1 : null);
  return { listDate: kstYmd(rows[0].t), o0: rows[0].o / price - 1, c0: at(0), d5: at(4), m1: at(19), m3: at(59), last: rows[rows.length - 1].c / price - 1, lastDate: kstYmd(rows[rows.length - 1].t), days: rows.length };
}

/* ============================================================ 수집 ============================================================ */
export async function collectIpo(redis, opt) {
  const key = process.env.DART_API_KEY, t0 = Date.now(), budget = opt.budgetMs || 12000, log = { calls: 0, found: 0, info: 0, docs: 0, listed: 0, errors: [] };
  const cap = opt.manual ? 25000 : 9000, left = () => budget - (Date.now() - t0), tmo = () => Math.max(1500, Math.min(cap, left()));
  if (!key) return { ok: false, reason: "NO_DART_KEY", log };
  const prev = (await readDoc(redis)) || { items: [] }, today = kstYmd();
  const by = {}; prev.items.forEach((x) => { by[x.cc] = x; });
  // ① 발견 — 90일 창으로 끊어서 (회사 고유번호 없이 검색하면 3개월까지만 된다), 어디까지 훑었는지 기억
  let scan = prev.scan && !prev.scan.done ? prev.scan : null;
  const back = opt.backfillDays || 0;
  if (!scan) {
    const want = back && !prev.backfilled ? ymdAdd(today, -back) : prev.last ? ymdAdd(prev.last, -3) : ymdAdd(today, -60);
    if (!(prev.scan && prev.scan.done && prev.scan.end === today && !(back && !prev.backfilled))) scan = { from: want, cur: want, end: today, page: 1, done: false, back: !!back };
  }
  while (scan && !scan.done && left() > budget * 0.6) {
    const wEnd = ymdAdd(scan.cur, 89) < scan.end ? ymdAdd(scan.cur, 89) : scan.end;
    let j; try { j = await dartList(key, "bgn_de=" + scan.cur + "&end_de=" + wEnd + "&pblntf_ty=C&pblntf_detail_ty=C001&corp_cls=E&page_no=" + scan.page, tmo()); log.calls++; }
    catch (e) { log.errors.push("발견 " + scan.cur + ": " + (/abort/i.test(e.message) ? "시간 초과" : e.message)); break; }
    if (j.status !== "000" && j.status !== "013") { log.errors.push("발견 status " + j.status + " " + (j.message || "")); if (/^(010|011|012|020|021|800|901)$/.test(j.status)) return { ok: false, reason: "DART_" + j.status, log }; break; }
    (j.list || []).forEach((r) => {
      if (/스팩|기업인수목적|SPAC/i.test(r.corp_name || "")) return;
      if (!/증권신고서/.test(r.report_nm || "") || /채무|파생/.test(r.report_nm || "")) return;
      const x = by[r.corp_code];
      if (x) { if (r.rcept_dt < x.filed) x.filed = r.rcept_dt; return; }
      by[r.corp_code] = { cc: r.corp_code, name: String(r.corp_name || "").replace(/\s+/g, " ").trim(), filed: r.rcept_dt, first: r.rcept_no, stage: "new" }; log.found++;
    });
    if (j.status === "000" && j.total_page && scan.page < j.total_page) scan.page++;
    else { scan.page = 1; if (wEnd >= scan.end) scan.done = true; else scan.cur = ymdAdd(wEnd, 1); }
  }
  // ②~④ 회사별 진행 (가까운 일정부터, 끝난 건 건너뜀) — 4개씩 동시에
  const items = Object.values(by);
  const todo = items.filter((x) => x.stage !== "done" && x.stage !== "drop" && x.at !== today).sort((a, b) => (b.filed || "").localeCompare(a.filed || ""));
  let qi = 0;
  async function step(x) {
    x.at = today; x.tries = (x.tries || 0) + 1;
    if (x.stage === "new" || !x.sbd) {
      const j = await getJson(DART + "estkRs.json?crtfc_key=" + key + "&corp_code=" + x.cc + "&bgn_de=" + ymdAdd(x.filed, -5) + "&end_de=" + today, tmo()); log.calls++;
      const e = parseEstk(j); Object.assign(x, Object.fromEntries(Object.entries(e).filter(([, v]) => v != null)));
      if (x.sbd) { x.stage = "info"; log.info++; } else { if (x.tries >= 4) x.stage = "drop"; return; }
      if (left() < 4000) return;   // 시간이 남으면 같은 회사의 다음 단계까지 이어서
    }
    const sEnd = x.sbd[1] || x.sbd[0];
    // ③ 원문: 청약 시작 2일 전부터(수요예측이 끝난 뒤) 경쟁률을 찾는다 · 청약 끝난 뒤엔 발행실적보고서
    if (today >= ymdAdd(x.sbd[0], -2) && (x.demand == null || (x.sub == null && today > sEnd)) && (x.docTries || 0) < 8 && (!x.docAt || x.docAt < today)) {
      const j = await dartList(key, "corp_code=" + x.cc + "&bgn_de=" + ymdAdd(x.filed, -5) + "&end_de=" + today + "&pblntf_ty=C", tmo()); log.calls++;
      const L = (j.list || []).sort((a, b) => String(b.rcept_no).localeCompare(String(a.rcept_no)));
      const dDoc = L.find((r) => /투자설명서/.test(r.report_nm)) || L.find((r) => /증권신고서/.test(r.report_nm) && /정정|발행조건확정/.test(r.report_nm) && r.rcept_dt >= ymdAdd(x.sbd[0], -10));
      const sDoc = L.find((r) => /증권발행실적보고서/.test(r.report_nm));
      for (const [d, kind] of [[x.demand == null && dDoc, "d"], [x.sub == null && sDoc, "s"]]) {
        if (!d || left() < 4000) continue;
        const buf = await getRes(DART + "document.xml?crtfc_key=" + key + "&rcept_no=" + d.rcept_no, tmo()); log.calls++; log.docs++;
        if (buf[0] !== 0x50 || buf[1] !== 0x4b) { log.errors.push(x.name + ": 원문이 zip이 아님 " + buf.slice(0, 80).toString("utf8").replace(/\s+/g, " ")); continue; }
        const text = unzip(buf).map((f) => docText(f.data)).join("\n");
        if (kind === "d") { const p = parseDemand(text); if (p.demand != null) x.demand = p.demand; if (p.price) x.price = p.price; if (p.band) x.band = p.band; if (p.lockup != null) x.lockup = p.lockup; if (p.listPlan) x.listPlan = p.listPlan; x.dDoc = d.rcept_no; }
        else { const s = parseSub(text); if (s != null) x.sub = s; x.sDoc = d.rcept_no; }
      }
      x.docTries = (x.docTries || 0) + 1; x.docAt = today;
    }
    if (!x.price && x.offer && x.offer0 && x.offer !== x.offer0) x.price = x.offer;   // 정정 신고서의 모집가액 = 확정 공모가
    // ④ 상장: 청약 끝나고 3일 뒤부터 종목코드 → 야후 주가 (1개월 수익률이 생길 때까지, 상장 안 하면 120일 뒤 제외)
    if (today >= ymdAdd(sEnd, 3) && (!x.ret || x.ret.m1 == null || (x.ret.days || 0) < 62) && (!x.pxAt || x.pxAt < today)) {
      if (!x.code) {
        const c = await getJson(DART + "company.json?crtfc_key=" + key + "&corp_code=" + x.cc, tmo()); log.calls++;
        if (c && c.stock_code && /^\d{6}$/.test(String(c.stock_code).trim())) { x.code = String(c.stock_code).trim(); x.mkt = c.corp_cls === "Y" ? "KS" : "KQ"; }
      }
      if (x.code && left() > 2500) {
        const price = x.price || x.offer;
        const rows = await yahoo(x.code + "." + x.mkt, ymdT(sEnd), tmo()).catch(() => null); log.calls++;
        if (rows && rows.length && price) { const r = returns(rows.filter((r) => kstYmd(r.t) > sEnd), price); if (r) { x.ret = r; x.sym = x.code + "." + x.mkt; log.listed++; } }
      }
      x.pxAt = today;
      if (!x.code && today > ymdAdd(sEnd, 120)) x.stage = "drop";
    }
    if (x.ret && x.ret.days >= 62 && (x.sub != null || (x.docTries || 0) >= 8)) x.stage = "done";
  }
  async function worker() {
    while (qi < todo.length && left() > 3000) {
      const x = todo[qi++];
      try { await step(x); } catch (e) { log.errors.push(x.name + ": " + (/abort/i.test(e.message) ? "시간 초과" : String(e.message).slice(0, 100))); }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  const keep = ymdAdd(today, -1100);   // 3년치 보관
  const out = items.filter((x) => x.filed >= keep).sort((a, b) => ((b.sbd && b.sbd[0]) || b.filed).localeCompare((a.sbd && a.sbd[0]) || a.filed));
  const remain = out.filter((x) => x.stage !== "done" && x.stage !== "drop" && x.at !== today).length;   // 오늘 아직 손 안 댄 회사
  const doc = { updated: new Date().toISOString(), last: scan ? (scan.done ? scan.end : prev.last || null) : prev.last || today, scan: scan ? (scan.done ? { done: true, end: scan.end } : scan) : prev.scan, backfilled: prev.backfilled || !!(scan && scan.done && scan.back), n: out.length, items: out, log: { at: new Date().toISOString(), ...log, ms: Date.now() - t0 } };
  await setJsonGz(redis, IPO_KEY, doc, 1200 * 86400);
  const scanDone = !scan || scan.done;
  return { ok: true, found: log.found, total: out.length, remain, done: scanDone && remain === 0, progress: scanDone ? "목록 완료" : "목록 " + scan.cur.slice(0, 4) + "." + scan.cur.slice(4, 6) + "까지", log: doc.log };
}
