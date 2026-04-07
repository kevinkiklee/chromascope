// rendering.test.js — Unit tests for the pure-computation rendering module.
// These tests run in Node via Vitest and require no UXP environment.

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const {
  hsvToRgb,
  renderGraticule,
  renderToBuffer,
  applyHarmonyOverlay,
  invalidateGraticuleCache,
} = require("../rendering.js");

// ---------------------------------------------------------------------------
// hsvToRgb
// ---------------------------------------------------------------------------

describe("hsvToRgb", () => {
  test("red — hue 0°, s=1, v=1", () => {
    const [r, g, b] = hsvToRgb(0, 1, 1);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  test("green — hue 120°, s=1, v=1", () => {
    const [r, g, b] = hsvToRgb(120, 1, 1);
    expect(r).toBe(0);
    expect(g).toBe(255);
    expect(b).toBe(0);
  });

  test("blue — hue 240°, s=1, v=1", () => {
    const [r, g, b] = hsvToRgb(240, 1, 1);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(255);
  });

  test("black — v=0", () => {
    const [r, g, b] = hsvToRgb(0, 1, 0);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  test("white — s=0, v=1", () => {
    const [r, g, b] = hsvToRgb(0, 0, 1);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });

  test("hue wraps: 360° same as 0°", () => {
    const a = hsvToRgb(0, 1, 1);
    const b = hsvToRgb(360, 1, 1);
    expect(a).toEqual(b);
  });

  test("hue wraps: negative hue is normalized", () => {
    // -120 mod 360 = 240 → blue
    const [r, g, b] = hsvToRgb(-120, 1, 1);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// renderGraticule
// ---------------------------------------------------------------------------

describe("renderGraticule", () => {
  beforeEach(() => {
    // Always start with a clean cache so tests are independent
    invalidateGraticuleCache();
  });

  test("returns Uint8Array of correct size (size*size*4)", () => {
    const size = 64;
    const buf = renderGraticule(size);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(size * size * 4);
  });

  test("returns a larger buffer for a larger size", () => {
    const buf = renderGraticule(128);
    expect(buf.length).toBe(128 * 128 * 4);
  });

  test("caches result — same reference returned for the same size", () => {
    const first = renderGraticule(64);
    const second = renderGraticule(64);
    expect(first).toBe(second);
  });

  test("regenerates when size changes", () => {
    const a = renderGraticule(64);
    const b = renderGraticule(128);
    expect(a).not.toBe(b);
    expect(a.length).toBe(64 * 64 * 4);
    expect(b.length).toBe(128 * 128 * 4);
  });

  test("all pixels have alpha=255", () => {
    const size = 32;
    const buf = renderGraticule(size);
    for (let i = 3; i < buf.length; i += 4) {
      expect(buf[i]).toBe(255);
    }
  });

  test("background color matches Rust BG (9, 9, 11) in at least some pixels", () => {
    const size = 64;
    const buf = renderGraticule(size);
    // The center area should have background-colored pixels (just check a corner
    // which is unlikely to be covered by graticule elements at small sizes)
    // Simply confirm at least one pixel with the expected background exists
    let found = false;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i] === 9 && buf[i + 1] === 9 && buf[i + 2] === 11) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderToBuffer
// ---------------------------------------------------------------------------

// Minimal saturated pixel data: R=255 G=0 B=0 for 2 pixels (RGB triplets)
function makeRedPixels(count = 4) {
  const data = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    data[i * 3] = 255; // R
    data[i * 3 + 1] = 0; // G
    data[i * 3 + 2] = 0; // B
  }
  return { data, width: count, height: 1 };
}

// Mixed pixels used in the task description: 2×2 image with R, G, B, yellow
const mixedPixels = {
  data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 0]),
  width: 2,
  height: 2,
};

describe("renderToBuffer", () => {
  const SIZE = 64;

  beforeEach(() => {
    invalidateGraticuleCache();
  });

  test("returns Uint8Array of size*size*4 — scatter mode", () => {
    const buf = renderToBuffer(SIZE, makeRedPixels(), "scatter", false);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(SIZE * SIZE * 4);
  });

  test("returns Uint8Array of size*size*4 — heatmap mode", () => {
    const buf = renderToBuffer(SIZE, makeRedPixels(), "heatmap", false);
    expect(buf.length).toBe(SIZE * SIZE * 4);
  });

  test("returns Uint8Array of size*size*4 — bloom mode", () => {
    const buf = renderToBuffer(SIZE, makeRedPixels(), "bloom", false);
    expect(buf.length).toBe(SIZE * SIZE * 4);
  });

  test("null pixels returns graticule-only buffer (same size)", () => {
    const buf = renderToBuffer(SIZE, null, "scatter", false);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(SIZE * SIZE * 4);
  });

  test("null pixels output matches graticule directly", () => {
    const graticule = renderGraticule(SIZE);
    const buf = renderToBuffer(SIZE, null, "scatter", false);
    // Should be byte-for-byte identical since no pixels are plotted
    expect(buf).toEqual(graticule);
  });

  test("scatter with pixels differs from graticule-only buffer", () => {
    const withoutPixels = renderToBuffer(SIZE, null, "scatter", false);
    // Use many red pixels to ensure at least one lands inside the scope circle
    const withPixels = renderToBuffer(SIZE, makeRedPixels(100), "scatter", false);
    let differs = false;
    for (let i = 0; i < withoutPixels.length; i++) {
      if (withoutPixels[i] !== withPixels[i]) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  test("heatmap with pixels differs from graticule-only buffer", () => {
    const withoutPixels = renderToBuffer(SIZE, null, "heatmap", false);
    const withPixels = renderToBuffer(SIZE, makeRedPixels(100), "heatmap", false);
    let differs = false;
    for (let i = 0; i < withoutPixels.length; i++) {
      if (withoutPixels[i] !== withPixels[i]) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  test("bloom with pixels differs from graticule-only buffer", () => {
    const withoutPixels = renderToBuffer(SIZE, null, "bloom", false);
    const withPixels = renderToBuffer(SIZE, makeRedPixels(100), "bloom", false);
    let differs = false;
    for (let i = 0; i < withoutPixels.length; i++) {
      if (withoutPixels[i] !== withPixels[i]) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  test("mixed 2×2 pixel data produces correct buffer size — scatter", () => {
    const buf = renderToBuffer(SIZE, mixedPixels, "scatter", false);
    expect(buf.length).toBe(SIZE * SIZE * 4);
  });

  test("mixed 2×2 pixel data produces correct buffer size — heatmap", () => {
    const buf = renderToBuffer(SIZE, mixedPixels, "heatmap", false);
    expect(buf.length).toBe(SIZE * SIZE * 4);
  });

  test("mixed 2×2 pixel data produces correct buffer size — bloom", () => {
    const buf = renderToBuffer(SIZE, mixedPixels, "bloom", false);
    expect(buf.length).toBe(SIZE * SIZE * 4);
  });

  test("showSkinTone=true produces output that differs from showSkinTone=false", () => {
    const withoutSkin = renderToBuffer(SIZE, makeRedPixels(50), "scatter", false);
    const withSkin = renderToBuffer(SIZE, makeRedPixels(50), "scatter", true);
    let differs = false;
    for (let i = 0; i < withoutSkin.length; i++) {
      if (withoutSkin[i] !== withSkin[i]) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  test("defaults to scatter mode when densityMode is falsy", () => {
    const explicit = renderToBuffer(SIZE, makeRedPixels(50), "scatter", false);
    const implicit = renderToBuffer(SIZE, makeRedPixels(50), null, false);
    expect(explicit).toEqual(implicit);
  });

  test("all alpha channels remain 255 after rendering", () => {
    const buf = renderToBuffer(SIZE, makeRedPixels(100), "scatter", false);
    for (let i = 3; i < buf.length; i += 4) {
      expect(buf[i]).toBe(255);
    }
  });
});

// ---------------------------------------------------------------------------
// applyHarmonyOverlay
// ---------------------------------------------------------------------------

describe("applyHarmonyOverlay", () => {
  const SIZE = 64;

  beforeEach(() => {
    invalidateGraticuleCache();
  });

  test("returns buffer of same length as input", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "complementary", rotation: 0, zoneWidth: 1 });
    expect(result.length).toBe(base.length);
  });

  test("null harmonySettings returns input buffer unchanged", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, null);
    expect(result).toBe(base); // same reference — no copy made
  });

  test("harmonySettings without scheme returns input buffer unchanged", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { rotation: 0 });
    expect(result).toBe(base);
  });

  test("does not mutate the input buffer", () => {
    const base = renderToBuffer(SIZE, makeRedPixels(50), "scatter", false);
    const snapshot = new Uint8Array(base);
    applyHarmonyOverlay(base, SIZE, { scheme: "complementary", rotation: 0, zoneWidth: 1 });
    expect(base).toEqual(snapshot);
  });

  test("complementary scheme modifies output vs input", () => {
    const base = renderToBuffer(SIZE, makeRedPixels(50), "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "complementary", rotation: 0, zoneWidth: 1 });
    let differs = false;
    for (let i = 0; i < base.length; i++) {
      if (base[i] !== result[i]) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  test("triadic scheme returns buffer of correct length", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "triadic", rotation: 0, zoneWidth: 1 });
    expect(result.length).toBe(SIZE * SIZE * 4);
  });

  test("tetradic scheme returns buffer of correct length", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "tetradic", rotation: 0, zoneWidth: 1 });
    expect(result.length).toBe(SIZE * SIZE * 4);
  });

  test("analogous scheme returns buffer of correct length", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "analogous", rotation: 0, zoneWidth: 1 });
    expect(result.length).toBe(SIZE * SIZE * 4);
  });

  test("splitComplementary scheme returns buffer of correct length", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "splitComplementary", rotation: 0, zoneWidth: 1 });
    expect(result.length).toBe(SIZE * SIZE * 4);
  });

  test("unknown scheme returns buffer unchanged", () => {
    const base = renderToBuffer(SIZE, null, "scatter", false);
    const snapshot = new Uint8Array(base);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "unknown", rotation: 0, zoneWidth: 1 });
    // The function returns a copy (new Uint8Array(baseBuf)) and then falls through
    // to return buf without modifications when scheme is unknown
    expect(result).toEqual(snapshot);
  });

  test("all alpha channels remain 255 after overlay", () => {
    const base = renderToBuffer(SIZE, makeRedPixels(50), "scatter", false);
    const result = applyHarmonyOverlay(base, SIZE, { scheme: "triadic", rotation: 0, zoneWidth: 1 });
    for (let i = 3; i < result.length; i += 4) {
      expect(result[i]).toBe(255);
    }
  });
});
