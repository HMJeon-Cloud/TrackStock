// 공시 · 구루 수집 (v11.2) — 서버 공용 모듈 (파일 이름이 _로 시작해 Vercel 함수 개수에 들어가지 않는다)
//
//   ① DART OpenAPI: 등록된 국내 종목의 임원·주요주주 지분 변동(D002) · 5% 대량보유(D001) · 자사주 취득/처분/소각(B001 주요사항보고)
//      - 공시검색(list.json)을 날짜로 훑어 '우리 종목 코드'만 고르고, 새 공시만 상세 API로 숫자를 채운다
//      - 필요: Vercel 환경변수 DART_API_KEY (opendart.fss.or.kr 무료 인증키 · 하루 2만 회)
//   ② SEC EDGAR 13F: 주요 투자자 분기 보유 → 직전 분기와 비교해 새로 산·더 산·줄인·다 판 종목
//      - 새 13F가 올라온 투자자만 정보표(XML) 2개를 받는다 (분기마다 한 번)
//      - 권장: 환경변수 SEC_UA = "StockMind 본인이메일" (SEC가 요청자 연락처를 요구)
//
//   저장(Redis, 기존 스냅샷과 같은 gzip+base64): sm:disc · sm:guru · sm:sec:tick(티커 대조표, 30일)
//   실행: 아침 수집 크론(cron-snapshot) 끝에서 남은 시간으로 · 운영자 수동(/api/channel?op=disc&run=1)
import { setJsonGz, getJsonGzText } from "./_redis.js";

export const DISC_KEY = { disc: "sm:disc", guru: "sm:guru", tick: "sm:sec:tick" };
const DART = "https://opendart.fss.or.kr/api/";
const KEEP_DAYS = 120, MAX_ITEMS = 800;

export const GURUS = [
  { id: "berkshire", cik: "1067983", nm: "워런 버핏", org: "버크셔 해서웨이" },
  { id: "pershing", cik: "1336528", nm: "빌 애크먼", org: "퍼싱 스퀘어" },
  { id: "duquesne", cik: "1536411", nm: "스탠리 드러켄밀러", org: "듀케인 패밀리오피스" },
  { id: "appaloosa", cik: "1656456", nm: "데이비드 테퍼", org: "아팔루사" },
  { id: "himalaya", cik: "1709323", nm: "리루", org: "히말라야 캐피털" },
  { id: "baupost", cik: "1061768", nm: "세스 클라만", org: "바우포스트" },
  { id: "soros", cik: "1029160", nm: "조지 소로스", org: "소로스 펀드" },
  { id: "bridgewater", cik: "1350694", nm: "레이 달리오", org: "브리지워터" },
  { id: "thirdpoint", cik: "1040273", nm: "댄 로브", org: "서드 포인트" },
  { id: "tiger", cik: "1167483", nm: "체이스 콜먼", org: "타이거 글로벌" },
  { id: "ark", cik: "1697748", nm: "캐시 우드", org: "ARK 인베스트" },
];

/* ---------- 공용 ---------- */
function kstYmd(t) { return new Date((t == null ? Date.now() : t) + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ""); }
function ymdAdd(ymd, days) { const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) + days * 86400e3; return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
function digits(s) { return String(s || "").replace(/\D/g, ""); }
export function num(v) { if (v == null) return null; const s = String(v).replace(/,/g, "").trim(); if (!s || s === "-") return null; const n = parseFloat(s); return isFinite(n) ? n : null; }
/* 실패하면 응답 본문 앞부분을 오류에 붙인다 (SEC 403 같은 거절 사유 확인용) */
async function httpErr(r) { let b = ""; try { b = (await r.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140); } catch (e) {} return new Error("HTTP " + r.status + (b ? " — " + b : "")); }
async function getJson(url, ms, headers) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 8000);
  try { const r = await fetch(url, { signal: ac.signal, headers: headers || {} }); if (!r.ok) throw await httpErr(r); return await r.json(); }
  finally { clearTimeout(tm); }
}
async function getText(url, ms, headers) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 10000);
  try { const r = await fetch(url, { signal: ac.signal, headers: headers || {} }); if (!r.ok) throw await httpErr(r); return await r.text(); }
  finally { clearTimeout(tm); }
}
async function readDoc(redis, key) { try { const t = await getJsonGzText(redis, key); return t ? JSON.parse(t) : null; } catch (e) { return null; } }

