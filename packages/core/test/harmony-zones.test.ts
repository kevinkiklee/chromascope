import { describe, it, expect } from "vitest";
import {
  getHarmonyZones,
  isPointInZone,
  nearestZoneDistance,
} from "../src/overlays/harmony-zones.js";
import type { HarmonyConfig, HarmonySchemeId } from "../src/types.js";

function makeConfig(scheme: HarmonySchemeId | null, rotation = 0): HarmonyConfig {
  return { scheme, rotation, zoneWidth: 1.0, pullStrengths: [] };
}

describe("getHarmonyZones", () => {
  it("returns empty for null scheme", () => {
    expect(getHarmonyZones(makeConfig(null))).toEqual([]);
  });

  it("returns 2 zones for complementary", () => {
    const zones = getHarmonyZones(makeConfig("complementary"));
    expect(zones).toHaveLength(2);
  });

  it("returns 3 zones for splitComplementary", () => {
    const zones = getHarmonyZones(makeConfig("splitComplementary"));
    expect(zones).toHaveLength(3);
  });

  it("returns 3 zones for triadic", () => {
    const zones = getHarmonyZones(makeConfig("triadic"));
    expect(zones).toHaveLength(3);
  });

  it("returns 4 zones for tetradic", () => {
    const zones = getHarmonyZones(makeConfig("tetradic"));
    expect(zones).toHaveLength(4);
  });

  it("returns 3 zones for analogous", () => {
    const zones = getHarmonyZones(makeConfig("analogous"));
    expect(zones).toHaveLength(3);
  });

  it("applies rotation offset to all zones", () => {
    const unrotated = getHarmonyZones(makeConfig("complementary", 0));
    const rotated = getHarmonyZones(makeConfig("complementary", Math.PI / 4));

    // Angles should differ by roughly π/4
    const diff = Math.abs(rotated[0].centerAngle - unrotated[0].centerAngle);
    expect(diff).toBeCloseTo(Math.PI / 4, 1);
  });

  it("respects zoneWidth multiplier", () => {
    const narrow = getHarmonyZones({ ...makeConfig("triadic"), zoneWidth: 0.5 });
    const wide = getHarmonyZones({ ...makeConfig("triadic"), zoneWidth: 2.0 });

    expect(wide[0].halfWidth).toBeGreaterThan(narrow[0].halfWidth);
    expect(wide[0].halfWidth / narrow[0].halfWidth).toBeCloseTo(4, 0); // 2.0/0.5 = 4x
  });

  it("uses pullStrengths when provided", () => {
    const config: HarmonyConfig = {
      scheme: "triadic",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [0.3, 0.6, 0.9],
    };
    const zones = getHarmonyZones(config);
    expect(zones[0].pullStrength).toBe(0.3);
    expect(zones[1].pullStrength).toBe(0.6);
    expect(zones[2].pullStrength).toBe(0.9);
  });

  it("defaults pullStrength to 0.5 when not provided", () => {
    const zones = getHarmonyZones(makeConfig("complementary"));
    expect(zones[0].pullStrength).toBe(0.5);
    expect(zones[1].pullStrength).toBe(0.5);
  });

  it("normalizes angles to [0, 2π)", () => {
    const zones = getHarmonyZones(makeConfig("analogous"));
    for (const zone of zones) {
      expect(zone.centerAngle).toBeGreaterThanOrEqual(0);
      expect(zone.centerAngle).toBeLessThan(2 * Math.PI);
    }
  });
});

describe("isPointInZone", () => {
  it("returns true for angle at zone center", () => {
    const zone = { centerAngle: Math.PI, halfWidth: Math.PI / 12, pullStrength: 0.5 };
    expect(isPointInZone(Math.PI, zone)).toBe(true);
  });

  it("returns true for angle at zone edge", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 12, pullStrength: 0.5 };
    expect(isPointInZone(Math.PI / 12, zone)).toBe(true);
  });

  it("returns false for angle outside zone", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 12, pullStrength: 0.5 };
    expect(isPointInZone(Math.PI / 2, zone)).toBe(false);
  });

  it("handles wrap-around at 0/2π boundary", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 };
    // Angle just below 2π should still be "in zone" centered at 0
    expect(isPointInZone(2 * Math.PI - 0.1, zone)).toBe(true);
  });
});

describe("nearestZoneDistance", () => {
  it("returns 0 when point is inside a zone", () => {
    const zones = getHarmonyZones(makeConfig("complementary"));
    const insideAngle = zones[0].centerAngle;
    expect(nearestZoneDistance(insideAngle, zones)).toBe(0);
  });

  it("returns positive distance when point is outside all zones", () => {
    const zones = getHarmonyZones(makeConfig("complementary"));
    // Pick an angle far from both zones
    const outsideAngle = Math.PI / 2;
    const dist = nearestZoneDistance(outsideAngle, zones);
    expect(dist).toBeGreaterThan(0);
  });

  it("returns smaller distance for points closer to a zone", () => {
    const zones = getHarmonyZones(makeConfig("complementary"));
    const close = nearestZoneDistance(zones[0].centerAngle + zones[0].halfWidth + 0.1, zones);
    const far = nearestZoneDistance(Math.PI / 2, zones);
    expect(close).toBeLessThan(far);
  });

  it("returns Infinity when there are no zones", () => {
    expect(nearestZoneDistance(0, [])).toBe(Infinity);
  });
});
