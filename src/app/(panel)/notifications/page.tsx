import Link from "next/link";
import { MailboxNotifications, type NoticeRow } from "@/components/mailbox-notifications";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { priorityCode, priorityLabel } from "@/lib/b24/notice";
import { labelStatus, statusCode } from "@/lib/labels";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const items = await prisma.notification.findMany({
    where: {
      status: statusCode(params.status),
      mailboxId: params.mailboxId || undefined,
      priority: priorityCode(params.priority),
      category: params.category || undefined,
    },
    include: { mailbox: { select: { name: true, address: true } }, rule: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const groups = new Map<string, { id: string; name: string; address: string; items: NoticeRow[] }>();
  for (const item of items) {
    const group = groups.get(item.mailboxId) ?? { id: item.mailboxId, name: item.mailbox.name, address: item.mailbox.address, items: [] };
    group.items.push({
      id: item.id,
      createdAt: item.createdAt.toLocaleString("ru-RU"),
      ruleName: item.rule?.name ?? null,
      status: labelStatus(item.status),
      priority: priorityLabel(item.priority),
      due: `${item.responseDueAt?.toLocaleString("ru-RU") || "—"}${item.overdue ? " · просрочен" : ""}${item.dueRisk ? " · риск" : ""}`,
    });
    groups.set(item.mailboxId, group);
  }
  const narrowed = Boolean(params.status || params.priority || params.category);
  if (!narrowed) {
    const boxes = await prisma.mailbox.findMany({
      where: params.mailboxId ? { id: params.mailboxId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true },
    });
    for (const mailbox of boxes) {
      if (!groups.has(mailbox.id)) groups.set(mailbox.id, { id: mailbox.id, name: mailbox.name, address: mailbox.address, items: [] });
    }
  }
  const mailboxes = [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));

  return (
    <>
      <PageTitle title="Уведомления" text="Уведомления собраны под своим ящиком. Список можно свернуть. Полный текст письма в Битрикс24 по умолчанию не передаётся." />
      <Notice text={params.notice} />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <input name="status" defaultValue={params.status || ""} placeholder="статус" />
        <input name="priority" defaultValue={params.priority || ""} placeholder="приоритет" />
        <input name="category" defaultValue={params.category || ""} placeholder="категория" />
        <button type="submit">Фильтр</button>
      </form>
      <div className="grid gap-5">
        {mailboxes.map((mailbox) => (
          <section key={mailbox.id} id={`mailbox-${mailbox.id}`} className="overflow-hidden rounded-xl border border-line bg-card">
            <header className="px-4 py-4 sm:px-5">
              <Link className="text-lg font-semibold underline" href={`/mailboxes/${mailbox.id}`}>
                {mailbox.name}
              </Link>
              <p className="mt-0.5 text-sm text-muted">{mailbox.address}</p>
            </header>
            <MailboxNotifications panelId={`mailbox-${mailbox.id}`} items={mailbox.items} />
          </section>
        ))}
        {mailboxes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-card px-4 py-6 text-sm">Уведомлений пока нет.</p>
        ) : null}
      </div>
    </>
  );
}
