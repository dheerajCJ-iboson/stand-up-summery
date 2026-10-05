import { load } from "@std/dotenv";

// Load .env file if it exists
await load({ export: true });

export function defaultModelFor(provider: string): string {
  switch (provider) {
    case "ollama":
      return "gemma4:31b-cloud";
    case "openai":
      return "gpt-4o-mini";
    default:
      return "gemini-2.5-flash";
  }
}

const provider = (Deno.env.get("LLM_PROVIDER") || "gemini").toLowerCase();
const fallbackProvider = (Deno.env.get("LLM_FALLBACK_PROVIDER") || "").toLowerCase();

export const config = {
  geminiApiKey: Deno.env.get("GEMINI_API_KEY") || "",
  defaultAuthor: Deno.env.get("DEFAULT_GIT_AUTHOR") || "Dheeraj C Justine <dheeraj.justine@ibosoninnov.com>",
  defaultRepoPath: Deno.env.get("DEFAULT_REPO_PATH") || ".",
  llm: {
    provider,
    model: Deno.env.get("LLM_MODEL") || defaultModelFor(provider),
    fallback: fallbackProvider
      ? {
        provider: fallbackProvider,
        model: Deno.env.get("LLM_FALLBACK_MODEL") || defaultModelFor(fallbackProvider),
      }
      : undefined,
  },
  ollama: {
    host: Deno.env.get("OLLAMA_HOST") || "http://localhost:11434",
    apiKey: Deno.env.get("OLLAMA_API_KEY") || undefined,
  },
  openai: {
    baseUrl: Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1",
    apiKey: Deno.env.get("OPENAI_API_KEY") || "",
  },
  diffChars: Number(Deno.env.get("DIFF_CHARS")) || 1200,
  verify: Deno.env.get("VERIFY") === "true",
  usePrs: Deno.env.get("USE_GH_PRS") === "true",
  defaultFormat: Deno.env.get("OUTPUT_FORMAT") || "markdown",
  slackWebhook: Deno.env.get("SLACK_WEBHOOK_URL") || "",
};

if (config.llm.provider === "gemini" && !config.geminiApiKey) {
  console.warn("⚠️  GEMINI_API_KEY is not set in environment or .env file.");
}
