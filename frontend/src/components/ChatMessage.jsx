import ReactMarkdown from "react-markdown";
import { goHref } from "../chat/goHref";
import FallbackNotice from "./FallbackNotice";
import PlaceList from "./PlaceList";

const PLACE_TONES = [
  {
    card: "border-[rgba(216,187,255,0.38)] bg-[rgba(216,187,255,0.12)]",
    dot: "bg-[#d8bbff]",
  },
  {
    card: "border-[rgba(232,196,160,0.36)] bg-[rgba(232,196,160,0.12)]",
    dot: "bg-[#e8c4a0]",
  },
  {
    card: "border-[rgba(183,207,228,0.36)] bg-[rgba(183,207,228,0.12)]",
    dot: "bg-[#b7cfe4]",
  },
];

export default function ChatMessage({ message, copy, language, ritual = false, hideOverview = false }) {
  const isUser = message.role === "user";
  const sections = hideOverview
    ? (message.sections ?? []).filter((section) => section.kind !== "overview")
    : message.sections;
  if (!isUser && ritual && hideOverview && message.sections?.length && !sections.length) {
    return null;
  }
  if (!isUser && ritual && sections?.length) {
    return <RitualSections message={{ ...message, sections }} copy={copy} language={language} />;
  }
  const bubble = ritual
    ? "border border-white/35 bg-black/25 text-white"
    : isUser
      ? "bg-stone-900 text-white"
      : "bg-white text-stone-800 ring-1 ring-stone-200";
  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-full rounded-2xl px-4 py-3 break-words sm:max-w-[42rem] ${bubble}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="assistant-md">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {!isUser && message.source === "fallback" ? <FallbackNotice text={copy.fallback} /> : null}
        {!isUser ? (
          <PlaceList
            places={message.recommendedPlaces}
            bookingLabel={copy.booking}
            adLabel={copy.ad}
            language={language}
          />
        ) : null}
      </div>
    </article>
  );
}

function RitualSections({ message, copy, language }) {
  const recommended = message.recommendedPlaces ?? [];
  const covered = new Set(
    message.sections.filter((section) => section.kind === "place" && section.placeId).map((section) => section.placeId),
  );
  const extraPlaces = recommended.filter((place) => !covered.has(place.id));
  let placeIndex = 0;
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      {message.sections.map((section, index) => {
        if (section.kind === "overview") {
          return (
            <article key={`overview-${index}`} className="rounded-2xl border border-white/45 bg-black/25 px-4 py-3 text-white">
              <p className="font-mono text-[10px] tracking-[0.16em] text-white/60 uppercase">{copy.overviewKicker}</p>
              <h3 className="mt-1 font-serif text-[20px] font-light italic">{copy.overviewTitle}</h3>
              <div className="assistant-md mt-2 text-[14px] italic leading-relaxed text-white/80">
                <ReactMarkdown>{section.text}</ReactMarkdown>
              </div>
            </article>
          );
        }
        const tone = PLACE_TONES[placeIndex % PLACE_TONES.length];
        placeIndex += 1;
        const booking = recommended.find((place) => place.id === section.placeId);
        const meta = [section.country, section.primaervibration].filter(Boolean).join(" · ");
        return (
          <article key={section.placeId || `place-${index}`} className={`rounded-2xl border px-4 py-3 text-white ${tone.card}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
              <h3 className="font-serif text-[20px] font-light italic">{section.name}</h3>
            </div>
            {meta ? (
              <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-white/55 uppercase">{meta}</p>
            ) : null}
            <div className="assistant-md mt-2 text-[14px] italic leading-relaxed text-white/80">
              <ReactMarkdown>{section.text}</ReactMarkdown>
            </div>
            {booking ? (
              <a
                href={goHref(booking.booking_link, language)}
                target="_blank"
                rel="sponsored nofollow noopener"
                className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/80 underline-offset-4 hover:underline"
              >
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase">{copy.ad}</span>
                {copy.booking}
              </a>
            ) : null}
          </article>
        );
      })}
      {message.source === "fallback" ? <FallbackNotice text={copy.fallback} /> : null}
      <PlaceList places={extraPlaces} bookingLabel={copy.booking} adLabel={copy.ad} language={language} />
    </div>
  );
}
