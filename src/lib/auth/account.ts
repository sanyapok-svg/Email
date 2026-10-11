import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireUser, type PanelUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export type AccountContext = {
  userId: string;
  username: string;
  isSuperAdmin: boolean;
  accountId: string;
  accountName: string;
};

export type VisibleAccount = { id: string; name: string };

const ASTRA_NAME = "АСТРА ЛИЗИНГ";

export const loadPanel = cache(async () => {
  const user = await requireUser();
  const account = user.accountId ? await accessibleAccount(user.id, user.accountId, user.isSuperAdmin) : null;
  const accounts = await listVisibleAccounts(user);
  return { user, account, accounts };
});

export const requireAccount = cache(async (): Promise<AccountContext> => {
  const { user, account } = await loadPanel();
  if (!account) {
    const pathname = (await headers()).get("x-pathname") || "/";
    redirect(`/session/account?next=${encodeURIComponent(pathname)}`);
  }
  return {
    userId: user.id,
    username: user.username,
    isSuperAdmin: user.isSuperAdmin,
    accountId: account.id,
    accountName: account.name,
  };
});

export async function accessibleAccount(userId: string, accountId: string, isSuperAdmin: boolean) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, active: true },
    select: { id: true, name: true },
  });
  if (!account) return null;
  if (isSuperAdmin) return account;
  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId, userId } },
    select: { id: true },
  });
  return member ? account : null;
}

export async function listVisibleAccounts(user: Pick<PanelUser, "id" | "isSuperAdmin">): Promise<VisibleAccount[]> {
  if (user.isSuperAdmin) {
    return prisma.account.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }
  const rows = await prisma.accountMember.findMany({
    where: { userId: user.id, account: { active: true } },
    orderBy: { account: { name: "asc" } },
    select: { account: { select: { id: true, name: true } } },
  });
  return rows.map((row) => row.account);
}

export async function pickAccountId(user: Pick<PanelUser, "id" | "isSuperAdmin">): Promise<string | null> {
  const memberships = await prisma.accountMember.findMany({
    where: { userId: user.id, account: { active: true } },
    select: { accountId: true, account: { select: { name: true } } },
  });
  const astra = memberships.find((item) => item.account.name === ASTRA_NAME);
  if (astra) return astra.accountId;
  if (memberships[0]) return memberships[0].accountId;
  if (!user.isSuperAdmin) return null;
  const any = await prisma.account.findFirst({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true } });
  return any?.id ?? null;
}
