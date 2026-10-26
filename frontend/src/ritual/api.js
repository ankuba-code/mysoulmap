export async function postMatch(payload) {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "Die Auswertung ist fehlgeschlagen.";
    throw new Error(message);
  }
  return data;
}
