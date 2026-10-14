"use client";

import { Button } from "@/components/public/button";
import { Reveal } from "@/components/public/reveal";
import { useAuth } from "@/components/public/auth-context";

const CHANNELS = [
  {
    key: "b24",
    title: "Битрикс24",
    text: "Карточка в мессенджере: тема, отправитель, срок и другие поля, которые вы включили в правило.",
    glyph: "24",
  },
  {
    key: "tg",
    title: "Telegram",
    text: "Короткое сообщение туда, где сотрудник уже отвечает. Удобно для дежурств и быстрых заявок.",
    glyph: "✈",
  },
  {
    key: "fwd",
    title: "Пересылка",
    text: "Копия письма на адрес или сотруднику. Исходное письмо в ящике остаётся на месте.",
    glyph: "→",
  },
];

export function Channels() {
  const { openAuth } = useAuth();
  return (
    <section id="channels" className="scroll-mt-24 bg-white py-16 md:py-24">
      <Reveal className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl md:text-4xl">Три способа доставить важное письмо</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((channel) => (
            <article key={channel.key} className="ph-card flex flex-col p-6">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#fff7ed] text-lg font-extrabold text-ember">{channel.glyph}</span>
              <h3 className="mt-4 text-xl">{channel.title}</h3>
              <p className="mt-2 flex-1 text-copy">{channel.text}</p>
              {channel.key === "tg" ? (
                <Button className="mt-5" block type="button" onClick={() => openAuth({ mode: "register", source: "telegram", intent: "Хочу тестовое уведомление в свой Telegram" })}>
                  Получить тестовое уведомление в свой Telegram
                </Button>
              ) : (
                <button type="button" className="ph-btn ph-btn-text mt-5 justify-start" onClick={() => openAuth({ mode: "register", source: channel.key, intent: "Выберу каналы при подключении ящика" })}>
                  Выбрать свои каналы при подключении
                </button>
              )}
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
