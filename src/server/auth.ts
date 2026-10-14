"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth/credentials";
import { clearSession, createSession } from "@/lib/auth/session";
import { withNotice } from "@/lib/http/notice";

export async function login(formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const result = await authenticate(username, password);
  if (!result.ok) {
    const notice =
      result.code === "unconfirmed"
        ? "Аккаунт ещё не активен. Откройте ссылку из письма, чтобы подтвердить почту."
        : result.code === "disabled"
          ? "Учётная запись отключена"
          : result.code === "no-account"
            ? "Нет доступного аккаунта"
            : "Неверный логин или пароль";
    redirect(withNotice("/login", notice));
  }
  try {
    await createSession(result.login, result.userId, result.accountId);
  } catch {
    redirect(withNotice("/login", "Проверьте AUTH_SECRET в окружении"));
  }
  redirect(result.accountId ? "/" : "/accounts");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
