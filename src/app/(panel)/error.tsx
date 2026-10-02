"use client";

export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const database = /database|prisma|5432/i.test(error.message);
  return (
    <section className="max-w-xl rounded-xl border border-line bg-card p-5">
      <h1 className="text-xl font-semibold">{database ? "База данных недоступна" : "Не удалось открыть раздел"}</h1>
      <p className="mt-2 text-sm text-muted">
        {database
          ? "PostgreSQL не отвечает. Проверьте DATABASE_URL и что миграции применены: npx prisma migrate deploy."
          : "Обновите страницу. Если сообщение повторится, посмотрите терминал, где запущен сервер."}
      </p>
      <button className="mt-4" type="button" onClick={() => reset()}>
        Повторить
      </button>
    </section>
  );
}
