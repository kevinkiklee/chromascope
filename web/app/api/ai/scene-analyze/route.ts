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
