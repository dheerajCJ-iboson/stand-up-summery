import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config/env.ts";
import { CommitInfo } from "./git.ts";
import { STANDUP_PROMPT_TEMPLATE } from "./config/prompts.ts";

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number,
  initialDelayMs: number,
): Promise<T> {
  let attempt = 0;
  let delayMs = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

export async function generateStandupSummary(
  commits: CommitInfo[],
  date: string,
): Promise<string> {
  if (commits.length === 0) {
    return "No commits found for the specified date and author.";
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: config.modelName });

  const commitData = commits
    .map((c) => {
      const branches = c.branches.length ? ` [${c.branches.join(", ")}]` : "";
      return `- ${c.repoName}: ${c.subject}${branches}`;
    })
    .join("\n");

  const prompt = STANDUP_PROMPT_TEMPLATE(commitData, date);

  try {
    const result = await retryWithBackoff(
      () => model.generateContent(prompt),
      10,
      1000,
    );
    const response = await result.response;
    return response.text();
  } catch (error) {
    if (error instanceof Error) {
      return `Error generating summary from Gemini: ${error.message}`;
    }
    return "An unknown error occurred while calling Gemini API.";
  }
}
