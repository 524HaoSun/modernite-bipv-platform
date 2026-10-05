# Modernite administration and customer accounts

The application now serves `/admin` and `/account` alongside the existing Solar Studio. The implementation uses the existing React and Express application with a separate persistent SQLite database, rather than the unused Manus/MySQL account scaffold. It does not grant administrative access through the legacy `users.role` field.

## Run locally

Use Node 24 (minimum 22.13, which supports `node:sqlite`) and the repository's declared pnpm version. Install with `pnpm install --frozen-lockfile`, then run `pnpm dev`. Open `/admin` for administration and `/account` for private projects. Public trials continue without login.

The isolated local review server at `http://localhost:3017/admin` is a demo. It does not send emails. Its sign-in page offers **Open demo workspace**, which starts a session against its temporary sample database. That route exists only in the unshipped `.cache/control-preview.ts` fixture, binds to loopback, rejects cross-origin requests and refuses production mode. The normal application has no demo-login route.

The normal sign-in screen checks `/api/control/login/status` before accepting an email. If delivery is unconfigured, the form is disabled and explains that setup is required. The server also rejects requests in that state, without generating a code or returning a delivery-success message. Provider authorization failures surface as configuration problems without logging recipients, codes or keys.

Set these server environment variables before account login can work:

- `CONTROL_AUTH_KEY`: a securely generated value of at least 32 characters. Preserve it across deployments; it encrypts TOTP enrollment secrets. Keep a protected recovery copy with the database backups.
- `RESEND_API_KEY` and `LOGIN_EMAIL_FROM`: a Resend key and a verified sender address. No email is sent during development tests.
- `PUBLIC_BASE_URL`: the exact production origin, such as `https://modernite.wenda.global`. Production account writes fail closed if it is missing or the Origin header differs.
- `CONTROL_DB_PATH`: an absolute path on persistent, private storage, for example `/opt/modernite/data/control.sqlite`. Do not place it inside a deployment release directory or public assets directory. The default `.data/control.sqlite` is suitable for local use.

Provision each staff member on the server using a distinct authenticator secret already enrolled in their authenticator app. Supply `CONTROL_TOTP_SECRET` through the operator's secure environment; do not put it in shell arguments, logs, version control, or the browser. Then run:

```sh
pnpm exec tsx scripts/provision-control-user.ts person@example.com technical
pnpm exec tsx scripts/provision-control-user.ts second-person@example.com product,pricing
```

Run each command with that person's own secret. Role options are `customer`, `dealer`, `sales`, `product`, `technical`, `pricing`, and `super`. Provision at least two appropriate staff accounts because authors cannot approve their own releases. Super administrators manage roles and session revocation; sales access remains explicit. Granting a staff role through the UI requires an already enrolled authenticator. Provisioning and role changes revoke old sessions.

The provisioning command is source tooling; the standalone production bundle does not contain it. Run it from a checked-out repository against the same persistent database while the application is stopped for initial setup. No default account, password, or production login bypass is shipped. The legacy development session/network recorder has been removed so verification codes and customer input are not captured by debug telemetry.

## Product and release workflow

- Catalogue: names, public descriptions, and availability for the 17 profile IDs used by the actual Studio runtime.
- Technical: rated power, paired a/b coefficients, U/g and applicability, measurement and area bases, and versioned efficiency/temperature model. Product administrators can propose product technical changes; changing the model requires technical authority.
- Pricing: internal costs, BOM, fixed prices, markup or margin methods, discount limits, wastage handling, minimum margins, quantity tiers, units, currency, tax basis, and effective dates. Initial costs and prices remain unset. Missing or expired prices block formal quotes.
- Every submitted change records its base release, source and reason. A different authorized reviewer approves it, which immediately makes it active. A stale base or revoked review authority blocks approval. To revisit a historic release, submit its values again from the current version.
- The impact preview compares 10 m² at 25°C, 80% beam and 20% diffuse radiation, a 90% AC factor, and irradiance values 0, 139.999, 140, 140.001 and 1000 W/m². It is a bounded numerical example, not full building simulation validation.
- The public catalogue endpoint explicitly lists permitted fields. Internal pricing and model coefficients are only returned to authorized staff. Product responses and quotes do not serialize internal records wholesale.

