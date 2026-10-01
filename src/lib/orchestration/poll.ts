import type { Mailbox, Prisma } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { ImapConnector, safeError } from "@/lib/imap/connector";
import { logEvent } from "@/lib/log";
import { buildNormalizedMessage, buildSearchDocument } from "@/lib/mail/pipeline";
import type { NormalizedMessage } from "@/lib/mail/model";
import { bumpMetrics } from "@/lib/metrics/counters";
import { withLock } from "@/lib/locks";
import { decideMessage, type DecideContext } from "@/lib/orchestration/decide";
import { firstMatchingRule } from "@/lib/rules/engine";
import { parsePolicy, parseSchedule, parseStoredRule } from "@/lib/rules/parse";
import { getIntegrationConfig } from "@/lib/settings";

const REAL_NOTICE = ["pending", "scheduled", "sending", "sent"];

export async function pollDueMailboxes() {
  const mailboxes = await prisma.mailbox.findMany({ where: { active: true }, select: { id: true, pollIntervalSec: true, lastCheckedAt: true } });
  const now = Date.now();
  for (const mailbox of mailboxes) {
    const interval = Math.max(60, mailbox.pollIntervalSec) * 1000;
    if (mailbox.lastCheckedAt && now - mailbox.lastCheckedAt.getTime() < interval) continue;
    await pollMailbox(mailbox.id);
  }
}

export async function pollMailbox(mailboxId: string, options: { force?: boolean } = {}) {
  return withLock(`poll:${mailboxId}`, 90_000, async () => {
    const mailbox = await prisma.mailbox.findUnique({ where: { id: mailboxId } });
    if (!mailbox || !mailbox.active) return;
    if (!options.force && mailbox.lastCheckedAt) {
      const interval = Math.max(60, mailbox.pollIntervalSec) * 1000;
      if (Date.now() - mailbox.lastCheckedAt.getTime() < interval) return;
    }
    const password = decryptSecret(mailbox.imapPasswordEnc);
    const connector = new ImapConnector({
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.imapSecure,
      user: mailbox.imapUser,
      password,
    });
    try {
      await connector.connect();
      const status = await connector.examineInbox();
      if (!mailbox.initialized || mailbox.uidValidity !== status.uidValidity) {
        await prisma.mailbox.update({
          where: { id: mailbox.id },
          data: {
            initialized: true,
            uidValidity: status.uidValidity,
            lastUid: status.uidNext > 0n ? status.uidNext - 1n : 0n,
            lastCheckedAt: new Date(),
            consecutiveErrors: 0,
            lastError: null,
          },
        });
        logEvent("info", "imap.initialized", { mailboxId: mailbox.id, uidValidity: status.uidValidity.toString() });
        return;
      }
      const batch = Math.min(10, Math.max(1, mailbox.batchSize));
      const uids = await connector.searchUidsAfter(mailbox.lastUid ?? 0n, batch);
      for (const uid of uids) {
        await processUid(connector, mailbox, uid, status.uidValidity);
      }
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { lastCheckedAt: new Date(), consecutiveErrors: 0, lastError: null },
      });
    } catch (error) {
      const message = safeError(error, [password]);
      await prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { consecutiveErrors: { increment: 1 }, lastError: message, lastCheckedAt: new Date() },
      });
      logEvent("error", "imap.poll_failed", { mailboxId: mailbox.id, message });
    } finally {
      await connector.close();
    }
  });
}

