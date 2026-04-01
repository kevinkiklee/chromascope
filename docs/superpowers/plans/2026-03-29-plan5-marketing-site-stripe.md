# Marketing Site + License Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Next.js marketing site at `web/` that serves landing, features, pricing, download, docs, and account pages, backed by a license server (Neon Postgres) and Stripe for paid tier checkout, webhooks, and subscription lifecycle management.

**Architecture:** Next.js App Router on Vercel. Server Components by default; `'use client'` only for interactive UI. License keys are UUIDs stored in Neon Postgres via `@neondatabase/serverless`. Stripe handles checkout sessions and subscription webhooks. Downloads are gated behind license validation. Three tiers: Trial (14-day free), Pro (one-time or annual), Pro + AI (subscription).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS (dark mode default), Neon Postgres (`@neondatabase/serverless`), Stripe (`stripe`), Geist font, Vercel deployment.

**Reference docs:**
- Design spec: `docs/superpowers/specs/2026-03-29-vectorscope-plugin-design.md`

---

## File Map

```
web/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── app/
│   ├── layout.tsx                        # Root layout: dark theme, Geist font, metadata
│   ├── page.tsx                          # Landing page: hero, features overview, pricing cards, CTA
│   ├── features/
│   │   └── page.tsx                      # Detailed capability showcase
│   ├── pricing/
│   │   └── page.tsx                      # 3-tier pricing with Stripe checkout buttons
│   ├── download/
│   │   └── page.tsx                      # Platform selector, license key input
│   ├── docs/
│   │   └── page.tsx                      # User guide, FAQ
│   ├── account/
│   │   └── page.tsx                      # License info, activation list, billing link
│   └── api/
│       ├── license/
│       │   ├── validate/route.ts         # POST: key + machine_id → tier + expiry + features
│       │   ├── activate/route.ts         # POST: register machine against license
│       │   └── deactivate/route.ts       # POST: release machine slot
│       ├── stripe/
│       │   └── webhook/route.ts          # POST: Stripe event handler (sig verification)
│       └── download/
│           └── [platform]/route.ts       # GET: gated download redirect
├── lib/
│   ├── db.ts                             # Neon client, schema SQL, query helpers
│   ├── license.ts                        # Key gen, validate, activate, deactivate logic
│   └── stripe.ts                         # Stripe client, checkout session helpers
```

---

### Task 1: Next.js App Scaffold

**Files:**
- Create: `web/package.json`
- Create: `web/next.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.mjs`
- Create: `web/app/layout.tsx`

- [ ] **Step 1: Create web/package.json**

```json
{
  "name": "@vectorscope/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "stripe": "^16.0.0",
    "@neondatabase/serverless": "^0.9.0",
    "geist": "^1.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

- [ ] **Step 2: Create web/next.config.ts**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Enable server actions if needed later
  },
};

export default nextConfig;
```

- [ ] **Step 3: Create web/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create web/tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Create web/postcss.config.mjs**

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

- [ ] **Step 6: Create web/app/layout.tsx**

Root layout with dark theme applied via `<html className="dark">`, Geist Sans + Mono fonts loaded from the `geist` package, global Tailwind CSS import, and base metadata.

```tsx
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vectorscope — Professional Color Analysis',
  description: 'A professional vectorscope plugin for Photoshop and Lightroom Classic.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-zinc-950 text-zinc-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

Also create `web/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

### Task 2: Landing Page

**Files:**
- Create: `web/app/page.tsx`

- [ ] **Step 1: Create web/app/page.tsx**

Server Component. Sections in order:
1. **Nav** — logo left, links (Features, Pricing, Download, Docs), "Get Started" CTA button right.
2. **Hero** — large headline ("Professional Vectorscope for Photoshop & Lightroom"), sub-headline, two CTAs ("Start Free Trial" → `/download`, "View Pricing" → `/pricing`).
3. **Features Overview** — 3-column grid of feature cards (Color Spaces, Density Modes, Real-time Analysis). Each card: icon placeholder (SVG or emoji), title, 1-sentence description.
4. **Pricing Summary** — 3 cards (Trial, Pro, Pro + AI) with key bullet points and "Get Started" / "Buy Now" links. Full detail lives on `/pricing`.
5. **Footer** — links to Features, Pricing, Download, Docs, Account. Copyright.

