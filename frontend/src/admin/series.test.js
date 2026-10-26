import { describe, expect, it } from "vitest";
import { countryBars, fallbackBars, overviewSeries, placeBars } from "./series";

const stats = {
  daily: [{ date: "2026-09-25", form_submissions: 2, result_views: 1, fallbacks: 1 }],
  top_countries: [{ country_code: "DE", count: 3 }],
  top_clicked_places: [{ place_id: "mp", clicks: 1 }],
  llm_monitoring: { fallback_by_code: { OPENAI_UNAVAILABLE: 2 } },
};

describe("admin series", () => {
  it("maps stats into chart rows", () => {
    expect(overviewSeries(stats)).toEqual(stats.daily);
    expect(countryBars(stats)).toEqual(stats.top_countries);
    expect(placeBars(stats)).toEqual(stats.top_clicked_places);
    expect(fallbackBars(stats)).toEqual([{ code: "OPENAI_UNAVAILABLE", count: 2 }]);
  });
});
