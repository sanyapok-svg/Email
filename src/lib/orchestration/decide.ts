import type { WorkSchedule } from "@/lib/hours/schedule";
import { planByWorkingHours, type OutsidePolicy } from "@/lib/hours/schedule";
import type { NormalizedMessage } from "@/lib/mail/model";
import { firstMatchingRule } from "@/lib/rules/engine";
import type { RuleRecord } from "@/lib/rules/types";
import { autoReplySuppression } from "@/lib/replies/safety";
import { renderTemplate, replyRecipients, replySubject } from "@/lib/replies/render";

export type DecisionName = "exclude" | "notify" | "reply_only" | "notify_and_reply" | "skipped_no_rule";
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

export type ReplyDraft = {
  status: QueueStatus;
  toAddress: string;
  subject: string;
  bodyText: string;
  inReplyTo: string | null;
  references: string | null;
  warnings: string[];
  suppressedReason: string | null;
  scheduledAt: Date | null;
  idempotencyKey: string;
  templateId: string | null;
};

export type Decision = {
  decision: DecisionName;
  rule: RuleRecord | null;
  notification: NotificationDraft | null;
  reply: ReplyDraft | null;
};

export type DecideContext = {
  now: Date;
  mailboxId: string;
  mailboxName: string;
  uid: string;
  schedule: WorkSchedule;
  notifyOutsidePolicy: OutsidePolicy;
  replyOutsidePolicy: OutsidePolicy;
  globalDryRun: boolean;
  mailboxDryRun: boolean;
  blocklist: string[];
  templateBody: string | null;
  throttle: {
    ruleNotificationsLastHour: number;
    notifyPerHour: number;
    senderPaused: boolean;
    subjectPaused: boolean;
    domainPaused: boolean;
    mailboxRepliesLastHour: number;
    replyPerHour: number;
    recipientRepliesLastDay: number;
    replyPerRecipientDay: number;
  };
  previewInNotification: boolean;
  previewChars: number;
  globalMessageDedupe: boolean;
  repliesEnabled: boolean;
};

export function decideMessage(message: NormalizedMessage, rules: RuleRecord[], ctx: DecideContext): Decision {
  const rule = firstMatchingRule(rules, message);
  if (!rule) return { decision: "skipped_no_rule", rule: null, notification: null, reply: null };
  if (rule.type === "exclude") return { decision: "exclude", rule, notification: null, reply: null };

  const wantsNotice = rule.action.notificationEnabled;
  const wantsReply = rule.action.autoReplyEnabled && Boolean(rule.action.templateId);
  if (!wantsNotice && !wantsReply) return { decision: "skipped_no_rule", rule, notification: null, reply: null };

  const dryRun = ctx.globalDryRun || ctx.mailboxDryRun || rule.dryRun;
  const notification = wantsNotice ? buildNotification(message, rule, ctx, dryRun) : null;
  const reply = wantsReply ? buildReply(message, rule, ctx, dryRun) : null;
  const decision: DecisionName = wantsNotice && reply ? "notify_and_reply" : wantsNotice ? "notify" : "reply_only";
  return { decision, rule, notification, reply };
}

function buildNotification(
  message: NormalizedMessage,
  rule: RuleRecord,
  ctx: DecideContext,
  dryRun: boolean,
): NotificationDraft {
  const due = responseDue(message, rule, ctx.now);
  const window = planByWorkingHours(ctx.now, ctx.schedule, ctx.notifyOutsidePolicy);
  const throttled =
    rule.action.throttlingEnabled &&
    (ctx.throttle.ruleNotificationsLastHour >= ctx.throttle.notifyPerHour ||
      ctx.throttle.senderPaused ||
      ctx.throttle.subjectPaused ||
      ctx.throttle.domainPaused);
  const status: QueueStatus = dryRun ? "dry_run" : throttled ? "throttled" : window.status === "cancelled" ? "cancelled" : window.status;
  const preview = ctx.previewInNotification ? (message.bodyNewText || message.bodyFullText).slice(0, ctx.previewChars) : undefined;
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
      from: message.fromDisplayName ? `${message.fromDisplayName} <${message.fromEmail}>` : message.fromEmail,
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
      ...(preview ? { preview } : {}),
    },
  };
}

function buildReply(message: NormalizedMessage, rule: RuleRecord, ctx: DecideContext, dryRun: boolean): ReplyDraft {
  const warnings: string[] = [];
  if (!message.messageId) warnings.push("missing-message-id");
  const suppression = !ctx.repliesEnabled ? "replies-disabled" : autoReplySuppression(message, ctx.blocklist);
  const policy = rule.action.replyRespectWorkingHours ? ctx.replyOutsidePolicy : "send_now";
  const window = planByWorkingHours(ctx.now, ctx.schedule, policy);
  const throttled =
    rule.action.throttlingEnabled &&
    (ctx.throttle.mailboxRepliesLastHour >= ctx.throttle.replyPerHour ||
      ctx.throttle.recipientRepliesLastDay >= ctx.throttle.replyPerRecipientDay);
  let status: QueueStatus = "pending";
  if (suppression) status = "suppressed";
  else if (dryRun) status = "dry_run";
  else if (throttled) status = "throttled";
  else if (window.status === "cancelled") status = "cancelled";
  else status = window.status;
  const references = [message.headers.references, message.messageId].filter(Boolean).join(" ").trim() || null;
  return {
    status,
    toAddress: replyRecipients(message),
    subject: replySubject(message.subject),
    bodyText: renderTemplate(ctx.templateBody || "", message, {
      category: rule.category,
      priority: rule.action.priority,
      mailboxName: ctx.mailboxName,
      messageRef: message.messageId || ctx.uid,
    }),
    inReplyTo: message.messageId,
    references,
    warnings,
    suppressedReason: suppression,
    scheduledAt: status === "scheduled" ? window.scheduledAt : null,
    idempotencyKey: `auto:${ctx.mailboxId}:${ctx.uid}:${rule.id}:${rule.action.templateId}`,
    templateId: rule.action.templateId || null,
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
