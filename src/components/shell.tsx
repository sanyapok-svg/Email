import Link from "next/link";
import { Nav } from "@/components/nav";
import { logout } from "@/server/auth";

export function Shell({ children, pathname = "/" }: { children: React.ReactNode; pathname?: string }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 bg-pine text-paper md:flex md:h-screen md:flex-col md:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:py-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Yandex 360</p>
            <p className="text-lg font-semibold leading-tight md:text-xl">Входящие</p>
          </div>
          <form action={logout} className="md:hidden">
            <button className="secondary" type="submit">
              Выйти
            </button>
          </form>
        </div>
        <Nav pathname={pathname} />
        <form action={logout} className="mt-auto hidden px-4 py-4 md:block">
          <button className="secondary w-full" type="submit">
            Выйти
          </button>
        </form>
      </aside>
      <main className="min-w-0 px-4 py-5 md:px-8 md:py-7">{children}</main>
    </div>
  );
}

export function PageTitle({ title, text, back }: { title: string; text?: string; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back ? (
        <Link className="mb-2 inline-block text-sm underline" href={back.href}>
          {back.label}
        </Link>
      ) : null}
      <h1 className="break-words text-xl font-semibold sm:text-2xl">{title}</h1>
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
