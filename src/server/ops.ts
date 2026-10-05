"use server";

import { redirect } from "next/navigation";
import { parseAbsences, readAbsences, withoutSubstitute } from "@/lib/b24/absences";
import {
  OPEN_NOTIFICATION_STATUSES,
  applyRecipientChange,
  payloadRecipientIds,
  planOpenNotification,
  readDecisions,
  recipientIdsOf,
  validateDecisions,
} from "@/lib/b24/dismiss";
import { requireUser } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { dispatchQueues } from "@/lib/queues/dispatch";
import { withNotice } from "@/lib/http/notice";

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

export async function saveSettings(formData: FormData) {
  await requireUser();
  const current = await prisma.integrationConfig.findUnique({ where: { id: "default" } });
  const webhook = String(formData.get("webhookUrl") || "").trim();
  await prisma.integrationConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      b24Mode: String(formData.get("b24Mode") || "mock") === "webhook" ? "webhook" : "mock",
      webhookUrlEnc: webhook ? encryptSecret(webhook) : null,
      retentionDays: optionalNumber(formData, "retentionDays"),
      notifyMaxAttempts: clamp(Number(formData.get("notifyMaxAttempts") || 5), 1, 10),
      previewChars: clamp(Number(formData.get("previewChars") || 280), 40, 2000),
      globalMessageDedupe: formData.get("globalMessageDedupe") === "on",
    },
    update: {
      b24Mode: String(formData.get("b24Mode") || "mock") === "webhook" ? "webhook" : "mock",
      webhookUrlEnc: webhook ? encryptSecret(webhook) : current?.webhookUrlEnc,
      retentionDays: optionalNumber(formData, "retentionDays"),
      notifyMaxAttempts: clamp(Number(formData.get("notifyMaxAttempts") || 5), 1, 10),
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
  const existing = id ? await prisma.b24Recipient.findUnique({ where: { id }, select: { dismissed: true } }) : null;
  if (id && !existing) redirect(userNotice("Сотрудник не найден"));
  const known = await prisma.b24Recipient.findMany({ where: { active: true, dismissed: false }, select: { id: true } });
  const knownIds = new Set(known.map((user) => user.id));
  const parsed = parseAbsences(String(formData.get("absences") ?? "[]"), id, knownIds);
  if (!parsed.ok) redirect(userNotice(parsed.error));
  const data = { login, name, externalId, active: existing?.dismissed ? false : active, absences: parsed.absences };
  if (id) await prisma.b24Recipient.update({ where: { id }, data });
  else await prisma.b24Recipient.create({ data });
  redirect(userNotice("Пользователь сохранён"));
}

export async function dismissB24User(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const decisions = readDecisions(String(formData.get("decisions") ?? "[]"));
  if (!id || !decisions) redirect(userNotice("Не удалось прочитать решение по уведомлениям"));
  const employee = await prisma.b24Recipient.findUnique({ where: { id }, select: { id: true, dismissed: true } });
  if (!employee) redirect(userNotice("Сотрудник не найден"));
  if (employee.dismissed) redirect(userNotice("Сотрудник уже уволен"));
  const [rules, colleagues] = await Promise.all([
    prisma.rule.findMany({ select: { id: true, type: true, active: true, action: true } }),
    prisma.b24Recipient.findMany({ where: { active: true, dismissed: false, NOT: { id } }, select: { id: true } }),
  ]);
  const parsedRules = rules.map((rule) => ({ ...rule, recipientIds: recipientIdsOf(rule.action) }));
  const check = validateDecisions({
    employeeId: id,
    rules: parsedRules,
    decisions,
    replacementIds: new Set(colleagues.map((person) => person.id)),
  });
  if (!check.ok) redirect(userNotice(check.error));
  const byRule = new Map(decisions.map((decision) => [decision.ruleId, decision]));

  await prisma.$transaction(async (tx) => {
    for (const rule of parsedRules) {
      if (!rule.recipientIds.includes(id)) continue;
      const decision = rule.type === "notify" ? byRule.get(rule.id) : undefined;
      const choice = decision?.choice ?? "remove";
      const nextIds = applyRecipientChange(rule.recipientIds, id, choice, decision?.replacementId ?? "");
      const action = { ...(rule.action && typeof rule.action === "object" ? rule.action : {}), recipientIds: nextIds };
      await tx.rule.update({
        where: { id: rule.id },
        data: { action, ...(choice === "deactivate" ? { active: false } : {}) },
      });
    }
    await rewriteOpenNotifications(tx, id, byRule);
    await stripSubstitute(tx, id);
    await tx.b24Recipient.update({ where: { id }, data: { dismissed: true, active: false } });
  });
  redirect(userNotice("Сотрудник уволен"));
}

export async function deleteB24User(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) redirect(userNotice("Сотрудник не найден"));
  await prisma.$transaction(async (tx) => {
    const rules = await tx.rule.findMany({ select: { id: true, type: true, action: true } });
    for (const rule of rules) {
      const recipientIds = recipientIdsOf(rule.action);
      if (!recipientIds.includes(id)) continue;
      const nextIds = applyRecipientChange(recipientIds, id, "remove", "");
      const action = { ...(rule.action && typeof rule.action === "object" ? rule.action : {}), recipientIds: nextIds };
      await tx.rule.update({
        where: { id: rule.id },
        data: { action, ...(rule.type === "notify" && nextIds.length === 0 ? { active: false } : {}) },
      });
    }
    await rewriteOpenNotifications(tx, id, new Map());
    await stripSubstitute(tx, id);
    await tx.b24Recipient.delete({ where: { id } });
  });
  redirect(userNotice("Пользователь удалён"));
}

async function rewriteOpenNotifications(
  tx: Pick<typeof prisma, "notification">,
  id: string,
  byRule: Map<string, { ruleId: string; choice: "deactivate" | "replace" | "remove"; replacementId: string }>,
) {
  const open = await tx.notification.findMany({
    where: { status: { in: [...OPEN_NOTIFICATION_STATUSES] } },
    select: { id: true, status: true, ruleId: true, payload: true },
  });
  for (const item of open) {
    const recipients = payloadRecipientIds(item.payload);
    if (!recipients.includes(id)) continue;
    const plan = planOpenNotification(recipients, id, item.ruleId ? byRule.get(item.ruleId) ?? null : null);
    const payload = { ...(item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : {}), recipients: plan.recipients };
    await tx.notification.update({
      where: { id: item.id },
      data: {
        payload,
        ...(plan.cancel && item.status !== "sending" ? { status: "cancelled" } : {}),
      },
    });
  }
}

async function stripSubstitute(tx: Pick<typeof prisma, "b24Recipient">, id: string) {
  const others = await tx.b24Recipient.findMany({ where: { NOT: { id } }, select: { id: true, absences: true } });
  for (const other of others) {
    const current = readAbsences(other.absences);
    if (!current.some((absence) => absence.substituteIds.includes(id))) continue;
    await tx.b24Recipient.update({ where: { id: other.id }, data: { absences: withoutSubstitute(current, id) } });
  }
}

function userNotice(text: string): string {
  return withNotice("/b24-users", text);
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
