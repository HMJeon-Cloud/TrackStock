/* ============================================================
   리밸런싱 계산기 (v11.5) — 내 자산 탭 '리밸런싱' · 공개(로그인 없음)
   보유 금액 + 목표 비중 + 이번 달 추가 매수액 → 어디에 얼마를 넣을지
     ① 사기만 (기본): 팔지 않고 새 돈으로만 맞춘다 — 가장 모자란 자산부터 채움(물 채우기 방식)
     ② 팔기 포함: 오늘 바로 목표 비중으로 (사고팔 금액)
   1주 가격을 넣으면 몇 주인지, 남는 돈까지. 목표 근처까지 사기만으로 몇 달 걸리는지(가격이 그대로라면).
   저장: 이 브라우저(localStorage "sm.rebal")에만 — 서버로 보내지 않음 · 클라우드 동기화에도 넣지 않음
   ============================================================ */
var RB_KEY = "sm.rebal";
var RB_PRESETS = [
  { id: "6040", t: "주식 60 · 채권 40", a: [["미국 주식 (S&P500)", 40], ["한국 주식 (코스피200)", 20], ["채권", 40]] },
  { id: "aw", t: "올웨더 간단형", a: [["주식", 30], ["장기채", 40], ["중기채", 15], ["금", 7.5], ["원자재", 7.5]] },
  { id: "3way", t: "미국 · 한국 · 채권 · 금", a: [["미국 주식", 40], ["한국 주식", 20], ["채권", 30], ["금", 10]] },
  { id: "div", t: "배당 · 성장", a: [["미국 배당 ETF (SCHD)", 40], ["나스닥100", 30], ["채권", 20], ["현금성(파킹)", 10]] }
];
var RB = (function () {
  var d = null; try { d = JSON.parse(localStorage.getItem(RB_KEY) || "null"); } catch (e) {}
  if (!d || !Array.isArray(d.a)) d = { a: [{ n: "미국 주식", v: 6000000, w: 40, p: null }, { n: "한국 주식", v: 2500000, w: 20, p: null }, { n: "채권", v: 2000000, w: 30, p: null }, { n: "금", v: 500000, w: 10, p: null }], add: 1000000, mode: "buy", band: 5, sample: true };
  return d;
})();
function rbSave() { try { localStorage.setItem(RB_KEY, JSON.stringify({ a: RB.a, add: RB.add, mode: RB.mode, band: RB.band, sample: RB.sample, at: new Date().toISOString() })); } catch (e) {} }
function rbEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function rbNum(s) { var v = parseFloat(String(s == null ? "" : s).replace(/[^\d.\-]/g, "")); return isFinite(v) ? v : 0; }
function rbWon(v) { return (v < 0 ? "-" : "") + Math.round(Math.abs(v)).toLocaleString("ko-KR") + "원"; }
function rbKo(v) {   // 3만 7,500원 · 1억 2,000만원 (만 원 아래도 버리지 않음)
  var neg = v < 0, n = Math.round(Math.abs(v)); if (n < 10000) return rbWon(v);
  var eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), rest = n % 1e4, out = [];
  if (eok) out.push(eok.toLocaleString("ko-KR") + "억"); if (man) out.push(man.toLocaleString("ko-KR") + "만"); if (rest) out.push(rest.toLocaleString("ko-KR"));
  return (neg ? "-" : "") + out.join(" ") + "원";
}
function rbPctTxt(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + "%"; }
function rbComma(v) { return v ? Math.round(v).toLocaleString("ko-KR") : ""; }

/* ================= 순수 계산 (테스트 대상) ================= */
/* 사기만: 매수 뒤 금액이 목표 비중 × L 에 못 미치는 자산만 채운다. L은 합이 A가 되도록 이분 탐색
   → 가장 많이 모자란 자산부터 채워지고, 다 채우고 남으면 목표 비중대로 나눈다 */
