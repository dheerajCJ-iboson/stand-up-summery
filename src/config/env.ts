import { load } from "@std/dotenv";

// Load .env file if it exists
await load({ export: true });

export const config = {
  geminiApiKey: Deno.env.get("GEMINI_API_KEY") || "",
  defaultAuthor: Deno.env.get("DEFAULT_GIT_AUTHOR") || "Dheeraj C Justine <dheeraj.justine@ibosoninnov.com>",
  defaultRepoPath: Deno.env.get("DEFAULT_REPO_PATH") || ".",
  modelName: "gemini-2.5-flash",
};

if (!config.geminiApiKey) {
  console.warn("⚠️  GEMINI_API_KEY is not set in environment or .env file.");
}
