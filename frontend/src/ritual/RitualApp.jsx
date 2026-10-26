import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RitualShell from "../components/RitualShell";
import { postMatch } from "./api";
import { pickCard } from "./card";
import { QUESTION_IDS, ritualCopy } from "./copy";
import { Mark, SymbolCluster, choiceIcons, iconFor, phaseFor, progressDots } from "./marks";
import { loadRitual, saveRitual } from "./session";

const TEXT_MIN = { q6: 1, q7: 2 };
const MIN_STEP_MS = import.meta.env.MODE === "test" ? 0 : 600;

export default function RitualApp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stored = loadRitual();
  const [language, setLanguage] = useState(stored?.language || "de");
  const [step, setStep] = useState(searchParams.get("card") === "1" && stored ? "card" : "intro");
  const [answers, setAnswers] = useState(stored?.answers || {});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lastStepAt = useRef(Date.now() - 1000);
  const advancingRef = useRef(false);
  const copy = ritualCopy(language);
  const questionIndex = QUESTION_IDS.indexOf(step);
  const phase = phaseFor(step);
  const dots = progressDots(step);
  const card = pickCard(answers, language);

  function setChoice(id, index) {
    setAnswers((current) => ({ ...current, [id]: index }));
  }

  function setText(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function canAdvance() {
    if (questionIndex < 0) {
      return false;
    }
    const value = answers[step];
    if (step === "q6" || step === "q7") {
      return typeof value === "string" && value.trim().length >= TEXT_MIN[step];
    }
    return Number.isInteger(value);
  }

  async function waitGate() {
    const elapsed = Date.now() - lastStepAt.current;
    if (elapsed < MIN_STEP_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, MIN_STEP_MS - elapsed));
    }
    lastStepAt.current = Date.now();
  }

  async function goNext() {
    if (advancingRef.current) {
      return;
    }
    if (step === "intro") {
      lastStepAt.current = Date.now();
      setStep("q0");
      return;
    }
    if (!canAdvance()) {
      return;
    }
    advancingRef.current = true;
    try {
      await waitGate();
      if (step === "q7") {
        setStep("card");
        return;
      }
      setStep(QUESTION_IDS[questionIndex + 1]);
    } finally {
      advancingRef.current = false;
    }
  }

  function goBack() {
    if (step === "card") {
      setStep("q7");
      return;
    }
    if (questionIndex <= 0) {
      setStep("intro");
      return;
    }
    setStep(QUESTION_IDS[questionIndex - 1]);
  }

  async function openResults() {
    setBusy(true);
    setError("");
    setStep("evaluating");
    try {
      const result = await postMatch({ answers, language });
      saveRitual({ language, answers, result });
      navigate("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.evalError);
      setStep("card");
    } finally {
      setBusy(false);
    }
  }

  const nextLabel = step === "intro" ? copy.start : step === "q7" ? copy.generateCard : step === "card" ? copy.openResults : copy.next;
  const nextEnabled = step === "intro" || step === "card" || canAdvance();
  const hint = step === "q6" || step === "q7" ? copy.minChars : copy.pickChoice;

  return (
    <RitualShell language={language} onLanguage={setLanguage} assistantLabel={copy.assistantNav}>
      <header className="mb-6 sm:mb-8">
        <p className="text-sm tracking-wide text-white/75">Soulmaps</p>
        <h1 className="mt-2 font-serif text-3xl font-light tracking-tight text-white sm:text-4xl">{copy.headline}</h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/75">{copy.lead}</p>
        <p className="mt-3 max-w-[60ch] text-[13px] italic text-white/65">{copy.guestHint}</p>
      </header>

      <div className="flex items-center justify-between gap-3 border-b border-white/25 pb-3">
        <p className="min-w-0 truncate font-mono text-[11px] tracking-[0.18em] text-white/70 uppercase">{copy[phase.labelKey]}</p>
        <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full border ${
                index === dots.active
                  ? "border-white bg-white"
                  : index <= dots.doneUntil
                    ? "border-white/50 bg-white/50"
                    : "border-white/40 bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="pt-6">
        {step === "intro" ? <Intro copy={copy} /> : null}
        {questionIndex >= 0 ? (
          <QuestionStep
            copy={copy}
            id={step}
            phase={phase}
            number={questionIndex + 1}
            value={answers[step]}
            onChoice={(index) => setChoice(step, index)}
            onText={(value) => setText(step, value)}
          />
        ) : null}
        {step === "card" ? <CardStep copy={copy} card={card} icons={choiceIcons(answers)} error={error} /> : null}
        {step === "evaluating" ? (
          <section className="min-h-48 py-8 sm:min-h-80" aria-live="polite">
            <h2 className="font-serif text-2xl font-light italic sm:text-3xl">{copy.evaluating}</h2>
            <p className="mt-3 text-[15px] italic text-white/70">{copy.evaluatingLead}</p>
          </section>
        ) : null}

        {step !== "evaluating" ? (
          <div className="mt-8 flex flex-col-reverse gap-4 border-t border-white/25 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === "intro" || busy}
              className="self-start font-mono text-[11px] tracking-[0.12em] text-white/60 uppercase disabled:opacity-35"
            >
              ← {copy.back}
            </button>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <button
                type="button"
                onClick={step === "card" ? () => void openResults() : () => void goNext()}
                disabled={!nextEnabled || busy}
                className={`rounded-full border px-6 py-2.5 text-[14px] disabled:opacity-40 sm:py-2 ${
                  step === "intro" || step === "q7" || step === "card"
                    ? "border-white bg-white text-stone-950"
                    : "border-white/50 text-white"
                }`}
              >
                {nextLabel}
              </button>
              {questionIndex >= 0 && !canAdvance() ? (
                <p className="text-[12px] italic text-white/60 sm:text-right">{hint}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="mt-10 text-xs text-white/60">{copy.footer}</footer>
    </RitualShell>
  );
}

function Intro({ copy }) {
  return (
    <section className="flex min-h-60 flex-col items-center py-6 text-center sm:min-h-[420px]">
      <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" className="text-white/80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="40" cy="40" r="22" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="40" cy="40" r="8" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <path d="M40 6 V74 M6 40 H74 M16 16 L64 64 M64 16 L16 64" fill="none" stroke="currentColor" strokeWidth="0.6" />
      </svg>
      <h2 className="mt-6 font-serif text-3xl font-light italic sm:text-4xl">Soulmaps</h2>
      <p className="mt-2 text-[15px] italic text-white/75">{copy.introSubtitle}</p>
      <p className="mx-auto mt-8 max-w-[32ch] text-[13px] leading-relaxed text-white/70">{copy.introBody}</p>
    </section>
  );
}

function QuestionStep({ copy, id, phase, number, value, onChoice, onText }) {
  const question = copy.questions[id];
  return (
    <section className="min-h-60 py-2 sm:min-h-[420px]">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/60 uppercase sm:tracking-[0.18em]">
        {phase.letter} · {copy[phase.labelKey]} · {copy.progress.replace("{number}", String(number)).replace("{total}", "8")}
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
                onClick={() => onChoice(index)}
                className={`flex w-full items-start gap-3 border-b border-white/25 px-1 py-4 text-left sm:items-center sm:px-2 ${
                  selected ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5"
                }`}
              >
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border sm:mt-0 ${selected ? "border-white" : "border-white/40"}`}>
                  <Mark name={iconFor(id, index)} />
                </span>
                <span className="min-w-0 text-[15px] leading-snug">{label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <label className="mt-8 block">
          <span className="sr-only">{question.text}</span>
          <textarea
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onText(event.target.value)}
            rows={6}
            maxLength={400}
            placeholder={question.placeholder}
            className="min-h-[160px] w-full resize-none rounded-2xl border border-white/35 bg-transparent px-4 py-3 text-[15px] italic text-white outline-none placeholder:text-white/45"
          />
          <span className="mt-3 block text-center text-[12px] italic text-white/55">{question.helper}</span>
        </label>
      )}
    </section>
  );
}

function CardStep({ copy, card, icons, error }) {
  return (
    <section className="min-h-60 py-4 text-center sm:min-h-[420px]">
      <p className="font-mono text-[10px] tracking-[0.16em] text-white/60 uppercase">{copy.cardKicker}</p>
      <div className="mx-auto mt-5 w-full max-w-xs rounded-[28px] border border-white/35 px-4 py-6">
        <p className="font-mono text-[9px] tracking-[0.16em] text-white/50 uppercase">Anima-Karte</p>
        <SymbolCluster icons={icons} />
        <p className="mt-2 font-mono text-[9px] tracking-[0.16em] text-white/45 uppercase">
          {icons.length} {copy.symbolsFused}
        </p>
      </div>
      <h2 className="mt-6 font-serif text-2xl font-light italic sm:text-[28px]">{card.name}</h2>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {[`Ton: ${card.ton}`, `Impuls: ${card.impuls}`, `Archetyp: ${card.symbol}`].map((label) => (
          <span key={label} className="rounded-full border border-white/35 px-3 py-1 font-mono text-[10px] tracking-[0.08em] text-white/70">
            {label}
          </span>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-[62ch] border-t border-white/25 pt-5 text-[13px] italic leading-relaxed text-white/70">
        “{card.desc}”
      </p>
      <p className="mx-auto mt-8 max-w-[44ch] text-[13px] italic text-white/65">{copy.cardHint}</p>
      <p className="mt-5 text-[12px] italic text-white/55">{copy.cardBackHint}</p>
      {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
    </section>
  );
}
