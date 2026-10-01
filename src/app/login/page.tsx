import { login } from "@/server/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form action={login} className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Служебный вход</p>
        <h1 className="mt-1 text-2xl font-semibold">Входящие</h1>
        <p className="mt-2 text-sm text-muted">Панель обработки общих ящиков. Пароли почты здесь не показываются.</p>
        {params.notice ? <p className="mt-4 rounded-md bg-paper px-3 py-2 text-sm">{params.notice}</p> : null}
        <label className="mt-4 block text-sm">
          Логин
          <input className="mt-1" name="username" autoComplete="username" required />
        </label>
        <label className="mt-3 block text-sm">
          Пароль
          <input className="mt-1" name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="mt-5 w-full" type="submit">
          Войти
        </button>
      </form>
    </main>
  );
}
