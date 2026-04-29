# CLAUDE.md

## Process

- After any fix or feature, run `npm run build:plugins` automatically.
- Before changing the Lightroom plugin, read `docs/reference/lrc-sdk-research.md`.
- Before changing the Photoshop plugin, read `docs/reference/uxp-api-reference.md`.

## Project Overview

Chromascope is an open-source chrominance vectorscope for Adobe Photoshop and Lightroom Classic (macOS and Windows). It plots pixel color on a circular graph with density visualizations and harmony overlays.

## Monorepo Layout

```
packages/core/        TypeScript core (vectorscope math, rendering, UI controls)
packages/processor/   Rust CLI (image decode + vectorscope JPEG render)
plugins/photoshop/    Photoshop UXP panel plugin (JavaScript)
plugins/lightroom/    Lightroom Classic plugin (Lua + Rust binary)
web/                  Static marketing site (plain HTML, built Tailwind v4)
scripts/              Build and setup automation
```

Managed with Turborepo. Workspaces: `packages/*`, `plugins/*`.
The `web/` directory is plain static HTML (not an npm workspace).

## Key Commands

```sh
npx turbo build          # Build all packages
npx turbo test           # Run all tests
npm run build:plugins    # Build core + processor + assemble both plugins

# Core library
cd packages/core
npm run dev              # Vite dev server
npm run test             # Vitest

# Rust processor
cd packages/processor
cargo build --release
cargo test
```

## Architecture

### Core Library

- Bundles to a single HTML file via `vite-plugin-singlefile`.
- Embedded in the Photoshop UXP WebView and the Lightroom plugin's `core/` directory.
- Key interfaces in `packages/core/src/types.ts`: `ColorSpaceMapper`, `DensityRenderer`, `HarmonyConfig`.
- Host communication via typed messages in `packages/core/src/protocol.ts`.

### Photoshop Plugin

- UXP panel. Reads pixels via `executeAsModal` + imaging API.
- Software renderer (no canvas `drawImage`/`getImageData`). Renders to pixel buffer, encodes via `imaging.encodeImageData()` → base64 JPEG → `<img>`.
- `scripts/build.js` copies core HTML, extracts minified code, patches with UXP polyfills → `core/scope-bundle.js`.

### Lightroom Plugin

- Lua SDK. Cannot embed WebViews or read pixels directly.
- The Rust `processor` binary does the heavy lifting:
  - `processor pipeline` — JPEG/TIFF → vectorscope JPEG in a single process (decode + render combined, saves ~50-100ms vs two spawns). `--save-rgb` writes intermediate RGB for overlay-only re-renders.
  - `processor decode` — JPEG/TIFF → raw RGB bytes (128x128). Used standalone only for testing.
  - `processor render` — RGB → vectorscope JPEG with configurable density mode, harmony overlay, skin tone line. Used for overlay-only re-renders from cached RGB.
- `ImagePipeline.lua` orchestrates: export thumbnail → pipeline (decode+render in one shot) → display via `f:picture`.
- Change detection (two paths):
  - **Poll loop (150ms)** — hashes full `getDevelopSettings()` table with a recursive djb2 fingerprint. Detects changes in any develop panel (Basic, HSL, Masking, Calibration, Detail, Lens Corrections, Transform, Effects, Point Curve, etc.). Fallback for changes the observer doesn't fire on.
  - **`LrDevelopController.addAdjustmentChangeObserver`** — throttled renders during slider drag (~200ms cadence, ~2-3 fps), plus a correction render 300ms after the slider settles to ensure the thumbnail is fresh.
- Busy-guard with coalescing prevents overlapping renders (max 1 queued).
- Platform binaries at `bin/macos-arm64/`, `bin/macos-x64/`, `bin/win-x64/`.

### Memory Leak Prevention (Lightroom)

The plugin runs for hours in a long-lived process. These rules are non-negotiable:

1. **Frame alternation is mandatory.** `f:picture` must receive a *different* file path each update. Writing to the same path causes Lightroom to cache every version internally without releasing (root cause of a 40GB leak). Use `nextScopePath()` to alternate `scope_0.jpg` / `scope_1.jpg`.
2. **Guard `requestJpegThumbnail` callbacks.** After `done = true`, subsequent callbacks must return immediately. Nil out `jpegData` after writing.
3. **Throttle async tasks.** Use the `_adjustVersion` / `_adjustTaskRunning` pattern: one task at a time, observer ticks just bump a counter, the task loops until the counter stabilizes. Overlay changes use a similar `_settleVersion` / `_fastVersion` guard. Without throttling, slider drags create hundreds of coroutines.
4. **No unbounded module-level state.** Only fixed-size vars: busy flag, frame index, pending flag, settings hash.
5. **Clean up temp files on dialog open.** `ImagePipeline.cleanup()` handles this.
6. **`collectgarbage` is unavailable.** LrC sandbox blocks it.

## Build Pipeline

```
packages/core    →  plugins/photoshop  (copies core HTML, patches for UXP)
                 →  plugins/lightroom  (copies core HTML)
packages/processor →  plugins/lightroom  (copies binary to bin/<platform>/)
```

`npm run build:plugins` runs the full pipeline: core build → Rust compile (native + cross-compile for macOS x64 and Windows x64 via `cross`) → Photoshop build → Lightroom assembly.

Cross-compilation requires Docker (for Windows via `cross`) and `x86_64-apple-darwin` rustup target (for macOS x64).

## Website (`web/`)

- Plain static HTML — no JS framework, deployed via `vercel.json` from `web/`
- Tailwind CSS v4 — `web/css/input.css` source, built to `web/css/tailwind.css`. Custom design tokens in `web/css/styles.css`
- Pages: `index.html`, `download/`, `docs/`, `guides/`, `404.html`
- Scroll animations via `web/js/scroll-reveal.js` (IntersectionObserver)
- Accessibility: skip-to-main link, visible :focus-visible ring, `prefers-reduced-motion` respected

## User experience hardening rules (core + plugins)

1. **Lifecycle**: every event listener / timer / inserted DOM node added in a panel's init **must** have a matching cleanup in `hide()` (Photoshop) or `onClose` (Lightroom). The Photoshop plugin uses a `cleanupFns` registry — add to it, don't fork.
2. **Protocol validation**: messages from the host go through `onHostMessage` (`packages/core/src/protocol.ts`). New message fields must be validated there before reaching the renderer.
3. **Hot loops**: per-pixel renderers (`renderers/*.ts`, plugin `rendering.js`) must hoist scope→canvas geometry (`cx`, `cy`, `maxR`) outside the loop. Don't allocate `{ px, py }` objects inside a 16k-pixel inner loop.
4. **Web copy edits**: must keep copyright `&copy; 2025–2026 Chromascope`, valid sitemap `lastmod`, and `aria-hidden="true"` on decorative emoji.

## Code Conventions

- TypeScript strict mode
- Vitest for core tests, `cargo test` for Rust tests
- Vite 6 + `vite-plugin-singlefile` for core bundling
- Base tsconfig in `tsconfig.base.json`, extended per package

## CI/CD

- **CI**: `.github/workflows/ci.yml` — core TypeScript build+test and Rust build+test on push to `main`
- **Website**: `.github/workflows/deploy-pages.yml` — copies `web/` to GitHub Pages on push to `main`
- **Release**: `.github/workflows/release.yml` — builds macOS + Windows plugins on `v*` tag, creates GitHub Release with ZIP assets
