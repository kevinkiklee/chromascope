# CLAUDE.md

## Process

- After any fix or feature, run `npm run build:plugins` automatically.
- Before changing the Lightroom plugin, read `docs/reference/lrc-sdk-research.md` (no WebView, no canvas, no direct pixel access, `f:picture` for image display, `LrTasks.execute` for shell commands, cooperative async via `LrTasks.startAsyncTask`).
- Before changing the Photoshop plugin, read `docs/reference/uxp-api-reference.md` (limited canvas API -- no `drawImage`/`getImageData`/`putImageData`/`toDataURL`/`toBlob`, no CSS Grid/transitions/transforms, `<select>` requires explicit `value` on `<option>`, use Spectrum UXP `<sp-*>` components, `imaging.encodeImageData()` with base64 for `<img>`, `executeAsModal` required for imaging calls, panel `show` fires only once).

## Project Overview

Chromascope is an open-source color analysis tool for Adobe Photoshop and Lightroom Classic. It renders chrominance vectorscope plots with visualization modes and color harmony overlays.

## Monorepo Layout

```
packages/core/        TypeScript core library (vectorscope math, rendering, UI)
packages/processor/   Rust CLI binary (image decode + vectorscope render)
plugins/photoshop/    Photoshop UXP panel plugin (JavaScript)
plugins/lightroom/    Lightroom Classic plugin (Lua + Rust binary)
web/                  Static marketing site (Next.js 16, Tailwind CSS 4)
scripts/              Build and setup automation
```

Managed with Turborepo. Workspaces: `packages/*`, `plugins/*`, `web`.

## Key Commands

```sh
npx turbo build          # Build all packages
npx turbo test           # Run all tests
npx turbo dev            # Start dev servers
npm run build:plugins    # Build core + processor + assemble both plugins

cd packages/core
npm run dev              # Vite dev server
npm run test             # Vitest
npm run test:watch       # Vitest in watch mode

cd packages/processor
cargo build --release
cargo test

cd web
npm run dev              # Next.js + Turbopack at localhost:3000
```

## Architecture

### Core + Photoshop

- Core bundles to a single HTML file via `vite-plugin-singlefile` for embedding in the Photoshop UXP WebView.
- Host-plugin communication uses a typed message protocol in `packages/core/src/protocol.ts` (PixelsMessage, SettingsMessage, EditMessage).
- Density renderers implement the `DensityRenderer` interface in `packages/core/src/types.ts`.

### Lightroom + Rust Renderer

- Lightroom can't embed WebViews or read pixels from Lua.
- The Rust `processor` binary has two subcommands:
  - `processor decode` -- Decodes JPEG/TIFF to raw RGB bytes
  - `processor render` -- Renders a vectorscope JPEG from raw RGB with configurable density mode (`--density scatter|heatmap|bloom`), harmony overlay, and skin tone line
- `ImagePipeline.lua` exports a thumbnail, calls `processor decode`, then `processor render`, and displays the resulting JPEG via `f:picture`.
- Updates are driven by `LrDevelopController.addAdjustmentChangeObserver` + a fallback poll loop.
- A busy-guard with coalescing prevents overlapping renders (max 1 queued).
- Frame alternation (writing to `scope_0.jpg` / `scope_1.jpg`) forces `f:picture` to reload on each update. **Do NOT revert to a single-path nil-toggle** -- this causes unbounded memory growth in Lightroom (the original cause of the 40GB memory leak).
- LrC's Lua sandbox does not expose `collectgarbage` -- do not call it.

### Memory Leak Prevention (Lightroom)

The Lightroom plugin runs for hours inside a long-lived process. Every allocation pattern that grows unboundedly will eventually crash the host. Follow these rules strictly:

1. **Frame alternation is mandatory.** `f:picture` must always receive a *different* file path on each update. Writing to the same path and toggling `imagePath = nil -> same_path` causes Lightroom to cache every version internally without releasing. This was the root cause of a 40GB memory leak. Use `nextScopePath()` to alternate between `scope_0.jpg` and `scope_1.jpg`.

2. **Guard `requestJpegThumbnail` callbacks.** The SDK may call the callback multiple times. After the first callback sets `done = true`, subsequent callbacks must `return` immediately. Always nil out `jpegData` after writing.

3. **Debounce async task creation.** Every `LrTasks.startAsyncTask` creates a Lua coroutine. Without debouncing (version counter + sleep + stale check), hundreds of coroutines accumulate. Use the `_settleVersion` / `_adjustVersion` pattern.

4. **Never accumulate data in module-level tables.** No appending to arrays, no history logs, no caching previous results. The only module-level state allowed is fixed-size: busy flag, frame index, pending flag, settings hash.

5. **Clean up temp files on dialog open.** `ImagePipeline.cleanup()` removes stale files from previous sessions. If you add new temp files, add them to the cleanup list.

6. **`collectgarbage` is unavailable.** LrC's Lua sandbox blocks it. Rely on the patterns above to minimize GC pressure.

## Build Dependencies

```
packages/core   -->  plugins/photoshop (copies core build output)
                     plugins/lightroom (copies core HTML + processor binary)
packages/processor -->  plugins/lightroom (binary copied to bin/<platform>/)
web             (independent)
```

`npm run build:plugins` handles the full pipeline: core build, Rust compile, Photoshop build, and Lightroom assembly.

## Website (`web/`)

- **Static HTML** -- no build step, no Node.js dependencies
- **Styling**: Tailwind CSS via CDN + custom CSS in `web/css/styles.css`
- **Pages**: `index.html`, `features/`, `download/`, `docs/`
- Scroll animations via `web/js/scroll-reveal.js` (IntersectionObserver)

## Code Conventions

- TypeScript strict mode across all packages
- Vitest for core library tests
- Rust integration tests via `cargo test --release`
- Base tsconfig in `tsconfig.base.json`, extended per package
- Vite 6 for core library bundling
- `vite-plugin-singlefile` produces a self-contained HTML for WebView embedding

## Deployment

- **Website**: GitHub Pages -- just copies `web/` directory, no build needed
- **Workflow**: `.github/workflows/deploy-pages.yml`
- Triggers on push to `main` when `web/` changes
