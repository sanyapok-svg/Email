import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { signSession, verifySession } from "@/lib/auth/token";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "en_session";

export function secretsMatch(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function createSession(username: string, userId?: string, accountId?: string) {
  const token = await signSession(username, requiredAuthSecret(), 60 * 60 * 12, userId, accountId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function currentUser() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, secret);
}

export type PanelUser = {
  username: string;
  id: string;
  isSuperAdmin: boolean;
  accountId?: string;
};

export const requireUser = cache(async (): Promise<PanelUser> => {
  const session = await currentUser();
  if (!session) redirect("/login");
  const user = session.id
    ? await prisma.serviceUser.findUnique({ where: { id: session.id } })
    : await prisma.serviceUser.findUnique({ where: { login: session.username.toLowerCase() } });
  if (!user || !user.active) redirect("/logout");
  return { username: user.login, id: user.id, isSuperAdmin: user.isSuperAdmin, accountId: session.accountId };
});

function requiredAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET должен быть не короче 32 символов");
  return secret;
}
