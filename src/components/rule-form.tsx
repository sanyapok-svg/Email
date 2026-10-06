"use client";

import Link from "next/link";
import { useState } from "react";
import { B24NoticePreview, type NoticeRecipient } from "@/components/b24-notice-preview";
import { DEFAULT_NOTICE_FIELDS, NOTICE_FIELDS } from "@/lib/b24/notice";
import { OPERATORS, RULE_FIELDS } from "@/lib/rules/fields";
import { saveRule, deleteRule } from "@/server/rules";
import { ConfirmDelete } from "@/components/confirm-delete";

type ConditionRow = { field: string; operator: string; value: string };

export function RuleForm({
  mailboxId,
  mailboxes,
  recipients,
  initial,
  defaults,
}: {
  mailboxId?: string;
  mailboxes: Array<{ id: string; name: string }>;
  recipients: Array<NoticeRecipient & { active: boolean; dismissed?: boolean }>;
  initial?: {
    id: string;
    mailboxId: string;
    name: string;
    type: string;
    position: number;
    active: boolean;
    category: string | null;
    op: "all" | "any" | "none";
    conditions: ConditionRow[];
    notificationEnabled: boolean;
    priority: string;
    responseHours: number;
    useExtractedDeadline: boolean;
    recipientIds: string[];
    throttlingEnabled: boolean;
    notifyOutsidePolicy: string;
    noticeGrouping: "each" | "digest";
    noticeFields: string[];
  };
  defaults?: {
    notifyOutsidePolicy?: string;
  };
}) {
  const [op, setOp] = useState<"all" | "any" | "none">(initial?.op || "all");
  const [rows, setRows] = useState<ConditionRow[]>(initial?.conditions.length ? initial.conditions : [{ field: "subject", operator: "contains", value: "" }]);
  const selectedMailbox = initial?.mailboxId || mailboxId || mailboxes[0]?.id || "";
  const [ruleType, setRuleType] = useState(initial?.type || "notify");
  const [priority, setPriority] = useState(initial?.priority || "normal");
  const [category, setCategory] = useState(initial?.category || "");
  const [responseHours, setResponseHours] = useState(initial?.responseHours || 24);
  const [notifyOn, setNotifyOn] = useState(initial?.notificationEnabled ?? true);
  const [picked, setPicked] = useState<string[]>(initial?.recipientIds || []);
  const [outsidePolicy, setOutsidePolicy] = useState(initial?.notifyOutsidePolicy || defaults?.notifyOutsidePolicy || "defer");
  const [noticeGrouping, setNoticeGrouping] = useState<"each" | "digest">(initial?.noticeGrouping || "each");
  const [noticeFields, setNoticeFields] = useState<string[]>(initial ? initial.noticeFields : [...DEFAULT_NOTICE_FIELDS]);
  const conditions = JSON.stringify({ op, conditions: rows.map((row) => ({ ...row, value: row.value })) });
  const mailboxName = mailboxes.find((item) => item.id === selectedMailbox)?.name || "";
  const chosen = recipients.filter((item) => picked.includes(item.id));
  const listed = recipients.filter((item) => (item.active && !item.dismissed) || picked.includes(item.id));

  return (
    <div className="grid gap-6">
      <form action={saveRule} className="grid gap-4">
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="mailboxId" value={selectedMailbox} />
        <input type="hidden" name="conditions" value={conditions} />
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm">
          Правило ящика{" "}
          <Link className="font-semibold underline" href={`/mailboxes#mailbox-${selectedMailbox}`}>
            {mailboxName || "без имени"}
          </Link>
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Название
            <input className="mt-1" name="name" defaultValue={initial?.name || ""} required />
          </label>
          <label className="text-sm">
            Тип
            <select className="mt-1" name="type" value={ruleType} onChange={(event) => setRuleType(event.target.value)}>
              <option value="exclude">Исключение</option>
              <option value="notify">Уведомление</option>
            </select>
          </label>
          <label className="text-sm">
            Позиция
            <input className="mt-1" name="position" type="number" defaultValue={initial?.position || 100} />
          </label>
          <label className="text-sm">
            Категория
            <input className="mt-1" name="category" value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
          <label className="text-sm">
            Приоритет
            <select className="mt-1" name="priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">низкий</option>
              <option value="normal">обычный</option>
              <option value="high">высокий</option>
              <option value="critical">критичный</option>
            </select>
          </label>
          <label className="text-sm">
            Срок ответа, часы
            <input className="mt-1" name="responseHours" type="number" value={responseHours} onChange={(event) => setResponseHours(Number(event.target.value))} />
          </label>
        </div>
        <label className="text-sm">
          Группа условий
          <select className="mt-1" value={op} onChange={(event) => setOp(event.target.value as "all" | "any" | "none")}>
            <option value="all">все условия</option>
            <option value="any">любое условие</option>
            <option value="none">ни одно условие</option>
          </select>
        </label>
        <div className="grid gap-2">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1.2fr_1fr_1.2fr_auto]">
              <select value={row.field} onChange={(event) => update(index, { field: event.target.value })}>
                {RULE_FIELDS.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </select>
              <select value={row.operator} onChange={(event) => update(index, { operator: event.target.value })}>
                {OPERATORS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input value={row.value} onChange={(event) => update(index, { value: event.target.value })} placeholder="значение или список через запятую" />
              <button className="secondary" type="button" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))}>
                Убрать
              </button>
            </div>
          ))}
          <button className="secondary" type="button" onClick={() => setRows([...rows, { field: "body_new_text", operator: "contains", value: "" }])}>
            Добавить условие
          </button>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className="grid min-w-0 content-start gap-2 rounded-xl border border-line bg-card p-4">
            <h2 className="font-semibold">Получатели в Битрикс24</h2>
            <p className="text-sm text-muted">
              Отметьте, кому уйдёт уведомление. Список ведётся в разделе <Link className="underline" href="/b24-users">Сотрудники Б24</Link>.
            </p>
            {listed.length === 0 ? (
              <p className="text-sm">Активных пользователей пока нет.</p>
            ) : (
              <div className="grid gap-1">
                {listed.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-paper">
                    <input
                      style={{ width: "auto" }}
                      type="checkbox"
                      name="recipientIds"
                      value={item.id}
                      checked={picked.includes(item.id)}
                      onChange={(event) =>
                        setPicked((current) => (event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))
                      }
                    />
                    <span>
                      <span className="font-medium">{item.name}</span>
                      <span className="block text-muted">
                        {item.login} · ID Б24 {item.externalId}
                        {item.dismissed ? " · уволен" : item.active ? "" : " · выключен"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {ruleType === "exclude" ? (
              <>
                <input type="hidden" name="notifyOutsidePolicy" value={outsidePolicy} />
                <input type="hidden" name="noticeGrouping" value={noticeGrouping} />
                {noticeFields.map((id) => (
                  <input key={id} type="hidden" name="noticeFields" value={id} />
                ))}
              </>
            ) : (
              <div className="mt-3 grid gap-3 border-t border-line pt-3">
                <label className="text-sm">
                  Уведомления вне рабочих часов
                  <select className="mt-1" name="notifyOutsidePolicy" value={outsidePolicy} onChange={(event) => setOutsidePolicy(event.target.value)}>
                    <option value="defer">отложить</option>
                    <option value="send_now">отправить сразу</option>
                    <option value="cancel">отменить</option>
                  </select>
                </label>
                <label className="text-sm">
                  Несколько писем за проверку
                  <select
                    className="mt-1"
                    name="noticeGrouping"
                    value={noticeGrouping}
                    onChange={(event) => setNoticeGrouping(event.target.value === "digest" ? "digest" : "each")}
                  >
                    <option value="each">отдельное уведомление на каждое письмо</option>
                    <option value="digest">одно уведомление со всеми письмами</option>
                  </select>
                </label>
                <p className="text-sm text-muted">
                  {noticeGrouping === "digest"
                    ? "За одну проверку уходит одно сообщение всем выбранным сотрудникам. В нём каждое письмо расписано отдельно."
                    : "За одну проверку каждое подходящее письмо уходит отдельным сообщением всем выбранным сотрудникам."}
                </p>
                <div className="text-sm">
                  Что передать из письма
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {NOTICE_FIELDS.map(([id, label]) => (
                      <label key={id} className="flex items-center gap-2">
                        <input
                          style={{ width: "auto" }}
                          type="checkbox"
                          checked={noticeFields.includes(id)}
                          onChange={() =>
                            setNoticeFields((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {noticeFields.map((id) => (
                    <input key={id} type="hidden" name="noticeFields" value={id} />
                  ))}
                </div>
              </div>
            )}
          </section>
          <B24NoticePreview
            enabled={ruleType !== "exclude" && notifyOn}
            mailboxName={mailboxName}
            priority={priority}
            category={category}
            responseHours={responseHours}
            recipients={chosen}
            grouping={noticeGrouping}
            fields={noticeFields}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Check name="active" label="Правило активно" defaultChecked={initial?.active ?? true} />
          <Check name="notificationEnabled" label="Создавать уведомление" defaultChecked={initial?.notificationEnabled ?? true} onChange={setNotifyOn} />
          <Check name="useExtractedDeadline" label="Срок из дедлайна письма" defaultChecked={initial?.useExtractedDeadline} />
          <Check name="throttlingEnabled" label="Троттлинг" defaultChecked={initial?.throttlingEnabled ?? true} />
        </div>
        <button type="submit">Сохранить правило</button>
      </form>
      {initial ? (
        <ConfirmDelete
          action={deleteRule}
          id={initial.id}
          label="Удалить правило"
          title="Удалить правило"
          text={`Правило «${initial.name || "без названия"}» будет удалено. Письма и уведомления останутся, но уже без этого правила.`}
        />
      ) : null}
    </div>
  );

  function update(index: number, patch: Partial<ConditionRow>) {
    setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
}

function Check({
  name,
  label,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        style={{ width: "auto" }}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
      />
      {label}
    </label>
  );
}
