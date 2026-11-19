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
const setFontSize = vi.fn();
const getTextWidth = vi.fn((value) => String(value).length);

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
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
    line: vi.fn(),
    circle: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    save,
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
  })),
}));

import { cardFromRitual, exportPdf, pdfSafe } from "./pdf";

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
});

describe("pdfSafe", () => {
  it("keeps German letters and replaces dashes that break the standard font", () => {
    expect(pdfSafe("2–3 Aktivitäten — „Ruhe“")).toBe('2-3 Aktivitäten - "Ruhe"');
    expect(pdfSafe("Größe")).toBe("Größe");
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
    expect(written).toContain(pdfSafe(card.desc).slice(0, 24));
    expect(written.indexOf("Willkommen")).toBeLessThan(written.indexOf("Machu Picchu"));
    expect(written).toContain("/go/mp");
    expect(written).toContain("Azoren - Vertiefung.");
    expect(written).not.toMatch(/[\u2013\u2014\u201E]/);
    expect(new Set(setFont.mock.calls.map((call) => call[0]))).toEqual(new Set(["helvetica"]));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
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
