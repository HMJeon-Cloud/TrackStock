// v13.70 실적 팔로업 자동 수집 — /api/channel?op=follow (POST). 새 서버 함수 · 새 크론 없음.
//   하는 일: 지켜보는 종목 가운데 '갱신할 때가 된' 종목을 골라 Claude API(웹 검색)로 분기 실적 자료(JSON)를 만들고 서버 보관함에 저장한다.
//   언제: ① 아침 수집(한국 09:00) 끝에 수집기가 이 주소를 한 번 부른다(CRON_SECRET) ② 운영자가 화면에서 '지금 확인' · 종목별 '지금 갱신'
//   자동으로 도는 때(v13.71): 실적 발표 다음 날 한국 아침만 (+ 콜 Q&A가 비었으면 하루 뒤 한 번, 발표가 밀렸으면 이틀 뒤 다시). 그 밖의 날은 확인만 하고 Claude를 부르지 않는다
//   자료가 없는 종목 · 원하는 종목은 화면에서 직접 받아온다(run: 종목)
//   비용 보호: 하루 FOLLOW_DAILY_MAX(기본 3)종목까지 · 같은 종목은 하루 한 번 · Claude 하루 상한(CLAUDE_DAILY_MAX)에도 같이 센다
//   저장: sm:kv:cfg:follow(목록 · 자동 켬/끔 — 화면이 씀) · sm:kv:cfg:follow:<종목>(자료) · sm:kv:cfg:followlog(기록 · 진행 중 표시 — 서버가 씀)
import { redisConf, redisCmd, setJsonGz, getJsonGzText, KEY } from "./_redis.js";
import { runClaude } from "./_claude.js";
import { cleanFin, priceStats, calcFacts, naverText } from "./_followcalc.js";

