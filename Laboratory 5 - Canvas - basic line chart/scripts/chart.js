window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("chartCanvas");
  const ctx = canvas.getContext("2d");

  const tooltip = document.getElementById("tooltip");
  const statsContent = document.getElementById("statsContent");

  const toggleBtn = document.getElementById("toggleBtn");
  const resetBtn = document.getElementById("resetBtn");
  const exportBtn = document.getElementById("exportBtn");

  const chartTypeSelect = document.getElementById("chartType");
  const themeSelect = document.getElementById("themeSelect");

  const gridToggle = document.getElementById("gridToggle");
  const smoothToggle = document.getElementById("smoothToggle");

  const speedInput = document.getElementById("speedInput");
  const minInput = document.getElementById("minInput");
  const maxInput = document.getElementById("maxInput");

  const seriesToggles = Array.from(document.querySelectorAll(".seriesToggle"));

  const width = canvas.width;
  const height = canvas.height;

  const xIncrement = 150;
  const yIncrement = 100;
  const valueIncrement = 20;
  const textOffset = 6;

  const pointCount = Math.floor(width / valueIncrement) + 1;

  const state = {
    running: true,
    intervalMs: 1000,
    minVal: 0,
    maxVal: height,
    showGrid: true,
    smooth: false,
    chartType: "line",
    theme: "dark",
    timerId: null,
    mouse: { x: null, y: null, inside: false },
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function parseNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getThemeColors() {
    const styles = getComputedStyle(document.body);
    return {
      bg: styles.getPropertyValue("--panel-2").trim() || "#111",
      grid: styles.getPropertyValue("--grid").trim() || "rgba(255,255,255,0.08)",
      axis: styles.getPropertyValue("--axis").trim() || "rgba(255,255,255,0.16)",
      text: styles.getPropertyValue("--text").trim() || "#fff",
      muted: styles.getPropertyValue("--muted").trim() || "#aaa",
    };
  }

  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function makeRandomGenerator() {
    return () => randBetween(state.minVal, state.maxVal);
  }

  function makeRandomWalkGenerator(start = 0) {
    let current = start;
    return () => {
      const step = randBetween(-60, 60);
      current = clamp(current + step, state.minVal, state.maxVal);
      return current;
    };
  }

  function makeSineGenerator() {
    let t = 0;
    return () => {
      t += 0.25;
      const mid = (state.minVal + state.maxVal) / 2;
      const amp = Math.max(10, (state.maxVal - state.minVal) * 0.35);
      const noise = randBetween(-25, 25);
      return clamp(mid + Math.sin(t) * amp + noise, state.minVal, state.maxVal);
    };
  }

  const series = [
    { name: "Series A", color: "#39d353", data: [], generator: makeRandomGenerator(), visible: true },
    { name: "Series B", color: "#2bd3ff", data: [], generator: makeRandomWalkGenerator(height / 2), visible: true },
    { name: "Series C", color: "#ffb020", data: [], generator: makeSineGenerator(), visible: true },
  ];

  function initSeriesData() {
    series.forEach((s) => {
      s.data = [];
      for (let i = 0; i < pointCount; i++) {
        s.data.push(s.generator());
      }
    });
  }

  function computeMovingAverage(arr, windowSize = 5) {
    const w = Math.max(1, Math.floor(windowSize));
    const out = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let sum = 0;
      let count = 0;
      for (let k = i - w; k <= i + w; k++) {
        if (k >= 0 && k < arr.length) {
          sum += arr[k];
          count++;
        }
      }
      out[i] = sum / count;
    }
    return out;
  }

  function drawBackground(colors) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(colors) {
    if (!state.showGrid) return;

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += xIncrement) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += yIncrement) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
  }

  function drawLabels(colors) {
    if (!state.showGrid) return;

    ctx.fillStyle = colors.muted;
    ctx.font = "12px system-ui, Segoe UI, Arial";
    ctx.textBaseline = "top";

    for (let y = 0; y <= height; y += yIncrement) {
      const value = Math.round(mapYToValue(y));
      ctx.fillText(String(value), textOffset, y + textOffset);
    }

    ctx.textBaseline = "alphabetic";
    for (let x = 0; x <= width; x += xIncrement) {
      ctx.fillText(String(x), x + textOffset, height - textOffset);
    }
  }

  function mapValueToY(v) {
    const min = state.minVal;
    const max = state.maxVal;
    const t = (v - min) / Math.max(1e-6, (max - min));
    return height - t * height;
  }

  function mapYToValue(y) {
    const min = state.minVal;
    const max = state.maxVal;
    const t = 1 - (y / height);
    return min + t * (max - min);
  }

  function getVisibleSeries() {
    return series.filter((s) => s.visible);
  }

  function drawLineSeries(s, values, colors) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();

    ctx.moveTo(0, mapValueToY(values[0]));
    for (let i = 1; i < values.length; i++) {
      const x = i * valueIncrement;
      const y = mapValueToY(values[i]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawAreaSeries(s, values) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;

    ctx.fillStyle = s.color + "33";
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, mapValueToY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(i * valueIncrement, mapValueToY(values[i]));
    }
    ctx.lineTo((values.length - 1) * valueIncrement, height);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, mapValueToY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(i * valueIncrement, mapValueToY(values[i]));
    }
    ctx.stroke();
  }

  function drawScatterSeries(s, values) {
    ctx.fillStyle = s.color;
    for (let i = 0; i < values.length; i++) {
      const x = i * valueIncrement;
      const y = mapValueToY(values[i]);
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBarSeries(visibleSeries) {
    const group = visibleSeries.length || 1;
    const gap = 2;
    const totalWidth = valueIncrement - gap;
    const barW = Math.max(3, Math.floor(totalWidth / group));

    for (let i = 0; i < pointCount; i++) {
      const x0 = i * valueIncrement;

      visibleSeries.forEach((s, idx) => {
        const v = state.smooth ? computeMovingAverage(s.data, 2)[i] : s.data[i];
        const y = mapValueToY(v);
        const x = x0 + gap / 2 + idx * barW;

        ctx.fillStyle = s.color;
        ctx.fillRect(x, y, barW - 1, height - y);
      });
    }
  }

  function drawChart() {
    const colors = getThemeColors();
    drawBackground(colors);
    drawGrid(colors);
    drawLabels(colors);

    const visibleSeries = getVisibleSeries();
    if (visibleSeries.length === 0) return;

    if (state.chartType === "bar") {
      drawBarSeries(visibleSeries);
      return;
    }

    visibleSeries.forEach((s) => {
      const values = state.smooth ? computeMovingAverage(s.data, 2) : s.data;

      if (state.chartType === "line") drawLineSeries(s, values, colors);
      if (state.chartType === "area") drawAreaSeries(s, values);
      if (state.chartType === "scatter") drawScatterSeries(s, values);
    });

    if (state.chartType === "line" || state.chartType === "area") {
      visibleSeries.forEach((s) => {
        ctx.fillStyle = s.color;
        const values = state.smooth ? computeMovingAverage(s.data, 2) : s.data;
        for (let i = 0; i < values.length; i++) {
          const x = i * valueIncrement;
          const y = mapValueToY(values[i]);
          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }

  function updateData() {
    series.forEach((s) => {
      if (s.data.length === 0) return;
      s.data.push(s.generator());
      s.data.shift();
    });
  }

  function computeStatsForSeries(s) {
    const arr = state.smooth ? computeMovingAverage(s.data, 2) : s.data;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
    const current = arr[arr.length - 1];
    const prev = arr[arr.length - 2] ?? current;
    const trend = current > prev ? "Rising ▲" : (current < prev ? "Falling ▼" : "Stable •");

    return {
      current,
      min,
      max,
      avg,
      trend,
    };
  }

  function renderStatsPanel() {
    const visible = getVisibleSeries();
    if (visible.length === 0) {
      statsContent.innerHTML = `<div class="row">Enable at least one series.</div>`;
      return;
    }

    const rows = visible.map((s) => {
      const st = computeStatsForSeries(s);
      return `
        <div class="row">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div><strong>${s.name}</strong> <span style="opacity:.85">(color)</span></div>
            <span style="font-weight:700; color:${s.color}">${st.trend}</span>
          </div>
          <div style="margin-top:8px; display:grid; gap:6px;">
            <div><strong>Current</strong> ${Math.round(st.current)}</div>
            <div><strong>Min</strong> ${Math.round(st.min)} &nbsp; <strong>Max</strong> ${Math.round(st.max)}</div>
            <div><strong>Average</strong> ${st.avg.toFixed(2)}</div>
          </div>
        </div>
      `;
    }).join("");

    statsContent.innerHTML = rows;
  }

  function findNearestPoint(mx, my) {
    const visible = getVisibleSeries();
    if (visible.length === 0) return null;

    const idx = clamp(Math.round(mx / valueIncrement), 0, pointCount - 1);
    const x = idx * valueIncrement;

    let best = null;
    let bestDist = Infinity;

    for (const s of visible) {
      const values = state.smooth ? computeMovingAverage(s.data, 2) : s.data;
      const y = mapValueToY(values[idx]);

      const dx = mx - x;
      const dy = my - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        best = { series: s, index: idx, x, y, value: values[idx], dist };
      }
    }

    if (!best) return null;
    const threshold = state.chartType === "bar" ? 24 : 16;
    return best.dist <= threshold ? best : null;
  }

  function showTooltip(pt) {
    tooltip.style.display = "block";
    tooltip.setAttribute("aria-hidden", "false");
    tooltip.style.left = `${pt.x}px`;
    tooltip.style.top = `${pt.y}px`;
    tooltip.innerHTML = `
      <div style="font-weight:700; color:${pt.series.color}">${pt.series.name}</div>
      <div>Index: ${pt.index}</div>
      <div>Value: ${Math.round(pt.value)}</div>
    `;
  }

  function hideTooltip() {
    tooltip.style.display = "none";
    tooltip.setAttribute("aria-hidden", "true");
  }

  function redrawAll() {
    drawChart();
    renderStatsPanel();
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(() => {
      if (!state.running) return;
      updateData();
      redrawAll();
    }, state.intervalMs);
  }

  function stopTimer() {
    if (state.timerId !== null) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  toggleBtn.addEventListener("click", () => {
    state.running = !state.running;
    toggleBtn.textContent = state.running ? "Pause" : "Start";
  });

  resetBtn.addEventListener("click", () => {
    series[0].generator = makeRandomGenerator();
    series[1].generator = makeRandomWalkGenerator(randBetween(state.minVal, state.maxVal));
    series[2].generator = makeSineGenerator();
    initSeriesData();
    redrawAll();
  });

  exportBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `chart-${state.chartType}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  chartTypeSelect.addEventListener("change", () => {
    state.chartType = chartTypeSelect.value;
    redrawAll();
  });

  themeSelect.addEventListener("change", () => {
    state.theme = themeSelect.value;
    document.body.setAttribute("data-theme", state.theme);
    redrawAll();
  });

  gridToggle.addEventListener("change", () => {
    state.showGrid = gridToggle.checked;
    redrawAll();
  });

  smoothToggle.addEventListener("change", () => {
    state.smooth = smoothToggle.checked;
    redrawAll();
  });

  speedInput.addEventListener("change", () => {
    const v = parseNumber(speedInput.value, state.intervalMs);
    state.intervalMs = clamp(v, 100, 5000);
    speedInput.value = String(state.intervalMs);
    startTimer();
  });

  function applyMinMax() {
    const minV = parseNumber(minInput.value, state.minVal);
    const maxV = parseNumber(maxInput.value, state.maxVal);

    if (maxV <= minV) {
      state.minVal = clamp(minV, 0, height - 1);
      state.maxVal = clamp(state.minVal + 1, 1, height);
      minInput.value = String(state.minVal);
      maxInput.value = String(state.maxVal);
    } else {
      state.minVal = clamp(minV, 0, height - 1);
      state.maxVal = clamp(maxV, 1, height);
      minInput.value = String(state.minVal);
      maxInput.value = String(state.maxVal);
    }

    resetBtn.click();
  }

  minInput.addEventListener("change", applyMinMax);
  maxInput.addEventListener("change", applyMinMax);

  seriesToggles.forEach((cb) => {
    cb.addEventListener("change", () => {
      const index = Number(cb.dataset.series);
      if (Number.isFinite(index) && series[index]) {
        series[index].visible = cb.checked;
        redrawAll();
      }
    });
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const pt = findNearestPoint(mx, my);
    if (pt) showTooltip(pt);
    else hideTooltip();
  });

  canvas.addEventListener("mouseleave", () => hideTooltip());

  state.intervalMs = parseNumber(speedInput.value, 1000);
  state.minVal = parseNumber(minInput.value, 0);
  state.maxVal = parseNumber(maxInput.value, height);
  state.showGrid = gridToggle.checked;
  state.smooth = smoothToggle.checked;
  state.chartType = chartTypeSelect.value;

  maxInput.value = String(height);

  initSeriesData();
  redrawAll();
  startTimer();
});
