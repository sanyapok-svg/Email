import { RuleForm } from "@/components/rule-form";
import { PageTitle } from "@/components/shell";
import { requireAccount } from "@/lib/auth/account";
import { prisma } from "@/lib/db";

export default async function NewRulePage({ searchParams }: { searchParams: Promise<{ mailboxId?: string }> }) {
  const params = await searchParams;
  const { accountId } = await requireAccount();
  const [mailboxes, recipients, mailboxPolicy] = await Promise.all([
    prisma.mailbox.findMany({ where: { accountId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.b24Recipient.findMany({ where: { accountId, active: true, dismissed: false }, orderBy: { name: "asc" }, select: { id: true, name: true, login: true, externalId: true, telegramChatId: true, active: true, dismissed: true } }),
    params.mailboxId
      ? prisma.mailbox.findFirst({ where: { id: params.mailboxId, accountId }, select: { notifyOutsidePolicy: true } })
      : Promise.resolve(null),
  ]);
  const mailbox = mailboxes.find((item) => item.id === params.mailboxId) || mailboxes[0];
  return (
    <>
      <PageTitle
        title={mailbox ? `Новое правило · ${mailbox.name}` : "Новое правило"}
        text="Пустая группа условий не совпадёт ни с чем. Для правила «всё остальное» добавьте оператор «всегда»."
        back={mailbox ? { href: `/mailboxes#mailbox-${mailbox.id}`, label: "К правилам ящика" } : undefined}
      />
      <RuleForm
        mailboxId={mailbox?.id || params.mailboxId}
        mailboxes={mailboxes}
        recipients={recipients}
        defaults={{ notifyOutsidePolicy: mailboxPolicy?.notifyOutsidePolicy || "defer" }}
      />
    </>
  );
}
