import { MailboxForm } from "@/components/mailbox-form";
import { Notice, PageTitle } from "@/components/shell";

export default async function NewMailboxPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <PageTitle title="Новый ящик" text="Выберите почтовый сервер — адреса и порты подставятся сами. Для своего сервера укажите их вручную." />
      <Notice text={params.notice} />
      <MailboxForm />
    </>
  );
}
