// /api/config — 클라이언트가 데이터 준비 상태를 알아내는 용도 (CDN 1시간 캐시).
//   스냅샷은 Upstash Redis에 있고 /api/snap 으로 읽는다. 여기서는 목록(manifest)의 요약만 돌려준다.
import { redisConf, getJsonGzText, KEY } from "./_redis.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const out = { store: null, snapshotBase: null, updated: null, reason: null, symbols: 0, complete: null, recentDays: null };

  const redis = redisConf();
  if (!redis) {
    out.reason = "NO_REDIS";
  } else {
    out.store = "redis";
    try {
      const t = await getJsonGzText(redis, KEY.manifest);
      const m = t ? JSON.parse(t) : null;
      if (!m) out.reason = "NO_MANIFEST";
      else {
        out.updated = m.generated || null;
        out.symbols = m.symbols ? Object.keys(m.symbols).length : 0;
        out.withHistory = m.symbols ? Object.keys(m.symbols).filter((k) => m.symbols[k].history).length : 0;
        out.complete = !!m.complete;
        out.recentDays = m.recentDays || null;
      }
    } catch (e) {
      out.reason = "ERROR";
      out.detail = String(e.message).slice(0, 160);
    }
  }

  out.news = !!((process.env.NAVER_HUB_KEY_ID && process.env.NAVER_HUB_KEY) ||
                (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET));
  out.sync = !!(process.env.USER_SALT && process.env.USER_SALT.length >= 16 && (redis || process.env.BLOB_READ_WRITE_TOKEN));
  out.syncStore = redis ? "redis" : (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : null);
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  res.status(200).json(out);
}