function rbBuyOnly(v, w, A) {
  var n = v.length, V = v.reduce(function (s, x) { return s + x; }, 0), x = new Array(n).fill(0);
  if (!(A > 0)) return x;
  function need(L) { var s = 0; for (var i = 0; i < n; i++) s += Math.max(0, w[i] * L - v[i]); return s; }
  var lo = 0, hi = (V + A) / Math.max(1e-9, Math.min.apply(null, w.filter(function (q) { return q > 0; }).concat([1]))) + A;
  for (var k = 0; k < 100; k++) { var mid = (lo + hi) / 2; if (need(mid) < A) lo = mid; else hi = mid; }
  for (var i = 0; i < n; i++) x[i] = Math.max(0, w[i] * hi - v[i]);
  var s = x.reduce(function (a, b) { return a + b; }, 0); if (s > 0) for (i = 0; i < n; i++) x[i] = x[i] * A / s;   // 반올림 오차 보정
  return x;
}
/* 팔기 포함: 오늘 바로 목표 비중으로 */
function rbFull(v, w, A) { var T = v.reduce(function (s, x) { return s + x; }, 0) + A; return v.map(function (x, i) { return w[i] * T - x; }); }
/* 1주 가격이 있으면 주 단위로 내림 → 남는 돈은 '가장 모자란 자산부터 1주씩' 더 산다 */
function rbShares(v, w, plan, price, A) {
  var n = v.length, q = plan.map(function (x, i) { return price[i] > 0 ? Math.floor(Math.max(0, x) / price[i]) : null; });
  var spent = 0; for (var i = 0; i < n; i++) spent += q[i] != null ? q[i] * price[i] : Math.max(0, plan[i]);
  var left = A - spent, T = v.reduce(function (s, x) { return s + x; }, 0) + A;
  for (var guard = 0; guard < 500; guard++) {
    var best = -1, gap = -Infinity;
    for (i = 0; i < n; i++) { if (q[i] == null || !(price[i] <= left)) continue; var after = v[i] + q[i] * price[i]; var g = w[i] * T - after; if (g > gap) { gap = g; best = i; } }
    if (best < 0 || gap <= 0) break; q[best]++; left -= price[best];
  }
  var amt = q.map(function (k, j) { return k != null ? k * price[j] : Math.max(0, plan[j]); });
  // 1주 가격이 없는 자산(소수점·금액 매수)이 있으면 남은 돈은 그쪽에 — 가장 모자란 곳부터
  var free = []; for (i = 0; i < n; i++) if (q[i] == null) free.push(i);
  if (free.length && left > 0.5) { var add = rbBuyOnly(free.map(function (j) { return v[j] + amt[j]; }), free.map(function (j) { return w[j]; }), left); free.forEach(function (j, k) { amt[j] += add[k]; }); left = 0; }
  return { q: q, left: left, amt: amt };
}
/* 목표와의 차이 (비중 %p) */
function rbDrift(v, w) { var T = v.reduce(function (s, x) { return s + x; }, 0) || 1; return v.map(function (x, i) { return x / T - w[i]; }); }
function rbMaxAbs(a) { return a.reduce(function (m, x) { return Math.max(m, Math.abs(x)); }, 0); }
/* 가격이 그대로일 때, 매달 A씩 사기만 하면 몇 달 뒤 모든 자산이 목표 ±tol 안에 들어오나 (최대 120개월) */
function rbMonths(v, w, A, tol) {
  if (!(A > 0)) return null; var cur = v.slice();
  for (var m = 0; m <= 120; m++) { if (rbMaxAbs(rbDrift(cur, w)) <= tol) return m; var x = rbBuyOnly(cur, w, A); cur = cur.map(function (c, i) { return c + x[i]; }); }
  return null;
}
function rbCalc() {
  var rows = RB.a.filter(function (r) { return (r.n && String(r.n).trim()) || r.v > 0 || r.w > 0; });
  var wsum = rows.reduce(function (s, r) { return s + (r.w || 0); }, 0);
  if (!rows.length || !(wsum > 0)) return { err: "목표 비중을 하나 이상 넣어 주세요." };
  var v = rows.map(function (r) { return Math.max(0, r.v || 0); }), w = rows.map(function (r) { return (r.w || 0) / wsum; }), A = Math.max(0, RB.add || 0), price = rows.map(function (r) { return r.p > 0 ? r.p : 0; });
  var V = v.reduce(function (s, x) { return s + x; }, 0);
  var plan = RB.mode === "full" ? rbFull(v, w, A) : rbBuyOnly(v, w, A);
  var sh = price.some(function (p) { return p > 0; }) ? rbShares(v, w, RB.mode === "full" ? plan.map(function (x) { return Math.max(0, x); }) : plan, price, RB.mode === "full" ? plan.reduce(function (s, x) { return s + Math.max(0, x); }, 0) : A) : null;
  var buy = plan.map(function (x, i) { return RB.mode === "full" && x < 0 ? x : sh ? sh.amt[i] : Math.max(0, x); });
  var after = v.map(function (x, i) { return x + buy[i]; });
  return { rows: rows, v: v, w: w, A: A, V: V, wsum: wsum, plan: plan, sh: sh, buy: buy, after: after, d0: rbDrift(v, w), d1: rbDrift(after, w), months: RB.mode !== "full" ? rbMonths(v, w, A, 0.01) : null };
}

