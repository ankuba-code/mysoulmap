import { useId, useState } from "react";
import { postFeedback } from "../chat/api";

export default function FeedbackBar({ copy, light = false }) {
  const [pending, setPending] = useState(null);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const tone = light ? "border-white/40 text-white" : "border-stone-300 text-stone-700";
  const active = light ? "bg-white text-stone-950" : "bg-stone-900 text-white";

  function choose(vote) {
    setPending(vote);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!pending || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postFeedback({ vote: pending, text: draft.trim() });
      setSent(pending);
      setPending(null);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.feedbackError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <VoteButton
          label={copy.like}
          pressed={sent === "like" || pending === "like"}
          tone={tone}
          active={active}
          onClick={() => choose("like")}
        />
        <VoteButton
          label={copy.dislike}
          pressed={sent === "dislike" || pending === "dislike"}
          tone={tone}
          active={active}
          onClick={() => choose("dislike")}
        />
      </div>
      {sent && !pending ? <p className="mt-2 text-[13px]">{copy.feedbackThanks}</p> : null}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="presentation">
          <form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-4 text-stone-900 shadow-xl"
          >
            <p id={titleId} className="text-[15px] font-medium">{copy.feedbackTitle}</p>
            <p className="text-[13px] text-stone-600">{copy.feedbackHint}</p>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 500))}
              maxLength={500}
              rows={4}
              placeholder={copy.feedbackPlaceholder}
              className="w-full rounded-xl bg-stone-50 px-3 py-2 text-[14px] text-stone-900 outline-none ring-1 ring-stone-200"
            />
            {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-stone-900 px-4 py-1.5 text-[13px] text-white disabled:opacity-40"
              >
                {copy.feedbackSend}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-full border border-stone-300 px-4 py-1.5 text-[13px]"
              >
                {copy.feedbackCancel}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function VoteButton({ label, pressed, tone, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[13px] ${pressed ? active : tone}`}
    >
      {label}
    </button>
  );
}
