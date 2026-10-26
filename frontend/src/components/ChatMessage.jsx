import ReactMarkdown from "react-markdown";
import FallbackNotice from "./FallbackNotice";
import PlaceList from "./PlaceList";

export default function ChatMessage({ message, copy, language, ritual = false }) {
  const isUser = message.role === "user";
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
