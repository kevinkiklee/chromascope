import { describe, it, expect, vi } from "vitest";
import { ScatterRenderer } from "../src/renderers/scatter.js";
import { HeatmapRenderer } from "../src/renderers/heatmap.js";
import { BloomRenderer } from "../src/renderers/bloom.js";
import { createDensityRenderer } from "../src/renderers/index.js";
import type { MappedPoint } from "../src/types.js";

function createMockCanvas(size: number) {
  const imageData = {
    data: new Uint8ClampedArray(size * size * 4),
    width: size,
    height: size,
  };

  return {
    canvas: { width: size, height: size },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    createImageData: vi.fn(() => imageData),
    putImageData: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

function makePoints(count: number): MappedPoint[] {
  const points: MappedPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 0.3 + (i % 3) * 0.2;
    points.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      angle,
      radius,
      r: (i * 37) % 256,
      g: (i * 73) % 256,
      b: (i * 113) % 256,
    });
  }
  return points;
}

describe("ScatterRenderer", () => {
  const renderer = new ScatterRenderer();

  it("has correct id and label", () => {
    expect(renderer.id).toBe("scatter");
    expect(renderer.label).toBe("Scatter");
  });

  it("renders without error", () => {
    const ctx = createMockCanvas(256);
    expect(() => renderer.render(makePoints(100), ctx, 256)).not.toThrow();
  });

  it("uses additive blending", () => {
    const ctx = createMockCanvas(256);
    renderer.render(makePoints(10), ctx, 256);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("calls fillRect for each point", () => {
    const ctx = createMockCanvas(256);
    const points = makePoints(5);
    renderer.render(points, ctx, 256);
    expect(ctx.fillRect).toHaveBeenCalledTimes(5);
  });

  it("handles empty points array", () => {
    const ctx = createMockCanvas(256);
    expect(() => renderer.render([], ctx, 256)).not.toThrow();
  });

  it("handles large point counts", () => {
    const ctx = createMockCanvas(512);
    expect(() => renderer.render(makePoints(10000), ctx, 512)).not.toThrow();
  });
});

describe("HeatmapRenderer", () => {
  const renderer = new HeatmapRenderer();

  it("has correct id and label", () => {
    expect(renderer.id).toBe("heatmap");
    expect(renderer.label).toBe("Heatmap");
  });

  it("renders without error", () => {
    const ctx = createMockCanvas(256);
    expect(() => renderer.render(makePoints(100), ctx, 256)).not.toThrow();
  });

  it("creates and puts image data", () => {
    const ctx = createMockCanvas(256);
    renderer.render(makePoints(50), ctx, 256);
    expect(ctx.createImageData).toHaveBeenCalledWith(256, 256);
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("handles empty points array", () => {
    const ctx = createMockCanvas(256);
    expect(() => renderer.render([], ctx, 256)).not.toThrow();
  });
});

describe("BloomRenderer", () => {
  const renderer = new BloomRenderer();

  it("has correct id and label", () => {
    expect(renderer.id).toBe("bloom");
    expect(renderer.label).toBe("Bloom");
  });

  it("renders without error", () => {
    const ctx = createMockCanvas(256);
    expect(() => renderer.render(makePoints(100), ctx, 256)).not.toThrow();
  });

  it("creates radial gradients for each point", () => {
    const ctx = createMockCanvas(256);
    const points = makePoints(5);
    renderer.render(points, ctx, 256);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(5);
  });

  it("handles empty points array", () => {
    const ctx = createMockCanvas(256);
    expect(() => renderer.render([], ctx, 256)).not.toThrow();
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });
});

describe("createDensityRenderer", () => {
  it("creates scatter renderer", () => {
    expect(createDensityRenderer("scatter").id).toBe("scatter");
  });

  it("creates heatmap renderer", () => {
    expect(createDensityRenderer("heatmap").id).toBe("heatmap");
  });

  it("creates bloom renderer", () => {
    expect(createDensityRenderer("bloom").id).toBe("bloom");
  });
});
