import { simpleParser } from "mailparser";
import { analyzeText } from "@/lib/analysis/analyze";
import { decodeMimePart } from "@/lib/mail/decode";
import { emptyMessage, type NormalizedMessage } from "@/lib/mail/model";
import type { AttachmentRef } from "@/lib/mail/structure";
import { extractEntities } from "@/lib/entities/extract";
import { extractHrefs, htmlToText, makePreview, normalizeWhitespace, splitQuotedText, truncateText } from "@/lib/text/extract";

const ALLOWED_HEADERS = [
  "auto-submitted",
  "precedence",
  "list-unsubscribe",
  "list-id",
  "x-mailer",
  "x-spam-flag",
  "x-spam-score",
  "message-id",
  "in-reply-to",
  "references",
  "reply-to",
];

const SUBJECT_PREFIX =
  /^(?:(?:re|fw|fwd|aw|отв|ответил|пересл|пересылка)\s*(?:\[\d+\])?\s*:\s*)+/i;

export type PipelineInput = {
  headerBuffer: Buffer;
  parts: Array<{ mimeType: string; charset?: string; encoding?: string; content: Buffer }>;
  attachments: AttachmentRef[];
  encrypted: boolean;
  sizeBytes: number;
  receivedAt: Date;
  timezone: string;
  bodyCharLimit: number;
  entityLimit: number;
};

export async function buildNormalizedMessage(input: PipelineInput): Promise<NormalizedMessage> {
  const message = emptyMessage(input.receivedAt);
  const parsed = await simpleParser(Buffer.concat([input.headerBuffer, Buffer.from("\r\n\r\n")]));
  const from = parsed.from?.value?.[0];
  message.subject = parsed.subject?.trim() || "";
  message.subjectNormalized = message.subject.replace(SUBJECT_PREFIX, "").trim();
  message.fromEmail = (from?.address || "").toLowerCase();
  message.fromDisplayName = from?.name || "";
  const domain = domainOf(message.fromEmail);
  message.fromDomain = domain.domain;
  message.fromTld = domain.tld;
  message.to = addresses(parsed.to);
  message.cc = addresses(parsed.cc);
  message.replyTo = addresses(parsed.replyTo);
  message.messageId = parsed.messageId || null;
  message.sentAt = parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : null;
  message.receivedAt = input.receivedAt;
  message.sizeBytes = input.sizeBytes;
  message.attachmentNames = input.attachments.map((item) => item.name);
  message.attachmentExtensions = [...new Set(input.attachments.map((item) => item.extension).filter(Boolean))];
  message.attachmentCount = input.attachments.length;
  message.hasAttachments = input.attachments.length > 0;
  message.headers = snapshotHeaders(parsed.headers);

  if (input.encrypted) {
    message.bodyUnavailable = true;
    message.bodyError = "encrypted";
  } else {
    const rendered = renderBodies(input.parts);
    const limited = truncateText(rendered.text, input.bodyCharLimit);
    const split = splitQuotedText(limited.text);
    message.bodyFullText = split.fullText;
    message.bodyNewText = split.newText;
    message.bodyPreview = makePreview(split.newText || split.fullText);
    message.bodyTruncated = limited.truncated || rendered.skippedLarge;
    message.quoteSplitConfidence = split.confidence;
    if (!split.fullText && input.parts.length === 0) message.bodyError = "empty";
    const extraLinks = rendered.hrefs.join("\n");
    const entities = extractEntities({
      subject: message.subject,
      body: `${message.bodyFullText}\n${extraLinks}`,
      fromDomain: message.fromDomain,
      receivedAt: message.receivedAt,
      timezone: input.timezone,
      limit: input.entityLimit,
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
      entityListsTruncated: entities.truncated,
    });
  }

  const analysis = analyzeText({
    subject: message.subject,
    body: message.bodyNewText || message.bodyFullText,
    deadlineIso: message.earliestDeadline,
    receivedAt: message.receivedAt,
  });
  message.language = analysis.language;
  message.languageConfidence = analysis.languageConfidence;
  message.sentiment = analysis.sentiment;
  message.sentimentScore = analysis.sentimentScore;
  message.urgencyLevel = analysis.urgencyLevel;
  message.urgencyScore = analysis.urgencyScore;
  return message;
}

export function normalizeSubject(subject: string): string {
  return subject.replace(SUBJECT_PREFIX, "").trim();
}

export function buildSearchDocument(message: NormalizedMessage): string {
  return normalizeWhitespace(
    [
      message.subject,
      message.fromEmail,
      message.fromDisplayName,
      message.fromDomain,
      message.bodyNewText,
      message.bodyFullText,
      message.phonesNormalized.join(" "),
      message.phonesRaw.join(" "),
      message.emails.join(" "),
      message.urls.join(" "),
      message.urlDomains.join(" "),
      message.contractNumbers.join(" "),
      message.invoiceNumbers.join(" "),
      message.actNumbers.join(" "),
      message.ticketIds.join(" "),
      message.attachmentNames.join(" "),
    ].join("\n"),
  ).slice(0, 180000);
}

function renderBodies(parts: PipelineInput["parts"]): { text: string; hrefs: string[]; skippedLarge: boolean } {
  const plain: string[] = [];
  const html: string[] = [];
  const hrefs: string[] = [];
  let skippedLarge = false;
  for (const part of parts) {
    if (part.content.length > 2_000_000) {
      skippedLarge = true;
      continue;
    }
    const decoded = decodeMimePart(part.content, part.encoding, part.charset);
    if (part.mimeType === "text/html") {
      hrefs.push(...extractHrefs(decoded));
      html.push(htmlToText(decoded));
    } else {
      plain.push(normalizeWhitespace(decoded));
    }
  }
  const plainText = normalizeWhitespace(plain.join("\n\n"));
  const htmlText = normalizeWhitespace(html.join("\n\n"));
  const text = plainText.length >= 40 || !htmlText ? plainText || htmlText : htmlText;
  return { text, hrefs, skippedLarge };
}

function addresses(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const list = "value" in value && Array.isArray((value as { value?: unknown[] }).value) ? (value as { value: Array<{ address?: string }> }).value : [];
  return list.map((item) => item.address?.toLowerCase() || "").filter(Boolean);
}

function domainOf(email: string): { domain: string; tld: string } {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  const tld = domain.split(".").filter(Boolean).at(-1) || "";
  return { domain, tld };
}

function snapshotHeaders(headers: { get: (key: string) => unknown }): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const key of ALLOWED_HEADERS) {
    const value = headers.get(key);
    if (Array.isArray(value)) snapshot[key] = value.map(String).join(", ");
    else if (value != null && value !== "") snapshot[key] = String(value);
  }
  return snapshot;
}
