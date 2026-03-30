# Marketing Website Redesign — Homepage

**Date:** 2026-03-30
**Scope:** Homepage only (`apps/web/app/page.tsx` + new components)
**Goal:** Premium, product-forward redesign targeting professional colorists. Blackmagic/DaVinci aesthetic — dark, technical, editorial. Hybrid approach: product screenshot placeholders + animated vectorscope accents + scroll-triggered animations.

---

## Design Decisions

- **Audience:** Professional colorists and cinematographers who know what a vectorscope is
- **Visual direction:** Hybrid (Direction C) — product screenshots as primary visuals, animated vectorscope accents as decorative elements, spec badges for scannable info
- **Plus:** Full-bleed product screenshot banner (Direction A) placed mid-page
- **Animation level:** Noticeable but purposeful — staggered entrances, orbiting dots, parallax, count-up numbers
- **Assets:** Placeholders for product screenshots; real images will be swapped in later
- **Section 2 framing:** Problem→solution cards (not spec numbers) — speak to what Chromascope solves for photographers

---

## Section Flow

### Section 1: Hero

Split layout. Copy on the left, product screenshot placeholder on the right.

**Left side:**
- Eyebrow: "Professional Color Analysis" (uppercase, violet, small)
- Headline: "See your color **like never before**" (gradient text on the emphasized phrase)
- Subtext: "Chrominance vectorscope analysis for Adobe Photoshop and Lightroom Classic."
- Two CTAs: "Download Free Trial" (primary gradient button) + "View Features" (ghost button)
- Platform badges below CTAs: Photoshop, Lightroom Classic, macOS & Windows

**Right side:**
- Product screenshot placeholder (rounded card with border, centered placeholder text)
- Small animated vectorscope accent floating in the corner of the screenshot (60px circle with orbiting dots)

**Animation:**
- Staggered fade-in on page load: headline (0ms) → subtext (100ms) → buttons (200ms) → screenshot (300ms)
- Vectorscope accent dots slowly orbit via CSS keyframes (20s cycle)
- Subtle parallax on the screenshot container (moves slower than scroll)

### Section 2: Value Propositions

Three problem→solution cards stacked vertically, centered on the page.

**Cards:**
1. **Stop guessing at color balance** — "See exactly where your chrominance sits across six professional color spaces. No more eyeballing — know your color is right."
2. **Stay in your editing workflow** — "Runs inside Photoshop and Lightroom Classic. No round-tripping, no exports, no separate windows."
3. **Catch problems before your client does** — "Skin tone line, harmony zones, and density heatmaps reveal color issues invisible to the naked eye."

Each card has: icon (gradient background, rounded), bold heading, description text.

**Animation:**
- Cards stagger in on scroll-enter: card 1 (0ms) → card 2 (100ms) → card 3 (200ms)
- Fade-in + slide-up (translateY 20px → 0)

### Section 3: Feature Showcase

Three alternating-layout feature blocks. Each block has a screenshot placeholder on one side and description on the other, alternating left/right.

**Block 1 (image left):** Color Spaces
- Heading: "Six professional color spaces"
- Description: "YCbCr BT.601 & BT.709, CIE LUV, HSL, and more. Switch instantly."
- Tags: YCbCr 601, YCbCr 709, CIE LUV, HSL
- Screenshot placeholder

**Block 2 (image right):** Density Modes
- Heading: "Three ways to visualize density"
- Description: "Scatter, Heatmap, and Bloom. Each reveals different characteristics of your image's color distribution."
- Screenshot placeholder

**Block 3 (image left):** Color Harmony
- Heading: "Seven harmony zone overlays"
- Description: "Complementary, analogous, triadic, and more. See how your colors relate at a glance."
- Screenshot placeholder

**Animation:**
- Each block slides in from its image side on scroll-enter (left block slides from left, right block slides from right)
- Screenshots scale up subtly on appear (scale 0.95 → 1.0)
- Staggered: image first, then text (100ms delay)

### Section 4: Full-Bleed Product Banner

Full-width product screenshot with floating annotation callouts. Centered layout.

- Eyebrow: "The Complete Picture"
- Heading: "Chromascope in action"
- Large screenshot placeholder (max-width container, rounded, bordered)
- Floating annotation callouts on the screenshot (semi-transparent violet badges with arrows): "YCbCr BT.709", "Heatmap density"
- Subtext below: "Real-time chrominance analysis directly in your editing workflow. No round-tripping, no exports."
- Background: subtle purple radial gradient

