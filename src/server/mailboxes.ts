"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { testImapConnection, safeError } from "@/lib/imap/connector";
import { pollMailbox } from "@/lib/orchestration/poll";
import { starterRules } from "@/lib/rules/starter";
import { withNotice } from "@/lib/http/notice";
import { POLL_INTERVALS, pollIntervalMinutes } from "@/lib/mail/check-settings";

export async function saveMailbox(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const existing = id ? await prisma.mailbox.findUnique({ where: { id } }) : null;
  const imapPassword = String(formData.get("imapPassword") || "");
  if (!existing && !imapPassword) redirect(withNotice("/mailboxes/new", "Нужен пароль IMAP"));
  const data = {
    name: required(formData, "name"),
    address: required(formData, "address").toLowerCase(),
    displayAddress: optional(formData, "displayAddress"),
    active: formData.get("active") === "on",
    timezone: optional(formData, "timezone") || "Europe/Moscow",
    imapHost: optional(formData, "imapHost") || "imap.yandex.com",
    imapPort: number(formData, "imapPort", 993),
    imapSecure: formData.get("imapSecure") === "on",
    imapUser: required(formData, "imapUser"),
    imapPasswordEnc: imapPassword ? encryptSecret(imapPassword) : existing?.imapPasswordEnc || "",
    repliesEnabled: false,
    dryRun: false,
    batchSize: clamp(number(formData, "batchSize", 8), 1, 10),
    bodyCharLimit: clamp(number(formData, "bodyCharLimit", 150000), 1000, 200000),
    entityListLimit: clamp(number(formData, "entityListLimit", 40), 5, 100),
    notifyPerHour: clamp(number(formData, "notifyPerHour", 30), 1, 1000),
    senderPauseMinutes: clamp(number(formData, "senderPauseMinutes", 60), 0, 10080),
    subjectPauseMinutes: clamp(number(formData, "subjectPauseMinutes", 0), 0, 10080),
    domainPauseMinutes: clamp(number(formData, "domainPauseMinutes", 0), 0, 10080),
  };
  const saved = existing
    ? await prisma.mailbox.update({ where: { id: existing.id }, data })
    : await prisma.mailbox.create({
        data: {
          ...data,
          pollIntervalSec: 300,
          workDays: [1, 2, 3, 4, 5],
          workIntervals: [{ start: "09:00", end: "18:00" }],
          holidays: [],
          notifyOutsidePolicy: "defer",
          replyOutsidePolicy: "send_now",
        },
      });
  if (existing && existing.active !== data.active) {
    await prisma.rule.updateMany({ where: { mailboxId: saved.id }, data: { active: data.active } });
  }
  redirect(withNotice(`/mailboxes/${saved.id}`, "Сохранено"));
}

export async function saveMailboxCheck(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const mailbox = await prisma.mailbox.findUnique({ where: { id }, select: { id: true } });
  const returnTo = safeReturn(String(formData.get("returnTo") || ""), mailbox ? `/mailboxes#check-${id}` : "/mailboxes");
  if (!mailbox) redirect(withNotice("/mailboxes", "Ящик не найден"));
  const workDays = csvNumbers(String(formData.get("workDays") || "1,2,3,4,5"));
  const workIntervals = parseIntervals(String(formData.get("workIntervals") || "09:00-18:00"));
  await prisma.mailbox.update({
    where: { id },
    data: {
      pollIntervalSec: chosenPollMinutes(number(formData, "pollIntervalMin", 5)) * 60,
      workDays: workDays.length ? workDays : [1, 2, 3, 4, 5],
      workIntervals: workIntervals.length ? workIntervals : [{ start: "09:00", end: "18:00" }],
      holidays: csv(String(formData.get("holidays") || "")),
    },
  });
  redirect(noticeTo(returnTo, "Проверка сохранена"));
}

export async function setMailboxAutoPoll(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const enabled = formData.get("enabled") === "1";
  const mailbox = await prisma.mailbox.findUnique({ where: { id }, select: { id: true } });
  const returnTo = safeReturn(String(formData.get("returnTo") || ""), mailbox ? `/mailboxes#mailbox-${id}` : "/mailboxes");
  if (!mailbox) redirect(withNotice("/mailboxes", "Ящик не найден"));
  await prisma.mailbox.update({ where: { id }, data: { autoPoll: enabled } });
  redirect(noticeTo(returnTo, enabled ? "Автопроверка включена" : "Автопроверка выключена"));
}

