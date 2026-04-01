# CLAUDE.md

## Process

- After any fix or feature, run `npm run build:plugins` automatically.
- Before changing the Lightroom plugin, read `docs/reference/lrc-sdk-research.md`.
- Before changing the Photoshop plugin, read `docs/reference/uxp-api-reference.md`.

## Project Overview

Chromascope is an open-source chrominance vectorscope for Adobe Photoshop and Lightroom Classic (macOS and Windows). It plots pixel color on a circular graph with multiple color spaces, density visualizations, and harmony overlays.

## Monorepo Layout

```
packages/core/        TypeScript core (vectorscope math, rendering, UI controls)
packages/processor/   Rust CLI (image decode + vectorscope JPEG render)
plugins/photoshop/    Photoshop UXP panel plugin (JavaScript)
plugins/lightroom/    Lightroom Classic plugin (Lua + Rust binary)
web/                  Static marketing site (plain HTML, Tailwind CDN)
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
  - `processor decode` — JPEG/TIFF → raw RGB bytes (128x128)
  - `processor render` — RGB → vectorscope JPEG with configurable color space, density mode, harmony overlay, skin tone line
- `ImagePipeline.lua` orchestrates: export thumbnail → decode → render → display via `f:picture`.
- Updates via `LrDevelopController.addAdjustmentChangeObserver` + 1s poll fallback.
- Busy-guard with coalescing prevents overlapping renders (max 1 queued).
- Platform binaries at `bin/macos-arm64/`, `bin/macos-x64/`, `bin/win-x64/`.

### Memory Leak Prevention (Lightroom)

The plugin runs for hours in a long-lived process. These rules are non-negotiable:

1. **Frame alternation is mandatory.** `f:picture` must receive a *different* file path each update. Writing to the same path causes Lightroom to cache every version internally without releasing (root cause of a 40GB leak). Use `nextScopePath()` to alternate `scope_0.jpg` / `scope_1.jpg`.
2. **Guard `requestJpegThumbnail` callbacks.** After `done = true`, subsequent callbacks must return immediately. Nil out `jpegData` after writing.
3. **Debounce async tasks.** Use `_settleVersion` / `_adjustVersion` pattern. Without debouncing, slider drags create hundreds of coroutines.
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

- Plain static HTML — no build step, no npm dependencies
- Tailwind CSS via CDN + custom CSS in `web/css/styles.css`
- Pages: `index.html` (home + features), `download/`, `docs/`
- Scroll animations via `web/js/scroll-reveal.js` (IntersectionObserver)

## Code Conventions

- TypeScript strict mode
- Vitest for core tests, `cargo test` for Rust tests
- Vite 6 + `vite-plugin-singlefile` for core bundling
- Base tsconfig in `tsconfig.base.json`, extended per package

## CI/CD

- **CI**: `.github/workflows/ci.yml` — core TypeScript build+test and Rust build+test on push to `main`
- **Website**: `.github/workflows/deploy-pages.yml` — copies `web/` to GitHub Pages on push to `main`
- **Release**: `.github/workflows/release.yml` — builds macOS + Windows plugins on `v*` tag, creates GitHub Release with ZIP assets
