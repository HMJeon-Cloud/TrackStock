// /api/channel — 채널 발행용 '미국 증시 데일리 브리핑' 글 (JSON {text, asOf, ...})
//   아침 수집 데이터(Redis) + 네이버 뉴스 제목으로 만든다. CDN 30분 캐시. 운영자 페이지(채널 탭)가 보여준다.
import { redisConf, getJsonGzText, KEY } from "./_redis.js";
import { composeDaily } from "./_compose.js";

export async function loadNames(origin) {
  const r = await fetch(origin + "/tickers.js", { cache: "no-store" });
  const src = await r.text();
  const out = {}; const re = /\[\s*"([^"]+)"\s*,\s*"([^"]*)"/g; let m;
  while ((m = re.exec(src))) out[m[1]] = m[2].replace(/\s*\(.*?\)\s*/g, "").trim() || m[2];
  return out;
}
export async function buildDaily(origin) {
  const redis = redisConf();
  if (!redis) return { ok: false, reason: "NO_REDIS" };
  const t = await getJsonGzText(redis, KEY.recent);
  if (!t) return { ok: false, reason: "NO_DATA" };
  const recent = JSON.parse(t);
  let names = {}; try { names = await loadNames(origin); } catch (e) {}
  let news = [];
  try {
    const r = await fetch(origin + "/api/news?type=market&cat=world&size=8");
    const j = await r.json(); news = (j && j.items) || [];
  } catch (e) {}
  const out = composeDaily(recent, names, news);
  return { ok: true, ...out, generated: recent.generated };
}
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = proto + "://" + req.headers.host;
  const d = await buildDaily(origin);
  res.setHeader("Cache-Control", d.ok ? "s-maxage=1800, stale-while-revalidate=3600" : "no-store");
  return res.status(200).json(d);
}
