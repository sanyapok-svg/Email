CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

INSERT INTO "accounts" ("id", "name", "active", "created_at", "updated_at")
VALUES ('acc_astra_leasing', 'АСТРА ЛИЗИНГ', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "mailboxes" ADD COLUMN "account_id" TEXT;
UPDATE "mailboxes" SET "account_id" = 'acc_astra_leasing';
ALTER TABLE "mailboxes" ALTER COLUMN "account_id" SET NOT NULL;
CREATE INDEX "mailboxes_account_id_idx" ON "mailboxes"("account_id");
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "b24_recipients" ADD COLUMN "account_id" TEXT;
UPDATE "b24_recipients" SET "account_id" = 'acc_astra_leasing';
ALTER TABLE "b24_recipients" ALTER COLUMN "account_id" SET NOT NULL;
ALTER TABLE "b24_recipients" ALTER COLUMN "number" DROP DEFAULT;
DROP INDEX "b24_recipients_number_key";
CREATE UNIQUE INDEX "b24_recipients_account_id_number_key" ON "b24_recipients"("account_id", "number");
CREATE INDEX "b24_recipients_account_id_idx" ON "b24_recipients"("account_id");
ALTER TABLE "b24_recipients" ADD CONSTRAINT "b24_recipients_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_config" ADD COLUMN "account_id" TEXT;
INSERT INTO "integration_config" (
    "id",
    "b24_mode",
    "global_dry_run",
    "notify_max_attempts",
    "reply_max_attempts",
    "include_body_preview",
    "global_message_dedupe",
    "updated_at",
    "account_id"
)
SELECT 'default', 'mock', true, 5, 5, false, false, CURRENT_TIMESTAMP, 'acc_astra_leasing'
WHERE NOT EXISTS (SELECT 1 FROM "integration_config");
UPDATE "integration_config" SET "account_id" = 'acc_astra_leasing' WHERE "account_id" IS NULL;
ALTER TABLE "integration_config" ALTER COLUMN "account_id" SET NOT NULL;
CREATE UNIQUE INDEX "integration_config_account_id_key" ON "integration_config"("account_id");
ALTER TABLE "integration_config" ADD CONSTRAINT "integration_config_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_config" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "service_users" ADD COLUMN "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "service_users" SET "is_super_admin" = true WHERE "login" = 'bima_@mail.ru';

CREATE TABLE "account_members" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_members_account_id_user_id_key" ON "account_members"("account_id", "user_id");
CREATE INDEX "account_members_user_id_idx" ON "account_members"("user_id");
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "service_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "account_members" ("id", "account_id", "user_id", "role", "created_at")
SELECT 'mem_' || "id", 'acc_astra_leasing', "id", 'admin', CURRENT_TIMESTAMP
FROM "service_users";
