// /api/fund?symbol=005930.KS
// 네이버 증권 공개 JSON API 프록시 — 시세·투자지표(PER/PBR/EPS/BPS/배당)·재무제표·투자자별 매매동향
// 인증 불필요. 반드시 m.stock.naver.com/api 호스트를 쓴다 (api.stock.naver.com은 409).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BASE = "https://m.stock.naver.com";

async function getJson(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "https://m.stock.naver.com/",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error("JSON 파싱 실패");
  }
}

// Yahoo 심볼 → 네이버 코드. 국내: 6자리.KS/.KQ. 그 외는 해외 후보.
function parseSymbol(symbol) {
  const m = symbol.match(/^([0-9A-Z]{6})\.(KS|KQ)$/i);
  if (m) return { code: m[1].toUpperCase(), market: "KR" };
  // 지수·환율·암호화폐·선물은 재무 데이터가 없다
  if (/^\^|=|-USD$|=F$/.test(symbol)) return { code: null, market: "NONE" };
  return { code: null, market: "WORLD" };
}

// 재무제표 응답을 가볍게: 기간 목록 + 행별 {제목: {기간키: 값}}
function slimFinance(fi) {
  if (!fi) return null;
  const periods = (fi.trTitleList || []).map((t) => ({
    title: t.title,
    key: t.key,
    forecast: t.isConsensus === "Y",
  }));
  const rows = [];
  (fi.rowList || []).forEach((r) => {
    const vals = {};
    Object.keys(r.columns || {}).forEach((k) => {
      vals[k] = r.columns[k] && r.columns[k].value != null ? r.columns[k].value : null;
    });
    rows.push({ title: r.title, values: vals });
  });
  return { periods, rows };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const symbol = (req.query.symbol || "").trim();
  if (!symbol || symbol.length > 20) {
    return res.status(400).json({ error: "symbol required" });
  }

  const parsed = parseSymbol(symbol);
  if (parsed.market === "NONE") {
    return res.status(200).json({ symbol, market: "NONE", note: "지수·환율·원자재·암호화폐는 재무 데이터가 없습니다." });
  }

  let code = parsed.code;
  const market = parsed.market;

  // 해외 종목: 자동완성으로 로이터 코드(AAPL.O 등) 해석
  if (market === "WORLD") {
    try {
      const q = symbol.toUpperCase().replace(/-/g, ".");
      const ac = await getJson(
        BASE + "/front-api/search/autoComplete?query=" + encodeURIComponent(symbol) + "&target=stock"
      );
      const items = (ac && ac.result && ac.result.items) || [];
      const hit = items.find((it) => {
        const rc = (it.reutersCode || "").toUpperCase();
        return rc === q || rc.split(".")[0] === q;
      });
      if (!hit || !hit.reutersCode) {
        return res.status(200).json({
          symbol, market: "WORLD", ok: false,
          note: "네이버 증권에서 이 해외 종목의 재무 데이터를 찾지 못했습니다.",
        });
      }
      code = hit.reutersCode;
    } catch (e) {
      return res.status(200).json({ symbol, market: "WORLD", ok: false, note: "해외 종목 검색 실패: " + e.message });
    }
  }

  const out = { symbol, code, market, ok: true, info: {}, finance: null, trend: null, industry: null, consensus: null };

  // 1) 통합 스냅샷 (시세 + 투자지표)
  try {
    const integ = await getJson(BASE + "/api/stock/" + encodeURIComponent(code) + "/integration");
    (integ.totalInfos || []).forEach((r) => {
      if (r && r.code) out.info[r.code] = { key: r.key, value: r.value };
    });
    out.name = integ.stockName || integ.itemName || null;
    out.industry = integ.industryCompareInfo || null;
    out.consensus = integ.consensusInfo || null;
    out.dealTrend = integ.dealTrendInfos || null;
  } catch (e) {
    return res.status(200).json({ symbol, code, market, ok: false, note: "투자지표 조회 실패: " + e.message });
  }

  // 2) 재무제표 (국내만, 실패해도 나머지는 반환)
  if (market === "KR") {
    for (const p of ["quarter", "annual"]) {
      try {
        const f = await getJson(BASE + "/api/stock/" + code + "/finance/" + p);
        out.finance = out.finance || {};
        out.finance[p] = slimFinance(f.financeInfo);
      } catch (e) {
        out.finance = out.finance || {};
        out.finance[p] = null;
      }
    }
    // 3) 투자자별 매매동향 (엔드포인트 형태가 바뀔 수 있어 실패 시 null)
    try {
      out.trend = await getJson(BASE + "/api/stock/" + code + "/trend?pageSize=10&page=1");
    } catch (e) {
      out.trend = null;
    }
  }

  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  return res.status(200).json(out);
}
