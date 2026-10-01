import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MessageSearchInput = {
  q?: string;
  mailboxId?: string;
  from?: string;
  domain?: string;
  decision?: string;
  phone?: string;
  email?: string;
  contract?: string;
  invoice?: string;
  language?: string;
  sentiment?: string;
  urgency?: string;
  ruleId?: string;
  fromDate?: string;
  toDate?: string;
};

export async function searchMessages(input: MessageSearchInput) {
  const where = buildWhere(input);
  if (input.q?.trim()) {
    const ids = await fullTextIds(input.q.trim());
    where.id = { in: ids.length ? ids : ["__none__"] };
  }
  return prisma.processedMessage.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: 50,
    include: { mailbox: { select: { name: true } }, matchedRule: { select: { name: true } } },
  });
}

function buildWhere(input: MessageSearchInput): Prisma.ProcessedMessageWhereInput {
  const where: Prisma.ProcessedMessageWhereInput = {};
  if (input.mailboxId) where.mailboxId = input.mailboxId;
  if (input.from) where.fromEmail = { contains: input.from, mode: "insensitive" };
  if (input.domain) where.fromDomain = { contains: input.domain, mode: "insensitive" };
  if (input.decision) where.decision = input.decision;
  if (input.phone) where.phonesNormalized = { has: normalizeLoose(input.phone) };
  if (input.email) where.emails = { has: input.email.toLowerCase() };
  if (input.contract) where.contractNumbers = { has: input.contract };
  if (input.invoice) where.invoiceNumbers = { has: input.invoice };
  if (input.language) where.language = input.language;
  if (input.sentiment) where.sentiment = input.sentiment;
  if (input.urgency) where.urgencyLevel = input.urgency;
  if (input.ruleId) where.matchedRuleId = input.ruleId;
  if (input.fromDate || input.toDate) {
    where.receivedAt = {};
    if (input.fromDate) where.receivedAt.gte = new Date(input.fromDate);
    if (input.toDate) where.receivedAt.lte = new Date(input.toDate);
  }
  return where;
}

async function fullTextIds(query: string): Promise<string[]> {
  const like = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM processed_messages
      WHERE to_tsvector('russian', coalesce(search_document, '')) @@ plainto_tsquery('russian', ${query})
         OR to_tsvector('english', coalesce(search_document, '')) @@ plainto_tsquery('english', ${query})
         OR search_document ILIKE ${like} ESCAPE '\\'
         OR subject ILIKE ${like} ESCAPE '\\'
         OR from_email ILIKE ${like} ESCAPE '\\'
      ORDER BY received_at DESC
      LIMIT 50
    `;
    return rows.map((row) => row.id);
  } catch {
    const rows = await prisma.processedMessage.findMany({
      where: {
        OR: [
          { searchDocument: { contains: query, mode: "insensitive" } },
          { subject: { contains: query, mode: "insensitive" } },
          { fromEmail: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 50,
    });
    return rows.map((row) => row.id);
  }
}

function normalizeLoose(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return phone.trim();
}
