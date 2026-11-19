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

async function answerChoices(user, labels) {
  for (const label of labels) {
    await user.click(screen.getByRole("button", { name: label }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));
  }
}

describe("RitualApp", () => {
  it("keeps the header to the wordmark and language switch and links the legal pages", () => {
    render(
      <MemoryRouter>
        <RitualApp />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "SoulMap" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "de" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/impressum");
    expect(screen.getByRole("link", { name: "Nutzungsbedingungen" })).toHaveAttribute("href", "/disclaimer");
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/datenschutz");
    expect(screen.queryByRole("link", { name: "Reiseassistent" })).not.toBeInTheDocument();
  });

  it("translates the opening when the language changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RitualApp />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Dein Atlas deiner Seelenorte" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sprache" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "en" }));
    expect(screen.getByRole("heading", { name: "Your atlas of your soul places" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begin the ritual" })).toBeInTheDocument();
    expect(screen.getByText("Attunement")).toBeInTheDocument();
    expect(screen.queryByText("Dein Atlas deiner Seelenorte")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "es" }));
    expect(screen.getByRole("heading", { name: "Tu atlas de tus lugares del alma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comenzar el ritual" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Términos y condiciones" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ru" }));
    expect(screen.getByRole("heading", { name: "Твой атлас твоих мест души" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать ритуал" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Условия использования" })).toBeInTheDocument();
    expect(screen.queryByText("Einstimmung")).not.toBeInTheDocument();
  });

  it("offers aether as an element", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RitualApp />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Ritual beginnen" }));
    await answerChoices(user, [
      "Stiller Berggipfel",
      "Aufsteigen, hinauswachsen",
      "Eine Sehnsucht ohne Namen",
    ]);
    expect(screen.getByRole("button", { name: /Äther/ })).toBeInTheDocument();
  });

  it("walks the ritual and stores the match", async () => {
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
    await user.click(screen.getByRole("button", { name: "Ritual beginnen" }));
    await answerChoices(user, [
      "Stiller Berggipfel",
      "Aufsteigen, hinauswachsen",
      "Eine Sehnsucht ohne Namen",
      "Erde — geerdet, still, tragend",
      "Dreieck — Richtung, Aufstieg",
      "Kraftvolles Klettern, Aufstieg",
    ]);
    await user.type(screen.getByPlaceholderText(/Schreib dein Wort/i), "Stille");
    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.type(screen.getByPlaceholderText(/Ein Ort/i), "Berg");
    await user.click(screen.getByRole("button", { name: "Karte erzeugen" }));
    await user.click(screen.getByRole("button", { name: "Ergebnisse öffnen" }));
    expect(await screen.findByText("Ergebnisseite")).toBeInTheDocument();
    expect(postMatch).toHaveBeenCalledWith({
      language: "de",
      answers: {
        q0: 1,
        q1: 0,
        q2: 2,
        q3: 2,
        q4: 1,
        q5: 1,
        q6: "Stille",
        q7: "Berg",
      },
    });
    expect(loadRitual().result.matches[0].id).toBe("mp");
  });
});
