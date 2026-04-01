# Plan 1: Monorepo Setup + Core Vectorscope Display Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Turborepo monorepo and build a fully working vectorscope display engine (Canvas 2D) that can be tested standalone in a browser with mock pixel data.

**Architecture:** TypeScript Canvas 2D application in `packages/core/`. Receives RGB pixel arrays via `postMessage`, converts to selected color space (YCbCr, CIE LUV, HSL), renders via selected density mode (Scatter, Heatmap, Bloom) on a circular vectorscope display. Bundled to a single HTML file via Vite for embedding in host plugins.

**Tech Stack:** TypeScript, Vite, Vitest, Canvas 2D API, Turborepo

**Reference docs:**
- Design spec: `docs/superpowers/specs/2026-03-29-vectorscope-plugin-design.md`
- Photoshop UXP SDK: `docs/reference/photoshop-uxp-sdk-research.md`
- LrC SDK: `docs/reference/lrc-sdk-research.md`

---

## File Map

```
vectorscope/
├── package.json                        # Root workspace config
├── turbo.json                          # Turborepo pipeline config
├── tsconfig.base.json                  # Shared TS config
├── .gitignore                          # Updated with node_modules, dist, etc.
├── packages/
│   └── core/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts              # Builds to single HTML file
│       ├── src/
│       │   ├── index.html              # Entry point (loads vectorscope.ts)
│       │   ├── vectorscope.ts          # Main orchestrator
│       │   ├── types.ts               # Shared types (MappedPoint, Settings, Messages)
│       │   ├── protocol.ts            # Message send/receive helpers
│       │   ├── color-spaces/
│       │   │   ├── index.ts           # ColorSpaceMapper interface + factory
│       │   │   ├── ycbcr.ts           # YCbCr mapper
│       │   │   ├── cieluv.ts          # CIE LUV mapper
│       │   │   └── hsl.ts            # HSL mapper
│       │   ├── renderers/
│       │   │   ├── index.ts           # DensityRenderer interface + factory
│       │   │   ├── scatter.ts         # Scatter plot renderer
│       │   │   ├── heatmap.ts         # Heatmap renderer
│       │   │   └── bloom.ts          # Bloom/glow renderer
│       │   ├── graticule.ts           # Circular grid, labels, hue ring
│       │   └── ui/
│       │       ├── controls.ts        # Settings panel (color space, density, etc.)
│       │       └── styles.css         # Panel styling
│       ├── test/
│       │   ├── color-spaces/
│       │   │   ├── ycbcr.test.ts
│       │   │   ├── cieluv.test.ts
│       │   │   └── hsl.test.ts
│       │   ├── renderers/
│       │   │   ├── scatter.test.ts
│       │   │   ├── heatmap.test.ts
│       │   │   └── bloom.test.ts
│       │   └── vectorscope.test.ts
│       └── dev/
│           └── harness.html           # Standalone test page with mock pixel data
```

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize root package.json**

```bash
cd /Users/iser/workspace/vectorscope
```

Create `package.json`:

```json
{
  "name": "vectorscope",
  "private": true,
  "workspaces": [
    "packages/*",
    "plugins/*",
    "web"
  ],
  "devDependencies": {
    "turbo": "^2"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint"
  }
}
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Update .gitignore**

Append to existing `.gitignore`:

```
node_modules/
dist/
build/
.turbo/
*.tsbuildinfo
.env*.local
```

- [ ] **Step 5: Install dependencies and verify**

Run: `npm install`

Expected: `node_modules/` created, `turbo` available.

Run: `npx turbo --version`

Expected: prints turbo version (2.x).

- [ ] **Step 6: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .gitignore package-lock.json
git commit -m "feat: initialize Turborepo monorepo"
```

---

