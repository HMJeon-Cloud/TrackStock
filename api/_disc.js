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
import { collectMacro } from "./_macro.js";
import { collectIpo } from "./_ipo.js";
import https from "https";
import http from "http";
import { gunzipSync, inflateSync } from "zlib";
import { execFile } from "child_process";

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
  /* v14.50 거장 추가 — chk: SEC에 등록된 이름에 이 말이 들어 있어야 받는다(번호가 틀려 엉뚱한 기관의 보고서를 그 사람 이름으로 보여 주는 일을 막는다) */
  { id: "tci", cik: "1647251", nm: "크리스 혼", org: "TCI 펀드", chk: "tci" },
  { id: "fundsmith", cik: "1569205", nm: "테리 스미스", org: "펀드스미스", chk: "fundsmith" },
  { id: "akre", cik: "1112520", nm: "척 애커", org: "애커 캐피털", chk: "akre" },
  { id: "pabrai", cik: "1549575", nm: "모니시 파브라이", org: "달랄 스트리트", chk: "dalal" },
  { id: "greenlight", cik: "1079114", nm: "데이비드 아인혼", org: "그린라이트 캐피털", chk: "greenlight" },
  { id: "oaktree", cik: "949509", nm: "하워드 막스", org: "오크트리 캐피털", chk: "oaktree" },
  { id: "icahn", cik: "921669", nm: "칼 아이칸", org: "아이칸 엔터프라이즈", chk: "icahn" },
  { id: "trian", cik: "1345471", nm: "넬슨 펠츠", org: "트라이언 펀드", chk: "trian" },
  { id: "coatue", cik: "1135730", nm: "필립 라폰트", org: "코튜 매니지먼트", chk: "coatue" },
  { id: "altimeter", cik: "1541617", nm: "브래드 거스트너", org: "알티미터 캐피털", chk: "altimeter" },
  { id: "lonepine", cik: "1061165", nm: "스티븐 맨델", org: "론 파인 캐피털", chk: "lone pine" },
  /* v15.00 거장 추가 — 13F로 읽을 수 있는 4명(행동주의 2 · 가치 1 · 기술 1). chk로 SEC 등록 이름을 확인한다 */
  { id: "elliott", cik: "1791786", nm: "폴 싱어", org: "엘리엇 매니지먼트", chk: "elliott" },
  { id: "starboard", cik: "1517137", nm: "제프 스미스", org: "스타보드 밸류", chk: "starboard" },
  { id: "hhintl", cik: "1759760", nm: "돤융핑", org: "H&H 인터내셔널", chk: "international investment" },
  { id: "atreides", cik: "1777813", nm: "개빈 베이커", org: "아트레이디스", chk: "atreides" },
  /* v15.00 발언형 — 13F가 없거나(등록 말소 · 채권 운용) 조직 포트폴리오라 읽을 수 없는 사람. 13F는 받지 않고 '발언 조사'만 한다 */
  { id: "ptj", nm: "폴 튜더 존스", org: "튜더 인베스트먼트", voice: true },
  { id: "burry", nm: "마이클 버리", org: "사이언(등록 말소)", voice: true },
  { id: "gundlach", nm: "제프리 건들락", org: "더블라인 캐피털", voice: true },
  { id: "grantham", nm: "제러미 그랜섬", org: "GMO", voice: true },
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
/* v11.2.5 SEC 전용 요청: Node 내장 fetch는 브라우저 흉내 헤더(sec-fetch-mode·accept-language 등)를 자동으로 붙여
   SEC 방화벽이 '자동화 도구'로 보고 403을 준다 → https 모듈로 SEC 안내 그대로(User-Agent · Accept-Encoding · Host)만 보낸다 */
/* v11.2.8 SEC_CURL=1(GitHub Actions)이면 curl로 받는다 — SEC 방화벽은 Node의 접속 지문(TLS)을 막는 것으로 보여,
   SEC 안내 예시에 나오는 curl로 요청한다 (Vercel에는 curl이 없어 기존 방식 유지) */
