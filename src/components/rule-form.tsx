"use client";

import { useActionState, useState } from "react";
import { OPERATORS, RULE_FIELDS } from "@/lib/rules/fields";
import { saveRule, testRule } from "@/server/rules";

type ConditionRow = { field: string; operator: string; value: string };

export function RuleForm({
  mailboxId,
  mailboxes,
  templates,
  recipients,
  initial,
}: {
  mailboxId?: string;
  mailboxes: Array<{ id: string; name: string }>;
  templates: Array<{ id: string; name: string; mailboxId: string }>;
  recipients: Array<{ id: string; name: string }>;
  initial?: {
    id: string;
    mailboxId: string;
    name: string;
    type: string;
    position: number;
    active: boolean;
    category: string | null;
    dryRun: boolean;
    op: "all" | "any" | "none";
    conditions: ConditionRow[];
    notificationEnabled: boolean;
    priority: string;
    responseHours: number;
    useExtractedDeadline: boolean;
    recipientIds: string[];
    autoReplyEnabled: boolean;
    templateId: string;
    replyRespectWorkingHours: boolean;
    throttlingEnabled: boolean;
  };
}) {
  const [op, setOp] = useState<"all" | "any" | "none">(initial?.op || "all");
  const [rows, setRows] = useState<ConditionRow[]>(initial?.conditions.length ? initial.conditions : [{ field: "subject", operator: "contains", value: "" }]);
  const [selectedMailbox, setSelectedMailbox] = useState(initial?.mailboxId || mailboxId || mailboxes[0]?.id || "");
  const [testState, testAction, pending] = useActionState(testRule, null);
  const conditions = JSON.stringify({ op, conditions: rows.map((row) => ({ ...row, value: row.value })) });
  const visibleTemplates = templates.filter((item) => item.mailboxId === selectedMailbox);

  return (
    <div className="grid gap-6">
      <form action={saveRule} className="grid gap-4">
        {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
        <input type="hidden" name="conditions" value={conditions} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Ящик
            <select className="mt-1" name="mailboxId" value={selectedMailbox} onChange={(event) => setSelectedMailbox(event.target.value)}>
              {mailboxes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Название
            <input className="mt-1" name="name" defaultValue={initial?.name || ""} required />
          </label>
          <label className="text-sm">
            Тип
            <select className="mt-1" name="type" defaultValue={initial?.type || "notify"}>
              <option value="exclude">Исключение</option>
              <option value="notify">Уведомление или ответ</option>
            </select>
          </label>
          <label className="text-sm">
            Позиция
            <input className="mt-1" name="position" type="number" defaultValue={initial?.position || 100} />
          </label>
          <label className="text-sm">
            Категория
            <input className="mt-1" name="category" defaultValue={initial?.category || ""} />
          </label>
          <label className="text-sm">
            Приоритет
            <select className="mt-1" name="priority" defaultValue={initial?.priority || "normal"}>
              <option value="low">низкий</option>
              <option value="normal">обычный</option>
              <option value="high">высокий</option>
              <option value="critical">критичный</option>
            </select>
          </label>
          <label className="text-sm">
            Срок ответа, часы
            <input className="mt-1" name="responseHours" type="number" defaultValue={initial?.responseHours || 24} />
          </label>
          <label className="text-sm">
            Шаблон ответа
            <select className="mt-1" name="templateId" defaultValue={initial?.templateId || ""}>
              <option value="">не выбран</option>
              {visibleTemplates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
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
        <label className="text-sm">
          Получатели Битрикс24
          <select className="mt-1" name="recipientIds" multiple defaultValue={initial?.recipientIds || []} size={Math.min(6, Math.max(3, recipients.length))}>
            {recipients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-2 md:grid-cols-3">
          <Check name="active" label="Правило активно" defaultChecked={initial?.active ?? true} />
          <Check name="dryRun" label="Сухой прогон правила" defaultChecked={initial?.dryRun} />
          <Check name="notificationEnabled" label="Создавать уведомление" defaultChecked={initial?.notificationEnabled ?? true} />
          <Check name="autoReplyEnabled" label="Автоматический ответ" defaultChecked={initial?.autoReplyEnabled} />
          <Check name="useExtractedDeadline" label="Срок из дедлайна письма" defaultChecked={initial?.useExtractedDeadline} />
          <Check name="replyRespectWorkingHours" label="Ответ по рабочим часам" defaultChecked={initial?.replyRespectWorkingHours} />
          <Check name="throttlingEnabled" label="Троттлинг" defaultChecked={initial?.throttlingEnabled ?? true} />
        </div>
        <button type="submit">Сохранить правило</button>
      </form>
      {initial ? (
        <form action={testAction} className="grid gap-3 rounded-xl border border-line bg-card p-4">
          <input type="hidden" name="id" value={initial.id} />
          <h2 className="font-semibold">Проверка без отправки</h2>
          <label className="text-sm">
            ID сохранённого письма
            <input className="mt-1" name="messageId" placeholder="можно оставить пустым и заполнить поля ниже" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <input name="subject" placeholder="Тема" />
            <input name="fromEmail" placeholder="from@example.com" />
          </div>
          <textarea name="body" rows={5} placeholder="Текст письма" />
          <div className="grid gap-3 md:grid-cols-2">
            <input name="headerName" placeholder="auto-submitted" />
            <input name="headerValue" placeholder="auto-replied" />
          </div>
          <button className="secondary" type="submit" disabled={pending}>
            {pending ? "Проверяем" : "Проверить правило"}
          </button>
          {testState?.text ? <p className="text-sm">{testState.text}</p> : null}
        </form>
      ) : null}
    </div>
  );

  function update(index: number, patch: Partial<ConditionRow>) {
    setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input style={{ width: "auto" }} type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}
