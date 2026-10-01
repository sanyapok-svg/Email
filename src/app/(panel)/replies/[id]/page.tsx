import { notFound } from "next/navigation";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";
import { retryReply } from "@/server/ops";

export default async function ReplyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const item = await prisma.outboundReply.findUnique({ where: { id } });
  if (!item) notFound();
  return (
    <>
      <PageTitle title={item.subject} text={`${item.toAddress} · ${labelStatus(item.status)}`} />
      <Notice text={query.notice} />
      <p className="mb-3 text-sm">In-Reply-To: {item.inReplyTo || "нет, будет предупреждение"}. {item.lastError || item.suppressedReason || ""}</p>
      <pre className="whitespace-pre-wrap rounded-xl border border-line bg-card p-4 text-sm">{item.bodyText}</pre>
      {item.status === "error" ? (
        <form className="mt-4" action={retryReply}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit">Повторить отправку</button>
        </form>
      ) : null}
    </>
  );
}
