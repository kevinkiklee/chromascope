// apps/web/app/api/ai/style-match/route.ts
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

  const result = await generateText({
    model: MODEL,
    output: Output.object({ schema: ResponseSchema }),
    temperature: 0.2,
    maxOutputTokens: 1024,
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
    ...(result.output as z.infer<typeof ResponseSchema>),
    _meta: {
      model: result.response?.modelId ?? MODEL,
      usage: { promptTokens: result.usage?.promptTokens, completionTokens: result.usage?.completionTokens },
      remaining: rateLimit.remaining,
    },
  })
}
