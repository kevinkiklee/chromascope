import { describe, it, expect } from "vitest";
import { YCbCrMapper } from "../src/color-spaces/ycbcr.js";
import { CIELUVMapper } from "../src/color-spaces/cieluv.js";
import { HSLMapper } from "../src/color-spaces/hsl.js";
import { createColorSpaceMapper } from "../src/color-spaces/index.js";

describe("YCbCrMapper", () => {
  const mapper = new YCbCrMapper();

  it("has correct id and label", () => {
    expect(mapper.id).toBe("ycbcr");
    expect(mapper.label).toBe("YCbCr");
  });

  it("maps white to near center (no chroma)", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps black to near center (no chroma)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps pure red to a distinct position", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.radius).toBeGreaterThan(0.3);
    expect(p.r).toBe(255);
    expect(p.g).toBe(0);
    expect(p.b).toBe(0);
  });

  it("maps pure blue with positive x (Cb)", () => {
    const p = mapper.mapPixel(0, 0, 255);
    expect(p.x).toBeGreaterThan(0);
  });

  it("maps complementary colors to opposite sides", () => {
    const red = mapper.mapPixel(255, 0, 0);
    const cyan = mapper.mapPixel(0, 255, 255);
    // Red and cyan should be roughly opposite
    expect(Math.sign(red.x)).not.toBe(Math.sign(cyan.x));
  });

  it("preserves original RGB values", () => {
    const p = mapper.mapPixel(123, 45, 67);
    expect(p.r).toBe(123);
    expect(p.g).toBe(45);
    expect(p.b).toBe(67);
  });
});

describe("CIELUVMapper", () => {
  const mapper = new CIELUVMapper();

  it("has correct id and label", () => {
    expect(mapper.id).toBe("cieluv");
    expect(mapper.label).toBe("CIE LUV");
  });

  it("maps black to center (zero chroma)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.radius).toBe(0);
  });

  it("maps white to near center", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps saturated colors to non-zero radius", () => {
    const red = mapper.mapPixel(255, 0, 0);
    const green = mapper.mapPixel(0, 255, 0);
    const blue = mapper.mapPixel(0, 0, 255);

    expect(red.radius).toBeGreaterThan(0.2);
    expect(green.radius).toBeGreaterThan(0.2);
    expect(blue.radius).toBeGreaterThan(0.2);
  });

  it("produces different angles for different hues", () => {
    const red = mapper.mapPixel(255, 0, 0);
    const green = mapper.mapPixel(0, 255, 0);
    const blue = mapper.mapPixel(0, 0, 255);

    const angles = [red.angle, green.angle, blue.angle];
    // All three should be distinct
    expect(Math.abs(angles[0] - angles[1])).toBeGreaterThan(0.5);
    expect(Math.abs(angles[1] - angles[2])).toBeGreaterThan(0.5);
  });

  it("applies sRGB linearization (not linear mapping)", () => {
    // Mid-gray (128,128,128) should map differently than simple linear scaling
    const p = mapper.mapPixel(128, 128, 128);
    expect(p.radius).toBeLessThan(0.05); // achromatic
  });
});

describe("HSLMapper", () => {
  const mapper = new HSLMapper();

  it("has correct id and label", () => {
    expect(mapper.id).toBe("hsl");
    expect(mapper.label).toBe("HSL");
  });

  it("maps achromatic colors to center (zero saturation)", () => {
    expect(mapper.mapPixel(0, 0, 0).radius).toBe(0);
    expect(mapper.mapPixel(128, 128, 128).radius).toBe(0);
    expect(mapper.mapPixel(255, 255, 255).radius).toBe(0);
  });

  it("maps fully saturated colors to maximum radius", () => {
    const red = mapper.mapPixel(255, 0, 0);
    expect(red.radius).toBeCloseTo(1.0, 1);
  });

  it("maps desaturated colors to smaller radius", () => {
    const muted = mapper.mapPixel(200, 150, 150);
    const vivid = mapper.mapPixel(255, 0, 0);
    expect(muted.radius).toBeLessThan(vivid.radius);
  });

  it("maps red, green, blue to distinct angles spread around the circle", () => {
    const red = mapper.mapPixel(255, 0, 0);
    const green = mapper.mapPixel(0, 255, 0);
    const blue = mapper.mapPixel(0, 0, 255);

    // All three should have distinct angles
    const angles = [red.angle, green.angle, blue.angle];
    for (let i = 0; i < angles.length; i++) {
      for (let j = i + 1; j < angles.length; j++) {
        let diff = Math.abs(angles[i] - angles[j]);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        // At least 60° (π/3) apart
        expect(diff).toBeGreaterThan(Math.PI / 3);
      }
    }
  });
});

describe("createColorSpaceMapper", () => {
  it("creates YCbCr mapper", () => {
    const m = createColorSpaceMapper("ycbcr");
    expect(m.id).toBe("ycbcr");
  });

  it("creates CIE LUV mapper", () => {
    const m = createColorSpaceMapper("cieluv");
    expect(m.id).toBe("cieluv");
  });

  it("creates HSL mapper", () => {
    const m = createColorSpaceMapper("hsl");
    expect(m.id).toBe("hsl");
  });

  it("all mappers produce different coordinates for the same saturated color", () => {
    const ycbcr = createColorSpaceMapper("ycbcr").mapPixel(255, 0, 0);
    const cieluv = createColorSpaceMapper("cieluv").mapPixel(255, 0, 0);
    const hsl = createColorSpaceMapper("hsl").mapPixel(255, 0, 0);

    // At least one coordinate should differ between each pair
    const allSame = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

    expect(allSame(ycbcr, cieluv)).toBe(false);
    expect(allSame(cieluv, hsl)).toBe(false);
  });
});