Styling: full-width sections, `max-w-6xl mx-auto px-6` containers, dark background (`bg-zinc-950`), accent color `indigo-500` for buttons and highlights.

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">Vectorscope</span>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
            <Link
              href="/download"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Professional Vectorscope<br />for Photoshop &amp; Lightroom
          </h1>
          <p className="text-xl text-zinc-400 mb-10">
            Real-time color analysis across YCbCr, CIE LUV, and HSL color spaces.
            Scatter, heatmap, and bloom density modes. Built for colorists.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/download"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-16 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Everything you need for color analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Color Spaces', desc: 'Analyze in YCbCr, CIE LUV, or HSL — switch in real time.' },
              { title: 'Density Modes', desc: 'Scatter, heatmap, and bloom rendering to visualize pixel distributions.' },
              { title: 'Real-time Analysis', desc: 'Frame-accurate vectorscope updates as you edit in Photoshop or Lightroom.' },
            ].map((f) => (
              <div key={f.title} className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Summary */}
      <section className="py-16 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-zinc-400 mb-12">Start free. Upgrade when you're ready.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Trial', price: 'Free', sub: '14 days', bullets: ['Full Pro features', 'No credit card'], cta: 'Start Trial', href: '/download' },
              { name: 'Pro', price: 'TBD', sub: 'one-time or /year', bullets: ['All vectorscope features', '3 machines'], cta: 'Buy Pro', href: '/pricing' },
              { name: 'Pro + AI', price: 'TBD', sub: '/year', bullets: ['Everything in Pro', 'AI color analysis features'], cta: 'Buy Pro + AI', href: '/pricing' },
            ].map((t) => (
              <div key={t.name} className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex flex-col">
                <div className="font-bold text-lg mb-1">{t.name}</div>
                <div className="text-3xl font-bold mb-1">{t.price}</div>
                <div className="text-zinc-500 text-sm mb-4">{t.sub}</div>
                <ul className="text-sm text-zinc-400 mb-6 space-y-1 text-left">
                  {t.bullets.map((b) => <li key={b}>✓ {b}</li>)}
                </ul>
                <Link href={t.href} className="mt-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors text-center">
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-10 px-6 text-center text-zinc-500 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <Link href="/features" className="hover:text-zinc-300">Features</Link>
          <Link href="/pricing" className="hover:text-zinc-300">Pricing</Link>
          <Link href="/download" className="hover:text-zinc-300">Download</Link>
          <Link href="/docs" className="hover:text-zinc-300">Docs</Link>
          <Link href="/account" className="hover:text-zinc-300">Account</Link>
        </div>
        <p>© {new Date().getFullYear()} Vectorscope. All rights reserved.</p>
      </footer>
    </div>
  );
}
```

---

### Task 3: Features Page

**Files:**
- Create: `web/app/features/page.tsx`

- [ ] **Step 1: Create web/app/features/page.tsx**

Server Component. Detailed capability showcase with one full-width section per major feature group. Use same Nav/Footer components extracted from the landing page (or inline them for now). Sections:

1. **Color Spaces** — YCbCr (broadcast standard), CIE LUV (perceptually uniform), HSL (intuitive). Each with a short paragraph.
2. **Density Modes** — Scatter (raw pixel positions), Heatmap (frequency-weighted color fill), Bloom (glow effect for bright clusters).
3. **Graticule** — Circular grid, hue labels, saturation rings, customizable opacity.
4. **Platform Support** — Photoshop UXP panel, Lightroom Classic panel. Side-by-side comparison.
5. **AI Features (Pro + AI)** — Brief teaser of upcoming AI color analysis features.

Each section: `<section>` with `py-16 border-t border-zinc-800`, `max-w-6xl mx-auto px-6`, heading + prose + feature grid or two-column layout.

```tsx
import Link from 'next/link';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="text-zinc-100">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
            <Link href="/download" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <header className="py-20 px-6 text-center border-b border-zinc-800">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Features</h1>
          <p className="text-zinc-400 text-lg">Everything inside Vectorscope, in detail.</p>
        </div>
      </header>

      {/* Color Spaces */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Color Spaces</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'YCbCr', desc: 'Broadcast-standard color space used in video production. Separates luma (Y) from chroma (Cb, Cr) for precise saturation analysis.' },
              { name: 'CIE LUV', desc: 'Perceptually uniform color space where equal distances represent equal perceived color differences. Ideal for colorimetric work.' },
              { name: 'HSL', desc: 'Hue-Saturation-Lightness — an intuitive representation of color suitable for artistic grading workflows.' },
            ].map((cs) => (
              <div key={cs.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-2">{cs.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{cs.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Density Modes */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Density Modes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Scatter', desc: 'Each pixel plotted as a point on the vectorscope. Provides an unweighted view of the full color gamut in the image.' },
              { name: 'Heatmap', desc: 'Pixel density is accumulated and color-mapped — areas with more pixels glow brighter, revealing dominant hues at a glance.' },
              { name: 'Bloom', desc: 'Glow effect applied to high-density clusters, making tightly grouped color populations visually distinctive.' },
            ].map((dm) => (
              <div key={dm.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-2">{dm.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{dm.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Graticule */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Graticule</h2>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            A configurable circular grid is overlaid on the vectorscope display. It includes saturation rings at standard intervals,
            hue labels at 30° increments, and a fine angular grid. Opacity is adjustable in the settings panel.
          </p>
        </div>
      </section>

      {/* Platform Support */}
      <section className="py-16 px-6 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Platform Support</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'Adobe Photoshop', desc: 'UXP panel plugin. Samples the active document on each pixel-level edit event. Supports all document color modes.' },
              { name: 'Lightroom Classic', desc: 'LrC SDK panel plugin. Responds to photo selection and develop module slider changes in real time.' },
            ].map((p) => (
              <div key={p.name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="font-semibold text-lg mb-2">{p.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">AI Features <span className="text-sm font-normal text-indigo-400 ml-2">Pro + AI</span></h2>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            The Pro + AI tier unlocks AI-powered color analysis features. Coming soon: automatic color cast detection,
            reference image matching, and intelligent grading suggestions based on vectorscope data.
          </p>
          <Link href="/pricing" className="inline-block mt-6 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
            View Pro + AI Pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
```

---

### Task 4: Pricing Page

**Files:**
- Create: `web/app/pricing/page.tsx`

- [ ] **Step 1: Create web/app/pricing/page.tsx**

Server Component for the outer layout. `'use client'` child component `<CheckoutButton>` for the Stripe redirect. Three tier cards side by side. Clicking a paid tier's CTA POSTs to `/api/stripe/checkout` (or redirects to a Stripe Payment Link). Trial CTA links to `/download`.

```tsx
import Link from 'next/link';
import CheckoutButton from './CheckoutButton';

const TIERS = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    description: 'Full Pro feature access, no credit card required.',
    bullets: [
      'All vectorscope features',
      'YCbCr, CIE LUV, HSL color spaces',
      'Scatter, heatmap, bloom modes',
      'Photoshop + Lightroom Classic',
      '14-day expiry',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/download',
    highlight: false,
    priceId: null,
  },
  {
    name: 'Pro',
    price: 'TBD',
    period: 'one-time or /year',
    description: 'Permanent access to all vectorscope features. 3 machine activations.',
    bullets: [
      'Everything in Trial',
      'Perpetual or annual license',
      '3 machine activations',
      'Priority support',
    ],
    cta: 'Buy Pro',
    ctaHref: null,
    highlight: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '',
  },
  {
    name: 'Pro + AI',
    price: 'TBD',
    period: '/year',
    description: 'Pro features plus AI-powered color analysis. Annual subscription.',
    bullets: [
      'Everything in Pro',
      'AI color cast detection',
      'Reference image matching',
      'AI grading suggestions',
      'Early access to new AI features',
    ],
    cta: 'Buy Pro + AI',
    ctaHref: null,
    highlight: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_AI_PRICE_ID ?? '',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="text-zinc-100">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
            <Link href="/download" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <header className="py-20 px-6 text-center border-b border-zinc-800">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Pricing</h1>
          <p className="text-zinc-400 text-lg">Start free for 14 days. No credit card required.</p>
        </div>
      </header>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl p-8 border flex flex-col ${
                tier.highlight
                  ? 'border-indigo-500 bg-indigo-950/40'
                  : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              {tier.highlight && (
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Most Popular</span>
              )}
              <h2 className="text-xl font-bold mb-1">{tier.name}</h2>
              <div className="text-3xl font-bold mb-1">{tier.price}</div>
              <div className="text-zinc-500 text-sm mb-3">{tier.period}</div>
              <p className="text-zinc-400 text-sm mb-6">{tier.description}</p>
              <ul className="text-sm text-zinc-400 space-y-2 mb-8 flex-1">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-indigo-400">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              {tier.ctaHref ? (
                <Link
                  href={tier.ctaHref}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-center"
                >
                  {tier.cta}
                </Link>
              ) : (
                <CheckoutButton priceId={tier.priceId!} label={tier.cta} />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create web/app/pricing/CheckoutButton.tsx**

```tsx
'use client';

export default function CheckoutButton({ priceId, label }: { priceId: string; label: string }) {
  async function handleClick() {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <button
      onClick={handleClick}
      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full"
    >
      {label}
    </button>
  );
}
```

Also create the checkout session route `web/app/api/stripe/checkout/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const { priceId } = await req.json();
  const session = await stripe.checkout.sessions.create({
    mode: priceId.includes('recurring') ? 'subscription' : 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
    metadata: { source: 'vectorscope_web' },
  });
  return NextResponse.json({ url: session.url });
}
```

---

### Task 5: DB + License Library

**Files:**
- Create: `web/lib/db.ts`
- Create: `web/lib/license.ts`

- [ ] **Step 1: Create web/lib/db.ts**

Neon Postgres client using `@neondatabase/serverless`. Export `sql` tagged-template query helper and a `runMigration()` function that creates both tables if they do not exist.

```ts
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL environment variable');
}

export const sql = neon(process.env.DATABASE_URL);

export async function runMigration() {
  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key         TEXT NOT NULL UNIQUE,
      email       TEXT NOT NULL,
      tier        TEXT NOT NULL CHECK (tier IN ('trial', 'pro', 'pro_ai')),
      stripe_customer_id TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS activations (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      license_id   UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      machine_id   TEXT NOT NULL,
      platform     TEXT NOT NULL,
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (license_id, machine_id)
    )
  `;
}
```

- [ ] **Step 2: Create web/lib/license.ts**

Key generation, validation, activation, and deactivation logic. Limit: 3 machine activations per license. Trial licenses auto-expire in 14 days.

```ts
import { sql } from './db';

const MAX_ACTIVATIONS = 3;

export function generateLicenseKey(): string {
  // Format: VECT-XXXX-XXXX-XXXX (uppercase hex segments)
  const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  return `VECT-${uuid.slice(0, 4)}-${uuid.slice(4, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}`;
}

export interface LicenseRecord {
  id: string;
  key: string;
  email: string;
  tier: 'trial' | 'pro' | 'pro_ai';
  stripe_customer_id: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export async function createTrialLicense(email: string): Promise<LicenseRecord> {
  const key = generateLicenseKey();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await sql`
    INSERT INTO licenses (key, email, tier, expires_at)
    VALUES (${key}, ${email}, 'trial', ${expiresAt})
    RETURNING *
  `;
  return rows[0] as LicenseRecord;
}

export async function createPaidLicense(
  email: string,
  tier: 'pro' | 'pro_ai',
  stripeCustomerId: string,
): Promise<LicenseRecord> {
  const key = generateLicenseKey();
  const rows = await sql`
    INSERT INTO licenses (key, email, tier, stripe_customer_id)
    VALUES (${key}, ${email}, ${tier}, ${stripeCustomerId})
    RETURNING *
  `;
  return rows[0] as LicenseRecord;
}

export interface ValidationResult {
  valid: boolean;
  tier?: string;
  expires_at?: string | null;
  features?: string[];
  error?: string;
}

export async function validateLicense(key: string, machineId: string): Promise<ValidationResult> {
  const rows = await sql`
    SELECT * FROM licenses WHERE key = ${key} AND is_active = TRUE LIMIT 1
  `;
  if (rows.length === 0) return { valid: false, error: 'License not found or inactive' };

  const license = rows[0] as LicenseRecord;

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { valid: false, error: 'License expired' };
  }

  const features = tierFeatures(license.tier);
  return { valid: true, tier: license.tier, expires_at: license.expires_at, features };
}

export interface ActivationResult {
  success: boolean;
  error?: string;
}

export async function activateLicense(key: string, machineId: string, platform: string): Promise<ActivationResult> {
  const rows = await sql`
    SELECT * FROM licenses WHERE key = ${key} AND is_active = TRUE LIMIT 1
  `;
  if (rows.length === 0) return { success: false, error: 'License not found or inactive' };

  const license = rows[0] as LicenseRecord;

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { success: false, error: 'License expired' };
  }

  const existing = await sql`
    SELECT * FROM activations WHERE license_id = ${license.id} AND machine_id = ${machineId} LIMIT 1
  `;
  if (existing.length > 0) return { success: true }; // already activated on this machine

  const count = await sql`
    SELECT COUNT(*) AS cnt FROM activations WHERE license_id = ${license.id}
  `;
  if (Number(count[0].cnt) >= MAX_ACTIVATIONS) {
    return { success: false, error: 'Maximum machine activations reached' };
  }

  await sql`
    INSERT INTO activations (license_id, machine_id, platform)
    VALUES (${license.id}, ${machineId}, ${platform})
    ON CONFLICT (license_id, machine_id) DO NOTHING
  `;
  return { success: true };
}

export async function deactivateLicense(key: string, machineId: string): Promise<ActivationResult> {
  const rows = await sql`
    SELECT id FROM licenses WHERE key = ${key} LIMIT 1
  `;
  if (rows.length === 0) return { success: false, error: 'License not found' };

  const licenseId = rows[0].id;
  await sql`
    DELETE FROM activations WHERE license_id = ${licenseId} AND machine_id = ${machineId}
  `;
  return { success: true };
}

function tierFeatures(tier: string): string[] {
  const base = ['color_spaces', 'density_modes', 'graticule', 'photoshop', 'lightroom'];
  if (tier === 'pro_ai') return [...base, 'ai_analysis'];
  return base;
}
```

---

### Task 6: License API Routes

**Files:**
- Create: `web/app/api/license/validate/route.ts`
- Create: `web/app/api/license/activate/route.ts`
- Create: `web/app/api/license/deactivate/route.ts`

- [ ] **Step 1: Create web/app/api/license/validate/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { validateLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, machine_id } = body ?? {};

  if (!key || !machine_id) {
    return NextResponse.json({ error: 'Missing key or machine_id' }, { status: 400 });
  }

  const result = await validateLicense(key, machine_id);

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 403 });
  }

  return NextResponse.json({
    valid: true,
    tier: result.tier,
    expires_at: result.expires_at,
    features: result.features,
  });
}
```

- [ ] **Step 2: Create web/app/api/license/activate/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { activateLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, machine_id, platform } = body ?? {};

  if (!key || !machine_id || !platform) {
    return NextResponse.json({ error: 'Missing key, machine_id, or platform' }, { status: 400 });
  }

  const result = await activateLicense(key, machine_id, platform);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create web/app/api/license/deactivate/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { deactivateLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, machine_id } = body ?? {};

  if (!key || !machine_id) {
    return NextResponse.json({ error: 'Missing key or machine_id' }, { status: 400 });
  }

  const result = await deactivateLicense(key, machine_id);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
```

---

### Task 7: Stripe Library + Webhook Route

**Files:**
- Create: `web/lib/stripe.ts`
- Create: `web/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Create web/lib/stripe.ts**

```ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

export async function constructWebhookEvent(payload: string, sig: string): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  return stripe.webhooks.constructEvent(payload, sig, secret);
}
```

- [ ] **Step 2: Create web/app/api/stripe/webhook/route.ts**

Handles three events:
- `checkout.session.completed` — create paid license, send email (stubbed).
- `customer.subscription.deleted` — deactivate Pro + AI tier, downgrade to Pro.
- `invoice.payment_failed` — log warning; implement grace period / downgrade in a follow-up.

Signature verification using `constructWebhookEvent`. Raw body must be read with `req.text()` before parsing (required by Stripe).

```ts
import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { createPaidLicense, sql } from '@/lib/license';

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event;
  try {
    event = await constructWebhookEvent(payload, sig);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as import('stripe').Stripe.Checkout.Session;
      const email = session.customer_details?.email ?? session.customer_email ?? '';
      const customerId = typeof session.customer === 'string' ? session.customer : '';
      // Determine tier from metadata or line items — default to 'pro'
      const tier = (session.metadata?.tier as 'pro' | 'pro_ai') ?? 'pro';
      if (email) {
        const license = await createPaidLicense(email, tier, customerId);
        // TODO: send license key email to `email` with key `license.key`
        console.log(`License created: ${license.key} for ${email}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : '';
      if (customerId) {
        // Downgrade Pro + AI licenses for this customer to Pro
        await sql`
          UPDATE licenses
          SET tier = 'pro'
          WHERE stripe_customer_id = ${customerId}
            AND tier = 'pro_ai'
            AND is_active = TRUE
        `;
        console.log(`Subscription deleted for customer ${customerId} — downgraded to Pro`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as import('stripe').Stripe.Invoice;
      // Grace period logic: log for now, implement downgrade after N days in follow-up
      console.warn(`Payment failed for customer ${invoice.customer}`);
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
```

---

### Task 8: Download Page + Gated Download API

**Files:**
- Create: `web/app/download/page.tsx`
- Create: `web/app/api/download/[platform]/route.ts`

- [ ] **Step 1: Create web/app/download/page.tsx**

`'use client'` component (needs state for license key input + platform selection). Flow:
1. User enters email → POST `/api/license/trial` to generate trial key (add this lightweight route).
2. User enters existing license key + selects platform (macOS / Windows).
3. On submit, validates key then redirects to `/api/download/:platform?key=...`.

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';

type Platform = 'macos' | 'windows';

export default function DownloadPage() {
  const [email, setEmail] = useState('');
  const [trialKey, setTrialKey] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [platform, setPlatform] = useState<Platform>('macos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTrial(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/license/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.key) {
      setTrialKey(data.key);
    } else {
      setError(data.error ?? 'Failed to create trial');
    }
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    const key = licenseKey.trim();
    if (!key) { setError('Enter a license key'); return; }
    window.location.href = `/api/download/${platform}?key=${encodeURIComponent(key)}`;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="text-zinc-100">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
          </div>
        </div>
      </nav>

      <main className="py-20 px-6 max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Download</h1>
        <p className="text-zinc-400 mb-10">Start a free 14-day trial or download with your license key.</p>

        {/* Trial form */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
          <h2 className="font-semibold mb-4">Start Free Trial</h2>
          {trialKey ? (
            <div className="text-sm">
              <p className="text-zinc-400 mb-2">Your trial key:</p>
              <code className="block bg-zinc-800 rounded px-3 py-2 font-mono text-indigo-300 mb-4">{trialKey}</code>
              <p className="text-zinc-500 text-xs">Copy this key and use it in the download form below.</p>
            </div>
          ) : (
            <form onSubmit={handleTrial} className="flex gap-3">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Get Trial Key'}
              </button>
            </form>
          )}
        </section>

        {/* Download form */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Download with License Key</h2>
          <form onSubmit={handleDownload} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">License Key</label>
              <input
                type="text"
                placeholder="VECT-XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Platform</label>
              <div className="flex gap-3">
                {(['macos', 'windows'] as Platform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      platform === p
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {p === 'macos' ? 'macOS' : 'Windows'}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Download
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create web/app/api/license/trial/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createTrialLicense } from '@/lib/license';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  const license = await createTrialLicense(email);
  return NextResponse.json({ key: license.key, expires_at: license.expires_at });
}
```

- [ ] **Step 3: Create web/app/api/download/[platform]/route.ts**

Validate the license key, then redirect to a signed download URL (or a static asset URL stored in `DOWNLOAD_URL_MACOS` / `DOWNLOAD_URL_WINDOWS` env vars).

```ts
import { NextRequest, NextResponse } from 'next/server';
import { validateLicense } from '@/lib/license';

const DOWNLOAD_URLS: Record<string, string | undefined> = {
  macos: process.env.DOWNLOAD_URL_MACOS,
  windows: process.env.DOWNLOAD_URL_WINDOWS,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const key = req.nextUrl.searchParams.get('key') ?? '';

  if (!DOWNLOAD_URLS[platform]) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
  }

  if (!key) {
    return NextResponse.redirect(new URL('/download', req.url));
  }

  // Use a placeholder machine_id for download validation (no activation)
  const result = await validateLicense(key, '__download_check__');
  if (!result.valid) {
    return NextResponse.redirect(new URL('/download?error=invalid_key', req.url));
  }

  return NextResponse.redirect(DOWNLOAD_URLS[platform]!);
}
```

---

### Task 9: Account Page

**Files:**
- Create: `web/app/account/page.tsx`

- [ ] **Step 1: Create web/app/account/page.tsx**

Server Component that fetches license + activation data for a given license key passed via query param (`?key=...`). Shows tier, expiry, machine list, and a Stripe billing portal link. If no key, shows a form to look up by key or email.

```tsx
import Link from 'next/link';
import { sql } from '@/lib/db';

async function getLicenseData(key: string) {
  if (!key) return null;
  const rows = await sql`
    SELECT l.*, array_agg(
      json_build_object('machine_id', a.machine_id, 'platform', a.platform, 'activated_at', a.activated_at)
    ) FILTER (WHERE a.id IS NOT NULL) AS activations
    FROM licenses l
    LEFT JOIN activations a ON a.license_id = l.id
    WHERE l.key = ${key}
    GROUP BY l.id
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key = '' } = await searchParams;
  const data = await getLicenseData(key);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">Docs</Link>
          </div>
        </div>
      </nav>

      <main className="py-20 px-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Account</h1>

        {!key || !data ? (
          <LicenseLookupForm />
        ) : (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="font-semibold mb-4">License</h2>
              <dl className="space-y-2 text-sm">
                <Row label="Key"><code className="font-mono text-indigo-300">{data.key}</code></Row>
                <Row label="Email">{data.email}</Row>
                <Row label="Tier"><span className="capitalize">{data.tier.replace('_', ' + ')}</span></Row>
                <Row label="Status">{data.is_active ? '✓ Active' : '✗ Inactive'}</Row>
                {data.expires_at && (
                  <Row label="Expires">{new Date(data.expires_at).toLocaleDateString()}</Row>
                )}
              </dl>
              {data.stripe_customer_id && (
                <a
                  href={`/api/billing-portal?customer=${data.stripe_customer_id}`}
                  className="inline-block mt-4 text-sm text-indigo-400 hover:text-indigo-300 underline"
                >
                  Manage billing →
                </a>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="font-semibold mb-4">Machine Activations ({(data.activations ?? []).length} / 3)</h2>
              {(data.activations ?? []).length === 0 ? (
                <p className="text-zinc-500 text-sm">No machines activated yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(data.activations as Array<{ machine_id: string; platform: string; activated_at: string }>).map((a) => (
                    <li key={a.machine_id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-zinc-300">{a.machine_id}</span>
                      <span className="text-zinc-500">{a.platform} · {new Date(a.activated_at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-zinc-200">{children}</dd>
    </div>
  );
}

function LicenseLookupForm() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <p className="text-zinc-400 text-sm mb-4">Enter your license key to view your account details.</p>
      <form method="get" className="flex gap-3">
        <input
          name="key"
          type="text"
          placeholder="VECT-XXXX-XXXX-XXXX-XXXX"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Look up
        </button>
      </form>
    </div>
  );
}
```

---

### Task 10: Docs Page

**Files:**
- Create: `web/app/docs/page.tsx`

- [ ] **Step 1: Create web/app/docs/page.tsx**

Server Component. Sections: Installation, Getting Started, Color Spaces reference, Density Modes reference, License FAQ, Troubleshooting.

```tsx
import Link from 'next/link';

const sections = [
  {
    id: 'installation',
    title: 'Installation',
    content: `Download the plugin for your platform from the Download page. For Photoshop, install via the UXP Developer Tool or the Creative Cloud plugin manager. For Lightroom Classic, copy the plugin folder to your Lightroom plugins directory and enable it via Plug-in Manager.`,
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: `Open the Vectorscope panel in Photoshop (Window → Plugins → Vectorscope) or Lightroom Classic (Window → Panels → Vectorscope). The panel activates automatically when you open a document or select a photo. Use the toolbar to switch color spaces and density modes.`,
  },
  {
    id: 'color-spaces',
    title: 'Color Spaces',
    content: `YCbCr separates luminance from chrominance — useful for broadcast-compliant grading. CIE LUV is perceptually uniform, making it ideal for precise colorimetric analysis. HSL (Hue-Saturation-Lightness) provides an intuitive view suitable for artistic workflows.`,
  },
  {
    id: 'density-modes',
    title: 'Density Modes',
    content: `Scatter plots each pixel as a point. Heatmap accumulates pixel frequency and maps it to color — denser regions appear brighter. Bloom applies a glow effect to high-density clusters, making dominant color populations visually distinct.`,
  },
  {
    id: 'license-faq',
    title: 'License FAQ',
    content: `Your license supports up to 3 machine activations. To move to a new machine, deactivate one of your existing machines from the Account page. Trial licenses are valid for 14 days from the date of creation. Pro licenses do not expire. Pro + AI licenses are annual subscriptions.`,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    content: `If the panel does not update, ensure the plugin is connected (check the status indicator in the panel header). For license errors, verify your key on the Account page. If you reach the machine activation limit, deactivate an unused machine. Contact support via the email in your license confirmation.`,
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg tracking-tight">Vectorscope</Link>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link href="/features" className="hover:text-zinc-100 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-100 transition-colors">Pricing</Link>
            <Link href="/download" className="hover:text-zinc-100 transition-colors">Download</Link>
            <Link href="/docs" className="text-zinc-100">Docs</Link>
            <Link href="/download" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 flex gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden md:block w-48 shrink-0">
          <nav className="sticky top-8 space-y-1 text-sm">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-zinc-400 hover:text-zinc-100 py-1 transition-colors">
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 max-w-2xl space-y-12">
          <h1 className="text-3xl font-bold">Documentation</h1>
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="text-xl font-semibold mb-3">{s.title}</h2>
              <p className="text-zinc-400 leading-relaxed">{s.content}</p>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
```

---

### Task 11: Verification

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/iser/workspace/vectorscope/web
npm install
```

- [ ] **Step 2: Set required environment variables**

Create `web/.env.local` (not committed — add to `.gitignore`):

```
DATABASE_URL=postgres://...                  # Neon connection string
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PRO_AI_PRICE_ID=price_...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DOWNLOAD_URL_MACOS=https://...
DOWNLOAD_URL_WINDOWS=https://...
```

- [ ] **Step 3: Run DB migration**

In a one-off script or route, call `runMigration()` from `lib/db.ts` to create the `licenses` and `activations` tables.

- [ ] **Step 4: Start dev server and verify pages load**

```bash
cd /Users/iser/workspace/vectorscope/web
npm run dev
```

Verify each route returns 200 and renders without errors:
- `/` — landing page
- `/features` — features showcase
- `/pricing` — 3 tier cards
- `/download` — platform selector + trial form
- `/docs` — documentation
- `/account` — license lookup form

- [ ] **Step 5: Verify API routes respond correctly**

```bash
# Trial key creation
curl -X POST http://localhost:3000/api/license/trial \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

# License validation (replace KEY with value from above)
curl -X POST http://localhost:3000/api/license/validate \
  -H 'Content-Type: application/json' \
  -d '{"key":"VECT-...", "machine_id":"machine-001"}'

# License activation
curl -X POST http://localhost:3000/api/license/activate \
  -H 'Content-Type: application/json' \
  -d '{"key":"VECT-...", "machine_id":"machine-001", "platform":"macos"}'

# License deactivation
curl -X POST http://localhost:3000/api/license/deactivate \
  -H 'Content-Type: application/json' \
  -d '{"key":"VECT-...", "machine_id":"machine-001"}'
```

- [ ] **Step 6: Test Stripe webhook with Stripe CLI**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

Verify the webhook handler logs a new license key without errors.

- [ ] **Step 7: Build check**

```bash
cd /Users/iser/workspace/vectorscope/web
npm run build
```

Confirm zero TypeScript errors and a clean production build.

---

## Environment Variables Summary

| Variable | Where Used | Notes |
|---|---|---|
| `DATABASE_URL` | `lib/db.ts` | Neon Postgres connection string |
| `STRIPE_SECRET_KEY` | `lib/stripe.ts` | Stripe secret key (server only) |
| `STRIPE_WEBHOOK_SECRET` | `lib/stripe.ts` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | `app/pricing/page.tsx` | Stripe price ID for Pro tier |
| `NEXT_PUBLIC_STRIPE_PRO_AI_PRICE_ID` | `app/pricing/page.tsx` | Stripe price ID for Pro + AI tier |
| `NEXT_PUBLIC_BASE_URL` | `app/api/stripe/checkout/route.ts` | Canonical site URL for redirect |
| `DOWNLOAD_URL_MACOS` | `app/api/download/[platform]/route.ts` | Signed or static macOS download URL |
| `DOWNLOAD_URL_WINDOWS` | `app/api/download/[platform]/route.ts` | Signed or static Windows download URL |

## Key Implementation Notes

- All pages are Server Components except `app/download/page.tsx` (needs form state) and `app/pricing/CheckoutButton.tsx` (needs `onClick`).
- `app/api/stripe/webhook/route.ts` reads the raw body with `req.text()` before signature verification — do not let Next.js parse it as JSON first.
- `lib/license.ts` imports `sql` from `lib/db.ts`; `app/account/page.tsx` also imports `sql` directly for the JOIN query. Keep the Neon client singleton in `lib/db.ts`.
- License keys use the format `VECT-XXXX-XXXX-XXXX-XXXX` (18 hex chars from `crypto.randomUUID()`).
- The `activations` table has a `UNIQUE (license_id, machine_id)` constraint so concurrent activate calls are idempotent.
- The gated download route validates the key but does not register a machine activation — activation happens separately via the plugin on first launch.
