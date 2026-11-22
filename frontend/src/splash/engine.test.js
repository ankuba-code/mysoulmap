import { describe, expect, it } from "vitest";
import { phaseInfo, textOpacity } from "./engine";

describe("splash phases", () => {
  it("keeps the opening still before the first morph", () => {
    expect(phaseInfo(0)).toMatchObject({ index: 0, blend: 0 });
    expect(textOpacity(0, 0)).toBeGreaterThan(0.9);
    expect(textOpacity(0, 1)).toBe(0);
  });

  it("fades a phase out before the next one is named", () => {
    const mid = phaseInfo(0.2);
    expect(mid.index).toBe(1);
    expect(mid.blend).toBe(0);
    expect(textOpacity(0.99, 5)).toBeGreaterThan(0.5);
    expect(textOpacity(0.99, 0)).toBe(0);
  });
});
