# Modernite BIPV Platform

Private migration baseline for the Modernite BIPV platform, including the React/Vite host application, Node/Express/tRPC server, deterministic solar calculation model, local assets, tests, and the protected customer Studio V31 runtime.

## Repository

- Owner: `524HaoSun`
- Main repository: `https://github.com/524HaoSun/modernite-bipv-platform`
- GitHub Pages preview: `https://524haosun.github.io/modernite-bipv-platform/`
- Protected baseline branch: `main`
- UI redesign branch: `feature/ui-redesign`

## Protected Studio Runtime

Do not edit, format, minify or move by hand:

```text
client/public/studio.html
```

It is the customer's V31 build (SHA-256 `e0017ad9761f374c16b6b230771f0dae2c072158cfa0100067c158575c225441`) with the host rendering patch applied. Regenerate it from a customer file with:

```bash
node scripts/patch-studio-render.mjs <customer-studio.html> client/public/studio.html
```

The patch only touches renderer, camera and post-processing statements (FXAA, SSAO camera sync, adaptive near plane, desktop pixel ratio) and lets the Modernite advisor's online mode use a same-origin endpoint (`/api/studio-advisor`, served by the host with the configured LLM); the energy, system, location and shading scripts stay byte-identical. Expected SHA-256 after patching:

```text
d305ed98aa6d7120c7906044be597feb1a0f45e703d6dbac735ddeaa03ab7192
```

The `.gitattributes` file marks this runtime as `-text` so Git line-ending normalization does not change its bytes.

## Local Setup

Use Node 22+ and pnpm. The project was validated with Node `v24.19.0` and pnpm `10.4.1`.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

If a newer global pnpm reports lockfile settings mismatch, run the install with the package-manager version declared by the project:

```bash
pnpm dlx pnpm@10.4.1 install --frozen-lockfile
```

## Validation Record

See:

```text
docs/handoff/BASELINE_VALIDATION.md
```

Baseline status:

- TypeScript check passed.
- Tests passed: 26 files, 72 tests.
- Production build passed.
- Local production smoke test returned HTTP 200 for `/` and `/studio.html`.
- `client/public/assets/` contains 18 mirrored portable assets.
- `/manus-storage/` references are absent from `client/` and `dist/public/`.

## Collaboration Workflow

Use `feature/ui-redesign` for host UI work. Keep `main` as the verified baseline unless intentionally updating the baseline through review.

For a private repository, collaborators need GitHub accounts and must be invited from repository settings:

```text
Settings -> Collaborators and teams -> Add people
```

Recommended workflow:

- Invite collaborators with Write access.
- Make UI changes on `feature/ui-redesign` or a new feature branch.
- Open pull requests into `main` for review before merging.
- Keep `main` deployable because GitHub Pages publishes from `main`.

Design inputs can be placed under:

```text
design/references/
design/screens/
design/ui-spec.md
design/component-inventory.md
```

Before committing UI changes, verify:

```bash
pnpm check
pnpm test
pnpm build
```

Then confirm `client/public/studio.html` still matches the protected SHA-256.

## Deployment Note

GitHub Pages is configured as a static preview deployment at:

```text
https://524haosun.github.io/modernite-bipv-platform/
```

This repository's current architecture also includes a Node/Express/tRPC server for calculations and assistant routes. GitHub Pages cannot run that server, so the Pages site is best treated as a static preview for the host UI, local assets, and protected Studio runtime. A full production deployment should use a Node-capable host such as Railway, Render, Fly.io, or an equivalent app platform, with secrets configured in the host dashboard rather than committed to GitHub.
