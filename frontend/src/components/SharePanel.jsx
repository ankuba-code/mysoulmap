import { useState } from "react";

export function siteAddress() {
  if (typeof window === "undefined" || !window.location?.origin) {
    return "https://app.mithertz.online";
  }
  return window.location.origin;
}

export function shareTargets(url) {
  const address = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${address}`,
    telegram: `https://t.me/share/url?url=${address}`,
    email: `mailto:?body=${address}`,
  };
}

export default function SharePanel({ copy }) {
  const url = siteAddress();
  const targets = shareTargets(url);
  const [copied, setCopied] = useState(false);
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ url });
    } catch {
      /* Der Browser bricht das Teilen ab, ohne den Chat zu senden. */
    }
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 text-stone-900 ring-1 ring-stone-200" aria-label={copy.shareTitle}>
      <p className="text-sm leading-relaxed">{copy.tokenThanks}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyLink()} className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white">
          {copied ? copy.copied : copy.copyLink}
        </button>
        {canNative ? (
          <button type="button" onClick={() => void nativeShare()} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300">
            {copy.shareSystem}
          </button>
        ) : null}
        <a href={targets.whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300">
          WhatsApp
        </a>
        <a href={targets.telegram} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300">
          Telegram
        </a>
        <a href={targets.email} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300">
          {copy.shareEmail}
        </a>
      </div>
    </section>
  );
}
