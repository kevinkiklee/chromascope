# Vectorscope Plugin — Design Spec

**Date:** 2026-03-29
**Status:** Draft

---

## Overview

A vectorscope plugin for **Adobe Photoshop** and **Adobe Lightroom Classic** that provides real-time color analysis, harmony-based grading tools, and AI-powered color adjustment suggestions. Distributed as a paid product with a 14-day free trial.

### Key Decisions

| Decision | Choice |
|----------|--------|
| Architecture | Shared WebView core (Canvas 2D) embedded in both plugins |
| Color spaces | User-selectable: YCbCr, CIE LUV, HSL |
| Density modes | User-selectable: Scatter, Heat map, Bloom |
| Interactivity | Full grading tool with bidirectional image ↔ scope highlighting |
| Edit mapping | Context-dependent: HSL, Color Grading, Curves + Direct Pixel (PS only) |
| Harmony overlays | All types (Complementary, Split Comp, Triadic, Tetradic, Analogous) with per-zone pull strength |
| AI features | Scene analysis, style matching, NL grading, smart fit, palette extraction |
| AI backend | Cloud API (model-agnostic, swappable providers, future local model support) |
| UI layout | Scope on top, collapsible control sections below |
| Platform priority | Both in parallel, shared core first |
| Distribution | 14-day trial → Pro → Pro + AI, Stripe payments |
| Marketing | Next.js site on Vercel with docs, blog, download portal |

---

## 1. WebView Core — Vectorscope Engine

The shared Canvas 2D application embedded in both plugins via WebView.

### Rendering Pipeline

1. Host plugin sends pixel data as typed array (RGB, downsampled to ~256x256)
2. Core converts pixels to active color space
3. Plots on circular Canvas 2D using active density mode
4. Draws overlays (harmony zones, skin tone line, gamut ring) on separate canvas layer
5. Handles interaction events and sends edit commands back to host

### Color Space Modules

- **YCbCrMapper** — Cb/Cr to X/Y. Standard video vectorscope mapping.
- **CIELUVMapper** — u*/v* to X/Y. Perceptually uniform distances.
- **HSLMapper** — Hue to angle, Saturation to radius. Most intuitive.
- Common interface: `mapPixel(r, g, b) → { x, y, angle, radius }`

### Density Renderers

- **ScatterRenderer** — Individual dots with additive blending, alpha accumulation.
- **HeatmapRenderer** — Polar grid binning, count → color gradient (cold to hot).
- **BloomRenderer** — Weighted dots with gaussian glow, dominant colors bloom.
- Common interface: `render(mappedPoints, canvas)`

### Harmony Overlay System

**Supported schemes:** Complementary, Split Complementary, Triadic, Tetradic/Square, Analogous.

**Controls per scheme:**
- Rotate: drag or numeric input to set hue anchor
- Zone width: per-zone slider for how tightly colors should cluster
- Pull strength: per-zone slider (0-100%) for "Fit to Scheme" intensity

**"Fit to Scheme" engine:** For each pixel, compute distance to nearest harmony zone boundary, generate adjustment delta weighted by that zone's pull strength.

### Interaction Layer

- **Scope hover → image highlight:** Sends region mask to host, host highlights matching pixels
- **Image hover → scope highlight:** Host sends pixel coords, core highlights corresponding point
- **Drag on scope → grading:** Sends adjustment commands to host via active edit mode
- **Edit mode selector:** HSL | Color Grading | Curves | Direct Pixel (PS only)

### Message Protocol (WebView ↔ Host)

```
Host → WebView:
  { type: "pixels", data: Uint8Array, width, height, colorProfile }
  { type: "highlight", x, y }
  { type: "settings", colorSpace, densityMode, harmony, ... }
  { type: "ai-result", action, data }

WebView → Host:
  { type: "edit", mode: "hsl", params: { hue: +5, sat: -10, ... } }
  { type: "edit", mode: "pixels", data: Uint8Array }
  { type: "highlight", region: { angle, radius, width } }
  { type: "ai-request", action: "suggest-harmony", imageData: ... }
```

---

## 2. Photoshop UXP Plugin

### Plugin Configuration

- **Type:** Panel (dockable)
- **Manifest:** v5, targeting Photoshop 23.3+
- **Permissions:** WebView, network (license server + AI API)

### Panel Layout

- Top ~65%: WebView with vectorscope core
- Bottom ~35%: Collapsible Spectrum UXP controls
- Resizable — canvas scales to fill

### Data Pipeline (image → scope)

1. `imaging.getPixels()` with `targetSize: { width: 256, height: 256 }`, `colorSpace: "RGB"`, `componentSize: 8`
2. Pixel `Uint8Array` sent to WebView via `postMessage`
3. Pyramid levels used automatically for large images

### Refresh Triggers

