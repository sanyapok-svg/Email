"use client";

import { useState } from "react";
import {
  collapseHolidayRanges,
  expandHolidayRanges,
  formatHolidayRu,
  mergeHolidayRanges,
  parseHolidayList,
  type HolidayRange,
} from "@/lib/mail/holidays";

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

export function HolidayRanges({ defaultValue }: { defaultValue: string }) {
  const [ranges, setRanges] = useState<HolidayRange[]>(() => collapseHolidayRanges(parseHolidayList(defaultValue)));
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [draft, setDraft] = useState<HolidayRange | null>(null);
  const [view, setView] = useState(() => monthStart(collapseHolidayRanges(parseHolidayList(defaultValue))[0]?.start ?? todayIso()));

  const stored = expandHolidayRanges(ranges).join(",");
  const preview = !draft && pending && hover ? (pending <= hover ? { start: pending, end: hover } : { start: hover, end: pending }) : null;
  const highlight = draft ?? preview;

  function pick(iso: string) {
    if (draft) return;
    if (!pending) {
      setPending(iso);
      setHover(iso);
      return;
    }
    setDraft(pending <= iso ? { start: pending, end: iso } : { start: iso, end: pending });
    setPending(null);
    setHover(null);
  }

  function saveDraft() {
    if (!draft) return;
    setRanges((current) => mergeHolidayRanges([...current, draft]));
    setDraft(null);
  }

  function clearDraft() {
    setDraft(null);
    setPending(null);
    setHover(null);
  }

  function remove(range: HolidayRange) {
    setRanges((current) => current.filter((item) => item.start !== range.start || item.end !== range.end));
  }

  return (
    <div className="holiday-calendar">
      <input type="hidden" name="holidays" value={stored} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">Исключить праздники</span>
        <span className="text-xs text-muted">{hint(pending, draft)}</span>
      </div>
      <div className="holiday-months">
        <Month
          start={view}
          highlight={highlight}
          pending={pending}
          onPick={pick}
          onHover={draft ? () => undefined : setHover}
          onPrev={() => setView(shiftMonth(view, -1))}
          showPrev
        />
        <Month
          start={shiftMonth(view, 1)}
          highlight={highlight}
          pending={pending}
          onPick={pick}
          onHover={draft ? () => undefined : setHover}
          onNext={() => setView(shiftMonth(view, 1))}
          showNext
        />
      </div>
      {draft ? (
        <div className="holiday-confirm">
          <span>{rangeLabel(draft)}</span>
          <button type="button" className="holiday-save" onClick={saveDraft}>
            Сохранить интервал
          </button>
          <button type="button" className="secondary" onClick={clearDraft}>
            Выбрать заново
          </button>
        </div>
      ) : null}
      {ranges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {ranges.map((range) => (
            <span key={`${range.start}:${range.end}`} className="holiday-chip">
              {rangeLabel(range)}
              <button type="button" aria-label={`Убрать ${formatHolidayRu(range.start)}`} onClick={() => remove(range)}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : draft ? null : (
        <p className="mt-2 text-xs text-muted">Интервалов пока нет.</p>
      )}
    </div>
  );
}

function hint(pending: string | null, draft: HolidayRange | null): string {
  if (draft) return "Сохраните интервал, затем можно выбрать следующий.";
  if (pending) return "Теперь день конца. Для одного дня нажмите его ещё раз.";
  return "Выберите день начала.";
}

function rangeLabel(range: HolidayRange): string {
  return range.start === range.end ? formatHolidayRu(range.start) : `${formatHolidayRu(range.start)} – ${formatHolidayRu(range.end)}`;
}

function Month({
  start,
  highlight,
  pending,
  onPick,
  onHover,
  onPrev,
  onNext,
  showPrev = false,
  showNext = false,
}: {
  start: string;
  highlight: HolidayRange | null;
  pending: string | null;
  onPick: (iso: string) => void;
  onHover: (iso: string | null) => void;
  onPrev?: () => void;
  onNext?: () => void;
  showPrev?: boolean;
  showNext?: boolean;
}) {
  const [year, month] = start.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const leading = (first.getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();

  return (
    <div>
      <div className="date-popover-head">
        {showPrev ? (
          <button type="button" aria-label="Предыдущий месяц" onClick={onPrev}>
            ‹
          </button>
        ) : (
          <span />
        )}
        <span>
          {MONTHS[month - 1]} {year}
        </span>
        {showNext ? (
          <button type="button" aria-label="Следующий месяц" onClick={onNext}>
            ›
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="date-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="date-days" onMouseLeave={() => onHover(null)}>
        {Array.from({ length: leading }, (_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: count }, (_, index) => {
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
          const inHighlight = highlight ? iso >= highlight.start && iso <= highlight.end : false;
          const edgeStart = inHighlight && iso === highlight?.start;
          const edgeEnd = inHighlight && iso === highlight?.end;
          const single = edgeStart && edgeEnd;
          const className = [
            inHighlight ? "in-range" : "",
            single ? "range-single" : "",
            !single && edgeStart ? "range-start" : "",
            !single && edgeEnd ? "range-end" : "",
            iso === pending ? "pending" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={iso}
              type="button"
              className={className || undefined}
              aria-label={formatHolidayRu(iso)}
              aria-pressed={inHighlight || iso === pending}
              onMouseEnter={() => onHover(iso)}
              onClick={() => onPick(iso)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function shiftMonth(iso: string, delta: number): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-01`;
}
