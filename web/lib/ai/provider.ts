// web/lib/ai/provider.ts
import { z } from 'zod'

export interface ModelOptions {
  temperature?: number
  maxTokens?: number
}

export interface AnalysisResult<T = unknown> {
  data: T
  model: string
  usage: { inputTokens: number; outputTokens: number }
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
