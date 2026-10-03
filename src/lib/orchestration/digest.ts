import type { Prisma } from "@prisma/client";
import { DEFAULT_NOTICE_FIELDS, formatBitrixDigest, formatDueLabel, sanitizeNoticeFields, type DigestLetter, type NoticeLetter } from "@/lib/b24/notice";
import { prisma } from "@/lib/db";
import { isLockHeld } from "@/lib/locks";
import { bumpMetrics } from "@/lib/metrics/counters";
import type { NotificationDraft } from "@/lib/orchestration/decide";

export const DIGEST_PART = "digest_part";

const PRIORITY_RANK: Record<string, number> = { low: 0, normal: 1, high: 2, critical: 3 };

export type DigestPiece = {
  messageId: string;
  status: string;
  priority: string;
  category: string | null;
  responseDueAt: Date | null;
  overdue: boolean;
  dueRisk: boolean;
  scheduledAt: Date | null;
  payload: Record<string, unknown>;
};

export function holdDigest(draft: NotificationDraft, pollToken: string): Record<string, unknown> {
  return {
    ...draft.payload,
    pollToken,
    releaseStatus: draft.status,
  };
}

export function combineDigest(pieces: DigestPiece[], scope: { mailboxId: string; ruleId: string }): DigestPiece & { idempotencyKey: string } {
  const first = pieces[0];
  const status = groupStatus(pieces.map((piece) => piece.status));
  const priority = pieces.reduce((best, piece) => ((PRIORITY_RANK[piece.priority] ?? 1) > (PRIORITY_RANK[best] ?? 1) ? piece.priority : best), first?.priority || "normal");
  const category = pieces.find((piece) => piece.category)?.category ?? null;
  const dues = pieces.map((piece) => piece.responseDueAt).filter((date): date is Date => Boolean(date));
  const responseDueAt = dues.sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  const scheduled = pieces.map((piece) => piece.scheduledAt).filter((date): date is Date => Boolean(date));
  const scheduledAt = status === "scheduled" ? scheduled.sort((left, right) => right.getTime() - left.getTime())[0] ?? null : null;
  const mailboxName = String(first?.payload.mailboxName ?? "");
  const fields = fieldsOf(first?.payload);
  const letters = pieces.map(letterFrom);
  const messageIds = pieces.map((piece) => piece.messageId).sort();
  const idempotencyKey = `notify:digest:${scope.mailboxId}:${scope.ruleId}:${messageIds.join(":")}`;
  const text = formatBitrixDigest({ mailboxName, priority, category, fields, letters });
  return {
    messageId: first?.messageId || "",
    status,
    priority,
    category,
    responseDueAt,
    overdue: pieces.some((piece) => piece.overdue),
    dueRisk: pieces.some((piece) => piece.dueRisk),
    scheduledAt,
    idempotencyKey,
    payload: {
      idempotencyKey,
      mailboxId: scope.mailboxId,
      mailboxName,
      ruleId: scope.ruleId,
      grouped: true,
      subject: `Писем: ${letters.length}`,
      text,
      priority,
      category,
      recipients: first?.payload.recipients ?? [],
      responseDueAt: responseDueAt?.toISOString() ?? null,
      noticeFields: fields,
      messages: letters.map((letter, index) => ({
        messageId: pieces[index]?.messageId,
        subject: letter.subject,
        from: letter.from,
        responseDueLabel: letter.responseDueLabel,
        attachments: letter.attachments ?? [],
      })),
    },
  };
}

export async function flushDigestParts(filter: { mailboxId: string; pollToken?: string }) {
  const rows = await prisma.notification.findMany({
    where: { mailboxId: filter.mailboxId, status: DIGEST_PART },
    orderBy: { createdAt: "asc" },
  });
  const matched = rows.filter((row) => !filter.pollToken || tokenOf(row.payload) === filter.pollToken);
  const groups = new Map<string, typeof matched>();
  for (const row of matched) {
    const key = row.ruleId ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const mailbox = await prisma.mailbox.findUnique({ where: { id: filter.mailboxId }, select: { timezone: true } });
  for (const [ruleId, group] of groups) {
    const released = await releaseGroup(filter.mailboxId, ruleId, group);
    if (released && mailbox) await bumpMetrics(filter.mailboxId, mailbox.timezone, metricFor(released));
  }
}

export async function flushIdleDigests() {
  const rows = await prisma.notification.findMany({ where: { status: DIGEST_PART }, select: { mailboxId: true }, distinct: ["mailboxId"] });
  for (const row of rows) {
    if (await isLockHeld(`poll:${row.mailboxId}`)) continue;
    await flushDigestParts({ mailboxId: row.mailboxId });
  }
}

function groupStatus(statuses: string[]): string {
  if (statuses.length === 0) return "pending";
  if (statuses.every((status) => status === statuses[0])) return statuses[0];
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("scheduled")) return "scheduled";
  if (statuses.includes("dry_run")) return "dry_run";
  if (statuses.includes("throttled")) return "throttled";
  return statuses[0];
}

