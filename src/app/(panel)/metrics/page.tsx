import { PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";

export default async function MetricsPage() {
  const [rows, mailboxes] = await Promise.all([
    prisma.dailyMetric.findMany({ include: { mailbox: { select: { name: true } } }, orderBy: { day: "desc" }, take: 60 }),
    prisma.mailbox.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const seen = new Set(rows.map((row) => row.mailboxId));
  const missing = mailboxes.filter((mailbox) => !seen.has(mailbox.id));
  return (
    <>
      <PageTitle title="Метрики" text="Счётчики по дням и ящикам: письма, уведомления и ошибки." />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr>
              <th>День</th><th>Ящик</th><th>Письма</th><th>Исключено</th><th>Пропущено</th><th>Уведомления</th><th>Ошибки</th><th>Подавлено</th>
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
                  <td>{(counters.bodyErrors || 0) + (counters.notificationErrors || 0)}</td>
                  <td>{counters.throttledNotifications || 0}</td>
                </tr>
              );
            })}
            {missing.map((mailbox) => (
              <tr key={mailbox.id}>
                <td>—</td>
                <td>{mailbox.name}</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
              </tr>
            ))}
            {rows.length === 0 && missing.length === 0 ? (
              <tr>
                <td colSpan={8}>Ящиков пока нет.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
