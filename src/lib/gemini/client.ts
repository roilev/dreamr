import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

function resolveApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (!key) {
    throw new Error(
      "[gemini] Neither GEMINI_API_KEY nor GOOGLE_API_KEY is set. " +
      "Add one to .env.local (or your hosting platform's env vars).",
    );
  }
  return key;
}

export function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: resolveApiKey() });
  }
  return _ai;
}

export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    return (getAI() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
