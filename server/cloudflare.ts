import { ENV } from "./_core/env";

const API = "https://api.cloudflare.com/client/v4";

export const d1Enabled = () => Boolean(ENV.cfAccountId && ENV.cfApiToken && ENV.cfD1DatabaseId);
export const browserRenderingEnabled = () => Boolean(ENV.cfAccountId && ENV.cfApiToken);

type D1Response<T> = { success: boolean; errors?: { message?: string }[]; result?: { results?: T[]; success?: boolean }[] };

export async function d1Query<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
  if (!d1Enabled()) throw new Error("D1 is not configured");
  const response = await fetch(`${API}/accounts/${ENV.cfAccountId}/d1/database/${ENV.cfD1DatabaseId}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json()) as D1Response<T>;
  if (!response.ok || !payload.success) throw new Error(`D1 query failed: ${payload.errors?.map((e) => e.message).join("; ") || response.status}`);
  return payload.result?.[0]?.results ?? [];
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  schemaReady ??= (async () => {
    await d1Query("CREATE TABLE IF NOT EXISTS cache (ns TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY (ns, key))");
    await d1Query("CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, language TEXT, payload TEXT NOT NULL)");
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Renders a public URL to an A4 PDF through Cloudflare Browser Rendering, with "footer · page n / N" on every page. */
export async function renderPdf(url: string, waitForSelector: string, footer = ""): Promise<Buffer> {
  if (!browserRenderingEnabled()) throw new Error("Browser Rendering is not configured");
  // Header/footer templates render outside the page CSS, so they carry their own inline styles.
  const footerTemplate = `<div style="width:100%;padding:0 12mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;font-size:7px;color:#6b7c72;"><span>${escapeHtml(footer)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  const response = await fetch(`${API}/accounts/${ENV.cfAccountId}/browser-rendering/pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.cfApiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      gotoOptions: { waitUntil: "networkidle2", timeout: 45_000 },
      waitForSelector: { selector: waitForSelector, timeout: 30_000 },
      viewport: { width: 794, height: 1123 },
      pdfOptions: {
        format: "a4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate,
        margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("pdf")) throw new Error(`Browser Rendering failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return Buffer.from(await response.arrayBuffer());
}
