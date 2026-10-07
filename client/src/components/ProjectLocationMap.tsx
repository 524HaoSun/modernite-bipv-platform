import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Eye, EyeOff, Loader2, Sun, MapPin, MousePointerClick, Navigation, Pencil, Ruler, ScanSearch, Search, Undo2 } from "lucide-react";
import { googleGeocodeAll, googleTileSession, googleTileUrl, googleViewportInfo, type GeocodeMatch } from "@/lib/google-maps";
import { trpc } from "@/lib/trpc";

export type MarketKey = "GB" | "EU" | "CA" | "JP";

export type Market = {
  key: MarketKey;
  name: string;
  shortName: string;
  coordinates: google.maps.LatLngLiteral;
  zoom: number;
  referenceLabel?: string;
};

export type ProjectLocationSelection = {
  label: string;
  coordinates: google.maps.LatLngLiteral;
};

export type SiteAreaSelection = {
  areaM2: number;
  path: google.maps.LatLngLiteral[];
  /** "detected" = building outline from map data (possibly fine-tuned); "traced" = drawn by the user. */
  source?: "detected" | "traced";
};

export type SiteDetection = {
  state: "idle" | "loading" | "found" | "missing" | "error";
  onDetect: () => void;
  onUseDetected?: () => void;
};

/** A mapped building near the searched address that the user can pick by tapping it. */
export type MapBuildingCandidate = { id: number; path: google.maps.LatLngLiteral[]; center: google.maps.LatLngLiteral; areaM2: number; label?: string };

export type BuildingPicker = {
  loading: boolean;
  candidates: MapBuildingCandidate[];
  selectedId: number | null;
  onPick: (candidate: MapBuildingCandidate) => void;
};

/** Google Solar annual-flux overlay, fetched only when the user turns it on. */
export type SunHeatmap = {
  state: "idle" | "loading" | "ready" | "none";
  visible: boolean;
  data?: { dataUrl: string; corners: { nw: google.maps.LatLngLiteral; ne: google.maps.LatLngLiteral; sw: google.maps.LatLngLiteral }; minKwhPerKw: number; maxKwhPerKw: number; imageryDate?: string };
  onToggle: () => void;
};

type GatewayLanguage = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";
type LatLng = google.maps.LatLngLiteral;
type Point = { x: number; y: number };
type Segment = { left: number; top: number; width: number; angle: number };
type MapMode = "aerial" | "road";
type DragState =
  | { type: "pan"; pointerId: number; startX: number; startY: number; startCenter: Point; moved: boolean }
  | { type: "vertex"; pointerId: number; index: number }
  | { type: "pinch"; startDistance: number; startZoom: number; anchor: LatLng };

type MapText = {
  ready: string;
  locating: string;
  unavailable: string;
  selected: string;
  drawStart: string;
  needVertices: string;
  drawCleared: string;
  vertexPlaced: (count: number) => string;
  outlined: (area: string, count: number) => string;
  aerial: string;
  road: string;
  siteArea: string;
  drawZone: string;
  trace: string;
  finish: string;
  undo: string;
  clear: string;
  traceHelp: string;
  drawCue: string;
  closeCue: string;
  outlinedArea: string;
  points: string;
  openData: string;
  editHint: string;
  streetView: string;
  googleLater: string;
  mapLayers: string;
  zoomControls: string;
  centerSelected: string;
  movePoint: (index: number) => string;
  draftPoint: (index: number) => string;
  closeOutlineAtFirst: string;
  zoomIn: string;
  zoomOut: string;
  detailView: string;
  detect: string;
  detecting: string;
  detectHint: string;
  detectMissing: string;
  detectError: string;
  detectedHint: string;
  tracedHint: string;
  manualTrace: string;
  redraw: string;
  useDetected: string;
  detectedArea: string;
  retry: string;
  findingBuildings: string;
  pickHint: (count: number) => string;
  pickOther: string;
  detectAtPin: string;
  changeAddress: string;
  sunLayer: string;
  sunLoading: string;
  sunNone: string;
  sunLegend: string;
};

const EN_TEXT: MapText = {
  ready: "Map ready. Search an address, place a pin, or trace a solar-ready area.",
  locating: "Searching for the address…",
  unavailable: "Location unavailable. Try a complete address or postcode.",
  selected: "Project site selected.",
  drawStart: "Use the pencil cursor to place numbered corners. Return to point 1 after point 3 to close the outline.",
  needVertices: "Place at least three vertices before closing the site outline.",
  drawCleared: "Site outline cleared. Trace another area when ready.",
  vertexPlaced: (count) => `Point ${count} placed. Add another corner, or return to point 1 to close the boundary.`,
  outlined: (area, count) => `Outlined site area: ${area} across ${count} vertices. Drag a numbered point to refine it.`,
  aerial: "Aerial",
  road: "Road",
  siteArea: "Site outline",
  drawZone: "Pencil-trace a boundary, then close it",
  trace: "Trace area",
  finish: "Close outline",
  undo: "Undo point",
  clear: "Clear",
  traceHelp: "Click around a roof, facade, or open plot. After point 3, click point 1 to close the shape.",
  drawCue: "Click to add corners",
  closeCue: "Point 1 is ready - click to close",
  outlinedArea: "Outlined solar area",
  points: "points",
  openData: "Aerial map with address search",
  editHint: "Drag any numbered point to refine the boundary",
  streetView: "Google Street View",
  googleLater: "Street View and photorealistic 3D of this address.",
  mapLayers: "Map layers",
  zoomControls: "Map zoom",
  centerSelected: "Center on selected site",
  movePoint: (index) => `Move point ${index}`,
  draftPoint: (index) => `Draft point ${index}`,
  closeOutlineAtFirst: "Close outline at point 1",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  detailView: "Close-up view",
  detect: "Detect building outline",
  detecting: "Reading the building outline…",
  detectHint: "Put the pin on the building, then detect its outline automatically.",
  detectMissing: "No outline found for this building. Trace it by hand.",
  detectError: "Building data is unavailable right now. Trace the outline by hand or retry.",
  detectedHint: "From building detection · drag corners to fine-tune",
  tracedHint: "Traced by hand · drag corners to fine-tune",
  manualTrace: "Trace manually",
  redraw: "Redraw",
  useDetected: "Use detected outline",
  detectedArea: "Detected building outline",
  retry: "Retry",
  findingBuildings: "Finding the buildings at this address…",
  pickHint: (count) => `Tap your building on the map (${count} nearby).`,
  pickOther: "Tap another outline to switch building",
  detectAtPin: "Detect at pin",
  changeAddress: "Change address",
  sunLayer: "Roof sun",
  sunLoading: "Loading roof sun map…",
  sunNone: "No roof sun data for this site",
  sunLegend: "kWh per kWp per year",
};

const ZH_TEXT: MapText = {
  ready: "地图已就绪。可以搜索地址、放置定位点或勾画光伏区域。",
  locating: "正在搜索地址…",
  unavailable: "无法定位，请尝试完整地址或邮编。",
  selected: "已选择项目场地。",
  drawStart: "使用铅笔光标放置编号顶点。放置第 3 个点后，回到第 1 个点即可闭合边界。",
  needVertices: "请至少放置三个顶点后再完成边界。",
  drawCleared: "已清除场地边界，可重新勾画。",
  vertexPlaced: (count) => `已放置第 ${count} 个点。继续添加顶点，或回到第 1 个点闭合边界。`,
  outlined: (area, count) => `已勾画场地面积：${area}，共 ${count} 个顶点。可拖动编号顶点进行微调。`,
  aerial: "航拍",
  road: "道路",
  siteArea: "场地范围",
  drawZone: "用铅笔勾画边界并闭合",
  trace: "勾画区域",
  finish: "闭合边界",
  undo: "撤销顶点",
  clear: "清除",
  traceHelp: "在屋顶、立面或空地周围依次点击。放置第 3 个点后，点击第 1 个点即可闭合。",
  drawCue: "点击添加顶点",
  closeCue: "第 1 点已高亮，点击即可闭合",
  outlinedArea: "已勾画光伏区域",
  points: "个顶点",
  openData: "航拍地图与地址搜索",
  editHint: "拖动任意编号顶点即可微调边界",
  streetView: "Google 街景",
  googleLater: "查看该地址的街景与写实三维。",
  mapLayers: "地图图层",
  zoomControls: "地图缩放",
  centerSelected: "回到已选场地",
  movePoint: (index) => `移动第 ${index} 个点`,
  draftPoint: (index) => `草稿第 ${index} 个点`,
  closeOutlineAtFirst: "点击第 1 点闭合边界",
  zoomIn: "放大",
  zoomOut: "缩小",
  detailView: "拉近查看",
  detect: "识别建筑轮廓",
  detecting: "正在识别建筑轮廓…",
  detectHint: "把图钉放到建筑上，再自动识别建筑轮廓。",
  detectMissing: "没找到这栋建筑的轮廓，请手动勾画。",
  detectError: "暂时无法获取建筑数据，可手动勾画或重试。",
  detectedHint: "来自建筑识别 · 拖动顶点即可微调",
  tracedHint: "手动勾画 · 拖动顶点即可微调",
  manualTrace: "手动勾画",
  redraw: "重新勾画",
  useDetected: "改用识别轮廓",
  detectedArea: "识别的建筑轮廓",
  retry: "重试",
  findingBuildings: "正在查找这个地址附近的建筑…",
  pickHint: (count) => `在地图上点选你的建筑（附近共 ${count} 栋）。`,
  pickOther: "点其他轮廓可切换建筑",
  detectAtPin: "识别图钉处",
  changeAddress: "更换地址",
  sunLayer: "屋顶日照",
  sunLoading: "正在加载屋顶日照…",
  sunNone: "此处暂无屋顶日照数据",
  sunLegend: "每 kWp 年发电 kWh",
};

