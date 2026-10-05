import { sleep } from "workflow";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { pollDueMailboxes } from "@/lib/orchestration/poll";
import {
  POLL_CHAIN_LOCK,
  POLL_CHAIN_LOCK_BUFFER_MS,
  waitUntilNextPollMs,
} from "@/lib/orchestration/poll-wait";
import { dispatchQueues } from "@/lib/queues/dispatch";
import { parseSchedule } from "@/lib/rules/parse";

export async function mailboxPollWorkflow(token: string) {
  "use workflow";
  const waitMs = await runDuePoll(token);
  if (waitMs == null) return;
  await sleep(waitMs);
  await scheduleNextPoll(token);
}

async function runDuePoll(token: string): Promise<number | null> {
  "use step";
  if (!(await ownsChain(token))) return null;
  try {
    await pollDueMailboxes();
  } finally {
    await dispatchQueues();
  }
  const waitMs = await msUntilNextPoll();
  const extended = await prisma.schedulerLock.updateMany({
    where: { id: POLL_CHAIN_LOCK, owner: token },
    data: { lockedUntil: new Date(Date.now() + waitMs + POLL_CHAIN_LOCK_BUFFER_MS) },
  });
  if (extended.count === 0) return null;
  logEvent("info", "poll.chain_sleep", { waitSec: Math.round(waitMs / 1000) });
  return waitMs;
}

async function scheduleNextPoll(token: string) {
  "use step";
  if (!(await ownsChain(token))) return;
  const { start } = await import("workflow/api");
  await start(mailboxPollWorkflow, [token], { deploymentId: "latest" });
}

async function ownsChain(token: string): Promise<boolean> {
  const row = await prisma.schedulerLock.findUnique({ where: { id: POLL_CHAIN_LOCK } });
  return Boolean(row && row.owner === token && row.lockedUntil.getTime() > Date.now());
}

async function msUntilNextPoll(): Promise<number> {
  const mailboxes = await prisma.mailbox.findMany({
    where: { active: true, autoPoll: true },
    select: {
      active: true,
      autoPoll: true,
      pollIntervalSec: true,
      lastCheckedAt: true,
      timezone: true,
      workDays: true,
      workIntervals: true,
      holidays: true,
    },
  });
  return waitUntilNextPollMs(
    new Date(),
    mailboxes.map((mailbox) => ({
      active: mailbox.active,
      autoPoll: mailbox.autoPoll,
      pollIntervalSec: mailbox.pollIntervalSec,
      lastCheckedAt: mailbox.lastCheckedAt,
      schedule: parseSchedule(mailbox),
    })),
  );
}
