"use server";

import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import { prisma } from "@/lib/db";
import { sanitizeNoticeFields } from "@/lib/b24/notice";
import { withNotice } from "@/lib/http/notice";
import { normalizeAction, parsePolicy } from "@/lib/rules/parse";
import { clampPreviewChars } from "@/lib/rules/preview-chars";
import type { ConditionGroup } from "@/lib/rules/types";

export async function saveRule(formData: FormData) {
  const ctx = await requireAccount();
  const id = String(formData.get("id") || "");
  const mailboxId = String(formData.get("mailboxId") || "");
  const existing = id ? await prisma.rule.findFirst({ where: { id, mailbox: { accountId: ctx.accountId } } }) : null;
  if (id && !existing) redirect(withNotice("/mailboxes", "Правило не найдено"));
  const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, accountId: ctx.accountId }, select: { id: true } });
  if (!mailbox) redirect(withNotice("/mailboxes", "Ящик не найден"));
  const requestedRecipients = formData.getAll("recipientIds").map(String);
  const ownedRecipients = requestedRecipients.length
    ? await prisma.b24Recipient.findMany({ where: { accountId: ctx.accountId, id: { in: requestedRecipients } }, select: { id: true } })
    : [];
  const recipientIds = ownedRecipients.map((person) => person.id);
  const requestedForward = String(formData.get("forwardRecipientId") || "");
  const ownedForward = requestedForward
    ? await prisma.b24Recipient.findFirst({ where: { id: requestedForward, accountId: ctx.accountId }, select: { id: true } })
    : null;
  const previous = existing ? normalizeAction(existing.action) : null;
  const conditions = JSON.parse(String(formData.get("conditions") || "{\"op\":\"all\",\"conditions\":[]}")) as ConditionGroup;
  const action = normalizeAction({
    ...(previous ?? {}),
    notificationEnabled: previous ? previous.notificationEnabled : true,
    notifyChannels: notifyChannelsFrom(formData),
    priority: String(formData.get("priority") || "normal"),
    responseHours: Number(formData.get("responseHours") || 24),
    recipientIds,
    notifyOutsidePolicy: parsePolicy(String(formData.get("notifyOutsidePolicy") || "defer")),
    noticeGrouping: formData.get("noticeGrouping") === "digest" ? "digest" : "each",
    noticeFields: sanitizeNoticeFields(formData.getAll("noticeFields")),
    noticeMetaOptional: true,
    previewChars: clampPreviewChars(formData.get("previewChars")),
    forwardEnabled: formData.get("forwardEnabled") === "1",
    forwardSource: formData.get("forwardSource") === "employee" ? "employee" : "address",
    forwardAddress: String(formData.get("forwardAddress") || "").trim(),
    forwardRecipientId: ownedForward?.id || "",
  });
  const data = {
    mailboxId,
    name: String(formData.get("name") || "").trim() || "Правило",
    type: "notify",
    position: existing?.position ?? (await nextPosition(mailboxId)),
    active: existing?.active ?? true,
    category: String(formData.get("category") || "").trim() || null,
    conditions,
    action,
    dryRun: false,
  };
  const saved = id ? await prisma.rule.update({ where: { id }, data }) : await prisma.rule.create({ data });
  redirect(withNotice(`/rules/${saved.id}`, "Сохранено"));
}

export async function setRuleNotification(formData: FormData) {
  const ctx = await requireAccount();
  const id = String(formData.get("id") || "");
  const enabled = formData.get("enabled") === "1";
  const rule = id ? await prisma.rule.findFirst({ where: { id, mailbox: { accountId: ctx.accountId } } }) : null;
  const fallback = rule ? `/mailboxes#mailbox-${rule.mailboxId}` : "/mailboxes";
  const returnTo = safeReturn(String(formData.get("returnTo") || ""), fallback);
  if (!rule || rule.type !== "notify") redirect(noticeTo("/mailboxes", "Правило не найдено"));
  const action = normalizeAction(rule.action);
  action.notificationEnabled = enabled;
  await prisma.rule.update({
    where: { id },
    data: { action, ...(enabled ? { active: true } : {}) },
  });
  redirect(noticeTo(returnTo, enabled ? "Уведомления правила включены" : "Уведомления правила выключены"));
}

export async function deleteRule(formData: FormData) {
  const ctx = await requireAccount();
  const id = String(formData.get("id") || "");
  const rule = id ? await prisma.rule.findFirst({ where: { id, mailbox: { accountId: ctx.accountId } }, select: { mailboxId: true } }) : null;
  if (!rule) redirect(withNotice("/mailboxes", "Правило не найдено"));
  await prisma.rule.delete({ where: { id } });
  redirect(`${withNotice("/mailboxes", "Правило удалено")}#mailbox-${rule.mailboxId}`);
}

export async function moveRule(formData: FormData) {
  const ctx = await requireAccount();
  const id = String(formData.get("id") || "");
  const direction = String(formData.get("direction") || "up");
  const rule = await prisma.rule.findFirst({ where: { id, mailbox: { accountId: ctx.accountId } } });
  if (!rule) redirect("/mailboxes");
  const fallback = `/mailboxes#mailbox-${rule.mailboxId}`;
  const returnTo = safeReturn(String(formData.get("returnTo") || ""), fallback);
  const siblings = await prisma.rule.findMany({ where: { mailboxId: rule.mailboxId }, orderBy: { position: "asc" } });
  const index = siblings.findIndex((item) => item.id === id);
  const swapWith = siblings[direction === "up" ? index - 1 : index + 1];
  if (!swapWith) redirect(returnTo);
  await prisma.$transaction([
    prisma.rule.update({ where: { id: rule.id }, data: { position: swapWith.position } }),
    prisma.rule.update({ where: { id: swapWith.id }, data: { position: rule.position } }),
  ]);
  redirect(returnTo);
}

function notifyChannelsFrom(formData: FormData): Array<"bitrix" | "telegram"> {
  return String(formData.get("notifyChannel") || "bitrix") === "telegram" ? ["telegram"] : ["bitrix"];
}

async function nextPosition(mailboxId: string): Promise<number> {
  const last = await prisma.rule.findFirst({ where: { mailboxId }, orderBy: { position: "desc" }, select: { position: true } });
  return (last?.position ?? 0) + 10;
}

function safeReturn(value: string, fallback: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

function noticeTo(pathWithHash: string, notice: string): string {
  const hashAt = pathWithHash.indexOf("#");
  const path = hashAt === -1 ? pathWithHash : pathWithHash.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : pathWithHash.slice(hashAt);
  return `${withNotice(path, notice)}${hash}`;
}
