/* ============================================================================================
   StockMind v12.5 — 분석 자산(아카이브) · 운영자 전용
   AI 답변 + 그때의 앱 데이터 스냅샷(가격·핵심 숫자·제시 표)을 서버(Upstash Redis, /api/channel?op=archive)에 쌓는다.
   쌓인 기록은 ① 다음 프롬프트에 '과거 분석 기록'으로 들어가고(그때 vs 지금, 판단 조정) ② 종목별 타임라인·적중률로 검증되며
   ③ 지금 앱 데이터와 그때 숫자의 '변화' 표를 만든다. 서버가 없으면 브라우저(localStorage)에 두었다가 서버가 되면 올린다.
   ============================================================================================ */
var ARC_LOCAL = "sm.analyst.answers", ARC_ST = { items: null, at: 0, loading: null, err: null, server: null, verify: {} };
function arcTok() { return typeof ocTok === "function" ? ocTok() : ""; }
function arcApi(body, q) {
  var opt = body ? { method: "POST", headers: { "x-owner": arcTok(), "Content-Type": "application/json" }, body: JSON.stringify(body) } : { headers: { "x-owner": arcTok() } };
  return fetch("/api/channel?op=archive" + (q || ""), opt).then(function (r) { return r.json(); });
}
function arcLocal() { try { return JSON.parse(localStorage.getItem(ARC_LOCAL) || "[]"); } catch (e) { return []; } }
function arcLocalPut(L) { try { localStorage.setItem(ARC_LOCAL, JSON.stringify(L.slice(-80))); } catch (e) {} }
/* 목록 (서버 우선 · 로컬 합침) */
function arcLoad(force) {
  if (ARC_ST.items && !force && Date.now() - ARC_ST.at < 60e3) return Promise.resolve(ARC_ST.items);
  if (ARC_ST.loading && !force) return ARC_ST.loading;
  ARC_ST.loading = arcApi(null).then(function (j) {
    ARC_ST.loading = null; ARC_ST.at = Date.now();
    if (j && j.ok) {
      ARC_ST.server = true; ARC_ST.err = null; var items = j.items || [];
      var loc = arcLocal().filter(function (x) { return !x.up && !items.some(function (y) { return y.id === x.id; }); });   // 서버에 아직 없는 로컬 기록은 올린다 (한 번)
      ARC_ST.items = items;
      if (loc.length) return arcApi({ act: "import", items: loc.map(arcFromLocal) }).then(function (r) { if (r && r.ok) { arcLocalPut(arcLocal().map(function (x) { x.up = 1; return x; })); ARC_ST.items = (r.items || []).concat(items).sort(function (a, b) { return b.at - a.at; }); } return ARC_ST.items; }).catch(function () { return ARC_ST.items; });
      return items;
    }
    ARC_ST.server = false; ARC_ST.err = j && j.reason || "서버 응답 없음"; ARC_ST.items = arcLocal().map(arcFromLocal).sort(function (a, b) { return b.at - a.at; }); return ARC_ST.items;
  }).catch(function () { ARC_ST.loading = null; ARC_ST.server = false; ARC_ST.err = "연결 실패"; ARC_ST.items = arcLocal().map(arcFromLocal); return ARC_ST.items; });
  return ARC_ST.loading;
}
function arcFromLocal(x) { return { id: x.id, at: typeof x.at === "number" ? x.at : Date.parse(x.at) || Date.now(), kind: "analyst", mod: x.mod, modName: x.modName, sym: x.sym || null, name: x.name, scope: x.scope, title: x.title, text: x.text, p: x.p || (typeof anParse === "function" ? anParse(x.text) : {}), snap: x.snap || null, tags: x.tags || [], note: x.note || "" }; }
function arcItems() { return ARC_ST.items || []; }
/* 저장: 답변 + 파싱 + 스냅샷(가격 · 핵심 숫자 · 제시 표) */
function arcSave(rec) {
  rec.id = rec.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7); rec.at = rec.at || Date.now(); rec.kind = rec.kind || "analyst";
  var loc = arcLocal(); loc.push(Object.assign({}, rec, { up: 0 })); arcLocalPut(loc);   // 먼저 로컬(안전망)
  return arcApi({ act: "save", rec: rec }).then(function (j) {
    if (j && j.ok && j.item) { ARC_ST.server = true; arcLocalPut(arcLocal().map(function (x) { if (x.id === rec.id) x.up = 1; return x; })); ARC_ST.items = [Object.assign({}, j.item, { text: rec.text })].concat((ARC_ST.items || []).filter(function (x) { return x.id !== rec.id; })); return j.item; }
    ARC_ST.server = false; ARC_ST.err = j && j.reason || "저장 실패"; ARC_ST.items = [rec].concat((ARC_ST.items || []).filter(function (x) { return x.id !== rec.id; })); return rec;
  }).catch(function () { ARC_ST.server = false; ARC_ST.err = "연결 실패"; ARC_ST.items = [rec].concat(ARC_ST.items || []); return rec; });
}
function arcText(id) {
  var it = arcItems().filter(function (x) { return x.id === id; })[0]; if (it && it.text) return Promise.resolve(it.text);
  var loc = arcLocal().filter(function (x) { return x.id === id; })[0]; if (loc && loc.text) { if (it) it.text = loc.text; return Promise.resolve(loc.text); }
  return arcApi(null, "&id=" + encodeURIComponent(id)).then(function (j) { var t = j && j.ok ? j.text : ""; if (it) it.text = t; return t; });
}
function arcDel(id) { arcLocalPut(arcLocal().filter(function (x) { return x.id !== id; })); ARC_ST.items = arcItems().filter(function (x) { return x.id !== id; }); return arcApi({ act: "del", id: id }).catch(function () {}); }
function arcUpd(id, patch) { var it = arcItems().filter(function (x) { return x.id === id; })[0]; if (it) Object.assign(it, patch); return arcApi(Object.assign({ act: "upd", id: id }, patch)).catch(function () {}); }

