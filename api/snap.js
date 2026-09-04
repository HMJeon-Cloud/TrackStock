// /api/snap?symbol=005930.KS&wide=0
// Blob 저장소가 Private으로 생성돼 공개 URL로 못 읽는 경우의 우회 경로.
// 서버가 토큰으로 읽어 그대로 전달한다. 함수 호출은 발생하지만 상류(Yahoo) 요청은 없고,
// 엣지 캐시가 걸려 있어 같은 종목의 반복 요청은 대부분 함수를 타지 않는다.
import { list } from "@vercel/blob";

let baseCache = { url: null, at: 0 };

async function blobBase() {
  if (baseCache.url && Date.now() - baseCache.at < 10 * 60 * 1000) return baseCache.url;
  const r = await list({ prefix: "manifest.json", limit: 1 });
  const b = r.blobs && r.blobs[0];
  if (!b || !b.url) return null;
  baseCache = { url: b.url.replace(/manifest\.json.*$/, ""), at: Date.now() };
  return baseCache.url;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const symbol = (req.query.symbol || "").trim();
  const wide = req.query.wide === "1";
  const wantManifest = req.query.manifest === "1";

  if (!wantManifest && (!symbol || symbol.length > 20)) {
    return res.status(400).json({ error: "symbol required" });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(404).json({ error: "no blob store" });
  }

  try {
    const base = await blobBase();
    if (!base) return res.status(404).json({ error: "no manifest" });

    const path = wantManifest
      ? "manifest.json"
      : (wide ? "charts/" : "charts10/") + encodeURIComponent(symbol) + ".json";

    // Blob 원본은 토큰 없이도 읽히는 경우가 많지만, Private이면 SDK 토큰이 필요하다
    const r = await fetch(base + path, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + process.env.BLOB_READ_WRITE_TOKEN },
    });
    if (!r.ok) return res.status(404).json({ error: "snapshot not found", status: r.status });

    const text = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", wantManifest
      ? "s-maxage=600, stale-while-revalidate=1800"
      : "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 160) });
  }
}
