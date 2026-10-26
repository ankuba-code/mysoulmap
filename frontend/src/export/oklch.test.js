import { describe, expect, it } from "vitest";
import { oklchToRgb, replaceOklch } from "./oklch";

describe("oklchToRgb", () => {
  it("converts black and white", () => {
    expect(oklchToRgb("oklch(0 0 0)")).toBe("rgb(0, 0, 0)");
    expect(oklchToRgb("oklch(1 0 0)")).toBe("rgb(255, 255, 255)");
  });
});

describe("replaceOklch", () => {
  it("rewrites oklch tokens inside a css value", () => {
    expect(replaceOklch("1px solid oklch(0 0 0)")).toBe("1px solid rgb(0, 0, 0)");
    expect(replaceOklch("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });
});
