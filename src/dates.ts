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

const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function toGitRange(r: DateRange): { since: string; until: string } {
  return { since: `${iso(r.from)} 00:00:00`, until: `${iso(r.to)} 23:59:59` };
}
