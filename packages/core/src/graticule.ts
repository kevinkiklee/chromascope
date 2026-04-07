import { RADIUS_FACTOR } from "./constants.js";

let cachedGraticuleCanvas: OffscreenCanvas | null = null;
let cachedGraticuleSize = 0;

const HUE_LABELS: Array<{ label: string; angleDeg: number; color: string }> = [
  { label: "R", angleDeg: 0, color: "#ff4444" },
  { label: "Y", angleDeg: 60, color: "#ffff44" },
  { label: "G", angleDeg: 120, color: "#44ff44" },
  { label: "C", angleDeg: 180, color: "#44ffff" },
  { label: "B", angleDeg: 240, color: "#4444ff" },
  { label: "M", angleDeg: 300, color: "#ff44ff" },
];

/** @internal Exported for testing only — renders the graticule to any 2D-like context. */
export function renderGraticuleToContext(offCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;

  offCtx.clearRect(0, 0, size, size);

  // Background
  offCtx.fillStyle = "#111111";
  offCtx.fillRect(0, 0, size, size);

  // Concentric circles at 25%, 50%, 75%, 100%
  offCtx.strokeStyle = "#333333";
  offCtx.lineWidth = 1;
  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    offCtx.beginPath();
    offCtx.arc(cx, cy, maxR * frac, 0, Math.PI * 2);
    offCtx.stroke();
  }

  // Crosshair lines
  offCtx.strokeStyle = "#2a2a2a";
  offCtx.beginPath();
  offCtx.moveTo(cx - maxR, cy);
  offCtx.lineTo(cx + maxR, cy);
  offCtx.moveTo(cx, cy - maxR);
  offCtx.lineTo(cx, cy + maxR);
  offCtx.stroke();

  // Diagonal lines (45° increments)
  offCtx.strokeStyle = "#222222";
  for (const angleDeg of [45, 135, 225, 315]) {
    const rad = (angleDeg * Math.PI) / 180;
    offCtx.beginPath();
    offCtx.moveTo(cx, cy);
    offCtx.lineTo(cx + Math.cos(rad) * maxR, cy - Math.sin(rad) * maxR);
    offCtx.stroke();
  }

  // Hue tick marks and labels
  offCtx.font = `bold ${Math.round(size * 0.04)}px system-ui, sans-serif`;
  offCtx.textAlign = "center";
  offCtx.textBaseline = "middle";

  for (const { label, angleDeg, color } of HUE_LABELS) {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = -Math.sin(rad);

    offCtx.strokeStyle = color;
    offCtx.lineWidth = 2;
    offCtx.beginPath();
    offCtx.moveTo(cx + cosA * maxR * 0.95, cy + sinA * maxR * 0.95);
    offCtx.lineTo(cx + cosA * maxR * 1.0, cy + sinA * maxR * 1.0);
    offCtx.stroke();

    offCtx.fillStyle = color;
    offCtx.beginPath();
    offCtx.arc(cx + cosA * maxR, cy + sinA * maxR, size * 0.012, 0, Math.PI * 2);
    offCtx.fill();

    offCtx.fillStyle = color;
    offCtx.fillText(label, cx + cosA * maxR * 1.1, cy + sinA * maxR * 1.1);
  }

  // Center dot
  offCtx.fillStyle = "#555555";
  offCtx.beginPath();
  offCtx.arc(cx, cy, 2, 0, Math.PI * 2);
  offCtx.fill();
}

export function renderGraticule(ctx: CanvasRenderingContext2D, size: number): void {
  if (cachedGraticuleSize !== size || cachedGraticuleCanvas === null) {
    const offscreen = new OffscreenCanvas(size, size);
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) throw new Error("renderGraticule: failed to get offscreen 2d context");
    renderGraticuleToContext(offCtx, size);
    cachedGraticuleCanvas = offscreen;
    cachedGraticuleSize = size;
  }

  ctx.drawImage(cachedGraticuleCanvas, 0, 0);
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
