# Decisions

- **PVGIS aspect convention:** §14.2 prose and its algebraic expression conflict with acceptance criterion 7. The implementation follows the explicit acceptance mapping (`180° → 0`, `90° → 90`, `270° → −90`) so the tested behaviour is deterministic.
- **Framework:** The managed WebDev workspace provides the required secure database, authentication and deployment substrate as a Vite + React application rather than Next.js. The application preserves the specified routes, server-only integrations, pure `lib/` functions, Zustand store, and no-framework plain-CSS architecture.
- **Preview irradiance:** `?preview=1` uses a visibly labelled demonstration fixture. It never substitutes for a failed live PVGIS request; live failures remain honest errors.
