import { describe, it, expect, vi } from "vitest";
import { BloomRenderer } from "../../src/renderers/bloom.js";
import type { MappedPoint } from "../../src/types.js";

describe("BloomRenderer", () => {
  it("has correct id and label", () => {
    const renderer = new BloomRenderer();
    expect(renderer.id).toBe("bloom");
    expect(renderer.label).toBe("Bloom");
  });

  it("draws radial gradients for points", () => {
    const renderer = new BloomRenderer();
    const size = 200;

    const gradient = { addColorStop: vi.fn() };
    const ctx = {
      globalCompositeOperation: "source-over",
      globalAlpha: 1,
      fillStyle: "",
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
    } as unknown as CanvasRenderingContext2D;

    const points: MappedPoint[] = [
      { x: 0.2, y: 0.3, angle: 0.98, radius: 0.36, r: 255, g: 100, b: 50 },
    ];

    renderer.render(points, ctx, size);

    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("does not crash on empty points", () => {
    const renderer = new BloomRenderer();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    expect(() => renderer.render([], ctx, 200)).not.toThrow();
  });
});
