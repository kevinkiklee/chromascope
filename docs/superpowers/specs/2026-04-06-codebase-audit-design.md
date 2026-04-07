# Codebase Audit — Improvement Design Spec

**Date:** 2026-04-06
**Scope:** All packages, plugins, CI/CD, DX, and website

Comprehensive improvements organized into 5 independently-shippable phases, ordered by impact.

---

## Phase 1: Reliability & Robustness

### 1.1 Restructure Core Build for Dual Output

**Problem:** The Photoshop build script (`plugins/photoshop/scripts/build.js`) regex-matches minified Vite output to extract and patch JavaScript. Any change in Vite's minification breaks the build silently.

**Solution:** Add a Vite library mode configuration that emits a standalone JS module alongside the existing single-HTML build.

- Create `packages/core/vite.config.lib.ts` — library mode build targeting UXP compatibility (no ES modules, IIFE format, no CSS injection polyfills)
- Add `build:lib` script to `packages/core/package.json`
- Core exports: `createChromascope()`, `createControls()`, rendering functions, protocol handler
- The PS build script imports the library bundle directly — no regex extraction needed
- Existing `vite.config.ts` (single-HTML) unchanged for dev server and Lightroom

**Files changed:**
- `packages/core/vite.config.lib.ts` (new)
- `packages/core/src/lib.ts` (new — library entry point)
- `packages/core/package.json` (add build:lib script)
- `plugins/photoshop/scripts/build.js` (rewrite to use library bundle)
- `scripts/build-plugins.sh` (add core build:lib step)

### 1.2 Lightroom Shell Injection Prevention

**Problem:** `appendOverlayFlags()` in `ImagePipeline.lua` builds shell commands via string concatenation with user-controlled values.

**Solution:** Add whitelist validation tables.

```lua
local VALID_SCHEMES = { complementary=true, splitComplementary=true, triadic=true, tetradic=true, analogous=true }
local VALID_COLORS = { red=true, orange=true, yellow=true, green=true, cyan=true, blue=true }
local VALID_DENSITY = { scatter=true, bloom=true, heatmap=true }
```

Validate against whitelists before building command strings. Invalid values silently use defaults.

**Files changed:**
- `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`

### 1.3 Lightroom Binary Execution Hardening

**Problem:** Binary execution has no crash recovery, missing binaries cause silent failures, `requestJpegThumbnail` can hang forever.

**Solution:**
- Check `LrFileUtils.exists(binary())` on first render call, cache result, show `LrDialogs.message()` if missing
- Add exit code checks to `refreshOverlayFast()` and `refreshOverlayFull()`, set status text on failure
- Add 10-second timeout to the `requestJpegThumbnail` cooperative wait loop
- Wrap `catalog:getTargetPhoto()`, `photo:getDevelopSettings()`, `photo:requestJpegThumbnail()` in `LrFunctionContext.pcallWithContext` or Lua `pcall`

**Files changed:**
- `plugins/lightroom/chromascope.lrdevplugin/ImagePipeline.lua`
- `plugins/lightroom/chromascope.lrdevplugin/ChromaScopeDialog.lua`

### 1.4 Core Input Validation

**Problem:** `setPixels()` doesn't validate data length. DOM elements accessed with non-null assertions. Protocol messages not validated.

**Solution:**
- `chromascope.ts`: validate `data.length >= width * height * 3` and `width > 0 && height > 0` in `setPixels()`, throw descriptive error on mismatch
- `main.ts`: replace `!` assertions with null checks and early returns with console warnings
- `protocol.ts`: validate message structure (type exists, required fields present, data length matches dimensions) before dispatching

**Files changed:**
- `packages/core/src/chromascope.ts`
- `packages/core/src/main.ts`
- `packages/core/src/protocol.ts`

### 1.5 Photoshop Error Handling Fixes

**Problem:** Promise rejection permanently breaks settings updates. ImageData leaks on error. Panel hide doesn't clean up state.

**Solution:**
- Wrap `renderScope()` call in settings handler with try/finally to always reset `settingsRendering` flag
- Add `imageData.dispose()` in catch/finally block in `displayScope()`
- On panel `hide()`: clear `settingsTimer`, null out `lastPixels` and `cachedBaseBuf`, reset `isRefreshing`/`settingsRendering` flags, call `events.stopListening()`
- Change `interactive: true` to `interactive: false` in `imaging.js`

