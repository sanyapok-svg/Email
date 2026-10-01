import type { Prisma } from "@prisma/client";
import { deliverToBitrix } from "@/lib/b24/adapter";
import { decryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { safeError } from "@/lib/imap/connector";
import { logEvent } from "@/lib/log";
import { bumpMetrics } from "@/lib/metrics/counters";
import { backoffDate } from "@/lib/orchestration/decide";
import { getIntegrationConfig } from "@/lib/settings";
import { isAuthError, sendSmtp } from "@/lib/smtp/sender";

export async function dispatchQueues() {
  await dispatchNotifications();
  await dispatchReplies();
  await applyRetention();
}

async function dispatchNotifications() {
  const now = new Date();
  const config = await getIntegrationConfig();
  const webhook = resolveWebhook(config.webhookUrlEnc);
  const items = await prisma.notification.findMany({
    where: readyWhere(now),
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { mailbox: true, message: { select: { receivedAt: true } } },
  });
  for (const item of items) {
    if (config.globalDryRun || item.mailbox.dryRun) {
      await prisma.notification.update({ where: { id: item.id }, data: { status: "dry_run" } });
      continue;
    }
    const claimed = await prisma.notification.updateMany({ where: { id: item.id, status: item.status }, data: { status: "sending" } });
    if (claimed.count !== 1) continue;
    const payload = item.payload as Prisma.JsonObject;
    const result = await deliverToBitrix({
      mode: config.b24Mode === "webhook" ? "webhook" : "mock",
      webhookUrl: webhook,
      payload,
    });
    if (result.ok) {
      await prisma.notification.update({ where: { id: item.id }, data: { status: "sent", sentAt: new Date(), lastError: null } });
      const latency = Date.now() - item.message.receivedAt.getTime();
      await bumpMetrics(item.mailboxId, item.mailbox.timezone, { notifyLatencyMs: Math.max(0, latency) });
      logEvent("info", "notify.sent", { mailboxId: item.mailboxId, notificationId: item.id, mocked: result.mocked });
    } else {
      await failNotification(item.id, item.mailboxId, item.mailbox.timezone, item.attempts, item.maxAttempts, result.error);
    }
  }
}

async function dispatchReplies() {
  const now = new Date();
  const config = await getIntegrationConfig();
  const items = await prisma.outboundReply.findMany({
    where: readyWhere(now),
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { mailbox: true, message: { select: { receivedAt: true } } },
  });
  for (const item of items) {
    if (config.globalDryRun || item.mailbox.dryRun) {
      await prisma.outboundReply.update({ where: { id: item.id }, data: { status: "dry_run" } });
      continue;
    }
    if (item.mailbox.repliesPaused || !item.mailbox.smtpPasswordEnc || !item.mailbox.smtpUser) {
      await prisma.outboundReply.update({
        where: { id: item.id },
        data: { status: "error", lastError: "SMTP не настроен или ответы приостановлены" },
      });
      continue;
    }
    const password = decryptSecret(item.mailbox.smtpPasswordEnc);
    const claimed = await prisma.outboundReply.updateMany({ where: { id: item.id, status: item.status }, data: { status: "sending" } });
    if (claimed.count !== 1) continue;
    try {
      await sendSmtp(
        {
          host: item.mailbox.smtpHost,
          port: item.mailbox.smtpPort,
          secure: item.mailbox.smtpSecure,
          user: item.mailbox.smtpUser,
          password,
          fromName: item.mailbox.smtpFromName || item.mailbox.name,
          fromAddress: item.mailbox.smtpFromAddress || item.mailbox.address,
        },
        {
          to: item.toAddress,
          subject: item.subject,
          text: item.bodyText,
          inReplyTo: item.inReplyTo,
          references: item.references,
        },
      );
      await prisma.outboundReply.update({ where: { id: item.id }, data: { status: "sent", sentAt: new Date(), lastError: null } });
      const latency = Date.now() - item.message.receivedAt.getTime();
      await bumpMetrics(item.mailboxId, item.mailbox.timezone, {
        replyLatencyMs: Math.max(0, latency),
        ...(item.kind === "manual" ? { manualReplies: 1 } : {}),
      });
      logEvent("info", "reply.sent", { mailboxId: item.mailboxId, replyId: item.id, kind: item.kind });
    } catch (error) {
      const message = safeError(error, [password]);
      if (isAuthError(error)) {
        await prisma.mailbox.update({
          where: { id: item.mailboxId },
          data: { repliesPaused: true, smtpLastError: message },
        });
      }
      const attempts = item.attempts + 1;
      const failed = attempts >= item.maxAttempts;
      await prisma.outboundReply.update({
        where: { id: item.id },
        data: {
          attempts,
          status: failed ? "error" : "pending",
          nextAttemptAt: failed ? null : backoffDate(attempts),
          lastError: message,
        },
      });
      await bumpMetrics(item.mailboxId, item.mailbox.timezone, { smtpErrors: 1 });
      logEvent("error", "reply.failed", { mailboxId: item.mailboxId, replyId: item.id, message });
    }
  }
}

async function failNotification(id: string, mailboxId: string, timezone: string, attempts: number, maxAttempts: number, error: string) {
  const nextAttempts = attempts + 1;
  const failed = nextAttempts >= maxAttempts;
  await prisma.notification.update({
    where: { id },
    data: {
      attempts: nextAttempts,
      status: failed ? "error" : "pending",
      nextAttemptAt: failed ? null : backoffDate(nextAttempts),
      lastError: error,
    },
  });
  await bumpMetrics(mailboxId, timezone, { notificationErrors: 1 });
  logEvent("error", "notify.failed", { mailboxId, notificationId: id, message: error });
}

function readyWhere(now: Date) {
  return {
    status: { in: ["pending", "scheduled"] },
    AND: [
      { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
      { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    ],
  };
}

function resolveWebhook(encrypted: string | null): string | null {
  if (encrypted) return decryptSecret(encrypted);
  return process.env.B24_WEBHOOK_URL?.trim() || null;
}

async function applyRetention() {
  const config = await getIntegrationConfig();
  if (!config.retentionDays || config.retentionDays < 1) return;
  const cutoff = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000);
  await prisma.processedMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