const ZH_HANT_TEXT: MapText = {
  ready: "地圖已就緒。可以搜尋地址、放置定位點或勾畫光電區域。",
  locating: "正在搜尋地址…",
  unavailable: "無法定位，請嘗試完整地址或郵遞區號。",
  selected: "已選擇專案場地。",
  drawStart: "使用鉛筆游標放置編號頂點。放置第 3 個點後，回到第 1 個點即可閉合邊界。",
  needVertices: "請至少放置三個頂點後再完成邊界。",
  drawCleared: "已清除場地邊界，可重新勾畫。",
  vertexPlaced: (count) => `已放置第 ${count} 個點。繼續新增頂點，或回到第 1 個點閉合邊界。`,
  outlined: (area, count) => `已勾畫場地面積：${area}，共 ${count} 個頂點。可拖曳編號頂點進行微調。`,
  aerial: "空拍",
  road: "道路",
  siteArea: "場地範圍",
  drawZone: "用鉛筆勾畫邊界並閉合",
  trace: "勾畫區域",
  finish: "閉合邊界",
  undo: "復原頂點",
  clear: "清除",
  traceHelp: "在屋頂、立面或空地周圍依次點擊。放置第 3 個點後，點擊第 1 個點即可閉合。",
  drawCue: "點擊新增頂點",
  closeCue: "第 1 點已醒目提示，點擊即可閉合",
  outlinedArea: "已勾畫光電區域",
  points: "個頂點",
  openData: "空拍地圖與地址搜尋",
  editHint: "拖曳任一編號頂點即可微調邊界",
  streetView: "Google 街景",
  googleLater: "查看此地址的街景與寫實三維。",
  mapLayers: "地圖圖層",
  zoomControls: "地圖縮放",
  centerSelected: "回到已選場地",
  movePoint: (index) => `移動第 ${index} 個點`,
  draftPoint: (index) => `草稿第 ${index} 個點`,
  closeOutlineAtFirst: "點擊第 1 點閉合邊界",
  zoomIn: "放大",
  zoomOut: "縮小",
  detailView: "拉近查看",
  detect: "識別建築輪廓",
  detecting: "正在識別建築輪廓…",
  detectHint: "把圖釘放到建築上，再自動識別建築輪廓。",
  detectMissing: "找不到這棟建築的輪廓，請手動勾畫。",
  detectError: "暫時無法取得建築資料，可手動勾畫或重試。",
  detectedHint: "來自建築識別 · 拖曳頂點即可微調",
  tracedHint: "手動勾畫 · 拖曳頂點即可微調",
  manualTrace: "手動勾畫",
  redraw: "重新勾畫",
  useDetected: "改用識別輪廓",
  detectedArea: "識別的建築輪廓",
  retry: "重試",
  findingBuildings: "正在查找此地址附近的建築…",
  pickHint: (count) => `在地圖上點選你的建築（附近共 ${count} 棟）。`,
  pickOther: "點其他輪廓可切換建築",
  detectAtPin: "識別圖釘處",
  changeAddress: "更換地址",
  sunLayer: "屋頂日照",
  sunLoading: "正在載入屋頂日照…",
  sunNone: "此處暫無屋頂日照資料",
  sunLegend: "每 kWp 年發電 kWh",
};

const FR_TEXT: MapText = {
  ready: "Carte prête. Recherchez une adresse, placez un repère ou tracez une zone solaire.",
  locating: "Recherche de l’adresse…",
  unavailable: "Localisation impossible. Essayez une adresse complète ou un code postal.",
  selected: "Site du projet sélectionné.",
  drawStart: "Placez les sommets numérotés avec le crayon. Après le point 3, revenez au point 1 pour fermer le contour.",
  needVertices: "Placez au moins trois sommets avant de fermer le contour.",
  drawCleared: "Contour effacé. Tracez une nouvelle zone quand vous voulez.",
  vertexPlaced: (count) => `Point ${count} placé. Ajoutez un sommet ou revenez au point 1 pour fermer le contour.`,
  outlined: (area, count) => `Surface tracée : ${area}, ${count} sommets. Faites glisser un point numéroté pour l’ajuster.`,
  aerial: "Aérien",
  road: "Plan",
  siteArea: "Emprise du site",
  drawZone: "Tracez un contour au crayon, puis fermez-le",
  trace: "Tracer la zone",
  finish: "Fermer le contour",
  undo: "Annuler le point",
  clear: "Effacer",
  traceHelp: "Cliquez autour d’une toiture, d’une façade ou d’un terrain. Après le point 3, cliquez sur le point 1 pour fermer.",
  drawCue: "Cliquez pour ajouter des sommets",
  closeCue: "Point 1 prêt — cliquez pour fermer",
  outlinedArea: "Zone solaire tracée",
  points: "points",
  openData: "Carte aérienne avec recherche d’adresse",
  editHint: "Faites glisser un point numéroté pour affiner le contour",
  streetView: "Google Street View",
  googleLater: "Street View et 3D photoréaliste de cette adresse.",
  mapLayers: "Calques de carte",
  zoomControls: "Zoom de la carte",
  centerSelected: "Centrer sur le site",
  movePoint: (index) => `Déplacer le point ${index}`,
  draftPoint: (index) => `Point provisoire ${index}`,
  closeOutlineAtFirst: "Fermer le contour au point 1",
  zoomIn: "Zoom avant",
  zoomOut: "Zoom arrière",
  detailView: "Vue rapprochée",
  detect: "Détecter le contour",
  detecting: "Lecture du contour du bâtiment…",
  detectHint: "Placez l’épingle sur le bâtiment, puis détectez son contour automatiquement.",
  detectMissing: "Aucun contour trouvé pour ce bâtiment. Tracez-le à la main.",
  detectError: "Données du bâtiment indisponibles. Tracez le contour à la main ou réessayez.",
  detectedHint: "Issu de la détection · déplacez les sommets pour ajuster",
  tracedHint: "Tracé à la main · déplacez les sommets pour ajuster",
  manualTrace: "Tracer à la main",
  redraw: "Retracer",
  useDetected: "Utiliser le contour détecté",
  detectedArea: "Contour du bâtiment détecté",
  retry: "Réessayer",
  findingBuildings: "Recherche des bâtiments à cette adresse…",
  pickHint: (count) => `Touchez votre bâtiment sur la carte (${count} à proximité).`,
  pickOther: "Touchez un autre contour pour changer de bâtiment",
  detectAtPin: "Détecter au repère",
  changeAddress: "Changer d’adresse",
  sunLayer: "Ensoleillement",
  sunLoading: "Chargement de l’ensoleillement…",
  sunNone: "Pas de données d’ensoleillement ici",
  sunLegend: "kWh par kWc et par an",
};

const JA_TEXT: MapText = {
  ready: "地図の準備ができました。住所を検索するか、ピンを置くか、太陽光エリアをなぞってください。",
  locating: "住所を検索しています…",
  unavailable: "場所が見つかりません。完全な住所か郵便番号をお試しください。",
  selected: "プロジェクト敷地を選択しました。",
  drawStart: "鉛筆カーソルで番号付きの頂点を置きます。3 点目の後に 1 点目へ戻ると輪郭が閉じます。",
  needVertices: "輪郭を閉じる前に 3 点以上置いてください。",
  drawCleared: "敷地の輪郭を消去しました。改めてなぞってください。",
  vertexPlaced: (count) => `${count} 点目を置きました。頂点を追加するか、1 点目に戻って閉じてください。`,
  outlined: (area, count) => `なぞった敷地面積：${area}（頂点 ${count} 点）。番号付きの点をドラッグして調整できます。`,
  aerial: "航空写真",
  road: "地図",
  siteArea: "敷地範囲",
  drawZone: "鉛筆で境界をなぞって閉じる",
  trace: "エリアをなぞる",
  finish: "輪郭を閉じる",
  undo: "頂点を戻す",
  clear: "消去",
  traceHelp: "屋根・外壁・空き地の周囲を順にクリックします。3 点目の後に 1 点目をクリックすると閉じます。",
  drawCue: "クリックで頂点を追加",
  closeCue: "1 点目をクリックして閉じる",
  outlinedArea: "なぞった太陽光エリア",
  points: "点",
  openData: "航空写真と住所検索",
  editHint: "番号付きの点をドラッグして境界を調整",
  streetView: "Google ストリートビュー",
  googleLater: "この住所のストリートビューとフォトリアル 3D。",
  mapLayers: "地図レイヤー",
  zoomControls: "地図のズーム",
  centerSelected: "選択した敷地に戻る",
  movePoint: (index) => `${index} 点目を移動`,
  draftPoint: (index) => `仮の ${index} 点目`,
  closeOutlineAtFirst: "1 点目で輪郭を閉じる",
  zoomIn: "拡大",
  zoomOut: "縮小",
  detailView: "近接表示",
  detect: "建物の輪郭を検出",
  detecting: "建物の輪郭を読み取り中…",
  detectHint: "ピンを建物の上に置き、輪郭を自動検出します。",
  detectMissing: "この建物の輪郭が見つかりません。手動でトレースしてください。",
  detectError: "建物データを取得できません。手動でトレースするか再試行してください。",
  detectedHint: "建物検出から · 頂点をドラッグして微調整",
  tracedHint: "手動トレース · 頂点をドラッグして微調整",
  manualTrace: "手動でトレース",
  redraw: "描き直す",
  useDetected: "検出した輪郭を使う",
  detectedArea: "検出した建物の輪郭",
  retry: "再試行",
  findingBuildings: "この住所の周辺の建物を探しています…",
  pickHint: (count) => `地図上で対象の建物をタップしてください（周辺 ${count} 棟）。`,
  pickOther: "別の輪郭をタップすると建物を切り替えます",
  detectAtPin: "ピン位置で検出",
  changeAddress: "住所を変更",
  sunLayer: "屋根の日射",
  sunLoading: "屋根の日射マップを読み込み中…",
  sunNone: "この地点の日射データはありません",
  sunLegend: "kWp あたり年間 kWh",
};

