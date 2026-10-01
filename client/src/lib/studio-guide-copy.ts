type Language = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

export type StudioGuideCopy = {
  steps: [string, string, string, string];
  building: { detected: (summary: string) => string; manual: string };
  products: { done: (count: number) => string; todo: string };
  finishes: string;
  energy: string;
  optional: string;
  tutorial: string;
  detectedBanner: string;
  tour: {
    next: string;
    back: string;
    done: string;
    skip: string;
    counter: (step: number, total: number) => string;
    items: { title: string; body: string }[];
  };
};

export const STUDIO_GUIDE_COPY: Record<Language, StudioGuideCopy> = {
  en: {
    steps: ["Building", "Solar products", "Finishes", "Energy & returns"],
    building: { detected: (summary) => `From the map · ${summary}`, manual: "Confirm the building type and size" },
    products: { done: (count) => `${count} solar surface${count === 1 ? "" : "s"} configured`, todo: "Choose roof or facade products" },
    finishes: "Walls, windows and lighting",
    energy: "Household use, generation and payback",
    optional: "Optional",
    tutorial: "Guide",
    detectedBanner: "Building type, size, roof and orientation were filled in from the map. Change anything below if it doesn't match.",
    tour: {
      next: "Next", back: "Back", done: "Start designing", skip: "Skip guide", counter: (step, total) => `${step} / ${total}`,
      items: [
        { title: "Four steps, in order", body: "Work left to right. Each step opens the matching panel in the Studio; a tick means it is done." },
        { title: "1 · Building is already filled in", body: "When the map found the building, its type, size, roof and orientation are applied for you. Open it only to correct values." },
        { title: "2 · Choose the solar products", body: "Tick solar roof tiles, roof panels or facade panels. The 3D model updates as you go; this is the only step you must do." },
        { title: "3D preview", body: "Drag to orbit, scroll or pinch to zoom. Finishes and lighting are optional and only change the look." },
        { title: "4 · Energy & returns", body: "When the design looks right, continue to enter household use and calculate generation, self-use and payback." },
      ],
    },
  },
  zh: {
    steps: ["建筑", "光伏产品", "外观", "能耗与收益"],
    building: { detected: (summary) => `地图识别 · ${summary}`, manual: "确认房型与尺寸" },
    products: { done: (count) => `已配置 ${count} 个光伏面`, todo: "选择屋顶或立面光伏产品" },
    finishes: "墙面、门窗与光照",
    energy: "填写用电，计算发电与回本",
    optional: "可选",
    tutorial: "使用教程",
    detectedBanner: "房型、尺寸、屋顶和朝向已根据地图自动填好；如有不符，直接在下方修改即可。",
    tour: {
      next: "下一步", back: "上一步", done: "开始设计", skip: "跳过教程", counter: (step, total) => `${step} / ${total}`,
      items: [
        { title: "按顺序完成四步", body: "从左到右操作即可。点每一步会打开工作室里对应的面板，完成后会打勾。" },
        { title: "第 1 步 · 建筑已自动填好", body: "如果地图识别到了建筑，房型、尺寸、屋顶和朝向都已帮你填好，只有不对时才需要打开修改。" },
        { title: "第 2 步 · 选择光伏产品", body: "勾选光伏瓦、屋面板或立面板，三维模型会实时更新。这是唯一必须由你完成的一步。" },
        { title: "三维预览", body: "拖动旋转，滚轮或双指缩放。外观与光照是可选项，只影响效果展示。" },
        { title: "第 4 步 · 能耗与收益", body: "设计满意后进入下一步，填写家庭用电情况，计算发电量、自用率和回本周期。" },
      ],
    },
  },
  "zh-Hant": {
    steps: ["建築", "光伏產品", "外觀", "能耗與收益"],
    building: { detected: (summary) => `地圖識別 · ${summary}`, manual: "確認房型與尺寸" },
    products: { done: (count) => `已配置 ${count} 個光伏面`, todo: "選擇屋頂或立面光伏產品" },
    finishes: "牆面、門窗與光照",
    energy: "填寫用電，計算發電與回本",
    optional: "可選",
    tutorial: "使用教學",
    detectedBanner: "房型、尺寸、屋頂和朝向已根據地圖自動填好；如有不符，直接在下方修改即可。",
    tour: {
      next: "下一步", back: "上一步", done: "開始設計", skip: "跳過教學", counter: (step, total) => `${step} / ${total}`,
      items: [
        { title: "按順序完成四步", body: "從左到右操作即可。點每一步會開啟工作室裡對應的面板，完成後會打勾。" },
        { title: "第 1 步 · 建築已自動填好", body: "如果地圖識別到了建築，房型、尺寸、屋頂和朝向都已幫你填好，只有不對時才需要開啟修改。" },
        { title: "第 2 步 · 選擇光伏產品", body: "勾選光伏瓦、屋面板或立面板，三維模型會即時更新。這是唯一必須由你完成的一步。" },
        { title: "三維預覽", body: "拖曳旋轉，滾輪或雙指縮放。外觀與光照是可選項，只影響效果展示。" },
        { title: "第 4 步 · 能耗與收益", body: "設計滿意後進入下一步，填寫家庭用電情況，計算發電量、自用率和回本週期。" },
      ],
    },
  },
  fr: {
    steps: ["Bâtiment", "Produits solaires", "Finitions", "Énergie et rentabilité"],
    building: { detected: (summary) => `D’après la carte · ${summary}`, manual: "Confirmez le type et les dimensions" },
    products: { done: (count) => `${count} surface${count === 1 ? "" : "s"} solaire${count === 1 ? "" : "s"} configurée${count === 1 ? "" : "s"}`, todo: "Choisissez les produits toiture ou façade" },
    finishes: "Murs, menuiseries et lumière",
    energy: "Consommation, production et retour sur investissement",
    optional: "Facultatif",
    tutorial: "Guide",
    detectedBanner: "Type, dimensions, toiture et orientation ont été remplis d’après la carte. Modifiez ci-dessous si quelque chose ne correspond pas.",
    tour: {
      next: "Suivant", back: "Retour", done: "Commencer", skip: "Passer le guide", counter: (step, total) => `${step} / ${total}`,
      items: [
        { title: "Quatre étapes, dans l’ordre", body: "Avancez de gauche à droite. Chaque étape ouvre le panneau correspondant du Studio ; une coche indique qu’elle est faite." },
        { title: "1 · Le bâtiment est déjà renseigné", body: "Si la carte a trouvé le bâtiment, type, dimensions, toiture et orientation sont appliqués. Ouvrez-le seulement pour corriger." },
        { title: "2 · Choisissez les produits solaires", body: "Cochez tuiles solaires, panneaux de toiture ou de façade. La 3D se met à jour ; c’est la seule étape obligatoire." },
        { title: "Aperçu 3D", body: "Faites glisser pour tourner, molette ou pincement pour zoomer. Finitions et lumière sont facultatives." },
        { title: "4 · Énergie et rentabilité", body: "Quand le projet vous convient, continuez pour saisir la consommation et calculer production, autoconsommation et retour." },
      ],
    },
  },
  ja: {
    steps: ["建物", "太陽光製品", "外観", "エネルギーと収益"],
    building: { detected: (summary) => `地図から取得 · ${summary}`, manual: "建物タイプと寸法を確認" },
    products: { done: (count) => `太陽光面 ${count} 面を設定済み`, todo: "屋根または外壁の製品を選択" },
    finishes: "外壁・窓・光",
    energy: "電力使用量、発電量、回収期間",
    optional: "任意",
    tutorial: "使い方",
    detectedBanner: "建物タイプ・寸法・屋根・向きは地図から自動入力されています。違う場合は下で修正してください。",
    tour: {
      next: "次へ", back: "戻る", done: "設計を始める", skip: "ガイドを閉じる", counter: (step, total) => `${step} / ${total}`,
      items: [
        { title: "4 つのステップを順番に", body: "左から右へ進めます。各ステップを押すとスタジオの該当パネルが開き、完了するとチェックが付きます。" },
        { title: "1 · 建物は自動入力済み", body: "地図で建物が見つかった場合、タイプ・寸法・屋根・向きは適用済みです。修正が必要なときだけ開いてください。" },
        { title: "2 · 太陽光製品を選ぶ", body: "ソーラー瓦・屋根パネル・外壁パネルを選ぶと 3D がすぐ更新されます。必須なのはこのステップだけです。" },
        { title: "3D プレビュー", body: "ドラッグで回転、スクロールやピンチでズーム。外観と光は任意で、見た目だけが変わります。" },
        { title: "4 · エネルギーと収益", body: "デザインが決まったら次へ進み、電力使用量を入力して発電量・自家消費率・回収期間を計算します。" },
      ],
    },
  },
  es: {
    steps: ["Edificio", "Productos solares", "Acabados", "Energía y rentabilidad"],
    building: { detected: (summary) => `Según el mapa · ${summary}`, manual: "Confirma el tipo y las medidas" },
    products: { done: (count) => `${count} superficie${count === 1 ? "" : "s"} solar${count === 1 ? "" : "es"} configurada${count === 1 ? "" : "s"}`, todo: "Elige productos de cubierta o fachada" },
    finishes: "Muros, carpinterías e iluminación",
    energy: "Consumo, producción y amortización",
    optional: "Opcional",
    tutorial: "Guía",
    detectedBanner: "El tipo, las medidas, la cubierta y la orientación se han rellenado con el mapa. Cambia abajo lo que no encaje.",
    tour: {
      next: "Siguiente", back: "Atrás", done: "Empezar a diseñar", skip: "Saltar guía", counter: (step, total) => `${step} / ${total}`,
      items: [
        { title: "Cuatro pasos, en orden", body: "Avanza de izquierda a derecha. Cada paso abre su panel en el Studio; una marca indica que está hecho." },
        { title: "1 · El edificio ya está rellenado", body: "Si el mapa encontró el edificio, se aplican tipo, medidas, cubierta y orientación. Ábrelo solo para corregir." },
        { title: "2 · Elige los productos solares", body: "Marca tejas solares, paneles de cubierta o de fachada. El 3D se actualiza al momento; es el único paso obligatorio." },
        { title: "Vista 3D", body: "Arrastra para girar; rueda o pellizco para acercar. Acabados e iluminación son opcionales." },
        { title: "4 · Energía y rentabilidad", body: "Cuando el diseño te convenza, continúa para indicar el consumo y calcular producción, autoconsumo y amortización." },
      ],
    },
  },
  it: {
    steps: ["Edificio", "Prodotti solari", "Finiture", "Energia e ritorno"],
    building: { detected: (summary) => `Dalla mappa · ${summary}`, manual: "Conferma tipo e misure" },
    products: { done: (count) => `${count} superfic${count === 1 ? "ie" : "i"} solar${count === 1 ? "e" : "i"} configurat${count === 1 ? "a" : "e"}`, todo: "Scegli prodotti per tetto o facciata" },
    finishes: "Pareti, serramenti e luce",
    energy: "Consumi, produzione e rientro",
    optional: "Facoltativo",
    tutorial: "Guida",
    detectedBanner: "Tipo, misure, copertura e orientamento sono stati compilati dalla mappa. Modifica qui sotto ciò che non corrisponde.",
    tour: {
      next: "Avanti", back: "Indietro", done: "Inizia a progettare", skip: "Salta la guida", counter: (step, total) => `${step} / ${total}`,
      items: [
        { title: "Quattro passi, in ordine", body: "Procedi da sinistra a destra. Ogni passo apre il pannello corrispondente dello Studio; la spunta indica che è completato." },
        { title: "1 · L’edificio è già compilato", body: "Se la mappa ha trovato l’edificio, tipo, misure, copertura e orientamento sono già applicati. Aprilo solo per correggere." },
        { title: "2 · Scegli i prodotti solari", body: "Seleziona tegole solari, pannelli da tetto o da facciata. Il 3D si aggiorna subito; è l’unico passo obbligatorio." },
        { title: "Anteprima 3D", body: "Trascina per ruotare, rotella o pizzico per lo zoom. Finiture e luce sono facoltative." },
        { title: "4 · Energia e ritorno", body: "Quando il progetto ti convince, prosegui per inserire i consumi e calcolare produzione, autoconsumo e rientro." },
      ],
    },
  },
};
