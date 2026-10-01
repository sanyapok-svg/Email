import { notFound } from "next/navigation";
import { MailboxForm } from "@/components/mailbox-form";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { installStarterRules, pollMailboxNow, resumeReplies, testMailboxImap, testMailboxSmtp } from "@/server/mailboxes";

export default async function MailboxPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const mailbox = await prisma.mailbox.findUnique({ where: { id } });
  if (!mailbox) notFound();
  return (
    <>
      <PageTitle title={mailbox.name} text={`${mailbox.address}. IMAP-пароль: ${mailbox.imapPasswordEnc ? "сохранён" : "нет"}. SMTP-пароль: ${mailbox.smtpPasswordEnc ? "сохранён" : "нет"}.`} />
      <Notice text={query.notice ? decodeURIComponent(query.notice) : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        <form action={testMailboxImap}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Проверить IMAP</button></form>
        <form action={testMailboxSmtp}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Проверить SMTP</button></form>
        <form action={pollMailboxNow}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Проверить почту сейчас</button></form>
        <form action={installStarterRules}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Добавить исключения</button></form>
        {mailbox.repliesPaused ? <form action={resumeReplies}><input type="hidden" name="id" value={id} /><button className="secondary" type="submit">Возобновить ответы</button></form> : null}
      </div>
      <p className="mb-4 text-sm text-muted">
        Курсор: {mailbox.initialized ? `UID ${mailbox.lastUid?.toString() ?? "0"}, UIDVALIDITY ${mailbox.uidValidity?.toString() ?? "—"}` : "будет установлен при первой проверке без чтения старых писем"}.
        {mailbox.repliesPaused ? " Автоответы приостановлены." : ""} {mailbox.lastError || mailbox.smtpLastError || ""}
      </p>
      <MailboxForm mailbox={mailbox} />
    </>
  );
}
