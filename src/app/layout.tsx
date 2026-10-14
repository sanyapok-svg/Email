import type { Metadata } from "next";
import { startMailboxScheduler } from "@/lib/orchestration/scheduler";
import "./globals.css";

startMailboxScheduler();

export const metadata: Metadata = {
  title: "Почтаход",
  description: "Из общего ящика — в нужные руки. Разбор почты и уведомления в Битрикс24, Telegram и пересылку.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
