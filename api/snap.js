// /api/snap — 정적 스냅샷 제공.
//   ?recent=1  → 전 종목 최근 90일. Upstash Redis(sm:recent, gzip)를 먼저 보고, 없으면 Blob.
//   ?manifest=1, ?symbol=SYM → Blob 공개 URL 우회 (list()를 쓰지 않도록 BLOB_STORE_ID로 주소를 만든다)
import { gunzipSync } from "zlib";

function redisConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}
async function redisGet(conf, key) {
  const r = await fetch(conf.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + conf.token, "Content-Type": "application/json" },
    body: JSON.stringify(["GET", key]),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Redis: " + (j.error || "HTTP " + r.status));
  return j.result;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const symbol = (req.query.symbol || "").trim();
  const isRecent = req.query.recent === "1";
  const want = req.query.manifest === "1" ? "manifest.json"
    : isRecent ? "recent.json"
    : symbol ? "charts/" + encodeURIComponent(symbol) + ".json" : null;
  if (!want) return res.status(400).json({ error: "symbol required" });

  // ① recent는 Redis 우선 (Blob 정지 중에도 동작)
  if (isRecent) {
    const redis = redisConf();
    if (redis) {
      try {
        const gz = await redisGet(redis, "sm:recent");
        if (gz) {
          const text = gunzipSync(Buffer.from(gz, "base64")).toString("utf8");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("X-Snap-Store", "redis");
          // Redis 읽기는 사실상 무료라 30분만 캐시 → 아침 수집 직후 빨리 반영된다
          res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
          return res.status(200).send(text);
        }
      } catch (e) { /* Blob으로 */ }
    }
  }

  const id = (process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  if (!id) return res.status(404).json({ error: "no blob store" });

  try {
    const r = await fetch("https://" + id + ".public.blob.vercel-storage.com/" + want);
    if (!r.ok) return res.status(404).json({ error: "snapshot not found", status: r.status });
    const text = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Snap-Store", "blob");
    res.setHeader("Cache-Control", want.startsWith("charts/")
      ? "s-maxage=86400, stale-while-revalidate=172800"
      : "s-maxage=10800, stale-while-revalidate=21600");
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 160) });
  }
}
