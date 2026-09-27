import { invokeLLM } from "./_core/llm";

export type PlanningDemandInput = {
  householdSize: number;
  daytimeOccupancy: "usually" | "sometimes" | "rarely";
  electricHeating: boolean;
  heatPump: boolean;
  electricHotWater: boolean;
  evCharger: boolean;
  deterministicFallbackKwh: number;
};

export type PlanningDemandOutput = {
  annualDemandKwh: number;
  note: string;
  provider: "manus" | "offline-fallback";
};

/**
 * Adapter boundary for future deployments. The numerical solar result never
 * depends on this provider: it is limited to optional household-demand context
 * and plain-language explanation. A future offline service can implement this
 * interface without changing the calculation pipeline.
 */
export interface PlanningAIProvider {
  readonly id: "manus" | "offline-fallback";
  estimateAnnualDemand(input: PlanningDemandInput): Promise<PlanningDemandOutput>;
}

function textContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && "type" in part && "text" in part && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string"))
    .map((part) => part.text)
    .join("\n");
}

function withinPlanningRange(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 800 && value <= 80_000
    ? Math.round(value)
    : fallback;
}

export class OfflinePlanningAIProvider implements PlanningAIProvider {
  readonly id = "offline-fallback" as const;

  async estimateAnnualDemand(input: PlanningDemandInput): Promise<PlanningDemandOutput> {
    return {
      annualDemandKwh: input.deterministicFallbackKwh,
      note: "A cautious local household-demand estimate was used. Connect an offline planning AI provider later if a narrative estimate is required.",
      provider: this.id,
    };
  }
}

export class ManusPlanningAIProvider implements PlanningAIProvider {
  readonly id = "manus" as const;

  async estimateAnnualDemand(input: PlanningDemandInput): Promise<PlanningDemandOutput> {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You estimate an indicative annual household electricity demand from provided lifestyle inputs. Return a cautious planning estimate only. Never calculate solar generation, tariffs, payback, or product performance; those remain deterministic models outside this request.",
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "planning_demand_estimate",
          strict: true,
          schema: {
            type: "object",
            properties: {
              annualDemandKwh: { type: "number" },
              note: { type: "string" },
            },
            required: ["annualDemandKwh", "note"],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed = JSON.parse(textContent(response.choices[0]?.message.content ?? "")) as { annualDemandKwh?: unknown; note?: unknown };
    const annualDemandKwh = withinPlanningRange(parsed.annualDemandKwh, input.deterministicFallbackKwh);
    const note = typeof parsed.note === "string" && parsed.note.trim().length > 0
      ? parsed.note.trim().slice(0, 280)
      : "An AI-assisted household-demand estimate was used as planning context.";
    return { annualDemandKwh, note, provider: this.id };
  }
}

/**
 * Set MODERNITE_PLANNING_AI_MODE=offline in an offline deployment, then supply
 * a custom PlanningAIProvider at the composition boundary. The current hosted
 * default is Manus; a failure always falls back to the local deterministic rule.
 */
export function createPlanningAIProvider(mode = process.env.MODERNITE_PLANNING_AI_MODE): PlanningAIProvider {
  return mode === "offline" ? new OfflinePlanningAIProvider() : new ManusPlanningAIProvider();
}
