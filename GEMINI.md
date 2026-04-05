# Chromascope

Real-time chrominance vectorscope for Adobe Photoshop and Lightroom Classic. It maps pixel data onto a circular graph with density visualizations (scatter, bloom) and harmony overlays.

## Project Overview

Chromascope is a cross-platform (macOS/Windows) tool that provides high-performance color analysis within professional photo editing workflows. It is built as a monorepo containing a shared TypeScript engine, a high-performance Rust image processor, and native plugins for Adobe hosts.

### Architecture & Tech Stack

- **Monorepo**: Managed with [Turborepo](https://turbo.build/).
- **Core Engine (`packages/core`)**: TypeScript library for vectorscope math, Canvas 2D rendering, and UI controls. Bundles to a single HTML file via Vite + `vite-plugin-singlefile`.
- **Image Processor (`packages/processor`)**: Rust CLI tool that decodes images (JPEG/TIFF) and renders vectorscope frames as JPEGs. Used primarily by the Lightroom plugin to bypass SDK limitations.
    - `processor decode`: Decodes an image to raw RGB bytes (`--input`, `--output`, `--width`, `--height`).
    - `processor render`: Renders a vectorscope JPEG from raw RGB data. Supports `--density` (scatter, bloom, heatmap), `--scheme` (harmony overlays), `--rotation`, and `--color-space` (hsl, ycbcr, cieluv).
- **Photoshop Plugin (`plugins/photoshop`)**: Adobe UXP panel. Reads pixels via the Imaging API and renders the vectorscope in a WebView using the Core library.
- **Lightroom Plugin (`plugins/lightroom`)**: Lua-based plugin. Orchestrates the Rust `processor` binary to generate vectorscope frames, which are displayed using `f:picture`.
- **Web (`web/`)**: Static marketing and documentation site using plain HTML and Tailwind CSS (via CDN).

## Building and Running

### Prerequisites
- **Node.js**: 18+ (with npm 9+)
- **Rust**: Stable toolchain (required for the Lightroom processor)
- **Turbo**: `npx turbo` (auto-installed via devDependencies)

### Key Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies for all workspaces |
| `./scripts/setup.sh` | Automated setup: install, build, and test everything |
| `npx turbo build` | Build all packages in dependency order |
| `npx turbo dev` | Start development servers for all packages |
| `npx turbo test` | Run all tests (Vitest for TS, Cargo for Rust) |
| `npm run build:plugins` | Full pipeline: build Core + Processor + assemble both plugins |
| `cd packages/core && npm run dev` | Hot-reloading Vite dev server for the core library |

## Development Conventions

### General
- **TypeScript**: Strict mode is enabled. Use shared configurations in `tsconfig.base.json`.
- **Testing**: Every feature or bug fix must include tests. Use Vitest for TypeScript and `cargo test` for Rust.
- **Formatting**: Adhere to existing patterns (Prettier/ESLint for TS, `rustfmt` for Rust).

### Lightroom-Specific (CRITICAL)
The Lightroom plugin runs in a long-lived process where memory leaks are a major risk. Follow these rules strictly:
1. **Frame Alternation**: `f:picture` must alternate between two file paths (e.g., `scope_0.jpg` and `scope_1.jpg`) to force Lightroom to clear its internal image cache.
2. **Debounce Async Tasks**: Always use the `_settleVersion` / `_adjustVersion` pattern to prevent coroutine explosions during slider drags.
3. **Guard Callbacks**: Ensure `requestJpegThumbnail` callbacks return immediately if the task is already marked as done.
4. **No module-level state**: Avoid unbounded state; use fixed-size variables for flags and hashes.

### Photoshop-Specific
- **Imaging API**: Use `executeAsModal` when reading pixel data.
- **WebView Performance**: The vectorscope runs in a UXP WebView. Keep the message protocol (`packages/core/src/protocol.ts`) lean to ensure real-time updates.

## Project Structure

```
.
├── packages/
│   ├── core/           # TS Vectorscope engine (math, rendering, UI)
│   └── processor/      # Rust CLI (image decode + vectorscope render)
├── plugins/
│   ├── photoshop/      # UXP panel (JavaScript + Core bundle)
│   └── lightroom/      # Lua plugin + Rust binary + Core bundle
├── web/                # Static marketing site & docs (No build step)
├── docs/               # Technical specs and research
└── scripts/            # Build and automation scripts
```
