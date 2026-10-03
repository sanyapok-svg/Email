import { notFound } from "next/navigation";
import { RuleForm } from "@/components/rule-form";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import type { Condition, ConditionGroup } from "@/lib/rules/types";
import { isGroup } from "@/lib/rules/types";
import { normalizeAction, parsePolicy, readNotifyPolicy } from "@/lib/rules/parse";

export default async function RulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) notFound();
  const [mailboxes, recipients, mailbox] = await Promise.all([
    prisma.mailbox.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.b24Recipient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, login: true, externalId: true, active: true } }),
    prisma.mailbox.findUnique({ where: { id: rule.mailboxId }, select: { notifyOutsidePolicy: true } }),
  ]);
  const group = isGroup(rule.conditions as ConditionGroup) ? (rule.conditions as ConditionGroup) : { op: "all" as const, conditions: [] };
  const action = normalizeAction(rule.action);
  const mailboxName = mailboxes.find((item) => item.id === rule.mailboxId)?.name;
  return (
    <>
      <PageTitle title={rule.name} text={mailboxName ? `Правило ящика ${mailboxName}` : undefined} />
      <Notice text={query.notice} />
      <RuleForm
        mailboxes={mailboxes}
        recipients={recipients}
        initial={{
          id: rule.id,
          mailboxId: rule.mailboxId,
          name: rule.name,
          type: rule.type,
          position: rule.position,
          active: rule.active,
          category: rule.category,
          op: group.op,
          conditions: group.conditions.filter((item): item is Condition => !isGroup(item)).map((item) => ({
            field: item.field,
            operator: item.operator,
            value: Array.isArray(item.value) ? item.value.join(", ") : String(item.value ?? ""),
          })),
          notificationEnabled: action.notificationEnabled,
          priority: action.priority,
          responseHours: action.responseHours,
          useExtractedDeadline: action.useExtractedDeadline,
          recipientIds: action.recipientIds,
          throttlingEnabled: action.throttlingEnabled,
          notifyOutsidePolicy: readNotifyPolicy(rule.action) ?? parsePolicy(mailbox?.notifyOutsidePolicy || "defer"),
          noticeGrouping: action.noticeGrouping,
          noticeFields: action.noticeFields,
        }}
      />
    </>
  );
}
