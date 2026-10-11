import { describe, expect, it } from "vitest";
import { emptyMessage } from "@/lib/mail/model";
import { forwardLetter, forwardOutcome, resolveForwardAddress } from "@/lib/mail/forward";
import type { RuleAction } from "@/lib/rules/types";

const action = (patch: Partial<RuleAction> = {}): RuleAction => ({
  notificationEnabled: true,
  priority: "normal",
  responseHours: 24,
  useExtractedDeadline: false,
  recipientIds: [],
  throttlingEnabled: true,
  noticeGrouping: "each",
  noticeFields: ["subject"],
  previewChars: 280,
  forwardEnabled: true,
  forwardSource: "address",
  forwardAddress: "law@example.com",
  forwardRecipientId: "",
  ...patch,
});

describe("forward address", () => {
  it("uses a typed address", () => {
    expect(resolveForwardAddress(action(), null)).toBe("law@example.com");
    expect(resolveForwardAddress(action({ forwardAddress: "нет" }), null)).toBeNull();
    expect(resolveForwardAddress(action({ forwardEnabled: false }), null)).toBeNull();
  });

  it("uses the employee mailbox when that source is chosen", () => {
    const employee = { id: "anna", login: "Anna@Firm.ru", active: true, dismissed: false };
    expect(resolveForwardAddress(action({ forwardSource: "employee", forwardRecipientId: "anna" }), employee)).toBe("anna@firm.ru");
    expect(resolveForwardAddress(action({ forwardSource: "employee", forwardRecipientId: "anna" }), { ...employee, dismissed: true })).toBeNull();
    expect(resolveForwardAddress(action({ forwardSource: "employee", forwardRecipientId: "other" }), employee)).toBeNull();
  });
});

describe("forward letter", () => {
  it("keeps the original subject, sender and text", () => {
    const message = emptyMessage(new Date("2026-10-05T09:00:00Z"));
    message.subject = "Договор";
    message.fromDisplayName = "Анна";
    message.fromEmail = "anna@client.ru";
    message.to = ["inbox@firm.ru"];
    message.bodyFullText = "Просим подписать.";
    message.attachmentNames = ["dogovor.pdf"];
    const letter = forwardLetter(message);
    expect(letter.subject).toBe("Fwd: Договор");
    expect(letter.text).toContain("От: Анна <anna@client.ru>");
    expect(letter.text).toContain("Просим подписать.");
    expect(letter.text).toContain("dogovor.pdf");
    expect(letter.text).toContain("Файлы вложений не пересылаются");
  });
});

describe("forward outcome", () => {
  it("names the queue state and keeps the send error", () => {
    expect(forwardOutcome("pending", null)).toBe("пересылка: в очереди");
    expect(forwardOutcome("sent", null)).toBe("пересылка: отправлено");
    expect(forwardOutcome("error", "Яндекс отклонил отправителя")).toBe("пересылка: ошибка. Яндекс отклонил отправителя");
    expect(forwardOutcome("sent", "Копия не попала")).toBe("пересылка: отправлено. Копия не попала");
  });
});
