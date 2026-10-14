import { createHmac, timingSafeEqual } from "crypto";

type Payload = { sub: string; email: string; exp: number };

export const CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;

export function signConfirmLink(userId: string, email: string, secret: string, now = Date.now(), ttlMs = CONFIRM_TTL_MS): string {
  const payload: Payload = { sub: userId, email: email.trim().toLowerCase(), exp: now + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readConfirmLink(
  token: string,
  secret: string,
  now = Date.now(),
): { status: "invalid" } | { status: "expired" | "ok"; userId: string; email: string } {
  const [body, sig] = token.split(".");
  if (!body || !sig || token.split(".").length !== 2) return { status: "invalid" };
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return { status: "invalid" };
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<Payload>;
    if (!data.sub || !data.email || typeof data.exp !== "number") return { status: "invalid" };
    if (data.exp < now) return { status: "expired", userId: data.sub, email: data.email };
    return { status: "ok", userId: data.sub, email: data.email };
  } catch {
    return { status: "invalid" };
  }
}
