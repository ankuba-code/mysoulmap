import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveRitual, clearRitual } from "../ritual/session";
import ResultsPage from "./ResultsPage";

vi.mock("./ResultsMap", () => ({
  default: ({ origin, focusPlaceId }) => (
    <div>{origin ? `Standort ${origin.country_code}` : "Karte"}{focusPlaceId ? ` Fokus ${focusPlaceId}` : ""}</div>
  ),
}));

vi.mock("../components/ChatApp", () => ({
  default: ({ fromRitual, ritualContext, seedPrompt }) => (
    <p>
      Chat {String(fromRitual)} {ritualContext.matched_place_ids.join(",")} {seedPrompt || ""}
    </p>
  ),
}));

const RITUAL = {
  language: "de",
  answers: {},
  result: {
    anima_card: {
      archetype_symbol: "triangle",
      element: "earth",
      inner_rhythm: "rise",
      emotional_intensity: 7,
      travel_direction: "outward",
      dominant_frequency: "Stille",
    },
    matches: [
      {
        id: "mp",
        name: "Machu Picchu",
        country: "Peru",
        coordinates: { lat: -13.16, lng: -72.54 },
        primaervibration: "Sacred Mountain",
        correspondence: "Sacred Mountain · Guardian",
        booking_link: "/go/mp",
        score: 80,
        reasons: [{ dimension: "element", text: "Element spiegelt sich: earth.", points: 30 }],
      },
    ],
  },
};

async function acknowledgeAi(user) {
  await user.click(await screen.findByRole("button", { name: "Verstanden" }));
}

