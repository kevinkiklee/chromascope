# Automated E2E & Visual Regression Testing

## Problem

Chromascope has solid unit and integration tests (15 Vitest suites for the core, Rust integration tests for the processor, rendering tests for the PS plugin), but no automated end-to-end testing of the plugins running inside their host apps, and no visual regression testing of the rendered vectorscope output. Manual QA is limited to checking the default state and toggling a couple of settings due to time constraints, leaving most of the configuration matrix unverified.

## Goals

1. Automated visual regression testing across the full configuration matrix for both renderers (Rust processor, TypeScript core, Photoshop software renderer)
2. Automated smoke tests that verify plugins work inside Photoshop and Lightroom
3. Visual diff reporting with side-by-side comparison for failures
4. A single `npm run test:release` command as a local pre-release gate
5. CI integration for platform-independent tests (Rust processor visual regression)

## Non-Goals

- Running host-app tests in CI (requires licensed Adobe apps)
- Testing on Windows (macOS-only for local E2E; cross-platform covered by Rust processor in CI)
- Performance benchmarking (separate concern)

## Architecture: Three-Layer Testing Pyramid

```
Layer 3: Host Visual Capture     (local, pre-release)
  PS: extract rendered image → diff against Rust baselines
  LR: Lua unit tests for plugin logic

Layer 2: Host Integration Smoke  (local, pre-release)
  PS: UXP test harness → open doc → render → verify
  LR: shell script → decode → render → validate

Layer 1: Headless Visual Regression  (CI + local)
  Rust processor: PNG snapshots across pairwise matrix
  TS core: Playwright + headless Chromium snapshots
```

---

## Layer 1: Headless Visual Regression

### Rust Processor Snapshots

**Location:** `packages/processor/tests/visual_regression.rs`

**Configuration matrix:** Pairwise-reduced covering array (~35 configurations) generated from:
- Color space: `hsl`, `ycbcr`, `cieluv` (3)
- Density mode: `scatter`, `heatmap`, `bloom` (3)
- Harmony scheme: `none`, `complementary`, `splitComplementary`, `triadic`, `tetradic`, `analogous` (6)
- Skin tone line: `on`, `off` (2)
- Harmony rotation: `0`, `120`, `240` (3, only when scheme ≠ none)

The covering array is generated once using Microsoft's PICT tool and committed as a fixture at `packages/processor/tests/fixtures/test_matrix.txt` so it's deterministic and reviewable.

**Reference inputs (5):**
- `test.jpg` — existing solid color (200, 100, 50)
- `multicolor.jpg` — existing 256×256 quad pattern (R, G, B, white)
- `neutral_gray.jpg` — new: 256×256 flat (128, 128, 128) — tests near-zero chroma
- `saturated_primaries.jpg` — new: 256×256 with pure R, G, B, C, M, Y blocks — tests full gamut extremes
- `warm_skin.jpg` — new: 256×256 gradient in skin-tone hue range (20°–50°) — tests skin tone line relevance

Total snapshots: ~35 configs × 5 inputs = ~175 images.

**New processor feature:** `--output-format png` flag on the `render` command. Outputs lossless PNG instead of JPEG, eliminating compression artifacts from comparisons.

**Baseline workflow:**
- Generate baselines: `UPDATE_BASELINES=1 cargo test --release --test visual_regression`
- Run comparisons: `cargo test --release --test visual_regression`
- Baselines stored in `packages/processor/tests/baselines/` under Git LFS

**Comparison:** Pixel-by-pixel RMSE on 0–255 scale. Threshold: RMSE > 0.5 fails. (Calibration: two identical runs produce RMSE = 0.0 because the Rust renderer is pure math with no system-dependent rendering.)

**On failure:** Writes `{name}_actual.png` and `{name}_diff.png` (white = match, red = difference) next to the baseline. Appends entry to `test-results/rust-visual-results.json`.

**CI integration:** New job in `.github/workflows/ci.yml`. Baselines fetched from LFS. Failures upload the diff artifacts for inspection.

