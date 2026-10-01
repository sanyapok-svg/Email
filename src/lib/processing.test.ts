import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { analyzeText } from "@/lib/analysis/analyze";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { extractEntities } from "@/lib/entities/extract";
import { isWorkingMoment, nextWorkingStart, planByWorkingHours } from "@/lib/hours/schedule";
import { decodeMimePart } from "@/lib/mail/decode";
import { emptyMessage } from "@/lib/mail/model";
import { buildNormalizedMessage } from "@/lib/mail/pipeline";
import { classifyStructure } from "@/lib/mail/structure";
import { decideMessage } from "@/lib/orchestration/decide";
import { firstMatchingRule } from "@/lib/rules/engine";
import type { RuleRecord } from "@/lib/rules/types";
import { renderTemplate, replySubject } from "@/lib/replies/render";
import { autoReplySuppression } from "@/lib/replies/safety";
import { htmlToText, splitQuotedText } from "@/lib/text/extract";
import iconv from "iconv-lite";

const receivedAt = DateTime.fromISO("2026-10-01T12:00:00", { zone: "Europe/Moscow" }).toUTC().toJSDate();

describe("text", () => {
  it("strips scripts and keeps readable text", () => {
    const text = htmlToText("<html><style>body{}</style><script>alert(1)</script><p>Нужно <b>подписать</b></p><br>договор</html>");
    expect(text).toContain("Нужно подписать");
    expect(text).toContain("договор");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("body{}");
  });

  it("separates a quoted reply", () => {
    const split = splitQuotedText("Просим подписать до завтра.\n\n> старый текст\n> подпись");
    expect(split.newText).toBe("Просим подписать до завтра.");
    expect(split.fullText).toContain("старый текст");
    expect(split.confidence).toBe("high");
  });
});

describe("decode", () => {
  it("decodes quoted-printable windows-1251", () => {
    const encoded = iconv.encode("Привет, договор", "windows-1251");
    const qp = Buffer.from(
      encoded
        .toString("hex")
        .match(/../g)!
        .map((byte) => `=${byte}`)
        .join(""),
      "ascii",
    );
    expect(decodeMimePart(qp, "quoted-printable", "windows-1251")).toBe("Привет, договор");
  });

  it("decodes base64 utf-8", () => {
    const payload = Buffer.from(Buffer.from("Оплата счёта", "utf8").toString("base64"), "utf8");
    expect(decodeMimePart(payload, "base64", "utf-8")).toBe("Оплата счёта");
  });
});

describe("entities", () => {
  it("extracts phones, links, dates, amounts and document numbers", () => {
    const text = [
      "Просим подписать договор № 145 и Д-145/2026 до 05.10.2026.",
      "Счёт № 123, СЧ-123, акт № 45, заявка № 678, инцидент № INC-123.",
      "Сумма 1 500 000 руб. и 150 000,00 ₽, также 150000.00 USD.",
      "Телефон +7 (999) 123-45-67, почта law@example.com, сайт https://pay.example.net/invoice.",
      "Оплатить до завтра. Через 3 дня будет конец. В понедельник созвон.",
    ].join("\n");
    const bundle = extractEntities({ subject: "Договор", body: text, fromDomain: "client.ru", receivedAt, timezone: "Europe/Moscow" });
    expect(bundle.phonesNormalized).toContain("+79991234567");
    expect(bundle.emails).toContain("law@example.com");
    expect(bundle.urlDomains).toContain("pay.example.net");
    expect(bundle.urlDomainMismatch).toBe(true);
    expect(bundle.contractNumbers.some((item) => item.includes("145"))).toBe(true);
    expect(bundle.invoiceNumbers.some((item) => item.includes("123"))).toBe(true);
    expect(bundle.actNumbers).toContain("45");
    expect(bundle.ticketIds).toEqual(expect.arrayContaining(["678", "INC-123"]));
    expect(bundle.amounts.map((item) => item.amount)).toEqual(expect.arrayContaining([1500000, 150000, 150000]));
    expect(bundle.currencies).toEqual(expect.arrayContaining(["RUB", "USD"]));
    expect(bundle.deadlines.length).toBeGreaterThan(0);
    expect(bundle.earliestDeadline).toBeTruthy();
  });
});

describe("analysis", () => {
  it("detects Russian negative urgent text", () => {
    const result = analyzeText({
      subject: "Срочно",
      body: "Не работает оплата, направляем претензию. Просрочено, критично!!!",
      receivedAt,
      deadlineIso: receivedAt.toISOString(),
    });
    expect(result.language).toBe("ru");
    expect(result.sentiment).toBe("negative");
    expect(["high", "critical"]).toContain(result.urgencyLevel);
  });
});

