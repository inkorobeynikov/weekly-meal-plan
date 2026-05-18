import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const MODELS = {
  fast: process.env.OPENAI_MODEL_FAST ?? 'gpt-4o-mini',
  smart: process.env.OPENAI_MODEL_SMART ?? 'gpt-4o',
} as const

export type ModelTier = keyof typeof MODELS