### TypeScript Core Snapshots

**Location:** `packages/core/test/visual-regression.test.ts`

**Mechanism:** Playwright with pinned Chromium version. The test:
1. Launches headless Chromium
2. Navigates to `packages/core/build/index.html`
3. Injects test pixel data via a new `window.__chromascope.injectTestPixels(rgbaArray, width, height)` method (see Test Pixel Injection below)
4. Sets each configuration via `window.__chromascope.setSettings({...})`
5. Captures Canvas output via `canvas.toDataURL('image/png')`
6. Compares against baselines using `pixelmatch` with anti-aliasing tolerance

**Test pixel injection:** New method on the core's public API, gated behind a `testMode` flag that's only set when the URL contains `?test=true`. Accepts a flat `Uint8Array` of RGBA pixel data and processes it through the existing rendering pipeline as if it came from the host. This avoids any production code changes — the flag is only activated by the test harness.

**Playwright version pinning:** Exact Playwright version pinned in `package.json`. Chromium version locked via `npx playwright install chromium`. Baseline regeneration required when updating Playwright (documented in contributing guide).

**Baselines:** `packages/core/test/baselines/` under Git LFS. Same pairwise matrix and reference inputs as Rust.

**Comparison:** `pixelmatch` with threshold 0.1, includeAA: true. Fails if differing pixel count > 0.1% of total pixels.

**Runs locally only.** Canvas rendering varies across OS and Chromium version. Not added to CI. The Rust processor snapshots in CI catch the vast majority of rendering regressions.

### Git LFS Setup

`.gitattributes` additions:
```
packages/processor/tests/baselines/*.png filter=lfs diff=lfs merge=lfs -text
packages/core/test/baselines/*.png filter=lfs diff=lfs merge=lfs -text
```

Estimated storage: ~175 Rust PNGs (~9MB) + ~175 TS PNGs (~9MB) = ~18MB. Well within GitHub free-tier LFS limits (1GB storage).

### HTML Report

**Location:** `scripts/visual-report.js` → `test-results/visual-report.html`

Reads `test-results/rust-visual-results.json` and `test-results/core-visual-results.json`.

**Layout:**
- Summary bar: X passed / Y failed / Z new (no baseline yet)
- Failed entries sorted to top, highlighted red
- Filterable by: renderer (Rust/Core/PS), input image, color space, density mode
- Each entry expandable to show: baseline | actual | diff side-by-side
- Grouped by: input image → configuration name

---

## Layer 2: Host Integration Smoke Tests

### Photoshop (UXP Test Harness)

**Test harness architecture:** The Photoshop plugin gains a test mode activated via the UXP WebView message bridge (already enabled in the manifest: `enableMessageBridge=localAndRemote`). When the test runner sends `{ type: 'test:start' }` via the bridge, the plugin:
- Exposes test API methods on the bridge (`test:extractImage`, `test:setConfig`, `test:getStatus`, `test:reloadPanel`)
- Reports errors and render completions back via bridge messages

**Test runner:** `tests/e2e/photoshop/smoke.mjs` — a Node.js script that:
1. Checks if Photoshop is running (`pgrep -x "Adobe Photoshop"`, exits gracefully with skip message if not)
2. Creates a test document programmatically via ExtendScript (`osascript -l JavaScript` on macOS sends Apple Events to run a JSX script that creates a 1000×1000 document with known fill colors — macOS-only, aligns with the non-goal of Windows local testing)
3. Activates the Chromascope panel
4. Sends `test:start` to enter test mode
5. Waits for initial render, verifies:
   - Panel reports `status: 'ready'` (no errors)
   - Rendered image dimensions = 300×300
   - Rendered image byte length > minimum threshold (not blank/corrupt)
6. Cycles through 3 representative configurations:
   - Default (scatter, HSL, no harmony)
   - Heatmap + CIELuv + triadic
   - Bloom + YCbCr + complementary + skin tone off
