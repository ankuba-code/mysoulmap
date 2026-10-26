export default function ExportBar({ onPng, onPdf, copy, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onPng}
        disabled={disabled}
        className="rounded-lg bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-stone-300 disabled:cursor-not-allowed disabled:text-stone-400"
      >
        {copy.exportPng}
      </button>
      <button
        type="button"
        onClick={onPdf}
        disabled={disabled}
        className="rounded-lg bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-stone-300 disabled:cursor-not-allowed disabled:text-stone-400"
      >
        {copy.exportPdf}
      </button>
    </div>
  );
}
