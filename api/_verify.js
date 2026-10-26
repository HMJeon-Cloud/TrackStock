// v12.62 지수 종가 2차 출처 대조 — 야후(앱 스냅샷) vs 네이버 증권 공개 API. 다르면 '보류' 표시용. 1시간 캐시, 실패는 '확인 불가'(막지 않음)
//   /api/channel?op=verify (GET/POST) → { ok, at, items:[{ key, name, date, app, ref, diff, st: ok|warn|na, why }] }
//   네이버 끝점이 바뀌어 못 읽으면 st:na — 운영자가 손으로 확인하라고만 알린다(틀린 경고를 만들지 않기 위해)
import { redisConf, setJsonGz, getJsonGzText } from "./_redis.js";
const SRC = [
  { key: "^KS11", name: "코스피", url: "https://m.stock.naver.com/api/index/KOSPI/price?pageSize=6&page=1" },
  { key: "^KQ11", name: "코스닥", url: "https://m.stock.naver.com/api/index/KOSDAQ/price?pageSize=6&page=1" },
  { key: "^GSPC", name: "S&P500", url: "https://api.stock.naver.com/index/.INX/price?page=1&pageSize=6" },
  { key: "^IXIC", name: "나스닥", url: "https://api.stock.naver.com/index/.IXIC/price?page=1&pageSize=6" },
  { key: "^DJI", name: "다우", url: "https://api.stock.naver.com/index/.DJI/price?page=1&pageSize=6" }
];
const num = (s) => { const v = parseFloat(String(s == null ? "" : s).replace(/,/g, "")); return isFinite(v) ? v : null; };
async function naverRows(url) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } });
    if (!r.ok) return null; const j = await r.json().catch(() => null); const arr = Array.isArray(j) ? j : (j && (j.priceInfos || j.items || j.data)) || null; if (!Array.isArray(arr)) return null;
    return arr.map((x) => ({ d: String(x.localTradedAt || x.localDate || x.tradeDate || x.date || "").slice(0, 10).replace(/\./g, "-"), c: num(x.closePrice || x.close || x.price) })).filter((x) => x.d && x.c);
  } catch (e) { return null; } finally { clearTimeout(tm); }
}
export async function verifyHandler(req, res, snapshotLoader) {
  res.setHeader("Cache-Control", "no-store");
  const rc = redisConf(), ck = "sm:verify:" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 13);
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (rc && !(body && body.fresh)) { try { const t = await getJsonGzText(rc, ck); if (t) return res.status(200).json(Object.assign(JSON.parse(t), { cached: true })); } catch (e) {} }
  // 앱 쪽 종가: 클라이언트가 보내 준 {key:{d,c}} (스냅샷을 다시 읽지 않아 가볍다)
  const app = (body && body.app) || {};
  const items = [];
  for (const s of SRC) {
    const a = app[s.key]; const rows = await naverRows(s.url);
    if (!a || !a.d || !a.c) { items.push({ key: s.key, name: s.name, st: "na", why: "앱 종가 없음" }); continue; }
    if (!rows || !rows.length) { items.push({ key: s.key, name: s.name, date: a.d, app: a.c, st: "na", why: "네이버 응답 없음(끝점 변경 가능) — 손으로 확인" }); continue; }
    const hit = rows.filter((x) => x.d === a.d)[0];
    if (!hit) { const newest = rows[0]; items.push({ key: s.key, name: s.name, date: a.d, app: a.c, ref: newest.c, refDate: newest.d, st: newest.d > a.d ? "warn" : "na", why: newest.d > a.d ? "네이버에 더 최신 종가(" + newest.d + ")가 있어요 — 앱이 하루 늦음" : "같은 날짜 없음" }); continue; }
    const diff = hit.c / a.c - 1;
    items.push({ key: s.key, name: s.name, date: a.d, app: a.c, ref: hit.c, diff, st: Math.abs(diff) > 0.003 ? "warn" : "ok", why: Math.abs(diff) > 0.003 ? "앱과 네이버 종가가 " + (diff * 100).toFixed(2) + "% 달라요 — 오늘 숫자 보류 권장" : "" });
  }
  const out = { ok: true, at: Date.now(), items, bad: items.filter((x) => x.st === "warn").length, na: items.filter((x) => x.st === "na").length };
  if (rc) { try { await setJsonGz(rc, ck, out, 3600); } catch (e) {} }
  return res.status(200).json(out);
}
