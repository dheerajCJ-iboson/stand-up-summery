import { parse } from "@std/flags";
import { config } from "./config/env.ts";
import {
  addDays,
  DateRange,
  lastWorkingDayRange,
  makeRange,
  parseDate,
  rangeLabel,
  singleDay,
  thisWeekRange,
  today,
} from "./dates.ts";
import { formatSummary, OutputFormat, parseFormat, postToSlack } from "./format.ts";
import { getGitData } from "./git.ts";
import { findPreviousSummary, loadSummariesInRange, saveSummary } from "./store.ts";
import { generateRollup, generateStandupSummary } from "./summary.ts";

type Mode = "standup" | "rollup";

const MENU = `
What would you like to summarize?
  1) Today
  2) Yesterday
  3) Last working day (on Monday this covers Fri–Sun)
  4) A specific date
  5) A date range
  6) This week (Monday → today)
  7) Weekly roll-up of saved summaries (this week)
`;

function ask(question: string, fallback = ""): string {
  const answer = prompt(question);
  return (answer ?? "").trim() || fallback;
}

function askDate(question: string, fallback?: Date): Date {
  while (true) {
    const raw = ask(question, fallback ? "__default__" : "");
    if (raw === "__default__" && fallback) return fallback;
    try {
      return parseDate(raw);
    } catch (e) {
      console.log(`  ✖ ${(e as Error).message}`);
    }
  }
}

function askYesNo(question: string): boolean {
  return /^y(es)?$/i.test(ask(`${question} (y/N)`));
}

function chooseInteractively(): { range: DateRange; mode: Mode } {
  console.log(MENU);
  while (true) {
    const choice = ask("Choose 1-7 [1]:", "1");
    const now = today();
    switch (choice) {
      case "1": return { range: singleDay(now), mode: "standup" };
      case "2": return { range: singleDay(addDays(now, -1)), mode: "standup" };
      case "3": return { range: lastWorkingDayRange(now), mode: "standup" };
      case "4": return { range: singleDay(askDate("Date (dd-mm-yyyy):")), mode: "standup" };
      case "5": {
        const from = askDate("From (dd-mm-yyyy):");
        const to = askDate("To (dd-mm-yyyy, Enter = today):", now);
        return { range: makeRange(from, to), mode: "standup" };
      }
      case "6": return { range: thisWeekRange(now), mode: "standup" };
      case "7": return { range: thisWeekRange(now), mode: "rollup" };
      default: console.log("  ✖ Please enter a number from 1 to 7.");
    }
  }
}

export async function runCli() {
  const flags = parse(Deno.args, {
    string: ["date", "from", "to", "path", "author", "depth", "format"],
    boolean: ["today", "yesterday", "week", "rollup", "post", "verify", "prs", "yes", "help"],
    alias: { d: "date", p: "path", a: "author", l: "depth", f: "format", y: "yes", h: "help" },
    default: {
      path: config.defaultRepoPath,
      author: config.defaultAuthor,
      depth: "5",
    },
  });

  if (flags.help) {
    console.log(`Usage: deno task start [options]

With no date option the CLI asks interactively.

Date options:
  --today | --yesterday | --week
  -d, --date dd-mm-yyyy          A single date
  --from dd-mm-yyyy [--to dd-mm-yyyy]   A range (--to defaults to today)
  --rollup                       Merge saved summaries of the range (default: this week)

Other options:
  -p, --path <dir>     Folder to scan for repos        -a, --author <name/email>
  -l, --depth <n>      Scan depth (default 5)          -f, --format slack|markdown|plain
  --post               Post to SLACK_WEBHOOK_URL       --verify  Fact-check the summary
  --prs                Include GitHub PR titles (gh)   -y, --yes Skip all prompts`);
    return;
  }

  const now = today();
  let range: DateRange | undefined;
  let mode: Mode = flags.rollup ? "rollup" : "standup";

  try {
    if (flags.date) range = singleDay(parseDate(flags.date));
    else if (flags.from) range = makeRange(parseDate(flags.from), flags.to ? parseDate(flags.to) : now);
    else if (flags.today) range = singleDay(now);
    else if (flags.yesterday) range = singleDay(addDays(now, -1));
    else if (flags.week || flags.rollup) range = thisWeekRange(now);
  } catch (e) {
    console.error(`\n🚨 ${(e as Error).message}`);
    return;
  }

  const interactive = !flags.yes && Deno.stdin.isTerminal();
  if (!range) {
    if (interactive) ({ range, mode } = chooseInteractively());
    else range = singleDay(now);
  }

  let format: OutputFormat = parseFormat(flags.format ?? config.defaultFormat);
  let post = flags.post;
  if (interactive) {
    if (!flags.format) {
      format = parseFormat(ask(`Output format: slack / markdown / plain [${format}]:`, format));
    }
    if (!flags.post && config.slackWebhook) post = askYesNo("Post to Slack when done?");
  }
  if (post && !config.slackWebhook) {
    console.warn("⚠️  --post needs SLACK_WEBHOOK_URL in .env; skipping Slack.");
    post = false;
  }

  const label = rangeLabel(range);
  try {
    let summary: string;

    if (mode === "rollup") {
      console.log(`\n🗂️  Rolling up saved summaries for ${label}...`);
      const entries = await loadSummariesInRange(range);
      if (entries.length === 0) {
        console.log("❌ No saved daily summaries in that range. Generate them first.");
        return;
      }
      summary = await generateRollup(label, entries);
    } else {
      const depth = Number(flags.depth) || 5;
      const usePrs = flags.prs || config.usePrs;
      console.log(`\n🚀 Fetching activity for ${label}...`);
      console.log(`📂 Path: ${flags.path}`);
      console.log(`👤 Author: ${flags.author}`);
      console.log(`🔎 Scanning nested repositories up to ${depth} levels deep...`);

      const data = await getGitData(flags.path, flags.author, range, { maxDepth: depth, includePrs: usePrs });

      if (data.commits.length === 0) {
        console.log(`❌ No commits found for this range/author (scanned ${data.repoCount} repos).`);
        return;
      }
      console.log(
        `✅ ${data.commits.length} commits in ${data.repoCount} repos` +
          (data.inProgress.length ? `, ${data.inProgress.length} repos with uncommitted work` : "") +
          (data.prs.length ? `, ${data.prs.length} PRs` : "") +
          `. Generating summary with ${config.llm.provider}:${config.llm.model}...`,
      );

      const previousSummary = await findPreviousSummary(range.from);
      summary = await generateStandupSummary(data, label, {
        previousSummary,
        verify: flags.verify || config.verify,
      });
    }

    const output = formatSummary(summary, format);
    const file = await saveSummary(range, output);

    console.log(`\n✨ Stand-up Summery saved to ${file}\n`);
    console.log("--- Summary Preview ---");
    console.log(output);
    console.log("----------------------");

    if (post) {
      await postToSlack(config.slackWebhook, output);
      console.log("📣 Posted to Slack.");
    }
  } catch (error) {
    console.error(`\n🚨 Error: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
