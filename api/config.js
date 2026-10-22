// /api/config — 클라이언트가 데이터 준비 상태를 알아내는 용도 (CDN 1시간 캐시).
//   스냅샷은 Upstash Redis에 있고 /api/snap 으로 읽는다. 여기서는 목록(manifest)의 요약만 돌려준다.
import { redisConf, redisCmd, getJsonGzText, KEY, kst } from "./_redis.js";

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
        out.updated = kst(m.generated) || null;   // 한국 시간
        out.symbols = m.symbols ? Object.keys(m.symbols).length : 0;
        out.withHistory = m.symbols ? Object.keys(m.symbols).filter((k) => m.symbols[k].history).length : 0;
        out.complete = !!m.complete;
        out.recentDays = m.recentDays || null;
      }
    } catch (e) {
      out.reason = "ERROR";
      out.detail = String(e.message).slice(0, 160);
    }
    // 마지막 자동 수집 결과 (문제 진단용)
    try { const l = await redisCmd(redis, ["GET", "sm:cronlog"]); if (l) { out.lastRun = JSON.parse(l); if (out.lastRun.at) out.lastRun.at = kst(out.lastRun.at); } } catch (e) {}
    try { out.recentExists = !!(await redisCmd(redis, ["EXISTS", KEY.recent])); } catch (e) {}
  }

  out.news = !!((process.env.NAVER_HUB_KEY_ID && process.env.NAVER_HUB_KEY) ||
                (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET));
  out.sync = !!(process.env.USER_SALT && process.env.USER_SALT.length >= 16 && (redis || process.env.BLOB_READ_WRITE_TOKEN));
  out.syncStore = redis ? "redis" : (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : null);
  // v12.15 운영자 '데이터 연동 안내'용 — 키가 '있는지'만 알린다(값은 절대 내보내지 않음)
  const E = process.env, has = (k) => !!(E[k] && String(E[k]).length);
  out.keys = { redis: !!redis, cron: has("CRON_SECRET"), owner: has("OWNER_KEY"), salt: !!(E.USER_SALT && E.USER_SALT.length >= 16), naverHub: has("NAVER_HUB_KEY_ID") && has("NAVER_HUB_KEY"), naverDev: has("NAVER_CLIENT_ID") && has("NAVER_CLIENT_SECRET"),
    dart: has("DART_API_KEY"), secUa: has("SEC_UA"), ecos: has("ECOS_API_KEY"), fred: has("FRED_API_KEY"), openai: has("OPENAI_API_KEY"), anthropic: has("ANTHROPIC_API_KEY") };
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
  res.status(200).json(out);
}
