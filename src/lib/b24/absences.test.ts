import { describe, expect, it } from "vitest";
import {
  calendarDay,
  coveringSubstituteIds,
  absenceListNote,
  parseAbsences,
  resolveRecipients,
  withoutSubstitute,
  type RecipientPerson,
} from "@/lib/b24/absences";

function person(id: string, absences: RecipientPerson["absences"] = [], active = true): RecipientPerson {
  return { id, name: id, login: `${id}@example.com`, externalId: id, active, absences };
}

describe("absence substitution", () => {
  const day = "2026-10-05";
  const anna = person("anna", [{ kind: "vacation", start: "2026-10-01", end: "2026-10-10", substituteIds: ["boris", "anna"] }]);
  const boris = person("boris");
  const vera = person("vera");
  const directory = new Map([anna, boris, vera].map((item) => [item.id, item]));

  it("keeps the employee when the day is outside the absence", () => {
    expect(resolveRecipients([anna, boris], directory, "2026-10-11").map((item) => item.id)).toEqual(["anna", "boris"]);
  });

  it("sends to substitutes instead of the absent employee and skips a second copy", () => {
    expect(resolveRecipients([anna, boris], directory, day).map((item) => item.id)).toEqual(["boris"]);
    expect(coveringSubstituteIds([anna, boris], day)).toEqual(["boris"]);
  });

  it("adds a substitute who is not already a recipient, once", () => {
    const both = person("anna", [{ kind: "sick", start: day, end: day, substituteIds: ["vera", "vera"] }]);
    const map = new Map([both, boris, vera].map((item) => [item.id, item]));
    expect(resolveRecipients([both, boris], map, day).map((item) => item.id)).toEqual(["vera", "boris"]);
  });

  it("does not chain a substitute's own absence", () => {
    const away = person("boris", [{ kind: "time_off", start: day, end: day, substituteIds: ["vera"] }]);
    const map = new Map([anna, away, vera].map((item) => [item.id, item]));
    expect(resolveRecipients([anna], map, day).map((item) => item.id)).toEqual(["boris"]);
  });

  it("keeps the employee when the absence no longer has a substitute", () => {
    const uncovered = person("anna", [{ kind: "vacation", start: day, end: day, substituteIds: [] }]);
    expect(resolveRecipients([uncovered], new Map([[uncovered.id, uncovered]]), day).map((item) => item.id)).toEqual(["anna"]);
    expect(withoutSubstitute(anna.absences, "boris")).toEqual([
      { kind: "vacation", start: "2026-10-01", end: "2026-10-10", substituteIds: ["anna"] },
    ]);
    const onlySelf = person("anna", [{ kind: "vacation", start: day, end: day, substituteIds: ["anna"] }]);
    expect(resolveRecipients([onlySelf], new Map([[onlySelf.id, onlySelf]]), day).map((item) => item.id)).toEqual(["anna"]);
    expect(withoutSubstitute([{ kind: "sick", start: day, end: day, substituteIds: ["boris", "vera"] }], "boris")).toEqual([
      { kind: "sick", start: day, end: day, substituteIds: ["vera"] },
    ]);
  });

  it("drops an inactive substitute and does not cover an inactive employee", () => {
    const inactiveSub = person("boris", [], false);
    const map = new Map([anna, inactiveSub].map((item) => [item.id, item]));
    expect(resolveRecipients([anna], map, day)).toEqual([]);
    expect(resolveRecipients([person("anna", [], false)], map, day)).toEqual([]);
  });

  it("uses the mailbox calendar day", () => {
    expect(calendarDay(new Date("2026-10-05T21:30:00Z"), "Europe/Moscow")).toBe("2026-10-06");
    expect(calendarDay(new Date("2026-10-05T20:30:00Z"), "Europe/Moscow")).toBe("2026-10-05");
    expect(calendarDay(new Date("2026-10-05T12:00:00Z"), "Not/AZone")).toBe("2026-10-05");
  });

  it("describes who covers the employee today", () => {
    const names = new Map([
      ["boris", "Борис"],
      ["vera", "Вера"],
    ]);
    expect(absenceListNote(anna.absences, names)).toBe("отпуск 01.10.2026–10.10.2026, замещает Борис");
  });
});

describe("parse absences", () => {
  const known = new Set(["boris", "vera"]);

  it("accepts a period with substitutes", () => {
    const parsed = parseAbsences(
      JSON.stringify([{ kind: "vacation", start: "2026-10-01", end: "2026-10-03", substituteIds: ["boris", "boris"] }]),
      "anna",
      known,
    );
    expect(parsed).toEqual({
      ok: true,
      absences: [{ kind: "vacation", start: "2026-10-01", end: "2026-10-03", substituteIds: ["boris"] }],
    });
  });

  it("rejects a period without a substitute or with broken dates", () => {
    expect(parseAbsences(JSON.stringify([{ kind: "sick", start: "2026-10-02", end: "2026-10-01", substituteIds: ["boris"] }]), "anna", known)).toEqual({
      ok: false,
      error: "Укажите даты отсутствия",
    });
    expect(parseAbsences(JSON.stringify([{ kind: "sick", start: "2026-10-01", end: "2026-10-02", substituteIds: [] }]), "anna", known)).toEqual({
      ok: false,
      error: "Выберите замещающего сотрудника",
    });
    expect(parseAbsences(JSON.stringify([{ kind: "sick", start: "2026-10-01", end: "2026-10-02", substituteIds: ["missing"] }]), "anna", known)).toEqual({
      ok: false,
      error: "Замещающий сотрудник не найден",
    });
    expect(parseAbsences(JSON.stringify([{ kind: "sick", start: "2026-02-31", end: "2026-03-01", substituteIds: ["boris"] }]), "anna", known)).toEqual({
      ok: false,
      error: "Укажите даты отсутствия",
    });
  });

  it("ignores an empty draft row", () => {
    expect(parseAbsences(JSON.stringify([{ kind: "vacation", start: "", end: "", substituteIds: [] }]), "anna", known)).toEqual({
      ok: true,
      absences: [],
    });
  });
});
