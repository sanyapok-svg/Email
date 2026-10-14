"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/public/button";
import { Reveal } from "@/components/public/reveal";
import { useAuth } from "@/components/public/auth-context";

const WHEN = [
  { id: "invoice", label: "счёт или сумма" },
  { id: "contract", label: "договор" },
  { id: "request", label: "заявка" },
  { id: "any", label: "любое новое письмо" },
];

const FROM = [
  { id: "client", label: "от клиента" },
  { id: "domain", label: "с нашего домена" },
  { id: "any", label: "от кого угодно" },
];

const TO = [
  { id: "b24", label: "уведомление в Битрикс24" },
  { id: "tg", label: "сообщение в Telegram" },
  { id: "fwd", label: "пересылку сотруднику" },
];

export function RuleSimulator() {
  const { openAuth } = useAuth();
  const [when, setWhen] = useState(WHEN[0].id);
  const [from, setFrom] = useState(FROM[0].id);
  const [to, setTo] = useState(TO[0].id);
  const preview = useMemo(() => {
    const whenLabel = WHEN.find((item) => item.id === when)?.label;
    const fromLabel = FROM.find((item) => item.id === from)?.label;
    const toLabel = TO.find((item) => item.id === to)?.label;
    return `Если в письме есть «${whenLabel}» и оно ${fromLabel} — отправить ${toLabel}.`;
  }, [when, from, to]);

  return (
    <section className="py-16 md:py-24">
      <Reveal className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl md:text-4xl">Никакого программирования</h2>
          <p className="mt-3 text-copy">Правило собирается из условий и канала. Ниже тот же конструктор, только в миниатюре: выберите три пункта и сразу увидите формулировку.</p>
          <RuleSketch />
        </div>
        <div className="ph-card p-4 sm:p-6">
          <label className="block text-sm font-semibold text-navy">
            Если в письме есть
            <select className="mt-1" value={when} onChange={(event) => setWhen(event.target.value)}>
              {WHEN.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-semibold text-navy">
            И письмо
            <select className="mt-1" value={from} onChange={(event) => setFrom(event.target.value)}>
              {FROM.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="mt-4 block text-sm font-semibold text-navy">
            Тогда отправить
            <select className="mt-1" value={to} onChange={(event) => setTo(event.target.value)}>
              {TO.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <p className="mt-5 rounded-lg bg-canvas px-4 py-3 text-copy" aria-live="polite">{preview}</p>
          <Button className="mt-5" block type="button" onClick={() => openAuth({ mode: "register", source: "simulator", intent: preview })}>
            Сохранить это правило в свой аккаунт
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

function RuleSketch() {
  return (
    <div className="ph-card mt-6 p-4" aria-hidden="true">
      <div className="flex items-center justify-between text-xs font-semibold text-mist">
        <span>Конструктор правил</span>
        <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-ember">черновик</span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-8 rounded-lg bg-canvas" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded-lg border border-dashed border-ember/50" />
          <div className="h-16 rounded-lg bg-canvas" />
          <div className="h-16 rounded-lg bg-canvas" />
        </div>
        <div className="h-10 rounded-lg bg-navy/5" />
      </div>
    </div>
  );
}
