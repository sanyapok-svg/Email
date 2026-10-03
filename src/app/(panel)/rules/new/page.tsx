import { RuleForm } from "@/components/rule-form";
import { PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";

export default async function NewRulePage({ searchParams }: { searchParams: Promise<{ mailboxId?: string }> }) {
  const params = await searchParams;
  const [mailboxes, recipients, mailboxPolicy] = await Promise.all([
    prisma.mailbox.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.b24Recipient.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, login: true, externalId: true, active: true } }),
    params.mailboxId
      ? prisma.mailbox.findUnique({ where: { id: params.mailboxId }, select: { notifyOutsidePolicy: true } })
      : Promise.resolve(null),
  ]);
  const mailbox = mailboxes.find((item) => item.id === params.mailboxId) || mailboxes[0];
  return (
    <>
      <PageTitle
        title={mailbox ? `Новое правило · ${mailbox.name}` : "Новое правило"}
        text="Пустая группа условий не совпадёт ни с чем. Для правила «всё остальное» добавьте оператор «всегда»."
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
