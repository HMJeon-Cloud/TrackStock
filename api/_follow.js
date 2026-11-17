// v13.70 실적 팔로업 자동 수집 — /api/channel?op=follow (POST). 새 서버 함수 · 새 크론 없음.
//   하는 일: 지켜보는 종목 가운데 '갱신할 때가 된' 종목을 골라 Claude API(웹 검색)로 분기 실적 자료(JSON)를 만들고 서버 보관함에 저장한다.
//   언제: ① 아침 수집(한국 09:00) 끝에 수집기가 이 주소를 한 번 부른다(CRON_SECRET) ② 운영자가 화면에서 '지금 확인' · 종목별 '지금 갱신'
//   자동으로 도는 때(v13.71): 실적 발표 다음 날 한국 아침만 (+ 콜 Q&A가 비었으면 하루 뒤 한 번, 발표가 밀렸으면 이틀 뒤 다시). 그 밖의 날은 확인만 하고 Claude를 부르지 않는다
//   자료가 없는 종목 · 원하는 종목은 화면에서 직접 받아온다(run: 종목)
//   비용 보호: 하루 FOLLOW_DAILY_MAX(기본 3)종목까지 · 같은 종목은 하루 한 번 · Claude 하루 상한(CLAUDE_DAILY_MAX)에도 같이 센다
//   저장: sm:kv:cfg:follow(목록 · 자동 켬/끔 — 화면이 씀) · sm:kv:cfg:follow:<종목>(자료) · sm:kv:cfg:followlog(기록 · 진행 중 표시 — 서버가 씀)
import { redisConf, redisCmd, setJsonGz, getJsonGzText, KEY } from "./_redis.js";
import { runClaude } from "./_claude.js";

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
    if (why === "qa") L.push("\n지난번에는 콘퍼런스콜 질의응답을 찾지 못했다. 이번에는 콜 전문 · 요약 기사를 찾아 qa와 qaRead를 채운다.");
  } else L.push("\n[KPI 고르는 법] 이 회사의 주가를 실제로 움직이는 지표 8~14개를 고른다(가이던스 대비 상회율, 핵심 사업부 성장률, 선행지표(수주 · 잔고 · 고객 수), 마진, 주식 보상, 연간 가이던스 등). 지표마다 '이 선을 넘으면 주의'인 경고선을 정한다.");
  return L.join("\n");
}
function clean(o, sym, prev, why) {
  if (!o || typeof o !== "object" || !o.quarter || !Array.isArray(o.kpi) || !o.kpi.length) return null;
  o.sym = sym; ["summary", "val", "kpi", "risk", "series", "qa", "scen", "bull", "bear", "terms", "sources"].forEach((k) => { if (!Array.isArray(o[k])) o[k] = []; });
  const ST = { good: 1, warn: 1, bad: 1, info: 1 }, VT = { temp: 1, watch: 1, struct: 1, ok: 1 };
  o.kpi = o.kpi.slice(0, 16).filter((k) => k && k.n); o.kpi.forEach((k) => { if (!ST[k.state]) k.state = "info"; });
  o.risk = o.risk.slice(0, 10).filter((r) => r && r.n); o.risk.forEach((r) => { if (!VT[r.type]) r.type = "watch"; });
  if (!o.verdict || typeof o.verdict !== "object") o.verdict = { type: "watch", label: "", text: "" }; if (!VT[o.verdict.type]) o.verdict.type = "watch";
  o.series = o.series.filter((s) => s && Array.isArray(s.x) && Array.isArray(s.y) && s.x.length === s.y.length && s.x.length >= 2).slice(0, 4);
  o.qa = o.qa.slice(0, 6).filter((q) => q && q.q && q.a);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(o.nextEarnings || ""))) o.nextEarnings = null;
  // 발표 직후라 콜 내용을 못 찾았으면 하루 뒤 한 번만 다시 본다
  const fresh = o.reported && /^\d{4}-\d{2}-\d{2}/.test(o.reported) && Date.now() - Date.parse(o.reported) < 6 * 86400e3;
  o.qaRetry = !o.qa.length && fresh && !(prev && prev.qaRetry && prev.quarter === o.quarter) ? 1 : 0;
  /* 실적일이 지나 돌았는데 분기가 그대로면(발표가 밀렸거나 아직 안 올라옴) 이틀 뒤 다시 — 최대 3번 */
  o.recheck = null; o.tries = 0;
  if (why === "earnings" && prev && prev.quarter === o.quarter) { o.tries = (prev.tries || 0) + 1; if (o.tries <= 3) o.recheck = kstDay(Date.now() + 2 * 86400e3); }
  o.savedAt = Date.now(); o.auto = why === "manual" ? 2 : 1; return o;
}

