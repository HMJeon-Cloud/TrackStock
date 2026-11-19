// 구루 해석 (v14.60) — 서버 공용 모듈 (파일 이름이 _로 시작해 Vercel 함수 개수에 들어가지 않는다)
//   /api/channel?op=guru (운영자) 로 들어온다. 새 함수 · 새 크론 없음.
//   ① 발언 조사(guruN): 13F에 없는 것 — 인터뷰 · 서한 · 보도에 나온 견해와 포지션(공매도 · 선물 · 채권 등)을 Claude가 웹에서 찾는다
//   ② 직접 메모: 운영자가 본 내용을 적어 둔다(예: "구리 숏")
//   ③ AI 해석(guruA): 인물 정보 + 13F 숫자 + 발언 + 메모를 묶어 '왜 이렇게 움직였나 · 우리는 무엇을 얻나'
//   저장: sm:guruai (gzip) { updated, notes:{id}, ai:{id} } — /api/snap?guruai=1 로 공개(읽기 전용)
import { redisConf, redisCmd, setJsonGz, getJsonGzText } from "./_redis.js";
import { runClaude, taskSystem } from "./_claude.js";
import { GURUS, DISC_KEY } from "./_disc.js";

const KEY_AI = "sm:guruai";
const S = (v, n) => { const t = String(v == null ? "" : v).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };   // 잘릴 때는 … 를 붙여 잘린 것을 알 수 있게
const arr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
async function readDoc(rc, key) { try { const t = await getJsonGzText(rc, key); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const usd = (v) => { const a = Math.abs(+v || 0); return (v < 0 ? "-" : "") + (a >= 1e9 ? "$" + (a / 1e9).toFixed(1) + "B" : "$" + Math.round(a / 1e6) + "M"); };
const pc = (x, d) => (x == null || !isFinite(x) ? "-" : (x * 100).toFixed(d == null ? 1 : d) + "%");

/* 13F 숫자를 글로 — AI 해석의 재료. 계산은 앱이 한 것 그대로 */
export function guruFacts(g) {
  if (!g) return "";
  const nm = (m) => (m.t ? m.t + "(" + m.n + ")" : m.n), L = [];
  L.push("기준: " + g.period + " 분기 말 · 공개일 " + g.filed + (g.prevPeriod ? " · 비교 분기 " + g.prevPeriod : ""));
  L.push("13F 미국 주식 합계: " + usd(g.total) + (g.prevTotal ? " (지난 분기 " + usd(g.prevTotal) + ", " + (g.total / g.prevTotal - 1 >= 0 ? "+" : "") + pc(g.total / g.prevTotal - 1, 0) + " — 주가 변동 포함)" : "") + " · 종목 수 " + g.n + " · 신규 " + (g.nNew || 0) + " · 전량 매도 " + (g.nExit || 0));
  if (g.flow != null) L.push("순매매(주식 수 변화 × 분기 말 가격 ÷ 지난 분기 합계): " + (g.flow >= 0 ? "+" : "") + pc(g.flow) + " — 주가 변동을 뺀 실제 사고판 방향");
  if (g.conc) L.push("집중도: 1위 " + pc(g.conc.t1) + " · 상위 5 " + pc(g.conc.t5) + " · 상위 10 " + pc(g.conc.t10) + (g.turn != null ? " · 분기 회전율 " + pc(g.turn) : "") + (g.etfW != null ? " · ETF 비중 " + pc(g.etfW) : ""));
  L.push("[상위 보유 — 비중(지난 분기 비중) · 주식 수 변화]");
  arr(g.top, 12).forEach((x, i) => L.push((i + 1) + ". " + nm(x) + " " + pc(x.w) + (x.pw != null ? " (" + pc(x.pw) + ")" : "") + " · " + (x.chg === "new" ? "신규" : typeof x.chg === "number" && Math.abs(x.chg) >= 0.01 ? (x.chg > 0 ? "+" : "") + pc(x.chg, 0) : "유지")));
  const mv = (m) => nm(m) + " " + ({ new: "신규", add: "증액", trim: "축소", exit: "전량 매도" }[m.kind] || m.kind) + " " + usd(m.dv) + (m.pw != null || m.w != null ? " · 비중 " + pc(m.pw || 0) + " → " + pc(m.w || 0) : "");
  if (arr(g.buys, 12).length) { L.push("[산 종목 — 금액 큰 순]"); arr(g.buys, 10).forEach((m) => L.push("- " + mv(m))); }
  if (arr(g.sells, 12).length) { L.push("[판 종목 — 금액 큰 순]"); arr(g.sells, 10).forEach((m) => L.push("- " + mv(m))); }
  if (arr(g.opts, 8).length) { L.push("[옵션 — 금액은 기초자산 값(실제 건 돈 아님). 헤지인지 베팅인지 13F로는 알 수 없음] 풋 합계 " + usd((g.optSum || {}).put) + " · 콜 합계 " + usd((g.optSum || {}).call)); arr(g.opts, 6).forEach((o) => L.push("- " + nm(o) + " " + (o.pc === "put" ? "풋" : "콜") + " " + usd(o.v) + (o.isNew ? " (신규)" : o.chg != null ? " (" + (o.chg >= 0 ? "+" : "") + pc(o.chg, 0) + ")" : ""))); }
  if (arr(g.hist, 12).length > 1) { L.push("[분기별 흐름 — 합계 · 종목 수 · 상위 5 비중 · 상위 종목]"); arr(g.hist, 12).slice(-8).forEach((h) => L.push("- " + h.p + " · " + usd(h.total) + " · " + h.n + "종목 · " + pc(h.t5, 0) + " · " + arr(h.top, 5).map((x) => (x.t || x.n) + " " + pc(x.w, 0)).join(", "))); }
  return L.join("\n");
}
function cleanNote(d) {
  const kinds = ["발언", "서한", "보도", "공시"];
  const views = arr(d && d.views, 10).map((v) => ({ date: S(v && v.date, 10), kind: kinds.includes(v && v.kind) ? v.kind : "보도", say: S(v && v.say, 500), pos: S(v && v.pos, 160), src: S(v && v.src, 120), url: /^https?:\/\//.test(String((v && v.url) || "")) ? String(v.url).slice(0, 300) : "" })).filter((v) => v.say && v.src);
  const st = d && d.stance && typeof d.stance === "object" ? d.stance : {};
  return { views, stance: { risk: ["확대", "중립", "축소", "미확인"].includes(st.risk) ? st.risk : "미확인", why: S(st.why, 400) }, themes: arr(d && d.themes, 6).map((x) => S(x, 60)).filter(Boolean), miss: arr(d && d.miss, 6).map((x) => S(x, 300)).filter(Boolean) };
}
function cleanAi(d) {
  const conf = ["높음", "보통", "낮음"];
  return { head: S(d && d.head, 120), view: S(d && d.view, 1200), shift: S(d && d.shift, 900), consist: S(d && d.consist, 700),
    intent: arr(d && d.intent, 7).map((x) => ({ move: S(x && x.move, 320), why: S(x && x.why, 900), alt: S(x && x.alt, 500), basis: S(x && x.basis, 400), conf: conf.includes(x && x.conf) ? x.conf : "낮음" })).filter((x) => x.move && x.why),
    apply: arr(d && d.apply, 5).map((x) => ({ do: S(x && x.do, 110), how: S(x && x.how, 600) })).filter((x) => x.do),
    dont: arr(d && d.dont, 4).map((x) => S(x, 300)).filter(Boolean), watch: arr(d && d.watch, 6).map((x) => S(x, 400)).filter(Boolean),
    risk: ["확대", "중립", "축소", "미확인"].includes(d && d.risk) ? d.risk : "미확인", caveat: S(d && d.caveat, 600) };
}
function cleanSum(d) {
  const rk = (v) => (["확대", "중립", "축소", "미확인"].includes(v) ? v : "미확인");
  return { head: S(d && d.head, 90), view: S(d && d.view, 800), agree: S(d && d.agree, 400), split: S(d && d.split, 400),
    byType: arr(d && d.byType, 6).map((x) => ({ ty: S(x && x.ty, 30), read: S(x && x.read, 500), risk: rk(x && x.risk) })).filter((x) => x.ty && x.read),
    names: arr(d && d.names, 8).map((x) => ({ t: S(x && x.t, 40), read: S(x && x.read, 300) })).filter((x) => x.t && x.read),
    themes: arr(d && d.themes, 6).map((x) => S(x, 80)).filter(Boolean),
    apply: arr(d && d.apply, 5).map((x) => ({ do: S(x && x.do, 110), how: S(x && x.how, 400) })).filter((x) => x.do),
    dont: arr(d && d.dont, 4).map((x) => S(x, 240)).filter(Boolean), watch: arr(d && d.watch, 5).map((x) => S(x, 260)).filter(Boolean), risk: rk(d && d.risk), caveat: S(d && d.caveat, 300) };
}
/* 붙여넣은 답에서 JSON 꺼내기 — ```json 블록이나 앞뒤 설명이 섞여 있어도 */
function parseAnswer(text) { let t = String(text || ""); const m = t.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i); if (m) t = m[1]; const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b <= a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { try { return JSON.parse(t.slice(a, b + 1).replace(/[\u201c\u201d]/g, '"').replace(/,\s*([}\]])/g, "$1")); } catch (e2) { return null; } } }
const MANUAL_TAIL = "\n\n[답하는 방법] 위 '출력' 형식의 JSON 하나만 답한다. 설명 · 인사 · 코드블록 표시는 붙이지 않는다. 이 답은 앱에 그대로 붙여 넣어 저장한다.";
export async function guruHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "POST만" });
  const rc = redisConf(); if (!rc) return res.status(200).json({ ok: false, reason: "NO_REDIS" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } } b = b || {};
  const ids = {}; GURUS.forEach((G) => { ids[G.id] = G; });
  const doc = (await readDoc(rc, KEY_AI)) || { notes: {}, ai: {} }; doc.notes = doc.notes || {}; doc.ai = doc.ai || {};
  const save = async () => { doc.updated = new Date().toISOString(); await setJsonGz(rc, KEY_AI, doc, 800 * 86400); };
  if (b.get) return res.status(200).json({ ok: true, doc });
  const gdoc0 = (await readDoc(rc, DISC_KEY.guru)) || { gurus: [] };
  /* 입력 글 만들기 — 자동(Claude 호출)과 직접(프롬프트 복사)이 같은 글을 쓴다 */
  const profOf = (x) => String(x == null ? "" : x).trim().slice(0, 3500);
  const inNote = (G, g, prof) => "[인물] " + G.nm + " · " + G.org + "\n[인물 정보 — 앱의 인물 사전]\n" + (prof || "(없음)") + (g ? "\n\n[최근 13F 요약 — 참고용. 이 숫자를 다시 찾지 않는다]\n" + guruFacts(g).split("\n").slice(0, 16).join("\n") : "") + "\n\n[찾을 기간] 최근 6개월(오늘부터 거꾸로). 그보다 오래된 것은 넣지 않는다.";
  const inRead = (G, g, prof, ty, nt) => { const noteTxt = (nt.views || []).length ? "\n\n[13F 밖의 이야기 — 최근 발언 · 서한 · 보도 (" + (nt.asOf || "") + " 조사)]\n" + nt.views.map((v) => "- " + v.date + " · " + v.kind + " · " + v.src + ": " + v.say + (v.pos ? " / 포지션: " + v.pos : "")).join("\n") + (nt.stance && nt.stance.risk !== "미확인" ? "\n- 발언으로 본 위험 태도: " + nt.stance.risk + " — " + nt.stance.why : "") : "\n\n[13F 밖의 이야기] 조사한 것이 없다 — 13F 숫자와 인물 정보만으로 해석하고, 그 한계를 caveat에 적는다.";
    const memoTxt = nt.memo ? "\n\n[운영자 메모 — 운영자가 직접 본 내용. 사실로 취급하되 출처는 '운영자 메모'로 밝힌다]\n" + nt.memo : "";
    return "[인물] " + G.nm + " · " + G.org + " · 유형: " + S(ty, 60) + "\n\n[인물 정보 — 철학 · 매매 습관 · 이력 · 이 사람의 13F 읽는 법]\n" + (prof || "(없음)") + "\n\n[13F 숫자 — 앱이 계산한 값. 그대로 인용한다]\n" + guruFacts(g) + noteTxt + memoTxt; };
  const inSum = (ctx, people) => { const P = people && typeof people === "object" ? people : {}; const L = [];
    (gdoc0.gurus || []).forEach((g) => { const p = P[g.id]; if (!p) return; const nt = doc.notes[g.id] || {}, nm = (m) => m.t || m.n, pcw = (m) => (m.pw != null || m.w != null ? " " + pc(m.pw || 0) + "→" + pc(m.w || 0) : "");
      L.push("■ " + g.nm + " (" + g.org + ") · 유형: " + S(p.ty, 40) + " · 13F 신뢰도 " + (+p.trust || 0) + "/3 · " + S(p.one, 80));
      L.push("  합계 " + usd(g.total) + (g.flow != null ? " · 순매매 " + (g.flow >= 0 ? "+" : "") + pc(g.flow) : "") + (g.conc ? " · 상위5 " + pc(g.conc.t5, 0) : "") + (g.turn != null ? " · 회전율 " + pc(g.turn, 0) : "") + (g.optSum && (g.optSum.put + g.optSum.call) ? " · 풋 " + usd(g.optSum.put) + "/콜 " + usd(g.optSum.call) : ""));
      L.push("  상위: " + arr(g.top, 5).map((x) => nm(x) + " " + pc(x.w, 0)).join(", "));
      const bs = arr(g.buys, 12).filter((m) => (m.w || 0) >= 0.005).slice(0, 4), ss = arr(g.sells, 12).filter((m) => (m.pw || 0) >= 0.005 || m.kind === "exit").slice(0, 4);
      if (bs.length) L.push("  산 것: " + bs.map((m) => nm(m) + (m.kind === "new" ? " 신규" : " 증액") + pcw(m)).join(", "));
      if (ss.length) L.push("  판 것: " + ss.map((m) => nm(m) + (m.kind === "exit" ? " 전량 매도" : " 축소") + pcw(m)).join(", "));
      if (nt.stance && nt.stance.risk && nt.stance.risk !== "미확인") L.push("  발언으로 본 위험 태도: " + nt.stance.risk + " — " + nt.stance.why);
      if (doc.ai[g.id] && doc.ai[g.id].period === g.period && doc.ai[g.id].head) L.push("  개별 해석 한 줄: " + doc.ai[g.id].head); });
    return "[앱이 계산한 종합 숫자]\n" + String(ctx || "").slice(0, 6000) + "\n\n[인물별 요약 — " + L.filter((x) => x[0] === "■").length + "명]\n" + L.join("\n"); };
  /* 종합 해석(인물 없이) — 자동 · 프롬프트 · 직접 저장 */
  if (b.sum || b.prep === "sum" || b.save === "sum") {
    const inp = inSum(b.ctx, b.people), per = (gdoc0.gurus || []).map((g) => g.period || "").sort().pop() || "";
    if (b.prep) return res.status(200).json({ ok: true, prompt: taskSystem("guruS") + MANUAL_TAIL + "\n\n오늘: " + kstDay() + " (한국 시간)\n\n" + inp });
    let data = null, model = null;
    if (b.save) { data = parseAnswer(b.text); if (!data || !data.head) return res.status(200).json({ ok: false, msg: "답에서 JSON을 읽지 못했어요 — { 로 시작해 } 로 끝나는 답 전체를 붙여 주세요" }); }
    else { const key = process.env.ANTHROPIC_API_KEY; if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" }); let cu = 0; try { cu = +(await redisCmd(rc, ["INCR", "sm:claude:" + kstDay()])) || 0; } catch (e) {}
      let out; try { out = await runClaude({ task: "guruS", input: inp, json: true, need: ["head", "view"] }, key, cu); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
      if (!out || !out.ok || !out.data) return res.status(200).json({ ok: false, msg: "종합 해석 실패: " + String((out && (out.msg || out.reason)) || "응답 없음").slice(0, 120) }); data = out.data; model = out.model || null; }
    doc.sum = Object.assign(cleanSum(data), { at: Date.now(), period: per, manual: !!b.save, model }); await save(); return res.status(200).json({ ok: true, sum: doc.sum });
  }
  const id = String(b.note || b.memo || b.read || b.del || b.id || ""); const G = ids[id];
  if (!G) return res.status(200).json({ ok: false, reason: "BAD_ID", msg: "모르는 인물이에요" });
  const prof = profOf(b.profile), g0 = (gdoc0.gurus || []).filter((x) => x.id === id)[0] || null;
  /* 프롬프트만 받기 — 내가 직접 AI에 물어볼 때 */
  if (b.prep === "note") return res.status(200).json({ ok: true, prompt: taskSystem("guruN") + MANUAL_TAIL + "\n\n오늘: " + kstDay() + " (한국 시간)\n\n" + inNote(G, g0, prof) });
  if (b.prep === "read") { if (!g0) return res.status(200).json({ ok: false, msg: "이 인물의 13F를 아직 받지 않았어요" }); return res.status(200).json({ ok: true, prompt: taskSystem("guruA") + MANUAL_TAIL + "\n\n오늘: " + kstDay() + " (한국 시간)\n\n" + inRead(G, g0, prof, b.ty, doc.notes[id] || {}) }); }
  /* 직접 받은 답 저장 */
  if (b.save === "note") { const d = parseAnswer(b.text); if (!d || !Array.isArray(d.views)) return res.status(200).json({ ok: false, msg: "답에서 JSON을 읽지 못했어요 — { 로 시작해 } 로 끝나는 답 전체를 붙여 주세요" });
    doc.notes[id] = Object.assign({}, doc.notes[id] && doc.notes[id].memo ? { memo: doc.notes[id].memo, memoAt: doc.notes[id].memoAt } : {}, cleanNote(d), { at: Date.now(), asOf: kstDay(), manual: true }); await save(); return res.status(200).json({ ok: true, note: doc.notes[id] }); }
  if (b.save === "read") { if (!g0) return res.status(200).json({ ok: false, msg: "이 인물의 13F를 아직 받지 않았어요" }); const d = parseAnswer(b.text); if (!d || !d.head || !Array.isArray(d.intent)) return res.status(200).json({ ok: false, msg: "답에서 JSON을 읽지 못했어요 — { 로 시작해 } 로 끝나는 답 전체를 붙여 주세요" });
    const nt = doc.notes[id] || {}; doc.ai[id] = Object.assign(cleanAi(d), { at: Date.now(), period: g0.period, filed: g0.filed, withNote: !!(nt.views || []).length, withMemo: !!nt.memo, manual: true }); await save(); return res.status(200).json({ ok: true, ai: doc.ai[id] }); }
  /* ② 직접 메모 */
  if (b.memo) { const t = String(b.text || "").trim().slice(0, 2000); doc.notes[id] = Object.assign(doc.notes[id] || {}, { memo: t, memoAt: Date.now() }); await save(); return res.status(200).json({ ok: true, note: doc.notes[id] }); }
  if (b.del) { if (b.what === "ai") delete doc.ai[id]; else if (doc.notes[id]) { const m = doc.notes[id]; doc.notes[id] = m.memo ? { memo: m.memo, memoAt: m.memoAt } : undefined; if (!doc.notes[id]) delete doc.notes[id]; } await save(); return res.status(200).json({ ok: true }); }
  const key = process.env.ANTHROPIC_API_KEY; if (!key) return res.status(200).json({ ok: false, reason: "NO_KEY", msg: "Vercel 환경변수에 ANTHROPIC_API_KEY가 없어요" });
  let cu = 0; try { cu = +(await redisCmd(rc, ["INCR", "sm:claude:" + kstDay()])) || 0; } catch (e) {}
  if (cu > +(process.env.CLAUDE_DAILY_MAX || 60)) return res.status(200).json({ ok: false, msg: "오늘 Claude 작업 횟수를 다 썼어요" });
  const g = g0;
  /* ① 발언 조사 */
  if (b.note) {
    let out; try { out = await runClaude({ task: "guruN", input: inNote(G, g, prof), json: true, need: ["views"] }, key, cu); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
    if (!out || !out.ok || !out.data) return res.status(200).json({ ok: false, msg: "발언 조사 실패: " + String((out && (out.msg || out.reason)) || "응답 없음").slice(0, 120) });
    const n = cleanNote(out.data); doc.notes[id] = Object.assign({}, doc.notes[id] && doc.notes[id].memo ? { memo: doc.notes[id].memo, memoAt: doc.notes[id].memoAt } : {}, n, { at: Date.now(), asOf: kstDay(), model: out.model || null });
    await save(); return res.status(200).json({ ok: true, note: doc.notes[id], tok: out.usage || null });
  }
  /* ③ AI 해석 */
  if (b.read) {
    if (!g) return res.status(200).json({ ok: false, msg: "이 인물의 13F를 아직 받지 않았어요 — GitHub의 'SEC 13F 수집'을 먼저 실행해 주세요" });
    const nt = doc.notes[id] || {};
    let out; try { out = await runClaude({ task: "guruA", input: inRead(G, g, prof, b.ty, nt), json: true, need: ["head", "intent"] }, key, cu); } catch (e) { out = { ok: false, msg: String(e.message).slice(0, 160) }; }
    if (!out || !out.ok || !out.data) return res.status(200).json({ ok: false, msg: "해석 실패: " + String((out && (out.msg || out.reason)) || "응답 없음").slice(0, 120) });
    doc.ai[id] = Object.assign(cleanAi(out.data), { at: Date.now(), period: g.period, filed: g.filed, withNote: !!(nt.views || []).length, withMemo: !!nt.memo, model: out.model || null });
    await save(); return res.status(200).json({ ok: true, ai: doc.ai[id], tok: out.usage || null });
  }
  return res.status(200).json({ ok: false, reason: "NO_OP" });
}
