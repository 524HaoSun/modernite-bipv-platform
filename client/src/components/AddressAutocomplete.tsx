import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

type Selection = {
  lat: number;
  lng: number;
  label: string;
  locality?: string;
  postcode?: string;
};

type AddressAutocompleteProps = {
  value: string;
  countryCode?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSelect: (selection: Selection) => void;
  onLocate: () => void;
};

function readComponent(place: google.maps.places.PlaceResult, kind: string) {
  return place.address_components?.find((component) => component.types.includes(kind))?.long_name;
}

export function AddressAutocomplete({ value, countryCode, placeholder = "Search an address or postcode", onChange, onSelect, onLocate }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    let attempts = 0;
    const connect = () => {
      if (autocompleteRef.current) {
        autocompleteRef.current.setComponentRestrictions(countryCode ? { country: countryCode.toLowerCase() } : null);
        return;
      }
      if (!inputRef.current || !window.google?.maps?.places) return;
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ["geometry", "formatted_address", "address_components", "name"],
        types: ["address"],
        componentRestrictions: countryCode ? { country: countryCode.toLowerCase() } : undefined,
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const point = place.geometry?.location;
        if (!point) return;
        onSelect({
          lat: point.lat(),
          lng: point.lng(),
          label: place.formatted_address || place.name || inputRef.current?.value || "Selected property",
          locality: readComponent(place, "postal_town") || readComponent(place, "locality"),
          postcode: readComponent(place, "postal_code"),
        });
      });
      autocompleteRef.current = autocomplete;
    };
    connect();
    const timer = window.setInterval(() => {
      attempts += 1;
      connect();
      if (autocompleteRef.current || attempts > 50) window.clearInterval(timer);
    }, 150);
    return () => window.clearInterval(timer);
  }, [countryCode, onSelect]);

  return <div className="input-row address-autocomplete">
    <input ref={inputRef} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onLocate(); } }} autoComplete="street-address" aria-label={placeholder} />
    <button className="icon-button" type="button" title="Locate property" onClick={onLocate}><MapPin size={17} /></button>
  </div>;
}
