import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminApp from "./AdminApp";

vi.mock("./api", () => ({
  fetchStats: vi.fn(),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
}));

import { fetchStats, loginAdmin } from "./api";

const STATS = {
  period: "2026-08-27/2026-09-25",
  form_submissions: 1,
  result_views: 1,
  conversion_rate: 1,
  click_through_rate: 0,
  daily: [{ date: "2026-09-25", form_submissions: 1, result_views: 1, fallbacks: 1 }],
  top_countries: [{ country_code: "DE", count: 2 }],
  top_clicked_places: [{ place_id: "mp", clicks: 1 }],
  llm_monitoring: {
    avg_latency_ms: 10,
    error_rate: 0,
    fallback_rate: 1,
    errors_by_code: {},
    fallback_by_code: { OPENAI_UNAVAILABLE: 1 },
  },
};

describe("AdminApp", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    fetchStats.mockReset();
    loginAdmin.mockReset();
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
    expect(screen.getByText("Formulare vs. Ergebnisse")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Herkunft" }));
    expect(screen.getByText("Top-Länder")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Beliebte Orte" }));
    expect(screen.getByRole("heading", { name: "Beliebte Orte" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "LLM-Ausfälle" }));
    expect(screen.getByText("Fallback nach Code")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rohdaten" }));
    expect(screen.getByText(/IP-Adressen/)).toBeInTheDocument();
  });
});
