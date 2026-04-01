// web/app/api/ai/natural-language/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProvider } from '@/lib/ai/provider'
import { validateLicense } from '@/lib/license'
import { checkRateLimit } from '@/lib/ai/rate-limit'
import { NATURAL_LANGUAGE_PROMPT } from '@/lib/ai/prompts'

const ChromascopeStateSchema = z.object({
  colorSpace: z.enum(['YCbCr', 'CIE_LUV', 'HSL']),
  editMode: z.string(),
  currentAdjustments: z.record(z.number()),
  harmony: z.object({ type: z.string(), rotationDeg: z.number() }).optional(),
})

const RequestSchema = z.object({
  state: ChromascopeStateSchema,
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