const YEAR = 365 * 86400;
const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const kstDay = (t) => new Date((t || Date.now()) + 9 * 3600e3).toISOString().slice(0, 10);
const okSym = (s) => typeof s === "string" && /^[A-Z0-9.\-]{1,12}$/.test(s);
async function kvGet(rc, k) { try { const t = await getJsonGzText(rc, "sm:kv:" + k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
async function kvPut(rc, k, v) { await setJsonGz(rc, "sm:kv:" + k, v, YEAR); }

/* 자동으로 갱신할 때가 됐나 — 이유를 돌려준다(아니면 null). v13.71: 실적 발표 다음 날만 돈다.
   · 자료가 없는 종목은 자동으로 받지 않는다(화면에서 직접 '받아오기')
   · earnings: 다음 실적일이 지났다(발표 다음 날 한국 아침). 실적일을 모르면 지난 발표일 + 91일로 어림한다
   · qa: 발표 직후라 콘퍼런스콜 내용을 못 찾았을 때 하루 뒤 한 번
   · recheck: 실적일이 지났는데 새 분기가 아직 안 나왔을 때(일정 변경 등) 이틀 뒤 다시 — 최대 3번 */
const YMD = /^\d{4}-\d{2}-\d{2}$/;
export function followNext(d) {
  if (!d) return null; if (YMD.test(String(d.nextEarnings || ""))) return { day: d.nextEarnings, est: 0 };
  const r = String(d.reported || "").slice(0, 10); if (!YMD.test(r)) return null;
  return { day: new Date(Date.parse(r + "T00:00:00Z") + 91 * 86400e3).toISOString().slice(0, 10), est: 1 };
}
export function followDue(d, today) {
  if (!d || !d.quarter) return null;
  const saved = d.savedAt ? kstDay(d.savedAt) : "", nx = followNext(d);
  if (nx && today > nx.day && saved <= nx.day) return "earnings";
  if (d.qaRetry && saved < today) return "qa";
  if (d.recheck && YMD.test(d.recheck) && today >= d.recheck && saved < today) return "earnings";
  return null;
}
const WHY = { earnings: "실적 발표 다음 날 — 새 분기 반영", qa: "콘퍼런스콜 Q&A 보완", manual: "직접 요청 — 가장 최근 분기 자료" };

function buildInput(sym, prev, px, why) {
  const L = ["[종목] " + sym + (prev && prev.name ? " (" + prev.name + ")" : ""), "[이번 수집 이유] " + (WHY[why] || why)];
  if (px) L.push("[앱이 가진 가격] 종가 " + px.c + " (" + px.d + ") · 52주 고점(종가) " + px.hi + " · 고점 대비 " + ((px.c / px.hi - 1) * 100).toFixed(1) + "%");
  if (prev && prev.kpi && prev.kpi.length) {
    L.push("\n[지난번 자료] 분기 " + (prev.quarter || "") + " · 발표일 " + (prev.reported || "") + " · 판정 " + ((prev.verdict && prev.verdict.label) || ""));
    L.push("[지난번에 쓰던 KPI와 경고선 — 같은 항목 · 같은 경고선을 유지하고 값만 가장 최근 분기로. 더 새 분기가 나왔으면 지난번 '최근값'이 이번 '전분기'가 된다. 꼭 필요할 때만 항목을 더하거나 뺀다]");
    prev.kpi.forEach((k) => L.push("- " + k.n + " | 지난 최근값 " + k.cur + " | 경고선 " + k.warn));
    if (why === "qa") L.push("\n지난번에는 콘퍼런스콜 질의응답을 찾지 못했다. 이번에는 콜 전문 · 요약을 꼭 찾아 읽는다.");
  }
  return L.join("\n");
}
/* 깊이 단계 결과 다듬기 — 본문 · 표 · 증권사 목표가 */
function cleanDeep(o) {
  if (!o || typeof o !== "object") return null; const str = (v) => (v == null ? "" : String(v));
  const story = (Array.isArray(o.story) ? o.story : []).filter((x) => x && x.h && x.p).slice(0, 7).map((x) => ({ h: str(x.h).slice(0, 120), p: str(x.p).slice(0, 1400), so: str(x.so).slice(0, 300) }));
  const tables = (Array.isArray(o.tables) ? o.tables : []).filter((t) => t && Array.isArray(t.cols) && Array.isArray(t.rows) && t.cols.length >= 2 && t.rows.length).slice(0, 6).map((t) => ({ t: str(t.t).slice(0, 80), unit: str(t.unit).slice(0, 40), cols: t.cols.slice(0, 10).map(str), rows: t.rows.filter(Array.isArray).slice(0, 14).map((r) => r.slice(0, 10).map(str)), note: str(t.note).slice(0, 300) }));
  const targets = (Array.isArray(o.targets) ? o.targets : []).filter((t) => t && t.n && isFinite(+t.px) && +t.px > 0).slice(0, 14).map((t) => ({ n: str(t.n).slice(0, 40), px: +t.px, note: str(t.note).slice(0, 60) }));
  if (!story.length && !tables.length) return null;
  return { story, tables, targets, targetNote: str(o.targetNote).slice(0, 160), watch: o.watch && typeof o.watch === "object" ? { rule: str(o.watch.rule).slice(0, 300), now: str(o.watch.now).slice(0, 300) } : null };
}
function clean(o, sym, prev, why) {
  if (!o || typeof o !== "object") return null;
  if (!Array.isArray(o.kpi)) { const alt = o.kpis || o.KPI || o.KPIs; o.kpi = Array.isArray(alt) ? alt : o.kpi && typeof o.kpi === "object" ? Object.keys(o.kpi).map((k) => (typeof o.kpi[k] === "object" ? Object.assign({ n: k }, o.kpi[k]) : { n: k, cur: String(o.kpi[k]) })) : []; }
  o.kpi.forEach((k) => { if (k && !k.n) k.n = k.name || k.k || k.label || ""; });
  if (!o.quarter || !o.kpi.length) return null;
  o.sym = sym; ["summary", "val", "kpi", "risk", "series", "qa", "scen", "bull", "bear", "terms", "sources"].forEach((k) => { if (!Array.isArray(o[k])) o[k] = []; });
  const ST = { good: 1, warn: 1, bad: 1, info: 1 }, VT = { temp: 1, watch: 1, struct: 1, ok: 1 };
  o.kpi = o.kpi.slice(0, 18).filter((k) => k && k.n); o.kpi.forEach((k) => { if (!ST[k.state]) k.state = "info"; });
  o.risk = o.risk.slice(0, 10).filter((r) => r && r.n); o.risk.forEach((r) => { if (!VT[r.type]) r.type = "watch"; });
  if (!o.verdict || typeof o.verdict !== "object") o.verdict = { type: "watch", label: "", text: "" }; if (!VT[o.verdict.type]) o.verdict.type = "watch";
  o.series = o.series.filter((s) => s && Array.isArray(s.x) && Array.isArray(s.y) && s.x.length === s.y.length && s.x.length >= 2).slice(0, 4);
  o.qa = o.qa.slice(0, 7).filter((q) => q && q.q && q.a);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(o.nextEarnings || ""))) o.nextEarnings = null;
  // 발표 직후라 콜 내용을 못 찾았으면 하루 뒤 한 번만 다시 본다
  const fresh = o.reported && /^\d{4}-\d{2}-\d{2}/.test(o.reported) && Date.now() - Date.parse(o.reported) < 6 * 86400e3;
  o.qaRetry = !o.qa.length && fresh && !(prev && prev.qaRetry && prev.quarter === o.quarter) ? 1 : 0;
  /* 실적일이 지나 돌았는데 분기가 그대로면(발표가 밀렸거나 아직 안 올라옴) 이틀 뒤 다시 — 최대 3번 */
  o.recheck = null; o.tries = 0;
  if (why === "earnings" && prev && prev.quarter === o.quarter) { o.tries = (prev.tries || 0) + 1; if (o.tries <= 3) o.recheck = kstDay(Date.now() + 2 * 86400e3); }
  /* 직접 붙여넣은 답에 본문 · 표가 같이 왔으면 다듬어 둔다 */
  const dp = cleanDeep(o); ["story", "tables", "targets"].forEach((k) => { o[k] = dp ? dp[k] : []; }); if (dp) { o.targetNote = dp.targetNote; o.watch = dp.watch; }
  o.snap = (Array.isArray(o.snap) ? o.snap : []).filter((x) => x && x.k && x.v != null).slice(0, 8).map((x) => ({ k: String(x.k).slice(0, 30), v: String(x.v).slice(0, 30), s: String(x.s || "").slice(0, 60) }));
  o.savedAt = Date.now(); o.auto = why === "manual" ? 2 : 1; return o;
}

async function prices(rc, syms) {
  const out = {}; try { const t = await getJsonGzText(rc, KEY.recent); const S = (t && JSON.parse(t).symbols) || {};
    syms.forEach((s) => { const r = S[s]; if (!r || !r.c || !r.c.length) return; const n = r.c.length; let hi = 0; for (let i = Math.max(0, n - 252); i < n; i++) if (r.c[i] > hi) hi = r.c[i]; out[s] = { c: r.c[n - 1], hi, d: r.t ? new Date(r.t[n - 1] * 1000).toISOString().slice(0, 10) : "" }; }); } catch (e) {}
  return out;
}

/* 계산표의 결과를 자료에 합친다 — 코드가 계산한 것이 AI가 쓴 것보다 우선 */
export function mergeFacts(d, F, note) {
  if (!F) return; const fin = note && note.fin ? cleanFin(note.fin) : null;
  if (F.px) { d.pxs = F.px; d.price = d.price || {}; d.price.base = F.px.px; d.price.baseDate = F.px.date; d.price.high = F.px.hi; d.price.highDate = F.px.hiDate; }
  if (F.ok) {
    d.ctables = F.tables; d.kv = F.kv; d.calcWarn = F.warn;
    const mine = (d.series || []).filter((s) => !F.series.concat(F.extra).some((x) => x.n === s.n)).slice(0, 2);
    d.series = F.series.concat(mine).slice(0, 4); d.extra = F.extra.slice(0, 4);
    const keep = (d.val || []).filter((v) => v && /선행|forward/i.test(v.k || "") && v.v != null);
    /* 선행 PER: AI가 못 채웠으면 계산표의 예상 EPS와 앱 종가로 */
    if (!keep.length && fin && fin.est && fin.est.eps && F.px) { const e = fin.est.eps.find((x) => x > 0); if (e) keep.push({ k: "선행 PER (" + fin.est.fy[fin.est.eps.indexOf(e)] + " 예상 EPS)", v: +(F.px.px / e).toFixed(1), unit: "배", lo: null, avg: null, hi: null, pct: null, lowGood: true, calc: 1 }); }
    d.val = keep.slice(0, 1).concat(F.val);
  }
  if (fin) {
    if (fin.targets.avg) { d.price.target = fin.targets.avg; d.price.targetN = fin.targets.n || d.price.targetN || null; d.price.targetNote = (fin.targets.asOf ? fin.targets.asOf + " · " : "") + (fin.src[1] || fin.src[0] || ""); }
    if (fin.targets.list.length) { d.targets = fin.targets.list; d.targetNote = "평균 " + (fin.targets.avg || "미확인") + (fin.targets.n ? " · " + fin.targets.n + "명" : "") + (fin.targets.asOf ? " · " + fin.targets.asOf : ""); }
    if (fin.rating && (fin.rating.buy != null || fin.rating.hold != null)) d.rating = fin.rating;
  }
  /* 시나리오 반영 주가 = 적용 EPS × 적용 배수 (코드 계산) */
  const base = d.price && d.price.base;
  (d.scen || []).forEach((s) => { const e = +s.eps, m = +s.mult; if (isFinite(e) && isFinite(m) && e > 0 && m > 0) { s.px = +(e * m).toFixed(2); if (base) s.gap = +(((s.px / base) - 1) * 100).toFixed(0); } else if (!(+s.px > 0)) { s.px = null; s.gap = null; } });
}

/* ---------- v13.80 3단계 수집: 조사 → 핵심 정리 → 깊이 ----------
   한 번의 함수 실행(300초)에 한 단계만 한다. 단계가 끝나면 같은 주소를 다시 불러(CRON_SECRET) 다음 단계로 넘긴다.
   조사 노트는 cfg:follownote:<종목>에 둔다 — 뒤 단계가 실패했을 때 하루 안에는 다시 검색하지 않고 노트부터 이어 간다(검색 비용을 두 번 쓰지 않게) */
const STEPS = { data: "1/4 재무 숫자", research: "2/4 발표문 · 콜 조사", core: "3/4 판정 · KPI", deep: "4/4 본문 · 표" };
/* v13.90 1단계가 열어 볼 주소 — 분기 재무표를 그대로 싣는 공개 페이지. web_fetch 는 사용자 메시지에 있는 주소만 열 수 있어서 여기서 만들어 준다 (미국 상장 종목만) */
function dataUrls(sym) {
  if (!/^[A-Z][A-Z.\-]{0,6}$/.test(sym)) return [];
  const t = sym.toLowerCase().replace("-", "."), b = "https://stockanalysis.com/stocks/" + t + "/";
  return [["분기 손익계산서", b + "financials/?p=quarterly"], ["분기 재무상태표", b + "financials/balance-sheet/?p=quarterly"], ["분기 현금흐름표", b + "financials/cash-flow-statement/?p=quarterly"], ["분기별 배수(PE · PS · P/FCF)", b + "financials/ratios/?p=quarterly"], ["애널리스트 예상 · 목표가", b + "forecast/"], ["통계", b + "statistics/"]];
}
async function chartOf(rc, sym) {
  const fix = (j) => (j && Array.isArray(j.c) && Array.isArray(j.t) && j.c.length ? { t: j.t[0] > 1e11 ? j.t.map((x) => Math.floor(x / 1000)) : j.t, c: j.c, sym } : null);
  try { const t = await getJsonGzText(rc, KEY.chart(sym)); const h = fix(t ? JSON.parse(t) : null); if (h) return h; } catch (e) {}
  try { const t = await getJsonGzText(rc, KEY.recent); const S = (t && JSON.parse(t).symbols) || {}; return fix(S[sym]); } catch (e) { return null; }   // 과거 전체가 없으면 최근 400일로
}
/* 가격 통계 + 계산표: note.fin(1단계가 옮겨 적은 표)과 앱 가격으로 매 단계 다시 계산한다(가벼운 계산) */
async function factsOf(rc, sym, note) {
  const h = await chartOf(rc, sym), bsym = /\.K[SQ]$/.test(sym) ? "^KS11" : "QQQ", b = h ? await chartOf(rc, bsym) : null;
  const px = h ? priceStats(h, b) : null; if (px && b) px.bench = bsym === "QQQ" ? "나스닥100(QQQ)" : "코스피";
  return calcFacts(note && note.fin ? cleanFin(note.fin) : null, px, (note && note.naver) || "");
}
async function chain(origin, body) {
  if (!origin || !process.env.CRON_SECRET) return false;
  /* 받은 쪽은 바로 '시작함'으로 답한다. 답이 늦어 끊은 경우(AbortError)는 요청이 이미 전달된 것으로 본다 — 실패로 기록해 두 실행이 엇갈리지 않게 */
  try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
    const fr = await fetch(origin + "/api/channel?op=follow", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: "Bearer " + process.env.CRON_SECRET }, body: JSON.stringify(body) }).catch((e) => (e && e.name === "AbortError" ? { ok: true } : null));
    clearTimeout(tm); return !!(fr && fr.ok); } catch (e) { return false; }
}
async function loadLog(rc) { const log = (await kvGet(rc, "cfg:followlog")) || {}; if (!log.runs) log.runs = []; if (!log.tried) log.tried = {}; return log; }
const tokOf = (out) => (out && out.usage ? (out.usage.input_tokens || 0) + (out.usage.output_tokens || 0) : 0);

