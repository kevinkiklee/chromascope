# Harmony Overlays + Grading Interaction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add harmony overlay system (Complementary, Split Complementary, Triadic, Tetradic, Analogous) with rotatable zones, per-zone pull strength, a "Fit to Scheme" engine, bidirectional scope↔image highlighting, and scope-driven grading edits.

**Architecture:** Overlays render on a separate canvas layer above the density plot. Each harmony scheme defines angular zones on the scope circle. The interaction layer handles hover/drag events on the canvas and translates them to highlight regions or edit commands sent to the host plugin via the existing message protocol. The "Fit to Scheme" engine computes per-pixel adjustment deltas based on distance to the nearest harmony zone.

**Tech Stack:** TypeScript, Canvas 2D, Vitest

---

## File Map

```
packages/core/
├── src/
│   ├── types.ts                    # MODIFY — add harmony types
│   ├── protocol.ts                 # MODIFY — add harmony + AI messages
│   ├── overlays/
│   │   ├── harmony-zones.ts        # CREATE — zone geometry (angles, boundaries, hit-testing)
│   │   ├── harmony-renderer.ts     # CREATE — draws zones on canvas
│   │   ├── skin-tone-line.ts       # CREATE — skin tone reference indicator
│   │   └── index.ts               # CREATE — overlay registry
│   ├── interaction/
│   │   ├── hit-test.ts             # CREATE — polar coordinate hit-testing
│   │   ├── scope-interaction.ts    # CREATE — hover/drag event handler
│   │   └── fit-to-scheme.ts        # CREATE — per-pixel color adjustment engine
│   ├── vectorscope.ts              # MODIFY — wire overlays + interaction
│   ├── main.ts                     # MODIFY — add overlay canvas layer + event listeners
│   ├── ui/controls.ts              # MODIFY — add harmony controls section
│   └── ui/styles.css               # MODIFY — add harmony control styles
├── test/
│   ├── overlays/
│   │   ├── harmony-zones.test.ts   # CREATE
│   │   └── skin-tone-line.test.ts  # CREATE
│   ├── interaction/
│   │   ├── hit-test.test.ts        # CREATE
│   │   └── fit-to-scheme.test.ts   # CREATE
│   └── vectorscope.test.ts         # MODIFY — add overlay/interaction tests
└── dev/
    └── harness.html                # MODIFY — add harmony test controls
```

---

### Task 1: Harmony Types

**Files:**
- Modify: `packages/core/src/types.ts`

Add harmony scheme types, zone definitions, and extend `VectorscopeSettings` with harmony configuration.

- [ ] **Step 1: Add harmony types to types.ts**

```typescript
// Append to packages/core/src/types.ts

export type HarmonySchemeId =
  | "complementary"
  | "splitComplementary"
  | "triadic"
  | "tetradic"
  | "analogous";

/** A single angular zone on the vectorscope circle */
export interface HarmonyZone {
  /** Center angle in radians (0 = right, counter-clockwise) */
  centerAngle: number;
  /** Half-width of the zone in radians */
  halfWidth: number;
  /** Pull strength for Fit to Scheme (0 to 1) */
  pullStrength: number;
}

/** Full harmony overlay configuration */
export interface HarmonyConfig {
  /** Which scheme is active, or null for no overlay */
  scheme: HarmonySchemeId | null;
  /** Rotation offset in radians applied to all zones */
  rotation: number;
  /** Zone width multiplier (0.5 = narrow, 2.0 = wide). Default 1.0 */
  zoneWidth: number;
  /** Per-zone pull strengths (indexed same as zones array). Falls back to 0.5 */
  pullStrengths: number[];
}
```

- [ ] **Step 2: Update VectorscopeSettings**

Replace the existing `VectorscopeSettings` interface:

```typescript
export interface VectorscopeSettings {
  colorSpace: ColorSpaceId;
  densityMode: DensityModeId;
  logScale: boolean;
  harmony: HarmonyConfig;
}
```

- [ ] **Step 3: Verify tests still pass**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all 41 tests PASS (the new types are additive, but `VectorscopeSettings` changed — tests may need the `harmony` field added).

