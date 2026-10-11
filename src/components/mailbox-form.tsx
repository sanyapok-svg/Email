"use client";

import type { Mailbox } from "@prisma/client";
import { useState } from "react";
import { MAILBOX_PROVIDERS, mailboxProvider, type MailboxProviderId } from "@/lib/mail/providers";
import { saveMailbox } from "@/server/mailboxes";

export function MailboxForm({ mailbox }: { mailbox?: Mailbox }) {
  const [provider, setProvider] = useState<MailboxProviderId>(knownProvider(mailbox?.provider));
  const preset = mailboxProvider(provider);
  return (
    <form action={saveMailbox} className="grid gap-4" id="mailbox-form">
      {mailbox ? <input type="hidden" name="id" value={mailbox.id} /> : null}
      <input type="hidden" name="provider" value={provider} />
      <fieldset className="grid gap-2">
        <legend className="text-sm">Почтовый сервер</legend>
        <div className="provider-grid" role="radiogroup" aria-label="Почтовый сервер">
          {MAILBOX_PROVIDERS.map((item) => {
            const selected = provider === item.id;
            return (
              <button key={item.id} type="button" className="provider" aria-pressed={selected} onClick={() => setProvider(item.id)}>
                <ProviderMark id={item.id} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">{preset.hint}</p>
      </fieldset>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="name" label="Имя" defaultValue={mailbox?.name} required />
        <Field name="address" label="Адрес ящика" defaultValue={mailbox?.address} required />
        <Field name="displayAddress" label="Адрес для отображения" defaultValue={mailbox?.displayAddress || ""} />
        <Field name="timezone" label="Часовой пояс" defaultValue={mailbox?.timezone || "Europe/Moscow"} />
        {provider === "custom" ? (
          <>
            <Field name="imapHost" label="IMAP-сервер" defaultValue={mailbox?.provider === "custom" ? mailbox.imapHost : ""} required placeholder="imap.example.com" />
            <Field name="imapPort" label="IMAP-порт" defaultValue={String(mailbox?.provider === "custom" ? mailbox.imapPort : 993)} />
            <Field name="smtpHost" label="SMTP-сервер" defaultValue={mailbox?.provider === "custom" ? mailbox.smtpHost : ""} placeholder="smtp.example.com" />
            <Field name="smtpPort" label="SMTP-порт" defaultValue={String(mailbox?.provider === "custom" ? mailbox.smtpPort : 465)} />
          </>
        ) : (
          <p className="text-sm text-muted md:col-span-2">
            IMAP {preset.imapHost}:{preset.imapPort}, SMTP {preset.smtpHost}:{preset.smtpPort}. Порты и шифрование уже заданы.
          </p>
        )}
        <Field name="imapUser" label="Логин" defaultValue={mailbox?.imapUser} required />
        <Field name="imapPassword" label={mailbox ? "Новый пароль" : "Пароль"} type="password" placeholder={mailbox ? "оставьте пустым, чтобы не менять" : ""} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Check name="active" label="Ящик и все правила активны" defaultChecked={mailbox?.active} />
        {provider === "custom" ? (
          <>
            <Check name="imapSecure" label="IMAP SSL" defaultChecked={mailbox?.provider === "custom" ? mailbox.imapSecure : true} />
            <Check name="smtpSecure" label="SMTP SSL" defaultChecked={mailbox?.provider === "custom" ? mailbox.smtpSecure : true} />
          </>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="batchSize" label="Писем за проход" defaultValue={String(mailbox?.batchSize || 8)} />
        <Field name="bodyCharLimit" label="Лимит текста" defaultValue={String(mailbox?.bodyCharLimit || 150000)} />
        <Field name="entityListLimit" label="Лимит сущностей" defaultValue={String(mailbox?.entityListLimit || 40)} />
        <Field name="notifyPerHour" label="Уведомлений в час" defaultValue={String(mailbox?.notifyPerHour || 30)} />
        <Field name="senderPauseMinutes" label="Пауза отправителя, мин" defaultValue={String(mailbox?.senderPauseMinutes ?? 60)} />
        <Field name="subjectPauseMinutes" label="Пауза темы, мин" defaultValue={String(mailbox?.subjectPauseMinutes || 0)} />
        <Field name="domainPauseMinutes" label="Пауза домена, мин" defaultValue={String(mailbox?.domainPauseMinutes || 0)} />
        <Field
          name="retentionDays"
          label="Срок хранения, дни. Пусто — не удалять"
          defaultValue={mailbox?.retentionDays == null ? "" : String(mailbox.retentionDays)}
          placeholder="хранить всё"
        />
      </div>
      <p className="text-xs text-muted">Срок хранения относится только к этому ящику: сервис удаляет у себя старые письма и их уведомления. Письма на почтовом сервере остаются.</p>
      <p className="text-xs text-muted">Пароль после сохранения показывается только как маска и хранится в зашифрованном виде.</p>
      <button type="submit">{mailbox ? "Сохранить ящик" : "Создать ящик"}</button>
    </form>
  );
}

function ProviderMark({ id }: { id: MailboxProviderId }) {
  if (id === "yandex") {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="#FC3F1D" />
        <text x="20" y="26.5" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Arial, sans-serif">Я</text>
      </svg>
    );
  }
  if (id === "mailru") {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
        <rect x="2" y="2" width="36" height="36" rx="10" fill="#005FF9" />
        <path d="M8 14.5h24v2.2H8zm0 0 12 9 12-9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M8 16.2V27h24V16.2" fill="none" stroke="#fff" strokeWidth="2.2" />
      </svg>
    );
  }
  if (id === "gmail") {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
        <rect x="4" y="9" width="32" height="22" rx="2" fill="#fff" stroke="#E6E6E6" />
        <path d="M4 12v16l10-8z" fill="#34A853" />
        <path d="M36 12v16l-10-8z" fill="#4285F4" />
        <path d="M4 28h32L24 20l-4 3-4-3z" fill="#FBBC05" />
        <path d="M4 11.5 20 23 36 11.5" fill="none" stroke="#EA4335" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "outlook") {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
        <rect x="2" y="6" width="36" height="28" rx="4" fill="#0F6CBD" />
        <rect x="4" y="10" width="16" height="20" rx="2" fill="#fff" />
        <circle cx="12" cy="20" r="4.2" fill="none" stroke="#0F6CBD" strokeWidth="2" />
        <path d="M22 16h12M22 20h12M22 24h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "rambler") {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="#7AC143" />
        <text x="20" y="26.5" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Arial, sans-serif">R</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <rect x="6" y="7" width="28" height="8" rx="2" fill="none" stroke="#1B2822" strokeWidth="2" />
      <rect x="6" y="17" width="28" height="8" rx="2" fill="none" stroke="#1B2822" strokeWidth="2" />
      <rect x="6" y="27" width="28" height="6" rx="2" fill="none" stroke="#1B2822" strokeWidth="2" />
      <circle cx="12" cy="11" r="1.3" fill="#1B2822" />
      <circle cx="12" cy="21" r="1.3" fill="#1B2822" />
    </svg>
  );
}

function knownProvider(value: string | undefined): MailboxProviderId {
  return MAILBOX_PROVIDERS.some((item) => item.id === value) ? (value as MailboxProviderId) : "yandex";
}

function Field({ label, name, defaultValue, type = "text", required, placeholder }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block text-sm">
      {label}
      <input className="mt-1" name={name} defaultValue={defaultValue} type={type} required={required} placeholder={placeholder} form="mailbox-form" />
    </label>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input className="h-4 w-4" style={{ width: "auto" }} type="checkbox" name={name} defaultChecked={defaultChecked} form="mailbox-form" />
      {label}
    </label>
  );
}
