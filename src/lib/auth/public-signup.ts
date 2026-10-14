import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

const LOGIN = /^[^\s]{2,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerPublicAccount(input: { login: string; password: string; email: string }) {
  const login = input.login.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  if (!LOGIN.test(login)) return { ok: false as const, error: "Логин — от 2 до 64 символов, без пробелов" };
  if (input.password.length < 5) return { ok: false as const, error: "Пароль — не короче 5 символов" };
  if (!EMAIL.test(email) || email.length > 254) return { ok: false as const, error: "Введите рабочий email" };
  const [sameLogin, sameEmail] = await Promise.all([
    prisma.serviceUser.findUnique({ where: { login }, select: { id: true } }),
    prisma.serviceUser.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (sameLogin) return { ok: false as const, error: "Пользователь с таким логином уже есть" };
  if (sameEmail) return { ok: false as const, error: "Этот email уже указан в другом аккаунте" };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.serviceUser.create({
        data: {
          login,
          name: login.slice(0, 80),
          passwordHash: hashPassword(input.password),
          email,
          active: false,
          isSuperAdmin: false,
        },
      });
      const account = await tx.account.create({ data: { name: login.slice(0, 80), active: false } });
      await tx.accountMember.create({ data: { accountId: account.id, userId: user.id, role: "admin" } });
      await tx.integrationConfig.create({ data: { accountId: account.id } });
      return user;
    });
    return { ok: true as const, userId: created.id, email };
  } catch {
    return { ok: false as const, error: "Не удалось создать аккаунт. Проверьте логин и email." };
  }
}

export async function confirmPublicEmail(userId: string, email: string) {
  const user = await prisma.serviceUser.findUnique({ where: { id: userId } });
  if (!user || user.email !== email.trim().toLowerCase()) return { ok: false as const, code: "invalid" as const };
  if (user.emailVerifiedAt && user.active) return { ok: true as const, already: true };
  await prisma.$transaction(async (tx) => {
    await tx.serviceUser.update({
      where: { id: user.id },
      data: { active: true, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    const memberships = await tx.accountMember.findMany({ where: { userId: user.id }, select: { accountId: true } });
    const ids = memberships.map((item) => item.accountId);
    if (ids.length) await tx.account.updateMany({ where: { id: { in: ids }, active: false }, data: { active: true } });
  });
  return { ok: true as const, already: false };
}

export async function confirmationTarget(email: string) {
  const user = await prisma.serviceUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.email) return { status: "missing" as const };
  if (user.emailVerifiedAt) return { status: "verified" as const };
  return { status: "pending" as const, userId: user.id, email: user.email };
}
