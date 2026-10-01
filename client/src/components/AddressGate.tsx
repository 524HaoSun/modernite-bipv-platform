import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, Loader2, MapPin, MapPinned, Search } from "lucide-react";
import { placeDetails, placesAutocomplete, type PlaceSuggestion } from "@/lib/google-maps";
import { countryRestriction, geocodeLanguage, searchAddresses, useMapsKey, type AddressMatch, type Market } from "./ProjectLocationMap";

type Language = "en" | "zh" | "zh-Hant" | "fr" | "ja" | "es" | "it";

const TEXT: Record<Language, { eyebrow: string; title: string; body: string; search: string; searching: string; noMatch: string; otherCountry: string; choose: string; precise: string; area: string; browseMap: string; next: string; examples: string }> = {
  en: { eyebrow: "Find the property", title: "Enter a postcode or address", body: "We match it with Google Maps, then open the satellite view so you can tap the exact building.", search: "Find", searching: "Matching the address…", noMatch: "No match found. Try a full postcode or add the street and town.", otherCountry: "That address is outside the selected market. Go back one step to change the market.", choose: "Several places match — choose one:", precise: "Exact address", area: "Postcode / area", browseMap: "No address? Pick the spot on the map", next: "Next: tap your building on the satellite view", examples: "Try" },
  zh: { eyebrow: "找到项目房屋", title: "输入邮编或地址", body: "系统会先用谷歌地图匹配地址，再打开卫星图，由你点选具体是哪一栋建筑。", search: "查找", searching: "正在匹配地址…", noMatch: "没有找到匹配的地址。请输入完整邮编，或补充街道和城市。", otherCountry: "这个地址不在当前选择的市场内，请返回上一步更换市场。", choose: "匹配到多个地点，请选择：", precise: "精确到门牌", area: "邮编 / 区域", browseMap: "没有具体地址？直接在地图上选点", next: "下一步：在卫星图上点选你的建筑", examples: "试试" },
  "zh-Hant": { eyebrow: "找到專案房屋", title: "輸入郵遞區號或地址", body: "系統會先用 Google 地圖比對地址，再開啟衛星圖，由你點選具體是哪一棟建築。", search: "查找", searching: "正在比對地址…", noMatch: "找不到相符的地址。請輸入完整郵遞區號，或補充街道和城市。", otherCountry: "此地址不在目前選擇的市場內，請返回上一步更換市場。", choose: "找到多個地點，請選擇：", precise: "精確到門牌", area: "郵遞區號 / 區域", browseMap: "沒有具體地址？直接在地圖上選點", next: "下一步：在衛星圖上點選你的建築", examples: "試試" },
  fr: { eyebrow: "Trouver le bien", title: "Saisissez un code postal ou une adresse", body: "Nous la localisons avec Google Maps, puis la vue satellite s’ouvre pour que vous touchiez le bâtiment exact.", search: "Rechercher", searching: "Recherche de l’adresse…", noMatch: "Aucun résultat. Saisissez un code postal complet ou ajoutez la rue et la ville.", otherCountry: "Cette adresse est hors du marché choisi. Revenez à l’étape précédente pour changer de marché.", choose: "Plusieurs lieux correspondent — choisissez :", precise: "Adresse exacte", area: "Code postal / secteur", browseMap: "Pas d’adresse ? Choisissez le point sur la carte", next: "Ensuite : touchez votre bâtiment sur la vue satellite", examples: "Essayez" },
  ja: { eyebrow: "物件を探す", title: "郵便番号または住所を入力", body: "Google マップで住所を照合し、衛星画像で対象の建物をタップして選びます。", search: "検索", searching: "住所を照合しています…", noMatch: "一致する住所がありません。郵便番号を正確に入力するか、町名や市区町村を追加してください。", otherCountry: "この住所は選択中の市場の対象外です。前のステップで市場を変更してください。", choose: "複数の候補があります。選んでください：", precise: "番地まで一致", area: "郵便番号 / 地域", browseMap: "住所がない場合は地図で地点を選ぶ", next: "次へ：衛星画像で建物をタップ", examples: "例" },
  es: { eyebrow: "Encontrar la vivienda", title: "Introduce un código postal o una dirección", body: "La buscamos con Google Maps y después se abre la vista satélite para que toques el edificio exacto.", search: "Buscar", searching: "Buscando la dirección…", noMatch: "Sin resultados. Introduce el código postal completo o añade la calle y la ciudad.", otherCountry: "Esa dirección está fuera del mercado elegido. Vuelve al paso anterior para cambiarlo.", choose: "Hay varios lugares posibles — elige uno:", precise: "Dirección exacta", area: "Código postal / zona", browseMap: "¿Sin dirección? Elige el punto en el mapa", next: "Después: toca tu edificio en la vista satélite", examples: "Prueba" },
  it: { eyebrow: "Trova l’immobile", title: "Inserisci un CAP o un indirizzo", body: "Lo cerchiamo con Google Maps, poi si apre la vista satellitare per toccare l’edificio esatto.", search: "Cerca", searching: "Ricerca dell’indirizzo…", noMatch: "Nessun risultato. Inserisci il CAP completo o aggiungi via e città.", otherCountry: "L’indirizzo è fuori dal mercato scelto. Torna al passo precedente per cambiarlo.", choose: "Più luoghi corrispondono — scegline uno:", precise: "Indirizzo esatto", area: "CAP / zona", browseMap: "Nessun indirizzo? Scegli il punto sulla mappa", next: "Poi: tocca il tuo edificio nella vista satellitare", examples: "Prova" },
};

