# Modernité BIPV — Codex / GitHub Deployment Handoff

**Prepared:** 2026-09-27  
**Purpose:** Move the current Modernité BIPV application out of Manus and into a normal GitHub repository and production hosting environment without losing customer Studio content, 3D models, product data, or application imagery.

## Executive answer

**Do not use the earlier `Modernite_UI_Flow_Audit_Package.zip` as the application export.** That archive contains only the UI audit report and screenshots.

Use this handoff package instead. It contains a validated copy of the source project in `source/`, including:

- The customer **Modernité Solar Studio V31** runtime at `source/client/public/studio.html`.
- All customer Studio building/product/3D configuration data inside that self-contained file.
- All currently referenced Manus-hosted image and GLB assets copied into `source/client/public/assets/` and rewired to local `/assets/...` URLs.
- The full React, Express, tRPC, TypeScript, empirical calculation, local climate and test source.
- `pnpm-lock.yaml`, so Codex can reproduce the installed dependency graph.

### What will transfer unchanged

| Capability | Portable in this handoff? | Evidence / location |
|---|---:|---|
| Customer Studio V31 | **Yes** | `source/client/public/studio.html` |
| Customer building models | **Yes** | Encoded in V31 runtime |
| Customer BIPV product library and product information | **Yes** | Encoded in V31 runtime |
| Customer 3D geometry and product/model textures used by V31 | **Yes** | V31 is 5,770,040 bytes and contains 24 embedded `data:image` resources; it has no external script, image or GLB runtime URLs |
| World / globe selector | **Yes** | `d3-geo`, `topojson-client` and `world-atlas` are normal npm dependencies included in `package.json` / lockfile |
| Entry hero, globe backdrop and legacy architecture/GLB assets | **Yes** | Now local under `source/client/public/assets/` |
| Empirical generation model and regional climate baselines | **Yes** | `source/lib/empirical-generation.ts`, `source/lib/local-climate.ts`, `source/lib/estimate-engine.ts` |
| Current project data in a browser | **Partly** | Project context and latest study use browser `localStorage`; these are not a shared cloud database |

## Two important things that do **not** transfer as files

### 1. Google Maps / Street View data

The application currently uses a **Manus-managed Google Maps proxy**. That proxy and its credentials are not portable, and the Google satellite map / Street View imagery itself is never a downloadable asset.

The existing code that Codex must replace is:

- `source/client/src/components/Map.tsx`
- It currently loads Google Maps through `VITE_FRONTEND_FORGE_API_KEY` and a Manus Forge proxy.

For an external deployment, create a Google Cloud project and use a new browser-restricted Google Maps API key. Enable at least:

1. **Maps JavaScript API** — interactive base map, satellite, drawing, Street View control.
2. **Places API** — address autocomplete.
3. **Geocoding API** — typed address / postcode lookup.

Use an environment variable such as `VITE_GOOGLE_MAPS_API_KEY`. Restrict it to the eventual production domain(s) and localhost for development, set an API budget and quota alerts, and never commit the key to GitHub.

> The local globe is not Google Earth. It is a portable, interactive D3/TopoJSON globe and will work from the downloaded source. The **Google Map**, satellite imagery and Street View require live access to Google at runtime and a valid Google Maps billing/API configuration.

### 2. Manus-hosted LLM and storage services

The application currently has Manus-specific server helpers under `source/server/_core/`, including the Forge LLM helper, Manus storage proxy and Manus OAuth template routes. Their secrets must **not** be exported or copied.

The primary solar calculation is already independent of PVGIS and LLM availability. It is deterministic and local to the codebase:

- Product-specific approved empirical coefficients.
- Local regional monthly climate profiles.
- Orientation / tilt adjustment.
- Temperature correction.
- 90% AC factor.
- 25-year planning calculations.

LLM use is deliberately secondary:

- Household-demand estimate when the user does not know their annual bill.
- Plain-language Design Studio and Results explanations.
- It does **not** produce the authoritative solar-generation number.

The existing `source/server/planning-ai.ts` provides a `PlanningAIProvider` boundary with a working `OfflinePlanningAIProvider`. Set:

```bash
MODERNITE_PLANNING_AI_MODE=offline
```

and the system will run without Manus LLM access, using a deterministic household-demand fallback.

For a future LLM deployment, Codex should add an adapter such as `OpenAICompatiblePlanningAIProvider` or `OllamaPlanningAIProvider` behind the same interface. The provider’s base URL, model and secret must live only on the server, for example:

```bash
# Example only — do not commit actual values.
MODERNITE_PLANNING_AI_MODE=openai-compatible
PLANNING_AI_BASE_URL=https://your-ai-service.example/v1
PLANNING_AI_MODEL=your-approved-model
PLANNING_AI_API_KEY=...
```

Codex should also move the two direct assistant calls in `source/server/estimate-service.ts` (`askProjectAssistant` and `askDesignAssistant`) behind the same provider boundary. Do **not** put an LLM key in React/Vite client code.

## Required deployment architecture

This is **not** a GitHub Pages-only static site in its current form. The frontend calls tRPC routes at `/api/trpc` for calculations and AI help, so it needs a Node/Express runtime.

