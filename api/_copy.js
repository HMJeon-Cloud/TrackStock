// v12.38 업로드 글(인스타·스레드) — Claude API로 다시 쓰기 (운영자가 버튼을 누를 때만)
//   새 서버 함수 없음: /api/channel?op=copy (POST) 에서 부른다.
//   입력 = 앱이 만든 규칙 글(우리 데이터·숫자) + 카드 제목·주제. 출력 = 변형 2개(인스타·스레드 본문·답글 1·2) + 웹에서 보완한 사실 + 출처
//   비용 보호: 하루 호출 상한(COPY_DAILY_MAX, 기본 40) · 입력 길이 제한 · 출력 토큰 제한 · 웹 검색 최대 3회(COPY_WEB=0이면 끔)
//   환경변수: ANTHROPIC_API_KEY(필수) · ANTHROPIC_MODEL(기본 claude-sonnet-5-5) · COPY_DAILY_MAX · COPY_WEB
import { redisConf, redisCmd } from "./_redis.js";

const SYSTEM = `너는 한국 투자 SNS 계정 '우상향연구소(@uphill.lab)'의 업로드 글 편집자다.
계정 성격: 주식 초보를 위한 데이터 계정. 하락장에도 흔들리지 않게 '과거 숫자'로 보여준다. 검정·금색 브랜드, 차분하고 정확한 말투(해요체).
목표: 같은 카드라도 더 많이 노출되게(저장·공유·댓글·프로필 방문) 글을 쓴다.

반드시 지킬 것
1. 숫자는 <our_data>에 있는 값만 그대로 쓴다. 반올림·단위·부호를 바꾸지 않는다. 새 숫자를 지어내지 않는다.
2. 웹 검색은 <our_data>를 보완할 '최근 사실'이 있을 때만 쓴다(예: 그 등락의 이유가 된 발표·실적·정책). 검색한 사실은 7일 이내 것만, 확실한 것만 쓰고, added 목록에 출처와 함께 적는다. 보완할 게 없으면 검색하지 않는다.
3. 매수·매도 권유, 목표가, 수익 보장, 과장(폭등·대박 확정 등) 금지. 예측은 '과거엔 이랬다' 수준까지만.
4. 이모지는 인스타에만 0~3개. 스레드는 이모지 없이.
5. 해시태그는 인스타 끝에만 6~10개(한국어 위주, 너무 큰 태그만 쓰지 말고 중간 크기 섞기).

글 구조
- 인스타 캡션(ig, 2,000자 이하): 첫 줄 = 피드에서 멈추게 하는 한 줄(30자 이하, 궁금증·의외의 숫자). 이어서 핵심 숫자 3~5줄 → 왜 그런지/의미 2~3줄(초보 눈높이) → 저장·공유를 부르는 한 줄 → 댓글 질문 하나 → "더 많은 숫자는 프로필에서" 류의 유입 문장 → 한 줄 면책(투자 권유 아님) → 해시태그.
- 스레드 본문(th, 480자 이하): 첫 줄이 피드에 보인다. 첫 줄에 의외의 숫자나 질문. 짧은 줄 위주. 해시태그 없음.
- 답글 1(r1, 480자 이하): 반대 숫자·한계·주의점(신뢰를 주는 정직한 한계).
- 답글 2(r2, 480자 이하): 참여 질문 하나 + 다음 글 예고 또는 프로필 유입.
- 변형 2개를 서로 다른 각도로: ① 궁금증형(질문·반전으로 시작) ② 정보형(저장하고 싶은 정리).

출력: 아래 JSON 하나만. 다른 말 금지.
{"variants":[{"label":"궁금증형","ig":"...","th":"...","r1":"...","r2":"..."},{"label":"정보형","ig":"...","th":"...","r1":"...","r2":"..."}],"added":["웹에서 보완한 사실 한 줄 — 출처 이름"],"note":"편집자 메모 한 줄(무엇을 보완했고 무엇은 일부러 뺐는지)"}`;

function kstDay() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function clip(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) : s; }
function pickJson(text) { const a = text.indexOf("{"), b = text.lastIndexOf("}"); if (a < 0 || b <= a) return null; try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { return null; } }

export async function copyHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max = +(process.env.COPY_DAILY_MAX || 40), web = process.env.COPY_WEB !== "0";
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || !body.data) return res.status(400).json({ ok: false, reason: "data 필요" });
  // 하루 상한
  const rc = redisConf(), dayKey = "sm:copy:" + kstDay();
  let used = 0;
  if (rc) { try { used = +(await redisCmd(rc, ["INCR", dayKey])) || 0; if (used === 1) await redisCmd(rc, ["EXPIRE", dayKey, String(3 * 86400)]); } catch (e) {} }
  if (used > max) return res.status(200).json({ ok: false, reason: "DAILY_MAX", msg: "오늘 AI 문구 횟수(" + max + "회)를 다 썼어요 — COPY_DAILY_MAX로 늘릴 수 있어요" });

  const user = `<card_title>${clip(body.title, 120)}</card_title>
<topic>${clip(body.topic, 40)}</topic>
<date>${kstDay()} (한국 시간)</date>
<our_data>
${clip(body.data, 6000)}
</our_data>
${body.lines ? "<card_lines>\n" + clip(body.lines, 3000) + "\n</card_lines>" : ""}
위 카드의 업로드 글을 써 줘. 숫자는 our_data·card_lines에 있는 그대로만.`;
  const payload = { model, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] };
  if (web) payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }];
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 120000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return res.status(200).json({ ok: false, reason: "API_" + r.status, msg: clip(j && j.error && j.error.message, 200) });
    const blocks = j.content || [], text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
    const src = [], seen = {};
    blocks.forEach((b) => { (b.citations || []).forEach((c) => { if (c.url && !seen[c.url]) { seen[c.url] = 1; src.push({ t: clip(c.title, 80), u: c.url }); } }); });
    const searches = blocks.filter((b) => b.type === "server_tool_use").map((b) => b.input && b.input.query).filter(Boolean);
    const out = pickJson(text);
    if (!out || !Array.isArray(out.variants) || !out.variants.length) return res.status(200).json({ ok: false, reason: "PARSE", msg: "AI 응답을 읽지 못했어요", raw: clip(text, 400) });
    const variants = out.variants.slice(0, 3).map((v) => ({ label: "✨ " + clip(v.label || "AI", 12), ig: clip(v.ig, 2200), th: clip(v.th, 500), r1: clip(v.r1, 500), r2: clip(v.r2, 500) }));
    return res.status(200).json({ ok: true, model, variants, added: (out.added || []).slice(0, 5).map((x) => clip(x, 200)), note: clip(out.note, 300), sources: src.slice(0, 6), searches, used, max, usage: j.usage || null });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: e.name === "AbortError" ? "TIMEOUT" : "ERROR", msg: clip(e.message, 160) });
  } finally { clearTimeout(tm); }
}
