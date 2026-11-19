import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DisclaimerPage, ImpressumPage, PrivacyPage } from "./LegalPages";

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Start</p>} />
        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="/disclaimer" element={<DisclaimerPage />} />
        <Route path="/datenschutz" element={<PrivacyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Legal pages", () => {
  it("keeps the header to the wordmark and language switch and opens each page from the footer", async () => {
    const user = userEvent.setup();
    renderAt("/impressum");

    const header = screen.getAllByRole("banner")[0];
    expect(within(header).getAllByRole("link")).toHaveLength(1);
    expect(within(header).getByRole("link", { name: "SoulMap" })).toHaveAttribute("href", "/");
    expect(within(header).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Impressum" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Anbieter" })).toBeInTheDocument();
    expect(screen.getByText(/intouch@mithertz.online/)).toBeInTheDocument();
    expect(screen.getByText(/§ 5 DDG/)).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Nutzungsbedingungen" }));
    expect(screen.getByRole("heading", { name: "Nutzungsbedingungen" })).toBeInTheDocument();
    expect(screen.getByText(/sechsmonatige Geolokalisations-Statistik/)).toBeInTheDocument();
    expect(screen.getByText(/keine Gewähr/)).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Datenschutz" }));
    expect(screen.getByRole("heading", { name: "Datenschutz" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verantwortlicher" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deine Rechte" })).toBeInTheDocument();
    expect(screen.getAllByText(/6 Monate/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/500 Zeichen/)).toBeInTheDocument();
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "en" }));
    expect(screen.getByRole("heading", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Imprint" })).toHaveAttribute("href", "/impressum");
    expect(screen.getByRole("link", { name: "Terms and Conditions" })).toBeInTheDocument();
  });
});