Recommended routes:

| Choice | Suitability | Notes |
|---|---|---|
| GitHub repository + Railway / Render / Fly.io | **Recommended** | Run the existing `pnpm build` then `pnpm start` Node/Express application. Lowest-friction move from the current architecture. |
| GitHub repository + Vercel / Netlify functions | Possible | Codex must adapt the current Express/tRPC server into serverless functions. |
| GitHub Pages only | **Not suitable without a refactor** | Cannot run the Express/tRPC calculation or server-side LLM routes. It would require moving calculation logic client-side and removing server features. |

The portable source was smoke-tested as a normal production Node process with no Manus credentials:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
PORT=3333 NODE_ENV=production pnpm start
```

The build passed, `/` returned HTTP 200, and `/studio.html` returned HTTP 200. The customer Studio checksum is preserved in `studio-runtime-inventory.txt`.

## Handoff package structure

```text
modernite-codex-handoff/
├── source/                              # Give this folder to Codex / commit it to GitHub
│   ├── client/
│   │   ├── public/
│   │   │   ├── studio.html              # Customer V31 runtime — do not redesign or replace
│   │   │   └── assets/                  # 18 mirrored former Manus storage assets
│   │   └── src/
│   ├── server/
│   ├── lib/
│   ├── data/
│   ├── tests/
│   ├── package.json
│   └── pnpm-lock.yaml
├── assets/
│   └── manifest.psv                     # Original /manus-storage path → local path inventory
├── portable-asset-sha256sums.txt        # Hash inventory for the copied assets
├── studio-runtime-inventory.txt          # V31 size and SHA-256 inventory
└── CODEX_GITHUB_DEPLOYMENT_HANDOFF.md
```

## Exact Codex tasks, in order

1. **Create a private GitHub repository** and commit the contents of `source/` (not `node_modules/` or `dist/`).
2. **Keep `client/public/studio.html` byte-identical.** It contains the approved V31 building catalogue, products, calculations, 3D scene and embedded images. Confirm its SHA-256 against `studio-runtime-inventory.txt` after every migration step.
3. **Keep the mirrored files under `client/public/assets/`** and retain the local `/assets/...` paths already applied in the source copy. The portable client build has been checked to contain **no `/manus-storage/` URL**.
4. **Replace the Manus Maps loader** in `client/src/components/Map.tsx` with the official Google Maps JS loader and `VITE_GOOGLE_MAPS_API_KEY`. Preserve the existing map interactions: satellite, places autocomplete, geocoding, numbered boundary tracing, vertex editing, closure, area calculation, and Street View.
5. **Remove or replace Manus-only runtime integration** before public deployment:
   - `vite-plugin-manus-runtime` and Manus debug collector in `vite.config.ts`.
   - Manus storage proxy routes in `server/_core/storageProxy.ts` (not needed once local assets are used).
   - Manus OAuth routes and client session fallback if authentication is not required; otherwise replace with the chosen provider (Clerk, Auth0, NextAuth, custom auth, etc.).
   - Forge LLM helpers with the planned server-side AI adapter, or leave `MODERNITE_PLANNING_AI_MODE=offline` initially.
6. **Choose persistence deliberately.** Current active project context and recent results are saved in browser `localStorage`; the server’s in-memory studies expire after two hours. For multi-user production, implement a database or durable store for projects/results. For a proof-of-concept, current local persistence is acceptable.
7. **Set environment variables in the host dashboard**, never in source control. Minimum practical first deployment:

```bash
NODE_ENV=production
PORT=3000
VITE_GOOGLE_MAPS_API_KEY=your_browser_restricted_google_key
MODERNITE_PLANNING_AI_MODE=offline
```

8. **Deploy and validate** the six-step workflow: Project → Market → Site → Studio → Energy → Results. Specifically test Google autocomplete, satellite imagery, Street View, multi-point boundary closure, vertex dragging, Studio V31 model loading, calculation without PVGIS, and asset loading from `/assets/`.

## Extra portability notes

- Google Fonts are currently loaded from `fonts.googleapis.com`; they work normally on public hosting. If the goal is an air-gapped/offline UI, download and self-host the font files as well.
- V31 contains some external **reference/citation hyperlinks**, but the customer Studio does not load its 3D runtime images, scripts or GLBs from external URLs.
- The current Git remote is a Manus-managed internal artifact remote, not the user’s GitHub repository. A new GitHub remote must be created by the user/Codex.
- No payment, Google API key, LLM key, Manus credential or user secret is included in this handoff.

## Validation record

- **Customer V31 runtime:** `5,770,040 bytes`.
- **Customer V31 SHA-256:** `566789561e1972fced08618b47a964ffbc3f830251f9d8cacac95a104e8527a9`.
- **Mirrored assets:** 18 files under `source/client/public/assets/`.
- **Portable client asset paths:** verified to contain no `/manus-storage/` URLs.
- **Portable build:** `pnpm check` and `pnpm build` passed.
- **Portable server smoke test:** production server started and served `/` and `/studio.html` successfully.