The baseline migrates the report's values, including Standard g=0.20 and Skylight U=0.5. These differ from parts of `data/catalogue.ts`; the report values are authoritative for the new server calculation mapping and remain marked as unconfirmed. Migration records are not technical certifications.

Tile dimension deductions are recorded with the model but intentionally read-only: incoming Studio snapshots already contain active area. Changing these deductions without a coordinated geometry change would misrepresent the product. The API blocks independent changes instead of presenting a setting that has no effect.

## Customer projects and inquiries

Customers verify their email using a single-use 10-minute code; resend and failed-attempt limits persist in SQLite. Staff additionally use TOTP with replay prevention. Session cookies are HttpOnly, SameSite Strict, and Secure in production. Suspension and revocation are checked on every request.

“Save project / My projects” captures the configured building and product surfaces from the existing Studio bridge. The account workspace saves that configuration, maintains immutable revisions, runs calculations with pinned or latest published releases, downloads a PDF report or configuration JSON, and submits an inquiry tied to a specific revision. Changing the version deliberately creates a new result. Concurrent edits produce a conflict rather than overwriting a saved version; users can save their edits as a separate project.

The current account editor reopens the saved calculation configuration and supports editing its JSON. It does **not yet restore the full 3D Studio scene**: the protected legacy bridge exposes a snapshot, but no scene import method. Geometry reconstruction and a complete visual resume workflow need a coordinated change to that runtime.

Reports contain selected public result fields, project revision, parameter references and report identity. The server produces the PDF with pdf-lib; costs and confidential formulas are never included. This initial report uses an ASCII-compatible font and replaces unsupported characters; branded multilingual reports need an embedded Unicode font.

Quote quantities come from saved active surface areas and pricing comes from the approved server price list. Client price/total overrides are rejected. Non-area pricing units are maintained in the admin but cannot be automatically quoted from area-only snapshots; such requests require sales review. Discount permissions are stored, but no discretionary discount submission route is enabled. Quotes retain their original output snapshot and price release.

Sales staff initially see a redacted unassigned inquiry queue. Claiming an inquiry grants access to its contact information; notes are only visible to the assigned salesperson. Customers only see their own inquiry status and submitted message. Marketing subscription is never enabled by signing in or submitting an inquiry.

## Existing boundaries and remaining report scope

This is an admin-system implementation with initial account integration; it does not complete every phase in the attached report.

- The protected `client/public/studio.html` file is unchanged. Its historical V31 coefficients and the host's existing local demonstration model remain publicly visible. Newly administered coefficients stay on the server, but **the full browser-confidentiality acceptance criterion is not met** until the legacy model is migrated to a server API. The old standalone Studio calculations and specifications can differ from newly published server values; product selection/switch/import consistency needs the same migration.
- Existing public `/p/:id` share links and `/api/projects/:id/report.pdf` still behave as public shares. New private records use separate `/api/control` endpoints and are never written to public share storage. Decide how to migrate or retire existing shares before treating all historic projects as private.
- Saved calculation outputs remain immutable. Re-running a pinned model can still retrieve newer weather or external economic guidance; exact historical input replay requires snapshotting those external datasets and inputs too.
- The detailed dealer portal, offline sync, full 3D scene restoration, customer data export/deletion workflows, customer profile and notification preferences, cross-staff inquiry reassignment, and a dedicated customer directory are not included yet. Dealer accounts currently have only their own customer workspace.
- Retention periods, privacy contact/copy, verified technical bases, approved prices and production account enrollment remain business/operator decisions. No unconfirmed price was invented.

## Operations and verification

Back up the SQLite database with its online backup API or while the application is stopped; copying only the main file while WAL writes are active is unsafe. Persist the parent directory across automatic releases, restrict filesystem access, and retain `CONTROL_AUTH_KEY` securely. The database is intended for the existing single-server deployment; distributed replicas would need a shared transactional database and distributed rate limiting.

Run `pnpm check`, `pnpm test`, and `pnpm build`. The control tests cover migrations, private field projections, role boundaries, separate approval, stale submissions, reviewer authorization, parameter pinning, irradiance boundaries, project ownership, optimistic concurrency, pricing formulas/tiers, missing-price rejection, OTP expiry/lockout, TOTP replay, and persistence.

No production deployment, live account changes, or outbound email is performed by this branch.
