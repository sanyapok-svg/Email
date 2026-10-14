"use client";

import { Button } from "@/components/public/button";
import { Reveal } from "@/components/public/reveal";
import { useAuth } from "@/components/public/auth-context";

const STEPS = [
  { title: "Подключаете ящик", text: "Адрес, пароль приложения и расписание проверок. Исторические письма не забираем." },
  { title: "Настраиваете правила", text: "Условие, получатели и состав уведомления. Можно несколько правил на один ящик." },
  { title: "Почтаход разбирает поток", text: "Новые письма читаются по расписанию. Спам не открывается." },
  { title: "Сотрудники получают уведомления", text: "В Битрикс24, Telegram или письмом — только то, что подошло под правило." },
];

export function HowItWorks() {
  const { openAuth } = useAuth();
  return (
    <section id="how" className="scroll-mt-24 py-16 md:py-24">
      <Reveal className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl md:text-4xl">Как это работает</h2>
        <ol className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <span className="absolute left-[8%] right-[8%] top-6 hidden border-t-2 border-dashed border-ember lg:block" aria-hidden="true" />
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full bg-ember text-lg font-extrabold text-white">{index + 1}</span>
              <h3 className="mt-4 text-lg">{step.title}</h3>
              <p className="mt-2 text-sm text-copy">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="ph-actions mt-10 sm:text-center">
          <Button type="button" onClick={() => openAuth({ mode: "register", source: "how" })}>
            Пройти эти 4 шага со своим ящиком
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
