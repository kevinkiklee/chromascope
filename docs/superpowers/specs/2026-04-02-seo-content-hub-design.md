# SEO Content Hub -- Design Spec

**Date:** 2026-04-02
**Status:** Approved

---

## Overview

Add comprehensive SEO infrastructure to the Chromascope marketing site and build a photography-focused content hub at `/guides/` with 10 keyword-targeted articles. The goal is to rank for vectorscope-related searches across educational, workflow, and tool-comparison intents, driving traffic from both hobbyist and professional photographers.

**Canonical domain:** `https://chromascope.iser.io`

---

## 1. SEO Infrastructure (All Pages)

### Head tags added to every HTML page

- `<link rel="canonical" href="https://chromascope.iser.io/...">` -- exact URL
- `<meta name="robots" content="index, follow">`
- `<meta property="og:title">` -- unique per page
- `<meta property="og:description">` -- unique per page
- `<meta property="og:image" content="https://chromascope.iser.io/images/og-preview.jpg">`
- `<meta property="og:url">` -- canonical URL
- `<meta property="og:type">` -- "website" for homepage, "article" for guides
- `<meta name="twitter:card" content="summary_large_image">`
- `<meta name="twitter:title">`, `<meta name="twitter:description">`, `<meta name="twitter:image">`
- `<link rel="preconnect" href="https://fonts.googleapis.com">`
- `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`

### OG preview image

A single reusable image at `web/images/og-preview.jpg` -- the colorwheel vectorscope render on dark background with "Chromascope" wordmark. 1200x630px (Facebook/Twitter recommended). Used site-wide.

### New root files

- `web/robots.txt` -- allows all crawlers, references sitemap
- `web/sitemap.xml` -- lists all pages with `<lastmod>` dates

### Structured data (JSON-LD)

| Page type | Schema |
|-----------|--------|
| Homepage | `WebSite` + `SoftwareApplication` (name, description, operatingSystem, applicationCategory, offers: free, url) |
| Docs pages | `BreadcrumbList` (Home > Docs > Photoshop/Lightroom) |
| Guide index | `BreadcrumbList` (Home > Guides) + `CollectionPage` |
| Guide articles | `Article` (headline, description, datePublished, author, image) + `BreadcrumbList` (Home > Guides > Title) |

---

## 2. Navigation Update

Add "Guides" to the nav and footer of **every** page on the site (5 existing + all new).

**Nav order:** Logo | Download | Docs | Guides | GitHub | [Download CTA]

**Footer:** Same link row with Guides added.

---

## 3. Content Hub Structure

### URL pattern

```
/guides/                              -- index page (card grid of all guides)
/guides/what-is-a-vectorscope/        -- individual article
/guides/how-to-read-a-vectorscope/
...etc
```

Each article is a directory with `index.html` inside, matching the existing site pattern.

### Guide index page (`/guides/index.html`)

- Card grid listing all guides
- Each card: title, one-line description, category tag, thumbnail
- Categories: "Color Theory", "Workflow", "Chromascope"
- Sorted by category cluster, not date

### Article template

- Same nav/footer/theme as all other pages
- Breadcrumb below nav: `Home > Guides > Article Title`
- Left sidebar: table of contents from H2 headings (same pattern as Photoshop/Lightroom manual pages)
- Content area: max-width prose column, same typography as docs
- Consistent dark theme, zinc color tokens, same font stack

### Visuals per article

Generated from the `processor render` binary using crafted RGB data. No stock photos, no AI images. Stored in `web/guides/<slug>/images/`.

Types of visuals:
- Annotated vectorscope renders (arrows, labels overlaid)
- Before/after vectorscope pairs (different color treatments of same scene)
- Harmony overlay examples (triadic, complementary, analogous on real data)
- Density mode comparisons (scatter vs bloom of same input)

---

## 4. Article Plan (10 articles, 3 clusters)

### Cluster 1: Educational (high-volume informational keywords)

| # | Title | Primary keyword | Slug |
|---|-------|----------------|------|
| 1 | What Is a Vectorscope and Why Photographers Should Use One | what is a vectorscope photography | `what-is-a-vectorscope` |
| 2 | How to Read a Vectorscope: A Photographer's Guide | how to read a vectorscope | `how-to-read-a-vectorscope` |
| 3 | Understanding Color Harmony in Photography | color harmony photography | `color-harmony-photography` |

### Cluster 2: Workflow (mid-volume, high-intent)

