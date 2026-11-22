import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DotSpinner from "../components/DotSpinner";
import RitualShell from "../components/RitualShell";
import { postMatch } from "./api";
import { pickCard } from "./card";
import { QUESTION_IDS, ritualCopy } from "./copy";
import { Mark, SymbolCluster, choiceIcons, iconFor, phaseFor } from "./marks";
import Splash from "../splash/Splash";
import { loadRitual, resolveLanguage, saveLanguage, saveRitual } from "./session";

const TEXT_MIN = { q6: 1, q7: 2 };

export default function RitualScroll({ focusCard = false }) {
  const navigate = useNavigate();
  const stored = loadRitual();
  const [language, setLanguage] = useState(() => resolveLanguage(stored?.language));
  const [answers, setAnswers] = useState(stored?.answers || {});
  const [activeId, setActiveId] = useState("intro");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = ritualCopy(language);
  const card = pickCard(answers, language);
  const trail = choiceIcons(answers);
  const activeIcon = trail.length ? trail[trail.length - 1] : "circle";

  useEffect(() => {
    const scenes = [...QUESTION_IDS, "card"]
      .map((id) => document.getElementById(`ritual-${id}`))
      .filter(Boolean);
    if (!scenes.length || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target?.id?.replace("ritual-", "");
        if (id) {
          setActiveId(id);
        }
      },
      { rootMargin: "-30% 0px -40% 0px", threshold: [0.25, 0.6] },
    );
    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (focusCard) {
      document.getElementById("ritual-card")?.scrollIntoView?.({ block: "start" });
    }
  }, [focusCard]);

  function onLanguage(next) {
    saveLanguage(next);
    setLanguage(next);
  }

  function reveal(id) {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    document.getElementById(`ritual-${id}`)?.scrollIntoView?.({
      behavior: motion ? "auto" : "smooth",
      block: "start",
    });
  }

  function choose(id, index) {
    setAnswers((current) => ({ ...current, [id]: index }));
    const next = QUESTION_IDS[QUESTION_IDS.indexOf(id) + 1] || "card";
    window.setTimeout(() => reveal(next), motionDelay());
  }

  function setText(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function canLeave(id) {
    const value = answers[id];
    if (id === "q6" || id === "q7") {
      return typeof value === "string" && value.trim().length >= TEXT_MIN[id];
    }
    return Number.isInteger(value);
  }

  async function openResults() {
    setBusy(true);
    setError("");
    try {
      const result = await postMatch({ answers, language });
      saveLanguage(language);
      saveRitual({ language, answers, result });
      navigate("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.evalError);
      setBusy(false);
    }
  }

  return (
    <RitualShell
      language={language}
      onLanguage={onLanguage}
      leading={<Splash copy={copy.splash} onBegin={() => reveal("q0")} />}
    >
      <div className="sticky top-20 z-20 -mx-1 mb-2 flex items-center gap-3 rounded-full border border-white/25 bg-black/35 px-3 py-2 backdrop-blur-sm">
        <span className="ritual-dock-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/50" style={{ transform: activeId === "card" ? "scale(1.08)" : undefined }}>
          <Mark name={activeIcon} className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden" aria-hidden="true">
          {trail.map((name, index) => (
            <span key={`${name}-${index}`} className="ritual-dock-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30">
              <Mark name={name} />
            </span>
          ))}
        </div>
      </div>

      {QUESTION_IDS.map((id, number) => {
        const question = copy.questions[id];
        const phase = phaseFor(id);
        const value = answers[id];
        return (
          <section key={id} id={`ritual-${id}`} className="ritual-scene min-h-[78svh] scroll-mt-36 border-t border-white/15 py-12">
            <p className="font-mono text-[11px] tracking-[0.14em] text-white/60 uppercase">
              {phase.letter} · {copy[phase.labelKey]} · {copy.progress.replace("{number}", String(number + 1)).replace("{total}", "8")}
            </p>
            <h2 className="mt-5 font-serif text-2xl leading-snug sm:text-[28px]">{question.text}</h2>
            <p className="mt-3 max-w-[60ch] text-[13px] italic text-white/65">{question.hint}</p>
            {question.choices ? (
              <div className="mt-8 flex flex-col">
                {question.choices.map((label, index) => {
                  const selected = value === index;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => choose(id, index)}
                      className={`ritual-answer flex w-full items-start gap-3 border-b border-white/25 px-1 py-4 text-left ${
                        selected ? "bg-white/10 text-white" : "text-white/75"
                      }`}
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${selected ? "border-white" : "border-white/40"}`}>
                        <Mark name={iconFor(id, index)} />
                      </span>
                      <span className="min-w-0 text-[15px] leading-snug">{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ritual-answer mt-8">
                <label className="block">
                  <span className="sr-only">{question.text}</span>
                  <textarea
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setText(id, event.target.value)}
                    rows={5}
                    maxLength={400}
                    placeholder={question.placeholder}
                    className="min-h-[140px] w-full resize-none rounded-2xl border border-white/35 bg-transparent px-4 py-3 text-[15px] italic text-white outline-none placeholder:text-white/45"
                  />
                </label>
                <button
                  type="button"
                  disabled={!canLeave(id)}
                  onClick={() => reveal(id === "q7" ? "card" : QUESTION_IDS[number + 1])}
                  className="mt-4 rounded-full border border-white/50 px-5 py-2 text-[14px] text-white disabled:opacity-40"
                >
                  {id === "q7" ? copy.generateCard : copy.next}
                </button>
              </div>
            )}
          </section>
        );
      })}

      <section id="ritual-card" className="ritual-scene min-h-[78svh] scroll-mt-36 border-t border-white/15 py-14 text-center">
        <p className="font-mono text-[10px] tracking-[0.16em] text-white/60 uppercase">{copy.cardKicker}</p>
        <div className="mx-auto mt-6 w-full max-w-xs">
          <SymbolCluster icons={trail} />
        </div>
        <h2 className="mt-6 font-serif text-2xl font-light italic">{card.name}</h2>
        <p className="mx-auto mt-5 max-w-[42ch] text-[13px] italic leading-relaxed text-white/70">“{card.desc}”</p>
        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        <button
          type="button"
          onClick={() => void openResults()}
          disabled={busy || !QUESTION_IDS.every((id) => canLeave(id))}
          className="mt-8 inline-flex items-center gap-3 rounded-full border border-white bg-white px-6 py-2.5 text-[14px] text-stone-950 disabled:opacity-40"
        >
          {busy ? <DotSpinner /> : null}
          {copy.openResults}
        </button>
      </section>
    </RitualShell>
  );
}

function motionDelay() {
  if (typeof window === "undefined") {
    return 0;
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 0 : 280;
}