/* ============================================================ 검증: 그때 판단 vs 그 뒤 가격 ============================================================ */
function arcExpect(st) { return st === "ok" ? 1 : st === "bad" ? -1 : 0; }
function arcVerifyOne(it) {
  if (!it.sym || !it.snap || it.snap.price == null) return Promise.resolve(null);
  var key = it.id + ":" + Math.floor(Date.now() / 36e5); if (ARC_ST.verify[key]) return Promise.resolve(ARC_ST.verify[key]);
  return (typeof rpLoad === "function" ? rpLoad([it.sym]) : Promise.resolve()).then(function () {
    var rows = typeof rpRows === "function" ? rpRows(it.sym) : []; if (!rows.length) return null;
    var last = rows[rows.length - 1], since = last.c / it.snap.price - 1, days = Math.round((last.t - it.at) / 86400e3), ex = arcExpect(it.p && it.p.verdictSt);
    var hit = days < 20 ? null : ex > 0 ? since > 0.03 : ex < 0 ? since < -0.03 : Math.abs(since) <= 0.1;
    var lo = Infinity, hi = -Infinity; rows.forEach(function (r) { if (r.t >= it.at) { lo = Math.min(lo, r.c); hi = Math.max(hi, r.c); } }); if (lo === Infinity) { lo = hi = last.c; }
    var v = { since: since, days: days, last: last.c, hit: hit, ex: ex, lo: lo / it.snap.price - 1, hi: hi / it.snap.price - 1 }; ARC_ST.verify[key] = v; return v;
  }).catch(function () { return null; });
}
function arcVerifyAll(items) { return Promise.all(items.map(function (it) { return arcVerifyOne(it).then(function (v) { return { it: it, v: v }; }); })); }
function arcScore(pairs) {   // 틀별 · 전체 적중률
  var by = {}; pairs.forEach(function (x) { if (!x.v || x.v.hit == null) return; var k = x.it.mod || "etc"; by[k] = by[k] || { n: 0, hit: 0 }; by[k].n++; if (x.v.hit) by[k].hit++; by._all = by._all || { n: 0, hit: 0 }; by._all.n++; if (x.v.hit) by._all.hit++; });
  return by;
}

