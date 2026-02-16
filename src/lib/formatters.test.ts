import { describe, expect, it } from "vitest";

import { formatCompactCurrency, formatCurrency, formatPercent, trendClass } from "./formatters";

describe("formatters", () => {
  it("returns an em dash for invalid currency input", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(Number.NaN)).toBe("—");
    expect(formatCompactCurrency(Infinity)).toBe("—");
  });

  it("formats percent with sign and precision", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-0.556)).toBe("-0.56%");
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("returns trend classes for positive, negative, zero, and invalid", () => {
    expect(trendClass(1)).toBe("is-up");
    expect(trendClass(-1)).toBe("is-down");
    expect(trendClass(0)).toBe("is-flat");
    expect(trendClass(null)).toBe("is-flat");
  });
});
