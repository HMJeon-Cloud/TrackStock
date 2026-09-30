// /api/snap — Upstash Redis에 저장된 시세 스냅샷을 JSON으로 제공한다.
//   ?recent=1     → 전 종목 최근 90일           (CDN 30분 캐시: 아침 수집 직후 빨리 반영)
//   ?manifest=1   → 종목별 갱신일 목록           (CDN 30분)
//   ?symbol=SYM   → 그 종목 과거 전체(최대 25년) (CDN 24시간: 며칠에 한 번만 바뀐다)
// Redis 읽기 명령은 CDN 캐시 미스 때만 나가므로 하루 수백 회 수준이다.
import { redisConf, getJsonGzText, KEY } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const symbol = (req.query.symbol || "").trim();
  let key = null, cache = null;
  if (req.query.recent === "1") { key = KEY.recent; cache = "s-maxage=1800, stale-while-revalidate=3600"; }
  else if (req.query.manifest === "1") { key = KEY.manifest; cache = "s-maxage=1800, stale-while-revalidate=3600"; }
  else if (symbol) { key = KEY.chart(symbol); cache = "s-maxage=86400, stale-while-revalidate=172800"; }
  if (!key) return res.status(400).json({ error: "symbol required" });

  const redis = redisConf();
  if (!redis) return res.status(404).json({ error: "no store", reason: "NO_REDIS" });
  try {
    const text = await getJsonGzText(redis, key);
    if (!text) {
      res.setHeader("Cache-Control", "s-maxage=300");   // 아직 없음: 5분만 캐시 (수집 직후 곧 생긴다)
      return res.status(404).json({ error: "snapshot not found", reason: "NOT_YET" });
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Snap-Store", "redis");
    res.setHeader("Cache-Control", cache);
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 160) });
  }
}
