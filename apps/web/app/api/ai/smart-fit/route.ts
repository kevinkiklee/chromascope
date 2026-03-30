// apps/web/app/api/ai/smart-fit/route.ts
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
