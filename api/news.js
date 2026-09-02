// /api/news?type=stock&symbol=005930.KS        → 종목 뉴스 (국내·해외)
// /api/news?type=market&cat=main               → 주요 뉴스
// /api/news?type=market&cat=world              → 해외증시 뉴스
// /api/news?type=market&cat=focus&sid=401      → 포커스 (401 시황·전망, 404 채권·선물, 429 환율)
// 네이버 증권 공개 JSON API 프록시. 제목·언론사·시각·링크만 정규화해 돌려준다.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const M = "https://m.stock.naver.com";
const S = "https://stock.naver.com";

async function getJson(url) {
  const origin = url.startsWith(S) ? S + "/" : M + "/";
  const r = await fetch(url, {
    headers: {
      "User-Agent": UA, Accept: "application/json",
      Referer: origin, Origin: origin.slice(0, -1), "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { throw new Error("JSON 파싱 실패"); }
}

/* 응답 어디에 있든 "기사 목록처럼 보이는 배열"을 찾는다 */
function findArticleArray(node, depth) {
  if (!node || depth > 5) return null;
  if (Array.isArray(node)) {
    if (node.length && node.some((x) => x && typeof x === "object" && (x.title || x.subject || x.headline))) return node;
    for (const x of node) { const f = findArticleArray(x, depth + 1); if (f) return f; }
    return null;
  }
  if (typeof node === "object") {
    for (const k of Object.keys(node)) { const f = findArticleArray(node[k], depth + 1); if (f) return f; }
  }
  return null;
}

function pick(o, re) {
  for (const k of Object.keys(o)) if (re.test(k) && o[k] != null && o[k] !== "") return o[k];
  return null;
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").trim();
}

/* 기사 하나를 {title, press, time, url} 로 정규화 */
function normalize(o, ctx) {
  const title = stripHtml(pick(o, /^(title|subject|headline|articleTitle)$/i));
  if (!title) return null;
  const press = stripHtml(pick(o, /^(officeName|press|source|provider|mediaName|publisher)$/i)) || "";
  const time = pick(o, /^(datetime|date|time|publishedAt|regDate|createdAt|localDateTime|writeDate)$/i) || "";
  let url = pick(o, /^(linkUrl|url|link|articleUrl|originalUrl)$/i);
  if (!url) {
    const officeId = pick(o, /^officeId$/i), articleId = pick(o, /^(articleId|aid)$/i);
    if (officeId && articleId) url = "https://n.news.naver.com/mnews/article/" + officeId + "/" + articleId;
    else if (articleId && ctx === "world") url = "https://stock.naver.com/news/worldnews/" + articleId;
  }
  if (!url) url = "https://search.naver.com/search.naver?where=news&query=" + encodeURIComponent(title);
  return { title, press, time: String(time), url };
}

function parseSymbol(symbol) {
  const m = symbol.match(/^([0-9A-Z]{6})\.(KS|KQ)$/i);
  if (m) return { code: m[1].toUpperCase(), market: "KR" };
  if (/^\^|=|-USD$|=F$/.test(symbol)) return { code: null, market: "NONE" };
  return { code: null, market: "WORLD" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const type = (req.query.type || "").trim();
  const size = Math.min(30, Math.max(3, parseInt(req.query.size || "10", 10) || 10));

  try {
    let raw = null, ctx = "domestic", label = "";

    if (type === "stock") {
      const symbol = (req.query.symbol || "").trim();
      if (!symbol) return res.status(400).json({ error: "symbol required" });
      const p = parseSymbol(symbol);
      if (p.market === "NONE") return res.status(200).json({ ok: true, items: [], note: "지수·환율·원자재는 종목 뉴스가 없습니다." });
      if (p.market === "KR") {
        raw = await getJson(S + "/api/domestic/detail/news?itemCode=" + p.code + "&page=1&pageSize=" + size);
        label = p.code;
      } else {
        // 해외: 자동완성으로 로이터 코드 해석 후 해외 뉴스
        const q = symbol.toUpperCase().replace(/-/g, ".");
        const ac = await getJson(M + "/front-api/search/autoComplete?query=" + encodeURIComponent(symbol) + "&target=stock");
        const items = (ac && ac.result && ac.result.items) || [];
        const hit = items.find((it) => { const rc = (it.reutersCode || "").toUpperCase(); return rc === q || rc.split(".")[0] === q; })
          || items.find((it) => it.reutersCode);
        if (!hit) return res.status(200).json({ ok: true, items: [], note: "해외 종목을 찾지 못했습니다." });
        raw = await getJson(S + "/api/foreign/worldStock/list?reutersCode=" + encodeURIComponent(hit.reutersCode) + "&page=1&pageSize=" + size);
        ctx = "world"; label = hit.reutersCode;
      }
    } else if (type === "market") {
      const cat = (req.query.cat || "main").trim();
      if (cat === "main") {
        raw = await getJson(S + "/api/domestic/news/list?category=MAINNEWS&page=1&pageSize=" + size);
      } else if (cat === "world") {
        raw = await getJson(S + "/api/foreign/news/worldNews?page=1&pageSize=" + size);
        ctx = "world";
      } else if (cat === "focus") {
        const sid = String(req.query.sid || "401").replace(/\D/g, "") || "401";
        const d = new Date();
        const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
        raw = await getJson(S + "/api/domestic/news/focus?sid=" + sid + "&page=1&pageSize=" + size + "&date=" + ymd + "&enableFallback=true");
      } else {
        return res.status(400).json({ error: "unknown cat" });
      }
    } else {
      return res.status(400).json({ error: "type must be stock|market" });
    }

    const arr = findArticleArray(raw, 0) || [];
    const items = arr.map((o) => normalize(o, ctx)).filter(Boolean).slice(0, size);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
    return res.status(200).json({
      ok: true, items, label,
      debug: req.query.debug === "1" ? { topKeys: Object.keys(raw || {}), sample: arr[0] || null } : undefined
    });
  } catch (e) {
    return res.status(200).json({ ok: false, items: [], error: e.message });
  }
}
