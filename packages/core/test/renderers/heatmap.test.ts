import { describe, it, expect, vi } from "vitest";
import { HeatmapRenderer } from "../../src/renderers/heatmap.js";
import type { MappedPoint } from "../../src/types.js";

describe("HeatmapRenderer", () => {
  it("has correct id and label", () => {
    const renderer = new HeatmapRenderer();
    expect(renderer.id).toBe("heatmap");
    expect(renderer.label).toBe("Heatmap");
  });

  it("calls putImageData to draw the heatmap", () => {
    const renderer = new HeatmapRenderer();
    const size = 100;

    const imageData = { data: new Uint8ClampedArray(size * size * 4), width: size, height: size };
    const ctx = {
      createImageData: vi.fn(() => imageData),
      putImageData: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const points: MappedPoint[] = [
      { x: 0.1, y: 0.1, angle: 0.78, radius: 0.14, r: 200, g: 50, b: 50 },
      { x: 0.1, y: 0.1, angle: 0.78, radius: 0.14, r: 210, g: 40, b: 60 },
      { x: -0.3, y: 0.5, angle: 2.1, radius: 0.58, r: 0, g: 100, b: 255 },
    ];

    renderer.render(points, ctx, size);

    expect(ctx.createImageData).toHaveBeenCalledWith(size, size);
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("does not crash on empty points", () => {
    const renderer = new HeatmapRenderer();
    const size = 100;
    const imageData = { data: new Uint8ClampedArray(size * size * 4), width: size, height: size };
    const ctx = {
      createImageData: vi.fn(() => imageData),
      putImageData: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    expect(() => renderer.render([], ctx, size)).not.toThrow();
  });
});
