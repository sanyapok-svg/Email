import Link from "next/link";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";
import { searchMessages } from "@/lib/search/messages";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [mailboxes, messages] = await Promise.all([
    prisma.mailbox.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    searchMessages({
      q: params.q,
      mailboxId: params.mailboxId,
      from: params.from,
      domain: params.domain,
      decision: params.decision,
      phone: params.phone,
      email: params.email,
      contract: params.contract,
      invoice: params.invoice,
      language: params.language,
      sentiment: params.sentiment,
      urgency: params.urgency,
      fromDate: params.fromDate,
      toDate: params.toDate,
    }),
  ]);
  return (
    <>
      <PageTitle title="Письма" text="Поиск идёт по уже сохранённому тексту и не запускает новую обработку." />
      <Notice text={params.notice} />
      <form className="mb-4 grid gap-2 md:grid-cols-4">
        <input name="q" defaultValue={params.q || ""} placeholder="Слова из темы или текста" />
        <select name="mailboxId" defaultValue={params.mailboxId || ""}>
          <option value="">все ящики</option>
          {mailboxes.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.name}</option>)}
        </select>
        <input name="from" defaultValue={params.from || ""} placeholder="Отправитель" />
        <input name="domain" defaultValue={params.domain || ""} placeholder="Домен" />
        <input name="phone" defaultValue={params.phone || ""} placeholder="Телефон" />
        <input name="email" defaultValue={params.email || ""} placeholder="Email из текста" />
        <input name="contract" defaultValue={params.contract || ""} placeholder="Договор" />
        <input name="invoice" defaultValue={params.invoice || ""} placeholder="Счёт" />
        <select name="decision" defaultValue={params.decision || ""}>
          <option value="">любое решение</option>
          {["exclude", "notify", "reply_only", "notify_and_reply", "skipped_no_rule", "error"].map((item) => <option key={item} value={item}>{labelStatus(item)}</option>)}
        </select>
        <select name="sentiment" defaultValue={params.sentiment || ""}>
          <option value="">любая тональность</option>
          {["positive", "neutral", "negative", "mixed"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select name="urgency" defaultValue={params.urgency || ""}>
          <option value="">любая срочность</option>
          {["low", "normal", "high", "critical"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select name="language" defaultValue={params.language || ""}>
          <option value="">любой язык</option>
          <option value="ru">ru</option>
          <option value="en">en</option>
          <option value="mixed">mixed</option>
        </select>
        <input type="date" name="fromDate" defaultValue={params.fromDate || ""} />
        <input type="date" name="toDate" defaultValue={params.toDate || ""} />
        <button type="submit">Найти</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тема</th>
              <th>Отправитель</th>
              <th>Решение</th>
              <th>Сущности</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr key={message.id}>
                <td>{message.receivedAt.toLocaleString("ru-RU")}</td>
                <td>
                  <Link className="underline" href={`/messages/${message.id}`}>{message.subject || "(без темы)"}</Link>
                  <div className="text-xs text-muted">{message.mailbox.name}{message.bodyTruncated ? " · текст обрезан" : ""}</div>
                </td>
                <td>{message.fromEmail}</td>
                <td>{labelStatus(message.decision)}<div className="text-xs text-muted">{message.matchedRule?.name || ""}</div></td>
                <td className="text-xs">{[message.phonesNormalized[0], message.contractNumbers[0], message.invoiceNumbers[0], message.urgencyLevel].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
