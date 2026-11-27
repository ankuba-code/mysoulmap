import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  MAX_MESSAGE_LENGTH,
  MAX_TURNS,
  applyResponse,
  buildRequest,
  canSend,
  toApiMessages,
} from "./conversation";

const response = {
  message: { role: "assistant", content: "Machu Picchu." },
  shown_place_ids: ["mp"],
  recommended_places: [{ id: "mp", name: "Machu Picchu", booking_link: "/go/mp" }],
  source: "fallback",
  ai_disclosure: true,
};

describe("canSend", () => {
  it("rejects blank or oversized input and a full transcript", () => {
    expect(canSend("  ", 0)).toBe(false);
    expect(canSend("Hallo", MAX_TURNS)).toBe(false);
    expect(canSend("x".repeat(MAX_MESSAGE_LENGTH + 1), 0)).toBe(false);
    expect(canSend("Hallo", 0)).toBe(true);
  });
});

describe("buildRequest", () => {
  it("sends the full client transcript plus the new user turn", () => {
    const state = applyResponse(INITIAL_STATE, "Anden", response);
    const payload = buildRequest(state, "Mehr Wasser", "de");
    expect(payload.language).toBe("de");
    expect(payload.shown_place_ids).toEqual(["mp"]);
    expect(payload.messages).toEqual([
      { role: "user", content: "Anden" },
      { role: "assistant", content: "Machu Picchu." },
      { role: "user", content: "Mehr Wasser" },
    ]);
    expect(payload.prompt_catalog).toBeUndefined();
  });

  it("sends one place or the ritual element when the results page asks", () => {
    const ritual = { element: "earth", matched_place_ids: ["mp"] };
    const onePlace = buildRequest(INITIAL_STATE, "Vertiefe", "de", {
      fromRitual: true,
      ritualContext: ritual,
      promptCatalog: "place",
      focusPlaceId: "mp",
    });
    expect(onePlace.prompt_catalog).toBe("place");
    expect(onePlace.focus_place_id).toBe("mp");
    expect(onePlace.ritual_context).toBe(ritual);
    const more = buildRequest(INITIAL_STATE, "Weitere", "de", {
      fromRitual: true,
      ritualContext: ritual,
      promptCatalog: "element",
    });
    expect(more.prompt_catalog).toBe("element");
    expect(more.focus_place_id).toBeUndefined();
  });
});

describe("applyResponse", () => {
  it("keeps recommended places on the assistant turn and shows the AI notice", () => {
    const next = applyResponse(INITIAL_STATE, "Anden", response);
    expect(next.aiDisclosure).toBe(true);
    expect(next.shownPlaceIds).toEqual(["mp"]);
    expect(toApiMessages(next.messages)).toEqual([
      { role: "user", content: "Anden" },
      { role: "assistant", content: "Machu Picchu." },
    ]);
    expect(next.messages[1].recommendedPlaces[0].id).toBe("mp");
    expect(next.messages[1].source).toBe("fallback");
    expect(next.messages[1].sections).toEqual([]);
  });

  it("keeps atlas headings on the assistant turn", () => {
    const next = applyResponse(INITIAL_STATE, "Mehr zu den Orten", {
      ...response,
      source: "llm",
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
    });
    expect(next.messages[1].sections).toEqual([
      {
        kind: "overview",
        text: "Anreise über Lima.",
        placeId: "",
        name: "",
        country: "",
        primaervibration: "",
      },
      {
        kind: "place",
        text: "Früh auf den Berg.",
        placeId: "mp",
        name: "Machu Picchu",
        country: "Peru",
        primaervibration: "Sacred Mountain",
      },
    ]);
    expect(toApiMessages(next.messages)[1]).toEqual({
      role: "assistant",
      content: "Machu Picchu.",
    });
  });
});
