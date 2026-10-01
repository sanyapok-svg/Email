import { PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";

export default async function MetricsPage() {
  const rows = await prisma.dailyMetric.findMany({ include: { mailbox: { select: { name: true } } }, orderBy: { day: "desc" }, take: 60 });
  return (
    <>
      <PageTitle title="Метрики" text="Счётчики по дням и ящикам: письма, уведомления, ответы, ошибки и сухие прогоны." />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr>
              <th>День</th><th>Ящик</th><th>Письма</th><th>Исключено</th><th>Пропущено</th><th>Уведомления</th><th>Ответы</th><th>Ошибки</th><th>Сухой прогон</th><th>Подавлено</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const counters = row.counters as Record<string, number>;
              return (
                <tr key={row.id}>
                  <td>{row.day.toISOString().slice(0, 10)}</td>
                  <td>{row.mailbox.name}</td>
                  <td>{counters.received || 0}</td>
                  <td>{counters.excluded || 0}</td>
                  <td>{counters.skipped || 0}</td>
                  <td>{counters.notified || 0}</td>
                  <td>{(counters.autoReplies || 0) + (counters.manualReplies || 0)}</td>
                  <td>{(counters.bodyErrors || 0) + (counters.notificationErrors || 0) + (counters.smtpErrors || 0)}</td>
                  <td>{counters.dryRun || 0}</td>
                  <td>{(counters.throttledNotifications || 0) + (counters.throttledReplies || 0) + (counters.suppressedReplies || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
