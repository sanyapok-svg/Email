import { describe, expect, it } from "vitest";
import { applyRecipientChange, planOpenNotification, validateDecisions } from "@/lib/b24/dismiss";

const replacements = new Set(["boris", "vera"]);

describe("dismissal choices", () => {
  it("removes the only recipient by deactivating and refuses to drop the notification empty", () => {
    expect(applyRecipientChange(["anna"], "anna", "deactivate", "")).toEqual([]);
    expect(validateDecisions({
      employeeId: "anna",
      rules: [{ id: "rule", type: "notify", recipientIds: ["anna"] }],
      decisions: [{ ruleId: "rule", choice: "remove", replacementId: "" }],
      replacementIds: replacements,
    })).toEqual({ ok: false, error: "Единственного получателя можно заменить или выключить уведомление" });
  });

  it("replaces the employee once, even if the replacement is already a recipient", () => {
    expect(applyRecipientChange(["anna", "boris"], "anna", "replace", "boris")).toEqual(["boris"]);
    expect(applyRecipientChange(["anna"], "anna", "replace", "vera")).toEqual(["vera"]);
  });

  it("removes the employee and leaves the other recipients", () => {
    expect(applyRecipientChange(["anna", "boris", "vera"], "anna", "remove", "")).toEqual(["boris", "vera"]);
    expect(planOpenNotification(["anna", "boris"], "anna", { ruleId: "rule", choice: "remove", replacementId: "" })).toEqual({
      recipients: ["boris"],
      cancel: false,
    });
  });

  it("cancels a queued notification when the rule is deactivated or the employee was alone", () => {
    expect(planOpenNotification(["anna"], "anna", { ruleId: "rule", choice: "deactivate", replacementId: "" })).toEqual({
      recipients: [],
      cancel: true,
    });
    expect(planOpenNotification(["anna"], "anna", null)).toEqual({ recipients: [], cancel: true });
    expect(planOpenNotification(["anna", "boris"], "anna", null)).toEqual({ recipients: ["boris"], cancel: false });
  });

  it("accepts a replacement and a removal for the matching rules", () => {
    expect(validateDecisions({
      employeeId: "anna",
      rules: [
        { id: "solo", type: "notify", recipientIds: ["anna"] },
        { id: "group", type: "notify", recipientIds: ["anna", "boris"] },
        { id: "skip", type: "exclude", recipientIds: ["anna"] },
      ],
      decisions: [
        { ruleId: "solo", choice: "replace", replacementId: "vera" },
        { ruleId: "group", choice: "remove", replacementId: "" },
      ],
      replacementIds: replacements,
    })).toEqual({ ok: true });
  });
});
