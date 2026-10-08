// /api/channel — 채널 발행용 '미국 증시 데일리 브리핑' 글 (JSON {text, asOf, ...})
//   아침 수집 데이터(Redis) + 네이버 뉴스 제목으로 만든다. CDN 30분 캐시. 운영자 페이지(채널 탭)가 보여준다.
import { redisConf, getJsonGzText, redisCmd, KEY } from "./_redis.js";
import { composeDaily } from "./_compose.js";
import { loadTickerPairs } from "./_tickers.js";
import { reqIsOwner } from "./_owner.js";

export async function loadNames(origin) {
  const { pairs } = await loadTickerPairs(origin);
  const out = {};
  pairs.forEach(([sym, name]) => { if (!out[sym]) out[sym] = name.replace(/\s*\(.*?\)\s*/g, "").trim() || name; });
  return out;
}
export async function buildDaily(origin) {
  const redis = redisConf();
  if (!redis) return { ok: false, reason: "NO_REDIS" };
  const t = await getJsonGzText(redis, KEY.recent);
  if (!t) return { ok: false, reason: "NO_DATA" };
  const recent = JSON.parse(t);
  let names = {}; try { names = await loadNames(origin); } catch (e) {}
  let news = [];
  try {
    const r = await fetch(origin + "/api/news?type=market&cat=world&size=8");
    const j = await r.json(); news = (j && j.items) || [];
  } catch (e) {}
  const out = composeDaily(recent, names, news);
  return { ok: true, ...out, generated: recent.generated };
}
export default async function handler(req, res) {
  // 운영자 전용: 토큰이 없으면 내용 없이 거절 (CDN에도 남기지 않음)
  if (!reqIsOwner(req)) { res.setHeader("Cache-Control", "no-store"); return res.status(401).json({ ok: false, reason: "OWNER_ONLY" }); }
  if (req.query.op === "ai") return aiHandler(req, res);   // v9.5 대표 카드 문구 (OpenAI) — 새 함수 파일을 만들 수 없어(무료 12개 한도) 여기에 붙임
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = proto + "://" + req.headers.host;
  const d = await buildDaily(origin);
  res.setHeader("Cache-Control", d.ok ? "private, max-age=600" : "no-store");   // 운영자 전용이라 공용 캐시엔 두지 않음
  return res.status(200).json(d);
}

/* ---------- v9.5 대표 카드 문구: OpenAI ----------
   숫자는 절대 AI가 쓰지 않는다. 항목 카드는 데이터 값(f1, f2…)을 {f1}처럼 '자리표시'로만 부르게 하고, 실제 숫자는 화면이 데이터에서 채운다.
   내 글 카드는 입력한 글에 있는 숫자만 쓰도록 지시하고, 화면이 다시 한 번 숫자를 대조한다.
   비용 보호: 하루 호출 수 상한(AI_DAILY_MAX, 기본 30) · 입력 길이 제한 · 출력 토큰 제한 */
