import Link from "next/link";
import { ConnectionCountdown } from "@/components/connection-countdown";
import { MailboxCheck } from "@/components/mailbox-check";
import { checkSettingsFrom } from "@/lib/mail/check-settings";
import { MailboxControls } from "@/components/mailbox-controls";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MailboxRules } from "@/components/mailbox-rules";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { deleteMailbox } from "@/server/mailboxes";
import { formatCountdown, nextConnectionAt } from "@/lib/mail/next-connection";
import { parseSchedule } from "@/lib/rules/parse";

export default async function MailboxesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const mailboxes = await prisma.mailbox.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { messages: true } },
      rules: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, type: true, position: true, active: true, category: true },
      },
    },
  });
  return (
    <>
      <PageTitle
        title="Ящики"
        text="Проверка почты и рабочие часы задаются под ящиком. Правила идут следом и проверяются сверху вниз."
      />
      <Notice text={params.notice} />
      <Link className="button inline-block" href="/mailboxes/new">
        Новый ящик
      </Link>
      <div className="mt-4 grid gap-5">
        {mailboxes.map((mailbox) => (
          <section key={mailbox.id} id={`mailbox-${mailbox.id}`} className="overflow-hidden rounded-xl border border-line bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div>
                <Link className="text-lg font-semibold underline" href={`/mailboxes/${mailbox.id}`}>
                  {mailbox.name}
                </Link>
                <p className="mt-0.5 text-sm text-muted">
                  {mailbox.address}
                  {" · "}
                  писем {mailbox._count.messages}
                  {" · "}
                  {connectionStamp(mailbox.lastCheckedAt, mailbox.timezone)}
                  {" · "}
                  <NextConnection mailbox={mailbox} />
                  {mailbox.consecutiveErrors > 0 ? ` · ошибок подряд ${mailbox.consecutiveErrors}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MailboxControls id={mailbox.id} active={mailbox.active} returnTo={`/mailboxes#mailbox-${mailbox.id}`} />
                <ConfirmDelete
                  action={deleteMailbox}
                  id={mailbox.id}
                  label="Удалить ящик"
                  title="Удалить ящик"
                  text={`Ящик «${mailbox.name}», его правила, письма, уведомления и метрики будут удалены.`}
                />
              </div>
            </header>
            <MailboxCheck
              mailboxId={mailbox.id}
              settings={checkSettingsFrom(mailbox)}
              returnTo={`/mailboxes#check-${mailbox.id}`}
              panelId={`check-${mailbox.id}`}
              divider
            />
            <MailboxRules
              mailboxId={mailbox.id}
              rules={mailbox.rules}
              returnTo={`/mailboxes#mailbox-${mailbox.id}`}
              panelId={`mailbox-${mailbox.id}`}
              divider
            />
          </section>
        ))}
        {mailboxes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-card px-4 py-6 text-sm">
            Ящиков пока нет. <Link className="underline" href="/mailboxes/new">Создать первый</Link>
          </p>
        ) : null}
      </div>
    </>
  );
}

function NextConnection({
  mailbox,
}: {
  mailbox: { lastCheckedAt: Date | null; pollIntervalSec: number; active: boolean; autoPoll: boolean; timezone: string; workDays: unknown; workIntervals: unknown; holidays: unknown };
}) {
  const now = Date.now();
  if (!mailbox.active) return <span>ящик выключен</span>;
  if (!mailbox.autoPoll) return <span>автопроверка выключена</span>;
  const at = nextConnectionAt({
    now: new Date(now),
    lastCheckedAt: mailbox.lastCheckedAt,
    pollIntervalSec: mailbox.pollIntervalSec,
    active: mailbox.active,
    autoPoll: mailbox.autoPoll,
    schedule: parseSchedule(mailbox),
  });
  if (!at) return <span>окно проверки не найдено</span>;
  return <ConnectionCountdown at={at.toISOString()} initial={formatCountdown(at.getTime() - now)} />;
}

function connectionStamp(date: Date | null, timeZone: string): string {
  if (!date) return "соединения не было";
  return `соединение ${new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: safeZone(timeZone),
  }).format(date)}`;
}

function safeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat("ru-RU", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "Europe/Moscow";
  }
}
