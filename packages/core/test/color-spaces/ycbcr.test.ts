import { describe, it, expect } from "vitest";
import { YCbCrMapper } from "../../src/color-spaces/ycbcr.js";

const mapper = new YCbCrMapper();

describe("YCbCrMapper", () => {
  it("has correct id and label", () => {
    expect(mapper.id).toBe("ycbcr");
    expect(mapper.label).toBe("YCbCr");
  });

  it("maps neutral gray to center (0,0)", () => {
    const p = mapper.mapPixel(128, 128, 128);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure white to center (achromatic)", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
  });

  it("maps pure black to center (achromatic)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
  });

  it("maps pure red to positive Cr region", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.y).toBeGreaterThan(0.3);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("maps pure blue to positive Cb region", () => {
    const p = mapper.mapPixel(0, 0, 255);
    expect(p.x).toBeGreaterThan(0.3);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("returns angle in radians", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.angle).toBeGreaterThanOrEqual(-Math.PI);
    expect(p.angle).toBeLessThanOrEqual(Math.PI);
  });

  it("preserves original RGB in output", () => {
    const p = mapper.mapPixel(100, 150, 200);
    expect(p.r).toBe(100);
    expect(p.g).toBe(150);
    expect(p.b).toBe(200);
  });
});
