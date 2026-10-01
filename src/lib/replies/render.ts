import type { NormalizedMessage } from "@/lib/mail/model";

const TOKENS: Record<string, (message: NormalizedMessage, extra: TemplateExtra) => string> = {
  from_name: (message) => message.fromDisplayName || message.fromEmail,
  from_email: (message) => message.fromEmail,
  from_domain: (message) => message.fromDomain,
  subject: (message) => message.subject,
  received_at: (message) => message.receivedAt.toISOString(),
  contract_numbers: (message) => message.contractNumbers.join(", "),
  invoice_numbers: (message) => message.invoiceNumbers.join(", "),
  amounts: (message) => message.amounts.map((item) => `${item.amount}${item.currency ? ` ${item.currency}` : ""}`).join(", "),
  earliest_deadline: (message) => message.earliestDeadline || "",
  category: (_message, extra) => extra.category || "",
  priority: (_message, extra) => extra.priority || "",
  attachments: (message) => message.attachmentNames.join(", "),
  mailbox_name: (_message, extra) => extra.mailboxName || "",
  message_ref: (message, extra) => extra.messageRef || message.messageId || "",
};

export type TemplateExtra = {
  category?: string | null;
  priority?: string | null;
  mailboxName?: string;
  messageRef?: string;
};

export function renderTemplate(template: string, message: NormalizedMessage, extra: TemplateExtra = {}): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_token, name: string) => {
    const resolver = TOKENS[name.toLowerCase()];
    return resolver ? resolver(message, extra) : "";
  });
}

export function replySubject(subject: string): string {
  const clean = subject.trim();
  if (/^re\s*:/i.test(clean)) return clean;
  return `Re: ${clean}`.trim();
}

export function replyRecipients(message: NormalizedMessage): string {
  return message.replyTo[0] || message.fromEmail;
}
