import { Notice, PageTitle } from "@/components/shell";
import { loadPanel } from "@/lib/auth/account";
import { prisma } from "@/lib/db";
import { createAccount, enterAccount } from "@/server/accounts";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const { account } = await loadPanel();
  const accounts = await prisma.account.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true, mailboxes: true } } },
  });
  return (
    <>
      <PageTitle
        title="Аккаунты"
        text="Каждый аккаунт — отдельная компания: свои ящики, пользователи, сотрудники Битрикс24, уведомления и веб-хук. Новый аккаунт создаётся здесь, затем в него нужно войти и заполнить настройки."
      />
      <Notice text={params.notice} />
      <form action={createAccount} className="mb-6 flex max-w-xl flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          Название компании
          <input className="mt-1" name="name" required placeholder="Новая компания" />
        </label>
        <button type="submit">Создать аккаунт</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table>
          <thead>
            <tr>
              <th>Аккаунт</th>
              <th>Пользователи</th>
              <th>Ящики</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.name}
                  {item.id === account?.id ? <span className="ml-2 text-xs text-muted">текущий</span> : null}
                </td>
                <td>{item._count.members}</td>
                <td>{item._count.mailboxes}</td>
                <td className="text-right">
                  {item.id === account?.id ? null : (
                    <form action={enterAccount}>
                      <input type="hidden" name="accountId" value={item.id} />
                      <input type="hidden" name="next" value="/" />
                      <button className="secondary" type="submit">
                        Войти
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