async function processUid(connector: ImapConnector, mailbox: Mailbox, uid: bigint, uidValidity: bigint) {
  const started = Date.now();
  const existing = await prisma.processedMessage.findUnique({
    where: { mailboxId_uid_uidValidity: { mailboxId: mailbox.id, uid, uidValidity } },
  });
  if (existing) {
    await advance(mailbox.id, uid);
    return;
  }
  try {
    const fetched = await connector.fetchMessage(uid, mailbox.bodyCharLimit);
    const normalized = await buildNormalizedMessage({
      ...fetched,
      timezone: mailbox.timezone,
      entityLimit: mailbox.entityListLimit,
      bodyCharLimit: mailbox.bodyCharLimit,
      receivedAt: fetched.internalDate ?? new Date(),
    });
    if (fetched.truncatedBySize) normalized.bodyTruncated = true;
    if (!normalized.sentAt) normalized.sentAt = fetched.internalDate;
    await persistMessage(mailbox, uid, uidValidity, normalized, Date.now() - started);
  } catch (error) {
    const message = safeError(error, []);
    await prisma.processedMessage.create({
      data: {
        mailboxId: mailbox.id,
        uid,
        uidValidity,
        receivedAt: new Date(),
        decision: "error",
        errorCode: "parse_error",
        errorMessage: message,
        subject: "",
        searchDocument: "",
      },
    });
    await advance(mailbox.id, uid);
    await bumpMetrics(mailbox.id, mailbox.timezone, { received: 1, bodyErrors: 1 });
    logEvent("error", "mail.parse_failed", { mailboxId: mailbox.id, uid: uid.toString(), message });
  }
}

async function persistMessage(mailbox: Mailbox, uid: bigint, uidValidity: bigint, message: NormalizedMessage, elapsedMs: number) {
  const config = await getIntegrationConfig();
  const rules = (await prisma.rule.findMany({ where: { mailboxId: mailbox.id } })).flatMap((row) => {
    const parsed = parseStoredRule(row);
    return parsed ? [parsed] : [];
  });
  const matched = firstMatchingRule(rules, message);
  const template = matched?.action.templateId
    ? await prisma.replyTemplate.findFirst({ where: { id: matched.action.templateId, mailboxId: mailbox.id, active: true } })
    : null;
  const ctx = await decideContext(mailbox, message, uid, config, template?.bodyText ?? null, matched?.id ?? null);
  const decision = decideMessage(message, rules, ctx);
  const maxAttempts = config.notifyMaxAttempts;
  const replyAttempts = config.replyMaxAttempts;

  await prisma.$transaction(async (tx) => {
    const saved = await tx.processedMessage.create({
      data: messageData(mailbox.id, uid, uidValidity, message, decision.decision, decision.rule?.id ?? null),
    });
    if (decision.notification) {
      const duplicate = await tx.notification.findUnique({ where: { idempotencyKey: decision.notification.idempotencyKey } });
      if (!duplicate) await tx.notification.create({
        data: {
          mailboxId: mailbox.id,
          messageId: saved.id,
          ruleId: decision.rule?.id,
          idempotencyKey: decision.notification.idempotencyKey,
          status: decision.notification.status,
          priority: decision.notification.priority,
          category: decision.notification.category,
          responseDueAt: decision.notification.responseDueAt,
          overdue: decision.notification.overdue,
          dueRisk: decision.notification.dueRisk,
          payload: decision.notification.payload as Prisma.InputJsonValue,
          scheduledAt: decision.notification.scheduledAt,
          maxAttempts,
        },
      });
    }
    if (decision.reply) {
      const duplicateReply = await tx.outboundReply.findUnique({ where: { idempotencyKey: decision.reply.idempotencyKey } });
      if (!duplicateReply) await tx.outboundReply.create({
        data: {
          mailboxId: mailbox.id,
          messageId: saved.id,
          ruleId: decision.rule?.id,
          templateId: decision.reply.templateId,
          kind: "auto",
          idempotencyKey: decision.reply.idempotencyKey,
          status: decision.reply.status,
          toAddress: decision.reply.toAddress,
          subject: decision.reply.subject,
          bodyText: decision.reply.bodyText,
          inReplyTo: decision.reply.inReplyTo,
          references: decision.reply.references,
          warnings: decision.reply.warnings,
          suppressedReason: decision.reply.suppressedReason,
          scheduledAt: decision.reply.scheduledAt,
          maxAttempts: replyAttempts,
        },
      });
    }
    await tx.mailbox.update({ where: { id: mailbox.id }, data: { lastUid: uid } });
  });

  await bumpMetrics(mailbox.id, mailbox.timezone, metricDelta(message, decision.decision, decision.notification?.status, decision.reply?.status, elapsedMs));
  logEvent("info", "mail.processed", {
    mailboxId: mailbox.id,
    uid: uid.toString(),
    ruleId: decision.rule?.id ?? null,
    decision: decision.decision,
    ms: elapsedMs,
  });
}

