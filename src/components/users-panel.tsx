"use client";

import { useMemo, useState } from "react";
import { deleteB24User, saveB24User } from "@/server/ops";

export type B24UserRow = {
  id: string;
  number: number;
  login: string;
  name: string;
  externalId: string;
  active: boolean;
};

const PAGE_SIZES = [15, 30, 50];

type SortKey = "number" | "login" | "name" | "externalId";
type Draft = {
  id: string;
  login: string;
  name: string;
  externalId: string;
  active: boolean;
};

const emptyDraft = (): Draft => ({ id: "", login: "", name: "", externalId: "", active: true });

export function UsersPanel({ users, notice }: { users: B24UserRow[]; notice?: string }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState({ login: "", name: "", externalId: "" });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "number", dir: "asc" });
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<B24UserRow | null>(null);

  const filtered = useMemo(() => {
    const rows = users.filter((user) => {
      if (query.login && !user.login.toLowerCase().includes(query.login.trim().toLowerCase())) return false;
      if (query.name && !user.name.toLowerCase().includes(query.name.trim().toLowerCase())) return false;
      if (query.externalId && !user.externalId.includes(query.externalId.trim())) return false;
      return true;
    });
    const factor = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const left = sort.key === "number" ? a.number : a[sort.key];
      const right = sort.key === "number" ? b.number : b[sort.key];
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right), "ru") * factor;
    });
    return rows;
  }, [users, query, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h1 className="text-xl font-semibold">Сотрудники Б24</h1>
        <div className="users-toolbar flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-full px-4 py-2" onClick={() => setDraft(emptyDraft())}>
            <PlusIcon />
            Создание пользователя
          </button>
          <button
            type="button"
            className={`secondary inline-flex items-center gap-2 rounded-full px-4 py-2 ${filterOpen ? "border-pine" : ""}`}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <FilterIcon />
            Фильтр
          </button>
        </div>
      </header>
      {notice ? <p className="border-b border-line bg-paper px-5 py-2 text-sm">{notice}</p> : null}
      {filterOpen ? (
        <div className="grid gap-2 border-b border-line bg-paper/60 px-5 py-3 md:grid-cols-[1fr_1fr_140px_auto]">
          <input value={query.login} onChange={(event) => updateQuery("login", event.target.value)} placeholder="Логин" />
          <input value={query.name} onChange={(event) => updateQuery("name", event.target.value)} placeholder="ФИО" />
          <input value={query.externalId} onChange={(event) => updateQuery("externalId", event.target.value)} placeholder="ID Б24" />
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setQuery({ login: "", name: "", externalId: "" });
              setPage(1);
            }}
          >
            Сбросить
          </button>
        </div>
      ) : null}
      <ul className="divide-y divide-line md:hidden">
        {visible.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted">
            {users.length === 0 ? "Пользователей пока нет. Создайте первого, чтобы выбирать его в правиле." : "Ничего не найдено."}
          </li>
        ) : (
          visible.map((user) => (
            <li key={user.id} className={`grid gap-2 px-5 py-4 ${user.active ? "" : "text-muted"}`}>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted">{user.login}</p>
                <p className="text-sm">ID {user.number} · Б24 {user.externalId}{user.active ? "" : " · выключен"}</p>
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
              <Sortable label="ID" column="number" sort={sort} onSort={toggleSort} />
              <Sortable label="Логин" column="login" sort={sort} onSort={toggleSort} />
              <Sortable label="ФИО" column="name" sort={sort} onSort={toggleSort} />
              <Sortable label="ID Б24" column="externalId" sort={sort} onSort={toggleSort} />
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  {users.length === 0 ? "Пользователей пока нет. Создайте первого, чтобы выбирать его в правиле." : "Ничего не найдено."}
                </td>
              </tr>
            ) : (
              visible.map((user) => (
                <tr key={user.id} className={user.active ? "" : "text-muted"}>
                  <td>{user.number}</td>
                  <td>{user.login}</td>
                  <td>
                    {user.name}
                    {user.active ? "" : " · выключен"}
                  </td>
                  <td>{user.externalId}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button type="button" className="bare" aria-label={`Изменить ${user.name}`} onClick={() => setDraft(user)}>
                        <PencilIcon />
                      </button>
                      <button type="button" className="bare" aria-label={`Удалить ${user.name}`} onClick={() => setPendingDelete(user)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <footer className="flex items-center justify-end gap-3 border-t border-line px-5 py-3 text-sm text-muted">
        <select
          className="page-size"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}
          aria-label="Строк на странице"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button type="button" className="bare" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Предыдущая страница">
          ‹
        </button>
        <span className="min-w-6 text-center text-ink">{current}</span>
        <button type="button" className="bare" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Следующая страница">
          ›
        </button>
      </footer>
      {draft ? (
        <Overlay title={draft.id ? "Редактирование пользователя" : "Создание пользователя"} onClose={() => setDraft(null)}>
          <form action={saveB24User} className="grid gap-3">
            {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}
            <label className="text-sm">
              Логин
              <input className="mt-1" name="login" type="email" required defaultValue={draft.login} placeholder="name@company.ru" />
            </label>
            <label className="text-sm">
              ФИО
              <input className="mt-1" name="name" required defaultValue={draft.name} placeholder="Имя Фамилия" />
            </label>
            <label className="text-sm">
              ID Б24
              <input className="mt-1" name="externalId" required inputMode="numeric" defaultValue={draft.externalId} placeholder="7" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input style={{ width: "auto" }} type="checkbox" name="active" defaultChecked={draft.active} />
              Активен и доступен в правилах
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
          <p className="text-sm">
            {pendingDelete.name} больше нельзя будет выбрать в новых правилах. Уже сохранённые правила останутся как есть.
          </p>
          <form action={deleteB24User} className="mt-4 flex justify-end gap-2">
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

  function updateQuery(key: keyof typeof query, value: string) {
    setQuery((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }
}

function Sortable({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column;
  return (
    <th>
      <button type="button" className="bare inline-flex items-center gap-1" onClick={() => onSort(column)}>
        {label}
        <span className="text-[10px] leading-none text-muted" aria-hidden>
          {active && sort.dir === "desc" ? "↓" : "↑"}
        </span>
      </button>
    </th>
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

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3h10L8.2 7.2V11L5.8 9.6V7.2L2 3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M8.4 3.2 11.8 6.6 5.2 13.2H1.8V9.8L8.4 3.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7.2 4.4 10.6 7.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M3 4.2h9M5.8 4.1V2.8h3.4v1.3M4.2 4.2l.6 8h5.4l.6-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
