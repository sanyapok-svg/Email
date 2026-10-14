import type { Metadata } from "next";
import { PageFrame, TextLink } from "@/components/public/page-frame";

export const metadata: Metadata = { title: "Условия" };

export default function TermsPage() {
  return (
    <PageFrame>
      <h1 className="text-4xl">Условия использования</h1>
      <div className="mt-6 space-y-4 text-copy">
        <p>Аккаунт создаётся с логином и паролем. Он не активен, пока вы не подтвердите почту по ссылке из письма. Дальше вход только по логину и паролю. Вы отвечаете за то, что подключаете ящик, которым имеете право пользоваться.</p>
        <p>Правила уведомлений настраиваете вы. Почтаход доставляет только то, что подошло под включённое правило, и не принимает решений вместо компании.</p>
        <p>Сервис не обещает доставку, если почтовый сервер, Битрикс24 или Telegram недоступны. Письма в исходном ящике при этом не изменяются.</p>
        <p>
          Как устроены данные — в <TextLink href="/privacy">политике конфиденциальности</TextLink>.
        </p>
      </div>
    </PageFrame>
  );
}
