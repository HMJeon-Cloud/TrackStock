// /api/hit?s=SYM&k=view|watch — 종목 조회/관심 담기 횟수 집계 (인기 종목 자동 갱신용)
//   개인 정보 없이 "어떤 종목이 몇 번"만 센다. 주 단위 키(sm:pop:YYYY-WW)에 ZINCRBY, 3주 뒤 자동 삭제.
//   브라우저가 같은 종목을 하루에 한 번만 보내므로(클라이언트에서 제한) 명령 수는 하루 수백 회 수준이다.
import { redisConf, redisCmd } from "./_redis.js";

export function weekKey(d) {
  // ISO 주차 (월요일 시작)
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return "sm:pop:" + t.getUTCFullYear() + "-" + String(w).padStart(2, "0");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const s = String(req.query.s || "").trim().toUpperCase();
  const k = req.query.k === "watch" ? "watch" : "view";
  if (!/^[A-Z0-9^.=\-]{1,14}$/.test(s)) return res.status(400).json({ ok: false });
  const redis = redisConf();
  if (!redis) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  try {
    const key = weekKey(new Date());
    const weight = k === "watch" ? 3 : 1;
    const score = await redisCmd(redis, ["ZINCRBY", key, String(weight), s]);
    if (Number(score) === weight) await redisCmd(redis, ["EXPIRE", key, String(21 * 86400)]);   // 이번 주 첫 등장이면 만료 설정
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
}
