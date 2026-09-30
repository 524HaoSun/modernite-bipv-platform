import { randomUUID } from "node:crypto";
import { z } from "zod";
import { runCustomerStudy, syntheticWeatherFor, type CustomerStudy } from "../lib/customer-study";
import { PROFILES, type Weather } from "../lib/customer-energy-core";
import type { HomeEnergySettings, StudioCalculationSnapshot } from "../lib/studio-calculation";
import { invokeLLM } from "./_core/llm";
import { getGoogleSolarReference } from "./google-solar-service";
import { getPvgisTmyWeather } from "./weather-service";

export type ProjectCalculationInput = {
  market: "GB" | "EU" | "CA" | "JP";
  address: string;
  coordinates: { lat: number; lng: number };
  timezone?: number;
  timezoneName?: string;
  buildingNorthDeg?: number;
  studioSnapshot: StudioCalculationSnapshot;
  energySettings?: HomeEnergySettings;
};

export type { ProjectValidation } from "../lib/customer-study";

export type ProjectCalculation = CustomerStudy & {
  caseId: string;
  createdAt: string;
};

type StoredStudy = ProjectCalculation & { expiresAt: number };
const studies = new Map<string, StoredStudy>();
const STUDY_TTL_MS = 2 * 60 * 60 * 1000;

function purgeExpiredStudies() {
  const now = Date.now();
  for (const [id, study] of Array.from(studies.entries())) {
    if (study.expiresAt <= now) studies.delete(id);
  }
}

export async function runProjectCalculation(input: ProjectCalculationInput): Promise<ProjectCalculation> {
  if (!input.studioSnapshot.surfaces.some((surface) => surface.enabled !== false && surface.area > 0 && PROFILES[surface.profile])) {
    throw new Error("Add at least one supported solar product in Solar Studio before running the project calculation.");
  }
  const timezone = Number.isFinite(input.timezone) ? input.timezone! : Math.round(input.coordinates.lng / 15);
  const location = { lat: input.coordinates.lat, lon: input.coordinates.lng, tz: timezone, zone: input.timezoneName ?? "" };
  const year = new Date().getUTCFullYear() - 1;
  const [weatherResult, googleSolar] = await Promise.all([
    getPvgisTmyWeather({ ...location, address: input.address, year }).then(
      (weather): { weather: Weather; error?: string } => ({ weather }),
      (error: unknown) => ({ weather: syntheticWeatherFor(input.market, location), error: error instanceof Error ? error.message : String(error) }),
    ),
    getGoogleSolarReference(input.coordinates.lat, input.coordinates.lng).catch(() => null),
  ]);
  if (weatherResult.error) console.warn("[study] PVGIS unavailable, using customer synthetic climate:", weatherResult.error);

  const study = runCustomerStudy({
    market: input.market,
    address: input.address,
    coordinates: input.coordinates,
    timezone,
    snapshot: input.studioSnapshot,
    buildingNorthDeg: input.buildingNorthDeg,
    energySettings: input.energySettings,
    weather: weatherResult.weather,
    googleSolar,
  });
  const caseId = `MOD-${randomUUID().slice(0, 8).toUpperCase()}`;
  study.result.caseNumber = caseId;
  const stored: StoredStudy = { ...study, caseId, createdAt: new Date().toISOString(), expiresAt: Date.now() + STUDY_TTL_MS };
  purgeExpiredStudies();
  studies.set(caseId, stored);
  const { expiresAt: _expiresAt, ...response } = stored;
  return response;
}

const insightSchema = z.object({
  answer: z.string().min(1).max(900),
  evidence: z.array(z.string().min(1).max(160)).max(4),
  assumptions: z.array(z.string().min(1).max(180)).max(4),
  followUp: z.array(z.string().min(1).max(160)).max(3),
});

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && "type" in part && "text" in part && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string"))
    .map((part) => part.text)
    .join("\n");
}

function factPack(study: StoredStudy) {
  return {
    caseId: study.caseId,
    empiricalAnnualKwh: study.result.range.representative,
    empiricalRangeKwh: study.result.range,
    capacityKwp: Number(study.result.totalCapacityKwp.toFixed(2)),
    surfaces: study.result.surfaces.map((surface) => ({ label: surface.surfaceLabel, product: surface.productName, areaM2: Number(surface.areaM2.toFixed(1)), annualKwh: Math.round(surface.annualKwh) })),
    weather: study.weather,
    simulation: study.simulation,
    googleSolar: study.googleSolar,
    validation: study.validation,
    householdDemand: study.energy,
    method: study.result.engine.conversionRule,
    ledger: study.result.ledger.map((entry) => ({ label: entry.label, value: entry.value, provenance: entry.provenance })),
  };
}

