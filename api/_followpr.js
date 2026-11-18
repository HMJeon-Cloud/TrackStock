/* v14.20 실적 발표문 원문 — SEC 8-K(항목 2.02 실적 발표)의 첨부 EX-99.1(보도자료) · EX-99.2(CFO 설명 · 주주서한)
   SEC는 Vercel 서버를 막으므로 GitHub Actions(scripts/secpr.mjs)가 받아서 올리고, 앱 서버는 저장 · 조회만 한다.
   이 파일은 양쪽이 함께 쓰는 순수 함수만 둔다(네트워크 없음). api 함수 파일이 아니다(밑줄 파일). */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", reg: "®", trade: "™", copy: "©", hellip: "…" };
export function prHtmlToText(html) {
  let s = String(html || "");
  s = s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|head|ix:header)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<\/(td|th)>/gi, " | ").replace(/<\/tr>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h[1-6]|li|table|ul|ol)>/gi, "\n").replace(/<[^>]+>/g, "");
  s = s.replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch (e) { return " "; } }).replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch (e) { return " "; } }).replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] != null ? ENT[n.toLowerCase()] : " "));
  s = s.replace(/[   ]/g, " ").replace(/[ \t]+/g, " ");
  // 표의 빈 칸 정리: "| | $ | 1,234 | |" → "$1,234"
  s = s.split("\n").map((l) => l.replace(/(\|\s*)+\|/g, "|").replace(/\$\s*\|\s*/g, "$").replace(/\s*\|\s*([%)])/g, "$1").replace(/\(\s*\|\s*/g, "(").replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim()).filter((l, i, a) => l || (a[i - 1] && a[i - 1] !== "")).join("\n");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
/* submissions JSON → 가장 최근 실적 8-K (항목 2.02) */
export function prPickFiling(sub) {
  const r = sub && sub.filings && sub.filings.recent; if (!r || !Array.isArray(r.form)) return null;
  for (let i = 0; i < r.form.length; i++) { if (!/^8-K/.test(r.form[i]) || !/(^|,)\s*2\.02/.test(String((r.items || [])[i] || ""))) continue; return { acc: r.accessionNumber[i], date: r.filingDate[i], doc: (r.primaryDocument || [])[i] || "", form: r.form[i] }; }
  return null;
}
/* 제출 색인 페이지(-index.htm) → 첨부 목록 [{type, href, desc}] */
export function prExhibits(indexHtml) {
  const out = []; const rows = String(indexHtml || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];
  rows.forEach((tr) => { const tds = (tr.match(/<td[\s\S]*?<\/td>/gi) || []).map((x) => x); if (tds.length < 4) return; const hm = tr.match(/href="([^"]+)"/i); if (!hm) return;
    const txt = tds.map((x) => x.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()); const type = txt.find((x) => /^EX-99(\.\d+)?$/i.test(x) || /^8-K/i.test(x)) || "";
    if (!/^EX-99/i.test(type)) return; let href = hm[1].replace(/^\/ix\?doc=/, ""); if (!/\.html?$/i.test(href)) return; out.push({ type: type.toUpperCase(), href, desc: txt[1] || "" }); });
  return out.sort((a, b) => (a.type < b.type ? -1 : 1));
}
export const PR_MAX = 60000;
/* 저장용으로 다듬기: 너무 길면 앞부분(본문 · 요약 표)을 우선 */
export function prTrim(text, max) { const t = String(text || "").replace(/\r/g, "").trim(); const m = max || PR_MAX; return t.length > m ? t.slice(0, m) + "\n…(뒤는 잘랐어요 — 전체 " + t.length.toLocaleString() + "자)" : t; }
