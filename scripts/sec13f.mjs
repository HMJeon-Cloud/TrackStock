// GitHub Actions에서 돌리는 13F 수집 (v11.2.7)
//   SEC가 Vercel 서버 IP를 막아서, 13F만 GitHub 서버에서 받아 앱 서버로 올린다.
//   계산은 앱 서버와 같은 코드(api/_disc.js)를 그대로 쓴다.
//   필요한 GitHub 비밀값(Settings → Secrets and variables → Actions): SEC_UA, CRON_SECRET
//   실행: .github/workflows/sec13f.yml (처음엔 'Run workflow' 버튼으로 한 번만)
import { buildGurus, buildTickMap, secJson, GURUS } from "../api/_disc.js";

const SITE = (process.env.SITE_URL || "https://track-stock-tau.vercel.app").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET || "";
const DRY = process.argv.includes("--dry");   // 올리지 않고 결과만 출력

function line(t) { console.log(t); }
async function main() {
  if (!process.env.SEC_UA) line("경고: SEC_UA 비밀값이 없어요 — SEC가 거절할 수 있어요");
  if (!SECRET && !DRY) { line("오류: CRON_SECRET 비밀값이 없어요 — 결과를 올릴 수 없어요"); process.exit(1); }

  // ① 지난 결과 (공개 주소) — 이미 받은 보고서는 다시 받지 않는다
  let prev = { gurus: [] };
  try { const r = await fetch(SITE + "/api/snap?guru=1&fresh=" + Date.now()); if (r.ok) prev = await r.json(); } catch (e) {}
  line("지난 결과: " + (prev.gurus || []).length + "명 · " + (prev.updated || "없음"));

  // ② SEC에서 받기 (최대 15분 · 투자자 전원)
  let mapCache = null;
  const { doc, result } = await buildGurus(prev, {
    budgetMs: 15 * 60e3, maxUpdates: GURUS.length, via: "github",
    getMap: async (ms) => { if (!mapCache) mapCache = buildTickMap(await secJson("https://www.sec.gov/files/company_tickers.json", Math.max(ms, 20000))); return mapCache; },
  });
  line("SEC 확인 " + result.checked + "명 · 새 보고서 " + result.updated.length + "명 (" + result.updated.join(", ") + ")");
  (result.log.errors || []).forEach((e) => line("  오류: " + e));
  doc.gurus.forEach((g) => line("  " + g.nm + " · " + g.period + " · 보유 " + g.n + "개 · 산 " + (g.buys || []).length + " / 판 " + (g.sells || []).length));
  if (result.reason === "SEC_403") { line("SEC가 GitHub 서버도 막았어요 (403). 올리지 않고 끝냅니다."); process.exit(2); }
  if (!doc.gurus.length) { line("받은 보고서가 없어서 올리지 않아요."); process.exit(result.checked ? 0 : 1); }
  if (DRY) { line("--dry: 올리지 않음"); return; }

  // ③ 앱 서버로 올리기
  const r = await fetch(SITE + "/api/channel?op=guruput", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + SECRET }, body: JSON.stringify({ gurus: doc.gurus, log: doc.log }) });
  const j = await r.json().catch(() => ({}));
  line("올리기: HTTP " + r.status + " · " + JSON.stringify(j));
  if (!r.ok || !j.ok) process.exit(1);
}
main().catch((e) => { console.error("실패: " + (e && e.stack || e)); process.exit(1); });
