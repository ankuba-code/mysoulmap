import { describe, expect, it } from "vitest";
import { goHref } from "./goHref";

describe("goHref", () => {
  it("keeps the own-domain path and adds lang", () => {
    expect(goHref("/go/mp", "de")).toBe("/go/mp?lang=de");
    expect(goHref("/go/mp", "en")).toBe("/go/mp?lang=en");
  });
});