/* ============================================================ ① DART ============================================================ */
function kindOf(detail, title) {
  if (detail === "D002") return "insider";
  if (detail === "D001") return "major";
  if (/자기주식\s*취득\s*신탁/.test(title)) return "trust";
  if (/자기주식\s*취득/.test(title)) return "buyback";
  if (/자기주식\s*처분/.test(title)) return "dispose";
  if (/소각/.test(title)) return "cancel";
  return null;
}
async function dartList(key, detail, bgn, end, page, ms) {
  const u = DART + "list.json?crtfc_key=" + key + "&bgn_de=" + bgn + "&end_de=" + end + "&pblntf_ty=" + detail[0] + "&pblntf_detail_ty=" + detail + "&page_no=" + page + "&page_count=100&sort=date&sort_mth=desc";
  return getJson(u, ms || 9000);
}
/* 상세: 회사 단위 API에서 해당 접수번호 줄을 찾는다 */
async function dartDetail(key, it, bgn, end, ms) {
  const base = "crtfc_key=" + key + "&corp_code=" + it.cc;
  let path = null, extra = "";
  if (it.k === "insider") path = "elestock.json";
  else if (it.k === "major") path = "majorstock.json";
  else if (it.k === "buyback") { path = "tsstkAqDecsn.json"; extra = "&bgn_de=" + bgn + "&end_de=" + end; }
  else if (it.k === "trust") { path = "tsstkAqTrctrCnsDecsn.json"; extra = "&bgn_de=" + bgn + "&end_de=" + end; }
  else if (it.k === "dispose") { path = "tsstkDpDecsn.json"; extra = "&bgn_de=" + bgn + "&end_de=" + end; }
  if (!path) return null;
  const j = await getJson(DART + path + "?" + base + extra, ms || 9000);
  if (!j || j.status !== "000" || !Array.isArray(j.list)) return { list: [], status: j && j.status };
  return { list: j.list, status: "000" };
}
function fillDetail(it, row) {
  if (!row) return it;
  if (it.k === "insider") {
    it.who = row.repror || it.who; it.pos = [row.isu_exctv_ofcps, row.isu_main_shrholdr].filter((x) => x && x !== "-").join(" · ");
    it.chg = num(row.sp_stock_lmp_irds_cnt); it.after = num(row.sp_stock_lmp_cnt); it.rate = num(row.sp_stock_lmp_rate); it.rateChg = num(row.sp_stock_lmp_irds_rate);
  } else if (it.k === "major") {
    it.who = row.repror || it.who; it.chg = num(row.stkqy_irds); it.after = num(row.stkqy); it.rate = num(row.stkrt); it.rateChg = num(row.stkrt_irds); it.reason = row.report_resn || ""; it.rtp = row.report_tp || "";
  } else if (it.k === "buyback" || it.k === "trust" || it.k === "dispose") {
    const q = (num(row.aqpln_stk_ostk) || 0) + (num(row.aqpln_stk_estk) || 0) + (num(row.dppln_stk_ostk) || 0) + (num(row.dppln_stk_estk) || 0);
    const a = (num(row.aqpln_prc_ostk) || 0) + (num(row.aqpln_prc_estk) || 0) + (num(row.ctr_prc) || 0) + (num(row.dppln_prc_ostk) || 0) + (num(row.dppln_prc_estk) || 0);
    it.qty = q || null; it.amt = a || null;
    const b = row.aqexpd_bgd || row.ctr_pd_bgd || row.dpprpd_bgd, e = row.aqexpd_edd || row.ctr_pd_edd || row.dpprpd_edd;
    if (b || e) it.period = (b || "") + " ~ " + (e || "");
    it.purpose = row.aq_pp || row.ctr_pp || row.dp_pp || ""; it.method = row.aq_mth || row.dp_mth || "";
  }
  it.ok = true;
  return it;
}

