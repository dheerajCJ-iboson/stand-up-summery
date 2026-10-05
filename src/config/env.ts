import { load } from "@std/dotenv";

// Load .env file if it exists
await load({ export: true });

const provider = (Deno.env.get("LLM_PROVIDER") || "gemini").toLowerCase();
const defaultModel = provider === "ollama"
  ? "gemma4:31b-cloud"
  : provider === "openai"
  ? "gpt-4o-mini"
  : "gemini-2.5-flash";

export const config = {
  geminiApiKey: Deno.env.get("GEMINI_API_KEY") || "",
  defaultAuthor: Deno.env.get("DEFAULT_GIT_AUTHOR") || "Dheeraj C Justine <dheeraj.justine@ibosoninnov.com>",
  defaultRepoPath: Deno.env.get("DEFAULT_REPO_PATH") || ".",
  llm: {
    provider: (Deno.env.get("LLM_PROVIDER") || "gemini").toLowerCase(),
    model: Deno.env.get("LLM_MODEL") || defaultModel,
  },
  ollama: {
    host: Deno.env.get("OLLAMA_HOST") || "http://localhost:11434",
    apiKey: Deno.env.get("OLLAMA_API_KEY") || undefined,
  },
  openai: {
    baseUrl: Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1",
    apiKey: Deno.env.get("OPENAI_API_KEY") || "",
  },
};

if (config.llm.provider === "gemini" && !config.geminiApiKey) {
  console.warn("⚠️  GEMINI_API_KEY is not set in environment or .env file.");
}
