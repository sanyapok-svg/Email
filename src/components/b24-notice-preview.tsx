import { EXAMPLE_FROM, EXAMPLE_SUBJECT, formatBitrixNotice, priorityLabel } from "@/lib/b24/notice";

export type NoticeRecipient = {
  id: string;
  name: string;
  login: string;
  externalId: string;
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "#8d8680",
  normal: "#2f6f4e",
  high: "#b85c38",
  critical: "#9b2335",
};

export function B24NoticePreview({
  enabled,
  mailboxName,
  priority,
  category,
  responseHours,
  recipients,
}: {
  enabled: boolean;
  mailboxName: string;
  priority: string;
  category: string;
  responseHours: number;
  recipients: NoticeRecipient[];
}) {
  const hours = Number.isFinite(responseHours) && responseHours > 0 ? responseHours : 24;
  const text = formatBitrixNotice({
    mailboxName,
    subject: EXAMPLE_SUBJECT,
    from: EXAMPLE_FROM,
    priority,
    category,
    responseDueLabel: `через ${hours} ч.`,
  });

  return (
    <section className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-semibold">Как это получит пользователь в Битрикс24</h2>
      <p className="mt-1 text-sm text-muted">
        Пример на письме «{EXAMPLE_SUBJECT}». Такой текст увидит каждый выбранный пользователь в колокольчике уведомлений.
      </p>
      {!enabled ? (
        <p className="mt-4 text-sm">Для этого правила уведомление в Битрикс24 не создаётся.</p>
      ) : recipients.length === 0 ? (
        <p className="mt-4 text-sm">Выберите пользователей слева — без них уведомление некому доставить.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#d5dde3] bg-white shadow-sm">
          <div className="flex items-center justify-between bg-[#eef2f4] px-4 py-2.5">
            <span className="text-sm font-semibold text-[#333]">Уведомления</span>
            <span className="text-xs text-[#828b95]">Битрикс24</span>
          </div>
          <div className="flex gap-3 px-4 py-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
              style={{ background: PRIORITY_COLOR[priority] || PRIORITY_COLOR.normal }}
            >
              Вх
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[#333]">Входящие · {priorityLabel(priority)}</p>
                <p className="shrink-0 text-xs text-[#a8adb4]">сейчас</p>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-5 text-[#525c69]">{text}</p>
              <ul className="mt-3 grid gap-1 border-t border-[#e6ebef] pt-3 text-xs text-[#525c69]">
                {recipients.map((person) => (
                  <li key={person.id}>
                    {person.name}
                    {person.login ? ` · ${person.login}` : ""} · ID Б24 {person.externalId}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
