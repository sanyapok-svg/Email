import { ImapFlow } from "imapflow";
import type { ImapConfig } from "@/lib/imap/connector";
import { mailTlsOptions } from "@/lib/tls/mail";

type ListedBox = {
  path: string;
  specialUse?: string | false;
  name?: string;
};

export function sentMailboxPath(boxes: ListedBox[]): string | null {
  const flagged = boxes.find((box) => box.specialUse === "\\Sent");
  if (flagged) return flagged.path;
  return boxes.find((box) => isSentName(box.name || box.path))?.path ?? null;
}

export async function saveSentCopy(config: ImapConfig, raw: Buffer): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: mailTlsOptions(),
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    await client.connect();
    const boxes = await client.list();
    const path = sentMailboxPath(boxes);
    if (!path) throw new Error("На сервере нет папки «Отправленные»");
    const stored = await client.append(path, raw, ["\\Seen"]);
    if (!stored) throw new Error("Сервер не принял копию в «Отправленные»");
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

function isSentName(value: string): boolean {
  const name = value.split("/").pop() || value;
  return /^(sent|отправленные)$/i.test(name.trim());
}
