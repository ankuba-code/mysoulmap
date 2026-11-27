export async function postFeedback(payload) {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Das Feedback konnte nicht gesendet werden.");
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

export async function postChat(payload) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || "Die Anfrage ist fehlgeschlagen.";
    const error = new Error(message);
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}
