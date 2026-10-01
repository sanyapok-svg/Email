import { logEvent } from "@/lib/log";

export type B24Mode = "mock" | "webhook";

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
  try {
    const response = await fetch(input.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.payload),
      signal: AbortSignal.timeout(15000),
    });
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
