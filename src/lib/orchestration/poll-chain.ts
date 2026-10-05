import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { mailboxPollWorkflow } from "@/lib/orchestration/poll-workflow";
import { POLL_CHAIN_LOCK } from "@/lib/orchestration/poll-wait";

const INITIAL_LOCK_MS = 15 * 60 * 1000;

export async function ensurePollChain(): Promise<"started" | "running" | "skipped"> {
  if (!process.env.VERCEL || process.env.NEXT_PHASE === "phase-production-build") return "skipped";
  const now = new Date();
  const existing = await prisma.schedulerLock.findUnique({ where: { id: POLL_CHAIN_LOCK } });
  if (existing && existing.lockedUntil.getTime() > now.getTime()) return "running";
  if (existing) {
    await prisma.schedulerLock.deleteMany({ where: { id: POLL_CHAIN_LOCK, lockedUntil: { lt: now } } });
  }
  const token = randomUUID();
  try {
    await prisma.schedulerLock.create({
      data: { id: POLL_CHAIN_LOCK, owner: token, lockedUntil: new Date(now.getTime() + INITIAL_LOCK_MS) },
    });
  } catch {
    return "running";
  }
  try {
    const { start } = await import("workflow/api");
    await start(mailboxPollWorkflow, [token]);
    logEvent("info", "poll.chain_started", {});
    return "started";
  } catch (error) {
    await prisma.schedulerLock.deleteMany({ where: { id: POLL_CHAIN_LOCK, owner: token } });
    const message = error instanceof Error ? error.message : "chain start failed";
    logEvent("error", "poll.chain_start_failed", { message: message.slice(0, 200) });
    throw error;
  }
}
