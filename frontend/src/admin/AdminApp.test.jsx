import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminApp from "./AdminApp";

vi.mock("./api", () => ({
  fetchStats: vi.fn(),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
  switchChatModel: vi.fn(),
}));

import { fetchStats, loginAdmin, switchChatModel } from "./api";

const STATS = {
  period: "2026-08-27/2026-09-25",
  form_submissions: 1,
  result_views: 1,
  conversion_rate: 1,
  click_through_rate: 0,
  daily: [{ date: "2026-09-25", form_submissions: 1, result_views: 1, fallbacks: 1 }],
  top_countries: [{ country_code: "DE", count: 2 }],
  top_clicked_places: [{ place_id: "mp", clicks: 1 }],
  charts: {
    world: "data:image/png;base64,abc",
    daily: "data:image/png;base64,def",
  },
  monthly_report: {
    month: "2026-09",
    token_limit: 50000,
    users: [],
    topics: [{ label: "Wochenende am Meer", count: 2 }],
  },
  chat_model: "gpt-5-mini",
  chat_model_reachable: true,
  llm_monitoring: {
    avg_latency_ms: 10,
    error_rate: 0,
    fallback_rate: 1,
    errors_by_code: {},
    fallback_by_code: { OPENAI_UNAVAILABLE: 1 },
    window_15m: { status: "degraded", chat_turns: 4, reasons: ["fallback_rate"] },
  },
};

describe("AdminApp", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    fetchStats.mockReset();
    loginAdmin.mockReset();
    switchChatModel.mockReset();
  });

  it("shows login when the session is missing", async () => {
    const error = new Error("UNAUTHORIZED");
    error.code = "UNAUTHORIZED";
    fetchStats.mockRejectedValue(error);
    render(<AdminApp />);
    expect(await screen.findByRole("heading", { name: "Anmelden" })).toBeInTheDocument();
  });

  it("opens the dashboard after login and switches menu sections", async () => {
    const error = new Error("UNAUTHORIZED");
    error.code = "UNAUTHORIZED";
    fetchStats.mockRejectedValueOnce(error).mockResolvedValue(STATS);
    loginAdmin.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<AdminApp />);
    const view = within(container);
    await view.findByRole("heading", { name: "Anmelden" });
    await user.type(view.getByLabelText("Passwort"), "secret");
    await user.click(view.getByRole("button", { name: "Anmelden" }));
    expect(await screen.findByRole("heading", { name: /Statistik/ })).toBeInTheDocument();
    const active = screen.getByRole("button", { name: "gpt-5-mini" });
    expect(active).toBeDisabled();
    expect(active.querySelector("[title='erreichbar']")).toBeInTheDocument();
    switchChatModel.mockResolvedValue({ model: "claude-haiku-5-5", reachable: false });
    await user.click(screen.getByRole("button", { name: "Claude Haiku 5.5" }));
    expect(switchChatModel).toHaveBeenCalledWith("claude-haiku-5-5");
    const next = screen.getByRole("button", { name: "Claude Haiku 5.5" });
    expect(next).toBeDisabled();
    expect(next.querySelector("[title='nicht erreichbar']")).toBeInTheDocument();
    expect(screen.getByText("Formulare vs. Ergebnisse")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Grafiken" }));
    expect(screen.getByRole("img", { name: "Weltkarte" })).toHaveAttribute("src", STATS.charts.world);
    await user.click(screen.getByRole("button", { name: "Herkunft" }));
    expect(screen.getByText("Top-Länder")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Beliebte Orte" }));
    expect(screen.getByRole("heading", { name: "Beliebte Orte" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "LLM-Ausfälle" }));
    expect(screen.getByText("Fallback nach Code")).toBeInTheDocument();
    expect(screen.getByText("15 Minuten")).toBeInTheDocument();
    expect(screen.getByText("Fallback")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Monatsreport" }));
    expect(screen.getByText("Wochenende am Meer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rohdaten" }));
    expect(screen.getByText(/IP-Adressen/)).toBeInTheDocument();
  });
});
