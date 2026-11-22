import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RitualApp from "./RitualApp";
import { loadRitual, saveLanguage } from "./session";

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
    expect(screen.queryByRole("heading", { name: "Hier beginnt der Chat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Klang/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wohin ruft dich deine Seele?" })).toBeInTheDocument();
  });

  it("follows the system language reported by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/language")) {
          return { ok: true, json: async () => ({ language: "es" }) };
        }
        return { ok: true, json: async () => ({ places: [] }) };
      }),
    );
    try {
      render(
        <MemoryRouter>
          <RitualApp />
        </MemoryRouter>,
      );
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "es" })).toHaveAttribute("aria-pressed", "true");
      });
      expect(screen.getByRole("heading", { name: "¿Adónde te llama tu alma?" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Idioma" })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a chosen language ahead of the system language", async () => {
    saveLanguage("ru");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ language: "en" }) })),
    );
    try {
      render(
        <MemoryRouter>
          <RitualApp />
        </MemoryRouter>,
      );
      expect(screen.getByRole("button", { name: "ru" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("heading", { name: "Куда зовёт тебя твоя душа?" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "en" })).toHaveAttribute("aria-pressed", "false");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("translates the opening when the language changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RitualApp />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Wohin ruft dich deine Seele?" })).toBeInTheDocument();
    expect(screen.getByText("Scrolle langsam. Atme mit.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sprache" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "en" }));
    expect(screen.getByRole("heading", { name: "Where does your soul call you?" })).toBeInTheDocument();
    expect(screen.getByText("Scroll slowly. Breathe along.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Which landscape calms you for no reason?" })).toBeInTheDocument();
    expect(screen.queryByText("Wohin ruft dich deine Seele?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "es" }));
    expect(screen.getByRole("heading", { name: "¿Adónde te llama tu alma?" })).toBeInTheDocument();
    expect(screen.getByText("Desplázate despacio. Respira con ello.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Términos y condiciones" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ru" }));
    expect(screen.getByRole("heading", { name: "Куда зовёт тебя твоя душа?" })).toBeInTheDocument();
    expect(screen.getByText("Листай медленно. Дыши вместе.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Условия использования" })).toBeInTheDocument();
    expect(screen.queryByText("Scrolle langsam. Atme mit.")).not.toBeInTheDocument();
  });

  it("offers aether as an element", () => {
    render(
      <MemoryRouter>
        <RitualApp />
      </MemoryRouter>,
    );
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
    await answerChoices(user, [
      "Stiller Berggipfel",
      "Aufsteigen, hinauswachsen",
      "Eine Sehnsucht ohne Namen",
      "Erde — geerdet, still, tragend",
      "Dreieck — Richtung, Aufstieg",
      "Kraftvolles Klettern, Aufstieg",
    ]);
    await user.type(screen.getByPlaceholderText(/Schreib dein Wort/i), "Stille");
    await user.type(screen.getByPlaceholderText(/Ein Ort/i), "Berg");
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
