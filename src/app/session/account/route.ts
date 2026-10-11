import { NextRequest, NextResponse } from "next/server";
import { pickAccountId } from "@/lib/auth/account";
import { SESSION_COOKIE, currentUser } from "@/lib/auth/session";
import { signSession } from "@/lib/auth/token";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await currentUser();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const user = session.id
    ? await prisma.serviceUser.findUnique({ where: { id: session.id } })
    : await prisma.serviceUser.findUnique({ where: { login: session.username.toLowerCase() } });
  if (!user || !user.active) return NextResponse.redirect(new URL("/logout", request.url));
  const accountId = await pickAccountId({ id: user.id, isSuperAdmin: user.isSuperAdmin });
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (!accountId) {
    if (user.isSuperAdmin) return NextResponse.redirect(new URL("/accounts", request.url));
    return NextResponse.redirect(new URL("/login?notice=" + encodeURIComponent("Нет доступного аккаунта"), request.url));
  }
  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 32) return NextResponse.redirect(new URL("/login?notice=" + encodeURIComponent("Проверьте AUTH_SECRET в окружении"), request.url));
  const token = await signSession(user.login, secret, 60 * 60 * 12, user.id, accountId);
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
