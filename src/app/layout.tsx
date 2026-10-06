import type { Metadata } from "next";
import { startMailboxScheduler } from "@/lib/orchestration/scheduler";
import "./globals.css";

startMailboxScheduler();

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
