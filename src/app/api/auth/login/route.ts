import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/credentials";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { signSession } from "@/lib/auth/token";

export async function POST(request: Request) {
  let body: { login?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }
  const result = await authenticate(String(body.login || ""), String(body.password || ""));
  if (!result.ok) {
    const status = result.code === "invalid" ? 401 : 403;
    return NextResponse.json({ ok: false, code: result.code, email: result.email }, { status });
  }
  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 32) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  const session = await signSession(result.login, secret, 60 * 60 * 12, result.userId, result.accountId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
