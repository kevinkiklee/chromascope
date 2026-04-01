import { describe, it, expect, vi } from "vitest";
import { SKIN_TONE_ANGLE, renderSkinToneLine } from "../../src/overlays/skin-tone-line.js";

describe("SKIN_TONE_ANGLE", () => {
  it("is approximately 123 degrees in radians", () => {
    const expectedRad = (123 * Math.PI) / 180;
    expect(SKIN_TONE_ANGLE).toBeCloseTo(expectedRad, 2);
  });
});

function createMockCtx() {
  return {
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
}

describe("renderSkinToneLine", () => {
  it("saves and restores canvas state", () => {
    const ctx = createMockCtx();
    renderSkinToneLine(ctx, 300);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("draws a dashed line from center outward", () => {
    const ctx = createMockCtx();
    renderSkinToneLine(ctx, 300);
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("starts line from canvas center", () => {
    const ctx = createMockCtx();
    const size = 400;
    renderSkinToneLine(ctx, size);
    expect(ctx.moveTo).toHaveBeenCalledWith(200, 200);
  });

  it("ends line at correct angle and distance", () => {
    const ctx = createMockCtx();
    const size = 500;
    const cx = 250;
    const cy = 250;
    const maxR = size * 0.45;

    renderSkinToneLine(ctx, size);

    const lineToCall = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const expectedX = cx + Math.cos(SKIN_TONE_ANGLE) * maxR;
    const expectedY = cy + -Math.sin(SKIN_TONE_ANGLE) * maxR;
    expect(lineToCall[0]).toBeCloseTo(expectedX, 5);
    expect(lineToCall[1]).toBeCloseTo(expectedY, 5);
  });

  it("resets line dash after drawing", () => {
    const ctx = createMockCtx();
    renderSkinToneLine(ctx, 300);
    const dashCalls = (ctx.setLineDash as ReturnType<typeof vi.fn>).mock.calls;
    expect(dashCalls[dashCalls.length - 1][0]).toEqual([]);
  });

  it("uses a semi-transparent warm stroke color", () => {
    const ctx = createMockCtx();
    renderSkinToneLine(ctx, 300);
    expect(ctx.strokeStyle).toContain("rgba");
    expect(ctx.strokeStyle).toContain("0.5");
  });
});
