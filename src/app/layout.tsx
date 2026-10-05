import type { Metadata } from "next";
import { logEvent } from "@/lib/log";
import { startMailboxScheduler } from "@/lib/orchestration/scheduler";
import "./globals.css";

startMailboxScheduler();
void import("@/lib/orchestration/poll-chain")
  .then((mod) => mod.ensurePollChain())
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "chain start failed";
    logEvent("error", "poll.chain_start_failed", { message: message.slice(0, 200) });
  });

export const metadata: Metadata = {
  title: "Входящие",
  description: "Обработка входящей почты и уведомления в Битрикс24",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
