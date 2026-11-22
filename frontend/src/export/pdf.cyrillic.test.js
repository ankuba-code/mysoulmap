import { describe, expect, it } from "vitest";
import { createSoulmapPdf } from "./pdf";

describe("cyrillic pdf", () => {
  it("embeds the Cyrillic letters as Unicode, not as missing glyphs", () => {
    const doc = createSoulmapPdf({
      language: "ru",
      card: {
        language: "ru",
        name: "Восходящий огонь",
        desc: "В тебе горит то, что хочет наружу.",
        symbol: "Треугольник",
        ton: "Расширение",
        impuls: "Подъём",
        icons: [],
      },
      messages: [
        {
          role: "assistant",
          sections: [
            {
              kind: "place",
              text: "Каменный город в Андах.",
              placeId: "machu_picchu_pe",
              name: "Machu Picchu",
              country: "Peru",
              primaervibration: "Sacred Mountain",
            },
          ],
        },
      ],
    });
    expect(doc.getTextWidth("Мачу-Пикчу")).toBeGreaterThan(10);
    const raw = doc.output();
    for (const code of ["041c", "0430", "0447", "0443", "041f", "0435"]) {
      expect(raw.toLowerCase()).toContain(`<${code}>`);
    }
    expect(raw).toContain("/BaseFont /NotoSans");
  });
});
