import { useEffect } from "react";
import { t, type Language } from "../lib/i18n";
import { useDesignStore } from "../store/design-store";

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "fr", label: "Français" },
];

export function LanguageSelector() {
  const language = useDesignStore((state) => state.language);
  const setLanguage = useDesignStore((state) => state.setLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const label = t(language, "common.language");
  return <label className="language-select">
    <span className="sr-only">{label}</span>
    <select aria-label={label} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
      {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
