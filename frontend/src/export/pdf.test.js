import { beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.fn();
const text = vi.fn();
const splitTextToSize = vi.fn((value) => {
  const raw = String(value ?? "");
  return raw ? [raw] : [];
});
const addPage = vi.fn();
const setPage = vi.fn();
const setFont = vi.fn();
const line = vi.fn();
const addImage = vi.fn();
const rect = vi.fn();
const link = vi.fn();
const circle = vi.fn();
const roundedRect = vi.fn();
const setFontSize = vi.fn();
const getTextWidth = vi.fn((value) => String(value).length);
const addFileToVFS = vi.fn();
const addFont = vi.fn();

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    addFileToVFS,
    addFont,
    setFont,
    setFontSize,
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setLineWidth: vi.fn(),
    text,
    splitTextToSize,
    getTextWidth,
    addPage,
    setPage,
    getNumberOfPages: () => 1,
    line,
    addImage,
    link,
    circle,
    rect,
    roundedRect,
    save,
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
  })),
}));

import { cardFromRitual, countryFlagCodes, exportPdf, pdfSafe } from "./pdf";

const ritual = {
  language: "de",
  answers: { q0: 2, q1: 2, q2: 0, q3: 1, q4: 0, q5: 0 },
  result: {
    anima_card: {
      archetype_symbol: "circle",
      element: "water",
      inner_rhythm: "circle",
      emotional_intensity: 5,
      travel_direction: "inward",
      dominant_frequency: "Stille",
    },
    matches: [{ id: "azores" }],
  },
};

beforeEach(() => {
  save.mockClear();
  text.mockClear();
  setFont.mockClear();
  line.mockClear();
  addImage.mockClear();
  rect.mockClear();
  link.mockClear();
  circle.mockClear();
  roundedRect.mockClear();
});

describe("countryFlagCodes", () => {
  it("maps atlas countries to flag codes and leaves regions without a flag", () => {
    expect(countryFlagCodes("Peru")).toEqual(["PE"]);
    expect(countryFlagCodes("USA/Canada")).toEqual(["US", "CA"]);
    expect(countryFlagCodes("UK")).toEqual(["GB"]);
    expect(countryFlagCodes("Tibet")).toEqual([]);
    expect(countryFlagCodes("Hawaii")).toEqual([]);
  });
});

describe("pdfSafe", () => {
  it("keeps German letters and Cyrillic, and replaces dashes the layout does not need", () => {
    expect(pdfSafe("2–3 Aktivitäten — „Ruhe“")).toBe('2-3 Aktivitäten - "Ruhe"');
    expect(pdfSafe("Größe")).toBe("Größe");
    expect(pdfSafe("Мачу-Пикчу — «Перу»")).toBe("Мачу-Пикчу - «Перу»");
  });
});

