"use client";

import { useEffect, useId, useRef, useState } from "react";

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function RussianDateField({
  name,
  label,
  defaultValue = "",
  align = "start",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  align?: "start" | "end";
}) {
  const initial = parseIso(defaultValue);
  const [value, setValue] = useState<Date | null>(initial);
  const [text, setText] = useState(initial ? formatRu(initial) : "");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfMonth(initial ?? new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  function choose(day: Date) {
    setValue(day);
    setText(formatRu(day));
    setView(startOfMonth(day));
    setOpen(false);
  }

  function onText(next: string) {
    setText(next);
    const parsed = parseRu(next);
    setValue(parsed);
    if (parsed) setView(startOfMonth(parsed));
  }

  const year = view.getFullYear();
  const month = view.getMonth();
  const leading = weekdayIndex(new Date(year, month, 1));
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  return (
    <div className="date-field" ref={rootRef}>
      <input type="hidden" name={name} value={value ? formatIso(value) : ""} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="дд.мм.гггг"
        aria-label={label}
        value={text}
        onChange={(event) => onText(event.target.value)}
        onFocus={() => setOpen(true)}
      />
      <button
        type="button"
        className="date-field-toggle"
        aria-label={`${label}: открыть календарь`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarIcon />
      </button>
      {open ? (
        <div id={dialogId} className={`date-popover${align === "end" ? " end" : ""}`} role="dialog" aria-label={label}>
          <div className="date-popover-head">
            <button type="button" aria-label="Предыдущий месяц" onClick={() => setView(new Date(year, month - 1, 1))}>
              ‹
            </button>
            <span>
              {MONTHS[month]} {year}
            </span>
            <button type="button" aria-label="Следующий месяц" onClick={() => setView(new Date(year, month + 1, 1))}>
              ›
            </button>
          </div>
          <div className="date-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-days">
            {Array.from({ length: leading }, (_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = new Date(year, month, index + 1);
              const selected = value ? sameDay(day, value) : false;
              const isToday = sameDay(day, today);
              return (
                <button
                  key={index + 1}
                  type="button"
                  className={selected ? "selected" : isToday ? "today" : undefined}
                  aria-label={formatRu(day)}
                  aria-pressed={selected}
                  onClick={() => choose(day)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="date-today"
            onClick={() => choose(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
          >
            Сегодня
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.2h13M5 1.2v2.6M11 1.2v2.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function formatIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatRu(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function parseRu(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

function validDate(year: number, month: number, day: number): Date | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}
