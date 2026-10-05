import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LlmProvider } from "./types.ts";

export function createGeminiProvider(apiKey: string, modelName: string): LlmProvider {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for LLM_PROVIDER=gemini.");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
  return {
    label: `gemini:${modelName}`,
    async generate(prompt) {
      const result = await model.generateContent(prompt);
      return (await result.response).text();
    },
  };
}
