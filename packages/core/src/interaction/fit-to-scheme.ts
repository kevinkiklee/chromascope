// packages/core/src/interaction/fit-to-scheme.ts

import type { MappedPoint, HarmonyZone } from "../types.js";
import { TWO_PI } from "../constants.js";

function angularDistance(a: number, b: number): number {
  let d = ((b % TWO_PI) + TWO_PI) % TWO_PI - ((a % TWO_PI) + TWO_PI) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

export interface FitDelta {
  angleDelta: number;
  nearestZoneIndex: number;
}

// Points near the center (low saturation / near-gray) don't have meaningful hue,
// so skip them — rotating them toward a zone would introduce unwanted color shifts.
const MIN_RADIUS = 0.05;

export function computeFitDeltas(
  points: MappedPoint[],
  zones: HarmonyZone[],
): FitDelta[] {
  if (zones.length === 0) {
    return points.map(() => ({ angleDelta: 0, nearestZoneIndex: -1 }));
  }

  return points.map((point) => {
    if (point.radius < MIN_RADIUS) {
      return { angleDelta: 0, nearestZoneIndex: -1 };
    }

    let bestDelta = Infinity;
    let bestAbsDelta = Infinity;
    let bestZoneIndex = 0;

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const distToCenter = angularDistance(point.angle, zone.centerAngle);
      const absDist = Math.abs(distToCenter);

      if (absDist <= zone.halfWidth) {
        return { angleDelta: 0, nearestZoneIndex: i };
      }

      // distToCenter is the signed shortest path from point to zone center.
      // A positive distToCenter means the zone is counter-clockwise from the point,
      // so we need a positive delta to reach it; negative means clockwise, need negative delta.
      const overshoot = absDist - zone.halfWidth;
      const delta = distToCenter > 0 ? overshoot : -overshoot;

      if (Math.abs(delta) < bestAbsDelta) {
        bestAbsDelta = Math.abs(delta);
        bestDelta = delta * zone.pullStrength;
        bestZoneIndex = i;
      }
    }

    return { angleDelta: bestDelta, nearestZoneIndex: bestZoneIndex };
  });
}
