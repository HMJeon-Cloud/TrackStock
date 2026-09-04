// /api/config — 클라이언트가 정적 스냅샷의 위치를 알아내는 용도.
// Blob에 manifest.json이 있고 그 URL이 "토큰 없이" 읽히는지까지 확인해서 알려준다.
// (Blob 저장소를 Private으로 만들면 URL은 있지만 공개 접근이 안 되므로 여기서 걸러낸다)
import { list } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const out = { snapshotBase: null, updated: null, reason: null, symbols: 0 };

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      out.reason = "NO_BLOB_TOKEN";
    } else {
      const r = await list({ prefix: "manifest.json", limit: 1 });
      const b = r.blobs && r.blobs[0];
      if (!b || !b.url) {
        out.reason = "NO_MANIFEST";           // 크론이 아직 한 번도 성공하지 않음
      } else {
        // 토큰 없이 실제로 읽히는지 확인 (Private 저장소면 여기서 실패한다)
        const probe = await fetch(b.url, { cache: "no-store" });
        if (!probe.ok) {
          out.reason = "BLOB_NOT_PUBLIC";
          out.probeStatus = probe.status;
          out.manifestUrl = b.url;
        } else {
          const m = await probe.json().catch(() => null);
          out.snapshotBase = b.url.replace(/manifest\.json.*$/, "");
          out.updated = (m && m.generated) || b.uploadedAt || null;
          out.symbols = m && m.symbols ? Object.keys(m.symbols).length : 0;
          out.complete = m ? !!m.complete : null;
        }
      }
    }
  } catch (e) {
    out.reason = "ERROR";
    out.detail = String(e.message).slice(0, 160);
  }

  out.news = !!((process.env.NAVER_HUB_KEY_ID && process.env.NAVER_HUB_KEY) ||
                (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET));
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
  res.status(200).json(out);
}
