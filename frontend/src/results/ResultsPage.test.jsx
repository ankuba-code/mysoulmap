import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveRitual, clearRitual } from "../ritual/session";
import ResultsPage from "./ResultsPage";

vi.mock("./ResultsMap", () => ({
  default: () => <div>Karte</div>,
}));

vi.mock("../components/ChatApp", () => ({
  default: ({ fromRitual, ritualContext }) => (
    <p>
      Chat {String(fromRitual)} {ritualContext.matched_place_ids.join(",")}
    </p>
  ),
}));

describe("ResultsPage", () => {
  beforeEach(() => {
    clearRitual();
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
    expect(screen.getByText("Chat true mp")).toBeInTheDocument();
  });
});
