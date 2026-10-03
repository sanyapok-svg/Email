import type { NoticeField } from "@/lib/b24/notice";

export type { NoticeField };

export type ConditionOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "in"
  | "not_in"
  | "intersects"
  | "not_intersects"
  | "exists"
  | "not_exists"
  | "gt"
  | "lt"
  | "before"
  | "after"
  | "empty"
  | "not_empty"
  | "full_text_match"
  | "phrase_match"
  | "always";

export type Condition = {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean | string[] | null;
};

export type ConditionGroup = {
  op: "all" | "any" | "none";
  conditions: Array<Condition | ConditionGroup>;
};

export type ConditionNode = Condition | ConditionGroup;

export type Priority = "low" | "normal" | "high" | "critical";

export type NoticeGrouping = "each" | "digest";

export type RuleAction = {
  notificationEnabled: boolean;
  category?: string | null;
  priority: Priority;
  responseHours: number;
  useExtractedDeadline: boolean;
  recipientIds: string[];
  throttlingEnabled: boolean;
  notifyOutsidePolicy?: "send_now" | "defer" | "cancel";
  noticeGrouping: NoticeGrouping;
  noticeFields: NoticeField[];
  noticeMetaOptional?: boolean;
};

export type RuleRecord = {
  id: string;
  name: string;
  type: "exclude" | "notify";
  position: number;
  active: boolean;
  category: string | null;
  conditions: ConditionNode;
  action: RuleAction;
};

export function isGroup(node: ConditionNode): node is ConditionGroup {
  return "conditions" in node && Array.isArray(node.conditions);
}