describe("exportPdf", () => {
  it("writes places from client state and never fetches", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const card = cardFromRitual(ritual);
    exportPdf({
      messages: [
        {
          role: "assistant",
          content: "Azoren — Vertiefung.\nAnreise (allgemein)\n- Fähre zwischen den Inseln.",
          recommendedPlaces: [{ id: "mp", name: "Machu Picchu", booking_link: "/go/mp" }],
        },
      ],
      disclosure: "Du interagierst mit einer KI.",
      card,
      language: "de",
    });
    const written = text.mock.calls.map((call) => call[0]).join("\n");
    expect(save).toHaveBeenCalledWith("soulmap.pdf");
    expect(written.indexOf(card.name)).toBeGreaterThanOrEqual(0);
    expect(written.indexOf(card.name)).toBeLessThan(written.indexOf("Willkommen"));
    expect(written.indexOf("Druckkarte")).toBeLessThan(written.indexOf(card.name));
    expect(written).toContain("Deine SoulMap");
    expect(written).toContain("Die kleine Karte zum Mitnehmen, mit Symbolen und Zitat.");
    expect(written).toContain(pdfSafe(card.desc));
    const cardBox = roundedRect.mock.calls.find((call) => call[6] === "FD");
    expect(cardBox).toBeTruthy();
    const [, boxTop, , boxHeight] = cardBox;
    const cardLines = ["Druckkarte", "Deine SoulMap", card.name, pdfSafe(card.desc)];
    for (const line of cardLines) {
      const marks = text.mock.calls.filter((call) => String(call[0]).includes(line));
      expect(marks.length).toBeGreaterThan(0);
      for (const mark of marks) {
        expect(mark[2]).toBeGreaterThan(boxTop);
        expect(mark[2]).toBeLessThan(boxTop + boxHeight);
      }
    }
    const circleBottom = Math.max(...circle.mock.calls.map((call) => call[1] + call[2]));
    expect(circleBottom).toBeLessThanOrEqual(boxTop);
    expect(written.indexOf("Willkommen")).toBeLessThan(written.indexOf("Machu Picchu"));
    expect(written).toContain("Unterkunft auf booking.com");
    expect(rect.mock.calls.length).toBeGreaterThan(20);
    expect(link.mock.calls.some((call) => String(call[4]?.url).startsWith("https://www.booking.com/"))).toBe(true);
    expect(written).toContain("Azoren - Vertiefung.");
    expect(written).not.toMatch(/[\u2013\u2014\u201E]/);
    expect(new Set(setFont.mock.calls.map((call) => call[0]))).toEqual(new Set(["NotoSans"]));
    expect(addFont).toHaveBeenCalledWith("NotoSans-Regular.ttf", "NotoSans", "normal");
    expect(addFont).toHaveBeenCalledWith("NotoSans-Bold.ttf", "NotoSans", "bold");
    expect(addFont).toHaveBeenCalledWith("NotoSans-Italic.ttf", "NotoSans", "italic");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("labels each place with its country and separates the descriptions", () => {
    const before = line.mock.calls.length;
    exportPdf({
      messages: [
        {
          role: "assistant",
          content: "NICHT-DOPPELN",
          sections: [
            { kind: "overview", text: "Gemeinsame Anreise." },
            {
              kind: "place",
              text: "Steinerne Stadt in den Anden.",
              placeId: "mp",
              name: "Machu Picchu",
              country: "Peru",
              primaervibration: "Sacred Mountain",
            },
            {
              kind: "place",
              text: "Roter Fels in der Wüste.",
              placeId: "sedona",
              name: "Sedona",
              country: "USA",
              primaervibration: "Red Rock",
            },
          ],
          recommendedPlaces: [{ id: "mp", name: "Machu Picchu", country: "Peru", booking_link: "/go/mp" }],
        },
      ],
      language: "de",
    });
    const written = text.mock.calls.map((call) => call[0]).join("\n");
    expect(written.indexOf("Machu Picchu")).toBeGreaterThanOrEqual(0);
    expect(written.indexOf("Machu Picchu")).toBeLessThan(written.indexOf("Peru"));
    expect(written.indexOf("Peru")).toBeLessThan(written.indexOf("Sedona"));
    expect(written.indexOf("Sedona")).toBeLessThan(written.indexOf("USA"));
    expect(written).toContain("Steinerne Stadt in den Anden.");
    expect(written).toContain("Roter Fels in der Wüste.");
    expect(written).toContain("Gemeinsame Anreise.");
    expect(written).not.toContain("NICHT-DOPPELN");
    expect(line.mock.calls.length).toBeGreaterThan(before);
  });

  it("leaves out the notice that the assistant is unavailable", () => {
    exportPdf({
      messages: [
        {
          role: "assistant",
          source: "fallback",
          content:
            "Unser KI-Assistent ist gerade nicht erreichbar. Basierend auf deiner Anfrage empfehlen wir dir: Machu Picchu.",
          recommendedPlaces: [{ id: "mp", name: "Machu Picchu", country: "Peru", booking_link: "/go/mp" }],
        },
      ],
      language: "de",
    });
    const written = text.mock.calls.map((call) => call[0]).join("\n");
    expect(written).not.toContain("nicht erreichbar");
    expect(written).toContain("Machu Picchu");
    expect(written).toContain("Peru");
    expect(written).toContain("Basierend auf deiner Anfrage empfehlen wir dir: Machu Picchu.");
  });

  it("writes Russian place names instead of dropping them", () => {
    exportPdf({
      language: "ru",
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
    const written = text.mock.calls.map((call) => call[0]).join("\n");
    expect(written).toContain("Мачу-Пикчу");
    expect(written).toContain("Перу");
    expect(written).toContain("Священная гора");
    expect(written).toContain("Хранитель");
    expect(written).toContain("Каменный город в Андах.");
    expect(written).toContain("Места");
    expect(written).not.toContain("Sacred Mountain");
  });

  it("rejects an empty transcript", () => {
    expect(() => exportPdf({ messages: [] })).toThrow("Kein Ergebnis zum Exportieren.");
  });
});

describe("cardFromRitual", () => {
  it("reads the generated card, quote and symbols", () => {
    expect(cardFromRitual(null)).toBeNull();
    const card = cardFromRitual(ritual);
    expect(card.name).toBeTruthy();
    expect(card.desc).toBeTruthy();
    expect(card.icons).toHaveLength(6);
    expect(card.element).toBe("water");
    expect(card.frequency).toBe("Stille");
  });
});
