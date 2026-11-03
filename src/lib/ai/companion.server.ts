import { createOpenAI } from "@ai-sdk/openai";

// Gemini exposes an OpenAI-compatible endpoint, so any OpenAI-compatible provider
// (Gemini, Groq, OpenRouter) works by changing AI_BASE_URL and AI_MODEL.
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// A non-thinking "lite" model keeps distress replies to a couple of seconds.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export function companionConfig() {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;
  return {
    apiKey,
    baseURL: process.env["AI_BASE_URL"] ?? GEMINI_BASE_URL,
    model: process.env["AI_MODEL"] ?? DEFAULT_MODEL,
  };
}

export function companionModel(config: NonNullable<ReturnType<typeof companionConfig>>) {
  return createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey }).chat(config.model);
}
