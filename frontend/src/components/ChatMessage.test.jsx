import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { copyFor } from "../chat/copy";
import ChatMessage from "./ChatMessage";

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
    expect(screen.getByText("Peru · Sacred Mountain")).toBeInTheDocument();
    expect(screen.getByText("Anreise über Lima.")).toBeInTheDocument();
    expect(screen.getByText("Früh auf den Berg.")).toBeInTheDocument();
    expect(screen.queryByText("Dieser Fließtext bleibt im Verlauf.")).not.toBeInTheDocument();
    expect(screen.queryByText("Anders")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anzeige Unterkunft suchen" })).toHaveAttribute("href", "/go/mp?lang=de");
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
});