const AI_SCHEMA_ITEM = {
  type: "object", additionalProperties: false, required: ["hook", "kicker", "hero", "rows", "teaser"],
  properties: {
    hook: { type: "string", description: "2줄 이하 훅. 숫자를 직접 쓰지 말고 {f1}처럼 자리표시만. 줄바꿈은 \\n" },
    kicker: { type: "string", description: "12자 이하 작은 머리말. 숫자 금지" },
    hero: { type: "string", description: "가장 크게 보여줄 사실의 id (예: f1)" },
    rows: { type: "array", items: { type: "object", additionalProperties: false, required: ["f", "label"], properties: { f: { type: "string" }, label: { type: "string", description: "14자 이하. 숫자 금지" } } } },
    teaser: { type: "string", description: "게시물로 넘어가게 하는 한 줄(30자 이하). 숫자는 {n}(게시물 장수)만 허용" }
  }
};
const AI_SCHEMA_CUSTOM = {
  type: "object", additionalProperties: false, required: ["kicker", "hook", "layout", "points", "table", "takeaway", "source"],
  properties: {
    kicker: { type: "string", description: "주제 꼬리표 10자 이하" },
    hook: { type: "string", description: "3초 안에 내용을 알 수 있는 제목 겸 훅, 2줄 이하, \\n으로 줄바꿈" },
    layout: { type: "string", enum: ["list", "table", "steps"] },
    points: { type: "array", items: { type: "object", additionalProperties: false, required: ["h", "d"], properties: { h: { type: "string", description: "굵은 한 줄 18자 이하" }, d: { type: "string", description: "설명 40자 이하" } } } },
    table: { type: "object", additionalProperties: false, required: ["head", "rows"], properties: { head: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } } } },
    takeaway: { type: "string", description: "핵심 한 줄 40자 이하" },
    source: { type: "string", description: "입력에 출처가 있으면 그대로, 없으면 빈 문자열" }
  }
};
const AI_RULES = "너는 인스타그램 투자·재테크 계정 '우상향연구소(@uphill.lab)'의 카드 편집자다. 독자는 주식 초보다. 한국어, 존댓말 대신 짧은 명사형·해요체를 섞는다. " +
  "절대 규칙: 종목 추천·매수/매도 권유·가격 예측·'무조건/확정/대박' 같은 과장 금지. 사실과 숫자를 지어내지 않는다. 이모지 금지. " +
  "목표: 릴스 한 장을 보고 3초 안에 무슨 내용인지 알고, 궁금해서 게시물(상세 카드)로 넘어가게 만든다. " +
  "흐름은 훅(초보가 이미 하는 질문 또는 반전) → 가장 큰 숫자 하나 → 그 숫자를 받쳐 주는 줄 3~4개 → 게시물에서 이어지는 답. 내 돈·내 계좌·생활에 바로 닿는 말로 쓰고, 어려운 용어는 쉬운 말로 바꾼다. 짧을수록 좋다.";
async function aiHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || "gpt-6.1-sol", fallback = process.env.OPENAI_FALLBACK || "gpt-4.1", max = +(process.env.AI_DAILY_MAX || 30);
  const rc = redisConf(), day = "sm:ai:" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  if (req.method !== "POST") { let used = 0; try { if (rc) used = +(await redisCmd(rc, ["GET", day])) || 0; } catch (e) {} return res.status(200).json({ ok: true, ai: !!key, model, fallback, used, max }); }
  if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  if (rc) { try { const n = await redisCmd(rc, ["INCR", day]); if (n === 1) await redisCmd(rc, ["EXPIRE", day, "172800"]); if (n > max) return res.status(200).json({ ok: false, reason: "DAILY_LIMIT", max }); } catch (e) {} }
  let schema, user;
  if (b.mode === "custom") {
    const text = String(b.text || "").slice(0, 6000);
    if (!text.trim()) return res.status(400).json({ ok: false, reason: "EMPTY" });
    schema = AI_SCHEMA_CUSTOM;
    user = "아래 글을 릴스용 한 장 카드로 정리해 줘. 숫자·날짜·금액·비율은 반드시 아래 글에 있는 표기 그대로만 쓰고, 계산하거나 새로 만들지 마. 글에 없는 내용은 넣지 마. " +
      "비교·조건·구간이 많으면 layout=table, 순서가 있으면 steps, 아니면 list. 쓰지 않는 쪽(points 또는 table)은 빈 배열로.\n" + (b.hint ? "주제 힌트: " + String(b.hint).slice(0, 100) + "\n" : "") + "---\n" + text;
  } else {
    const facts = (Array.isArray(b.facts) ? b.facts : []).slice(0, 40).map((f) => ({ id: String(f.id).slice(0, 6), label: String(f.label).slice(0, 60), value: String(f.value).slice(0, 40) }));
    if (!facts.length) return res.status(400).json({ ok: false, reason: "NO_FACTS" });
    schema = AI_SCHEMA_ITEM;
    user = "주제: " + String(b.title || "").slice(0, 60) + " / 상세 게시물 장수: {n}장\n사실 목록(이 값만 사용, 숫자는 직접 쓰지 말고 {id}로 부를 것):\n" +
      facts.map((f) => f.id + " | " + f.label + " | " + f.value).join("\n") +
      "\n\n가장 궁금증을 만드는 사실 하나를 hero로, 흐름이 이어지게 rows 3~4개를 골라. hook은 초보가 이미 하는 질문이나 반전으로 시작. label은 그 값이 무엇인지 바로 알게.";
  }
  const name = b.mode === "custom" ? "custom_card" : "item_card", tries = [];
  // ① 기본 모델(gpt-6.1-sol): Responses API · 추론 low · JSON 스키마 강제 (temperature는 이 모델에서 받지 않음)
  let r1 = await aiResponses(key, model, AI_RULES, user, name, schema, 35000);
  tries.push(model + ": " + (r1.ok ? "성공" : r1.reason));
  if (r1.ok) return res.status(200).json({ ok: true, out: r1.out, model, usage: r1.usage, tries });
  // ② 계정에서 못 쓰거나 실패하면 gpt-4.1(Chat Completions)로 한 번 더
  if (fallback && fallback !== model && r1.reason !== "REFUSED") {
    const r2 = await aiChat(key, fallback, AI_RULES, user, name, schema, 20000);
    tries.push(fallback + ": " + (r2.ok ? "성공" : r2.reason));
    if (r2.ok) return res.status(200).json({ ok: true, out: r2.out, model: fallback, usage: r2.usage, tries });
    return res.status(200).json({ ok: false, reason: r2.reason, detail: r2.detail, tries });
  }
  return res.status(200).json({ ok: false, reason: r1.reason, detail: r1.detail, tries });
}

