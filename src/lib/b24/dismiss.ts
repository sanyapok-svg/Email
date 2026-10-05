export const DISMISSAL_CHOICES = ["deactivate", "replace", "remove"] as const;

export type DismissalChoice = (typeof DISMISSAL_CHOICES)[number];

export type DismissalDecision = {
  ruleId: string;
  choice: DismissalChoice;
  replacementId: string;
};

export type DismissalNotice = {
  ruleId: string;
  ruleName: string;
  mailboxName: string;
  active: boolean;
  sole: boolean;
  others: string;
  queued: number;
};

export const OPEN_NOTIFICATION_STATUSES = ["pending", "scheduled", "sending", "error", "dry_run", "throttled", "digest_part"] as const;

export function recipientIdsOf(action: unknown): string[] {
  if (!action || typeof action !== "object" || !Array.isArray((action as { recipientIds?: unknown }).recipientIds)) return [];
  return [...new Set((action as { recipientIds: unknown[] }).recipientIds.map(String).filter(Boolean))];
}

export function payloadRecipientIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { recipients?: unknown }).recipients)) return [];
  return (payload as { recipients: unknown[] }).recipients.map(String).filter(Boolean);
}

export function applyRecipientChange(recipientIds: string[], employeeId: string, choice: DismissalChoice, replacementId: string): string[] {
  if (choice === "replace") {
    const next = recipientIds.map((id) => (id === employeeId ? replacementId : id));
    return [...new Set(next.filter((id) => id && id !== employeeId))];
  }
  return [...new Set(recipientIds.filter((id) => id !== employeeId))];
}

export function planOpenNotification(
  recipients: string[],
  employeeId: string,
  decision: DismissalDecision | null,
): { recipients: string[]; cancel: boolean } {
  if (!recipients.includes(employeeId)) return { recipients, cancel: false };
  if (!decision) {
    const after = applyRecipientChange(recipients, employeeId, "remove", "");
    return { recipients: after, cancel: after.length === 0 };
  }
  const after = applyRecipientChange(recipients, employeeId, decision.choice, decision.replacementId);
  return { recipients: after, cancel: decision.choice === "deactivate" || after.length === 0 };
}

export function validateDecisions(input: {
  employeeId: string;
  rules: Array<{ id: string; type: string; recipientIds: string[] }>;
  decisions: DismissalDecision[];
  replacementIds: ReadonlySet<string>;
}): { ok: true } | { ok: false; error: string } {
  const affected = input.rules.filter((rule) => rule.type === "notify" && rule.recipientIds.includes(input.employeeId));
  const byId = new Map(input.decisions.map((decision) => [decision.ruleId, decision]));
  if (affected.length !== byId.size || affected.some((rule) => !byId.has(rule.id))) {
    return { ok: false, error: "Список уведомлений изменился. Откройте увольнение ещё раз" };
  }
  for (const rule of affected) {
    const decision = byId.get(rule.id);
    if (!decision || !DISMISSAL_CHOICES.includes(decision.choice)) return { ok: false, error: "Укажите, что сделать с каждым уведомлением" };
    const sole = rule.recipientIds.every((id) => id === input.employeeId);
    if (decision.choice === "remove" && sole) return { ok: false, error: "Единственного получателя можно заменить или выключить уведомление" };
    if (decision.choice === "deactivate" && !sole) return { ok: false, error: "Уведомление с другими получателями можно не выключать: уберите сотрудника или замените его" };
    if (decision.choice === "replace" && (!decision.replacementId || decision.replacementId === input.employeeId || !input.replacementIds.has(decision.replacementId))) {
      return { ok: false, error: "Выберите сотрудника на замену" };
    }
  }
  return { ok: true };
}

export function readDecisions(value: unknown): DismissalDecision[] | null {
  let raw: unknown = value;
  if (typeof value === "string") {
    if (!value.trim()) return [];
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  const decisions: DismissalDecision[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const record = item as Partial<DismissalDecision>;
    const choice = String(record.choice ?? "");
    if (!DISMISSAL_CHOICES.includes(choice as DismissalChoice)) return null;
    decisions.push({
      ruleId: String(record.ruleId ?? ""),
      choice: choice as DismissalChoice,
      replacementId: String(record.replacementId ?? ""),
    });
  }
  return decisions;
}
