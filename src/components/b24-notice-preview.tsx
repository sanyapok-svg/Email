import { EXAMPLE_FROM, EXAMPLE_SUBJECT, formatBitrixDigest, formatBitrixNotice, priorityLabel, type NoticeLetter } from "@/lib/b24/notice";

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
  grouping = "each",
  fields,
}: {
  enabled: boolean;
  mailboxName: string;
  priority: string;
  category: string;
  responseHours: number;
  recipients: NoticeRecipient[];
  grouping?: "each" | "digest";
  fields: readonly string[];
}) {
  const hours = Number.isFinite(responseHours) && responseHours > 0 ? responseHours : 24;
  const due = `через ${hours} ч.`;
  const first = exampleLetter(EXAMPLE_SUBJECT, EXAMPLE_FROM, "3 октября, 11:40", "Просим согласовать договор и вернуть подписанный скан до конца недели.", ["dogovor.pdf"]);
  const second = exampleLetter("Счёт № 18 от 02.10.2026", "Павел Орлов <pavel@client.ru>", "3 октября, 12:05", "Направляем счёт на оплату. Просим подтвердить получение.", ["schet.pdf"]);
  const text =
    grouping === "digest"
      ? formatBitrixDigest({
          mailboxName,
          priority,
          category,
          fields,
          letters: [
            { ...first, responseDueLabel: due },
            { ...second, responseDueLabel: due },
          ],
        })
      : formatBitrixNotice({
          mailboxName,
          priority,
          category,
          responseDueLabel: due,
          fields,
          letter: first,
        });

  return (
    <section className="min-w-0 self-start rounded-xl border border-line bg-card p-4 lg:sticky lg:top-4">
      <h2 className="font-semibold">Как это получит пользователь в Битрикс24</h2>
      <p className="mt-1 text-sm text-muted">
        {grouping === "digest"
          ? "Пример общего сообщения за одну проверку. Такой текст придёт каждому выбранному пользователю личным сообщением в мессенджере от автора веб-хука."
          : `Пример на письме «${EXAMPLE_SUBJECT}». Такой текст придёт каждому выбранному пользователю личным сообщением в мессенджере от автора веб-хука.`}
      </p>
      {!enabled ? (
        <p className="mt-4 text-sm">Для этого правила уведомление в Битрикс24 не создаётся.</p>
      ) : recipients.length === 0 ? (
        <p className="mt-4 text-sm">Выберите пользователей слева — без них уведомление некому доставить.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#d5dde3] bg-white shadow-sm">
          <div className="flex items-center justify-between bg-[#eef2f4] px-4 py-2.5">
            <span className="text-sm font-semibold text-[#333]">Мессенджер</span>
            <span className="text-xs text-[#828b95]">от автора веб-хука</span>
          </div>
          <div className="bg-[#f1f4f6] px-4 py-3">
            <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-white px-3 py-2 shadow-sm">
              <p className="text-xs font-semibold" style={{ color: PRIORITY_COLOR[priority] || PRIORITY_COLOR.normal }}>
                {fields.includes("priority") ? `Автор веб-хука · ${priorityLabel(priority)}` : "Автор веб-хука"}
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-sm leading-5 text-[#333]">{text}</p>
            </div>
            <ul className="mt-3 grid gap-1 text-xs text-[#525c69]">
                {recipients.map((person) => (
                  <li key={person.id}>
                    {person.name}
                    {person.login ? ` · ${person.login}` : ""} · ID Б24 {person.externalId}
                  </li>
                ))}
              </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function exampleLetter(subject: string, from: string, received: string, text: string, attachments: string[]): NoticeLetter {
  return {
    subject,
    from,
    received,
    text,
    attachments,
    phones: ["+7 916 000-00-00"],
    urls: ["https://client.ru/doc"],
    contracts: ["45/2026"],
    invoices: ["18"],
    amounts: ["120 000 ₽"],
    deadline: "10 октября, 18:00",
  };
}
