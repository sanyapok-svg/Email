import type { NormalizedMessage } from "@/lib/mail/model";

const DEFAULT_BLOCKLIST = [
  "mailer-daemon",
  "postmaster",
  "no-reply",
  "noreply",
  "do-not-reply",
  "donotreply",
  "notification",
  "notifications",
  "newsletter",
  "unsubscribe",
];

export function autoReplySuppression(message: NormalizedMessage, blocklist = DEFAULT_BLOCKLIST): string | null {
  const autoSubmitted = (message.headers["auto-submitted"] || "").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return "auto-submitted";
  const precedence = (message.headers.precedence || "").toLowerCase();
  if (["bulk", "list", "junk", "auto_reply"].includes(precedence)) return "precedence";
  if (message.headers["list-unsubscribe"] || message.headers["list-id"]) return "mailing-list";
  const local = message.fromEmail.split("@")[0]?.toLowerCase() || "";
  const replyLocal = (message.replyTo[0] || "").split("@")[0]?.toLowerCase() || local;
  const blocked = blocklist.map((item) => item.toLowerCase());
  if (blocked.some((item) => local === item || local.includes(item) || replyLocal === item || replyLocal.includes(item))) {
    return "blocked-address";
  }
  if (!replyRecipientsSafe(message)) return "missing-recipient";
  return null;
}

function replyRecipientsSafe(message: NormalizedMessage): boolean {
  const recipient = message.replyTo[0] || message.fromEmail;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient);
}