function fieldsOf(payload: Record<string, unknown> | undefined): string[] {
  if (!payload || !("noticeFields" in payload)) return [...DEFAULT_NOTICE_FIELDS];
  return sanitizeNoticeFields(payload.noticeFields);
}

function letterFrom(piece: DigestPiece): DigestLetter {
  const stored = piece.payload.letter;
  const letter: NoticeLetter =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as NoticeLetter)
      : {
          subject: String(piece.payload.subject ?? ""),
          from: String(piece.payload.from ?? ""),
          attachments: Array.isArray(piece.payload.attachments) ? piece.payload.attachments.map(String).filter(Boolean) : [],
        };
  return { ...letter, responseDueLabel: formatDueLabel(piece.responseDueAt) };
}

function tokenOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  return String((payload as { pollToken?: unknown }).pollToken ?? "");
}

function releaseStatusOf(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const status = String((payload as { releaseStatus?: unknown }).releaseStatus ?? "");
  if (!status || status === DIGEST_PART) return fallback;
  return status;
}

function metricFor(status: string) {
  return {
    notified: status === "pending" || status === "scheduled" ? 1 : 0,
    dryRun: status === "dry_run" ? 1 : 0,
    throttledNotifications: status === "throttled" ? 1 : 0,
    deferredNotifications: status === "scheduled" ? 1 : 0,
  };
}

async function releaseGroup(
  mailboxId: string,
  ruleId: string,
  rows: Array<{
    id: string;
    messageId: string;
    priority: string;
    category: string | null;
    responseDueAt: Date | null;
    overdue: boolean;
    dueRisk: boolean;
    scheduledAt: Date | null;
    payload: Prisma.JsonValue;
    maxAttempts: number;
  }>,
): Promise<string | null> {
  if (rows.length === 0) return null;
  try {
    return await prisma.$transaction(async (tx) => {
    const still = await tx.notification.findMany({ where: { id: { in: rows.map((row) => row.id) }, status: DIGEST_PART } });
    if (still.length === 0) return null;
    if (still.length === 1) {
      const row = still[0];
      const status = releaseStatusOf(row.payload, "pending");
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? { ...row.payload } : {};
      delete payload.pollToken;
      delete payload.releaseStatus;
      const updated = await tx.notification.updateMany({
        where: { id: row.id, status: DIGEST_PART },
        data: { status, payload: payload as Prisma.InputJsonValue },
      });
      return updated.count === 1 ? status : null;
    }
    const pieces = still.map(pieceFrom);
    const combined = combineDigest(pieces, { mailboxId, ruleId: ruleId === "none" ? "" : ruleId });
    const existing = await tx.notification.findUnique({ where: { idempotencyKey: combined.idempotencyKey }, select: { id: true } });
    if (!existing) {
      await tx.notification.create({
        data: {
          mailboxId,
          messageId: combined.messageId,
          ruleId: ruleId === "none" ? null : ruleId,
          idempotencyKey: combined.idempotencyKey,
          status: combined.status,
          priority: combined.priority,
          category: combined.category,
          responseDueAt: combined.responseDueAt,
          overdue: combined.overdue,
          dueRisk: combined.dueRisk,
          payload: combined.payload as Prisma.InputJsonValue,
          scheduledAt: combined.scheduledAt,
          maxAttempts: still[0]?.maxAttempts ?? 5,
        },
      });
    }
    await tx.notification.deleteMany({ where: { id: { in: still.map((row) => row.id) }, status: DIGEST_PART } });
    return combined.status;
  });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") return null;
    throw error;
  }
}

function pieceFrom(row: {
  messageId: string;
  priority: string;
  category: string | null;
  responseDueAt: Date | null;
  overdue: boolean;
  dueRisk: boolean;
  scheduledAt: Date | null;
  payload: Prisma.JsonValue;
}): DigestPiece {
  return {
    messageId: row.messageId,
    status: releaseStatusOf(row.payload, "pending"),
    priority: row.priority,
    category: row.category,
    responseDueAt: row.responseDueAt,
    overdue: row.overdue,
    dueRisk: row.dueRisk,
    scheduledAt: row.scheduledAt,
    payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as Record<string, unknown>) : {},
  };
}
