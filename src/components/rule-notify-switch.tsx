"use client";

import { setRuleNotification } from "@/server/rules";

export function RuleNotifySwitch({ id, enabled, returnTo }: { id: string; enabled: boolean; returnTo: string }) {
  return (
    <form action={setRuleNotification}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        className="switch whitespace-nowrap"
        type="submit"
        aria-pressed={enabled}
        title="Правило создаёт уведомление, если его условия выполнены"
      >
        <span className="switch-track" aria-hidden="true" />
        {enabled ? "Уведомления" : "Выключены"}
      </button>
    </form>
  );
}
