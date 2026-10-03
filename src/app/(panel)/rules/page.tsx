import { redirect } from "next/navigation";
import { withNotice } from "@/lib/http/notice";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ mailboxId?: string; notice?: string }> }) {
  const params = await searchParams;
  const base = params.notice ? withNotice("/mailboxes", params.notice) : "/mailboxes";
  redirect(params.mailboxId ? `${base}#mailbox-${params.mailboxId}` : base);
}
