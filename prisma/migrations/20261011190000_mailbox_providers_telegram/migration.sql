ALTER TABLE "mailboxes" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'yandex';

UPDATE "mailboxes"
SET "provider" = CASE
  WHEN lower("imap_host") IN ('imap.yandex.com', 'imap.yandex.ru') THEN 'yandex'
  WHEN lower("imap_host") = 'imap.mail.ru' THEN 'mailru'
  WHEN lower("imap_host") = 'imap.gmail.com' THEN 'gmail'
  WHEN lower("imap_host") IN ('outlook.office365.com', 'imap-mail.outlook.com') THEN 'outlook'
  WHEN lower("imap_host") = 'imap.rambler.ru' THEN 'rambler'
  ELSE 'custom'
END;

ALTER TABLE "b24_recipients" ADD COLUMN "telegram_chat_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "integration_config" ADD COLUMN "telegram_bot_token_enc" TEXT;
