import Link from "next/link";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";

export default async function RepliesPage({ searchParams }: { searchParams: Promise<{ notice?: string; status?: string }> }) {
  const params = await searchParams;
  const items = await prisma.outboundReply.findMany({
    where: { status: params.status || undefined },
    include: { mailbox: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageTitle title="Ответы" text="Автоматические и ручные ответы уходят через SMTP и не меняют входящие письма." />
      <Notice text={params.notice} />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table>
          <thead><tr><th>Когда</th><th>Кому</th><th>Тема</th><th>Статус</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><Link className="underline" href={`/replies/${item.id}`}>{item.createdAt.toLocaleString("ru-RU")}</Link></td>
                <td>{item.toAddress}<div className="text-xs text-muted">{item.kind} · {item.mailbox.name}</div></td>
                <td>{item.subject}</td>
                <td>{labelStatus(item.status)}{item.suppressedReason ? ` · ${item.suppressedReason}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
