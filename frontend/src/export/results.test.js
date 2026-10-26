import { describe, expect, it } from "vitest";
import { assistantTexts, collectPlaces, hasExportableResult } from "./results";

const messages = [
  { role: "user", content: "Anden" },
  {
    role: "assistant",
    content: "Machu Picchu.",
    recommendedPlaces: [
      { id: "mp", name: "Machu Picchu", booking_link: "/go/mp" },
      { id: "mp", name: "Machu Picchu", booking_link: "/go/mp" },
    ],
  },
  {
    role: "assistant",
    content: "Sedona.",
    recommendedPlaces: [{ id: "sedona", name: "Sedona", booking_link: "/go/sedona" }],
  },
];

describe("collectPlaces", () => {
  it("deduplicates recommended places from the client transcript", () => {
    expect(collectPlaces(messages).map((place) => place.id)).toEqual(["mp", "sedona"]);
  });
});

describe("hasExportableResult", () => {
  it("is true once an assistant turn exists", () => {
    expect(hasExportableResult([])).toBe(false);
    expect(hasExportableResult(messages)).toBe(true);
    expect(assistantTexts(messages)).toEqual(["Machu Picchu.", "Sedona."]);
  });
});