const ES_TEXT: MapText = {
  ready: "Mapa listo. Busca una dirección, coloca un marcador o traza una zona solar.",
  locating: "Buscando la dirección…",
  unavailable: "No se encontró la ubicación. Prueba con la dirección completa o el código postal.",
  selected: "Emplazamiento del proyecto seleccionado.",
  drawStart: "Coloca los vértices numerados con el lápiz. Tras el punto 3, vuelve al punto 1 para cerrar el contorno.",
  needVertices: "Coloca al menos tres vértices antes de cerrar el contorno.",
  drawCleared: "Contorno borrado. Traza otra zona cuando quieras.",
  vertexPlaced: (count) => `Punto ${count} colocado. Añade otro vértice o vuelve al punto 1 para cerrar el contorno.`,
  outlined: (area, count) => `Superficie trazada: ${area}, ${count} vértices. Arrastra un punto numerado para ajustarla.`,
  aerial: "Aérea",
  road: "Mapa",
  siteArea: "Contorno del sitio",
  drawZone: "Traza un contorno con el lápiz y ciérralo",
  trace: "Trazar zona",
  finish: "Cerrar contorno",
  undo: "Deshacer punto",
  clear: "Borrar",
  traceHelp: "Haz clic alrededor de una cubierta, fachada o parcela. Tras el punto 3, haz clic en el punto 1 para cerrar.",
  drawCue: "Haz clic para añadir vértices",
  closeCue: "Punto 1 listo: haz clic para cerrar",
  outlinedArea: "Zona solar trazada",
  points: "puntos",
  openData: "Mapa aéreo con búsqueda de direcciones",
  editHint: "Arrastra cualquier punto numerado para ajustar el contorno",
  streetView: "Google Street View",
  googleLater: "Street View y 3D fotorrealista de esta dirección.",
  mapLayers: "Capas del mapa",
  zoomControls: "Zoom del mapa",
  centerSelected: "Centrar en el emplazamiento",
  movePoint: (index) => `Mover el punto ${index}`,
  draftPoint: (index) => `Punto provisional ${index}`,
  closeOutlineAtFirst: "Cerrar el contorno en el punto 1",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  detailView: "Vista cercana",
  detect: "Detectar contorno",
  detecting: "Leyendo el contorno del edificio…",
  detectHint: "Coloca el pin sobre el edificio y detecta su contorno automáticamente.",
  detectMissing: "No se encontró el contorno de este edificio. Trázalo a mano.",
  detectError: "Los datos del edificio no están disponibles. Traza el contorno a mano o reintenta.",
  detectedHint: "De la detección · arrastra los vértices para ajustar",
  tracedHint: "Trazado a mano · arrastra los vértices para ajustar",
  manualTrace: "Trazar a mano",
  redraw: "Volver a trazar",
  useDetected: "Usar contorno detectado",
  detectedArea: "Contorno detectado del edificio",
  retry: "Reintentar",
  findingBuildings: "Buscando los edificios de esta dirección…",
  pickHint: (count) => `Toca tu edificio en el mapa (${count} cerca).`,
  pickOther: "Toca otro contorno para cambiar de edificio",
  detectAtPin: "Detectar en el pin",
  changeAddress: "Cambiar dirección",
  sunLayer: "Sol en cubierta",
  sunLoading: "Cargando mapa solar de cubierta…",
  sunNone: "Sin datos solares de cubierta aquí",
  sunLegend: "kWh por kWp al año",
};

const IT_TEXT: MapText = {
  ready: "Mappa pronta. Cerca un indirizzo, posiziona un segnaposto o traccia un’area solare.",
  locating: "Ricerca dell’indirizzo…",
  unavailable: "Posizione non trovata. Prova con l’indirizzo completo o il CAP.",
  selected: "Sito del progetto selezionato.",
  drawStart: "Posiziona i vertici numerati con la matita. Dopo il punto 3, torna al punto 1 per chiudere il contorno.",
  needVertices: "Posiziona almeno tre vertici prima di chiudere il contorno.",
  drawCleared: "Contorno cancellato. Traccia un’altra area quando vuoi.",
  vertexPlaced: (count) => `Punto ${count} posizionato. Aggiungi un vertice o torna al punto 1 per chiudere il contorno.`,
  outlined: (area, count) => `Area tracciata: ${area}, ${count} vertici. Trascina un punto numerato per rifinirla.`,
  aerial: "Satellite",
  road: "Mappa",
  siteArea: "Perimetro del sito",
  drawZone: "Traccia un contorno a matita e chiudilo",
  trace: "Traccia area",
  finish: "Chiudi contorno",
  undo: "Annulla punto",
  clear: "Cancella",
  traceHelp: "Fai clic intorno a un tetto, una facciata o un terreno. Dopo il punto 3, fai clic sul punto 1 per chiudere.",
  drawCue: "Fai clic per aggiungere vertici",
  closeCue: "Punto 1 pronto: fai clic per chiudere",
  outlinedArea: "Area solare tracciata",
  points: "punti",
  openData: "Mappa satellitare con ricerca indirizzi",
  editHint: "Trascina un punto numerato per rifinire il contorno",
  streetView: "Google Street View",
  googleLater: "Street View e 3D fotorealistico di questo indirizzo.",
  mapLayers: "Livelli mappa",
  zoomControls: "Zoom mappa",
  centerSelected: "Centra sul sito",
  movePoint: (index) => `Sposta il punto ${index}`,
  draftPoint: (index) => `Punto provvisorio ${index}`,
  closeOutlineAtFirst: "Chiudi il contorno al punto 1",
  zoomIn: "Ingrandisci",
  zoomOut: "Riduci",
  detailView: "Vista ravvicinata",
  detect: "Rileva contorno",
  detecting: "Lettura del contorno dell’edificio…",
  detectHint: "Posiziona il segnaposto sull’edificio, poi rileva il contorno automaticamente.",
  detectMissing: "Nessun contorno trovato per questo edificio. Traccialo a mano.",
  detectError: "Dati dell’edificio non disponibili. Traccia il contorno a mano o riprova.",
  detectedHint: "Dal rilevamento · trascina i vertici per rifinire",
  tracedHint: "Tracciato a mano · trascina i vertici per rifinire",
  manualTrace: "Traccia a mano",
  redraw: "Ritraccia",
  useDetected: "Usa il contorno rilevato",
  detectedArea: "Contorno rilevato dell’edificio",
  retry: "Riprova",
  findingBuildings: "Ricerca degli edifici a questo indirizzo…",
  pickHint: (count) => `Tocca il tuo edificio sulla mappa (${count} nelle vicinanze).`,
  pickOther: "Tocca un altro contorno per cambiare edificio",
  detectAtPin: "Rileva al segnaposto",
  changeAddress: "Cambia indirizzo",
  sunLayer: "Sole sul tetto",
  sunLoading: "Caricamento mappa solare del tetto…",
  sunNone: "Nessun dato solare del tetto qui",
  sunLegend: "kWh per kWp all’anno",
};

const MAP_TEXT: Record<GatewayLanguage, MapText> = {
  en: EN_TEXT,
  zh: ZH_TEXT,
  "zh-Hant": ZH_HANT_TEXT,
  fr: FR_TEXT,
  ja: JA_TEXT,
  es: ES_TEXT,
  it: IT_TEXT,
};
const READY_STATUS_TEXTS = Object.values(MAP_TEXT).map((item) => item.ready);

const TILE_SIZE = 256;
const EARTH_RADIUS = 6_371_000;
const MIN_ZOOM = 3;
const MAX_ZOOM = 21;
/** Deepest tile level each fallback source serves; deeper views scale these tiles up. */
const FALLBACK_MAX_TILE_ZOOM: Record<MapMode, number> = { aerial: 19, road: 19 };
const PUBLIC_CONFIG_CACHE = "modernite-public-config";

const COUNTRY_NAME_TERMS: Record<string, string> = {
  andorra: "ad", austria: "at", belgium: "be", bosnia: "ba", bulgaria: "bg", belarus: "by", canada: "ca", croatia: "hr", cyprus: "cy", czechia: "cz", denmark: "dk", estonia: "ee", finland: "fi", france: "fr", germany: "de", greece: "gr", hungary: "hu", iceland: "is", ireland: "ie", italy: "it", japan: "jp", latvia: "lv", liechtenstein: "li", lithuania: "lt", luxembourg: "lu", malta: "mt", moldova: "md", monaco: "mc", montenegro: "me", netherlands: "nl", norway: "no", poland: "pl", portugal: "pt", romania: "ro", russia: "ru", serbia: "rs", slovakia: "sk", slovenia: "si", spain: "es", sweden: "se", switzerland: "ch", turkey: "tr", ukraine: "ua", "united kingdom": "gb", england: "gb", scotland: "gb", wales: "gb", "vatican city": "va", "north macedonia": "mk", kosovo: "xk",
};

