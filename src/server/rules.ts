"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { analyzeText } from "@/lib/analysis/analyze";
import { extractEntities } from "@/lib/entities/extract";
import { emptyMessage, type NormalizedMessage } from "@/lib/mail/model";
import { decideMessage } from "@/lib/orchestration/decide";
import { normalizeAction, parseSchedule, parseStoredRule } from "@/lib/rules/parse";
import type { ConditionGroup } from "@/lib/rules/types";
import { getIntegrationConfig } from "@/lib/settings";

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
    autoReplyEnabled: formData.get("autoReplyEnabled") === "on",
    templateId: String(formData.get("templateId") || "") || null,
    replyRespectWorkingHours: formData.get("replyRespectWorkingHours") === "on",
    throttlingEnabled: formData.get("throttlingEnabled") === "on",
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
    dryRun: formData.get("dryRun") === "on",
  };
  const saved = id ? await prisma.rule.update({ where: { id }, data }) : await prisma.rule.create({ data });
  redirect(`/rules/${saved.id}?notice=Сохранено`);
}

export async function moveRule(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") || "");
  const direction = String(formData.get("direction") || "up");
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) redirect("/rules");
  const siblings = await prisma.rule.findMany({ where: { mailboxId: rule.mailboxId }, orderBy: { position: "asc" } });
  const index = siblings.findIndex((item) => item.id === id);
  const swapWith = siblings[direction === "up" ? index - 1 : index + 1];
  if (!swapWith) redirect(`/rules?mailboxId=${rule.mailboxId}`);
  await prisma.$transaction([
    prisma.rule.update({ where: { id: rule.id }, data: { position: swapWith.position } }),
    prisma.rule.update({ where: { id: swapWith.id }, data: { position: rule.position } }),
  ]);
  redirect(`/rules?mailboxId=${rule.mailboxId}`);
}

export async function testRule(prev: { text: string } | null, formData: FormData): Promise<{ text: string }> {
  void prev;
  await requireUser();
  const id = String(formData.get("id") || "");
  const row = await prisma.rule.findUnique({ where: { id }, include: { mailbox: true } });
  if (!row) return { text: "Правило не найдено" };
  const rule = parseStoredRule(row);
  if (!rule) return { text: "Правило повреждено" };
  const message = await sampleMessage(formData, row.mailbox.timezone);
  const config = await getIntegrationConfig();
  const decision = decideMessage(message, [rule], {
    now: new Date(),
    mailboxId: row.mailboxId,
    mailboxName: row.mailbox.name,
    uid: "test",
    schedule: parseSchedule(row.mailbox),
    notifyOutsidePolicy: row.mailbox.notifyOutsidePolicy === "send_now" || row.mailbox.notifyOutsidePolicy === "cancel" ? row.mailbox.notifyOutsidePolicy : "defer",
    replyOutsidePolicy: row.mailbox.replyOutsidePolicy === "defer" || row.mailbox.replyOutsidePolicy === "cancel" ? row.mailbox.replyOutsidePolicy : "send_now",
    globalDryRun: true,
    mailboxDryRun: true,
    blocklist: Array.isArray(row.mailbox.autoReplyBlocklist) ? row.mailbox.autoReplyBlocklist.map(String) : [],
    templateBody: "Тестовый шаблон для {{from_name}}",
    throttle: {
      ruleNotificationsLastHour: 0,
      notifyPerHour: row.mailbox.notifyPerHour,
      senderPaused: false,
      subjectPaused: false,
      domainPaused: false,
      mailboxRepliesLastHour: 0,
      replyPerHour: row.mailbox.replyPerHour,
      recipientRepliesLastDay: 0,
      replyPerRecipientDay: row.mailbox.replyPerRecipientDay,
    },
    previewInNotification: config.includeBodyPreview,
    previewChars: config.previewChars,
    globalMessageDedupe: false,
    repliesEnabled: row.mailbox.repliesEnabled,
  });
  const lines = [
    decision.rule ? `Совпало. Решение: ${decision.decision}` : "Не совпало",
    decision.notification ? `Уведомление: ${decision.notification.status}, срок ${decision.notification.responseDueAt?.toISOString() || "—"}` : "Уведомление не создаётся",
    decision.reply ? `Ответ: ${decision.reply.status}${decision.reply.suppressedReason ? `, причина ${decision.reply.suppressedReason}` : ""}` : "Ответ не создаётся",
  ];
  return { text: lines.join(". ") };
}

