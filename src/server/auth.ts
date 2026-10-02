"use server";

import { redirect } from "next/navigation";
import { clearSession, createSession, secretsMatch } from "@/lib/auth/session";
import { withNotice } from "@/lib/http/notice";

export async function login(formData: FormData) {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD || "";
  if (!expectedPassword || !secretsMatch(username, expectedUser) || !secretsMatch(password, expectedPassword)) {
    redirect(withNotice("/login", "Неверный логин или пароль"));
  }
  try {
    await createSession(username);
  } catch {
    redirect(withNotice("/login", "Проверьте AUTH_SECRET в окружении"));
  }
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
