import type { WorkInterval, WorkSchedule } from "@/lib/hours/schedule";
import type { OutsidePolicy } from "@/lib/hours/schedule";
import { DEFAULT_NOTICE_FIELDS, NOTICE_FIELDS, sanitizeNoticeFields } from "@/lib/b24/notice";
import type { ConditionNode, Priority, RuleAction, RuleRecord } from "@/lib/rules/types";

const PRIORITIES: Priority[] = ["low", "normal", "high", "critical"];

export function parseStoredRule(row: {
  id: string;
  name: string;
  type: string;
  position: number;
  active: boolean;
  category: string | null;
  conditions: unknown;
  action: unknown;
}): RuleRecord | null {
  if (row.type !== "exclude" && row.type !== "notify") return null;
  if (!row.conditions || typeof row.conditions !== "object") return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    position: row.position,
    active: row.active,
    category: row.category,
    conditions: row.conditions as ConditionNode,
    action: normalizeAction(row.action),
  };
}

export function normalizeAction(value: unknown): RuleAction {
  const raw = value && typeof value === "object" ? (value as Partial<RuleAction>) : {};
  const priority = PRIORITIES.includes(raw.priority as Priority) ? (raw.priority as Priority) : "normal";
  const responseHours = Number(raw.responseHours);
  return {
    notificationEnabled: Boolean(raw.notificationEnabled),
    category: raw.category ?? null,
    priority,
    responseHours: Number.isFinite(responseHours) && responseHours > 0 ? responseHours : 24,
    useExtractedDeadline: Boolean(raw.useExtractedDeadline),
    recipientIds: Array.isArray(raw.recipientIds) ? raw.recipientIds.map(String) : [],
    throttlingEnabled: raw.throttlingEnabled !== false,
    notifyOutsidePolicy: optionalPolicy(raw.notifyOutsidePolicy),
    noticeGrouping: raw.noticeGrouping === "digest" ? "digest" : "each",
    noticeFields: resolveNoticeFields(raw),
    noticeMetaOptional: raw.noticeMetaOptional === true,
  };
}

function resolveNoticeFields(raw: Partial<RuleAction> & { noticeMetaOptional?: boolean }) {
  if (!Array.isArray(raw.noticeFields)) return [...DEFAULT_NOTICE_FIELDS];
  const fields = sanitizeNoticeFields(raw.noticeFields);
  if (raw.noticeMetaOptional) return fields;
  const picked = new Set<string>(fields);
  picked.add("priority");
  picked.add("due");
  return NOTICE_FIELDS.map(([id]) => id).filter((id) => picked.has(id));
}

export function readNotifyPolicy(value: unknown): OutsidePolicy | null {
  if (!value || typeof value !== "object" || !("notifyOutsidePolicy" in value)) return null;
  return parsePolicy(String((value as { notifyOutsidePolicy?: unknown }).notifyOutsidePolicy));
}

export function parseSchedule(input: {
  timezone: string;
  workDays: unknown;
  workIntervals: unknown;
  holidays: unknown;
}): WorkSchedule {
  const workDays = Array.isArray(input.workDays) ? input.workDays.map(Number).filter((day) => day >= 1 && day <= 7) : [1, 2, 3, 4, 5];
  const intervals = Array.isArray(input.workIntervals)
    ? input.workIntervals.filter(isInterval)
    : [{ start: "09:00", end: "18:00" }];
  const holidays = Array.isArray(input.holidays) ? input.holidays.map(String) : [];
  return {
    timezone: input.timezone || "Europe/Moscow",
    workDays,
    intervals: intervals.length ? intervals : [{ start: "09:00", end: "18:00" }],
    holidays,
  };
}

export function parsePolicy(value: string): OutsidePolicy {
  if (value === "send_now" || value === "cancel") return value;
  return "defer";
}

function optionalPolicy(value: unknown): OutsidePolicy | undefined {
  if (value === "send_now" || value === "cancel" || value === "defer") return value;
  return undefined;
}

function isInterval(value: unknown): value is WorkInterval {
  return Boolean(value && typeof value === "object" && "start" in value && "end" in value);
}
