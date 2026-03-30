// packages/core/test/interaction/hit-test.test.ts

import { describe, it, expect } from "vitest";
import { canvasToPolar } from "../../src/interaction/hit-test.js";

describe("canvasToPolar", () => {
  const size = 200;

  it("returns center (0,0) for the canvas center", () => {
    const result = canvasToPolar(100, 100, size);
    expect(result.radius).toBeCloseTo(0, 1);
  });

  it("returns radius ~1.0 at the edge of the scope", () => {
    const result = canvasToPolar(190, 100, size);
    expect(result.radius).toBeCloseTo(1.0, 1);
  });

  it("returns angle 0 for a point to the right of center", () => {
    const result = canvasToPolar(150, 100, size);
    expect(result.angle).toBeCloseTo(0, 1);
  });

  it("returns angle π/2 for a point above center", () => {
    const result = canvasToPolar(100, 55, size);
    expect(result.angle).toBeCloseTo(Math.PI / 2, 1);
  });

  it("returns angle π for a point to the left of center", () => {
    const result = canvasToPolar(55, 100, size);
    expect(result.angle).toBeCloseTo(Math.PI, 1);
  });

  it("returns radius > 1 for points outside the scope circle", () => {
    const result = canvasToPolar(195, 100, size);
    expect(result.radius).toBeGreaterThan(1.0);
  });
});
