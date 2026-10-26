import { useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import ChatApp from "../components/ChatApp";
import RitualShell from "../components/RitualShell";
import { goHref } from "../chat/goHref";
import { copyFor } from "../chat/copy";
import { exportPdf } from "../export/pdf";
import { exportScreenshot } from "../export/screenshot";
import { pickCard } from "../ritual/card";
import { ritualCopy } from "../ritual/copy";
import { SymbolCluster, choiceIcons } from "../ritual/marks";
import { clearRitual, loadRitual } from "../ritual/session";
import ResultsMap from "./ResultsMap";

export default function ResultsPage() {
  const stored = loadRitual();
  if (!stored) {
    return <Navigate to="/" replace />;
  }
  return <ResultsBody stored={stored} />;
}

function ResultsBody({ stored }) {
  const { language, result } = stored;
  const copy = ritualCopy(language);
  const booking = copyFor(language);
  const card = result.anima_card;
  const anima = pickCard(stored.answers, language);
  const icons = choiceIcons(stored.answers);
  const shareRef = useRef(null);
  const [focusPlaceId, setFocusPlaceId] = useState(null);
  const [seedPrompt, setSeedPrompt] = useState("");
  const [extraPlaces, setExtraPlaces] = useState([]);
  const pageUrl = typeof window === "undefined" ? "/results" : window.location.href;

  const context = useMemo(
    () => ({
      archetype_symbol: card.archetype_symbol,
      element: card.element,
      inner_rhythm: card.inner_rhythm,
      emotional_intensity: card.emotional_intensity,
      travel_direction: card.travel_direction,
      dominant_frequency: card.dominant_frequency,
      matched_place_ids: result.matches.map((place) => place.id),
    }),
    [card, result.matches],
  );

  const places = useMemo(() => {
    const byId = new Map(result.matches.map((place) => [place.id, place]));
    for (const place of extraPlaces) {
      if (!byId.has(place.id)) {
        byId.set(place.id, place);
      }
    }
    return [...byId.values()];
  }, [result.matches, extraPlaces]);

  function mergeChatPlaces(recommended) {
    if (!recommended?.length) {
      return;
    }
    setExtraPlaces((current) => {
      const known = new Set([...result.matches, ...current].map((place) => place.id));
      const next = [...current];
      for (const place of recommended) {
        if (known.has(place.id)) {
          continue;
        }
        known.add(place.id);
        const coords = place.coordinates;
        const hasCoords =
          coords &&
          Number.isFinite(Number(coords.lat)) &&
          Number.isFinite(Number(coords.lng));
        next.push({
          id: place.id,
          name: place.name,
          country: place.country || "",
          coordinates: hasCoords
            ? { lat: Number(coords.lat), lng: Number(coords.lng) }
            : null,
          primaervibration: place.primaervibration || "",
          correspondence: place.correspondence || "",
          booking_link: place.booking_link || `/go/${place.id}`,
          score: null,
          reasons: [],
          fromChat: true,
        });
      }
      return next;
    });
  }

  const mapped = places.filter(
    (place) => place.coordinates && Number.isFinite(place.coordinates.lat) && Number.isFinite(place.coordinates.lng),
  );

  return (
    <RitualShell language={language} assistantLabel={copy.assistantNav}>
      <div ref={shareRef} className="grid gap-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <p className="text-sm tracking-wide text-white/70">Soulmaps</p>
            <h1 className="mt-2 font-serif text-3xl font-light tracking-tight sm:text-4xl">{copy.resultsTitle}</h1>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => void exportScreenshot(shareRef.current)}
                className="rounded-full border border-white/40 px-4 py-2.5 text-center text-[13px] sm:py-2"
              >
                {copy.screenshot}
              </button>
              <button
                type="button"
                onClick={() =>
                  exportPdf({
                    messages: [
                      {
                        role: "assistant",
                        content: `${anima.name}. ${anima.desc}`,
                        recommendedPlaces: places,
                      },
                    ],
                    disclosure: copy.guestHint,
                  })
                }
                className="rounded-full border border-white/40 px-4 py-2.5 text-center text-[13px] sm:py-2"
              >
                {copy.pdfCard}
              </button>
            </div>
            <Link to="/?card=1" className="rounded-full border border-white/40 px-4 py-2.5 text-center text-[13px] sm:py-2">
              {copy.toCard}
            </Link>
          </div>
        </header>

        <section className="border-b border-white/25 pb-8">
          <p className="font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">Deine SoulMap</p>
          <div className="mt-6 grid items-center gap-6 md:grid-cols-[220px_1fr]">
            <SymbolCluster icons={icons} size={200} />
            <div>
              <h2 className="font-serif text-[28px] font-light italic sm:text-[34px]">{anima.name}</h2>
              <p className="mt-2 text-[13px] italic leading-relaxed break-words text-white/70">
                Element {card.element} · Innere Bewegung {card.inner_rhythm} · Intensität {card.emotional_intensity} · Frequenz {card.dominant_frequency}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[`Element: ${card.element}`, `Leitform: ${anima.symbol}`, `Dominante Frequenz: ${card.dominant_frequency}`].map((label) => (
                  <span key={label} className="max-w-full rounded-full border border-white/35 px-3 py-1 font-mono text-[10px] break-words text-white/70">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/30">
          <ResultsMap places={mapped} focusPlaceId={focusPlaceId} />
        </section>

        <section>
          <p className="font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">{copy.poisTitle}</p>
          <div className="mt-4 space-y-6">
            {places.map((place) => (
              <article key={place.id} className="border-b border-white/25 pb-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-serif text-[22px] italic">{place.name}</h3>
                    <p className="mt-1 font-mono text-[10px] tracking-[0.12em] break-words text-white/55 uppercase">
                      {[place.country, place.primaervibration].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFocusPlaceId(place.id)}
                      className="rounded-full border border-white/40 px-3 py-2 text-center text-[12px] sm:px-4"
                    >
                      {copy.showTerrain}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSeedPrompt(`${copy.promptPlaceDetails} Ort: ${place.name}.`);
                        document.getElementById("reiseassistent")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="rounded-full border border-white/40 px-3 py-2 text-center text-[12px] sm:px-4"
                    >
                      {copy.moreAbout}
                    </button>
                  </div>
                </div>
                {place.correspondence ? <p className="mt-2 text-[13px] italic text-white/75">{place.correspondence}</p> : null}
                {place.reasons?.length ? (
                  <div className="mt-3">
                    <p className="font-mono text-[10px] tracking-[0.12em] text-white/50 uppercase">{copy.whyPlace}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] italic text-white/70">
                      {place.reasons.slice(0, 3).map((reason) => (
                        <li key={`${place.id}-${reason.dimension}`}>{reason.text}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <a
                  href={goHref(place.booking_link, language)}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/80 underline-offset-4 hover:underline"
                >
                  <span className="font-mono text-[10px] tracking-[0.12em] uppercase">{booking.ad}</span>
                  {booking.booking}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section>
          <p className="font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">{copy.printTitle}</p>
          <p className="mt-2 max-w-[52ch] text-[13px] italic text-white/70">{copy.printLead}</p>
          <div className="mt-4 w-full max-w-sm bg-white p-3 text-stone-950 shadow-[0_8px_28px_rgb(0_0_0_/_0.25)]">
            <p className="font-mono text-[8px] tracking-[0.16em] uppercase">Deine SoulMap</p>
            <p className="font-serif text-lg italic">{anima.name}</p>
            <p className="mt-1 text-[11px] italic text-stone-600">
              Ton: {anima.ton} · Impuls: {anima.impuls} · Archetyp: {anima.symbol}
            </p>
            <p className="mt-2 max-w-[36ch] text-[11px] italic leading-snug text-stone-700">“{anima.desc}”</p>
          </div>
        </section>

        <section className="border-t border-white/25 pt-8">
          <p className="font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">{copy.qrTitle}</p>
          <p className="mt-2 text-[13px] italic text-white/70">{copy.qrLead}</p>
          <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-white/40 p-3">
              <QRCodeSVG value={pageUrl} size={128} bgColor="transparent" fgColor="#f6f2ec" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[11px] break-all text-white/60">{pageUrl}</p>
              <a href={pageUrl} className="text-[13px] italic underline-offset-4 hover:underline">
                {copy.openLink}
              </a>
              <p className="max-w-[42ch] text-[12px] italic text-white/60">{copy.localHint}</p>
            </div>
          </div>
        </section>
      </div>

      <section id="reiseassistent" className="mt-10 border-t border-white/25 pt-8">
        <p className="font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">Atlas der Entsprechungen</p>
        <h2 className="mt-2 font-serif text-2xl font-light sm:text-3xl">{copy.assistantNav}</h2>
        <p className="mt-2 max-w-[62ch] text-[14px] italic text-white/70">{copy.chatLead}</p>
        <div className="mt-4 border-t border-white/20 pt-4">
          <ChatApp
            embedded
            initialLanguage={language}
            fromRitual
            ritualContext={context}
            seedPrompt={seedPrompt}
            onSeedHandled={() => setSeedPrompt("")}
            gatePrompts={{
              placeDetails: copy.promptPlaceDetails,
              morePlaces: copy.promptMorePlaces,
              ctaPlaceDetails: copy.ctaPlaceDetails,
              ctaMorePlaces: copy.ctaMorePlaces,
            }}
            onRecommendedPlaces={mergeChatPlaces}
          />
        </div>
      </section>
      <p className="mt-8 text-xs text-white/50">
        <Link to="/" onClick={() => clearRitual()} className="underline-offset-4 hover:underline">
          {copy.restart}
        </Link>
      </p>
    </RitualShell>
  );
}
