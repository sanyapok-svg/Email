import nodemailer from "nodemailer";
import { safeError } from "@/lib/imap/connector";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName?: string | null;
  fromAddress: string;
};

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
};

export function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === "object" && error && "responseCode" in error ? Number((error as { responseCode?: number }).responseCode) : 0;
  return code === 535 || /auth|invalid login|authentication/i.test(message);
}

export async function verifySmtp(config: SmtpConfig): Promise<void> {
  const transporter = createTransport(config);
  try {
    await transporter.verify();
  } catch (error) {
    throw new Error(safeError(error, [config.password]));
  } finally {
    transporter.close();
  }
}

export async function sendSmtp(config: SmtpConfig, mail: OutgoingMail): Promise<void> {
  const transporter = createTransport(config);
  try {
    await transporter.sendMail({
      from: formatFrom(config.fromName, config.fromAddress),
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      inReplyTo: mail.inReplyTo || undefined,
      references: mail.references || undefined,
    });
  } catch (error) {
    const wrapped = new Error(safeError(error, [config.password]));
    if (isAuthError(error)) (wrapped as Error & { auth?: boolean }).auth = true;
    throw wrapped;
  } finally {
    transporter.close();
  }
}

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    requireTLS: !config.secure,
    tls: { minVersion: "TLSv1.2" },
  });
}

function formatFrom(name: string | null | undefined, address: string): string {
  const clean = (name || "").replace(/["\r\n]/g, "").trim();
  return clean ? `"${clean}" <${address}>` : address;
}
