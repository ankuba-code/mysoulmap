import { beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.fn();
const text = vi.fn();
const splitTextToSize = vi.fn((value) => [String(value)]);
const addPage = vi.fn();
const setFont = vi.fn();
const setFontSize = vi.fn();

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setFont,
    setFontSize,
    text,
    splitTextToSize,
    addPage,
    save,
  })),
}));

import { exportPdf } from "./pdf";

beforeEach(() => {
  save.mockClear();
  text.mockClear();
});

describe("exportPdf", () => {
  it("writes places from client state and never fetches", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    exportPdf({
      messages: [
        {
          role: "assistant",
          content: "Machu Picchu.",
          recommendedPlaces: [{ id: "mp", name: "Machu Picchu", booking_link: "/go/mp" }],
        },
      ],
      disclosure: "Du interagierst mit einer KI.",
    });
    expect(save).toHaveBeenCalledWith("soulmap.pdf");
    expect(text).toHaveBeenCalledWith("Soulmap", 20, 20);
    expect(text).toHaveBeenCalledWith(["Machu Picchu"], 20, expect.any(Number));
    expect(text).toHaveBeenCalledWith(["/go/mp"], 20, expect.any(Number));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("rejects an empty transcript", () => {
    expect(() => exportPdf({ messages: [] })).toThrow("Kein Ergebnis zum Exportieren.");
  });
});
