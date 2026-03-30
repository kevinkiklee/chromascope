# ChromaScope

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
    decode/      Rust binary -- JPEG/TIFF to raw RGB bytes
  plugins/
    photoshop/   Photoshop UXP panel plugin
    lightroom/   Lightroom Classic plugin (Lua + external binary)
  apps/
    web/         Next.js marketing site, licensing API, Stripe webhooks
  docs/          Architecture docs and guides
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo |
| Core | TypeScript, Vite 6, Vitest |
| Decode | Rust (image crate, clap) |
| Web | Next.js 16, React 19, Tailwind CSS 4, Turbopack |
| Database | Neon (serverless Postgres) |
| Payments | Stripe |
| AI | Vercel AI SDK 6, AI Gateway |
| Photoshop | Adobe UXP, batchPlay API |
| Lightroom | Lua, LrDevelopController |

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

## Architecture

The core library bundles to a single HTML file (`vite-plugin-singlefile`) that embeds in plugin WebViews. Plugins communicate with the core via a typed message protocol (`packages/core/src/protocol.ts`) passing pixel data, settings changes, and edit commands.

```
Plugin (Photoshop/Lightroom)
  |
  |-- PixelsMessage   -->  Core WebView (vectorscope rendering)
  |<-- SettingsMessage --  Core WebView (user changed settings)
  |<-- EditMessage     --  Core WebView (apply color correction)
```

Lightroom cannot read pixels directly from Lua, so it exports a thumbnail, pipes it through the Rust decode binary, and sends the raw RGB bytes to the WebView.

## License

Proprietary. License keys follow the format `CHRM-XXXX-XXXX-XXXX` with tiered access (Trial, Pro, Pro+AI) and up to 3 machine activations per key.