/* ============================================================ 재사용 ① 프롬프트 문맥: 과거 기록 → 그때 vs 지금 ============================================================ */
function arcFor(sym, mod, n) {
  var L = arcItems().filter(function (x) { return (sym ? x.sym === sym : !x.sym && x.mod === mod) && (!mod || x.mod === mod || sym); });
  return L.sort(function (a, b) { return b.at - a.at; }).slice(0, n || 3);
}
function arcD(ms) { var d = new Date(ms + 9 * 3600e3); return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCDate(); }
function arcContext(sym, mod, n) {
  var L = arcFor(sym, mod, n || 3); if (!L.length) return Promise.resolve("");
  return arcVerifyAll(L).then(function (pairs) {
    var stTxt = { ok: "양호 ✓", mid: "보통 △", bad: "주의 ✗" }, out = ["[과거 분석 기록 — 내 아카이브 " + L.length + "건 · 오래된 순]"];
    pairs.slice().reverse().forEach(function (x, i) {
      var it = x.it, v = x.v, p = it.p || {};
      var line = (i + 1) + ") " + arcD(it.at) + " · " + (it.modName || it.mod) + (it.scope && it.scope !== "module" ? "(" + it.scope + ")" : "") + " · 종합 " + (stTxt[p.verdictSt] || "-") + (p.one ? " · \"" + p.one + "\"" : "");
      if (v) line += " · 그때 가격 " + (typeof anPrice === "function" ? anPrice(it.sym, it.snap.price) : it.snap.price) + " → 지금 " + (typeof anPrice === "function" ? anPrice(it.sym, v.last) : v.last) + " (" + (v.since > 0 ? "+" : "") + (v.since * 100).toFixed(1) + "%, " + v.days + "일" + (v.hit == null ? "" : v.hit ? ", 판단 적중" : ", 판단 빗나감") + ")";
      out.push(line);
      if (p.items && p.items.length) out.push("   항목: " + p.items.map(function (z) { return z.name + " " + (stTxt[z.st] || "").slice(-1) + (z.num ? "(" + z.num + ")" : ""); }).join(" / "));
      if (it.snap && it.snap.key && Object.keys(it.snap.key).length) out.push("   그때 숫자: " + Object.keys(it.snap.key).slice(0, 10).map(function (k) { return k + " " + it.snap.key[k]; }).join(" · "));
      if (p.risks && p.risks.length) out.push("   그때 리스크: " + p.risks.join(" / "));
    });
    out.push("요청: 위 기록과 지금 데이터를 비교해 (가) 그때와 달라진 것 (나) 그때 판단이 맞았는지와 그 이유 (다) 그래서 이번 판단을 유지/상향/하향할지를 '과거 대비' 문단으로 꼭 넣어줘. 카드형에는 '변화: 유지|상향|하향 | 이유' 한 줄을 추가해줘.");
    return out.join("\n");
  });
}

/* ============================================================ 재사용 ② 앱 데이터 변화: 그때 제시 표 vs 지금 ============================================================ */
function arcNum(s) { var m = String(s == null ? "" : s).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; }
function arcDiff(prevRows, curRows) {
  var P = {}; (prevRows || []).forEach(function (r) { P[r[0]] = r[1]; }); var out = [];
  (curRows || []).forEach(function (r) { var a = P[r[0]]; if (a == null || a === r[1]) return; var na = arcNum(a), nb = arcNum(r[1]); out.push({ label: r[0], from: a, to: r[1], d: na != null && nb != null && na !== 0 ? nb / Math.abs(na) - (na < 0 ? -1 : 1) : null, dir: na != null && nb != null ? (nb > na ? 1 : nb < na ? -1 : 0) : 0 }); });
  return out;
}
/* 스냅샷에 넣을 핵심 숫자: 제시 표에서 숫자 있는 줄 앞쪽 12개 */
function arcSnapKey(out) { var k = {}; (out && out.rows || []).forEach(function (r) { if (Object.keys(k).length < 12 && /\d/.test(String(r[1]))) k[r[0]] = String(r[1]).slice(0, 40); }); return k; }

