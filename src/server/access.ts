"use server";

import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth/password";
import { clearSession, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withNotice } from "@/lib/http/notice";

export async function saveServiceUser(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") || "");
  const login = String(formData.get("login") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const active = formData.get("active") === "on";
  if (!/^[^\s]{2,64}$/.test(login)) redirect(notice("Логин — от 2 до 64 символов, без пробелов"));
  if (!name || name.length > 120) redirect(notice("Укажите имя"));
  if (!id && password.length < 5) redirect(notice("Пароль — не короче 5 символов"));
  if (id && password && password.length < 5) redirect(notice("Пароль — не короче 5 символов"));
  const sameLogin = await prisma.serviceUser.findFirst({ where: { login, ...(id ? { NOT: { id } } : {}) } });
  if (sameLogin) redirect(notice("Пользователь с таким логином уже есть"));
  if (id && !active) {
    const others = await prisma.serviceUser.count({ where: { active: true, NOT: { id } } });
    if (others === 0) redirect(notice("Нужен хотя бы один пользователь, который может войти"));
  }
  if (id) {
    await prisma.serviceUser.update({
      where: { id },
      data: { login, name, active, ...(password ? { passwordHash: hashPassword(password) } : {}) },
    });
  } else {
    await prisma.serviceUser.create({ data: { login, name, active, passwordHash: hashPassword(password) } });
  }
  if (id && session.id === id && !active) {
    await clearSession();
    redirect("/login");
  }
  redirect(notice("Пользователь сохранён"));
}

export async function deleteServiceUser(formData: FormData) {
  const session = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) redirect(notice("Пользователь не найден"));
  const activeOthers = await prisma.serviceUser.count({ where: { active: true, NOT: { id } } });
  if (activeOthers === 0) redirect(notice("Нельзя удалить последнего пользователя с доступом"));
  await prisma.serviceUser.delete({ where: { id } });
  if (session.id === id) {
    await clearSession();
    redirect("/login");
  }
  redirect(notice("Пользователь удалён"));
}

function notice(text: string): string {
  return withNotice("/users", text);
}
