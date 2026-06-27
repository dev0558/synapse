import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  // Fail loud on the server so misconfig is obvious during the demo.
  console.warn("[synapse] GEMINI_API_KEY is not set · agent calls will fail.");
}

// Single shared server-side client. Never import this into client components.
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Pinned, stable model IDs (preview models get deprecated on short notice).
export const MODELS = {
  workhorse: "gemini-2.5-flash",
  cheap: "gemini-2.5-flash-lite",
  deep: "gemini-2.5-pro",
  embedding: "gemini-embedding-001",
} as const;
