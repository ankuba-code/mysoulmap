import BookingQr from "./BookingQr";
import CountryLabel from "./CountryLabel";
import { goHref } from "../chat/goHref";
import { localizePlace } from "../places/localize";

export default function PlaceList({ places, bookingLabel, adLabel, language }) {
  if (!places?.length) {
    return null;
  }
  return (
    <ul className="mt-3 grid gap-2">
      {places.map((place) => {
        const shown = localizePlace(place, language);
        return (
        <li
          key={place.id}
          className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200"
        >
          <BookingQr place={shown} language={language} label={bookingLabel} size={64} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-stone-800">{shown.name}</span>
            <CountryLabel country={shown.country} flagCountry={shown.flagCountry} className="text-[13px] text-stone-600" />
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-stone-500">{adLabel}</span>
            <a
              href={goHref(place.booking_link, language)}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white"
            >
              {bookingLabel}
            </a>
          </span>
        </li>
        );
      })}
    </ul>
  );
}
