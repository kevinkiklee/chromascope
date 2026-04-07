// packages/core/src/overlays/harmony-renderer.ts

import type { HarmonyZone } from "../types.js";
import { RADIUS_FACTOR, ZONE_FILL_COLORS, ZONE_BORDER_COLORS } from "../constants.js";

export function renderHarmonyOverlay(
  ctx: CanvasRenderingContext2D,
  zones: HarmonyZone[],
  size: number,
): void {
  if (zones.length === 0) return;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;

  ctx.save();

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    // Negate angles because canvas arcs go clockwise (positive = CW)
    // but our scope angles go counter-clockwise (positive = CCW, math convention)
    const startAngle = -(zone.centerAngle + zone.halfWidth);
    const endAngle = -(zone.centerAngle - zone.halfWidth);

    ctx.fillStyle = ZONE_FILL_COLORS[i % ZONE_FILL_COLORS.length];
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
