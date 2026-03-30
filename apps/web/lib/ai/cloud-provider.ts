// apps/web/lib/ai/cloud-provider.ts
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

    const result = await generateText({
      // Plain "provider/model" string — AI SDK routes through AI Gateway automatically
      model: MODEL,
      output: Output.object({ schema }),
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 1024,
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
      data: result.output as T,
      model: result.response?.modelId ?? MODEL,
      usage: {
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
      },
    }
  }
}
