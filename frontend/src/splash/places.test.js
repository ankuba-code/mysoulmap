import { describe, expect, it } from "vitest";
import { toSplashPlaces } from "./places";

describe("toSplashPlaces", () => {
  it("maps atlas places onto the splash elements", () => {
    expect(
      toSplashPlaces([
        { id: "machu_picchu_pe", name: "Machu Picchu", coordinates: { lat: -13.16, lng: -72.54 }, element: "earth" },
        { id: "broken", name: "Broken", coordinates: { lat: "x", lng: 1 }, element: "water" },
      ]),
    ).toEqual([{ id: "machu_picchu_pe", name: "Machu Picchu", lat: -13.16, lon: -72.54, element: "erde" }]);
  });
});