/* 한 단계 실행. st = { s, why, step, q('due'|null), depth, t0, tok, web } */
export async function followStep(st, origin) {
  const rc = redisConf(); if (!rc) return { ok: false, reason: "NO_REDIS" };
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return { ok: false, reason: "NO_KEY" };
  const today = kstDay(), cmax = +(process.env.CLAUDE_DAILY_MAX || 60), sym = st.s; let log = await loadLog(rc);
  const finish = async (ok, msg, extra) => {   // 기록을 남기고 진행 표시를 지운다. 자동 대기열이면 다음 종목으로
    log = await loadLog(rc); const rec = Object.assign({ at: Date.now(), s: sym, why: st.why, ok, msg, tok: st.tok || 0, web: st.web || 0, sec: Math.round((Date.now() - (st.t0 || Date.now())) / 1000) }, extra || {});
    log.tried[sym] = today; Object.keys(log.tried).forEach((k) => { if (log.tried[k] !== today) delete log.tried[k]; });
    log.runs.unshift(rec); log.runs = log.runs.slice(0, 30); log.running = null; log.last = Date.now(); await kvPut(rc, "cfg:followlog", log);
    if (st.q === "due" && (st.depth || 0) < 6) await chain(origin, { depth: (st.depth || 0) + 1 });
    return { ok: true, done: [rec] };
  };
  const mark = async () => { log.running = { s: sym, at: Date.now(), t0: st.t0, why: st.why, step: st.step, label: STEPS[st.step] }; await kvPut(rc, "cfg:followlog", log); };
  const next = async (step) => {   // 다음 단계로 넘긴다 — 못 넘기면(CRON_SECRET 없음 등) 여기서 이어서 하지 않고 알린다
    const st2 = Object.assign({}, st, { step }); log = await loadLog(rc); log.running = { s: sym, at: Date.now(), t0: st.t0, why: st.why, step, label: STEPS[step] }; await kvPut(rc, "cfg:followlog", log);
    if (await chain(origin, { step: st2 })) return { ok: true, next: step };
    return finish(false, STEPS[step] + " 단계로 넘어가지 못했어요 — Vercel 환경변수 CRON_SECRET을 확인해 주세요(조사 노트는 남아 있어 다시 누르면 이어서 해요)");
  };
  let cu = 0; try { cu = +(await redisCmd(rc, ["INCR", "sm:claude:" + today])) || 0; } catch (e) {}
  if (cu > cmax) return finish(false, "오늘 Claude 작업 횟수(" + cmax + "회)를 다 썼어요");
  await mark();
  const prev = await kvGet(rc, "cfg:follow:" + sym), left = () => Math.max(60000, 288000 - (Date.now() - st.t1));
  const fail = (out, what) => finish(false, STEPS[st.step] + " 실패 — " + ((out && (out.msg || out.reason)) || what || "알 수 없는 오류"));

  if (st.step === "data") {
    /* 1단계: 재무 사이트의 분기 표를 옮겨 적는다(판단 없음). 하루 안에 받아 둔 것이 있고 뒤 단계가 실패했던 거라면 건너뛴다 */
    const old = await kvGet(rc, "cfg:follownote:" + sym);
    if (old && !old.used && Date.now() - old.at < 24 * 3600e3 && !st.fresh && (old.fin || old.dataTried)) { st.reused = 1; return next(old.text ? "core" : "research"); }
    const urls = dataUrls(sym); let naver = "";
    try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 12000); const fr = await fetch(origin + "/api/fund?symbol=" + encodeURIComponent(sym), { signal: ac.signal }).catch(() => null); clearTimeout(tm); if (fr && fr.ok) naver = naverText(await fr.json().catch(() => null)); } catch (e) {}
    const inp = "[종목] " + sym + (prev && prev.name ? " (" + prev.name + ")" : "") + "\n\n" + (urls.length ? "[열어 볼 주소 — 위에서부터]\n" + urls.map((u) => "- " + u[0] + ": " + u[1]).join("\n") : "[주소 없음] 이 종목은 정해진 주소가 없다. web_search로 분기 손익계산서 · 재무상태표 · 현금흐름표 · 컨센서스 · 목표가 표를 찾아 web_fetch로 연다.");
    let out; try { out = await runClaude({ task: "followF", input: inp, json: true, need: ["q", "rows"], budgetMs: left() }, key, cu); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
    st.tok = (st.tok || 0) + tokOf(out); st.web = (st.web || 0) + ((out && out.searches) || []).length;
    const fin = out && out.ok ? cleanFin(out.data) : null;
    st.fin = fin ? fin.q.length : 0; st.finMsg = fin ? "" : String((out && (out.msg || out.reason)) || "분기 표를 읽지 못함").slice(0, 80);
    await kvPut(rc, "cfg:follownote:" + sym, { at: Date.now(), fin: fin ? out.data : null, dataTried: 1, dataRead: ((out && out.fetched) || []).length, naver, text: "", used: 0 });
    return next("research");   // 표를 못 읽어도 멈추지 않는다 — 뒤 단계가 검색으로 채우고, 기록에 남긴다
  }
  if (st.step === "research") {
    const old = (await kvGet(rc, "cfg:follownote:" + sym)) || { at: Date.now(), used: 0 };
    const F = await factsOf(rc, sym, old);
    let out; try { out = await runClaude({ task: "followR", input: buildInput(sym, prev, null, st.why) + "\n\n[계산표 — 이미 확보한 숫자. 다시 찾지 않는다]\n" + (F.text || "(없음 — 이 경우 분기 숫자도 함께 찾아 노트 맨 앞에 표로 적는다)"), budgetMs: left() }, key, cu); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
    st.tok = (st.tok || 0) + tokOf(out); st.web = (st.web || 0) + ((out && out.searches) || []).length;
    const text = out && out.ok ? String(out.text || "").trim() : "";
    if (text.length < 1200) return fail(out, "조사 노트가 너무 짧아요(" + text.length + "자) — 실적 자료를 찾지 못한 것 같아요");
    await kvPut(rc, "cfg:follownote:" + sym, Object.assign({}, old, { at: Date.now(), text: text.slice(0, 40000), links: (out.sources || []).slice(0, 10), fetched: (out.fetched || []).length + (old.dataRead || 0), nofetch: !!out.nofetch, model: out.model, used: 0 }));
    st.read = (out.fetched || []).length;
    return next("core");
  }
  const note = await kvGet(rc, "cfg:follownote:" + sym);
  if (!note || !note.text) return finish(false, "조사 노트가 없어요 — 다시 받아와 주세요");
  const F = await factsOf(rc, sym, note);
  const input = buildInput(sym, prev, null, st.why) + "\n\n[계산표 — 앱이 계산한 값. 1순위 근거]\n" + (F.text || "(없음)") + "\n\n[조사 노트]\n" + note.text;

  if (st.step === "core") {
    let out; try { out = await runClaude({ task: "follow", input, json: true, need: ["quarter", "kpi|kpis|KPI|KPIs"], budgetMs: left() }, key, cu); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
    st.tok = (st.tok || 0) + tokOf(out);
    const data = out && out.ok ? clean(out.data, sym, prev, st.why) : null;
    if (!data) return fail(out, "KPI 목록이 비어 저장하지 않았어요");
    data.links = note.links || []; data.model = out.model; data.read = note.fetched || 0; data.deep = 0;
    mergeFacts(data, F, note);
    if (prev && prev.quarter === data.quarter && prev.story && prev.story.length) { ["story", "tables", "targets", "targetNote", "watch"].forEach((k) => { if (!(data[k] && data[k].length) && prev[k]) data[k] = prev[k]; }); }   // 깊이 단계가 실패해도 같은 분기의 지난 본문은 남긴다
    await kvPut(rc, "cfg:follow:" + sym, data); st.quarter = data.quarter; st.cut = out.truncated ? 1 : 0;
    return next("deep");
  }
  if (st.step === "deep") {
    const cur = await kvGet(rc, "cfg:follow:" + sym); if (!cur) return finish(false, "핵심 자료가 없어요 — 다시 받아와 주세요");
    let out; try { out = await runClaude({ task: "followD", input: input + "\n\n[이미 정한 판정] " + ((cur.verdict && cur.verdict.label) || "") + " · " + (cur.headline || ""), json: true, need: ["story|tables"], budgetMs: left() }, key, cu); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
    st.tok = (st.tok || 0) + tokOf(out);
    const dp = out && out.ok ? cleanDeep(out.data) : null;
    note.used = 1; await kvPut(rc, "cfg:follownote:" + sym, note);
    if (!dp) return finish(true, cur.quarter + " 저장 — 핵심만(본문 · 표는 실패: " + String((out && (out.msg || out.reason)) || "형식").slice(0, 90) + ")", { part: 1 });
    if (cur.targets && cur.targets.length && !(dp.targets && dp.targets.length)) { dp.targets = cur.targets; dp.targetNote = cur.targetNote || dp.targetNote; }   // 1단계 표에서 온 목표가는 지우지 않는다
    Object.assign(cur, dp); cur.deep = 1; cur.savedAt = Date.now(); await kvPut(rc, "cfg:follow:" + sym, cur);
    return finish(true, cur.quarter + " 저장 · " + (F.ok ? "재무표 " + F.q.length + "분기 계산" : "재무표 못 읽음(" + (st.finMsg || "검색으로 대신") + ")") + " · 본문 " + dp.story.length + "단락 · 표 " + (dp.tables.length + ((cur.ctables || []).length)) + "개" + (note.fetched ? " · 원문 " + note.fetched + "건 읽음" : note.nofetch ? " · 원문 읽기 불가(검색 요약만)" : "") + (st.cut ? " · 핵심 답이 끊겨 일부 없음" : ""));
  }
  return finish(false, "알 수 없는 단계");
}

/* 시작: only 가 있으면 그 종목(직접 요청), 없으면 실적 다음 날이 된 종목 하나 */
export async function followStart(opt, origin) {
  opt = opt || {}; const rc = redisConf(); if (!rc) return { ok: false, reason: "NO_REDIS" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" };
  const cfg = (await kvGet(rc, "cfg:follow")) || {}, today = kstDay(), log = await loadLog(rc);
  if (opt.only) { if (!okSym(opt.only)) return { ok: false, reason: "BAD_SYM" }; return followStep({ s: opt.only, why: "manual", step: "data", q: null, t0: Date.now(), t1: Date.now(), fresh: opt.fresh ? 1 : 0 }, origin); }
  if (cfg.auto === false) return { ok: true, skipped: "자동 수집이 꺼져 있어요" };
  const max = +(process.env.FOLLOW_DAILY_MAX || 3), dayKey = "sm:follow:" + today; let used = 0; try { used = +(await redisCmd(rc, ["GET", dayKey])) || 0; } catch (e) {}
  const todo = []; for (const s of (cfg.list || []).filter(okSym)) { if (log.tried[s] === today) continue; const why = followDue(await kvGet(rc, "cfg:follow:" + s), today); if (why) todo.push({ s, why }); }
  todo.sort((a, b) => (a.why === b.why ? 0 : a.why === "earnings" ? -1 : 1));
  if (!todo.length) return { ok: true, done: [], note: "오늘 반영할 종목이 없어요" };
  if (used >= max) return { ok: true, done: [], note: "오늘 자동 수집 한도(" + max + "종목)를 다 썼어요 — 내일 이어서 해요", used, max };
  try { used = +(await redisCmd(rc, ["INCR", dayKey])) || used + 1; if (used === 1) await redisCmd(rc, ["EXPIRE", dayKey, String(3 * 86400)]); } catch (e) {}
  return followStep({ s: todo[0].s, why: todo[0].why, step: "data", q: "due", depth: opt.depth || 0, t0: Date.now(), t1: Date.now() }, origin);
}

export async function followHandler(req, res, viaCron) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const rc = redisConf(); if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } } b = b || {};
  if (b.status) {   // 화면이 물어보는 상태: 기록 · 진행 중 · 오늘 쓴 횟수 · 오늘 반영할 종목 · 다음 예정
    const cfg = (await kvGet(rc, "cfg:follow")) || {}, log = (await kvGet(rc, "cfg:followlog")) || {}, today = kstDay(); let used = 0; try { used = +(await redisCmd(rc, ["GET", "sm:follow:" + today])) || 0; } catch (e) {}
    const due = [], plan = [];
    for (const s of (cfg.list || []).filter(okSym)) { const d = await kvGet(rc, "cfg:follow:" + s), why = followDue(d, today), nx = followNext(d); if (why) due.push({ s, why, tried: (log.tried || {})[s] === today }); else if (nx && nx.day >= today) plan.push({ s, day: nx.day, est: nx.est }); }
    plan.sort((a, b2) => (a.day < b2.day ? -1 : 1));
    /* 단계가 함수 시간 한도(300초)에 걸려 죽으면 기록 없이 멈춘다 — 여기서 알아채고 실패로 남긴다 */
    if (log.running && Date.now() - log.running.at >= 330000) { log.runs = log.runs || []; log.runs.unshift({ at: Date.now(), s: log.running.s, why: log.running.why, ok: false, msg: (log.running.label || "") + " 단계가 시간 한도(5분)를 넘겨 멈췄어요 — 다시 누르면 조사 노트부터 이어서 해요", tok: 0, web: 0 }); log.runs = log.runs.slice(0, 30); log.running = null; await kvPut(rc, "cfg:followlog", log); }
    const running = log.running || null;
    return res.status(200).json({ ok: true, auto: cfg.auto !== false, used, max: +(process.env.FOLLOW_DAILY_MAX || 3), due, plan: plan.slice(0, 5), running, runs: (log.runs || []).slice(0, 12), last: log.last || null, key: !!process.env.ANTHROPIC_API_KEY, chain: !!process.env.CRON_SECRET });
  }
  const origin = (req.headers["x-forwarded-proto"] || "https") + "://" + req.headers.host;
  let waitUntil = null; try { const m = await import("@vercel/functions"); waitUntil = m && m.waitUntil; } catch (e) { waitUntil = null; }
  const go = async (p) => { if (typeof waitUntil === "function") { waitUntil(p().catch(() => null)); return res.status(200).json({ ok: true, started: true }); } return res.status(200).json(await p()); };
  /* 다음 단계로 넘어온 호출 — 서버끼리만(CRON_SECRET) */
  if (viaCron && b.step && okSym(b.step.s) && STEPS[b.step.step]) { const st = Object.assign({}, b.step, { t1: Date.now() }); return go(() => followStep(st, origin)); }
  const only = b.run && b.run !== "due" ? String(b.run).toUpperCase() : null;
  if (!viaCron && !b.run) return res.status(400).json({ ok: false, reason: "status · run 중 하나" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" });
  if (!process.env.CRON_SECRET) return res.status(200).json({ ok: false, reason: "NO_CHAIN", msg: "Vercel 환경변수에 CRON_SECRET이 없어 단계를 이어 갈 수 없어요" });
  const log0 = (await kvGet(rc, "cfg:followlog")) || {};
  if (log0.running && Date.now() - log0.running.at < 330000) return res.status(200).json({ ok: true, busy: true, running: log0.running });
  const depth = viaCron ? Math.max(0, Math.min(9, +b.depth || 0)) : 0;
  return go(() => followStart({ only, depth, fresh: b.fresh }, origin));
}
