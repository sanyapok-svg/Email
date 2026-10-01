import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, verifySession } from "@/lib/auth/token";

export const SESSION_COOKIE = "en_session";

export function secretsMatch(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function createSession(username: string) {
  const token = await signSession(username, requiredAuthSecret());
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
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

function requiredAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET должен быть не короче 32 символов");
  return secret;
}
