import type { NormalizedMessage } from "@/lib/mail/model";
import { isGroup, type Condition, type ConditionNode, type RuleRecord } from "@/lib/rules/types";

export function firstMatchingRule(rules: RuleRecord[], message: NormalizedMessage): RuleRecord | null {
  const ordered = [...rules].filter((rule) => rule.active).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  for (const rule of ordered) {
    if (matches(rule.conditions, message)) return rule;
  }
  return null;
}

export function matches(node: ConditionNode, message: NormalizedMessage): boolean {
  if (isGroup(node)) {
    if (node.conditions.length === 0) return false;
    const results = node.conditions.map((item) => matches(item, message));
    if (node.op === "any") return results.some(Boolean);
    if (node.op === "none") return results.every((item) => !item);
    return results.every(Boolean);
  }
  return matchCondition(node, message);
}

function matchCondition(condition: Condition, message: NormalizedMessage): boolean {
  if (condition.operator === "always") return true;
  const value = readField(message, condition.field);
  const expected = condition.value;
  switch (condition.operator) {
    case "exists":
      return !isEmpty(value);
    case "not_exists":
    case "empty":
      return isEmpty(value);
    case "not_empty":
      return !isEmpty(value);
    case "eq":
      return fold(value) === fold(expected);
    case "neq":
      return fold(value) !== fold(expected);
    case "contains":
      return asText(value).includes(asText(expected));
    case "not_contains":
      return !asText(value).includes(asText(expected));
    case "starts_with":
      return asText(value).startsWith(asText(expected));
    case "ends_with":
      return asText(value).endsWith(asText(expected));
    case "regex":
      return testRegex(value, expected);
    case "in":
      return list(expected).includes(fold(value));
    case "not_in":
      return !list(expected).includes(fold(value));
    case "intersects":
      return asList(value).some((item) => list(expected).includes(item));
    case "not_intersects":
      return !asList(value).some((item) => list(expected).includes(item));
    case "gt":
      return asNumber(value) > asNumber(expected);
    case "lt":
      return asNumber(value) < asNumber(expected);
    case "before":
      return asTime(value) < asTime(expected);
    case "after":
      return asTime(value) > asTime(expected);
    case "phrase_match":
      return asText(value).includes(asText(expected));
    case "full_text_match":
      return asText(expected)
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => asText(value).includes(token));
    default:
      return false;
  }
}

export function readField(message: NormalizedMessage, field: string): unknown {
  if (field.startsWith("header.")) {
    return message.headers[field.slice("header.".length).toLowerCase()] ?? "";
  }
  switch (field) {
    case "subject":
      return message.subject;
    case "subject_normalized":
      return message.subjectNormalized;
    case "from_email":
      return message.fromEmail;
    case "from_display_name":
      return message.fromDisplayName;
    case "from_domain":
      return message.fromDomain;
    case "from_tld":
      return message.fromTld;
    case "to":
      return message.to;
    case "cc":
      return message.cc;
    case "reply_to":
      return message.replyTo;
    case "message_id":
      return message.messageId;
    case "received_at":
      return message.receivedAt.toISOString();
    case "sent_at":
      return message.sentAt?.toISOString() ?? null;
    case "size_bytes":
      return message.sizeBytes;
    case "attachment_count":
      return message.attachmentCount;
    case "attachment_names":
      return message.attachmentNames;
    case "attachment_extensions":
      return message.attachmentExtensions;
    case "body_full_text":
      return message.bodyFullText;
    case "body_new_text":
      return message.bodyNewText;
    case "body_preview":
      return message.bodyPreview;
    case "language":
      return message.language;
    case "language_confidence":
      return message.languageConfidence;
    case "sentiment":
      return message.sentiment;
    case "sentiment_score":
      return message.sentimentScore;
    case "urgency_level":
      return message.urgencyLevel;
    case "urgency_score":
      return message.urgencyScore;
    case "has_deadline":
      return message.deadlines.length > 0;
    case "dates":
      return message.dates.map((item) => item.iso);
    case "deadlines":
      return message.deadlines.map((item) => item.iso);
    case "earliest_deadline":
      return message.earliestDeadline;
    case "amounts":
      return message.amounts.map((item) => String(item.amount));
    case "currencies":
      return message.currencies;
    case "extracted_phones":
    case "phones":
      return message.phonesNormalized;
    case "extracted_emails":
      return message.emails;
    case "extracted_urls":
      return message.urls;
    case "url_domains":
      return message.urlDomains;
    case "contract_numbers":
      return message.contractNumbers;
    case "invoice_numbers":
      return message.invoiceNumbers;
    case "act_numbers":
      return message.actNumbers;
    case "ticket_ids":
      return message.ticketIds;
    case "inn_numbers":
      return message.innNumbers;
    case "kpp_numbers":
      return message.kppNumbers;
    case "ogrn_numbers":
      return message.ogrnNumbers;
    case "bank_account_candidates":
      return message.bankAccountCandidates;
    case "has_attachments":
      return message.hasAttachments;
    case "url_domain_mismatch":
      return message.urlDomainMismatch;
    default:
      return null;
  }
}

function testRegex(value: unknown, pattern: unknown): boolean {
  const source = String(pattern ?? "");
  if (!source || source.length > 200) return false;
  try {
    const regex = new RegExp(source, "i");
    return asList(value).some((item) => regex.test(item)) || regex.test(asText(value));
  } catch {
    return false;
  }
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return false;
}

function fold(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.map((item) => String(item).toLowerCase()).join("\n");
  return String(value ?? "").trim().toLowerCase();
}

function asText(value: unknown): string {
  if (Array.isArray(value)) return value.join("\n").toLowerCase();
  return String(value ?? "").toLowerCase();
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).toLowerCase());
  if (value == null || value === "") return [];
  return [String(value).toLowerCase()];
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function asNumber(value: unknown): number {
  if (Array.isArray(value)) {
    const numbers = value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    return numbers.length ? Math.max(...numbers) : Number.NaN;
  }
  return Number(value);
}

function asTime(value: unknown): number {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : Number.NaN;
}
