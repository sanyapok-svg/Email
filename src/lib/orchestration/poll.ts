import { randomUUID } from "crypto";
import type { Mailbox, Prisma } from "@prisma/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { ImapConnector, safeError } from "@/lib/imap/connector";
import { logEvent } from "@/lib/log";
import { isConnectionDue } from "@/lib/mail/next-connection";
import { forwardLetter } from "@/lib/mail/forward";
import { resolveForwardTargets } from "@/lib/mail/forward-queue";
import { buildNormalizedMessage, buildSearchDocument } from "@/lib/mail/pipeline";
import type { NormalizedMessage } from "@/lib/mail/model";
import { bumpMetrics } from "@/lib/metrics/counters";
import { withLock } from "@/lib/locks";
import { planMessage, type DecideContext } from "@/lib/orchestration/decide";
import { DIGEST_PART, flushDigestParts, holdDigest } from "@/lib/orchestration/digest";
import { dispatchQueues } from "@/lib/queues/dispatch";
import { matchingRules } from "@/lib/rules/engine";
import { parsePolicy, parseSchedule, parseStoredRule } from "@/lib/rules/parse";
import { getIntegrationConfig } from "@/lib/settings";

const REAL_NOTICE = ["pending", "scheduled", "sending", "sent"];

export async function pollDueMailboxes(options: { deliver?: boolean } = {}) {
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
    await pollMailbox(mailbox.id, options);
  }
}

