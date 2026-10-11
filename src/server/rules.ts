"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sanitizeNoticeFields } from "@/lib/b24/notice";
import { withNotice } from "@/lib/http/notice";
import { normalizeAction, parsePolicy } from "@/lib/rules/parse";
import { clampPreviewChars } from "@/lib/rules/preview-chars";
import type { ConditionGroup } from "@/lib/rules/types";

export async function saveRule(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const mailboxId = String(formData.get("mailboxId") || "");
  const existing = id ? await prisma.rule.findUnique({ where: { id } }) : null;
  const previous = existing ? normalizeAction(existing.action) : null;
  const conditions = JSON.parse(String(formData.get("conditions") || "{\"op\":\"all\",\"conditions\":[]}")) as ConditionGroup;
  const recipientIds = formData.getAll("recipientIds").map(String);
  const action = normalizeAction({
    ...(previous ?? {}),
    notificationEnabled: previous ? previous.notificationEnabled : true,
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
    forwardRecipientId: String(formData.get("forwardRecipientId") || ""),
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
  await requireUser();
  const id = String(formData.get("id") || "");
  const enabled = formData.get("enabled") === "1";
  const rule = id ? await prisma.rule.findUnique({ where: { id } }) : null;
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
  await requireUser();
  const id = String(formData.get("id") || "");
  const rule = id ? await prisma.rule.findUnique({ where: { id }, select: { mailboxId: true } }) : null;
  if (!rule) redirect(withNotice("/mailboxes", "Правило не найдено"));
  await prisma.rule.delete({ where: { id } });
  redirect(`${withNotice("/mailboxes", "Правило удалено")}#mailbox-${rule.mailboxId}`);
}

export async function moveRule(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const direction = String(formData.get("direction") || "up");
  const rule = await prisma.rule.findUnique({ where: { id } });
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
