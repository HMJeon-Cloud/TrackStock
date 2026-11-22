/* ============================================================ v16.10 그래프 공통 규칙
   화면마다 조금씩 다르던 그래프를 한 가지 말투로 맞춘다(Chart.js로 그리는 화면 그래프 전부: 가격 · 기술 지표 · 비교 · 시뮬레이션 · 보유 추이).
   - 축 글자 · 눈금선 · 말풍선 · 범례 모양을 한 곳에서 정한다(각 그래프가 따로 적어 둔 값보다 우선).
   - 여러 선을 그릴 때 색 순서: 먹 → 금 → 청록 → 보라 → 주황 → 회색 → 분홍 → 초록. 빨강 · 파랑은 '올랐다 · 내렸다'에만 쓰려고 뺐다.
   - PDF 덱 · 카드는 Chart.js를 쓰지 않으므로 영향이 없다.
   ============================================================ */
var SM_PAL = ["#14161c", "#b8892f", "#0f8f8a", "#6b5bd2", "#d9822b", "#7a8494", "#c2578f", "#3f8f4f"];
(function () {
  try { if (typeof CMP_COLORS !== "undefined") CMP_COLORS = SM_PAL.slice(); } catch (e) {}
  if (typeof Chart === "undefined" || !Chart.defaults) return;
  var FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  var INK = "#14161c", SUB = "#667080", GRID = "#eceef1";
  try {
    Chart.defaults.font.family = FONT; Chart.defaults.font.size = 11.5; Chart.defaults.color = SUB;
    Chart.defaults.animation = Chart.defaults.animation === false ? false : Object.assign({}, Chart.defaults.animation, { duration: 220 });
  } catch (e) {}
  function theme(chart) {
    var o = chart.options; if (!o) return;
    var sc = o.scales || {};
    Object.keys(sc).forEach(function (k) {
      var s = sc[k]; if (!s || s.display === false) return;
      try { if (s.ticks) { if (typeof s.ticks.color !== "function") s.ticks.color = SUB; s.ticks.font = Object.assign({}, s.ticks.font, { size: 11.5, family: FONT }); }
        if (s.grid && typeof s.grid.color !== "function" && s.grid.display !== false) s.grid.color = GRID;
        if (s.border) s.border.display = false;
        if (s.title && s.title.display) { s.title.color = SUB; s.title.font = Object.assign({}, s.title.font, { size: 11.5, family: FONT }); } } catch (e) {}
    });
    var pl = o.plugins || {}, tt = pl.tooltip, lg = pl.legend;
    try { if (tt && !tt.external) { tt.backgroundColor = INK; tt.titleColor = "#ffffff"; tt.bodyColor = "#e9ecf1"; tt.footerColor = "#c9ced8"; tt.borderWidth = 0; tt.padding = 10; tt.cornerRadius = 8; tt.caretSize = 5; tt.boxWidth = 8; tt.boxHeight = 8; tt.boxPadding = 4; tt.usePointStyle = true; tt.titleFont = { family: FONT, size: 12, weight: "700" }; tt.bodyFont = { family: FONT, size: 12.5 }; tt.titleMarginBottom = 6; } } catch (e) {}
    try { if (lg && lg.labels) { lg.labels.usePointStyle = true; lg.labels.boxWidth = 8; lg.labels.boxHeight = 8; lg.labels.padding = 12; lg.labels.color = "#3d4452"; lg.labels.font = { family: FONT, size: 12 }; } } catch (e) {}
  }
  try { Chart.register({ id: "smTheme", beforeInit: theme, beforeUpdate: theme }); } catch (e) {}
})();