/* ================= 화면 ================= */
function renderRebal() {
  var box = document.getElementById("rbBody"); if (!box) return;
  var h = '<div class="rbTop"><label class="rbAdd">이번 달 추가 매수액<input id="rbAdd" inputmode="numeric" value="' + rbComma(RB.add) + '" placeholder="예: 1,000,000"><span class="moneyHint" id="rbAddHint"></span></label>' +
    '<div class="rbMode pills"><button data-rbm="buy" class="' + (RB.mode !== "full" ? "active" : "") + '">사기만 (팔지 않음)</button><button data-rbm="full" class="' + (RB.mode === "full" ? "active" : "") + '">팔기 포함</button></div></div>';
  h += '<div class="rbPresets"><span class="briefDim">예시 비중</span>' + RB_PRESETS.map(function (p) { return '<button class="chip" data-rbp="' + p.id + '">' + p.t + '</button>'; }).join("") + (typeof loadHoldings === "function" && loadHoldings().lots.length ? '<button class="chip rbImp" data-rbimp="1">📥 내 보유 현황에서 가져오기</button>' : '') + '</div>';
  h += '<div class="rbGrid"><div class="rbHead"><span>자산</span><span>지금 금액(원)</span><span>목표 %</span><span>1주 가격 <small>선택</small></span><span></span></div>' + RB.a.map(function (r, i) {
    return '<div class="rbRow" data-i="' + i + '"><input class="rbN" data-k="n" value="' + rbEsc(r.n || "") + '" placeholder="예: 미국 주식"><input class="rbV" data-k="v" inputmode="numeric" value="' + rbComma(r.v) + '" placeholder="0"><input class="rbW" data-k="w" inputmode="decimal" value="' + (r.w ? r.w : "") + '" placeholder="0"><input class="rbP" data-k="p" inputmode="numeric" value="' + rbComma(r.p) + '" placeholder="-"><button class="rbDel" data-rbdel="' + i + '" title="이 줄 지우기" aria-label="지우기">✕</button></div>';
  }).join("") + '</div><div class="row rbActs"><button class="chip" data-rbaddrow="1">＋ 자산 추가</button><span id="rbWsum" class="briefDim"></span><button class="chip rbClear" data-rbclear="1">비우기</button></div>';
  h += '<div id="rbOut"></div>';
  h += '<details class="howto"><summary>계산 방법 · 주의</summary><div class="body"><ul><li><b>사기만</b> — 파는 건 세금·수수료가 들고 마음도 흔들려요. 그래서 새 돈으로 <b>가장 많이 모자란 자산부터</b> 채워요. 모두 목표에 닿고도 돈이 남으면 목표 비중대로 나눠요.</li><li><b>팔기 포함</b> — 오늘 바로 목표 비중으로 맞추려면 얼마를 사고팔아야 하는지 보여줘요. 해외 주식 매도는 양도세(연 250만원 넘는 이익의 22%), 국내 주식은 거래세가 붙을 수 있어요.</li><li><b>허용 범위</b> — 목표와의 차이가 범위 안이면 굳이 안 맞춰도 된다고 표시해요. 보통 ±5%p를 많이 써요.</li><li><b>1주 가격</b>을 넣으면 몇 주 살 수 있는지와 남는 돈을 계산해요(소수점 매수가 되면 비워 두세요).</li><li>입력한 내용은 <b>이 브라우저에만</b> 저장돼요. 서버로 보내지 않고, 로그인도 필요 없어요. 다른 기기에서는 다시 입력해야 해요.</li><li>계산 도구이며 투자 권유가 아니에요. 목표 비중은 내가 견딜 수 있는 하락 폭부터 정하는 걸 권해요(과거 시뮬레이션 탭에서 비중별 낙폭을 볼 수 있어요).</li></ul></div></details>';
  box.innerHTML = h;
  rbBind(box); rbOut();
}
function rbOut() {
  var out = document.getElementById("rbOut"); if (!out) return;
  var ws = RB.a.reduce(function (s, r) { return s + (r.w || 0); }, 0), wsEl = document.getElementById("rbWsum");
  if (wsEl) { wsEl.innerHTML = "목표 합계 <b class='" + (Math.abs(ws - 100) < 0.01 ? "" : "rbWarn") + "'>" + (+ws.toFixed(2)) + "%</b>" + (Math.abs(ws - 100) < 0.01 || !ws ? "" : " · 100%가 아니어서 비율대로 맞춰 계산해요"); }
  var hint = document.getElementById("rbAddHint"); if (hint) hint.textContent = RB.add >= 10000 ? "(" + rbKo(RB.add) + ")" : "";
  var R = rbCalc(); if (R.err) { out.innerHTML = '<div class="dvEmpty sm">' + R.err + '</div>'; return; }
  var band = (RB.band || 5) / 100, mx0 = rbMaxAbs(R.d0), mx1 = rbMaxAbs(R.d1), inBand = mx0 <= band;
  var order = R.rows.map(function (r, i) { return i; }).sort(function (a, b) { return R.buy[b] - R.buy[a]; });
  var buys = order.filter(function (i) { return R.buy[i] > 0.5; }), sells = order.filter(function (i) { return R.buy[i] < -0.5; }).reverse();
  var nm = function (i) { return R.rows[i].n || ("자산 " + (i + 1)); };
  // 한 줄 결론
  var head;
  if (RB.mode === "full") head = inBand ? "모든 자산이 목표 ±" + RB.band + "%p 안이에요. 이번엔 팔지 않고 그대로 둬도 괜찮아요." : (sells.length ? sells.map(function (i) { return '<b>' + rbEsc(nm(i)) + '</b> ' + rbKo(-R.buy[i]) + ' 팔고'; }).join(", ") + " " : "") + buys.map(function (i) { return '<b>' + rbEsc(nm(i)) + '</b> ' + rbKo(R.buy[i]); }).join(", ") + " 사면 목표 비중이 돼요.";
  else head = !R.A ? "이번 달 추가 매수액을 넣어 주세요." : "이번 달 " + rbKo(R.A) + "은 " + buys.map(function (i) { return '<b>' + rbEsc(nm(i)) + '</b>에 ' + rbKo(R.buy[i]); }).join(", ") + (buys.length > 1 ? "으로 나눠 넣으세요." : " 넣으세요.");
  if (!R.V) { head = R.A ? "처음 시작이면 " + rbKo(R.A) + "을 " + buys.map(function (i) { return '<b>' + rbEsc(nm(i)) + '</b> ' + rbKo(R.buy[i]); }).join(", ") + "으로 나눠 사세요." : "지금 금액이나 이번 달 추가 매수액을 넣어 주세요."; inBand = true; }
  var h = '<div class="rbAns"><div class="rbAnsT">' + head + '</div>' + (!R.V ? '</div>' : '') + (!R.V ? '' : '<div class="rbAnsS">목표와 가장 큰 차이 <b>' + rbPctTxt(mx0) + 'p</b> → ' + (RB.mode === "full" ? "" : "넣고 나면 ") + '<b>' + rbPctTxt(mx1) + 'p</b>' +
    (R.sh && R.sh.left >= 1 ? ' · 1주 단위로 사고 남는 돈 <b>' + rbWon(R.sh.left) + '</b>' : '') +
    (RB.mode !== "full" && R.A ? (R.months === 0 ? " · 이미 목표 ±1%p 안" : R.months != null ? ' · 가격이 그대로면 <b>' + R.months + '개월</b> 뒤 모든 자산이 목표 ±1%p 안' : " · 이 금액으론 10년 안에 목표에 닿기 어려워요 — 팔기 포함도 확인해 보세요") : '') + '</div>' +
    '<div class="rbBand">허용 범위 <select id="rbBand">' + [3, 5, 10].map(function (b) { return '<option value="' + b + '"' + (+RB.band === b ? " selected" : "") + '>±' + b + '%p</option>'; }).join("") + '</select> ' + (inBand ? '<span class="rbOk">지금 범위 안 ✓</span>' : '<span class="rbNo">범위 밖 ' + R.rows.map(function (r, i) { return Math.abs(R.d0[i]) > band ? rbEsc(nm(i)) : null; }).filter(Boolean).join(", ") + '</span>') + '</div></div>');
  // 표 — 휴대폰에서도 '살 금액'이 먼저 보이게 앞쪽에
  var T1 = R.after.reduce(function (s2, x) { return s2 + x; }, 0) || 1;
  h += '<div class="tableWrap"><table class="dvTable rbT"><thead><tr><th class="l">자산</th><th>' + (RB.mode === "full" ? "사고팔 금액" : "이번 달 살 금액") + '</th>' + (R.sh ? '<th>주</th>' : '') + '<th>지금 → ' + (RB.mode === "full" ? "맞춘 뒤" : "산 뒤") + '</th><th>목표</th><th>지금 금액</th></tr></thead><tbody>' + R.rows.map(function (r, i) {
    var cur = R.V ? R.v[i] / R.V : 0, b = R.buy[i];
    return '<tr><td class="l"><b>' + rbEsc(nm(i)) + '</b></td><td class="' + (b > 0.5 ? "pos" : b < -0.5 ? "neg" : "") + '"><b>' + (Math.abs(b) < 0.5 ? "-" : (b > 0 ? "+" : "") + rbComma(b)) + '</b></td>' + (R.sh ? '<td>' + (R.sh.q[i] != null ? R.sh.q[i] + "주" : "-") + '</td>' : '') + '<td><span class="' + (Math.abs(R.d0[i]) > band ? "rbOffT" : "") + '">' + rbPctTxt(cur) + '</span> → ' + rbPctTxt(R.after[i] / T1) + '</td><td>' + rbPctTxt(R.w[i]) + '</td><td>' + rbComma(R.v[i]) + '</td></tr>';
  }).join("") + '<tr class="rbSum"><td class="l">합계</td><td><b>' + (RB.mode === "full" ? "매수 " + rbComma(R.buy.reduce(function (s2, x) { return s2 + Math.max(0, x); }, 0)) : "+" + rbComma(R.buy.reduce(function (s2, x) { return s2 + x; }, 0))) + '</b></td>' + (R.sh ? '<td></td>' : '') + '<td>100%</td><td>100%</td><td>' + rbComma(R.V) + '</td></tr></tbody></table></div>';
  // 막대: 지금 / 산 뒤 / 목표
  var COL = ["#14161c", "#b8913f", "#5b9bb5", "#7fa3d6", "#c9a24f", "#8b95a1", "#2e7d4f", "#d9342b", "#6b5fb5", "#e6c57a"];
  function bar(lab, vals) { var T = vals.reduce(function (s, x) { return s + Math.max(0, x); }, 0) || 1; return '<div class="rbBarR"><span>' + lab + '</span><div class="rbBar">' + vals.map(function (x, i) { var p = Math.max(0, x) / T * 100; return p > 0 ? '<i style="width:' + p.toFixed(2) + '%;background:' + COL[i % COL.length] + '" title="' + rbEsc(nm(i)) + ' ' + p.toFixed(1) + '%">' + (p >= 9 ? p.toFixed(0) + "%" : "") + '</i>' : ''; }).join("") + '</div></div>'; }
  h += '<div class="rbBars">' + bar("지금", R.v) + bar(RB.mode === "full" ? "맞춘 뒤" : "산 뒤", R.after) + bar("목표", R.w) + '<div class="rbLeg">' + R.rows.map(function (r, i) { return '<span><i style="background:' + COL[i % COL.length] + '"></i>' + rbEsc(nm(i)) + '</span>'; }).join("") + '</div></div>';
  if (RB.sample) h += '<p class="mentalNote">지금 보이는 숫자는 <b>예시</b>예요. 내 금액과 비중으로 바꿔 넣으면 바로 다시 계산돼요.</p>';
  out.innerHTML = h;
  var bs = document.getElementById("rbBand"); if (bs) bs.onchange = function () { RB.band = +bs.value; rbSave(); rbOut(); };
}
function rbBind(box) {
  function setRow(el) { var row = el.closest(".rbRow"), i = +row.getAttribute("data-i"), k = el.getAttribute("data-k"), r = RB.a[i]; if (!r) return;
    if (k === "n") r.n = el.value.slice(0, 40); else { r[k] = rbNum(el.value); if (k !== "w") { var pos = el.value.length - (el.selectionStart || 0); el.value = rbComma(r[k]); try { var p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p); } catch (e) {} } }
    RB.sample = false; rbSave(); rbOut(); }
  Array.prototype.forEach.call(box.querySelectorAll(".rbRow input"), function (el) { el.oninput = function () { setRow(el); }; });
  var add = document.getElementById("rbAdd"); add.oninput = function () { RB.add = rbNum(add.value); var pos = add.value.length - (add.selectionStart || 0); add.value = rbComma(RB.add); try { var p = Math.max(0, add.value.length - pos); add.setSelectionRange(p, p); } catch (e) {} RB.sample = false; rbSave(); rbOut(); };
  Array.prototype.forEach.call(box.querySelectorAll("[data-rbm]"), function (b) { b.onclick = function () { RB.mode = b.getAttribute("data-rbm"); rbSave(); renderRebal(); }; });
  Array.prototype.forEach.call(box.querySelectorAll("[data-rbdel]"), function (b) { b.onclick = function () { RB.a.splice(+b.getAttribute("data-rbdel"), 1); if (!RB.a.length) RB.a.push({ n: "", v: 0, w: 0, p: null }); RB.sample = false; rbSave(); renderRebal(); }; });
  box.querySelector("[data-rbaddrow]").onclick = function () { if (RB.a.length >= 15) return; RB.a.push({ n: "", v: 0, w: 0, p: null }); rbSave(); renderRebal(); var L = box.querySelectorAll(".rbN"); if (L.length) L[L.length - 1].focus(); };
  box.querySelector("[data-rbclear]").onclick = function () { if (!confirm("입력한 자산을 모두 지울까요?")) return; RB.a = [{ n: "", v: 0, w: 0, p: null }, { n: "", v: 0, w: 0, p: null }]; RB.sample = false; rbSave(); renderRebal(); };
  Array.prototype.forEach.call(box.querySelectorAll("[data-rbp]"), function (b) { b.onclick = function () {
    var p = RB_PRESETS.filter(function (x) { return x.id === b.getAttribute("data-rbp"); })[0]; if (!p) return;
    var keep = RB.a.filter(function (r) { return r.v > 0; }).length && !RB.sample;
    if (keep && !confirm("자산 이름과 목표 비중을 '" + p.t + "'로 바꿀까요? (입력한 금액은 지워져요)")) return;
    RB.a = p.a.map(function (x) { return { n: x[0], v: 0, w: x[1], p: null }; }); RB.sample = false; rbSave(); renderRebal(); }; });
  var imp = box.querySelector("[data-rbimp]"); if (imp) imp.onclick = function () { rbImport(imp); };
}
/* 내 보유 현황(같은 브라우저 기록)에서 종목별 지금 평가금액을 가져온다 — 목표 비중은 그대로 두거나 지금 비중으로 */
function rbImport(btn) {
  var H = loadHoldings(), groups = groupLots(H.lots), syms = Object.keys(groups); if (!syms.length) return;
  var old = btn.innerHTML; btn.textContent = "시세 불러오는 중…"; btn.disabled = true;
  ensureHoldData(syms).then(function () {
    var fx = hState.fx, fxNow = fx ? fx.rates[fx.rates.length - 1] : null, rows = [];
    syms.forEach(function (s) { var R = hState.series[s] || [], last = R[R.length - 1], pos = positionFromLots(groups[s]); if (!last || !(pos.qty > 0)) return; var krw = isKrwSymbol(s, hState.meta[s]), rate = krw ? 1 : (fxNow || 0); if (!rate) return;
      var nm = (typeof chName === "function" ? chName(s) : (hState.meta[s] && hState.meta[s].shortName) || s); rows.push({ n: nm, v: Math.round(pos.qty * last.c * rate), w: 0, p: Math.round(last.c * rate), s: s }); });
    if (!rows.length) { alert("가져올 보유 종목이 없어요."); return; }
    var T = rows.reduce(function (a, r) { return a + r.v; }, 0);
    var same = RB.sample ? [] : RB.a.filter(function (r) { return r.s || r.n; });
    rows.forEach(function (r) { var o = same.filter(function (x) { return x.s === r.s || x.n === r.n; })[0]; r.w = o && o.w ? o.w : +(r.v / T * 100).toFixed(1); });
    RB.a = rows.sort(function (a, b) { return b.v - a.v; }).slice(0, 15); RB.sample = false; rbSave(); renderRebal();
    var o2 = document.getElementById("rbOut"); if (o2) o2.insertAdjacentHTML("afterbegin", '<p class="mentalNote">보유 현황에서 ' + rows.length + '종목을 가져왔어요. 목표 비중이 없던 종목은 <b>지금 비중</b>으로 채웠으니, 원하는 비중으로 바꿔 주세요. 1주 가격은 최근 종가(원화)예요.</p>');
  }).catch(function () { alert("시세를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요."); }).then(function () { btn.innerHTML = old; btn.disabled = false; });
}
/* 처음 열 때 '리밸런싱'이 마지막으로 보던 화면이면 바로 그린다 (holdings.js가 먼저 읽혀 renderRebal이 아직 없을 수 있음) */
(function () { var c = document.getElementById("rebalCard"); if (c && !c.classList.contains("hidden") && !document.querySelector("#rbBody .rbTop")) renderRebal(); })();
