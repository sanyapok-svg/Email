import Link from "next/link";
import { Notice, PageTitle } from "@/components/shell";
import { getIntegrationConfig } from "@/lib/settings";
import { saveSettings } from "@/server/ops";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const config = await getIntegrationConfig();
  return (
    <>
      <PageTitle title="Настройки" text="Веб-хук хранится в зашифрованном виде. Пока режим «заглушка», сообщения в Битрикс24 не отправляются." />
      <Notice text={params.notice} />
      <form action={saveSettings} className="grid max-w-2xl gap-3">
        <label className="text-sm">Режим Битрикс24
          <select className="mt-1" name="b24Mode" defaultValue={config.b24Mode}>
            <option value="mock">заглушка</option>
            <option value="webhook">веб-хук</option>
          </select>
        </label>
        <label className="text-sm">Веб-хук
          <input className="mt-1" type="password" name="webhookUrl" placeholder={config.webhookUrlEnc ? "сохранён, введите новый чтобы заменить" : "https://..."} />
        </label>
        <label className="flex items-center gap-2 text-sm"><input style={{ width: "auto" }} type="checkbox" name="globalDryRun" defaultChecked={config.globalDryRun} /> Глобальный сухой прогон</label>
        <label className="flex items-center gap-2 text-sm"><input style={{ width: "auto" }} type="checkbox" name="includeBodyPreview" defaultChecked={config.includeBodyPreview} /> Добавлять короткое превью в уведомление</label>
        <label className="flex items-center gap-2 text-sm"><input style={{ width: "auto" }} type="checkbox" name="globalMessageDedupe" defaultChecked={config.globalMessageDedupe} /> Дедупликация уведомлений по Message-ID</label>
        <label className="text-sm">Символов превью
          <input className="mt-1" name="previewChars" defaultValue={config.previewChars} />
        </label>
        <label className="text-sm">Срок хранения, дни. Пусто — не удалять
          <input className="mt-1" name="retentionDays" defaultValue={config.retentionDays ?? ""} />
        </label>
        <label className="text-sm">Попытки уведомления
          <input className="mt-1" name="notifyMaxAttempts" defaultValue={config.notifyMaxAttempts} />
        </label>
        <label className="text-sm">Попытки ответа
          <input className="mt-1" name="replyMaxAttempts" defaultValue={config.replyMaxAttempts} />
        </label>
        <button type="submit">Сохранить настройки</button>
      </form>
      <p className="mt-8 max-w-2xl text-sm text-muted">
        Получатели уведомлений задаются в разделе <Link className="underline" href="/users">Пользователи</Link> и выбираются в правиле.
      </p>
    </>
  );
}
