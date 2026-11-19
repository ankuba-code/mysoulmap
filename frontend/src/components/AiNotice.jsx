import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export default function AiNotice({ copy, onClose }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-notice-title"
        aria-describedby="ai-notice-body"
        className="w-full max-w-md rounded-2xl border border-white/30 bg-[#120e18] p-6 text-white shadow-[0_16px_48px_rgb(0_0_0_/_0.45)]"
      >
        <p className="font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase">{copy.aiNoticeKicker}</p>
        <h2 id="ai-notice-title" className="mt-2 font-serif text-2xl font-light">
          {copy.aiNoticeTitle}
        </h2>
        <p id="ai-notice-body" className="mt-3 text-[14px] italic leading-relaxed text-white/80">
          {copy.aiNoticeBody}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            ref={buttonRef}
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm text-stone-950"
          >
            {copy.aiNoticeAck}
          </button>
          <Link to="/disclaimer" className="text-[13px] text-white/70 underline-offset-4 hover:text-white hover:underline">
            {copy.aiNoticeMore}
          </Link>
        </div>
      </div>
    </div>
  );
}
