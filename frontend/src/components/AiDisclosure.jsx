export default function AiDisclosure({ text }) {
  return (
    <p
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"
    >
      {text}
    </p>
  );
}
