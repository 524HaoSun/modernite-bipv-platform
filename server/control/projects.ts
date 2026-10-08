import { randomBytes, randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ControlUser } from "../../shared/control";
import { browserRenderingEnabled, renderPdf } from "../cloudflare";
import { ControlStore, fail } from "./store";
import {
  projectCalculationInputSchema,
  runProjectCalculation,
  type ProjectCalculationInput,
  type ProjectCalculation,
} from "../estimate-service";
import { calculationRuntime } from "./runtime";
import { quoteLines } from "./releases";
export type SavedPayload = {
  input: ProjectCalculationInput;
  versions: { catalogue: string; technical: string };
  study?: ProjectCalculation;
};
export function ownedProject(
  store: ControlStore,
  user: ControlUser,
  id: string
) {
  return (
    store.db
      .prepare("SELECT * FROM projects WHERE id=? AND owner=?")
      .get(id, user.id) ?? fail(404, "Project not found")
  );
}
export function projectVersion(
  store: ControlStore,
  user: ControlUser,
  id: string,
  revision?: number
) {
  const project = ownedProject(store, user, id);
  const row = store.db
    .prepare("SELECT * FROM project_versions WHERE project_id=? AND revision=?")
    .get(id, revision ?? Number(project.revision));
  if (!row) fail(404, "Project version not found");
  return {
    project,
    revision: Number(row.revision),
    payload: JSON.parse(String(row.payload)) as SavedPayload,
  };
}
export function savePrivateProject(
  store: ControlStore,
  user: ControlUser,
  input: {
    id?: string;
    name: string;
    expectedRevision?: number;
    configuration: unknown;
  }
) {
  const parsed = projectCalculationInputSchema.parse(input.configuration),
    runtime = calculationRuntime(store, parsed.studioSnapshot);
  const payload: SavedPayload = {
    input: { ...parsed, studioSnapshot: runtime.snapshot },
    versions: runtime.versions,
  };
  return store.transaction(() => {
    const id = input.id ?? randomUUID(),
      now = new Date().toISOString();
    let revision = 1;
    if (input.id) {
      const old = ownedProject(store, user, id);
      if (Number(old.revision) !== input.expectedRevision)
        fail(
          409,
          "This project has changed. Your saved version is safe; reload or save your edits as a separate project."
        );
      revision = Number(old.revision) + 1;
      store.db
        .prepare(
          "UPDATE projects SET name=?,revision=?,updated_at=? WHERE id=?"
        )
        .run(input.name, revision, now, id);
    } else
      store.db
        .prepare("INSERT INTO projects VALUES(?,?,?,?,?)")
        .run(id, user.id, input.name, revision, now);
    store.db
      .prepare("INSERT INTO project_versions VALUES(?,?,?,?)")
      .run(id, revision, JSON.stringify(payload), now);
    store.audit(user.id, "project.saved", id, null, { revision });
    return { id, revision };
  });
}
export async function calculatePrivateProject(
  store: ControlStore,
  user: ControlUser,
  id: string,
  revision: number,
  useLatest: boolean
) {
  const old = projectVersion(store, user, id, revision);
  if (Number(old.project.revision) !== revision)
    fail(409, "Reload the latest project revision");
  const study = await runProjectCalculation(old.payload.input, {
    versions: useLatest ? undefined : old.payload.versions,
    store,
  });
  return store.transaction(() => {
    const current = ownedProject(store, user, id);
    if (Number(current.revision) !== revision)
      fail(
        409,
        "The project changed during calculation. Its saved versions were preserved."
      );
    const next = revision + 1,
      now = new Date().toISOString(),
      payload = { ...old.payload, versions: study.parameterVersions, study };
    store.db
      .prepare("INSERT INTO project_versions VALUES(?,?,?,?)")
      .run(id, next, JSON.stringify(payload), now);
    store.db
      .prepare("UPDATE projects SET revision=?,updated_at=? WHERE id=?")
      .run(next, now, id);
    store.audit(user.id, "project.calculated", id, null, {
      revision: next,
      versions: study.parameterVersions,
    });
    return { id, revision: next };
  });
}
export function quoteProject(
  store: ControlStore,
  user: ControlUser,
  id: string,
  revision: number
) {
  const { payload } = projectVersion(store, user, id, revision),
    quantities = new Map<string, number>();
  for (const s of payload.input.studioSnapshot.surfaces)
    if (s.enabled !== false && s.area > 0)
      quantities.set(s.profile, (quantities.get(s.profile) || 0) + s.area);
  if (!quantities.size) fail(409, "Add products before requesting a quotation");
  const quote = quoteLines(
    store,
    Array.from(quantities).map(([id, quantity]) => ({
      id,
      quantity,
      unit: "m2",
    }))
  );
  const quoteId = randomUUID(),
    now = new Date().toISOString();
  store.transaction(() => {
    store.db
      .prepare("INSERT INTO quotes VALUES(?,?,?,?,?,?,?)")
      .run(
        quoteId,
        user.id,
        id,
        revision,
        quote.priceVersion,
        JSON.stringify(quote),
        now
      );
    store.audit(user.id, "quote.created", quoteId, null, {
      projectId: id,
      revision,
    });
  });
  return { id: quoteId, projectId: id, revision, createdAt: now, ...quote };
}
export async function createReport(
  store: ControlStore,
  user: ControlUser,
  id: string,
  revision: number,
  language = "en"
) {
  const { project, payload } = projectVersion(store, user, id, revision);
  if (!payload.study)
    fail(409, "Calculate this project revision before downloading a report");
  const reportId = randomUUID(),
    createdAt = new Date().toISOString(),
    study = payload.study;
  const bytes =
    browserRenderingEnabled() && process.env.PUBLIC_BASE_URL
      ? await renderReportPdf(payload, study, language)
      : await textReport(project, payload, study, id, revision, reportId, createdAt);
  store.transaction(() => {
    store.db
      .prepare("INSERT INTO reports VALUES(?,?,?,?,?,?)")
      .run(
        reportId,
        user.id,
        id,
        revision,
        JSON.stringify({ versions: payload.versions, study }),
        createdAt
      );
    store.audit(user.id, "report.created", reportId, null, {
      projectId: id,
      revision,
    });
  });
  return { bytes, reportId };
}

