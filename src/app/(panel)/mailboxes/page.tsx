import Link from "next/link";
import { MailboxCheck } from "@/components/mailbox-check";
import { checkSettingsFrom } from "@/lib/mail/check-settings";
import { MailboxControls } from "@/components/mailbox-controls";
import { MailboxRules } from "@/components/mailbox-rules";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";

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
                  {mailbox.consecutiveErrors > 0 ? ` · ошибок подряд ${mailbox.consecutiveErrors}` : ""}
                </p>
              </div>
              <MailboxControls id={mailbox.id} active={mailbox.active} returnTo={`/mailboxes#mailbox-${mailbox.id}`} />
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
