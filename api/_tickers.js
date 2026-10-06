// 종목 목록(tickers.js) 읽기 — 서버 공용
//   예전에는 크론이 자기 사이트 주소로 /tickers.js 를 내려받았는데, 예약 실행 때는 배포별 내부 주소로 요청이 가서
//   Vercel 로그인 보호 페이지(HTML)가 대신 돌아오는 문제가 있었다 (2026-10-01·02 아침 미갱신의 원인).
//   그래서 ① 함께 배포된 파일을 직접 읽고 → ② 안 되면 공개 주소에서 받고 → ③ 그래도 안 되면 요청 주소에서 받는다.
//   어느 경우든 '종목처럼 생긴 것'만 남기고, 개수가 너무 적으면 실패로 본다.
import { readFileSync } from "fs";
import path from "path";

const PUBLIC_ORIGIN = process.env.SITE_URL || "https://track-stock-tau.vercel.app";
const SYM_RE = /^[A-Z0-9^][A-Z0-9^.=\-]{0,15}$/;
export const MIN_SYMBOLS = 100;

function parse(src) {
  const pairs = []; const re = /\[\s*"([^"]+)"\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?/g; let m;
  while ((m = re.exec(src))) if (SYM_RE.test(m[1])) pairs.push([m[1], m[2], m[3] || ""]);
  return pairs;
}
export async function loadTickerPairs(reqOrigin) {
  const tried = [];
  // ① 배포 파일 직접 읽기 (vercel.json includeFiles)
  for (const p of [path.join(process.cwd(), "tickers.js"), path.join(process.cwd(), "..", "tickers.js")]) {
    try { const pairs = parse(readFileSync(p, "utf8")); if (pairs.length >= MIN_SYMBOLS) return { pairs, source: "file" }; tried.push("file:" + pairs.length); }
    catch (e) { tried.push("file:없음"); }
  }
  // ② 공개 주소 → ③ 요청 주소
  for (const origin of [PUBLIC_ORIGIN, reqOrigin].filter(Boolean)) {
    try {
      const r = await fetch(origin + "/tickers.js", { cache: "no-store" });
      const pairs = parse(await r.text());
      if (pairs.length >= MIN_SYMBOLS) return { pairs, source: origin };
      tried.push(origin.replace(/^https?:\/\//, "") + ":" + r.status + "/" + pairs.length);
    } catch (e) { tried.push(origin.replace(/^https?:\/\//, "") + ":오류"); }
  }
  const err = new Error("종목 목록을 읽지 못함 (" + tried.join(", ") + ")");
  err.tried = tried;
  throw err;
}