const REPORT_VIEW_TTL_MS = 5 * 60 * 1000;
const reportViews = new Map<
  string,
  { study: ProjectCalculation; scenarioId: string; market: string; expires: number }
>();

/** Study behind a short-lived print link; the token is only handed to the PDF renderer. */
export function reportView(token: string) {
  const now = Date.now();
  for (const [key, view] of Array.from(reportViews)) if (view.expires < now) reportViews.delete(key);
  const view = reportViews.get(token);
  if (!view) fail(404, "This report link has expired");
  const { expires: _expires, ...rest } = view;
  return rest;
}

async function renderReportPdf(payload: SavedPayload, study: ProjectCalculation, language: string) {
  const token = randomBytes(24).toString("base64url");
  reportViews.set(token, {
    study,
    scenarioId: payload.input.energySettings?.batteryMode ?? "solar-only",
    market: payload.input.market,
    expires: Date.now() + REPORT_VIEW_TTL_MS,
  });
  try {
    const base = process.env.PUBLIC_BASE_URL!.replace(/\/$/, "");
    const buffer = await renderPdf(
      `${base}/r/${token}?lang=${encodeURIComponent(language)}`,
      ".print-report.is-ready",
      `Modernité BIPV · ${study.caseId}`
    );
    return new Uint8Array(buffer);
  } finally {
    reportViews.delete(token);
  }
}

async function textReport(
  project: Record<string, unknown>,
  payload: SavedPayload,
  study: ProjectCalculation,
  id: string,
  revision: number,
  reportId: string,
  createdAt: string
) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]),
    y = 785;
  const line = (value: string, heading = false) => {
    const safe = value.replace(/[^\x20-\x7e]/g, "?");
    for (let i = 0; i < safe.length; i += 86) {
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 785;
      }
      page.drawText(safe.slice(i, i + 86), {
        x: 48,
        y,
        font: heading ? bold : font,
        size: heading ? 15 : 10,
        color: rgb(0.09, 0.23, 0.19),
      });
      y -= heading ? 26 : 17;
    }
  };
  line("MODERNITE | Solar project report", true);
  line(String(project.name));
  line(`Report ${reportId}`);
  line(`Project ${id} / revision ${revision}`);
  line(`Generated ${createdAt}`);
  line(`Parameter release ${payload.versions.technical}`);
  line(`Catalogue release ${payload.versions.catalogue}`);
  y -= 16;
  line(`Location: ${payload.input.address}`);
  line(`Capacity: ${study.result.totalCapacityKwp.toFixed(2)} kWp`);
  line(
    `Estimated annual generation: ${Math.round(study.result.range.representative)} kWh`
  );
  line(`Weather: ${study.weather.name}`);
  line(`Source: ${study.weather.source}`);
  y -= 16;
  line("Product results", true);
  for (const s of study.result.surfaces) {
    line(
      `${s.productName}: ${s.areaM2.toFixed(1)} m2, ${Math.round(s.annualKwh)} kWh/year`
    );
  }
  y -= 16;
  line(
    "Preliminary design results. Technical values and area basis require review."
  );
  line(
    "This report is not a sales quotation. Request a quote for approved pricing."
  );
  return pdf.save();
}
