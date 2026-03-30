// packages/core/src/overlays/harmony-renderer.ts

import type { HarmonyZone } from "../types.js";

const ZONE_COLORS = [
  "rgba(255, 200, 50, 0.15)",
  "rgba(50, 200, 255, 0.15)",
  "rgba(255, 100, 200, 0.15)",
  "rgba(100, 255, 150, 0.15)",
];

const ZONE_BORDER_COLORS = [
  "rgba(255, 200, 50, 0.6)",
  "rgba(50, 200, 255, 0.6)",
  "rgba(255, 100, 200, 0.6)",
  "rgba(100, 255, 150, 0.6)",
];

export function renderHarmonyOverlay(
  ctx: CanvasRenderingContext2D,
  zones: HarmonyZone[],
  size: number,
): void {
  if (zones.length === 0) return;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  ctx.save();

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    const startAngle = -(zone.centerAngle + zone.halfWidth);
    const endAngle = -(zone.centerAngle - zone.halfWidth);

    ctx.fillStyle = ZONE_COLORS[i % ZONE_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = ZONE_BORDER_COLORS[i % ZONE_BORDER_COLORS.length];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(startAngle) * maxR, cy + Math.sin(startAngle) * maxR);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(endAngle) * maxR, cy + Math.sin(endAngle) * maxR);
    ctx.stroke();

    const centerCanvas = -(zone.centerAngle);
    ctx.strokeStyle = ZONE_BORDER_COLORS[i % ZONE_BORDER_COLORS.length];
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(centerCanvas) * maxR * 0.9, cy + Math.sin(centerCanvas) * maxR * 0.9);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
