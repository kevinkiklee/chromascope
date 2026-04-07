# Codebase Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve reliability, testing, architecture, DX, and polish across the entire Chromascope monorepo based on the audit at `docs/superpowers/specs/2026-04-06-codebase-audit-design.md`.

**Architecture:** Five phases executed in order. Each phase is independently shippable. Phase 1 addresses fragile build and missing safety checks. Phase 2 adds testing and CI. Phase 3 refactors architecture. Phase 4 improves DX. Phase 5 polishes a11y and cleanup.

**Tech Stack:** TypeScript (Vite/Vitest), Rust (Cargo/Clap), Lua (LR SDK), JavaScript (UXP), GitHub Actions

---

## Phase 1: Reliability & Robustness

### Task 1: Core Library Entry Point for UXP

Create a Vite library mode build that emits a standalone IIFE JS bundle, so the Photoshop plugin can import it directly instead of regex-extracting from minified HTML.

**Files:**
- Create: `packages/core/vite.config.lib.ts`
- Create: `packages/core/src/lib.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: Create the library entry point**

Create `packages/core/src/lib.ts` that re-exports all public API:

```typescript
// packages/core/src/lib.ts
// Library entry point for UXP and other non-browser consumers.
// Unlike main.ts, this does NOT touch the DOM — consumers wire up their own UI.

export { Chromascope } from "./chromascope.js";
export { createControls } from "./ui/controls.js";
export { onHostMessage, sendToHost, setTargetOrigin } from "./protocol.js";
export { renderGraticule, scopeToCanvas } from "./graticule.js";
export { attachScopeInteraction } from "./interaction/scope-interaction.js";
export type {
  MappedPoint,
  ColorSpaceId,
  DensityModeId,
  HarmonySchemeId,
  HarmonyZone,
  HarmonyConfig,
  ChromascopeSettings,
  PixelData,
  ColorSpaceMapper,
  DensityRenderer,
} from "./types.js";
```

- [ ] **Step 2: Create the Vite library config**

Create `packages/core/vite.config.lib.ts`:

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/lib.ts",
      name: "ChromascopeCore",
      fileName: "chromascope-core",
      formats: ["iife"],
    },
    outDir: "build-lib",
    emptyOutDir: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Expose all exports on window.ChromascopeCore
        extend: true,
      },
    },
  },
});
```

- [ ] **Step 3: Add build:lib script to package.json**

In `packages/core/package.json`, add to scripts:

```json
"build:lib": "vite build --config vite.config.lib.ts"
```

- [ ] **Step 4: Build and verify the library output**

Run: `cd packages/core && npm run build:lib`

Expected: `packages/core/build-lib/chromascope-core.iife.js` exists and contains `window.ChromascopeCore` or `var ChromascopeCore`.

- [ ] **Step 5: Add build-lib output to .gitignore**

Append to `.gitignore`:

```
packages/core/build-lib/
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib.ts packages/core/vite.config.lib.ts packages/core/package.json .gitignore
git commit -m "feat(core): add library mode build for UXP consumers"
```

---

### Task 2: Rewrite Photoshop Build Script

Replace the fragile regex-based extraction in `plugins/photoshop/scripts/build.js` with a direct import of the library bundle from Task 1.

**Files:**
- Modify: `plugins/photoshop/scripts/build.js`
- Modify: `scripts/build-plugins.sh`

- [ ] **Step 1: Read current build.js to understand what it patches**

Read `plugins/photoshop/scripts/build.js` fully. Note what it does:
1. Copies core HTML to plugin dir
2. Extracts JS from HTML via regex
3. Patches minified variable names
4. Replaces rendering params (alpha, glow radius)
5. Adds UXP canvas polyfills
6. Wraps in IIFE

The new build.js will:
1. Copy the IIFE library bundle directly (no extraction needed)
2. Prepend UXP polyfills
3. Append the UXP-specific initialization code (the `window.__chromascope` API)

- [ ] **Step 2: Rewrite build.js**

Replace `plugins/photoshop/scripts/build.js` with:

```javascript
// plugins/photoshop/scripts/build.js
// Assembles the Photoshop plugin by combining the core library bundle
// with UXP-specific polyfills and initialization code.

const fs = require("fs");
const path = require("path");

const coreBundleSrc = path.resolve(__dirname, "../../../packages/core/build-lib/chromascope-core.iife.js");
const bundleDest = path.resolve(__dirname, "../core/scope-bundle.js");
const coreHtmlSrc = path.resolve(__dirname, "../../../packages/core/build/index.html");
const coreHtmlDest = path.resolve(__dirname, "../core/index.html");

// Validate inputs exist
if (!fs.existsSync(coreBundleSrc)) {
  console.error("Core library bundle not found. Run 'npm run build:lib' in packages/core first.");
  console.error("Expected:", coreBundleSrc);
  process.exit(1);
}
if (!fs.existsSync(coreHtmlSrc)) {
  console.error("Core HTML not found. Run 'npm run build' in packages/core first.");
  console.error("Expected:", coreHtmlSrc);
  process.exit(1);
}

// Ensure output directory exists
fs.mkdirSync(path.dirname(bundleDest), { recursive: true });

// Copy core HTML (used by the webview panel)
fs.copyFileSync(coreHtmlSrc, coreHtmlDest);

// Read the core library bundle
let coreBundle = fs.readFileSync(coreBundleSrc, "utf-8");

// UXP canvas polyfills — UXP's CanvasRenderingContext2D is missing several
// standard methods. These polyfills provide minimal implementations.
const polyfills = `
// === UXP Canvas Polyfills ===
(function() {
  try {
    var proto = CanvasRenderingContext2D.prototype;

    // save/restore state stack
    if (!proto._stateStack) {
      var _origSave = proto.save, _origRestore = proto.restore;
      proto.save = function() { if (!this._stateStack) this._stateStack = []; this._stateStack.push({ gco: this.globalCompositeOperation, ga: this.globalAlpha, ld: this._lineDash || [] }); _origSave.call(this); };
      proto.restore = function() { _origRestore.call(this); if (this._stateStack && this._stateStack.length) { var s = this._stateStack.pop(); this.globalCompositeOperation = s.gco; this.globalAlpha = s.ga; this._lineDash = s.ld; } };
    }

    // setLineDash / getLineDash
    if (!proto.setLineDash) {
      proto.setLineDash = function(d) { this._lineDash = d; };
      proto.getLineDash = function() { return this._lineDash || []; };
    }

    // createImageData / putImageData
    if (!proto.createImageData) {
      proto.createImageData = function(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; };
    }
    if (!proto.putImageData) {
      proto.putImageData = function(id, dx, dy) {
        var c = document.createElement("canvas"); c.width = id.width; c.height = id.height;
        var tc = c.getContext("2d"); var td = tc.createImageData(id.width, id.height);
        td.data.set(id.data); tc.putImageData(td, 0, 0);
        this.drawImage(c, dx, dy);
      };
    }

    // fillText / measureText
    if (!proto.fillText) { proto.fillText = function() {}; }
    if (!proto.measureText) { proto.measureText = function(t) { return { width: (t||"").length * 6 }; }; }

    // font property
    if (!Object.getOwnPropertyDescriptor(proto, "font")) {
      Object.defineProperty(proto, "font", { get: function() { return this._font || "10px sans-serif"; }, set: function(v) { this._font = v; }, configurable: true });
    }

    // globalCompositeOperation — patch "lighter" to "source-over" if unsupported
    try {
      var desc = Object.getOwnPropertyDescriptor(proto, "globalCompositeOperation");
      if (desc && desc.set) {
        var origSet = desc.set;
        Object.defineProperty(proto, "globalCompositeOperation", {
          get: desc.get,
          set: function(v) { try { origSet.call(this, v); } catch(e) { origSet.call(this, "source-over"); } },
          configurable: true
        });
      }
    } catch(e) {}
  } catch(e) { console.warn("UXP polyfill setup failed:", e); }
})();
`;

// Assemble: polyfills + core library bundle
const bundle = polyfills + "\n" + coreBundle + "\n";

fs.writeFileSync(bundleDest, bundle);
console.log("Assembled scope bundle →", bundleDest);
console.log("Copied core HTML →", coreHtmlDest);
console.log("Photoshop plugin build complete.");
```

