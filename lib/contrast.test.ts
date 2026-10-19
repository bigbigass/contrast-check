import { describe, expect, it } from "vitest";
import {
  checkContrast,
  contrastRatio,
  formatRatio,
  hexToRgb,
  normalizeHex,
  relativeLuminance,
  suggestLightnessNudge,
} from "./contrast";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });
});

describe("contrastRatio / checkContrast", () => {
  it("black on white is 21:1 and passes everything", () => {
    const r = checkContrast("#000000", "#ffffff");
    expect(r.ratio).toBeCloseTo(21, 5);
    expect(r).toMatchObject({ aaNormal: true, aaLarge: true, aaaNormal: true, aaaLarge: true, ui: true });
  });

  it("white on black is also 21:1 (order-independent)", () => {
    const r = checkContrast("#ffffff", "#000000");
    expect(r.ratio).toBeCloseTo(21, 5);
    expect(r.aaaNormal).toBe(true);
    expect(contrastRatio("#fff", "#000")).toBe(contrastRatio("#000", "#fff"));
  });

  it("#777777 on #ffffff is ~4.48:1 — fails AAA normal (and AA normal), passes large AA + UI", () => {
    const r = checkContrast("#777777", "#ffffff");
    // Exact ratio: 4.4783…
    expect(r.ratio).toBeCloseTo(4.478, 3);
    expect(r.aaaNormal).toBe(false);
    expect(r.aaNormal).toBe(false);
    expect(r.aaaLarge).toBe(false);
    expect(r.aaLarge).toBe(true);
    expect(r.ui).toBe(true);
  });

  it("identical colors are 1:1 and fail everything", () => {
    const r = checkContrast("#ffffff", "#ffffff");
    expect(r.ratio).toBe(1);
    expect(r).toMatchObject({ aaNormal: false, aaLarge: false, aaaNormal: false, aaaLarge: false, ui: false });
    expect(contrastRatio("#3366cc", "#3366cc")).toBe(1);
  });

  it("#767676 on white just passes AA normal (~4.54:1)", () => {
    const r = checkContrast("#767676", "#ffffff");
    expect(r.ratio).toBeCloseTo(4.54, 2);
    expect(r.aaNormal).toBe(true);
    expect(r.aaaNormal).toBe(false);
  });
});

describe("hex helpers", () => {
  it("normalizes short / unprefixed / uppercase hex", () => {
    expect(normalizeHex("FFF")).toBe("#ffffff");
    expect(normalizeHex("#1A1a1A")).toBe("#1a1a1a");
    expect(normalizeHex(" 0f0 ")).toBe("#00ff00");
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("zzzzzz")).toBeNull();
  });

  it("parses hex to rgb and throws on invalid", () => {
    expect(hexToRgb("#1a2b3c")).toEqual({ r: 26, g: 43, b: 60 });
    expect(() => hexToRgb("nope")).toThrow();
  });

  it("formats ratio without rounding a fail up to a pass", () => {
    expect(formatRatio(21)).toBe("21.00:1");
    expect(formatRatio(4.4999)).toBe("4.49:1");
  });
});

describe("suggestLightnessNudge", () => {
  it("returns a color that reaches AA when the pair fails", () => {
    const s = suggestLightnessNudge("#777777", "#ffffff");
    expect(s).not.toBeNull();
    expect(contrastRatio(s!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("returns the original color when it already passes", () => {
    expect(suggestLightnessNudge("#000", "#fff")).toBe("#000000");
  });
});
