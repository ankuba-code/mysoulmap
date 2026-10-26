export const MAX_TURNS = 20;
export const MAX_MESSAGE_LENGTH = 4000;

export const INITIAL_STATE = {
  messages: [],
  shownPlaceIds: [],
  aiDisclosure: false,
};

export function canSend(text, messageCount) {
  const trimmed = text.trim();
  return Boolean(trimmed) && trimmed.length <= MAX_MESSAGE_LENGTH && messageCount < MAX_TURNS;
}

export function toApiMessages(messages) {
  return messages.map(({ role, content }) => ({ role, content }));
}

export function buildRequest(state, userContent, language, extras = {}) {
  const payload = {
    messages: [...toApiMessages(state.messages), { role: "user", content: userContent }],
    shown_place_ids: state.shownPlaceIds,
    language,
  };
  if (extras.fromRitual) {
    payload.from_ritual = true;
  }
  if (extras.ritualContext) {
    payload.ritual_context = extras.ritualContext;
  }
  return payload;
}

export function applyResponse(state, userContent, response) {
  return {
    messages: [
      ...state.messages,
      { role: "user", content: userContent },
      {
        role: "assistant",
        content: response.message.content,
        source: response.source,
        recommendedPlaces: response.recommended_places ?? [],
      },
    ],
    shownPlaceIds: response.shown_place_ids,
    aiDisclosure: state.aiDisclosure || Boolean(response.ai_disclosure),
  };
}