- [ ] **Step 3: Update build-plugins.sh to run build:lib**

In `scripts/build-plugins.sh`, after the core build step (the line that runs `npx turbo run build --filter=@chromascope/core`), add:

```bash
info "Building core library bundle..."
npx turbo run build:lib --filter=@chromascope/core
```

- [ ] **Step 4: Build and verify**

Run: `npm run build:plugins`

Expected: Build completes without errors. `plugins/photoshop/core/scope-bundle.js` exists and starts with the polyfill block, followed by the IIFE library code.

- [ ] **Step 5: Commit**

```bash
git add plugins/photoshop/scripts/build.js scripts/build-plugins.sh
git commit -m "fix(photoshop): replace fragile regex extraction with library bundle import"
```

---

### Task 3: Lightroom Shell Injection Prevention

Add whitelist validation to `appendOverlayFlags()` in `ImagePipeline.lua`.

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`

- [ ] **Step 1: Add whitelist tables and update appendOverlayFlags**

At the top of `ImagePipeline.lua`, after the `_binary` function block (after line 48), add whitelist tables. Then modify `appendOverlayFlags` to validate:

```lua
local VALID_SCHEMES = {
  complementary = true, splitComplementary = true,
  triadic = true, tetradic = true, analogous = true,
}
local VALID_COLORS = {
  red = true, orange = true, yellow = true,
  green = true, cyan = true, blue = true,
}
local VALID_DENSITY = { scatter = true, bloom = true, heatmap = true }

local function appendOverlayFlags(cmd, props)
  local scheme = props.scheme
  if scheme and scheme ~= "none" and VALID_SCHEMES[scheme] then
    cmd = cmd .. string.format(
      ' --scheme "%s" --rotation %d',
      scheme, math.floor((props.rotation or 0) + 0.5) % 360
    )
  end
  if props.skinTone == false then
    cmd = cmd .. ' --hide-skin-tone'
  end
  local overlayColor = props.overlayColor
  if overlayColor and VALID_COLORS[overlayColor] then
    cmd = cmd .. string.format(' --overlay-color "%s"', overlayColor)
  end
  local density = props.density
  if density and density ~= "scatter" and VALID_DENSITY[density] then
    cmd = cmd .. string.format(' --density "%s"', density)
  end
  return cmd
end
```

- [ ] **Step 2: Build and verify**

Run: `npm run build:plugins`

Expected: Build completes. The Lua file has the whitelist tables.

- [ ] **Step 3: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua
git commit -m "fix(lightroom): add whitelist validation to prevent shell injection"
```

---

### Task 4: Lightroom Binary Execution Hardening

Add binary existence check, exit code checks on overlay renders, and thumbnail timeout.

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`

- [ ] **Step 1: Add binary existence check**

Add after the `binary()` function (after line 48 in current file):

```lua
local _binaryVerified = false
local function verifyBinary()
  if _binaryVerified then return true end
  local bin = binary()
  if not LrFileUtils.exists(bin) then
    return false, "Processor binary not found at: " .. tostring(bin)
  end
  _binaryVerified = true
  return true
end
```

- [ ] **Step 2: Add binary check at the start of refresh()**

In `ImagePipeline.refresh(props)`, after `_busy = true` (line 226), add:

```lua
  local binOk, binErr = verifyBinary()
  if not binOk then
    props.status = binErr or "Binary missing"
    _busy = false
    return
  end
```

- [ ] **Step 3: Add exit code checks to refreshOverlayFast**

In `ImagePipeline.refreshOverlayFast`, change the bare `LrTasks.execute(renderCmd)` (line 306) to check exit code:

```lua
  local exitCode = LrTasks.execute(renderCmd)
  if exitCode ~= 0 then
    props.status = string.format("Overlay render failed (%s)", tostring(exitCode))
    _busy = false
    return
  end
```

- [ ] **Step 4: Add exit code checks to refreshOverlayFull**

Same change in `ImagePipeline.refreshOverlayFull` — change the bare `LrTasks.execute(renderCmd)` (line 337) to:

```lua
  local exitCode = LrTasks.execute(renderCmd)
  if exitCode ~= 0 then
    props.status = string.format("Overlay render failed (%s)", tostring(exitCode))
    _busy = false
    return
  end
```

- [ ] **Step 5: Add timeout to exportThumbnail**

In the `exportThumbnail` function, replace the bare while loop (line 215):

```lua
  -- Cooperative wait with timeout to prevent infinite hang if callback never fires
  local waited = 0
  while not done do
    LrTasks.sleep(0.05)
    waited = waited + 0.05
    if waited > 10 then
      return false, "Thumbnail request timed out (10s)"
    end
  end
```

- [ ] **Step 6: Build and verify**

Run: `npm run build:plugins`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua
git commit -m "fix(lightroom): add binary verification, exit code checks, and thumbnail timeout"
```

---

### Task 5: Core Input Validation

Add validation to `setPixels()`, null-safe DOM access in `main.ts`, and message validation in `protocol.ts`.

**Files:**
- Modify: `packages/core/src/chromascope.ts`
- Modify: `packages/core/src/main.ts`
- Modify: `packages/core/src/protocol.ts`
- Modify: `packages/core/test/chromascope.test.ts` (add validation tests)

- [ ] **Step 1: Write tests for setPixels validation**

In `packages/core/test/chromascope.test.ts`, add test cases:

```typescript
import { describe, it, expect } from "vitest";
import { Chromascope } from "../src/chromascope.js";

describe("Chromascope.setPixels validation", () => {
  it("throws on data length mismatch", () => {
    const scope = new Chromascope();
    expect(() =>
      scope.setPixels({
        data: new Uint8Array(10), // too short for 2x2x3=12
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
        data: new Uint8Array(12), // 2x2x3
        width: 2,
        height: 2,
        colorProfile: "sRGB",
      })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`

Expected: The "throws on data length mismatch" and "throws on zero width" tests fail because `setPixels` has no validation yet.

- [ ] **Step 3: Add validation to setPixels**

In `packages/core/src/chromascope.ts`, replace the `setPixels` method:

```typescript
  setPixels(pixelData: PixelData): void {
    if (pixelData.width <= 0 || pixelData.height <= 0) {
      throw new Error("setPixels: width and height must be greater than zero");
    }
    const expectedLength = pixelData.width * pixelData.height * 3;
    if (pixelData.data.length < expectedLength) {
      throw new Error(
        `setPixels: data length ${pixelData.data.length} is less than expected ${expectedLength} (${pixelData.width}x${pixelData.height}x3)`
      );
    }
    this.pixels = pixelData;
    this.remapPoints();
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npm test`

Expected: All tests pass including the new validation tests.

- [ ] **Step 5: Add null-safe DOM access in main.ts**

Replace lines 7-10 of `packages/core/src/main.ts`:

