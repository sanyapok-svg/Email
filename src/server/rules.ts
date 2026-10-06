"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sanitizeNoticeFields } from "@/lib/b24/notice";
import { normalizeAction, parsePolicy } from "@/lib/rules/parse";
import type { ConditionGroup } from "@/lib/rules/types";
import { withNotice } from "@/lib/http/notice";

export async function saveRule(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const mailboxId = String(formData.get("mailboxId") || "");
  const conditions = JSON.parse(String(formData.get("conditions") || "{\"op\":\"all\",\"conditions\":[]}")) as ConditionGroup;
  const recipientIds = formData.getAll("recipientIds").map(String);
  const action = normalizeAction({
    notificationEnabled: formData.get("notificationEnabled") === "on",
    priority: String(formData.get("priority") || "normal"),
    responseHours: Number(formData.get("responseHours") || 24),
    useExtractedDeadline: formData.get("useExtractedDeadline") === "on",
    recipientIds,
    throttlingEnabled: formData.get("throttlingEnabled") === "on",
    notifyOutsidePolicy: parsePolicy(String(formData.get("notifyOutsidePolicy") || "defer")),
    noticeGrouping: formData.get("noticeGrouping") === "digest" ? "digest" : "each",
    noticeFields: sanitizeNoticeFields(formData.getAll("noticeFields")),
    noticeMetaOptional: true,
  });
  const data = {
    mailboxId,
    name: String(formData.get("name") || "").trim() || "Правило",
    type: String(formData.get("type") || "notify") === "exclude" ? "exclude" : "notify",
    position: Number(formData.get("position") || 100),
    active: formData.get("active") === "on",
    category: String(formData.get("category") || "").trim() || null,
    conditions,
    action,
    dryRun: false,
  };
  const saved = id ? await prisma.rule.update({ where: { id }, data }) : await prisma.rule.create({ data });
  redirect(withNotice(`/rules/${saved.id}`, "Сохранено"));
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

function safeReturn(value: string, fallback: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
