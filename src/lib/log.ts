type LogValue = string | number | boolean | null;

const FORBIDDEN = /password|secret|webhook|authorization|bodyfull|bodynew|body_full|body_new/i;

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, LogValue> = {},
) {
  const safe: Record<string, LogValue> = { level, event, ts: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN.test(key)) continue;
    safe[key] = value;
  }
  const line = JSON.stringify(safe);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
