// /api/snap — Blob 공개 URL을 직접 못 읽는 환경에서의 우회 경로.
// list()를 쓰지 않도록 BLOB_STORE_ID로 주소를 만든다 (Advanced Operation 절약).
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const symbol = (req.query.symbol || "").trim();
  const want = req.query.manifest === "1" ? "manifest.json"
    : req.query.recent === "1" ? "recent.json"
    : symbol ? "charts/" + encodeURIComponent(symbol) + ".json" : null;
  if (!want) return res.status(400).json({ error: "symbol required" });

  const id = (process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  if (!id) return res.status(404).json({ error: "no blob store" });

  try {
    const r = await fetch("https://" + id + ".public.blob.vercel-storage.com/" + want);
    if (!r.ok) return res.status(404).json({ error: "snapshot not found", status: r.status });
    const text = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", want === "charts/" + encodeURIComponent(symbol) + ".json"
      ? "s-maxage=86400, stale-while-revalidate=172800"
      : "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: String(e.message).slice(0, 160) });
  }
}
