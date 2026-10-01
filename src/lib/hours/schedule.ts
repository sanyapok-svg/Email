import { DateTime } from "luxon";

export type WorkInterval = { start: string; end: string };

export type WorkSchedule = {
  timezone: string;
  workDays: number[];
  intervals: WorkInterval[];
  holidays: string[];
};

export type OutsidePolicy = "send_now" | "defer" | "cancel";

export type ScheduleDecision = {
  status: "pending" | "scheduled" | "cancelled";
  scheduledAt: Date | null;
  outsideHours: boolean;
};

const MINUTES = /^(\d{2}):(\d{2})$/;

function parseMinutes(value: string): number | null {
  const match = MINUTES.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isWorkingMoment(date: Date, schedule: WorkSchedule): boolean {
  if (schedule.workDays.length === 0) return true;
  const local = DateTime.fromJSDate(date, { zone: "utc" }).setZone(schedule.timezone);
  if (!local.isValid) return true;
  const dayKey = local.toFormat("yyyy-MM-dd");
  if (schedule.holidays.includes(dayKey)) return false;
  if (!schedule.workDays.includes(local.weekday)) return false;
  const minute = local.hour * 60 + local.minute;
  return schedule.intervals.some((interval) => {
    const start = parseMinutes(interval.start);
    const end = parseMinutes(interval.end);
    if (start == null || end == null || end <= start) return false;
    return minute >= start && minute < end;
  });
}

export function nextWorkingStart(date: Date, schedule: WorkSchedule): Date | null {
  if (schedule.workDays.length === 0) return date;
  const cursor = DateTime.fromJSDate(date, { zone: "utc" }).setZone(schedule.timezone);
  if (!cursor.isValid) return null;
  for (let day = 0; day < 21; day += 1) {
    const dayStart = cursor.startOf("day").plus({ days: day });
    const dayKey = dayStart.toFormat("yyyy-MM-dd");
    if (schedule.holidays.includes(dayKey) || !schedule.workDays.includes(dayStart.weekday)) continue;
    for (const interval of schedule.intervals) {
      const start = parseMinutes(interval.start);
      if (start == null) continue;
      const candidate = dayStart.plus({ minutes: start });
      if (candidate.toUTC().toJSDate().getTime() >= date.getTime()) return candidate.toUTC().toJSDate();
    }
  }
  return null;
}

export function planByWorkingHours(now: Date, schedule: WorkSchedule, policy: OutsidePolicy): ScheduleDecision {
  const outside = !isWorkingMoment(now, schedule);
  if (!outside || policy === "send_now") {
    return { status: "pending", scheduledAt: null, outsideHours: outside };
  }
  if (policy === "cancel") return { status: "cancelled", scheduledAt: null, outsideHours: true };
  const next = nextWorkingStart(now, schedule);
  if (!next) return { status: "cancelled", scheduledAt: null, outsideHours: true };
  return { status: "scheduled", scheduledAt: next, outsideHours: true };
}
