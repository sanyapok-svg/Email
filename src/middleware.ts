import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/token";

const PUBLIC_PAGES = new Set(["/privacy", "/terms", "/help", "/contacts"]);
const PANEL_PREFIXES = ["/mailboxes", "/settings", "/rules", "/b24-users", "/users", "/accounts", "/metrics", "/notifications", "/messages", "/logout", "/session"];

function isPanelPath(pathname: string) {
  return pathname === "/" || PANEL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/.well-known/workflow")
  ) {
    return NextResponse.next();
  }
  const secret = process.env.AUTH_SECRET || "";
  const token = request.cookies.get("en_session")?.value;
  const session = token && secret ? await verifySession(token, secret) : null;
  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (pathname === "/home") return NextResponse.redirect(new URL("/", request.url));
  if (pathname === "/" && !session) return NextResponse.rewrite(new URL("/home", request.url));
  if (PUBLIC_PAGES.has(pathname) || pathname.startsWith("/auth/")) return NextResponse.next();
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!isPanelPath(pathname)) return NextResponse.next();
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow/).*)"],
};
