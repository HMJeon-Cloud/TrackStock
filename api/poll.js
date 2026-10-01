// /api/poll — '투자 마음 테스트' 응답 집계 (개인 정보 없이 "어떤 보기가 몇 번"만 센다)
//   기록: /api/poll?m=cash,fomo&s=good&b=news&f=buy&q=dip  → HINCRBY sm:mind (항목마다 1)
//   조회: /api/poll                                        → { total, counts } (CDN 10분 캐시)
//   브라우저가 하루 한 번만 보내므로(클라이언트 제한) 명령 수는 응답 1건당 2~3회 수준이다.
import { redisConf, redisCmd } from "./_redis.js";

const KEY = "sm:mind";
const ALLOWED = {
  m: ["cash", "rich", "fomo", "retire", "fun", "belief"],
  s: ["good", "cheap", "growth", "safe", "spread"],
  b: ["news", "rise", "friend", "dip", "leader", "study", "none"],
  f: ["buy", "hold", "sell", "panic"],
  q: ["now", "why", "drop", "others", "monthly", "diff", "tax"],
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const redis = redisConf();
  const write = ["m", "s", "b", "f", "q"].some((k) => req.query[k]);
  if (!write) {
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=600");
    if (!redis) return res.status(200).json({ ok: false, total: 0, counts: {} });
    try {
      const arr = (await redisCmd(redis, ["HGETALL", KEY])) || [];
      const counts = {};
      for (let i = 0; i < arr.length; i += 2) counts[arr[i]] = Number(arr[i + 1]) || 0;
      return res.status(200).json({ ok: true, total: counts.total || 0, counts });
    } catch (e) {
      return res.status(200).json({ ok: false, total: 0, counts: {} });
    }
  }
  res.setHeader("Cache-Control", "no-store");
  if (!redis) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  const fields = ["total"];
  for (const k of Object.keys(ALLOWED)) {
    const vals = String(req.query[k] || "").split(",").filter((v) => ALLOWED[k].includes(v)).slice(0, k === "m" ? 2 : 1);
    vals.forEach((v) => fields.push(k + ":" + v));
  }
  if (fields.length < 2) return res.status(400).json({ ok: false });
  try {
    // Upstash REST 파이프라인: 한 번의 요청으로 여러 HINCRBY
    const r = await fetch(redis.url + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + redis.token, "Content-Type": "application/json" },
      body: JSON.stringify(fields.map((f) => ["HINCRBY", KEY, f, "1"])),
    });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
}
