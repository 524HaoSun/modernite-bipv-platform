# Baseline Validation

Date/time: 2026-09-27T17:50:31.7680430+01:00

## Environment

- Node: v24.19.0
- pnpm used for install: 10.4.1 via `pnpm dlx pnpm@10.4.1 install --frozen-lockfile`
- Global pnpm present: 11.19.0
- OS: Windows

## Results

- Dependency install: passed with frozen lockfile using pnpm 10.4.1.
- TypeScript check: passed via `node_modules/.bin/tsc.cmd --noEmit`.
- Tests: passed, 26 files and 72 tests.
- Production build: passed via Vite frontend build and esbuild server bundle.
- Production smoke test: passed; `/` and `/studio.html` returned HTTP 200 on local port 3333.

## Studio Runtime

- Source Studio SHA-256: `566789561e1972fced08618b47a964ffbc3f830251f9d8cacac95a104e8527a9`
- Built Studio SHA-256: `566789561e1972fced08618b47a964ffbc3f830251f9d8cacac95a104e8527a9`
- Protected runtime status: unchanged and verified.

## Assets And Portability

- Local portable assets under `client/public/assets/`: 18 files.
- `/manus-storage/` references in `client/`: none found.
- `/manus-storage/` references in `dist/public/`: none found.

## Notes

- `tests/customer-studio-runtime.test.ts` was made portable by removing a stale absolute reference to `/home/ubuntu/upload/Modernite-Solar-Studio-V31-Gas-Boiler-Defaults.html` and validating the shipped runtime against `docs/handoff/studio-runtime-inventory.txt` instead.
- Vite reported non-blocking warnings for unset analytics placeholders and a JavaScript chunk larger than 500 kB.
- The local production server logs that `OAUTH_SERVER_URL` is not configured, but the application still served the validated production pages for this baseline smoke test.