export async function setMailboxEnabled(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const enabled = formData.get("enabled") === "1";
  const mailbox = await prisma.mailbox.findUnique({ where: { id }, select: { id: true } });
  const returnTo = safeReturn(String(formData.get("returnTo") || ""), mailbox ? `/mailboxes#mailbox-${id}` : "/mailboxes");
  if (!mailbox) redirect(withNotice("/mailboxes", "Ящик не найден"));
  await prisma.$transaction([
    prisma.mailbox.update({ where: { id }, data: { active: enabled } }),
    prisma.rule.updateMany({ where: { mailboxId: id }, data: { active: enabled } }),
  ]);
  redirect(noticeTo(returnTo, enabled ? "Ящик и все его правила включены" : "Ящик и все его правила выключены"));
}

export async function testMailboxImap(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const mailbox = await prisma.mailbox.findUnique({ where: { id } });
  if (!mailbox) redirect(withNotice("/mailboxes", "Ящик не найден"));
  try {
    const { decryptSecret } = await import("@/lib/crypto/secrets");
    const status = await testImapConnection({
      host: mailbox.imapHost,
      port: mailbox.imapPort,
      secure: mailbox.imapSecure,
      user: mailbox.imapUser,
      password: decryptSecret(mailbox.imapPasswordEnc),
    });
    redirect(withNotice(`/mailboxes/${id}`, `IMAP в порядке. UIDVALIDITY ${status.uidValidity}, следующий UID ${status.uidNext}`));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withNotice(`/mailboxes/${id}`, safeError(error, [])));
  }
}

export async function pollMailboxNow(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const returnTo = safeReturn(String(formData.get("returnTo") || ""), `/mailboxes#mailbox-${id}`);
  const mailbox = await prisma.mailbox.findUnique({ where: { id }, select: { active: true } });
  if (!mailbox) redirect(withNotice("/mailboxes", "Ящик не найден"));
  if (!mailbox.active) redirect(noticeTo(returnTo, "Ящик выключен, почта не проверялась"));
  await pollMailbox(id, { force: true });
  redirect(noticeTo(returnTo, "Проверка выполнена"));
}

export async function deleteMailbox(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const mailbox = id ? await prisma.mailbox.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!mailbox) redirect(withNotice("/mailboxes", "Ящик не найден"));
  await prisma.$transaction([
    prisma.schedulerLock.deleteMany({ where: { id: `poll:${id}` } }),
    prisma.mailbox.delete({ where: { id } }),
  ]);
  redirect(withNotice("/mailboxes", "Ящик удалён"));
}

export async function installStarterRules(formData: FormData) {
  await requireUser();
  const mailboxId = String(formData.get("id") || "");
  const count = await prisma.rule.count({ where: { mailboxId } });
  await prisma.rule.createMany({
    data: starterRules().map((rule, index) => ({
      mailboxId,
      name: rule.name,
      type: rule.type,
      position: count * 10 + rule.position + index,
      active: rule.active,
      category: rule.category,
      conditions: rule.conditions,
      action: rule.action,
      dryRun: false,
    })),
  });
  redirect(noticeTo(`/mailboxes#mailbox-${mailboxId}`, "Базовые исключения добавлены"));
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

function rethrowRedirect(error: unknown): void {
  if (typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
    throw error;
  }
}

function required(formData: FormData, key: string): string {
  const value = String(formData.get(key) || "").trim();
  if (!value) throw new Error(`Поле ${key} обязательно`);
  return value;
}

function optional(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

function chosenPollMinutes(minutes: number): number {
  return POLL_INTERVALS.some((item) => item.minutes === minutes) ? minutes : pollIntervalMinutes(minutes * 60);
}

function number(formData: FormData, key: string, fallback: number): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function csv(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function csvNumbers(value: string): number[] {
  return csv(value)
    .map(Number)
    .filter((item) => item >= 1 && item <= 7);
}

function parseIntervals(value: string): Array<{ start: string; end: string }> {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [start, end] = item.split("-").map((part) => part.trim());
      return { start, end };
    })
    .filter((item) => item.start && item.end);
}
