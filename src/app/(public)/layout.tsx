import type { Metadata } from "next";
import { manrope } from "@/components/public/font";
import { AuthProvider } from "@/components/public/auth-context";

export const metadata: Metadata = {
  title: { default: "Почтаход", template: "%s — Почтаход" },
  description: "Из общего ящика — в нужные руки. Разбор почты и уведомления в Битрикс24, Telegram и пересылку.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${manrope.className} pochtahod min-h-screen`}>
      <AuthProvider>{children}</AuthProvider>
    </div>
  );
}
