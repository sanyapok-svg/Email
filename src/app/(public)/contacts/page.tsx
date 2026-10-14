import type { Metadata } from "next";
import { OpenAuthButton } from "@/components/public/open-auth-button";
import { PageFrame, TextLink } from "@/components/public/page-frame";

export const metadata: Metadata = { title: "Контакты" };

export default function ContactsPage() {
  return (
    <PageFrame>
      <h1 className="text-4xl">Контакты</h1>
      <p className="mt-4 text-copy">
        Напишите через аккаунт: так мы увидим, какой ящик уже подключён. Если аккаунта ещё нет, создайте его логином и паролем и подтвердите почту.
      </p>
      <p className="mt-3 text-copy">
        Ответы на частые вопросы собраны в разделе <TextLink href="/help">«Помощь»</TextLink>.
      </p>
      <div className="mt-8">
        <OpenAuthButton source="contacts">Создать аккаунт и написать</OpenAuthButton>
      </div>
    </PageFrame>
  );
}