function curlText(url, ms) {
  return new Promise((ok, no) => {
    const args = ["-sS", "-L", "--compressed", "--max-time", String(Math.max(2, Math.round((ms || 10000) / 1000))), "-A", secUA().ua, "-H", "Accept: */*", "-w", "\n__HTTP__%{http_code}", url];
    execFile("curl", args, { maxBuffer: 64 * 1024 * 1024 }, (err, out, errOut) => {
      if (err && !out) return no(new Error(/timed out/i.test(String(errOut)) ? "This operation was aborted" : "curl: " + String(errOut || err.message).slice(0, 120)));
      const i = out.lastIndexOf("\n__HTTP__"), st = +out.slice(i + 9), txt = out.slice(0, i);
      if (st < 200 || st >= 300) return no(new Error("HTTP " + st + " — " + txt.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140)));
      ok(txt);
    });
  });
}
export function secText(url, ms, hops) {
  if (process.env.SEC_CURL === "1") return curlText(url, ms);
  return new Promise((ok, no) => {
    const u = new URL(url), mod = u.protocol === "http:" ? http : https;
    const req = mod.request({ hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: "GET", headers: { "User-Agent": secUA().ua, "Accept-Encoding": "gzip, deflate", Accept: "*/*", Host: u.host } }, (res) => {
      const st = res.statusCode;
      if (st >= 300 && st < 400 && res.headers.location && (hops || 0) < 3) { res.resume(); return secText(new URL(res.headers.location, url).toString(), ms, (hops || 0) + 1).then(ok, no); }
      const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("error", no);
      res.on("end", () => {
        let buf = Buffer.concat(chunks); const enc = String(res.headers["content-encoding"] || "");
        try { if (/gzip/.test(enc)) buf = gunzipSync(buf); else if (/deflate/.test(enc)) buf = inflateSync(buf); } catch (e) {}
        const txt = buf.toString("utf8");
        if (st < 200 || st >= 300) return no(new Error("HTTP " + st + " — " + txt.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140)));
        ok(txt);
      });
    });
    req.setTimeout(ms || 10000, () => req.destroy(new Error("This operation was aborted")));
    req.on("error", no); req.end();
  });
}
export async function secJson(url, ms) { return JSON.parse(await secText(url, ms)); }
/* 제출 목록: data.sec.gov(JSON)가 막히면 www.sec.gov(Atom 피드)로 다시 (v11.2.4) */
function qEnd(ymd) { const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7), q = Math.floor((m - 1) / 3); return q === 0 ? (y - 1) + "-12-31" : y + "-" + ["03-31", "06-30", "09-30"][q - 1]; }   // 제출일 직전 분기 말
async function secFilings(cik, ms) {
  try {
    const s = await secJson("https://data.sec.gov/submissions/CIK" + cik.padStart(10, "0") + ".json", ms);
    const R = s.filings && s.filings.recent; if (!R) throw new Error("filings 없음");
    const out = []; for (let i = 0; i < R.form.length; i++) if (R.form[i] === "13F-HR") out.push({ acc: R.accessionNumber[i], filed: R.filingDate[i], period: R.reportDate[i] });
    return { list: out, via: "data", name: String(s.name || "") };
  } catch (e) {
    if (!/HTTP 403/.test(e.message)) throw e;
    const xml = await secText("https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=" + cik + "&type=13F-HR&dateb=&owner=include&count=10&output=atom", ms).catch((e2) => { throw new Error(e.message + " / www: " + e2.message); });
    const out = []; String(xml).split(/<entry>/i).slice(1).forEach((en) => {
      const tg = (n) => { const m = en.match(new RegExp("<" + n + ">([^<]*)<", "i")); return m ? m[1].trim() : ""; };
      if (tg("filing-type") !== "13F-HR") return; const filed = tg("filing-date"); const acc = tg("accession-number") || tg("accession-nunber");
      if (acc && filed) out.push({ acc, filed, period: tg("period-of-report") || qEnd(filed) });
    });
    const cn = String(xml).match(/<conformed-name>([^<]*)</i); return { list: out, via: "www", name: cn ? cn[1].trim() : "" };
  }
}
const STOP = new Set(["INC", "CORP", "CORPORATION", "CO", "COMPANY", "LTD", "LIMITED", "PLC", "HLDGS", "HOLDINGS", "HLDG", "HOLDING", "GROUP", "GRP", "THE", "OF", "NEW", "DEL", "DE", "CL", "CLASS", "A", "B", "C", "COM", "SA", "NV", "AG", "SE", "LP", "LLC", "ADR", "SPONSORED", "SPON", "ADS", "SHS", "ORD", "CAP", "STK", "COS", "MD", "NY", "PA"]);
const ALIAS = { AMER: "AMERICA", PETE: "PETROLEUM", INTL: "INTERNATIONAL", FINL: "FINANCIAL", SVCS: "SERVICES", SYS: "SYSTEMS", MTRS: "MOTORS", PPTYS: "PROPERTIES", BK: "BANK", MGMT: "MANAGEMENT", TECHNOLOGIES: "TECHNOLOGY", TECH: "TECHNOLOGY", COMMUNICATIONS: "COMMUNICATION", COMMUNICATNS: "COMMUNICATION", HLTHCR: "HEALTHCARE", ENTMT: "ENTERTAINMENT", RES: "RESOURCES", PHARMACEUTICALS: "PHARMA", LABS: "LABORATORIES", MFG: "MANUFACTURING", AMERN: "AMERICAN", NATL: "NATIONAL", SOLUTIONS: "SOLUTION" };
export function normName(s) {
  return String(s || "").toUpperCase().replace(/&/g, " AND ").replace(/\/[A-Z]{2,3}\/?/g, " ").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => ALIAS[w] || w);
}
export function buildTickMap(j) { const map = {}; Object.keys(j || {}).forEach((k) => { const r = j[k]; const key = normName(r.title).join(" "); if (key && !map[key]) map[key] = r.ticker; }); return map; }
async function tickMap(redis, ms) {
  const old = await readDoc(redis, DISC_KEY.tick);
  if (old && old.at && Date.now() - Date.parse(old.at) < 30 * 86400e3) return old.map;
  try {
    const map = buildTickMap(await secJson("https://www.sec.gov/files/company_tickers.json", ms || 12000));
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
/* v14.71 ETF 이름 — 13F의 발행자 이름이 'ISHARES INC'처럼 운용사 묶음 이름뿐이면 어떤 ETF인지 알 수 없다. 종목 구분(titleOfClass)을 붙여 보여 주고,
   잘 알려진 ETF만 티커를 붙인다(모르면 비워 둔다 — 엉뚱한 티커보다 낫다) */
const FUND_RE = /^(ISHARES( INC| TR| TRUST| U ?S ETF TR(UST)?)?|SELECT SECTOR SPDR TR(UST)?|SPDR (SER(IES)? TR(UST)?|INDEX SHS FDS|DOW JONES INDL AVRG ETF)|VANGUARD [A-Z ]*FDS?|VANGUARD [A-Z ]*FUNDS?|VANECK (ETF|VECTORS ETF) TR(UST)?|INVESCO EXCHANGE[A-Z\- ]*|INVESCO ACTIVELY MANAGED[A-Z\- ]*|GLOBAL X FDS|PROSHARES TR( II)?|DIREXION SHS ETF TR|WISDOMTREE TR(UST)?|FIRST TR [A-Z\- ]*|SCHWAB STRATEGIC TR|J ?P ?MORGAN EXCHANGE[A-Z\- ]*|ISHARES S&P GSCI[A-Z ]*)$/i;
const ETF_TK = [[/ISHARES/, /MSCI BRAZIL/, "EWZ"], [/ISHARES/, /CORE MSCI EMERG/, "IEMG"], [/ISHARES/, /MSCI EMERG/, "EEM"], [/ISHARES/, /RUSSELL 2000/, "IWM"], [/ISHARES/, /MSCI JAPAN/, "EWJ"], [/ISHARES/, /MSCI MEXICO/, "EWW"], [/ISHARES/, /MSCI (SOUTH )?KOREA/, "EWY"], [/ISHARES/, /MSCI TAIWAN/, "EWT"], [/ISHARES/, /MSCI INDIA/, "INDA"], [/ISHARES/, /MSCI CHINA/, "MCHI"], [/ISHARES/, /(CHINA LARGE|FTSE CHINA)/, "FXI"], [/ISHARES/, /MSCI EAFE/, "EFA"], [/ISHARES/, /20\+ ?YR|20 ?YR TR BD/, "TLT"], [/ISHARES/, /IBOXX.*HIGH ?YI|HIGH YIELD CORP/, "HYG"], [/ISHARES/, /IBOXX.*INV/, "LQD"], [/ISHARES/, /CORE S&P 500/, "IVV"], [/ISHARES/, /SEMICONDUCTOR/, "SOXX"], [/ISHARES/, /RUSSELL 1000 GRO/, "IWF"], [/ISHARES/, /BITCOIN/, "IBIT"],
  [/SELECT SECTOR/, /ENERGY/, "XLE"], [/SELECT SECTOR/, /FINANCIAL/, "XLF"], [/SELECT SECTOR/, /TECHNOLOGY/, "XLK"], [/SELECT SECTOR/, /HEALTH/, "XLV"], [/SELECT SECTOR/, /INDL|INDUSTRIAL/, "XLI"], [/SELECT SECTOR/, /UTIL/, "XLU"], [/SELECT SECTOR/, /STAPLES/, "XLP"], [/SELECT SECTOR/, /DISCRETIONARY/, "XLY"], [/SELECT SECTOR/, /MATERIALS/, "XLB"], [/SELECT SECTOR/, /REAL ESTATE/, "XLRE"],
  [/VANECK/, /JR GOLD/, "GDXJ"], [/VANECK/, /GOLD MINERS/, "GDX"], [/VANECK/, /SEMICONDUCTOR/, "SMH"], [/SPDR SER/, /S&P BIOTECH/, "XBI"], [/SPDR SER/, /S&P REGIONAL BANK/, "KRE"], [/SPDR SER/, /S&P METALS/, "XME"], [/SPDR SER/, /OIL & GAS EXP/, "XOP"], [/SPDR SER/, /S&P HOMEBUILD/, "XHB"], [/VANGUARD/, /FTSE EMERG/, "VWO"], [/VANGUARD/, /TOTAL STK|TOTAL STOCK/, "VTI"], [/VANGUARD/, /S&P 500/, "VOO"], [/INVESCO/, /QQQ/, "QQQ"]];
function fundName(issuer, cls) { const n = String(issuer || "").trim(), c = String(cls || "").trim(); if (!FUND_RE.test(n) || !c || /^(COM|SHS|ETF|UNIT|TR UNIT|SH BEN INT)$/i.test(c)) return null; const brand = n.replace(/\s+(INC|TR|TRUST|FDS?|FUNDS?|SER(IES)?|INDEX SHS.*|ETF.*|EXCHANGE.*|U ?S ETF.*|SHS.*|STRATEGIC.*|ACTIVELY.*|VECTORS.*|II)$/i, "").replace(/\s+(INC|TR|TRUST|FDS?)$/i, ""); return brand + " · " + c; }
function etfTicker(n) { const s = String(n || ""); if (s.indexOf(" · ") < 0) return undefined; const i = s.indexOf(" · "), b = s.slice(0, i).toUpperCase(), c = s.slice(i + 3).toUpperCase(); for (const r of ETF_TK) if (r[0].test(b) && r[1].test(c)) return r[2]; return null; }
const tickOf = (map, n) => { const e = etfTicker(n); return e !== undefined ? e : map ? matchTicker(map, n) : null; };
export function parseInfoTable(xml) {
  const rows = [], parts = String(xml).split(/<(?:[\w-]+:)?infoTable>/i).slice(1);
  const tag = (s, n) => { const m = s.match(new RegExp("<(?:[\\w-]+:)?" + n + ">([^<]*)<", "i")); return m ? m[1].trim() : ""; };
  const opt = {};   // v14.50 옵션(풋·콜)은 주식 합계에서 빼되, 따로 모아 둔다 — 매크로 투자자의 방향성 베팅을 읽는 재료
  parts.forEach((p) => {
    const pc = tag(p, "putCall"); if (pc) { const cu = tag(p, "cusip").toUpperCase(), nm0 = tag(p, "nameOfIssuer").replace(/&amp;/g, "&"), nm = fundName(nm0, tag(p, "titleOfClass").replace(/&amp;/g, "&")) || nm0, k = (cu || nm) + "|" + pc.toLowerCase(); const o = opt[k] || (opt[k] = { n: nm, cu, pc: /put/i.test(pc) ? "put" : "call", v: 0 }); o.v += num(tag(p, "value")) || 0; return; }
    const typ = tag(p, "sshPrnamtType"); if (typ && typ.toUpperCase() !== "SH") return;
    const n0 = tag(p, "nameOfIssuer").replace(/&amp;/g, "&");
    rows.push({ n: fundName(n0, tag(p, "titleOfClass").replace(/&amp;/g, "&")) || n0, cls: tag(p, "titleOfClass"), cu: tag(p, "cusip").toUpperCase(), v: num(tag(p, "value")) || 0, sh: num(tag(p, "sshPrnamt")) || 0 });
  });
  const by = {};   // 같은 종목이 여러 줄(운용역별)로 나오면 합친다
  rows.forEach((r) => { const k = r.cu || r.n; const x = by[k] || (by[k] = { n: r.n, cls: r.cls, cu: r.cu, v: 0, sh: 0 }); x.v += r.v; x.sh += r.sh; });
  const list = Object.values(by); list.opts = Object.values(opt); return list;
}
async function filingTable(cik, acc, deadline) {
  const ms = (cap) => Math.max(1500, Math.min(cap, (deadline || Date.now() + 60000) - Date.now()));
  const dir = "https://www.sec.gov/Archives/edgar/data/" + cik + "/" + acc.replace(/-/g, "") + "/";
  const idx = await secJson(dir + "index.json", ms(10000));
  const files = ((idx && idx.directory && idx.directory.item) || []).map((x) => x.name).filter((n) => /\.xml$/i.test(n) && !/primary_doc/i.test(n));
  if (!files.length) throw new Error("정보표 XML 없음");
  files.sort((a, b) => (/info/i.test(b) ? 1 : 0) - (/info/i.test(a) ? 1 : 0));
  return parseInfoTable(await secText(dir + files[0], ms(15000)));
}
export function diffHoldings(cur, prev, total, map) {
  const P = {}; prev.forEach((x) => { P[x.cu || x.n] = x; });
  const C = {}; cur.forEach((x) => { C[x.cu || x.n] = x; });
  const tk = (n) => tickOf(map, n);
  const pTot = prev.reduce((a, x) => a + x.v, 0), pw = (p) => (p && pTot ? p.v / pTot : 0);
  const top = cur.slice().sort((a, b) => b.v - a.v).slice(0, 15).map((x) => { const p = P[x.cu || x.n]; return { n: x.n, t: tk(x.n), v: x.v, sh: x.sh, w: total ? x.v / total : null, pw: p ? +pw(p).toFixed(4) : 0, chg: p ? (p.sh ? x.sh / p.sh - 1 : null) : "new" }; });
  const moves = [];
  cur.forEach((x) => { const p = P[x.cu || x.n], px = x.sh ? x.v / x.sh : 0; if (!p) moves.push({ n: x.n, kind: "new", dsh: x.sh, dv: x.v, v: x.v, w: total ? x.v / total : null, pw: 0 }); else if (p.sh && Math.abs(x.sh / p.sh - 1) >= 0.01) moves.push({ n: x.n, kind: x.sh > p.sh ? "add" : "trim", dsh: x.sh - p.sh, dv: (x.sh - p.sh) * px, v: x.v, pct: x.sh / p.sh - 1, w: total ? x.v / total : null, pw: +pw(p).toFixed(4) }); });
  prev.forEach((p) => { if (!C[p.cu || p.n]) moves.push({ n: p.n, kind: "exit", dsh: -p.sh, dv: -p.v, v: 0, pct: -1, w: 0, pw: +pw(p).toFixed(4) }); });
  /* v14.50 유형별 해석에 쓰는 요약 — 집중도 · 회전율 · ETF 비중 · 옵션 */
  const sw = cur.map((x) => (total ? x.v / total : 0)).sort((a, b) => b - a), sumN = (k) => +sw.slice(0, k).reduce((a, x) => a + x, 0).toFixed(4);
  const isEtf = (x) => /\b(ETF|ISHARES|SPDR|VANGUARD|INVESCO QQQ|PROSHARES|SELECT SECTOR|INDEX FD|INDEX FUND|TR UNIT|GOLD TR|GOLD SHS)\b/i.test(x.n + " " + (x.cls || ""));
  const conc = { t1: sumN(1), t5: sumN(5), t10: sumN(10) }, turn = total ? +(moves.reduce((a, m) => a + Math.abs(m.dv), 0) / 2 / total).toFixed(4) : null;
  const flow = pTot ? +(moves.reduce((a, m) => a + m.dv, 0) / pTot).toFixed(4) : null;   // v14.60 순매매 — 주가 변동을 뺀 실제 사고판 방향
  const etfW = total ? +(cur.filter(isEtf).reduce((a, x) => a + x.v, 0) / total).toFixed(4) : null;
  const PO = {}; (prev.opts || []).forEach((o) => { PO[(o.cu || o.n) + "|" + o.pc] = o; });
  const opts = (cur.opts || []).slice().sort((a, b) => b.v - a.v).slice(0, 8).map((o) => { const p = PO[(o.cu || o.n) + "|" + o.pc]; return { n: o.n, t: tk(o.n), pc: o.pc, v: o.v, isNew: !p, chg: p && p.v ? +(o.v / p.v - 1).toFixed(3) : null }; });
  const optSum = { put: (cur.opts || []).filter((o) => o.pc === "put").reduce((a, o) => a + o.v, 0), call: (cur.opts || []).filter((o) => o.pc === "call").reduce((a, o) => a + o.v, 0) };
  const buys = moves.filter((m) => m.dv > 0).sort((a, b) => b.dv - a.dv).slice(0, 12).map((m) => Object.assign(m, { t: tk(m.n) }));
  const sells = moves.filter((m) => m.dv < 0).sort((a, b) => a.dv - b.dv).slice(0, 12).map((m) => Object.assign(m, { t: tk(m.n) }));
  return { top, buys, sells, nNew: moves.filter((m) => m.kind === "new").length, nExit: moves.filter((m) => m.kind === "exit").length, conc, turn, flow, etfW, opts, optSum, prevTotal: pTot };
}

/* 13F 계산 본체 — 저장소와 무관 (Vercel 수집기와 GitHub Actions 스크립트가 같이 쓴다)
   prev: 지난 문서 { gurus } · opt.getMap(ms): 티커 대조표를 돌려주는 함수 */
const FV = 1471;   // 구루 계산 기준 번호 — 바뀌면 다음 수집 때 다시 계산
function histLine(rows, tot, p, map) { const s = rows.slice().sort((a, b) => b.v - a.v); return { p, total: tot, n: rows.length, t5: tot ? +(s.slice(0, 5).reduce((a, x) => a + x.v, 0) / tot).toFixed(4) : null, top: s.slice(0, 5).map((x) => ({ n: x.n, t: tickOf(map, x.n), w: tot ? +(x.v / tot).toFixed(4) : null })) }; }
export async function buildGurus(prev, opt) {
  const t0 = Date.now(), budget = opt.budgetMs || 15000, maxUpd = opt.maxUpdates || 2, log = { checked: 0, updated: [], errors: [] };
  const U = secUA(); if (!U.hasMail) log.errors.push("SEC_UA에 이메일이 없어요 — SEC가 거절할 수 있어요 (예: StockMind hm@example.com)"); if (U.stripped) log.note = "SEC_UA의 한글·특수문자는 빼고 보냈어요";
  prev = prev || { gurus: [] };
  const byId = {}; prev.gurus.forEach((g) => { byId[g.id] = g; });
  let map = null, upd = 0, pend = 0;
  // 오래 확인 안 한 투자자부터
  const order = GURUS.filter((G) => !G.voice && G.cik).sort((a, b) => ((byId[a.id] && byId[a.id].checked) || "").localeCompare((byId[b.id] && byId[b.id].checked) || ""));   // 발언형은 13F를 받지 않는다
  for (const G of order) {
    if (Date.now() - t0 > budget * 0.8) break;
    try {
      const cik10 = G.cik.padStart(10, "0");
      const F = await secFilings(G.cik, Math.max(1500, Math.min(8000, budget - (Date.now() - t0)))); log.checked++; if (F.via === "www") log.via = "www";
      const list = F.list;
      if (G.chk && F.name && F.name.toLowerCase().indexOf(G.chk) < 0) { log.errors.push(G.id + ": SEC 번호 확인 필요 — 등록된 이름이 '" + F.name.slice(0, 60) + "'라서 받지 않았어요"); continue; }
      const seenP = {}, q = list.filter((x) => (seenP[x.period] ? false : (seenP[x.period] = 1)));   // 분기별 최신 1건
      const old = byId[G.id];
      if (!q.length) { byId[G.id] = Object.assign(old || { id: G.id }, { checked: new Date().toISOString() }); continue; }
      /* v14.60 과거 분기 채우기 — 기록(hist)에 없는 지난 분기를 최대 8분기까지 받아 한 줄씩 넣는다(opt.backfill: 한 사람당 이번 실행에 받을 분기 수) */
      const backfill = async (ent) => { if (!opt.backfill || !ent) return; ent.hist = ent.hist || []; let k = 0;
        for (const f of q.slice(0, 8)) { if (k >= opt.backfill || Date.now() - t0 > budget * 0.85) break; if (ent.hist.some((h) => h.p === f.period)) continue;
          try { if (!map) map = (await opt.getMap(12000)) || {}; const rows = await filingTable(G.cik, f.acc, t0 + budget); ent.hist.push(histLine(rows, rows.reduce((a, x) => a + x.v, 0), f.period, map)); k++; log.back = (log.back || 0) + 1; } catch (e) { log.errors.push(G.id + " " + f.period + " 과거 분기: " + String(e.message || e).slice(0, 80)); break; } }
        ent.hist.sort((a, b) => String(a.p).localeCompare(String(b.p))); ent.hist = ent.hist.slice(-12); };
      if (old && old.fv !== FV) old.hist = [];   // v14.71 계산 기준(ETF 이름 등)이 바뀌면 지난 분기 기록도 새로 만든다
      if (old && old.acc === q[0].acc && old.conc && old.flow !== undefined && old.fv === FV) {   // conc · flow가 없으면 옛 형식 — 한 번 다시 계산해 새 요약(집중도 · 옵션 · 순매매 · 기록)을 채운다
        await backfill(old); old.checked = new Date().toISOString(); continue; }
      if (upd >= maxUpd || Date.now() - t0 > budget * 0.6) { pend++; continue; }
      if (!map) map = (await opt.getMap(Math.max(1500, Math.min(12000, budget - (Date.now() - t0))))) || {};
      const dl = t0 + budget, cur = await filingTable(G.cik, q[0].acc, dl), pv = q[1] ? await filingTable(G.cik, q[1].acc, dl) : [];
      const total = cur.reduce((a, x) => a + x.v, 0), D = diffHoldings(cur, pv, total, map);
      /* 분기 기록 — 새 보고서가 올 때마다 한 줄씩 쌓는다(최근 12분기). 처음에는 지난 분기 한 줄도 같이 넣는다 */
      const hist = ((old && old.hist) || []).filter((h) => h && h.p !== q[0].period), hl = (rows, tot, p) => histLine(rows, tot, p, map);
      if (q[1] && pv.length && !hist.some((h) => h.p === q[1].period)) hist.push(hl(pv, D.prevTotal, q[1].period));
      hist.push(Object.assign(hl(cur, total, q[0].period), { turn: D.turn, nNew: D.nNew, nExit: D.nExit })); hist.sort((a, b) => String(a.p).localeCompare(String(b.p)));
      byId[G.id] = { id: G.id, nm: G.nm, org: G.org, cik: G.cik, acc: q[0].acc, filed: q[0].filed, period: q[0].period, prevPeriod: q[1] ? q[1].period : null, total, n: cur.length, ...D, hist: hist.slice(-12), fv: FV, checked: new Date().toISOString() };
      upd++; log.updated.push(G.id); await backfill(byId[G.id]);
    } catch (e) {
      const m = String(e.message || e);
      log.errors.push(G.id + ": " + (/ByteString/i.test(m) ? "SEC_UA에 한글이 있어요 — 영문 이름과 이메일만 넣어 주세요" : /403/.test(m) ? "SEC 거절(403) · 보낸 이름: " + secUA().ua.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@/, "$1***@") + " · 응답: " + m.slice(0, 260) : /abort/i.test(m) ? "시간 초과" : m.slice(0, 160)));
      if (/403/.test(m)) log.blocked = true;
    }
    if (log.blocked) break;   // SEC가 막으면 나머지도 똑같이 막히니 바로 멈춘다
  }
  const gurus = GURUS.map((G) => byId[G.id] ? Object.assign(byId[G.id], { nm: G.nm, org: G.org }) : null).filter((g) => g && g.period);
  const doc = { updated: new Date().toISOString(), via: opt.via || prev.via || "vercel", gurus, log: { at: new Date().toISOString(), ...log, ms: Date.now() - t0 } };
  return { doc, result: { ok: !log.blocked, reason: log.blocked ? "SEC_403" : undefined, updated: log.updated, checked: log.checked, pending: pend, done: pend === 0 && !log.blocked, log: doc.log } };
}
export async function collectGurus(redis, opt) {
  const prev = (await readDoc(redis, DISC_KEY.guru)) || { gurus: [] };
  // v11.2.7 SEC가 Vercel 서버를 막아서 13F는 GitHub Actions가 받아 올린다 → 그 뒤로는 Vercel에서 다시 시도하지 않는다 (opt.force면 시도)
  if (prev.via === "github" && !opt.force) return { ok: true, skipped: "github", updated: [], checked: 0, pending: 0, done: true, log: { errors: [], note: "13F는 GitHub Actions에서 받아요 (마지막 " + String(prev.updated || "").slice(0, 10) + ")" } };
  const { doc, result } = await buildGurus(prev, { ...opt, via: "vercel", getMap: (ms) => tickMap(redis, ms) });
  await setJsonGz(redis, DISC_KEY.guru, doc, 400 * 86400);
  return result;
}
/* GitHub Actions가 올린 13F 문서 저장 (형식 확인 후) */
export async function saveGurusFromUpload(redis, body) {
  const ids = {}; GURUS.forEach((G) => { ids[G.id] = G; });
  const prev = (await readDoc(redis, DISC_KEY.guru)) || { gurus: [] };
  const byId = {}; prev.gurus.forEach((g) => { byId[g.id] = g; });
  const arr = Array.isArray(body && body.gurus) ? body.gurus : [];
  const clip = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  let n = 0;
  arr.forEach((g) => {
    if (!g || !ids[g.id] || !/^\d{4}-\d{2}-\d{2}$/.test(String(g.period || ""))) return;
    byId[g.id] = { id: g.id, nm: ids[g.id].nm, org: ids[g.id].org, cik: ids[g.id].cik, acc: String(g.acc || "").slice(0, 30), filed: String(g.filed || "").slice(0, 10), period: g.period, prevPeriod: g.prevPeriod || null,
      total: +g.total || 0, n: +g.n || 0, nNew: +g.nNew || 0, nExit: +g.nExit || 0, top: clip(g.top, 15), buys: clip(g.buys, 12), sells: clip(g.sells, 12),
      conc: g.conc && typeof g.conc === "object" ? { t1: +g.conc.t1 || 0, t5: +g.conc.t5 || 0, t10: +g.conc.t10 || 0 } : null, turn: g.turn == null ? null : +g.turn || 0, flow: g.flow == null ? null : +g.flow || 0, etfW: g.etfW == null ? null : +g.etfW || 0, prevTotal: +g.prevTotal || 0,
      opts: clip(g.opts, 8), optSum: g.optSum && typeof g.optSum === "object" ? { put: +g.optSum.put || 0, call: +g.optSum.call || 0 } : null, hist: (Array.isArray(g.hist) ? g.hist.slice(-12) : []), fv: +g.fv || 0, checked: String(g.checked || new Date().toISOString()).slice(0, 30) };
    n++;
  });
  const log = body && body.log ? { at: new Date().toISOString(), checked: +body.log.checked || 0, updated: clip(body.log.updated, 20), errors: clip(body.log.errors, 20).map((x) => String(x).slice(0, 300)), via: "github" } : { at: new Date().toISOString(), via: "github" };
  const gurus = GURUS.map((G) => byId[G.id]).filter((g) => g && g.period);
  await setJsonGz(redis, DISC_KEY.guru, { updated: new Date().toISOString(), via: "github", gurus, log }, 400 * 86400);
  return { ok: true, saved: n, total: gurus.length };
}

/* 크론·수동 공용: 두 수집을 남은 시간 안에서 */
export async function collectAll(redis, opt) {
  const out = {};
  const only = (p) => !opt.part || opt.part === "both" || opt.part === p;
  await Promise.all([   // DART(한국)와 SEC(미국)는 서로 다른 서버라 동시에 · v11.3 공모주(DART)도 같이
    only("macro") ? collectMacro(redis, { budgetMs: opt.macroMs || opt.dartMs || 10000, manual: opt.manual, force: opt.force }).then((r) => { out.macro = r; }).catch((e) => { out.macro = { ok: false, error: String(e.message).slice(0, 120) }; }) : null,   // v11.4 매크로(ECOS·FRED)
    only("ipo") ? collectIpo(redis, { budgetMs: opt.ipoMs || opt.dartMs || 10000, backfillDays: opt.ipoDays, manual: opt.manual }).then((r) => { out.ipo = r; }).catch((e) => { out.ipo = { ok: false, error: String(e.message).slice(0, 120) }; }) : null,
    !only("dart") ? Promise.resolve(null) : collectDart(redis, { pairs: opt.pairs, budgetMs: opt.dartMs || 10000, backfillDays: opt.backfillDays, manual: opt.manual }).then((r) => { if (r) out.dart = r; }).catch((e) => { out.dart = { ok: false, error: String(e.message).slice(0, 120) }; }),
    !only("sec") ? Promise.resolve(null) : collectGurus(redis, { budgetMs: opt.secMs || 12000, maxUpdates: opt.maxUpdates || 2 }).then((r) => { if (r) out.sec = r; }).catch((e) => { out.sec = { ok: false, error: String(e.message).slice(0, 120) }; }),
  ]);
  return out;
}
