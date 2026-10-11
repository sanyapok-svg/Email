import { describe, expect, it } from "vitest";
import { detectMailboxProvider, resolveMailboxConnection } from "@/lib/mail/providers";

describe("mailbox providers", () => {
  it("recognizes the preset hosts", () => {
    expect(detectMailboxProvider("imap.yandex.com")).toBe("yandex");
    expect(detectMailboxProvider("imap.gmail.com")).toBe("gmail");
    expect(detectMailboxProvider("mail.example.com")).toBe("custom");
  });

  it("fills Yandex servers and ignores a typed host", () => {
    expect(resolveMailboxConnection({ provider: "yandex", imapHost: "evil.example" })).toMatchObject({
      provider: "yandex",
      imapHost: "imap.yandex.com",
      imapPort: 993,
      smtpHost: "smtp.yandex.com",
      smtpPort: 465,
    });
  });

  it("keeps a custom server", () => {
    expect(
      resolveMailboxConnection({
        provider: "custom",
        imapHost: "imap.example.com",
        imapPort: 143,
        imapSecure: false,
        smtpHost: "smtp.example.com",
        smtpPort: 587,
        smtpSecure: false,
      }),
    ).toMatchObject({
      imapHost: "imap.example.com",
      imapPort: 143,
      imapSecure: false,
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecure: false,
    });
  });
});
