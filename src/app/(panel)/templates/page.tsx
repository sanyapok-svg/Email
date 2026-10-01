import { Notice, PageTitle } from "@/components/shell";
import { prisma } from "@/lib/db";
import { saveTemplate } from "@/server/ops";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ notice?: string; mailboxId?: string }> }) {
  const params = await searchParams;
  const mailboxes = await prisma.mailbox.findMany({ orderBy: { name: "asc" } });
  const mailboxId = params.mailboxId || mailboxes[0]?.id || "";
  const templates = mailboxId ? await prisma.replyTemplate.findMany({ where: { mailboxId }, orderBy: { name: "asc" } }) : [];
  return (
    <>
      <PageTitle title="Шаблоны ответов" text="Подставляются только известные переменные. Произвольный код в шаблоне не выполняется." />
      <Notice text={params.notice} />
      <form action={saveTemplate} className="mb-6 grid gap-3 rounded-xl border border-line bg-card p-4">
        <select name="mailboxId" defaultValue={mailboxId}>
          {mailboxes.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.name}</option>)}
        </select>
        <input name="name" placeholder="Название шаблона" required />
        <textarea name="bodyText" rows={6} placeholder={"Здравствуйте, {{from_name}}.\nМы получили письмо «{{subject}}»."} required />
        <input type="hidden" name="active" value="on" />
        <button type="submit">Добавить шаблон</button>
      </form>
      <div className="grid gap-3">
        {templates.map((template) => (
          <form key={template.id} action={saveTemplate} className="grid gap-2 rounded-xl border border-line bg-card p-4">
            <input type="hidden" name="id" value={template.id} />
            <input type="hidden" name="mailboxId" value={template.mailboxId} />
            <input name="name" defaultValue={template.name} />
            <textarea name="bodyText" rows={5} defaultValue={template.bodyText} />
            <label className="flex items-center gap-2 text-sm"><input style={{ width: "auto" }} type="checkbox" name="active" defaultChecked={template.active} /> активен</label>
            <button className="secondary" type="submit">Обновить</button>
          </form>
        ))}
      </div>
    </>
  );
}
