import { logEvent } from "@/lib/log";

export type B24Mode = "mock" | "webhook";

export function bitrixMethodUrl(webhookUrl: string, method: string): string | null {
  let url: URL;
  try {
    url = new URL(webhookUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const userId = parts[1] ?? "";
  const token = parts[2] ?? "";
  if (parts[0] !== "rest" || !/^\d+$/.test(userId) || token.length < 8) return null;
  const name = method.replace(/^\//, "").replace(/\.json$/, "");
  return `${url.origin}/rest/${userId}/${token}/${name}.json`;
}

export function bitrixUserIds(payload: Record<string, unknown>): string[] {
  if (!Array.isArray(payload.b24Users)) return [];
  const ids = payload.b24Users.flatMap((user) => {
    if (!user || typeof user !== "object") return [];
    const id = String((user as { externalId?: unknown }).externalId ?? "").trim();
    return /^\d+$/.test(id) ? [id] : [];
  });
  return [...new Set(ids)];
}

export async function deliverToBitrix(input: {
  mode: B24Mode;
  webhookUrl: string | null;
  payload: Record<string, unknown>;
}): Promise<{ ok: true; mocked: boolean } | { ok: false; error: string }> {
  if (input.mode !== "webhook") {
    logEvent("info", "b24.mock", {
      idempotencyKey: String(input.payload.idempotencyKey ?? ""),
      mailboxId: String(input.payload.mailboxId ?? ""),
      priority: String(input.payload.priority ?? ""),
    });
    return { ok: true, mocked: true };
  }
  if (!input.webhookUrl) return { ok: false, error: "Веб-хук не настроен" };
  const chatUrl = bitrixMethodUrl(input.webhookUrl, "im.message.add");
  if (!chatUrl) return postJson(input.webhookUrl, input.payload);
  const userIds = bitrixUserIds(input.payload);
  if (!userIds.length) return { ok: false, error: "У правила нет получателя Битрикс24" };
  const message = String(input.payload.text || input.payload.subject || "").trim();
  if (!message) return { ok: false, error: "Пустой текст уведомления" };
  for (const userId of userIds) {
    const result = await postJson(chatUrl, {
      DIALOG_ID: userId,
      MESSAGE: message,
    });
    if (!result.ok) return result;
  }
  return { ok: true, mocked: false };
}

async function postJson(url: string, body: Record<string, unknown>): Promise<{ ok: true; mocked: boolean } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const raw = await response.text();
    let parsed: { error?: string; error_description?: string } | null = null;
    try {
      parsed = JSON.parse(raw) as { error?: string; error_description?: string };
    } catch {
      parsed = null;
    }
    if (parsed?.error) {
      logEvent("warn", "b24.http_error", { status: response.status });
      return { ok: false, error: String(parsed.error_description || parsed.error).slice(0, 300) };
    }
    if (!response.ok) {
      logEvent("warn", "b24.http_error", { status: response.status });
      return { ok: false, error: `HTTP ${response.status}` };
    }
    return { ok: true, mocked: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook failed";
    logEvent("error", "b24.request_failed", { message: message.slice(0, 200) });
    return { ok: false, error: message.slice(0, 300) };
  }
}
