import { describe, it, expect, vi } from "vitest";
import { ScatterRenderer } from "../../src/renderers/scatter.js";
import type { MappedPoint } from "../../src/types.js";

describe("ScatterRenderer", () => {
  it("has correct id and label", () => {
    const renderer = new ScatterRenderer();
    expect(renderer.id).toBe("scatter");
    expect(renderer.label).toBe("Scatter");
  });

  it("calls fillRect for each point", () => {
    const renderer = new ScatterRenderer();
    const size = 200;

    // Create a mock canvas context
    const ctx = {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillStyle: "",
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const points: MappedPoint[] = [
      { x: 0, y: 0, angle: 0, radius: 0, r: 128, g: 128, b: 128 },
      { x: 0.5, y: 0.3, angle: 0.5, radius: 0.58, r: 255, g: 0, b: 0 },
    ];

    renderer.render(points, ctx, size);

    expect(ctx.fillRect).toHaveBeenCalled();
    // Each point should produce at least one fillRect call
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not crash on empty points array", () => {
    const renderer = new ScatterRenderer();
    const ctx = {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillStyle: "",
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    expect(() => renderer.render([], ctx, 200)).not.toThrow();
  });
});
