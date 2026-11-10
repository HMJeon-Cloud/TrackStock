// v12.71 국내 장 마감 자료 — 네이버 증권 공개 끝점에서 (1) 급등·급락 순위(업종 포함) (2) 외국인·기관 순매수·순매도 상위 (3) 지수 수급(개인·외국인·기관)·상승/하락 종목 수
//   /api/channel?op=kr (POST {fresh:1} 이면 다시 받음) → { ok, day, at, up:{kospi,kosdaq}, down:{...}, investor:{foreign:{buy,sell}, inst:{buy,sell}}, index:{kospi,kosdaq}, src, miss }
//   원칙: 읽지 못한 칸은 비워 두고 miss에 이유를 남긴다(틀린 숫자를 만들지 않기 위해). 하루치 Redis 캐시(20분마다 갱신 허용, 2일 보관). 새 함수 파일이 아니라 channel.js 안에서 돈다.
import { redisConf, setJsonGz, getJsonGzText } from "./_redis.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const num = (s) => { if (typeof s === "number") return s; const v = parseFloat(String(s == null ? "" : s).replace(/[,+%\s]/g, "").replace(/[−]/g, "-")); return isFinite(v) ? v : null; };
async function fetchT(url, opt, ms) { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms || 9000); try { return await fetch(url, { ...opt, signal: ac.signal }); } finally { clearTimeout(t); } }
async function getJson(url) {
  const r = await fetchT(url, { headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://m.stock.naver.com/" } }); if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function getHtml(url) {   // 네이버 금융(PC)은 EUC-KR
  const r = await fetchT(url, { headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://finance.naver.com/" } }); if (!r.ok) throw new Error("HTTP " + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  try { return new TextDecoder("euc-kr").decode(buf); } catch (e) { return new TextDecoder("utf-8").decode(buf); }
}
const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const arrOf = (j) => Array.isArray(j) ? j : (j && (j.stocks || j.items || j.result || j.data || j.list)) || [];

/* ---------- (1) 급등·급락 순위 — 업종 이름이 같이 온다 ---------- */
function stockRow(x) {
  const code = String(x.itemCode || x.code || x.stockCode || "").replace(/\D/g, ""); if (code.length !== 6) return null;
  const it = x.industryCodeType || x.industry || {};
  const ret = num(x.fluctuationsRatio != null ? x.fluctuationsRatio : x.changeRate != null ? x.changeRate : x.rate);
  const sign = String(x.compareToPreviousPrice && (x.compareToPreviousPrice.code || x.compareToPreviousPrice.name) || "");
  return { code, name: String(x.stockName || x.name || code).slice(0, 30), ret: ret == null ? null : (/5|4|FALL|하락/i.test(sign) && ret > 0 ? -ret : ret), price: num(x.closePrice || x.currentPrice || x.price),
    amt: num(x.accumulatedTradingValue || x.tradingValue || x.accumulatedTradingVolume), sec: String(it.industryGroupKor || it.name || x.industryName || x.sectorName || "").slice(0, 24), mcap: num(x.marketValue) };
}
async function ranking(dir, mk) {
  const urls = ["https://m.stock.naver.com/api/stocks/" + dir + "/" + mk + "?page=1&pageSize=60", "https://m.stock.naver.com/api/stocks/" + dir + "/" + mk + "?pageSize=60"];
  let err = "";
  for (const u of urls) { try { const rows = arrOf(await getJson(u)).map(stockRow).filter(Boolean); if (rows.length) return { rows, src: u }; err = "빈 응답"; } catch (e) { err = String(e.message).slice(0, 60); } }
  return { rows: [], err };
}

/* ---------- (2) 외국인·기관 순매수·순매도 상위 — PC 네이버 금융 표 (개인 상위는 네이버가 주지 않음) ---------- */
async function dealRank(sosok, gubun, type) {
  // v12.81 모바일 JSON 후보 먼저 (끝점 이름이 확실치 않아 여러 개 시도 — 종목 배열이 오면 채택)
  const mk = sosok === "02" ? "KOSDAQ" : "KOSPI", inv = gubun === "1000" ? "foreigner" : "institution", cands = ["https://m.stock.naver.com/api/stocks/" + inv + (type === "buy" ? "Buy" : "Sell") + "/" + mk + "?page=1&pageSize=20", "https://m.stock.naver.com/api/stocks/investor/" + mk + "?investorType=" + (gubun === "1000" ? "FOREIGN" : "INSTITUTION") + "&tradeType=" + type.toUpperCase() + "&page=1&pageSize=20"];
  for (const u of cands) { try { const rows = arrOf(await getJson(u)).map((x) => { const r = stockRow(x); if (!r) return null; r.amt = num(x.netBuyAmount || x.pureBuyAmount || x.netBuyingAmount || x.tradingValue || x.amount); if (r.amt != null && Math.abs(r.amt) > 1e7) r.amt = Math.round(r.amt / 1e6); return r; }).filter(Boolean); if (rows.length) return { rows: rows.slice(0, 20), src: u }; } catch (e) {} }
  const urls = ["https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=" + sosok + "&investor_gubun=" + gubun + "&type=" + type, "https://finance.naver.com/sise/sise_deal_rank.naver?sosok=" + sosok + "&investor_gubun=" + gubun + "&type=" + type];
  let err = "";
  for (const u of urls) {
    try {
      const html = await getHtml(u), out = [], re = /<a[^>]*code=(\d{6})[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/g; let m;
      while ((m = re.exec(html)) && out.length < 20) {
        const cells = m[3].split(/<td[^>]*>/).map(strip).filter((c) => c !== ""), nums = cells.map(num).filter((v) => v != null);
        if (!nums.length) continue;
        out.push({ code: m[1], name: strip(m[2]).slice(0, 30), amt: nums[0], price: nums[1] != null ? nums[1] : null, ret: nums.length >= 3 ? nums[nums.length - 1] : null });   // amt: 백만원 또는 주(표 머리로 판단 — 네이버 순매매 상위는 금액(백만원))
      }
      if (out.length) return { rows: out, src: u };
      err = "표 없음";
    } catch (e) { err = String(e.message).slice(0, 60); }
  }
  return { rows: [], err };
}

/* v12.92 네이버가 증권 화면을 새로 만들면서(2026) 예전 순매매 표 주소가 빈 화면이 됨 → 새 화면이 쓰는 JSON을 먼저 읽는다. 한 번 호출에 순매수·순매도 상위가 같이 온다.
   v12.93 단위 맞추기: 응답에 단위가 적혀 있지 않다. 그래서 앱이 이미 가진 같은 날 일봉(sm:recent의 거래량·종가)과 견줘
   ① 수량 단위(주/천주)를 '당일 거래량'으로 정하고 ② 금액 단위(원/천원/백만원/억원)를 '순매매 수량 × 종가'로 정한다. 정하지 못하면 버리고, 이유에 실제 숫자 예시를 남긴다. */
const SN_HEAD = { "User-Agent": UA, Accept: "application/json", Referer: "https://stock.naver.com/" };
async function getJsonS(url) { const r = await fetchT(url, { headers: SN_HEAD }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
async function dealRaw(mk, inv) {   // mk: KOSPI|KOSDAQ · inv: FOREIGNER|ORGANIZATION
  const u = "https://stock.naver.com/api/domestic/market/trend/trendForeignOrg?investorType=" + inv + "&tradeType=KRX&marketType=" + mk + "&startIdx=0&pageSize=50&periodType=DAY";
  try {
    const j = await getJsonS(u), S = (j && j.sections) || {}, buy = Array.isArray(S.buyRankList) ? S.buyRankList : [], sell = Array.isArray(S.sellRankList) ? S.sellRankList : [];
    if (!buy.length && !sell.length) return { err: "새 주소 빈 응답" };
    const d = String((buy[0] || sell[0] || {}).bizdateTo || "");
    return { buy, sell, biz: /^\d{8}$/.test(d) ? d : null, mk, src: u };
  } catch (e) { return { err: "새 주소 " + String(e.message).slice(0, 50) }; }
}
function vote(pairs, cands, tol, minN) {   // pairs: [실제값, 응답값] → 응답값 × 곱수 ≈ 실제값 이 되는 곱수
  const v = {}; let n = 0;
  for (const [real, raw] of pairs) { if (!(real > 0) || !(raw > 0)) continue; let best = null, bd = Infinity; for (const c of cands) { const d = Math.abs(Math.log((raw * c) / real)); if (d < bd) { bd = d; best = c; } } if (bd < Math.log(tol)) { v[best] = (v[best] || 0) + 1; n++; } }
  const ks = Object.keys(v).sort((a, b) => v[b] - v[a]); return ks.length && v[ks[0]] >= Math.max(minN, n * 0.75) ? +ks[0] : null;
}
async function dealUnits(rc, raws) {
  const items = [], biz = (raws.find((r) => r && r.biz) || {}).biz; raws.forEach((r) => { if (r && !r.err) r.buy.concat(r.sell).forEach((x) => items.push({ x, mk: r.mk })); });
  if (!items.length) return { err: "자료 없음" };
  const ex = (() => { const it = items[0].x; return "예: " + String(it.itemname || "").slice(0, 10) + " 금액 " + it.accTradeAmount + " · 수량 " + it.accTradeVolume + " · 거래량 " + it.dailyTradeVolume + " · 가격 " + it.nowPrice; })();
  let recent = null; if (rc) { try { const t = await getJsonGzText(rc, "sm:recent"); if (t) recent = JSON.parse(t); } catch (e) {} }
  if (!recent || !recent.symbols || !biz) return { err: "단위 대조용 일봉을 못 읽음 (" + ex + ")" };
  const bar = (code, mk) => { const d = recent.symbols[code + (mk === "KOSDAQ" ? ".KQ" : ".KS")] || recent.symbols[code + ".KS"] || recent.symbols[code + ".KQ"]; if (!d || !d.t) return null; for (let i = d.t.length - 1; i >= 0 && i >= d.t.length - 12; i--) { const ms = d.t[i] < 1e11 ? d.t[i] * 1000 : d.t[i]; if (new Date(ms + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "") === biz) return { v: d.v && d.v[i], c: d.c && d.c[i] }; } return null; };
  const vp = [], rows = [];
  for (const { x, mk } of items) { const code = String(x.itemcode || x.itemCode || "").replace(/\D/g, ""), b = bar(code, mk); if (!b) continue; rows.push({ x, b }); vp.push([b.v, Math.abs(num(x.dailyTradeVolume) || 0)]); }
  if (rows.length < 2) return { err: "대조할 종목이 일봉에 없음 (" + ex + ")" };
  const volMul = vote(vp, [1, 1e3], 3, 2); if (volMul == null) return { err: "수량 단위를 확인하지 못함 (" + ex + " · 그날 실제 거래량 " + rows[0].b.v + ")" };
  const ap = []; for (const { x, b } of rows) { const q = Math.abs(num(x.accTradeVolume) || 0), a = Math.abs(num(x.accTradeAmount) || 0); if (q >= 20 && a > 0 && b.c > 0) ap.push([q * volMul * b.c, a]); }
  const amtMul = vote(ap, [1, 1e3, 1e6, 1e8], 2.5, 2); if (amtMul == null) return { err: "금액 단위를 확인하지 못함 (" + ex + " · 그날 종가 " + rows[0].b.c + ")" };
  return { k: amtMul / 1e6, unit: (volMul === 1e3 ? "천주" : "주") + "·" + ({ 1: "원", 1e3: "천원", 1e6: "백만원", 1e8: "억원" })[amtMul], n: rows.length };
}
function dealRow(x, k) {
  const code = String(x.itemcode || x.itemCode || "").replace(/\D/g, ""); if (code.length !== 6) return null; const a = num(x.accTradeAmount); if (a == null) return null;
  let ret = num(x.prevChangeRate); const pc = num(x.prevChangePrice); if (ret != null && pc != null && pc < 0 && ret > 0) ret = -ret; if (ret != null && /^(4|5)$|FALL|LOWER/i.test(String(x.type || "")) && ret > 0) ret = -ret;
  return { code, name: String(x.itemname || x.itemName || code).slice(0, 30), amt: Math.round(Math.abs(a) * k), price: num(x.nowPrice), ret };
}

/* ---------- (3) 지수 수급·상승/하락 종목 수 ---------- */
function pickNum(text, label) { const m = text.match(new RegExp(label + "[^0-9+\\-−]{0,40}([+\\-−]?[\\d,]+(?:\\.\\d+)?)")); return m ? num(m[1]) : null; }
async function indexFlow(code) {   // code: KOSPI | KOSDAQ
  const out = { indiv: null, foreign: null, inst: null, up: null, down: null, flat: null, upLimit: null, downLimit: null, amount: null, close: null, ret: null }, tried = [];
  // 0) v12.92 새 증권 화면의 JSON — 지수 기본(종가·등락률) + 통합(상승/하락 종목 수 · 개인/외국인/기관 순매수)
  try {
    const B = "https://stock.naver.com/api/securityFe/api/index/" + code, [bs, ig] = await Promise.all([getJsonS(B + "/basic").catch(() => null), getJsonS(B + "/integration").catch(() => null)]);
    if (bs) { if (bs.closePrice != null) out.close = num(bs.closePrice); if (bs.fluctuationsRatio != null) { let r = num(bs.fluctuationsRatio); const nm = String(bs.compareToPreviousPrice && (bs.compareToPreviousPrice.name || bs.compareToPreviousPrice.code) || ""); if (r != null && /FALL|LOWER|^(4|5)$/i.test(nm) && r > 0) r = -r; out.ret = r; } if (bs.localTradedAt) out.tradedAt = String(bs.localTradedAt).slice(0, 19); }
    if (ig) {
      const ud = ig.upDownStockInfo; if (ud && ud.riseCount != null) { out.up = num(ud.riseCount); out.down = num(ud.fallCount); out.flat = num(ud.steadyCount); out.upLimit = num(ud.upperCount); out.downLimit = num(ud.lowerCount); }
      const dt = ig.dealTrendInfo, pure = (v) => (v != null && /^[+\-−]?[\d,]+(\.\d+)?$/.test(String(v).trim()) ? num(v) : null);   // 숫자만 있는 값만 인정(조·억 글자가 섞이면 버림)
      if (dt) { const f = pure(dt.foreignValue), o = pure(dt.institutionalValue), i = pure(dt.personalValue); if (f != null || o != null || i != null) { out.foreign = f; out.inst = o; out.indiv = i; out.unit = "억원"; } }
      if (out.up != null || out.foreign != null) out.src = B + "/integration";
    }
  } catch (e) {}
  // 1) 모바일 JSON 후보 — 키 이름이 맞는 것이 오면 쓴다
  for (const u of (out.foreign != null && out.up != null) ? [] : ["https://m.stock.naver.com/api/index/" + code + "/investor?pageSize=1&page=1", "https://m.stock.naver.com/api/index/" + code + "/trend?pageSize=1", "https://m.stock.naver.com/api/index/" + code + "/basic"]) {
    try {
      const j = await getJson(u), x = arrOf(j)[0] || j; tried.push(u.split("/").slice(-1)[0].split("?")[0]);
      const f = num(x.foreignerPureBuyQuant || x.foreignPureBuy || x.foreignerNetBuy || x.foreigner), o = num(x.organPureBuyQuant || x.institutionPureBuy || x.organNetBuy || x.organ), i = num(x.individualPureBuyQuant || x.individualPureBuy || x.individualNetBuy || x.individual);
      if (out.foreign == null && (f != null || o != null || i != null)) { out.foreign = f; out.inst = o; out.indiv = i; out.src = u; }
      if (out.close == null && x.closePrice != null) out.close = num(x.closePrice); if (out.ret == null && x.fluctuationsRatio != null) out.ret = num(x.fluctuationsRatio);
      if (out.up == null && (x.upStockCount != null || x.riseCount != null)) { out.up = num(x.upStockCount || x.riseCount); out.down = num(x.downStockCount || x.fallCount); out.flat = num(x.flatStockCount || x.steadyCount); }
      if (x.accumulatedTradingValue != null) out.amount = num(x.accumulatedTradingValue);
      if (out.foreign != null && out.up != null) break;
    } catch (e) {}
  }
  // 2) PC 지수 페이지(HTML) — 개인·외국인·기관(억원) · 상승/하락 종목 수 · 거래대금
  if (out.foreign == null || out.up == null) {
    try {
      const html = await getHtml("https://finance.naver.com/sise/sise_index.naver?code=" + code), t = strip(html.replace(/<script[\s\S]*?<\/script>/g, " "));
      if (out.indiv == null) out.indiv = pickNum(t, "개인"); if (out.foreign == null) out.foreign = pickNum(t, "외국인"); if (out.inst == null) out.inst = pickNum(t, "기관");
      if (out.up == null) { out.up = pickNum(t, "상승"); out.down = pickNum(t, "하락"); out.flat = pickNum(t, "보합"); out.upLimit = pickNum(t, "상한"); out.downLimit = pickNum(t, "하한"); }
      if (out.amount == null) out.amount = pickNum(t, "거래대금");
      if (out.close == null) { const m = html.match(/id="now_value"[^>]*>([\d,.]+)/); if (m) out.close = num(m[1]); const r = html.match(/id="change_value_and_rate"[^>]*>([\s\S]*?)<\/span>/); if (r) { const rr = strip(r[1]).match(/([+-]?[\d.]+)%/); if (rr) out.ret = num(rr[1]); } }
      out.src = out.src || "sise_index"; out.unit = "억원";
    } catch (e) { out.err = String(e.message).slice(0, 60); }
  }
  // 3) PC 투자자별 매매동향(일별) — 개인·외국인·기관계 순매수 (억원) 첫 행
  if (out.foreign == null) {
    try {
      const html = await getHtml("https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=" + kstDay().replace(/-/g, "") + "&sosok=" + (code === "KOSDAQ" ? "02" : "01")), rows = html.split(/<tr[^>]*>/).slice(1);
      for (const r of rows) { const cells = r.split(/<td[^>]*>/).slice(1).map(strip); if (cells.length < 4 || !/^\d{2}\.\d{2}\.\d{2}/.test(cells[0])) continue; const v = cells.slice(1).map(num); if (v[0] == null) continue; out.indiv = v[0]; out.foreign = v[1]; out.inst = v[2]; out.src = "investorDealTrendDay"; out.unit = "억원"; out.flowDate = cells[0]; break; }
    } catch (e) { out.err2 = String(e.message).slice(0, 60); }
  }
  return out;
}

export async function krHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } } body = body || {};
  const rc = redisConf(), day = kstDay(), key = "sm:kr:" + day;
  if (rc && !body.fresh) { try { const t = await getJsonGzText(rc, key); if (t) { const c = JSON.parse(t); if (Date.now() - (c.at || 0) < 20 * 60e3 || body.cached) return res.status(200).json(Object.assign(c, { cached: true })); } } catch (e) {} }
  const miss = [], src = {};
  const [upK, upQ, dnK, dnQ] = await Promise.all([ranking("up", "KOSPI"), ranking("up", "KOSDAQ"), ranking("down", "KOSPI"), ranking("down", "KOSDAQ")]);
  [["up.kospi", upK], ["up.kosdaq", upQ], ["down.kospi", dnK], ["down.kosdaq", dnQ]].forEach(([k, r]) => { if (r.err) miss.push(k + ": " + r.err); else src[k] = r.src; });
  const inv = {};
  let invDate = null;
  const pairs = [["foreign", "9000", "FOREIGNER"], ["inst", "1000", "ORGANIZATION"]];   // 예전 표 주소의 구분값: 9000 외국인 · 1000 기관(전엔 서로 바뀌어 있었음)
  const raws = await Promise.all([dealRaw("KOSPI", "FOREIGNER"), dealRaw("KOSDAQ", "FOREIGNER"), dealRaw("KOSPI", "ORGANIZATION"), dealRaw("KOSDAQ", "ORGANIZATION")]);
  const U = raws.some((r) => !r.err) ? await dealUnits(rc, raws) : { err: (raws[0] && raws[0].err) || "새 주소 실패" };
  for (let i = 0; i < pairs.length; i++) {
    const [name, gubun] = pairs[i], a = raws[i * 2], b = raws[i * 2 + 1]; inv[name] = {};
    for (const type of ["buy", "sell"]) {
      let ra = !U.err && !a.err ? a[type].map((x) => dealRow(x, U.k)).filter(Boolean) : null, rb = !U.err && !b.err ? b[type].map((x) => dealRow(x, U.k)).filter(Boolean) : null, sA = a.src, sB = b.src, eA = U.err || a.err, eB = U.err || b.err;
      if (!ra || !rb) {   // 새 주소가 안 되면 예전 표 주소로 한 번 더
        const [oa, ob] = await Promise.all([ra ? null : dealRank("01", gubun, type), rb ? null : dealRank("02", gubun, type)]);
        if (oa) { ra = oa.rows; sA = oa.src; eA = (eA ? eA + " / " : "") + (oa.err || ""); } if (ob) { rb = ob.rows; sB = ob.src; eB = (eB ? eB + " / " : "") + (ob.err || ""); }
      }
      inv[name][type] = (ra || []).map((x) => Object.assign({ mk: "kospi" }, x)).concat((rb || []).map((x) => Object.assign({ mk: "kosdaq" }, x))).sort((p, q) => Math.abs(q.amt || 0) - Math.abs(p.amt || 0)).slice(0, 20);
      if (!inv[name][type].length) miss.push("investor." + name + "." + type + ": " + (eA || eB || "없음")); else src["investor." + name + "." + type] = sA || sB;
    }
    const bz = a.biz || b.biz; if (bz && !U.err) invDate = bz.slice(0, 4) + "-" + bz.slice(4, 6) + "-" + bz.slice(6, 8);
  }
  if (!U.err) src["investor.unit"] = U.unit + " (일봉 " + U.n + "종목과 대조)";
  const [ik, iq] = await Promise.all([indexFlow("KOSPI"), indexFlow("KOSDAQ")]);
  [["index.kospi", ik], ["index.kosdaq", iq]].forEach(([k, x]) => { if (x.foreign == null && x.up == null) miss.push(k + ": " + (x.err || "읽지 못함")); else src[k] = x.src; });
  /* v12.91 이 자료가 '며칠 장'의 것인지 · 장중인지 — 화면이 앱 종가 날짜와 다르면 쓰지 않도록 */
  const kn = new Date(Date.now() + 9 * 3600e3), dow = kn.getUTCDay(), mins = kn.getUTCHours() * 60 + kn.getUTCMinutes(), wk = dow >= 1 && dow <= 5;
  const prevWk = () => { const d = new Date(kn.getTime()); do { d.setUTCDate(d.getUTCDate() - 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6); return d.toISOString().slice(0, 10); };
  const ixDay = (ik.tradedAt || iq.tradedAt || "").slice(0, 10);
  const tradeDay = /^\d{4}-\d{2}-\d{2}$/.test(ixDay) ? ixDay : invDate || (wk && mins >= 9 * 60 ? day : prevWk()), live = wk && mins >= 9 * 60 && mins < 15 * 60 + 45;
  const liveNow = live && tradeDay === day;   // 평일 휴장일에는 장중이 아님
  const doc = { ok: true, day, tradeDay, invDate, live: liveNow, at: Date.now(), up: { kospi: upK.rows, kosdaq: upQ.rows }, down: { kospi: dnK.rows, kosdaq: dnQ.rows }, investor: inv, index: { kospi: ik, kosdaq: iq }, src, miss };
  if (rc) { try { await setJsonGz(rc, key, doc, 2 * 86400); } catch (e) {} }
  return res.status(200).json(doc);
}
