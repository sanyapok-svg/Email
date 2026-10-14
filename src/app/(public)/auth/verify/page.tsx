import type { Metadata } from "next";
import { VerifyScreen } from "@/components/public/verify-screen";

export const metadata: Metadata = { title: "Подтверждение входа" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <VerifyScreen token={params.token || ""} />;
}
