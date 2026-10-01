import { Nav } from "@/components/nav";
import { logout } from "@/server/auth";

export function Shell({ children, pathname = "/" }: { children: React.ReactNode; pathname?: string }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-pine text-paper">
        <div className="px-5 py-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Yandex 360</p>
          <p className="text-xl font-semibold">Входящие</p>
        </div>
        <Nav pathname={pathname} />
        <form action={logout} className="mt-auto p-4">
          <button className="secondary w-full" type="submit">
            Выйти
          </button>
        </form>
      </aside>
      <main className="px-5 py-7 md:px-8">{children}</main>
    </div>
  );
}

export function PageTitle({ title, text }: { title: string; text?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {text ? <p className="mt-1 max-w-3xl text-sm text-muted">{text}</p> : null}
    </header>
  );
}

export function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mb-4 rounded-md border border-line bg-card px-3 py-2 text-sm">{text}</p>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-line bg-card p-4">{children}</section>;
}
