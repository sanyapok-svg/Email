"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RuleNotifySwitch } from "@/components/rule-notify-switch";
import { moveRule, deleteRule } from "@/server/rules";
import { ConfirmDelete } from "@/components/confirm-delete";

export type MailboxRuleRow = {
  id: string;
  name: string;
  active: boolean;
  notificationEnabled: boolean;
  category: string | null;
};

export function MailboxRules({
  mailboxId,
  rules,
  returnTo,
  panelId,
  defaultOpen = false,
  divider = false,
}: {
  mailboxId: string;
  rules: MailboxRuleRow[];
  returnTo: string;
  panelId: string;
  defaultOpen?: boolean;
  divider?: boolean;
}) {
  const storageKey = `rules-open:${panelId}`;
  const [open, setOpen] = useState(defaultOpen);

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

  const countLabel = rulesCount(rules.length);

  return (
    <div className={`${divider ? "border-t border-line " : ""}bg-paper/50 px-4 py-4 sm:px-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="disclosure"
          aria-expanded={open}
          aria-controls={`${panelId}-panel`}
          onClick={toggle}
        >
          <span className="chevron" aria-hidden="true">
            ›
          </span>
          {open ? "Скрыть правила" : "Правила"}
          <span className="summary">· {countLabel}</span>
        </button>
        <Link className="button" href={`/rules/new?mailboxId=${mailboxId}`}>
          Новое правило
        </Link>
      </div>
      {open ? (
        <div id={`${panelId}-panel`} className="mt-3">
          <p className="mb-3 text-sm text-muted">
            Каждое правило проверяется отдельно. Уведомление создаётся, если условия выполнены и переключатель включён.
          </p>
          {rules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-card px-3 py-4 text-sm text-muted">
              Правил пока нет. У ящика их может быть несколько, и каждое создаёт своё уведомление.
            </p>
          ) : (
            <div className="ml-1 border-l-2 border-moss/40 pl-3 sm:ml-2 sm:pl-4">
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card md:hidden">
                {rules.map((rule, index) => (
                  <li key={rule.id} className="grid gap-3 px-3 py-3">
                    <RuleTitle rule={rule} />
                    <RuleTools rule={rule} index={index} total={rules.length} mailboxId={mailboxId} returnTo={returnTo} />
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
                <table>
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Состояние</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule, index) => (
                      <tr key={rule.id}>
                        <td>
                          <RuleTitle rule={rule} />
                        </td>
                        <td>
                          <RuleNotifySwitch
                            id={rule.id}
                            enabled={rule.active && rule.notificationEnabled}
                            returnTo={`${returnTo.split("#")[0]}#mailbox-${mailboxId}`}
                          />
                        </td>
                        <td>
                          <RuleMove rule={rule} index={index} total={rules.length} returnTo={returnTo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function RuleTitle({ rule }: { rule: MailboxRuleRow }) {
  return (
    <div className="min-w-0">
      <Link className="break-words underline" href={`/rules/${rule.id}`}>
        {rule.name}
      </Link>
      {rule.category ? <div className="break-words text-xs text-muted">{rule.category}</div> : null}
    </div>
  );
}

function RuleTools({
  rule,
  index,
  total,
  mailboxId,
  returnTo,
}: {
  rule: MailboxRuleRow;
  index: number;
  total: number;
  mailboxId: string;
  returnTo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RuleNotifySwitch id={rule.id} enabled={rule.active && rule.notificationEnabled} returnTo={`${returnTo.split("#")[0]}#mailbox-${mailboxId}`} />
      <RuleMove rule={rule} index={index} total={total} returnTo={returnTo} />
    </div>
  );
}

function RuleMove({ rule, index, total, returnTo }: { rule: MailboxRuleRow; index: number; total: number; returnTo: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <form action={moveRule}>
        <input type="hidden" name="id" value={rule.id} />
        <input type="hidden" name="direction" value="up" />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="secondary" type="submit" disabled={index === 0} aria-label="Выше">
          ↑
        </button>
      </form>
      <form action={moveRule}>
        <input type="hidden" name="id" value={rule.id} />
        <input type="hidden" name="direction" value="down" />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="secondary" type="submit" disabled={index === total - 1} aria-label="Ниже">
          ↓
        </button>
      </form>
      <ConfirmDelete
        action={deleteRule}
        id={rule.id}
        label="Удалить"
        title="Удалить правило"
        text={`Правило «${rule.name}» будет удалено. Письма и уведомления останутся, но уже без этого правила.`}
      />
    </div>
  );
}

function rulesCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} правило`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} правила`;
  return `${count} правил`;
}