describe("ResultsPage", () => {
  afterEach(() => {
    vi.mocked(window.scrollTo).mockRestore();
  });

  beforeEach(() => {
    clearRitual();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ country_code: "XX", latitude: null, longitude: null, accuracy_radius_km: null }),
      })),
    );
  });

  it("opens at the top", () => {
    saveRitual(RITUAL);
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>,
    );
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("sends visitors without a ritual back to the start", () => {
    render(
      <MemoryRouter initialEntries={["/results"]}>
        <ResultsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("heading", { name: "Deine Resonanz" })).not.toBeInTheDocument();
  });

  it("shows the summary, map, places and atlas chat", () => {
    saveRitual({
      language: "de",
      answers: {},
      result: {
        anima_card: {
          archetype_symbol: "triangle",
          element: "earth",
          inner_rhythm: "rise",
          emotional_intensity: 7,
          travel_direction: "outward",
          dominant_frequency: "Stille",
        },
        matches: [
          {
            id: "mp",
            name: "Machu Picchu",
            country: "Peru",
            coordinates: { lat: -13.16, lng: -72.54 },
            primaervibration: "Sacred Mountain",
            correspondence: "Sacred Mountain · Guardian",
            booking_link: "/go/mp",
            score: 80,
            reasons: [{ dimension: "element", text: "Element spiegelt sich: earth.", points: 30 }],
          },
        ],
      },
    });
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Ergebnisse" })).toBeInTheDocument();
    expect(screen.getByText("Karte")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Machu Picchu" })).toBeInTheDocument();
    expect(screen.getByText(/Chat true mp/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/geo");
  });

  it("opens the terrain in a shadowbox and leaves the upper map", async () => {
    saveRitual({
      language: "de",
      answers: {},
      result: {
        anima_card: {
          archetype_symbol: "triangle",
          element: "earth",
          inner_rhythm: "rise",
          emotional_intensity: 7,
          travel_direction: "outward",
          dominant_frequency: "Stille",
        },
        matches: [
          {
            id: "mp",
            name: "Machu Picchu",
            country: "Peru",
            coordinates: { lat: -13.16, lng: -72.54 },
            primaervibration: "Sacred Mountain",
            correspondence: "",
            booking_link: "/go/mp",
            score: 80,
            reasons: [],
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>,
    );
    const map = document.getElementById("karte");
    map.scrollIntoView = vi.fn();
    await acknowledgeAi(user);
    expect(screen.getByText("Karte")).toBeInTheDocument();
    expect(screen.queryByText("Karte Fokus mp")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Terrain anzeigen" }));
    const dialog = screen.getByRole("dialog", { name: "Machu Picchu" });
    expect(dialog).toHaveTextContent("Karte Fokus mp");
    expect(map.scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByText("Karte")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog", { name: "Machu Picchu" })).not.toBeInTheDocument();
  });

  it("asks about one place without repeating the shared prompt", async () => {
    saveRitual({
      language: "de",
      answers: {},
      result: {
        anima_card: {
          archetype_symbol: "triangle",
          element: "earth",
          inner_rhythm: "rise",
          emotional_intensity: 7,
          travel_direction: "outward",
          dominant_frequency: "Stille",
        },
        matches: [
          {
            id: "mp",
            name: "Machu Picchu",
            country: "Peru",
            coordinates: { lat: -13.16, lng: -72.54 },
            primaervibration: "Sacred Mountain",
            correspondence: "",
            booking_link: "/go/mp",
            score: 80,
            reasons: [],
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>,
    );
    const assistant = document.getElementById("reiseassistent");
    assistant.scrollIntoView = vi.fn();
    await acknowledgeAi(user);
    await user.click(screen.getByRole("button", { name: "Mehr erfahren" }));
    const dialog = screen.getByRole("dialog", { name: "Machu Picchu" });
    expect(dialog).toHaveTextContent("Karte Fokus mp");
    expect(dialog).toHaveTextContent("Vertiefe nur diesen einen Atlas-Ort");
    expect(dialog).toHaveTextContent("Ort: Machu Picchu.");
    expect(dialog).not.toHaveTextContent("Anreise allgemein");
    expect(screen.getByText(/^Chat true mp\s*$/)).toBeInTheDocument();
    expect(assistant.scrollIntoView).not.toHaveBeenCalled();
  });

  it("draws the GeoLite2 area on the map", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          country_code: "DE",
          latitude: 52.52,
          longitude: 13.4,
          accuracy_radius_km: 20,
        }),
      })),
    );
    saveRitual({
      language: "de",
      answers: {},
      result: {
        anima_card: {
          archetype_symbol: "triangle",
          element: "earth",
          inner_rhythm: "rise",
          emotional_intensity: 7,
          travel_direction: "outward",
          dominant_frequency: "Stille",
        },
        matches: [
          {
            id: "mp",
            name: "Machu Picchu",
            country: "Peru",
            coordinates: { lat: -13.16, lng: -72.54 },
            primaervibration: "Sacred Mountain",
            correspondence: "Sacred Mountain · Guardian",
            booking_link: "/go/mp",
            score: 80,
            reasons: [],
          },
        ],
      },
    });
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Standort DE")).toBeInTheDocument();
    expect(screen.getByText(/GeoLite2 data created by/)).toBeInTheDocument();
  });

  it("switches the results copy with the language", async () => {
    saveRitual({
      language: "de",
      answers: { q4: 1, q1: 0, q3: 2 },
      result: {
        anima_card: {
          archetype_symbol: "triangle",
          element: "earth",
          inner_rhythm: "rise",
          emotional_intensity: 7,
          travel_direction: "outward",
          dominant_frequency: "Stille",
        },
        matches: [
          {
            id: "machu_picchu_pe",
            name: "Machu Picchu",
            country: "Peru",
            coordinates: { lat: -13.16, lng: -72.54 },
            primaervibration: "Sacred Mountain",
            element: "earth",
            correspondence: "",
            booking_link: "/go/mp",
            score: 80,
            reasons: [
              { dimension: "element", text: "Element spiegelt sich: Erde.", points: 40 },
              { dimension: "landscape", text: "Landschaft trifft deine Wahl.", points: 24 },
            ],
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>,
    );
    await acknowledgeAi(user);
    expect(screen.getAllByText("Deine SoulMap").length).toBeGreaterThan(0);
    expect(screen.getByText("Element spiegelt sich: Erde.")).toBeInTheDocument();
    expect(screen.getByText(/Innere Bewegung Aufstieg/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "en" }));
    expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument();
    expect(screen.getAllByText("Your SoulMap").length).toBeGreaterThan(0);
    expect(screen.getByText("Atlas of correspondences")).toBeInTheDocument();
    expect(screen.getByText(/Inner movement Ascent/)).toBeInTheDocument();
    expect(screen.getByText("Element mirrors you: Earth.")).toBeInTheDocument();
    expect(screen.getByText("Landscape matches what you chose.")).toBeInTheDocument();
    expect(screen.queryByText("Element spiegelt sich: Erde.")).not.toBeInTheDocument();
    expect(screen.queryByText("Deine SoulMap")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "es" }));
    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
    expect(screen.getAllByText("Tu mapa del alma").length).toBeGreaterThan(0);
    expect(screen.getByText(/Movimiento interior Ascenso/)).toBeInTheDocument();
    expect(screen.getByText("El elemento se refleja: Tierra.")).toBeInTheDocument();
    expect(screen.getByText("El paisaje coincide con lo que elegiste.")).toBeInTheDocument();
    expect(screen.getByText("Perú")).toBeInTheDocument();
    expect(screen.getAllByText(/Montaña sagrada/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Sacred Mountain")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ru" }));
    expect(screen.getByRole("heading", { name: "Результаты" })).toBeInTheDocument();
    expect(screen.getAllByText("Твоя карта души").length).toBeGreaterThan(0);
    expect(screen.getByText(/Внутреннее движение Подъём/)).toBeInTheDocument();
    expect(screen.getByText("Стихия откликается: Земля.")).toBeInTheDocument();
    expect(screen.getByText("Пейзаж совпадает с твоим выбором.")).toBeInTheDocument();
    expect(screen.getByText("Мачу-Пикчу")).toBeInTheDocument();
    expect(screen.getByText("Перу")).toBeInTheDocument();
    expect(screen.queryByText("Peru")).not.toBeInTheDocument();
    expect(screen.queryByText("Ergebnisse")).not.toBeInTheDocument();
  });

  it("shows the AI notice only after the results page has loaded", async () => {
    let releaseGeo;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            releaseGeo = () =>
              resolve({
                ok: true,
                json: async () => ({ country_code: "XX", latitude: null, longitude: null, accuracy_radius_km: null }),
              });
          }),
      ),
    );
    saveRitual(RITUAL);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Ergebnisse" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    releaseGeo();
    expect(await screen.findByRole("dialog")).toHaveTextContent("Hier spricht eine KI");
    expect(screen.getByText(/künstliche Intelligenz/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Verstanden" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reiseassistent" })).toBeInTheDocument();
  });
});