- `action.addNotificationListener(['set', 'select', 'make', 'delete', ...])` — document edits
- `core.addNotificationListener('UI', [{ event: 'userIdle' }])` — debounced post-edit refresh
- Panel `show()` lifecycle — refresh on visibility
- Debounce: skip if last refresh <200ms ago

### Edit Pipeline (scope → image)

| Mode | Mechanism |
|------|-----------|
| HSL | `batchPlay` → Hue/Saturation adjustment layer |
| Color Grading | `batchPlay` → Color Balance / selective color |
| Curves | `batchPlay` → Curves adjustment layer control points |
| Direct Pixel | `executeAsModal` → `imaging.putPixels()` on new layer |

### Bidirectional Highlighting

- Scope → image: temporary overlay layer showing matching pixels
- Image → scope: pixel color at cursor highlighted on scope

---

## 3. Lightroom Classic Plugin

### Plugin Configuration

- **Type:** `.lrdevplugin` with floating dialog
- **Entry:** `LrExportMenuItems` → "Vectorscope" under File > Plug-in Extras
- **SDK version:** 15.0+

### Dialog Layout

- `LrDialogs.presentFloatingDialog` — stays open alongside Develop module
- WebView (via `LrWebViewFactory`) embedding vectorscope core
- Collapsible LrView controls below

### Data Pipeline (image → scope)

1. `photo:requestJpegThumbnail(512, 512, callback)` → JPEG binary string
2. Write to temp file via `LrFileUtils`
3. Invoke bundled Rust binary: `./vectorscope-decode <input.jpg> <output.bin>`
4. Binary decodes JPEG, downsamples to 256x256, outputs raw RGB bytes
5. Lua reads result, passes to WebView

### Bundled Rust Binary (`vectorscope-decode`)

- Statically compiled, no runtime dependencies
- Platforms: `bin/macos-arm64/`, `bin/macos-x64/`, `bin/win-x64/`
- Input: JPEG/TIFF file path + target dimensions
- Output: raw RGB pixel data as binary file
- Performance target: <20ms for 512→256 decode

### Refresh Triggers

- `LrDevelopController.addAdjustmentChangeObserver` — slider changes
- Debounce: 300ms after last change
- Active photo polling: `LrTasks.startAsyncTask` polls `catalog:getTargetPhoto()` every 500ms
- Thumbnail staleness: show "refreshing..." indicator during preview cache lag

### Edit Pipeline (scope → image)

| Mode | Mechanism |
|------|-----------|
| HSL | `LrDevelopController.setValue("HueAdjustmentRed", ...)` per channel |
| Color Grading | `LrDevelopController.setValue("SplitToningShadowHue", ...)` |
| Curves | Limited SDK access — use tone curve presets or available params |
| Direct Pixel | Not available — UI shows disabled with "Available in Photoshop" tooltip |

---

## 4. AI Backend

### Architecture

Next.js API routes on Vercel. Model-agnostic abstraction layer for swappable providers.

### Model Provider Interface

```typescript
interface ModelProvider {
  analyze(image: Buffer, prompt: string, options?: ModelOptions): Promise<AnalysisResult>
}
```

Implementations:
- `CloudProvider` — Routes through AI Gateway (default)
- `LocalProvider` — Future: user-supplied local model endpoint

### API Endpoints

| Endpoint | Input | Output |
|----------|-------|--------|
| `POST /api/ai/scene-analyze` | Downsampled image (base64) | Scene type, subject detection, suggested harmony + rotation |
| `POST /api/ai/style-match` | Current + reference image | Adjustment deltas (HSL, Color Grading, Curves) |
| `POST /api/ai/natural-language` | Vectorscope state + text prompt | Adjustment deltas for active edit mode |
| `POST /api/ai/smart-fit` | Pixel data + harmony config | Per-pixel adjustment weights preserving key colors |
| `POST /api/ai/palette-extract` | Downsampled image | Dominant colors, grading directions, overlay presets |

### Data Handling

- Only downsampled images sent (256x256 max)
- No full-resolution images leave the user's machine
- Zero retention policy: images processed, not stored
- Rate limits: 100 requests/day, 10/minute burst (Pro + AI tier)

---

## 5. Marketing Site + License Server

### Stack

Next.js (App Router) on Vercel, Stripe for payments, Neon Postgres for data.

### Site Map

| Route | Purpose |
|-------|---------|
| `/` | Hero, features overview, pricing, CTA |
| `/features` | Detailed capability showcase with demos |
| `/pricing` | Trial / Pro / Pro + AI tiers |
| `/download` | Platform selector, gated downloads |
| `/docs` | User guide, shortcuts, FAQ |
| `/blog` | Tutorials, color grading content, SEO |
| `/account` | License management, billing, downloads |

### Pricing Tiers

| Tier | Price | Includes |
|------|-------|----------|
| Trial | Free | Full Pro features, 14 days |
| Pro | TBD/year or one-time | Vectorscope, all color spaces, density modes, harmony overlays, grading tools |
| Pro + AI | TBD/year | Everything in Pro + all AI features |

