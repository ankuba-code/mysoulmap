import { describe, expect, it, vi } from "vitest";
import { detectLanguage } from "./language";

describe("detectLanguage", () => {
  it("uses the language the server chose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ language: "es" }) })),
    );
    await expect(detectLanguage()).resolves.toBe("es");
    vi.unstubAllGlobals();
  });

  it("stays unset when the server cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(detectLanguage()).resolves.toBeNull();
    vi.unstubAllGlobals();
  });
});
