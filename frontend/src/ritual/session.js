const SESSION_KEY = "soulmap.ritual";

export function saveRitual(payload) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function loadRitual() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.result?.matches?.length || !parsed.result.anima_card) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearRitual() {
  sessionStorage.removeItem(SESSION_KEY);
}
