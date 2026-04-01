# AI Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a model-agnostic AI backend on Next.js API routes (Vercel) that exposes five endpoints for scene analysis, style matching, natural-language adjustments, smart-fit weighting, and palette extraction — all gated behind Pro+AI license validation and a per-key rate limiter.

**Architecture:** `web/lib/ai/` contains the provider abstraction, AI Gateway cloud implementation, structured system prompts, and rate limiter. Five Next.js App Router route handlers under `web/app/api/ai/` each validate the license tier, check the rate limit, call the provider via `generateText` with `Output.object()`, and return typed JSON.

**Tech Stack:** Next.js 15 App Router, Vercel AI SDK v6 (`ai` package), Zod, Vercel AI Gateway (model string prefix `anthropic/claude-sonnet-4.6`), TypeScript

**Reference docs:**
- Design spec: `docs/superpowers/specs/2026-03-29-vectorscope-plugin-design.md`
- Existing license helper: `web/lib/license.ts`

---

## File Map

```
web/
├── app/api/ai/
│   ├── scene-analyze/route.ts       # POST — scene type, subject, harmony suggestion
│   ├── style-match/route.ts         # POST — HSL/Color Grading/Curves deltas
│   ├── natural-language/route.ts    # POST — adjustment deltas from text prompt
│   ├── smart-fit/route.ts           # POST — per-pixel adjustment weights
│   └── palette-extract/route.ts     # POST — dominant colors + overlay presets
└── lib/
    └── ai/
        ├── provider.ts              # ModelProvider interface + createProvider factory
        ├── cloud-provider.ts        # CloudProvider — AI Gateway via AI SDK generateText
        ├── prompts.ts               # Structured system prompts for each endpoint
        └── rate-limit.ts            # In-memory token bucket keyed by API key
```

---

## Task 1: AI Provider Interface + Cloud Provider

**Files:**
- Create: `web/lib/ai/provider.ts`
- Create: `web/lib/ai/cloud-provider.ts`

- [ ] **Step 1: Define `ModelProvider` interface and types in `provider.ts`**

```typescript
// web/lib/ai/provider.ts
import { z } from 'zod'

export interface ModelOptions {
  temperature?: number
  maxTokens?: number
}

export interface AnalysisResult<T = unknown> {
  data: T
  model: string
  usage: { promptTokens: number; completionTokens: number }
}

export interface ModelProvider {
  analyze<T>(
    image: Buffer,
    prompt: string,
    schema: z.ZodType<T>,
    options?: ModelOptions
  ): Promise<AnalysisResult<T>>
}

export type ProviderType = 'cloud' | 'local'

export function createProvider(type: ProviderType = 'cloud'): ModelProvider {
  if (type === 'cloud') {
    const { CloudProvider } = require('./cloud-provider')
    return new CloudProvider()
  }
  throw new Error(`Provider type "${type}" is not yet implemented`)
}
```

- [ ] **Step 2: Implement `CloudProvider` in `cloud-provider.ts`**

The AI SDK v6 routes plain `"provider/model"` strings through AI Gateway automatically — no wrapper package or custom `baseURL` needed. Auth uses OIDC by default: run `vercel env pull` once to provision `VERCEL_OIDC_TOKEN` locally; on Vercel deployments it is injected automatically. A static key can be supplied as a fallback for CI or non-Vercel environments (see Step 3).

Use `generateText` with `experimental_output: Output.object({ schema })` for structured JSON output. Both imports come from `'ai'`.

```typescript
// web/lib/ai/cloud-provider.ts
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { ModelProvider, ModelOptions, AnalysisResult } from './provider'

const MODEL = 'anthropic/claude-sonnet-4.6'

export class CloudProvider implements ModelProvider {
  async analyze<T>(
    image: Buffer,
    prompt: string,
    schema: z.ZodType<T>,
    options: ModelOptions = {}
  ): Promise<AnalysisResult<T>> {
    const base64 = image.toString('base64')

    const { experimental_output, usage, response } = await generateText({
      // Plain "provider/model" string — AI SDK routes through AI Gateway automatically
      model: MODEL,
      experimental_output: Output.object({ schema }),
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: `data:image/jpeg;base64,${base64}`,
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    return {
      data: experimental_output as T,
      model: response?.modelId ?? MODEL,
      usage: {
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
      },
    }
  }
}
```

