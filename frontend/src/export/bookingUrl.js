const BOOKING_LANGS = new Set(["de", "es", "en", "ru"]);

const RADIUS_KM = "20";

function coordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(5) : "";
}

export function bookingSearchUrl(place, language, aid = __BOOKING_AFFILIATE_ID__) {
  const lang = BOOKING_LANGS.has(language) ? language : "de";
  const latitude = coordinate(place?.coordinates?.lat);
  const longitude = coordinate(place?.coordinates?.lng);
  const query = new URLSearchParams({
    aid: aid || "",
    ss: [place?.sourceName || place?.name, place?.sourceCountry || place?.country].filter(Boolean).join(", "),
    label: "soulmap",
  });
  if (latitude && longitude) {
    query.set("latitude", latitude);
    query.set("longitude", longitude);
    query.set("radius", RADIUS_KM);
    query.set("dest_type", "latlong");
    query.set("order", "distance");
  }
  return `https://www.booking.com/searchresults.${lang}.html?${query}`;
}

export function bookingTarget(place, language) {
  const given = String(place?.booking_url || "");
  if (given.startsWith("https://www.booking.com/")) {
    return given;
  }
  if (!place?.name) {
    return "";
  }
  return bookingSearchUrl(place, language);
}