```typescript
const canvas = document.getElementById("scope-canvas") as HTMLCanvasElement | null;
const container = document.getElementById("scope-canvas-container") as HTMLElement | null;
const controlsEl = document.getElementById("controls-container") as HTMLElement | null;

if (!canvas || !container || !controlsEl) {
  console.warn("Chromascope: required DOM elements not found (scope-canvas, scope-canvas-container, controls-container)");
  throw new Error("Chromascope: missing required DOM elements");
}

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("Chromascope: failed to get 2d canvas context");
}
```

- [ ] **Step 6: Add message validation in protocol.ts**

In `packages/core/src/protocol.ts`, enhance the listener in `onHostMessage` to validate message structure. Replace the listener function body (lines 63-68):

```typescript
  const listener = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data.type !== "string" || !VALID_HOST_TYPES.has(data.type)) {
      return;
    }
    // Validate required fields per message type
    if (data.type === "pixels") {
      if (!Array.isArray(data.data) || typeof data.width !== "number" || typeof data.height !== "number") {
        console.warn("Chromascope: invalid pixels message — missing data, width, or height");
        return;
      }
    }
    handler(data as HostMessage);
  };
```

- [ ] **Step 7: Build and run all tests**

Run: `cd packages/core && npm run build && npm test`

Expected: Build succeeds. All tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/chromascope.ts packages/core/src/main.ts packages/core/src/protocol.ts packages/core/test/chromascope.test.ts
git commit -m "fix(core): add input validation for pixels, DOM access, and protocol messages"
```

---

### Task 6: Photoshop Error Handling Fixes

Fix Promise rejection breaking settings, ImageData leak, panel cleanup, and interactive mode.

**Files:**
- Modify: `plugins/photoshop/src/main.js`
- Modify: `plugins/photoshop/src/imaging.js`

- [ ] **Step 1: Fix settings Promise rejection**

In `plugins/photoshop/src/main.js`, find the settings handler (around line 611). Change from `.then()` to `.then().catch()`:

```javascript
        renderScope(needFullRender ? lastPixels : null, !needFullRender).then(function() {
          settingsRendering = false;
          if (settingsDirty) {
            settingsDirty = false;
            window.__chromascope.onSettingsChanged();
          }
        }).catch(function(err) {
          console.error("Chromascope settings render error:", err);
          settingsRendering = false;
          if (settingsDirty) {
            settingsDirty = false;
            window.__chromascope.onSettingsChanged();
          }
        });
```

- [ ] **Step 2: Add panel cleanup on hide**

In `plugins/photoshop/src/main.js`, replace the `hide()` handler (around line 682):

```javascript
      hide() {
        if (events) events.stopListening();
        // Reset state to prevent stale data on re-show
        lastPixels = null;
        cachedBaseBuf = null;
        cachedGraticuleBuf = null;
        isRefreshing = false;
      },
```

- [ ] **Step 3: Fix interactive mode in imaging.js**

In `plugins/photoshop/src/imaging.js`, change `interactive: true` to `interactive: false` on line 45:

```javascript
  }, { commandName: "Chromascope: Read Pixels", interactive: false });
```

- [ ] **Step 4: Build and verify**

Run: `npm run build:plugins`

Expected: Build completes without errors.

- [ ] **Step 5: Commit**

```bash
git add plugins/photoshop/src/main.js plugins/photoshop/src/imaging.js
git commit -m "fix(photoshop): fix settings promise rejection, panel cleanup, and interactive mode"
```

---

### Task 7: Rust Checked Arithmetic & Input Validation

Use checked arithmetic for dimension calculation and validate CLI enum arguments upfront.

**Files:**
- Modify: `packages/processor/src/main.rs`

- [ ] **Step 1: Add checked arithmetic and enum validation**

In `packages/processor/src/main.rs`, replace the dimension calculation in `cmd_render` (line 120) and add scheme/density/color-space validation:

```rust
fn cmd_render(args: RenderArgs) -> anyhow::Result<()> {
    if args.width == 0 || args.height == 0 {
        return Err(anyhow::anyhow!("Width and height must be greater than zero"));
    }
    if args.size == 0 {
        return Err(anyhow::anyhow!("Output size must be greater than zero"));
    }

    // Validate enum-like string arguments upfront
    const VALID_DENSITIES: &[&str] = &["scatter", "heatmap", "bloom"];
    if !VALID_DENSITIES.contains(&args.density.as_str()) {
        return Err(anyhow::anyhow!(
            "Unknown density mode '{}'. Valid: {}",
            args.density,
            VALID_DENSITIES.join(", ")
        ));
    }

    const VALID_COLOR_SPACES: &[&str] = &["hsl", "ycbcr", "cieluv"];
    if !VALID_COLOR_SPACES.contains(&args.color_space.as_str()) {
        return Err(anyhow::anyhow!(
            "Unknown color space '{}'. Valid: {}",
            args.color_space,
            VALID_COLOR_SPACES.join(", ")
        ));
    }

    if let Some(ref s) = args.scheme {
        const VALID_SCHEMES: &[&str] = &[
            "complementary", "splitComplementary", "triadic", "tetradic", "analogous",
        ];
        if !VALID_SCHEMES.contains(&s.as_str()) {
            return Err(anyhow::anyhow!(
                "Unknown harmony scheme '{}'. Valid: {}",
                s,
                VALID_SCHEMES.join(", ")
            ));
        }
    }

    let raw = fs::read(&args.input)
        .map_err(|e| anyhow::anyhow!("Failed to read {:?}: {}", args.input, e))?;

    // Checked arithmetic to prevent overflow on extreme dimensions
    let expected = (args.width as u64)
        .checked_mul(args.height as u64)
        .and_then(|x| x.checked_mul(3))
        .and_then(|x| usize::try_from(x).ok())
        .ok_or_else(|| anyhow::anyhow!("Image dimensions too large: {}x{}", args.width, args.height))?;

    if raw.len() != expected {
        return Err(anyhow::anyhow!(
            "Input has {} bytes, expected {} ({}x{}x3)",
            raw.len(), expected, args.width, args.height
        ));
    }

    let harmony = args.scheme.as_deref().map(|s| render::HarmonyConfig {
        scheme: s.to_string(),
        rotation_deg: args.rotation,
        overlay_color: args.overlay_color.clone(),
    });

    let scope = render::render_vectorscope(&raw, args.width, args.height, args.size, harmony.as_ref(), !args.hide_skin_tone, &args.density, &args.color_space);

    scope.save(&args.output)
        .map_err(|e| anyhow::anyhow!("Failed to save {:?}: {}", args.output, e))?;

    Ok(())
}
```

- [ ] **Step 2: Build and test**

Run: `cd packages/processor && cargo build --release && cargo test --release`

Expected: All 21 existing tests pass. Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/processor/src/main.rs
git commit -m "fix(processor): add checked arithmetic and upfront CLI argument validation"
```

---

## Phase 2: Testing & CI

### Task 8: Extract Photoshop Rendering Module

Extract testable functions from `main.js` into `rendering.js` so they can be unit-tested.

**Files:**
- Create: `plugins/photoshop/src/rendering.js`
- Modify: `plugins/photoshop/src/main.js`

- [ ] **Step 1: Create rendering.js with extracted functions**

Extract `FONT`, `drawChar`, `drawString`, `hsvToRgb`, `renderGraticule`, `renderToBuffer`, `applyHarmonyOverlay`, and the inline `mapHSLInline` into `plugins/photoshop/src/rendering.js`. Keep global state (cached buffers, bloom pools) inside the module.

