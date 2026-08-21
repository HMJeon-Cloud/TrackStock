// /api/chart?symbol=005930.KS&range=10y
// Yahoo Finance v8 chart API 프록시 (CORS 우회 + 캐싱)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export default async function handler(req, res) {
  const symbol = (req.query.symbol || "").trim();
  const range = (req.query.range || "10y").trim();
  const interval = (req.query.interval || "1d").trim();

  const ALLOWED_RANGE = ["1y", "2y", "5y", "10y", "15y", "20y", "max"];
  const ALLOWED_INTERVAL = ["1d", "1wk", "1mo"];
  if (!symbol || symbol.length > 20) {
    return res.status(400).json({ error: "symbol required" });
  }
  if (!ALLOWED_RANGE.includes(range) || !ALLOWED_INTERVAL.includes(interval)) {
    return res.status(400).json({ error: "invalid range/interval" });
  }

  const path =
    "/v8/finance/chart/" +
    encodeURIComponent(symbol) +
    "?range=" + encodeURIComponent(range) +
    "&interval=" + encodeURIComponent(interval) +
    "&events=div%2Csplit";

  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastErr = null;

  for (const host of hosts) {
    try {
      const r = await fetch("https://" + host + path, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!r.ok) {
        lastErr = "HTTP " + r.status + " from " + host;
        continue;
      }
      const data = await r.json();
      if (data?.chart?.error) {
        // 심볼 오류 등은 Yahoo가 200이 아닌 형태로 줄 때도 있어 그대로 전달
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.status(404).json({ error: data.chart.error.description || "not found" });
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      // Vercel Edge 캐시: 1시간 캐싱, 하루까지 stale 허용 → Yahoo 호출 최소화
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json(data);
    } catch (e) {
      lastErr = String(e);
    }
  }
  return res.status(502).json({ error: "upstream failed: " + lastErr });
}
