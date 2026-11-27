import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { copyFor } from "../chat/copy";
import ChatMessage from "./ChatMessage";

vi.mock("../chat/api", () => ({
  postFeedback: vi.fn(),
}));

import { postFeedback } from "../chat/api";

const copy = copyFor("de");

describe("ChatMessage", () => {
  it("shows the shared heading and the atlas place name on the results chat", () => {
    render(
      <ChatMessage
        ritual
        language="de"
        copy={copy}
        message={{
          role: "assistant",
          content: "Dieser Fließtext bleibt im Verlauf.",
          sections: [
            { kind: "overview", text: "Anreise über Lima.", placeId: "", name: "", country: "", primaervibration: "" },
            {
              kind: "place",
              text: "Früh auf den Berg.",
              placeId: "mp",
              name: "Machu Picchu",
              country: "Peru",
              primaervibration: "Sacred Mountain",
            },
          ],
          recommendedPlaces: [{ id: "mp", name: "Anders", booking_link: "/go/mp" }],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Zu allen drei Orten" })).toBeInTheDocument();
    expect(screen.getByText("Allgemein")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Machu Picchu" })).toBeInTheDocument();
    expect(screen.getByText("Peru")).toBeInTheDocument();
    expect(screen.getByText("🇵🇪")).toBeInTheDocument();
    expect(screen.getByText(/Sacred Mountain/)).toBeInTheDocument();
    expect(screen.getByText("Anreise über Lima.")).toBeInTheDocument();
    expect(screen.getByText("Früh auf den Berg.")).toBeInTheDocument();
    expect(screen.queryByText("Dieser Fließtext bleibt im Verlauf.")).not.toBeInTheDocument();
    expect(screen.queryByText("Anders")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anzeige Unterkunft suchen" })).toHaveAttribute("href", "/go/mp?lang=de");
    expect(screen.queryByRole("link", { name: /Booking.com/ })).not.toBeInTheDocument();
  });

  it("drops a repeated overview and keeps the place card", () => {
    const message = {
      role: "assistant",
      content: "Noch einmal allgemein. Abend im Tal.",
      sections: [
        { kind: "overview", text: "Noch einmal die Anreise.", placeId: "", name: "", country: "", primaervibration: "" },
        {
          kind: "place",
          text: "Abend im Tal.",
          placeId: "mp",
          name: "Machu Picchu",
          country: "Peru",
          primaervibration: "Sacred Mountain",
        },
      ],
    };
    render(<ChatMessage ritual language="de" copy={copy} message={message} hideOverview />);
    expect(screen.queryByRole("heading", { name: "Zu allen drei Orten" })).not.toBeInTheDocument();
    expect(screen.queryByText("Noch einmal die Anreise.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Machu Picchu" })).toBeInTheDocument();
    expect(screen.getByText("Abend im Tal.")).toBeInTheDocument();
  });

  it("keeps only the opened place inside a shadowbox reply", () => {
    render(
      <ChatMessage
        ritual
        language="de"
        copy={copy}
        onlyPlaceId="mp"
        message={{
          role: "assistant",
          content: "Mehrere Orte.",
          sections: [
            { kind: "overview", text: "Anreise über Lima.", placeId: "", name: "", country: "", primaervibration: "" },
            {
              kind: "place",
              text: "Früh auf den Berg.",
              placeId: "mp",
              name: "Machu Picchu",
              country: "Peru",
              primaervibration: "Sacred Mountain",
            },
            {
              kind: "place",
              text: "Rotes Gestein.",
              placeId: "sedona",
              name: "Sedona",
              country: "USA",
              primaervibration: "Red Rock",
            },
          ],
          recommendedPlaces: [
            { id: "mp", name: "Machu Picchu", booking_link: "/go/mp" },
            { id: "uluru", name: "Uluru", country: "Australien", booking_link: "/go/uluru" },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Machu Picchu" })).toBeInTheDocument();
    expect(screen.getByText("Früh auf den Berg.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Booking.com/ })).toHaveAttribute("href", "/go/mp?lang=de");
    expect(screen.getByRole("link", { name: /Booking.com/ })).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("Anreise über Lima.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sedona" })).not.toBeInTheDocument();
    expect(screen.queryByText("Uluru")).not.toBeInTheDocument();
  });

  it("links the shadowbox place to Booking.com even without a new recommendation", () => {
    render(
      <ChatMessage
        ritual
        language="de"
        copy={copy}
        onlyPlaceId="rapa_nui_cl"
        message={{
          role: "assistant",
          content: "Kleine Gästehäuser.",
          sections: [
            {
              kind: "place",
              text: "Kleine Gästehäuser.",
              placeId: "rapa_nui_cl",
              name: "Rapa Nui",
              country: "Chile",
              primaervibration: "Ancestral Memory",
            },
          ],
          recommendedPlaces: [],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: /Booking.com/ })).toHaveAttribute("href", "/go/rapa_nui_cl?lang=de");
  });

  it("shows the reply text when the shadowbox has no matching place card", () => {
    render(
      <ChatMessage
        ritual
        language="de"
        copy={copy}
        onlyPlaceId="mp"
        message={{
          role: "assistant",
          content: "Früh auf den Berg, bevor die Gruppen kommen.",
          sections: [
            {
              kind: "place",
              text: "Anderer Ort.",
              placeId: "sedona",
              name: "Sedona",
              country: "USA",
              primaervibration: "",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Früh auf den Berg, bevor die Gruppen kommen.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sedona" })).not.toBeInTheDocument();
  });

  it("keeps fallback place names out of a single-place shadowbox", () => {
    render(
      <ChatMessage
        ritual
        language="de"
        copy={copy}
        onlyPlaceId="mp"
        message={{
          role: "assistant",
          source: "fallback",
          content: "Unser KI-Assistent ist gerade nicht erreichbar. Basierend auf deiner Anfrage empfehlen wir dir: Giza, Salar de Uyuni.",
          recommendedPlaces: [
            { id: "giza", name: "Giza", country: "Ägypten", booking_link: "/go/giza" },
            { id: "uyuni", name: "Salar de Uyuni", country: "Bolivien", booking_link: "/go/uyuni" },
          ],
        }}
      />,
    );
    expect(screen.getByText(/gerade nicht erreichbar/)).toBeInTheDocument();
    expect(screen.queryByText(/Giza/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Salar de Uyuni/)).not.toBeInTheDocument();
  });

  it("keeps a single bubble when the reply has no sections", () => {
    render(
      <ChatMessage
        ritual
        language="de"
        copy={copy}
        message={{ role: "assistant", content: "Machu Picchu.", sections: [] }}
      />,
    );
    expect(screen.getByText("Machu Picchu.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Zu allen drei Orten" })).not.toBeInTheDocument();
  });

  it("opens a note after dislike and stores the text", async () => {
    postFeedback.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ChatMessage
        language="de"
        copy={copy}
        message={{ role: "assistant", content: "Machu Picchu." }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Gefällt mir nicht" }));
    expect(screen.getByRole("dialog", { name: "Kurzes Feedback" })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Optional"), "zu knapp");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(postFeedback).toHaveBeenCalledWith({ vote: "dislike", text: "zu knapp" });
    expect(await screen.findByText("Danke, das ist angekommen.")).toBeInTheDocument();
  });
});
