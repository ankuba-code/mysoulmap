import { describe, expect, it } from "vitest";
import { legalCopy, pageText } from "./copy";

describe("privacy copy", () => {
  it("describes the shortened prompt retention in every language", () => {
    const phrases = {
      de: /500 Zeichen/,
      en: /500 characters/,
      es: /500 caracteres/,
      ru: /500 знаков/,
    };
    for (const [language, pattern] of Object.entries(phrases)) {
      const text = pageText(legalCopy(language).privacy);
      expect(text).toMatch(pattern);
      expect(text).toMatch(/OpenAI/);
      expect(text).not.toMatch(/speichert keine Konversation|does not store the conversation|no guarda la conversación|не хранит переписку/);
    }
  });
});