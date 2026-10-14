import { NextResponse } from "next/server";
import { deliverConfirmation, rememberSend, retryAfter } from "@/lib/auth/deliver-confirm";
import { registerPublicAccount } from "@/lib/auth/public-signup";

export async function POST(request: Request) {
  let body: { login?: unknown; password?: unknown; email?: unknown; consent?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ ok: false, error: "Нужно согласие с условиями и политикой" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const wait = retryAfter(`register:${email}`);
  if (wait) return NextResponse.json({ ok: false, error: "Подождите перед повторной отправкой", retryAfter: wait }, { status: 429 });
  const created = await registerPublicAccount({
    login: String(body.login || ""),
    password: String(body.password || ""),
    email,
  });
  if (!created.ok) return NextResponse.json({ ok: false, error: created.error }, { status: 400 });
  rememberSend(`register:${email}`);
  const source = String(body.source || "register").replace(/[^\w:-]/g, "").slice(0, 40) || "register";
  const mail = await deliverConfirmation(created.userId, created.email, request.url, source);
  if (!mail.ok) return NextResponse.json({ ok: false, error: mail.error }, { status: 503 });
  return NextResponse.json({ ok: true, email: created.email, delivered: mail.delivered, devUrl: mail.devUrl, error: mail.error });
}
