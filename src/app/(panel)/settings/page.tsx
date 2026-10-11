import Link from "next/link";
import { requireAccount } from "@/lib/auth/account";
import { Notice, PageTitle } from "@/components/shell";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getIntegrationConfig } from "@/lib/settings";
import { fetchTelegramChats, type TelegramChat } from "@/lib/telegram/bot";
import { saveSettings } from "@/server/ops";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string; lookup?: string }> }) {
  const params = await searchParams;
  const { accountId, accountName } = await requireAccount();
  const config = await getIntegrationConfig(accountId);
  const telegramLookup = params.lookup === "telegram" ? await lookupTelegram(config.telegramBotTokenEnc) : null;
  return (
    <>
      <PageTitle title="Настройки" text={`Подключения аккаунта «${accountName}». Веб-хук и токен бота хранятся в зашифрованном виде.`} />
      <Notice text={params.notice} />
      <form action={saveSettings} className="grid max-w-2xl gap-3">
        <h2 className="font-semibold">Битрикс24</h2>
        <label className="text-sm">Режим Битрикс24
          <select className="mt-1" name="b24Mode" defaultValue={config.b24Mode}>
            <option value="mock">заглушка</option>
            <option value="webhook">веб-хук</option>
          </select>
        </label>
        <label className="text-sm">Веб-хук
          <input className="mt-1" type="password" name="webhookUrl" placeholder={config.webhookUrlEnc ? "сохранён, введите новый чтобы заменить" : "https://..."} />
        </label>
        <h2 className="mt-4 font-semibold">Telegram</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>В Telegram откройте @BotFather и отправьте команду /newbot.</li>
          <li>Задайте имя и username бота. В ответ придёт токен вида 123456789:AAH…</li>
          <li>Вставьте токен ниже и сохраните настройки.</li>
          <li>Сотрудник открывает этого бота и нажимает Start. Пока он этого не сделает, бот не сможет ему написать.</li>
          <li>Нажмите «Найти чаты» и скопируйте chat id в карточку сотрудника.</li>
          <li>В правиле выберите тип уведомления «Telegram».</li>
        </ol>
        <label className="text-sm">Токен бота
          <input className="mt-1" type="password" name="telegramBotToken" autoComplete="off" placeholder={config.telegramBotTokenEnc ? "сохранён, введите новый чтобы заменить" : "123456789:AAH…"} />
        </label>
        <label className="flex items-center gap-2 text-sm"><input style={{ width: "auto" }} type="checkbox" name="globalMessageDedupe" defaultChecked={config.globalMessageDedupe} /> Дедупликация уведомлений по Message-ID</label>
        <label className="text-sm">Попытки уведомления
          <input className="mt-1" name="notifyMaxAttempts" defaultValue={config.notifyMaxAttempts} />
        </label>
        <button type="submit">Сохранить настройки</button>
      </form>
      <div className="mt-4 max-w-2xl">
        <a className="button secondary inline-block" href="/settings?lookup=telegram">Найти чаты</a>
        {telegramLookup ? <TelegramChats result={telegramLookup} /> : null}
      </div>
      <p className="mt-8 max-w-2xl text-sm text-muted">
        Получатели задаются в разделе <Link className="underline" href="/b24-users">Сотрудники</Link>. В правиле выбирается, уйдёт уведомление в Битрикс24 или в Telegram.
      </p>
    </>
  );
}

function TelegramChats({ result }: { result: { ok: true; chats: TelegramChat[] } | { ok: false; error: string } }) {
  if (!result.ok) return <p className="mt-3 text-sm text-clay">{result.error}</p>;
  if (!result.chats.length) {
    return <p className="mt-3 text-sm">Бот ещё ни от кого не получал сообщений. Пусть сотрудник нажмёт Start и нажмите «Найти чаты» ещё раз.</p>;
  }
  return (
    <ul className="mt-3 grid gap-1 text-sm">
      {result.chats.map((chat) => (
        <li key={chat.id}>
          {chat.title} — <span className="font-medium">{chat.id}</span>
        </li>
      ))}
    </ul>
  );
}

async function lookupTelegram(encrypted: string | null) {
  if (!encrypted) return { ok: false as const, error: "Сначала сохраните токен бота" };
  return fetchTelegramChats(decryptSecret(encrypted));
}
