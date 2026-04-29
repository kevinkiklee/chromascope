import { describe, it, expect } from "vitest";
import { mapPixels } from "../src/pixel-mapper.js";
import { createColorSpaceMapper } from "../src/color-spaces/index.js";
import type { PixelData } from "../src/types.js";

const mapper = createColorSpaceMapper("ycbcr");

function rgb(...bytes: number[]): PixelData {
  return {
    data: new Uint8Array(bytes),
    width: bytes.length / 3,
    height: 1,
    colorProfile: "sRGB",
  };
}

describe("mapPixels", () => {
  it("returns one mapped point per pixel", () => {
    const px = rgb(255, 0, 0, 0, 255, 0, 0, 0, 255);
    const points = mapPixels(px, mapper);
    expect(points).toHaveLength(3);
  });

  it("preserves pixel order", () => {
    const px = rgb(255, 0, 0, 0, 255, 0);
    const points = mapPixels(px, mapper);
    expect(points[0].r).toBe(255);
    expect(points[0].g).toBe(0);
    expect(points[0].b).toBe(0);
    expect(points[1].r).toBe(0);
    expect(points[1].g).toBe(255);
    expect(points[1].b).toBe(0);
  });

  it("returns empty array for zero-size input", () => {
    const px: PixelData = { data: new Uint8Array(0), width: 0, height: 0, colorProfile: "sRGB" };
    expect(mapPixels(px, mapper)).toEqual([]);
  });

  it("handles 2D images (width × height)", () => {
    // 2x2 image = 4 pixels = 12 bytes
    const px: PixelData = {
      data: new Uint8Array([
        255, 0, 0, 0, 255, 0,
        0, 0, 255, 128, 128, 128,
      ]),
      width: 2,
      height: 2,
      colorProfile: "sRGB",
    };
    const points = mapPixels(px, mapper);
    expect(points).toHaveLength(4);
    expect(points[3].r).toBe(128);
  });

  it("handles a large input without errors", () => {
    const w = 64, h = 64;
    const data = new Uint8Array(w * h * 3);
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff;
    const points = mapPixels({ data, width: w, height: h, colorProfile: "sRGB" }, mapper);
    expect(points).toHaveLength(w * h);
    // No NaN should appear in mapping
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.angle)).toBe(true);
    }
  });
});
