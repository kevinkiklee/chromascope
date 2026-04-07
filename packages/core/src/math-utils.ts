import { TWO_PI } from "./constants.js";

/** Normalize angle to [0, 2pi) */
export function normalizeAngle(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Signed shortest angular distance from a to b, in [-pi, pi] */
export function angularDistance(a: number, b: number): number {
  let d = normalizeAngle(b) - normalizeAngle(a);
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}
