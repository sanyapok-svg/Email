import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { formatCountdown, isConnectionDue, nextConnectionAt } from "@/lib/mail/next-connection";
import type { WorkSchedule } from "@/lib/hours/schedule";

const schedule: WorkSchedule = {
  timezone: "Europe/Moscow",
  workDays: [1, 2, 3, 4, 5],
  intervals: [{ start: "09:00", end: "18:00" }],
  holidays: [],
};

function at(iso: string): Date {
  return DateTime.fromISO(iso, { zone: "Europe/Moscow" }).toJSDate();
}

describe("next mailbox connection", () => {
  it("waits out the check interval inside working hours", () => {
    const next = nextConnectionAt({
      now: at("2026-10-05T13:22:00"),
      lastCheckedAt: at("2026-10-05T13:20:00"),
      pollIntervalSec: 300,
      active: true,
      autoPoll: true,
      schedule,
    });
    expect(DateTime.fromJSDate(next!, { zone: "utc" }).setZone("Europe/Moscow").toFormat("yyyy-MM-dd HH:mm")).toBe("2026-10-05 13:25");
  });

  it("is due immediately when the interval has already passed inside the window", () => {
    const now = at("2026-10-05T13:22:00");
    const next = nextConnectionAt({
      now,
      lastCheckedAt: at("2026-10-02T16:50:00"),
      pollIntervalSec: 300,
      active: true,
      autoPoll: true,
      schedule,
    });
    expect(next?.toISOString()).toBe(now.toISOString());
  });

  it("moves a connection that would fall after hours to the next working start", () => {
    const next = nextConnectionAt({
      now: at("2026-10-02T17:58:30"),
      lastCheckedAt: at("2026-10-02T17:58:00"),
      pollIntervalSec: 300,
      active: true,
      autoPoll: true,
      schedule,
    });
    expect(DateTime.fromJSDate(next!, { zone: "utc" }).setZone("Europe/Moscow").toFormat("yyyy-MM-dd HH:mm")).toBe("2026-10-05 09:00");
  });

  it("skips a holiday and the weekend", () => {
    const next = nextConnectionAt({
      now: at("2026-10-04T12:00:00"),
      lastCheckedAt: at("2026-10-02T16:50:00"),
      pollIntervalSec: 300,
      active: true,
      autoPoll: true,
      schedule: { ...schedule, holidays: ["2026-10-05"] },
    });
    expect(DateTime.fromJSDate(next!, { zone: "utc" }).setZone("Europe/Moscow").toFormat("yyyy-MM-dd HH:mm")).toBe("2026-10-06 09:00");
  });

  it("is due only when the displayed next connection has arrived", () => {
    const waiting = {
      now: at("2026-10-05T13:22:00"),
      lastCheckedAt: at("2026-10-05T13:20:00"),
      pollIntervalSec: 300,
      active: true,
      autoPoll: true,
      schedule,
    };
    expect(isConnectionDue(waiting)).toBe(false);
    expect(isConnectionDue({ ...waiting, now: at("2026-10-05T13:25:00") })).toBe(true);
    expect(isConnectionDue({ ...waiting, now: at("2026-10-04T12:00:00"), lastCheckedAt: at("2026-10-02T16:50:00") })).toBe(false);
    expect(isConnectionDue({ ...waiting, autoPoll: false })).toBe(false);
  });

  it("does not schedule a connection while the mailbox or auto-check is off", () => {
    const base = {
      now: at("2026-10-05T13:22:00"),
      lastCheckedAt: at("2026-10-05T13:20:00"),
      pollIntervalSec: 300,
      schedule,
    };
    expect(nextConnectionAt({ ...base, active: false, autoPoll: true })).toBeNull();
    expect(nextConnectionAt({ ...base, active: true, autoPoll: false })).toBeNull();
  });
});

describe("countdown label", () => {
  it("formats the remaining time", () => {
    expect(formatCountdown(0)).toBe("сейчас");
    expect(formatCountdown(4 * 60_000 + 32_000)).toBe("через 04:32");
    expect(formatCountdown(3_600_000 + 5 * 60_000 + 3_000)).toBe("через 01:05:03");
    expect(formatCountdown(86_400_000 + 2 * 3_600_000)).toBe("через 1 д 02:00:00");
  });
});
