"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/public/button";
import { IconArrow } from "@/components/public/icons";
import { LogoMark } from "@/components/public/logo";
import { useAuth } from "@/components/public/auth-context";

const BEATS = [
  "Общий ящик получает всё подряд: счета, заявки, рассылки и шум.",
  "Почтаход читает только новые письма и оставляет спам закрытым.",
  "Правило решает, кому это важно: Битрикс24, Telegram или пересылка.",
  "Сотрудник получает готовое уведомление, а не весь ящик.",
];

export function Hero() {
  const { openAuth } = useAuth();
  const [tour, setTour] = useState(false);
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 md:grid-cols-2 md:gap-12 md:py-24">
      <div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl">Почтаход</h1>
        <p className="mt-3 text-xl italic text-mist">Из общего ящика — в нужные руки</p>
        <p className="mt-5 max-w-xl text-lg text-copy">
          Сервис читает новые письма общих ящиков, разбирает текст по вашим правилам и относит важное в Битрикс24, Telegram или на почту сотрудника. Остальное остаётся в ящике и не шумит.
        </p>
        <div className="ph-actions mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button" onClick={() => openAuth({ mode: "register", source: "hero-primary" })}>
            Подключить свой ящик — бесплатно
          </Button>
          <Button type="button" variant="ghost" onClick={() => setTour(true)}>
            Посмотреть за 60 секунд
          </Button>
        </div>
        <p className="mt-4 text-sm text-mist">IMAP только на чтение. Письма не меняются и не удаляются. Подключение занимает около пяти минут.</p>
      </div>
      <MailPath />
      {tour ? <Tour onClose={() => setTour(false)} /> : null}
    </section>
  );
}

function MailPath() {
  return (
    <div className="mail-flow ph-card relative overflow-hidden p-4 sm:p-6" aria-hidden="true">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="env-dim flex flex-row gap-2 sm:flex-col">
          <Envelope tone="gray" />
          <Envelope tone="gray" />
          <Envelope tone="gray" />
        </div>
        <div className="hidden h-16 w-px shrink-0 border-l-2 border-dashed border-ember sm:block" />
        <div className="h-px w-16 border-t-2 border-dashed border-ember sm:hidden" />
        <div className="env-pass">
          <Envelope tone="live" />
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:gap-3">
          <Channel className="channel" label="Битрикс24" glyph="24" />
          <Channel className="channel channel-2" label="Telegram" glyph="✈" />
          <Channel className="channel channel-3" label="Пересылка" glyph="→" />
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-mist">Серые письма растворяются. Важное проходит фильтр и расходится по каналам.</p>
    </div>
  );
}

function Envelope({ tone }: { tone: "gray" | "live" }) {
  const stroke = tone === "live" ? "#1E3A5F" : "#94A3B8";
  return (
    <svg viewBox="0 0 72 48" className="h-10 w-14 sm:h-12 sm:w-16">
      <rect x="2" y="6" width="68" height="36" rx="6" fill={tone === "live" ? "#FFF7ED" : "#F8FAFC"} stroke={stroke} strokeWidth="2" />
      <path d="M6 12 36 30 66 12" fill="none" stroke={tone === "live" ? "#F97316" : stroke} strokeWidth="2" />
    </svg>
  );
}

function Channel({ label, glyph, className }: { label: string; glyph: string; className: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm font-semibold text-navy ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-ember">{glyph}</span>
      {label}
    </div>
  );
}

function Tour({ onClose }: { onClose: () => void }) {
  const { openAuth } = useAuth();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((value) => (value + 1) % BEATS.length), 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/50 p-4" onMouseDown={onClose}>
      <div className="ph-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="tour-title" onMouseDown={(event) => event.stopPropagation()}>
        <LogoMark className="h-12 w-12" />
        <p className="mt-4 text-sm font-semibold text-ember">Шаг {step + 1} из 4 · около 60 секунд</p>
        <h2 id="tour-title" className="mt-2 text-2xl">Как письмо находит адресата</h2>
        <p className="mt-3 text-copy">{BEATS[step]}</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-canvas">
          <div className="h-full bg-ember transition-all duration-300" style={{ width: `${((step + 1) / BEATS.length) * 100}%` }} />
        </div>
        <div className="ph-actions mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button" onClick={() => { onClose(); openAuth({ mode: "register", source: "tour" }); }}>
            Подключить ящик
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStep((value) => (value + 1) % BEATS.length)}>
            Дальше <IconArrow className="h-4 w-4" />
          </Button>
          <button type="button" className="ph-btn ph-btn-text" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
