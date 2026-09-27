import { useEffect, useRef, useState } from "react";
import { Check, Globe2, Navigation } from "lucide-react";
import { MapView } from "./Map";
import type { LatLng, Region } from "../../../types/solar";
import { COVERAGE_COUNTRY_GEOJSON } from "../data/coverage-countries";

export type CoverageCountry = {
  id: string;
  region: Region;
  title: string;
  flag: string;
  center: LatLng;
  zoom: number;
  iso: string;
};

// Every map polygon in `coverage-countries.ts` has an entry here. The location
// picker deliberately uses one world map; the dropdown is an accessible shortcut,
// not a separate regional map or a second selection step.
export const COVERAGE_COUNTRIES: CoverageCountry[] = [
  { id: "GB", region: "UK", title: "United Kingdom", flag: "🇬🇧", center: { lat: 54.4, lng: -2.8 }, zoom: 6, iso: "GBR" },
  { id: "IE", region: "EU", title: "Ireland", flag: "🇮🇪", center: { lat: 53.3, lng: -8.0 }, zoom: 7, iso: "IRL" },
  { id: "AT", region: "EU", title: "Austria", flag: "🇦🇹", center: { lat: 47.6, lng: 13.3 }, zoom: 7, iso: "AUT" },
  { id: "BE", region: "EU", title: "Belgium", flag: "🇧🇪", center: { lat: 50.7, lng: 4.6 }, zoom: 7, iso: "BEL" },
  { id: "BG", region: "EU", title: "Bulgaria", flag: "🇧🇬", center: { lat: 42.7, lng: 25.5 }, zoom: 7, iso: "BGR" },
  { id: "HR", region: "EU", title: "Croatia", flag: "🇭🇷", center: { lat: 45.2, lng: 15.6 }, zoom: 7, iso: "HRV" },
  { id: "CY", region: "EU", title: "Cyprus", flag: "🇨🇾", center: { lat: 35.1, lng: 33.3 }, zoom: 8, iso: "CYP" },
  { id: "CZ", region: "EU", title: "Czechia", flag: "🇨🇿", center: { lat: 49.8, lng: 15.5 }, zoom: 7, iso: "CZE" },
  { id: "DK", region: "EU", title: "Denmark", flag: "🇩🇰", center: { lat: 56.1, lng: 10.1 }, zoom: 7, iso: "DNK" },
  { id: "EE", region: "EU", title: "Estonia", flag: "🇪🇪", center: { lat: 58.6, lng: 25.0 }, zoom: 7, iso: "EST" },
  { id: "FI", region: "EU", title: "Finland", flag: "🇫🇮", center: { lat: 64.5, lng: 26.0 }, zoom: 6, iso: "FIN" },
  { id: "FR", region: "EU", title: "France", flag: "🇫🇷", center: { lat: 46.5, lng: 2.3 }, zoom: 6, iso: "FRA" },
  { id: "DE", region: "EU", title: "Germany", flag: "🇩🇪", center: { lat: 51.2, lng: 10.4 }, zoom: 6, iso: "DEU" },
  { id: "GR", region: "EU", title: "Greece", flag: "🇬🇷", center: { lat: 39.1, lng: 21.8 }, zoom: 7, iso: "GRC" },
  { id: "HU", region: "EU", title: "Hungary", flag: "🇭🇺", center: { lat: 47.2, lng: 19.5 }, zoom: 7, iso: "HUN" },
  { id: "IT", region: "EU", title: "Italy", flag: "🇮🇹", center: { lat: 42.8, lng: 12.6 }, zoom: 6, iso: "ITA" },
  { id: "LV", region: "EU", title: "Latvia", flag: "🇱🇻", center: { lat: 56.9, lng: 24.6 }, zoom: 7, iso: "LVA" },
  { id: "LT", region: "EU", title: "Lithuania", flag: "🇱🇹", center: { lat: 55.2, lng: 23.9 }, zoom: 7, iso: "LTU" },
  { id: "LU", region: "EU", title: "Luxembourg", flag: "🇱🇺", center: { lat: 49.8, lng: 6.1 }, zoom: 8, iso: "LUX" },
  { id: "MT", region: "EU", title: "Malta", flag: "🇲🇹", center: { lat: 35.9, lng: 14.4 }, zoom: 8, iso: "MLT" },
  { id: "NL", region: "EU", title: "Netherlands", flag: "🇳🇱", center: { lat: 52.2, lng: 5.3 }, zoom: 7, iso: "NLD" },
  { id: "PL", region: "EU", title: "Poland", flag: "🇵🇱", center: { lat: 52.1, lng: 19.4 }, zoom: 6, iso: "POL" },
  { id: "PT", region: "EU", title: "Portugal", flag: "🇵🇹", center: { lat: 39.5, lng: -8.0 }, zoom: 7, iso: "PRT" },
  { id: "RO", region: "EU", title: "Romania", flag: "🇷🇴", center: { lat: 45.9, lng: 24.9 }, zoom: 6, iso: "ROU" },
  { id: "SK", region: "EU", title: "Slovakia", flag: "🇸🇰", center: { lat: 48.7, lng: 19.6 }, zoom: 7, iso: "SVK" },
  { id: "SI", region: "EU", title: "Slovenia", flag: "🇸🇮", center: { lat: 46.1, lng: 14.9 }, zoom: 8, iso: "SVN" },
  { id: "ES", region: "EU", title: "Spain", flag: "🇪🇸", center: { lat: 40.2, lng: -3.7 }, zoom: 6, iso: "ESP" },
  { id: "SE", region: "EU", title: "Sweden", flag: "🇸🇪", center: { lat: 62.0, lng: 15.1 }, zoom: 5, iso: "SWE" },
  { id: "NO", region: "EU", title: "Norway", flag: "🇳🇴", center: { lat: 62.0, lng: 9.0 }, zoom: 5, iso: "NOR" },
  { id: "CH", region: "EU", title: "Switzerland", flag: "🇨🇭", center: { lat: 46.8, lng: 8.2 }, zoom: 7, iso: "CHE" },
  { id: "IS", region: "EU", title: "Iceland", flag: "🇮🇸", center: { lat: 64.9, lng: -18.8 }, zoom: 6, iso: "ISL" },
  { id: "RS", region: "EU", title: "Serbia", flag: "🇷🇸", center: { lat: 44.0, lng: 21.0 }, zoom: 7, iso: "SRB" },
  { id: "BA", region: "EU", title: "Bosnia and Herzegovina", flag: "🇧🇦", center: { lat: 44.2, lng: 17.8 }, zoom: 7, iso: "BIH" },
  { id: "AL", region: "EU", title: "Albania", flag: "🇦🇱", center: { lat: 41.2, lng: 20.1 }, zoom: 7, iso: "ALB" },
  { id: "ME", region: "EU", title: "Montenegro", flag: "🇲🇪", center: { lat: 42.7, lng: 19.3 }, zoom: 8, iso: "MNE" },
  { id: "MK", region: "EU", title: "North Macedonia", flag: "🇲🇰", center: { lat: 41.6, lng: 21.7 }, zoom: 8, iso: "MKD" },
  { id: "UA", region: "EU", title: "Ukraine", flag: "🇺🇦", center: { lat: 48.4, lng: 31.2 }, zoom: 5, iso: "UKR" },
  { id: "CA", region: "CA", title: "Canada", flag: "🇨🇦", center: { lat: 56.1, lng: -106.3 }, zoom: 4, iso: "CAN" },
  { id: "JP", region: "JP", title: "Japan", flag: "🇯🇵", center: { lat: 36.2, lng: 138.3 }, zoom: 5, iso: "JPN" },
];