async function sampleMessage(formData: FormData, timezone: string): Promise<NormalizedMessage> {
  const messageId = String(formData.get("messageId") || "");
  if (messageId) {
    const stored = await prisma.processedMessage.findUnique({ where: { id: messageId } });
    if (stored) return storedToMessage(stored);
  }
  const receivedAt = new Date();
  const message = emptyMessage(receivedAt);
  message.subject = String(formData.get("subject") || "");
  message.subjectNormalized = message.subject;
  message.fromEmail = String(formData.get("fromEmail") || "").toLowerCase();
  message.fromDomain = message.fromEmail.split("@")[1] || "";
  message.fromTld = message.fromDomain.split(".").at(-1) || "";
  message.bodyFullText = String(formData.get("body") || "");
  message.bodyNewText = message.bodyFullText;
  const entities = extractEntities({
    subject: message.subject,
    body: message.bodyFullText,
    fromDomain: message.fromDomain,
    receivedAt,
    timezone,
  });
  Object.assign(message, {
    phonesRaw: entities.phonesRaw,
    phonesNormalized: entities.phonesNormalized,
    emails: entities.emails,
    urls: entities.urls,
    urlDomains: entities.urlDomains,
    urlDomainMismatch: entities.urlDomainMismatch,
    dates: entities.dates,
    deadlines: entities.deadlines,
    earliestDeadline: entities.earliestDeadline,
    amounts: entities.amounts,
    currencies: entities.currencies,
    contractNumbers: entities.contractNumbers,
    invoiceNumbers: entities.invoiceNumbers,
    actNumbers: entities.actNumbers,
    ticketIds: entities.ticketIds,
    innNumbers: entities.innNumbers,
    kppNumbers: entities.kppNumbers,
    ogrnNumbers: entities.ogrnNumbers,
    bankAccountCandidates: entities.bankAccountCandidates,
  });
  const headerName = String(formData.get("headerName") || "").toLowerCase();
  const headerValue = String(formData.get("headerValue") || "");
  if (headerName) message.headers[headerName] = headerValue;
  const analysis = analyzeText({ subject: message.subject, body: message.bodyNewText, deadlineIso: message.earliestDeadline, receivedAt });
  message.language = analysis.language;
  message.languageConfidence = analysis.languageConfidence;
  message.sentiment = analysis.sentiment;
  message.sentimentScore = analysis.sentimentScore;
  message.urgencyLevel = analysis.urgencyLevel;
  message.urgencyScore = analysis.urgencyScore;
  return message;
}

function storedToMessage(row: {
  subject: string;
  subjectNormalized: string;
  fromEmail: string;
  fromDisplayName: string;
  fromDomain: string;
  fromTld: string;
  toRecipients: string[];
  ccRecipients: string[];
  replyTo: string[];
  messageIdHeader: string | null;
  receivedAt: Date;
  sentAt: Date | null;
  sizeBytes: number;
  attachmentCount: number;
  attachmentNames: string[];
  attachmentExtensions: string[];
  headersSnapshot: unknown;
  bodyFullText: string;
  bodyNewText: string;
  bodyPreview: string;
  bodyTruncated: boolean;
  bodyUnavailable: boolean;
  bodyError: string | null;
  quoteSplitConfidence: string;
  language: string;
  languageConfidence: number;
  sentiment: string;
  sentimentScore: number;
  urgencyLevel: string;
  urgencyScore: number;
  phonesRaw: string[];
  phonesNormalized: string[];
  emails: string[];
  urls: string[];
  urlDomains: string[];
  urlDomainMismatch: boolean;
  dates: unknown;
  deadlines: unknown;
  earliestDeadline: Date | null;
  amounts: unknown;
  currencies: string[];
  contractNumbers: string[];
  invoiceNumbers: string[];
  actNumbers: string[];
  ticketIds: string[];
  innNumbers: string[];
  kppNumbers: string[];
  ogrnNumbers: string[];
  bankAccountCandidates: string[];
  entityListsTruncated: boolean;
}): NormalizedMessage {
  const message = emptyMessage(row.receivedAt);
  return {
    ...message,
    subject: row.subject,
    subjectNormalized: row.subjectNormalized,
    fromEmail: row.fromEmail,
    fromDisplayName: row.fromDisplayName,
    fromDomain: row.fromDomain,
    fromTld: row.fromTld,
    to: row.toRecipients,
    cc: row.ccRecipients,
    replyTo: row.replyTo,
    messageId: row.messageIdHeader,
    sentAt: row.sentAt,
    sizeBytes: row.sizeBytes,
    attachmentCount: row.attachmentCount,
    attachmentNames: row.attachmentNames,
    attachmentExtensions: row.attachmentExtensions,
    hasAttachments: row.attachmentCount > 0,
    headers: (row.headersSnapshot as Record<string, string>) || {},
    bodyFullText: row.bodyFullText,
    bodyNewText: row.bodyNewText,
    bodyPreview: row.bodyPreview,
    bodyTruncated: row.bodyTruncated,
    bodyUnavailable: row.bodyUnavailable,
    bodyError: row.bodyError,
    quoteSplitConfidence: row.quoteSplitConfidence === "low" ? "low" : "high",
    language: row.language,
    languageConfidence: row.languageConfidence,
    sentiment: row.sentiment,
    sentimentScore: row.sentimentScore,
    urgencyLevel: row.urgencyLevel,
    urgencyScore: row.urgencyScore,
    phonesRaw: row.phonesRaw,
    phonesNormalized: row.phonesNormalized,
    emails: row.emails,
    urls: row.urls,
    urlDomains: row.urlDomains,
    urlDomainMismatch: row.urlDomainMismatch,
    dates: Array.isArray(row.dates) ? (row.dates as NormalizedMessage["dates"]) : [],
    deadlines: Array.isArray(row.deadlines) ? (row.deadlines as NormalizedMessage["deadlines"]) : [],
    earliestDeadline: row.earliestDeadline?.toISOString() ?? null,
    amounts: Array.isArray(row.amounts) ? (row.amounts as NormalizedMessage["amounts"]) : [],
    currencies: row.currencies,
    contractNumbers: row.contractNumbers,
    invoiceNumbers: row.invoiceNumbers,
    actNumbers: row.actNumbers,
    ticketIds: row.ticketIds,
    innNumbers: row.innNumbers,
    kppNumbers: row.kppNumbers,
    ogrnNumbers: row.ogrnNumbers,
    bankAccountCandidates: row.bankAccountCandidates,
    entityListsTruncated: row.entityListsTruncated,
  };
}
