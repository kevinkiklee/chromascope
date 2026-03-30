import { describe, it, expect, vi } from "vitest";
import { Vectorscope } from "../src/vectorscope.js";

// Mock a minimal canvas element
function createMockCanvas(size: number) {
  const imageData = { data: new Uint8ClampedArray(size * size * 4), width: size, height: size };
  const ctx = {
    canvas: { width: size, height: size },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    createImageData: vi.fn(() => imageData),
    putImageData: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    getImageData: vi.fn(() => imageData),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    closePath: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  return ctx;
}

describe("Vectorscope", () => {
  it("constructs with default settings", () => {
    const scope = new Vectorscope();
    expect(scope.settings.colorSpace).toBe("ycbcr");
    expect(scope.settings.densityMode).toBe("scatter");
  });

  it("accepts custom initial settings", () => {
    const scope = new Vectorscope({
      colorSpace: "hsl",
      densityMode: "heatmap",
      logScale: true,
    });
    expect(scope.settings.colorSpace).toBe("hsl");
    expect(scope.settings.densityMode).toBe("heatmap");
  });

  it("updates settings", () => {
    const scope = new Vectorscope();
    scope.updateSettings({ colorSpace: "cieluv" });
    expect(scope.settings.colorSpace).toBe("cieluv");
    expect(scope.settings.densityMode).toBe("scatter"); // unchanged
  });

  it("processes pixel data and maps points", () => {
    const scope = new Vectorscope();
    // 2x2 image: red, green, blue, white
    const data = new Uint8Array([
      255, 0, 0,     // red
      0, 255, 0,     // green
      0, 0, 255,     // blue
      255, 255, 255, // white
    ]);

    scope.setPixels({ data, width: 2, height: 2, colorProfile: "sRGB" });

    expect(scope.mappedPoints.length).toBe(4);
    // White should be near center
    const whitePoint = scope.mappedPoints[3];
    expect(whitePoint.radius).toBeLessThan(0.1);
  });

  it("renders without error when given a canvas context", () => {
    const scope = new Vectorscope();
    const ctx = createMockCanvas(300);

    const data = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    scope.setPixels({ data, width: 3, height: 1, colorProfile: "sRGB" });

    expect(() => scope.render(ctx, 300)).not.toThrow();
  });

  it("re-maps points when color space changes", () => {
    const scope = new Vectorscope();
    const data = new Uint8Array([255, 0, 0]);
    scope.setPixels({ data, width: 1, height: 1, colorProfile: "sRGB" });

    const ycbcrPoint = { ...scope.mappedPoints[0] };

    scope.updateSettings({ colorSpace: "hsl" });
    const hslPoint = scope.mappedPoints[0];

    // Different color spaces produce different coordinates
    expect(hslPoint.x).not.toBeCloseTo(ycbcrPoint.x, 2);
  });
});
