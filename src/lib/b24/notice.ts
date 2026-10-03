const PRIORITY_LABELS: Record<string, string> = {
  low: "низкий",
  normal: "обычный",
  high: "высокий",
  critical: "критичный",
};

export const EXAMPLE_SUBJECT = "Просим согласовать договор № 45/2026";
export const EXAMPLE_FROM = "Анна Соколова <anna@client.ru>";

export const NOTICE_FIELDS = [
  ["subject", "Тема"],
  ["from", "Отправитель"],
  ["priority", "Приоритет"],
  ["due", "Ответить до"],
  ["received", "Когда пришло"],
  ["text", "Текст письма"],
  ["attachments", "Вложения"],
  ["phones", "Телефоны"],
  ["urls", "Ссылки"],
  ["contracts", "Договоры"],
  ["invoices", "Счета"],
  ["amounts", "Суммы"],
  ["deadline", "Срок в письме"],
] as const;

export type NoticeField = (typeof NOTICE_FIELDS)[number][0];

export const DEFAULT_NOTICE_FIELDS: NoticeField[] = ["subject", "from", "priority", "due"];

const NOTICE_FIELD_IDS = new Set<string>(NOTICE_FIELDS.map(([id]) => id));

export function sanitizeNoticeFields(value: unknown): NoticeField[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((id): id is NoticeField => NOTICE_FIELD_IDS.has(id)))];
}

export type NoticeLetter = {
  subject?: string;
  from?: string;
  received?: string;
  text?: string;
  attachments?: string[];
  phones?: string[];
  urls?: string[];
  contracts?: string[];
  invoices?: string[];
  amounts?: string[];
  deadline?: string;
};

export function letterDetailLines(letter: NoticeLetter, fields: readonly string[]): string[] {
  const picked = new Set(fields);
  const lines: string[] = [];
  if (picked.has("subject")) lines.push(`Тема: ${letter.subject?.trim() || "без темы"}`);
  if (picked.has("from")) lines.push(`От: ${letter.from?.trim() || "неизвестный отправитель"}`);
  if (picked.has("received") && letter.received?.trim()) lines.push(`Когда пришло: ${letter.received.trim()}`);
  if (picked.has("text") && letter.text?.trim()) lines.push(`Текст: ${letter.text.trim()}`);
  if (picked.has("attachments") && letter.attachments?.length) lines.push(`Вложения: ${letter.attachments.join(", ")}`);
  if (picked.has("phones") && letter.phones?.length) lines.push(`Телефоны: ${letter.phones.join(", ")}`);
  if (picked.has("urls") && letter.urls?.length) lines.push(`Ссылки: ${letter.urls.join(", ")}`);
  if (picked.has("contracts") && letter.contracts?.length) lines.push(`Договоры: ${letter.contracts.join(", ")}`);
  if (picked.has("invoices") && letter.invoices?.length) lines.push(`Счета: ${letter.invoices.join(", ")}`);
  if (picked.has("amounts") && letter.amounts?.length) lines.push(`Суммы: ${letter.amounts.join(", ")}`);
  if (picked.has("deadline") && letter.deadline?.trim()) lines.push(`Срок в письме: ${letter.deadline.trim()}`);
  return lines;
}

function noticeMetaLines(input: { priority: string; category?: string | null; responseDueLabel?: string; fields: readonly string[] }, includeDue = true): string[] {
  const lines: string[] = [];
  if (input.fields.includes("priority")) lines.push(`Приоритет: ${priorityLabel(input.priority)}`);
  if (input.category?.trim()) lines.push(`Категория: ${input.category.trim()}`);
  if (includeDue && input.fields.includes("due") && input.responseDueLabel) lines.push(`Ответить до: ${input.responseDueLabel}`);
  return lines;
}

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] || priority;
}

export function formatDueLabel(date: Date | null): string {
  if (!date) return "не задан";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

export function formatBitrixNotice(input: {
  mailboxName: string;
  priority: string;
  category?: string | null;
  responseDueLabel: string;
  fields: readonly string[];
  letter: NoticeLetter;
}): string {
  const lines = [`Новое письмо на ящике «${input.mailboxName || "Ящик"}»`, ...noticeMetaLines(input)];
  lines.push(...letterDetailLines(input.letter, input.fields));
  return lines.join("\n");
}

export type DigestLetter = NoticeLetter & {
  responseDueLabel: string;
};

export function formatBitrixDigest(input: {
  mailboxName: string;
  priority: string;
  category?: string | null;
  fields: readonly string[];
  letters: DigestLetter[];
}): string {
  const lines = [`Новые письма на ящике «${input.mailboxName || "Ящик"}»: ${input.letters.length}`, ...noticeMetaLines(input, false)];
  input.letters.forEach((letter, index) => {
    const details = letterDetailLines(letter, input.fields);
    lines.push("");
    if (details.length === 0) {
      lines.push(`${index + 1}.`);
    } else {
      lines.push(`${index + 1}. ${details[0]}`);
      lines.push(...details.slice(1));
    }
    if (input.fields.includes("due")) lines.push(`Ответить до: ${letter.responseDueLabel}`);
  });
  return lines.join("\n");
}
