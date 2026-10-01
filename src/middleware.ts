import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/cron") || pathname.startsWith("/api/health")) return NextResponse.next();
  const secret = process.env.AUTH_SECRET || "";
  const token = request.cookies.get("en_session")?.value;
  const session = token && secret ? await verifySession(token, secret) : null;
  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