function mapStyle(): google.maps.MapTypeStyle[] {
  return [
    { elementType: "geometry", stylers: [{ color: "#12303e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#bfdae3" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0d2431" }, { weight: 3 }] },
    { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#63818a" }, { weight: 0.8 }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#071f2b" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7faeb9" }] },
  ];
}

type CoverageMapProps = {
  selectedCountryId?: string;
  onSelect: (country: CoverageCountry) => void;
  copy: {
    title: string;
    lead: string;
    selectLabel: string;
    selectPlaceholder: string;
    selectedLabel: string;
    selectedFallback: string;
    continue: string;
  };
};

export function CoverageMap({ selectedCountryId, onSelect, copy }: CoverageMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeCountry, setActiveCountry] = useState<CoverageCountry | null>(() => COVERAGE_COUNTRIES.find((country) => country.id === selectedCountryId) ?? null);

  const choose = (country: CoverageCountry, flyTo = true) => {
    setActiveCountry(country);
    if (flyTo && mapRef.current) {
      mapRef.current.panTo(country.center);
      mapRef.current.setZoom(country.zoom);
    }
  };

  useEffect(() => {
    const selected = COVERAGE_COUNTRIES.find((country) => country.id === selectedCountryId);
    if (selected) setActiveCountry(selected);
  }, [selectedCountryId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.data.setStyle((feature) => {
      const country = COVERAGE_COUNTRIES.find((item) => item.id === feature.getProperty("id"));
      const active = country?.id === activeCountry?.id;
      return {
        fillColor: active ? "#ffd264" : "#46c6e8",
        fillOpacity: active ? 0.82 : 0.48,
        strokeColor: active ? "#fff6dc" : "#a9edf7",
        strokeOpacity: 0.98,
        strokeWeight: active ? 2.3 : 1.05,
        clickable: true,
      };
    });
  }, [activeCountry]);

  return <section className="coverage-map-shell" aria-label={copy.title}>
    <div className="coverage-map-heading">
      <span><i />SERVICE TERRITORIES</span>
      <b>{copy.title}</b>
      <small>{copy.lead}</small>
    </div>
    <MapView className="coverage-google-map" initialCenter={{ lat: 29, lng: 12 }} initialZoom={2} onMapReady={(map) => {
      mapRef.current = map;
      map.setOptions({
        styles: mapStyle(), mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
        rotateControl: false, gestureHandling: "greedy", minZoom: 2, maxZoom: 10, zoomControl: true,
        backgroundColor: "#071f2b",
      });
      map.data.addGeoJson(COVERAGE_COUNTRY_GEOJSON as unknown as GeoJSON.FeatureCollection);
      map.data.setStyle((feature) => {
        const country = COVERAGE_COUNTRIES.find((item) => item.id === feature.getProperty("id"));
        const active = country?.id === activeCountry?.id;
        return { fillColor: active ? "#ffd264" : "#46c6e8", fillOpacity: active ? 0.82 : 0.48, strokeColor: active ? "#fff6dc" : "#a9edf7", strokeOpacity: 0.98, strokeWeight: active ? 2.3 : 1.05, clickable: true };
      });
      map.data.addListener("click", (event: google.maps.Data.MouseEvent) => {
        const picked = COVERAGE_COUNTRIES.find((item) => item.id === event.feature.getProperty("id"));
        if (picked) choose(picked, false);
      });
      map.data.addListener("mouseover", (event: google.maps.Data.MouseEvent) => map.data.overrideStyle(event.feature, { fillOpacity: 0.76, strokeWeight: 1.8 }));
      map.data.addListener("mouseout", (event: google.maps.Data.MouseEvent) => map.data.revertStyle(event.feature));
    }} />
    <div className="coverage-map-dock">
      <label>
        <span>{copy.selectLabel}</span>
        <select value={activeCountry?.id ?? ""} onChange={(event) => {
          const next = COVERAGE_COUNTRIES.find((country) => country.id === event.target.value);
          if (next) choose(next);
        }}>
          <option value="">{copy.selectPlaceholder}</option>
          <optgroup label="Europe">{COVERAGE_COUNTRIES.filter((country) => country.region === "EU").map((country) => <option key={country.id} value={country.id}>{country.flag} {country.title}</option>)}</optgroup>
          <optgroup label="Other regions">{COVERAGE_COUNTRIES.filter((country) => country.region !== "EU").map((country) => <option key={country.id} value={country.id}>{country.flag} {country.title}</option>)}</optgroup>
        </select>
      </label>
      <div className="coverage-selected">
        <span>{copy.selectedLabel}</span>
        <b>{activeCountry ? <>{activeCountry.flag} {activeCountry.title}<Check size={15} /></> : copy.selectedFallback}</b>
      </div>
      <button className="primary" disabled={!activeCountry} onClick={() => activeCountry && onSelect(activeCountry)}><Navigation size={16} />{copy.continue}</button>
    </div>
  </section>;
}
