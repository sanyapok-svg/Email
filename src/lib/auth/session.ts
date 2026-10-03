import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, verifySession } from "@/lib/auth/token";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "en_session";

export function secretsMatch(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function createSession(username: string, userId?: string) {
  const token = await signSession(username, requiredAuthSecret(), 60 * 60 * 12, userId);
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

export async function requireUser() {
  const session = await currentUser();
  if (!session) redirect("/login");
  const user = session.id
    ? await prisma.serviceUser.findUnique({ where: { id: session.id } })
    : await prisma.serviceUser.findUnique({ where: { login: session.username.toLowerCase() } });
  if ((session.id && !user) || (user && !user.active)) redirect("/logout");
  if (user) return { username: user.login, id: user.id };
  return session;
}

function requiredAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET должен быть не короче 32 символов");
  return secret;
}