The file should export:

```javascript
// plugins/photoshop/src/rendering.js
// Extracted rendering functions for testability.
// This module is pure computation — no UXP or Photoshop dependencies.

/* ... (copy all the rendering code from main.js lines 10-494) ... */

module.exports = {
  renderGraticule,
  renderToBuffer,
  applyHarmonyOverlay,
  hsvToRgb,
  // Exposed for testing only:
  _mapHSLInline: mapHSLInline,
  _getMapResult: function() { return { px: _mapPx, py: _mapPy, ok: _mapOk }; },
};
```

The key principle: all rendering functions are moved to `rendering.js`. `main.js` requires them and uses them.

- [ ] **Step 2: Update main.js to import from rendering.js**

In `plugins/photoshop/src/main.js`, replace the rendering code (lines 10-494) with:

```javascript
const {
  renderGraticule,
  renderToBuffer,
  applyHarmonyOverlay,
} = require("./src/rendering.js");
```

Keep everything else in `main.js` (the display pipeline, refresh logic, UI interactions, entrypoints).

Note: `renderGraticule`, `renderToBuffer`, and `applyHarmonyOverlay` reference `scopeSize`, `showSkinTone`, and `window.__chromascope` from the outer scope. These need to be passed as parameters instead. Refactor the function signatures:

- `renderToBuffer(size, pixels, densityMode)` — add `densityMode` parameter (currently reads from `window.__chromascope.getSettings()`)
- `renderGraticule(size)` — already takes size, no changes needed
- `applyHarmonyOverlay(baseBuf, size, settings, showSkinTone)` — pass settings and showSkinTone explicitly

Update `main.js` call sites to pass the new parameters.

- [ ] **Step 3: Verify the plugin still builds**

Run: `npm run build:plugins`

Expected: Build completes. No functional changes.

- [ ] **Step 4: Commit**

```bash
git add plugins/photoshop/src/rendering.js plugins/photoshop/src/main.js
git commit -m "refactor(photoshop): extract rendering functions into testable module"
```

---

### Task 9: Photoshop Test Harness

Set up Vitest for the Photoshop plugin.

**Files:**
- Modify: `plugins/photoshop/package.json`
- Create: `plugins/photoshop/vitest.config.js`

- [ ] **Step 1: Add vitest to package.json**

Update `plugins/photoshop/package.json`:

```json
{
  "name": "@chromascope/photoshop",
  "version": "1.0.0",
  "scripts": {
    "build": "node scripts/build.js",
    "dev": "node scripts/build.js --watch",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "~3.0"
  }
}
```

- [ ] **Step 2: Create vitest config**

Create `plugins/photoshop/vitest.config.js`:

```javascript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.js"],
  },
});
```

- [ ] **Step 3: Install and verify**

Run: `cd plugins/photoshop && npm install && npx vitest run`

Expected: Vitest runs, finds no tests yet, exits cleanly.

- [ ] **Step 4: Commit**

```bash
git add plugins/photoshop/package.json plugins/photoshop/vitest.config.js
git commit -m "chore(photoshop): add vitest test harness"
```

---

### Task 10: Photoshop Rendering Tests

Write unit tests for the extracted rendering functions.

**Files:**
- Create: `plugins/photoshop/src/__tests__/rendering.test.js`

- [ ] **Step 1: Write rendering tests**

Create `plugins/photoshop/src/__tests__/rendering.test.js`:

```javascript
import { describe, it, expect } from "vitest";
const {
  renderGraticule,
  renderToBuffer,
  hsvToRgb,
  _mapHSLInline,
  _getMapResult,
} = require("../rendering.js");

describe("hsvToRgb", () => {
  it("converts red (0°)", () => {
    const [r, g, b] = hsvToRgb(0, 1, 1);
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it("converts green (120°)", () => {
    const [r, g, b] = hsvToRgb(120, 1, 1);
    expect(r).toBe(0);
    expect(g).toBe(255);
    expect(b).toBe(0);
  });

  it("converts black (v=0)", () => {
    const [r, g, b] = hsvToRgb(0, 0, 0);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it("converts white (s=0, v=1)", () => {
    const [r, g, b] = hsvToRgb(0, 0, 1);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });
});

describe("mapHSLInline", () => {
  it("rejects achromatic pixels", () => {
    _mapHSLInline(128, 128, 128);
    const result = _getMapResult();
    expect(result.ok).toBe(false);
  });

  it("rejects pure black", () => {
    _mapHSLInline(0, 0, 0);
    expect(_getMapResult().ok).toBe(false);
  });

  it("rejects pure white", () => {
    _mapHSLInline(255, 255, 255);
    expect(_getMapResult().ok).toBe(false);
  });

  it("maps saturated red", () => {
    _mapHSLInline(255, 0, 0);
    const result = _getMapResult();
    expect(result.ok).toBe(true);
    expect(result.px).toBeGreaterThan(0);
  });
});

describe("renderGraticule", () => {
  it("returns a buffer of correct size", () => {
    const buf = renderGraticule(64);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(64 * 64 * 4);
  });

  it("caches the buffer for same size", () => {
    const buf1 = renderGraticule(64);
    const buf2 = renderGraticule(64);
    expect(buf1).toBe(buf2);
  });

  it("regenerates for different size", () => {
    const buf1 = renderGraticule(64);
    const buf2 = renderGraticule(32);
    expect(buf1).not.toBe(buf2);
    expect(buf2.length).toBe(32 * 32 * 4);
  });
});

describe("renderToBuffer", () => {
  it("returns correct buffer size for scatter mode", () => {
    const pixels = {
      data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 0]),
      width: 2,
      height: 2,
    };
    const buf = renderToBuffer(64, pixels, "scatter");
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(64 * 64 * 4);
  });

  it("returns correct buffer size for bloom mode", () => {
    const pixels = {
      data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 0]),
      width: 2,
      height: 2,
    };
    const buf = renderToBuffer(64, pixels, "bloom");
    expect(buf.length).toBe(64 * 64 * 4);
  });

  it("returns correct buffer size for heatmap mode", () => {
    const pixels = {
      data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 0]),
      width: 2,
      height: 2,
    };
    const buf = renderToBuffer(64, pixels, "heatmap");
    expect(buf.length).toBe(64 * 64 * 4);
  });

  it("returns only graticule when pixels is null", () => {
    const buf = renderToBuffer(64, null, "scatter");
    expect(buf.length).toBe(64 * 64 * 4);
    // Should have non-zero pixels (graticule background)
    let nonZero = 0;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i] > 0 || buf[i + 1] > 0 || buf[i + 2] > 0) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd plugins/photoshop && npx vitest run`

Expected: All tests pass. If `rendering.js` uses `window.__chromascope`, mock it in the test or adjust the extracted module to accept parameters.

- [ ] **Step 3: Commit**

```bash
git add plugins/photoshop/src/__tests__/rendering.test.js
git commit -m "test(photoshop): add unit tests for rendering module"
```

---

### Task 11: ESLint Setup

Add flat ESLint config for TypeScript and JavaScript linting.

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json` (root)
- Modify: `turbo.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Install ESLint dependencies**

Run: `npm install -D eslint @eslint/js typescript-eslint`

- [ ] **Step 2: Create eslint.config.js**