const EXAMPLES: Partial<Record<Market["key"], string[]>> = {
  GB: ["NG9 2QN", "10 Downing Street, London"],
  CA: ["M5V 3L9", "301 Front St W, Toronto"],
  JP: ["100-0005", "東京都千代田区丸の内1丁目"],
};

export function AddressGate({ language, market, placeholder, onSelect, onBrowseMap }: {
  language: Language;
  market: Market;
  placeholder: string;
  onSelect: (match: AddressMatch) => void;
  onBrowseMap: () => void;
}) {
  const t = TEXT[language] ?? TEXT.en;
  const { key } = useMapsKey();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{ status: "idle" | "searching" | "none" | "other-country" | "choose"; matches: AddressMatch[] }>({ status: "idle", matches: [] });
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const sessionRef = useRef("");
  const typedRef = useRef(false);

  useEffect(() => {
    const input = query.trim();
    if (!key || !typedRef.current || input.length < 3) return setSuggestions([]);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      sessionRef.current ||= crypto.randomUUID();
      placesAutocomplete(key, input, { regionCode: countryRestriction(market), language: geocodeLanguage(language, market), sessionToken: sessionRef.current, signal: controller.signal })
        .then((items) => { setSuggestions(items.slice(0, 5)); setActive(-1); })
        .catch(() => setSuggestions([]));
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, key, market, language]);

  const pickSuggestion = async (suggestion: PlaceSuggestion) => {
    typedRef.current = false;
    setQuery(suggestion.text);
    setSuggestions([]);
    setState({ status: "searching", matches: [] });
    const match = key ? await placeDetails(key, suggestion.placeId, sessionRef.current, geocodeLanguage(language, market)).catch(() => null) : null;
    sessionRef.current = "";
    if (match) return onSelect({ ...match, label: match.label || suggestion.text });
    void run(suggestion.text);
  };

  const run = async (value = query) => {
    if (!value.trim()) return;
    typedRef.current = false;
    setSuggestions([]);
    setQuery(value);
    setState({ status: "searching", matches: [] });
    const result = await searchAddresses(value, market, language, key);
    if (result === "other-country") return setState({ status: "other-country", matches: [] });
    if (!result.length) return setState({ status: "none", matches: [] });
    if (result.length === 1) return onSelect(result[0]!);
    setState({ status: "choose", matches: result });
  };

  const searching = state.status === "searching";
  return (
    <section className="address-gate" aria-live="polite">
      <div className="address-gate__card">
        <p className="mini-label"><MapPinned size={13} /> {t.eyebrow}</p>
        <h2>{t.title}</h2>
        <p className="address-gate__body">{t.body}</p>
        <form className="address-gate__search" onSubmit={(event) => { event.preventDefault(); if (active >= 0 && suggestions[active]) void pickSuggestion(suggestions[active]!); else void run(); }}>
          <Search size={19} aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => { typedRef.current = true; setQuery(event.target.value); }}
            onKeyDown={(event) => {
              if (!suggestions.length) return;
              if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % suggestions.length); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1)); }
              else if (event.key === "Escape") setSuggestions([]);
            }}
            placeholder={placeholder}
            aria-label={t.title}
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls="address-gate-suggestions"
            enterKeyHint="search"
            autoComplete="off"
          />
          <button type="submit" className="button-primary" disabled={!query.trim() || searching}>{searching ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} {t.search}</button>
          {suggestions.length > 0 && <ul className="address-gate__suggestions" id="address-gate-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => <li key={suggestion.placeId} role="option" aria-selected={index === active}>
              <button type="button" className={index === active ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => void pickSuggestion(suggestion)}>
                {suggestion.precise ? <Building2 size={15} /> : <MapPin size={15} />}
                <span><b>{suggestion.main}</b><small>{suggestion.secondary}</small></span>
              </button>
            </li>)}
            <li className="address-gate__powered" aria-hidden="true">Google</li>
          </ul>}
        </form>
        {state.status === "idle" && EXAMPLES[market.key] && <div className="address-gate__examples"><span>{t.examples}</span>{EXAMPLES[market.key]!.map((example) => <button type="button" key={example} onClick={() => void run(example)}>{example}</button>)}</div>}
        {searching && <p className="address-gate__note"><Loader2 size={14} className="spin" /> {t.searching}</p>}
        {state.status === "none" && <p className="address-gate__note is-warning">{t.noMatch}</p>}
        {state.status === "other-country" && <p className="address-gate__note is-warning">{t.otherCountry}</p>}
        {state.status === "choose" && <div className="address-gate__matches">
          <p>{t.choose}</p>
          {state.matches.map((match) => <button type="button" key={`${match.coordinates.lat},${match.coordinates.lng},${match.label}`} onClick={() => onSelect(match)}>
            {match.precise ? <Building2 size={16} /> : <MapPin size={16} />}
            <span>{match.label}</span>
            <em>{match.precise ? t.precise : t.area}</em>
            <ArrowRight size={15} />
          </button>)}
        </div>}
        <div className="address-gate__footer">
          <span><Building2 size={14} /> {t.next}</span>
          <button type="button" className="button-quiet" onClick={onBrowseMap}>{t.browseMap}</button>
        </div>
      </div>
    </section>
  );
}
