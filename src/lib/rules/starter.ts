import type { RuleAction, RuleRecord } from "@/lib/rules/types";

const notifyDefaults: RuleAction = {
  notificationEnabled: true,
  priority: "normal",
  responseHours: 24,
  useExtractedDeadline: false,
  recipientIds: [],
  autoReplyEnabled: false,
  templateId: null,
  replyRespectWorkingHours: false,
  throttlingEnabled: true,
};

export function starterRules(): Array<Omit<RuleRecord, "id">> {
  return [
    {
      name: "Исключить автоответы",
      type: "exclude",
      position: 10,
      active: true,
      category: null,
      dryRun: false,
      action: { ...notifyDefaults, notificationEnabled: false },
      conditions: {
        op: "all",
        conditions: [
          { field: "header.auto-submitted", operator: "exists" },
          { field: "header.auto-submitted", operator: "neq", value: "no" },
        ],
      },
    },
    {
      name: "Исключить рассылки",
      type: "exclude",
      position: 20,
      active: true,
      category: null,
      dryRun: false,
      action: { ...notifyDefaults, notificationEnabled: false },
      conditions: {
        op: "any",
        conditions: [
          { field: "header.precedence", operator: "in", value: "bulk, list, junk" },
          { field: "header.list-unsubscribe", operator: "exists" },
          { field: "header.list-id", operator: "exists" },
        ],
      },
    },
    {
      name: "Исключить служебные адреса",
      type: "exclude",
      position: 30,
      active: true,
      category: null,
      dryRun: false,
      action: { ...notifyDefaults, notificationEnabled: false },
      conditions: {
        op: "any",
        conditions: [
          { field: "from_email", operator: "contains", value: "no-reply" },
          { field: "from_email", operator: "contains", value: "noreply" },
          { field: "from_email", operator: "contains", value: "mailer-daemon" },
          { field: "from_email", operator: "contains", value: "postmaster" },
          { field: "subject", operator: "starts_with", value: "automatic reply" },
        ],
      },
    },
  ];
}
