import { describe, expect, it } from "vitest";
import { sentMailboxPath } from "@/lib/mail/sent-copy";
import { compileMailboxMail, smtpEndpointPlan } from "@/lib/mail/smtp";

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

describe("smtp endpoints", () => {
  it("tries IPv4 on 465 before the other paths", () => {
    const plan = smtpEndpointPlan("smtp.yandex.com", "77.88.21.158", "2a02:6b8::19d");
    expect(plan.map((item) => item.label)).toEqual(["465/v4", "465/v6", "587/v4", "587/v6"]);
    expect(plan[0]).toMatchObject({ host: "77.88.21.158", servername: "smtp.yandex.com", port: 465, secure: true });
  });
});

describe("sent folder", () => {
  it("prefers the special-use folder and otherwise the Russian name", () => {
    expect(sentMailboxPath([{ path: "INBOX" }, { path: "Sent", specialUse: "\\Sent" }])).toBe("Sent");
    expect(sentMailboxPath([{ path: "INBOX", name: "Входящие" }, { path: "Отправленные", name: "Отправленные" }])).toBe("Отправленные");
    expect(sentMailboxPath([{ path: "INBOX", name: "Входящие" }])).toBeNull();
  });
});