Create `eslint.config.js` at the repo root:

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/core/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./packages/core/tsconfig.json",
      },
    },
  },
  {
    files: ["plugins/photoshop/src/**/*.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        console: "readonly",
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        CanvasRenderingContext2D: "readonly",
        Uint8Array: "readonly",
        Uint8ClampedArray: "readonly",
        Float32Array: "readonly",
        Float64Array: "readonly",
        ImageData: "readonly",
      },
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: [
      "**/build/**",
      "**/build-lib/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/core/scope-bundle.js",
      "**/*.test.*",
    ],
  },
];
```

- [ ] **Step 3: Update turbo.json lint task**

In `turbo.json`, update the lint task:

```json
"lint": {
  "dependsOn": ["^build"]
}
```

- [ ] **Step 4: Add cargo clippy to CI**

In `.github/workflows/ci.yml`, add after `cargo test` in the processor job:

```yaml
      - run: cargo clippy --all-targets --manifest-path packages/processor/Cargo.toml -- -D warnings
```

- [ ] **Step 5: Run lint and fix any errors**

Run: `npx eslint packages/core/src/ plugins/photoshop/src/`

Fix any issues that come up. These should be minor (unused vars, etc.).

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js package.json package-lock.json turbo.json .github/workflows/ci.yml
git commit -m "chore: add ESLint flat config and cargo clippy to CI"
```

---

### Task 12: CI Improvements

Add Rust cache to CI, pin release runners, add branch protection.

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add Rust cache to CI workflow**

In `.github/workflows/ci.yml`, add after the `dtolnay/rust-toolchain@stable` step:

```yaml
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: packages/processor
```

(This is actually already there — verify and keep as-is.)

- [ ] **Step 2: Pin release runners**

In `.github/workflows/release.yml`, change:
- `runs-on: macos-latest` → `runs-on: macos-14`
- `runs-on: windows-latest` → `runs-on: windows-2022`

- [ ] **Step 3: Add branch guard to release**

In `.github/workflows/release.yml`, add a condition to the first job:

```yaml
  build-macos:
    if: github.ref_type == 'tag'
    runs-on: macos-14
```

This ensures release only runs on actual tag pushes (which is already the trigger, but this is defense-in-depth).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "chore(ci): pin runners, add Rust cache, and branch guards"
```

---

### Task 13: Dependabot Config

Add automated dependency updates.

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create dependabot.yml**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      dev-dependencies:
        patterns:
          - "*"
    open-pull-requests-limit: 5

  - package-ecosystem: "cargo"
    directory: "/packages/processor"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 3

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 3
```

- [ ] **Step 2: Commit**

```bash
git add .github/dependabot.yml
git commit -m "chore: add Dependabot for npm, cargo, and GitHub Actions"
```

---

## Phase 3: Architecture & Performance

### Task 14: Extract Shared Constants

Centralize magic numbers into constants files.

**Files:**
- Create: `packages/core/src/constants.ts`
- Modify: `packages/core/src/graticule.ts`
- Modify: `packages/core/src/interaction/hit-test.ts`
- Modify: `packages/core/src/overlays/harmony-renderer.ts`
- Modify: `packages/core/src/overlays/harmony-zones.ts`
- Modify: `packages/core/src/overlays/skin-tone-line.ts`

- [ ] **Step 1: Create constants.ts**

Create `packages/core/src/constants.ts`:

```typescript
// packages/core/src/constants.ts
// Shared constants used across the vectorscope rendering pipeline.

/** Fraction of canvas half-size used as the maximum radius, leaving room for labels. */
export const RADIUS_FACTOR = 0.45;

/** Base half-width for a harmony zone in radians (15°). */
export const HARMONY_BASE_HALF_WIDTH = Math.PI / 12;

/** Industry-standard skin tone line angle in degrees. */
export const SKIN_TONE_ANGLE_DEG = 123;

/** Industry-standard skin tone line angle in radians. */
export const SKIN_TONE_ANGLE_RAD = (123 * Math.PI) / 180;

export const TWO_PI = 2 * Math.PI;

/** Zone fill colors (semi-transparent) for harmony overlay rendering. */
export const ZONE_FILL_COLORS = [
  "rgba(255, 200, 50, 0.15)",
  "rgba(50, 200, 255, 0.15)",
  "rgba(255, 100, 200, 0.15)",
  "rgba(100, 255, 150, 0.15)",
] as const;

/** Zone border colors for harmony overlay rendering. */
export const ZONE_BORDER_COLORS = [
  "rgba(255, 200, 50, 0.6)",
  "rgba(50, 200, 255, 0.6)",
  "rgba(255, 100, 200, 0.6)",
  "rgba(100, 255, 150, 0.6)",
] as const;
```

- [ ] **Step 2: Update graticule.ts**

In `packages/core/src/graticule.ts`, add import and replace magic number:

```typescript
import { RADIUS_FACTOR } from "./constants.js";
```

Replace `size * 0.45` with `size * RADIUS_FACTOR` on lines 13, 90.

- [ ] **Step 3: Update hit-test.ts**

In `packages/core/src/interaction/hit-test.ts`:

```typescript
import { RADIUS_FACTOR, TWO_PI } from "../constants.js";
```

Replace `size * 0.45` with `size * RADIUS_FACTOR` on line 13. Remove the local `TWO_PI` constant on line 3.

- [ ] **Step 4: Update harmony-renderer.ts**

In `packages/core/src/overlays/harmony-renderer.ts`:

```typescript
import { RADIUS_FACTOR, ZONE_FILL_COLORS, ZONE_BORDER_COLORS } from "../constants.js";
```

Remove the local `ZONE_COLORS` and `ZONE_BORDER_COLORS` arrays (lines 5-17). Replace `size * 0.45` with `size * RADIUS_FACTOR` on line 28. Update references from `ZONE_COLORS` to `ZONE_FILL_COLORS`.

- [ ] **Step 5: Update harmony-zones.ts**

In `packages/core/src/overlays/harmony-zones.ts`:

```typescript
import { HARMONY_BASE_HALF_WIDTH, TWO_PI } from "../constants.js";
```

Remove local `BASE_HALF_WIDTH` (line 6) and `TWO_PI` (line 8). Replace usages.

- [ ] **Step 6: Update skin-tone-line.ts**

In `packages/core/src/overlays/skin-tone-line.ts`:

```typescript
import { SKIN_TONE_ANGLE_RAD, RADIUS_FACTOR } from "../constants.js";
```

Remove the local `SKIN_TONE_ANGLE` constant and its comment (lines 3-6). Replace `SKIN_TONE_ANGLE` with `SKIN_TONE_ANGLE_RAD`. Replace `size * 0.45` with `size * RADIUS_FACTOR` on line 11. Re-export for consumers: `export { SKIN_TONE_ANGLE_RAD as SKIN_TONE_ANGLE } from "../constants.js";`

- [ ] **Step 7: Build and test**

Run: `cd packages/core && npm run build && npm test`

Expected: All tests pass. No functional changes.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/constants.ts packages/core/src/graticule.ts packages/core/src/interaction/hit-test.ts packages/core/src/overlays/harmony-renderer.ts packages/core/src/overlays/harmony-zones.ts packages/core/src/overlays/skin-tone-line.ts
git commit -m "refactor(core): extract shared constants from scattered magic numbers"
```

---

### Task 15: Deduplicate Angular Distance

Move `angularDistance()` and `normalizeAngle()` to a shared math-utils module.

**Files:**
- Create: `packages/core/src/math-utils.ts`
- Modify: `packages/core/src/overlays/harmony-zones.ts`

- [ ] **Step 1: Create math-utils.ts**

Create `packages/core/src/math-utils.ts`:

```typescript
import { TWO_PI } from "./constants.js";

