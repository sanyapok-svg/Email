"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RussianDateField } from "@/components/russian-date-field";
import { labelStatus } from "@/lib/labels";

const DECISIONS = ["exclude", "notify", "skipped_no_rule", "error"];

export function MessageSearch({
  mailboxes,
  values,
}: {
  mailboxes: { id: string; name: string }[];
  values: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const activeCount = FILTER_KEYS.filter((key) => values[key]).length;
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [generation, setGeneration] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const filters: Record<string, string | undefined> = cleared ? {} : values;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function resetFilters() {
    const field = formRef.current?.elements.namedItem("q");
    const query = field instanceof HTMLInputElement ? field.value.trim() : "";
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    setCleared(true);
    setGeneration((current) => current + 1);
    setOpen(false);
    const next = params.toString();
    router.push(next ? `/messages?${next}` : "/messages");
  }

  return (
    <form ref={formRef} className="relative mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="min-w-48 flex-1" name="q" defaultValue={values.q || ""} placeholder="Слова из темы или текста" />
        <button type="button" className="secondary shrink-0" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          Фильтры{activeCount ? ` · ${activeCount}` : ""}
        </button>
        {!open && activeCount > 0 ? (
          <button type="button" className="secondary shrink-0" onClick={resetFilters}>
            Сбросить
          </button>
        ) : null}
        <button type="submit" className="shrink-0">
          Найти
        </button>
      </div>
      <div className="message-filters" hidden={!open}>
        <div key={generation} className="grid gap-2 md:grid-cols-4">
          <select name="mailboxId" defaultValue={filters.mailboxId || ""} aria-label="Ящик">
            <option value="">все ящики</option>
            {mailboxes.map((mailbox) => (
              <option key={mailbox.id} value={mailbox.id}>
                {mailbox.name}
              </option>
            ))}
          </select>
          <input name="from" defaultValue={filters.from || ""} placeholder="Отправитель" />
          <input name="domain" defaultValue={filters.domain || ""} placeholder="Домен" />
          <input name="phone" defaultValue={filters.phone || ""} placeholder="Телефон" />
          <input name="email" defaultValue={filters.email || ""} placeholder="Email из текста" />
          <input name="contract" defaultValue={filters.contract || ""} placeholder="Договор" />
          <input name="invoice" defaultValue={filters.invoice || ""} placeholder="Счёт" />
          <select name="decision" defaultValue={filters.decision || ""} aria-label="Решение">
            <option value="">любое решение</option>
            {DECISIONS.map((item) => (
              <option key={item} value={item}>
                {labelStatus(item)}
              </option>
            ))}
          </select>
          <select name="sentiment" defaultValue={filters.sentiment || ""} aria-label="Тональность">
            <option value="">любая тональность</option>
            {["positive", "neutral", "negative", "mixed"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select name="urgency" defaultValue={filters.urgency || ""} aria-label="Срочность">
            <option value="">любая срочность</option>
            {["low", "normal", "high", "critical"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <RussianDateField name="fromDate" label="Дата с" defaultValue={filters.fromDate || ""} />
          <RussianDateField name="toDate" label="Дата по" defaultValue={filters.toDate || ""} align="end" />
          <select name="language" defaultValue={filters.language || ""} aria-label="Язык">
            <option value="">любой язык</option>
            <option value="ru">ru</option>
            <option value="en">en</option>
            <option value="mixed">mixed</option>
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="secondary" onClick={resetFilters}>
            Сбросить фильтры
          </button>
        </div>
      </div>
    </form>
  );
}

const FILTER_KEYS = [
  "mailboxId",
  "from",
  "domain",
  "phone",
  "email",
  "contract",
  "invoice",
  "decision",
  "sentiment",
  "urgency",
  "language",
  "fromDate",
  "toDate",
];
