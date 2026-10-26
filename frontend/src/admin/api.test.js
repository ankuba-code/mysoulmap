import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStats, loginAdmin } from "./api";

describe("admin api", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("sends login credentials with cookies", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    await loginAdmin("aku", "secret");
    expect(fetch).toHaveBeenCalledWith("/api/admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "aku", password: "secret" }),
    });
  });

  it("marks missing sessions as unauthorized", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: "UNAUTHORIZED" } }),
    });
    await expect(fetchStats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
