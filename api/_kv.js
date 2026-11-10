// v12.62 작은 공용 저장소 — 운영자 하루 작업물을 기기 사이에 공유 (리포트 Claude 서술 · AI 문구 · 검수 · 올린 글 성과)
//   /api/channel?op=kv (POST) { get:"키" } | { put:"키", val:{...}, ex:초 } | { list:"접두" }
//   키는 허용 접두(rp: copy: chk: perf:)만, 값은 60KB 이하, 기본 3일 보관(설정·성과는 1년). 새 서버 함수 없음.
import { redisConf, setJsonGz, getJsonGzText, redisCmd } from "./_redis.js";
const OK = /^(rp|copy|chk|perf|cfg):[\w.\-:가-힣%|+]{1,160}$/;
export async function kvHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const rc = redisConf(); if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b) return res.status(400).json({ ok: false, reason: "본문 필요" });
  try {
    if (b.get) { if (!OK.test(b.get)) return res.status(400).json({ ok: false, reason: "키 형식" }); const t = await getJsonGzText(rc, "sm:kv:" + b.get); return res.status(200).json(t ? { ok: true, val: JSON.parse(t) } : { ok: false, reason: "NONE" }); }
    if (b.put) { if (!OK.test(b.put)) return res.status(400).json({ ok: false, reason: "키 형식" }); const s = JSON.stringify(b.val == null ? null : b.val); if (s.length > 60000) return res.status(400).json({ ok: false, reason: "TOO_BIG" }); await setJsonGz(rc, "sm:kv:" + b.put, b.val, Math.min(365 * 86400, Math.max(60, +(b.ex || 0) || (/^(perf|cfg):/.test(b.put) ? 365 * 86400 : 3 * 86400)))   /* v12.91 설정(cfg)·성과(perf)는 1년 보관 — 전엔 90일로 잘려 즐겨찾기가 사라질 수 있었음 */); return res.status(200).json({ ok: true }); }
    if (b.list) { if (!/^(rp|copy|chk|perf|cfg):/.test(b.list)) return res.status(400).json({ ok: false, reason: "접두" }); let cur = "0", keys = [], n = 0; do { const r = await redisCmd(rc, ["SCAN", cur, "MATCH", "sm:kv:" + b.list + "*", "COUNT", "200"]); cur = String(r[0]); keys = keys.concat(r[1] || []); } while (cur !== "0" && ++n < 20); const out = [], ks = keys.slice(0, 120); for (let i = 0; i < ks.length; i += 20) { const part = await Promise.all(ks.slice(i, i + 20).map((k) => getJsonGzText(rc, k).then((t) => (t ? { k: k.slice(6), v: JSON.parse(t) } : null)).catch(() => null))); part.forEach((x) => { if (x) out.push(x); }); }   /* v12.91 20개씩 동시에(전엔 하나씩 120번) */ return res.status(200).json({ ok: true, items: out }); }
    return res.status(400).json({ ok: false, reason: "get·put·list 중 하나" });
  } catch (e) { return res.status(200).json({ ok: false, reason: "ERROR", msg: String(e.message).slice(0, 160) }); }
}
