export const STATUS_LABELS: Record<string, string> = {
  pending: "ожидает отправки",
  scheduled: "запланировано",
  sending: "отправляется",
  sent: "отправлено",
  error: "ошибка",
  cancelled: "отменено",
  dry_run: "сухой прогон",
  throttled: "подавлено лимитом",
  suppressed: "подавлено",
  exclude: "исключено",
  notify: "уведомление",
  reply_only: "только ответ",
  notify_and_reply: "уведомление и ответ",
  skipped_no_rule: "пропущено без правила",
  digest_part: "собирается в общее",
};

export function labelStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function statusCode(input: string | undefined): string | undefined {
  return codeForLabel(STATUS_LABELS, input);
}

export function codeForLabel(labels: Record<string, string>, input: string | undefined): string | undefined {
  const needle = input?.trim().toLowerCase();
  if (!needle) return undefined;
  if (Object.prototype.hasOwnProperty.call(labels, needle)) return needle;
  const found = Object.entries(labels).find(([, label]) => label.toLowerCase() === needle);
  return found ? found[0] : input?.trim();
}
