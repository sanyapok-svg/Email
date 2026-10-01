import { createHash, timingSafeEqual } from "crypto";

export function authorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : request.headers.get("x-cron-secret") || "";
  return secretsMatch(token, secret);
}

function secretsMatch(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}