/* ============================================================ 화면: 자산 목록 · 타임라인 · 적중률 · 백업 ============================================================ */
var ARC_UI = { f: "all", sym: "", open: null };
function arcEsc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s); }
function arcHtml(items, pairs, onPick) {
  var stChip = function (st) { return '<i class="arcSt ' + (st || "mid") + '">' + ({ ok: "✓", mid: "△", bad: "✗" })[st] + '</i>'; }, V = {}; (pairs || []).forEach(function (x) { V[x.it.id] = x.v; });
  var sc = arcScore(pairs || []), all = sc._all || { n: 0, hit: 0 }, syms = []; items.forEach(function (x) { if (x.sym && syms.indexOf(x.sym) < 0) syms.push(x.sym); });
  var mods = {}; items.forEach(function (x) { mods[x.mod] = (mods[x.mod] || 0) + 1; });
  var L = items.filter(function (x) { return (ARC_UI.f === "all" || x.mod === ARC_UI.f) && (!ARC_UI.sym || x.sym === ARC_UI.sym); });
  var h = '<div class="wbKpis arcKpis">' + [["기록", items.length + "건"], ["종목", syms.length + "개"], ["검증 가능", (pairs || []).filter(function (x) { return x.v && x.v.hit != null; }).length + "건"], ["적중률", all.n ? Math.round(all.hit / all.n * 100) + "%" : "-"], ["저장 위치", ARC_ST.server ? "서버 ✓" : "브라우저(서버 " + (ARC_ST.err || "미연결") + ")"]].map(function (k) { return '<div class="wbKpi"><small>' + k[0] + '</small><b>' + arcEsc(k[1]) + '</b></div>'; }).join("") + '</div>';
  if (Object.keys(sc).length > 1) h += '<div class="arcScore">' + Object.keys(sc).filter(function (k) { return k !== "_all"; }).map(function (k) { var m = (typeof AN_MODS !== "undefined" ? AN_MODS : []).filter(function (z) { return z.id === k; })[0]; return '<span>' + (m ? m.t : k) + ' <b>' + Math.round(sc[k].hit / sc[k].n * 100) + '%</b> <small>' + sc[k].hit + '/' + sc[k].n + '</small></span>'; }).join("") + '<small class="briefDim">적중 = 양호 판단 뒤 +3% 넘게 상승 · 주의 판단 뒤 −3% 넘게 하락 · 보통 판단 뒤 ±10% 안 · 20일 지난 기록만</small></div>';
  h += '<div class="wbFilt"><button data-arcf="all"' + (ARC_UI.f === "all" ? ' class="on"' : '') + '>전체 ' + items.length + '</button>' + Object.keys(mods).map(function (k) { var m = (typeof AN_MODS !== "undefined" ? AN_MODS : []).filter(function (z) { return z.id === k; })[0]; return '<button data-arcf="' + k + '"' + (ARC_UI.f === k ? ' class="on"' : '') + '>' + arcEsc(m ? m.t : k) + ' ' + mods[k] + '</button>'; }).join("") + (syms.length ? '<select class="arcSym"><option value="">종목 전체</option>' + syms.map(function (s) { return '<option value="' + s + '"' + (ARC_UI.sym === s ? ' selected' : '') + '>' + arcEsc(typeof anName === "function" ? anName(s) : s) + '</option>'; }).join("") + '</select>' : '') + '</div>';
  if (!L.length) h += '<div class="briefDim">기록이 없어요. ④에서 답변을 저장하면 여기에 쌓여요.</div>';
  else h += '<div class="arcList">' + L.map(function (x) { var v = V[x.id], p = x.p || {}; return '<div class="arcRow' + (onPick === x.id ? ' on' : '') + '" data-arcpick="' + x.id + '"><div class="arcDate">' + arcD(x.at) + '</div><div class="arcMain"><b>' + stChip(p.verdictSt) + ' ' + arcEsc(x.title) + '</b><small>' + arcEsc(x.modName || x.mod) + (x.scope && x.scope !== "module" ? " · " + x.scope : "") + (p.one ? " · " + arcEsc(p.one) : "") + (p.change ? ' · <em>' + arcEsc(p.change) + '</em>' : '') + '</small></div><div class="arcV">' + (v ? '<b class="' + (v.since > 0 ? "pos" : v.since < 0 ? "neg" : "") + '">' + (v.since > 0 ? "+" : "") + (v.since * 100).toFixed(1) + '%</b><small>' + v.days + '일 · ' + (v.hit == null ? "검증 대기" : v.hit ? "적중" : "빗나감") + '</small>' : (x.sym ? '<small class="briefDim">가격 기록 없음</small>' : '<small class="briefDim">시장·자산</small>')) + '</div><div class="anAnsActs"><button class="chip" data-arccp="' + x.id + '">복사</button><button class="chip" data-arcdel="' + x.id + '">삭제</button></div></div>'; }).join("") + '</div>';
  h += '<div class="anActs"><button class="chip" data-arcexp>⬇ 백업 내려받기 (JSON)</button><label class="chip" style="cursor:pointer">⬆ 가져오기<input type="file" accept=".json,application/json" data-arcimp hidden></label><span class="briefDim">백업은 전체 기록 + 본문 · 가져오기는 같은 id면 덮어써요</span></div>';
  return h;
}
function arcBind(root, rerender) {
  Array.prototype.forEach.call(root.querySelectorAll("[data-arcf]"), function (b) { b.onclick = function () { ARC_UI.f = b.getAttribute("data-arcf"); rerender(); }; });
  var sel = root.querySelector(".arcSym"); if (sel) sel.onchange = function () { ARC_UI.sym = sel.value; rerender(); };
  Array.prototype.forEach.call(root.querySelectorAll("[data-arccp]"), function (b) { b.onclick = function (e) { e.stopPropagation(); arcText(b.getAttribute("data-arccp")).then(function (t) { if (typeof anCopy === "function") anCopy(t, b); }); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-arcdel]"), function (b) { b.onclick = function (e) { e.stopPropagation(); if (!confirm("이 기록을 지울까요? (서버에서도 지워져요)")) return; arcDel(b.getAttribute("data-arcdel")).then(rerender); rerender(); }; });
  var ex = root.querySelector("[data-arcexp]"); if (ex) ex.onclick = function () { Promise.all(arcItems().map(function (x) { return arcText(x.id).then(function (t) { return Object.assign({}, x, { text: t }); }); })).then(function (all) { var blob = new Blob([JSON.stringify({ v: 1, exported: new Date().toISOString(), items: all }, null, 1)], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "StockMind_분석자산_" + new Date().toISOString().slice(0, 10) + ".json"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }); };
  var im = root.querySelector("[data-arcimp]"); if (im) im.onchange = function () { var f = im.files && im.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { try { var j = JSON.parse(fr.result), items = Array.isArray(j) ? j : j.items || []; if (!items.length) throw new Error("기록이 없어요"); arcApi({ act: "import", items: items }).then(function (r) { if (!r || !r.ok) throw new Error(r && r.reason || "가져오기 실패"); alert(r.items.length + "건을 가져왔어요."); arcLoad(true).then(rerender); }).catch(function (e) { alert(e.message); }); } catch (e) { alert("파일을 읽지 못했어요: " + e.message); } }; fr.readAsText(f); };
}

/* ============================================================ 재사용 ③ 보정: 적중률이 낮은 체크리스트 항목 찾기 → 규칙 가중치·프롬프트에 반영 ============================================================ */
var ARC_CAL = { min: 5, low: 0.45, high: 0.65, data: null, at: 0 };
function arcHitOf(st, v) { var ex = arcExpect(st); if (!v || v.hit == null) return null; return ex > 0 ? v.since > 0.03 : ex < 0 ? v.since < -0.03 : Math.abs(v.since) <= 0.1; }
function arcCalib(pairs) {   // pairs = [{it, v}] (검증 가능한 것만 의미 있음)
  var rule = {}, ai = {}, mods = typeof AN_MODS !== "undefined" ? AN_MODS : [];
  pairs.forEach(function (x) {
    var it = x.it, v = x.v; if (!v || v.hit == null || !it.mod) return; var m = mods.filter(function (z) { return z.id === it.mod; })[0];
    // 앱 규칙 체크(저장 시점 판정)
    if (it.snap && Array.isArray(it.snap.ck)) it.snap.ck.forEach(function (st, i) { if (st === "na") return; var h = arcHitOf(st, v); if (h == null) return; var k = it.mod + ":" + i, o = rule[k] = rule[k] || { mod: it.mod, idx: i, name: m && m.ck[i] || ("항목 " + (i + 1)), n: 0, hit: 0, okN: 0, okHit: 0, badN: 0, badHit: 0 }; o.n++; if (h) o.hit++; if (st === "ok") { o.okN++; if (h) o.okHit++; } if (st === "bad") { o.badN++; if (h) o.badHit++; } });
    // AI 항목 판정
    ((it.p && it.p.items) || []).forEach(function (z) { var h = arcHitOf(z.st, v); if (h == null) return; var k = it.mod + ":" + z.name, o = ai[k] = ai[k] || { mod: it.mod, name: z.name, n: 0, hit: 0 }; o.n++; if (h) o.hit++; });
  });
  function fin(o) { o.acc = o.n ? o.hit / o.n : null; o.grade = o.n < ARC_CAL.min ? "few" : o.acc < ARC_CAL.low ? "low" : o.acc >= ARC_CAL.high ? "high" : "mid"; o.w = o.grade === "low" ? 0.5 : o.grade === "high" ? 1.25 : 1; return o; }
  var R = { rule: Object.keys(rule).map(function (k) { return fin(rule[k]); }), ai: Object.keys(ai).map(function (k) { return fin(ai[k]); }), n: pairs.filter(function (x) { return x.v && x.v.hit != null; }).length };
  R.rule.sort(function (a, b) { return (a.acc == null) - (b.acc == null) || a.acc - b.acc || b.n - a.n; }); R.ai.sort(function (a, b) { return (a.acc == null) - (b.acc == null) || a.acc - b.acc || b.n - a.n; });
  ARC_CAL.data = R; ARC_CAL.at = Date.now(); return R;
}
function arcTrust(mod, idx) { var R = ARC_CAL.data; if (!R) return null; return R.rule.filter(function (o) { return o.mod === mod && o.idx === idx; })[0] || null; }
/* 보정 적용: 신뢰 낮은 항목의 ✓/✗ 판정을 △로 낮추고(보수적), 가중 종합 점수 */
function arcApplyCalib(mod, cks) {
  var score = 0, wsum = 0, notes = [];
  var out = cks.map(function (c, i) { var t = arcTrust(mod, i), st = c.st, w = t ? t.w : 1; if (t && t.grade === "low" && (st === "ok" || st === "bad")) { st = "mid"; notes.push(c.t + " — 기록상 적중률 " + Math.round(t.acc * 100) + "%(" + t.n + "건)라 △로 낮춤"); } if (st !== "na") { score += (st === "ok" ? 1 : st === "bad" ? -1 : 0) * w; wsum += w; } return Object.assign({}, c, { st: st, raw: c.st, trust: t }); });
  var v = wsum ? score / wsum : 0, verdict = v >= 0.34 ? "ok" : v <= -0.34 ? "bad" : "mid";
  return { ck: out, verdict: verdict, v: v, notes: notes };
}
function arcCalibLines(mod) {   // 프롬프트에 붙일 보정 메모
  var R = ARC_CAL.data; if (!R) return [];
  var L = [];
  R.rule.filter(function (o) { return o.mod === mod && o.grade !== "few"; }).forEach(function (o) { L.push("- 앱 규칙 '" + o.name + "' 판정은 내 기록상 적중률 " + Math.round(o.acc * 100) + "%(" + o.n + "건) — " + (o.grade === "low" ? "신뢰 낮음: 이 항목은 더 깐깐하게 다른 근거로 재검토해줘" : o.grade === "high" ? "신뢰 높음" : "보통")); });
  R.ai.filter(function (o) { return o.mod === mod && o.grade !== "few"; }).forEach(function (o) { L.push("- AI 항목 '" + o.name + "' 판정의 과거 적중률 " + Math.round(o.acc * 100) + "%(" + o.n + "건)" + (o.grade === "low" ? " — 이 항목에서 과신했던 적이 많아. 반대 근거를 먼저 찾아줘" : "")); });
  return L.length ? ["[보정 메모 — 내 기록으로 계산한 항목별 적중률]"].concat(L) : [];
}
function arcCalibHtml() {
  var R = ARC_CAL.data, mods = typeof AN_MODS !== "undefined" ? AN_MODS : [];
  if (!R || !R.n) return '<div class="briefDim">검증된 기록이 아직 없어요. 종목 기록이 20일 이상 지나면 자동으로 계산돼요.</div>';
  var mn = function (id) { var m = mods.filter(function (z) { return z.id === id; })[0]; return m ? m.t : id; }, g = { low: "낮음", mid: "보통", high: "높음", few: "표본 부족" };
  function row(o, kind) { return '<div class="arcCal ' + o.grade + '"><span class="arcCalG">' + (o.grade === "few" ? (ARC_CAL.min - o.n) + "건 더" : Math.round(o.acc * 100) + "%") + '</span><div><b>' + arcEsc(o.name) + '</b><small>' + arcEsc(mn(o.mod)) + ' · ' + kind + ' · ' + o.hit + '/' + o.n + ' 적중 · 신뢰 ' + g[o.grade] + (kind === "앱 규칙" && o.grade !== "few" ? ' · 가중치 ×' + o.w + (o.grade === "low" ? " · ✓/✗ → △로 낮춤" : "") : "") + '</small></div></div>'; }
  var low = R.rule.filter(function (o) { return o.grade === "low"; }).concat(R.ai.filter(function (o) { return o.grade === "low"; }));
  var h = '<div class="arcCalHead">' + (low.length ? '<b class="rbWarn">⚠ 적중률 낮은 항목 ' + low.length + '개</b> — 앱 평가에서 △로 낮추고 가중치 ½, 프롬프트에 "더 깐깐하게" 메모가 들어가요.' : '<b style="color:#2e7d4f">적중률 낮은 항목 없음</b> (검증 ' + R.n + '건 · 기준: ' + ARC_CAL.min + '건 이상, ' + Math.round(ARC_CAL.low * 100) + '% 미만)') + '</div>';
  h += '<div class="arcCalGrid"><div><div class="anSubH">앱 규칙 체크 <small>저장 시점 ✓/△/✗ vs 이후 가격</small></div>' + (R.rule.length ? R.rule.map(function (o) { return row(o, "앱 규칙"); }).join("") : '<div class="briefDim">없음</div>') + '</div><div><div class="anSubH">AI 항목 판정 <small>카드형 항목 ✓/△/✗ vs 이후 가격</small></div>' + (R.ai.length ? R.ai.map(function (o) { return row(o, "AI 판정"); }).join("") : '<div class="briefDim">없음</div>') + '</div></div>';
  return h;
}
