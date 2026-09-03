// /api/config — 클라이언트가 정적 스냅샷의 위치를 알아내는 용도.
// Blob 저장소에 manifest.json이 있으면 그 공개 URL의 베이스를 돌려준다. 없으면 null (실시간 경로로 폴백).
import { list } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  let base = null, updated = null, count = 0;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const r = await list({ prefix: "manifest.json", limit: 1 });
      const b = r.blobs && r.blobs[0];
      if (b && b.url) {
        base = b.url.replace(/manifest\.json.*$/, "");
        updated = b.uploadedAt || null;
      }
    }
  } catch (e) { /* 저장소 미연결 등 → 폴백 */ }
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  res.status(200).json({ snapshotBase: base, updated, news: !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) });
}
