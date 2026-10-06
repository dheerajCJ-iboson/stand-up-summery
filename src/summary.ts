import { config } from "./config/env.ts";
import { dayCount, DateRange, rangeLabel, splitRange, toIso } from "./dates.ts";
import {
  CHUNK_PROMPT_TEMPLATE,
  ROLLUP_PROMPT_TEMPLATE,
  STANDUP_PROMPT_TEMPLATE,
  VERIFY_PROMPT_TEMPLATE,
} from "./config/prompts.ts";
import type { GitData } from "./git.ts";
import { createLlmProvider } from "./llm/index.ts";

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
      if (attempt > retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

/** Runs the prompt on the primary provider, then on the fallback (if configured). */
async function generate(prompt: string): Promise<string> {
  const attempts = [{ provider: config.llm.provider, model: config.llm.model }];
  if (config.llm.fallback) attempts.push(config.llm.fallback);

  let lastError: unknown;
  for (const [i, a] of attempts.entries()) {
    try {
      const llm = createLlmProvider(a.provider, a.model);
      if (i > 0) console.warn(`↪️  Falling back to ${llm.label}`);
      const text = await retryWithBackoff(() => llm.generate(prompt), 3, 1000);
      if (!text.trim()) throw new Error("LLM returned an empty response.");
      return text.trim();
    } catch (error) {
      lastError = error;
      console.warn(`⚠️  ${a.provider}:${a.model} failed: ${(error as Error).message}`);
    }
  }
  throw new Error(`All LLM providers failed. Last error: ${(lastError as Error)?.message}`);
}

function buildEvidence(data: GitData) {
  const byApp = new Map<string, GitData["commits"]>();
  for (const c of data.commits) byApp.set(c.appName, [...(byApp.get(c.appName) ?? []), c]);

  const commitData = [...byApp.entries()]
    .map(([app, list]) => {
      const lines = list.map((c) => {
        const meta = [
          c.date,
          c.tickets.length ? `tickets: ${c.tickets.join(", ")}` : "",
          c.branches.length ? `branch: ${c.branches.slice(0, 3).join(", ")}` : "",
          c.areas.length ? `areas: ${c.areas.join(", ")}` : "",
        ].filter(Boolean).join(" | ");
        const files = c.files.length ? `\n    files: ${c.files.join(", ")}` : "";
        const diff = c.diff ? `\n    diff:\n${c.diff.split("\n").map((l) => `      ${l}`).join("\n")}` : "";
        return `  - ${c.subject}\n    ${meta}${files}${diff}`;
      });
      return `## APP: ${app}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  const inProgressData = data.inProgress
    .map((w) => `- ${w.appName} (branch ${w.branch}): ${w.files.join(", ")}`)
    .join("\n");
  const prData = data.prs
    .map((p) => `- ${p.appName} [${p.state}] ${p.title} (branch ${p.branch})`)
    .join("\n");

  return { commitData, inProgressData, prData };
}

export async function generateStandupSummary(
  data: GitData,
  label: string,
  options: { previousSummary?: string; verify?: boolean } = {},
): Promise<string> {
  const evidence = buildEvidence(data);
  const draft = await generate(
    STANDUP_PROMPT_TEMPLATE({ label, ...evidence, previousSummary: options.previousSummary }),
  );
  if (!options.verify) return draft;

  console.log("🔍 Verifying summary against commits...");
  const all = [
    evidence.commitData,
    evidence.inProgressData && `In progress:\n${evidence.inProgressData}`,
    evidence.prData && `Pull requests:\n${evidence.prData}`,
  ].filter(Boolean).join("\n\n");
  try {
    const verified = await generate(VERIFY_PROMPT_TEMPLATE(draft, all));
    return verified.replace(/^#+\s*(DRAFT|FINAL|SUMMARY)[^\n]*\n+/i, "").trim();
  } catch {
    return draft; // keep the unverified draft rather than failing the run
  }
}

export function generateRollup(
  label: string,
  entries: { label: string; text: string }[],
): Promise<string> {
  const joined = entries.map((e) => `#### ${e.label}\n${e.text}`).join("\n\n");
  return generate(ROLLUP_PROMPT_TEMPLATE(label, joined));
}

const MAX_COMMITS_PER_CHUNK = 400;

/** Long ranges: summarize each week (or month for 45+ days) from git, then merge the pieces. */
export async function generatePeriodSummary(
  data: GitData,
  range: DateRange,
  label: string,
): Promise<string> {
  const unit = dayCount(range) > 45 ? "month" : "week";
  const entries: { label: string; text: string }[] = [];

  for (const chunk of splitRange(range, unit)) {
    const from = toIso(chunk.from);
    const to = toIso(chunk.to);
    const bucket = data.commits.filter((c) => c.date >= from && c.date <= to);
    if (bucket.length === 0) continue;
    const chunkLabel = rangeLabel(chunk);
    console.log(`  • ${chunkLabel}: ${bucket.length} commits`);
    const { commitData } = buildEvidence({
      ...data,
      commits: bucket.slice(0, MAX_COMMITS_PER_CHUNK),
      inProgress: [],
      prs: [],
    });
    entries.push({ label: chunkLabel, text: await generate(CHUNK_PROMPT_TEMPLATE(chunkLabel, commitData)) });
  }

  console.log("🧩 Merging into one summary...");
  return generateRollup(label, entries);
}
