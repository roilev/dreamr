import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("[gemini] GEMINI_API_KEY is not set — Gemini image generation will fail at runtime");
}

export const ai = new GoogleGenAI({ apiKey: apiKey ?? "" });
