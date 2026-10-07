type Language = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

export type ShareCopy = {
  pdf: string;
  pdfBusy: string;
  pdfFailed: string;
  link: string;
  linkBusy: string;
  copied: string;
  linkFailed: string;
  studioReport: string;
  googleLayout: string;
  googleLayoutValue: (panels: number, kwp: string) => string;
  googleYearly: string;
  crossCheck: (ours: string, google: string) => string;
  sharedBanner: string;
  continueHere: string;
  loading: string;
  missing: string;
  backHome: string;
};

export const SHARE_COPY: Record<Language, ShareCopy> = {
  en: {
    pdf: "Download report PDF", pdfBusy: "Preparing PDF…", pdfFailed: "The PDF could not be generated. Please try again.",
    link: "Copy share link", linkBusy: "Creating link…", copied: "Link copied", linkFailed: "The link could not be created. Please try again.",
    studioReport: "Studio engineering report",
    googleLayout: "External benchmark capacity", googleLayoutValue: (_p, k) => `${k} kWp traditional PV reference`, googleYearly: "External benchmark annual yield (DC)",
    crossCheck: (ours, google) => `Specific yield cross-check: this study ${ours} kWh/kWp · external benchmark ${google} kWh/kWp (DC, before system losses).`,
    sharedBanner: "Shared project · read-only view", continueHere: "Continue with this project", loading: "Opening shared project…", missing: "This shared project could not be found.", backHome: "Start a new project",
  },
  zh: {
    pdf: "下载报告 PDF", pdfBusy: "正在生成 PDF…", pdfFailed: "PDF 生成失败，请稍后再试。",
    link: "复制分享链接", linkBusy: "正在创建链接…", copied: "链接已复制", linkFailed: "链接创建失败，请稍后再试。",
    studioReport: "工作室工程报告",
    googleLayout: "外部基准容量", googleLayoutValue: (_p, k) => `${k} kWp 传统光伏参考`, googleYearly: "外部基准年发电估算（直流）",
    crossCheck: (ours, google) => `单位发电量交叉校验：本研究 ${ours} kWh/kWp · 外部基准 ${google} kWh/kWp（直流，未计系统损耗）。`,
    sharedBanner: "分享的项目 · 只读视图", continueHere: "在此项目基础上继续", loading: "正在打开分享的项目…", missing: "找不到这个分享的项目。", backHome: "开始新项目",
  },
  "zh-Hant": {
    pdf: "下載報告 PDF", pdfBusy: "正在產生 PDF…", pdfFailed: "PDF 產生失敗，請稍後再試。",
    link: "複製分享連結", linkBusy: "正在建立連結…", copied: "連結已複製", linkFailed: "連結建立失敗，請稍後再試。",
    studioReport: "工作室工程報告",
    googleLayout: "外部基準容量", googleLayoutValue: (_p, k) => `${k} kWp 傳統光電參考`, googleYearly: "外部基準年發電估算（直流）",
    crossCheck: (ours, google) => `單位發電量交叉校驗：本研究 ${ours} kWh/kWp · 外部基準 ${google} kWh/kWp（直流，未計系統損耗）。`,
    sharedBanner: "分享的專案 · 唯讀檢視", continueHere: "在此專案基礎上繼續", loading: "正在開啟分享的專案…", missing: "找不到這個分享的專案。", backHome: "開始新專案",
  },
  fr: {
    pdf: "Télécharger le rapport PDF", pdfBusy: "Préparation du PDF…", pdfFailed: "Le PDF n’a pas pu être généré. Réessayez.",
    link: "Copier le lien de partage", linkBusy: "Création du lien…", copied: "Lien copié", linkFailed: "Le lien n’a pas pu être créé. Réessayez.",
    studioReport: "Rapport technique du Studio",
    googleLayout: "Puissance de référence externe", googleLayoutValue: (_p, k) => `${k} kWc PV traditionnel`, googleYearly: "Productible annuel de référence externe (CC)",
    crossCheck: (ours, google) => `Contrôle du productible : cette étude ${ours} kWh/kWc · référence externe ${google} kWh/kWc (CC, avant pertes système).`,
    sharedBanner: "Projet partagé · lecture seule", continueHere: "Continuer avec ce projet", loading: "Ouverture du projet partagé…", missing: "Ce projet partagé est introuvable.", backHome: "Nouveau projet",
  },
  ja: {
    pdf: "レポート PDF をダウンロード", pdfBusy: "PDF を作成中…", pdfFailed: "PDF を作成できませんでした。もう一度お試しください。",
    link: "共有リンクをコピー", linkBusy: "リンクを作成中…", copied: "リンクをコピーしました", linkFailed: "リンクを作成できませんでした。もう一度お試しください。",
    studioReport: "スタジオ技術レポート",
    googleLayout: "外部基準容量", googleLayoutValue: (_p, k) => `${k} kWp 従来型PV参考`, googleYearly: "外部基準の年間発電推定（直流）",
    crossCheck: (ours, google) => `発電量の照合：本試算 ${ours} kWh/kWp · 外部基準 ${google} kWh/kWp（直流、システム損失前）。`,
    sharedBanner: "共有プロジェクト · 閲覧専用", continueHere: "このプロジェクトで続ける", loading: "共有プロジェクトを開いています…", missing: "この共有プロジェクトは見つかりません。", backHome: "新しいプロジェクト",
  },
  es: {
    pdf: "Descargar informe PDF", pdfBusy: "Preparando PDF…", pdfFailed: "No se pudo generar el PDF. Inténtalo de nuevo.",
    link: "Copiar enlace para compartir", linkBusy: "Creando enlace…", copied: "Enlace copiado", linkFailed: "No se pudo crear el enlace. Inténtalo de nuevo.",
    studioReport: "Informe técnico del Estudio",
    googleLayout: "Capacidad de referencia externa", googleLayoutValue: (_p, k) => `${k} kWp FV tradicional`, googleYearly: "Generación anual de referencia externa (CC)",
    crossCheck: (ours, google) => `Contraste de producción específica: este estudio ${ours} kWh/kWp · referencia externa ${google} kWh/kWp (CC, antes de pérdidas).`,
    sharedBanner: "Proyecto compartido · solo lectura", continueHere: "Continuar con este proyecto", loading: "Abriendo proyecto compartido…", missing: "No se encontró este proyecto compartido.", backHome: "Nuevo proyecto",
  },
  it: {
    pdf: "Scarica il report PDF", pdfBusy: "Preparazione PDF…", pdfFailed: "Impossibile generare il PDF. Riprova.",
    link: "Copia link di condivisione", linkBusy: "Creazione link…", copied: "Link copiato", linkFailed: "Impossibile creare il link. Riprova.",
    studioReport: "Report tecnico dello Studio",
    googleLayout: "Potenza benchmark esterno", googleLayoutValue: (_p, k) => `${k} kWp FV tradizionale`, googleYearly: "Produzione annua benchmark esterno (CC)",
    crossCheck: (ours, google) => `Verifica della producibilità: questo studio ${ours} kWh/kWp · benchmark esterno ${google} kWh/kWp (CC, prima delle perdite).`,
    sharedBanner: "Progetto condiviso · sola lettura", continueHere: "Continua con questo progetto", loading: "Apertura progetto condiviso…", missing: "Progetto condiviso non trovato.", backHome: "Nuovo progetto",
  },
};

export const shareCopy = (language: string) => SHARE_COPY[language as Language] ?? SHARE_COPY.en;
