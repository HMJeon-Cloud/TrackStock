// /api/news?type=stock&q=삼성전자          → 종목 뉴스 (종목명으로 검색)
// /api/news?type=market&cat=main|world|market|fx|rate
// 네이버 검색 API (developers.naver.com, 공식) 사용. 하루 25,000회, 약관상 서비스 이용 가능.
// 환경변수 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 필요. 없으면 ok:false, reason:"NO_KEY".
const ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

const MARKET_QUERY = {
  main: "증시 마감",
  world: "미국 증시 뉴욕증시",
  market: "코스피 전망",
  fx: "원달러 환율",
  rate: "기준금리 연준 한국은행"
};

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&apos;/g, "'").trim();
}

function pressFromUrl(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    const MAP = {
      "yna.co.kr": "연합뉴스", "yonhapnewstv.co.kr": "연합뉴스TV", "news1.kr": "뉴스1", "newsis.com": "뉴시스",
      "hankyung.com": "한국경제", "mk.co.kr": "매일경제", "sedaily.com": "서울경제", "edaily.co.kr": "이데일리",
      "mt.co.kr": "머니투데이", "fnnews.com": "파이낸셜뉴스", "asiae.co.kr": "아시아경제", "heraldcorp.com": "헤럴드경제",
      "chosun.com": "조선일보", "biz.chosun.com": "조선비즈", "joongang.co.kr": "중앙일보", "donga.com": "동아일보",
      "hani.co.kr": "한겨레", "khan.co.kr": "경향신문", "kbs.co.kr": "KBS", "mbc.co.kr": "MBC", "sbs.co.kr": "SBS",
      "ytn.co.kr": "YTN", "jtbc.co.kr": "JTBC", "etnews.com": "전자신문", "zdnet.co.kr": "지디넷", "thebell.co.kr": "더벨",
      "infostockdaily.co.kr": "인포스탁", "newspim.com": "뉴스핌", "etoday.co.kr": "이투데이", "moneys.co.kr": "머니S",
      "dt.co.kr": "디지털타임스", "ajunews.com": "아주경제", "kmib.co.kr": "국민일보", "seoul.co.kr": "서울신문"
    };
    if (MAP[host]) return MAP[host];                       // 정확 일치 우선 (biz.chosun.com ≠ chosun.com)
    for (const k of Object.keys(MAP)) if (host.endsWith("." + k)) return MAP[k];
    return host;
  } catch (e) { return ""; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) {
    return res.status(200).json({ ok: false, reason: "NO_KEY", items: [],
      note: "네이버 검색 API 키가 설정되지 않았습니다 (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)." });
  }

  const type = (req.query.type || "").trim();
  const size = Math.min(30, Math.max(3, parseInt(req.query.size || "10", 10) || 10));
  let query = "";
  if (type === "stock") {
    query = (req.query.q || "").trim().slice(0, 40);
    if (!query) return res.status(400).json({ error: "q required" });
    // 종목명만 넣으면 잡음이 섞이므로 '주가'를 붙여 증권 기사 위주로 좁힌다
    query = query.replace(/\(.*?\)/g, "").trim() + " 주가";
  } else if (type === "market") {
    const cat = (req.query.cat || "main").trim();
    query = MARKET_QUERY[cat];
    if (!query) return res.status(400).json({ error: "unknown cat" });
  } else {
    return res.status(400).json({ error: "type must be stock|market" });
  }

  try {
    const url = ENDPOINT + "?query=" + encodeURIComponent(query) + "&display=" + size + "&start=1&sort=date";
    const r = await fetch(url, { headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret } });
    if (!r.ok) {
      const t = await r.text();
      return res.status(200).json({ ok: false, reason: "UPSTREAM", items: [], note: "네이버 검색 API 오류 " + r.status + " " + t.slice(0, 120) });
    }
    const j = await r.json();
    const items = (j.items || []).map((it) => {
      return {
        title: stripHtml(it.title),
        press: pressFromUrl(it.originallink || it.link),
        time: it.pubDate || "",
        url: it.link || it.originallink,   // 네이버 뉴스 링크 우선, 없으면 원문
        origin: it.originallink || ""
      };
    }).filter((x) => x.title);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
    return res.status(200).json({ ok: true, items, query, total: j.total || items.length });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "ERROR", items: [], note: e.message });
  }
}
