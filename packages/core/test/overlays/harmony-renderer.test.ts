import { describe, it, expect, vi } from "vitest";
import { renderHarmonyOverlay } from "../../src/overlays/harmony-renderer.js";
import type { HarmonyZone } from "../../src/types.js";

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

function makeZone(centerAngle: number, halfWidth = Math.PI / 12): HarmonyZone {
  return { centerAngle, halfWidth, pullStrength: 0.5 };
}

describe("renderHarmonyOverlay", () => {
  it("does nothing for empty zones array", () => {
    const ctx = createMockCtx();
    renderHarmonyOverlay(ctx, [], 300);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("saves and restores canvas state", () => {
    const ctx = createMockCtx();
    renderHarmonyOverlay(ctx, [makeZone(0)], 300);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("draws a filled arc for each zone", () => {
    const ctx = createMockCtx();
    const zones = [makeZone(0), makeZone(Math.PI)];
    renderHarmonyOverlay(ctx, zones, 300);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
  });

  it("draws two border lines per zone (start and end edges)", () => {
    const ctx = createMockCtx();
    renderHarmonyOverlay(ctx, [makeZone(0)], 400);
    // 2 border lines + 1 center dashed line = 3 strokes
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
  });

  it("draws a dashed center line for each zone", () => {
    const ctx = createMockCtx();
    renderHarmonyOverlay(ctx, [makeZone(0)], 300);
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);
    // Resets dash after
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  });

  it("cycles zone colors when more zones than colors", () => {
    const ctx = createMockCtx();
    // 5 zones, only 4 colors defined -- should wrap around
    const zones = Array.from({ length: 5 }, (_, i) => makeZone(i * 1.2));
    renderHarmonyOverlay(ctx, zones, 300);
    expect(ctx.fill).toHaveBeenCalledTimes(5);
  });

  it("uses maxR = 0.45 * size for arc radius", () => {
    const ctx = createMockCtx();
    const size = 400;
    renderHarmonyOverlay(ctx, [makeZone(0)], size);
    const arcCall = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(arcCall[2]).toBe(size * 0.45); // radius argument
  });

  it("centers arc at canvas midpoint", () => {
    const ctx = createMockCtx();
    const size = 500;
    renderHarmonyOverlay(ctx, [makeZone(0)], size);
    const arcCall = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(arcCall[0]).toBe(250); // cx
    expect(arcCall[1]).toBe(250); // cy
  });
});
