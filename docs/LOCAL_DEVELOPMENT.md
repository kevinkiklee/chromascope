# Local Development Guide

How to set up, run, and test Chromascope locally.

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| Rust toolchain | stable | `rustc --version` |
| Cargo | stable | `cargo --version` |
| Adobe Photoshop | 2024+ (UXP) | Optional -- only for plugin testing |
| Adobe Lightroom Classic | 13+ | Optional -- only for plugin testing |

## Initial Setup

```sh
# 1. Clone and install
git clone <repo-url> && cd chromascope
npm install

# 2. Build everything once (core must build before plugins)
npx turbo build

# 3. Run all tests to verify
npx turbo test
```

## Environment Variables

The web app (`web`) requires secrets in `web/.env.local`:

```sh
# Neon Postgres
DATABASE_URL="postgres://..."

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

If you have a linked Vercel project, pull env vars directly:

```sh
cd web
vercel env pull .env.local
```

## Package-by-Package Workflows

### Core Library (`packages/core`)

The core library is the vectorscope engine -- math, rendering, and UI controls. It bundles to a single HTML file via `vite-plugin-singlefile` for embedding in plugin WebViews.

```sh
cd packages/core

npm run dev          # Vite dev server with hot reload
npm run build        # Production build -> build/
npm run test         # Vitest (single run)
npm run test:watch   # Vitest in watch mode
```

**Dev server**: Opens `src/index.html` -- a standalone harness for testing the vectorscope without a host plugin. The harness at `dev/harness.html` provides additional testing scenarios.

**Key files**:
- `src/main.ts` -- Entry point
- `src/chromascope.ts` -- Core vectorscope implementation
- `src/types.ts` -- `ColorSpaceMapper` and `DensityRenderer` interfaces
- `src/protocol.ts` -- Message protocol types (`PixelsMessage`, `SettingsMessage`, `EditMessage`)
- `src/ui/controls.ts` -- UI control rendering
- `test/chromascope.test.ts` -- Unit tests

**Build dependency**: Plugins depend on the built core library. After modifying core, rebuild before testing plugins.

### Processor Binary (`packages/processor`)

Rust CLI that decodes images and renders vectorscopes. Used by the Lightroom plugin (which can't read pixels or draw from Lua). Supports configurable color spaces (YCbCr, CIE LUV, HSL), density modes (scatter, heatmap, bloom), and harmony overlays.

```sh
cd packages/processor

cargo build             # Debug build
cargo build --release   # Optimized build (for distribution)
cargo test              # Run Rust tests
```

The release binary goes to `target/release/processor`. For Lightroom integration, copy it to the appropriate platform directory:

```
plugins/lightroom/chromascope.lrdevplugin/bin/
  macos-arm64/
  macos-x64/
  win-x64/
```

### Photoshop Plugin (`plugins/photoshop`)

UXP panel plugin. Communicates with the core WebView via the message protocol.

```sh
cd plugins/photoshop

npm run build         # One-time build
npm run dev           # Watch mode (rebuilds on change)
```

**Testing in Photoshop**:

1. Build the core library first: `cd packages/core && npm run build`
2. Build the plugin: `cd plugins/photoshop && npm run build`
3. In Photoshop, go to **Plugins > Development > Load Plugin...**
4. Select `plugins/photoshop/manifest.json`
5. The panel appears under **Plugins > Chromascope**

**Key files**:
- `manifest.json` -- UXP plugin manifest
- `src/main.js` -- Plugin entry point, batchPlay calls
- `src/edits.js` -- Edit bridge (applies corrections back to Photoshop)
- `index.html` -- Plugin panel HTML (embeds core build)
- `core/index.html` -- Built core library (copied during build)

### Lightroom Plugin (`plugins/lightroom`)

Lua plugin for Lightroom Classic. Uses the processor binary to read pixel data.

**Installing for development**:

1. Build the processor binary: `cd packages/processor && cargo build --release`
2. Copy the binary to the plugin's `bin/` directory for your platform
3. Build the core library: `cd packages/core && npm run build`
4. In Lightroom, go to **File > Plug-in Manager > Add**
5. Select the `plugins/lightroom/chromascope.lrdevplugin` directory

**Key files**:
- `Info.lua` -- Plugin metadata and menu registration
- `ShowChromaScope.lua` -- Main dialog launcher
- `ChromaScopeDialog.lua` -- Floating dialog with vectorscope, controls (color space, density, harmony, rotation, size)
- `ImagePipeline.lua` -- Thumbnail export, processor binary invocation, frame alternation
- `EditBridge.lua` -- Maps edit commands to `LrDevelopController` calls
- `License.lua` -- License key validation

**Note**: The `.lrdevplugin` extension tells Lightroom this is a development plugin (reloads on each launch). Rename to `.lrplugin` for distribution.

### Web App (`web`)

Next.js 16 marketing site with licensing API and Stripe integration.

```sh
cd web

npm run dev           # Dev server at http://localhost:3000
npm run build         # Production build
npm run start         # Run production build
npm run lint          # ESLint
```

**Key routes**:
- `/` -- Landing page
- `/features` -- Feature showcase
- `/pricing` -- Pricing tiers
- `/download` -- Download page
- `/account` -- License management
- `/docs` -- Documentation
- `/api/stripe/checkout` -- Stripe checkout session
- `/api/ai/natural-language` -- AI color adjustment endpoint

## Running Everything at Once

From the repo root:

```sh
npx turbo dev
```

This starts all `dev` scripts in parallel:
- Core library Vite dev server
- Photoshop plugin watch mode
- Web app Next.js dev server at `localhost:3000`

Turborepo handles dependency ordering -- core builds before plugins.

## Build Pipeline

```
packages/core (build)
    |
    +-- plugins/photoshop (build)    # copies core build output
    |
    +-- plugins/lightroom            # manual: copy core + processor binary
    |
    +-- web (build)             # independent, no core dependency

packages/processor (cargo build)
    |
    +-- plugins/lightroom            # manual: copy binary to bin/
```

Run the full pipeline:

```sh
npx turbo build                      # TypeScript packages
cd packages/processor && cargo build --release   # Rust binary (separate)
```

## Testing

```sh
# All TypeScript tests
npx turbo test

# Core library only
cd packages/core && npm run test

# Rust processor tests
cd packages/processor && cargo test

# Watch mode (core)
cd packages/core && npm run test:watch
```

## Common Tasks

### Adding a new color space

1. Implement `ColorSpaceMapper` interface in `packages/core/src/types.ts`
2. Register in `packages/core/src/main.ts`
3. Add tests in `packages/core/test/`
4. Run `npm run test` to verify

### Adding a new density renderer

1. Implement `DensityRenderer` interface in `packages/core/src/types.ts`
2. Register in `packages/core/src/main.ts`
3. Add tests and verify

### Updating the core for plugins

1. Make changes in `packages/core/`
2. Run `npx turbo build` from repo root
3. Plugin builds automatically copy the new core output
4. Reload plugin in Photoshop/Lightroom to test

### Testing Stripe webhooks locally

```sh
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret from the CLI output into `web/.env.local` as `STRIPE_WEBHOOK_SECRET`.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Module not found` in plugins | Rebuild core first: `cd packages/core && npm run build` |
| Processor binary not found (Lightroom) | Copy release binary to the correct `bin/<platform>/` directory |
| Stale core in Photoshop | Rebuild core, rebuild plugin, then reload in Photoshop |
| Stripe webhook errors locally | Ensure `stripe listen` is running and secret is in `.env.local` |
| Vite HMR not working | Check port conflicts; default is 5173 for core dev server |
| `turbo` not found | Run `npm install` from repo root |
