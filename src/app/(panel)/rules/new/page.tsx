import { RuleForm } from "@/components/rule-form";
import { PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";

export default async function NewRulePage({ searchParams }: { searchParams: Promise<{ mailboxId?: string }> }) {
  const params = await searchParams;
  const [mailboxes, templates, recipients] = await Promise.all([
    prisma.mailbox.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.replyTemplate.findMany({ where: { active: true }, select: { id: true, name: true, mailboxId: true } }),
    prisma.b24Recipient.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, login: true, externalId: true, active: true } }),
  ]);
  return (
    <>
      <PageTitle title="Новое правило" text="Пустая группа условий не совпадёт ни с чем. Для правила «всё остальное» добавьте оператор «всегда»." />
      <RuleForm mailboxId={params.mailboxId} mailboxes={mailboxes} templates={templates} recipients={recipients} />
    </>
  );
}
