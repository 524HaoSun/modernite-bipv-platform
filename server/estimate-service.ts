import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createEmpiricalEstimate } from "../lib/estimate-engine";
import { localClimateMethodNote, localEmpiricalClimateSeries } from "../lib/local-climate";
import { buildPlanningInput, regionForMarket, type HomeEnergySettings, type StudioCalculationSnapshot } from "../lib/studio-calculation";
import type { EstimateResult, Surface } from "../types/solar";
import { invokeLLM } from "./_core/llm";
import { createPlanningAIProvider } from "./planning-ai";

export type ProjectCalculationInput = {
  market: "GB" | "EU" | "CA" | "JP";
  address: string;
  coordinates: { lat: number; lng: number };
  studioSnapshot: StudioCalculationSnapshot;
  energySettings?: HomeEnergySettings;
};

export type ProjectValidation = {
  status: "not-connected";
  annualKwh: number | null;
  standardDeviationKwh: number | null;
  empiricalAnnualKwh: number;
  deltaKwh: number | null;
  deltaPercent: number | null;
  specificYield: number | null;
  endpoint: "v5_3/PVcalc" | null;
  database: string | null;
  note: string;
};

export type ProjectCalculation = {
  caseId: string;
  createdAt: string;
  result: EstimateResult;
  validation: ProjectValidation;
  energy: {
    annualDemandKwh: number;
    source: "bill" | "ai-estimate" | "fallback-estimate";
    note: string;
  };
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

function conservativeDemandFallback(settings: HomeEnergySettings | undefined) {
  const people = Math.max(1, Math.min(12, Math.round(settings?.householdSize ?? 2)));
  const occupancy = settings?.daytimeOccupancy === "usually" ? 500 : settings?.daytimeOccupancy === "rarely" ? -250 : 0;
  const heat = settings?.electricHeating ? 7_000 : settings?.heatPump ? 3_800 : 0;
  const hotWater = settings?.electricHotWater ? 1_300 : 0;
  const ev = settings?.evCharger ? 2_100 : 0;
  return Math.max(1_600, Math.round(1_450 + people * 900 + occupancy + heat + hotWater + ev));
}

async function resolveAnnualDemand(settings: HomeEnergySettings | undefined) {
  if (settings?.demandMode === "bill" && settings.annualDemandKwh && settings.annualDemandKwh > 0) {
    return { annualDemandKwh: Math.round(settings.annualDemandKwh), source: "bill" as const, note: "Annual demand supplied from the household energy bill." };
  }
  const fallback = conservativeDemandFallback(settings);
  if (!settings) {
    return { annualDemandKwh: fallback, source: "fallback-estimate" as const, note: "A cautious household estimate was used because a bill was not provided." };
  }
  try {
    const estimate = await createPlanningAIProvider().estimateAnnualDemand({
      householdSize: settings.householdSize ?? 2,
      daytimeOccupancy: settings.daytimeOccupancy ?? "sometimes",
      electricHeating: settings.electricHeating ?? false,
      heatPump: settings.heatPump ?? false,
      electricHotWater: settings.electricHotWater ?? false,
      evCharger: settings.evCharger ?? false,
      deterministicFallbackKwh: fallback,
    });
    return {
      annualDemandKwh: estimate.annualDemandKwh,
      source: estimate.provider === "manus" ? "ai-estimate" as const : "fallback-estimate" as const,
      note: estimate.note,
    };
  } catch {
    return { annualDemandKwh: fallback, source: "fallback-estimate" as const, note: "A cautious household estimate was used because a bill was not provided." };
  }
}

export async function runProjectCalculation(input: ProjectCalculationInput): Promise<ProjectCalculation> {
  const region = regionForMarket(input.market);
  const demand = await resolveAnnualDemand(input.energySettings);
  const planning = buildPlanningInput({
    region,
    label: input.address,
    coordinates: input.coordinates,
    snapshot: input.studioSnapshot,
    energySettings: {
      demandMode: input.energySettings?.demandMode ?? "estimate",
      annualDemandKwh: demand.annualDemandKwh,
      householdSize: input.energySettings?.householdSize ?? 2,
      daytimeOccupancy: input.energySettings?.daytimeOccupancy ?? "sometimes",
      electricHeating: input.energySettings?.electricHeating ?? false,
      heatPump: input.energySettings?.heatPump ?? false,
      electricHotWater: input.energySettings?.electricHotWater ?? false,
      evCharger: input.energySettings?.evCharger ?? false,
      batteryMode: input.energySettings?.batteryMode ?? "solar-only",
      batteryCapacityKwh: input.energySettings?.batteryCapacityKwh ?? 5,
      projectPriceGbp: input.energySettings?.projectPriceGbp ?? null,
      batteryPriceGbp: input.energySettings?.batteryPriceGbp ?? null,
    },
  });
  if (!planning.surfaces.length) throw new Error("Add at least one supported solar product in Solar Studio before running the project calculation.");

  const result = createEmpiricalEstimate(planning, (surface) => localEmpiricalClimateSeries({
    region,
    azimuthDeg: surface.azimuthDeg,
    tiltDeg: surface.tiltDeg,
  }));

  const validation: ProjectValidation = {
    status: "not-connected",
    annualKwh: null,
    standardDeviationKwh: null,
    empiricalAnnualKwh: result.range.representative,
    deltaKwh: null,
    deltaPercent: null,
    specificYield: null,
    endpoint: null,
    database: result.engine.irradianceDatabase,
    note: `${localClimateMethodNote(region)} The local empirical model is the active primary calculation. An external validation provider can be connected later, but it never blocks this result.`,
  };

  const caseId = `MOD-${randomUUID().slice(0, 8).toUpperCase()}`;
  const study: StoredStudy = { caseId, createdAt: new Date().toISOString(), result, validation, energy: demand, expiresAt: Date.now() + STUDY_TTL_MS };
  purgeExpiredStudies();
  studies.set(caseId, study);
  return study;
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
      model: "gpt-5-mini",
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
      assumptions: ["The result uses the selected Studio geometry and the local empirical climate profile."],
      followUp: ["Review the surface-level output", "Confirm location weather inside Solar Studio"],
    };
  }
}

export async function askDesignAssistant(question: string, stage: "design" | "energy") {
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
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
  studioSnapshot: z.object({
    building: z.object({
      id: z.string().min(1).max(80),
      width: z.number().finite().positive().max(300).optional(),
      depth: z.number().finite().positive().max(300).optional(),
      floors: z.number().finite().positive().max(100).optional(),
      storeyHeight: z.number().finite().positive().max(30).optional(),
      usage: z.enum(["office", "residential"]).optional(),
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
    })).max(80),
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
