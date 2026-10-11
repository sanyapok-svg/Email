import nodemailer from "nodemailer";
import { mailTlsOptions } from "@/lib/tls/mail";

export async function sendMailboxMail(input: {
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
}): Promise<void> {
  const transport = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.user, pass: input.password },
    tls: mailTlsOptions(),
    connectionTimeout: 15_000,
    socketTimeout: 20_000,
  });
  try {
    await transport.sendMail({
      from: { name: input.fromName, address: input.fromAddress },
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } finally {
    transport.close();
  }
}
