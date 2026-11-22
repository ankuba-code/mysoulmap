const ELEMENTS = {
  earth: "erde",
  water: "wasser",
  fire: "feuer",
  air: "luft",
  aether: "aether",
  erde: "erde",
  wasser: "wasser",
  feuer: "feuer",
  luft: "luft",
};

export function toSplashPlaces(places) {
  if (!Array.isArray(places)) return [];
  return places.flatMap((place) => {
    const lat = Number(place?.coordinates?.lat);
    const lon = Number(place?.coordinates?.lng ?? place?.coordinates?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const element = ELEMENTS[String(place.element || "").toLowerCase()] || "aether";
    return [{ id: String(place.id || ""), name: String(place.name || ""), lat, lon, element }];
  });
}

export async function loadSplashPlaces() {
  try {
    const response = await fetch("/api/atlas/places");
    if (!response.ok) return [];
    const data = await response.json();
    return toSplashPlaces(data?.places);
  } catch {
    return [];
  }
}