async function aiPost(url, key, body, ms) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { method: "POST", signal: ctl.signal, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, j };
  } catch (e) { return { status: 0, j: {}, err: e.name === "AbortError" ? "TIMEOUT" : "FETCH_FAIL" }; } finally { clearTimeout(tm); }
}
async function aiResponses(key, model, sys, user, name, schema, ms) {
  const { status, j, err } = await aiPost("https://api.openai.com/v1/responses", key, {
    model, reasoning: { effort: "low" }, max_output_tokens: 6000,
    input: [{ role: "system", content: sys }, { role: "user", content: user }],
    text: { format: { type: "json_schema", name, strict: true, schema } }
  }, ms);
  if (err) return { ok: false, reason: err };
  if (status !== 200) return { ok: false, reason: "OPENAI_" + status, detail: String((j.error && j.error.message) || "").slice(0, 200) };
  let txt = "", refused = false;
  (j.output || []).forEach((it) => { if (it.type === "message") (it.content || []).forEach((c) => { if (c.type === "output_text") txt += c.text; if (c.type === "refusal") refused = true; }); });
  if (refused) return { ok: false, reason: "REFUSED" };
  if (!txt) return { ok: false, reason: j.status === "incomplete" ? "INCOMPLETE" : "EMPTY" };
  try { return { ok: true, out: JSON.parse(txt), usage: j.usage || null }; } catch (e) { return { ok: false, reason: "BAD_JSON" }; }
}
async function aiChat(key, model, sys, user, name, schema, ms) {
  const { status, j, err } = await aiPost("https://api.openai.com/v1/chat/completions", key, {
    model, temperature: 0.4, max_tokens: 1200, messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }
  }, ms);
  if (err) return { ok: false, reason: err };
  if (status !== 200) return { ok: false, reason: "OPENAI_" + status, detail: String((j.error && j.error.message) || "").slice(0, 200) };
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  if (!msg || msg.refusal) return { ok: false, reason: "REFUSED" };
  try { return { ok: true, out: JSON.parse(msg.content), usage: j.usage || null }; } catch (e) { return { ok: false, reason: "BAD_JSON" }; }
}
