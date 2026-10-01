-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "display_address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "imap_host" TEXT NOT NULL DEFAULT 'imap.yandex.com',
    "imap_port" INTEGER NOT NULL DEFAULT 993,
    "imap_secure" BOOLEAN NOT NULL DEFAULT true,
    "imap_user" TEXT NOT NULL,
    "imap_password_enc" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL DEFAULT 'smtp.yandex.com',
    "smtp_port" INTEGER NOT NULL DEFAULT 465,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT true,
    "smtp_user" TEXT,
    "smtp_password_enc" TEXT,
    "smtp_from_name" TEXT,
    "smtp_from_address" TEXT,
    "replies_enabled" BOOLEAN NOT NULL DEFAULT false,
    "replies_paused" BOOLEAN NOT NULL DEFAULT false,
    "batch_size" INTEGER NOT NULL DEFAULT 8,
    "poll_interval_sec" INTEGER NOT NULL DEFAULT 300,
    "body_char_limit" INTEGER NOT NULL DEFAULT 150000,
    "entity_list_limit" INTEGER NOT NULL DEFAULT 40,
    "work_days" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "work_intervals" JSONB NOT NULL DEFAULT '[{"start":"09:00","end":"18:00"}]',
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "notify_outside_policy" TEXT NOT NULL DEFAULT 'defer',
    "reply_outside_policy" TEXT NOT NULL DEFAULT 'send_now',
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "notify_per_hour" INTEGER NOT NULL DEFAULT 30,
    "reply_per_hour" INTEGER NOT NULL DEFAULT 10,
    "reply_per_recipient_day" INTEGER NOT NULL DEFAULT 3,
    "sender_pause_minutes" INTEGER NOT NULL DEFAULT 60,
    "subject_pause_minutes" INTEGER NOT NULL DEFAULT 0,
    "domain_pause_minutes" INTEGER NOT NULL DEFAULT 0,
    "auto_reply_blocklist" JSONB NOT NULL DEFAULT '["mailer-daemon","postmaster","no-reply","noreply","do-not-reply","donotreply","notification","notifications","newsletter","unsubscribe"]',
    "uid_validity" BIGINT,
    "last_uid" BIGINT,
    "initialized" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMP(3),
    "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "smtp_last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "conditions" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_templates" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reply_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_messages" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "uid" BIGINT NOT NULL,
    "uid_validity" BIGINT NOT NULL,
    "message_id_header" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "subject" TEXT NOT NULL DEFAULT '',
    "subject_normalized" TEXT NOT NULL DEFAULT '',
    "from_email" TEXT NOT NULL DEFAULT '',
    "from_display_name" TEXT NOT NULL DEFAULT '',
    "from_domain" TEXT NOT NULL DEFAULT '',
    "from_tld" TEXT NOT NULL DEFAULT '',
    "to_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cc_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reply_to" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "attachment_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachment_extensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headers_snapshot" JSONB NOT NULL DEFAULT '{}',
    "body_full_text" TEXT NOT NULL DEFAULT '',
    "body_new_text" TEXT NOT NULL DEFAULT '',
    "body_preview" TEXT NOT NULL DEFAULT '',
    "body_truncated" BOOLEAN NOT NULL DEFAULT false,
    "body_unavailable" BOOLEAN NOT NULL DEFAULT false,
    "body_error" TEXT,
    "quote_split_confidence" TEXT NOT NULL DEFAULT 'high',
    "language" TEXT NOT NULL DEFAULT 'unknown',
    "language_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "sentiment_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urgency_level" TEXT NOT NULL DEFAULT 'normal',
    "urgency_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phones_raw" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phones_normalized" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url_domain_mismatch" BOOLEAN NOT NULL DEFAULT false,
    "dates" JSONB NOT NULL DEFAULT '[]',
    "deadlines" JSONB NOT NULL DEFAULT '[]',
    "earliest_deadline" TIMESTAMP(3),
    "amounts" JSONB NOT NULL DEFAULT '[]',
    "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contract_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invoice_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "act_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ticket_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inn_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kpp_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ogrn_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bank_account_candidates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entity_lists_truncated" BOOLEAN NOT NULL DEFAULT false,
    "decision" TEXT NOT NULL,
    "matched_rule_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "search_document" TEXT NOT NULL DEFAULT '',
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "category" TEXT,
    "response_due_at" TIMESTAMP(3),
    "overdue" BOOLEAN NOT NULL DEFAULT false,
    "due_risk" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_replies" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "template_id" TEXT,
    "kind" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "references_header" TEXT,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "suppressed_reason" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b24_recipients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b24_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "b24_mode" TEXT NOT NULL DEFAULT 'mock',
    "webhook_url_enc" TEXT,
    "global_dry_run" BOOLEAN NOT NULL DEFAULT true,
    "retention_days" INTEGER,
    "notify_max_attempts" INTEGER NOT NULL DEFAULT 5,
    "reply_max_attempts" INTEGER NOT NULL DEFAULT 5,
    "include_body_preview" BOOLEAN NOT NULL DEFAULT false,
    "preview_chars" INTEGER NOT NULL DEFAULT 280,
    "global_message_dedupe" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "counters" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_locks" (
    "id" TEXT NOT NULL,
    "locked_until" TIMESTAMP(3) NOT NULL,
    "owner" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduler_locks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rules_mailbox_id_position_idx" ON "rules"("mailbox_id", "position");

-- CreateIndex
CREATE INDEX "reply_templates_mailbox_id_idx" ON "reply_templates"("mailbox_id");

-- CreateIndex
CREATE INDEX "processed_messages_mailbox_id_received_at_idx" ON "processed_messages"("mailbox_id", "received_at");

-- CreateIndex
CREATE INDEX "processed_messages_decision_idx" ON "processed_messages"("decision");

-- CreateIndex
CREATE INDEX "processed_messages_from_email_idx" ON "processed_messages"("from_email");

-- CreateIndex
CREATE INDEX "processed_messages_from_domain_idx" ON "processed_messages"("from_domain");

-- CreateIndex
CREATE INDEX "processed_messages_message_id_header_idx" ON "processed_messages"("message_id_header");

-- CreateIndex
CREATE UNIQUE INDEX "processed_messages_mailbox_id_uid_uid_validity_key" ON "processed_messages"("mailbox_id", "uid", "uid_validity");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_status_next_attempt_at_idx" ON "notifications"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notifications_mailbox_id_created_at_idx" ON "notifications"("mailbox_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_replies_idempotency_key_key" ON "outbound_replies"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbound_replies_status_next_attempt_at_idx" ON "outbound_replies"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbound_replies_mailbox_id_created_at_idx" ON "outbound_replies"("mailbox_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_day_mailbox_id_key" ON "daily_metrics"("day", "mailbox_id");

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_templates" ADD CONSTRAINT "reply_templates_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_messages" ADD CONSTRAINT "processed_messages_matched_rule_id_fkey" FOREIGN KEY ("matched_rule_id") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "processed_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_replies" ADD CONSTRAINT "outbound_replies_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_replies" ADD CONSTRAINT "outbound_replies_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "processed_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_replies" ADD CONSTRAINT "outbound_replies_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_replies" ADD CONSTRAINT "outbound_replies_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "reply_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "processed_messages_search_ru_idx" ON "processed_messages" USING GIN (to_tsvector('russian', coalesce("search_document", '')));
CREATE INDEX "processed_messages_search_en_idx" ON "processed_messages" USING GIN (to_tsvector('english', coalesce("search_document", '')));
CREATE INDEX "processed_messages_trgm_idx" ON "processed_messages" USING GIN ("search_document" gin_trgm_ops);
