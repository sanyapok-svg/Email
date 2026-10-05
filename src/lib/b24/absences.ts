import { formatHolidayRu } from "@/lib/mail/holidays";

export const ABSENCE_KINDS = ["vacation", "sick", "time_off"] as const;

export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

export type Absence = {
  kind: AbsenceKind;
  start: string;
  end: string;
  substituteIds: string[];
};

export type RecipientPerson = {
  id: string;
  name: string;
  login: string;
  externalId: string;
  active: boolean;
  absences: Absence[];
};

export const ABSENCE_LABELS: Record<AbsenceKind, string> = {
  vacation: "отпуск",
  sick: "больничный",
  time_off: "отгул",
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calendarDay(date: Date, timeZone: string): string {
  const zone = safeZone(timeZone);
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function absenceCovers(absence: Absence, day: string): boolean {
  return absence.start <= day && day <= absence.end;
}

export function withoutSubstitute(absences: readonly Absence[], substituteId: string): Absence[] {
  return absences.flatMap((absence) => {
    const substituteIds = absence.substituteIds.filter((id) => id !== substituteId);
    return substituteIds.length ? [{ ...absence, substituteIds }] : [];
  });
}

export function readAbsences(value: unknown): Absence[] {
  if (!Array.isArray(value)) return [];
  const result: Absence[] = [];
  for (const item of value) {
    const parsed = readOne(item);
    if (parsed) result.push(parsed);
  }
  return result;
}

export function parseAbsences(
  value: unknown,
  selfId: string,
  knownIds: ReadonlySet<string>,
): { ok: true; absences: Absence[] } | { ok: false; error: string } {
  let raw: unknown = value;
  if (typeof value === "string") {
    if (!value.trim()) return { ok: true, absences: [] };
    try {
      raw = JSON.parse(value);
    } catch {
      return { ok: false, error: "Не удалось прочитать отсутствия" };
    }
  }
  if (raw == null) return { ok: true, absences: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Не удалось прочитать отсутствия" };
  if (raw.length > 50) return { ok: false, error: "Слишком много периодов отсутствия" };
  const absences: Absence[] = [];
  for (const item of raw) {
    if (isBlank(item)) continue;
    if (!item || typeof item !== "object") return { ok: false, error: "Не удалось прочитать отсутствия" };
    const record = item as Record<string, unknown>;
    const kind = String(record.kind ?? "");
    const start = String(record.start ?? "");
    const end = String(record.end ?? "");
    if (!isKind(kind)) return { ok: false, error: "Укажите тип отсутствия" };
    if (!isCalendarDate(start) || !isCalendarDate(end) || start > end) return { ok: false, error: "Укажите даты отсутствия" };
    const requested = Array.isArray(record.substituteIds) ? record.substituteIds.map(String) : [];
    const substituteIds = [...new Set(requested.filter((id) => id && id !== selfId))];
    if (substituteIds.some((id) => !knownIds.has(id))) return { ok: false, error: "Замещающий сотрудник не найден" };
    if (!substituteIds.length) return { ok: false, error: "Выберите замещающего сотрудника" };
    absences.push({ kind, start, end, substituteIds });
  }
  return { ok: true, absences };
}

export function coveringSubstituteIds(people: readonly RecipientPerson[], day: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    if (!person.active) continue;
    for (const absence of person.absences) {
      if (!absenceCovers(absence, day)) continue;
      for (const id of absence.substituteIds) {
        if (!id || id === person.id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export function resolveRecipients(
  selected: readonly RecipientPerson[],
  directory: ReadonlyMap<string, RecipientPerson>,
  day: string,
): RecipientPerson[] {
  const result: RecipientPerson[] = [];
  const seen = new Set<string>();
  const add = (person: RecipientPerson | undefined) => {
    if (!person?.active || seen.has(person.id)) return;
    seen.add(person.id);
    result.push(person);
  };
  for (const person of selected) {
    if (!person.active) continue;
    const covering = person.absences.filter((absence) => absenceCovers(absence, day) && absence.substituteIds.some((id) => id && id !== person.id));
    if (covering.length === 0) {
      add(person);
      continue;
    }
    for (const absence of covering) {
      for (const id of absence.substituteIds) {
        if (id === person.id) continue;
        add(directory.get(id));
      }
    }
  }
  return result;
}

export function absenceListNote(absences: readonly Absence[], names: ReadonlyMap<string, string>): string {
  return absences
    .map((absence) => {
      const range = absence.start === absence.end ? formatHolidayRu(absence.start) : `${formatHolidayRu(absence.start)}–${formatHolidayRu(absence.end)}`;
      const people = absence.substituteIds.map((id) => names.get(id)).filter((name): name is string => Boolean(name));
      if (!people.length) return `${ABSENCE_LABELS[absence.kind]} ${range}, замещающий не выбран`;
      const verb = people.length > 1 ? "замещают" : "замещает";
      return `${ABSENCE_LABELS[absence.kind]} ${range}, ${verb} ${people.join(", ")}`;
    })
    .join("; ");
}

function readOne(item: unknown): Absence | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const kind = String(record.kind ?? "");
  const start = String(record.start ?? "");
  const end = String(record.end ?? "");
  if (!isKind(kind) || !isCalendarDate(start) || !isCalendarDate(end) || start > end) return null;
  const substituteIds = Array.isArray(record.substituteIds) ? [...new Set(record.substituteIds.map(String).filter(Boolean))] : [];
  return { kind, start, end, substituteIds };
}

function isBlank(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  const start = String(record.start ?? "");
  const end = String(record.end ?? "");
  const substituteIds = Array.isArray(record.substituteIds) ? record.substituteIds.filter(Boolean) : [];
  return !start && !end && substituteIds.length === 0;
}

function isKind(value: string): value is AbsenceKind {
  return (ABSENCE_KINDS as readonly string[]).includes(value);
}

function isCalendarDate(value: string): boolean {
  const match = ISO.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function safeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "Europe/Moscow";
  }
}