| # | Title | Primary keyword | Slug |
|---|-------|----------------|------|
| 4 | Skin Tone Correction Using a Vectorscope | skin tone vectorscope | `skin-tone-correction` |
| 5 | Color Grading Portraits with a Vectorscope | color grading portraits photography | `color-grading-portraits` |
| 6 | White Balance and the Vectorscope: Getting Neutral Right | white balance vectorscope | `white-balance-vectorscope` |

### Cluster 3: Tool-specific (lower volume, highest conversion)

| # | Title | Primary keyword | Slug |
|---|-------|----------------|------|
| 7 | How to Use Chromascope in Lightroom Classic | vectorscope plugin lightroom classic | `chromascope-lightroom` |
| 8 | How to Use Chromascope in Photoshop | vectorscope plugin photoshop | `chromascope-photoshop` |
| 9 | Scatter vs Bloom: Choosing the Right Vectorscope Display Mode | vectorscope display modes | `scatter-vs-bloom` |
| 10 | Free Vectorscope Tools for Photographers: What's Available | free vectorscope photography | `free-vectorscope-tools` |

### Content guidelines

- Professional, factual tone. No hype, no filler, no AI slop.
- Every claim is accurate to how vectorscopes and color science actually work.
- Articles teach something concrete -- a concept, a skill, or a decision framework.
- Each article links naturally to Chromascope where relevant, but doesn't force it.
- Internal links between articles within the same cluster and across clusters where topically relevant.
- 800-1500 words per article. Long enough to be thorough, short enough to respect the reader's time.

### Visual requirements per article

| # | Visuals needed |
|---|---------------|
| 1 | Annotated vectorscope diagram (axes, rings, hue positions). Neutral vs color-cast comparison. |
| 2 | 4-5 vectorscope renders: neutral, warm, cool, oversaturated, color cast. Annotated. |
| 3 | Vectorscope renders with complementary, triadic, analogous overlays on different source data. |
| 4 | Portrait scope with skin tone cluster vs reference line. Before/after green-shift fix. |
| 5 | Workflow sequence: original scope, after WB, after harmony overlay, after push. |
| 6 | Neutral scene centered, warm cast shifted, corrected back to center. |
| 7 | Screenshots of Lightroom dialog. Scope responding to slider changes. |
| 8 | Screenshots of Photoshop panel. |
| 9 | Same image in scatter and bloom side-by-side with annotations. |
| 10 | Chromascope vectorscope render. Factual comparison text only -- no fake competitor screenshots. |

---

## 5. Performance

- Add `<link rel="preconnect">` for Google Fonts and Tailwind CDN on all pages
- Add `font-display: swap` for web fonts (in CSS)
- Article images: JPEG, max 800px wide, quality 80. Lazy-loaded with `loading="lazy"` except first image.
- All images get descriptive `alt` text with keyword-relevant descriptions.

---

## 6. File Structure (final state)

```
web/
  robots.txt                          NEW
  sitemap.xml                         NEW
  images/
    og-preview.jpg                    NEW (social share image)
  index.html                          MODIFIED (nav, SEO tags, structured data)
  download/index.html                 MODIFIED (nav, SEO tags)
  docs/index.html                     MODIFIED (nav, SEO tags, structured data)
  docs/photoshop/index.html           MODIFIED (nav, SEO tags, structured data)
  docs/lightroom/index.html           MODIFIED (nav, SEO tags, structured data)
  guides/
    index.html                        NEW (guide listing page)
    what-is-a-vectorscope/
      index.html                      NEW
      images/                         NEW (vectorscope renders)
    how-to-read-a-vectorscope/
      index.html                      NEW
      images/
    color-harmony-photography/
      index.html                      NEW
      images/
    skin-tone-correction/
      index.html                      NEW
      images/
    color-grading-portraits/
      index.html                      NEW
      images/
    white-balance-vectorscope/
      index.html                      NEW
      images/
    chromascope-lightroom/
      index.html                      NEW
      images/
    chromascope-photoshop/
      index.html                      NEW
      images/
    scatter-vs-bloom/
      index.html                      NEW
      images/
    free-vectorscope-tools/
      index.html                      NEW
      images/
```

---

## 7. Internal Linking Strategy

- Every guide links to 2-3 other guides within the body text (contextual, not a "related articles" block)
- Every guide links to the download page where mentioning Chromascope
- Guide index page is linked from main nav on every page
- Docs pages link to relevant guides (e.g., Lightroom manual links to the "How to Use Chromascope in Lightroom Classic" guide)
- Homepage value props link to relevant educational guides
