import Link from "next/link";
import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { labelStatus } from "@/lib/labels";
import { moveRule } from "@/server/rules";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ mailboxId?: string; notice?: string }> }) {
  const params = await searchParams;
  const mailboxes = await prisma.mailbox.findMany({ orderBy: { name: "asc" } });
  const mailboxId = params.mailboxId || mailboxes[0]?.id;
  const rules = mailboxId ? await prisma.rule.findMany({ where: { mailboxId }, orderBy: { position: "asc" } }) : [];
  return (
    <>
      <PageTitle title="Правила" text="Проверка идёт сверху вниз. Первое совпадение останавливает остальные, поэтому исключения стоят выше уведомлений." />
      <Notice text={params.notice} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {mailboxes.map((mailbox) => (
          <Link key={mailbox.id} className={`button secondary ${mailbox.id === mailboxId ? "border-pine" : ""}`} href={`/rules?mailboxId=${mailbox.id}`}>
            {mailbox.name}
          </Link>
        ))}
        <Link className="button" href={`/rules/new?mailboxId=${mailboxId || ""}`}>Новое правило</Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr>
              <th>Позиция</th>
              <th>Название</th>
              <th>Тип</th>
              <th>Состояние</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.position}</td>
                <td><Link className="underline" href={`/rules/${rule.id}`}>{rule.name}</Link></td>
                <td>{rule.type === "exclude" ? "исключение" : "уведомление"}</td>
                <td>{rule.active ? "активно" : "выключено"}{rule.dryRun ? `, ${labelStatus("dry_run")}` : ""}</td>
                <td className="flex gap-2">
                  <form action={moveRule}><input type="hidden" name="id" value={rule.id} /><input type="hidden" name="direction" value="up" /><button className="secondary" type="submit">Выше</button></form>
                  <form action={moveRule}><input type="hidden" name="id" value={rule.id} /><input type="hidden" name="direction" value="down" /><button className="secondary" type="submit">Ниже</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
