// packages/core/src/overlays/skin-tone-line.ts

import { SKIN_TONE_ANGLE_RAD, RADIUS_FACTOR } from "../constants.js";

// 123° is the industry-standard skin tone line angle on a vectorscope.
// All human skin tones (regardless of ethnicity) fall near this line when
// properly white-balanced. Deviation indicates a color cast on skin.
export { SKIN_TONE_ANGLE_RAD as SKIN_TONE_ANGLE } from "../constants.js";

// Pre-computed once at module load — angle is a compile-time constant.
const SKIN_TONE_COS = Math.cos(SKIN_TONE_ANGLE_RAD);
const SKIN_TONE_SIN = -Math.sin(SKIN_TONE_ANGLE_RAD);
const DASH_PATTERN: readonly number[] = [6, 3];
const NO_DASH: readonly number[] = [];

export function renderSkinToneLine(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 180, 120, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash(DASH_PATTERN as number[]);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + SKIN_TONE_COS * maxR, cy + SKIN_TONE_SIN * maxR);
  ctx.stroke();

  ctx.setLineDash(NO_DASH as number[]);
  ctx.restore();
}
