// /api/user — 아이디+PIN 기반 개인 데이터 저장 (관심 종목·장바구니·시뮬 설정·보유 기록)
//
// 동작 원리
//   아이디(별명·이메일)와 PIN을 서버만 아는 비밀값(USER_SALT)으로 HMAC 해시해 저장 키를 만든다.
//   아이디·PIN 원문은 어디에도 저장되지 않고, 비밀값 없이는 키를 만들 수 없다.
//
//   POST { id, pin, data }  → 저장 (첫 저장 = 계정 생성). 응답의 token으로
//   POST { token, data }      이후 자동 저장은 PIN 재입력 없이 한다.
//   GET  ?id=..&pin=..  또는 ?token=..  → 불러오기
//
// 저장소
//   ① Upstash Redis (권장) — 무료 월 50만 명령. 저장 1번 = 명령 1회.
//      Vercel Marketplace로 연결하면 KV_REST_API_URL / KV_REST_API_TOKEN 이 자동 등록된다.
//   ② Vercel Blob (Redis가 없을 때만) — 쓰기가 월 2,000회뿐이고 시세 스냅샷과 한도를 나눠 쓰므로,
//      사용자가 늘면 한도를 넘겨 저장소 전체가 30일간 정지될 수 있다. 임시 용도.
import { put } from "@vercel/blob";
import { createHmac } from "crypto";

const MAX_BYTES = 256 * 1024;
const MIN_SAVE_GAP_MS = 10 * 1000;
const lastSave = new Map();

function redisConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redisCmd(conf, args) {
  const r = await fetch(conf.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + conf.token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Redis: " + (j.error || "HTTP " + r.status));
  return j.result;
}

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

/* 저장소 오류를 사람이 읽을 수 있는 말로 */
function explain(e) {
  const m = String((e && e.message) || e);
  if (/suspend|blocked/i.test(m)) {
    return { reason: "STORE_SUSPENDED",
      error: "클라우드 저장소가 무료 사용 한도 초과로 일시 정지되었습니다. 입력하신 데이터는 이 기기에 그대로 남아 있습니다. 복구되면 자동으로 다시 저장됩니다." };
  }
  return { reason: "STORE_ERROR", error: "저장소 오류: " + m.slice(0, 120) };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const salt = process.env.USER_SALT;
  if (!salt || salt.length < 16) {
    return res.status(200).json({ ok: false, reason: "SYNC_OFF",
      note: "클라우드 저장이 설정되지 않았습니다 (환경변수 USER_SALT 필요, 16자 이상 아무 문자열)." });
  }
  const redis = redisConf();
  if (!redis && !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: false, reason: "NO_STORE" });
  }

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
  const key = "sm:user:" + token;
  const blobPath = "users/" + token + ".json";
  const store = redis ? "redis" : "blob";

  if (req.method === "GET") {
    try {
      let raw = null;
      if (redis) {
        raw = await redisCmd(redis, ["GET", key]);
      } else {
        const base = blobBase();
        const r = await fetch(base + blobPath, { cache: "no-store" });
        if (r.status === 404) raw = null;
        else if (!r.ok) throw new Error((await r.text()).slice(0, 120) || "HTTP " + r.status);
        else raw = await r.text();
      }
      if (!raw) return res.status(200).json({ ok: true, exists: false, token, store });
      const j = JSON.parse(raw);
      return res.status(200).json({ ok: true, exists: true, token, data: j.data, savedAt: j.savedAt, store });
    } catch (e) {
      return res.status(200).json({ ok: false, ...explain(e), store });
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
      if (redis) {
        await redisCmd(redis, ["SET", key, body]);
      } else {
        await put(blobPath, body, {
          access: "public", addRandomSuffix: false, allowOverwrite: true,
          contentType: "application/json", cacheControlMaxAge: 0
        });
      }
      lastSave.set(token, Date.now());
      if (lastSave.size > 500) lastSave.clear();
      return res.status(200).json({ ok: true, token, savedAt: new Date().toISOString(), store });
    } catch (e) {
      return res.status(200).json({ ok: false, ...explain(e), store });
    }
  }

  return res.status(405).json({ ok: false, error: "GET 또는 POST" });
}
