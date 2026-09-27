import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Eye, MapPin, Navigation, Pencil, Ruler, Satellite, Search, Undo2 } from "lucide-react";
import { MapView } from "@/components/Map";

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
};

type GatewayLanguage = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

type MapText = {
  ready: string; preparing: string; locating: string; unavailable: string; drawStart: string; needVertices: string; drawCleared: string;
  aerialReady: (name: string) => string; roughStart: (name: string) => string; vertexPlaced: (count: number) => string; outlined: (area: string, count: number) => string;
  aerial: string; road: string; siteArea: string; drawZone: string; trace: string; finish: string; undo: string; clear: string; traceHelp: string; drawCue: string; closeCue: string;
  streetView: string; streetPreview: string; streetEnter: string; streetReturn: string; streetExit: string; streetUnavailable: string; streetDisabled: string; outlinedArea: string; points: string; pegman: string; referenceOnly: string; editHint: string;
};

const MAP_TEXT: Record<GatewayLanguage, MapText> = {
  en: { ready: "Satellite view is ready. Search an address, place a pin, or trace an area.", preparing: "The map is still preparing. Please try tracing again in a moment.", locating: "Locating address…", unavailable: "Location unavailable — try a complete address or postcode.", drawStart: "Use the pencil cursor to place numbered corners. Return to point 1 after point 3 to close the outline.", needVertices: "Place at least three numbered vertices before closing the site outline.", drawCleared: "Site outline cleared. Trace another area when ready.", aerialReady: (name) => `${name} aerial reference is ready. Search a site or trace a proposed solar area.`, roughStart: (name) => `Starting around ${name}. This is a market-level reference, not the project address.`, vertexPlaced: (count) => `Point ${count} placed. Add another corner, or return to point 1 to close the boundary.`, outlined: (area, count) => `Outlined site area: ${area} across ${count} vertices. Drag a numbered point to refine it.`, aerial: "Aerial", road: "Road", siteArea: "Solar-ready area", drawZone: "Pencil-trace a boundary, then close it", trace: "Trace area", finish: "Close outline", undo: "Undo point", clear: "Clear", traceHelp: "Click 1, 2, 3… around a roof, façade, or open plot. After point 3, move back to the bright first point to close the shape.", drawCue: "Click to add corners", closeCue: "Point 1 is ready — click to close", streetView: "Street View", streetPreview: "Preview from a highlighted road", streetEnter: "Street View is open. Use the arrows to look around, or choose Return to aerial map.", streetReturn: "Return to aerial map", streetExit: "Returned to the satellite map.", streetUnavailable: "No Street View panorama is available at this point. Try a nearby highlighted road.", streetDisabled: "Search an address or place a site pin before opening Street View.", outlinedArea: "Outlined solar area", points: "points", pegman: "Drag Pegman onto a highlighted road for full Street View", referenceOnly: "Market reference only", editHint: "Drag any bright numbered point to refine the boundary" },
  zh: { ready: "卫星地图已就绪。搜索地址、放置定位点或勾画区域。", preparing: "地图仍在加载，请稍后再试。", locating: "正在定位地址…", unavailable: "无法定位，请尝试完整地址或邮编。", drawStart: "使用铅笔光标放置编号顶点。放置第 3 个点后，回到第 1 个点即可闭合边界。", needVertices: "请至少放置三个编号顶点后再完成边界。", drawCleared: "已清除场地边界，可重新勾画。", aerialReady: (name) => `${name} 的卫星参考视图已就绪。搜索场地或勾画拟安装光伏的区域。`, roughStart: (name) => `当前从 ${name} 附近开始。这只是市场级参考，并非项目地址。`, vertexPlaced: (count) => `已放置第 ${count} 个点。继续添加顶点，或回到第 1 个点闭合边界。`, outlined: (area, count) => `已勾画场地面积：${area}，共 ${count} 个顶点。可拖动编号顶点进行微调。`, aerial: "卫星", road: "道路", siteArea: "光伏候选区域", drawZone: "用铅笔勾画边界并闭合", trace: "勾画区域", finish: "闭合边界", undo: "撤销顶点", clear: "清除", traceHelp: "在屋顶、立面或空地周围依次点击 1、2、3…；放置第 3 个点后，靠近亮色的第 1 点并点击即可闭合。", drawCue: "点击添加顶点", closeCue: "第 1 点已高亮，点击即可闭合", streetView: "街景", streetPreview: "从高亮道路预览", streetEnter: "已进入街景。可使用箭头浏览，或选择返回卫星地图。", streetReturn: "返回卫星地图", streetExit: "已返回卫星地图。", streetUnavailable: "此处没有可用街景，请尝试附近高亮道路。", streetDisabled: "请先搜索地址或放置场地定位点，再进入街景。", outlinedArea: "已勾画光伏区域", points: "个顶点", pegman: "将小人拖到高亮道路以进入完整街景", referenceOnly: "仅作市场参考", editHint: "拖动任意亮色编号顶点即可微调边界" },
  "zh-Hant": { ready: "衛星地圖已就緒。搜尋地址、放置定位點或勾畫區域。", preparing: "地圖仍在載入，請稍後再試。", locating: "正在定位地址…", unavailable: "無法定位，請嘗試完整地址或郵遞區號。", drawStart: "使用鉛筆游標放置編號頂點。放置第 3 個點後，回到第 1 個點即可閉合邊界。", needVertices: "請至少放置三個編號頂點後再完成邊界。", drawCleared: "已清除場地邊界，可重新勾畫。", aerialReady: (name) => `${name} 的衛星參考視圖已就緒。搜尋場地或勾畫擬安裝光伏的區域。`, roughStart: (name) => `目前從 ${name} 附近開始。這只是市場級參考，並非專案地址。`, vertexPlaced: (count) => `已放置第 ${count} 個點。繼續新增頂點，或回到第 1 個點閉合邊界。`, outlined: (area, count) => `已勾畫場地面積：${area}，共 ${count} 個頂點。可拖曳編號頂點進行微調。`, aerial: "衛星", road: "道路", siteArea: "光伏候選區域", drawZone: "用鉛筆勾畫邊界並閉合", trace: "勾畫區域", finish: "閉合邊界", undo: "復原頂點", clear: "清除", traceHelp: "在屋頂、立面或空地周圍依次點擊 1、2、3…；放置第 3 個點後，靠近亮色第 1 點並點擊即可閉合。", drawCue: "點擊新增頂點", closeCue: "第 1 點已高亮，點擊即可閉合", streetView: "街景", streetPreview: "從高亮道路預覽", streetEnter: "已進入街景。可使用箭頭瀏覽，或選擇返回衛星地圖。", streetReturn: "返回衛星地圖", streetExit: "已返回衛星地圖。", streetUnavailable: "此處沒有可用街景，請嘗試附近高亮道路。", streetDisabled: "請先搜尋地址或放置場地定位點，再進入街景。", outlinedArea: "已勾畫光伏區域", points: "個頂點", pegman: "將小人拖到高亮道路以進入完整街景", referenceOnly: "僅作市場參考", editHint: "拖曳任意亮色編號頂點即可微調邊界" },
  fr: { ready: "La vue satellite est prête. Recherchez une adresse, placez un repère ou tracez une zone.", preparing: "La carte se prépare encore. Réessayez dans un instant.", locating: "Localisation de l’adresse…", unavailable: "Localisation indisponible — essayez une adresse ou un code postal complet.", drawStart: "Utilisez le curseur crayon pour placer des sommets numérotés. Après le point 3, revenez au point 1 pour fermer.", needVertices: "Placez au moins trois sommets numérotés avant de fermer le tracé.", drawCleared: "Le tracé du site est effacé. Vous pouvez en créer un autre.", aerialReady: (name) => `La référence aérienne de ${name} est prête. Recherchez un site ou tracez une zone solaire.`, roughStart: (name) => `Départ autour de ${name}. Cette référence de marché n’est pas l’adresse du projet.`, vertexPlaced: (count) => `Point ${count} placé. Ajoutez un sommet ou revenez au point 1 pour fermer.`, outlined: (area, count) => `Zone tracée : ${area} sur ${count} sommets. Faites glisser un point numéroté pour l’affiner.`, aerial: "Aérien", road: "Plan", siteArea: "Zone solaire", drawZone: "Tracez, puis fermez la limite", trace: "Tracer la zone", finish: "Fermer le tracé", undo: "Annuler le point", clear: "Effacer", traceHelp: "Cliquez 1, 2, 3… autour d’un toit, d’une façade ou d’une parcelle. Après le point 3, approchez-vous du point 1 lumineux pour fermer.", drawCue: "Cliquez pour ajouter un sommet", closeCue: "Point 1 prêt — cliquez pour fermer", streetView: "Street View", streetPreview: "Aperçu depuis une voie mise en évidence", streetEnter: "Street View est ouvert. Utilisez les flèches pour explorer ou revenez à la carte aérienne.", streetReturn: "Retour à la carte aérienne", streetExit: "Retour à la carte satellite.", streetUnavailable: "Aucun panorama Street View n’est disponible ici. Essayez une voie proche mise en évidence.", streetDisabled: "Recherchez une adresse ou placez un repère avant d’ouvrir Street View.", outlinedArea: "Zone solaire tracée", points: "points", pegman: "Déposez Pegman sur une voie mise en évidence pour ouvrir Street View", referenceOnly: "Référence de marché", editHint: "Faites glisser un point lumineux pour affiner la limite" },
  ja: { ready: "衛星表示の準備ができました。住所を検索するか、ピンの配置・エリアの描画を行ってください。", preparing: "地図を準備中です。少し待ってからもう一度お試しください。", locating: "住所を検索中…", unavailable: "場所を特定できません。完全な住所または郵便番号を試してください。", drawStart: "ペンカーソルで番号付きの頂点を置きます。3点目の後、1点目に戻ると閉じられます。", needVertices: "輪郭を閉じる前に、少なくとも3つの番号付き頂点を置いてください。", drawCleared: "敷地の輪郭を消去しました。新しいエリアを描画できます。", aerialReady: (name) => `${name} の航空写真の参照表示が準備できました。敷地を検索するか太陽光候補地を描画してください。`, roughStart: (name) => `${name} 周辺から開始します。これは市場レベルの参照で、プロジェクト住所ではありません。`, vertexPlaced: (count) => `ポイント ${count} を配置しました。頂点を追加するか、ポイント 1 に戻って閉じます。`, outlined: (area, count) => `敷地面積：${area}、${count} 頂点。番号付きポイントをドラッグして調整できます。`, aerial: "航空写真", road: "道路", siteArea: "太陽光候補エリア", drawZone: "ペンで境界を描画して閉じる", trace: "エリアを描画", finish: "輪郭を閉じる", undo: "点を戻す", clear: "消去", traceHelp: "屋根、立面、または空地の周りを 1、2、3… とクリックします。3点目の後、明るいポイント1の近くをクリックして閉じます。", drawCue: "クリックして頂点を追加", closeCue: "ポイント1が点灯 — クリックして閉じる", streetView: "ストリートビュー", streetPreview: "ハイライト道路からプレビュー", streetEnter: "ストリートビューを開いています。矢印で確認するか、航空写真に戻ります。", streetReturn: "航空写真に戻る", streetExit: "衛星地図に戻りました。", streetUnavailable: "ここではストリートビューを利用できません。近くのハイライト道路を試してください。", streetDisabled: "ストリートビューを開く前に住所を検索するか、敷地ピンを置いてください。", outlinedArea: "描画した太陽光エリア", points: "点", pegman: "Pegman をハイライト道路にドラッグしてストリートビューを開きます", referenceOnly: "市場参照のみ", editHint: "明るい番号付きポイントをドラッグして境界を調整" },
  es: { ready: "La vista satelital está lista. Busque una dirección, coloque un punto o trace un área.", preparing: "El mapa se está preparando. Vuelva a intentarlo en un momento.", locating: "Localizando dirección…", unavailable: "Ubicación no disponible; pruebe una dirección o código postal completos.", drawStart: "Use el cursor de lápiz para colocar vértices numerados. Después del punto 3, vuelva al punto 1 para cerrar.", needVertices: "Coloque al menos tres vértices numerados antes de cerrar el contorno.", drawCleared: "El contorno del sitio se ha borrado. Puede trazar otra área.", aerialReady: (name) => `La referencia aérea de ${name} está lista. Busque un sitio o trace una zona solar.`, roughStart: (name) => `Comience cerca de ${name}. Esta referencia de mercado no es la dirección del proyecto.`, vertexPlaced: (count) => `Punto ${count} colocado. Añada un vértice o vuelva al punto 1 para cerrar.`, outlined: (area, count) => `Área trazada: ${area} en ${count} vértices. Arrastre un punto numerado para afinarla.`, aerial: "Satélite", road: "Plano", siteArea: "Zona solar", drawZone: "Trace y cierre el límite", trace: "Trazar área", finish: "Cerrar contorno", undo: "Deshacer punto", clear: "Borrar", traceHelp: "Haga clic 1, 2, 3… alrededor de un tejado, una fachada o una parcela. Después del punto 3, acérquese al punto 1 brillante para cerrar.", drawCue: "Haga clic para añadir vértices", closeCue: "Punto 1 preparado — haga clic para cerrar", streetView: "Street View", streetPreview: "Vista previa desde una vía destacada", streetEnter: "Street View está abierto. Use las flechas para explorar o vuelva al mapa aéreo.", streetReturn: "Volver al mapa aéreo", streetExit: "Vuelta al mapa satelital.", streetUnavailable: "No hay un panorama Street View disponible aquí. Pruebe una vía destacada cercana.", streetDisabled: "Busque una dirección o coloque un punto antes de abrir Street View.", outlinedArea: "Área solar trazada", points: "puntos", pegman: "Arrastre Pegman a una vía destacada para abrir Street View", referenceOnly: "Solo referencia de mercado", editHint: "Arrastre un punto luminoso para afinar el límite" },
  it: { ready: "La vista satellitare è pronta. Cerca un indirizzo, posiziona un punto o traccia un’area.", preparing: "La mappa si sta preparando. Riprova tra un istante.", locating: "Localizzazione dell’indirizzo…", unavailable: "Posizione non disponibile: prova un indirizzo o un CAP completo.", drawStart: "Usa il cursore a matita per posizionare vertici numerati. Dopo il punto 3, torna al punto 1 per chiudere.", needVertices: "Posiziona almeno tre vertici numerati prima di chiudere il perimetro.", drawCleared: "Il perimetro del sito è stato cancellato. Puoi tracciarne un altro.", aerialReady: (name) => `Il riferimento aereo di ${name} è pronto. Cerca un sito o traccia una zona solare.`, roughStart: (name) => `Inizio nei pressi di ${name}. Questo riferimento di mercato non è l’indirizzo del progetto.`, vertexPlaced: (count) => `Punto ${count} posizionato. Aggiungi un vertice o torna al punto 1 per chiudere.`, outlined: (area, count) => `Area tracciata: ${area} con ${count} vertici. Trascina un punto numerato per perfezionarla.`, aerial: "Satellitare", road: "Stradale", siteArea: "Zona solare", drawZone: "Traccia e chiudi il perimetro", trace: "Traccia area", finish: "Chiudi perimetro", undo: "Annulla punto", clear: "Cancella", traceHelp: "Fai clic su 1, 2, 3… attorno a un tetto, una facciata o un lotto. Dopo il punto 3, avvicinati al luminoso punto 1 per chiudere.", drawCue: "Fai clic per aggiungere vertici", closeCue: "Punto 1 pronto — fai clic per chiudere", streetView: "Street View", streetPreview: "Anteprima da una strada evidenziata", streetEnter: "Street View è aperto. Usa le frecce per esplorare o torna alla mappa aerea.", streetReturn: "Torna alla mappa aerea", streetExit: "Ritorno alla mappa satellitare.", streetUnavailable: "Nessun panorama Street View disponibile qui. Prova una strada evidenziata vicina.", streetDisabled: "Cerca un indirizzo o posiziona un punto prima di aprire Street View.", outlinedArea: "Area solare tracciata", points: "punti", pegman: "Trascina Pegman su una strada evidenziata per aprire Street View", referenceOnly: "Solo riferimento di mercato", editHint: "Trascina un punto luminoso per affinare il confine" },
};

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
};