7. For each: sets config via `test:setConfig`, waits for render complete, verifies valid output
8. Tests settings persistence: sets a non-default config, sends `test:reloadPanel`, verifies settings survived the reload
9. Writes results to `test-results/photoshop-smoke.json`

**Test mode code isolation:** The test harness bridge handlers are in a separate file (`src/test-harness.js`) that is only imported when `test:start` is received. No test code runs in the normal production path. The build script can optionally strip this file for release builds via a `STRIP_TEST_HARNESS=1` flag.

### Lightroom (Pipeline Smoke Test)

**Location:** `tests/e2e/lightroom/smoke.sh`

Tests the real rendering pipeline outside of LrC:

1. Detects platform and selects the correct processor binary
2. For each reference input image:
   - Runs `processor decode --input <img> --output /tmp/chromascope_test.rgb --width 128 --height 128`
   - Validates: output file exists, byte count = 128 × 128 × 3 = 49152
   - Runs `processor render --input /tmp/chromascope_test.rgb --output /tmp/chromascope_test.png --output-format png --width 128 --height 128 --size 512` with 3 representative configurations
   - Validates: output is valid PNG (magic bytes), dimensions correct
   - Compares output against Layer 1 Rust processor baselines (should match exactly — same binary, same input, same flags); any difference indicates an environment issue
3. Writes results to `test-results/lightroom-smoke.json`

### Lightroom Lua Unit Tests

**Location:** `tests/e2e/lightroom/lua/`

The Lightroom plugin's Lua code contains pure logic that can be tested outside the LrC sandbox with a standalone Lua 5.4 interpreter:

**Extracted testable functions (into a `utils.lua` module):**
- `hashDevelopSettings(settings)` — recursive djb2 hash over settings table
- `nextScopePath(currentIndex)` — frame alternation logic (returns path + next index)
- `settingsChanged(oldHash, newHash)` — change detection comparison

**Test file:** `tests/e2e/lightroom/lua/test_utils.lua` using a minimal assertion library (no external dependencies — just `assert()` with descriptive messages).

**Tests:**
- Hash produces consistent output for same input
- Hash produces different output for different inputs
- Hash handles nested tables, nil values, edge cases
- Frame alternation cycles correctly between 0 and 1
- Path generation produces expected filenames
- Settings change detection correctly identifies changes and non-changes

**Run:** `lua tests/e2e/lightroom/lua/test_utils.lua` (requires Lua 5.4 installed, not run in CI)

---

## Layer 3: Host Visual Capture

### Photoshop Visual Capture

Extends the Layer 2 smoke test. After the smoke tests pass:

1. For each of the 3 test configurations, sends `test:extractImage` via the bridge
2. The plugin returns the current rendered vectorscope as a base64 PNG (uses the existing `imaging.encodeImageData()` path with PNG format)
3. Saves to `test-results/photoshop/{config_name}.png`
4. Diffs against the corresponding **Rust processor baseline** (the PS software renderer is algorithmically aligned with the Rust renderer, not the Canvas-based core renderer)
5. Threshold: RMSE > 5.0 fails (loose — they are independent implementations that should produce visually similar but not pixel-identical output)
6. On failure: writes diff image, appends to `test-results/photoshop-visual.json`

**Why compare against Rust baselines, not TS core baselines:** The Photoshop plugin uses a software renderer (`rendering.js` — pure Uint8Array buffer math) that was written to match the Rust renderer's algorithmic approach. The TS core uses Canvas2D, which is a different rendering path. Comparing PS against Rust catches actual divergence; comparing against TS core would produce noisy false positives.

### Lightroom Visual Capture

**Not a separate layer.** The Lightroom pipeline smoke test (Layer 2) already produces the processor's output PNGs, and those are exactly what `f:picture` displays to the user. The diff against Layer 1 baselines (which should be exact match) is already part of Layer 2 step 2.e. Adding a separate Layer 3 for Lightroom would be redundant.

**The Lua unit tests (Layer 2) fill this slot instead** — they cover the plugin-specific logic (change detection, frame alternation, path management) that the rendering pipeline tests cannot reach.

---

## Build Verification

