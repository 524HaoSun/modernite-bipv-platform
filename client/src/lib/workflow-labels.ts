export type WorkflowLanguage = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

export const WORKFLOW_LABELS: Record<WorkflowLanguage, { project: string; market: string; location: string; studio: string; energy: string; calculation: string; results: string }> = {
  en: { project: "Project", market: "Market", location: "Site", studio: "Design Studio", energy: "Energy", calculation: "Calculation", results: "Results" },
  zh: { project: "项目", market: "市场", location: "场地", studio: "设计工作室", energy: "能耗", calculation: "计算", results: "结果" },
  "zh-Hant": { project: "專案", market: "市場", location: "場地", studio: "設計工作室", energy: "能耗", calculation: "計算", results: "結果" },
  fr: { project: "Projet", market: "Marché", location: "Site", studio: "Studio de conception", energy: "Énergie", calculation: "Calcul", results: "Résultats" },
  ja: { project: "プロジェクト", market: "市場", location: "敷地", studio: "デザインスタジオ", energy: "エネルギー", calculation: "計算", results: "結果" },
  es: { project: "Proyecto", market: "Mercado", location: "Sitio", studio: "Estudio de diseño", energy: "Energía", calculation: "Cálculo", results: "Resultados" },
  it: { project: "Progetto", market: "Mercato", location: "Sito", studio: "Studio di progettazione", energy: "Energia", calculation: "Calcolo", results: "Risultati" },
};
