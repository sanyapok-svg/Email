import { ImapFlow } from "imapflow";
import { classifyStructure, type StructureNode } from "@/lib/mail/structure";
import type { PipelineInput } from "@/lib/mail/pipeline";
import { logEvent } from "@/lib/log";
import { mailTlsOptions } from "@/lib/tls/mail";

const HEADER_FIELDS = [
  "subject",
  "from",
  "to",
  "cc",
  "reply-to",
  "date",
  "message-id",
  "in-reply-to",
  "references",
  "auto-submitted",
  "precedence",
  "list-unsubscribe",
  "list-id",
  "x-mailer",
  "x-spam-flag",
  "x-spam-score",
];

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

export type InboxStatus = {
  uidValidity: bigint;
  uidNext: bigint;
  readOnly: boolean;
};

export class ImapConnector {
  private client: ImapFlow | null = null;
  private lock: { release: () => void } | null = null;

  constructor(private readonly config: ImapConfig) {}

  async connect(): Promise<void> {
    this.client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.password },
      logger: false,
      tls: mailTlsOptions(),
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
    await this.client.connect();
  }

  async examineInbox(): Promise<InboxStatus> {
    const client = this.required();
    this.lock = await client.getMailboxLock("INBOX", { readOnly: true });
    const mailbox = client.mailbox;
    if (!mailbox) throw new Error("Папка Входящие недоступна");
    if (!mailbox.readOnly) throw new Error("Сервер открыл Входящие не в режиме только чтения");
    return {
      uidValidity: mailbox.uidValidity,
      uidNext: BigInt(mailbox.uidNext),
      readOnly: true,
    };
  }

  async searchUidsAfter(lastUid: bigint, limit: number): Promise<bigint[]> {
    const client = this.required();
    const start = lastUid + 1n;
    const found = await client.search({ uid: `${start.toString()}:*` }, { uid: true });
    if (!found) return [];
    return found
      .map((uid) => BigInt(uid))
      .filter((uid) => uid > lastUid)
      .sort((a, b) => (a < b ? -1 : 1))
      .slice(0, limit);
  }

  async fetchMessage(
    uid: bigint,
    bodyCharLimit: number,
  ): Promise<PipelineInput & { uid: bigint; internalDate: Date | null; truncatedBySize: boolean }> {
    const client = this.required();
    const meta = await client.fetchOne(
      uid.toString(),
      { uid: true, size: true, internalDate: true, bodyStructure: true, headers: HEADER_FIELDS },
      { uid: true },
    );
    if (!meta) throw new Error(`Письмо UID ${uid.toString()} не найдено`);
    const classified = classifyStructure(meta.bodyStructure as StructureNode | undefined);
    const byteLimit = Math.min(Math.max(bodyCharLimit * 2, 20_000), 400_000);
    const partQuery = classified.textParts.map((part) => ({
      key: part.part,
      maxLength: byteLimit,
    }));
    const bodies = partQuery.length
      ? await client.fetchOne(uid.toString(), { uid: true, bodyParts: partQuery }, { uid: true })
      : null;
    const bodyResult = bodies && typeof bodies === "object" ? bodies : null;
    const binary = bodyResult?.binaryParts ?? new Set<string>();
    const partMap = bodyResult?.bodyParts;
    const parts = classified.textParts.map((part) => ({
      mimeType: part.mimeType,
      charset: part.charset,
      encoding: binary.has(part.part) ? "8bit" : part.encoding,
      content: partMap?.get(part.part) ?? Buffer.alloc(0),
    }));
    const truncatedBySize = classified.textParts.some((part) => (part.size || 0) > byteLimit);
    return {
      uid,
      headerBuffer: meta.headers ?? Buffer.alloc(0),
      parts,
      attachments: classified.attachments,
      encrypted: classified.encrypted,
      sizeBytes: meta.size || 0,
      receivedAt: toDate(meta.internalDate) ?? new Date(),
      timezone: "UTC",
      bodyCharLimit,
      entityLimit: 40,
      internalDate: toDate(meta.internalDate),
      truncatedBySize,
    };
  }

  async close(): Promise<void> {
    this.lock?.release();
    this.lock = null;
    if (this.client) {
      try {
        await this.client.logout();
      } catch (error) {
        logEvent("warn", "imap.logout_failed", { message: safeError(error, [this.config.password]) });
      }
      this.client = null;
    }
  }

  private required(): ImapFlow {
    if (!this.client) throw new Error("IMAP не подключён");
    return this.client;
  }
}

export async function testImapConnection(config: ImapConfig): Promise<InboxStatus> {
  const connector = new ImapConnector(config);
  try {
    await connector.connect();
    return await connector.examineInbox();
  } finally {
    await connector.close();
  }
}

export function safeError(error: unknown, secrets: string[]): string {
  let message = [error instanceof Error ? error.message : "Неизвестная ошибка", imapServerText(error)].filter(Boolean).join(": ");
  if (/AUTHENTICATIONFAILED|invalid credentials|IMAP is disabled/i.test(message)) {
    message = "Яндекс отклонил вход: неверный пароль или IMAP выключен. Нужен пароль приложения, не пароль от аккаунта.";
  }
  for (const secret of secrets) {
    if (secret && secret.length > 2) message = message.split(secret).join("[redacted]");
  }
  return message.slice(0, 500);
}

function imapServerText(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const record = error as { response?: unknown; responseText?: unknown };
  if (typeof record.responseText === "string" && record.responseText.trim()) return record.responseText.trim();
  if (typeof record.response === "string") return record.response.replace(/^\S+\s+(NO|BAD)\s+/i, "").trim();
  return "";
}

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
