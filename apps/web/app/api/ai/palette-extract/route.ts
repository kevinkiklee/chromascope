// apps/web/app/api/ai/palette-extract/route.ts
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
