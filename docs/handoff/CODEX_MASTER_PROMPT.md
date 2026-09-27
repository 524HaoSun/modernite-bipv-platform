# Codex Master Prompt — Modernité BIPV Migration, UI Redesign and Future Integration

> **How to use:** Upload `Modernite_Codex_GitHub_Deployment_Handoff.zip` to a new **private** GitHub repository, open that repository in Codex, then paste everything below into Codex as the first task.  
> **Do not separately upload project source files.** This master prompt instructs Codex to unpack the ZIP, establish the baseline, preserve the customer runtime, and wait for the UI design materials before beginning visual implementation.

---

```text
You are the principal engineer and senior product-design implementation partner for the Modernité BIPV platform.

Your immediate job is to safely import the provided handoff ZIP into this private GitHub repository, establish a verified baseline, and prepare the repository for an iterative UI redesign. Do NOT deploy the application, do NOT create cloud resources, and do NOT ask for or invent any API keys. A separate team member will configure Maps, LLM, persistence, authentication, hosting and production secrets later.

IMPORTANT IMPORT VARIANT: If this repository already has `client/`, `server/`, `lib/`, `package.json`, `pnpm-lock.yaml`, and `docs/handoff/CODEX_MASTER_PROMPT.md` at its root, the owner has already used the recommended GitHub Desktop import route. In that case, DO NOT look for or unpack a ZIP and DO NOT overwrite the repository root. Skip directly to section 3, using the existing `docs/handoff/` files as the handoff record.

============================================================
0. PRIMARY OUTCOME
============================================================

Create a clean, version-controlled repository that:

1. Preserves the customer-owned Modernité Solar Studio V31 exactly.
2. Preserves all local assets delivered in the handoff ZIP.
3. Builds and tests successfully from GitHub/Codex.
4. Is ready for controlled UI redesign work in a dedicated branch.
5. Does not depend on Manus-hosted storage paths for image or model assets.
6. Does not deploy or expose any application publicly.
7. Leaves all external integrations in safe, credential-free placeholder/offline mode.

The handoff ZIP is expected to be named:

    Modernite_Codex_GitHub_Deployment_Handoff.zip

It contains this structure:

    modernite-codex-handoff/
    ├── source/                              # Actual source to become the repository root
    ├── CODEX_GITHUB_DEPLOYMENT_HANDOFF.md   # Technical migration notes
    ├── studio-runtime-inventory.txt         # Customer Studio integrity record
    ├── portable-asset-sha256sums.txt        # Local asset integrity record
    ├── assets/manifest.psv                  # Old Manus asset paths → local asset mapping
    └── README.md

Read the technical handoff documentation before editing any application file.

============================================================
1. NON-NEGOTIABLE CUSTOMER RUNTIME RULE
============================================================

The file below is customer-owned and approved:

    client/public/studio.html

It contains the customer’s:

- V31 Design Studio runtime;
- UK, Europe, Canada and Japan building catalogues;
- building forms and 3D geometry;
- BIPV product library;
- materials, finishes and solar configuration information;
- internal Studio interactions and customer-authored design;
- internal calculations and embedded image resources.

ABSOLUTELY DO NOT:

- edit, format, minify, prettify, rewrite or regenerate it;
- replace its iframe hosting model;
- replace or redraw customer 3D models;
- modify customer product names, product data, materials, building data or geometry;
- add scripts, styles, external assets or instrumentation inside it;
- change its visual design;
- change its file encoding or line endings.

Required SHA-256, before and after every completed task:

    566789561e1972fced08618b47a964ffbc3f830251f9d8cacac95a104e8527a9

Run:

    sha256sum client/public/studio.html

If the result differs, STOP immediately, revert the file, and report the issue. Never continue with a changed Studio file.

Allowed work around the Studio:

- Host-shell navigation and workflow bridge outside the iframe.
- The project progress rail outside the iframe.
- Site / market / energy / calculation / results experiences.
- Non-destructive Studio readiness messaging, project context handoff and save/export controls outside the iframe.
- UI styling applied to the React host only.

============================================================
2. IMPORT THE ZIP INTO THE GIT REPOSITORY
============================================================

First inspect the repository. The ZIP may be the only tracked file, or it may be present in the repository root.

A. Locate the ZIP

    find . -maxdepth 3 -type f -name 'Modernite_Codex_GitHub_Deployment_Handoff.zip' -print

B. Create a temporary extraction directory outside the final project root, then unpack it.

Example shell workflow — adapt paths if necessary:

    mkdir -p /tmp/modernite-handoff
    unzip -q Modernite_Codex_GitHub_Deployment_Handoff.zip -d /tmp/modernite-handoff
    ls -la /tmp/modernite-handoff/modernite-codex-handoff

C. Read these files before copying source:

    /tmp/modernite-handoff/modernite-codex-handoff/CODEX_GITHUB_DEPLOYMENT_HANDOFF.md
    /tmp/modernite-handoff/modernite-codex-handoff/studio-runtime-inventory.txt
    /tmp/modernite-handoff/modernite-codex-handoff/portable-asset-sha256sums.txt

D. Make the content of the extracted `source/` directory the repository root. Do not nest the application under `modernite-codex-handoff/source/`.

Example approach when the Git repository is otherwise empty:

    rsync -a --exclude='.git' \
      /tmp/modernite-handoff/modernite-codex-handoff/source/ \
      ./

Copy the technical handoff documents into a permanent `docs/handoff/` directory:

    mkdir -p docs/handoff
    cp /tmp/modernite-handoff/modernite-codex-handoff/CODEX_GITHUB_DEPLOYMENT_HANDOFF.md docs/handoff/
    cp /tmp/modernite-handoff/modernite-codex-handoff/studio-runtime-inventory.txt docs/handoff/
    cp /tmp/modernite-handoff/modernite-codex-handoff/portable-asset-sha256sums.txt docs/handoff/
    cp /tmp/modernite-handoff/modernite-codex-handoff/assets/manifest.psv docs/handoff/

E. Do NOT commit the original 83 MB ZIP once extraction has succeeded. Remove it from the repository working tree so the Git history does not store both the ZIP and its extracted contents:

    rm -f Modernite_Codex_GitHub_Deployment_Handoff.zip

F. Confirm the expected source structure:

    test -f package.json
    test -f pnpm-lock.yaml
    test -f client/public/studio.html
    test -d client/public/assets
    test "$(find client/public/assets -maxdepth 1 -type f | wc -l)" -eq 18

G. Confirm no former Manus storage URL remains in client source:

    ! rg -n '/manus-storage/' client

H. Confirm Studio integrity:

    sha256sum client/public/studio.html

Expected output must match the SHA-256 in section 1 exactly.

I. Add a strong `.gitignore` if one is not already suitable. At a minimum, ignore:

    node_modules/
    dist/
    .env
    .env.*
    !.env.example
    *.log
    .DS_Store

Do not ignore `client/public/assets/` or `client/public/studio.html`; those files are essential deliverables.

============================================================
3. ESTABLISH A VERIFIED BASELINE COMMIT
============================================================

Use Node 22+ and pnpm. Do not substitute npm or yarn unless the repository owner explicitly asks.

Run exactly these baseline checks:

    pnpm install --frozen-lockfile
    pnpm check
    pnpm test
    pnpm build
    sha256sum client/public/studio.html
    sha256sum dist/public/studio.html
    ! rg -n '/manus-storage/' dist/public

The source and production `studio.html` checksums must both match the approved hash.

Record results in a new concise file:

    docs/handoff/BASELINE_VALIDATION.md

Include:

- exact Node and pnpm versions;
- date/time;
- test count and result;
- build result;
- source and dist Studio SHA-256;
- confirmation that there are 18 local portable assets;
- confirmation that `/manus-storage/` is absent from `client/` and `dist/public/`.

Create a clean baseline commit, for example:

    chore: import validated Modernité BIPV handoff baseline

Do not create a deployment, do not add a public GitHub Pages workflow, and do not configure a production domain.

============================================================
4. BRANCH STRATEGY
============================================================

Keep `main` as the protected, verified baseline.

Create these branches only when the work begins:

    main                         # Imported and validated baseline
    feature/ui-redesign          # All host UI redesign work
    feature/maps-provider        # Future Google Maps migration only
    feature/ai-provider          # Future external or self-hosted AI adapter only
    feature/persistence          # Future database / shared project persistence only
    feature/deployment           # Future hosting and environment setup only

For now, create and work only in:

    feature/ui-redesign

Never mix production credentials, Google Maps migration, LLM provider migration or deployment changes into `feature/ui-redesign`.

============================================================
5. CURRENT PRODUCT FLOW — DO NOT CHANGE ITS MEANING
============================================================

The user journey has seven screen states. Preserve the sequence and data handoff:

    01 Project
    → 02 Market
    → 03 Site
    → 04 Design Studio
    → 05 Energy
    → 06 Calculation
    → 07 Results

### 01 Project

Purpose: start a new project or resume the locally saved project.

### 02 Market

Purpose: select United Kingdom, Europe (with country drill-in), Canada or Japan. The interactive globe is a local D3/TopoJSON implementation and is portable.

### 03 Site

Purpose: select / search the project site, use satellite or road view, open Street View when available, draw a multi-point solar-ready polygon, close the polygon, inspect m² area, and drag vertices for precision. The resulting boundary area is passed to Design Studio as the starting footprint context.

### 04 Design Studio

Purpose: use the customer’s V31 Studio to select the regional building model, BIPV products, finishes and environmental/light controls. Keep its internal models, products, materials and UI intact. The React host can only provide the outer bridge and project-flow context.

### 05 Energy

Purpose: collect household electricity demand and planning inputs:

- bill value or cautious estimate;
- household size;
- daytime occupancy;
- electric heating;
- heat pump;
- electric hot water;
- EV charging;
- solar-only or solar+battery choice;
- optional battery and project-price inputs.

### 06 Calculation

Purpose: an informative transition state while the deterministic approved empirical model calculates the project study.

### 07 Results

Purpose: present an annual generation range, monthly directional generation profile, solar-only vs battery scenario, 25-year cash-position view, method/assumption disclosure, generation-by-surface breakdown and final project save/export actions.

The calculations must remain truthful:

- Primary generation numbers come from the approved deterministic product-specific empirical model and local regional planning climate profile.
- The calculation must remain functional without PVGIS, Google Solar API or an LLM.
- An LLM may only add optional household-demand context and plain-language explanations. It must never be presented as the authoritative source of the annual generation result.

============================================================
6. UI REDESIGN SCOPE
============================================================

The owner will provide Figma links, screenshots, exported images, written design notes or component examples after this baseline is established.

Before implementation, create a design-input directory:

    design/
    ├── references/
    ├── screens/
    ├── ui-spec.md
    └── component-inventory.md

When design material is supplied, add it there with a short provenance note. Do not use random unlicensed internet images as production assets.

### UI redesign is allowed for

- the React/Vite host application;
- `client/src/App.tsx` and host components;
- Project, Market, Site, Energy, Calculation and Results pages;
- host-level navigation, progress display and language selection;
- map control UI, loading states and no-key placeholder state;
- all CSS in `client/src/index.css` and host component styles;
- UI charts, cards, forms, transitions and the floating assistant shell;
- responsive desktop and mobile layouts;
- accessible labels, keyboard flows, contrast and focus states.

### UI redesign is prohibited for

- anything inside `client/public/studio.html`;
- customer V31 models, product library, materials, 3D geometry, internal tabs, assets, calculations or internal design;
- any customer-provided source/data under the Studio runtime;
- empirical product coefficients and the approved local climate calculation logic, unless the owner explicitly provides a revised model specification.

### Required design quality bar

The owner considers the current UI a functional baseline, not the finished design. The redesign must be intentional and premium, not generic “AI dashboard” styling.

Apply these principles:

1. Use one coherent visual system across the outer 01–07 journey.
2. Use a single, unambiguous progress system. Do not show competing `Step 01`, oversized page numbers and duplicated top navigation numbers simultaneously.
3. Give every screen one clear dominant task and one primary action.
4. Keep generous whitespace where it helps hierarchy, but never create unexplained empty areas.
5. Use a strong typographic hierarchy with readable body text; do not use tiny labels for important choices.
6. Treat the Site map as a primary creation canvas, not a form with a map thumbnail.
7. Treat Design Studio as a deliberate mode switch: the outer host bridge should make the handoff clear without fighting the customer Studio’s internal interface.
8. Make Energy a progressive, understandable questionnaire, not a dense finance form.
9. Make Results a decision-oriented dashboard first and a detailed technical ledger second.
10. Make the AI assistant a non-obstructive, collapsible assistant surface. It must not cover primary controls or charts.
11. Use motion sparingly, under 300 ms, with reduced-motion support. Do not animate high-frequency controls unnecessarily.
12. Keep English copy polished. Preserve the existing V31-aligned language inventory and do not claim unsupported engineering certainty.

============================================================
7. EXTERNAL INTEGRATIONS — DO NOT CONFIGURE YET
============================================================

### Google Maps

The baseline package contains a former Manus-managed `client/src/components/Map.tsx`. Do not add a Google key now.

For the future `feature/maps-provider` branch, another team member will replace it with the official Google Maps JavaScript loader and a browser-restricted key, using:

    VITE_GOOGLE_MAPS_API_KEY

That future implementation must preserve:

- Dynamic Google Maps;
- satellite and road map modes;
- Google Places autocomplete;
- Geocoding;
- Street View / Pegman;
- country-scoped search;
- multi-point polygon drawing;
- explicit polygon closure;
- bright, editable numbered vertices;
- area calculation;
- return from Street View to the previous aerial map state.

It must optimize cost by:

- requiring at least 3 input characters before autocomplete;
- applying 250–350 ms debounce;
- using Autocomplete (New) session tokens;
- requesting only Place Details Essentials fields;
- lazy-loading Street View only after an explicit user action;
- not enabling Google Solar API, Aerial View API, Places Pro or Enterprise fields unless the owner explicitly requests them.

Until the Maps branch is implemented, keep the UI functional with an explicit non-production “Maps provider not configured” state or a controlled mock provider. Never silently fabricate map results.

### AI / LLM

The current code has a `PlanningAIProvider` boundary and an offline fallback. For now, use:

    MODERNITE_PLANNING_AI_MODE=offline

Do not add or ask for model API keys at this stage.

Future work in `feature/ai-provider` may implement an OpenAI-compatible, Azure, Anthropic, Ollama or self-hosted adapter. It must:

- run server-side only;
- receive its base URL, model and key only through server environment variables;
- never expose keys in Vite/React code;
- never become the authority for solar generation, product performance, engineering validation or financial guarantees;
- retain the deterministic offline fallback whenever the provider fails.

### Persistence and authentication

Current project context and recent study state are browser-local. Do not add a database now. In the future, use the dedicated `feature/persistence` branch to introduce a durable project model, user access policy and database migration plan.

The repository contains Manus OAuth and storage-template code. Do not configure Manus credentials outside Manus. Do not remove those modules during the initial import unless a separate, tested portability task is explicitly opened.

============================================================
8. LOCAL ASSET AND FILE RULES
============================================================

All portable image and model assets required by the host application now reside at:

    client/public/assets/

There must be 18 delivered asset files. They include the active entry hero, globe backdrop, architecture visuals and legacy GLB model files.

Rules:

- Keep these files in Git; do not move them to an untracked local folder.
- Use `/assets/<filename>` URLs in frontend code.
- Never restore `/manus-storage/` URLs.
- Do not introduce remote image URLs for required UI assets.
- If new large assets are needed, ask the owner whether Git LFS, Cloudflare R2/S3, or an image CDN should be used before adding them.
- Preserve `client/public/studio.html` separately from host visual assets; it is the protected customer runtime.

============================================================
9. DELIVERY PROCESS FOR EVERY UI ITERATION
============================================================

For each small, reviewable UI redesign increment:

1. State what will change and which files are in scope.
2. Make changes only in `feature/ui-redesign`.
3. Do not touch `client/public/studio.html`.
4. Test the actual screen at desktop and mobile breakpoints.
5. Run:

       pnpm check
       pnpm test
       pnpm build
       sha256sum client/public/studio.html
       sha256sum dist/public/studio.html

6. Confirm the hashes equal the protected V31 hash.
7. Summarize changed behavior, tested states, known limitations and exact files changed.
8. Commit with a focused commit message. Do not combine unrelated refactors.

Do not claim a result is validated when only static source inspection was performed. Clearly distinguish:

- visual mock / placeholder;
- local functional validation;
- integration-ready but credential-free;
- production-ready after external provider setup.

============================================================
10. FIRST ACTIONS AFTER THIS PROMPT
============================================================

Perform the following, in order:

1. Locate and unpack the handoff ZIP.
2. Move only the extracted `source/` content to the Git repository root.
3. Copy the handoff documents to `docs/handoff/`.
4. Remove the uploaded ZIP from tracked repository content.
5. Validate Studio hash, local assets and absence of `/manus-storage/` client URLs.
6. Run install, type check, tests and production build.
7. Create the baseline commit on `main`.
8. Create `feature/ui-redesign`.
9. Create the `design/` input structure.
10. Stop and provide a concise baseline validation report.

At that point, ask the owner for their redesigned UI screenshots, Figma link, visual references, typography choices, desktop/mobile expectations and priority order. Do not start a speculative UI redesign until those materials are provided.

============================================================
11. FINAL RESPONSE FORMAT FOR THE INITIAL IMPORT TASK
============================================================

Your first completion message must contain:

- the baseline commit hash;
- confirmation that `studio.html` SHA-256 matches exactly;
- test/check/build status;
- confirmation of the count of local assets;
- confirmation that no `/manus-storage/` URL remains in client source/build;
- the active branch name;
- confirmation that no deployment, API key, billing account, external LLM, database or production secret was created;
- a short request for the owner’s new UI design materials.

Do not include raw secrets, do not create a deployment URL, and do not make changes to customer Studio V31.
```
