import { describe, expect, it } from "vitest";
import { localizePlace } from "./localize";

describe("localizePlace", () => {
  const stonehenge = {
    id: "stonehenge_gb",
    name: "Stonehenge",
    country: "UK",
    primaervibration: "Megalithic Resonance",
    correspondence: "Megalithic Resonance · Timekeeper · Stone / Time",
  };

  it("writes the place, country and notes in Spanish", () => {
    const shown = localizePlace(stonehenge, "es");
    expect(shown.name).toBe("Stonehenge");
    expect(shown.country).toBe("Reino Unido");
    expect(shown.primaervibration).toBe("Resonancia megalítica");
    expect(shown.correspondence).toBe("Resonancia megalítica · Guardián del tiempo · Piedra / tiempo");
    expect(shown.flagCountry).toBe("UK");
    expect(shown.sourceName).toBe("Stonehenge");
  });

  it("writes the place, country and notes in Russian", () => {
    const shown = localizePlace(stonehenge, "ru");
    expect(shown.name).toBe("Стоунхендж");
    expect(shown.country).toBe("Великобритания");
    expect(shown.primaervibration).toBe("Мегалитический отклик");
    expect(shown.correspondence).not.toMatch(/[A-Za-z]/);
  });

  it("keeps the atlas wording in German", () => {
    expect(localizePlace(stonehenge, "de").country).toBe("UK");
  });
});
