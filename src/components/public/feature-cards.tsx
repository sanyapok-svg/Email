"use client";

import { IconArrow, IconHand, IconPlane, IconSearch } from "@/components/public/icons";
import { Reveal } from "@/components/public/reveal";
import { useAuth } from "@/components/public/auth-context";

const CARDS = [
  { title: "Разбирает", text: "Достаёт из текста телефоны, счета, договоры, сроки и срочность. Без внешнего языкового сервиса.", icon: IconSearch },
  { title: "Находит нужных", text: "Правило само решает, кому это письмо. Одно письмо может уйти нескольким людям сразу.", icon: IconHand },
  { title: "Доставляет", text: "Уведомление в Битрикс24, сообщение в Telegram или пересылка нужному сотруднику.", icon: IconPlane },
];

export function FeatureCards() {
  const { openAuth } = useAuth();
  return (
    <section id="features" className="scroll-mt-24 bg-white py-16 md:py-24">
      <Reveal className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl md:text-4xl">Что делает Почтаход</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <article key={card.title} className="ph-card p-6">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-canvas text-navy">
                <card.icon className="h-7 w-7" />
              </span>
              <h3 className="mt-4 text-xl">{card.title}</h3>
              <p className="mt-2 text-copy">{card.text}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button type="button" className="ph-btn ph-btn-text" onClick={() => openAuth({ mode: "register", source: "features" })}>
            Попробовать на своей почте <IconArrow className="h-4 w-4" />
          </button>
        </div>
      </Reveal>
    </section>
  );
}
