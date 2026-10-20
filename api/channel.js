// /api/channel — 채널 발행용 '미국 증시 데일리 브리핑' 글 (JSON {text, asOf, ...})
//   아침 수집 데이터(Redis) + 네이버 뉴스 제목으로 만든다. CDN 30분 캐시. 운영자 페이지(채널 탭)가 보여준다.
import { redisConf, getJsonGzText, setJsonGz, redisCmd, KEY } from "./_redis.js";
import { composeDaily } from "./_compose.js";
import { loadTickerPairs } from "./_tickers.js";
import { reqIsOwner } from "./_owner.js";
import { collectAll, saveGurusFromUpload } from "./_disc.js";

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
  // v11.2.7 GitHub Actions가 받은 13F 올리기 — CRON_SECRET(Bearer)으로 확인 (운영자 토큰과 별개)
  if (req.query.op === "guruput") return guruPut(req, res);
  // 운영자 전용: 토큰이 없으면 내용 없이 거절 (CDN에도 남기지 않음)
  if (!reqIsOwner(req)) { res.setHeader("Cache-Control", "no-store"); return res.status(401).json({ ok: false, reason: "OWNER_ONLY" }); }
  if (req.query.op === "ai") return aiHandler(req, res);
  if (req.query.op === "disc") return discHandler(req, res);   // v11.2 공시·구루 수동 수집 (운영자) — 크론과 같은 수집기를 시간 넉넉히
  if (req.query.op === "lib") return libHandler(req, res);
  if (req.query.op === "archive") return archiveHandler(req, res);   // v12.5 분석 자산(아카이브) — AI 답변·앱 데이터 스냅샷을 서버(Redis)에 쌓아 다음 분석에 재사용   // v10.7 AI 보관함 (배경·스타일·구성·아이콘) — 서버(Redis) 저장   // v9.5 대표 카드 문구 (OpenAI) — 새 함수 파일을 만들 수 없어(무료 12개 한도) 여기에 붙임
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
  type: "object", additionalProperties: false, required: ["style", "hook", "kicker", "hero", "rows", "teaser"],
  properties: {
    style: { type: "string", enum: ["hero", "big", "list"], description: "hero=큰 숫자 하나+줄 3~4개(기본), big=큰 숫자 하나를 아주 크게+줄 1~2개, list=큰 숫자 없이 줄 목록 5~6개" },
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
  const key = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || "gpt-6.1-sol", fallback = process.env.OPENAI_FALLBACK || "gpt-4.1", max = +(process.env.AI_DAILY_MAX || 60), imgModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
  const rc = redisConf(), day = "sm:ai:" + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  if (req.method !== "POST") { let used = 0; try { if (rc) used = +(await redisCmd(rc, ["GET", day])) || 0; } catch (e) {} return res.status(200).json({ ok: true, ai: !!key, model, fallback, imgModel, used, max }); }
  if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  if (rc) { try { const n = await redisCmd(rc, ["INCR", day]); if (n === 1) await redisCmd(rc, ["EXPIRE", day, "172800"]); if (n > max) return res.status(200).json({ ok: false, reason: "DAILY_LIMIT", max }); } catch (e) {} }
  // v9.7 대표 카드: 기획(plan) · 이미지(image) · 글자 읽기(read)
  if (b.mode === "plan") return aiPlan(res, key, model, fallback, b);
  if (b.mode === "image") return aiImage(res, key, imgModel, b);
  if (b.mode === "read") return aiRead(res, key, model, fallback, b);
  if (b.mode === "deck") return aiDeckPlan(res, key, model, fallback, b);   // v11.6 AI 여러 장
  if (b.mode === "insight") return aiInsight(res, key, model, fallback, b);   // v11.7 리포트 서술
  let schema, user;
  // 참고 이미지(선택): data:image/... 최대 3장, 장당 1.5MB 이하 (화면에서 1024px JPEG로 줄여서 보냄)
  const imgs = (Array.isArray(b.images) ? b.images : []).filter((u) => typeof u === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(u) && u.length < 1600000).slice(0, 3);
  if (b.mode === "custom") {
    const text = String(b.text || "").slice(0, 6000);
    if (!text.trim()) return res.status(400).json({ ok: false, reason: "EMPTY" });
    schema = AI_SCHEMA_CUSTOM;
    user = "아래 글을 릴스용 한 장 카드로 정리해 줘. 숫자·날짜·금액·비율은 반드시 아래 글에 있는 표기 그대로만 쓰고, 계산하거나 새로 만들지 마. 글에 없는 내용은 넣지 마. " +
      "비교·조건·구간이 많으면 layout=table, 순서가 있으면 steps, 아니면 list. 쓰지 않는 쪽(points 또는 table)은 빈 배열로.\n" + (b.hint ? "주제 꼬리표: " + String(b.hint).slice(0, 100) + "\n" : "") + (b.ask || b.opinion ? "운영자 의견(어떤 카드로 만들지, 최우선 반영): " + String(b.ask || b.opinion).slice(0, 500) + "\n" : "") + (imgs.length ? "첨부한 참고 이미지의 구성·강조 방식·말투를 참고해. 이미지 속 숫자나 내용은 쓰지 마.\n" : "") + "---\n" + text;
  } else {
    const facts = (Array.isArray(b.facts) ? b.facts : []).slice(0, 40).map((f) => ({ id: String(f.id).slice(0, 6), label: String(f.label).slice(0, 60), value: String(f.value).slice(0, 40) }));
    if (!facts.length) return res.status(400).json({ ok: false, reason: "NO_FACTS" });
    schema = AI_SCHEMA_ITEM;
    user = "주제: " + String(b.title || "").slice(0, 60) + " / 상세 게시물 장수: {n}장\n사실 목록(이 값만 사용, 숫자는 직접 쓰지 말고 {id}로 부를 것):\n" +
      facts.map((f) => f.id + " | " + f.label + " | " + f.value).join("\n") +
      "\n\n가장 궁금증을 만드는 사실 하나를 hero로, 흐름이 이어지게 rows 3~4개를 골라(list면 5개). hook은 초보가 이미 하는 질문이나 반전으로 시작. label은 그 값이 무엇인지 바로 알게." +
      (b.opinion ? "\n\n운영자 의견(최우선으로 반영, 단 숫자 규칙은 지킬 것): " + String(b.opinion).slice(0, 500) : "") +
      (imgs.length ? "\n\n첨부한 참고 이미지의 구성·강조 방식·말투를 참고해서 style과 문구를 골라. 이미지 속 숫자나 내용은 쓰지 마." : "");
  }
  const name = b.mode === "custom" ? "custom_card" : "item_card", tries = [];
  // ① 기본 모델(gpt-6.1-sol): Responses API · 추론 low · JSON 스키마 강제 (temperature는 이 모델에서 받지 않음)
  let r1 = await aiResponses(key, model, AI_RULES, user, name, schema, 40000, imgs);
  tries.push(model + ": " + (r1.ok ? "성공" : r1.reason));
  if (r1.ok) return res.status(200).json({ ok: true, out: r1.out, model, usage: r1.usage, tries });
  // ② 계정에서 못 쓰거나 실패하면 gpt-4.1(Chat Completions)로 한 번 더
  if (fallback && fallback !== model && r1.reason !== "REFUSED") {
    const r2 = await aiChat(key, fallback, AI_RULES, user, name, schema, 18000, imgs);
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
async function aiResponses(key, model, sys, user, name, schema, ms, imgs) {
  const { status, j, err } = await aiPost("https://api.openai.com/v1/responses", key, {
    model, reasoning: { effort: "low" }, max_output_tokens: 6000,
    input: [{ role: "system", content: sys }, { role: "user", content: imgs && imgs.length ? [{ type: "input_text", text: user }].concat(imgs.map((u) => ({ type: "input_image", image_url: u }))) : user }],
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
async function aiChat(key, model, sys, user, name, schema, ms, imgs) {
  const { status, j, err } = await aiPost("https://api.openai.com/v1/chat/completions", key, {
    model, temperature: 0.4, max_tokens: name === "deck_cards" ? 6000 : name === "insight" ? 3500 : 1200, messages: [{ role: "system", content: sys }, { role: "user", content: imgs && imgs.length ? [{ type: "text", text: user }].concat(imgs.map((u) => ({ type: "image_url", image_url: { url: u } }))) : user }],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }
  }, ms);
  if (err) return { ok: false, reason: err };
  if (status !== 200) return { ok: false, reason: "OPENAI_" + status, detail: String((j.error && j.error.message) || "").slice(0, 200) };
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  if (!msg || msg.refusal) return { ok: false, reason: "REFUSED" };
  try { return { ok: true, out: JSON.parse(msg.content), usage: j.usage || null }; } catch (e) { return { ok: false, reason: "BAD_JSON" }; }
}

/* ---------- v9.7 기획: 카드 묶음의 '모든 내용'(F1…Fn 줄)을 읽고 한 장 기획 ---------- */
const AI_SCHEMA_PLAN = {
  type: "object", additionalProperties: false, required: ["kicker", "title", "subtitle", "layout", "hero", "items", "cta", "visual"],
  properties: {
    kicker: { type: "string", description: "말머리 14자 이하" },
    title: { type: "string", description: "제목 2줄 이하(\\n). 3초 안에 무슨 내용인지 + 궁금증. 숫자는 근거 줄에 있는 표기 그대로만" },
    subtitle: { type: "string", description: "부제 한 줄 30자 이하. 기준일·범위 등" },
    layout: { type: "string", enum: ["rank", "hero", "list"], description: "rank=순위/단계 카드 3~5개, hero=큰 숫자 하나+항목 3~4개, list=항목 5~6개" },
    hero: { type: "object", additionalProperties: false, required: ["label", "value", "ref"], properties: { label: { type: "string" }, value: { type: "string" }, ref: { type: "string" } }, description: "layout=hero일 때만. 아니면 모두 빈 문자열" },
    items: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "value", "sub", "ref"], properties: {
      label: { type: "string", description: "항목 이름 14자 이하" }, value: { type: "string", description: "근거 줄(ref)에 있는 값을 표기 그대로 복사. 계산·반올림·단위 변경 금지" }, sub: { type: "string", description: "보조 설명 18자 이하, 숫자는 근거 줄 표기 그대로만" }, ref: { type: "string", description: "근거 줄 id (예: F12)" } } } },
    cta: { type: "string", description: "게시물로 유도하는 한 줄 24자 이하" },
    visual: { type: "string", description: "배경 이미지 묘사(영어). 주제에 맞는 장면·분위기·색. 글자·숫자·로고 없이" }
  }
};
async function aiPlan(res, key, model, fallback, b) {
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 600).map((l) => String(l.id).slice(0, 6) + " | " + String(l.text).slice(0, 220));
  let txt = lines.join("\n"); if (txt.length > 40000) txt = txt.slice(0, 40000);
  if (!txt) return res.status(400).json({ ok: false, reason: "NO_LINES" });
  const imgs = (Array.isArray(b.images) ? b.images : []).filter((u) => typeof u === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(u) && u.length < 1600000).slice(0, 3);
  const user = "주제: " + String(b.title || "").slice(0, 80) + (b.deck ? "\n게시물(상세 카드) 구성: " + String(b.deck).slice(0, 300) : "") +
    "\n\n아래는 게시물 카드들에 들어 있는 '모든 내용'이야(줄마다 id). 전체를 다 읽고, 초보 투자자가 3초 안에 흐름을 이해하고 궁금해서 게시물로 넘어갈 핵심만 골라 릴스 한 장으로 기획해." +
    "\n규칙: 모든 숫자·날짜·이름은 근거 줄 표기 그대로 복사(계산·반올림·단위 변경 금지). item.value는 ref 줄 안에 그대로 있어야 함. 근거 없는 내용 금지. 추천·예측 금지." +
    (b.request ? "\n\n운영자 요청(최우선): " + String(b.request).slice(0, 600) : "") +
    (imgs.length ? "\n\n첨부 이미지는 원하는 카드의 구성·분위기 참고용이야. visual과 layout에 반영하되 이미지 속 숫자·내용은 쓰지 마." : "") +
    "\n\n---\n" + txt;
  const tries = [];
  let r = await aiResponses(key, model, AI_RULES, user, "plan_card", AI_SCHEMA_PLAN, 120000, imgs);
  tries.push(model + ": " + (r.ok ? "성공" : r.reason));
  if (!r.ok && fallback && fallback !== model && r.reason !== "REFUSED") { r = await aiChat(key, fallback, AI_RULES, user, "plan_card", AI_SCHEMA_PLAN, 60000, imgs); tries.push(fallback + ": " + (r.ok ? "성공" : r.reason)); if (r.ok) return res.status(200).json({ ok: true, out: r.out, model: fallback, tries }); }
  if (r.ok) return res.status(200).json({ ok: true, out: r.out, model, tries });
  return res.status(200).json({ ok: false, reason: r.reason, detail: r.detail, tries });
}
/* ---------- v11.6 AI 여러 장: 묶음의 '모든 내용'을 읽고 5~8장 상세 카드로 풀어 쓰기 (숫자는 근거 줄 표기 그대로 · 앱이 그림) ---------- */
const AI_SCHEMA_DECK = {
  type: "object", additionalProperties: false, required: ["cards", "question"],
  properties: {
    question: { type: "string", description: "마지막 장 질문 한 줄 30자 이하 (자기 노출 강요 없이)" },
    cards: { type: "array", minItems: 4, maxItems: 9, items: { type: "object", additionalProperties: false, required: ["kicker", "title", "lead", "sub", "rows", "takeaway"], properties: {
      kicker: { type: "string", description: "말머리 12자 이하" },
      title: { type: "string", description: "결론 문장 1~2줄(\n), 줄당 18자 이하. 숫자는 근거 줄 표기 그대로, 강조할 숫자는 [[ ]]로" },
      lead: { type: "string", description: "초보용 풀이 한두 문장 60자 이하. 숫자는 근거 줄 표기 그대로만" },
      sub: { type: "string", description: "근거 설명 한 줄 40자 이하 (기준·기간·단위)" },
      rows: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["label", "value", "ref", "tag", "note"], properties: {
        label: { type: "string", description: "항목 이름 16자 이하" }, value: { type: "string", description: "ref 줄 안에 있는 숫자 표기를 그대로 복사(계산·반올림·단위 변경 금지)" }, ref: { type: "string", description: "근거 줄 id (F12 등)" }, tag: { type: "string", description: "왼쪽 작은 꼬리표 8자 이하(예: 1위, 2023년). 없으면 빈 문자열" }, note: { type: "string", description: "보조 설명 24자 이하, 숫자는 근거 표기 그대로. 없으면 빈 문자열" } } } },
      takeaway: { type: "string", description: "그 장의 한 줄 정리 26자 이하. 추천·예측 금지" } } } }
  }
};
async function aiDeckPlan(res, key, model, fallback, b) {
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 600).map((l) => String(l.id).slice(0, 6) + " | " + String(l.text).slice(0, 220));
  let txt = lines.join("\n"); if (txt.length > 40000) txt = txt.slice(0, 40000);
  if (!txt) return res.status(400).json({ ok: false, reason: "NO_LINES" });
  const n = Math.max(4, Math.min(9, +b.n || 6));
  const user = "주제: " + String(b.title || "").slice(0, 80) + " / 카드 " + n + "장(첫 장은 표지: title=훅, lead=무엇을 다루는지, rows는 빈 배열)" +
    "\n\n아래는 앱이 만든 카드들의 '모든 내용'이야(줄마다 id). 전체를 읽고 초보 투자자가 처음부터 끝까지 이해할 수 있게 " + n + "장으로 풀어서 다시 구성해. " +
    "장마다 하나의 질문에 답하고(무엇이 · 얼마나 · 왜 중요한가 · 그래서 무엇을 볼까), 각 장의 rows는 근거 숫자 3~8개로 빈칸 없이 채워." +
    "\n규칙: 모든 숫자·날짜·이름은 근거 줄 표기 그대로 복사(계산·반올림·단위 변경 금지). row.value는 ref 줄 안에 그대로 있어야 함. 근거 없는 내용 금지. 종목 추천·매수매도 권유·가격 예측 금지." +
    (b.request ? "\n\n운영자 요청(최우선): " + String(b.request).slice(0, 600) : "") + "\n\n---\n" + txt;
  const tries = [];
  let r = await aiResponses(key, model, AI_RULES, user, "deck_cards", AI_SCHEMA_DECK, 150000, []);
  tries.push(model + ": " + (r.ok ? "성공" : r.reason));
  if (!r.ok && fallback && fallback !== model && r.reason !== "REFUSED") { r = await aiChat(key, fallback, AI_RULES, user, "deck_cards", AI_SCHEMA_DECK, 80000, []); tries.push(fallback + ": " + (r.ok ? "성공" : r.reason)); if (r.ok) return res.status(200).json({ ok: true, out: r.out, model: fallback, tries }); }
  if (r.ok) return res.status(200).json({ ok: true, out: r.out, model, tries });
  return res.status(200).json({ ok: false, reason: r.reason, detail: r.detail, tries });
}
/* ---------- v11.7 리포트: 증거(Exhibit)를 읽고 애널리스트처럼 상황·해석·의견·시나리오·행동·조건을 쓴다 (숫자는 근거 줄 표기 그대로) ---------- */
const AI_SCHEMA_INSIGHT = {
  type: "object", additionalProperties: false, required: ["headline", "situation", "narrative", "interpretation", "opinion", "forecast", "plan", "watch"],
  properties: {
    narrative: { type: "string", description: "종합 해석 글 4~5문단(문단 사이 빈 줄). 순서: 한 줄로 → 숫자가 말하는 것 → 숫자 뒤의 속사정(기사·전문가 의견, 언론사 이름 붙여) → 양쪽 의견을 겹쳐 보면 → 그래서(단기·장기·행동·바꿀 조건). 700자 이하. 숫자는 근거 줄 표기 그대로. 초보가 끝까지 읽게 쉬운 문장으로" },
    headline: { type: "string", description: "리포트 제목 한 줄 24자 이하 — 질문형 또는 결론형" },
    situation: { type: "string", description: "지금 상황 2~3문장 120자 이하. 숫자는 근거 줄 표기 그대로" },
    interpretation: { type: "array", maxItems: 6, items: { type: "string" }, description: "Exhibit마다 한 줄 해석 60자 이하 — 그 숫자가 무슨 뜻인지, 초보가 이해하게" },
    opinion: { type: "string", description: "내 생각 3~4문장 200자 이하. 규칙 의견(stance)과 같은 방향으로, 단정하되 근거를 붙여. 추천 단어 대신 '검토·관망·나눠서' 같은 행동 표현" },
    forecast: { type: "object", additionalProperties: false, required: ["회복", "횡보", "추가 하락"], properties: { "회복": { type: "string" }, "횡보": { type: "string" }, "추가 하락": { type: "string" } }, description: "시나리오별 어떤 조건에서 그렇게 되는지 각 50자 이하. 확률 숫자는 쓰지 말 것(앱이 붙임)" },
    plan: { type: "array", maxItems: 4, items: { type: "string" }, description: "행동안 3~4개, 각 40자 이하. 금액 비중·분할·기준이 들어가게" },
    watch: { type: "array", maxItems: 4, items: { type: "string" }, description: "생각을 바꿀 조건 3~4개, 각 36자 이하" }
  }
};
async function aiInsight(res, key, model, fallback, b) {
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 300).map((l) => String(l.id).slice(0, 6) + " | " + String(l.text).slice(0, 240));
  let txt = lines.join("\n"); if (txt.length > 30000) txt = txt.slice(0, 30000);
  if (!txt) return res.status(400).json({ ok: false, reason: "NO_LINES" });
  const sys = "너는 한국 개인투자자 대상 리서치 노트를 쓰는 애널리스트다. 독자는 주식 초보. 문장은 짧고 단정하게, 해요체. " +
    "증거(Exhibit)의 숫자만 쓰고 계산·반올림·새 숫자 생성 금지. 종목을 사라/팔라고 직접 권하지 말고 '검토 구간·관망·나눠서' 같은 행동 표현을 쓴다. 과장·확정 금지('반드시', '확실' 금지). 시나리오는 조건부로 쓴다.";
  const user = "질문: " + String(b.title || "").slice(0, 80) + "\n규칙 기반 의견(이 방향을 따르되 더 설득력 있게): " + String(b.stance || "").slice(0, 40) + (b.draft ? "\n\n규칙으로 쓴 초안(구조는 유지, 문장을 사람이 읽기 좋게 다시 써):\n" + String(b.draft).slice(0, 2500) : "") + "\n\n증거 줄(id | 내용):\n" + txt;
  const tries = [];
  let r = await aiResponses(key, model, sys, user, "insight", AI_SCHEMA_INSIGHT, 120000, []);
  tries.push(model + ": " + (r.ok ? "성공" : r.reason));
  if (!r.ok && fallback && fallback !== model && r.reason !== "REFUSED") { r = await aiChat(key, fallback, sys, user, "insight", AI_SCHEMA_INSIGHT, 60000, []); tries.push(fallback + ": " + (r.ok ? "성공" : r.reason)); if (r.ok) return res.status(200).json({ ok: true, out: r.out, model: fallback, tries }); }
  if (r.ok) return res.status(200).json({ ok: true, out: r.out, model, tries });
  return res.status(200).json({ ok: false, reason: r.reason, detail: r.detail, tries });
}
/* ---------- v9.7 이미지: 배경만(글자 없이) 또는 전부(정해진 글자만 그대로) ---------- */
async function aiImage(res, key, imgModel, b) {
  const p = b.plan || {}, visual = String(p.visual || "").slice(0, 600);
  const isIcon = b.scope === "icon", size = isIcon ? "1024x1024" : "1024x1536";
  const asp = b.aspect === "4:5" ? "4:5" : "9:16";   // v12.22 앱이 2:3 이미지를 이 비율로 가운데 기준 잘라 쓴다
  const safe = asp === "4:5" ? "The final image will be center-cropped to 4:5 (top and bottom ~9% each are cut): keep ALL text and key elements inside the central 80% of the height." : "The final image will be center-cropped to 9:16 (left and right ~8% each are cut): keep ALL text and key elements inside the central 84% of the width, and away from the top 14% and bottom 19% (Instagram UI).";
  const base = "Vertical poster for Instagram (" + (asp === "4:5" ? "feed post 4:5" : "Reel 9:16") + ") by a Korean investing education channel 'uphill.lab'. " + safe + " Premium, modern, high contrast. Brand palette: deep black/navy with warm gold accents. " + (visual ? "Scene/mood: " + visual + ". " : "");
  let prompt;
  if (isIcon) prompt = "One single flat minimal icon of: " + String(b.subject || p.title || "chart going up").slice(0, 120) + ". Brand 'uphill.lab': use ONLY deep black (#14161c) and warm gold (#e6c57a), on a plain solid ivory (#fbf8f1) background. Centered, bold rounded geometric shapes, consistent 2px-style outline weight, generous padding. ABSOLUTELY NO text, letters, numbers, shadows, gradients, frames or watermarks.";
  else if (b.scope === "bg") prompt = base + "This is ONLY a background: keep the center and lower 70% calm and darker so white text can be overlaid later. ABSOLUTELY NO text, letters, numbers, signs, logos, UI, charts with labels or watermarks anywhere.";
  else {
    const L = [];
    if (p.kicker) L.push("Small pill label at top: \"" + p.kicker + "\"");
    if (p.title) L.push("Big bold headline (Korean): \"" + String(p.title).replace(/\n/g, " / ") + "\"");
    if (p.subtitle) L.push("Subheadline: \"" + p.subtitle + "\"");
    if (p.hero && p.hero.value) L.push("Huge emphasized figure: \"" + p.hero.value + "\" with label \"" + p.hero.label + "\"");
    (p.items || []).forEach((it, i) => L.push("Row " + (i + 1) + ": label \"" + it.label + "\", value badge \"" + it.value + "\"" + (it.sub ? ", small note \"" + it.sub + "\"" : "")));
    if (p.cta) L.push("Bottom button-style call to action: \"" + p.cta + "\"");
    L.push("Tiny footer: \"@uphill.lab\"");
    prompt = base + "Design the full infographic card with clean Korean typography (Pretendard-like sans-serif), large readable text, generous margins, keep top and bottom 8% free. Render EXACTLY these texts, spelled exactly as given, and NO other text or numbers:\n" + L.join("\n");
  }
  const models = [imgModel, "gpt-image-2", "gpt-image-1"].filter((m, i, a) => m && a.indexOf(m) === i), tries = [];
  for (const m of models) {
    for (const body of [{ model: m, prompt, size, n: 1, quality: process.env.OPENAI_IMAGE_QUALITY || "medium", output_format: "jpeg", output_compression: 88 }, { model: m, prompt, size, n: 1 }]) {
      const { status, j, err } = await aiPost("https://api.openai.com/v1/images/generations", key, body, 240000);
      if (err) { tries.push(m + ": " + err); break; }
      const d = j.data && j.data[0];
      if (status === 200 && d && (d.b64_json || d.url)) {
        let b64 = d.b64_json, mime = body.output_format === "jpeg" ? "image/jpeg" : "image/png";
        if (!b64 && d.url) { try { const rr = await fetch(d.url); b64 = Buffer.from(await rr.arrayBuffer()).toString("base64"); mime = rr.headers.get("content-type") || mime; } catch (e) { tries.push(m + ": URL 받기 실패"); continue; } }
        tries.push(m + ": 성공");
        return res.status(200).json({ ok: true, image: "data:" + mime + ";base64," + b64, model: m, tries, prompt });
      }
      const msg = String((j.error && j.error.message) || "").slice(0, 160);
      tries.push(m + ": OPENAI_" + status + (msg ? " " + msg : ""));
      if (status === 400 && /output_format|output_compression|quality|parameter/i.test(msg)) continue;   // 옵션을 빼고 같은 모델로 한 번 더
      break;
    }
  }
  return res.status(200).json({ ok: false, reason: "IMAGE_FAIL", tries });
}
/* ---------- v9.7 글자 읽기: 만들어진 이미지에서 글자를 그대로 읽어 대조 ---------- */
const AI_SCHEMA_READ = { type: "object", additionalProperties: false, required: ["lines"], properties: { lines: { type: "array", items: { type: "string" } } } };
async function aiRead(res, key, model, fallback, b) {
  const u = String(b.image || ""); if (!/^data:image\//.test(u)) return res.status(400).json({ ok: false, reason: "NO_IMAGE" });
  const user = "이미지에 보이는 모든 글자를 위에서 아래, 왼쪽에서 오른쪽 순서로 한 줄씩 보이는 그대로 옮겨 적어. 숫자·기호·띄어쓰기를 고치지 말고, 없는 글자를 추측해 넣지 마.";
  let r = await aiResponses(key, model, "너는 정확한 OCR 도구다.", user, "read_text", AI_SCHEMA_READ, 60000, [u]);
  if (!r.ok && fallback && fallback !== model) r = await aiChat(key, fallback, "너는 정확한 OCR 도구다.", user, "read_text", AI_SCHEMA_READ, 40000, [u]);
  if (!r.ok) return res.status(200).json({ ok: false, reason: r.reason });
  return res.status(200).json({ ok: true, lines: r.out.lines || [] });
}


/* ---------- v10.7 AI 보관함: 배경 · 스타일 · 구성 프리셋 · 아이콘 ----------
   sm:lib:idx      목록(gzip JSON) [{id, kind, name, tags:{ctx,k,tpl,mk,words}, at, size, fav, uses, def}]
   sm:lib:img:<id> 이미지 data URL (JPEG/PNG, 클라이언트가 줄여서 보냄 · 최대 900KB)
   sm:lib:dat:<id> 구성·설명 JSON (최대 20KB)
   한도: 즐겨찾기 아닌 항목 LIB_MAX(기본 300)개 · 이미지 합계 LIB_MB(기본 120MB) — 넘으면 오래되고 덜 쓴 것부터 지운다 */
/* ---------- v12.5 분석 자산(아카이브): 인덱스(요약) + 기록 본문. 운영자 전용 · gz 저장 · 최대 ARC_MAX건 ---------- */
const ARC = { idx: "sm:arc:idx", rec: "sm:arc:rec:" };
async function arcIdx(rc) { const t = await getJsonGzText(rc, ARC.idx); try { return t ? JSON.parse(t) : []; } catch (e) { return []; } }
async function arcPut(rc, arr) { await setJsonGz(rc, ARC.idx, arr); }
function arcSlim(r) {   // 인덱스에 두는 요약 (목록·검증·프롬프트 문맥용) — 본문(text)은 따로
  const p = r.p || {};
  return { id: r.id, at: r.at, kind: String(r.kind || "analyst").slice(0, 12), mod: String(r.mod || "").slice(0, 12), modName: String(r.modName || "").slice(0, 20), sym: r.sym ? String(r.sym).slice(0, 20) : null, name: String(r.name || "").slice(0, 40), scope: String(r.scope || "").slice(0, 10), title: String(r.title || "").slice(0, 80),
    p: { one: String(p.one || "").slice(0, 120), verdictSt: String(p.verdictSt || "").slice(0, 4), verdict: String(p.verdict || "").slice(0, 300), change: String(p.change || "").slice(0, 120), items: (Array.isArray(p.items) ? p.items : []).slice(0, 8).map((x) => ({ name: String(x.name || "").slice(0, 30), st: String(x.st || "").slice(0, 4), key: String(x.key || "").slice(0, 80), num: String(x.num || "").slice(0, 80) })), risks: (p.risks || []).slice(0, 4).map((x) => String(x).slice(0, 60)), watch: (p.watch || []).slice(0, 4).map((x) => String(x).slice(0, 60)) },
    snap: r.snap ? { price: typeof r.snap.price === "number" ? r.snap.price : null, key: r.snap.key && typeof r.snap.key === "object" ? Object.fromEntries(Object.entries(r.snap.key).slice(0, 24).map(([k, v]) => [String(k).slice(0, 24), typeof v === "number" ? v : String(v).slice(0, 40)])) : {}, rows: (Array.isArray(r.snap.rows) ? r.snap.rows : []).slice(0, 40).map((x) => [String(x[0] || "").slice(0, 40), String(x[1] || "").slice(0, 60)]) } : null,
    tags: (Array.isArray(r.tags) ? r.tags : []).slice(0, 8).map((x) => String(x).slice(0, 20)), note: String(r.note || "").slice(0, 200), size: (r.text ? String(r.text).length : 0) };
}
async function archiveHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const rc = redisConf(); if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  try {
    if (req.method !== "POST") {
      if (req.query.id) { const id = String(req.query.id).replace(/[^\w-]/g, "").slice(0, 40); const t = await redisCmd(rc, ["GET", ARC.rec + id]); return res.status(200).json({ ok: true, id, text: t || "" }); }
      const idx = await arcIdx(rc); return res.status(200).json({ ok: true, items: idx, total: idx.length });
    }
    let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
    let idx = await arcIdx(rc); const max = +(process.env.ARC_MAX || 500);
    if (b.act === "save" || b.act === "import") {
      const recs = b.act === "import" ? (Array.isArray(b.items) ? b.items : []).slice(0, 200) : [b.rec || {}]; const saved = [];
      for (const r of recs) {
        if (!r || typeof r !== "object") continue;
        const id = (r.id && /^[\w-]{4,40}$/.test(String(r.id)) ? String(r.id) : Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
        const text = String(r.text || "").slice(0, 40000); if (!text.trim()) continue;
        const e = arcSlim(Object.assign({}, r, { id, at: typeof r.at === "number" ? r.at : Date.now() }));
        await redisCmd(rc, ["SET", ARC.rec + id, text]);
        idx = idx.filter((x) => x.id !== id); idx.unshift(e); saved.push(e);
      }
      idx.sort((a, b2) => b2.at - a.at);
      const removed = []; while (idx.length > max) { const r = idx.pop(); removed.push(r.id); }
      for (const r of removed) { await redisCmd(rc, ["DEL", ARC.rec + r]); }
      await arcPut(rc, idx);
      return res.status(200).json({ ok: true, items: saved, item: saved[0] || null, total: idx.length, removed: removed.length });
    }
    const id = String(b.id || "").replace(/[^\w-]/g, "").slice(0, 40), e = idx.find((x) => x.id === id);
    if (!e) return res.status(404).json({ ok: false, reason: "NOT_FOUND" });
    if (b.act === "del") { idx = idx.filter((x) => x.id !== id); await redisCmd(rc, ["DEL", ARC.rec + id]); await arcPut(rc, idx); return res.status(200).json({ ok: true, total: idx.length }); }
    if (b.act === "upd") { if (typeof b.note === "string") e.note = b.note.slice(0, 200); if (Array.isArray(b.tags)) e.tags = b.tags.slice(0, 8).map((x) => String(x).slice(0, 20)); if (b.p && typeof b.p === "object") e.p = arcSlim({ p: b.p }).p; await arcPut(rc, idx); return res.status(200).json({ ok: true, item: e }); }
    return res.status(400).json({ ok: false, reason: "BAD_ACT" });
  } catch (e) { return res.status(200).json({ ok: false, reason: "ERR", detail: String(e && e.message || e).slice(0, 200) }); }
}
const LIB = { idx: "sm:lib:idx", img: "sm:lib:img:", dat: "sm:lib:dat:" };
async function libIdx(rc) { const t = await getJsonGzText(rc, LIB.idx); try { return t ? JSON.parse(t) : []; } catch (e) { return []; } }
async function libPut(rc, arr) { await setJsonGz(rc, LIB.idx, arr); }
async function libHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const rc = redisConf(); if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  try {
    if (req.method !== "POST") {
      if (req.query.id) {
        const id = String(req.query.id).replace(/[^\w-]/g, "").slice(0, 40);
        const [img, dat] = await Promise.all([redisCmd(rc, ["GET", LIB.img + id]), redisCmd(rc, ["GET", LIB.dat + id])]);
        let data = null; try { data = dat ? JSON.parse(dat) : null; } catch (e) {}
        return res.status(200).json({ ok: true, id, img: img || null, data });
      }
      const idx = await libIdx(rc);
      return res.status(200).json({ ok: true, items: idx, total: idx.length, bytes: idx.reduce((a, x) => a + (x.size || 0), 0) });
    }
    let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
    let idx = await libIdx(rc);
    if (b.act === "save") {
      const kind = ["bg", "style", "preset", "icon", "card"].indexOf(b.kind) >= 0 ? b.kind : null; if (!kind) return res.status(400).json({ ok: false, reason: "BAD_KIND" });
      const img = typeof b.img === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(b.img) ? b.img : null;
      if (img && img.length > 1200000) return res.status(400).json({ ok: false, reason: "TOO_BIG" });
      const data = b.data ? JSON.stringify(b.data).slice(0, 20000) : null;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const t = b.tags || {}, tags = { ctx: String(t.ctx || "").slice(0, 60), k: String(t.k || "").slice(0, 20), tpl: String(t.tpl || "").slice(0, 20), mk: String(t.mk || "").slice(0, 10), words: (Array.isArray(t.words) ? t.words : []).slice(0, 12).map((w) => String(w).slice(0, 20)) };
      const e = { id, kind, name: String(b.name || "").slice(0, 60) || kind, tags, at: Date.now(), size: (img ? img.length : 0) + (data ? data.length : 0), fav: false, uses: 0, thumb: typeof b.thumb === "string" && b.thumb.length < 40000 && /^data:image\//.test(b.thumb) ? b.thumb : null };
      if (img) await redisCmd(rc, ["SET", LIB.img + id, img]);
      if (data) await redisCmd(rc, ["SET", LIB.dat + id, data]);
      idx.unshift(e);
      // 정리: 즐겨찾기·기본 아이콘은 지키고, 오래되고 덜 쓴 것부터
      const max = +(process.env.LIB_MAX || 300), maxB = (+(process.env.LIB_MB || 120)) * 1e6;
      const keep = (x) => x.fav || x.def;
      let total = idx.reduce((a, x) => a + (x.size || 0), 0), removed = [];
      const cand = idx.filter((x) => !keep(x) && x.id !== id).sort((a, b2) => (a.uses - b2.uses) || (a.at - b2.at));
      while ((idx.filter((x) => !keep(x)).length > max || total > maxB) && cand.length) { const r = cand.shift(); idx = idx.filter((x) => x.id !== r.id); total -= r.size || 0; removed.push(r.id); }
      for (const r of removed) { await redisCmd(rc, ["DEL", LIB.img + r, LIB.dat + r]); }
      await libPut(rc, idx);
      return res.status(200).json({ ok: true, item: e, removed: removed.length });
    }
    const id = String(b.id || "").replace(/[^\w-]/g, "").slice(0, 40), e = idx.find((x) => x.id === id);
    if (!e) return res.status(404).json({ ok: false, reason: "NOT_FOUND" });
    if (b.act === "del") { idx = idx.filter((x) => x.id !== id); await redisCmd(rc, ["DEL", LIB.img + id, LIB.dat + id]); await libPut(rc, idx); return res.status(200).json({ ok: true }); }
    if (b.act === "upd") {
      if (typeof b.name === "string") e.name = b.name.slice(0, 60);
      if (typeof b.fav === "boolean") e.fav = b.fav;
      if (typeof b.def === "boolean") { if (b.def) idx.forEach((x) => { if (x.kind === e.kind && x.tags.tpl === e.tags.tpl) x.def = false; }); e.def = b.def; }   // 양식별 기본(아이콘)은 하나만
      await libPut(rc, idx); return res.status(200).json({ ok: true, item: e });
    }
    if (b.act === "use") { e.uses = (e.uses || 0) + 1; e.last = Date.now(); await libPut(rc, idx); return res.status(200).json({ ok: true }); }
    return res.status(400).json({ ok: false, reason: "BAD_ACT" });
  } catch (err) { return res.status(200).json({ ok: false, reason: "ERROR", detail: String(err.message || err).slice(0, 200) }); }
}

/* v11.2 공시·구루 수동 수집: /api/channel?op=disc&run=1[&days=30]
   처음 한 번(지난 30일·투자자 전원) 또는 크론이 시간이 모자랐던 날 쓴다. 결과는 /api/snap?disc=1 · ?guru=1 로 공개 */
async function discHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.query.run !== "1") return res.status(400).json({ ok: false, reason: "run=1 필요" });
  const redis = redisConf(); if (!redis) return res.status(500).json({ ok: false, reason: "NO_REDIS" });
  const proto = req.headers["x-forwarded-proto"] || "https", origin = proto + "://" + req.headers.host;
  let pairs = []; try { pairs = (await loadTickerPairs(origin)).pairs; } catch (e) {}
  const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 30));
  // v11.2.2 한 번에 다 하지 않고 나눠서: part=dart|sec, 한 호출 약 45초 — 화면 버튼이 끝날 때까지 반복해서 부른다 (어디까지 했는지는 서버가 기억)
  const part = ["sec", "dart", "ipo", "macro"].indexOf(req.query.part) >= 0 ? req.query.part : "both";
  const ipoDays = Math.max(30, Math.min(1095, parseInt(req.query.ipodays, 10) || 730));   // v11.3 공모주 첫 수집: 지난 2년 (백테스트용)
  const out = await collectAll(redis, { pairs, part, manual: true, dartMs: 45000, secMs: 45000, ipoMs: 45000, macroMs: 45000, force: req.query.force === "1", ipoDays, maxUpdates: 4, backfillDays: days });
  return res.status(200).json({ ok: true, ...out });
}

/* v11.2.7 SEC는 Vercel 서버를 막는다 → GitHub Actions(scripts/sec13f.mjs)가 받아서 여기로 올린다
   POST /api/channel?op=guruput  · Authorization: Bearer <CRON_SECRET> · 본문 = { gurus:[...], log } */
async function guruPut(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const sec = process.env.CRON_SECRET || "";
  if (!sec || (req.headers.authorization || "") !== "Bearer " + sec) return res.status(401).json({ ok: false, reason: "unauthorized" });
  const redis = redisConf(); if (!redis) return res.status(500).json({ ok: false, reason: "NO_REDIS" });
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || !Array.isArray(body.gurus)) return res.status(400).json({ ok: false, reason: "gurus 배열 필요" });
  try { return res.status(200).json(await saveGurusFromUpload(redis, body)); }
  catch (e) { return res.status(500).json({ ok: false, reason: String(e.message).slice(0, 160) }); }
}
