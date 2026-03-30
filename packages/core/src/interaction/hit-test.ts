// packages/core/src/interaction/hit-test.ts

const TWO_PI = 2 * Math.PI;

export interface PolarCoord {
  angle: number;
  radius: number;
}

export function canvasToPolar(px: number, py: number, size: number): PolarCoord {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  const dx = px - cx;
  const dy = -(py - cy);

  const radius = Math.sqrt(dx * dx + dy * dy) / maxR;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += TWO_PI;

  return { angle, radius };
}