- [ ] **Step 3: Configure env vars and AI Gateway auth**

**Preferred (OIDC — zero key rotation):**
```bash
vercel link                        # Connect project to Vercel
# Enable AI Gateway in Vercel dashboard → project settings → AI Gateway
vercel env pull .env.local         # Provisions VERCEL_OIDC_TOKEN (~24h JWT)
```
The `ai` package reads `VERCEL_OIDC_TOKEN` automatically — no code changes needed. Re-run `vercel env pull` when the token expires.

**Alternative (static key — CI / non-Vercel environments):**
Create `web/.env.local.example`:
```
# AI Gateway auth (OIDC is the default and recommended method):
#   vercel link && vercel env pull .env.local   → writes VERCEL_OIDC_TOKEN automatically
#
# For CI / non-Vercel environments only, set a static key instead:
#   VERCEL_AI_GATEWAY_KEY=<your-vercel-ai-gateway-api-key>
```

---

## Task 2: System Prompts

**Files:**
- Create: `web/lib/ai/prompts.ts`

- [ ] **Step 1: Write a structured system prompt for each endpoint**

Each prompt is a plain string exported as a named constant. Prompts instruct the model to output JSON matching the schema defined in the corresponding route.

```typescript
// web/lib/ai/prompts.ts

export const SCENE_ANALYZE_PROMPT = `
You are a professional colorist analyzing a downsampled (256x256) image.
Identify the primary scene type (e.g. portrait, landscape, product, night, indoor, outdoor),
detect the key subjects (e.g. face, sky, foliage, skin tone), and recommend a color harmony
type (complementary, analogous, triadic, split-complementary, tetradic) with a rotation
offset in degrees (0–360) that would best suit the scene.
Respond ONLY with a valid JSON object matching the provided schema.
`.trim()

export const STYLE_MATCH_PROMPT = `
You are a professional colorist. You will receive two images: the current image and a
reference image. Analyze the tonal and color differences and produce the minimal set of
adjustment deltas required to match the current image to the reference image's style.
Express deltas as HSL adjustments (hue shift °, saturation %, lightness %), Color Grading
adjustments (shadows/midtones/highlights per channel), and Curves adjustments
(per-channel anchor points as [input, output] pairs, 0–255).
Respond ONLY with a valid JSON object matching the provided schema.
`.trim()

export const NATURAL_LANGUAGE_PROMPT = `
You are a professional colorist assistant. You will receive the current vectorscope state
(active color space, current adjustments, selected harmony) and a plain-English instruction
from the user. Translate the instruction into precise adjustment deltas for the active edit
mode. Adjustments should be conservative and non-destructive — prefer small targeted changes.
Respond ONLY with a valid JSON object matching the provided schema.
`.trim()

export const SMART_FIT_PROMPT = `
You are a professional colorist. You will receive pixel data from a downsampled image and
a harmony configuration (anchor hue, type, rotation). Compute per-region adjustment weights
(0.0–1.0) that preserve key colors (skin tones, sky, foliage) while nudging other regions
toward the harmony. Return weights as a flat array of 16x16 blocks covering the image
(256 values total).
Respond ONLY with a valid JSON object matching the provided schema.
`.trim()

export const PALETTE_EXTRACT_PROMPT = `
You are a professional colorist. Analyze the downsampled image and extract the dominant
color palette. For each dominant color provide its hex value, a descriptive label, its
approximate coverage percentage, and a suggested grading direction (warm/cool/neutral).
Also suggest up to three vectorscope overlay preset names that complement the palette.
Respond ONLY with a valid JSON object matching the provided schema.
`.trim()
```

---

## Task 3: Rate Limiter

**Files:**
- Create: `web/lib/ai/rate-limit.ts`

- [ ] **Step 1: Implement a simple in-memory token bucket rate limiter**

