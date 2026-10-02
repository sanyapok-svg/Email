"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/db";
import { testImapConnection, safeError } from "@/lib/imap/connector";
import { pollMailbox } from "@/lib/orchestration/poll";
import { starterRules } from "@/lib/rules/starter";
import { withNotice } from "@/lib/http/notice";
import { verifySmtp } from "@/lib/smtp/sender";

export async function saveMailbox(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const existing = id ? await prisma.mailbox.findUnique({ where: { id } }) : null;
  const imapPassword = String(formData.get("imapPassword") || "");
  const smtpPassword = String(formData.get("smtpPassword") || "");
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
    smtpHost: optional(formData, "smtpHost") || "smtp.yandex.com",
    smtpPort: number(formData, "smtpPort", 465),
    smtpSecure: formData.get("smtpSecure") === "on",
    smtpUser: optional(formData, "smtpUser"),
    smtpPasswordEnc: smtpPassword ? encryptSecret(smtpPassword) : existing?.smtpPasswordEnc,
    smtpFromName: optional(formData, "smtpFromName"),
    smtpFromAddress: optional(formData, "smtpFromAddress"),
    repliesEnabled: formData.get("repliesEnabled") === "on",
    batchSize: clamp(number(formData, "batchSize", 8), 1, 10),
    pollIntervalSec: clamp(number(formData, "pollIntervalSec", 300), 60, 86400),
    bodyCharLimit: clamp(number(formData, "bodyCharLimit", 150000), 1000, 200000),
    entityListLimit: clamp(number(formData, "entityListLimit", 40), 5, 100),
    workDays: csvNumbers(String(formData.get("workDays") || "1,2,3,4,5")),
    workIntervals: parseIntervals(String(formData.get("workIntervals") || "09:00-18:00")),
    holidays: csv(String(formData.get("holidays") || "")),
    notifyOutsidePolicy: policy(formData, "notifyOutsidePolicy", "defer"),
    replyOutsidePolicy: policy(formData, "replyOutsidePolicy", "send_now"),
    dryRun: formData.get("dryRun") === "on",
    notifyPerHour: clamp(number(formData, "notifyPerHour", 30), 1, 1000),
    replyPerHour: clamp(number(formData, "replyPerHour", 10), 1, 1000),
    replyPerRecipientDay: clamp(number(formData, "replyPerRecipientDay", 3), 1, 100),
    senderPauseMinutes: clamp(number(formData, "senderPauseMinutes", 60), 0, 10080),
    subjectPauseMinutes: clamp(number(formData, "subjectPauseMinutes", 0), 0, 10080),
    domainPauseMinutes: clamp(number(formData, "domainPauseMinutes", 0), 0, 10080),
    autoReplyBlocklist: csv(String(formData.get("autoReplyBlocklist") || "")),
  };
  const saved = existing
    ? await prisma.mailbox.update({ where: { id: existing.id }, data })
    : await prisma.mailbox.create({ data });
  redirect(withNotice(`/mailboxes/${saved.id}`, "Сохранено"));
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

export async function testMailboxSmtp(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const mailbox = await prisma.mailbox.findUnique({ where: { id } });
  if (!mailbox?.smtpUser || !mailbox.smtpPasswordEnc) redirect(withNotice(`/mailboxes/${id}`, "SMTP не заполнен"));
  try {
    const { decryptSecret } = await import("@/lib/crypto/secrets");
    await verifySmtp({
      host: mailbox.smtpHost,
      port: mailbox.smtpPort,
      secure: mailbox.smtpSecure,
      user: mailbox.smtpUser,
      password: decryptSecret(mailbox.smtpPasswordEnc),
      fromAddress: mailbox.smtpFromAddress || mailbox.address,
    });
    await prisma.mailbox.update({ where: { id }, data: { repliesPaused: false, smtpLastError: null } });
    redirect(withNotice(`/mailboxes/${id}`, "SMTP в порядке, пауза ответов снята"));
  } catch (error) {
    rethrowRedirect(error);
    const message = safeError(error, []);
    await prisma.mailbox.update({ where: { id }, data: { smtpLastError: message } });
    redirect(withNotice(`/mailboxes/${id}`, message));
  }
}

export async function pollMailboxNow(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  await pollMailbox(id, { force: true });
  redirect(withNotice(`/mailboxes/${id}`, "Проверка выполнена"));
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
  redirect(withNotice(`/rules?mailboxId=${mailboxId}`, "Базовые исключения добавлены"));
}

export async function resumeReplies(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  await prisma.mailbox.update({ where: { id }, data: { repliesPaused: false, smtpLastError: null } });
  redirect(withNotice(`/mailboxes/${id}`, "Ответы возобновлены"));
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

function policy(formData: FormData, key: string, fallback: string): string {
  const value = String(formData.get(key) || fallback);
  return ["send_now", "defer", "cancel"].includes(value) ? value : fallback;
}
