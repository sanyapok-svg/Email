import { DEFAULT_NOTICE_FIELDS, formatBitrixNotice, formatDueLabel, type NoticeLetter } from "@/lib/b24/notice";
import type { WorkSchedule } from "@/lib/hours/schedule";
import { planByWorkingHours, type OutsidePolicy } from "@/lib/hours/schedule";
import type { NormalizedMessage } from "@/lib/mail/model";
import { firstMatchingRule } from "@/lib/rules/engine";
import type { RuleRecord } from "@/lib/rules/types";

export type DecisionName = "exclude" | "notify" | "skipped_no_rule";
export type QueueStatus = "pending" | "scheduled" | "dry_run" | "throttled" | "suppressed" | "cancelled";

export type NotificationDraft = {
  status: QueueStatus;
  priority: string;
  category: string | null;
  responseDueAt: Date | null;
  overdue: boolean;
  dueRisk: boolean;
  scheduledAt: Date | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export type Decision = {
  decision: DecisionName;
  rule: RuleRecord | null;
  notification: NotificationDraft | null;
};

export type DecideContext = {
  now: Date;
  mailboxId: string;
  mailboxName: string;
  uid: string;
  schedule: WorkSchedule;
  notifyOutsidePolicy: OutsidePolicy;
  throttle: {
    ruleNotificationsLastHour: number;
    notifyPerHour: number;
    senderPaused: boolean;
    subjectPaused: boolean;
    domainPaused: boolean;
  };
  previewChars: number;
  globalMessageDedupe: boolean;
};

export function decideMessage(message: NormalizedMessage, rules: RuleRecord[], ctx: DecideContext): Decision {
  const rule = firstMatchingRule(rules, message);
  if (!rule) return { decision: "skipped_no_rule", rule: null, notification: null };
  if (rule.type === "exclude") return { decision: "exclude", rule, notification: null };

  if (!rule.action.notificationEnabled) return { decision: "skipped_no_rule", rule, notification: null };
  return { decision: "notify", rule, notification: buildNotification(message, rule, ctx) };
}

function buildNotification(message: NormalizedMessage, rule: RuleRecord, ctx: DecideContext): NotificationDraft {
  const due = responseDue(message, rule, ctx.now);
  const window = planByWorkingHours(ctx.now, ctx.schedule, rule.action.notifyOutsidePolicy ?? ctx.notifyOutsidePolicy);
  const throttled =
    rule.action.throttlingEnabled &&
    (ctx.throttle.ruleNotificationsLastHour >= ctx.throttle.notifyPerHour ||
      ctx.throttle.senderPaused ||
      ctx.throttle.subjectPaused ||
      ctx.throttle.domainPaused);
  const status: QueueStatus = throttled ? "throttled" : window.status === "cancelled" ? "cancelled" : window.status;
  const from = message.fromDisplayName ? `${message.fromDisplayName} <${message.fromEmail}>` : message.fromEmail;
  const fields = rule.action.noticeFields ?? DEFAULT_NOTICE_FIELDS;
  const letter = noticeLetter(message, from, ctx.previewChars);
  if (!fields.includes("text")) letter.text = "";
  return {
    status,
    priority: rule.action.priority,
    category: rule.category || rule.action.category || null,
    responseDueAt: due.dueAt,
    overdue: due.overdue,
    dueRisk: window.status === "scheduled" && due.dueAt != null && window.scheduledAt != null && due.dueAt.getTime() < window.scheduledAt.getTime(),
    scheduledAt: window.scheduledAt,
    idempotencyKey: notificationKey(message, rule, ctx),
    payload: {
      idempotencyKey: notificationKey(message, rule, ctx),
      mailboxId: ctx.mailboxId,
      mailboxName: ctx.mailboxName,
      ruleId: rule.id,
      subject: message.subject,
      from,
      noticeFields: fields,
      letter,
      text: formatBitrixNotice({
        mailboxName: ctx.mailboxName,
        priority: rule.action.priority,
        category: rule.category,
        responseDueLabel: formatDueLabel(due.dueAt),
        fields,
        letter,
      }),
      priority: rule.action.priority,
      responseDueAt: due.dueAt?.toISOString() ?? null,
      category: rule.category,
      recipients: rule.action.recipientIds,
      receivedAt: message.receivedAt.toISOString(),
      attachments: message.attachmentNames,
      deadline: message.earliestDeadline,
      phones: message.phonesNormalized,
      urls: message.urls.slice(0, 10),
      contractNumbers: message.contractNumbers,
      invoiceNumbers: message.invoiceNumbers,
      amounts: message.amounts.map((item) => ({ amount: item.amount, currency: item.currency })),
    },
  };
}

function noticeLetter(message: NormalizedMessage, from: string, previewChars: number): NoticeLetter {
  const limit = previewChars > 0 ? previewChars : 400;
  const text = (message.bodyNewText || message.bodyFullText).replace(/\s+/g, " ").trim().slice(0, limit);
  const deadline = message.earliestDeadline ? formatDueLabel(new Date(message.earliestDeadline)) : "";
  return {
    subject: message.subject,
    from,
    received: formatDueLabel(message.receivedAt),
    text,
    attachments: message.attachmentNames,
    phones: message.phonesNormalized,
    urls: message.urls.slice(0, 10),
    contracts: message.contractNumbers,
    invoices: message.invoiceNumbers,
    amounts: message.amounts.map((item) => `${item.amount} ${item.currency || ""}`.trim()),
    deadline: deadline === "не задан" ? "" : deadline,
  };
}

function notificationKey(message: NormalizedMessage, rule: RuleRecord, ctx: DecideContext): string {
  if (ctx.globalMessageDedupe && message.messageId) return `notify:global:${message.messageId}:${rule.id}`;
  return `notify:${ctx.mailboxId}:${ctx.uid}:${rule.id}`;
}

function responseDue(message: NormalizedMessage, rule: RuleRecord, now: Date): { dueAt: Date | null; overdue: boolean } {
  const highConfidence = message.deadlines.find((item) => item.iso === message.earliestDeadline && item.confidence === "high");
  if (rule.action.useExtractedDeadline && highConfidence) {
    const dueAt = new Date(highConfidence.iso);
    if (!Number.isNaN(dueAt.getTime())) return { dueAt, overdue: dueAt.getTime() < now.getTime() };
  }
  const dueAt = new Date(now.getTime() + rule.action.responseHours * 60 * 60 * 1000);
  return { dueAt, overdue: false };
}

export function backoffDate(attempts: number, now = new Date()): Date {
  const minutes = [1, 5, 15, 60, 180][Math.min(attempts, 4)];
  return new Date(now.getTime() + minutes * 60 * 1000);
}