Keyed by API key string. Limits: 10 requests/minute burst, 100 requests/day. Uses a two-bucket approach (minute + day). The module exports a single `checkRateLimit` function that mutates the in-memory store and returns `{ allowed: boolean; reason?: string }`.

```typescript
// web/lib/ai/rate-limit.ts

const BURST_LIMIT = 10       // per minute
const DAILY_LIMIT = 100      // per day
const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

interface BucketState {
  minuteTokens: number
  minuteLastRefill: number
  dayTokens: number
  dayLastRefill: number
}

// In-memory store — resets on cold start (acceptable for serverless burst protection)
const store = new Map<string, BucketState>()

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  remaining: { minute: number; day: number }
}

export function checkRateLimit(apiKey: string): RateLimitResult {
  const now = Date.now()

  let state = store.get(apiKey)
  if (!state) {
    state = {
      minuteTokens: BURST_LIMIT,
      minuteLastRefill: now,
      dayTokens: DAILY_LIMIT,
      dayLastRefill: now,
    }
  }

  // Refill minute bucket
  if (now - state.minuteLastRefill >= MINUTE_MS) {
    const intervals = Math.floor((now - state.minuteLastRefill) / MINUTE_MS)
    state.minuteTokens = Math.min(BURST_LIMIT, state.minuteTokens + intervals * BURST_LIMIT)
    state.minuteLastRefill = now
  }

  // Refill day bucket
  if (now - state.dayLastRefill >= DAY_MS) {
    state.dayTokens = DAILY_LIMIT
    state.dayLastRefill = now
  }

  if (state.dayTokens <= 0) {
    store.set(apiKey, state)
    return { allowed: false, reason: 'Daily limit reached (100/day)', remaining: { minute: state.minuteTokens, day: 0 } }
  }

  if (state.minuteTokens <= 0) {
    store.set(apiKey, state)
    return { allowed: false, reason: 'Burst limit reached (10/min)', remaining: { minute: 0, day: state.dayTokens } }
  }

  state.minuteTokens -= 1
  state.dayTokens -= 1
  store.set(apiKey, state)

  return {
    allowed: true,
    remaining: { minute: state.minuteTokens, day: state.dayTokens },
  }
}
```

---

## Task 4: Scene Analyze Route

**Files:**
- Create: `web/app/api/ai/scene-analyze/route.ts`

- [ ] **Step 1: Implement `POST /api/ai/scene-analyze`**

Input: `{ image: string }` (base64 JPEG, 256x256). Output: scene type, subjects, suggested harmony type + rotation.

```typescript
// web/app/api/ai/scene-analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateLicense } from '@/lib/license'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { createProvider } from '@/lib/ai/provider'
import { SCENE_ANALYZE_PROMPT } from '@/lib/ai/prompts'

const RequestSchema = z.object({
  image: z.string().min(1, 'image is required'),
  apiKey: z.string().min(1, 'apiKey is required'),
})

const ResponseSchema = z.object({
  sceneType: z.string(),
  subjects: z.array(z.string()),
  harmony: z.object({
    type: z.enum(['complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic']),
    rotationDeg: z.number().min(0).max(360),
  }),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { image, apiKey } = parsed.data

  const license = await validateLicense(apiKey)
  if (!license.valid || !license.features.includes('ai')) {
    return NextResponse.json({ error: 'Pro + AI tier required' }, { status: 403 })
  }

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason, remaining: rateLimit.remaining },
      { status: 429 }
    )
  }

  const imageBuffer = Buffer.from(image, 'base64')
  const provider = createProvider('cloud')
  const result = await provider.analyze(imageBuffer, SCENE_ANALYZE_PROMPT, ResponseSchema)

  return NextResponse.json({
    ...result.data,
    _meta: { model: result.model, usage: result.usage, remaining: rateLimit.remaining },
  })
}
```

---

## Task 5: Style Match Route

**Files:**
- Create: `web/app/api/ai/style-match/route.ts`

- [ ] **Step 1: Implement `POST /api/ai/style-match`**

Input: `{ current: string, reference: string, apiKey: string }` (both base64 256x256 JPEG). Output: adjustment deltas for HSL, Color Grading, and Curves.

