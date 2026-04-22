import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// pixelmatch v7 is ESM-only; import lazily via dynamic import
let pixelmatch: (
  img1: Uint8Array | Uint8ClampedArray,
  img2: Uint8Array | Uint8ClampedArray,
  output: Uint8Array | Uint8ClampedArray | null,
  width: number,
  height: number,
  options?: { threshold?: number; includeAA?: boolean }
) => number;

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "../../../");
const MATRIX_PATH = path.join(REPO_ROOT, "tests/fixtures/test_matrix.txt");
const BUILD_HTML = path.resolve(__dirname, "../build/index.html");
const BASELINES_DIR = path.resolve(__dirname, "baselines");
const RESULTS_DIR = path.join(REPO_ROOT, "test-results");
const RESULTS_JSON = path.join(RESULTS_DIR, "core-visual-results.json");
const UPDATE_BASELINES = !!process.env["UPDATE_BASELINES"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestConfig {
  colorSpace: string;
  density: string;
  scheme: string;
  skinTone: string;
  rotation: string;
}

interface TestResult {
  name: string;
  input: string;
  status: "passed" | "failed" | "baseline-saved";
  diffPixels?: number;
  totalPixels?: number;
  diffPercent?: number;
  error?: string;
}

// ── Matrix parsing ─────────────────────────────────────────────────────────────

function parseMatrix(): TestConfig[] {
  const content = fs.readFileSync(MATRIX_PATH, "utf-8");
  return content
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((line) => {
      const [colorSpace, density, scheme, skinTone, rotation] = line.split("\t");
      return { colorSpace, density, scheme, skinTone, rotation };
    });
}

// ── Config → settings conversion ──────────────────────────────────────────────

function toSettings(c: TestConfig): Record<string, unknown> {
  return {
    colorSpace: c.colorSpace,
    densityMode: c.density,
    harmony:
      c.scheme === "none"
        ? { scheme: null, rotation: 0, zoneWidth: 0.1, pullStrengths: [] }
        : {
            scheme: c.scheme,
            rotation: (parseFloat(c.rotation) * Math.PI) / 180,
            zoneWidth: 0.1,
            pullStrengths: [],
          },
  };
}

// ── Config name ────────────────────────────────────────────────────────────────

function configName(c: TestConfig): string {
  return `${c.colorSpace}_${c.density}_${c.scheme}_skin${c.skinTone}_rot${c.rotation}`;
}

// ── Pixel generators (128×128 RGBA) ───────────────────────────────────────────

function makeSolidWarm(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 128 * 128; i++) {
    out.push(200, 100, 50, 255);
  }
  return out;
}

function makeQuadrant(): number[] {
  const out: number[] = [];
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      if (y < 64 && x < 64) out.push(255, 0, 0, 255);       // TL: red
      else if (y < 64 && x >= 64) out.push(0, 255, 0, 255); // TR: green
      else if (y >= 64 && x < 64) out.push(0, 0, 255, 255); // BL: blue
      else out.push(255, 255, 255, 255);                      // BR: white
    }
  }
  return out;
}

function makeNeutralGray(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 128 * 128; i++) {
    out.push(128, 128, 128, 255);
  }
  return out;
}

function makeSaturated(): number[] {
  // 6 horizontal bands: R, G, B, C, M, Y — each ~21px tall
  const bands: [number, number, number][] = [
    [255, 0, 0],    // R
    [0, 255, 0],    // G
    [0, 0, 255],    // B
    [0, 255, 255],  // C
    [255, 0, 255],  // M
    [255, 255, 0],  // Y
  ];
  const out: number[] = [];
  for (let y = 0; y < 128; y++) {
    const band = Math.min(Math.floor((y / 128) * 6), 5);
    const [r, g, b] = bands[band];
    for (let x = 0; x < 128; x++) {
      out.push(r, g, b, 255);
    }
  }
  return out;
}

function makeWarmSkin(): number[] {
  // vertical gradient from (200, 140, 100) to (255, 180, 130)
  const out: number[] = [];
  for (let y = 0; y < 128; y++) {
    const t = y / 127;
    const r = Math.round(200 + t * (255 - 200));
    const g = Math.round(140 + t * (180 - 140));
    const b = Math.round(100 + t * (130 - 100));
    for (let x = 0; x < 128; x++) {
      out.push(r, g, b, 255);
    }
  }
  return out;
}

const INPUT_GENERATORS: Record<string, () => number[]> = {
  solid_warm: makeSolidWarm,
  quadrant: makeQuadrant,
  neutral_gray: makeNeutralGray,
  saturated: makeSaturated,
  warm_skin: makeWarmSkin,
};

