import { authorizedCron } from "@/lib/http/cron";
import { pollDueMailboxes } from "@/lib/orchestration/poll";
import { dispatchQueues } from "@/lib/queues/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedCron(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { ensurePollChain } = await import("@/lib/orchestration/poll-chain");
    const chain = await ensurePollChain();
    if (chain === "skipped") await pollNow();
    return Response.json({ ok: true, chain });
  } catch {
    await pollNow();
    return Response.json({ ok: true, chain: "fallback" });
  }
}

async function pollNow() {
  try {
    await pollDueMailboxes();
  } finally {
    await dispatchQueues();
  }
}
