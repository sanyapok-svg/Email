import { AccessUsersPanel } from "@/components/access-users-panel";
import { requireAccount } from "@/lib/auth/account";
import { listServiceUsers } from "@/lib/auth/users";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const params = await searchParams;
  const account = await requireAccount();
  const users = await listServiceUsers(account.accountId);
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Пользователи аккаунта «{account.accountName}». У каждого свой логин и пароль. Выключенный пользователь войти не сможет.
      </p>
      <AccessUsersPanel notice={params.notice} users={users} currentUserId={account.userId} />
    </>
  );
}
