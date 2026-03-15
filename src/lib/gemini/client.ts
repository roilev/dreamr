import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    if (!key) {
      throw new Error(
        "[gemini] Neither GEMINI_API_KEY nor GOOGLE_API_KEY is set. " +
        "Add one to .env.local (or your hosting platform's env vars).",
      );
    }
    console.log(`[gemini] Initializing client (key length: ${key.length})`);
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}