This route must send two images in a single call, so it calls `generateText` directly rather than through `CloudProvider` (which has a single-image signature). Auth follows the same OIDC-first resolution as `CloudProvider` — no extra config required.

```typescript
// web/app/api/ai/style-match/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText, Output } from 'ai'
import { validateLicense } from '@/lib/license'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { STYLE_MATCH_PROMPT } from '@/lib/ai/prompts'

// Plain "provider/model" string — AI SDK routes through AI Gateway automatically.
// Auth uses OIDC by default (VERCEL_OIDC_TOKEN via `vercel env pull`); a static key is supported for CI.
const MODEL = 'anthropic/claude-sonnet-4.6'

const RequestSchema = z.object({
  current: z.string().min(1),
  reference: z.string().min(1),
  apiKey: z.string().min(1),
})

const ChannelAdjustment = z.object({ r: z.number(), g: z.number(), b: z.number() })
const CurvePoint = z.tuple([z.number(), z.number()])

const ResponseSchema = z.object({
  hsl: z.object({ hue: z.number(), saturation: z.number(), lightness: z.number() }),
  colorGrading: z.object({
    shadows: ChannelAdjustment,
    midtones: ChannelAdjustment,
    highlights: ChannelAdjustment,
  }),
  curves: z.object({
    r: z.array(CurvePoint),
    g: z.array(CurvePoint),
    b: z.array(CurvePoint),
  }),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { current, reference, apiKey } = parsed.data

  const license = await validateLicense(apiKey)
  if (!license.valid || !license.features.includes('ai')) {
    return NextResponse.json({ error: 'Pro + AI tier required' }, { status: 403 })
  }

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason, remaining: rateLimit.remaining },
      { status: 429 }
    )
  }

  const { experimental_output, usage, response } = await generateText({
    model: MODEL,
    experimental_output: Output.object({ schema: ResponseSchema }),
    temperature: 0.2,
    maxTokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: `data:image/jpeg;base64,${current}` },
          { type: 'image', image: `data:image/jpeg;base64,${reference}` },
          { type: 'text', text: STYLE_MATCH_PROMPT },
        ],
      },
    ],
  })

  return NextResponse.json({
    ...(experimental_output as z.infer<typeof ResponseSchema>),
    _meta: {
      model: response?.modelId ?? MODEL,
      usage: { promptTokens: usage?.promptTokens, completionTokens: usage?.completionTokens },
      remaining: rateLimit.remaining,
    },
  })
}
```

---

## Task 6: Natural Language Route

**Files:**
- Create: `web/app/api/ai/natural-language/route.ts`

- [ ] **Step 1: Implement `POST /api/ai/natural-language`**

Input: `{ state: VectorscopeState, prompt: string, apiKey: string }`. Output: adjustment deltas keyed to the active edit mode.

```typescript
// web/app/api/ai/natural-language/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProvider } from '@/lib/ai/provider'
import { validateLicense } from '@/lib/license'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { NATURAL_LANGUAGE_PROMPT } from '@/lib/ai/prompts'

const VectorscopeStateSchema = z.object({
  colorSpace: z.enum(['YCbCr', 'CIE_LUV', 'HSL']),
  editMode: z.string(),
  currentAdjustments: z.record(z.number()),
  harmony: z.object({ type: z.string(), rotationDeg: z.number() }).optional(),
})

const RequestSchema = z.object({
  state: VectorscopeStateSchema,
  prompt: z.string().min(1),
  apiKey: z.string().min(1),
})

const ResponseSchema = z.object({
  adjustments: z.record(z.number()),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { state, prompt, apiKey } = parsed.data

  const license = await validateLicense(apiKey)
  if (!license.valid || !license.features.includes('ai')) {
    return NextResponse.json({ error: 'Pro + AI tier required' }, { status: 403 })
  }

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason, remaining: rateLimit.remaining },
      { status: 429 }
    )
  }

  const contextPrompt = `${NATURAL_LANGUAGE_PROMPT}\n\nCurrent state:\n${JSON.stringify(state, null, 2)}\n\nUser instruction: ${prompt}`
  // No image for this endpoint — use a 1x1 transparent placeholder
  const placeholder = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAIBAAAgIBBQEBAAAAAAAAAAAAAQIDBAUREiExQf/aAAgBAQAAPwCwAB4zvf8Ax//Z',
    'base64'
  )

  const provider = createProvider('cloud')
  const result = await provider.analyze(placeholder, contextPrompt, ResponseSchema)

  return NextResponse.json({
    ...result.data,
    _meta: { model: result.model, usage: result.usage, remaining: rateLimit.remaining },
  })
}
```