If tests fail because `VectorscopeSettings` now requires `harmony`, fix in Task 2 when updating `vectorscope.ts` defaults.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat: add harmony overlay types"
```

---

### Task 2: Fix Default Settings

**Files:**
- Modify: `packages/core/src/vectorscope.ts`
- Modify: `packages/core/test/vectorscope.test.ts`

Update the default settings to include the new `harmony` field so existing tests pass.

- [ ] **Step 1: Update DEFAULT_SETTINGS in vectorscope.ts**

Replace the `DEFAULT_SETTINGS` constant:

```typescript
const DEFAULT_SETTINGS: VectorscopeSettings = {
  colorSpace: "ycbcr",
  densityMode: "scatter",
  logScale: false,
  harmony: {
    scheme: null,
    rotation: 0,
    zoneWidth: 1.0,
    pullStrengths: [],
  },
};
```

Also update the import to include `HarmonyConfig`:

```typescript
import type {
  ColorSpaceMapper,
  DensityRenderer,
  HarmonyConfig,
  MappedPoint,
  PixelData,
  VectorscopeSettings,
} from "./types.js";
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all 41 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/vectorscope.ts
git commit -m "fix: update default settings with harmony config"
```

---

### Task 3: Harmony Zone Geometry

**Files:**
- Create: `packages/core/src/overlays/harmony-zones.ts`
- Create: `packages/core/test/overlays/harmony-zones.test.ts`

The core geometry module. Defines how each scheme generates its zones, and provides functions to compute zone boundaries and test whether a point falls inside a zone.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/overlays/harmony-zones.test.ts

import { describe, it, expect } from "vitest";
import {
  getHarmonyZones,
  isPointInZone,
  nearestZoneDistance,
} from "../../src/overlays/harmony-zones.js";
import type { HarmonyConfig } from "../../src/types.js";

describe("getHarmonyZones", () => {
  it("returns 2 zones for complementary", () => {
    const config: HarmonyConfig = {
      scheme: "complementary",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(2);
  });

  it("returns 3 zones for triadic", () => {
    const config: HarmonyConfig = {
      scheme: "triadic",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(3);
  });

  it("returns 4 zones for tetradic", () => {
    const config: HarmonyConfig = {
      scheme: "tetradic",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(4);
  });

  it("returns 3 zones for splitComplementary", () => {
    const config: HarmonyConfig = {
      scheme: "splitComplementary",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(3);
  });

  it("returns 3 zones for analogous", () => {
    const config: HarmonyConfig = {
      scheme: "analogous",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(3);
  });

  it("returns empty array when scheme is null", () => {
    const config: HarmonyConfig = {
      scheme: null,
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [],
    };
    const zones = getHarmonyZones(config);
    expect(zones.length).toBe(0);
  });

  it("applies rotation offset to all zones", () => {
    const base: HarmonyConfig = { scheme: "complementary", rotation: 0, zoneWidth: 1.0, pullStrengths: [] };
    const rotated: HarmonyConfig = { scheme: "complementary", rotation: Math.PI / 4, zoneWidth: 1.0, pullStrengths: [] };

    const baseZones = getHarmonyZones(base);
    const rotatedZones = getHarmonyZones(rotated);

    const diff = rotatedZones[0].centerAngle - baseZones[0].centerAngle;
    expect(diff).toBeCloseTo(Math.PI / 4, 5);
  });

  it("applies zoneWidth multiplier", () => {
    const narrow: HarmonyConfig = { scheme: "complementary", rotation: 0, zoneWidth: 0.5, pullStrengths: [] };
    const wide: HarmonyConfig = { scheme: "complementary", rotation: 0, zoneWidth: 2.0, pullStrengths: [] };

    const narrowZones = getHarmonyZones(narrow);
    const wideZones = getHarmonyZones(wide);

    expect(wideZones[0].halfWidth).toBeGreaterThan(narrowZones[0].halfWidth);
  });

  it("applies per-zone pullStrengths when provided", () => {
    const config: HarmonyConfig = {
      scheme: "complementary",
      rotation: 0,
      zoneWidth: 1.0,
      pullStrengths: [0.8, 0.2],
    };
    const zones = getHarmonyZones(config);
    expect(zones[0].pullStrength).toBeCloseTo(0.8);
    expect(zones[1].pullStrength).toBeCloseTo(0.2);
  });
});

describe("isPointInZone", () => {
  it("returns true for a point inside a zone", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 };
    // angle = 0.05 rad is inside zone centered at 0 with halfWidth π/6
    expect(isPointInZone(0.05, zone)).toBe(true);
  });

  it("returns false for a point outside a zone", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 };
    // angle = π/2 is well outside
    expect(isPointInZone(Math.PI / 2, zone)).toBe(false);
  });

  it("handles wrap-around at 0/2π boundary", () => {
    const zone = { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 };
    // angle just below 2π should be inside zone centered at 0
    expect(isPointInZone(2 * Math.PI - 0.05, zone)).toBe(true);
  });
});

describe("nearestZoneDistance", () => {
  it("returns 0 for a point inside a zone", () => {
    const zones = [{ centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 }];
    expect(nearestZoneDistance(0.05, zones)).toBeCloseTo(0, 5);
  });

  it("returns positive distance for a point outside all zones", () => {
    const zones = [{ centerAngle: 0, halfWidth: Math.PI / 12, pullStrength: 0.5 }];
    // π/2 is far outside zone at 0 with halfWidth π/12
    const dist = nearestZoneDistance(Math.PI / 2, zones);
    expect(dist).toBeGreaterThan(0);
  });

  it("returns distance to nearest zone boundary", () => {
    const zones = [
      { centerAngle: 0, halfWidth: Math.PI / 6, pullStrength: 0.5 },
      { centerAngle: Math.PI, halfWidth: Math.PI / 6, pullStrength: 0.5 },
    ];
    // Point at π/4 — distance to zone 0's boundary (π/6) = π/4 - π/6 = π/12
    const dist = nearestZoneDistance(Math.PI / 4, zones);
    expect(dist).toBeCloseTo(Math.PI / 12, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/overlays/harmony-zones.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement harmony-zones.ts**

```typescript
// packages/core/src/overlays/harmony-zones.ts

import type { HarmonyConfig, HarmonySchemeId, HarmonyZone } from "../types.js";

/** Base half-width for a single zone (before zoneWidth multiplier), in radians */
const BASE_HALF_WIDTH = Math.PI / 12; // 15°

const TWO_PI = 2 * Math.PI;

