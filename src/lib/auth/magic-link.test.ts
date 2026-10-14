import { describe, expect, it } from "vitest";
import { readConfirmLink, signConfirmLink } from "@/lib/auth/magic-link";

const secret = "test-secret-test-secret-test-secret";

describe("email confirmation links", () => {
  it("accepts a fresh link and keeps the user and email", () => {
    const token = signConfirmLink("user-1", "User@Firm.ru", secret, 1_000);
    expect(readConfirmLink(token, secret, 1_000)).toEqual({ status: "ok", userId: "user-1", email: "user@firm.ru" });
  });

  it("marks an old link as expired without dropping the email", () => {
    const token = signConfirmLink("user-1", "a@b.ru", secret, 1_000, 1_000);
    expect(readConfirmLink(token, secret, 3_000)).toEqual({ status: "expired", userId: "user-1", email: "a@b.ru" });
  });

  it("rejects a tampered link", () => {
    const token = signConfirmLink("user-1", "a@b.ru", secret, 1_000);
    const [body] = token.split(".");
    expect(readConfirmLink(`${body}.not-the-signature`, secret, 1_000).status).toBe("invalid");
  });
});
