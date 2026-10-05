import { randomUUID } from "crypto";
import type { Mailbox, Prisma } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { ImapConnector, safeError } from "@/lib/imap/connector";
import { logEvent } from "@/lib/log";
import { isConnectionDue } from "@/lib/mail/next-connection";
import { buildNormalizedMessage, buildSearchDocument } from "@/lib/mail/pipeline";
import type { NormalizedMessage } from "@/lib/mail/model";
import { bumpMetrics } from "@/lib/metrics/counters";
import { withLock } from "@/lib/locks";
import { decideMessage, type DecideContext } from "@/lib/orchestration/decide";
import { DIGEST_PART, flushDigestParts, holdDigest } from "@/lib/orchestration/digest";
import { dispatchQueues } from "@/lib/queues/dispatch";
import { firstMatchingRule } from "@/lib/rules/engine";
import { parsePolicy, parseSchedule, parseStoredRule } from "@/lib/rules/parse";
import { getIntegrationConfig } from "@/lib/settings";

const REAL_NOTICE = ["pending", "scheduled", "sending", "sent"];

export async function pollDueMailboxes() {
  const mailboxes = await prisma.mailbox.findMany({
    where: { active: true, autoPoll: true },
    select: {
      id: true,
      active: true,
      autoPoll: true,
      pollIntervalSec: true,
      lastCheckedAt: true,
      timezone: true,
      workDays: true,
      workIntervals: true,
      holidays: true,
    },
  });
  const now = new Date();
  for (const mailbox of mailboxes) {
    const due = isConnectionDue({
      now,
      lastCheckedAt: mailbox.lastCheckedAt,
      pollIntervalSec: mailbox.pollIntervalSec,
      active: mailbox.active,
      autoPoll: mailbox.autoPoll,
      schedule: parseSchedule(mailbox),
    });
    if (!due) continue;
    await pollMailbox(mailbox.id);
  }
}

export async function pollMailbox(mailboxId: string, options: { force?: boolean } = {}) {
  return withLock(`poll:${mailboxId}`, 90_000, async () => {
    const mailbox = await prisma.mailbox.findUnique({ where: { id: mailboxId } });
    if (!mailbox || !mailbox.active) return;
    if (!options.force && !isConnectionDue({
      now: new Date(),
      lastCheckedAt: mailbox.lastCheckedAt,
      pollIntervalSec: mailbox.pollIntervalSec,
      active: mailbox.active,
      autoPoll: mailbox.autoPoll,
      schedule: parseSchedule(mailbox),
    })) return;
    let deliver = false;
    const pollToken = randomUUID();
    const password = decryptSecret(mailbox.imapPasswordEnc);
    const connector = new ImapConnector({
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.imapSecure,
      user: mailbox.imapUser,
      password,
    });
    deliver = true;
    try {
      await flushDigestParts({ mailboxId: mailbox.id });
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
        await processUid(connector, mailbox, uid, status.uidValidity, pollToken);
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
      if (deliver) {
        try {
          await flushDigestParts({ mailboxId: mailbox.id, pollToken });
        } catch (error) {
          logEvent("error", "notify.digest_failed", { mailboxId: mailbox.id, message: safeError(error, []) });
        }
      }
      await connector.close();
      if (deliver) {
        try {
          await dispatchQueues();
        } catch (error) {
          logEvent("error", "queue.dispatch_failed", { message: safeError(error, []) });
        }
      }
    }
  });
}

async function processUid(connector: ImapConnector, mailbox: Mailbox, uid: bigint, uidValidity: bigint, pollToken: string) {
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
    await persistMessage(mailbox, uid, uidValidity, normalized, Date.now() - started, pollToken);
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

async function persistMessage(mailbox: Mailbox, uid: bigint, uidValidity: bigint, message: NormalizedMessage, elapsedMs: number, pollToken: string) {
  const config = await getIntegrationConfig();
  const rules = (await prisma.rule.findMany({ where: { mailboxId: mailbox.id } })).flatMap((row) => {
    const parsed = parseStoredRule(row);
    return parsed ? [parsed] : [];
  });
  const matched = firstMatchingRule(rules, message);
  const ctx = await decideContext(mailbox, message, uid, config, matched?.id ?? null);
  const decision = decideMessage(message, rules, ctx);
  const maxAttempts = config.notifyMaxAttempts;
  const held = Boolean(decision.notification && decision.rule?.action.noticeGrouping === "digest");

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
          status: held ? DIGEST_PART : decision.notification.status,
          priority: decision.notification.priority,
          category: decision.notification.category,
          responseDueAt: decision.notification.responseDueAt,
          overdue: decision.notification.overdue,
          dueRisk: decision.notification.dueRisk,
          payload: (held ? holdDigest(decision.notification, pollToken) : decision.notification.payload) as Prisma.InputJsonValue,
          scheduledAt: decision.notification.scheduledAt,
          maxAttempts,
        },
      });
    }
    await tx.mailbox.update({ where: { id: mailbox.id }, data: { lastUid: uid } });
  });

  const noticeStatus = held ? DIGEST_PART : decision.notification?.status;
  await bumpMetrics(mailbox.id, mailbox.timezone, metricDelta(message, decision.decision, noticeStatus, elapsedMs));
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
  ruleId: string | null,
): Promise<DecideContext> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [ruleNotificationsLastHour, senderPaused, subjectPaused, domainPaused] = await Promise.all([
    prisma.notification.count({
      where: { ruleId: ruleId ?? "none", createdAt: { gte: hourAgo }, status: { in: REAL_NOTICE } },
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
    throttle: {
      ruleNotificationsLastHour,
      notifyPerHour: mailbox.notifyPerHour,
      senderPaused,
      subjectPaused,
      domainPaused,
    },
    previewChars: config.previewChars,
    globalMessageDedupe: config.globalMessageDedupe,
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

function metricDelta(message: NormalizedMessage, decision: string, noticeStatus?: string, elapsedMs = 0) {
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
    throttledNotifications: noticeStatus === "throttled" ? 1 : 0,
    deferredNotifications: noticeStatus === "scheduled" ? 1 : 0,
    processingMs: elapsedMs,
    languages: { [message.language]: 1 },
    sentiments: { [message.sentiment]: 1 },
    urgencies: { [message.urgencyLevel]: 1 },
  };
}

async function advance(mailboxId: string, uid: bigint) {
  await prisma.mailbox.update({ where: { id: mailboxId }, data: { lastUid: uid } });
}