type ProjectLocationMapProps = {
  language: GatewayLanguage;
  market: Market;
  placeholder: string;
  searchLabel: string;
  locateLabel: string;
  initialLocation?: ProjectLocationSelection | null;
  initialArea?: SiteAreaSelection | null;
  onLocationChange: (selection: ProjectLocationSelection) => void;
  onAreaChange: (selection: SiteAreaSelection | null) => void;
  onOpenStreetView?: () => void;
  siteDetection?: SiteDetection;
  buildingPicker?: BuildingPicker;
  /** When set, the in-map search is replaced by the chosen address and a button back to address search. */
  onChangeAddress?: () => void;
  sunHeatmap?: SunHeatmap;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function localeForLanguage(language: GatewayLanguage) {
  if (language === "zh") return "zh-CN";
  if (language === "zh-Hant") return "zh-TW";
  if (language === "ja") return "ja-JP";
  if (language === "fr") return "fr-FR";
  if (language === "es") return "es-ES";
  if (language === "it") return "it-IT";
  return "en-GB";
}

function areaLabel(areaM2: number, language: GatewayLanguage) {
  return `${new Intl.NumberFormat(localeForLanguage(language), { maximumFractionDigits: 1 }).format(areaM2)} m²`;
}

function nominatimLanguage(language: GatewayLanguage) {
  if (language === "zh") return "zh-CN";
  if (language === "zh-Hant") return "zh-TW";
  return language;
}

function hasCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function isCjkLanguage(language: GatewayLanguage) {
  return language === "zh" || language === "zh-Hant" || language === "ja";
}

function normaliseAddressPart(part: string) {
  return part.replace(/\s+/g, " ").trim();
}

function stripLocalisedAliases(value: string) {
  return value
    .split(",")
    .map(normaliseAddressPart)
    .filter((part) => part && !hasCjk(part))
    .map((part) => part.split(";").map(normaliseAddressPart).find((item) => item && !hasCjk(item)) ?? "")
    .filter(Boolean)
    .join(", ");
}

function stripToLocalisedAddress(value: string) {
  const seen = new Set<string>();
  const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const parts = value
    .split(",")
    .map((part) => {
      const aliases = part.split(";").map(normaliseAddressPart).filter(Boolean);
      const local = aliases.find(hasCjk);
      if (local) return local;
      const first = aliases[0] ?? "";
      return postcodePattern.test(first) ? first.toUpperCase() : "";
    })
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return parts.join("，");
}

export function cleanAddressLabel(value: string, language: GatewayLanguage) {
  if (isCjkLanguage(language)) return hasCjk(value) ? stripToLocalisedAddress(value) || stripLocalisedAliases(value) || value : value;
  if (language === "en") return stripLocalisedAliases(value) || value;
  return value;
}

type NominatimAddress = {
  postcode?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  country?: string;
};

function formatNominatimAddress(result: { display_name?: string; address?: NominatimAddress }, language: GatewayLanguage, fallback: string) {
  if (result.address) {
    const address = result.address;
    const parts = [
      address.postcode,
      address.road ?? address.pedestrian ?? address.footway,
      address.neighbourhood ?? address.suburb,
      address.city ?? address.town ?? address.village ?? address.municipality,
      address.county,
      address.state_district,
      address.state,
      address.country,
    ];
    const seen = new Set<string>();
    const label = parts
      .map((part) => part?.trim())
      .filter((part): part is string => {
        if (!part) return false;
        return isCjkLanguage(language) ? (hasCjk(part) || /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(part)) : !hasCjk(part);
      })
      .filter((part) => {
        const key = part.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join(isCjkLanguage(language) ? "，" : ", ");
    if (label) return label;
  }
  return cleanAddressLabel(result.display_name ?? fallback, language);
}

export function countryRestriction(market: Market) {
  if (market.key === "GB") return "gb";
  if (market.key === "CA") return "ca";
  if (market.key === "JP") return "jp";
  return market.shortName !== "EU" ? market.shortName.toLowerCase() : undefined;
}

export type AddressMatch = GeocodeMatch;

/** Addresses outside Japan stay in their local Latin script; CJK transliterations of street names are unusable. */
export function geocodeLanguage(language: GatewayLanguage, market: Market) {
  return isCjkLanguage(language) && market.key !== "JP" ? "en-GB" : nominatimLanguage(language);
}

/** Google geocoding (several matches for ambiguous input), with Nominatim when Google is unavailable. */
export async function searchAddresses(address: string, market: Market, language: GatewayLanguage, googleKey: string | null): Promise<AddressMatch[] | "other-country"> {
  const trimmed = address.trim();
  if (!trimmed) return [];
  const country = countryRestriction(market);
  const statedCountry = Object.entries(COUNTRY_NAME_TERMS).find(([term]) => trimmed.toLowerCase().includes(term))?.[1];
  if (country && statedCountry && statedCountry !== country) return "other-country";
  const requestLanguage = geocodeLanguage(language, market);
  if (googleKey) {
    const found = await googleGeocodeAll(googleKey, trimmed, requestLanguage, country).catch(() => null);
    const usable = (found ?? []).filter((item) => Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng));
    if (usable.length) return usable.map((item) => ({ ...item, label: cleanAddressLabel(item.label, language) }));
  }
  const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "5", q: trimmed, "accept-language": requestLanguage });
  if (country) params.set("countrycodes", country);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json", "Accept-Language": requestLanguage } });
    const results = await response.json() as Array<{ lat: string; lon: string; display_name?: string; type?: string; addresstype?: string; address?: NominatimAddress & { house_number?: string } }>;
    return results
      .filter((item) => item.type !== "country")
      .map((item) => ({ coordinates: { lat: Number(item.lat), lng: Number(item.lon) }, label: formatNominatimAddress(item, language, trimmed), precise: Boolean(item.address?.house_number) || item.addresstype === "building" }))
      .filter((item) => Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng));
  } catch {
    return [];
  }
}

export function useMapsKey() {
  const config = trpc.site.publicConfig.useQuery(undefined, { staleTime: Infinity, retry: 1, initialData: readCachedPublicConfig() ?? undefined, initialDataUpdatedAt: 0 });
  return { key: config.data?.googleMapsApiKey ?? null, loading: config.isLoading };
}

