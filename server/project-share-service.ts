import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Express } from "express";
import { browserRenderingEnabled, d1Enabled, d1Query, ensureSchema, renderPdf } from "./cloudflare";
import { ENV } from "./_core/env";

export const PROJECT_ID = /^[A-Za-z0-9]{10}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function newId() {
  return Array.from(randomBytes(10), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

const dir = (kind: "projects" | "reports") => path.join(ENV.dataDir, kind);

export async function saveProject(payload: unknown, language: string) {
  const id = newId();
  const body = JSON.stringify(payload);
  if (d1Enabled()) {
    await ensureSchema();
    await d1Query("INSERT INTO projects (id, created_at, language, payload) VALUES (?, ?, ?, ?)", [id, Date.now(), language, body]);
  } else {
    await mkdir(dir("projects"), { recursive: true });
    await writeFile(path.join(dir("projects"), `${id}.json`), body);
  }
  return { id };
}

export async function loadProject(id: string): Promise<unknown | null> {
  if (!PROJECT_ID.test(id)) return null;
  if (d1Enabled()) {
    await ensureSchema();
    const rows = await d1Query<{ payload: string }>("SELECT payload FROM projects WHERE id = ?", [id]);
    return rows[0] ? JSON.parse(rows[0].payload) : null;
  }
  try {
    return JSON.parse(await readFile(path.join(dir("projects"), `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

const rendering = new Map<string, Promise<Buffer>>();
/** Bump when the print layout changes so cached PDFs are re-rendered. */
const REPORT_LAYOUT = "a4v2";

export function registerProjectReportRoute(app: Express) {
  app.get("/api/projects/:id/report.pdf", async (req, res) => {
    const id = req.params.id ?? "";
    const language = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(req.query.lang ?? "")) ? String(req.query.lang) : "en";
    if (!PROJECT_ID.test(id)) return void res.status(404).json({ error: "Unknown project" });
    if (!browserRenderingEnabled()) return void res.status(503).json({ error: "PDF rendering is not configured" });
    const file = path.join(dir("reports"), `${id}-${language}-${REPORT_LAYOUT}.pdf`);
    try {
      let pdf: Buffer;
      if (await stat(file).then(() => true, () => false)) pdf = await readFile(file);
      else {
        const project = (await loadProject(id)) as { study?: { caseId?: string } } | null;
        if (!project) return void res.status(404).json({ error: "Unknown project" });
        let pending = rendering.get(file);
        if (!pending) {
          const base = ENV.publicBaseUrl || `${req.protocol}://${req.get("host")}`;
          const footer = ["Modernité BIPV", project.study?.caseId].filter(Boolean).join(" · ");
          pending = renderPdf(`${base}/p/${id}?print=1&lang=${language}`, ".print-report.is-ready", footer)
            .then(async (buffer) => {
              await mkdir(dir("reports"), { recursive: true });
              await writeFile(file, buffer);
              return buffer;
            })
            .finally(() => rendering.delete(file));
          rendering.set(file, pending);
        }
        pdf = await pending;
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="modernite-study-${id}.pdf"`);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.end(pdf);
    } catch (error) {
      console.warn("[report] PDF failed", error instanceof Error ? error.message : error);
      res.status(502).json({ error: "PDF rendering failed" });
    }
  });
}
