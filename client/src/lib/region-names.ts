const EUROPE: Record<string, string> = { en: "Europe", zh: "欧洲", "zh-Hant": "歐洲", fr: "Europe", ja: "ヨーロッパ", es: "Europa", it: "Europa" };
const ALIASES: Record<string, string> = { UK: "GB", EL: "GR" };
const cache = new Map<string, Intl.DisplayNames | null>();

function displayNames(language: string) {
  if (!cache.has(language)) {
    try {
      cache.set(language, new Intl.DisplayNames([language, "en"], { type: "region" }));
    } catch {
      cache.set(language, null);
    }
  }
  return cache.get(language) ?? null;
}

export function europeName(language: string) {
  return EUROPE[language] ?? EUROPE.en;
}

/** Localised name for a market or ISO 3166 country code; `fallback` is the stored English name. */
export function regionName(code: string, language: string, fallback: string) {
  if (code === "EU") return europeName(language);
  const iso = ALIASES[code] ?? code;
  if (!/^[A-Z]{2}$/.test(iso)) return fallback;
  const name = displayNames(language)?.of(iso);
  return name && name !== iso ? name : fallback;
}
