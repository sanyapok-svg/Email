"use server";

import { redirect } from "next/navigation";
import { pickAccountId } from "@/lib/auth/account";
import { verifyPassword } from "@/lib/auth/password";
import { clearSession, createSession } from "@/lib/auth/session";
import { ensureBootstrapUser } from "@/lib/auth/users";
import { prisma } from "@/lib/db";
import { withNotice } from "@/lib/http/notice";

export async function login(formData: FormData) {
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  await ensureBootstrapUser();
  const user = await prisma.serviceUser.findUnique({ where: { login: username } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    redirect(withNotice("/login", "Неверный логин или пароль"));
  }
  const accountId = await pickAccountId(user);
  if (!accountId && !user.isSuperAdmin) redirect(withNotice("/login", "Нет доступного аккаунта"));
  try {
    await createSession(user.login, user.id, accountId ?? undefined);
  } catch {
    redirect(withNotice("/login", "Проверьте AUTH_SECRET в окружении"));
  }
  redirect(accountId ? "/" : "/accounts");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