describe("rules and replies", () => {
  it("stops at the first matching rule", () => {
    const message = emptyMessage(receivedAt);
    message.subject = "Договор на подпись";
    message.bodyNewText = "Просим подписать";
    message.attachmentExtensions = ["pdf"];
    const exclude = rule("exclude", 1, { op: "all", conditions: [{ field: "subject", operator: "contains", value: "договор" }] });
    const notify = rule("notify", 2, { op: "all", conditions: [{ field: "body_new_text", operator: "contains", value: "подписать" }] });
    expect(firstMatchingRule([notify, exclude], message)?.id).toBe("exclude");
  });

  it("builds one notification and suppresses a mailing-list reply", () => {
    const message = emptyMessage(receivedAt);
    message.subject = "Оплата";
    message.fromEmail = "noreply@news.example";
    message.headers["list-unsubscribe"] = "<mailto:unsubscribe@news.example>";
    const matched = rule("notify", 1, { op: "all", conditions: [{ field: "subject", operator: "contains", value: "оплата" }] });
    matched.action.notificationEnabled = true;
    matched.action.autoReplyEnabled = true;
    matched.action.templateId = "tpl";
    const decision = decideMessage(message, [matched], context());
    expect(decision.decision).toBe("notify_and_reply");
    expect(decision.notification?.payload.subject).toBe("Оплата");
    expect(decision.notification?.payload).not.toHaveProperty("body");
    expect(decision.reply?.status).toBe("suppressed");
    expect(decision.reply?.idempotencyKey).toContain("auto:");
  });

  it("renders a reply subject and variables without executing code", () => {
    const message = emptyMessage(receivedAt);
    message.subject = "Re: Договор";
    message.fromDisplayName = "Анна";
    message.contractNumbers = ["145"];
    expect(replySubject(message.subject)).toBe("Re: Договор");
    expect(replySubject("Счёт")).toBe("Re: Счёт");
    expect(renderTemplate("{{from_name}} / {{contract_numbers}} {{process.exit}}", message)).toBe("Анна / 145 ");
  });

  it("suppresses auto-submitted mail", () => {
    const message = emptyMessage();
    message.fromEmail = "person@example.ru";
    message.headers["auto-submitted"] = "auto-replied";
    expect(autoReplySuppression(message)).toBe("auto-submitted");
  });
});

describe("schedule and secrets", () => {
  const schedule = {
    timezone: "Europe/Moscow",
    workDays: [1, 2, 3, 4, 5],
    intervals: [{ start: "09:00", end: "18:00" }],
    holidays: ["2026-10-02"],
  };

  it("defers a night notification to the next working window", () => {
    const night = DateTime.fromISO("2026-10-01T22:30:00", { zone: "Europe/Moscow" }).toJSDate();
    expect(isWorkingMoment(night, schedule)).toBe(false);
    const plan = planByWorkingHours(night, schedule, "defer");
    expect(plan.status).toBe("scheduled");
    const next = DateTime.fromJSDate(plan.scheduledAt!, { zone: "utc" }).setZone("Europe/Moscow");
    expect(next.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-10-05 09:00");
    expect(nextWorkingStart(night, schedule)?.toISOString()).toBe(plan.scheduledAt?.toISOString());
  });

  it("roundtrips a secret", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("app-password");
    expect(encrypted).not.toContain("app-password");
    expect(decryptSecret(encrypted)).toBe("app-password");
  });
});

describe("pipeline", () => {
  it("reads an html part and keeps only attachment names", async () => {
    const structure = classifyStructure({
      type: "multipart/mixed",
      childNodes: [
        { part: "1", type: "text/html", encoding: "8bit", parameters: { charset: "utf-8" } },
        { part: "2", type: "application/pdf", disposition: "attachment", dispositionParameters: { filename: "dogovor.pdf" } },
      ],
    });
    expect(structure.textParts.map((part) => part.part)).toEqual(["1"]);
    expect(structure.attachments[0]).toMatchObject({ name: "dogovor.pdf", extension: "pdf" });
    const subject = `=?UTF-8?B?${Buffer.from("Договор", "utf8").toString("base64")}?=`;
    const message = await buildNormalizedMessage({
      headerBuffer: Buffer.from(`Subject: ${subject}\r\nFrom: Anna <anna@client.ru>\r\nMessage-ID: <m1@client.ru>\r\n`),
      parts: [{ mimeType: "text/html", charset: "utf-8", encoding: "8bit", content: Buffer.from("<p>Просим подписать</p><script>bad()</script>", "utf8") }],
      attachments: structure.attachments,
      encrypted: false,
      sizeBytes: 1200,
      receivedAt,
      timezone: "Europe/Moscow",
      bodyCharLimit: 1000,
      entityLimit: 10,
    });
    expect(message.subject).toBe("Договор");
    expect(message.fromDomain).toBe("client.ru");
    expect(message.bodyNewText).toContain("Просим подписать");
    expect(message.bodyNewText).not.toContain("bad()");
    expect(message.attachmentNames).toEqual(["dogovor.pdf"]);
  });
});

function rule(id: string, position: number, conditions: RuleRecord["conditions"]): RuleRecord {
  return {
    id,
    name: id,
    type: id === "exclude" ? "exclude" : "notify",
    position,
    active: true,
    category: "legal",
    dryRun: false,
    conditions,
    action: {
      notificationEnabled: true,
      priority: "high",
      responseHours: 8,
      useExtractedDeadline: false,
      recipientIds: ["lawyers"],
      autoReplyEnabled: false,
      templateId: null,
      replyRespectWorkingHours: false,
      throttlingEnabled: true,
    },
  };
}

function context() {
  return {
    now: receivedAt,
    mailboxId: "box",
    mailboxName: "Общий",
    uid: "15",
    schedule: { timezone: "Europe/Moscow", workDays: [1, 2, 3, 4, 5], intervals: [{ start: "09:00", end: "18:00" }], holidays: [] },
    notifyOutsidePolicy: "defer" as const,
    replyOutsidePolicy: "send_now" as const,
    globalDryRun: false,
    mailboxDryRun: false,
    blocklist: ["no-reply", "noreply"],
    templateBody: "Получили {{subject}}",
    throttle: {
      ruleNotificationsLastHour: 0,
      notifyPerHour: 10,
      senderPaused: false,
      subjectPaused: false,
      domainPaused: false,
      mailboxRepliesLastHour: 0,
      replyPerHour: 10,
      recipientRepliesLastDay: 0,
      replyPerRecipientDay: 3,
    },
    previewInNotification: false,
    previewChars: 200,
    globalMessageDedupe: false,
    repliesEnabled: true,
  };
}
