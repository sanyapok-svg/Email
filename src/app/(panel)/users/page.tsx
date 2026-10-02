import { UsersPanel } from "@/components/users-panel";
import { prisma } from "@/lib/db";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const users = await prisma.b24Recipient.findMany({ orderBy: { number: "asc" } });
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Пользователи Битрикс24. Их можно выбрать получателями при создании правила — уведомление придёт на указанный ID.
      </p>
      <UsersPanel
        notice={params.notice}
        users={users.map((user) => ({
          id: user.id,
          number: user.number,
          login: user.login,
          name: user.name,
          externalId: user.externalId,
          active: user.active,
        }))}
      />
    </>
  );
}