**Animation:**
- Screenshot scales in on scroll-enter (scale 1.02 → 1.0)
- Annotation callouts fade in with stagger after the screenshot appears (200ms, 400ms)

### Section 5: Pricing

Keep existing 3-tier pricing layout (Trial, Pro, Pro+AI). Enhancements only:

- Scroll-triggered fade-in animation on the pricing cards
- Enhanced hover states: cards lift (translateY -4px) + glow intensifies
- Subtle animated border glow on the highlighted "Pro" tier (slow pulse)

No structural changes to pricing content or layout.

### Section 6: Final CTA

Dark gradient section with centered call-to-action.

- Heading: "Start analyzing color today"
- Subtext: "14-day free trial. No credit card required."
- Primary CTA button: "Download Free Trial"
- Secondary link: "View documentation"
- Background: large, faded, decorative vectorscope SVG (opacity 0.05, centered behind the CTA)

**Animation:**
- Fade-in on scroll-enter
- Background vectorscope rotates very slowly (60s cycle, CSS keyframe)

---

## Technical Implementation

### Animation System

**No external animation library.** Pure CSS animations + a small Intersection Observer utility.

**New client component: `ScrollReveal`**
- Wraps children with an Intersection Observer
- When element enters viewport, adds a CSS class that triggers the animation
- Configurable: direction (up/left/right), delay, threshold
- Respects `prefers-reduced-motion` — disables all animations when set

**New client component: `AnimatedVectorscope`**
- SVG circle with graticule rings and crosshairs
- 3-5 small colored dots that orbit slowly via CSS `@keyframes` (20s cycle per dot, offset start positions)
- Props: `size`, `className`
- Pure CSS animation, no JS frame loop

**New client component: `CountUp`** (not needed — removed since we dropped the spec strip)

**New component: `ProductScreenshot`**
- Accepts `src` (optional), `alt`, `placeholder` text
- When `src` is not provided, renders a styled placeholder div
- When `src` is provided, renders `next/image` with the screenshot
- Consistent rounded border, background, and shadow treatment

### CSS Additions to `globals.css`

New animation utility classes:
- `.animate-fade-in-up` — opacity 0→1, translateY 20px→0
- `.animate-fade-in-left` — opacity 0→1, translateX -20px→0
- `.animate-fade-in-right` — opacity 0→1, translateX 20px→0
- `.animate-scale-in` — opacity 0→1, scale 0.95→1.0
- `.animate-delay-100` through `.animate-delay-500` — animation-delay utilities
- `@keyframes orbit` — for vectorscope dot rotation
- `@keyframes pulse-border` — for pricing card glow

All animations gated behind `@media (prefers-reduced-motion: no-preference)`.

### File Changes

| File | Change |
|------|--------|
| `apps/web/app/page.tsx` | Rewrite with new 6-section layout |
| `apps/web/app/globals.css` | Add animation keyframes and utility classes |
| `apps/web/components/scroll-reveal.tsx` | New client component (Intersection Observer wrapper) |
| `apps/web/components/animated-vectorscope.tsx` | New client component (SVG with CSS orbit animation) |
| `apps/web/components/product-screenshot.tsx` | New component (image placeholder / next/image) |

### Files NOT Changed

- `apps/web/app/features/page.tsx` — no changes
- `apps/web/app/pricing/page.tsx` — no changes (pricing section is embedded in homepage)
- `apps/web/app/download/page.tsx` — no changes
- `apps/web/app/docs/page.tsx` — no changes
- `apps/web/app/account/page.tsx` — no changes
- `apps/web/components/nav-bar.tsx` — no changes
- `apps/web/components/footer.tsx` — no changes

### Dependencies

No new npm dependencies. All animations are CSS-native + Intersection Observer API.

### Accessibility

- All animations respect `prefers-reduced-motion: reduce` — instantly show final state with no motion
- Screenshot placeholders have descriptive alt text
- Color contrast ratios maintained (violet on dark backgrounds tested)
- Scroll animations don't interfere with keyboard navigation

### Performance

- No animation library added (0 KB bundle impact for animations)
- Intersection Observer is native browser API
- CSS animations are GPU-accelerated (transform, opacity only)
- Product screenshots will use `next/image` with lazy loading when real images are added
- `ScrollReveal` uses `'use client'` but is a thin wrapper — most page content stays as Server Components