export async function collectDart(redis, opt) {
  // v11.2.2 이어 받기: 한국 서버(DART)가 해외(Vercel)에서 느려서 30일치를 한 번에 못 받는다
  //   → 어디까지 받았는지(scan: 유형별 다음 쪽)를 저장해 두고, 다음 호출(수동 버튼 반복·다음 날 크론)이 이어서 받는다
  //   · 목록은 4쪽씩 동시에 · 상세는 3개씩 동시에 · 상세 대기 시간은 수동 25초 / 크론 9초
  const key = process.env.DART_API_KEY;
  const t0 = Date.now(), budget = opt.budgetMs || 12000, log = { calls: 0, pages: 0, found: 0, filled: 0, errors: [] };
  const cap = opt.manual ? 25000 : 9000;
  const left = () => budget - (Date.now() - t0);
  const tmo = () => Math.max(1500, Math.min(cap, left()));
  if (!key) return { ok: false, reason: "NO_DART_KEY", log };
  const krMap = {};   // 6자리 종목코드 → 심볼
  (opt.pairs || []).forEach(([sym, name]) => { const m = sym.match(/^(\d{6})\.(KS|KQ)$/); if (m && !/KODEX|TIGER|ETF|ACE |SOL |RISE/.test(name)) krMap[m[1]] = sym; });
  const prev = (await readDoc(redis, DISC_KEY.disc)) || { items: [] };
  const seen = {}; prev.items.forEach((x) => { seen[x.id] = x; });
  const today = kstYmd();
  // 진행 중인 훑기가 있으면 이어서, 없으면 새로 (수동 days가 지난 기록보다 길면 그만큼 다시)
  let scan = prev.scan && !prev.scan.done ? prev.scan : null;
  // 오늘 이미 목록을 끝까지 훑었으면 다시 훑지 않고 '숫자 채우기(상세)'만 한다
  if (!scan && prev.scan && prev.scan.done && prev.scan.end === today && !(opt.backfillDays && !prev.backfilled)) scan = { bgn: prev.scan.bgn, end: today, ty: { D002: { done: true }, D001: { done: true }, B001: { done: true } }, done: true, reuse: true };
  if (!scan) {
    let bgn = prev.last ? ymdAdd(prev.last, -1) : ymdAdd(today, -(opt.backfillDays || 30));
    if (opt.backfillDays && (!prev.from || prev.from > ymdAdd(today, -opt.backfillDays)) && !prev.backfilled) bgn = ymdAdd(today, -opt.backfillDays);
    scan = { bgn, end: today, ty: { D002: { page: 1, total: null }, D001: { page: 1, total: null }, B001: { page: 1, total: null } }, done: false };
  }
  const fresh = [];
  function take(detail, j) {
    (j.list || []).forEach((r) => {
      const sym = krMap[r.stock_code]; if (!sym || seen[r.rcept_no]) return;
      const k = kindOf(detail, r.report_nm || ""); if (!k) return;
      const it = { id: r.rcept_no, d: digits(r.rcept_dt), sym, corp: r.corp_name, cc: r.corp_code, k, title: String(r.report_nm || "").replace(/\s+/g, " ").trim(), who: r.flr_nm || "", rm: r.rm || "" };
      seen[it.id] = it; fresh.push(it); log.found++;
    });
  }
  let fatal = null;
  for (const detail of ["D002", "D001", "B001"]) {
    const T = scan.ty[detail];
    while (!T.done && !fatal) {
      if (left() < budget * 0.45) break;   // 남은 시간의 절반 정도는 상세용으로 남긴다
      const pages = []; for (let p = T.page; p < T.page + 4 && (T.total == null ? p === T.page : p <= T.total); p++) pages.push(p);
      if (!pages.length) { T.done = true; break; }
      const res = await Promise.all(pages.map((p) => dartList(key, detail, scan.bgn, scan.end, p, tmo()).then((j) => ({ p, j })).catch((e) => ({ p, e }))));
      let stop = false;
      for (const r of res) {
        log.calls++;
        if (r.e) { log.errors.push(detail + " " + r.p + "쪽: " + r.e.message); stop = true; break; }
        const j = r.j;
        if (!j || j.status === "013") { T.done = true; stop = true; break; }
        if (j.status !== "000") { log.errors.push(detail + " status " + j.status + " " + (j.message || "")); if (/^(010|011|012|020|021|800|900|901)$/.test(j.status)) fatal = "DART_" + j.status; stop = true; break; }
        log.pages++; T.total = j.total_page || 1; take(detail, j); T.page = r.p + 1;
        if (T.page > T.total) { T.done = true; stop = true; break; }
      }
      if (stop && !T.done) break;   // 실패한 쪽은 다음 호출에서 다시
    }
  }
  scan.done = ["D002", "D001", "B001"].every((d) => scan.ty[d].done);
  // 상세: 회사·종류별로 한 번씩, 3개씩 동시에 — 못 채운 건 다음 호출에서 (3번까지)
  const pool = prev.items.concat(fresh);
  pool.forEach((it) => { if (it.k === "cancel" && !it.ok) it.ok = true; });
  const todo = pool.filter((x) => !x.ok && (x.tries || 0) < 3);
  const groups = {}; todo.forEach((it) => { const g = it.cc + ":" + it.k; (groups[g] = groups[g] || []).push(it); });
  const keys = Object.keys(groups).sort((a, b) => (groups[b][0].d > groups[a][0].d ? 1 : -1));   // 최근 것부터
  let gi = 0;
  async function worker() {
    while (gi < keys.length && left() > 2500) {
      const g = keys[gi++], list = groups[g], dmin = list.reduce((a, x) => (x.d < a ? x.d : a), list[0].d);
      try {
        const r = await dartDetail(key, list[0], ymdAdd(dmin, -3), today, tmo()); log.calls++;
        const byNo = {}; (r && r.list || []).forEach((row) => { if (row.rcept_no) byNo[row.rcept_no] = row; });
        list.forEach((it) => { it.tries = (it.tries || 0) + 1; const row = byNo[it.id]; if (row) { fillDetail(it, row); log.filled++; } else if ((r && r.status === "013") || it.tries >= 3) it.ok = true; });
      } catch (e) { list.forEach((it) => { it.tries = (it.tries || 0) + 1; if (it.tries >= 3) it.ok = true; }); log.errors.push(g + ": " + (/abort/i.test(e.message) ? "시간 초과" : e.message)); }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const pending = pool.filter((x) => !x.ok).length;
  const cut = ymdAdd(today, -KEEP_DAYS);
  const items = pool.filter((x) => x.d >= cut).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.id < b.id ? 1 : -1)).slice(0, MAX_ITEMS);
  const doc = { updated: new Date().toISOString(), last: scan.done ? scan.end : prev.last || null, from: items.length ? items[items.length - 1].d : today, n: items.length, items,
    scan: scan.done ? { done: true, bgn: scan.bgn, end: scan.end } : scan, backfilled: prev.backfilled || (scan.done && !!opt.backfillDays), log: { at: new Date().toISOString(), ...log, ms: Date.now() - t0 } };
  await setJsonGz(redis, DISC_KEY.disc, doc, 200 * 86400);
  const prog = ["D002", "D001", "B001"].map((d) => { const T = scan.ty[d] || {}; return d + " " + (T.done ? "완료" : Math.max(0, (T.page || 1) - 1) + "/" + (T.total || "?") + "쪽"); }).join(" · ");
  return { ok: !fatal, reason: fatal || undefined, added: fresh.length, total: items.length, pending, done: scan.done && pending === 0, scanDone: scan.done, progress: scan.done ? "목록 완료" : prog, log: doc.log };
}

