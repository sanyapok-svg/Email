"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { dispatchQueues } from "@/lib/queues/dispatch";
import { replySubject } from "@/lib/replies/render";
import { withNotice } from "@/lib/http/notice";
import { getIntegrationConfig } from "@/lib/settings";

export async function retryNotification(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  await prisma.notification.update({
    where: { id },
    data: { status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  await dispatchQueues();
  redirect(withNotice(`/notifications/${id}`, "Повтор поставлен в очередь"));
}

export async function retryReply(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  await prisma.outboundReply.update({
    where: { id },
    data: { status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  await dispatchQueues();
  redirect(withNotice(`/replies/${id}`, "Повтор поставлен в очередь"));
}

export async function sendManualReply(formData: FormData) {
  await requireUser();
  const messageId = String(formData.get("messageId") || "");
  const message = await prisma.processedMessage.findUnique({ where: { id: messageId }, include: { mailbox: true } });
  if (!message) redirect(withNotice("/messages", "Письмо не найдено"));
  if (!message.mailbox.repliesEnabled) redirect(withNotice(`/messages/${messageId}`, "Ответы для ящика выключены"));
  const config = await getIntegrationConfig();
  const dry = config.globalDryRun || message.mailbox.dryRun;
  const toAddress = message.replyTo[0] || message.fromEmail;
  await prisma.outboundReply.create({
    data: {
      mailboxId: message.mailboxId,
      messageId: message.id,
      kind: "manual",
      idempotencyKey: `manual:${message.id}:${randomUUID()}`,
      status: dry ? "dry_run" : "pending",
      toAddress,
      subject: replySubject(message.subject),
      bodyText: String(formData.get("body") || ""),
      inReplyTo: message.messageIdHeader,
      references: message.messageIdHeader,
      templateId: String(formData.get("templateId") || "") || null,
      maxAttempts: config.replyMaxAttempts,
    },
  });
  if (!dry) await dispatchQueues();
  redirect(withNotice(`/messages/${messageId}`, dry ? "Ответ сохранён как сухой прогон" : "Ответ поставлен в очередь"));
}

export async function saveTemplate(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const data = {
    mailboxId: String(formData.get("mailboxId") || ""),
    name: String(formData.get("name") || "").trim() || "Шаблон",
    bodyText: String(formData.get("bodyText") || ""),
    active: formData.get("active") === "on",
  };
  if (id) await prisma.replyTemplate.update({ where: { id }, data });
  else await prisma.replyTemplate.create({ data });
  redirect(withNotice(`/templates?mailboxId=${data.mailboxId}`, "Шаблон сохранён"));
}

export async function saveSettings(formData: FormData) {
  await requireUser();
  const current = await getIntegrationConfig();
  const webhook = String(formData.get("webhookUrl") || "").trim();
  await prisma.integrationConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      b24Mode: String(formData.get("b24Mode") || "mock") === "webhook" ? "webhook" : "mock",
      webhookUrlEnc: webhook ? encryptSecret(webhook) : null,
      globalDryRun: formData.get("globalDryRun") === "on",
      retentionDays: optionalNumber(formData, "retentionDays"),
      notifyMaxAttempts: clamp(Number(formData.get("notifyMaxAttempts") || 5), 1, 10),
      replyMaxAttempts: clamp(Number(formData.get("replyMaxAttempts") || 5), 1, 10),
      includeBodyPreview: formData.get("includeBodyPreview") === "on",
      previewChars: clamp(Number(formData.get("previewChars") || 280), 40, 2000),
      globalMessageDedupe: formData.get("globalMessageDedupe") === "on",
    },
    update: {
      b24Mode: String(formData.get("b24Mode") || "mock") === "webhook" ? "webhook" : "mock",
      webhookUrlEnc: webhook ? encryptSecret(webhook) : current.webhookUrlEnc,
      globalDryRun: formData.get("globalDryRun") === "on",
      retentionDays: optionalNumber(formData, "retentionDays"),
      notifyMaxAttempts: clamp(Number(formData.get("notifyMaxAttempts") || 5), 1, 10),
      replyMaxAttempts: clamp(Number(formData.get("replyMaxAttempts") || 5), 1, 10),
      includeBodyPreview: formData.get("includeBodyPreview") === "on",
      previewChars: clamp(Number(formData.get("previewChars") || 280), 40, 2000),
      globalMessageDedupe: formData.get("globalMessageDedupe") === "on",
    },
  });
  redirect(withNotice("/settings", "Настройки сохранены"));
}

export async function saveB24User(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const login = String(formData.get("login") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const externalId = String(formData.get("externalId") || "").trim();
  const active = formData.get("active") === "on";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) redirect(userNotice("Укажите логин — адрес почты"));
  if (!name) redirect(userNotice("Укажите ФИО"));
  if (!/^\d+$/.test(externalId)) redirect(userNotice("ID Б24 — число из карточки пользователя Битрикс24"));
  const sameId = await prisma.b24Recipient.findFirst({ where: { externalId, ...(id ? { NOT: { id } } : {}) } });
  if (sameId) redirect(userNotice("Пользователь с таким ID Б24 уже есть"));
  const sameLogin = await prisma.b24Recipient.findFirst({ where: { login, ...(id ? { NOT: { id } } : {}) } });
  if (sameLogin) redirect(userNotice("Пользователь с таким логином уже есть"));
  const data = { login, name, externalId, active };
  if (id) await prisma.b24Recipient.update({ where: { id }, data });
  else await prisma.b24Recipient.create({ data });
  redirect(userNotice("Пользователь сохранён"));
}

export async function deleteB24User(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  if (id) await prisma.b24Recipient.delete({ where: { id } });
  redirect(userNotice("Пользователь удалён"));
}

function userNotice(text: string): string {
  return withNotice("/users", text);
}

function optionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