export async function pollMailbox(mailboxId: string, options: { force?: boolean; deliver?: boolean } = {}) {
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
    const shouldDeliver = options.deliver !== false;
    const pollToken = randomUUID();
    const password = decryptSecret(mailbox.imapPasswordEnc);
    const connector = new ImapConnector({
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.imapSecure,
      user: mailbox.imapUser,
      password,
    });
    deliver = shouldDeliver;
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
      try {
        await flushDigestParts({ mailboxId: mailbox.id, pollToken });
      } catch (error) {
        logEvent("error", "notify.digest_failed", { mailboxId: mailbox.id, message: safeError(error, []) });
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
  const matched = matchingRules(rules, message);
  const notifyIds = matched.filter((rule) => rule.action.notificationEnabled).map((rule) => rule.id);
  const [pauses, counts] = await Promise.all([pauseFlags(mailbox, message), notificationsLastHour(notifyIds)]);
  const ctx: DecideContext = {
    now: new Date(),
    mailboxId: mailbox.id,
    mailboxName: mailbox.name,
    uid: uid.toString(),
    schedule: parseSchedule(mailbox),
    notifyOutsidePolicy: parsePolicy(mailbox.notifyOutsidePolicy),
    throttle: { ...pauses, ruleNotificationsLastHour: 0 },
    globalMessageDedupe: config.globalMessageDedupe,
  };
  const plan = planMessage(message, rules, ctx, (ruleId) => ({
    ...pauses,
    ruleNotificationsLastHour: counts.get(ruleId) ?? 0,
  }));
  const forwards = await resolveForwardTargets(matched);
  const letter = forwardLetter(message);
  const maxAttempts = config.notifyMaxAttempts;

  await prisma.$transaction(async (tx) => {
    const saved = await tx.processedMessage.create({
      data: messageData(mailbox.id, uid, uidValidity, message, plan.decision, plan.rule?.id ?? null),
    });
    for (const item of plan.notifications) {
      const held = item.rule.action.noticeGrouping === "digest";
      const duplicate = await tx.notification.findUnique({ where: { idempotencyKey: item.notification.idempotencyKey } });
      if (duplicate) continue;
      await tx.notification.create({
        data: {
          mailboxId: mailbox.id,
          messageId: saved.id,
          ruleId: item.rule.id,
          idempotencyKey: item.notification.idempotencyKey,
          status: held ? DIGEST_PART : item.notification.status,
          priority: item.notification.priority,
          category: item.notification.category,
          responseDueAt: item.notification.responseDueAt,
          overdue: item.notification.overdue,
          dueRisk: item.notification.dueRisk,
          payload: (held ? holdDigest(item.notification, pollToken) : item.notification.payload) as Prisma.InputJsonValue,
          scheduledAt: item.notification.scheduledAt,
          maxAttempts,
        },
      });
    }
    for (const item of forwards) {
      const idempotencyKey = `forward:${mailbox.id}:${uid.toString()}:${item.rule.id}`;
      const duplicate = await tx.outboundReply.findUnique({ where: { idempotencyKey } });
      if (duplicate) continue;
      await tx.outboundReply.create({
        data: {
          mailboxId: mailbox.id,
          messageId: saved.id,
          ruleId: item.rule.id,
          kind: "forward",
          idempotencyKey,
          status: "pending",
          toAddress: item.to,
          subject: letter.subject,
          bodyText: letter.text,
          maxAttempts: config.replyMaxAttempts,
        },
      });
    }
    await tx.mailbox.update({ where: { id: mailbox.id }, data: { lastUid: uid } });
  });

  await bumpMetrics(mailbox.id, mailbox.timezone, metricDelta(message, plan, elapsedMs));
  logEvent("info", "mail.processed", {
    mailboxId: mailbox.id,
    uid: uid.toString(),
    ruleId: plan.rule?.id ?? null,
    ruleIds: plan.notifications.map((item) => item.rule.id).join(",") || null,
    decision: plan.decision,
    ms: elapsedMs,
  });
}

async function pauseFlags(
  mailbox: Mailbox,
  message: NormalizedMessage,
): Promise<Omit<DecideContext["throttle"], "ruleNotificationsLastHour">> {
  const [senderPaused, subjectPaused, domainPaused] = await Promise.all([
    paused(mailbox.senderPauseMinutes, { mailboxId: mailbox.id, message: { fromEmail: message.fromEmail } }),
    paused(mailbox.subjectPauseMinutes, { mailboxId: mailbox.id, message: { subjectNormalized: message.subjectNormalized } }),
    paused(mailbox.domainPauseMinutes, { mailboxId: mailbox.id, message: { fromDomain: message.fromDomain } }),
  ]);
  return {
    notifyPerHour: mailbox.notifyPerHour,
    senderPaused,
    subjectPaused,
    domainPaused,
  };
}

async function notificationsLastHour(ruleIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ruleIds.length === 0) return counts;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const grouped = await prisma.notification.groupBy({
    by: ["ruleId"],
    where: { ruleId: { in: ruleIds }, createdAt: { gte: hourAgo }, status: { in: REAL_NOTICE } },
    _count: { _all: true },
  });
  for (const row of grouped) {
    if (row.ruleId) counts.set(row.ruleId, row._count._all);
  }
  return counts;
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

function metricDelta(message: NormalizedMessage, plan: { decision: string; notifications: Array<{ rule: { action: { noticeGrouping: string } }; notification: { status: string } }> }, elapsedMs = 0) {
  let notified = 0;
  let throttledNotifications = 0;
  let deferredNotifications = 0;
  for (const item of plan.notifications) {
    const status = item.rule.action.noticeGrouping === "digest" ? DIGEST_PART : item.notification.status;
    if (status === "pending" || status === "scheduled") notified += 1;
    if (status === "throttled") throttledNotifications += 1;
    if (status === "scheduled") deferredNotifications += 1;
  }
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
    excluded: plan.decision === "exclude" ? 1 : 0,
    skipped: plan.decision === "skipped_no_rule" ? 1 : 0,
    notified,
    throttledNotifications,
    deferredNotifications,
    processingMs: elapsedMs,
    languages: { [message.language]: 1 },
    sentiments: { [message.sentiment]: 1 },
    urgencies: { [message.urgencyLevel]: 1 },
  };
}

async function advance(mailboxId: string, uid: bigint) {
  await prisma.mailbox.update({ where: { id: mailboxId }, data: { lastUid: uid } });
}
