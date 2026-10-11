"use server";

import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/account";
import { hashPassword } from "@/lib/auth/password";
import { clearSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withNotice } from "@/lib/http/notice";

export async function saveServiceUser(formData: FormData) {
  const session = await requireAccount();
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
  if (id) {
    const member = await prisma.accountMember.findUnique({
      where: { accountId_userId: { accountId: session.accountId, userId: id } },
      include: { user: { select: { isSuperAdmin: true } } },
    });
    if (!member) redirect(notice("Пользователь не найден"));
    if (member.user.isSuperAdmin && session.userId !== id) redirect(notice("Суперадмина может изменить только он сам"));
    if (member.user.isSuperAdmin && !active) redirect(notice("Суперадмина нельзя отключить"));
    if (!active) {
      const others = await prisma.accountMember.count({
        where: { accountId: session.accountId, user: { active: true, NOT: { id } } },
      });
      if (others === 0) redirect(notice("Нужен хотя бы один пользователь, который может войти"));
    }
    await prisma.serviceUser.update({
      where: { id },
      data: { login, name, active, ...(password ? { passwordHash: hashPassword(password) } : {}) },
    });
  } else {
    const created = await prisma.serviceUser.create({ data: { login, name, active, passwordHash: hashPassword(password) } });
    await prisma.accountMember.create({ data: { accountId: session.accountId, userId: created.id, role: "admin" } });
  }
  if (id && session.userId === id && !active) {
    await clearSession();
    redirect("/login");
  }
  redirect(notice("Пользователь сохранён"));
}

export async function deleteServiceUser(formData: FormData) {
  const session = await requireAccount();
  const id = String(formData.get("id") || "");
  if (!id) redirect(notice("Пользователь не найден"));
  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId: session.accountId, userId: id } },
    include: { user: { select: { isSuperAdmin: true } } },
  });
  if (!member) redirect(notice("Пользователь не найден"));
  if (member.user.isSuperAdmin) redirect(notice("Суперадмина нельзя удалить из аккаунта"));
  const activeOthers = await prisma.accountMember.count({
    where: { accountId: session.accountId, user: { active: true, NOT: { id } } },
  });
  if (activeOthers === 0) redirect(notice("Нельзя удалить последнего пользователя с доступом"));
  await prisma.accountMember.delete({ where: { id: member.id } });
  const left = await prisma.accountMember.count({ where: { userId: id } });
  if (left === 0) await prisma.serviceUser.delete({ where: { id } });
  if (session.userId === id) {
    await clearSession();
    redirect("/login");
  }
  redirect(notice("Пользователь удалён"));
}

function notice(text: string): string {
  return withNotice("/users", text);
}