**Files changed:**
- `plugins/photoshop/src/main.js`
- `plugins/photoshop/src/imaging.js`

### 1.6 Rust Checked Arithmetic & Validation

**Problem:** `width * height * 3` could overflow u32. Harmony scheme/density/color-space fall back silently on invalid input.

**Solution:**
- Use `checked_mul` chain for dimension calculation in `cmd_render()`, return descriptive error on overflow
- Validate `--scheme`, `--density`, `--color-space` values upfront with `clap::ValueEnum` derive or explicit match with error

**Files changed:**
- `packages/processor/src/main.rs`

---

## Phase 2: Testing & CI

### 2.1 Photoshop Plugin Test Suite

**Problem:** Zero test coverage. Bugs in rendering, state management, and lifecycle are invisible.

**Solution:** Create a Vitest test harness with UXP API mocks.

- Refactor `main.js` to extract testable functions into `src/rendering.js` (renderToBuffer, renderGraticule, mapHSLInline, applyHarmonyOverlay) without changing runtime behavior
- Create `src/__mocks__/uxp.js` with stubs for `app`, `imaging`, `action` APIs
- Test targets:
  - `renderToBuffer()`: scatter/bloom/heatmap with known RGB inputs, verify buffer size and non-zero content
  - `mapHSLInline()`: pure black, white, achromatic, saturated primaries, edge cases (delta < 0.001)
  - `renderGraticule()`: cache behavior, correct dimensions
  - `applyHarmonyOverlay()`: verify overlay doesn't corrupt base buffer
  - Settings lifecycle: `settingsRendering` flag resets on error
  - Panel lifecycle: cleanup runs on hide, no stale state on re-show

**Files changed:**
- `plugins/photoshop/src/rendering.js` (new — extracted from main.js)
- `plugins/photoshop/src/main.js` (imports from rendering.js)
- `plugins/photoshop/src/__mocks__/uxp.js` (new)
- `plugins/photoshop/src/__tests__/rendering.test.js` (new)
- `plugins/photoshop/package.json` (add vitest devDependency, test script)
- `plugins/photoshop/vitest.config.js` (new)

### 2.2 Linting Setup

**Problem:** No automated code style enforcement.

**Solution:**
- Add `eslint.config.js` at root — flat config with TypeScript plugin for `packages/core/`, plain JS rules for `plugins/photoshop/`
- Add `cargo clippy --all-targets -- -D warnings` to Rust CI step
- Add `lint` task to `turbo.json`
- Add root `lint` script to `package.json`

**Files changed:**
- `eslint.config.js` (new)
- `turbo.json`
- `package.json` (root)
- `.github/workflows/ci.yml`

### 2.3 CI Improvements

**Problem:** Windows CI build diverges from macOS. Missing Rust cache in CI. Release can trigger from any branch.

