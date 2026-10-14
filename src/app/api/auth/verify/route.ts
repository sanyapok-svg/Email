import { NextResponse } from "next/server";
import { readConfirmLink } from "@/lib/auth/magic-link";
import { confirmPublicEmail } from "@/lib/auth/public-signup";

export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }
  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 32) return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  const link = readConfirmLink(String(body.token || ""), secret);
  if (link.status === "invalid") return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  if (link.status === "expired") return NextResponse.json({ ok: false, code: "expired", email: link.email }, { status: 400 });
  try {
    const confirmed = await confirmPublicEmail(link.userId, link.email);
    if (!confirmed.ok) return NextResponse.json({ ok: false, code: confirmed.code }, { status: 400 });
    return NextResponse.json({ ok: true, already: confirmed.already });
  } catch {
    return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
}
