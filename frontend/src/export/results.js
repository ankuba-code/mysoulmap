export function collectPlaces(messages) {
  const seen = new Set();
  const places = [];
  for (const message of messages) {
    for (const place of message.recommendedPlaces ?? []) {
      if (!place?.id || seen.has(place.id)) {
        continue;
      }
      seen.add(place.id);
      places.push(place);
    }
  }
  return places;
}

export function assistantTexts(messages) {
  return messages
    .filter((message) => message.role === "assistant" && message.content)
    .map((message) => message.content);
}

export function hasExportableResult(messages) {
  return assistantTexts(messages).length > 0 || collectPlaces(messages).length > 0;
}