---

## Task 7: Smart Fit Route

**Files:**
- Create: `web/app/api/ai/smart-fit/route.ts`

- [ ] **Step 1: Implement `POST /api/ai/smart-fit`**

Input: `{ image: string, harmony: HarmonyConfig, apiKey: string }`. Output: 256 per-block adjustment weights (16x16 grid) plus a list of preserved key color regions.

```typescript
// web/app/api/ai/smart-fit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProvider } from '@/lib/ai/provider'
import { validateLicense } from '@/lib/license'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { SMART_FIT_PROMPT } from '@/lib/ai/prompts'

const HarmonyConfigSchema = z.object({
  anchorHue: z.number().min(0).max(360),
  type: z.enum(['complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic']),
  rotationDeg: z.number().min(0).max(360),
})

const RequestSchema = z.object({
  image: z.string().min(1),
  harmony: HarmonyConfigSchema,
  apiKey: z.string().min(1),
})

const ResponseSchema = z.object({
  weights: z.array(z.number().min(0).max(1)).length(256),
  preservedRegions: z.array(
    z.object({
      label: z.string(),
      blockIndices: z.array(z.number()),
    })
  ),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { image, harmony, apiKey } = parsed.data

  const license = await validateLicense(apiKey)
  if (!license.valid || !license.features.includes('ai')) {
    return NextResponse.json({ error: 'Pro + AI tier required' }, { status: 403 })
  }

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason, remaining: rateLimit.remaining },
      { status: 429 }
    )
  }

  const contextPrompt = `${SMART_FIT_PROMPT}\n\nHarmony config:\n${JSON.stringify(harmony, null, 2)}`
  const imageBuffer = Buffer.from(image, 'base64')
  const provider = createProvider('cloud')
  const result = await provider.analyze(imageBuffer, contextPrompt, ResponseSchema)

  return NextResponse.json({
    ...result.data,
    _meta: { model: result.model, usage: result.usage, remaining: rateLimit.remaining },
  })
}
```

---

## Task 8: Palette Extract Route

**Files:**
- Create: `web/app/api/ai/palette-extract/route.ts`

- [ ] **Step 1: Implement `POST /api/ai/palette-extract`**

Input: `{ image: string, apiKey: string }` (base64 256x256). Output: dominant colors, grading directions, overlay presets.

```typescript
// web/app/api/ai/palette-extract/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProvider } from '@/lib/ai/provider'
import { validateLicense } from '@/lib/license'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { PALETTE_EXTRACT_PROMPT } from '@/lib/ai/prompts'

const RequestSchema = z.object({
  image: z.string().min(1),
  apiKey: z.string().min(1),
})

const ResponseSchema = z.object({
  dominantColors: z.array(
    z.object({
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      label: z.string(),
      coveragePct: z.number().min(0).max(100),
      gradingDirection: z.enum(['warm', 'cool', 'neutral']),
    })
  ),
  overlayPresets: z.array(z.string()).max(3),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { image, apiKey } = parsed.data

  const license = await validateLicense(apiKey)
  if (!license.valid || !license.features.includes('ai')) {
    return NextResponse.json({ error: 'Pro + AI tier required' }, { status: 403 })
  }

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason, remaining: rateLimit.remaining },
      { status: 429 }
    )
  }

  const imageBuffer = Buffer.from(image, 'base64')
  const provider = createProvider('cloud')
  const result = await provider.analyze(imageBuffer, PALETTE_EXTRACT_PROMPT, ResponseSchema)

  return NextResponse.json({
    ...result.data,
    _meta: { model: result.model, usage: result.usage, remaining: rateLimit.remaining },
  })
}
```

