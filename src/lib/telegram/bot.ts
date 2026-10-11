const TELEGRAM_TEXT_LIMIT = 4096;

export function telegramApiUrl(token: string, method: string): string | null {
  const trimmed = token.trim();
  if (!/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(trimmed)) return null;
  return `https://api.telegram.org/bot${trimmed}/${method}`;
}

export function clipTelegramText(text: string): string {
  const value = text.trim();
  if (value.length <= TELEGRAM_TEXT_LIMIT) return value;
  return `${value.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`;
}

export type TelegramChat = { id: string; title: string };

export function readTelegramChats(payload: unknown): TelegramChat[] {
  const updates = payload && typeof payload === "object" && Array.isArray((payload as { result?: unknown }).result)
    ? (payload as { result: unknown[] }).result
    : [];
  const chats = new Map<string, string>();
  for (const update of updates) {
    if (!update || typeof update !== "object") continue;
    const record = update as Record<string, unknown>;
    const message = record.message ?? record.edited_message ?? record.channel_post ?? record.my_chat_member;
    const chat = message && typeof message === "object" ? (message as { chat?: unknown }).chat : null;
    if (!chat || typeof chat !== "object") continue;
    const id = String((chat as { id?: unknown }).id ?? "").trim();
    if (!/^-?\d+$/.test(id)) continue;
    const named = chat as { title?: unknown; username?: unknown; first_name?: unknown; last_name?: unknown };
    const person = [named.first_name, named.last_name].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
    const title = String(named.title ?? "").trim() || person || (named.username ? `@${named.username}` : id);
    chats.set(id, title);
  }
  return [...chats.entries()].map(([id, title]) => ({ id, title }));
}

export async function deliverToTelegram(input: {
  token: string | null;
  chatIds: string[];
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = input.token ? telegramApiUrl(input.token, "sendMessage") : null;
  if (!url) return { ok: false, error: "Бот Telegram не настроен" };
  const chatIds = [...new Set(input.chatIds.map((id) => id.trim()).filter((id) => /^-?\d+$/.test(id)))];
  if (!chatIds.length) return { ok: false, error: "У получателей не указан chat id Telegram" };
  const text = clipTelegramText(input.text);
  if (!text) return { ok: false, error: "Пустой текст уведомления" };
  for (const chatId of chatIds) {
    const result = await postTelegram(url, { chat_id: chatId, text, disable_web_page_preview: true });
    if (!result.ok) return result;
  }
  return { ok: true };
}

export async function fetchTelegramChats(token: string): Promise<{ ok: true; chats: TelegramChat[] } | { ok: false; error: string }> {
  const url = telegramApiUrl(token, "getUpdates");
  if (!url) return { ok: false, error: "Сначала сохраните токен бота" };
  try {
    const response = await fetch(`${url}?limit=50`, { signal: AbortSignal.timeout(15000) });
    const payload = await response.json();
    if (!payload || payload.ok !== true) {
      const description = String(payload?.description || "Telegram не принял токен").slice(0, 200);
      return { ok: false, error: description };
    }
    return { ok: true, chats: readTelegramChats(payload) };
  } catch {
    return { ok: false, error: "Нет ответа от Telegram" };
  }
}

async function postTelegram(url: string, body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const payload = (await response.json()) as { ok?: boolean; description?: string };
    if (payload.ok) return { ok: true };
    return { ok: false, error: String(payload.description || "Telegram отклонил сообщение").slice(0, 300) };
  } catch {
    return { ok: false, error: "Нет ответа от Telegram" };
  }
}
