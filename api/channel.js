// /api/channel — 채널 발행용 '미국 증시 데일리 브리핑' 글 (JSON {text, asOf, ...})
//   아침 수집 데이터(Redis) + 네이버 뉴스 제목으로 만든다. CDN 30분 캐시. 운영자 페이지(채널 탭)가 보여준다.
import { redisConf, getJsonGzText, KEY } from "./_redis.js";
import { composeDaily } from "./_compose.js";
import { loadTickerPairs } from "./_tickers.js";
import { reqIsOwner } from "./_owner.js";

export async function loadNames(origin) {
  const { pairs } = await loadTickerPairs(origin);
  const out = {};
  pairs.forEach(([sym, name]) => { if (!out[sym]) out[sym] = name.replace(/\s*\(.*?\)\s*/g, "").trim() || name; });
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
  // 운영자 전용: 토큰이 없으면 내용 없이 거절 (CDN에도 남기지 않음)
  if (!reqIsOwner(req)) { res.setHeader("Cache-Control", "no-store"); return res.status(401).json({ ok: false, reason: "OWNER_ONLY" }); }
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = proto + "://" + req.headers.host;
  const d = await buildDaily(origin);
  res.setHeader("Cache-Control", d.ok ? "private, max-age=600" : "no-store");   // 운영자 전용이라 공용 캐시엔 두지 않음
  return res.status(200).json(d);
}
