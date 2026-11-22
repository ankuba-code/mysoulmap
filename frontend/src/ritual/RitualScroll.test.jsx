import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RitualApp from "./RitualApp";
import { loadRitual } from "./session";

vi.mock("./api", () => ({
  postMatch: vi.fn(),
}));

import { postMatch } from "./api";

const MATCH = {
  anima_card: {
    archetype_symbol: "triangle",
    element: "earth",
    inner_rhythm: "rise",
    emotional_intensity: 7,
    travel_direction: "outward",
    keywords: ["triangle", "earth"],
    dominant_frequency: "Stille",
  },
  matches: [
    {
      id: "mp",
      name: "Machu Picchu",
      country: "Peru",
      coordinates: { lat: -13.16, lng: -72.54 },
      element: "earth",
      archetyp: "Guardian",
      primaervibration: "Sacred Mountain",
      correspondence: "Sacred Mountain",
      booking_link: "/go/mp",
      score: 80,
      reasons: [{ dimension: "element", text: "Element spiegelt sich: earth.", points: 30 }],
    },
  ],
};

describe("RitualScroll", () => {
  it("is the ritual and has no separate test path", () => {
    render(
      <MemoryRouter>
        <RitualApp />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Als Strecke testen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Klassische Fragen" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welche Landschaft beruhigt dich grundlos?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcher Teil von dir möchte sich jetzt bewegen?" })).toBeInTheDocument();
  });

  it("keeps a chosen mark pressed", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RitualApp />
      </MemoryRouter>,
    );
    const choice = screen.getByRole("button", { name: "Stiller Berggipfel" });
    await user.click(choice);
    expect(choice).toHaveAttribute("aria-pressed", "true");
  });

  it("stores the match from the card at the end of the path", async () => {
    postMatch.mockResolvedValue(MATCH);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<RitualApp />} />
          <Route path="/results" element={<p>Ergebnisseite</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const choices = [
      "Stiller Berggipfel",
      "Aufsteigen, hinauswachsen",
      "Eine Sehnsucht ohne Namen",
      "Erde — geerdet, still, tragend",
      "Dreieck — Richtung, Aufstieg",
      "Kraftvolles Klettern, Aufstieg",
    ];
    for (const label of choices) {
      await user.click(screen.getByRole("button", { name: label }));
    }
    await user.type(screen.getByPlaceholderText(/Schreib dein Wort/i), "Stille");
    await user.type(screen.getByPlaceholderText(/Ein Ort/i), "Berg");
    await user.click(screen.getByRole("button", { name: "Ergebnisse öffnen" }));
    expect(await screen.findByText("Ergebnisseite")).toBeInTheDocument();
    expect(loadRitual().answers.q6).toBe("Stille");
    expect(loadRitual().result.matches[0].id).toBe("mp");
  });
});
