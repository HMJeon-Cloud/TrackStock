// /api/config — 클라이언트가 정적 스냅샷 위치를 알아내는 용도.
// list()는 Blob의 Advanced Operation(월 2,000회 무료)이라 요청마다 부르면 안 된다.
// 공개 URL은 BLOB_STORE_ID로 만들 수 있으므로 그렇게 구성하고, 실제로 읽히는지만 확인한다.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const out = { snapshotBase: null, updated: null, reason: null, symbols: 0 };

  try {
    const id = (process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
    if (!id) {
      out.reason = process.env.BLOB_READ_WRITE_TOKEN ? "NO_STORE_ID" : "NO_BLOB_TOKEN";
    } else {
      const base = "https://" + id + ".public.blob.vercel-storage.com/";
      const probe = await fetch(base + "manifest.json");   // 단순 조회 (Advanced 아님)
      if (!probe.ok) {
        out.reason = probe.status === 404 ? "NO_MANIFEST" : "BLOB_NOT_PUBLIC";
        out.probeStatus = probe.status;
      } else {
        const m = await probe.json().catch(() => null);
        out.snapshotBase = base;
        out.updated = (m && m.generated) || null;
        out.symbols = m && m.symbols ? Object.keys(m.symbols).length : 0;
        out.complete = m ? !!m.complete : null;
        out.recentDays = m ? m.recentDays || null : null;
      }
    }
  } catch (e) {
    out.reason = "ERROR";
    out.detail = String(e.message).slice(0, 160);
  }

  out.news = !!((process.env.NAVER_HUB_KEY_ID && process.env.NAVER_HUB_KEY) ||
                (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET));
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
  res.status(200).json(out);
}