---

## Task 9: Verification

- [ ] **Step 1: Confirm all files exist**

```bash
ls web/lib/ai/
# Expected: provider.ts  cloud-provider.ts  prompts.ts  rate-limit.ts

ls web/app/api/ai/
# Expected: scene-analyze/  style-match/  natural-language/  smart-fit/  palette-extract/
```

- [ ] **Step 2: TypeScript type-check**

```bash
cd web && npx tsc --noEmit
```

No errors expected. If `@ai-sdk/openai` is missing, install it:

```bash
pnpm add ai @ai-sdk/openai zod --filter web
```

- [ ] **Step 3: Smoke-test scene-analyze locally**

Start dev server and send a minimal POST request with a 256x256 base64 JPEG and a valid test API key that has the `ai` feature flag set in `lib/license.ts`.

```bash
curl -X POST http://localhost:3000/api/ai/scene-analyze \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64>","apiKey":"<test-key>"}'
```

Expected response shape:

```json
{
  "sceneType": "...",
  "subjects": ["..."],
  "harmony": { "type": "...", "rotationDeg": 0 },
  "_meta": { "model": "...", "usage": { ... }, "remaining": { ... } }
}
```

- [ ] **Step 4: Verify rate limiter rejects on burst**

Send 11 rapid requests to any endpoint with the same API key. The 11th should return HTTP 429 with `"Burst limit reached (10/min)"`.

- [ ] **Step 5: Verify license gate rejects non-AI tier**

Call any endpoint with an API key that does not have the `ai` feature. Expect HTTP 403 with `"Pro + AI tier required"`.

---

## Notes

- **Zero retention:** The routes never write image data to disk, database, or logs. `Buffer.from(image, 'base64')` is heap-only and garbage-collected after the request.
- **Image size enforcement:** The spec mandates 256x256 downsamples. Enforcement (reject oversized payloads) can be added by checking `imageBuffer.byteLength > 256 * 256 * 4` before calling the provider.
- **LocalProvider:** Reserved for future implementation when users can supply a local model endpoint URL. `createProvider('local')` currently throws; a `LocalProvider` class can be added to `lib/ai/` without changing any route code.
- **AI Gateway model string:** `'anthropic/claude-sonnet-4.6'` is used throughout. To swap models (e.g. for cost or speed), update the string in `cloud-provider.ts` only — routes are model-agnostic.

---

## Future: FOSS + BYOM (Bring Your Own Model)

> **Status:** Planned — do not implement yet.

Chromascope will be fully open-sourced (FOSS) with the exception of the cloud AI backend hosted on Vercel. The cloud AI endpoints above will remain a hosted convenience service, but users will have two self-service alternatives:

### 1. Local Model Connection

Users can point the plugin at a local model server (Ollama, llama.cpp, LM Studio, vLLM, etc.) running on their machine or LAN. The `LocalProvider` class (currently a stub in `provider.ts`) will:

- Accept a base URL (e.g. `http://localhost:11434/v1`) configured in plugin settings
- Use the same `ModelProvider` interface — no route changes needed
- Support any OpenAI-compatible chat/completions API
- Run entirely offline with zero data leaving the user's machine

### 2. Bring Your Own API Key

Users can supply their own API key for any supported cloud provider (OpenAI, Anthropic, Google, etc.) and hit the provider directly from the plugin — bypassing the Chromascope cloud backend entirely. This means:

- No Chromascope license required for AI features
- No rate limits imposed by Chromascope
- User pays their own provider costs
- The `createProvider()` factory gains a `'byokey'` type that configures a direct provider connection with the user's credentials

### Licensing Implications

- The core library, plugins, and all rendering/analysis code will be FOSS (license TBD — likely MIT or AGPLv3)
- The cloud AI backend (`web/app/api/ai/*`) will be open-source too, but the *hosted instance* on Vercel is the commercial offering (convenience, no setup, managed rate limits)
- License tiers (trial/pro/pro_ai) apply only to the hosted cloud service — self-hosted users are unrestricted
- The `ModelProvider` interface is the abstraction boundary: cloud, local, and BYOK providers all implement it identically
