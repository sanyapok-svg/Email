import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Входящие",
  description: "Обработка входящей почты, уведомления и ответы",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
