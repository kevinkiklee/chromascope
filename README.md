# Chromascope

A professional color analysis tool for Adobe Creative Suite. Visualizes chrominance distribution on a vectorscope plot for colorists, video editors, and color grading professionals.

## Features

- **Multiple color spaces** -- YCbCr (BT.601), CIE LUV, HSL
- **Visualization modes** -- Scatter plot, heatmap, bloom
- **Color harmony overlays** -- Complementary, split-complementary, triadic, tetradic, analogous
- **Skin tone reference line**
- **Interactive zone rotation** and fit-to-scheme color correction
- **AI-powered natural language color adjustments** (Pro+AI tier)
- **Plugin support** for Photoshop (UXP) and Lightroom Classic (Lua)

## Project Structure

```
chromascope/
  packages/
    core/        TypeScript library -- vectorscope math, rendering, UI
    decode/      Rust binary -- image decoding, RGB extraction, vectorscope rendering
  plugins/
    photoshop/   Photoshop UXP panel plugin
    lightroom/   Lightroom Classic plugin (Lua + Rust binary)
  apps/
    web/         Next.js marketing site, licensing API, Stripe webhooks
  docs/          Architecture docs and guides
  scripts/       Setup, build, and deployment scripts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo |
| Core | TypeScript, Vite 6, Vitest |
| Decode | Rust (image crate, clap) -- decode + render subcommands |
| Web | Next.js 16, React 19, Tailwind CSS 4, Turbopack |
| Database | Neon (serverless Postgres) |
| Payments | Stripe |
| AI | Vercel AI SDK 6, AI Gateway |
| Photoshop | Adobe UXP, batchPlay API |
| Lightroom | Lua, LrDevelopController, Rust-rendered vectorscope |

## Getting Started

```sh
./scripts/setup.sh    # Automated setup (recommended)
```

Or manually:

```sh
npm install
npx turbo build
npx turbo test
```

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions and [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for the full development workflow guide.

### Core library

```sh
cd packages/core
npm run dev    # Vite dev server with hot reload
npm run test   # Vitest
```

### Rust decode binary

```sh
cd packages/decode
cargo build --release
cargo test
```

### Web app

```sh
cp apps/web/.env.example apps/web/.env.local   # then fill in values
cd apps/web
npm run dev    # Next.js + Turbopack at localhost:3000
```

Required environment variables in `apps/web/.env.local`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `STRIPE_SECRET_KEY` | Stripe server-side key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client-side key |

If the project is linked to Vercel, run `vercel env pull apps/web/.env.local` to pull all variables automatically.

### Build all plugins

```sh
npm run build:plugins    # Builds core, decode binary, Photoshop plugin, assembles Lightroom plugin
```

## Architecture

### Photoshop

The core library bundles to a single HTML file (`vite-plugin-singlefile`) that embeds in the Photoshop UXP panel as a WebView. The plugin communicates with the core via a typed message protocol (`packages/core/src/protocol.ts`):

```
Photoshop Plugin (UXP)
  |-- PixelsMessage   -->  Core WebView (vectorscope rendering)
  |<-- EditMessage     --  Core WebView (apply color correction)
```

### Lightroom Classic

Lightroom's Lua SDK does not support embedded WebViews. Instead, the Rust `decode` binary handles both image decoding and vectorscope rendering:

```
Lightroom Plugin (Lua)
  |-- requestJpegThumbnail  -->  JPEG thumbnail
  |-- decode decode         -->  raw RGB bytes
  |-- decode render         -->  vectorscope JPEG (configurable color space, density, harmony)
  |-- f:picture             -->  displays rendered JPEG in dialog
```

The vectorscope image updates automatically when develop sliders change via `LrDevelopController.addAdjustmentChangeObserver`. A busy-guard with coalescing prevents overlapping renders. Frame alternation (`scope_0.jpg` / `scope_1.jpg`) forces `f:picture` to release cached images and prevents memory leaks.

### Rust decode binary

The binary has two subcommands:

- `decode decode` -- Decodes JPEG/TIFF to raw RGB bytes (used by both Photoshop and Lightroom pipelines)
- `decode render` -- Renders a vectorscope JPEG from raw RGB data with configurable options:
  - `--color-space` -- YCbCr BT.601 (default), CIE LUV, or HSL
  - `--density` -- Scatter (default), heatmap, or bloom rendering
  - `--scheme` -- Harmony overlay (complementary, triadic, etc.)
  - `--rotation` -- Harmony rotation in degrees
  - `--overlay-color` -- Zone line color (yellow, cyan, etc.)
  - `--hide-skin-tone` -- Disable skin tone reference line

## License

Proprietary. License keys follow the format `CHRM-XXXX-XXXX-XXXX` with tiered access (Trial, Pro, Pro+AI) and up to 3 machine activations per key.
