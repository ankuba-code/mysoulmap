import { describe, expect, it } from "vitest";
import { bookingSearchUrl, bookingTarget } from "./bookingUrl";

describe("bookingSearchUrl", () => {
  it("builds the booking.com affiliate search for the place", () => {
    const url = new URL(
      bookingSearchUrl(
        { name: "Machu Picchu", country: "Peru", coordinates: { lat: -13.1631, lng: -72.545 } },
        "de",
        "123456",
      ),
    );
    expect(url.origin).toBe("https://www.booking.com");
    expect(url.pathname).toBe("/searchresults.de.html");
    expect(url.searchParams.get("aid")).toBe("123456");
    expect(url.searchParams.get("ss")).toBe("Machu Picchu, Peru");
    expect(url.searchParams.get("latitude")).toBe("-13.16310");
    expect(url.searchParams.get("longitude")).toBe("-72.54500");
    expect(url.searchParams.get("radius")).toBe("20");
    expect(url.searchParams.get("dest_type")).toBe("latlong");
    expect(url.searchParams.get("order")).toBe("distance");
    expect(url.searchParams.get("label")).toBe("soulmap");
  });

  it("prefers a booking.com url already on the place", () => {
    const given = "https://www.booking.com/searchresults.en.html?aid=9&ss=Uluru";
    expect(bookingTarget({ name: "Uluru", country: "Australia", booking_url: given }, "de")).toBe(given);
  });
});
