// 시간대별 평균 생존 HP% 라인+영역 차트.
// 캔버스라 마크는 직접 그리고, 호버 크로스헤어/툴팁은 카드 위에 겹치는 별도 오버레이(div)로 구현.

const HP_CHART_LINE = "#34e0a1";
const HP_CHART_FILL_TOP = "rgba(52, 224, 161, 0.22)";
const HP_CHART_FILL_BOTTOM = "rgba(52, 224, 161, 0)";

// 격자선/축 글자/점 테두리는 카드 배경색에 맞춰야 함(흰 배경에 흰색 반투명을 쓰면 라이트 모드에서
// 거의 안 보임) -> 하드코딩 대신 지금 테마의 CSS 변수 값을 읽어서 씀
function getChartThemeColors() {
  const styles = getComputedStyle(document.body);
  return {
    grid: styles.getPropertyValue("--border-color").trim() || "rgba(255, 255, 255, 0.08)",
    axisText: styles.getPropertyValue("--text-sub").trim() || "rgba(255, 255, 255, 0.55)",
    dotRing: styles.getPropertyValue("--card-bg").trim() || "#1c2636"
  };
}

// 표시 구간이 짧을 때(죽는 시점 위주로 잘린 그래프)는 "0분"만 세 번 찍히는 것을 막기 위해
// 분 단위 대신 초 단위로 보여줌
function formatChartTime(totalSec, limitSec) {
  totalSec = Math.round(totalSec);
  if (limitSec < 120) return t("common.time.secondsOnly", { s: totalSec });
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? t("common.time.minutesSeconds", { m, s }) : t("common.time.minutesOnly", { m });
}

function getHpChartLayout(w, h) {
  const padL = 34;
  const padR = 12;
  const padT = 16;
  const padB = 22;
  return { padL, padR, padT, padB, chartW: w - padL - padR, chartH: h - padT - padB };
}

function hpChartDot(ctx, x, y, color, ringColor) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function paintHpChart(ctx, w, h, data, limitSec, hoverIdx) {
  const { padL, padT, chartW, chartH } = getHpChartLayout(w, h);
  const theme = getChartThemeColors();
  ctx.clearRect(0, 0, w, h);

  // 기준선(0/50/100%): 하이라인(1px) 실선만 사용 -> 절대 점선을 쓰지 않음(그리드는 항상 recessive)
  ctx.font = "10px sans-serif";
  ctx.fillStyle = theme.axisText;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1;
  [0, 50, 100].forEach((p) => {
    const y = padT + chartH - (p * chartH) / 100;
    ctx.fillText(p + "%", padL - 8, y);
    ctx.strokeStyle = theme.grid;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  [
    { label: formatChartTime(0, limitSec), pos: 0 },
    { label: formatChartTime(limitSec / 2, limitSec), pos: 0.5 },
    { label: formatChartTime(limitSec, limitSec), pos: 1 }
  ].forEach((tick) => {
    ctx.fillText(tick.label, padL + tick.pos * chartW, padT + chartH + 6);
  });

  const stepX = chartW / (data.length - 1);
  const xAt = (i) => padL + i * stepX;
  const yAt = (v) => padT + chartH - (v * chartH) / 100;

  // 영역 채움: 라인 색의 옅은 그라디언트 wash
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = xAt(i), y = yAt(val);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(xAt(data.length - 1), padT + chartH);
  ctx.lineTo(xAt(0), padT + chartH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, HP_CHART_FILL_TOP);
  grad.addColorStop(1, HP_CHART_FILL_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fill();

  // 라인: 2px, 라운드 조인/캡 + 은은한 글로우
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = xAt(i), y = yAt(val);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = HP_CHART_LINE;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(52, 224, 161, 0.55)";
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 끝점: 마크 + 직접 라벨(마지막 값). 라벨은 끝점에만 붙여서 과밀 표기를 피함
  const lastIdx = data.length - 1;
  const lastX = xAt(lastIdx);
  const lastY = yAt(data[lastIdx]);
  hpChartDot(ctx, lastX, lastY, HP_CHART_LINE, theme.dotRing);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text-main").trim() || "#eef1f6";
  ctx.font = "bold 11px sans-serif";
  const labelOnLeft = lastX > w - 44;
  ctx.textAlign = labelOnLeft ? "right" : "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${data[lastIdx].toFixed(1)}%`, lastX + (labelOnLeft ? -8 : 8), Math.max(padT + 10, lastY - 6));

  // 호버 크로스헤어 + 포인트
  if (hoverIdx !== null && hoverIdx !== undefined && hoverIdx >= 0 && hoverIdx < data.length) {
    const hx = xAt(hoverIdx);
    const hy = yAt(data[hoverIdx]);
    ctx.strokeStyle = theme.axisText;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, padT);
    ctx.lineTo(hx, padT + chartH);
    ctx.stroke();
    hpChartDot(ctx, hx, hy, HP_CHART_LINE, theme.dotRing);
  }
}

function drawHpChart(canvas, data, limitSec) {
  if (!canvas || !data || data.length < 2) return;
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;

  function render(hoverIdx) {
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintHpChart(ctx, cssW, cssH, data, limitSec, hoverIdx === undefined ? null : hoverIdx);
  }

  render(null);

  // 카드 폭이 바뀌면(회전, 리사이즈 등) 새 크기에 맞춰 다시 그림. 페이지를 벗어나 이 canvas가
  // 라우터의 innerHTML 교체로 사라져도(SPA엔 teardown 훅이 없음) 이 리스너 자체는 안 지워졌었음
  // (사이트 전체 점검에서 발견) - canvas가 더 이상 문서에 붙어있지 않으면 핸들러가 스스로 자신을
  // 지우게 함(다른 페이지 이동 훅 없이 이 파일 안에서만 완결)
  if (canvas._hpResizeHandler) window.removeEventListener("resize", canvas._hpResizeHandler);
  canvas._hpResizeHandler = () => {
    if (!canvas.isConnected) { window.removeEventListener("resize", canvas._hpResizeHandler); return; }
    render(null);
  };
  window.addEventListener("resize", canvas._hpResizeHandler);

  let tooltip = container.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    container.appendChild(tooltip);
  }

  function updateAt(clientX) {
    const rect = canvas.getBoundingClientRect();
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    const { padL, padT, chartW, chartH } = getHpChartLayout(cssW, cssH);
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left - padL) / chartW));
    const idx = Math.round(ratio * (data.length - 1));
    render(idx);

    const val = data[idx];
    const timeSec = (idx / (data.length - 1)) * limitSec;

    tooltip.textContent = "";
    const timeEl = document.createElement("div");
    timeEl.className = "chart-tooltip-time";
    timeEl.textContent = formatChartTime(timeSec, limitSec);
    const valEl = document.createElement("div");
    valEl.className = "chart-tooltip-value";
    valEl.textContent = `${val.toFixed(1)}%`;
    tooltip.appendChild(timeEl);
    tooltip.appendChild(valEl);
    tooltip.style.display = "block";

    const px = padL + (idx / (data.length - 1)) * chartW;
    const py = padT + chartH - (val * chartH) / 100;
    const tw = tooltip.offsetWidth || 74;
    let left = px + 12;
    if (left + tw > cssW) left = px - tw - 12;
    tooltip.style.left = `${Math.max(0, left)}px`;
    let top = py - 12;
    if (top < 0) top = py + 16;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltip.style.display = "none";
    render(null);
  }

  canvas.onpointermove = (e) => updateAt(e.clientX);
  canvas.onpointerdown = (e) => updateAt(e.clientX);
  canvas.onpointerleave = hideTooltip;
}
