# Chromascope -- Initial Setup Guide

## Prerequisites

| Tool | Version | Required | Install |
|------|---------|----------|---------|
| Node.js | 18+ | Yes | [nodejs.org](https://nodejs.org) or `nvm install 18` |
| npm | 9+ (ships with Node 18+) | Yes | Bundled with Node.js |
| Rust / Cargo | stable | Only for `packages/processor` | [rustup.rs](https://rustup.rs) |
| Turbo | 2+ | Auto-installed via npm | `npx turbo` |

## Quick Start (automated)

Run the setup script from the repo root:

```sh
./scripts/setup.sh
```

This will:

1. Verify Node.js and npm are installed (warns if Rust is missing).
2. Run `npm install` for all workspaces.
3. Build every package via `npx turbo build`.
4. Build the Rust processor binary in release mode (if Cargo is available).
5. Run all tests via `npx turbo test`.
6. Verify the build succeeded.

After the script finishes, start developing.

## Manual Setup

If you prefer to set things up step by step:

### 1. Clone and install dependencies

```sh
git clone <repo-url> chromascope
cd chromascope
npm install
```

This installs dependencies for every workspace (`packages/*`, `plugins/*`) in one go.

### 2. Build all packages

```sh
npx turbo build
```

Turborepo will build in dependency order:

- `packages/core` -- TypeScript core library (outputs a single HTML file via Vite)
- `packages/processor` -- Rust binary (`cargo build`; skipped if Cargo is missing)
- `plugins/photoshop` -- Photoshop UXP plugin (copies core build into `core/`)

### 3. Build the Rust processor binary (Lightroom only)

Skip this if you're only working on the core library or web app.

```sh
cd packages/processor
cargo build --release
```

The binary lands at `packages/processor/target/release/processor`. To copy it into the Lightroom plugin for your platform:

```sh
# macOS ARM (Apple Silicon)
npm run copy:macos-arm64

# macOS Intel
npm run copy:macos-x64

# Windows
npm run copy:win-x64
```

### 4. Run tests

```sh
npx turbo test
```

This runs Vitest for `packages/core` and `cargo test` for `packages/processor`.

## Development

### Start everything

```sh
npx turbo dev
```

This launches dev servers for all packages in parallel (Vite for core, watch mode for plugins).

### Work on a single package

```sh
# Core library -- Vite dev server with hot reload
cd packages/core
npm run dev

# Photoshop plugin -- watch mode
cd plugins/photoshop
npm run dev
```

### Core library test watcher

```sh
cd packages/core
npm run test:watch
```

## Monorepo Structure

```
chromascope/
  packages/
    core/          @chromascope/core    -- vectorscope math, rendering, UI
    processor/     @chromascope/processor -- Rust image processor
  plugins/
    photoshop/     @chromascope/photoshop -- UXP panel plugin
    lightroom/     chromascope.lrdevplugin -- Lua plugin + embedded binary
  web/             Static marketing site + documentation
  turbo.json                           -- Turborepo task config
  tsconfig.base.json                   -- shared TypeScript config (strict)
  package.json                         -- workspace root
```

### Dependency graph

```
packages/core  <──  plugins/photoshop  (embeds built HTML in WebView)
                <──  plugins/lightroom  (embeds built HTML in WebView)

packages/processor <── plugins/lightroom  (calls binary at runtime for pixel data)

web             (standalone -- no internal dependencies)
```

## Troubleshooting

**`npm install` fails with workspace errors**
Make sure you're on npm 9+ (`npm -v`). Older npm versions don't handle workspaces well.

**Turbo build fails on `packages/processor`**
Install Rust via [rustup.rs](https://rustup.rs). If you don't need the processor binary, you can build other packages individually: `npx turbo build --filter=@chromascope/core`.

**Photoshop plugin doesn't show updated core**
Rebuild the core library first (`cd packages/core && npm run build`), then rebuild the Photoshop plugin. The plugin build copies the core's single-file HTML output.
