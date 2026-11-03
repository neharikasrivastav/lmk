import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// A non-thinking "lite" model keeps distress replies to a couple of seconds.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export function companionConfig() {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;
  return {
    apiKey,
    // Optional OpenAI-compatible endpoint (Groq, OpenRouter, …); Gemini is used natively otherwise.
    baseURL: process.env["AI_BASE_URL"] ?? null,
    model: process.env["AI_MODEL"] ?? DEFAULT_MODEL,
  };
}

export function companionModel(config: NonNullable<ReturnType<typeof companionConfig>>) {
  // Gemini 3 tool calling needs its thought signatures passed back between steps, which
  // only the native provider does; the OpenAI-compatible endpoint drops them.
  if (!config.baseURL) return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
  return createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey }).chat(config.model);
}
