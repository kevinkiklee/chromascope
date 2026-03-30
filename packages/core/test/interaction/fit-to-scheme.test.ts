// packages/core/test/interaction/fit-to-scheme.test.ts

import { describe, it, expect } from "vitest";
import { computeFitDeltas } from "../../src/interaction/fit-to-scheme.js";
import type { MappedPoint, HarmonyZone } from "../../src/types.js";

describe("computeFitDeltas", () => {
  const zone: HarmonyZone = {
    centerAngle: 0,
    halfWidth: Math.PI / 6,
    pullStrength: 1.0,
  };

  it("returns zero delta for a point inside a zone", () => {
    const point: MappedPoint = {
      x: 0.5, y: 0, angle: 0.05, radius: 0.5, r: 200, g: 100, b: 100,
    };
    const deltas = computeFitDeltas([point], [zone]);
    expect(deltas[0].angleDelta).toBeCloseTo(0, 5);
  });

  it("returns negative delta to pull point clockwise into nearest zone", () => {
    const point: MappedPoint = {
      x: 0.25, y: 0.43, angle: Math.PI / 3, radius: 0.5, r: 200, g: 100, b: 100,
    };
    const deltas = computeFitDeltas([point], [zone]);
    expect(deltas[0].angleDelta).toBeLessThan(0);
  });

  it("scales delta by pullStrength", () => {
    const point: MappedPoint = {
      x: 0.25, y: 0.43, angle: Math.PI / 3, radius: 0.5, r: 200, g: 100, b: 100,
    };
    const fullPull = computeFitDeltas([point], [{ ...zone, pullStrength: 1.0 }]);
    const halfPull = computeFitDeltas([point], [{ ...zone, pullStrength: 0.5 }]);

    expect(Math.abs(halfPull[0].angleDelta)).toBeCloseTo(
      Math.abs(fullPull[0].angleDelta) * 0.5,
      3,
    );
  });

  it("returns zero delta for desaturated points (radius < 0.05)", () => {
    const point: MappedPoint = {
      x: 0.01, y: 0.01, angle: Math.PI / 2, radius: 0.02, r: 128, g: 128, b: 128,
    };
    const deltas = computeFitDeltas([point], [zone]);
    expect(deltas[0].angleDelta).toBeCloseTo(0, 5);
  });

  it("handles multiple points", () => {
    const points: MappedPoint[] = [
      { x: 0.5, y: 0, angle: 0.05, radius: 0.5, r: 200, g: 100, b: 100 },
      { x: 0.25, y: 0.43, angle: Math.PI / 3, radius: 0.5, r: 100, g: 200, b: 100 },
    ];
    const deltas = computeFitDeltas(points, [zone]);
    expect(deltas.length).toBe(2);
    expect(deltas[0].angleDelta).toBeCloseTo(0, 5);
    expect(deltas[1].angleDelta).not.toBeCloseTo(0, 2);
  });
});
