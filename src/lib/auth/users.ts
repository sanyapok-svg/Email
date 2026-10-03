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
      data: { login, name: "Администратор", passwordHash: hashPassword(password), active: true },
    });
  } catch {
    // A parallel request may have created the first user.
  }
}

export async function listServiceUsers() {
  return prisma.serviceUser.findMany({
    orderBy: { login: "asc" },
    select: { id: true, login: true, name: true, active: true },
  });
}