async function prices(rc, syms) {
  const out = {}; try { const t = await getJsonGzText(rc, KEY.recent); const S = (t && JSON.parse(t).symbols) || {};
    syms.forEach((s) => { const r = S[s]; if (!r || !r.c || !r.c.length) return; const n = r.c.length; let hi = 0; for (let i = Math.max(0, n - 252); i < n; i++) if (r.c[i] > hi) hi = r.c[i]; out[s] = { c: r.c[n - 1], hi, d: r.t ? new Date(r.t[n - 1] * 1000).toISOString().slice(0, 10) : "" }; }); } catch (e) {}
  return out;
}

/* 실제 수집 — only 가 있으면 그 종목만(직접 요청), 없으면 때가 된 종목을 하루 상한까지 */
export async function followRun(opt) {
  opt = opt || {}; const rc = redisConf(); if (!rc) return { ok: false, reason: "NO_REDIS" };
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return { ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" };
  const cfg = (await kvGet(rc, "cfg:follow")) || {}, list = (cfg.list || []).filter(okSym), today = kstDay();
  if (!opt.only && cfg.auto === false) return { ok: true, skipped: "자동 수집이 꺼져 있어요" };
  const log = (await kvGet(rc, "cfg:followlog")) || { runs: [], tried: {} }; if (!log.runs) log.runs = []; if (!log.tried) log.tried = {};
  const cmax = +(process.env.CLAUDE_DAILY_MAX || 60), max = +(process.env.FOLLOW_DAILY_MAX || 3), dayKey = "sm:follow:" + today;
  let used = 0; try { used = +(await redisCmd(rc, ["GET", dayKey])) || 0; } catch (e) {}
  let todo = [];
  if (opt.only) { if (!okSym(opt.only)) return { ok: false, reason: "BAD_SYM" }; todo = [{ s: opt.only, why: "manual", prev: await kvGet(rc, "cfg:follow:" + opt.only) }]; }
  else {
    for (const s of list) { if (log.tried[s] === today) continue; const prev = await kvGet(rc, "cfg:follow:" + s), why = followDue(prev, today); if (why) todo.push({ s, why, prev }); }
    const rank = { earnings: 0, qa: 1 }; todo.sort((a, b) => rank[a.why] - rank[b.why]);
  }
  if (!todo.length) return { ok: true, done: [], note: "갱신할 종목이 없어요" };
  const px = await prices(rc, todo.map((x) => x.s)), done = [], t0 = Date.now();
  for (const it of todo) {
    if (!opt.only && used >= max) { done.push({ s: it.s, ok: false, msg: "오늘 자동 수집 한도(" + max + "종목)를 다 썼어요 — 내일 이어서 해요", skip: 1 }); continue; }
    if (Date.now() - t0 > 200000) { done.push({ s: it.s, ok: false, msg: "이번 실행 시간이 모자라 다음으로 미뤘어요", skip: 1 }); continue; }   // 함수 한도 300초
    log.running = { s: it.s, at: Date.now(), why: it.why }; await kvPut(rc, "cfg:followlog", log);
    /* Claude 하루 상한(글 작성과 같이 쓰는 숫자)을 넘기지 않는다. 자동 수집 한도는 자동으로 돈 것만 센다(직접 요청은 따로) */
    let cu = 0; try { cu = +(await redisCmd(rc, ["INCR", "sm:claude:" + today])) || 0; } catch (e) {}
    if (cu > cmax) { done.push({ at: Date.now(), s: it.s, why: it.why, ok: false, msg: "오늘 Claude 작업 횟수(" + cmax + "회)를 다 썼어요", skip: opt.only ? 0 : 1 }); if (opt.only) { log.runs.unshift(done[done.length - 1]); log.runs = log.runs.slice(0, 30); } continue; }
    if (!opt.only) { try { used = +(await redisCmd(rc, ["INCR", dayKey])) || used + 1; if (used === 1) await redisCmd(rc, ["EXPIRE", dayKey, String(3 * 86400)]); } catch (e) {} }
    let out; try { out = await runClaude({ task: "follow", input: buildInput(it.s, it.prev, px[it.s], it.why), json: true, budgetMs: Math.max(60000, 285000 - (Date.now() - t0)) }, key, used); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
    const data = out && out.ok ? clean(out.data, it.s, it.prev, it.why) : null, rec = { at: Date.now(), s: it.s, why: it.why, ok: !!data, msg: data ? data.quarter + " 저장" : (out && (out.msg || out.reason)) || "형식이 맞지 않아 저장하지 않았어요", tok: out && out.usage ? (out.usage.input_tokens || 0) + (out.usage.output_tokens || 0) : 0, web: out && out.searches ? out.searches.length : 0, model: out && out.model };
    if (data) { if (out.sources && out.sources.length) data.links = out.sources.slice(0, 8); data.model = out.model; await kvPut(rc, "cfg:follow:" + it.s, data); }
    log.tried[it.s] = today; log.runs.unshift(rec); log.runs = log.runs.slice(0, 30); done.push(rec);
  }
  Object.keys(log.tried).forEach((k) => { if (log.tried[k] !== today) delete log.tried[k]; });
  log.running = null; log.last = Date.now(); await kvPut(rc, "cfg:followlog", log);
  /* 한 번 실행(300초)에 보통 한 종목이라, 시간 때문에 미룬 종목이 있고 하루 한도가 남았으면 새 실행으로 이어 간다(최대 4번 — 끝없이 돌지 않게) */
  let next = null;
  if (!opt.only && opt.origin && process.env.CRON_SECRET && (opt.depth || 0) < 4 && used < max && done.some((d) => d.skip && /시간/.test(d.msg))) {
    try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 6000);
      const fr = await fetch(opt.origin + "/api/channel?op=follow", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: "Bearer " + process.env.CRON_SECRET }, body: JSON.stringify({ depth: (opt.depth || 0) + 1 }) }).catch(() => null);
      clearTimeout(tm); next = fr && fr.ok ? "started" : "no answer"; } catch (e) { next = "error"; }
  }
  return { ok: true, done: done.filter((d) => !d.skip || !next), used, max, next };
}

