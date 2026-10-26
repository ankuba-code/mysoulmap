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