/** Normalize angle to [0, 2π) */
export function normalizeAngle(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Signed shortest angular distance from a to b, in [-π, π] */
export function angularDistance(a: number, b: number): number {
  let d = normalizeAngle(b) - normalizeAngle(a);
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}
```

- [ ] **Step 2: Update harmony-zones.ts to import from math-utils**

In `packages/core/src/overlays/harmony-zones.ts`, remove the local `normalizeAngle` and `angularDistance` functions and import them:

```typescript
import { normalizeAngle, angularDistance } from "../math-utils.js";
```

Remove lines 10-21 (the two local function definitions). Keep the rest unchanged — `getHarmonyZones`, `isPointInZone`, `nearestZoneDistance` already use these function names.

- [ ] **Step 3: Build and test**

Run: `cd packages/core && npm run build && npm test`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/math-utils.ts packages/core/src/overlays/harmony-zones.ts
git commit -m "refactor(core): deduplicate angular math into shared math-utils module"
```

---

### Task 16: Core Rendering Performance

Debounce ResizeObserver and cache graticule to offscreen canvas.

**Files:**
- Modify: `packages/core/src/main.ts`
- Modify: `packages/core/src/graticule.ts`
- Modify: `packages/core/src/chromascope.ts`

- [ ] **Step 1: Debounce ResizeObserver with requestAnimationFrame**

In `packages/core/src/main.ts`, replace lines 50-51:

```typescript
let resizeRafId = 0;
const resizeObserver = new ResizeObserver(() => {
  cancelAnimationFrame(resizeRafId);
  resizeRafId = requestAnimationFrame(resize);
});
resizeObserver.observe(container);
window.addEventListener("beforeunload", () => resizeObserver.disconnect());
```

- [ ] **Step 2: Cache graticule to offscreen canvas**

In `packages/core/src/graticule.ts`, add caching. Replace the function to return a cached canvas:

```typescript
import { RADIUS_FACTOR } from "./constants.js";

// ... HUE_LABELS stays the same ...

let _cachedCanvas: HTMLCanvasElement | null = null;
let _cachedSize = 0;

export function renderGraticule(ctx: CanvasRenderingContext2D, size: number): void {
  if (_cachedCanvas && _cachedSize === size) {
    ctx.drawImage(_cachedCanvas, 0, 0);
    return;
  }

  // Render to offscreen canvas
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const offCtx = offscreen.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * RADIUS_FACTOR;

  offCtx.clearRect(0, 0, size, size);
  offCtx.fillStyle = "#111111";
  offCtx.fillRect(0, 0, size, size);

  // ... rest of the graticule rendering code exactly as before,
  // but using offCtx instead of ctx ...

  // Cache and draw
  _cachedCanvas = offscreen;
  _cachedSize = size;
  ctx.drawImage(offscreen, 0, 0);
}
```

All the rendering code inside stays the same — just change `ctx` references to `offCtx` for the graticule drawing operations.

- [ ] **Step 3: Build and test**

Run: `cd packages/core && npm run build && npm test`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/main.ts packages/core/src/graticule.ts
git commit -m "perf(core): debounce ResizeObserver and cache graticule to offscreen canvas"
```

---

### Task 17: Refactor Chromascope Class

Extract pixel mapping into a standalone function.

**Files:**
- Create: `packages/core/src/pixel-mapper.ts`
- Modify: `packages/core/src/chromascope.ts`

- [ ] **Step 1: Create pixel-mapper.ts**

Create `packages/core/src/pixel-mapper.ts`:

```typescript
import type { ColorSpaceMapper, MappedPoint, PixelData } from "./types.js";

/**
 * Map raw RGB pixel data to vectorscope coordinates using the given color space mapper.
 * Pre-allocates the output array for performance.
 */
export function mapPixels(pixels: PixelData, mapper: ColorSpaceMapper): MappedPoint[] {
  const { data, width, height } = pixels;
  const totalPixels = width * height;
  const points: MappedPoint[] = new Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 3;
    points[i] = mapper.mapPixel(data[offset], data[offset + 1], data[offset + 2]);
  }

  return points;
}
```

- [ ] **Step 2: Update chromascope.ts to use mapPixels**

In `packages/core/src/chromascope.ts`, import `mapPixels` and replace the `remapPoints` method:

```typescript
import { mapPixels } from "./pixel-mapper.js";

// ... in the class ...

  private remapPoints(): void {
    if (!this.pixels) {
      this.mappedPoints = [];
      return;
    }
    this.mappedPoints = mapPixels(this.pixels, this.mapper);
  }
```

- [ ] **Step 3: Build and test**

Run: `cd packages/core && npm run build && npm test`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/pixel-mapper.ts packages/core/src/chromascope.ts
git commit -m "refactor(core): extract pixel mapping into standalone module"
```

---

### Task 18: Rust Module Split

Split `render.rs` into submodules.

**Files:**
- Delete: `packages/processor/src/render.rs`
- Create: `packages/processor/src/render/mod.rs`
- Create: `packages/processor/src/render/colorspace.rs`
- Create: `packages/processor/src/render/modes.rs`
- Create: `packages/processor/src/render/draw.rs`

- [ ] **Step 1: Read render.rs to identify split points**

Read `packages/processor/src/render.rs` fully. Identify:
- **Constants + HarmonyConfig + public API** → `mod.rs`
- **Color space functions** (map_ycbcr, map_cieluv, map_hsl, map_pixels) → `colorspace.rs`
- **Rendering modes** (scatter, bloom, heatmap render loops) → `modes.rs`
- **Drawing utilities** (draw_line, draw_arc, draw_arrowhead, draw_color_ring, draw_degree_markers, blend_pixel) → `draw.rs`

- [ ] **Step 2: Create the render/ directory and move code**

Create `packages/processor/src/render/` directory. Split `render.rs` into four files:

**mod.rs**: Constants, `HarmonyConfig` struct, `MappedPoint` struct, `render_vectorscope()` function. Imports from submodules.

```rust
mod colorspace;
mod draw;
mod modes;

use colorspace::map_pixels;
use draw::*;
use modes::*;

// ... constants, HarmonyConfig, render_vectorscope() ...
```

**colorspace.rs**: `map_ycbcr()`, `map_cieluv()`, `map_hsl()`, `map_pixels()`, and the `MappedPoint` struct (if not in mod.rs).

**modes.rs**: `render_scatter()`, `render_bloom()`, `render_heatmap()` functions.

**draw.rs**: `blend_pixel()`, `draw_line_aa()`, `draw_arrowhead()`, `draw_harmony_overlay()`, `draw_skin_tone_line()`, `draw_graticule()`, `draw_color_ring()`, `draw_degree_markers()`.

- [ ] **Step 3: Delete the old render.rs**

Remove `packages/processor/src/render.rs`.

- [ ] **Step 4: Build and test**

Run: `cd packages/processor && cargo build --release && cargo test --release`

Expected: All 21 tests pass. The public API (`render_vectorscope`, `HarmonyConfig`) is unchanged — `main.rs` uses `mod render;` which now resolves to `render/mod.rs`.

- [ ] **Step 5: Commit**

```bash
git add packages/processor/src/render/
git rm packages/processor/src/render.rs
git commit -m "refactor(processor): split render.rs into colorspace, modes, and draw submodules"
```

---

## Phase 4: DX & Automation

### Task 19: Version Bump Script

Create a script to update version across all 6 files atomically.

**Files:**
- Create: `scripts/bump-version.sh`
- Modify: `docs/CONTRIBUTING.md`

- [ ] **Step 1: Create bump-version.sh**

