// src/ai/ai-instance.ts

import { googleAI } from "@genkit-ai/google-genai";
import { genkit } from "genkit";

/**
 * Instância principal do Genkit configurada com Google AI (Gemini).
 * 
 * Se quiser adicionar outros provedores (OpenAI, Anthropic, etc.),
 * basta colocar no array de plugins.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-1.5-flash", {
    temperature: 0.8,
  }),
});
