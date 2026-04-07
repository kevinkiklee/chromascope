// packages/core/src/interaction/hit-test.ts

import { RADIUS_FACTOR, TWO_PI } from "../constants.js";

export interface PolarCoord {
  angle: number;
  radius: number;
}

export function canvasToPolar(px: number, py: number, size: number): PolarCoord {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;

  const dx = px - cx;
  const dy = -(py - cy);

  const radius = Math.sqrt(dx * dx + dy * dy) / maxR;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += TWO_PI;

  return { angle, radius };
}
