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
