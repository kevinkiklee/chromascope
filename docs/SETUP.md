# Chromascope -- Initial Setup Guide

## Prerequisites

| Tool | Version | Required | Install |
|------|---------|----------|---------|
| Node.js | 18+ | Yes | [nodejs.org](https://nodejs.org) or `nvm install 18` |
| npm | 9+ (ships with Node 18+) | Yes | Bundled with Node.js |
| Rust / Cargo | stable | Only for `packages/decode` | [rustup.rs](https://rustup.rs) |
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
4. Build the Rust decode binary in release mode (if Cargo is available).
5. Run all tests via `npx turbo test`.
6. Create `apps/web/.env.local` with placeholder keys if it doesn't exist.

After the script finishes, fill in your environment variables and start developing.

## Manual Setup

If you prefer to set things up step by step:

### 1. Clone and install dependencies

```sh
git clone <repo-url> chromascope
cd chromascope
npm install
```

This installs dependencies for every workspace (`packages/*`, `plugins/*`, `apps/*`) in one go.

### 2. Build all packages

```sh
npx turbo build
```

Turborepo will build in dependency order:

- `packages/core` -- TypeScript core library (outputs a single HTML file via Vite)
- `packages/decode` -- Rust binary (`cargo build`; skipped if Cargo is missing)
- `plugins/photoshop` -- Photoshop UXP plugin (copies core build into `core/`)
- `apps/web` -- Next.js production build

### 3. Build the Rust decode binary (Lightroom only)

Skip this if you're only working on the core library or web app.

```sh
cd packages/decode
cargo build --release
```

The binary lands at `packages/decode/target/release/decode`. To copy it into the Lightroom plugin for your platform:

```sh
# macOS ARM (Apple Silicon)
npm run copy:macos-arm64

# macOS Intel
npm run copy:macos-x64

# Windows
npm run copy:win-x64
```

### 4. Configure the web app

Create `apps/web/.env.local` from the example file:

```sh
cp apps/web/.env.example apps/web/.env.local
```

Fill in the values:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | Neon Postgres connection string | [Neon console](https://console.neon.tech) |
| `STRIPE_SECRET_KEY` | Stripe secret key | [Stripe dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe dashboard > Webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Stripe dashboard > API keys |

### 5. Run tests

```sh
npx turbo test
```

This runs Vitest for `packages/core` and `cargo test` for `packages/decode`.

## Development

### Start everything

```sh
npx turbo dev
```

This launches dev servers for all packages in parallel (Vite for core, Next.js + Turbopack for web).

### Work on a single package

```sh
# Core library -- Vite dev server with hot reload
cd packages/core
npm run dev

# Web app -- Next.js + Turbopack at http://localhost:3000
cd apps/web
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
    decode/        @chromascope/decode  -- Rust JPEG/TIFF decoder
  plugins/
    photoshop/     @chromascope/photoshop -- UXP panel plugin
    lightroom/     chromascope.lrdevplugin -- Lua plugin + embedded binary
  apps/
    web/           @chromascope/web     -- Next.js landing page, licensing, Stripe
  turbo.json                           -- Turborepo task config
  tsconfig.base.json                   -- shared TypeScript config (strict)
  package.json                         -- workspace root
```

### Dependency graph

```
packages/core  <──  plugins/photoshop  (embeds built HTML in WebView)
                <──  plugins/lightroom  (embeds built HTML in WebView)

packages/decode  <──  plugins/lightroom  (calls binary at runtime for pixel data)

apps/web             (standalone -- no internal dependencies)
```

## Troubleshooting

**`npm install` fails with workspace errors**
Make sure you're on npm 9+ (`npm -v`). Older npm versions don't handle workspaces well.

**Turbo build fails on `packages/decode`**
Install Rust via [rustup.rs](https://rustup.rs). If you don't need the decode binary, you can build other packages individually: `npx turbo build --filter=@chromascope/core`.

**Web app crashes on startup**
Check that `apps/web/.env.local` exists and has valid values. The Stripe client throws immediately if `STRIPE_SECRET_KEY` is empty.

**Photoshop plugin doesn't show updated core**
Rebuild the core library first (`cd packages/core && npm run build`), then rebuild the Photoshop plugin. The plugin build copies the core's single-file HTML output.
