export const POLL_INTERVALS = [
  { minutes: 5, label: "5 минут" },
  { minutes: 10, label: "10 минут" },
  { minutes: 15, label: "15 минут" },
  { minutes: 20, label: "20 минут" },
  { minutes: 30, label: "30 минут" },
  { minutes: 60, label: "каждый час" },
  { minutes: 120, label: "каждые 2 часа" },
  { minutes: 180, label: "каждые 3 часа" },
] as const;

export function pollIntervalMinutes(seconds: number): number {
  const minutes = Math.max(1, Math.round((seconds || 300) / 60));
  const match = POLL_INTERVALS.find((item) => item.minutes === minutes);
  if (match) return match.minutes;
  return POLL_INTERVALS.reduce((best, current) => (Math.abs(current.minutes - minutes) < Math.abs(best.minutes - minutes) ? current : best)).minutes;
}

export type MailboxCheckSettings = {
  autoPoll: boolean;
  pollIntervalSec: number;
  workDays: number[];
  intervals: string;
  holidays: string;
  notifyOutsidePolicy: string;
  replyOutsidePolicy: string;
};

export function checkSettingsFrom(mailbox: {
  autoPoll: boolean;
  pollIntervalSec: number;
  workDays: unknown;
  workIntervals: unknown;
  holidays: unknown;
  notifyOutsidePolicy: string;
  replyOutsidePolicy: string;
}): MailboxCheckSettings {
  const workDays = Array.isArray(mailbox.workDays) ? mailbox.workDays.map(Number).filter((day) => day >= 1 && day <= 7) : [1, 2, 3, 4, 5];
  const intervals = Array.isArray(mailbox.workIntervals)
    ? mailbox.workIntervals
        .filter((item): item is { start: string; end: string } => Boolean(item && typeof item === "object" && "start" in item && "end" in item))
        .map((item) => `${item.start}-${item.end}`)
        .join(", ")
    : "09:00-18:00";
  const holidays = Array.isArray(mailbox.holidays) ? mailbox.holidays.map(String).join(", ") : "";
  return {
    autoPoll: mailbox.autoPoll,
    pollIntervalSec: mailbox.pollIntervalSec || 300,
    workDays,
    intervals: intervals || "09:00-18:00",
    holidays,
    notifyOutsidePolicy: mailbox.notifyOutsidePolicy || "defer",
    replyOutsidePolicy: mailbox.replyOutsidePolicy || "send_now",
  };
}
