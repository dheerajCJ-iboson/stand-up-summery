import { config } from "../config/env.ts";
import { createGeminiProvider } from "./gemini.ts";
import { createOllamaProvider } from "./ollama.ts";
import { createOpenAiProvider } from "./openai.ts";
import type { LlmProvider } from "./types.ts";

export type { LlmProvider } from "./types.ts";

export function createLlmProvider(
  provider = config.llm.provider,
  model = config.llm.model,
): LlmProvider {
  switch (provider) {
    case "gemini":
      return createGeminiProvider(config.geminiApiKey, model);
    case "ollama":
      return createOllamaProvider(config.ollama.host, model, config.ollama.apiKey);
    case "openai":
      return createOpenAiProvider(config.openai.baseUrl, model, config.openai.apiKey);
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider}". Use one of: gemini, ollama, openai.`,
      );
  }
}
