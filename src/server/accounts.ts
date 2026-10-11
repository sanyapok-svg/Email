"use server";

import { redirect } from "next/navigation";
import { accessibleAccount } from "@/lib/auth/account";
import { createSession, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { withNotice } from "@/lib/http/notice";

export async function enterAccount(formData: FormData) {
  const user = await requireUser();
  const accountId = String(formData.get("accountId") || "");
  const account = await accessibleAccount(user.id, accountId, user.isSuperAdmin);
  if (!account) redirect("/");
  await createSession(user.username, user.id, account.id);
  const next = safeNext(String(formData.get("next") || ""));
  redirect(next);
}

export async function createAccount(formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2 || name.length > 80) redirect(withNotice("/accounts", "Название — от 2 до 80 символов"));
  const same = await prisma.account.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (same) redirect(withNotice("/accounts", "Аккаунт с таким названием уже есть"));
  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({ data: { name, active: true } });
    await tx.integrationConfig.create({ data: { accountId: created.id } });
    return created;
  });
  await createSession(user.username, user.id, account.id);
  redirect(withNotice("/accounts", `Аккаунт «${account.name}» создан. Сейчас вы в нём: добавьте ящики, пользователей и веб-хук.`));
}

function safeNext(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
