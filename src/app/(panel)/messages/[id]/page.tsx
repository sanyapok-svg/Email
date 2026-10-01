import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";
import { renderTemplate } from "@/lib/replies/render";
import { sendManualReply } from "@/server/ops";
import { storedMessage } from "@/lib/mail/stored";

export default async function MessagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const message = await prisma.processedMessage.findUnique({
    where: { id },
    include: {
      mailbox: true,
      matchedRule: true,
      notifications: true,
      replies: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!message) notFound();
  const templates = await prisma.replyTemplate.findMany({ where: { mailboxId: message.mailboxId, active: true } });
  const normalized = storedMessage(message);
  return (
    <>
      <PageTitle title={message.subject || "(без темы)"} text={`${message.fromDisplayName} <${message.fromEmail}> · ${message.mailbox.name}`} />
      <Notice text={query.notice} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <article className="rounded-xl border border-line bg-card p-4">
          <p className="text-sm text-muted">
            {labelStatus(message.decision)} {message.matchedRule ? `· правило ${message.matchedRule.name}` : ""} {message.bodyTruncated ? "· тело обрезано" : ""} {message.bodyUnavailable ? "· текст недоступен" : ""}
          </p>
          <pre className="mt-4 whitespace-pre-wrap text-sm">{message.bodyNewText || message.bodyFullText || "Текст не извлечён"}</pre>
        </article>
        <aside className="grid gap-3">
          <Info title="Разбор" lines={[
            `Язык: ${message.language} (${message.languageConfidence})`,
            `Тональность: ${message.sentiment} (${message.sentimentScore})`,
            `Срочность: ${message.urgencyLevel} (${message.urgencyScore})`,
            `Вложения: ${message.attachmentNames.join(", ") || "нет"}`,
            `Телефоны: ${message.phonesNormalized.join(", ") || "нет"}`,
            `Email: ${message.emails.join(", ") || "нет"}`,
            `Ссылки: ${message.urls.slice(0, 8).join(", ") || "нет"}`,
            `Договоры: ${message.contractNumbers.join(", ") || "нет"}`,
            `Счета: ${message.invoiceNumbers.join(", ") || "нет"}`,
            `Акты: ${message.actNumbers.join(", ") || "нет"}`,
            `Заявки: ${message.ticketIds.join(", ") || "нет"}`,
            `Суммы: ${normalized.amounts.map((item) => `${item.amount} ${item.currency || ""}`).join(", ") || "нет"}`,
            `Дедлайн: ${message.earliestDeadline?.toLocaleString("ru-RU") || "нет"}`,
          ]} />
          <Info title="Уведомления" lines={message.notifications.map((item) => `${labelStatus(item.status)} · ${item.priority}`)} empty="нет" />
          <Info title="Ответы" lines={message.replies.map((item) => `${item.kind}: ${labelStatus(item.status)}`)} empty="нет" />
        </aside>
      </div>
      {message.mailbox.repliesEnabled ? (
        <form action={sendManualReply} className="mt-6 grid gap-3 rounded-xl border border-line bg-card p-4">
          <h2 className="font-semibold">Ручной ответ</h2>
          <input type="hidden" name="messageId" value={message.id} />
          <p className="text-sm text-muted">Кому: {message.replyTo[0] || message.fromEmail}. Тема начнётся с Re:, если её ещё нет. Входящее письмо не помечается и не перемещается.</p>
          <label className="text-sm">
            Подставить шаблон
            <select className="mt-1" name="templateId" defaultValue="">
              <option value="">без шаблона</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <textarea name="body" rows={8} defaultValue={templates[0] ? renderTemplate(templates[0].bodyText, normalized, { mailboxName: message.mailbox.name, messageRef: message.messageIdHeader || message.id }) : ""} />
          <button type="submit">Поставить ответ в очередь</button>
          <p className="text-xs text-muted">Переменные: {"{{from_name}} {{from_email}} {{subject}} {{contract_numbers}} {{invoice_numbers}} {{amounts}} {{earliest_deadline}} {{attachments}} {{mailbox_name}}"}</p>
        </form>
      ) : null}
      <p className="mt-4 text-sm"><Link className="underline" href="/messages">К списку</Link></p>
    </>
  );
}

function Info({ title, lines, empty }: { title: string; lines: string[]; empty?: string }) {
  return (
    <section className="rounded-xl border border-line bg-card p-4 text-sm">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 space-y-1">
        {(lines.length ? lines : [empty || "—"]).map((line) => <li key={line}>{line}</li>)}
      </ul>
    </section>
  );
}