### License System

**Database schema:**

`licenses` table: `id`, `key`, `email`, `tier`, `stripe_customer_id`, `created_at`, `expires_at`, `is_active`

`activations` table: `id`, `license_id`, `machine_id`, `platform` (PS/LrC), `activated_at`

**Rules:**
- Trial: auto-generated key on first download, 14-day expiry
- Paid: key generated on Stripe `checkout.session.completed` webhook
- Activation limit: 3 machines per license
- Machine ID: hash of OS + hardware identifiers
- Offline grace: 24-hour cached validation

### License API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/license/validate` | Key + machine ID → tier + expiry + features |
| `POST /api/license/activate` | Register machine against license |
| `POST /api/license/deactivate` | Release machine slot |
| `POST /api/stripe/webhook` | Stripe event handler |
| `GET /api/download/:platform` | Gated download (license check or trial generation) |

### Stripe Webhooks

- `checkout.session.completed` → generate key, send email
- `customer.subscription.deleted` → deactivate AI tier
- `invoice.payment_failed` → grace period, then downgrade

---

## 6. Project Structure

```
vectorscope/
├── packages/
│   ├── core/                    # Shared WebView vectorscope engine
│   │   ├── src/
│   │   │   ├── index.html
│   │   │   ├── vectorscope.ts
│   │   │   ├── color-spaces/    # YCbCr, CIELUV, HSL mappers
│   │   │   ├── renderers/       # Scatter, Heatmap, Bloom
│   │   │   ├── overlays/        # Harmony schemes, skin tone, gamut
│   │   │   ├── interaction/     # Hover, drag, grading edits
│   │   │   ├── protocol.ts      # Message types
│   │   │   └── ui/              # In-WebView controls
│   │   └── build/               # Bundled single-file output
│   │
│   └── decode/                  # Rust binary for LrC
│       ├── src/main.rs
│       └── Cargo.toml
│
├── plugins/
│   ├── photoshop/               # PS UXP plugin
│   │   ├── manifest.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts          # Panel lifecycle, events
│   │       ├── imaging.ts       # getPixels wrapper
│   │       ├── edits.ts         # batchPlay commands
│   │       ├── pixels.ts        # Direct pixel mode
│   │       ├── bridge.ts        # WebView messaging
│   │       └── license.ts
│   │
│   └── lightroom/
│       └── vectorscope.lrdevplugin/
│           ├── Info.lua
│           ├── ShowVectorscope.lua
│           ├── VectorscopeDialog.lua
│           ├── ImagePipeline.lua
│           ├── EditBridge.lua
│           ├── License.lua
│           └── bin/             # Bundled Rust binaries
│               ├── macos-arm64/
│               ├── macos-x64/
│               └── win-x64/
│
├── apps/
│   └── web/                     # Marketing site + license + AI API
│       ├── app/
│       │   ├── page.tsx
│       │   ├── features/
│       │   ├── pricing/
│       │   ├── download/
│       │   ├── docs/
│       │   ├── blog/
│       │   ├── account/
│       │   └── api/
│       │       ├── license/
│       │       ├── stripe/
│       │       ├── ai/
│       │       └── download/
│       └── lib/
│           ├── db/
│           ├── stripe/
│           ├── license/
│           └── ai/
│
├── turbo.json
└── .github/workflows/
    ├── build-plugins.yml
    ├── build-decode.yml
    └── deploy-web.yml
```

### Build Pipeline

- `turbo run build` — core, PS plugin, web app in parallel
- Rust binary cross-compiled via GitHub Actions (`cross` tool)
- Core WebView bundled to single file (Vite/esbuild), embedded in both plugins
- PS: packaged as `.ccx` for distribution
- LrC: zipped `.lrdevplugin` with binaries
- Web: auto-deployed to Vercel on push to main

---

## 7. Testing Strategy

### Core WebView
- Unit tests: color space mappers (known RGB → expected XY)
- Unit tests: harmony overlay geometry (rotation, boundaries)
- Visual regression: render known pixel sets, snapshot canvas
- Browser test harness with mock pixel data

### Photoshop Plugin
- Manual testing via UXP Developer Tool
- Integration scripts: open test images, verify scope output
- Edge cases: empty doc, 32-bit HDR, Lab mode, large images

### Lightroom Classic Plugin
- Manual testing via Plugin Manager
- Rust binary tested independently: known JPEGs → verified RGB output
- Edge cases: RAW files, virtual copies, panoramas, HDR merges

### Marketing Site + API
- Unit tests: license validation logic
- Integration tests: Stripe webhooks (test mode)
- E2E: trial signup → download → activation flow

### AI Endpoints
- Mock model responses for deterministic tests
- Validate adjustment deltas produce expected scope shifts
- Rate limiting tests
