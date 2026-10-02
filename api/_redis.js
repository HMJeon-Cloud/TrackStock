// Upstash Redis REST 공용 헬퍼 (스냅샷·사용자 데이터 공용)
//   Vercel Marketplace로 연결하면 KV_REST_API_URL / KV_REST_API_TOKEN 이 자동 등록된다.
//   큰 값(시세 스냅샷)은 gzip+base64로 줄여서 넣는다. 무료 요청 한도 10MB, 저장 256MB.
import { gzipSync, gunzipSync } from "zlib";

export function redisConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export async function redisCmd(conf, args) {
  const r = await fetch(conf.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + conf.token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Redis: " + (j.error || "HTTP " + r.status));
  return j.result;
}

/* JSON 객체를 gzip+base64로 저장 / 읽기 */
export async function setJsonGz(conf, key, obj, exSec) {
  const gz = gzipSync(Buffer.from(JSON.stringify(obj), "utf8")).toString("base64");
  const args = ["SET", key, gz];
  if (exSec) args.push("EX", String(exSec));
  await redisCmd(conf, args);
  return gz.length;
}
export async function getJsonGzText(conf, key) {
  const gz = await redisCmd(conf, ["GET", key]);
  if (!gz) return null;
  return gunzipSync(Buffer.from(gz, "base64")).toString("utf8");
}

/* UTC ISO → "2026-10-02 08:31 (한국)" */
export function kst(iso) {
  if (!iso) return null;
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 16).replace("T", " ") + " (한국)";
}

export const KEY = {
  recent: "sm:recent",          // 전 종목 최근 90일 (gzip)
  manifest: "sm:manifest",      // 종목별 갱신일 목록 (gzip)
  chart: (sym) => "sm:chart:" + sym,   // 종목별 과거 전체 (gzip)
};
