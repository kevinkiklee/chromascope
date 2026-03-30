import { describe, it, expect } from "vitest";
import { HSLMapper } from "../../src/color-spaces/hsl.js";

const mapper = new HSLMapper();

describe("HSLMapper", () => {
  it("has correct id and label", () => {
    expect(mapper.id).toBe("hsl");
    expect(mapper.label).toBe("HSL");
  });

  it("maps neutral gray to center (zero saturation)", () => {
    const p = mapper.mapPixel(128, 128, 128);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure white to center (zero saturation)", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure black to center (zero saturation)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure red to ~0° hue, full saturation", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.radius).toBeCloseTo(1, 1);
    expect(p.angle).toBeCloseTo(0, 1);
  });

  it("maps pure green to ~120° hue", () => {
    const p = mapper.mapPixel(0, 255, 0);
    expect(p.radius).toBeCloseTo(1, 1);
    expect(p.angle).toBeCloseTo((2 * Math.PI) / 3, 1);
  });

  it("maps pure blue to ~240° hue", () => {
    const p = mapper.mapPixel(0, 0, 255);
    expect(p.radius).toBeCloseTo(1, 1);
    expect(p.angle).toBeCloseTo((-2 * Math.PI) / 3, 1);
  });

  it("maps a desaturated color to smaller radius", () => {
    const p = mapper.mapPixel(200, 180, 180);
    expect(p.radius).toBeLessThan(0.3);
    expect(p.radius).toBeGreaterThan(0);
  });

  it("preserves original RGB", () => {
    const p = mapper.mapPixel(30, 60, 90);
    expect(p.r).toBe(30);
    expect(p.g).toBe(60);
    expect(p.b).toBe(90);
  });
});