async function decideContext(
  mailbox: Mailbox,
  message: NormalizedMessage,
  uid: bigint,
  config: Awaited<ReturnType<typeof getIntegrationConfig>>,
  templateBody: string | null,
  ruleId: string | null,
): Promise<DecideContext> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recipient = message.replyTo[0] || message.fromEmail;
  const [ruleNotificationsLastHour, mailboxRepliesLastHour, recipientRepliesLastDay, senderPaused, subjectPaused, domainPaused] =
    await Promise.all([
      prisma.notification.count({
        where: { ruleId: ruleId ?? "none", createdAt: { gte: hourAgo }, status: { in: REAL_NOTICE } },
      }),
      prisma.outboundReply.count({
        where: { mailboxId: mailbox.id, kind: "auto", createdAt: { gte: hourAgo }, status: { in: REAL_NOTICE } },
      }),
      prisma.outboundReply.count({
        where: { mailboxId: mailbox.id, kind: "auto", toAddress: recipient, createdAt: { gte: dayAgo }, status: { in: REAL_NOTICE } },
      }),
      paused(mailbox.senderPauseMinutes, { mailboxId: mailbox.id, message: { fromEmail: message.fromEmail } }),
      paused(mailbox.subjectPauseMinutes, { mailboxId: mailbox.id, message: { subjectNormalized: message.subjectNormalized } }),
      paused(mailbox.domainPauseMinutes, { mailboxId: mailbox.id, message: { fromDomain: message.fromDomain } }),
    ]);
  return {
    now: new Date(),
    mailboxId: mailbox.id,
    mailboxName: mailbox.name,
    uid: uid.toString(),
    schedule: parseSchedule(mailbox),
    notifyOutsidePolicy: parsePolicy(mailbox.notifyOutsidePolicy),
    replyOutsidePolicy: parsePolicy(mailbox.replyOutsidePolicy),
    globalDryRun: config.globalDryRun,
    mailboxDryRun: mailbox.dryRun,
    blocklist: Array.isArray(mailbox.autoReplyBlocklist) ? mailbox.autoReplyBlocklist.map(String) : [],
    templateBody,
    throttle: {
      ruleNotificationsLastHour,
      notifyPerHour: mailbox.notifyPerHour,
      senderPaused,
      subjectPaused,
      domainPaused,
      mailboxRepliesLastHour,
      replyPerHour: mailbox.replyPerHour,
      recipientRepliesLastDay,
      replyPerRecipientDay: mailbox.replyPerRecipientDay,
    },
    previewInNotification: config.includeBodyPreview,
    previewChars: config.previewChars,
    globalMessageDedupe: config.globalMessageDedupe,
    repliesEnabled: mailbox.repliesEnabled && !mailbox.repliesPaused,
  };
}

async function paused(minutes: number, where: Prisma.NotificationWhereInput): Promise<boolean> {
  if (!minutes || minutes <= 0) return false;
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const count = await prisma.notification.count({ where: { ...where, createdAt: { gte: since }, status: { in: REAL_NOTICE } } });
  return count > 0;
}

