import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

let openaiClient: OpenAI | null = null;

function requireOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. AI-powered plan generation requires this environment variable.",
    );
  }
  return apiKey;
}

export function getOpenAI(): OpenAI {
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: requireOpenAIApiKey(),
  });
  return openaiClient;
}

export const MODELS = {
  fast: process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini",
  smart: process.env.OPENAI_MODEL_SMART ?? "gpt-4o",
} as const;

export type ModelTier = keyof typeof MODELS;

export { zodResponseFormat };
