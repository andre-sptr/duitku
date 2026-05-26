import {
  formatRp,
  toIsoDate,
  fromIsoDate,
  getPeriodRange,
  shiftPeriod,
} from "./format";

describe("formatRp", () => {
  it("formats thousands with dot separators", () => {
    expect(formatRp(1000)).toBe("Rp1.000");
    expect(formatRp(1500000)).toBe("Rp1.500.000");
    expect(formatRp(999)).toBe("Rp999");
    expect(formatRp(0)).toBe("Rp0");
  });
  it("handles negative amounts", () => {
    expect(formatRp(-2500)).toBe("-Rp2.500");
  });
  it("can omit the Rp symbol", () => {
    expect(formatRp(1500000, false)).toBe("1.500.000");
  });
  it("rounds to whole rupiah", () => {
    expect(formatRp(1000.6)).toBe("Rp1.001");
  });
});

describe("toIsoDate / fromIsoDate", () => {
  it("round-trips a local date", () => {
    const d = new Date(2026, 4, 26); // 26 May 2026 (month is 0-based)
    expect(toIsoDate(d)).toBe("2026-05-26");
    const back = fromIsoDate("2026-05-26");
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(4);
    expect(back.getDate()).toBe(26);
  });
  it("pads single-digit month and day", () => {
    expect(toIsoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("getPeriodRange", () => {
  const ref = new Date(2026, 4, 26); // Tuesday, 26 May 2026

  it("month spans first to last day", () => {
    const r = getPeriodRange("month", ref);
    expect(r.start).toBe("2026-05-01");
    expect(r.end).toBe("2026-05-31");
  });
  it("year spans Jan 1 to Dec 31", () => {
    const r = getPeriodRange("year", ref);
    expect(r.start).toBe("2026-01-01");
    expect(r.end).toBe("2026-12-31");
  });
  it("week runs Monday to Sunday", () => {
    const r = getPeriodRange("week", ref);
    expect(r.start).toBe("2026-05-25"); // Monday
    expect(r.end).toBe("2026-05-31"); // Sunday
  });
  it("day start equals end", () => {
    const r = getPeriodRange("day", ref);
    expect(r.start).toBe("2026-05-26");
    expect(r.end).toBe("2026-05-26");
  });
});

describe("shiftPeriod", () => {
  const ref = new Date(2026, 4, 26);
  it("moves by month in both directions", () => {
    expect(toIsoDate(shiftPeriod("month", ref, -1))).toBe("2026-04-26");
    expect(toIsoDate(shiftPeriod("month", ref, 1))).toBe("2026-06-26");
  });
  it("moves by a week (7 days)", () => {
    expect(toIsoDate(shiftPeriod("week", ref, 1))).toBe("2026-06-02");
  });
});
