import { pollMailboxNow, setMailboxEnabled } from "@/server/mailboxes";

export function MailboxControls({
  id,
  active,
  returnTo,
}: {
  id: string;
  active: boolean;
  returnTo: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={setMailboxEnabled}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="enabled" value={active ? "0" : "1"} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button className="switch" type="submit" aria-pressed={active} title="Включает или выключает ящик и все его правила">
          <span className="switch-track" aria-hidden="true" />
          {active ? "Включён" : "Выключен"}
        </button>
      </form>
      <form action={pollMailboxNow}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit">Проверить почту сейчас</button>
      </form>
    </div>
  );
}
