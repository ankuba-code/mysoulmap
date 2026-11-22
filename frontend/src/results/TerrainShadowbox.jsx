import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import ResultsMap from "./ResultsMap";
import CountryLabel from "../components/CountryLabel";

export default function TerrainShadowbox({ place, places, origin, originLabel, closeLabel, language = "de", onClose, children = null }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        className="flex h-[min(88vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/30 bg-[#120e18] text-white shadow-[0_24px_80px_rgb(0_0_0_/_0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-xl italic">{place.name}</p>
            {place.country ? (
              <CountryLabel country={place.country} flagCountry={place.flagCountry} className="text-[13px] text-white/80" />
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/40 px-3 py-1.5 text-[12px]"
          >
            {closeLabel}
          </button>
        </div>
        <div className={children ? "flex min-h-0 flex-1 flex-col" : "min-h-0 flex-1"}>
          <div className={children ? "h-52 shrink-0 sm:h-64" : "h-full"}>
            <ResultsMap
              places={places}
              focusPlaceId={place.id}
              origin={origin}
              originLabel={originLabel}
              layout="overlay"
              language={language}
            />
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
