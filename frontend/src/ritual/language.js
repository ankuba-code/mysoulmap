import { useEffect, useRef } from "react";
import { loadLanguage } from "./session";

const UI_LANGUAGES = new Set(["de", "en", "es", "ru"]);

export async function detectLanguage() {
  try {
    const response = await fetch("/api/language");
    if (!response.ok) return null;
    const data = await response.json();
    if (UI_LANGUAGES.has(data?.language)) return data.language;
    return "de";
  } catch {
    return null;
  }
}

export function useSystemLanguage(onLanguage, enabled = true) {
  const onLanguageRef = useRef(onLanguage);
  onLanguageRef.current = onLanguage;

  useEffect(() => {
    if (!enabled || loadLanguage()) return undefined;
    let active = true;
    detectLanguage().then((next) => {
      if (!active || !next || loadLanguage()) return;
      onLanguageRef.current?.(next);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
}
