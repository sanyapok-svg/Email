import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import { mailTlsOptions } from "@/lib/tls/mail";

export type MailboxMail = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromAddress: string;
  to: string;
  subject: string;
  text: string;
};

export function compileMailboxMail(input: Pick<MailboxMail, "fromName" | "fromAddress" | "to" | "subject" | "text">): Buffer {
  const domain = input.fromAddress.split("@")[1] || "localhost";
  const messageId = `<fwd.${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;
  const headers = [
    `From: ${formatAddress(input.fromName, input.fromAddress)}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  const body = Buffer.from(input.text, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "utf8");
}

export async function sendMailboxMail(input: MailboxMail): Promise<Buffer> {
  const raw = compileMailboxMail(input);
  const target = await ipv4Host(input.host);
  const attempts = smtpAttempts(input.port, input.secure);
  let lastError: unknown;
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      await deliver(input, raw, target, attempt);
      return raw;
    } catch (error) {
      lastError = error;
      if (index === attempts.length - 1 || !canTryNextPort(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Почта не отправлена");
}

function smtpAttempts(port: number, secure: boolean): Array<{ port: number; secure: boolean }> {
  const primary = port === 465 ? { port: 465, secure: true } : port === 587 ? { port: 587, secure: false } : { port, secure };
  const alternate = primary.port === 465 ? { port: 587, secure: false } : { port: 465, secure: true };
  return [primary, alternate];
}

async function deliver(
  input: MailboxMail,
  raw: Buffer,
  target: { host: string; servername?: string },
  attempt: { port: number; secure: boolean },
): Promise<void> {
  const transport = mailer().createTransport({
    host: target.host,
    port: attempt.port,
    secure: attempt.secure,
    requireTLS: !attempt.secure,
    auth: { user: input.user, pass: input.password },
    tls: { ...mailTlsOptions(), servername: target.servername },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transport.sendMail({
      envelope: { from: input.fromAddress, to: input.to },
      raw,
    });
  } finally {
    transport.close();
  }
}

async function ipv4Host(host: string): Promise<{ host: string; servername?: string }> {
  if (net.isIP(host)) return { host };
  try {
    const addresses = await dns.resolve4(host);
    const address = addresses.find(Boolean);
    if (!address) return { host };
    return { host: address, servername: host };
  } catch {
    return { host };
  }
}

function canTryNextPort(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error instanceof Error ? error.message : "";
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ESOCKET|EHOSTUNREACH|ENETUNREACH|EDNS|EAI_AGAIN|timeout|timed out|Greeting never received|DNS lookup/i.test(`${code} ${message}`);
}

function mailer(): typeof nodemailer {
  const loaded = nodemailer as typeof nodemailer & { default?: typeof nodemailer };
  if (typeof loaded.createTransport === "function") return loaded;
  if (loaded.default && typeof loaded.default.createTransport === "function") return loaded.default;
  throw new Error("Модуль отправки почты не загрузился");
}

function formatAddress(name: string, address: string): string {
  const trimmed = name.trim();
  if (!trimmed) return address;
  return `${encodeHeader(trimmed)} <${address}>`;
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value) && !/["(),:;<>@\\]/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
