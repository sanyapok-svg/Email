import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import type { WorkSchedule } from "@/lib/hours/schedule";
import { MAX_POLL_WAIT_MS, MIN_POLL_WAIT_MS, waitUntilNextPollMs } from "@/lib/orchestration/poll-wait";

const schedule: WorkSchedule = {
  timezone: "Europe/Moscow",
  workDays: [1, 2, 3, 4, 5],
  intervals: [{ start: "09:00", end: "18:00" }],
  holidays: [],
};

function at(iso: string): Date {
  return DateTime.fromISO(iso, { zone: "Europe/Moscow" }).toJSDate();
}

describe("wait until the next mailbox poll", () => {
  it("sleeps until the soonest mailbox interval", () => {
    const now = at("2026-10-05T13:22:00");
    const wait = waitUntilNextPollMs(now, [
      {
        active: true,
        autoPoll: true,
        pollIntervalSec: 300,
        lastCheckedAt: at("2026-10-05T13:20:00"),
        schedule,
      },
      {
        active: true,
        autoPoll: true,
        pollIntervalSec: 600,
        lastCheckedAt: at("2026-10-05T13:20:00"),
        schedule,
      },
    ]);
    expect(wait).toBe(3 * 60 * 1000);
  });

  it("waits the minimum when a mailbox is already due", () => {
    const wait = waitUntilNextPollMs(at("2026-10-05T13:22:00"), [
      {
        active: true,
        autoPoll: true,
        pollIntervalSec: 300,
        lastCheckedAt: at("2026-10-02T16:50:00"),
        schedule,
      },
    ]);
    expect(wait).toBe(MIN_POLL_WAIT_MS);
  });

  it("caps a weekend gap at one hour so the schedule is reread", () => {
    const wait = waitUntilNextPollMs(at("2026-10-02T18:10:00"), [
      {
        active: true,
        autoPoll: true,
        pollIntervalSec: 300,
        lastCheckedAt: at("2026-10-02T17:55:00"),
        schedule,
      },
    ]);
    expect(wait).toBe(MAX_POLL_WAIT_MS);
  });

  it("waits an hour when nothing is set to auto-check", () => {
    expect(waitUntilNextPollMs(at("2026-10-05T13:22:00"), [])).toBe(MAX_POLL_WAIT_MS);
  });
});
