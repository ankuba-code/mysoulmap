import { goHref } from "../chat/goHref";

export default function PlaceList({ places, bookingLabel, adLabel, language }) {
  if (!places?.length) {
    return null;
  }
  return (
    <ul className="mt-3 grid gap-2">
      {places.map((place) => (
        <li
          key={place.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200"
        >
          <span className="font-medium text-stone-800">{place.name}</span>
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
      ))}
    </ul>
  );
}
