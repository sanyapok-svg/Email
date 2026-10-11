ALTER TABLE "mailboxes" ADD COLUMN "retention_days" INTEGER;

UPDATE "mailboxes"
SET "retention_days" = (
  SELECT "retention_days" FROM "integration_config" WHERE "id" = 'default'
)
WHERE "retention_days" IS NULL
  AND EXISTS (
    SELECT 1 FROM "integration_config" WHERE "id" = 'default' AND "retention_days" IS NOT NULL
  );
