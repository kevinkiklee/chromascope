# CLAUDE.md

## Process

When you solve a bug or an issue, or build a feature, run `npm run build:plugins` automatically so that I don't have to rebuild it manually.

Before making changes to the Lightroom plugin, read `docs/reference/lrc-sdk-research.md` to understand the LrC SDK constraints (no WebView, no canvas, no direct pixel access, `f:picture` for image display, `LrTasks.execute` for shell commands, cooperative async via `LrTasks.startAsyncTask`).

Before making changes to the Photoshop plugin, read `docs/reference/uxp-api-reference.md` to understand UXP constraints (limited canvas API — no `drawImage`/`getImageData`/`putImageData`/`toDataURL`/`toBlob`, no CSS Grid/transitions/transforms, `<select>` requires explicit `value` on `<option>`, use Spectrum UXP `<sp-*>` components for native PS styling, `imaging.encodeImageData()` with base64 for rendering to `<img>`, `executeAsModal` required for imaging calls, panel `show` fires only once).

## Project Overview

Chromascope is a commercial color analysis tool for Adobe Photoshop and Lightroom Classic. It renders chrominance vectorscope plots with multiple color spaces, visualization modes, and color harmony overlays.

## Monorepo Layout

- `packages/core/` -- TypeScript core library (vectorscope math, rendering, UI controls)
- `packages/decode/` -- Rust CLI binary (image decoding + vectorscope rendering)
- `plugins/photoshop/` -- Photoshop UXP panel plugin (JavaScript)
- `plugins/lightroom/` -- Lightroom Classic plugin (Lua + Rust binary)
- `apps/web/` -- Next.js 16 app (marketing site, pricing, licensing API, Stripe webhooks)
- `scripts/` -- Setup, build, and deployment scripts

Managed with Turborepo. Workspaces: `packages/*`, `plugins/*`, `apps/*`.

## Key Commands

```sh
npx turbo build          # Build all packages
npx turbo test           # Run all tests
npx turbo dev            # Start dev servers
npm run build:plugins    # Build core + decode + assemble both plugins

# Core library
cd packages/core
npm run dev              # Vite dev server
npm run test             # Vitest
npm run test:watch       # Vitest in watch mode

# Rust decode binary
cd packages/decode
cargo build --release
cargo test

# Web app
cd apps/web
npm run dev              # Next.js + Turbopack at localhost:3000
npm run lint             # ESLint
```

## Architecture Notes

### Core + Photoshop

- The core library bundles to a single HTML file via `vite-plugin-singlefile` for embedding in the Photoshop UXP WebView.
- Host-plugin communication uses a typed message protocol defined in `packages/core/src/protocol.ts` (PixelsMessage, SettingsMessage, EditMessage).
- Color space mappers implement the `ColorSpaceMapper` interface in `packages/core/src/types.ts`.
- Density renderers implement the `DensityRenderer` interface in the same file.

### Lightroom + Rust Renderer

- Lightroom can't embed WebViews or read pixels from Lua.
- The Rust `decode` binary has two subcommands:
  - `decode decode` -- Decodes JPEG/TIFF to raw RGB bytes
  - `decode render` -- Renders a vectorscope JPEG from raw RGB with configurable color space (`--color-space ycbcr|cieluv|hsl`), density mode (`--density scatter|heatmap|bloom`), harmony overlay, and skin tone line
- `ImagePipeline.lua` exports a thumbnail, calls `decode decode`, then `decode render`, and displays the resulting JPEG via `f:picture`.
- Updates are driven by `LrDevelopController.addAdjustmentChangeObserver` + a fallback poll loop.
- A busy-guard with coalescing prevents overlapping renders (max 1 queued).
- Frame alternation (writing to `scope_0.jpg` / `scope_1.jpg`) forces `f:picture` to reload on each update. **Do NOT revert to a single-path nil-toggle** -- this causes unbounded memory growth in Lightroom (the original cause of the 40GB memory leak).
- LrC's Lua sandbox does not expose `collectgarbage` -- do not call it.

### Licensing

- License keys use format `CHRM-XXXX-XXXX-XXXX` with tiers: trial (14-day), pro, pro_ai.
- `validateLicense(key, machineId?)` -- machineId is optional for API-only validation.
- `tierFeatures()` returns `'ai'` for pro_ai tier (not `'ai_analysis'`).

## Build Dependencies

Core must build before plugins. The build order is:

```
packages/core   -->  plugins/photoshop (copies core build output)
                     plugins/lightroom (copies core HTML + decode binary)
packages/decode -->  plugins/lightroom (binary copied to bin/<platform>/)
apps/web             (independent, no core dependency)
```

`npm run build:plugins` handles the full pipeline: core build, Rust compile, Photoshop build, and Lightroom assembly (copies core HTML + decode binary).

## Web App (`apps/web`)

- **Framework**: Next.js 16 with App Router, Turbopack, React 19
- **Styling**: Tailwind CSS 4 (CSS-first config via `@theme` in globals.css)
- **Database**: Neon serverless Postgres (`@neondatabase/serverless`) -- lazy-initialized via Proxy
- **Payments**: Stripe (`stripe` package) -- lazy-initialized via `getStripe()`
- **AI**: Vercel AI SDK 6 (`ai` package) with AI Gateway
- **Design system**: "Chromatic Energy" -- dark mode, violet-to-indigo gradients, glass-effect cards, conic-gradient logo mark

### Environment Variables

Store in `apps/web/.env.local` (gitignored). Copy from `apps/web/.env.example` or run `vercel env pull`.

- `DATABASE_URL` -- Neon Postgres connection string
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` -- Stripe integration
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` -- Client-side Stripe key

### Key Routes

- `/api/stripe/checkout` -- Stripe checkout session creation
- `/api/stripe/webhook` -- Stripe webhook handler (license creation, subscription management)
- `/api/ai/natural-language` -- AI color adjustment endpoint
- `/api/license/validate` -- License validation
- `/api/license/trial` -- Trial license creation

## Code Conventions

- TypeScript strict mode across all packages
- Vitest for core library tests
- Rust integration tests via `cargo test --release` (4 tests)
- Base tsconfig in `tsconfig.base.json`, extended per package
- Vite 6 for core library bundling
- `vite-plugin-singlefile` produces a self-contained HTML for WebView embedding
- Stripe and Neon clients are lazy-initialized to avoid build-time crashes when env vars are missing

## Deployment

- **Platform**: Vercel (project: `iser/chromascope-website`)
- **Root directory**: `apps/web`
- **Framework**: Next.js (auto-detected)
- Env vars must be set in Vercel dashboard or via `vercel env add`
