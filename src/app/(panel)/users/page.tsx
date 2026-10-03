import { AccessUsersPanel } from "@/components/access-users-panel";
import { ensureBootstrapUser, listServiceUsers } from "@/lib/auth/users";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  await ensureBootstrapUser();
  const users = await listServiceUsers();
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Доступ к этой панели. У каждого свой логин и пароль. Выключенный пользователь войти не сможет.
      </p>
      <AccessUsersPanel notice={params.notice} users={users} />
    </>
  );
}
