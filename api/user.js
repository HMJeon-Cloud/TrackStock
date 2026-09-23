// /api/user — 아이디+PIN 기반 개인 데이터 저장 (관심 종목·장바구니·시뮬 설정)
//
// 동작 원리
//   아이디(별명·이메일)와 PIN을 서버만 아는 비밀값(USER_SALT)으로 HMAC 해시해
//   users/<해시>.json 경로를 만든다. 아이디·PIN 원문은 어디에도 저장되지 않고,
//   해시는 비밀값 없이는 만들 수 없으므로 공개 Blob 저장소여도 남이 URL을 유추할 수 없다.
//
//   POST { id, pin, data }        → 저장 (첫 저장 = 계정 생성). 응답에 token(해시)을 돌려주므로
//   POST { token, data }            이후 자동 저장은 PIN 재입력 없이 token으로 한다.
//   GET  ?id=..&pin=..  또는 ?token=..  → 불러오기
//
// 한도 보호: Blob 쓰기(put)는 무료 월 2,000회뿐이라, 같은 사용자의 저장을 10초에 1번으로 제한한다.
import { put } from "@vercel/blob";
import { createHmac } from "crypto";

const MAX_BYTES = 24 * 1024;           // 데이터 상한 (관심 20 + 장바구니 8 + 설정이면 충분)
const MIN_SAVE_GAP_MS = 10 * 1000;
const lastSave = new Map();             // token → 마지막 저장 시각 (웜 인스턴스 한정 best-effort)

function deriveToken(id, pin, salt) {
  const idNorm = String(id || "").trim().toLowerCase();
  const pinStr = String(pin || "").trim();
  if (idNorm.length < 2 || idNorm.length > 60) return { error: "아이디는 2~60자여야 합니다." };
  if (!/^\d{4,8}$/.test(pinStr)) return { error: "PIN은 숫자 4~8자리여야 합니다." };
  return { token: createHmac("sha256", salt).update(idNorm + "\n" + pinStr).digest("hex") };
}

function blobBase() {
  const id = (process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  return id ? "https://" + id + ".public.blob.vercel-storage.com/" : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const salt = process.env.USER_SALT;
  if (!salt || salt.length < 16) {
    return res.status(200).json({ ok: false, reason: "SYNC_OFF",
      note: "클라우드 저장이 설정되지 않았습니다 (환경변수 USER_SALT 필요, 16자 이상 아무 문자열)." });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, reason: "NO_BLOB" });
  }

  // token 확보: 직접 받거나 id+pin에서 파생
  let token = null;
  const src = req.method === "POST" ? (req.body || {}) : req.query;
  if (src.token && /^[0-9a-f]{64}$/.test(String(src.token))) {
    token = String(src.token);
  } else if (src.id != null && src.pin != null) {
    const d = deriveToken(src.id, src.pin, salt);
    if (d.error) return res.status(400).json({ ok: false, error: d.error });
    token = d.token;
  } else {
    return res.status(400).json({ ok: false, error: "아이디와 PIN(또는 token)이 필요합니다." });
  }
  const path = "users/" + token + ".json";
  const base = blobBase();

  if (req.method === "GET") {
    try {
      const url = base ? base + path : null;
      if (!url) return res.status(200).json({ ok: false, reason: "NO_BLOB" });
      const r = await fetch(url, { cache: "no-store" });
      if (r.status === 404) return res.status(200).json({ ok: true, exists: false, token });
      if (!r.ok) return res.status(200).json({ ok: false, error: "저장소 조회 실패 " + r.status });
      const j = await r.json();
      return res.status(200).json({ ok: true, exists: true, token, data: j.data, savedAt: j.savedAt });
    } catch (e) {
      return res.status(200).json({ ok: false, error: String(e.message).slice(0, 120) });
    }
  }

  if (req.method === "POST") {
    const data = src.data;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ ok: false, error: "data가 필요합니다." });
    }
    const body = JSON.stringify({ v: 1, savedAt: new Date().toISOString(), data });
    if (body.length > MAX_BYTES) {
      return res.status(400).json({ ok: false, error: "저장 데이터가 너무 큽니다." });
    }
    const last = lastSave.get(token) || 0;
    if (Date.now() - last < MIN_SAVE_GAP_MS) {
      return res.status(429).json({ ok: false, error: "잠시 후 다시 저장됩니다.", retry: true });
    }
    try {
      await put(path, body, {
        access: "public", addRandomSuffix: false, allowOverwrite: true,
        contentType: "application/json", cacheControlMaxAge: 0
      });
      lastSave.set(token, Date.now());
      if (lastSave.size > 500) lastSave.clear();   // 웜 인스턴스 메모리 상한
      return res.status(200).json({ ok: true, token, savedAt: new Date().toISOString() });
    } catch (e) {
      return res.status(200).json({ ok: false, error: String(e.message).slice(0, 120) });
    }
  }

  return res.status(405).json({ ok: false, error: "GET 또는 POST" });
}