**Solution:**
- Unify CI: make `build-plugins.sh` handle Windows (detect OS, skip `cross` on Windows, use native cargo)
- Add `Swatinem/rust-cache@v2` to CI workflow
- Pin release runners to `macos-14` and `windows-2022`
- Add `if: github.ref_name == 'main'` guard to release workflow (or check that the tag's commit is on main)

**Files changed:**
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `scripts/build-plugins.sh`

### 2.4 Dependency Maintenance

**Problem:** No automated dependency updates.

**Solution:** Add `.github/dependabot.yml` with weekly schedule for npm and cargo ecosystems.

**Files changed:**
- `.github/dependabot.yml` (new)

---

## Phase 3: Architecture & Performance

### 3.1 Extract Shared Constants

**Problem:** Magic numbers scattered across 10+ files. `0.45` (radius factor), `Math.PI / 12` (harmony half-width), `123°` (skin tone angle), zone colors — all duplicated.

**Solution:** Create `packages/core/src/constants.ts`:

```typescript
export const RADIUS_FACTOR = 0.45;
export const HARMONY_HALF_WIDTH = Math.PI / 12;
export const SKIN_TONE_ANGLE_DEG = 123;
export const SKIN_TONE_ANGLE_RAD = (123 * Math.PI) / 180;
export const ZONE_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6"] as const;
```

Update all consumers to import from constants. Same for Rust: create `src/constants.rs`.

**Files changed:**
- `packages/core/src/constants.ts` (new)
- `packages/core/src/graticule.ts`
- `packages/core/src/interaction/hit-test.ts`
- `packages/core/src/overlays/harmony-renderer.ts`
- `packages/core/src/overlays/skin-tone-line.ts`
- `packages/core/src/overlays/harmony-zones.ts`
- `packages/core/src/overlays/fit-to-scheme.ts`
- `packages/processor/src/constants.rs` (new)
- `packages/processor/src/render.rs`

### 3.2 Deduplicate Angular Distance

**Problem:** `angularDistance()` defined identically in `harmony-zones.ts` and `fit-to-scheme.ts`.

**Solution:** Move to a shared `packages/core/src/math-utils.ts` module. Export `angularDistance()` and `normalizeAngle()`. Update both consumers.

**Files changed:**
- `packages/core/src/math-utils.ts` (new)
- `packages/core/src/overlays/harmony-zones.ts`
- `packages/core/src/overlays/fit-to-scheme.ts`

### 3.3 Core Rendering Performance

**Problem:** ResizeObserver triggers immediate redraws. Graticule re-renders every frame.

**Solution:**
- Debounce ResizeObserver callback with `requestAnimationFrame` in `main.ts`
- Cache graticule to an offscreen canvas in `graticule.ts` — only re-render when size changes. Return cached canvas for `drawImage()` compositing.

**Files changed:**
- `packages/core/src/main.ts`
- `packages/core/src/graticule.ts`

### 3.4 Refactor Chromascope Class

**Problem:** `chromascope.ts` handles settings, pixel processing, harmony, and render orchestration.

**Solution:** Extract `remapPoints()` into a standalone `mapPixels()` function in a new `packages/core/src/pixel-mapper.ts`. The Chromascope class becomes a thin coordinator that holds state and delegates to mapper + renderer.

**Files changed:**
- `packages/core/src/pixel-mapper.ts` (new)
- `packages/core/src/chromascope.ts`

### 3.5 Rust Module Split

**Problem:** `render.rs` is 639 lines combining color spaces, rendering modes, and drawing utilities.

**Solution:** Split into submodules:
- `src/render/mod.rs` — public API (`render_vectorscope`, `HarmonyConfig`)
- `src/render/colorspace.rs` — `map_ycbcr`, `map_cieluv`, `map_hsl`
- `src/render/modes.rs` — scatter, bloom, heatmap rendering
- `src/render/draw.rs` — line drawing, arcs, arrows, color ring, degree markers

Re-export public API from `mod.rs`. All existing tests continue to pass unchanged.

**Files changed:**
- `packages/processor/src/render.rs` → `packages/processor/src/render/mod.rs`
- `packages/processor/src/render/colorspace.rs` (new)
- `packages/processor/src/render/modes.rs` (new)
- `packages/processor/src/render/draw.rs` (new)

---

## Phase 4: DX & Automation

### 4.1 Version Bump Script

**Problem:** Releasing requires manually updating 6 files.

**Solution:** Create `scripts/bump-version.sh` that takes a semver argument and updates:
1. `packages/core/package.json`
2. `packages/processor/package.json`
3. `packages/processor/Cargo.toml`
4. `plugins/photoshop/package.json`
5. `plugins/photoshop/manifest.json`
6. `plugins/lightroom/chromascope.lrdevplugin/Info.lua`

Uses `sed` for JSON/TOML/Lua. Prints diff summary. Optionally commits with `chore: bump version to X.Y.Z`.

**Files changed:**
- `scripts/bump-version.sh` (new)
- `docs/CONTRIBUTING.md` (reference the script)

### 4.2 Turborepo Plugin Build Integration

**Problem:** Plugin builds bypass Turborepo — no caching, no dependency tracking.

**Solution:**
- Add `build:plugins` task to `turbo.json` with `dependsOn: ["@chromascope/core#build", "@chromascope/core#build:lib"]`
- Define proper inputs (source files) and outputs (plugin directories) for cache invalidation
- Root `build:plugins` script calls turbo instead of shell script directly

**Files changed:**
- `turbo.json`
- `package.json` (root)

### 4.3 Documentation Fixes

**Problem:** Version inconsistencies, missing API docs, references to CLAUDE.md in contributor docs.

**Solution:**
- Fix `LOCAL_DEVELOPMENT.md`: change Node 20+ to 18+ (match SETUP.md)
- Add `docs/reference/processor-cli.md` documenting all `processor` subcommands, flags, and examples
- Remove CLAUDE.md reference from `CONTRIBUTING.md` — replace with link to relevant docs
- Add `docs/reference/core-protocol.md` documenting the host↔core message protocol

**Files changed:**
- `docs/LOCAL_DEVELOPMENT.md`
- `docs/CONTRIBUTING.md`
- `docs/reference/processor-cli.md` (new)
- `docs/reference/core-protocol.md` (new)

### 4.4 Pre-commit Hook

**Problem:** No automated checks before commit.

**Solution:** Add a simple pre-commit hook via `scripts/install-hooks.sh` that runs:
- `npx turbo lint` (once ESLint is set up in Phase 2)
- `cargo clippy` in processor directory

Register in `scripts/setup.sh`. Not using husky/lint-staged to keep deps minimal.

**Files changed:**
- `scripts/install-hooks.sh` (new)
- `.githooks/pre-commit` (new)
- `scripts/setup.sh` (add hook installation step)

---

## Phase 5: Polish

### 5.1 Core Accessibility

**Problem:** Canvas has no ARIA attributes. Controls use abbreviations. No keyboard navigation.

**Solution:**
- Add `role="img"` and `aria-label` to scope canvas
- Add `title` attributes to harmony buttons with full names ("Complementary", "Split Complementary", etc.)
- Associate labels with inputs via `for`/`id` attributes in `controls.ts`
- Add `aria-label` to range sliders

**Files changed:**
- `packages/core/src/ui/controls.ts`
- `packages/core/src/main.ts` (canvas attributes)
- `packages/core/build/index.html` (if static attributes needed)

### 5.2 Dead Code Cleanup

**Problem:** `EditBridge.lua` is unused. Core HTML is copied to Lightroom plugin but never loaded.

**Solution:**
- Remove `EditBridge.lua` from plugin (or add a comment header marking it as reserved for future WebView integration — user's call)
- Stop copying core HTML to Lightroom plugin in `build-plugins.sh` unless/until WebView support is added
- Remove unused `core/` directory from Lightroom plugin assembly

**Files changed:**
- `plugins/lightroom/chromascope.lrdevplugin/EditBridge.lua` (remove or annotate)
- `scripts/build-plugins.sh`

### 5.3 Lightroom SDK Version

**Problem:** `LrSdkMinimumVersion = 15.0` is unnecessarily restrictive.

**Solution:** Lower to `11.0`. The plugin uses `requestJpegThumbnail` (SDK 6.0+), `addAdjustmentChangeObserver` (SDK 6.0+), and `LrTasks` (SDK 3.0+). Nothing requires SDK 15.

**Files changed:**
- `plugins/lightroom/chromascope.lrdevplugin/Info.lua`

### 5.4 Website Performance

**Problem:** Tailwind loaded via CDN adds latency.

**Solution:** Add a minimal build step: `npx @tailwindcss/cli -i web/css/input.css -o web/css/styles.css --minify`. Run in CI before deploy. Update deploy-pages workflow to run this step. Remove CDN script tag.

**Files changed:**
- `web/css/input.css` (new — Tailwind directives)
- `web/index.html` (remove CDN, link compiled CSS)
- `web/download/index.html` (same)
- `web/docs/index.html` (same)
- `.github/workflows/deploy-pages.yml` (add build step)
- `package.json` (root — add tailwindcss devDependency)

---

## Out of Scope

These were identified in the audit but excluded from this improvement cycle:
- **Heatmap sparse grid / WebGL** — performance optimization for a rendering mode that works fine at current image sizes
- **Photoshop async rendering** — would require significant UXP architecture changes for marginal gain at 300px scope size
- **Code signing for releases** — requires Apple Developer + Windows signing certificates, separate initiative
- **Linux target support** — Lightroom Classic is macOS/Windows only
- **i18n / localization** — English-only is fine for initial release
