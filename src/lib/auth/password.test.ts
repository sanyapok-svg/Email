import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("service passwords", () => {
  it("accepts the original password and rejects another", () => {
    const stored = hashPassword("panel-secret");
    expect(stored).not.toContain("panel-secret");
    expect(verifyPassword("panel-secret", stored)).toBe(true);
    expect(verifyPassword("other-secret", stored)).toBe(false);
    expect(verifyPassword("panel-secret", "plain")).toBe(false);
  });
});
