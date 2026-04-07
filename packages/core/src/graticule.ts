import { RADIUS_FACTOR } from "./constants.js";

const HUE_LABELS: Array<{ label: string; angleDeg: number; color: string }> = [
  { label: "R", angleDeg: 0, color: "#ff4444" },
  { label: "Y", angleDeg: 60, color: "#ffff44" },
  { label: "G", angleDeg: 120, color: "#44ff44" },
  { label: "C", angleDeg: 180, color: "#44ffff" },
  { label: "B", angleDeg: 240, color: "#4444ff" },
  { label: "M", angleDeg: 300, color: "#ff44ff" },
];

export function renderGraticule(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;

  ctx.clearRect(0, 0, size, size);

  // Background
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, size, size);

  // Concentric circles at 25%, 50%, 75%, 100%
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1;
  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * frac, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshair lines
  ctx.strokeStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.moveTo(cx - maxR, cy);
  ctx.lineTo(cx + maxR, cy);
  ctx.moveTo(cx, cy - maxR);
  ctx.lineTo(cx, cy + maxR);
  ctx.stroke();

  // Diagonal lines (45° increments)
  ctx.strokeStyle = "#222222";
  for (const angleDeg of [45, 135, 225, 315]) {
    const rad = (angleDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * maxR, cy - Math.sin(rad) * maxR);
    ctx.stroke();
  }

  // Hue tick marks and labels
  ctx.font = `bold ${Math.round(size * 0.04)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const { label, angleDeg, color } of HUE_LABELS) {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = -Math.sin(rad);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + cosA * maxR * 0.95, cy + sinA * maxR * 0.95);
    ctx.lineTo(cx + cosA * maxR * 1.0, cy + sinA * maxR * 1.0);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + cosA * maxR, cy + sinA * maxR, size * 0.012, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillText(label, cx + cosA * maxR * 1.1, cy + sinA * maxR * 1.1);
  }

  // Center dot
  ctx.fillStyle = "#555555";
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Convert scope coordinates ([-1, 1] centered at origin) to canvas pixel coordinates.
 * Note: y is inverted because canvas y grows downward but scope y grows upward.
 * The 0.45 factor leaves margin for hue labels around the outer rim.
 */
export function scopeToCanvas(x: number, y: number, size: number): { px: number; py: number } {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;
  return {
    px: cx + x * maxR,
    py: cy - y * maxR,
  };
}
