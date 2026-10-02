// 운영자 확인 — '오늘의 브리핑'·'채널 브리핑 자료'를 운영자(HM)만 보게 하는 용도
//   운영자 키: Vercel 환경변수 OWNER_KEY (없으면 CRON_SECRET 을 대신 쓴다)
//   기기에는 키가 아니라 키로 만든 토큰(HMAC)만 저장한다 → 기기에서 토큰이 보여도 키는 알 수 없다.
import { createHmac, timingSafeEqual } from "crypto";

export function ownerKey() { return process.env.OWNER_KEY || process.env.CRON_SECRET || ""; }
export function ownerToken() {
  const k = ownerKey();
  return k ? createHmac("sha256", k).update("stockmind-owner-v1").digest("hex").slice(0, 40) : "";
}
function same(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
export function isOwnerKey(key) { return same(key, ownerKey()); }
export function isOwnerToken(t) { const tok = ownerToken(); return !!tok && same(t, tok); }
/* 요청에서 토큰 꺼내기: 헤더 x-owner 또는 ?t= */
export function reqIsOwner(req) { return isOwnerToken(req.headers["x-owner"] || (req.query && req.query.t)); }
