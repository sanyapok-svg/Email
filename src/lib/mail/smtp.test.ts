import { describe, expect, it } from "vitest";
import { sentMailboxPath } from "@/lib/mail/sent-copy";
import { compileMailboxMail } from "@/lib/mail/smtp";

describe("compiled forward", () => {
  it("encodes a Russian subject and keeps the text in the body", () => {
    const raw = compileMailboxMail({
      fromName: "Мой ящик",
      fromAddress: "alex@yandex.by",
      to: "bima_@mail.ru",
      subject: "Fwd: Договор",
      text: "Просим подписать.",
    });
    const source = raw.toString("utf8");
    expect(source).toContain("To: bima_@mail.ru");
    expect(source).toContain(`Subject: =?UTF-8?B?${Buffer.from("Fwd: Договор", "utf8").toString("base64")}?=`);
    expect(source).toContain(Buffer.from("Просим подписать.", "utf8").toString("base64"));
    expect(source).toContain("\r\n");
  });
});

describe("sent folder", () => {
  it("prefers the special-use folder and otherwise the Russian name", () => {
    expect(sentMailboxPath([{ path: "INBOX" }, { path: "Sent", specialUse: "\\Sent" }])).toBe("Sent");
    expect(sentMailboxPath([{ path: "INBOX", name: "Входящие" }, { path: "Отправленные", name: "Отправленные" }])).toBe("Отправленные");
    expect(sentMailboxPath([{ path: "INBOX", name: "Входящие" }])).toBeNull();
  });
});