`npm run test:release` always runs `npm run build:plugins` first, then verifies build artifacts are fresher than their source files:

**Checks:**
- `plugins/photoshop/core/scope-bundle.js` newer than `packages/core/src/**`
- `plugins/lightroom/chromascope.lrdevplugin/core/index.html` newer than `packages/core/src/**`
- Processor binaries newer than `packages/processor/src/**`

If any artifact is stale, the build step catches it. If `build:plugins` fails, `test:release` aborts before running any tests.

---

## Command Interface

```sh
# Full pre-release gate (local)
npm run test:release
# Runs: build:plugins → Layer 1 (both) → Layer 2 (both) → Layer 3 (PS) → report

# Layer 1 only — headless visual regression
npm run test:visual
# Runs: Rust snapshots + TS core snapshots → report

# Layer 1 Rust only (CI-safe)
npm run test:visual:rust
# Runs: cargo test --release --test visual_regression

# Layer 1 TS core only
npm run test:visual:core
# Runs: Playwright-based core snapshots

# Layer 2 only — smoke tests
npm run test:smoke
# Runs: PS smoke (skips if PS not running) + LR pipeline + LR Lua tests

# Update baselines after verified rendering change
npm run test:update-baselines
# Runs: UPDATE_BASELINES=1 for both Rust and TS core

# Generate HTML report from existing results
npm run test:report
# Runs: scripts/visual-report.js → test-results/visual-report.html
```

---

## File Structure

```
tests/
  e2e/
    photoshop/
      smoke.mjs              # PS smoke test runner
    lightroom/
      smoke.sh               # LR pipeline smoke test
      lua/
        test_utils.lua        # Lua unit tests
  fixtures/
    test_matrix.txt           # PICT-generated pairwise covering array
    neutral_gray.jpg          # Synthetic test input
    saturated_primaries.jpg   # Synthetic test input
    warm_skin.jpg             # Synthetic test input

packages/processor/
  tests/
    visual_regression.rs      # Rust visual regression tests
    baselines/                # Git LFS — Rust PNG baselines
    fixtures/
      test.jpg                # Existing
      multicolor.jpg          # Existing

packages/core/
  test/
    visual-regression.test.ts # TS core visual regression tests
    baselines/                # Git LFS — TS core PNG baselines

plugins/photoshop/
  src/
    test-harness.js           # Test mode bridge handlers (strippable)

plugins/lightroom/
  chromascope.lrdevplugin/
    utils.lua                 # Extracted pure-logic functions (testable)

scripts/
  visual-report.js            # HTML report generator

test-results/                 # gitignored
  visual-report.html
  rust-visual-results.json
  core-visual-results.json
  photoshop-smoke.json
  photoshop-visual.json
  lightroom-smoke.json
```

---

## Dependencies

**New dev dependencies:**
- `pixelmatch` — PNG pixel comparison (zero dependencies, ~5KB)
- `pngjs` — PNG encode/decode for Node.js (used by pixelmatch and report generator)
- `playwright` — headless browser for TS core visual regression (pinned version)

**System requirements for full test:release:**
- macOS with Photoshop installed (for Layers 2–3 PS tests)
- Lua 5.4 interpreter (for LR Lua unit tests; `brew install lua`)
- Git LFS (`brew install git-lfs && git lfs install`)

**CI requirements (Layer 1 Rust only):**
- Git LFS enabled on the runner (standard for GitHub Actions)
- No additional system dependencies beyond existing Rust toolchain

---

## Threshold Summary

| Test | Metric | Threshold | Rationale |
|------|--------|-----------|-----------|
| Rust processor visual | RMSE (0–255) | > 0.5 fails | Deterministic renderer, zero natural jitter |
| TS core visual | pixelmatch diff pixels | > 0.1% fails | Anti-aliasing tolerance needed for Chromium |
| PS vs Rust baselines | RMSE (0–255) | > 5.0 fails | Independent implementations, loose match |
| LR pipeline vs Rust baselines | Exact match | > 0.0 fails | Same binary, same input, must be identical |
