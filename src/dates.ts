export interface DateRange {
  from: Date;
  to: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(d: Date): string {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function parseDate(input: string): Date {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(input.trim());
  if (!m) throw new Error(`Invalid date "${input}". Use dd-mm-yyyy.`);
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    throw new Error(`Invalid date "${input}". Use dd-mm-yyyy.`);
  }
  return d;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function today(): Date {
  return startOfDay(new Date());
}

export function singleDay(d: Date): DateRange {
  return { from: startOfDay(d), to: startOfDay(d) };
}

export function makeRange(a: Date, b: Date): DateRange {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return { from: startOfDay(from), to: startOfDay(to) };
}

/** Last working day up to yesterday. On Monday this is Fri..Sun so weekend work is covered. */
export function lastWorkingDayRange(now = today()): DateRange {
  let from = addDays(now, -1);
  while (from.getDay() === 0 || from.getDay() === 6) from = addDays(from, -1);
  return { from, to: addDays(now, -1) };
}

/** Monday of the current week through today. */
export function thisWeekRange(now = today()): DateRange {
  const sinceMonday = (now.getDay() + 6) % 7;
  return { from: addDays(now, -sinceMonday), to: now };
}

export function isSingleDay(r: DateRange): boolean {
  return r.from.getTime() === r.to.getTime();
}

export function rangeLabel(r: DateRange): string {
  return isSingleDay(r) ? formatDate(r.from) : `${formatDate(r.from)} to ${formatDate(r.to)}`;
}

export function rangeFileName(r: DateRange): string {
  return isSingleDay(r) ? formatDate(r.from) : `${formatDate(r.from)}_to_${formatDate(r.to)}`;
}

export function rangeIncludesToday(r: DateRange): boolean {
  const t = today();
  return r.from <= t && t <= r.to;
}

export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function toGitRange(r: DateRange): { since: string; until: string } {
  return { since: `${toIso(r.from)} 00:00:00`, until: `${toIso(r.to)} 23:59:59` };
}

export function dayCount(r: DateRange): number {
  return Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000) + 1;
}

export function lastWeekRange(now = today()): DateRange {
  const monday = thisWeekRange(now).from;
  return { from: addDays(monday, -7), to: addDays(monday, -1) };
}

/** Whole month, clipped to today. `month` is 0-based. */
export function monthRange(year: number, month: number, now = today()): DateRange {
  const from = new Date(year, month, 1);
  if (from > now) throw new Error("That month is in the future.");
  const end = new Date(year, month + 1, 0);
  return { from, to: end > now ? now : end };
}

export function thisMonthRange(now = today()): DateRange {
  return monthRange(now.getFullYear(), now.getMonth(), now);
}

export function lastMonthRange(now = today()): DateRange {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthRange(d.getFullYear(), d.getMonth(), now);
}

/** Whole year, clipped to today. */
export function yearRange(year: number, now = today()): DateRange {
  if (new Date(year, 0, 1) > now) throw new Error("That year is in the future.");
  const end = new Date(year, 11, 31);
  return { from: new Date(year, 0, 1), to: end > now ? now : end };
}

export function parseMonth(input: string): { year: number; month: number } {
  const m = /^(\d{1,2})-(\d{4})$/.exec(input.trim());
  const month = m ? Number(m[1]) : 0;
  if (!m || month < 1 || month > 12) throw new Error(`Invalid month "${input}". Use mm-yyyy.`);
  return { year: Number(m[2]), month: month - 1 };
}

export function parseYear(input: string): number {
  if (!/^\d{4}$/.test(input.trim())) throw new Error(`Invalid year "${input}". Use yyyy.`);
  return Number(input);
}

/** Splits a range into Monday–Sunday weeks or calendar months, clipped to the range. */
export function splitRange(r: DateRange, unit: "week" | "month"): DateRange[] {
  const parts: DateRange[] = [];
  let cursor = r.from;
  while (cursor <= r.to) {
    const naturalEnd = unit === "week"
      ? addDays(cursor, 6 - ((cursor.getDay() + 6) % 7))
      : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const end = naturalEnd < r.to ? naturalEnd : r.to;
    parts.push({ from: cursor, to: end });
    cursor = addDays(end, 1);
  }
  return parts;
}
