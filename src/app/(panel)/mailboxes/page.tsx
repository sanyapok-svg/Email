import Link from "next/link";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";

export default async function MailboxesPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const mailboxes = await prisma.mailbox.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { rules: true, messages: true } } } });
  return (
    <>
      <PageTitle title="Ящики" text="У каждого ящика свои правила, часы и настройки ответов. При первой активации старые письма не читаются." />
      <Notice text={params.notice} />
      <Link className="button inline-block" href="/mailboxes/new">Новый ящик</Link>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Адрес</th>
              <th>Правила</th>
              <th>Письма</th>
              <th>Ошибки подряд</th>
            </tr>
          </thead>
          <tbody>
            {mailboxes.map((mailbox) => (
              <tr key={mailbox.id}>
                <td><Link className="underline" href={`/mailboxes/${mailbox.id}`}>{mailbox.name}</Link></td>
                <td>{mailbox.address}</td>
                <td>{mailbox._count.rules}</td>
                <td>{mailbox._count.messages}</td>
                <td>{mailbox.consecutiveErrors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
