"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type MessageRow = {
  id: string;
  receivedAt: string;
  subject: string;
  truncated: boolean;
  fromEmail: string;
  decision: string;
  ruleName: string | null;
  entities: string;
};

export function MailboxMessages({
  panelId,
  items,
}: {
  panelId: string;
  items: MessageRow[];
}) {
  const storageKey = `messages-open:${panelId}`;
  const [open, setOpen] = useState(false);

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

  return (
    <div className="border-t border-line bg-paper/50 px-4 py-4 sm:px-5">
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
        {open ? "Скрыть письма" : "Письма"}
        <span className="summary">· {messageCount(items.length)}</span>
      </button>
      {open ? (
        <div id={`${panelId}-panel`} className="mt-3 ml-1 border-l-2 border-moss/40 pl-3 sm:ml-2 sm:pl-4">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тема</th>
                  <th>Отправитель</th>
                  <th>Решение</th>
                  <th>Сущности</th>
                </tr>
              </thead>
              <tbody>
                {items.map((message) => (
                  <tr key={message.id}>
                    <td>{message.receivedAt}</td>
                    <td>
                      <Link className="underline" href={`/messages/${message.id}`}>
                        {message.subject}
                      </Link>
                      {message.truncated ? <div className="text-xs text-muted">текст обрезан</div> : null}
                    </td>
                    <td>{message.fromEmail}</td>
                    <td>
                      {message.decision}
                      {message.ruleName ? <div className="text-xs text-muted">{message.ruleName}</div> : null}
                    </td>
                    <td className="text-xs">{message.entities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function messageCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} письмо`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} письма`;
  return `${count} писем`;
}