function messageData(
  mailboxId: string,
  uid: bigint,
  uidValidity: bigint,
  message: NormalizedMessage,
  decision: string,
  matchedRuleId: string | null,
): Prisma.ProcessedMessageCreateInput {
  return {
    mailbox: { connect: { id: mailboxId } },
    uid,
    uidValidity,
    messageIdHeader: message.messageId,
    receivedAt: message.receivedAt,
    sentAt: message.sentAt,
    subject: message.subject,
    subjectNormalized: message.subjectNormalized,
    fromEmail: message.fromEmail,
    fromDisplayName: message.fromDisplayName,
    fromDomain: message.fromDomain,
    fromTld: message.fromTld,
    toRecipients: message.to,
    ccRecipients: message.cc,
    replyTo: message.replyTo,
    sizeBytes: message.sizeBytes,
    attachmentCount: message.attachmentCount,
    attachmentNames: message.attachmentNames,
    attachmentExtensions: message.attachmentExtensions,
    headersSnapshot: message.headers,
    bodyFullText: message.bodyFullText,
    bodyNewText: message.bodyNewText,
    bodyPreview: message.bodyPreview,
    bodyTruncated: message.bodyTruncated,
    bodyUnavailable: message.bodyUnavailable,
    bodyError: message.bodyError,
    quoteSplitConfidence: message.quoteSplitConfidence,
    language: message.language,
    languageConfidence: message.languageConfidence,
    sentiment: message.sentiment,
    sentimentScore: message.sentimentScore,
    urgencyLevel: message.urgencyLevel,
    urgencyScore: message.urgencyScore,
    phonesRaw: message.phonesRaw,
    phonesNormalized: message.phonesNormalized,
    emails: message.emails,
    urls: message.urls,
    urlDomains: message.urlDomains,
    urlDomainMismatch: message.urlDomainMismatch,
    dates: message.dates as unknown as Prisma.InputJsonValue,
    deadlines: message.deadlines as unknown as Prisma.InputJsonValue,
    earliestDeadline: message.earliestDeadline ? new Date(message.earliestDeadline) : null,
    amounts: message.amounts as unknown as Prisma.InputJsonValue,
    currencies: message.currencies,
    contractNumbers: message.contractNumbers,
    invoiceNumbers: message.invoiceNumbers,
    actNumbers: message.actNumbers,
    ticketIds: message.ticketIds,
    innNumbers: message.innNumbers,
    kppNumbers: message.kppNumbers,
    ogrnNumbers: message.ogrnNumbers,
    bankAccountCandidates: message.bankAccountCandidates,
    entityListsTruncated: message.entityListsTruncated,
    decision,
    matchedRule: matchedRuleId ? { connect: { id: matchedRuleId } } : undefined,
    searchDocument: buildSearchDocument(message),
  };
}

function metricDelta(
  message: NormalizedMessage,
  decision: string,
  noticeStatus?: string,
  replyStatus?: string,
  elapsedMs = 0,
) {
  return {
    received: 1,
    parsed: message.bodyError === "encrypted" ? 0 : 1,
    bodyErrors: message.bodyError && message.bodyError !== "empty" ? 1 : 0,
    bodyTruncated: message.bodyTruncated ? 1 : 0,
    phones: message.phonesNormalized.length,
    emails: message.emails.length,
    urls: message.urls.length,
    amounts: message.amounts.length,
    contracts: message.contractNumbers.length,
    deadlines: message.deadlines.length,
    excluded: decision === "exclude" ? 1 : 0,
    skipped: decision === "skipped_no_rule" ? 1 : 0,
    notified: noticeStatus === "pending" || noticeStatus === "scheduled" ? 1 : 0,
    dryRun: noticeStatus === "dry_run" || replyStatus === "dry_run" ? 1 : 0,
    throttledNotifications: noticeStatus === "throttled" ? 1 : 0,
    throttledReplies: replyStatus === "throttled" ? 1 : 0,
    suppressedReplies: replyStatus === "suppressed" ? 1 : 0,
    deferredNotifications: noticeStatus === "scheduled" ? 1 : 0,
    deferredReplies: replyStatus === "scheduled" ? 1 : 0,
    autoReplies: replyStatus === "pending" || replyStatus === "scheduled" ? 1 : 0,
    processingMs: elapsedMs,
    languages: { [message.language]: 1 },
    sentiments: { [message.sentiment]: 1 },
    urgencies: { [message.urgencyLevel]: 1 },
  };
}

async function advance(mailboxId: string, uid: bigint) {
  await prisma.mailbox.update({ where: { id: mailboxId }, data: { lastUid: uid } });
}
