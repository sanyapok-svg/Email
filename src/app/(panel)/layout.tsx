import { headers } from "next/headers";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const pathname = (await headers()).get("x-pathname") || "/";
  return <Shell pathname={pathname}>{children}</Shell>;
}
