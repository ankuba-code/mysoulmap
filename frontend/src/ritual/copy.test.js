import { describe, expect, it } from "vitest";
import { pickCard } from "./card";
import { QUESTION_IDS, ritualCopy, ritualLines } from "./copy";

describe("ritualLines", () => {
  it("turns choice indexes and free text into answer lines", () => {
    const lines = ritualLines(
      { q0: 1, q3: 0, q6: "Aufbruch", q7: "Island, Vulkane" },
      "de",
    );
    expect(lines[0]).toContain("Stiller Berggipfel");
    expect(lines.some((line) => line.includes("Feuer"))).toBe(true);
    expect(lines.some((line) => line.includes("Island, Vulkane"))).toBe(true);
  });

  it("translates every ritual string in en, es and ru", () => {
    const base = flatten(ritualCopy("de"));
    for (const language of ["en", "es", "ru"]) {
      const local = Object.fromEntries(flatten(ritualCopy(language)));
      for (const [key, value] of base) {
        expect(local[key], `${language} ${key}`).toBeTruthy();
        if (["introTitle", "element", "symbol", "screenshot"].includes(key)) {
          continue;
        }
        expect(local[key], `${language} ${key}`).not.toBe(value);
      }
      for (const id of QUESTION_IDS) {
        const choices = ritualCopy("de").questions[id].choices;
        if (choices) {
          expect(ritualCopy(language).questions[id].choices).toHaveLength(choices.length);
        }
      }
    }
    const answers = { q0: 1, q1: 0, q3: 2, q4: 1 };
    expect(pickCard(answers, "en").name).not.toBe(pickCard(answers, "de").name);
    expect(pickCard(answers, "es").desc).not.toBe(pickCard(answers, "de").desc);
    expect(pickCard(answers, "ru").symbol).not.toBe(pickCard(answers, "de").symbol);
  });
});

function flatten(value, prefix = "") {
  if (Array.isArray(value)) {
    return [[prefix, value.join("|")]];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
  }
  return [[prefix, String(value)]];
}
