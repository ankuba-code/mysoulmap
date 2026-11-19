const SESSION_KEY = "soulmap.ritual";
const LANGUAGE_KEY = "soulmap.language";
const LANGUAGES = new Set(["de", "en", "es", "ru"]);

export const LANGUAGE_LABEL = {
  de: "Sprache",
  en: "Language",
  es: "Idioma",
  ru: "Язык",
};

export function loadLanguage() {
  const value = sessionStorage.getItem(LANGUAGE_KEY);
  return LANGUAGES.has(value) ? value : null;
}

export function saveLanguage(language) {
  if (LANGUAGES.has(language)) {
    sessionStorage.setItem(LANGUAGE_KEY, language);
  }
}

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
