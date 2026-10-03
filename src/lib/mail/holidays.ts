export type HolidayRange = { start: string; end: string };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseHolidayList(value: string): string[] {
  const days = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => ISO.test(item));
  return [...new Set(days)].sort();
}

export function collapseHolidayRanges(days: string[]): HolidayRange[] {
  const unique = [...new Set(days.filter((day) => ISO.test(day)))].sort();
  if (unique.length === 0) return [];
  const ranges: HolidayRange[] = [];
  let start = unique[0];
  let previous = unique[0];
  for (const day of unique.slice(1)) {
    if (day === addDays(previous, 1)) previous = day;
    else {
      ranges.push({ start, end: previous });
      start = previous = day;
    }
  }
  ranges.push({ start, end: previous });
  return ranges;
}

export function expandHolidayRanges(ranges: HolidayRange[]): string[] {
  const days: string[] = [];
  for (const range of mergeHolidayRanges(ranges)) {
    let cursor = range.start;
    let guard = 0;
    while (cursor <= range.end && guard < 800) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
      guard += 1;
    }
  }
  return days;
}

export function mergeHolidayRanges(ranges: HolidayRange[]): HolidayRange[] {
  const sorted = ranges
    .filter((range) => ISO.test(range.start) && ISO.test(range.end))
    .map((range) => (range.start <= range.end ? { start: range.start, end: range.end } : { start: range.end, end: range.start }))
    .sort((left, right) => left.start.localeCompare(right.start));
  const merged: HolidayRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > addDays(last.end, 1)) merged.push({ ...range });
    else if (range.end > last.end) last.end = range.end;
  }
  return merged;
}

export function addDays(iso: string, days: number): string {
  const match = ISO.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatHolidayRu(iso: string): string {
  const match = ISO.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}
