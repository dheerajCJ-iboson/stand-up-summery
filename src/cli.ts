import { parse } from "@std/flags";
import { config } from "./config/env.ts";
import {
  addDays,
  dayCount,
  DateRange,
  lastMonthRange,
  lastWeekRange,
  lastWorkingDayRange,
  makeRange,
  monthRange,
  parseDate,
  parseMonth,
  parseYear,
  rangeLabel,
  singleDay,
  thisMonthRange,
  thisWeekRange,
  today,
  yearRange,
} from "./dates.ts";
import { formatSummary, OutputFormat, parseFormat, postToSlack } from "./format.ts";
import { getGitData } from "./git.ts";
import { findPreviousSummary, saveSummary } from "./store.ts";
import { generatePeriodSummary, generateStandupSummary } from "./summary.ts";

/** Ranges longer than this are summarized in chunks from a lightweight scan. */
const FULL_DETAIL_MAX_DAYS = 7;

const MENU = `
What would you like to summarize?
  1) Today
  2) Yesterday
  3) Last working day (on Monday this covers Fri–Sun)
  4) A specific date
  5) A custom date range
  6) This week (Monday → today)
  7) Last week
  8) This month
  9) Last month
 10) A specific month
 11) A whole year
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

function askUntilValid<T>(question: string, parser: (v: string) => T, fallback?: string): T {
  while (true) {
    try {
      return parser(ask(question, fallback ?? ""));
    } catch (e) {
      console.log(`  ✖ ${(e as Error).message}`);
    }
  }
}

function chooseInteractively(): DateRange {
  console.log(MENU);
  while (true) {
    const choice = ask("Choose 1-11 [1]:", "1");
    const now = today();
    switch (choice) {
      case "1": return singleDay(now);
      case "2": return singleDay(addDays(now, -1));
      case "3": return lastWorkingDayRange(now);
      case "4": return singleDay(askDate("Date (dd-mm-yyyy):"));
      case "5": {
        const from = askDate("From (dd-mm-yyyy):");
        const to = askDate("To (dd-mm-yyyy, Enter = today):", now);
        return makeRange(from, to);
      }
      case "6": return thisWeekRange(now);
      case "7": return lastWeekRange(now);
      case "8": return thisMonthRange(now);
      case "9": return lastMonthRange(now);
      case "10": {
        const m = askUntilValid("Month (mm-yyyy):", (v) => {
          const parsed = parseMonth(v);
          monthRange(parsed.year, parsed.month, now);
          return parsed;
        });
        return monthRange(m.year, m.month, now);
      }
      case "11": {
        const year = askUntilValid(
          `Year (yyyy, Enter = ${now.getFullYear()}):`,
          (v) => {
            const y = parseYear(v);
            yearRange(y, now);
            return y;
          },
          String(now.getFullYear()),
        );
        return yearRange(year, now);
      }
      default: console.log("  ✖ Please enter a number from 1 to 11.");
    }
  }
}

export async function runCli() {
  const flags = parse(Deno.args, {
    string: ["date", "from", "to", "month", "year", "path", "author", "depth", "format"],
    boolean: [
      "today", "yesterday", "week", "last-week", "this-month", "last-month", "this-year",
      "post", "verify", "prs", "yes", "help",
    ],
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
  --today | --yesterday | --week | --last-week
  --this-month | --last-month | --this-year
  -d, --date dd-mm-yyyy          A single date
  --from dd-mm-yyyy [--to dd-mm-yyyy]   A range (--to defaults to today)
  --month mm-yyyy | --year yyyy  A specific month / whole year
  (ranges over 7 days are summarized per week/month from git, then merged)

Other options:
  -p, --path <dir>     Folder to scan for repos        -a, --author <name/email>
  -l, --depth <n>      Scan depth (default 5)          -f, --format slack|markdown|plain
  --post               Post to SLACK_WEBHOOK_URL       --verify  Fact-check the summary
  --prs                Include GitHub PR titles (gh)   -y, --yes Skip all prompts`);
    return;
  }

  const now = today();
  let range: DateRange | undefined;

  try {
    if (flags.date) range = singleDay(parseDate(flags.date));
    else if (flags.from) range = makeRange(parseDate(flags.from), flags.to ? parseDate(flags.to) : now);
    else if (flags.today) range = singleDay(now);
    else if (flags.yesterday) range = singleDay(addDays(now, -1));
    else if (flags.week) range = thisWeekRange(now);
    else if (flags["last-week"]) range = lastWeekRange(now);
    else if (flags["this-month"]) range = thisMonthRange(now);
    else if (flags["last-month"]) range = lastMonthRange(now);
    else if (flags.month) {
      const m = parseMonth(flags.month);
      range = monthRange(m.year, m.month, now);
    } else if (flags.year) range = yearRange(parseYear(flags.year), now);
    else if (flags["this-year"]) range = yearRange(now.getFullYear(), now);
  } catch (e) {
    console.error(`\n🚨 ${(e as Error).message}`);
    return;
  }

  const interactive = !flags.yes && Deno.stdin.isTerminal();
  if (!range) {
    if (interactive) range = chooseInteractively();
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
    const depth = Number(flags.depth) || 5;
    const long = dayCount(range) > FULL_DETAIL_MAX_DAYS;
    const usePrs = (flags.prs || config.usePrs) && !long;
    console.log(`\n🚀 Fetching activity for ${label}${long ? ` (${dayCount(range)} days, summarized in chunks)` : ""}...`);
    console.log(`📂 Path: ${flags.path}`);
    console.log(`👤 Author: ${flags.author}`);
    console.log(`🔎 Scanning nested repositories up to ${depth} levels deep...`);

    const data = await getGitData(flags.path, flags.author, range, {
      maxDepth: depth,
      includePrs: usePrs,
      detail: long ? "compact" : "full",
    });

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

    let summary: string;
    if (long) {
      summary = await generatePeriodSummary(data, range, label);
    } else {
      summary = await generateStandupSummary(data, label, {
        previousSummary: await findPreviousSummary(range.from),
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
