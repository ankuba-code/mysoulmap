import { useState } from "react";
import RitualShell from "../components/RitualShell";
import { loadLanguage, saveLanguage } from "../ritual/session";
import { legalCopy, pageBlocks } from "./copy";

function LegalArticle({ page }) {
  const [language, setLanguage] = useState(() => loadLanguage() || "de");
  const copy = legalCopy(language);

  function onLanguage(next) {
    saveLanguage(next);
    setLanguage(next);
  }

  return (
    <RitualShell language={language} onLanguage={onLanguage}>
      <article>
        <h1 className="font-serif text-3xl font-light tracking-tight text-white sm:text-4xl">{copy[page].title}</h1>
        <div className="mt-6 space-y-8">
          {pageBlocks(copy[page]).map((section) => (
            <section key={section.heading || section.paragraphs[0]}>
              {section.heading ? (
                <h2 className="font-serif text-xl font-light text-white">{section.heading}</h2>
              ) : null}
              <div className={`space-y-4 text-[15px] leading-relaxed text-white/80 ${section.heading ? "mt-3" : ""}`}>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </RitualShell>
  );
}

export function ImpressumPage() {
  return <LegalArticle page="impressum" />;
}

export function DisclaimerPage() {
  return <LegalArticle page="disclaimer" />;
}

export function PrivacyPage() {
  return <LegalArticle page="privacy" />;
}