### Task 2: Core Package Scaffolding

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vite.config.ts`
- Create: `packages/core/src/index.html`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@vectorscope/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^6",
    "vitest": "^3",
    "vite-plugin-singlefile": "^2"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create packages/core/vite.config.ts**

This config bundles everything into a single HTML file (for embedding in WebViews):

```typescript
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../build",
    emptyOutDir: true,
  },
  plugins: [viteSingleFile()],
  test: {
    include: ["../test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create packages/core/src/index.html**

Minimal shell that loads the vectorscope:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vectorscope</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a1a; color: #e0e0e0; font-family: system-ui, sans-serif; }
    #vectorscope-root { width: 100%; height: 100%; display: flex; flex-direction: column; }
    #scope-canvas-container { flex: 1; position: relative; min-height: 0; }
    #controls-container { flex-shrink: 0; }
  </style>
</head>
<body>
  <div id="vectorscope-root">
    <div id="scope-canvas-container"></div>
    <div id="controls-container"></div>
  </div>
  <script type="module" src="./vectorscope.ts"></script>
</body>
</html>
```

- [ ] **Step 5: Install dependencies**

```bash
cd /Users/iser/workspace/vectorscope && npm install
```

Expected: `packages/core/node_modules/` created with vite, vitest, typescript.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json packages/core/tsconfig.json packages/core/vite.config.ts packages/core/src/index.html
git commit -m "feat: scaffold core package with Vite + Vitest"
```

---

### Task 3: Types and Message Protocol

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/protocol.ts`

- [ ] **Step 1: Create types.ts**

All shared types for the core engine:

```typescript
// packages/core/src/types.ts

/** A pixel mapped to vectorscope coordinates */
export interface MappedPoint {
  /** X position on scope (-1 to 1, center is 0) */
  x: number;
  /** Y position on scope (-1 to 1, center is 0) */
  y: number;
  /** Hue angle in radians (0 = right, counter-clockwise) */
  angle: number;
  /** Distance from center (0 to 1) */
  radius: number;
  /** Original RGB for coloring the dot */
  r: number;
  g: number;
  b: number;
}

export type ColorSpaceId = "ycbcr" | "cieluv" | "hsl";
export type DensityModeId = "scatter" | "heatmap" | "bloom";

export interface ColorSpaceMapper {
  readonly id: ColorSpaceId;
  readonly label: string;
  mapPixel(r: number, g: number, b: number): MappedPoint;
}

export interface DensityRenderer {
  readonly id: DensityModeId;
  readonly label: string;
  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void;
}

export interface VectorscopeSettings {
  colorSpace: ColorSpaceId;
  densityMode: DensityModeId;
  logScale: boolean;
}

/** Raw pixel data from host plugin */
export interface PixelData {
  /** Interleaved RGB bytes: [R0,G0,B0, R1,G1,B1, ...] */
  data: Uint8Array;
  width: number;
  height: number;
  colorProfile: string;
}
```

- [ ] **Step 2: Create protocol.ts**

Message passing between host plugin and WebView core:

```typescript
// packages/core/src/protocol.ts

import type { ColorSpaceId, DensityModeId, VectorscopeSettings } from "./types.js";

// --- Messages from Host → WebView ---

export interface PixelsMessage {
  type: "pixels";
  data: number[];  // RGB array (Uint8Array loses type over postMessage in some WebViews)
  width: number;
  height: number;
  colorProfile: string;
}

export interface HighlightFromHostMessage {
  type: "highlight";
  x: number;
  y: number;
}

export interface SettingsMessage {
  type: "settings";
  colorSpace?: ColorSpaceId;
  densityMode?: DensityModeId;
  logScale?: boolean;
}

export type HostMessage = PixelsMessage | HighlightFromHostMessage | SettingsMessage;

// --- Messages from WebView → Host ---

export interface EditMessage {
  type: "edit";
  mode: "hsl" | "colorGrading" | "curves" | "pixels";
  params: Record<string, number>;
}

export interface HighlightFromScopeMessage {
  type: "highlight";
  region: { angle: number; radius: number; width: number };
}

export type ScopeMessage = EditMessage | HighlightFromScopeMessage;

// --- Helpers ---

/** Send a message to the host plugin */
export function sendToHost(message: ScopeMessage): void {
  window.parent.postMessage(message, "*");
}

/** Register a handler for messages from the host plugin */
export function onHostMessage(handler: (msg: HostMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data;
    if (data && typeof data.type === "string") {
      handler(data as HostMessage);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/protocol.ts
git commit -m "feat: add core types and host message protocol"
```

---

### Task 4: YCbCr Color Space Mapper

**Files:**
- Create: `packages/core/src/color-spaces/ycbcr.ts`
- Create: `packages/core/src/color-spaces/index.ts`
- Create: `packages/core/test/color-spaces/ycbcr.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/color-spaces/ycbcr.test.ts

import { describe, it, expect } from "vitest";
import { YCbCrMapper } from "../../src/color-spaces/ycbcr.js";

const mapper = new YCbCrMapper();

describe("YCbCrMapper", () => {
  it("has correct id and label", () => {
    expect(mapper.id).toBe("ycbcr");
    expect(mapper.label).toBe("YCbCr");
  });

  it("maps neutral gray to center (0,0)", () => {
    const p = mapper.mapPixel(128, 128, 128);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure white to center (achromatic)", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
  });

  it("maps pure black to center (achromatic)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(0, 1);
  });

  it("maps pure red to positive Cr region", () => {
    const p = mapper.mapPixel(255, 0, 0);
    // Cr (red-difference) is the Y axis, should be positive for red
    expect(p.y).toBeGreaterThan(0.3);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("maps pure blue to positive Cb region", () => {
    const p = mapper.mapPixel(0, 0, 255);
    // Cb (blue-difference) is the X axis, should be positive for blue
    expect(p.x).toBeGreaterThan(0.3);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("returns angle in radians", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.angle).toBeGreaterThanOrEqual(-Math.PI);
    expect(p.angle).toBeLessThanOrEqual(Math.PI);
  });

  it("preserves original RGB in output", () => {
    const p = mapper.mapPixel(100, 150, 200);
    expect(p.r).toBe(100);
    expect(p.g).toBe(150);
    expect(p.b).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/color-spaces/ycbcr.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement YCbCr mapper**

```typescript
// packages/core/src/color-spaces/ycbcr.ts

import type { ColorSpaceMapper, MappedPoint } from "../types.js";

/**
 * YCbCr color space mapper.
 * Maps RGB to Cb (blue-difference) on X axis, Cr (red-difference) on Y axis.
 * Uses BT.601 coefficients. Cb and Cr are normalized to [-0.5, 0.5] then
 * scaled to [-1, 1] for the vectorscope display.
 */
export class YCbCrMapper implements ColorSpaceMapper {
  readonly id = "ycbcr" as const;
  readonly label = "YCbCr";

  mapPixel(r: number, g: number, b: number): MappedPoint {
    // Normalize to 0-1
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    // BT.601 Cb and Cr (range: -0.5 to 0.5)
    const cb = -0.168736 * rn - 0.331264 * gn + 0.5 * bn;
    const cr = 0.5 * rn - 0.418688 * gn - 0.081312 * bn;

    // Scale to [-1, 1] for display (multiply by 2)
    const x = cb * 2;
    const y = cr * 2;

    const angle = Math.atan2(y, x);
    const radius = Math.sqrt(x * x + y * y);

    return { x, y, angle, radius, r, g, b };
  }
}
```

- [ ] **Step 4: Create color-spaces index with factory**

```typescript
// packages/core/src/color-spaces/index.ts

import type { ColorSpaceMapper, ColorSpaceId } from "../types.js";
import { YCbCrMapper } from "./ycbcr.js";

const mappers: Record<ColorSpaceId, () => ColorSpaceMapper> = {
  ycbcr: () => new YCbCrMapper(),
  cieluv: () => { throw new Error("CIE LUV not yet implemented"); },
  hsl: () => { throw new Error("HSL not yet implemented"); },
};

export function createColorSpaceMapper(id: ColorSpaceId): ColorSpaceMapper {
  return mappers[id]();
}

export { YCbCrMapper } from "./ycbcr.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/color-spaces/ycbcr.test.ts`

Expected: all 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/color-spaces/ packages/core/test/color-spaces/ycbcr.test.ts
git commit -m "feat: add YCbCr color space mapper with tests"
```

---

### Task 5: CIE LUV Color Space Mapper

**Files:**
- Create: `packages/core/src/color-spaces/cieluv.ts`
- Create: `packages/core/test/color-spaces/cieluv.test.ts`
- Modify: `packages/core/src/color-spaces/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/color-spaces/cieluv.test.ts

import { describe, it, expect } from "vitest";
import { CIELUVMapper } from "../../src/color-spaces/cieluv.js";

const mapper = new CIELUVMapper();

describe("CIELUVMapper", () => {
  it("has correct id and label", () => {
    expect(mapper.id).toBe("cieluv");
    expect(mapper.label).toBe("CIE LUV");
  });

  it("maps neutral gray to near center", () => {
    const p = mapper.mapPixel(128, 128, 128);
    expect(p.x).toBeCloseTo(0, 0);
    expect(p.y).toBeCloseTo(0, 0);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps pure white to center (achromatic)", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps pure black to center (achromatic)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.radius).toBeLessThan(0.05);
  });

  it("maps saturated red away from center", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("maps saturated blue away from center", () => {
    const p = mapper.mapPixel(0, 0, 255);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("maps saturated green away from center", () => {
    const p = mapper.mapPixel(0, 255, 0);
    expect(p.radius).toBeGreaterThan(0.3);
  });

  it("produces different angles for red, green, and blue", () => {
    const red = mapper.mapPixel(255, 0, 0);
    const green = mapper.mapPixel(0, 255, 0);
    const blue = mapper.mapPixel(0, 0, 255);
    // All should have distinct angles (at least 60° apart)
    const minSep = Math.PI / 3;
    expect(Math.abs(red.angle - green.angle)).toBeGreaterThan(minSep);
    expect(Math.abs(green.angle - blue.angle)).toBeGreaterThan(minSep);
  });

  it("preserves original RGB", () => {
    const p = mapper.mapPixel(50, 100, 200);
    expect(p.r).toBe(50);
    expect(p.g).toBe(100);
    expect(p.b).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/color-spaces/cieluv.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement CIE LUV mapper**

```typescript
// packages/core/src/color-spaces/cieluv.ts

import type { ColorSpaceMapper, MappedPoint } from "../types.js";

// D65 white point
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;
const un = (4 * Xn) / (Xn + 15 * Yn + 3 * Zn);
const vn = (9 * Yn) / (Xn + 15 * Yn + 3 * Zn);

/** sRGB gamma → linear */
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * CIE LUV color space mapper.
 * Maps RGB → XYZ → CIELUV. Plots u* on X axis, v* on Y axis.
 * Perceptually uniform — equal distances represent equal perceived color differences.
 */
export class CIELUVMapper implements ColorSpaceMapper {
  readonly id = "cieluv" as const;
  readonly label = "CIE LUV";

  /** Max chroma observed for sRGB gamut, used to normalize radius to ~0-1 */
  private readonly maxChroma = 180;

  mapPixel(r: number, g: number, b: number): MappedPoint {
    // sRGB → linear
    const rl = linearize(r / 255);
    const gl = linearize(g / 255);
    const bl = linearize(b / 255);

    // Linear RGB → XYZ (sRGB D65 matrix)
    const X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
    const Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
    const Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;

    // XYZ → CIELUV
    const denom = X + 15 * Y + 3 * Z;
    if (denom === 0) {
      return { x: 0, y: 0, angle: 0, radius: 0, r, g, b };
    }

    const uPrime = (4 * X) / denom;
    const vPrime = (9 * Y) / denom;

    const yr = Y / Yn;
    const L = yr > 0.008856 ? 116 * Math.cbrt(yr) - 16 : 903.3 * yr;

    const uStar = 13 * L * (uPrime - un);
    const vStar = 13 * L * (vPrime - vn);

    // Normalize to ~[-1, 1] using max sRGB chroma
    const x = uStar / this.maxChroma;
    const y = vStar / this.maxChroma;

    const angle = Math.atan2(y, x);
    const radius = Math.sqrt(x * x + y * y);

    return { x, y, angle, radius, r, g, b };
  }
}
```

- [ ] **Step 4: Register in index.ts**

Replace the `cieluv` line in `packages/core/src/color-spaces/index.ts`:

```typescript
// packages/core/src/color-spaces/index.ts

import type { ColorSpaceMapper, ColorSpaceId } from "../types.js";
import { YCbCrMapper } from "./ycbcr.js";
import { CIELUVMapper } from "./cieluv.js";

const mappers: Record<ColorSpaceId, () => ColorSpaceMapper> = {
  ycbcr: () => new YCbCrMapper(),
  cieluv: () => new CIELUVMapper(),
  hsl: () => { throw new Error("HSL not yet implemented"); },
};

export function createColorSpaceMapper(id: ColorSpaceId): ColorSpaceMapper {
  return mappers[id]();
}

export { YCbCrMapper } from "./ycbcr.js";
export { CIELUVMapper } from "./cieluv.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/color-spaces/cieluv.test.ts`

Expected: all 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/color-spaces/ packages/core/test/color-spaces/cieluv.test.ts
git commit -m "feat: add CIE LUV color space mapper with tests"
```

---

### Task 6: HSL Color Space Mapper

**Files:**
- Create: `packages/core/src/color-spaces/hsl.ts`
- Create: `packages/core/test/color-spaces/hsl.test.ts`
- Modify: `packages/core/src/color-spaces/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/color-spaces/hsl.test.ts

import { describe, it, expect } from "vitest";
import { HSLMapper } from "../../src/color-spaces/hsl.js";

const mapper = new HSLMapper();

describe("HSLMapper", () => {
  it("has correct id and label", () => {
    expect(mapper.id).toBe("hsl");
    expect(mapper.label).toBe("HSL");
  });

  it("maps neutral gray to center (zero saturation)", () => {
    const p = mapper.mapPixel(128, 128, 128);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure white to center (zero saturation)", () => {
    const p = mapper.mapPixel(255, 255, 255);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure black to center (zero saturation)", () => {
    const p = mapper.mapPixel(0, 0, 0);
    expect(p.radius).toBeCloseTo(0, 1);
  });

  it("maps pure red to ~0° hue, full saturation", () => {
    const p = mapper.mapPixel(255, 0, 0);
    expect(p.radius).toBeCloseTo(1, 1);
    // Hue 0° = angle 0 radians (pointing right)
    expect(p.angle).toBeCloseTo(0, 1);
  });

  it("maps pure green to ~120° hue", () => {
    const p = mapper.mapPixel(0, 255, 0);
    expect(p.radius).toBeCloseTo(1, 1);
    // 120° = 2π/3 radians
    expect(p.angle).toBeCloseTo((2 * Math.PI) / 3, 1);
  });

  it("maps pure blue to ~240° hue", () => {
    const p = mapper.mapPixel(0, 0, 255);
    expect(p.radius).toBeCloseTo(1, 1);
    // 240° = -2π/3 radians (or 4π/3)
    // atan2 returns [-π, π], so 240° = -120° = -2π/3
    expect(p.angle).toBeCloseTo((-2 * Math.PI) / 3, 1);
  });

  it("maps a desaturated color to smaller radius", () => {
    // Pale pink: low saturation
    const p = mapper.mapPixel(200, 180, 180);
    expect(p.radius).toBeLessThan(0.3);
    expect(p.radius).toBeGreaterThan(0);
  });

  it("preserves original RGB", () => {
    const p = mapper.mapPixel(30, 60, 90);
    expect(p.r).toBe(30);
    expect(p.g).toBe(60);
    expect(p.b).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/color-spaces/hsl.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement HSL mapper**

```typescript
// packages/core/src/color-spaces/hsl.ts

import type { ColorSpaceMapper, MappedPoint } from "../types.js";

/**
 * HSL color space mapper.
 * Hue → angle (0°=right, counter-clockwise), Saturation → radius.
 * Most intuitive mapping — directly corresponds to HSL sliders in PS/LrC.
 */
export class HSLMapper implements ColorSpaceMapper {
  readonly id = "hsl" as const;
  readonly label = "HSL";

  mapPixel(r: number, g: number, b: number): MappedPoint {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;

    // Saturation (HSL)
    const l = (max + min) / 2;
    let s = 0;
    if (delta !== 0) {
      s = l <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
    }

    // Hue in radians
    let hueRad = 0;
    if (delta !== 0) {
      let hueDeg: number;
      if (max === rn) {
        hueDeg = ((gn - bn) / delta) % 6;
      } else if (max === gn) {
        hueDeg = (bn - rn) / delta + 2;
      } else {
        hueDeg = (rn - gn) / delta + 4;
      }
      hueRad = (hueDeg / 6) * 2 * Math.PI;
    }

    // Polar to cartesian
    const radius = s; // saturation is 0-1, maps directly to radius
    const x = radius * Math.cos(hueRad);
    const y = radius * Math.sin(hueRad);

    return { x, y, angle: hueRad, radius, r, g, b };
  }
}
```

- [ ] **Step 4: Register in index.ts**

Replace the full content of `packages/core/src/color-spaces/index.ts`:

```typescript
// packages/core/src/color-spaces/index.ts

import type { ColorSpaceMapper, ColorSpaceId } from "../types.js";
import { YCbCrMapper } from "./ycbcr.js";
import { CIELUVMapper } from "./cieluv.js";
import { HSLMapper } from "./hsl.js";

const mappers: Record<ColorSpaceId, () => ColorSpaceMapper> = {
  ycbcr: () => new YCbCrMapper(),
  cieluv: () => new CIELUVMapper(),
  hsl: () => new HSLMapper(),
};

export function createColorSpaceMapper(id: ColorSpaceId): ColorSpaceMapper {
  return mappers[id]();
}

export { YCbCrMapper } from "./ycbcr.js";
export { CIELUVMapper } from "./cieluv.js";
export { HSLMapper } from "./hsl.js";
```

- [ ] **Step 5: Run all color space tests**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/color-spaces/`

Expected: all tests across all 3 mappers PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/color-spaces/ packages/core/test/color-spaces/hsl.test.ts
git commit -m "feat: add HSL color space mapper with tests"
```

---

### Task 7: Graticule (Scope Background)

**Files:**
- Create: `packages/core/src/graticule.ts`

The graticule draws the static background of the vectorscope: circular grid, hue labels, and tick marks. This is rendered once and cached, then composited under the density plot.

- [ ] **Step 1: Create graticule.ts**

```typescript
// packages/core/src/graticule.ts

/** Standard hue positions for the graticule labels */
const HUE_LABELS: Array<{ label: string; angleDeg: number; color: string }> = [
  { label: "R", angleDeg: 0, color: "#ff4444" },
  { label: "Y", angleDeg: 60, color: "#ffff44" },
  { label: "G", angleDeg: 120, color: "#44ff44" },
  { label: "C", angleDeg: 180, color: "#44ffff" },
  { label: "B", angleDeg: 240, color: "#4444ff" },
  { label: "M", angleDeg: 300, color: "#ff44ff" },
];

/**
 * Renders the vectorscope graticule (background grid) onto a canvas.
 * Call once and cache the result; redraw only on resize.
 *
 * @param ctx - Canvas 2D context to draw on
 * @param size - Canvas width/height in pixels (always square)
 */
export function renderGraticule(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45; // Leave margin for labels

  ctx.clearRect(0, 0, size, size);

  // Background
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, size, size);

  // Concentric circles at 25%, 50%, 75%, 100%
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1;
  for (const frac of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * frac, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshair lines
  ctx.strokeStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.moveTo(cx - maxR, cy);
  ctx.lineTo(cx + maxR, cy);
  ctx.moveTo(cx, cy - maxR);
  ctx.lineTo(cx, cy + maxR);
  ctx.stroke();

  // Diagonal lines (45° increments)
  ctx.strokeStyle = "#222222";
  for (const angleDeg of [45, 135, 225, 315]) {
    const rad = (angleDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * maxR, cy - Math.sin(rad) * maxR);
    ctx.stroke();
  }

  // Hue tick marks and labels
  ctx.font = `bold ${Math.round(size * 0.04)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const { label, angleDeg, color } of HUE_LABELS) {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = -Math.sin(rad); // Canvas Y is inverted

    // Tick mark at 100% radius
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + cosA * maxR * 0.95, cy + sinA * maxR * 0.95);
    ctx.lineTo(cx + cosA * maxR * 1.0, cy + sinA * maxR * 1.0);
    ctx.stroke();

    // Small dot at tick
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + cosA * maxR, cy + sinA * maxR, size * 0.012, 0, Math.PI * 2);
    ctx.fill();

    // Label outside the circle
    ctx.fillStyle = color;
    ctx.fillText(label, cx + cosA * maxR * 1.1, cy + sinA * maxR * 1.1);
  }

  // Center dot
  ctx.fillStyle = "#555555";
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Converts normalized vectorscope coordinates (-1 to 1) to canvas pixel coordinates.
 */
export function scopeToCanvas(x: number, y: number, size: number): { px: number; py: number } {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;
  return {
    px: cx + x * maxR,
    py: cy - y * maxR, // Invert Y for canvas
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/graticule.ts
git commit -m "feat: add vectorscope graticule renderer"
```

---

### Task 8: Scatter Density Renderer

**Files:**
- Create: `packages/core/src/renderers/scatter.ts`
- Create: `packages/core/src/renderers/index.ts`
- Create: `packages/core/test/renderers/scatter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/renderers/scatter.test.ts

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/renderers/scatter.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement scatter renderer**

```typescript
// packages/core/src/renderers/scatter.ts

import type { DensityRenderer, MappedPoint } from "../types.js";
import { scopeToCanvas } from "../graticule.js";

/**
 * Scatter plot renderer.
 * Draws each mapped point as a small colored dot with additive blending.
 * Overlapping dots accumulate brightness, showing density.
 */
export class ScatterRenderer implements DensityRenderer {
  readonly id = "scatter" as const;
  readonly label = "Scatter";

  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // Additive blending
    ctx.globalAlpha = Math.max(0.02, Math.min(0.5, 500 / points.length));

    const dotSize = Math.max(1, Math.round(size / 200));

    for (const p of points) {
      const { px, py } = scopeToCanvas(p.x, p.y, size);
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fillRect(px - dotSize / 2, py - dotSize / 2, dotSize, dotSize);
    }

    ctx.restore();
  }
}
```

- [ ] **Step 4: Create renderers index with factory**

```typescript
// packages/core/src/renderers/index.ts

import type { DensityRenderer, DensityModeId } from "../types.js";
import { ScatterRenderer } from "./scatter.js";

const renderers: Record<DensityModeId, () => DensityRenderer> = {
  scatter: () => new ScatterRenderer(),
  heatmap: () => { throw new Error("Heatmap not yet implemented"); },
  bloom: () => { throw new Error("Bloom not yet implemented"); },
};

export function createDensityRenderer(id: DensityModeId): DensityRenderer {
  return renderers[id]();
}

export { ScatterRenderer } from "./scatter.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/renderers/scatter.test.ts`

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderers/ packages/core/test/renderers/scatter.test.ts
git commit -m "feat: add scatter density renderer with tests"
```

---

### Task 9: Heatmap Density Renderer

**Files:**
- Create: `packages/core/src/renderers/heatmap.ts`
- Create: `packages/core/test/renderers/heatmap.test.ts`
- Modify: `packages/core/src/renderers/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/renderers/heatmap.test.ts

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/renderers/heatmap.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement heatmap renderer**

```typescript
// packages/core/src/renderers/heatmap.ts

import type { DensityRenderer, MappedPoint } from "../types.js";
import { scopeToCanvas } from "../graticule.js";

/** Cold-to-hot color ramp: black → blue → cyan → green → yellow → red → white */
const HEATMAP_COLORS: Array<[number, number, number]> = [
  [0, 0, 0],       // 0%
  [0, 0, 128],     // ~17%
  [0, 128, 255],   // ~33%
  [0, 255, 128],   // ~50%
  [255, 255, 0],   // ~67%
  [255, 64, 0],    // ~83%
  [255, 255, 255], // 100%
];

function heatColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (HEATMAP_COLORS.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  if (idx >= HEATMAP_COLORS.length - 1) return HEATMAP_COLORS[HEATMAP_COLORS.length - 1];

  const a = HEATMAP_COLORS[idx];
  const b = HEATMAP_COLORS[idx + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

/**
 * Heatmap renderer.
 * Bins points into a pixel grid and colors each cell by frequency.
 */
export class HeatmapRenderer implements DensityRenderer {
  readonly id = "heatmap" as const;
  readonly label = "Heatmap";

  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void {
    ctx.save();

    // Build density grid
    const grid = new Float32Array(size * size);
    let maxCount = 0;

    for (const p of points) {
      const { px, py } = scopeToCanvas(p.x, p.y, size);
      const gx = Math.round(px);
      const gy = Math.round(py);
      if (gx >= 0 && gx < size && gy >= 0 && gy < size) {
        const idx = gy * size + gx;
        grid[idx]++;
        if (grid[idx] > maxCount) maxCount = grid[idx];
      }
    }

    // Render grid to ImageData
    const imageData = ctx.createImageData(size, size);
    const pixels = imageData.data;

    if (maxCount > 0) {
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] > 0) {
          // Log scale for better visibility of low-density areas
          const t = Math.log1p(grid[i]) / Math.log1p(maxCount);
          const [r, g, b] = heatColor(t);
          const pi = i * 4;
          pixels[pi] = r;
          pixels[pi + 1] = g;
          pixels[pi + 2] = b;
          pixels[pi + 3] = 255;
        }
        // Else: leave transparent (alpha = 0) so graticule shows through
      }
    }

    ctx.putImageData(imageData, 0, 0);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Register in renderers index**

```typescript
// packages/core/src/renderers/index.ts

import type { DensityRenderer, DensityModeId } from "../types.js";
import { ScatterRenderer } from "./scatter.js";
import { HeatmapRenderer } from "./heatmap.js";

const renderers: Record<DensityModeId, () => DensityRenderer> = {
  scatter: () => new ScatterRenderer(),
  heatmap: () => new HeatmapRenderer(),
  bloom: () => { throw new Error("Bloom not yet implemented"); },
};

export function createDensityRenderer(id: DensityModeId): DensityRenderer {
  return renderers[id]();
}

export { ScatterRenderer } from "./scatter.js";
export { HeatmapRenderer } from "./heatmap.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/renderers/heatmap.test.ts`

Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderers/ packages/core/test/renderers/heatmap.test.ts
git commit -m "feat: add heatmap density renderer with tests"
```

---

### Task 10: Bloom Density Renderer

**Files:**
- Create: `packages/core/src/renderers/bloom.ts`
- Create: `packages/core/test/renderers/bloom.test.ts`
- Modify: `packages/core/src/renderers/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/renderers/bloom.test.ts

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/renderers/bloom.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement bloom renderer**

```typescript
// packages/core/src/renderers/bloom.ts

import type { DensityRenderer, MappedPoint } from "../types.js";
import { scopeToCanvas } from "../graticule.js";

/**
 * Bloom/glow renderer.
 * Draws each point as a radial gradient (glowing dot) with additive blending.
 * Dominant colors where many points overlap create a bright bloom effect.
 */
export class BloomRenderer implements DensityRenderer {
  readonly id = "bloom" as const;
  readonly label = "Bloom";

  render(points: MappedPoint[], ctx: CanvasRenderingContext2D, size: number): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Adaptive: smaller glow for more points, larger for fewer
    const glowRadius = Math.max(2, Math.min(20, size / 20 * (500 / points.length)));
    const alpha = Math.max(0.01, Math.min(0.3, 200 / points.length));

    for (const p of points) {
      const { px, py } = scopeToCanvas(p.x, p.y, size);

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
      gradient.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${alpha})`);
      gradient.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
```

- [ ] **Step 4: Complete the renderers index**

```typescript
// packages/core/src/renderers/index.ts

import type { DensityRenderer, DensityModeId } from "../types.js";
import { ScatterRenderer } from "./scatter.js";
import { HeatmapRenderer } from "./heatmap.js";
import { BloomRenderer } from "./bloom.js";

const renderers: Record<DensityModeId, () => DensityRenderer> = {
  scatter: () => new ScatterRenderer(),
  heatmap: () => new HeatmapRenderer(),
  bloom: () => new BloomRenderer(),
};

export function createDensityRenderer(id: DensityModeId): DensityRenderer {
  return renderers[id]();
}

export { ScatterRenderer } from "./scatter.js";
export { HeatmapRenderer } from "./heatmap.js";
export { BloomRenderer } from "./bloom.js";
```

- [ ] **Step 5: Run all renderer tests**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/renderers/`

Expected: all 9 tests across 3 renderers PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderers/ packages/core/test/renderers/bloom.test.ts
git commit -m "feat: add bloom density renderer with tests"
```

---

### Task 11: Main Vectorscope Orchestrator

**Files:**
- Create: `packages/core/src/vectorscope.ts`
- Create: `packages/core/test/vectorscope.test.ts`

This is the main class that wires together: pixel data → color space mapping → density rendering → canvas output.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/vectorscope.test.ts

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/vectorscope.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the orchestrator**

```typescript
// packages/core/src/vectorscope.ts

import type {
  ColorSpaceMapper,
  DensityRenderer,
  MappedPoint,
  PixelData,
  VectorscopeSettings,
} from "./types.js";
import { createColorSpaceMapper } from "./color-spaces/index.js";
import { createDensityRenderer } from "./renderers/index.js";
import { renderGraticule } from "./graticule.js";

const DEFAULT_SETTINGS: VectorscopeSettings = {
  colorSpace: "ycbcr",
  densityMode: "scatter",
  logScale: false,
};

export class Vectorscope {
  settings: VectorscopeSettings;
  mappedPoints: MappedPoint[] = [];

  private mapper: ColorSpaceMapper;
  private renderer: DensityRenderer;
  private pixels: PixelData | null = null;
  private graticuleCache: ImageData | null = null;
  private graticuleCacheSize = 0;

  constructor(settings?: Partial<VectorscopeSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.mapper = createColorSpaceMapper(this.settings.colorSpace);
    this.renderer = createDensityRenderer(this.settings.densityMode);
  }

  /** Update settings. Re-maps points if color space changed. Swaps renderer if density mode changed. */
  updateSettings(partial: Partial<VectorscopeSettings>): void {
    const prev = { ...this.settings };
    Object.assign(this.settings, partial);

    if (this.settings.colorSpace !== prev.colorSpace) {
      this.mapper = createColorSpaceMapper(this.settings.colorSpace);
      this.remapPoints();
    }

    if (this.settings.densityMode !== prev.densityMode) {
      this.renderer = createDensityRenderer(this.settings.densityMode);
    }
  }

  /** Receive new pixel data from the host plugin. */
  setPixels(pixelData: PixelData): void {
    this.pixels = pixelData;
    this.remapPoints();
  }

  /** Render the full vectorscope onto the given canvas context. */
  render(ctx: CanvasRenderingContext2D, size: number): void {
    // Draw graticule (cached)
    if (this.graticuleCacheSize !== size || !this.graticuleCache) {
      // Render graticule to an offscreen operation then cache
      renderGraticule(ctx, size);
      // For now, render inline. Caching with getImageData is optional optimization.
      this.graticuleCacheSize = size;
    } else {
      renderGraticule(ctx, size);
    }

    // Draw density plot on top
    if (this.mappedPoints.length > 0) {
      this.renderer.render(this.mappedPoints, ctx, size);
    }
  }

  /** Re-map all pixels through the current color space mapper. */
  private remapPoints(): void {
    if (!this.pixels) {
      this.mappedPoints = [];
      return;
    }

    const { data, width, height } = this.pixels;
    const totalPixels = width * height;
    const points: MappedPoint[] = new Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 3;
      points[i] = this.mapper.mapPixel(data[offset], data[offset + 1], data[offset + 2]);
    }

    this.mappedPoints = points;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/vectorscope.test.ts`

Expected: all 6 tests PASS.

- [ ] **Step 5: Run the full test suite**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests across all files PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/vectorscope.ts packages/core/test/vectorscope.test.ts
git commit -m "feat: add main vectorscope orchestrator"
```

---

### Task 12: UI Controls Panel

**Files:**
- Create: `packages/core/src/ui/controls.ts`
- Create: `packages/core/src/ui/styles.css`

The controls panel renders below the scope and lets users toggle color space, density mode, and log scale.

- [ ] **Step 1: Create styles.css**

```css
/* packages/core/src/ui/styles.css */

#controls-container {
  padding: 8px 12px;
  background: #1e1e1e;
  border-top: 1px solid #333;
  font-size: 12px;
}

.vs-control-group {
  margin-bottom: 8px;
}

.vs-control-group:last-child {
  margin-bottom: 0;
}

.vs-control-group summary {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  color: #ccc;
  padding: 4px 0;
}

.vs-control-group summary:hover {
  color: #fff;
}

.vs-control-group[open] summary {
  margin-bottom: 6px;
}

.vs-control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.vs-control-row label {
  flex: 0 0 80px;
  color: #999;
  font-size: 11px;
}

.vs-btn-group {
  display: flex;
  gap: 2px;
}

.vs-btn {
  padding: 3px 10px;
  border: 1px solid #444;
  background: #2a2a2a;
  color: #ccc;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}

.vs-btn:hover {
  background: #3a3a3a;
}

.vs-btn.active {
  background: #4a6fa5;
  border-color: #5a8fd5;
  color: #fff;
}
```

- [ ] **Step 2: Create controls.ts**

```typescript
// packages/core/src/ui/controls.ts

import type { VectorscopeSettings, ColorSpaceId, DensityModeId } from "../types.js";

export interface ControlsCallbacks {
  onSettingsChange: (partial: Partial<VectorscopeSettings>) => void;
}

const COLOR_SPACES: Array<{ id: ColorSpaceId; label: string }> = [
  { id: "ycbcr", label: "YCbCr" },
  { id: "cieluv", label: "CIE LUV" },
  { id: "hsl", label: "HSL" },
];

const DENSITY_MODES: Array<{ id: DensityModeId; label: string }> = [
  { id: "scatter", label: "Scatter" },
  { id: "heatmap", label: "Heatmap" },
  { id: "bloom", label: "Bloom" },
];

/**
 * Renders the settings controls into the given container element.
 * Returns an update function to sync UI when settings change externally.
 */
export function createControls(
  container: HTMLElement,
  initialSettings: VectorscopeSettings,
  callbacks: ControlsCallbacks,
): { update: (settings: VectorscopeSettings) => void } {
  let current = { ...initialSettings };

  function renderButtonGroup<T extends string>(
    items: Array<{ id: T; label: string }>,
    activeId: T,
    onChange: (id: T) => void,
  ): HTMLElement {
    const group = document.createElement("div");
    group.className = "vs-btn-group";

    for (const item of items) {
      const btn = document.createElement("button");
      btn.className = `vs-btn${item.id === activeId ? " active" : ""}`;
      btn.textContent = item.label;
      btn.dataset.id = item.id;
      btn.addEventListener("click", () => {
        onChange(item.id);
        // Update active state
        for (const b of group.querySelectorAll(".vs-btn")) {
          b.classList.toggle("active", (b as HTMLElement).dataset.id === item.id);
        }
      });
      group.appendChild(btn);
    }

    return group;
  }

  // Build DOM
  container.innerHTML = "";

  // Color Space group
  const csGroup = document.createElement("details");
  csGroup.className = "vs-control-group";
  csGroup.open = true;
  csGroup.innerHTML = "<summary>Display</summary>";

  const csRow = document.createElement("div");
  csRow.className = "vs-control-row";
  const csLabel = document.createElement("label");
  csLabel.textContent = "Color Space";
  csRow.appendChild(csLabel);
  csRow.appendChild(
    renderButtonGroup(COLOR_SPACES, current.colorSpace, (id) => {
      current.colorSpace = id;
      callbacks.onSettingsChange({ colorSpace: id });
    }),
  );
  csGroup.appendChild(csRow);

  // Density mode row
  const dmRow = document.createElement("div");
  dmRow.className = "vs-control-row";
  const dmLabel = document.createElement("label");
  dmLabel.textContent = "Density";
  dmRow.appendChild(dmLabel);
  dmRow.appendChild(
    renderButtonGroup(DENSITY_MODES, current.densityMode, (id) => {
      current.densityMode = id;
      callbacks.onSettingsChange({ densityMode: id });
    }),
  );
  csGroup.appendChild(dmRow);

  container.appendChild(csGroup);

  return {
    update(settings: VectorscopeSettings) {
      current = { ...settings };
      // Re-render if needed (for external settings changes)
    },
  };
}
```

- [ ] **Step 3: Import styles in index.html**

Add to `packages/core/src/index.html`, inside `<head>` before the closing `</style>` tag:

Add a new `<link>` after the existing `<style>` block:

```html
  <link rel="stylesheet" href="./ui/styles.css" />
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ui/ packages/core/src/index.html
git commit -m "feat: add settings controls panel UI"
```

---

### Task 13: Wire Up Main Entry Point

**Files:**
- Modify: `packages/core/src/index.html` (add canvas elements)
- Create: `packages/core/src/main.ts` (init logic, replaces vectorscope.ts as entry)

This wires everything together: creates canvases, instantiates the Vectorscope, sets up the controls, and listens for host messages.

- [ ] **Step 1: Update index.html with canvas structure**

Replace the full content of `packages/core/src/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vectorscope</title>
  <link rel="stylesheet" href="./ui/styles.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a1a; color: #e0e0e0; font-family: system-ui, sans-serif; }
    #vectorscope-root { width: 100%; height: 100%; display: flex; flex-direction: column; }
    #scope-canvas-container {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    #scope-canvas {
      image-rendering: pixelated;
    }
    #controls-container { flex-shrink: 0; }
  </style>
</head>
<body>
  <div id="vectorscope-root">
    <div id="scope-canvas-container">
      <canvas id="scope-canvas"></canvas>
    </div>
    <div id="controls-container"></div>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create main.ts**

```typescript
// packages/core/src/main.ts

import { Vectorscope } from "./vectorscope.js";
import { onHostMessage } from "./protocol.js";
import { createControls } from "./ui/controls.js";
import type { PixelData, VectorscopeSettings } from "./types.js";

// --- Init ---

const canvas = document.getElementById("scope-canvas") as HTMLCanvasElement;
const container = document.getElementById("scope-canvas-container") as HTMLElement;
const controlsEl = document.getElementById("controls-container") as HTMLElement;
const ctx = canvas.getContext("2d")!;

const scope = new Vectorscope();

// --- Controls ---

const controls = createControls(controlsEl, scope.settings, {
  onSettingsChange(partial: Partial<VectorscopeSettings>) {
    scope.updateSettings(partial);
    draw();
  },
});

// --- Sizing ---

function resize(): void {
  const rect = container.getBoundingClientRect();
  const size = Math.floor(Math.min(rect.width, rect.height));
  if (size < 10) return;

  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  draw();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(container);

// --- Render ---

function draw(): void {
  const size = canvas.width;
  if (size < 10) return;
  scope.render(ctx, size);
}

// --- Host Messages ---

onHostMessage((msg) => {
  switch (msg.type) {
    case "pixels": {
      const pixelData: PixelData = {
        data: new Uint8Array(msg.data),
        width: msg.width,
        height: msg.height,
        colorProfile: msg.colorProfile,
      };
      scope.setPixels(pixelData);
      draw();
      break;
    }
    case "settings": {
      const partial: Partial<VectorscopeSettings> = {};
      if (msg.colorSpace) partial.colorSpace = msg.colorSpace;
      if (msg.densityMode) partial.densityMode = msg.densityMode;
      if (msg.logScale !== undefined) partial.logScale = msg.logScale;
      scope.updateSettings(partial);
      controls.update(scope.settings);
      draw();
      break;
    }
    case "highlight": {
      // TODO: Plan 2 — highlight interaction
      break;
    }
  }
});

// --- Initial render ---
resize();
```

- [ ] **Step 3: Verify dev server starts**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vite --open`

Expected: browser opens showing the vectorscope graticule on a dark background with the controls panel below. No pixel data yet — just the empty scope grid. Press Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/main.ts packages/core/src/index.html
git commit -m "feat: wire up main entry point with canvas, controls, and host messaging"
```

---

### Task 14: Browser Test Harness

**Files:**
- Create: `packages/core/dev/harness.html`

A standalone page that loads the vectorscope and feeds it mock pixel data for testing. Includes buttons to swap color spaces, density modes, and load different test images.

- [ ] **Step 1: Create harness.html**

```html
<!-- packages/core/dev/harness.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Vectorscope Dev Harness</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; color: #ddd; font-family: system-ui; display: flex; height: 100vh; }
    #scope-frame { flex: 1; border: none; }
    #harness-controls { width: 280px; padding: 16px; background: #1a1a1a; border-left: 1px solid #333; overflow-y: auto; }
    h3 { margin: 16px 0 8px; color: #aaa; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
    h3:first-child { margin-top: 0; }
    button { display: block; width: 100%; padding: 8px; margin: 4px 0; background: #2a2a2a; color: #ddd; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-size: 13px; }
    button:hover { background: #3a3a3a; }
    #status { margin-top: 16px; font-size: 11px; color: #888; }
    #image-upload { margin: 8px 0; }
  </style>
</head>
<body>
  <iframe id="scope-frame" src="/src/index.html"></iframe>
  <div id="harness-controls">
    <h3>Test Patterns</h3>
    <button onclick="sendColorBars()">SMPTE Color Bars</button>
    <button onclick="sendGradient()">Hue Gradient</button>
    <button onclick="sendRandom()">Random Noise</button>
    <button onclick="sendSkinTones()">Skin Tones</button>
    <button onclick="sendMonochrome()">Monochrome</button>

    <h3>Load Image</h3>
    <input type="file" id="image-upload" accept="image/*" onchange="loadImage(event)" />

    <div id="status">Ready. Send a test pattern to see the vectorscope.</div>
  </div>

  <script>
    const frame = document.getElementById("scope-frame");
    const status = document.getElementById("status");

    function send(pixels, width, height) {
      frame.contentWindow.postMessage({
        type: "pixels",
        data: Array.from(pixels),
        width,
        height,
        colorProfile: "sRGB",
      }, "*");
      status.textContent = `Sent ${width}x${height} (${pixels.length / 3} pixels)`;
    }

    function sendColorBars() {
      const w = 256, h = 256;
      const data = new Uint8Array(w * h * 3);
      // 7 SMPTE bars: white, yellow, cyan, green, magenta, red, blue
      const bars = [
        [255,255,255], [255,255,0], [0,255,255], [0,255,0],
        [255,0,255], [255,0,0], [0,0,255],
      ];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const bar = bars[Math.floor(x / (w / 7))];
          const i = (y * w + x) * 3;
          data[i] = bar[0]; data[i+1] = bar[1]; data[i+2] = bar[2];
        }
      }
      send(data, w, h);
    }

    function sendGradient() {
      const w = 256, h = 256;
      const data = new Uint8Array(w * h * 3);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const hue = (x / w) * 360;
          const sat = y / h;
          const [r, g, b] = hslToRgb(hue, sat, 0.5);
          const i = (y * w + x) * 3;
          data[i] = r; data[i+1] = g; data[i+2] = b;
        }
      }
      send(data, w, h);
    }

    function sendRandom() {
      const w = 128, h = 128;
      const data = new Uint8Array(w * h * 3);
      for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
      send(data, w, h);
    }

    function sendSkinTones() {
      const w = 128, h = 128;
      const data = new Uint8Array(w * h * 3);
      for (let i = 0; i < w * h; i++) {
        // Range of skin tones: warm hues, moderate saturation
        const r = 180 + Math.floor(Math.random() * 60);
        const g = 120 + Math.floor(Math.random() * 50);
        const b = 90 + Math.floor(Math.random() * 40);
        data[i*3] = r; data[i*3+1] = g; data[i*3+2] = b;
      }
      send(data, w, h);
    }

    function sendMonochrome() {
      const w = 128, h = 128;
      const data = new Uint8Array(w * h * 3);
      for (let i = 0; i < w * h; i++) {
        const v = Math.floor(Math.random() * 256);
        data[i*3] = v; data[i*3+1] = v; data[i*3+2] = v;
      }
      send(data, w, h);
    }

    function loadImage(event) {
      const file = event.target.files[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        // Downsample to 256x256
        const size = 256;
        const c = document.createElement("canvas");
        c.width = size; c.height = size;
        const cx = c.getContext("2d");
        cx.drawImage(img, 0, 0, size, size);
        const imgData = cx.getImageData(0, 0, size, size);
        // Convert RGBA to RGB
        const rgb = new Uint8Array(size * size * 3);
        for (let i = 0; i < size * size; i++) {
          rgb[i*3]   = imgData.data[i*4];
          rgb[i*3+1] = imgData.data[i*4+1];
          rgb[i*3+2] = imgData.data[i*4+2];
        }
        send(rgb, size, size);
      };
      img.src = URL.createObjectURL(file);
    }

    function hslToRgb(h, s, l) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let r, g, b;
      if (h < 60)       { r = c; g = x; b = 0; }
      else if (h < 120) { r = x; g = c; b = 0; }
      else if (h < 180) { r = 0; g = c; b = x; }
      else if (h < 240) { r = 0; g = x; b = c; }
      else if (h < 300) { r = x; g = 0; b = c; }
      else              { r = c; g = 0; b = x; }
      return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Test the harness**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vite`

Then open `http://localhost:5173/dev/harness.html` in a browser.

Expected: Left side shows the vectorscope (empty graticule). Right side shows test buttons. Click "SMPTE Color Bars" — the scope should show 7 distinct color points. Click "Hue Gradient" — should show a ring of color. Click "Load Image" with any photo — should show the image's color distribution.

Press Ctrl+C to stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add packages/core/dev/harness.html
git commit -m "feat: add browser test harness with mock pixel patterns"
```

---

### Task 15: Build Verification

**Files:** None new — verifies everything works together.

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/iser/workspace/vectorscope && npx turbo run test`

Expected: all tests PASS across the core package.

- [ ] **Step 2: Build the core package**

Run: `cd /Users/iser/workspace/vectorscope && npx turbo run build`

Expected: `packages/core/build/index.html` is created as a single self-contained HTML file.

- [ ] **Step 3: Verify the built file works**

Run: `cd /Users/iser/workspace/vectorscope/packages/core/build && python3 -m http.server 8080`

Open `http://localhost:8080/index.html` — should show the vectorscope (graticule + controls). This is the file that gets embedded in both plugins' WebViews.

Press Ctrl+C to stop.

- [ ] **Step 4: Verify built file is self-contained**

Run: `wc -c /Users/iser/workspace/vectorscope/packages/core/build/index.html`

Expected: a single HTML file, likely 30-80KB. No external dependencies.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Plan 1 complete — monorepo + core vectorscope engine"
```

---

## Follow-up Plans

| Plan | Status | Description |
|------|--------|-------------|
| **Plan 1** | ✅ This plan | Monorepo + core vectorscope display engine |
| **Plan 2** | Next | Harmony overlays + grading interaction + fit-to-scheme |
| **Plan 3** | Pending | Photoshop UXP plugin |
| **Plan 4** | Pending | Rust decode binary + Lightroom Classic plugin |
| **Plan 5** | Pending (parallel) | Marketing site + license server + Stripe |
| **Plan 6** | Pending | AI backend + plugin AI integration |
