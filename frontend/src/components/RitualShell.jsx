import { Link, useLocation } from "react-router-dom";
import { legalNav } from "../legal/copy";
import { LANGUAGE_LABEL } from "../ritual/session";
import Wordmark from "./Wordmark";

const LANGUAGES = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
  { id: "ru", label: "Русский" },
];

export default function RitualShell({ children, language = "de", onLanguage }) {
  const { pathname } = useLocation();
  const current = LANGUAGES.find((item) => item.id === language) || LANGUAGES[2];
  const links = legalNav(language);
  return (
    <div className="sm-shell" data-ritual-page="">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 sm-ritual-bg" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 sm-ritual-scrim" />
      <div className="sm-content">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/20 pb-3 sm:mb-6 sm:pb-4">
          <Wordmark />
          {onLanguage ? (
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full border border-white/30 p-0.5" role="group" aria-label={LANGUAGE_LABEL[language] || LANGUAGE_LABEL.de}>
                {LANGUAGES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === language}
                    onClick={() => onLanguage(item.id)}
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase ${
                      item.id === language ? "bg-white text-stone-950" : "text-white/70 hover:text-white"
                    }`}
                  >
                    {item.id}
                  </button>
                ))}
              </div>
              <span className="hidden font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase sm:inline">
                {current.label}
              </span>
            </div>
          ) : null}
        </header>
        {children}
        <footer className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-white/20 pt-4 text-[12px]">
          {links.map((item) => {
            const currentPage = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={currentPage ? "page" : undefined}
                className={currentPage ? "text-white" : "text-white/60 hover:text-white"}
              >
                {item.label}
              </Link>
            );
          })}
        </footer>
      </div>
    </div>
  );
}
