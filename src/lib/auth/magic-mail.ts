import nodemailer from "nodemailer";

export async function sendConfirmEmail(to: string, url: string): Promise<boolean> {
  const host = process.env.MAGIC_SMTP_HOST?.trim();
  const from = process.env.MAGIC_SMTP_FROM?.trim();
  if (!host || !from) return false;
  const port = Number(process.env.MAGIC_SMTP_PORT || 587);
  const user = process.env.MAGIC_SMTP_USER?.trim() || "";
  const pass = process.env.MAGIC_SMTP_PASSWORD || "";
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
  await transporter.sendMail({
    from,
    to,
    subject: "Подтвердите почту в Почтаходе",
    text: [
      "Аккаунт создан, но ещё не активен.",
      "Откройте ссылку, чтобы подтвердить почту. Она действует 24 часа.",
      "",
      url,
      "",
      "После подтверждения входите логином и паролем, которые задали при регистрации.",
      "Если вы не создавали аккаунт, просто проигнорируйте это письмо.",
    ].join("\n"),
  });
  return true;
}
