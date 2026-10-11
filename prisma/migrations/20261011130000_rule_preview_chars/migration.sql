UPDATE "rules" AS rule
SET "action" = jsonb_set(
  rule."action",
  '{previewChars}',
  to_jsonb(COALESCE((SELECT "preview_chars" FROM "integration_config" WHERE "id" = 'default'), 280)),
  true
)
WHERE jsonb_typeof(rule."action") = 'object'
  AND NOT (rule."action" ? 'previewChars');
