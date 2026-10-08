/** The wordmark in the top-left of the site. Every other Modernité mark uses this file. */
export const BRAND_LOGO_SRC = "/assets/modernite-carbonfuture-logo.png";
export const BRAND_LOGO_ALT = "Modernité by CarbonFutureX Group";

export function BrandLogo({ className = "brand-logo-image" }: { className?: string }) {
  return <img className={className} src={BRAND_LOGO_SRC} alt={BRAND_LOGO_ALT} />;
}
