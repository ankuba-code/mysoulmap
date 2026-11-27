import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStats, loginAdmin, switchChatModel } from "./api";

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

  it("posts the selected chat model", async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ model: "claude-haiku-5-5" }),
    });
    await switchChatModel("claude-haiku-5-5");
    expect(fetch).toHaveBeenCalledWith("/api/admin/model", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-5-5" }),
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
