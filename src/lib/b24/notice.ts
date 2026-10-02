const PRIORITY_LABELS: Record<string, string> = {
  low: "низкий",
  normal: "обычный",
  high: "высокий",
  critical: "критичный",
};

export const EXAMPLE_SUBJECT = "Просим согласовать договор № 45/2026";
export const EXAMPLE_FROM = "Анна Соколова <anna@client.ru>";

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
  subject: string;
  from: string;
  priority: string;
  category?: string | null;
  responseDueLabel: string;
}): string {
  const lines = [
    `Новое письмо на ящике «${input.mailboxName || "Ящик"}»`,
    `Тема: ${input.subject || "без темы"}`,
    `От: ${input.from || "неизвестный отправитель"}`,
    `Приоритет: ${priorityLabel(input.priority)}`,
  ];
  if (input.category?.trim()) lines.push(`Категория: ${input.category.trim()}`);
  lines.push(`Ответить до: ${input.responseDueLabel}`);
  return lines.join("\n");
}