export async function askProjectAssistant(caseId: string, question: string) {
  purgeExpiredStudies();
  const study = studies.get(caseId);
  if (!study) throw new Error("This project study has expired. Run the calculation again to continue the discussion.");
  const facts = factPack(study);
  try {
    const response = await invokeLLM({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content: "You are Modernité’s project-study assistant. Answer only from the supplied factual study record. Do not invent numbers, guarantees, financial outcomes, product specifications, warranties, or site observations. Explain that final design decisions require a qualified project review. Keep the answer concise and professional.",
        },
        { role: "user", content: `Question: ${question}\n\nFactual study record:\n${JSON.stringify(facts)}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "project_study_insight",
          strict: true,
          schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              evidence: { type: "array", items: { type: "string" } },
              assumptions: { type: "array", items: { type: "string" } },
              followUp: { type: "array", items: { type: "string" } },
            },
            required: ["answer", "evidence", "assumptions", "followUp"],
            additionalProperties: false,
          },
        },
      },
    });
    return insightSchema.parse(JSON.parse(textContent(response.choices[0]?.message.content ?? "")));
  } catch {
    return {
      answer: `The deterministic study estimates ${study.result.range.representative.toLocaleString()} kWh/year from ${study.result.totalCapacityKwp.toFixed(2)} kWp. The detailed surface breakdown and source ledger remain the authoritative record for this study.`,
      evidence: ["Deterministic empirical calculation completed", `Study reference: ${study.caseId}`],
      assumptions: [`The result uses the selected Studio geometry and ${study.weather.source}.`],
      followUp: ["Review the surface-level output", "Confirm location weather inside Solar Studio"],
    };
  }
}

export async function askDesignAssistant(question: string, stage: "design" | "energy") {
  try {
    const response = await invokeLLM({
      model: "gpt-5.5",
      messages: [
        {
          role: "system",
          content: "You are Modernité’s Design Studio guide. Explain only how to use the supplied customer Building, Products, Furnish, Lighting and Save workflow, or how the optional household-energy questions inform a planning study. Never invent product specifications, power figures, performance guarantees, or construction advice. Keep the answer under 120 words, professional and plain-language.",
        },
        { role: "user", content: `Stage: ${stage}\nQuestion: ${question}` },
      ],
    });
    const answer = textContent(response.choices[0]?.message.content ?? "").trim();
    if (!answer) throw new Error("Empty design assistant response");
    return { answer };
  } catch {
    return { answer: stage === "energy" ? "These choices describe household demand and storage preferences. They inform the 25-year planning scenarios after the customer Studio configuration has been captured." : "Complete the customer Studio in its normal order: choose a building form, configure products and finishes, review lighting, and save the configuration if you would like to return to it. Then use Prepare project study to continue." };
  }
}

export const projectCalculationInputSchema = z.object({
  market: z.enum(["GB", "EU", "CA", "JP"]),
  address: z.string().trim().min(2).max(300),
  coordinates: z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }),
  timezone: z.number().finite().min(-14).max(14).optional(),
  timezoneName: z.string().max(64).optional(),
  buildingNorthDeg: z.number().finite().min(-360).max(720).optional(),
  studioSnapshot: z.object({
    building: z.object({
      id: z.string().min(1).max(80),
      width: z.number().finite().positive().max(300).optional(),
      depth: z.number().finite().positive().max(300).optional(),
      floors: z.number().finite().positive().max(100).optional(),
      storeyHeight: z.number().finite().positive().max(30).optional(),
      usage: z.enum(["office", "residential"]).optional(),
      wwr: z.number().finite().min(0).max(0.95).optional(),
      glazedArea: z.number().finite().min(0).max(100_000).optional(),
    }),
    surfaces: z.array(z.object({
      id: z.string().min(1).max(160),
      product: z.string().min(1).max(80),
      profile: z.string().min(1).max(100),
      area: z.number().finite().min(0).max(100_000),
      tilt: z.number().finite().min(0).max(90),
      az: z.number().finite().min(0).max(360),
      enabled: z.boolean().optional(),
      role: z.string().max(80).optional(),
      linked: z.boolean().optional(),
      u: z.number().finite().min(0).max(10).optional(),
      g: z.number().finite().min(0).max(1).optional(),
    })).max(200),
  }),
  energySettings: z.object({
    demandMode: z.enum(["bill", "estimate"]),
    annualDemandKwh: z.number().finite().min(500).max(100_000).nullable().optional(),
    householdSize: z.number().finite().int().min(1).max(12),
    daytimeOccupancy: z.enum(["usually", "sometimes", "rarely"]),
    electricHeating: z.boolean(),
    heatPump: z.boolean(),
    electricHotWater: z.boolean(),
    evCharger: z.boolean(),
    batteryMode: z.enum(["solar-only", "solar-battery"]),
    batteryCapacityKwh: z.number().finite().min(1).max(100),
    projectPriceGbp: z.number().finite().min(0).max(10_000_000).nullable().optional(),
    batteryPriceGbp: z.number().finite().min(0).max(100_000).nullable().optional(),
  }).optional(),
});

export const projectAssistantInputSchema = z.object({
  caseId: z.string().regex(/^MOD-[A-F0-9]{8}$/),
  question: z.string().trim().min(2).max(600),
});

export const designAssistantInputSchema = z.object({
  question: z.string().trim().min(2).max(600),
  stage: z.enum(["design", "energy"]),
});

export type ProjectCalculationRequest = z.infer<typeof projectCalculationInputSchema>;
export type ProjectAssistantRequest = z.infer<typeof projectAssistantInputSchema>;
export type DesignAssistantRequest = z.infer<typeof designAssistantInputSchema>;
