import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Shell } from "@/components/shell";
import { loadPanel } from "@/lib/auth/account";
import { logEvent } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, account, accounts } = await loadPanel();
  const pathname = (await headers()).get("x-pathname") || "/";
  const onAccounts = pathname === "/accounts" || pathname.startsWith("/accounts/");
  if (onAccounts && !user.isSuperAdmin) redirect("/");
  if (!account && !onAccounts) redirect(`/session/account?next=${encodeURIComponent(pathname)}`);
  after(() => {
    void import("@/lib/orchestration/poll-chain")
      .then((mod) => mod.ensurePollChain())
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "chain start failed";
        logEvent("error", "poll.chain_start_failed", { message: message.slice(0, 200) });
      });
  });
  return (
    <Shell
      pathname={pathname}
      accountName={account?.name}
      accounts={accounts}
      currentAccountId={account?.id}
      showAccounts={user.isSuperAdmin}
    >
      {children}
    </Shell>
  );
}
