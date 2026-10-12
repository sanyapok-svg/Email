import Link from "next/link";
import { AccountSwitcher } from "@/components/account-switcher";
import { Nav } from "@/components/nav";
import { logout } from "@/server/auth";

export function Shell({
  children,
  pathname = "/",
  accountName,
  accounts = [],
  currentAccountId,
  showAccounts = false,
}: {
  children: React.ReactNode;
  pathname?: string;
  accountName?: string;
  accounts?: Array<{ id: string; name: string }>;
  currentAccountId?: string;
  showAccounts?: boolean;
}) {
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 bg-pine text-white md:flex md:h-screen md:flex-col md:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:py-7">
          <div>
            <p className="text-lg font-medium tracking-tight md:text-2xl">Входящие</p>
            {accountName ? <p className="mt-1 text-sm text-lilac">{accountName}</p> : null}
          </div>
          <form action={logout} className="md:hidden">
            <button className="secondary" type="submit">
              Выйти
            </button>
          </form>
        </div>
        {accounts.length > 1 && currentAccountId ? (
          <div className="px-4 pb-2 md:px-5">
            <AccountSwitcher accounts={accounts} currentId={currentAccountId} />
          </div>
        ) : null}
        <Nav pathname={pathname} showAccounts={showAccounts} />
        <form action={logout} className="mt-auto hidden px-4 py-4 md:block">
          <button className="secondary w-full" type="submit">
            Выйти
          </button>
        </form>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}

export function PageTitle({ title, text, back }: { title: string; text?: string; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back ? (
        <Link className="mb-3 inline-block text-sm" href={back.href}>
          {back.label}
        </Link>
      ) : null}
      <h1 className="break-words text-3xl tracking-tight sm:text-4xl">{title}</h1>
      {text ? <p className="mt-2 max-w-3xl break-words text-base text-muted">{text}</p> : null}
    </header>
  );
}

export function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mb-4 rounded-xl border border-lilac bg-white px-4 py-3 text-sm">{text}</p>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-card p-5 shadow-[0_8px_28px_rgba(40,22,71,0.05)]">{children}</section>;
}
