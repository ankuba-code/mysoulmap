import { afterEach, describe, expect, it, vi } from "vitest";
import { postChat } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postChat", () => {
  it("posts JSON to /api/chat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ source: "llm", ai_disclosure: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const payload = { messages: [{ role: "user", content: "Hallo" }], shown_place_ids: [], language: "de" };
    await expect(postChat(payload)).resolves.toEqual({ source: "llm", ai_disclosure: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("maps the spec error payload to an Error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: "RATE_LIMITED", message: "Zu viele Anfragen. Bitte warte einen Moment." },
        }),
      }),
    );
    await expect(postChat({})).rejects.toThrow("Zu viele Anfragen. Bitte warte einen Moment.");
  });
});
