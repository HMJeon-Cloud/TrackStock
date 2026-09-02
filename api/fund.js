// /api/fund?symbol=005930.KS
// 네이버 증권 공개 JSON API 프록시 — 시세·투자지표(PER/PBR/EPS/BPS/배당)·재무제표·투자자별 매매동향
// 인증 불필요. 반드시 m.stock.naver.com/api 호스트를 쓴다 (api.stock.naver.com은 409).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BASE = "https://m.stock.naver.com";
const BASE2 = "https://stock.naver.com";

async function getJson(url) {
  // Referer를 요청 호스트와 맞춘다. 고정하면 다른 호스트 호출이 거부될 수 있다.
  const origin = url.startsWith("https://stock.naver.com")
    ? "https://stock.naver.com/" : "https://m.stock.naver.com/";
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: origin,
      Origin: origin.slice(0, -1),
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
    return res.status(200).json({ symbol, market: "NONE", ok: false, reason: "NOT_A_COMPANY" });
  }

  let code = parsed.code;
  let out0name = null;
  const market = parsed.market;

  // 해외 종목: 자동완성으로 로이터 코드(AAPL.O 등)를 얻는다
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
      }) || items.find((it) => it.reutersCode);
      if (!hit || !hit.reutersCode) {
        return res.status(200).json({ symbol, market: "WORLD", ok: false, reason: "WORLD_NOT_FOUND" });
      }
      code = hit.reutersCode;
      out0name = hit.name || null;
    } catch (e) {
      return res.status(200).json({ symbol, market: "WORLD", ok: false, reason: "WORLD_NOT_FOUND", detail: e.message });
    }
  }

  const out = { symbol, code, market, ok: true, info: {}, finance: null, trend: null, industry: null, consensus: null };

  /* 알려진 지표 키만 골라내는 범용 추출기.
     해외 엔드포인트는 응답 모양이 국내와 달라 여러 형태를 모두 받아들인다. */
  const WANT_KEYS = [
    "lastClosePrice", "closePrice", "openPrice", "highPrice", "lowPrice",
    "accumulatedTradingVolume", "accumulatedTradingValue", "marketValue", "marketCap",
    "foreignRate", "highPriceOf52Weeks", "lowPriceOf52Weeks",
    "per", "eps", "cnsPer", "cnsEps", "pbr", "bps", "roe", "dividendYieldRatio", "dividend",
    "epsTtm", "perTtm", "beta", "sharesOutstanding", "payoutRatio",
    // 해외 응답에서 관찰될 수 있는 변형 키
    "peRatio", "pbRatio", "priceEarningRatio", "priceBookRatio", "earningPerShare",
    "bookValuePerShare", "returnOnEquity", "dividendYield", "dividendPerShare",
    "marketCapValue", "week52High", "week52Low", "highPrice52Week", "lowPrice52Week",
  ];
  function harvest(node, into, depth) {
    if (!node || depth > 4) return;
    if (Array.isArray(node)) {
      // [{code,key,value}, ...] 형태
      node.forEach((r) => {
        if (r && typeof r === "object" && r.code && "value" in r) {
          into[r.code] = { key: r.key || r.code, value: r.value };
        } else harvest(r, into, depth + 1);
      });
      return;
    }
    if (typeof node !== "object") return;
    WANT_KEYS.forEach((k) => {
      if (node[k] != null && (typeof node[k] === "string" || typeof node[k] === "number")) {
        if (into[k] == null) into[k] = { key: k, value: node[k] };
      }
    });
    Object.keys(node).forEach((k) => {
      const v = node[k];
      if (v && typeof v === "object") harvest(v, into, depth + 1);
    });
  }

  // 1) 통합 스냅샷 (시세 + 투자지표)
  const enc = encodeURIComponent(code);
  /* 해외 종목 실제 경로 (네이버 공개 화면 관찰 기록 기준)
       기본/컨센서스/개요 : /api/securityService/stock/{reutersCode}/basic
       재무 요약          : /api/securityService/stock/finance/summary?reutersCode={code}
       개요               : /api/securityService/stock/overview?reutersCode={code}
     국내는 기존 integration 경로를 그대로 쓴다. */
  const snapPaths = market === "KR"
    ? [{ h: BASE, p: "/api/stock/" + enc + "/integration" }]
    : [
        { h: BASE2, p: "/api/securityService/stock/" + enc + "/basic" },
        { h: BASE2, p: "/api/securityService/stock/finance/summary?reutersCode=" + enc },
        { h: BASE2, p: "/api/securityService/stock/overview?reutersCode=" + enc },
        { h: BASE2, p: "/api/securityService/stock/" + enc + "/consensus" },
        { h: BASE, p: "/api/worldstock/stock/" + enc + "/basic" }
      ];

  const debug = req.query.debug === "1";
  const tried = [];
  let snapOk = false;
  for (const s of snapPaths) {
    try {
      const j = await getJson(s.h + s.p);
      if (debug) tried.push({ url: s.h + s.p, ok: true, keys: Object.keys((j && j.result) || j || {}).slice(0, 25) });
      const body = j && j.result ? j.result : j;
      harvest(body, out.info, 0);
      if (!out.name) out.name = body.stockName || body.itemName || body.name || out0name || null;
      if (!out.industry) out.industry = body.industryCompareInfo || body.industry || null;
      if (!out.consensus) {
        out.consensus = body.consensusInfo || body.consensus ||
          (body.priceTargetMean != null || body.recommMean != null ? body : null);
      }
      if (!out.dealTrend) out.dealTrend = body.dealTrendInfos || null;
      if (Object.keys(out.info).length) {
        snapOk = true;
        if (market === "KR") break;   // 국내는 한 번에 전부 들어온다
      }
    } catch (e) {
      if (debug) tried.push({ url: s.h + s.p, ok: false, error: e.message });
    }
  }
  if (debug) out.debug = { code, tried, harvested: Object.keys(out.info) };
  if (!snapOk) {
    return res.status(200).json({
      symbol, code, market, ok: false,
      reason: market === "WORLD" ? "WORLD_PARTIAL" : "FETCH_FAILED",
      name: out0name,
      debug: debug ? { code, tried } : undefined
    });
  }

  // 2) 재무제표 — 국내와 해외의 경로 형태가 다르다
  out.finance = {};
  for (const p of ["quarter", "annual"]) {
    const url = market === "KR"
      ? BASE + "/api/stock/" + enc + "/finance/" + p
      : BASE2 + "/api/securityService/stock/finance/" + (p === "quarter" ? "quarter" : "annual") +
        "?reutersCode=" + enc;
    try {
      const f = await getJson(url);
      const fi = (f && f.financeInfo) || (f && f.result && f.result.financeInfo) ||
                 (f && f.result) || f;
      out.finance[p] = slimFinance(fi);
    } catch (e) {
      out.finance[p] = null;
    }
  }

  // 3) 투자자별 매매동향 (국내 전용)
  if (market === "KR") {
    try {
      out.trend = await getJson(BASE + "/api/stock/" + enc + "/trend?pageSize=10&page=1");
    } catch (e) {
      out.trend = null;
    }
  }

  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  return res.status(200).json(out);
}
