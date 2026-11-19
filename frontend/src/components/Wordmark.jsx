import { Link } from "react-router-dom";

export default function Wordmark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 text-white" aria-label="SoulMap">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0 text-white/85">
        <circle cx="11" cy="11" r="9.2" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="11" cy="11" r="5.2" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <path d="M11 1.8 V20.2 M1.8 11 H20.2" fill="none" stroke="currentColor" strokeWidth="0.55" />
      </svg>
      <span className="font-serif text-[1.45rem] leading-none font-light tracking-[-0.03em]">Soul<span className="italic">Map</span></span>
    </Link>
  );
}
