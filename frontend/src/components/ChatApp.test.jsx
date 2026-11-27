import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChatApp from "./ChatApp";

vi.mock("../chat/api", () => ({
  postChat: vi.fn(),
}));

import { postChat } from "../chat/api";

describe("ChatApp", () => {
  it("sends a turn and shows the Art. 50 notice plus a fallback place", async () => {
    postChat.mockResolvedValue({
      message: { role: "assistant", content: "Machu Picchu." },
      shown_place_ids: ["mp"],
      recommended_places: [{ id: "mp", name: "Machu Picchu", booking_link: "/go/mp" }],
      source: "fallback",
      ai_disclosure: true,
    });
    const user = userEvent.setup();
    render(<ChatApp />);
    expect(screen.queryByRole("button", { name: "Screenshot" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/Beschreibe/i), "Anden Inka");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Du interagierst mit einer KI.");
    expect(screen.getByText("Machu Picchu.")).toBeInTheDocument();
    expect(screen.getByText(/KI-Assistent gerade nicht erreichbar/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Unterkunft suchen" }).some((link) => link.getAttribute("href") === "/go/mp?lang=de")).toBe(true);
    expect(screen.queryByRole("button", { name: "Screenshot" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeEnabled();
    expect(postChat).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "Anden Inka" }],
      shown_place_ids: [],
      language: "de",
    });
  });

  it("shows the thank-you panel near the token limit and keeps the composer open", async () => {
    postChat.mockResolvedValue({
      message: { role: "assistant", content: "Noch eine Idee." },
      shown_place_ids: [],
      recommended_places: [],
      source: "llm",
      ai_disclosure: true,
      token_notice: "approaching",
    });
    const user = userEvent.setup();
    render(<ChatApp />);
    await user.type(screen.getByPlaceholderText(/Beschreibe/i), "Meer");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText(/Danke von Herzen/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Beschreibe/i)).toBeEnabled();
    const whatsapp = screen.getByRole("link", { name: "WhatsApp" });
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
    expect(whatsapp.getAttribute("href")).toContain(encodeURIComponent(window.location.origin));
    expect(whatsapp.getAttribute("href")).not.toContain("Meer");
  });

  it("hides the shared block when the question is about one place", async () => {
    postChat.mockResolvedValue({
      message: { role: "assistant", content: "Allgemein und Ort." },
      shown_place_ids: ["mp"],
      recommended_places: [],
      sections: [
        { kind: "overview", text: "Anreise über Lima.", place_id: null, name: "", country: "", primaervibration: "" },
        {
          kind: "place",
          text: "Früh auf den Berg.",
          place_id: "mp",
          name: "Machu Picchu",
          country: "Peru",
          primaervibration: "Sacred Mountain",
        },
      ],
      source: "llm",
      ai_disclosure: false,
    });
    render(
      <ChatApp
        embedded
        fromRitual
        focusPlaceId="mp"
        seedPrompt="Vertiefe nur diesen einen Atlas-Ort. Ort: Machu Picchu."
      />,
    );
    expect(await screen.findByText("Früh auf den Berg.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Zu allen drei Orten" })).not.toBeInTheDocument();
    expect(screen.queryByText("Anreise über Lima.")).not.toBeInTheDocument();
    expect(postChat).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt_catalog: "place",
        focus_place_id: "mp",
      }),
    );
  });

  it("shows the shared-place hint once and skips a repeated overview", async () => {
    const hint = "Vertiefe die bereits empfohlenen Atlas-Orte: Anreise allgemein.";
    postChat
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Allgemein und Ort." },
        shown_place_ids: ["mp"],
        recommended_places: [],
        sections: [
          { kind: "overview", text: "Anreise über Lima.", place_id: null, name: "", country: "", primaervibration: "" },
          {
            kind: "place",
            text: "Früh auf den Berg.",
            place_id: "mp",
            name: "Machu Picchu",
            country: "Peru",
            primaervibration: "Sacred Mountain",
          },
        ],
        source: "llm",
        ai_disclosure: false,
      })
      .mockResolvedValueOnce({
        message: { role: "assistant", content: "Noch einmal allgemein. Abend im Tal." },
        shown_place_ids: ["mp"],
        recommended_places: [],
        sections: [
          { kind: "overview", text: "Noch einmal die Anreise.", place_id: null, name: "", country: "", primaervibration: "" },
          {
            kind: "place",
            text: "Abend im Tal.",
            place_id: "mp",
            name: "Machu Picchu",
            country: "Peru",
            primaervibration: "Sacred Mountain",
          },
        ],
        source: "llm",
        ai_disclosure: false,
      });
    const user = userEvent.setup();
    render(
      <ChatApp
        embedded
        fromRitual
        gatePrompts={{
          placeDetails: hint,
          morePlaces: "Weitere Orte.",
          ctaPlaceDetails: "Mehr zu diesen Orten",
          ctaMorePlaces: "Weitere Empfehlungen",
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Mehr zu diesen Orten" }));
    expect(postChat).toHaveBeenCalledWith(expect.objectContaining({ prompt_catalog: "element" }));
    expect(await screen.findByRole("heading", { name: "Zu allen drei Orten" })).toBeInTheDocument();
    expect(screen.getAllByText(hint)).toHaveLength(2);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", "place-details-hint");

    await user.type(screen.getByRole("textbox"), "Nur dieser Ort");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText("Abend im Tal.")).toBeInTheDocument();
    expect(screen.queryByText("Noch einmal die Anreise.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Zu allen drei Orten" })).toHaveLength(1);
    expect(screen.getAllByText(hint)).toHaveLength(2);
  });

  it("locks the composer when the token limit is spent and shares only the site address", async () => {
    const error = new Error("aufgebraucht");
    error.code = "TOKEN_LIMIT";
    postChat.mockRejectedValue(error);
    const user = userEvent.setup();
    render(<ChatApp />);
    await user.type(screen.getByPlaceholderText(/Beschreibe/i), "Anden Geheimnis");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByText(/Freunde, Verwandte und Bekannte/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Beschreibe/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
    for (const name of ["WhatsApp", "Telegram", "E-Mail"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).not.toContain("Geheimnis");
      expect(link.getAttribute("href")).not.toContain("Anden");
    }
  });
});
