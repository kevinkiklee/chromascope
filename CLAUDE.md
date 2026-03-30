# CLAUDE.md

## Project Overview

ChromaScope is a commercial color analysis tool for Adobe Photoshop and Lightroom Classic. It renders chrominance vectorscope plots with multiple color spaces, visualization modes, and color harmony overlays.

## Monorepo Layout

- `packages/core/` -- TypeScript core library (vectorscope math, rendering, UI controls)
- `packages/decode/` -- Rust CLI binary (image decoding to raw RGB bytes)
- `plugins/photoshop/` -- Photoshop UXP panel plugin (JavaScript)
- `plugins/lightroom/` -- Lightroom Classic plugin (Lua)
- `apps/web/` -- Next.js 16 app (landing page, pricing, licensing API, Stripe webhooks)

Managed with Turborepo. Workspaces: `packages/*`, `plugins/*`, `apps/*`.

## Key Commands

```sh
npx turbo build          # Build all packages
npx turbo test           # Run all tests
npx turbo dev            # Start dev servers

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

- The core library bundles to a single HTML file via `vite-plugin-singlefile` for embedding in plugin WebViews.
- Host-plugin communication uses a typed message protocol defined in `packages/core/src/protocol.ts` (PixelsMessage, SettingsMessage, EditMessage).
- Lightroom can't read pixels from Lua -- it exports a thumbnail, decodes via the Rust binary, and sends raw RGB to the WebView.
- Color space mappers implement the `ColorSpaceMapper` interface in `packages/core/src/types.ts`.
- Density renderers implement the `DensityRenderer` interface in the same file.
- License keys use format `CHRM-XXXX-XXXX-XXXX` with tiers: trial (14-day), pro, pro_ai.

## Build Dependencies

Core must build before plugins. The build order is:

```
packages/core  -->  plugins/photoshop (copies core build output)
                    plugins/lightroom (manual: copy core + decode binary)
packages/decode -->  plugins/lightroom (manual: copy binary to bin/<platform>/)
apps/web            (independent, no core dependency)
```

Turborepo handles TypeScript build ordering via `turbo.json`. Rust builds and Lightroom binary copies are manual steps.

## Web App (`apps/web`)

- **Framework**: Next.js 16 with App Router, Turbopack, React 19
- **Styling**: Tailwind CSS 4
- **Database**: Neon serverless Postgres (`@neondatabase/serverless`)
- **Payments**: Stripe (`stripe` package)
- **AI**: Vercel AI SDK 6 (`ai` package) with AI Gateway

### Environment Variables

Store in `apps/web/.env.local` (gitignored). Copy from `apps/web/.env.example` or run `vercel env pull`.

- `DATABASE_URL` -- Neon Postgres connection string
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` -- Stripe integration
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` -- Client-side Stripe key

### Key Routes

- `/api/stripe/checkout` -- Stripe checkout session creation
- `/api/ai/natural-language` -- AI color adjustment endpoint

## Code Conventions

- TypeScript strict mode across all packages
- Vitest for core library tests
- Rust tests via `cargo test` for decode package
- Base tsconfig in `tsconfig.base.json`, extended per package
- Vite 6 for core library bundling
- `vite-plugin-singlefile` produces a self-contained HTML for WebView embedding
