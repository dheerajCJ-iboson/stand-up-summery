import { createLlmProvider } from "./llm/index.ts";
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

  const llm = createLlmProvider();

  const byApp = new Map<string, CommitInfo[]>();
  for (const c of commits) {
    if (c.isMerge) continue;
    byApp.set(c.appName, [...(byApp.get(c.appName) ?? []), c]);
  }

  const commitData = [...byApp.entries()]
    .map(([app, list]) => {
      const lines = list.map((c) => {
        const areas = c.areas.length ? ` | areas: ${c.areas.join(", ")}` : "";
        const files = c.files.length ? `\n    files: ${c.files.join(", ")}` : "";
        return `  - ${c.subject}${areas}${files}`;
      });
      return `## APP: ${app}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  const prompt = STANDUP_PROMPT_TEMPLATE(commitData, date);

  try {
    return await retryWithBackoff(() => llm.generate(prompt), 10, 1000);
  } catch (error) {
    if (error instanceof Error) {
      return `Error generating summary from LLM: ${error.message}`;
    }
    return "An unknown error occurred while calling the LLM API.";
  }
}
