import en from "../../../i18n/en.json";
import fr from "../../../i18n/fr.json";
import ja from "../../../i18n/ja.json";
import zh from "../../../i18n/zh.json";

export type Language = "en" | "fr" | "ja" | "zh";
const dictionaries: Record<Language, Record<string, string>> = { en, fr, ja, zh };
const locales: Record<Language, string> = { en: "en-GB", fr: "fr-FR", ja: "ja-JP", zh: "zh-CN" };

export function t(language: Language, key: string): string {
  const value = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  if (!dictionaries[language][key] && import.meta.env.DEV) console.warn(`Missing ${language} translation: ${key}`);
  return value;
}
export function localeFor(language: Language): string { return locales[language]; }
export function numberFor(language: Language, value: number, maximumFractionDigits = 0): string { return new Intl.NumberFormat(localeFor(language), { maximumFractionDigits }).format(value); }
export function currencyFor(language: Language, currency: string, value: number): string { return new Intl.NumberFormat(localeFor(language), { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 0 }).format(value); }
