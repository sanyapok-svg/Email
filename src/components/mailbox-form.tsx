import type { Mailbox } from "@prisma/client";
import { saveMailbox } from "@/server/mailboxes";

export function MailboxForm({ mailbox }: { mailbox?: Mailbox }) {
  return (
    <form action={saveMailbox} className="grid gap-4" id="mailbox-form">
      {mailbox ? <input type="hidden" name="id" value={mailbox.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="name" label="Имя" defaultValue={mailbox?.name} required />
        <Field name="address" label="Адрес ящика" defaultValue={mailbox?.address} required />
        <Field name="displayAddress" label="Адрес для отображения" defaultValue={mailbox?.displayAddress || ""} />
        <Field name="timezone" label="Часовой пояс" defaultValue={mailbox?.timezone || "Europe/Moscow"} />
        <Field name="imapHost" label="IMAP-хост" defaultValue={mailbox?.imapHost || "imap.yandex.com"} />
        <Field name="imapPort" label="IMAP-порт" defaultValue={String(mailbox?.imapPort || 993)} />
        <Field name="imapUser" label="IMAP-логин" defaultValue={mailbox?.imapUser} required />
        <Field name="imapPassword" label={mailbox ? "Новый пароль IMAP" : "Пароль IMAP"} type="password" placeholder={mailbox ? "оставьте пустым, чтобы не менять" : ""} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Check name="active" label="Ящик и все правила активны" defaultChecked={mailbox?.active} />
        <Check name="imapSecure" label="IMAP SSL" defaultChecked={mailbox?.imapSecure ?? true} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field name="batchSize" label="Писем за проход" defaultValue={String(mailbox?.batchSize || 8)} />
        <Field name="bodyCharLimit" label="Лимит текста" defaultValue={String(mailbox?.bodyCharLimit || 150000)} />
        <Field name="entityListLimit" label="Лимит сущностей" defaultValue={String(mailbox?.entityListLimit || 40)} />
        <Field name="notifyPerHour" label="Уведомлений в час" defaultValue={String(mailbox?.notifyPerHour || 30)} />
        <Field name="senderPauseMinutes" label="Пауза отправителя, мин" defaultValue={String(mailbox?.senderPauseMinutes ?? 60)} />
        <Field name="subjectPauseMinutes" label="Пауза темы, мин" defaultValue={String(mailbox?.subjectPauseMinutes || 0)} />
        <Field name="domainPauseMinutes" label="Пауза домена, мин" defaultValue={String(mailbox?.domainPauseMinutes || 0)} />
      </div>
      <p className="text-xs text-muted">Пароль после сохранения показывается только как маска и хранится в зашифрованном виде.</p>
      <button type="submit">{mailbox ? "Сохранить ящик" : "Создать ящик"}</button>
    </form>
  );
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
