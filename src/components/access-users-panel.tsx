"use client";

import { useState } from "react";
import { deleteServiceUser, saveServiceUser } from "@/server/access";

export type AccessUserRow = {
  id: string;
  login: string;
  name: string;
  active: boolean;
};

type Draft = {
  id: string;
  login: string;
  name: string;
  active: boolean;
};

const emptyDraft = (): Draft => ({ id: "", login: "", name: "", active: true });

export function AccessUsersPanel({ users, notice }: { users: AccessUserRow[]; notice?: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccessUserRow | null>(null);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h1 className="text-xl font-semibold">Пользователи</h1>
        <button type="button" className="inline-flex items-center gap-2 rounded-full px-4 py-2" onClick={() => setDraft(emptyDraft())}>
          + Создание пользователя
        </button>
      </header>
      {notice ? <p className="border-b border-line bg-paper px-5 py-2 text-sm">{notice}</p> : null}
      <ul className="divide-y divide-line md:hidden">
        {users.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted">Пользователей пока нет. Создайте первого, чтобы входить в панель.</li>
        ) : (
          users.map((user) => (
            <li key={user.id} className={`grid gap-2 px-5 py-4 ${user.active ? "" : "text-muted"}`}>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted">{user.login}</p>
                <p className="text-sm">{user.active ? "может войти" : "выключен"}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="secondary" onClick={() => setDraft(user)}>
                  Изменить
                </button>
                <button type="button" className="secondary" onClick={() => setPendingDelete(user)}>
                  Удалить
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="users-table">
          <thead>
            <tr>
              <th>Логин</th>
              <th>Имя</th>
              <th>Доступ</th>
              <th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted">
                  Пользователей пока нет. Создайте первого, чтобы входить в панель.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={user.active ? "" : "text-muted"}>
                  <td>{user.login}</td>
                  <td>{user.name}</td>
                  <td>{user.active ? "может войти" : "выключен"}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button type="button" className="bare" onClick={() => setDraft(user)}>
                        Изменить
                      </button>
                      <button type="button" className="bare" onClick={() => setPendingDelete(user)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {draft ? (
        <Overlay title={draft.id ? "Редактирование пользователя" : "Создание пользователя"} onClose={() => setDraft(null)}>
          <form action={saveServiceUser} className="grid gap-3">
            {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}
            <label className="text-sm">
              Логин
              <input className="mt-1" name="login" required autoComplete="off" defaultValue={draft.login} placeholder="ivan" />
            </label>
            <label className="text-sm">
              Имя
              <input className="mt-1" name="name" required defaultValue={draft.name} placeholder="Имя Фамилия" />
            </label>
            <label className="text-sm">
              Пароль
              <input
                className="mt-1"
                name="password"
                type="password"
                autoComplete="new-password"
                required={!draft.id}
                placeholder={draft.id ? "оставьте пустым, чтобы не менять" : "не короче 5 символов"}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input style={{ width: "auto" }} type="checkbox" name="active" defaultChecked={draft.active} />
              Может входить в панель
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="secondary" onClick={() => setDraft(null)}>
                Отмена
              </button>
              <button type="submit">Сохранить</button>
            </div>
          </form>
        </Overlay>
      ) : null}
      {pendingDelete ? (
        <Overlay title="Удалить пользователя" onClose={() => setPendingDelete(null)}>
          <p className="text-sm">{pendingDelete.name} больше не сможет войти в панель. Последнего пользователя с доступом удалить нельзя.</p>
          <form action={deleteServiceUser} className="mt-4 flex justify-end gap-2">
            <input type="hidden" name="id" value={pendingDelete.id} />
            <button type="button" className="secondary" onClick={() => setPendingDelete(null)}>
              Отмена
            </button>
            <button type="submit">Удалить</button>
          </form>
        </Overlay>
      ) : null}
    </section>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-ink/40 px-4" role="presentation" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5 shadow-lg" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
