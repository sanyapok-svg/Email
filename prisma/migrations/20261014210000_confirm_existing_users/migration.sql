-- Уже существующий доступ считается подтверждённым.
-- Ждут ссылку только неактивные учётки с почтой и без даты подтверждения.
UPDATE "service_users"
SET "email_verified_at" = "created_at"
WHERE "email_verified_at" IS NULL
  AND NOT ("active" = false AND "email" IS NOT NULL);
