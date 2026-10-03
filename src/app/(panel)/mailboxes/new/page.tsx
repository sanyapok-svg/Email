import { MailboxForm } from "@/components/mailbox-form";
import { Notice, PageTitle } from "@/components/shell";

export default async function NewMailboxPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <PageTitle title="Новый ящик" text="Для Yandex 360 обычно нужны imap.yandex.com:993 и пароль приложения." />
      <Notice text={params.notice} />
      <MailboxForm />
    </>
  );
}
