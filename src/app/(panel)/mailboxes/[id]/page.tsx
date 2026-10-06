import { notFound } from "next/navigation";
import { MailboxControls } from "@/components/mailbox-controls";
import { MailboxForm } from "@/components/mailbox-form";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { deleteMailbox, installStarterRules, testMailboxImap } from "@/server/mailboxes";

export default async function MailboxPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const mailbox = await prisma.mailbox.findUnique({ where: { id } });
  if (!mailbox) notFound();
  return (
    <>
      <PageTitle
        title={mailbox.name}
        text={`${mailbox.address}. IMAP-пароль: ${mailbox.imapPasswordEnc ? "сохранён" : "нет"}.`}
        back={{ href: `/mailboxes#mailbox-${id}`, label: "К правилам ящика" }}
      />
      <Notice text={query.notice} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MailboxControls id={id} active={mailbox.active} returnTo={`/mailboxes/${id}`} />
        <form action={testMailboxImap}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Проверить IMAP</button></form>
        <form action={installStarterRules}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Добавить исключения</button></form>
        <ConfirmDelete
          action={deleteMailbox}
          id={id}
          label="Удалить ящик"
          title="Удалить ящик"
          text={`Ящик «${mailbox.name}», его правила, письма, уведомления и метрики будут удалены.`}
        />
      </div>
      <p className="mb-4 text-sm text-muted">
        Курсор: {mailbox.initialized ? `UID ${mailbox.lastUid?.toString() ?? "0"}, UIDVALIDITY ${mailbox.uidValidity?.toString() ?? "—"}` : "будет установлен при первой проверке без чтения старых писем"}.
        {mailbox.lastError || ""}
      </p>
      <MailboxForm mailbox={mailbox} />
    </>
  );
}
