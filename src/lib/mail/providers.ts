export type MailboxProviderId = "yandex" | "mailru" | "gmail" | "outlook" | "rambler" | "custom";

export type MailboxProvider = {
  id: MailboxProviderId;
  label: string;
  hint: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

export const MAILBOX_PROVIDERS: MailboxProvider[] = [
  {
    id: "yandex",
    label: "Яндекс",
    hint: "Пароль ящика или пароль приложения из Яндекс ID. В почте должен быть включён IMAP.",
    imapHost: "imap.yandex.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.yandex.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    id: "mailru",
    label: "Mail.ru",
    hint: "Пароль для внешнего приложения в настройках Mail.ru. IMAP включается в почте.",
    imapHost: "imap.mail.ru",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.ru",
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    id: "gmail",
    label: "Gmail",
    hint: "Пароль приложения Google. В Gmail включите доступ по IMAP.",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    id: "outlook",
    label: "Outlook",
    hint: "Пароль приложения Microsoft. Если организация запретила вход по паролю, такой ящик не подключится.",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  {
    id: "rambler",
    label: "Rambler",
    hint: "Пароль ящика Rambler. IMAP для этого сервера уже включён.",
    imapHost: "imap.rambler.ru",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.rambler.ru",
    smtpPort: 465,
    smtpSecure: true,
  },
  {
    id: "custom",
    label: "Свой сервер",
    hint: "Укажите адрес, порт и шифрование из справки вашей почты.",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
  },
];

const HOSTS: Record<string, MailboxProviderId> = {
  "imap.yandex.com": "yandex",
  "imap.yandex.ru": "yandex",
  "imap.mail.ru": "mailru",
  "imap.gmail.com": "gmail",
  "outlook.office365.com": "outlook",
  "imap-mail.outlook.com": "outlook",
  "imap.rambler.ru": "rambler",
};

export function mailboxProvider(id: string | null | undefined): MailboxProvider {
  return MAILBOX_PROVIDERS.find((item) => item.id === id) ?? MAILBOX_PROVIDERS[MAILBOX_PROVIDERS.length - 1];
}

export function detectMailboxProvider(imapHost: string): MailboxProviderId {
  return HOSTS[imapHost.trim().toLowerCase()] ?? "custom";
}

export type MailboxConnectionInput = {
  provider: string;
  imapHost?: string | null;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpSecure?: boolean;
};

export function resolveMailboxConnection(input: MailboxConnectionInput) {
  const provider = mailboxProvider(input.provider);
  if (provider.id !== "custom") {
    return {
      provider: provider.id,
      imapHost: provider.imapHost,
      imapPort: provider.imapPort,
      imapSecure: provider.imapSecure,
      smtpHost: provider.smtpHost,
      smtpPort: provider.smtpPort,
      smtpSecure: provider.smtpSecure,
    };
  }
  const imapHost = input.imapHost?.trim() || "";
  const smtpHost = input.smtpHost?.trim() || "";
  return {
    provider: "custom" as const,
    imapHost,
    imapPort: clampPort(input.imapPort, 993),
    imapSecure: input.imapSecure !== false,
    smtpHost,
    smtpPort: clampPort(input.smtpPort, 465),
    smtpSecure: input.smtpSecure !== false,
  };
}

function clampPort(value: number | undefined, fallback: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(65535, Math.max(1, Math.round(value)));
}
