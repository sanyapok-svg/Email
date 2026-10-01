import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

export async function withLock(name: string, ttlMs: number, fn: () => Promise<void>): Promise<boolean> {
  const owner = randomUUID();
  const now = new Date();
  await prisma.schedulerLock.deleteMany({ where: { id: name, lockedUntil: { lt: now } } });
  try {
    await prisma.schedulerLock.create({
      data: { id: name, owner, lockedUntil: new Date(now.getTime() + ttlMs) },
    });
  } catch {
    return false;
  }
  try {
    await fn();
    return true;
  } finally {
    await prisma.schedulerLock.deleteMany({ where: { id: name, owner } });
  }
}
