// packages/core/test/overlays/skin-tone-line.test.ts

import { describe, it, expect, vi } from "vitest";
import { SKIN_TONE_ANGLE, renderSkinToneLine } from "../../src/overlays/skin-tone-line.js";

describe("SKIN_TONE_ANGLE", () => {
  it("is approximately 123 degrees in radians", () => {
    const expectedRad = (123 * Math.PI) / 180;
    expect(SKIN_TONE_ANGLE).toBeCloseTo(expectedRad, 2);
  });
});

describe("renderSkinToneLine", () => {
  it("draws a line on the canvas", () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: "",
      lineWidth: 1,
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    renderSkinToneLine(ctx, 300);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
