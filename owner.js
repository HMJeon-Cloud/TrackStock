// /api/owner — 운영자 잠금 해제·확인
//   POST {key}  → 키가 맞으면 { ok:true, token } (기기에 저장할 토큰)
//   GET  ?t=토큰 → { ok:true|false } (저장된 토큰이 아직 유효한지 — 키를 바꾸면 자동으로 무효)
import { isOwnerKey, isOwnerToken, ownerToken, ownerKey } from "./_owner.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!ownerKey()) return res.status(200).json({ ok: false, reason: "NO_KEY" });
  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    const key = (body && body.key) || "";
    if (isOwnerKey(key)) return res.status(200).json({ ok: true, token: ownerToken() });
    await new Promise((r) => setTimeout(r, 800));   // 무작위 대입을 느리게
    return res.status(200).json({ ok: false });
  }
  return res.status(200).json({ ok: isOwnerToken(req.query.t) });
}
