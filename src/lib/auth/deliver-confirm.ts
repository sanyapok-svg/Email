import { CONFIRM_TTL_MS, signConfirmLink } from "@/lib/auth/magic-link";
import { sendConfirmEmail } from "@/lib/auth/magic-mail";
import { logEvent } from "@/lib/log";

const recent = new Map<string, number>();

export function retryAfter(key: string, windowMs = 30_000, now = Date.now()): number | null {
  const last = recent.get(key) || 0;
  const wait = windowMs - (now - last);
  return wait > 0 ? Math.ceil(wait / 1000) : null;
}

export function rememberSend(key: string, now = Date.now()) {
  recent.set(key, now);
}

export async function deliverConfirmation(userId: string, email: string, origin: string, source: string) {
  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 32) return { ok: false as const, error: "Сервис подтверждения временно недоступен" };
  const token = signConfirmLink(userId, email, secret, Date.now(), CONFIRM_TTL_MS);
  const url = new URL("/auth/verify", origin);
  url.searchParams.set("token", token);
  let delivered = false;
  try {
    delivered = await sendConfirmEmail(email, url.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    logEvent("error", "public.confirm_failed", { source, domain: email.split("@")[1] || "", message: message.slice(0, 160) });
    return {
      ok: true as const,
      delivered: false,
      devUrl: null,
      error: "Аккаунт создан, но письмо не отправилось. Запросите ссылку ещё раз.",
    };
  }
  if (!delivered && process.env.NODE_ENV === "production") {
    return { ok: true as const, delivered: false, devUrl: null, error: "Аккаунт создан, но почтовый сервис для подтверждения ещё не настроен." };
  }
  logEvent("info", "public.confirm", { source, domain: email.split("@")[1] || "", delivered });
  return { ok: true as const, delivered, devUrl: delivered ? null : url.toString(), error: null };
}
