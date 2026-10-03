import type { Prisma } from "@prisma/client";
import { deliverToBitrix } from "@/lib/b24/adapter";
import { decryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/log";
import { bumpMetrics } from "@/lib/metrics/counters";
import { backoffDate } from "@/lib/orchestration/decide";
import { flushIdleDigests } from "@/lib/orchestration/digest";
import { getIntegrationConfig } from "@/lib/settings";

export async function dispatchQueues() {
  await dispatchNotifications();
  await applyRetention();
}

async function dispatchNotifications() {
  await flushIdleDigests();
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
    const claimed = await prisma.notification.updateMany({ where: { id: item.id, status: item.status }, data: { status: "sending" } });
    if (claimed.count !== 1) continue;
    const payload = await withBitrixUsers(item.payload as Prisma.JsonObject);
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

async function withBitrixUsers(payload: Prisma.JsonObject): Promise<Prisma.JsonObject> {
  const ids = Array.isArray(payload.recipients) ? payload.recipients.map(String) : [];
  if (!ids.length) return payload;
  const people = await prisma.b24Recipient.findMany({
    where: { id: { in: ids }, active: true },
    select: { name: true, login: true, externalId: true },
  });
  return {
    ...payload,
    b24Users: people.map((person) => ({
      name: person.name,
      login: person.login,
      externalId: person.externalId,
    })),
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
