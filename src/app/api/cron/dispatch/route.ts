import { authorizedCron } from "@/lib/http/cron";
import { dispatchQueues } from "@/lib/queues/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedCron(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  await dispatchQueues();
  return Response.json({ ok: true });
}
