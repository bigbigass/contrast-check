import { describe, expect, it } from "vitest";
import { formatRatioLocale, formatThreshold } from "./format";

describe("locale number formatting", () => {
  it("uses the locale decimal separator and still truncates", () => {
    expect(formatRatioLocale(4.4999, "en")).toBe("4.49:1");
    expect(formatRatioLocale(4.4999, "de")).toBe("4,49:1");
    expect(formatRatioLocale(21, "fr")).toBe("21,00:1");
    expect(formatRatioLocale(7, "ja")).toBe("7.00:1");
  });

  it("formats thresholds without forced decimals", () => {
    expect(formatThreshold(4.5, "es")).toBe("4,5:1");
    expect(formatThreshold(3, "pt")).toBe("3:1");
  });
});
