# Modernite BIPV Platform

Private migration baseline for the Modernite BIPV platform, including the React/Vite host application, Node/Express/tRPC server, deterministic solar calculation model, local assets, tests, and the protected customer Studio V31 runtime.

## Repository

- Owner: `524HaoSun`
- Main repository: `https://github.com/524HaoSun/modernite-bipv-platform`
- Protected baseline branch: `main`
- UI redesign branch: `feature/ui-redesign`

## Protected Studio Runtime

Do not edit, format, minify, regenerate, or move:

```text
client/public/studio.html
```

Expected SHA-256:

```text
566789561e1972fced08618b47a964ffbc3f830251f9d8cacac95a104e8527a9
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

This application is not a GitHub Pages-only static site in its current architecture. It includes a Node/Express/tRPC server for calculations and assistant routes. A public production deployment should use a Node-capable host such as Railway, Render, Fly.io, or an equivalent app platform, with secrets configured in the host dashboard rather than committed to GitHub.
