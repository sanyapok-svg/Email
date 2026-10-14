import { pickAccountId } from "@/lib/auth/account";
import { verifyPassword } from "@/lib/auth/password";
import { ensureBootstrapUser } from "@/lib/auth/users";
import { prisma } from "@/lib/db";

export type AuthResult =
  | { ok: true; login: string; userId: string; accountId?: string }
  | { ok: false; code: "invalid" | "unconfirmed" | "disabled" | "no-account"; email?: string };

export async function authenticate(username: string, password: string): Promise<AuthResult> {
  await ensureBootstrapUser();
  const login = username.trim().toLowerCase();
  if (!login || !password) return { ok: false, code: "invalid" };
  const user = await prisma.serviceUser.findUnique({ where: { login } });
  if (!user || !verifyPassword(password, user.passwordHash)) return { ok: false, code: "invalid" };
  if (user.email && !user.emailVerifiedAt) return { ok: false, code: "unconfirmed", email: user.email };
  if (!user.active) return { ok: false, code: "disabled" };
  const accountId = await pickAccountId({ id: user.id, isSuperAdmin: user.isSuperAdmin });
  if (!accountId && !user.isSuperAdmin) return { ok: false, code: "no-account" };
  return { ok: true, login: user.login, userId: user.id, accountId: accountId ?? undefined };
}
