import { describe, it, expect } from "vitest";
import { CIELUVMapper } from "../../src/color-spaces/cieluv.js";

const mapper = new CIELUVMapper();

describe("CIELUVMapper", () => {
  it("has correct id and label", () => {
    expect(mapper.id).toBe("cieluv");
    expect(mapper.label).toBe("CIE LUV");
  });

  it("maps neutral gray to near center", () => {
    const p = mapper.mapPixel(128, 128, 128);
    expect(p.x).toBeCloseTo(0, 0);
    expect(p.y).toBeCloseTo(0, 0);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps pure white to center (achromatic)", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps pure black to center (achromatic)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps saturated red away from center", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("maps saturated blue away from center", () => {
    const p = mapper.mapPixel(0, 0, 255);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("maps saturated green away from center", () => {
    const p = mapper.mapPixel(0, 255, 0);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("produces different angles for red, green, and blue", () => {
    const red = mapper.mapPixel(255, 0, 0);
    const green = mapper.mapPixel(0, 255, 0);
    const blue = mapper.mapPixel(0, 0, 255);
    const minSep = Math.PI / 3;
    expect(Math.abs(red.angle - green.angle)).toBeGreaterThan(minSep);
    expect(Math.abs(green.angle - blue.angle)).toBeGreaterThan(minSep);
  });

  it("preserves original RGB", () => {
    const p = mapper.mapPixel(50, 100, 200);
    expect(p.r).toBe(50);
    expect(p.g).toBe(100);
    expect(p.b).toBe(200);
  });
});
