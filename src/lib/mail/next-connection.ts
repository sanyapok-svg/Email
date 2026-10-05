import { isWorkingMoment, nextWorkingStart, type WorkSchedule } from "@/lib/hours/schedule";

export function nextConnectionAt(input: {
  now: Date;
  lastCheckedAt: Date | null;
  pollIntervalSec: number;
  active: boolean;
  autoPoll: boolean;
  schedule: WorkSchedule;
}): Date | null {
  if (!input.active || !input.autoPoll) return null;
  const intervalMs = Math.max(60, input.pollIntervalSec || 300) * 1000;
  const earliest = input.lastCheckedAt ? input.lastCheckedAt.getTime() + intervalMs : input.now.getTime();
  const due = new Date(Math.max(earliest, input.now.getTime()));
  if (isWorkingMoment(due, input.schedule)) return due;
  return nextWorkingStart(due, input.schedule);
}

export function isConnectionDue(input: {
  now: Date;
  lastCheckedAt: Date | null;
  pollIntervalSec: number;
  active: boolean;
  autoPoll: boolean;
  schedule: WorkSchedule;
}): boolean {
  const next = nextConnectionAt(input);
  return next != null && next.getTime() <= input.now.getTime();
}

export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "сейчас";
  const total = Math.ceil(remainingMs / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (days > 0) return `через ${days} д ${clock}`;
  if (hours > 0) return `через ${clock}`;
  return `через ${pad(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
