import { useEffect, useRef, useState } from "react";
import { postChat } from "../chat/api";
import { copyFor } from "../chat/copy";
import {
  INITIAL_STATE,
  MAX_MESSAGE_LENGTH,
  MAX_TURNS,
  applyResponse,
  buildRequest,
  canSend,
} from "../chat/conversation";
import { exportPdf } from "../export/pdf";
import { hasExportableResult } from "../export/results";
import { exportScreenshot } from "../export/screenshot";
import AiDisclosure from "./AiDisclosure";
import ChatMessage from "./ChatMessage";
import ExportBar from "./ExportBar";

const LANGUAGES = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "ru", label: "Русский" },
];

export default function ChatApp({
  embedded = false,
  initialLanguage = "de",
  fromRitual = false,
  ritualContext = null,
  gatePrompts = null,
  onRecommendedPlaces = null,
  seedPrompt = "",
  onSeedHandled = null,
}) {
  const [state, setState] = useState(() => ({
    ...INITIAL_STATE,
    shownPlaceIds: ritualContext?.matched_place_ids ? [...ritualContext.matched_place_ids] : [],
  }));
  const [language, setLanguage] = useState(initialLanguage);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState(fromRitual && gatePrompts ? "gate" : "chat");
  const resultRef = useRef(null);
  const inflightRef = useRef(false);
  const seedRef = useRef("");
  const copy = copyFor(language);
  const allowed = canSend(draft, state.messages.length) && !busy;
  const canExport = hasExportableResult(state.messages) && !busy && !exporting;

  async function runTurn(text) {
    const content = text.trim();
    if (!canSend(content, state.messages.length) || busy || inflightRef.current) {
      return;
    }
    inflightRef.current = true;
    setBusy(true);
    setError("");
    setPhase("chat");
    try {
      const response = await postChat(
        buildRequest(state, content, language, { fromRitual, ritualContext }),
      );
      setState((current) => applyResponse(current, content, response));
      setDraft("");
      if (onRecommendedPlaces && response.recommended_places?.length) {
        onRecommendedPlaces(response.recommended_places);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.sending);
    } finally {
      inflightRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!seedPrompt || seedRef.current === seedPrompt) {
      return;
    }
    seedRef.current = seedPrompt;
    void runTurn(seedPrompt);
    onSeedHandled?.();
  }, [seedPrompt]);

  async function onSubmit(event) {
    event.preventDefault();
    await runTurn(draft);
  }

  async function onExportPng() {
    setError("");
    setExporting(true);
    try {
      await exportScreenshot(resultRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.exportError);
    } finally {
      setExporting(false);
    }
  }

  function onExportPdf() {
    setError("");
    setExporting(true);
    try {
      exportPdf({
        messages: state.messages,
        disclosure: state.aiDisclosure ? copy.disclosure : "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.exportError);
    } finally {
      setExporting(false);
    }
  }

  if (phase === "gate" && gatePrompts) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runTurn(gatePrompts.placeDetails)}
            className="rounded-full border border-white/40 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40"
          >
            {gatePrompts.ctaPlaceDetails}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runTurn(gatePrompts.morePlaces)}
            className="rounded-full border border-white/40 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40"
          >
            {gatePrompts.ctaMorePlaces}
          </button>
        </div>
        {error ? <p className="text-sm text-rose-200">{error}</p> : null}
        {busy ? <p className="text-sm italic text-white/60">{copy.sending}</p> : null}
      </div>
    );
  }

  return (
    <main className={embedded ? "flex min-w-0 flex-col gap-4 py-4" : "mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8"}>
      {embedded ? null : (
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-stone-500">{copy.title}</p>
          <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">{copy.lead}</h1>
        </header>
      )}
      {state.aiDisclosure ? <AiDisclosure text={copy.disclosure} /> : null}
      <section
        ref={resultRef}
        className="flex flex-1 flex-col gap-3 bg-transparent"
        aria-live="polite"
      >
        {state.messages.map((message, index) => (
          <ChatMessage
            key={`${message.role}-${index}`}
            message={message}
            copy={copy}
            language={language}
            ritual={embedded}
          />
        ))}
        {busy ? <p className="text-sm text-stone-500">{copy.sending}</p> : null}
      </section>
      <form
        onSubmit={onSubmit}
        className={
          embedded
            ? "space-y-3 rounded-2xl border border-white/30 bg-transparent p-3"
            : "sticky bottom-4 space-y-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200"
        }
      >
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {state.messages.length >= MAX_TURNS ? (
          <p className="text-sm text-stone-500">{copy.limit}</p>
        ) : null}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={copy.placeholder}
          className={
            embedded
              ? "w-full resize-none rounded-2xl border border-white/35 bg-transparent px-3 py-2 text-white outline-none placeholder:text-white/45"
              : "w-full resize-none rounded-xl bg-stone-50 px-3 py-2 text-stone-900 outline-none ring-1 ring-stone-200 focus:ring-stone-400"
          }
          disabled={busy || state.messages.length >= MAX_TURNS}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {embedded ? (
            <span className="text-xs uppercase tracking-wide text-stone-500">{language.toUpperCase()}</span>
          ) : (
            <label className="text-sm text-stone-600">
              <span className="sr-only">Sprache</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-md bg-stone-50 px-2 py-1 ring-1 ring-stone-200"
              >
                {LANGUAGES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <ExportBar
              onPng={onExportPng}
              onPdf={onExportPdf}
              copy={copy}
              disabled={!canExport}
            />
            <button
              type="submit"
              disabled={!allowed}
              className={
                embedded
                  ? "rounded-full border border-white/50 px-4 py-2 text-sm text-white disabled:opacity-40"
                  : "rounded-lg bg-stone-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-stone-400"
              }
            >
              {copy.send}
            </button>
          </div>
        </div>
      </form>
      {embedded ? null : (
        <footer className="flex gap-4 text-sm text-stone-500">
          <a href="/impressum" className="underline">
            Impressum
          </a>
          <a href="/datenschutz" className="underline">
            Datenschutz
          </a>
        </footer>
      )}
    </main>
  );
}