Create `scripts/bump-version.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.0"
  exit 1
fi

VERSION="$1"

# Validate semver format (basic check)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in X.Y.Z format (got: $VERSION)"
  exit 1
fi

MAJOR=$(echo "$VERSION" | cut -d. -f1)
MINOR=$(echo "$VERSION" | cut -d. -f2)
PATCH=$(echo "$VERSION" | cut -d. -f3)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Bumping version to $VERSION..."

# 1. packages/core/package.json
sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' packages/core/package.json

# 2. packages/processor/package.json
sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' packages/processor/package.json

# 3. packages/processor/Cargo.toml
sed -i.bak 's/^version = "[^"]*"/version = "'"$VERSION"'"/' packages/processor/Cargo.toml

# 4. plugins/photoshop/package.json
sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' plugins/photoshop/package.json

# 5. plugins/photoshop/manifest.json — "version" field
sed -i.bak 's/"version": "[^"]*"/"version": "'"$VERSION"'"/' plugins/photoshop/manifest.json

# 6. plugins/lightroom/chromascope.lrdevplugin/Info.lua
sed -i.bak "s/VERSION = { major = [0-9]*, minor = [0-9]*, revision = [0-9]* }/VERSION = { major = $MAJOR, minor = $MINOR, revision = $PATCH }/" \
  plugins/lightroom/chromascope.lrdevplugin/Info.lua

# Clean up sed backup files
find . -name "*.bak" -delete

echo ""
echo "Updated files:"
git diff --stat
echo ""
echo "Version bumped to $VERSION"
echo "Run 'git add -A && git commit -m \"chore: bump version to $VERSION\"' to commit."
```

- [ ] **Step 2: Make executable**

Run: `chmod +x scripts/bump-version.sh`

- [ ] **Step 3: Test the script**

Run: `./scripts/bump-version.sh 0.2.0`

Expected: All 6 files updated. `git diff` shows version changes. Then revert: `git checkout -- .`

- [ ] **Step 4: Update CONTRIBUTING.md**

In `docs/CONTRIBUTING.md`, find the "Release Process" section that lists the 6 files. Replace the manual list with:

```markdown
### Version Bumping

Run the version bump script to update all files atomically:

```bash
./scripts/bump-version.sh 1.2.0
```

This updates: `packages/core/package.json`, `packages/processor/package.json`,
`packages/processor/Cargo.toml`, `plugins/photoshop/package.json`,
`plugins/photoshop/manifest.json`, and `plugins/lightroom/.../Info.lua`.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/bump-version.sh docs/CONTRIBUTING.md
git commit -m "feat(dx): add version bump script for atomic multi-file updates"
```

---

### Task 20: Turborepo Plugin Build Integration

Register plugin builds as turbo tasks for caching.

**Files:**
- Modify: `turbo.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Add build:lib task to turbo.json**

In `turbo.json`, add the `build:lib` task:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", ".next/**", "!.next/cache/**"]
    },
    "build:lib": {
      "dependsOn": ["^build"],
      "outputs": ["build-lib/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 2: Verify turbo can run build:lib**

Run: `npx turbo run build:lib --filter=@chromascope/core`

Expected: Runs `build:lib` in packages/core, outputs cached.

- [ ] **Step 3: Commit**

```bash
git add turbo.json
git commit -m "chore: register build:lib as turbo task for caching"
```

---

### Task 21: Documentation Fixes

Fix version inconsistencies and add reference docs.

**Files:**
- Modify: `docs/LOCAL_DEVELOPMENT.md`
- Create: `docs/reference/processor-cli.md`
- Create: `docs/reference/core-protocol.md`

- [ ] **Step 1: Fix Node version in LOCAL_DEVELOPMENT.md**

Read `docs/LOCAL_DEVELOPMENT.md` and find the Node version reference. Change "Node 20+" to "Node 18+" to match SETUP.md.

- [ ] **Step 2: Create processor CLI reference**

Create `docs/reference/processor-cli.md`:

```markdown
# Processor CLI Reference

The `processor` binary decodes images and renders vectorscopes. Used by the Lightroom plugin.

## Commands

### `processor decode`

Decode a JPEG or TIFF image to raw RGB bytes.

```
processor decode --input <path> --output <path> [--width 256] [--height 256]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | required | Input JPEG/TIFF path |
| `--output` | required | Output raw RGB path |
| `--width` | 256 | Output width in pixels |
| `--height` | 256 | Output height in pixels |

### `processor render`

Render a vectorscope JPEG from raw RGB pixel data.

```
processor render --input <path> --output <path> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | required | Input raw RGB path |
| `--output` | required | Output JPEG path |
| `--width` | 256 | Input image width |
| `--height` | 256 | Input image height |
| `--size` | 512 | Output vectorscope size |
| `--density` | scatter | Density mode: `scatter`, `bloom`, `heatmap` |
| `--color-space` | hsl | Color space: `hsl`, `ycbcr`, `cieluv` |
| `--scheme` | — | Harmony: `complementary`, `splitComplementary`, `triadic`, `tetradic`, `analogous` |
| `--rotation` | 0.0 | Harmony rotation in degrees |
| `--overlay-color` | yellow | Line color: `white`, `yellow`, `cyan`, `green`, `magenta`, `orange` |
| `--hide-skin-tone` | false | Hide the 123° skin tone reference line |

## Examples

```bash
# Decode a JPEG to 128×128 raw RGB
processor decode --input photo.jpg --output pixels.rgb --width 128 --height 128

# Render a vectorscope with bloom and complementary harmony
processor render --input pixels.rgb --output scope.jpg \
  --width 128 --height 128 --size 512 \
  --density bloom --scheme complementary --rotation 45
```
```

- [ ] **Step 3: Create core protocol reference**

Create `docs/reference/core-protocol.md`:

```markdown
# Core ↔ Host Message Protocol

The core vectorscope library communicates with host plugins (Photoshop, Lightroom) via `postMessage`.

## Host → Core Messages

### `pixels`
Send pixel data for rendering.

```json
{
  "type": "pixels",
  "data": [255, 0, 0, 0, 255, 0, ...],
  "width": 128,
  "height": 128,
  "colorProfile": "sRGB"
}
```

- `data`: Interleaved RGB bytes (length = width × height × 3)
- `colorProfile`: Color profile name (informational)

### `settings`
Update vectorscope settings.

```json
{
  "type": "settings",
  "colorSpace": "hsl",
  "densityMode": "bloom",
  "harmony": {
    "scheme": "complementary",
    "rotation": 0.5,
    "zoneWidth": 1.0,
    "pullStrengths": [0.5, 0.5]
  }
}
```

All fields are optional — only provided fields are updated.

### `highlight`
Reserved for future pixel-region highlighting.

## Core → Host Messages

### `edit`
Request a color adjustment in the host application.

```json
{
  "type": "edit",
  "mode": "hsl",
  "params": { "hue": 10, "saturation": -5 }
}
```

### `highlight`
Report a hovered region on the vectorscope.

```json
{
  "type": "highlight",
  "region": { "angle": 1.57, "radius": 0.6, "width": 0.2 }
}
```
```

- [ ] **Step 4: Commit**

```bash
git add docs/LOCAL_DEVELOPMENT.md docs/reference/processor-cli.md docs/reference/core-protocol.md
git commit -m "docs: fix Node version, add processor CLI and protocol reference"
```

---

### Task 22: Pre-commit Hook

Add a lightweight pre-commit hook for linting.

**Files:**
- Create: `.githooks/pre-commit`
- Create: `scripts/install-hooks.sh`
- Modify: `scripts/setup.sh`

- [ ] **Step 1: Create pre-commit hook**

Create `.githooks/pre-commit`:

```bash
#!/usr/bin/env bash
# Chromascope pre-commit hook: lint staged TypeScript/JavaScript files.

