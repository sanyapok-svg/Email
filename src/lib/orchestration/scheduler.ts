import { logEvent } from "@/lib/log";
import { pollDueMailboxes } from "@/lib/orchestration/poll";
import { dispatchQueues } from "@/lib/queues/dispatch";

const TICK_MS = 15_000;

export function startMailboxScheduler() {
  // Vercel runs the durable chain from poll-chain.ts. This timer is the local dev loop.
  if (process.env.VERCEL || process.env.NEXT_PHASE === "phase-production-build") return;
  const state = globalThis as { mailboxPollTimer?: ReturnType<typeof setInterval> };
  if (state.mailboxPollTimer) return;
  const tick = () => {
    pollDueMailboxes()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "poll failed";
        logEvent("error", "poll.scheduler_failed", { message: message.slice(0, 200) });
      })
      .finally(() => {
        dispatchQueues().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "dispatch failed";
          logEvent("error", "queue.dispatch_failed", { message: message.slice(0, 200) });
        });
      });
  };
  tick();
  state.mailboxPollTimer = setInterval(tick, TICK_MS);
  logEvent("info", "poll.scheduler_started", { everySec: TICK_MS / 1000 });
}
