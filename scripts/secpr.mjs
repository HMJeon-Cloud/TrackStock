// GitHub Actions에서 돌리는 '실적 발표문 원문' 수집 (v14.20)
//   SEC가 Vercel 서버를 막아서 GitHub 서버에서 curl로 받아 앱 서버로 올린다 (13F 수집과 같은 방식).
//   대상: 실적 팔로업 목록의 미국 종목(또는 SYMS 입력) → 가장 최근 8-K(항목 2.02)의 EX-99.1 · EX-99.2
//   필요한 GitHub 비밀값: SEC_UA, CRON_SECRET (13F 수집과 같은 값 — 새로 만들 것 없음)
import { secText, secJson } from "../api/_disc.js";
import { prHtmlToText, prPickFiling, prExhibits, prTrim } from "../api/_followpr.js";

const SITE = (process.env.SITE_URL || "https://track-stock-tau.vercel.app").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET || "";
const DRY = process.argv.includes("--dry");
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";
const line = (t) => console.log(t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(body) { const r = await fetch(SITE + "/api/channel?op=follow", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + SECRET }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error("HTTP " + r.status + " " + JSON.stringify(j).slice(0, 200)); return j; }

async function main() {
  if (!process.env.SEC_UA) line("경고: SEC_UA 비밀값이 없어요 — SEC가 거절할 수 있어요");
  if (!SECRET && !DRY) { line("오류: CRON_SECRET 비밀값이 없어요"); process.exit(1); }
  let syms = String(process.env.SYMS || "").toUpperCase().split(/[\s,]+/).filter(Boolean), have = {};
  if (SECRET) { try { const j = await api({ prlist: 1 }); have = j.have || {}; if (!syms.length) syms = j.list || []; } catch (e) { line("목록을 받지 못했어요: " + e.message); if (!syms.length) process.exit(1); } }
  syms = syms.filter((s) => /^[A-Z][A-Z.\-]{0,6}$/.test(s) && !/\.(KS|KQ)$/.test(s));
  if (!syms.length) { line("대상 종목이 없어요 (실적 팔로업에 미국 종목을 넣거나 SYMS를 입력하세요)"); return; }
  line("대상 " + syms.length + "종목: " + syms.join(", "));
  const tick = await secJson("https://www.sec.gov/files/company_tickers.json", 30000), cik = {};
  Object.keys(tick).forEach((k) => { cik[String(tick[k].ticker).toUpperCase()] = tick[k].cik_str; });
  let up = 0, fail = 0;
  for (const s of syms) {
    try {
      const c = cik[s] || cik[s.replace(".", "-")]; if (!c) { line("  " + s + ": SEC 등록 번호(CIK)를 찾지 못했어요"); fail++; continue; }
      await sleep(250);
      const sub = await secJson("https://data.sec.gov/submissions/CIK" + String(c).padStart(10, "0") + ".json", 30000), f = prPickFiling(sub);
      if (!f) { line("  " + s + ": 최근 제출 목록에 실적 8-K(항목 2.02)가 없어요"); continue; }
      if (!FORCE && have[s] && have[s].acc === f.acc) { line("  " + s + ": 이미 받은 발표문(" + f.date + ")이 최신이에요"); continue; }
      const base = "https://www.sec.gov/Archives/edgar/data/" + c + "/" + f.acc.replace(/-/g, "") + "/";
      await sleep(250);
      let ex = []; try { ex = prExhibits(await secText(base + f.acc + "-index.htm", 30000)); } catch (e) { line("  " + s + ": 색인 페이지를 못 읽어 파일 목록으로 대신해요 (" + String(e.message).slice(0, 60) + ")"); }
      if (!ex.length) { try { await sleep(250); const dir = await secJson(base + "index.json", 30000); ex = ((dir.directory && dir.directory.item) || []).map((x) => x.name).filter((n) => /\.html?$/i.test(n) && n !== f.doc && !/index/i.test(n) && /ex-?99|exhibit ?99|ex99|press|release|earn|pr\.htm|letter|commentary/i.test(n)).slice(0, 2).map((n, i) => ({ type: "EX-99." + (i + 1) + "(추정)", href: base + n, desc: n })); } catch (e) {} }
      if (!ex.length) { line("  " + s + ": 8-K(" + f.date + ")에 EX-99 첨부가 없어요"); fail++; continue; }
      const parts = [], urls = [];
      for (const e of ex.slice(0, 2)) { await sleep(250); const u = e.href.startsWith("http") ? e.href : "https://www.sec.gov" + (e.href.startsWith("/") ? e.href : "/" + e.href); const t = prHtmlToText(await secText(u, 40000)); if (t.length < 400) continue; parts.push("=== " + e.type + (e.desc ? " · " + e.desc : "") + " ===\n" + prTrim(t, parts.length ? 20000 : 42000)); urls.push(u); }
      if (!parts.length) { line("  " + s + ": 첨부 본문이 비어 있어요"); fail++; continue; }
      const text = parts.join("\n\n"), body = { prput: { sym: s, date: f.date, acc: f.acc, url: urls[0], title: (sub.name || s) + " 8-K " + f.date + " (" + ex.slice(0, 2).map((e) => e.type).join(" · ") + ")", text } };
      line("  " + s + ": " + f.date + " · " + ex.slice(0, 2).map((e) => e.type).join(" + ") + " · " + text.length.toLocaleString() + "자");
      if (DRY) { line(text.slice(0, 600)); continue; }
      await api(body); up++;
    } catch (e) { line("  " + s + ": 실패 — " + String(e.message).slice(0, 160)); fail++; if (/HTTP 403/.test(String(e.message))) { line("SEC가 막았어요(403). 여기서 멈춥니다."); break; } }
  }
  line("올림 " + up + "건 · 실패 " + fail + "건");
  if (fail && !up) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
