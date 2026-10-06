import { join } from "@std/path";
import { addDays, DateRange, formatDate, parseDate, rangeFileName } from "./dates.ts";

export const SUMMARY_DIR = "summery";

export async function saveSummary(range: DateRange, text: string): Promise<string> {
  await Deno.mkdir(SUMMARY_DIR, { recursive: true });
  const file = join(SUMMARY_DIR, `${rangeFileName(range)}-summery.txt`);
  await Deno.writeTextFile(file, text);
  return file;
}

async function singleDayFiles(): Promise<{ date: Date; path: string }[]> {
  const out: { date: Date; path: string }[] = [];
  try {
    for await (const e of Deno.readDir(SUMMARY_DIR)) {
      const m = /^(\d{2}-\d{2}-\d{4})-summery\.txt$/.exec(e.name);
      if (!m) continue;
      try {
        out.push({ date: parseDate(m[1]), path: join(SUMMARY_DIR, e.name) });
      } catch { /* ignore bad names */ }
    }
  } catch { /* folder missing */ }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Most recent single-day summary strictly before `before`, within the last 14 days. */
export async function findPreviousSummary(before: Date): Promise<string | undefined> {
  const limit = addDays(before, -14);
  const candidates = (await singleDayFiles()).filter((f) => f.date < before && f.date >= limit);
  const last = candidates.at(-1);
  if (!last) return undefined;
  return `(${formatDate(last.date)})\n${(await Deno.readTextFile(last.path)).trim()}`;
}
