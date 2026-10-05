"use client";

import { useState } from "react";
import type { DismissalChoice, DismissalNotice } from "@/lib/b24/dismiss";
import { dismissB24User } from "@/server/ops";

export function DismissEmployeeForm({
  user,
  colleagues,
  onClose,
}: {
  user: { id: string; name: string; notices: DismissalNotice[] };
  colleagues: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, { choice: DismissalChoice; replacementId: string }>>(() =>
    Object.fromEntries(user.notices.map((notice) => [notice.ruleId, { choice: notice.sole ? "deactivate" : "remove", replacementId: "" }])),
  );
  const decisions = user.notices.map((notice) => ({
    ruleId: notice.ruleId,
    choice: choices[notice.ruleId]?.choice ?? (notice.sole ? "deactivate" : "remove"),
    replacementId: choices[notice.ruleId]?.replacementId ?? "",
  }));

  function setChoice(ruleId: string, choice: DismissalChoice) {
    setChoices((current) => ({ ...current, [ruleId]: { choice, replacementId: current[ruleId]?.replacementId ?? "" } }));
  }

  function setReplacement(ruleId: string, replacementId: string) {
    setChoices((current) => ({ ...current, [ruleId]: { choice: "replace", replacementId } }));
  }

  return (
    <form action={dismissB24User} className="grid gap-3">
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="decisions" value={JSON.stringify(decisions)} />
      <p className="text-sm">
        {user.name} больше не будет получать уведомления. Для каждого правила, где он указан получателем, выберите, что сделать.
      </p>
      {user.notices.length === 0 ? (
        <p className="text-sm text-muted">В правилах он нигде не указан. Увольнение только скроет его из выбора получателей.</p>
      ) : (
        <div className="grid gap-3">
          {user.notices.map((notice) => {
            const choice = choices[notice.ruleId]?.choice ?? (notice.sole ? "deactivate" : "remove");
            return (
              <fieldset key={notice.ruleId} className="grid gap-2 rounded-xl border border-line p-3">
                <legend className="px-1 text-sm font-medium">{notice.ruleName}</legend>
                <p className="text-xs text-muted">
                  {notice.mailboxName}
                  {notice.sole ? " · единственный получатель" : ` · другие получатели: ${notice.others}`}
                  {notice.queued ? ` · в очереди ${notice.queued}` : ""}
                  {notice.active ? "" : " · правило уже выключено"}
                </p>
                {notice.sole ? (
                  <Choice
                    name={notice.ruleId}
                    value="deactivate"
                    checked={choice === "deactivate"}
                    onChange={() => setChoice(notice.ruleId, "deactivate")}
                    label="Сделать уведомление неактивным"
                  />
                ) : (
                  <Choice
                    name={notice.ruleId}
                    value="remove"
                    checked={choice === "remove"}
                    onChange={() => setChoice(notice.ruleId, "remove")}
                    label="Убрать из получателей, остальным оставить"
                  />
                )}
                <Choice
                  name={notice.ruleId}
                  value="replace"
                  checked={choice === "replace"}
                  disabled={colleagues.length === 0}
                  onChange={() => setChoice(notice.ruleId, "replace")}
                  label="Заменить другим сотрудником"
                />
                {choice === "replace" ? (
                  <select
                    className="mt-1"
                    aria-label={`Замена для ${notice.ruleName}`}
                    value={choices[notice.ruleId]?.replacementId ?? ""}
                    onChange={(event) => setReplacement(notice.ruleId, event.target.value)}
                  >
                    <option value="">Выберите сотрудника</option>
                    {colleagues.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </fieldset>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="secondary" onClick={onClose}>
          Отмена
        </button>
        <button type="submit">Уволить</button>
      </div>
    </form>
  );
}

function Choice({
  name,
  value,
  checked,
  disabled,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "text-muted" : ""}`}>
      <input style={{ width: "auto" }} type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} />
      {label}
    </label>
  );
}
