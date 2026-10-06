"use client";

import { useState } from "react";

export function ConfirmDelete({
  action,
  id,
  title,
  text,
  label = "Удалить",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  title: string;
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-20 grid items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-card p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">{title}</h2>
            <p className="text-sm">{text}</p>
            <form action={action} className="mt-4 flex justify-end gap-2">
              <input type="hidden" name="id" value={id} />
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                Отмена
              </button>
              <button type="submit">Удалить</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
