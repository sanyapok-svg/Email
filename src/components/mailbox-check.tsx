"use client";

import { useEffect, useState } from "react";
import { HolidayRanges } from "@/components/holiday-ranges";
import { POLL_INTERVALS, pollIntervalMinutes, type MailboxCheckSettings } from "@/lib/mail/check-settings";
import { saveMailboxCheck, setMailboxAutoPoll } from "@/server/mailboxes";

const DAY_NAMES = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function MailboxCheck({
  mailboxId,
  settings,
  returnTo,
  panelId,
  defaultOpen = false,
  divider = false,
}: {
  mailboxId: string;
  settings: MailboxCheckSettings;
  returnTo: string;
  panelId: string;
  defaultOpen?: boolean;
  divider?: boolean;
}) {
  const storageKey = `check-open:${panelId}`;
  const [open, setOpen] = useState(defaultOpen);
  const summary = checkSummary(settings);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(storageKey);
    const hash = window.location.hash.slice(1);
    if (saved === "1" || hash === panelId) setOpen(true);
    else if (saved === "0") setOpen(false);
  }, [panelId, storageKey]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      window.sessionStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  const minutes = pollIntervalMinutes(settings.pollIntervalSec);

  return (
    <div className={`${divider ? "border-t border-line " : ""}bg-paper/50 px-4 py-4 sm:px-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="disclosure" aria-expanded={open} aria-controls={`${panelId}-panel`} onClick={toggle}>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
          {open ? "Скрыть проверку" : "Проверка"}
          <span className="summary">· {summary}</span>
        </button>
        <form action={setMailboxAutoPoll}>
          <input type="hidden" name="id" value={mailboxId} />
          <input type="hidden" name="enabled" value={settings.autoPoll ? "0" : "1"} />
          <input type="hidden" name="returnTo" value={returnTo.split("#")[0]} />
          <button
            className="switch"
            type="submit"
            aria-pressed={settings.autoPoll}
            title="Почта читается сама по выбранным периодичности, дням и праздникам"
          >
            <span className="switch-track" aria-hidden="true" />
            {settings.autoPoll ? "Автопроверка" : "Выключена"}
          </button>
        </form>
      </div>
      {open ? (
        <form id={`${panelId}-panel`} action={saveMailboxCheck} className="mt-3 ml-1 grid gap-3 border-l-2 border-moss/40 pl-3 sm:ml-2 sm:pl-4">
          <input type="hidden" name="id" value={mailboxId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <p className="text-sm text-muted">
            {settings.autoPoll
              ? "Автопроверка включена: почта читается по этим параметрам. Уведомления задаются в правиле ящика."
              : "Автопроверка выключена. Параметры сохранены, почта сама не читается."}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              Периодичность
              <select className="mt-1" name="pollIntervalMin" defaultValue={minutes}>
                {POLL_INTERVALS.map((item) => (
                  <option key={item.minutes} value={item.minutes}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <WorkDays days={settings.workDays} />
          </div>
          <WorkHours intervals={settings.intervals} />
          <HolidayRanges defaultValue={settings.holidays} />
          <div>
            <button type="submit">Сохранить проверку</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function WorkDays({ days }: { days: number[] }) {
  const [selected, setSelected] = useState(() => new Set(days.filter((day) => day >= 1 && day <= 7)));

  function toggle(day: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        if (next.size === 1) return current;
        next.delete(day);
      } else next.add(day);
      return next;
    });
  }

  const value = [...selected].sort((left, right) => left - right).join(",");

  return (
    <div className="text-sm">
      Рабочие дни
      <input type="hidden" name="workDays" value={value} />
      <div className="weekday-days mt-1">
        {DAY_NAMES.map((name, index) => {
          const day = index + 1;
          return (
            <button key={day} type="button" className="weekday" aria-pressed={selected.has(day)} onClick={() => toggle(day)}>
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkHours({ intervals }: { intervals: string }) {
  const [slots, setSlots] = useState<TimeSlot[]>(() => parseSlots(intervals));
  const value = slots.map((slot) => `${slot.start}-${slot.end}`).join(", ");

  function update(index: number, patch: Partial<TimeSlot>) {
    setSlots((current) =>
      current.map((slot, slotIndex) => {
        if (slotIndex !== index) return slot;
        const next = { ...slot, ...patch };
        if (minutesOf(next.end) <= minutesOf(next.start)) next.end = nextTime(next.start);
        return next;
      }),
    );
  }

  return (
    <div className="text-sm">
      Рабочие часы
      <input type="hidden" name="workIntervals" value={value} />
      <div className="work-hours mt-1">
        {slots.map((slot, index) => (
          <div key={index} className="work-hour">
            <span>с</span>
            <TimeSelect label="Начало" value={slot.start} options={START_TIMES} onChange={(start) => update(index, { start })} />
            <span>до</span>
            <TimeSelect label="Конец" value={slot.end} options={endTimes(slot.start, slot.end)} onChange={(end) => update(index, { end })} />
            {slots.length > 1 ? (
              <button type="button" className="secondary" onClick={() => setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index))}>
                Убрать
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => setSlots((current) => [...current, { start: "09:00", end: "18:00" }])}>
          Ещё интервал
        </button>
      </div>
    </div>
  );
}

function TimeSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [hour, minute] = value.split(":");
  const hours = [...new Set(options.map((item) => item.slice(0, 2)))];
  const minutes = [...new Set(options.filter((item) => item.startsWith(`${hour}:`)).map((item) => item.slice(3)))];
  const minuteValue = minutes.includes(minute) ? minute : minutes[0];

  return (
    <span className="time-select">
      <select aria-label={`${label}, часы`} value={hour} onChange={(event) => onChange(closestTime(options, `${event.target.value}:${minute}`))}>
        {hours.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <span>:</span>
      <select aria-label={`${label}, минуты`} value={minuteValue} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>
        {minutes.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </span>
  );
}

type TimeSlot = { start: string; end: string };

const MINUTE_STEPS = [0, 15, 30, 45];
const START_TIMES = clockTimes(0, 23 * 60 + 45);

function parseSlots(value: string): TimeSlot[] {
  const slots = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [start, end] = item.split("-").map((part) => normalizeTime(part.trim()));
      return { start, end };
    })
    .filter((slot) => slot.start && slot.end && minutesOf(slot.end) > minutesOf(slot.start));
  return slots.length ? slots : [{ start: "09:00", end: "18:00" }];
}

function normalizeTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesOf(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function clockTimes(from: number, to: number): string[] {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of MINUTE_STEPS) {
      const total = hour * 60 + minute;
      if (total < from || total > to) continue;
      times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return times;
}

function endTimes(start: string, current: string): string[] {
  const times = clockTimes(minutesOf(start) + 1, 23 * 60 + 45);
  if (minutesOf(start) >= 23 * 60 + 45) times.push("23:59");
  if (current && minutesOf(current) > minutesOf(start) && !times.includes(current)) times.push(current);
  return times.sort();
}

function nextTime(start: string): string {
  return endTimes(start, "")[0] ?? "23:59";
}

function closestTime(options: string[], wanted: string): string {
  if (options.includes(wanted)) return wanted;
  const target = minutesOf(wanted);
  return options.reduce((best, current) => (Math.abs(minutesOf(current) - target) < Math.abs(minutesOf(best) - target) ? current : best));
}

function checkSummary(settings: MailboxCheckSettings): string {
  const minutes = pollIntervalMinutes(settings.pollIntervalSec);
  const days = daySpan(settings.workDays);
  const hours = settings.intervals.replace(/-/g, "–") || "09:00–18:00";
  return `${every(minutes)} · ${days} ${hours}`;
}

function every(minutes: number): string {
  if (minutes === 1) return "каждую минуту";
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours === 1) return "каждый час";
    return `каждые ${unit(hours, "час", "часа", "часов")}`;
  }
  return `каждые ${unit(minutes, "минуту", "минуты", "минут")}`;
}

function daySpan(days: number[]): string {
  const unique = [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((left, right) => left - right);
  if (unique.length === 0 || unique.length === 7) return "ежедневно";
  const consecutive = unique.every((day, index) => index === 0 || day === unique[index - 1] + 1);
  if (consecutive && unique.length > 1) return `${DAY_NAMES[unique[0] - 1]}–${DAY_NAMES[unique[unique.length - 1] - 1]}`;
  return unique.map((day) => DAY_NAMES[day - 1]).join(", ");
}

function unit(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}
