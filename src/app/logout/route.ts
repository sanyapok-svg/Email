import { clearSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
