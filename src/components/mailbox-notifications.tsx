"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type NoticeRow = {
  id: string;
  createdAt: string;
  ruleName: string | null;
  status: string;
  priority: string;
  due: string;
};

export function MailboxNotifications({
  panelId,
  items,
}: {
  panelId: string;
  items: NoticeRow[];
}) {
  const storageKey = `notices-open:${panelId}`;
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
        {open ? "Скрыть уведомления" : "Уведомления"}
        <span className="summary">· {noticeCount(items.length)}</span>
      </button>
      {open ? (
        <div id={`${panelId}-panel`} className="mt-3 ml-1 border-l-2 border-moss/40 pl-3 sm:ml-2 sm:pl-4">
          <div className="overflow-x-auto rounded-xl border border-line">
            <table>
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Правило</th>
                  <th>Статус</th>
                  <th>Приоритет</th>
                  <th>Срок</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className="underline" href={`/notifications/${item.id}`}>
                        {item.createdAt}
                      </Link>
                    </td>
                    <td>{item.ruleName || "—"}</td>
                    <td>{item.status}</td>
                    <td>{item.priority}</td>
                    <td>{item.due}</td>
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

function noticeCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} уведомление`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} уведомления`;
  return `${count} уведомлений`;
}
