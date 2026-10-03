import Link from "next/link";
import { MailboxMessages, type MessageRow } from "@/components/mailbox-messages";
import { MessageSearch } from "@/components/message-search";
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
      <PageTitle title="Письма" text="Письма собраны под своим ящиком, список можно свернуть. Поиск идёт по уже сохранённому тексту и не запускает новую обработку." />
      <Notice text={params.notice} />
      <MessageSearch key={searchKey(params)} mailboxes={mailboxes} values={params} />
      <MessageGroups messages={messages} />
    </>
  );
}

function searchKey(params: Record<string, string | undefined>): string {
  return ["q", "mailboxId", "from", "domain", "phone", "email", "contract", "invoice", "decision", "sentiment", "urgency", "language", "fromDate", "toDate"]
    .map((key) => params[key] || "")
    .join("\0");
}

function MessageGroups({ messages }: { messages: Awaited<ReturnType<typeof searchMessages>> }) {
  const groups = new Map<string, { id: string; name: string; address: string; items: MessageRow[] }>();
  for (const message of messages) {
    const group = groups.get(message.mailboxId) ?? {
      id: message.mailboxId,
      name: message.mailbox.name,
      address: message.mailbox.address,
      items: [],
    };
    group.items.push({
      id: message.id,
      receivedAt: message.receivedAt.toLocaleString("ru-RU"),
      subject: message.subject || "(без темы)",
      truncated: message.bodyTruncated,
      fromEmail: message.fromEmail,
      decision: labelStatus(message.decision),
      ruleName: message.matchedRule?.name ?? null,
      entities: [message.phonesNormalized[0], message.contractNumbers[0], message.invoiceNumbers[0], message.urgencyLevel].filter(Boolean).join(" · ") || "—",
    });
    groups.set(message.mailboxId, group);
  }
  const mailboxes = [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  if (mailboxes.length === 0) {
    return <p className="rounded-xl border border-dashed border-line bg-card px-4 py-6 text-sm">Писем пока нет.</p>;
  }
  return (
    <div className="grid gap-5">
      {mailboxes.map((mailbox) => (
        <section key={mailbox.id} id={`mailbox-${mailbox.id}`} className="overflow-hidden rounded-xl border border-line bg-card">
          <header className="px-4 py-4 sm:px-5">
            <Link className="text-lg font-semibold underline" href={`/mailboxes/${mailbox.id}`}>
              {mailbox.name}
            </Link>
            <p className="mt-0.5 text-sm text-muted">{mailbox.address}</p>
          </header>
          <MailboxMessages panelId={`mailbox-${mailbox.id}`} items={mailbox.items} />
        </section>
      ))}
    </div>
  );
}
