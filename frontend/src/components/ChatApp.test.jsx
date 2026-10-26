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
    expect(screen.getByRole("button", { name: "Screenshot" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/Beschreibe/i), "Anden Inka");
    await user.click(screen.getByRole("button", { name: "Senden" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Du interagierst mit einer KI.");
    expect(screen.getByText("Machu Picchu.")).toBeInTheDocument();
    expect(screen.getByText(/KI-Assistent gerade nicht erreichbar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unterkunft suchen" })).toHaveAttribute(
      "href",
      "/go/mp?lang=de",
    );
    expect(screen.getByRole("button", { name: "Screenshot" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "PDF" })).toBeEnabled();
    expect(postChat).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "Anden Inka" }],
      shown_place_ids: [],
      language: "de",
    });
  });
});
