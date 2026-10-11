import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { forwardLetter, resolveForwardAddress, type ForwardEmployee } from "@/lib/mail/forward";
import { parseStoredRule } from "@/lib/rules/parse";
import type { RuleRecord } from "@/lib/rules/types";
import { getIntegrationConfig } from "@/lib/settings";

const CATCH_UP_MS = 48 * 60 * 60 * 1000;
const CATCH_UP_LIMIT = 20;

export async function resolveForwardTargets(rules: RuleRecord[]): Promise<Array<{ rule: RuleRecord; to: string }>> {
  const wanted = rules.filter((rule) => rule.action.forwardEnabled);
  if (!wanted.length) return [];
  const ids = [...new Set(wanted.map((rule) => rule.action.forwardRecipientId).filter(Boolean))];
  const people = ids.length
    ? await prisma.b24Recipient.findMany({ where: { id: { in: ids } }, select: { id: true, login: true, active: true, dismissed: true } })
    : [];
  const byId = new Map<string, ForwardEmployee>(people.map((person) => [person.id, person]));
  const planned: Array<{ rule: RuleRecord; to: string }> = [];
  for (const rule of wanted) {
    const to = resolveForwardAddress(rule.action, byId.get(rule.action.forwardRecipientId) ?? null);
    if (!to) {
      logEvent("warn", "forward.no_address", { ruleId: rule.id });
      continue;
    }
    planned.push({ rule, to });
  }
  return planned;
}

export async function queueMissingForwards(): Promise<void> {
  const since = new Date(Date.now() - CATCH_UP_MS);
  const rows = await prisma.rule.findMany({ where: { active: true, type: "notify" } });
  const rules = rows.flatMap((row) => {
    const parsed = parseStoredRule(row);
    return parsed?.action.forwardEnabled ? [{ rule: parsed, mailboxId: row.mailboxId }] : [];
  });
  if (!rules.length) return;
  const targets = await resolveForwardTargets(rules.map((item) => item.rule));
  const mailboxByRule = new Map(rules.map((item) => [item.rule.id, item.mailboxId]));
  const config = await getIntegrationConfig();
  for (const target of targets) {
    const mailboxId = mailboxByRule.get(target.rule.id);
    if (!mailboxId) continue;
    const messages = await prisma.processedMessage.findMany({
      where: {
        mailboxId,
        createdAt: { gte: since },
        OR: [{ matchedRuleId: target.rule.id }, { notifications: { some: { ruleId: target.rule.id } } }],
        replies: { none: { kind: "forward", ruleId: target.rule.id } },
      },
      orderBy: { createdAt: "desc" },
      take: CATCH_UP_LIMIT,
    });
    for (const message of messages) {
      const letter = forwardLetter({
        subject: message.subject,
        fromDisplayName: message.fromDisplayName,
        fromEmail: message.fromEmail,
        to: message.toRecipients,
        receivedAt: message.receivedAt,
        bodyFullText: message.bodyFullText,
        bodyNewText: message.bodyNewText,
        attachmentNames: message.attachmentNames,
      });
      try {
        await prisma.outboundReply.create({
          data: {
            mailboxId,
            messageId: message.id,
            ruleId: target.rule.id,
            kind: "forward",
            idempotencyKey: `forward:${mailboxId}:${message.uid.toString()}:${target.rule.id}`,
            status: "pending",
            toAddress: target.to,
            subject: letter.subject,
            bodyText: letter.text,
            maxAttempts: config.replyMaxAttempts,
          },
        });
        logEvent("info", "forward.queued", { mailboxId, messageId: message.id, ruleId: target.rule.id });
      } catch (error) {
        if (!isUnique(error)) throw error;
      }
    }
  }
}

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
