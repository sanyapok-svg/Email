import { notFound } from "next/navigation";
import { RuleForm } from "@/components/rule-form";
import { RuleNotifySwitch } from "@/components/rule-notify-switch";
import { Notice, PageTitle } from "@/components/shell";
import { requireAccount } from "@/lib/auth/account";
import { prisma } from "@/lib/db";
import type { Condition, ConditionGroup } from "@/lib/rules/types";
import { isGroup } from "@/lib/rules/types";
import { normalizeAction, parsePolicy, readNotifyPolicy } from "@/lib/rules/parse";

export default async function RulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const { accountId } = await requireAccount();
  const rule = await prisma.rule.findFirst({ where: { id, mailbox: { accountId } } });
  if (!rule || rule.type !== "notify") notFound();
  const [mailboxes, recipients, mailbox] = await Promise.all([
    prisma.mailbox.findMany({ where: { accountId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.b24Recipient.findMany({ where: { accountId }, orderBy: { name: "asc" }, select: { id: true, name: true, login: true, externalId: true, telegramChatId: true, active: true, dismissed: true } }),
    prisma.mailbox.findFirst({ where: { id: rule.mailboxId, accountId }, select: { notifyOutsidePolicy: true } }),
  ]);
  const group = isGroup(rule.conditions as ConditionGroup) ? (rule.conditions as ConditionGroup) : { op: "all" as const, conditions: [] };
  const action = normalizeAction(rule.action);
  const mailboxName = mailboxes.find((item) => item.id === rule.mailboxId)?.name;
  return (
    <>
      <PageTitle
        title={rule.name}
        text={mailboxName ? `Правило ящика ${mailboxName}` : undefined}
        back={{ href: `/mailboxes#mailbox-${rule.mailboxId}`, label: "К правилам ящика" }}
      />
      <Notice text={query.notice} />
      <div className="mb-4">
        <RuleNotifySwitch id={rule.id} enabled={rule.active && action.notificationEnabled} returnTo={`/rules/${rule.id}`} />
      </div>
      <RuleForm
        mailboxes={mailboxes}
        recipients={recipients}
        initial={{
          id: rule.id,
          mailboxId: rule.mailboxId,
          name: rule.name,
          notifies: rule.active && action.notificationEnabled,
          category: rule.category,
          op: group.op,
          conditions: group.conditions.filter((item): item is Condition => !isGroup(item)).map((item) => ({
            field: item.field,
            operator: item.operator,
            value: Array.isArray(item.value) ? item.value.join(", ") : String(item.value ?? ""),
          })),
          priority: action.priority,
          responseHours: action.responseHours,
          previewChars: action.previewChars,
          recipientIds: action.recipientIds,
          notifyChannel: action.notifyChannels.includes("telegram") ? "telegram" : "bitrix",
          notifyOutsidePolicy: readNotifyPolicy(rule.action) ?? parsePolicy(mailbox?.notifyOutsidePolicy || "defer"),
          noticeGrouping: action.noticeGrouping,
          noticeFields: action.noticeFields,
          forwardEnabled: action.forwardEnabled,
          forwardSource: action.forwardSource,
          forwardAddress: action.forwardAddress,
          forwardRecipientId: action.forwardRecipientId,
        }}
      />
    </>
  );
}
