import { DateTime } from "luxon";
import { prisma } from "@/lib/db";

export type MetricDelta = {
  received?: number;
  parsed?: number;
  bodyErrors?: number;
  bodyTruncated?: number;
  phones?: number;
  emails?: number;
  urls?: number;
  amounts?: number;
  contracts?: number;
  deadlines?: number;
  excluded?: number;
  skipped?: number;
  notified?: number;
  dryRun?: number;
  throttledNotifications?: number;
  throttledReplies?: number;
  suppressedReplies?: number;
  notificationErrors?: number;
  autoReplies?: number;
  manualReplies?: number;
  smtpErrors?: number;
  deferredNotifications?: number;
  deferredReplies?: number;
  repliesOutsideHours?: number;
  processingMs?: number;
  notifyLatencyMs?: number;
  replyLatencyMs?: number;
  languages?: Record<string, number>;
  sentiments?: Record<string, number>;
  urgencies?: Record<string, number>;
};

type StoredCounters = MetricDelta & {
  processingCount?: number;
  notifyLatencyCount?: number;
  replyLatencyCount?: number;
};

export async function bumpMetrics(mailboxId: string, timezone: string, delta: MetricDelta) {
  const day = DateTime.now().setZone(timezone).startOf("day");
  const dayDate = new Date(Date.UTC(day.year, day.month - 1, day.day));
  const existing = await prisma.dailyMetric.findUnique({ where: { day_mailboxId: { day: dayDate, mailboxId } } });
  const merged = mergeCounters((existing?.counters as StoredCounters | undefined) ?? {}, delta);
  await prisma.dailyMetric.upsert({
    where: { day_mailboxId: { day: dayDate, mailboxId } },
    create: { day: dayDate, mailboxId, counters: merged },
    update: { counters: merged },
  });
}

function mergeCounters(base: StoredCounters, delta: MetricDelta): StoredCounters {
  const next: StoredCounters = { ...base };
  const numeric: Array<keyof MetricDelta> = [
    "received",
    "parsed",
    "bodyErrors",
    "bodyTruncated",
    "phones",
    "emails",
    "urls",
    "amounts",
    "contracts",
    "deadlines",
    "excluded",
    "skipped",
    "notified",
    "dryRun",
    "throttledNotifications",
    "throttledReplies",
    "suppressedReplies",
    "notificationErrors",
    "autoReplies",
    "manualReplies",
    "smtpErrors",
    "deferredNotifications",
    "deferredReplies",
    "repliesOutsideHours",
  ];
  for (const key of numeric) {
    const add = delta[key];
    if (typeof add !== "number") continue;
    const current = next[key];
    Object.assign(next, { [key]: (typeof current === "number" ? current : 0) + add });
  }
  if (delta.processingMs) {
    next.processingMs = (next.processingMs || 0) + delta.processingMs;
    next.processingCount = (next.processingCount || 0) + 1;
  }
  if (delta.notifyLatencyMs) {
    next.notifyLatencyMs = (next.notifyLatencyMs || 0) + delta.notifyLatencyMs;
    next.notifyLatencyCount = (next.notifyLatencyCount || 0) + 1;
  }
  if (delta.replyLatencyMs) {
    next.replyLatencyMs = (next.replyLatencyMs || 0) + delta.replyLatencyMs;
    next.replyLatencyCount = (next.replyLatencyCount || 0) + 1;
  }
  next.languages = addMaps(base.languages, delta.languages);
  next.sentiments = addMaps(base.sentiments, delta.sentiments);
  next.urgencies = addMaps(base.urgencies, delta.urgencies);
  return next;
}

function addMaps(base: Record<string, number> | undefined, delta: Record<string, number> | undefined) {
  const next = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(delta ?? {})) next[key] = (next[key] || 0) + value;
  return next;
}
