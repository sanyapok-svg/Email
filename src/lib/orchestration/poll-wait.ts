import { nextConnectionAt } from "@/lib/mail/next-connection";
import type { WorkSchedule } from "@/lib/hours/schedule";

export const POLL_CHAIN_LOCK = "poll-chain";
export const MIN_POLL_WAIT_MS = 15_000;
export const MAX_POLL_WAIT_MS = 60 * 60 * 1000;
export const POLL_CHAIN_LOCK_BUFFER_MS = 10 * 60 * 1000;

export function waitUntilNextPollMs(
  now: Date,
  mailboxes: Array<{
    active: boolean;
    autoPoll: boolean;
    pollIntervalSec: number;
    lastCheckedAt: Date | null;
    schedule: WorkSchedule;
  }>,
): number {
  if (mailboxes.length === 0) return MAX_POLL_WAIT_MS;
  let soonest: number | null = null;
  for (const mailbox of mailboxes) {
    const next = nextConnectionAt({
      now,
      lastCheckedAt: mailbox.lastCheckedAt,
      pollIntervalSec: mailbox.pollIntervalSec,
      active: mailbox.active,
      autoPoll: mailbox.autoPoll,
      schedule: mailbox.schedule,
    });
    if (!next) continue;
    const at = next.getTime();
    if (soonest == null || at < soonest) soonest = at;
  }
  if (soonest == null) return MAX_POLL_WAIT_MS;
  const wait = soonest - now.getTime();
  if (wait < MIN_POLL_WAIT_MS) return MIN_POLL_WAIT_MS;
  return Math.min(wait, MAX_POLL_WAIT_MS);
}
