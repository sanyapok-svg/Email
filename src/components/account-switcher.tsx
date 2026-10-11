"use client";

import { enterAccount } from "@/server/accounts";

export function AccountSwitcher({ accounts, currentId }: { accounts: Array<{ id: string; name: string }>; currentId: string }) {
  return (
    <form action={enterAccount} className="mt-3">
      <label className="text-[11px] uppercase tracking-[0.18em] text-white/50">
        Аккаунт
        <select className="mt-1 text-sm text-ink" name="accountId" defaultValue={currentId} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