/** Normalize angle to [0, 2π) */
function normalizeAngle(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Signed shortest angular distance from a to b, in [-π, π] */
function angularDistance(a: number, b: number): number {
  let d = normalizeAngle(b) - normalizeAngle(a);
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/**
 * Returns the base center angles (before rotation) for each scheme.
 * All angles in radians. 0 = right (3 o'clock), counter-clockwise.
 */
function schemeBaseAngles(scheme: HarmonySchemeId): number[] {
  switch (scheme) {
    case "complementary":
      return [0, Math.PI];
    case "splitComplementary":
      return [0, Math.PI - Math.PI / 6, Math.PI + Math.PI / 6];
    case "triadic":
      return [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    case "tetradic":
      return [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    case "analogous":
      return [0, Math.PI / 6, -Math.PI / 6];
  }
}

/**
 * Compute the harmony zones for the given config.
 * Returns an empty array if scheme is null.
 */
export function getHarmonyZones(config: HarmonyConfig): HarmonyZone[] {
  if (config.scheme === null) return [];

  const baseAngles = schemeBaseAngles(config.scheme);
  const halfWidth = BASE_HALF_WIDTH * config.zoneWidth;

  return baseAngles.map((angle, i) => ({
    centerAngle: normalizeAngle(angle + config.rotation),
    halfWidth,
    pullStrength: config.pullStrengths[i] ?? 0.5,
  }));
}

/**
 * Test whether a point at the given angle (radians) falls inside a zone.
 */
export function isPointInZone(angle: number, zone: HarmonyZone): boolean {
  const dist = Math.abs(angularDistance(angle, zone.centerAngle));
  return dist <= zone.halfWidth;
}

/**
 * Returns the angular distance from a point to the nearest zone boundary.
 * Returns 0 if the point is inside any zone.
 */
export function nearestZoneDistance(angle: number, zones: HarmonyZone[]): number {
  let minDist = Infinity;

  for (const zone of zones) {
    const dist = Math.abs(angularDistance(angle, zone.centerAngle));
    if (dist <= zone.halfWidth) return 0;
    const boundary = dist - zone.halfWidth;
    if (boundary < minDist) minDist = boundary;
  }

  return minDist;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/overlays/harmony-zones.test.ts`

Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/overlays/harmony-zones.ts packages/core/test/overlays/harmony-zones.test.ts
git commit -m "feat: add harmony zone geometry with hit-testing"
```

---

### Task 4: Harmony Renderer

**Files:**
- Create: `packages/core/src/overlays/harmony-renderer.ts`

Draws the harmony zones on the scope canvas as translucent wedge arcs. No unit tests needed — this is purely Canvas rendering (same rationale as the graticule).

- [ ] **Step 1: Implement harmony-renderer.ts**

```typescript
// packages/core/src/overlays/harmony-renderer.ts

import type { HarmonyZone } from "../types.js";

/** Colors for successive harmony zones */
const ZONE_COLORS = [
  "rgba(255, 200, 50, 0.15)",
  "rgba(50, 200, 255, 0.15)",
  "rgba(255, 100, 200, 0.15)",
  "rgba(100, 255, 150, 0.15)",
];

const ZONE_BORDER_COLORS = [
  "rgba(255, 200, 50, 0.6)",
  "rgba(50, 200, 255, 0.6)",
  "rgba(255, 100, 200, 0.6)",
  "rgba(100, 255, 150, 0.6)",
];

/**
 * Renders harmony zone wedges onto the canvas.
 * Zones are drawn as filled arcs from center to maxR.
 * Canvas convention: angles measured clockwise from 3 o'clock,
 * but our zone angles are counter-clockwise, so we negate.
 */
export function renderHarmonyOverlay(
  ctx: CanvasRenderingContext2D,
  zones: HarmonyZone[],
  size: number,
): void {
  if (zones.length === 0) return;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  ctx.save();

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    // Convert from math convention (CCW from right) to canvas convention (CW from right)
    const startAngle = -(zone.centerAngle + zone.halfWidth);
    const endAngle = -(zone.centerAngle - zone.halfWidth);

    // Filled wedge
    ctx.fillStyle = ZONE_COLORS[i % ZONE_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    // Border lines along zone edges
    ctx.strokeStyle = ZONE_BORDER_COLORS[i % ZONE_BORDER_COLORS.length];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(startAngle) * maxR,
      cy + Math.sin(startAngle) * maxR,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(endAngle) * maxR,
      cy + Math.sin(endAngle) * maxR,
    );
    ctx.stroke();

    // Center line (dashed)
    const centerCanvas = -(zone.centerAngle);
    ctx.strokeStyle = ZONE_BORDER_COLORS[i % ZONE_BORDER_COLORS.length];
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(centerCanvas) * maxR * 0.9,
      cy + Math.sin(centerCanvas) * maxR * 0.9,
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all existing tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/overlays/harmony-renderer.ts
git commit -m "feat: add harmony zone canvas renderer"
```

---

### Task 5: Skin Tone Reference Line

**Files:**
- Create: `packages/core/src/overlays/skin-tone-line.ts`
- Create: `packages/core/test/overlays/skin-tone-line.test.ts`

Draws a reference line on the scope at the "skin tone" hue angle (~123° in YCbCr / I-line). Also exports the angle constant for use by other modules.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/overlays/skin-tone-line.test.ts

import { describe, it, expect, vi } from "vitest";
import { SKIN_TONE_ANGLE, renderSkinToneLine } from "../../src/overlays/skin-tone-line.js";

describe("SKIN_TONE_ANGLE", () => {
  it("is approximately 123 degrees in radians", () => {
    const expectedRad = (123 * Math.PI) / 180;
    expect(SKIN_TONE_ANGLE).toBeCloseTo(expectedRad, 2);
  });
});

describe("renderSkinToneLine", () => {
  it("draws a line on the canvas", () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: "",
      lineWidth: 1,
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    renderSkinToneLine(ctx, 300);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/overlays/skin-tone-line.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement skin-tone-line.ts**

```typescript
// packages/core/src/overlays/skin-tone-line.ts

/**
 * The "skin tone line" (I-line) angle on the vectorscope.
 * Approximately 123° from the positive X axis (counter-clockwise).
 * This is where skin tones of all ethnicities cluster in YCbCr space.
 */
export const SKIN_TONE_ANGLE = (123 * Math.PI) / 180;

/**
 * Renders the skin tone reference line on the vectorscope.
 */
export function renderSkinToneLine(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  const cosA = Math.cos(SKIN_TONE_ANGLE);
  const sinA = -Math.sin(SKIN_TONE_ANGLE); // Canvas Y is inverted

  ctx.save();
  ctx.strokeStyle = "rgba(255, 180, 120, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 3]);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + cosA * maxR, cy + sinA * maxR);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/overlays/skin-tone-line.test.ts`

Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/overlays/skin-tone-line.ts packages/core/test/overlays/skin-tone-line.test.ts
git commit -m "feat: add skin tone reference line overlay"
```

---

### Task 6: Overlay Registry

**Files:**
- Create: `packages/core/src/overlays/index.ts`

Central export for all overlay modules.

- [ ] **Step 1: Create overlays/index.ts**

```typescript
// packages/core/src/overlays/index.ts

export { getHarmonyZones, isPointInZone, nearestZoneDistance } from "./harmony-zones.js";
export { renderHarmonyOverlay } from "./harmony-renderer.js";
export { SKIN_TONE_ANGLE, renderSkinToneLine } from "./skin-tone-line.js";
```

- [ ] **Step 2: Verify tests pass**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/overlays/index.ts
git commit -m "feat: add overlay registry"
```

---

### Task 7: Hit-Test Module

**Files:**
- Create: `packages/core/src/interaction/hit-test.ts`
- Create: `packages/core/test/interaction/hit-test.test.ts`

Converts canvas pixel coordinates to polar scope coordinates for interaction.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/interaction/hit-test.test.ts

import { describe, it, expect } from "vitest";
import { canvasToPolar } from "../../src/interaction/hit-test.js";

describe("canvasToPolar", () => {
  const size = 200;

  it("returns center (0,0) for the canvas center", () => {
    const result = canvasToPolar(100, 100, size);
    expect(result.radius).toBeCloseTo(0, 1);
  });

  it("returns radius ~1.0 at the edge of the scope", () => {
    // maxR = 200 * 0.45 = 90. So 90px right of center = radius 1.0
    const result = canvasToPolar(190, 100, size);
    expect(result.radius).toBeCloseTo(1.0, 1);
  });

  it("returns angle 0 for a point to the right of center", () => {
    const result = canvasToPolar(150, 100, size);
    expect(result.angle).toBeCloseTo(0, 1);
  });

  it("returns angle π/2 for a point above center", () => {
    // Canvas Y is inverted: py < cy means positive Y in scope = angle π/2
    const result = canvasToPolar(100, 55, size);
    expect(result.angle).toBeCloseTo(Math.PI / 2, 1);
  });

  it("returns angle π for a point to the left of center", () => {
    const result = canvasToPolar(55, 100, size);
    expect(result.angle).toBeCloseTo(Math.PI, 1);
  });

  it("returns radius > 1 for points outside the scope circle", () => {
    const result = canvasToPolar(195, 100, size);
    expect(result.radius).toBeGreaterThan(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/interaction/hit-test.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement hit-test.ts**

```typescript
// packages/core/src/interaction/hit-test.ts

const TWO_PI = 2 * Math.PI;

export interface PolarCoord {
  /** Angle in radians, 0 = right, counter-clockwise, [0, 2π) */
  angle: number;
  /** Distance from center, normalized to scope radius (0 = center, 1 = edge) */
  radius: number;
}

/**
 * Convert canvas pixel coordinates to polar scope coordinates.
 * Uses the same layout constants as graticule.ts and scopeToCanvas.
 */
export function canvasToPolar(px: number, py: number, size: number): PolarCoord {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.45;

  const dx = px - cx;
  const dy = -(py - cy); // Invert Y for math convention

  const radius = Math.sqrt(dx * dx + dy * dy) / maxR;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += TWO_PI;

  return { angle, radius };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/interaction/hit-test.test.ts`

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction/hit-test.ts packages/core/test/interaction/hit-test.test.ts
git commit -m "feat: add canvas-to-polar hit-test conversion"
```

---

### Task 8: Scope Interaction Handler

**Files:**
- Create: `packages/core/src/interaction/scope-interaction.ts`

Handles mouse events on the scope canvas: hover sends highlight regions to host, drag adjusts harmony rotation or triggers grading edits.

- [ ] **Step 1: Implement scope-interaction.ts**

```typescript
// packages/core/src/interaction/scope-interaction.ts

import { canvasToPolar, type PolarCoord } from "./hit-test.js";
import { isPointInZone } from "../overlays/harmony-zones.js";
import { sendToHost } from "../protocol.js";
import type { HarmonyZone } from "../types.js";

export interface InteractionCallbacks {
  /** Called when hover position changes (polar coords or null for no hover) */
  onHover: (polar: PolarCoord | null) => void;
  /** Called when user drags to rotate harmony overlay */
  onHarmonyRotate: (deltaRadians: number) => void;
  /** Request a redraw */
  requestRedraw: () => void;
}

/**
 * Attaches mouse/pointer event handlers to the scope canvas.
 * Returns a cleanup function to remove listeners.
 */
export function attachScopeInteraction(
  canvas: HTMLCanvasElement,
  size: () => number,
  getZones: () => HarmonyZone[],
  callbacks: InteractionCallbacks,
): () => void {
  let isDragging = false;
  let dragStartAngle = 0;

  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const polar = canvasToPolar(px, py, size());

    if (isDragging) {
      const delta = polar.angle - dragStartAngle;
      callbacks.onHarmonyRotate(delta);
      dragStartAngle = polar.angle;
      return;
    }

    // Hover: highlight matching region on the image
    if (polar.radius <= 1.0) {
      callbacks.onHover(polar);
      // Send highlight region to host
      sendToHost({
        type: "highlight",
        region: {
          angle: polar.angle,
          radius: polar.radius,
          width: 0.1,
        },
      });
    } else {
      callbacks.onHover(null);
    }

    callbacks.requestRedraw();
  }

  function onPointerDown(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const polar = canvasToPolar(px, py, size());

    // Only start drag inside the scope circle
    if (polar.radius <= 1.0) {
      isDragging = true;
      dragStartAngle = polar.angle;
      canvas.setPointerCapture(e.pointerId);
    }
  }

  function onPointerUp(e: PointerEvent) {
    isDragging = false;
    canvas.releasePointerCapture(e.pointerId);
  }

  function onPointerLeave() {
    isDragging = false;
    callbacks.onHover(null);
    callbacks.requestRedraw();
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return () => {
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
  };
}
```

- [ ] **Step 2: Verify tests pass**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/interaction/scope-interaction.ts
git commit -m "feat: add scope interaction handler for hover and drag"
```

---

### Task 9: Fit to Scheme Engine

**Files:**
- Create: `packages/core/src/interaction/fit-to-scheme.ts`
- Create: `packages/core/test/interaction/fit-to-scheme.test.ts`

Computes per-pixel adjustment deltas to pull colors toward the nearest harmony zone. Each pixel's hue angle is compared to the nearest zone boundary; if outside, a delta is computed weighted by that zone's pull strength.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/test/interaction/fit-to-scheme.test.ts

import { describe, it, expect } from "vitest";
import { computeFitDeltas } from "../../src/interaction/fit-to-scheme.js";
import type { MappedPoint, HarmonyZone } from "../../src/types.js";

describe("computeFitDeltas", () => {
  const zone: HarmonyZone = {
    centerAngle: 0,
    halfWidth: Math.PI / 6, // 30° total width
    pullStrength: 1.0,
  };

  it("returns zero delta for a point inside a zone", () => {
    const point: MappedPoint = {
      x: 0.5, y: 0, angle: 0.05, radius: 0.5, r: 200, g: 100, b: 100,
    };
    const deltas = computeFitDeltas([point], [zone]);
    expect(deltas[0].angleDelta).toBeCloseTo(0, 5);
  });

  it("returns negative delta to pull point clockwise into nearest zone", () => {
    // Point at π/3 (60°), zone centered at 0 with halfWidth π/6 (boundary at π/6 = 30°)
    // Should pull toward π/6 (the boundary), so delta = π/6 - π/3 = -π/6
    const point: MappedPoint = {
      x: 0.25, y: 0.43, angle: Math.PI / 3, radius: 0.5, r: 200, g: 100, b: 100,
    };
    const deltas = computeFitDeltas([point], [zone]);
    expect(deltas[0].angleDelta).toBeLessThan(0);
  });

  it("scales delta by pullStrength", () => {
    const point: MappedPoint = {
      x: 0.25, y: 0.43, angle: Math.PI / 3, radius: 0.5, r: 200, g: 100, b: 100,
    };
    const fullPull = computeFitDeltas([point], [{ ...zone, pullStrength: 1.0 }]);
    const halfPull = computeFitDeltas([point], [{ ...zone, pullStrength: 0.5 }]);

    expect(Math.abs(halfPull[0].angleDelta)).toBeCloseTo(
      Math.abs(fullPull[0].angleDelta) * 0.5,
      3,
    );
  });

  it("returns zero delta for desaturated points (radius < 0.05)", () => {
    const point: MappedPoint = {
      x: 0.01, y: 0.01, angle: Math.PI / 2, radius: 0.02, r: 128, g: 128, b: 128,
    };
    const deltas = computeFitDeltas([point], [zone]);
    expect(deltas[0].angleDelta).toBeCloseTo(0, 5);
  });

  it("handles multiple points", () => {
    const points: MappedPoint[] = [
      { x: 0.5, y: 0, angle: 0.05, radius: 0.5, r: 200, g: 100, b: 100 },
      { x: 0.25, y: 0.43, angle: Math.PI / 3, radius: 0.5, r: 100, g: 200, b: 100 },
    ];
    const deltas = computeFitDeltas(points, [zone]);
    expect(deltas.length).toBe(2);
    expect(deltas[0].angleDelta).toBeCloseTo(0, 5); // Inside zone
    expect(deltas[1].angleDelta).not.toBeCloseTo(0, 2); // Outside zone
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/interaction/fit-to-scheme.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement fit-to-scheme.ts**

```typescript
// packages/core/src/interaction/fit-to-scheme.ts

import type { MappedPoint, HarmonyZone } from "../types.js";

const TWO_PI = 2 * Math.PI;

/** Signed shortest angular distance from a to b, in [-π, π] */
function angularDistance(a: number, b: number): number {
  let d = ((b % TWO_PI) + TWO_PI) % TWO_PI - ((a % TWO_PI) + TWO_PI) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

export interface FitDelta {
  /** Angular adjustment in radians (positive = CCW, negative = CW) */
  angleDelta: number;
  /** Index of the nearest zone that influenced this delta */
  nearestZoneIndex: number;
}

/** Minimum saturation radius to apply fit adjustments. Below this, colors are too gray to shift. */
const MIN_RADIUS = 0.05;

/**
 * For each mapped point, compute the angular delta needed to pull it
 * into the nearest harmony zone. Points already inside a zone get zero delta.
 * Points below MIN_RADIUS saturation get zero delta (too desaturated to shift).
 */
export function computeFitDeltas(
  points: MappedPoint[],
  zones: HarmonyZone[],
): FitDelta[] {
  if (zones.length === 0) {
    return points.map(() => ({ angleDelta: 0, nearestZoneIndex: -1 }));
  }

  return points.map((point) => {
    // Skip desaturated points
    if (point.radius < MIN_RADIUS) {
      return { angleDelta: 0, nearestZoneIndex: -1 };
    }

    let bestDelta = Infinity;
    let bestAbsDelta = Infinity;
    let bestZoneIndex = 0;

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const distToCenter = angularDistance(point.angle, zone.centerAngle);
      const absDist = Math.abs(distToCenter);

      // Point is inside this zone
      if (absDist <= zone.halfWidth) {
        return { angleDelta: 0, nearestZoneIndex: i };
      }

      // Compute delta to nearest boundary of this zone
      let delta: number;
      if (distToCenter > 0) {
        // Point is CCW of zone center — pull toward the +halfWidth boundary
        delta = -(absDist - zone.halfWidth);
      } else {
        // Point is CW of zone center — pull toward the -halfWidth boundary
        delta = absDist - zone.halfWidth;
      }

      if (Math.abs(delta) < bestAbsDelta) {
        bestAbsDelta = Math.abs(delta);
        bestDelta = delta * zone.pullStrength;
        bestZoneIndex = i;
      }
    }

    return { angleDelta: bestDelta, nearestZoneIndex: bestZoneIndex };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run test/interaction/fit-to-scheme.test.ts`

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/interaction/fit-to-scheme.ts packages/core/test/interaction/fit-to-scheme.test.ts
git commit -m "feat: add fit-to-scheme per-pixel adjustment engine"
```

---

### Task 10: Wire Overlays into Vectorscope

**Files:**
- Modify: `packages/core/src/vectorscope.ts`

Update the main orchestrator to render harmony overlays and the skin tone line after the density plot.

- [ ] **Step 1: Update vectorscope.ts**

Replace the full content of `packages/core/src/vectorscope.ts`:

```typescript
// packages/core/src/vectorscope.ts

import type {
  ColorSpaceMapper,
  DensityRenderer,
  HarmonyZone,
  MappedPoint,
  PixelData,
  VectorscopeSettings,
} from "./types.js";
import { createColorSpaceMapper } from "./color-spaces/index.js";
import { createDensityRenderer } from "./renderers/index.js";
import { renderGraticule } from "./graticule.js";
import { getHarmonyZones, renderHarmonyOverlay, renderSkinToneLine } from "./overlays/index.js";

const DEFAULT_SETTINGS: VectorscopeSettings = {
  colorSpace: "ycbcr",
  densityMode: "scatter",
  logScale: false,
  harmony: {
    scheme: null,
    rotation: 0,
    zoneWidth: 1.0,
    pullStrengths: [],
  },
};

export class Vectorscope {
  settings: VectorscopeSettings;
  mappedPoints: MappedPoint[] = [];
  harmonyZones: HarmonyZone[] = [];

  private mapper: ColorSpaceMapper;
  private renderer: DensityRenderer;
  private pixels: PixelData | null = null;
  private graticuleCacheSize = 0;

  constructor(settings?: Partial<VectorscopeSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.mapper = createColorSpaceMapper(this.settings.colorSpace);
    this.renderer = createDensityRenderer(this.settings.densityMode);
    this.harmonyZones = getHarmonyZones(this.settings.harmony);
  }

  /** Update settings. Re-maps points if color space changed. Swaps renderer if density mode changed. Recomputes zones if harmony changed. */
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

    if (this.settings.harmony !== prev.harmony) {
      this.harmonyZones = getHarmonyZones(this.settings.harmony);
    }
  }

  /** Receive new pixel data from the host plugin. */
  setPixels(pixelData: PixelData): void {
    this.pixels = pixelData;
    this.remapPoints();
  }

  /** Render the full vectorscope onto the given canvas context. */
  render(ctx: CanvasRenderingContext2D, size: number): void {
    // 1. Graticule background
    renderGraticule(ctx, size);
    this.graticuleCacheSize = size;

    // 2. Harmony zone wedges (under density plot so dots show on top)
    if (this.harmonyZones.length > 0) {
      renderHarmonyOverlay(ctx, this.harmonyZones, size);
    }

    // 3. Skin tone reference line
    renderSkinToneLine(ctx, size);

    // 4. Density plot on top
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

- [ ] **Step 2: Run tests**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS (vectorscope tests construct with defaults that include `harmony: { scheme: null, ... }` so overlays are empty).

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/vectorscope.ts
git commit -m "feat: wire overlays into vectorscope render pipeline"
```

---

### Task 11: Update UI Controls with Harmony Section

**Files:**
- Modify: `packages/core/src/ui/controls.ts`
- Modify: `packages/core/src/ui/styles.css`

Add a "Harmony" section to the controls panel with scheme selection buttons, a rotation slider, and a zone width slider.

- [ ] **Step 1: Update styles.css**

Append to the end of `packages/core/src/ui/styles.css`:

```css
.vs-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.vs-slider-row label {
  flex: 0 0 80px;
  color: #999;
  font-size: 11px;
}

.vs-slider-row input[type="range"] {
  flex: 1;
  accent-color: #5a8fd5;
}

.vs-slider-row .vs-slider-value {
  flex: 0 0 36px;
  text-align: right;
  color: #aaa;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Update controls.ts**

Replace the full content of `packages/core/src/ui/controls.ts`:

```typescript
// packages/core/src/ui/controls.ts

import type {
  VectorscopeSettings,
  ColorSpaceId,
  DensityModeId,
  HarmonySchemeId,
} from "../types.js";

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

const HARMONY_SCHEMES: Array<{ id: HarmonySchemeId | "none"; label: string }> = [
  { id: "none", label: "None" },
  { id: "complementary", label: "Comp" },
  { id: "splitComplementary", label: "Split" },
  { id: "triadic", label: "Triad" },
  { id: "tetradic", label: "Tetra" },
  { id: "analogous", label: "Analog" },
];

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
        for (const b of group.querySelectorAll(".vs-btn")) {
          b.classList.toggle("active", (b as HTMLElement).dataset.id === item.id);
        }
      });
      group.appendChild(btn);
    }

    return group;
  }

  function renderSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    formatValue: (v: number) => string,
    onChange: (v: number) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "vs-slider-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;
    row.appendChild(lbl);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    row.appendChild(input);

    const display = document.createElement("span");
    display.className = "vs-slider-value";
    display.textContent = formatValue(value);
    row.appendChild(display);

    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      display.textContent = formatValue(v);
      onChange(v);
    });

    return row;
  }

  // Build DOM
  container.innerHTML = "";

  // --- Display group ---
  const displayGroup = document.createElement("details");
  displayGroup.className = "vs-control-group";
  displayGroup.open = true;
  displayGroup.innerHTML = "<summary>Display</summary>";

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
  displayGroup.appendChild(csRow);

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
  displayGroup.appendChild(dmRow);

  container.appendChild(displayGroup);

  // --- Harmony group ---
  const harmonyGroup = document.createElement("details");
  harmonyGroup.className = "vs-control-group";
  harmonyGroup.open = true;
  harmonyGroup.innerHTML = "<summary>Harmony</summary>";

  const schemeRow = document.createElement("div");
  schemeRow.className = "vs-control-row";
  const schemeLabel = document.createElement("label");
  schemeLabel.textContent = "Scheme";
  schemeRow.appendChild(schemeLabel);
  schemeRow.appendChild(
    renderButtonGroup(
      HARMONY_SCHEMES,
      current.harmony.scheme ?? "none",
      (id) => {
        const scheme = id === "none" ? null : (id as HarmonySchemeId);
        current.harmony = { ...current.harmony, scheme };
        callbacks.onSettingsChange({ harmony: current.harmony });
      },
    ),
  );
  harmonyGroup.appendChild(schemeRow);

  harmonyGroup.appendChild(
    renderSlider(
      "Rotation",
      0, 360, 1,
      Math.round((current.harmony.rotation * 180) / Math.PI),
      (v) => `${v}°`,
      (v) => {
        current.harmony = { ...current.harmony, rotation: (v * Math.PI) / 180 };
        callbacks.onSettingsChange({ harmony: current.harmony });
      },
    ),
  );

  harmonyGroup.appendChild(
    renderSlider(
      "Zone Width",
      0.2, 3.0, 0.1,
      current.harmony.zoneWidth,
      (v) => v.toFixed(1),
      (v) => {
        current.harmony = { ...current.harmony, zoneWidth: v };
        callbacks.onSettingsChange({ harmony: current.harmony });
      },
    ),
  );

  container.appendChild(harmonyGroup);

  return {
    update(settings: VectorscopeSettings) {
      current = { ...settings };
    },
  };
}
```

- [ ] **Step 3: Verify tests pass**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/ui/controls.ts packages/core/src/ui/styles.css
git commit -m "feat: add harmony scheme controls with rotation and zone width sliders"
```

---

### Task 12: Wire Interaction + Harmony into Main Entry Point

**Files:**
- Modify: `packages/core/src/main.ts`
- Modify: `packages/core/src/protocol.ts`

Update main.ts to handle harmony settings changes and attach the interaction handler. Update protocol to support harmony in settings messages.

- [ ] **Step 1: Update protocol.ts**

Add `harmony` to `SettingsMessage`:

```typescript
// In the SettingsMessage interface, add:
import type { ColorSpaceId, DensityModeId, HarmonyConfig } from "./types.js";

export interface SettingsMessage {
  type: "settings";
  colorSpace?: ColorSpaceId;
  densityMode?: DensityModeId;
  logScale?: boolean;
  harmony?: HarmonyConfig;
}
```

Note: the import line replaces the existing import. Add `HarmonyConfig` to it.

- [ ] **Step 2: Update main.ts**

Replace the full content of `packages/core/src/main.ts`:

```typescript
// packages/core/src/main.ts

import { Vectorscope } from "./vectorscope.js";
import { onHostMessage } from "./protocol.js";
import { createControls } from "./ui/controls.js";
import { attachScopeInteraction } from "./interaction/scope-interaction.js";
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

// --- Interaction ---

attachScopeInteraction(
  canvas,
  () => canvas.width,
  () => scope.harmonyZones,
  {
    onHover(_polar) {
      // Hover indicator rendering handled in draw via cursor overlay (future)
    },
    onHarmonyRotate(delta) {
      const newRotation = scope.settings.harmony.rotation + delta;
      scope.updateSettings({
        harmony: { ...scope.settings.harmony, rotation: newRotation },
      });
      controls.update(scope.settings);
      draw();
    },
    requestRedraw: () => draw(),
  },
);

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
      if (msg.harmony) partial.harmony = msg.harmony;
      scope.updateSettings(partial);
      controls.update(scope.settings);
      draw();
      break;
    }
    case "highlight": {
      // TODO: Plan 2 follow-up — render highlight indicator on scope
      break;
    }
  }
});

// --- Initial render ---
resize();
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/main.ts packages/core/src/protocol.ts
git commit -m "feat: wire interaction and harmony into main entry point"
```

---

### Task 13: Update Dev Harness with Harmony Controls

**Files:**
- Modify: `packages/core/dev/harness.html`

Add buttons to the harness to test harmony overlays: set scheme, rotate, and trigger Fit to Scheme.

- [ ] **Step 1: Update harness.html**

Add a new section inside `<div id="harness-controls">`, after the "Load Image" section and before `<div id="status">`:

```html
    <h3>Harmony Overlays</h3>
    <button onclick="setHarmony('complementary')">Complementary</button>
    <button onclick="setHarmony('splitComplementary')">Split Complementary</button>
    <button onclick="setHarmony('triadic')">Triadic</button>
    <button onclick="setHarmony('tetradic')">Tetradic</button>
    <button onclick="setHarmony('analogous')">Analogous</button>
    <button onclick="setHarmony(null)">None (Clear)</button>
    <div style="margin: 8px 0;">
      <label style="color: #999; font-size: 11px;">Rotation:
        <input type="range" min="0" max="360" value="0" oninput="rotateHarmony(this.value)" style="width: 140px;" />
      </label>
    </div>
```

And add corresponding script functions inside the `<script>` block:

```javascript
    function setHarmony(scheme) {
      frame.contentWindow.postMessage({
        type: "settings",
        harmony: {
          scheme: scheme,
          rotation: 0,
          zoneWidth: 1.0,
          pullStrengths: [],
        },
      }, "*");
      status.textContent = `Harmony: ${scheme || "none"}`;
    }

    function rotateHarmony(deg) {
      frame.contentWindow.postMessage({
        type: "settings",
        harmony: {
          scheme: null, // Will be ignored if already set — but we need to send full config
          rotation: (deg * Math.PI) / 180,
          zoneWidth: 1.0,
          pullStrengths: [],
        },
      }, "*");
      status.textContent = `Rotation: ${deg}°`;
    }
```

- [ ] **Step 2: Verify tests pass**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/dev/harness.html
git commit -m "feat: add harmony overlay controls to dev harness"
```

---

### Task 14: Integration Tests

**Files:**
- Modify: `packages/core/test/vectorscope.test.ts`

Add tests that verify the orchestrator correctly renders with harmony overlays enabled and that settings changes recompute zones.

- [ ] **Step 1: Add harmony integration tests**

Append to the `describe("Vectorscope", ...)` block in `packages/core/test/vectorscope.test.ts`:

```typescript
  it("initializes with no harmony zones by default", () => {
    const scope = new Vectorscope();
    expect(scope.harmonyZones.length).toBe(0);
  });

  it("computes harmony zones when scheme is set", () => {
    const scope = new Vectorscope({
      harmony: {
        scheme: "triadic",
        rotation: 0,
        zoneWidth: 1.0,
        pullStrengths: [],
      },
    });
    expect(scope.harmonyZones.length).toBe(3);
  });

  it("recomputes zones when harmony settings change", () => {
    const scope = new Vectorscope();
    expect(scope.harmonyZones.length).toBe(0);

    scope.updateSettings({
      harmony: {
        scheme: "complementary",
        rotation: 0,
        zoneWidth: 1.0,
        pullStrengths: [],
      },
    });
    expect(scope.harmonyZones.length).toBe(2);
  });

  it("renders with harmony overlay without error", () => {
    const scope = new Vectorscope({
      harmony: {
        scheme: "analogous",
        rotation: Math.PI / 4,
        zoneWidth: 1.5,
        pullStrengths: [0.8, 0.6, 0.4],
      },
    });
    const ctx = createMockCanvas(300);

    const data = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    scope.setPixels({ data, width: 3, height: 1, colorProfile: "sRGB" });

    expect(() => scope.render(ctx, 300)).not.toThrow();
  });
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS (41 original + 4 new = 45 total, plus 14 harmony-zones + 2 skin-tone + 6 hit-test + 5 fit-to-scheme = 72 total).

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/vectorscope.test.ts
git commit -m "test: add harmony overlay integration tests"
```

---

### Task 15: Build Verification

**Files:** None new — verifies everything works together.

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vitest run`

Expected: all tests PASS.

- [ ] **Step 2: Build the core package**

Run: `cd /Users/iser/workspace/vectorscope/packages/core && npx vite build`

Expected: `build/index.html` is created as a single self-contained HTML file.

- [ ] **Step 3: Verify built file size**

Run: `wc -c /Users/iser/workspace/vectorscope/packages/core/build/index.html`

Expected: a single HTML file, likely 15-25KB (larger than Plan 1 due to overlay + interaction code).

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat: Plan 2 complete — harmony overlays + interaction"
```

---

## Follow-up Plans

| Plan | Status | Description |
|------|--------|-------------|
| **Plan 1** | ✅ Complete | Monorepo + core vectorscope display engine |
| **Plan 2** | ✅ This plan | Harmony overlays + grading interaction + fit-to-scheme |
| **Plan 3** | Next | Photoshop UXP plugin |
| **Plan 4** | Pending | Rust decode binary + Lightroom Classic plugin |
| **Plan 5** | Pending (parallel) | Marketing site + license server + Stripe |
| **Plan 6** | Pending | AI backend + plugin AI integration |
