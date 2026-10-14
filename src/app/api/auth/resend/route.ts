import { NextResponse } from "next/server";
import { deliverConfirmation, rememberSend, retryAfter } from "@/lib/auth/deliver-confirm";
import { confirmationTarget } from "@/lib/auth/public-signup";

export async function POST(request: Request) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const wait = retryAfter(`resend:${email}`);
  if (wait) return NextResponse.json({ ok: false, error: "Подождите перед повторной отправкой", retryAfter: wait }, { status: 429 });
  const target = await confirmationTarget(email);
  if (target.status === "verified") {
    return NextResponse.json({ ok: false, error: "Почта уже подтверждена. Войдите по логину и паролю." }, { status: 400 });
  }
  if (target.status === "missing") {
    return NextResponse.json({ ok: false, error: "Аккаунт с этой почтой не ждёт подтверждения." }, { status: 400 });
  }
  rememberSend(`resend:${email}`);
  const source = String(body.source || "resend").replace(/[^\w:-]/g, "").slice(0, 40) || "resend";
  const mail = await deliverConfirmation(target.userId, target.email, request.url, source);
  if (!mail.ok) return NextResponse.json({ ok: false, error: mail.error }, { status: 503 });
  return NextResponse.json({ ok: true, delivered: mail.delivered, devUrl: mail.devUrl, error: mail.error });
}
