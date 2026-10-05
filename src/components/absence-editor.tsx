"use client";

import { ABSENCE_KINDS, ABSENCE_LABELS, type Absence, type AbsenceKind } from "@/lib/b24/absences";
import { RussianDateField } from "@/components/russian-date-field";

export function AbsenceEditor({
  absences,
  users,
  selfId,
  onChange,
}: {
  absences: Absence[];
  users: Array<{ id: string; name: string; active: boolean; dismissed?: boolean }>;
  selfId: string;
  onChange: (next: Absence[]) => void;
}) {
  const candidates = users.filter((user) => user.id !== selfId && ((user.active && !user.dismissed) || absences.some((absence) => absence.substituteIds.includes(user.id))));

  function update(index: number, patch: Partial<Absence>) {
    onChange(absences.map((absence, item) => (item === index ? { ...absence, ...patch } : absence)));
  }

  function toggleSubstitute(index: number, id: string) {
    const current = absences[index]?.substituteIds ?? [];
    const substituteIds = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    update(index, { substituteIds });
  }

  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">Отпуск, больничный, отгул</legend>
      <p className="text-xs text-muted">
        В эти дни уведомления уйдут замещающим вместо этого сотрудника. День считается по часовому поясу ящика. Если замещающий уже указан в этом уведомлении, повторно оно ему не отправится.
      </p>
      {absences.map((absence, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-[8.5rem_1fr_1fr]">
            <label className="text-sm">
              Тип
              <select className="mt-1" aria-label="Тип отсутствия" value={absence.kind} onChange={(event) => update(index, { kind: event.target.value as AbsenceKind })}>
                {ABSENCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ABSENCE_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              С
              <RussianDateField name={`absence-${index}-start`} label="Начало отсутствия" defaultValue={absence.start} onChange={(start) => update(index, { start })} />
            </label>
            <label className="text-sm">
              По
              <RussianDateField name={`absence-${index}-end`} label="Конец отсутствия" defaultValue={absence.end} align="end" onChange={(end) => update(index, { end })} />
            </label>
          </div>
          <div className="text-sm">
            Замещающие
            {candidates.length === 0 ? (
              <p className="mt-1 text-xs text-muted">Сначала добавьте другого сотрудника.</p>
            ) : (
              <div className="mt-1 grid max-h-36 gap-1 overflow-y-auto rounded-lg border border-line p-2">
                {candidates.map((user) => (
                  <label key={user.id} className="flex items-center gap-2">
                    <input
                      style={{ width: "auto" }}
                      type="checkbox"
                      checked={absence.substituteIds.includes(user.id)}
                      onChange={() => toggleSubstitute(index, user.id)}
                    />
                    <span>
                      {user.name}
                      {user.dismissed ? " · уволен" : user.active ? "" : " · выключен"}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button type="button" className="secondary" onClick={() => onChange(absences.filter((_, item) => item !== index))}>
              Убрать
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() => onChange([...absences, { kind: "vacation", start: "", end: "", substituteIds: [] }])}
      >
        Добавить отсутствие
      </button>
    </fieldset>
  );
}
