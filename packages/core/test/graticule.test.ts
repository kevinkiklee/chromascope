import { describe, it, expect } from "vitest";
import { scopeToCanvas } from "../src/graticule.js";
import { SKIN_TONE_ANGLE } from "../src/overlays/skin-tone-line.js";

describe("scopeToCanvas", () => {
  it("maps center (0,0) to canvas center", () => {
    const { px, py } = scopeToCanvas(0, 0, 500);
    expect(px).toBe(250);
    expect(py).toBe(250);
  });

  it("maps positive x to right of center", () => {
    const { px } = scopeToCanvas(0.5, 0, 500);
    expect(px).toBeGreaterThan(250);
  });

  it("maps positive y to above center (canvas y is inverted)", () => {
    const { py } = scopeToCanvas(0, 0.5, 500);
    expect(py).toBeLessThan(250);
  });

  it("maps (-1,-1) to bottom-left region", () => {
    const { px, py } = scopeToCanvas(-1, -1, 500);
    expect(px).toBeLessThan(250);
    expect(py).toBeGreaterThan(250);
  });

  it("scales with canvas size", () => {
    const small = scopeToCanvas(1, 0, 100);
    const large = scopeToCanvas(1, 0, 1000);
    expect(large.px - 500).toBe((small.px - 50) * 10);
  });

  it("uses 0.45 * size as max radius", () => {
    const { px } = scopeToCanvas(1, 0, 100);
    // center = 50, maxR = 45, so px = 50 + 1*45 = 95
    expect(px).toBe(95);
  });
});

describe("SKIN_TONE_ANGLE", () => {
  it("is approximately 123 degrees in radians", () => {
    const expected = (123 * Math.PI) / 180;
    expect(SKIN_TONE_ANGLE).toBeCloseTo(expected, 10);
  });

  it("is between 90° and 180° (upper-left quadrant)", () => {
    expect(SKIN_TONE_ANGLE).toBeGreaterThan(Math.PI / 2);
    expect(SKIN_TONE_ANGLE).toBeLessThan(Math.PI);
  });
});
