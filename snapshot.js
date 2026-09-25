/* ============================================================
   표·그래프 이미지 저장 (v5.3)
   - 모든 표(.tableWrap)와 그래프(.chartWrap) 아래에 "📷 이미지 저장" 버튼을 단다.
   - 그래프: 화면 크기와 무관하게 넓은 크기(960×540)로 다시 그려서 저장한다.
     지금 보고 있는 기간(확대·이동한 범위)과 켜 둔 선들은 그대로 유지된다.
   - 표: 화면에서 스크롤로 잘려 있던 행·열, "+N건"으로 접힌 사건까지 전부 펼쳐서 저장한다.
   - 결과는 미리보기 창으로 띄우고 [저장] [공유] 버튼 + "길게 눌러 저장" 안내를 준다.
     (카카오톡·스레드 같은 앱 안 브라우저는 다운로드가 막혀 있는 경우가 많다)
   ============================================================ */
(function () {
  var SITE = "track-stock-tau.vercel.app";
  var FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  var H2C_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

  /* ---------- 스타일 ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".snapRow{display:flex;justify-content:flex-end;margin:6px 0 2px}" +
    ".snapBtn{background:none;border:none;padding:4px 2px;font-size:12px;font-weight:600;color:var(--sub,#8b95a1);cursor:pointer;font-family:inherit}" +
    ".snapBtn:hover{color:var(--accent,#3182f6)}" +
    ".snapBtn[disabled]{opacity:.5;cursor:wait}" +
    /* 캡처용 임시 상자: 화면 밖에 두고 잘림 요소를 전부 푼다 */
    ".snapBox{position:absolute;left:-30000px;top:0;background:#fff;padding:28px 28px 22px;box-sizing:border-box;font-family:" + FONT + ";color:#191f28}" +
    ".snapBox .snapTitle{font-size:20px;font-weight:800;line-height:1.35}" +
    ".snapBox .snapSub{font-size:13px;color:#4e5968;margin-top:4px;line-height:1.5}" +
    ".snapBox .snapFoot{margin-top:14px;padding-top:10px;border-top:1px solid #e5e8eb;font-size:11px;color:#8b95a1;display:flex;justify-content:space-between;gap:12px}" +
    ".snapBox .snapFoot b{color:#3182f6}" +
    ".snapBox .snapCard{margin:14px 0 0!important;padding:0!important;box-shadow:none!important;border:none!important;background:#fff!important}" +
    ".snapBox .tableWrap{max-height:none!important;overflow:visible!important}" +
    ".snapBox th,.snapBox td{position:static!important}" +
    ".snapBox .snapRow,.snapBox .infoBtn{display:none!important}" +
    ".snapPrev{text-align:center}" +
    ".snapPrev img{max-width:100%;max-height:60vh;border:1px solid var(--line,#e5e8eb);border-radius:12px;background:#fff}" +
    ".snapPrev .snapBtns{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}" +
    ".snapPrev .snapHint{font-size:12px;color:var(--sub,#8b95a1);margin-top:10px;line-height:1.6}";
  document.head.appendChild(css);

  /* ---------- 공통 도우미 ---------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
  }
  function cardOf(el) { return el.closest(".card"); }

  /* 표·그래프 바로 위의 제목(h2/h3)을 찾는다 */
  function headingOf(el) {
    var card = cardOf(el), n = el;
    while (n && n !== card) {
      var p = n.previousElementSibling;
      while (p) {
        if (/^H[23]$/.test(p.tagName)) return p;
        if (p.tagName !== "DETAILS" && !p.classList.contains("popSrc") && p.querySelectorAll) {
          var hs = p.querySelectorAll("h2, h3");
          if (hs.length) return hs[hs.length - 1];
        }
        p = p.previousElementSibling;
      }
      n = n.parentNode;
    }
    return card ? card.querySelector("h2") : null;
  }
  function headingText(h) {
    if (!h) return { main: "StockMind", small: "" };
    var c = h.cloneNode(true);
    c.querySelectorAll("button, .infoBtn").forEach(function (b) { b.remove(); });
    var sm = c.querySelector("small"), small = sm ? sm.textContent.trim() : "";
    if (sm) sm.remove();
    return { main: c.textContent.replace(/\s+/g, " ").trim(), small: small };
  }

  /* 이미지 제목·부제 결정 */
  function describe(el) {
    var h = headingOf(el), t = headingText(h);
    var ctx = "";
    // 종목 탭 안의 표·그래프는 어떤 종목인지 함께 적는다 (가격 차트 제목에는 이미 들어 있음)
    if (el.closest("#tab-single") && h && h.id !== "chartTitle" && typeof state !== "undefined" && state.symbol) {
      var nm = (state.meta && (state.meta.shortName || state.meta.longName)) || state.symbol;
      ctx = nm + " (" + state.symbol + ")";
    }
    var sub = [ctx, t.small].filter(Boolean).join(" · ");
    return { title: t.main || "StockMind", sub: sub };
  }

  function loadScript(url) {
    return new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = url; s.onload = ok; s.onerror = function () { fail(new Error("load")); };
      document.head.appendChild(s);
    });
  }
  var h2cReady = null;
  function needH2C() {
    if (window.html2canvas) return Promise.resolve();
    if (!h2cReady) h2cReady = loadScript(H2C_URL).catch(function (e) { h2cReady = null; throw e; });
    return h2cReady;
  }

  /* 옵션 객체 깊은 복사 (함수는 그대로 둔다 — 색상 콜백 등) */
  function cloneOpts(o, depth) {
    if (depth > 12 || o === null || typeof o !== "object") return o;
    if (Array.isArray(o)) return o.map(function (v) { return cloneOpts(v, depth + 1); });
    var proto = Object.getPrototypeOf(o);
    if (proto !== Object.prototype && proto !== null) return o;
    var r = {};
    Object.keys(o).forEach(function (k) { r[k] = cloneOpts(o[k], depth + 1); });
    return r;
  }

  /* ---------- 그래프 → 이미지 ---------- */
  function chartImage(wrap, info) {
    var live = window.Chart && Chart.getChart(wrap.querySelector("canvas"));
    if (!live) return Promise.reject(new Error("NO_CHART"));
    var W = 960, H = 540, DPR = 2;
    var chartCanvas = null, holder = null, tmp = null;
    try {
      holder = document.createElement("div");
      holder.style.cssText = "position:absolute;left:-30000px;top:0;width:" + W + "px;height:" + H + "px";
      var cv = document.createElement("canvas");
      cv.width = W; cv.height = H; cv.style.width = W + "px"; cv.style.height = H + "px";
      holder.appendChild(cv); document.body.appendChild(holder);
      var src = live.config;
      var data = {
        labels: (src.data.labels || []).slice(),
        datasets: src.data.datasets.map(function (d, i) {
          return Object.assign({}, d, {
            data: Array.isArray(d.data) ? d.data.slice() : d.data,
            hidden: !live.isDatasetVisible(i)
          });
        })
      };
      var opts = cloneOpts(src.options || {}, 0);
      opts.responsive = false; opts.maintainAspectRatio = false;
      opts.animation = false; opts.devicePixelRatio = DPR;
      opts.events = [];
      opts.plugins = opts.plugins || {};
      opts.plugins.zoom = false;
      opts.plugins.tooltip = Object.assign({}, opts.plugins.tooltip, { enabled: false });
      // 화면에서 보고 있던 범위(확대·이동 결과)를 그대로
      opts.scales = opts.scales || {};
      Object.keys(live.scales || {}).forEach(function (id) {
        var sc = live.scales[id];
        if (!opts.scales[id]) opts.scales[id] = {};
        if (sc.axis === "x") { opts.scales[id].min = sc.min; opts.scales[id].max = sc.max; }
      });
      tmp = new Chart(cv.getContext("2d"), { type: src.type, data: data, options: opts, plugins: (src.plugins || []).slice() });
      tmp.update("none");
      chartCanvas = cv;
    } catch (e) {
      console.warn("snapshot: 넓게 다시 그리기 실패, 화면 그대로 저장", e);
      chartCanvas = live.canvas;
    }

    // 제목 + 그래프 + 하단 표기를 하나의 그림으로
    var S = 2, PAD = 28 * S, cw = chartCanvas.width, ch = chartCanvas.height;
    var out = document.createElement("canvas"), g = out.getContext("2d");
    var titleH = 28 * S, subH = info.sub ? 20 * S : 0, footH = 34 * S;
    // 부제가 길면 줄바꿈
    g.font = (13 * S) + "px " + FONT;
    var subLines = wrapText(g, info.sub, cw);
    subH = subLines.length * 20 * S;
    out.width = cw + PAD * 2;
    out.height = PAD + titleH + subH + 14 * S + ch + footH + PAD * 0.6;
    g.fillStyle = "#fff"; g.fillRect(0, 0, out.width, out.height);
    var y = PAD;
    g.fillStyle = "#191f28"; g.textBaseline = "top";
    g.font = "800 " + (20 * S) + "px " + FONT;
    wrapText(g, info.title, cw).slice(0, 1).forEach(function (l) { g.fillText(l, PAD, y); });
    y += titleH;
    g.fillStyle = "#4e5968"; g.font = (13 * S) + "px " + FONT;
    subLines.forEach(function (l) { g.fillText(l, PAD, y); y += 20 * S; });
    y += 14 * S;
    g.drawImage(chartCanvas, PAD, y, cw, ch);
    y += ch + 12 * S;
    g.strokeStyle = "#e5e8eb"; g.lineWidth = S; g.beginPath(); g.moveTo(PAD, y); g.lineTo(PAD + cw, y); g.stroke();
    y += 10 * S;
    footer(g, PAD, y, cw, S);

    if (tmp) try { tmp.destroy(); } catch (e) {}
    if (holder) holder.remove();
    return Promise.resolve(out);
  }

  function wrapText(g, text, maxW) {
    if (!text) return [];
    var lines = [], line = "";
    for (var i = 0; i < text.length; i++) {
      var t = line + text[i];
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = text[i]; }
      else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function footer(g, x, y, w, S) {
    g.font = (11 * S) + "px " + FONT; g.textBaseline = "top";
    g.fillStyle = "#3182f6"; g.font = "700 " + (11 * S) + "px " + FONT;
    g.fillText("StockMind", x, y);
    var bw = g.measureText("StockMind ").width;
    g.fillStyle = "#8b95a1"; g.font = (11 * S) + "px " + FONT;
    g.fillText("· " + SITE, x + bw, y);
    var r = today() + " 저장 · 과거 데이터이며 투자 조언이 아닙니다";
    g.fillText(r, x + w - g.measureText(r).width, y);
  }

  /* ---------- 표 → 이미지 ---------- */
  function tableImage(wrap, info) {
    return needH2C().then(function () {
      var box = document.createElement("div");
      box.className = "snapBox";
      var head = document.createElement("div");
      head.innerHTML = '<div class="snapTitle"></div>' + (info.sub ? '<div class="snapSub"></div>' : "");
      head.querySelector(".snapTitle").textContent = info.title;
      if (info.sub) head.querySelector(".snapSub").textContent = info.sub;
      box.appendChild(head);
      var card = document.createElement("div");
      card.className = "card snapCard";
      var tw = wrap.cloneNode(true);
      // "+N건"으로 접힌 사건 펼치기
      tw.querySelectorAll(".evtMore").forEach(function (m) {
        if (m.dataset.more) { var s = document.createElement("span"); s.innerHTML = decodeURIComponent(m.dataset.more); m.replaceWith.apply(m, Array.prototype.slice.call(s.childNodes)); }
      });
      // 입력칸은 지금 값 그대로 보이게
      var liveIn = wrap.querySelectorAll("input, select"), cloneIn = tw.querySelectorAll("input, select");
      cloneIn.forEach(function (c, i) {
        var l = liveIn[i]; if (!l) return;
        if (c.tagName === "SELECT") { if (c.options[l.selectedIndex]) c.options[l.selectedIndex].setAttribute("selected", ""); }
        else if (l.type === "checkbox" || l.type === "radio") { if (l.checked) c.setAttribute("checked", ""); }
        else c.setAttribute("value", l.value);
      });
      card.appendChild(tw); box.appendChild(card);
      var foot = document.createElement("div");
      foot.className = "snapFoot";
      foot.innerHTML = "<span><b>StockMind</b> · " + SITE + "</span><span>" + today() + " 저장 · 과거 데이터이며 투자 조언이 아닙니다</span>";
      box.appendChild(foot);

      // 폭: 표가 잘리지 않는 가장 좁은 폭 (너무 넓으면 1400px에서 줄바꿈)
      box.style.width = "max-content";
      box.style.minWidth = "560px";
      box.style.maxWidth = "1400px";
      document.body.appendChild(box);
      var tbl = tw.querySelector("table");
      var need = Math.max(box.offsetWidth, (tbl ? tbl.scrollWidth : 0) + 56);
      box.style.width = Math.min(Math.max(need, 560), 1400) + "px";
      box.style.maxWidth = "none";
      var w = box.offsetWidth, h = box.offsetHeight;
      // 캔버스 한계(iOS 약 1,670만 픽셀·한 변 32,000px)를 넘지 않게 배율 조정
      var scale = Math.min(2, Math.sqrt(16000000 / (w * h)), 32000 / h, 32000 / w);
      return html2canvas(box, {
        scale: scale, backgroundColor: "#ffffff", logging: false, useCORS: true,
        width: w, height: h, windowWidth: document.documentElement.clientWidth,
        scrollX: 0, scrollY: -window.scrollY
      }).then(function (c) { box.remove(); return c; }, function (e) { box.remove(); throw e; });
    });
  }

  /* ---------- 결과 보여주기·저장 ---------- */
  function fileName(info) {
    var base = (info.sub ? info.sub.split(" · ")[0] + "_" : "") + info.title;
    base = base.replace(/[\\/:*?"<>|()]/g, " ").replace(/\s+/g, "_").slice(0, 60);
    return "StockMind_" + base + "_" + today().replace(/\./g, "") + ".png";
  }
  function showResult(canvas, info) {
    var url = canvas.toDataURL("image/png");
    var name = fileName(info);
    var box = document.createElement("div");
    box.className = "snapPrev";
    box.innerHTML = '<img alt="">' +
      '<div class="snapBtns"><button class="primary" data-act="save">⬇ 이미지 저장</button></div>' +
      '<div class="snapHint">저장이 안 되면 이미지를 <b>길게 눌러</b> \'이미지 저장\'을 선택하세요.</div>';
    box.querySelector("img").src = url;
    box.querySelector('[data-act="save"]').onclick = function () {
      var a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
    };
    // 휴대폰: 공유 시트(카톡·인스타·사진 저장)로 바로 보내기
    if (navigator.canShare && canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var file = new File([blob], name, { type: "image/png" });
        if (!navigator.canShare({ files: [file] })) return;
        var b = document.createElement("button");
        b.className = "chip"; b.textContent = "↗ 공유하기";
        b.onclick = function () { navigator.share({ files: [file], title: info.title }).catch(function () {}); };
        box.querySelector(".snapBtns").appendChild(b);
      }, "image/png");
    }
    infoModal.open("📷 " + info.title, box);
  }

  function snap(wrap, btn) {
    var isChart = wrap.classList.contains("chartWrap");
    if (!isChart) {
      var t = wrap.querySelector("table");
      if (!t || !t.rows.length) { alert("먼저 표에 내용이 나오도록 조회해 주세요."); return; }
    } else if (!(window.Chart && Chart.getChart(wrap.querySelector("canvas")))) {
      alert("먼저 그래프가 나오도록 조회해 주세요."); return;
    }
    var info = describe(wrap);
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = "만드는 중…";
    (isChart ? chartImage(wrap, info) : tableImage(wrap, info))
      .then(function (c) { showResult(c, info); })
      .catch(function (e) {
        console.warn("snapshot 실패", e);
        alert(e && e.message === "load"
          ? "이미지 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."
          : "이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
      })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  }

  /* ---------- 버튼 달기 ---------- */
  function attach() {
    document.querySelectorAll(".chartWrap, .tableWrap").forEach(function (w) {
      if (w.dataset.snap || w.closest(".modalWrap, .popSrc, .snapBox")) return;
      w.dataset.snap = "1";
      var row = document.createElement("div");
      row.className = "snapRow";
      var b = document.createElement("button");
      b.type = "button"; b.className = "snapBtn";
      b.textContent = "📷 이미지 저장";
      b.onclick = function () { snap(w, b); };
      row.appendChild(b);
      w.parentNode.insertBefore(row, w.nextSibling);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
  else attach();
  window.snapAttach = attach;
})();
