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

export function smtpEndpointPlan(host: string, v4: string, v6: string): SmtpEndpoint[] {
  const ports = [
    { port: 465, secure: true },
    { port: 587, secure: false },
  ];
  const endpoints: SmtpEndpoint[] = [];
  for (const item of ports) {
    if (v4) endpoints.push({ host: v4, servername: host, port: item.port, secure: item.secure, label: `${item.port}/v4` });
    if (v6) endpoints.push({ host: v6, servername: host, port: item.port, secure: item.secure, label: `${item.port}/v6` });
  }
  if (!endpoints.length) {
    for (const item of ports) endpoints.push({ host, servername: host, port: item.port, secure: item.secure, label: String(item.port) });
  }
  return endpoints;
}

export async function sendMailboxMail(input: MailboxMail): Promise<Buffer> {
  const raw = compileMailboxMail(input);
  const endpoints = smtpEndpointPlan(input.host, ...(await resolveMailHosts(input.host)));
  const errors: string[] = [];
  for (const endpoint of endpoints) {
    try {
      await deliver(input, raw, endpoint);
      return raw;
    } catch (error) {
      const message = error instanceof Error ? error.message : "ошибка соединения";
      errors.push(`${endpoint.label}: ${message}`);
      if (!canTryNextPort(error)) break;
    }
  }
  throw new Error(`Нет соединения с почтовым сервером. ${errors.join("; ")}`.slice(0, 500));
}

async function resolveMailHosts(host: string): Promise<[string, string]> {
  if (net.isIP(host)) return net.isIPv6(host) ? ["", host] : [host, ""];
  const [v4, v6] = await Promise.all([
    dns.resolve4(host).then((addresses) => addresses[0] || "").catch(() => ""),
    dns.resolve6(host).then((addresses) => addresses[0] || "").catch(() => ""),
  ]);
  return [v4, v6];
}

type SmtpEndpoint = {
  host: string;
  servername: string;
  port: number;
  secure: boolean;
  label: string;
};

async function deliver(input: MailboxMail, raw: Buffer, endpoint: SmtpEndpoint): Promise<void> {
  const transport = mailer().createTransport({
    host: endpoint.host,
    port: endpoint.port,
    secure: endpoint.secure,
    requireTLS: !endpoint.secure,
    auth: { user: input.user, pass: input.password },
    tls: { ...mailTlsOptions(), servername: endpoint.servername },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
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