export async function followHandler(req, res, viaCron) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const rc = redisConf(); if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } } b = b || {};
  if (b.status) {   // 화면이 물어보는 상태: 기록 · 진행 중 · 오늘 쓴 횟수 · 때가 된 종목
    const cfg = (await kvGet(rc, "cfg:follow")) || {}, log = (await kvGet(rc, "cfg:followlog")) || {}, today = kstDay(); let used = 0; try { used = +(await redisCmd(rc, ["GET", "sm:follow:" + today])) || 0; } catch (e) {}
    const due = [], plan = [];
    for (const s of (cfg.list || []).filter(okSym)) { const d = await kvGet(rc, "cfg:follow:" + s), why = followDue(d, today), nx = followNext(d); if (why) due.push({ s, why, tried: (log.tried || {})[s] === today }); else if (nx && nx.day >= today) plan.push({ s, day: nx.day, est: nx.est }); }
    plan.sort((a, b) => (a.day < b.day ? -1 : 1));
    const running = log.running && Date.now() - log.running.at < 320000 ? log.running : null;
    return res.status(200).json({ ok: true, auto: cfg.auto !== false, used, max: +(process.env.FOLLOW_DAILY_MAX || 3), due, plan: plan.slice(0, 5), running, runs: (log.runs || []).slice(0, 12), last: log.last || null, key: !!process.env.ANTHROPIC_API_KEY });
  }
  const only = b.run && b.run !== "due" ? String(b.run).toUpperCase() : null;
  if (!viaCron && !b.run) return res.status(400).json({ ok: false, reason: "status · run 중 하나" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" });
  const log0 = (await kvGet(rc, "cfg:followlog")) || {};
  if (log0.running && Date.now() - log0.running.at < 320000) return res.status(200).json({ ok: true, busy: true, running: log0.running });
  const origin = (req.headers["x-forwarded-proto"] || "https") + "://" + req.headers.host, depth = viaCron ? Math.max(0, Math.min(9, +b.depth || 0)) : 0;
  let waitUntil = null; try { const m = await import("@vercel/functions"); waitUntil = m && m.waitUntil; } catch (e) { waitUntil = null; }
  if (typeof waitUntil === "function") { waitUntil(followRun({ only, origin, depth }).catch(() => null)); return res.status(200).json({ ok: true, started: true, only }); }
  const out = await followRun({ only, origin, depth }); return res.status(200).json(out);
}
