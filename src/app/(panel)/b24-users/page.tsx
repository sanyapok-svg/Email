import { readAbsences } from "@/lib/b24/absences";
import { OPEN_NOTIFICATION_STATUSES, payloadRecipientIds, recipientIdsOf, type DismissalNotice } from "@/lib/b24/dismiss";
import { UsersPanel } from "@/components/users-panel";
import { prisma } from "@/lib/db";

export default async function B24UsersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const [users, rules, queued] = await Promise.all([
    prisma.b24Recipient.findMany({ orderBy: { number: "asc" } }),
    prisma.rule.findMany({ select: { id: true, name: true, type: true, active: true, action: true, mailbox: { select: { name: true } } } }),
    prisma.notification.findMany({
      where: { status: { in: [...OPEN_NOTIFICATION_STATUSES] } },
      select: { ruleId: true, payload: true },
    }),
  ]);
  const names = new Map(users.map((user) => [user.id, user.name]));
  const notifyRules = rules
    .filter((rule) => rule.type === "notify")
    .map((rule) => ({ ...rule, recipientIds: recipientIdsOf(rule.action) }));
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Сотрудники Битрикс24. Их можно выбрать получателями правила. На дни отпуска, больничного или отгула уведомления уходят замещающим; если замещающий и так указан в уведомлении, повторно оно ему не отправится. При увольнении сотрудника его убирают из получателей, заменяют или выключают уведомление, если он был единственным.
      </p>
      <UsersPanel
        notice={params.notice}
        users={users.map((user) => ({
          id: user.id,
          number: user.number,
          login: user.login,
          name: user.name,
          externalId: user.externalId,
          active: user.active,
          dismissed: user.dismissed,
          absences: readAbsences(user.absences),
          notices: noticesFor(user.id),
        }))}
      />
    </>
  );

  function noticesFor(userId: string): DismissalNotice[] {
    return notifyRules
      .filter((rule) => rule.recipientIds.includes(userId))
      .map((rule) => {
        const others = rule.recipientIds.filter((id) => id !== userId);
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          mailboxName: rule.mailbox.name,
          active: rule.active,
          sole: others.length === 0,
          others: others.map((id) => names.get(id) || "сотрудник").join(", "),
          queued: queued.filter((item) => item.ruleId === rule.id && payloadRecipientIds(item.payload).includes(userId)).length,
        };
      });
  }
}
