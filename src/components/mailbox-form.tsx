import type { Mailbox } from "@prisma/client";
import { saveMailbox } from "@/server/mailboxes";

export function MailboxForm({ mailbox }: { mailbox?: Mailbox }) {
  const days = Array.isArray(mailbox?.workDays) ? (mailbox?.workDays as number[]).join(", ") : "1, 2, 3, 4, 5";
  const intervals = Array.isArray(mailbox?.workIntervals)
    ? (mailbox?.workIntervals as Array<{ start: string; end: string }>).map((item) => `${item.start}-${item.end}`).join(", ")
    : "09:00-18:00";
  const holidays = Array.isArray(mailbox?.holidays) ? (mailbox?.holidays as string[]).join(", ") : "";
  const blocklist = Array.isArray(mailbox?.autoReplyBlocklist) ? (mailbox?.autoReplyBlocklist as string[]).join(", ") : "no-reply, noreply, mailer-daemon, postmaster";
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
        <Field name="smtpHost" label="SMTP-хост" defaultValue={mailbox?.smtpHost || "smtp.yandex.com"} />
        <Field name="smtpPort" label="SMTP-порт" defaultValue={String(mailbox?.smtpPort || 465)} />
        <Field name="smtpUser" label="SMTP-логин" defaultValue={mailbox?.smtpUser || ""} />
        <Field name="smtpPassword" label="Пароль SMTP" type="password" placeholder={mailbox?.smtpPasswordEnc ? "сохранён, показана маска" : ""} />
        <Field name="smtpFromName" label="Имя отправителя ответа" defaultValue={mailbox?.smtpFromName || ""} />
        <Field name="smtpFromAddress" label="Адрес отправителя ответа" defaultValue={mailbox?.smtpFromAddress || ""} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Check name="active" label="Ящик активен" defaultChecked={mailbox?.active} />
        <Check name="imapSecure" label="IMAP SSL" defaultChecked={mailbox?.imapSecure ?? true} />
        <Check name="smtpSecure" label="SMTP SSL, иначе STARTTLS" defaultChecked={mailbox?.smtpSecure ?? true} />
        <Check name="repliesEnabled" label="Разрешить ответы" defaultChecked={mailbox?.repliesEnabled} />
        <Check name="dryRun" label="Сухой прогон ящика" defaultChecked={mailbox?.dryRun} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Field name="batchSize" label="Писем за проход" defaultValue={String(mailbox?.batchSize || 8)} />
        <Field name="pollIntervalSec" label="Интервал, сек" defaultValue={String(mailbox?.pollIntervalSec || 300)} />
        <Field name="bodyCharLimit" label="Лимит текста" defaultValue={String(mailbox?.bodyCharLimit || 150000)} />
        <Field name="entityListLimit" label="Лимит сущностей" defaultValue={String(mailbox?.entityListLimit || 40)} />
        <Field name="notifyPerHour" label="Уведомлений в час" defaultValue={String(mailbox?.notifyPerHour || 30)} />
        <Field name="replyPerHour" label="Ответов в час" defaultValue={String(mailbox?.replyPerHour || 10)} />
        <Field name="replyPerRecipientDay" label="Ответов адресату в сутки" defaultValue={String(mailbox?.replyPerRecipientDay || 3)} />
        <Field name="senderPauseMinutes" label="Пауза отправителя, мин" defaultValue={String(mailbox?.senderPauseMinutes ?? 60)} />
        <Field name="subjectPauseMinutes" label="Пауза темы, мин" defaultValue={String(mailbox?.subjectPauseMinutes || 0)} />
        <Field name="domainPauseMinutes" label="Пауза домена, мин" defaultValue={String(mailbox?.domainPauseMinutes || 0)} />
      </div>
      <Field name="workDays" label="Рабочие дни, 1–7" defaultValue={days} />
      <Field name="workIntervals" label="Интервалы ЧЧ:ММ-ЧЧ:ММ" defaultValue={intervals} />
      <Field name="holidays" label="Праздники ГГГГ-ММ-ДД" defaultValue={holidays} />
      <div className="grid gap-3 md:grid-cols-2">
        <Select name="notifyOutsidePolicy" label="Уведомления вне часов" defaultValue={mailbox?.notifyOutsidePolicy || "defer"} options={[["defer", "отложить"], ["send_now", "отправить сразу"], ["cancel", "отменить"]]} />
        <Select name="replyOutsidePolicy" label="Ответы вне часов" defaultValue={mailbox?.replyOutsidePolicy || "send_now"} options={[["send_now", "отправить сразу"], ["defer", "отложить"], ["cancel", "отменить"]]} />
      </div>
      <Field name="autoReplyBlocklist" label="Запрет автоответов, через запятую" defaultValue={blocklist} />
      <p className="text-xs text-muted">Пароли после сохранения показываются только как маска и хранятся в зашифрованном виде.</p>
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

function Select({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: string; options: string[][] }) {
  return (
    <label className="block text-sm">
      {label}
      <select className="mt-1" name={name} defaultValue={defaultValue} form="mailbox-form">
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
