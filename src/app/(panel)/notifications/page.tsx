import Link from "next/link";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const items = await prisma.notification.findMany({
    where: {
      status: params.status || undefined,
      mailboxId: params.mailboxId || undefined,
      priority: params.priority || undefined,
      category: params.category || undefined,
    },
    include: { mailbox: { select: { name: true } }, rule: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageTitle title="Уведомления" text="Полный текст письма в Битрикс24 по умолчанию не передаётся." />
      <Notice text={params.notice} />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <input name="status" defaultValue={params.status || ""} placeholder="статус" />
        <input name="priority" defaultValue={params.priority || ""} placeholder="приоритет" />
        <input name="category" defaultValue={params.category || ""} placeholder="категория" />
        <button type="submit">Фильтр</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr><th>Когда</th><th>Ящик</th><th>Статус</th><th>Приоритет</th><th>Срок</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><Link className="underline" href={`/notifications/${item.id}`}>{item.createdAt.toLocaleString("ru-RU")}</Link></td>
                <td>{item.mailbox.name}<div className="text-xs text-muted">{item.rule?.name}</div></td>
                <td>{labelStatus(item.status)}</td>
                <td>{item.priority}</td>
                <td>{item.responseDueAt?.toLocaleString("ru-RU") || "—"}{item.overdue ? " · просрочен" : ""}{item.dueRisk ? " · риск" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
