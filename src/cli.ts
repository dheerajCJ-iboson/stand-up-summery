import { parse } from "@std/flags";
import { config } from "./config/env.ts";
import { getGitCommits } from "./git.ts";
import { generateStandupSummary } from "./summary.ts";

export async function runCli() {
  const now = new Date();
  const today = `${String(now.getDate()).padStart(2, "0")}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}-${now.getFullYear()}`;

  const flags = parse(Deno.args, {
    string: ["date", "path", "author", "depth"],
    alias: {
      d: "date",
      p: "path",
      a: "author",
      l: "depth",
    },
    default: {
      date: today,
      path: config.defaultRepoPath,
      author: config.defaultAuthor,
      depth: 5,
    },
  });

  const dateInput = flags.date;
  const depth = Number(flags.depth ?? 4);

  console.log(`\n🚀 Fetching commits for ${dateInput}...`);
  console.log(`📂 Path: ${flags.path}`);
  console.log(`👤 Author: ${flags.author}`);
  console.log(`🔎 Scanning nested repositories up to ${depth} levels deep...`);

  try {
    const commits = await getGitCommits(flags.path, flags.author, dateInput, depth);

    if (commits.length === 0) {
      console.log("❌ No commits found for this date/author.");
      return;
    }

    console.log(
      `✅ Found ${commits.length} commits across nested repositories. Generating summary with ${config.llm.provider}:${config.llm.model}...`,
    );

    const summary = await generateStandupSummary(commits, dateInput);

    const outputDir = "summery";
    await Deno.mkdir(outputDir, { recursive: true });
    const outputFileName = `${outputDir}/${dateInput}-summery.txt`;
    await Deno.writeTextFile(outputFileName, summary);

    console.log(`\n✨ Stand-up Summery saved to ${outputFileName}\n`);
    console.log("--- Summary Preview ---");
    console.log(summary);
    console.log("----------------------");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n🚨 Error: ${error.message}`);
    } else {
      console.error(`\n🚨 An unknown error occurred.`);
    }
  }
}
