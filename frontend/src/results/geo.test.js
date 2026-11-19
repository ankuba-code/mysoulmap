import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGeo } from "./geo";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadGeo", () => {
  it("returns the GeoLite2 area from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          country_code: "DE",
          latitude: 52.52,
          longitude: 13.4,
          accuracy_radius_km: 20,
        }),
      })),
    );
    await expect(loadGeo()).resolves.toEqual({
      country_code: "DE",
      latitude: 52.52,
      longitude: 13.4,
      accuracy_radius_km: 20,
    });
    expect(fetch).toHaveBeenCalledWith("/api/geo");
  });

  it("returns nothing when the address has no GeoLite2 area", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ country_code: "XX", latitude: null, longitude: null, accuracy_radius_km: null }),
      })),
    );
    await expect(loadGeo()).resolves.toBeNull();
  });
});
