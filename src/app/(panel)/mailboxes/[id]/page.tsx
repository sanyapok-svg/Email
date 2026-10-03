import { notFound } from "next/navigation";
import { MailboxCheck } from "@/components/mailbox-check";
import { checkSettingsFrom } from "@/lib/mail/check-settings";
import { MailboxControls } from "@/components/mailbox-controls";
import { MailboxForm } from "@/components/mailbox-form";
import { MailboxRules } from "@/components/mailbox-rules";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { installStarterRules, testMailboxImap } from "@/server/mailboxes";

export default async function MailboxPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const mailbox = await prisma.mailbox.findUnique({
    where: { id },
    include: {
      rules: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, type: true, position: true, active: true, category: true },
      },
    },
  });
  if (!mailbox) notFound();
  return (
    <>
      <PageTitle title={mailbox.name} text={`${mailbox.address}. IMAP-пароль: ${mailbox.imapPasswordEnc ? "сохранён" : "нет"}.`} />
      <Notice text={query.notice ? decodeURIComponent(query.notice) : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MailboxControls id={id} active={mailbox.active} returnTo={`/mailboxes/${id}`} />
        <form action={testMailboxImap}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Проверить IMAP</button></form>
        <form action={installStarterRules}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Добавить исключения</button></form>
      </div>
      <p className="mb-4 text-sm text-muted">
        Курсор: {mailbox.initialized ? `UID ${mailbox.lastUid?.toString() ?? "0"}, UIDVALIDITY ${mailbox.uidValidity?.toString() ?? "—"}` : "будет установлен при первой проверке без чтения старых писем"}.
        {mailbox.lastError || ""}
      </p>
      <div id="check" className="mb-6 overflow-hidden rounded-xl border border-line bg-card">
        <MailboxCheck
          mailboxId={mailbox.id}
          settings={checkSettingsFrom(mailbox)}
          returnTo={`/mailboxes/${mailbox.id}#check`}
          panelId="check"
          defaultOpen
        />
      </div>
      <div id="rules" className="mb-6 overflow-hidden rounded-xl border border-line bg-card">
        <MailboxRules
          mailboxId={mailbox.id}
          rules={mailbox.rules}
          returnTo={`/mailboxes/${mailbox.id}#rules`}
          panelId="rules"
          defaultOpen
        />
      </div>
      <MailboxForm mailbox={mailbox} />
    </>
  );
}
