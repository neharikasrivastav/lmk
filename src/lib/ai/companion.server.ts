import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";

// Gemini exposes an OpenAI-compatible endpoint, so any OpenAI-compatible provider
// (Gemini, Groq, OpenRouter) works by changing AI_BASE_URL and AI_MODEL.
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// A non-thinking "lite" model keeps distress replies to about a second.
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export function companionConfig() {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL: process.env["AI_BASE_URL"] ?? GEMINI_BASE_URL,
    model: process.env["AI_MODEL"] ?? DEFAULT_MODEL,
  };
}

export async function companionReply(
  config: NonNullable<ReturnType<typeof companionConfig>>,
  messages: ModelMessage[],
  instructions: string,
) {
  const provider = createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
  const { text } = await generateText({
    model: provider.chat(config.model),
    instructions,
    messages,
    maxRetries: 0,
    maxOutputTokens: 300,
    abortSignal: AbortSignal.timeout(10000),
  });
  return text;
}
