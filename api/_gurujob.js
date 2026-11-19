// 구루 '한 번에 처리' (v14.80) — 여러 인물의 발언 조사 + 해석을 서버가 이어서 처리한다
//   새 함수 · 새 크론 없음. /api/channel?op=guru 로 들어오고, 다음 차례는 CRON_SECRET으로 자기 자신을 다시 부른다(실적 팔로업과 같은 방식).
//   동시에 3줄(lane)로 달린다 — 한 줄이 한 사람의 '발언 조사 → 해석'을 끝내면 다음 사람을 가져간다.
//   상태: sm:gurujob (작업 · gzip) · sm:gurujob:i:<id> (다음 차례 번호) · sm:gurujob:r:<id> (사람별 결과, 해시)
//   인물 정보: sm:guruprof — 앱이 보낸 인물 사전 글을 저장해 두고, 13F 수집 뒤 자동 실행 때 쓴다
import { redisCmd, setJsonGz, getJsonGzText } from "./_redis.js";
import { GURUS } from "./_disc.js";
import { runNote, runRead } from "./_guru.js";

const JOB = "sm:gurujob", PROF = "sm:guruprof", CFG = "sm:gurucfg";
const rd = async (rc, k) => { try { const t = await getJsonGzText(rc, k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
const IDS = {}; GURUS.forEach((G) => { IDS[G.id] = G; });

export const jobAuto = {
  async saveProf(rc, id, p, ty) { if (!IDS[id] || !p) return; const P = (await rd(rc, PROF)) || {}; P[id] = { p: String(p).slice(0, 3500), ty: String(ty || "").slice(0, 80), at: Date.now() }; await setJsonGz(rc, PROF, P, 800 * 86400); },
};
async function chain(origin, body) {
  if (!origin || !process.env.CRON_SECRET) return false;
  try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
    const fr = await fetch(origin + "/api/channel?op=guru", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: "Bearer " + process.env.CRON_SECRET }, body: JSON.stringify(body) }).catch((e) => (e && e.name === "AbortError" ? { ok: true } : null));
    clearTimeout(tm); return !!(fr && fr.ok); } catch (e) { return false; }
}
async function setR(rc, jid, id, o) { try { await redisCmd(rc, ["HSET", "sm:gurujob:r:" + jid, id, JSON.stringify(Object.assign({ at: Date.now() }, o))]); await redisCmd(rc, ["EXPIRE", "sm:gurujob:r:" + jid, String(14 * 86400)]); } catch (e) {} }
async function getR(rc, jid) { const out = {}; try { const a = (await redisCmd(rc, ["HGETALL", "sm:gurujob:r:" + jid])) || []; for (let i = 0; i + 1 < a.length; i += 2) { try { out[a[i]] = JSON.parse(a[i + 1]); } catch (e) {} } } catch (e) {} return out; }
async function status(rc) {
  const job = await rd(rc, JOB); if (!job) return { ok: true, job: null };
  const R = await getR(rc, job.id), fin = job.ids.filter((id) => R[id] && (R[id].state === "done" || R[id].state === "fail")).length;
  const last = Math.max(job.at || 0, ...Object.values(R).map((x) => x.at || 0)), stale = fin < job.ids.length && Date.now() - last > 12 * 60e3;
  let used = 0; try { used = +(await redisCmd(rc, ["GET", "sm:claude:" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)])) || 0; } catch (e) {}
  return { ok: true, job: Object.assign({}, job, { prof: undefined }), res: R, fin, done: fin >= job.ids.length || job.stop && !Object.values(R).some((x) => x.state === "run"), stale, used, max: +(process.env.CLAUDE_DAILY_MAX || 60) };
}
/* 한 줄(lane)의 한 걸음 */
async function laneStep(rc, origin, r) {
  const job = await rd(rc, JOB); if (!job || job.id !== r.jid) return { ok: false, msg: "작업이 바뀌었어요" };
  let id = r.id, phase = r.phase;
  if (!id) {
    if (job.stop) return { ok: true, end: "stop" };
    const i = (+(await redisCmd(rc, ["INCR", "sm:gurujob:i:" + job.id])) || 1) - 1; if (i >= job.ids.length) return { ok: true, end: "empty" };
    id = job.ids[i]; phase = job.what === "read" ? "read" : "note";
  }
  const G = IDS[id], P = (job.prof && job.prof[id]) || ((await rd(rc, PROF)) || {})[id] || {};
  if (!G) { await setR(rc, job.id, id, { state: "fail", msg: "모르는 인물" }); return chain(origin, { jrun: { jid: job.id, lane: r.lane } }); }
  const prevR = (await getR(rc, job.id))[id] || {};
  await setR(rc, job.id, id, Object.assign({}, prevR, { state: "run", phase, lane: r.lane, t0: Date.now() }));
  const out = phase === "note" ? await runNote(rc, G, P.p || "") : await runRead(rc, G, P.p || "", P.ty || "");
  const rec = Object.assign({}, prevR, { lane: r.lane }); rec[phase] = out.ok ? "ok" : String(out.msg || "실패").slice(0, 140);
  const stop = !!((await rd(rc, JOB)) || {}).stop, more = phase === "note" && job.what === "both" && !stop;   // 발언 조사가 실패해도 해석은 이어서 한다(발언 없이 해석)
  if (more) { rec.state = "run"; rec.phase = "read"; }
  else { const key = job.what === "note" || (phase === "note" && stop) ? "note" : "read"; rec.state = rec[key] === "ok" ? "done" : "fail"; rec.phase = phase; }
  if (rec.state === "fail" && phase === "read" && /13F를 아직/.test(rec.read || "") && rec.note === "ok") { rec.state = "done"; rec.read = "13F 없음 — 발언만 저장"; }
  await setR(rc, job.id, id, rec);
  return chain(origin, more ? { jrun: { jid: job.id, lane: r.lane, id, phase: "read" } } : { jrun: { jid: job.id, lane: r.lane } });
}
async function start(rc, origin, o) {
  const cur = await status(rc); if (cur.job && !cur.done && !cur.stale && !o.force) return { ok: false, busy: true, msg: "이미 진행 중인 작업이 있어요(" + cur.fin + "/" + cur.job.ids.length + ") — 끝나거나 멈춘 뒤에 다시 시작해 주세요" };
  const ids = (Array.isArray(o.ids) ? o.ids : []).map(String).filter((id, i, a) => IDS[id] && a.indexOf(id) === i).slice(0, 40); if (!ids.length) return { ok: false, msg: "인물을 골라 주세요" };
  if (!process.env.CRON_SECRET) return { ok: false, msg: "Vercel 환경변수 CRON_SECRET이 없어 서버가 다음 차례를 이어 부를 수 없어요" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" };
  const what = ["both", "note", "read"].includes(o.what) ? o.what : "both", lanes = Math.max(1, Math.min(4, +o.lanes || 3));
  const prof = {}; const P0 = (await rd(rc, PROF)) || {}; ids.forEach((id) => { const p = o.profiles && o.profiles[id]; prof[id] = p && p.p ? { p: String(p.p).slice(0, 3500), ty: String(p.ty || "").slice(0, 80) } : P0[id] || {}; });
  if (o.profiles) { Object.keys(prof).forEach((id) => { if (prof[id].p) P0[id] = Object.assign({}, prof[id], { at: Date.now() }); }); await setJsonGz(rc, PROF, P0, 800 * 86400); }
  const job = { id: Date.now().toString(36), ids, what, lanes, at: Date.now(), by: o.by || "owner", prof, stop: false };
  await setJsonGz(rc, JOB, job, 14 * 86400);
  let ok = 0; for (let l = 0; l < Math.min(lanes, ids.length); l++) if (await chain(origin, { jrun: { jid: job.id, lane: l } })) ok++;
  return { ok: ok > 0, started: ok, msg: ok ? "" : "서버가 작업을 이어 부르지 못했어요" };
}
export async function guruJobHandler(req, res, rc, b, origin, viaCron) {
  let waitUntil = null; try { const m = await import("@vercel/functions"); waitUntil = m && m.waitUntil; } catch (e) { waitUntil = null; }
  const go = async (p) => { if (typeof waitUntil === "function") { waitUntil(p().catch(() => null)); return res.status(200).json({ ok: true, started: true }); } return res.status(200).json(await p()); };
  if (viaCron) {
    if (b.jrun) return go(() => laneStep(rc, origin, b.jrun));
    /* 13F 수집이 끝난 뒤(GitHub) — 운영자가 자동 실행을 켜 두었을 때만, 새 보고서가 온 사람만 */
    if (b.gjob) { const cfg = (await rd(rc, CFG)) || {}; if (!cfg.auto) return res.status(200).json({ ok: true, skipped: "자동 실행이 꺼져 있어요" });
      const P = (await rd(rc, PROF)) || {}, ids = (Array.isArray(b.gjob.ids) ? b.gjob.ids : []).filter((id) => P[id]);
      if (!ids.length) return res.status(200).json({ ok: true, skipped: "대상 없음(인물 정보가 저장된 사람이 없어요 — 앱에서 한 번 실행하면 저장돼요)" });
      return res.status(200).json(await start(rc, origin, { ids, what: cfg.what || "both", lanes: 3, by: "auto" })); }
    return res.status(200).json({ ok: false, reason: "NO_OP" });
  }
  if (b.jobstatus) { const s = await status(rc); s.cfg = (await rd(rc, CFG)) || { auto: false }; return res.status(200).json(s); }
  if (b.jobstop) { const job = await rd(rc, JOB); if (job) { job.stop = true; await setJsonGz(rc, JOB, job, 14 * 86400); } return res.status(200).json({ ok: true }); }
  if (b.jobcfg) { const c = { auto: !!b.jobcfg.auto, what: ["both", "note", "read"].includes(b.jobcfg.what) ? b.jobcfg.what : "both", at: Date.now() }; await setJsonGz(rc, CFG, c, 800 * 86400); if (b.profiles) { const P = (await rd(rc, PROF)) || {}; Object.keys(b.profiles).forEach((id) => { const p = b.profiles[id]; if (IDS[id] && p && p.p) P[id] = { p: String(p.p).slice(0, 3500), ty: String(p.ty || "").slice(0, 80), at: Date.now() }; }); await setJsonGz(rc, PROF, P, 800 * 86400); } return res.status(200).json({ ok: true, cfg: c }); }
  if (b.job) return res.status(200).json(await start(rc, origin, b.job));
  return res.status(200).json({ ok: false, reason: "NO_OP" });
}