type AerialViewState = { center: google.maps.LatLngLiteral; zoom: number; tilt: number; heading: number };

function areaLabel(areaM2: number) {
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(areaM2)} m²`;
}

function countryRestriction(market: Market) {
  if (market.key === "GB") return "gb";
  if (market.key === "CA") return "ca";
  if (market.key === "JP") return "jp";
  return market.shortName !== "EU" ? market.shortName.toLowerCase() : undefined;
}

function pathKey(path: google.maps.LatLngLiteral[]) {
  return path.map((point) => `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`).join("|");
}

function isUsablePath(path: google.maps.LatLngLiteral[] | null | undefined): path is google.maps.LatLngLiteral[] {
  return Boolean(path && path.length >= 3 && path.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180));
}

function distanceMetres(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function closeThresholdMetres(map: google.maps.Map, latitude: number) {
  const zoom = map.getZoom() ?? 17;
  const metresPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return Math.max(1.8, metresPerPixel * 22);
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
}: ProjectLocationMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const draftLineRef = useRef<google.maps.Polyline | null>(null);
  const draftPreviewLineRef = useRef<google.maps.Polyline | null>(null);
  const draftVertexMarkersRef = useRef<google.maps.Marker[]>([]);
  const editVertexMarkersRef = useRef<google.maps.Marker[]>([]);
  const vertexListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const mapListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const draftPathRef = useRef<google.maps.LatLngLiteral[]>([]);
  const streetViewServiceRef = useRef<google.maps.StreetViewService | null>(null);
  const emittedAreaKeyRef = useRef("");
  const drawingActiveRef = useRef(false);
  const closeReadyRef = useRef(false);
  const closingRef = useRef(false);
  const streetViewOpenRef = useRef(false);
  const aerialViewRef = useRef<AerialViewState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<SiteAreaSelection | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const text = MAP_TEXT[language];
  const [status, setStatus] = useState(text.ready);
  const [mapMode, setMapMode] = useState<"hybrid" | "roadmap">("hybrid");
  const [drawingActive, setDrawingActive] = useState(false);
  const [drawingPointCount, setDrawingPointCount] = useState(0);
  const [closeReady, setCloseReady] = useState(false);
  const [area, setArea] = useState<SiteAreaSelection | null>(initialArea ?? null);
  const [streetViewOpen, setStreetViewOpen] = useState(false);

  const clearVertexListeners = useCallback(() => {
    vertexListenersRef.current.forEach((listener) => listener.remove());
    vertexListenersRef.current = [];
  }, []);

  const clearMapListeners = useCallback(() => {
    mapListenersRef.current.forEach((listener) => listener.remove());
    mapListenersRef.current = [];
  }, []);

  const clearDraftPresentation = useCallback(() => {
    draftLineRef.current?.setMap(null);
    draftLineRef.current = null;
    draftPreviewLineRef.current?.setMap(null);
    draftPreviewLineRef.current = null;
    draftVertexMarkersRef.current.forEach((marker) => marker.setMap(null));
    draftVertexMarkersRef.current = [];
  }, []);

  const clearEditPresentation = useCallback(() => {
    editVertexMarkersRef.current.forEach((marker) => marker.setMap(null));
    editVertexMarkersRef.current = [];
    clearVertexListeners();
  }, [clearVertexListeners]);

  const publishSelection = useCallback((selection: SiteAreaSelection) => {
    emittedAreaKeyRef.current = pathKey(selection.path);
    setArea(selection);
    onAreaChange(selection);
    setStatus(text.outlined(areaLabel(selection.areaM2), selection.path.length));
  }, [onAreaChange, text]);

  const queueAreaUpdate = useCallback((polygon: google.maps.Polygon, immediate = false) => {
    if (!window.google?.maps) return;
    const path = polygon.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }));
    if (!isUsablePath(path)) return;
    pendingSelectionRef.current = { areaM2: window.google.maps.geometry.spherical.computeArea(polygon.getPath()), path };
    const flush = () => {
      animationFrameRef.current = null;
      const selection = pendingSelectionRef.current;
      if (selection) publishSelection(selection);
    };
    if (immediate) {
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      flush();
      return;
    }
    if (animationFrameRef.current === null) animationFrameRef.current = window.requestAnimationFrame(flush);
  }, [publishSelection]);

  const vertexIcon = useCallback((index: number, emphasised = false) => ({
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: index === 0 ? (emphasised ? "#36D7FF" : "#8DE7FF") : "#FFE46E",
    fillOpacity: 1,
    strokeColor: emphasised ? "#FFFFFF" : "#173C35",
    strokeOpacity: 1,
    strokeWeight: emphasised ? 3.5 : 2.6,
    scale: emphasised ? 15 : index === 0 ? 13.5 : 12,
    labelOrigin: new window.google.maps.Point(0, 0),
  }), []);

  const renderEditVertices = useCallback((polygon: google.maps.Polygon) => {
    if (!mapRef.current || !window.google?.maps) return;
    clearEditPresentation();
    const path = polygon.getPath();
    path.getArray().forEach((point, index) => {
      const marker = new window.google.maps.Marker({
        map: mapRef.current!,
        position: point,
        title: `${text.editHint} · ${index + 1}`,
        draggable: true,
        clickable: true,
        label: { text: String(index + 1), color: "#173C35", fontSize: "12px", fontWeight: "800" },
        icon: vertexIcon(index),
        zIndex: 24 + index,
      });
      vertexListenersRef.current.push(
        marker.addListener("drag", () => {
          const position = marker.getPosition();
          if (!position) return;
          path.setAt(index, position);
          queueAreaUpdate(polygon);
        }),
        marker.addListener("dragend", () => {
          const position = marker.getPosition();
          if (!position) return;
          path.setAt(index, position);
          queueAreaUpdate(polygon, true);
        }),
      );
      editVertexMarkersRef.current.push(marker);
    });
  }, [clearEditPresentation, queueAreaUpdate, text.editHint, vertexIcon]);

  const createClosedPolygon = useCallback((points: google.maps.LatLngLiteral[], announce = true) => {
    if (!mapRef.current || !window.google?.maps || !isUsablePath(points)) return null;
    polygonRef.current?.setMap(null);
    clearEditPresentation();
    const polygon = new window.google.maps.Polygon({
      map: mapRef.current,
      paths: points,
      fillColor: "#234E40",
      fillOpacity: 0.17,
      strokeColor: "#234E40",
      strokeOpacity: 0.95,
      strokeWeight: 2.8,
      editable: false,
      draggable: false,
      clickable: false,
      zIndex: 8,
    });
    polygonRef.current = polygon;
    renderEditVertices(polygon);
    const selection = { areaM2: window.google.maps.geometry.spherical.computeArea(polygon.getPath()), path: points };
    if (announce) publishSelection(selection);
    else setArea(selection);
    return polygon;
  }, [clearEditPresentation, publishSelection, renderEditVertices]);

  const restoreArea = useCallback(() => {
    if (!isUsablePath(initialArea?.path) || !mapRef.current || !window.google?.maps) return;
    const nextKey = pathKey(initialArea.path);
    const currentPath = polygonRef.current?.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() })) ?? null;
    if (currentPath && pathKey(currentPath) === nextKey) return;
    if (emittedAreaKeyRef.current === nextKey && currentPath) return;
    createClosedPolygon(initialArea.path, false);
    emittedAreaKeyRef.current = nextKey;
  }, [createClosedPolygon, initialArea]);

  const exitStreetView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getStreetView().setVisible(false);
    streetViewOpenRef.current = false;
    setStreetViewOpen(false);
    const aerialView = aerialViewRef.current;
    if (aerialView) {
      map.setMapTypeId(window.google?.maps.MapTypeId.HYBRID ?? "hybrid");
      map.setCenter(aerialView.center);
      map.setZoom(aerialView.zoom);
      map.setTilt(aerialView.tilt);
      map.setHeading(aerialView.heading);
      setMapMode("hybrid");
    }
    setStatus(text.streetExit);
  }, [text.streetExit]);

  const placeMarker = useCallback((coordinates: google.maps.LatLngLiteral, label: string, notify = true) => {
    if (!mapRef.current || !window.google?.maps) return;
    if (streetViewOpenRef.current) exitStreetView();
    markerRef.current?.setMap(null);
    markerRef.current = new window.google.maps.Marker({
      map: mapRef.current,
      position: coordinates,
      title: label,
      animation: window.google.maps.Animation.DROP,
    });
    mapRef.current.panTo(coordinates);
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 0, 18));
    setStatus(label);
    if (notify) onLocationChange({ label, coordinates });
  }, [exitStreetView, onLocationChange]);

  const restoreInitialLocation = useCallback(() => {
    if (!initialLocation || !mapRef.current) return;
    const current = markerRef.current?.getPosition();
    if (current && Math.abs(current.lat() - initialLocation.coordinates.lat) < 0.000001 && Math.abs(current.lng() - initialLocation.coordinates.lng) < 0.000001) return;
    placeMarker(initialLocation.coordinates, initialLocation.label, false);
  }, [initialLocation, placeMarker]);

  const finishDrawing = useCallback(() => {
    if (!mapRef.current || !window.google?.maps || draftPathRef.current.length < 3) {
      setStatus(text.needVertices);
      return;
    }
    closingRef.current = true;
    const points = [...draftPathRef.current];
    drawingActiveRef.current = false;
    setDrawingActive(false);
    setDrawingPointCount(0);
    setCloseReady(false);
    closeReadyRef.current = false;
    mapRef.current.setOptions({ draggableCursor: null, draggingCursor: null });
    clearDraftPresentation();
    createClosedPolygon(points, true);
    window.setTimeout(() => { closingRef.current = false; }, 0);
  }, [clearDraftPresentation, createClosedPolygon, text.needVertices]);

  const syncDraftFirstMarker = useCallback((emphasised: boolean) => {
    const firstMarker = draftVertexMarkersRef.current[0];
    if (!firstMarker || !window.google?.maps) return;
    firstMarker.setIcon(vertexIcon(0, emphasised));
    firstMarker.setTitle(emphasised ? text.closeCue : "Point 1");
    firstMarker.setZIndex(emphasised ? 40 : 20);
  }, [text.closeCue, vertexIcon]);

  const addDraftPoint = useCallback((point: google.maps.LatLngLiteral) => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    draftPathRef.current = [...draftPathRef.current, point];
    draftLineRef.current?.setPath(draftPathRef.current);
    const pointNumber = draftPathRef.current.length;
    const marker = new window.google.maps.Marker({
      map,
      position: point,
      title: pointNumber === 1 ? "Point 1" : `Point ${pointNumber}`,
      label: { text: String(pointNumber), color: "#173C35", fontSize: "12px", fontWeight: "800" },
      icon: vertexIcon(pointNumber - 1),
      clickable: pointNumber === 1,
      zIndex: 20 + pointNumber,
    });
    if (pointNumber === 1) {
      vertexListenersRef.current.push(marker.addListener("click", () => {
        if (drawingActiveRef.current && draftPathRef.current.length >= 3) finishDrawing();
      }));
    }
    draftVertexMarkersRef.current.push(marker);
    setDrawingPointCount(pointNumber);
    setStatus(text.vertexPlaced(pointNumber));
  }, [finishDrawing, text, vertexIcon]);

  const startDrawing = useCallback(() => {
    if (drawingActiveRef.current) return;
    if (!mapRef.current || !window.google?.maps) {
      setStatus(text.preparing);
      return;
    }
    if (streetViewOpenRef.current) exitStreetView();
    clearEditPresentation();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    clearDraftPresentation();
    draftPathRef.current = [];
    emittedAreaKeyRef.current = "";
    onAreaChange(null);
    setArea(null);
    setDrawingPointCount(0);
    setCloseReady(false);
    closeReadyRef.current = false;
    draftLineRef.current = new window.google.maps.Polyline({
      map: mapRef.current,
      path: [],
      strokeOpacity: 0,
      clickable: false,
      icons: [{ icon: { path: "M 0,-1 0,1", strokeColor: "#173C35", strokeOpacity: 0.92, strokeWeight: 3.3, scale: 3 }, offset: "0", repeat: "13px" }],
      zIndex: 14,
    });
    draftPreviewLineRef.current = new window.google.maps.Polyline({
      map: mapRef.current,
      path: [],
      strokeColor: "#36D7FF",
      strokeOpacity: 0.92,
      strokeWeight: 2.4,
      clickable: false,
      zIndex: 15,
    });
    mapRef.current.setOptions({ draggableCursor: "crosshair", draggingCursor: "grabbing" });
    drawingActiveRef.current = true;
    setDrawingActive(true);
    setStatus(text.drawStart);
  }, [clearDraftPresentation, clearEditPresentation, exitStreetView, onAreaChange, text.drawStart, text.preparing]);

  const undoDraftPoint = useCallback(() => {
    if (!drawingActiveRef.current || draftPathRef.current.length === 0) return;
    draftPathRef.current = draftPathRef.current.slice(0, -1);
    draftLineRef.current?.setPath(draftPathRef.current);
    draftPreviewLineRef.current?.setPath([]);
    draftVertexMarkersRef.current.pop()?.setMap(null);
    clearVertexListeners();
    const firstMarker = draftVertexMarkersRef.current[0];
    if (firstMarker) vertexListenersRef.current.push(firstMarker.addListener("click", () => {
      if (drawingActiveRef.current && draftPathRef.current.length >= 3) finishDrawing();
    }));
    setDrawingPointCount(draftPathRef.current.length);
    setCloseReady(false);
    closeReadyRef.current = false;
    syncDraftFirstMarker(false);
    setStatus(draftPathRef.current.length ? text.vertexPlaced(draftPathRef.current.length) : text.drawStart);
  }, [clearVertexListeners, finishDrawing, syncDraftFirstMarker, text]);

  const clearArea = useCallback(() => {
    clearEditPresentation();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    clearDraftPresentation();
    draftPathRef.current = [];
    drawingActiveRef.current = false;
    setDrawingActive(false);
    setDrawingPointCount(0);
    setCloseReady(false);
    closeReadyRef.current = false;
    mapRef.current?.setOptions({ draggableCursor: null, draggingCursor: null });
    emittedAreaKeyRef.current = "";
    setArea(null);
    onAreaChange(null);
    setStatus(text.drawCleared);
  }, [clearDraftPresentation, clearEditPresentation, onAreaChange, text.drawCleared]);

  const locate = useCallback((address: string) => {
    const geocoder = geocoderRef.current;
    if (!geocoder || !address.trim()) return;
    setStatus(text.locating);
    const country = countryRestriction(market);
    const statedCountry = Object.entries(COUNTRY_NAME_TERMS).find(([term]) => address.toLowerCase().includes(term))?.[1];
    if (country && statedCountry && statedCountry !== country) {
      setStatus(text.unavailable);
      return;
    }
    const request: google.maps.GeocoderRequest = country ? { address, componentRestrictions: { country } } : { address };
    geocoder.geocode(request, (results, geocodeStatus) => {
      if (geocodeStatus !== "OK" || !results?.[0]) {
        setStatus(text.unavailable);
        return;
      }
      const result = results[0];
      if (result.types.includes("country")) {
        setStatus(text.unavailable);
        return;
      }
      const resultCountry = result.address_components?.find((component) => component.types.includes("country"))?.short_name?.toLowerCase();
      if (country && resultCountry && resultCountry !== country) {
        setStatus(text.unavailable);
        return;
      }
      placeMarker({ lat: result.geometry.location.lat(), lng: result.geometry.location.lng() }, result.formatted_address);
    });
  }, [market, placeMarker, text]);

  const switchMapMode = useCallback((nextMode: "hybrid" | "roadmap") => {
    if (!mapRef.current || !window.google?.maps) return;
    if (streetViewOpenRef.current) exitStreetView();
    mapRef.current.setMapTypeId(nextMode === "hybrid" ? window.google.maps.MapTypeId.HYBRID : window.google.maps.MapTypeId.ROADMAP);
    mapRef.current.setTilt(0);
    mapRef.current.setHeading(0);
    setMapMode(nextMode);
  }, [exitStreetView]);

  const toggleStreetView = useCallback(() => {
    const map = mapRef.current;
    const service = streetViewServiceRef.current;
    if (!map || !service || !window.google?.maps) return;
    if (streetViewOpenRef.current) {
      exitStreetView();
      return;
    }
    const position = markerRef.current?.getPosition();
    if (!position) {
      setStatus(text.streetDisabled);
      return;
    }
    const center = map.getCenter();
    if (center) aerialViewRef.current = { center: { lat: center.lat(), lng: center.lng() }, zoom: map.getZoom() ?? market.zoom, tilt: map.getTilt() ?? 0, heading: map.getHeading() ?? 0 };
    setStatus("Looking for an available Street View panorama…");
    service.getPanorama({ location: position, radius: 120 }, (data, streetViewStatus) => {
      if (streetViewStatus === window.google?.maps.StreetViewStatus.OK && data?.location?.latLng) {
        const panorama = map.getStreetView();
        panorama.setPosition(data.location.latLng);
        panorama.setPov({ heading: 0, pitch: 0 });
        panorama.setVisible(true);
        streetViewOpenRef.current = true;
        setStreetViewOpen(true);
        setStatus(text.streetEnter);
      } else {
        setStatus(text.streetUnavailable);
      }
    });
  }, [exitStreetView, market.zoom, text]);

  const onMapReady = useCallback((map: google.maps.Map) => {
    clearMapListeners();
    mapRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();
    streetViewServiceRef.current = new window.google.maps.StreetViewService();
    map.setOptions({
      mapTypeId: window.google.maps.MapTypeId.HYBRID,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: true,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: "cooperative",
      streetViewControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
      fullscreenControlOptions: { position: window.google.maps.ControlPosition.RIGHT_TOP },
    });

    mapListenersRef.current.push(map.getStreetView().addListener("visible_changed", () => {
      const visible = map.getStreetView().getVisible();
      streetViewOpenRef.current = visible;
      setStreetViewOpen(visible);
    }));

    if (searchInputRef.current) {
      autocompleteRef.current?.unbind("bounds");
      const country = countryRestriction(market);
      autocompleteRef.current = new window.google.maps.places.Autocomplete(searchInputRef.current, country ? { fields: ["formatted_address", "geometry", "name"], componentRestrictions: { country } } : { fields: ["formatted_address", "geometry", "name"] });
      autocompleteRef.current.bindTo("bounds", map);
      mapListenersRef.current.push(autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place?.geometry?.location) return;
        placeMarker({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }, place.formatted_address ?? place.name ?? "Selected address");
      }));
    }

    mapListenersRef.current.push(map.addListener("mousemove", (event: google.maps.MapMouseEvent) => {
      if (!drawingActiveRef.current || !event.latLng) return;
      const path = draftPathRef.current;
      if (!path.length) return;
      const pointer = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      const first = path[0]!;
      const isReady = path.length >= 3 && distanceMetres(pointer, first) <= closeThresholdMetres(map, first.lat);
      const endpoint = isReady ? first : pointer;
      draftPreviewLineRef.current?.setPath([path[path.length - 1]!, endpoint]);
      if (isReady !== closeReadyRef.current) {
        closeReadyRef.current = isReady;
        setCloseReady(isReady);
        syncDraftFirstMarker(isReady);
        setStatus(isReady ? text.closeCue : text.drawCue);
      }
    }));

    mapListenersRef.current.push(map.addListener("click", (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      if (drawingActiveRef.current) {
        if (closingRef.current) return;
        if (closeReadyRef.current && draftPathRef.current.length >= 3) {
          finishDrawing();
          return;
        }
        addDraftPoint({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        return;
      }
      if (!geocoderRef.current) return;
      geocoderRef.current.geocode({ location: event.latLng }, (results, geocodeStatus) => {
        const label = geocodeStatus === "OK" && results?.[0] ? results[0].formatted_address : `${event.latLng?.lat().toFixed(5)}, ${event.latLng?.lng().toFixed(5)}`;
        placeMarker({ lat: event.latLng!.lat(), lng: event.latLng!.lng() }, label);
      });
    }));

    restoreInitialLocation();
    restoreArea();
  }, [addDraftPoint, clearMapListeners, finishDrawing, market, placeMarker, restoreArea, restoreInitialLocation, syncDraftFirstMarker, text.closeCue, text.drawCue]);

  useEffect(() => {
    if (!mapRef.current) return;
    markerRef.current?.setMap(null);
    mapRef.current.panTo(market.coordinates);
    mapRef.current.setZoom(market.zoom);
    mapRef.current.setMapTypeId(window.google?.maps.MapTypeId.HYBRID ?? "hybrid");
    mapRef.current.getStreetView().setVisible(false);
    streetViewOpenRef.current = false;
    setStreetViewOpen(false);
    mapRef.current.setTilt(0);
    mapRef.current.setHeading(0);
    aerialViewRef.current = null;
    const country = countryRestriction(market);
    autocompleteRef.current?.setComponentRestrictions(country ? { country } : null);
    setMapMode("hybrid");
    setQuery("");
    setStatus(text.aerialReady(market.name));
  }, [market, text]);

  useEffect(() => {
    restoreInitialLocation();
    restoreArea();
  }, [restoreArea, restoreInitialLocation]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    clearMapListeners();
    clearVertexListeners();
    clearDraftPresentation();
    clearEditPresentation();
    polygonRef.current?.setMap(null);
    markerRef.current?.setMap(null);
    autocompleteRef.current?.unbind("bounds");
  }, [clearDraftPresentation, clearEditPresentation, clearMapListeners, clearVertexListeners]);

  const showReference = !initialLocation;
  const referenceLabel = market.referenceLabel ?? market.name;
  const tracePrompt = closeReady ? text.closeCue : text.drawCue;

  return (
    <section className={`location-map-shell location-map-shell--studio ${drawingActive ? "is-tracing" : ""}`} aria-label={searchLabel}>
      <MapView className="location-map" initialCenter={market.coordinates} initialZoom={market.zoom} onMapReady={onMapReady} />
      <div className="site-map-search">
        <Search size={17} aria-hidden="true" />
        <input ref={searchInputRef} aria-label={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") locate(query); }} placeholder={placeholder} />
        <button type="button" onClick={() => locate(query)} disabled={!query.trim()}>{locateLabel}</button>
      </div>

      <div className="site-map-mode-control" aria-label="Map layers">
        <button type="button" className={mapMode === "hybrid" ? "is-active" : ""} onClick={() => switchMapMode("hybrid")}><Satellite size={14} /> {text.aerial}</button>
        <button type="button" className={mapMode === "roadmap" ? "is-active" : ""} onClick={() => switchMapMode("roadmap")}><Navigation size={14} /> {text.road}</button>
      </div>

      {showReference && <div className="site-map-reference" aria-live="polite"><span><MapPin size={14} /></span><div><small>{text.referenceOnly}</small><b>{referenceLabel}</b><p>{text.roughStart(referenceLabel)}</p></div></div>}

      <div className="site-map-tools">
        <div className={`site-map-tool-card ${drawingActive ? "is-drawing" : ""}`}>
          <div className="site-map-tool-heading"><span><Ruler size={15} /></span><div><b>{text.siteArea}</b><small>{text.drawZone}</small></div></div>
          <div className={`site-map-tool-actions ${drawingActive ? "is-drawing" : ""}`}>
            <button type="button" className={drawingActive ? "is-active" : ""} onClick={drawingActive ? finishDrawing : startDrawing}><Pencil size={14} /> {drawingActive ? text.finish : text.trace}</button>
            {drawingActive && <button type="button" className="is-quiet" onClick={undoDraftPoint} disabled={drawingPointCount === 0}><Undo2 size={13} /> {text.undo}</button>}
            <button type="button" className="is-quiet" onClick={clearArea} disabled={!area && !drawingActive}>{text.clear}</button>
          </div>
          {drawingActive && <div className={`site-trace-progress ${closeReady ? "is-close-ready" : ""}`} aria-live="polite"><span>{drawingPointCount}</span><b>{text.points}</b><i>{tracePrompt}</i></div>}
          <p className="site-map-trace-help">{text.traceHelp}</p>
        </div>
        <button type="button" className={`site-street-view ${streetViewOpen ? "is-active" : ""}`} onClick={toggleStreetView}><Eye size={15} /><span><b>{streetViewOpen ? text.streetReturn : text.streetView}</b><small>{streetViewOpen ? text.streetExit : text.streetPreview}</small></span></button>
      </div>

      {drawingActive && <div className={`site-draw-cue ${closeReady ? "is-close-ready" : ""}`}><Pencil size={15} /><span>{tracePrompt}</span></div>}
      {area && <div className="site-area-readout" aria-live="polite"><span><Ruler size={16} /></span><div><small>{text.outlinedArea}</small><strong>{areaLabel(area.areaM2)}</strong></div><em>{area.path.length} {text.points}</em><p>{text.editHint}</p></div>}
      <div className="site-map-status"><span><MapPin size={14} aria-hidden="true" /> {status}</span><span><Crosshair size={14} aria-hidden="true" /> {text.pegman}</span></div>
    </section>
  );
}
