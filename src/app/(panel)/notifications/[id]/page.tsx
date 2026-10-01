import { notFound } from "next/navigation";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";
import { retryNotification } from "@/server/ops";

export default async function NotificationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const item = await prisma.notification.findUnique({ where: { id }, include: { mailbox: true, message: true, rule: true } });
  if (!item) notFound();
  return (
    <>
      <PageTitle title="Уведомление" text={`${item.mailbox.name} · ${labelStatus(item.status)}`} />
      <Notice text={query.notice} />
      <p className="mb-3 text-sm">Попытки: {item.attempts}/{item.maxAttempts}. {item.lastError || ""}</p>
      <pre className="overflow-auto rounded-xl border border-line bg-card p-4 text-xs">{JSON.stringify(item.payload, null, 2)}</pre>
      {item.status === "error" ? (
        <form className="mt-4" action={retryNotification}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit">Повторить отправку</button>
        </form>
      ) : null}
    </>
  );
}
