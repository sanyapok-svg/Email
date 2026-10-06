import { headers } from "next/headers";
import { after } from "next/server";
import { Shell } from "@/components/shell";
import { logEvent } from "@/lib/log";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  after(() => {
    void import("@/lib/orchestration/poll-chain")
      .then((mod) => mod.ensurePollChain())
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "chain start failed";
        logEvent("error", "poll.chain_start_failed", { message: message.slice(0, 200) });
      });
  });
  const pathname = (await headers()).get("x-pathname") || "/";
  return <Shell pathname={pathname}>{children}</Shell>;
}
