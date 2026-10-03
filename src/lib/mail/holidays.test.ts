import { describe, expect, it } from "vitest";
import { collapseHolidayRanges, expandHolidayRanges, mergeHolidayRanges } from "@/lib/mail/holidays";

describe("holiday ranges", () => {
  it("keeps a single day and a continuous interval", () => {
    expect(collapseHolidayRanges(["2026-01-01", "2026-01-02", "2026-01-03", "2026-05-09"])).toEqual([
      { start: "2026-01-01", end: "2026-01-03" },
      { start: "2026-05-09", end: "2026-05-09" },
    ]);
  });

  it("merges overlapping intervals and expands them back to days", () => {
    const merged = mergeHolidayRanges([
      { start: "2026-12-31", end: "2027-01-02" },
      { start: "2027-01-02", end: "2027-01-08" },
    ]);
    expect(merged).toEqual([{ start: "2026-12-31", end: "2027-01-08" }]);
    expect(expandHolidayRanges(merged)).toHaveLength(9);
    expect(expandHolidayRanges(merged)[0]).toBe("2026-12-31");
    expect(expandHolidayRanges(merged).at(-1)).toBe("2027-01-08");
  });
});
