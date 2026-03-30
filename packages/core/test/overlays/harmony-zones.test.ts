// packages/core/test/overlays/harmony-zones.test.ts

import { describe, it, expect } from "vitest";
import {
  getHarmonyZones,
  isPointInZone,
  nearestZoneDistance,
} from "../../src/overlays/harmony-zones.js";
import type { HarmonyConfig } from "../../src/types.js";

describe("getHarmonyZones", () => {
  it("returns 2 zones for complementary", () => {
    const config: HarmonyConfig = {
      scheme: "complementary",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(2);
  });

  it("returns 3 zones for triadic", () => {
    const config: HarmonyConfig = {
      scheme: "triadic",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(3);
  });

  it("returns 4 zones for tetradic", () => {
    const config: HarmonyConfig = {
      scheme: "tetradic",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(4);
  });

  it("returns 3 zones for splitComplementary", () => {
    const config: HarmonyConfig = {
      scheme: "splitComplementary",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(3);
  });

  it("returns 3 zones for analogous", () => {
    const config: HarmonyConfig = {
      scheme: "analogous",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(3);
  });

  it("returns empty array when scheme is null", () => {
    const config: HarmonyConfig = {
      scheme: null,
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(0);
  });

  it("applies rotation offset to all zones", () => {
    const base: HarmonyConfig = { scheme: "complementary", rotation: 0, zoneWidth: 1.0, pullStrengths: [] };
    const rotated: HarmonyConfig = { scheme: "complementary", rotation: Math.PI / 4, zoneWidth: 1.0, pullStrengths: [] };

    const baseZones = getHarmonyZones(base);
    const rotatedZones = getHarmonyZones(rotated);

    const diff = rotatedZones[0].centerAngle - baseZones[0].centerAngle;
    expect(diff).toBeCloseTo(Math.PI / 4, 5);
  });

  it("applies zoneWidth multiplier", () => {
    const narrow: HarmonyConfig = { scheme: "complementary", rotation: 0, zoneWidth: 0.5, pullStrengths: [] };
    const wide: HarmonyConfig = { scheme: "complementary", rotation: 0, zoneWidth: 2.0, pullStrengths: [] };

    const narrowZones = getHarmonyZones(narrow);
    const wideZones = getHarmonyZones(wide);

    expect(wideZones[0].halfWidth).toBeGreaterThan(narrowZones[0].halfWidth);
  });

  it("applies per-zone pullStrengths when provided", () => {
    const config: HarmonyConfig = {
      scheme: "complementary",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [0.8, 0.2],
    };
    const zones = getHarmonyZones(config);
    expect(zones[0].pullStrength).toBeCloseTo(0.8);
    expect(zones[1].pullStrength).toBeCloseTo(0.2);
  });
});

describe("isPointInZone", () => {
  it("returns true for a point inside a zone", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 };
    expect(isPointInZone(0.05, zone)).toBe(true);
  });

  it("returns false for a point outside a zone", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 };
    expect(isPointInZone(Math.PI / 2, zone)).toBe(false);
  });

  it("handles wrap-around at 0/2π boundary", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 };
    expect(isPointInZone(2 * Math.PI - 0.05, zone)).toBe(true);
  });
});

describe("nearestZoneDistance", () => {
  it("returns 0 for a point inside a zone", () => {
    const zones = [{ centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 }];
    expect(nearestZoneDistance(0.05, zones)).toBeCloseTo(0, 5);
  });

  it("returns positive distance for a point outside all zones", () => {
    const zones = [{ centerAngle: 0, halfWidth: Math.PI / 12, pullStrength: 0.5 }];
    const dist = nearestZoneDistance(Math.PI / 2, zones);
    expect(dist).toBeGreaterThan(0);
  });

  it("returns distance to nearest zone boundary", () => {
    const zones = [
      { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 },
      { centerAngle: Math.PI, halfWidth: Math.PI / 6, pullStrength: 0.5 },
    ];
    const dist = nearestZoneDistance(Math.PI / 4, zones);
    expect(dist).toBeCloseTo(Math.PI / 12, 3);
  });
});