# Only lint if there are staged TS/JS files
STAGED_TS=$(git diff --cached --name-only --diff-filter=d | grep -E '\.(ts|js)$' | grep -v node_modules || true)
if [ -n "$STAGED_TS" ]; then
  echo "Running ESLint on staged files..."
  npx eslint $STAGED_TS --max-warnings 0
fi

# Only run clippy if Rust files changed
STAGED_RS=$(git diff --cached --name-only --diff-filter=d | grep '\.rs$' || true)
if [ -n "$STAGED_RS" ]; then
  echo "Running cargo clippy..."
  cargo clippy --manifest-path packages/processor/Cargo.toml --all-targets -- -D warnings
fi
```

- [ ] **Step 2: Create install-hooks.sh**

Create `scripts/install-hooks.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Installing git hooks..."
git config core.hooksPath "$REPO_ROOT/.githooks"
chmod +x "$REPO_ROOT/.githooks/pre-commit"
echo "Git hooks installed (using .githooks/ directory)."
```

- [ ] **Step 3: Make scripts executable**

Run: `chmod +x .githooks/pre-commit scripts/install-hooks.sh`

- [ ] **Step 4: Add hook installation to setup.sh**

In `scripts/setup.sh`, before the "Next steps" output, add:

```bash
# Install git hooks
bash "$REPO_ROOT/scripts/install-hooks.sh"
```

- [ ] **Step 5: Commit**

```bash
git add .githooks/pre-commit scripts/install-hooks.sh scripts/setup.sh
git commit -m "chore(dx): add pre-commit hook for ESLint and clippy"
```

---

## Phase 5: Polish

### Task 23: Core Accessibility

Add ARIA attributes to canvas and control labels.

**Files:**
- Modify: `packages/core/src/main.ts`
- Modify: `packages/core/src/ui/controls.ts`

- [ ] **Step 1: Add canvas ARIA attributes in main.ts**

In `packages/core/src/main.ts`, after the canvas null check, add:

```typescript
canvas.setAttribute("role", "img");
canvas.setAttribute("aria-label", "Vectorscope visualization showing color distribution");
```

- [ ] **Step 2: Add button titles and input labels in controls.ts**

In `packages/core/src/ui/controls.ts`:

Add a `title` map for harmony scheme abbreviations. In the `HARMONY_SCHEMES` array, add a `title` field:

```typescript
const HARMONY_SCHEMES: Array<{ id: HarmonySchemeId | "none"; label: string; title: string }> = [
  { id: "none", label: "Off", title: "No harmony overlay" },
  { id: "complementary", label: "Cmp", title: "Complementary" },
  { id: "splitComplementary", label: "Spl", title: "Split Complementary" },
  { id: "triadic", label: "Tri", title: "Triadic" },
  { id: "tetradic", label: "Tet", title: "Tetradic" },
  { id: "analogous", label: "Ana", title: "Analogous" },
];
```

In `renderButtonGroup`, add the title attribute to each button:

```typescript
      btn.textContent = item.label;
      if ("title" in item && item.title) {
        btn.setAttribute("title", item.title);
      }
```

For sliders in `renderSlider`, associate labels with inputs:

```typescript
    const inputId = `vs-${label.toLowerCase().replace(/\s+/g, "-")}`;
    input.id = inputId;
    lbl.setAttribute("for", inputId);
    input.setAttribute("aria-label", label);
```

- [ ] **Step 3: Build and test**

Run: `cd packages/core && npm run build && npm test`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/main.ts packages/core/src/ui/controls.ts
git commit -m "fix(core): add ARIA attributes to canvas and control labels"
```

---

### Task 24: Dead Code Cleanup

Remove unused `EditBridge.lua` and stop copying core HTML to Lightroom plugin.

**Files:**
- Delete: `plugins/lightroom/chromascope.lrdevplugin/EditBridge.lua`
- Modify: `scripts/build-plugins.sh`

- [ ] **Step 1: Remove EditBridge.lua**

Run: `git rm plugins/lightroom/chromascope.lrdevplugin/EditBridge.lua`

- [ ] **Step 2: Remove core HTML copy from Lightroom assembly**

In `scripts/build-plugins.sh`, find the section that copies core HTML to the Lightroom plugin directory (the line that copies `index.html` to `plugins/lightroom/.../core/`). Remove or comment out that line.

Also check `scripts/package-release.sh` — if it copies `core/` directory into Lightroom release package, remove that too.

- [ ] **Step 3: Build and verify**

Run: `npm run build:plugins`

Expected: Build completes. Lightroom plugin no longer has `core/index.html`.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-plugins.sh scripts/package-release.sh
git commit -m "chore: remove unused EditBridge.lua and core HTML from Lightroom plugin"
```

---

### Task 25: Lightroom SDK Version

Lower minimum SDK version for broader compatibility.

**Files:**
- Modify: `plugins/lightroom/chromascope.lrdevplugin/Info.lua`

- [ ] **Step 1: Update Info.lua**

In `plugins/lightroom/chromascope.lrdevplugin/Info.lua`, change line 4:

```lua
  LrSdkMinimumVersion = 11.0,
```

Keep `LrSdkVersion = 15.0` unchanged (this is what the plugin was built against).

- [ ] **Step 2: Commit**

```bash
git add plugins/lightroom/chromascope.lrdevplugin/Info.lua
git commit -m "fix(lightroom): lower LrSdkMinimumVersion to 11.0 for broader compatibility"
```

---

### Task 26: Website Tailwind Compilation

Replace CDN with compiled CSS for production.

**Files:**
- Create: `web/css/input.css`
- Modify: `web/index.html`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `package.json` (root)

- [ ] **Step 1: Install Tailwind CSS**

Run: `npm install -D @tailwindcss/cli`

- [ ] **Step 2: Create Tailwind input file**

Create `web/css/input.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 3: Build Tailwind CSS**

Run: `npx @tailwindcss/cli -i web/css/input.css -o web/css/tailwind.css --minify`

Expected: `web/css/tailwind.css` is created with compiled styles.

- [ ] **Step 4: Update web/index.html**

In `web/index.html`, find the Tailwind CDN script tag (should be something like `<script src="https://cdn.tailwindcss.com"></script>`) and replace it with:

```html
<link rel="stylesheet" href="/css/tailwind.css">
```

Do the same in `web/download/index.html` and `web/docs/index.html` if they have the CDN tag.

- [ ] **Step 5: Add Tailwind build to deploy workflow**

In `.github/workflows/deploy-pages.yml`, add a build step before the upload:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx @tailwindcss/cli -i web/css/input.css -o web/css/tailwind.css --minify
```

- [ ] **Step 6: Add tailwind.css to .gitignore**

Append to `.gitignore`:

```
web/css/tailwind.css
```

- [ ] **Step 7: Commit**

```bash
git add web/css/input.css web/index.html .github/workflows/deploy-pages.yml package.json package-lock.json .gitignore
git commit -m "perf(web): replace Tailwind CDN with compiled CSS build"
```

---

## Post-Implementation

After all 26 tasks are complete:

- [ ] **Final verification**: Run `npm run build:plugins && cd packages/core && npm test && cd ../../packages/processor && cargo test --release`
- [ ] **Final commit**: If any loose changes remain, commit them
- [ ] **Build plugins**: Run `npm run build:plugins` to verify the full pipeline
