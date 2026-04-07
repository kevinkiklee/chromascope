import { describe, it, expect, vi, beforeEach } from "vitest";
import { scopeToCanvas, renderGraticule, renderGraticuleToContext } from "../src/graticule.js";
import { SKIN_TONE_ANGLE } from "../src/overlays/skin-tone-line.js";

// --- scopeToCanvas ---

describe("scopeToCanvas", () => {
  it("maps center (0,0) to canvas center", () => {
    const { px, py } = scopeToCanvas(0, 0, 500);
    expect(px).toBe(250);
    expect(py).toBe(250);
  });

  it("maps positive x to right of center", () => {
    const { px } = scopeToCanvas(0.5, 0, 500);
    expect(px).toBeGreaterThan(250);
  });

  it("maps positive y to above center (canvas y is inverted)", () => {
    const { py } = scopeToCanvas(0, 0.5, 500);
    expect(py).toBeLessThan(250);
  });

  it("maps (-1,-1) to bottom-left region", () => {
    const { px, py } = scopeToCanvas(-1, -1, 500);
    expect(px).toBeLessThan(250);
    expect(py).toBeGreaterThan(250);
  });

  it("scales with canvas size", () => {
    const small = scopeToCanvas(1, 0, 100);
    const large = scopeToCanvas(1, 0, 1000);
    expect(large.px - 500).toBe((small.px - 50) * 10);
  });

  it("uses 0.45 * size as max radius", () => {
    const { px } = scopeToCanvas(1, 0, 100);
    expect(px).toBe(95); // center=50, maxR=45, px=50+1*45=95
  });

  it("is symmetric: opposite scope coords mirror around center", () => {
    const size = 400;
    const a = scopeToCanvas(0.5, 0.3, size);
    const b = scopeToCanvas(-0.5, -0.3, size);
    expect(a.px + b.px).toBeCloseTo(size, 5);
    expect(a.py + b.py).toBeCloseTo(size, 5);
  });
});

// --- SKIN_TONE_ANGLE ---

describe("SKIN_TONE_ANGLE", () => {
  it("is approximately 123 degrees in radians", () => {
    const expected = (123 * Math.PI) / 180;
    expect(SKIN_TONE_ANGLE).toBeCloseTo(expected, 10);
  });

  it("is between 90 and 180 degrees (upper-left quadrant)", () => {
    expect(SKIN_TONE_ANGLE).toBeGreaterThan(Math.PI / 2);
    expect(SKIN_TONE_ANGLE).toBeLessThan(Math.PI);
  });
});

// --- renderGraticule ---

function createMockCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "center",
    textBaseline: "middle",
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

/**
 * renderGraticule now caches to an OffscreenCanvas and blits via drawImage.
 * Detailed drawing assertions use renderGraticuleToContext directly.
 * renderGraticule tests verify the public contract: drawImage is called.
 */
describe("renderGraticule", () => {
  it("clears and fills background", () => {
    const ctx = createMockCtx();
    renderGraticuleToContext(ctx, 300);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 300, 300);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 300, 300);
  });

  it("draws 4 concentric circles (25%, 50%, 75%, 100%)", () => {
    const ctx = createMockCtx();
    const size = 400;
    renderGraticuleToContext(ctx, size);
    const maxR = size * 0.45;
    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    // Collect all arc radii drawn at canvas center
    const cx = size / 2;
    const cy = size / 2;
    const radiiAtCenter = arcCalls
      .filter((c: number[]) => c[0] === cx && c[1] === cy)
      .map((c: number[]) => c[2]);

    for (const frac of [0.25, 0.5, 0.75, 1.0]) {
      const expected = maxR * frac;
      const found = radiiAtCenter.some((r: number) => Math.abs(r - expected) < 0.01);
      expect(found, `expected ring at ${frac * 100}% (r=${expected})`).toBe(true);
    }
  });

  it("draws 6 hue labels (R, Y, G, C, B, M)", () => {
    const ctx = createMockCtx();
    renderGraticuleToContext(ctx, 500);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const labels = textCalls.map((c: string[]) => c[0]);
    expect(labels).toContain("R");
    expect(labels).toContain("Y");
    expect(labels).toContain("G");
    expect(labels).toContain("C");
    expect(labels).toContain("B");
    expect(labels).toContain("M");
  });

  it("draws crosshair lines through center", () => {
    const ctx = createMockCtx();
    const size = 600;
    renderGraticuleToContext(ctx, size);
    const moveCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const cx = size / 2;
    const cy = size / 2;
    // Should have a moveTo at (cx - maxR, cy) for horizontal line
    const hasHorizontalStart = moveCalls.some(
      (c: number[]) => Math.abs(c[1] - cy) < 1 && c[0] < cx,
    );
    expect(hasHorizontalStart).toBe(true);
  });

  it("draws a center dot", () => {
    const ctx = createMockCtx();
    renderGraticuleToContext(ctx, 200);
    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    // Center dot: arc at (cx, cy) with small radius (2px)
    const centerDot = arcCalls.find(
      (c: number[]) => c[0] === 100 && c[1] === 100 && c[2] === 2,
    );
    expect(centerDot).toBeDefined();
  });

  it("scales font size with canvas size", () => {
    const ctx = createMockCtx();
    renderGraticuleToContext(ctx, 800);
    const fontSize = Math.round(800 * 0.04);
    expect(ctx.font).toContain(`${fontSize}px`);
  });

  it("blits to the real context via drawImage", () => {
    const ctx = createMockCtx();
    renderGraticule(ctx, 700);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    const [source, x, y] = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(source).toBeInstanceOf(OffscreenCanvas);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it("uses the offscreen cache on repeated calls with the same size", () => {
    const ctx1 = createMockCtx();
    const ctx2 = createMockCtx();
    renderGraticule(ctx1, 900);
    renderGraticule(ctx2, 900);
    // Both calls should blit via drawImage using the same cached OffscreenCanvas
    const source1 = (ctx1.drawImage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const source2 = (ctx2.drawImage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(source1).toBe(source2);
  });
});
