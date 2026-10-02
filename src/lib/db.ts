import { PrismaClient } from "@prisma/client";

function withPoolerFlags(url: string): string {
  if (!url.includes("-pooler.")) return url;
  const extra = ["pgbouncer=true", "connection_limit=1"].filter((flag) => !url.includes(`${flag.split("=")[0]}=`));
  if (extra.length === 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${extra.join("&")}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = process.env.DATABASE_URL ? withPoolerFlags(process.env.DATABASE_URL) : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
