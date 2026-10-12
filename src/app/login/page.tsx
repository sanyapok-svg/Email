import { login } from "@/server/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4">
      <form action={login} className="w-full max-w-md rounded-3xl bg-card p-8 shadow-[0_24px_60px_rgba(40,22,71,0.08)]">
        <h1 className="text-4xl tracking-tight">Входящие</h1>
        <p className="mt-3 text-base text-muted">Вход в аккаунт компании. Пароли почты здесь не показываются.</p>
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
