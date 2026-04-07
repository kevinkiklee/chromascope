// packages/core/src/overlays/skin-tone-line.ts

import { SKIN_TONE_ANGLE_RAD, RADIUS_FACTOR } from "../constants.js";

// 123° is the industry-standard skin tone line angle on a vectorscope.
// All human skin tones (regardless of ethnicity) fall near this line when
// properly white-balanced. Deviation indicates a color cast on skin.
export { SKIN_TONE_ANGLE_RAD as SKIN_TONE_ANGLE } from "../constants.js";

export function renderSkinToneLine(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;

  const cosA = Math.cos(SKIN_TONE_ANGLE_RAD);
  const sinA = -Math.sin(SKIN_TONE_ANGLE_RAD);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 180, 120, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 3]);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + cosA * maxR, cy + sinA * maxR);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}
