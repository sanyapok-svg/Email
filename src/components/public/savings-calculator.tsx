"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/public/button";
import { Reveal } from "@/components/public/reveal";
import { useAuth } from "@/components/public/auth-context";

const MINUTES = 1.5;
const LEFT = 0.2;

export function SavingsCalculator() {
  const { openAuth } = useAuth();
  const [emails, setEmails] = useState(80);
  const [people, setPeople] = useState(4);
  const saved = useMemo(() => {
    const before = emails * people * MINUTES;
    const after = emails * LEFT * MINUTES;
    return Math.max(0, before - after) / 60;
  }, [emails, people]);
  const perMonth = saved * 21;

  return (
    <section id="pricing" className="scroll-mt-24 py-16 md:py-24">
      <Reveal className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-3xl md:text-4xl">Что меняется после подключения</h2>
        <p className="mt-3 text-center text-mist">Старт бесплатный. Ниже — оценка времени, которое ящик перестаёт отнимать у команды.</p>
        <div className="ph-card mt-8 p-4 sm:p-6">
          <Slider label="Писем в день" min={5} max={500} value={emails} onChange={setEmails} />
          <Slider label="Сотрудников на разборе" min={1} max={30} value={people} onChange={setPeople} />
          <p className="mt-6 text-center text-sm text-mist">
            Считаем 1,5 минуты на просмотр письма. После правил общий разбор не нужен: остаётся около 20% писем, и ими занимается один человек.
          </p>
          <p className="mt-4 text-center text-3xl font-extrabold text-navy sm:text-4xl">
            {formatHours(saved)} <span className="text-lg font-semibold text-mist">в день</span>
          </p>
          <p className="text-center text-copy">около {formatHours(perMonth)} за рабочий месяц</p>
          <Button className="mt-6" block type="button" onClick={() => openAuth({ mode: "register", source: "calculator" })}>
            Забрать это время — создать аккаунт
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  const id = label;
  return (
    <label className="mt-4 block text-sm font-semibold text-navy" htmlFor={id}>
      <span className="flex items-center justify-between gap-3">
        {label}
        <span className="text-base font-extrabold">{value}</span>
      </span>
      <input id={id} className="mt-2" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function formatHours(value: number): string {
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} мин`;
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${text} ч`;
}
