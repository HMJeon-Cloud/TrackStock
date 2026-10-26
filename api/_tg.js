// v12.63 텔레그램 채널(한 방향) 발행 — /api/channel?op=tg (POST, 운영자 전용). 새 서버 함수 없음.
//   환경변수: TELEGRAM_BOT_TOKEN(필수) · TELEGRAM_CHANNEL(필수, "@채널아이디" 또는 "-100…" 숫자 ID) — 운영자가 Vercel에 넣는다. 화면·응답에 토큰은 절대 나가지 않는다.
//   { act:"test" } → 봇·채널 확인 / { act:"text", text, silent } → 글 / { act:"photos", images:[dataURL…≤10], caption } → 사진 묶음(첫 장 캡션)
//   보낸 기록은 Redis sm:tg:log 에 최근 200건 (중복 발송 방지·히스토리)
import { redisConf, setJsonGz, getJsonGzText } from "./_redis.js";
const API = (tok, m) => "https://api.telegram.org/bot" + tok + "/" + m;
const clip = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
function dataUrlToBuf(u) { const m = /^data:(image\/\w+);base64,(.+)$/.exec(String(u || "")); if (!m) return null; return { type: m[1], buf: Buffer.from(m[2], "base64") }; }
async function tgCall(tok, method, payload, isForm) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch(API(tok, method), isForm ? { method: "POST", body: payload, signal: ac.signal } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ac.signal });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) return { ok: false, reason: "TG_" + (r.status || "?"), msg: clip(j && j.description, 200) };
    return { ok: true, result: j.result };
  } catch (e) { return { ok: false, reason: e.name === "AbortError" ? "TIMEOUT" : "ERROR", msg: clip(e.message, 160) }; } finally { clearTimeout(tm); }
}
async function logPush(rc, item) { if (!rc) return; try { const t = await getJsonGzText(rc, "sm:tg:log"); const L = t ? JSON.parse(t) : []; L.unshift(item); await setJsonGz(rc, "sm:tg:log", L.slice(0, 200), 180 * 86400); } catch (e) {} }
export async function tgHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHANNEL;
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b) return res.status(400).json({ ok: false, reason: "본문 필요" });
  const rc = redisConf();
  if (b.act === "log") { try { const t = rc ? await getJsonGzText(rc, "sm:tg:log") : null; return res.status(200).json({ ok: true, items: t ? JSON.parse(t) : [] }); } catch (e) { return res.status(200).json({ ok: true, items: [] }); } }
  if (!tok || !chat) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수 TELEGRAM_BOT_TOKEN · TELEGRAM_CHANNEL 이 없어요", need: { token: !tok, channel: !chat } });
  if (b.act === "test") {
    const me = await tgCall(tok, "getMe", {}); if (!me.ok) return res.status(200).json(me);
    const ch = await tgCall(tok, "getChat", { chat_id: chat });
    return res.status(200).json({ ok: ch.ok, bot: me.result && me.result.username, channel: ch.ok ? { title: ch.result.title, type: ch.result.type, username: ch.result.username } : null, msg: ch.ok ? "" : (ch.msg || "채널을 찾지 못했어요 — 봇을 채널 관리자로 넣었는지 확인") });
  }
  if (b.act === "text") {
    const text = clip(String(b.text || ""), 4096); if (!text.trim()) return res.status(400).json({ ok: false, reason: "text 필요" });
    const r = await tgCall(tok, "sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, disable_notification: !!b.silent });
    if (r.ok) await logPush(rc, { at: Date.now(), kind: "text", n: 1, head: clip(text.replace(/<[^>]+>/g, ""), 80), id: r.result && r.result.message_id });
    return res.status(200).json(r.ok ? { ok: true, id: r.result.message_id } : r);
  }
  if (b.act === "photos") {
    const imgs = (b.images || []).slice(0, 10).map(dataUrlToBuf).filter(Boolean); if (!imgs.length) return res.status(400).json({ ok: false, reason: "images 필요" });
    const caption = clip(String(b.caption || ""), 1024);
    let r;
    if (imgs.length === 1) {
      const fd = new FormData(); fd.append("chat_id", chat); if (caption) { fd.append("caption", caption); fd.append("parse_mode", "HTML"); } if (b.silent) fd.append("disable_notification", "true");
      fd.append("photo", new Blob([imgs[0].buf], { type: imgs[0].type }), "card1.jpg");
      r = await tgCall(tok, "sendPhoto", fd, true);
    } else {
      const fd = new FormData(); fd.append("chat_id", chat); if (b.silent) fd.append("disable_notification", "true");
      const media = imgs.map((im, i) => { fd.append("f" + i, new Blob([im.buf], { type: im.type }), "card" + (i + 1) + ".jpg"); return Object.assign({ type: "photo", media: "attach://f" + i }, i === 0 && caption ? { caption, parse_mode: "HTML" } : {}); });
      fd.append("media", JSON.stringify(media));
      r = await tgCall(tok, "sendMediaGroup", fd, true);
    }
    if (r.ok) await logPush(rc, { at: Date.now(), kind: "photos", n: imgs.length, head: clip(caption.replace(/<[^>]+>/g, ""), 80), title: clip(b.title, 60) });
    return res.status(200).json(r.ok ? { ok: true, n: imgs.length } : r);
  }
  return res.status(400).json({ ok: false, reason: "act: test·text·photos·log" });
}
