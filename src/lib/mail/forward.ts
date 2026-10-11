import { formatDueLabel } from "@/lib/b24/notice";
import type { NormalizedMessage } from "@/lib/mail/model";
import type { RuleAction } from "@/lib/rules/types";

export type ForwardEmployee = {
  id: string;
  login: string;
  active: boolean;
  dismissed: boolean;
};

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function resolveForwardAddress(action: RuleAction, employee: ForwardEmployee | null): string | null {
  if (!action.forwardEnabled) return null;
  if (action.forwardSource === "employee") {
    if (!employee || employee.id !== action.forwardRecipientId || !employee.active || employee.dismissed) return null;
    return isEmail(employee.login) ? employee.login.trim().toLowerCase() : null;
  }
  return isEmail(action.forwardAddress) ? action.forwardAddress.trim().toLowerCase() : null;
}

export function forwardLetter(message: NormalizedMessage): { subject: string; text: string } {
  const from = message.fromDisplayName ? `${message.fromDisplayName} <${message.fromEmail}>` : message.fromEmail || "неизвестно";
  const body = (message.bodyFullText || message.bodyNewText || "").trim();
  const files = message.attachmentNames.map((name) => name.trim()).filter(Boolean);
  const lines = [
    "---------- Пересланное сообщение ----------",
    `От: ${from}`,
    `Дата: ${formatDueLabel(message.receivedAt)}`,
    `Тема: ${message.subject || "без темы"}`,
  ];
  if (message.to.length) lines.push(`Кому: ${message.to.join(", ")}`);
  lines.push("", body || "(текст письма пуст)");
  if (files.length) lines.push("", `Вложения в исходном письме: ${files.join(", ")}`, "Файлы вложений не пересылаются, только их имена.");
  const subject = `Fwd: ${message.subject || "без темы"}`.slice(0, 900);
  return { subject, text: lines.join("\n") };
}
