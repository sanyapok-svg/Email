import Link from "next/link";
import { Card, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";

export default async function DashboardPage() {
  const [mailboxes, messages, notices, replies] = await Promise.all([
    prisma.mailbox.findMany({ orderBy: { name: "asc" } }),
    prisma.processedMessage.groupBy({ by: ["decision"], _count: true }),
    prisma.notification.groupBy({ by: ["status"], _count: true }),
    prisma.outboundReply.groupBy({ by: ["status"], _count: true }),
  ]);
  const decisionCount = Object.fromEntries(messages.map((item) => [item.decision, item._count]));
  const noticeCount = Object.fromEntries(notices.map((item) => [item.status, item._count]));
  const replyCount = Object.fromEntries(replies.map((item) => [item.status, item._count]));
  return (
    <>
      <PageTitle title="Обзор" text="Сначала оставьте глобальный сухой прогон включённым и проверьте один тестовый ящик." />
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Активные ящики" value={mailboxes.filter((item) => item.active).length} />
        <Stat label="Исключено" value={decisionCount.exclude || 0} />
        <Stat label="Пропущено" value={decisionCount.skipped_no_rule || 0} />
        <Stat label="Ошибки разбора" value={decisionCount.error || 0} />
        <Stat label="Уведомления в очереди" value={(noticeCount.pending || 0) + (noticeCount.scheduled || 0)} />
        <Stat label="Сухие прогоны" value={(noticeCount.dry_run || 0) + (replyCount.dry_run || 0)} />
        <Stat label="Подавлено" value={(noticeCount.throttled || 0) + (replyCount.throttled || 0) + (replyCount.suppressed || 0)} />
        <Stat label="Ошибки отправки" value={(noticeCount.error || 0) + (replyCount.error || 0)} />
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr>
              <th>Ящик</th>
              <th>Статус</th>
              <th>Синхронизация</th>
              <th>Ошибка</th>
            </tr>
          </thead>
          <tbody>
            {mailboxes.map((mailbox) => (
              <tr key={mailbox.id}>
                <td>
                  <Link className="underline" href={`/mailboxes/${mailbox.id}`}>
                    {mailbox.name}
                  </Link>
                  <div className="text-xs text-muted">{mailbox.address}</div>
                </td>
                <td>{mailbox.active ? "активен" : "выключен"}{mailbox.dryRun ? ", сухой прогон" : ""}</td>
                <td>
                  {mailbox.initialized ? "курсор установлен" : "ещё не инициализирован"}
                  <div className="text-xs text-muted">{mailbox.lastCheckedAt ? mailbox.lastCheckedAt.toLocaleString("ru-RU") : "проверок не было"}</div>
                </td>
                <td className="max-w-sm text-clay">{mailbox.lastError || mailbox.smtpLastError || "—"}</td>
              </tr>
            ))}
            {mailboxes.length === 0 ? (
              <tr>
                <td colSpan={4}>Ящиков пока нет. <Link className="underline" href="/mailboxes/new">Создать первый</Link></td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Card>
        <p className="text-sm text-muted">Решения писем: {Object.entries(decisionCount).map(([key, value]) => `${labelStatus(key)} ${value}`).join(", ") || "пока нет"}.</p>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}
