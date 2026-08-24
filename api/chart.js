// /api/chart?symbol=005930.KS&range=10y
// Yahoo Finance v8 chart API 프록시 (CORS 우회 + 캐싱)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const symbol = (req.query.symbol || "").trim();
  const range = (req.query.range || "10y").trim();
  const interval = (req.query.interval || "1d").trim();

  const ALLOWED_RANGE = ["1y", "2y", "5y", "10y", "15y", "20y", "max"];
  const ALLOWED_INTERVAL = ["1d", "1wk", "1mo"];
  if (!symbol || symbol.length > 20) {
    return res.status(400).json({ error: "종목 코드가 비어있습니다." });
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
  let notFound = false;
  let lastErr = null;

  for (const host of hosts) {
    try {
      const r = await fetch("https://" + host + path, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });

      // Yahoo는 존재하지 않는 심볼에 404 + JSON 본문을 반환한다.
      // 본문을 먼저 읽어 chart.error를 확인해야 원인 파악이 가능하다.
      let data = null;
      try { data = await r.json(); } catch (_) { data = null; }

      if (data && data.chart && data.chart.error) {
        notFound = true;
        lastErr = data.chart.error.description || data.chart.error.code;
        continue; // 다른 호스트도 시도 (대개 동일 결과)
      }
      if (!r.ok) {
        lastErr = "HTTP " + r.status + " (" + host + ")";
        continue;
      }
      if (!data || !data.chart || !data.chart.result) {
        lastErr = "예상치 못한 응답 형식 (" + host + ")";
        continue;
      }

      // Vercel Edge 캐시: 1시간 캐싱, 하루까지 stale 허용 → Yahoo 호출 최소화
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json(data);
    } catch (e) {
      lastErr = String(e);
    }
  }

  if (notFound) {
    return res.status(404).json({
      error: "'" + symbol + "' 종목을 찾을 수 없습니다. 검색창에서 목록을 선택해 주세요.",
      symbol: symbol,
    });
  }
  return res.status(502).json({ error: "데이터 서버 연결 실패: " + lastErr });
}