/* ============================================================ ② SEC 13F ============================================================ */
/* SEC_UA: HTTP 헤더는 영문·숫자·기호(ASCII)만 가능 — 한글이 섞이면 'Cannot convert argument to a ByteString' 오류로 요청 자체가 안 나간다.
   그래서 한글 등은 지우고 보낸다 (v11.2.3). 예: "StockMind hm@example.com" */
export function secUA() {
  const raw = String(process.env.SEC_UA || ""), ua = raw.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  return { ua: ua || "StockMind track-stock-tau.vercel.app", stripped: ua !== raw.trim(), hasMail: /@/.test(ua) };
}
function secHeaders() { return { "User-Agent": secUA().ua, "Accept-Encoding": "gzip, deflate", Accept: "*/*" }; }   // SEC 안내 예시와 같은 헤더
/* 제출 목록: data.sec.gov(JSON)가 막히면 www.sec.gov(Atom 피드)로 다시 (v11.2.4) */
function qEnd(ymd) { const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7), q = Math.floor((m - 1) / 3); return q === 0 ? (y - 1) + "-12-31" : y + "-" + ["03-31", "06-30", "09-30"][q - 1]; }   // 제출일 직전 분기 말
async function secFilings(cik, ms) {
  try {
    const s = await getJson("https://data.sec.gov/submissions/CIK" + cik.padStart(10, "0") + ".json", ms, secHeaders());
    const R = s.filings && s.filings.recent; if (!R) throw new Error("filings 없음");
    const out = []; for (let i = 0; i < R.form.length; i++) if (R.form[i] === "13F-HR") out.push({ acc: R.accessionNumber[i], filed: R.filingDate[i], period: R.reportDate[i] });
    return { list: out, via: "data" };
  } catch (e) {
    if (!/HTTP 403/.test(e.message)) throw e;
    const xml = await getText("https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=" + cik + "&type=13F-HR&dateb=&owner=include&count=10&output=atom", ms, secHeaders()).catch((e2) => { throw new Error(e.message + " / www: " + e2.message); });
    const out = []; String(xml).split(/<entry>/i).slice(1).forEach((en) => {
      const tg = (n) => { const m = en.match(new RegExp("<" + n + ">([^<]*)<", "i")); return m ? m[1].trim() : ""; };
      if (tg("filing-type") !== "13F-HR") return; const filed = tg("filing-date"); const acc = tg("accession-number") || tg("accession-nunber");
      if (acc && filed) out.push({ acc, filed, period: tg("period-of-report") || qEnd(filed) });
    });
    return { list: out, via: "www" };
  }
}
const STOP = new Set(["INC", "CORP", "CORPORATION", "CO", "COMPANY", "LTD", "LIMITED", "PLC", "HLDGS", "HOLDINGS", "HLDG", "HOLDING", "GROUP", "GRP", "THE", "OF", "NEW", "DEL", "DE", "CL", "CLASS", "A", "B", "C", "COM", "SA", "NV", "AG", "SE", "LP", "LLC", "ADR", "SPONSORED", "SPON", "ADS", "SHS", "ORD", "CAP", "STK", "COS", "MD", "NY", "PA"]);
const ALIAS = { AMER: "AMERICA", PETE: "PETROLEUM", INTL: "INTERNATIONAL", FINL: "FINANCIAL", SVCS: "SERVICES", SYS: "SYSTEMS", MTRS: "MOTORS", PPTYS: "PROPERTIES", BK: "BANK", MGMT: "MANAGEMENT", TECHNOLOGIES: "TECHNOLOGY", TECH: "TECHNOLOGY", COMMUNICATIONS: "COMMUNICATION", COMMUNICATNS: "COMMUNICATION", HLTHCR: "HEALTHCARE", ENTMT: "ENTERTAINMENT", RES: "RESOURCES", PHARMACEUTICALS: "PHARMA", LABS: "LABORATORIES", MFG: "MANUFACTURING", AMERN: "AMERICAN", NATL: "NATIONAL", SOLUTIONS: "SOLUTION" };
export function normName(s) {
  return String(s || "").toUpperCase().replace(/&/g, " AND ").replace(/\/[A-Z]{2,3}\/?/g, " ").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => ALIAS[w] || w);
}
async function tickMap(redis, ms) {
  const old = await readDoc(redis, DISC_KEY.tick);
  if (old && old.at && Date.now() - Date.parse(old.at) < 30 * 86400e3) return old.map;
  try {
    const j = await getJson("https://www.sec.gov/files/company_tickers.json", ms || 12000, secHeaders());
    const map = {};
    Object.keys(j).forEach((k) => { const r = j[k]; const key = normName(r.title).join(" "); if (key && !map[key]) map[key] = r.ticker; });
    await setJsonGz(redis, DISC_KEY.tick, { at: new Date().toISOString(), map }, 40 * 86400);
    return map;
  } catch (e) { return (old && old.map) || {}; }
}
export function matchTicker(map, issuer) {
  const t = normName(issuer); if (!t.length) return null;
  const k = t.join(" "); if (map[k]) return map[k];
  // 약어 대응: 13F 이름의 각 단어가 회사명 단어의 앞부분이면 같은 회사로 본다 (첫 단어는 완전히 같아야 함)
  let best = null;
  for (const key of Object.keys(map)) {
    if (!key.startsWith(t[0] + " ") && key !== t[0]) continue;
    const w = key.split(" "); if (w.length !== t.length) continue;
    if (t.every((x, i) => w[i].startsWith(x) || x.startsWith(w[i]))) { best = map[key]; break; }
  }
  return best;
}
export function parseInfoTable(xml) {
  const rows = [], parts = String(xml).split(/<(?:[\w-]+:)?infoTable>/i).slice(1);
  const tag = (s, n) => { const m = s.match(new RegExp("<(?:[\\w-]+:)?" + n + ">([^<]*)<", "i")); return m ? m[1].trim() : ""; };
  parts.forEach((p) => {
    if (tag(p, "putCall")) return;   // 옵션(풋·콜)은 뺀다
    const typ = tag(p, "sshPrnamtType"); if (typ && typ.toUpperCase() !== "SH") return;
    rows.push({ n: tag(p, "nameOfIssuer").replace(/&amp;/g, "&"), cls: tag(p, "titleOfClass"), cu: tag(p, "cusip").toUpperCase(), v: num(tag(p, "value")) || 0, sh: num(tag(p, "sshPrnamt")) || 0 });
  });
  const by = {};   // 같은 종목이 여러 줄(운용역별)로 나오면 합친다
  rows.forEach((r) => { const k = r.cu || r.n; const x = by[k] || (by[k] = { n: r.n, cls: r.cls, cu: r.cu, v: 0, sh: 0 }); x.v += r.v; x.sh += r.sh; });
  return Object.values(by);
}
async function filingTable(cik, acc, deadline) {
  const ms = (cap) => Math.max(1500, Math.min(cap, (deadline || Date.now() + 60000) - Date.now()));
  const dir = "https://www.sec.gov/Archives/edgar/data/" + cik + "/" + acc.replace(/-/g, "") + "/";
  const idx = await getJson(dir + "index.json", ms(10000), secHeaders());
  const files = ((idx && idx.directory && idx.directory.item) || []).map((x) => x.name).filter((n) => /\.xml$/i.test(n) && !/primary_doc/i.test(n));
  if (!files.length) throw new Error("정보표 XML 없음");
  files.sort((a, b) => (/info/i.test(b) ? 1 : 0) - (/info/i.test(a) ? 1 : 0));
  return parseInfoTable(await getText(dir + files[0], ms(15000), secHeaders()));
}
export function diffHoldings(cur, prev, total, map) {
  const P = {}; prev.forEach((x) => { P[x.cu || x.n] = x; });
  const C = {}; cur.forEach((x) => { C[x.cu || x.n] = x; });
  const tk = (n) => (map ? matchTicker(map, n) : null);
  const top = cur.slice().sort((a, b) => b.v - a.v).slice(0, 15).map((x) => { const p = P[x.cu || x.n]; return { n: x.n, t: tk(x.n), v: x.v, sh: x.sh, w: total ? x.v / total : null, chg: p ? (p.sh ? x.sh / p.sh - 1 : null) : "new" }; });
  const moves = [];
  cur.forEach((x) => { const p = P[x.cu || x.n], px = x.sh ? x.v / x.sh : 0; if (!p) moves.push({ n: x.n, kind: "new", dsh: x.sh, dv: x.v, v: x.v, w: total ? x.v / total : null }); else if (p.sh && Math.abs(x.sh / p.sh - 1) >= 0.01) moves.push({ n: x.n, kind: x.sh > p.sh ? "add" : "trim", dsh: x.sh - p.sh, dv: (x.sh - p.sh) * px, v: x.v, pct: x.sh / p.sh - 1, w: total ? x.v / total : null }); });
  prev.forEach((p) => { if (!C[p.cu || p.n]) moves.push({ n: p.n, kind: "exit", dsh: -p.sh, dv: -p.v, v: 0, pct: -1, w: 0 }); });
  const buys = moves.filter((m) => m.dv > 0).sort((a, b) => b.dv - a.dv).slice(0, 12).map((m) => Object.assign(m, { t: tk(m.n) }));
  const sells = moves.filter((m) => m.dv < 0).sort((a, b) => a.dv - b.dv).slice(0, 12).map((m) => Object.assign(m, { t: tk(m.n) }));
  return { top, buys, sells, nNew: moves.filter((m) => m.kind === "new").length, nExit: moves.filter((m) => m.kind === "exit").length };
}

