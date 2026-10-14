import type { Metadata } from "next";
import { OpenAuthButton } from "@/components/public/open-auth-button";
import { PageFrame } from "@/components/public/page-frame";

export const metadata: Metadata = { title: "Помощь" };

const FAQ = [
  ["Нужен ли пароль?", "Да. Аккаунт создаётся с логином и паролем. Почта подтверждается вторым шагом: пока ссылка из письма не открыта, аккаунт не активен и войти нельзя."],
  ["Что будет со старыми письмами?", "Они остаются в ящике. Почтаход начинает с новых писем после подключения."],
  ["Можно ли несколько правил?", "Да. У одного ящика может быть несколько правил, и каждое создаёт своё уведомление."],
  ["Куда приходят уведомления?", "В Битрикс24, Telegram или пересылкой на адрес сотрудника — как задано в правиле."],
];

export default function HelpPage() {
  return (
    <PageFrame>
      <h1 className="text-4xl">Помощь</h1>
      <p className="mt-3 text-mist">Коротко о том, как устроен вход и разбор почты.</p>
      <div className="mt-8 space-y-4">
        {FAQ.map(([question, answer]) => (
          <article key={question} className="ph-card p-5">
            <h2 className="text-xl">{question}</h2>
            <p className="mt-2 text-copy">{answer}</p>
          </article>
        ))}
      </div>
      <div className="mt-8">
        <OpenAuthButton source="help">Подключить ящик</OpenAuthButton>
      </div>
    </PageFrame>
  );
}
