// /api/search?q=삼성전자
// Yahoo Finance 종목 검색 프록시 (한글 검색 → 티커 자동 찾기)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q || q.length > 40) {
    return res.status(400).json({ error: "q required" });
  }

  const url =
    "https://query1.finance.yahoo.com/v1/finance/search?q=" +
    encodeURIComponent(q) +
    "&quotesCount=8&newsCount=0&listsCount=0";

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!r.ok) return res.status(502).json({ error: "HTTP " + r.status });
    const data = await r.json();
    const quotes = (data.quotes || [])
      .filter((it) => it.symbol)
      .map((it) => ({
        symbol: it.symbol,
        name: it.longname || it.shortname || it.symbol,
        exch: it.exchDisp || it.exchange || "",
        type: it.quoteType || "",
      }));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json({ quotes });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}
