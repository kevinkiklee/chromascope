// packages/core/src/overlays/harmony-zones.ts

import type { HarmonyConfig, HarmonySchemeId, HarmonyZone } from "../types.js";
import { HARMONY_BASE_HALF_WIDTH } from "../constants.js";
import { normalizeAngle, angularDistance } from "../math-utils.js";

function schemeBaseAngles(scheme: HarmonySchemeId): number[] {
  switch (scheme) {
    case "complementary":
      return [0, Math.PI];
    case "splitComplementary":
      return [0, Math.PI - Math.PI / 6, Math.PI + Math.PI / 6];
    case "triadic":
      return [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    case "tetradic":
      return [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    case "analogous":
      return [0, Math.PI / 6, -Math.PI / 6];
  }
}

export function getHarmonyZones(config: HarmonyConfig): HarmonyZone[] {
  if (config.scheme === null) return [];

  const baseAngles = schemeBaseAngles(config.scheme);
  const halfWidth = HARMONY_BASE_HALF_WIDTH * config.zoneWidth;

  return baseAngles.map((angle, i) => ({
    centerAngle: normalizeAngle(angle + config.rotation),
    halfWidth,
    pullStrength: config.pullStrengths[i] ?? 0.5,
  }));
}

export function isPointInZone(angle: number, zone: HarmonyZone): boolean {
  const dist = Math.abs(angularDistance(angle, zone.centerAngle));
  return dist <= zone.halfWidth;
}

export function nearestZoneDistance(angle: number, zones: HarmonyZone[]): number {
  let minDist = Infinity;

  for (const zone of zones) {
    const dist = Math.abs(angularDistance(angle, zone.centerAngle));
    if (dist <= zone.halfWidth) return 0;
    const boundary = dist - zone.halfWidth;
    if (boundary < minDist) minDist = boundary;
  }

  return minDist;
}