export async function collectGurus(redis, opt) {
  const t0 = Date.now(), budget = opt.budgetMs || 15000, maxUpd = opt.maxUpdates || 2, log = { checked: 0, updated: [], errors: [] };
  const U = secUA(); if (!U.hasMail) log.errors.push("SEC_UA에 이메일이 없어요 — SEC가 거절할 수 있어요 (예: StockMind hm@example.com)"); if (U.stripped) log.note = "SEC_UA의 한글·특수문자는 빼고 보냈어요";
  const prev = (await readDoc(redis, DISC_KEY.guru)) || { gurus: [] };
  const byId = {}; prev.gurus.forEach((g) => { byId[g.id] = g; });
  let map = null, upd = 0, pend = 0;
  // 오래 확인 안 한 투자자부터
  const order = GURUS.slice().sort((a, b) => ((byId[a.id] && byId[a.id].checked) || "").localeCompare((byId[b.id] && byId[b.id].checked) || ""));
  for (const G of order) {
    if (Date.now() - t0 > budget * 0.8) break;
    try {
      const cik10 = G.cik.padStart(10, "0");
      const F = await secFilings(G.cik, Math.max(1500, Math.min(8000, budget - (Date.now() - t0)))); log.checked++; if (F.via === "www") log.via = "www";
      const list = F.list;
      const seenP = {}, q = list.filter((x) => (seenP[x.period] ? false : (seenP[x.period] = 1)));   // 분기별 최신 1건
      const old = byId[G.id];
      if (!q.length) { byId[G.id] = Object.assign(old || { id: G.id }, { checked: new Date().toISOString() }); continue; }
      if (old && old.acc === q[0].acc) { old.checked = new Date().toISOString(); continue; }
      if (upd >= maxUpd || Date.now() - t0 > budget * 0.6) { pend++; continue; }
      if (!map) map = await tickMap(redis, Math.max(1500, Math.min(12000, budget - (Date.now() - t0))));
      const dl = t0 + budget, cur = await filingTable(G.cik, q[0].acc, dl), pv = q[1] ? await filingTable(G.cik, q[1].acc, dl) : [];
      const total = cur.reduce((a, x) => a + x.v, 0), D = diffHoldings(cur, pv, total, map);
      byId[G.id] = { id: G.id, nm: G.nm, org: G.org, cik: G.cik, acc: q[0].acc, filed: q[0].filed, period: q[0].period, prevPeriod: q[1] ? q[1].period : null, total, n: cur.length, ...D, checked: new Date().toISOString() };
      upd++; log.updated.push(G.id);
    } catch (e) {
      const m = String(e.message || e);
      log.errors.push(G.id + ": " + (/ByteString/i.test(m) ? "SEC_UA에 한글이 있어요 — 영문 이름과 이메일만 넣어 주세요" : /403/.test(m) ? "SEC 거절(403) · 보낸 이름: " + secUA().ua.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@/, "$1***@") + " · 응답: " + m.slice(0, 260) : /abort/i.test(m) ? "시간 초과" : m.slice(0, 160)));
      if (/403/.test(m)) log.blocked = true;
    }
    if (log.blocked) break;   // SEC가 막으면 나머지도 똑같이 막히니 바로 멈춘다
  }
  const gurus = GURUS.map((G) => byId[G.id] ? Object.assign(byId[G.id], { nm: G.nm, org: G.org }) : null).filter((g) => g && g.period);
  const doc = { updated: new Date().toISOString(), gurus, log: { at: new Date().toISOString(), ...log, ms: Date.now() - t0 } };
  await setJsonGz(redis, DISC_KEY.guru, doc, 400 * 86400);
  return { ok: !log.blocked, reason: log.blocked ? "SEC_403" : undefined, updated: log.updated, checked: log.checked, pending: pend, done: pend === 0 && !log.blocked, log: doc.log };
}

/* 크론·수동 공용: 두 수집을 남은 시간 안에서 */
export async function collectAll(redis, opt) {
  const out = {};
  await Promise.all([   // DART(한국)와 SEC(미국)는 서로 다른 서버라 동시에
    opt.part === "sec" ? Promise.resolve(null) : collectDart(redis, { pairs: opt.pairs, budgetMs: opt.dartMs || 10000, backfillDays: opt.backfillDays, manual: opt.manual }).then((r) => { if (r) out.dart = r; }).catch((e) => { out.dart = { ok: false, error: String(e.message).slice(0, 120) }; }),
    opt.part === "dart" ? Promise.resolve(null) : collectGurus(redis, { budgetMs: opt.secMs || 12000, maxUpdates: opt.maxUpdates || 2 }).then((r) => { if (r) out.sec = r; }).catch((e) => { out.sec = { ok: false, error: String(e.message).slice(0, 120) }; }),
  ]);
  return out;
}
