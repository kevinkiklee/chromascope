import { describe, it, expect, vi } from "vitest";
import { Chromascope } from "../src/chromascope.js";

function createMockCanvas(size: number) {
  const imageData = { data: new Uint8ClampedArray(size * size * 4), width: size, height: size };
  return {
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
}

// --- Construction ---

describe("Chromascope construction", () => {
  it("uses default settings when none provided", () => {
    const scope = new Chromascope();
    expect(scope.settings.colorSpace).toBe("ycbcr");
    expect(scope.settings.densityMode).toBe("scatter");
    expect(scope.settings.logScale).toBe(false);
  });

  it("accepts partial initial settings", () => {
    const scope = new Chromascope({ densityMode: "heatmap", logScale: true });
    expect(scope.settings.densityMode).toBe("heatmap");
    expect(scope.settings.logScale).toBe(true);
    expect(scope.settings.colorSpace).toBe("ycbcr"); // default preserved
  });

  it("starts with no mapped points", () => {
    const scope = new Chromascope();
    expect(scope.mappedPoints).toEqual([]);
  });

  it("starts with no harmony zones by default", () => {
    const scope = new Chromascope();
    expect(scope.harmonyZones).toEqual([]);
  });
});

// --- Settings updates ---

describe("Chromascope settings", () => {
  it("merges partial updates without overwriting other fields", () => {
    const scope = new Chromascope({ densityMode: "bloom" });
    scope.updateSettings({ logScale: true });
    expect(scope.settings.densityMode).toBe("bloom");
    expect(scope.settings.logScale).toBe(true);
  });

  it("re-maps points when color space changes", () => {
    const scope = new Chromascope();
    scope.setPixels({ data: new Uint8Array([255, 0, 0]), width: 1, height: 1, colorProfile: "sRGB" });
    const before = { ...scope.mappedPoints[0] };

    scope.updateSettings({ colorSpace: "hsl" });
    const after = scope.mappedPoints[0];
    expect(after.x).not.toBeCloseTo(before.x, 2);
  });

  it("computes harmony zones when scheme is set", () => {
    const scope = new Chromascope({
      harmony: { scheme: "triadic", rotation: 0, zoneWidth: 1, pullStrengths: [] },
    });
    expect(scope.harmonyZones).toHaveLength(3);
  });

  it("recomputes zones when harmony settings change", () => {
    const scope = new Chromascope();
    expect(scope.harmonyZones).toHaveLength(0);

    scope.updateSettings({
      harmony: { scheme: "complementary", rotation: 0, zoneWidth: 1, pullStrengths: [] },
    });
    expect(scope.harmonyZones).toHaveLength(2);
  });

  it("clears zones when scheme set to null", () => {
    const scope = new Chromascope({
      harmony: { scheme: "triadic", rotation: 0, zoneWidth: 1, pullStrengths: [] },
    });
    expect(scope.harmonyZones).toHaveLength(3);

    scope.updateSettings({
      harmony: { scheme: null, rotation: 0, zoneWidth: 1, pullStrengths: [] },
    });
    expect(scope.harmonyZones).toHaveLength(0);
  });
});

// --- Pixel processing ---

describe("Chromascope pixel processing", () => {
  it("maps a 2x2 RGBW image to 4 points", () => {
    const scope = new Chromascope();
    const data = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
    scope.setPixels({ data, width: 2, height: 2, colorProfile: "sRGB" });
    expect(scope.mappedPoints).toHaveLength(4);
  });

  it("maps white to near-center (low radius)", () => {
    const scope = new Chromascope();
    scope.setPixels({ data: new Uint8Array([255, 255, 255]), width: 1, height: 1, colorProfile: "sRGB" });
    expect(scope.mappedPoints[0].radius).toBeLessThan(0.05);
  });

  it("maps black to near-center (low radius)", () => {
    const scope = new Chromascope();
    scope.setPixels({ data: new Uint8Array([0, 0, 0]), width: 1, height: 1, colorProfile: "sRGB" });
    expect(scope.mappedPoints[0].radius).toBeLessThan(0.05);
  });

  it("maps saturated colors away from center", () => {
    const scope = new Chromascope();
    scope.setPixels({ data: new Uint8Array([255, 0, 0]), width: 1, height: 1, colorProfile: "sRGB" });
    expect(scope.mappedPoints[0].radius).toBeGreaterThan(0.3);
  });

  it("preserves original RGB in mapped points", () => {
    const scope = new Chromascope();
    scope.setPixels({ data: new Uint8Array([100, 150, 200]), width: 1, height: 1, colorProfile: "sRGB" });
    const p = scope.mappedPoints[0];
    expect(p.r).toBe(100);
    expect(p.g).toBe(150);
    expect(p.b).toBe(200);
  });

  it("handles a larger pixel array (64x64)", () => {
    const scope = new Chromascope();
    const count = 64 * 64;
    const data = new Uint8Array(count * 3);
    for (let i = 0; i < count; i++) {
      data[i * 3] = i % 256;
      data[i * 3 + 1] = (i * 2) % 256;
      data[i * 3 + 2] = (i * 3) % 256;
    }
    scope.setPixels({ data, width: 64, height: 64, colorProfile: "sRGB" });
    expect(scope.mappedPoints).toHaveLength(count);
  });

  it("replaces previous points when new pixels are set", () => {
    const scope = new Chromascope();
    scope.setPixels({ data: new Uint8Array([255, 0, 0, 0, 255, 0]), width: 2, height: 1, colorProfile: "sRGB" });
    expect(scope.mappedPoints).toHaveLength(2);

    scope.setPixels({ data: new Uint8Array([0, 0, 255]), width: 1, height: 1, colorProfile: "sRGB" });
    expect(scope.mappedPoints).toHaveLength(1);
  });
});

// --- setPixels validation ---

describe("Chromascope.setPixels validation", () => {
  it("throws on data length mismatch", () => {
    const scope = new Chromascope();
    expect(() =>
      scope.setPixels({
        data: new Uint8Array(10),
        width: 2,
        height: 2,
        colorProfile: "sRGB",
      })
    ).toThrow("data length");
  });

  it("throws on zero width", () => {
    const scope = new Chromascope();
    expect(() =>
      scope.setPixels({
        data: new Uint8Array(0),
        width: 0,
        height: 1,
        colorProfile: "sRGB",
      })
    ).toThrow("width and height must be greater than zero");
  });

  it("accepts valid pixel data", () => {
    const scope = new Chromascope();
    expect(() =>
      scope.setPixels({
        data: new Uint8Array(12),
        width: 2,
        height: 2,
        colorProfile: "sRGB",
      })
    ).not.toThrow();
  });
});

// --- Rendering ---

describe("Chromascope rendering", () => {
  it("renders without error on a plain scope", () => {
    const scope = new Chromascope();
    const ctx = createMockCanvas(300);
    scope.setPixels({ data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]), width: 3, height: 1, colorProfile: "sRGB" });
    expect(() => scope.render(ctx, 300)).not.toThrow();
  });

  it("renders with harmony overlay without error", () => {
    const scope = new Chromascope({
      harmony: { scheme: "analogous", rotation: Math.PI / 4, zoneWidth: 1.5, pullStrengths: [0.8, 0.6, 0.4] },
    });
    const ctx = createMockCanvas(300);
    scope.setPixels({ data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]), width: 3, height: 1, colorProfile: "sRGB" });
    expect(() => scope.render(ctx, 300)).not.toThrow();
  });

  it("renders with no pixel data without error", () => {
    const scope = new Chromascope();
    const ctx = createMockCanvas(200);
    expect(() => scope.render(ctx, 200)).not.toThrow();
  });

  it("renders with all density modes without error", () => {
    for (const mode of ["scatter", "heatmap", "bloom"] as const) {
      const scope = new Chromascope({ densityMode: mode });
      const ctx = createMockCanvas(300);
      scope.setPixels({ data: new Uint8Array([200, 100, 50]), width: 1, height: 1, colorProfile: "sRGB" });
      expect(() => scope.render(ctx, 300)).not.toThrow();
    }
  });
});
