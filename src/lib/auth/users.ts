import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

export async function ensureBootstrapUser() {
  const existing = await prisma.serviceUser.count();
  if (existing > 0) return;
  const login = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!login || !password) return;
  try {
    await prisma.serviceUser.create({
      data: { login, name: "Администратор", passwordHash: hashPassword(password), active: true, isSuperAdmin: true },
    });
  } catch {
    // A parallel request may have created the first user.
  }
}

export async function listServiceUsers(accountId: string) {
  const members = await prisma.accountMember.findMany({
    where: { accountId },
    orderBy: { user: { login: "asc" } },
    select: { user: { select: { id: true, login: true, name: true, active: true, isSuperAdmin: true } } },
  });
  return members.map((member) => member.user);
}