const INPUT_NAMES = Object.keys(INPUT_GENERATORS);

// ── PNG helpers ────────────────────────────────────────────────────────────────

function decodePng(buf: Buffer): { data: Buffer; width: number; height: number } {
  const png = PNG.sync.read(buf);
  return { data: png.data, width: png.width, height: png.height };
}

// ── Results accumulation ───────────────────────────────────────────────────────

const allResults: TestResult[] = [];

// ── Load pixelmatch (ESM) before test suite ────────────────────────────────────

test.beforeAll(async () => {
  const mod = await import("pixelmatch");
  pixelmatch = mod.default;

  // Ensure directories exist
  fs.mkdirSync(BASELINES_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
});

test.afterAll(() => {
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(allResults, null, 2));
});

// ── Test suite ─────────────────────────────────────────────────────────────────

const matrix = parseMatrix();

test.describe("Visual Regression", () => {
  for (const cfg of matrix) {
    const cfgName = configName(cfg);

    for (const inputName of INPUT_NAMES) {
      const fullName = `${inputName}__${cfgName}`;

      test(fullName, async ({ page }) => {
        const result: TestResult = {
          name: fullName,
          input: inputName,
          status: "passed",
        };

        try {
          // Navigate to built app with test flag
          await page.goto(`file://${BUILD_HTML}?test=true`);

          // Wait for the test hook to be exposed
          await page.waitForFunction(
            () =>
              typeof (window as any).__chromascopeTest !== "undefined" &&
              typeof (window as any).__chromascopeTest.injectPixels === "function",
            { timeout: 10_000 }
          );

          // Generate pixel data in Node and pass to page
          const rgbaArray = INPUT_GENERATORS[inputName]();
          await page.evaluate(
            ({ pixels, w, h }: { pixels: number[]; w: number; h: number }) => {
              (window as any).__chromascopeTest.injectPixels(pixels, w, h);
            },
            { pixels: rgbaArray, w: 128, h: 128 }
          );

          // Apply settings
          const settings = toSettings(cfg);
          await page.evaluate((s: Record<string, unknown>) => {
            (window as any).__chromascopeTest.updateSettings(s);
          }, settings);

          // Small settle time for canvas render
          await page.waitForTimeout(100);

          // Capture canvas as PNG data URL
          const dataUrl = await page.evaluate(() => {
            const canvas = (window as any).__chromascopeTest.canvas as HTMLCanvasElement;
            return canvas.toDataURL("image/png");
          });

          // Convert base64 data URL to Buffer
          const base64 = dataUrl.split(",")[1];
          const actualBuf = Buffer.from(base64, "base64");

          const baselinePath = path.join(BASELINES_DIR, `${fullName}.png`);

          if (UPDATE_BASELINES) {
            // Save actual as new baseline
            fs.writeFileSync(baselinePath, actualBuf);
            result.status = "baseline-saved";
          } else {
            if (!fs.existsSync(baselinePath)) {
              result.status = "failed";
              result.error = `No baseline found. Run with UPDATE_BASELINES=1 to create it.`;
              allResults.push(result);
              throw new Error(result.error);
            }

            // Compare against baseline
            const baselineBuf = fs.readFileSync(baselinePath);
            const actual = decodePng(actualBuf);
            const expected = decodePng(baselineBuf);

            if (actual.width !== expected.width || actual.height !== expected.height) {
              result.status = "failed";
              result.error = `Size mismatch: actual ${actual.width}×${actual.height} vs baseline ${expected.width}×${expected.height}`;
              allResults.push(result);
              throw new Error(result.error);
            }

            const totalPixels = actual.width * actual.height;
            const diffData = new Uint8Array(totalPixels * 4);
            const diffCount = pixelmatch(
              actual.data as unknown as Uint8Array,
              expected.data as unknown as Uint8Array,
              diffData,
              actual.width,
              actual.height,
              { threshold: 0.1, includeAA: true }
            );

            const diffPercent = diffCount / totalPixels;
            result.diffPixels = diffCount;
            result.totalPixels = totalPixels;
            result.diffPercent = diffPercent;

            if (diffPercent > 0.001) {
              result.status = "failed";
              result.error = `Too many diff pixels: ${diffCount} (${(diffPercent * 100).toFixed(2)}% > 0.1%)`;
              allResults.push(result);
              throw new Error(result.error);
            }

            result.status = "passed";
          }
        } catch (err) {
          if (!result.error) {
            result.error = String(err);
            result.status = "failed";
          }
          allResults.push(result);
          throw err;
        }

        allResults.push(result);
      });
    }
  }
});