export function pointInPath(point: LatLng, path: LatLng[]) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i]!, b = path[j]!;
    if (a.lat > point.lat !== b.lat > point.lat && point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

function latLngToPoint(coordinates: LatLng, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((clamp(coordinates.lat, -85.05112878, 85.05112878) * Math.PI) / 180);
  return {
    x: ((coordinates.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function pointToLatLng(point: Point, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (point.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat: clamp(lat, -85.05112878, 85.05112878), lng: ((((lng + 180) % 360) + 360) % 360) - 180 };
}

function distanceMetres(a: LatLng, b: LatLng) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function screenDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildSegments(points: Point[], closed: boolean): Segment[] {
  if (points.length < 2) return [];
  const segments: Segment[] = [];
  const limit = closed ? points.length : points.length - 1;
  for (let index = 0; index < limit; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    segments.push({
      left: start.x,
      top: start.y,
      width: Math.hypot(dx, dy),
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }
  return segments;
}

function calculateArea(path: LatLng[]) {
  if (path.length < 3) return 0;
  const latitude = path.reduce((sum, point) => sum + point.lat, 0) / path.length;
  const metresPerDegreeLat = (Math.PI * EARTH_RADIUS) / 180;
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((latitude * Math.PI) / 180);
  const projected = path.map((point) => ({ x: point.lng * metresPerDegreeLng, y: point.lat * metresPerDegreeLat }));
  const area = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(area) / 2;
}

function pathKey(path: LatLng[]) {
  return path.map((point) => `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`).join("|");
}

function isUsablePath(path: LatLng[] | null | undefined): path is LatLng[] {
  return Boolean(path && path.length >= 3 && path.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180));
}

function normaliseTileX(x: number, zoom: number) {
  const max = 2 ** zoom;
  return ((x % max) + max) % max;
}

type TileRef = { key: string; url: string; x: number; y: number; z: number };

function tilesForView(mode: MapMode, tileZoom: number, center: LatLng, zoom: number, size: { width: number; height: number }, google: { key: string; session: string } | null): TileRef[] {
  const scale = 2 ** (zoom - tileZoom);
  const origin = latLngToPoint(center, tileZoom);
  const halfWidth = size.width / 2 / scale;
  const halfHeight = size.height / 2 / scale;
  const startX = Math.floor((origin.x - halfWidth) / TILE_SIZE) - 1;
  const endX = Math.floor((origin.x + halfWidth) / TILE_SIZE) + 1;
  const startY = Math.max(0, Math.floor((origin.y - halfHeight) / TILE_SIZE) - 1);
  const endY = Math.min(2 ** tileZoom - 1, Math.floor((origin.y + halfHeight) / TILE_SIZE) + 1);
  const centreX = origin.x / TILE_SIZE - 0.5;
  const centreY = origin.y / TILE_SIZE - 0.5;
  const output: TileRef[] = [];
  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      output.push({ key: `${tileZoom}-${x}-${y}`, url: tileUrl(mode, tileZoom, normaliseTileX(x, tileZoom), y, google), x, y, z: tileZoom });
    }
  }
  return output.sort((a, b) => Math.hypot(a.x - centreX, a.y - centreY) - Math.hypot(b.x - centreX, b.y - centreY));
}

function readCachedPublicConfig() {
  const inline = (window as { __MODERNITE_PUBLIC_CONFIG__?: { googleMapsApiKey: string | null } }).__MODERNITE_PUBLIC_CONFIG__;
  if (inline) return inline;
  try {
    return JSON.parse(window.localStorage.getItem(PUBLIC_CONFIG_CACHE) ?? "null") as { googleMapsApiKey: string | null } | null;
  } catch {
    return null;
  }
}

function tileUrl(mode: MapMode, zoom: number, x: number, y: number, google?: { key: string; session: string } | null) {
  if (google) return googleTileUrl(google.key, google.session, zoom, x, y);
  if (mode === "aerial") return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

/** Fetches the map key and opens the satellite tile session ahead of the location step. */
export function usePrewarmLocationMap(language: GatewayLanguage, market: Market) {
  const config = trpc.site.publicConfig.useQuery(undefined, { staleTime: Infinity, retry: 1, initialData: readCachedPublicConfig() ?? undefined, initialDataUpdatedAt: 0 });
  const key = config.data?.googleMapsApiKey;
  const region = (countryRestriction(market) ?? "gb").toUpperCase();
  useEffect(() => {
    if (key) void googleTileSession(key, "satellite", nominatimLanguage(language), region).catch(() => {});
  }, [key, language, region]);
}

export function ProjectLocationMap({
  language,
  market,
  placeholder,
  searchLabel,
  locateLabel,
  initialLocation,
  initialArea,
  onLocationChange,
  onAreaChange,
  onOpenStreetView,
  siteDetection,
  buildingPicker,
  onChangeAddress,
  sunHeatmap,
}: ProjectLocationMapProps) {
  const text = MAP_TEXT[language] ?? MAP_TEXT.en;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const multiTouchRef = useRef(false);
  const lastTapRef = useRef<{ time: number; x: number; y: number; zoomedAt: number }>({ time: 0, x: 0, y: 0, zoomedAt: 0 });
  const emittedAreaKeyRef = useRef("");
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<LatLng>(initialLocation?.coordinates ?? market.coordinates);
  const [zoom, setZoom] = useState(clamp(Math.max(market.zoom, 16), MIN_ZOOM, MAX_ZOOM));
  const [mapMode, setMapMode] = useState<MapMode>("aerial");
  const viewRef = useRef({ center, zoom });
  const sizeRef = useRef({ width: 0, height: 0 });
  const animationRef = useRef<number | null>(null);
  const wheelRef = useRef<{ target: number; timer: number | null }>({ target: zoom, timer: null });
  const emittedLocationKeyRef = useRef("");
  const previousLayerRef = useRef<TileRef[]>([]);
  const currentLayerRef = useRef<TileRef[]>([]);
  const [googleMaxZoom, setGoogleMaxZoom] = useState<number | null>(null);
  const mapsConfig = trpc.site.publicConfig.useQuery(undefined, { staleTime: Infinity, retry: 1, initialData: readCachedPublicConfig() ?? undefined, initialDataUpdatedAt: 0 });
  const googleKey = mapsConfig.data?.googleMapsApiKey ?? null;
  const googleLanguage = nominatimLanguage(language);
  const googleRegion = (countryRestriction(market) ?? "gb").toUpperCase();
  const [googleSessions, setGoogleSessions] = useState<Partial<Record<MapMode, string | false>>>({});
  const [googleCopyright, setGoogleCopyright] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [marker, setMarker] = useState<ProjectLocationSelection | null>(initialLocation ?? null);
  const [area, setArea] = useState<SiteAreaSelection | null>(isUsablePath(initialArea?.path) ? initialArea ?? null : null);
  const [draftPath, setDraftPath] = useState<LatLng[]>([]);
  const [drawingActive, setDrawingActive] = useState(false);
  const [closeReady, setCloseReady] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<LatLng | null>(null);
  const [status, setStatus] = useState(text.ready);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const update = () => {
      sizeRef.current = { width: element.clientWidth, height: element.clientHeight };
      setSize(sizeRef.current);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const locationKey = initialLocation ? `${initialLocation.coordinates.lat.toFixed(6)},${initialLocation.coordinates.lng.toFixed(6)}` : "";
    setMarker(initialLocation ? { ...initialLocation, label: cleanAddressLabel(initialLocation.label, language) } : null);
    if (locationKey && locationKey === emittedLocationKeyRef.current) return;
    stopAnimation();
    setCenter(initialLocation?.coordinates ?? market.coordinates);
    setZoom(clamp(Math.max(market.zoom, initialLocation ? 19 : 16), MIN_ZOOM, MAX_ZOOM));
    setQuery("");
    setStatus(text.ready);
  }, [initialLocation, market]);

  useEffect(() => {
    viewRef.current = { center, zoom };
  }, [center, zoom]);

  useEffect(() => {
    if (mapsConfig.data) {
      try {
        window.localStorage.setItem(PUBLIC_CONFIG_CACHE, JSON.stringify(mapsConfig.data));
      } catch {
        // storage unavailable
      }
    }
  }, [mapsConfig.data]);

  useEffect(() => {
    setMarker((current) => current ? { ...current, label: cleanAddressLabel(current.label, language) } : current);
    setStatus((current) => READY_STATUS_TEXTS.includes(current) ? text.ready : current);
  }, [language, text.ready]);

  useEffect(() => {
    if (isUsablePath(initialArea?.path)) {
      const key = pathKey(initialArea.path);
      if (initialArea.source === "detected" && key !== emittedAreaKeyRef.current) {
        const lats = initialArea.path.map((point) => point.lat);
        const lngs = initialArea.path.map((point) => point.lng);
        const centre = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
        const spanM = Math.max((Math.max(...lats) - Math.min(...lats)) * 111_320, (Math.max(...lngs) - Math.min(...lngs)) * 111_320 * Math.cos((centre.lat * Math.PI) / 180), 8);
        const viewport = Math.max(200, Math.min(sizeRef.current.width, sizeRef.current.height) * 0.4);
        const fitZoom = Math.log2((viewport * 156_543 * Math.cos((centre.lat * Math.PI) / 180)) / spanM);
        stopAnimation();
        setCenter(centre);
        setZoom(clamp(Math.floor(fitZoom), 17, 20));
      }
      setArea(initialArea);
      emittedAreaKeyRef.current = key;
    } else {
      setArea(null);
      emittedAreaKeyRef.current = "";
    }
    setDraftPath([]);
    setDrawingActive(false);
    setCloseReady(false);
    setHoverPoint(null);
  }, [initialArea]);

  const centerPoint = useMemo(() => latLngToPoint(center, zoom), [center, zoom]);

  const projectToScreen = useCallback((coordinates: LatLng): Point => {
    const point = latLngToPoint(coordinates, zoom);
    return { x: point.x - centerPoint.x + size.width / 2, y: point.y - centerPoint.y + size.height / 2 };
  }, [centerPoint, size.height, size.width, zoom]);

  const screenToLatLng = useCallback((clientX: number, clientY: number): LatLng => {
    const rect = shellRef.current?.getBoundingClientRect();
    const localX = clientX - (rect?.left ?? 0);
    const localY = clientY - (rect?.top ?? 0);
    return pointToLatLng({ x: centerPoint.x + localX - size.width / 2, y: centerPoint.y + localY - size.height / 2 }, zoom);
  }, [centerPoint, size.height, size.width, zoom]);

  useEffect(() => {
    setGoogleSessions({});
  }, [googleKey, googleLanguage, googleRegion]);

  useEffect(() => {
    if (!googleKey || googleSessions[mapMode] !== undefined) return;
    let cancelled = false;
    googleTileSession(googleKey, mapMode === "aerial" ? "satellite" : "roadmap", googleLanguage, googleRegion)
      .then(({ session }) => !cancelled && setGoogleSessions((current) => ({ ...current, [mapMode]: session })))
      .catch(() => !cancelled && setGoogleSessions((current) => ({ ...current, [mapMode]: false })));
    return () => {
      cancelled = true;
    };
  }, [googleKey, googleLanguage, googleRegion, googleSessions, mapMode]);

  const googleSession = googleSessions[mapMode];
  const googleTiles = googleKey && googleSession ? { key: googleKey, session: googleSession } : null;
  const tileSourcePending = mapsConfig.isLoading || (Boolean(googleKey) && googleSession === undefined);

  useEffect(() => {
    if (!googleTiles || !size.width || !size.height) return;
    const north = pointToLatLng({ x: centerPoint.x, y: centerPoint.y - size.height / 2 }, zoom).lat;
    const south = pointToLatLng({ x: centerPoint.x, y: centerPoint.y + size.height / 2 }, zoom).lat;
    const west = pointToLatLng({ x: centerPoint.x - size.width / 2, y: centerPoint.y }, zoom).lng;
    const east = pointToLatLng({ x: centerPoint.x + size.width / 2, y: centerPoint.y }, zoom).lng;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      googleViewportInfo(googleTiles.key, googleTiles.session, Math.round(zoom), { north, south, east, west })
        .then((info) => {
          if (cancelled) return;
          setGoogleCopyright(info.copyright);
          setGoogleMaxZoom(info.maxZoom);
        })
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [googleTiles?.key, googleTiles?.session, centerPoint.x, centerPoint.y, size.height, size.width, zoom]);

  const maxTileZoom = googleTiles ? clamp(googleMaxZoom ?? 19, MIN_ZOOM, MAX_ZOOM) : FALLBACK_MAX_TILE_ZOOM[mapMode];
  const tileZoom = clamp(Math.round(zoom), MIN_ZOOM, maxTileZoom);
  const currentLayer = useMemo(
    () => (!size.width || !size.height || tileSourcePending ? [] : tilesForView(mapMode, tileZoom, center, zoom, size, googleTiles)),
    [center, zoom, tileZoom, mapMode, size, tileSourcePending, googleTiles?.key, googleTiles?.session],
  );
  const layerSignature = `${mapMode}:${tileZoom}:${googleTiles?.session ?? ""}`;
  const layerSignatureRef = useRef(layerSignature);
  if (layerSignatureRef.current !== layerSignature) {
    previousLayerRef.current = layerSignatureRef.current.split(":")[0] === mapMode ? currentLayerRef.current : [];
    layerSignatureRef.current = layerSignature;
  }
  currentLayerRef.current = currentLayer;
  const tiles = useMemo(() => {
    const placed = (tile: TileRef, layer: "under" | "current") => {
      const scale = 2 ** (zoom - tile.z);
      const tileSize = TILE_SIZE * scale;
      return { ...tile, layer, size: tileSize, left: tile.x * tileSize - centerPoint.x + size.width / 2, top: tile.y * tileSize - centerPoint.y + size.height / 2 };
    };
    const visible = (tile: { left: number; top: number; size: number }) => tile.left < size.width && tile.top < size.height && tile.left + tile.size > 0 && tile.top + tile.size > 0;
    const currentKeys = new Set(currentLayer.map((tile) => tile.key));
    const under = previousLayerRef.current.filter((tile) => !currentKeys.has(tile.key)).map((tile) => placed(tile, "under")).filter(visible);
    return [...under, ...currentLayer.map((tile) => placed(tile, "current"))];
  }, [currentLayer, centerPoint, size.height, size.width, zoom]);

  const polygonPoints = useMemo(() => (area?.path ?? []).map(projectToScreen).map((point) => `${point.x},${point.y}`).join(" "), [area, projectToScreen]);
  const draftPoints = useMemo(() => {
    const path = hoverPoint && drawingActive && draftPath.length ? [...draftPath, closeReady ? draftPath[0]! : hoverPoint] : draftPath;
    return path.map(projectToScreen).map((point) => `${point.x},${point.y}`).join(" ");
  }, [closeReady, draftPath, drawingActive, hoverPoint, projectToScreen]);
  const screenAreaPoints = useMemo(() => (area?.path ?? []).map(projectToScreen), [area, projectToScreen]);
  const screenDraftPoints = useMemo(() => draftPath.map(projectToScreen), [draftPath, projectToScreen]);
  const areaSegments = useMemo(() => buildSegments(screenAreaPoints, Boolean(area)), [area, screenAreaPoints]);
  const draftSegments = useMemo(() => buildSegments(screenDraftPoints, false), [screenDraftPoints]);
  const detecting = siteDetection?.state === "loading";
  const candidates = !drawingActive ? buildingPicker?.candidates ?? [] : [];
  const toolStage = drawingActive ? "drawing"
    : area ? "area"
    : !siteDetection || !marker ? "plain"
    : buildingPicker?.loading ? "finding"
    : candidates.length && siteDetection.state === "idle" ? "pick"
    : siteDetection.state === "idle" || siteDetection.state === "loading" ? "detect"
    : siteDetection.state === "found" ? "restore"
    : "fallback";
  const toolHint = toolStage === "area" ? (area?.source === "detected" ? (candidates.length > 1 ? `${text.detectedHint} · ${text.pickOther}` : text.detectedHint) : text.tracedHint)
    : toolStage === "finding" ? text.findingBuildings
    : toolStage === "pick" ? text.pickHint(candidates.length)
    : toolStage === "detect" ? (detecting ? text.detecting : text.detectHint)
    : toolStage === "fallback" ? (siteDetection?.state === "error" ? text.detectError : text.detectMissing)
    : text.drawZone;
  const candidateShapes = useMemo(() => candidates.map((candidate) => {
    const points = candidate.path.map(projectToScreen);
    const label = projectToScreen(candidate.center);
    return { candidate, points: points.map((point) => `${point.x},${point.y}`).join(" "), label };
  }), [candidates, projectToScreen]);

  const publishArea = useCallback((path: LatLng[]) => {
    if (!isUsablePath(path)) {
      setStatus(text.needVertices);
      return;
    }
    const selection: SiteAreaSelection = { areaM2: calculateArea(path), path, source: "traced" };
    emittedAreaKeyRef.current = pathKey(path);
    setArea(selection);
    onAreaChange(selection);
    setStatus(text.outlined(areaLabel(selection.areaM2, language), path.length));
  }, [language, onAreaChange, text]);

  const finishDrawing = useCallback(() => {
    if (draftPath.length < 3) {
      setStatus(text.needVertices);
      return;
    }
    publishArea(draftPath);
    setDrawingActive(false);
    setDraftPath([]);
    setHoverPoint(null);
    setCloseReady(false);
  }, [draftPath, publishArea, text.needVertices]);

  const selectLocation = useCallback((coordinates: LatLng, label?: string) => {
    const fallback = `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`;
    const displayLabel = label ? cleanAddressLabel(label, language) : fallback;
    const selection = { coordinates, label: displayLabel };
    emittedLocationKeyRef.current = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
    setMarker(selection);
    stopAnimation();
    setCenter(coordinates);
    setZoom((current) => Math.max(Math.round(current), 18));
    setStatus(displayLabel || text.selected);
    onLocationChange(selection);
  }, [language, onLocationChange, text.selected]);

  const locate = useCallback(async (address: string) => {
    if (!address.trim()) return;
    setStatus(text.locating);
    const matches = await searchAddresses(address, market, language, googleKey);
    if (matches === "other-country" || !matches.length) {
      setStatus(text.unavailable);
      return;
    }
    selectLocation(matches[0]!.coordinates, matches[0]!.label);
  }, [googleKey, language, market, selectLocation, text.locating, text.unavailable]);

  const startDrawing = useCallback(() => {
    setArea(null);
    setDraftPath([]);
    setHoverPoint(null);
    setCloseReady(false);
    emittedAreaKeyRef.current = "";
    onAreaChange(null);
    setDrawingActive(true);
    setStatus(text.drawStart);
  }, [onAreaChange, text.drawStart]);

  const clearArea = useCallback(() => {
    setArea(null);
    setDraftPath([]);
    setHoverPoint(null);
    setCloseReady(false);
    setDrawingActive(false);
    emittedAreaKeyRef.current = "";
    onAreaChange(null);
    setStatus(text.drawCleared);
  }, [onAreaChange, text.drawCleared]);

  const undoDraftPoint = useCallback(() => {
    setDraftPath((path) => {
      const next = path.slice(0, -1);
      setStatus(next.length ? text.vertexPlaced(next.length) : text.drawStart);
      return next;
    });
    setCloseReady(false);
  }, [text]);

  const zoomTo = useCallback((targetZoom: number, anchor?: Point, duration = 240) => {
    const target = clamp(targetZoom, MIN_ZOOM, MAX_ZOOM);
    const { center: startCenter, zoom: startZoom } = viewRef.current;
    const { width, height } = sizeRef.current;
    const offset = anchor ? { x: anchor.x - width / 2, y: anchor.y - height / 2 } : { x: 0, y: 0 };
    const startPoint = latLngToPoint(startCenter, startZoom);
    const anchorLocation = pointToLatLng({ x: startPoint.x + offset.x, y: startPoint.y + offset.y }, startZoom);
    const apply = (nextZoom: number) => {
      const anchorPoint = latLngToPoint(anchorLocation, nextZoom);
      const nextCenter = pointToLatLng({ x: anchorPoint.x - offset.x, y: anchorPoint.y - offset.y }, nextZoom);
      viewRef.current = { center: nextCenter, zoom: nextZoom };
      setCenter(nextCenter);
      setZoom(nextZoom);
    };
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (duration <= 0 || Math.abs(target - startZoom) < 1e-3) {
      apply(target);
      return;
    }
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      apply(startZoom + (target - startZoom) * (1 - (1 - progress) ** 3));
      animationRef.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    animationRef.current = requestAnimationFrame(step);
  }, []);

  function stopAnimation() {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }

  const zoomStep = useCallback((direction: 1 | -1) => {
    const base = animationRef.current !== null ? wheelRef.current.target : viewRef.current.zoom;
    const target = clamp(Math.round(base) + direction, MIN_ZOOM, MAX_ZOOM);
    wheelRef.current.target = target;
    zoomTo(target);
  }, [zoomTo]);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * rect.height : event.deltaY;
      const wheel = wheelRef.current;
      const animating = animationRef.current !== null;
      const base = animating || wheel.timer !== null ? wheel.target : viewRef.current.zoom;
      if (!event.ctrlKey && Math.abs(pixels) >= 50) {
        wheel.target = clamp(Math.round(base) + (pixels < 0 ? 1 : -1), MIN_ZOOM, MAX_ZOOM);
        zoomTo(wheel.target, anchor, 220);
      } else {
        wheel.target = clamp(base - pixels * (event.ctrlKey ? 0.012 : 0.004), MIN_ZOOM, MAX_ZOOM);
        zoomTo(wheel.target, anchor, 0);
      }
      if (wheel.timer !== null) window.clearTimeout(wheel.timer);
      wheel.timer = window.setTimeout(() => {
        wheel.timer = null;
        const settled = Math.round(viewRef.current.zoom);
        if (Math.abs(settled - viewRef.current.zoom) > 1e-3) zoomTo(settled, anchor, 160);
      }, 180);
    };
    // Safari reports trackpad pinch as non-standard gesture events instead of ctrl+wheel.
    type SafariGesture = Event & { scale: number; clientX: number; clientY: number };
    let gestureStartZoom = viewRef.current.zoom;
    const gestureAnchor = (event: SafariGesture) => {
      const rect = element.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStartZoom = viewRef.current.zoom;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as SafariGesture;
      if (pointersRef.current.size >= 2 || !Number.isFinite(gesture.scale) || gesture.scale <= 0) return;
      zoomTo(gestureStartZoom + Math.log2(gesture.scale), gestureAnchor(gesture), 0);
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      if (pointersRef.current.size >= 2) return;
      const settled = Math.round(viewRef.current.zoom);
      if (Math.abs(settled - viewRef.current.zoom) > 1e-3) zoomTo(settled, gestureAnchor(event as SafariGesture), 160);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("gesturestart", onGestureStart, { passive: false });
    element.addEventListener("gesturechange", onGestureChange, { passive: false });
    element.addEventListener("gestureend", onGestureEnd, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGestureChange);
      element.removeEventListener("gestureend", onGestureEnd);
    };
  }, [zoomTo]);

  const focusDetailView = useCallback(() => {
    if (area?.path.length) {
      const centroid = area.path.reduce((sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }), { lat: 0, lng: 0 });
      stopAnimation();
      setCenter({ lat: centroid.lat / area.path.length, lng: centroid.lng / area.path.length });
      setZoom(20);
      return;
    }
    stopAnimation();
    if (marker) {
      setCenter(marker.coordinates);
      setZoom(20);
      return;
    }
    setCenter(market.coordinates);
    setZoom(Math.max(18, market.zoom));
  }, [area, marker, market.coordinates, market.zoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawingActive) {
      if (!event.isPrimary) return;
      event.preventDefault();
      event.stopPropagation();
      const point = screenToLatLng(event.clientX, event.clientY);
      const first = draftPath[0];
      const shouldClose = Boolean(first && draftPath.length >= 3 && (screenDistance(projectToScreen(point), projectToScreen(first)) <= 56 || distanceMetres(point, first) <= 8.5));
      if (shouldClose) {
        finishDrawing();
        return;
      }
      const previous = draftPath[draftPath.length - 1];
      if (previous && (screenDistance(projectToScreen(point), projectToScreen(previous)) <= 14 || distanceMetres(point, previous) <= 1.5)) {
        setStatus(text.vertexPlaced(draftPath.length));
        return;
      }
      setDraftPath((path) => {
        const next = [...path, point];
        setStatus(text.vertexPlaced(next.length));
        return next;
      });
      setHoverPoint(null);
      setCloseReady(false);
      return;
    }
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = Array.from(pointers.values());
      multiTouchRef.current = true;
      dragRef.current = { type: "pinch", startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), startZoom: viewRef.current.zoom, anchor: screenToLatLng((a.x + b.x) / 2, (a.y + b.y) / 2) };
      return;
    }
    multiTouchRef.current = false;
    dragRef.current = { type: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startCenter: centerPoint, moved: false };
  };

  const applyPinch = (drag: Extract<DragState, { type: "pinch" }>) => {
    const [a, b] = Array.from(pointersRef.current.values());
    const rect = shellRef.current?.getBoundingClientRect();
    if (!a || !b || !rect) return;
    const nextZoom = clamp(drag.startZoom + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / drag.startDistance), MIN_ZOOM, MAX_ZOOM);
    const anchorPoint = latLngToPoint(drag.anchor, nextZoom);
    const offset = { x: (a.x + b.x) / 2 - rect.left - rect.width / 2, y: (a.y + b.y) / 2 - rect.top - rect.height / 2 };
    const nextCenter = pointToLatLng({ x: anchorPoint.x - offset.x, y: anchorPoint.y - offset.y }, nextZoom);
    viewRef.current = { center: nextCenter, zoom: nextZoom };
    setCenter(nextCenter);
    setZoom(nextZoom);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const pointerLocation = screenToLatLng(event.clientX, event.clientY);
    if (drawingActive) {
      setHoverPoint(pointerLocation);
      const first = draftPath[0];
      setCloseReady(Boolean(first && draftPath.length >= 3 && (screenDistance(projectToScreen(pointerLocation), projectToScreen(first)) <= 56 || distanceMetres(pointerLocation, first) <= 8.5)));
    }
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (drag?.type === "pinch") {
      applyPinch(drag);
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.type === "vertex") {
      if (!area) return;
      const path = area.path.map((point, index) => (index === drag.index ? pointerLocation : point));
      setArea({ ...area, areaM2: calculateArea(path), path });
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const tapSlop = event.pointerType === "mouse" ? 3 : 10;
    if (Math.abs(dx) > tapSlop || Math.abs(dy) > tapSlop) drag.moved = true;
    if (!drag.moved) return;
    setCenter(pointToLatLng({ x: drag.startCenter.x - dx, y: drag.startCenter.y - dy }, zoom));
  };

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.type === "pinch" || (multiTouchRef.current && drag?.type !== "vertex")) {
      releasePointer(event);
      if (pointersRef.current.size === 0) {
        dragRef.current = null;
        multiTouchRef.current = false;
        const rect = shellRef.current?.getBoundingClientRect();
        const settled = Math.round(viewRef.current.zoom);
        if (Math.abs(settled - viewRef.current.zoom) > 1e-3) zoomTo(settled, rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : undefined, 160);
      } else {
        dragRef.current = { type: "pan", pointerId: -1, startX: 0, startY: 0, startCenter: centerPoint, moved: true };
      }
      return;
    }
    if (drag?.pointerId === event.pointerId && drag.type === "vertex" && area) {
      const key = pathKey(area.path);
      if (key !== emittedAreaKeyRef.current) {
        emittedAreaKeyRef.current = key;
        onAreaChange(area);
        setStatus(text.outlined(areaLabel(area.areaM2, language), area.path.length));
      }
    }
    if (!drawingActive && drag?.type === "pan" && !drag.moved) {
      const tap = lastTapRef.current;
      const now = performance.now();
      if (event.pointerType !== "mouse" && now - tap.time < 320 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 30) {
        const rect = shellRef.current?.getBoundingClientRect();
        tap.time = 0;
        tap.zoomedAt = now;
        zoomTo(Math.round(viewRef.current.zoom) + 1, { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) });
      } else {
        lastTapRef.current = { ...tap, time: now, x: event.clientX, y: event.clientY };
        const tapped = screenToLatLng(event.clientX, event.clientY);
        const hit = candidates.filter((candidate) => pointInPath(tapped, candidate.path)).sort((a, b) => a.areaM2 - b.areaM2)[0];
        if (hit && buildingPicker) {
          if (hit.id !== buildingPicker.selectedId) buildingPicker.onPick(hit);
        } else if (!(area && pointInPath(tapped, area.path))) {
          selectLocation(tapped);
        }
      }
    }
    dragRef.current = null;
    releasePointer(event);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (drawingActive || performance.now() - lastTapRef.current.zoomedAt < 600) return;
    const rect = shellRef.current?.getBoundingClientRect();
    zoomTo(Math.round(viewRef.current.zoom) + 1, { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) });
  };

  const stopMapGesture = (event: React.PointerEvent | React.MouseEvent) => event.stopPropagation();

  const beginVertexDrag = (event: React.PointerEvent<SVGCircleElement | HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    shellRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { type: "vertex", pointerId: event.pointerId, index };
  };

  const closeFromFirstDraftPoint = (event: React.PointerEvent<SVGCircleElement | HTMLButtonElement>) => {
    if (draftPath.length < 3) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrawing();
  };

  const runToolClickAction = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  const showReference = !marker;
  const referenceLabel = market.referenceLabel ?? market.name;

  return (
    <section className={`location-map-shell location-map-shell--studio ${drawingActive ? "is-tracing" : ""}`} aria-label={searchLabel}>
      <div
        ref={shellRef}
        className={`osm-map-canvas osm-map-canvas--${mapMode}`}
        role="application"
        aria-label={text.openData}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => { releasePointer(event); dragRef.current = null; multiTouchRef.current = pointersRef.current.size > 0; }}
        onDoubleClick={handleDoubleClick}
      >
        <div className="osm-tile-layer" aria-hidden="true">
          {tiles.map((tile) => <img key={tile.key} className={tile.layer === "under" ? "is-underlay" : undefined} src={tile.url} alt="" draggable={false} decoding="async" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }} />)}
        </div>
        {sunHeatmap?.visible && sunHeatmap.data && (() => {
          const { nw, ne, sw } = sunHeatmap.data.corners;
          const p0 = projectToScreen(nw), p1 = projectToScreen(ne), p3 = projectToScreen(sw);
          const matrix = `matrix(${(p1.x - p0.x) / 100}, ${(p1.y - p0.y) / 100}, ${(p3.x - p0.x) / 100}, ${(p3.y - p0.y) / 100}, ${p0.x}, ${p0.y})`;
          return <img className="osm-sun-layer" src={sunHeatmap.data.dataUrl} alt="" draggable={false} style={{ transform: matrix }} />;
        })()}
        <svg className="osm-vector-layer" aria-hidden="true">
          {candidateShapes.map(({ candidate, points }) => candidate.id === buildingPicker?.selectedId && area ? null : <polygon key={candidate.id} className={`osm-candidate-polygon ${toolStage === "pick" ? "is-inviting" : ""}`} points={points} />)}
          {area && <polygon className="osm-area-polygon" points={polygonPoints} />}
          {area?.path.map((point, index) => {
            const screen = projectToScreen(point);
            return (
              <g key={`${index}-${point.lat}-${point.lng}`} className="osm-area-vertex">
                <circle cx={screen.x} cy={screen.y} r="12" onPointerDown={(event) => beginVertexDrag(event, index)} />
                <text x={screen.x} y={screen.y + 4}>{index + 1}</text>
              </g>
            );
          })}
          {draftPath.length > 0 && <polyline className={`osm-draft-line ${closeReady ? "is-close-ready" : ""}`} points={draftPoints} />}
          {draftPath.map((point, index) => {
            const screen = projectToScreen(point);
            return (
              <g key={`draft-${index}-${point.lat}-${point.lng}`} className={`osm-draft-vertex ${index === 0 && closeReady ? "is-close-ready" : ""}`}>
                <circle cx={screen.x} cy={screen.y} r={index === 0 && closeReady ? 17 : 12} onPointerDown={index === 0 ? closeFromFirstDraftPoint : undefined} />
                <text x={screen.x} y={screen.y + 4}>{index + 1}</text>
              </g>
            );
          })}
        </svg>
        {(areaSegments.length > 0 || draftSegments.length > 0 || screenAreaPoints.length > 0 || screenDraftPoints.length > 0) && (
          <div className="osm-html-overlay">
            {areaSegments.map((segment, index) => (
              <span
                key={`area-segment-${index}`}
                className="osm-html-segment osm-html-segment--area"
                style={{ left: segment.left, top: segment.top, width: segment.width, transform: `rotate(${segment.angle}deg)` }}
              />
            ))}
            {draftSegments.map((segment, index) => (
              <span
                key={`draft-segment-${index}`}
                className={`osm-html-segment osm-html-segment--draft ${closeReady ? "is-close-ready" : ""}`}
                style={{ left: segment.left, top: segment.top, width: segment.width, transform: `rotate(${segment.angle}deg)` }}
              />
            ))}
            {screenAreaPoints.map((point, index) => (
              <button
                key={`area-html-${index}`}
                type="button"
                className="osm-html-vertex osm-html-vertex--area"
                style={{ left: point.x, top: point.y }}
                onPointerDown={(event) => beginVertexDrag(event, index)}
                aria-label={text.movePoint(index + 1)}
              >
                {index + 1}
              </button>
            ))}
            {screenDraftPoints.map((point, index) => (
              <button
                key={`draft-html-${index}`}
                type="button"
                className={`osm-html-vertex osm-html-vertex--draft ${index === 0 ? "is-first" : ""} ${index === 0 && closeReady ? "is-close-ready" : ""}`}
                style={{ left: point.x, top: point.y }}
                onPointerDown={index === 0 ? closeFromFirstDraftPoint : undefined}
                aria-label={index === 0 && draftPath.length >= 3 ? text.closeOutlineAtFirst : text.draftPoint(index + 1)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}
        {zoom >= 18.5 && candidateShapes.some(({ candidate }) => candidate.label) && <div className="osm-candidate-labels" aria-hidden="true">
          {candidateShapes.map(({ candidate, label }) => {
            const houseNumber = candidate.label?.match(/^\s*(\d+[a-z]?)\b/i)?.[1];
            return houseNumber && candidate.id !== buildingPicker?.selectedId ? <span key={candidate.id} style={{ left: label.x, top: label.y }}>{houseNumber}</span> : null;
          })}
        </div>}
        {marker && <div className="osm-site-marker" key={`${marker.coordinates.lat},${marker.coordinates.lng}`} style={{ left: projectToScreen(marker.coordinates).x, top: projectToScreen(marker.coordinates).y }}>
          <svg className="osm-site-pin" viewBox="0 0 26 37" width="34" height="48" aria-hidden="true"><path d="M13 .6C6.15.6.6 6.15.6 13c0 9.3 12.4 23.4 12.4 23.4S25.4 22.3 25.4 13C25.4 6.15 19.85.6 13 .6Z" /><circle cx="13" cy="13" r="4.6" /></svg>
          <span>{cleanAddressLabel(marker.label, language)}</span>
        </div>}
        <div className="osm-control-stack" aria-label={text.zoomControls} onPointerDown={stopMapGesture} onPointerUp={stopMapGesture} onDoubleClick={stopMapGesture}>
          <button type="button" aria-label={text.zoomIn} onClick={() => zoomStep(1)} disabled={zoom >= MAX_ZOOM}>+</button>
          <button type="button" aria-label={text.zoomOut} onClick={() => zoomStep(-1)} disabled={zoom <= MIN_ZOOM}>−</button>
          <button type="button" className="osm-detail-button" aria-label={text.detailView} title={text.detailView} onClick={focusDetailView}>1:1</button>
          <button type="button" aria-label={text.centerSelected} onClick={() => { stopAnimation(); setCenter(marker?.coordinates ?? market.coordinates); }}><Crosshair size={16} /></button>
        </div>
        <div className="osm-attribution" onPointerDown={stopMapGesture} onDoubleClick={stopMapGesture}>
          {googleTiles ? <><span className="google-map-logo" aria-label="Google">Google</span> {googleCopyright || "Map data © Google"}</> : mapMode === "aerial" ? "Imagery © Esri, Maxar, Earthstar Geographics" : <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>}
        </div>
      </div>

      {onChangeAddress ? <div className="site-map-search site-map-address">
        <MapPin size={17} aria-hidden="true" />
        <span title={marker?.label}>{marker ? cleanAddressLabel(marker.label, language) : placeholder}</span>
        <button type="button" onClick={onChangeAddress}><Search size={14} /> {text.changeAddress}</button>
      </div> : <div className="site-map-search">
        <Search size={17} aria-hidden="true" />
        <input aria-label={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void locate(query); }} placeholder={placeholder} />
        <button type="button" onClick={() => void locate(query)} disabled={!query.trim()}>{locateLabel}</button>
      </div>}

      <div className="site-map-mode-control" aria-label={text.mapLayers}>
        <button type="button" className={mapMode === "aerial" ? "is-active" : ""} onClick={() => setMapMode("aerial")}><Navigation size={14} /> {text.aerial}</button>
        <button type="button" className={mapMode === "road" ? "is-active" : ""} onClick={() => setMapMode("road")}><Navigation size={14} /> {text.road}</button>
        {sunHeatmap && marker && <button type="button" className={`site-sun-toggle ${sunHeatmap.visible ? "is-active" : ""}`} aria-pressed={sunHeatmap.visible} onClick={sunHeatmap.onToggle}>{sunHeatmap.state === "loading" ? <Loader2 size={14} className="spin" /> : <Sun size={14} />} {text.sunLayer}</button>}
      </div>
      {sunHeatmap?.visible && sunHeatmap.state !== "idle" && <div className="site-sun-legend" aria-live="polite">
        {sunHeatmap.state === "loading" ? <span>{text.sunLoading}</span>
          : sunHeatmap.state === "none" || !sunHeatmap.data ? <span>{text.sunNone}</span>
          : <><i aria-hidden="true" /><span><b>{sunHeatmap.data.minKwhPerKw}</b><b>{sunHeatmap.data.maxKwhPerKw}</b></span><small>{text.sunLegend} · External solar heatmap{sunHeatmap.data.imageryDate ? ` ${sunHeatmap.data.imageryDate}` : ""}</small></>}
      </div>}

      {showReference && <div className="site-map-reference" aria-live="polite"><span><MapPin size={14} /></span><div><small>{text.openData}</small><b>{referenceLabel}</b><p>{text.ready}</p></div></div>}

      <div className="site-map-tools">
        <div className={`site-map-tool-card ${drawingActive ? "is-drawing" : ""} ${toolStage === "fallback" ? "is-fallback" : ""}`}>
          <div className="site-map-tool-heading"><span>{detecting || toolStage === "finding" ? <Loader2 size={15} className="spin" /> : toolStage === "detect" ? <ScanSearch size={15} /> : toolStage === "pick" ? <MousePointerClick size={15} /> : <Ruler size={15} />}</span><div><b>{text.siteArea}</b><small>{toolHint}</small></div></div>
          <div className={`site-map-tool-actions ${drawingActive ? "is-drawing" : ""}`}>
            {toolStage === "finding" ? <>
              <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, startDrawing)}><Pencil size={13} /> {text.manualTrace}</button>
            </> : toolStage === "pick" && siteDetection ? <>
              <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, siteDetection.onDetect)}><ScanSearch size={13} /> {text.detectAtPin}</button>
              <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, startDrawing)}><Pencil size={13} /> {text.manualTrace}</button>
            </> : drawingActive ? <>
              <button type="button" className="is-active" onClick={(event) => runToolClickAction(event, finishDrawing)}><Pencil size={14} /> {text.finish}</button>
              <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, undoDraftPoint)} disabled={draftPath.length === 0}><Undo2 size={13} /> {text.undo}</button>
              <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, clearArea)}>{text.clear}</button>
            </> : toolStage === "detect" && siteDetection ? <>
              <button type="button" className="is-primary" disabled={detecting} onClick={(event) => runToolClickAction(event, siteDetection.onDetect)}>{detecting ? <Loader2 size={14} className="spin" /> : <ScanSearch size={14} />} {text.detect}</button>
              <button type="button" className="is-quiet" disabled={detecting} onClick={(event) => runToolClickAction(event, startDrawing)}><Pencil size={13} /> {text.manualTrace}</button>
            </> : toolStage === "fallback" ? <>
              <button type="button" className="is-primary" onClick={(event) => runToolClickAction(event, startDrawing)}><Pencil size={14} /> {text.manualTrace}</button>
              {siteDetection?.state === "error" && <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, siteDetection.onDetect)}>{text.retry}</button>}
            </> : toolStage === "restore" && siteDetection?.onUseDetected ? <>
              <button type="button" className="is-primary" onClick={(event) => runToolClickAction(event, siteDetection.onUseDetected!)}><ScanSearch size={14} /> {text.useDetected}</button>
              <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, startDrawing)}><Pencil size={13} /> {text.manualTrace}</button>
            </> : <>
              <button type="button" onClick={(event) => runToolClickAction(event, startDrawing)}><Pencil size={14} /> {area ? text.redraw : text.trace}</button>
              {area && siteDetection?.state === "found" && area.source !== "detected" && siteDetection.onUseDetected && <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, siteDetection.onUseDetected!)}>{text.useDetected}</button>}
              <button type="button" className="is-quiet" onClick={(event) => runToolClickAction(event, clearArea)} disabled={!area}>{text.clear}</button>
            </>}
          </div>
          {drawingActive && <div className={`site-trace-progress ${closeReady ? "is-close-ready" : ""}`} aria-live="polite"><span>{draftPath.length}</span><b>{text.points}</b><i>{closeReady ? text.closeCue : text.drawCue}</i></div>}
          {(drawingActive || toolStage === "fallback") && <p className="site-map-trace-help">{text.traceHelp}</p>}
        </div>
        <button type="button" className="site-street-view" disabled={!onOpenStreetView || !marker} title={text.googleLater} onClick={onOpenStreetView}>{onOpenStreetView && marker ? <Eye size={15} /> : <EyeOff size={15} />}<span><b>{text.streetView}</b><small>{text.googleLater}</small></span></button>
      </div>

      {drawingActive && <div className={`site-draw-cue ${closeReady ? "is-close-ready" : ""}`}><Pencil size={15} /><span>{closeReady ? text.closeCue : text.drawCue}</span></div>}
      {area && <div className="site-area-readout" aria-live="polite"><span><Ruler size={16} /></span><div><small>{area.source === "detected" ? text.detectedArea : text.outlinedArea}</small><strong>{areaLabel(area.areaM2, language)}</strong></div><em>{area.path.length} {text.points}</em><p>{text.editHint}</p></div>}
      <div className="site-map-status"><span><MapPin size={14} aria-hidden="true" /> {status}</span><span><Crosshair size={14} aria-hidden="true" /> {text.openData}</span></div>
    </section>
  );
}
