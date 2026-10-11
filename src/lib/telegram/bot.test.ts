import { describe, expect, it } from "vitest";
import { clipTelegramText, readTelegramChats, telegramApiUrl } from "@/lib/telegram/bot";

describe("telegram bot", () => {
  it("accepts a bot token and rejects a webhook", () => {
    expect(telegramApiUrl("123456789:AAHexampleexampleexampleexample", "sendMessage")).toContain("/sendMessage");
    expect(telegramApiUrl("not-a-token", "sendMessage")).toBeNull();
  });

  it("reads people and groups from updates", () => {
    expect(
      readTelegramChats({
        ok: true,
        result: [
          { message: { chat: { id: 42, first_name: "Анна", last_name: "Соколова" } } },
          { message: { chat: { id: -100, title: "Договоры" } } },
          { message: { chat: { id: 42, first_name: "Анна" } } },
        ],
      }),
    ).toEqual([
      { id: "42", title: "Анна" },
      { id: "-100", title: "Договоры" },
    ]);
  });

  it("clips a message to the telegram limit", () => {
    expect(clipTelegramText("а".repeat(5000))).toHaveLength(4096);
  });
});