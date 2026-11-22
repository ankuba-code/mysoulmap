import { placeText } from "./placeText";

export function localizePlace(place, language) {
  if (!place) {
    return place;
  }
  const text = placeText(language, place.id);
  if (!text) {
    return place;
  }
  return {
    ...place,
    sourceName: place.sourceName || place.name,
    sourceCountry: place.sourceCountry || place.country,
    name: text.name,
    country: text.country,
    primaervibration: text.vibration,
    correspondence: text.correspondence || place.correspondence,
    flagCountry: place.flagCountry || place.country,
  };
}
